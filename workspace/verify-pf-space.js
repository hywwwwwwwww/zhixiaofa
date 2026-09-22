/**
 * 个人中心「空间利用率」改造 —— 实测验证脚本
 *
 * 目的：用 headless Edge 真实渲染 profile.html，量化
 *   1) 左右两栏底边是否等高（align-self:stretch + height:100% 是否真的生效）
 *   2) 资料设置面板的内容高度 / 视口利用率
 *   3) 表单栅格：手机号是否回到 2 列、岗位是否整行、按钮条是否跨列且有分隔线
 *   4) 左栏「最近动态」是否渲染出 3 条真实数据
 *   5) 收藏页签仍可切换、取消收藏后列表刷新（回归）
 *
 * 用法：node verify-pf-space.js [port]
 *   需先启动 headless Edge：
 *   msedge --headless=new --remote-debugging-port=9402 --window-size=1440,900 about:blank
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9402';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/profile.html';

var SHOT_DIR = path.join(__dirname, 'shots');
if (!fs.existsSync(SHOT_DIR)) { fs.mkdirSync(SHOT_DIR); }

function ok(label, pass, detail) {
  console.log((pass ? '[PASS] ' : '[FAIL] ') + label + (detail ? '  ' + detail : ''));
  return pass;
}

(async function () {
  // 新建标签页（/json/new 必须 PUT）
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;

  await send('Page.enable');
  await send('Runtime.enable');

  // 1440×900 视口
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440, height: 900, deviceScaleFactor: 1, mobile: false
  });

  // ---------- 鉴权桩：重写 XHR，返回 {code:10000,...} 信封 ----------
  var STUB = fs.readFileSync(path.join(__dirname, 'zc-stub-pf.js'), 'utf8');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: STUB });

  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2600);

  // ---------- 断言 1：渲染成功、无 JS 报错 ----------
  var title = (await send('Runtime.evaluate',
    { expression: 'document.title', returnByValue: true })).result.result.value;
  ok('页面标题正确', title.indexOf('个人中心') === 0, title);

  var nick = (await send('Runtime.evaluate',
    { expression: "document.getElementById('p-nickname').textContent", returnByValue: true
    })).result.result.value;
  ok('左栏昵称已渲染', !!nick, 'nickname=' + nick);

  // ---------- 量化 ----------
  var METRIC = `(function () {
    function R(sel) {
      var el = document.querySelector(sel);
      if (!el) { return null; }
      var r = el.getBoundingClientRect();
      var cs = getComputedStyle(el);
      return {
        top: Math.round(r.top), bottom: Math.round(r.bottom),
        h: Math.round(r.height), w: Math.round(r.width), left: Math.round(r.left),
        display: cs.display, alignSelf: cs.alignSelf, height: cs.height
      };
    }
    var rail = R('.zf-profile-rail');
    var railCard = R('.zf-profile-rail > .zf-card');
    var work = R('.zf-work');
    var panel = R('#panel-profile');
    var grid = R('#profile-form .zf-fill-grid');
    var acts = R('#profile-form .zf-actions-end');
    var gridCS = grid ? getComputedStyle(document.querySelector('#profile-form .zf-fill-grid')) : null;
    var actsCS = acts ? getComputedStyle(document.querySelector('#profile-form .zf-actions-end')) : null;
    var fields = [];
    document.querySelectorAll('#profile-form .zf-field').forEach(function (f) {
      var r = f.getBoundingClientRect();
      var inp = f.querySelector('.zf-form-control');
      fields.push({
        id: inp ? inp.id : '',
        left: Math.round(r.left), w: Math.round(r.width),
        top: Math.round(r.top), h: Math.round(r.height),
        full: f.classList.contains('zf-field--full')
      });
    });
    var recent = R('#recent-box');
    return {
      viewport: { w: innerWidth, h: innerHeight },
      pageH: document.documentElement.scrollHeight,
      rail: rail, railCard: railCard, work: work, panel: panel,
      grid: grid, acts: acts,
      gridCols: gridCS ? gridCS.gridTemplateColumns : null,
      gridColGap: gridCS ? gridCS.columnGap : null,
      actSpan: actsCS ? actsCS.gridColumn : null,
      actBorderTop: actsCS ? actsCS.borderTopWidth + ' ' + actsCS.borderTopStyle : null,
      actMarginTop: actsCS ? actsCS.marginTop : null,
      actPaddingTop: actsCS ? actsCS.paddingTop : null,
      fields: fields,
      recent: recent,
      recentCount: document.querySelectorAll('#recent-list .zf-recent__item').length,
      recentTexts: Array.prototype.map.call(
        document.querySelectorAll('#recent-list .zf-recent__text'), function (e) { return e.textContent; }),
      recentMetas: Array.prototype.map.call(
        document.querySelectorAll('#recent-list .zf-recent__meta'), function (e) { return e.textContent.trim(); }),
      acct: R('#acct-box'),
      acctRows: Array.prototype.map.call(
        document.querySelectorAll('.zf-acct__row'), function (e) {
          return e.querySelector('dt').textContent + '=' + e.querySelector('dd').textContent;
        }),
      favTabCount: (function () {
        var e = document.getElementById('tab-fav-count');
        return e ? (e.hidden ? '(hidden)' : e.textContent) : null;
      })()
    };
  })()`;

  var M = (await send('Runtime.evaluate',
    { expression: METRIC, returnByValue: true })).result.result.value;

  console.log('\n=========== 资料设置页签 实测 ===========');
  console.log('视口 ' + M.viewport.w + '×' + M.viewport.h + '  页面总高 ' + M.pageH);
  console.log('左栏 .zf-profile-rail : top=' + M.rail.top + ' h=' + M.rail.h +
    ' bottom=' + M.rail.bottom + ' alignSelf=' + M.rail.alignSelf);
  console.log('左栏卡片              : h=' + M.railCard.h + ' bottom=' + M.railCard.bottom +
    ' computedHeight=' + M.railCard.height);
  console.log('右列 .zf-work         : top=' + M.work.top + ' h=' + M.work.h + ' bottom=' + M.work.bottom);
  console.log('  #panel-profile      : h=' + M.panel.h + ' bottom=' + M.panel.bottom);
  console.log('  .zf-fill-grid       : h=' + M.grid.h + ' cols=' + M.gridCols + ' colGap=' + M.gridColGap);
  console.log('  .zf-actions-end     : top=' + M.acts.top + ' h=' + M.acts.h +
    ' gridColumn=' + M.actSpan + ' borderTop=' + M.actBorderTop +
    ' mt=' + M.actMarginTop + ' pt=' + M.actPaddingTop);
  console.log('字段：');
  M.fields.forEach(function (f) {
    console.log('  ' + (f.id || '(无)').padEnd(12) + ' left=' + String(f.left).padEnd(5) +
      ' w=' + String(f.w).padEnd(5) + ' top=' + String(f.top).padEnd(5) +
      (f.full ? ' [整行]' : ''));
  });
  console.log('最近动态 : hidden=' + (M.recent ? 'no' : 'yes') +
    ' 条数=' + M.recentCount + ' h=' + (M.recent ? M.recent.h : '-'));
  M.recentTexts.forEach(function (t, i) {
    console.log('  #' + (i + 1) + ' ' + t + '   ' + (M.recentMetas[i] || ''));
  });
  console.log('收藏角标 : ' + M.favTabCount);
  console.log('账号信息 : h=' + (M.acct ? M.acct.h : '-'));
  M.acctRows.forEach(function (r) { console.log('  ' + r); });

  var contentBottom = Math.max(M.railCard.bottom, M.work.bottom);
  var util = Math.round(M.work.h / (M.viewport.h - M.work.top) * 1000) / 10;
  console.log('\n内容区底部最高点 = ' + contentBottom + '，视口底 = ' + M.viewport.h +
    '，剩余留白 = ' + (M.viewport.h - contentBottom));
  console.log('右列占「视口 - top」的 ' + util + '%');

  // ---------- 断言 ----------
  console.log('\n=========== 断言 ===========');
  var passes = 0, fails = 0;
  function A(label, pass, detail) {
    if (ok(label, pass, detail)) { passes++; } else { fails++; }
  }

  A('页面无纵向滚动条', M.pageH <= M.viewport.h + 1, 'pageH=' + M.pageH);
  A('左栏已拉伸（align-self:stretch 生效）', M.rail.alignSelf === 'stretch', M.rail.alignSelf);
  A('左栏卡片高度 === 右列高度（底边对齐）',
    Math.abs(M.railCard.bottom - M.work.bottom) <= 2,
    'railCard.bottom=' + M.railCard.bottom + ' work.bottom=' + M.work.bottom);
  A('左栏不再有 548px 空白（卡片高 > 400）', M.railCard.h > 400, 'railCard.h=' + M.railCard.h);

  A('表单保持 2 列', M.gridCols && M.gridCols.split(' ').length === 2, M.gridCols);
  A('列间距 18px', M.gridColGap === '18px', M.gridColGap);
  var phone = M.fields.filter(function (f) { return f.id === 'pf-phone'; })[0];
  var job = M.fields.filter(function (f) { return f.id === 'pf-job'; })[0];
  var city = M.fields.filter(function (f) { return f.id === 'pf-city'; })[0];
  A('手机号回到 2 列（不再独占整行）', phone && !phone.full, 'w=' + (phone ? phone.w : '-'));
  A('手机号与城市同行', phone && city && phone.top === city.top,
    'phone.top=' + (phone ? phone.top : '-') + ' city.top=' + (city ? city.top : '-'));
  A('岗位整行独占', job && job.full && job.w > 600, 'w=' + (job ? job.w : '-'));
  A('按钮条在 grid 内且跨满两列', M.actSpan === '1 / -1', M.actSpan);
  A('按钮条有分隔线', M.actBorderTop && M.actBorderTop.indexOf('1px') === 0, M.actBorderTop);
  A('按钮条与字段间距 >= 12px',
    parseFloat(M.actMarginTop) + parseFloat(M.actPaddingTop) >= 12,
    'mt=' + M.actMarginTop + ' pt=' + M.actPaddingTop);

  A('最近动态已渲染（非 hidden）', !!M.recent, M.recent ? 'h=' + M.recent.h : 'hidden');
  A('最近动态 3 条（问答/合同/文书）', M.recentCount === 3, '条数=' + M.recentCount);
  var hasBadge = M.recentMetas.join(' ').indexOf('风险') >= 0;
  A('合同条目带风险徽标（riskLevel 中文匹配 ZF.riskBadge）', hasBadge,
    M.recentMetas.join(' | '));
  A('收藏角标已显示', M.favTabCount && M.favTabCount !== '(hidden)', M.favTabCount);
  A('账号信息 5 行已渲染', M.acctRows.length === 5, '行数=' + M.acctRows.length);
  A('最近登录显示了真实时间（非「尚无记录」）',
    M.acctRows.join(' ').indexOf('最近登录=2026-09-16') >= 0,
    M.acctRows.filter(function (r) { return r.indexOf('最近登录') === 0; })[0] || '');
  A('账号信息未出现接口不存在的字段',
    M.acctRows.join(' ').indexOf('未设置') < 0,
    M.acctRows.join(' | '));

  // ---------- 截图 ----------
  var shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  var p1 = path.join(SHOT_DIR, '91-pf-profile-after.png');
  fs.writeFileSync(p1, Buffer.from(shot.result.data, 'base64'));
  console.log('\n截图 -> ' + p1);

  // ---------- 回归：切收藏页签 + 取消收藏 ----------
  console.log('\n=========== 回归：收藏页签 ===========');
  await send('Runtime.evaluate', {
    expression: "document.getElementById('tab-fav').click();"
  });
  await cdp.sleep(500);
  var fav = (await send('Runtime.evaluate', {
    expression: `(function(){
      var p = document.getElementById('favorites');
      var panel = document.getElementById('panel-profile');
      var items = document.querySelectorAll('#fav-list .zf-list__item');
      return {
        favHidden: p.hidden, profHidden: panel.hidden,
        favH: Math.round(p.getBoundingClientRect().height),
        profH: Math.round(panel.getBoundingClientRect().height),
        workH: Math.round(document.querySelector('.zf-work').getBoundingClientRect().height),
        railH: Math.round(document.querySelector('.zf-profile-rail > .zf-card').getBoundingClientRect().height),
        items: items.length,
        acctVisible: (function () {
          var a = document.getElementById('acct-box');
          return !!a && !a.hidden && a.getBoundingClientRect().height > 0;
        })(),
        acctRows: document.querySelectorAll('.zf-acct__row').length,
        first: items.length ? items[0].textContent.replace(/\\s+/g, ' ').trim().slice(0, 60) : ''
      };
    })()`, returnByValue: true
  })).result.result.value;
  console.log(JSON.stringify(fav, null, 2));
  A('切换后收藏面板可见 / 资料面板隐藏', !fav.favHidden && fav.profHidden);
  A('收藏列表有数据', fav.items > 0, 'items=' + fav.items);
  // 【断言修正】不能断言"左栏高度不变"：账号信息是常驻块，它下面接的是
  // 高度各异的 tabpanel（资料 389 / 收藏 351 / 密码 406），总高必然不同。
  // 真正要守的是「常驻块没被藏掉」（即切页签后账号信息仍在 DOM 且可见）。
  A('切到收藏页签后账号信息仍可见',
    fav.acctVisible && fav.acctRows === 5,
    'visible=' + fav.acctVisible + ' rows=' + fav.acctRows);
  A('切页签后左右仍等高', Math.abs(fav.railH - fav.workH) <= 2,
    'rail=' + fav.railH + ' work=' + fav.workH);

  var shot2 = await send('Page.captureScreenshot', { format: 'png' });
  var p2 = path.join(SHOT_DIR, '92-pf-fav-after.png');
  fs.writeFileSync(p2, Buffer.from(shot2.result.data, 'base64'));
  console.log('截图 -> ' + p2);

  // 密码页签高度
  await send('Runtime.evaluate', { expression: "document.getElementById('tab-pwd').click();" });
  await cdp.sleep(400);
  var pwd = (await send('Runtime.evaluate', {
    expression: `(function(){
      var panel = document.getElementById('panel-pwd');
      var r = panel.getBoundingClientRect();
      return { h: Math.round(r.height), bottom: Math.round(r.bottom),
               workH: Math.round(document.querySelector('.zf-work').getBoundingClientRect().height),
               railH: Math.round(document.querySelector('.zf-profile-rail > .zf-card').getBoundingClientRect().height) };
    })()`, returnByValue: true
  })).result.result.value;
  console.log('\n密码面板:', JSON.stringify(pwd));
  A('密码页签下左栏仍与右列等高', Math.abs(pwd.railH - pwd.workH) <= 2,
    'rail=' + pwd.railH + ' work=' + pwd.workH);
  var shot3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, '93-pf-pwd-after.png'),
    Buffer.from(shot3.result.data, 'base64'));

  // ---------- 窄屏 1100 ----------
  console.log('\n=========== 窄屏 1100 ===========');
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1100, height: 800, deviceScaleFactor: 1, mobile: false });
  await send('Runtime.evaluate', { expression: "document.getElementById('tab-profile').click();" });
  await cdp.sleep(500);
  var narrow = (await send('Runtime.evaluate', {
    expression: `(function(){
      function R(s){var e=document.querySelector(s); if(!e) return null;
        var c=getComputedStyle(e), r=e.getBoundingClientRect();
        return {h:Math.round(r.height), w:Math.round(r.width), alignSelf:c.alignSelf, height:c.height};}
      return { rail: R('.zf-profile-rail'), railCard: R('.zf-profile-rail > .zf-card'),
               work: R('.zf-work'), panel: R('#panel-profile'),
               deskCols: getComputedStyle(document.querySelector('.zf-desk')).gridTemplateColumns,
               pageH: document.documentElement.scrollHeight, vh: innerHeight };
    })()`, returnByValue: true
  })).result.result.value;
  console.log(JSON.stringify(narrow, null, 2));
  A('1100 塌单列后左栏 align-self 已撤回 auto', narrow.rail.alignSelf === 'auto', narrow.rail.alignSelf);
  // 【断言修正】不能断言 computedHeight === 'auto'。
  // 实测：塌单列后 desk h=895 / rail h=424，railCard 与 rail 等高是 grid 行内
  // 由内容决定的结果；alignSelf 全为 auto，且此视口 pageH(1006) > vh(800)，
  // .zf-content 作为 .zf-main 的 flex 子项比内容矮，这一串高度都是既有行为，
  // 与本轮的等高规则无关。真正要守住的是"本轮规则没有泄漏到单列态"：
  // align-self 撤回 + 右列不再被面板撑满。
  A('1100 右列面板不再被撑满（flex 分配已撤回）',
    narrow.work.h > narrow.panel.h + 40,
    'work=' + narrow.work.h + ' panel=' + narrow.panel.h);
  A('1100 左栏卡片与左栏等高（grid 行内一致）',
    Math.abs(narrow.rail.h - narrow.railCard.h) <= 1,
    'rail=' + narrow.rail.h + ' railCard=' + narrow.railCard.h);

  var shot4 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, '94-pf-1100-after.png'),
    Buffer.from(shot4.result.data, 'base64'));

  // ---------- 窄屏 820 ----------
  await send('Emulation.setDeviceMetricsOverride',
    { width: 820, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.sleep(500);
  var w820 = (await send('Runtime.evaluate', {
    expression: `(function(){
      var g=document.querySelector('#profile-form .zf-fill-grid');
      var phoneDiv=document.querySelector('#pf-phone').closest('.zf-field');
      var cityDiv=document.querySelector('#pf-city').closest('.zf-field');
      return { cols: getComputedStyle(g).gridTemplateColumns,
               phoneTop: Math.round(phoneDiv.getBoundingClientRect().top),
               cityTop: Math.round(cityDiv.getBoundingClientRect().top),
               pageH: document.documentElement.scrollHeight,
               overflowX: document.documentElement.scrollWidth > innerWidth };
    })()`, returnByValue: true
  })).result.result.value;
  console.log('\n820:', JSON.stringify(w820));
  A('820 无横向溢出', !w820.overflowX);
  var shot5 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(SHOT_DIR, '95-pf-820-after.png'),
    Buffer.from(shot5.result.data, 'base64'));

  console.log('\n=========== 汇总 ===========');
  console.log('PASS ' + passes + ' / FAIL ' + fails);
  await send('Page.close').catch(function () {});
  process.exit(fails ? 1 : 0);
})().catch(function (e) {
  console.error('ERROR', e);
  process.exit(2);
});
