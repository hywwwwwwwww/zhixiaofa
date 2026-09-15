package com.zhixiaofa.dao;

import com.zhixiaofa.model.KnowledgeTag;
import java.math.BigDecimal;
import java.sql.Connection;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * KnowledgeTag 的 DAO 接口。
 *
 * <p>接口与实现分离：Service 只依赖本接口，实现换成连接池版 / 缓存版都不影响业务代码。</p>
 * <p>本接口只声明数据访问能力，不含任何业务规则（业务规则在 Service 层）。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface KnowledgeTagDao {

    /** 新增，返回自增主键 */
    Long insert(KnowledgeTag entity);

    /** 按主键更新全部字段 */
    int update(KnowledgeTag entity);

    /** 按主键删除 */
    int deleteById(Long id);

    /** 按主键查询，不存在返回 null */
    KnowledgeTag findById(Long id);

    /** 查询全部 */
    java.util.List<KnowledgeTag> findAll();

    /** 统计总数 */
    long countAll();

    /** 通用分页（offset/limit） */
    java.util.List<KnowledgeTag> findByPage(int offset, int limit);

    /**
     * 按名称查询标签（不存在则供 Service 新建）
     *
     * @param name 参数
     * @return 查询结果
     */
    KnowledgeTag findByName(String name);
}
