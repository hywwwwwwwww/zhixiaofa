package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.SysUser;
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
 * SysUserDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class SysUserDaoImpl implements SysUserDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：sys_user 全字段 */
    static final RowMapper<SysUser> MAPPER = rs -> {
        SysUser x = new SysUser();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUsername(ResultSets.getString(rs, "username"));
        x.setPassword(ResultSets.getString(rs, "password"));
        x.setSalt(ResultSets.getString(rs, "salt"));
        x.setNickname(ResultSets.getString(rs, "nickname"));
        x.setEmail(ResultSets.getString(rs, "email"));
        x.setPhone(ResultSets.getString(rs, "phone"));
        x.setAvatar(ResultSets.getString(rs, "avatar"));
        x.setRole(ResultSets.getString(rs, "role"));
        x.setStatus(ResultSets.getInteger(rs, "status"));
        x.setCity(ResultSets.getString(rs, "city"));
        x.setJobTitle(ResultSets.getString(rs, "job_title"));
        x.setLastLoginAt(ResultSets.getLocalDateTime(rs, "last_login_at"));
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
    public Long insert(SysUser entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO sys_user (username, password, salt, nickname, email, phone, avatar, role, status, city, job_title, last_login_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getUsername(), entity.getPassword(), entity.getSalt(), entity.getNickname(), entity.getEmail(), entity.getPhone(), entity.getAvatar(), entity.getRole(), entity.getStatus(), entity.getCity(), entity.getJobTitle(), entity.getLastLoginAt(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(SysUser entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE sys_user SET username = ?, password = ?, salt = ?, nickname = ?, email = ?, phone = ?, avatar = ?, role = ?, status = ?, city = ?, job_title = ?, last_login_at = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getUsername(), entity.getPassword(), entity.getSalt(), entity.getNickname(), entity.getEmail(), entity.getPhone(), entity.getAvatar(), entity.getRole(), entity.getStatus(), entity.getCity(), entity.getJobTitle(), entity.getLastLoginAt(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM sys_user WHERE id = ?", id);
    }

    @Override
    public SysUser findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM sys_user WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<SysUser> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM sys_user ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM sys_user");
    }

    @Override
    public java.util.List<SysUser> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM sys_user ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    /** 用户列表可排序的列：前端列名 → 真实列名（白名单，防止 SQL 注入） */
    private static final java.util.Map<String, String> SORTABLE = java.util.Map.of(
            "id", "id",
            "createdAt", "created_at",
            "lastLoginAt", "last_login_at");

    /** 默认排序：按 id 倒序（最新注册在前） */
    private static final String DEFAULT_ORDER = "id DESC";

    @Override
    public SysUser findByUsername(String username) {
        // 按登录名查询，用于登录与唯一性校验
        return JdbcExecutor.queryOne(null, "SELECT * FROM sys_user WHERE username = ?", MAPPER, username);
    }

    @Override
    public SysUser findByEmail(String email) {
        // 按邮箱查询，用于注册去重
        return JdbcExecutor.queryOne(null, "SELECT * FROM sys_user WHERE email = ?", MAPPER, email);
    }

    @Override
    public int updateLastLogin(Long id, LocalDateTime lastLoginAt) {
        // 登录成功后更新最近登录时间
        return JdbcExecutor.update(null, "UPDATE sys_user SET last_login_at = ? WHERE id = ?", lastLoginAt, id);
    }

    @Override
    public int updateStatus(Long id, Integer status) {
        // 启用 / 禁用账号
        return JdbcExecutor.update(null, "UPDATE sys_user SET status = ? WHERE id = ?", status, id);
    }

    @Override
    public int updatePassword(Long id, String password, String salt) {
        // 重置密码（同时换新盐）
        return JdbcExecutor.update(null, "UPDATE sys_user SET password = ?, salt = ? WHERE id = ?", password, salt, id);
    }

    @Override
    public java.util.List<SysUser> findByCondition(String keyword, String role, Integer status, int offset, int limit) {
        return findByCondition(keyword, role, status, offset, limit, null, null);
    }

    @Override
    public java.util.List<SysUser> findByCondition(String keyword, String role, Integer status,
                                                    int offset, int limit, String sortName, String sortOrder) {
        // 后台用户列表分页（关键词 / 角色 / 状态 组合查询 + 可选列头排序）
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("username, nickname, email, phone", keyword)
                        .andEq("role", role)
                        .andEq("status", status);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM sys_user WHERE 1=1" + sb.where()
                                + SqlBuilder.orderBy(sortName, sortOrder, SORTABLE, DEFAULT_ORDER)
                                + " LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String role, Integer status) {
        // 后台用户列表条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("username, nickname, email, phone", keyword)
                        .andEq("role", role)
                        .andEq("status", status);
                return JdbcExecutor.queryCount(null,
                        "SELECT COUNT(*) FROM sys_user WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 注册趋势（折线图）
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM sys_user WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByRole() {
        // 角色分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT role AS label, COUNT(*) AS value FROM sys_user GROUP BY label", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCity() {
        // 地域分布（柱状图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(city, '未填写') AS label, COUNT(*) AS value FROM sys_user GROUP BY label ORDER BY value DESC LIMIT 10", STATS_MAPPER);
    }
}
