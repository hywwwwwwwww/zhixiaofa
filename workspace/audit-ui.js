// audit-ui.js —— 全站 UI 现状量化体检（为 UI 优化方案提供实测基线）
// 用法: python workspace/runnode.py audit-ui.js
// 输出: workspace/ui-audit.json（结构化）+ 控制台摘要
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');
var http = require('http');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

function httpGetRaw(url) {
  return new Promise(function (resolve, reject) {
    http.get(url, function (res) {
      var d = '';
      res.on('data', function (c) { d += c; });
      res.on('end', function () { resolve(d); });
    }).on('error', reject);
  });
}

// 页面清单：[文件, 作用域类, 桩脚本, 描述]
var PAGES = [
  { f: 'pages/home.html', name: 'home', stub: 'zc-stub-home.js', desc: '首页/工作台卡片流', scope: 'zf-content--home' },
  { f: 'pages/court.html', name: 'court', stub: 'zc-stub-home.js', desc: '模拟法庭（左输入右结果）', scope: 'zf-content--court' },
  { f: 'pages/contract-review.html', name: 'contract', stub: 'zc-stub-home.js', desc: '合同审查', scope: 'zf-content--contract' },
  { f: 'pages/doc-drafting.html', name: 'doc', stub: 'zc-stub-home.js', desc: '法律文书起草（左模板右页签）', scope: 'zf-content--doc' },
  { f: 'pages/knowledge.html', name: 'kn', stub: 'zc-stub-home.js', desc: '法律知识库（筛选+网格）', scope: 'zf-content--knowledge' },
  { f: 'pages/qa.html', name: 'qa', stub: 'zc-stub-home.js', desc: '法律问答', scope: 'zf-content--qa' },
  { f: 'pages/profile.html', name: 'pf', stub: 'zc-stub-pf.js', desc: '个人中心（左概览右页签）', scope: 'zf-content--profile' }
];

var VIEWPORTS = [
  { w: 1440, h: 900, tag: 'desktop' },
  { w: 1100, h: 800, tag: 'laptop' },
  { w: 820, h: 1000, tag: 'tablet' },
  { w: 560, h: 900, tag: 'phone' }
];

