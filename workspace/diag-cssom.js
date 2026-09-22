// diag-cssom.js —— 为什么 __zfScanCss 命中 0 条？
// 用法: python workspace/runnode.py diag-cssom.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "var o={sheets:document.styleSheets.length,per:[]};" +
  "for(var i=0;i<document.styleSheets.length;i++){" +
  "var sh=document.styleSheets[i];var entry={i:i,href:(sh.href||'(inline)').slice(-48),n:null,err:null," +
  "top:0,tail:[],hasReduce:false,hasFocusVis:false};" +
  "try{entry.n=sh.cssRules.length;}catch(e){entry.err=String(e).slice(0,80);o.per.push(entry);continue;}" +
  "for(var j=0;j<entry.n;j++){var r=sh.cssRules[j];" +
  "var t=r.cssText||'';" +
  "if(t.indexOf('prefers-reduced-motion')>=0)entry.hasReduce=true;" +
  "if(t.indexOf('focus-visible')>=0)entry.hasFocusVis=true;" +
  "}" +
  "for(var k=Math.max(0,entry.n-3);k<entry.n;k++){entry.tail.push((sh.cssRules[k].cssText||'').slice(0,70));}" +
  "o.per.push(entry);}" +
  "o.docSheetsMax=0;" +
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
      r.result.exceptionDetails.exception.description).slice(0, 300);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  var pg = await newPage(1440, 900, 'zc-stub-home.js');
  await pg.send('Page.navigate', { url: ROOT + '/pages/court.html?v=diagcssom' });
  await cdp.sleep(1600);
  var href = await ev(pg, 'document.location.href');
  process.stdout.write('href=' + href + '\n');
  var raw = await ev(pg, PROBE);
  if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
  else {
    var d = JSON.parse(raw);
    process.stdout.write('styleSheets 总数 = ' + d.sheets + '\n');
    d.per.forEach(function (s) {
      process.stdout.write('  #' + s.i + ' ' + s.href + '  rules=' + s.n +
        '  err=' + s.err + '  reduce=' + s.hasReduce + '  focusVisible=' + s.hasFocusVis + '\n');
      if (s.tail) { s.tail.forEach(function (t) { process.stdout.write('        tail: ' + t.replace(/\n/g, ' ') + '\n'); }); }
    });
  }
  pg.conn.socket.destroy();
  process.exit(0);
})();
