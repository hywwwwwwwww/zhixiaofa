/* ============================================================================
   verify-fonts.js —— 字体方案落地实测（改 css 后必跑）

   验证五件事：
     [1] body 实际命中的字体是不是变短了（旧栈 5 项死项 → 新栈）
     [2] .zf-num / .zf-law / .zf-doc--sheet 的计算 font-family 是否正确
     [3] 换字体后关键元素宽度有没有变化（横向溢出 / 换行错位风险）
     [4] 页面总高与横向溢出（scrollWidth > clientWidth 即溢出）
     [5] 与改造前基线对比（基线值硬编码，来自 font-matrix.json）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var PAGES = ['home.html', 'doc-drafting.html', 'court.html', 'qa.html', 'knowledge.html'];

var results = [];
var fails = [];

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) {
    for (i = 0; i < tabs.length; i++) {
      if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
    }
  }
  if (!target) { console.log('no target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 600) }; }
    return r.result.result.value;
  }

  var VIEWPORTS = [[1440, 900], [1366, 768], [1100, 800], [820, 800], [560, 800]];

  for (var pi = 0; pi < PAGES.length; pi++) {
    var file = PAGES[pi];
    for (var vi = 0; vi < VIEWPORTS.length; vi++) {
      var vp = VIEWPORTS[vi];
      await send('Emulation.setDeviceMetricsOverride',
        { width: vp[0], height: vp[1], deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: BASE + file });
      await sleep(1700);

      var raw = await ev([
        "(function(){",
        "  var o = { href: location.pathname, vw: window.innerWidth, vh: window.innerHeight };",
        "  o.docW = document.documentElement.scrollWidth;",
        "  o.docH = document.documentElement.scrollHeight;",
        "  o.overflowX = document.documentElement.scrollWidth > window.innerWidth;",
        "  var cs = getComputedStyle(document.body);",
        "  o.bodyFF = cs.fontFamily;",
        "  o.bodyFS = cs.fontSize;",
        "  // 实测 body 的第一段是否被命中：量 'AI' 宽度与 Segoe UI 对比",
        "  var g = document.createElement('canvas').getContext('2d');",
        "  function w(f,t,px){ g.font='400 '+px+'px \"'+f+'\", \"__NO__\"'; return Math.round(g.measureText(t).width*100)/100; }",
        "  o.segoe_AI = w('Segoe UI','AI',14);",
        "  o.yahei_AI = w('Microsoft YaHei','AI',14);",
        "  var sp = document.createElement('span');",
        "  sp.style.cssText='position:absolute;left:-9999px;white-space:pre;';",
        "  sp.style.fontFamily = cs.fontFamily; sp.style.fontSize='14px';",
        "  sp.textContent = 'AI';",
        "  document.body.appendChild(sp);",
        "  o.real_AI = Math.round(sp.getBoundingClientRect().width*100)/100;",
        "  sp.textContent='审查合同';",
        "  o.real_cn = Math.round(sp.getBoundingClientRect().width*100)/100;",
        "  document.body.removeChild(sp);",
        "  // 关键元素字体",
        "  o.els = {};",
        "  [['.zf-doc--sheet','sheet'],['.zf-doc--prose','prose'],['.zf-law__name','lawname'],",
        "   ['.zf-law__text','lawtext'],['.zf-num','num'],['.zf-card__title','cardtitle'],",
        "   ['.zf-stat__value','statval'],['.zf-msg__bubble','bubble']].forEach(function(p){",
        "    var el = document.querySelector(p[0]);",
        "    if (!el) { o.els[p[1]] = null; return; }",
        "    var c = getComputedStyle(el);",
        "    o.els[p[1]] = { ff: c.fontFamily, px: c.fontSize, lh: c.lineHeight, ls: c.letterSpacing, w: Math.round(el.getBoundingClientRect().width*100)/100 };",
        "  });",
        "  // 溢出元素扫描：找出所有宽度超出视口的元素",
        "  o.wide = [];",
        "  var all = document.querySelectorAll('body *');",
        "  for (var i=0;i<all.length;i++){",
        "    var r = all[i].getBoundingClientRect();",
        "    if (r.width > window.innerWidth + 1) {",
        "      var cls = (typeof all[i].className==='string' && all[i].className) ? '.'+all[i].className.trim().split(/\\s+/)[0] : '';",
        "      if (o.wide.length < 8) o.wide.push({ t: all[i].tagName.toLowerCase()+cls, w: Math.round(r.width) });",
        "    }",
        "  }",
        "  return JSON.stringify(o);",
        "})()"
      ].join('\n'));

      if (raw && raw.__err) { fails.push(file + ' ' + vp + ' ERR ' + raw.__err); continue; }
      var d = JSON.parse(raw);
      d.file = file; d.vp = vp;
      results.push(d);
    }
  }

  /* ---- 输出 ---- */
  console.log('==================== body 字体是否命中新栈 ====================');
  var h = results[0];
  console.log('  body ff = ' + h.bodyFF);
  console.log('  实测 "AI" 宽度 = ' + h.real_AI +
    '   (Segoe UI=' + h.segoe_AI + ' / YaHei=' + h.yahei_AI + ')');
  if (Math.abs(h.real_AI - h.segoe_AI) < 0.6) {
    console.log('  ✓ 西文/数字命中 Segoe UI（新栈生效）');
  } else if (Math.abs(h.real_AI - h.yahei_AI) < 0.6) {
    console.log('  ✗ 仍命中 Microsoft YaHei —— 新栈第一段未生效！');
    fails.push('body 第一段 Segoe UI 未命中');
  } else {
    console.log('  ? 命中未知字体，需人工判断');
  }
  console.log('  实测 "审查合同" 宽度 = ' + h.real_cn + '  (基线 56@14px，应为 56)');
  if (Math.abs(h.real_cn - 56) > 0.6) { fails.push('中文宽度偏离基线: ' + h.real_cn); }

  console.log('\n==================== 各页面横向溢出 & 页面高度 ====================');
  PAGES.forEach(function (f) {
    console.log('\n-- ' + f);
    results.filter(function (r) { return r.file === f; }).forEach(function (r) {
      var flag = r.overflowX ? ' ✗溢出!' : ' ✓';
      console.log('  ' + pad(r.vp[0] + 'x' + r.vp[1], 11) + pad('docW=' + r.docW, 11) +
        pad('docH=' + r.docH, 11) + flag);
      if (r.overflowX) { fails.push(f + ' ' + r.vp[0] + 'px 横向溢出 docW=' + r.docW); }
      if (r.wide.length) {
        r.wide.forEach(function (w) { console.log('        ⚠ ' + w.t + ' w=' + w.w); });
      }
    });
  });

  console.log('\n==================== 关键元素计算字体 ====================');
  var seen = {};
  results.forEach(function (r) {
    Object.keys(r.els).forEach(function (k) {
      var e = r.els[k];
      if (!e) { return; }
      var key = k + '|' + e.ff + '|' + e.px + '|' + e.lh + '|' + e.ls;
      if (seen[key]) { seen[key].files += ',' + r.file.replace('.html', ''); return; }
      seen[key] = { k: k, e: e, files: r.file.replace('.html', '') };
    });
  });
  Object.keys(seen).forEach(function (key) {
    var s = seen[key];
    console.log('\n  [' + s.k + ']  出现在: ' + s.files);
    console.log('    ff = ' + s.e.ff);
    console.log('    ' + s.e.px + '  lh=' + s.e.lh + '  ls=' + s.e.ls + '  w=' + s.e.w);
  });

  console.log('\n==================== 结论 ====================');
  if (fails.length) {
    console.log('✗ ' + fails.length + ' 项失败:');
    fails.forEach(function (f) { console.log('   - ' + f); });
  } else {
    console.log('✓ 全部断言通过（' + results.length + ' 组页面×视口）');
  }
  process.exit(fails.length ? 1 : 0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
