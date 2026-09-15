package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 合同风险点 实体类，对应数据库表 {@code contract_risk}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class ContractRisk implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 风险点主键 */
    private Long id;
    /** 所属合同ID */
    private Long contractId;
    /** 风险等级 */
    private String riskLevel;
    /** 条款编号 */
    private String clauseNo;
    /** 问题条款原文 */
    private String clauseContent;
    /** 风险说明 */
    private String riskDesc;
    /** 修改建议 */
    private String suggestion;
    /** 关联法条ID */
    private Long lawId;
    /** 创建时间 */
    private LocalDateTime createdAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 关联法规名称（关联查询） */
    private String lawName;
    /** 关联条号（关联查询） */
    private String lawArticleNo;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getContractId() {
        return contractId;
    }

    public void setContractId(Long contractId) {
        this.contractId = contractId;
    }

    public String getRiskLevel() {
        return riskLevel;
    }

    public void setRiskLevel(String riskLevel) {
        this.riskLevel = riskLevel;
    }

    public String getClauseNo() {
        return clauseNo;
    }

    public void setClauseNo(String clauseNo) {
        this.clauseNo = clauseNo;
    }

    public String getClauseContent() {
        return clauseContent;
    }

    public void setClauseContent(String clauseContent) {
        this.clauseContent = clauseContent;
    }

    public String getRiskDesc() {
        return riskDesc;
    }

    public void setRiskDesc(String riskDesc) {
        this.riskDesc = riskDesc;
    }

    public String getSuggestion() {
        return suggestion;
    }

    public void setSuggestion(String suggestion) {
        this.suggestion = suggestion;
    }

    public Long getLawId() {
        return lawId;
    }

    public void setLawId(Long lawId) {
        this.lawId = lawId;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getLawName() {
        return lawName;
    }

    public void setLawName(String lawName) {
        this.lawName = lawName;
    }

    public String getLawArticleNo() {
        return lawArticleNo;
    }

    public void setLawArticleNo(String lawArticleNo) {
        this.lawArticleNo = lawArticleNo;
    }

    @Override
    public String toString() {
        return "ContractRisk{" + "id=" + id + ", " + "contractId=" + contractId + ", " + "riskLevel=" + riskLevel + ", " + "clauseNo=" + clauseNo + ", " + "clauseContent=" + clauseContent + ", " + "riskDesc=" + riskDesc + ", " + "suggestion=" + suggestion + ", " + "lawId=" + lawId + ", " + "createdAt=" + createdAt + "}";
    }
}
