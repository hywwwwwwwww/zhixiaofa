// diag-hitarea2.js —— 二分找 .zf-home-refs 热区的真实上下边界
// 用法: python workspace/runnode.py diag-hitarea2.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "var e=document.querySelectorAll('.zf-home-refs')[0];if(!e)return JSON.stringify({err:'none'});" +
  "e.scrollIntoView({block:'center'});" +
  "var r=e.getBoundingClientRect();var cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;" +
  "function isHit(y){var t=document.elementFromPoint(cx,y);" +
  "return !!(t&&(t===e||e.contains(t)||t.contains(e)));}" +
  "var up=0;while(up<40&&isHit(cy-up-1))up++;" +
  "var dn=0;while(dn<40&&isHit(cy+dn+1))dn++;" +
  "var pts=[];for(var d=-30;d<=30;d+=2){var t=document.elementFromPoint(cx,cy+d);" +
  "pts.push(d+(isHit(cy+d)?':H':':m')+'('+(t?t.tagName:'.')+')');}" +
  // 对照：同样测 .zf-tag 与 .zf-msg__act 作为「已达标」参照
  "function span(sel){var x=document.querySelectorAll(sel)[0];if(!x)return null;" +
  "x.scrollIntoView({block:'center'});var q=x.getBoundingClientRect();" +
  "var mx=(q.left+q.right)/2,my=(q.top+q.bottom)/2;" +
  "function h(y){var t=document.elementFromPoint(mx,y);return !!(t&&(t===x||x.contains(t)||t.contains(x)));}" +
  "var u=0;while(u<40&&h(my-u-1))u++;var v=0;while(v<40&&h(my+v+1))v++;" +
  "return {sel:sel,h:Math.round(q.height),up:u,dn:v,span:u+v+1};}" +
  "return JSON.stringify({refs:{h:Math.round(r.height),up:up,dn:dn,span:up+dn+1}," +
  "tag:span('.zf-tag'),act:span('.zf-msg__act'),pts:pts});})()";

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
  await pg.send('Page.navigate', { url: ROOT + '/pages/home.html?v=diaghit2' });
  await cdp.sleep(1600);
  await ev(pg, '(function(){var it=document.querySelector(".zf-home-item");if(it){it.click();}return 1;})()');
  await cdp.sleep(600);
  var raw = await ev(pg, PROBE);
  process.stdout.write('\n' + (String(raw).indexOf('__ERR__') === 0 ? raw : '') + '\n');
  if (String(raw).indexOf('__ERR__') !== 0) {
    var d = JSON.parse(raw);
    process.stdout.write('  .zf-home-refs 自身高 ' + d.refs.h + 'px，热区实测纵向跨度 ' + d.refs.span +
      'px（上 ' + d.refs.up + ' / 下 ' + d.refs.dn + '）\n');
    if (d.tag) { process.stdout.write('  对照 .zf-tag        高 ' + d.tag.h + 'px，跨度 ' + d.tag.span + 'px（上 ' + d.tag.up + ' / 下 ' + d.tag.dn + '）\n'); }
    if (d.act) { process.stdout.write('  对照 .zf-msg__act   高 ' + d.act.h + 'px，跨度 ' + d.act.span + 'px（上 ' + d.act.up + ' / 下 ' + d.act.dn + '）\n'); }
    process.stdout.write('  --- 中心纵向扫描 ---\n  ' + d.pts.join(' ') + '\n');
  }
  pg.conn.socket.destroy();
  process.exit(0);
})();
