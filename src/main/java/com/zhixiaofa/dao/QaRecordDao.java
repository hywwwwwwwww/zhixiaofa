package com.zhixiaofa.dao;

import com.zhixiaofa.model.QaRecord;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * QaRecord 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface QaRecordDao {

    /** 新增，返回自增主键 */
    Long insert(QaRecord entity);

    /** 按主键更新全部字段 */
    int update(QaRecord entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    QaRecord findById(Long id);

    /** 查询全部 */
    java.util.List<QaRecord> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<QaRecord> findByPage(int offset, int limit);

    /**
     * 某用户的问答分页
     *
     * @param userId 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<QaRecord> findByUserId(Long userId, int offset, int limit);

    /**
     * 某用户的问答总数
     *
     * @param userId 参数
     * @return 查询结果
     */
    long countByUserId(Long userId);

    /**
     * 后台问答分页（关联用户昵称）
     *
     * @param keyword 参数
     * @param category 参数
     * @param status 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<QaRecord> findByCondition(String keyword, String category, Integer status, int offset, int limit);

    /**
     * 后台问答分页（关联用户昵称，支持列头排序）
     *
     * @param keyword 参数
     * @param category 参数
     * @param status 参数
     * @param offset 参数
     * @param limit 参数
     * @param sortName 排序列名（白名单 key，见实现）
     * @param sortOrder 排序方向 asc/desc
     * @return 查询结果
     */
    java.util.List<QaRecord> findByCondition(String keyword, String category, Integer status, int offset, int limit, String sortName, String sortOrder);

    /**
     * 后台问答条件计数
     *
     * @param keyword 参数
     * @param category 参数
     * @param status 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String category, Integer status);

    /**
     * 点赞数 +1
     *
     * @param id 参数
     * @return 查询结果
     */
    int incrementLike(Long id);

    /**
     * 后台补充 / 修改回答
     *
     * @param id 参数
     * @param answer 参数
     * @return 查询结果
     */
    int updateAnswer(Long id, String answer);

    /**
     * 每日提问量（折线图）
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);

    /**
     * 问题分类分布（饼图）
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByCategory();

    /**
     * 热门问题榜（柱状图）
     *
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> topQuestions(int limit);
}
