# 开发与验证踩坑（zhixiaofa）

> 移植 / 数据 SQL / 全量替换 / headless-CDP 验证 / 写脚本纪律 / 验证工具清单。
> 主文件 `MEMORY.md` 有摘要与索引。

## 六、非 CSS 踩坑合集

### 6.1 移植（源项目 → 本项目）
- **移植前跑「纯超集」预检**：逐文件比对公开成员集合，确认我方无独有成员（否则会丢功能）。
- **★`shutil.copy2` 保留 mtime → Maven「假编译」**：源文件 mtime 比目标 `.class` 还旧时，
  maven-compiler-plugin 判定「源码没变」**静默跳过编译，输出却仍是 `BUILD SUCCESS`**。
  ⇒ ① copy2 后**必须** `os.utime(fp, (now, now))` 再编译；② **不能只看 BUILD SUCCESS**，
  要核验 `.class` 字节里能否搜到关键字符串（`b'orderBy' in open(cls,'rb').read()`），
  或看 `mvn` 输出有 `Compiling N source files` / `Nothing to compile`。**已列为移植后必做。**
- **★行为差异比编译错误隐蔽**：编译过、源项目单测过，但用户立刻感到「功能变少」。
  实例：源项目 `listCategories()` 只返回库中有数据的分类 → 下拉从 7 项掉到 6 项。
  ⇒ 移植后**逐方法对比语义**，重点看「过滤/隐藏/排序/分页」；凡是要「隐藏空数据」的，
  **优先保留本项目的全量行为**（演示时看到完整维度更重要）。
- **换 DAO 接口签名会连带打断调用方**，`mvn compile` 是最快的发现手段；能外科式改 2 行就别整文件替换。
- **两项目比对前必须剥离三层噪声**：`原始字节 → 行尾归一 → 去 ?v= → 压空白` 才是真差异。
  实测 164 文件里「看起来 150 个不同」，剥完只剩 67 个真差异。

### 6.2 数据 / SQL / 备份
- **★批量操作必须逐条检查返回值 + 事后逐项核对**。实测事故：`mysql -N -B` 输出是 CRLF，
  `.split('\n')` 让表名带 `\r` → 16 张表备份全失败，**输出却像成功**。
  ⇒ ① 读 `mysql -N -B` 一律先 `.replace('\r\n','\n').strip()`；② 批量后逐条 `SHOW`/`COUNT(*)`；
  ③ 备份必须比对源表与备份表行数。已固化为 `tools/db-backup.py`（自校验，不一致即报错退出）。
- **★触发「批量导入/同步/覆盖」前必须先建快照备份表**：`CREATE TABLE xxx_bak_<日期> AS SELECT * FROM xxx;`
  （实测同步 upsert 把 9 条手工分类改写掉）。
- **★`ON DUPLICATE KEY UPDATE` 的「部分列更新」最容易漏列**：注释列举的列 ≠ 实际该保护的列，
  审查时逐列问「这一列该不该被自动值覆盖」。本项目分类保护规则（**不要按 `source` 白名单**，
  导入数据里可能没有 `manual`）：`category = IF(category IS NULL OR category='', VALUES(category), category)`。
- **★定时任务会让「已修好的数据」重新变坏** ⇒ 遇到这类投诉要**同时修数据 + 修自动流程**。
- **数据库加列前先确认 DAO 映射方式**：按列名取值时中间插列不影响运行中的旧实例，按位置取值则立刻错乱
  （这决定「能否先迁库再重启」）。
- **`sql/` 变更配「迁移脚本 + 备份表 + 回滚段」三件套**，别只改 `schema.sql`（只对全新建库生效）。
- **MySQL 开 binlog + ROW 格式时被 DELETE 的数据可完整还原**：
  `mysqlbinlog --read-from-remote-server --base64-output=DECODE-ROWS -v --start-datetime`
  （Data 目录通常无读取权限），把 `### DELETE` 块翻成 `INSERT IGNORE`。两个解析坑：遇到下一个
  `### DELETE FROM` 必须先落盘上一块；`### WHERE` 是块内正常行不能当结束符。已实现 `tools/binlog-undelete.py`。
