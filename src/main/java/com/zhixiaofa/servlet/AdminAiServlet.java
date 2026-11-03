package com.zhixiaofa.servlet;

import com.zhixiaofa.common.Result;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.service.impl.LlmClient;
import com.zhixiaofa.util.AiConfig;
import com.zhixiaofa.util.StringUtil;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 大模型接入配置接口（仅管理员）。映射：{@code /api/admin/ai/*}
 *
 * <table>
 *   <caption>契约</caption>
 *   <tr><td>GET</td><td>{@code /api/admin/ai}</td><td>读配置快照（密钥只给掩码）</td></tr>
 *   <tr><td>PUT</td><td>{@code /api/admin/ai}</td><td>保存并**立即生效**（写外部配置文件，无需重启）</td></tr>
 *   <tr><td>DELETE</td><td>{@code /api/admin/ai}</td><td>删除外部配置，恢复 classpath 默认</td></tr>
 *   <tr><td>POST</td><td>{@code /api/admin/ai/test}</td><td>连通性自检（真发一次对话）</td></tr>
 *   <tr><td>POST</td><td>{@code /api/admin/ai/reload}</td><td>手工重新加载配置</td></tr>
 * </table>
 *
 * <p><b>为什么保存不需要重启</b>：配置存在 {@code AiConfig} 里，每次调用现读；
 * 保存后 {@code AiConfig.save} 会写文件并立刻 reload。<b>这是本页存在的意义</b> ——
 * 否则改一个 key 就要「编译 + 重启」，演示时很难看。</p>
 *
 * <p><b>权限</b>：四个能力都走管理员校验。注意本路径不在 {@code AuthFilter} 的匿名白名单里，
 * 所以未登录会先被过滤器拦成 401 而不是走到这里。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/admin/ai/*")
public class AdminAiServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        requireAdmin(req);
        String action = StringUtil.defaultIfEmpty(pathString(req), "");
        String method = req.getMethod();

        if (action.isEmpty()) {
            switch (method) {
                case "GET":
                    return Result.success(AiConfig.snapshot());
                case "PUT":
                    return save(req);
                case "DELETE":
                    AiConfig.clearExternal();
                    return Result.success(AiConfig.snapshot());
                default:
                    throw new BizException(ResultCode.NOT_FOUND, "不支持的方法: " + method);
            }
        }
        if ("test".equals(action) && "POST".equals(method)) {
            // ⚠️ 用**已保存的**配置测试（不是页面上还没保存的输入）——
            //   「测试」与「实际生效的配置」必须是同一个东西，否则测过也不代表功能能用。
            return Result.success(LlmClient.selfTest());
        }
        if ("reload".equals(action) && "POST".equals(method)) {
            AiConfig.reload();
            return Result.success(AiConfig.snapshot());
        }
        throw new BizException(ResultCode.NOT_FOUND, "未知的 AI 配置资源: " + action);
    }

    /**
     * 保存配置。
     *
     * <p>把取值的 {@link IllegalArgumentException} 转成「参数错误」业务码，
     * 这样页面上能直接显示「ai.temperature 不是数字」这种可操作的提示，
     * 而不是抛成 500 让管理员猜哪里写错了。</p>
     */
    private Result<?> save(HttpServletRequest req) {
        Map<String, Object> raw = bodyMap(req);
        Map<String, String> patch = new LinkedHashMap<>();
        for (Map.Entry<String, Object> e : raw.entrySet()) {
            patch.put(e.getKey(), e.getValue() == null ? "" : String.valueOf(e.getValue()));
        }
        try {
            AiConfig.save(patch);
        } catch (IllegalArgumentException e) {
            throw new BizException(ResultCode.PARAM_ERROR, e.getMessage());
        } catch (IllegalStateException e) {
            throw new BizException(ResultCode.SERVER_ERROR, e.getMessage());
        }
        return Result.success(AiConfig.snapshot());
    }
}
