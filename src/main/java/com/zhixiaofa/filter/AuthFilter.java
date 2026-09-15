package com.zhixiaofa.filter;

import com.zhixiaofa.common.Result;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.util.JsonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Arrays;
import java.util.List;

/**
 * 登录鉴权过滤器：拦截 {@code /api/*}，未登录直接返回 401 业务码。
 *
 * <p>白名单策略（放在过滤器而不是每个 Servlet 里，避免遗漏）：</p>
 * <ul>
 *   <li>认证类：登录、注册接口匿名可访问；</li>
 *   <li>公开只读内容：法条、普法文章、文书模板、知识自测支持匿名 GET，
 *       这样未登录用户也能先浏览内容再决定是否注册。</li>
 * </ul>
 * <p>管理员专属接口的二次校验由各 Servlet 调用 {@code requireAdmin()} 完成——
 * 过滤器只负责「是否登录」，不负责「是否有权限」，两层职责分开。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class AuthFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(AuthFilter.class);

    /** 完全匿名的路径前缀 */
    private static final List<String> ANONYMOUS = Arrays.asList(
            "/api/auth/login", "/api/auth/register");

    /** 允许匿名 GET 的路径前缀（公开只读内容） */
    private static final List<String> PUBLIC_GET = Arrays.asList(
            "/api/law-articles", "/api/knowledge", "/api/doc-templates", "/api/quiz", "/api/qa");

    @Override
    public void init(FilterConfig filterConfig) {
        log.info("AuthFilter 初始化完成");
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;

        String path = req.getRequestURI().substring(req.getContextPath().length());

        if (isAnonymous(req, path)) {
            chain.doFilter(request, response);
            return;
        }

        HttpSession session = req.getSession(false);
        SysUser user = session == null ? null : (SysUser) session.getAttribute("loginUser");
        if (user == null) {
            log.debug("未登录访问被拦截: {} {}", req.getMethod(), path);
            writeUnauthorized(resp);
            return;
        }
        chain.doFilter(request, response);
    }

    /** 判断是否免登录 */
    private boolean isAnonymous(HttpServletRequest req, String path) {
        for (String p : ANONYMOUS) {
            if (path.startsWith(p)) {
                return true;
            }
        }
        if ("GET".equalsIgnoreCase(req.getMethod())) {
            for (String p : PUBLIC_GET) {
                if (path.equals(p) || path.startsWith(p + "/")) {
                    return true;
                }
            }
        }
        return false;
    }

    private void writeUnauthorized(HttpServletResponse resp) throws IOException {
        resp.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        resp.setContentType("application/json;charset=UTF-8");
        resp.setCharacterEncoding("UTF-8");
        try (PrintWriter out = resp.getWriter()) {
            out.write(JsonUtil.toJson(Result.error(ResultCode.UNAUTHORIZED)));
            out.flush();
        }
    }

    @Override
    public void destroy() {
        // 无资源需要释放
    }
}
