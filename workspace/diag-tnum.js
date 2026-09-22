/* ============================================================================
   diag-tnum.js —— 裁决 subagent 分歧：tabular-nums 对 Microsoft YaHei 是否生效

   分歧来源：
     方案 A（全局 UI）：「加，零成本，无效也无害」
     方案 C（数字西文）：「大概率无效，雅黑的 tnum 支持不完整，需实测」

   这个结论直接决定 .zf-stat__value（26px/700，首页 4 张指标卡）要不要靠
   tabular-nums 保证数字列不抖 —— 必须实测，不能靠猜。

   方法（比 subagent 给的 HTML 目测法更硬）：
     1. Canvas measureText 逐字符量宽 —— 若 tnum 生效，'1' 与 '8' 宽度必须相等
     2. DOM 实测：两个 div 各放 '1111111111' / '8888888888'，
        开/关 font-variant-numeric 各量一次，看右边缘是否重合
     3. 用 Consolas 做对照组（等宽字体必然逐字符等宽，证明测量链路本身有效）
   ============================================================================ */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9351;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) { return { __err: JSON.stringify(r.exceptionDetails).slice(0, 600) }; }
    return r.result.result.value;
  }

  var expr = [
    "(function(){",
    "  var FAKE='__ZF_NoSuchFont_1__';",
    "  var FONTS=['Microsoft YaHei','Segoe UI','Consolas','Arial','Times New Roman','SimSun'];",
    "  var g=document.createElement('canvas').getContext('2d');",
    "  var out={canvas:{},dom:{}};",
    "",
    "  // ---- [1] Canvas：逐字符宽度（tnum 生效时 1 与 8 必等宽） ----",
    "  FONTS.forEach(function(f){",
    "    var row={};",
    "    ['1','8','4','0'].forEach(function(ch){",
    "      g.font='700 26px \"'+f+'\", \"'+FAKE+'\"';",
    "      row[ch+'_tnum']=Math.round(g.measureText(ch).width*1000)/1000;",
    "      g.font='700 26px \"'+f+'\", \"'+FAKE+'" + "'"+";",
    "      row[ch+'_tnum2']=0;",
    "    });",
    "    out.canvas[f]=row;",
    "  });",
    "  return 'placeholder';",
    "})()"
  ].join('\n');

  /* 上面那条写得绕，改用更直白的两段式：先量 normal，再量 tnum */
  var exprCanvas = [
    "(function(){",
    "  var FAKE='__ZF_NoSuchFont_1__';",
    "  var FONTS=['Microsoft YaHei','Microsoft YaHei UI','Segoe UI','Consolas','Arial','Times New Roman','SimSun','Roboto'];",
    "  var g=document.createElement('canvas').getContext('2d');",
    "  var res={};",
    "  FONTS.forEach(function(f){",
    "    var normal={}, tnum={};",
    "    ['1','8','4','0','7'].forEach(function(ch){",
    "      g.font='700 26px \"'+f+'\", \"'+FAKE+'\"';",
    "      normal[ch]=Math.round(g.measureText(ch).width*1000)/1000;",
    "    });",
    "    // Canvas 无法直接设 font-variant-numeric（只能通过 fontVariantCaps 等有限项），",
    "    // 所以这里做「同字符串总宽」对比：'1111111111' vs '8888888888'",
    "    normal.all1=Math.round(g.measureText('1111111111').width*1000)/1000;",
    "    normal.all8=Math.round(g.measureText('8888888888').width*1000)/1000;",
    "    res[f]={perChar:normal, same1_8: Math.abs(normal.all1-normal.all8)<0.01};",
    "  });",
    "  return JSON.stringify(res);",
    "})()"
  ].join('\n');

  var cvRaw = await ev(exprCanvas);
  if (cvRaw && cvRaw.__err) { console.log('ERR canvas ' + cvRaw.__err); process.exit(1); }
  var cv = JSON.parse(cvRaw);

  console.log('=== [1] Canvas 逐字符宽度（26px/700，判断是否「天然等宽数字」）===');
  var f1, chs = ['1', '8', '4', '0', '7'];
  console.log(pad('font', 20) + chs.map(function (c) { return pad(c, 9); }).join('') +
    pad('1x10', 10) + pad('8x10', 10) + '天然等宽?');
  Object.keys(cv).forEach(function (f) {
    var r = cv[f];
    var row = pad(f, 20);
    chs.forEach(function (c) { row += pad(r.perChar[c], 9); });
    row += pad(r.perChar.all1, 10) + pad(r.perChar.all8, 10);
    row += r.same1_8 ? 'YES' : 'NO';
    console.log(row);
  });

  /* ---- [2] DOM 实测：真的开启 font-variant-numeric，量右边缘 ---- */
  var exprDom = [
    "(function(){",
    "  var FONTS=['Microsoft YaHei','Microsoft YaHei UI','Segoe UI','Consolas','Arial','Times New Roman','Roboto'];",
    "  var host=document.createElement('div');",
    "  host.style.cssText='position:absolute;left:-99999px;top:0;';",
    "  document.body.appendChild(host);",
    "  function measure(fam, fvn, text){",
    "    var d=document.createElement('div');",
    "    d.style.cssText='position:absolute;white-space:pre;font-size:26px;font-weight:700;';",
    "    d.style.fontFamily='\"'+fam+'\", \"__NO__\"';",
    "    if (fvn) d.style.fontVariantNumeric=fvn;",
    "    d.textContent=text;",
    "    host.appendChild(d);",
    "    var w=d.getBoundingClientRect().width;",
    "    host.removeChild(d);",
    "    return Math.round(w*1000)/1000;",
    "  }",
    "  var out={};",
    "  FONTS.forEach(function(f){",
    "    var a_n=measure(f,'','1111111111'), b_n=measure(f,'','8888888888');",
    "    var a_t=measure(f,'tabular-nums','1111111111'), b_t=measure(f,'tabular-nums','8888888888');",
    "    var a_f=measure(f,'tabular-nums lining-nums','1111111111'), b_f=measure(f,'tabular-nums lining-nums','8888888888');",
    "    out[f]={",
    "      normal:[a_n,b_n], tabs:[a_t,b_t], full:[a_f,b_f],",
    "      normalSame: Math.abs(a_n-b_n)<0.01,",
    "      tabsSame: Math.abs(a_t-b_t)<0.01,",
    "      fullSame: Math.abs(a_f-b_f)<0.01",
    "    };",
    "  });",
    "  host.parentNode.removeChild(host);",
    "  return JSON.stringify(out);",
    "})()"
  ].join('\n');

  var domRaw = await ev(exprDom);
  if (domRaw && domRaw.__err) { console.log('ERR dom ' + domRaw.__err); process.exit(1); }
  var dom = JSON.parse(domRaw);

  console.log('\n=== [2] DOM 实测：1111111111 vs 8888888888 右边缘是否重合（26px/700）===');
  console.log(pad('font', 20) + pad('normal(w1/w8)', 20) + pad('同宽?', 8) +
    pad('+tnum(w1/w8)', 20) + pad('同宽?', 8) + '结论');
  Object.keys(dom).forEach(function (f) {
    var r = dom[f];
    var concl;
    if (r.tabsSame && !r.normalSame) { concl = 'tnum 生效'; }
    else if (r.normalSame) { concl = '天然等宽（本就是等宽数字）'; }
    else if (!r.tabsSame && !r.normalSame) { concl = '!!! tnum 无效'; }
    else { concl = 'tnum 生效(本就同)'; }
    console.log(pad(f, 20) +
      pad(r.normal[0] + '/' + r.normal[1], 20) + pad(r.normalSame ? 'Y' : 'N', 8) +
      pad(r.tabs[0] + '/' + r.tabs[1], 20) + pad(r.tabsSame ? 'Y' : 'N', 8) + concl);
  });

  /* ---- [3] 落到真实元素上：.zf-stat__value ---- */
  var exprReal = [
    "(function(){",
    "  var el=document.querySelector('.zf-stat__value');",
    "  if(!el) return JSON.stringify({missing:true});",
    "  var cs=getComputedStyle(el);",
    "  // 逐字量真实元素的数字宽度",
    "  var host=document.createElement('div');",
    "  host.style.cssText='position:absolute;left:-99999px;top:0;';",
    "  document.body.appendChild(host);",
    "  function m(txt,fvn){",
    "    var d=document.createElement('div');",
    "    d.style.cssText='position:absolute;white-space:pre;';",
    "    d.style.font=cs.fontWeight+' '+cs.fontSize+'/'+cs.lineHeight+' '+cs.fontFamily;",
    "    if(fvn) d.style.fontVariantNumeric=fvn;",
    "    d.textContent=txt;",
    "    host.appendChild(d);",
    "    var w=d.getBoundingClientRect().width; host.removeChild(d);",
    "    return Math.round(w*1000)/1000;",
    "  }",
    "  var o={",
    "    ff:cs.fontFamily, px:cs.fontSize, wt:cs.fontWeight, fvn:cs.fontVariantNumeric,",
    "    n_1:m('1111111111',''), n_8:m('8888888888',''),",
    "    t_1:m('1111111111','tabular-nums'), t_8:m('8888888888','tabular-nums')",
    "  };",
    "  // 真实 4 张指标卡当前宽度",
    "  var vals=document.querySelectorAll('.zf-stat__value');",
    "  o.realVals=[];",
    "  for(var i=0;i<vals.length;i++){ o.realVals.push({t:vals[i].textContent.trim(), w:Math.round(vals[i].getBoundingClientRect().width*100)/100}); }",
    "  host.parentNode.removeChild(host);",
    "  return JSON.stringify(o);",
    "})()"
  ].join('\n');
  var realRaw = await ev(exprReal);
  var real = (realRaw && !realRaw.__err) ? JSON.parse(realRaw) : { err: realRaw && realRaw.__err };
  console.log('\n=== [3] 真实元素 .zf-stat__value ===');
  if (real.missing) { console.log('  missing（该页无此元素）'); }
  else if (real.err) { console.log('  ERR ' + real.err); }
  else {
    console.log('  ff=' + real.ff);
    console.log('  ' + real.px + '/' + real.wt + '  fvn=' + real.fvn);
    console.log('  normal : 1x10=' + real.n_1 + '  8x10=' + real.n_8 + '  → ' + (Math.abs(real.n_1 - real.n_8) < 0.01 ? '同宽' : '不等宽(差 ' + Math.abs(real.n_1 - real.n_8).toFixed(2) + 'px)'));
    console.log('  tnum   : 1x10=' + real.t_1 + '  8x10=' + real.t_8 + '  → ' + (Math.abs(real.t_1 - real.t_8) < 0.01 ? '同宽' : '不等宽(差 ' + Math.abs(real.t_1 - real.t_8).toFixed(2) + 'px)'));
    console.log('  真实 4 卡宽度: ' + JSON.stringify(real.realVals));
  }

  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.stack); process.exit(1); });

function pad(s, n) { s = String(s); while (s.length < n) { s += ' '; } return s; }
