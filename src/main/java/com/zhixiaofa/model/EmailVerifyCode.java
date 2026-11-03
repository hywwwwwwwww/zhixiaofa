package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 邮箱验证码 实体类，对应数据库表 {@code email_verify_code}。
 *
 * <p>与 {@link SysUser} 同样的约定：纯 POJO，不含业务逻辑与 SQL。</p>
 *
 * <p>注意本表<b>不存验证码明文</b>，只存 {@code SHA-256(salt + 明文码)}：
 * 万一这张表被单独拖库，拿到的摘要也无法直接当验证码用（还需配合邮箱枚举）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class EmailVerifyCode implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 主键 */
    private Long id;
    /** 目标邮箱 */
    private String email;
    /** 业务场景，如 {@code RESET_PASSWORD}（找回密码） */
    private String scene;
    /** 验证码摘要 SHA-256(salt+明文) */
    @JsonIgnore
    private String codeHash;
    /** 验证码盐值 */
    @JsonIgnore
    private String salt;
    /** 过期时间 */
    private LocalDateTime expireAt;
    /** 是否已作废：0=可用 1=已用/已作废 */
    private Integer used;
    /** 已尝试错误次数 */
    private Integer attempts;
    /** 发起请求的客户端 IP，用于按 IP 限流 */
    private String clientIp;
    /** 创建时间 */
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getEmail() {
        return email;
    }

    public void setEmail(String email) {
        this.email = email;
    }

    public String getScene() {
        return scene;
    }

    public void setScene(String scene) {
        this.scene = scene;
    }

    @JsonIgnore
    public String getCodeHash() {
        return codeHash;
    }

    public void setCodeHash(String codeHash) {
        this.codeHash = codeHash;
    }

    @JsonIgnore
    public String getSalt() {
        return salt;
    }

    public void setSalt(String salt) {
        this.salt = salt;
    }

    public LocalDateTime getExpireAt() {
        return expireAt;
    }

    public void setExpireAt(LocalDateTime expireAt) {
        this.expireAt = expireAt;
    }

    public Integer getUsed() {
        return used;
    }

    public void setUsed(Integer used) {
        this.used = used;
    }

    public Integer getAttempts() {
        return attempts;
    }

    public void setAttempts(Integer attempts) {
        this.attempts = attempts;
    }

    public String getClientIp() {
        return clientIp;
    }

    public void setClientIp(String clientIp) {
        this.clientIp = clientIp;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "EmailVerifyCode{" + "id=" + id + ", " + "email=" + email + ", " + "scene=" + scene + ", " + "expireAt=" + expireAt + ", " + "used=" + used + ", " + "attempts=" + attempts + ", " + "clientIp=" + clientIp + ", " + "createdAt=" + createdAt + "}";
    }
}
