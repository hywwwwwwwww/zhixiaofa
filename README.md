# 职小法 · 职场新人智能法律助手

面向职场新人的法律辅助系统：把"遇到职场问题该怎么办"拆成 **查法条 → 问问答 → 起草文书 → 审查合同 → 看类案** 五条主线，并用大模型把检索到的法条组织成可读的解释与文书草稿。

技术形态是经典的 **Java 原生 Servlet + JDBC + MySQL**（不使用 Spring），前端为 HTML/CSS/jQuery/Bootstrap 静态页面，适合作为 Web 应用开发实践、课程设计或小型法律咨询系统的参考实现。

---

## 功能概览

**前台（`/pages`）**

| 模块 | 说明 |
|---|---|
| 法律问答 | 提出问题，系统检索相关法条后由大模型生成「结论 / 依据 / 建议」结构化回答；未配置密钥时自动降级为规则拼装 |
| 文书起草 | 按模板生成劳动仲裁申请书、解除劳动合同通知等，支持 AI 补全用户留空字段 |
| 合同审查 | 上传/粘贴合同文本，逐条比对风险点 |
| 类案检索 | 按案由、法院、关键词检索裁判案例 |
| 法律知识库 | 劳动法相关专题文章 |
| 个人中心 | 资料、收藏、密码、消息 |

**后台（`/admin`）**

用户管理、法条库、知识库文章、文书模板、合同记录、问答记录、题库、操作日志、统计看板、AI 设置。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 语言 / 构建 | Java 17、Maven（`war` 打包，`tomcat7-maven-plugin` 内嵌启动） |
| Web | Servlet 4.0、Filter 链（编码 / JSON 包装 / 鉴权 / 操作日志） |
| 数据访问 | 原生 JDBC + 自研 `SimpleConnectionPool` 连接池 |
| 数据库 | MySQL 8.0（`utf8mb4`，InnoDB） |
| JSON | Jackson 2.17 |
| 日志 | SLF4J + Logback |
| 前端 | HTML5 / CSS3 / jQuery / Bootstrap，图表 ECharts，PDF 预览 pdf.js，Word 解析 mammoth（均在 `webapp/vendor` 本地内置，无需联网） |
| 测试 | JUnit 5、Mockito、JaCoCo |

---

## 环境要求

- JDK **17**（`maven.compiler.release=17`，低于 17 无法编译）
- Maven **3.8+**
- MySQL **8.0+**
- 无需单独安装 Tomcat（调试用 `tomcat7:run` 即可）

---

## 快速开始

### 1. 建库并导入数据

```bash
# 注意：schema.sql 开头会 DROP DATABASE IF EXISTS `zhixiaofa`，不要指向已有数据的库
mysql -u root -p < sql/schema.sql
mysql -u root -p zhixiaofa < sql/data.sql
mysql -u root -p zhixiaofa < sql/migration-20260923-email-verify.sql
```

`data.sql` 含 15 张表、4300+ 条演示数据，其中法条正文 743 条（13 部法律全文）。

### 2. 准备本机配置

仓库里只提交了配置模板，真实的账号密码需要你自己建（这三个文件已加入 `.gitignore`，不会被误提交）：

```bash
cp config/db.properties.example   config/db.properties     # 必填：数据库账号密码
cp config/ai.properties.example   config/ai.properties     # 可选：大模型密钥
cp config/mail.properties.example config/mail.properties   # 可选：SMTP 授权码
```

`config/db.properties` 里至少改这一行：

```properties
jdbc.password=你的MySQL密码
```

> 不建 `config/db.properties` 也能启动，此时用的是 `src/main/resources/db.properties` 里的占位值（`root` + 空密码）。

### 3. 启动

```bash
mvn clean tomcat7:run
```

### 4. 访问

| 入口 | 地址 |
|---|---|
| 前台 | http://localhost:8080/zhixiaofa/ |
| 后台 | http://localhost:8080/zhixiaofa/admin/index.html |
| 直接进登录页 | http://localhost:8080/zhixiaofa/login.html |

### 5. 默认账号（来自 `sql/data.sql`）

| 角色 | 账号 | 密码 |
|---|---|---|
| 管理员 | `admin` | `admin123` |
| 普通用户 | `zhangsan` 等演示账号 | `123456` |

---

