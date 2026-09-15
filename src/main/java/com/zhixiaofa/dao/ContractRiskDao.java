package com.zhixiaofa.dao;

import com.zhixiaofa.model.ContractRisk;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * ContractRisk 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface ContractRiskDao {

    /** 新增，返回自增主键 */
    Long insert(ContractRisk entity);

    /** 按主键更新全部字段 */
    int update(ContractRisk entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    ContractRisk findById(Long id);

    /** 查询全部 */
    java.util.List<ContractRisk> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<ContractRisk> findByPage(int offset, int limit);

    /**
     * 某合同的风险点明细（关联出法条名称，高风险在前）
     *
     * @param contractId 参数
     * @return 查询结果
     */
    java.util.List<ContractRisk> findByContractId(Long contractId);

    /**
     * 删除某合同的风险点
     *
     * @param contractId 参数
     * @return 查询结果
     */
    int deleteByContractId(Long contractId);

    /**
     * 在事务中写入风险点
     *
     * @param conn 参数
     * @param risk 参数
     * @return 查询结果
     */
    int insertRisk(Connection conn, ContractRisk risk);

    /**
     * 风险点等级分布
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByLevel();

    /**
     * 高频风险条款 TopN
     *
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> topRiskClauses(int limit);
}
