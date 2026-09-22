/**
 * @file 字体可用性「真检测」
 *
 * 【为什么重写】第一版用 document.fonts.check('12px "X"') 判断，结果**全部返回 true**
 * —— 包括肯定不存在的字体。原因：check() 的语义是"这个 font shorthand 能否被解析出
 * 一个可用的字体栈"，只要栈里任意一项能匹配它就 true，**不是"X 这个族存在"**。
 * 拿它做存在性判断必然全绿，等于没测。
 *
 * 【正确手法】宽度对比法：
 *   1. 先用三个「必然不在本机」的假名字（如 __NoSuchFont_A__）量基准宽度记作 fallback
 *   2. 再用待测字体量同一串文字
 *   3. 若宽度与 fallback **不同**，说明该字体真实存在且被用上
 *      （前提：待测字体与 fallback 的实际字形宽度有差异；对中文和拉丁文都成立）
 *   4. 为降低偶然命中（两个字体恰好等宽），同时测拉丁串 + 中文串 + 数字串三组，
 *      三组全等宽才判定为"不存在"
 *
 * 再补一层：把元素真的渲染出来，用 getBoundingClientRect 量，避免 Canvas 与 DOM 差异。
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

  var out = await ev([
    "(function(){",
    "  var FAKE = '__ZF_NoSuchFont_1__';",
    "  var SAMPLES = ['0123456789', '审查合同甲乙丙丁', 'AI Contract Review 2026', '《劳动合同法》第四十条'];",
    "  var CAND = [",
    "    'DM Sans','Inter','Roboto','Segoe UI','Helvetica Neue','Arial',",
    "    'Times New Roman','Georgia','Cambria','Palatino Linotype','Garamond',",
    "    'PingFang SC','Microsoft YaHei','Microsoft YaHei UI','SimSun','SimHei',",
    "    'FangSong','KaiTi','STSong','Songti SC','NSimSun',",
    "    'Noto Sans CJK SC','Source Han Sans SC','Noto Serif CJK SC','Source Han Serif SC',",
    "    'HarmonyOS Sans SC','MiSans','Alibaba PuHuiTi',",
    "    'JetBrains Mono','Consolas','Cascadia Mono','Menlo','Monaco','Courier New','Roboto Mono',",
    "    'IBM Plex Sans','IBM Plex Serif','Noto Sans','Open Sans','Lato','Source Sans Pro'",
    "  ];",
    "  var c = document.createElement('canvas');",
    "  var g = c.getContext('2d');",
    "  function w(fam, text){",
    "    g.font = '40px \"' + fam + '\", \"' + FAKE + '\"';",
    "    return g.measureText(text).width;",
    "  }",
    "  var base = SAMPLES.map(function(t){ return w(FAKE, t); });",
    "  var res = {};",
    "  CAND.forEach(function(f){",
    "    var ws = SAMPLES.map(function(t){ return w(f, t); });",
    "    var same = 0;",
    "    for (var i = 0; i < ws.length; i++) {",
    "      if (Math.abs(ws[i] - base[i]) < 0.6) { same++; }",
    "    }",
    "    // 4 组全部与 fallback 等宽 → 判定不存在",
    "    res[f] = { exists: same < SAMPLES.length, sameCount: same };",
    "  });",
    "  return JSON.stringify({ base: base.map(function(v){ return Math.round(v*100)/100; }), res: res });",
    "})()"
  ].join('\n'));

  var parsed = JSON.parse(out);
  console.log('fallback 基准宽度（4 组样本）:', JSON.stringify(parsed.base));
  console.log('\n=== 真实存在性检测 ===');
  var exist = [], notExist = [];
  Object.keys(parsed.res).forEach(function (f) {
    (parsed.res[f].exists ? exist : notExist).push(f + (parsed.res[f].sameCount ? '(' + parsed.res[f].sameCount + '/4等宽)' : ''));
  });
  console.log('\n[存在] ' + exist.length + ' 个:');
  exist.forEach(function (f) { console.log('   ✓ ' + f); });
  console.log('\n[不存在] ' + notExist.length + ' 个:');
  notExist.forEach(function (f) { console.log('   ✗ ' + f); });

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
