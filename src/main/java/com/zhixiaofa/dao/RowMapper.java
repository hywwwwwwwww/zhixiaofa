package com.zhixiaofa.dao;

import java.sql.ResultSet;
import java.sql.SQLException;

/**
 * 行映射器：把 {@link ResultSet} 的当前行转换为一个实体对象。
 *
 * <p>函数式接口，DAO 实现里用 Lambda 或方法引用书写，避免为每张表都写一个映射类。</p>
 *
 * @param <T> 实体类型
 * @author 职小法小组
 * @version 1.0
 */
@FunctionalInterface
public interface RowMapper<T> {

    /**
     * 映射当前行。
     *
     * @param rs 已定位到某一行的结果集，实现中只能读取、不要调用 next()
     * @return 实体对象
     * @throws SQLException 读取字段异常
     */
    T map(ResultSet rs) throws SQLException;
}
