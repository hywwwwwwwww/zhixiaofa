/**
 * @file 截图：首页列表改造视觉验收
 *
 * 产出：
 *   shots/100-home-lists-idle.png   列表常态（含 caret 与徽标）
 *   shots/101-home-qa-open.png      第 1 条问答展开（含法条框收起）
 *   shots/102-home-refs-open.png    展开法条清单
 *   shots/103-home-article-modal.png 文章弹窗
 *   shots/104-home-hover.png        hover 高亮
 */
var http = require('http');
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
var OUT = path.join(__dirname, 'shots');

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  if (!fs.existsSync(OUT)) { fs.mkdirSync(OUT, { recursive: true }); }

  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no target'); process.exit(1); }

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

  async function shot(name) {
    var r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    if (!r.result || !r.result.data) { console.log('  shot fail', name); return; }
    fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    console.log('  saved ' + name);
  }

  async function scrollToLists() {
    await ev([
      "(function(){",
      "  var box = document.querySelector('#qa-list').closest('.zf-grid');",
      "  var top = box.getBoundingClientRect().top + (window.pageYOffset||0) - 90;",
      "  window.scrollTo(0, top > 0 ? top : 0);",
      "})()"
    ].join('\n'));
    await sleep(600);
  }

  // 1) 常态
  await scrollToLists();
  await shot('100-home-lists-idle.png');

  // 2) hover 第 2 条
  var pos = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelectorAll('#qa-list .zf-home-item')[1];",
    "  var r = it.getBoundingClientRect();",
    "  return JSON.stringify({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2) });",
    "})()"
  ].join('\n')));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: pos.x, y: pos.y });
  await sleep(400);
  await shot('104-home-hover.png');

  // 3) 展开第 1 条问答
  await ev("document.querySelectorAll('#qa-list .zf-home-item')[0].click()");
  await sleep(500);
  await scrollToLists();
  await shot('101-home-qa-open.png');

  // 4) 展开法条清单
  await ev("document.querySelectorAll('#qa-list .zf-home-item')[0].querySelector('.zf-home-refs').click()");
  await sleep(500);
  await shot('102-home-refs-open.png');

  // 5) 文章弹窗
  // 【等待要够长】第一次截图时 backdrop 还没变暗 —— 实测 .modal-backdrop 确实已插入
  // 且 opacity:0.5，只是 Bootstrap 的 .15s 过渡 + headless 合成需要时间。
  // 等 1.5s 稳定后再截，否则会误判成「遮罩没生效」而去改一个没坏的东西。
  await ev([
    "(function(){",
    "  var it = document.querySelectorAll('#tip-list .zf-home-item')[0];",
    "  it.click();",
    "})()"
  ].join('\n'));
  await sleep(1500);
  await shot('103-home-article-modal.png');

  console.log('done');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
