package com.zhixiaofa.service.impl;

import com.zhixiaofa.dao.ContractDao;
import com.zhixiaofa.dao.ContractRiskDao;
import com.zhixiaofa.dao.CourtCaseDao;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.DocTemplateDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.OperationLogDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.QaReferenceDao;
import com.zhixiaofa.dao.QuizQuestionDao;
import com.zhixiaofa.dao.SysUserDao;
import com.zhixiaofa.dao.impl.ContractDaoImpl;
import com.zhixiaofa.dao.impl.ContractRiskDaoImpl;
import com.zhixiaofa.dao.impl.CourtCaseDaoImpl;
import com.zhixiaofa.dao.impl.DocRecordDaoImpl;
import com.zhixiaofa.dao.impl.DocTemplateDaoImpl;
import com.zhixiaofa.dao.impl.FavoriteDaoImpl;
import com.zhixiaofa.dao.impl.KnowledgeArticleDaoImpl;
import com.zhixiaofa.dao.impl.LawArticleDaoImpl;
import com.zhixiaofa.dao.impl.OperationLogDaoImpl;
import com.zhixiaofa.dao.impl.QaRecordDaoImpl;
import com.zhixiaofa.dao.impl.QaReferenceDaoImpl;
import com.zhixiaofa.dao.impl.QuizQuestionDaoImpl;
import com.zhixiaofa.dao.impl.SysUserDaoImpl;
import com.zhixiaofa.service.StatsService;
import com.zhixiaofa.util.DBUtil;

/**
 * 后台看板业务实现：只做聚合与组装，数据全部来自各 DAO 的统计 SQL。
 *
 * @author 职小法小组
 * @version 1.0
 */
public class StatsServiceImpl implements StatsService {

    private final SysUserDao userDao = new SysUserDaoImpl();
    private final QaRecordDao qaDao = new QaRecordDaoImpl();
    private final QaReferenceDao refDao = new QaReferenceDaoImpl();
    private final ContractDao contractDao = new ContractDaoImpl();
    private final ContractRiskDao riskDao = new ContractRiskDaoImpl();
    private final CourtCaseDao caseDao = new CourtCaseDaoImpl();
    private final DocRecordDao docDao = new DocRecordDaoImpl();
    private final DocTemplateDao templateDao = new DocTemplateDaoImpl();
    private final KnowledgeArticleDao articleDao = new KnowledgeArticleDaoImpl();
    private final QuizQuestionDao quizDao = new QuizQuestionDaoImpl();
    private final FavoriteDao favoriteDao = new FavoriteDaoImpl();
    private final LawArticleDao lawDao = new LawArticleDaoImpl();
    private final OperationLogDao logDao = new OperationLogDaoImpl();

    @Override
    public java.util.Map<String, Object> overview() {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("userCount", userDao.countAll());
        map.put("qaCount", qaDao.countAll());
        map.put("contractCount", contractDao.countAll());
        map.put("courtCaseCount", caseDao.countAll());
        map.put("docCount", docDao.countAll());
        map.put("templateCount", templateDao.countAll());
        map.put("articleCount", articleDao.countAll());
        map.put("quizCount", quizDao.countAll());
        map.put("lawCount", lawDao.countAll());
        map.put("riskCount", riskDao.countAll());
        map.put("logCount", logDao.countAll());
        map.put("roleStats", userDao.countGroupByRole());
        return map;
    }

    @Override
    public java.util.Map<String, Object> trend(int days) {
        if (days < 1 || days > 90) {
            days = 14;
        }
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        java.util.List<java.util.Map<String, Object>> dates = new java.util.ArrayList<>();
        java.util.List<java.util.Map<String, Object>> labels = userDao.countByDay(days);
        for (java.util.Map<String, Object> row : labels) {
            dates.add(row);
        }
        java.util.Map<String, Object> series = new java.util.LinkedHashMap<>();
        series.put("labels", dates);
        series.put("users", userDao.countByDay(days));
        series.put("qa", qaDao.countByDay(days));
        series.put("contracts", contractDao.countByDay(days));
        series.put("docs", docDao.countByDay(days));
        series.put("cases", caseDao.countByDay(days));
        series.put("requests", logDao.countByDay(days));
        map.put("series", series);
        map.put("days", days);
        return map;
    }

    @Override
    public java.util.Map<String, Object> distributions() {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("qaCategory", qaDao.countGroupByCategory());
        map.put("contractRisk", contractDao.countGroupByRiskLevel());
        map.put("contractType", contractDao.countGroupByType());
        map.put("caseType", caseDao.countGroupByType());
        map.put("caseProbability", caseDao.avgProbabilityByType());
        map.put("articleCategory", articleDao.countGroupByCategory());
        map.put("lawCategory", lawDao.countGroupByCategory());
        map.put("quizCategory", quizDao.countGroupByCategory());
        map.put("userCity", userDao.countGroupByCity());
        return map;
    }

    @Override
    public java.util.Map<String, Object> rankings() {
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("hotQuestions", qaDao.topQuestions(8));
        map.put("topLaws", refDao.topLaws(8));
        map.put("riskClauses", riskDao.topRiskClauses(8));
        map.put("templateUsage", docDao.topTemplates(8));
        map.put("articleViews", articleDao.topByViews(8));
        map.put("apiUsage", logDao.countGroupByUri(8));
        map.put("riskLevels", riskDao.countGroupByLevel());
        return map;
    }

    @Override
    public java.util.List<java.util.Map<String, Object>> slowApis(int limit) {
        return logDao.avgCostByUri(limit);
    }

    @Override
    public java.util.Map<String, Object> poolInfo() {
        com.zhixiaofa.util.SimpleConnectionPool pool = DBUtil.getPool();
        java.util.Map<String, Object> map = new java.util.LinkedHashMap<>();
        map.put("minIdle", pool.getMinIdle());
        map.put("maxTotal", pool.getMaxTotal());
        map.put("created", pool.getCreatedCount());
        map.put("idle", pool.getIdleCount());
        map.put("borrowed", pool.getBorrowedCount());
        map.put("jdbcUrl", DBUtil.getConfig("jdbc.url", ""));
        map.put("pageDefaultSize", DBUtil.getInt("page.defaultSize", 10));
        map.put("pageMaxSize", DBUtil.getInt("page.maxSize", 100));
        return map;
    }
}
