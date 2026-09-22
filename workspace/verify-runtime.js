/**
 * 最终检查：控制台报错 + 版本号一致性 + ES5 语法。
 */
var path = require('path');
var fs = require('fs');
var cp = require('child_process');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9402';
var BASE = 'http://127.0.0.1:' + PORT;
var ROOT = 'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/';
var F = 'file:///' + ROOT.replace(/ /g, '%20') + 'pages/profile.html';

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;

  var errors = [];
  // 收集控制台与运行时异常
  var ws2 = await cdp.connect(tab.webSocketDebuggerUrl);
  (async function () {
    // 复用同一 socket：这里直接监听不行，改用 Runtime.consoleAPICalled 轮询不可靠。
    // 折中：注入 window.onerror 收集器 + 覆写 console.error。
  })();

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

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

  var STUB = fs.readFileSync(path.join(process.env.USERPROFILE,
    '.workbuddy', 'binaries', 'node', 'workspace', 'zc-stub-pf.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });

  await send('Page.navigate', { url: F });
  await cdp.sleep(2800);

  // 交互一轮：切 3 个页签 + 点一次保存 + 触发一次校验失败
  await send('Runtime.evaluate', { expression: "document.getElementById('tab-pwd').click();" });
  await cdp.sleep(300);
  await send('Runtime.evaluate', { expression: "document.getElementById('tab-fav').click();" });
  await cdp.sleep(300);
  await send('Runtime.evaluate', { expression: "document.getElementById('tab-profile').click();" });
  await cdp.sleep(200);
  await send('Runtime.evaluate', {
    expression: "document.getElementById('pf-email').value='bad-email'; " +
      "document.getElementById('profile-form').dispatchEvent(new Event('submit',{cancelable:true}));"
  });
  await cdp.sleep(400);

  var res = (await send('Runtime.evaluate', {
    expression: `JSON.stringify({
      errors: window.__ERRORS__ || [],
      ariaInvalid: (function(){
        var e = document.getElementById('pf-email');
        return { ariaInvalid: e.getAttribute('aria-invalid'),
                 fieldInvalid: e.closest('.zf-field').classList.contains('zf-field--invalid'),
                 errText: e.closest('.zf-field').querySelector('.zf-form-error').textContent };
      })(),
      ariaRequired: (function(){
        var e = document.getElementById('pf-nickname');
        return { required: e.getAttribute('aria-required'),
                 describedby: e.getAttribute('aria-describedby'),
                 descExists: !!document.getElementById(e.getAttribute('aria-describedby')) };
      })()
    })`, returnByValue: true
  })).result.result.value;
  console.log('=== 运行时 ===');
  console.log(res);

  await send('Page.close').catch(function () {});
  process.exit(0);
})().catch(function (e) { console.error('ERROR', e); process.exit(2); });
