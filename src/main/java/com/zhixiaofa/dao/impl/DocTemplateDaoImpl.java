package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.DocTemplateDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.DocTemplate;
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
 * DocTemplateDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class DocTemplateDaoImpl implements DocTemplateDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：doc_template 全字段 */
    static final RowMapper<DocTemplate> MAPPER = rs -> {
        DocTemplate x = new DocTemplate();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setCode(ResultSets.getString(rs, "code"));
        x.setName(ResultSets.getString(rs, "name"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setDescription(ResultSets.getString(rs, "description"));
        x.setContentTemplate(ResultSets.getString(rs, "content_template"));
        x.setSortNo(ResultSets.getInteger(rs, "sort_no"));
        x.setEnabled(ResultSets.getInteger(rs, "enabled"));
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
    public Long insert(DocTemplate entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO doc_template (code, name, category, description, content_template, sort_no, enabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", entity.getCode(), entity.getName(), entity.getCategory(), entity.getDescription(), entity.getContentTemplate(), entity.getSortNo(), entity.getEnabled(), entity.getCreatedAt());
    }

    @Override
    public int update(DocTemplate entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE doc_template SET code = ?, name = ?, category = ?, description = ?, content_template = ?, sort_no = ?, enabled = ?, created_at = ? WHERE id = ?", entity.getCode(), entity.getName(), entity.getCategory(), entity.getDescription(), entity.getContentTemplate(), entity.getSortNo(), entity.getEnabled(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM doc_template WHERE id = ?", id);
    }

    @Override
    public DocTemplate findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM doc_template WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<DocTemplate> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_template ORDER BY sort_no", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM doc_template");
    }

    @Override
    public java.util.List<DocTemplate> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_template ORDER BY sort_no LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<DocTemplate> findEnabled() {
        // 前台可用模板（按排序号）
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_template WHERE enabled = 1 ORDER BY sort_no, id", MAPPER);
    }

    @Override
    public DocTemplate findByCode(String code) {
        // 按编码查询模板
        return JdbcExecutor.queryOne(null, "SELECT * FROM doc_template WHERE code = ?", MAPPER, code);
    }

    @Override
    public java.util.List<DocTemplate> findByCategory(String category) {
        // 按分类查询可用模板
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_template WHERE category = ? AND enabled = 1 ORDER BY sort_no", MAPPER, category);
    }

    @Override
    public java.util.List<DocTemplate> findByCondition(String keyword, String category, int offset, int limit) {
        // 后台模板分页
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("name, code, description", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM doc_template WHERE 1=1" + sb.where() + " ORDER BY sort_no, id LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category) {
        // 后台模板条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("name, code, description", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM doc_template WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 模板分类分布
        return JdbcExecutor.queryList(null, "SELECT IFNULL(category, '未分类') AS label, COUNT(*) AS value FROM doc_template GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }
}
