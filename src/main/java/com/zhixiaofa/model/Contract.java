package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 合同 实体类，对应数据库表 {@code contract}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class Contract implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 合同主键 */
    private Long id;
    /** 上传用户ID */
    private Long userId;
    /** 合同文件名 */
    private String fileName;
    /** 合同类型 */
    private String contractType;
    /** 甲方 */
    private String partyA;
    /** 乙方 */
    private String partyB;
    /** 签订日期 */
    private LocalDate signDate;
    /** 合同正文 */
    private String content;
    /** 整体风险等级 */
    private String riskLevel;
    /** 风险点数量 */
    private Integer riskCount;
    /** 状态：0待审查 1已审查 */
    private Integer status;
    /** 上传时间 */
    private LocalDateTime createdAt;
    /** 更新时间 */
    private LocalDateTime updatedAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 上传人昵称（关联查询） */
    private String userNickname;
    /** 风险点明细（关联查询） */
    private java.util.List<ContractRisk> risks;

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

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getContractType() {
        return contractType;
    }

    public void setContractType(String contractType) {
        this.contractType = contractType;
    }

    public String getPartyA() {
        return partyA;
    }

    public void setPartyA(String partyA) {
        this.partyA = partyA;
    }

    public String getPartyB() {
        return partyB;
    }

    public void setPartyB(String partyB) {
        this.partyB = partyB;
    }

    public LocalDate getSignDate() {
        return signDate;
    }

    public void setSignDate(LocalDate signDate) {
        this.signDate = signDate;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public Integer getRiskCount() {
        return riskCount;
    }

    public void setRiskCount(Integer riskCount) {
        this.riskCount = riskCount;
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

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public String getUserNickname() {
        return userNickname;
    }

    public void setUserNickname(String userNickname) {
        this.userNickname = userNickname;
    }

    public java.util.List<ContractRisk> getRisks() {
        return risks;
    }

    public void setRisks(java.util.List<ContractRisk> risks) {
        this.risks = risks;
    }

    @Override
    public String toString() {
        return "Contract{" + "id=" + id + ", " + "userId=" + userId + ", " + "fileName=" + fileName + ", " + "contractType=" + contractType + ", " + "partyA=" + partyA + ", " + "partyB=" + partyB + ", " + "signDate=" + signDate + ", " + "content=" + content + ", " + "riskLevel=" + riskLevel + ", " + "riskCount=" + riskCount + ", " + "status=" + status + ", " + "createdAt=" + createdAt + ", " + "updatedAt=" + updatedAt + "}";
    }
}
