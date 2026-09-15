package com.zhixiaofa.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 密码工具单元测试：验证加盐哈希的核心安全性质。
 */
@DisplayName("PasswordUtil 密码加盐哈希测试")
class PasswordUtilTest {

    @Test
    @DisplayName("相同明文 + 相同盐 → 摘要稳定一致")
    void sameSaltAndPlainProducesSameDigest() {
        String salt = PasswordUtil.generateSalt();
        assertEquals(PasswordUtil.encrypt(salt, "abc12345"), PasswordUtil.encrypt(salt, "abc12345"));
    }

    @Test
    @DisplayName("相同明文 + 不同盐 → 摘要不同（防彩虹表）")
    void differentSaltProducesDifferentDigest() {
        String a = PasswordUtil.encrypt(PasswordUtil.generateSalt(), "abc12345");
        String b = PasswordUtil.encrypt(PasswordUtil.generateSalt(), "abc12345");
        assertNotEquals(a, b, "不同盐值必须产生不同摘要");
    }

    @Test
    @DisplayName("摘要为 64 位小写十六进制")
    void digestFormat() {
        String digest = PasswordUtil.encrypt("salt", "abc12345");
        assertEquals(64, digest.length());
        assertTrue(digest.matches("[0-9a-f]{64}"));
    }

    @Test
    @DisplayName("盐值为 32 位十六进制且不重复")
    void saltIsUnique() {
        Set<String> salts = new HashSet<>();
        for (int i = 0; i < 200; i++) {
            String salt = PasswordUtil.generateSalt();
            assertEquals(32, salt.length());
            assertTrue(salt.matches("[0-9a-f]{32}"));
            salts.add(salt);
        }
        assertEquals(200, salts.size(), "200 次生成的盐值不应出现重复");
    }

    @Test
    @DisplayName("matches：正确密码通过、错误密码拒绝")
    void matchesBehaviour() {
        String salt = PasswordUtil.generateSalt();
        String digest = PasswordUtil.encrypt(salt, "admin123");
        assertTrue(PasswordUtil.matches(salt, "admin123", digest));
        assertFalse(PasswordUtil.matches(salt, "admin124", digest));
        assertFalse(PasswordUtil.matches(salt, "admin123", null));
        assertFalse(PasswordUtil.matches(null, "admin123", digest + "x"));
    }

    @Test
    @DisplayName("null 明文按空串处理，不抛异常")
    void nullPlainIsSafe() {
        assertDoesNotThrow(() -> PasswordUtil.encrypt("salt", null));
        assertEquals(PasswordUtil.encrypt("salt", ""), PasswordUtil.encrypt("salt", null));
    }
}
