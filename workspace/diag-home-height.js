/**
 * @file 归因：首页 docH 从 1220 涨到 1229，是哪条改动引起的？
 *
 * 手法与上一轮 diag-attribution.js 同款：页面加载后用注入样式逐条还原本次改动，
 * A/B 对比 docH。比"看代码猜"可靠得多。
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
  if (!target) { console.log('no target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) { return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 300) }; }
    return r.result.result.value;
  }

  var base = await ev([
    "(function(){",
    "  function m(){",
    "    var q = document.querySelector('#qa-list');",
    "    var t = document.querySelector('#tip-list');",
    "    return { docH: document.documentElement.scrollHeight,",
    "             qaH: Math.round(q.getBoundingClientRect().height),",
    "             tipH: Math.round(t.getBoundingClientRect().height),",
    "             qaItemH: Math.round(document.querySelector('#qa-list .zf-home-item').getBoundingClientRect().height),",
    "             tipItemH: Math.round(document.querySelector('#tip-list .zf-home-item').getBoundingClientRect().height) };",
    "  }",
    "  window.__m = m;",
    "  return JSON.stringify(m());",
    "})()"
  ].join('\n'));
  console.log('改造后基线:', base);

  // 逐条还原
  var CASES = [
    ['去掉整项左右 padding + 负 margin',
      '.zf-content--home .zf-home-item{padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important}'],
    ['去掉展开箭头 caret',
      '.zf-content--home .zf-home-item__caret{display:none!important}'],
    ['去掉徽标 margin-top',
      '.zf-content--home .zf-home-refs{margin-top:0!important}'],
    ['去掉列表项 border-bottom',
      '#qa-list .zf-list__item{border-bottom:none!important}']
  ];

  for (var i = 0; i < CASES.length; i++) {
    await ev("(function(){var s=document.getElementById('__diag');if(s)s.remove();var e=document.createElement('style');e.id='__diag';e.textContent=" +
      JSON.stringify(CASES[i][1]) + ";document.head.appendChild(e);})()");
    await sleep(300);
    var m = JSON.parse(await ev("JSON.stringify(window.__m())"));
    console.log('  ' + CASES[i][0] + '  ->  docH=' + m.docH + ' (Δ' + (m.docH - JSON.parse(base).docH) + ')  qaItemH=' + m.qaItemH + '  qaH=' + m.qaH);
  }

  // 全还原（所有改动同时去掉）
  await ev("(function(){var s=document.getElementById('__diag');if(s)s.remove();var e=document.createElement('style');e.id='__diag';e.textContent='" +
    '.zf-content--home .zf-home-item{padding-left:0!important;padding-right:0!important;margin-left:0!important;margin-right:0!important}' +
    '.zf-content--home .zf-home-item__caret{display:none!important}' +
    '.zf-content--home .zf-home-refs{margin-top:0!important}' +
    "';document.head.appendChild(e);})()");
  await sleep(300);
  var all = JSON.parse(await ev("JSON.stringify(window.__m())"));
  console.log('  全部还原  ->  docH=' + all.docH + '  qaItemH=' + all.qaItemH + '  qaH=' + all.qaH);

  // 逐条测出每个元素的实际高度贡献
  console.log('\n元素高度明细：');
  var detail = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelector('#qa-list .zf-home-item');",
    "  var cs = getComputedStyle(it);",
    "  var tit = it.querySelector('.zf-list__title');",
    "  var txt = it.querySelector('.zf-list__text');",
    "  var meta = it.querySelector('.zf-list__meta');",
    "  var badge = it.querySelector('.zf-home-refs');",
    "  return JSON.stringify({",
    "    itemH: Math.round(it.getBoundingClientRect().height),",
    "    itemPadT: cs.paddingTop, itemPadB: cs.paddingBottom,",
    "    titleH: Math.round(tit.getBoundingClientRect().height),",
    "    textH: Math.round(txt.getBoundingClientRect().height),",
    "    metaH: Math.round(meta.getBoundingClientRect().height),",
    "    badgeH: badge ? Math.round(badge.getBoundingClientRect().height) : null,",
    "    badgeMt: badge ? Math.round(badge.getBoundingClientRect().top - meta.getBoundingClientRect().top) : null,",
    "    metaMt: Math.round(meta.getBoundingClientRect().top - txt.getBoundingClientRect().bottom),",
    "    titleLh: getComputedStyle(tit).lineHeight,",
    "    caretDisplay: getComputedStyle(it.querySelector('.zf-home-item__caret')).display",
    "  });",
    "})()"
  ].join('\n')));
  console.log(JSON.stringify(detail, null, 2));

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message); process.exit(1); });
