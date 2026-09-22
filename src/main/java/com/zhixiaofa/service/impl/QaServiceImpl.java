package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.QaReferenceDao;
import com.zhixiaofa.dao.impl.FavoriteDaoImpl;
import com.zhixiaofa.dao.impl.LawArticleDaoImpl;
import com.zhixiaofa.dao.impl.QaRecordDaoImpl;
import com.zhixiaofa.dao.impl.QaReferenceDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.LawArticle;
import com.zhixiaofa.model.QaRecord;
import com.zhixiaofa.service.QaService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.JdbcExecutor;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * 智能法律问答业务实现。
 *
 * <p>核心流程 {@link #ask}（类似简化版 RAG）：</p>
 * <ol>
 *   <li>把用户问题拆成检索关键词，用 ngram 全文索引在 {@code law_article} 中召回法条；</li>
 *   <li>按召回结果拼装结构化回答（结论 + 依据 + 建议）并推断问题分类；</li>
 *   <li>在<b>同一事务</b>内写入 {@code qa_record}，再写入若干条 {@code qa_reference}，
 *       保证「问答记录」与「法条引用」要么都成功、要么都回滚，不会出现脏数据。</li>
 * </ol>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class QaServiceImpl implements QaService {

    private static final Logger log = LoggerFactory.getLogger(QaServiceImpl.class);

    /** 单次召回法条上限 */
    private static final int RECALL_LIMIT = 3;

    private final QaRecordDao qaDao;
    private final QaReferenceDao refDao;
    private final LawArticleDao lawDao;
    private final FavoriteDao favoriteDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public QaServiceImpl() {
        this(new QaRecordDaoImpl(), new QaReferenceDaoImpl(), new LawArticleDaoImpl(), new FavoriteDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param qaDao qaDao
     * @param refDao refDao
     * @param lawDao lawDao
     * @param favoriteDao favoriteDao
     */
    public QaServiceImpl(QaRecordDao qaDao, QaReferenceDao refDao, LawArticleDao lawDao, FavoriteDao favoriteDao) {
        this.qaDao = qaDao;
        this.refDao = refDao;
        this.lawDao = lawDao;
        this.favoriteDao = favoriteDao;
    }

    /** 分类关键词表：用于在用户未选分类时自动归类 */
    private static final String[][] CATEGORY_KEYWORDS = {
            // 顺序即优先级：越具体的分类排得越前，避免泛化词抢走具体分类。
            // 例：「签了竞业协议但没有补偿」同时含「竞业」与「补偿」，应归到更具体的「竞业限制」；
            //     「拖欠工资且未签劳动合同」两个分类都沾边，按维权主线归到「工资报酬」。
            {"竞业限制", "竞业", "保密协议", "商业秘密"},
            {"社会保险", "社保", "公积金", "五险", "医保", "养老保险"},
            {"工资报酬", "工资", "薪资", "拖欠", "克扣", "发薪", "劳动报酬"},
            {"解除终止", "辞退", "解除", "离职", "裁员", "开除", "经济补偿", "赔偿金", "辞职"},
            {"劳动合同", "劳动合同", "签合同", "签订合同", "试用期", "转正", "调岗", "续签", "合同"},
            {"工时休假", "加班费", "加班", "工时", "年假", "休息日", "调休", "节假日"},
    };

    @Override
    public QaRecord ask(Long userId, String question, String category) {
        if (StringUtil.isEmpty(question)) {
            throw new BizException(ResultCode.PARAM_ERROR, "问题内容不能为空");
        }
        String q = question.trim();
        if (q.length() < 4) {
            throw new BizException(ResultCode.PARAM_ERROR, "问题描述太短，请补充具体情况（不少于 4 个字）");
        }
        if (q.length() > 1000) {
            throw new BizException(ResultCode.PARAM_ERROR, "问题描述过长，请精简到 1000 字以内");
        }
        if (StringUtil.isEmpty(category)) {
            category = inferCategory(q);
        }
        // 1. 召回法条
        List<LawArticle> recalled = recall(q, category);
        // 2. 生成回答
        String answer = composeAnswer(q, recalled);
        final String finalCategory = category;
        final List<LawArticle> finalRecalled = recalled;

        // 3. 事务：问答记录 + 法条引用一起提交
        return JdbcExecutor.inTransaction(conn -> {
            LocalDateTime now = DateUtil.now();
            QaRecord record = new QaRecord();
            record.setUserId(userId);
            record.setQuestion(q);
            record.setAnswer(answer);
            record.setCategory(finalCategory);
            record.setStatus(1);
            record.setLikeCount(0);
            record.setCreatedAt(now);
            record.setUpdatedAt(now);
            long id = JdbcExecutor.insertAndReturnKey(conn,
                    "INSERT INTO qa_record (user_id, question, answer, category, status, like_count, created_at, updated_at)"
                            + " VALUES (?, ?, ?, ?, 1, 0, ?, ?)",
                    record.getUserId(), record.getQuestion(), record.getAnswer(), record.getCategory(), now, now);
            record.setId(id);

            // 写入法条引用（相关度按召回顺序递减）
            BigDecimal relevance = new BigDecimal("1.00");
            for (LawArticle law : finalRecalled) {
                refDao.insertRef(conn, id, law.getId(), relevance);
                relevance = relevance.subtract(new BigDecimal("0.10"));
            }
            log.info("问答生成完成: qaId={}, userId={}, 引用法条 {} 条", id, userId, finalRecalled.size());
            record.setReferences(finalRecalled);
            record.setCreatedAtText(DateUtil.friendly(now));
            return record;
        });
    }

    @Override
    public PageResult<QaRecord> myPage(Long userId, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = qaDao.countByUserId(userId);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        List<QaRecord> list = qaDao.findByUserId(userId, (pageNum - 1) * pageSize, pageSize);
        fillReferences(list);
        return PageResult.of(list, total, pageNum, pageSize);
    }

    @Override
    public QaRecord detail(Long id, Long currentUserId) {
        QaRecord record = qaDao.findById(id);
        if (record == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "问答记录不存在");
        }
        record.setReferences(refDao.findLawsByQaId(id));
        record.setCreatedAtText(DateUtil.friendly(record.getCreatedAt()));
        if (currentUserId != null) {
            record.setFavorited(favoriteDao.exists(currentUserId, "QA", id));
        }
        return record;
    }

    @Override
    public PageResult<QaRecord> page(String keyword, String category, Integer status, int pageNum, int pageSize) {
        return page(keyword, category, status, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<QaRecord> page(String keyword, String category, Integer status, int pageNum, int pageSize,
                                     String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = qaDao.countByCondition(keyword, category, status);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        List<QaRecord> list = qaDao.findByCondition(keyword, category, status, (pageNum - 1) * pageSize, pageSize, sortName, sortOrder);
        for (QaRecord r : list) {
            r.setCreatedAtText(DateUtil.friendly(r.getCreatedAt()));
        }
        return PageResult.of(list, total, pageNum, pageSize);
    }

    @Override
    public void like(Long id, Long userId) {
        QaRecord record = qaDao.findById(id);
        if (record == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "问答记录不存在");
        }
        qaDao.incrementLike(id);
    }

    @Override
    public QaRecord answer(Long id, String answer) {
        if (StringUtil.isEmpty(answer)) {
            throw new BizException(ResultCode.PARAM_ERROR, "回答内容不能为空");
        }
        if (qaDao.findById(id) == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "问答记录不存在");
        }
        qaDao.updateAnswer(id, answer.trim());
        return qaDao.findById(id);
    }

    @Override
    public void delete(Long id, Long operatorId, boolean admin) {
        QaRecord record = qaDao.findById(id);
        if (record == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "问答记录不存在");
        }
        if (!admin && !record.getUserId().equals(operatorId)) {
            throw new BizException(ResultCode.FORBIDDEN, "只能删除自己的问答记录");
        }
        // qa_reference 配置了 ON DELETE CASCADE，会随主记录一起清理
        qaDao.deleteById(id);
        log.info("删除问答: id={}, operator={}", id, operatorId);
    }

    @Override
    public List<Map<String, Object>> dailyStats(int days) {
        return qaDao.countByDay(days);
    }

    @Override
    public List<Map<String, Object>> categoryStats() {
        return qaDao.countGroupByCategory();
    }

    @Override
    public List<Map<String, Object>> hotQuestions(int limit) {
        return qaDao.topQuestions(limit);
    }

    // ------------------------------------------------------------------ 私有业务逻辑

    /**
     * 从问题中抽取关键词并召回法条。
     *
     * <p>策略：先用「问题中的长词段」做全文检索；检索不到时退回按分类取法条，
     * 保证任何提问都能给出可解释的依据。</p>
     */
    private List<LawArticle> recall(String question, String category) {
        Set<LawArticle> result = new LinkedHashSet<>();
        for (String kw : extractKeywords(question)) {
            try {
                List<LawArticle> hit = lawDao.findByCondition(kw, null, null, 0, RECALL_LIMIT);
                result.addAll(hit);
            } catch (Exception e) {
                // 全文检索异常（如关键词全是停用词）不影响主流程，退回分类匹配
                log.debug("全文检索无结果: kw={}, {}", kw, e.getMessage());
            }
            if (result.size() >= RECALL_LIMIT) {
                break;
            }
        }
        if (result.isEmpty() && StringUtil.isNotEmpty(category)) {
            result.addAll(lawDao.findByCondition(null, category, null, 0, RECALL_LIMIT));
        }
        List<LawArticle> list = new ArrayList<>(result);
        return list.size() > RECALL_LIMIT ? list.subList(0, RECALL_LIMIT) : list;
    }

    /**
     * 抽取检索关键词。
     *
     * <p>做法：按标点切断，取长度 ≥2 的片段；再把每个片段按 2 字滑窗切成词条，
     * 这样「老板拖欠我工资怎么办」能切出「拖欠」「工资」等可命中的词。</p>
     */
    /** 检索关键词抽取（包级可见，便于单元测试） */
    List<String> extractKeywords(String question) {
        Set<String> keywords = new LinkedHashSet<>();
        String cleaned = question.replaceAll("[\\p{Punct}\\s，。！？、；：“”‘’（）《》【】]+", " ").trim();
        for (String seg : cleaned.split("\\s+")) {
            if (seg.length() >= 2) {
                keywords.add(seg);
            }
        }
        // 2 字滑窗补充
        String compact = cleaned.replace(" ", "");
        for (int i = 0; i + 2 <= compact.length(); i++) {
            keywords.add(compact.substring(i, i + 2));
        }
        // 分类关键词优先命中，放在最前面
        for (String[] pair : CATEGORY_KEYWORDS) {
            for (int i = 1; i < pair.length; i++) {
                if (question.contains(pair[i])) {
                    keywords.add(pair[i]);
                }
            }
        }
        List<String> list = new ArrayList<>(keywords);
        list.sort((a, b) -> Integer.compare(b.length(), a.length()));
        return list.size() > 8 ? list.subList(0, 8) : list;
    }

    /** 按关键词推断问题分类 */
    /** 问题分类推断（包级可见，便于单元测试） */
    String inferCategory(String question) {
        for (String[] pair : CATEGORY_KEYWORDS) {
            for (int i = 1; i < pair.length; i++) {
                if (question.contains(pair[i])) {
                    return pair[0];
                }
            }
        }
        return "其他";
    }

    /** 拼装结构化回答：结论 → 法律依据 → 建议步骤 */
    /** 回答拼装（包级可见，便于单元测试） */
    String composeAnswer(String question, List<LawArticle> laws) {
        StringBuilder sb = new StringBuilder();
        sb.append("根据您描述的情况，初步分析如下：\n\n");
        sb.append("【初步结论】");
        if (laws.isEmpty()) {
            sb.append("您的问题涉及的具体情形需要补充材料才能进一步判断，建议先固定证据，"
                    + "再按「协商 → 投诉 → 仲裁」的顺序主张权利。");
        } else {
            sb.append("您的情况在现行劳动法律法规中有明确依据，建议优先通过书面方式主张权利，"
                    + "并注意保存证据。");
        }
        if (!laws.isEmpty()) {
            sb.append("\n\n【法律依据】\n");
            for (int i = 0; i < laws.size(); i++) {
                LawArticle l = laws.get(i);
                sb.append(i + 1).append(". 《").append(stripBrackets(l.getLawName())).append("》")
                        .append(l.getArticleNo());
                if (StringUtil.isNotEmpty(l.getTitle())) {
                    sb.append("（").append(l.getTitle()).append("）");
                }
                sb.append("：").append(l.getContent()).append("\n");
            }
        }
        sb.append("\n【建议步骤】\n");
        sb.append("1. 固定证据：保留劳动合同、工资流水、考勤记录、聊天记录等；\n");
        sb.append("2. 书面沟通：以邮件或微信向用人单位提出明确诉求，留痕；\n");
        sb.append("3. 行政投诉：向用工所在地劳动保障监察大队投诉；\n");
        sb.append("4. 申请仲裁：向劳动合同履行地或用人单位所在地的劳动人事争议仲裁委员会申请仲裁，"
                + "一般时效为一年。\n\n");
        sb.append("提示：以上内容由系统依据法规库自动生成，仅供参考，具体案件建议咨询专业律师。");
        return sb.toString();
    }

    private String stripBrackets(String lawName) {
        return lawName == null ? "" : lawName.replaceAll("[《》]", "");
    }

    /** 批量补齐问答记录引用的法条，避免列表页 N+1 查询 */
    private void fillReferences(List<QaRecord> list) {
        for (QaRecord r : list) {
            r.setReferences(refDao.findLawsByQaId(r.getId()));
            r.setCreatedAtText(DateUtil.friendly(r.getCreatedAt()));
        }
    }
}
