package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.QaReferenceDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.LawArticle;
import com.zhixiaofa.model.QaRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 问答业务补充测试：覆盖分页、详情、点赞、补答与统计。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("QaService 补充测试")
class QaServiceImplExtraTest {

    @Mock private QaRecordDao qaDao;
    @Mock private QaReferenceDao refDao;
    @Mock private LawArticleDao lawDao;
    @Mock private FavoriteDao favoriteDao;

    private QaServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new QaServiceImpl(qaDao, refDao, lawDao, favoriteDao);
    }

    private QaRecord record(long id, long userId) {
        QaRecord r = new QaRecord();
        r.setId(id);
        r.setUserId(userId);
        r.setQuestion("老板拖欠工资怎么办");
        r.setAnswer("可以仲裁");
        r.setCategory("工资报酬");
        r.setStatus(1);
        r.setLikeCount(0);
        r.setCreatedAt(LocalDateTime.now().minusHours(2));
        return r;
    }

    @Test
    @DisplayName("我的问答：无数据返回空页，不查列表")
    void myPageEmpty() {
        when(qaDao.countByUserId(1L)).thenReturn(0L);
        assertEquals(0, service.myPage(1L, 1, 10).getTotal());
        verify(qaDao, never()).findByUserId(anyLong(), anyInt(), anyInt());
    }

    @Test
    @DisplayName("我的问答：有数据时补齐法条引用与友好时间")
    void myPageWithData() {
        when(qaDao.countByUserId(1L)).thenReturn(1L);
        when(qaDao.findByUserId(1L, 0, 10)).thenReturn(List.of(record(1L, 1L)));
        when(refDao.findLawsByQaId(1L)).thenReturn(List.of());
        QaRecord got = service.myPage(1L, 1, 10).getList().get(0);
        assertNotNull(got.getCreatedAtText());
    }

    @Test
    @DisplayName("后台分页：无数据与有数据两条路径")
    void pageBranches() {
        when(qaDao.countByCondition(any(), any(), any())).thenReturn(0L);
        assertEquals(0, service.page(null, null, null, 1, 10).getTotal());

        when(qaDao.countByCondition(any(), any(), any())).thenReturn(2L);
        when(qaDao.findByCondition(any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(record(1L, 1L)));
        assertEquals(2, service.page(null, null, null, 1, 10).getTotal());
    }

    @Test
    @DisplayName("详情：不存在报错；存在时补齐法条与收藏状态")
    void detailBranches() {
        when(qaDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.detail(9L, 1L));

        when(qaDao.findById(1L)).thenReturn(record(1L, 1L));
        when(refDao.findLawsByQaId(1L)).thenReturn(List.of(new LawArticle()));
        when(favoriteDao.exists(1L, "QA", 1L)).thenReturn(true);
        QaRecord d = service.detail(1L, 1L);
        assertEquals(1, d.getReferences().size());
        assertTrue(d.getFavorited());
    }

    @Test
    @DisplayName("详情：未登录时不查收藏状态")
    void detailAnonymous() {
        when(qaDao.findById(1L)).thenReturn(record(1L, 1L));
        when(refDao.findLawsByQaId(1L)).thenReturn(List.of());
        assertNull(service.detail(1L, null).getFavorited());
        verify(favoriteDao, never()).exists(anyLong(), anyString(), anyLong());
    }

    @Test
    @DisplayName("点赞：记录存在时自增")
    void likeOk() {
        when(qaDao.findById(1L)).thenReturn(record(1L, 1L));
        service.like(1L, 1L);
        verify(qaDao).incrementLike(1L);
    }

    @Test
    @DisplayName("后台补答：记录存在时更新并回查")
    void answerOk() {
        when(qaDao.findById(1L)).thenReturn(record(1L, 1L));
        service.answer(1L, "  补充的回答  ");
        verify(qaDao).updateAnswer(1L, "补充的回答");
    }

    @Test
    @DisplayName("后台补答：记录不存在报错")
    void answerMissingRecord() {
        when(qaDao.findById(8L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.answer(8L, "回答"));
    }

    @Test
    @DisplayName("统计方法：透传 DAO 结果")
    void statsDelegation() {
        when(qaDao.countByDay(14)).thenReturn(List.of());
        when(qaDao.countGroupByCategory()).thenReturn(List.of());
        when(qaDao.topQuestions(8)).thenReturn(List.of());
        assertNotNull(service.dailyStats(14));
        assertNotNull(service.categoryStats());
        assertNotNull(service.hotQuestions(8));
    }
}
