package com.zhixiaofa.dao;

import com.zhixiaofa.model.ArticleTag;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * ArticleTag 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface ArticleTagDao {

    /** 新增，返回自增主键 */
    Long insert(ArticleTag entity);

    /** 按主键更新全部字段 */
    int update(ArticleTag entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    ArticleTag findById(Long id);

    /** 查询全部 */
    java.util.List<ArticleTag> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<ArticleTag> findByPage(int offset, int limit);

    /**
     * 清除文章的全部标签关联
     *
     * @param articleId 参数
     * @return 查询结果
     */
    int deleteByArticleId(Long articleId);

    /**
     * 写入文章标签关联（重复自动忽略）
     *
     * @param articleId 参数
     * @param tagId 参数
     * @return 查询结果
     */
    int insertPair(Long articleId, Long tagId);

    /**
     * 多表关联：文章标签名列表
     *
     * @param articleId 参数
     * @return 查询结果
     */
    java.util.List<String> findTagNamesByArticleId(Long articleId);
}
