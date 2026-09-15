package com.zhixiaofa.dao;

import com.zhixiaofa.model.DocRecord;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DocRecord 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface DocRecordDao {

    /** 新增，返回自增主键 */
    Long insert(DocRecord entity);

    /** 按主键更新全部字段 */
    int update(DocRecord entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    DocRecord findById(Long id);

    /** 查询全部 */
    java.util.List<DocRecord> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<DocRecord> findByPage(int offset, int limit);

    /**
     * 某用户的文书分页（关联模板名）
     *
     * @param userId 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<DocRecord> findByUserId(Long userId, int offset, int limit);

    /**
     * 某用户的文书数
     *
     * @param userId 参数
     * @return 查询结果
     */
    long countByUserId(Long userId);

    /**
     * 后台文书分页（含所属用户）
     *
     * @param keyword 参数
     * @param userId 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<DocRecord> findByCondition(String keyword, Long userId, int offset, int limit);

    /**
     * 后台文书条件计数
     *
     * @param keyword 参数
     * @param userId 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, Long userId);

    /**
     * 单条文书详情（含模板名与所属用户昵称）
     *
     * @param id 参数
     * @return 查询结果
     */
    DocRecord findByIdWithDetail(Long id);

    /**
     * 每日文书生成量
     *
     * @param days 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countByDay(int days);

    /**
     * 模板使用排行
     *
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> topTemplates(int limit);
}
