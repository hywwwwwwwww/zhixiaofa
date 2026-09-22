// verify-admin.js —— 管理端专属外壳落地验收（10 页）
//
// 验证目标（对应本次「把 zhixiaofa-master 的管理端替换进来」）：
//   A. 管理端外壳：左侧管理导航（3 组 9 项 + 版本说明）、当前项高亮、
//      顶部栏（汉堡按钮 / 标题 / 副标题 / 管理员徽标 / 退出按钮）
//   B. 管理端**不含用户端导航**（本次替换的核心诉求：管理端只提供管理功能）
//   C. 非管理员访问 → 管理端内提示页（不跳转到用户端首页）
//   D. 各页表格数据渲染（Bootstrap Table 服务端分页）+ 筛选条 + 工具条
//   E. 窄屏抽屉（≤1100px 汉堡按钮切换 + 遮罩）
//
// 用法: python workspace/runnode.py verify-admin.js
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');

var PORT = 9351;
var ROOT = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp';

var pass = 0, fail = 0;
function ok(c, l, e) {
  if (c) { pass++; process.stdout.write('  PASS  ' + l + '\n'); }
  else { fail++; process.stdout.write('  FAIL  ' + l + (e !== undefined ? '  → ' + e : '') + '\n'); }
}
function info(s) { process.stdout.write('  ....  ' + s + '\n'); }

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
  await cdp.sleep(2000);
  var c = await pg.send('Runtime.evaluate', { expression: 'document.location.href', returnByValue: true });
  return c.result.result.value;
}
/**
 * 在页面里求值并返回结果。
 *
 * @param {object} pg   页签句柄
 * @param {string} expr 要执行的表达式
 * @param {boolean} [awaitPromise] 传 true 时等待表达式返回的 Promise 兑现。
 *        需要「等一帧 / 等 setTimeout 之后再读」的探针必须用它 ——
 *        CSS 过渡在同一 JS 回合内不会推进（见 E 组注释）。
 */
async function ev(pg, expr, awaitPromise) {
  var p = { expression: expr, returnByValue: true };
  if (awaitPromise) { p.awaitPromise = true; }
  var r = await pg.send('Runtime.evaluate', p);
  if (r.result && r.result.exceptionDetails) {
    return '__ERR__' + String(r.result.exceptionDetails.exception &&
      r.result.exceptionDetails.exception.description).slice(0, 200);
  }
  return r.result && r.result.result ? r.result.result.value : undefined;
}
/**
 * 关闭页签。
 *
 * 【坑】`cdp.js` 的 `httpGet` 内部无条件 `JSON.parse`，而 `/json/close/<id>`
 * 返回的是**纯文本** `Target is closing` —— 会抛 SyntaxError 且**逃出 try/catch**
 * （异常发生在 promise 回调里）。所以这里用原生 http 直接发，不走 cdp.httpGet。
 */
function closeTab(pg) {
  return new Promise(function (resolve) {
    try {
      var req = require('http').request({
        host: '127.0.0.1', port: PORT, path: '/json/close/' + pg.id, method: 'GET'
      }, function (res) { res.resume(); res.on('end', resolve); });
      req.on('error', function () { resolve(); });
      req.end();
    } catch (e) { resolve(); }
  });
}

