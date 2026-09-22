// diag-desk-height4.js —— 找出 docH 918（视口 900）里那 18px 的真实来源
// 用法: python workspace/runnode.py diag-desk-height4.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

// 逐层把内容的 min-height 归零，看 918 能退到多少
var PROBE = "(function(){" +
  "function H(){return document.documentElement.scrollHeight;}" +
  "function set(el,prop,val){el.style[prop]=val;}" +
  "var res=document.querySelector('.zf-desk__result');" +
  "var app=document.querySelector('.zf-app');" +
  "var o={};" +
  // 结果卡高度实时算
  "o.resultMinH=getComputedStyle(res).minHeight;" +
  "o.calcRes=getComputedStyle(res).minHeight;" +
  "o.innerH=window.innerHeight;" +
  "o.appMinH=getComputedStyle(app).minHeight;" +
  // 验证 calc(100vh - 112px) 是否等于 788
  "var probe=document.createElement('div');probe.style.cssText='position:absolute;left:-9999px;height:calc(100vh - 112px)';" +
  "document.body.appendChild(probe);o.calcProbe112=Math.round(probe.getBoundingClientRect().height);" +
  "probe.style.height='calc(100vh - 130px)';o.calcProbe130=Math.round(probe.getBoundingClientRect().height);" +
  "probe.style.height='calc(100vh - 100px)';o.calcProbe100=Math.round(probe.getBoundingClientRect().height);" +
  "probe.remove();" +
  // 把结果卡 min-height 逐步减小，看 docH 何时到 900
  "function R(sel){var e=document.querySelector(sel);return e?Math.round(e.getBoundingClientRect().height):null;}" +
  "var seq=[];" +
  "for(var d=0;d<=40;d+=2){" +
  "res.style.minHeight='calc(100vh - '+(112+d)+'px)';res.style.maxHeight='calc(100vh - '+(112+d)+'px)';" +
  "seq.push({delta:d,docH:H(),result:R('.zf-desk__result'),desk:R('.zf-desk'),content:R('.zf-content')});}" +
  "res.style.minHeight='';res.style.maxHeight='';o.seqResult=seq;" +
  // 归零 content 的 padding 看基础高
  "var content=document.querySelector('.zf-content');" +
  "content.style.paddingBottom='0px';o.noPb=H();content.style.paddingTop='0px';o.noPtPb=H();" +
  "content.style.paddingTop='';content.style.paddingBottom='';" +
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
  var pages = ['pages/court.html', 'pages/contract-review.html'];
  for (var i = 0; i < pages.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag5' });
    await cdp.sleep(1600);
    var raw = await ev(pg, PROBE);
    process.stdout.write('\n######## ' + pages[i] + '\n');
    if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
    else {
      var d = JSON.parse(raw);
      process.stdout.write('  result.minHeight=' + d.resultMinH + '  innerH=' + d.innerH +
        '  app.minHeight=' + d.appMinH + '\n');
      process.stdout.write('  calc(100vh-112)=' + d.calcProbe112 + '  (100vh-130)=' + d.calcProbe130 +
        '  (100vh-100)=' + d.calcProbe100 + '\n');
      process.stdout.write('  去掉 content padding-bottom → docH=' + d.noPb +
        '  再去 padding-top → docH=' + d.noPtPb + '\n');
      process.stdout.write('  --- 结果卡 min-height 逐步收窄（docH / result / desk / content）---\n');
      d.seqResult.forEach(function (s) {
        if (s.delta % 4 === 0 || s.docH <= 902) {
          process.stdout.write('    100vh-' + (112 + s.delta) + ' → docH=' + s.docH +
            ' result=' + s.result + ' desk=' + s.desk + ' content=' + s.content + '\n');
        }
      });
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
