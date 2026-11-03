# CSS / 视觉体系（zhixiaofa）

> 本项目**最高频故障源**。改 `app.css` / 主题 / 图表 / 动效前先读本文件。
> 主文件 `MEMORY.md` 里只留了最危险的几条铁律，细节都在这里。

## 四、CSS / 视觉体系（本项目最高频故障源）

### 4.1 通用铁律
- **★★追加 CSS 时「决定布局方向的属性」必须写全**。同特异性下后声明者胜，但**未覆盖的属性会从更早的
  规则继承**。踩过三次：`.zf-card` 是 `display:flex;flex-direction:column` → 挂它的 `.zf-stat` 也竖排；
  `.zf-actions` 是 `column` → 后追加只写 `gap` 仍竖排；`.zf-quick` 的 `flex-wrap/justify-content/margin-top`
  未被覆盖 → 单项被撑到 93px（应 61px）。
  ⇒ 补既有 class 前**先 grep 全文件出现次数**，把 `display`/`flex-direction`/`flex-wrap`/`justify-content`/
  `position`/`margin` **显式写全**，或改用页面作用域类。另注意 **Bootstrap 的 `p{margin-bottom:1rem}`**。
- **★★末尾追加的「基态」规则会架空上方的同名规则（特异性相同时）**。踩过两次：
  ① `body.zf-theme-ink .zf-card{box-shadow:none}` (0,2,1) 与 `body.zf-admin-page .zf-card--hero` (0,2,1)
  **完全相同** + 主题块在末尾 → **主角卡重阴影被抹成 none**；
  ② `body.zf-admin-page .zf-content .zf-card` (0,3,2) 压过 `.zf-card--hero` (0,2,2)。
  ⇒ 追加主题/广撒网选择器时，凡被覆盖的规则都要么**提高特异性**、要么用
  `:not(.zf-card--hero):not(.zf-card--plain)` **显式排除**。**先 grep 有哪些修饰类。**
  另：基态必须写在 `@media` 之前，末尾只留 `:hover` 这类不参与 display 竞争的属性。
  ⚠️ 管理端数据卡浅阴影是 `(0,5,1)`，**比主题高，刻意保留**（密集数据靠阴影分边界；用户端平面卡一律去阴影）。
- **★★追加 CSS 时换行常量写错会污染第一条规则的选择器**。Python 拼 CSS 时若把换行写成**字面反斜杠+n**，
  CSS 解析成转义字符 `n` 粘到紧随的选择器上 → `n body.zf-admin-page #metric-grid` → **整条规则静默失效**
  （后续规则因前一条 `}` 后是真换行而不受影响）。⇒ 写完**必须校验** `raw.count(b'\\n') == 0`
  + 花括号平衡；**花括号平衡发现不了这个问题**（数量平衡，只是位置错）。
- **`.zf-card`/`.zf-stat`/`.zf-doc`/`.zf-grid`/`.zf-chart`/`.zf-quick` 都是共享类**
  （用户端 home/profile/court/contract-review/knowledge 也在用）。改前 grep 使用方，要差异化就挂
  `body.zf-admin-page` 作用域或新增修饰类。⚠️ `.zf-quick` 管理端是卡片、用户端是 `.zf-quick__item` 胶囊容器
  → 选择器要写 `.zf-card.zf-quick` 才只命中管理端。
- **★`position:absolute; inset:0` 的面板会连带盖住「排在它前面的兄弟」**：
  实例 `.zf-desk__history` 从面板顶端铺满，把前面的**页签栏**整条压在下面（命中测试指向
  zf-card__title），而这个问题**只在历史页签激活时暴露**（输入页签下 history 是 display:none）。
  ⇒ ① 铺满定位要问「容器里还有什么会被我压住」，让出固定头部的高度（top:54px）；
  ② **状态切换类界面必须逐个页签做 elementFromPoint 命中测试**，只测默认态永远发现不了。
- **★★`scrollIntoView({block:'start'})` 会与 sticky 顶栏打架**：`.zf-topbar` 是
  `position:sticky; top:0; z-index:20`（高 64~68px），`block:'start'` 把元素顶部对齐到 **y=0**
  ⇒ **元素最上面那 ~61px 被顶栏盖住**。而单列布局下被盖住的往往正是「卡片头部 / 页签栏」，
  即用户唯一能点到的操作入口 ⇒ 表现为「按钮明明在，却看不见 / 点不到」。
  ⇒ 用 `scrollBelowTopbar(el)`：扣掉顶栏高度（+12px）后自己 `window.scrollTo`。
  **凡是「滚动到某元素」的代码，都要先问一句：上面有没有 sticky 的东西？**
