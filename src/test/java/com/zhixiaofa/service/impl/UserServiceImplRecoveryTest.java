package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.EmailVerifyCodeDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.EmailVerifyCode;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.MailService;
import com.zhixiaofa.util.PasswordUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 找回密码（邮箱验证码）业务规则测试。
 *
 * <p>{@link MailService} 在这里是 Mock —— 单测不该真去连 SMTP。
 * 正好这套规则的关键全在「发不发、算不算数、能不能改密」这些分支上，
 * 把发信打桩掉反而看得最清楚。</p>
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserService 找回密码规则测试")
class UserServiceImplRecoveryTest {

    private static final String MAIL = "zhangsan@qq.com";
    private static final String IP = "10.1.2.3";
    private static final String CODE = "123456";

    @Mock private SysUserDao userDao;
    @Mock private QaRecordDao qaDao;
    @Mock private ContractDao contractDao;
    @Mock private DocRecordDao docDao;
    @Mock private FavoriteDao favoriteDao;
    @Mock private EmailVerifyCodeDao verifyCodeDao;
    @Mock private MailService mailService;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userDao, qaDao, contractDao, docDao, favoriteDao,
                verifyCodeDao, mailService);
    }

    private SysUser user(long id, int status) {
        SysUser u = new SysUser();
        u.setId(id);
        u.setUsername("user" + id);
        u.setEmail(MAIL);
        u.setStatus(status);
        return u;
    }

    /** 一条与 CODE 对得上的验证码记录（用真实的 PasswordUtil 算摘要，顺带验证摘要能对上） */
    private EmailVerifyCode record(int attempts) {
        EmailVerifyCode r = new EmailVerifyCode();
        r.setId(9L);
        r.setEmail(MAIL);
        r.setSalt("salty");
        r.setCodeHash(PasswordUtil.encrypt("salty", CODE));
        r.setExpireAt(LocalDateTime.now().plusMinutes(5));
        r.setUsed(0);
        r.setAttempts(attempts);
        return r;
    }

    /* ============================== 发码 ============================== */

    @Test
    @DisplayName("邮箱格式不合法：直接参数错误，一次库都不查")
    void badEmailFormat() {
        assertCode(ResultCode.PARAM_ERROR, () -> service.sendPasswordResetCode("not-an-email", IP));
        verifyNoInteractions(verifyCodeDao, mailService);
    }

    @Test
    @DisplayName("邮件服务未配置：不占配额也不落库")
    void mailNotConfigured() {
        when(mailService.isConfigured()).thenReturn(false);
        assertCode(ResultCode.MAIL_NOT_CONFIGURED, () -> service.sendPasswordResetCode(MAIL, IP));
        verifyNoInteractions(verifyCodeDao);
    }

    @Test
    @DisplayName("60 秒冷却期内重复请求被拒")
    void cooldown() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(1L);
        assertCode(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT, () -> service.sendPasswordResetCode(MAIL, IP));
        verify(verifyCodeDao, never()).insert(any());
    }

    @Test
    @DisplayName("同一邮箱当日发满 5 条后被拒")
    void perEmailDailyQuota() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L, 5L);
        assertCode(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT, () -> service.sendPasswordResetCode(MAIL, IP));
        verify(verifyCodeDao, never()).insert(any());
    }

    @Test
    @DisplayName("同一 IP 当日发满 10 条后被拒：挡住「换邮箱继续刷」")
    void perIpDailyQuota() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(verifyCodeDao.countByIpSince(eq(IP), anyString(), any(LocalDateTime.class))).thenReturn(10L);
        assertCode(ResultCode.VERIFY_CODE_SEND_TOO_FREQUENT, () -> service.sendPasswordResetCode(MAIL, IP));
        verify(verifyCodeDao, never()).insert(any());
    }

    @Test
    @DisplayName("正常发码：落库的是摘要不是明文，邮件里才是明文码")
    void sendsCode() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(verifyCodeDao.countByIpSince(eq(IP), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(userDao.findByEmail(MAIL)).thenReturn(user(2L, 1));
        when(verifyCodeDao.insert(any())).thenReturn(77L);

        service.sendPasswordResetCode(MAIL, IP);

        ArgumentCaptor<EmailVerifyCode> saved = ArgumentCaptor.forClass(EmailVerifyCode.class);
        verify(verifyCodeDao).insert(saved.capture());
        assertNotEquals(CODE, saved.getValue().getCodeHash());
        assertEquals(Integer.valueOf(0), saved.getValue().getUsed());

        ArgumentCaptor<String> sent = ArgumentCaptor.forClass(String.class);
        verify(mailService).sendPasswordResetCode(eq(MAIL), sent.capture(), anyInt());
        assertTrue(sent.getValue().matches("\\d{6}"), "验证码应是 6 位数字");
    }

    @Test
    @DisplayName("邮箱没绑账号：仍落库占配额，但不发信 —— 且方法正常返回，调用方给同一句提示")
    void unknownEmailStillConsumesQuotaButSendsNothing() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(verifyCodeDao.countByIpSince(eq(IP), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(userDao.findByEmail(MAIL)).thenReturn(null);
        when(verifyCodeDao.insert(any())).thenReturn(77L);

        assertDoesNotThrow(() -> service.sendPasswordResetCode(MAIL, IP));

        verify(mailService, never()).sendPasswordResetCode(anyString(), anyString(), anyInt());
        verify(verifyCodeDao).markUsed(77L);
    }

    @Test
    @DisplayName("邮箱绑到已禁用账号：同上，不发信、正常返回")
    void disabledAccountSendsNothing() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(verifyCodeDao.countByIpSince(eq(IP), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(userDao.findByEmail(MAIL)).thenReturn(user(2L, 0));
        when(verifyCodeDao.insert(any())).thenReturn(77L);

        assertDoesNotThrow(() -> service.sendPasswordResetCode(MAIL, IP));
        verify(mailService, never()).sendPasswordResetCode(anyString(), anyString(), anyInt());
    }

    @Test
    @DisplayName("发信失败：作废这条码，别让用户在冷却里看不到真正的原因")
    void sendFailureInvalidatesRecord() {
        when(mailService.isConfigured()).thenReturn(true);
        when(verifyCodeDao.countSince(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(verifyCodeDao.countByIpSince(eq(IP), anyString(), any(LocalDateTime.class))).thenReturn(0L);
        when(userDao.findByEmail(MAIL)).thenReturn(user(2L, 1));
        when(verifyCodeDao.insert(any())).thenReturn(77L);
        doThrow(new BizException(ResultCode.MAIL_SEND_FAILED))
                .when(mailService).sendPasswordResetCode(eq(MAIL), anyString(), anyInt());

        assertCode(ResultCode.MAIL_SEND_FAILED, () -> service.sendPasswordResetCode(MAIL, IP));
        verify(verifyCodeDao).markUsed(77L);
    }

    /* ============================== 改密 ============================== */

    @Test
    @DisplayName("库里没有可用验证码：验证码无效")
    void noValidRecord() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class))).thenReturn(null);
        assertCode(ResultCode.VERIFY_CODE_INVALID,
                () -> service.resetPasswordByCode(MAIL, CODE, "abc123"));
    }

    @Test
    @DisplayName("验证码格式不对：不查库直接拒（省一次无谓的 DB 往返）")
    void badCodeFormat() {
        assertCode(ResultCode.VERIFY_CODE_INVALID,
                () -> service.resetPasswordByCode(MAIL, "12a45", "abc123"));
        verifyNoInteractions(verifyCodeDao);
    }

    @Test
    @DisplayName("验证码错：计一次失败，不到上限不作废")
    void wrongCodeCountsAttempt() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class)))
                .thenReturn(record(0));
        assertCode(ResultCode.VERIFY_CODE_INVALID,
                () -> service.resetPasswordByCode(MAIL, "000000", "abc123"));
        verify(verifyCodeDao).increaseAttempts(9L);
        verify(verifyCodeDao, never()).markUsed(any());
    }

    @Test
    @DisplayName("第 5 次试错：这条码作废，逼着重新发一封")
    void wrongCodeAtLimitInvalidates() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class)))
                .thenReturn(record(4));
        assertCode(ResultCode.VERIFY_CODE_INVALID,
                () -> service.resetPasswordByCode(MAIL, "000000", "abc123"));
        verify(verifyCodeDao).markUsed(9L);
    }

    @Test
    @DisplayName("重置成功：先作废再用新盐改密 —— 顺序反了会留下一个可重放的码")
    void resetsPassword() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class)))
                .thenReturn(record(0));
        when(userDao.findByEmail(MAIL)).thenReturn(user(2L, 1));

        service.resetPasswordByCode(MAIL, CODE, "newPass1");

        InOrder order = inOrder(verifyCodeDao, userDao);
        order.verify(verifyCodeDao).markUsed(9L);
        order.verify(userDao).updatePassword(eq(2L), anyString(), anyString());
    }

    @Test
    @DisplayName("码对上了但邮箱对应的号被删了：找不到用户，也不作废、不改密")
    void userGoneAfterCodeSent() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class)))
                .thenReturn(record(0));
        when(userDao.findByEmail(MAIL)).thenReturn(null);
        assertCode(ResultCode.USER_NOT_FOUND,
                () -> service.resetPasswordByCode(MAIL, CODE, "newPass1"));
        verify(userDao, never()).updatePassword(any(), anyString(), anyString());
    }

    @Test
    @DisplayName("新密码太弱：拒绝，且不作废验证码（让用户改了再交一次）")
    void weakNewPasswordRejected() {
        when(verifyCodeDao.findLatestValid(eq(MAIL), anyString(), any(LocalDateTime.class)))
                .thenReturn(record(0));
        when(userDao.findByEmail(MAIL)).thenReturn(user(2L, 1));
        assertCode(ResultCode.PARAM_ERROR,
                () -> service.resetPasswordByCode(MAIL, CODE, "123456"));
        verify(verifyCodeDao, never()).markUsed(any());
    }

    /** 断言抛出的 BizException 带的是期望的业务码 */
    private void assertCode(ResultCode expected, Runnable call) {
        BizException e = assertThrows(BizException.class, call::run);
        assertEquals(expected.getCode(), e.getCode(), () -> "实际提示: " + e.getMessage());
    }
}
