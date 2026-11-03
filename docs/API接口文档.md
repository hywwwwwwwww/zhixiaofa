# 职小法 · API 接口文档

> 基于 Servlet 4.0 的 RESTful 风格接口 ｜ 统一响应格式 ｜ 部署上下文：`/zhixiaofa`

---

## 一、通用约定

### 1.1 请求

- 所有接口前缀：`/zhixiaofa/api`
- 传输格式：`application/json;charset=UTF-8`（**同时兼容** `application/x-www-form-urlencoded` 表单提交）
- 登录态：基于 `HttpSession`（Cookie `JSESSIONID`），登录成功后服务端建会话，会话有效期 60 分钟

> 兼容表单与 JSON 的实现：`JsonBodyFilter` + `JsonRequestWrapper` 会把 JSON 请求体的顶层标量字段
> 投影成 `request.getParameter()` 可读的参数，因此后端只有一套取参逻辑。

### 1.2 响应格式

所有接口（含错误）都返回统一结构：

```json
{
  "code": 10000,
  "message": "操作成功",
  "data": { },
  "timestamp": 1789390595821,
  "success": true
}
```

前端只需判断 `code === 10000`。

### 1.3 错误码定义

编码规则为 5 位数字 `AABCD`：`AA` 模块，`B` 类型（0 成功 / 1 参数 / 2 业务 / 3 权限 / 4 服务端），`CD` 序号。

| 码 | 含义 | 码 | 含义 |
|---|---|---|---|
| 10000 | 操作成功 | 11201 | 用户名或密码错误 |
| 10101 | 请求参数不合法 | 11202 | 账号已被禁用 |
| 10102 | 资源不存在 | 11203 | 用户名已被占用 |
| 10103 | 不支持的请求方法 | 11204 | 邮箱已被注册 |
| 10104 | 数据不存在 | 11205 | 原密码不正确 |
| 10201 | 业务处理失败 | 11206 | 不能删除当前登录账号 |
| 10202 | 重复操作 | 11301 | 请先登录 |
| 10203 | 当前状态不允许该操作 | 11302 | 没有操作权限 |
| 10400 | 服务器内部错误 | 11101 | 用户不存在 |
| 10401 | 数据库操作失败 | 10402 | JSON 解析失败 |
| 11207 | 验证码发送过于频繁 | 11208 | 验证码不正确或已过期 |
| 11403 | 邮件服务未启用 | 11404 | 验证码邮件发送失败 |

### 1.4 分页参数与返回

请求参数：`pageNum`（默认 1）、`pageSize`（默认 10，上限 100，由 `page.maxSize` 配置）

```json
{
  "list": [ ],
  "total": 25,
  "pageNum": 2,
  "pageSize": 10,
  "pages": 3,
  "hasNext": true
}
```

### 1.5 权限说明

| 标记 | 含义 |
|---|---|
| 🟢 | 匿名可访问 |
| 🔵 | 需登录 |
| 🔴 | 需管理员（`role = ADMIN`） |

未登录访问受限接口由 `AuthFilter` 直接返回 `11301`，管理员专属接口由 Servlet 内二次校验返回 `11302`
（过滤器只管「是否登录」，权限判断在业务侧，职责分离）。

---

## 二、认证与个人中心 `/api/auth`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/auth/login` | 🟢 | 登录，参数 `username`、`password`；成功后重建 Session 防会话固定攻击 |
| POST | `/api/auth/register` | 🟢 | 注册，参数 `username,password,nickname,email,phone,city,jobTitle` |
| POST | `/api/auth/forgot-password` | 🟢 | 找回密码第一步，参数 `email`：把 6 位验证码发信到该邮箱。未绑定了账号的邮箱**也返回成功**（防账号枚举）；同邮箱 60 秒冷却、24 小时 5 条，同 IP 24 小时 10 条 |
| POST | `/api/auth/reset-password` | 🟢 | 找回密码第二步，参数 `email,verifyCode,newPassword`：验证码 5 分钟有效、一次一用、连错 5 次作废；成功后换盐重写摘要 |
| POST | `/api/auth/logout` | 🔵 | 退出，销毁会话 |
| GET | `/api/auth/me` | 🔵 | 当前登录用户（响应不含 `password`/`salt`） |
| PUT | `/api/auth/profile` | 🔵 | 修改资料，参数 `nickname,email,phone,city,jobTitle,avatar` |
| PUT | `/api/auth/password` | 🔵 | 修改密码，参数 `oldPassword,newPassword`；成功后会话失效需重新登录 |

**登录示例**

