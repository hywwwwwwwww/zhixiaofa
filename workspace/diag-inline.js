/**
 * 决定性实验：用内联样式（最高特异性）设置 grid-area，看布局能否如预期。
 *
 * 如果内联生效 → 说明是我的选择器/层叠问题，继续查规则顺序；
 * 如果内联也不生效 → 说明是别的东西在干扰（如父级 grid-area 冲突）。
 */
var path = require('path');
var fs = require('fs');
var cdp = require(path.join(process.env.USERPROFILE,
  '.workbuddy', 'binaries', 'node', 'workspace', 'cdp.js'));

var PORT = process.argv[2] || '9405';
var BASE = 'http://127.0.0.1:' + PORT;
var FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitex/__none__/x.html';

FILE_URL = 'file:///D:/Program%20Files%20(x86)/gitee/zhixiaofa/src/main/webapp/pages/home.html';

var APPLY = `(function () {
  var c = document.querySelector('#stat-grid .zf-stat');
  var ico = c.querySelector('.zf-stat__icon');
  var txt = c.querySelector('div:not(.zf-stat__icon)');
  var go = c.querySelector('.zf-stat__go');
  // 内联三大件
  ico.style.gridArea = '1 / 1 / 2 / 2';
  ico.style.alignSelf = 'start';
  if (txt) { txt.style.gridArea = '1 / 2 / 2 / 3'; txt.style.minWidth = '0'; txt.style.textAlign = 'left'; }
  go.style.gridArea = '2 / 1 / 3 / 3';
  go.style.justifySelf = 'end';
  c.style.alignItems = 'start';
  c.style.justifyItems = 'start';
  var r1 = ico.getBoundingClientRect();
  var cr = c.getBoundingClientRect();
  var cs = getComputedStyle(c);
  return {
    inlineGridArea: getComputedStyle(ico).gridArea,
    cardLeft: +cr.left.toFixed(1),
    padL: parseFloat(cs.paddingLeft),
    iconLeft: +r1.left.toFixed(1),
    iconOff: +(r1.left - (cr.left + parseFloat(cs.paddingLeft))).toFixed(1),
    iconW: +r1.width.toFixed(1),
    colTemplate: cs.gridTemplateColumns
  };
})()`;

(async function () {
  var tab = await cdp.httpPut(BASE + '/json/new?about:blank');
  var ws = await cdp.connect(tab.webSocketDebuggerUrl);
  var send = ws.send;
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: fs.readFileSync(path.join(__dirname, 'zc-stub-home.js'), 'utf8')
  });
  await send('Emulation.setDeviceMetricsOverride',
    { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await send('Page.navigate', { url: FILE_URL });
  await cdp.sleep(2200);

  var before = await send('Runtime.evaluate', {
    expression: `(function(){var i=document.querySelector('#stat-grid .zf-stat__icon');
      return {gridArea:getComputedStyle(i).gridArea};})()`, returnByValue: true });
  console.log('内联前 gridArea:', JSON.stringify(before.result.result.value));

  var after = await send('Runtime.evaluate', { expression: APPLY, returnByValue: true });
  console.log('内联后:', JSON.stringify(after.result.result.value || after.result.value, null, 2));
  process.exit(0);
})();
