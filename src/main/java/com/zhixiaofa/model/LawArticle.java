package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 法律法规条文 实体类，对应数据库表 {@code law_article}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LawArticle implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 法条主键 */
    private Long id;
    /** 法规名称 */
    private String lawName;
    /** 条号 */
    private String articleNo;
    /** 法律内序号（该法律的第几条，从 1 开始） */
    private Integer seq;
    /** 分类 */
    private String category;
    /** 条文标题 */
    private String title;
    /** 条文正文 */
    private String content;
    /** 关键词 */
    private String keywords;
    /** 生效日期 */
    private LocalDate effectiveDate;
    /** 数据来源：manual=手工录入；flk_npc=国家法律法规数据库自动同步 */
    private String source;
    /** 来源侧唯一标识（国家法律法规数据库的 bbbs，用于去重/增量更新） */
    private String sourceId;
    /** 创建时间 */
    private LocalDateTime createdAt;
    /** 更新时间 */
    private LocalDateTime updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getLawName() {
        return lawName;
    }

    public void setLawName(String lawName) {
        this.lawName = lawName;
    }

    public String getArticleNo() {
        return articleNo;
    }

    public void setArticleNo(String articleNo) {
        this.articleNo = articleNo;
    }

    public Integer getSeq() {
        return seq;
    }

    public void setSeq(Integer seq) {
        this.seq = seq;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getKeywords() {
        return keywords;
    }

    public void setKeywords(String keywords) {
        this.keywords = keywords;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public LocalDate getEffectiveDate() {
        return effectiveDate;
    }

    public void setEffectiveDate(LocalDate effectiveDate) {
        this.effectiveDate = effectiveDate;
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

    @Override
    public String toString() {
        return "LawArticle{" + "id=" + id + ", " + "lawName=" + lawName + ", " + "articleNo=" + articleNo + ", " + "category=" + category + ", " + "title=" + title + ", " + "content=" + content + ", " + "keywords=" + keywords + ", " + "effectiveDate=" + effectiveDate + ", " + "createdAt=" + createdAt + ", " + "updatedAt=" + updatedAt + "}";
    }
}
