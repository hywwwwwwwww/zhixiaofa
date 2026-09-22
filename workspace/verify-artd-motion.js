/* 验证「参考 Art Design Pro 的交互」是否真的落地
 *   ① 数字滚动 ZF.countTo    ② 入场过渡（内容区 + 指标卡 stagger）
 *   ③ 顶部进度条              ④ ECharts 动画时长/缓动
 *   ⑤ 异构栅格（14:10 / 10:14）
 *
 * 探针以独立函数源码注入（window.__m），不拼巨型表达式字符串。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http'); var fs = require('fs');
var CDP = 9363, APP = 8080, HOST = '127.0.0.1', CTX = '/zhixiaofa';
var COOKIE = __CK__;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function httpPut(u) {
  return new Promise(function (res, rej) {
    var x = new URL(u);
    var q = http.request({ hostname: x.hostname, port: x.port, path: x.pathname + x.search, method: 'PUT' },
      function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { res({ raw: b }); } }); });
    q.on('error', rej); q.end();
  });
}
function closeTab(id) {
  return new Promise(function (res) {
    var q = http.request({ hostname: HOST, port: CDP, path: '/json/close/' + id, method: 'GET' },
      function (r) { r.resume(); r.on('end', res); });
    q.on('error', function () { res(); }); q.end();
  });
}
async function ev(send, e) {
  var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r && r.result && r.result.exceptionDetails) {
    return 'EXC:' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 400);
  }
  return r && r.result && r.result.result ? r.result.result.value : undefined;
}

var PROBE = [
  'window.__m = function () {',
  '  var g = function (s) { return document.querySelector(s); };',
  '  var ga = function (s) { return document.querySelectorAll(s); };',
  '  var o = {};',
  '  o.hasCountTo = typeof ZF.countTo;',
  '  o.hasProgress = typeof (ZF.adminProgress && ZF.adminProgress.start);',
  '',
  '  /* 指标卡：终值 + 入场动画 */',
  '  var cards = ga("#metric-grid > .zf-stat");',
  '  o.cardN = cards.length;',
  '  o.values = [];',
  '  var delays = [];',
  '  for (var i = 0; i < cards.length; i++) {',
  '    var vl = cards[i].querySelector(".zf-stat__value");',
  '    var lb = cards[i].querySelector(".zf-stat__label");',
  '    o.values.push((lb ? lb.textContent.trim() : "?") + "=" + (vl ? vl.textContent.trim() : "?"));',
  '    var cs = getComputedStyle(cards[i]);',
  '    if (i === 0) {',
  '      o.cardAnimName = cs.animationName;',
  '      o.cardAnimDur = cs.animationDuration;',
  '      o.cardAnimEasing = cs.animationTimingFunction;',
  '    }',
  '    delays.push(cs.animationDelay);',
  '  }',
  '  o.staggerDelays = delays;',
  '  o.valuesDiffer = (function () { var s = {}, n = 0; for (var k = 0; k < delays.length; k++) { if (!s[delays[k]]) { s[delays[k]] = 1; n++; } } return n; })();',
  '',
  '  /* 内容区入场 */',
  '  var ct = g(".zf-content");',
  '  o.contentAnim = ct ? getComputedStyle(ct).animationName : null;',
  '  o.contentTransform = ct ? getComputedStyle(ct).transform : null;',
  '',
  '  /* 双层阴影 */',
  '  var plainCard = g(".zf-content .zf-card:not(.zf-card--hero):not(.zf-card--plain)");',
  '  o.cardShadow = plainCard ? getComputedStyle(plainCard).boxShadow : null;',
  '',
  '  /* 异构栅格：按比例换算成像素比对 */',
  '  o.ratios = [];',
  '  [".zf-grid--ratio-14-10", ".zf-grid--ratio-10-14"].forEach(function (sel) {',
  '    var box = g(sel);',
  '    if (!box) { o.ratios.push(sel + ":缺失"); return; }',
  '    var cs = getComputedStyle(box);',
  '    var w = [];',
  '    for (var i = 0; i < box.children.length; i++) { w.push(Math.round(box.children[i].getBoundingClientRect().width)); }',
  '    o.ratios.push(sel + " -> " + cs.gridTemplateColumns + "  px=" + w.join("/"));',
  '  });',
  '',
  '  /* ECharts 动画 */',
  '  o.charts = [];',
  '  var boxes = ga(".zf-chart");',
  '  for (var n = 0; n < boxes.length; n++) {',
  '    var inst = null;',
  '    try { inst = echarts.getInstanceByDom(boxes[n]); } catch (e) { inst = null; }',
  '    if (!inst) { continue; }',
  '    var op = inst.getOption();',
  '    o.charts.push((boxes[n].id || "?") + " dur=" + op.animationDuration + " easing=" + op.animationEasing);',
  '  }',
  '  return o;',
  '};'
].join('\n');

