package com.zhixiaofa.servlet;

import com.zhixiaofa.common.Result;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.util.JsonUtil;
import com.zhixiaofa.util.RequestUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;

/**
 * Servlet 基类：把「取参 → 调 Service → 写 JSON → 异常兜底」这套重复动作收敛到一处。
 *
 * <p>职责边界（课程要求：Servlet 不包含业务逻辑）：</p>
 * <ul>
 *   <li>本类只做协议层的事：解析请求、校验登录态、序列化响应、统一异常；</li>
 *   <li>业务规则一律下沉到 Service，子类 {@link #handle} 里通常只有 2~4 行。</li>
 * </ul>
 *
 * <p>RESTful 支持：子类通过 {@code urlPatterns} 映射到 {@code /api/xxx/*}，
 * 用 {@link #pathVariable(HttpServletRequest)} 取路径尾部的主键，
 * 于是 {@code GET /api/qa/5}、{@code PUT /api/qa/5}、{@code DELETE /api/qa/5} 都能落到同一个 Servlet。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public abstract class BaseServlet extends HttpServlet {

    private static final long serialVersionUID = 1L;

    protected final Logger log = LoggerFactory.getLogger(getClass());

    /** Session 中保存当前登录用户的 key */
    public static final String SESSION_USER = "loginUser";

    /** 子类实现：处理一次请求。返回 null 表示已经在方法内部自行输出了响应。 */
    protected abstract Result<?> handle(HttpServletRequest req, HttpServletResponse resp) throws Exception;

    /* ------------------------------------------------------------------ HTTP 方法分发 */

    @Override
    protected void doGet(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        dispatch(req, resp);
    }

    @Override
    protected void doPost(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        dispatch(req, resp);
    }

    @Override
    protected void doPut(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        dispatch(req, resp);
    }

    @Override
    protected void doDelete(HttpServletRequest req, HttpServletResponse resp) throws ServletException, IOException {
        dispatch(req, resp);
    }

    /**
     * 统一调度：所有 HTTP 方法最终都走这里，保证异常处理只有一份。
     */
    private void dispatch(HttpServletRequest req, HttpServletResponse resp) throws IOException {
        long start = System.currentTimeMillis();
        try {
            Result<?> result = handle(req, resp);
            if (result != null) {
                writeJson(resp, result, HttpServletResponse.SC_OK);
            }
            log.debug("{} {} 完成，耗时 {}ms", req.getMethod(), req.getRequestURI(),
                    System.currentTimeMillis() - start);
        } catch (BizException e) {
            log.warn("业务异常 {} {}: [{}] {}", req.getMethod(), req.getRequestURI(), e.getCode(), e.getMessage());
            writeJson(resp, Result.error(e.getCode(), e.getMessage()), HttpServletResponse.SC_OK);
        } catch (Exception e) {
            log.error("系统异常 {} {}", req.getMethod(), req.getRequestURI(), e);
            writeJson(resp, Result.error(ResultCode.SERVER_ERROR,
                    "服务器内部错误：" + e.getClass().getSimpleName()), HttpServletResponse.SC_INTERNAL_SERVER_ERROR);
        }
    }

    /** 输出统一 JSON 响应 */
    protected void writeJson(HttpServletResponse resp, Result<?> result, int httpStatus) throws IOException {
        resp.setStatus(httpStatus);
        resp.setContentType("application/json;charset=UTF-8");
        resp.setCharacterEncoding("UTF-8");
        // AJAX 场景禁用缓存，避免 IE 缓存 GET 结果
        resp.setHeader("Cache-Control", "no-store");
        try (PrintWriter out = resp.getWriter()) {
            out.write(JsonUtil.toJson(result));
            out.flush();
        }
    }

    /* ------------------------------------------------------------------ 通用辅助方法 */

    /**
     * 解析请求体为对象，请求体为空时返回 null。
     */
    protected <T> T body(HttpServletRequest req, Class<T> clazz) {
        String json = RequestUtil.readBody(req);
        if (StringUtil.isEmpty(json)) {
            return null;
        }
        return JsonUtil.parse(json, clazz);
    }

    /** 解析请求体为 Map，用于「部分字段更新」等场景 */
    protected java.util.Map<String, Object> bodyMap(HttpServletRequest req) {
        String json = RequestUtil.readBody(req);
        if (StringUtil.isEmpty(json) || "null".equals(json)) {
            return new java.util.HashMap<>();
        }
        return JsonUtil.parseMap(json);
    }

    /** 取路径变量，如 /api/qa/5 → 5；无则返回 null */
    protected Long pathVariable(HttpServletRequest req) {
        String path = req.getPathInfo();
        if (StringUtil.isEmpty(path) || "/".equals(path)) {
            return null;
        }
        String id = path.substring(1);
        int slash = id.indexOf('/');
        if (slash >= 0) {
            id = id.substring(0, slash);
        }
        try {
            return Long.parseLong(id);
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "路径参数 " + id + " 不是合法的主键");
        }
    }

    /** 取路径变量的字符串形式（用于 /api/xxx/search 这类子资源） */
    protected String pathString(HttpServletRequest req) {
        String path = req.getPathInfo();
        if (StringUtil.isEmpty(path) || "/".equals(path)) {
            return "";
        }
        String s = path.substring(1);
        int slash = s.indexOf('/');
        return slash >= 0 ? s.substring(0, slash) : s;
    }

    /**
     * 把 pathInfo 拆成片段数组，便于实现 RESTful 子资源。
     *
     * <p>例如 {@code /5/status} → {@code ["5", "status"]}；{@code /} → 空数组。</p>
     */
    protected String[] pathSegments(HttpServletRequest req) {
        String path = req.getPathInfo();
        if (StringUtil.isEmpty(path) || "/".equals(path)) {
            return new String[0];
        }
        String s = path.startsWith("/") ? path.substring(1) : path;
        return s.split("/");
    }

    /** 取第 idx 个路径片段（从 0 开始），不存在返回 null */
    protected String segment(HttpServletRequest req, int idx) {
        String[] segs = pathSegments(req);
        return idx < segs.length && !segs[idx].isEmpty() ? segs[idx] : null;
    }

    /** 取第 idx 个路径片段并解析为 Long，非法时抛参数异常 */
    protected Long segmentAsLong(HttpServletRequest req, int idx) {
        String s = segment(req, idx);
        if (s == null) {
            throw new BizException(ResultCode.PARAM_ERROR, "缺少路径参数");
        }
        try {
            return Long.parseLong(s);
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "路径参数 " + s + " 不是合法的主键");
        }
    }

    /** @return 当前登录用户，未登录返回 null */
    protected SysUser currentUser(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        return session == null ? null : (SysUser) session.getAttribute(SESSION_USER);
    }

    /** 要求已登录，否则抛 401 业务异常 */
    protected SysUser requireLogin(HttpServletRequest req) {
        SysUser user = currentUser(req);
        if (user == null) {
            throw new BizException(ResultCode.UNAUTHORIZED);
        }
        return user;
    }

    /** 要求管理员权限 */
    protected SysUser requireAdmin(HttpServletRequest req) {
        SysUser user = requireLogin(req);
        if (!"ADMIN".equalsIgnoreCase(user.getRole())) {
            throw new BizException(ResultCode.FORBIDDEN, "该操作仅管理员可执行");
        }
        return user;
    }
}
