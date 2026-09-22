/**
 * 截图 + 测量首页指标卡（写文件，避免内联 JS 被 bash 解释）
 * 用法：node shot-stat.js [port] [输出名] [宽] [高]
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var NAME = process.argv[3] || 'stat.png';
var W = parseInt(process.argv[4], 10) || 1440;
var H = parseInt(process.argv[5], 10) || 900;
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var SHOT_DIR = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOT_DIR)) { fs.mkdirSync(SHOT_DIR); }

var GEO = `(function () {
  var c = document.querySelector('#stat-grid .zf-stat');
  var ico = c.querySelector('.zf-stat__icon');
  var go = c.querySelector('.zf-stat__go');
  var lab = c.querySelector('.zf-stat__label');
  var cs = getComputedStyle(c);
  var cr = c.getBoundingClientRect();
  var ir = ico.getBoundingClientRect();
  var gr = go.getBoundingClientRect();
  var lr = lab.getBoundingClientRect();
  return {
    card: { l: +cr.left.toFixed(1), w: +cr.width.toFixed(1) },
    padL: parseFloat(cs.paddingLeft),
    contentLeft: +(cr.left + parseFloat(cs.paddingLeft)).toFixed(1),
    icon: { l: +ir.left.toFixed(1), w: +ir.width.toFixed(1), h: +ir.height.toFixed(1) },
    iconOff: +(ir.left - (cr.left + parseFloat(cs.paddingLeft))).toFixed(1),
    label: { l: +lr.left.toFixed(1), w: +lr.width.toFixed(1) },
    labelOff: +(lr.left - (cr.left + parseFloat(cs.paddingLeft))).toFixed(1),
    goOffRight: +((cr.right - parseFloat(cs.paddingRight)) - gr.right).toFixed(1),
    goTop: +(gr.top - cr.top).toFixed(1),
    gridCols: cs.gridTemplateColumns,
    display: cs.display
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
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2300);

  var g = await send('Runtime.evaluate', { expression: GEO, returnByValue: true });
  console.log(JSON.stringify(g.result.result.value || g.result.value, null, 2));

  var r = await send('Page.captureScreenshot', {
    format: 'png', clip: { x: 190, y: 130, width: 880, height: 240, scale: 2 }
  });
  if (r && r.result && r.result.data) {
    fs.writeFileSync(path.join(SHOT_DIR, NAME), Buffer.from(r.result.data, 'base64'));
    console.log('saved ' + NAME);
  } else {
    console.log('截取失败');
  }
  process.exit(0);
})();
