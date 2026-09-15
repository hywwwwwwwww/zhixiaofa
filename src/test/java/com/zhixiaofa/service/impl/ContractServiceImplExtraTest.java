package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.ContractRiskDao;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.Contract;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * 合同业务补充测试：覆盖分页、详情权限、删除与统计。
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ContractService 补充测试")
class ContractServiceImplExtraTest {

    @Mock private ContractDao contractDao;
    @Mock private ContractRiskDao riskDao;

    private ContractServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ContractServiceImpl(contractDao, riskDao);
    }

    private Contract contract(long id, long userId) {
        Contract c = new Contract();
        c.setId(id);
        c.setUserId(userId);
        c.setFileName("劳动合同.pdf");
        c.setRiskLevel("高");
        c.setRiskCount(3);
        c.setStatus(1);
        c.setCreatedAt(LocalDateTime.now());
        return c;
    }

    @Test
    @DisplayName("我的合同：空数据与有数据")
    void myPageBranches() {
        when(contractDao.countByUserId(1L)).thenReturn(0L);
        assertEquals(0, service.myPage(1L, 1, 10).getTotal());

        when(contractDao.countByUserId(1L)).thenReturn(1L);
        when(contractDao.findByUserId(1L, 0, 10)).thenReturn(List.of(contract(1L, 1L)));
        assertEquals(1, service.myPage(1L, 1, 10).getTotal());
    }

    @Test
    @DisplayName("后台分页：空数据与有数据")
    void pageBranches() {
        when(contractDao.countByCondition(any(), any(), any())).thenReturn(0L);
        assertEquals(0, service.page(null, null, null, 1, 10).getTotal());

        when(contractDao.countByCondition(any(), any(), any())).thenReturn(4L);
        when(contractDao.findByCondition(any(), any(), any(), anyInt(), anyInt()))
                .thenReturn(List.of(contract(1L, 1L)));
        assertEquals(4, service.page(null, null, null, 1, 10).getTotal());
    }

    @Test
    @DisplayName("详情：不存在报错；非本人且非管理员被拒绝；管理员可看")
    void detailPermissions() {
        when(contractDao.findById(9L)).thenReturn(null);
        assertThrows(BizException.class, () -> service.detail(9L, 1L, false));

        when(contractDao.findById(1L)).thenReturn(contract(1L, 100L));
        BizException e = assertThrows(BizException.class, () -> service.detail(1L, 200L, false));
        assertEquals(11302, e.getCode());

        when(riskDao.findByContractId(1L)).thenReturn(List.of());
        assertNotNull(service.detail(1L, 1L, true));
    }

    @Test
    @DisplayName("删除：非本人被拒绝；管理员可删并级联清理风险点")
    void deleteBehavior() {
        when(contractDao.findById(1L)).thenReturn(contract(1L, 100L));
        assertThrows(BizException.class, () -> service.delete(1L, 200L, false));

        service.delete(1L, 1L, true);
        verify(contractDao).deleteById(1L);
    }

    @Test
    @DisplayName("风险点查询与统计透传")
    void riskAndStats() {
        when(riskDao.findByContractId(1L)).thenReturn(List.of());
        when(riskDao.countGroupByLevel()).thenReturn(List.of());
        when(contractDao.countGroupByType()).thenReturn(List.of());
        when(contractDao.countByDay(14)).thenReturn(List.of());
        assertNotNull(service.risks(1L));
        assertNotNull(service.riskLevelStats());
        assertNotNull(service.typeStats());
        assertNotNull(service.dailyStats(14));
    }
}
