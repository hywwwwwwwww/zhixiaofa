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
 * 操作日志接口（仅管理员）。映射：{@code /api/admin/logs/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/admin/logs/*")
public class LogServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String action = pathString(req);
        requireAdmin(req);
        com.zhixiaofa.service.LogService service = ServiceFactory.log();

        if ("stats".equals(action) && "GET".equals(method)) {
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("daily", service.dailyStats(RequestUtil.getInt(req, "days", 14)));
            map.put("uri", service.uriStats(8));
            map.put("slow", service.slowApiStats(8));
            return Result.success(map);
        }
        if ("clean".equals(action) && "DELETE".equals(method)) {
            int removed = service.clean(RequestUtil.getInt(req, "days", 30));
            return Result.success("已清理 " + removed + " 条日志", removed);
        }
        if (StringUtil.isEmpty(action) && "GET".equals(method)) {
            // 列头排序：仅作为白名单查表的 key，具体校验在 SqlBuilder.orderBy
            return Result.success(service.page(RequestUtil.getString(req, "keyword"),
                    RequestUtil.getString(req, "method"),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req),
                    RequestUtil.getString(req, "sortName"), RequestUtil.getString(req, "sortOrder")));
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method + " /" + action);
    }
}
