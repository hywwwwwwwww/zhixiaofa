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
import java.util.Comparator;
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

    /** 预设的职场分类及其业务展示顺序（实际下拉只展示库中真正有法条的分类） */
    private static final List<String> CATEGORIES = List.of(
            "劳动合同", "劳动报酬", "工作时间与休息休假", "社会保险", "解除与终止", "保密与竞业限制", "其他");

    /** 手工录入的来源标识（与自动同步的 flk_npc 区分；source 列非空） */
    private static final String SOURCE_MANUAL = "manual";

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
    public PageResult<LawArticle> page(String keyword, String category, String lawName, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = lawDao.countByCondition(keyword, category, lawName);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(lawDao.findByCondition(keyword, category, lawName, (pageNum - 1) * pageSize, pageSize),
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
        // 返回**完整的预设分类清单**（按业务顺序），而不是「只返回库中有法条的分类」。
        //   · 保留空分类：与本项目原有行为一致（筛选下拉一直是全量），
        //     下拉里能看到完整的 7 个业务分类维度；
        //   · 库中若出现预设之外的分类，追加到末尾，避免丢数据。
        // 注：此写法**有意偏离**源项目（源项目会隐藏空分类，实测会让
        //     「工作时间与休息休假」这类暂无数据的分类从下拉里消失，容易被误判为「分类变少了」）。
        List<String> result = new ArrayList<>(CATEGORIES);
        for (String c : lawDao.listCategories()) {
            if (!result.contains(c)) {
                result.add(c);
            }
        }
        return result;
    }

    @Override
    public List<String> listLawNames() {
        return lawDao.listLawNames();
    }

    @Override
    public int recomputeSeq() {
        int total = 0;
        for (String lawName : lawDao.listLawNames()) {
            total += recomputeSeqForLaw(lawName);
        }
        log.info("重算法条序号完成，共 {} 条", total);
        return total;
    }

    /**
     * 只重排某一部法律的「法律内序号」，返回处理的条数。
     *
     * <p>新增法条后自动调用，保证列表始终按条号顺序展示，无需人工干预。</p>
     */
    private int recomputeSeqForLaw(String lawName) {
        if (StringUtil.isEmpty(lawName)) {
            return 0;
        }
        // 取该法律的全部法条（上限放宽到 1 万条，足够覆盖单部法律）
        List<LawArticle> list = lawDao.findByCondition(null, null, lawName, 0, 10000);
        if (list.isEmpty()) {
            return 0;
        }
        // 按条号的中文数字排序：第一条、第二条 … 第十条 … 第九十八条
        list.sort(Comparator.comparingInt(a -> StringUtil.parseArticleNo(a.getArticleNo())));
        int seq = 1;
        for (LawArticle a : list) {
            lawDao.updateSeq(a.getId(), seq++);
        }
        return list.size();
    }

    @Override
    public LawArticle create(LawArticle article) {
        validate(article);
        // source 是 NOT NULL 列：手工录入统一标 manual。
        // 注意：表单不传该字段时若原样带 NULL 进 INSERT，会绕过列默认值直接触发非空约束报错。
        if (StringUtil.isEmpty(article.getSource())) {
            article.setSource(SOURCE_MANUAL);
        }
        LocalDateTime now = DateUtil.now();
        article.setCreatedAt(now);
        article.setUpdatedAt(now);
        Long id = lawDao.insert(article);
        article.setId(id);
        // 新增后自动重排该法律的顺序号（新条目 seq 为空，不重排会排到最前面）
        recomputeSeqForLaw(article.getLawName());
        log.info("新增法条: id={}, {} {}", id, article.getLawName(), article.getArticleNo());
        return article;
    }

    @Override
    public LawArticle update(Long id, LawArticle article) {
        LawArticle old = getById(id);
        validate(article);
        article.setId(id);
        // 以下三个字段不由前端表单维护，必须沿用原值：
        //   source     —— 非空列，写空会触发约束报错
        //   created_at —— 非空列，写空同样报错
        //   seq        —— 系统维护的顺序号，写空会让该条排到最前面
        if (StringUtil.isEmpty(article.getSource())) {
            article.setSource(old.getSource());
        }
        article.setCreatedAt(old.getCreatedAt());
        article.setSeq(old.getSeq());
        article.setUpdatedAt(DateUtil.now());
        lawDao.update(article);
        // 条号可能被改动过，重排该法律的顺序号
        recomputeSeqForLaw(article.getLawName());
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
