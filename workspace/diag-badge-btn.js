/**
 * @file 定位那 9px：是 <button> 的浏览器默认样式引起的吗？
 *
 * 思路：把 .zf-home-refs 的 button 默认样式逐项中和，看 docH 回到多少。
 * 浏览器给 <button> 的默认值（与 <span> 的差异）：
 *   padding: 1px 6px（Chrome/Edge）  border: 2px outset  font: 400 13.33px system-ui
 *   还有 align-items:center 等
 * 我在 CSS 里只中和了 border / font-family / line-height，**没中和 padding**。
 */
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
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(e) {
    var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }; }
    return r.result.result.value;
  }

  // 1) 徽标当前的计算样式
  var b = JSON.parse(await ev([
    "(function(){",
    "  var el = document.querySelector('#qa-list .zf-home-refs');",
    "  var cs = getComputedStyle(el);",
    "  var meta = el.parentNode;",
    "  var item = el.closest('.zf-home-item');",
    "  return JSON.stringify({",
    "    tag: el.tagName,",
    "    padT: cs.paddingTop, padB: cs.paddingBottom, padL: cs.paddingLeft, padR: cs.paddingRight,",
    "    borderW: cs.borderTopWidth, borderStyle: cs.borderTopStyle,",
    "    fontFamily: cs.fontFamily.slice(0,30), fontSize: cs.fontSize, lineHeight: cs.lineHeight,",
    "    boxSizing: cs.boxSizing, display: cs.display,",
    "    badgeH: Math.round(el.getBoundingClientRect().height),",
    "    metaH: Math.round(meta.getBoundingClientRect().height),",
    "    itemH: Math.round(item.getBoundingClientRect().height),",
    "    docH: document.documentElement.scrollHeight",
    "  });",
    "})()"
  ].join('\n')));
  console.log('徽标当前样式:'); console.log(JSON.stringify(b, null, 2));

  // 2) 中和 button 的 padding，看高度回到哪
  await ev("(function(){var e=document.createElement('style');e.id='__p';e.textContent='.zf-content--home .zf-home-refs{padding:0!important}';document.head.appendChild(e);})()");
  await sleep(300);
  var r2 = JSON.parse(await ev([
    "(function(){",
    "  var el = document.querySelector('#qa-list .zf-home-refs');",
    "  return JSON.stringify({ badgeH: Math.round(el.getBoundingClientRect().height),",
    "    metaH: Math.round(el.parentNode.getBoundingClientRect().height),",
    "    itemH: Math.round(el.closest('.zf-home-item').getBoundingClientRect().height),",
    "    docH: document.documentElement.scrollHeight });",
    "})()"
  ].join('\n')));
  console.log('\n中和 button padding 后:'); console.log(JSON.stringify(r2, null, 2));

  // 3) 再把 badge 换回 span 看基准
  await ev([
    "(function(){",
    "  var el = document.querySelector('#qa-list .zf-home-refs');",
    "  var sp = document.createElement('span');",
    "  sp.className = el.className; sp.textContent = el.textContent;",
    "  el.parentNode.replaceChild(sp, el);",
    "})()"
  ].join('\n'));
  await sleep(300);
  var r3 = JSON.parse(await ev([
    "(function(){",
    "  var el = document.querySelector('#qa-list .zf-home-refs');",
    "  return JSON.stringify({ tag: el.tagName, badgeH: Math.round(el.getBoundingClientRect().height),",
    "    metaH: Math.round(el.parentNode.getBoundingClientRect().height),",
    "    itemH: Math.round(el.closest('.zf-home-item').getBoundingClientRect().height),",
    "    docH: document.documentElement.scrollHeight });",
    "})()"
  ].join('\n')));
  console.log('\n换成 <span> 后（真正的改造前基准）:'); console.log(JSON.stringify(r3, null, 2));

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
