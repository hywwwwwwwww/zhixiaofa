package com.zhixiaofa.dao.impl;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 动态条件构造器单元测试：重点验证「SQL 片段只含常量与占位符」以及
 * 「参数顺序与占位符顺序一致」这两个安全/正确性关键点。
 */
@DisplayName("SqlBuilder 动态条件构造测试")
class SqlBuilderTest {

    @Test
    @DisplayName("无条件时 where() 为空串，args 为空")
    void emptyBuilder() {
        SqlBuilder sb = SqlBuilder.of();
        assertEquals("", sb.where());
        assertEquals(0, sb.args().length);
    }

    @Test
    @DisplayName("andEq / andLike 生成占位符而非拼接用户输入")
    void buildConditionsSafely() {
        SqlBuilder sb = SqlBuilder.of()
                .andLike("q.question, q.answer", "试用期")
                .andEq("q.category", "劳动合同")
                .andEq("q.status", 1);
        String where = sb.where();
        assertTrue(where.contains("LIKE CONCAT('%', ?, '%')"));
        assertTrue(where.contains("q.category = ?"));
        assertTrue(where.contains("q.status = ?"));
        assertFalse(where.contains("试用期"), "用户输入绝不能出现在 SQL 片段里");
        assertFalse(where.contains("劳动合同"), "用户输入绝不能出现在 SQL 片段里");
        assertEquals(3, sb.args().length);
    }

    @Test
    @DisplayName("空字符串与 null 条件自动跳过")
    void blankValuesAreSkipped() {
        SqlBuilder sb = SqlBuilder.of()
                .andEq("a", null)
                .andEq("b", "  ")
                .andLike("c", "")
                .andLike("d", null)
                .andEq("e", "ok");
        assertEquals(1, sb.args().length);
        assertTrue(sb.where().contains("e = ?"));
    }

    @Test
    @DisplayName("with() 把分页参数追加在条件参数之后，顺序正确")
    void withAppendsAfterConditions() {
        SqlBuilder sb = SqlBuilder.of().andEq("status", 1);
        Object[] args = sb.with(20, 10);
        assertEquals(3, args.length);
        assertEquals(1, args[0]);
        assertEquals(20, args[1]);
        assertEquals(10, args[2]);
    }

    @Test
    @DisplayName("andMatch：有关键词才生成全文检索条件")
    void andMatchOnlyWhenKeywordPresent() {
        SqlBuilder withKw = SqlBuilder.of().andMatch("title, content", "拖欠工资");
        assertTrue(withKw.where().contains("MATCH(title, content) AGAINST (? IN NATURAL LANGUAGE MODE)"));
        assertEquals(1, withKw.args().length);

        SqlBuilder noKw = SqlBuilder.of().andMatch("title, content", "   ");
        assertEquals("", noKw.where(), "关键词为空时不能生成 MATCH 条件（否则匹配 NULL 查不到数据）");
        assertEquals(0, noKw.args().length);
    }

    @Test
    @DisplayName("andMatch 与 andEq 混用时参数顺序与占位符顺序一致")
    void mixedConditionOrder() {
        SqlBuilder sb = SqlBuilder.of()
                .andMatch("title, summary, content", "试用期")
                .andEq("category", "劳动合同")
                .andEq("status", 1);
        Object[] args = sb.with(0, 10);
        // 3 个条件参数 + 2 个分页参数 = 5，且顺序必须与 SQL 中占位符一致
        assertEquals(5, args.length);
        assertEquals("试用期", args[0]);
        assertEquals("劳动合同", args[1]);
        assertEquals(1, args[2]);
        assertEquals(0, args[3]);
        assertEquals(10, args[4]);
    }

    @Test
    @DisplayName("andBetween 只对非空端点生成条件")
    void betweenConditions() {
        SqlBuilder sb = SqlBuilder.of().andBetween("created_at", "2026-01-01", null);
        assertEquals(1, sb.args().length);
        assertTrue(sb.where().contains("created_at >= ?"));
        assertFalse(sb.where().contains("<="));
    }
}
