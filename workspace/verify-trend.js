/* 验证「业务趋势」折线图修复：日期并集对齐 + 双 Y 轴 + 补「案件」序列 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http'); var fs = require('fs');
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
    return 'EXC:' + JSON.stringify(r.result.exceptionDetails.exception || {}).slice(0, 400);
  }
  return r && r.result && r.result.result ? r.result.result.value : undefined;
}

var PROBE = [
  'window.__t = function () {',
  '  var g = function (s) { return document.querySelector(s); };',
  '  var inst = null;',
  '  try { inst = echarts.getInstanceByDom(g("#trend-chart")); } catch (e) { inst = null; }',
  '  if (!inst) { return { ok: false }; }',
  '  var op = inst.getOption();',
  '  var o = { ok: true };',
  '  o.yAxisN = op.yAxis ? op.yAxis.length : 0;',
  '  o.xN = (op.xAxis && op.xAxis[0] && op.xAxis[0].data) ? op.xAxis[0].data.length : 0;',
  '  o.xData = (op.xAxis && op.xAxis[0]) ? op.xAxis[0].data : null;',
  '  o.seriesN = (op.series || []).length;',
  '  o.series = [];',
  '  for (var i = 0; i < (op.series || []).length; i++) {',
  '    var s = op.series[i];',
  '    var vals = [];',
  '    for (var j = 0; j < (s.data || []).length; j++) {',
  '      var v = s.data[j];',
  '      if (v === null || v === undefined) { vals.push(null); }',
  '      else if (typeof v === "object" && v.value !== undefined) { vals.push(v.value); }',
  '      else { vals.push(v); }',
  '    }',
  '    var nn = [];',
  '    for (var k = 0; k < vals.length; k++) { if (vals[k] !== null) { nn.push(vals[k]); } }',
  '    o.series.push({',
  '      name: s.name,',
  '      yAxisIndex: (s.yAxisIndex || 0),',
  '      lineType: (s.lineStyle && s.lineStyle.type) || "solid",',
  '      n: vals.length, notNull: nn.length,',
  '      min: nn.length ? Math.min.apply(null, nn) : null,',
  '      max: nn.length ? Math.max.apply(null, nn) : null,',
  '      vals: vals',
  '    });',
  '  }',
  '  o.legend = (op.legend && op.legend[0] && op.legend[0].data) ? op.legend[0].data : null;',
  '  return o;',
  '};'
].join('\n');

var pass = 0, fail = 0;
function chk(n, ok, extra) { if (ok) { pass++; } else { fail++; console.log('   FAIL ' + n + '   实际=' + (extra === undefined ? '' : JSON.stringify(extra))); } }

(async function () {
  var t = await httpPut('http://' + HOST + ':' + CDP + '/json/new?about:blank');
  var conn = await cdp.connect(t.webSocketDebuggerUrl); var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Network.setCookie', { name: 'JSESSIONID', value: COOKIE, domain: HOST, path: CTX, url: 'http://' + HOST + ':' + APP + CTX + '/' });
  await send('Page.navigate', { url: 'http://' + HOST + ':' + APP + CTX + '/admin/index.html' });
  await sleep(4500);
  await ev(send, PROBE);
  var r = await ev(send, 'JSON.stringify(window.__t())');
  if (String(r).indexOf('EXC:') === 0) { console.log('!!! 探针异常 ' + r); process.exit(1); }
  var d = JSON.parse(r);
  chk('图表实例存在', d.ok === true, d.ok);
  chk('yAxis 为双轴', d.yAxisN === 2, d.yAxisN);
  chk('x 轴取日期并集(>2 天，原来只有 2)', d.xN > 2, d.xN);
  chk('并集首尾正确(09-08 / 09-22)', !!(d.xData && d.xData[0] === '2026-09-08' && d.xData[d.xN - 1] === '2026-09-22'), d.xData);
  chk('序列数 6（含新增「案件」）', d.seriesN === 6, d.seriesN);
  chk('图例含「请求量（右轴）」', !!(d.legend && d.legend.indexOf('请求量（右轴）') >= 0), d.legend);
  console.log('');
  console.log('================ 各序列 ================');
  for (var i = 0; i < d.series.length; i++) {
    var s = d.series[i];
    console.log('  ' + s.name + '  axis=' + s.yAxisIndex + '  ' + s.lineType +
      '  点数=' + s.n + '  非空=' + s.notNull + '  范围=' + s.min + '~' + s.max);
    console.log('      ' + JSON.stringify(s.vals));
  }
  console.log('');
  console.log('  x 轴日期: ' + JSON.stringify(d.xData));
  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass + fail));
  var shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(require('path').join(__dirname, 'shots', '300-trend-fixed.png'), Buffer.from(shot.result.data, 'base64'));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function (e) { console.log('FATAL ' + (e && e.stack || e)); process.exit(1); });