## 配置机制：classpath 默认 + 外部覆盖

`db.properties`、`ai.properties`、`mail.properties` 都走同一套两级机制，由 `DBUtil` / `AiConfig` / `MailConfig` 实现：

1. **classpath 默认值**：`src/main/resources/*.properties`，随仓库公开，**只放占位值**；
2. **外部覆盖**：`<项目根>/config/*.properties`，存在即覆盖同名键，已被 `.gitignore` 忽略。

数据库配置另有最高优先级的 JVM 参数覆盖：

```bash
mvn tomcat7:run -Djdbc.password=xxx -Djdbc.url=jdbc:mysql://127.0.0.1:3306/zhixiaofa
```

AI 与邮件配置改动后**重启应用**生效；管理端「AI 设置」页保存则立即生效（写入 `config/ai.properties` 并热加载）。

---

## 目录结构

```
zhixiaofa/
├── config/                     # 本机配置（只提交 *.example 模板）
├── docs/                       # API 接口文档、数据库设计、测试报告、部署说明
├── sql/
│   ├── schema.sql              # 建库建表（会先 DROP 同名库）
│   ├── data.sql                # 演示数据（含法条全文）
│   ├── migration-*.sql         # 增量迁移脚本
│   └── restore-prereset-*.sql  # 重置前的数据备份
├── src/main/java/com/zhixiaofa/
│   ├── servlet/                # 15 个 Servlet（/api/* 入口）
│   ├── service/(impl/)         # 业务逻辑
│   ├── dao/(impl/)             # JDBC 数据访问
│   ├── model/                  # 实体
│   ├── filter/                 # 编码、JSON、鉴权、操作日志
│   └── util/                   # DBUtil、AiConfig、MailConfig、SmtpClient 等
├── src/main/resources/         # *.properties 默认值、logback.xml
├── src/main/webapp/
│   ├── pages/  admin/  login.html  index.html
│   ├── css/  js/  vendor/
│   └── WEB-INF/web.xml
├── src/test/java/              # JUnit 5 + Mockito 单元测试
└── pom.xml
```

---

## 测试与覆盖率

```bash
mvn test                        # 单元测试
# 覆盖率报告：target/site/jacoco/index.html
```

> `pom.xml` 里 JaCoCo 的 `destfile` 固定在纯 ASCII 路径 `D:/zhixiaofa-dev/jacoco.exec`，因为项目路径含中文和空格时 javaagent 写盘会乱码。换机器后如果报告为空，把这个路径改成你自己的纯英文路径。

---

## 常见问题

**启动时刷出 `module-info.class` 相关的警告或异常？**
`tomcat7-maven-plugin` 2.2 基于较老的 Tomcat 7，扫描 JDK 17 的模块化依赖时会报这类信息，不影响运行，忽略即可。真报错时优先检查 JDK 是否为 17、端口 8080 是否被占用，以及 `config/db.properties` 里的密码是否正确。

**页面中文乱码？**
`CharacterEncodingFilter` 已统一 UTF-8；仍乱码时检查数据库是否 `utf8mb4`，以及连接的 `characterEncoding=utf8` 是否被改掉。

**问答里返回的是模板文字，不是 AI 回答？**
说明 AI 未启用：`ai.apiKey` 为空、`ai.enabled=false` 或网络不通时会自动降级为规则拼装，属于预期行为。填好 `config/ai.properties` 的 `ai.apiKey` 后重启即可。

**找回密码收不到邮件？**
只支持 **465 端口（隐式 SSL）**，587 的 STARTTLS 未实现。日志里的 SMTP 响应码：`535` 授权码错、`550` 发信地址与登录账号不一致、超时则是端口或网络被拦。

**`mvn clean` 之后配置文件不见了？**
只有 `config/` 下的是持久配置。项目根通过向上查找 `pom.xml` 定位，所以用 `tomcat7:run`（工作目录是 `target/tomcat`）也能正确找到。

---

## 相关文档

- [API 接口文档](docs/API接口文档.md)
- [数据库设计文档](docs/数据库设计文档.md)
- [部署说明文档](docs/部署说明文档.md)
- [测试报告](docs/测试报告.md)

## 仓库镜像

- GitHub：https://github.com/hywwwwwwwww/zhixiaofa
- Gitee：https://gitee.com/ZHY22212/zhixiaofa
