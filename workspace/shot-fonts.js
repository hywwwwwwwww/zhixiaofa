/* ============================================================================
   shot-fonts.js —— 字体改造对比截图（在独立空白页里构建，避免被页面 JS 覆盖）

   上一版直接在 doc-drafting.html 里 document.body.innerHTML = ...，
   结果被页面自己的渲染函数覆盖回去了（截图拍到的是真实页面而非对比板）。

   本版改为：导航到 about:blank，注入 app.css（真实样式表），再构建对比板。
   这样既能拿到真实 CSS，又不会被任何页面脚本干扰。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var CSS = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/css/app.css';
var OUTDIR = path.join(__dirname, 'shots');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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

(async function () {
  if (!fs.existsSync(OUTDIR)) { fs.mkdirSync(OUTDIR, { recursive: true }); }

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1180, height: 1150, deviceScaleFactor: 2, mobile: false });
  await send('Page.navigate', { url: 'about:blank' });
  await sleep(500);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 500) }; }
    return r.result.result.value;
  }
  async function shoot(name) {
    var s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
    fs.writeFileSync(path.join(OUTDIR, name), Buffer.from(s.result.data, 'base64'));
    console.log('✓ ' + name);
  }

  /* 建一个干净文档，且必须让 app.css 真的加载进来。
     ⚠️ 试过三种都失败，记录在此避免重蹈：
       1) <link href="file://...app.css"> 在 about:blank 文档里被安全策略拦掉
          —— 实测 body 拿到浏览器默认 "Noto Sans SC" 16px，证明 css 没进来。
       2) 先 documentElement.innerHTML='<head></head><body></body>' 再 appendChild(style)
          —— 设 innerHTML 会重建整个 head，把刚插的 style 一起抹掉，截图全白。
       3) 拼完整 HTML 字符串赋值给 documentElement.innerHTML（含 <style>）
          —— CSS 生效了（body 拿到 Segoe UI/14px），但**布局仍然全白**，
             疑因 documentElement 的 innerHTML 赋值不触发正常文档重建。

     ✅ 最终可靠方案：把对比板写成一个**真实的临时 html 文件**，放在与 app.css
        同盘同目录下（用相对路径引 css），然后导航过去截图，截完删文件。
        这样 origin 是 file://，css 是普通同源子资源，一切按正常流程加载。 */
  var TEST_HTML = 'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/css/_fonttest.html';

  async function render(html, name) {
    fs.writeFileSync(TEST_HTML,
      '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<link rel="stylesheet" href="app.css">' +
      '<style>html,body{margin:0;background:#eef1f5}</style>' +
      '</head><body></body></html>', 'utf8');
    await send('Page.navigate', { url: 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/css/_fonttest.html' });
    await sleep(900);
    var chk = await ev("JSON.stringify({ff:getComputedStyle(document.body).fontFamily,fs:getComputedStyle(document.body).fontSize,sheets:document.styleSheets.length,href:location.href})");
    var r = await ev([
      "(function(){",
      "  var H = " + JSON.stringify(html) + ";",
      "  if (typeof H !== 'string' || !H.length) { return 'BAD_HTML type=' + (typeof H) + ' len=' + (H && H.length); }",
      "  document.body.innerHTML = H;",
      "  return 'ok len=' + document.body.innerHTML.length;",
      "})()"
    ].join('\n'));
    if (r && (r.__err || String(r).indexOf('BAD_HTML') === 0)) { console.log('ERR render ' + name + ' ' + (r.__err || r)); }
    else { console.log('   inject-> ' + r); }
    await sleep(800);
    /* ⚠️ 截图参数踩过两个坑，记录避免重蹈：
       1) captureBeyondViewport:true —— 当 body 高度 < 视口高度时截出**全白图**
          （font-1/font-2 中招，只有内容超出视口的 font-3 侥幸正常）。
       2) clip:{...scale:2} —— 与 deviceScaleFactor:2 叠加同样出全白图。
       ✅ 可靠做法：直接 captureScreenshot({format:'png'})，
          分辨率交给 Emulation.setDeviceMetricsOverride 的 deviceScaleFactor 控制，
          宽高交给 viewport 控制。 */
    var s = await send('Page.captureScreenshot', { format: 'png' });
    var p = path.join(OUTDIR, name);
    fs.writeFileSync(p, Buffer.from(s.result.data, 'base64'));
    console.log('✓ ' + name + '  bytes=' + fs.statSync(p).size);
  }

  var DOC_JS = JSON.stringify(DOC);
  var LAW_JS = JSON.stringify(LAW);

  /* ---------- 1. 文书正文对比 ---------- */
  var h1 = await ev([
    "(function(){",
    "  var DOC = " + DOC_JS + ";",
    "  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }",
    "  function bodyHtml(cls){",
    "    var lines = DOC.split('\\n'), out = [];",
    "    for (var i=0;i<lines.length;i++){",
    "      var ln = lines[i];",
    "      if (/^[\\u3000\\s]{6,}\\S/.test(ln) && ln.replace(/[\\u3000\\s]/g,'').length <= 40) {",
    "        out.push('<span class=\"zf-doc__sign\">' + esc(ln.replace(/^[\\u3000\\s]+/,'')) + '</span>');",
    "      } else { out.push(esc(ln)); }",
    "    }",
    "    return '<div class=\"' + cls + '\">' + out.join('\\n') + '</div>';",
    "  }",
    "  function col(label, note, cls){",
    "    return '<td style=\"width:510px;vertical-align:top;padding:0 11px\">' +",
    "      '<div style=\"font-size:13px;font-weight:700;color:#0e1115;margin:0 0 3px\">' + label + '</div>' +",
    "      '<div style=\"font-size:11.5px;color:#7f8d9f;margin:0 0 10px;line-height:1.55;height:38px\">' + note + '</div>' +",
    "      bodyHtml(cls) + '</td>';",
    "  }",
    "  return '<div style=\"padding:22px 26px\">' +",
    "    '<h1 style=\"font-size:19px;margin:0 0 3px;font-weight:700\">文书正文：字体改造前后</h1>' +",
    "    '<p style=\"font-size:12px;color:#7f8d9f;margin:0 0 18px\">同一段法律文书 · 左为改造前（继承全站无衬线）· 右为改造后（纸面态衬线栈）</p>' +",
    "    '<table style=\"border-collapse:separate;border-spacing:0\"><tr>' +",
    "      col('改造前（.zf-doc）', '继承全站无衬线栈<br>13.5px / 行高 1.9 / 字距 normal / 底色 #fafbfc / 1px 边框', 'zf-doc'),",
    "      col('改造后（.zf-doc--sheet）', '衬线栈 Georgia → Cambria → 宋体<br>14.5px / 行高 2.0 / 字距 .02em / 白底 + 投影', 'zf-doc zf-doc--sheet'),",
    "    '</tr></table></div>';",
    "})()"
  ].join('\n'));
  if (h1 && h1.__err) { console.log('ERR1 ' + h1.__err); } else { await render(h1, 'font-1-doc.png'); }

  /* ---------- 2. 法条区对比 ---------- */
  var h2 = await ev([
    "(function(){",
    "  var LAW = " + LAW_JS + ";",
    "  function law(cls, label, note){",
    "    return '<td style=\"width:510px;vertical-align:top;padding:0 11px\">' +",
    "      '<div style=\"font-size:13px;font-weight:700;margin:0 0 3px\">' + label + '</div>' +",
    "      '<div style=\"font-size:11.5px;color:#7f8d9f;margin:0 0 10px;line-height:1.55;height:38px\">' + note + '</div>' +",
    "      '<div class=\"zf-law\" style=\"margin-top:0\">' +",
    "      '<div class=\"zf-law__name\">《中华人民共和国劳动合同法》第四十条</div>' +",
    "      '<div class=\"zf-law__text\"><strong>无过失性辞退</strong></div>' +",
    "      '<div class=\"zf-law__text\">' + LAW + '</div></div></td>';",
    "  }",
    "  return '<div style=\"padding:22px 26px\">' +",
    "    '<h1 style=\"font-size:19px;margin:0 0 3px;font-weight:700\">法条引用区：字体改造前后</h1>' +",
    "    '<p style=\"font-size:12px;color:#7f8d9f;margin:0 0 18px\">用衬线区分「正文」与「引文」，是版式语言的通用做法，无需额外加边框</p>' +",
    "    '<table style=\"border-collapse:separate;border-spacing:0\"><tr>' +",
    "      law('zf-law-wrap', '改造前', '全站无衬线栈<br>12.5px / 行高 1.65 / 字距 normal'),",
    "      law('zf-law-wrap prose-test', '改造后', '衬线栈（Georgia → 宋体）<br>12.5px / 行高 1.8 / 字距 normal'),",
    "    '</tr></table></div>';",
    "})()"
  ].join('\n'));
  if (h2 && h2.__err) { console.log('ERR2 ' + h2.__err); }
  else {
    /* 先把左列还原（去掉衬线），右列保留 —— 用注入样式做局部覆盖 */
    await ev([
      "(function(){",
      "  var st=document.createElement('style');",
      "  st.textContent='.prose-test .zf-law__name,.prose-test .zf-law__text{font-family:Georgia,Cambria,\"Times New Roman\",\"Source Han Serif SC\",SimSun,\"Microsoft YaHei\",serif;line-height:1.8}';",
      "  document.head.appendChild(st);",
      "  return 'ok';",
      "})()"
    ].join('\n'));
    await render(h2, 'font-2-law.png');
  }

  /* ---------- 3. 数字表 ---------- */
  var h3 = await ev([
    "(function(){",
    "  function row(fam, label, hl){",
    "    var bg = hl ? ';background:#f0f7ff' : '';",
    "    return '<tr>' +",
    "      '<td style=\"padding:9px 14px;font-size:12px;color:#7f8d9f;white-space:nowrap;border-bottom:1px solid #e7eaef' + bg + '\">' + label + '</td>' +",
    "      '<td style=\"padding:9px 14px;font-family:' + fam + ';font-size:26px;font-weight:700;border-bottom:1px solid #e7eaef;white-space:pre' + bg + '\">4 2 2 5</td>' +",
    "      '<td style=\"padding:9px 14px;font-family:' + fam + ';font-size:20px;border-bottom:1px solid #e7eaef;white-space:pre' + bg + '\">1111111111</td>' +",
    "      '<td style=\"padding:9px 14px;font-family:' + fam + ';font-size:20px;border-bottom:1px solid #e7eaef;white-space:pre' + bg + '\">8888888888</td>' +",
    "      '<td style=\"padding:9px 14px;font-family:' + fam + ';font-size:20px;border-bottom:1px solid #e7eaef;white-space:pre' + bg + '\">2026-09-13</td>' +",
    "      '</tr>';",
    "  }",
    "  function th(t){ return '<th style=\"padding:10px 14px;font-size:11.5px;font-weight:600;color:#7f8d9f;text-align:left;border-bottom:1px solid #e7eaef\">' + t + '</th>'; }",
    "  return '<div style=\"padding:22px 26px\">' +",
    "    '<h1 style=\"font-size:19px;margin:0 0 3px;font-weight:700\">数字排版：为什么数字位坚持无衬线</h1>' +",
    "    '<p style=\"font-size:12px;color:#7f8d9f;margin:0 0 16px;line-height:1.65\">' +",
    "      '看第 3、4 列：<b>Segoe UI / 雅黑 / Consolas 的「1111111111」与「8888888888」左右边缘完全对齐</b>；' +",
    "      '而 Georgia / Times New Roman 的 1 明显比 8 窄 —— 这类比例数字放进指标卡会让数字左右抖动。' +",
    "    '</p>' +",
    "    '<table style=\"border-collapse:separate;border-spacing:0;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 14px rgba(14,17,21,.08)\">' +",
    "    '<tr style=\"background:#f7f9fc\">' + th('字体栈') + th('指标卡数字 26px/700') + th('数字串 A') + th('数字串 B') + th('日期串') + '</tr>' +",
    "    row(\"'Segoe UI',sans-serif\", 'Segoe UI ← 当前数字位', true) +",
    "    row(\"'Microsoft YaHei',sans-serif\", '微软雅黑') +",
    "    row('Consolas,monospace', 'Consolas（等宽）') +",
    "    row('Georgia,serif', 'Georgia（衬线）') +",
    "    row(\"'Times New Roman',serif\", 'Times New Roman（衬线）') +",
    "    '</table></div>';",
    "})()"
  ].join('\n'));
  if (h3 && h3.__err) { console.log('ERR3 ' + h3.__err); } else { await render(h3, 'font-3-num.png'); }

  /* 收尾：删掉临时测试文件，不留痕 */
  try { fs.unlinkSync(TEST_HTML); console.log('✓ 已清理临时文件 _fonttest.html'); }
  catch (e) { console.log('! 临时文件清理失败: ' + e.message); }

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });
