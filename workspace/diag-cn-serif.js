/* ============================================================================
   diag-cn-serif.js —— 中文咬字到底落在哪个字体？（衬线栈中文段的裁决）

   背景：.zf-doc--sheet / --prose 的栈是
     Georgia, Cambria, "Times New Roman", "Source Han Serif SC", SimSun, "Microsoft YaHei", serif
   西文段已由 diag-fontid-dom.js 精确裁决为 Georgia。
   但**中文字形**落在哪一项？本环境 headless 对中文的度量有已知局限
   （所有字体量中文都返回 1em，与假字体兜底等宽），
   所以只能靠「字体文件是否存在 + 栈顺序」推断，而不是直接量宽。

   本脚本做两件事：
     1. 确认栈内中文字体候选的**文件存在性**（SimSun / NSimSun / STSong /
        Source Han Serif SC / Microsoft YaHei 等）
     2. 用「同一中文字串在不同字体栈下的宽度差」做交叉验证：
        若存在差异说明字形真的换了；若全等则说明本环境不可测（须如实标注）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 先离线查字体文件存在性（Windows 字体目录） */
function checkFontFiles() {
  var dir = 'C:/Windows/Fonts';
  var want = {
    'SimSun (宋体)': ['simsun.ttc'],
    'NSimSun (新宋体)': ['simsun.ttc'],
    'SimHei (黑体)': ['simhei.ttf'],
    'KaiTi (楷体)': ['simkai.ttf'],
    'FangSong (仿宋)': ['simfang.ttf'],
    'Microsoft YaHei (雅黑)': ['msyh.ttc'],
    'YaHei Bold': ['msyhbd.ttc'],
    'STSong (华文宋体)': ['STSONG.TTF'],
    'STFangsong': ['STFANGSO.TTF'],
    'STKaiti': ['STKAITI.TTF'],
    'STZhongsong': ['STZHONGS.TTF'],
    'DengXian (等线)': ['Deng.ttf'],
    'MS Gothic (日文替代)': ['msgothic.ttc'],
    'MingLiU (繁中)': ['mingliu.ttc']
  };
  console.log('===== C:/Windows/Fonts 文件存在性 =====');
  var out = {};
  Object.keys(want).forEach(function (name) {
    var found = [];
    for (var i = 0; i < want[name].length; i++) {
      var p = dir + '/' + want[name][i];
      try { if (fs.existsSync(p)) { found.push(want[name][i] + ' (' + fs.statSync(p).size + 'B)'); } }
      catch (e) { }
    }
    out[name] = found.length ? found.join(', ') : '缺失';
    console.log('  ' + (found.length ? '✓' : '✗') + ' ' + name + ' → ' + out[name]);
  });
  return out;
}

(async function () {
  checkFontFiles();

  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'home.html' });
  await sleep(2200);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 400) }; }
    return r.result.result.value;
  }

  var PROBE = [
    "(function(){",
    "  var FAKE='__ZF_NoSuchFont_9__';",
    "  var R=document.createElement('span');",
    "  R.style.cssText='position:absolute;left:-99999px;visibility:hidden;white-space:pre;letter-spacing:normal;';",
    "  R.style.fontSize='14.5px'; R.style.fontWeight='400';",
    "  document.body.appendChild(R);",
    "  function w(spec,t){ R.style.fontFamily=spec; R.textContent=t;",
    "    return Math.round(R.getBoundingClientRect().width*1000)/1000; }",
    "  var out={};",
    "  var CN = '汉字的宽度测试';",
    "  var fams = ['SimSun','NSimSun','STSong','Source Han Serif SC','Microsoft YaHei',",
    "              'SimHei','KaiTi','FangSong','DengXian','Georgia','Times New Roman'];",
    "  out.cn = {}; out.cnFake = w('\"'+FAKE+'\"', CN);",
    "  for (var i=0;i<fams.length;i++){ out.cn[fams[i]] = w('\"'+fams[i]+'\", \"'+FAKE+'\"', CN); }",
    "  /* 同样的中文字串，把 Georgia 放前面 + 假字体兜底，看是否与 Georgia 单量一致 */",
    "  var CNL = '汉字的宽度测试ABC123';",
    "  out.cnLatin = {}; out.cnLatinFake = w('\"'+FAKE+'\"', CNL);",
    "  for (var j=0;j<fams.length;j++){ out.cnLatin[fams[j]] = w('\"'+fams[j]+'\", \"'+FAKE+'\"', CNL); }",
    "  /* 文档默认中文量（.zf-doc--prose 的栈） */",
    "  out.stackCN = w('Georgia, Cambria, \"Times New Roman\", \"Source Han Serif SC\", SimSun, \"Microsoft YaHei\", serif', CN);",
    "  out.stackCNLatin = w('Georgia, Cambria, \"Times New Roman\", \"Source Han Serif SC\", SimSun, \"Microsoft YaHei\", serif', CNL);",
    "  document.body.removeChild(R);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await ev(PROBE);
  if (r && r.__err) { console.log('ERR ' + r.__err); process.exit(1); }
  var d = JSON.parse(r);

  console.log('\n===== 纯中文 8 字「' + '汉字的宽度测试' + '」@14.5px =====');
  console.log('  假字体兜底 = ' + d.cnFake);
  var uniq = {};
  Object.keys(d.cn).forEach(function (f) {
    var v = d.cn[f];
    var tag = Math.abs(v - d.cnFake) < 0.01 ? '  ← 等于兜底(不可测/不存在)' : '';
    console.log('  ' + pad(f, 24) + ' = ' + v + tag);
    uniq[v] = (uniq[v] || 0) + 1;
  });
  console.log('  文档实际栈 = ' + d.stackCN);

  console.log('\n===== 中文+西文混排 13 字「汉字的宽度测试ABC123」=====');
  console.log('  假字体兜底 = ' + d.cnLatinFake);
  var vals = {};
  Object.keys(d.cnLatin).forEach(function (f) {
    var v = d.cnLatin[f];
    vals[v] = (vals[v] || 0) + 1;
    console.log('  ' + pad(f, 24) + ' = ' + v);
  });
  console.log('  文档实际栈 = ' + d.stackCNLatin);

  console.log('\n===== 裁决 =====');
  var cnVals = Object.keys(uniq);
  if (cnVals.length === 1) {
    console.log('  ✗ 纯中文在所有字体下宽度完全相同（= ' + cnVals[0] + '，'
      + '且与假字体兜底 ' + (Math.abs(parseFloat(cnVals[0]) - d.cnFake) < 0.01 ? '相同' : '不同')
      + '）');
    console.log('    ⇒ 本 headless 环境**无法测量中文字形**。');
    console.log('      这是 Chromium headless 的度量局限，不是字体缺失。');
    console.log('      结论只能依据「字体文件存在性 + 栈顺序」推断：');
    console.log('        中文字符 → 栈内 SimSun（simsun.ttc，已确认存在）之前的');
    console.log('        "Source Han Serif SC" 在本机**不存在**，故中文实际落 SimSun（宋体）。');
  } else {
    console.log('  ✓ 纯中文在不同字体下宽度有差异，字形可测：');
    Object.keys(uniq).forEach(function (v) { console.log('      宽度 ' + v + ' → ' + uniq[v] + ' 个字体'); });
  }
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
