/* ============================================================================
   diag-serif-chain.js —— 衬线栈的「中文字形到底落到哪一项」

   起因：verify-doc-sheet.js 实测 .zf-doc--sheet 的西文/数字实际命中 Cambria，
   而不是栈首的 Georgia。这说明该环境下 Georgia 的匹配出了状况，
   必须查清 —— 否则「衬线栈」可能整段都没生效，只是碰巧宽度接近。

   更关键的是中文：Cambria 是纯西文字体，不含中文字形，所以中文必须继续往后
   回退到 Source Han Serif SC / SimSun。要验证这一点，得直接量中文字形。

   方法：逐个字体「单独」量同一串中文，看哪些字体能给出「非兜底」的宽度。
   能给出不同宽度的那个，就是中文字形的实际宿主体。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 600) }; }
    if (!r.result) { return { __raw: JSON.stringify(r).slice(0, 600) }; }
    if (r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 600) }; }
    return r.result.result ? r.result.result.value : undefined;
  }

  var raw = await ev([
    "(function(){",
    "  var FAKE='__ZF_NoSuchFont_1__';",
    "  var FONTS=['Georgia','Cambria','Times New Roman','Source Han Serif SC','SimSun',",
    "             'NSimSun','STSong','KaiTi','FangSong','SimHei','Microsoft YaHei','Segoe UI','Consolas'];",
    "  var g=document.createElement('canvas').getContext('2d');",
    "  function w(f,t,px,wt){ g.font=(wt||400)+' '+(px||14)+'px \"'+f+'\", \"'+FAKE+'\"'; return Math.round(g.measureText(t).width*100)/100; }",
    "  var out={cn:{}, latin:{}, digits:{}};",
    "  out.fake_digits = w(FAKE,'0123456789',14);",
    "  out.fake_cn = w(FAKE,'审查合同',14);",
    "  out.fake_latin = w(FAKE,'AI Contract',14);",
    "  FONTS.forEach(function(f){",
    "    out.cn[f] = w(f,'审查合同',14);",
    "    out.latin[f] = w(f,'AI Contract',14);",
    "    out.digits[f] = w(f,'0123456789',14);",
    "  });",
    "  // 直接问：某字体是否含中文字形 —— 用 document.fonts 不可靠，改用「与假字体是否等宽」",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n'));

  if (raw && raw.__err) { console.log('ERR ' + raw.__err); process.exit(1); }
  if (raw && raw.__raw) { console.log('RAW ' + raw.__raw); process.exit(1); }
  if (typeof raw !== 'string') { console.log('NOT A STRING: ' + typeof raw + ' ' + JSON.stringify(raw).slice(0, 400)); process.exit(1); }
  var d = JSON.parse(raw);

  console.log('兜底（假字体）基准: 数字=' + d.fake_digits + '  中文=' + d.fake_cn + '  拉丁=' + d.fake_latin);
  console.log('\n【关键】中文字形到底由哪个字体提供？');
  console.log('  （真含中文字形的字体，宽度会与兜底不同；纯西文字体会与兜底等宽）\n');
  console.log(pad('字体', 24) + pad('中文=审查合同', 16) + pad('vs兜底', 10) + pad('拉丁', 10) + pad('数字', 10) + '含中文字形?');
  Object.keys(d.cn).forEach(function (f) {
    var cnDiff = Math.abs(d.cn[f] - d.fake_cn);
    console.log(pad(f, 24) + pad(d.cn[f], 16) +
      pad(cnDiff < 0.6 ? '等宽' : (d.cn[f] - d.fake_cn).toFixed(2), 10) +
      pad(d.latin[f], 10) + pad(d.digits[f], 10) +
      (cnDiff < 0.6 ? '否（走兜底）' : 'YES'));
  });

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
