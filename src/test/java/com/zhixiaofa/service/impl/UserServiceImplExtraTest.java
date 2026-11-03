package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.EmailVerifyCodeDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.service.MailService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 用户业务补充测试：覆盖资料修改、状态/角色变更与管理员重置密码。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserService 补充测试")
class UserServiceImplExtraTest {

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

    private SysUser user(long id, String email) {
        SysUser u = new SysUser();
        u.setId(id);
        u.setUsername("user" + id);
        u.setNickname("昵称" + id);
        u.setEmail(email);
        u.setSalt("salt");
        u.setPassword("digest");
        u.setRole("USER");
        u.setStatus(1);
        return u;
    }

    @Test
    @DisplayName("查详情：不存在抛业务异常")
    void getByIdNotFound() {
        when(userDao.findById(1L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.getById(1L));
    }

    @Test
    @DisplayName("改资料：邮箱格式非法被拒绝")
    void updateProfileRejectsBadEmail() {
        when(userDao.findById(1L)).thenReturn(user(1L, "a@b.com"));
        assertThrows(BizException.class,
                () -> service.updateProfile(1L, "昵称", "bad-email", null, null, null, null));
    }

    @Test
    @DisplayName("改资料：手机号格式非法被拒绝")
    void updateProfileRejectsBadPhone() {
        when(userDao.findById(1L)).thenReturn(user(1L, "a@b.com"));
        assertThrows(BizException.class,
                () -> service.updateProfile(1L, "昵称", null, "12345", null, null, null));
    }

    @Test
    @DisplayName("改资料：邮箱被他人占用被拒绝；与原邮箱相同则放行")
    void updateProfileEmailConflict() {
        when(userDao.findById(1L)).thenReturn(user(1L, "old@b.com"));
        when(userDao.findByEmail("taken@b.com")).thenReturn(user(2L, "taken@b.com"));
        assertThrows(BizException.class,
                () -> service.updateProfile(1L, "昵称", "taken@b.com", null, null, null, null));

        SysUser same = user(1L, "old@b.com");
        when(userDao.findById(1L)).thenReturn(same);
        assertNotNull(service.updateProfile(1L, "新昵称", "old@b.com", "13800001111", "上海", "法务", null));
        verify(userDao).update(any(SysUser.class));
    }

    @Test
    @DisplayName("改资料：头像为空时不覆盖原值")
    void updateProfileKeepsAvatar() {
        SysUser u = user(1L, "a@b.com");
        u.setAvatar("/old.png");
        when(userDao.findById(1L)).thenReturn(u);
        SysUser updated = service.updateProfile(1L, "新昵称", "a@b.com", null, null, null, null);
        assertEquals("/old.png", updated.getAvatar());
        assertNotNull(updated.getUpdatedAt());
    }

    @Test
    @DisplayName("改状态：非法状态值被拒绝")
    void updateStatusRejectsBadValue() {
        assertThrows(BizException.class, () -> service.updateStatus(2L, 9, 1L));
        assertThrows(BizException.class, () -> service.updateStatus(2L, null, 1L));
    }

    @Test
    @DisplayName("改状态：正常禁用他人账号")
    void updateStatusOk() {
        when(userDao.findById(2L)).thenReturn(user(2L, null));
        service.updateStatus(2L, 0, 1L);
        verify(userDao).updateStatus(2L, 0);
    }

    @Test
    @DisplayName("改角色：非法角色被拒绝；不能取消自己的管理员权限")
    void updateRoleRules() {
        assertThrows(BizException.class, () -> service.updateRole(2L, "SUPER", 1L));
        assertThrows(BizException.class, () -> service.updateRole(1L, "USER", 1L));

        when(userDao.findById(2L)).thenReturn(user(2L, null));
        service.updateRole(2L, "ADMIN", 1L);
        verify(userDao).update(argThat((SysUser x) -> "ADMIN".equals(x.getRole()) && x.getUpdatedAt() != null));
    }

    @Test
    @DisplayName("删除：正常删除他人账号")
    void deleteOk() {
        when(userDao.findById(2L)).thenReturn(user(2L, null));
        service.delete(2L, 1L);
        verify(userDao).deleteById(2L);
    }

    @Test
    @DisplayName("重置密码：弱密码被拒绝，成功后写入新摘要与新盐")
    void resetPasswordFlow() {
        when(userDao.findById(2L)).thenReturn(user(2L, null));
        assertThrows(BizException.class, () -> service.resetPassword(2L, "123"));

        service.resetPassword(2L, "newpass123");
        verify(userDao).updatePassword(eq(2L), anyString(), argThat(s -> s != null && s.length() == 32));
    }
}
