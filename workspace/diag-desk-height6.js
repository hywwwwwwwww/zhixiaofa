// diag-desk-height6.js —— contract 剩余 20px：定位「表单 540px」里哪一段可以再收
// 用法: python workspace/runnode.py diag-desk-height6.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

// 逐层次高：目标是把 .zf-desk__input 从 756 收到 736（-20px）
var PROBE = "(function(){" +
  "function H(){return document.documentElement.scrollHeight;}" +
  "function R(sel){var e=document.querySelector(sel);return e?Math.round(e.getBoundingClientRect().height):null;}" +
  "var o={};o.docH=H();o.panel=R('.zf-desk__panel');o.input=R('.zf-desk__input');" +
  "o.tabs=R('.zf-desk__panel > .zf-tabs');o.head=R('.zf-desk__input .zf-card__head');" +
  "o.upload=R('.zf-upload');o.divider=R('.zf-upload__divider');o.form=R('.zf-desk__input form');" +
  "o.actions=R('.zf-desk__input .zf-form-actions');" +
  "o.ta=R('#cf-content');" +
  // 表单内每段
  "var g=document.querySelectorAll('.zf-desk__input .zf-form-group');var gs=[];" +
  "for(var i=0;i<g.length;i++){var sub=g[i].querySelector('.zf-subtitle');" +
  "gs.push({h:Math.round(g[i].getBoundingClientRect().height)," +
  "mb:getComputedStyle(g[i]).marginBottom," +
  "sub:sub?Math.round(sub.getBoundingClientRect().height):null," +
  "flds:g[i].querySelectorAll('.zf-field').length});}" +
  "o.groups=JSON.stringify(gs);" +
  // 输入框与字段的间距明细
  "var f0=document.querySelector('.zf-desk__input .zf-field');" +
  "o.fieldMb=f0?getComputedStyle(f0).marginBottom:null;" +
  "o.lblH=R('.zf-desk__input .zf-form-label');" +
  "o.ctrlH=R('.zf-desk__input .zf-form-control');" +
  // 各缩减手段单独测
  "var ta=document.querySelector('#cf-content');" +
  "o.taCssH=getComputedStyle(ta).height;o.taMinH=getComputedStyle(ta).minHeight;" +
  "ta.style.height='90px';o.ta90=H();o.ta90_input=R('.zf-desk__input');" +
  "ta.style.height='76px';o.ta76=H();o.ta76_input=R('.zf-desk__input');" +
  "ta.style.height='';" +
  // 上传区分隔行去掉
  "var dv=document.querySelector('.zf-upload__divider');var dvOld=dv?dv.style.display:null;" +
  "if(dv){dv.style.display='none';}o.noDivider=H();o.noDivider_input=R('.zf-desk__input');" +
  "if(dv){dv.style.display=dvOld||'';}" +
  // 上传区收紧 14px
  "var up=document.querySelector('.zf-upload');var upOld=up?up.style.padding:null;" +
  "if(up){up.style.padding='9px 12px';}o.upThin=H();o.upThin_input=R('.zf-desk__input');" +
  "if(up){up.style.padding=upOld||'';}" +
  // 三个 form-group 的 margin-bottom 归零
  "var gsEl=document.querySelectorAll('.zf-desk__input .zf-form-group');var old=[];" +
  "for(var i=0;i<gsEl.length;i++){old.push(gsEl[i].style.marginBottom);gsEl[i].style.marginBottom='0px';}" +
  "o.noGroupMb=H();" +
  "for(var i=0;i<gsEl.length;i++){gsEl[i].style.marginBottom=old[i];}" +
  // 字段 margin-bottom 归零
  "var fEls=document.querySelectorAll('.zf-desk__input .zf-field');var old2=[];" +
  "for(var i=0;i<fEls.length;i++){old2.push(fEls[i].style.marginBottom);fEls[i].style.marginBottom='0px';}" +
  "o.noFieldMb=H();" +
  "for(var i=0;i<fEls.length;i++){fEls[i].style.marginBottom=old2[i];}" +
  // 卡内 padding 收紧
  "var ip=document.querySelector('.zf-desk__input');var ipOld=ip.style.padding;" +
  "ip.style.padding='14px 16px';o.cardPad14=H();o.cardPad14_input=R('.zf-desk__input');" +
  "ip.style.padding='12px 16px';o.cardPad12=H();" +
  "ip.style.padding=ipOld||'';" +
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
  await pg.send('Page.navigate', { url: ROOT + '/pages/contract-review.html?v=diag7' });
  await cdp.sleep(1600);
  var raw = await ev(pg, PROBE);
  if (String(raw).indexOf('__ERR__') === 0) { process.stdout.write(raw + '\n'); pg.conn.socket.destroy(); process.exit(1); }
  var d = JSON.parse(raw);
  process.stdout.write('\n######## contract-review  现状\n');
  process.stdout.write('  docH=' + d.docH + ' panel=' + d.panel + ' input=' + d.input +
    ' tabs=' + d.tabs + ' head=' + d.head + ' upload=' + d.upload + ' divider=' + d.divider + '\n');
  process.stdout.write('  form=' + d.form + ' actions=' + d.actions + ' ta=' + d.ta +
    '  [ta css height=' + d.taCssH + ' minH=' + d.taMinH + ']\n');
  process.stdout.write('  form-groups=' + d.groups + '\n');
  process.stdout.write('  field.margin-bottom=' + d.fieldMb + '  label.h=' + d.lblH + '  control.h=' + d.ctrlH + '\n');
  process.stdout.write('--- 各手段单测（docH / input）---\n');
  process.stdout.write('  textarea → 90px        docH=' + d.ta90 + ' input=' + d.ta90_input + '\n');
  process.stdout.write('  textarea → 76px        docH=' + d.ta76 + ' input=' + d.ta76_input + '\n');
  process.stdout.write('  隐藏分隔行             docH=' + d.noDivider + ' input=' + d.noDivider_input + '\n');
  process.stdout.write('  上传区 padding 9/12    docH=' + d.upThin + ' input=' + d.upThin_input + '\n');
  process.stdout.write('  form-group mb→0        docH=' + d.noGroupMb + '\n');
  process.stdout.write('  field mb→0             docH=' + d.noFieldMb + '\n');
  process.stdout.write('  卡内 padding 14/16     docH=' + d.cardPad14 + ' input=' + d.cardPad14_input + '\n');
  process.stdout.write('  卡内 padding 12/16     docH=' + d.cardPad12 + '\n');
  pg.conn.socket.destroy();
  process.exit(0);
})();
