/* ============================================================================
   shot-fonts2.js —— 字体对比截图（极简版：直接写文件，一次导航一次截图）

   放弃「先 eval 求值 html 再注入」的两段式（那段路 debug 了很久，
   实测 h1/h2 return 的字符串注入后 innerHTML.length=0，原因未定位）。
   改成最直白的流程：Node 侧把完整 HTML 拼好 -> 写文件 -> 导航 -> 截图 -> 删文件。
   零 eval、零注入、零时序依赖。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var CSSDIR = 'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/css';
var OUTDIR = path.join(__dirname, 'shots');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function docBlock(cls, text) {
  var lines = String(text).split('\n'), out = [];
  for (var i = 0; i < lines.length; i++) {
    var ln = lines[i];
    if (/^[\u3000\s]{6,}\S/.test(ln) && ln.replace(/[\u3000\s]/g, '').length <= 40) {
      out.push('<span class="zf-doc__sign">' + esc(ln.replace(/^[\u3000\s]+/, '')) + '</span>');
    } else { out.push(esc(ln)); }
  }
  return '<div class="' + cls + '">' + out.join('\n') + '</div>';
}
function col(label, note, inner) {
  return '<td style="width:520px;vertical-align:top;padding:0 12px">' +
    '<div style="font-size:13px;font-weight:700;color:#0e1115;margin:0 0 3px">' + label + '</div>' +
    '<div style="font-size:11.5px;color:#7f8d9f;margin:0 0 12px;line-height:1.55;height:38px">' + note + '</div>' +
    inner + '</td>';
}
function page(title, sub, body) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<link rel="stylesheet" href="app.css">' +
    '<style>html,body{margin:0;background:#eef1f5}' +
    '.wrap{padding:22px 26px}h1.t{font-size:19px;margin:0 0 4px;font-weight:700}' +
    'p.s{font-size:12px;color:#7f8d9f;margin:0 0 18px;line-height:1.6}</style>' +
    '</head><body><div class="wrap">' +
    '<h1 class="t">' + title + '</h1><p class="s">' + sub + '</p>' + body +
    '</div></body></html>';
}

var DOC = [
  '劳动仲裁申请书',
  '',
  '申请人：张三，男，1995年3月12日出生，汉族，住济南市历下区。',
  '被申请人：某某科技有限公司，住所地济南市高新区。',
  '',
  '请求事项：',
  '一、请求裁决被申请人支付解除劳动合同经济补偿金128000.00元；',
  '二、请求裁决被申请人支付2026年8月至2026年9月工资合计23500.00元。',
  '',
  '事实与理由：',
  '申请人于2021年7月1日入职被申请人处，双方签订书面劳动合同，约定月工资为16000.00元。',
  '2026年9月13日，被申请人以组织架构调整为由单方解除劳动合同，未提前三十日通知，',
  '亦未依法支付经济补偿金。依据《中华人民共和国劳动合同法》第四十条、第四十六条之规定，',
  '被申请人应当支付经济补偿金。',
  '',
  '此致',
  '济南市劳动人事争议仲裁委员会',
  '',
  '　　　　　　　　　　　　　　　　　　申请人：张三',
  '　　　　　　　　　　　　　　　　　　2026年9月21日'
].join('\n');

var LAW = '有下列情形之一的，用人单位提前三十日以书面形式通知劳动者本人或者额外支付劳动者一个月工资后，可以解除劳动合同：（一）劳动者患病或者非因工负伤，在规定的医疗期满后不能从事原工作，也不能从事由用人单位另行安排的工作的；（二）劳动者不能胜任工作，经过培训或者调整工作岗位，仍不能胜任工作的。';

/* ---------- 三张对比图的 HTML ---------- */

var PAGE1 = page(
  '文书正文：字体改造前后',
  '同一段法律文书 · 左＝改造前（继承全站无衬线栈）· 右＝改造后（纸面态衬线栈）',
  '<table style="border-collapse:separate;border-spacing:0"><tr>' +
  col('改造前 .zf-doc',
    '继承全站无衬线栈<br>13.5px / 行高 1.9 / 字距 normal / 底色 #fafbfc / 1px 描边',
    docBlock('zf-doc', DOC)) +
  col('改造后 .zf-doc--sheet',
    '衬线栈 Georgia→Cambria→宋体<br>14.5px / 行高 2.0 / 字距 .02em / 白底 + 投影',
    docBlock('zf-doc zf-doc--sheet', DOC)) +
  '</tr></table>');

var LAW_INNER =
  '<div class="zf-law" style="margin-top:0">' +
  '<div class="zf-law__name">《中华人民共和国劳动合同法》第四十条</div>' +
  '<div class="zf-law__text"><strong>无过失性辞退</strong></div>' +
  '<div class="zf-law__text">' + LAW + '</div></div>';