```bash
curl -i -c cookie.txt -X POST http://localhost:8080/zhixiaofa/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin123"}'
```

```json
{ "code": 10000, "message": "登录成功",
  "data": { "id": 1, "username": "admin", "nickname": "系统管理员", "role": "ADMIN", "status": 1 } }
```

**注册校验规则**

- 用户名：4~20 位，字母开头，只含字母/数字/下划线
- 密码：6~32 位，**必须同时含字母和数字**
- 邮箱、手机号：格式校验（`1[3-9]\d{9}`），选填但填了就必须合法
- 用户名、邮箱唯一性由应用层校验 + 数据库唯一索引双重保障

---

## 三、用户管理 `/api/users`（🔴 管理员）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/users?keyword&role&status&pageNum&pageSize` | 用户分页（关键词模糊匹配用户名/昵称/邮箱/手机号） |
| GET | `/api/users/{id}` | 用户详情 |
| PUT | `/api/users/{id}` | 修改指定用户资料 |
| PUT | `/api/users/{id}/status` | 启用/禁用，参数 `status`（1/0） |
| PUT | `/api/users/{id}/role` | 修改角色，参数 `role`（USER/ADMIN） |
| PUT | `/api/users/{id}/password` | 重置密码，参数 `newPassword` |
| DELETE | `/api/users/{id}` | 删除用户（不能删自己） |

---

## 四、法条 `/api/law-articles`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/law-articles?keyword&category&pageNum&pageSize` | 🟢 | 检索：关键词走 ngram 全文索引，可与分类组合 |
| GET | `/api/law-articles/categories` | 🟢 | 分类列表 |
| GET | `/api/law-articles/{id}` | 🟢 | 法条详情 |
| POST | `/api/law-articles` | 🔴 | 新增，参数 `lawName,articleNo,category,title,content,keywords,effectiveDate` |
| PUT | `/api/law-articles/{id}` | 🔴 | 修改 |
| DELETE | `/api/law-articles/{id}` | 🔴 | 删除 |
| GET | `/api/law-articles/stats` | 🔴 | 分类分布统计 |

---

## 五、智能问答 `/api/qa`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/qa` | 🔵 | 提交咨询，参数 `question`（≥4 字）、`category`（可空，自动推断） |
| GET | `/api/qa/mine?pageNum&pageSize` | 🔵 | 我的问答分页 |
| GET | `/api/qa/{id}` | 🟢 | 详情（含引用法条与收藏状态） |
| POST | `/api/qa/{id}/like` | 🔵 | 点赞 |
| GET | `/api/qa?keyword&category&status&pageNum&pageSize` | 🔴 | 后台问答分页（含提问人昵称） |
| PUT | `/api/qa/{id}/answer` | 🔴 | 补充/修改回答，参数 `answer` |
| DELETE | `/api/qa/{id}` | 🔵 | 删除（本人或管理员） |
| GET | `/api/qa/stats?days=14` | 🔴 | 返回 `{daily, category, hot}` |

**核心业务：`POST /api/qa` 的处理链路**

1. 校验问题长度与内容；
2. 抽取检索关键词（标点切分 + 2 字滑窗），按优先级匹配分类关键词表推断 `category`；
3. 用 `MATCH ... AGAINST` 在法条表召回最多 3 条；召回为空时退回按分类取法条；
4. 拼装三段式回答：`【初步结论】` + `【法律依据】`（逐条列出法条原文）+ `【建议步骤】`；
5. **在同一事务内**写入 `qa_record` 与若干条 `qa_reference`（相关度按召回顺序 1.00 / 0.90 / 0.80 递减），
   保证「问答记录」与「法条引用」要么都成功、要么都回滚。

**响应示例（截断）**

```json
{ "code": 10000, "message": "已回答",
  "data": {
    "id": 13,
    "question": "公司拖欠我三个月工资，还没签劳动合同，我该怎么办？",
    "category": "工资报酬",
    "status": 1,
    "answer": "根据您描述的情况，初步分析如下：\n\n【初步结论】…【法律依据】…【建议步骤】…",
    "references": [
      { "id": 5, "lawName": "中华人民共和国劳动合同法", "articleNo": "第三十八条", "content": "…" },
      { "id": 7, "lawName": "中华人民共和国劳动合同法", "articleNo": "第四十七条", "content": "…" }
    ]
  } }
```

---

