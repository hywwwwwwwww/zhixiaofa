// verify-hitarea.js —— 证明「视觉小目标」的热区真的扩到了 44×44
// 用 elementFromPoint 打点：从元素中心向上下各 20px 处，
// 命中元素必须仍是它自己（或它内部的后代），才算热区生效。
//
// 【关键坑】必须先把元素滚到视口内再打点。初版只 scrollIntoView 了第 1 个，
// 第 2~4 个还在视口外，elementFromPoint 直接返回 null → 误报成"热区缺失"。
// 且判定只能用 t===e || e.contains(t)：目标常嵌在可点的列表行里，
// 用 t.contains(e) 会把整行都算成命中，掩盖真实缺陷。
//
// 用法: python workspace/runnode.py verify-hitarea.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var pass = 0, fail = 0;
function ok(c, l, e) {
  if (c) { pass++; process.stdout.write('  PASS  ' + l + '\n'); }
  else { fail++; process.stdout.write('  FAIL  ' + l + (e !== undefined ? '  → ' + e : '') + '\n'); }
}

// 在页面里对给定选择器做「热区纵向跨度」测量
function probeExpr(sel) {
  return "(function(){" +
    "var els=document.querySelectorAll(" + JSON.stringify(sel) + ");" +
    "if(!els.length)return JSON.stringify({n:0,res:[]});" +
    "var res=[];" +
    "for(var i=0;i<els.length&&res.length<4;i++){" +
    "var e=els[i];" +
    /* 滚到视口中间再量 —— 否则元素在视口外，打点恒为 null */
    "e.scrollIntoView({block:'center'});" +
    "var r=e.getBoundingClientRect();" +
    /* 滚完仍在视口外（或尺寸为 0）就跳过，不当成失败 */
    "if(r.width<1||r.height<1||r.bottom<0||r.top>window.innerHeight)continue;" +
    "var cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;" +
    "function h(y){if(y<0||y>window.innerHeight)return false;" +
    "var t=document.elementFromPoint(cx,y);return !!(t&&(t===e||e.contains(t)));}" +
    "var up=0;while(up<60&&h(cy-up-1))up++;" +
    "var dn=0;while(dn<60&&h(cy+dn+1))dn++;" +
    "res.push({w:Math.round(r.width),h:Math.round(r.height),span:up+dn+1," +
    "up:up,dn:dn,txt:(e.textContent||'').trim().slice(0,14)});}" +
    "return JSON.stringify({n:res.length,res:res});})()";
}

async function newPage(w, h, stubFile) {
  var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
  var conn = await cdp.connect(j.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  if (stubFile) { await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(stubFile, 'utf8') }); }
  return { id: j.id, conn: conn, send: send };
}
async function go(pg, rel) {
  await pg.send('Page.navigate', { url: ROOT + '/' + rel });
  await cdp.sleep(1400);
  var c = await pg.send('Runtime.evaluate', { expression: 'document.location.href', returnByValue: true });
  return c.result.result.value;
}
async function ev(pg, expr) {
  var r = await pg.send('Runtime.evaluate', { expression: expr, returnByValue: true });
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 200);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

// 每项：[页面, 选择器, 说明, 前置动作(可选)]
var CASES = [
  ['pages/home.html', '.zf-home-refs', '首页「引用N条法规」徽标（视觉 21.3px）', 'expandQa'],
  ['pages/qa.html', '.zf-msg__act', '问答消息操作「复制/点赞/删除」（视觉 25.3px）', null],
  ['pages/court.html', '.zf-btn--sm', '小号按钮「退出 / 填充示例」（视觉 30.8px）', null],
  ['pages/court.html', '#court-type .zf-tag', '案情类型标签（视觉 33.3px）', null],
  ['pages/court.html', '.zf-quick__item', '常见纠纷快捷项（视觉 35px）', null],
  ['pages/contract-review.html', '.zf-tag', '合同风险标签', null]
];