var PAGE2 = page(
  '法条引用区：字体改造前后',
  '引用体用衬线，是版式语言里区分「正文」与「引文」的通用手法 —— 不必再加边框或底色',
  '<table style="border-collapse:separate;border-spacing:0"><tr>' +
  col('改造前', '全站无衬线栈<br>12.5px / 行高 1.65', LAW_INNER) +
  col('改造后', '衬线栈（Georgia → 宋体）<br>12.5px / 行高 1.8',
    '<div class="zf-law" style="margin-top:0;font-family:Georgia,Cambria,\'Times New Roman\',\'Source Han Serif SC\',SimSun,\'Microsoft YaHei\',serif;line-height:1.8">' +
    '<div class="zf-law__name">《中华人民共和国劳动合同法》第四十条</div>' +
    '<div class="zf-law__text"><strong>无过失性辞退</strong></div>' +
    '<div class="zf-law__text" style="line-height:1.8">' + LAW + '</div></div>') +
  '</tr></table>');

function numRow(fam, label, hl) {
  var bg = hl ? 'background:#f0f7ff;' : '';
  var td = 'padding:9px 14px;border-bottom:1px solid #e7eaef;white-space:pre;' + bg;
  return '<tr>' +
    '<td style="' + td + 'font-size:12px;color:#7f8d9f">' + label + '</td>' +
    '<td style="' + td + 'font-family:' + fam + ';font-size:26px;font-weight:700">4 2 2 5</td>' +
    '<td style="' + td + 'font-family:' + fam + ';font-size:20px">1111111111</td>' +
    '<td style="' + td + 'font-family:' + fam + ';font-size:20px">8888888888</td>' +
    '<td style="' + td + 'font-family:' + fam + ';font-size:20px">2026-09-13</td>' +
    '</tr>';
}
var th = function (t) {
  return '<th style="padding:10px 14px;font-size:11.5px;font-weight:600;color:#7f8d9f;text-align:left;border-bottom:1px solid #e7eaef">' + t + '</th>';
};

var PAGE3 = page(
  '数字排版：为什么数字位坚持无衬线',
  '看第 3、4 列 —— Segoe UI / 微软雅黑 / Consolas 的「1111111111」与「8888888888」左右边缘完全对齐；' +
  '而 Georgia / Times New Roman 的「1」明显比「8」窄，这类比例数字放进指标卡会让数字左右抖动。',
  '<table style="border-collapse:separate;border-spacing:0;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(14,17,21,.08)">' +
  '<tr style="background:#f7f9fc">' + th('字体栈') + th('指标卡数字 26px/700') + th('数字串 A') + th('数字串 B') + th('日期串') + '</tr>' +
  numRow("'Segoe UI',sans-serif", 'Segoe UI ← 当前数字位', true) +
  numRow("'Microsoft YaHei',sans-serif", '微软雅黑') +
  numRow('Consolas,monospace', 'Consolas（等宽）') +
  numRow('Georgia,serif', 'Georgia（衬线）') +
  numRow("'Times New Roman',serif", 'Times New Roman（衬线）') +
  '</table>');

(async function () {
  if (!fs.existsSync(OUTDIR)) { fs.mkdirSync(OUTDIR, { recursive: true }); }

  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var t = tabs.filter(function (x) { return x.type === 'page' && x.url.indexOf('devtools://') < 0; })[0];
  if (!t) { console.log('no target'); process.exit(1); }

  var conn = await cdp.connect(t.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1100, deviceScaleFactor: 2, mobile: false });

  var jobs = [
    ['_ft1.html', PAGE1, 'font-1-doc.png'],
    ['_ft2.html', PAGE2, 'font-2-law.png'],
    ['_ft3.html', PAGE3, 'font-3-num.png']
  ];

  for (var i = 0; i < jobs.length; i++) {
    var j = jobs[i];
    var file = path.join(CSSDIR, j[0]);
    fs.writeFileSync(file, j[1], 'utf8');
    await send('Page.navigate', { url: 'file:///' + file.replace(/ /g, '%20') });
    await sleep(1400);

    var chk = await send('Runtime.evaluate', {
      expression: "JSON.stringify({href:location.pathname,bodyH:document.body.getBoundingClientRect().height,text:(document.body.textContent||'').slice(0,30),ff:getComputedStyle(document.body).fontFamily.slice(0,20)})",
      returnByValue: true
    });
    console.log('[' + j[0] + '] ' + (chk.result && chk.result.result ? chk.result.result.value : '?'));

    var s = await send('Page.captureScreenshot', { format: 'png' });
    var out = path.join(OUTDIR, j[2]);
    fs.writeFileSync(out, Buffer.from(s.result.data, 'base64'));
    console.log('  ✓ ' + j[2] + '  ' + fs.statSync(out).size + ' bytes');
    try { fs.unlinkSync(file); } catch (e) { }
  }

  console.log('\n临时文件已清理');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });
