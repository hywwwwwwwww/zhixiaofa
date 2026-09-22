/* ===========================================================================
 * ⚠️ 已废弃 / DEPRECATED —— 请改用 verify-admin-real.js
 *
 * 本脚本用「只伪造 /auth/profile」的 XHR 桩模拟管理员登录态，这是**不完整的**：
 * AuthFilter 对 /api/qa、/api/quiz、/api/doc-templates 等路径有「匿名 GET 白名单」，
 * 于是 /qa/stats、/quiz/stats、/doc-templates/stats 在无会话时会返回
 * 【HTTP 200 + code=11301】，命中 js/common.js 的 success 分支 → redirectLogin()
 * → login.html →（桩让 login 页以为已登录）→ pages/home.html。
 * 结果：qa.html / quiz.html / doc-templates.html 三页会被误判为「被踢出管理端」。
 *
 * 已验证：换成**真实管理员会话**后 9/9 页全部正常。
 *   → python workspace/rundetached.py 9363 verify-admin-real.js
 * =========================================================================== */
/**
 * @file 管理端界面巡检：走真实服务器（http://127.0.0.1:8080/zhixiaofa）+ 管理员登录态，
 *       逐页渲染、采集布局指标、截图。
 *
 * 产出（shots/）：
 *   220-admin-<page>.png   9 个管理页各一张
 *   221-admin-hard.png     数据看板完整长图（captureBeyondViewport）
 *
 * 用法：先确认 8080 服务器在跑、9361 有 headless Edge，然后
 *   python workspace/runnode.py audit-admin-server.js
 *
 * 【坑备忘】
 *  - `/json/new` 必须 PUT；`/json/close` 返回纯文本会让 cdp.httpGet 的 JSON.parse 抛异常
 *    → 两者都用原生 http 手写。
 *  - 每个页签的 send 是独立的，evaluate/captureScreenshot 都要传该页签自己的 send。
 *  - 真实 http 环境下 XHR 桩用原型改写才拦得住（jQuery 持有原生引用）。
 */
var http = require('http');
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9361;
var BASE = 'http://127.0.0.1:8080/zhixiaofa/admin/';
var OUT = path.join(__dirname, 'shots');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/** 管理员登录态桩：拦 /auth/profile 返回 ADMIN，其余真实请求放行 */
var STUB = [
  '(function(){',
  'var R=window.XMLHttpRequest;',
  'var _o=R.prototype.open,_s=R.prototype.send;',
  'R.prototype.open=function(m,u){this.__u=String(u);return _o.apply(this,arguments);};',
  'R.prototype.send=function(){',
  '  var self=this,u=String(self.__u||"");',
  '  if(u.indexOf("/auth/profile")<0&&u.indexOf("/auth/me")<0)return _s.apply(self,arguments);',
  '  var txt=JSON.stringify({code:10000,message:"ok",data:{id:1,username:"admin",nickname:"管理员",role:"ADMIN",status:1}});',
  '  Object.defineProperty(self,"readyState",{value:4,configurable:true});',
  '  Object.defineProperty(self,"status",{value:200,configurable:true});',
  '  Object.defineProperty(self,"statusText",{value:"OK",configurable:true});',
  '  Object.defineProperty(self,"responseText",{value:txt,configurable:true});',
  '  Object.defineProperty(self,"response",{value:txt,configurable:true});',
  '  self.getResponseHeader=function(h){return h&&h.toLowerCase()==="content-type"?"application/json":null;};',
  '  self.getAllResponseHeaders=function(){return "content-type: application/json\\r\\n";};',
  '  setTimeout(function(){if(self.onreadystatechange)self.onreadystatechange();if(self.onload)self.onload();},20);',
  '};',
  '})();'
].join('\n');

function newTab() {
  return new Promise(function (resolve, reject) {
    var req = http.request(
      { host: '127.0.0.1', port: PORT, path: '/json/new?about:blank', method: 'PUT' },
      function (res) {
        var b = '';
        res.on('data', function (d) { b += d; });
        res.on('end', function () {
          try { resolve(JSON.parse(b)); }
          catch (e) { reject(new Error('newTab 非 JSON: ' + b.slice(0, 100))); }
        });
      });
    req.on('error', reject); req.end();
  });
}
function closeTab(id) {
  return new Promise(function (resolve) {
    var req = http.request(
      { host: '127.0.0.1', port: PORT, path: '/json/close/' + id, method: 'GET' },
      function (res) { res.resume(); res.on('end', resolve); });
    req.on('error', function () { resolve(); }); req.end();
  });
}

