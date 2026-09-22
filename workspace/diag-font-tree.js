/* ============================================================================
   diag-font-tree.js —— 结构树字体普查（替代逐个选择器硬编码）

   上一版 diag-font-matrix.js 用硬编码选择器清单，结果 .zf-doc--sheet / .zf-law
   等元素大量 missing —— 因为它们依赖接口数据，桩数据里没有内容时是空态。

   本脚本换成两条腿：
     A. 抓「所有出现的 (fontSize, fontWeight, fontFamily, fvn) 四元组去重」
        —— 不猜选择器，直接扫全文档，凡是有直接文字子节点的可见节点都收进来。
     B. 对关键容器深挖，并把「动态填充文字」的节点也算进来（收所有后代，
        只要它自身可见 + 有非空 textContent）。
     C. 额外做一次「字体注入 A/B」：给 body 打临时内联样式，模拟换成
        宋体/等宽等方案后，量关键元素的宽度变化 —— 这是评判"会不会撑破"
        的最直接证据，不需要真改文件。

   运行：python workspace/runnode.py diag-font-tree.js doc-drafting.html
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var pageFile = process.argv[2] || 'doc-drafting.html';

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + pageFile });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 500) }; }
    return r.result.result.value;
  }

  /* A. 全文档四元组去重（收「自身可见且有非空文字」的节点） */
  var exprA = [
    "(function(){",
    "  var m = {};",
    "  var all = document.querySelectorAll('body *');",
    "  function pathOf(el){",
    "    var parts = [], cur = el, n = 0;",
    "    while (cur && cur.nodeType === 1 && n < 4) {",
    "      var s = cur.tagName.toLowerCase();",
    "      if (cur.className && typeof cur.className === 'string') {",
    "        s += '.' + cur.className.trim().split(/\\s+/).slice(0,3).join('.');",
    "      }",
    "      parts.unshift(s); cur = cur.parentElement; n++;",
    "    }",
    "    return parts.join(' > ');",
    "  }",
    "  for (var i=0;i<all.length;i++){",
    "    var el = all[i];",
    "    var txt = (el.textContent || '').trim();",
    "    if (!txt) continue;",
    "    if (el.querySelector('*')) continue;",
    "    var rr = el.getBoundingClientRect();",
    "    if (rr.width < 1 || rr.height < 1) continue;",
    "    var cs = getComputedStyle(el);",
    "    if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;",
    "    var key = cs.fontSize + '|' + cs.fontWeight + '|' + cs.fontVariantNumeric + '|' + cs.fontFamily;",
    "    if (!m[key]) { m[key] = { px: parseFloat(cs.fontSize), wt: cs.fontWeight, fvn: cs.fontVariantNumeric, ff: cs.fontFamily, lh: cs.lineHeight, ls: cs.letterSpacing, count: 0, samples: [], texts: [] }; }",
    "    m[key].count++;",
    "    if (m[key].samples.length < 3) m[key].samples.push(pathOf(el));",
    "    if (m[key].texts.length < 6) m[key].texts.push(txt.slice(0, 20));",
    "  }",
    "  var arr = [];",
    "  for (var k in m) { if (m.hasOwnProperty(k)) arr.push(m[k]); }",
    "  arr.sort(function(a,b){ return b.px - a.px; });",
    "  return JSON.stringify({ href: location.pathname, groups: arr, totalTextNodes: all.length });",
    "})()"
  ].join('\n');

  var rawA = await ev(exprA);
  if (rawA && rawA.__err) { console.log('ERR-A ' + rawA.__err); process.exit(1); }
  var A = JSON.parse(rawA);
  /* 【记忆 #22】必须自查文档路径：并发跑两个实例时曾读到上一轮的页面，
     6 条断言集体误报。命中即直接失败，不要拿脏数据下结论。 */
  if (A.href.indexOf(pageFile) < 0) {
    console.log('!!! 页面未命中：期望 ' + pageFile + '，实际 ' + A.href);
    console.log('    多为导航未完成就取数。重跑一次；仍失败则加大 sleep。');
    process.exit(2);
  }
  console.log('=== ' + pageFile + ' —— 全文档字体四元组（按字号降序） ===');
  console.log('doc=' + A.href + '  扫过节点=' + A.totalTextNodes + '  去重组数=' + A.groups.length + '\n');
  A.groups.forEach(function (g, idx) {
    var fam = g.ff.split(',')[0].trim();
    console.log('[' + idx + '] ' + pad(g.px + 'px', 9) + pad('/' + g.wt, 6) + pad('lh=' + g.lh, 11) +
      pad('ls=' + g.ls, 10) + pad('n=' + g.count, 7) + pad('fvn=' + g.fvn, 15) + fam);
    console.log('      文字: ' + g.texts.join(' / '));
    g.samples.forEach(function (s) { console.log('      @ ' + s); });
  });

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
