/**
 * @file 拆解 1220 这个「上一轮基线」到底是怎么来的。
 *
 * 事实链：
 *   · 本轮 diag-home-ab.js 已证明：可点击改造对 docH 的贡献 = 0px
 *   · 但 verify-home-stat.js 的硬编码基线 1220 现在读出来是 1229（+9）
 * 因此要么 1220 这个数当时测得不准，要么中间还有别的改动。
 * 这里把两轮改动分别停掉，看能还原到哪个值。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });

  async function ev(e) {
    var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }; }
    return r.result.result.value;
  }

  async function measure(label, w) {
    var m = JSON.parse(await ev([
      "(function(){",
      "  var cards = [];",
      "  document.querySelectorAll('.zf-content--home .zf-card').forEach(function(c){",
      "    cards.push(Math.round(c.getBoundingClientRect().height));",
      "  });",
      "  return JSON.stringify({",
      "    docH: document.documentElement.scrollHeight,",
      "    cards: cards,",
      "    qaBox: Math.round(document.querySelector('#qa-list').getBoundingClientRect().height),",
      "    tipBox: Math.round(document.querySelector('#tip-list').getBoundingClientRect().height)",
      "  });",
      "})()"
    ].join('\n')));
    console.log('  [' + w + '] ' + label.padEnd(26) + ' docH=' + String(m.docH).padEnd(5) +
      ' qaBox=' + String(m.qaBox).padEnd(4) + ' tipBox=' + String(m.tipBox).padEnd(4) +
      ' cards=' + JSON.stringify(m.cards));
    return m;
  }

  var RESULT = {};

  // ---- 1440 ----
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);
  console.log('=== 1440x900 ===');
  RESULT.now = await measure('现状（两轮改动都在）', 1440);

  // 停掉本轮可点击样式
  await ev("(function(){var e=document.createElement('style');e.textContent='" +
    '.zf-content--home .zf-home-item{padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important}' +
    '.zf-content--home .zf-home-item__caret{display:none!important}' +
    '.zf-content--home .zf-home-refs{margin-top:0!important;padding:0!important}' +
    "';document.head.appendChild(e);})()");
  await sleep(300);
  RESULT.noClick = await measure('停掉可点击样式', 1440);

  // 再停掉指标卡样式（还原成通用 zf-stat）
  await ev("(function(){var e=document.createElement('style');e.textContent='" +
    '#stat-grid .zf-stat{display:flex!important;grid-template-columns:none!important;padding:18px 20px!important;row-gap:0!important;column-gap:12px!important;justify-content:normal!important}' +
    '#stat-grid .zf-stat__icon{width:42px!important;height:42px!important;font-size:18px!important;grid-area:auto!important}' +
    '#stat-grid .zf-stat__value{font-size:22px!important;margin-top:1px!important}' +
    '#stat-grid .zf-stat__label{font-size:12px!important}' +
    '#stat-grid .zf-stat__go{grid-area:auto!important;margin-left:auto!important;margin-right:0!important;justify-self:auto!important}' +
    "';document.head.appendChild(e);})()");
  await sleep(300);
  RESULT.noBoth = await measure('再停掉指标卡样式', 1440);

  console.log('\n=== 汇总（1440x900）===');
  console.log('  现状                      docH=' + RESULT.now.docH);
  console.log('  停可点击样式              docH=' + RESULT.noClick.docH + '  Δ=' + (RESULT.noClick.docH - RESULT.now.docH));
  console.log('  两轮样式都停              docH=' + RESULT.noBoth.docH);
  console.log('  上一轮记录的基线          docH=1220');
  console.log('  最初基线（改造前）        docH=1262');

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
