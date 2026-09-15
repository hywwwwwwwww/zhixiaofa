package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.SysUser;
import com.zhixiaofa.util.PasswordUtil;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 用户业务单元测试：用 Mockito 打桩 DAO，验证注册 / 登录 / 改密的业务规则。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("UserService 业务规则测试")
class UserServiceImplTest {

    @Mock private SysUserDao userDao;
    @Mock private QaRecordDao qaDao;
    @Mock private ContractDao contractDao;
    @Mock private DocRecordDao docDao;
    @Mock private FavoriteDao favoriteDao;

    private UserServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new UserServiceImpl(userDao, qaDao, contractDao, docDao, favoriteDao);
    }

    private SysUser existingUser(String plain) {
        String salt = PasswordUtil.generateSalt();
        SysUser u = new SysUser();
        u.setId(1L);
        u.setUsername("zhangsan");
        u.setSalt(salt);
        u.setPassword(PasswordUtil.encrypt(salt, plain));
        u.setRole("USER");
        u.setStatus(1);
        return u;
    }

    // ---------------------------------------------------------- 注册
    @Test
    @DisplayName("注册：用户名非法直接拒绝")
    void registerRejectsInvalidUsername() {
        assertThrows(BizException.class, () -> service.register("1abc", "abc12345", null, null, null, null, null));
        assertThrows(BizException.class, () -> service.register("ab", "abc12345", null, null, null, null, null));
        assertThrows(BizException.class, () -> service.register("", "abc12345", null, null, null, null, null));
    }

    @Test
    @DisplayName("注册：弱密码被拒绝（纯数字 / 纯字母 / 过短）")
    void registerRejectsWeakPassword() {
        assertThrows(BizException.class, () -> service.register("zhangsan1", "123456", null, null, null, null, null));
        assertThrows(BizException.class, () -> service.register("zhangsan1", "abcdefgh", null, null, null, null, null));
        assertThrows(BizException.class, () -> service.register("zhangsan1", "a1", null, null, null, null, null));
    }

    @Test
    @DisplayName("注册：用户名重复抛 USERNAME_EXISTS")
    void registerRejectsDuplicateUsername() {
        when(userDao.findByUsername("zhangsan")).thenReturn(existingUser("abc12345"));
        BizException e = assertThrows(BizException.class,
                () -> service.register("zhangsan", "abc12345", null, null, null, null, null));
        assertEquals(11203, e.getCode());
        verify(userDao, never()).insert(any());
    }

    @Test
    @DisplayName("注册：邮箱格式非法被拒绝")
    void registerRejectsInvalidEmail() {
        assertThrows(BizException.class,
                () -> service.register("zhangsan1", "abc12345", null, "not-an-email", null, null, null));
    }

    @Test
    @DisplayName("注册成功：密码以加盐摘要存储，明文不落库")
    void registerStoresHashedPassword() {
        when(userDao.findByUsername("newuser")).thenReturn(null);
        when(userDao.insert(any(SysUser.class))).thenReturn(99L);

        SysUser created = service.register("newuser", "abc12345", "新用户", "new@test.com", "13800001111", "北京", "实习生");

        assertEquals(99L, created.getId());
        assertNotNull(created.getSalt());
        assertNotEquals("abc12345", created.getPassword());
        assertTrue(PasswordUtil.matches(created.getSalt(), "abc12345", created.getPassword()));
        assertEquals("USER", created.getRole());
        assertEquals(1, created.getStatus());
        assertNotNull(created.getCreatedAt());
        verify(userDao).insert(any(SysUser.class));
    }

    // ---------------------------------------------------------- 登录
    @Test
    @DisplayName("登录成功：刷新最近登录时间并返回用户")
    void loginSuccess() {
        SysUser u = existingUser("abc12345");
        when(userDao.findByUsername("zhangsan")).thenReturn(u);

        SysUser login = service.login("zhangsan", "abc12345");

        assertNotNull(login.getLastLoginAt());
        verify(userDao).updateLastLogin(eq(1L), any());
    }

    @Test
    @DisplayName("登录失败：密码错误与用户不存在都返回同一错误码，不暴露账号是否存在")
    void loginFailuresUseSameMessage() {
        when(userDao.findByUsername("zhangsan")).thenReturn(existingUser("abc12345"));
        when(userDao.findByUsername("nobody")).thenReturn(null);

        BizException wrongPwd = assertThrows(BizException.class, () -> service.login("zhangsan", "bad12345"));
        BizException noUser = assertThrows(BizException.class, () -> service.login("nobody", "abc12345"));
        assertEquals(11201, wrongPwd.getCode());
        assertEquals(11201, noUser.getCode());
        assertEquals(wrongPwd.getMessage(), noUser.getMessage());
    }

    @Test
    @DisplayName("登录失败：空用户名或空密码直接拒绝")
    void loginRejectsEmptyInput() {
        assertThrows(BizException.class, () -> service.login("", "abc12345"));
        assertThrows(BizException.class, () -> service.login("zhangsan", ""));
    }

    @Test
    @DisplayName("登录失败：账号被禁用")
    void loginRejectsDisabledAccount() {
        SysUser u = existingUser("abc12345");
        u.setStatus(0);
        when(userDao.findByUsername("zhangsan")).thenReturn(u);
        BizException e = assertThrows(BizException.class, () -> service.login("zhangsan", "abc12345"));
        assertEquals(11202, e.getCode());
    }

    // ---------------------------------------------------------- 改密
    @Test
    @DisplayName("改密：原密码错误被拒绝")
    void changePasswordRejectsWrongOld() {
        when(userDao.findById(1L)).thenReturn(existingUser("abc12345"));
        BizException e = assertThrows(BizException.class,
                () -> service.changePassword(1L, "wrong12345", "newpass123"));
        assertEquals(11205, e.getCode());
        verify(userDao, never()).updatePassword(anyLong(), anyString(), anyString());
    }

    @Test
    @DisplayName("改密：新密码与原密码相同被拒绝")
    void changePasswordRejectsSame() {
        when(userDao.findById(1L)).thenReturn(existingUser("abc12345"));
        assertThrows(BizException.class, () -> service.changePassword(1L, "abc12345", "abc12345"));
    }

    @Test
    @DisplayName("改密成功：写入新摘要并使用新盐值")
    void changePasswordWritesNewSalt() {
        SysUser u = existingUser("abc12345");
        String oldSalt = u.getSalt();
        when(userDao.findById(1L)).thenReturn(u);

        service.changePassword(1L, "abc12345", "newpass123");

        verify(userDao).updatePassword(eq(1L), anyString(), argThat(salt -> !salt.equals(oldSalt)));
    }

    // ---------------------------------------------------------- 其它
    @Test
    @DisplayName("删除：不允许删除当前登录账号")
    void deleteRejectsSelf() {
        BizException e = assertThrows(BizException.class, () -> service.delete(1L, 1L));
        assertEquals(11206, e.getCode());
        verify(userDao, never()).deleteById(anyLong());
    }

    @Test
    @DisplayName("禁用：不允许禁用当前登录账号")
    void updateStatusRejectsSelf() {
        assertThrows(BizException.class, () -> service.updateStatus(1L, 0, 1L));
    }

    @Test
    @DisplayName("分页：total 为 0 时不查列表，直接返回空页")
    void pageReturnsEmptyWhenNoData() {
        when(userDao.countByCondition(any(), any(), any())).thenReturn(0L);
        PageResult<SysUser> page = service.page(null, null, null, 1, 10);
        assertEquals(0, page.getTotal());
        assertTrue(page.getList().isEmpty());
        verify(userDao, never()).findByCondition(any(), any(), any(), anyInt(), anyInt());
    }

    @Test
    @DisplayName("分页：正常返回列表与总数")
    void pageReturnsData() {
        when(userDao.countByCondition(any(), any(), any())).thenReturn(2L);
        when(userDao.findByCondition(any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(Collections.singletonList(existingUser("abc12345")));
        PageResult<SysUser> page = service.page(null, null, null, 1, 10);
        assertEquals(2, page.getTotal());
        assertEquals(1, page.getList().size());
    }

    @Test
    @DisplayName("个人中心概览：聚合各模块数量")
    void profileSummary() {
        when(qaDao.countByUserId(1L)).thenReturn(3L);
        when(contractDao.countByUserId(1L)).thenReturn(2L);
        when(docDao.countByUserId(1L)).thenReturn(5L);
        when(favoriteDao.countByUser(1L)).thenReturn(7L);

        Map<String, Object> map = service.profileSummary(1L);
        assertEquals(3L, map.get("qaCount"));
        assertEquals(2L, map.get("contractCount"));
        assertEquals(5L, map.get("docCount"));
        assertEquals(7L, map.get("favoriteCount"));
    }
}
