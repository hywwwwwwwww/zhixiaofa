var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');

(async function () {
  console.log('step1: list');
  var tabs = await cdp.httpGet('http://127.0.0.1:9341/json/list');
  console.log('step1 ok, tabs =', tabs.length);
  var target = null;
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].type === 'page' && tabs[i].url === 'about:blank') { target = tabs[i]; break; }
  }
  if (!target) { console.log('no about:blank target'); console.log(JSON.stringify(tabs.map(function(t){return t.url;}))); process.exit(1); }
  console.log('step2: connect', target.webSocketDebuggerUrl);
  var conn = await cdp.connect(target.webSocketDebuggerUrl);
  console.log('step2 ok, has send =', typeof conn.send, 'has socket =', typeof conn.socket);
  var r = await conn.send('Runtime.evaluate', { expression: '1+1', returnByValue: true });
  console.log('step3 ok:', JSON.stringify(r));
  process.exit(0);
})().catch(function (e) { console.error('ERR', e && e.message, e && e.stack); process.exit(1); });
