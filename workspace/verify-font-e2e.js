/* ============================================================================
   verify-font-e2e.js —— 字体改造「真实页面 + 真实桩数据」端到端回归

   与之前两个脚本的区别（这是本轮唯一的补强点）：
     - verify-fonts.js  测的是空态页面：.zf-doc--sheet / .zf-doc--prose 根本不存在
     - verify-doc-sheet.js 是「注入节点」验证：证明 CSS 规则本身对，但不是真实路径
     - 本脚本让页面自己走完渲染逻辑，再量真实产物

   覆盖三条真实路径：
     R1  doc-drafting.html 结果区 → showDoc() 注入 .zf-doc--sheet（文书起草）
     R2  knowledge.html 文章弹窗 → zf-doc--plain zf-doc--prose（文章正文）
     R3  home.html 文章弹窗     → zf-doc--plain zf-doc--prose（同一渲染器，验证两页一致）

   断言口径：
     - 元素必须真实存在（否则说明渲染路径没跑通）
     - 同字号对照判字体（不用跨字号绝对阈值）
     - 中文全角 = px*4 + letterSpacing*4
     - 780px 窄视口下不出横向溢出
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }

var SERIF_SET = ['Georgia', 'Cambria', 'Times New Roman', 'Source Han Serif SC', 'SimSun'];
var SANS_SET = ['Segoe UI', 'Microsoft YaHei', 'Arial', 'Roboto'];
var fails = [];
var pass = 0;

function ok(cond, msg) { if (cond) { pass++; } else { fails.push(msg); } return cond; }
function hitText(o) { return o.hits && o.hits.length ? o.hits.join(' + ') : '未识别'; }
function isSerifHit(o) {
  if (!o.hits) { return false; }
  for (var i = 0; i < o.hits.length; i++) {
    if (SERIF_SET.indexOf(o.hits[i]) >= 0) { return true; }
  }
  return false;
}

/* ---------------------------------------------------------------------------
   页内公共探针：判字体命中 + 量中文宽度 + 查溢出

   【重要】口径必须是「纯 DOM」，不能用 canvas。
   实测：canvas 的 g.font 喂完整 font-family 栈量 10 位数字 = 55.5px，
   而同一元素同一字号的 DOM 实测 = 79.44px —— 差 24px。
   ⇒ canvas 不会像 DOM 那样解析完整 font-family 栈，两者口径不可混用。
   之前用「canvas 逐项 vs DOM 实测」得出的 best（曾误报 Roboto）就是这样来的假象。

   正确做法：量尺也是 DOM span，候选字体写成 `"候选", "假字体"`，
   与「真实元素的栈」在同一口径下比对，精确等宽（<0.01）且不等于
   假字体兜底宽度者，才是真命中。
   --------------------------------------------------------------------------- */
