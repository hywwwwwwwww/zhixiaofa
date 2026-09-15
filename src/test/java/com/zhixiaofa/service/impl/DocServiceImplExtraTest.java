package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.DocTemplateDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.DocRecord;
import com.zhixiaofa.model.DocTemplate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 文书业务补充测试：覆盖模板管理与文书生成/分页/编辑。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DocService 补充测试")
class DocServiceImplExtraTest {

    @Mock private DocTemplateDao templateDao;
    @Mock private DocRecordDao docDao;

    private DocServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new DocServiceImpl(templateDao, docDao);
    }

    private DocTemplate template(long id, int enabled) {
        DocTemplate t = new DocTemplate();
        t.setId(id);
        t.setCode("T01");
        t.setName("劳动仲裁申请书");
        t.setCategory("仲裁");
        t.setContentTemplate("申请人：${申请人}，请求：${请求事项}");
        t.setEnabled(enabled);
        t.setSortNo(10);
        return t;
    }

    private DocRecord record(long id, long userId) {
        DocRecord r = new DocRecord();
        r.setId(id);
        r.setUserId(userId);
        r.setTemplateId(1L);
        r.setTitle("申请书");
        r.setContent("正文");
        r.setCreatedAt(LocalDateTime.now());
        return r;
    }

    @Test
    @DisplayName("模板列表与详情：补齐占位符；不存在报错")
    void templateListAndDetail() {
        when(templateDao.findEnabled()).thenReturn(List.of(template(1L, 1)));
        assertEquals(1, service.listTemplates().size());

        when(templateDao.findById(1L)).thenReturn(template(1L, 1));
        assertEquals(2, service.getTemplate(1L).getPlaceholders().size());

        when(templateDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.getTemplate(9L));
    }

    @Test
    @DisplayName("生成文书：正常路径替换占位符并按模板名兜底标题")
    void generateOk() {
        when(templateDao.findById(1L)).thenReturn(template(1L, 1));
        when(docDao.insert(any(DocRecord.class))).thenReturn(88L);

        Map<String, String> params = new LinkedHashMap<>();
        params.put("申请人", "张三");
        params.put("请求事项", "支付工资");
        DocRecord r = service.generate(1L, 1L, params);

        assertEquals(88L, r.getId());
        assertEquals("劳动仲裁申请书", r.getTemplateName());
        assertTrue(r.getContent().contains("张三"));
        assertFalse(r.getContent().contains("${申请人}"));
        assertNotNull(r.getParamsJson());
    }

    @Test
    @DisplayName("生成文书：模板停用时拒绝")
    void generateRejectsDisabledTemplate() {
        when(templateDao.findById(1L)).thenReturn(template(1L, 0));
        assertThrows(BizException.class, () -> service.generate(1L, 1L, Map.of()));
    }

    @Test
    @DisplayName("生成文书：参数为空也不报错，未填字段给出提示")
    void generateWithEmptyParams() {
        when(templateDao.findById(1L)).thenReturn(template(1L, 1));
        when(docDao.insert(any(DocRecord.class))).thenReturn(1L);
        DocRecord r = service.generate(1L, 1L, null);
        assertTrue(r.getContent().contains("（此处待补充"));
    }

    @Test
    @DisplayName("我的文书：空数据与有数据")
    void myPageBranches() {
        when(docDao.countByUserId(1L)).thenReturn(0L);
        assertEquals(0, service.myPage(1L, 1, 10).getTotal());

        when(docDao.countByUserId(1L)).thenReturn(1L);
        when(docDao.findByUserId(1L, 0, 10)).thenReturn(List.of(record(1L, 1L)));
        assertEquals(1, service.myPage(1L, 1, 10).getTotal());
    }

    @Test
    @DisplayName("后台分页：空数据与有数据")
    void pageBranches() {
        when(docDao.countByCondition(any(), any())).thenReturn(0L);
        assertEquals(0, service.page(null, null, 1, 10).getTotal());

        when(docDao.countByCondition(any(), any())).thenReturn(3L);
        when(docDao.findByCondition(any(), any(), anyInt(), anyInt())).thenReturn(List.of(record(1L, 1L)));
        assertEquals(3, service.page(null, null, 1, 10).getTotal());
    }

    @Test
    @DisplayName("文书详情：不存在报错；非本人被拒绝")
    void detailPermissions() {
        when(docDao.findByIdWithDetail(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.detail(9L, 1L, false));

        when(docDao.findByIdWithDetail(1L)).thenReturn(record(1L, 100L));
        assertThrows(BizException.class, () -> service.detail(1L, 200L, false));
        assertNotNull(service.detail(1L, 1L, true));
    }

    @Test
    @DisplayName("编辑文书：更新标题与正文并回写时间")
    void updateContent() {
        when(docDao.findByIdWithDetail(1L)).thenReturn(record(1L, 1L));
        DocRecord r = service.updateContent(1L, 1L, "新标题", "新正文");
        assertEquals("新标题", r.getTitle());
        assertEquals("新正文", r.getContent());
        assertNotNull(r.getUpdatedAt());
        verify(docDao).update(any(DocRecord.class));
    }

    @Test
    @DisplayName("删除文书：非本人被拒绝，本人可删")
    void deleteBehavior() {
        when(docDao.findByIdWithDetail(1L)).thenReturn(record(1L, 100L));
        assertThrows(BizException.class, () -> service.delete(1L, 200L, false));

        when(docDao.findByIdWithDetail(2L)).thenReturn(record(2L, 1L));
        service.delete(2L, 1L, false);
        verify(docDao).deleteById(2L);
    }

    @Test
    @DisplayName("模板后台分页：空数据与有数据")
    void templatePageBranches() {
        when(templateDao.countByCondition(any(), any())).thenReturn(0L);
        assertEquals(0, service.templatePage(null, null, 1, 10).getTotal());

        when(templateDao.countByCondition(any(), any())).thenReturn(2L);
        when(templateDao.findByCondition(any(), any(), anyInt(), anyInt())).thenReturn(List.of(template(1L, 1)));
        assertEquals(2, service.templatePage(null, null, 1, 10).getTotal());
    }

    @Test
    @DisplayName("新增模板：编码重复被拒绝；缺少必填被拒绝")
    void saveTemplateValidation() {
        DocTemplate noCode = template(0L, 1);
        noCode.setCode("");
        assertThrows(BizException.class, () -> service.saveTemplate(noCode));

        DocTemplate noName = template(0L, 1);
        noName.setName(null);
        assertThrows(BizException.class, () -> service.saveTemplate(noName));

        DocTemplate noBody = template(0L, 1);
        noBody.setContentTemplate("  ");
        assertThrows(BizException.class, () -> service.saveTemplate(noBody));

        DocTemplate dupCode = template(0L, 1);
        when(templateDao.findByCode("T01")).thenReturn(template(1L, 1));
        assertThrows(BizException.class, () -> service.saveTemplate(dupCode));
    }

    @Test
    @DisplayName("新增模板：成功时补默认排序号与启用状态")
    void saveTemplateDefaults() {
        DocTemplate t = template(0L, 1);
        t.setSortNo(null);
        t.setEnabled(null);
        when(templateDao.findByCode("T01")).thenReturn(null);
        when(templateDao.insert(any(DocTemplate.class))).thenReturn(6L);
        DocTemplate created = service.saveTemplate(t);
        assertEquals(6L, created.getId());
        assertEquals(0, created.getSortNo());
        assertEquals(1, created.getEnabled());
    }

    @Test
    @DisplayName("更新模板：编码与创建时间保持不变")
    void updateTemplateKeepsCode() {
        when(templateDao.findById(1L)).thenReturn(template(1L, 1));
        DocTemplate form = template(0L, 1);
        form.setCode("CHANGED");
        form.setName("新名称");
        service.updateTemplate(1L, form);
        // 编码与创建时间取自库中原记录，不允许被表单覆盖
        verify(templateDao).update(argThat((DocTemplate x) ->
                "T01".equals(x.getCode()) && "新名称".equals(x.getName())));
    }

    @Test
    @DisplayName("删除模板：不存在报错；被引用时给出可读提示")
    void deleteTemplate() {
        when(templateDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.deleteTemplate(9L));

        when(templateDao.findById(1L)).thenReturn(template(1L, 1));
        doThrow(new RuntimeException("外键约束")).when(templateDao).deleteById(1L);
        BizException e = assertThrows(BizException.class, () -> service.deleteTemplate(1L));
        assertTrue(e.getMessage().contains("无法删除"));
    }

    @Test
    @DisplayName("统计透传")
    void statsDelegation() {
        when(templateDao.countGroupByCategory()).thenReturn(List.of());
        when(docDao.topTemplates(8)).thenReturn(List.of());
        assertNotNull(service.templateCategoryStats());
        assertNotNull(service.templateUsageStats(8));
    }
}
