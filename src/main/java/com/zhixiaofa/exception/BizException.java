package com.zhixiaofa.exception;

import com.zhixiaofa.common.ResultCode;

/**
 * 业务异常：Service 层校验不通过时抛出，由 Servlet 统一捕获并转成标准错误响应。
 *
 * <p>继承 {@link RuntimeException} 而非受检异常，是为了让 Service 接口保持干净，
 * 同时强制由最外层的 BaseServlet 统一处理，符合「Service 处理业务异常并向上抛出统一异常」的要求。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class BizException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    /** 业务错误码 */
    private final int code;

    public BizException(String message) {
        this(ResultCode.BIZ_ERROR.getCode(), message);
    }

    public BizException(ResultCode resultCode) {
        this(resultCode.getCode(), resultCode.getMessage());
    }

    public BizException(ResultCode resultCode, String message) {
        this(resultCode.getCode(), message);
    }

    public BizException(int code, String message) {
        super(message);
        this.code = code;
    }

    public int getCode() {
        return code;
    }
}