/** 管理端外壳探针：一次性取回导航/顶部栏/用户端泄漏 全部证据 */
var SHELL = "(function(){" +
  "var nav=document.querySelector('.zf-admin-sidebar');" +
  "var all=document.querySelectorAll('.zf-sidebar .zf-nav');" +
  "var items=[];" +
  "for(var i=0;i<all.length;i++){" +
  "items.push({t:(all[i].textContent||'').trim()," +
  "href:all[i].getAttribute('href')," +
  "act:all[i].classList.contains('zf-nav--active')});}" +
  "var labels=document.querySelectorAll('.zf-sidebar__label');" +
  "var lg=[];for(var j=0;j<labels.length;j++){lg.push((labels[j].textContent||'').trim());}" +
  "var top=document.querySelector('.zf-topbar');" +
  "var menu=document.querySelector('.zf-topbar__menu');" +
  "var scrim=document.querySelector('.zf-sidebar__scrim');" +
  /* 用户端导航的特征词典：管理端侧边栏里出现任何一个都算「混入用户功能」 */
  "var userWords=['智能法律问答','AI小法庭','合同审查','文书起草','普法知识广场','个人中心'];" +
  /* 【坑】不要扫 document.body.innerText —— 实测 contracts.html 的副标题正文含
     「合同审查与风险点明细」、laws.html 含「支撑问答与合同审查引用」，会被误判成
     「渲染了用户端导航项」。泄漏检测必须**限定在侧边栏导航链接文本**上。
     所以这里复用上面的 all（`.zf-sidebar .zf-nav`）拼出 navTxt。 */
  "var navTxt='';for(var m=0;m<all.length;m++){navTxt+=' '+(all[m].textContent||'');}" +
  "var leaked=[];for(var k=0;k<userWords.length;k++){" +
  "if(navTxt.indexOf(userWords[k])>=0)leaked.push(userWords[k]);}" +
  "return JSON.stringify({" +
  "hasSidebar:!!nav, navClass:nav?nav.className:''," +
  "navCount:all.length, items:items, groups:lg," +
  "topText:top?top.innerText.replace(/\\s+/g,' ').trim().slice(0,120):''," +
  "hasMenu:!!menu, menuDisplay:menu?getComputedStyle(menu).display:''," +
  "hasScrim:!!scrim," +
  "hasOldNav:!!document.querySelector('.zf-admin-nav')," +
  "hasNavHost:!!document.querySelector('#admin-nav')," +
  "leaked:leaked," +
  "title:document.title});})()";

/** 表格渲染探针 */
var TABLE = "(function(){" +
  "var t=document.querySelector('.bootstrap-table');" +
  "var rows=document.querySelectorAll('.bootstrap-table tbody tr');" +
  "var ths=document.querySelectorAll('.bootstrap-table thead th');" +
  "var total=document.querySelector('.pagination-info')?document.querySelector('.pagination-info').innerText:'';" +
  "var count=document.querySelector('.zf-toolbar__count')?document.querySelector('.zf-toolbar__count').innerText:'';" +
  "var first='';" +
  "if(rows.length){first=(rows[0].innerText||'').replace(/\\s+/g,' ').trim().slice(0,90);}" +
  "var fb=document.querySelector('.zf-filter-bar');" +
  "var filters=document.querySelectorAll('.zf-filter-bar [data-filter]');" +
  "var fbLabel=document.querySelectorAll('.zf-filter-bar__label');" +
  "return JSON.stringify({hasTable:!!t,rowCount:rows.length,colCount:ths.length," +
  "pagerInfo:total,countText:count,firstRow:first," +
  "hasFilterBar:!!fb,filterCount:filters.length,filterLabelCount:fbLabel.length});})()";

