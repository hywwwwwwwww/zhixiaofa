/* ============================================================================
   diag-georgia-vs-roboto.js —— 为什么 --prose 元素被判成 Roboto？

   背景：verify-font-e2e.js 里 .zf-doc--prose 实测
     10位数字 = 81.61px @14.5px/字重400
   同字号候选里 Roboto 差 0.19px、Georgia 差 X px。
   但 Roboto 在本机**不存在**（diag-font-exist.js 已证实），
   所以「Roboto 最接近」必然是测量假象 —— 必须查清真实命中项。

   排查方向：
     1. 把完整 font-family 栈喂给 DOM（不拆项），量宽度 → W_stack
     2. 栈内每个候选单独量 → 找出与 W_stack 精确相等者（零推断裁决法）
     3. 注意 letter-spacing=0.2175px 会污染宽度，必须区分「有无字距」
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
  await send('Page.navigate', { url: BASE + 'home.html' });
  await sleep(2400);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 400) }; }
    return r.result.result.value;
  }

  /* 打开文章弹窗 */
  await ev('document.querySelector("a[href^=\'#article-\']").click(); "ok"');
  await sleep(1000);

  var PROBE = [
    "(function(){",
    "  var el = document.querySelector('#article-modal-body .zf-doc--prose');",
    "  if (!el) { return JSON.stringify({ fail: 'NO_PROSE' }); }",
    "  var cs = getComputedStyle(el);",
    "  var out = { ff: cs.fontFamily, px: parseFloat(cs.fontSize), wt: cs.fontWeight,",
    "              ls: cs.letterSpacing, lh: cs.lineHeight };",
    "  var FAKE = '__ZF_NoSuchFont_9__';",
    "",
    "  /* —— 手法 A：真实 DOM 元素，保留 letter-spacing（复现 verify 脚本口径） —— */",
    "  var spA = document.createElement('span');",
    "  spA.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;';",
    "  spA.style.fontFamily = cs.fontFamily;",
    "  spA.style.fontSize = cs.fontSize;",
    "  spA.style.fontWeight = cs.fontWeight;",
    "  spA.style.letterSpacing = cs.letterSpacing;",
    "  spA.textContent = '0123456789';",
    "  el.appendChild(spA);",
    "  out.domWithLs = Math.round(spA.getBoundingClientRect().width*100)/100;",
    "  spA.style.letterSpacing = 'normal';",
    "  out.domNoLs = Math.round(spA.getBoundingClientRect().width*100)/100;",
    "  spA.textContent = '审查合同仲裁';",
    "  out.domCn6NoLs = Math.round(spA.getBoundingClientRect().width*100)/100;",
    "  el.removeChild(spA);",
    "",
    "  /* —— 手法 B：canvas 逐字体量（无字距），找与 domNoLs 精确吻合者 —— */",
    "  var g = document.createElement('canvas').getContext('2d');",
    "  function w(fam, txt, px, wt, fake){",
    "    g.font = (wt||400) + ' ' + px + 'px \"' + fam + '\", \"' + FAKE + '\"';",
    "    return Math.round(g.measureText(txt).width*100)/100;",
    "  }",
    "  /* 完整栈（不拆项，每一项都进 canvas font 字符串）—— 这才是浏览器真实解析的栈 */",
    "  g.font = cs.fontWeight + ' ' + cs.fontSize + 'px ' + cs.fontFamily;",
    "  out.stackDirect = Math.round(g.measureText('0123456789').width*100)/100;",
    "  out.stackCn6 = Math.round(g.measureText('审查合同仲裁').width*100)/100;",
    "",
    "  var cands = ['Georgia','Cambria','Times New Roman','Source Han Serif SC','SimSun',",
    "               'Microsoft YaHei','Segoe UI','Arial','Roboto','Tahoma','Verdana',",
    "               'Trebuchet MS','Lucida Sans Unicode','Palatino Linotype','Garamond'];",
    "  out.solo = {};",
    "  for (var i=0;i<cands.length;i++){ out.solo[cands[i]] = w(cands[i], '0123456789', out.px, out.wt); }",
    "  out.fakeBaseline = w(FAKE, '0123456789', out.px, out.wt);",
    "",
    "  /* 逐项与 DOM 实测对照，列全部差值 */",
    "  var sorted = Object.keys(out.solo).map(function(k){ return [k, out.solo[k]]; });",
    "  sorted.sort(function(a,b){ return Math.abs(a[1]-out.domNoLs) - Math.abs(b[1]-out.domNoLs); });",
    "  out.ranked = sorted.slice(0,6).map(function(p){",
    "    return p[0] + '=' + p[1] + ' (Δ' + (p[1]-out.domNoLs).toFixed(3) + ')'; });",
    "",
    "  /* 关键裁决：完整栈 vs 逐项精确等宽。|Δ|<0.02 即命中 */",
    "  out.exactHits = [];",
    "  Object.keys(out.solo).forEach(function(f){",
    "    if (Math.abs(out.solo[f] - out.stackDirect) < 0.02) { out.exactHits.push(f + '=' + out.solo[f]); }",
    "  });",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await ev(PROBE);
  if (r && r.__err) { console.log('ERR ' + r.__err); process.exit(1); }
  var d = JSON.parse(r);
  if (d.fail) { console.log('FAIL ' + d.fail); process.exit(1); }

  console.log('===== .zf-doc--prose 计算样式 =====');
  console.log('  font-family    : ' + d.ff);
  console.log('  font-size      : ' + d.px + 'px    font-weight: ' + d.wt);
  console.log('  letter-spacing : ' + d.ls + '    line-height: ' + d.lh);

  console.log('\n===== 宽度实测 =====');
  console.log('  DOM 带字距 10位数字 : ' + d.domWithLs);
  console.log('  DOM 无字距 10位数字 : ' + d.domNoLs);
  console.log('  DOM 无字距 中文6字  : ' + d.domCn6NoLs + '  (全角理论 ' + (d.px*6) + ')');
  console.log('  canvas 完整栈 10位   : ' + d.stackDirect);
  console.log('  canvas 完整栈 中文6  : ' + d.stackCn6);
  console.log('  假字体兜底 10位      : ' + d.fakeBaseline);

  console.log('\n===== 同字号（' + d.px + 'px/' + d.wt + '）逐项对照，按接近度排序 =====');
  d.ranked.forEach(function (x) { console.log('  ' + x); });

  console.log('\n===== 【零推断裁决】完整栈 vs 逐项精确等宽（|Δ|<0.02） =====');
  if (d.exactHits.length) {
    d.exactHits.forEach(function (h) { console.log('  ✓ 命中: ' + h); });
  } else {
    console.log('  无精确等宽项 —— 说明命中的是「栈内某项也存在，但渲染时用了'
      + '另一项的某字形」。下面用 Δ 最小者裁决：');
  }

  /* 判断 Roboto 是不是测量假象 */
  console.log('\n===== Roboto 真伪检查 =====');
  console.log('  Roboto 单独量 = ' + d.solo['Roboto'] + '   假字体兜底 = ' + d.fakeBaseline);
  if (Math.abs(d.solo['Roboto'] - d.fakeBaseline) < 0.02) {
    console.log('  → Roboto 与假字体完全等宽 ⇒ Roboto 在浏览器眼里不存在，');
    console.log('    它落到兜底字体，量与兜底同宽 —— 「Roboto 最接近」是巧合假象。');
  } else {
    console.log('  → Roboto 有独立宽度，说明浏览器能解析它（可能是字体替换映射）。');
  }

  /* 找出真正命中的：完整栈宽度与哪一项 SOLO 相等 */
  console.log('\n===== 结论 =====');
  var best = null, bestD = 1e9;
  Object.keys(d.solo).forEach(function (f) {
    var dd = Math.abs(d.solo[f] - d.stackDirect);
    if (dd < bestD) { bestD = dd; best = f; }
  });
  console.log('  完整栈宽度 ' + d.stackDirect + ' 最接近「' + best + '」单独宽度 '
    + d.solo[best] + '（Δ' + bestD.toFixed(3) + '）');
  console.log('  而 DOM 实测（无字距）' + d.domNoLs + '，与完整栈差 '
    + Math.abs(d.stackDirect - d.domNoLs).toFixed(3));
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });
