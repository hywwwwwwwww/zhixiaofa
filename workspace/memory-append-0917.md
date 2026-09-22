
---

## 2026-09-17 · 首页「使用概览」指标卡尺寸优化

### 用户诉求
截图框选首页顶部 4 张指标卡，说「这个框起来的地方大小有点问题」。
未指明具体问题，因此先做实测再定性。

### 实测（改造前，app.css 未改）
- 卡片 270.8×168.9px（1440×900），但内容只有「42px 图标 + 45px 宽文字块」
- 竖向：内容约占卡片高度 1/4
- 横向：内容 45px / 可用 230.8px（19.5%）；1920 下 45px / 350.8px（12.8%）
- `.zf-stat__go` 离右边框只剩 **1px**（几乎贴边）
- 「审查合同」用 `bi-file-earmark-check`，与「生成文书」的 `bi-pencil-square`
  在 42px 下都是「方块套勾/笔」，缩略分辨不出

用户选择：**加大内部元素并让内容铺开** + **只改首页这一处**。

### 本轮的真正根因（走了两条弯路，值得记）
**`.zf-card` 是 `display:flex; flex-direction:column`，`.zf-stat` 只重写
`display:flex` 没重置方向 → 继承了 `column`。**

由此派生的三个症状，单看 CSS 一个都看不出来：

1. **`.zf-stat__go` 用 `margin-left:auto` 定位**（为横向 flex 设计）。
   在 `column` 下 `margin-left:auto` 左右都生效 → 箭头水平居中而不是贴右。
2. **`align-items:center`** 让图标按自身宽度居中，而文字块被撑满后左对齐
   → 两者中线对不齐，截图里是「图标悬在文字左上方」的怪异观感。
3. 弯路一：只写 `.zf-stat > div { flex:1 1 auto }` → 实测图标左缘距内容区
   左缘 **87.4px**（卡片才 270.8px 宽）。
   弯路二：改 `flex-wrap:wrap` + 箭头 `flex-basis:100%` 逼换行 → 箭头确实换行了，
   但 `flex-wrap` 改变交叉轴语义，图标从 52px 被**横向拉伸到 105.4px**。

**最终方案：直接上 CSS Grid**，四个方向全显式声明：
```css
.zf-content--home #stat-grid .zf-stat {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  grid-template-rows: auto auto;
  justify-content: start;   /* 必须写，否则继承 align-items 把内容整体居中 */
  align-items: center;
  column-gap: 14px; row-gap: 10px;
  padding: 20px 22px;
}
/* 图标 row1/col1、文字块 row1/col2、箭头 row2 跨两列靠右 */
```

### 最隐蔽的一个坑（差点没查出来）
```css
.zf-content--home #stat-grid .zf-stat > div { grid-area: 1 / 2 / 2 / 3; }
```
**图标本身就是 `<div class="zf-stat__icon">`，同样命中这条选择器！**
它的特异性 (0,2,1) 高于图标规则 (0,2,0)，于是把图标的 grid-area 也改写成
第 2 列 —— 图标和文字块挤在同一格。

排查手法（重要）：光读 CSS 完全看不出来，必须读 **computed `gridArea`**：
- 症状：图标 `gridArea` 是 `1 / 2 / 2 / 3` 而不是我写的 `1 / 1 / 2 / 2`
- 决定性实验：用**内联样式**（最高特异性）设 `grid-area: 1/1/2/2`，
  实测 `iconOff` 从 67px 变成 1px → 证明「布局逻辑对，是我的规则在层叠中输了」
- 修法：`> div:not(.zf-stat__icon)`

### 另一个必须显式声明的属性
grid 容器不写 `justify-content` 时，`.zf-stat` 上的 `align-items:center`
（通用规则第 132 行）会被继承进 grid 容器的 place-items，
把**整个格栅内容**居中 —— 实测图标左缘被推到距内容区左缘 67px。

### 「页面变高了吗」的归因（自己给自己做 A/B）
初期探针没记录 `docH`，导致无法判断「滚动」是不是我引入的。
补做 `diag-attribution.js`：页面加载后用注入样式把被我改的属性**逐条还原**成
通用档位，再读 docH：

| | 改造后 | 还原后 |
|---|---|---|
| 网格高 | 125px | 167.8px |
| 页面高 | 1220 | 1262 |
| 是否滚动 | true | **true** |

