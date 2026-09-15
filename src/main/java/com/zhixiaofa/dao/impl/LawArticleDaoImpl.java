package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.LawArticle;
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
 * LawArticleDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LawArticleDaoImpl implements LawArticleDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：law_article 全字段 */
    static final RowMapper<LawArticle> MAPPER = rs -> {
        LawArticle x = new LawArticle();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setLawName(ResultSets.getString(rs, "law_name"));
        x.setArticleNo(ResultSets.getString(rs, "article_no"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setTitle(ResultSets.getString(rs, "title"));
        x.setContent(ResultSets.getString(rs, "content"));
        x.setKeywords(ResultSets.getString(rs, "keywords"));
        x.setEffectiveDate(ResultSets.getLocalDate(rs, "effective_date"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        x.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
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
    public Long insert(LawArticle entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO law_article (law_name, article_no, category, title, content, keywords, effective_date, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getLawName(), entity.getArticleNo(), entity.getCategory(), entity.getTitle(), entity.getContent(), entity.getKeywords(), entity.getEffectiveDate(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(LawArticle entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE law_article SET law_name = ?, article_no = ?, category = ?, title = ?, content = ?, keywords = ?, effective_date = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getLawName(), entity.getArticleNo(), entity.getCategory(), entity.getTitle(), entity.getContent(), entity.getKeywords(), entity.getEffectiveDate(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM law_article WHERE id = ?", id);
    }

    @Override
    public LawArticle findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM law_article WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<LawArticle> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM law_article ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM law_article");
    }

    @Override
    public java.util.List<LawArticle> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM law_article ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<LawArticle> findByCondition(String keyword, String category, int offset, int limit) {
        // 按关键词全文检索 + 分类筛选分页（ngram 全文索引，避免 LIKE 全表扫描）
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, content, keywords", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM law_article WHERE 1=1" + sb.where() + " ORDER BY id LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category) {
        // 法条条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, content, keywords", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM law_article WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<LawArticle> findByIds(java.util.List<Long> ids) {
        // 按主键集合批量查询
        if (ids == null || ids.isEmpty()) {
                    return new ArrayList<>();
                }
                StringBuilder sb = new StringBuilder("SELECT * FROM law_article WHERE id IN (");
                for (int i = 0; i < ids.size(); i++) {
                    sb.append(i == 0 ? "?" : ",?");
                }
                sb.append(") ORDER BY id");
                return JdbcExecutor.queryList(null, sb.toString(), MAPPER, ids.toArray());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 法条分类分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT category AS label, COUNT(*) AS value FROM law_article GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByLaw() {
        // 按法规统计
        return JdbcExecutor.queryList(null, "SELECT law_name AS label, COUNT(*) AS value FROM law_article GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }
}
