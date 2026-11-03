package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.ContractRiskDao;
import com.zhixiaofa.dao.impl.ContractDaoImpl;
import com.zhixiaofa.dao.impl.ContractRiskDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.Contract;
import com.zhixiaofa.model.ContractRisk;
import com.zhixiaofa.util.AiConfig;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhixiaofa.service.ContractService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.JdbcExecutor;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 合同审查业务实现。
 *
 * <p>审查引擎是一套<b>规则表</b>驱动的关键词匹配：每条规则包含「风险等级 / 命中关键词 /
 * 条款编号 / 风险说明 / 修改建议 / 关联法条」，命中的条款会生成一条 {@code contract_risk}。
 * 规则表放在类常量里，便于答辩时逐条讲解法条依据。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class ContractServiceImpl implements ContractService {

    private static final Logger log = LoggerFactory.getLogger(ContractServiceImpl.class);

    private final ContractDao contractDao;
    private final ContractRiskDao riskDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public ContractServiceImpl() {
        this(new ContractDaoImpl(), new ContractRiskDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param contractDao contractDao
     * @param riskDao riskDao
     */
    public ContractServiceImpl(ContractDao contractDao, ContractRiskDao riskDao) {
        this.contractDao = contractDao;
        this.riskDao = riskDao;
    }

    /**
     * 风险规则表：{风险等级, 触发关键词, 条款编号, 风险说明, 修改建议, 关联法条ID}
     */
    private static final Object[][] RULES = {
            {"高", "放弃", "第15条", "约定劳动者自愿放弃社会保险，属于违反法律强制性规定，该条款无效。",
                    "删除该条款，依法为员工办理社会保险登记并足额缴纳。", 13L},
            {"高", "无需支付经济补偿", "第12条", "竞业限制只约束劳动者而不约定补偿，条款对劳动者不产生约束力。",
                    "约定竞业限制期限不超过 2 年，并按月支付不低于离职前十二个月平均工资 30% 的补偿。", 10L},
            {"高", "试用期六个月", "第3条", "试用期约定可能超出法定上限，且试用期工资不得低于约定工资的 80%。",
                    "按合同期限核对试用期上限：1年以上不满3年不得超过 2 个月，3年以上不超过 6 个月。", 2L},
            {"高", "违约金", "第9条", "除服务期与竞业限制外，用人单位不得与劳动者约定由劳动者承担违约金。",
                    "删除该违约金条款。", 3L},
            {"高", "单方调岗", "第8条", "单方调岗降薪排除了劳动者的协商权，属于加重劳动者义务的无效条款。",
                    "改为“经双方协商一致可变更工作岗位与工作地点”，并约定书面确认方式。", 1L},
            {"中", "罚款", "第11条", "用人单位对劳动者没有罚款权，扣减工资需有法律依据。",
                    "删除罚款条款，改为绩效考核与管理制度。", 11L},
            {"中", "包干", "第6条", "加班费“包干”可能低于法定标准，休息日与法定节假日加班需分别按 200%、300% 支付。",
                    "改为按实际加班时长依据《劳动法》第四十四条据实结算。", 12L},
            {"中", "次月30日", "第4条", "工资发放时间过晚，容易被认定为拖欠劳动报酬。",
                    "调整为次月 15 日前发放，并明确遇节假日的提前发放规则。", 7L},
            {"中", "加班", "第6条", "合同未明确加班审批与加班费计算方式，后续易产生争议。",
                    "补充“加班需经书面审批，按法定标准支付加班费”条款。", 12L},
            {"中", "随时解除", "第10条", "赋予用人单位任意解除权，缩小了劳动者的权利。",
                    "解除条件应限定为《劳动合同法》第三十九条、第四十条列明的情形。", 6L},
            {"低", "规章制度", "第7条", "仅引用“依法制定的规章制度”，未将制度作为附件，举证明晰度不足。",
                    "将员工手册作为合同附件并要求劳动者签署确认。", 11L},
            {"低", "保密", "第13条", "保密条款未约定保密范围与期限，履行标准不明确。",
                    "明确保密信息范围、保密期限与违约责任。", 10L},
    };

    @Override
    public Contract review(Long userId, String fileName, String contractType,
                           String partyA, String partyB, String signDate, String content) {
        if (StringUtil.isEmpty(fileName)) {
            throw new BizException(ResultCode.PARAM_ERROR, "合同文件名不能为空");
        }
        if (StringUtil.isEmpty(content)) {
            throw new BizException(ResultCode.PARAM_ERROR, "合同正文不能为空");
        }
        // ① 规则扫描：决定「有没有风险 / 什么等级 / 哪一条 / 关联哪条法律」——
        //    这一步是**可解释、可复现**的，不交给模型。
        // ② 模型富化：只重写每条风险的「说明」与「建议」，且必须结合合同的**实际条款原文**。
        //    scan 本身保持纯粹（单测直接依赖它的规则文本），AI 是外面包的一层。
        List<ContractRisk> risks = enrichByAi(scan(content));

        // 事务：合同主表 + 风险点子表一起提交
        return JdbcExecutor.inTransaction(conn -> {
            LocalDateTime now = DateUtil.now();
            Contract c = new Contract();
            c.setUserId(userId);
            c.setFileName(fileName.trim());
            c.setContractType(StringUtil.defaultIfEmpty(contractType, "劳动合同"));
            c.setPartyA(StringUtil.trim(partyA));
            c.setPartyB(StringUtil.trim(partyB));
            c.setSignDate(DateUtil.parseDate(signDate));
            c.setContent(content);
            c.setRiskLevel(overallLevel(risks));
            c.setRiskCount(risks.size());
            c.setStatus(1);
            c.setCreatedAt(now);
            c.setUpdatedAt(now);

            long id = JdbcExecutor.insertAndReturnKey(conn,
                    "INSERT INTO contract (user_id, file_name, contract_type, party_a, party_b, sign_date,"
                            + " content, risk_level, risk_count, status, created_at, updated_at)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)",
                    c.getUserId(), c.getFileName(), c.getContractType(), c.getPartyA(), c.getPartyB(),
                    c.getSignDate(), c.getContent(), c.getRiskLevel(), c.getRiskCount(), now, now);
            c.setId(id);

            for (ContractRisk r : risks) {
                r.setContractId(id);
                riskDao.insertRisk(conn, r);
            }
            c.setRisks(risks);
            log.info("合同审查完成: id={}, 风险点 {} 条, 总体等级 {}", id, risks.size(), c.getRiskLevel());
            return c;
        });
    }

    @Override
    public PageResult<Contract> myPage(Long userId, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = contractDao.countByUserId(userId);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(contractDao.findByUserId(userId, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public PageResult<Contract> page(String keyword, String riskLevel, Integer status, int pageNum, int pageSize) {
        return page(keyword, riskLevel, status, pageNum, pageSize, null, null);
    }

    @Override
    public PageResult<Contract> page(String keyword, String riskLevel, Integer status, int pageNum, int pageSize,
                                     String sortName, String sortOrder) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = contractDao.countByCondition(keyword, riskLevel, status);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(contractDao.findByCondition(keyword, riskLevel, status,
                (pageNum - 1) * pageSize, pageSize, sortName, sortOrder), total, pageNum, pageSize);
    }

    @Override
    public Contract detail(Long id, Long operatorId, boolean admin) {
        Contract c = contractDao.findById(id);
        if (c == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "合同不存在");
        }
        if (!admin && !c.getUserId().equals(operatorId)) {
            throw new BizException(ResultCode.FORBIDDEN, "无权查看他人的合同");
        }
        c.setRisks(riskDao.findByContractId(id));
        return c;
    }

    @Override
    public void delete(Long id, Long operatorId, boolean admin) {
        detail(id, operatorId, admin);
        // contract_risk 配置了 ON DELETE CASCADE，随合同一并清理
        contractDao.deleteById(id);
        log.info("删除合同: id={}, operator={}", id, operatorId);
    }

    @Override
    public List<Map<String, Object>> riskLevelStats() {
        return riskDao.countGroupByLevel();
    }

    @Override
    public List<Map<String, Object>> typeStats() {
        return contractDao.countGroupByType();
    }

    @Override
    public List<Map<String, Object>> dailyStats(int days) {
        return contractDao.countByDay(days);
    }

    @Override
    public List<ContractRisk> risks(Long contractId) {
        return riskDao.findByContractId(contractId);
    }

    // ------------------------------------------------------------------ 审查引擎

    /** 逐条规则扫描正文，命中即生成一个风险点 */
    /** 风险规则扫描（包级可见，便于单元测试直接验证规则表） */
    List<ContractRisk> scan(String content) {
        List<ContractRisk> list = new ArrayList<>();
        String text = content.replace(" ", "");
        LocalDateTime now = DateUtil.now();
        for (Object[] rule : RULES) {
            String keyword = (String) rule[1];
            if (text.contains(keyword)) {
                ContractRisk r = new ContractRisk();
                r.setRiskLevel((String) rule[0]);
                r.setClauseNo((String) rule[2]);
                r.setClauseContent(extractClause(text, keyword));
                r.setRiskDesc((String) rule[3]);
                r.setSuggestion((String) rule[4]);
                r.setLawId((Long) rule[5]);
                r.setCreatedAt(now);
                list.add(r);
            }
        }
        return list;
    }

    // ------------------------------------------------------------------ 模型富化

    /**
     * 让模型把每条风险的「说明 / 建议」改写成**针对这份合同实际条款**的话。
     *
     * <h4>为什么现在的规则话术不够</h4>
     * <p>规则表里的 {@code riskDesc} / {@code suggestion} 是**通用话术**：只要命中关键词，
     * 每份合同看到的说明都一模一样，压根没看用户合同到底怎么写的。
     * 而 {@link #scan} 其实已经把命中的**条款原文**抓出来了（{@code clauseContent}）——
     * 把这段原文交给模型，它就能指出「你这份合同第 15 条是怎么写的、具体问题在哪」。</p>
     *
     * <h4>职责划分（与问答 / 小法庭一致）</h4>
     * <p><b>判定归规则，表述归模型</b>：风险等级、条款编号、关联法条全部保留规则结果，
     * 模型只改两段文字，且在提示词里明令不得改动已给出的法定标准（30%、200%/300%、2 年等）。</p>
     *
     * <p>任何一步出问题（未启用 / 调用失败 / 返回不是合法 JSON / 条目对不上）都**原样返回规则话术**，
     * 也就是回到本次改动之前的行为 —— 审查功能不会因为模型挂了而不可用。</p>
     *
     * @param risks 规则扫描结果（会被就地修改）
     * @return 同一个 list（便于链式调用）
     */
    List<ContractRisk> enrichByAi(List<ContractRisk> risks) {
        if (risks == null || risks.isEmpty() || !AiConfig.isEnabled()) {
            return risks;
        }
        try {
            String raw = LlmClient.chat(CONTRACT_SYSTEM_PROMPT, buildContractUserMessage(risks));
            int n = applyAiText(risks, raw);
            if (n > 0) {
                log.info("合同审查：{} 条风险点的说明与建议由模型结合合同原文重写（规则判定未改动）", n);
            }
            return risks;
        } catch (Exception e) {
            // 降级是设计内的退路，只 warn 不抛
            log.warn("模型重写风险点失败，保留规则话术: {}", e.getMessage());
            return risks;
        }
    }

    /** 系统提示词。⚠️ 「只输出 JSON 数组」是硬约束，调用方按 {@code i} 序号回填 */
    private static final String CONTRACT_SYSTEM_PROMPT =
            "你是中国劳动合同风险审查助手。用户上传了一份劳动合同，系统已用规则命中了几处风险条款。\n"
          + "你只负责**把每处风险讲清楚**；风险等级与条款编号由规则判定，不由你决定，也不得改动。\n"
          + "硬约束：\n"
          + "1. 只输出**一个 JSON 数组**，不要任何解释文字，不要用 ``` 代码块包裹。\n"
          + "2. 每个元素形如 {\"i\": 1, \"desc\": 风险说明, \"suggestion\": 修改建议}；\n"
          + "   i 必须与下方的「风险点编号」一一对应，不增不减、不打乱。\n"
          + "3. desc：结合给出的**合同原文字段**说明这处条款为什么有风险（2~3 句），要能让用户对照自己的合同看懂。\n"
          + "4. suggestion：给出能直接落到合同文字上的修改方案 —— 改成什么表述、补什么条款，不要空泛。\n"
          + "5. **原说明与原建议里已有的法定标准（如「不低于 30%」「200%、300%」「不超过 2 年」）与法条条号\n"
          + "   （如《劳动合同法》第三十九条）必须原样保留，不得改动数字、不得新增或更换条号。**\n"
          + "6. 不要编造合同里没写的内容，不要新增风险点。\n"
          + "7. 简体中文，平实，不用任何 Markdown 符号。";

    /** 把「风险点编号 + 条款原文 + 原说明原建议」拼成用户消息 */
    private String buildContractUserMessage(List<ContractRisk> risks) {
        StringBuilder sb = new StringBuilder();
        sb.append("【风险点】共 ").append(risks.size()).append(" 处（等级与条款编号由系统判定，不得改动）\n");
        for (int i = 0; i < risks.size(); i++) {
            ContractRisk r = risks.get(i);
            sb.append("\n--- 风险点 ").append(i + 1).append(" ---\n");
            sb.append("风险等级：").append(r.getRiskLevel()).append("\n");
            sb.append("条款编号：").append(StringUtil.defaultIfEmpty(r.getClauseNo(), "未标注")).append("\n");
            sb.append("合同原文：").append(StringUtil.defaultIfEmpty(r.getClauseContent(), "（未截取到原文）")).append("\n");
            sb.append("系统原说明：").append(r.getRiskDesc()).append("\n");
            sb.append("系统原建议：").append(r.getSuggestion()).append("\n");
        }
        sb.append("\n请按要求输出 JSON 数组。");
        return sb.toString();
    }

    /**
     * 把模型返回的 JSON 数组回填到风险点。
     *
     * <p>用 {@code i}（1 起）作为对应关系，**不用条款号** —— 同一份合同里
     * 「第 6 条」可能被判出两处风险（加班费包干 + 加班审批），用条款号会串。</p>
     *
     * @return 成功改写的条数；0 表示这份返回不可用（调用方据此决定要不要打日志）
     */
    private int applyAiText(List<ContractRisk> risks, String raw) {
        if (StringUtil.isEmpty(raw)) {
            return 0;
        }
        // 模型偶尔会在 JSON 前后带一句话，宽进：取第一个 [ 到最后一个 ]
        int a = raw.indexOf('[');
        int b = raw.lastIndexOf(']');
        if (a < 0 || b <= a) {
            return 0;
        }
        JsonNode arr;
        try {
            arr = new ObjectMapper().readTree(raw.substring(a, b + 1));
        } catch (Exception e) {
            log.warn("模型返回的 JSON 解析失败，保留规则话术: {}", e.getMessage());
            return 0;
        }
        if (arr == null || !arr.isArray()) {
            return 0;
        }
        int n = 0;
        for (JsonNode node : arr) {
            int i = node.path("i").asInt(0);
            if (i < 1 || i > risks.size()) {
                continue;
            }
            ContractRisk r = risks.get(i - 1);
            String desc = node.path("desc").asText("");
            String sug = node.path("suggestion").asText("");
            if (StringUtil.isNotEmpty(desc)) {
                r.setRiskDesc(desc.trim());
                n++;
            }
            if (StringUtil.isNotEmpty(sug)) {
                r.setSuggestion(sug.trim());
            }
        }
        return n;
    }

    /** 取命中关键词附近的一段原文作为「问题条款」，便于前端定位 */
    private String extractClause(String text, String keyword) {
        int idx = text.indexOf(keyword);
        if (idx < 0) {
            return "";
        }
        int start = Math.max(0, idx - 20);
        int end = Math.min(text.length(), idx + keyword.length() + 40);
        return "..." + text.substring(start, end) + "...";
    }

    /** 整体风险等级：有 1 条高风险即为「高」，否则有中风险为「中」，否则「低」 */
    /** 整体风险等级判定（包级可见，便于单元测试） */
    String overallLevel(List<ContractRisk> risks) {
        boolean hasMid = false;
        for (ContractRisk r : risks) {
            if ("高".equals(r.getRiskLevel())) {
                return "高";
            }
            if ("中".equals(r.getRiskLevel())) {
                hasMid = true;
            }
        }
        return hasMid ? "中" : "低";
    }

    private int clamp(int size) {
        return size < 1 ? 10 : Math.min(size, 100);
    }
}
