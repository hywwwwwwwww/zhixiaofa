package com.zhixiaofa.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.zhixiaofa.dao.LawArticleDao;
import com.zhixiaofa.dao.impl.LawArticleDaoImpl;
import com.zhixiaofa.model.LawArticle;
import com.zhixiaofa.util.DateUtil;
import com.zhixiaofa.util.JsonUtil;
import com.zhixiaofa.util.StringUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 国家法律法规数据库同步服务。
 *
 * <p>职责：定时 / 手动从国家法律法规数据库（flk.npc.gov.cn）抓取职场劳动相关的法律法规，
 * 解析其「目录树（章 / 节 / 第 X 条）」与「命中正文」，写入 {@code law_article} 表。</p>
 *
 * <p>数据来源接口（均为公开接口，无需登录 / 密钥）：</p>
 * <ul>
 *   <li>{@code POST /law-search/search/list} —— 按关键词搜索法规，返回唯一标识 bbbs；</li>
 *   <li>{@code GET  /law-search/search/flfgDetails?bbbs=…} —— 法规元数据 + 结构化目录树；</li>
 *   <li>{@code POST /law-search/search/hitDisplay} —— 搜索命中的条文正文（含高亮）。</li>
 * </ul>
 *
 * <p>正文策略（三级）：目录树给「全部条号」→ hitDisplay 命中「部分条文正文」→
 * 命中不到的条文保留数据库已有正文（手工精编 / 历史同步），不覆盖成空。</p>
 *
 * @author 职小法小组
 * @version 1.0
 */
public class LawSyncService {

    private static final Logger log = LoggerFactory.getLogger(LawSyncService.class);

    private static final LawSyncService INSTANCE = new LawSyncService();

    /** 官网域名 */
    private static final String BASE = "https://flk.npc.gov.cn";
    private static final String SEARCH_URL = BASE + "/law-search/search/list";
    private static final String DETAIL_URL = BASE + "/law-search/search/flfgDetails";

    /** 同步数据来源标识（写入 law_article.source） */
    public static final String SOURCE = "flk_npc";

    /** 每次请求间隔，避免触发官网限流 */
    private static final long REQUEST_INTERVAL_MS = 800L;

    /**
     * 待同步的职场劳动相关法律清单（紧扣「职场法律助手」定位）。
     */
    private static final String[] SYNC_LAWS = {
            "中华人民共和国劳动合同法",
            "中华人民共和国劳动法",
            "中华人民共和国社会保险法",
            "中华人民共和国劳动争议调解仲裁法",
            "中华人民共和国就业促进法",
            "中华人民共和国工会法",
            "中华人民共和国劳动合同法实施条例",
            "工伤保险条例",
            "失业保险条例",
            "社会保险费征缴暂行条例",
            "工资支付暂行规定",
            "女职工劳动保护特别规定",
            "职工带薪年休假条例",
            "最低工资规定",
            "保障农民工工资支付条例"
    };

    /** 匹配「第X条」的条号 */
    private static final Pattern ARTICLE_NO_PATTERN =
            Pattern.compile("第[一二三四五六七八九十百零]+条");

    private final LawArticleDao lawDao = new LawArticleDaoImpl();

    /* ---------------- 同步状态（线程安全） ---------------- */

    private final AtomicBoolean running = new AtomicBoolean(false);
    private volatile java.time.LocalDateTime lastSyncTime;
    private volatile String lastResult = "尚未同步";
    private volatile int lastArticleCount;

