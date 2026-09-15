package com.zhixiaofa.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import java.io.Serializable;
import java.time.LocalDate;
import java.time.LocalDateTime;

/**
 * 知识自测题 实体类，对应数据库表 {@code quiz_question}。
 *
 * <p>本类为纯 POJO（Model 层），只承载数据，不含任何业务逻辑与 SQL。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QuizQuestion implements Serializable {

    private static final long serialVersionUID = 1L;

    /* ---------------- 数据库字段 ---------------- */
    /** 题目主键 */
    private Long id;
    /** 分类 */
    private String category;
    /** 题干 */
    private String question;
    /** 选项A */
    private String optionA;
    /** 选项B */
    private String optionB;
    /** 选项C */
    private String optionC;
    /** 选项D */
    private String optionD;
    /** 正确答案 */
    private String correctOption;
    /** 答案解析 */
    private String explanation;
    /** 难度1-3 */
    private Integer difficulty;
    /** 创建时间 */
    private LocalDateTime createdAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getCategory() {
        return category;
    }

    public void setCategory(String category) {
        this.category = category;
    }

    public String getQuestion() {
        return question;
    }

    public void setQuestion(String question) {
        this.question = question;
    }

    public String getOptionA() {
        return optionA;
    }

    public void setOptionA(String optionA) {
        this.optionA = optionA;
    }

    public String getOptionB() {
        return optionB;
    }

    public void setOptionB(String optionB) {
        this.optionB = optionB;
    }

    public String getOptionC() {
        return optionC;
    }

    public void setOptionC(String optionC) {
        this.optionC = optionC;
    }

    public String getOptionD() {
        return optionD;
    }

    public void setOptionD(String optionD) {
        this.optionD = optionD;
    }

    public String getCorrectOption() {
        return correctOption;
    }

    public void setCorrectOption(String correctOption) {
        this.correctOption = correctOption;
    }

    public String getExplanation() {
        return explanation;
    }

    public void setExplanation(String explanation) {
        this.explanation = explanation;
    }

    public Integer getDifficulty() {
        return difficulty;
    }

    public void setDifficulty(Integer difficulty) {
        this.difficulty = difficulty;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    @Override
    public String toString() {
        return "QuizQuestion{" + "id=" + id + ", " + "category=" + category + ", " + "question=" + question + ", " + "optionA=" + optionA + ", " + "optionB=" + optionB + ", " + "optionC=" + optionC + ", " + "optionD=" + optionD + ", " + "correctOption=" + correctOption + ", " + "explanation=" + explanation + ", " + "difficulty=" + difficulty + ", " + "createdAt=" + createdAt + "}";
    }
}
