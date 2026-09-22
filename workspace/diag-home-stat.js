/**
 * 首页「使用概览」指标卡尺寸诊断。
 *
 * 目的：量化 home.html #stat-grid 里 4 张卡的实际盒子尺寸与内部分布，
 * 判断用户截图里的「大小有点问题」到底是哪一类：
 *   a) 卡片整体过矮/过高（padding / min-height 缺失）
 *   b) 图标与数字块的尺寸比例失衡（42px 图标 vs 22px 数字）
 *   c) 右侧箭头被挤到贴边（.zf-card 的 padding 与 .zf-stat 的 gap 打架）
 *   d) 4 列均分但单卡内容只占左半边 → 右侧大片空
 *
 * 用法：node diag-home-stat.js [port]
 */
var path = require('path');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));
var fs = require('fs');

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

var EXPR = `(function () {
  function box(el) {
    if (!el) { return null; }
    var r = el.getBoundingClientRect();
    var cs = getComputedStyle(el);
    return {
      x: +r.x.toFixed(1), y: +r.y.toFixed(1),
      w: +r.width.toFixed(1), h: +r.height.toFixed(1),
      pad: cs.paddingTop + ' ' + cs.paddingRight + ' ' + cs.paddingBottom + ' ' + cs.paddingLeft,
      gap: cs.gap, display: cs.display, align: cs.alignItems,
      font: cs.fontSize, minH: cs.minHeight
    };
  }
  var grid = document.getElementById('stat-grid');
  var out = {
    viewport: { w: innerWidth, h: innerHeight },
    grid: box(grid),
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns : null,
    cards: []
  };
  if (grid) {
    var kids = grid.children;
    for (var i = 0; i < kids.length; i++) {
      var c = kids[i];
      var ico = c.querySelector('.zf-stat__icon');
      var lab = c.querySelector('.zf-stat__label');
      var val = c.querySelector('.zf-stat__value');
      var num = val ? val.parentNode : null;
      var go = c.querySelector('.zf-stat__go');
      var cr = c.getBoundingClientRect();
      // 数字块右侧到卡片内容区右侧的剩余空间
      var numRight = num ? num.getBoundingClientRect().right : 0;
      var icoRight = ico ? ico.getBoundingClientRect().right : 0;
      out.cards.push({
        idx: i,
        card: box(c),
        icon: box(ico),
        label: box(lab),
        value: box(val),
        numBlock: box(num),
        go: box(go),
        // 内容块（图标+文字）的总宽 vs 卡片内容宽
        contentW: +(numRight - (ico ? ico.getBoundingClientRect().left : 0)).toFixed(1),
        cardInnerW: +(cr.width - 40).toFixed(1),
        goLeftGap: go ? +(go.getBoundingClientRect().left - numRight).toFixed(1) : null,
        goRightInset: go ? +(cr.right - 20 - go.getBoundingClientRect().right).toFixed(1) : null,
        labelText: lab ? lab.textContent : null,
        valueText: val ? val.textContent : null
      });
    }
  }
  return out;
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');

  var sizes = [[1440, 900], [1920, 1080], [1280, 800]];
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8');

  for (var i = 0; i < sizes.length; i++) {
    await send('Emulation.setDeviceMetricsOverride', {
      width: sizes[i][0], height: sizes[i][1], deviceScaleFactor: 1, mobile: false
    });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });
    await send('Page.navigate', { url: FILE_URL });
    await cdp.sleep(1800);

    var r = await send('Runtime.evaluate',
      { expression: EXPR, returnByValue: true });
    var v = r.result.result.value || r.result.value;
    console.log('===== ' + sizes[i][0] + 'x' + sizes[i][1] + ' =====');
    if (!v) { console.log('  取值失败', JSON.stringify(r).slice(0, 400)); continue; }
    console.log('grid: w=' + (v.grid && v.grid.w) + ' h=' + (v.grid && v.grid.h) +
      ' cols=' + v.gridCols + ' gap=' + (v.grid && v.grid.gap));
    v.cards.forEach(function (c) {
      console.log(' card' + c.idx + ' "' + c.labelText + '"=' + c.valueText +
        ' | box w=' + c.card.w + ' h=' + c.card.h + ' pad=' + c.card.pad);
      console.log('     icon ' + (c.icon ? c.icon.w + 'x' + c.icon.h : '-') +
        ' | value h=' + (c.value ? c.value.h : '-') + ' font=' + (c.value ? c.value.font : '-') +
        ' | label h=' + (c.label ? c.label.h : '-'));
      console.log('     contentW=' + c.contentW + ' cardInnerW=' + c.cardInnerW +
        ' goLeftGap=' + c.goLeftGap + ' goRightInset=' + c.goRightInset);
    });
  }
  ws.close();
  process.exit(0);
})();
