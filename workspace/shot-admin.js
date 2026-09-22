/**
 * @file 截图：管理端专属外壳替换后的视觉验收
 *
 * 产出（shots/）：
 *   200-admin-index.png          数据看板（指标卡 + 图例 + 表格）
 *   201-admin-users.png          用户管理（筛选条 + 工具条计数 + 表格）
 *   202-admin-laws.png           法律管理
 *   203-admin-logs.png           日志监控
 *   204-admin-denied.png         非管理员访问 → 管理端内提示页
 *   205-admin-drawer-closed.png  窄屏 900 抽屉收起（汉堡按钮可见）
 *   206-admin-drawer-open.png    窄屏 900 抽屉展开（含遮罩）
 *   207-admin-narrow-560.png     窄屏 560 极限档
 *
 * 用法：先起 headless Edge（见 runnode.py 前的启动命令），再
 *   python workspace/runnode.py shot-admin.js
 */
var http = require('http');
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/admin';
var OUT = path.join(__dirname, 'shots');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  if (!fs.existsSync(OUT)) { fs.mkdirSync(OUT, { recursive: true }); }

  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no about:blank target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');

  async function ev(e, awaitP) {
    var p = { expression: e, returnByValue: true };
    if (awaitP) { p.awaitPromise = true; }
    var r = await send('Runtime.evaluate', p);
    if (r.result && r.result.exceptionDetails) { return '__ERR__'; }
    return r.result.result.value;
  }
  /** 同上，但作用于任意 send（多页签场景用） */
  async function ev2(s2, e, awaitP) {
    var p = { expression: e, returnByValue: true };
    if (awaitP) { p.awaitPromise = true; }
    var r = await s2('Runtime.evaluate', p);
    if (r.result && r.result.exceptionDetails) { return '__ERR__'; }
    return r.result.result.value;
  }
  /** 截图。传 s2 时截对应页签，否则截主页签 */
  async function shot(name, s2) {
    var snd = s2 || send;
    var r = await snd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!r.result || !r.result.data) { console.log('  shot fail ' + name); return; }
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    console.log('  saved ' + name);
  }
  /**
   * 新建页签并取回其 target 信息。
   *
   * 【坑】`cdp.js` 的 `httpGet` 内部无条件 `JSON.parse`，而 Chromium 对
   * `/json/new` 要求 **PUT** 方法；用 GET 时会返回纯文本
   * `Using unsafe HTTP verb GET to invoke /json/new...`，
   * 于是 JSON.parse 抛 SyntaxError 且**逃出调用方的 try/catch**
   * （异常发生在 promise 回调里）。所以这里用原生 http 手写，并且必须用 PUT。
   */
  function newTab() {
    return new Promise(function (resolve, reject) {
      var req = require('http').request(
        { host: '127.0.0.1', port: PORT, path: '/json/new?about:blank', method: 'PUT' },
        function (res) {
          var buf = '';
          res.on('data', function (d) { buf += d; });
          res.on('end', function () {
            try { resolve(JSON.parse(buf)); } catch (e) { reject(new Error('newTab 返回非 JSON: ' + buf.slice(0, 120))); }
          });
        });
      req.on('error', reject);
      req.end();
    });
  }

  /** 开一个新页签，注入桩，导航到指定页并**等导航真正提交** */
  async function openPage(page, stub, w, h) {
    var nt = await newTab();
    var c2 = await cdp.connect(nt.webSocketDebuggerUrl);
    var s2 = c2.send;
    await s2('Page.enable'); await s2('Runtime.enable');
    await s2('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await s2('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(path.join(__dirname, stub), 'utf8') });
    var target = ROOT + '/' + page;
    await s2('Page.navigate', { url: target });
    /* 【坑】不能只 sleep 然后读 href：导航可能尚未提交（读到 about:blank），
       或桩里的鉴权重写还没跑完。这里**轮询等 href 变成目标页**，
       最多等 12s；等到了再补一点时间让 XHR 把表格渲染出来。 */
    var ok = false;
    for (var t = 0; t < 24; t++) {
      await sleep(500);
      var cur = await ev2(s2, 'document.location.href');
      if (typeof cur === 'string' && cur.indexOf(page) >= 0) { ok = true; break; }
    }
    await sleep(1600);
    return { id: nt.id, send: s2, landed: ok };
  }
  /** 原生 http 关闭页签（`cdp.js` 的 httpGet 会 JSON.parse 纯文本响应而抛异常） */
  function closeTab(id) {
    return new Promise(function (resolve) {
      var req = require('http').request(
        { host: '127.0.0.1', port: PORT, path: '/json/close/' + id, method: 'GET' },
        function (res) { res.resume(); res.on('end', resolve); });
      req.on('error', function () { resolve(); });
      req.end();
    });
  }

  var W = 1440, H = 900;

  /* ---- 桌面：4 个代表页 ---- */
  var desks = [
    ['index.html', '200-admin-index.png'],
    ['users.html', '201-admin-users.png'],
    ['laws.html', '202-admin-laws.png'],
    ['logs.html', '203-admin-logs.png']
  ];
  for (var d = 0; d < desks.length; d++) {
    var pg = await openPage(desks[d][0], 'zc-stub-admin2.js', W, H);
    /* 【坑】这里必须用 pg.send（新页签自己的 send），不能用上面那个 send ——
       后者绑在最开始那个 about:blank 页签上，读 href 永远是 about:blank，
       会让人误以为「导航没生效」。 */
    var url = await ev2(pg.send, 'document.location.href');
    console.log('  ' + desks[d][0] + ' → landed=' + pg.landed + ' href=' + url);
    await shot(desks[d][1], pg.send);
    await closeTab(pg.id);
  }

  /* ---- 非管理员提示页 ---- */
  {
    var pg = await openPage('users.html', 'zc-stub-admin-user.js', W, H);
    var has = await ev2(pg.send, "!!document.querySelector('.zf-admin-denied')");
    console.log('  非管理员提示页 landed=' + pg.landed + ' hasDenied=' + has);
    await shot('204-admin-denied.png', pg.send);
    await closeTab(pg.id);
  }

  /* ---- 窄屏抽屉：900 收起 / 展开，560 极限 ---- */
  {
    var pg = await openPage('users.html', 'zc-stub-admin2.js', 900, 800);
    await shot('205-admin-drawer-closed.png', pg.send);
    var before = await ev2(pg.send, "getComputedStyle(document.querySelector('.zf-topbar__menu')).display");
    await ev2(pg.send, "(function(){document.querySelector('.zf-topbar__menu').click();})()");
    /* 等两帧 + 过渡（.22s）走完再截图，否则截到的是起始帧 */
    await sleep(1200);
    var after = await ev2(pg.send, "document.querySelector('.zf-sidebar').className + '|' + getComputedStyle(document.querySelector('.zf-sidebar')).visibility");
    console.log('  窄屏 menu(收起)=' + before + '  点后=' + after);
    await shot('206-admin-drawer-open.png', pg.send);
    await closeTab(pg.id);
  }
  {
    var pg = await openPage('users.html', 'zc-stub-admin2.js', 560, 780);
    await ev2(pg.send, "(function(){document.querySelector('.zf-topbar__menu').click();})()");
    await sleep(1200);
    await shot('207-admin-narrow-560.png', pg.send);
    await closeTab(pg.id);
  }

  console.log('\n全部截图完成 → ' + OUT);
  process.exit(0);
})().catch(function (e) {
  console.log('脚本异常: ' + (e && e.stack || e));
  process.exit(2);
});
