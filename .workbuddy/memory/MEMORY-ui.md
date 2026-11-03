# UI 组件与页面范式细节

## 公共组件
- **登录落点按角色分流**：`ZF.homeFor(user)`（ADMIN→`/admin/index.html`，否则 `/pages/home.html`）
  + `ZF.goAfterLogin(user)`（优先回 `zf_redirect`）。接线 4 处：index.html 根入口、login.html 三处。
  普通用户开管理页 → 站内提示页（`renderAdminDenied`，**刻意不跳用户端**）；普通用户打需管理员接口 → 后端 11302。
  排查「管理端混入用户功能」：先 Grep admin 文件里指向 /pages/* 的链接（本项目零命中），
  别凭「看到用户界面」断定混了 —— 多半是登录后没进后台。
- **服务端排序**（2026-09-22 移植）：`SqlBuilder.orderBy(sortName, order, whitelist, fallback)` ——
  ORDER BY 列名无法 `?` 参数化，用「前端列名→真实列名」白名单映射，查不到回退，**永不拼接用户输入**。
  链路：Servlet → Service(7参) → Dao。覆盖 users/qa/contracts/knowledge/quiz/logs。
- **`ZF.enhanceSelect()`** 自定义下拉：保留原生 select 取值与 change，仅视觉隐藏
  （`position:absolute;width:1px;opacity:0;clip:rect(0 0 0 0)`，**绝不能 display:none 否则取不到值**）。
  ① 弹层每次展开按当前 options 重建；② 选项用 mousedown；③ `.val('')` 不触发 change → 400ms 轮询同步文本。
  接线在 admin-common.js 的 initAdminPage（管理端自动生效），用户端暂未启用。
- **`ZF.confirm` 站内二次确认**（2026-09-23）：原生 confirm 已替换为 Bootstrap Modal，**API 不变
  （Promise<boolean>）⇒ 全站 22 个调用点一行未改**。`\n`→`<br>`；ESC/遮罩/关闭=取消；焦点在「确定」；
  `opts.danger` 确定按钮走朱色；bootstrap 不可用时退回原生。文案允许含 HTML（调用方自行 escape）。
- **`ZF.logout()` 默认就要确认**（安全默认）：不传参数也确认；传字符串=自定义文案；
  显式 `''`/`false` 才不确认。★曾因「只看到 admin-common.js 里带文案的那处调用」误判
  「管理端一直有确认」⇒ **判断某行为有没有，必须 grep 该函数所有调用点并逐一看参数**。
- `login.html` 的「先逛逛首页」已删（死链）。⚠️ `index.html` 里还有一个同款（默认隐藏的降级入口），未处理。

## 页面范式
- **A 工作台**（court、contract-review，同构改一个查另一个）：返回路径**三条都修过**（2026-09-23）：
  ① 点开记录滚到结果卡 ⇒ 结果卡**头部**返回按钮（`#result-back`）+ `backToInput()`
     （切回第一个页签 + 把左栏滚回视口 + 聚焦输入框；底部「再推演一次」共用同一函数）
     + `scrollBelowTopbar()`（sticky 顶栏高 64/68 会盖住 block:'start' 的目标头部）；
  ② 单列（≤1100px）翻列表 ⇒ 页签栏 sticky `top:64px`；
  ③ 双列（>1100px）⇒ **`.zf-desk__history` absolute 必须 `top:54px` 让位页签**（页签40+间距14，
     否则整条盖住页签），另有页签 `z-index:2` 安全网。**页签高度改了要同步 54px**（CSS 有注释）。
  验证 `verify-desk-return.js`（**90**，3 视口 × 2 页 × 逐页签 elementFromPoint 命中测试）。
- **B 左参考/右页签**（doc-drafting）：左模板库 sticky，右 `.zf-work` 三页签（max-height 内部滚动）。
- **B2 左概览/右页签**（profile）：hidden 面板 + 锚点跳转必须在 `bindAnchorLinks` 前抢绑定改 `tabs.select()`。
- **C 卡片流**（home）：首页本来就纵向滚动；列表项可点击；「引用N条法规」徽标是独立开关；展开区懒渲染。
- **D 筛选+网格**（knowledge）：整卡可点、卡内不放可聚焦元素。
- **E 管理端外壳**（admin/ 10 页，与用户端完全分离）：body 带 `zf-admin-page zf-theme-ink`，
  app.css 末尾有对应校正块。**整目录覆盖 admin 页面必须把 body class 改回来**。
  每页只需 `ZF.initAdminPage({active,title,sub})`。窄屏（≤1100）侧栏转 fixed 抽屉+汉堡+遮罩。
- 通用断点：1100 塌单列 / 820 字段单列 / 560 收紧。
- 筛选胶囊统一 `.zf-chips`+`.zf-tag`+`aria-pressed`；指标卡三套尺寸刻意分主次（首页>后台>个人中心）。
- **全站四类内容都没有「按 id 深链」的用户端路由**，要做「跳到某页并打开第 N 条」必须新增路由。
