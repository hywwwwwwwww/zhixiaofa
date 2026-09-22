package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.QaRecord;

import java.util.List;
import java.util.Map;

/**
 * 智能法律问答业务接口。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface QaService {

    /**
     * 提交一次法律咨询：检索相关法条 → 生成结构化回答 → 同一事务写入问答记录与法条引用。
     *
     * @param userId   提问用户
     * @param question 问题
     * @param category 分类（可空，由系统按关键词推断）
     * @return 已生成的问答记录（含引用法条）
     */
    QaRecord ask(Long userId, String question, String category);

    /** 某用户的问答分页 */
    PageResult<QaRecord> myPage(Long userId, int pageNum, int pageSize);

    /** 问答详情（含引用法条、是否已收藏） */
    QaRecord detail(Long id, Long currentUserId);

    /** 后台问答分页 */
    PageResult<QaRecord> page(String keyword, String category, Integer status, int pageNum, int pageSize);

    /** 后台问答分页（支持列头排序） */
    PageResult<QaRecord> page(String keyword, String category, Integer status, int pageNum, int pageSize, String sortName, String sortOrder);

    /** 点赞 */
    void like(Long id, Long userId);

    /** 后台补充 / 修改回答 */
    QaRecord answer(Long id, String answer);

    /** 删除（仅本人或管理员） */
    void delete(Long id, Long operatorId, boolean admin);

    /** 每日提问量统计 */
    List<Map<String, Object>> dailyStats(int days);

    /** 问题分类分布统计 */
    List<Map<String, Object>> categoryStats();

    /** 热门问题榜 */
    List<Map<String, Object>> hotQuestions(int limit);
}
