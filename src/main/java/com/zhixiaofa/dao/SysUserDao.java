package com.zhixiaofa.dao;

import com.zhixiaofa.model.SysUser;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * SysUser 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface SysUserDao {

    /** 新增，返回自增主键 */
    Long insert(SysUser entity);

    /** 按主键更新全部字段 */
    int update(SysUser entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    SysUser findById(Long id);

    /** 查询全部 */
    java.util.List<SysUser> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<SysUser> findByPage(int offset, int limit);

    /**
     * 按登录名查询，用于登录与唯一性校验
     *
     * @param username 参数
     * @return 查询结果
     */
    SysUser findByUsername(String username);

    /**
     * 按邮箱查询，用于注册去重
     *
     * @param email 参数
     * @return 查询结果
     */
    SysUser findByEmail(String email);

    /**
     * 登录成功后更新最近登录时间
     *
     * @param id 参数
     * @param lastLoginAt 参数
     * @return 查询结果
     */
    int updateLastLogin(Long id, LocalDateTime lastLoginAt);

    /**
     * 启用 / 禁用账号
     *
     * @param id 参数
     * @param status 参数
     * @return 查询结果
     */
    int updateStatus(Long id, Integer status);

    /**
     * 重置密码（同时换新盐）
     *
     * @param id 参数
     * @param password 参数
     * @param salt 参数
     * @return 查询结果
     */
    int updatePassword(Long id, String password, String salt);

    /**
     * 后台用户列表分页（关键词 / 角色 / 状态 组合查询）
     *
     * @param keyword 参数
     * @param role 参数
     * @param status 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<SysUser> findByCondition(String keyword, String role, Integer status, int offset, int limit);

    /**
     * 后台用户列表条件计数
     *
     * @param keyword 参数
     * @param role 参数
     * @param status 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String role, Integer status);

    /**
     * 注册趋势（折线图）
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);

    /**
     * 角色分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByRole();

    /**
     * 地域分布（柱状图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByCity();
}
