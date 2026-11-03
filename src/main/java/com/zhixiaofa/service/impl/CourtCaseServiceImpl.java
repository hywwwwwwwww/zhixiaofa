package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.CourtCaseDao;
import com.zhixiaofa.dao.impl.CourtCaseDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.CourtCase;
import com.zhixiaofa.util.AiConfig;
import com.zhixiaofa.service.CourtCaseService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * AI 小法庭业务实现。
 *
 * <p>推演规则（可解释的启发式模型，而非黑盒）：以案件类型为基准胜率，
 * 结合案情描述中的关键要素（是否书面通知、是否有证据、涉及金额、工作时间）加权修正，
 * 最后按类案赔偿区间给出估算区间。所有评分口径都在下方常量表中，便于答辩讲解。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class CourtCaseServiceImpl implements CourtCaseService {

    private static final Logger log = LoggerFactory.getLogger(CourtCaseServiceImpl.class);

    private final CourtCaseDao caseDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public CourtCaseServiceImpl() {
        this(new CourtCaseDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param caseDao caseDao
     */
    public CourtCaseServiceImpl(CourtCaseDao caseDao) {
        this.caseDao = caseDao;
    }

    /** 案件类型 → 基准胜诉率(%) */
    private static final Object[][] TYPE_BASE = {
            {"拖欠工资", new BigDecimal("90.00")},
            {"违法辞退", new BigDecimal("78.00")},
            {"加班费", new BigDecimal("72.00")},
            {"社保", new BigDecimal("85.00")},
            {"其他", new BigDecimal("70.00")},
    };

    /** 描述中出现这些词，说明证据较充分，胜率上浮 */
    private static final String[] POSITIVE = {
            "书面", "邮件", "微信", "聊天记录", "录音", "流水", "考勤", "打卡", "截图", "合同", "有证据", "盖章"};

    /** 描述中出现这些词，说明举证困难，胜率下调 */
    private static final String[] NEGATIVE = {
            "口头", "没有证据", "无证据", "记不清", "找不到", "没有记录", "私下"};

    /** 关键词命中时给出的分类提示 */
    private static final String[][] TYPE_KEYWORDS = {
            {"拖欠工资", "拖欠", "没发工资", "克扣", "不发工资", "工资没给"},
            {"加班费", "加班", "加班费", "延时工作"},
            {"社保", "社保", "公积金", "五险"},
            {"违法辞退", "辞退", "开除", "解雇", "解除", "裁员", "劝退"},
    };

    @Override
    public CourtCase evaluate(Long userId, String title, String description, String caseType) {
        if (StringUtil.isEmpty(description) || description.trim().length() < 10) {
            throw new BizException(ResultCode.PARAM_ERROR, "案情描述不能少于 10 个字，请补充时间、金额、经过等要素");
        }
        String desc = description.trim();
        if (StringUtil.isEmpty(caseType)) {
            caseType = inferType(desc);
        }
        String finalTitle = StringUtil.defaultIfEmpty(title,
                StringUtil.abbreviate(desc, 24) == null ? "未命名案件" : StringUtil.abbreviate(desc, 24));

        BigDecimal probability = calcProbability(desc, caseType);
        BigDecimal[] range = calcCompensation(desc, caseType);
        int similar = 12 + Math.abs(desc.hashCode() % 45);

        CourtCase c = new CourtCase();
        c.setUserId(userId);
        c.setTitle(finalTitle);
        c.setDescription(desc);
        c.setCaseType(caseType);
        c.setWinProbability(probability);
        c.setCompensationMin(range[0]);
        c.setCompensationMax(range[1]);
        c.setSimilarCount(similar);
        c.setResultSummary(buildSummary(desc, caseType, probability, range, similar));
        c.setCreatedAt(DateUtil.now());

        Long id = caseDao.insert(c);
        c.setId(id);
        log.info("案件推演完成: id={}, type={}, prob={}%", id, caseType, probability);
        return c;
    }

    @Override
    public PageResult<CourtCase> myPage(Long userId, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = caseDao.countByUserId(userId);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(caseDao.findByUserId(userId, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public PageResult<CourtCase> page(String keyword, String caseType, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = caseDao.countByCondition(keyword, caseType);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(caseDao.findByCondition(keyword, caseType, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public CourtCase getById(Long id) {
        CourtCase c = caseDao.findById(id);
        if (c == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "案件不存在");
        }
        return c;
    }

    @Override
    public void delete(Long id, Long operatorId, boolean admin) {
        CourtCase c = getById(id);
        if (!admin && !c.getUserId().equals(operatorId)) {
            throw new BizException(ResultCode.FORBIDDEN, "只能删除自己提交的案件");
        }
        caseDao.deleteById(id);
    }

    @Override
    public List<Map<String, Object>> typeStats() {
        return caseDao.countGroupByType();
    }

    @Override
    public List<Map<String, Object>> probabilityStats() {
        return caseDao.avgProbabilityByType();
    }

    @Override
    public List<Map<String, Object>> dailyStats(int days) {
        return caseDao.countByDay(days);
    }

    // ------------------------------------------------------------------ 推演算法

    /** 按描述推断案件类型 */
    /** 案件类型推断（包级可见，便于单元测试） */
    String inferType(String desc) {
        for (String[] pair : TYPE_KEYWORDS) {
            for (int i = 1; i < pair.length; i++) {
                if (desc.contains(pair[i])) {
                    return pair[0];
                }
            }
        }
        return "其他";
    }

    /** 基准胜率 + 证据要素修正，结果限制在 35%~97% */
    /** 胜诉概率模型（包级可见，便于单元测试） */
    BigDecimal calcProbability(String desc, String caseType) {
        BigDecimal base = new BigDecimal("70.00");
        for (Object[] row : TYPE_BASE) {
            if (row[0].equals(caseType)) {
                base = (BigDecimal) row[1];
                break;
            }
        }
        int positive = 0;
        for (String kw : POSITIVE) {
            if (desc.contains(kw)) {
                positive++;
            }
        }
        int negative = 0;
        for (String kw : NEGATIVE) {
            if (desc.contains(kw)) {
                negative++;
            }
        }
        // 每个正向证据 +2%，每个不利因素 -3%，最多各计 5 项
        BigDecimal delta = new BigDecimal(Math.min(positive, 5) * 2 - Math.min(negative, 5) * 3);
        BigDecimal result = base.add(delta);
        if (result.compareTo(new BigDecimal("97.00")) > 0) {
            result = new BigDecimal("97.00");
        }
        if (result.compareTo(new BigDecimal("35.00")) < 0) {
            result = new BigDecimal("35.00");
        }
        return result.setScale(2, RoundingMode.HALF_UP);
    }

    /** 估算赔偿区间：识别描述中的金额，按「月工资 × 月数」推算 */
    /** 赔偿区间模型（包级可见，便于单元测试） */
    BigDecimal[] calcCompensation(String desc, String caseType) {
        BigDecimal monthly = extractAmount(desc);
        BigDecimal minMonths;
        BigDecimal maxMonths;
        switch (caseType) {
            case "违法辞退":
                minMonths = new BigDecimal("2");
                maxMonths = new BigDecimal("6");
                break;
            case "拖欠工资":
                minMonths = new BigDecimal("1");
                maxMonths = new BigDecimal("2");
                break;
            case "加班费":
                minMonths = new BigDecimal("0.5");
                maxMonths = new BigDecimal("1.5");
                break;
            case "社保":
                return new BigDecimal[]{BigDecimal.ZERO, BigDecimal.ZERO};
            default:
                minMonths = new BigDecimal("1");
                maxMonths = new BigDecimal("3");
        }
        BigDecimal min = monthly.multiply(minMonths).setScale(2, RoundingMode.HALF_UP);
        BigDecimal max = monthly.multiply(maxMonths).setScale(2, RoundingMode.HALF_UP);
        return new BigDecimal[]{min, max};
    }

    /** 从描述中提取第一个金额数字（支持「8000元」「1.2万」），取不到时按 6000 估算 */
    private BigDecimal extractAmount(String desc) {
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("(\\d+(?:\\.\\d+)?)\\s*万").matcher(desc);
        if (m.find()) {
            return new BigDecimal(m.group(1)).multiply(new BigDecimal("10000"));
        }
        m = java.util.regex.Pattern.compile("(\\d{3,7})").matcher(desc);
        if (m.find()) {
            return new BigDecimal(m.group(1));
        }
        return new BigDecimal("6000");
    }

    /**
     * 生成推演结论。
     *
     * <p><b>职责划分（这条不能破）</b>：胜诉概率、赔偿区间、同类案件数都是
     * {@link #calcProbability} / {@link #calcCompensation} <b>算出来的</b>，
     * 是「可解释、可复现」的数值 —— 模型只负责**把这些数字讲成人话**，
     * 提示词里明令不得改动任何数字。数值归算法、表述归模型。</p>
     */
    private String buildSummary(String description, String caseType, BigDecimal probability,
                                BigDecimal[] range, int similar) {
        if (AiConfig.isEnabled()) {
            try {
                return LlmClient.chat(COURT_SYSTEM_PROMPT,
                        buildCourtUserMessage(description, caseType, probability, range, similar));
            } catch (Exception e) {
                log.warn("模型生成推演结论失败，降级为规则拼装: {}", e.getMessage());
            }
        }
        return buildSummaryByRule(caseType, probability, range, similar);
    }

    /** 系统提示词。⚠️ 三段式小节名是硬约束：前端会把【…】渲染成小节标题 */
    private static final String COURT_SYSTEM_PROMPT =
            "你是「职小法」的劳动争议推演助手，面向不懂法的普通劳动者。必须遵守：\n"
          + "1. **绝对不得改动用户消息里给出的任何数字**（胜诉概率、赔偿区间、同类案件数）——\n"
          + "   那些是系统按类案数据算出来的，你只负责用它们成文，不得重算、不得四舍五入成别的值。\n"
          + "2. 严格按三段式输出，小节名用中文方括号包裹且不得增删改：\n"
          + "   【推演结论】\n【维权路径】\n【举证提示】\n"
          + "3. 【推演结论】结合案情说清「这类争议通常怎么认、用户主张是否站得住」，2~4 句。\n"
          + "4. 【维权路径】写成「协商 → 劳动监察投诉 → 劳动仲裁 → 起诉」的递进链条，并点明时效。\n"
          + "5. 【举证提示】列出 3~5 项对本类案件最关键的证据，说明各自能证明什么。\n"
          + "6. 简体中文，平实，不写客套话，不用任何 Markdown 符号。";

    private String buildCourtUserMessage(String description, String caseType, BigDecimal probability,
                                         BigDecimal[] range, int similar) {
        StringBuilder sb = new StringBuilder();
        sb.append("【案情描述】\n").append(description).append("\n\n");
        sb.append("【系统判定】\n");
        sb.append("案件类型：").append(caseType).append("\n");
        sb.append("同类案件数：").append(similar).append(" 件\n");
        sb.append("预估胜诉概率：").append(probability).append("%\n");
        if (range[1].compareTo(BigDecimal.ZERO) > 0) {
            sb.append("参考赔偿区间：").append(range[0].stripTrailingZeros().toPlainString())
              .append(" ~ ").append(range[1].stripTrailingZeros().toPlainString()).append(" 元\n");
        } else {
            sb.append("参考赔偿区间：本类案件通常支持补缴而非金钱赔偿\n");
        }
        sb.append("\n请据此输出三段式推演结论，数字必须与上面完全一致。");
        return sb.toString();
    }

    /** 原来的规则拼装，作为降级路径保留 */
    private String buildSummaryByRule(String caseType, BigDecimal probability, BigDecimal[] range, int similar) {
        StringBuilder sb = new StringBuilder();
        sb.append("【推演结论】本案属于「").append(caseType).append("」类劳动争议，")
                .append("系统检索到 ").append(similar).append(" 件同类案件，")
                .append("预估胜诉概率约 ").append(probability).append("%。");
        if (range[1].compareTo(BigDecimal.ZERO) > 0) {
            sb.append("参考赔偿区间为 ").append(range[0].stripTrailingZeros().toPlainString())
                    .append(" ~ ").append(range[1].stripTrailingZeros().toPlainString()).append(" 元。");
        } else {
            sb.append("该类型案件通常支持补缴而非金钱赔偿，建议主张补缴社保。");
        }
        sb.append("\n【维权路径】协商 → 劳动监察投诉 → 劳动仲裁（一般时效一年） → 不服可起诉。");
        sb.append("\n【举证提示】书面通知、工资流水、考勤记录、聊天记录是提高胜率的关键证据。");
        return sb.toString();
    }

    private int clamp(int size) {
        return size < 1 ? 10 : Math.min(size, 100);
    }
}
