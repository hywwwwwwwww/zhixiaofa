/**
 * 缓存行为探针：故意写一个"记号"样式，验证 headless Edge 是否真的读到了最新 app.css。
 *
 * 做法：往 app.css 注入一条唯一命名的规则，然后读取该元素的 computed 值。
 * 读到记号 = 缓存正常；读不到 = 之前所有测量都基于旧文件（即此前的"改动无效"是假象）。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

var SRC = Array.prototype.slice.call(process.argv, 3).join(' ');
if (!SRC) { SRC = '.zf-content--home #stat-grid .zf-stat__icon { outline: 7px solid rgb(1,2,3); }'; }

var EXPR = `(function () {
  var ico = document.querySelector('#stat-grid .zf-stat__icon');
  var cs = getComputedStyle(ico);
  var ss = document.querySelectorAll('link[rel=stylesheet]');
  return {
    outlineColor: cs.outlineColor,
    outlineWidth: cs.outlineWidth,
    width: cs.width,
    hrefs: Array.prototype.map.call(ss, function (l) { return l.getAttribute('href'); })
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
  await cdp.sleep(2000);

  // 先读基线
  var a = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  console.log('注入前:', JSON.stringify(a.result.result.value || a.result.value));

  // 动态注入记号样式
  await send('Runtime.evaluate', {
    expression: 'var s=document.createElement("style");s.id="probe";' +
      's.textContent=' + JSON.stringify(SRC) + ';document.head.appendChild(s);"ok"'
  });
  await cdp.sleep(300);

  var b = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
  console.log('注入后:', JSON.stringify(b.result.result.value || b.result.value));
  process.exit(0);
})();
