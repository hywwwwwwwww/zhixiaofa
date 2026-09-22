/**
 * @file 决定性 A/B：把本次「可点击改造」的 CSS 全停掉，看 docH 是否回到 1220。
 *
 * 上一轮 diag 已排除「徽标 <button> 默认 padding」这个嫌疑（中和后 itemH/docH 纹丝不动）。
 * 现在换更强的打法：直接把 #tip-list / #qa-list 里我新加的所有 class 的效果一并中和，
 * 必要时把 DOM 还原成上一轮的形态（无 caret、徽标为 span）。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(e) {
    var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }; }
    return r.result.result.value;
  }

  async function measure(label) {
    var m = JSON.parse(await ev([
      "(function(){",
      "  var secs = document.querySelectorAll('.zf-content--home .zf-card');",
      "  var out = { docH: document.documentElement.scrollHeight, cards: [] };",
      "  secs.forEach(function(c){",
      "    out.cards.push(Math.round(c.getBoundingClientRect().height));",
      "  });",
      "  var qa = document.querySelectorAll('#qa-list .zf-home-item');",
      "  var ti = document.querySelectorAll('#tip-list .zf-home-item');",
      "  out.qaItemH = qa.length ? Math.round(qa[0].getBoundingClientRect().height) : -1;",
      "  out.tipItemH = ti.length ? Math.round(ti[0].getBoundingClientRect().height) : -1;",
      "  out.qaBoxH = Math.round(document.querySelector('#qa-list').getBoundingClientRect().height);",
      "  out.tipBoxH = Math.round(document.querySelector('#tip-list').getBoundingClientRect().height);",
      "  return JSON.stringify(out);",
      "})()"
    ].join('\n')));
    console.log('  ' + label + '  docH=' + m.docH + '  cards=' + JSON.stringify(m.cards) +
      '  qaItem=' + m.qaItemH + '  tipItem=' + m.tipItemH + '  qaBox=' + m.qaBoxH + '  tipBox=' + m.tipBoxH);
    return m;
  }

  console.log('A) 当前状态（含本次可点击改造）');
  var a = await measure('baseline');

  console.log('\nB) 停掉本次所有新样式');
  await ev("(function(){var e=document.createElement('style');e.id='__off';e.textContent='" +
    '.zf-content--home .zf-home-item{cursor:auto!important;padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important;border-radius:0!important}' +
    '.zf-content--home .zf-home-item__caret{display:none!important}' +
    '.zf-content--home .zf-home-refs{margin-top:0!important;padding:0!important}' +
    "';document.head.appendChild(e);})()");
  await sleep(300);
  var b = await measure('styles off');

  console.log('\nC) 再把 DOM 还原成上一轮形态（去掉 caret 节点、detail 容器）');
  await ev([
    "(function(){",
    "  document.querySelectorAll('.zf-home-item__caret').forEach(function(n){ n.remove(); });",
    "  document.querySelectorAll('#qa-list .zf-home-detail').forEach(function(n){ n.remove(); });",
    "})()"
  ].join('\n'));
  await sleep(300);
  var c = await measure('dom restored');

  console.log('\n差值分析：');
  console.log('  A - B = ' + (a.docH - b.docH) + 'px  （本次「样式」的贡献）');
  console.log('  B - C = ' + (b.docH - c.docH) + 'px  （本次「DOM 多出的节点」的贡献）');
  console.log('  A - C = ' + (a.docH - c.docH) + 'px  （本次改动总贡献）');
  console.log('  目标基线 = 1220px（上一轮指标卡改造后的实测值）');

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
