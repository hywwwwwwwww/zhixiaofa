package com.zhixiaofa.util;

import java.lang.reflect.InvocationHandler;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.lang.reflect.Proxy;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 手写数据库连接池（课程要求：自行编写连接池，配置可参数化）。
 *
 * <p>设计要点：</p>
 * <ol>
 *   <li>复用一组物理连接，避免频繁创建/销毁连接带来的开销；</li>
 *   <li>借出的连接用 JDK 动态代理包装，调用 {@code close()} 时不是真的关闭，
 *       而是归还到池中，从而实现「在业务代码里继续用 try-with-resources 写法」；</li>
 *   <li>空闲连接放在双端队列中，归还时优先复用，避免队列无限增长；</li>
 *   <li>支持最小/最大连接数、获取超时、空闲连接有效性检测（validationQuery）；</li>
 *   <li>连接泄漏兜底：归还时若池已满则真正关闭物理连接。</li>
 * </ol>
 *
 * <p>本类不是线程安全的通用实现（未做跨进程/分布式支持），
 * 但通过 {@code synchronized} 保证了池内计数与队列操作在多线程下的正确性。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class SimpleConnectionPool {

    /** 连接工厂：由 {@link DBUtil} 注入，负责根据参数创建物理连接 */
    public interface ConnectionFactory {
        Connection create() throws SQLException;
    }

    private final ConnectionFactory factory;
    private final String validationQuery;
    private final int minIdle;
    private final int maxTotal;
    private final long maxWaitMillis;
    private final long maxIdleMillis;

    /** 空闲连接队列（栈式复用，优先用最近归还的连接，命中率更高） */
    private final Deque<PooledEntry> idle = new ArrayDeque<>();
    /** 当前已创建的物理连接总数（含借出与空闲） */
    private final AtomicInteger created = new AtomicInteger(0);
    /** 当前借出数量 */
    private final AtomicInteger borrowed = new AtomicInteger(0);

    private static final class PooledEntry {
        final Connection physical;
        long lastReturnedAt;
        PooledEntry(Connection physical) {
            this.physical = physical;
            this.lastReturnedAt = System.currentTimeMillis();
        }
    }

    /**
     * @param factory         物理连接工厂
     * @param minIdle         最小空闲连接数（初始化时预热）
     * @param maxTotal        最大连接数
     * @param maxWaitMillis   获取连接的最长等待时间(ms)，<=0 表示不等待
     * @param maxIdleMillis   空闲多久后回收物理连接(ms)，<=0 表示不回收
     * @param validationQuery 连接有效性检测 SQL，null 表示不检测
     */
    public SimpleConnectionPool(ConnectionFactory factory, int minIdle, int maxTotal,
                                long maxWaitMillis, long maxIdleMillis, String validationQuery) {
        if (factory == null) {
            throw new IllegalArgumentException("ConnectionFactory 不能为 null");
        }
        this.factory = factory;
        this.minIdle = Math.max(0, minIdle);
        this.maxTotal = Math.max(1, maxTotal);
        this.maxWaitMillis = maxWaitMillis;
        this.maxIdleMillis = maxIdleMillis;
        this.validationQuery = validationQuery;
        warmUp();
    }

    /** 预热：提前建立最小空闲连接，避免首个请求过慢 */
    private void warmUp() {
        for (int i = 0; i < minIdle; i++) {
            try {
                idle.push(new PooledEntry(factory.create()));
                created.incrementAndGet();
            } catch (SQLException e) {
                // 预热失败不阻断启动，后续按需创建
                break;
            }
        }
    }

    /**
     * 借出一个连接（返回的是代理对象）。
     *
     * @return 可直接使用的 {@link Connection}
     * @throws SQLException 达到最大连接数且在超时时间内无空闲连接
     */
    public Connection getConnection() throws SQLException {
        long deadline = maxWaitMillis > 0 ? System.currentTimeMillis() + maxWaitMillis : 0;
        while (true) {
            PooledEntry entry = takeIdle();
            if (entry != null) {
                borrowed.incrementAndGet();
                return wrap(entry);
            }
            // 没有空闲连接，尝试新建
            synchronized (this) {
                if (created.get() < maxTotal) {
                    try {
                        Connection c = factory.create();
                        created.incrementAndGet();
                        borrowed.incrementAndGet();
                        return wrap(new PooledEntry(c));
                    } catch (SQLException e) {
                        // 创建失败继续走等待逻辑
                    }
                }
            }
            if (maxWaitMillis <= 0 || System.currentTimeMillis() > deadline) {
                throw new SQLException("获取数据库连接超时：已达最大连接数 " + maxTotal);
            }
            try {
                Thread.sleep(20L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new SQLException("获取数据库连接被中断", e);
            }
        }
    }

    /** 从空闲队列取一个可用连接，顺带做有效性检测与空闲回收 */
    private synchronized PooledEntry takeIdle() {
        while (!idle.isEmpty()) {
            PooledEntry e = idle.pop();
            if (maxIdleMillis > 0 && System.currentTimeMillis() - e.lastReturnedAt > maxIdleMillis
                    && created.get() > minIdle) {
                closeQuietly(e.physical);
                created.decrementAndGet();
                continue;
            }
            if (isValid(e.physical)) {
                return e;
            }
            closeQuietly(e.physical);
            created.decrementAndGet();
        }
        return null;
    }

    /** 归还连接 */
    private void recycle(PooledEntry entry) {
        borrowed.decrementAndGet();
        boolean closeIt;
        synchronized (this) {
            if (idle.size() >= maxTotal) {
                closeIt = true;
            } else {
                entry.lastReturnedAt = System.currentTimeMillis();
                idle.push(entry);
                closeIt = false;
            }
        }
        if (closeIt) {
            closeQuietly(entry.physical);
            created.decrementAndGet();
        } else {
            // 防止上一次事务遗留自动提交状态
            try {
                if (entry.physical.getAutoCommit() == false) {
                    entry.physical.setAutoCommit(true);
                }
            } catch (SQLException ignore) {
                // ignore
            }
        }
    }

    /**
     * 用 JDK 动态代理包装物理连接：
     * 拦截 close() 改为归还；拦截 isClosed() 返回代理自身的逻辑关闭状态。
     */
    private Connection wrap(final PooledEntry entry) {
        final Connection physical = entry.physical;
        InvocationHandler handler = new InvocationHandler() {
            private boolean logicallyClosed = false;

            @Override
            public Object invoke(Object proxy, Method method, Object[] args) throws Throwable {
                String name = method.getName();
                if ("close".equals(name)) {
                    if (!logicallyClosed) {
                        logicallyClosed = true;
                        recycle(entry);
                    }
                    return null;
                }
                if ("isClosed".equals(name)) {
                    return logicallyClosed;
                }
                if (logicallyClosed) {
                    throw new SQLException("连接已归还到连接池，不能继续使用");
                }
                // 屏蔽掉会真正关掉物理连接的方法
                if ("setAutoCommit".equals(name) || "commit".equals(name) || "rollback".equals(name)) {
                    return method.invoke(physical, args);
                }
                try {
                    return method.invoke(physical, args);
                } catch (InvocationTargetException e) {
                    throw e.getTargetException();
                }
            }
        };
        return (Connection) Proxy.newProxyInstance(
                SimpleConnectionPool.class.getClassLoader(),
                new Class<?>[]{Connection.class}, handler);
    }

    private boolean isValid(Connection c) {
        try {
            if (c == null || c.isClosed()) {
                return false;
            }
            if (validationQuery == null || validationQuery.isEmpty()) {
                return c.isValid(2);
            }
            try (java.sql.Statement st = c.createStatement()) {
                st.execute(validationQuery);
            }
            return true;
        } catch (SQLException e) {
            return false;
        }
    }

    private static void closeQuietly(Connection c) {
        if (c != null) {
            try {
                c.close();
            } catch (SQLException ignore) {
                // ignore
            }
        }
    }

    /** 关闭连接池，释放所有物理连接（应用关闭时调用） */
    public synchronized void shutdown() {
        while (!idle.isEmpty()) {
            closeQuietly(idle.pop().physical);
            created.decrementAndGet();
        }
    }

    // ------------------------------------------------------------------ 监控指标
    public int getCreatedCount() {
        return created.get();
    }

    public int getBorrowedCount() {
        return borrowed.get();
    }

    public synchronized int getIdleCount() {
        return idle.size();
    }

    public int getMaxTotal() {
        return maxTotal;
    }

    public int getMinIdle() {
        return minIdle;
    }
}
