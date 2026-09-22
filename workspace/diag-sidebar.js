// diag-sidebar.js —— 验证「侧栏 height:100vh 撑高 .zf-app」这一根因
// 用法: python workspace/runnode.py diag-sidebar.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "function R(sel){var e=document.querySelector(sel);return e?Math.round(e.getBoundingClientRect().height):null;}" +
  "function H(){return document.documentElement.scrollHeight;}" +
  "var sb=document.querySelector('.zf-sidebar');" +
  "var innerH=window.innerHeight;" +
  "var o={docH:H(),innerH:innerH,sidebarH:R('.zf-sidebar'),appH:R('.zf-app')," +
  "sbCssH:getComputedStyle(sb).height,sbMinH:getComputedStyle(sb).minHeight,sbSticky:getComputedStyle(sb).position};" +
  // 假设 1：侧栏高度被自己锁在 100vh
  "o.h1_before=H();" +
  "sb.style.height='auto';o.h1_after=H();o.appAfter=R('.zf-app');" +
  "sb.style.height='';" +
  // 假设 2：改成 min-height + overflow 后能否同时满足「侧栏铺满」与「不撑高」
  "sb.style.height='auto';sb.style.minHeight='100vh';o.h2=H();o.sbH2=R('.zf-sidebar');" +
  "sb.style.height='';sb.style.minHeight='';" +
  // 假设 3：flex 子项默认 min-height:auto，试 min-height:0
  "sb.style.height='auto';sb.style.minHeight='0px';o.h3=H();o.sbH3=R('.zf-sidebar');" +
  "sb.style.height='';sb.style.minHeight='';" +
  // 对照：桌面（>1100px）侧栏显示；窄屏侧栏 display:none，看影响面
  "return JSON.stringify(o);})()";

async function newPage(w, h, stubFile) {
  var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
  var conn = await cdp.connect(j.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  if (stubFile) { await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(stubFile, 'utf8') }); }
  return { id: j.id, conn: conn, send: send };
}

async function ev(pg, expr) {
  var r = await pg.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 220);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  var pages = ['pages/court.html', 'pages/contract-review.html', 'pages/home.html', 'pages/knowledge.html'];
  for (var i = 0; i < pages.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag4' });
    await cdp.sleep(1600);
    var raw = await ev(pg, PROBE);
    process.stdout.write('\n######## ' + pages[i] + '\n');
    if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
    else {
      var d = JSON.parse(raw);
      process.stdout.write('  docH=' + d.docH + ' innerH=' + d.innerH + ' sidebarH=' + d.sidebarH +
        ' appH=' + d.appH + '  [css height=' + d.sbCssH + ' sticky=' + d.sbSticky + ']\n');
      process.stdout.write('  侧栏 height:auto          → docH=' + d.h1_after + '  app=' + d.appAfter + '\n');
      process.stdout.write('  侧栏 height:auto+minH100vh → docH=' + d.h2 + '  侧栏=' + d.sbH2 + '\n');
      process.stdout.write('  侧栏 height:auto+minH0     → docH=' + d.h3 + '  侧栏=' + d.sbH3 + '\n');
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
