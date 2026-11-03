package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.DocTemplateDao;
import com.zhixiaofa.dao.impl.DocRecordDaoImpl;
import com.zhixiaofa.dao.impl.DocTemplateDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.DocRecord;
import com.zhixiaofa.model.DocTemplate;
import com.zhixiaofa.util.AiConfig;
import com.zhixiaofa.service.DocService;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.JsonUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 文书起草业务实现。
 *
 * <p>模板渲染：模板正文中的占位符写作 <code>${字段名}</code>，
 * 生成时用正则 {@code \$\{([^}]+)\}} 逐个替换；用户没填的字段保留占位符原样，
 * 这样下载出来的文书能一眼看出哪些地方还需要补。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class DocServiceImpl implements DocService {

    private static final Logger log = LoggerFactory.getLogger(DocServiceImpl.class);

    /** 占位符正则：${xxx} */
    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([^}]+)\\}");

    private final DocTemplateDao templateDao;
    private final DocRecordDao docDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public DocServiceImpl() {
        this(new DocTemplateDaoImpl(), new DocRecordDaoImpl());
    }

    /**
     * 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩。
     *
     * @param templateDao templateDao
     * @param docDao docDao
     */
    public DocServiceImpl(DocTemplateDao templateDao, DocRecordDao docDao) {
        this.templateDao = templateDao;
        this.docDao = docDao;
    }

    @Override
    public List<DocTemplate> listTemplates() {
        return templateDao.findEnabled();
    }

    @Override
    public DocTemplate getTemplate(Long id) {
        DocTemplate t = templateDao.findById(id);
        if (t == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文书模板不存在");
        }
        t.setPlaceholders(parsePlaceholders(t.getContentTemplate()));
        return t;
    }

    @Override
    public DocRecord generate(Long userId, Long templateId, Map<String, String> params) {
        DocTemplate template = getTemplate(templateId);
        if (template.getEnabled() == null || template.getEnabled() != 1) {
            throw new BizException(ResultCode.OPERATION_NOT_ALLOWED, "该模板已停用");
        }
        Map<String, String> safeParams = params == null ? new LinkedHashMap<>() : params;
        String content = render(template.getContentTemplate(), safeParams);
        // 若模型可用且开关打开：把「（此处待补充：X）」这类**用户留空的**字段交给模型起草。
        // ⚠️ 只填空，**绝不改动模板自身的固定条款、法条引用与格式**（那是文书的法律骨架）。
        content = aiFillMissing(content, template.getName(), safeParams);

        String title = safeParams.get("标题");
        if (StringUtil.isEmpty(title)) {
            title = template.getName() + "-" + DateUtil.format(DateUtil.now()).substring(0, 10);
        }
        LocalDateTime now = DateUtil.now();
        DocRecord record = new DocRecord();
        record.setUserId(userId);
        record.setTemplateId(templateId);
        record.setTitle(title);
        record.setParamsJson(JsonUtil.toJson(safeParams));
        record.setContent(content);
        record.setCreatedAt(now);
        record.setUpdatedAt(now);
        Long id = docDao.insert(record);
        record.setId(id);
        record.setTemplateName(template.getName());
        log.info("生成文书: id={}, userId={}, template={}", id, userId, template.getCode());
        return record;
    }

    @Override
    public PageResult<DocRecord> myPage(Long userId, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = docDao.countByUserId(userId);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(docDao.findByUserId(userId, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public PageResult<DocRecord> page(String keyword, Long userId, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = docDao.countByCondition(keyword, userId);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(docDao.findByCondition(keyword, userId, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public DocRecord detail(Long id, Long operatorId, boolean admin) {
        DocRecord record = docDao.findByIdWithDetail(id);
        if (record == null) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "文书不存在");
        }
        if (!admin && !record.getUserId().equals(operatorId)) {
            throw new BizException(ResultCode.FORBIDDEN, "无权查看他人的文书");
        }
        return record;
    }

    @Override
    public DocRecord updateContent(Long id, Long operatorId, String title, String content) {
        DocRecord record = detail(id, operatorId, false);
        if (StringUtil.isNotEmpty(title)) {
            record.setTitle(title.trim());
        }
        if (StringUtil.isNotEmpty(content)) {
            record.setContent(content);
        }
        record.setUpdatedAt(DateUtil.now());
        docDao.update(record);
        return record;
    }

    @Override
    public void delete(Long id, Long operatorId, boolean admin) {
        detail(id, operatorId, admin);
        docDao.deleteById(id);
        log.info("删除文书: id={}, operator={}", id, operatorId);
    }

    @Override
    public PageResult<DocTemplate> templatePage(String keyword, String category, int pageNum, int pageSize) {
        pageNum = Math.max(1, pageNum);
        pageSize = clamp(pageSize);
        long total = templateDao.countByCondition(keyword, category);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        return PageResult.of(templateDao.findByCondition(keyword, category, (pageNum - 1) * pageSize, pageSize),
                total, pageNum, pageSize);
    }

    @Override
    public DocTemplate saveTemplate(DocTemplate template) {
        validateTemplate(template);
        if (templateDao.findByCode(template.getCode()) != null) {
            throw new BizException(ResultCode.DUPLICATE_OPERATION, "模板编码 " + template.getCode() + " 已存在");
        }
        template.setCreatedAt(DateUtil.now());
        if (template.getSortNo() == null) {
            template.setSortNo(0);
        }
        if (template.getEnabled() == null) {
            template.setEnabled(1);
        }
        Long id = templateDao.insert(template);
        template.setId(id);
        return template;
    }

    @Override
    public DocTemplate updateTemplate(Long id, DocTemplate template) {
        DocTemplate old = getTemplate(id);
        validateTemplate(template);
        template.setId(old.getId());
        template.setCode(old.getCode());
        template.setCreatedAt(old.getCreatedAt());
        templateDao.update(template);
        return templateDao.findById(id);
    }

    @Override
    public void deleteTemplate(Long id) {
        DocTemplate t = getTemplate(id);
        // doc_record.template_id 有外键约束（ON DELETE RESTRICT），先翻译成业务提示
        try {
            templateDao.deleteById(id);
        } catch (RuntimeException e) {
            log.warn("删除模板失败: id={}", id, e);
            throw new BizException(ResultCode.OPERATION_NOT_ALLOWED,
                    "模板「" + t.getName() + "」已被用户使用，无法删除，可改为停用");
        }
    }

    @Override
    public List<Map<String, Object>> templateCategoryStats() {
        return templateDao.countGroupByCategory();
    }

    @Override
    public List<Map<String, Object>> templateUsageStats(int limit) {
        return docDao.topTemplates(limit);
    }

    // ------------------------------------------------------------------ 私有方法

    /** 用正则找出模板里所有占位符，按出现顺序去重 */
    /** 占位符解析（包级可见，便于单元测试） */
    List<String> parsePlaceholders(String template) {
        List<String> list = new ArrayList<>();
        if (template == null) {
            return list;
        }
        Matcher m = PLACEHOLDER.matcher(template);
        while (m.find()) {
            String key = m.group(1).trim();
            if (!list.contains(key)) {
                list.add(key);
            }
        }
        return list;
    }

    /** 渲染：逐个替换占位符，未填写的位置保持原样以便人工补齐 */
    /** 占位符渲染（包级可见，便于单元测试） */
    String render(String template, Map<String, String> params) {
        if (template == null) {
            return "";
        }
        Matcher m = PLACEHOLDER.matcher(template);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            String key = m.group(1).trim();
            String value = params.get(key);
            if (value == null) {
                value = lookup(params, key);
            }
            if (StringUtil.isEmpty(value)) {
                value = "（此处待补充：" + key + "）";
            }
            m.appendReplacement(sb, Matcher.quoteReplacement(value));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    /** 空字段标记，与 {@link #render} 里留的文案必须一致 */
    private static final java.util.regex.Pattern TODO_MARK =
            java.util.regex.Pattern.compile("（此处待补充：([^）]+)）");

    /**
     * 让模型补全用户留空的字段。
     *
     * <p><b>只做一件事</b>：把 {@code （此处待补充：X）} 换成模型写的内容。
     * 模板里其余文字（固定条款、格式、已有内容）一个字都不动 —— 文书是有法律效力的格式文本，
     * 让模型重写整篇风险太高。</p>
     *
     * <p>任何一步出问题（未启用 / 调用失败 / 返回不是合法 JSON / 字段对不上）都**原样返回**，
     * 也就是保留「（此处待补充：X）」让用户自己填 —— 保持原先的可预期行为。</p>
     */
    private String aiFillMissing(String content, String templateName, Map<String, String> params) {
        if (!AiConfig.isEnabled() || !AiConfig.fillDocPlaceholders() || StringUtil.isEmpty(content)) {
            return content;
        }
        java.util.LinkedHashSet<String> missing = new java.util.LinkedHashSet<>();
        java.util.regex.Matcher mm = TODO_MARK.matcher(content);
        while (mm.find()) {
            missing.add(mm.group(1).trim());
        }
        if (missing.isEmpty()) {
            return content;
        }
        try {
            String raw = LlmClient.chat(DOC_SYSTEM_PROMPT,
                    buildDocUserMessage(templateName, params, missing));
            Map<String, String> filled = parseJsonObject(raw);
            int n = 0;
            for (Map.Entry<String, String> e : filled.entrySet()) {
                String key = e.getKey() == null ? "" : e.getKey().trim();
                String val = e.getValue();
                if (key.isEmpty() || StringUtil.isEmpty(val)) {
                    continue;
                }
                content = content.replace("（此处待补充：" + key + "）", val);
                n++;
            }
            if (n == 0) {
                return content;
            }
            content = content + "\n\n（本份文书中 " + n + " 处内容由 AI 起草，请核对后再使用。）";
            log.info("文书 AI 补全 {} 个空字段: template={}", n, templateName);
            return content;
        } catch (Exception e) {
            log.warn("文书 AI 补全失败，保留待补充标记: {}", e.getMessage());
            return content;
        }
    }

    /** 系统提示词：只要 JSON，且禁止编造具体身份信息 */
    private static final String DOC_SYSTEM_PROMPT =
            "你是中国法律文书起草助手。用户填了一份文书模板，其中若干字段留空了。\n"
          + "硬约束：\n"
          + "1. 只输出**一个 JSON 对象**：键是留空字段名，值是你为该字段写的内容。\n"
          + "   不要输出任何解释文字，不要用 ``` 代码块包裹。\n"
          + "2. 不要改动文书里已有的任何内容，你只负责补空。\n"
          + "3. **不要编造具体人名、公司名、金额、日期** —— 用户没给的，一律用「（待填）」占位。\n"
          + "4. 内容须符合中国大陆法律文书的行文习惯，简体中文，不用 Markdown 符号。";

    private String buildDocUserMessage(String templateName, Map<String, String> params,
                                       java.util.Collection<String> missing) {
        StringBuilder sb = new StringBuilder();
        sb.append("【文书模板】").append(templateName).append("\n\n");
        sb.append("【用户已填写的字段】\n");
        if (params == null || params.isEmpty()) {
            sb.append("（无）\n");
        } else {
            for (Map.Entry<String, String> e : params.entrySet()) {
                if (StringUtil.isNotEmpty(e.getValue())) {
                    sb.append("- ").append(e.getKey()).append("：").append(e.getValue()).append("\n");
                }
            }
        }
        sb.append("\n【需要你补写的字段】\n");
        for (String k : missing) {
            sb.append("- ").append(k).append("\n");
        }
        sb.append("\n请输出 JSON，键为上述字段名。");
        return sb.toString();
    }

    /** 宽松地从一个可能含多余文字的响应里抠出 JSON 对象 */
    private Map<String, String> parseJsonObject(String raw) {
        Map<String, String> out = new LinkedHashMap<>();
        if (raw == null) {
            return out;
        }
        int a = raw.indexOf('{');
        int b = raw.lastIndexOf('}');
        if (a < 0 || b <= a) {
            return out;
        }
        try {
            com.fasterxml.jackson.databind.JsonNode node =
                    new com.fasterxml.jackson.databind.ObjectMapper().readTree(raw.substring(a, b + 1));
            java.util.Iterator<String> it = node.fieldNames();
            while (it.hasNext()) {
                String k = it.next();
                out.put(k, node.path(k).asText(""));
            }
        } catch (Exception ignored) {
            // 解析不了就当没补，调用方会保留原标记
        }
        return out;
    }

    /** 宽松匹配：忽略首尾空白与全半角差异 */
    private String lookup(Map<String, String> params, String key) {
        for (Map.Entry<String, String> e : params.entrySet()) {
            if (e.getKey() != null && e.getKey().trim().equals(key)) {
                return e.getValue();
            }
        }
        return null;
    }

    private void validateTemplate(DocTemplate t) {
        if (StringUtil.isEmpty(t.getCode())) {
            throw new BizException(ResultCode.PARAM_ERROR, "模板编码不能为空");
        }
        if (StringUtil.isEmpty(t.getName())) {
            throw new BizException(ResultCode.PARAM_ERROR, "模板名称不能为空");
        }
        if (StringUtil.isEmpty(t.getContentTemplate())) {
            throw new BizException(ResultCode.PARAM_ERROR, "模板正文不能为空");
        }
    }

    private int clamp(int size) {
        return size < 1 ? 10 : Math.min(size, 100);
    }
}