var HELPERS = [
  "function __ruler(el){",
  "  var FAKE = '__ZF_NoSuchFont_9__';",
  "  var cs = getComputedStyle(el);",
  "  var px = parseFloat(cs.fontSize), wt = cs.fontWeight;",
  "  /* 量尺：脱离文档流、强制 letter-spacing:normal，消除字距污染 */",
  "  var R = document.createElement('span');",
  "  R.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;letter-spacing:normal;';",
  "  R.style.fontSize = cs.fontSize; R.style.fontWeight = cs.fontWeight;",
  "  document.body.appendChild(R);",
  "  function domW(spec, txt){ R.style.fontFamily = spec; R.textContent = txt;",
  "    return Math.round(R.getBoundingClientRect().width*1000)/1000; }",
  "  var o = { ff: cs.fontFamily, px: px, wt: wt, ls: cs.letterSpacing, lh: cs.lineHeight };",
  "  /* 真实栈的宽度（同口径：normal 字距） */",
  "  o.stackDOM = domW(cs.fontFamily, '0123456789');",
  "  o.stackCN  = domW(cs.fontFamily, '审查合同仲裁');",
  "  o.fakeW    = domW('\"' + FAKE + '\"', '0123456789');",
  "  var cands = ['Georgia','Cambria','Times New Roman','Source Han Serif SC','SimSun',",
  "               'NSimSun','STSong','Microsoft YaHei','Segoe UI','Arial','Tahoma','Consolas'];",
  "  o.solo = {}; o.hits = []; o.near = [];",
  "  for (var i=0;i<cands.length;i++){",
  "    o.solo[cands[i]] = domW('\"' + cands[i] + '\", \"' + FAKE + '\"', '0123456789');",
  "  }",
  "  Object.keys(o.solo).forEach(function(f){",
  "    var v = o.solo[f], d = v - o.stackDOM;",
  "    if (Math.abs(d) < 0.01 && Math.abs(v - o.fakeW) >= 0.01) { o.hits.push(f); }",
  "    else { o.near.push(f + '=' + v + '(Δ' + d.toFixed(2) + ')'); }",
  "  });",
  "  /* near 按 |Δ| 升序 */",
  "  function absD(s){ var m = s.match(/Δ(-?[\\d.]+)/); return m ? Math.abs(parseFloat(m[1])) : 999; }",
  "  o.near.sort(function(a,b){ return absD(a) - absD(b); });",
  "  o.near = o.near.slice(0,4);",
  "  /* 页面自身几何 */",
  "  var r = el.getBoundingClientRect();",
  "  o.w = Math.round(r.width*100)/100;",
  "  o.docW = document.documentElement.scrollWidth;",
  "  o.vw = window.innerWidth;",
  "  /* 中文全角恒 1em；若元素带字距须计入（首字前不加，故 6 倍） */",
  "  var lsPx = (cs.letterSpacing && cs.letterSpacing !== 'normal') ? parseFloat(cs.letterSpacing) : 0;",
  "  if (isNaN(lsPx)) { lsPx = 0; }",
  "  o.cnExpect = Math.round((px*6 + lsPx*6)*1000)/1000;",
  "  o.cnErr = Math.round(Math.abs(domW(cs.fontFamily,'审查合同仲裁') + lsPx*6 - o.cnExpect)*1000)/1000;",
  "  document.body.removeChild(R);",
  "  return o;",
  "}",
  "function __hitText(o){ return o.hits.length ? o.hits.join(' ') : (o.bestFallback || '未知'); }",
  "function __pageCheck(name){",
  "  return (location.pathname.indexOf(name) < 0)",
  "    ? 'PAGE_MISMATCH:' + location.pathname : 'OK:' + location.pathname;",
  "}"
].join('\n');

/* ---------------------------------------------------------------------------
   R1：doc-drafting —— 真实走「选模板 → 生成文书」两步，产出 .zf-doc--sheet
   （showDoc 是私有的，唯一入口就是 #doc-generate 的 click handler，
     所以必须真的走完整交互，不能直接调函数）
   --------------------------------------------------------------------------- */
var R1_STEP1 = [
  "(function(){",
  HELPERS,
  "  var pg = __pageCheck('doc-drafting.html');",
  "  if (pg.indexOf('OK:') !== 0) { return JSON.stringify({ fail: pg }); }",
  "  var out = { page: pg };",
  "  var cards = document.querySelectorAll('#template-grid .zf-tpl');",
  "  out.cardCount = cards.length;",
  "  if (!cards.length) { out.fail = 'NO_TEMPLATE_CARD'; return JSON.stringify(out); }",
  "  out.firstTpl = cards[0].querySelector('.zf-tpl__name').textContent;",
  "  cards[0].click();",
  "  return JSON.stringify(out);",
  "})()"
].join('\n');

/* 选完模板后表单会渲染出带 data-ph 的输入项；全部填满再点生成 */
var R1_STEP2 = [
  "(function(){",
  "  var out = {};",
  "  if (location.pathname.indexOf('doc-drafting.html') < 0) {",
  "    return JSON.stringify({ fail: 'PAGE_MISMATCH:' + location.pathname });",
  "  }",
  "  var fields = document.querySelectorAll('#doc-fill-form [data-ph]');",
  "  out.fieldCount = fields.length;",
  "  if (!fields.length) { out.fail = 'NO_FORM_FIELDS'; return JSON.stringify(out); }",
  "  out.phs = [];",
  "  for (var i = 0; i < fields.length; i++) {",
  "    var f = fields[i], ph = f.getAttribute('data-ph');",
  "    out.phs.push(ph);",
  "    /* 按字段语义填合法值：金额必须纯数字（正则 /^\\d+(\\.\\d{1,2})?$/），",
  "       身份证 18 位、手机 11 位，否则 ZF.validate 会拦下不生成。 */",
  "    var v;",
  "    if (ph.indexOf('金额') >= 0) { v = '128000.00'; }",
  "    else if (ph.indexOf('身份证') >= 0) { v = '370102199503121234'; }",
  "    else if (ph.indexOf('电话') >= 0 || ph.indexOf('手机') >= 0) { v = '13800000001'; }",
  "    else if (ph.indexOf('日期') >= 0) { v = '2026-09-21'; }",
  "    else if (ph.indexOf('时间') >= 0) { v = '2026年8月'; }",
  "    else if (ph.indexOf('事项') >= 0 || ph.indexOf('理由') >= 0) {",
  "      v = '请求裁决被申请人支付解除劳动合同经济补偿金。';",
  "    }",
  "    else { v = '张三'; }",
  "    if (f.tagName === 'SELECT') {",
  "      if (f.options.length > 1) { f.selectedIndex = 1; }",
  "    } else { f.value = v; }",
  "    /* 事件也要补，避免框架的 input 监听没收到 */",
  "    try {",
  "      f.dispatchEvent(new Event('input', { bubbles: true }));",
  "      f.dispatchEvent(new Event('change', { bubbles: true }));",
  "    } catch (e) {}",
  "  }",
  "  var btn = document.getElementById('doc-generate');",
  "  out.btnDisabled = btn ? btn.disabled : null;",
  "  if (btn) { btn.click(); }",
  "  return JSON.stringify(out);",
  "})()"
].join('\n');

