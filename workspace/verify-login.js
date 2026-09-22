/* 验证：登录后按角色进对应首页 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http'); var fs = require('fs');
var CDP = 9363, APP = 8080, HOST = '127.0.0.1', CTX = '/zhixiaofa';
var CK_ADMIN = __CKA__, CK_USER = __CKU__;
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function httpPut(u){return new Promise(function(res,rej){var x=new URL(u);
 var q=http.request({hostname:x.hostname,port:x.port,path:x.pathname+x.search,method:'PUT'},function(r){
  var b='';r.on('data',function(c){b+=c;});r.on('end',function(){try{res(JSON.parse(b));}catch(e){res({raw:b});}});});
 q.on('error',rej);q.end();});}
function closeTab(id){return new Promise(function(res){var q=http.request({hostname:HOST,port:CDP,path:'/json/close/'+id,method:'GET'},function(r){r.resume();r.on('end',res);});q.on('error',function(){res();});q.end();});}
async function ev(send,e){var r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r&&r.result&&r.result.exceptionDetails){return 'EXC:'+JSON.stringify(r.result.exceptionDetails).slice(0,240);}
 return r&&r.result&&r.result.result?r.result.result.value:undefined;}
var pass=0,fail=0;
function chk(n,ok,extra){ if(ok){pass++;console.log('   OK   '+n);} else {fail++;console.log('   FAIL '+n+'   实际='+(extra===undefined?'':extra));} }
function where(href){ return String(href).replace('http://'+HOST+':'+APP+CTX, ''); }

(async function(){
  var t=await httpPut('http://'+HOST+':'+CDP+'/json/new?about:blank');
  var conn=await cdp.connect(t.webSocketDebuggerUrl); var send=conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});

  async function clearCk(){ await send('Network.clearBrowserCookies'); }
  async function setCk(v){ await send('Network.setCookie',{name:'JSESSIONID',value:v,domain:HOST,path:CTX,url:'http://'+HOST+':'+APP+CTX+'/'}); }
  async function go(path){ await send('Page.navigate',{url:'http://'+HOST+':'+APP+CTX+path}); await sleep(3000); return where(await ev(send,'location.href')); }
  async function formLogin(u,p){
    await clearCk();
    await go('/login.html');
    var filled = await ev(send, '(function(){' +
      'var p=document.querySelector("#panel-login");if(!p)return "no-panel";' +
      'var f=p.querySelector("form")||p;' +
      'var iu=f.querySelector("[name=username]"),ip=f.querySelector("[name=password]");' +
      'if(!iu||!ip)return "no-input";' +
      'iu.value=' + JSON.stringify(u) + ';ip.value=' + JSON.stringify(p) + ';' +
      'try{jQuery("#panel-login").trigger("submit");}catch(e){return "trigger-err:"+e.message;}' +
      'return "submitted user="+iu.value;})()');
    await sleep(3600);
    var href = await ev(send,'location.href');
    return { filled: filled, landed: where(href) };
  }

  console.log('===== A. 管理员用登录表单登录 → 应进后台 =====');
  var a = await formLogin('admin','admin123');
  console.log('   提交=' + a.filled + '  落地=' + a.landed);
  chk('管理员登录后进后台管理', a.landed === '/admin/index.html', a.landed);

  console.log('===== B. 普通用户用登录表单登录 → 应进前台首页 =====');
  var b = await formLogin('zhangsan','123456');
  console.log('   提交=' + b.filled + '  落地=' + b.landed);
  chk('普通用户登录后进前台首页', b.landed === '/pages/home.html', b.landed);

  console.log('===== C. 管理员已登录时打开根入口 /index.html → 应进后台 =====');
  await clearCk(); await setCk(CK_ADMIN);
  var c = await go('/index.html');
  console.log('   落地=%s' % c);
  chk('根入口按角色进后台', c === '/admin/index.html', c);

  console.log('===== D. 普通用户已登录时打开 /index.html → 应进前台 =====');
  await clearCk(); await setCk(CK_USER);
  var d = await go('/index.html');
  console.log('   落地=%s' % d);
  chk('根入口按角色进前台', d === '/pages/home.html', d);

  console.log('===== E. 管理员已登录时打开 /login.html → 应进后台 =====');
  await clearCk(); await setCk(CK_ADMIN);
  var e = await go('/login.html');
  console.log('   落地=%s' % e);
  chk('登录页已登录时按角色跳转', e === '/admin/index.html', e);

  console.log('===== F. 后台里没有用户端入口（侧边栏 9 项 + 无 /pages/ 链接）=====');
  await clearCk(); await setCk(CK_ADMIN);
  await go('/admin/index.html');
  var f = await ev(send, 'JSON.stringify({' +
    'nav:(function(){var a=document.querySelectorAll(".zf-admin-sidebar .zf-sidebar__nav a");var t=[];for(var i=0;i<a.length;i++)t.push(a[i].textContent.trim());return t;})()' +
    '})');
  var fd = JSON.parse(f);
  console.log('   侧边栏导航 = ' + JSON.stringify(fd.nav));
  chk('侧边栏只有 9 项管理功能', fd.nav.length === 9, fd.nav.length);
  var userNav = fd.nav.filter(function(x){ return /提问|我的|个人中心|文书起草|合同审查|知识|小法庭/.test(x); });
  chk('侧边栏无用户端功能', userNav.length === 0, JSON.stringify(userNav));
  var shot = await send('Page.captureScreenshot', {format:'png'});
  fs.writeFileSync(require('path').join(__dirname,'shots','260-admin-landing.png'), Buffer.from(shot.result.data,'base64'));
  console.log('   截图 shots/260-admin-landing.png');

  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass+fail));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function(e){console.log('FATAL '+(e&&e.stack||e));process.exit(1);});
