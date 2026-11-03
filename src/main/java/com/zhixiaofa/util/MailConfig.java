package com.zhixiaofa.util;

import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Properties;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 邮件（SMTP）通道配置：加载 {@code mail.properties} 并对外暴露只读取值。
 *
 * <p>配置来源与 {@link AiConfig} 同一套规则 —— 外部 {@code <项目根>/config/mail.properties}
 * 存在即优先，否则回退 classpath 默认值。之所以要走外部文件：邮箱授权码是凭证，
 * 不该进仓库（{@code .gitignore} 已忽略 {@code config/mail.properties}）。</p>
 *
 * <p>与 {@link AiConfig} 的差别：<b>本类只在类初始化时读一次，改配置需重启应用</b>。
 * 因为 AI 配置有管理端页面在写、需要免重启生效，而邮件配置目前只能手工编辑文件，
 * 少一套 reload/save 代码就少一处能出错的地方。</p>
 *
 * <p>配置缺失或读取失败时走默认值且 {@link #isEnabled()} 返回 false ——
 * 「没配好」的效果是找回密码接口返回一句明确提示，而不是抛异常把请求打成 500。</p>
 */
public final class MailConfig {

    private static final Logger log = LoggerFactory.getLogger(MailConfig.class);

    /** classpath 上的默认配置文件名 */
    private static final String CONFIG_FILE = "mail.properties";

    /** 外部配置文件所在目录（相对项目根），与 AI 配置同目录 */
    private static final String EXTERNAL_DIR = "config";

    private static volatile Properties CONF = new Properties();

    /** 当前配置从哪来（出错时日志要能直接告诉用户改哪个文件） */
    private static volatile String loadedFrom = "(尚未加载)";

    static {
        load();
    }

    private MailConfig() {
    }

    private static synchronized void load() {
        Properties p = new Properties();
        String from = "(未找到任何配置)";
        File ext = externalFile();
        try {
            if (ext.isFile()) {
                try (InputStream in = new FileInputStream(ext)) {
                    p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
                }
                from = "外部配置文件 " + ext.getAbsolutePath();
            } else {
                try (InputStream in = MailConfig.class.getClassLoader().getResourceAsStream(CONFIG_FILE)) {
                    if (in != null) {
                        p.load(new InputStreamReader(in, StandardCharsets.UTF_8));
                        from = "classpath 默认 " + CONFIG_FILE;
                    }
                }
            }
        } catch (Exception e) {
            log.warn("读取邮件配置失败，将使用默认值（发信能力关闭）: {}", e.getMessage());
        }
        CONF = p;
        loadedFrom = from;
        log.info("邮件配置已加载[{}]: enabled={}, host={}, port={}, username={}, password={}",
                from, isEnabled(), host(), port(),
                username().isEmpty() ? "(未填)" : username(),
                password().isEmpty() ? "(未填)" : "已填");
    }

    /** 外部配置文件的绝对路径 */
    public static File externalFile() {
        return new File(AiConfig.projectRoot(), EXTERNAL_DIR + File.separator + CONFIG_FILE);
    }

    /**
     * 发信能力是否可用：开关打开、host/username/password/from 四项齐全才算可用。
     *
     * <p>少任何一项都返回 false，由调用方给出「邮件服务未启用」的明确提示。</p>
     */
    public static boolean isEnabled() {
        return Boolean.parseBoolean(str("mail.enabled", "false"))
                && !host().isEmpty() && !username().isEmpty()
                && !password().isEmpty() && !from().isEmpty();
    }

    /** 还没满足的生效条件（空列表 = 已启用），用于日志与接口提示 */
    public static List<String> missing() {
        List<String> miss = new ArrayList<>();
        if (!Boolean.parseBoolean(str("mail.enabled", "false"))) {
            miss.add("总开关未打开（mail.enabled）");
        }
        if (host().isEmpty()) {
            miss.add("缺少 SMTP 服务器地址（mail.host）");
        }
        if (username().isEmpty()) {
            miss.add("缺少发信账号（mail.username）");
        }
        if (password().isEmpty()) {
            miss.add("缺少邮箱授权码（mail.password）");
        }
        if (from().isEmpty()) {
            miss.add("缺少发信人地址（mail.from）");
        }
        return miss;
    }

    public static String host() {
        return str("mail.host", "");
    }

    /** 端口：465 为隐式 SSL（本项目唯一支持的方式），587 的 STARTTLS 未实现 */
    public static int port() {
        return intOf("mail.port", 465);
    }

    public static String username() {
        return str("mail.username", "");
    }

    /**
     * 邮箱的 <b>SMTP 授权码</b>，不是邮箱登录密码。
     *
     * <p>任何日志、异常信息、接口返回中都不允许出现它的完整值。</p>
     */
    public static String password() {
        return str("mail.password", "");
    }

    /** 信封发信人：QQ / 163 都要求它与 {@link #username()} 一致，否则 550 拒信 */
    public static String from() {
        return str("mail.from", username());
    }

    /** 收件人显示名 */
    public static String fromName() {
        return str("mail.fromName", "职小法");
    }

    public static int connectTimeoutMs() {
        return intOf("mail.connectTimeoutMs", 8000);
    }

    public static int readTimeoutMs() {
        return intOf("mail.readTimeoutMs", 8000);
    }

    /** 当前配置来源（排查「我改了文件却没生效」时用） */
    public static String loadedFrom() {
        return loadedFrom;
    }

    private static String str(String key, String def) {
        String v = CONF.getProperty(key);
        return (v == null || v.trim().isEmpty()) ? def : v.trim();
    }

    private static int intOf(String key, int def) {
        try {
            return Integer.parseInt(str(key, String.valueOf(def)));
        } catch (NumberFormatException e) {
            return def;
        }
    }
}
