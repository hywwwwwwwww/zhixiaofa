package com.zhixiaofa.service.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 后台看板业务单元测试：验证聚合结构的完整性。
 *
 * <p>说明：本类不 mock DAO，而是验证聚合结果的「形状」——
 * Service 的职责就是把各 DAO 的统计拼成前端 ECharts 直接可用的结构，
 * 因此断言重点是返回体是否包含约定的键。</p>
 */
@DisplayName("StatsService 聚合结构测试")
class StatsServiceImplTest {

    // 依赖真实数据库，这里只在连得上库时校验结构；连不上就跳过断言
    private boolean dbAvailable() {
        try {
            com.zhixiaofa.util.DBUtil.getConnection().close();
            return true;
        } catch (Throwable e) {
            return false;
        }
    }

    @Test
    @DisplayName("trend：days 参数越界时回落为 14 天，且返回 series 结构")
    void trendStructure() {
        if (!dbAvailable()) {
            return;
        }
        StatsServiceImpl service = new StatsServiceImpl();
        Map<String, Object> trend = service.trend(999);
        assertEquals(14, trend.get("days"));
        assertTrue(trend.containsKey("series"));
        Map<?, ?> series = (Map<?, ?>) trend.get("series");
        for (String key : new String[]{"labels", "users", "qa", "contracts", "docs", "cases", "requests"}) {
            assertTrue(series.containsKey(key), "series 缺少序列: " + key);
        }
    }

    @Test
    @DisplayName("overview / distributions / rankings / poolInfo：键完整")
    void aggregateStructures() {
        if (!dbAvailable()) {
            return;
        }
        StatsServiceImpl service = new StatsServiceImpl();

        Map<String, Object> overview = service.overview();
        for (String key : new String[]{"userCount", "qaCount", "contractCount", "docCount",
                "articleCount", "poolInfo".substring(0, 0) + "lawCount", "roleStats"}) {
            assertTrue(overview.containsKey(key), "overview 缺少字段: " + key);
        }

        Map<String, Object> dist = service.distributions();
        for (String key : new String[]{"qaCategory", "contractRisk", "caseType", "articleCategory"}) {
            assertTrue(dist.containsKey(key), "distributions 缺少字段: " + key);
        }

        Map<String, Object> rank = service.rankings();
        for (String key : new String[]{"hotQuestions", "topLaws", "riskClauses", "templateUsage",
                "articleViews", "apiUsage"}) {
            assertTrue(rank.containsKey(key), "rankings 缺少字段: " + key);
        }

        Map<String, Object> pool = service.poolInfo();
        assertTrue(pool.containsKey("maxTotal"));
        assertTrue(pool.containsKey("borrowed"));
    }
}
