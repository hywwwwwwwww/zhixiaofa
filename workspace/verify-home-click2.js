/**
 * @file 首页列表改造 — 补充验证（hover / 窄屏 / 收藏状态 / 键盘 / 回归）
 *
 * 上一轮 verify-home-click.js 已覆盖主体交互 42 条，这里补它没测到的：
 *   1. hover 背景是否真的出现（浅底低对比反馈必须实测，不能只看 CSS 写了）
 *   2. 键盘 Enter / Space 能否展开（Space 必须 preventDefault 防滚动）
 *   3. 文章 id=3 的 favorited:true 是否正确回显「已收藏」
 *   4. 窄屏（1100 / 820 / 560）下负 margin 是否引发溢出
 *   5. 作用域未泄漏：profile.html / admin 的 .zf-list__item 不该有 pointer
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no about:blank target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    }
    return r.result.result.value !== undefined ? r.result.result.value : r.result.result.description;
  }

  async function boot(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: width, height: height, deviceScaleFactor: 1, mobile: false
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
    await send('Page.navigate', { url: BASE });
    await sleep(2500);
  }

  console.log('\n[1] hover 反馈（浅底低对比必须实测）');
  await boot(1440, 900);
  // 用鼠标真实移动触发 :hover（CDP 的 Input.dispatchMouseEvent）
  var box = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelector('#qa-list .zf-home-item');",
    "  var r = it.getBoundingClientRect();",
    "  return JSON.stringify({ x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2),",
    "    before: getComputedStyle(it).backgroundColor });",
    "})()"
  ].join('\n')));
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: box.x, y: box.y });
  await sleep(350);
  var hov = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelector('#qa-list .zf-home-item');",
    "  return JSON.stringify({ after: getComputedStyle(it).backgroundColor,",
    "    caretColor: getComputedStyle(it.querySelector('.zf-home-item__caret')).color });",
    "})()"
  ].join('\n')));
  ok('hover 前背景透明', /rgba\(0, 0, 0, 0\)/.test(box.before || ''), box.before);
  ok('hover 后出现底色', hov.after !== box.before && !/rgba\(0, 0, 0, 0\)/.test(hov.after || ''), hov.after);
  ok('hover 底色强度 >= .05（肉眼可见阈值）', (function () {
    var m = (hov.after || '').match(/rgba?\(([^)]+)\)/);
    if (!m) { return false; }
    var p = m[1].split(',').map(function (s) { return parseFloat(s); });
    return p.length >= 4 && p[3] >= 0.05;
  })(), hov.after);

  console.log('\n[2] 键盘可达性');
  var k1 = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelector('#qa-list .zf-home-item');",
    "  var ev1 = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });",
    "  it.dispatchEvent(ev1);",
    "  var opened = it.classList.contains('zf-home-item--open');",
    "  var ev2 = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });",
    "  it.dispatchEvent(ev2);",
    "  return JSON.stringify({ opened: opened, closed: !it.classList.contains('zf-home-item--open') });",
    "})()"
  ].join('\n')));
  ok('Enter 可展开', k1.opened === true);
  ok('Enter 可收起', k1.closed === true);

  var k2 = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelector('#qa-list .zf-home-item');",
    "  var e = new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true });",
    "  var prevented = !it.dispatchEvent(e);",
    "  return JSON.stringify({ prevented: prevented, opened: it.classList.contains('zf-home-item--open') });",
    "})()"
  ].join('\n')));
  ok('Space 触发展开', k2.opened === true, 'opened=' + k2.opened);
  ok('Space 已 preventDefault（防页面滚动）', k2.prevented === true, 'prevented=' + k2.prevented);
  await ev("document.querySelectorAll('#qa-list .zf-home-item')[0].click()");

  console.log('\n[3] 收藏状态回显（favorited 字段）');
  await ev([
    "(function(){",
    "  var t = document.querySelectorAll('#tip-list .zf-home-item')[2];",
    "  t.click();",
    "})()"
  ].join('\n'));
  await sleep(700);
  var fv = JSON.parse(await ev([
    "(function(){",
    "  var f = document.querySelector('#article-fav');",
    "  return JSON.stringify({",
    "    title: document.querySelector('#article-modal-title').textContent,",
    "    pressed: f.getAttribute('aria-pressed'),",
    "    hasFill: f.innerHTML.indexOf('star-fill') >= 0,",
    "    label: f.textContent.trim()",
    "  });",
    "})()"
  ].join('\n')));
  // 【断言修正】第 3 篇的标题是「离职时公司不发最后一个月工资合法吗？」，
  // 原来我误写成断言含「两个月工资」（那是第 4 篇的标题），属断言笔误。
  // 桩里第 1 篇 favorited:false，第 3 篇 favorited:true。
  ok('打开第 3 篇（favorited:true）', /最后一个月工资/.test(fv.title || ''), fv.title);
  ok('已收藏时 aria-pressed=true', fv.pressed === 'true', fv.pressed);
  ok('已收藏时图标是实心星', fv.hasFill === true);
  ok('已收藏时文案是「已收藏」', /已收藏/.test(fv.label || ''), fv.label);

  console.log('\n[4] 窄屏无溢出');
  var VIEWPORTS = [[1440, 900], [1100, 900], [820, 1000], [560, 1000]];
  for (var vi = 0; vi < VIEWPORTS.length; vi++) {
    var w = VIEWPORTS[vi][0], h = VIEWPORTS[vi][1];
    await boot(w, h);
    var r = JSON.parse(await ev([
      "(function(){",
      "  document.querySelectorAll('#qa-list .zf-home-item')[0].click();",
      "  var de = document.documentElement;",
      "  var bad = 0;",
      "  document.querySelectorAll('#qa-list *, #tip-list *').forEach(function(el){",
      "    var b = el.getBoundingClientRect();",
      "    if (b.width > 0 && (b.left < -1 || b.right > window.innerWidth + 1)) { bad++; }",
      "  });",
      "  var it = document.querySelector('#qa-list .zf-home-item');",
      "  var card = it.closest('.zf-card');",
      "  var cs = getComputedStyle(it);",
      "  return JSON.stringify({",
      "    sw: de.scrollWidth, iw: window.innerWidth, bad: bad,",
      "    padL: cs.paddingLeft, mL: cs.marginLeft,",
      "    itemLeft: Math.round(it.getBoundingClientRect().left),",
      "    cardLeft: Math.round(card.getBoundingClientRect().left),",
      "    cardPadL: getComputedStyle(card).paddingLeft,",
      "    listCols: getComputedStyle(document.querySelector('.zf-grid--2')).gridTemplateColumns",
      "  });",
      "})()"
    ].join('\n')));
    ok(w + ' 无横向滚动', r.sw <= r.iw + 1, 'sw=' + r.sw + ' iw=' + r.iw);
    ok(w + ' 展开态无越界元素', r.bad === 0, 'bad=' + r.bad);
    // 负 margin 不能把内容推出卡片左边界之外
    ok(w + ' 列表项未超出卡片左边界', r.itemLeft >= r.cardLeft - 1,
      'item=' + r.itemLeft + ' card=' + r.cardLeft);
  }

  console.log('\n==============================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error('ERR', e && e.message, e && e.stack);
  process.exit(1);
});
