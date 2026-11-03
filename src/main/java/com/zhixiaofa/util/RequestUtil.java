package com.zhixiaofa.util;

import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.common.ResultCode;

import javax.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * 请求参数工具类：统一从 {@link HttpServletRequest} 中取参、做类型转换与必填校验。
 *
 * <p>目的是让 Servlet 里不再出现一堆 {@code Integer.parseInt(request.getParameter(...))}
 * 和重复的 try/catch，同时对非法参数统一抛 {@link BizException}。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class RequestUtil {

    private RequestUtil() {
    }

    /** 取字符串，null 安全 */
    public static String getString(HttpServletRequest req, String name) {
        String v = req.getParameter(name);
        return v == null ? null : v.trim();
    }

    /** 取字符串，为空时抛参数异常 */
    public static String require(HttpServletRequest req, String name) {
        String v = getString(req, name);
        if (StringUtil.isEmpty(v)) {
            throw new BizException(ResultCode.PARAM_ERROR, "参数 " + name + " 不能为空");
        }
        return v;
    }

    /** 取整数，缺省或非法时返回默认值 */
    public static int getInt(HttpServletRequest req, String name, int defaultValue) {
        String v = getString(req, name);
        if (StringUtil.isEmpty(v)) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    /** 取整数，缺省或非法时抛参数异常 */
    public static int requireInt(HttpServletRequest req, String name) {
        String v = require(req, name);
        try {
            return Integer.parseInt(v);
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "参数 " + name + " 必须是整数");
        }
    }

    public static Long getLong(HttpServletRequest req, String name) {
        String v = getString(req, name);
        if (StringUtil.isEmpty(v)) {
            return null;
        }
        try {
            return Long.parseLong(v);
        } catch (NumberFormatException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "参数 " + name + " 必须是数字");
        }
    }

    public static long requireLong(HttpServletRequest req, String name) {
        Long v = getLong(req, name);
        if (v == null) {
            throw new BizException(ResultCode.PARAM_ERROR, "参数 " + name + " 不能为空");
        }
        return v;
    }

    public static boolean getBool(HttpServletRequest req, String name, boolean defaultValue) {
        String v = getString(req, name);
        if (StringUtil.isEmpty(v)) {
            return defaultValue;
        }
        return "true".equalsIgnoreCase(v) || "1".equals(v) || "on".equalsIgnoreCase(v);
    }

    /**
     * 取页码（从 1 开始），非法则返回 1。
     */
    public static int getPageNum(HttpServletRequest req) {
        int n = getInt(req, "pageNum", 1);
        return n < 1 ? 1 : n;
    }

    /**
     * 取每页条数，受 {@code page.maxSize} 限制，防止恶意大分页。
     */
    public static int getPageSize(HttpServletRequest req) {
        int defaultSize = DBUtil.getInt("page.defaultSize", 10);
        int maxSize = DBUtil.getInt("page.maxSize", 100);
        int n = getInt(req, "pageSize", defaultSize);
        if (n < 1) {
            n = defaultSize;
        }
        return Math.min(n, maxSize);
    }

    /**
     * 读取请求体（UTF-8 文本），用于接收前端提交的 JSON。
     */
    public static String readBody(HttpServletRequest req) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader reader = req.getReader()) {
            String line;
            while ((line = reader.readLine()) != null) {
                sb.append(line);
            }
        } catch (IOException e) {
            throw new BizException(ResultCode.PARAM_ERROR, "读取请求体失败: " + e.getMessage());
        }
        return sb.toString();
    }

    /**
     * 把请求参数收集成 Map，主要用于操作日志留痕（已过滤密码等敏感字段）。
     */
    public static Map<String, String> collectForLog(HttpServletRequest req) {
        Map<String, String> map = new HashMap<>();
        req.getParameterMap().forEach((k, v) -> {
            if (isSensitive(k)) {
                map.put(k, "***");
            } else if (v != null && v.length > 0) {
                map.put(k, StringUtil.abbreviate(StringUtil.oneLine(v[0]), 200));
            }
        });
        return map;
    }

    private static boolean isSensitive(String key) {
        String k = key.toLowerCase();
        return k.contains("password") || k.contains("pwd") || k.contains("token")
                || k.contains("secret") || k.contains("salt")
                // 找回密码的验证码本身就是一次性凭证，落进操作日志等于把码又发了一遍。
                // 参数名叫 verifyCode 而不叫 code，是为了不牵连文书模板的「编码 code」字段
                || k.contains("verifycode") || k.contains("captcha");
    }

    /**
     * 取客户端真实 IP（兼容 Nginx 反向代理场景）。
     */
    public static String getClientIp(HttpServletRequest req) {
        String[] headers = {"X-Forwarded-For", "X-Real-IP", "Proxy-Client-IP", "WL-Proxy-Client-IP"};
        for (String h : headers) {
            String ip = req.getHeader(h);
            if (StringUtil.isNotEmpty(ip) && !"unknown".equalsIgnoreCase(ip)) {
                int idx = ip.indexOf(',');
                return idx > 0 ? ip.substring(0, idx).trim() : ip.trim();
            }
        }
        return req.getRemoteAddr();
    }
}