var R1_STEP3 = [
  "(function(){",
  HELPERS,
  "  if (location.pathname.indexOf('doc-drafting.html') < 0) {",
  "    return JSON.stringify({ fail: 'PAGE_MISMATCH:' + location.pathname });",
  "  }",
  "  var sheet = document.querySelector('.zf-doc--sheet');",
  "  if (!sheet) { return JSON.stringify({ fail: 'NO_SHEET_RENDERED' }); }",
  "  var o = __ruler(sheet);",
  "  o.sheetClass = sheet.className;",
  "  o.titleText = sheet.querySelector('.zf-doc__title') ?",
  "    sheet.querySelector('.zf-doc__title').textContent.slice(0, 30) : null;",
  "  o.resultBodyLen = document.getElementById('result-body').innerHTML.length;",
  "  var signs = document.querySelectorAll('.zf-doc__sign');",
  "  o.nSigns = signs.length;",
  "  if (signs.length) {",
  "    var s0 = signs[0];",
  "    o.signText = s0.textContent.replace(/\\s+/g, ' ').slice(0, 40);",
  "    o.signAlign = getComputedStyle(s0).textAlign;",
  "    o.signPadR = getComputedStyle(s0).paddingRight;",
  "    var sr = s0.getBoundingClientRect(), pr = sheet.getBoundingClientRect();",
  "    o.signRightGap = Math.round((pr.right - sr.right) * 100) / 100;",
  "  }",
  "  return JSON.stringify(o);",
  "})()"
].join('\n');


/* ---------------------------------------------------------------------------
   R2/R3：文章弹窗 —— 两页入口不同，故拆成两套探针
     knowledge.html：文章是 .zf-art[data-id] 卡片（role=button）
     home.html     ：文章是真 <a href="#article-N">
   两者都会在 #article-modal-body 里产出 .zf-doc--plain.zf-doc--prose
   --------------------------------------------------------------------------- */
var ART_KN_PROBE = [
  "(function(){",
  "  if (location.pathname.indexOf('knowledge.html') < 0) {",
  "    return JSON.stringify({ fail: 'PAGE_MISMATCH:' + location.pathname });",
  "  }",
  "  var out = { page: 'knowledge.html' };",
  "  var cards = document.querySelectorAll('#article-list .zf-art');",
  "  out.cardCount = cards.length;",
  "  if (!cards.length) { out.fail = 'NO_ART_CARD'; return JSON.stringify(out); }",
  "  out.cardId = cards[0].getAttribute('data-id');",
  "  out.cardTitle = cards[0].querySelector('.zf-art__title').textContent;",
  "  cards[0].click();",
  "  return JSON.stringify(out);",
  "})()"
].join('\n');

var ART_HOME_PROBE = [
  "(function(){",
  "  if (location.pathname.indexOf('home.html') < 0) {",
  "    return JSON.stringify({ fail: 'PAGE_MISMATCH:' + location.pathname });",
  "  }",
  "  var out = { page: 'home.html' };",
  "  var link = document.querySelector('a[href^=\"#article-\"]');",
  "  out.linkCount = document.querySelectorAll('a[href^=\"#article-\"]').length;",
  "  if (!link) { out.fail = 'NO_ARTICLE_LINK'; return JSON.stringify(out); }",
  "  out.linkHref = link.getAttribute('href');",
  "  out.linkText = (link.textContent || '').replace(/\\s+/g, ' ').slice(0, 30);",
  "  link.click();",
  "  return JSON.stringify(out);",
  "})()"
].join('\n');

