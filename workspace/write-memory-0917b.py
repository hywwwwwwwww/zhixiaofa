# -*- coding: utf-8 -*-
"""把 2026-09-17 第二轮改造的日志追加到工作日志（append-only）。

【为什么写成文件】本环境 bash shim 缺 coreutils，且内联 python -c 里的
反引号 / 尖括号 / $ 会被 shell 抢先解释（本次实测报了一串
`a[href]: command not found`）。长文本一律落到文件再执行。
"""
import io

P = r'D:\Program Files (x86)\gitee\zhixiaofa\.workbuddy\memory\2026-09-17.md'

ADD = '''

---

## 2026-09-17 · 首页「最近问答 / 新人必看」列表项可点击化

### 用户诉求
截图框选首页底部两块列表（最近问答 / 新人必看），说「这里的应该也是可点击的」。

### 实测现状（改造前）
- 9 个列表项**全是纯 div**：`itemCursor=auto`、`itemAnchorN=0`、无 hover、
  无下划线 —— 零点击能力，也没有任何「可点」的视觉线索
- `#qa-list` 内 `a[href]` 数量 = 0（连一个链接都没有）

### 用户选择（AskUserQuestion）
1. 点击行为 → **原地展开详情**（问答项内联展开；文章项弹详情弹窗）
2. 引用徽标 → **展开显示引用的法条名**

### 关键前置发现（省掉一次请求）
- `/qa/mine` **列表接口已经 `fillReferences(list)`**（`QaServiceImpl.myPage` 第 155 行），
  即列表项自带完整 `references`，展开详情**不需要额外请求**
- `QaRecord.references` 类型是 `List<LawArticle>`，每项字段：
  `{ lawName, articleNo, category, title, content, keywords, effectiveDate }`
  （`model/LawArticle.java`）
- **全站四类内容都没有「按 id 深链」的用户端路由**：`qa.html` 的 `jumpToPair`、
  `knowledge` 的 `openArticle` 都是页内弹窗/滚动，`location.hash` 与
  `searchParams` 出现次数**均为 0**。所以「跳到 qa.html 并自动打开第 3 条」
  现在做不到，必须新增路由支持
- `.zf-ans__sec` / `.zf-ans__note`（回答里的【】小标题与末尾提示）
  **在 app.css 第 776-780 行已有全站定义**，不是 qa.html 私有的

### 落地
**html（pages/home.html）**
- 两块列表容器加注释说明交互；文章详情弹窗从 knowledge.html 搬来，
  按钮文案与之一致（点赞 N / 收藏 / 关闭），跳过标签与自测题
- `loadRecentQa`：列表项加 `tabindex=0`、`aria-expanded`、`data-id`，
  标题后挂 `.zf-home-item__caret`；detail 区**初始为空 + hidden**（懒渲染）
- `loadTips`：列表项改成**真 a href="#article-{id}"** —— 白拿原生键盘可达性，
  再 `preventDefault` 掉跳页
- 新增 `answerHtml` / `refsHtml` / `setQaOpen` / `setRefsOpen` /
  `bindHomeLists` / `openArticle` / `setFavState` / `bindArticleModal` / `attachQaData`

**css（app.css 末尾，`.zf-content--home` 作用域）**
- 整项：`cursor:pointer` + 负 margin 外扩 10px 做通栏 hover 底色
  `rgba(14,17,21,.06)`；`:focus-visible` 焦点环
- 文章项是 a，要压掉默认链接色与下划线（`color:inherit; text-decoration:none`）
- 徽标改 button，要压掉浏览器默认按钮样式
- 展开区内层左侧 2px `--zf-primary-light` 竖线

### 踩坑
1. **【本轮最大的坑】`.zf-list__item` 是 `display:flex`（row 方向），
   展开区作为「第 3 个 flex 子元素」被排到了 main 的右边**，
   等于凭空加了一列 → `.zf-list__main` 的 `flex:1` 被压到几乎没宽度，
   标题**变成一个汉字一行**（竖排）。
   修法：`.zf-list__item { flex-wrap: wrap }` + `.zf-home-detail { flex: 0 0 100% }`。
   **不能用 `flex-direction:column`** —— 那会把 meta（时间+徽标）从右侧挪到下面，
   与不带展开区的文章列表版面不一致。
   —— 这个 bug 读 CSS 看不出来，**必须看截图**（101-home-qa-open.png 里最明显）
2. **`cdp.js` 的 `httpGet(url)` 只接受完整 URL**，不是 `(port, path)`。
   传 `(port, path)` 时 Node 把数字当 URL，静默回落到 `127.0.0.1:80`
   → `ECONNREFUSED`，报错信息里完全看不出是参数写错。
3. **`cdp.connect` 返回 `{send, socket}`，没有暴露 message 事件订阅**。
   别自己 `socket.on('message')` 过滤 id —— `send` 本身就返回按 id 匹配的 Promise。
4. **本环境 bash shim 缺 coreutils，node 脚本被 SIGTERM 时看不到任何输出**。
   新建 `runnode.py`（Python subprocess 包装）才能拿到真实 returncode 与 stdout。
5. **弹窗遮罩「看起来没生效」是截图时序假象**：实测 `.modal-backdrop`
   确实已插入且 `opacity:0.5`、`z-index:1050`、`body.modal-open` 已加。
   Bootstrap 的 .15s 过渡 + headless 合成需要时间，截图要等 1.5s 以上。
   —— 差点为一个没坏的东西改代码。

### 归因链（本轮最重要的方法论产出）
`verify-home-stat.js` 里「1440 页面不比改造前更高」这条断言**第二次**失败了
（`docH=1229`，硬编码上限 `1220+2`）。三次实验逐次收紧：
1. `diag-home-height.js`：逐条停用新样式 → 全部 Δ=0，高度纹丝不动
2. `diag-home-ab.js`：停样式 Δ=0、删新 DOM 节点 Δ=0 →
   **证明可点击改造对页面高度零贡献**
3. `diag-baseline.js`：把两轮改动分别停用
   - 现状 **1229**
   - 停掉可点击样式 **1229**（Δ=0）
   - 再停掉指标卡样式（还原通用 `.zf-stat`）**1250**
   → 指标卡改造的真实贡献是 **1250→1229 = 21px**，而非上轮记的 42px。
   **1220 是上一轮记录时多算 9px 的结果，那个基线本身就是错的。**
   断言基线改用同轮实测的 1229。
- 另排除一个嫌疑：徽标从 span 改 button 带来的默认 padding。
  实测中和 padding 后 `badgeH` 21→17、`metaH` 43→39，但
  **`itemH` 与 `docH` 纹丝不动（90 / 1229）** —— itemH 由正文
  `-webkit-line-clamp:2` 决定，是内容固有高度，不受 meta 影响。

### 验证（全绿）
- `verify-home-click.js` **42/42**（可点击线索 / 懒渲染 / 展开收起 / 徽标独立开关 /
  弹窗 / 溢出）
- `verify-home-click2.js` **23/23**（hover 真实底色 + 强度不小于 .05 /
  Enter 与 Space 键盘可达 + Space 已 preventDefault / favorited 回显 /
  4 档窄屏无溢出）
- `verify-home-stat.js` 58/58、`verify-home-scope.js` 14/14（profile 与 admin 未受影响）
- 回归：`verify-pf-space.js` 28/28、`verify-shared-impact.js` 18/18
- `static-check.js`：ES5 PASS、内联 JS 18/18、版本号 37 处一致、花括号 672/672
- 版本号 `20260916t → 20260916u`
- **合计 183 条断言 PASS / 0 FAIL**

### 截图
- `shots/100-home-lists-idle.png`（常态，箭头+徽标按钮可见）
- `shots/101-home-qa-open.png`（问答展开，含【】小标题 + 提示脚注）
- `shots/102-home-refs-open.png`（法条清单展开）
- `shots/103-home-article-modal.png`（文章弹窗，遮罩正常）
- `shots/104-home-hover.png`（hover 通栏高亮）

### 脚本修正
- `zc-stub-home.js`：`references` 从空对象补成真实 `LawArticle` 结构（5 条法条样本）；
  加 `/knowledge/:id` 详情路由（**必须排在 `/knowledge` 列表规则之前**，否则被吃掉）；
  文章补 `content` / `likeCount` / `favorited`
- `verify-home-click2.js`：一条断言笔误修正（把第 3 篇标题写成含「两个月工资」，
  那实际是第 4 篇的标题）
'''

s = io.open(P, encoding='utf-8').read()
with io.open(P, 'w', encoding='utf-8', newline='') as f:
    f.write(s + ADD)
print('OK  old len =', len(s), ' new len =', len(s + ADD))
