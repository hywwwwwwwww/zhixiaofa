package com.zhixiaofa.filter;

import com.zhixiaofa.model.OperationLog;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.ServiceFactory;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.JsonUtil;
import com.zhixiaofa.util.RequestUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.Filter;
import javax.servlet.FilterConfig;
import javax.servlet.FilterChain;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import java.io.IOException;

/**
 * 操作日志过滤器：记录每次接口调用的用户、动作、IP、耗时与状态码。
 *
 * <p>两个设计考虑：</p>
 * <ol>
 *   <li><b>不阻塞业务</b>：日志对象交给 {@code LogService} 的有界队列异步落库，
 *       写日志永远不占用用户请求的响应时间；</li>
 *   <li><b>脱敏</b>：参数经 {@link RequestUtil#collectForLog} 过滤，
 *       password / token / salt 等敏感字段以 {@code ***} 记录。</li>
 * </ol>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class OperationLogFilter implements Filter {

    private static final Logger log = LoggerFactory.getLogger(OperationLogFilter.class);

    /** 不记录的路径（日志查询本身会把日志表刷满） */
    private static final String[] EXCLUDE = {"/api/admin/logs", "/api/admin/stats"};

    @Override
    public void init(FilterConfig filterConfig) {
        log.info("OperationLogFilter 初始化完成");
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        HttpServletRequest req = (HttpServletRequest) request;
        HttpServletResponse resp = (HttpServletResponse) response;
        String path = req.getRequestURI().substring(req.getContextPath().length());

        if (isExcluded(path)) {
            chain.doFilter(request, response);
            return;
        }

        long start = System.currentTimeMillis();
        int status = 200;
        try {
            chain.doFilter(request, response);
            status = resp.getStatus();
        } catch (Exception e) {
            status = 500;
            throw e;
        } finally {
            try {
                save(req, path, status, System.currentTimeMillis() - start);
            } catch (Exception e) {
                // 记录日志本身失败绝不能再抛给用户
                log.warn("操作日志记录失败: {}", e.getMessage());
            }
        }
    }

    private void save(HttpServletRequest req, String path, int status, long cost) {
        OperationLog item = new OperationLog();
        HttpSession session = req.getSession(false);
        SysUser user = session == null ? null : (SysUser) session.getAttribute("loginUser");
        if (user != null) {
            item.setUserId(user.getId());
            item.setUsername(user.getUsername());
        }
        item.setAction(describe(req.getMethod(), path));
        item.setMethod(req.getMethod());
        item.setUri(path);
        item.setIp(RequestUtil.getClientIp(req));
        item.setParams(JsonUtil.toJson(RequestUtil.collectForLog(req)));
        item.setCostMs(cost);
        item.setStatus(status);
        item.setCreatedAt(DateUtil.now());
        ServiceFactory.log().save(item);
    }

    /** 把 RESTful 路径翻译成可读的动作描述 */
    private String describe(String method, String path) {
        String name = path;
        if (path.contains("auth/login")) {
            return "用户登录";
        }
        if (path.contains("auth/register")) {
            return "用户注册";
        }
        if (path.contains("auth/logout")) {
            return "退出登录";
        }
        // 这两条单独列出来：密码被重置是安全事件，后台日志页要能一眼筛出来
        if (path.contains("auth/forgot-password")) {
            return "找回密码-发送验证码";
        }
        if (path.contains("auth/reset-password")) {
            return "找回密码-重置密码";
        }
        for (String[] pair : new String[][]{
                {"/api/users", "用户管理"}, {"/api/law-articles", "法条管理"}, {"/api/qa", "智能问答"},
                {"/api/court-cases", "案件推演"}, {"/api/contracts", "合同审查"},
                {"/api/doc-templates", "文书模板"}, {"/api/doc-records", "文书起草"},
                {"/api/knowledge", "普法文章"}, {"/api/quiz", "知识自测"},
                {"/api/favorites", "收藏"}, {"/api/admin", "后台管理"}}) {
            if (path.startsWith(pair[0])) {
                name = pair[1];
                break;
            }
        }
        String verb = "GET".equals(method) ? "查询"
                : "POST".equals(method) ? "新增"
                : "PUT".equals(method) ? "修改"
                : "DELETE".equals(method) ? "删除" : method;
        return name + "-" + verb + (StringUtil.isEmpty(path) ? "" : " " + path);
    }

    private boolean isExcluded(String path) {
        for (String e : EXCLUDE) {
            if (path.startsWith(e)) {
                return true;
            }
        }
        return false;
    }

    @Override
    public void destroy() {
        // 无资源需要释放
    }
}
