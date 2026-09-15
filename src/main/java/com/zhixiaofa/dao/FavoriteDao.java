package com.zhixiaofa.dao;

import com.zhixiaofa.model.Favorite;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * Favorite 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface FavoriteDao {

    /** 新增，返回自增主键 */
    Long insert(Favorite entity);

    /** 按主键更新全部字段 */
    int update(Favorite entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    Favorite findById(Long id);

    /** 查询全部 */
    java.util.List<Favorite> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<Favorite> findByPage(int offset, int limit);

    /**
     * 判断是否已收藏
     *
     * @param userId 参数
     * @param targetType 参数
     * @param targetId 参数
     * @return 查询结果
     */
    boolean exists(Long userId, String targetType, Long targetId);

    /**
     * 取消收藏
     *
     * @param userId 参数
     * @param targetType 参数
     * @param targetId 参数
     * @return 查询结果
     */
    int deleteByTarget(Long userId, String targetType, Long targetId);

    /**
     * 某用户某类收藏分页
     *
     * @param userId 参数
     * @param targetType 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<Favorite> findByUserAndType(Long userId, String targetType, int offset, int limit);

    /**
     * 某用户某类收藏数
     *
     * @param userId 参数
     * @param targetType 参数
     * @return 查询结果
     */
    long countByUserAndType(Long userId, String targetType);

    /**
     * 某用户收藏总数
     *
     * @param userId 参数
     * @return 查询结果
     */
    long countByUser(Long userId);

    /**
     * 收藏类型分布（饼图）
     *
     * @param userId 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByType(Long userId);
}
