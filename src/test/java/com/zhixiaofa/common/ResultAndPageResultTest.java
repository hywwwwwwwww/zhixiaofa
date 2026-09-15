package com.zhixiaofa.common;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.Collections;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 统一响应体与分页结果单元测试。
 */
@DisplayName("Result / PageResult 测试")
class ResultAndPageResultTest {

    @Test
    @DisplayName("success 返回成功码且 isSuccess 为真")
    void successResult() {
        Result<String> r = Result.success("ok");
        assertEquals(ResultCode.SUCCESS.getCode(), r.getCode());
        assertEquals("ok", r.getData());
        assertTrue(r.isSuccess());
        assertTrue(r.getTimestamp() > 0);
    }

    @Test
    @DisplayName("error 按错误码携带消息")
    void errorResult() {
        Result<?> r = Result.error(ResultCode.UNAUTHORIZED);
        assertEquals(11301, r.getCode());
        assertEquals("请先登录", r.getMessage());
        assertFalse(r.isSuccess());
    }

    @Test
    @DisplayName("PageResult 正确换算总页数")
    void pageResultPagination() {
        PageResult<String> p = PageResult.of(Arrays.asList("a", "b"), 23, 2, 10);
        assertEquals(23, p.getTotal());
        assertEquals(3, p.getPages());
        assertEquals(2, p.getPageNum());
        assertTrue(p.isHasNext());
    }

    @Test
    @DisplayName("PageResult：整除页数与最后一页")
    void pageResultEdgeCases() {
        PageResult<String> exact = PageResult.of(Collections.emptyList(), 20, 2, 10);
        assertEquals(2, exact.getPages());
        assertFalse(exact.isHasNext(), "第 2 页是最后一页时不应有下一页");

        PageResult<String> empty = PageResult.empty(1, 10);
        assertEquals(0, empty.getTotal());
        assertEquals(0, empty.getPages());
        assertTrue(empty.getList().isEmpty());
    }

    @Test
    @DisplayName("ResultCode 错误码唯一")
    void resultCodesAreUnique() {
        java.util.Set<Integer> codes = new java.util.HashSet<>();
        for (ResultCode rc : ResultCode.values()) {
            assertTrue(codes.add(rc.getCode()), "错误码重复: " + rc);
        }
    }
}
