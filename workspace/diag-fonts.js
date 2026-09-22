/**
 * @file 字体诊断：实测「当前到底用什么字体渲染」
 *
 * 要回答的问题：
 *   1. DM Sans 声明了但本地没有字体文件、也没有 @font-face —— 实际 fallback 到了什么？
 *   2. 系统里装了哪些中文字体？（决定宋体/黑体方案能不能落地）
 *   3. 数字（指标卡、阅读量）当前用什么字体渲染？宽度是否值得换等宽/表格数字？
 *   4. 各候选字体在同样字号下的**实际渲染宽度**对比（用来判断换字体后会不会撑破布局）
 *
 * 【测量手法】document.fonts.check() 判断某字体是否可用；
 * Canvas measureText 量宽度；再配合一个真实 DOM 元素量渲染宽度。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  // 【兼容】优先用 about:blank；若已被上一轮脚本占用，就复用任意 page 标签。
  // 之前写死 about:blank 导致连续跑第二个脚本时报 'no target'。
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) {
    for (var j = 0; j < tabs.length; j++) {
      if (tabs[j].type === 'page' && tabs[j].url.indexOf('devtools://') < 0) { target = tabs[j]; break; }
    }
  }
  if (!target) { console.log('no target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(e) {
    var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 500) }; }
    return r.result.result.value;
  }

  // ---------- 1) 系统中文字体可用性 ----------
  console.log('=== [1] 候选字体可用性（document.fonts.check）===');
  var avail = await ev([
    "(function(){",
    "  var cands = [",
    "    'DM Sans','Inter','Roboto','Helvetica Neue','Arial','Segoe UI',",
    "    'Times New Roman','Georgia','Cambria','Palatino Linotype',",
    "    'PingFang SC','Microsoft YaHei','Microsoft YaHei UI','SimSun','SimHei',",
    "    'NSimSun','FangSong','KaiTi','STSong','Songti SC','Noto Sans CJK SC',",
    "    'Source Han Sans SC','Source Han Serif SC','Noto Serif CJK SC',",
    "    'HarmonyOS Sans SC','MiSans','Alibaba PuHuiTi','JetBrains Mono',",
    "    'Consolas','Menlo','Monaco','Courier New','Roboto Mono','SF Mono'",
    "  ];",
    "  var out = {};",
    "  cands.forEach(function(f){",
    "    // 用 12px 判是否存在；true 表示该族至少能匹配到一个已安装字体",
    "    var has = false;",
    "    try { has = document.fonts.check('12px \"' + f + '\"'); } catch(e) { has = false; }",
    "    out[f] = has;",
    "  });",
    "  out['__bodyComputed'] = getComputedStyle(document.body).fontFamily;",
    "  return JSON.stringify(out, null, 1);",
    "})()"
  ].join('\n'));
  console.log(avail);

  // ---------- 2) 真实渲染宽度对比 ----------
  console.log('\n=== [2] Canvas 实测宽度对比 ===');
  var widths = await ev([
    "(function(){",
    "  var c = document.createElement('canvas');",
    "  var g = c.getContext('2d');",
    "  var SAMPLES = {",
    "    digit: '0123456789',",
    "    cnChart: '审查合同',",
    "    mixed: '《劳动合同法》第四十条',",
    "    latin: 'AI Contract Review',",
    "    date: '2026-09-21 15:43'",
    "  };",
    "  var FAM = ['DM Sans','Segoe UI','Microsoft YaHei','SimSun','SimHei','Times New Roman','Georgia','Consolas','JetBrains Mono','system-ui','serif','sans-serif'];",
    "  var out = {};",
    "  Object.keys(SAMPLES).forEach(function(k){",
    "    out[k] = {};",
    "    FAM.forEach(function(f){",
    "      g.font = '14px \"' + f + '\"';",
    "      out[k][f] = Math.round(g.measureText(SAMPLES[k]).width * 100) / 100;",
    "    });",
    "  });",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n'));
  console.log(widths);

  // ---------- 3) 关键元素的实际渲染字体与数字宽度 ----------
  console.log('\n=== [3] 关键元素实际渲染 ===');
  var real = await ev([
    "(function(){",
    "  function info(sel){",
    "    var el = document.querySelector(sel);",
    "    if (!el) { return { sel: sel, missing: true }; }",
    "    var cs = getComputedStyle(el);",
    "    var r = el.getBoundingClientRect();",
    "    // 用一个 span 量「该元素的字体下，数字实际占多宽」",
    "    var probe = document.createElement('span');",
    "    probe.style.font = cs.font;",
    "    probe.style.position = 'absolute'; probe.style.visibility = 'hidden';",
    "    probe.textContent = '0123456789';",
    "    document.body.appendChild(probe);",
    "    var dw = probe.getBoundingClientRect().width;",
    "    probe.textContent = '审查合同';",
    "    var cw = probe.getBoundingClientRect().width;",
    "    probe.parentNode.removeChild(probe);",
    "    return {",
    "      sel: sel,",
    "      text: (el.textContent || '').trim().slice(0, 18),",
    "      fontFamily: cs.fontFamily,",
    "      fontSize: cs.fontSize,",
    "      fontWeight: cs.fontWeight,",
    "      tabular: cs.fontVariantNumeric,",
    "      w: Math.round(r.width),",
    "      digitsW: Math.round(dw * 100) / 100,",
    "      cnW: Math.round(cw * 100) / 100",
    "    };",
    "  }",
    "  var sels = [",
    "    'body', '.zf-sidebar__brand-name', '.zf-nav__item',",
    "    '.zf-topbar__crumb', '.zf-card__title', '.zf-card__desc',",
    "    '[data-stat=qa]', '.zf-list__title', '.zf-list__text',",
    "    '.zf-badge', '.zf-btn', '.zf-doc--sheet', '.zf-law'",
    "  ];",
    "  return JSON.stringify(sels.map(info), null, 1);",
    "})()"
  ].join('\n'));
  console.log(real);

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
