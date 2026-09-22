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
 * 用户管理接口（管理员）。映射：{@code /api/users/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/users/*")
public class UserServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);

        // 集合级操作
        if (segs.length == 0) {
            if ("GET".equals(method)) {
                return Result.success(ServiceFactory.user().page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "role"),
                        nullableInt(req, "status"), RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "集合资源仅支持 GET");
        }

        Long id = segmentAsLong(req, 0);
        // 单资源
        if (segs.length == 1) {
            if ("GET".equals(method)) {
                requireAdmin(req);
                return Result.success(ServiceFactory.user().getById(id));
            }
            if ("PUT".equals(method)) {
                // 管理员修改指定用户的资料
                requireAdmin(req);
                return Result.success("资料已更新", ServiceFactory.user().updateProfile(id,
                        RequestUtil.getString(req, "nickname"), RequestUtil.getString(req, "email"),
                        RequestUtil.getString(req, "phone"), RequestUtil.getString(req, "city"),
                        RequestUtil.getString(req, "jobTitle"), RequestUtil.getString(req, "avatar")));
            }
            if ("DELETE".equals(method)) {
                SysUser admin = requireAdmin(req);
                ServiceFactory.user().delete(id, admin.getId());
                return Result.success("删除成功", null);
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "单资源仅支持 GET / PUT / DELETE");
        }

        // 子资源
        String sub = segs[1];
        SysUser admin = requireAdmin(req);
        if ("PUT".equals(method) && "status".equals(sub)) {
            ServiceFactory.user().updateStatus(id, nullableInt(req, "status"), admin.getId());
            return Result.success("状态已更新", null);
        }
        if ("PUT".equals(method) && "role".equals(sub)) {
            ServiceFactory.user().updateRole(id, RequestUtil.getString(req, "role"), admin.getId());
            return Result.success("角色已更新", null);
        }
        if ("PUT".equals(method) && "password".equals(sub)) {
            ServiceFactory.user().resetPassword(id, RequestUtil.require(req, "newPassword"));
            return Result.success("密码已重置", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的子资源: " + sub);
    }

    /** 可空整型参数 */
    static Integer nullableInt(HttpServletRequest req, String name) {
        String v = RequestUtil.getString(req, name);
        if (StringUtil.isEmpty(v)) {
            return null;
        }
        try {
            return Integer.valueOf(v);
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "参数 " + name + " 必须是整数");
        }
    }
}
