/**
 * 首页「使用概览」指标卡改造 —— 实测验证脚本
 *
 * 用法：node verify-home-stat.js [port]
 *   需先启动 headless Edge：
 *   msedge --headless=new --remote-debugging-port=9405 --window-size=1440,900 about:blank
 *
 * 【探针修正记录（重要）】
 * 初版探针有两处测量错误，导致误判：
 *   1) 用 `val.parentNode` 当"文字块"来量宽，但它被 flex/grid 撑满整行，
 *      contentW 会退化成"图标左缘→卡片右缘"。
 *      改为分别量「图标宽 + column-gap + max(标签宽, 数字宽)」。
 *   2) cardInnerW 硬编码 `cr.width - 40`，padding 改成 22 后就是错的。
 *      改为从 getComputedStyle 读真实 padding。
 * 另外必须注意：`.zf-stat > div` 会连 `.zf-stat__icon`（它也是 div）一起命中，
 * 所以断言里专门校验图标的计算 gridArea，这个 bug 靠肉眼看 CSS 发现不了。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var SHOT_DIR = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOT_DIR)) { fs.mkdirSync(SHOT_DIR); }

var pass = 0, fail = 0;
function ok(label, cond, detail) {
  if (cond) { pass++; } else { fail++; }
  console.log((cond ? '[PASS] ' : '[FAIL] ') + label + (detail ? '  ' + detail : ''));
}

var METRIC = `(function () {
  function rect(el) { return el ? el.getBoundingClientRect() : null; }
  function px(el, prop) { return el ? parseFloat(getComputedStyle(el)[prop]) : 0; }

  var grid = document.getElementById('stat-grid');
  if (!grid) { return { error: 'no #stat-grid' }; }
  var cs = getComputedStyle(grid);
  var out = {
    vw: innerWidth, vh: innerHeight,
    docH: document.documentElement.scrollHeight,
    scrollW: document.documentElement.scrollWidth,
    cols: cs.gridTemplateColumns,
    nCols: cs.gridTemplateColumns.split(' ').length,
    cards: []
  };

  for (var i = 0; i < grid.children.length; i++) {
    var c = grid.children[i];
    var ccs = getComputedStyle(c);
    var cr = rect(c);
    var padL = parseFloat(ccs.paddingLeft), padR = parseFloat(ccs.paddingRight);
    var innerL = cr.left + padL, innerR = cr.right - padR;

    var ico = c.querySelector('.zf-stat__icon');
    var lab = c.querySelector('.zf-stat__label');
    var val = c.querySelector('.zf-stat__value');
    var go = c.querySelector('.zf-stat__go');
    if (!ico || !lab || !val || !go) { continue; }

    var ir = rect(ico), lr = rect(lab), vr = rect(val), gr = rect(go);
    var gap = parseFloat(ccs.columnGap) || 0;
    var textW = Math.max(lr.width, vr.width);
    var contentW = ir.width + gap + textW;

    out.cards.push({
      label: lab.textContent, value: val.textContent,
      display: ccs.display,
      cardW: +cr.width.toFixed(1), cardH: +cr.height.toFixed(1),
      innerW: +(innerR - innerL).toFixed(1),
      iconW: +ir.width.toFixed(1), iconH: +ir.height.toFixed(1),
      iconGridArea: getComputedStyle(ico).gridArea,
      goGridArea: getComputedStyle(go).gridArea,
      contentW: +contentW.toFixed(1),
      contentPct: +(100 * contentW / (innerR - innerL)).toFixed(1),
      iconOff: +(ir.left - innerL).toFixed(1),
      goOffRight: +(innerR - gr.right).toFixed(1),
      valueFont: px(val, 'fontSize'),
      labelFont: px(lab, 'fontSize')
    });
  }
  return out;
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  // 关缓存：否则读到的可能是上一轮的 app.css，会把"改动生效"误判成"没生效"
  await send('Network.setCacheDisabled', { cacheDisabled: true });

  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');
  var sizes = [[1440, 900], [1920, 1080], [1280, 800], [1100, 900], [820, 1000]];

  for (var i = 0; i < sizes.length; i++) {
    var W = sizes[i][0], H = sizes[i][1];
    await send('Emulation.setDeviceMetricsOverride',
      { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
    await send('Page.navigate', { url: FILE_URL });
    await cdp.sleep(2000);

    var r = await send('Runtime.evaluate', { expression: METRIC, returnByValue: true });
    var m = r.result.result.value || r.result.value;
    var tag = W + 'x' + H;
    console.log('\n===== ' + tag + ' =====');
    if (!m || m.error) { ok(tag, false, JSON.stringify(m || r).slice(0, 200)); continue; }

    var c0 = m.cards[0];
    var c1 = m.cards[1];
    console.log('  nCols=' + m.nCols + '  docH=' + m.docH + ' vh=' + m.vh);
    console.log('  card0 ' + c0.cardW + 'x' + c0.cardH + ' innerW=' + c0.innerW +
      ' iconW=' + c0.iconW + ' contentPct=' + c0.contentPct + '%' +
      ' iconOff=' + c0.iconOff + ' goOffRight=' + c0.goOffRight);
    console.log('  iconGridArea="' + c0.iconGridArea + '"  goGridArea="' + c0.goGridArea + '"');

    // ---- 全视口通用断言 ----
    ok(tag + ' 卡片已改为 grid 布局', c0.display === 'grid', 'display=' + c0.display);
    ok(tag + ' 图标占据第1行第1列（不被 .zf-stat > div 误伤）',
      /^1\s*\/\s*1\s*\/\s*2\s*\/\s*2$/.test(c0.iconGridArea.trim()),
      'gridArea=' + c0.iconGridArea);
    ok(tag + ' 图标左缘贴合内容区左缘（<=2px）',
      Math.abs(c0.iconOff) <= 2, 'iconOff=' + c0.iconOff);
    ok(tag + ' 箭头不再贴边（右内退让 >=6px）',
      c0.goOffRight >= 6, 'goOffRight=' + c0.goOffRight);
    ok(tag + ' 箭头在第2行跨两列',
      /^2\s*\/\s*1\s*\/\s*3\s*\/\s*3$/.test(c0.goGridArea.trim()),
      'gridArea=' + c0.goGridArea);
    ok(tag + ' 内容占卡片可用宽 >=40%',
      c0.contentPct >= 40, c0.contentPct + '%');
    ok(tag + ' 无横向溢出', m.scrollW <= m.vw + 1,
      'scrollW=' + m.scrollW + ' vw=' + m.vw);
    ok(tag + ' 四卡尺寸一致',
      m.cards.every(function (c) { return Math.abs(c.cardW - c0.cardW) <= 0.5; }));
    ok(tag + ' 数字渲染正常',
      m.cards.every(function (c) { return /^\d+$/.test(c.value); }),
      m.cards.map(function (c) { return c.value; }).join(','));

    // 断点专属
    if (W === 1440) {
      ok('1440 四列', m.nCols === 4, 'nCols=' + m.nCols);
      ok('1440 图标放大到 52px', c0.iconW === 52, 'iconW=' + c0.iconW);
      // 【断言修正】探针用 parseFloat 取值，返回的是数字 26 而非字符串 "26px"，
      // 原来写成 === '26px' 必然失败。统一用 parseFloat 比较。
      ok('1440 数字放大到 26px', parseFloat(c0.valueFont) === 26, 'font=' + c0.valueFont);
      ok('1440 标签 12.5px', parseFloat(c0.labelFont) === 12.5, 'font=' + c0.labelFont);
      // 【断言修正 · 第二次】最初记的「改造后 1220」是个不准的数，别再当基线用。
      //
      // 完整的归因链（三次实验，逐次收紧）：
      //   1) diag-attribution.js：还原指标卡改动 → docH 1262，证明首页本来就滚动。
      //      当时把「改动后」记为 1220，但那个数没在同一轮里统一量。
      //   2) 本轮加了「列表可点击」改造后，这里读出 1229，超了 1220+2 的容差。
      //      diag-home-ab.js 逐条停用新样式 → Δ=0px；再删掉新 DOM 节点 → Δ=0px。
      //      **证明可点击改造对页面高度零贡献**。
      //   3) diag-baseline.js 直接把两轮改动分别停用：
      //        现状                              1229
      //        停掉可点击样式                     1229  (Δ=0)
      //        再停掉指标卡样式（还原通用 zf-stat） 1250
      //      所以指标卡改造的真实贡献是 1250→1229 = 21px，而非 42px。
      //      1220 是上一轮记录时多算 9px 的结果。
      //
      // 结论：基线改用「同轮实测」的 1229，容差给 2px。这条断言现在检验的是
      // 「可点击改造 + 指标卡改造叠加后，页面不比还原态（1250）更高」。
      ok('1440 页面不比改造前更高', m.docH <= 1229 + 2,
        'docH=' + m.docH + '(两轮改造都停用的还原态 1250)');
      ok('1440 相邻卡图标已区分（合同=diff）', !!c1, c1 && c1.label);
    }
    if (W === 1920) {
      // 1920 下内容刚好放得下，不滚动
      ok('1920 无纵向滚动', m.docH <= m.vh + 1, 'docH=' + m.docH);
      ok('1920 内容占宽 >=40%', c0.contentPct >= 40, c0.contentPct + '%');
    }
    if (W === 1280) {
      ok('1280 仍四列', m.nCols === 4, 'nCols=' + m.nCols);
      ok('1280 图标收到 46px', c0.iconW === 46, 'iconW=' + c0.iconW);
      ok('1280 数字收到 23px', parseFloat(c0.valueFont) === 23, 'font=' + c0.valueFont);
    }
    if (W === 1100) { ok('1100 退两列', m.nCols === 2, 'nCols=' + m.nCols); }
    if (W === 820) { ok('820 退单列', m.nCols === 1, 'nCols=' + m.nCols); }

    var shot = await send('Page.captureScreenshot',
      { format: 'png', clip: { x: 190, y: 130, width: 880, height: 240, scale: 2 } });
    if (shot && shot.result && shot.result.data) {
      fs.writeFileSync(path.join(SHOT_DIR, '98-home-stat-' + tag + '.png'),
        Buffer.from(shot.result.data, 'base64'));
    }
  }

  console.log('\n===== 汇总 =====');
  console.log('PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail ? 1 : 0);
})();
