/* ============================================================================
   diag-font-matrix.js —— 字体方案决策基线（多页面）

   目的：给「字体方案设计」提供量化基线。上前一步 diag-font-exists.js 已确认
   系统可用/不可用字体清单；本脚本解决剩下两个问题：

     [1] 关键内容元素当前的实际 font 栈 + 字号 + 字重 + 行高 + 数字宽度
         —— 覆盖 home / doc-drafting / court / qa / knowledge 五个页面，
            因为 .zf-doc--sheet 只在 doc-drafting，.zf-law 只在 qa/court。
     [2] 候选字体在各字号下的「宽度冲击」量化
         —— 换字体最大的风险是西文/数字变宽撑破布局。中文全角等宽无风险，
            所以只测数字 / 拉丁 / 日期 / 金额 / 百分比几组，单位 px。

   运行：python workspace/runnode.py workspace/diag-font-matrix.js
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 探测元素：选择器 + 标签 */
var PROBES = [
  { sel: '.zf-sidebar__brand-name', tag: 'sidebar-brand' },
  { sel: '.zf-nav__item', tag: 'nav-item' },
  { sel: '.zf-nav__item--active', tag: 'nav-active' },
  { sel: '.zf-topbar__crumb', tag: 'topbar-crumb' },
  { sel: '.zf-content__title', tag: 'content-title' },
  { sel: '.zf-content__sub', tag: 'content-sub' },
  { sel: '.zf-card__title', tag: 'card-title' },
  { sel: '.zf-card__desc', tag: 'card-desc' },
  { sel: '.zf-stat__num', tag: 'stat-num' },
  { sel: '.zf-stat__label', tag: 'stat-label' },
  { sel: '.zf-field__label', tag: 'field-label' },
  { sel: '.zf-form-control', tag: 'form-control' },
  { sel: 'textarea', tag: 'textarea' },
  { sel: '.zf-btn', tag: 'btn' },
  { sel: '.zf-btn--primary', tag: 'btn-primary' },
  { sel: '.zf-doc', tag: 'doc' },
  { sel: '.zf-doc__title', tag: 'doc-title' },
  { sel: '.zf-doc--sheet', tag: 'doc-sheet' },
  { sel: '.zf-doc__sign', tag: 'doc-sign' },
  { sel: '.zf-doc-meta', tag: 'doc-meta' },
  { sel: '.zf-law', tag: 'law' },
  { sel: '.zf-law__name', tag: 'law-name' },
  { sel: '.zf-bubble', tag: 'bubble' },
  { sel: '.zf-bubble--a', tag: 'bubble-a' },
  { sel: '.zf-list__title', tag: 'list-title' },
  { sel: '.zf-list__text', tag: 'list-text' },
  { sel: '.zf-list__meta', tag: 'list-meta' },
  { sel: '.zf-badge', tag: 'badge' },
  { sel: '.zf-tag', tag: 'tag' },
  { sel: 'th', tag: 'th' },
  { sel: 'td', tag: 'td' },
  { sel: 'code', tag: 'code' },
  { sel: 'pre', tag: 'pre' }
];

var CANDS = ['Microsoft YaHei', 'Microsoft YaHei UI', 'Segoe UI', 'SimSun', 'NSimSun',
  'STSong', 'Source Han Serif SC', 'SimHei', 'KaiTi', 'FangSong',
  'Times New Roman', 'Georgia', 'Cambria', 'Palatino Linotype', 'Garamond',
  'Arial', 'Roboto', 'Consolas', 'Cascadia Mono', 'Courier New'];

var FAKE = '__ZF_NoSuchFont_1__';
var TEXT_SAMPLES = [
  ['digits', '0123456789'],
  ['latin', 'AI Contract Review'],
  ['date', '2026-09-21 15:43'],
  ['money', '128,000.00'],
  ['percent', '+15.4%'],
  ['cn', '审查合同甲乙丙丁']
];
var SIZES = [11.5, 12, 12.5, 13.5, 14, 15, 19, 22, 26];

