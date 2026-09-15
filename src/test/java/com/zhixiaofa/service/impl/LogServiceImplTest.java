package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.dao.OperationLogDao;
import com.zhixiaofa.model.OperationLog;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 操作日志业务单元测试：覆盖异步落库入口、分页与清理。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("LogService 测试")
class LogServiceImplTest {

    @Mock private OperationLogDao logDao;

    private OperationLog log() {
        OperationLog l = new OperationLog();
        l.setUsername("admin");
        l.setMethod("POST");
        l.setUri("/api/qa");
        l.setCostMs(12L);
        l.setStatus(200);
        return l;
    }

    @Test
    @DisplayName("异步落库：save 不抛异常且最终写入 DAO")
    void saveIsAsyncAndPersists() throws Exception {
        LogServiceImpl service = new LogServiceImpl(logDao);
        for (int i = 0; i < 20; i++) {
            service.save(log());
        }
        // 异步消费，最多等 2 秒
        long deadline = System.currentTimeMillis() + 2000;
        while (System.currentTimeMillis() < deadline && mockingDetails(logDao).getInvocations().stream()
                .noneMatch(inv -> "insert".equals(inv.getMethod().getName()))) {
            Thread.sleep(50);
        }
        verify(logDao, atLeastOnce()).insert(any(OperationLog.class));
    }

    @Test
    @DisplayName("分页：无数据返回空页，不查列表")
    void pageEmpty() {
        when(logDao.countByCondition(any(), any())).thenReturn(0L);
        LogServiceImpl service = new LogServiceImpl(logDao);
        PageResult<OperationLog> page = service.page(null, null, 1, 10);
        assertEquals(0, page.getTotal());
        verify(logDao, never()).findByCondition(any(), any(), anyInt(), anyInt());
    }

    @Test
    @DisplayName("分页：正常返回；页码参数做边界修正")
    void pageWithData() {
        when(logDao.countByCondition(any(), any())).thenReturn(3L);
        LogServiceImpl service = new LogServiceImpl(logDao);
        assertEquals(3, service.page("admin", "POST", 1, 10).getTotal());
        service.page(null, null, 0, 0);
        verify(logDao).findByCondition(isNull(), isNull(), eq(0), eq(10));
    }

    @Test
    @DisplayName("清理日志：天数非法时回落为 30 天")
    void cleanFallsBackTo30Days() {
        LogServiceImpl service = new LogServiceImpl(logDao);
        service.clean(0);
        verify(logDao).deleteBefore(30);
        service.clean(-5);
        verify(logDao, times(2)).deleteBefore(30);
        service.clean(7);
        verify(logDao).deleteBefore(7);
    }

    @Test
    @DisplayName("统计类方法透传 DAO 结果")
    void statsDelegation() {
        LogServiceImpl service = new LogServiceImpl(logDao);
        when(logDao.countByDay(14)).thenReturn(java.util.List.of());
        when(logDao.countGroupByUri(8)).thenReturn(java.util.List.of());
        when(logDao.avgCostByUri(8)).thenReturn(java.util.List.of());
        assertNotNull(service.dailyStats(14));
        assertNotNull(service.uriStats(8));
        assertNotNull(service.slowApiStats(8));
    }
}
