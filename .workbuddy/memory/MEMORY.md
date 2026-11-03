# zhixiaofa 项目约定

> 精简核心。专题**按需主动读**：CSS→`MEMORY-css.md`；移植/验证纪律→`MEMORY-dev.md`；AI→`MEMORY-ai.md`；
> 组件/页面范式→`MEMORY-ui.md`；排查过程→同日 `YYYY-MM-DD.md`。

## 一、硬约束
- Java Servlet + jQuery + Bootstrap 5 + MySQL；**无前端构建**，资源直放 `src/main/webapp/`
- **必须 ES5**（var+function；禁箭头/let/const/模板串）；BEM `.zf-块__元素--修饰符`；令牌在 `app.css :root`
- 公共库 `window.ZF`：get/post/put/del、toast/escape/confirm、validate、btnLoading、renderPager、tabs、enhanceSelect
- **改 css/js 后必升全站 `?v=`**：`workspace/bump-version.py`（含残留校验）。当前 **20261014c**。纯 Java 改动不动版本号

## 二、运行与后端
- `mvn tomcat7:run`（Tomcat 7.0.47，8080 `/zhixiaofa`，JDK17）；日志 `target/tomcat/logs/zhixiaofa.log`
- 静态改动立即生效；**Java/web.xml/配置必须重启**。`mvn -o` 只能 compile
- **不要 mvn clean**（删用户在跑的服务的 CATALINA_BASE）、**不要 kill 用户的服务**（子进程随工具调用回收）
- 验证 Java 改动：临时 POM（只改端口，**放项目根**）另起实例 → finally taskkill+删 POM。`pom.xml` 的 <configuration> 优先于 -D 属性
- 鉴权：未登录 11301 分两路——匿名白名单 GET=200+11301、白名单外=401+11301（断言都覆盖）；管理员校验在各 Servlet `requireAdmin()`
- 账号：admin/admin123；zhangsan…/123456
- 源项目分叉（`D://Users//Download//zhixiaofa-master//zhixiaofa-master`）**禁止整体覆盖**；copy2 后 os.utime 再编译并核验 .class 字节

## 三、AI 接入（要点；细节见 MEMORY-ai.md）
- 商汤 SenseNova，OpenAI 兼容；`ai.apiKey` 空=未启用=走规则实现（不报错不缺功能）
- **四处接入点全部失败降级**。**原则：判定与检索归本地，表述归模型**；合同审查回填用序号不用条款号
- **「AI 设置」保存即生效**：外部 `config/ai.properties` 优先于 classpath（⚠️ E2E 跑前移走跑后恢复）；apiKey 传空=不修改、清空传 `__CLEAR__`
- 提示词锁死【小节】三段式且禁 Markdown；stripMarkdown 只去装饰记号
- 验证：`verify-llm-e2e.py`（46）+ `verify-ai-admin.js`（46）

## 四、CSS 三铁律（详见 MEMORY-css.md）—— 每条都真栽过
1. **末尾追加的同特异性规则会架空上方规则** → 广撒网选择器先 grep 修饰类，用 :not() 排除；基态写在 @media 之前
2. **补既有 class 时布局属性必须写全**（display/flex-direction/flex-wrap/justify-content/position/margin；未写的从旧规则继承）
3. **判断规则是否生效只能看 getComputedStyle / cssRules**，读源码看不出来
- sticky 顶栏（高 64/68）会盖住 `scrollIntoView(block:'start')` 的目标头部 → 用 `scrollBelowTopbar()`
- 「可点」必须 elementFromPoint 命中测试；「存在且可见」不够

## 五、功能状态（详见 MEMORY-ui.md）
- 登录落点按角色分流（ZF.homeFor/goAfterLogin）；普通用户开管理页=站内提示页
- 排序白名单映射（6 域）；ZF.confirm 站内弹窗；**ZF.logout 默认确认**（不传参也确认）
- 管理端外壳：admin html body 带 `zf-admin-page zf-theme-ink`；`ZF.initAdminPage` 自动渲染侧栏（**10 项**）
- **邮箱注册**（2026-10-14）：send-register-code + scene=REGISTER 共用验证码表；邮箱已存在要报错（与找回密码语义相反）；验码在最后、消费在入库后；邮件未启用=开发模式回填 devCode；**邮箱必填**（兜底在 AuthServlet，Service 保持可空）。登录框支持「用户名或邮箱」。
  ⚠️ 坑：email_verify_code 表曾未建（库没跑迁移）；`[hidden]`+`.toggle()` 无效要用 `.prop('hidden')`。
- 管理端数据卡浅阴影比主题高是故意保留；用户端平面卡一律去阴影

## 六、页面范式（详见 MEMORY-ui.md）
- **A 工作台**（court/contract-review 同构）：返回路径三条全修过——卡头返回按钮+backToInput+scrollBelowTopbar；单列页签 sticky(top:64)；**双列 history absolute 必须 top:54px 让位页签**。验证 90 项
- 断点：1100 塌单列 / 820 字段单列 / 560 收紧

## 七、验证工具速查（纪律见 MEMORY-dev.md）
- 套件断言数：desk-return 90 / confirm 33 / llm-e2e 46 / ai-admin 46 / mailreg 20 / userpages 17 / dashboard 31 / trend 7 / artd-motion 24 / admin-ui 148 / admin-real 10
- **新增 admin 页面前 grep `verify-admin-ui.js` 与 `verify-admin-real.js` 的 PAGES 清单**（各一份，漏登记=新页从未被验证）
- 铁律：命中测试证可点性；被测脚本关掉的依赖后续用例前显式重启（start_mock）；测试写的持久化状态跑后必须恢复；断言恒失败先怀疑探针自己

子 Agent：先拿量化数据再喂多视角。
