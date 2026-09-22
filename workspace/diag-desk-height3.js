// diag-desk-height3.js —— 精确测量：需要「再收多少 px」才能让 docH 落到 900
// 用法: python workspace/runnode.py diag-desk-height3.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

// 手段 A：把 .zf-card__head 的 margin-bottom 收 4px（行内样式，最高优先级）
// 手段 B：把 .zf-form-actions 的 margin-top + padding-top 各收 4px（共 8px）
// 手段 C：两者叠加
var PROBE = "(function(){" +
  "function H(){return document.documentElement.scrollHeight;}" +
  "function R(sel){var e=document.querySelector(sel);return e?Math.round(e.getBoundingClientRect().height):null;}" +
  "var o={};o.base=H();" +
  // 现状尺寸
  "o.headMb=getComputedStyle(document.querySelector('.zf-desk__input .zf-card__head')).marginBottom;" +
  "var fa=document.querySelector('.zf-desk__input .zf-form-actions');" +
  "o.faMt=getComputedStyle(fa).marginTop;o.faPt=getComputedStyle(fa).paddingTop;" +
  "var head=document.querySelector('.zf-desk__input .zf-card__head');" +
  "head.style.marginBottom='0px';o.A=H();o.A_input=R('.zf-desk__input');o.A_panel=R('.zf-desk__panel');" +
  "head.style.marginBottom='';" +
  "fa.style.marginTop='0px';fa.style.paddingTop='0px';o.B=H();" +
  "fa.style.marginTop='';fa.style.paddingTop='';" +
  "head.style.marginBottom='0px';fa.style.marginTop='0px';fa.style.paddingTop='0px';o.C=H();" +
  "head.style.marginBottom='';fa.style.marginTop='';fa.style.paddingTop='';" +
  // 逐 1px 试探：只改 head margin-bottom，看 docH 何时跌到 900 及以下
  "var seq=[];for(var m=0;m<=20;m++){head.style.marginBottom='-'+m+'px';" +
  "seq.push({neg:m,docH:H(),input:R('.zf-desk__input'),panel:R('.zf-desk__panel')});}" +
  "head.style.marginBottom='';o.seqHead=seq;" +
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
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag3' });
    await cdp.sleep(1600);
    var raw = await ev(pg, PROBE);
    process.stdout.write('\n######## ' + pages[i] + '\n');
    if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); }
    else {
      var d = JSON.parse(raw);
      process.stdout.write('  base docH=' + d.base + '  headMb=' + d.headMb +
        '  faMt=' + d.faMt + ' faPt=' + d.faPt + '\n');
      process.stdout.write('  A 卡头 margin 收 4px → docH=' + d.A + ' input=' + d.A_input + ' panel=' + d.A_panel + '\n');
      process.stdout.write('  B 操作条收 8px        → docH=' + d.B + '\n');
      process.stdout.write('  C 两者叠加            → docH=' + d.C + '\n');
      process.stdout.write('  --- head margin-bottom 逐 1px 收窄（docH / input / panel）---\n');
      d.seqHead.forEach(function (s) {
        if (s.neg % 2 === 0 || s.docH <= 902) {
          process.stdout.write('    -' + s.neg + 'px → docH=' + s.docH + ' input=' + s.input + ' panel=' + s.panel + '\n');
        }
      });
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
