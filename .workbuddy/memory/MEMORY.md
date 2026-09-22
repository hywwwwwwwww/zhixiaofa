# 智能法律助手（zhixiaofa）项目长期约定

> 本文件只保留**可复用的规律**。一次性排查过程见同日 `YYYY-MM-DD.md` 日志。

## 一、硬约束
- Java Servlet + jQuery + Bootstrap 5 + MySQL；**无前端构建**，资源直放 `src/main/webapp/`
- **必须 ES5**：`var`+`function`；禁箭头函数/let/const/模板串/可选链/Array.includes
- BEM：`.zf-块__元素--修饰符`；令牌在 `app.css :root`（primary #4285f4 系、ink 三档、border #ebebeb、radius 8/12、`--zf-shadow-md`、`--zf-font-{sans,serif,mono}`）
- 公共库 `window.ZF`：get/post/put/del、toast/escape/confirm、validate/clearValidate、
  btnLoading、renderPager/Loading/Empty、tabs/tabCount、bindAnchorLinks、copyText、truncate、enhanceSelect
- **改 css/js 后必升全站 `?v=`**：19 个 html / 46 处，用 `workspace/bump-version.py <旧> <新>`
  （含幂等与残留校验）。当前 **20260922n**。

## 二、运行与后端
- **启动**：`mvn tomcat7:run`（内嵌 Tomcat 7.0.47），端口 8080 / contextPath `/zhixiaofa`，
  工作目录 `target/tomcat/`，JDK 17。
- **静态资源改动立即生效**（docBase 就是 `src/main/webapp`）；**Java / web.xml 改动必须重启**。
- **`mvn -o` 离线**：可跑 `compile`/`test-compile`，**`test` 跑不了**（surefire 不在本地仓库）。
  正确性靠 `compile` + 临时实例打真实接口。
- **不要 `mvn clean`** —— 会删 `target/tomcat`，那是用户正在跑的服务的 CATALINA_BASE。
- **不要 kill 用户的服务**：本环境子进程随工具调用回收，杀掉后无法保持新实例存活。
- **另起实例做端到端验证**（验证 Java 改动的标准手法）：生成只改端口的临时 POM →
  `mvn -f <临时POM> tomcat7:run` → 轮询就绪 → 验证 → `finally` 里 `taskkill /F /T /PID` + 删临时 POM。
  **临时 POM 必须放项目根目录**（放别处 `${basedir}` 漂移，找不到 webapp）。
  注意 `pom.xml` 的 `<configuration>` **优先于 `-D` 用户属性**，`-Dmaven.tomcat.port` 无效。
- **鉴权两段式**：`AuthFilter` 只管「是否登录」；管理员校验在各 Servlet 的 `requireAdmin()`。
  未登录统一业务码 **11301**，但 HTTP 状态码分两种：
  - 命中匿名白名单 `PUBLIC_GET = /api/law-articles,/api/knowledge,/api/doc-templates,/api/quiz,/api/qa`
    的匿名 GET → 过滤器放行 → **HTTP 200 + 11301**
  - 白名单外 → 过滤器 `writeUnauthorized` → **HTTP 401 + 11301**
  → 写断言/桩时**两条路径都要覆盖**。
  （注：`common.js` 的 `error` 分支里 `else if (xhr.status === 401)` 因 `responseJSON.message`
  先命中而**是死代码** —— 带 JSON message 的 401 只弹 toast 不跳转；HTTP 200+11301 反而会跳 login。）
- **账号**：`admin`/`admin123`（管理员）；`zhangsan`/`lisi`/`wangwu`… / `123456`（普通用户）。
  来源 `docs/部署说明文档.md`、`sql/data.sql`。
- **静态资源缓存控制**：`web.xml` 里 `ExpiresFilter` → html/css/js `access plus 0 seconds`。
  这是「改了却看到旧界面」的根治手段；缺失时响应头无 `Cache-Control`/`Expires`。
- **法条同步**：`LawSyncService`（抓 flk.npc.gov.cn）+ `LawSyncScheduleListener`（`@WebListener`，
  **每日 03:00**）；接口 `/law-articles/{law-names,sync(POST),sync/status,recompute-seq(POST)}`；
  `law_article` 有 `seq/source/source_id`，`law_name+article_no` 唯一索引。
  详见 `sql/migration-20260921-law-sync.sql`。实测全量同步约 50 秒。
- **两项目关系**：`D:\Users\Download\zhixiaofa-master\zhixiaofa-master`（**注意是双层同名目录**，
  外层只是 wrapper）与本项目是**各领先一半的分叉** —— 我方用户端 UI 更新，源项目部分后端更新。
  **禁止整体覆盖**，只按功能域外科式移植。

## 三、★高价值踩坑（按主题归并）

### 3.1 移植（源项目 → 本项目）
- **移植前跑「纯超集」预检**：逐文件比对公开成员集合，确认我方无独有成员（否则会丢功能）。
- **★`shutil.copy2` 保留 mtime → Maven「假编译」**。源文件 mtime 比目标 `.class` 还旧时，
  maven-compiler-plugin 判定「源码没变」**静默跳过编译，输出却仍是 `BUILD SUCCESS`**。
  ⇒ ① copy2 后**必须** `os.utime(fp, (now, now))` 再编译；
    ② **不能只看 BUILD SUCCESS**，要核验 `.class` 字节里能否搜到关键字符串
    （`b'orderBy' in open(cls,'rb').read()`），或看 `mvn` 输出有 `Compiling N source files`
    / `Nothing to compile - all classes are up to date`。**已列为移植后必做。**
- **★行为差异比编译错误隐蔽**。编译过、源项目单测过，但用户会立刻感到「功能变少」。
  实例：源项目 `listCategories()` 只返回库中有数据的分类 → 下拉从 7 项掉到 6 项。
  ⇒ 移植后**逐方法对比语义**，重点看「过滤/隐藏/排序/分页」；
  凡是要「隐藏空数据」的，**优先保留本项目的全量行为**（演示时看到完整维度更重要）。
- **换 DAO 接口签名会连带打断调用方**，`mvn compile` 是最快的发现手段；
  先看源项目同一文件的 diff，能外科式改 2 行就别整文件替换（会牵出无关签名差异）。
- **两项目比对前必须剥离三层噪声**：`原始字节 → 行尾归一 → 去 ?v= → 压空白 → 才是真差异`。
  实测 164 文件里「看起来 150 个不同」，剥完只剩 67 个真差异。

