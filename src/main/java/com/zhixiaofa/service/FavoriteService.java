package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.Favorite;

import java.util.List;
import java.util.Map;

/**
 * 收藏业务接口（多态关联：可收藏问答、文章、法条、文书）。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface FavoriteService {

    /** 收藏，重复收藏不会报错 */
    boolean add(Long userId, String targetType, Long targetId);

    /** 取消收藏 */
    boolean remove(Long userId, String targetType, Long targetId);

    /** 切换收藏状态，返回切换后的状态 */
    boolean toggle(Long userId, String targetType, Long targetId);

    boolean exists(Long userId, String targetType, Long targetId);

    /** 按类型分页，并回填收藏对象标题 */
    PageResult<Favorite> page(Long userId, String targetType, int pageNum, int pageSize);

    /** 收藏类型分布 */
    List<Map<String, Object>> typeStats(Long userId);
}
