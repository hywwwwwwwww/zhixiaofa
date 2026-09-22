package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.OperationLogDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.OperationLog;
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
 * OperationLogDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class OperationLogDaoImpl implements OperationLogDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：operation_log 全字段 */
    static final RowMapper<OperationLog> MAPPER = rs -> {
        OperationLog x = new OperationLog();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setUsername(ResultSets.getString(rs, "username"));
        x.setAction(ResultSets.getString(rs, "action"));
        x.setMethod(ResultSets.getString(rs, "method"));
        x.setUri(ResultSets.getString(rs, "uri"));
        x.setIp(ResultSets.getString(rs, "ip"));
        x.setParams(ResultSets.getString(rs, "params"));
        x.setCostMs(ResultSets.getLong(rs, "cost_ms"));
        x.setStatus(ResultSets.getInteger(rs, "status"));
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
    public Long insert(OperationLog entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO operation_log (user_id, username, action, method, uri, ip, params, cost_ms, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getUserId(), entity.getUsername(), entity.getAction(), entity.getMethod(), entity.getUri(), entity.getIp(), entity.getParams(), entity.getCostMs(), entity.getStatus(), entity.getCreatedAt());
    }

    @Override
    public int update(OperationLog entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE operation_log SET user_id = ?, username = ?, action = ?, method = ?, uri = ?, ip = ?, params = ?, cost_ms = ?, status = ?, created_at = ? WHERE id = ?", entity.getUserId(), entity.getUsername(), entity.getAction(), entity.getMethod(), entity.getUri(), entity.getIp(), entity.getParams(), entity.getCostMs(), entity.getStatus(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM operation_log WHERE id = ?", id);
    }

    @Override
    public OperationLog findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM operation_log WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<OperationLog> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM operation_log ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM operation_log");
    }

    @Override
    public java.util.List<OperationLog> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM operation_log ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    /** 日志列表可排序的列：前端列名 → 真实列名（白名单，防止 SQL 注入） */
    private static final java.util.Map<String, String> SORTABLE = java.util.Map.of(
            "id", "id",
            "costMs", "cost_ms",
            "createdAt", "created_at");

    /** 默认排序：按 id 倒序（最新在前） */
    private static final String DEFAULT_ORDER = "id DESC";

    @Override
    public java.util.List<OperationLog> findByCondition(String keyword, String method, int offset, int limit) {
        return findByCondition(keyword, method, offset, limit, null, null);
    }

    @Override
    public java.util.List<OperationLog> findByCondition(String keyword, String method, int offset, int limit,
                                                        String sortName, String sortOrder) {
        // 后台日志分页（关键词 + 方法 + 可选排序）
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("username, uri, action", keyword)
                        .andEq("method", method);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM operation_log WHERE 1=1" + sb.where()
                                + SqlBuilder.orderBy(sortName, sortOrder, SORTABLE, DEFAULT_ORDER)
                                + " LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String method) {
        // 后台日志条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("username, uri, action", keyword)
                        .andEq("method", method);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM operation_log WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 每日请求量（折线图）
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM operation_log WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByUri(int topN) {
        // 接口调用排行
        return JdbcExecutor.queryList(null, "SELECT uri AS label, COUNT(*) AS value FROM operation_log GROUP BY label ORDER BY value DESC LIMIT ?", STATS_MAPPER, topN);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> avgCostByUri(int topN) {
        // 接口平均耗时（性能监控）
        return JdbcExecutor.queryList(null, "SELECT uri AS label, ROUND(AVG(cost_ms), 1) AS value FROM operation_log GROUP BY label ORDER BY value DESC LIMIT ?", STATS_MAPPER, topN);
    }

    @Override
    public int deleteBefore(int days) {
        // 清理 N 天前的日志
        return JdbcExecutor.update(null, "DELETE FROM operation_log WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)", days);
    }
}
