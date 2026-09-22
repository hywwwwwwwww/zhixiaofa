
## 个人中心「空间利用率」二次改造（5 个 subagent 讨论轮）

用户在上一轮「左概览 + 右三页签」完成后反馈**「这一块空间利用率还是太低了」** ——
说明「页面不滚动」≠「视觉上填满」。实测旧版：内容区 832px 只用了 434px（52%），
左栏卡片下方空白 548px。

### 5 个视角的结果差异（本轮最有价值的部分）
- A 信息架构：3 列表单 + 资料完整度进度条 → **两处都被否决**
- B 表单栅格：用**数值反驳 A** —— 3 列每列 224px 而邮箱 maxlength=60（约 405px）必然溢出 → 保持 2 列
- C 产品价值：**主动列出 4 个「接口不存在」的陷阱候选**（最近登录 IP / 安全评分 / 学习进度 / 法条收藏榜），并否决「完整度」（分母全是选填 + 无闭环 = 伪指标）
- D 留白美学：**自己跑实测反驳「撑满」** —— 面板 366→718 会让末字段到按钮裂开 364px
- E 一致性/可达性：逐条判定 A/B/C/D 对错，给出整合方案

### 被实测推翻的 3 个判断（记忆点）
1. **subagent E 说 riskLevel 是 high/medium/low → 实测是中文「高/中/低」**。
   核对链：sql/data.sql 种子值全中文 + ContractDaoImpl 直读 risk_level 无枚举转换
   + ContractServiceImpl.overallLevel() 明确用 "高".equals(...) + Law 侧同样中文。
   **结论：直传 ZF.riskBadge 正确；E 说的「contract-review.html 现在就有 bug」是错的。**
2. **.zf-desk__other 方案（我第一版实现）根本是无效 CSS**。
   我把 class 打在了左栏的 #recent-box 上，写的却是 .zf-work > .zf-desk__other
   （要求它是 .zf-work 的**子元素**）—— 选择器与 DOM 不符，整条规则被浏览器丢弃。
   诊断手段：在页面里遍历 document.styleSheets 找 selectorText，返回 RULE FOUND: not-found
   —— 这比看 CSS 文件更快确认「规则到底有没有生效」。
3. **子 Agent 都会编「确定性」**。E 断言「aside 上 height:100% 解析不出确定值」，
   实测 computedHeight=495.688px（**是**确定值）。真正原因完全不同，见下。

### 等高的真正机制（本轮核心技术结论）
.zf-desk 是 grid，**两列同在 grid row 1**（实测 gridTemplateRows: 495.688px，
.zf-work 的 gridColumn/gridRow 都是 auto）。
- .zf-content 是**块级**容器（display:block），不是 flex → 无法把高度传给 .zf-desk
- 左栏 align-self:stretch + height:100% 只让**左栏**拉伸；行高由左栏自己决定，
  右列仍只按内容高（457）→ 反而左栏比右栏高 39px
- **正解**：.zf-work { align-self: stretch }（对齐行高）+ 当前可见面板
  :not([hidden]) { flex: 1 1 auto } 吃掉剩余空间 → 两侧底边齐在 586
  （min-height:0 必须写，否则 flex item 不会缩到内容以下）

### 两个页面级布局坑（会复发）
4. **常驻块不能放进 tabpanel**。账号信息塞进 #panel-profile 后：切到收藏/密码页签
   该面板变 hidden，卡片 607 → 496、左栏（等高）跟着塌 111px，页面明显跳动。
   改成 .zf-work 的**直接子元素**后三页签恒定。
5. **.zf-main 是 flex 列容器，.zf-content{flex:1} 会撑满视口** → 内页里所有
   .zf-content 的 flex 子项（.zf-desk 等）在 align-items:stretch 下
   computedHeight 都变成确定值。所以**不能靠 height===auto 判断「我的规则没生效」**；
   判据要用 alignSelf。窄屏（塌单列、页面开始滚动）时这一串高度会自动回落到内容高。

### 落地清单
- HTML：手机号去 zf-field--full；岗位改 zf-field--full 独占行；.zf-actions-end 移入
  .zf-fill-grid 末尾（跨列 + border-top 12px，沿用 .zf-desk__result-foot 先例）；
  昵称补 aria-required + aria-describedby（**全项目此前 aria-required 共 0 处**）；
  新增左栏「最近动态」（3 条，loadStats 的 pageSize 1→2，零新增接口）
  + .zf-work 层常驻「账号信息」5 行（全为 /auth/me 真字段，lastLoginAt 是真实字段：
  DB 有列、种子有值、UserServiceImpl.login 每次登录成功都会 updateLastLogin 回写）
- CSS：全部加 .zf-content--profile 作用域；1100 断点撤回 stretch 与 flex 分配
- JS：提交失败后同步 aria-invalid（ZF.validate 只加视觉 class）；
  ZF.truncate 补注释警告**必须先 escape 再截断**（反序会把 &amp; 从中间切断）

### 验证手段（新增脚本，均可复用）
- workspace/verify-pf-space.js：28 项断言（等高 / 栅格 / 最近动态 / 账号信息 / 页签回归 / 三视口）
- workspace/verify-shared-impact.js：18 项断言 —— **逐页确认 profile 专属类与作用域规则没泄漏**
- workspace/verify-runtime.js：注入 window.onerror + 覆写 console.error 收集运行时异常
- workspace/diag-equal-height.js：遍历 styleSheets 确认规则是否真的存在（诊断「规则被丢弃」）
- workspace/diag-budget.js：逐层算「可用高度 vs 已用高度」
- workspace/static-check.js：ES5 扫描 + 内联 JS node --check + 版本号（注意 ** 会误报粗体注释）
- **教训：verify-qa-hist.js 的参数是目录不是端口**（它硬编码 9344），传端口会静默「页面未加载」

### 数据
| 指标 | 改造前 | 改造后 |
|---|---|---|
| 右列占「视口 − top」 | 52%（434/832） | **74.2%（601/810）** |
| 内容底到视口底 | 375px | **208px** |
| 左栏卡片高 | 262px | **601px** |
| 左栏卡片底 → 视口底 | 548px | **208px** |

（本项目当前有效视口高 800 时：左栏 424 / 右列 601，railCard.h 601 → 424 的落差来自
 .zf-main 撑满视口，不是回归。1400×900 下 pageH 恒为 900，无纵向滚动。）

版本号 20260916m → **20260916s**（37 处）。回归：matrix 全 PASS、draft 三视口 OK、
qa-hist 四视口 PASS、kn 数据正常、shared-impact 18/18 PASS、runtime 0 报错。

### 子 Agent 经验补充
- 价值仍在「发散方案」，但**必须逐条实测复核**：本轮 3 个高置信断言被推翻（含我自己写的 CSS）
- 让 subagent 用**具体数值**互相反驳（B 用「邮箱 60 字符约 405px vs 3 列可用 198px」驳倒 A）
  比让它们各说各话有效得多
- 涉及「接口字段是否存在」的判断，**去读 sql/data.sql 种子值 + DAO Mapper**，
  这一条能一次性证伪/证实一整个方案
