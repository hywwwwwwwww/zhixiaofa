/* 诊断：为什么 font-1/font-2 是空白，font-3 正常 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');
var PORT = 9351;
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
var TEST = 'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/css/_fonttest.html';

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var t = tabs.filter(function (x) { return x.type === 'page' && x.url.indexOf('devtools://') < 0; })[0];
  var conn = await cdp.connect(t.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');

  fs.writeFileSync(TEST,
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="app.css">' +
    '<style>html,body{margin:0;background:#eef1f5}</style></head><body></body></html>', 'utf8');
  await send('Page.navigate', { url: 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/css/_fonttest.html' });
  await sleep(1500);

  async function ev(e) {
    var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return 'EXC ' + JSON.stringify(r.exceptionDetails).slice(0, 300); }
    return r.result.result.value;
  }

  /* 注入一个简单的中文块，看看能不能渲染出来 */
  var simple = '<div style="padding:30px"><h1>测试标题 Test 2026</h1>' +
    '<div class="zf-doc zf-doc--sheet">劳动仲裁申请书<br>申请人：张三，男，1995年3月12日出生。</div>' +
    '<div class="zf-doc">劳动仲裁申请书<br>申请人：张三，男，1995年3月12日出生。</div></div>';
  var r1 = await ev("(function(){document.body.innerHTML=" + JSON.stringify(simple) + ";return 'ok';})()");
  console.log('注入结果:', r1);
  await sleep(900);

  var geo = await ev([
    "(function(){",
    "  var o={ bodyH: document.body.getBoundingClientRect().height,",
    "          docH: document.documentElement.scrollHeight,",
    "          innerH: window.innerHeight, innerW: window.innerWidth,",
    "          children: document.body.children.length,",
    "          bodyText: (document.body.textContent||'').slice(0,80) };",
    "  var d=document.querySelector('.zf-doc--sheet');",
    "  if(d){var b=d.getBoundingClientRect(); o.sheet={w:Math.round(b.width),h:Math.round(b.height),t:Math.round(b.top),l:Math.round(b.left),vis:getComputedStyle(d).visibility,disp:getComputedStyle(d).display,color:getComputedStyle(d).color,ff:getComputedStyle(d).fontFamily.slice(0,40)};}",
    "  var h=document.querySelector('h1');",
    "  if(h){var hb=h.getBoundingClientRect(); o.h1={w:Math.round(hb.width),h:Math.round(hb.height),t:Math.round(hb.top),l:Math.round(hb.left)};}",
    "  return JSON.stringify(o);",
    "})()"
  ].join('\n'));
  console.log('几何:', geo);

  var s = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(__dirname, 'shots', 'diag-fonttest.png'), Buffer.from(s.result.data, 'base64'));
  console.log('✓ diag-fonttest.png', fs.statSync(path.join(__dirname, 'shots', 'diag-fonttest.png')).size, 'bytes');

  try { fs.unlinkSync(TEST); } catch (e) {}
  process.exit(0);
})().catch(function (e) { console.error('ERR', e); process.exit(1); });
