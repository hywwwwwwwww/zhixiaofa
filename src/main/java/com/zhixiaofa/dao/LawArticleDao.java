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

    /**
     * 按「法规名称 + 条号」查询，用于同步去重。
     *
     * @param lawName   法规名称
     * @param articleNo 条号
     * @return 命中记录，不存在返回 null
     */
    LawArticle findByLawNameAndNo(String lawName, String articleNo);

    /**
     * 存在则更新、不存在则插入（按 law_name + article_no 唯一键）。
     *
     * <p>用于国家法律法规数据库同步：正文未命中时保留数据库已有正文，
     * 避免把手工精编的正文覆盖成空。</p>
     *
     * @param entity 法条
     * @return 受影响行数
     */
    int upsert(LawArticle entity);

    /** 查询全部 */
    java.util.List<LawArticle> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<LawArticle> findByPage(int offset, int limit);

    /**
     * 按关键词全文检索 + 分类 / 法规名筛选分页（ngram 全文索引，避免 LIKE 全表扫描）
     *
     * @param keyword 关键词
     * @param category 分类
     * @param lawName 法规名称（「法律管理」页按法律筛选）
     * @param offset 偏移
     * @param limit 每页条数
     * @return 查询结果
     */
    java.util.List<LawArticle> findByCondition(String keyword, String category, String lawName, int offset, int limit);

    /**
     * 法条条件计数
     *
     * @param keyword 关键词
     * @param category 分类
     * @param lawName 法规名称
     * @return 命中条数
     */
    long countByCondition(String keyword, String category, String lawName);

    /**
     * 列出库中全部法规名称（去重，供「法律管理」页下拉选择）。
     *
     * @return 法规名称列表
     */
    java.util.List<String> listLawNames();

    /**
     * 列出库中**实际有法条**的分类（去重），用于过滤掉空分类。
     *
     * @return 分类列表
     */
    java.util.List<String> listCategories();

    /**
     * 只更新「法律内序号」一列。
     *
     * @param id  法条主键
     * @param seq 序号
     * @return 受影响行数
     */
    int updateSeq(Long id, int seq);

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
