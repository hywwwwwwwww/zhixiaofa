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
 * 合同审查接口。映射：{@code /api/contracts/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/contracts/*")
public class ContractServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);

        if (segs.length == 0) {
            if ("POST".equals(method)) {
                SysUser user = requireLogin(req);
                return Result.success("审查完成", ServiceFactory.contract().review(
                        user.getId(), RequestUtil.require(req, "fileName"),
                        RequestUtil.getString(req, "contractType"),
                        RequestUtil.getString(req, "partyA"), RequestUtil.getString(req, "partyB"),
                        RequestUtil.getString(req, "signDate"),
                        RequestUtil.require(req, "content")));
            }
            if ("GET".equals(method)) {
                requireAdmin(req);
                return Result.success(ServiceFactory.contract().page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "riskLevel"),
                        UserServlet.nullableInt(req, "status"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String first = segs[0];
        if ("mine".equals(first) && "GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(ServiceFactory.contract().myPage(user.getId(),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }
        if ("stats".equals(first) && "GET".equals(method)) {
            requireAdmin(req);
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("riskLevel", ServiceFactory.contract().riskLevelStats());
            map.put("type", ServiceFactory.contract().typeStats());
            map.put("daily", ServiceFactory.contract().dailyStats(RequestUtil.getInt(req, "days", 14)));
            return Result.success(map);
        }

        Long id = segmentAsLong(req, 0);
        if ("GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(ServiceFactory.contract().detail(id, user.getId(),
                    "ADMIN".equalsIgnoreCase(user.getRole())));
        }
        if ("DELETE".equals(method)) {
            SysUser user = requireLogin(req);
            ServiceFactory.contract().delete(id, user.getId(), "ADMIN".equalsIgnoreCase(user.getRole()));
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }
}
