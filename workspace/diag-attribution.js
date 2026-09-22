/**
 * 归因实验：本次改动到底让首页变高了还是变矮了？
 *
 * 手法：页面加载后，用 CSSOM 把「最后一整个 .zf-content--home 段」禁用
 * （通过给每条相关规则加一个不存在的 id 前缀使其失配），
 * 再读 docH，与原值对比。这样能在同一份 app.css 上干净地做 A/B。
 *
 * 注意：file:// 下 document.styleSheets 的 cssRules 会被 CORS 拦，读不到
 * （实测 styleSheetsEnumerable=false）。所以改用"注入覆盖样式"的方式：
 * 把被我用到的属性全部还原成通用类的原始值，等价于"退回改造前"。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var W = parseInt(process.argv[3], 10) || 1440;
var H = parseInt(process.argv[4], 10) || 900;
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

// 把被我改过的属性逐条还原成通用 .zf-stat 的原始取值
var REVERT = `
.zf-content--home #stat-grid .zf-stat {
  display: flex !important; flex-direction: column !important;
  justify-content: normal !important; align-items: center !important;
  grid-template-columns: none !important; grid-template-rows: none !important;
  column-gap: 0 !important; row-gap: 0 !important;
  padding: 18px 20px !important; gap: 12px !important;
}
.zf-content--home #stat-grid .zf-stat__icon {
  grid-area: auto !important; width: 42px !important; height: 42px !important;
  font-size: 18px !important;
}
.zf-content--home #stat-grid .zf-stat > div { grid-area: auto !important; }
.zf-content--home #stat-grid .zf-stat__label { font-size: 12px !important; }
.zf-content--home #stat-grid .zf-stat__value { font-size: 22px !important; margin-top: 1px !important; }
.zf-content--home #stat-grid .zf-stat__go {
  grid-area: auto !important; margin-right: 0 !important; font-size: 13px !important;
}
`;

var MEASURE = `(function () {
  var g = document.getElementById('stat-grid');
  var c = document.querySelector('#stat-grid .zf-stat');
  var cr = c.getBoundingClientRect();
  return {
    docH: document.documentElement.scrollHeight,
    vh: innerHeight,
    scroll: document.documentElement.scrollHeight > innerHeight + 1,
    gridH: +g.getBoundingClientRect().height.toFixed(1),
    cardH: +cr.height.toFixed(1),
    cardW: +cr.width.toFixed(1)
  };
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8')
  });
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2200);

  var now = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  var a = now.result.result.value || now.result.value;
  console.log('改造后 :', JSON.stringify(a));

  await send('Runtime.evaluate', {
    expression: 'var s=document.createElement("style");s.textContent=' +
      JSON.stringify(REVERT) + ';document.head.appendChild(s);"ok"'
  });
  await cdp.sleep(400);

  var rev = await send('Runtime.evaluate', { expression: MEASURE, returnByValue: true });
  var b = rev.result.result.value || rev.result.value;
  console.log('还原后 :', JSON.stringify(b));

  console.log('');
  console.log('网格高  : ' + a.gridH + '  ->  ' + b.gridH +
    '   (' + (a.gridH - b.gridH >= 0 ? '+' : '') + (a.gridH - b.gridH).toFixed(1) + 'px)');
  console.log('页面高  : ' + a.docH + '  ->  ' + b.docH +
    '   (' + (a.docH - b.docH >= 0 ? '+' : '') + (a.docH - b.docH).toFixed(1) + 'px)');
  console.log('是否滚动: ' + a.scroll + '  ->  ' + b.scroll);
  process.exit(0);
})();
