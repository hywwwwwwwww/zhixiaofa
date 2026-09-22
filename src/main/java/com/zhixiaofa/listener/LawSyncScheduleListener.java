package com.zhixiaofa.listener;

import com.zhixiaofa.service.LawSyncService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.servlet.ServletContextEvent;
import javax.servlet.ServletContextListener;
import javax.servlet.annotation.WebListener;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * 法条自动同步定时任务。
 *
 * <p>应用启动时注册一个单线程定时器，每天在固定时间点触发一次
 * {@link LawSyncService#sync()}，从国家法律法规数据库增量同步法条。</p>
 *
 * <p>采用 {@code scheduleWithFixedDelay} 而非 {@code scheduleAtFixedRate}：
 * 保证上一次同步彻底结束后才计时下一个周期，避免同步耗时叠加导致并发抓取、被官网限流。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
@WebListener
public class LawSyncScheduleListener implements ServletContextListener {

    private static final Logger log = LoggerFactory.getLogger(LawSyncScheduleListener.class);

    /** 每日同步时刻（默认凌晨 3 点，官网访问低峰） */
    private static final LocalTime SYNC_TIME = LocalTime.of(3, 0);

    private ScheduledExecutorService scheduler;

    @Override
    public void contextInitialized(ServletContextEvent sce) {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "law-sync-scheduler");
            t.setDaemon(true);
            return t;
        });

        long initialDelay = computeInitialDelayMillis();
        scheduler.scheduleWithFixedDelay(() -> {
            try {
                LawSyncService.getInstance().sync();
            } catch (Exception e) {
                log.error("法条定时同步失败", e);
            }
        }, initialDelay, TimeUnit.DAYS.toMillis(1), TimeUnit.MILLISECONDS);

        log.info("法条自动同步已注册：每日 {} 执行一次，首次约 {} 分钟后", SYNC_TIME, initialDelay / 60000);
    }

    @Override
    public void contextDestroyed(ServletContextEvent sce) {
        if (scheduler != null) {
            scheduler.shutdownNow();
        }
        log.info("法条自动同步定时器已停止");
    }

    /** 计算到下一个「每日同步时刻」的毫秒数 */
    private long computeInitialDelayMillis() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime next = now.toLocalDate().atTime(SYNC_TIME);
        if (!next.isAfter(now)) {
            next = next.plusDays(1);
        }
        return Duration.between(now, next).toMillis();
    }
}
