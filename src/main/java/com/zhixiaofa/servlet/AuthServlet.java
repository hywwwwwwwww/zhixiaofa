package com.zhixiaofa.servlet;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.Result;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.ServiceFactory;
import com.zhixiaofa.util.RequestUtil;
import com.zhixiaofa.util.StringUtil;

import javax.servlet.annotation.WebServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

import java.util.List;
import java.util.Map;

/**
 * 认证接口：登录 / 注册 / 退出 / 当前用户 / 资料与密码维护。
 *
 * <p>映射：{@code /api/auth/*}</p>
 * <ul>
 *   <li>POST /api/auth/login     登录</li>
 *   <li>POST /api/auth/register  注册</li>
 *   <li>POST /api/auth/logout    退出</li>
 *   <li>GET  /api/auth/me        当前登录用户</li>
 *   <li>PUT  /api/auth/profile   修改资料</li>
 *   <li>PUT  /api/auth/password  修改密码</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/auth/*")
public class AuthServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String action = pathString(req);
        String method = req.getMethod();

        if ("POST".equals(method) && "login".equals(action)) {
            return login(req);
        }
        if ("POST".equals(method) && "register".equals(action)) {
            return register(req);
        }
        if ("POST".equals(method) && "logout".equals(action)) {
            return logout(req);
        }
        if ("GET".equals(method) && "me".equals(action)) {
            return me(req);
        }
        if ("PUT".equals(method) && "profile".equals(action)) {
            return updateProfile(req);
        }
        if ("PUT".equals(method) && "password".equals(action)) {
            return changePassword(req);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的认证操作: " + method + " /" + action);
    }

    private Result<?> login(HttpServletRequest req) {
        String username = paramOrBody(req, "username");
        String password = paramOrBody(req, "password");
        SysUser user = ServiceFactory.user().login(username, password);
        // 防会话固定攻击：登录成功后换一个新 session
        HttpSession old = req.getSession(false);
        if (old != null) {
            old.invalidate();
        }
        HttpSession session = req.getSession(true);
        session.setAttribute(SESSION_USER, user);
        session.setMaxInactiveInterval(60 * 60); // 1 小时
        log.info("登录成功并建立会话: {} ({})", user.getUsername(), user.getRole());
        return Result.success("登录成功", user);
    }

    private Result<?> register(HttpServletRequest req) {
        SysUser user = ServiceFactory.user().register(
                paramOrBody(req, "username"), paramOrBody(req, "password"),
                paramOrBody(req, "nickname"), paramOrBody(req, "email"),
                paramOrBody(req, "phone"), paramOrBody(req, "city"),
                paramOrBody(req, "jobTitle"));
        return Result.success("注册成功，请登录", user);
    }

    private Result<?> logout(HttpServletRequest req) {
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return Result.success("已退出登录", null);
    }

    private Result<?> me(HttpServletRequest req) {
        SysUser user = currentUser(req);
        if (user == null) {
            return Result.error(ResultCode.UNAUTHORIZED);
        }
        // 会话里存的是登录快照，这里回源一次保证资料是最新的
        return Result.success(ServiceFactory.user().getById(user.getId()));
    }

    private Result<?> updateProfile(HttpServletRequest req) {
        SysUser user = requireLogin(req);
        SysUser updated = ServiceFactory.user().updateProfile(user.getId(),
                paramOrBody(req, "nickname"), paramOrBody(req, "email"),
                paramOrBody(req, "phone"), paramOrBody(req, "city"),
                paramOrBody(req, "jobTitle"), paramOrBody(req, "avatar"));
        req.getSession().setAttribute(SESSION_USER, updated);
        return Result.success("资料已更新", updated);
    }

    private Result<?> changePassword(HttpServletRequest req) {
        SysUser user = requireLogin(req);
        ServiceFactory.user().changePassword(user.getId(),
                paramOrBody(req, "oldPassword"), paramOrBody(req, "newPassword"));
        HttpSession session = req.getSession(false);
        if (session != null) {
            session.invalidate();
        }
        return Result.success("密码已修改，请重新登录", null);
    }

    /** 参数优先取表单，其次取 JSON 请求体，兼容前端两种提交方式 */
    static String paramOrBody(HttpServletRequest req, String key) {
        String v = req.getParameter(key);
        if (StringUtil.isNotEmpty(v)) {
            return v.trim();
        }
        return null;
    }
}
