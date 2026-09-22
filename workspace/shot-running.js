// shot-running.js —— 取证：AI 长任务「进行中态」与「结果态」截图
// 用 XHR 延迟桩保住中间态，再截两张图。
// 用法: python workspace/runnode.py shot-running.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';
var OUT = 'shots/';

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
      r.result.exceptionDetails.exception.description).slice(0, 200);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}
async function shot(pg, name) {
  var r = await pg.send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(OUT + name, Buffer.from(r.result.data, 'base64'));
  process.stdout.write('OK  ' + name + '  ' + fs.statSync(OUT + name).size + 'B\n');
}

(async function () {
  var pg = await newPage(1440, 900, 'zc-stub-home.js');
  await pg.send('Page.navigate', { url: ROOT + '/pages/court.html?v=shotrun' });
  await cdp.sleep(1600);
  // 把 XHR 延迟 4s，保住中间态
  await ev(pg, '(function(){var R=window.XMLHttpRequest;window.XMLHttpRequest=function(){' +
    'var x=new R();var o=x.send;x.send=function(b){var s=this;' +
    'setTimeout(function(){try{o.call(s,b);}catch(e){}},4000);};return x;};return 1;})()');
  // 触发推演
  await ev(pg, '(function(){' +
    '$("#court-desc").val("2026年9月13日公司以组织架构调整为由单方解除劳动合同，未提前三十日通知，月工资16000元。").trigger("input");' +
    '$("#court-type .zf-tag[data-v=违法辞退]").trigger("click");' +
    '$("#court-form").trigger("submit");return 1;})()');
  await cdp.sleep(900);
  await shot(pg, 'uit-court-running.png');   // 阶段 1 进行中
  await cdp.sleep(1900);
  await shot(pg, 'uit-court-running2.png');  // 阶段推进后
  await cdp.sleep(2600);
  // 夹具/法条展开态
  await shot(pg, 'uit-court-result.png');    // 真实结果已渲染

  // contract 同款
  var pg2 = await newPage(1440, 900, 'zc-stub-home.js');
  await pg2.send('Page.navigate', { url: ROOT + '/pages/contract-review.html?v=shotrun2' });
  await cdp.sleep(1600);
  await ev(pg2, '(function(){var R=window.XMLHttpRequest;window.XMLHttpRequest=function(){' +
    'var x=new R();var o=x.send;x.send=function(b){var s=this;' +
    'setTimeout(function(){try{o.call(s,b);}catch(e){}},4000);};return x;};return 1;})()');
  await ev(pg2, '(function(){' +
    '$("#cf-name").val("2024劳动合同");$("#cf-type").val("劳动合同").trigger("change");' +
    '$("#cf-content").val("第一条 试用期为六个月。第二条 乙方在合同期内不得结婚生育。第三条 甲方有权随时单方调整乙方工作岗位及薪酬。").trigger("input");' +
    '$("#contract-form").trigger("submit");return 1;})()');
  await cdp.sleep(1100);
  await shot(pg2, 'uit-contract-running.png');
  await cdp.sleep(3600);
  await shot(pg2, 'uit-contract-result.png');
  pg.conn.socket.destroy(); pg2.conn.socket.destroy();
  process.stdout.write('done\n');
  process.exit(0);
})();
