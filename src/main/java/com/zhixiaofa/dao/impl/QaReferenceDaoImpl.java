package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.QaReferenceDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.QaReference;
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
 * QaReferenceDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QaReferenceDaoImpl implements QaReferenceDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：qa_reference 全字段 */
    static final RowMapper<QaReference> MAPPER = rs -> {
        QaReference x = new QaReference();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setQaId(ResultSets.getLong(rs, "qa_id"));
        x.setLawId(ResultSets.getLong(rs, "law_id"));
        x.setRelevance(ResultSets.getBigDecimal(rs, "relevance"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        return x;
    };

    /** 复用 LawArticle 的取列逻辑，避免在多表关联里重复写一遍映射 */
    static final RowMapper<LawArticle> LAW_MAPPER = rs -> {
        LawArticle l = new LawArticle();
        l.setId(ResultSets.getLong(rs, "id"));
        l.setLawName(ResultSets.getString(rs, "law_name"));
        l.setArticleNo(ResultSets.getString(rs, "article_no"));
        l.setCategory(ResultSets.getString(rs, "category"));
        l.setTitle(ResultSets.getString(rs, "title"));
        l.setContent(ResultSets.getString(rs, "content"));
        l.setKeywords(ResultSets.getString(rs, "keywords"));
        l.setEffectiveDate(ResultSets.getLocalDate(rs, "effective_date"));
        l.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        l.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
        return l;
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
    public Long insert(QaReference entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO qa_reference (qa_id, law_id, relevance, created_at) VALUES (?, ?, ?, ?)", entity.getQaId(), entity.getLawId(), entity.getRelevance(), entity.getCreatedAt());
    }

    @Override
    public int update(QaReference entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE qa_reference SET qa_id = ?, law_id = ?, relevance = ?, created_at = ? WHERE id = ?", entity.getQaId(), entity.getLawId(), entity.getRelevance(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM qa_reference WHERE id = ?", id);
    }

    @Override
    public QaReference findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM qa_reference WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<QaReference> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM qa_reference ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM qa_reference");
    }

    @Override
    public java.util.List<QaReference> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM qa_reference ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public int deleteByQaId(Long qaId) {
        // 删除某问答的全部法条引用
        return JdbcExecutor.update(null, "DELETE FROM qa_reference WHERE qa_id = ?", qaId);
    }

    @Override
    public int insertRef(Connection conn, Long qaId, Long lawId, BigDecimal relevance) {
        // 在事务中写入一条引用（供 Service 事务复用同一连接）
        return JdbcExecutor.update(conn, "INSERT INTO qa_reference (qa_id, law_id, relevance) VALUES (?, ?, ?)", qaId, lawId, relevance);
    }

    @Override
    public java.util.List<LawArticle> findLawsByQaId(Long qaId) {
        // 多表关联：某问答引用的法条明细
        return JdbcExecutor.queryList(null,
                        "SELECT l.* FROM qa_reference r INNER JOIN law_article l ON r.law_id = l.id"
                                + " WHERE r.qa_id = ? ORDER BY r.relevance DESC", LAW_MAPPER, qaId);
    }

    @Override
    public long countByLawId(Long lawId) {
        // 某法条被引用次数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM qa_reference WHERE law_id = ?", lawId);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> topLaws(int limit) {
        // 被引用最多的法条（柱状图）
        return JdbcExecutor.queryList(null, "SELECT CONCAT(l.article_no, ' ', IFNULL(l.title, '')) AS label, COUNT(*) AS value FROM qa_reference r INNER JOIN law_article l ON r.law_id = l.id GROUP BY l.id ORDER BY value DESC LIMIT ?", STATS_MAPPER, limit);
    }
}
