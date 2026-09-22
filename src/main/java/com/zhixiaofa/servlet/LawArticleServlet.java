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
 * 法条接口。映射：{@code /api/law-articles/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/law-articles/*")
public class LawArticleServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);

        if (segs.length == 0) {
            if ("GET".equals(method)) {
                return Result.success(ServiceFactory.lawArticle().page(
                        RequestUtil.getString(req, "keyword"), RequestUtil.getString(req, "category"),
                        RequestUtil.getString(req, "lawName"),
                        RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            if ("POST".equals(method)) {
                requireAdmin(req);
                com.zhixiaofa.model.LawArticle body =
                        body(req, com.zhixiaofa.model.LawArticle.class);
                if (body == null) {
                    throw new BizException(ResultCode.PARAM_ERROR, "请求体不能为空");
                }
                return Result.success("新增成功", ServiceFactory.lawArticle().create(body));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String first = segs[0];
        if ("categories".equals(first)) {
            return Result.success(ServiceFactory.lawArticle().listCategories());
        }
        // 「法律管理」页：列出库中全部法规名称，供选择法律
        if ("law-names".equals(first) && "GET".equals(method)) {
            return Result.success(ServiceFactory.lawArticle().listLawNames());
        }
        // 重排「法律内序号」：每部法律从 1 开始重新编号
        if ("recompute-seq".equals(first) && "POST".equals(method)) {
            requireAdmin(req);
            int count = ServiceFactory.lawArticle().recomputeSeq();
            return Result.success("已重排 " + count + " 条法条的序号", count);
        }
        if ("stats".equals(first) && "GET".equals(method)) {
            requireAdmin(req);
            return Result.success(ServiceFactory.lawArticle().categoryStats());
        }
        // 国家法律法规数据库同步：POST /sync 异步触发，GET /sync/status 查状态
        if ("sync".equals(first)) {
            requireAdmin(req);
            if ("status".equals(segment(req, 1))) {
                return Result.success(com.zhixiaofa.service.LawSyncService.getInstance().status());
            }
            if ("POST".equals(method)) {
                return Result.success(com.zhixiaofa.service.LawSyncService.getInstance().triggerAsync());
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        Long id = segmentAsLong(req, 0);
        if ("GET".equals(method)) {
            return Result.success(ServiceFactory.lawArticle().getById(id));
        }
        requireAdmin(req);
        if ("PUT".equals(method)) {
            com.zhixiaofa.model.LawArticle body = body(req, com.zhixiaofa.model.LawArticle.class);
            if (body == null) {
                throw new BizException(ResultCode.PARAM_ERROR, "请求体不能为空");
            }
            return Result.success("更新成功", ServiceFactory.lawArticle().update(id, body));
        }
        if ("DELETE".equals(method)) {
            ServiceFactory.lawArticle().delete(id);
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }
}