(async function () {
  if (!fs.existsSync(OUT)) { fs.mkdirSync(OUT, { recursive: true }); }

  /** 开页签 → 打桩 → 导航 → 轮询等落地 */
  async function openPage(page, w, h) {
    var nt = await newTab();
    var c = await cdp.connect(nt.webSocketDebuggerUrl);
    var send = c.send;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride',
      { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
    await send('Page.navigate', { url: BASE + page });
    var landed = false;
    for (var i = 0; i < 30; i++) {
      await sleep(400);
      var r = await send('Runtime.evaluate',
        { expression: 'document.location.href', returnByValue: true });
      var href = r.result && r.result.result ? r.result.result.value : '';
      if (typeof href === 'string' && href.indexOf(page) >= 0) { landed = true; break; }
    }
    await sleep(2200);   // 等 XHR 渲染表格 / 图表
    return { id: nt.id, send: send, landed: landed };
  }

  async function ev(send, expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
    if (r.result && r.result.exceptionDetails) { return '__ERR__'; }
    return r.result && r.result.result ? r.result.result.value : undefined;
  }
  async function shot(send, name, full) {
    var opt = { format: 'png' };
    if (full) { opt.captureBeyondViewport = true; }
    var r = await send('Page.captureScreenshot', opt);
    if (!r.result || !r.result.data) { console.log('  shot fail ' + name); return; }
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    console.log('  saved ' + name);
  }

  /* 每页要采集的指标 */
  var PAGES = [
    ['index.html',         '数据看板'],
    ['users.html',         '用户管理'],
    ['qa.html',            '问答管理'],
    ['contracts.html',     '合同管理'],
    ['laws.html',          '法律管理'],
    ['knowledge.html',     '文章管理'],
    ['doc-templates.html', '模板管理'],
    ['quiz.html',          '题库管理'],
    ['logs.html',          '日志监控']
  ];

  var PROBE = "(function(){" +
    "var q=function(s){return document.querySelector(s);};" +
    "var qa=function(s){return document.querySelectorAll(s);};" +
    "var out={};" +
    "out.title=document.title;" +
    "out.href=location.href;" +
    "out.denied=!!q('.zf-admin-denied');" +
    "out.hasSidebar=!!q('.zf-admin-sidebar');" +
    "out.navCount=qa('.zf-sidebar .zf-nav').length;" +
    "out.activeNav=(q('.zf-sidebar .zf-nav--active')||{}).innerText||'';" +
    "out.topTitle=((q('.zf-topbar')||{}).innerText||'').replace(/\\s+/g,' ').trim().slice(0,60);" +
    "out.metricCount=qa('.zf-stat').length;" +
    "out.tableRows=qa('.bootstrap-table tbody tr').length;" +
    "out.tableCols=qa('.bootstrap-table thead th').length;" +
    /* 筛选条 */
    "out.filterBar=!!q('.zf-filter-bar');" +
    "out.filterCtl=qa('.zf-filter-bar [data-filter]').length;" +
    "out.filterLabel=qa('.zf-filter-bar__label').length;" +
    "out.toolbarCount=((q('.zf-toolbar__count')||{}).innerText||'').trim();" +
    /* 图表 */
    "out.charts=qa('[_echarts_instance_]').length;" +
    "out.canvas=qa('canvas').length;" +
    /* 布局健康 */
    "out.docW=document.documentElement.scrollWidth;" +
    "out.docH=document.documentElement.scrollHeight;" +
    "out.vw=window.innerWidth; out.vh=window.innerHeight;" +
    "out.overflowX=document.documentElement.scrollWidth>window.innerWidth;" +
    /* 卡片头/标题是否存在空文本 */
    "out.emptyTitles=0;" +
    "var hs=qa('.zf-card__title,.zf-card__desc');" +
    "for(var i=0;i<hs.length;i++){if(!(hs[i].textContent||'').trim())out.emptyTitles++;}" +
    /* 有无未渲染的空态文案 */
    "var empt=qa('.zf-empty');out.emptyStates=empt.length;" +
    "var et='';for(var j=0;j<empt.length;j++){et+='|'+(empt[j].innerText||'').replace(/\\s+/g,' ').trim().slice(0,28);}" +
    "out.emptyText=et.slice(0,220);" +
    "return JSON.stringify(out);})()";

  var W = 1440, H = 900;
  var bad = 0;

  for (var i = 0; i < PAGES.length; i++) {
    var pg = PAGES[i][0], name = PAGES[i][1];
    var t = await openPage(pg, W, H);
    var raw = await ev(t.send, PROBE);
    if (typeof raw !== 'string' || raw.charAt(0) !== '{') {
      console.log('[' + name + '] 探针失败: ' + String(raw).slice(0, 120));
      bad++; await closeTab(t.id); continue;
    }
    var d = JSON.parse(raw);
    console.log('\n===== ' + name + ' (' + pg + ') landed=' + t.landed + ' =====');
    console.log('  标题      : ' + d.title);
    console.log('  侧边栏    : ' + d.hasSidebar + '  导航项=' + d.navCount +
                '  当前项="' + d.activeNav.trim() + '"');
    console.log('  顶部栏    : ' + d.topTitle);
    console.log('  指标卡    : ' + d.metricCount);
    console.log('  表格      : ' + d.tableRows + ' 行 × ' + d.tableCols + ' 列');
    console.log('  筛选条    : ' + d.filterBar + '  控件=' + d.filterCtl +
                '  标签=' + d.filterLabel + '  计数="' + d.toolbarCount + '"');
    console.log('  图表      : echarts实例=' + d.charts + '  canvas=' + d.canvas);
    console.log('  页面      : ' + d.docW + 'x' + d.docH + '  视口 ' + d.vw + 'x' + d.vh +
                '  横向溢出=' + d.overflowX);
    console.log('  空态      : ' + d.emptyStates + (d.emptyText || ''));
    console.log('  提示页    : ' + d.denied + '   空标题=' + d.emptyTitles);
    await shot(t.send, '220-admin-' + pg.replace('.html', '') + '.png');
    if (pg === 'index.html') { await shot(t.send, '221-admin-dash-full.png', true); }
    await closeTab(t.id);
  }

  console.log('\n巡检完成，探针失败页数 = ' + bad);
  process.exit(bad ? 1 : 0);
})().catch(function (e) {
  console.log('脚本异常: ' + (e && e.stack || e));
  process.exit(2);
});