var ART_BODY_PROBE = [
  "(function(){",
  HELPERS,
  "  var body = document.getElementById('article-modal-body');",
  "  if (!body) { return JSON.stringify({ fail: 'NO_MODAL_BODY' }); }",
  "  var inner = body.querySelector('.zf-doc--prose') || body.querySelector('.zf-doc');",
  "  if (!inner) { return JSON.stringify({ fail: 'NO_DOC_IN_MODAL', bodyLen: body.innerHTML.length }); }",
  "  var o = __ruler(inner);",
  "  o.bodyClass = inner.className;",
  "  o.textLen = (inner.textContent || '').length;",
  "  o.hasProse = inner.className.indexOf('zf-doc--prose') >= 0;",
  "  o.hasPlain = inner.className.indexOf('zf-doc--plain') >= 0;",
  "  o.modalShown = !!document.querySelector('.modal.show, .modal-backdrop');",
  "  o.modalTitle = (document.getElementById('article-modal-title') || {}).textContent || null;",
  "  return JSON.stringify(o);",
  "})()"
].join('\n');

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
  }
  if (!target) { console.log('no target'); process.exit(1); }
  console.log('target = ' + target.url.slice(-40));

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });

  /* 把任意返回值安全地变成字符串（JSON.stringify(undefined) 会返回 undefined，
     直接 .slice 会抛 TypeError —— 本轮已踩过） */
  function safeStr(v, n) {
    var s;
    try { s = (typeof v === 'string') ? v : JSON.stringify(v); } catch (e) { s = String(v); }
    if (s === undefined || s === null) { s = String(v); }
    return s.slice(0, n || 300);
  }
  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: safeStr(r.exceptionDetails, 500) }; }
    return r.result.result.value;
  }
  async function nav(url, ms) {
    await send('Page.navigate', { url: url });
    await sleep(ms || 1900);
  }

  /* ===================== R1 文书起草 ===================== */
  console.log('\n################ R1  doc-drafting.html  .zf-doc--sheet  ################');
  await nav(BASE + 'doc-drafting.html', 2200);
  var r1a = await ev(R1_STEP1);
  var A1 = (r1a && !r1a.__err && typeof r1a === 'string') ? JSON.parse(r1a) : { fail: 'probe_err:' + safeStr(r1a, 200) };
  console.log('  [1/3 选模板] 页面=' + A1.page + '  模板卡数=' + A1.cardCount + '  首张="' + A1.firstTpl + '"');
  if (A1.fail) {
    console.log('  ⚠ ' + A1.fail);
    fails.push('R1 步骤1: ' + A1.fail);
  } else {
    await sleep(700);
    var r1b = await ev(R1_STEP2);
    var A2 = (r1b && !r1b.__err && typeof r1b === 'string') ? JSON.parse(r1b) : { fail: 'probe_err:' + safeStr(r1b, 200) };
    console.log('  [2/3 填表单] 字段数=' + A2.fieldCount + '  "' + (A2.phs || []).join(' / ') + '"');
    if (A2.fail) { console.log('  ⚠ ' + A2.fail); fails.push('R1 步骤2: ' + A2.fail); }
    else {
      await sleep(1500);
      var r1c = await ev(R1_STEP3);
      var R1 = (r1c && !r1c.__err && typeof r1c === 'string') ? JSON.parse(r1c) : { fail: 'probe_err:' + safeStr(r1c, 200) };
      if (R1.fail) {
        console.log('  ⚠ ' + R1.fail);
        fails.push('R1 步骤3: ' + R1.fail);
      } else {
        console.log('  [3/3 生成] result-body=' + R1.resultBodyLen + ' 字符');
        console.log('    元素类名  : ' + R1.sheetClass);
        console.log('    标题元素  : ' + R1.titleText);
        console.log('    字族      : ' + R1.ff);
        console.log('    字号/行高 : ' + R1.px + 'px / ' + R1.lh + '   字距=' + R1.ls);
        console.log('    栈实测/DOM: 10位=' + R1.stackDOM + '  假字体兜底=' + R1.fakeW);
        console.log('    中文6字   : ' + R1.stackCN + ' (全角理论 ' + R1.cnExpect + ', 偏差 ' + R1.cnErr + ')');
        console.log('    → 精确命中: ' + hitText(R1) + (isSerifHit(R1) ? '  [衬线]' : '  [无衬线]'));
        console.log('      次接近  : ' + R1.near.join('  '));
        console.log('    落款行    : ' + R1.nSigns + ' 个, text-align=' + R1.signAlign +
          ', padding-right=' + R1.signPadR + ', 右缩进实测=' + R1.signRightGap + 'px');
        console.log('    落款内容  : "' + R1.signText + '"');
        console.log('    文档宽/视口: ' + R1.docW + ' / ' + R1.vw);

        ok(isSerifHit(R1), 'R1 .zf-doc--sheet 未命中衬线: ' + hitText(R1));
        ok(Math.abs(R1.px - 14.5) < 0.01, 'R1 字号应 14.5px, 实测 ' + R1.px);
        ok(R1.cnErr <= 0.8, 'R1 中文宽度偏差 ' + R1.cnErr + 'px');
        ok(R1.docW <= R1.vw + 1, 'R1 横向溢出 docW=' + R1.docW);
        ok(R1.nSigns >= 1, 'R1 未识别出落款行（renderDocHtml 的落款正则应命中）');
        if (R1.nSigns >= 1) { ok(R1.signAlign === 'right', 'R1 落款 text-align=' + R1.signAlign); }
        console.log('    ' + (isSerifHit(R1) ? '✓' : '✗') + ' 纸面态真实命中衬线：' + hitText(R1));
      }
    }
  }

  /* ===================== R2 knowledge 文章弹窗 ===================== */
  console.log('\n################ R2  knowledge.html  文章弹窗 .zf-doc--prose  ################');
  await nav(BASE + 'knowledge.html', 2100);
  var r2a = await ev(ART_KN_PROBE);
  var B1 = (r2a && !r2a.__err && typeof r2a === 'string') ? JSON.parse(r2a) : { fail: 'probe_err:' + safeStr(r2a, 200) };
  console.log('  文章卡片数=' + B1.cardCount + '  首张 id=' + B1.cardId + '  "' + B1.cardTitle + '"');
  if (B1.fail) { console.log('  ⚠ ' + B1.fail); fails.push('R2 打开: ' + B1.fail); }
  await sleep(1100);
  var r2b = await ev(ART_BODY_PROBE);
  var R2 = (r2b && !r2b.__err && typeof r2b === 'string') ? JSON.parse(r2b) : { fail: 'probe_err:' + safeStr(r2b, 200) };
  if (R2.fail) { console.log('  ⚠ ' + R2.fail + (R2.bodyLen ? '  bodyLen=' + R2.bodyLen : '')); fails.push('R2: ' + R2.fail); }
  else {
    console.log('  弹窗标题  : ' + R2.modalTitle + '  已显示=' + R2.modalShown);
    console.log('  正文类名  : ' + R2.bodyClass + '   长度=' + R2.textLen + ' 字符');
    console.log('  字族      : ' + R2.ff);
    console.log('  字号/行高 : ' + R2.px + 'px / ' + R2.lh + '   字距=' + R2.ls);
    console.log('  栈实测/DOM: 10位=' + R2.stackDOM + '  假字体兜底=' + R2.fakeW);
    console.log('  中文6字   : ' + R2.stackCN + ' (全角理论 ' + R2.cnExpect + ', 偏差 ' + R2.cnErr + ')');
    console.log('  → 精确命中: ' + hitText(R2) + (isSerifHit(R2) ? '  [衬线]' : '  [无衬线]'));
    console.log('    次接近  : ' + R2.near.join('  '));
    ok(R2.hasProse, 'R2 弹窗正文缺 zf-doc--prose');
    ok(R2.hasPlain, 'R2 弹窗正文缺 zf-doc--plain');
    ok(isSerifHit(R2), 'R2 未命中衬线: ' + hitText(R2));
    ok(Math.abs(R2.px - 14.5) < 0.01, 'R2 字号应 14.5px, 实测 ' + R2.px);
    ok(R2.cnErr <= 0.8, 'R2 中文宽度偏差 ' + R2.cnErr + 'px');
    ok(R2.docW <= R2.vw + 1, 'R2 横向溢出 docW=' + R2.docW);
    console.log('  ' + (R2.hasProse && isSerifHit(R2) ? '✓' : '✗') +
      ' 知识库弹窗命中衬线：' + hitText(R2));
  }

  /* ===================== R3 home 文章弹窗 ===================== */
  console.log('\n################ R3  home.html  文章弹窗（同一渲染器，验证两页一致）################');
  await nav(BASE + 'home.html', 2500);
  var r3a = await ev(ART_HOME_PROBE);
  var C1 = (r3a && !r3a.__err && typeof r3a === 'string') ? JSON.parse(r3a) : { fail: 'probe_err:' + safeStr(r3a, 200) };
  console.log('  文章链接数=' + C1.linkCount + '  href=' + C1.linkHref + '  "' + C1.linkText + '"');
  if (C1.fail) { console.log('  ⚠ ' + C1.fail); fails.push('R3 打开: ' + C1.fail); }
  await sleep(1100);
  var r3b = await ev(ART_BODY_PROBE);
  var R3 = (r3b && !r3b.__err && typeof r3b === 'string') ? JSON.parse(r3b) : { fail: 'probe_err:' + safeStr(r3b, 200) };
  if (R3.fail) { console.log('  ⚠ ' + R3.fail); fails.push('R3: ' + R3.fail); }
  else {
    console.log('  正文类名  : ' + R3.bodyClass + '   长度=' + R3.textLen + ' 字符');
    console.log('  字号/行高 : ' + R3.px + 'px / ' + R3.lh + '   字距=' + R3.ls);
    console.log('  → 精确命中: ' + hitText(R3) + '   次接近: ' + R3.near.join('  '));
    ok(R3.hasProse, 'R3 首页弹窗缺 zf-doc--prose');
    ok(isSerifHit(R3), 'R3 未命中衬线: ' + hitText(R3));
    ok(Math.abs(R3.px - 14.5) < 0.01, 'R3 字号应 14.5px, 实测 ' + R3.px);
    /* 一致性：两页同一渲染器必须得出同一字体 */
    var h3 = hitText(R3), h2 = hitText(R2);
    if (h3 && h3 === h2) {
      pass++; console.log('  ✓ 首页与知识库弹窗字体一致：' + h3);
    } else {
      fails.push('两页弹窗字体不一致: home=' + h3 + ' knowledge=' + h2);
      console.log('  ✗ 两页不一致：home=' + h3 + ' knowledge=' + h2);
    }
  }

  /* ===================== R4 窄视口溢出（三条真实路径） ===================== */
  console.log('\n################ R4  窄视口 780px 横向溢出复查  ################');
  await send('Emulation.setDeviceMetricsOverride', { width: 780, height: 900, deviceScaleFactor: 1, mobile: false });
  var OVERFLOW_PROBE = [
    "(function(){",
    HELPERS,
    "  var pg = location.pathname;",
    "  var el = document.querySelector('.zf-doc--sheet, .zf-content, .zf-wrap, body');",
    "  return JSON.stringify({ page: pg, docW: document.documentElement.scrollWidth,",
    "    bodyScroll: document.body.scrollWidth, vw: window.innerWidth,",
    "    hasSheet: !!document.querySelector('.zf-doc--sheet'),",
    "    hasProse: !!document.querySelector('.zf-doc--prose') });",
    "})()"
  ].join('\n');
  var pages = ['doc-drafting.html', 'knowledge.html', 'home.html', 'court.html', 'qa.html', 'profile.html'];
  for (var pi = 0; pi < pages.length; pi++) {
    await nav(BASE + pages[pi], 1800);
    var ro = await ev(OVERFLOW_PROBE);
    if (ro && !ro.__err && typeof ro === 'string') {
      var od = JSON.parse(ro);
      var hasOver = od.docW > od.vw + 1;
      console.log('  ' + pad(pages[pi], 22) + ' docW=' + pad(od.docW, 6) + ' vw=' + pad(od.vw, 6) +
        (hasOver ? ' ✗ 溢出' : ' ✓'));
      ok(!hasOver, pages[pi] + ' @780 横向溢出 docW=' + od.docW);
    } else { console.log('  ' + pad(pages[pi], 22) + ' ERR'); }
  }

  /* ===================== 收尾 ===================== */
  await send('Emulation.clearDeviceMetricsOverride');
  console.log('\n=================== 总结 ===================');
  console.log('  断言通过: ' + pass);
  console.log('  断言失败: ' + fails.length);
  if (fails.length) { console.log(fails.map(function (f) { return '   - ' + f; }).join('\n')); }
  console.log('\n  ' + (fails.length ? '✗ 存在失败项' : '✓ 端到端回归全部通过'));
  process.exit(fails.length ? 1 : 0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });
