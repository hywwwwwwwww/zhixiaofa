package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.EmailVerifyCodeDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.EmailVerifyCode;
import com.zhixiaofa.util.JdbcExecutor;
import com.zhixiaofa.util.ResultSets;

import java.time.LocalDateTime;

/**
 * EmailVerifyCodeDao 的 JDBC 实现。
 *
 * <p>与其余 DAO 一致：全部走 {@link java.sql.PreparedStatement} 占位符绑定，
 * 用户输入（邮箱、IP）永不拼进 SQL 字符串。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class EmailVerifyCodeDaoImpl implements EmailVerifyCodeDao {

    /** 基础映射：email_verify_code 全字段 */
    static final RowMapper<EmailVerifyCode> MAPPER = rs -> {
        EmailVerifyCode x = new EmailVerifyCode();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setEmail(ResultSets.getString(rs, "email"));
        x.setScene(ResultSets.getString(rs, "scene"));
        x.setCodeHash(ResultSets.getString(rs, "code_hash"));
        x.setSalt(ResultSets.getString(rs, "salt"));
        x.setExpireAt(ResultSets.getLocalDateTime(rs, "expire_at"));
        x.setUsed(ResultSets.getInteger(rs, "used"));
        x.setAttempts(ResultSets.getInteger(rs, "attempts"));
        x.setClientIp(ResultSets.getString(rs, "client_ip"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        return x;
    };

    @Override
    public Long insert(EmailVerifyCode entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO email_verify_code (email, scene, code_hash, salt, expire_at, used, attempts, client_ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getEmail(), entity.getScene(), entity.getCodeHash(), entity.getSalt(), entity.getExpireAt(), entity.getUsed(), entity.getAttempts(), entity.getClientIp(), entity.getCreatedAt());
    }

    @Override
    public EmailVerifyCode findLatestValid(String email, String scene, LocalDateTime now) {
        // 取仍可用的最新一条（未作废且未过期）
        return JdbcExecutor.queryOne(null, "SELECT * FROM email_verify_code WHERE email = ? AND scene = ? AND used = 0 AND expire_at > ? ORDER BY id DESC LIMIT 1", MAPPER, email, scene, now);
    }

    @Override
    public long countSince(String email, String scene, LocalDateTime since) {
        // 统计某邮箱某场景在指定时刻之后的记录数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM email_verify_code WHERE email = ? AND scene = ? AND created_at >= ?", email, scene, since);
    }

    @Override
    public long countByIpSince(String clientIp, String scene, LocalDateTime since) {
        // 统计某 IP 在指定时刻之后的记录数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM email_verify_code WHERE client_ip = ? AND scene = ? AND created_at >= ?", clientIp, scene, since);
    }

    @Override
    public int markUsed(Long id) {
        // 标记为已使用 / 已作废
        return JdbcExecutor.update(null, "UPDATE email_verify_code SET used = 1 WHERE id = ?", id);
    }

    @Override
    public int increaseAttempts(Long id) {
        // 错误次数 +1
        return JdbcExecutor.update(null, "UPDATE email_verify_code SET attempts = attempts + 1 WHERE id = ?", id);
    }

    @Override
    public int purgeBefore(LocalDateTime before) {
        // 清理过期记录
        return JdbcExecutor.update(null, "DELETE FROM email_verify_code WHERE expire_at < ?", before);
    }
}