var PROBE = function () {
  function px(v) { var n = parseFloat(v); return isNaN(n) ? 0 : n; }
  function cs(el, p) { return window.getComputedStyle(el).getPropertyValue(p); }

  // ---- 1. 对比度计算 ----
  function lum(c) {
    var m = c.match(/\d+(\.\d+)?/g);
    if (!m) { return null; }
    var r = +m[0] / 255, g = +m[1] / 255, b = +m[2] / 255;
    function f(x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  }
  function cr(fg, bg) {
    var a = lum(fg), b = lum(bg);
    if (a === null || b === null) { return null; }
    var hi = Math.max(a, b), lo = Math.min(a, b);
    return +(((hi + 0.05) / (lo + 0.05)).toFixed(2));
  }
  function effBg(el) {
    var n = el, guard = 0;
    while (n && guard++ < 30) {
      var c = cs(n, 'background-color');
      var m = c.match(/[\d.]+/g);
      if (m && m.length >= 3 && (m.length < 4 || parseFloat(m[3]) > 0.5)) { return c; }
      n = n.parentElement;
    }
    return 'rgb(255,255,255)';
  }

  var out = {};

  // ---- 2. 可读文字对比度扫描 ----
  var textNodes = [];
  var all = document.querySelectorAll('*');
  for (var i = 0; i < all.length; i++) {
    var el = all[i];
    // 只取直接含文本的叶子
    var hasText = false;
    for (var k = 0; k < el.childNodes.length; k++) {
      if (el.childNodes[k].nodeType === 3 && el.childNodes[k].textContent.trim().length > 1) { hasText = true; break; }
    }
    if (!hasText) { continue; }
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) { continue; }
    if (cs(el, 'visibility') === 'hidden' || cs(el, 'display') === 'none') { continue; }
    if (parseFloat(cs(el, 'opacity')) < 0.1) { continue; }
    var fs = px(cs(el, 'font-size'));
    var fw = cs(el, 'font-weight');
    var ratio = cr(cs(el, 'color'), effBg(el));
    var large = fs >= 18.66 || (fs >= 14 && (fw === '700' || fw === 'bold' || +fw >= 700));
    var need = large ? 3.0 : 4.5;
    var txt = '';
    for (var k2 = 0; k2 < el.childNodes.length; k2++) {
      if (el.childNodes[k2].nodeType === 3) { txt += el.childNodes[k2].textContent; }
    }
    txt = txt.trim().replace(/\s+/g, ' ').slice(0, 26);
    if (!txt) { continue; }
    textNodes.push({
      sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : ''),
      txt: txt, fs: +fs.toFixed(1), fw: fw, color: cs(el, 'color'),
      bg: effBg(el), ratio: ratio, need: need,
      pass: ratio === null ? null : ratio >= need,
      large: large
    });
  }
  // 只报不通过的，按 ratio 升序
  var fails = [];
  for (var i2 = 0; i2 < textNodes.length; i2++) {
    if (textNodes[i2].pass === false) { fails.push(textNodes[i2]); }
  }
  fails.sort(function (a, b) { return a.ratio - b.ratio; });
  out.textTotal = textNodes.length;
  out.contrastFails = fails.slice(0, 60);
  out.contrastFailCount = fails.length;

  // ---- 3. 点击目标尺寸（>=32px 经验值，WCAG 2.5.5 为 44px）----
  var clickable = document.querySelectorAll('a, button, [role="button"], input[type="checkbox"], input[type="radio"], .zf-tag, .zf-chip, .zf-tabs__item, .zf-pager__item, [aria-pressed]');
  var small = [];
  for (var j = 0; j < clickable.length; j++) {
    var c2 = clickable[j];
    var rr = c2.getBoundingClientRect();
    if (rr.width < 1 || rr.height < 1) { continue; }
    if (cs(c2, 'visibility') === 'hidden' || cs(c2, 'display') === 'none') { continue; }
    if (rr.height < 32 || rr.width < 24) {
      small.push({
        sel: c2.tagName.toLowerCase() + (c2.className && typeof c2.className === 'string' ? '.' + String(c2.className).trim().split(/\s+/).join('.') : ''),
        w: +rr.width.toFixed(1), h: +rr.height.toFixed(1),
        txt: (c2.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 20)
      });
    }
  }
  out.smallTargets = small.slice(0, 40);
  out.smallTargetCount = small.length;

  // ---- 4. 硬编码色（非令牌）扫描：从样式表读，不依赖 DOM ----
  var hexBag = {};
  var rgbaBag = {};
  try {
    for (var s = 0; s < document.styleSheets.length; s++) {
      var sheet = document.styleSheets[s];
      var rules;
      try { rules = sheet.cssRules; } catch (e) { continue; }
      if (!rules) { continue; }
      for (var q = 0; q < rules.length; q++) {
        var rule = rules[q];
        if (rule.type !== 1) { continue; }
        var body = rule.style ? rule.cssText : '';
        var hs = body.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
        for (var h = 0; h < hs.length; h++) { hexBag[hs[h].toLowerCase()] = (hexBag[hs[h].toLowerCase()] || 0) + 1; }
        var rs = body.match(/rgba?\([^)]*\)/g) || [];
        for (var g = 0; g < rs.length; g++) { rgbaBag[rs[g]] = (rgbaBag[rs[g]] || 0) + 1; }
      }
    }
  } catch (e2) { out.sheetErr = String(e2); }
  out.hexBag = hexBag;
  out.rgbaBag = rgbaBag;

  // ---- 5. 布局几何：主要区块 ----
  var blocks = [];
  var sel = ['.zf-card', '.zf-grid', '.zf-stat', '.zf-desk', '.zf-work', '.zf-panel',
    '.zf-list', '.zf-art-grid', '.zf-tabs', '.zf-empty', '.zf-doc', '.zf-law'];
  for (var t = 0; t < sel.length; t++) {
    var ns = document.querySelectorAll(sel[t]);
    if (!ns.length) { continue; }
    var first = ns[0].getBoundingClientRect();
    blocks.push({
      cls: sel[t], count: ns.length,
      w: +first.width.toFixed(1), h: +first.height.toFixed(1)
    });
  }
  out.blocks = blocks;

  // ---- 6. 字体族分组统计 ----
  var fontBag = {};
  for (var fi = 0; fi < all.length; fi++) {
    var fe = all[fi];
    var fr = fe.getBoundingClientRect();
    if (fr.width < 2 || fr.height < 2) { continue; }
    var hasT = false;
    for (var kk = 0; kk < fe.childNodes.length; kk++) {
      if (fe.childNodes[kk].nodeType === 3 && fe.childNodes[kk].textContent.trim()) { hasT = true; break; }
    }
    if (!hasT) { continue; }
    var ff = cs(fe, 'font-family');
    fontBag[ff] = (fontBag[ff] || 0) + 1;
  }
  out.fontBag = fontBag;

  // ---- 7. 页面高度 / 溢出 ----
  out.docH = document.documentElement.scrollHeight;
  out.docW = document.documentElement.scrollWidth;
  out.viewW = window.innerWidth;
  out.viewH = window.innerHeight;
  out.hOverflow = out.docW > window.innerWidth + 1;
  out.hOverflowPx = out.docW - window.innerWidth;

  // 找出真正横向溢出的元素
  if (out.hOverflow) {
    var ovf = [];
    for (var oi = 0; oi < all.length; oi++) {
      var oe = all[oi];
      var orr = oe.getBoundingClientRect();
      if (orr.right > window.innerWidth + 1 && orr.width > 8) {
        ovf.push({
          sel: oe.tagName.toLowerCase() + (oe.className && typeof oe.className === 'string' ? '.' + String(oe.className).trim().split(/\s+/).join('.') : ''),
          right: +orr.right.toFixed(1), w: +orr.width.toFixed(1)
        });
      }
    }
    out.overflowEls = ovf.slice(0, 20);
  }

  // ---- 8. 字号分布 ----
  var fsBag = {};
  for (var zi = 0; zi < all.length; zi++) {
    var ze = all[zi];
    var zr = ze.getBoundingClientRect();
    if (zr.width < 2 || zr.height < 2) { continue; }
    var zt = false;
    for (var zk = 0; zk < ze.childNodes.length; zk++) {
      if (ze.childNodes[zk].nodeType === 3 && ze.childNodes[zk].textContent.trim()) { zt = true; break; }
    }
    if (!zt) { continue; }
    var zfs = cs(ze, 'font-size');
    fsBag[zfs] = (fsBag[zfs] || 0) + 1;
  }
  out.fsBag = fsBag;

  // ---- 9. 间距节奏：常见 margin/padding 值 ----
  var gapBag = {};
  for (var gi = 0; gi < all.length; gi++) {
    var ge = all[gi];
    var gr = ge.getBoundingClientRect();
    if (gr.width < 2 || gr.height < 2) { continue; }
    var gcs = window.getComputedStyle(ge);
    ['margin-top', 'margin-bottom', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right'].forEach(function (prop) {
      var v = gcs.getPropertyValue(prop);
      if (v && v !== '0px' && v !== 'auto' && v.indexOf('normal') < 0) {
        gapBag[prop + ':' + v] = (gapBag[prop + ':' + v] || 0) + 1;
      }
    });
  }
  out.gapBag = gapBag;

  // ---- 10. 圆角 / 阴影使用 ----
  var rBag = {}, shBag = {};
  for (var ri = 0; ri < all.length; ri++) {
    var re = all[ri];
    var rrr = re.getBoundingClientRect();
    if (rrr.width < 2 || rrr.height < 2) { continue; }
    var rcs = window.getComputedStyle(re);
    var rad = rcs.getPropertyValue('border-radius');
    if (rad && rad !== '0px') { rBag[rad] = (rBag[rad] || 0) + 1; }
    var bsh = rcs.getPropertyValue('box-shadow');
    if (bsh && bsh !== 'none') { shBag[bsh] = (shBag[bsh] || 0) + 1; }
  }
  out.radiusBag = rBag;
  out.shadowBag = shBag;

  return out;
};

