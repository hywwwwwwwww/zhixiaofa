/* ============================================================================
   diag-stack-hit.js —— 直接测「完整字体栈」命中哪一项（不再做近似推断）

   之前的 verify-doc-sheet.js 用「同字号逐个候选字体比宽度，取最接近的」反推命中，
   这在两个字体宽度接近时会误判（实测把 Cambria 报成命中，但 Cambria@14px=77.52，
   而实测换算回来是 79.49，两个都不对）。

   本脚本换成「直接对比法」，零推断：
     1. 把待验证的完整字体栈，原样喂给 canvas 和 DOM，得到宽度 W_stack
     2. 再把栈里每一个候选字体「单独 + 兜底假名」喂进去，得到 W_font_i
     3. W_stack 与哪个 W_font_i 精确相等（< 0.01px），栈的第一项命中就是它
     4. 如果一个都不精确相等，说明命中了栈外的系统兜底字体

   同时测三组样本（数字 / 拉丁 / 中文），因为同一个栈可能「数字命中 A、中文命中 B」
   （中西文分别回退），这正是 system font stack 的工作方式。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 三条真实栈，与 app.css 里的 --zf-font-* 保持一致 */
var STACKS = {
  sans: '"Segoe UI", -apple-system, BlinkMacSystemFont, "Microsoft YaHei UI", "Microsoft YaHei", "PingFang SC", Roboto, Arial, sans-serif',
  serif: 'Georgia, Cambria, "Times New Roman", "Source Han Serif SC", "SimSun", "Microsoft YaHei", serif',
  mono: 'Consolas, "Cascadia Mono", "Courier New", monospace'
};
/* 每条栈里「本机可能存在」的候选项（不含 -apple-system 这种必然死项） */
var CANDS = {
  sans: ['Segoe UI', 'Microsoft YaHei UI', 'Microsoft YaHei', 'Roboto', 'Arial'],
  serif: ['Georgia', 'Cambria', 'Times New Roman', 'Source Han Serif SC', 'SimSun', 'Microsoft YaHei'],
  mono: ['Consolas', 'Cascadia Mono', 'Courier New']
};
var SAMPLES = [['digits', '0123456789'], ['latin', 'AI Contract'], ['cn', '审查合同']];
var SIZES = [13.5, 14, 14.5, 26];

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
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 500) }; }
    return r.result.result.value;
  }

  var raw = await ev([
    "(function(){",
    "  var STACKS = " + JSON.stringify(STACKS) + ";",
    "  var CANDS  = " + JSON.stringify(CANDS) + ";",
    "  var SAMPLES= " + JSON.stringify(SAMPLES) + ";",
    "  var SIZES  = " + JSON.stringify(SIZES) + ";",
    "  var FAKE = '__ZF_NoSuchFont_1__';",
    "  var host = document.createElement('div');",
    "  host.style.cssText='position:absolute;left:-99999px;top:0;';",
    "  document.body.appendChild(host);",
    "  /* 用 DOM 量（不是 Canvas）：直接把 font-family 设成待测栈，量 span 宽度。",
    "     这是最贴近真实渲染的口径。 */",
    "  function domW(ff, text, px, wt){",
    "    var s = document.createElement('span');",
    "    s.style.cssText = 'position:absolute;white-space:pre;';",
    "    s.style.fontFamily = ff;",
    "    s.style.fontSize = px + 'px';",
    "    s.style.fontWeight = wt || 400;",
    "    s.textContent = text;",
    "    host.appendChild(s);",
    "    var w = s.getBoundingClientRect().width;",
    "    host.removeChild(s);",
    "    return Math.round(w * 1000) / 1000;",
    "  }",
    "  var out = { stacks: {} };",
    "  Object.keys(STACKS).forEach(function(sk){",
    "    out.stacks[sk] = { ff: STACKS[sk], cases: {} };",
    "    SIZES.forEach(function(px){",
    "      Object.keys(CANDS).forEach(function(){ });",
    "      var perSize = {};",
    "      SAMPLES.forEach(function(sm){",
    "        // 1) 完整栈的宽度",
    "        var wStack = domW(STACKS[sk], sm[1], px, 400);",
    "        // 2) 每个候选单独（后面挂假名兜底，避免不存在时用默认字体污染）",
    "        var wEach = {};",
    "        (CANDS[sk] || []).forEach(function(f){ wEach[f] = domW('\"' + f + '\", \"' + FAKE + '\"', sm[1], px, 400); });",
    "        // 3) 找精确相等的（容差 0.02px）",
    "        var hit = null, hitW = null;",
    "        Object.keys(wEach).forEach(function(f){",
    "          if (hit === null && Math.abs(wEach[f] - wStack) < 0.02) { hit = f; hitW = wEach[f]; }",
    "        });",
    "        perSize[sm[0]] = { stack: wStack, each: wEach, hit: hit, hitW: hitW };",
    "      });",
    "      out.stacks[sk].cases[px] = perSize;",
    "    });",
    "  });",
    "  host.parentNode.removeChild(host);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n'));

  if (raw && raw.__err) { console.log('ERR ' + raw.__err); process.exit(1); }
  var d = JSON.parse(raw);

  Object.keys(d.stacks).forEach(function (sk) {
    console.log('\n============================ 栈 [' + sk + '] ============================');
    console.log('  ' + d.stacks[sk].ff.slice(0, 120));
    SIZES.forEach(function (px) {
      console.log('\n  --- ' + px + 'px ---');
      SAMPLES.forEach(function (sm) {
        var c = d.stacks[sk].cases[px][sm[0]];
        var cands = Object.keys(c.each).map(function (f) {
          return f + '=' + c.each[f];
        }).join('  ');
        console.log('    [' + pad(sm[0], 7) + '] 栈=' + pad(c.stack, 9) +
          (c.hit ? ('  ✓ 命中 ' + c.hit) : '  ✗ 无精确匹配'));
        console.log('             候选: ' + cands);
      });
    });
  });

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
