package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 普法文章 实体类，对应数据库表 {@code knowledge_article}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class KnowledgeArticle implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 文章主键 */
    private Long id;
    /** 标题 */
    private String title;
    /** 摘要 */
    private String summary;
    /** 正文 */
    private String content;
    /** 分类 */
    private String category;
    /** 作者 */
    private String author;
    /** 阅读量 */
    private Integer viewCount;
    /** 点赞数 */
    private Integer likeCount;
    /** 状态：1已发布 0草稿 */
    private Integer status;
    /** 发布时间 */
    private LocalDateTime publishedAt;
    /** 创建时间 */
    private LocalDateTime createdAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 标签列表（关联查询） */
    private java.util.List<String> tags;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTitle() {
        return title;
    }

    public void setTitle(String title) {
        this.title = title;
    }

    public String getSummary() {
        return summary;
    }

    public void setSummary(String summary) {
        this.summary = summary;
    }

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getAuthor() {
        return author;
    }

    public void setAuthor(String author) {
        this.author = author;
    }

    public Integer getViewCount() {
        return viewCount;
    }

    public void setViewCount(Integer viewCount) {
        this.viewCount = viewCount;
    }

    public Integer getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Integer likeCount) {
        this.likeCount = likeCount;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public LocalDateTime getPublishedAt() {
        return publishedAt;
    }

    public void setPublishedAt(LocalDateTime publishedAt) {
        this.publishedAt = publishedAt;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public java.util.List<String> getTags() {
        return tags;
    }

    public void setTags(java.util.List<String> tags) {
        this.tags = tags;
    }

    @Override
    public String toString() {
        return "KnowledgeArticle{" + "id=" + id + ", " + "title=" + title + ", " + "summary=" + summary + ", " + "content=" + content + ", " + "category=" + category + ", " + "author=" + author + ", " + "viewCount=" + viewCount + ", " + "likeCount=" + likeCount + ", " + "status=" + status + ", " + "publishedAt=" + publishedAt + ", " + "createdAt=" + createdAt + "}";
    }
}
