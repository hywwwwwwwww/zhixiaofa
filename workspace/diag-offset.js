/**
 * 深挖：为什么 .zf-stat 的 grid 内容整体偏移 67px？
 * 逐层打印盒子几何 + 逐条列出该元素上所有生效的声明。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html?v=' + Date.now();

var EXPR = `(function () {
  var out = {};
  var c = document.querySelector('#stat-grid .zf-stat');
  var grid = document.getElementById('stat-grid');
  var content = document.querySelector('.zf-content');

  function info(el, tag) {
    if (!el) { return null; }
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return {
      tag: tag,
      l: +r.left.toFixed(2), r: +r.right.toFixed(2), w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      padding: cs.paddingLeft + '/' + cs.paddingRight,
      margin: cs.marginLeft + '/' + cs.marginRight,
      display: cs.display, direction: cs.direction, textAlign: cs.textAlign,
      justify: cs.justifyContent, justifyItems: cs.justifyItems,
      placeItems: cs.placeItems,
      // 关键：grid 容器自身的 content 起点
      gridTemplateColumns: cs.gridTemplateColumns,
      border: cs.borderLeftWidth + '/' + cs.borderRightWidth
    };
  }
  out.content = info(content, '.zf-content');
  out.grid = info(grid, '#stat-grid');
  out.card = info(c, '.zf-stat');

  // 卡片的第一个子元素（图标）与其兄弟
  var kids = [];
  for (var i = 0; i < c.children.length; i++) {
    var k = c.children[i];
    var kr = k.getBoundingClientRect();
    var kcs = getComputedStyle(k);
    kids.push({
      cls: k.className,
      l: +kr.left.toFixed(2), w: +kr.width.toFixed(2),
      gridArea: kcs.gridArea, gridColumn: kcs.gridColumn, gridRow: kcs.gridRow,
      justifySelf: kcs.justifySelf, textAlign: kcs.textAlign
    });
  }
  out.kids = kids;

  // 用 getMatchedCSSRules 的替代：遍历所有样式表（file:// 下可能被 CORS 拦）
  var rules = [];
  var enumerable = true;
  try {
    for (var s = 0; s < document.styleSheets.length; s++) {
      var ss = document.styleSheets[s];
      if (!ss.href || ss.href.indexOf('app.css') < 0) { continue; }
      var rs = ss.cssRules;
      for (var j = 0; j < rs.length; j++) {
        var sel = rs[j].selectorText;
        if (!sel) { continue; }
        if (sel.indexOf('zf-stat') < 0) { continue; }
        // 该选择器是否命中我们的卡片
        var hit = false;
        try { hit = c.matches(sel) || (kids.length && false); } catch (e) { hit = false; }
        if (hit) { rules.push({ sel: sel, css: rs[j].style.cssText }); }
      }
    }
  } catch (e) { enumerable = false; }
  out.enumerable = enumerable;
  out.matchedRules = rules;
  return out;
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  try { await send('Network.clearBrowserCache'); } catch (e) {}
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2400);
  var g = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  console.log(JSON.stringify(g.result.result.value || g.result.value, null, 2));
  process.exit(0);
})();
