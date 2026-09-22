package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.LawArticle;

import java.util.List;

/**
 * 法条业务接口：检索与后台维护。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface LawArticleService {

    /** 分页检索：关键词走 ngram 全文索引，可选分类筛选 */
    PageResult<LawArticle> page(String keyword, String category, int pageNum, int pageSize);

    LawArticle getById(Long id);

    /** 按主键集合批量查询 */
    List<LawArticle> listByIds(List<Long> ids);

    /** 前台下拉用的分类列表 */
    List<String> listCategories();

    LawArticle create(LawArticle article);

    LawArticle update(Long id, LawArticle article);

    void delete(Long id);

    /** 法条分类分布（后台饼图） */
    List<java.util.Map<String, Object>> categoryStats();
}
