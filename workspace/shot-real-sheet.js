/* ============================================================================
   shot-real-sheet.js —— 真实页面截图：文书起草结果区（.zf-doc--sheet）

   与 shot-fonts2.js（人造对比页）不同，本脚本拍的是**真实业务路径**：
     doc-drafting.html → 选模板 → 填表 → 点「生成文书」→ 切到结果页签
   这样截图里就是真实的衬线宋体效果，而不是我手搓的演示块。

   同时拍 knowledge 文章弹窗（.zf-doc--prose）。
   【截图要点】captureScreenshot({format:'png'}) 不带任何额外参数 ——
   captureBeyondViewport / clip.scale 在本环境会截出全白图（已踩过）。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
var OUT = path.join(__dirname, 'shots');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

if (!fs.existsSync(OUT)) { fs.mkdirSync(OUT, { recursive: true }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      var ex = r.exceptionDetails;
      var msg = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text || '';
      return { __err: String(msg).slice(0, 400) };
    }
    return r.result.result.value;
  }
  async function shot(name) {
    /* 【坑】不传任何额外参数（captureBeyondViewport / clip 都会截出全白或返回空），
       且 deviceScaleFactor 必须为 1 —— 实测 2 会导致 data 为空。 */
    var r = await send('Page.captureScreenshot', { format: 'png' });
    /* 【口径】cdp.js 的 send() 返回的是**原始 CDP 报文**（{id, result}），
       不是 result 本身 —— 所以截图数据在 r.result.data，不是 r.data。
       （踩过：写成 r.data 会一直拿到 undefined。） */
    var d = r && r.result && r.result.data;
    if (!d) {
      console.log('  ✗ ' + name + ' 截图失败  keys=' + Object.keys(r || {}).join(',') +
        '  resultKeys=' + Object.keys((r && r.result) || {}).join(','));
      return 0;
    }
    var buf = Buffer.from(d, 'base64');
    fs.writeFileSync(path.join(OUT, name), buf);
    console.log('  ✓ ' + name + '  ' + buf.length + ' bytes');
    return buf.length;
  }

  /* ---------- 1. doc-drafting 结果区 ---------- */
  console.log('\n=== doc-drafting.html 文书起草（真实路径）===');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 940, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'doc-drafting.html' });
  await sleep(2200);
  await ev('document.querySelector("#template-grid .zf-tpl").click(); "ok"');
  await sleep(900);
  var fill = await ev([
    "(function(){",
    "  var fs = document.querySelectorAll('#doc-fill-form [data-ph]');",
    "  if (!fs.length) { return 'NO_FIELDS'; }",
    "  for (var i=0;i<fs.length;i++){",
    "    var f=fs[i], ph=f.getAttribute('data-ph'), v;",
    "    if (ph.indexOf('金额')>=0) v='128000.00';",
    "    else if (ph.indexOf('身份证')>=0) v='370102199503121234';",
    "    else if (ph.indexOf('电话')>=0||ph.indexOf('手机')>=0) v='13800000001';",
    "    else if (ph.indexOf('日期')>=0) v='2026-09-21';",
    "    else if (ph.indexOf('时间')>=0) v='2026年8月';",
    "    else if (ph.indexOf('事项')>=0||ph.indexOf('理由')>=0) v='请求裁决被申请人支付解除劳动合同经济补偿金，并支付未提前三十日通知的代通知金。';",
    "    else v='张三';",
    "    if (f.tagName==='SELECT'){ if (f.options.length>1) f.selectedIndex=1; } else { f.value=v; }",
    "    f.dispatchEvent(new Event('input',{bubbles:true}));",
    "    f.dispatchEvent(new Event('change',{bubbles:true}));",
    "  }",
    "  return 'FILLED:'+fs.length;",
    "})()"
  ].join('\n'));
  console.log('  填表: ' + fill);
  await sleep(400);
  await shot('real-1-fill.png');   /* 填写态先拍一张：无衬线 */
  await ev('document.getElementById("doc-generate").click(); "ok"');
  await sleep(1700);
  var chk = await ev([
    "(function(){",
    "  var s=document.querySelector('.zf-doc--sheet');",
    "  if(!s){ return 'NO_SHEET'; }",
    "  return 'SHEET ok  fx=' + getComputedStyle(s).fontFamily.slice(0,28) + '  signs=' + document.querySelectorAll('.zf-doc__sign').length;",
    "})()"
  ].join('\n'));
  console.log('  结果区: ' + chk);
  await shot('real-2-sheet.png');  /* 结果态：衬线宋体 */

  /* ---------- 2. knowledge 文章弹窗 ---------- */
  console.log('\n=== knowledge.html 文章弹窗（真实路径）===');
  await send('Emulation.setDeviceMetricsOverride', { width: 1100, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'knowledge.html' });
  await sleep(2100);
  var kn = await ev('document.querySelector("#article-list .zf-art").click(); "ok"');
  await sleep(1600);   /* Bootstrap .15s 过渡 + headless 合成，等够 */
  var kb = await ev([
    "(function(){",
    "  var p=document.querySelector('#article-modal-body .zf-doc--prose');",
    "  if(!p){ return 'NO_PROSE'; }",
    "  return 'PROSE ok  fx=' + getComputedStyle(p).fontFamily.slice(0,28) + '  len=' + p.textContent.length;",
    "})()"
  ].join('\n'));
  console.log('  弹窗: ' + kb);
  await shot('real-3-prose.png');

  /* ---------- 3. qa 法条引用区 ---------- */
  console.log('\n=== qa.html 法条引用区（真实路径）===');
  await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'qa.html' });
  await sleep(2100);
  await shot('real-4-qa.png');

  await send('Emulation.clearDeviceMetricsOverride');
  console.log('\n全部截图已输出到 workspace/shots/');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });
