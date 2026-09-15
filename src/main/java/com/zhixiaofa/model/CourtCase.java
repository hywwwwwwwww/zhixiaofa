package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * AI小法庭案件推演记录 实体类，对应数据库表 {@code court_case}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class CourtCase implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 案件主键 */
    private Long id;
    /** 提交用户ID */
    private Long userId;
    /** 案件标题 */
    private String title;
    /** 案情描述 */
    private String description;
    /** 案件类型 */
    private String caseType;
    /** 胜诉概率(%) */
    private BigDecimal winProbability;
    /** 赔偿下限 */
    private BigDecimal compensationMin;
    /** 赔偿上限 */
    private BigDecimal compensationMax;
    /** 参考类案数量 */
    private Integer similarCount;
    /** 推演结论 */
    private String resultSummary;
    /** 提交时间 */
    private LocalDateTime createdAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 提交人昵称（关联查询） */
    private String userNickname;

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

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getCaseType() {
        return caseType;
    }

    public void setCaseType(String caseType) {
        this.caseType = caseType;
    }

    public BigDecimal getWinProbability() {
        return winProbability;
    }

    public void setWinProbability(BigDecimal winProbability) {
        this.winProbability = winProbability;
    }

    public BigDecimal getCompensationMin() {
        return compensationMin;
    }

    public void setCompensationMin(BigDecimal compensationMin) {
        this.compensationMin = compensationMin;
    }

    public BigDecimal getCompensationMax() {
        return compensationMax;
    }

    public void setCompensationMax(BigDecimal compensationMax) {
        this.compensationMax = compensationMax;
    }

    public Integer getSimilarCount() {
        return similarCount;
    }

    public void setSimilarCount(Integer similarCount) {
        this.similarCount = similarCount;
    }

    public String getResultSummary() {
        return resultSummary;
    }

    public void setResultSummary(String resultSummary) {
        this.resultSummary = resultSummary;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getUserNickname() {
        return userNickname;
    }

    public void setUserNickname(String userNickname) {
        this.userNickname = userNickname;
    }

    @Override
    public String toString() {
        return "CourtCase{" + "id=" + id + ", " + "userId=" + userId + ", " + "title=" + title + ", " + "description=" + description + ", " + "caseType=" + caseType + ", " + "winProbability=" + winProbability + ", " + "compensationMin=" + compensationMin + ", " + "compensationMax=" + compensationMax + ", " + "similarCount=" + similarCount + ", " + "resultSummary=" + resultSummary + ", " + "createdAt=" + createdAt + "}";
    }
}
