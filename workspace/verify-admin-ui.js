/* 管理端整体优化验证：外壳 + 9 页 + 表格可读性 + 数据看板
 *
 * 写法说明：探针以**独立函数源码**形式注入页面（window.__probe），
 * 而不是拼成一整条巨型表达式字符串 —— 后者一旦漏一个分号，
 * 紧跟的块注释就会让解析器把两条语句粘在一起，报 "Unexpected identifier"。
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http');
var fs = require('fs');
var CDP = 9363, APP = 8080, HOST = '127.0.0.1', CTX = '/zhixiaofa';
var COOKIE = __CK__;

function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
function httpPut(u) {
  return new Promise(function (res, rej) {
    var x = new URL(u);
    var q = http.request({ hostname: x.hostname, port: x.port, path: x.pathname + x.search, method: 'PUT' },
      function (r) { var b = ''; r.on('data', function (c) { b += c; }); r.on('end', function () { try { res(JSON.parse(b)); } catch (e) { res({ raw: b }); } }); });
    q.on('error', rej); q.end();
  });
}
function closeTab(id) {
  return new Promise(function (res) {
    var q = http.request({ hostname: HOST, port: CDP, path: '/json/close/' + id, method: 'GET' },
      function (r) { r.resume(); r.on('end', res); });
    q.on('error', function () { res(); }); q.end();
  });
}
async function ev(send, e) {
  var r = await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true });
  if (r && r.result && r.result.exceptionDetails) {
    return 'EXC:' + JSON.stringify(r.result.exceptionDetails.exception || r.result.exceptionDetails).slice(0, 500);
  }
  return r && r.result && r.result.result ? r.result.result.value : undefined;
}

/* ---- 注入页面的探针函数（多行可读写法，无字符串拼接陷阱） ---- */
var PROBE_SRC = [
  'window.__probe = function () {',
  '  var g = function (s) { return document.querySelector(s); };',
  '  var ga = function (s) { return document.querySelectorAll(s); };',
  '  var o = {};',
  '  o.href = location.pathname;',
  '  o.errs = (window.__e || []).length;',
  '  o.docH = document.documentElement.scrollHeight;',
  '',
  '  o.contentBg = g(".zf-content") ? getComputedStyle(g(".zf-content")).backgroundColor : null;',
  '  o.contentPad = g(".zf-content") ? getComputedStyle(g(".zf-content")).padding : null;',
  '  o.sidebarBg = g(".zf-sidebar") ? getComputedStyle(g(".zf-sidebar")).backgroundColor : null;',
  '  o.sidebarBorder = g(".zf-sidebar") ? getComputedStyle(g(".zf-sidebar")).borderRightWidth : null;',
  '  o.sidebarFoot = ga(".zf-sidebar__foot").length;',
  '  o.sideBrand = (g(".zf-sidebar__name") || {}).textContent || null;',
  '',
  '  var cards = ga(".zf-content .zf-card");',
  '  o.cardN = cards.length;',
  '  o.cardShadow = cards.length ? getComputedStyle(cards[0]).boxShadow.slice(0, 34) : null;',
  '  var hero = g(".zf-card--hero");',
  '  o.heroShadow = hero ? getComputedStyle(hero).boxShadow.slice(0, 34) : null;',
  '  var plain = g(".zf-card--plain");',
  '  o.plainBg = plain ? getComputedStyle(plain).backgroundColor : null;',
  '',
  '  var dataCard = (function () { var fb0 = g(".zf-filter-bar"); return fb0 ? fb0.closest(".zf-card") : null; })();',
  '  o.listCardHead = dataCard ? dataCard.querySelectorAll(":scope > .zf-card__head").length : -1;',
  '',
  '  o.order = (function () {',
  '    var c = dataCard;',
  '    if (!c) { return null; }',
  '    var ch = c.children, fi = -1, ti = -1;',
  '    for (var i = 0; i < ch.length; i++) {',
  '      if (!ch[i].className) { continue; }',
  '      var cn = String(ch[i].className);',
  '      if (fi < 0 && cn.indexOf("zf-filter-bar") >= 0) { fi = i; }',
  '      if (ti < 0 && cn.indexOf("zf-toolbar") >= 0) { ti = i; }',
  '    }',
  '    return fi + "," + ti;',
  '  })();',
  '',
  '  o.table = null;',
  '  var tb = g(".bootstrap-table table tbody");',
  '  if (tb) {',
  '    var trs = tb.querySelectorAll("tr");',
  '    var tds = trs.length ? trs[0].querySelectorAll("td") : [];',
  '    var cells = [];',
  '    for (var j = 0; j < tds.length; j++) {',
  '      var rb = tds[j].getBoundingClientRect();',
  '      cells.push(Math.round(rb.height) + "x" + Math.round(rb.width));',
  '    }',
  '    var cb = g(".bootstrap-table .fixed-table-container");',
  '    var badge = g(".bootstrap-table table .zf-badge");',
  '    o.table = {',
  '      rows: trs.length,',
  '      rowH: trs.length ? Math.round(trs[0].getBoundingClientRect().height) : 0,',
  '      cells: cells,',
  '      vAlign: tds.length ? getComputedStyle(tds[0]).verticalAlign : null,',
  '      overflowX: cb ? (cb.scrollWidth > cb.clientWidth + 2) : null,',
  '      fixedOverflow: cb ? getComputedStyle(cb).overflowX : null,',
  '      badgeNowrap: badge ? getComputedStyle(badge).whiteSpace : null,',
  '      headerNowrap: (function () { var th = g(".bootstrap-table table thead th"); return th ? getComputedStyle(th).whiteSpace : null; })()',
  '    };',
  '  }',
  '',
  '  var ib = ga(".bootstrap-table table .zf-btn--icon");',
  '  if (ib.length) {',
  '    var b0 = ib[0].getBoundingClientRect();',
  '    o.iconBtn = { n: ib.length, w: Math.round(b0.width), h: Math.round(b0.height),',
  '      title: ib[0].getAttribute("title"), aria: ib[0].getAttribute("aria-label"),',
  '      display: getComputedStyle(ib[0]).display };',
  '  } else { o.iconBtn = null; }',
  '  o.textBtnLeft = ga(".bootstrap-table table .zf-btn--sm").length;',
  '',
  '  o.kwLabel = (function () {',
  '    var fb = g(".zf-filter-bar");',
  '    if (!fb) { return null; }',
  '    var it = fb.querySelector("[data-filter=keyword]");',
  '    if (!it) { return null; }',
  '    var lb = it.parentNode.querySelector(".zf-filter-bar__label");',
  '    return lb ? lb.textContent.trim() : null;',
  '  })();',
  '',
  '  o.toolbarBtns = (function () {',
  '    var tb2 = g(".zf-content .zf-toolbar");',
  '    if (!tb2) { return null; }',
  '    var bs = tb2.querySelectorAll("button"), r = [];',
  '    for (var m = 0; m < bs.length; m++) { r.push(bs[m].textContent.trim()); }',
  '    return r;',
  '  })();',
  '',
  '  o.charts = (function () {',
  '    var out = [];',
  '    if (typeof echarts === "undefined") { return out; }',
  '    var boxes = ga(".zf-chart");',
  '    for (var n = 0; n < boxes.length; n++) {',
  '      var inst = null;',
  '      try { inst = echarts.getInstanceByDom(boxes[n]); } catch (e) { inst = null; }',
  '      if (inst) {',
  '        var op = inst.getOption();',
  '        out.push({ id: boxes[n].id || "(no-id)", colors: op.color.slice(0, 3), series: (op.series || []).length });',
  '      }',
  '    }',
  '    return out;',
  '  })();',
  '',
  '  o.pieBox = (function () { var p = g("#quiz-pie"); return p ? Math.round(p.getBoundingClientRect().width) + "x" + Math.round(p.getBoundingClientRect().height) : null; })();',
  '',
  '  return o;',
  '};'
].join('\n');