## 六、合同智能审查 `/api/contracts`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/contracts` | 🔵 | 提交并审查，参数 `fileName,contractType,partyA,partyB,signDate,content` |
| GET | `/api/contracts/mine?pageNum&pageSize` | 🔵 | 我的合同分页 |
| GET | `/api/contracts/{id}` | 🔵 | 详情（含风险点明细，本人或管理员） |
| GET | `/api/contracts?keyword&riskLevel&status&pageNum&pageSize` | 🔴 | 后台分页 |
| DELETE | `/api/contracts/{id}` | 🔵 | 删除（本人或管理员） |
| GET | `/api/contracts/stats?days=14` | 🔴 | 返回 `{riskLevel, type, daily}` |

**审查规则引擎**：内置 12 条规则（高风险 5 条 / 中风险 5 条 / 低风险 2 条），
每条规则 = 「风险等级 + 触发关键词 + 条款编号 + 风险说明 + 修改建议 + 关联法条 ID」。
命中即生成一条 `contract_risk`，并摘取关键词附近的原文作为「问题条款」片段；
整体等级判定：有高风险即「高」，否则有中风险为「中」，否则「低」。

---

## 七、AI 小法庭 `/api/court-cases`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/court-cases` | 🔵 | 提交推演，参数 `title,description`（≥10 字）、`caseType`（可空自动推断） |
| GET | `/api/court-cases/mine?pageNum&pageSize` | 🔵 | 我的推演记录 |
| GET | `/api/court-cases/{id}` | 🟢 | 详情 |
| GET | `/api/court-cases?keyword&caseType&pageNum&pageSize` | 🔴 | 后台分页 |
| DELETE | `/api/court-cases/{id}` | 🔵 | 删除 |
| GET | `/api/court-cases/stats?days=14` | 🔴 | 返回 `{type, probability, daily}` |

**推演模型（可解释的启发式，非黑盒）：**

- 基准胜诉率：拖欠工资 90% / 社保 85% / 违法辞退 78% / 加班费 72% / 其他 70%
- 证据修正：描述中出现书面/邮件/微信/录音/流水/考勤等正向词，每项 +2%（最多 5 项）；
  出现口头/无证据/记不清等不利词，每项 −3%（最多 5 项）
- 概率钳制在 35% ~ 97%
- 赔偿区间：从描述中提取金额（支持「8000元」「1.2万」），按月工资 × 类型倍率计算
  （违法辞退 2~6 个月、拖欠工资 1~2 个月、加班费 0.5~1.5 个月、社保为 0）

---

## 八、法律文书起草 `/api/doc-templates` `/api/doc-records`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/doc-templates` | 🟢 | 前台可用模板列表 |
| GET | `/api/doc-templates/{id}` | 🟢 | 模板详情（附 `placeholders` 占位符列表） |
| GET | `/api/doc-templates?page=1&keyword&category&pageNum&pageSize` | 🔴 | 后台模板分页（需带 `page` 参数） |
| POST | `/api/doc-templates` | 🔴 | 新增模板 |
| PUT | `/api/doc-templates/{id}` | 🔴 | 修改模板 |
| DELETE | `/api/doc-templates/{id}` | 🔴 | 删除（已被使用的模板会返回可读提示） |
| POST | `/api/doc-records` | 🔵 | 生成文书，参数 `templateId` + `params`（`{占位符名: 值}`） |
| GET | `/api/doc-records/mine?pageNum&pageSize` | 🔵 | 我的文书分页 |
| GET | `/api/doc-records/{id}` | 🔵 | 文书详情 |
| PUT | `/api/doc-records/{id}` | 🔵 | 编辑标题与正文 |
| DELETE | `/api/doc-records/{id}` | 🔵 | 删除 |
| GET | `/api/doc-records?keyword&userId&pageNum&pageSize` | 🔴 | 后台分页 |

**模板渲染**：模板正文用 `${字段名}` 作占位符，服务端用正则 `\$\{([^}]+)\}` 逐个替换；
未填写的字段替换为 `（此处待补充：字段名）` 而不是留空，方便用户一眼看出哪里还要补。

---

## 九、普法知识广场 `/api/knowledge` `/api/quiz`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| GET | `/api/knowledge?category&keyword&pageNum&pageSize` | 🟢 | 文章分页（`status` 默认 1 只看已发布） |
| GET | `/api/knowledge/{id}` | 🟢 | 详情，同时累计阅读量，返回标签列表 |
| POST | `/api/knowledge/{id}/like` | 🟢 | 点赞 |
| GET | `/api/knowledge/tags` | 🟢 | 全部标签 |
| POST | `/api/knowledge?tags=a,b` | 🔴 | 新增文章（标签走查询串，逗号分隔；不存在的标签自动建字典） |
| PUT | `/api/knowledge/{id}?tags=a,b` | 🔴 | 修改文章 |
| DELETE | `/api/knowledge/{id}` | 🔴 | 删除 |
| GET | `/api/knowledge/stats` | 🔴 | 分类分布 + 阅读量排行 |
| GET | `/api/quiz?limit=10` | 🟢 | 随机抽题（**不返回正确答案**） |
| POST | `/api/quiz/submit` | 🟢 | 交卷判分，参数 `answers: {"题号":"A"}` |
| GET | `/api/quiz/page?keyword&category&pageNum&pageSize` | 🔴 | 后台题库分页 |
| POST/PUT/DELETE | `/api/quiz` | 🔴 | 题目增删改 |

