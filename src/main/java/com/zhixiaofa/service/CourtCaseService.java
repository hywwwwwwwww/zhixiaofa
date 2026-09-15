package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.CourtCase;

import java.util.List;
import java.util.Map;

/**
 * AI 小法庭案件推演业务接口。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface CourtCaseService {

    /**
     * 提交案件并推演出胜诉概率与赔偿区间。
     *
     * @param userId      提交人
     * @param title       案件标题
     * @param description 案情描述
     * @param caseType    案件类型（可空，由描述推断）
     * @return 含推演结论的案件
     */
    CourtCase evaluate(Long userId, String title, String description, String caseType);

    PageResult<CourtCase> myPage(Long userId, int pageNum, int pageSize);

    PageResult<CourtCase> page(String keyword, String caseType, int pageNum, int pageSize);

    CourtCase getById(Long id);

    void delete(Long id, Long operatorId, boolean admin);

    /** 案件类型分布 */
    List<Map<String, Object>> typeStats();

    /** 各类案件平均胜诉率 */
    List<Map<String, Object>> probabilityStats();

    /** 每日推演量 */
    List<Map<String, Object>> dailyStats(int days);
}
