package com.zhixiaofa.dao;

import com.zhixiaofa.model.CourtCase;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * CourtCase 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface CourtCaseDao {

    /** 新增，返回自增主键 */
    Long insert(CourtCase entity);

    /** 按主键更新全部字段 */
    int update(CourtCase entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    CourtCase findById(Long id);

    /** 查询全部 */
    java.util.List<CourtCase> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<CourtCase> findByPage(int offset, int limit);

    /**
     * 某用户提交的案件分页
     *
     * @param userId 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<CourtCase> findByUserId(Long userId, int offset, int limit);

    /**
     * 某用户的案件数
     *
     * @param userId 参数
     * @return 查询结果
     */
    long countByUserId(Long userId);

    /**
     * 后台案件分页
     *
     * @param keyword 参数
     * @param caseType 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<CourtCase> findByCondition(String keyword, String caseType, int offset, int limit);

    /**
     * 后台案件条件计数
     *
     * @param keyword 参数
     * @param caseType 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String caseType);

    /**
     * 案件类型分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByType();

    /**
     * 各类案件平均胜诉率（柱状图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> avgProbabilityByType();

    /**
     * 每日推演量
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);
}
