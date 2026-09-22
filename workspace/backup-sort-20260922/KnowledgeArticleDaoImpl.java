package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.KnowledgeArticle;
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
 * KnowledgeArticleDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class KnowledgeArticleDaoImpl implements KnowledgeArticleDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：knowledge_article 全字段 */
    static final RowMapper<KnowledgeArticle> MAPPER = rs -> {
        KnowledgeArticle x = new KnowledgeArticle();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setTitle(ResultSets.getString(rs, "title"));
        x.setSummary(ResultSets.getString(rs, "summary"));
        x.setContent(ResultSets.getString(rs, "content"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setAuthor(ResultSets.getString(rs, "author"));
        x.setViewCount(ResultSets.getInteger(rs, "view_count"));
        x.setLikeCount(ResultSets.getInteger(rs, "like_count"));
        x.setStatus(ResultSets.getInteger(rs, "status"));
        x.setPublishedAt(ResultSets.getLocalDateTime(rs, "published_at"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
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
    public Long insert(KnowledgeArticle entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO knowledge_article (title, summary, content, category, author, view_count, like_count, status, published_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getTitle(), entity.getSummary(), entity.getContent(), entity.getCategory(), entity.getAuthor(), entity.getViewCount(), entity.getLikeCount(), entity.getStatus(), entity.getPublishedAt(), entity.getCreatedAt());
    }

    @Override
    public int update(KnowledgeArticle entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE knowledge_article SET title = ?, summary = ?, content = ?, category = ?, author = ?, view_count = ?, like_count = ?, status = ?, published_at = ?, created_at = ? WHERE id = ?", entity.getTitle(), entity.getSummary(), entity.getContent(), entity.getCategory(), entity.getAuthor(), entity.getViewCount(), entity.getLikeCount(), entity.getStatus(), entity.getPublishedAt(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM knowledge_article WHERE id = ?", id);
    }

    @Override
    public KnowledgeArticle findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM knowledge_article WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<KnowledgeArticle> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM knowledge_article ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM knowledge_article");
    }

    @Override
    public java.util.List<KnowledgeArticle> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM knowledge_article ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<KnowledgeArticle> findByCondition(String keyword, String category, Integer status, int offset, int limit) {
        // 文章分页（分类 + 全文检索）
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, summary, content", keyword)
                        .andEq("category", category)
                        .andEq("status", status);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM knowledge_article WHERE 1=1" + sb.where()
                                + " ORDER BY published_at DESC, id DESC LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category, Integer status) {
        // 文章条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, summary, content", keyword)
                        .andEq("category", category)
                        .andEq("status", status);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM knowledge_article WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public int incrementView(Long id) {
        // 阅读量 +1
        return JdbcExecutor.update(null, "UPDATE knowledge_article SET view_count = view_count + 1 WHERE id = ?", id);
    }

    @Override
    public int incrementLike(Long id) {
        // 点赞数 +1
        return JdbcExecutor.update(null, "UPDATE knowledge_article SET like_count = like_count + 1 WHERE id = ?", id);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 文章分类分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(category, '未分类') AS label, COUNT(*) AS value FROM knowledge_article GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> topByViews(int topN) {
        // 阅读量 TopN（柱状图）
        return JdbcExecutor.queryList(null, "SELECT LEFT(title, 16) AS label, view_count AS value FROM knowledge_article WHERE status = 1 ORDER BY view_count DESC LIMIT ?", STATS_MAPPER, topN);
    }
}
