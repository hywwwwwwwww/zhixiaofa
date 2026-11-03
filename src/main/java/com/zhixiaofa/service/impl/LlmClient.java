package com.zhixiaofa.service.impl;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhixiaofa.util.AiConfig;

/**
 * OpenAI 兼容协议的大模型客户端（商汤 SenseNova / 日日新）。
 *
 * <h3>为什么用 OpenAI 兼容协议</h3>
 * <p>SenseNova 提供了 OpenAI 兼容入口，请求体与返回体都是标准形状，
 * 因此换供应商只需改 {@code ai.properties} 里的 baseUrl 与 model，<b>不用动 Java 代码</b>。</p>
 *
 * <h3>为什么零新依赖</h3>
 * <p>HTTP 客户端用 JDK 17 自带的 {@link java.net.http.HttpClient}；
 * JSON 用项目已有的 Jackson（{@code jackson-databind}）。故 {@code pom.xml} 无需任何改动。</p>
 *
 * <h3>失败策略：抛异常，由调用方降级</h3>
 * <p>本类<b>不做任何兜底</b>，全部以异常形式向上抛。调用方（问答 / 小法庭 / 文书）负责
 * 在 catch 里退回原来的规则实现 —— 这样「模型服务挂了」不会让功能挂掉，
 * 只是回答质量降级。<b>这是刻意的设计，不要在调用方写重试循环</b>（会拖长接口响应）。</p>
 *
 * <h3>密钥安全</h3>
 * <p>apiKey 只用于拼 Authorization 头。<b>日志、异常信息、接口返回中一律不出现它</b> ——
 * 本类打印错误时只输出状态码与响应体，而响应体来自服务端、不含请求头。</p>
 */
public final class LlmClient {

    private static final Logger log = LoggerFactory.getLogger(LlmClient.class);

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static final String PATH = "/chat/completions";

    private LlmClient() {
    }

    /** 拼好的 chat/completions 地址 */
    private static String endpoint() {
        return AiConfig.baseUrl() + PATH;
    }

    // ------------------------------------------------------------------ 对外入口

    /**
     * 单轮对话：给定系统提示词与用户消息，返回模型的回答正文。
     *
     * @param systemPrompt 系统提示词（角色 + 硬约束）
     * @param userMessage  用户消息（问题 + 召回的法条等上下文）
     * @return 模型回答正文（已 trim，非空）
     * @throws Exception 未启用、网络失败、HTTP 非 2xx、响应结构异常 —— 一律抛异常交调用方降级
     */
    public static String chat(String systemPrompt, String userMessage) throws Exception {
        if (!AiConfig.isEnabled()) {
            throw new IllegalStateException("大模型未启用（检查 ai.properties 的 enabled / baseUrl / apiKey）");
        }
        List<Map<String, String>> messages = new ArrayList<>();
        if (systemPrompt != null && !systemPrompt.isEmpty()) {
            messages.add(msg("system", systemPrompt));
        }
        messages.add(msg("user", userMessage));
        return call(messages, true);
    }

    /**
     * 用一次极短的请求探测配置是否真的可用（给 {@code tools/ai-check.py} 之外的场景用）。
     *
     * @return 模型的回话内容
     * @throws Exception 同 {@link #chat}
     */
    public static String ping() throws Exception {
        return chat("你是一个连通性探针，只回复「OK」两个字母。", "连通性测试");
    }

    /**
     * 连通性自检，**给管理端「AI 设置」页的「测试连通」按钮用**。
     *
     * <p>走的就是 {@link #chat}，也就是问答 / 小法庭 / 文书 / 合同审查实际使用的那条路径 ——
     * 所以「这里通了」等于「功能真的能用」，而不只是「域名能解析」。</p>
     *
     * <p><b>永远不抛异常</b>：失败信息放进返回值里，页面上直接显示给管理员看。
     * 错误信息只含状态码与服务端响应体，<b>不含 apiKey</b>。</p>
     *
     * @return { ok, enabled, baseUrl, model, reply/error, costMs, missing }
     */
    public static Map<String, Object> selfTest() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("ok", false);
        m.put("enabled", AiConfig.isEnabled());
        m.put("baseUrl", AiConfig.baseUrl());
        m.put("model", AiConfig.model());
        m.put("missing", AiConfig.missing());
        long t0 = System.currentTimeMillis();
        try {
            String reply = ping();
            m.put("ok", true);
            m.put("reply", brief(reply));
        } catch (Exception e) {
            m.put("error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
        m.put("costMs", System.currentTimeMillis() - t0);
        return m;
    }

    // ------------------------------------------------------------------ 内部实现

    private static Map<String, String> msg(String role, String content) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("role", role);
        m.put("content", content);
        return m;
    }

