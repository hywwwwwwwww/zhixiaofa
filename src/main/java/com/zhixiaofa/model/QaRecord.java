package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 智能法律问答记录 实体类，对应数据库表 {@code qa_record}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QaRecord implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 问答主键 */
    private Long id;
    /** 提问用户ID */
    private Long userId;
    /** 用户问题 */
    private String question;
    /** 系统回答 */
    private String answer;
    /** 问题分类 */
    private String category;
    /** 状态：0待回答 1已回答 */
    private Integer status;
    /** 点赞数 */
    private Integer likeCount;
    /** 提问时间 */
    private LocalDateTime createdAt;
    /** 更新时间 */
    private LocalDateTime updatedAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 提问人昵称（关联查询） */
    private String userNickname;
    /** 提问人头像（关联查询） */
    private String userAvatar;
    /** 引用的法条列表（关联查询） */
    private java.util.List<LawArticle> references;
    /** 当前用户是否已收藏 */
    private Boolean favorited;
    /** 友好时间文案 */
    private String createdAtText;

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

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public Integer getStatus() {
        return status;
    }

    public void setStatus(Integer status) {
        this.status = status;
    }

    public Integer getLikeCount() {
        return likeCount;
    }

    public void setLikeCount(Integer likeCount) {
        this.likeCount = likeCount;
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

    public String getUserAvatar() {
        return userAvatar;
    }

    public void setUserAvatar(String userAvatar) {
        this.userAvatar = userAvatar;
    }

    public java.util.List<LawArticle> getReferences() {
        return references;
    }

    public void setReferences(java.util.List<LawArticle> references) {
        this.references = references;
    }

    public Boolean getFavorited() {
        return favorited;
    }

    public void setFavorited(Boolean favorited) {
        this.favorited = favorited;
    }

    public String getCreatedAtText() {
        return createdAtText;
    }

    public void setCreatedAtText(String createdAtText) {
        this.createdAtText = createdAtText;
    }

    @Override
    public String toString() {
        return "QaRecord{" + "id=" + id + ", " + "userId=" + userId + ", " + "question=" + question + ", " + "answer=" + answer + ", " + "category=" + category + ", " + "status=" + status + ", " + "likeCount=" + likeCount + ", " + "createdAt=" + createdAt + ", " + "updatedAt=" + updatedAt + "}";
    }
}
