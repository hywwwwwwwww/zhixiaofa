// diag-hitarea3.js —— 逐个 .zf-home-refs / .zf-quick__item 测真实热区跨度
// 用法: python workspace/runnode.py diag-hitarea3.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

function spanExpr(sel) {
  return "function(){" +
    "var out=[];var els=document.querySelectorAll(" + JSON.stringify(sel) + ");" +
    "for(var i=0;i<Math.min(els.length,4);i++){var e=els[i];" +
    "e.scrollIntoView({block:'center'});" +
    "var r=e.getBoundingClientRect();var cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;" +
    "function h(y){var t=document.elementFromPoint(cx,y);return !!(t&&(t===e||e.contains(t)));}" +
    "var u=0;while(u<60&&h(cy-u-1))u++;var v=0;while(v<60&&h(cy+v+1))v++;" +
    "out.push({i:i,txt:(e.textContent||'').trim().slice(0,12),h:Math.round(r.height)," +
    "up:u,dn:v,span:u+v+1,top:Math.round(r.top)});}" +
    "return JSON.stringify(out);}";
}

async function newPage(w, h, stubFile) {
  var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
  var conn = await cdp.connect(j.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable', {}); await send('Runtime.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  if (stubFile) { await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(stubFile, 'utf8') }); }
  return { id: j.id, conn: conn, send: send };
}
async function ev(pg, expr) {
  var r = await pg.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 260);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  var pg = await newPage(1440, 900, 'zc-stub-home.js');
  await pg.send('Page.navigate', { url: ROOT + '/pages/home.html?v=diaghit3' });
  await cdp.sleep(1600);
  await ev(pg, '(function(){var it=document.querySelector(".zf-home-item");if(it){it.click();}return 1;})()');
  await cdp.sleep(700);
  var a = await ev(pg, '(' + spanExpr('.zf-home-refs') + ')()');
  process.stdout.write('\n--- .zf-home-refs 逐个热区跨度 ---\n');
  if (String(a).indexOf('__ERR__') === 0) { process.stdout.write(a + '\n'); }
  else { JSON.parse(a).forEach(function (o) {
    process.stdout.write('  [' + o.i + '] ' + JSON.stringify(o.txt) + '  自身高=' + o.h +
      '  热区跨度=' + o.span + 'px（上' + o.up + ' / 下' + o.dn + '）  top=' + o.top + '\n'); }); }
  pg.conn.socket.destroy();

  var pg2 = await newPage(1440, 900, 'zc-stub-home.js');
  await pg2.send('Page.navigate', { url: ROOT + '/pages/court.html?v=diaghit4' });
  await cdp.sleep(1600);
  var b = await ev(pg2, '(' + spanExpr('.zf-quick__item') + ')()');
  process.stdout.write('\n--- .zf-quick__item 逐个热区跨度 ---\n');
  if (String(b).indexOf('__ERR__') === 0) { process.stdout.write(b + '\n'); }
  else { JSON.parse(b).forEach(function (o) {
    process.stdout.write('  [' + o.i + '] ' + JSON.stringify(o.txt) + '  自身高=' + o.h +
      '  热区跨度=' + o.span + 'px（上' + o.up + ' / 下' + o.dn + '）\n'); }); }
  var b2 = await ev(pg2, '(function(){var e=document.querySelector(".zf-quick__item");' +
    'if(!e)return "none";var af=getComputedStyle(e,"::after");' +
    'return JSON.stringify({content:af.content,pos:af.position,top:af.top,bottom:af.bottom,' +
    'minH:af.minHeight,margin:af.margin});})()');
  process.stdout.write('  .zf-quick__item::after = ' + b2 + '\n');
  pg2.conn.socket.destroy();
  process.exit(0);
})();
