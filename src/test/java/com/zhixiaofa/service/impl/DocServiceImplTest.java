package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.DocTemplateDao;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 文书模板渲染单元测试：验证占位符解析与替换规则。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("DocService 模板渲染测试")
class DocServiceImplTest {

    @Mock private DocTemplateDao templateDao;
    @Mock private DocRecordDao docDao;

    private DocServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new DocServiceImpl(templateDao, docDao);
    }

    @Test
    @DisplayName("解析占位符：按出现顺序去重")
    void parsePlaceholders() {
        String tpl = "${标题}\n申请人：${申请人}\n被申请人：${被申请人}\n再次确认：${申请人}";
        List<String> list = service.parsePlaceholders(tpl);
        assertEquals(List.of("标题", "申请人", "被申请人"), list);
    }

    @Test
    @DisplayName("解析占位符：无占位符时返回空列表")
    void parsePlaceholdersEmpty() {
        assertTrue(service.parsePlaceholders("纯文本无占位符").isEmpty());
        assertTrue(service.parsePlaceholders(null).isEmpty());
    }

    @Test
    @DisplayName("渲染：已填写字段被替换")
    void renderReplacesProvidedFields() {
        String tpl = "申请人：${申请人}，请求：${请求事项}";
        Map<String, String> params = new HashMap<>();
        params.put("申请人", "张三");
        params.put("请求事项", "支付拖欠工资 30000 元");
        String out = service.render(tpl, params);
        assertEquals("申请人：张三，请求：支付拖欠工资 30000 元", out);
    }

    @Test
    @DisplayName("渲染：未填写字段给出兜底提示，而不是留空或报错")
    void renderMarksMissingFields() {
        String out = service.render("申请人：${申请人}，身份证号：${身份证号}", Map.of("申请人", "张三"));
        assertTrue(out.contains("张三"));
        assertTrue(out.contains("（此处待补充：身份证号）"), "未填字段应给出显式提示，便于人工补齐");
    }

    @Test
    @DisplayName("渲染：特殊字符 $ 与 \\ 不会破坏替换（Matcher.quoteReplacement）")
    void renderHandlesSpecialCharacters() {
        String out = service.render("金额：${金额}", Map.of("金额", "$100\\200"));
        assertEquals("金额：$100\\200", out);
    }

    @Test
    @DisplayName("渲染：空模板返回空串，不抛异常")
    void renderNullTemplate() {
        assertEquals("", service.render(null, Map.of()));
    }

    @Test
    @DisplayName("渲染：宽松匹配忽略键名首尾空白")
    void renderTolerantKeyMatch() {
        Map<String, String> params = new HashMap<>();
        params.put("  申请人  ", "李四");
        assertTrue(service.render("${申请人}", params).contains("李四"));
    }
}
