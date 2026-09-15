package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.Favorite;
import com.zhixiaofa.model.KnowledgeArticle;
import com.zhixiaofa.model.QaRecord;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 收藏业务单元测试：覆盖类型归一化、目标存在性校验、切换与标题回填。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("FavoriteService 测试")
class FavoriteServiceImplTest {

    @Mock private FavoriteDao favoriteDao;
    @Mock private QaRecordDao qaDao;
    @Mock private KnowledgeArticleDao articleDao;
    @Mock private LawArticleDao lawDao;
    @Mock private DocRecordDao docDao;

    private FavoriteServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new FavoriteServiceImpl(favoriteDao, qaDao, articleDao, lawDao, docDao);
    }

    @Test
    @DisplayName("类型校验：非法类型被拒绝，大小写归一化")
    void normalizeType() {
        assertThrows(BizException.class, () -> service.exists(1L, "UNKNOWN", 1L));
        assertThrows(BizException.class, () -> service.exists(1L, null, 1L));
        when(favoriteDao.exists(1L, "ARTICLE", 2L)).thenReturn(true);
        assertTrue(service.exists(1L, "article", 2L));
    }

    @Test
    @DisplayName("收藏：目标不存在时拒绝，避免脏关联")
    void addRejectsMissingTarget() {
        when(qaDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.add(1L, "QA", 9L));
        verify(favoriteDao, never()).insert(any());
    }

    @Test
    @DisplayName("收藏：重复收藏幂等返回 true，不重复写库")
    void addIdempotent() {
        QaRecord qa = new QaRecord();
        qa.setId(1L);
        when(qaDao.findById(1L)).thenReturn(qa);
        when(favoriteDao.exists(1L, "QA", 1L)).thenReturn(true);

        assertTrue(service.add(1L, "QA", 1L));
        verify(favoriteDao, never()).insert(any());
    }

    @Test
    @DisplayName("收藏：首次收藏写入记录")
    void addFirstTime() {
        KnowledgeArticle a = new KnowledgeArticle();
        a.setId(3L);
        when(articleDao.findById(3L)).thenReturn(a);
        when(favoriteDao.exists(1L, "ARTICLE", 3L)).thenReturn(false);

        assertTrue(service.add(1L, "ARTICLE", 3L));
        verify(favoriteDao).insert(argThat((Favorite f) ->
                "ARTICLE".equals(f.getTargetType()) && f.getCreatedAt() != null));
    }

    @Test
    @DisplayName("切换：已收藏则取消，未收藏则收藏")
    void toggleBothBranches() {
        QaRecord qa = new QaRecord();
        qa.setId(2L);
        when(qaDao.findById(2L)).thenReturn(qa);

        when(favoriteDao.exists(1L, "QA", 2L)).thenReturn(true);
        assertFalse(service.toggle(1L, "QA", 2L));
        verify(favoriteDao).deleteByTarget(1L, "QA", 2L);

        when(favoriteDao.exists(1L, "QA", 2L)).thenReturn(false);
        assertTrue(service.toggle(1L, "QA", 2L));
        verify(favoriteDao).insert(any(Favorite.class));
    }

    @Test
    @DisplayName("取消收藏：直接删除，目标不存在也不报错")
    void removeAlwaysSucceeds() {
        assertFalse(service.remove(1L, "LAW", 8L));
        verify(favoriteDao).deleteByTarget(1L, "LAW", 8L);
    }

    @Test
    @DisplayName("分页：空数据返回空页")
    void pageEmpty() {
        when(favoriteDao.countByUserAndType(1L, "QA")).thenReturn(0L);
        assertEquals(0, service.page(1L, "QA", 1, 10).getTotal());
    }

    @Test
    @DisplayName("分页：回填问答收藏的标题与摘要")
    void pageFillsQaTitle() {
        Favorite f = new Favorite();
        f.setId(1L);
        f.setUserId(1L);
        f.setTargetType("QA");
        f.setTargetId(5L);
        QaRecord qa = new QaRecord();
        qa.setId(5L);
        qa.setQuestion("老板拖欠工资怎么办，已经两个月没有发工资了");
        qa.setAnswer("可以申请劳动仲裁");
        when(favoriteDao.countByUserAndType(1L, "QA")).thenReturn(1L);
        when(favoriteDao.findByUserAndType(1L, "QA", 0, 10)).thenReturn(List.of(f));
        when(qaDao.findById(5L)).thenReturn(qa);

        Favorite got = service.page(1L, "QA", 1, 10).getList().get(0);
        assertNotNull(got.getTargetTitle());
        assertTrue(got.getTargetTitle().contains("拖欠工资"));
    }

    @Test
    @DisplayName("分页：目标已被删除时不报错，标题留空")
    void pageToleratesMissingTarget() {
        Favorite f = new Favorite();
        f.setId(2L);
        f.setTargetType("DOC");
        f.setTargetId(77L);
        when(favoriteDao.countByUserAndType(1L, "DOC")).thenReturn(1L);
        when(favoriteDao.findByUserAndType(1L, "DOC", 0, 10)).thenReturn(List.of(f));
        when(docDao.findById(77L)).thenReturn(null);

        assertEquals(1, service.page(1L, "DOC", 1, 10).getList().size());
    }

    @Test
    @DisplayName("收藏类型统计透传")
    void typeStats() {
        when(favoriteDao.countGroupByType(1L)).thenReturn(List.of());
        assertNotNull(service.typeStats(1L));
    }
}
