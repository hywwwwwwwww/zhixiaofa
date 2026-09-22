/**
 * @file 管理端巡检（黄金口径）：用【真实管理员会话】逐页渲染 9 个管理页，采集布局指标 + 截图。
 *
 * 产出（workspace/shots/）：
 *   230-admin-real-<page>.png   9 个管理页各一张（1440x900 视口）
 *
 * 用法：先确认 8080 服务器在跑（且库里 admin/admin123 可用），然后
 *   python workspace/rundetached.py 9363 verify-admin-real.js
 *
 * 退出码：0 = 9 页全部落地正确；2 = 有页面异常
 *
 * ---------------------------------------------------------------------------
 * 【为什么必须用真实会话，而不是 XHR 桩】
 *
 * 曾经用的做法是「桩只伪造 /auth/profile 返回 ADMIN」。这会漏掉一个致命事实：
 * AuthFilter 有公开只读白名单
 *     PUBLIC_GET = /api/law-articles, /api/knowledge, /api/doc-templates, /api/quiz, /api/qa
 * 白名单内匿名 GET 会被过滤器放行、由 Servlet 自己返回【HTTP 200 + code=11301】；
 * 白名单外未登录由过滤器返回【HTTP 401 + code=11301】。
 * 而 js/common.js 的 request 封装是「HTTP 200 走 success、HTTP 401 走 error」，
 * success 分支见到 11301 会 setTimeout(ZF.redirectLogin, 900) → login.html
 * →（桩让 login 页以为已登录）→ pages/home.html。
 *
 * 结果就是 qa.html / quiz.html / doc-templates.html 这三页（它们各自会调
 * /qa/stats、/quiz/stats、/doc-templates/stats）会被「踢到用户端首页」，
 * 而其余 6 页安然无恙 —— 一个由**桩不完整**伪造出来的假阳性。
 *
 * 换成真实会话后 9/9 全部正常。所以：**鉴权类巡检一律用真实登录态，不要打桩。**
 *
 * 【坑备忘】
 *  - /json/new 必须用 PUT；/json/close 返回纯文本，cdp.js 的 JSON.parse 会抛异常
 *    → 两者都用原生 http 手写。
 *  - 每个页签的 send 是独立的，evaluate / captureScreenshot 必须传该页签自己的 send。
 *  - CDP 的 Runtime.evaluate 必须先 Runtime.enable，否则返回结构取不到值。
 *  - console.log 里不要写 Python 的 '%s' % (...) 语法（JS 没有），会整行变成 NaN。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9363;
var HOST = '127.0.0.1';
var WEB = '8080';
var CTX = '/zhixiaofa';
var BASE = 'http://' + HOST + ':' + WEB + CTX + '/admin/';
var OUT = path.join(__dirname, 'shots');

var USER = process.env.ZF_ADMIN_USER || 'admin';
var PASS = process.env.ZF_ADMIN_PASS || 'admin123';

var PAGES = ['index.html', 'users.html', 'qa.html', 'contracts.html', 'laws.html',
             'knowledge.html', 'doc-templates.html', 'quiz.html', 'logs.html'];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/** 真实登录，拿 JSESSIONID */
function login() {
  return new Promise(function (res, rej) {
    var body = JSON.stringify({ username: USER, password: PASS });
    var req = http.request({
      hostname: HOST, port: WEB, path: CTX + '/api/auth/login', method: 'POST',
      headers: {
        'Content-Type': 'application/json;charset=UTF-8',
        'Content-Length': Buffer.byteLength(body)
      }
    }, function (r) {
      var buf = '';
      r.on('data', function (c) { buf += c; });
      r.on('end', function () {
        var cookie = null;
        (r.headers['set-cookie'] || []).forEach(function (c) {
          var m = /^(JSESSIONID=[^;]+)/.exec(c);
          if (m) { cookie = m[1]; }
        });
        var json = null;
        try { json = JSON.parse(buf); } catch (e) { /* 忽略 */ }
        res({ status: r.statusCode, cookie: cookie, body: json });
      });
    });
    req.on('error', rej);
    req.write(body);
    req.end();
  });
}

function httpPut(url) {
  return new Promise(function (res, rej) {
    var u = new URL(url);
    var req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT'
    }, function (r) {
      var b = '';
      r.on('data', function (c) { b += c; });
      r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { res({ raw: b }); } });
    });
    req.on('error', rej);
    req.end();
  });
}

