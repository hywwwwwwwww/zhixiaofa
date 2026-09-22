package com.zhixiaofa.dao.impl;

import java.util.ArrayList;
import java.util.List;

/**
 * 动态 WHERE 条件构造器：把「按条件拼 SQL」这件事收敛成一个可复用的链式工具。
 *
 * <p>为什么不用 MyBatis 那种动态 SQL？因为课程要求禁用框架、纯手写 JDBC；</p>
 * <p>为什么不用字符串拼接？因为拼接用户输入会导致 SQL 注入。</p>
 *
 * <p>本类的做法是：拼进 SQL 的永远是<b>调用方写死的常量列名</b>与 <b>? 占位符</b>，
 * 用户输入只进 {@link #args()} 作为参数绑定，二者彻底分离。
 * 例如：</p>
 * <pre>
 * SqlBuilder sb = SqlBuilder.of()
 *         .andLike("q.question, q.answer", keyword)
 *         .andEq("q.category", category)
 *         .andEq("q.status", status);
 * String sql = "SELECT * FROM qa_record q WHERE 1=1" + sb.where() + " ORDER BY q.id DESC LIMIT ?, ?";
 * JdbcExecutor.queryList(null, sql, MAPPER, sb.with(offset, limit));
 * </pre>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class SqlBuilder {

    private final StringBuilder where = new StringBuilder();
    private final List<Object> args = new ArrayList<>();

    private SqlBuilder() {
    }

    public static SqlBuilder of() {
        return new SqlBuilder();
    }

    /**
     * 多列模糊匹配（OR 关系）。
     *
     * @param columns 常量列名串，如 {@code "q.question, q.answer"}，绝不能来自用户输入
     * @param value   用户输入的关键词，为空时该条件不生效
     */
    public SqlBuilder andLike(String columns, String value) {
        if (value != null && !value.trim().isEmpty()) {
            where.append(" AND (").append(columns).append(" LIKE CONCAT('%', ?, '%')) ");
            args.add(value.trim());
        }
        return this;
    }

    /**
     * 等值匹配。空字符串与 null 都会跳过该条件。
     *
     * @param column 常量列名，如 {@code "q.status"}
     * @param value  条件值
     */
    public SqlBuilder andEq(String column, Object value) {
        if (isBlank(value)) {
            return this;
        }
        where.append(" AND ").append(column).append(" = ? ");
        args.add(value instanceof String ? ((String) value).trim() : value);
        return this;
    }

    /** 大于等于 */
    public SqlBuilder andGe(String column, Object value) {
        if (isBlank(value)) {
            return this;
        }
        where.append(" AND ").append(column).append(" >= ? ");
        args.add(value);
        return this;
    }

    /** 小于等于 */
    public SqlBuilder andLe(String column, Object value) {
        if (isBlank(value)) {
            return this;
        }
        where.append(" AND ").append(column).append(" <= ? ");
        args.add(value);
        return this;
    }

    /** 范围（用于日期筛选） */
    public SqlBuilder andBetween(String column, Object from, Object to) {
        if (!isBlank(from)) {
            andGe(column, from);
        }
        if (!isBlank(to)) {
            andLe(column, to);
        }
        return this;
    }

    /**
     * 全文检索条件（走 MySQL ngram 全文索引）。
     *
     * <p>用 {@code MATCH ... AGAINST} 代替 {@code LIKE '%kw%'}：
     * 后者无法使用索引，数据量上来后退化成全表扫描。</p>
     *
     * @param columns 参与检索的常量列名串，如 {@code "title, content, keywords"}
     * @param keyword 关键词，为空时该条件不生效（避免 MATCH 匹配 NULL 导致查不到任何数据）
     */
    public SqlBuilder andMatch(String columns, String keyword) {
        if (keyword == null || keyword.trim().isEmpty()) {
            return this;
        }
        where.append(" AND MATCH(").append(columns)
             .append(") AGAINST (? IN NATURAL LANGUAGE MODE) ");
        args.add(keyword.trim());
        return this;
    }

    /** 直接追加一个自定义条件片段（片段必须只含常量 SQL 与 ?） */
    public SqlBuilder andFragment(String fragment, Object... values) {
        if (fragment == null || fragment.trim().isEmpty()) {
            return this;
        }
        where.append(" AND ").append(fragment).append(' ');
        if (values != null) {
            for (Object v : values) {
                args.add(v);
            }
        }
        return this;
    }

    /** @return 可直接拼到 "WHERE 1=1" 之后的 SQL 片段，无条件时返回空串 */
    public String where() {
        return where.toString();
    }

    /** @return 当前已收集的参数 */
    public List<Object> argsList() {
        return args;
    }

    /** @return 参数数组 */
    public Object[] args() {
        return args.toArray();
    }

    /**
     * 把「条件参数」与「额外的参数（如分页的 offset/limit、排序值）」拼成一个数组，
     * 保证占位符顺序与 SQL 中出现的顺序一致。
     */
    public Object[] with(Object... more) {
        int base = args.size();
        int extra = more == null ? 0 : more.length;
        Object[] all = new Object[base + extra];
        for (int i = 0; i < base; i++) {
            all[i] = args.get(i);
        }
        if (extra > 0) {
            System.arraycopy(more, 0, all, base, extra);
        }
        return all;
    }

    private static boolean isBlank(Object v) {
        return v == null || (v instanceof String && ((String) v).trim().isEmpty());
    }
}
