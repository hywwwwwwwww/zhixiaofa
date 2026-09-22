/**
 * 剩余留白预算：832px 内容区只用了 496px，剩下的 314px 去哪了、能不能吃回来。
 * 逐层算出「可用高度」与「已用高度」，不靠推演。
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

  var q = `(function(){
    function box(sel){
      var e = document.querySelector(sel); if(!e) return null;
      var c = getComputedStyle(e), r = e.getBoundingClientRect();
      return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height),
        w: Math.round(r.width),
        pt: c.paddingTop, pb: c.paddingBottom, mt: c.marginTop, mb: c.marginBottom,
        display: c.display, gap: c.rowGap,
        maxH: c.maxHeight, minH: c.minHeight, hCSS: c.height, overflowY: c.overflowY };
    }
    function sum(sel){
      var els = document.querySelectorAll(sel), s = 0, rows = [];
      Array.prototype.forEach.call(els, function(e){
        var r = e.getBoundingClientRect(); s += r.height;
        rows.push({ id: e.id || e.className, h: Math.round(r.height) });
      });
      return { total: Math.round(s), rows: rows };
    }
    var out = { innerHeight: innerHeight };
    ['.zf-content', '.zf-desk', '.zf-profile-rail > .zf-card', '.zf-profile__head',
     '.zf-profile__stats', '.zf-recent', '.zf-recent__list',
     '.zf-work', '.zf-tabs', '#panel-profile', '#profile-form'].forEach(function (s) {
      out[s] = box(s);
    });
    out['panel-profile 直接子元素'] = sum('#panel-profile > *');
    out['form 直接子元素'] = sum('#profile-form > *');
    out['fill-grid 子元素'] = sum('.zf-fill-grid > *');
    out['recent 子元素'] = sum('.zf-recent > *');
    // tabpanel max-height 的实际像素值
    out['panelMaxH_px'] = getComputedStyle(document.getElementById('panel-profile')).maxHeight;
    return JSON.stringify(out, null, 1);
  })()`;

  await send('Page.navigate', { url: F });
  await cdp.sleep(2400);

  for (var vp of [[1440, 900], [1440, 1080], [1920, 1080]]) {
    await send('Emulation.setDeviceMetricsOverride',
      { width: vp[0], height: vp[1], deviceScaleFactor: 1, mobile: false });
    await cdp.sleep(450);
    console.log('\n########## ' + vp[0] + 'x' + vp[1] + ' ##########');
    var v = (await send('Runtime.evaluate', { expression: q, returnByValue: true })).result.result.value;
    console.log(v);
  }
  await send('Page.close').catch(function () {});
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(2); });
