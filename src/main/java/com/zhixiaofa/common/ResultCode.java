package com.zhixiaofa.common;

/**
 * 统一错误码定义（课程要求：统一响应格式 + 错误码定义）。
 *
 * <p>编码规则：5 位数字 {@code AABCD}。</p>
 * <ul>
 *   <li>AA —— 模块：10 通用 / 11 用户 / 12 问答 / 13 合同 / 14 文书 / 15 普法 / 16 小法庭 / 17 后台</li>
 *   <li>B  —— 类型：0 成功 / 1 参数错误 / 2 业务错误 / 3 权限错误 / 4 服务端错误</li>
 *   <li>CD —— 序号</li>
 * </ul>
 *
 * @author 职小法小组
 * @version 1.0
 */
public enum ResultCode {

    /* ---------------- 通用 ---------------- */
    SUCCESS(10000, "操作成功"),
    PARAM_ERROR(10101, "请求参数不合法"),
    NOT_FOUND(10102, "请求的资源不存在"),
    METHOD_NOT_ALLOWED(10103, "不支持的请求方法"),
    SERVER_ERROR(10400, "服务器内部错误"),
    DB_ERROR(10401, "数据库操作失败"),
    JSON_ERROR(10402, "JSON 解析失败"),

    /* ---------------- 认证与权限 ---------------- */
    UNAUTHORIZED(11301, "请先登录"),
    FORBIDDEN(11302, "没有操作权限"),
    LOGIN_FAILED(11201, "用户名或密码错误"),
    ACCOUNT_DISABLED(11202, "账号已被禁用，请联系管理员"),
    USERNAME_EXISTS(11203, "用户名已被占用"),
    EMAIL_EXISTS(11204, "邮箱已被注册"),
    OLD_PASSWORD_ERROR(11205, "原密码不正确"),

    /* ---------------- 找回密码（邮箱验证码） ---------------- */
    VERIFY_CODE_SEND_TOO_FREQUENT(11207, "验证码发送过于频繁，请稍后再试"),
    VERIFY_CODE_INVALID(11208, "验证码不正确或已过期"),
    MAIL_NOT_CONFIGURED(11403, "邮件服务未启用，请联系管理员"),
    MAIL_SEND_FAILED(11404, "验证码邮件发送失败，请稍后重试或联系管理员"),


    /* ---------------- 用户 ---------------- */
    USER_NOT_FOUND(11101, "用户不存在"),
    CANNOT_DELETE_SELF(11206, "不能删除当前登录账号"),

    /* ---------------- 业务通用 ---------------- */
    BIZ_ERROR(10201, "业务处理失败"),
    DUPLICATE_OPERATION(10202, "重复操作"),
    DATA_NOT_FOUND(10104, "数据不存在"),
    OPERATION_NOT_ALLOWED(10203, "当前状态不允许该操作");

    private final int code;
    private final String message;

    ResultCode(int code, String message) {
        this.code = code;
        this.message = message;
    }

    public int getCode() {
        return code;
    }

    public String getMessage() {
        return message;
    }
}