- **★「元素存在且可见」≠「用户点得到」**：`display !== 'none'` + 在视口内，仍可能被
  sticky 顶栏 / 浮层遮住。**验证可点性要用 `document.elementFromPoint(中心点)` 命中测试**
  （判 `t === el || el.contains(t)`）；这类遮挡只有命中测试或截图能发现，
  只查 computed style 的断言会**通过但功能是坏的**。
- **判断「某条规则有没有生效」不能读 CSS，只能看计算样式**：① `getComputedStyle`；
  ② `document.styleSheets[i].cssRules` 递归（走 **http://** 时可读，`file://` 抛 `SecurityError`；
  能把 `@media` 的 `conditionText` 一起带出来，一次回答「规则在不在、在哪个媒体条件里、选择器实际文本」）。
- `.zf-stat > div` 会连 `.zf-stat__icon`（也是 div）一起命中 → 写 `> div:not(.zf-stat__icon)`。
  这类 bug 读 CSS 看不出来，**必须读 computed `gridArea`**；定位手法：用内联样式（最高特异性）
  验证「布局逻辑本身对不对」。
- **网格一定显式写 `justify-content` + `align-items`**：不写 `justify-content` 会继承 `.zf-stat` 的
  `align-items:center`，把整个格栅内容居中（实测图标左缘被推偏 67px）。网格列数**能算就别用 auto-fill**。
- **`:hover` (0,2,0) 会盖过单类 `--current` (0,1,0)**，要补 `--current:hover`。
  **强调色只表示「当前位置」，整列表最多一条**；hover 用中性灰 `rgba(14,17,21,.08)`
  （实测 .043 在浅底上不可见，必须截图实测）。
- 零散但真踩过：`scrollbar-width` 会屏蔽 `::-webkit-scrollbar`（滚动条样式必须限作用域）；
  取消绝对定位要 `position:static` + 四方位 `auto` 全写；`textarea` 高度 = max(rows, min-height)，
  突破必须显式 `height`；`calc(100vh - Npx)` 的 N 要把容器 padding 全算进去；
  按视口高度分档时**上限要 ≥ 目标设备 innerHeight**（1366×768 的 innerHeight=768，`max-height:760` 永不命中）；
  `::after` 热区用 `height:100%` 无效（行内元素伪元素只长到自身高度）→ 要
  `top/left/bottom/right:50%` + `margin:-22px` 反推；`tabular-nums` 对微软雅黑无效（雅黑数字本就等宽），
  真正会抖的是 `Times New Roman` 与 `Arial`。
- **★`.zf-badge` 必须显式 `white-space: nowrap`**，否则窄列里「普通用户」被压成**竖排 4 行**。
  同理 `.zf-table td { vertical-align: middle }`（默认 `top`，两行内容视觉上"偏上"）。
- **★操作列的文字按钮是「表格列宽被挤爆」的根因**：users 页每行 5 个带文字按钮 ≈300px，把昵称/角色/状态
  压到折行。改 **28×28 图标按钮 + `title` + `aria-label`**（`.zf-btn--icon`）后昵称列 72→104px、
  **行高 91→60px**。
- **危险操作不要用实心红**（`.zf-btn--danger` 是红底白字）：实心红只留给「二次确认」里那**一个**按钮；
  表格删除、工具栏清理用**描边式** `.zf-btn--danger-outline`（白底 + 红字 + 浅红边）。
- **改前后各跑一次 `audit-ui.js` 做基线**（7 页 × 4 视口 × 10 维度）。

### 4.2 主题「靛 · 朱」+ 字体（2026-09-22 立，方案全文 `workspace/design-plan-zhixiaofa.md`）
**主题定义在 `body.zf-theme-ink`，已全量推广到全部 19 页**（管理端是
`class="zf-admin-page zf-theme-ink"` 两个作用域叠加）。
- **两种墨**：靛 `#1f3a5f`（蓝黑墨水，主色）/ 朱 `#b0342a`（印泥红，**只用于风险·警示·删除**）。
  ⚠️ 顺带修掉既有缺陷：旧主色 `#4285f4` 对白底只有 **3.56**（< AA 4.5）、旧危险红 `#ef4444` = 3.76；
  新靛 = **11.48**、新朱 = **6.23** —— 这正是当初不得不另造 `--zf-primary-strong` 的根因。
