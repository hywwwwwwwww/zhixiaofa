package com.zhixiaofa.filter;

import javax.servlet.Filter;
import javax.servlet.FilterChain;
import javax.servlet.FilterConfig;
import javax.servlet.ServletException;
import javax.servlet.ServletRequest;
import javax.servlet.ServletResponse;
import java.io.IOException;

/**
 * 字符编码过滤器：统一把请求与响应编码固定为 UTF-8。
 *
 * <p>为什么必须显式过滤：Servlet 容器对 POST 请求体的默认解码编码依赖平台，
 * 中文环境下可能是 GBK，导致表单里的中文变成乱码；响应同理。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class CharacterEncodingFilter implements Filter {

    private String encoding = "UTF-8";

    @Override
    public void init(FilterConfig filterConfig) {
        String cfg = filterConfig.getInitParameter("encoding");
        if (cfg != null && !cfg.trim().isEmpty()) {
            this.encoding = cfg.trim();
        }
    }

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {
        request.setCharacterEncoding(encoding);
        response.setCharacterEncoding(encoding);
        chain.doFilter(request, response);
    }

    @Override
    public void destroy() {
        // 无资源需要释放
    }
}
