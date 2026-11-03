package com.zhixiaofa.util;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Base64;
import java.util.Locale;

import javax.net.ssl.SSLContext;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * 极简 SMTP 客户端：只实现「发一封验证码邮件」所需的那几个指令。
 *
 * <h3>为什么不引 JavaMail</h3>
 * <p>与 {@link com.zhixiaofa.service.impl.LlmClient} 同一取向 —— 能用 JDK 自带能力就不加依赖。
 * 本类只用 {@code javax.net.ssl}、{@code java.util.Base64} 与 {@code Socket}，
 * {@code pom.xml} 零改动。（JavaMail 2.0+ 还把包名换成了 {@code jakarta.*}，
 * 与本项目 {@code javax.servlet} 的 Tomcat 9 运行期不匹配，只能用 1.6.x 过渡版。）</p>
 *
 * <h3>只支持 465 隐式 SSL</h3>
 * <p>465 是「连上就是 TLS」，直接 {@link SSLSocket} 握手即可；587 要先明文 {@code EHLO}
 * 再 {@code STARTTLS} 升级，握手时序复杂一倍。QQ / 163 / Gmail 都开放 465，因此不实现 587。</p>
 * <p>证书校验开着（{@code EndpointIdentificationAlgorithm = "HTTPS"}）——
 * 关掉它等于把授权码明文交给中间人，这不能为了「连上某些自签证书的内网服务器」而妥协。</p>
 *
 * <h3>安全边界</h3>
 * <p>认证异常信息里<b>不包含</b>我们发出的任何命令内容，服务器响应也不会回显密码，
 * 因此日志里出现响应文本是安全的；但 {@link MailConfig#password()} 本身绝不入日志。</p>
 *
 * <p>一次连接发一封：不做连接复用。找回密码是低频动作，连接池带来的复杂度换不到收益。</p>
 */
public final class SmtpClient {

    /** RFC 2822 的 Date 头格式，必须带时区偏移 */
    private static final DateTimeFormatter RFC1123 =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy HH:mm:ss Z", Locale.US);

    /** base64 正文每行最大长度（RFC 2045 要求 ≤ 76） */
    private static final int B64_LINE = 76;

    private static final String CRLF = "\r\n";

    private final String host;
    private final int port;
    private final String username;
    private final String password;
    private final String from;
    private final String fromName;
    private final int connectTimeoutMs;
    private final int readTimeoutMs;

    /**
     * @param host             SMTP 服务器地址，如 {@code smtp.qq.com}
     * @param port             端口，本项目仅支持 465（隐式 SSL）
     * @param username         发信邮箱账号
     * @param password         该账号的 <b>SMTP 授权码</b>（不是邮箱登录密码）
     * @param from             信封发信人，QQ / 163 要求与 username 一致
     * @param fromName         收件人显示名
     * @param connectTimeoutMs 建连超时
     * @param readTimeoutMs    单次读响应超时
     */
    public SmtpClient(String host, int port, String username, String password, String from,
                      String fromName, int connectTimeoutMs, int readTimeoutMs) {
        this.host = host;
        this.port = port;
        this.username = username;
        this.password = password;
        this.from = from;
        this.fromName = fromName;
        this.connectTimeoutMs = connectTimeoutMs;
        this.readTimeoutMs = readTimeoutMs;
    }

    /**
     * 发送一封 HTML 邮件。
     *
     * @param to       收件人地址
     * @param subject  主题（可含中文，内部按 RFC 2047 编码）
     * @param htmlBody HTML 正文（可含中文）
     * @throws IOException 连接失败、TLS 握手失败、或服务器返回非预期响应码
     */
    public void send(String to, String subject, String htmlBody) throws IOException {
        Socket plain = new Socket();
        try {
            plain.connect(new InetSocketAddress(host, port), connectTimeoutMs);
            plain.setSoTimeout(readTimeoutMs);
        } catch (IOException e) {
            closeQuietly(plain);
            throw new IOException("连接 SMTP 服务器失败: " + host + ":" + port + " (" + e.getMessage() + ")", e);
        }

        SSLSocket ssl = null;
        try {
            SSLContext ctx = initContext();
            ssl = (SSLSocket) ctx.getSocketFactory().createSocket(plain, host, port, true);
            // 默认 SSLSocket 不校验主机名（只有 HttpsURLConnection 才自动做），必须显式打开
            ssl.getSSLParameters().setEndpointIdentificationAlgorithm("HTTPS");
            ssl.startHandshake();
            talk(ssl, to, subject, htmlBody);
        } catch (javax.net.ssl.SSLException e) {
            throw new IOException("TLS 握手失败（确认端口是 465 而非 25/587）: " + e.getMessage(), e);
        } finally {
            if (ssl == null) {
                closeQuietly(plain);
            } else {
                closeQuietly(ssl);
            }
        }
    }

    /** JDK 的 {@code SSLContext.init} 抛的是受检异常，这里统一包成 IOException，调用方只需 catch 一种 */
    private SSLContext initContext() throws IOException {
        try {
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, null, new SecureRandom());
            return ctx;
        } catch (Exception e) {
            throw new IOException("初始化 TLS 上下文失败: " + e.getMessage(), e);
        }
    }

    // ------------------------------------------------------------------ 协议时序

    private void talk(SSLSocket ssl, String to, String subject, String htmlBody) throws IOException {
        InputStream in = ssl.getInputStream();
        OutputStream out = ssl.getOutputStream();

        SmtpIo io = new SmtpIo(in, out);
        io.expect(220);                                   // 服务就绪
        io.command("EHLO " + mailDomain(), 250);          // 能力宣告（QQ 也接受 HELO，这里不区分）
        io.command("AUTH LOGIN", 334);                    // 334 "VXNlcm5hbWU6" = "Username:"
        io.commandBase64Line(username, 334);              // 334 "UGFzc3dvcmQ6" = "Password:"
        io.commandBase64Line(password, 235);              // 235 才算认证成功，不能发完就当过了
        io.command("MAIL FROM:<" + from + ">", 250);
        io.command("RCPT TO:<" + to + ">", 250, 251);
        io.command("DATA", 354, 351);
        io.writeData(buildMessage(to, subject, htmlBody));
        io.expect(250);                                   // 250 才是真正收下了这封信
        try {
            io.command("QUIT", 221);
        } catch (IOException ignore) {
            // 发信已成功，退出时被强断不改变结果
        }
    }

    /** 信封与显示名之外还需要一个 EHLO 用的主机名，取发信地址的域名即可 */
    private String mailDomain() {
        int at = from == null ? -1 : from.indexOf('@');
        return at >= 0 && at < from.length() - 1 ? from.substring(at + 1) : "localhost";
    }

    // ------------------------------------------------------------------ MIME 组包

    /**
     * 组一封单段 HTML 邮件的完整报文（头部 + 空行 + base64 正文）。
     *
     * <p>中文必须处理两处，否则收件人看到的是乱码：主题走 RFC 2047 的
     * {@code =?UTF-8?B?…?=}，正文走 {@code Content-Transfer-Encoding: base64}。</p>
     *
     * <p>包内可见只为让单测直接校验报文形状 —— 这段是手写协议里最容易静默出错的部分，
     * 而 socket 那一半在本机没法测（要真实邮箱）。</p>
     */
    String buildMessage(String to, String subject, String htmlBody) {
        StringBuilder m = new StringBuilder(1024);
        m.append("Date: ").append(ZonedDateTime.now().format(RFC1123)).append(CRLF);
        m.append("From: ").append(encodeWord(fromName)).append(" <").append(from).append('>').append(CRLF);
        m.append("To: <").append(to).append('>').append(CRLF);
        m.append("Subject: ").append(encodeWord(subject)).append(CRLF);
        m.append("Message-ID: <").append(System.currentTimeMillis())
                .append('.').append(Integer.toHexString(new SecureRandom().nextInt())).append('@')
                .append(mailDomain()).append('>').append(CRLF);
        m.append("MIME-Version: 1.0").append(CRLF);
        m.append("Content-Type: text/html; charset=UTF-8").append(CRLF);
        m.append("Content-Transfer-Encoding: base64").append(CRLF);
        m.append(CRLF);
        m.append(wrapBase64(htmlBody == null ? "" : htmlBody));
        // 正文全是 base64 字符，不存在以 "." 开头的行，因此无需点填充（dot-stuffing）
        return m.toString();
    }

    /** RFC 2047 的 encoded-word：用于主题与显示名里的中文 */
    private static String encodeWord(String text) {
        if (text == null || text.isEmpty()) {
            return "";
        }
        return "=?UTF-8?B?" + Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8)) + "?=";
    }

    /** base64 后按 76 字符折行，行尾用 CRLF */
    private static String wrapBase64(String text) {
        String b64 = Base64.getEncoder().encodeToString(text.getBytes(StandardCharsets.UTF_8));
        StringBuilder sb = new StringBuilder(b64.length() + 64);
        for (int i = 0; i < b64.length(); i += B64_LINE) {
            sb.append(b64, i, Math.min(i + B64_LINE, b64.length())).append(CRLF);
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ 逐行读写

    /** SMTP 是行协议，把「发一行」与「读完整响应（含多行续行）」收敛在这里 */
    private static final class SmtpIo {

        private final InputStream in;
        private final OutputStream out;

        SmtpIo(InputStream in, OutputStream out) {
            this.in = in;
            this.out = out;
        }

        void command(String line, int... expected) throws IOException {
            writeLine(line);
            expect(expected);
        }

        /** 认证信息作为「响应行」发送，同样是 base64 后一行、CRLF 结尾 */
        void commandBase64Line(String secret, int... expected) throws IOException {
            command(Base64.getEncoder().encodeToString(secret.getBytes(StandardCharsets.UTF_8)), expected);
        }

        void writeData(String message) throws IOException {
            out.write(message.getBytes(StandardCharsets.US_ASCII));
            // 报文本身是 ASCII（头是 encoded-word、正文是 base64），用 US-ASCII 写出即可
            out.write(CRLF.getBytes(StandardCharsets.US_ASCII));
            out.write((CRLF + "." + CRLF).getBytes(StandardCharsets.US_ASCII));
            out.flush();
        }

        void expect(int... expected) throws IOException {
            Reply r = readReply();
            for (int code : expected) {
                if (r.code == code) {
                    return;
                }
            }
            throw new IOException("SMTP 响应异常，期望 " + java.util.Arrays.toString(expected)
                    + " 实际 " + r.code + " " + r.text);
        }

        private void writeLine(String line) throws IOException {
            out.write((line + CRLF).getBytes(StandardCharsets.US_ASCII));
            out.flush();
        }

        /** SMTP 响应都是 ASCII，逐字节读到换行最稳（不用 Reader 是怕它在超时后吞掉后续数据） */
        private String readLine() throws IOException {
            StringBuilder sb = new StringBuilder(96);
            int b;
            while ((b = in.read()) != -1) {
                if (b == '\n') {
                    break;
                }
                if (b != '\r') {
                    sb.append((char) (b & 0xFF));
                }
            }
            return sb.toString();
        }

        /** 多行响应用「状态码 + '-'」续行，只有「状态码 + 空格」才是结束 */
        private Reply readReply() throws IOException {
            Reply last = new Reply();
            while (true) {
                String line = readLine();
                if (line.length() < 3) {
                    throw new IOException("SMTP 响应格式异常: " + line);
                }
                try {
                    last.code = Integer.parseInt(line.substring(0, 3));
                } catch (NumberFormatException e) {
                    throw new IOException("SMTP 响应码不是数字: " + line, e);
                }
                last.text = line;
                if (line.length() < 4 || line.charAt(3) != '-') {
                    return last;
                }
            }
        }
    }

    private static final class Reply {
        int code;
        String text = "";
    }

    private static void closeQuietly(Socket s) {
        try {
            s.close();
        } catch (IOException ignore) {
            // 关闭失败不影响结果
        }
    }
}