(async function () {
  var result = {};
  var tabs = [];

  for (var pi = 0; pi < PAGES.length; pi++) {
    var P = PAGES[pi];
    var url = ROOT + '/' + P.f;
    var stub = fs.readFileSync(P.stub, 'utf8');
    result[P.name] = { file: P.f, desc: P.desc, probe: PROBE.toString(), viewports: {} };

    var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
    var conn = await cdp.connect(j.webSocketDebuggerUrl);
    var send = conn.send;
    tabs.push(j.id, conn);

    await send('Page.enable', {});
    await send('Runtime.enable', {});
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

    for (var vi = 0; vi < VIEWPORTS.length; vi++) {
      var V = VIEWPORTS[vi];
      await send('Emulation.setDeviceMetricsOverride', { width: V.w, height: V.h, deviceScaleFactor: 1, mobile: false });
      // 首次先加载页面并注入桩
      var url2 = url + (url.indexOf('?') < 0 ? '?' : '&') + 'vw=' + V.w;
      await send('Page.navigate', { url: url2 });
      await cdp.sleep(500);
      // 断言文档路径正确
      var chk = await send('Runtime.evaluate', { expression: 'document.location.href', returnByValue: true });
      var href = chk.result.result.value;
      if (href.indexOf(P.f.split('/').pop()) < 0) {
        await send('Page.navigate', { url: url2 });
        await cdp.sleep(700);
      }
      await send('Page.addScriptToEvaluateOnNewDocument', { source: stub });
      await send('Page.navigate', { url: url2 });
      await cdp.sleep(1400);

      var ev = await send('Runtime.evaluate', {
        expression: '(' + PROBE.toString() + ')()',
        returnByValue: true, awaitPromise: false
      });
      var val = ev.result && ev.result.result ? ev.result.result.value : null;
      if (val) { result[P.name].viewports[V.tag] = val; }
      else { result[P.name].viewports[V.tag] = { err: 'probe failed' }; }
    }

    conn.socket.destroy();
    process.stdout.write('[' + (pi + 1) + '/' + PAGES.length + '] ' + P.name + ' done\n');
  }

  fs.writeFileSync('ui-audit.json', JSON.stringify(result, null, 1), 'utf8');
  process.stdout.write('\n=== WROTE workspace/ui-audit.json ===\n');

  // 摘要
  for (var k in result) {
    var R = result[k];
    var d = R.viewports.desktop;
    if (!d || d.err) { process.stdout.write(k + ': PROBE FAIL\n'); continue; }
    process.stdout.write(k + '\t' + R.desc + '\n');
    process.stdout.write('  text=' + d.textTotal + '  contrastFail=' + d.contrastFailCount +
      '  smallTarget=' + d.smallTargetCount + '  docH=' + d.docH + '  hOverflow=' + d.hOverflow +
      (d.hOverflow ? '(+' + d.hOverflowPx + 'px)' : '') + '\n');
  }
})();
