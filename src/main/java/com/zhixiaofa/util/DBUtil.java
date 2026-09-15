package com.zhixiaofa.util;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.Properties;

/**
 * 数据库工具类：加载 {@code db.properties}、创建并持有全局唯一的连接池。
 *
 * <p>对外只暴露两件事：</p>
 * <ul>
 *   <li>{@link #getConnection()} —— 从池中借一个连接（用完必须 close，实际是归还）；</li>
 *   <li>{@link #getConfig(String, String)} —— 读取配置项，供分页等业务复用。</li>
 * </ul>
 *
 * <p>连接池在类加载时创建一次，随 Web 应用生命周期存活；</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class DBUtil {

    private static final Logger log = LoggerFactory.getLogger(DBUtil.class);

    /** 配置文件路径（classpath 下） */
    private static final String CONFIG_FILE = "db.properties";

    private static final Properties CONFIG = new Properties();
    private static final SimpleConnectionPool POOL;

    static {
        try (InputStream in = DBUtil.class.getClassLoader().getResourceAsStream(CONFIG_FILE)) {
            if (in == null) {
                throw new IllegalStateException("未找到数据库配置文件 " + CONFIG_FILE);
            }
            CONFIG.load(in);

            // 允许用 JVM 参数覆盖配置（-Djdbc.url=... -Djdbc.password=...），
            // 便于同一份 WAR 在开发库 / 测试库之间切换，而不用改包内的配置文件。
            for (String key : CONFIG.stringPropertyNames()) {
                String override = System.getProperty(key);
                if (override != null && !override.trim().isEmpty()) {
                    CONFIG.setProperty(key, override.trim());
                }
            }

            final String driver = CONFIG.getProperty("jdbc.driver", "com.mysql.cj.jdbc.Driver");
            final String url = CONFIG.getProperty("jdbc.url");
            final String username = CONFIG.getProperty("jdbc.username");
            final String password = CONFIG.getProperty("jdbc.password");

            // 显式加载驱动，避免部分容器下 SPI 不生效
            Class.forName(driver);

            POOL = new SimpleConnectionPool(
                    () -> java.sql.DriverManager.getConnection(url, username, password),
                    getInt("pool.minIdle", 2),
                    getInt("pool.maxTotal", 20),
                    getLong("pool.maxWaitMillis", 5000L),
                    getLong("pool.maxIdleMillis", 300000L),
                    CONFIG.getProperty("pool.validationQuery", "SELECT 1"));

            log.info("数据库连接池初始化完成: url={}, minIdle={}, maxTotal={}",
                    url, POOL.getMinIdle(), POOL.getMaxTotal());
        } catch (IOException | ClassNotFoundException e) {
            throw new ExceptionInInitializerError("数据库连接池初始化失败: " + e.getMessage());
        }
    }

    private DBUtil() {
    }

    /**
     * 从连接池获取连接。
     *
     * @return 代理连接，调用 {@code close()} 即归还连接池
     * @throws SQLException 池耗尽或等待超时
     */
    public static Connection getConnection() throws SQLException {
        return POOL.getConnection();
    }

    /** @return 连接池实例，便于监控页展示指标 */
    public static SimpleConnectionPool getPool() {
        return POOL;
    }

    /** 应用关闭时释放资源 */
    public static void shutdown() {
        POOL.shutdown();
        log.info("数据库连接池已关闭");
    }

    // ------------------------------------------------------------------ 配置读取

    public static String getConfig(String key, String defaultValue) {
        return CONFIG.getProperty(key, defaultValue);
    }

    public static int getInt(String key, int defaultValue) {
        try {
            return Integer.parseInt(CONFIG.getProperty(key, String.valueOf(defaultValue)).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public static long getLong(String key, long defaultValue) {
        try {
            return Long.parseLong(CONFIG.getProperty(key, String.valueOf(defaultValue)).trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }
}
