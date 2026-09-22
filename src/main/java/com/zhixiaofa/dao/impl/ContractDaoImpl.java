package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.Contract;
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
 * ContractDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class ContractDaoImpl implements ContractDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：contract 全字段 */
    static final RowMapper<Contract> MAPPER = rs -> {
        Contract x = new Contract();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setUserId(ResultSets.getLong(rs, "user_id"));
        x.setFileName(ResultSets.getString(rs, "file_name"));
        x.setContractType(ResultSets.getString(rs, "contract_type"));
        x.setPartyA(ResultSets.getString(rs, "party_a"));
        x.setPartyB(ResultSets.getString(rs, "party_b"));
        x.setSignDate(ResultSets.getLocalDate(rs, "sign_date"));
        x.setContent(ResultSets.getString(rs, "content"));
        x.setRiskLevel(ResultSets.getString(rs, "risk_level"));
        x.setRiskCount(ResultSets.getInteger(rs, "risk_count"));
        x.setStatus(ResultSets.getInteger(rs, "status"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        x.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
        return x;
    };

    /** 带关联字段的映射（userNickname） */
    static final RowMapper<Contract> MAPPER_WITH_USER = rs -> {
        Contract x = MAPPER.map(rs);
        x.setUserNickname(ResultSets.getString(rs, "user_nickname"));
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
    public Long insert(Contract entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO contract (user_id, file_name, contract_type, party_a, party_b, sign_date, content, risk_level, risk_count, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getUserId(), entity.getFileName(), entity.getContractType(), entity.getPartyA(), entity.getPartyB(), entity.getSignDate(), entity.getContent(), entity.getRiskLevel(), entity.getRiskCount(), entity.getStatus(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(Contract entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE contract SET user_id = ?, file_name = ?, contract_type = ?, party_a = ?, party_b = ?, sign_date = ?, content = ?, risk_level = ?, risk_count = ?, status = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getUserId(), entity.getFileName(), entity.getContractType(), entity.getPartyA(), entity.getPartyB(), entity.getSignDate(), entity.getContent(), entity.getRiskLevel(), entity.getRiskCount(), entity.getStatus(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM contract WHERE id = ?", id);
    }

    @Override
    public Contract findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM contract WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<Contract> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM contract ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM contract");
    }

    @Override
    public java.util.List<Contract> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM contract ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<Contract> findByUserId(Long userId, int offset, int limit) {
        // 某用户的合同分页
        return JdbcExecutor.queryList(null, "SELECT * FROM contract WHERE user_id = ? ORDER BY id DESC LIMIT ?, ?", MAPPER, userId, offset, limit);
    }

    @Override
    public long countByUserId(Long userId) {
        // 某用户的合同数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM contract WHERE user_id = ?", userId);
    }

    /** 合同列表可排序的列：前端列名 → 真实列名（白名单，防止 SQL 注入） */
    private static final java.util.Map<String, String> SORTABLE = java.util.Map.of(
            "id", "c.id",
            "riskLevel", "c.risk_level",
            "riskCount", "c.risk_count",
            "createdAt", "c.created_at");

    /** 默认排序：按 id 倒序（最新在前） */
    private static final String DEFAULT_ORDER = "c.id DESC";

    @Override
    public java.util.List<Contract> findByCondition(String keyword, String riskLevel, Integer status, int offset, int limit) {
        return findByCondition(keyword, riskLevel, status, offset, limit, null, null);
    }

    @Override
    public java.util.List<Contract> findByCondition(String keyword, String riskLevel, Integer status,
                                                    int offset, int limit, String sortName, String sortOrder) {
        // 后台合同分页（关键词 + 风险等级 + 状态 + 可选排序）
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("c.file_name, c.party_a, c.party_b", keyword)
                        .andEq("c.risk_level", riskLevel)
                        .andEq("c.status", status);
                return JdbcExecutor.queryList(null,
                        "SELECT c.*, u.nickname AS user_nickname FROM contract c"
                                + " LEFT JOIN sys_user u ON c.user_id = u.id WHERE 1=1" + sb.where()
                                + SqlBuilder.orderBy(sortName, sortOrder, SORTABLE, DEFAULT_ORDER)
                                + " LIMIT ?, ?",
                        MAPPER_WITH_USER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String riskLevel, Integer status) {
        // 后台合同条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andLike("c.file_name, c.party_a, c.party_b", keyword)
                        .andEq("c.risk_level", riskLevel)
                        .andEq("c.status", status);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM contract c WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public int updateAfterReview(Long id, String riskLevel, Integer riskCount) {
        // 审查完成后回写整体风险等级与风险点数量
        return JdbcExecutor.update(null, "UPDATE contract SET risk_level = ?, risk_count = ?, status = 1 WHERE id = ?", riskLevel, riskCount, id);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByRiskLevel() {
        // 风险等级分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT IFNULL(risk_level, '未评估') AS label, COUNT(*) AS value FROM contract GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByType() {
        // 合同类型分布
        return JdbcExecutor.queryList(null, "SELECT IFNULL(contract_type, '其他') AS label, COUNT(*) AS value FROM contract GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countByDay(int days) {
        // 每日上传量
        return JdbcExecutor.queryList(null, "SELECT DATE_FORMAT(created_at, '%Y-%m-%d') AS label, COUNT(*) AS value FROM contract WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY) GROUP BY label ORDER BY label", STATS_MAPPER, days);
    }
}