- **验证「恢复/导入脚本」的安全手法**：`SET FOREIGN_KEY_CHECKS=0; START TRANSACTION; <脚本>;
  <统计>; ROLLBACK;` —— 既证明语法与列数正确、又完全不改现状。
- **数据类投诉的排查顺序**：先 `COUNT(*)` 比数据（连备份表一起）→ 再比代码语义 → 再谈表现层。
  **「比之前少」里的「之前」往往不是本机历史，而是外部参照物**（别人的截图/环境），先问清参照物。
- **`sql/data.sql`（2026-09-22 起是完整版）**：1,638,893 字节，15 张表 4329 条 INSERT，
  其中 `law_article` **743 条 / 13 部法律 / 正文为空 0 条**。结构 = `USE` + `SET NAMES`
  + **15 组 (`DELETE FROM` + `ALTER TABLE … AUTO_INCREMENT=1`)** + 一行一条 INSERT；
  **无 DROP/CREATE TABLE**，列里已含 `seq/source/source_id`。**跑它 = 重置**（法条固定 743）。
  `law_article.source` = `flk_npc 524 / doc_import 219`。
- **备份表命名**：`_bak_beforefull20260922`（★最近）、`_bak_seed20260921`、`law_article_bak_presync`、
  `law_article_bak_{20260921,docximport}`；另有 `sql/restore-prereset-20260921.sql`（实测可用）。
- `tools/`（不依赖构建，直接 Python 跑）：`db-backup.py`、`binlog-undelete.py`、
  `import-law-docx.py`（官方 Word → 按「第X条」回填正文）、`ai-check.py`。