- **字体三档**：UI = 雅黑（易读优先）；标题 = `STZhongsong`（华文中宋 ≈ 公文「小标宋」）；
  法条·文书正文 = `FangSong`（**GB/T 9704 规定公文正文用仿宋**）。本机三档字体均实测可用。
- **圆角分档**（原 12px 用遍所有层级，这正是「模板感」来源）：卡片 6 / 控件 4 / 页面级 0。
  **平面卡一律去阴影**，改 1px 线 + 留白；阴影只留给真正浮起来的层（弹窗/下拉）与主角卡。
- 首页英雄区：**左「说处境」右「给依据」双栏 7:5**，右侧用库里真实法条原文 + 真实条号；
  刻意不做「大数字 + 小标签 + 渐变强调」。
- **★全量换主题的必查清单**：
  ① **★★硬编码的透明度会漏，而且要按「正文里实际用到的档位」补全**。主题的
  `--zf-primary-aNN` 阶梯必须覆盖 app.css 正文里出现过的**每一档**。
  实测教训：先只补了 a06/a10/a16，而正文实际用到 **a08/a14/a55/a95** ——
  于是**输入框焦点环、聊天 hover、tabs hover、关键帧等 17 处仍是旧 Google 蓝**（事后再查才发现）。
  ⇒ 做法：`grep -o 'rgba(66, 133, 244, [0-9.]*)' app.css | sort -u` 拿全档位 → 补齐令牌 →
  **每一处字面量都换成 `var()`** → 复查「正文里剩余旧 rgba = 0」。
  ⚠️ 替换时 **alpha 前的小数点是正则最易漏的部分**（要写 `\.(06|08|…)`）：漏了会
  「只替换 1 处、其余静默不动」，脚本还报成功。**换完必须复查剩余数，别信替换计数。**
  ⚠️ 另一类同源漏网：**用户端页面里的 ECharts 硬编码色**（本项目 `pages/court.html` 曾漏，
  因为上一轮的图表收敛只覆盖了管理端三页）——**按「文件」扫，不要按「印象」扫**；
  ② **ECharts 配色不在 CSS 里**（读不到变量），硬编码在 JS 常量 → **最容易漏的就是图表**；
  ③ 组件级硬编码色一律改令牌（9 处）；④ **断言里能读令牌就别硬编码色值**；
  ⑤ 管理端图标色收敛为「两种墨」：靛（业务 + 知识资源）+ 朱（风险点数）+ 中性灰（运维），
  上一轮无语义依据的紫已撤。
- ⚠️ `.zf-stat__icon` 底色走 `var(--zf-primary-light)`，**会自动跟随主题**，不需单独覆盖。
- **★判 CJK 字体是否命中：不要用宽度法，用 canvas「着墨像素数」签名**。实测 `SimSun`/`SimHei`/`FangSong`
  的**西文度量完全相同**（都 288px），宽度法既区分不了、也证明不了「没退化成宋体」。
  正确做法：同一段文字分别用「候选+假名兜底」与「纯假名兜底」画到 canvas，取 `ImageData` 做哈希 +
  统计暗像素数，**同口径（canvas 对 canvas）比对**。实测笔画粗细排序完全符合真实特征：
  仿宋 1294 < 宋体 1637 < 华文中宋 2346 < 黑体 2800。
- **读主题令牌必须读 `document.body`，不能读 `documentElement`**（主题类在 body 上，读 documentElement
  只能拿到 `:root` 默认值 → 会把「已生效」误判成「没生效」）。
- **★复用旧元素的 `id` 会被页面 JS 覆盖**。实例：英雄区 h1 用回 `id="welcome-title"` 被
  `$('#welcome-title').text('你好，'+昵称)` 覆盖。⇒ 重写某块 UI 时**先 grep 该 id 的 JS 写入方**。
- 判「字体是否存在」查注册表（Python `winreg` + `C:\Windows\Fonts` 双证），宽度法双向都会误判，
  `document.fonts.check()` 对任何字体名都返回 true 不可用。**canvas 与 DOM 的 font-family 解析口径不同，
  不能混用对照**（曾差 24px 误报）。headless 下中文全角恒 1em → **换中文字体对布局零风险**（实测块高差 0）。
  字体栈差异会伪装成「布局差异」（换栈后表格总宽 +16px 能让单元格折行翻转），但**别轻易替换用户刻意
  迭代的字体系统**。

