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

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 智能问答业务单元测试：验证参数校验、分类推断、关键词抽取与回答结构。
 *
 * <p>注意：{@code ask()} 内部走 JdbcExecutor 事务（需要真实数据库），
 * 属于集成测试范畴，这里聚焦不依赖数据库的纯业务逻辑。</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("QaService 业务逻辑测试")
class QaServiceImplTest {

    @Mock private QaRecordDao qaDao;
    @Mock private QaReferenceDao refDao;
    @Mock private LawArticleDao lawDao;
    @Mock private FavoriteDao favoriteDao;

    private QaServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new QaServiceImpl(qaDao, refDao, lawDao, favoriteDao);
    }

    private LawArticle law(long id, String articleNo, String content) {
        LawArticle l = new LawArticle();
        l.setId(id);
        l.setLawName("中华人民共和国劳动合同法");
        l.setArticleNo(articleNo);
        l.setTitle("示例条文");
        l.setContent(content);
        return l;
    }

    @Test
    @DisplayName("提问校验：内容为空或过短被拒绝")
    void askValidatesQuestion() {
        assertThrows(BizException.class, () -> service.ask(1L, "", null));
        assertThrows(BizException.class, () -> service.ask(1L, "   ", null));
        assertThrows(BizException.class, () -> service.ask(1L, "工资", null));
        assertThrows(BizException.class, () -> service.ask(1L, null, null));
    }

    @Test
    @DisplayName("分类推断：按关键词自动归类")
    void inferCategory() {
        assertEquals("工资报酬", service.inferCategory("老板拖欠工资两个月了怎么办"));
        assertEquals("解除终止", service.inferCategory("试用期被辞退有补偿吗"));
        assertEquals("社会保险", service.inferCategory("公司不给我缴社保"));
        assertEquals("竞业限制", service.inferCategory("签了竞业协议但没有补偿"));
        assertEquals("劳动合同", service.inferCategory("入职一个月还没签合同"));
        assertEquals("其他", service.inferCategory("随便问个问题"));
    }

    @Test
    @DisplayName("关键词抽取：能切出可命中的短词，且数量受限")
    void extractKeywords() {
        List<String> kws = service.extractKeywords("老板拖欠我三个月工资，公司还没签劳动合同怎么办？");
        assertFalse(kws.isEmpty());
        assertTrue(kws.size() <= 8, "关键词数量应受上限约束，避免检索次数失控");
        assertTrue(kws.stream().anyMatch(k -> k.contains("拖欠") || k.contains("工资")),
                "应包含能命中法条的词，实际: " + kws);
    }

    @Test
    @DisplayName("回答拼装：包含三段式结构并引用法条")
    void composeAnswerWithLaws() {
        String answer = service.composeAnswer("拖欠工资怎么办",
                List.of(law(1, "第三十条", "用人单位应当按照劳动合同约定支付劳动报酬。")));
        assertTrue(answer.contains("【初步结论】"));
        assertTrue(answer.contains("【法律依据】"));
        assertTrue(answer.contains("【建议步骤】"));
        assertTrue(answer.contains("第三十条"));
        assertTrue(answer.contains("劳动合同法"), "法规名应去掉书名号后展示");
        assertTrue(answer.contains("提示"), "应包含免责声明");
    }

    @Test
    @DisplayName("回答拼装：未检索到法条时也给出可执行建议")
    void composeAnswerWithoutLaws() {
        String answer = service.composeAnswer("很奇怪的问题", List.of());
        assertTrue(answer.contains("【初步结论】"));
        assertFalse(answer.contains("【法律依据】"));
        assertTrue(answer.contains("固定证据"));
    }

    @Test
    @DisplayName("删除：非本人且非管理员时拒绝")
    void deleteRejectsNonOwner() {
        QaRecord record = new QaRecord();
        record.setId(5L);
        record.setUserId(100L);
        when(qaDao.findById(5L)).thenReturn(record);

        BizException e = assertThrows(BizException.class, () -> service.delete(5L, 200L, false));
        assertEquals(11302, e.getCode());
        verify(qaDao, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("删除：管理员可删他人记录")
    void deleteAllowedForAdmin() {
        QaRecord record = new QaRecord();
        record.setId(5L);
        record.setUserId(100L);
        when(qaDao.findById(5L)).thenReturn(record);

        service.delete(5L, 1L, true);
        verify(qaDao).deleteById(5L);
    }

    @Test
    @DisplayName("点赞：记录不存在时报错")
    void likeMissingRecord() {
        when(qaDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.like(9L, 1L));
    }

    @Test
    @DisplayName("后台补答：回答为空被拒绝")
    void answerValidatesContent() {
        assertThrows(BizException.class, () -> service.answer(1L, ""));
    }
}
