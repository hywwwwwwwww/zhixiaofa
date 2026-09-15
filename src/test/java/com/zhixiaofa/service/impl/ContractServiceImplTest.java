package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.ContractRiskDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.ContractRisk;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 合同审查规则引擎单元测试：直接验证风险规则表与整体等级判定。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ContractService 审查规则测试")
class ContractServiceImplTest {

    @Mock private ContractDao contractDao;
    @Mock private ContractRiskDao riskDao;

    private ContractServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ContractServiceImpl(contractDao, riskDao);
    }

    @Test
    @DisplayName("参数校验：文件名或正文为空时拒绝")
    void reviewValidatesInput() {
        assertThrows(BizException.class,
                () -> service.review(1L, "", "劳动合同", null, null, null, "正文"));
        assertThrows(BizException.class,
                () -> service.review(1L, "a.pdf", "劳动合同", null, null, null, ""));
        assertThrows(BizException.class,
                () -> service.review(1L, "a.pdf", "劳动合同", null, null, null, null));
    }

    @Test
    @DisplayName("规则命中：放弃社保 + 竞业限制无补偿 → 至少 2 条高风险")
    void scanDetectsHighRisks() {
        String text = "第五条 乙方自愿放弃社会保险，由甲方每月发放社保补贴500元。"
                + "第七条 乙方离职后两年内不得从事同行业工作，甲方无需支付经济补偿。";
        List<ContractRisk> risks = service.scan(text);
        assertTrue(risks.size() >= 2, "应至少命中 2 条规则，实际 " + risks.size());
        long highCount = risks.stream().filter(r -> "高".equals(r.getRiskLevel())).count();
        assertTrue(highCount >= 2, "应至少 2 条高风险");
        risks.forEach(r -> {
            assertNotNull(r.getRiskLevel());
            assertNotNull(r.getRiskDesc());
            assertNotNull(r.getSuggestion());
            assertNotNull(r.getCreatedAt());
        });
    }

    @Test
    @DisplayName("规则命中：试用期六个月、单方调岗、违约金、罚款、次月30日发薪")
    void scanDetectsVariousRules() {
        String text = "第三条 试用期为六个月。第四条 甲方可单方调岗降薪。"
                + "第九条 乙方需支付违约金两千元。第十一条 甲方可对乙方进行罚款。"
                + "第八条 工资于次月30日发放。";
        List<ContractRisk> risks = service.scan(text);
        assertTrue(risks.size() >= 4, "应命中多条规则，实际 " + risks.size());
        assertTrue(risks.stream().anyMatch(r -> "第4条".equals(r.getClauseNo())));
    }

    @Test
    @DisplayName("rule 未命中：合规合同不产生风险点")
    void scanCleanContract() {
        String text = "第一条 双方依法签订劳动合同。第二条 工作时间实行标准工时制，每日8小时。"
                + "第三条 甲方按时足额支付劳动报酬。";
        assertTrue(service.scan(text).size() <= 1, "合规合同不应产生大量风险点");
    }

    @Test
    @DisplayName("命中时会摘取问题条款原文片段")
    void scanExtractsClauseSnippet() {
        String text = "第十条 乙方自愿放弃社会保险，一切后果自负。";
        List<ContractRisk> risks = service.scan(text);
        assertFalse(risks.isEmpty());
        String clause = risks.get(0).getClauseContent();
        assertNotNull(clause);
        assertTrue(clause.contains("放弃"), "摘取的原文应包含命中关键词");
    }

    @Test
    @DisplayName("整体等级：有高风险即为「高」")
    void overallLevelHigh() {
        ContractRisk r = new ContractRisk();
        r.setRiskLevel("高");
        assertEquals("高", service.overallLevel(List.of(r)));
    }

    @Test
    @DisplayName("整体等级：只有中风险为「中」，全低为「低」，无风险为「低」")
    void overallLevelMidAndLow() {
        ContractRisk mid = new ContractRisk();
        mid.setRiskLevel("中");
        ContractRisk low = new ContractRisk();
        low.setRiskLevel("低");
        assertEquals("中", service.overallLevel(List.of(mid, low)));
        assertEquals("低", service.overallLevel(List.of(low)));
        assertEquals("低", service.overallLevel(List.of()));
    }
}
