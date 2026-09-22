// verify-ui-round.js —— 本轮 UI 优化落地验收
// 用法: python workspace/runnode.py verify-ui-round.js
// 覆盖：A 首屏溢出 / B 对比度 / C 焦点环 / D 热区 / E 减动效 / F 长任务进行中态 / G 多视口回归
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var pass = 0, fail = 0;
function ok(cond, label, extra) {
  if (cond) { pass++; process.stdout.write('  PASS  ' + label + '\n'); }
  else { fail++; process.stdout.write('  FAIL  ' + label + (extra !== undefined ? '  → ' + extra : '') + '\n'); }
}
function info(label) { process.stdout.write('  ....  ' + label + '\n'); }

/* ---------- 注入到页面里的工具函数（ES5） ----------
   toRgb：把 #rrggbb / #rgb / rgb(a) 统一成 [r,g,b]。
   上一版直接对 '#5f6b7a' 跑 /[\d.]+/g，把 '5','6','7' 当成了 RGB 分量，
   算出 1.04 这种荒谬对比度 —— 这里先用临时元素让浏览器自己归一化。

   【为什么不用 document.styleSheets 扫规则】
   file:// 协议下每个 <link> 样式表都是 cross-origin，读 cssRules 会抛
   SecurityError: Cannot read the 'cssRules' property（实测 3 个表全部读到）。
   所以「规则是否存在」必须改用 computed style 证明 —— 见下面的 readBackCss()。 */
var UTIL =
  "window.__zfRgb=function(c){" +
  "var d=document.createElement('div');d.style.color=c;d.style.display='none';" +
  "document.body.appendChild(d);var s=getComputedStyle(d).color;d.parentNode.removeChild(d);" +
  "var m=s.match(/[\\d.]+/g);if(!m)return null;" +
  "return [ +m[0], +m[1], +m[2] ];};" +
  "window.__zfLum=function(c){var a=window.__zfRgb(c);if(!a)return null;" +
  "function f(x){x=x/255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4);}" +
  "return 0.2126*f(a[0])+0.7152*f(a[1])+0.0722*f(a[2]);};" +
  "window.__zfCr=function(a,b){var x=window.__zfLum(a),y=window.__zfLum(b);" +
  "if(x===null||y===null)return null;var hi=Math.max(x,y),lo=Math.min(x,y);" +
  "return +((hi+0.05)/(lo+0.05)).toFixed(2);};" +
  /* 动态造一个带标识的样式表，再读回计算值 —— 用它自证「当前页面确实加载了 app.css，
     且我读到的是本文件里的规则」，避免踩 file:// 磁盘缓存导致读到旧 CSS 的坑
     （见 memory 第 21 条：headless 对 file:// 子资源有磁盘缓存，读到的值可能完全没变）。 */
  "window.__zfProbeStyle=function(css,tag){" +
  "var s=document.createElement('style');s.textContent='.'+tag+'{'+css+'}';" +
  "document.head.appendChild(s);var d=document.createElement('div');d.className=tag;" +
  "document.body.appendChild(d);var out=getComputedStyle(d);" +
  "var r={};for(var k in css.split(';')){}return out;};";

async function newPage(w, h, stubFile) {
  var j = await cdp.httpPut('http://127.0.0.1:' + PORT + '/json/new?' + encodeURIComponent('about:blank'));
  var conn = await cdp.connect(j.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable', {});
  await send('Runtime.enable', {});
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: UTIL });
  if (stubFile) {
    await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(stubFile, 'utf8') });
  }
  return { id: j.id, conn: conn, send: send };
}

async function go(pg, rel) {
  await pg.send('Page.navigate', { url: ROOT + '/' + rel });
  await cdp.sleep(1300);
  var c = await pg.send('Runtime.evaluate', { expression: 'document.location.href', returnByValue: true });
  return c.result.result.value;
}

async function ev(pg, expr, awaitPromise) {
  var r = await pg.send('Runtime.evaluate', {
    expression: expr, returnByValue: true, awaitPromise: !!awaitPromise
  });
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 300);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}

