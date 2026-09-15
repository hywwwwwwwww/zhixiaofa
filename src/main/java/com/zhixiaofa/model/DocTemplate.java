package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * 法律文书模板 实体类，对应数据库表 {@code doc_template}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class DocTemplate implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 模板主键 */
    private Long id;
    /** 模板编码 */
    private String code;
    /** 模板名称 */
    private String name;
    /** 分类 */
    private String category;
    /** 模板说明 */
    private String description;
    /** 模板正文（含占位符） */
    private String contentTemplate;
    /** 排序号 */
    private Integer sortNo;
    /** 是否启用 */
    private Integer enabled;
    /** 创建时间 */
    private LocalDateTime createdAt;

    /* ---------------- 非数据库字段（关联查询/展示用） ---------------- */
    /** 占位符列表（解析得出） */
    private java.util.List<String> placeholders;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getContentTemplate() {
        return contentTemplate;
    }

    public void setContentTemplate(String contentTemplate) {
        this.contentTemplate = contentTemplate;
    }

    public Integer getSortNo() {
        return sortNo;
    }

    public void setSortNo(Integer sortNo) {
        this.sortNo = sortNo;
    }

    public Integer getEnabled() {
        return enabled;
    }

    public void setEnabled(Integer enabled) {
        this.enabled = enabled;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public java.util.List<String> getPlaceholders() {
        return placeholders;
    }

    public void setPlaceholders(java.util.List<String> placeholders) {
        this.placeholders = placeholders;
    }

    @Override
    public String toString() {
        return "DocTemplate{" + "id=" + id + ", " + "code=" + code + ", " + "name=" + name + ", " + "category=" + category + ", " + "description=" + description + ", " + "contentTemplate=" + contentTemplate + ", " + "sortNo=" + sortNo + ", " + "enabled=" + enabled + ", " + "createdAt=" + createdAt + "}";
    }
}
