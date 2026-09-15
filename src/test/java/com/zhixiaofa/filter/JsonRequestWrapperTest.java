package com.zhixiaofa.filter;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import javax.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.StringReader;
import java.util.Collections;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * JSON 请求体包装器单元测试：验证 JSON 字段能被 getParameter 读到，
 * 且请求体可被重复读取（这是「流只能读一次」问题的关键回归点）。
 */
@DisplayName("JsonRequestWrapper 测试")
class JsonRequestWrapperTest {

    private HttpServletRequest mockRequest(String body) throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader(body == null ? "" : body)));
        when(req.getParameter(anyString())).thenReturn(null);
        when(req.getParameterNames()).thenReturn(Collections.emptyEnumeration());
        when(req.getParameterMap()).thenReturn(Collections.emptyMap());
        return req;
    }

    @Test
    @DisplayName("JSON 顶层标量字段可被 getParameter 读到")
    void projectsScalarFields() throws Exception {
        JsonRequestWrapper w = new JsonRequestWrapper(
                mockRequest("{\"username\":\"admin\",\"password\":\"admin123\",\"status\":1}"));
        assertEquals("admin", w.getParameter("username"));
        assertEquals("admin123", w.getParameter("password"));
        assertEquals("1", w.getParameter("status"));
    }

    @Test
    @DisplayName("原有表单参数优先于 JSON 字段")
    void formParamWins() throws Exception {
        HttpServletRequest req = mock(HttpServletRequest.class);
        when(req.getReader()).thenReturn(new BufferedReader(new StringReader("{\"username\":\"fromJson\"}")));
        when(req.getParameter("username")).thenReturn("fromForm");
        when(req.getParameterNames()).thenReturn(Collections.emptyEnumeration());
        when(req.getParameterMap()).thenReturn(Collections.emptyMap());

        assertEquals("fromForm", new JsonRequestWrapper(req).getParameter("username"));
    }

    @Test
    @DisplayName("嵌套对象与数组不投影，交给 Servlet 自行解析")
    void nestedStructuresNotProjected() throws Exception {
        JsonRequestWrapper w = new JsonRequestWrapper(
                mockRequest("{\"templateId\":7,\"params\":{\"标题\":\"申请书\"},\"tags\":[\"a\",\"b\"]}"));
        assertEquals("7", w.getParameter("templateId"));
        assertNull(w.getParameter("params"));
        assertNull(w.getParameter("tags"));
        assertTrue(w.getCachedBody().contains("标题"), "原始请求体应完整保留供业务解析");
    }

    @Test
    @DisplayName("请求体可被重复读取（getReader / getInputStream 都从缓存读）")
    void bodyIsReplayable() throws Exception {
        JsonRequestWrapper w = new JsonRequestWrapper(mockRequest("{\"a\":\"1\"}"));
        BufferedReader r1 = w.getReader();
        assertEquals("{\"a\":\"1\"}", r1.readLine());
        BufferedReader r2 = w.getReader();
        assertEquals("{\"a\":\"1\"}", r2.readLine(), "第二次读取必须仍能拿到完整请求体");
    }

    @Test
    @DisplayName("非法 JSON 不抛异常，只是不投影任何字段")
    void invalidJsonIsTolerated() throws Exception {
        JsonRequestWrapper w = new JsonRequestWrapper(mockRequest("{不是合法json"));
        assertNull(w.getParameter("any"));
    }

    @Test
    @DisplayName("空请求体安全处理")
    void emptyBody() throws Exception {
        assertNull(new JsonRequestWrapper(mockRequest("")).getParameter("x"));
        assertNull(new JsonRequestWrapper(mockRequest(null)).getParameter("x"));
    }

    @Test
    @DisplayName("getParameterValues / getParameterMap 补充 JSON 字段")
    void parameterValuesAndMap() throws Exception {
        JsonRequestWrapper w = new JsonRequestWrapper(mockRequest("{\"role\":\"ADMIN\"}"));
        assertArrayEquals(new String[]{"ADMIN"}, w.getParameterValues("role"));
        Map<String, String[]> map = w.getParameterMap();
        assertTrue(map.containsKey("role"));
    }
}