(async function () {
  /* =================================================================
   *  A + B. 10 个管理端页的「外壳」检查（含用户端泄漏检测）
   * ================================================================= */
  process.stdout.write('\n=== A/B. 管理端外壳 + 用户端功能未混入（10 页）===\n');
  var PAGES = [
    ['admin/index.html', 'dashboard', '数据看板'],
    ['admin/users.html', 'users', '用户管理'],
    ['admin/qa.html', 'qa', '问答管理'],
    ['admin/contracts.html', 'contracts', '合同管理'],
    ['admin/laws.html', 'laws', '法律管理'],
    ['admin/knowledge.html', 'knowledge', '文章管理'],
    ['admin/doc-templates.html', 'templates', '模板管理'],
    ['admin/quiz.html', 'quiz', '题库管理'],
    ['admin/logs.html', 'logs', '日志监控']
  ];

  var shellBad = 0;
  for (var i = 0; i < PAGES.length; i++) {
    var rel = PAGES[i][0], key = PAGES[i][1], label = PAGES[i][2];
    var pg = await newPage(1440, 900, 'zc-stub-admin2.js');
    var href = await go(pg, rel);

    /* 导航后先断言 href 是目标页（防 chrome-error / 被踢到 login） */
    if (String(href).indexOf(rel) < 0) {
      ok(false, label + ' 导航到 ' + rel, href);
      shellBad++;
      await closeTab(pg);
      continue;
    }

    var raw = await ev(pg, SHELL);
    if (typeof raw !== 'string' || raw.charAt(0) !== '{') {
      ok(false, label + ' 外壳探针可读', String(raw).slice(0, 160));
      shellBad++;
      await closeTab(pg);
      continue;
    }
    var d = JSON.parse(raw);

    var navOk = d.hasSidebar && d.navCount === 9;
    var grpOk = d.groups.length === 3 &&
      d.groups[0] === '数据概览' && d.groups[1] === '用户与内容' && d.groups[2] === '系统运维';
    var acts = d.items.filter(function (x) { return x.act; });
    var actOk = acts.length === 1 && acts[0].t === label;
    var backOk = d.navClass.indexOf('zf-admin-sidebar') >= 0;
    var topOk = d.topText.indexOf(label) >= 0 && d.topText.indexOf('管理员') >= 0;
    var leakOk = d.leaked.length === 0;
    var noOldOk = !d.hasOldNav && !d.hasNavHost;

    var allOk = navOk && grpOk && actOk && backOk && topOk && leakOk && noOldOk;
    if (!allOk) { shellBad++; }
    ok(allOk, label + ' 管理端外壳完整', allOk ? undefined :
      JSON.stringify({
        navCount: d.navCount, groups: d.groups, act: acts.map(function (x) { return x.t; }),
        navClass: d.navClass, top: d.topText, leaked: d.leaked,
        oldNav: d.hasOldNav, navHost: d.hasNavHost
      }));

    if (i === 0) {
      info('导航 ' + d.navCount + ' 项 / 分组 ' + JSON.stringify(d.groups));
      info('主导航示例：' + d.items.slice(0, 3).map(function (x) { return x.t + '→' + x.href; }).join(', '));
      info('顶部栏：' + d.topText);
      info('汉堡按钮 display=' + d.menuDisplay + '  遮罩存在=' + d.hasScrim);
    }
    await closeTab(pg);
  }
  ok(shellBad === 0, '全部 9 个管理端页外壳一致（无一项失败）', shellBad ? shellBad + ' 页失败' : undefined);

  /* =================================================================
   *  C. 非管理员 → 管理端内提示页（不跳用户端首页）
   * ================================================================= */
  process.stdout.write('\n=== C. 非管理员访问 → 管理端内提示（不跳走）===\n');
  {
    var pg = await newPage(1440, 900, 'zc-stub-admin-user.js');
    var href = await go(pg, 'admin/users.html');
    var raw = await ev(pg, "(function(){" +
      "var d=document.querySelector('.zf-admin-denied');" +
      "return JSON.stringify({href:document.location.href," +
      "hasDenied:!!d," +
      "txt:d?d.innerText.replace(/\\s+/g,' ').trim():''," +
      "hasRelogin:!!document.querySelector('#zf-denied-relogin')," +
      "hasSidebar:!!document.querySelector('.zf-sidebar')," +
      "hasTable:!!document.querySelector('.bootstrap-table')});})()");
    if (typeof raw === 'string' && raw.charAt(0) === '{') {
      var d = JSON.parse(raw);
      ok(d.hasDenied, '非管理员看到「仅管理员可访问」提示', d.txt.slice(0, 60));
      ok(d.txt.indexOf('仅管理员可访问') >= 0, '提示文案含「仅管理员可访问」', d.txt.slice(0, 60));
      ok(d.hasRelogin, '提示页给出「换账号登录」按钮');
      ok(!d.hasSidebar, '提示态不渲染管理导航（避免半渲染）');
      ok(!d.hasTable, '提示态不渲染业务表格');
      /* 关键：不能被踢到用户端首页 —— 源方案刻意如此 */
      ok(String(d.href).indexOf('admin/users.html') >= 0,
        '停留在管理端（未跳转到用户端首页）', d.href);
      info('提示页文案：' + d.txt.slice(0, 70));
    } else {
      ok(false, '非管理员探针可读', String(raw).slice(0, 160));
    }
    await closeTab(pg);
  }

  /* =================================================================
   *  D. 各页表格渲染 + 筛选条
   * ================================================================= */
  process.stdout.write('\n=== D. 各页表格数据渲染 + 筛选条 ===\n');
  var LISTS = [
    ['admin/users.html', '用户管理'],
    ['admin/qa.html', '问答管理'],
    ['admin/contracts.html', '合同管理'],
    ['admin/laws.html', '法律管理'],
    ['admin/knowledge.html', '文章管理'],
    ['admin/doc-templates.html', '模板管理'],
    ['admin/quiz.html', '题库管理'],
    ['admin/logs.html', '日志监控']
  ];
  var listBad = 0;
  for (var n = 0; n < LISTS.length; n++) {
    var rel = LISTS[n][0], label = LISTS[n][1];
    var pg = await newPage(1440, 900, 'zc-stub-admin2.js');
    await go(pg, rel);
    await cdp.sleep(900);   // 等 Bootstrap Table 渲染
    var raw = await ev(pg, TABLE);
    if (typeof raw !== 'string' || raw.charAt(0) !== '{') {
      ok(false, label + ' 表格探针可读', String(raw).slice(0, 160));
      listBad++;
      await closeTab(pg);
      continue;
    }
    var d = JSON.parse(raw);
    var okAll = d.hasTable && d.rowCount > 0 && d.colCount > 0 && d.hasFilterBar && d.filterCount > 0;
    if (!okAll) { listBad++; }
    ok(okAll, label + ' 表格 + 筛选条渲染', okAll ? undefined :
      JSON.stringify({ table: d.hasTable, rows: d.rowCount, cols: d.colCount,
        filterBar: d.hasFilterBar, filters: d.filterCount }));
    if (n === 0) {
      info('示例：列数 ' + d.colCount + ' / 行数 ' + d.rowCount +
        ' / 筛选控件 ' + d.filterCount + ' 个（带标签 ' + d.filterLabelCount + ' 个）');
      info('分页信息：' + d.pagerInfo + '   工具条计数：' + d.countText);
      info('首行：' + d.firstRow);
    }
    await closeTab(pg);
  }
  ok(listBad === 0, '全部 8 个列表页表格渲染正常', listBad ? listBad + ' 页失败' : undefined);

  /* =================================================================
   *  E. 窄屏抽屉（≤1100px）
   * ================================================================= */
  process.stdout.write('\n=== E. 窄屏侧边栏抽屉（≤1100px）===\n');
  {
    var pg = await newPage(900, 800, 'zc-stub-admin2.js');
    await go(pg, 'admin/users.html');
    /* 【坑】点击后必须**等一帧 / 等过渡走完**再读 computed style。
       同一个 JS 回合里 `m.click()` 之后立刻 getComputedStyle，过渡还没推进，
       读到的必然是起始值（visibility:hidden / transform:translateX(-100%)）——
       实测就是这么误报成「抽屉展开无效」的。所以拆成两段：
       ① 同步读基线（点击前）+ 触发点击；② await 一帧后读展开态。 */
    var raw = await ev(pg, "(function(){" +
      "var m=document.querySelector('.zf-topbar__menu');" +
      "var s=document.querySelector('.zf-sidebar');" +
      "var out={menuDisplay:m?getComputedStyle(m).display:'none'," +
      "sbPosition:s?getComputedStyle(s).position:''," +
      "sbTransform:s?getComputedStyle(s).transform:''," +
      "sbVisibility:s?getComputedStyle(s).visibility:''};" +
      "if(m){m.click();}" +
      "var sc=document.querySelector('.zf-sidebar__scrim');" +
      "out.afterOpenClass=s?s.className:'';" +
      "out.scrimShow=sc?sc.className:'';" +
      "return JSON.stringify(out);})()");
    /* 等两帧 + 过渡时长（.22s）留足余量，再读展开后的最终态 */
    var raw2 = await ev(pg, "(function(){" +
      "var s=document.querySelector('.zf-sidebar');" +
      "return new Promise(function(res){" +
      "requestAnimationFrame(function(){requestAnimationFrame(function(){" +
      "setTimeout(function(){" +
      "res(JSON.stringify({visibility:getComputedStyle(s).visibility," +
      "transform:getComputedStyle(s).transform," +
      "cls:s.className}));},320);});});});})()", true);
    if (typeof raw === 'string' && raw.charAt(0) === '{') {
      var d = JSON.parse(raw);
      var e2 = JSON.parse(raw2);
      ok(d.menuDisplay !== 'none', '窄屏汉堡按钮出现（display≠none）', d.menuDisplay);
      ok(d.sbPosition === 'fixed', '窄屏侧边栏转为 fixed 抽屉', d.sbPosition);
      ok(d.sbVisibility === 'hidden', '抽屉默认收起（visibility:hidden，离屏链接不可 Tab）', d.sbVisibility);
      ok(d.afterOpenClass.indexOf('zf-sidebar--open') >= 0, '点击汉堡后加上 --open 类', d.afterOpenClass);
      ok(d.scrimShow.indexOf('--show') >= 0, '点击汉堡后遮罩显示', d.scrimShow);
      ok(e2.visibility === 'visible', '抽屉展开后可见（等过渡走完再读）', e2.visibility);
      ok(e2.transform.indexOf('matrix(1, 0, 0, 1, 0, 0)') >= 0, '抽屉展开后 transform 归零（已平移回屏内）', e2.transform);
      info('展开后 transform=' + e2.transform + '  visibility=' + e2.visibility);
    } else {
      ok(false, '窄屏抽屉探针可读', String(raw).slice(0, 160));
    }
    await closeTab(pg);
  }

  /* =================================================================
   *  F. 宽屏下汉堡按钮应隐藏（回归：别让桌面上多出一个按钮）
   * ================================================================= */
  process.stdout.write('\n=== F. 宽屏回归（汉堡按钮应隐藏）===\n');
  {
    var pg = await newPage(1440, 900, 'zc-stub-admin2.js');
    await go(pg, 'admin/users.html');
    var raw = await ev(pg, "(function(){" +
      "var m=document.querySelector('.zf-topbar__menu');" +
      "var s=document.querySelector('.zf-sidebar');" +
      "return JSON.stringify({menuDisplay:m?getComputedStyle(m).display:'none'," +
      "sbPosition:s?getComputedStyle(s).position:''," +
      "sbVisibility:s?getComputedStyle(s).visibility:''});})()");
    var d = JSON.parse(raw);
    ok(d.menuDisplay === 'none', '宽屏（1440）汉堡按钮隐藏', d.menuDisplay);
    ok(d.sbPosition !== 'fixed', '宽屏侧边栏不是 fixed（回流内布局）', d.sbPosition);
    await closeTab(pg);
  }

  process.stdout.write('\n========================================\n');
  process.stdout.write('  通过 ' + pass + ' / 失败 ' + fail + '\n');
  process.stdout.write('========================================\n\n');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  process.stdout.write('脚本异常: ' + (e && e.stack || e) + '\n');
  process.exit(2);
});
