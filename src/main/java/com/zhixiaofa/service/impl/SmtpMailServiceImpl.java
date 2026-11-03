package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.service.MailService;
import com.zhixiaofa.util.MailConfig;
import com.zhixiaofa.util.SmtpClient;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * MailService 的 SMTP 实现：配置取自 {@link MailConfig}，协议走 {@link SmtpClient}。
 *
 * <p>失败策略与 {@link LlmClient} 相反，这是刻意的：大模型失败可以退回规则拼装，
 * 而验证码邮件<b>没有降级方案</b> —— 发不出去就是该邮箱验证功能不可用
 * （注册在服务层另有「开发模式」兜底，见 {@code UserServiceImpl#sendRegisterCode}），
 * 因此一律抛 {@code BizException}，让页面拿到明确提示，而不是静默返回「已发送」。</p>
 *
 * <p>安全：授权码不入日志（{@link MailConfig#password()} 只判断是否为空）；
 * 验证码不入日志（它本身就是凭证）；SMTP 异常只记一句话原因，不外传给前端。</p>
 */
public class SmtpMailServiceImpl implements MailService {

    private static final Logger log = LoggerFactory.getLogger(SmtpMailServiceImpl.class);

    @Override
    public boolean isConfigured() {
        return MailConfig.isEnabled();
    }

    @Override
    public void sendPasswordResetCode(String to, String code, int ttlMinutes) {
        sendCodeMail(to, code, ttlMinutes, "找回密码验证码",
                "你正在通过邮箱验证身份重置密码，验证码：",
                "如果这不是你本人的操作，说明有人知道了你的邮箱地址，"
                        + "本次验证码不会改动你的密码，你无需处理。");
    }

    @Override
    public void sendRegisterCode(String to, String code, int ttlMinutes) {
        sendCodeMail(to, code, ttlMinutes, "注册验证码",
                "你正在注册职小法账号，验证码：",
                "如果这不是你本人的操作，请忽略本邮件，验证码过期后自动作废。");
    }

    /**
     * 两类验证码邮件共用一条发送链路；差异只在标题、开头一句与结尾提示。
     *
     * <p>抽公共方法而不是复制一份 {@code sendPasswordResetCode}：SMTP 参数、异常映射、
     * 日志脱敏这些容易改一漏一的东西只有一份。</p>
     */
    private void sendCodeMail(String to, String code, int ttlMinutes, String title, String intro, String note) {
        if (!MailConfig.isEnabled()) {
            log.warn("邮件通道未启用，缺失项: {}", MailConfig.missing());
            throw new BizException(ResultCode.MAIL_NOT_CONFIGURED);
        }
        SmtpClient client = new SmtpClient(MailConfig.host(), MailConfig.port(),
                MailConfig.username(), MailConfig.password(), MailConfig.from(),
                MailConfig.fromName(), MailConfig.connectTimeoutMs(), MailConfig.readTimeoutMs());
        try {
            client.send(to, "【" + MailConfig.fromName() + "】" + title, body(title, intro, note, code, ttlMinutes));
            log.info("验证码邮件已投递: to={}", to);
        } catch (Exception e) {
            log.error("验证码邮件发送失败: to={}, host={}:{}, 原因={} - {}",
                    to, MailConfig.host(), MailConfig.port(), e.getClass().getSimpleName(), e.getMessage());
            throw new BizException(ResultCode.MAIL_SEND_FAILED);
        }
    }

    /** 邮件正文：不引模板引擎，一段内联样式的 HTML 足够，且邮件客户端对外部 CSS 支持很差 */
    private String body(String title, String intro, String note, String code, int ttlMinutes) {
        return "<div style='max-width:460px;margin:0 auto;padding:28px 26px;"
                + "font-family:-apple-system,'Segoe UI','Microsoft YaHei',sans-serif;"
                + "color:#1f2329;border:1px solid #e5e7eb;border-radius:10px'>"
                + "<div style='font-size:15px;font-weight:700'>职小法 · " + title + "</div>"
                + "<p style='font-size:13.5px;line-height:1.9;margin:18px 0 14px'>"
                + intro + "</p>"
                + "<div style='font-size:32px;font-weight:700;letter-spacing:8px;"
                + "text-align:center;padding:16px 0;background:#f5f6f8;border-radius:8px;"
                + "color:#1f6feb'>" + code + "</div>"
                + "<p style='font-size:13px;color:#8a919e;margin:16px 0 0;line-height:1.9'>"
                + "有效期 <b>" + ttlMinutes + "</b> 分钟，仅可使用一次。<br>"
                + note + "</p>"
                + "<p style='font-size:12px;color:#b2b8c3;margin:16px 0 0'>"
                + "本邮件由系统自动发出，请勿回复。</p>"
                + "</div>";
    }
}
