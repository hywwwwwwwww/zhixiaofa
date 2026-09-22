/* ============================================================================
   diag-serif-order.js —— 衬线栈排序 A/B：把 Noto Serif SC 插到什么位置？

   已确认可用（注册表 + 文件双证）的中文衬线候选：
     · Noto Serif SC   -> NotoSerifSC-VF.ttf (25.1MB, 可变字重)  ★ 现代宋体，屏幕渲染最佳
     · SimSun          -> simsun.ttc        (18.1MB)             传统宋体，小字号发虚
     · STSong 华文宋体 -> STSONG.TTF        (11.7MB)

   西文衬线候选：
     · Georgia  (有真 Bold, 拉丁 79.438)
     · Cambria  (屏幕渲染优化, 80.297)
     · Times New Roman (伪粗体, 72.5)

   本脚本对比两个候选栈在真实元素上的表现：
     A（现状）Georgia, Cambria, TNR, "Source Han Serif SC", SimSun, "Microsoft YaHei", serif
     B（提案）Georgia, "Noto Serif SC", Cambria, "Times New Roman", SimSun, "Microsoft YaHei", serif
   量：拉丁段命中、中文段可区分性、元素总高（换字体是否引起行高/断行变化）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/';
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var STACK_A = 'Georgia, Cambria, "Times New Roman", "Source Han Serif SC", SimSun, "Microsoft YaHei", serif';
var STACK_B = 'Georgia, "Noto Serif SC", Cambria, "Times New Roman", SimSun, "Microsoft YaHei", serif';
var STACK_C = '"Noto Serif SC", Georgia, Cambria, "Times New Roman", SimSun, "Microsoft YaHei", serif';

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null, i;
  for (i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url.indexOf('devtools://') < 0) { target = tabs[i]; break; }
  }
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE + 'home.html' });
  await sleep(2200);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 400) }; }
    return r.result.result.value;
  }

  var PROBE = [
    "(function(){",
    "  var FAKE='__ZF_NoSuchFont_9__';",
    "  var R=document.createElement('span');",
    "  R.style.cssText='position:absolute;left:-99999px;visibility:hidden;white-space:pre;letter-spacing:normal;';",
    "  R.style.fontSize='14.5px'; R.style.fontWeight='400';",
    "  document.body.appendChild(R);",
    "  function w(spec,t){ R.style.fontFamily=spec; R.textContent=t;",
    "    return Math.round(R.getBoundingClientRect().width*1000)/1000; }",
    "  var out={ fake: w('\"'+FAKE+'\"','0123456789') };",
    "  var STACKS = {",
    "    A: " + JSON.stringify(STACK_A) + ",",
    "    B: " + JSON.stringify(STACK_B) + ",",
    "    C: " + JSON.stringify(STACK_C),
    "  };",
    "  out.stacks = {};",
    "  Object.keys(STACKS).forEach(function(k){",
    "    out.stacks[k] = { lat: w(STACKS[k],'0123456789'), cn: w(STACKS[k],'汉字的宽度测试'),",
    "                      mix: w(STACKS[k],'汉字的宽度测试2026年9月'), spec: STACKS[k] };",
    "  });",
    "  /* 逐候选单独量，找出每栈的拉丁段命中 */",
    "  var cands=['Georgia','Cambria','Times New Roman','Noto Serif SC','Source Han Serif SC',",
    "             'SimSun','STSong','Microsoft YaHei'];",
    "  out.solo={};",
    "  for (var j=0;j<cands.length;j++){ out.solo[cands[j]] = w('\"'+cands[j]+'\", \"'+FAKE+'\"','0123456789'); }",
    "  out.hits={};",
    "  Object.keys(out.stacks).forEach(function(k){",
    "    var target=out.stacks[k].lat, hs=[];",
    "    Object.keys(out.solo).forEach(function(f){",
    "      if (Math.abs(out.solo[f]-target)<0.01 && Math.abs(out.solo[f]-out.fake)>=0.01) { hs.push(f); }",
    "    });",
    "    out.hits[k]=hs;",
    "  });",
    "  /* 真实元素：把三套栈依次挂到一个多行中文块上，量高度与断行 */",
    "  var SAMPLE='申请人于2021年7月1日入职被申请人处，双方签订书面劳动合同，约定月工资为16,000.00元。2026年9月13日，被申请人以「组织架构调整」为由单方解除劳动合同，未提前三十日通知。';",
    "  var host=document.createElement('div');",
    "  host.style.cssText='position:absolute;left:-99999px;top:0;width:420px;font-size:14.5px;line-height:2;';",
    "  document.body.appendChild(host);",
    "  out.block={};",
    "  Object.keys(STACKS).forEach(function(k){",
    "    host.style.fontFamily=STACKS[k];",
    "    host.textContent=SAMPLE;",
    "    var r=host.getBoundingClientRect();",
    "    /* 行数 = 高度 / 行高 */",
    "    out.block[k]={ h: Math.round(r.height*100)/100, lines: Math.round(r.height/29) };",
    "  });",
    "  document.body.removeChild(host);",
    "  document.body.removeChild(R);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var r = await ev(PROBE);
  if (r && r.__err) { console.log('ERR ' + r.__err); process.exit(1); }
  var d = JSON.parse(r);

  console.log('===== 衬线栈 A/B/C 对比 @14.5px/400 =====');
  console.log('  假字体兜底 LAT = ' + d.fake);
  console.log('');
  console.log('  ' + pad('栈', 4) + pad('LAT', 10) + pad('CN(8字)', 10) + pad('MIX(13字)', 12) + '拉丁段命中');
  ['A', 'B', 'C'].forEach(function (k) {
    var s = d.stacks[k];
    console.log('  ' + pad(k, 4) + pad(s.lat, 10) + pad(s.cn, 10) + pad(s.mix, 12) +
      (d.hits[k].length ? d.hits[k].join('+') : '(未识别)'));
  });

  console.log('\n===== 各栈完整声明 =====');
  ['A', 'B', 'C'].forEach(function (k) { console.log('  ' + k + ': ' + d.stacks[k].spec); });

  console.log('\n===== 逐候选单独量（LAT 10位数字）=====');
  var pairs = Object.keys(d.solo).map(function (f) { return [f, d.solo[f]]; });
  pairs.sort(function (a, b) { return a[1] - b[1]; });
  pairs.forEach(function (p) {
    console.log('  ' + pad(p[0], 24) + p[1] + (Math.abs(p[1] - d.fake) < 0.01 ? '   ← 等于兜底' : ''));
  });

  console.log('\n===== 真实多行中文块（420px 宽，line-height:2）=====');
  console.log('  ' + pad('栈', 4) + pad('块高', 10) + '推算行数');
  ['A', 'B', 'C'].forEach(function (k) {
    console.log('  ' + pad(k, 4) + pad(d.block[k].h, 10) + d.block[k].lines);
  });
  var ha = d.block.A.h, hb = d.block.B.h, hc = d.block.C.h;
  console.log('\n  A→B 高差 = ' + (Math.round((hb - ha) * 100) / 100) + 'px');
  console.log('  A→C 高差 = ' + (Math.round((hc - ha) * 100) / 100) + 'px');
  console.log('  （全角中文恒 1em，理论上三栈中文行数应当一致；' +
    '若不同说明拉丁段宽度差异导致了断行点漂移）');
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
