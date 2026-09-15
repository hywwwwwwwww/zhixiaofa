package com.zhixiaofa.dao;

import com.zhixiaofa.model.Contract;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Contract 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface ContractDao {

    /** 新增，返回自增主键 */
    Long insert(Contract entity);

    /** 按主键更新全部字段 */
    int update(Contract entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    Contract findById(Long id);

    /** 查询全部 */
    java.util.List<Contract> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<Contract> findByPage(int offset, int limit);

    /**
     * 某用户的合同分页
     *
     * @param userId 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<Contract> findByUserId(Long userId, int offset, int limit);

    /**
     * 某用户的合同数
     *
     * @param userId 参数
     * @return 查询结果
     */
    long countByUserId(Long userId);

    /**
     * 后台合同分页
     *
     * @param keyword 参数
     * @param riskLevel 参数
     * @param status 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<Contract> findByCondition(String keyword, String riskLevel, Integer status, int offset, int limit);

    /**
     * 后台合同条件计数
     *
     * @param keyword 参数
     * @param riskLevel 参数
     * @param status 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String riskLevel, Integer status);

    /**
     * 审查完成后回写整体风险等级与风险点数量
     *
     * @param id 参数
     * @param riskLevel 参数
     * @param riskCount 参数
     * @return 查询结果
     */
    int updateAfterReview(Long id, String riskLevel, Integer riskCount);

    /**
     * 风险等级分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByRiskLevel();

    /**
     * 合同类型分布
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByType();

    /**
     * 每日上传量
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);
}