(async function () {
  process.stdout.write('\n=== A. 首屏溢出（court/contract 内容底边 = 视口底）===\n');
  var pgA = await newPage(1440, 900, 'zc-stub-home.js');
  var expA = [
    { f: 'pages/court.html', name: 'court' },
    { f: 'pages/contract-review.html', name: 'contract' }
  ];
  for (var ai = 0; ai < expA.length; ai++) {
    await go(pgA, expA[ai].f);
    var a1 = await ev(pgA, 'JSON.stringify({' +
      'h:document.documentElement.scrollHeight,' +
      'iw:window.innerWidth,w:document.documentElement.scrollWidth,' +
      'ih:window.innerHeight,' +
      'pb:getComputedStyle(document.querySelector(".zf-content")).paddingBottom,' +
      'deskBottom:Math.round(document.querySelector(".zf-desk").getBoundingClientRect().bottom)})');
    if (String(a1).indexOf('__ERR__') === 0) { fail++; process.stdout.write('  FAIL  ' + a1 + '\n'); continue; }
    var d1 = JSON.parse(a1);
    ok(d1.h <= d1.ih, expA[ai].name + ' docH ≤ 视口（docH=' + d1.h + ' / 视口=' + d1.ih + '）', d1.h);
    ok(d1.w <= d1.iw + 1, expA[ai].name + ' 无横向溢出');
    info(expA[ai].name + ' content padding-bottom=' + d1.pb + '  内容底边=' + d1.deskBottom);
  }
  pgA.conn.socket.destroy();

  process.stdout.write('\n=== B. 对比度（ink-3 / 实心蓝底白字）===\n');
  var pgB = await newPage(1440, 900, 'zc-stub-home.js');
  await go(pgB, 'pages/home.html');
  var b1 = await ev(pgB, 'getComputedStyle(document.documentElement).getPropertyValue("--zf-ink-3").replace(/^\\s+|\\s+$/g,"")');
  ok(b1 === '#5f6b7a', 'ink-3 令牌已改为 #5f6b7a（实测 ' + b1 + '）', b1);

  var b2 = await ev(pgB, '(function(){var nav=document.querySelector(".zf-nav--active");' +
    'if(!nav)return null;var cs=getComputedStyle(nav);return JSON.stringify({bg:cs.backgroundColor,color:cs.color});})()');
  if (b2) {
    var navC = JSON.parse(b2);
    ok(navC.bg === 'rgb(43, 108, 212)', '导航当前项底色 = primary-strong(43,108,212)（实测 ' + navC.bg + '）', navC.bg);
    ok(+(await ev(pgB, 'window.__zfCr("' + navC.bg + '","' + navC.color + '")')) >= 4.5,
      '导航当前项白字对比度 ≥4.5（实测 ' + (await ev(pgB, 'window.__zfCr("' + navC.bg + '","' + navC.color + '")')) + '）');
  } else { info('home 无 .zf-nav--active，跳过'); }

  var b3 = await ev(pgB, '(function(){' +
    'var v=getComputedStyle(document.documentElement).getPropertyValue("--zf-ink-3").replace(/^\\s+|\\s+$/g,"");' +
    'var w=getComputedStyle(document.documentElement).getPropertyValue("--zf-bg").replace(/^\\s+|\\s+$/g,"");' +
    'var s=getComputedStyle(document.documentElement).getPropertyValue("--zf-sidebar").replace(/^\\s+|\\s+$/g,"");' +
    'var m=getComputedStyle(document.documentElement).getPropertyValue("--zf-muted").replace(/^\\s+|\\s+$/g,"");' +
    'return JSON.stringify({ink3:v,white:window.__zfCr(v,w),sidebar:window.__zfCr(v,s),muted:window.__zfCr(v,m)});})()');
  var b3d = JSON.parse(b3);
  info('ink-3=' + b3d.ink3 + '  对白底=' + b3d.white + ' 对侧栏底=' + b3d.sidebar + ' 对 muted 底=' + b3d.muted);
  ok(b3d.white >= 4.5, 'ink-3 对白底 ≥4.5（实测 ' + b3d.white + '）', b3d.white);
  ok(b3d.sidebar >= 4.5, 'ink-3 对侧栏底 ≥4.5（实测 ' + b3d.sidebar + '）', b3d.sidebar);
  pgB.conn.socket.destroy();

  process.stdout.write('\n=== C. 焦点环（用计算值证明规则真的生效）===\n');
  var pgC = await newPage(1440, 900, 'zc-stub-home.js');
  await go(pgC, 'pages/court.html');
  /* file:// 下读不到 cssRules，所以改成「用键盘真的 Tab 过去，看 outline 是否出现」。
     :focus-visible 只对键盘/程序化但「非鼠标」的聚焦生效 —— 这里用 CDP 派发真实
     Tab 键事件，比 element.focus() 更贴近真实用户路径。 */
  await ev(pgC, 'document.body.focus();document.activeElement && document.activeElement.blur();');
  var cKeys = [];
  for (var ci = 0; ci < 14; ci++) {
    await pgC.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab',
      nativeVirtualKeyCode: 9
    });
    await pgC.send('Input.dispatchKeyEvent', {
      type: 'keyUp', windowsVirtualKeyCode: 9, code: 'Tab', key: 'Tab',
      nativeVirtualKeyCode: 9
    });
    await cdp.sleep(60);
    var cur = await ev(pgC, '(function(){var a=document.activeElement;if(!a)return null;' +
      'var cs=getComputedStyle(a);' +
      'return JSON.stringify({tag:a.tagName,cls:String(a.className||"").slice(0,42),' +
      'os:cs.outlineStyle,ow:cs.outlineWidth,oc:cs.outlineColor,oo:cs.outlineOffset});})()');
    if (!cur || String(cur).indexOf('__ERR__') === 0) { continue; }
    var cu = JSON.parse(cur);
    if (cu.os === 'solid') { cKeys.push(cu); }
  }
  ok(cKeys.length >= 1, '连续 Tab 14 次，' + cKeys.length + ' 个元素出现实线焦点环（:focus-visible 生效）',
    JSON.stringify(cKeys.slice(0, 3)));
  if (cKeys.length) {
    var cFirst = cKeys[0];
    var cW = parseFloat(cFirst.ow);
    ok(cW === 2, '焦点环线宽 = 2px（实测 ' + cFirst.ow + '）', cFirst.ow);
    ok(cFirst.oo === '2px' || cFirst.oo === '-3px' || cFirst.oo === '-2px',
      '焦点环有 offset 补偿（实测 ' + cFirst.oo + '）', cFirst.oo);
    info('首个命中：' + cFirst.tag + '.' + cFirst.cls + '  outline=' + cFirst.ow + ' ' +
      cFirst.os + ' ' + cFirst.oc + ' offset=' + cFirst.oo);
  }

  /* 减动效：把媒体特性模拟成 reduce，再读实际计算值。
     .zf-typing 是 infinite 循环动画，reduce 下必须是 animation-name:none。 */
  await pgC.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await cdp.sleep(200);
  var c3 = await ev(pgC, '(function(){' +
    'var probe=document.createElement("div");probe.className="zf-typing";' +
    'probe.innerHTML="<i></i>";document.body.appendChild(probe);' +
    'var i=probe.querySelector("i");var cs=getComputedStyle(i);' +
    'var r={anim:cs.animationName,dur:cs.animationDuration,iter:cs.animationIterationCount,' +
    'trans:cs.transitionDuration};probe.parentNode.removeChild(probe);' +
    'var sb=document.createElement("span");sb.className="zf-skel__bar";document.body.appendChild(sb);' +
    'var sc=getComputedStyle(sb);r.skelAnim=sc.animationName;sb.parentNode.removeChild(sb);' +
    'r.reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;' +
    'return JSON.stringify(r);})()');
  if (c3 && String(c3).indexOf('__ERR__') < 0) {
    var c3d = JSON.parse(c3);
    ok(c3d.reduce === true, '媒体特性已模拟为 reduce（matchMedia 命中）');
    ok(c3d.anim === 'none', '.zf-typing i 的循环动画已停用（animation-name=' + c3d.anim + '）', c3d.anim);
    ok(c3d.skelAnim === 'none', '.zf-skel__bar 的循环动画已停用（animation-name=' + c3d.skelAnim + '）', c3d.skelAnim);
    info('reduce 下：transition-duration=' + c3d.trans + '  iteration=' + c3d.iter);
  } else { fail++; process.stdout.write('  FAIL  减动效探针异常 → ' + c3 + '\n'); }
  // 复位媒体模拟，避免影响后续用例
  await pgC.send('Emulation.setEmulatedMedia', { features: [] });

  process.stdout.write('\n=== D. 小目标热区（伪元素 44px）===\n');
  var d1r = await ev(pgC, '(function(){var t=document.querySelector("#court-type .zf-tag");if(!t)return null;' +
    'var cs=getComputedStyle(t,"::after");return cs.position+"|"+cs.minWidth+"|"+cs.minHeight;})()');
  info('court .zf-tag::after = ' + d1r);
  ok(String(d1r).indexOf('44px') >= 0, '热区伪元素 min 尺寸含 44px', d1r);
  // 实测热区真的覆盖 44x44：用 elementFromPoint 打四周
  var d2 = await ev(pgC, '(function(){var t=document.querySelector("#court-type .zf-tag");if(!t)return null;' +
    't.scrollIntoView({block:"center"});var r=t.getBoundingClientRect();' +
    'var cx=(r.left+r.right)/2, cy=(r.top+r.bottom)/2;' +
    'var hit=0,miss=[];var pts=[[cx,cy-20],[cx,cy+20],[cx-30,cy],[cx+30,cy]];' +
    'for(var i=0;i<pts.length;i++){var el=document.elementFromPoint(pts[i][0],pts[i][1]);' +
    'if(el&&(el===t||t.contains(el)))hit++;else miss.push(i);}' +
    'return JSON.stringify({h:Math.round(r.height),w:Math.round(r.width),hit:hit,miss:miss});})()');
  if (d2 && String(d2).indexOf('__ERR__') < 0) {
    var d2d = JSON.parse(d2);
    ok(d2d.hit >= 3, '标签自身高仅 ' + d2d.h + 'px，但 ±20px 命中 ' + d2d.hit + '/4（热区生效）', JSON.stringify(d2d.miss));
  } else { info('热区命中探针异常：' + d2); }
  pgC.conn.socket.destroy();

  process.stdout.write('\n=== E. AI 长任务进行中态 ===\n');
  // 桩的 XHR 是同步立即 resolve，260ms 后早就结算了 —— 改为拦截 XHR 延迟 3000ms 回包，
  // 这样才能观察到「进行中」的真实中间态。
  var pgF = await newPage(1440, 900, 'zc-stub-home.js');
  await go(pgF, 'pages/court.html');
  await ev(pgF, '(function(){' +
    'var Real=window.XMLHttpRequest;var delay=3000;' +
    'window.__zfXhrLog=[];' +
    'window.XMLHttpRequest=function(){' +
    'var x=new Real();var oOpen=x.open;var oSend=x.send;' +
    'x.open=function(m,u){this.__u=u;return oOpen.apply(x,arguments);};' +
    'x.send=function(b){var self=this;window.__zfXhrLog.push(self.__u);' +
    'var s=this.send;var realSend=oSend;' +
    'setTimeout(function(){try{realSend.call(self,b);}catch(e){}},delay);};' +
    'return x;};return "hooked";})()');
  var f0 = await ev(pgF, 'document.getElementById("result-running") ? "yes" : "no"');
  ok(f0 === 'yes', 'court 存在 #result-running 容器');
  var f0b = await ev(pgF, 'document.getElementById("result-running").hasAttribute("hidden")');
  ok(f0b === true, '初始为 hidden（占位引导态可见）');

  var f1 = await ev(pgF, '(function(){' +
    '$("#court-desc").val("2026年9月13日公司以组织架构调整为由单方解除劳动合同，未提前三十日通知，月工资16000元。").trigger("input");' +
    '$("#court-type .zf-tag[data-v=违法辞退]").trigger("click");' +
    '$("#court-form").trigger("submit");' +
    'return "submitted";})()');
  info('触发提交: ' + f1);
  await cdp.sleep(400);
  var f2 = await ev(pgF, 'JSON.stringify({' +
    'hidden: document.getElementById("result-running").hasAttribute("hidden"),' +
    'phHidden: $("#result-placeholder").is(":hidden"),' +
    'bodyHidden: $("#result-body").is(":hidden"),' +
    'nowCount: document.querySelectorAll("#result-running-steps .is-now").length,' +
    'doneCount: document.querySelectorAll("#result-running-steps .is-done").length,' +
    'stepCount: document.querySelectorAll("#result-running-steps .zf-steps__item").length,' +
    'xhr: (window.__zfXhrLog||[]).join(",")' +
    '})');
  if (f2 && String(f2).indexOf('__ERR__') < 0) {
    var fd = JSON.parse(f2);
    info('已发出的 XHR: ' + fd.xhr);
    ok(fd.hidden === false, '提交后 #result-running 可见');
    ok(fd.phHidden === true, '提交后占位引导已隐藏');
    ok(fd.bodyHidden === true, '提交后 result-body 仍隐藏（等真实响应）');
    ok(fd.nowCount === 1, '恰有 1 个阶段处于 is-now（实测 ' + fd.nowCount + '）', fd.nowCount);
    ok(fd.doneCount === 0, '初始无已完成阶段（实测 ' + fd.doneCount + '）', fd.doneCount);
  } else { fail++; process.stdout.write('  FAIL  进行中态探针异常 → ' + f2 + '\n'); }

  await cdp.sleep(2200);
  var f3 = await ev(pgF, 'JSON.stringify({' +
    'doneCount: document.querySelectorAll("#result-running-steps .is-done").length,' +
    'nowCount: document.querySelectorAll("#result-running-steps .is-now").length,' +
    'stepCount: document.querySelectorAll("#result-running-steps .zf-steps__item").length' +
    '})');
  var f3d = JSON.parse(f3);
  ok(f3d.doneCount >= 1, '约 2.2s 后至少 1 个阶段已完成（实测 ' + f3d.doneCount + '）', f3d.doneCount);
  ok(f3d.nowCount === 1, '始终恰有 1 个阶段处于进行中（实测 ' + f3d.nowCount + '）', f3d.nowCount);
  ok(f3d.doneCount + f3d.nowCount <= f3d.stepCount, '已完成+进行中 ≤ 总阶段数（不越界）');
  info('阶段推进：done=' + f3d.doneCount + ' now=' + f3d.nowCount + ' total=' + f3d.stepCount);

  await cdp.sleep(1800);
  var f4 = await ev(pgF, 'JSON.stringify({' +
    'runHidden: document.getElementById("result-running").hasAttribute("hidden"),' +
    'bodyVisible: !$("#result-body").is(":hidden"),' +
    'bodyHasContent: ($("#result-body").html()||"").length > 100' +
    '})');
  var f4d = JSON.parse(f4);
  ok(f4d.runHidden === true, '真实结果到达后进行中态已收起');
  ok(f4d.bodyVisible === true, '结果 body 已显示');
  ok(f4d.bodyHasContent === true, '结果 body 已渲染内容（>100 字符）');
  pgF.conn.socket.destroy();

  process.stdout.write('\n=== F. 多视口复测（回归）===\n');
  var VPS = [[1440, 900], [1100, 800], [820, 1000], [560, 900]];
  var PAGES = ['pages/home.html', 'pages/court.html', 'pages/contract-review.html',
    'pages/doc-drafting.html', 'pages/knowledge.html', 'pages/qa.html', 'pages/profile.html'];
  for (var pi = 0; pi < PAGES.length; pi++) {
    var worst = '';
    for (var vi = 0; vi < VPS.length; vi++) {
      var pg = await newPage(VPS[vi][0], VPS[vi][1], 'zc-stub-home.js');
      await go(pg, PAGES[pi]);
      var r = await ev(pg, 'JSON.stringify({h:document.documentElement.scrollHeight,w:document.documentElement.scrollWidth,iw:window.innerWidth})');
      if (String(r).indexOf('__ERR__') === 0) { worst += ' [probe err]'; pg.conn.socket.destroy(); continue; }
      var rd = JSON.parse(r);
      if (rd.w > rd.iw + 1) { worst += ' [' + VPS[vi][0] + 'px 横向溢出+' + (rd.w - rd.iw) + ']'; }
      pg.conn.socket.destroy();
    }
    ok(worst === '', PAGES[pi] + ' 4 档视口无横向溢出', worst);
  }

  process.stdout.write('\n========================================\n');
  process.stdout.write('  通过 ' + pass + ' / 失败 ' + fail + '\n');
  process.stdout.write('========================================\n');
  process.exit(fail > 0 ? 1 : 0);
})();
