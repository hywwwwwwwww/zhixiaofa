/**
 * 定位 grid-area 为何不生效。
 *
 * 用 CSS.supports + 直接读回"我自己写的规则在不在样式表里"来缩小范围。
 * 关键手法：给元素打一个独一无二的 id，再用最高特异性的内联样式对比。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

// 逐条尝试候选选择器，看谁真能命中
var EXPR = `(function () {
  var ico = document.querySelector('#stat-grid .zf-stat__icon');
  var card = document.querySelector('#stat-grid .zf-stat');
  var cands = [
    '.zf-content--home #stat-grid .zf-stat__icon',
    '.zf-content--home #stat-grid .zf-stat .zf-stat__icon',
    '#stat-grid .zf-stat__icon',
    '.zf-stat__icon',
    '.zf-content--home #stat-grid .zf-card.zf-stat > .zf-stat__icon'
  ];
  var out = [];
  for (var i = 0; i < cands.length; i++) {
    var hit = false, err = null;
    try { hit = ico.matches(cands[i]); } catch (e) { err = String(e.message); }
    out.push({ sel: cands[i], matchesIcon: hit, err: err });
  }
  // 计算值
  var cs = getComputedStyle(ico);
  // 该元素上有哪些"来自样式表"的 grid-area（用 computed 反推）
  return {
    selectorHits: out,
    iconComputed: {
      gridArea: cs.gridArea,
      gridColumnStart: cs.gridColumnStart,
      gridRowStart: cs.gridRowStart,
      width: cs.width, height: cs.height,
      alignSelf: cs.alignSelf, justifySelf: cs.justifySelf
    },
    cardMatches: {
      homeScope: card.matches('.zf-content--home #stat-grid .zf-stat'),
      cardCls: card.className,
      sectionCls: document.querySelector('.zf-content').className,
      gridId: document.getElementById('stat-grid') === card.parentNode
    }
  };
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8')
  });
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2200);
  var r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  console.log(JSON.stringify(r.result.result.value || r.result.value, null, 2));
  process.exit(0);
})();
