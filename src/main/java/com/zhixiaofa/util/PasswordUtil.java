package com.zhixiaofa.util;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;

/**
 * 密码工具类：SHA-256 加盐摘要。
 *
 * <p>安全说明（课程加分项：安全防护措施）：</p>
 * <ul>
 *   <li>数据库中不存明文密码，只存 {@code SHA-256(salt + 明文)} 的十六进制摘要；</li>
 *   <li>每个用户独立随机盐值，相同明文得到不同摘要，防止彩虹表批量破解；</li>
 *   <li>校验时用摘要比对，并采用常量时间比较避免时序攻击。</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class PasswordUtil {

    private static final char[] HEX = "0123456789abcdef".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private PasswordUtil() {
    }

    /**
     * 生成 16 字节随机盐值（32 位十六进制字符串）。
     */
    public static String generateSalt() {
        byte[] bytes = new byte[16];
        RANDOM.nextBytes(bytes);
        return toHex(bytes);
    }

    /**
     * 计算密码摘要。
     *
     * @param salt    盐值
     * @param plain   明文密码
     * @return 64 位十六进制摘要
     */
    public static String encrypt(String salt, String plain) {
        if (plain == null) {
            plain = "";
        }
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            digest.update((salt == null ? "" : salt).getBytes(java.nio.charset.StandardCharsets.UTF_8));
            digest.update(plain.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return toHex(digest.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("当前 JVM 不支持 SHA-256", e);
        }
    }

    /**
     * 校验密码是否匹配。
     *
     * @param salt      数据库中的盐值
     * @param plain     用户输入的明文
     * @param expected  数据库中的摘要
     * @return 是否一致
     */
    public static boolean matches(String salt, String plain, String expected) {
        String actual = encrypt(salt, plain);
        return constantTimeEquals(actual, expected);
    }

    /** 常量时间字符串比较，避免通过响应时间推测摘要 */
    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] x = a.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        byte[] y = b.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        if (x.length != y.length) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < x.length; i++) {
            diff |= x[i] ^ y[i];
        }
        return diff == 0;
    }

    private static String toHex(byte[] bytes) {
        char[] out = new char[bytes.length * 2];
        for (int i = 0; i < bytes.length; i++) {
            int v = bytes[i] & 0xFF;
            out[i * 2] = HEX[v >>> 4];
            out[i * 2 + 1] = HEX[v & 0x0F];
        }
        return new String(out);
    }
}
