package com.zhixiaofa.dao.impl;

import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.RowMapper;
import com.zhixiaofa.model.LawArticle;
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
 * LawArticleDao 的 JDBC 实现。
 *
 * <p>所有 SQL 都通过 {@link java.sql.PreparedStatement} 预编译、占位符绑定参数，从根本上杜绝 SQL 注入；</p>
 * <p>动态条件交给 {@link SqlBuilder}，拼进 SQL 的只有常量列名与 ? 占位符，用户输入一律进参数槽。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LawArticleDaoImpl implements LawArticleDao {

    /* ---------------- 结果集映射 ---------------- */

    /** 基础映射：law_article 全字段 */
    static final RowMapper<LawArticle> MAPPER = rs -> {
        LawArticle x = new LawArticle();
        x.setId(ResultSets.getLong(rs, "id"));
        x.setLawName(ResultSets.getString(rs, "law_name"));
        x.setArticleNo(ResultSets.getString(rs, "article_no"));
        x.setSeq(ResultSets.getInteger(rs, "seq"));
        x.setCategory(ResultSets.getString(rs, "category"));
        x.setTitle(ResultSets.getString(rs, "title"));
        x.setContent(ResultSets.getString(rs, "content"));
        x.setKeywords(ResultSets.getString(rs, "keywords"));
        x.setEffectiveDate(ResultSets.getLocalDate(rs, "effective_date"));
        x.setSource(ResultSets.getString(rs, "source"));
        x.setSourceId(ResultSets.getString(rs, "source_id"));
        x.setCreatedAt(ResultSets.getLocalDateTime(rs, "created_at"));
        x.setUpdatedAt(ResultSets.getLocalDateTime(rs, "updated_at"));
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
    public Long insert(LawArticle entity) {
        // 新增，返回自增主键
        return JdbcExecutor.insertAndReturnKey(null, "INSERT INTO law_article (law_name, article_no, seq, category, title, content, keywords, effective_date, source, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", entity.getLawName(), entity.getArticleNo(), entity.getSeq(), entity.getCategory(), entity.getTitle(), entity.getContent(), entity.getKeywords(), entity.getEffectiveDate(), entity.getSource(), entity.getSourceId(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int update(LawArticle entity) {
        // 按主键更新全部字段
        return JdbcExecutor.update(null, "UPDATE law_article SET law_name = ?, article_no = ?, seq = ?, category = ?, title = ?, content = ?, keywords = ?, effective_date = ?, source = ?, source_id = ?, created_at = ?, updated_at = ? WHERE id = ?", entity.getLawName(), entity.getArticleNo(), entity.getSeq(), entity.getCategory(), entity.getTitle(), entity.getContent(), entity.getKeywords(), entity.getEffectiveDate(), entity.getSource(), entity.getSourceId(), entity.getCreatedAt(), entity.getUpdatedAt(), entity.getId());
    }

    @Override
    public int deleteById(Long id) {
        // 按主键删除
        return JdbcExecutor.update(null, "DELETE FROM law_article WHERE id = ?", id);
    }

    @Override
    public LawArticle findById(Long id) {
        // 按主键查询，不存在返回 null
        return JdbcExecutor.queryOne(null, "SELECT * FROM law_article WHERE id = ?", MAPPER, id);
    }

    @Override
    public LawArticle findByLawNameAndNo(String lawName, String articleNo) {
        // 按「法规名称 + 条号」查询，用于同步去重
        return JdbcExecutor.queryOne(null,
                "SELECT * FROM law_article WHERE law_name = ? AND article_no = ?", MAPPER, lawName, articleNo);
    }

    @Override
    public int upsert(LawArticle entity) {
        // 存在则更新、不存在则插入（唯一键 uk_law_name_no：law_name + article_no）。
        //
        // 重要：UPDATE 分支**不覆盖 content / seq / source** ——
        // 正文与序号的权威来源是「官方文档导入」，自动同步只负责
        // 更新元数据（分类 / 章节 / 关键词 / 生效日期 / 来源标识）。
        // 否则同步用「命中接口」抓到的残片会覆盖文档导入的完整正文，
        // 并按降级路径重设 seq 导致序号冲突。
        //
        // 【2026-09-21/22 本项目改动】category 也不能无条件覆盖：
        //   实测自动同步会把已有分类统一改写成它的粗分类（如把 解除与终止 / 保密与竞业限制 /
        //   劳动报酬 一律变成 劳动合同），表现为筛选下拉里「分类变少、分布失真」。
        //   故规则改为：**只在原分类为空时才由同步补写**，已有分类一律保留。
        //   （2026-09-22 完整数据导入后 source 只有 flk_npc / doc_import、没有 manual，
        //     原先只保护 manual 的写法会全部失效，故改为按「分类是否为空」判断。）
        return JdbcExecutor.update(null,
                "INSERT INTO law_article (law_name, article_no, seq, category, title, content, keywords, effective_date, source, source_id, created_at, updated_at) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) " +
                        "ON DUPLICATE KEY UPDATE " +
                        "category = IF(category IS NULL OR category = '', VALUES(category), category), " +
                        "title = IF(VALUES(title) IS NULL OR VALUES(title) = '', title, VALUES(title)), " +
                        "keywords = IF(VALUES(keywords) IS NULL OR VALUES(keywords) = '', keywords, VALUES(keywords)), " +
                        "effective_date = IF(VALUES(effective_date) IS NULL, effective_date, VALUES(effective_date)), " +
                        "source_id = IF(VALUES(source_id) IS NULL, source_id, VALUES(source_id)), " +
                        "updated_at = VALUES(updated_at)",
                entity.getLawName(), entity.getArticleNo(), entity.getSeq(), entity.getCategory(), entity.getTitle(),
                entity.getContent(), entity.getKeywords(), entity.getEffectiveDate(),
                entity.getSource(), entity.getSourceId(), entity.getCreatedAt(), entity.getUpdatedAt());
    }

    @Override
    public int updateSeq(Long id, int seq) {
        // 只更新「法律内序号」一列，用于重排序号
        return JdbcExecutor.update(null, "UPDATE law_article SET seq = ? WHERE id = ?", seq, id);
    }

    @Override
    public java.util.List<LawArticle> findAll() {
        // 查询全部
        return JdbcExecutor.queryList(null, "SELECT * FROM law_article ORDER BY id", MAPPER);
    }

    @Override
    public long countAll() {
        // 统计总数
        return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM law_article");
    }

    @Override
    public java.util.List<LawArticle> findByPage(int offset, int limit) {
        // 通用分页（offset/limit）
        return JdbcExecutor.queryList(null, "SELECT * FROM law_article ORDER BY id LIMIT ?, ?", MAPPER, offset, limit);
    }

    /* ---------------- 业务查询 / 统计 ---------------- */

    @Override
    public java.util.List<LawArticle> findByCondition(String keyword, String category, String lawName, int offset, int limit) {
        // 按关键词全文检索 + 分类 / 法规名筛选分页（ngram 全文索引，避免 LIKE 全表扫描）
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, content, keywords", keyword)
                        .andEq("category", category)
                        .andEq("law_name", lawName);
                return JdbcExecutor.queryList(null,
                        "SELECT * FROM law_article WHERE 1=1" + sb.where() + " ORDER BY law_name, seq, id LIMIT ?, ?",
                        MAPPER, sb.with(offset, limit));
    }

    @Override
    public long countByCondition(String keyword, String category, String lawName) {
        // 法条条件计数
        SqlBuilder sb = SqlBuilder.of()
                        .andMatch("title, content, keywords", keyword)
                        .andEq("category", category)
                        .andEq("law_name", lawName);
                return JdbcExecutor.queryCount(null, "SELECT COUNT(*) FROM law_article WHERE 1=1" + sb.where(), sb.args());
    }

    @Override
    public java.util.List<String> listLawNames() {
        // 去重列出全部法规名称，供「法律管理」页下拉选择
        return JdbcExecutor.queryList(null,
                "SELECT DISTINCT law_name FROM law_article ORDER BY law_name",
                rs -> rs.getString("law_name"));
    }

    @Override
    public java.util.List<String> listCategories() {
        // 只列出实际有法条的分类，用于过滤掉空分类
        return JdbcExecutor.queryList(null,
                "SELECT DISTINCT category FROM law_article ORDER BY category",
                rs -> rs.getString("category"));
    }

    @Override
    public java.util.List<LawArticle> findByIds(java.util.List<Long> ids) {
        // 按主键集合批量查询
        if (ids == null || ids.isEmpty()) {
                    return new ArrayList<>();
                }
                StringBuilder sb = new StringBuilder("SELECT * FROM law_article WHERE id IN (");
                for (int i = 0; i < ids.size(); i++) {
                    sb.append(i == 0 ? "?" : ",?");
                }
                sb.append(") ORDER BY id");
                return JdbcExecutor.queryList(null, sb.toString(), MAPPER, ids.toArray());
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByCategory() {
        // 法条分类分布（饼图）
        return JdbcExecutor.queryList(null, "SELECT category AS label, COUNT(*) AS value FROM law_article GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> countGroupByLaw() {
        // 按法规统计
        return JdbcExecutor.queryList(null, "SELECT law_name AS label, COUNT(*) AS value FROM law_article GROUP BY label ORDER BY value DESC", STATS_MAPPER);
    }
}
