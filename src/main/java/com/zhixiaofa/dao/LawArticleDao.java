package com.zhixiaofa.dao;

import com.zhixiaofa.model.LawArticle;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * LawArticle 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface LawArticleDao {

    /** 新增，返回自增主键 */
    Long insert(LawArticle entity);

    /** 按主键更新全部字段 */
    int update(LawArticle entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    LawArticle findById(Long id);

    /** 查询全部 */
    java.util.List<LawArticle> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<LawArticle> findByPage(int offset, int limit);

    /**
     * 按关键词全文检索 + 分类筛选分页（ngram 全文索引，避免 LIKE 全表扫描）
     *
     * @param keyword 参数
     * @param category 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<LawArticle> findByCondition(String keyword, String category, int offset, int limit);

    /**
     * 法条条件计数
     *
     * @param keyword 参数
     * @param category 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String category);

    /**
     * 按主键集合批量查询
     *
     * @param ids 参数
     * @return 查询结果
     */
    java.util.List<LawArticle> findByIds(java.util.List<Long> ids);

    /**
     * 法条分类分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByCategory();

    /**
     * 按法规统计
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByLaw();
}
