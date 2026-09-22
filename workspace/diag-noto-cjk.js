/* ============================================================================
   diag-noto-cjk.js —— 验证 Noto Serif SC / Noto Sans SC 是否真可用

   背景（本轮最重要的认知修正）：
     之前用「宽度对比法」判定「Source Han Serif SC 不存在」，判定成立；
     但同时把 **Noto Serif SC / Noto Sans SC 也漏判了**——
     注册表 HKLM\...\Fonts 明确有：
       Noto Sans SC (TrueType)  -> NotoSansSC-VF.ttf
       Noto Serif SC (TrueType) -> NotoSerifSC-VF.ttf
     两者都是**真实安装**的字体。

     而「Source Han Serif SC」在混排下量出 88.172（≠兜底 80.484），
     是因为 Chromium 会把**未安装的 CJK 族名替换到某个已安装 CJK 字体**，
     这是替换行为，不是安装证据。注册表才是权威。

   本脚本验证：
     1. NotoSerifSC-VF.ttf / NotoSansSC-VF.ttf 文件确实存在
     2. 「Noto Serif SC」「Noto Serif SC VF」「Noto Sans SC」各名称能否解析
     3. 拉丁段宽度是否区别于兜底（能区分 → 真实生效）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(function checkFiles() {
  console.log('===== 字体文件存在性（注册表指向的文件）=====');
  var files = ['NotoSerifSC-VF.ttf', 'NotoSansSC-VF.ttf', 'STSONG.TTF', 'STFANGSO.TTF',
               'simsun.ttc', 'simhei.ttf', 'msyh.ttc', 'simkai.ttf', 'simfang.ttf'];
  files.forEach(function (f) {
    var p = 'C:/Windows/Fonts/' + f;
    var ok = false, sz = 0;
    try { ok = fs.existsSync(p); if (ok) { sz = fs.statSync(p).size; } } catch (e) { }
    console.log('  ' + (ok ? '✓' : '✗') + ' ' + pad(f, 22) + (ok ? (sz + ' B') : '缺失'));
  });
})();

(async function () {
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
    "  var LAT='0123456789', CN='汉字的宽度测试';",
    "  var fams=['Noto Serif SC','Noto Serif SC VF','Noto Serif SC Regular','Noto Sans SC',",
    "            'Noto Sans SC VF','Source Han Serif SC','Source Han Sans SC','Noto Sans CJK SC',",
    "            'SimSun','STSong','Georgia'];",
    "  var out={ fams:{}, fake:{ LAT:w('\"'+FAKE+'\"',LAT), CN:w('\"'+FAKE+'\"',CN) } };",
    "  for (var i=0;i<fams.length;i++){",
    "    var f=fams[i], spec='\"'+f+'\", \"'+FAKE+'\"';",
    "    out.fams[f]={ LAT:w(spec,LAT), CN:w(spec,CN) };",
    "  }",
    "  /* document.fonts.check 的语义确认（已知它对所有字体返回 true，只作对照） */",
    "  out.check = {};",
    "  ['Noto Serif SC','__BOGUS_X__','SimSun'].forEach(function(f){",
    "    try { out.check[f] = document.fonts.check('14.5px \"' + f + '\"'); } catch(e){ out.check[f]='ERR'; }",
    "  });",
    "  document.body.removeChild(R);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await ev(PROBE);
  if (r && r.__err) { console.log('ERR ' + r.__err); process.exit(1); }
  var d = JSON.parse(r);

  console.log('\n===== 宽度矩阵 @14.5px/400（FAKE 兜底: LAT=' + d.fake.LAT + ' CN=' + d.fake.CN + '）=====');
  console.log('  ' + pad('字体族名', 26) + pad('LAT(10位)', 12) + pad('CN(8字)', 12) + '判定');
  Object.keys(d.fams).forEach(function (f) {
    var v = d.fams[f];
    var sameLat = Math.abs(v.LAT - d.fake.LAT) < 0.01;
    var sameCn = Math.abs(v.CN - d.fake.CN) < 0.01;
    var verdict;
    if (sameLat && sameCn) { verdict = '与兜底全等（不可解析/未安装）'; }
    else if (!sameLat && sameCn) { verdict = '拉丁段可用（真实或替换生效）'; }
    else if (sameLat && !sameCn) { verdict = '仅中文段有差异'; }
    else { verdict = '两段均可解析'; }
    console.log('  ' + pad(f, 26) + pad(v.LAT, 12) + pad(v.CN, 12) + verdict);
  });

  console.log('\n===== document.fonts.check 对照（已知语义不可靠）=====');
  Object.keys(d.check).forEach(function (f) {
    console.log('  check("' + f + '") = ' + d.check[f]);
  });

  console.log('\n===== 说明 =====');
  console.log('  · 注册表确认已安装：Noto Sans SC -> NotoSansSC-VF.ttf');
  console.log('                     Noto Serif SC -> NotoSerifSC-VF.ttf');
  console.log('  · 全角中文在本 headless 下恒为 1em，故 CN 段多为 101.5，无法据此判真伪；');
  console.log('    真正能区分的是 LAT 段（数字宽度）。');
  console.log('  · 「Source Han Serif SC」LAT=88.172 非兜底值 → Chromium 做了 CJK 族名替换，');
  console.log('    **不代表该字体已安装**（注册表/Fonts 目录均无条目）。');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
