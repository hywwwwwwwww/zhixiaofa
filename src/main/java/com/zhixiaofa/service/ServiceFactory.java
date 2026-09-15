package com.zhixiaofa.service;

import com.zhixiaofa.service.impl.ContractServiceImpl;
import com.zhixiaofa.service.impl.CourtCaseServiceImpl;
import com.zhixiaofa.service.impl.DocServiceImpl;
import com.zhixiaofa.service.impl.FavoriteServiceImpl;
import com.zhixiaofa.service.impl.KnowledgeServiceImpl;
import com.zhixiaofa.service.impl.LawArticleServiceImpl;
import com.zhixiaofa.service.impl.LogServiceImpl;
import com.zhixiaofa.service.impl.QaServiceImpl;
import com.zhixiaofa.service.impl.StatsServiceImpl;
import com.zhixiaofa.service.impl.UserServiceImpl;

/**
 * Service 简单工厂：Servlet 通过本工厂拿业务对象，保持「Servlet 不 new 具体实现」。
 *
 * <p>这样做的价值：以后要把某个 Service 换成带缓存的实现，只改本类一处，
 * Servlet 代码完全不用动。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public final class ServiceFactory {

    private static final UserService USER_SERVICE = new UserServiceImpl();
    private static final LawArticleService LAW_ARTICLE_SERVICE = new LawArticleServiceImpl();
    private static final QaService QA_SERVICE = new QaServiceImpl();
    private static final CourtCaseService COURT_CASE_SERVICE = new CourtCaseServiceImpl();
    private static final ContractService CONTRACT_SERVICE = new ContractServiceImpl();
    private static final DocService DOC_SERVICE = new DocServiceImpl();
    private static final KnowledgeService KNOWLEDGE_SERVICE = new KnowledgeServiceImpl();
    private static final FavoriteService FAVORITE_SERVICE = new FavoriteServiceImpl();
    private static final LogService LOG_SERVICE = new LogServiceImpl();
    private static final StatsService STATS_SERVICE = new StatsServiceImpl();

    private ServiceFactory() {
    }

    public static UserService user() {
        return USER_SERVICE;
    }

    public static LawArticleService lawArticle() {
        return LAW_ARTICLE_SERVICE;
    }

    public static QaService qa() {
        return QA_SERVICE;
    }

    public static CourtCaseService courtCase() {
        return COURT_CASE_SERVICE;
    }

    public static ContractService contract() {
        return CONTRACT_SERVICE;
    }

    public static DocService doc() {
        return DOC_SERVICE;
    }

    public static KnowledgeService knowledge() {
        return KNOWLEDGE_SERVICE;
    }

    public static FavoriteService favorite() {
        return FAVORITE_SERVICE;
    }

    public static LogService log() {
        return LOG_SERVICE;
    }

    public static StatsService stats() {
        return STATS_SERVICE;
    }
}
