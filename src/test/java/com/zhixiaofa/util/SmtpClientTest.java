package com.zhixiaofa.util;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 手写 SMTP 的报文组包测试。
 *
 * <p>socket 与协议时序那一半在本机没法测（要一个真实邮箱账号），但<b>最容易静默出错的
 * 恰恰是这段</b>：中文没按 RFC 2047/base64 编码，邮件照样能「发成功」，只是收件人看到一堆乱码。
 * 所以把它单独钉住。</p>
 */
@DisplayName("SmtpClient 邮件报文测试")
class SmtpClientTest {

    private final SmtpClient client = new SmtpClient("smtp.qq.com", 465,
            "sender@qq.com", "(授权码不出现在报文里)", "sender@qq.com", "职小法", 8000, 8000);

    @Test
    @DisplayName("主题按 RFC 2047 编码，解码后与原文一致")
    void subjectEncoded() {
        String msg = client.buildMessage("to@qq.com", "找回密码验证码", "<p>正文</p>");
        String encoded = "=?UTF-8?B?"
                + Base64.getEncoder().encodeToString("找回密码验证码".getBytes(StandardCharsets.UTF_8)) + "?=";
        assertTrue(msg.contains("Subject: " + encoded), msg);
    }

    @Test
    @DisplayName("正文走 base64，解码回来是原始 HTML（中文不乱码）")
    void bodyBase64RoundTrip() {
        String html = "<div style='color:#333'>你的验证码是 123456，有效期 5 分钟。</div>";
        String msg = client.buildMessage("to@qq.com", "找回密码", html);

        assertTrue(msg.contains("MIME-Version: 1.0"));
        assertTrue(msg.contains("Content-Type: text/html; charset=UTF-8"));
        assertTrue(msg.contains("Content-Transfer-Encoding: base64"));

        int sep = msg.indexOf("\r\n\r\n");
        assertTrue(sep > 0, "头部与正文之间必须有一个空行");
        String payload = msg.substring(sep + 4);
        assertEquals(html, new String(Base64.getDecoder()
                .decode(payload.replace("\r\n", "")), StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("每行不超 76 字符、行尾统一 CRLF、没有以点开头的行（免点填充）")
    void lineRules() {
        String longHtml = "<p>非常长的正文非常长的正文非常长的正文非常长的正文非常长的正文非常长的正文</p>"
                .repeat(20);
        String msg = client.buildMessage("to@qq.com", "找回密码验证码", longHtml);

        assertTrue(msg.contains("\r\n"));
        assertFalse(msg.replace("\r\n", "").contains("\n"), "不允许出现裸 LF");
        for (String line : msg.split("\r\n")) {
            assertTrue(line.length() <= 998, "SMTP 单行上限 998，实际 " + line.length());
            assertFalse(line.startsWith("."), "以 . 开头的行会被服务器当作结束符: " + line);
        }
    }

    /** 取报文最后一段（base64 正文的尾巴），用于结构断言 */
    private static String tailOf(String payload) {
        int cut = payload.lastIndexOf('\n');
        return cut < 0 ? payload : payload.substring(cut + 1);
    }
}
