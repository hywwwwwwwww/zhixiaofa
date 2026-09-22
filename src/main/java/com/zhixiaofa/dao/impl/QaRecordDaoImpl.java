package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.QaRecord;
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
 * QaRecordDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QaRecordDaoImpl implements QaRecordDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：qa_record 全字段 */
    static final RowMapper<QaRecord> MAPPER = rs -> {
        QaRecord x = new QaRecord();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setQuestion(ResultSets.getString(rs, "question"));
        x.setAnswer(ResultSets.getString(rs, "answer"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setStatus(ResultSets.getInteger(rs, "status"));
        x.setLikeCount(ResultSets.getInteger(rs, "like_count"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        x.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
        return x;
    };

    /** 带关联字段的映射（userNickname, userAvatar） */
    static final RowMapper<QaRecord> MAPPER_WITH_USER = rs -> {
        QaRecord x = MAPPER.map(rs);
        x.setUserNickname(ResultSets.getString(rs, "user_nickname"));
        x.setUserAvatar(ResultSets.getString(rs, "user_avatar"));
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
    public Long insert(QaRecord entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO qa_record (user_id, question, answer, category, status, like_count, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", entity.getUserId(), entity.getQuestion(), entity.getAnswer(), entity.getCategory(), entity.getStatus(), entity.getLikeCount(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(QaRecord entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE qa_record SET user_id = ?, question = ?, answer = ?, category = ?, status = ?, like_count = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getUserId(), entity.getQuestion(), entity.getAnswer(), entity.getCategory(), entity.getStatus(), entity.getLikeCount(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM qa_record WHERE id = ?", id);
    }

    @Override
    public QaRecord findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM qa_record WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<QaRecord> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM qa_record ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM qa_record");
    }

    @Override
    public java.util.List<QaRecord> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM qa_record ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<QaRecord> findByUserId(Long userId, int offset, int limit) {
        // 某用户的问答分页
        return JdbcExecutor.queryList(null, "SELECT * FROM qa_record WHERE user_id = ? ORDER BY id DESC LIMIT ?, ?", MAPPER, userId, offset, limit);
    }

    @Override
    public long countByUserId(Long userId) {
        // 某用户的问答总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM qa_record WHERE user_id = ?", userId);
    }

    /** 问答列表可排序的列：前端列名 → 真实列名（白名单，防止 SQL 注入） */
    private static final java.util.Map<String, String> SORTABLE = java.util.Map.of(
            "id", "q.id",
            "likeCount", "q.like_count",
            "createdAt", "q.created_at");

    /** 默认排序：按主键倒序（最新在前） */
    private static final String DEFAULT_ORDER = "q.id DESC";

    @Override
    public java.util.List<QaRecord> findByCondition(String keyword, String category, Integer status, int offset, int limit) {
        return findByCondition(keyword, category, status, offset, limit, null, null);
    }

    @Override
    public java.util.List<QaRecord> findByCondition(String keyword, String category, Integer status,
                                                     int offset, int limit, String sortName, String sortOrder) {
        // 后台问答分页（关联用户昵称 + 可选排序）
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("q.question, q.answer", keyword)
                        .andEq("q.category", category)
                        .andEq("q.status", status);
                return JdbcExecutor.queryList(null,
                        "SELECT q.*, u.nickname AS user_nickname, u.avatar AS user_avatar FROM qa_record q"
                                + " LEFT JOIN sys_user u ON q.user_id = u.id WHERE 1=1" + sb.where()
                                + SqlBuilder.orderBy(sortName, sortOrder, SORTABLE, DEFAULT_ORDER)
                                + " LIMIT ?, ?",
                        MAPPER_WITH_USER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category, Integer status) {
        // 后台问答条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("q.question, q.answer", keyword)
                        .andEq("q.category", category)
                        .andEq("q.status", status);
                return JdbcExecutor.queryCount(null,
                        "SELECT COUNT(*) FROM qa_record q WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public int incrementLike(Long id) {
        // 点赞数 +1
        return JdbcExecutor.update(null, "UPDATE qa_record SET like_count = like_count + 1 WHERE id = ?", id);
    }

    @Override
    public int updateAnswer(Long id, String answer) {
        // 后台补充 / 修改回答
        return JdbcExecutor.update(null, "UPDATE qa_record SET answer = ?, status = 1 WHERE id = ?", answer, id);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 每日提问量（折线图）
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM qa_record WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 问题分类分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(category, '未分类') AS label, COUNT(*) AS value FROM qa_record GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> topQuestions(int limit) {
        // 热门问题榜（柱状图）
        return JdbcExecutor.queryList(null, "SELECT LEFT(question, 20) AS label, like_count AS value FROM qa_record ORDER BY like_count DESC LIMIT ?", STATS_MAPPER, limit);
    }
}
