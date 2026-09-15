package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.impl.LawArticleDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.LawArticle;
import com.zhixiaofa.service.LawArticleService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 法条业务实现。
 *
 * <p>关键词检索优先走 MySQL 的 ngram 全文索引（{@code MATCH ... AGAINST}），
 * 相比 {@code LIKE '%关键词%'} 不会退化成全表扫描，这是本项目索引优化的一个落点。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LawArticleServiceImpl implements LawArticleService {

    private static final Logger log = LoggerFactory.getLogger(LawArticleServiceImpl.class);

    private static final List<String> CATEGORIES = List.of(
            "劳动合同", "工资报酬", "工时休假", "社会保险", "解除终止", "竞业限制", "其他");

    private final LawArticleDao lawDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public LawArticleServiceImpl() {
        this(new LawArticleDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param lawDao lawDao
     */
    public LawArticleServiceImpl(LawArticleDao lawDao) {
        this.lawDao = lawDao;
    }

    @Override
    public PageResult<LawArticle> page(String keyword, String category, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = lawDao.countByCondition(keyword, category);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(lawDao.findByCondition(keyword, category, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public LawArticle getById(Long id) {
        LawArticle article = lawDao.findById(id);
        if (article == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "法条不存在");
        }
        return article;
    }

    @Override
    public List<LawArticle> listByIds(List<Long> ids) {
        return ids == null || ids.isEmpty() ? new ArrayList<>() : lawDao.findByIds(ids);
    }

    @Override
    public List<String> listCategories() {
        return CATEGORIES;
    }

    @Override
    public LawArticle create(LawArticle article) {
        validate(article);
        LocalDateTime now = DateUtil.now();
        article.setCreatedAt(now);
        article.setUpdatedAt(now);
        Long id = lawDao.insert(article);
        article.setId(id);
        log.info("新增法条: id={}, {} {}", id, article.getLawName(), article.getArticleNo());
        return article;
    }

    @Override
    public LawArticle update(Long id, LawArticle article) {
        getById(id);
        validate(article);
        article.setId(id);
        lawDao.update(article);
        return lawDao.findById(id);
    }

    @Override
    public void delete(Long id) {
        getById(id);
        lawDao.deleteById(id);
        log.info("删除法条: id={}", id);
    }

    @Override
    public List<Map<String, Object>> categoryStats() {
        return lawDao.countGroupByCategory();
    }

    /** 必填校验：法规名称、条号、正文缺一不可 */
    private void validate(LawArticle a) {
        if (StringUtil.isEmpty(a.getLawName())) {
            throw new BizException(ResultCode.PARAM_ERROR, "法规名称不能为空");
        }
        if (StringUtil.isEmpty(a.getArticleNo())) {
            throw new BizException(ResultCode.PARAM_ERROR, "条号不能为空");
        }
        if (StringUtil.isEmpty(a.getContent())) {
            throw new BizException(ResultCode.PARAM_ERROR, "条文正文不能为空");
        }
        if (StringUtil.isEmpty(a.getCategory())) {
            a.setCategory("其他");
        }
    }
}