var SETUP = {
  expandQa: '(function(){var it=document.querySelector(".zf-home-item");' +
    'if(it&&!it.classList.contains("zf-home-item--open")){it.click();}return "ok";})()'
};

(async function () {
  process.stdout.write('\n=== 热区实测（要求纵向跨度 ≥44px）===\n');
  for (var i = 0; i < CASES.length; i++) {
    var pg = await newPage(1440, 900, 'zc-stub-home.js');
    var href = await go(pg, CASES[i][0]);
    var wantFile = CASES[i][0].split('/')[1];
    if (href.indexOf(wantFile) < 0) {
      fail++; process.stdout.write('  FAIL  ' + CASES[i][0] + ' 导航失败 → ' + href + '\n');
      pg.conn.socket.destroy(); continue;
    }
    if (CASES[i][3] && SETUP[CASES[i][3]]) {
      await ev(pg, SETUP[CASES[i][3]]);
      await cdp.sleep(600);
    }
    var raw = await ev(pg, probeExpr(CASES[i][1]));
    if (String(raw).indexOf('__ERR__') === 0) {
      fail++; process.stdout.write('  FAIL  ' + CASES[i][2] + ' 探针异常 → ' + raw + '\n');
      pg.conn.socket.destroy(); continue;
    }
    var d = JSON.parse(raw);
    if (!d.n) {
      process.stdout.write('  ....  ' + CASES[i][2] + ' —— 页面上无可见实例，跳过\n');
      pg.conn.socket.destroy(); continue;
    }
    var minSpan = Math.min.apply(null, d.res.map(function (r) { return r.span; }));
    var detail = d.res.map(function (r) { return r.h + '→' + r.span; }).join(' ');
    ok(minSpan >= 44, CASES[i][2] + ' —— ' + d.n + ' 个，最小跨度 ' + minSpan + 'px  [' + detail + ']',
      detail);
    pg.conn.socket.destroy();
  }

  /* 触屏档：用 Emulation.setTouchEmulationEnabled + mobile:true 让 (hover:none) 命中。
     只调 setEmulatedMedia({name:'hover'}) 在 Edge 153 上不足以翻转 Hover media feature
     （实测仍读到 44px），必须同时开触屏模拟。 */
  process.stdout.write('\n=== 触屏档（hover: none）热区应 ≥48px ===\n');
  var pgT = await newPage(1440, 900, 'zc-stub-home.js');
  await pgT.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  await pgT.send('Emulation.setEmulatedMedia', { features: [{ name: 'hover', value: 'none' }] });
  await pgT.send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: true
  });
  await go(pgT, 'pages/court.html');
  var t0 = await ev(pgT, 'JSON.stringify({hoverNone: !matchMedia("(hover: none)").matches ? false : true,' +
    'anyHover: matchMedia("(any-hover: hover)").matches})');
  info2('媒体查询实测 ' + t0);
  var t1 = await ev(pgT, '(function(){var t=document.querySelector("#court-type .zf-tag");if(!t)return null;' +
    'var af=getComputedStyle(t,"::after");return af.minWidth+"|"+af.minHeight+"|"+af.margin;})()');
  info2('.zf-tag::after = ' + t1);
  if (String(t0).indexOf('"hoverNone":true') >= 0) {
    ok(String(t1).indexOf('48px') >= 0, '触屏下热区放大到 48px（实测 ' + t1 + '）', t1);
  } else {
    process.stdout.write('  ....  本环境无法翻转 (hover:none) 媒体特性，跳过该项（非代码问题）\n');
  }
  pgT.conn.socket.destroy();

  process.stdout.write('\n========================================\n');
  process.stdout.write('  通过 ' + pass + ' / 失败 ' + fail + '\n');
  process.stdout.write('========================================\n');
  process.exit(fail > 0 ? 1 : 0);
})();

function info2(s) { process.stdout.write('  ....  ' + s + '\n'); }
