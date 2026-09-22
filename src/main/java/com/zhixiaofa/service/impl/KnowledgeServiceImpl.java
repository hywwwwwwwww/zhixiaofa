package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.ArticleTagDao;
import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.KnowledgeTagDao;
import com.zhixiaofa.dao.QuizQuestionDao;
import com.zhixiaofa.dao.impl.ArticleTagDaoImpl;
import com.zhixiaofa.dao.impl.KnowledgeArticleDaoImpl;
import com.zhixiaofa.dao.impl.KnowledgeTagDaoImpl;
import com.zhixiaofa.dao.impl.QuizQuestionDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.KnowledgeArticle;
import com.zhixiaofa.model.KnowledgeTag;
import com.zhixiaofa.model.QuizQuestion;
import com.zhixiaofa.service.KnowledgeService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 普法知识业务实现。
 *
 * <p>标签采用「字典表 + 关联表」的多对多建模（{@code knowledge_tag} / {@code article_tag}），
 * 而不是把标签存成「a,b,c」字符串——后者违反第一范式，也无法按标签建索引。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class KnowledgeServiceImpl implements KnowledgeService {

    private static final Logger log = LoggerFactory.getLogger(KnowledgeServiceImpl.class);

    private final KnowledgeArticleDao articleDao;
    private final KnowledgeTagDao tagDao;
    private final ArticleTagDao articleTagDao;
    private final QuizQuestionDao quizDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public KnowledgeServiceImpl() {
        this(new KnowledgeArticleDaoImpl(), new KnowledgeTagDaoImpl(), new ArticleTagDaoImpl(), new QuizQuestionDaoImpl());
    }

    /** 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩 */
    public KnowledgeServiceImpl(KnowledgeArticleDao articleDao, KnowledgeTagDao tagDao, ArticleTagDao articleTagDao, QuizQuestionDao quizDao) {
        this.articleDao = articleDao;
        this.tagDao = tagDao;
        this.articleTagDao = articleTagDao;
        this.quizDao = quizDao;
    }

    @Override
    public PageResult<KnowledgeArticle> articlePage(String category, String keyword, Integer status,
                                                    int pageNum, int pageSize) {
        return articlePage(category, keyword, status, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<KnowledgeArticle> articlePage(String category, String keyword, Integer status,
                                                    int pageNum, int pageSize,
                                                    String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = articleDao.countByCondition(keyword, category, status);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        List<KnowledgeArticle> list = articleDao.findByCondition(keyword, category, status,
                (pageNum - 1) * pageSize, pageSize, sortName, sortOrder);
        for (KnowledgeArticle a : list) {
            a.setTags(articleTagDao.findTagNamesByArticleId(a.getId()));
        }
        return PageResult.of(list, total, pageNum, pageSize);
    }

    @Override
    public KnowledgeArticle articleDetail(Long id) {
        KnowledgeArticle a = articleDao.findById(id);
        if (a == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文章不存在");
        }
        articleDao.incrementView(id);
        a.setViewCount(a.getViewCount() == null ? 1 : a.getViewCount() + 1);
        a.setTags(articleTagDao.findTagNamesByArticleId(id));
        return a;
    }

    @Override
    public void likeArticle(Long id) {
        if (articleDao.findById(id) == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文章不存在");
        }
        articleDao.incrementLike(id);
    }

    @Override
    public KnowledgeArticle saveArticle(KnowledgeArticle article, List<String> tags) {
        validateArticle(article);
        LocalDateTime now = DateUtil.now();
        article.setCreatedAt(now);
        if (article.getStatus() == null) {
            article.setStatus(1);
        }
        if (article.getStatus() == 1 && article.getPublishedAt() == null) {
            article.setPublishedAt(now);
        }
        article.setViewCount(0);
        article.setLikeCount(0);
        if (StringUtil.isEmpty(article.getAuthor())) {
            article.setAuthor("职小法编辑部");
        }
        Long id = articleDao.insert(article);
        article.setId(id);
        saveTags(id, tags);
        article.setTags(articleTagDao.findTagNamesByArticleId(id));
        log.info("新增普法文章: id={}, title={}", id, article.getTitle());
        return article;
    }

    @Override
    public KnowledgeArticle updateArticle(Long id, KnowledgeArticle article, List<String> tags) {
        KnowledgeArticle old = articleDao.findById(id);
        if (old == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文章不存在");
        }
        validateArticle(article);
        article.setId(id);
        article.setCreatedAt(old.getCreatedAt());
        article.setViewCount(old.getViewCount());
        article.setLikeCount(old.getLikeCount());
        if (article.getStatus() == 1 && old.getPublishedAt() == null) {
            article.setPublishedAt(DateUtil.now());
        } else {
            article.setPublishedAt(old.getPublishedAt());
        }
        articleDao.update(article);
        if (tags != null) {
            articleTagDao.deleteByArticleId(id);
            saveTags(id, tags);
        }
        article.setTags(articleTagDao.findTagNamesByArticleId(id));
        return article;
    }

    @Override
    public void deleteArticle(Long id) {
        if (articleDao.findById(id) == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文章不存在");
        }
        articleTagDao.deleteByArticleId(id);
        articleDao.deleteById(id);
    }

    @Override
    public List<Map<String, Object>> articleCategoryStats() {
        return articleDao.countGroupByCategory();
    }

    @Override
    public List<Map<String, Object>> topArticles(int limit) {
        return articleDao.topByViews(limit);
    }

    @Override
    public List<String> allTags() {
        List<String> names = new ArrayList<>();
        for (KnowledgeTag t : tagDao.findAll()) {
            names.add(t.getName());
        }
        return names;
    }

    @Override
    public List<QuizQuestion> quizByCategory(String category) {
        return StringUtil.isEmpty(category) ? quizDao.findRandom(10) : quizDao.findByCategory(category);
    }

    @Override
    public List<QuizQuestion> quizRandom(int limit) {
        if (limit < 1 || limit > 30) {
            limit = 10;
        }
        return quizDao.findRandom(limit);
    }

    @Override
    public Map<String, Object> submitQuiz(Map<Long, String> answers) {
        if (answers == null || answers.isEmpty()) {
            throw new BizException(ResultCode.PARAM_ERROR, "请至少作答一题");
        }
        int right = 0;
        List<Map<String, Object>> details = new ArrayList<>();
        for (Map.Entry<Long, String> e : answers.entrySet()) {
            QuizQuestion q = quizDao.findById(e.getKey());
            if (q == null) {
                continue;
            }
            boolean correct = q.getCorrectOption() != null
                    && q.getCorrectOption().equalsIgnoreCase(StringUtil.trim(e.getValue()));
            if (correct) {
                right++;
            }
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("questionId", q.getId());
            row.put("question", q.getQuestion());
            row.put("yourAnswer", e.getValue());
            row.put("correctOption", q.getCorrectOption());
            row.put("correct", correct);
            row.put("explanation", q.getExplanation());
            details.add(row);
        }
        int total = details.size();
        int score = total == 0 ? 0 : (int) Math.round(right * 100.0 / total);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("total", total);
        result.put("rightCount", right);
        result.put("wrongCount", total - right);
        result.put("score", score);
        result.put("level", score >= 90 ? "优秀" : score >= 70 ? "良好" : score >= 60 ? "及格" : "需加强");
        result.put("details", details);
        return result;
    }

    @Override
    public PageResult<QuizQuestion> quizPage(String keyword, String category, int pageNum, int pageSize) {
        return quizPage(keyword, category, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<QuizQuestion> quizPage(String keyword, String category, int pageNum, int pageSize,
                                             String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = quizDao.countByCondition(keyword, category);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(quizDao.findByCondition(keyword, category, (pageNum - 1) * pageSize, pageSize,
                sortName, sortOrder), total, pageNum, pageSize);
    }

    @Override
    public QuizQuestion saveQuiz(QuizQuestion q) {
        validateQuiz(q);
        q.setCreatedAt(DateUtil.now());
        Long id = quizDao.insert(q);
        q.setId(id);
        return q;
    }

    @Override
    public QuizQuestion updateQuiz(Long id, QuizQuestion q) {
        QuizQuestion old = quizDao.findById(id);
        if (old == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "题目不存在");
        }
        validateQuiz(q);
        q.setId(id);
        q.setCreatedAt(old.getCreatedAt());
        quizDao.update(q);
        return q;
    }

    @Override
    public void deleteQuiz(Long id) {
        if (quizDao.findById(id) == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "题目不存在");
        }
        quizDao.deleteById(id);
    }

    // ------------------------------------------------------------------ 私有方法

    /** 写入文章标签：标签不存在则先建字典 */
    private void saveTags(Long articleId, List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return;
        }
        for (String name : tags) {
            if (StringUtil.isEmpty(name)) {
                continue;
            }
            String n = name.trim();
            KnowledgeTag tag = tagDao.findByName(n);
            if (tag == null) {
                KnowledgeTag created = new KnowledgeTag();
                created.setName(n);
                created.setCreatedAt(DateUtil.now());
                Long tid = tagDao.insert(created);
                tag = created;
                tag.setId(tid);
            }
            articleTagDao.insertPair(articleId, tag.getId());
        }
    }

    private void validateArticle(KnowledgeArticle a) {
        if (StringUtil.isEmpty(a.getTitle())) {
            throw new BizException(ResultCode.PARAM_ERROR, "文章标题不能为空");
        }
        if (StringUtil.isEmpty(a.getContent())) {
            throw new BizException(ResultCode.PARAM_ERROR, "文章正文不能为空");
        }
        if (StringUtil.isEmpty(a.getCategory())) {
            a.setCategory("其他");
        }
    }

    private void validateQuiz(QuizQuestion q) {
        if (StringUtil.isEmpty(q.getQuestion())) {
            throw new BizException(ResultCode.PARAM_ERROR, "题干不能为空");
        }
        if (StringUtil.isEmpty(q.getOptionA()) || StringUtil.isEmpty(q.getOptionB())
                || StringUtil.isEmpty(q.getOptionC()) || StringUtil.isEmpty(q.getOptionD())) {
            throw new BizException(ResultCode.PARAM_ERROR, "四个选项都不能为空");
        }
        String correct = StringUtil.trim(q.getCorrectOption());
        if (correct == null || !"ABCD".contains(correct.toUpperCase())) {
            throw new BizException(ResultCode.PARAM_ERROR, "正确答案必须为 A/B/C/D 之一");
        }
        q.setCorrectOption(correct.toUpperCase());
        if (q.getDifficulty() == null || q.getDifficulty() < 1 || q.getDifficulty() > 3) {
            q.setDifficulty(1);
        }
    }

    int clamp(int size) {
        return size < 1 ? 10 : Math.min(size, 100);
    }
}