var PAGES = [
  ['home', 'home.html'],
  ['doc-drafting', 'doc-drafting.html'],
  ['court', 'court.html'],
  ['qa', 'qa.html'],
  ['knowledge', 'knowledge.html']
];

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) {
    for (i = 0; i < tabs.length; i++) {
      if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
    }
  }
  if (!target) { console.log('no target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 600) }; }
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 600) }; }
    return r.result.result.value;
  }

  /* 在页面里执行探测：把 PROBES/SAMPLES 以字面量注入 */
  var probeFn = [
    "(function(){",
    "  var PROBES = " + JSON.stringify(PROBES) + ";",
    "  var FAKE = '" + FAKE + "';",
    "  var S = " + JSON.stringify(TEXT_SAMPLES) + ";",
    "  var g = document.createElement('canvas').getContext('2d');",
    "  function cw(fam, text, px, wt){",
    "    g.font = (wt||400) + ' ' + px + 'px \"' + fam + '\", \"' + FAKE + '\"';",
    "    return Math.round(g.measureText(text).width * 100) / 100;",
    "  }",
    "  var out = [];",
    "  for (var i=0;i<PROBES.length;i++){",
    "    var p = PROBES[i];",
    "    var el = document.querySelector(p.sel);",
    "    if (!el) continue;",
    "    var cs = getComputedStyle(el);",
    "    var sp = document.createElement('span');",
    "    sp.style.cssText = 'position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre;';",
    "    sp.style.fontFamily = cs.fontFamily; sp.style.fontSize = cs.fontSize;",
    "    sp.style.fontWeight = cs.fontWeight; sp.style.letterSpacing = cs.letterSpacing;",
    "    sp.textContent = S[0][1];",
    "    document.body.appendChild(sp);",
    "    var dW = Math.round(sp.getBoundingClientRect().width*100)/100;",
    "    sp.textContent = S[5][1];",
    "    var cW = Math.round(sp.getBoundingClientRect().width*100)/100;",
    "    document.body.removeChild(sp);",
    "    var px = parseFloat(cs.fontSize) || 14;",
    "    var wt = cs.fontWeight;",
    "    out.push({",
    "      tag: p.tag, sel: p.sel,",
    "      ff: cs.fontFamily, px: px, wt: wt, lh: cs.lineHeight,",
    "      ls: cs.letterSpacing, fvn: cs.fontVariantNumeric,",
    "      dW: dW, cW: cW,",
    "      cwStack: cw(cs.fontFamily, S[0][1], px, wt),",
    "      cwYahei: cw('Microsoft YaHei', S[0][1], px, wt),",
    "      cwSimSun: cw('SimSun', S[0][1], px, wt),",
    "      cwTNR: cw('Times New Roman', S[0][1], px, wt),",
    "      cwSegoe: cw('Segoe UI', S[0][1], px, wt),",
    "      cwCons: cw('Consolas', S[0][1], px, wt)",
    "    });",
    "  }",
    "  return JSON.stringify({ href: location.pathname, probes: out });",
    "})()"
  ].join('\n');

  var out = { pages: {}, widths: null };

  for (var pi = 0; pi < PAGES.length; pi++) {
    var pg = PAGES[pi];
    await send('Page.navigate', { url: BASE + pg[1] });
    await sleep(1500);
    var raw = await ev(probeFn);
    if (raw && raw.__err) { out.pages[pg[0]] = { err: raw.__err }; }
    else {
      var parsed = JSON.parse(raw);
      /* 【记忆 #22】必须自查当前文档路径，否则 A 页探针可能读到 B 页文档 */
      parsed.expect = pg[1];
      parsed.ok = parsed.href.indexOf(pg[1]) >= 0;
      out.pages[pg[0]] = parsed;
    }
  }

  /* [2] 宽度矩阵 */
  await send('Page.navigate', { url: BASE + 'home.html' });
  await sleep(1200);
  var widthExpr = [
    "(function(){",
    "  var CANDS = " + JSON.stringify(CANDS) + ";",
    "  var SIZES = " + JSON.stringify(SIZES) + ";",
    "  var S = " + JSON.stringify(TEXT_SAMPLES) + ";",
    "  var FAKE = '" + FAKE + "';",
    "  var g = document.createElement('canvas').getContext('2d');",
    "  function w(fam,text,px){ g.font='400 '+px+'px \"'+fam+'\", \"'+FAKE+'\"'; return Math.round(g.measureText(text).width*100)/100; }",
    "  var m = { keys: S.map(function(s){return s[0];}), samples: S.map(function(s){return s[1];}), sizes: SIZES, data: {} };",
    "  for (var i=0;i<CANDS.length;i++){ var f=CANDS[i]; m.data[f]={};",
    "    for (var j=0;j<SIZES.length;j++){ var px=SIZES[j]; m.data[f][px]={};",
    "      for (var k=0;k<S.length;k++){ m.data[f][px][S[k][0]] = w(f,S[k][1],px); }",
    "    }",
    "  }",
    "  return JSON.stringify(m);",
    "})()"
  ].join('\n');
  var wraw = await ev(widthExpr);
  out.widths = JSON.parse(wraw);

  fs.writeFileSync(path.join(__dirname, 'font-matrix.json'), JSON.stringify(out, null, 1), 'utf8');

  /* ---- 控制台友好输出 ---- */
  console.log('=== [1] 各页面关键元素实际字体 ===');
  Object.keys(out.pages).forEach(function (k) {
    var p = out.pages[k];
    console.log('\n--- ' + k + ' ---');
    if (p.err) { console.log('  ERR ' + p.err); return; }
    console.log('  doc=' + p.href + ' ok=' + p.ok);
    p.probes.forEach(function (x) {
      console.log('  ' + pad(x.tag, 16) + ' ' + pad(x.px + 'px/' + x.wt, 10) +
        ' lh=' + pad(x.lh, 7) + ' dW=' + pad(x.dW, 8) + ' cW=' + pad(x.cW, 7) +
        ' fvn=' + pad(x.fvn, 8));
      console.log('      ff=' + x.ff);
    });
  });

  console.log('\n=== [2] 宽度对比（14px，单位 px） ===');
  var keys = out.widths.keys;
  console.log(pad('font', 22) + keys.map(function (k) { return pad(k, 11); }).join(''));
  CANDS.forEach(function (f) {
    var row = pad(f, 22);
    keys.forEach(function (k) {
      row += pad(out.widths.data[f][14][k], 11);
    });
    console.log(row);
  });

  console.log('\n=== [3] 关键字号下数字宽度（判断是否撑破） ===');
  [11.5, 12.5, 13.5, 14, 15, 19, 22, 26].forEach(function (px) {
    var row = pad(px + 'px', 8);
    ['Microsoft YaHei', 'SimSun', 'Times New Roman', 'Segoe UI', 'Consolas'].forEach(function (f) {
      row += pad(f.split(' ')[0] + '=' + out.widths.data[f][px]['digits'], 18);
    });
    console.log(row);
  });

  console.log('\nJSON -> workspace/font-matrix.json');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) {
  s = String(s);
  while (s.length < n) { s += ' '; }
  return s;
}
