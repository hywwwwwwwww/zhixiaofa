package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.dao.ArticleTagDao;
import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.KnowledgeTagDao;
import com.zhixiaofa.dao.QuizQuestionDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.KnowledgeArticle;
import com.zhixiaofa.model.KnowledgeTag;
import com.zhixiaofa.model.QuizQuestion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 普法知识业务单元测试：覆盖文章分页/详情/标签与自测判分。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("KnowledgeService 测试")
class KnowledgeServiceImplTest {

    @Mock private KnowledgeArticleDao articleDao;
    @Mock private KnowledgeTagDao tagDao;
    @Mock private ArticleTagDao articleTagDao;
    @Mock private QuizQuestionDao quizDao;

    private KnowledgeServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new KnowledgeServiceImpl(articleDao, tagDao, articleTagDao, quizDao);
    }

    private KnowledgeArticle article() {
        KnowledgeArticle a = new KnowledgeArticle();
        a.setId(1L);
        a.setTitle("试用期到底能约定多久？");
        a.setSummary("摘要");
        a.setContent("正文");
        a.setCategory("劳动合同");
        a.setStatus(1);
        a.setViewCount(10);
        a.setLikeCount(2);
        return a;
    }

    private QuizQuestion quiz(long id, String correct) {
        QuizQuestion q = new QuizQuestion();
        q.setId(id);
        q.setQuestion("题干" + id);
        q.setOptionA("A");
        q.setOptionB("B");
        q.setOptionC("C");
        q.setOptionD("D");
        q.setCorrectOption(correct);
        q.setExplanation("解析");
        return q;
    }

    @Test
    @DisplayName("文章分页：无数据返回空页")
    void articlePageEmpty() {
        when(articleDao.countByCondition(any(), any(), any())).thenReturn(0L);
        PageResult<KnowledgeArticle> page = service.articlePage(null, null, 1, 1, 10);
        assertEquals(0, page.getTotal());
    }

    @Test
    @DisplayName("文章分页：返回数据并补齐标签")
    void articlePageWithTags() {
        when(articleDao.countByCondition(any(), any(), any())).thenReturn(1L);
        when(articleDao.findByCondition(any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(article()));
        when(articleTagDao.findTagNamesByArticleId(1L)).thenReturn(List.of("试用期", "劳动合同"));
        PageResult<KnowledgeArticle> page = service.articlePage(null, null, 1, 1, 10);
        assertEquals(2, page.getList().get(0).getTags().size());
    }

    @Test
    @DisplayName("文章详情：累计阅读量并补齐标签")
    void articleDetailIncrementsView() {
        when(articleDao.findById(1L)).thenReturn(article());
        when(articleTagDao.findTagNamesByArticleId(1L)).thenReturn(List.of("试用期"));
        KnowledgeArticle a = service.articleDetail(1L);
        assertEquals(11, a.getViewCount());
        verify(articleDao).incrementView(1L);
    }

    @Test
    @DisplayName("文章详情：不存在时报错")
    void articleDetailMissing() {
        when(articleDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.articleDetail(9L));
    }

    @Test
    @DisplayName("新增文章：必填校验 + 默认值填充 + 标签落库（含自动建标签）")
    void saveArticleCreatesTags() {
        KnowledgeArticle a = article();
        when(articleDao.insert(any(KnowledgeArticle.class))).thenReturn(1L);
        when(tagDao.findByName("试用期")).thenReturn(null);
        when(tagDao.insert(any(KnowledgeTag.class))).thenReturn(5L);
        when(articleTagDao.findTagNamesByArticleId(1L)).thenReturn(List.of("试用期"));

        KnowledgeArticle created = service.saveArticle(a, List.of("试用期"));

        assertEquals(1L, created.getId());
        assertNotNull(created.getPublishedAt());
        assertNotNull(created.getAuthor());
        verify(tagDao).insert(any(KnowledgeTag.class));
        verify(articleTagDao).insertPair(1L, 5L);
    }

    @Test
    @DisplayName("新增文章：标题或正文为空被拒绝")
    void saveArticleValidates() {
        KnowledgeArticle noTitle = article();
        noTitle.setTitle("  ");
        assertThrows(BizException.class, () -> service.saveArticle(noTitle, List.of()));

        KnowledgeArticle noContent = article();
        noContent.setContent(null);
        assertThrows(BizException.class, () -> service.saveArticle(noContent, List.of()));
    }

    @Test
    @DisplayName("更新文章：保留创建时间、阅读量与点赞数")
    void updateArticleKeepsCounters() {
        KnowledgeArticle old = article();
        old.setCreatedAt(java.time.LocalDateTime.now().minusDays(3));
        when(articleDao.findById(1L)).thenReturn(old);
        when(articleTagDao.findTagNamesByArticleId(1L)).thenReturn(List.of());

        KnowledgeArticle form = article();
        form.setViewCount(0);
        form.setLikeCount(0);
        service.updateArticle(1L, form, List.of("新标签"));

        verify(articleDao).update(argThat((KnowledgeArticle x) ->
                x.getViewCount() == 10 && x.getLikeCount() == 2 && x.getCreatedAt() != null));
    }

    @Test
    @DisplayName("删除文章：先清关联再删主体")
    void deleteArticle() {
        when(articleDao.findById(1L)).thenReturn(article());
        service.deleteArticle(1L);
        verify(articleTagDao).deleteByArticleId(1L);
        verify(articleDao).deleteById(1L);
    }

    @Test
    @DisplayName("自测判分：全对 100 分、等级优秀")
    void submitQuizAllCorrect() {
        when(quizDao.findById(1L)).thenReturn(quiz(1L, "A"));
        when(quizDao.findById(2L)).thenReturn(quiz(2L, "B"));
        Map<Long, String> answers = new LinkedHashMap<>();
        answers.put(1L, "A");
        answers.put(2L, "b");

        Map<String, Object> result = service.submitQuiz(answers);
        assertEquals(2, result.get("total"));
        assertEquals(2, result.get("rightCount"));
        assertEquals(100, result.get("score"));
        assertEquals("优秀", result.get("level"));
    }

    @Test
    @DisplayName("自测判分：答错与空答案都计为错，并返回逐题解析")
    void submitQuizPartial() {
        when(quizDao.findById(1L)).thenReturn(quiz(1L, "A"));
        when(quizDao.findById(2L)).thenReturn(quiz(2L, "B"));
        when(quizDao.findById(3L)).thenReturn(quiz(3L, "C"));
        when(quizDao.findById(4L)).thenReturn(quiz(4L, "D"));
        Map<Long, String> answers = new LinkedHashMap<>();
        answers.put(1L, "A");
        answers.put(2L, "A");
        answers.put(3L, null);
        answers.put(4L, "D");

        Map<String, Object> result = service.submitQuiz(answers);
        assertEquals(4, result.get("total"));
        assertEquals(2, result.get("rightCount"));
        assertEquals(50, result.get("score"));
        assertEquals("需加强", result.get("level"));
        assertEquals(4, ((List<?>) result.get("details")).size());
    }

    @Test
    @DisplayName("自测判分：空答卷被拒绝；题号不存在时忽略该题")
    void submitQuizEdgeCases() {
        assertThrows(BizException.class, () -> service.submitQuiz(null));
        assertThrows(BizException.class, () -> service.submitQuiz(new LinkedHashMap<>()));

        when(quizDao.findById(99L)).thenReturn(null);
        Map<String, Object> result = service.submitQuiz(Map.of(99L, "A"));
        assertEquals(0, result.get("total"));
        assertEquals(0, result.get("score"));
    }

    @Test
    @DisplayName("随机抽题：limit 越界时回落到默认 10 题")
    void quizRandomClampsLimit() {
        when(quizDao.findRandom(anyInt())).thenReturn(List.of());
        service.quizRandom(0);
        verify(quizDao).findRandom(10);
        service.quizRandom(999);
        verify(quizDao, times(2)).findRandom(10);
    }

    @Test
    @DisplayName("题库增删改：必填校验与存在性校验")
    void quizCrudValidation() {
        QuizQuestion noQuestion = quiz(1L, "A");
        noQuestion.setQuestion("");
        assertThrows(BizException.class, () -> service.saveQuiz(noQuestion));

        QuizQuestion badOption = quiz(1L, "X");
        assertThrows(BizException.class, () -> service.saveQuiz(badOption));

        QuizQuestion noOptionC = quiz(1L, "A");
        noOptionC.setOptionC("");
        assertThrows(BizException.class, () -> service.saveQuiz(noOptionC));

        assertThrows(BizException.class, () -> service.deleteQuiz(9L));
    }

    @Test
    @DisplayName("标签列表：透传 DAO 结果")
    void allTags() {
        KnowledgeTag t = new KnowledgeTag();
        t.setName("试用期");
        when(tagDao.findAll()).thenReturn(List.of(t));
        assertEquals(List.of("试用期"), service.allTags());
    }

    @Test
    @DisplayName("题库分页：无数据处理")
    void quizPageEmpty() {
        when(quizDao.countByCondition(any(), any())).thenReturn(0L);
        assertEquals(0, service.quizPage(null, null, 1, 10).getTotal());
    }

    @Test
    @DisplayName("分类取题：分类为空时退化为随机抽题")
    void quizByCategoryFallback() {
        service.quizByCategory(null);
        verify(quizDao).findRandom(10);
    }
}
