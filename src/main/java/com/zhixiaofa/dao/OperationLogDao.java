package com.zhixiaofa.dao;

import com.zhixiaofa.model.OperationLog;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * OperationLog 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface OperationLogDao {

    /** 新增，返回自增主键 */
    Long insert(OperationLog entity);

    /** 按主键更新全部字段 */
    int update(OperationLog entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    OperationLog findById(Long id);

    /** 查询全部 */
    java.util.List<OperationLog> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<OperationLog> findByPage(int offset, int limit);

    /**
     * 后台日志分页
     *
     * @param keyword 参数
     * @param method 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    /** 后台日志分页（不带排序，委托带排序重载，默认 sortName/sortOrder 为 null） */
    java.util.List<OperationLog> findByCondition(String keyword, String method, int offset, int limit);

    /**
     * 后台日志分页（支持列头排序）
     *
     * @param keyword 参数
     * @param method 参数
     * @param offset 参数
     * @param limit 参数
     * @param sortName 排序列（前端字段名，白名单校验）
     * @param sortOrder 排序方向（asc/desc）
     * @return 查询结果
     */
    java.util.List<OperationLog> findByCondition(String keyword, String method, int offset, int limit, String sortName, String sortOrder);

    /**
     * 后台日志条件计数
     *
     * @param keyword 参数
     * @param method 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String method);

    /**
     * 每日请求量（折线图）
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);

    /**
     * 接口调用排行
     *
     * @param topN 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByUri(int topN);

    /**
     * 接口平均耗时（性能监控）
     *
     * @param topN 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> avgCostByUri(int topN);

    /**
     * 清理 N 天前的日志
     *
     * @param days 参数
     * @return 查询结果
     */
    int deleteBefore(int days);
}