结论：**首页本来就滚动**（有 5 张功能卡 + 4 条问答 + 5 篇文章），
本次改动反而让页面**矮了 42px**。因此断言从「无纵向滚动」改成
「不比改造前更高」——原断言是我的写法错误，不是代码问题。

### 落地清单
| 项 | 改前 | 改后 |
|---|---|---|
| 卡片布局 | flex（误继承 column） | grid 2×2 |
| 图标 | 42px | **52px**（≤1280 退 46px） |
| 数字 | 22px | **26px**（≤1280 退 23px） |
| 标签 | 12px | 12.5px |
| 卡片内边距 | 18/20 | 20/22 |
| 箭头右退让 | 1px | **8px** |
| 内容占卡片可用宽 | 19.5% | **99.1%** |
| 合同图标 | `file-earmark-check` | `file-earmark-diff`（可辨识） |
| 首页页面高 | 1262px | **1220px**（矮 42px） |

### 文件改动
- `src/main/webapp/pages/home.html`
  - `<section class="zf-content">` → `zf-content zf-content--home`（作用域）
  - 合同卡图标换 `bi-file-earmark-diff`（附注释说明选型理由）
- `src/main/webapp/css/app.css`（+约 90 行，文件末尾）
  - 新增 `.zf-content--home #stat-grid ...` 段，含大段「踩坑 · 必读」注释
- 全站 `?v=20260916s → 20260916t`（19 文件 / 37 处）

### 验证
- `verify-home-stat.js` **58/58 PASS**（5 视口 × 通用+专属断言）
- `verify-home-scope.js` **14/14 PASS**（作用域未泄漏到 profile / admin）
- `verify-home-runtime.js` 无报错、欢迎语 + 4 个数值 + 4 个图标字形全部渲染
- `static-check.js`：ES5 PASS、内联 JS 18/18 语法 OK、版本号 37 处一致、
  CSS 花括号 653/653
- 回归：`verify-pf-space.js` 28/28、`verify-shared-impact.js` 18/18 全 PASS

### 工具链修正（都是真踩到的）
1. **`diag-home-stat.js` 两处测量错误**：用 `val.parentNode` 量文字宽度
   （它被撑满整行，量出的是卡片宽）；`cardInnerW` 硬编码 `-40`
   （padding 改 22 后失效）。→ 改用 `图标宽 + column-gap + max(标签宽,数字宽)`
   与 `getComputedStyle` 读真实 padding。
2. **缓存导致「改动无效」假象**：连续 3 次读到完全相同的计算值。
   `Network.setCacheDisabled` 在 file:// 下不可靠。
   → 用 `probe-cache.js` 动态注入记号样式验证「CSS 确实是最新的」，
   再配合 `Network.clearBrowserCache`。
3. **多标签页竞态**：循环里连开标签页，admin 那轮读到的是 home 的文档，
   导致「作用域泄漏」等 6 条断言**集体误报**。
   → 探针必须先断言 `document.location.href`；用完 `closeTab`。
   `cdp.js` 的 `httpGet` 不能用来调 `/json/close`（返回纯文本非 JSON，
   `JSON.parse` 异常在回调里抛出、绕过 try/catch）。
4. **admin 页需要 `role: 'ADMIN'`**：`ZF.requireLogin(needAdmin)` 里
   `user.role !== 'ADMIN'` 会跳回 `pages/home.html`。→ 新建 `zc-stub-admin.js`。
5. **`static-check.js` 三个问题**：
   - `/\*\*/` 检幂运算符时会跨行把 JSDoc 里连续两行的星号拼成 `**`，
     在 common.js 误报 20+ 条 → 改成**行级**匹配
   - 手写词法状态机剥注释漏剥 20 个 JSDoc（源码有 `/['"]/` 这类
     **正则字面量里含引号**，状态机把它当字符串起始，此后引号配对全错位）
     → 改成两步正则：先占位字符串再删注释
   - 版本号写死 `?v=20260916n`，升版后校验形同虚设 → 改为自动探测
6. **脚本自身注释踩雷**：在块注释里写了「星号加斜杠」的字面量，
   **直接闭合了块注释**，报 `SyntaxError: Unexpected end of input`，
   行号指向文件末尾，极难定位。→ 注释里提到正则一律用文字描述。

### 数据真实性
`bi-file-earmark-diff` 的码点已在 `vendor/bootstrap-icons/bootstrap-icons.min.css`
中确认存在（`\f364`），不是凭空猜的类名。
