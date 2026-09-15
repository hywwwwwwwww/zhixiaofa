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
 * AI 小法庭接口。映射：{@code /api/court-cases/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/court-cases/*")
public class CourtCaseServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);

        if (segs.length == 0) {
            if ("POST".equals(method)) {
                SysUser user = requireLogin(req);
                return Result.success("推演完成", ServiceFactory.courtCase().evaluate(
                        user.getId(), RequestUtil.getString(req, "title"),
                        RequestUtil.require(req, "description"),
                        RequestUtil.getString(req, "caseType")));
            }
            if ("GET".equals(method)) {
                requireAdmin(req);
                return Result.success(ServiceFactory.courtCase().page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "caseType"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String first = segs[0];
        if ("mine".equals(first) && "GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(ServiceFactory.courtCase().myPage(user.getId(),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }
        if ("stats".equals(first) && "GET".equals(method)) {
            requireAdmin(req);
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("type", ServiceFactory.courtCase().typeStats());
            map.put("probability", ServiceFactory.courtCase().probabilityStats());
            map.put("daily", ServiceFactory.courtCase().dailyStats(
                    RequestUtil.getInt(req, "days", 14)));
            return Result.success(map);
        }

        Long id = segmentAsLong(req, 0);
        if ("GET".equals(method)) {
            return Result.success(ServiceFactory.courtCase().getById(id));
        }
        if ("DELETE".equals(method)) {
            SysUser user = requireLogin(req);
            ServiceFactory.courtCase().delete(id, user.getId(), "ADMIN".equalsIgnoreCase(user.getRole()));
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }
}