### 3.2 CSS（本项目最高频故障源）
- **★★追加 CSS 时「决定布局方向的属性」必须写全**。同特异性下后声明者胜，但
  **未覆盖的属性会从更早的规则继承下来**。本项目踩过三次同一坑：
  - `.zf-card` 是 `display:flex; flex-direction:column` → 挂它的 `.zf-stat` 也竖排
  - `.zf-actions` 是 `column` → 后追加规则只写 `gap`/`flex-wrap`，按钮仍竖排
  - `.zf-quick` 是 `flex-wrap:wrap; justify-content:center; margin-top:18px` →
    追加规则只改 `flex-direction:row`，单项仍被撑到 93px（应 61px）
  ⇒ **补既有 class 前先 grep 全文件出现次数**，把 `display`/`flex-direction`/`flex-wrap`/
  `justify-content`/`position`/`margin` **显式写全**，或改用页面作用域类。
  另注意 **Bootstrap 的 `p{margin-bottom:1rem}`** 会让卡内每个 `<p>` 白多 16px，要显式归零。
- **★★追加 CSS 时换行常量写错会污染第一条规则的选择器**。
  用 Python 拼 CSS 时若把换行写成**字面反斜杠+n**（而非真换行），CSS 把它解析为转义字符 `n`，
  粘到紧随其后的选择器上 → `n body.zf-admin-page #metric-grid` → **整条规则静默失效**
  （后续规则因前一条 `}` 后是真换行而不受影响）。
  ⇒ 写完后**必须校验**：`raw.count(b'\\n') == 0`（字面反斜杠+n 应为 0）+ 花括号平衡。
  **花括号平衡不能发现这个问题**（数量是平衡的，只是位置错了）。
- **`document.styleSheets[i].cssRules` 是定位 CSS 问题的最佳工具**（走 **http://** 时可读；
  `file://` 下抛 `SecurityError`）。递归 `cssRules` 把 `@media` 的 `conditionText` 一起带出来，
  能一次回答「规则在不在、在哪个媒体条件里、选择器实际文本是什么」。
- **末尾追加的「基态」规则会架空上方的 `@media`**：同特异性时后声明者胜。
  基态必须写在媒体查询之前，末尾只留 `:hover` 这类不参与 display 竞争的属性。
- **`.zf-card`/`.zf-stat`/`.zf-doc`/`.zf-grid`/`.zf-chart`/`.zf-quick` 都是共享类**
  （用户端 home/profile/court/contract-review/knowledge 也在用）。改前先 grep 使用方，
  要差异化就**挂 `body.zf-admin-page` 作用域**或新增修饰类。
  ⚠️ `.zf-quick` 管理端是卡片、用户端是 `.zf-quick__item` 胶囊容器 →
  选择器要写 `.zf-card.zf-quick` 才只命中管理端。
- **判断「某条规则有没有生效」不能用读 CSS，只能用计算样式**：
  ① 浏览器里读 `getComputedStyle`；② 走 CSSOM 查规则实际文本与所在 `@media`。
- **`.zf-stat > div` 会连 `.zf-stat__icon`（也是 div）一起命中**，需写 `> div:not(.zf-stat__icon)`。
  这类 bug 读 CSS 看不出来，**必须读 computed `gridArea`**；定位手法：用内联样式（最高特异性）
  验证「布局逻辑本身对不对」。
- **网格一定显式写 `justify-content` + `align-items`**：grid 容器不写 `justify-content` 时会
  继承 `.zf-stat` 上的 `align-items:center`，把整个格栅内容居中（实测图标左缘被推偏 67px）。
- 网格列数**能算就别用 auto-fill**（1083px 下 auto-fill 变 3 列挤换行）。
- **指标卡末行留白的解法**：改用 `display:flex; flex-wrap:wrap; justify-content:center` +
  `> .zf-stat { flex: 0 1 calc(25% - 10.5px) }`（gap 14 时 4 列的修正量 = 3×14/4）。
- `:hover` (0,2,0) 会盖过单类 `--current` (0,1,0)，要补 `--current:hover`。
- **强调色只表示「当前位置」，整列表最多一条**；hover 用中性灰 `rgba(14,17,21,.08)`
  （实测 .043 在浅底上不可见，.08 才可见，必须截图实测）。
- `scrollbar-width` 会屏蔽 `::-webkit-scrollbar`；滚动条样式必须限作用域。
- 取消绝对定位必须 `position:static` + 四方位 `auto` 全写。
- `textarea` 高度 = max(rows, min-height)，`rows` 压过 `min-height`；突破必须显式 `height`。
- `calc(100vh - Npx)` 的 N 要把容器 padding 全算进去；改 `:root` 级 padding 前先 grep `100vh`。
- 按视口高度分档时**上限要 ≥ 目标设备 innerHeight**（1366×768 的 innerHeight=768，
  `max-height:760` 永不命中）；补档只收「纯装饰间距」，不动控件尺寸与字号。
- **`::after` 热区用 `height:100%` 无效**（行内元素伪元素只长到自身高度）：
  必须 `top:50%;left:50%;bottom:50%;right:50%` + `margin:-22px` 反推，`min-height` 才兜得住。
- `tabular-nums` 对微软雅黑无效（雅黑数字本身全等宽）；真正会抖的是 `Times New Roman` 与 `Arial`。
- **★`.zf-badge` 必须显式 `white-space: nowrap`**，否则在窄列里「普通用户」会被压成**竖排 4 行**
  （表格里最刺眼的观感问题）。同理 `.zf-table td { vertical-align: middle }` ——
  默认是 `top`，两行内容会从顶部往下排，视觉上"偏上"。
- **★操作列的文字按钮是「表格列宽被挤爆」的根因**。users 页每行 5 个带文字按钮 ≈ 300px，
  把昵称/角色/状态列压到折行。改成 **28×28 图标按钮 + `title` + `aria-label`**（`.zf-btn--icon`）
  后，昵称列从 72px 恢复到 104px，**行高 91 → 60px**。
- **危险操作不要用实心红**（`.zf-btn--danger` 是红底白字）。实心红只留给「二次确认」里那**一个**按钮；
  表格删除、工具栏清理改用**描边式**（`.zf-btn--danger-outline`）：白底 + 红字 + 浅红边。

