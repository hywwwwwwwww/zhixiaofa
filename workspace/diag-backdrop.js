/**
 * @file 确认弹窗遮罩（.modal-backdrop）是否真的插入了。
 * 截图里背景没变暗，需要区分两种情况：
 *   a) 遮罩 DOM 没插入（我的 js 有问题）
 *   b) 遮罩插入了，只是 opacity 过渡在截图时还没到 0.5（headless 渲染时序）
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

  console.log('打开前：');
  console.log('  ' + await ev("document.querySelectorAll('.modal-backdrop').length + ' backdrop, body.class=' + document.body.className"));

  await ev("document.querySelectorAll('#tip-list .zf-home-item')[0].click()");
  await sleep(1200);   // 给足过渡时间

  console.log('\n打开后（等 1.2s）：');
  console.log(await ev([
    "(function(){",
    "  var bd = document.querySelector('.modal-backdrop');",
    "  var m = document.querySelector('#article-modal');",
    "  return JSON.stringify({",
    "    backdropN: document.querySelectorAll('.modal-backdrop').length,",
    "    backdropOpacity: bd ? getComputedStyle(bd).opacity : null,",
    "    backdropZ: bd ? getComputedStyle(bd).zIndex : null,",
    "    backdropBg: bd ? getComputedStyle(bd).backgroundColor : null,",
    "    bodyClass: document.body.className,",
    "    bodyOverflow: getComputedStyle(document.body).overflow,",
    "    modalShow: m.classList.contains('show'),",
    "    modalDisplay: getComputedStyle(m).display,",
    "    modalZ: getComputedStyle(m).zIndex,",
    "    footerBtnN: m.querySelectorAll('.modal-footer button').length,",
    "    hasCloseBtn: !!m.querySelector('[data-bs-dismiss=\"modal\"]')",
    "  });",
    "})()"
  ].join('\n')));

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