var PAGES = [
  ['index', '数据看板', false],
  ['users', '用户管理', true],
  ['qa', '问答管理', true],
  ['contracts', '合同管理', true],
  ['laws', '法律管理', true],
  ['knowledge', '文章管理', true],
  ['doc-templates', '模板管理', true],
  ['quiz', '题库管理', true],
  ['logs', '日志监控', true]
];

var pass = 0, fail = 0, report = [];

function chk(name, ok, extra) {
  if (ok) { pass++; } else { fail++; console.log('   FAIL ' + name + '   实际=' + (extra === undefined ? '' : extra)); }
}

(async function () {
  var t = await httpPut('http://' + HOST + ':' + CDP + '/json/new?about:blank');
  var conn = await cdp.connect(t.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Network.setCookie', { name: 'JSESSIONID', value: COOKIE, domain: HOST, path: CTX, url: 'http://' + HOST + ':' + APP + CTX + '/' });

  for (var k = 0; k < PAGES.length; k++) {
    var pg = PAGES[k][0], name = PAGES[k][1], isList = PAGES[k][2];
    await send('Page.navigate', { url: 'http://' + HOST + ':' + APP + CTX + '/admin/' + pg + '.html' });
    await sleep(3600);
    await ev(send, 'window.__e=[];window.addEventListener("error",function(x){window.__e.push(String(x.message));});');
    var inj = await ev(send, PROBE_SRC);
    if (inj !== undefined && String(inj).indexOf('EXC:') === 0) {
      console.log('!!! [' + name + '] 探针注入失败: ' + String(inj));
      continue;
    }
    var r = await ev(send, 'JSON.stringify(window.__probe())');
    if (String(r).indexOf('EXC:') === 0) { console.log('!!! [' + name + '] 探针执行异常: ' + String(r).slice(0, 600)); continue; }
    var d;
    try { d = JSON.parse(r); } catch (pe) { console.log('!!! [' + name + '] JSON 解析失败: ' + String(r).slice(0, 600)); continue; }
    report.push([name, d]);

    var tag = '[' + name + '] ';
    chk(tag + '无 JS 报错', d.errs === 0, d.errs);
    chk(tag + '内容区浅灰画布', d.contentBg === 'rgb(246, 247, 249)', d.contentBg);
    chk(tag + '侧栏白底', d.sidebarBg === 'rgb(255, 255, 255)', d.sidebarBg);
    chk(tag + '侧栏右分隔线 1px', d.sidebarBorder === '1px', d.sidebarBorder);
    chk(tag + '侧栏底部开发信息已删', d.sidebarFoot === 0, d.sidebarFoot);
    chk(tag + '卡片有极浅投影', !!d.cardShadow && d.cardShadow !== 'none', d.cardShadow);

    if (isList) {
      chk(tag + '主卡重复标题块已删', d.listCardHead === 0, d.listCardHead);
      chk(tag + '顺序 filter-bar→toolbar', (function (o) { var a = String(o).split(','); return a.length === 2 && +a[0] >= 0 && +a[1] >= 0 && +a[0] < +a[1]; })(d.order), d.order);
      chk(tag + '关键词有 label', d.kwLabel === '关键词', d.kwLabel);
      chk(tag + '表格有数据行', d.table && d.table.rows > 0, d.table && d.table.rows);
      if (d.table && d.table.rows > 0) {
        chk(tag + '行高收紧 <70px', d.table.rowH < 70, d.table.rowH);
        chk(tag + '单元格垂直居中', d.table.vAlign === 'middle', d.table.vAlign);
        chk(tag + '表头不折行', d.table.headerNowrap === 'nowrap', d.table.headerNowrap);
        chk(tag + '容器可横向滚动', d.table.fixedOverflow === 'auto', d.table.fixedOverflow);
      }
      if (d.iconBtn) {
        chk(tag + '图标按钮 28x28', d.iconBtn.w === 28 && d.iconBtn.h === 28, d.iconBtn.w + 'x' + d.iconBtn.h);
        chk(tag + '图标按钮有 title+aria', !!d.iconBtn.title && !!d.iconBtn.aria, d.iconBtn.title + '/' + d.iconBtn.aria);
      }
      chk(tag + '无文字按钮残留', d.textBtnLeft === 0, d.textBtnLeft);
    }

    var shot = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(require('path').join(__dirname, 'shots', '290-admin-' + pg + '.png'), Buffer.from(shot.result.data, 'base64'));
  }

  console.log('');
  console.log('==================== 逐页明细 ====================');
  for (var i = 0; i < report.length; i++) {
    var nm = report[i][0], dd = report[i][1];
    var s = '  ' + nm;
    while (s.length < 15) { s += ' '; }
    s += 'docH=' + dd.docH;
    if (dd.table) { s += '  行数=' + dd.table.rows + '  行高=' + dd.table.rowH + 'px  横溢=' + dd.table.overflowX; }
    if (dd.iconBtn) { s += '  图标钮=' + dd.iconBtn.n + '(' + dd.iconBtn.display + ')'; }
    console.log(s);
    if (dd.table && dd.table.cells) { console.log('       单元格 高x宽: ' + dd.table.cells.join('  ')); }
    if (dd.pieBox) { console.log('       quiz 饼图容器: ' + dd.pieBox); }
    if (dd.charts && dd.charts.length) {
      for (var c = 0; c < dd.charts.length; c++) {
        console.log('       图表 #' + dd.charts[c].id + '  索引:' + dd.charts[c].colors.join('/') + '  系列数:' + dd.charts[c].series);
      }
    }
    if (dd.toolbarBtns && dd.toolbarBtns.length) { console.log('       工具行按钮: ' + JSON.stringify(dd.toolbarBtns)); }
  }
  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  conn.socket.destroy();
  await closeTab(t.id);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
