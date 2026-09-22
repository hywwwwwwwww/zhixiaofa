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
     * <p>支持传入多个列（逗号分隔）：{@code "q.question, q.answer"} 会展开成</p>
     * <pre>(q.question LIKE CONCAT('%', ?, '%') OR q.answer LIKE CONCAT('%', ?, '%'))</pre>
     *
     * <p><b>修复记录</b>：原实现直接把整个 {@code columns} 串当成「一个列名」拼进 SQL，
     * 于是多列调用会生成 {@code (q.question, q.answer LIKE ...)} 这种逗号表达式，
     * 触发 SQL 语法错误（DaoException）。由于 8 个 DAO 都按本方法的注释传入多列
     * （问答 / 合同 / 模板 / 日志 / 题库 / 用户 / AI小法庭 / 文书记录），
     * 导致这些模块的<b>关键词搜索一搜就报 500</b>。</p>
     *
     * @param columns 常量列名串（可含多个列，逗号分隔），绝不能来自用户输入
     * @param value   用户输入的关键词，为空时该条件不生效
     */
    public SqlBuilder andLike(String columns, String value) {
        if (value == null || value.trim().isEmpty()) {
            return this;
        }
        String kw = value.trim();
        where.append(" AND (");
        boolean first = true;
        for (String raw : columns.split(",")) {
            String col = raw.trim();
            if (col.isEmpty()) {
                continue;
            }
            if (!first) {
                where.append(" OR ");
            }
            // 每一列各占一个 ?，参数需按列逐个绑定
            where.append(col).append(" LIKE CONCAT('%', ?, '%')");
            args.add(kw);
            first = false;
        }
        where.append(") ");
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

    /**
     * 生成排序子句，供前端点击列头切换升降序。
     *
     * <p><b>为什么需要白名单</b>：ORDER BY 的列名<b>无法用 {@code ?} 参数化</b>，
     * 只能拼进 SQL 字符串。若直接把前端传来的列名拼进去就是 SQL 注入漏洞。
     * 因此这里用「前端字段名 → 真实列名」的映射表：前端值<b>只作为 key 查表</b>，
     * 查不到就回退到默认排序，永远不会把用户输入拼进 SQL。</p>
     *
     * @param sortName  前端传来的排序列名（如 {@code "publishedAt"}）
     * @param order     排序方向，仅识别 {@code desc}（其余一律按 asc）
     * @param whitelist 白名单映射：key=前端列名，value=真实列名（可带表别名），
     *                  例如 {@code Map.of("publishedAt", "published_at", "viewCount", "view_count")}
     * @param fallback  未命中白名单时使用的默认排序（常量 SQL 片段，如 {@code "published_at DESC, id DESC"}）
     * @return 以 {@code " ORDER BY "} 开头的完整片段
     */
    public static String orderBy(String sortName, String order,
                                 java.util.Map<String, String> whitelist, String fallback) {
        String col = (whitelist == null || sortName == null) ? null : whitelist.get(sortName);
        if (col == null || col.trim().isEmpty()) {
            return " ORDER BY " + fallback;
        }
        return " ORDER BY " + col + ("desc".equalsIgnoreCase(order) ? " DESC" : " ASC");
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
