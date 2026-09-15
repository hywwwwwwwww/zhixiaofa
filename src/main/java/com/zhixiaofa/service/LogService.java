package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.OperationLog;

import java.util.List;
import java.util.Map;

/**
 * 操作日志业务接口（后台审计 + 性能监控数据源）。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface LogService {

    /** 异步化前的落库入口：失败不影响主流程 */
    void save(OperationLog log);

    PageResult<OperationLog> page(String keyword, String method, int pageNum, int pageSize);

    List<Map<String, Object>> dailyStats(int days);

    List<Map<String, Object>> uriStats(int limit);

    List<Map<String, Object>> slowApiStats(int limit);

    /** 清理 N 天前的日志 */
    int clean(int days);
}
