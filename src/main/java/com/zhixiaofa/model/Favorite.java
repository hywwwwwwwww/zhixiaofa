package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 收藏 实体类，对应数据库表 {@code favorite}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class Favorite implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 主键 */
    private Long id;
    /** 用户ID */
    private Long userId;
    /** 收藏类型 QA/ARTICLE/LAW/DOC */
    private String targetType;
    /** 收藏对象ID */
    private Long targetId;
    /** 收藏时间 */
    private LocalDateTime createdAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 收藏对象标题（关联查询） */
    private String targetTitle;
    /** 收藏对象摘要（关联查询） */
    private String targetSummary;

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

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public Long getTargetId() {
        return targetId;
    }

    public void setTargetId(Long targetId) {
        this.targetId = targetId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getTargetTitle() {
        return targetTitle;
    }

    public void setTargetTitle(String targetTitle) {
        this.targetTitle = targetTitle;
    }

    public String getTargetSummary() {
        return targetSummary;
    }

    public void setTargetSummary(String targetSummary) {
        this.targetSummary = targetSummary;
    }

    @Override
    public String toString() {
        return "Favorite{" + "id=" + id + ", " + "userId=" + userId + ", " + "targetType=" + targetType + ", " + "targetId=" + targetId + ", " + "createdAt=" + createdAt + "}";
    }
}
