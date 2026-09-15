package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 操作日志 实体类，对应数据库表 {@code operation_log}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class OperationLog implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 日志主键 */
    private Long id;
    /** 操作用户ID */
    private Long userId;
    /** 操作用户名 */
    private String username;
    /** 操作描述 */
    private String action;
    /** HTTP方法 */
    private String method;
    /** 请求URI */
    private String uri;
    /** 客户端IP */
    private String ip;
    /** 请求参数摘要 */
    private String params;
    /** 耗时(毫秒) */
    private Long costMs;
    /** HTTP状态码 */
    private Integer status;
    /** 发生时间 */
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getUserId() {
        return userId;
    }

    public void setUserId(Long userId) {
        this.userId = userId;
    }

    public String getUsername() {
        return username;
    }

    public void setUsername(String username) {
        this.username = username;
    }

    public String getAction() {
        return action;
    }

    public void setAction(String action) {
        this.action = action;
    }

    public String getMethod() {
        return method;
    }

    public void setMethod(String method) {
        this.method = method;
    }

    public String getUri() {
        return uri;
    }

    public void setUri(String uri) {
        this.uri = uri;
    }

    public String getIp() {
        return ip;
    }

    public void setIp(String ip) {
        this.ip = ip;
    }

    public String getParams() {
        return params;
    }

    public void setParams(String params) {
        this.params = params;
    }

    public Long getCostMs() {
        return costMs;
    }

    public void setCostMs(Long costMs) {
        this.costMs = costMs;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "OperationLog{" + "id=" + id + ", " + "userId=" + userId + ", " + "username=" + username + ", " + "action=" + action + ", " + "method=" + method + ", " + "uri=" + uri + ", " + "ip=" + ip + ", " + "params=" + params + ", " + "costMs=" + costMs + ", " + "status=" + status + ", " + "createdAt=" + createdAt + "}";
    }
}
