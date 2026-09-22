/* 浏览器级验证：真点列头，看行序是否变化 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http'); var fs = require('fs');
var CDP = 9363, APP = 8090, HOST = '127.0.0.1', CTX = '/zhixiaofa';
var COOKIE = __CK__;
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function httpPut(u){return new Promise(function(res,rej){var x=new URL(u);
 var q=http.request({hostname:x.hostname,port:x.port,path:x.pathname+x.search,method:'PUT'},function(r){
  var b='';r.on('data',function(c){b+=c;});r.on('end',function(){try{res(JSON.parse(b));}catch(e){res({raw:b});}});});
 q.on('error',rej);q.end();});}
function closeTab(id){return new Promise(function(res){var q=http.request({hostname:HOST,port:CDP,path:'/json/close/'+id,method:'GET'},function(r){r.resume();r.on('end',res);});q.on('error',function(){res();});q.end();});}
async function ev(send,e){var r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r&&r.result&&r.result.exceptionDetails){return 'EXC:'+JSON.stringify(r.result.exceptionDetails).slice(0,260);}
 return r&&r.result&&r.result.result?r.result.result.value:undefined;}
var pass=0,fail=0;
function chk(n,ok,extra){ if(ok){pass++;console.log('  OK   '+n);} else {fail++;console.log('  FAIL '+n+'   '+(extra===undefined?'':extra));} }

var FIRST_ID = '(function(){var t=document.querySelector("#user-table tbody tr td");return t?t.textContent.trim():null;})()';
var CLICK_TH = function(txt){ return '(function(){var hs=document.querySelectorAll("#user-table th");' +
  'for(var i=0;i<hs.length;i++){var s=(hs[i].innerText||"").trim();' +
  'if(s.indexOf("'+txt+'")===0||s==="'+txt+'"){var d=hs[i].querySelector(".th-inner")||hs[i];' +
  'd.dispatchEvent(new MouseEvent("click",{bubbles:true}));return i;}}return -1;})()'; };

(async function(){
  var t=await httpPut('http://'+HOST+':'+CDP+'/json/new?about:blank');
  var conn=await cdp.connect(t.webSocketDebuggerUrl); var send=conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Network.setCookie',{name:'JSESSIONID',value:COOKIE,domain:HOST,path:CTX,url:'http://'+HOST+':'+APP+CTX+'/'});
  await send('Page.navigate',{url:'http://'+HOST+':'+APP+CTX+'/admin/users.html'});
  await sleep(3800);

  console.log('===== A. 初始顺序（users.html 默认 sortName=id / desc）=====');
  var v0 = await ev(send, FIRST_ID);
  console.log('  首行 ID = %s （期望 16，即 id DESC）' % v0);
  chk('初始为 id 倒序', v0 === '16', v0);

  console.log('===== B. 点「ID」列头 → 应切到升序（首行 1）=====');
  var idx = await ev(send, CLICK_TH('ID'));
  await sleep(1400);
  var v1 = await ev(send, FIRST_ID);
  console.log('  点击列索引=%s 后首行 ID = %s' % (idx, v1));
  chk('切到升序，首行变成 1', v1 === '1', v1);

  console.log('===== C. 再点一次 → 回倒序（首行 16）=====');
  await ev(send, CLICK_TH('ID'));
  await sleep(1400);
  var v2 = await ev(send, FIRST_ID);
  console.log('  首行 ID = %s' % v2);
  chk('切回降序，首行 16', v2 === '16', v2);

  console.log('===== D. 点「注册时间」列头 → 按时间排序 =====');
  await ev(send, CLICK_TH('注册时间'));
  await sleep(1500);
  var times = await ev(send, '(function(){var r=document.querySelectorAll("#user-table tbody tr");' +
    'var out=[];for(var i=0;i<Math.min(3,r.length);i++){out.push(r[i].querySelectorAll("td")[7].textContent.trim());}return out.join(" | ");})()');
  console.log('  前 3 行注册时间 = %s' % times);
  chk('表格已重排（有数据返回）', !!times && times.length > 5, times);
  var shot = await send('Page.captureScreenshot', {format:'png'});
  fs.writeFileSync(require('path').join(__dirname,'shots','250-sort-users.png'), Buffer.from(shot.result.data,'base64'));
  console.log('  截图 shots/250-sort-users.png');

  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass+fail));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function(e){console.log('FATAL '+(e&&e.stack||e));process.exit(1);});
