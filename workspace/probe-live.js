/**
 * 强制硬刷新 + 取用真实规则。
 *
 * 【为什么要单独写这个】headless Edge 对 file:// 子资源（app.css）有磁盘缓存，
 * 即使 Network.setCacheDisabled(true) 也未必生效 —— 实测改了 CSS 后
 * 连续 3 次读到的计算值一模一样，极易误判为"我的改动没生效"。
 * 可靠做法：每次换一个临时 query string 强制重新拉取，
 * 或直接清空浏览器缓存（Network.clearBrowserCache）。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var W = parseInt(process.argv[3], 10) || 1440;
var H = parseInt(process.argv[4], 10) || 900;
var BASE = 'http://127.0.0.1:' + PORT;
var Q = Date.now();
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html?v=' + Q;

var GEO = `(function () {
  var c = document.querySelector('#stat-grid .zf-stat');
  if (!c) { return { error: 'no card' }; }
  var ico = c.querySelector('.zf-stat__icon');
  var go = c.querySelector('.zf-stat__go');
  var lab = c.querySelector('.zf-stat__label');
  var cs = getComputedStyle(c);
  var cr = c.getBoundingClientRect();
  var ir = ico.getBoundingClientRect();
  var gr = go.getBoundingClientRect();
  var lr = lab.getBoundingClientRect();
  var contentLeft = cr.left + parseFloat(cs.paddingLeft);
  // 遍历样式表，找出真正命中的 zf-content--home 规则（file:// 下 CORS 会拦，
  // 所以这里同时给出"规则是否可枚举"的标记，避免把 -1 当成"没有这条规则"）
  var enumerable = true, found = [];
  try {
    for (var i = 0; i < document.styleSheets.length; i++) {
      var ss = document.styleSheets[i];
      if (!ss.href || ss.href.indexOf('app.css') < 0) { continue; }
      var rs = ss.cssRules;
      for (var j = 0; j < rs.length; j++) {
        var t = rs[j].selectorText || '';
        if (t.indexOf('zf-content--home') >= 0) { found.push(t); }
      }
    }
  } catch (e) { enumerable = false; }
  return {
    styleSheetsEnumerable: enumerable,
    matchedRuleCount: found.length,
    card: { l: +cr.left.toFixed(1), w: +cr.width.toFixed(1), h: +cr.height.toFixed(1) },
    display: cs.display,
    justify: cs.justifyContent,
    gridCols: cs.gridTemplateColumns,
    contentLeft: +contentLeft.toFixed(1),
    iconOff: +(ir.left - contentLeft).toFixed(1),
    iconW: +ir.width.toFixed(1),
    labelOff: +(lr.left - contentLeft).toFixed(1),
    goOffRight: +((cr.right - parseFloat(cs.paddingRight)) - gr.right).toFixed(1)
  };
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  // 双保险：既清磁盘缓存，又把页面 URL 加上时间戳
  try { await send('Network.clearBrowserCache'); } catch (e) {}
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2400);

  var g = await send('Runtime.evaluate', { expression: GEO, returnByValue: true });
  console.log(JSON.stringify(g.result.result.value || g.result.value, null, 2));
  process.exit(0);
})();
