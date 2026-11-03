package com.zhixiaofa.util;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 大模型接入配置：加载 {@code ai.properties} 并对外暴露只读取值。
 *
 * <h3>两级配置来源（管理端「AI 设置」页保存到哪里）</h3>
 * <ol>
 *   <li><b>外部配置文件</b>：{@code <项目根>/config/ai.properties}。**存在即优先**。
 *       由管理端保存时写入 —— 这样改配置**不必动源码、不必重新打包**。</li>
 *   <li><b>classpath 默认值</b>：{@code src/main/resources/ai.properties}（打包后在 {@code WEB-INF/classes}）。
 *       外部文件不存在时用它；管理端「恢复默认」就是删掉外部文件。</li>
 * </ol>
 *
 * <h3>为什么支持免重启（{@link #save} 后立刻生效）</h3>
 * <p>配置是<b>每次调用时从 {@link #CONF} 现读</b>的（没有把值缓存进静态字段），
 * 且 {@link #save} 里写文件后会立刻 {@link #reload()} 换掉整个 Properties 对象。
 * 于是「保存 → 下一个请求就用新配置」，不需要重启 Tomcat。
 * 这也是为什么本类不叫 {@code DBUtil} 那种「启动时读一次」的写法。</p>
 *
 * <h3>读取编码</h3>
 * <p>用 <b>UTF-8</b> 而不是 {@code Properties.load(InputStream)} 的 ISO-8859-1 ——
 * 这份配置里注释很重要（要告诉使用者怎么填 key、怎么换模型），中文不能乱码。</p>
 *
 * <h3>密钥安全</h3>
 * <p>{@link #apiKey()} 只在 {@code LlmClient} 里用于拼 Authorization 头。
 * <b>任何日志、异常信息、接口返回中都不允许出现它的完整值</b>；
 * 对外展示一律走 {@link #snapshot()}（只给掩码）。</p>
 *
 * <p>配置缺失或读取失败时全部走默认值且 {@link #isEnabled()} 返回 false ——
 * 也就是说「没配好」的效果是「回到原来的规则拼装」，而不是启动报错。</p>
 */
public final class AiConfig {

    private static final Logger log = LoggerFactory.getLogger(AiConfig.class);

    /** classpath 上的默认配置文件名 */
    private static final String CONFIG_FILE = "ai.properties";

    /** 外部配置文件所在目录（相对项目根） */
    private static final String EXTERNAL_DIR = "config";

    /** 写入外部文件时使用的键顺序（也决定了「哪些键受管理端控制」） */
    private static final String[] KEYS = {
            "ai.enabled", "ai.baseUrl", "ai.model", "ai.apiKey",
            "ai.timeoutMs", "ai.temperature", "ai.maxTokens", "ai.fillDocPlaceholders"
    };

    /**
     * 当前生效的配置。
     *
     * <p>刻意**不是 final**：{@link #reload()} 会加载到一个新的 Properties 再整体换引用，
     * 这样读方永远不会看到「加载到一半」的中间状态。{@code volatile} 保证换引用后立刻可见。</p>
     */
    private static volatile Properties CONF = new Properties();

    /** 当前配置从哪来（给管理端展示，避免「我明明改了却没生效」的困惑） */
    private static volatile String loadedFrom = "(尚未加载)";

    static {
        reload();
    }

    private AiConfig() {
    }

    // ================================================================== 加载 / 保存

    /**
     * 重新加载配置：外部文件优先，否则回退 classpath 默认值。
     *
     * <p>启动时自动调一次；管理端保存 / 恢复默认后也会调，从而实现免重启生效。</p>
     */
    public static synchronized void reload() {
        Properties p = new Properties();
        String from = "(未找到任何配置)";
        File ext = externalFile();
        try {
            if (ext.isFile()) {
                try (InputStream in = new FileInputStream(ext)) {
                    p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
                }
                from = "外部配置文件 " + ext.getAbsolutePath();
            } else {
                try (InputStream in = AiConfig.class.getClassLoader().getResourceAsStream(CONFIG_FILE)) {
                    if (in != null) {
                        p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
                        from = "classpath 默认 " + CONFIG_FILE;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("读取大模型配置失败，将使用默认值（能力关闭）: {}", e.getMessage());
        }
        CONF = p;
        loadedFrom = from;
        log.info("大模型配置已加载[{}]: enabled={}, baseUrl={}, model={}, apiKey={}",
                from, isEnabled(), baseUrl(), model(), apiKey().isEmpty() ? "(未填)" : "(已填)");
    }

    /**
     * 保存配置到外部文件，并立刻生效（无需重启）。
     *
     * <p>合并语义：只覆盖传入的键，未传的键保留当前生效值 —— 于是「只改温度」不会把 baseUrl 抹掉。</p>
     *
     * <p>{@code ai.apiKey} 特殊处理：<b>传空字符串表示「不修改」</b>（前端不回显完整密钥，
     * 用户没动它就不该被清掉）。要真正清空密钥请显式传 {@code "__CLEAR__"}。</p>
     *
     * @param patch 待保存的键值（键名同 ai.properties）
     * @throws IllegalArgumentException 取值非法（会让管理端看到明确提示，而不是静默存坏配置）
     */
    public static synchronized void save(Map<String, String> patch) throws IllegalArgumentException {
        Map<String, String> cur = effective();
        if (patch != null) {
            for (Map.Entry<String, String> e : patch.entrySet()) {
                String k = e.getKey() == null ? "" : e.getKey().trim();
                if (!isKnownKey(k)) {
                    continue;   // 不认识键忽略，避免前端多传字段把文件写脏
                }
                String v = e.getValue() == null ? "" : e.getValue().trim();
                if ("ai.apiKey".equals(k) && v.isEmpty()) {
                    continue;   // 留空 = 不修改
                }
                if ("ai.apiKey".equals(k) && "__CLEAR__".equals(v)) {
                    cur.put(k, "");
                    continue;
                }
                cur.put(k, v);
            }
        }
        validate(cur);

        File ext = externalFile();
        File dir = ext.getParentFile();
        if (dir != null && !dir.isDirectory() && !dir.mkdirs()) {
            throw new IllegalStateException("无法创建配置目录: " + dir.getAbsolutePath());
        }
        try (OutputStreamWriter w = new OutputStreamWriter(
                new FileOutputStream(ext), StandardCharsets.UTF_8)) {
            w.write("# 由「管理端 → 系统运维 → AI 设置」保存。\n");
            w.write("# 本文件**优先于** classpath 里的默认 ai.properties；删掉本文件即恢复默认。\n");
            w.write("# 保存时间：" + LocalDateTime.now().format(
                    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")) + "\n");
            w.write("# ⚠️ 含密钥，不要提交到公开仓库。\n\n");
            for (String k : KEYS) {
                w.write(k + "=" + cur.getOrDefault(k, "") + "\n");
            }
            w.flush();
        } catch (Exception e) {
            throw new IllegalStateException("写入配置文件失败: " + e.getMessage());
        }
        reload();
        log.info("大模型配置已由管理端保存到 {}（已立即生效，无需重启）", ext.getAbsolutePath());
    }

    /** 删除外部配置文件，回退到 classpath 默认值（管理端「恢复默认」） */
    public static synchronized void clearExternal() {
        File ext = externalFile();
        if (ext.isFile() && !ext.delete()) {
            throw new IllegalStateException("删除外部配置失败: " + ext.getAbsolutePath());
        }
        reload();
    }

    /** 是否正在使用外部配置文件（管理端据此显示「已自定义 / 用默认」） */
    public static boolean usingExternal() {
        return externalFile().isFile();
    }

    /** 外部配置文件的绝对路径 */
    public static File externalFile() {
        return new File(projectRoot(), EXTERNAL_DIR + File.separator + CONFIG_FILE);
    }

    /**
     * 定位项目根目录：从当前工作目录向上找第一个含 {@code pom.xml} 的目录。
     *
     * <p>必须这样找，而不是直接用 {@code user.dir} —— 用 {@code tomcat7:run} 启动时
     * 工作目录是 {@code target/tomcat}，配置写到那里会被 {@code mvn clean} 一起删掉，
     * 用户下次就找不到自己的配置了。</p>
     *
     * <p>包内可见：{@link MailConfig} 用同一套外部配置目录，避免复制这段路径逻辑。</p>
     */
    static File projectRoot() {
        File d = new File(System.getProperty("user.dir", ".")).getAbsoluteFile();
        File cur = d;
        for (int i = 0; i < 6 && cur != null; i++) {
            if (new File(cur, "pom.xml").isFile()) {
                return cur;
            }
            cur = cur.getParentFile();
        }
        return d;
    }

    private static boolean isKnownKey(String k) {
        for (String s : KEYS) {
            if (s.equals(k)) {
                return true;
            }
        }
        return false;
    }

    /** 当前生效值（含缺省键补齐），用于保存时合并 */
    private static Map<String, String> effective() {
        Map<String, String> m = new LinkedHashMap<>();
        m.put("ai.enabled", str("ai.enabled", "true"));
        m.put("ai.baseUrl", str("ai.baseUrl", ""));
        m.put("ai.model", str("ai.model", ""));
        m.put("ai.apiKey", str("ai.apiKey", ""));
        m.put("ai.timeoutMs", String.valueOf(timeoutMs()));
        m.put("ai.temperature", String.valueOf(temperature()));
        m.put("ai.maxTokens", String.valueOf(maxTokens()));
        m.put("ai.fillDocPlaceholders", String.valueOf(fillDocPlaceholders()));
        return m;
    }

    /**
     * 取值校验。放在保存这一侧，是为了让用户在**保存时**就看到「温度写成了 abc」这类问题，
     * 而不是等某次问答静默退回规则拼装后才一头雾水。
     */
    private static void validate(Map<String, String> m) throws IllegalArgumentException {
        String base = m.getOrDefault("ai.baseUrl", "");
        if (!base.isEmpty() && !(base.startsWith("http://") || base.startsWith("https://"))) {
            throw new IllegalArgumentException("ai.baseUrl 必须以 http:// 或 https:// 开头");
        }
        if (!m.getOrDefault("ai.model", "").isEmpty()
                && m.getOrDefault("ai.baseUrl", "").isEmpty()) {
            throw new IllegalArgumentException("填了模型名就必须填 baseUrl");
        }
        intOfChecked(m, "ai.timeoutMs", 1000, 600000);
        intOfChecked(m, "ai.maxTokens", 128, 32000);
        String temp = m.getOrDefault("ai.temperature", "0.3");
        try {
            double d = Double.parseDouble(temp);
            if (d < 0 || d > 2) {
                throw new IllegalArgumentException("ai.temperature 应在 0 ~ 2 之间");
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("ai.temperature 不是数字: " + temp);
        }
    }

    private static void intOfChecked(Map<String, String> m, String key, int min, int max)
            throws IllegalArgumentException {
        String v = m.getOrDefault(key, "");
        try {
            int n = Integer.parseInt(v);
            if (n < min || n > max) {
                throw new IllegalArgumentException(key + " 应在 " + min + " ~ " + max + " 之间");
            }
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(key + " 不是整数: " + v);
        }
    }

    // ================================================================== 对管理端暴露的快照

    /**
     * 配置快照，**专供管理端展示**。
     *
     * <p>密钥只给「是否已填 + 掩码」（如 {@code sk-abc…1234}），绝不给完整值。</p>
     */
    public static Map<String, Object> snapshot() {
        Map<String, Object> m = new LinkedHashMap<>();
        String key = apiKey();
        m.put("enabled", Boolean.parseBoolean(str("ai.enabled", "false")));
        m.put("baseUrl", baseUrl());
        m.put("model", model());
        m.put("apiKeySet", !key.isEmpty());
        m.put("apiKeyMask", mask(key));
        m.put("timeoutMs", timeoutMs());
        m.put("temperature", temperature());
        m.put("maxTokens", maxTokens());
        m.put("fillDocPlaceholders", fillDocPlaceholders());
        // 是否真正生效（三个条件同时满足），以及**缺哪一个** —— 页面要能直接告诉用户原因
        m.put("effective", isEnabled());
        m.put("missing", missing());
        m.put("source", loadedFrom);
        m.put("externalPath", externalFile().getAbsolutePath());
        m.put("usingExternal", usingExternal());
        return m;
    }

    /** 还没满足的生效条件（空列表 = 已启用） */
    public static List<String> missing() {
        List<String> miss = new ArrayList<>();
        if (!Boolean.parseBoolean(str("ai.enabled", "false"))) {
            miss.add("总开关未打开（ai.enabled）");
        }
        if (baseUrl().isEmpty()) {
            miss.add("缺少接口地址（ai.baseUrl）");
        }
        if (apiKey().isEmpty()) {
            miss.add("缺少密钥（ai.apiKey）");
        }
        return miss;
    }

    /** 密钥掩码：只留首 6 位与后 4 位，短密钥更保守 */
    public static String mask(String key) {
        if (key == null || key.isEmpty()) {
            return "";
        }
        if (key.length() <= 10) {
            return key.charAt(0) + "***";
        }
        return key.substring(0, 6) + "…" + key.substring(key.length() - 4);
    }

    // ================================================================== 只读取值

    private static String str(String key, String def) {
        String v = CONF.getProperty(key);
        return (v == null || v.trim().isEmpty()) ? def : v.trim();
    }

    private static int intOf(String key, int def) {
        try {
            return Integer.parseInt(str(key, String.valueOf(def)));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    private static double doubleOf(String key, double def) {
        try {
            return Double.parseDouble(str(key, String.valueOf(def)));
        } catch (NumberFormatException e) {
            return def;
        }
    }

    /**
     * 大模型能力是否可用。
     *
     * <p>三个条件同时满足才算可用：开关打开、baseUrl 非空、apiKey 非空。
     * 因此「只填了 baseUrl 忘了填 key」不会让功能报错，而是安静地退回规则拼装。</p>
     */
    public static boolean isEnabled() {
        boolean on = Boolean.parseBoolean(str("ai.enabled", "false"));
        return on && !baseUrl().isEmpty() && !apiKey().isEmpty();
    }

    /** OpenAI 兼容的 baseUrl，例如 {@code https://token.sensenova.cn/v1}（末尾斜杠会被去掉） */
    public static String baseUrl() {
        String u = str("ai.baseUrl", "");
        while (u.endsWith("/")) {
            u = u.substring(0, u.length() - 1);
        }
        return u;
    }

    public static String model() {
        return str("ai.model", "");
    }

    public static String apiKey() {
        return str("ai.apiKey", "");
    }

    public static int timeoutMs() {
        return intOf("ai.timeoutMs", 60000);
    }

    public static double temperature() {
        return doubleOf("ai.temperature", 0.3);
    }

    public static int maxTokens() {
        return intOf("ai.maxTokens", 1600);
    }

    /** 是否允许模型补全文书模板里用户留空的占位符 */
    public static boolean fillDocPlaceholders() {
        return Boolean.parseBoolean(str("ai.fillDocPlaceholders", "true"));
    }
}
