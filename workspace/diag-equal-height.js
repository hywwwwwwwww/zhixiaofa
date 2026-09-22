/**
 * 等高疑难诊断：直接读计算样式与网格行，而不是靠推演。
 */
var path = require('path');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));
var fs = require('fs');

var PORT = process.argv[2] || '9402';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/profile.html';

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-pf.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2400);

  var q = `(function(){
    var desk = document.querySelector('.zf-desk');
    var rail = document.querySelector('.zf-profile-rail');
    var work = document.querySelector('.zf-work');
    function info(el, name) {
      if (!el) return name + ': NULL';
      var cs = getComputedStyle(el);
      var r = el.getBoundingClientRect();
      var o = {
        display: cs.display, gridColumn: cs.gridColumn, gridRow: cs.gridRow,
        gridAutoRows: cs.gridAutoRows, gridTemplateRows: cs.gridTemplateRows,
        gridTemplateColumns: cs.gridTemplateColumns,
        height: cs.height, alignSelf: cs.alignSelf,
        flex: cs.flex, flexGrow: cs.flexGrow, flexShrink: cs.flexShrink, flexBasis: cs.flexBasis,
        maxHeight: cs.maxHeight,
        rectH: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom)
      };
      return name + ': ' + JSON.stringify(o);
    }
    var out = [];
    out.push(info(desk, 'desk'));
    out.push(info(rail, 'rail'));
    out.push(info(work, 'work'));
    out.push(info(document.querySelector('.zf-work > .zf-tabs'), 'tabs'));
    out.push(info(document.getElementById('panel-profile'), 'panel-profile'));
    out.push(info(document.getElementById('panel-pwd'), 'panel-pwd(hidden)'));
    out.push(info(document.getElementById('favorites'), 'favorites(hidden)'));

    // desk 有几个直系子元素、各自 grid-row 占位
    var kids = [];
    Array.prototype.forEach.call(desk.children, function (c, i) {
      var cs = getComputedStyle(c);
      var r = c.getBoundingClientRect();
      kids.push({ i: i, cls: c.className, col: cs.gridColumn, row: cs.gridRow,
        h: Math.round(r.height), top: Math.round(r.top), bottom: Math.round(r.bottom) });
    });
    out.push('desk children: ' + JSON.stringify(kids, null, 1));

    // work 的直系子元素定位情况
    var wk = [];
    Array.prototype.forEach.call(work.children, function (c, i) {
      var cs = getComputedStyle(c);
      wk.push({ i: i, id: c.id || '', cls: c.className, col: cs.gridColumn, row: cs.gridRow,
        display: cs.display, flexBasis: cs.flexBasis, h: Math.round(c.getBoundingClientRect().height) });
    });
    out.push('work children: ' + JSON.stringify(wk, null, 1));

    // 样式表里是否真的存在这条规则（验证加载的是最新 css）
    var found = 'not-found';
    try {
      for (var s = 0; s < document.styleSheets.length; s++) {
        var ss = document.styleSheets[s];
        var rules;
        try { rules = ss.cssRules; } catch (e) { continue; }
        if (!rules) continue;
        for (var r2 = 0; r2 < rules.length; r2++) {
          if (rules[r2].selectorText && rules[r2].selectorText.indexOf('zf-desk__other') >= 0
              && rules[r2].selectorText.indexOf('.zf-work >') >= 0) {
            found = ss.href ? ss.href.split('/').pop() : 'inline';
            found += ' :: ' + rules[r2].cssText;
          }
        }
      }
    } catch (e) { found = 'ERR ' + e.message; }
    out.push('RULE FOUND: ' + found);
    out.push('css href: ' + Array.prototype.map.call(document.querySelectorAll('link[rel=stylesheet]'),
      function (l) { return l.getAttribute('href'); }).join(' | '));
    return out.join('\\n');
  })()`;

  var res = await send('Runtime.evaluate', { expression: q, returnByValue: true });
  console.log(res.result.result.value || JSON.stringify(res.result));
  await send('Page.close').catch(function () {});
  process.exit(0);
})().catch(function (e) { console.error(e); process.exit(2); });
