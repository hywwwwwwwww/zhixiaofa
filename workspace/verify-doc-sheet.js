/* ============================================================================
   verify-doc-sheet.js —— 纸面态/阅读态字体专项实测

   为什么单独测：.zf-doc--sheet 与 .zf-doc--prose 都是「有数据才渲染」的元素，
   空态页面里根本不存在，上面那轮 verify-fonts.js 自然测不到（报告里这两个键
   是 null）。这里直接往页面里注入带这两个类的节点，量真实渲染结果。

   验证：
     1. 计算 font-family 是不是新衬线栈
     2. 实际命中的字体（**必须用纯 DOM 同口径对照**，见下方警告）
     3. 与旧栈（雅黑）相比，正文块的宽度差与高度差
     4. 窄屏（560）下会不会因 letter-spacing / 字号增大而溢出

   ⚠️【口径修正 —— 重要】本脚本早期版本用「canvas 逐项量宽 vs DOM 实测」判字体，
   结果误报为 Cambria。根因：**canvas 不会像 DOM 那样解析完整 font-family 栈**——
   把完整栈喂给 canvas 量 10 位数字得 55.5px，而同一元素同一字号的 DOM 得 79.44px，
   差 24px。两个数字根本不在同一口径上，比较无意义。
   现已改为：量尺也用 DOM span（候选字体写成 `"候选", "假字体"`），
   与真实元素的栈在同一口径下比对，**精确等宽（<0.01）且不等于假字体兜底**才算命中。
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* 一段有代表性的文书正文：标题 + 法条引用 + 日期 + 金额 + 落款 */
var SAMPLE = [
  '劳动仲裁申请书',
  '',
  '申请人：张三，男，1995年3月12日出生，汉族，住济南市历下区。',
  '被申请人：某某科技有限公司，住所地济南市高新区。',
  '',
  '请求事项：',
  '一、请求裁决被申请人支付解除劳动合同经济补偿金￥128,000.00元；',
  '二、请求裁决被申请人支付2026年8月至2026年9月期间工资合计23,500.00元。',
  '',
  '事实与理由：',
  '申请人于2021年7月1日入职被申请人处，双方签订书面劳动合同，约定月工资为16,000.00元。',
  '2026年9月13日，被申请人以"组织架构调整"为由单方解除劳动合同，未提前三十日通知，',
  '亦未依法支付经济补偿金。依据《中华人民共和国劳动合同法》第四十条、第四十六条之规定，',
  '被申请人应当支付经济补偿金。',
  '',
  '此致',
  '济南市劳动人事争议仲裁委员会',
  '',
  '　　　　　　　　　　　　　　　　　　申请人：张三',
  '　　　　　　　　　　　　　　　　　　2026年9月21日'
].join('\n');

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

  function safeStr(v, n) {
    var t;
    try { t = (typeof v === 'string') ? v : JSON.stringify(v); } catch (e) { t = String(v); }
    if (t === undefined || t === null) { t = String(v); }
    return t.slice(0, n || 300);
  }
  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) {
      /* 把页面侧的异常文本挖出来，别只留一句 "undefined is not valid JSON" */
      var ex = r.exceptionDetails;
      var msg = (ex.exception && (ex.exception.description || ex.exception.value)) || ex.text || '';
      return { __err: safeStr(msg, 600) };
    }
    return r.result.result.value;
  }

  var SAMPLE_JS = JSON.stringify(SAMPLE);
  var fails = [];

  var probe = [
    "(function(){",
    "  var SAMPLE = " + SAMPLE_JS + ";",
    "  var host = document.createElement('div');",
    "  host.style.cssText = 'position:absolute;left:0;top:0;width:100%;z-index:-1;visibility:hidden;';",
    "  document.body.appendChild(host);",
    "  function build(cls){",
    "    var d = document.createElement('div');",
    "    d.className = cls;",
    "    var lines = SAMPLE.split('\\n');",
    "    var html = [];",
    "    for (var i=0;i<lines.length;i++){",
    "      var ln = lines[i];",
    "      if (/^[\\u3000\\s]{6,}\\S/.test(ln) && ln.replace(/[\\u3000\\s]/g,'').length <= 40) {",
    "        html.push('<span class=\"zf-doc__sign\">' + esc(ln.replace(/^[\\u3000\\s]+/,'')) + '</span>');",
    "      } else { html.push(esc(ln)); }",
    "    }",
    "    d.innerHTML = html.join('\\n');",
    "    return d;",
    "  }",
    "  function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }",
    "",
    "  var out = { vw: window.innerWidth };",
    "  /* 纯 DOM 量尺：脱离文档流、强制 letter-spacing:normal，与真实元素同口径 */",
    "  var R = document.createElement('span');",
    "  R.style.cssText = 'position:absolute;left:-99999px;top:0;visibility:hidden;white-space:pre;letter-spacing:normal;';",
    "  document.body.appendChild(R);",
    "  function w(spec,t,px,wt){ R.style.fontSize=(px||14)+'px'; R.style.fontWeight=(wt||400)+'';",
    "    R.style.fontFamily=spec; R.textContent=t; return Math.round(R.getBoundingClientRect().width*1000)/1000; }",
    "  var FAKE='__ZF_NoSuchFont_9__';",
    "  out.ref = { fake: w('\"'+FAKE+'\"','0123456789',14),",
    "              simsun: w('\"SimSun\", \"'+FAKE+'\"','0123456789',14),",
    "              yahei: w('\"Microsoft YaHei\", \"'+FAKE+'\"','0123456789',14),",
    "              georgia: w('\"Georgia\", \"'+FAKE+'\"','0123456789',14),",
    "              cambria: w('\"Cambria\", \"'+FAKE+'\"','0123456789',14) };",
    "",
    "  var cases = [",
    "    ['sheet', 'zf-doc zf-doc--sheet'],",
    "    ['sheet-plain', 'zf-doc zf-doc--plain zf-doc--sheet'],",
    "    ['prose', 'zf-doc zf-doc--plain zf-doc--prose'],",
    "    ['plain-old', 'zf-doc zf-doc--plain'],",
    "    ['baseline', 'zf-doc']",
    "  ];",
    "  out.cases = {};",
    "  cases.forEach(function(c){",
    "    var el = build(c[1]);",
    "    host.appendChild(el);",
    "    var cs = getComputedStyle(el);",
    "    var r = el.getBoundingClientRect();",
    "    // 量正文里第一行英文数字串的真实宽度",
    "    var sp = document.createElement('span');",
    "    sp.style.cssText='position:absolute;white-space:pre;';",
    "    sp.style.fontFamily = cs.fontFamily; sp.style.fontSize = cs.fontSize;",
    "    sp.textContent = '0123456789';",
    "    el.appendChild(sp);",
    "    var dW = Math.round(sp.getBoundingClientRect().width*100)/100;",
    "    sp.textContent = '2026';",
    "    var yW = Math.round(sp.getBoundingClientRect().width*100)/100;",
    "    sp.textContent = '审查合同';",
    "    var cW = Math.round(sp.getBoundingClientRect().width*100)/100;",
    "    el.removeChild(sp);",
    "    /* 【关键】同字号对照：不能用绝对阈值判字体，因为字号变了宽度必然变",
    "       （--sheet 是 14.5px，基线是 13.5px，同一字体的宽度天然不同）。",
    "       改为「在同一字号下」把当前栈与候选字体逐个对比，最接近的就是实际命中。 */",
    "    var px = parseFloat(cs.fontSize);",
    "    /* 【同口径对照】量尺与真实元素都走 DOM；候选写成 `\"候选\", \"假名\"`。",
    "       注意必须剥离 letter-spacing：量尺永远 normal，而真实元素带字距，",
    "       所以 dW 也要在 normal 字距下重测一遍（见下方 dW0）。 */",
    "    var probe2 = document.createElement('span');",
    "    probe2.style.cssText='position:absolute;left:-99999px;visibility:hidden;white-space:pre;letter-spacing:normal;';",
    "    probe2.style.fontFamily = cs.fontFamily;",
    "    probe2.style.fontSize = cs.fontSize; probe2.style.fontWeight = cs.fontWeight;",
    "    probe2.textContent = '0123456789';",
    "    host.appendChild(probe2);",
    "    var dW0 = Math.round(probe2.getBoundingClientRect().width*1000)/1000;",
    "    host.removeChild(probe2);",
    "    var ctr = {}, hits = [], near = [];",
    "    ['Georgia','Cambria','Times New Roman','Noto Serif SC','Source Han Serif SC',",
    "     'SimSun','NSimSun','STSong','Microsoft YaHei','Segoe UI','Tahoma','Consolas'",
    "    ].forEach(function(f){",
    "      ctr[f] = w('\"'+f+'\", \"'+FAKE+'\"', '0123456789', px, cs.fontWeight);",
    "    });",
    "    Object.keys(ctr).forEach(function(f){",
    "      var dd = ctr[f] - dW0;",
    "      if (Math.abs(dd) < 0.01 && Math.abs(ctr[f] - out.ref.fake) >= 0.01) { hits.push(f); }",
    "      else { near.push(f + '=' + ctr[f] + '(Δ' + dd.toFixed(2) + ')'); }",
    "    });",
    "    function ad(x){ var m=x.match(/Δ(-?[\d.]+)/); return m?Math.abs(parseFloat(m[1])):999; }",
    "    near.sort(function(a,b){ return ad(a)-ad(b); });",
    "    var best = hits.length ? hits.join('+') : '(未识别)';",
    "    var bestD = hits.length ? 0 : (near.length ? ad(near[0]) : -1);",
    "    /* 中文全角字符恒为 1em，所以 4 个字 = px*4；但若元素带 letter-spacing，",
    "       每个字后都会追加字距，必须一起算进去（首字符前不加，故为 4 倍而非 5 倍）。 */",
    "    var lsPx = (cs.letterSpacing && cs.letterSpacing !== 'normal') ? parseFloat(cs.letterSpacing) : 0;",
    "    if (isNaN(lsPx)) { lsPx = 0; }",
    "    out.cases[c[0]] = { ff: cs.fontFamily, px: px, lh: cs.lineHeight, dW0: dW0, hits: hits,",
    "                        ls: cs.letterSpacing, color: cs.color, w: Math.round(r.width*100)/100,",
    "                        h: Math.round(r.height*100)/100, dW: dW, yW: yW, cW: cW,",
    "                        ctr: ctr, best: best, bestD: Math.round(bestD*100)/100, near: near.slice(0,4),",
    "                        cnExpect: Math.round((px * 4 + lsPx * 4) * 1000) / 1000 };",
    "    host.removeChild(el);",
    "  });",
    "  // 落款行几何",
    "  var signEl = build('zf-doc zf-doc--sheet');",
    "  host.appendChild(signEl);",
    "  var sign = signEl.querySelector('.zf-doc__sign');",
    "  if (sign) {",
    "    var sr = sign.getBoundingClientRect(), pr = signEl.getBoundingClientRect();",
    "    var scs = getComputedStyle(sign);",
    "    out.sign = { text: sign.textContent, ta: scs.textAlign, pr: scs.paddingRight,",
    "                 rightGap: Math.round((pr.right - sr.right)*100)/100, mt: scs.marginTop };",
    "  } else { out.sign = null; }",
    "  host.removeChild(signEl);",
    "  host.parentNode.removeChild(host);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var VPS = [[1440, 900], [820, 800], [560, 800]];
  var all = [];

  for (var vi = 0; vi < VPS.length; vi++) {
    await send('Emulation.setDeviceMetricsOverride',
      { width: VPS[vi][0], height: VPS[vi][1], deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: BASE + 'doc-drafting.html' });
    await sleep(1700);
    var raw = await ev(probe);
    if (raw && raw.__err) { console.log('ERR ' + raw.__err); fails.push('注入失败: ' + raw.__err); continue; }
    if (typeof raw !== 'string') {
      console.log('ERR 探针未返回字符串: ' + safeStr(raw, 200));
      fails.push('探针返回类型异常'); continue;
    }
    var d = JSON.parse(raw);
    d.vp = VPS[vi];
    /* 【记忆 #22】自查文档路径 */
    all.push(d);
  }

  console.log('=================== [参考] 14px 下 10 位数字宽度 ===================');
  console.log('  纯DOM同口径 @14px: 假字体兜底=' + all[0].ref.fake +
    '  SimSun=' + all[0].ref.simsun + '  Georgia=' + all[0].ref.georgia +
    '  Cambria=' + all[0].ref.cambria + '  YaHei=' + all[0].ref.yahei);
  console.log('  （与假字体兜底等宽者为「不存在/落兜底」；命中判定见下）');

  all.forEach(function (d) {
    console.log('\n=================== 视口 ' + d.vp[0] + 'x' + d.vp[1] + ' ===================');
    ['baseline', 'plain-old', 'sheet', 'sheet-plain', 'prose'].forEach(function (k) {
      var c = d.cases[k];
      if (!c) { return; }
      console.log('\n  [' + pad(k, 12) + '] ' + c.px + 'px  lh=' + pad(c.lh, 8) + ' ls=' + pad(c.ls, 9) +
        ' 尺寸=' + c.w + 'x' + c.h);
      console.log('      ff = ' + c.ff.split(',')[0] + ', ' + c.ff.split(',')[1] + ' ...');
      console.log('      实测(normal字距) 10位=' + pad(c.dW0, 8) + '中文"审查合同"=' + c.cW +
        '  (全角理论 ' + c.cnExpect + ')');
      console.log('      次接近: ' + (c.near || []).join('  '));
      console.log('      → 精确命中: ' + c.best);
      /* 中文宽度校验：全角字符在任意字体下恒等于 1em，所以 cW 必须 = px*4 */
      var cnErr = Math.abs(c.cW - c.cnExpect);
      if (cnErr > 0.6) { fails.push(k + ' 中文宽度 ' + c.cW + ' 偏离理论值 ' + c.cnExpect); }
    });
    if (d.sign) {
      console.log('\n  [落款行] text="' + d.sign.text + '"');
      console.log('      text-align=' + d.sign.ta + '  padding-right=' + d.sign.pr +
        '  margin-top=' + d.sign.mt);
      console.log('      右缘到纸面右缘距离 = ' + d.sign.rightGap + 'px');
      if (d.sign.ta !== 'right') { fails.push('落款行 text-align 不是 right'); }
    }
  });

  /* ---- 判定：一律基于「同字号对照」，不用绝对阈值 ---- */
  var sheet = all[0].cases['sheet'];
  var base = all[0].cases['baseline'];
  var prose = all[0].cases['prose'];
  var plainOld = all[0].cases['plain-old'];
  console.log('\n=================== 结论 ===================');
  console.log('  基线（.zf-doc，旧字体）  : ' + base.px + 'px  命中 ' + base.best + '（差 ' + base.bestD + '）');
  console.log('  .zf-doc--sheet           : ' + sheet.px + 'px  命中 ' + sheet.best + '（差 ' + sheet.bestD + '）');
  console.log('  .zf-doc--prose           : ' + prose.px + 'px  命中 ' + prose.best + '（差 ' + prose.bestD + '）');
  console.log('  .zf-doc--plain（未挂）    : ' + plainOld.px + 'px  命中 ' + plainOld.best + '（差 ' + plainOld.bestD + '）');

  var SERIF_SET = ['Georgia', 'Cambria', 'Times New Roman', 'Noto Serif SC', 'SimSun', 'NSimSun', 'STSong'];
  function isSerif(x) {
    if (!x.hits || !x.hits.length) { return false; }
    for (var i = 0; i < x.hits.length; i++) { if (SERIF_SET.indexOf(x.hits[i]) >= 0) { return true; } }
    return false;
  }
  if (isSerif(sheet)) {
    console.log('\n  ✓ .zf-doc--sheet 实际命中衬线字体：' + sheet.best);
  } else {
    console.log('\n  ✗ .zf-doc--sheet 命中的不是衬线：' + sheet.best);
    fails.push('sheet 命中 ' + sheet.best);
  }
  if (isSerif(prose)) {
    console.log('  ✓ .zf-doc--prose 实际命中衬线字体：' + prose.best);
  } else {
    console.log('  ✗ .zf-doc--prose 命中的不是衬线：' + prose.best);
    fails.push('prose 命中 ' + prose.best);
  }
  /* 作用域泄漏检查：--plain 没挂 --prose 时必须还是无衬线 */
  if (plainOld.hits && (plainOld.hits.indexOf('Segoe UI') >= 0 || plainOld.hits.indexOf('Microsoft YaHei') >= 0)) {
    console.log('  ✓ .zf-doc--plain（未挂修饰符）保持无衬线：' + plainOld.best + ' —— 作用域未泄漏');
  } else {
    console.log('  ✗ .zf-doc--plain 被污染成 ' + plainOld.best + ' —— 作用域泄漏！');
    fails.push('--plain 作用域泄漏');
  }
  /* 字号确实提升到 14.5 */
  if (Math.abs(sheet.px - 14.5) < 0.01) { console.log('  ✓ .zf-doc--sheet 字号 14.5px 生效（原 14px）'); }
  else { fails.push('sheet 字号 ' + sheet.px); }

  console.log('\n' + (fails.length ? '✗ ' + fails.length + ' 项失败:\n' + fails.map(function (f) { return '   - ' + f; }).join('\n') : '✓ 全部通过'));
  process.exit(fails.length ? 1 : 0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
