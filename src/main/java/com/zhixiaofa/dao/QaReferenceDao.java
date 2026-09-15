package com.zhixiaofa.dao;

import com.zhixiaofa.model.QaReference;
import com.zhixiaofa.model.LawArticle;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * QaReference 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface QaReferenceDao {

    /** 新增，返回自增主键 */
    Long insert(QaReference entity);

    /** 按主键更新全部字段 */
    int update(QaReference entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    QaReference findById(Long id);

    /** 查询全部 */
    java.util.List<QaReference> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<QaReference> findByPage(int offset, int limit);

    /**
     * 删除某问答的全部法条引用
     *
     * @param qaId 参数
     * @return 查询结果
     */
    int deleteByQaId(Long qaId);

    /**
     * 在事务中写入一条引用（供 Service 事务复用同一连接）
     *
     * @param conn 参数
     * @param qaId 参数
     * @param lawId 参数
     * @param relevance 参数
     * @return 查询结果
     */
    int insertRef(Connection conn, Long qaId, Long lawId, BigDecimal relevance);

    /**
     * 多表关联：某问答引用的法条明细
     *
     * @param qaId 参数
     * @return 查询结果
     */
    java.util.List<LawArticle> findLawsByQaId(Long qaId);

    /**
     * 某法条被引用次数
     *
     * @param lawId 参数
     * @return 查询结果
     */
    long countByLawId(Long lawId);

    /**
     * 被引用最多的法条（柱状图）
     *
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> topLaws(int limit);
}
