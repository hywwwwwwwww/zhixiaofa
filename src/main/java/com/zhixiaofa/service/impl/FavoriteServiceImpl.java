package com.zhixiaofa.service.impl;

import com.zhixiaofa.common.PageResult;
import com.zhixiaofa.common.ResultCode;
import com.zhixiaofa.dao.DocRecordDao;
import com.zhixiaofa.dao.FavoriteDao;
import com.zhixiaofa.dao.KnowledgeArticleDao;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.QaRecordDao;
import com.zhixiaofa.dao.impl.DocRecordDaoImpl;
import com.zhixiaofa.dao.impl.FavoriteDaoImpl;
import com.zhixiaofa.dao.impl.KnowledgeArticleDaoImpl;
import com.zhixiaofa.dao.impl.LawArticleDaoImpl;
import com.zhixiaofa.dao.impl.QaRecordDaoImpl;
import com.zhixiaofa.exception.BizException;
import com.zhixiaofa.model.DocRecord;
import com.zhixiaofa.model.Favorite;
import com.zhixiaofa.model.KnowledgeArticle;
import com.zhixiaofa.model.LawArticle;
import com.zhixiaofa.model.QaRecord;
import com.zhixiaofa.service.FavoriteService;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

/**
 * 收藏业务实现。
 *
 * <p>{@code favorite} 用 {@code target_type + target_id} 做多态关联，
 * 因此不能加外键；改成在写入前先校验目标对象是否存在，
 * 再依赖唯一索引 {@code uk_fav_user_target} 防止重复收藏。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class FavoriteServiceImpl implements FavoriteService {

    private static final Logger log = LoggerFactory.getLogger(FavoriteServiceImpl.class);

    private final FavoriteDao favoriteDao;
    private final QaRecordDao qaDao;
    private final KnowledgeArticleDao articleDao;
    private final LawArticleDao lawDao;
    private final DocRecordDao docDao;

    /* ---------------- 构造器注入（便于单元测试注入 Mock DAO） ---------------- */

    /** 生产环境使用：装配各 Dao 的 JDBC 实现 */
    public FavoriteServiceImpl() {
        this(new FavoriteDaoImpl(), new QaRecordDaoImpl(), new KnowledgeArticleDaoImpl(), new LawArticleDaoImpl(), new DocRecordDaoImpl());
    }

    /** 测试 / 依赖注入使用：由外部传入 Dao 实现，便于用 Mockito 打桩 */
    public FavoriteServiceImpl(FavoriteDao favoriteDao, QaRecordDao qaDao, KnowledgeArticleDao articleDao, LawArticleDao lawDao, DocRecordDao docDao) {
        this.favoriteDao = favoriteDao;
        this.qaDao = qaDao;
        this.articleDao = articleDao;
        this.lawDao = lawDao;
        this.docDao = docDao;
    }

    @Override
    public boolean add(Long userId, String targetType, Long targetId) {
        String type = normalizeType(targetType);
        checkTargetExists(type, targetId);
        if (favoriteDao.exists(userId, type, targetId)) {
            return true;
        }
        Favorite f = new Favorite();
        f.setUserId(userId);
        f.setTargetType(type);
        f.setTargetId(targetId);
        f.setCreatedAt(com.zhixiaofa.util.DateUtil.now());
        favoriteDao.insert(f);
        log.info("添加收藏: user={}, {}#{}", userId, type, targetId);
        return true;
    }

    @Override
    public boolean remove(Long userId, String targetType, Long targetId) {
        String type = normalizeType(targetType);
        favoriteDao.deleteByTarget(userId, type, targetId);
        return false;
    }

    @Override
    public boolean toggle(Long userId, String targetType, Long targetId) {
        String type = normalizeType(targetType);
        if (favoriteDao.exists(userId, type, targetId)) {
            favoriteDao.deleteByTarget(userId, type, targetId);
            return false;
        }
        return add(userId, type, targetId);
    }

    @Override
    public boolean exists(Long userId, String targetType, Long targetId) {
        return favoriteDao.exists(userId, normalizeType(targetType), targetId);
    }

    @Override
    public PageResult<Favorite> page(Long userId, String targetType, int pageNum, int pageSize) {
        String type = normalizeType(targetType);
        pageNum = Math.max(1, pageNum);
        pageSize = pageSize < 1 ? 10 : Math.min(pageSize, 100);
        long total = favoriteDao.countByUserAndType(userId, type);
        if (total == 0) {
            return PageResult.empty(pageNum, pageSize);
        }
        List<Favorite> list = favoriteDao.findByUserAndType(userId, type, (pageNum - 1) * pageSize, pageSize);
        for (Favorite f : list) {
            fillTarget(f);
        }
        return PageResult.of(list, total, pageNum, pageSize);
    }

    @Override
    public List<Map<String, Object>> typeStats(Long userId) {
        return favoriteDao.countGroupByType(userId);
    }

    // ------------------------------------------------------------------ 私有方法

    /** 归一化类型，非法类型直接拒绝 */
    private String normalizeType(String targetType) {
        String t = StringUtil.trim(targetType);
        if (t == null) {
            throw new BizException(ResultCode.PARAM_ERROR, "收藏类型不能为空");
        }
        t = t.toUpperCase();
        if (!"QA".equals(t) && !"ARTICLE".equals(t) && !"LAW".equals(t) && !"DOC".equals(t)) {
            throw new BizException(ResultCode.PARAM_ERROR, "收藏类型只能是 QA / ARTICLE / LAW / DOC");
        }
        return t;
    }

    /** 校验被收藏对象确实存在，避免脏关联 */
    private void checkTargetExists(String type, Long targetId) {
        boolean exists;
        switch (type) {
            case "QA":
                exists = qaDao.findById(targetId) != null;
                break;
            case "ARTICLE":
                exists = articleDao.findById(targetId) != null;
                break;
            case "LAW":
                exists = lawDao.findById(targetId) != null;
                break;
            case "DOC":
                exists = docDao.findById(targetId) != null;
                break;
            default:
                exists = false;
        }
        if (!exists) {
            throw new BizException(ResultCode.DATA_NOT_FOUND, "收藏的对象不存在");
        }
    }

    /** 回填标题与摘要，前端列表直接可用 */
    private void fillTarget(Favorite f) {
        switch (f.getTargetType()) {
            case "QA": {
                QaRecord qa = qaDao.findById(f.getTargetId());
                if (qa != null) {
                    f.setTargetTitle(StringUtil.abbreviate(qa.getQuestion(), 40));
                    f.setTargetSummary(StringUtil.abbreviate(qa.getAnswer(), 80));
                }
                break;
            }
            case "ARTICLE": {
                KnowledgeArticle a = articleDao.findById(f.getTargetId());
                if (a != null) {
                    f.setTargetTitle(a.getTitle());
                    f.setTargetSummary(a.getSummary());
                }
                break;
            }
            case "LAW": {
                LawArticle l = lawDao.findById(f.getTargetId());
                if (l != null) {
                    f.setTargetTitle("《" + l.getLawName().replaceAll("[《》]", "") + "》" + l.getArticleNo());
                    f.setTargetSummary(StringUtil.abbreviate(l.getContent(), 80));
                }
                break;
            }
            case "DOC": {
                DocRecord d = docDao.findById(f.getTargetId());
                if (d != null) {
                    f.setTargetTitle(d.getTitle());
                    f.setTargetSummary(StringUtil.abbreviate(d.getContent(), 80));
                }
                break;
            }
            default:
                break;
        }
    }
}
