// diag-desk-height.js —— 定位 court / contract 首屏溢出的真实撑高源
// 用法: python workspace/runnode.py diag-desk-height.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var PROBE = "(function(){" +
  "function box(sel){var e=document.querySelector(sel);if(!e)return null;" +
  "var r=e.getBoundingClientRect();var cs=getComputedStyle(e);" +
  "return {sel:sel,h:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom)," +
  "offH:Math.round(e.offsetHeight),mh:cs.minHeight,mxh:cs.maxHeight,disp:cs.display,pos:cs.position};}" +
  "var out={};" +
  "out.docH=document.documentElement.scrollHeight;" +
  "out.innerH=window.innerHeight;" +
  "out.bodyH=document.body.scrollHeight;" +
  "out.sel=[box('.zf-app'),box('.zf-main'),box('.zf-topbar'),box('.zf-content')," +
  "box('.zf-content .zf-desk'),box('.zf-desk__panel'),box('.zf-desk__panel > .zf-tabs')," +
  "box('.zf-desk__input'),box('.zf-desk__result'),box('.zf-desk__result-body')," +
  "box('#result-placeholder'),box('.zf-desk__result-foot')];" +
  // 逐层向上找「大于视口高度」的祖先链
  "var chain=[];var el=document.querySelector('.zf-desk__result');" +
  "while(el&&el!==document.documentElement){var r=el.getBoundingClientRect();" +
  "chain.push({tag:el.tagName+'.'+(el.className||'').toString().split(' ')[0]," +
  "h:Math.round(r.height),top:Math.round(r.top),bottom:Math.round(r.bottom)," +
  "mb:getComputedStyle(el).marginBottom,pt:getComputedStyle(el).paddingTop," +
  "pb:getComputedStyle(el).paddingBottom});el=el.parentElement;}" +
  "out.chain=chain;" +
  // 左栏表单内部逐块高度（找撑高它的元素）
  "var rows=[];var panel=document.querySelector('.zf-desk__input');" +
  "if(panel){var kids=panel.querySelectorAll('*');" +
  "for(var i=0;i<kids.length;i++){var k=kids[i];var kr=k.getBoundingClientRect();" +
  "if(kr.height>=38&&k.children.length<=6){rows.push({t:k.tagName+'.'+(k.className||'').toString().trim().replace(/\\s+/g,'.')," +
  "h:Math.round(kr.height),top:Math.round(kr.top)});}}}" +
  "rows.sort(function(a,b){return b.h-a.h;});out.leftBig=rows.slice(0,18);" +
  "return JSON.stringify(out);})()";

async function newPage(w, h, stubFile) {
  var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
  var conn = await cdp.connect(j.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  if (stubFile) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(stubFile, 'utf8') });
  }
  return { id: j.id, conn: conn, send: send };
}

async function ev(pg, expr) {
  var r = await pg.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 200);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  var pages = ['pages/court.html', 'pages/contract-review.html'];
  for (var i = 0; i < pages.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag' });
    await cdp.sleep(1600);
    var href = await ev(pg, 'document.location.href');
    process.stdout.write('\n######## ' + pages[i] + '  →  ' + href + '\n');
    var raw = await ev(pg, PROBE);
    if (String(raw).indexOf('__ERR__') === 0) {
      process.stdout.write(raw + '\n');
    } else {
      var d = JSON.parse(raw);
      process.stdout.write('docH=' + d.docH + '  innerH=' + d.innerH + '  bodyH=' + d.bodyH + '\n');
      process.stdout.write('--- 关键盒子 ---\n');
      d.sel.forEach(function (b) {
        if (!b) { return; }
        process.stdout.write('  ' + b.sel + '  h=' + b.h + ' top=' + b.top + ' bottom=' + b.bottom +
          '  minH=' + b.mh + ' maxH=' + b.mxh + '\n');
      });
      process.stdout.write('--- 结果卡向上祖先链 ---\n');
      d.chain.forEach(function (c) {
        process.stdout.write('  ' + c.tag + '  h=' + c.h + ' top=' + c.top + ' bottom=' + c.bottom +
          '  pt=' + c.pt + ' pb=' + c.pb + ' mb=' + c.mb + '\n');
      });
      process.stdout.write('--- 左栏内部高块 top18 ---\n');
      d.leftBig.forEach(function (r) {
        process.stdout.write('  h=' + r.h + ' top=' + r.top + '  ' + r.t + '\n');
      });
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
