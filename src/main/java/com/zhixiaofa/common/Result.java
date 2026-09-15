package com.zhixiaofa.common;

import java.io.Serializable;

/**
 * 统一响应体（课程要求：统一响应格式）。
 *
 * <p>所有接口无论成功失败都返回该结构，前端只需判断 {@code code == 10000}：</p>
 * <pre>
 * {
 *   "code": 10000,
 *   "message": "操作成功",
 *   "data": { ... },
 *   "timestamp": 1789316000000
 * }
 * </pre>
 *
 * @param <T> 业务数据类型
 * @author 职小法小组
 * @version 1.0
 */
public class Result<T> implements Serializable {

    private static final long serialVersionUID = 1L;

    /** 业务码，10000 表示成功 */
    private int code;
    /** 提示信息 */
    private String message;
    /** 业务数据 */
    private T data;
    /** 服务端时间戳，便于前端排查问题 */
    private long timestamp = System.currentTimeMillis();

    public Result() {
    }

    public Result(int code, String message, T data) {
        this.code = code;
        this.message = message;
        this.data = data;
    }

    /* ---------------- 成功 ---------------- */

    public static <T> Result<T> success() {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), null);
    }

    public static <T> Result<T> success(T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), data);
    }

    public static <T> Result<T> success(String message, T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), message, data);
    }

    /* ---------------- 失败 ---------------- */

    public static <T> Result<T> error(ResultCode resultCode) {
        return new Result<>(resultCode.getCode(), resultCode.getMessage(), null);
    }

    public static <T> Result<T> error(ResultCode resultCode, String message) {
        return new Result<>(resultCode.getCode(), message, null);
    }

    public static <T> Result<T> error(int code, String message) {
        return new Result<>(code, message, null);
    }

    /** @return 是否成功，前端亦可用该字段做判断 */
    public boolean isSuccess() {
        return this.code == ResultCode.SUCCESS.getCode();
    }

    /* ---------------- getter / setter ---------------- */

    public int getCode() {
        return code;
    }

    public void setCode(int code) {
        this.code = code;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public T getData() {
        return data;
    }

    public void setData(T data) {
        this.data = data;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public void setTimestamp(long timestamp) {
        this.timestamp = timestamp;
    }

    @Override
    public String toString() {
        return "Result{code=" + code + ", message='" + message + "', data=" + data + '}';
    }
}
