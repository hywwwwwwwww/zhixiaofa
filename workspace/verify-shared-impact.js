/**
 * 本轮 CSS 共享受影响面核查（修正版）。
 * 关键点：本轮所有对 .zf-fill-grid / .zf-work > [role=tabpanel] / .zf-actions-end
 * 的改动都带了 .zf-content--profile 前缀，本脚本逐页断言"确实没泄漏"。
 *
 * 前版探针错在：doc-drafting 根本没有 .zf-fill-grid（那是 court/contract 的类），
 * court 也没有 .zf-work > [role=tabpanel]。这里改成按各页真实结构取。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9402';
var BASE = 'http://127.0.0.1:' + PORT;
var ROOT = 'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/pages/';
var STUB_DIR = path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace');

var PROBE = `(function(){
  function g(sel, prop){ var e=document.querySelector(sel);
    return e ? getComputedStyle(e)[prop] : null; }
  var fg = document.querySelector('.zf-fill-grid');
  var panel = document.querySelector('.zf-work > [role="tabpanel"]');
  var acts = document.querySelector('.zf-actions-end');
  return {
    vh: innerHeight, pageH: document.documentElement.scrollHeight, title: document.title,
    hasFillGrid: !!fg,
    fillColGap: fg ? getComputedStyle(fg).columnGap : null,
    fillRowGap: fg ? getComputedStyle(fg).rowGap : null,
    fillCols: fg ? getComputedStyle(fg).gridTemplateColumns : null,
    actsInGrid: !!(acts && acts.parentElement &&
      acts.parentElement.classList.contains('zf-fill-grid')),
    hasWorkPanel: !!panel,
    panelMaxH: panel ? getComputedStyle(panel).maxHeight : null,
    panelFlex: panel ? getComputedStyle(panel).flex : null,
    // profile 专属类绝不该出现在别的页面
    hasAcct: !!document.querySelector('.zf-acct'),
    hasRecent: !!document.querySelector('.zf-recent'),
    hasProfileScope: !!document.querySelector('.zf-profile-rail'),
    deskCols: g('.zf-desk', 'gridTemplateColumns')
  };
})()`;

var CASES = [
  { file: 'doc-drafting.html', stub: 'zc-stub-doc.js' },
  { file: 'court.html', stub: 'zc-stub.js' },
  { file: 'knowledge.html', stub: 'zc-stub-kn.js' },
  { file: 'contract-review.html', stub: 'zc-stub.js' }
];

(async function () {
  var pass = 0, fail = 0;
  function A(label, ok, detail) {
    if (ok) { pass++; } else { fail++; }
    console.log((ok ? '  [PASS] ' : '  [FAIL] ') + label + (detail != null ? '  ' + detail : ''));
  }

  for (var i = 0; i < CASES.length; i++) {
    var c = CASES[i];
    console.log('\n########## ' + c.file);
    var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
    var ws = await cdp.connect(tab.webSocketDebuggerUrl);
    var send = ws.send;
    await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    var sp = path.join(STUB_DIR, c.stub);
    if (fs.existsSync(sp)) {
      await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(sp, 'utf8') });
    }
    await send('Page.navigate', { url: 'file:///' + ROOT.replace(/ /g, '%20') + c.file });
    await cdp.sleep(2500);

    var d = (await send('Runtime.evaluate', { expression: PROBE, returnByValue: true })).result.result.value;
    console.log('  ' + JSON.stringify(d));

    A('页面已加载', /职小法/.test(d.title || ''), d.title);
    // 核心：profile 专属类与作用域规则绝不能出现在其他页面
    A('无 .zf-acct（profile 专属）', !d.hasAcct);
    A('无 .zf-recent（profile 专属）', !d.hasRecent);
    A('无 .zf-profile-rail（profile 专属）', !d.hasProfileScope);
    if (d.hasFillGrid) {
      A('.zf-fill-grid 列间距仍是 16px（未被 profile 的 18px 污染）',
        d.fillColGap === '16px', d.fillColGap);
      A('.zf-fill-grid 行间距仍是 14px', d.fillRowGap === '14px', d.fillRowGap);
      A('.zf-actions-end 仍在网格之外', !d.actsInGrid);
    } else {
      console.log('  (本页无 .zf-fill-grid，跳过栅格断言)');
    }
    if (d.hasWorkPanel) {
      A('.zf-work 面板 max-height 未被改成 none（桌面态）',
        d.panelMaxH !== 'none', d.panelMaxH);
      A('页签面板未被加上 flex 撑满规则', d.panelFlex === '0 1 auto', d.panelFlex);
    } else {
      console.log('  (本页无 .zf-work 页签面板，跳过)');
    }
    await send('Page.close').catch(function () {});
  }
  console.log('\n===== 共享受影响面：PASS ' + pass + ' / FAIL ' + fail + ' =====');
  process.exit(fail ? 1 : 0);
})().catch(function (e) { console.error('ERROR', e); process.exit(2); });