function closeTab(id) {
  return new Promise(function (res) {
    var req = http.request({
      hostname: HOST, port: PORT, path: '/json/close/' + id, method: 'GET'
    }, function (r) { r.resume(); r.on('end', res); });
    req.on('error', function () { res(); });
    req.end();
  });
}

async function ev(send, expr) {
  var r = await send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: true
  });
  if (!r || !r.result) { return undefined; }
  return r.result.result ? r.result.result.value : undefined;
}

var PROBE = 'JSON.stringify({' +
  'href:location.href,' +
  'title:document.title,' +
  'side:!!document.querySelector(".zf-sidebar"),' +
  'navN:(document.querySelectorAll(".zf-sidebar .zf-nav a,.zf-sidebar .zf-nav__link,.zf-sidebar nav a").length),' +
  'active:(function(){var a=document.querySelector(".zf-nav [aria-current],.zf-nav .is-active,.zf-nav [class*=current]");return a?a.textContent.trim():"";})(),' +
  'topT:(function(){var e=document.querySelector(".zf-topbar__title,.zf-topbar h1");return e?e.textContent.trim():"";})(),' +
  'metrics:document.querySelectorAll(".zf-stat").length,' +
  'rows:document.querySelectorAll("table tbody tr").length,' +
  'charts:document.querySelectorAll("canvas").length,' +
  'filterBar:document.querySelectorAll(".zf-filter-bar").length,' +
  'docH:document.documentElement.scrollHeight})';

async function main() {
  var lg = await login();
  console.log('登录 ' + USER + ' -> status=' + lg.status + '  cookie=' + lg.cookie);
  console.log('      body=' + JSON.stringify(lg.body));
  if (!lg.cookie) {
    console.log('!!! 登录失败（检查服务器是否在跑、库中是否有该账号）');
    process.exit(2);
  }
  console.log('');

  var ckName = lg.cookie.split('=')[0];
  var ckVal = lg.cookie.split('=').slice(1).join('=');

  try { fs.mkdirSync(OUT, { recursive: true }); } catch (e) { /* 已存在 */ }

  var rows = [];
  for (var i = 0; i < PAGES.length; i++) {
    var pg = PAGES[i];
    var t = await httpPut('http://' + HOST + ':' + PORT + '/json/new?about:blank');
    var conn = await cdp.connect(t.webSocketDebuggerUrl);
    var send = conn.send;

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
    });
    await send('Network.setCookie', {
      name: ckName, value: ckVal,
      domain: HOST, path: CTX, url: 'http://' + HOST + ':' + WEB + CTX + '/'
    });

    await send('Page.navigate', { url: BASE + pg });
    await sleep(3200);

    var info = await ev(send, PROBE);
    var d = {};
    try { d = JSON.parse(info); } catch (e) { d = { err: String(info) }; }

    var landed = String(d.href || '').replace('http://' + HOST + ':' + WEB + CTX, '');
    var ok = landed === '/admin/' + pg;
    rows.push({ page: pg, ok: ok, landed: landed, d: d });

    console.log('===== ' + pg + ' =====');
    console.log('  landed : ' + landed + '   ' + (ok ? 'OK' : '<<<< BAD'));
    console.log('  title  : ' + d.title);
    console.log('  shell  : sidebar=' + d.side + ' navN=' + d.navN +
                ' top="' + d.topT + '" active="' + d.active + '"');
    console.log('  data   : metrics=' + d.metrics + ' rows=' + d.rows +
                ' charts=' + d.charts + ' filterBar=' + d.filterBar + ' docH=' + d.docH);

    var shot = await send('Page.captureScreenshot', { format: 'png' });
    var b64 = shot && shot.result ? shot.result.data : null;
    if (b64) {
      var fp = path.join(OUT, '230-admin-real-' + pg.replace('.html', '') + '.png');
      fs.writeFileSync(fp, Buffer.from(b64, 'base64'));
      console.log('  shot   : ' + fp);
    }
    console.log('');

    conn.socket.destroy();
    await closeTab(t.id);
  }

  console.log('################ 汇总（真实会话）################');
  var pass = 0;
  rows.forEach(function (r) {
    if (r.ok) { pass++; }
    console.log((r.ok ? ' OK ' : 'BAD ') + ' ' + r.page +
      '  landed=' + r.landed + '  sidebar=' + r.d.side +
      '  navN=' + r.d.navN + '  title=' + r.d.title);
  });
  console.log('');
  console.log('通过 ' + pass + ' / ' + rows.length);
  process.exit(pass === rows.length ? 0 : 2);
}

main().catch(function (e) {
  console.log('FATAL: ' + (e && e.stack || e));
  process.exit(1);
});
