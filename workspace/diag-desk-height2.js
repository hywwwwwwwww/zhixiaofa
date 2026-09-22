// diag-desk-height2.js —— 精确定位撑高源 + 验证「页签并入卡片头」的空间收益
// 用法: python workspace/runnode.py diag-desk-height2.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

// 1) 逐块拆解表单贡献  2) 隐藏页签行，观察 leftMost 变成多少
var PROBE = "(function(){" +
  "function r(sel){var e=document.querySelector(sel);if(!e)return null;return Math.round(e.getBoundingClientRect().height);}" +
  "var o={};" +
  "o.docH=document.documentElement.scrollHeight;" +
  "o.topbarH=r('.zf-topbar');" +
  "o.contentPt=getComputedStyle(document.querySelector('.zf-content')).paddingTop;" +
  "o.contentPb=getComputedStyle(document.querySelector('.zf-content')).paddingBottom;" +
  "o.appMinH=getComputedStyle(document.querySelector('.zf-app')).minHeight;" +
  "o.panelH=r('.zf-desk__panel');" +
  "o.tabsH=r('.zf-desk__panel > .zf-tabs');" +
  "o.inputH=r('.zf-desk__input');" +
  "o.resultH=r('.zf-desk__result');" +
  "o.headH=r('.zf-desk__input .zf-card__head');" +
  "o.uploadH=r('.zf-upload');" +
  "o.dividerH=r('.zf-upload__divider');" +
  "o.formH=r('.zf-desk__input form');" +
  "o.groups=[];var g=document.querySelectorAll('.zf-desk__input .zf-form-group');" +
  "for(var i=0;i<g.length;i++){o.groups.push(Math.round(g[i].getBoundingClientRect().height));}" +
  "o.actionsH=r('.zf-desk__input .zf-form-actions');" +
  "var f=document.querySelector('.zf-desk__input form');" +
  "o.formStyle=f?('mt='+getComputedStyle(f).marginTop+' mb='+getComputedStyle(f).marginBottom):'no form';" +
  // 左栏真实内容高（页签行 + 填写面板 + 页签与面板之间的 margin）
  "o.leftContentH=(o.tabsH||0)+(o.inputH||0)+Math.round(document.querySelector('.zf-desk__input').getBoundingClientRect().top-document.querySelector('.zf-desk__panel > .zf-tabs').getBoundingClientRect().bottom);" +
  // 隐藏页签行后，panel（stretch）会塌到多少
  "var tb=document.querySelector('.zf-desk__panel > .zf-tabs');" +
  "if(tb){tb.style.display='none';}" +
  "o.panelHNoTabs=r('.zf-desk__panel');" +
  "o.inputHNoTabs=r('.zf-desk__input');" +
  "o.deskHNoTabs=r('.zf-desk');" +
  "o.docHNoTabs=document.documentElement.scrollHeight;" +
  "if(tb){tb.style.display='';}" +
  "return JSON.stringify(o);})()";

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
      r.result.exceptionDetails.exception.description).slice(0, 220);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  var pages = ['pages/court.html', 'pages/contract-review.html'];
  for (var i = 0; i < pages.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    await pg.send('Page.navigate', { url: ROOT + '/' + pages[i] + '?v=diag2' });
    await cdp.sleep(1600);
    var raw = await ev(pg, PROBE);
    process.stdout.write('\n######## ' + pages[i] + '\n');
    if (String(raw).indexOf('__ERR__') === 0) {
      process.stdout.write(raw + '\n');
    } else {
      var d = JSON.parse(raw);
      process.stdout.write('  docH=' + d.docH + '  topbarH=' + d.topbarH +
        '  contentPt=' + d.contentPt + '  contentPb=' + d.contentPb + '  appMinH=' + d.appMinH + '\n');
      process.stdout.write('  panel=' + d.panelH + '  tabs=' + d.tabsH + '  input=' + d.inputH +
        '  result=' + d.resultH + '  leftContentH=' + d.leftContentH + '\n');
      process.stdout.write('  head=' + d.headH + '  upload=' + d.uploadH + '  divider=' + d.dividerH +
        '  form=' + d.formH + '  actions=' + d.actionsH + '  [form ' + d.formStyle + ']\n');
      process.stdout.write('  form-groups=' + JSON.stringify(d.groups) + '\n');
      process.stdout.write('  --- 隐藏页签行后 ---\n');
      process.stdout.write('  panel=' + d.panelHNoTabs + '  input=' + d.inputHNoTabs +
        '  desk=' + d.deskHNoTabs + '  docH=' + d.docHNoTabs + '\n');
    }
    pg.conn.socket.destroy();
  }
  process.exit(0);
})();