### 4.3 管理端视觉体系（作用域全挂 `body.zf-admin-page`）
- **三层卡片**：辅助卡 `.zf-card--plain`（透明/浅底）< 数据卡（白底 + 极浅投影）< 主角卡
  `.zf-card--hero`（`--zf-shadow-md` + `::before` 顶部 3px 主色条）。**全页只允许一张主角卡**；
  **不给所有卡加阴影**（同屏 20+ 张、栅格只 14px，会叠影糊成一片）。
- **画布层次**：外壳（侧栏 + 顶栏）纯白 → 内容区浅灰（走 `--zf-paper`）→ 卡片浮于其上。
  原来内容区与卡片同为白底，边界只靠 1px 边框，整页发"平"；侧栏原为浅蓝 `#f0f6ff` 与浅灰画布两种色相，
  同屏显脏 → 改纯白 + 右侧分隔线。**删掉侧栏底部 `.zf-sidebar__foot`**（原挂「课程设计 ·
  DAO-Service-Servlet 分层架构」—— 开发说明不该出现在产品界面；用户端同款也已在 2026-09-22 清理）。
- **列表页统一骨架**：`filter-bar → toolbar（计数 + 主操作）→ table`。
  ⚠️ 原先是混着的（knowledge/doc-templates/logs 的 toolbar 在 filter-bar **之前**），改前先 grep 各页顺序。
  主数据卡的 `zf-card__head`（与顶栏**逐字相同**）已删；但带「新增」按钮的页（knowledge/doc-templates/quiz）
  **不能整块删** → 把按钮移到 toolbar。筛选条**每一项都要有 label**（否则与 select 顶部不齐），
  输入框宽度要把 placeholder 装下（实测 160px 装不下「用户名 / 昵称 / 邮箱 / 手机」）。
- **指标卡**：`#metric-grid` 用 flex + `flex:1 1 168px` + `gap:12px` → 每行 6 张、**末行由 flex-grow 拉伸填满**；
  图标 36 / 数值 21（`--zf-font-mono` + `tabular-nums`）/ padding 15-16。
  图标按语义上色，**只留红（风险点）/ 绿（法条库）**两类，其余基类浅蓝。
  （曾给「模板数」单开 info 色，实测 `#e8f1fe` 与基类 `#dbeafe` 屏上无差别 = **无效区分**，已删。）
- **消「卡中卡双描边」**：`body.zf-admin-page .zf-chart { border:none; border-radius:0; padding:0 }`。
- **区块顺序**：指标卡 → 业务趋势 → 分布图×3 → Top×2 → 排行 → 系统健康 → 快捷入口（最后）→ 版本脚注。
- **快捷入口**：`.zf-card.zf-quick` 改横排（图标左文字右），单项 93→**61px**、整块 406→**224px**。
- **★"两个颜色能不能分辨"要算 RGB 分量差**：实测青底 `#d9f2f6` 与主蓝底 `#dbeafe` 只差 **G+8/B-8**，
  屏上几乎分不出（无效区分，本项目为此踩了两次）；紫 `#ede4fd` 与蓝（R+18/G-6）才真能分片。
- **★"卡片看起来空不空"可以量化**：`填充率 = (文字右缘 − 图标左缘) / 卡内宽`。实测指标卡 271px 宽、
  填充率仅 **39%**（右侧空 140px）—— 这才是"寡淡"的真因，不是颜色。改一行 6 张（178px）后 **57%**。
  ⇒ 别凭感觉说"丑"，先量填充率。
- **表格**：操作列按钮改图标（见 §4.1）、`td` 垂直居中、`.zf-badge` nowrap、单元格 padding 11px、
  容器 `overflow-x:auto` 兜底、users 的昵称/联系方式/城市岗位设显式宽度。整页总高 2692 → **2474px**。
- 用户端 6 页**零影响**（`verify-userpages` 17/17 实测确认）。

### 4.4 交互动效（2026-09-22 参考 Art Design Pro 移植）
参考对象 `app.artd.pro` 开源版 = **`Daymychen/art-design-pro`**（Vue3 + Element Plus）。
**拿参考的正确姿势**：该站只给登录页，但它是开源的 → **直接读 GitHub 源码**比看截图猜准得多
（取 GitHub 文件的手法见 §6.5 网络白名单）。
- **`ZF.countTo(el, target, opts)`**：`requestAnimationFrame` 逐帧改文本 + `easeOutExpo` +
  千分位；**同一元素重复调用先取消上一次**；`prefers-reduced-motion` 时直接落终值。
  实测补间（目标 5000/1000ms）：`280ms=4,298 → 560ms=4,902 → 末态=5,000`（前快后慢 ✓）。
