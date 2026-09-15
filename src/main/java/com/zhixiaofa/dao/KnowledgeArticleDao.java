package com.zhixiaofa.dao;

import com.zhixiaofa.model.KnowledgeArticle;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * KnowledgeArticle 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface KnowledgeArticleDao {

    /** 新增，返回自增主键 */
    Long insert(KnowledgeArticle entity);

    /** 按主键更新全部字段 */
    int update(KnowledgeArticle entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    KnowledgeArticle findById(Long id);

    /** 查询全部 */
    java.util.List<KnowledgeArticle> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<KnowledgeArticle> findByPage(int offset, int limit);

    /**
     * 文章分页（分类 + 全文检索）
     *
     * @param keyword 参数
     * @param category 参数
     * @param status 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<KnowledgeArticle> findByCondition(String keyword, String category, Integer status, int offset, int limit);

    /**
     * 文章条件计数
     *
     * @param keyword 参数
     * @param category 参数
     * @param status 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String category, Integer status);

    /**
     * 阅读量 +1
     *
     * @param id 参数
     * @return 查询结果
     */
    int incrementView(Long id);

    /**
     * 点赞数 +1
     *
     * @param id 参数
     * @return 查询结果
     */
    int incrementLike(Long id);

    /**
     * 文章分类分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByCategory();

    /**
     * 阅读量 TopN（柱状图）
     *
     * @param topN 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> topByViews(int topN);
}
