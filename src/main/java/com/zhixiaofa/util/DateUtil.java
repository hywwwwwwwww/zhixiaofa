package com.zhixiaofa.util;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Date;

/**
 * 日期格式化工具类（课程要求：日期格式化工具）。
 *
 * <p>统一项目中日期时间的解析与格式化，避免各处各写一套 SimpleDateFormat
 * （SimpleDateFormat 非线程安全，容易在多线程下出错）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class DateUtil {

    public static final String DATE_PATTERN = "yyyy-MM-dd";
    public static final String DATETIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern(DATE_PATTERN);
    private static final DateTimeFormatter DATETIME_FMT = DateTimeFormatter.ofPattern(DATETIME_PATTERN);

    private DateUtil() {
    }

    /** 当前时间 */
    public static LocalDateTime now() {
        return LocalDateTime.now();
    }

    /** 格式化为 yyyy-MM-dd HH:mm:ss */
    public static String format(LocalDateTime dateTime) {
        return dateTime == null ? null : dateTime.format(DATETIME_FMT);
    }

    /** 格式化为 yyyy-MM-dd */
    public static String format(LocalDate date) {
        return date == null ? null : date.format(DATE_FMT);
    }

    /** 解析 yyyy-MM-dd HH:mm:ss，失败返回 null（不抛异常，便于表单容错） */
    public static LocalDateTime parseDateTime(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        String s = text.trim();
        if (s.length() == 10) {
            LocalDate d = parseDate(s);
            return d == null ? null : d.atStartOfDay();
        }
        if (s.contains("T")) {
            s = s.replace('T', ' ');
        }
        try {
            return LocalDateTime.parse(s, DATETIME_FMT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** 解析 yyyy-MM-dd */
    public static LocalDate parseDate(String text) {
        if (text == null || text.trim().isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(text.trim(), DATE_FMT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    /** java.util.Date → LocalDateTime */
    public static LocalDateTime toLocalDateTime(Date date) {
        return date == null ? null : new java.sql.Timestamp(date.getTime()).toLocalDateTime();
    }

    /**
     * 计算两个时间相差的天数（用于「N 天前」展示）。
     */
    public static long daysBetween(LocalDateTime from, LocalDateTime to) {
        if (from == null || to == null) {
            return 0;
        }
        return ChronoUnit.DAYS.between(from, to);
    }

    /**
     * 友好时间：如「2小时前」「3天前」，用于问答列表展示。
     */
    public static String friendly(LocalDateTime dateTime) {
        if (dateTime == null) {
            return "";
        }
        LocalDateTime now = LocalDateTime.now();
        long seconds = ChronoUnit.SECONDS.between(dateTime, now);
        if (seconds < 0) {
            return format(dateTime);
        }
        if (seconds < 60) {
            return "刚刚";
        }
        long minutes = seconds / 60;
        if (minutes < 60) {
            return minutes + "分钟前";
        }
        long hours = minutes / 60;
        if (hours < 24) {
            return hours + "小时前";
        }
        long days = hours / 24;
        if (days < 30) {
            return days + "天前";
        }
        return dateTime.format(DateTimeFormatter.ofPattern("MM-dd"));
    }
}
