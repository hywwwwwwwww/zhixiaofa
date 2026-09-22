package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.QuizQuestionDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.QuizQuestion;
import com.zhixiaofa.util.JdbcExecutor;
import com.zhixiaofa.util.ResultSets;

import java.math.BigDecimal;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * QuizQuestionDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QuizQuestionDaoImpl implements QuizQuestionDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：quiz_question 全字段 */
    static final RowMapper<QuizQuestion> MAPPER = rs -> {
        QuizQuestion x = new QuizQuestion();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setQuestion(ResultSets.getString(rs, "question"));
        x.setOptionA(ResultSets.getString(rs, "option_a"));
        x.setOptionB(ResultSets.getString(rs, "option_b"));
        x.setOptionC(ResultSets.getString(rs, "option_c"));
        x.setOptionD(ResultSets.getString(rs, "option_d"));
        x.setCorrectOption(ResultSets.getString(rs, "correct_option"));
        x.setExplanation(ResultSets.getString(rs, "explanation"));
        x.setDifficulty(ResultSets.getInteger(rs, "difficulty"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        return x;
    };

    /** 统计类查询统一的行映射：label + value */
    static final RowMapper<Map<String, Object>> STATS_MAPPER = rs -> {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("label", rs.getString("label"));
        row.put("value", rs.getObject("value"));
        return row;
    };

    /* ---------------- 标准 CRUD ---------------- */

    @Override
    public Long insert(QuizQuestion entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO quiz_question (category, question, option_a, option_b, option_c, option_d, correct_option, explanation, difficulty, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getCategory(), entity.getQuestion(), entity.getOptionA(), entity.getOptionB(), entity.getOptionC(), entity.getOptionD(), entity.getCorrectOption(), entity.getExplanation(), entity.getDifficulty(), entity.getCreatedAt());
    }

    @Override
    public int update(QuizQuestion entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE quiz_question SET category = ?, question = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, explanation = ?, difficulty = ?, created_at = ? WHERE id = ?", entity.getCategory(), entity.getQuestion(), entity.getOptionA(), entity.getOptionB(), entity.getOptionC(), entity.getOptionD(), entity.getCorrectOption(), entity.getExplanation(), entity.getDifficulty(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM quiz_question WHERE id = ?", id);
    }

    @Override
    public QuizQuestion findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM quiz_question WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<QuizQuestion> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM quiz_question ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM quiz_question");
    }

    @Override
    public java.util.List<QuizQuestion> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM quiz_question ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<QuizQuestion> findByCategory(String category) {
        // 按分类取题
        return JdbcExecutor.queryList(null, "SELECT * FROM quiz_question WHERE category = ? ORDER BY id", MAPPER, category);
    }

    @Override
    public java.util.List<QuizQuestion> findRandom(int limit) {
        // 随机抽题（知识自测）
        return JdbcExecutor.queryList(null, "SELECT * FROM quiz_question ORDER BY RAND() LIMIT ?", MAPPER, limit);
    }

    @Override
    public java.util.List<QuizQuestion> findByCondition(String keyword, String category, int offset, int limit) {
        // 后台题目分页
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("question, explanation", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM quiz_question WHERE 1=1" + sb.where() + " ORDER BY id DESC LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category) {
        // 后台题目条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("question, explanation", keyword)
                        .andEq("category", category);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM quiz_question WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 题库分类分布
        return JdbcExecutor.queryList(null, "SELECT IFNULL(category, '未分类') AS label, COUNT(*) AS value FROM quiz_question GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }
}
