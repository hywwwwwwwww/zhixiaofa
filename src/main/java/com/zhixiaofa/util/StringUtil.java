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

    /**
     * 解析条号中的中文数字，用于按条文自然顺序排序。
     *
     * <p>例：「第十条」→ 10，「第二十三条」→ 23，「第一百零一条」→ 101。
     * 无法解析时返回 {@link Integer#MAX_VALUE}，使其排在最后。</p>
     *
     * @param articleNo 条号，如「第十条」
     * @return 对应的阿拉伯数字
     */
    public static int parseArticleNo(String articleNo) {
        if (isEmpty(articleNo)) {
            return Integer.MAX_VALUE;
        }
        // 只取「第…条」之间的数字部分
        int start = articleNo.indexOf('第');
        int end = articleNo.lastIndexOf('条');
        String numPart = (start >= 0 && end > start) ? articleNo.substring(start + 1, end) : articleNo;

        int section = 0;
        int number = 0;
        for (char c : numPart.toCharArray()) {
            int digit = chineseDigit(c);
            if (digit >= 0) {
                number = digit;
            } else if (c == '十') {
                section += (number == 0 ? 1 : number) * 10;
                number = 0;
            } else if (c == '百') {
                section += (number == 0 ? 1 : number) * 100;
                number = 0;
            } else if (c == '千') {
                section += (number == 0 ? 1 : number) * 1000;
                number = 0;
            }
        }
        int value = section + number;
        return value == 0 ? Integer.MAX_VALUE : value;
    }

    /** 中文数字字符 → 阿拉伯数字，非数字返回 -1 */
    private static int chineseDigit(char c) {
        switch (c) {
            case '一': return 1;
            case '二': return 2;
            case '三': return 3;
            case '四': return 4;
            case '五': return 5;
            case '六': return 6;
            case '七': return 7;
            case '八': return 8;
            case '九': return 9;
            case '零': return 0;
            default: return -1;
        }
    }
}