### 3.2b 管理端视觉体系（2026-09-22 立）
- **三层卡片**：辅助卡 `.zf-card--plain`（透明/浅底）< 数据卡（白底 + 极浅投影）< 主角卡
  `.zf-card--hero`（`--zf-shadow-md` + 顶部 3px 主色条）。**全页只允许一张主角卡**。
- **★★给「所有卡片」加样式时必须显式排除已有修饰类**。实测事故：
  `body.zf-admin-page .zf-content .zf-card { box-shadow: … }` 特异性 **(0,3,2)**
  压过了 `body.zf-admin-page .zf-card--hero` 的 **(0,2,2)** ⇒ **主角卡的重阴影被抹平成
  和普通卡一模一样的 `0px 1px 3px`**，三层视觉层级全丢。
  修法：`… .zf-card:not(.zf-card--hero):not(.zf-card--plain)`。
  ⇒ 凡写 `.zf-card { … }` / `.zf-btn { … }` 这种广撒网选择器，先 grep 有哪些修饰类，
    把特殊的那几个用 `:not()` 排掉，否则"更具体的修饰类"反而会被压掉。
- **★"两个颜色能不能分辨"要算 RGB 分量差，不能只看都是浅色**。实测青底 `#d9f2f6` 与
  主蓝底 `#dbeafe` 只差 **G+8 / B-8**，屏上几乎分不出来 → 属于**无效区分**
  （本项目为此已经踩了两次：先 `--info` 的 `#e8f1fe`，后 `--knowledge` 的青）。
  色相差异要足够才换色：紫 `#ede4fd` 与蓝 `#dbeafe`（R+18/G-6）才真能分片。
- **★"卡片看起来空不空"可以量化**：`填充率 = (文字右缘 − 图标左缘) / 卡内宽`。
  实测指标卡 271px 宽、填充率只有 **39%**（右侧空 140px）—— 这就是"寡淡"的真正原因，
  不是颜色问题。改成一行为 6 张（178px）后填充率 **57%**，观感立刻紧凑。
  ⇒ 别凭感觉说"丑"，先量填充率。
- **画布层次**：外壳（侧栏 + 顶栏）纯白 → 内容区浅灰 `#f6f7f9` → 卡片浮于其上。
  原来内容区与卡片同为白底，边界只靠 1px 边框，整页发"平"。
  侧栏原为浅蓝 `#f0f6ff`，与浅灰画布是两种色相，同屏显脏，改纯白 + 右侧分隔线。
- **列表页统一骨架**：`filter-bar → toolbar（计数 + 主操作）→ table`。
  ⚠️ 原先是混着的（knowledge/doc-templates/logs 的 toolbar 在 filter-bar **之前**）。
  改前先 grep 各页顺序，别只看一页。
- **删掉「卡内标题与顶栏重复」**：8 个主数据卡的 `zf-card__head` 与顶栏**逐字相同**。
  但带「新增」按钮的页（knowledge/doc-templates/quiz）**不能整块删** —— 把按钮移到 toolbar。
- **筛选条每一项都要有 label**（否则输入框与 select 顶部不齐）；
  输入框宽度要把 placeholder 装下（实测 160px 装不下「用户名 / 昵称 / 邮箱 / 手机」，会被裁）。
- **指标卡网格**：`flex: 1 1 168px` + `gap: 12px` → 每行 6 张、
  **末行由 flex-grow 拉伸填满**（不再"居中漂浮"破格）。图标 36 / 数值 21 / padding 15-16。
- **ECharts 配色统一**：配置里不能写 CSS 变量，用**等值 hex 字面量**并写注释标明对应令牌。
  折线多序列 `[#4285f4,#00bcd4,#34a853,#9334e6,#fbbc05,#94a3b8]`、
  饼图定性 `[#4285f4,#5b9bff,#00bcd4,#34a853,#9334e6,#607d8b,#fbbc05,#ff7043]`、
  「慢/风险」语义用 `#ef4444`。**慢接口柱图走红、排行柱图走主色**。

### 3.2c 交互动效体系（2026-09-22 参考 Art Design Pro 移植）
参考对象：`app.artd.pro`（开源版 = **`Daymychen/art-design-pro`**，Vue3 + Element Plus）。
**拿参考的正确姿势**：该站只给登录页（SPA + 滑块验证码），但它是开源的 →
**直接读 GitHub 源码**比看截图猜准得多。
⚠️ `raw.githubusercontent.com` 在本环境 **SSL 握手超时**，要用
**GitHub contents API + `Accept: application/vnd.github.raw`**（`api.github.com` 可通）。

**提取到的要点**：异构栅格（每行 24 格里用 14/10、10/7/7 这类**不等分**建立主次）；
卡片内嵌子卡片；双层阴影；`ArtCountTo` 数字滚动（`easeOutExpo`）；
`router-transition`（0.25s / 位移 15px / `cubic-bezier(.25,.1,.25,1)`，**离场比入场快**）；
主题切换用 View Transitions 的 `clip-path: circle()`；徽章 `@keyframes breathe`；NProgress 顶部进度条。

**本项目落地**（ES5 + jQuery 等价实现）：
- **`ZF.countTo(el, target, opts)`**（`js/common.js`）—— 数字滚动。
  `requestAnimationFrame` 逐帧改文本 + `easeOutExpo`（`1 - Math.pow(2, -10*p)`）+ 千分位；
  **同一元素重复调用先取消上一次**（否则快速刷新数字乱跳）；`prefers-reduced-motion` 时直接落终值。
  实测补间（目标 5000 / 1000ms）：`280ms=4,298 → 560ms=4,902 → 末态=5,000`（前快后慢 ✓ 非线性的证据）。
- **`ZF.adminProgress.start()/done()`**（`admin/admin-common.js`）—— 顶部进度条。
  接在侧栏导航点击上。**只做真实的等待反馈，不伪造「进入时扫一遍」**。
- **入场过渡**（`app.css`）：`.zf-content` 的 `zfPageIn` + 指标卡 `zfStatIn` 逐张 stagger（40ms→400ms）。
  **只给指标卡加** —— 全页 30+ 张卡都动会显得吵。
- **图表动画**：所有 `setOption` 统一 `animationDuration: 900` / `animationEasing: 'cubicOut'` /
  `animationDelay: function(idx){return idx*30;}`。
