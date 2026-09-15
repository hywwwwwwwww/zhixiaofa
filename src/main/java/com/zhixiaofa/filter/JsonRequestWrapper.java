package com.zhixiaofa.filter;

import com.zhixiaofa.util.JsonUtil;
import com.zhixiaofa.util.StringUtil;

import javax.servlet.ReadListener;
import javax.servlet.ServletInputStream;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletRequestWrapper;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.Enumeration;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

/**
 * JSON 请求体包装器：把 {@code application/json} 请求体里的字段"投影"成请求参数。
 *
 * <p>解决的实际问题：Servlet 的 {@code request.getParameter()} 只能读到
 * 表单（application/x-www-form-urlencoded）与查询串里的参数，
 * 前端如果用 {@code $.ajax(contentType:'application/json')} 提交，
 * 后端所有 {@code getParameter} 都会拿到 null。</p>
 *
 * <p>本包装器在进入 Servlet 之前把 JSON 顶层字段解析成参数表，
 * 于是后端既支持表单提交、也支持 JSON 提交，
 * 而且原有的 {@code getParameter} 写法一行都不用改。</p>
 *
 * <p>注意两点：</p>
 * <ul>
 *   <li>请求体只读一次并缓存在内存里，{@link #getReader()} 与 {@link #getInputStream()}
 *       都从缓存读，避免「流被读空」的经典坑；</li>
 *   <li>只投影「标量字段」，嵌套对象/数组仍由 Servlet 自行用 {@code readBody} + Jackson 解析，
 *       这样不会因为扁平化而丢结构。</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class JsonRequestWrapper extends HttpServletRequestWrapper {

    /** 缓存的原始请求体 */
    private final String cachedBody;
    /** JSON 顶层标量字段 */
    private final Map<String, String> jsonParams = new LinkedHashMap<>();

    @SuppressWarnings("unchecked")
    public JsonRequestWrapper(HttpServletRequest request) throws IOException {
        super(request);
        StringBuilder sb = new StringBuilder();
        if (request.getReader() != null) {
            try (BufferedReader reader = request.getReader()) {
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
            }
        } else {
            // 极少数容器下 getReader 不可用，退回字节流
            byte[] buf = new byte[4096];
            int n;
            while ((n = request.getInputStream().read(buf)) > 0) {
                sb.append(new String(buf, 0, n, StandardCharsets.UTF_8));
            }
        }
        this.cachedBody = sb.toString();

        if (StringUtil.isNotEmpty(cachedBody) && cachedBody.trim().startsWith("{")) {
            try {
                Map<String, Object> map = JsonUtil.parseMap(cachedBody);
                if (map != null) {
                    for (Map.Entry<String, Object> e : map.entrySet()) {
                        Object v = e.getValue();
                        if (v == null || v instanceof Map || v instanceof Iterable) {
                            continue; // 嵌套结构交给 Servlet 自行解析
                        }
                        jsonParams.put(e.getKey(), String.valueOf(v));
                    }
                }
            } catch (RuntimeException ignore) {
                // JSON 格式非法时不抛异常，交给 Servlet 的参数校验统一报错
            }
        }
    }

    /** @return 缓存的原始请求体（供 Servlet 解析嵌套结构） */
    public String getCachedBody() {
        return cachedBody;
    }

    @Override
    public String getParameter(String name) {
        String v = super.getParameter(name);
        return v != null ? v : jsonParams.get(name);
    }

    @Override
    public String[] getParameterValues(String name) {
        String[] v = super.getParameterValues(name);
        if (v != null) {
            return v;
        }
        String single = jsonParams.get(name);
        return single == null ? null : new String[]{single};
    }

    @Override
    public Enumeration<String> getParameterNames() {
        Set<String> names = new LinkedHashSet<>();
        Enumeration<String> origin = super.getParameterNames();
        while (origin != null && origin.hasMoreElements()) {
            names.add(origin.nextElement());
        }
        names.addAll(jsonParams.keySet());
        return Collections.enumeration(names);
    }

    @Override
    public Map<String, String[]> getParameterMap() {
        Map<String, String[]> map = new LinkedHashMap<>(super.getParameterMap());
        for (Map.Entry<String, String> e : jsonParams.entrySet()) {
            if (!map.containsKey(e.getKey())) {
                map.put(e.getKey(), new String[]{e.getValue()});
            }
        }
        return map;
    }

    /** 让 Servlet 还能重新读一遍请求体 */
    @Override
    public BufferedReader getReader() {
        return new BufferedReader(new InputStreamReader(
                new ByteArrayInputStream(cachedBody.getBytes(StandardCharsets.UTF_8)),
                StandardCharsets.UTF_8));
    }

    @Override
    public ServletInputStream getInputStream() {
        final ByteArrayInputStream in = new ByteArrayInputStream(cachedBody.getBytes(StandardCharsets.UTF_8));
        return new ServletInputStream() {
            @Override
            public boolean isFinished() {
                return in.available() == 0;
            }

            @Override
            public boolean isReady() {
                return true;
            }

            @Override
            public void setReadListener(ReadListener readListener) {
                // 本项目不使用异步 IO
            }

            @Override
            public int read() {
                return in.read();
            }
        };
    }
}
