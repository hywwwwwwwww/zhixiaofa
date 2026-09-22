/* ============================================================================
   diag-fontid-dom.js —— 用「纯 DOM 同字号对照」重新裁决字体命中（修正版）

   【为什么要重写】
   上游 diag-georgia-vs-roboto.js 暴露了一个必须记进 memory 的坑：
     canvas 的 `g.font = "400 14.5px 'Georgia', Cambria, \"Times New Roman\", ..."`
     量出来 10 位数字 = 55.5px；
     而同一元素、同一字号的 DOM 实测 = 79.44px。
     差 24px ⇒ **canvas 不会像 DOM 那样解析完整 font-family 栈**。
   因此此前 verify 脚本里「canvas 逐项 vs DOM 实测」的对照**口径不统一**，
   得出的 best 只是相对接近者，不是真命中（Roboto 那 0.19px 就是这么来的）。

   【本脚本改用统一口径：全部走 DOM】
     1. 建临时 span，font-family 设为**候选字体单独 + 假字体兜底**，量宽
     2. 同尺寸、同字重、同 letter-spacing（统一 normal，避免污染）
     3. 与真实元素的 DOM 实测宽度比对
     4. 额外验证「假字体」量出的宽度 == 浏览器兜底宽度，用于识别
        「该候选其实不存在、落到了兜底」这种伪命中
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 400) }; }
    return r.result.result.value;
  }
  async function nav(url, ms) { await send('Page.navigate', { url: url }); await sleep(ms || 2100); }

  /* 纯 DOM 的字体裁决器：定义一次，多页面复用 */
  var RULER = [
    "window.__RULER = function(el){",
    "  var FAKE = '__ZF_NoSuchFont_9__';",
    "  var cs = getComputedStyle(el);",
    "  var px = parseFloat(cs.fontSize), wt = cs.fontWeight;",
    "  /* 用一个脱离文档流的量尺，统一 letter-spacing=normal，消除字距污染 */",
    "  var R = document.createElement('span');",
    "  R.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;'",
    "                  + 'letter-spacing:normal;';",
    "  R.style.fontSize = cs.fontSize; R.style.fontWeight = cs.fontWeight;",
    "  document.body.appendChild(R);",
    "  function domW(famSpec, txt){ R.style.fontFamily = famSpec; R.textContent = txt;",
    "    return Math.round(R.getBoundingClientRect().width*1000)/1000; }",
    "  var out = { ff: cs.fontFamily, px: px, wt: wt, ls: cs.letterSpacing };",
    "  /* 真实元素自身的 DOM 宽度（但强制 normal 字距，与量尺同口） */",
    "  var probe = document.createElement('span');",
    "  probe.style.cssText = 'position:absolute;left:-99999px;visibility:hidden;white-space:pre;'",
    "                      + 'letter-spacing:normal;';",
    "  probe.style.fontFamily = cs.fontFamily;",
    "  probe.style.fontSize = cs.fontSize; probe.style.fontWeight = cs.fontWeight;",
    "  probe.textContent = '0123456789';",
    "  document.body.appendChild(probe);",
    "  out.stackDOM = Math.round(probe.getBoundingClientRect().width*1000)/1000;",
    "  probe.textContent = '审查合同仲裁';",
    "  out.stackCN = Math.round(probe.getBoundingClientRect().width*1000)/1000;",
    "  document.body.removeChild(probe);",
    "  /* 假字体兜底宽度：识别「候选不存在→落兜底」的伪命中 */",
    "  out.fakeW = domW('\"' + FAKE + '\"', '0123456789');",
    "  /* 逐候选：单独 + 假名兜底 */",
    "  var cands = ['Georgia','Cambria','Times New Roman','Source Han Serif SC','SimSun',",
    "               'NSimSun','STSong','KaiTi','FangSong','Microsoft YaHei','Segoe UI',",
    "               'Arial','Roboto','Tahoma','Verdana','Trebuchet MS','Garamond',",
    "               'Palatino Linotype','Consolas','Courier New'];",
    "  out.solo = {};",
    "  for (var i=0;i<cands.length;i++){",
    "    out.solo[cands[i]] = domW('\"' + cands[i] + '\", \"' + FAKE + '\"', '0123456789');",
    "  }",
    "  /* 判定：与 stackDOM 精确相等（<0.01）且不等于兜底 ⇒ 真命中 */",
    "  out.hits = []; out.near = [];",
    "  Object.keys(out.solo).forEach(function(f){",
    "    var v = out.solo[f], d = v - out.stackDOM;",
    "    if (Math.abs(d) < 0.01) {",
    "      if (Math.abs(v - out.fakeW) < 0.01) { out.near.push(f + '(==兜底,伪)'); }",
    "      else { out.hits.push(f + '=' + v); }",
    "    } else { out.near.push(f + '=' + v + '(Δ' + d.toFixed(2) + ')'); }",
    "  });",
    "  /* 按接近度排序 near，取前 5 */",
    "  out.near.sort(function(a,b){",
    "    function g(s){ return Math.abs(parseFloat((s.match(/Δ(-?[\\d.]+)/)||[0,999])[1])); }",
    "    return g(a)-g(b); });",
    "  out.near = out.near.slice(0,5);",
    "  document.body.removeChild(R);",
    "  return out;",
    "};",
    "'ruler_ready'"
  ].join('\n');

  var results = [];

  /* ---------- 场景 1：home 文章弹窗 .zf-doc--prose ---------- */
  await nav(BASE + 'home.html', 2500);
  await ev(RULER);
  await ev('document.querySelector("a[href^=\'#article-\']").click(); "ok"');
  await sleep(1100);
  var s1 = await ev('JSON.stringify(window.__RULER(document.querySelector("#article-modal-body .zf-doc--prose")))');
  if (s1 && !s1.__err) { var d1 = JSON.parse(s1); d1.scene = 'home 弹窗 .zf-doc--prose';
    results.push(d1); console.log('【场景1】' + d1.scene); printD(d1); }
  else { console.log('场景1 ERR ' + JSON.stringify(s1).slice(0,200)); }

  /* ---------- 场景 2：doc-drafting 纸面态 ---------- */
  await nav(BASE + 'doc-drafting.html', 2200);
  await ev(RULER);
  await ev('document.querySelector("#template-grid .zf-tpl").click(); "ok"');
  await sleep(900);
  /* 填表 → 生成 */
  var filled = await ev([
    "(function(){",
    "  var fs = document.querySelectorAll('#doc-fill-form [data-ph]');",
    "  if (!fs.length) { return 'NO_FIELDS'; }",
    "  for (var i=0;i<fs.length;i++){",
    "    var f=fs[i], ph=f.getAttribute('data-ph'), v;",
    "    if (ph.indexOf('金额')>=0) v='128000.00';",
    "    else if (ph.indexOf('身份证')>=0) v='370102199503121234';",
    "    else if (ph.indexOf('电话')>=0||ph.indexOf('手机')>=0) v='13800000001';",
    "    else if (ph.indexOf('日期')>=0) v='2026-09-21';",
    "    else if (ph.indexOf('时间')>=0) v='2026年8月';",
    "    else if (ph.indexOf('事项')>=0||ph.indexOf('理由')>=0) v='请求裁决被申请人支付经济补偿金。';",
    "    else v='张三';",
    "    if (f.tagName==='SELECT'){ if (f.options.length>1) f.selectedIndex=1; } else { f.value=v; }",
    "    f.dispatchEvent(new Event('input',{bubbles:true}));",
    "    f.dispatchEvent(new Event('change',{bubbles:true}));",
    "  }",
    "  return 'FILLED:' + fs.length;",
    "})()"
  ].join('\n'));
  console.log('\n填表结果: ' + filled);
  await ev('document.getElementById("doc-generate").click(); "ok"');
  await sleep(1600);
  var s2 = await ev([
    "(function(){",
    "  var el = document.querySelector('.zf-doc--sheet');",
    "  if (!el) { return 'NO_SHEET'; }",
    "  return JSON.stringify(window.__RULER(el));",
    "})()"
  ].join('\n'));
  if (s2 && s2.indexOf && s2.indexOf('NO_SHEET') === 0) { console.log('场景2: 未渲染出 .zf-doc--sheet'); }
  else if (s2 && !s2.__err) { var d2 = JSON.parse(s2); d2.scene = 'doc-drafting .zf-doc--sheet';
    results.push(d2); console.log('\n【场景2】' + d2.scene); printD(d2); }

  /* ---------- 场景 3：knowledge 弹窗（同渲染器，做一致性对照） ---------- */
  await nav(BASE + 'knowledge.html', 2100);
  await ev(RULER);
  await ev('document.querySelector("#article-list .zf-art").click(); "ok"');
  await sleep(1100);
  var s3 = await ev('JSON.stringify(window.__RULER(document.querySelector("#article-modal-body .zf-doc--prose")))');
  if (s3 && !s3.__err) { var d3 = JSON.parse(s3); d3.scene = 'knowledge 弹窗 .zf-doc--prose';
    results.push(d3); console.log('\n【场景3】' + d3.scene); printD(d3); }

  /* ---------- 场景 4：未挂修饰符的 .zf-doc（对照，应仍是无衬线） ---------- */
  await nav(BASE + 'court.html', 2100);
  await ev(RULER);
  var s4 = await ev([
    "(function(){",
    "  var el = document.querySelector('.zf-doc');",
    "  if (!el) { return 'NO_DOC'; }",
    "  return JSON.stringify(window.__RULER(el));",
    "})()"
  ].join('\n'));
  if (s4 && s4.indexOf && s4.indexOf('NO_DOC') === 0) { console.log('\n场景4: court.html 无 .zf-doc'); }
  else if (s4 && !s4.__err) { var d4 = JSON.parse(s4); d4.scene = 'court.html .zf-doc（基线对照）';
    results.push(d4); console.log('\n【场景4】' + d4.scene); printD(d4); }

  /* ---------- 总结 ---------- */
  console.log('\n=================== 汇总 ===================');
  var SERIF = ['Georgia','Cambria','Times New Roman','Source Han Serif SC','SimSun','NSimSun','STSong'];
  for (var k = 0; k < results.length; k++) {
    var d = results[k];
    var hit = d.hits.length ? d.hits.join(' ') : '（无精确等宽项）';
    var isSerif = false;
    for (var q = 0; q < SERIF.length; q++) { if (hit.indexOf(SERIF[q]) >= 0) { isSerif = true; } }
    console.log('  ' + d.scene);
    console.log('     ' + d.px + 'px/' + d.wt + '  栈内实测DOM=' + d.stackDOM +
      '  兜底=' + d.fakeW + '  中文6字=' + d.stackCN + '(全角理论' + (d.px*6) + ')');
    console.log('     → 精确命中: ' + hit + '   ' + (isSerif ? '[衬线]' : '[无衬线]'));
    console.log('       次接近: ' + d.near.join('  '));
  }

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function printD(d) {
  console.log('  ff = ' + d.ff);
  console.log('  ' + d.px + 'px / 字重 ' + d.wt + ' / 字距 ' + d.ls);
  console.log('  DOM 栈实测 10位 = ' + d.stackDOM + '    假字体兜底 = ' + d.fakeW);
  console.log('  中文 6 字 = ' + d.stackCN + '  (全角理论 ' + (d.px * 6) + ')');
  console.log('  → 精确命中(<0.01): ' + (d.hits.length ? d.hits.join('  ') : '无'));
  console.log('    次接近: ' + d.near.join('  '));
}
