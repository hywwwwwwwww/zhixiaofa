/**
 * @file 诊断首页「最近问答 / 新人必看」两块列表的可点击性现状
 *
 * 要回答的问题：
 *   1. 列表项本身可点吗？（探针：item 内有没有 <a href>）
 *   2. 两眼能看出的「可点线索」有哪些？（cursor:pointer / hover 背景 / 下划线）
 *   3. 有没有已经存在的跳转入口能复用？（qa.html / knowledge.html 的路由约定）
 *   4. 「引用N条法规」这个 badge 有没有跳转目标？（法条详情页是否存在？）
 *
 * 【踩坑 1】cdp.js 的 httpGet 签名是 httpGet(url)，**只接受完整 URL**，
 * 不是 (port, path)。传 (port, path) 时它把数字当 URL 给了 http.get，
 * Node 静默回落到 127.0.0.1:80 → ECONNREFUSED，报错信息里完全看不出是参数写错。
 *
 * 【踩坑 2】cdp.js 的 connect 返回 { send, socket }，**没有暴露 message 事件订阅**。
 * 别再自己 socket.on('message') 过滤 id（旧写法），send 本身就返回一个
 * 按 id 匹配的 Promise，直接 await 即可。
 *
 * 【踩坑 3】本环境 bash shim 缺 coreutils，node 脚本若被 SIGTERM 会**看不到任何输出**。
 * 改用 runnode.py（Python subprocess）跑，才能拿到真实 returncode 与 stdout。
 */
var http = require('http');
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no about:blank target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Page.navigate', { url: BASE });
  await sleep(2400);

  var probe = [
    "(function(){",
    "  var out = { docUrl: document.location.href, cards: [], hrefs: [] };",
    "  ['#qa-list', '#tip-list'].forEach(function(sel){",
    "    var box = document.querySelector(sel);",
    "    if (!box) { out.cards.push({sel:sel, missing:true}); return; }",
    "    var items = box.querySelectorAll('.zf-list__item');",
    "    var first = items[0];",
    "    var q = function(el, f){ return el ? f(el) : null; };",
    "    out.cards.push({",
    "      sel: sel,",
    "      itemCount: items.length,",
    "      cardH: Math.round(box.getBoundingClientRect().height),",
    "      firstItemH: first ? Math.round(first.getBoundingClientRect().height) : -1,",
    "      itemCursor: q(first, function(e){return getComputedStyle(e).cursor;}),",
    "      itemBg: q(first, function(e){return getComputedStyle(e).backgroundColor;}),",
    "      itemAnchorN: first ? first.querySelectorAll('a[href]').length : -1,",
    "      titleTag: q(first, function(e){return e.querySelector('.zf-list__title').tagName;}),",
    "      titleCursor: q(first, function(e){return getComputedStyle(e.querySelector('.zf-list__title')).cursor;}),",
    "      titleDecor: q(first, function(e){return getComputedStyle(e.querySelector('.zf-list__title')).textDecorationLine;}),",
    "      badgeText: q(first, function(e){var b=e.querySelector('.zf-badge'); return b?b.textContent:null;}),",
    "      badgeTag: q(first, function(e){var b=e.querySelector('.zf-badge'); return b?b.tagName:null;}),",
    "      badgeCursor: q(first, function(e){var b=e.querySelector('.zf-badge'); return b?getComputedStyle(b).cursor:null;})",
    "    });",
    "    var as = box.querySelectorAll('a[href]');",
    "    for (var k=0;k<as.length;k++) out.hrefs.push(as[k].getAttribute('href'));",
    "  });",
    "  out.hrefs = out.hrefs.filter(function(v,i,a){ return a.indexOf(v)===i; });",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await send('Runtime.evaluate', { expression: probe, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    console.log('EVAL EXCEPTION:', JSON.stringify(r.result.exceptionDetails));
  }
  console.log(JSON.stringify(JSON.parse(r.result.result.value), null, 2));

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
