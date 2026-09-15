package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.Favorite;
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
 * FavoriteDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class FavoriteDaoImpl implements FavoriteDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：favorite 全字段 */
    static final RowMapper<Favorite> MAPPER = rs -> {
        Favorite x = new Favorite();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setTargetType(ResultSets.getString(rs, "target_type"));
        x.setTargetId(ResultSets.getLong(rs, "target_id"));
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
    public Long insert(Favorite entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO favorite (user_id, target_type, target_id, created_at) VALUES (?, ?, ?, ?)", entity.getUserId(), entity.getTargetType(), entity.getTargetId(), entity.getCreatedAt());
    }

    @Override
    public int update(Favorite entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE favorite SET user_id = ?, target_type = ?, target_id = ?, created_at = ? WHERE id = ?", entity.getUserId(), entity.getTargetType(), entity.getTargetId(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM favorite WHERE id = ?", id);
    }

    @Override
    public Favorite findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM favorite WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<Favorite> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM favorite ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM favorite");
    }

    @Override
    public java.util.List<Favorite> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM favorite ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public boolean exists(Long userId, String targetType, Long targetId) {
        // 判断是否已收藏
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM favorite WHERE user_id = ? AND target_type = ? AND target_id = ?", userId, targetType, targetId) > 0;
    }

    @Override
    public int deleteByTarget(Long userId, String targetType, Long targetId) {
        // 取消收藏
        return JdbcExecutor.update(null, "DELETE FROM favorite WHERE user_id = ? AND target_type = ? AND target_id = ?", userId, targetType, targetId);
    }

    @Override
    public java.util.List<Favorite> findByUserAndType(Long userId, String targetType, int offset, int limit) {
        // 某用户某类收藏分页
        return JdbcExecutor.queryList(null, "SELECT * FROM favorite WHERE user_id = ? AND target_type = ? ORDER BY id DESC LIMIT ?, ?", MAPPER, userId, targetType, offset, limit);
    }

    @Override
    public long countByUserAndType(Long userId, String targetType) {
        // 某用户某类收藏数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM favorite WHERE user_id = ? AND target_type = ?", userId, targetType);
    }

    @Override
    public long countByUser(Long userId) {
        // 某用户收藏总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM favorite WHERE user_id = ?", userId);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByType(Long userId) {
        // 收藏类型分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT target_type AS label, COUNT(*) AS value FROM favorite WHERE user_id = ? GROUP BY label", STATS_MAPPER, userId);
    }
}
