// shot-audit.js —— UI 体检取证截图（4 页关键状态）
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var JOBS = [
  { f: 'pages/home.html', stub: 'zc-stub-home.js', out: 'uit-home.png', w: 1440, h: 900, full: true },
  { f: 'pages/qa.html', stub: 'zc-stub-home.js', out: 'uit-qa.png', w: 1440, h: 900, full: false },
  { f: 'pages/court.html', stub: 'zc-stub-home.js', out: 'uit-court.png', w: 1440, h: 900, full: false },
  { f: 'pages/knowledge.html', stub: 'zc-stub-home.js', out: 'uit-kn.png', w: 1440, h: 900, full: true },
  { f: 'pages/profile.html', stub: 'zc-stub-pf.js', out: 'uit-pf.png', w: 1440, h: 900, full: false },
  { f: 'pages/doc-drafting.html', stub: 'zc-stub-home.js', out: 'uit-doc.png', w: 1440, h: 900, full: false },
  { f: 'pages/contract-review.html', stub: 'zc-stub-home.js', out: 'uit-contract.png', w: 1440, h: 900, full: false },
  { f: 'pages/home.html', stub: 'zc-stub-home.js', out: 'uit-home-phone.png', w: 560, h: 900, full: false }
];

(async function () {
  for (var i = 0; i < JOBS.length; i++) {
    var J = JOBS[i];
    var stub = fs.readFileSync(J.stub, 'utf8');
    var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
    var conn = await cdp.connect(j.webSocketDebuggerUrl);
    var send = conn.send;
    await send('Page.enable', {});
    await send('Runtime.enable', {});
    await send('Emulation.setDeviceMetricsOverride', { width: J.w, height: J.h, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: ROOT + '/' + J.f });
    await cdp.sleep(400);
    await send('Page.addScriptToEvaluateOnNewDocument', { source: stub });
    await send('Page.navigate', { url: ROOT + '/' + J.f });
    await cdp.sleep(1600);

    var params = { format: 'png' };
    if (J.full) { params.captureBeyondViewport = true; }
    var r = await send('Page.captureScreenshot', params);
    var data = r.result && r.result.data;
    if (data && typeof data === 'string') {
      fs.writeFileSync('shots/' + J.out, Buffer.from(data, 'base64'));
      process.stdout.write('OK  ' + J.out + '  ' + fs.statSync('shots/' + J.out).size + 'B\n');
    } else {
      process.stdout.write('FAIL ' + J.out + '  keys=' + Object.keys(r || {}).join(',') + '\n');
    }
    conn.socket.destroy();
  }
  process.stdout.write('done\n');
})();
