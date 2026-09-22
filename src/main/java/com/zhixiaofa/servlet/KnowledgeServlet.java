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
                        status, RequestUtil.getPageNum(req), RequestUtil.getPageSize(req),
                        // 列头排序：仅作为白名单查表的 key，具体校验在 SqlBuilder.orderBy
                        RequestUtil.getString(req, "sortName"), RequestUtil.getString(req, "sortOrder")));
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

    /**
     * 解析请求里的标签列表，同时兼容两种写法：
     * <ul>
     *   <li>{@code ?tags=劳动合同&tags=试用期} —— 重复参数，{@code getParameterValues} 返回数组；</li>
     *   <li>{@code ?tags=劳动合同,试用期} —— 逗号串（中英文逗号均可）。</li>
     * </ul>
     *
     * <p><b>修复说明</b>：{@code getParameterValues("tags")} 对 {@code ?tags=a,b} 返回的是
     * {@code ["a,b"]}（非 null），原先直接 {@code List.of(arr)} 会让逗号串**永不被拆分**，
     * 多个标签被当成一个存进字典（例如「试用期,加班费」）。现在统一按逗号二次拆分。</p>
     */
    private List<String> tagList(HttpServletRequest req) {
        String[] arr = req.getParameterValues("tags");
        if (arr == null) {
            return List.of();
        }
        List<String> out = new java.util.ArrayList<>();
        for (String raw : arr) {
            if (StringUtil.isEmpty(raw)) {
                continue;
            }
            for (String part : raw.split("[,，]")) {
                String t = part.trim();
                if (!t.isEmpty() && !out.contains(t)) {
                    out.add(t);
                }
            }
        }
        return out;
    }
}
