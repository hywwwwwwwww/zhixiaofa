# AI 大模型接入（商汤 SenseNova，2026-09-23）

> 现状：**能力已就位但默认未启用** —— `src/main/resources/ai.properties` 的 `ai.apiKey` 为空，
> `AiConfig.isEnabled()=false`，全站自动走原规则实现（**不会报错、功能不缺**）。

- **零新依赖**：HTTP 用 JDK 17 自带 `java.net.http.HttpClient`，JSON 用已有 Jackson，`pom.xml` 未改。
  协议走 **OpenAI 兼容**（`baseUrl + /chat/completions`），换厂商只改配置。
- **新增文件**：`ai.properties`（配置+密钥）、`util/AiConfig.java`（key 只显示「(已填)」）、
  `service/impl/LlmClient.java`（唯一出口 `chat(system,user)`，**不做兜底、一律抛异常**；
  `max_tokens` 不被认时自动换 `max_new_tokens` 重试一次；`stripMarkdown()` 清洗装饰记号，
  **不动文字与有序编号**）、`tools/ai-check.py`（自检 + 源/运行时副本漂移检查）。
- **四处接入点，全部「失败降级回原规则实现」**（只 log.warn 不抛给用户 ⇒ 模型挂了功能不挂）：

  | 能力 | 位置 | 模型负责 | 算法/本地负责（不可交给模型） |
  |---|---|---|---|
  | 法律问答 | `QaServiceImpl.composeAnswerWithFallback` | 成文表述 | 召回是本地全文检索，模型只拿召回法条当上下文 |
  | 小法庭 | `CourtCaseServiceImpl.buildSummary` | 推演表述 | 胜诉概率/赔偿区间/案件数由算法算出，提示词明令不改数字 |
  | 文书起草 | `DocServiceImpl.aiFillMissing` | 补用户留空的字段 | 模板固定条款一字不动，只替换 `（此处待补充：X）` |
  | 合同审查 | `ContractServiceImpl.enrichByAi` | 重写风险的说明与建议 | 等级/条款号/法条由 RULES 判定；`scan()` 保持纯粹（单测依赖），AI 是外层 |

  ⇒ **通用原则：判定与检索归本地，表述归模型。**
- **合同审查回填用「序号」不用「条款号」**：同一份合同「第 6 条」可能判出两处风险，按条款号会串。
  模型返回 `[{i, desc, suggestion}]`，按 `i`（1 起）取。
- **管理端「AI 设置」页**（`/admin/ai-settings.html` + `AdminAiServlet` + 侧栏第 10 项）：
  状态主角卡（**已生效/未生效** + 缺什么 + 配置来源）+ 配置表单 + 连通测试（走真实链路）+ 说明卡。
  徽标措辞刻意区别于「总开关」（开关=启用/停用，徽标=已生效/未生效）。
- **★两级配置、保存即生效（免重启）**：① `<项目根>/config/ai.properties`（存在即优先，管理端 save 写入）
  ② classpath 默认。项目根靠「向上找 pom.xml」定位（tomcat7:run 工作目录是 target/tomcat，写那会被 clean 删）。
  免重启原理：配置每次现读不缓存，save 后立刻 reload() 换引用。
  `ai.apiKey` 传空=「不修改」（页面永不回显完整密钥）；清空需显式传 `__CLEAR__`。校验在保存侧（区间+协议）。
  ⚠️ **外部文件会让「改 classpath 配置」的测试手法失效**（优先级更高）—— E2E 跑前移走、跑后恢复。
- **提示词格式是硬约束**：前端把 `【小节名】` 渲染成小节标题、末尾 `提示：` 渲染成脚注
  ⇒ 提示词锁死三段式（问答 `【初步结论】【法律依据】【建议步骤】`、小法庭 `【推演结论】【维权路径】【举证提示】`）**且禁止 Markdown**。
- **★`Matcher.replaceAll` 的替换串里 `\n` 不是换行**：Java 只把 `\` 当转义下一字符，
  写 `"\\n\\n"` 会替换出**字面量 nn**；要真换行写 `"\n\n"`，正则侧仍 `"\\n{3,}"`。
  这类「源码看着对、运行时不对」只能靠实测输出发现。
- **验证**：`verify-llm-e2e.py`（46，mock+临时实例，含合同审查用例）+ `verify-ai-admin.js`（46，连通成功/失败两路）。
