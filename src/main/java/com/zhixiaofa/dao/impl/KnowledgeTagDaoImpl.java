package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.KnowledgeTagDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.KnowledgeTag;
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
 * KnowledgeTagDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class KnowledgeTagDaoImpl implements KnowledgeTagDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：knowledge_tag 全字段 */
    static final RowMapper<KnowledgeTag> MAPPER = rs -> {
        KnowledgeTag x = new KnowledgeTag();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setName(ResultSets.getString(rs, "name"));
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
    public Long insert(KnowledgeTag entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO knowledge_tag (name, created_at) VALUES (?, ?)", entity.getName(), entity.getCreatedAt());
    }

    @Override
    public int update(KnowledgeTag entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE knowledge_tag SET name = ?, created_at = ? WHERE id = ?", entity.getName(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM knowledge_tag WHERE id = ?", id);
    }

    @Override
    public KnowledgeTag findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM knowledge_tag WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<KnowledgeTag> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM knowledge_tag ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM knowledge_tag");
    }

    @Override
    public java.util.List<KnowledgeTag> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM knowledge_tag ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public KnowledgeTag findByName(String name) {
        // 按名称查询标签（不存在则供 Service 新建）
        return JdbcExecutor.queryOne(null, "SELECT * FROM knowledge_tag WHERE name = ?", MAPPER, name);
    }
}
