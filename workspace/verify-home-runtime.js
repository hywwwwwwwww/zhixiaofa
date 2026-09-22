/**
 * 首页运行时检查：控制台报错 / 未捕获异常 / 数据是否真的渲染出来。
 * 用法：node verify-home-runtime.js [port]
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

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: [
      'window.__ERRORS__ = [];',
      'window.addEventListener("error", function (e) {',
      '  window.__ERRORS__.push("error: " + (e.message || "") + " @" + (e.filename || "") + ":" + (e.lineno || 0));',
      '});',
      'window.addEventListener("unhandledrejection", function (e) {',
      '  window.__ERRORS__.push("unhandledrejection: " + String(e.reason));',
      '});',
      'var _ce = console.error;',
      'console.error = function () {',
      '  window.__ERRORS__.push("console.error: " + Array.prototype.join.call(arguments, " "));',
      '  _ce.apply(console, arguments);',
      '};'
    ].join('\n')
  });
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8')
  });
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2800);

  var r = await send('Runtime.evaluate', {
    expression: `(function () {
      var g = document.getElementById('stat-grid');
      var vals = [];
      var cards = document.querySelectorAll('#stat-grid .zf-stat');
      for (var i = 0; i < cards.length; i++) {
        var v = cards[i].querySelector('.zf-stat__value');
        var l = cards[i].querySelector('.zf-stat__label');
        var ic = cards[i].querySelector('.zf-stat__icon i');
        vals.push({
          label: l ? l.textContent : null,
          value: v ? v.textContent : null,
          icon: ic ? ic.className : null,
          // 图标字形是否真的渲染出来（宽度为 0 说明字体缺码点 → 显示豆腐块）
          iconGlyphW: ic ? +ic.getBoundingClientRect().width.toFixed(1) : null
        });
      }
      return {
        errors: window.__ERRORS__ || [],
        welcome: (document.getElementById('welcome-title') || {}).textContent,
        cards: vals,
        qaCount: document.querySelectorAll('#qa-list .zf-list__item').length,
        tipCount: document.querySelectorAll('#tip-list .zf-list__item').length
      };
    })()`, returnByValue: true
  });
  var v = r.result.result.value || r.result.value;
  console.log(JSON.stringify(v, null, 2));

  var ok = true;
  if (v.errors.length) { ok = false; console.log('[FAIL] 存在运行时错误'); }
  else { console.log('[PASS] 无运行时错误'); }
  if (v.welcome && v.welcome.indexOf('张三') >= 0) { console.log('[PASS] 欢迎语已渲染'); }
  else { ok = false; console.log('[FAIL] 欢迎语未渲染'); }
  v.cards.forEach(function (c) {
    if (!/^\d+$/.test(c.value || '')) { ok = false; console.log('[FAIL] ' + c.label + ' 数值未渲染: ' + c.value); }
    if (!c.iconGlyphW) { ok = false; console.log('[FAIL] ' + c.label + ' 图标未渲染'); }
  });
  console.log('[INFO] 最近问答 ' + v.qaCount + ' 条 / 新人必看 ' + v.tipCount + ' 条');
  console.log(ok ? '全部通过' : '有失败项');
  process.exit(ok ? 0 : 1);
})();