- **双层阴影**（Art 的 shadow-mode）：`0 1px 3px 0 rgba(14,17,21,.03), 0 1px 2px -1px rgba(14,17,21,.08)`
  —— 单层阴影总有"贴纸感"，双层更立体。
- **异构栅格**：`.zf-grid--ratio-14-10` / `.zf-grid--ratio-10-14`（比例写进类名）。
  ⚠️ **不等分必须有依据**——本项目只用了两处：
  文章 Top10（标题远长于法条号）取 14:10；慢接口 Top（y 轴标签是完整 URI）取 10:14。
  同类等权重的卡片（如三张环形图）**仍应等分**，硬凑不等分反而破坏秩序。

- **★★`animation-fill-mode: both` 会把最终帧的 `transform` 留下来**。实测 `.zf-content`
  加了 `both` 后，动画结束的 computed transform 是 **`matrix(1,0,0,1,0,0)`（单位矩阵）而不是 `none`**——
  单位矩阵**一样会让该元素成为后代 `position:fixed` 的包含块**（隐患，不一定当场发作）。
  ⇒ **delay 为 0 的入场动画不要加 fill-mode**（播完自动回到元素自身样式）；
  **有 `animation-delay` 的必须留 `both`**（backwards fill 负责让 delay 期间保持透明，
  否则会先显示再跳成透明、闪一下）——此时代价是保留单位矩阵，**需确认该元素内部不会有 fixed 后代**。

### 3.2d ECharts 数据可视化（2026-09-22 修的两个真实缺陷）
- **★同一坐标系混放相差数量级的指标 = 图表等于没有**。实测「请求量」1~1352（千级），
  而用户/问答/合同/文书/案件都是 1~3（个位数）—— 同一 Y 轴下 4~5 条业务线**全部压在 y=0**，
  完全看不出变化。⇒ 必须拆**双 Y 轴**：业务量走左轴（`minInterval: 1` 保证刻度取整），
  技术指标走右轴（不画 `splitLine`，否则与左轴的分隔线交错成一堆横线）。
  右轴序列用**虚线 + 中性灰**，并在图例名里标注「（右轴）」。
- **★多个序列的日期点不一致时必须取并集对齐**。实测接口里 `labels/users/...` 只有 2 天、
  `requests` 有 7 天；原实现各按自身数组顺序取值 ⇒ ① x 轴只有最短序列那么长（折线无意义）
  ② 同一天的数互相错位。正确做法：收集所有序列的 label → 去重排序 → 每条序列按日期查表补齐
  （缺失留 `null`）。
- **★`showSymbol` 要按「本序列的非空点数」判断，不能按 x 轴总点数**。
  补 `null` 后业务量只剩 2 个非空点：既没有相邻点可连线、又不显示 symbol ⇒ **整条线彻底看不见**。
- **接口返回了但前端 `defs` 漏掉的序列**：`cases`（案件）一直在响应里，界面从来没画过。
  改图表时顺手核对一遍接口字段与 `defs`。


### 3.3 字体系统
- 三个令牌：`--zf-font-sans`（命中 **Segoe UI**）/ `--zf-font-serif`（命中 **Georgia**）/
  `--zf-font-mono`（命中 **Consolas**）。`Times New Roman` 刻意不放数字位。
- 三态分工：`.zf-doc--sheet`（文书起草，衬线）/ `.zf-doc--prose`（文章阅读，衬线）/
  court 推演结论不挂修饰符（数据结论保持无衬线）。
- **判「字体是否存在」必须查注册表**（Python `winreg` + `C:\Windows\Fonts` 双证），宽度法双向都会误判；
  `document.fonts.check()` 对任何字体名都返回 true，不可用。
- **canvas 与 DOM 的 font-family 解析口径不同，不能混用对照**（曾差 24px，误报 Roboto/Cambria）。
  正确手法：量尺也用 DOM span，候选写成 `'"Georgia", "__NoSuch__"'`（假名兜底）同口径比对，
  `|Δ|<0.01` 且不等于假字体兜底宽度才算命中。
- headless 下中文全角恒 1em，无法据宽度判中文字形（`SimSun/NSimSun` 是例外）。
  **好消息：全角恒 1em ⇒ 换中文字体对布局零风险**（实测块高差 0）。
- 字体栈差异会伪装成「布局差异」（换栈后表格总宽 +16px，能让单元格折行翻转）：
  排查布局差异时把 `font-family` 一起纳入比对，但**别轻易替换用户刻意迭代的字体系统**。

### 3.4 数据 / SQL / 备份
- **★批量操作必须逐条检查返回值 + 事后逐项核对**。实测事故：`mysql -N -B` 输出是 CRLF，
  `.split('\n')` 让表名带 `\r` → 16 张表备份全失败，**输出却像成功**。
  ⇒ ① 读 `mysql -N -B` 一律先 `.replace('\r\n','\n').strip()`；② 批量 DDL/DML 后逐条 `SHOW`/`COUNT(*)`；
    ③ 备份必须比对源表与备份表行数。已固化为 `tools/db-backup.py`（自校验，不一致即报错退出）。
- **★触发「批量导入/同步/覆盖」前必须先建快照备份表**：
  `CREATE TABLE xxx_bak_<日期> AS SELECT * FROM xxx;`。实测同步 upsert 把 9 条手工分类改写掉。
- **★`ON DUPLICATE KEY UPDATE` 的「部分列更新」最容易漏列**：注释列举的列 ≠ 实际该保护的列。
  审查时**逐列问一遍「这一列该不该被自动值覆盖」**。
  本项目分类保护规则（**不要按 `source` 白名单**，导入数据里可能根本没有 `manual`）：
  `category = IF(category IS NULL OR category = '', VALUES(category), category)`
  —— 已有分类一律保留，只在为空时由同步补写。
- **★定时任务会让「已修好的数据」重新变坏**：遇到「数据被自动流程改坏」要**同时修数据 + 修自动流程**。
- **数据库加列前先确认 DAO 映射方式**：按列名取值（`rs.getString("law_name")`）时中间插列不影响
  运行中的旧实例；按位置取值则立刻错乱。这决定「能否先迁库再重启」。
