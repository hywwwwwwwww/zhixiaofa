package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.SysUser;

/**
 * 用户业务接口：注册、登录、资料维护与后台用户管理。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface UserService {

    /**
     * 注册新用户。
     *
     * <p>业务校验：用户名格式与唯一性、邮箱唯一性、密码长度、手机号格式。</p>
     *
     * @param username 登录名
     * @param password 明文密码
     * @param nickname 昵称
     * @param email    邮箱
     * @param phone    手机号
     * @param city     城市
     * @param jobTitle 岗位
     * @return 注册成功的用户（不含密码）
     */
    SysUser register(String username, String password, String nickname,
                     String email, String phone, String city, String jobTitle);

    /**
     * 注册新用户（带邮箱验证码的完整版）。
     *
     * <p>填了 {@code email} 就必须带上 {@code sendRegisterCode} 发出的 6 位验证码；
     * 不填邮箱则与旧签名等价（验证码传 {@code null}）—— 邮箱验证是可选增强，
     * 不强制所有注册都绑邮箱。</p>
     *
     * <p>校验顺序是刻意安排的：格式与唯一性校验在前、验证码在后 ——
     * 用户名写错、密码太弱这类问题<b>不应该消耗掉一条验证码</b>（60 秒冷却 + 每日上限，
     * 码很金贵）；而验证码的「消费」又放在入库成功之后 —— 注册中途失败时码仍可用，
     * 用户改完直接重提交，不用重新收邮件。</p>
     *
     * @param verifyCode 邮箱验证码（email 为空时可传 null）
     */
    SysUser register(String username, String password, String nickname,
                     String email, String phone, String city, String jobTitle, String verifyCode);

    /**
     * 发送「注册验证码」到待注册的邮箱。
     *
     * <p>与 {@link #sendPasswordResetCode} 的防枚举语义<b>相反</b>：注册场景下
     * 「邮箱已被注册」是要明确报错的业务结果（{@code EMAIL_EXISTS}），不假装发送成功。</p>
     *
     * <p>邮件未启用（开发模式）时仍走完整的生成与落库链路，但把验证码明文通过
     * <b>返回值</b>交给调用方直接回填给用户 —— 否则注册被 SMTP 配置卡死；
     * 该返回只发生在 {@code mail.enabled=false} 时，启用邮件后验证码只出现在邮件里。</p>
     *
     * @param email    邮箱
     * @param clientIp 发起请求的客户端 IP，用于按 IP 限流；取不到可传 null
     * @return 开发模式下的验证码明文；正常发信返回 null
     */
    String sendRegisterCode(String email, String clientIp);

    /**
     * 登录校验。
     *
     * @param username 登录名
     * @param password 明文密码
     * @return 登录成功的用户（不含密码与盐值）
     */
    SysUser login(String username, String password);

    /** 按主键查询用户 */
    SysUser getById(Long id);

    /** 修改个人资料 */
    SysUser updateProfile(Long id, String nickname, String email, String phone,
                          String city, String jobTitle, String avatar);

    /** 修改密码（需校验原密码） */
    void changePassword(Long id, String oldPassword, String newPassword);

    /**
     * 发送「找回密码」验证码到邮箱。
     *
     * <p>本方法<b>不区分</b>「邮箱未绑定任何账号」与「发送成功」—— 两种情况都正常返回，
     * 由调用方给出同一句提示。否则这个匿名接口就成了一台账号枚举机。</p>
     *
     * @param email    邮箱
     * @param clientIp 发起请求的客户端 IP，用于按 IP 限流；取不到可传 null
     */
    void sendPasswordResetCode(String email, String clientIp);

    /**
     * 凭邮箱验证码重置密码（无需原密码，也不要求登录）。
     *
     * @param email       邮箱
     * @param code        邮件里的 6 位验证码
     * @param newPassword 新密码明文
     */
    void resetPasswordByCode(String email, String code, String newPassword);


    /** 管理员重置某用户密码 */
    void resetPassword(Long id, String newPassword);

    /** 后台用户分页查询 */
    PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize);

    /** 后台用户分页查询（带列头排序） */
    PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize,
                             String sortName, String sortOrder);

    /** 启用 / 禁用账号 */
    void updateStatus(Long id, Integer status, Long operatorId);

    /** 修改角色（USER / ADMIN） */
    void updateRole(Long id, String role, Long operatorId);

    /** 删除用户（不能删除自己） */
    void delete(Long id, Long operatorId);

    /** 统计某用户的业务总量，用于个人中心概览 */
    java.util.Map<String, Object> profileSummary(Long userId);
}
