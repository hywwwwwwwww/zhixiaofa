/**
 * 首页「使用概览」指标卡 —— 改造后实测诊断（v2）
 *
 * 与 diag-home-stat.js 的区别：那版探针有两个测量错误
 *   1) `val.parentNode` 取的是文字块，它现在是 flex:1（撑满整行），
 *      所以 contentW 会退化成"图标左缘→卡片右缘"，量不出真实文字宽度。
 *      正确做法是取「图标 + 标签文字 + 数字文字」三者的真实几何。
 *   2) cardInnerW 硬编码 `cr.width - 40`，padding 改了之后就是错的，
 *      必须从 getComputedStyle 读 padding。
 *
 * 用法：node diag-home-stat2.js [port]
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

var EXPR = `(function () {
  function rect(el) { return el ? el.getBoundingClientRect() : null; }
  function px(el, prop) { return el ? parseFloat(getComputedStyle(el)[prop]) : 0; }

  var grid = document.getElementById('stat-grid');
  if (!grid) { return { error: 'no #stat-grid' }; }

  var out = {
    vw: innerWidth, vh: innerHeight,
    docH: document.documentElement.scrollHeight,
    cols: getComputedStyle(grid).gridTemplateColumns,
    cards: []
  };

  for (var i = 0; i < grid.children.length; i++) {
    var c = grid.children[i];
    var cs = getComputedStyle(c);
    var cr = rect(c);
    var padL = parseFloat(cs.paddingLeft), padR = parseFloat(cs.paddingRight);
    var innerL = cr.left + padL, innerR = cr.right - padR;

    var ico = c.querySelector('.zf-stat__icon');
    var lab = c.querySelector('.zf-stat__label');
    var val = c.querySelector('.zf-stat__value');
    var go = c.querySelector('.zf-stat__go');
    var ir = rect(ico), lr = rect(lab), vr = rect(val), gr = rect(go);

    // 文字块真实宽度 = max(标签, 数字) 的实际绘制宽
    var textW = Math.max(lr ? lr.width : 0, vr ? vr.width : 0);
    // 内容总宽 = 图标宽 + 卡片 gap + 文字宽
    var gap = parseFloat(cs.columnGap || cs.gap) || 0;
    var contentW = (ir ? ir.width : 0) + gap + textW;

    out.cards.push({
      label: lab ? lab.textContent : null,
      value: val ? val.textContent : null,
      cardW: +cr.width.toFixed(1), cardH: +cr.height.toFixed(1),
      padL: padL, padR: padR, gap: gap,
      innerW: +(innerR - innerL).toFixed(1),
      iconW: ir ? +ir.width.toFixed(1) : null,
      iconH: ir ? +ir.height.toFixed(1) : null,
      iconFont: px(ico, 'fontSize'),
      labelW: lr ? +lr.width.toFixed(1) : null,
      labelFont: px(lab, 'fontSize'),
      valueW: vr ? +vr.width.toFixed(1) : null,
      valueH: vr ? +vr.height.toFixed(1) : null,
      valueFont: px(val, 'fontSize'),
      textW: +textW.toFixed(1),
      contentW: +contentW.toFixed(1),
      contentPct: +(100 * contentW / (innerR - innerL)).toFixed(1),
      // 图标左缘是否与内容区左缘对齐（应≈0）
      iconAlignL: ir ? +(ir.left - innerL).toFixed(1) : null,
      // 箭头右缘到内容区右缘的退让（应≈8）
      goInset: gr ? +(innerR - gr.right).toFixed(1) : null,
      // 箭头左缘到文字块右缘的间距
      goTextGap: (gr && vr && lr) ? +(gr.left - (vr.right > lr.right ? vr.right : lr.right)).toFixed(1) : null
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
  // 【必须】本项目无构建步骤，CSS/JS 走 file:// 也会被磁盘缓存命中。
  // 不关缓存时会读到上一轮的 app.css，实测数据完全不变，极易误判为"改动没生效"。
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');

  var sizes = [[1440, 900], [1920, 1080], [1280, 800], [1100, 900], [820, 1000], [560, 900]];

  for (var i = 0; i < sizes.length; i++) {
    var W = sizes[i][0], H = sizes[i][1];
    await send('Emulation.setDeviceMetricsOverride',
      { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
    await send('Page.navigate', { url: FILE_URL });
    await cdp.sleep(1900);

    var r = await send('Runtime.evaluate', { expression: EXPR, returnByValue: true });
    var v = r.result.result.value || r.result.value;
    console.log('\n===== ' + W + 'x' + H + ' =====');
    if (!v || v.error) { console.log('  取值失败:', JSON.stringify(v || r).slice(0, 300)); continue; }
    var nCols = v.cols ? v.cols.split(' ').length : 0;
    console.log('  cols=' + v.cols);
    console.log('  docH=' + v.docH + '  vh=' + v.vh +
      '  纵向滚动=' + (v.docH > v.vh + 1 ? '有(+' + (v.docH - v.vh) + 'px)' : '无'));
    var c0 = v.cards[0];
    if (c0) {
      console.log('  card0 ' + c0.cardW + 'x' + c0.cardH +
        '  innerW=' + c0.innerW + '  pad=' + c0.padL + '/' + c0.padR + '  gap=' + c0.gap);
      console.log('    icon ' + c0.iconW + 'x' + c0.iconH + ' font=' + c0.iconFont +
        '  alignL=' + c0.iconAlignL);
      console.log('    label "' + c0.label + '" w=' + c0.labelW + ' font=' + c0.labelFont);
      console.log('    value "' + c0.value + '" w=' + c0.valueW + ' font=' + c0.valueFont +
        ' h=' + c0.valueH);
      console.log('    contentW=' + c0.contentW + ' (' + c0.contentPct + '% of innerW)' +
        '  goInset=' + c0.goInset + '  goTextGap=' + c0.goTextGap);
    }
    for (var j = 1; j < v.cards.length; j++) {
      var c = v.cards[j];
      console.log('  card' + j + ' "' + c.label + '" contentPct=' + c.contentPct +
        '% goInset=' + c.goInset);
    }
  }
  process.exit(0);
})();
