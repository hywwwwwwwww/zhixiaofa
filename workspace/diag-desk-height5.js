// diag-desk-height5.js —— 拆穿 docH 与「内容底边到视口底」的差值
// 用法: python workspace/runnode.py diag-desk-height5.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "function R(sel){var e=document.querySelector(sel);if(!e)return null;var r=e.getBoundingClientRect();" +
  "return {h:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom)};}" +
  "var o={};o.innerH=window.innerHeight;o.docH=document.documentElement.scrollHeight;" +
  "o.bodyH=document.body.scrollHeight;o.bodyOffH=document.body.offsetHeight;" +
  "o.app=R('.zf-app');o.main=R('.zf-main');o.topbar=R('.zf-topbar');" +
  "o.content=R('.zf-content');o.desk=R('.zf-desk');o.panel=R('.zf-desk__panel');" +
  "o.input=R('.zf-desk__input');o.tabs=R('.zf-desk__panel > .zf-tabs');o.result=R('.zf-desk__result');" +
  "var c=document.querySelector('.zf-content');var cs=getComputedStyle(c);" +
  "o.contentPad='pt='+cs.paddingTop+' pb='+cs.paddingBottom;" +
  // 关键：内容（desk）底边 + padding-bottom 应该 = 视口底，看差多少
  "o.deskBottom = o.desk.bottom;" +
  "o.gapToViewport = o.innerH - o.desk.bottom;" +
  "o.deskH_official = R('.zf-desk').h;" +
  // 把 .zf-app 的 min-height:100vh 去掉，看 docH 是否立刻掉
  "var app=document.querySelector('.zf-app');var old=app.style.minHeight;" +
  "app.style.minHeight='0px';o.docH_noAppMinH=document.documentElement.scrollHeight;" +
  "app.style.minHeight=old;" +
  // 把 .zf-content 的 padding-bottom 临时去掉，观察 desk 底边是否不动（证明那 18px 是『壳』而不是『内容』）
  "var cOld=c.style.paddingBottom;c.style.paddingBottom='0px';" +
  "o.docH_noPb=document.documentElement.scrollHeight;o.desk_bottom_noPb=R('.zf-desk').bottom;" +
  "c.style.paddingBottom=cOld;" +
  // 元素级：谁在页面最底
  "var all=document.querySelectorAll('.zf-app *');var mx=null;" +
  "for(var i=0;i<all.length;i++){var bb=all[i].getBoundingClientRect();" +
  "if(bb.height<=0)continue;" +
  "if(!mx||bb.bottom>mx.bottom){mx={bottom:bb.bottom,t:all[i].tagName+'.'+String(all[i].className||'').trim().replace(/\\s+/g,'.')};}}" +
  "o.lowest=mx;" +
  // 页脚类元素
  "o.sidebar=R('.zf-sidebar');" +
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
  var pages = ['pages/court.html', 'pages/contract-review.html', 'pages/doc-drafting.html', 'pages/profile.html'];
  for (var i = 0; i < pages.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag6' });
    await cdp.sleep(1600);
    var raw = await ev(pg, PROBE);
    process.stdout.write('\n######## ' + pages[i] + '\n');
    if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
    else {
      var d = JSON.parse(raw);
      process.stdout.write('  innerH=' + d.innerH + '  docH=' + d.docH + ' bodyH=' + d.bodyH +
        '  bodyOffH=' + d.bodyOffH + '\n');
      process.stdout.write('  app=' + JSON.stringify(d.app) + '\n');
      process.stdout.write('  main=' + JSON.stringify(d.main) + '  topbar=' + JSON.stringify(d.topbar) + '\n');
      process.stdout.write('  content=' + JSON.stringify(d.content) + '  [' + d.contentPad + ']\n');
      process.stdout.write('  desk=' + JSON.stringify(d.desk) + ' panel=' + JSON.stringify(d.panel) + '\n');
      process.stdout.write('  tabs=' + JSON.stringify(d.tabs) + ' input=' + JSON.stringify(d.input) + '\n');
      process.stdout.write('  result=' + JSON.stringify(d.result) + '  sidebar=' + JSON.stringify(d.sidebar) + '\n');
      process.stdout.write('  desk 底边到视口底 gap=' + d.gapToViewport + '  去掉 app.minHeight→docH=' + d.docH_noAppMinH +
        '  去掉 content.pb→docH=' + d.docH_noPb + ' (desk.bottom=' + d.desk_bottom_noPb + ')\n');
      process.stdout.write('  页面最底元素: ' + d.lowest.t + ' bottom=' + Math.round(d.lowest.bottom) + '\n');
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
