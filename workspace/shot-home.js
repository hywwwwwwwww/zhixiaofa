/**
 * 首页截图工具（可复用）
 *
 * 用法：node shot-home.js <port> <输出文件名> [宽] [高] [启动前的高度档位]
 *
 * 说明：本环境 shell 缺 coreutils，内联 node -e 里写 Buffer 容易踩坑，
 * 因此统一走脚本文件。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var NAME = process.argv[3] || 'shot.png';
var W = parseInt(process.argv[4], 10) || 1440;
var H = parseInt(process.argv[5], 10) || 900;
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var SHOT_DIR = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOT_DIR)) { fs.mkdirSync(SHOT_DIR); }

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride',
    { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2200);

  // 整页截图（超出视口用 captureBeyondViewport）
  var res = await send('Page.captureScreenshot',
    { format: 'png', captureBeyondViewport: true });
  if (!res || !res.result || !res.result.data) {
    console.log('截图失败', JSON.stringify(res).slice(0, 300));
    process.exit(1);
  }
  var f = path.join(SHOT_DIR, NAME);
  fs.writeFileSync(f, Buffer.from(res.result.data, 'base64'));
  console.log('saved ' + f);
  process.exit(0);
})();
