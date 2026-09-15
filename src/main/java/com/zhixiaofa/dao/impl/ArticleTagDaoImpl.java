package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.ArticleTagDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.ArticleTag;
import com.zhixiaofa.util.JdbcExecutor;
import com.zhixiaofa.util.ResultSets;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * ArticleTagDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class ArticleTagDaoImpl implements ArticleTagDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：article_tag 全字段 */
    static final RowMapper<ArticleTag> MAPPER = rs -> {
        ArticleTag x = new ArticleTag();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setArticleId(ResultSets.getLong(rs, "article_id"));
        x.setTagId(ResultSets.getLong(rs, "tag_id"));
        return x;
    };

    /** 统计类查询统一的行映射：label + value */
    static final RowMapper<Map<String, Object>> STATS_MAPPER = rs -> {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", rs.getString("label"));
        row.put("value", rs.getObject("value"));
        return row;
    };

    /* ---------------- 标准 CRUD ---------------- */

    @Override
    public Long insert(ArticleTag entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO article_tag (article_id, tag_id) VALUES (?, ?)", entity.getArticleId(), entity.getTagId());
    }

    @Override
    public int update(ArticleTag entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE article_tag SET article_id = ?, tag_id = ? WHERE id = ?", entity.getArticleId(), entity.getTagId(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM article_tag WHERE id = ?", id);
    }

    @Override
    public ArticleTag findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM article_tag WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<ArticleTag> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM article_tag ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM article_tag");
    }

    @Override
    public java.util.List<ArticleTag> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM article_tag ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public int deleteByArticleId(Long articleId) {
        // 清除文章的全部标签关联
        return JdbcExecutor.update(null, "DELETE FROM article_tag WHERE article_id = ?", articleId);
    }

    @Override
    public int insertPair(Long articleId, Long tagId) {
        // 写入文章标签关联（重复自动忽略）
        return JdbcExecutor.update(null, "INSERT IGNORE INTO article_tag (article_id, tag_id) VALUES (?, ?)", articleId, tagId);
    }

    @Override
    public java.util.List<String> findTagNamesByArticleId(Long articleId) {
        // 多表关联：文章标签名列表
        return JdbcExecutor.queryList(null,
                        "SELECT t.name FROM article_tag at INNER JOIN knowledge_tag t ON at.tag_id = t.id"
                                + " WHERE at.article_id = ? ORDER BY t.id", rs -> rs.getString(1), articleId);
    }
}
