package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.ContractRiskDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.ContractRisk;
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
 * ContractRiskDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class ContractRiskDaoImpl implements ContractRiskDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：contract_risk 全字段 */
    static final RowMapper<ContractRisk> MAPPER = rs -> {
        ContractRisk x = new ContractRisk();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setContractId(ResultSets.getLong(rs, "contract_id"));
        x.setRiskLevel(ResultSets.getString(rs, "risk_level"));
        x.setClauseNo(ResultSets.getString(rs, "clause_no"));
        x.setClauseContent(ResultSets.getString(rs, "clause_content"));
        x.setRiskDesc(ResultSets.getString(rs, "risk_desc"));
        x.setSuggestion(ResultSets.getString(rs, "suggestion"));
        x.setLawId(ResultSets.getLong(rs, "law_id"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        return x;
    };

    /** 带关联字段的映射（lawName, lawArticleNo） */
    static final RowMapper<ContractRisk> MAPPER_WITH_LAW = rs -> {
        ContractRisk x = MAPPER.map(rs);
        x.setLawName(ResultSets.getString(rs, "law_name"));
        x.setLawArticleNo(ResultSets.getString(rs, "law_article_no"));
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
    public Long insert(ContractRisk entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO contract_risk (contract_id, risk_level, clause_no, clause_content, risk_desc, suggestion, law_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", entity.getContractId(), entity.getRiskLevel(), entity.getClauseNo(), entity.getClauseContent(), entity.getRiskDesc(), entity.getSuggestion(), entity.getLawId(), entity.getCreatedAt());
    }

    @Override
    public int update(ContractRisk entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE contract_risk SET contract_id = ?, risk_level = ?, clause_no = ?, clause_content = ?, risk_desc = ?, suggestion = ?, law_id = ?, created_at = ? WHERE id = ?", entity.getContractId(), entity.getRiskLevel(), entity.getClauseNo(), entity.getClauseContent(), entity.getRiskDesc(), entity.getSuggestion(), entity.getLawId(), entity.getCreatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM contract_risk WHERE id = ?", id);
    }

    @Override
    public ContractRisk findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM contract_risk WHERE id = ?", MAPPER, id);
    }

    @Override
    public java.util.List<ContractRisk> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM contract_risk ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM contract_risk");
    }

    @Override
    public java.util.List<ContractRisk> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM contract_risk ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<ContractRisk> findByContractId(Long contractId) {
        // 某合同的风险点明细（关联出法条名称，高风险在前）
        return JdbcExecutor.queryList(null,
                        "SELECT r.*, l.law_name, l.article_no AS law_article_no FROM contract_risk r"
                                + " LEFT JOIN law_article l ON r.law_id = l.id WHERE r.contract_id = ?"
                                + " ORDER BY FIELD(r.risk_level, '高', '中', '低'), r.id", MAPPER_WITH_LAW, contractId);
    }

    @Override
    public int deleteByContractId(Long contractId) {
        // 删除某合同的风险点
        return JdbcExecutor.update(null, "DELETE FROM contract_risk WHERE contract_id = ?", contractId);
    }

    @Override
    public int insertRisk(Connection conn, ContractRisk risk) {
        // 在事务中写入风险点
        return JdbcExecutor.update(conn, "INSERT INTO contract_risk (contract_id, risk_level, clause_no, clause_content, risk_desc, suggestion, law_id) VALUES (?, ?, ?, ?, ?, ?, ?)", risk.getContractId(), risk.getRiskLevel(), risk.getClauseNo(), risk.getClauseContent(), risk.getRiskDesc(), risk.getSuggestion(), risk.getLawId());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByLevel() {
        // 风险点等级分布
        return JdbcExecutor.queryList(null, "SELECT risk_level AS label, COUNT(*) AS value FROM contract_risk GROUP BY label ORDER BY FIELD(label, '高', '中', '低')", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> topRiskClauses(int limit) {
        // 高频风险条款 TopN
        return JdbcExecutor.queryList(null, "SELECT IFNULL(clause_no, '未标注') AS label, COUNT(*) AS value FROM contract_risk GROUP BY label ORDER BY value DESC LIMIT ?", STATS_MAPPER, limit);
    }
}