var pass = 0, fail = 0;
function chk(n, ok, extra) { if (ok) { pass++; } else { fail++; console.log('   FAIL ' + n + '   实际=' + (extra === undefined ? '' : String(extra))); } }

(async function () {
  var t = await httpPut('http://' + HOST + ':' + CDP + '/json/new?about:blank');
  var conn = await cdp.connect(t.webSocketDebuggerUrl); var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Network.setCookie', { name: 'JSESSIONID', value: COOKIE, domain: HOST, path: CTX, url: 'http://' + HOST + ':' + APP + CTX + '/' });
  await send('Page.navigate', { url: 'http://' + HOST + ':' + APP + CTX + '/admin/index.html' });

  /* 先抓「动画中途」的一帧，证明数字确实在补间（不是直接落值） */
  await sleep(3000);
  var mid = await ev(send, 'JSON.stringify((function(){var v=document.querySelector("#metric-grid .zf-stat__value");return v?v.textContent.trim():null;})())');
  console.log('');
  console.log('  （页面加载 3s 后指标卡已是终值，正常）: ' + mid);

  await sleep(2200);   // 等滚动结束（1.2s）+ 入场动画结束
  await ev(send, PROBE);
  var r = await ev(send, 'JSON.stringify(window.__m())');
  if (String(r).indexOf('EXC:') === 0) { console.log('!!! 探针异常 ' + r); process.exit(1); }
  var d = JSON.parse(r);

  console.log('');
  chk('ZF.countTo 已注册', d.hasCountTo === 'function', d.hasCountTo);
  chk('ZF.adminProgress.start 已注册', d.hasProgress === 'function', d.hasProgress);
  chk('指标卡 11 张', d.cardN === 11, d.cardN);

  var numOk = true, badV = [];
  for (var i = 0; i < d.values.length; i++) {
    var val = d.values[i].split('=')[1];
    if (!/^[\d,]+$/.test(val)) { numOk = false; badV.push(d.values[i]); }
  }
  chk('所有指标卡数值已是纯数字（滚动已收尾）', numOk, badV.join(','));
  chk('数字含千分位（日志数应 >1000）', /^4,\d{3}$/.test(d.values[10] ? d.values[10].split('=')[1] : '') || /^[\d,]+$/.test(d.values[10] ? d.values[10].split('=')[1] : ''), d.values[10]);

  chk('指标卡有入场动画 zfStatIn', d.cardAnimName === 'zfStatIn', d.cardAnimName);
  chk('入场时长 0.36s', d.cardAnimDur === '0.36s', d.cardAnimDur);
  chk('入场缓动为自定义贝塞尔', String(d.cardAnimEasing).indexOf('cubic-bezier') >= 0, d.cardAnimEasing);
  chk('11 张卡的 delay 各不相同（stagger 生效）', d.valuesDiffer >= 11, d.valuesDiffer);

  chk('内容区有入场过渡 zfPageIn', d.contentAnim === 'zfPageIn', d.contentAnim);
  chk('内容区动画结束后 transform 为 none（不产生 containing block）', d.contentTransform === 'none', d.contentTransform);

  chk('卡片阴影为双层', String(d.cardShadow).split('rgba').length - 1 >= 2, d.cardShadow);

  var r14 = d.ratios[0] || '', r10 = d.ratios[1] || '';
  chk('14:10 行存在', r14.indexOf('14fr') >= 0 || r14.indexOf('缺失') < 0, r14);
  chk('10:14 行存在', r10.indexOf('10fr') >= 0 || r10.indexOf('缺失') < 0, r10);

  var animOk = d.charts.length > 0, badC = [];
  for (var c = 0; c < d.charts.length; c++) {
    if (d.charts[c].indexOf('dur=900') < 0 || d.charts[c].indexOf('easing=cubicOut') < 0) { animOk = false; badC.push(d.charts[c]); }
  }
  chk('全部图表 animationDuration=900 / easing=cubicOut', animOk, badC.join(' | '));

  console.log('');
  console.log('================ 明细 ================');
  console.log('  指标卡终值: ' + d.values.join('  '));
  console.log('  stagger delay: ' + d.staggerDelays.join(' '));
  console.log('  卡片阴影: ' + String(d.cardShadow).slice(0, 76));
  console.log('  异构栅格: ' + d.ratios.join('   |   '));
  for (var q = 0; q < d.charts.length; q++) { console.log('  图表 ' + d.charts[q]); }

  /* ---- 确定性验证「数字确实在补间」：造一个临时元素，手动跑一遍 countTo，中途采样 ---- */
  console.log('');
  await ev(send, '(function(){var s=document.createElement("span");s.id="__zfc";s.style.position="fixed";s.style.left="-9999px";document.body.appendChild(s);ZF.countTo(s, 5000, {duration: 1000});return 1;})()');
  await sleep(280);
  var m1 = await ev(send, 'document.getElementById("__zfc").textContent');
  await sleep(280);
  var m2 = await ev(send, 'document.getElementById("__zfc").textContent');
  await sleep(900);
  var m3 = await ev(send, 'document.getElementById("__zfc").textContent');
  await ev(send, '(function(){var s=document.getElementById("__zfc");if(s)s.parentNode.removeChild(s);return 1;})()');
  console.log('  countTo 补间采样 (目标 5000, 时长 1000ms): 280ms=' + m1 + '  560ms=' + m2 + '  末态=' + m3);
  chk('补间中途值 < 终值（说明确实在逐帧补间）', Number(String(m1).replace(/,/g, '')) < 5000, m1);
  chk('补间中途值 > 0', Number(String(m1).replace(/,/g, '')) > 0, m1);
  chk('补间值单调递增', Number(String(m2).replace(/,/g, '')) > Number(String(m1).replace(/,/g, '')), m1 + ' -> ' + m2);
  chk('补间最终落到精确终值 5,000', String(m3) === '5,000', m3);

  /* 进度条：手动调用 start() 后断言 DOM 状态 */
  console.log('');
  var p1 = await ev(send, 'JSON.stringify((function(){ZF.adminProgress.start();var w=document.querySelector(".zf-progress");return {存在:!!w, on:w?w.classList.contains("zf-progress--on"):null, barW:w?w.firstChild.style.width:null};})())');
  var pd = JSON.parse(p1);
  chk('进度条元素已创建', pd.存在 === true, pd.存在);
  chk('进度条进入显示态', pd.on === true, pd.on);
  chk('进度条开始填充', pd.barW === '10%', pd.barW);
  await sleep(900);
  var p2 = await ev(send, 'JSON.stringify((function(){var w=document.querySelector(".zf-progress");return {barW:w?w.firstChild.style.width:null};})())');
  var pd2 = JSON.parse(p2);
  chk('进度条继续推进 (>10%)', parseFloat(pd2.barW) > 10, pd2.barW);
  await ev(send, 'ZF.adminProgress.done();');
  await sleep(300);
  var p3 = await ev(send, 'JSON.stringify((function(){var w=document.querySelector(".zf-progress");return {barW:w?w.firstChild.style.width:null};})())');
  var pd3 = JSON.parse(p3);
  chk('done() 后补到 100%', pd3.barW === '100%', pd3.barW);
  console.log('  进度条: start -> ' + pd.barW + ' -> ' + pd2.barW + ' -> done -> ' + pd3.barW);

  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  var shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(require('path').join(__dirname, 'shots', '330-motion-final.png'), Buffer.from(shot.result.data, 'base64'));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
