package com.zhixiaofa.filter;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import javax.servlet.http.HttpServletRequest;
import java.io.IOException;

/**
 * JSON 请求体过滤器：把 {@code application/json} 的请求包装成
 * {@link JsonRequestWrapper}，使后端可以用统一的 {@code getParameter} 取参。
 *
 * <p>它必须在所有「会读请求体」的组件之前执行，因此注册顺序排在最前面。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class JsonBodyFilter implements Filter {

    @Override
    public void init(FilterConfig filterConfig) {
        // 无需初始化参数
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        if (request instanceof HttpServletRequest) {
            HttpServletRequest req = (HttpServletRequest) request;
            String contentType = req.getContentType();
            if (contentType != null && contentType.toLowerCase().contains("application/json")) {
                chain.doFilter(new JsonRequestWrapper(req), response);
                return;
            }
        }
        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        // 无资源需要释放
    }
}