    /** 异步同步的工作线程（单线程，避免并发抓取被官网限流） */
    private final java.util.concurrent.ExecutorService syncExecutor =
            java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "law-sync-worker");
                t.setDaemon(true);
                return t;
            });

    static {
        // 官网证书链在部分环境不完整，宽松校验 SSL，保证抓取可用。
        trustAllHttps();
    }

    private LawSyncService() {
    }

    public static LawSyncService getInstance() {
        return INSTANCE;
    }

    /* ================================================================== 对外接口 */

    /**
     * 执行一次全量同步（幂等：按「法规名称 + 条号」去重 upsert）。
     * 同步阻塞，直接返回结果。供定时任务调用。
     *
     * @return 同步结果摘要
     */
    public Map<String, Object> sync() {
        if (!running.compareAndSet(false, true)) {
            return busyResult();
        }
        try {
            return syncInternal();
        } finally {
            running.set(false);
        }
    }

    /**
     * 异步触发一次同步，立即返回。供管理端「立即同步」按钮调用，
     * 前端随后轮询 {@link #status()} 获取进度与结果。
     *
     * @return 触发结果（是否成功启动）
     */
    public Map<String, Object> triggerAsync() {
        if (!running.compareAndSet(false, true)) {
            return busyResult();
        }
        syncExecutor.submit(() -> {
            try {
                syncInternal();
            } catch (Exception e) {
                log.error("异步同步失败", e);
                lastResult = "同步失败：" + e.getMessage();
            } finally {
                running.set(false);
            }
        });
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("success", true);
        r.put("message", "同步已启动，正在后台执行，请稍候刷新查看结果");
        return r;
    }

    /** 当前同步状态 */
    public Map<String, Object> status() {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("running", running.get());
        s.put("lastSyncTime", lastSyncTime == null ? null : DateUtil.format(lastSyncTime));
        s.put("lastResult", lastResult);
        s.put("lastArticleCount", lastArticleCount);
        return s;
    }

    private Map<String, Object> busyResult() {
        Map<String, Object> busy = new LinkedHashMap<>();
        busy.put("success", false);
        busy.put("message", "同步正在进行中，请稍候");
        return busy;
    }

    /** 同步核心逻辑（不含并发状态管理） */
    private Map<String, Object> syncInternal() {
        long start = System.currentTimeMillis();
        int lawOk = 0;
        int lawSkip = 0;
        int lawFail = 0;
        int articleCount = 0;
        List<String> skippedLaws = new ArrayList<>();
        List<String> failedLaws = new ArrayList<>();
        for (String lawName : SYNC_LAWS) {
            try {
                Stat stat = syncOneLaw(lawName);
                if (stat == null) {
                    // 未检索到 / 官网无目录树 → 跳过（正文以文档导入为准），不计为失败
                    lawSkip++;
                    skippedLaws.add(lawName);
                } else {
                    lawOk++;
                    articleCount += stat.articleCount;
                }
            } catch (Exception e) {
                lawFail++;
                failedLaws.add(lawName);
                log.warn("同步法规失败: {}", lawName, e);
            }
        }
        // 同步可能插入新条文（其 seq 为空），统一重排一次，保证列表顺序始终正确。
        // 「重排序号」按钮已移除，改由系统自动维护。
        if (articleCount > 0) {
            try {
                com.zhixiaofa.service.ServiceFactory.lawArticle().recomputeSeq();
            } catch (Exception e) {
                log.warn("同步后重排法条序号失败（不影响同步结果）", e);
            }
        }
        lastSyncTime = DateUtil.now();
        lastArticleCount = articleCount;
        lastResult = String.format("同步完成：成功 %d 部（%d 条条文）、跳过 %d 部、失败 %d 部",
                lawOk, articleCount, lawSkip, lawFail);

        long cost = System.currentTimeMillis() - start;
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true);
        result.put("lawCount", lawOk + lawSkip + lawFail);
        result.put("lawOk", lawOk);
        result.put("lawSkip", lawSkip);
        result.put("lawFail", lawFail);
        result.put("articleCount", articleCount);
        result.put("skippedLaws", skippedLaws);
        result.put("failedLaws", failedLaws);
        result.put("durationMs", cost);
        result.put("message", lastResult);
        return result;
    }

    /* ================================================================== 单部法规同步 */

    /** 单次同步统计 */
    private static final class Stat {
        int articleCount;
    }

    /**
     * 同步一部法规：搜索拿 bbbs → 详情拿目录树 → 入库（更新结构与元数据）。
     *
     * <p>设计取舍：</p>
     * <ul>
     *   <li>「法律」类的 {@code content} 目录树完整，可解析出全部条号骨架；</li>
     *   <li>「行政法规 / 规章」类的 {@code content} 为空 —— <b>直接跳过</b>，
     *       不再降级用「命中接口」拼条文。测试证明该降级路径会把别的法律条文误当成本法规条文，
     *       产生条号错乱（如把 38 条的条例写出「第八十二条」）与正文残片。</li>
     * </ul>
     *
     * <p>本同步只负责「法规清单 / 条文骨架 / 元数据」；正文与序号的权威来源是
     * <b>官方文档导入</b>，因此 {@link com.zhixiaofa.dao.LawArticleDao#upsert} 的更新分支
     * 不会覆盖 {@code content} 与 {@code seq}。</p>
     *
     * @return 统计；跳过或失败返回 null
     */
    private Stat syncOneLaw(String lawName) throws Exception {
        // 1. 搜索拿 bbbs
        String bbbs = searchBbbs(lawName);
        if (StringUtil.isEmpty(bbbs)) {
            log.warn("未检索到法规: {}", lawName);
            return null;
        }

        // 2. 详情拿元数据 + 目录树
        JsonNode detail = httpGet(DETAIL_URL + "?bbbs=" + java.net.URLEncoder.encode(bbbs, "UTF-8"));
        JsonNode data = detail.path("data");
        if (data.isMissingNode()) {
            log.warn("详情缺失: {}", lawName);
            return null;
        }
        String title = data.path("title").asText(lawName);
        LocalDate effectiveDate = DateUtil.parseDate(data.path("sxrq").asText(""));
        JsonNode tree = data.path("content");

        // 3. 解析目录树得到条文骨架
        List<LawArticle> articles = new ArrayList<>();
        collectArticles(tree, null, null, title, effectiveDate, bbbs, articles);
        if (articles.isEmpty()) {
            log.info("跳过（官网无目录树，正文以文档导入为准）: {}", lawName);
            return null;
        }

        // 4. 入库：只写元数据与条文骨架；content / seq 由文档导入与重排负责，update 分支不覆盖
        sortByArticleNo(articles);
        for (LawArticle a : articles) {
            lawDao.upsert(a);
        }

        Stat stat = new Stat();
        stat.articleCount = articles.size();
        log.info("同步法规成功: {}，共 {} 条", title, articles.size());
        return stat;
    }

    /** 按条号自然顺序排序，保证首次插入时顺序稳定 */
    private void sortByArticleNo(List<LawArticle> articles) {
        articles.sort(Comparator.comparingInt(a -> StringUtil.parseArticleNo(a.getArticleNo())));
    }

    /* ================================================================== 官网接口调用 */

    /** 按法规名搜索，返回唯一标识 bbbs */
    private String searchBbbs(String lawName) throws Exception {
        // 依次尝试多个候选关键词，提高匹配成功率
        List<String> candidates = new ArrayList<>();
        candidates.add(lawName);
        String shortName = lawName.replace("中华人民共和国", "");
        if (!shortName.equals(lawName)) {
            candidates.add(shortName);
        }
        // 「规定 / 条例 / 办法」是高频词，会淹没目标，去掉后缀词更精准
        String stripped = stripSuffix(lawName);
        if (!stripped.equals(lawName)) {
            candidates.add(stripped);
        }
        String shortStripped = stripSuffix(shortName);
        if (!shortStripped.equals(shortName)) {
            candidates.add(shortStripped);
        }

        for (String kw : candidates) {
            String bbbs = searchBbbsByKeyword(lawName, kw);
            if (bbbs != null) {
                return bbbs;
            }
        }
        log.warn("搜索未精确匹配到: {}", lawName);
        return null;
    }

    /** 去掉法规名末尾的「暂行规定 / 规定 / 条例 / 办法 / 细则」等高频后缀 */
    private String stripSuffix(String name) {
        return name.replaceAll("(暂行)?(规定|条例|办法|细则)$", "");
    }

    /** 用指定关键词搜索，返回标题精确等于 target 的 bbbs */
    private String searchBbbsByKeyword(String target, String keyword) throws Exception {
        JsonNode resp = httpPost(SEARCH_URL, searchBody(keyword, null));
        // 注意：search/list 的 rows 在响应顶层（{total, rows:[...]}），并非 result.rows
        JsonNode rows = resp.path("rows");
        if (rows.isArray()) {
            for (JsonNode row : rows) {
                String clean = cleanTitle(row.path("title").asText(""));
                if (target.equals(clean)) {
                    return row.path("bbbs").asText();
                }
            }
        }
        return null;
    }

    /** 清洗标题：去高亮标签、去书名号、去首尾空白 */
    private String cleanTitle(String title) {
        return title.replaceAll("<[^>]+>", "")
                .replace("《", "").replace("》", "")
                .replace("（", "").replace("）", "")
                .trim();
    }

    /** 构造搜索请求体（搜索法规时只需 searchContent） */
    private String searchBody(String keyword, String bbbs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("searchRange", 1);
        body.put("sxrq", new ArrayList<>());
        body.put("gbrq", new ArrayList<>());
        body.put("sxx", new ArrayList<>());
        body.put("searchType", 2);
        body.put("xgzlSearch", false);
        body.put("searchContent", keyword);
        // 加大返回条数，避免目标法规被排在默认的 20 条之外导致匹配不到
        body.put("pageSize", 100);
        if (bbbs != null) {
            body.put("bbbs", bbbs);
        }
        return JsonUtil.toJson(body);
    }

    /* ================================================================== 目录树解析 */

    /**
     * 递归遍历目录树，收集「第X条」条文节点。
     *
     * @param node     当前树节点
     * @param chapter  当前章名
     * @param section  当前节名
     * @param lawName  法规名
     * @param effectiveDate 施行日期
     * @param sourceId 官网 bbbs
     * @param out      收集结果
     */
    private void collectArticles(JsonNode node, String chapter, String section,
                                 String lawName, LocalDate effectiveDate, String sourceId,
                                 List<LawArticle> out) {
        if (node == null || node.isMissingNode()) {
            return;
        }
        String title = node.path("title").asText("");

        if (title.matches("^第.+章$")) {
            chapter = title;
            section = null;
        } else if (title.matches("^第.+节$")) {
            section = title;
        } else if (ARTICLE_NO_PATTERN.matcher(title).matches()) {
            // 条文节点
            LawArticle a = new LawArticle();
            a.setLawName(lawName);
            a.setArticleNo(title);
            a.setTitle(buildChapterTitle(chapter, section));
            a.setCategory(inferCategory(buildChapterTitle(chapter, section) + " " + lawName));
            a.setEffectiveDate(effectiveDate);
            a.setSource(SOURCE);
            a.setSourceId(sourceId);
            a.setContent(null);
            a.setKeywords(null);
            // created_at / updated_at 由 upsert 显式写入，必须非空
            a.setCreatedAt(java.time.LocalDateTime.now());
            a.setUpdatedAt(a.getCreatedAt());
            out.add(a);
        }

        JsonNode children = node.path("children");
        if (children.isArray()) {
            for (JsonNode child : children) {
                collectArticles(child, chapter, section, lawName, effectiveDate, sourceId, out);
            }
        }
    }

    /** 拼章节标题：「第五章 特别规定」+「第一节 集体合同」→「第五章 特别规定 · 第一节 集体合同」 */
    private String buildChapterTitle(String chapter, String section) {
        if (chapter == null && section == null) {
            return null;
        }
        if (section == null) {
            return chapter;
        }
        if (chapter == null) {
            return section;
        }
        return chapter + " · " + section;
    }

    /* ================================================================== 分类推断 */

    /** 按章节名 / 法规名推断职场分类 */
    private String inferCategory(String text) {
        if (text == null) {
            return "其他";
        }
        if (containsAny(text, "劳动合同", "订立", "集体合同", "劳务派遣", "非全日制", "竞业限制")) {
            return "劳动合同";
        }
        if (containsAny(text, "工资", "报酬", "最低工资", "支付")) {
            return "工资报酬";
        }
        if (containsAny(text, "工时", "休息", "休假", "年假", "加班", "工作时间")) {
            return "工时休假";
        }
        if (containsAny(text, "社会保险", "社保", "工伤", "失业", "生育", "养老", "医疗")) {
            return "社会保险";
        }
        if (containsAny(text, "解除", "终止", "经济补偿", "赔偿")) {
            return "解除终止";
        }
        if (containsAny(text, "竞业", "保密")) {
            return "竞业限制";
        }
        return "其他";
    }

    private boolean containsAny(String text, String... keys) {
        for (String k : keys) {
            if (text.contains(k)) {
                return true;
            }
        }
        return false;
    }

    /* ================================================================== HTTP 底层 */

    private JsonNode httpGet(String url) throws Exception {
        return request(url, null, "GET", 0);
    }

    private JsonNode httpPost(String url, String bodyJson) throws Exception {
        return request(url, bodyJson, "POST", 0);
    }

    /**
     * 发起请求并解析 JSON，带限流重试。
     *
     * <p>官网在高频访问时会返回 307 重定向（跳验证页），此时不跟随重定向，
     * 而是等待后重试原请求，最多 6 次，避免「重定向循环 20 次」异常。</p>
     */
    private JsonNode request(String url, String body, String method, int retry) throws Exception {
        HttpURLConnection conn = open(url);
        conn.setRequestMethod(method);
        conn.setInstanceFollowRedirects(false);
        if (body != null) {
            conn.setDoOutput(true);
            conn.setRequestProperty("Content-Type", "application/json;charset=UTF-8");
            try (OutputStream os = conn.getOutputStream()) {
                os.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = conn.getResponseCode();
        if (code >= 300 && code < 400) {
            conn.disconnect();
            if (retry < 6) {
                long wait = 2000L * (retry + 1);
                log.warn("官网返回 {}，疑似限流，{} 秒后重试（第 {} 次）", code, wait / 1000, retry + 1);
                Thread.sleep(wait);
                return request(url, body, method, retry + 1);
            }
            throw new IllegalStateException("官网持续重定向（疑似限流），已放弃: " + code);
        }
        return readJson(conn);
    }

    private HttpURLConnection open(String url) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
        conn.setConnectTimeout(15000);
        conn.setReadTimeout(20000);
        conn.setRequestProperty("User-Agent",
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36");
        conn.setRequestProperty("Accept", "application/json, text/plain, */*");
        conn.setRequestProperty("Referer", BASE + "/");
        conn.setRequestProperty("Origin", BASE);
        return conn;
    }

    private JsonNode readJson(HttpURLConnection conn) throws Exception {
        int code = conn.getResponseCode();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(
                code >= 400 ? conn.getErrorStream() : conn.getInputStream(), StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line);
            }
            // 请求间隔，避免限流
            Thread.sleep(REQUEST_INTERVAL_MS);
            if (code >= 400) {
                log.warn("官网接口返回 {}: {}", code, sb);
                throw new IllegalStateException("官网接口返回 " + code);
            }
            String body = sb.toString();
            if (body.trim().isEmpty()) {
                throw new IllegalStateException("官网接口返回空响应");
            }
            return JsonUtil.mapper().readTree(body);
        }
    }

    /** 信任所有 HTTPS 证书（官网证书链在部分环境不完整） */
    private static void trustAllHttps() {
        try {
            TrustManager[] trustAll = new TrustManager[]{new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            }};
            SSLContext sc = SSLContext.getInstance("TLS");
            sc.init(null, trustAll, new SecureRandom());
            HttpsURLConnection.setDefaultSSLSocketFactory(sc.getSocketFactory());
            HttpsURLConnection.setDefaultHostnameVerifier((hostname, session) -> true);
        } catch (Exception e) {
            log.warn("宽松 SSL 校验设置失败（不影响 HTTP 抓取）", e);
        }
    }
}
