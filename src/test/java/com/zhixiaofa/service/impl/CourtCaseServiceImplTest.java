package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.CourtCaseDao;
import com.zhixiaofa.exception.BizException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 小法庭推演模型单元测试：验证胜诉概率与赔偿区间的取值边界。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("CourtCaseService 推演模型测试")
class CourtCaseServiceImplTest {

    @Mock private CourtCaseDao caseDao;

    private CourtCaseServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new CourtCaseServiceImpl(caseDao);
    }

    @Test
    @DisplayName("参数校验：案情描述过短被拒绝")
    void evaluateValidatesDescription() {
        assertThrows(BizException.class, () -> service.evaluate(1L, "标题", "太短", null));
        assertThrows(BizException.class, () -> service.evaluate(1L, "标题", null, null));
    }

    @Test
    @DisplayName("类型推断：按关键词识别案件类型")
    void inferTypeByKeywords() {
        assertEquals("拖欠工资", service.inferType("公司拖欠我三个月工资一直没发"));
        assertEquals("加班费", service.inferType("周末加班但不给加班费"));
        assertEquals("社保", service.inferType("公司一直没给我交社保"));
        assertEquals("违法辞退", service.inferType("公司突然把我辞退了"));
        assertEquals("其他", service.inferType("我想咨询一个法律问题"));
    }

    @Test
    @DisplayName("胜诉概率：有证据则上浮，无证据则下调，且始终落在 35~97 区间")
    void probabilityBounds() {
        BigDecimal strong = service.calcProbability(
                "有书面通知、邮件、微信聊天记录、录音、工资流水、考勤打卡截图等证据", "拖欠工资");
        BigDecimal weak = service.calcProbability(
                "只是口头说的，没有证据，也找不到任何记录，合同也没签", "加班费");
        assertTrue(strong.compareTo(weak) > 0, "有证据的胜诉率应高于无证据的");
        assertTrue(strong.compareTo(new BigDecimal("97")) <= 0);
        assertTrue(weak.compareTo(new BigDecimal("35")) >= 0);
    }

    @Test
    @DisplayName("胜诉概率：同类案件基准值不同（拖欠工资高于加班费）")
    void probabilityDiffersByType() {
        String desc = "公司行为导致我的权益受损，我已保存相关材料";
        BigDecimal wage = service.calcProbability(desc, "拖欠工资");
        BigDecimal overtime = service.calcProbability(desc, "加班费");
        assertTrue(wage.compareTo(overtime) > 0);
    }

    @Test
    @DisplayName("赔偿区间：从描述中提取金额并按时长倍率计算")
    void compensationFromAmount() {
        BigDecimal[] range = service.calcCompensation("月工资8000元，公司违法辞退我", "违法辞退");
        assertEquals(new BigDecimal("16000.00"), range[0]);
        assertEquals(new BigDecimal("48000.00"), range[1]);
    }

    @Test
    @DisplayName("赔偿区间：支持「万」单位")
    void compensationSupportsWan() {
        BigDecimal[] range = service.calcCompensation("拖欠工资1.2万", "拖欠工资");
        assertEquals(new BigDecimal("12000.00"), range[0]);
        assertEquals(new BigDecimal("24000.00"), range[1]);
    }

    @Test
    @DisplayName("赔偿区间：社保类案件为 0（主张补缴而非赔钱）")
    void compensationZeroForSocialInsurance() {
        BigDecimal[] range = service.calcCompensation("公司未缴社保", "社保");
        assertEquals(0, BigDecimal.ZERO.compareTo(range[0]));
        assertEquals(0, BigDecimal.ZERO.compareTo(range[1]));
    }

    @Test
    @DisplayName("赔偿区间：未识别到金额时使用默认月薪估算")
    void compensationDefaultSalary() {
        BigDecimal[] range = service.calcCompensation("公司把我辞退了，没有提金额", "违法辞退");
        assertTrue(range[1].compareTo(BigDecimal.ZERO) > 0, "无金额信息时也应给出估算区间");
    }
}
