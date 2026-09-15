package com.zhixiaofa.dao;

import com.zhixiaofa.model.DocTemplate;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DocTemplate 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface DocTemplateDao {

    /** 新增，返回自增主键 */
    Long insert(DocTemplate entity);

    /** 按主键更新全部字段 */
    int update(DocTemplate entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    DocTemplate findById(Long id);

    /** 查询全部 */
    java.util.List<DocTemplate> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<DocTemplate> findByPage(int offset, int limit);

    /**
     * 前台可用模板（按排序号）
     *
     * @return 查询结果
     */
    java.util.List<DocTemplate> findEnabled();

    /**
     * 按编码查询模板
     *
     * @param code 参数
     * @return 查询结果
     */
    DocTemplate findByCode(String code);

    /**
     * 按分类查询可用模板
     *
     * @param category 参数
     * @return 查询结果
     */
    java.util.List<DocTemplate> findByCategory(String category);

    /**
     * 后台模板分页
     *
     * @param keyword 参数
     * @param category 参数
     * @param offset 参数
     * @param limit 参数
     * @return 查询结果
     */
    java.util.List<DocTemplate> findByCondition(String keyword, String category, int offset, int limit);

    /**
     * 后台模板条件计数
     *
     * @param keyword 参数
     * @param category 参数
     * @return 查询结果
     */
    long countByCondition(String keyword, String category);

    /**
     * 模板分类分布
     *
     * @return 查询结果
     */
    java.util.List<java.util.Map<String, Object>> countGroupByCategory();
}
