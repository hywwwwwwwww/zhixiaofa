/**
 * 共享影响面回归：确认 .zf-content--home 作用域没有泄漏到
 *   - pages/profile.html（4 张指标卡，2×2）
 *   - admin/index.html（8 张指标卡）
 * 这两页也用 .zf-stat，必须证明它们的尺寸与改造前完全一致。
 *
 * 用法：node verify-home-scope.js [port]
 */
var path = require('path');
var fs = require('fs');
var http = require('http');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

/**
 * 关闭标签页。
 * 【为什么不用 cdp.httpGet】/json/close 返回纯文本 "Target is closing" 而非 JSON，
 * cdp.js 的 httpGet 内部直接 JSON.parse，异常在回调里抛出、逃出 Promise 链，
 * try/catch 拦不住（实测进程直接崩溃）。这里自己发一个裸请求只丢弃响应。
 */
function closeTab(port, id) {
  return new Promise(function (resolve) {
    var req = http.get({
      hostname: '127.0.0.1', port: port, path: '/json/close/' + id
    }, function (res) {
      res.resume();
      res.on('end', resolve);
    });
    req.on('error', resolve);
    req.setTimeout(2000, function () { req.destroy(); resolve(); });
  });
}

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;

var ADMIN_URL = process.env.ADMIN_URL ||
  'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/admin/index.html';

var PAGES = [
  { name: 'profile',
    url: 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/profile.html',
    file: 'profile.html', stub: 'zc-stub-pf.js', sel: '.zf-profile__stats .zf-stat' },
  { name: 'admin', url: ADMIN_URL,
    file: 'index.html', stub: 'zc-stub-admin.js', sel: '.zf-stat' }
];

var PROBE = function (sel) { return `(function () {
  var el = document.querySelector(${JSON.stringify(sel)});
  if (!el) { return { error: 'not found: ' + ${JSON.stringify(sel)} }; }
  var ico = el.querySelector('.zf-stat__icon');
  var val = el.querySelector('.zf-stat__value');
  var cs = getComputedStyle(el);
  var ics = ico ? getComputedStyle(ico) : null;
  var vcs = val ? getComputedStyle(val) : null;
  return {
    // 【必须先断言页面身份】否则 A 页的探针可能读到 B 页的结果。
    // 实测踩过：循环里连开两个标签页时，admin 那轮读到的其实是 home 的文档，
    // 于是"作用域泄漏"、"图标 52px"等 6 条断言集体误报。
    // 本环境里 /json/new 与 Page.navigate 存在竞态，必须自查 document.location。
    docUrl: document.location.href,
    // 这些是通用 .zf-stat 的"标准值"，作用域未泄漏时应保持不变
    display: cs.display,
    flexDir: cs.flexDirection,
    padding: cs.padding,
    gap: cs.gap,
    gridTemplateColumns: cs.gridTemplateColumns,
    iconW: ics ? ics.width : null,
    iconH: ics ? ics.height : null,
    iconFont: ics ? ics.fontSize : null,
    iconGridArea: ics ? ics.gridArea : null,
    valueFont: vcs ? vcs.fontSize : null,
    // 页面里有没有误挂到 home 作用域
    homeScopeCount: document.querySelectorAll('.zf-content--home').length
  };
})()`; };

var pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; } else { fail++; }
  console.log((cond ? '[PASS] ' : '[FAIL] ') + label + (detail ? '  ' + detail : ''));
}

(async function () {
  for (var i = 0; i < PAGES.length; i++) {
    var p = PAGES[i];
    console.log('\n===== ' + p.name + ' =====');
    var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
    var ws = await cdp.connect(tab.webSocketDebuggerUrl);
    var send = ws.send;
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Network.enable');
    await send('Network.setCacheDisabled', { cacheDisabled: true });
    await send('Page.addScriptToEvaluateOnNewDocument', {
      source: fs.readFileSync(path.join(__dirname, p.stub), 'utf8')
    });
    await send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: p.url });
    await cdp.sleep(2200);

    var r = await send('Runtime.evaluate',
      { expression: PROBE(p.sel), returnByValue: true });
    var v = r.result.result.value || r.result.value;
    if (!v || v.error) { ok(p.name + ' 探针', false, JSON.stringify(v)); continue; }
    console.log('  ' + JSON.stringify(v));

    // 先确认这一轮真的在目标页上
    ok(p.name + '：探针指向正确页面', (v.docUrl || '').indexOf(p.file) >= 0,
      v.docUrl);

    ok(p.name + '：未误挂 .zf-content--home', v.homeScopeCount === 0,
      'count=' + v.homeScopeCount);
    ok(p.name + '：仍是 flex 布局（未被 grid 污染）',
      v.display === 'flex', 'display=' + v.display);
    ok(p.name + '：未被强制 grid-template-columns',
      v.gridTemplateColumns === 'none', v.gridTemplateColumns);
    ok(p.name + '：图标仍是 42px（admin）/ 36px（profile）',
      p.name === 'admin' ? v.iconW === '42px' : v.iconW === '36px', 'iconW=' + v.iconW);
    ok(p.name + '：图标 gridArea 未被改写', v.iconGridArea === 'auto', v.iconGridArea);
    ok(p.name + '：数字字号未变',
      p.name === 'admin' ? v.valueFont === '22px' : v.valueFont === '19px',
      'valueFont=' + v.valueFont);

    // 【必须关标签页】否则下一轮的 /json/new + Page.navigate 会和上一轮竞态，
    // 实测表现为"探针读到了上一页的文档"（admin 那轮读到 home，6 条断言集体误报）。
    await closeTab(PORT, tab.id);
    await cdp.sleep(300);
  }
  console.log('\n===== 汇总 =====');
  console.log('PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
})();
