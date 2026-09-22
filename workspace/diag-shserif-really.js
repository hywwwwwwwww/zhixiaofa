/* ============================================================================
   diag-shserif-really.js —— "Source Han Serif SC" 到底存不存在？（矛盾裁决）

   矛盾点：
     · diag-font-exist.js 结论：「Source Han Serif SC 不存在」（4/4 等宽于兜底）
     · diag-cn-serif.js 混排实测：「Source Han Serif SC」= 159.797，
       而假字体兜底 = 153.234 —— **不相等**，看起来又像存在

   可能解释：
     A. 它作为「字体族名别名」被系统映射到了别的字体（如 SimSun/STSong），
        因此混排宽度不同于兜底 —— 此时它虽不在 Fonts 目录，
        但 Windows 的字体映射表里有条目
     B. 有些字符（拉丁/数字段）在 A 的映射字体里量出来就是那个值
     C. 度量口径受「栈首 vs 单独」影响

   裁决手法：
     1. 纯拉丁/数字串（不含中文）逐字体量 → 区分「拉丁段来自哪」
     2. 纯中文串逐字体量 → 只有 SimSun 能区分出来
     3. 混排串 = 拉丁段宽度 + 中文段宽度，验证可加性
     4. 直接查注册表字体映射（HKLM\SOFTWARE\Microsoft\Windows NT\
        CurrentVersion\FontSubstitutes 与 Fonts）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  /* ---- 先离线查注册表字体映射 ---- */
  console.log('===== 注册表字体映射（FontSubstitutes / Fonts 别名）=====');
  var regPaths = [
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\FontSubstitutes',
    'HKCU\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\FontSubstitutes',
    'HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts'
  ];
  console.log('  （见下方 PowerShell 单独查询，此处只做记录）');

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
    "  var fams=['SimSun','NSimSun','STSong','Source Han Serif SC','Microsoft YaHei',",
    "            'SimHei','KaiTi','FangSong','DengXian','Georgia','Times New Roman','Arial'];",
    "  var out={};",
    "  var LAT='0123456789';",
    "  var CN='汉字的宽度测试';",
    "  var MIX='汉字的宽度测试ABC123';",
    "  out.LAT={}; out.CN={}; out.MIX={};",
    "  out.fake={ LAT:w('\"'+FAKE+'\"',LAT), CN:w('\"'+FAKE+'\"',CN), MIX:w('\"'+FAKE+'\"',MIX) };",
    "  for (var i=0;i<fams.length;i++){",
    "    var f=fams[i], spec='\"'+f+'\", \"'+FAKE+'\"';",
    "    out.LAT[f]=w(spec,LAT); out.CN[f]=w(spec,CN); out.MIX[f]=w(spec,MIX);",
    "  }",
    "  /* 关键：SHS 的拉丁段是否等于兜底的拉丁段？ */",
    "  out.shsVsFake = { latDiff: Math.round((out.LAT['Source Han Serif SC']-out.fake.LAT)*1000)/1000,",
    "                    cnDiff: Math.round((out.CN['Source Han Serif SC']-out.fake.CN)*1000)/1000,",
    "                    mixDiff: Math.round((out.MIX['Source Han Serif SC']-out.fake.MIX)*1000)/1000 };",
    "  /* 可加性验证：LAT + CN 是否等于 MIX（假字体下应成立） */",
    "  out.addFake = Math.round((out.fake.LAT+out.fake.CN)*1000)/1000;",
    "  out.addFakeVsMix = Math.round((out.addFake-out.fake.MIX)*1000)/1000;",
    "  document.body.removeChild(R);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await ev(PROBE);
  if (r && r.__err) { console.log('ERR ' + r.__err); process.exit(1); }
  var d = JSON.parse(r);

  console.log('\n===== 分段宽度矩阵 @14.5px/400 =====');
  console.log('  假字体兜底: LAT=' + d.fake.LAT + '  CN=' + d.fake.CN + '  MIX=' + d.fake.MIX);
  console.log('  可加性校验: LAT+CN=' + d.addFake + ' vs MIX=' + d.fake.MIX +
    ' (Δ' + d.addFakeVsMix + ') —— 应接近 0，说明分段可加\n');
  var fams = Object.keys(d.LAT);
  console.log('  ' + pad('字体', 24) + pad('LAT(10位)', 12) + pad('CN(8字)', 12) + 'MIX(13字)');
  for (var i = 0; i < fams.length; i++) {
    var f = fams[i];
    console.log('  ' + pad(f, 24) + pad(d.LAT[f], 12) + pad(d.CN[f], 12) + d.MIX[f]);
  }

  console.log('\n===== 「Source Han Serif SC」真伪裁决 =====');
  console.log('  拉丁段与兜底差 = ' + d.shsVsFake.latDiff + '  (≈0 → 拉丁段走兜底)');
  console.log('  中文段与兜底差 = ' + d.shsVsFake.cnDiff + '  (≈0 → 中文段走兜底)');
  console.log('  混排段与兜底差 = ' + d.shsVsFake.mixDiff);
  if (Math.abs(d.shsVsFake.latDiff) < 0.01 && Math.abs(d.shsVsFake.cnDiff) < 0.01) {
    console.log('  → 拉丁段与中文段**都等于兜底**，但混排段不等 ⇒ 说明该字体名');
    console.log('    被系统**映射到了某个替代字体**，而替代字体的分段度量与纯兜底不同。');
    console.log('    结论：Source Han Serif SC **不是本机安装的字体**（Fonts 目录无文件），');
    console.log('    但 Windows 字体替换表里可能有条目，使它在栈中"能解析"。');
  }
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
