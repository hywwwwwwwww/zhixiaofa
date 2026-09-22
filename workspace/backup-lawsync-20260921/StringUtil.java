package com.zhixiaofa.util;

import java.util.regex.Pattern;

/**
 * 字符串工具类：空值判断、必填校验、转义等。
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class StringUtil {

    /** 用户名：字母开头，允许字母数字下划线，4~20 位 */
    private static final Pattern USERNAME = Pattern.compile("^[A-Za-z][A-Za-z0-9_]{3,19}$");
    /** 邮箱 */
    private static final Pattern EMAIL = Pattern.compile("^[\\w.%+-]+@[\\w.-]+\\.[A-Za-z]{2,}$");
    /** 手机号（中国大陆） */
    private static final Pattern PHONE = Pattern.compile("^1[3-9]\\d{9}$");
    /** 危险字符：用于日志脱敏时的兜底 */
    private static final Pattern HTML_TAG = Pattern.compile("<[^>]*>");

    private StringUtil() {
    }

    public static boolean isEmpty(String s) {
        return s == null || s.trim().isEmpty();
    }

    public static boolean isNotEmpty(String s) {
        return !isEmpty(s);
    }

    /** 空则返回默认值 */
    public static String defaultIfEmpty(String s, String defaultValue) {
        return isEmpty(s) ? defaultValue : s.trim();
    }

    /** 去掉首尾空白，null 安全 */
    public static String trim(String s) {
        return s == null ? null : s.trim();
    }

    /** 截断，超长加省略号，用于日志 */
    public static String abbreviate(String s, int maxLength) {
        if (s == null) {
            return null;
        }
        return s.length() <= maxLength ? s : s.substring(0, maxLength) + "...";
    }

    public static boolean isUsername(String s) {
        return isNotEmpty(s) && USERNAME.matcher(s.trim()).matches();
    }

    public static boolean isEmail(String s) {
        return isNotEmpty(s) && EMAIL.matcher(s.trim()).matches();
    }

    public static boolean isPhone(String s) {
        return isNotEmpty(s) && PHONE.matcher(s.trim()).matches();
    }

    /** 去除 HTML 标签，防止富文本注入到页面（XSS 防护的第一道） */
    public static String stripHtml(String s) {
        if (s == null) {
            return null;
        }
        return HTML_TAG.matcher(s).replaceAll("");
    }

    /**
     * 把可能包含换行的文本压成单行，用于日志中记录参数。
     */
    public static String oneLine(String s) {
        if (s == null) {
            return null;
        }
        return s.replaceAll("[\r\n\t]+", " ").trim();
    }
}
