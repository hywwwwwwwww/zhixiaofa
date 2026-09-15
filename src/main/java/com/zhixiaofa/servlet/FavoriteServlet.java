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
 * 收藏接口。映射：{@code /api/favorites/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/favorites/*")
public class FavoriteServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);
        SysUser user = requireLogin(req);
        com.zhixiaofa.service.FavoriteService service = ServiceFactory.favorite();

        if (segs.length == 0) {
            if ("GET".equals(method)) {
                return Result.success(service.page(user.getId(),
                        StringUtil.defaultIfEmpty(RequestUtil.getString(req, "targetType"), "QA"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            if ("POST".equals(method)) {
                boolean added = service.add(user.getId(),
                        RequestUtil.require(req, "targetType"),
                        RequestUtil.requireLong(req, "targetId"));
                return Result.success(added ? "收藏成功" : "已收藏", added);
            }
            if ("DELETE".equals(method)) {
                boolean removed = service.remove(user.getId(),
                        RequestUtil.require(req, "targetType"),
                        RequestUtil.requireLong(req, "targetId"));
                return Result.success("已取消收藏", removed);
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        if ("toggle".equals(segs[0]) && "POST".equals(method)) {
            boolean nowFavorited = service.toggle(user.getId(),
                    RequestUtil.require(req, "targetType"), RequestUtil.requireLong(req, "targetId"));
            return Result.success(nowFavorited ? "收藏成功" : "已取消收藏", nowFavorited);
        }
        if ("exists".equals(segs[0]) && "GET".equals(method)) {
            return Result.success(service.exists(user.getId(),
                    RequestUtil.require(req, "targetType"), RequestUtil.requireLong(req, "targetId")));
        }
        if ("stats".equals(segs[0]) && "GET".equals(method)) {
            return Result.success(service.typeStats(user.getId()));
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的子资源: " + segs[0]);
    }
}
