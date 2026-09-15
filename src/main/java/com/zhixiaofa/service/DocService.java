package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.DocRecord;
import com.zhixiaofa.model.DocTemplate;

import java.util.List;
import java.util.Map;

/**
 * 法律文书起草业务接口：模板管理 + 按模板渲染生成文书。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface DocService {

    /** 前台可用模板 */
    List<DocTemplate> listTemplates();

    /** 模板详情（含占位符解析结果） */
    DocTemplate getTemplate(Long id);

    /**
     * 按模板生成文书：把 ${占位符} 替换为用户填写内容。
     *
     * @param userId     生成人
     * @param templateId 模板ID
     * @param params     占位符 → 填写值
     * @return 生成并已保存的文书
     */
    DocRecord generate(Long userId, Long templateId, Map<String, String> params);

    PageResult<DocRecord> myPage(Long userId, int pageNum, int pageSize);

    PageResult<DocRecord> page(String keyword, Long userId, int pageNum, int pageSize);

    DocRecord detail(Long id, Long operatorId, boolean admin);

    DocRecord updateContent(Long id, Long operatorId, String title, String content);

    void delete(Long id, Long operatorId, boolean admin);

    PageResult<DocTemplate> templatePage(String keyword, String category, int pageNum, int pageSize);

    DocTemplate saveTemplate(DocTemplate template);

    DocTemplate updateTemplate(Long id, DocTemplate template);

    void deleteTemplate(Long id);

    List<Map<String, Object>> templateCategoryStats();

    List<Map<String, Object>> templateUsageStats(int limit);
}
