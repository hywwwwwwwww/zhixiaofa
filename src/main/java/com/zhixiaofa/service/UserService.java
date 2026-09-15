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

    /** 管理员重置某用户密码 */
    void resetPassword(Long id, String newPassword);

    /** 后台用户分页查询 */
    PageResult<SysUser> page(String keyword, String role, Integer status, int pageNum, int pageSize);

    /** 启用 / 禁用账号 */
    void updateStatus(Long id, Integer status, Long operatorId);

    /** 修改角色（USER / ADMIN） */
    void updateRole(Long id, String role, Long operatorId);

    /** 删除用户（不能删除自己） */
    void delete(Long id, Long operatorId);

    /** 统计某用户的业务总量，用于个人中心概览 */
    java.util.Map<String, Object> profileSummary(Long userId);
}
