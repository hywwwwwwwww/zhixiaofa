package com.zhixiaofa.dao;

import com.zhixiaofa.model.EmailVerifyCode;
import java.time.LocalDateTime;

/**
 * EmailVerifyCode 的 DAO 接口。
 *
 * <p>与 {@link SysUserDao} 同样的分层约定：只声明数据访问能力，
 * 「能不能发、还差几次作废」这类规则全部在 Service 层。</p>
 *
 * <p>本表只增不改（除 {@link #markUsed} 与 {@link #increaseAttempts} 两个计数位），
 * 因此没有 update(entity) 这种全字段更新方法。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface EmailVerifyCodeDao {

    /** 新增，返回自增主键 */
    Long insert(EmailVerifyCode entity);

    /**
     * 取该邮箱该场景下<b>仍可用</b>的最新一条（未作废且未过期）。
     *
     * <p>只取一条：同一邮箱连续点两次「发送」时，以最新的码为准，旧的直接失效对待。</p>
     *
     * @param email 参数
     * @param scene 参数
     * @param now   参数
     * @return 查询结果
     */
    EmailVerifyCode findLatestValid(String email, String scene, LocalDateTime now);

    /**
     * 统计某邮箱某场景在指定时刻之后的记录数，用于「冷却时间」与「每日上限」。
     *
     * @param email 参数
     * @param scene 参数
     * @param since 参数
     * @return 查询结果
     */
    long countSince(String email, String scene, LocalDateTime since);

    /**
     * 统计某 IP 在指定时刻之后的记录数，防止换邮箱绕过邮箱维度的限流。
     *
     * @param clientIp 参数
     * @param scene    参数
     * @param since    参数
     * @return 查询结果
     */
    long countByIpSince(String clientIp, String scene, LocalDateTime since);

    /**
     * 标记为已使用 / 已作废
     *
     * @param id 参数
     * @return 查询结果
     */
    int markUsed(Long id);

    /**
     * 错误次数 +1
     *
     * @param id 参数
     * @return 查询结果
     */
    int increaseAttempts(Long id);

    /**
     * 清理过期记录，避免这张表只增不减。
     *
     * <p>过期即无价值（既不能用也没有审计意义 —— 审计看的是 sys_user 的密码变更时间）。</p>
     *
     * @param before 参数
     * @return 查询结果
     */
    int purgeBefore(LocalDateTime before);
}