### 6.3 全量文本替换
- **★替换前必须「按语境分类」**，否则误伤。实测两类：① **演示数据里的自然语句**
  （`pages/qa.html` 的提问「两年竞业限制」被改成「两年保密与竞业限制」）；② **关键词表**
  （`LawSyncService.inferCategory` 里匹配正文的 `"竞业限制"` 被改掉 → 分支永久失效）。
  ⇒ 清单分三类：**该改**（常量数组/返回值/option/注释）、**不能改**（关键词表、标签词表、示例文本、
  演示问题）、**要精确改**（大 SQL 只改指定字段 —— 写元组感知拆分器，识别 `'...'`、`\` 转义、`''` 双写，
  按列名定位下标）。
- **分类名（2026-09-22 改为法条原文措辞，7 项）**：`劳动合同 / 劳动报酬 / 工作时间与休息休假 /
  社会保险 / 解除与终止 / 保密与竞业限制 / 其他`（出处《劳动争议调解仲裁法》第二条）。
  **5 个来源必须同步**：① 库表 4 张的 category；② `ZF.WORK_CATEGORIES`（`js/common.js` +
  `admin/admin-common.js` **两份**）；③ Java `LawArticleServiceImpl.CATEGORIES` +
  `LawSyncService.inferCategory` 返回值；④ `admin/qa.html` 与 `pages/qa.html` 的 `<option>`；
  ⑤ `sql/data.sql` 字段。另有 `ZF.QUIZ_CATEGORIES`（额外含「试用期」）与 `ZF.TEMPLATE_CATEGORIES`，不受影响。
- **`@文件名` 指向的文件不在项目里时先问完整路径**，别全盘搜同名文件后替用户假定
  （实测同名 `data.sql` 两份，一份 14 条一份 743 条，白跑一轮）。**文件名相同 ≠ 同一份文件。**

### 6.4 headless / CDP 验证
- **用 `workspace/rundetached.py`**：同一 Python 进程内「拉 Edge → `subprocess.run` 跑 node →
  只杀自己拉起的进程树」，解决「Bash 调用结束子进程被回收 → ECONNREFUSED」。
  **只杀自己的 pid**，别用 `taskkill /IM msedge.exe`（会连用户浏览器一起杀）。
- **node 脚本被 SIGTERM 时本环境看不到任何输出** → 用 `workspace/runnode.py` 包装跑。
- `cdp.js`：`connect` 返回 `{send, socket}`，**`send` 本身返回按 id 匹配的 Promise**；
  `send()` 返回**原始报文 `{id, result}`**，取值必须 `r.result.data` / `r.result.result.value`
  （`Runtime.evaluate` 是**双层 result**）。`httpGet(url)` **只接受完整 URL**；对 `/json/close`
  （返回纯文本）与 `/json/new`（**要求 PUT**）都会抛异常且**逃出调用方 try/catch** → 用原生 `http.request` 手写。
- **`CDP_PORT` ≠ `APP_PORT`**，两个端口分开命名（写错会报 `Invalid URL`，看起来像 CDP 挂了）。
- **★★「会被测脚本关掉的依赖」必须在后续用例前显式重启**。本项目已踩**三次**：
  「服务不可达」用例、文书用例的收尾、以及后来新增的用例排在它们之后 ——
  请求全部超时**静默降级**，断言失败但现象像「功能没接上」。
  ⇒ 结构性做法：抽一个 `start_mock()`，**每个需要它的用例开头显式调一次**，
  **不要依赖「前面起过就一直可用」**。排查这类假失败的第一步永远是**先看应用日志**。
- **★★测试写出来的持久化状态会污染后面的测试**：管理端「AI 设置」会写
  `<项目根>/config/ai.properties`，而它**优先于** classpath 配置 ——
  写了之后，E2E 改写 `target/classes/ai.properties` 指向 mock 就**完全不起作用**。
  ⇒ 跑前备份移走、跑后恢复，**跑器在 finally 里再兜一道删除**；
  不能只靠用例自觉。同理适用：临时 POM、`_mock_fail` 之类的开关文件。
- **★★「修好一个场景」≠「修好这个问题」——UX 缺陷要按「到达坏状态的所有路径」写验证**。
  实例：工作台「回不去」至少有三条路径（点开记录滚到结果卡 / 翻列表页签滚出视口 /
  双列下页签被历史面板盖住），第一轮只验证了第一条就宣布修好，用户立刻用第二条打脸。
  ⇒ 修复前先枚举路径，每条路径一条断言；**验证按问题写，不按修复写**。
- **★★「元素存在且可见」不等于「用户点得到」——要验证可点性必须用命中测试**。
  `document.elementFromPoint(元素中心)` 拿到的最上层元素，判 `t === el || el.contains(t)`。
  本项目实测：sticky 顶栏会盖住元素顶部 ~61px，被盖住的正是「卡片头部」的操作按钮；
  只断言 `display !== 'none'` + 在视口内**会通过，但功能是坏的**。参见 `verify-desk-return.js`。
- **★断言恒失败先怀疑探针自己**：本轮探针漏了 `o.errs` 字段，于是「全程无 JS 报错」一条
  在 4 个组合里全 FAIL（其余 48 条都过）。⇒ 探针字段与断言用的字段要能对上，
  `extra` 打印出 `undefined`/空值时，**先查探针，别急着改被测代码**。
- **★★`ZF.CTX` 是唯一公开的上下文前缀**：`CTX` 只在 `common.js` 的 IIFE 内，
  `admin-common.js` 等外部文件写裸 `CTX` 会抛 `ReferenceError`。
  而这个异常若发生在 `initAdminPage()` 的 `.then()` 里会被 **promise 链吞掉** ——
  控制台干净、`window.onerror` 不触发，页面表现为「侧栏/顶栏/统计卡/图表全都不渲染」。
  ⇒ 页面「全空却没报错」时，先断言 DOM 关键节点（sidebar / nav 数 / canvas 数）再顺链找人；
  **改公共 JS 后必须跑 `verify-admin-ui.js`（148 项）**，`node --check` 只保证语法。
- **★★判断某个行为「有没有」，必须 grep 出该函数的**所有**调用点并逐一看参数**。
  实例：`admin-common.js` 里两个按钮都调 `ZF.logout` —— 顶栏退出是裸调用（无确认），
  「换账号登录」传了文案；只看带文案那处就会得出「管理端一直有确认」的错误结论
  （本项目上一轮就据此改错了地方）。**同一文件里的另一处实现对，最容易让人以为整件事都对。**
- **★API 要「默认安全」，不要指望调用点自觉**。`ZF.logout(confirmText)` 原设计是
  「传了文案才确认」→ 漏传 = 直接退出（不可撤销动作的默认值不该是不确认）。
  改成「不传也确认、显式传 `''`/`false` 才豁免」后，这类漏传从「事故」变成「无害」。
  凡涉及**不可撤销动作 / 危险操作**的封装，默认值一律取安全那侧。
- **★裸写 Cookie 值不够，必须是 `JSESSIONID=<值>`**：只把值塞进 Cookie 头时，
  所有请求都会返回 **11301「请先登录」**，看着像鉴权代码坏了。用 CDP `Network.setCookie`
  时传的是**值**（框架自己拼名），用裸 http 请求时必须自己拼上前缀 —— 两种写法别混。
- **★「小工具函数写错」会让两列显示同一个值**，而且不会报错，只会让验证看起来做了其实没做。
  实例：源/运行时副本对比里把 `show()` 写成读同一侧。⇒ 小函数也要**断言它真的区分了两边**。
- **★★探针不要写成「超长字符串拼接 + `/* */` 块注释」**：只要前一条语句漏分号，紧跟的块注释就会让解析器
  把两条语句粘起来 → `SyntaxError: Unexpected identifier 'o'`，**9 个页面报同一个错**却看不出是哪一行。
  ⇒ 正确写法：**以独立函数源码注入**（`['window.__probe = function () {', '...', '};'].join('\n')`
  再 `ev(send, PROBE_SRC)` 定义、`ev(send, 'JSON.stringify(window.__probe())')` 取值）。
  **脚本自身的块注释里也不要写「星号加斜杠」字面量**。★另：**用裸 JS 去补丁「字符串数组式」探针会改坏文件**
  （本轮第三次踩）→ 要么把新行也写成数组元素，要么整体改成「真函数 + `.toString()` 注入」。
- **探针报错要先打印异常详情再下结论**：`ev()` 在异常时应返回
  `exceptionDetails.exception.description`，不要让调用方去 `JSON.parse('EXC:...')`。
- **`captureScreenshot` 全白/返回空的三个坑**：`captureBeyondViewport:true`、`clip:{scale:2}`、
  `deviceScaleFactor:2`。**可靠做法：只传 `{format:'png'}`**，尺寸交给 `Emulation.setDeviceMetricsOverride`
  的 `deviceScaleFactor:1`。
- **CSS 过渡在同一 JS 回合内不推进**：`el.click()` 后立刻读 `getComputedStyle` 得到的是**起始值**；
  必须 `await` 至少一帧 + `setTimeout(≥过渡时长)`，且 `Runtime.evaluate` 带 `awaitPromise:true`。
  导航后要**轮询等 `location.href` 变成目标页**。
- **弹窗遮罩「看起来没生效」多是截图时序假象**：先查 `.modal-backdrop` 是否存在、`opacity` 是否 0.5、
  `body.modal-open` 是否已加；Bootstrap 过渡 + headless 合成需要 ≥1.5s。
- **`Emulation.setEmulatedMedia({features:[{name:'hover',value:'none'}]})` 不足以翻转 `(hover:none)`**，
  必须叠加 `setTouchEmulationEnabled({enabled:true,maxTouchPoints:5})` 且 `mobile:true`。
- **`elementFromPoint` 命中判定不能双向 `contains`**：只允许 `t === e || e.contains(t)`
  （反向会把整行算命中，掩盖真实缺陷）；打点前逐个 `scrollIntoView({block:'center'})`。
- **`JSON.stringify(undefined)` 返回 `undefined`**（不是字符串），`.slice()` 会抛 TypeError。
  探针里写错标识符会让 IIFE 抛 SyntaxError → 返回 undefined → 只看到 JSON 解析失败。
- **headless 对 file:// 子资源有磁盘缓存**，`Network.setCacheDisabled` 不可靠；
  先用动态注入记号样式自证「读到的确实是当前文件」。
- **断言里的硬编码基线会过期，失败时先怀疑基线本身**。手法：用注入样式把**每轮改动分别停用**
  看能还原到哪个值（`diag-baseline.js`），别靠读代码推。
- **导航类 bug 取证四件套**：① `navigation.redirectCount`（>0 才是真 HTTP 重定向）；
  ② `document.referrer`；③ **页内 `fetch(同一URL)` 自测**（拿到正确内容 + `redirected:false`
  ⇒ 服务器没问题，是前端跳走的，这一步能一刀切开服务端/前端）；④ `Page.getNavigationHistory`
  （`location.replace` 不产生 history 条目）。
- **探针数组是 per-document 的**：跨文档导航后旧文档的 `window.__TRACE__` 一起销毁，
  在最终文档读到空数组**不代表中间没发生过跳转**。
- **鉴权类验证必须用真实会话，不要打桩**（桩只伪造 profile 会产生假阳性）：正解
  `POST /api/auth/login` 取 JSESSIONID → CDP `Network.setCookie({domain:'127.0.0.1', path:'/zhixiaofa'})`
  → 零桩导航。**已废弃 `audit-admin-server.js`**。
- **写管理端桩前必须逐页 grep 实际调的 URL**：不是所有管理页都走 `/admin/*`（`laws.html` 直接调
  `/law-articles/*`；`logs.html` 的图表是 `/admin/logs/stats`）。桩给错字段会表现为
  「`total` 有值、计数也对，但表格显示『没有找到匹配的记录』」（`ZF.initAdminTable` 读的是 **`page.list`**，
  不是 `page.rows`）。

### 6.5 写脚本 / 写验证脚本的纪律
- **`cat` / `ls` / `grep` / `tail` 在本环境都不可用**（缺 coreutils）→ 生成脚本文件一律用 Write 工具，
  不要用 `cat > file << 'EOF'`（会静默生成**空文件**）。文件操作与打印用 Python。
- **★本项目行尾不统一**：`js/common.js` 是 **CRLF**，`admin/*.html`、`css/app.css`、
  `admin/admin-common.js` 是 **LF**。同一次批量编辑里用换行符拼锚点，**只有 common.js 会静默匹配失败**
  （其余全成功，很容易漏看）。⇒ 每次改文件前先探测行尾
  （`raw.count(b'\r\n') == raw.count(b'\n')`），或用 `nl` 变量拼锚点。
- **Python 三引号字符串里写中文注释时不要用 ASCII 双引号**（如 `比"这个"`）→ 字符串提前闭合 →
  整个脚本 `SyntaxError` 一行都不执行。中文一律用「」。同理 `\uXXXX` 会被 Python 当转义解析，
  写文档举例时改用 `U+XXXX`。
- **多页签必须用「该页签自己的 send」**；循环实测要自查 `document.location.href`
  （否则 A 页探针读到 B 页文档，这类误报很常见）。用完关标签页。
- **JS 里不要写 Python 的 `%` 格式化**（`'x=%s' % (a,b)` → 整行 `NaN`，且不报错）。
- **★"会真退出登录 / 真改状态"的套件会污染后续套件**：`verify-confirm.js` 的退出用例真调
  `/auth/logout` 销毁服务端会话 → 后面**共用同一 cookie** 的套件全被弹到登录页
  （`verify-userpages` 从 17/17 掉到 10/17，看着像代码坏了）。⇒ **每个套件跑之前都重新登录**取全新会话。
- **★不同套件需要不同的 cookie 占位符映射**：`verify-login.js` 同时需要**用户与管理员两份**会话。
  统一约定：`__CK__`=主身份、`__CKU__`=用户、`__CKA__`=管理员。
- **★不要硬编码「与当天绑定」的断言**：`verify-trend.js` 曾断言「并集首尾是 09-08 / 09-22」，
  日期一过 09-23、「近 14 天」窗口前移、09-08 落到窗外 → 断言无辜失败。⇒ 改校验**结构性事实**
  （升序、无重复、末位与今天相差 ≤ 1 天）。
- **★「会被测脚本关掉的依赖」要在后续用例前显式重启**：`verify-llm-e2e.py` 的「服务不可达」用例
  shutdown 了 mock，排在它后面的小法庭/文书用例请求全部超时静默降级，
  **看起来像「模型没接上」**（日志里是 `request timed out`）。⇒ 后续用例前把 mock 起回来。
- **★网络白名单：只有 `api.github.com` 通**。`raw.githubusercontent.com` → SSL 握手超时；
  `github.com` 的 git clone → `Error in the HTTP2 framing layer`，强制 HTTP/1.1 后 502。
  ⇒ 取 GitHub 文件一律走 **contents API**（列目录 `Accept: application/vnd.github+json`、
  取内容 `…github.raw`、递归列全量 `git/trees/<branch>?recursive=1`）。校验完整性：算
  git blob sha = `sha1("blob " + len + "\0" + content)` 与 API 的 `sha` 比对。
  ⇒ 因此 **`npx skills add <owner>/<repo>` 在本环境装不了**，改用 contents API 手动落地同一来源的文件。
  国内模型 API（`token.sensenova.cn` / `api.sensenova.cn` / `api.deepseek.com` / `dashscope.aliyuncs.com` /
  `open.bigmodel.cn` / `api.moonshot.cn`）**均可直连**；`api.openai.com` 超时。
- **`skills-security-check` skill 本环境未安装** → 装第三方 skill 时按同标准**手工审计**（递归列目录、
  逐个读文件、看是否有脚本/hook/MCP 配置/执行指令/注入模式），给出 P0/P1/P2 结论。

## 九、验证工具（都在 `workspace/`）
- **黄金口径优先用**：`verify-admin-real.js`（真实管理员会话巡检管理端 9 页，退出码 0 = 9/9，
  跑法 `python workspace/rundetached.py 9363 verify-admin-real.js`）
- **改管理端后固定跑这六套**（缺一套都不行）：`verify-artd-motion`(24) + `verify-dashboard`(31) +
  `verify-trend`(7) + `verify-admin-ui`(142) + `verify-admin-real`(9) + `verify-userpages`(17)。
  ★**教训**：曾只跑后四套、**漏掉 `verify-dashboard`**，于是"画布投影压掉主角卡阴影"的 bug
  潜伏到下一轮才暴露。**改动影响面判断不准时，宁可全跑。**
  ★另一条：**断言口径会随设计变更过期**（曾同时出现 2 条口径过期 + 2 条真 bug）→
  断言失败时**先分清「代码坏了」还是「口径变了」**。
- 2026-09-23 新增：`verify-confirm.js`（确认框 22 断言，含「原生 confirm 全程未被调用」的 spy）、
  `verify-llm-e2e.py`（AI 接入 **46** 断言，自带 mock + 临时实例，覆盖问答/小法庭/文书/合同审查）、
  `verify-ai-admin.js`（管理端 AI 设置 **46** 断言，自带 mock 验连通成功与失败两条路）
  + 跑器 `run-ai-admin-verify.py`（起临时实例 + 出图）、`shot-admin-page.js`（**通用管理页截图器**，
  环境变量传 页面/端口/输出/探针，替代每次重写截图脚本）。
- 管理端：`verify-admin.js`、`shot-admin.js`、`diag-admin-nav.js`、`zc-stub-admin{2,-user}.js`。
  ⚠️ **新增 admin 页面前必须 grep 页面清单**：`verify-admin-ui.js` 的 `PAGES` 与
  `verify-admin-real.js` 的 `PAGES` **各有一份**，漏登记会出现「新页从未被验证过」的盲区。
- 用户端：`verify-home-{stat,scope,click,click2,runtime}.js`、`verify-pf-space.js`、
  `verify-shared-impact.js`、`verify-matrix.js`、`verify-{qa-hist,draft,kn,pf}.js`。
- 全站体检：`audit-ui.js` → `ui-audit.json`（7 页 × 4 视口 × 10 维度）；**改共享 CSS 前后各跑一次做基线**。
- 字体：`verify-font-e2e.js`(22)、`verify-fonts.js`、`diag-fontid-dom.js`（**判字体首选**）。
- 诊断：`diag-attribution.js`（逐条停用改动做 A/B）、`diag-baseline.js`（**定位过期基线**）、
  `diag-inline.js`、`diag-offset.js`、`probe-cache.js`。
- **`static-check.js`**：ES5 + 内联 JS 语法 + 版本号（自动探测）+ **CSS 花括号**。改完必跑。
- **脚本端口**：`verify-pf-space`/`verify-shared-impact` 用 9402；`verify-admin`/`shot-admin` 用 9351；
  `verify-admin-real`/`diag-admin-nav` 用 9363。跑前确认对应端口有 Edge。


# 子 Agent 经验（2026-09 沉淀）
- 价值在**发散方案**不在收敛根因；先 headless 拿量化数据，再喂同一份事实给 3 个不同视角；结论要复核（令牌名、类引用常有错）