- **`sql/` 变更配「迁移脚本 + 备份表 + 回滚段」三件套**，别只改 `schema.sql`（只对全新建库生效）。
- **MySQL 开 binlog + ROW 格式时被 DELETE 的数据可完整还原**：
  用 `mysqlbinlog --read-from-remote-server --base64-output=DECODE-ROWS -v --start-datetime`
  （Data 目录通常无读取权限），把 `### DELETE` 块翻成 `INSERT IGNORE`。
  两个解析坑：遇到下一个 `### DELETE FROM` 必须先落盘上一块；`### WHERE` 是块内正常行不能当结束符。
  已实现 `tools/binlog-undelete.py`。
- **验证「恢复/导入脚本」的安全手法**：`SET FOREIGN_KEY_CHECKS=0; START TRANSACTION; <脚本>;
  <统计>; ROLLBACK;` —— 既证明语法与列数正确、又完全不改现状。
- **数据类投诉的排查顺序**：先 `COUNT(*)` 比数据（连备份表一起）→ 再比代码语义 → 再谈表现层。
  **「比之前少」里的「之前」往往不是本机历史，而是外部参照物**（别人的截图/环境），先问清参照物。
- **`sql/data.sql`（2026-09-22 起是完整版）**：1,638,893 字节，15 张表 4329 条 INSERT，
  其中 `law_article` **743 条 / 13 部法律 / 正文为空 0 条**。
  结构 = `USE` + `SET NAMES` + **15 组 (`DELETE FROM` + `ALTER TABLE … AUTO_INCREMENT=1`)**
  + 一行一条 INSERT；**无 DROP/CREATE TABLE**，列里已含 `seq/source/source_id`。
  **跑它 = 重置**（法条固定 743）。`law_article.source` = `flk_npc 524 / doc_import 219`。
- **备份表命名**：`_bak_beforefull20260922`（导入完整版前 14 条）★最近、
  `_bak_seed20260921`、`law_article_bak_presync`、`law_article_bak_{20260921,docximport}`。
  另有 `sql/restore-prereset-20260921.sql`（binlog 还原「484 条」那次，实测可用）。
- `tools/`（都不依赖构建，直接 Python 跑）：`db-backup.py`、`binlog-undelete.py`、
  `import-law-docx.py`（官方 Word → 按「第X条」回填正文）。

