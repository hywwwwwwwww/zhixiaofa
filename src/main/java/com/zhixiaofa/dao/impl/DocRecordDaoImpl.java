package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.DocRecord;
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
 * DocRecordDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class DocRecordDaoImpl implements DocRecordDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：doc_record 全字段 */
    static final RowMapper<DocRecord> MAPPER = rs -> {
        DocRecord x = new DocRecord();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setTemplateId(ResultSets.getLong(rs, "template_id"));
        x.setTitle(ResultSets.getString(rs, "title"));
        x.setParamsJson(ResultSets.getString(rs, "params_json"));
        x.setContent(ResultSets.getString(rs, "content"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        x.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
        return x;
    };

    /** 带关联字段的映射（templateName） */
    static final RowMapper<DocRecord> MAPPER_WITH_TEMPLATE = rs -> {
        DocRecord x = MAPPER.map(rs);
        x.setTemplateName(ResultSets.getString(rs, "template_name"));
        return x;
    };

    /** 带关联字段的映射（templateName, userNickname） */
    static final RowMapper<DocRecord> MAPPER_FULL = rs -> {
        DocRecord x = MAPPER.map(rs);
        x.setTemplateName(ResultSets.getString(rs, "template_name"));
        x.setUserNickname(ResultSets.getString(rs, "user_nickname"));
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
    public Long insert(DocRecord entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO doc_record (user_id, template_id, title, params_json, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)", entity.getUserId(), entity.getTemplateId(), entity.getTitle(), entity.getParamsJson(), entity.getContent(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(DocRecord entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE doc_record SET user_id = ?, template_id = ?, title = ?, params_json = ?, content = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getUserId(), entity.getTemplateId(), entity.getTitle(), entity.getParamsJson(), entity.getContent(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM doc_record WHERE id = ?", id);
    }

    @Override
    public DocRecord findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM doc_record WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<DocRecord> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_record ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM doc_record");
    }

    @Override
    public java.util.List<DocRecord> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM doc_record ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<DocRecord> findByUserId(Long userId, int offset, int limit) {
        // 某用户的文书分页（关联模板名）
        return JdbcExecutor.queryList(null,
                        "SELECT d.*, t.name AS template_name FROM doc_record d"
                                + " LEFT JOIN doc_template t ON d.template_id = t.id"
                                + " WHERE d.user_id = ? ORDER BY d.id DESC LIMIT ?, ?", MAPPER_WITH_TEMPLATE, userId, offset, limit);
    }

    @Override
    public long countByUserId(Long userId) {
        // 某用户的文书数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM doc_record WHERE user_id = ?", userId);
    }

    @Override
    public java.util.List<DocRecord> findByCondition(String keyword, Long userId, int offset, int limit) {
        // 后台文书分页（含所属用户）
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("d.title, d.content", keyword)
                        .andEq("d.user_id", userId);
                return JdbcExecutor.queryList(null,
                        "SELECT d.*, t.name AS template_name, u.nickname AS user_nickname FROM doc_record d"
                                + " LEFT JOIN doc_template t ON d.template_id = t.id"
                                + " LEFT JOIN sys_user u ON d.user_id = u.id WHERE 1=1" + sb.where()
                                + " ORDER BY d.id DESC LIMIT ?, ?", MAPPER_FULL, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, Long userId) {
        // 后台文书条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("d.title, d.content", keyword)
                        .andEq("d.user_id", userId);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM doc_record d WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public DocRecord findByIdWithDetail(Long id) {
        // 单条文书详情（含模板名与所属用户昵称）
        return JdbcExecutor.queryOne(null,
                        "SELECT d.*, t.name AS template_name, u.nickname AS user_nickname FROM doc_record d"
                                + " LEFT JOIN doc_template t ON d.template_id = t.id"
                                + " LEFT JOIN sys_user u ON d.user_id = u.id WHERE d.id = ?", MAPPER_FULL, id);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 每日文书生成量
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM doc_record WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> topTemplates(int limit) {
        // 模板使用排行
        return JdbcExecutor.queryList(null, "SELECT t.name AS label, COUNT(*) AS value FROM doc_record d INNER JOIN doc_template t ON d.template_id = t.id GROUP BY t.id ORDER BY value DESC LIMIT ?", STATS_MAPPER, limit);
    }
}
