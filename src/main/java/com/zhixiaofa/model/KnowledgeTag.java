package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 普法文章标签 实体类，对应数据库表 {@code knowledge_tag}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class KnowledgeTag implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 标签主键 */
    private Long id;
    /** 标签名 */
    private String name;
    /** 创建时间 */
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "KnowledgeTag{" + "id=" + id + ", " + "name=" + name + ", " + "createdAt=" + createdAt + "}";
    }
}
