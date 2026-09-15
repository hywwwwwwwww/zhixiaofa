package com.zhixiaofa.service;

import java.util.List;
import java.util.Map;

/**
 * 后台数据看板业务接口：把各模块的统计聚合成前端 ECharts 直接可用的结构。
 *
 * @author 职小法小组
 * @version 1.0
 */
public interface StatsService {

    /** 顶部指标卡：用户数、问答数、合同数、文书数、文章数、收藏数 */
    Map<String, Object> overview();

    /** 近 N 天各业务量趋势，用于折线图（多序列） */
    Map<String, Object> trend(int days);

    /** 综合分布：问题分类、合同风险、案件类型、文章分类 */
    Map<String, Object> distributions();

    /** 排行榜集合：热门问题、高频风险条款、模板使用、阅读 TopN、接口调用 */
    Map<String, Object> rankings();

    /** 接口性能：平均耗时 TopN */
    List<Map<String, Object>> slowApis(int limit);

    /** 连接池运行指标，用于演示自己写的连接池 */
    Map<String, Object> poolInfo();
}
