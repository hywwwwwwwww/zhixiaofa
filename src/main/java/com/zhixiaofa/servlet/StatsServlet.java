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
 * 后台数据看板接口（仅管理员）。映射：{@code /api/admin/stats/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/admin/stats/*")
public class StatsServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String action = StringUtil.defaultIfEmpty(pathString(req), "overview");
        requireAdmin(req);
        com.zhixiaofa.service.StatsService service = ServiceFactory.stats();

        switch (action) {
            case "overview":
                return Result.success(service.overview());
            case "trend":
                return Result.success(service.trend(RequestUtil.getInt(req, "days", 14)));
            case "distributions":
                return Result.success(service.distributions());
            case "rankings":
                return Result.success(service.rankings());
            case "slow-apis":
                return Result.success(service.slowApis(RequestUtil.getInt(req, "limit", 8)));
            case "pool":
                return Result.success(service.poolInfo());
            default:
                throw new BizException(ResultCode.NOT_FOUND, "未知的统计资源: " + action);
        }
    }
}
