package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.dao.OperationLogDao;
import com.zhixiaofa.dao.impl.OperationLogDaoImpl;
import com.zhixiaofa.model.OperationLog;
import com.zhixiaofa.service.LogService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.BlockingQueue;

/**
 * 操作日志业务实现。
 *
 * <p>性能考虑：写日志是纯附加动作，不应该拖慢业务响应。
 * 这里用「有界队列 + 单线程消费者」做异步落库：过滤器只负责把日志对象塞进队列并立刻返回，
 * 队列满时直接丢弃（丢日志比阻塞用户请求更可接受）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LogServiceImpl implements LogService {

    private static final Logger log = LoggerFactory.getLogger(LogServiceImpl.class);

    /** 队列容量：够扛一阵突发流量 */
    private static final int QUEUE_SIZE = 2000;

    private final OperationLogDao logDao;

    private final BlockingQueue<OperationLog> queue = new ArrayBlockingQueue<>(QUEUE_SIZE);

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配 JDBC 实现，并启动异步落库线程 */
    public LogServiceImpl() {
        this(new OperationLogDaoImpl());
    }

    /** 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩 */
    public LogServiceImpl(OperationLogDao logDao) {
        this.logDao = logDao;
        Thread worker = new Thread(this::consumeLoop, "zhixiaofa-log-writer");
        worker.setDaemon(true);
        worker.start();
    }

    private void consumeLoop() {
        while (!Thread.currentThread().isInterrupted()) {
            try {
                OperationLog item = queue.take();
                logDao.insert(item);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            } catch (Exception e) {
                // 落库失败只记录，不能让写日志线程死掉
                log.warn("操作日志落库失败: {}", e.getMessage());
            }
        }
    }

    @Override
    public void save(OperationLog item) {
        if (!queue.offer(item)) {
            log.debug("日志队列已满，丢弃一条日志: {} {}", item.getMethod(), item.getUri());
        }
    }

    @Override
    public PageResult<OperationLog> page(String keyword, String method, int pageNum, int pageSize) {
        return page(keyword, method, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<OperationLog> page(String keyword, String method, int pageNum, int pageSize,
                                        String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = logDao.countByCondition(keyword, method);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(logDao.findByCondition(keyword, method, (pageNum - 1) * pageSize, pageSize,
                sortName, sortOrder), total, pageNum, pageSize);
    }

    @Override
    public List<Map<String, Object>> dailyStats(int days) {
        return logDao.countByDay(days);
    }

    @Override
    public List<Map<String, Object>> uriStats(int limit) {
        return logDao.countGroupByUri(limit);
    }

    @Override
    public List<Map<String, Object>> slowApiStats(int limit) {
        return logDao.avgCostByUri(limit);
    }

    @Override
    public int clean(int days) {
        if (days < 1) {
            days = 30;
        }
        return logDao.deleteBefore(days);
    }
}
