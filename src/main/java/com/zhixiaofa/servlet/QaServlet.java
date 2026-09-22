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
 * 智能问答接口。映射：{@code /api/qa/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/qa/*")
public class QaServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);

        if (segs.length == 0) {
            if ("POST".equals(method)) {
                SysUser user = requireLogin(req);
                return Result.success("已回答",
                        ServiceFactory.qa().ask(user.getId(),
                                RequestUtil.require(req, "question"),
                                RequestUtil.getString(req, "category")));
            }
            if ("GET".equals(method)) {
                requireAdmin(req);
                return Result.success(ServiceFactory.qa().page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "category"),
                        UserServlet.nullableInt(req, "status"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req),
                        // 列头排序：仅作为白名单查表的 key，具体校验在 SqlBuilder.orderBy
                        RequestUtil.getString(req, "sortName"), RequestUtil.getString(req, "sortOrder")));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String first = segs[0];
        if ("mine".equals(first) && "GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(ServiceFactory.qa().myPage(user.getId(),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }
        if ("stats".equals(first) && "GET".equals(method)) {
            requireAdmin(req);
            int days = RequestUtil.getInt(req, "days", 14);
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("daily", ServiceFactory.qa().dailyStats(days));
            map.put("category", ServiceFactory.qa().categoryStats());
            map.put("hot", ServiceFactory.qa().hotQuestions(8));
            return Result.success(map);
        }

        Long id = segmentAsLong(req, 0);
        if (segs.length == 1) {
            if ("GET".equals(method)) {
                SysUser user = currentUser(req);
                return Result.success(ServiceFactory.qa().detail(id, user == null ? null : user.getId()));
            }
            if ("DELETE".equals(method)) {
                SysUser user = requireLogin(req);
                ServiceFactory.qa().delete(id, user.getId(), "ADMIN".equalsIgnoreCase(user.getRole()));
                return Result.success("删除成功", null);
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String sub = segs[1];
        if ("POST".equals(method) && "like".equals(sub)) {
            SysUser user = requireLogin(req);
            ServiceFactory.qa().like(id, user.getId());
            return Result.success("点赞成功", null);
        }
        if ("PUT".equals(method) && "answer".equals(sub)) {
            requireAdmin(req);
            return Result.success("回答已更新", ServiceFactory.qa().answer(id, RequestUtil.require(req, "answer")));
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的子资源: " + sub);
    }
}
