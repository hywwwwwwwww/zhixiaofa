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
 * 知识自测接口。映射：{@code /api/quiz/*}
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebServlet("/api/quiz/*")
public class QuizServlet extends BaseServlet {

    private static final long serialVersionUID = 1L;

    @Override
    protected Result<?> handle(HttpServletRequest req, HttpServletResponse resp) {
        String method = req.getMethod();
        String[] segs = pathSegments(req);
        com.zhixiaofa.service.KnowledgeService service = ServiceFactory.knowledge();

        if (segs.length == 0) {
            if ("GET".equals(method)) {
                String category = RequestUtil.getString(req, "category");
                int limit = RequestUtil.getInt(req, "limit", 10);
                return Result.success(service.quizRandom(limit));
            }
            if ("POST".equals(method)) {
                requireAdmin(req);
                return Result.success("新增成功", service.saveQuiz(body(req, com.zhixiaofa.model.QuizQuestion.class)));
            }
            throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
        }

        if ("submit".equals(segs[0]) && "POST".equals(method)) {
            Map<String, Object> raw = bodyMap(req);
            Map<Long, String> answers = new java.util.LinkedHashMap<>();
            Object a = raw.get("answers");
            if (a instanceof Map) {
                for (Map.Entry<?, ?> e : ((Map<?, ?>) a).entrySet()) {
                    try {
                        answers.put(Long.valueOf(String.valueOf(e.getKey())),
                                e.getValue() == null ? null : String.valueOf(e.getValue()));
                    } catch (NumberFormatException ignore) {
                        // 忽略非法题号
                    }
                }
            }
            return Result.success("已交卷", service.submitQuiz(answers));
        }
        if ("page".equals(segs[0]) && "GET".equals(method)) {
            requireAdmin(req);
            return Result.success(service.quizPage(RequestUtil.getString(req, "keyword"),
                    RequestUtil.getString(req, "category"),
                    RequestUtil.getPageNum(req), RequestUtil.getPageSize(req)));
        }
        if ("stats".equals(segs[0]) && "GET".equals(method)) {
            requireAdmin(req);
            return Result.success(service.articleCategoryStats());
        }

        Long id = segmentAsLong(req, 0);
        requireAdmin(req);
        if ("PUT".equals(method)) {
            return Result.success("更新成功", service.updateQuiz(id, body(req, com.zhixiaofa.model.QuizQuestion.class)));
        }
        if ("DELETE".equals(method)) {
            service.deleteQuiz(id);
            return Result.success("删除成功", null);
        }
        throw new BizException(ResultCode.METHOD_NOT_ALLOWED, "不支持的请求方法: " + method);
    }
}
