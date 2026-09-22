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
 * 普法文章接口。映射：{@code /api/knowledge/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/knowledge/*")
public class KnowledgeServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);
        com.zhixiaofa.service.KnowledgeService service = ServiceFactory.knowledge();

        if (segs.length == 0) {
            if ("GET".equals(method)) {
                Integer status = UserServlet.nullableInt(req, "status");
                if (status == null) {
                    status = 1; // 前台默认只看已发布
                }
                return Result.success(service.articlePage(
                        RequestUtil.getString(req, "category"), RequestUtil.getString(req, "keyword"),
                        status, RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
            }
            if ("POST".equals(method)) {
                requireAdmin(req);
                return Result.success("发布成功", service.saveArticle(
                        body(req, com.zhixiaofa.model.KnowledgeArticle.class), tagList(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        String first = segs[0];
        if ("tags".equals(first) && "GET".equals(method)) {
            return Result.success(service.allTags());
        }
        if ("stats".equals(first) && "GET".equals(method)) {
            requireAdmin(req);
            Map<String, Object> map = new java.util.LinkedHashMap<>();
            map.put("category", service.articleCategoryStats());
            map.put("views", service.topArticles(8));
            return Result.success(map);
        }

        Long id = segmentAsLong(req, 0);
        if (segs.length == 1) {
            if ("GET".equals(method)) {
                return Result.success(service.articleDetail(id));
            }
            if ("DELETE".equals(method)) {
                requireAdmin(req);
                service.deleteArticle(id);
                return Result.success("删除成功", null);
            }
            if ("PUT".equals(method)) {
                requireAdmin(req);
                return Result.success("更新成功", service.updateArticle(id,
                        body(req, com.zhixiaofa.model.KnowledgeArticle.class), tagList(req)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        if ("POST".equals(method) && "like".equals(segs[1])) {
            service.likeArticle(id);
            return Result.success("点赞成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的子资源: " + segs[1]);
    }

    private List<String> tagList(HttpServletRequest req) {
        String[] arr = req.getParameterValues("tags");
        if (arr == null) {
            String single = RequestUtil.getString(req, "tags");
            return StringUtil.isEmpty(single) ? List.of() : List.of(single.split(","));
        }
        return List.of(arr);
    }
}
