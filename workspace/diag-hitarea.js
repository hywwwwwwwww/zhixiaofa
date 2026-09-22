// diag-hitarea.js —— 为什么 .zf-home-refs 的 ::after 热区没有 44px
// 用法: python workspace/runnode.py diag-hitarea.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "var els=document.querySelectorAll('.zf-home-refs');" +
  "var out=[];" +
  "for(var i=0;i<els.length;i++){var e=els[i];" +
  "var r=e.getBoundingClientRect();" +
  "var cs=getComputedStyle(e);var af=getComputedStyle(e,'::after');" +
  "out.push({i:i,txt:(e.textContent||'').trim().slice(0,16)," +
  "w:Math.round(r.width),h:Math.round(r.height)," +
  "tag:e.tagName,disp:cs.display,pos:cs.position," +
  "afPos:af.position,afW:af.width,afH:af.height,afMinW:af.minWidth,afMinH:af.minHeight," +
  "afTop:af.top,afBottom:af.bottom,afLeft:af.left,afRight:af.right,afMargin:af.margin," +
  "afContent:af.content,afTransform:af.transform});}" +
  /* 用打点看真相：中心向上 20px 命中了谁 */
  "var e0=els[0];if(e0){e0.scrollIntoView({block:'center'});" +
  "var r0=e0.getBoundingClientRect();var cx=(r0.left+r0.right)/2,cy=(r0.top+r0.bottom)/2;" +
  "function who(x,y){var t=document.elementFromPoint(x,y);if(!t)return 'null';" +
  "return t.tagName+'.'+String(t.className||'').split(' ').slice(0,2).join('.');}" +
  "var pts=[];for(var d=-26;d<=26;d+=4){pts.push({dy:d,who:who(cx,cy+d),isRefs:who(cx,cy+d).indexOf('zf-home-refs')>=0});}" +
  "out.push({scan:pts});}" +
  "return JSON.stringify(out);})()";

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
  await pg.send('Page.navigate', { url: ROOT + '/pages/home.html?v=diaghit' });
  await cdp.sleep(1600);
  // 展开第一个问答，让 .zf-home-refs 出现
  await ev(pg, '(function(){var it=document.querySelector(".zf-home-item");if(it){it.click();}return "clicked";})()');
  await cdp.sleep(700);
  var raw = await ev(pg, PROBE);
  if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
  else {
    var d = JSON.parse(raw);
    process.stdout.write('\n######## .zf-home-refs 计算机样式\n');
    d.forEach(function (o) {
      if (o.scan) {
        process.stdout.write('  --- 中心纵向打点（-26 ~ +26px）---\n');
        o.scan.forEach(function (p) {
          process.stdout.write('    dy=' + (p.dy >= 0 ? '+' : '') + p.dy + '  ' +
            (p.isRefs ? 'HIT ' : 'miss') + '  ' + p.who + '\n');
        });
        return;
      }
      process.stdout.write('  [' + o.i + '] ' + o.tag + ' ' + o.w + '×' + o.h + '  ' + JSON.stringify(o.txt) + '\n');
      process.stdout.write('      el: display=' + o.disp + ' position=' + o.pos + '\n');
      process.stdout.write('      ::after content=' + o.afContent + ' position=' + o.afPos + '\n');
      process.stdout.write('      ::after w=' + o.afW + ' h=' + o.afH + ' minW=' + o.afMinW + ' minH=' + o.afMinH + '\n');
      process.stdout.write('      ::after top=' + o.afTop + ' bottom=' + o.afBottom +
        ' left=' + o.afLeft + ' right=' + o.afRight + '\n');
      process.stdout.write('      ::after margin=' + o.afMargin + ' transform=' + o.afTransform + '\n');
    });
  }
  pg.conn.socket.destroy();
  process.exit(0);
})();
