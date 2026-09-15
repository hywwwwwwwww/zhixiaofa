package com.zhixiaofa.util;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * {@link ResultSet} 读取辅助类：把「取列 + 判空 + 转换」收敛为一行，
 * 让 RowMapper 的代码保持短小可读。
 *
 * <p>解决的问题：{@code rs.getLong("x")} 在列值为 NULL 时返回 0 而不是 null，
 * 对于可空外键（如 contract_risk.law_id）会造成「0 而非 null」的脏数据。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class ResultSets {

    private ResultSets() {
    }

    /** 读 Long，列值为 NULL 时返回 null */
    public static Long getLong(ResultSet rs, String column) throws SQLException {
        long v = rs.getLong(column);
        return rs.wasNull() ? null : Long.valueOf(v);
    }

    public static long getLongValue(ResultSet rs, String column) throws SQLException {
        return rs.getLong(column);
    }

    /** 读 Integer，列值为 NULL 时返回 null */
    public static Integer getInteger(ResultSet rs, String column) throws SQLException {
        int v = rs.getInt(column);
        return rs.wasNull() ? null : Integer.valueOf(v);
    }

    public static int getIntValue(ResultSet rs, String column) throws SQLException {
        return rs.getInt(column);
    }

    /** 读字符串并去掉首尾空白 */
    public static String getString(ResultSet rs, String column) throws SQLException {
        String v = rs.getString(column);
        return v == null ? null : v.trim();
    }

    /** 读 DECIMAL，列值为 NULL 时返回 null */
    public static BigDecimal getBigDecimal(ResultSet rs, String column) throws SQLException {
        return rs.getBigDecimal(column);
    }

    /** 读 DATETIME/TIMESTAMP → LocalDateTime */
    public static LocalDateTime getLocalDateTime(ResultSet rs, String column) throws SQLException {
        Timestamp ts = rs.getTimestamp(column);
        return ts == null ? null : ts.toLocalDateTime();
    }

    /** 读 DATE → LocalDate */
    public static LocalDate getLocalDate(ResultSet rs, String column) throws SQLException {
        java.sql.Date d = rs.getDate(column);
        return d == null ? null : d.toLocalDate();
    }

    /** 读布尔型 TINYINT(1) */
    public static boolean getBoolean(ResultSet rs, String column) throws SQLException {
        return rs.getBoolean(column);
    }
}
