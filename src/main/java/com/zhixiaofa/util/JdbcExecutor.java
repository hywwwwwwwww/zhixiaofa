package com.zhixiaofa.util;

import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.exception.DaoException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * 轻量 JDBC 执行模板：抽取 DAO 层中重复的「取连接 → 设置参数 → 执行 → 释放」模板代码。
 *
 * <p>安全要点：全部使用 {@link PreparedStatement} 预编译，参数走占位符绑定，
 * 从根本上防止 SQL 注入（不允许把用户输入拼进 SQL 字符串）。</p>
 *
 * <p>事务支持：{@link #inTransaction(TxCallback)} 把多条 DML 放在同一连接、
 * 同一事务里执行，任一异常都回滚。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class JdbcExecutor {

    private static final Logger log = LoggerFactory.getLogger(JdbcExecutor.class);

    private JdbcExecutor() {
    }

    /** 事务回调 */
    @FunctionalInterface
    public interface TxCallback<T> {
        T execute(Connection conn) throws SQLException;
    }

    /**
     * 在当前连接上执行查询并映射为列表。
     *
     * @param conn   连接（由调用方管理生命周期；传 null 表示自管理）
     * @param sql    SQL 语句，占位符用 ?
     * @param mapper 行映射器
     * @param params 参数
     * @param <T>    实体类型
     * @return 结果列表，永不为 null
     */
    public static <T> List<T> queryList(Connection conn, String sql, RowMapper<T> mapper, Object... params) {
        boolean own = (conn == null);
        Connection c = own ? open() : conn;
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            fill(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                List<T> list = new ArrayList<>();
                while (rs.next()) {
                    list.add(mapper.map(rs));
                }
                return list;
            }
        } catch (SQLException e) {
            throw new DaoException("查询失败: " + sql, e);
        } finally {
            if (own) {
                closeQuietly(c);
            }
        }
    }

    /**
     * 查询单条记录，无结果返回 null。
     */
    public static <T> T queryOne(Connection conn, String sql, RowMapper<T> mapper, Object... params) {
        List<T> list = queryList(conn, sql, mapper, params);
        return list.isEmpty() ? null : list.get(0);
    }

    /**
     * 执行 INSERT / UPDATE / DELETE。
     *
     * @return 受影响行数
     */
    public static int update(Connection conn, String sql, Object... params) {
        boolean own = (conn == null);
        Connection c = own ? open() : conn;
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            fill(ps, params);
            return ps.executeUpdate();
        } catch (SQLException e) {
            throw new DaoException("更新失败: " + sql, e);
        } finally {
            if (own) {
                closeQuietly(c);
            }
        }
    }

    /**
     * 插入并返回自增主键。
     */
    public static long insertAndReturnKey(Connection conn, String sql, Object... params) {
        boolean own = (conn == null);
        Connection c = own ? open() : conn;
        try (PreparedStatement ps = c.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
            fill(ps, params);
            ps.executeUpdate();
            try (ResultSet keys = ps.getGeneratedKeys()) {
                return keys.next() ? keys.getLong(1) : 0L;
            }
        } catch (SQLException e) {
            throw new DaoException("插入失败: " + sql, e);
        } finally {
            if (own) {
                closeQuietly(c);
            }
        }
    }

    /**
     * 统计查询，返回单个数值（COUNT / SUM 等）。
     */
    public static long queryCount(Connection conn, String sql, Object... params) {
        boolean own = (conn == null);
        Connection c = own ? open() : conn;
        try (PreparedStatement ps = c.prepareStatement(sql)) {
            fill(ps, params);
            try (ResultSet rs = ps.executeQuery()) {
                return rs.next() ? rs.getLong(1) : 0L;
            }
        } catch (SQLException e) {
            throw new DaoException("统计失败: " + sql, e);
        } finally {
            if (own) {
                closeQuietly(c);
            }
        }
    }

    /**
     * 在事务中执行多条 DML：正常提交，异常回滚。
     *
     * @param callback 事务体
     * @param <T>      返回值类型
     * @return 事务体返回值
     */
    public static <T> T inTransaction(TxCallback<T> callback) {
        Connection c = open();
        boolean oldAutoCommit = true;
        try {
            oldAutoCommit = c.getAutoCommit();
            c.setAutoCommit(false);
            T result = callback.execute(c);
            c.commit();
            return result;
        } catch (SQLException e) {
            try {
                c.rollback();
            } catch (SQLException re) {
                log.error("事务回滚失败", re);
            }
            throw new DaoException("事务执行失败", e);
        } finally {
            try {
                c.setAutoCommit(oldAutoCommit);
            } catch (SQLException ignore) {
                // ignore
            }
            closeQuietly(c);
        }
    }

    // ------------------------------------------------------------------ 内部方法

    private static Connection open() {
        try {
            return DBUtil.getConnection();
        } catch (SQLException e) {
            throw new DaoException("获取数据库连接失败", e);
        }
    }

    private static void fill(PreparedStatement ps, Object... params) throws SQLException {
        if (params == null) {
            return;
        }
        for (int i = 0; i < params.length; i++) {
            Object p = params[i];
            if (p == null) {
                ps.setObject(i + 1, null);
            } else if (p instanceof java.util.Date) {
                ps.setTimestamp(i + 1, new java.sql.Timestamp(((java.util.Date) p).getTime()));
            } else if (p instanceof java.time.LocalDateTime) {
                ps.setTimestamp(i + 1, java.sql.Timestamp.valueOf((java.time.LocalDateTime) p));
            } else if (p instanceof java.time.LocalDate) {
                ps.setDate(i + 1, java.sql.Date.valueOf((java.time.LocalDate) p));
            } else {
                ps.setObject(i + 1, p);
            }
        }
    }

    private static void closeQuietly(Connection c) {
        if (c == null) {
            return;
        }
        try {
            c.close();
        } catch (SQLException ignore) {
            // ignore
        }
    }
}
