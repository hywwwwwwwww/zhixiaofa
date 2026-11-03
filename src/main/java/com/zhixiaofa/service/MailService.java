package com.zhixiaofa.service;

/**
 * 邮件发送业务接口。
 *
 * <p>目前的邮件都是「邮箱验证码」类（找回密码 / 注册）。之所以把模板放在这一层
 * 而不是 Service 里，是为了让 {@code UserServiceImpl} 完全不出现 HTML 字符串。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface MailService {

    /**
     * 邮件通道是否可用（配置齐全且开关打开）。
     *
     * <p>让调用方在生成验证码<b>之前</b>就能判断，从而避免「存了个用不上的验证码」。</p>
     */
    boolean isConfigured();

    /**
     * 发送找回密码验证码邮件。
     *
     * @param to         收件邮箱
     * @param code       6 位数字验证码（只出现在邮件正文，绝不进日志与接口返回）
     * @param ttlMinutes 有效期（分钟），要与落库的过期时间一致，否则邮件文案会骗人
     * @throws com.zhixiaofa.exception.BizException 未配置或发送失败
     */
    void sendPasswordResetCode(String to, String code, int ttlMinutes);

    /**
     * 发送注册验证码邮件。
     *
     * @param to         收件邮箱
     * @param code       6 位数字验证码（只出现在邮件正文，绝不进日志与接口返回）
     * @param ttlMinutes 有效期（分钟）
     * @throws com.zhixiaofa.exception.BizException 未配置或发送失败
     */
    void sendRegisterCode(String to, String code, int ttlMinutes);
}
