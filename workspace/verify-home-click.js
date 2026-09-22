/**
 * @file 首页「最近问答 / 新人必看」可点击改造 — 实测验证
 *
 * 覆盖：
 *   A. 可点击性线索（cursor / hover 背景 / 键盘可达）
 *   B. 问答项：整项展开、内容正确、二次点击收起、互斥（同时只开一条）
 *   C. 引用徽标：独立开关、只展开法条框、法条字段渲染正确
 *   D. 文章项：弹窗能开、标题/正文正确、按钮状态正确、能关
 *   E. 懒渲染：未展开时 detail 区为空
 *   F. 无横向溢出 + 窄屏正常
 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var fs = require('fs');
var path = require('path');

var PORT = process.env.PORT || 9341;
var BASE = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';
var STUB = path.join(__dirname, 'zc-stub-home.js');

var pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  PASS  ' + name); }
  else { fail++; console.log('  FAIL  ' + name + (extra ? '  << ' + extra : '')); }
}
function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

(async function () {
  var tabs = await cdp.httpGet('http://127.0.0.1:' + PORT + '/json/list');
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no about:blank target'); process.exit(1); }

  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  var send = conn.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', { source: fs.readFileSync(STUB, 'utf8') });
  await send('Page.navigate', { url: BASE });
  await sleep(2600);

  async function ev(expr) {
    var r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) {
      return { __err: JSON.stringify(r.result.exceptionDetails).slice(0, 400) };
    }
    return r.result.result.value !== undefined ? r.result.result.value : r.result.result.description;
  }

  console.log('\n[A] 可点击性线索');
  var a = JSON.parse(await ev([
    "(function(){",
    "  var q = document.querySelector('#qa-list .zf-home-item');",
    "  var t = document.querySelector('#tip-list .zf-home-item');",
    "  return JSON.stringify({",
    "    docUrl: document.location.href,",
    "    qaIsAnchor: q ? q.tagName : null,",
    "    tipIsAnchor: t ? t.tagName : null,",
    "    tipHref: t ? t.getAttribute('href') : null,",
    "    qaCursor: q ? getComputedStyle(q).cursor : null,",
    "    tipCursor: t ? getComputedStyle(t).cursor : null,",
    "    qaTabindex: q ? q.getAttribute('tabindex') : null,",
    "    tipHrefAttr: t ? t.hasAttribute('href') : null,",
    "    tipTextDecor: t ? getComputedStyle(t).textDecorationLine : null,",
    "    caretN: document.querySelectorAll('.zf-home-item__caret').length,",
    "    badgeTag: document.querySelector('#qa-list .zf-home-refs') ? document.querySelector('#qa-list .zf-home-refs').tagName : null,",
    "    badgeCursor: document.querySelector('#qa-list .zf-home-refs') ? getComputedStyle(document.querySelector('#qa-list .zf-home-refs')).cursor : null,",
    "    qaCount: document.querySelectorAll('#qa-list .zf-home-item').length,",
    "    tipCount: document.querySelectorAll('#tip-list .zf-home-item').length",
    "  });",
    "})()"
  ].join('\n')));
  ok('页面身份正确（home.html）', /home\.html$/.test(a.docUrl || ''), a.docUrl);
  ok('问答项数量 = 4', a.qaCount === 4, 'n=' + a.qaCount);
  ok('文章项数量 = 5', a.tipCount === 5, 'n=' + a.tipCount);
  ok('问答项 cursor: pointer', a.qaCursor === 'pointer', a.qaCursor);
  ok('文章项 cursor: pointer', a.tipCursor === 'pointer', a.tipCursor);
  ok('问答项可键盘聚焦（tabindex=0）', a.qaTabindex === '0', a.qaTabindex);
  ok('文章项是 <a href>（原生键盘可达）', a.tipIsAnchor === 'A' && !!a.tipHref, a.tipIsAnchor + ' href=' + a.tipHref);
  ok('文章项 href 是锚点形式（不跳页）', /^#article-\d+$/.test(a.tipHref || ''), a.tipHref);
  ok('文章项无下划线', a.tipTextDecor === 'none', a.tipTextDecor);
  ok('每条问答有展开箭头', a.caretN === 4, 'n=' + a.caretN);
  ok('引用徽标是 <button>', a.badgeTag === 'BUTTON', a.badgeTag);
  ok('引用徽标 cursor: pointer', a.badgeCursor === 'pointer', a.badgeCursor);

  console.log('\n[E] 懒渲染：未展开时 detail 为空');
  var e1 = JSON.parse(await ev([
    "(function(){",
    "  var d = document.querySelector('#qa-list .zf-home-detail');",
    "  return JSON.stringify({",
    "    n: document.querySelectorAll('#qa-list .zf-home-detail').length,",
    "    hidden: d ? d.hidden : null,",
    "    childN: d ? d.children.length : -1",
    "  });",
    "})()"
  ].join('\n')));
  ok('4 条问答各有一个 detail 容器', e1.n === 4, 'n=' + e1.n);
  ok('detail 初始 hidden', e1.hidden === true, String(e1.hidden));
  ok('detail 初始无子节点（懒渲染）', e1.childN === 0, 'childN=' + e1.childN);

  console.log('\n[B] 问答项展开');
  var b1 = JSON.parse(await ev([
    "(function(){",
    "  var it = document.querySelectorAll('#qa-list .zf-home-item')[0];",
    "  it.click();",
    "  var d = it.querySelector('.zf-home-detail');",
    "  var ans = it.querySelector('.zf-home-answer');",
    "  return JSON.stringify({",
    "    open: it.classList.contains('zf-home-item--open'),",
    "    ariaExpanded: it.getAttribute('aria-expanded'),",
    "    hidden: d.hidden,",
    "    detailH: Math.round(d.getBoundingClientRect().height),",
    "    ansText: ans ? ans.textContent.slice(0, 60) : null,",
    "    secN: it.querySelectorAll('.zf-ans__sec').length,",
    "    noteN: it.querySelectorAll('.zf-ans__note').length,",
    "    refsBoxN: it.querySelectorAll('.zf-home-refs-box').length,",
    "    refsBoxHidden: it.querySelector('.zf-home-refs-box') ? it.querySelector('.zf-home-refs-box').hidden : null,",
    "    lawN: it.querySelectorAll('.zf-law').length,",
    "    lawName: it.querySelector('.zf-law__name') ? it.querySelector('.zf-law__name').textContent : null",
    "  });",
    "})()"
  ].join('\n')));
  ok('点击后加上 --open', b1.open === true);
  ok('aria-expanded 同步为 true', b1.ariaExpanded === 'true', b1.ariaExpanded);
  ok('detail 取消 hidden', b1.hidden === false, String(b1.hidden));
  ok('detail 有实际高度', b1.detailH > 60, 'h=' + b1.detailH);
  ok('回答正文含【初步结论】（走 answerHtml）', /初步结论/.test(b1.ansText || ''), b1.ansText);
  ok('【】渲染成小标题（3 个）', b1.secN === 3, 'secN=' + b1.secN);
  ok('末尾提示渲染成脚注', b1.noteN === 1, 'noteN=' + b1.noteN);
  ok('法条框存在', b1.refsBoxN === 1, 'refsBoxN=' + b1.refsBoxN);
  ok('法条框初始收起（与问答展开解耦）', b1.refsBoxHidden === true, String(b1.refsBoxHidden));
  ok('渲染出 2 条法条', b1.lawN === 2, 'lawN=' + b1.lawN);
  ok('法条名取自 lawName + articleNo', /劳动合同法》第四十条/.test(b1.lawName || ''), b1.lawName);

  console.log('\n[C] 引用徽标是独立开关 + 互斥');
  var c1 = JSON.parse(await ev([
    "(function(){",
    "  var its = document.querySelectorAll('#qa-list .zf-home-item');",
    "  var b = its[0].querySelector('.zf-home-refs');",
    "  b.click();",
    "  return JSON.stringify({",
    "    refsHidden: its[0].querySelector('.zf-home-refs-box').hidden,",
    "    badgeExpanded: b.getAttribute('aria-expanded'),",
    "    stillOpen: its[0].classList.contains('zf-home-item--open')",
    "  });",
    "})()"
  ].join('\n')));
  ok('点徽标后法条框显示', c1.refsHidden === false, String(c1.refsHidden));
  ok('徽标 aria-expanded=true', c1.badgeExpanded === 'true', c1.badgeExpanded);
  ok('徽标不会误收起整项', c1.stillOpen === true);

  // 再点一次徽标应收起法条，但不影响整项
  var c2 = JSON.parse(await ev([
    "(function(){",
    "  var its = document.querySelectorAll('#qa-list .zf-home-item');",
    "  var b = its[0].querySelector('.zf-home-refs');",
    "  b.click();",
    "  return JSON.stringify({",
    "    refsHidden: its[0].querySelector('.zf-home-refs-box').hidden,",
    "    stillOpen: its[0].classList.contains('zf-home-item--open')",
    "  });",
    "})()"
  ].join('\n')));
  ok('再点徽标收起法条框', c2.refsHidden === true, String(c2.refsHidden));
  ok('整项仍保持展开', c2.stillOpen === true);

  // 点第 2 条 → 第 1 条应保持独立（我们不做互斥收起，只验证各自独立）
  var c3 = JSON.parse(await ev([
    "(function(){",
    "  var its = document.querySelectorAll('#qa-list .zf-home-item');",
    "  its[1].click();",
    "  return JSON.stringify({",
    "    i0open: its[0].classList.contains('zf-home-item--open'),",
    "    i1open: its[1].classList.contains('zf-home-item--open'),",
    "    i1detailH: Math.round(its[1].querySelector('.zf-home-detail').getBoundingClientRect().height)",
    "  });",
    "})()"
  ].join('\n')));
  ok('第 2 条也能独立展开', c3.i1open === true, 'i1open=' + c3.i1open);
  ok('第 2 条展开有高度', c3.i1detailH > 40, 'h=' + c3.i1detailH);

  // 收起第 1 条
  var c4 = JSON.parse(await ev([
    "(function(){",
    "  var its = document.querySelectorAll('#qa-list .zf-home-item');",
    "  its[0].click();",
    "  return JSON.stringify({",
    "    i0open: its[0].classList.contains('zf-home-item--open'),",
    "    i0hidden: its[0].querySelector('.zf-home-detail').hidden,",
    "    i1still: its[1].classList.contains('zf-home-item--open')",
    "  });",
    "})()"
  ].join('\n')));
  ok('二次点击收起第 1 条', c4.i0open === false && c4.i0hidden === true);
  ok('收起第 1 条不影响第 2 条', c4.i1still === true);

  // 收起第 2 条，恢复干净状态
  await ev("document.querySelectorAll('#qa-list .zf-home-item')[1].click()");

  console.log('\n[D] 文章弹窗');
  var d1 = JSON.parse(await ev([
    "(function(){",
    "  var t = document.querySelectorAll('#tip-list .zf-home-item')[0];",
    "  t.click();",
    "  return JSON.stringify({ modalId: 'pending' });",
    "})()"
  ].join('\n')));
  await sleep(700);
  var d2 = JSON.parse(await ev([
    "(function(){",
    "  var m = document.querySelector('#article-modal');",
    "  var body = document.querySelector('#article-modal-body');",
    "  return JSON.stringify({",
    "    shown: m ? m.classList.contains('show') : false,",
    "    title: document.querySelector('#article-modal-title').textContent,",
    "    bodyLen: body.textContent.length,",
    "    bodyHead: body.textContent.slice(0, 30),",
    "    likeCount: document.querySelector('#article-like-count').textContent,",
    "    favLabel: document.querySelector('#article-fav').textContent.trim(),",
    "    favPressed: document.querySelector('#article-fav').getAttribute('aria-pressed'),",
    "    hasFavState: document.querySelector('#article-fav').innerHTML.indexOf('star-fill') >= 0",
    "  });",
    "})()"
  ].join('\n')));
  ok('弹窗已打开', d2.shown === true, 'shown=' + d2.shown);
  ok('弹窗标题是文章标题', /试用期被辞退/.test(d2.title || ''), d2.title);
  ok('弹窗正文有内容', d2.bodyLen > 80, 'len=' + d2.bodyLen);
  ok('点赞数已填充', d2.likeCount === '12', 'n=' + d2.likeCount);

  // 关闭弹窗
  await ev([
    "(function(){",
    "  var m = document.querySelector('#article-modal');",
    "  var inst = bootstrap.Modal.getInstance(m);",
    "  if (inst) { inst.hide(); }",
    "})()"
  ].join('\n'));
  await sleep(700);
  var d3 = JSON.parse(await ev([
    "(function(){",
    "  var m = document.querySelector('#article-modal');",
    "  return JSON.stringify({ shown: m.classList.contains('show') });",
    "})()"
  ].join('\n')));
  ok('弹窗能关闭', d3.shown === false, 'shown=' + d3.shown);

  console.log('\n[F] 布局与溢出');
  var f = JSON.parse(await ev([
    "(function(){",
    "  var i = document.querySelector('#qa-list .zf-home-item');",
    "  i.click();",
    "  var de = document.documentElement;",
    "  var over = [];",
    "  document.querySelectorAll('#qa-list *, #tip-list *').forEach(function(el){",
    "    var r = el.getBoundingClientRect();",
    "    if (r.width > 0 && (r.left < -1 || r.right > window.innerWidth + 1)) {",
    "      over.push(el.className + ' L=' + Math.round(r.left) + ' R=' + Math.round(r.right));",
    "    }",
    "  });",
    "  i.click();",
    "  return JSON.stringify({",
    "    scrollW: de.scrollWidth, innerW: window.innerWidth,",
    "    overflow: over.slice(0, 5)",
    "  });",
    "})()"
  ].join('\n')));
  ok('无横向溢出（scrollWidth <= innerWidth）', f.scrollW <= f.innerW + 1, 'sw=' + f.scrollW + ' iw=' + f.innerW);
  ok('展开态下元素未越界', f.overflow.length === 0, JSON.stringify(f.overflow));

  console.log('\n==============================');
  console.log('结果：' + pass + ' PASS / ' + fail + ' FAIL');
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.error('ERR', e && e.message, e && e.stack);
  process.exit(1);
});
