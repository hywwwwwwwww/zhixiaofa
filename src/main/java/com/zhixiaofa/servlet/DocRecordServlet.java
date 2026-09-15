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
 * 用户文书接口。映射：{@code /api/doc-records/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/doc-records/*")
public class DocRecordServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);
        com.zhixiaofa.service.DocService service = ServiceFactory.doc();

        if (segs.length == 0) {
            if ("POST".equals(method)) {
                SysUser user = requireLogin(req);
                Map<String, Object> raw = bodyMap(req);
                Long templateId = toLong(raw.get("templateId"));
                if (templateId == null) {
                    templateId = RequestUtil.getLong(req, "templateId");
                }
                if (templateId == null) {
                    throw new BizException(ResultCode.PARAM_ERROR, "templateId 不能为空");
                }
                Map<String, String> params = new java.util.LinkedHashMap<>();
                Object p = raw.get("params");
                if (p instanceof Map) {
                    for (Map.Entry<?, ?> e : ((Map<?, ?>) p).entrySet()) {
                        params.put(String.valueOf(e.getKey()),
                                e.getValue() == null ? null : String.valueOf(e.getValue()));
                    }
                }
                return Result.success("文书已生成", service.generate(user.getId(), templateId, params));
            }
            if ("GET".equals(method)) {
                requireAdmin(req);
                return Result.success(service.page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getLong(req, "userId"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        if ("mine".equals(segs[0]) && "GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(service.myPage(user.getId(),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }

        Long id = segmentAsLong(req, 0);
        if ("GET".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success(service.detail(id, user.getId(), "ADMIN".equalsIgnoreCase(user.getRole())));
        }
        if ("PUT".equals(method)) {
            SysUser user = requireLogin(req);
            return Result.success("已保存", service.updateContent(id, user.getId(),
                    RequestUtil.getString(req, "title"), RequestUtil.getString(req, "content")));
        }
        if ("DELETE".equals(method)) {
            SysUser user = requireLogin(req);
            service.delete(id, user.getId(), "ADMIN".equalsIgnoreCase(user.getRole()));
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }

    private Long toLong(Object v) {
        if (v == null) {
            return null;
        }
        try {
            return Long.valueOf(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "templateId 必须是数字");
        }
    }
}
