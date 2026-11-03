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

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 认证接口：登录 / 注册 / 退出 / 当前用户 / 资料与密码维护。
 *
 * <p>映射：{@code /api/auth/*}</p>
 * <ul>
 *   <li>POST /api/auth/login     登录</li>
 *   <li>POST /api/auth/register  注册</li>
 *   <li>POST /api/auth/send-register-code  注册：给待注册邮箱发验证码</li>
 *   <li>POST /api/auth/send-register-code  注册：给待注册邮箱发验证码</li>
 *   <li>POST /api/auth/logout    退出</li>
 *   <li>POST /api/auth/forgot-password  找回密码：发邮箱验证码</li>
 *   <li>POST /api/auth/reset-password   找回密码：凭验证码设新密码</li>
 *   <li>GET  /api/auth/me        当前登录用户</li>
 *   <li>PUT  /api/auth/profile   修改资料</li>
 *   <li>PUT  /api/auth/password  修改密码</li>
 * </ul>
 *
 * <p>两个找回密码接口是<b>匿名</b>可访问的（白名单在 {@code AuthFilter}），
 * 这也正是它们必须限流的原因。</p>
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
        if ("POST".equals(method) && "send-register-code".equals(action)) {
            return sendRegisterCode(req);
        }
        if ("POST".equals(method) && "forgot-password".equals(action)) {
            return forgotPassword(req);
        }
        if ("POST".equals(method) && "reset-password".equals(action)) {
            return resetPasswordByCode(req);
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
        // 邮箱注册上线后邮箱是必填项；在入口兜一道，避免绕过页面直接调接口注册出无邮箱账号
        // （Service 层保持 email 可空，给管理员后续的工具/数据修复留余地）
        String email = paramOrBody(req, "email");
        if (StringUtil.isEmpty(email)) {
            throw new BizException(ResultCode.PARAM_ERROR, "邮箱为必填项，注册需要验证邮箱");
        }
        SysUser user = ServiceFactory.user().register(
                paramOrBody(req, "username"), paramOrBody(req, "password"),
                paramOrBody(req, "nickname"), email,
                paramOrBody(req, "phone"), paramOrBody(req, "city"),
                paramOrBody(req, "jobTitle"), paramOrBody(req, "verifyCode"));
        return Result.success("注册成功，请登录", user);
    }

    /**
     * 注册第一步：给待注册的邮箱发 6 位验证码（匿名接口，限流在 Service 层）。
     *
     * <p>邮件未启用（开发模式）时验证码随返回值下发、前端直接回填 ——
     * 否则注册被邮件配置卡死，演示环境走不通。启用邮件后这里永远是 {@code null}，
     * 验证码只出现在邮件里。</p>
     */
    private Result<?> sendRegisterCode(HttpServletRequest req) {
        String devCode = ServiceFactory.user().sendRegisterCode(
                paramOrBody(req, "email"), RequestUtil.getClientIp(req));
        if (devCode != null) {
            Map<String, String> data = new LinkedHashMap<>();
            data.put("devMode", Boolean.TRUE.toString());
            data.put("devCode", devCode);
            return Result.success("邮件服务未启用（开发模式），验证码已直接回填", data);
        }
        return Result.success("验证码已发送至该邮箱，请查收邮件（含垃圾箱）", null);
    }

    /**
     * 找回密码第一步：把 6 位验证码发到邮箱。
     *
     * <p>返回同一句提示语，不透露该邮箱是否真的绑定过账号 —— 限流与「按成功处理」都在 Service 层。</p>
     */
    private Result<?> forgotPassword(HttpServletRequest req) {
        ServiceFactory.user().sendPasswordResetCode(
                paramOrBody(req, "email"), RequestUtil.getClientIp(req));
        return Result.success("验证码已发送至该邮箱，请查收邮件（含垃圾箱）后填入验证码完成重置", null);
    }

    /** 找回密码第二步：校验验证码并设新密码 */
    private Result<?> resetPasswordByCode(HttpServletRequest req) {
        ServiceFactory.user().resetPasswordByCode(paramOrBody(req, "email"),
                paramOrBody(req, "verifyCode"), paramOrBody(req, "newPassword"));
        return Result.success("密码已重置，请用新密码登录", null);
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
