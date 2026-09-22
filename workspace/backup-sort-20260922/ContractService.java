package com.zhixiaofa.service;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.model.Contract;
import com.zhixiaofa.model.ContractRisk;

import java.util.List;
import java.util.Map;

/**
 * 合同智能审查业务接口。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface ContractService {

    /**
     * 提交合同并逐条扫描风险条款（同一事务写入合同与风险点明细）。
     *
     * @param userId       上传人
     * @param fileName     文件名
     * @param contractType 合同类型
     * @param partyA       甲方
     * @param partyB       乙方
     * @param signDate     签订日期（yyyy-MM-dd）
     * @param content      合同正文
     * @return 含风险点明细的合同
     */
    Contract review(Long userId, String fileName, String contractType,
                    String partyA, String partyB, String signDate, String content);

    PageResult<Contract> myPage(Long userId, int pageNum, int pageSize);

    PageResult<Contract> page(String keyword, String riskLevel, Integer status, int pageNum, int pageSize);

    /** 合同详情（含风险点明细，按高→中→低排序） */
    Contract detail(Long id, Long operatorId, boolean admin);

    void delete(Long id, Long operatorId, boolean admin);

    List<Map<String, Object>> riskLevelStats();

    List<Map<String, Object>> typeStats();

    List<Map<String, Object>> dailyStats(int days);

    List<ContractRisk> risks(Long contractId);
}