### 3.5 全量文本替换
- **★替换前必须「按语境分类」**，否则会误伤。实测踩两类：
  ① **演示数据里的自然语句**（`pages/qa.html` 的提问「两年竞业限制」被改成「两年保密与竞业限制」）；
  ② **关键词表**（`LawSyncService.inferCategory` 里匹配正文的 `"竞业限制"` 被改掉 → 分支永久失效）。
  ⇒ 清单分三类：**该改**（常量数组/返回值/option/注释）、**不能改**（关键词表、标签词表、
  示例文本、演示问题）、**要精确改**（大 SQL 只改指定字段 —— 写元组感知的拆分器，
  识别 `'...'`、`\` 转义、`''` 双写，按列名定位下标）。
- **分类名（2026-09-22 改为法条原文措辞，7 项）**：
  `劳动合同 / 劳动报酬 / 工作时间与休息休假 / 社会保险 / 解除与终止 / 保密与竞业限制 / 其他`
  （出处《劳动争议调解仲裁法》第二条）。**5 个来源必须同步**：
  ① 库表 `law_article`/`knowledge_article`/`qa_record`/`quiz_question` 的 category；
  ② `ZF.WORK_CATEGORIES`（`js/common.js` + `admin/admin-common.js` **两份**）；
  ③ Java `LawArticleServiceImpl.CATEGORIES` + `LawSyncService.inferCategory` 返回值；
  ④ `admin/qa.html` 与 `pages/qa.html` 的 `<option>`；⑤ `sql/data.sql` 的字段。
  另有 `ZF.QUIZ_CATEGORIES`（额外含「试用期」）与 `ZF.TEMPLATE_CATEGORIES`（另一套），不受影响。
- **`@文件名` 指向的文件不在项目里时，先问完整路径**，别全盘搜同名文件后替用户假定
  （实测：同名 `data.sql` 两份，一份 14 条、一份 743 条，白跑一轮）。**文件名相同 ≠ 同一份文件。**

### 3.6 headless / CDP 验证
- **用 `workspace/rundetached.py`**：同一 Python 进程内「拉 Edge → `subprocess.run` 跑 node →
  只杀自己拉起的进程树」。解决「Bash 调用结束子进程被回收 → ECONNREFUSED」。
  **只杀自己的 pid**，别用 `taskkill /IM msedge.exe`（会连用户浏览器一起杀）。
- **node 脚本被 SIGTERM 时本环境看不到任何输出** → 用 `workspace/runnode.py` 包装跑。
- `cdp.js`：`connect` 返回 `{send, socket}`，**`send` 本身返回按 id 匹配的 Promise**（别自己订阅 message）；
  `send()` 返回**原始报文 `{id, result}`**，取值必须 `r.result.data` / `r.result.result.value`
  （`Runtime.evaluate` 是**双层 result**）。
  `httpGet(url)` **只接受完整 URL**；对 `/json/close`（返回纯文本）与 `/json/new`（**要求 PUT**）
  都会抛异常且**逃出调用方 try/catch** → 必须用原生 `http.request` 手写。
- **`CDP_PORT` ≠ `APP_PORT`**，两个端口分开命名（写错会报 `Invalid URL`，看起来像 CDP 挂了）。
- **★★探针不要写成「超长字符串拼接 + `/* */` 块注释」**。实测把整段探针拼成
  `'a' + 'b' + '/* 注释 */' + ...` 时，只要前一条语句漏一个分号，紧跟的块注释就会让解析器
  把两条语句粘起来 → `SyntaxError: Unexpected identifier 'o'`，**9 个页面报同一个错**，
  却完全看不出是哪一行。
  ⇒ 正确写法：**以独立函数源码注入**（`['window.__probe = function () {', '...', '};'].join('\n')`，
  再 `ev(send, PROBE_SRC)` 定义、`ev(send, 'JSON.stringify(window.__probe())')` 取值），
  多行可读、无拼接陷阱。**脚本自身的块注释里也不要写「星号加斜杠」字面量**
  （数组元素字符串里含 `*/` 同样会闭合外层）。
- **探针报错要先打印异常详情再下结论**：`ev()` 在异常时应返回
  `exceptionDetails.exception.description`（如 `SyntaxError: Unexpected identifier 'o'`），
  而不是让调用方去 `JSON.parse('EXC:...')` 再抛一个看不懂的解析错。
- **`cat` / `ls` / `grep` / `tail` 在本环境都不可用**（缺 coreutils）→
  生成脚本文件一律用 Write 工具，不要用 `cat > file << 'EOF'`（会静默生成**空文件**）。
- **★网络白名单：只有 `api.github.com` 通**。
  `raw.githubusercontent.com` → SSL 握手超时；
  `github.com` 的 **git clone** → `Error in the HTTP2 framing layer`，强制 HTTP/1.1 后变
  `CONNECT tunnel failed, response 502`（代理不放行）。
  ⇒ 取 GitHub 上的文件/目录一律走 **contents API**：
  列目录用 `Accept: application/vnd.github+json`，取内容用 `Accept: application/vnd.github.raw`；
  递归列全量文件用 `git/trees/<branch>?recursive=1`。
  **想校验下载完整性**：算 git blob sha = `sha1("blob " + len + "\0" + content)`，与 API 返回的 `sha` 比对。
  ⇒ 因此 **`npx skills add <owner>/<repo>` 这类依赖 git clone 的命令在本环境装不了**，
    改用 contents API 手动落地同一来源的文件即可（效果等同）。
- **`skills-security-check` skill 本环境未安装**（调用返回 `Can not find skill`）→
  装第三方 skill 时按同标准**手工审计**：递归列目录、逐个读文件、看是否有脚本/hook/MCP 配置/
  执行指令/注入模式，然后给 P0/P1/P2 结论。
- **★本项目行尾不统一**：`js/common.js` 是 **CRLF**，`admin/*.html`、`css/app.css`、
  `admin/admin-common.js` 是 **LF**。同一次批量编辑里用换行符拼锚点，
  **只有 common.js 会静默匹配失败**（其余全成功，很容易漏看）。
  ⇒ 每次改文件前先探测行尾（`raw.count(b'\r\n') == raw.count(b'\n')`），
    或用 `nl` 变量拼锚点，别假定全项目统一。
- **Python 三引号字符串里写中文注释时不要用 ASCII 双引号**（如 `比"这个"`）——
  字符串会提前闭合 → 整个脚本 `SyntaxError` 一行都不执行。中文一律用「」。
  同理 `\uXXXX` 会被 Python 当转义解析，写文档举例时改用 `U+XXXX`。
- **多页签必须用「该页签自己的 send」**；循环实测要自查 `document.location.href`
  （否则 A 页探针读到 B 页文档，这类误报很常见）。用完关标签页。
- **`captureScreenshot` 全白/返回空的三个坑**：`captureBeyondViewport:true`、`clip:{scale:2}`、
  `deviceScaleFactor:2`。**可靠做法：只传 `{format:'png'}`**，尺寸交给
  `Emulation.setDeviceMetricsOverride` 的 `deviceScaleFactor:1`。
- **CSS 过渡在同一 JS 回合内不推进**：`el.click()` 后立刻读 `getComputedStyle` 得到的是**起始值**。
  必须 `await` 至少一帧 + `setTimeout(≥过渡时长)`，且 `Runtime.evaluate` 带 `awaitPromise:true`。
  导航后要**轮询等 `location.href` 变成目标页**，不能只 sleep 固定值。
- **弹窗遮罩「看起来没生效」多是截图时序假象**：先查 `.modal-backdrop` 是否存在、
  `opacity` 是否 0.5、`body.modal-open` 是否已加；Bootstrap 过渡 + headless 合成需要 ≥1.5s。
- **`Emulation.setEmulatedMedia({features:[{name:'hover',value:'none'}]})` 不足以翻转 `(hover:none)`**，
  必须叠加 `setTouchEmulationEnabled({enabled:true,maxTouchPoints:5})` 且 `mobile:true`。
- **`elementFromPoint` 命中判定不能双向 `contains`**：只允许 `t === e || e.contains(t)`
  （反向会把整行算命中，掩盖真实缺陷）；打点前逐个 `scrollIntoView({block:'center'})`。
- **`JSON.stringify(undefined)` 返回 `undefined`**（不是字符串），`.slice()` 会抛 TypeError。
  探针里写错标识符会让 IIFE 抛 SyntaxError → 返回 undefined → 只看到 JSON 解析失败。
  ⇒ `ev()` 必须把 `r.exceptionDetails.exception.description` 挖出来打印。
- **JS 里不要写 Python 的 `%` 格式化**（`'x=%s' % (a,b)` → 整行 `NaN`，且不报错）。
- **headless 对 file:// 子资源有磁盘缓存**，`Network.setCacheDisabled` 不可靠；
  先用动态注入记号样式自证「读到的确实是当前文件」。
- **断言里的硬编码基线会过期，失败时先怀疑基线本身**。手法：用注入样式把**每轮改动分别停用**，
  看能还原到哪个值（`diag-baseline.js`），别靠读代码推。
- **导航类 bug 取证四件套**：① `navigation.redirectCount`（>0 才是真 HTTP 重定向）；
  ② `document.referrer`；③ **页内 `fetch(同一URL)` 自测**（拿到正确内容 + `redirected:false`
  ⇒ 服务器没问题，是前端跳走的 —— 这一步能一刀切开服务端/前端）；
  ④ `Page.getNavigationHistory`（`location.replace` 不产生 history 条目）。
- **探针数组是 per-document 的**：跨文档导航后旧文档的 `window.__TRACE__` 一起销毁，
  在最终文档读到空数组**不代表中间没发生过跳转**。
- **鉴权类验证必须用真实会话，不要打桩**（桩只伪造 profile 会产生假阳性）。
  正解：`POST /api/auth/login` 取 JSESSIONID → CDP `Network.setCookie({domain:'127.0.0.1', path:'/zhixiaofa'})`
  → 零桩导航。**已废弃 `audit-admin-server.js`**（会假阳性）。
- **写管理端桩前必须逐页 grep 实际调的 URL**：不是所有管理页都走 `/admin/*`
  （`laws.html` 直接调 `/law-articles/*`；`logs.html` 的图表是 `/admin/logs/stats`）。
  桩给错字段会表现为「`total` 有值、计数也对，但表格显示『没有找到匹配的记录』」
  （`ZF.initAdminTable` 读的是 **`page.list`**，不是 `page.rows`）。
- 本环境 shell 缺 coreutils（`ls`/`grep`/`tail` 等 not found），文件操作与打印用 Python。
  长脚本一律写成文件再执行；脚本自身的块注释里**不要写「星号加斜杠」字面量**。

## 四、★当前功能状态（易忘，重启后核对）

### 4.1 登录落点按角色分流（2026-09-22）
`common.js` 新增 `ZF.homeFor(user)`（ADMIN→`/admin/index.html`，否则 `/pages/home.html`）
+ `ZF.goAfterLogin(user)`（**优先回 `zf_redirect`**，否则 `homeFor`）。
接线 4 处：`index.html` 根入口、`login.html` 的「登录成功 / 注册成功 / 已登录」。
**管理员的登录落点必须是后台**，不能停在「和个人用户一致」的前台首页。
路由规则汇总：
- 未登录 → `login.html`（`redirectLogin`）
- 登录成功 → 角色化落点
- 普通用户开管理页 → 管理端内部提示页（`renderAdminDenied`，**刻意不跳用户端**）
- 普通用户开需管理员接口 → 后端 11302

**排查「管理端混入用户功能」的正确姿势**：先 Grep 管理端文件里指向 `/pages/*` 的链接
（本项目**零命中**），再实测侧边栏 9 项 —— 别凭「看到用户界面」就断定混了功能，
很可能是**登录后压根没进到后台**。

### 4.2 服务端排序（2026-09-22 从源项目移植，29 文件）
`SqlBuilder.orderBy(sortName, order, whitelist, fallback)` —— **ORDER BY 列名无法用 `?` 参数化**，
所以用「前端列名 → 真实列名」的**白名单映射**，前端值只作 key 查表，查不到回退默认，
**永不拼接用户输入**（实测 5 种注入串全部安全）。
链路：Servlet 读 `sortName`/`sortOrder` → Service(7 参重载) → Dao → `orderBy(...)`。
覆盖 6 域：users / qa / contracts / knowledge / quiz / logs
（`laws`/`doc-templates` 表格**没有 sortable 列**，无需实现）。
⚠️ Java 层，**需重启**。

### 4.3 自定义下拉 `ZF.enhanceSelect()`（2026-09-22）
**动机**：原生 `<select>` 的弹层由系统渲染，字体/内边距/高亮色（那块灰）CSS 改不动。
**做法（渐进增强）**：保留原生 select 承担取值与 change，仅用
`position:absolute;width:1px;opacity:0;clip:rect(0 0 0 0)` 视觉隐藏
——**绝不能用 `display:none`，否则取不到值**；在其位置渲染触发器 + 弹层。
⇒ 页面里 `$sel.val()` / `.on('change')` / `ZF.filterParams()` **一行都不用改**。
三个实现细节：① 弹层**每次展开时按当前 options 重建**（选项异步填入）；
② 选项用 `mousedown` 而非 `click`（避免 document 关闭处理器抢先）；
③ `$sel.val('')` 直接赋值**不触发 change** → 加 400ms 轮询同步触发器文本。
接线在 `admin-common.js` 的 `initAdminPage`（管理端 9 页自动生效）；用户端暂未启用。

### 4.4 数据看板视觉体系（2026-09-22，三方设计评审后落地）
作用域全挂 `body.zf-admin-page`。核心规则：
- **卡片分三层**：主角卡 `.zf-card--hero`（业务趋势）是**全页唯一带阴影**的卡
  （+ `::before` 顶部 3px 主色条，`--zf-shadow-md`）；数据卡保持素色；
  辅助卡 `.zf-card--plain`（快捷入口）退为 `--zf-muted` 浅底。
  **不给所有卡加阴影** —— 同屏 20+ 张、栅格只 14px，会互相叠影糊成一片。
- **区块顺序**：指标卡 → 业务趋势 → 分布图×3 → Top×2 → 排行 → 系统健康 → **快捷入口（最后）** → 版本脚注。
- **指标卡**：`#metric-grid` 改 flex + `justify-content:center`（11 张 4 列，末行 3 张居中，
  消除右侧整列留白）；数值用 `--zf-font-mono` + `tabular-nums`；
  图标按语义上色 —— **只留红（风险点）/ 绿（法条库）两类**，其余保持基类浅蓝。
  （曾试给「模板数」单开 info 色，但 `#e8f1fe` 与基类 `#dbeafe` 屏上无差别 = 无效区分，已删。）
- **消「卡中卡双描边」**：`body.zf-admin-page .zf-chart { border:none; border-radius:0; padding:0 }`
  （`.zf-chart` 自带 border/圆角/padding，嵌在 `.zf-card` 里会双描边）。
- **快捷入口**：`.zf-card.zf-quick` 改横排（图标左、文字右），单项 93→**61px**、
  整块 406→**224px**。
- **图表配色统一到主色系**（ECharts 配置里**不能写 CSS 变量**，用等值 hex）：
  `LINE_COLORS = [#4285f4,#00bcd4,#34a853,#9334e6,#fbbc05]`、
  `PIE_COLORS = [#4285f4,#5b9bff,#00bcd4,#34a853,#9334e6,#607d8b,#fbbc05,#ff7043]`、
  慢接口走 `#ef4444`（danger）；统一 `tip()` 白底描边圆角 tooltip；
  `valueAxis()` 去轴线/刻度只留浅分隔线；横向柱图右侧加数值标签（等宽字体）；
  饼图 `radius:['40%','66%']` + 白色 2px 分隔。
- 总高 2692 → **2474px**。
- **「业务趋势」已改双 Y 轴 + 日期并集对齐**（见 §3.2c）：左轴业务量 / 右轴请求量（虚线），
  序列 6 条（原 `defs` 漏了接口返回的 `cases`）。图高 280 → 300px。

### 4.5 管理端外壳 + 9 页（2026-09-22 第二轮整体优化）
- **侧栏**：改纯白 + 右侧分隔线；**删掉底部 `.zf-sidebar__foot`**
  （原本挂着「课程设计 · DAO-Service-Servlet 分层架构」—— 开发说明不该出现在产品界面）。
- **内容区**：浅灰画布 `#f6f7f9`，卡片白底 + 极浅投影。
- **8 个列表页统一骨架**：`filter-bar → toolbar（计数 + 主操作）→ table`；
  主数据卡的 `zf-card__head`（与顶栏逐字重复）已删，带「新增」按钮的页把按钮移进工具栏。
- **表格**：操作列 27 个文字按钮 → 28×28 图标按钮；`td` 垂直居中；`.zf-badge` nowrap；
  单元格 padding 11px；容器 `overflow-x: auto` 兜底；users 的昵称/联系方式/城市岗位设显式宽度。
- 用户端页面（home/profile/court/contract-review/knowledge/qa）**零影响**（已 17/17 实测）。

## 五、页面范式
- **A 工作台**（court、contract-review）：`.zf-desk` 左输入右结果。两者同构，改一个要查另一个。
- **B 左参考/右页签**（doc-drafting）：左模板库 sticky，右 `.zf-work` 三页签
  （面板 max-height 内部滚动）→ 页面高恒等于视口。
- **B2 左概览/右页签**（profile，范式同 B）：左头像 + 2×2 指标卡，右「资料/密码/收藏」。
  hidden 面板 + 锚点跳转必须在 `bindAnchorLinks` 前抢绑定改 `tabs.select()`。
- **C 卡片流**（home）：欢迎卡 → 4 张指标卡 → 功能模块网格 → 最近问答/新人必看两列。
  **首页本来就纵向滚动**（内容量决定，非缺陷）；列表项可点击（问答原地展开、文章弹窗）；
  「引用N条法规」徽标是独立开关（`<button>` + `aria-expanded`）；展开区**懒渲染**。
- **D 筛选+网格**（knowledge）：固定两列，整卡可点、卡内不放可聚焦元素。
- **E 管理端专属外壳**（admin/ 10 页）：与用户端**完全分离**。每个 admin html 的 `<body>`
  带 **`class="zf-admin-page"`**，app.css 末尾有对应 `body.zf-admin-page ...` 校正块。
  ⚠️ **这使 admin html 不再与源项目逐字节相同** —— 若日后整目录覆盖 admin 页面，
  **必须记得把 `<body>` 改回 `<body class="zf-admin-page">`**，否则版式退回错版。
  每页只需 `ZF.initAdminPage({active,title,sub})`，内部自动渲染
  `renderAdminSidebar`（9 项分三组）+ `renderAdminTopbar` + `renderAdminDenied`。
  窄屏（≤1100）侧边栏转 fixed 抽屉 + 汉堡 + 遮罩。
- 通用断点：1100 塌单列 / 820 字段单列 / 560 收紧。
- 筛选胶囊统一 `.zf-chips`+`.zf-tag`+`aria-pressed`（active = 实心蓝白字）。
- 指标卡三套尺寸刻意做出主次：首页（图标 52/数字 26）> 管理后台（42/22）> 个人中心（36/19）。
- **全站四类内容都没有「按 id 深链」的用户端路由**，想做「跳到某页并打开第 N 条」必须新增路由。

## 六、验证工具（都在 `workspace/`）
- **黄金口径优先用**：`verify-admin-real.js`（**真实管理员会话巡检管理端 9 页**，退出码 0 = 9/9，
  跑法 `python workspace/rundetached.py 9363 verify-admin-real.js`）
- 管理端：`verify-admin.js`(34 断言/file:// 桩口径)、`shot-admin.js`、
  `diag-admin-nav.js`（导航取证）、`zc-stub-admin{2,-user}.js`
- 用户端：`verify-home-{stat,scope,click,click2,runtime}.js`、`verify-pf-space.js`、
  `verify-shared-impact.js`、`verify-matrix.js`、`verify-{qa-hist,draft,kn,pf}.js`
- 全站体检：`audit-ui.js` → `ui-audit.json`（7 页 × 4 视口 × 10 维度）；
  **改共享 CSS 前后各跑一次做基线对比**
- 交互动效：`verify-artd-motion.js`（**24 断言**：数字滚动的补间采样、入场 stagger、
  进度条状态机、图表 animationDuration、异构栅格比例、双层阴影）
- 本轮新增：`verify-trend.js`（趋势图双轴/日期对齐 **6 断言**）、
  `verify-admin-ui.js`（**管理端 9 页外壳+表格 142 断言**，含逐页 docH/行高/横溢/图标按钮明细）、
  `verify-dashboard.js`（看板 24 断言）、`verify-userpages.js`（**用户端 6 页 17 断言，
  查共享类是否被 admin 作用域误伤**）、`verify-sort.js`、`verify-login.js`、`verify-select.js`
  ⇒ **改管理端后固定跑这六套**（缺一套都不行）：
    `verify-artd-motion`(24) + `verify-dashboard`(30) + `verify-trend`(6) +
    `verify-admin-ui`(142) + `verify-admin-real`(9) + `verify-userpages`(17)
  ★**教训**：曾有一次只跑了后四套、**漏掉 `verify-dashboard`**，
  于是"画布投影压掉主角卡阴影"的 bug 一路潜伏到下一轮才暴露。
  **改动影响面判断不准时，宁可全跑**。
  ★另一条：**断言里的口径会随设计变更而过期**（本轮就有 3 条：法条卡 `--success`→`--knowledge`、
  阴影"全页唯一"→"数据卡浅影+主角卡重影"、末行"居中"→"左移+填满"）。
  断言失败时**先分清是"代码坏了"还是"口径变了"** —— 本轮两者同时出现：
  2 条是口径过期（改断言），另 2 条是**真 bug**（改代码）。
- 字体：`verify-font-e2e.js`(22)、`verify-fonts.js`(25 组)、`diag-fontid-dom.js`（**判字体首选**）
- 诊断：`diag-attribution.js`（逐条停用改动做 A/B）、`diag-baseline.js`（**定位过期基线**）、
  `diag-inline.js`、`diag-offset.js`、`probe-cache.js`
- **`static-check.js`**：ES5 + 内联 JS 语法 + 版本号（自动探测）+ **CSS 花括号**。改完必跑。
- **脚本端口**：`verify-pf-space`/`verify-shared-impact` 用 9402；`verify-admin`/`shot-admin` 用 9351；
  `verify-admin-real`/`diag-admin-nav` 用 9363。跑前确认对应端口有 Edge。

## 七、子 Agent 经验
- 价值在**发散方案**，不在收敛根因：缺实测的布局诊断 subagent 会集体编造。
  **先 headless 拿量化数据，再让它们做「基于数据的方案设计」**。
- prompt 必须带量化现状 + 硬约束，否则输出泛泛。结论要复核（令牌名、既有类样式引用常有错）。
- 有效套路：**同一份事实**喂 3 个不同视角的 subagent（信息架构 / 视觉设计 / 可视化交互），
  再取三方共识 + 各自亮点合成落地。
