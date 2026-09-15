package com.zhixiaofa.exception;

/**
 * 数据访问异常：DAO 层统一抛出，屏蔽底层 {@link java.sql.SQLException} 细节，
 * 由上层决定是回滚事务还是提示用户。
 *
 * @author 职小法小组
 * @version 1.0
 */
public class DaoException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    public DaoException(String message) {
        super(message);
    }

    public DaoException(String message, Throwable cause) {
        super(message, cause);
    }
}
