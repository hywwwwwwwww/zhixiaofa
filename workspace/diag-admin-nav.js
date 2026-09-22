/* 诊断：管理页导航链路取证（谁把页面换掉了）
 *
 * 采集每页：PerformanceNavigationTiming(redirectCount) / document.referrer /
 *            页内 fetch 自测(status/redirected/isAdmin) / Page.getNavigationHistory / 落地 URL
 *
 * 关键判读：
 *  - fetch 自测 isAdmin=true 且 redirected=false  → 服务器没问题，是前端跳走的
 *  - referrer=login.html                          → 文档被 login.html 替换过（login 页又跳走）
 *  - history 里出现 pages/home.html               → 被踢到用户端
 *  - redirectCount>0                              → 才是真的 HTTP 重定向
 *
 * 用法：python workspace/rundetached.py 9363 diag-admin-nav.js
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http');

var PORT = 9363;
var CTX = '/zhixiaofa';
var BASE = 'http://127.0.0.1:8080' + CTX + '/admin/';

var PAGES = ['index.html', 'users.html', 'qa.html', 'contracts.html', 'laws.html',
             'knowledge.html', 'doc-templates.html', 'quiz.html', 'logs.html'];

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function httpPut(url) {
  return new Promise(function (res, rej) {
    var u = new URL(url);
    var req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method: 'PUT' }, function (r) {
      var body = '';
      r.on('data', function (c) { body += c; });
      r.on('end', function () { try { res(JSON.parse(body)); } catch (e) { res({ raw: body }); } });
    });
    req.on('error', rej);
    req.end();
  });
}

function closeTab(id) {
  return new Promise(function (res) {
    var req = http.request({ hostname: '127.0.0.1', port: PORT, path: '/json/close/' + id, method: 'GET' }, function (r) {
      r.resume(); r.on('end', res);
    });
    req.on('error', function () { res(); });
    req.end();
  });
}

/* 管理员登录态桩（只拦 profile/me） */
var STUB = [
  'var R=window.XMLHttpRequest;',
  'var _o=R.prototype.open,_s=R.prototype.send;',
  'R.prototype.open=function(m,u){this.__u=String(u);return _o.apply(this,arguments);};',
  'R.prototype.send=function(){',
  '  var self=this,u=String(self.__u||"");',
  '  if(u.indexOf("/auth/profile")<0&&u.indexOf("/auth/me")<0)return _s.apply(self,arguments);',
  '  var txt=JSON.stringify({code:10000,message:"ok",data:{id:1,username:"admin",nickname:"管理员",role:"ADMIN",status:1}});',
  '  Object.defineProperty(self,"readyState",{value:4,configurable:true});',
  '  Object.defineProperty(self,"status",{value:200,configurable:true});',
  '  Object.defineProperty(self,"responseText",{value:txt,configurable:true});',
  '  Object.defineProperty(self,"response",{value:txt,configurable:true});',
  '  setTimeout(function(){if(self.onreadystatechange)self.onreadystatechange();if(self.onload)self.onload();},0);',
  '};'
].join('\n');

async function ev(send, expr) {
  var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (!r || !r.result) { return undefined; }
  if (r.result.exceptionDetails) { return 'EXC:' + JSON.stringify(r.result.exceptionDetails).slice(0, 200); }
  return r.result.result ? r.result.result.value : undefined;
}

async function main() {
  var tbl = [];
  for (var i = 0; i < PAGES.length; i++) {
    var pg = PAGES[i];
    var t = await httpPut('http://127.0.0.1:' + PORT + '/json/new?about:blank');
    var conn = await cdp.connect(t.webSocketDebuggerUrl);
    var send = conn.send;

    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });

    await send('Page.navigate', { url: BASE + pg });
    await sleep(2600);

    var navExpr = '(function(){var n=performance.getEntriesByType("navigation")[0]||{};' +
      'return JSON.stringify({name:n.name,type:n.type,redirectCount:n.redirectCount});})()';
    var navRaw = await ev(send, navExpr);
    var href = await ev(send, 'location.href');
    var title = await ev(send, 'document.title');
    var refer = await ev(send, 'document.referrer');

    // 页内 fetch 自测：同一 URL 直接从浏览器栈请求，看有没有重定向
    var fetchExpr = '(function(){return fetch("' + BASE + pg + '?_probe=1",{redirect:"follow"})' +
      '.then(function(r){return r.text().then(function(t){return JSON.stringify({status:r.status,url:r.url,redirected:r.redirected,len:t.length,isAdmin:t.indexOf("initAdminPage")>=0});});})' +
      '.catch(function(e){return JSON.stringify({error:String(e)});});})()';
    var fetchRaw = await ev(send, fetchExpr);

    var hist = await send('Page.getNavigationHistory');
    var entries = ((hist.result && hist.result.entries) || []).map(function (e) { return e.url.replace('http://127.0.0.1:8080' + CTX, ''); });

    var rec = {
      page: pg,
      landed: String(href).replace('http://127.0.0.1:8080' + CTX, ''),
      title: title,
      nav: navRaw,
      referrer: refer,
      fetch: fetchRaw,
      hist: entries
    };
    tbl.push(rec);

    console.log('===== ' + pg + ' =====');
    console.log('  landed   : ' + rec.landed);
    console.log('  title    : ' + rec.title);
    console.log('  nav      : ' + rec.nav);
    console.log('  referrer : ' + rec.referrer);
    console.log('  fetch    : ' + rec.fetch);
    console.log('  history  : ' + JSON.stringify(rec.hist));
    console.log('');

    conn.socket.destroy();
    await closeTab(t.id);
  }

  // 汇总
  console.log('################ 汇总 ################');
  tbl.forEach(function (r) {
    var ok = r.landed.indexOf('/admin/' + r.page) >= 0;
    console.log('%s %-22s landed=%-34s redirectCount=%s',
      ok ? ' OK ' : 'BAD ',
      r.page,
      r.landed,
      (function () { try { return JSON.parse(r.nav).redirectCount; } catch (e) { return '?'; } })());
  });
}

main().catch(function (e) { console.log('FATAL: ' + (e && e.stack || e)); process.exit(1); });