- **`ZF.adminProgress.start()/done()`**：顶部进度条，接在侧栏导航点击上，**只做真实等待反馈、不伪造**。
- **入场过渡**：`.zf-content` 的 `zfPageIn` + 指标卡 `zfStatIn` 逐张 stagger（40ms→400ms）；
  **只给指标卡加**（全页 30+ 张都动会吵）。
- **★★`animation-fill-mode: both` 会把最终帧的 `transform` 留下来**：实测动画结束的 computed transform 是
  **`matrix(1,0,0,1,0,0)`（单位矩阵）而不是 `none`**，而单位矩阵**一样会让该元素成为后代 `position:fixed`
  的包含块**（隐患）。⇒ **delay 为 0 的入场动画不要加 fill-mode**；**有 `animation-delay` 的必须留 `both`**
  （backwards fill 负责 delay 期间保持透明，否则会闪一下）—— 此时代价是保留单位矩阵，
  **需确认该元素内部不会有 fixed 后代**。
- **异构栅格**：`.zf-grid--ratio-14-10` / `--ratio-10-14`（比例写进类名）。⚠️ **不等分必须有依据** ——
  只用了两处：文章 Top10（标题远长于法条号）取 14:10；慢接口 Top（y 轴是完整 URI）取 10:14。
  同类等权重的卡片（三张环形图）**仍应等分**，硬凑不等分反而破坏秩序。
- **双层阴影**：`0 1px 3px 0 rgba(14,17,21,.03), 0 1px 2px -1px rgba(14,17,21,.08)`
  —— 单层总有"贴纸感"。

## 五、ECharts 数据可视化
- **★同一坐标系混放相差数量级的指标 = 图表等于没有**：实测请求量 1~1352（千级），而用户/问答/合同/文书/案件
  都是个位数 → 同一 Y 轴下 4~5 条业务线**全压在 y=0**。⇒ 必须拆**双 Y 轴**：业务量走左轴
  （`minInterval:1` 保证刻度取整），技术指标走右轴（**不画 splitLine**，否则与左轴分隔线交错成一堆横线），
  右轴序列用**虚线 + 中性灰**并在图例名标注「（右轴）」。图高 280 → 300px。
- **★多个序列的日期点不一致时必须取并集对齐**：实测 `labels/users/…` 只有 2 天、`requests` 有 7 天，
  原实现各按自身数组顺序取值 ⇒ ① x 轴只有最短序列那么长 ② 同一天的数互相错位。
  正确做法：收集所有序列 label → 去重排序 → 每条序列按日期查表补齐（缺失留 `null`）。
- **★`showSymbol` 要按「本序列的非空点数」判断**，不能按 x 轴总点数：补 `null` 后业务量只剩 2 个非空点，
  既无相邻点可连线又不显示 symbol ⇒ **整条线彻底看不见**。
- **接口返回了但前端 `defs` 漏掉的序列**：`cases`（案件）一直在响应里、界面从来没画过。
  改图表时顺手核对接口字段与 `defs`。
- **配色**（配置里**不能写 CSS 变量**，用等值 hex 并注释标明对应令牌；已随靛朱主题收敛）：
  `C_PRIMARY=#1f3a5f`、`C_DANGER=#b0342a`；
  `LINE_COLORS = ['#1f3a5f','#37587f','#517aa2','#7196ba','#9db5cf','#8a94a3']`（**靛的明度阶梯**，
  末位中性灰留给走右轴的请求量；**不用彩虹**，5 条业务线靠明度区分即可）；
  `PIE_COLORS` = 靛的 8 阶明度梯度；`RISK_COLORS = ['#b0342a','#c98a3a','#2f6f4e']`
  （高=朱/中=琥珀/低=松绿，**这三档有真实语义**，是「朱只在有语义时出现」的正当用例；
  `renderPie` 已加可选 `palette` 参数）。
  统一 `tip()` 白底描边圆角 tooltip；`valueAxis()` 去轴线刻度只留浅分隔线；横向柱图右侧加数值标签；
  饼图 `radius:['40%','66%']` + 白色 2px 分隔。**慢接口柱图走红、排行柱图走主色**。
- **图表动画**统一 `animationDuration:900` / `animationEasing:'cubicOut'` /
  `animationDelay:function(idx){return idx*30;}`。