    /**
     * 发一次请求。
     *
     * @param allowTokenParamRetry 首次用 {@code max_tokens}；若服务端报「不认识该参数」，
     *                             允许换 {@code max_new_tokens} 重试一次 ——
     *                             SenseNova 的<b>原生</b>接口用的是后者，兼容入口用的是前者。
     *                             这样两个入口都能直接用，不必让使用者去分辨自己拿的是哪个。
     */
    private static String call(List<Map<String, String>> messages, boolean allowTokenParamRetry) throws Exception {
        String body = buildBody(messages, "max_tokens");

        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(Math.min(AiConfig.timeoutMs(), 15000)))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(endpoint()))
                .timeout(Duration.ofMillis(AiConfig.timeoutMs()))
                .header("Content-Type", "application/json; charset=utf-8")
                .header("Accept", "application/json")
                .header("Authorization", "Bearer " + AiConfig.apiKey())
                .POST(HttpRequest.BodyPublishers.ofString(body, StandardCharsets.UTF_8))
                .build();

        HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
        int code = resp.statusCode();
        String text = resp.body() == null ? "" : resp.body();

        if (code == 400 && allowTokenParamRetry && text.contains("max_tokens")) {
            log.info("服务端不认 max_tokens，改用 max_new_tokens 重试一次");
            String body2 = buildBody(messages, "max_new_tokens");
            HttpRequest req2 = HttpRequest.newBuilder()
                    .uri(URI.create(endpoint()))
                    .timeout(Duration.ofMillis(AiConfig.timeoutMs()))
                    .header("Content-Type", "application/json; charset=utf-8")
                    .header("Authorization", "Bearer " + AiConfig.apiKey())
                    .POST(HttpRequest.BodyPublishers.ofString(body2, StandardCharsets.UTF_8))
                    .build();
            resp = client.send(req2, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            code = resp.statusCode();
            text = resp.body() == null ? "" : resp.body();
        }

        if (code < 200 || code >= 300) {
            // 只打状态码与响应体。**响应体来自服务端，不回显请求头**，因此不会泄露 key。
            throw new IllegalStateException("模型接口返回 HTTP " + code + ": " + brief(text));
        }

        JsonNode root = MAPPER.readTree(text);
        JsonNode content = root.path("choices").path(0).path("message").path("content");
        String out = content.isTextual() ? content.asText() : "";
        out = out == null ? "" : out.trim();
        if (out.isEmpty()) {
            throw new IllegalStateException("模型返回内容为空: " + brief(text));
        }
        return stripMarkdown(out);
    }

    /** 行首的 Markdown 标题/引用记号：{@code # } 到 {@code ###### }、{@code > } */
    private static final Pattern P_HEADING = Pattern.compile("^\\s{0,3}(#{1,6}\\s+|>\\s*)", Pattern.MULTILINE);

    /** 行首的 Markdown 无序列表记号：{@code - } / {@code * } / {@code + } */
    private static final Pattern P_BULLET = Pattern.compile("^\\s{0,3}[-*+]\\s+", Pattern.MULTILINE);

    /** 围栏代码块整行：{@code ```json} / {@code ```} */
    private static final Pattern P_FENCE = Pattern.compile("^\\s*`{3,}.*$", Pattern.MULTILINE);

    /**
     * 去掉模型误用的 Markdown 记号，只留纯文本。
     *
     * <h4>为什么需要这一步</h4>
     * <p>前端（如 {@code qa.html} 的 {@code answerHtml()}）是<b>纯文本渲染</b>：先转义，
     * 再把 {@code 【小节名】} 包成标题、把换行换成 {@code <br>}。
     * 它<b>不认识 Markdown</b> —— 模型一旦不听话写出 {@code **加粗**}、{@code ### 标题}、
     * 列表前的 {@code -}，这些符号就会原样暴露在界面上，看起来像代码没写完。</p>
     *
     * <p>提示词里已经明令禁止 Markdown，但这是<b>概率问题而非确定性问题</b>，
     * 所以在这里兜一道底。清洗是「无损语义」的：只去掉装饰性记号，不改动任何文字内容，
     * 因此不会影响法条引用、数字、文书条款。</p>
     *
     * <p>注意<b>不要</b>顺手把 {@code 1. 2. 3.} 这种有序编号也改掉 —— 那是提示词要求的
     * 表达方式，且是真正的序列信息。</p>
     */
    private static String stripMarkdown(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        String o = s;
        o = P_FENCE.matcher(o).replaceAll("");          // ```json / ``` 整行删掉
        o = P_HEADING.matcher(o).replaceAll("");        // ### 标题 / > 引用 -> 去掉记号
        o = P_BULLET.matcher(o).replaceAll("· ");       // - 项目 -> 中文间隔号，比裸横线自然
        o = o.replace("**", "").replace("__", "");      // 加粗
        o = o.replace("~~", "").replace("`", "");       // 删除线 / 行内代码
        o = o.replaceAll("\\n{3,}", "\n\n");         // 收紧多余空行（模型很爱连空三行以上）
        return o.trim();
    }

    private static String buildBody(List<Map<String, String>> messages, String tokenParam) throws Exception {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", AiConfig.model());
        body.put("messages", messages);
        body.put("temperature", AiConfig.temperature());
        body.put(tokenParam, AiConfig.maxTokens());
        body.put("stream", false);
        return MAPPER.writeValueAsString(body);
    }

    /** 截断响应体，避免超长内容刷屏日志 */
    private static String brief(String s) {
        if (s == null) {
            return "";
        }
        String one = s.replaceAll("\\s+", " ").trim();
        return one.length() <= 400 ? one : one.substring(0, 400) + "…";
    }
}
