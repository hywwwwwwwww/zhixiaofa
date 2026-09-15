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
 * 文书模板接口。映射：{@code /api/doc-templates/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/doc-templates/*")
public class DocTemplateServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);
        com.zhixiaofa.service.DocService service = ServiceFactory.doc();

        if (segs.length == 0) {
            if ("GET".equals(method)) {
                // 管理员带分页参数时返回分页结果，否则返回前台可用模板
                if (StringUtil.isNotEmpty(RequestUtil.getString(req, "page"))) {
                    requireAdmin(req);
                    return Result.success(service.templatePage(
                            RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "category"),
                            RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
                }
                return Result.success(service.listTemplates());
            }
            if ("POST".equals(method)) {
                requireAdmin(req);
                com.zhixiaofa.model.DocTemplate body =
                        body(req, com.zhixiaofa.model.DocTemplate.class);
                if (body == null) {
                    throw new BizException(ResultCode.PARAM_ERROR, "请求体不能为空");
                }
                return Result.success("新增成功", service.saveTemplate(body));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        if ("page".equals(segs[0]) && "GET".equals(method)) {
            requireAdmin(req);
            return Result.success(service.templatePage(
                    RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "category"),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }
        if ("stats".equals(segs[0]) && "GET".equals(method)) {
            requireAdmin(req);
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("category", service.templateCategoryStats());
            map.put("usage", service.templateUsageStats(8));
            return Result.success(map);
        }

        Long id = segmentAsLong(req, 0);
        if ("GET".equals(method)) {
            return Result.success(service.getTemplate(id));
        }
        requireAdmin(req);
        if ("PUT".equals(method)) {
            com.zhixiaofa.model.DocTemplate body =
                    body(req, com.zhixiaofa.model.DocTemplate.class);
            if (body == null) {
                throw new BizException(ResultCode.PARAM_ERROR, "请求体不能为空");
            }
            return Result.success("更新成功", service.updateTemplate(id, body));
        }
        if ("DELETE".equals(method)) {
            service.deleteTemplate(id);
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }
}
