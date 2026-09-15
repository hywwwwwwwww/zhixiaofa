package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.LawArticle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 法条业务单元测试：覆盖检索分页、增删改与必填校验。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LawArticleService 测试")
class LawArticleServiceImplTest {

    @Mock private LawArticleDao lawDao;
    private LawArticleServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new LawArticleServiceImpl(lawDao);
    }

    private LawArticle sample() {
        LawArticle a = new LawArticle();
        a.setLawName("中华人民共和国劳动合同法");
        a.setArticleNo("第十条");
        a.setCategory("劳动合同");
        a.setContent("建立劳动关系，应当订立书面劳动合同。");
        return a;
    }

    @Test
    @DisplayName("分页：无数据时返回空页且不查列表")
    void pageEmpty() {
        when(lawDao.countByCondition(any(), any())).thenReturn(0L);
        PageResult<LawArticle> page = service.page("试用期", null, 1, 10);
        assertEquals(0, page.getTotal());
        verify(lawDao, never()).findByCondition(any(), any(), anyInt(), anyInt());
    }

    @Test
    @DisplayName("分页：正常返回并计算 offset")
    void pageWithData() {
        when(lawDao.countByCondition("试用期", null)).thenReturn(25L);
        when(lawDao.findByCondition("试用期", null, 20, 10))
                .thenReturn(Collections.singletonList(sample()));
        PageResult<LawArticle> page = service.page("试用期", null, 3, 10);
        assertEquals(25, page.getTotal());
        assertEquals(3, page.getPages());
        assertEquals(1, page.getList().size());
    }

    @Test
    @DisplayName("分页：页码与每页条数做边界修正")
    void pageClampsParams() {
        when(lawDao.countByCondition(any(), any())).thenReturn(5L);
        service.page(null, null, 0, 0);
        verify(lawDao).findByCondition(isNull(), isNull(), eq(0), eq(10));
        service.page(null, null, 1, 9999);
        verify(lawDao).findByCondition(isNull(), isNull(), eq(0), eq(100));
    }

    @Test
    @DisplayName("查询详情：不存在抛 DATA_NOT_FOUND")
    void getByIdNotFound() {
        when(lawDao.findById(99L)).thenReturn(null);
        BizException e = assertThrows(BizException.class, () -> service.getById(99L));
        assertEquals(10104, e.getCode());
    }

    @Test
    @DisplayName("新增：必填校验失败被拒绝")
    void createValidates() {
        LawArticle noLawName = sample();
        noLawName.setLawName(null);
        assertThrows(BizException.class, () -> service.create(noLawName));

        LawArticle noArticleNo = sample();
        noArticleNo.setArticleNo("  ");
        assertThrows(BizException.class, () -> service.create(noArticleNo));

        LawArticle noContent = sample();
        noContent.setContent(null);
        assertThrows(BizException.class, () -> service.create(noContent));
    }

    @Test
    @DisplayName("新增：分类为空时补默认值「其他」，并写入时间戳")
    void createFillsDefaults() {
        LawArticle a = sample();
        a.setCategory("");
        when(lawDao.insert(any(LawArticle.class))).thenReturn(7L);
        LawArticle created = service.create(a);
        assertEquals("其他", created.getCategory());
        assertEquals(7L, created.getId());
        assertNotNull(created.getCreatedAt());
        assertNotNull(created.getUpdatedAt());
    }

    @Test
    @DisplayName("更新：先校验存在性，再回查最新数据")
    void updateFlow() {
        LawArticle existing = sample();
        existing.setId(3L);
        when(lawDao.findById(3L)).thenReturn(existing);
        LawArticle updated = service.update(3L, sample());
        assertEquals(3L, updated.getId());
        verify(lawDao).update(any(LawArticle.class));
    }

    @Test
    @DisplayName("删除：不存在时报错且不执行删除")
    void deleteMissing() {
        when(lawDao.findById(5L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.delete(5L));
        verify(lawDao, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("批量查询：空集合直接返回空列表，不查库")
    void listByIdsEmpty() {
        assertTrue(service.listByIds(null).isEmpty());
        assertTrue(service.listByIds(List.of()).isEmpty());
        verify(lawDao, never()).findByIds(any());
    }

    @Test
    @DisplayName("分类列表非空；统计结果透传")
    void categoriesAndStats() {
        assertFalse(service.listCategories().isEmpty());
        when(lawDao.countGroupByCategory()).thenReturn(Collections.emptyList());
        assertNotNull(service.categoryStats());
    }
}
