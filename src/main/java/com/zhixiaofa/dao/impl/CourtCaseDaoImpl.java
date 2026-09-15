package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.CourtCaseDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.CourtCase;
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
 * CourtCaseDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class CourtCaseDaoImpl implements CourtCaseDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：court_case 全字段 */
    static final RowMapper<CourtCase> MAPPER = rs -> {
        CourtCase x = new CourtCase();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setTitle(ResultSets.getString(rs, "title"));
        x.setDescription(ResultSets.getString(rs, "description"));
        x.setCaseType(ResultSets.getString(rs, "case_type"));
        x.setWinProbability(ResultSets.getBigDecimal(rs, "win_probability"));
        x.setCompensationMin(ResultSets.getBigDecimal(rs, "compensation_min"));
        x.setCompensationMax(ResultSets.getBigDecimal(rs, "compensation_max"));
        x.setSimilarCount(ResultSets.getInteger(rs, "similar_count"));
        x.setResultSummary(ResultSets.getString(rs, "result_summary"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        return x;
    };

    /** 带关联字段的映射（userNickname） */
    static final RowMapper<CourtCase> MAPPER_WITH_USER = rs -> {
        CourtCase x = MAPPER.map(rs);
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
    public Long insert(CourtCase entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO court_case (user_id, title, description, case_type, win_probability, compensation_min, compensation_max, similar_count, result_summary, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getUserId(), entity.getTitle(), entity.getDescription(), entity.getCaseType(), entity.getWinProbability(), entity.getCompensationMin(), entity.getCompensationMax(), entity.getSimilarCount(), entity.getResultSummary(), entity.getCreatedAt());
    }

    @Override
    public int update(CourtCase entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE court_case SET user_id = ?, title = ?, description = ?, case_type = ?, win_probability = ?, compensation_min = ?, compensation_max = ?, similar_count = ?, result_summary = ?, created_at = ? WHERE id = ?", entity.getUserId(), entity.getTitle(), entity.getDescription(), entity.getCaseType(), entity.getWinProbability(), entity.getCompensationMin(), entity.getCompensationMax(), entity.getSimilarCount(), entity.getResultSummary(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM court_case WHERE id = ?", id);
    }

    @Override
    public CourtCase findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM court_case WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<CourtCase> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM court_case ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM court_case");
    }

    @Override
    public java.util.List<CourtCase> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM court_case ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<CourtCase> findByUserId(Long userId, int offset, int limit) {
        // 某用户提交的案件分页
        return JdbcExecutor.queryList(null, "SELECT * FROM court_case WHERE user_id = ? ORDER BY id DESC LIMIT ?, ?", MAPPER, userId, offset, limit);
    }

    @Override
    public long countByUserId(Long userId) {
        // 某用户的案件数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM court_case WHERE user_id = ?", userId);
    }

    @Override
    public java.util.List<CourtCase> findByCondition(String keyword, String caseType, int offset, int limit) {
        // 后台案件分页
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("c.title, c.description", keyword)
                        .andEq("c.case_type", caseType);
                return JdbcExecutor.queryList(null,
                        "SELECT c.*, u.nickname AS user_nickname FROM court_case c"
                                + " LEFT JOIN sys_user u ON c.user_id = u.id WHERE 1=1" + sb.where()
                                + " ORDER BY c.id DESC LIMIT ?, ?",
                        MAPPER_WITH_USER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String caseType) {
        // 后台案件条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("c.title, c.description", keyword)
                        .andEq("c.case_type", caseType);
                return JdbcExecutor.queryCount(null,
                        "SELECT COUNT(*) FROM court_case c WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByType() {
        // 案件类型分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(case_type, '其他') AS label, COUNT(*) AS value FROM court_case GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> avgProbabilityByType() {
        // 各类案件平均胜诉率（柱状图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(case_type, '其他') AS label, ROUND(AVG(win_probability), 2) AS value FROM court_case GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 每日推演量
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM court_case WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }
}
