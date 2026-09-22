package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.KnowledgeArticle;
import com.zhixiaofa.model.QuizQuestion;

import java.util.List;
import java.util.Map;

/**
 * 普法知识广场业务接口：文章 + 标签 + 知识自测。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface KnowledgeService {

    PageResult<KnowledgeArticle> articlePage(String category, String keyword, Integer status,
                                             int pageNum, int pageSize);

    /**
     * 带排序的文章分页（供前端点击列头切换升降序）。
     *
     * @param sortName  前端列名（实现层走白名单，非法值回退默认排序）
     * @param sortOrder 排序方向（desc / asc）
     */
    PageResult<KnowledgeArticle> articlePage(String category, String keyword, Integer status,
                                             int pageNum, int pageSize, String sortName, String sortOrder);

    /** 文章详情（自动累计阅读量，并补齐标签） */
    KnowledgeArticle articleDetail(Long id);

    void likeArticle(Long id);

    KnowledgeArticle saveArticle(KnowledgeArticle article, List<String> tags);

    KnowledgeArticle updateArticle(Long id, KnowledgeArticle article, List<String> tags);

    void deleteArticle(Long id);

    List<Map<String, Object>> articleCategoryStats();

    List<Map<String, Object>> topArticles(int limit);

    List<String> allTags();

    /** 按分类取题 */
    List<QuizQuestion> quizByCategory(String category);

    /** 随机抽题（不带答案，交卷后再判分） */
    List<QuizQuestion> quizRandom(int limit);

    /** 交卷判分 */
    Map<String, Object> submitQuiz(Map<Long, String> answers);

    PageResult<QuizQuestion> quizPage(String keyword, String category, int pageNum, int pageSize);

    /**
     * 带排序的题库分页（供前端点击列头切换升降序）。
     *
     * @param sortName  前端列名（实现层走白名单，非法值回退默认排序）
     * @param sortOrder 排序方向（desc / asc）
     */
    PageResult<QuizQuestion> quizPage(String keyword, String category, int pageNum, int pageSize,
                                       String sortName, String sortOrder);

    QuizQuestion saveQuiz(QuizQuestion question);

    QuizQuestion updateQuiz(Long id, QuizQuestion question);

    void deleteQuiz(Long id);
}
