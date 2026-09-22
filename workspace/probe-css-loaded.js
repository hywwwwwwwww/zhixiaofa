/**
 * 探针：确认页面实际加载的 app.css 里有没有我新加的规则。
 * 不靠推断 —— 直接问浏览器的样式表。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2400);

  var q = `(function () {
    var out = { sheets: [], hasHomeScope: false, homeSection: null, statCls: null };
    var sec = document.querySelector('.zf-content');
    out.homeSection = sec ? sec.className : null;
    out.hashScope = !!document.querySelector('.zf-content--home');
    var st = document.querySelector('#stat-grid .zf-stat');
    out.statCls = st ? st.className : null;
    var ico = document.querySelector('#stat-grid .zf-stat__icon');
    var cs = ico ? getComputedStyle(ico) : null;
    out.iconComputed = cs ? { w: cs.width, h: cs.height, font: cs.fontSize } : null;
    var stcs = st ? getComputedStyle(st) : null;
    out.statComputed = stcs ? { pad: stcs.padding, gap: stcs.gap, dir: stcs.flexDirection } : null;
    var rules = [];
    for (var i = 0; i < document.styleSheets.length; i++) {
      var ss = document.styleSheets[i];
      var name = ss.href ? ss.href.split('/').pop() : '(inline)';
      var n = 0, hit = [];
      try {
        var rs = ss.cssRules;
        n = rs.length;
        for (var j = 0; j < rs.length; j++) {
          var txt = rs[j].selectorText || '';
          if (txt.indexOf('zf-content--home') >= 0) { hit.push(txt); }
        }
      } catch (e) { n = -1; }
      out.sheets.push({ name: name, rules: n, homeRules: hit.length });
      rules = rules.concat(hit);
    }
    out.homeRulesFound = rules;
    return out;
  })()`;

  var r = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  console.log(JSON.stringify(r.result.result.value || r.result.value, null, 2));
  process.exit(0);
})();