**判分返回**

```json
{ "code": 10000, "data": {
  "total": 10, "rightCount": 8, "wrongCount": 2, "score": 80, "level": "良好",
  "details": [
    { "questionId": 1, "question": "…", "yourAnswer": "A", "correctOption": "B",
      "correct": false, "explanation": "《劳动合同法》第十九条…" }
  ] } }
```

---

## 十、收藏 `/api/favorites`

| 方法 | 路径 | 权限 | 说明 |
|---|---|---|---|
| POST | `/api/favorites` | 🔵 | 收藏，参数 `targetType`(QA/ARTICLE/LAW/DOC)、`targetId` |
| DELETE | `/api/favorites?targetType&targetId` | 🔵 | 取消收藏 |
| POST | `/api/favorites/toggle` | 🔵 | 切换，返回 `true`=已收藏 / `false`=已取消 |
| GET | `/api/favorites/exists?targetType&targetId` | 🔵 | 查询是否已收藏 |
| GET | `/api/favorites?targetType&pageNum&pageSize` | 🔵 | 分页，返回项带 `targetTitle`/`targetSummary` |
| GET | `/api/favorites/stats` | 🔵 | 我的收藏类型分布 |

---

## 十一、后台看板与日志 `/api/admin/*`（🔴）

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/admin/stats/overview` | 指标卡：用户/问答/合同/推演/文书/模板/文章/题目/法条/风险点/日志数量 + 角色分布 |
| GET | `/api/admin/stats/trend?days=14` | 趋势：`series` 内含 `labels,users,qa,contracts,docs,cases,requests` 多序列 |
| GET | `/api/admin/stats/distributions` | 分布：问答分类、合同风险、合同类型、案件类型、案件胜诉率、文章/法条/题库分类、用户地域 |
| GET | `/api/admin/stats/rankings` | 排行：热门问题、被引法条、高频风险条款、模板使用、文章阅读、接口调用 |
| GET | `/api/admin/stats/slow-apis?limit=8` | 接口平均耗时（性能监控） |
| GET | `/api/admin/stats/pool` | **自研连接池运行指标**：minIdle/maxTotal/created/idle/borrowed + JDBC URL 等配置 |
| GET | `/api/admin/logs?keyword&method&pageNum&pageSize` | 操作日志分页 |
| GET | `/api/admin/logs/stats?days=14` | 返回 `{daily, uri, slow}` |
| DELETE | `/api/admin/logs/clean?days=30` | 清理 N 天前日志 |

---

## 十二、操作日志与安全说明

### 12.1 日志记录

`OperationLogFilter` 拦截 `/api/*`，记录：用户、动作描述、HTTP 方法、URI、客户端 IP、
参数摘要（`password`/`token`/`salt` 等字段以 `***` 记录）、耗时、HTTP 状态码。

**异步落库**：日志对象进有界队列（容量 2000），由单线程消费者写库，
队列满时丢弃日志而不是阻塞用户请求 —— 记录日志绝不能拖慢业务响应。

### 12.2 安全措施汇总

| 风险 | 措施 |
|---|---|
| SQL 注入 | 全部使用 `PreparedStatement` + 占位符；动态条件由 `SqlBuilder` 拼接**常量列名与 `?`**，用户输入只进参数槽 |
| 密码泄露 | 加盐 SHA-256 摘要存储；`SysUser.password/salt` 标 `@JsonIgnore`，任何接口都不返回 |
| 会话固定攻击 | 登录成功后 `invalidate()` 旧会话再建新会话 |
| XSS | 前端所有后端数据经 `ZF.escape()` 转义；后端 `StringUtil.stripHtml` 作为兜底 |
| 越权访问 | `AuthFilter` 控制登录态；Service 层校验资源归属（只能操作自己的数据） |
| 恶意分页 | `pageSize` 上限 100，由 `page.maxSize` 配置控制 |
| 敏感操作留痕 | 操作日志记录全部写操作 |
| 信息泄露 | 登录失败统一提示「用户名或密码错误」，不暴露账号是否存在 |
