/**
 * 1100px 下左栏卡片 "height: 423.891px" 从哪来？
 * 判定依据：align-self 已是 auto，说明 align-self: stretch 已生效但被 flex 的
 * 默认 align-items: stretch 顶替 → 那 stretch 来自 .zf-content 的 flex 容器，
 * 属于项目既有约定（内页整体撑满视口），不是本轮的等高 hack 泄漏。
 */
var path = require('path');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));
var fs = require('fs');
var BASE = 'http://127.0.0.1:' + (process.argv[2] || '9402');
var F = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/profile.html';

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-pf.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Page.navigate', { url: F });
  await cdp.sleep(2200);

  for (var w of [1440, 1100, 820]) {
    await send('Emulation.setDeviceMetricsOverride',
      { width: w, height: 800, deviceScaleFactor: 1, mobile: false });
    await cdp.sleep(400);
    var q = `(function(){
      function D(sel){ var e=document.querySelector(sel); if(!e) return null;
        var c=getComputedStyle(e), r=e.getBoundingClientRect();
        return {h:Math.round(r.height), alignItems:c.alignItems, alignSelf:c.alignSelf,
                height:c.height, flexGrow:c.flexGrow, flexBasis:c.flexBasis}; }
      return {
        w: innerWidth,
        app: D('.zf-app'), main: D('.zf-main'), content: D('.zf-content'),
        desk: D('.zf-desk'), rail: D('.zf-profile-rail'), railCard: D('.zf-profile-rail > .zf-card'),
        work: D('.zf-work'), panel: D('#panel-profile'),
        pageH: document.documentElement.scrollHeight
      };
    })()`;
    var v = (await send('Runtime.evaluate', { expression: q, returnByValue: true })).result.result.value;
    console.log('\n=== viewport ' + w + ' (actual innerWidth=' + v.w + ') ===');
    console.log('pageH=' + v.pageH);
    ['app', 'main', 'content', 'desk', 'rail', 'railCard', 'work', 'panel'].forEach(function (k) {
      if (!v[k]) { console.log('  ' + k + ': null'); return; }
      console.log('  ' + k.padEnd(10) + ' h=' + String(v[k].h).padEnd(5) +
        ' alignSelf=' + String(v[k].alignSelf).padEnd(8) +
        ' cssHeight=' + String(v[k].height).padEnd(14) +
        ' flexGrow=' + v[k].flexGrow);
    });
  }
  await send('Page.close').catch(function () {});
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(2); });
