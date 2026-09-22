
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http'); var fs = require('fs');
var CDP = 9363, APP = 8080, HOST='127.0.0.1', CTX='/zhixiaofa';
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
var PAGES = [
  ['/pages/home.html',      '首页'],
  ['/pages/profile.html',   '个人中心'],
  ['/pages/court.html',     '小法庭'],
  ['/pages/contract-review.html','合同审查'],
  ['/pages/qa.html',        '法律问答'],
  ['/pages/knowledge.html', '普法文章']
];
(async function(){
  var t=await httpPut('http://'+HOST+':'+CDP+'/json/new?about:blank');
  var conn=await cdp.connect(t.webSocketDebuggerUrl); var send=conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Network.setCookie',{name:'JSESSIONID',value:COOKIE,domain:HOST,path:CTX,url:'http://'+HOST+':'+APP+CTX+'/'});
  for(var k=0;k<PAGES.length;k++){
    var path=PAGES[k][0], name=PAGES[k][1];
    await send('Page.navigate',{url:'http://'+HOST+':'+APP+CTX+path});
    await sleep(2600);
    var r = await ev(send, 'JSON.stringify((function(){'+
      'var q=function(s){return document.querySelector(s);};'+
      'var bad=function(sel){var e=q(sel);if(!e)return null;var cs=getComputedStyle(e);return cs.display;};'+
      'return {href:location.pathname, title:document.title,'+
      ' bodyCls:document.body.className,'+
      ' isGrid:q(".zf-grid")?getComputedStyle(q(".zf-grid")).display:null,'+
      ' cardCount:document.querySelectorAll(".zf-card").length,'+
      ' statIcon:q(".zf-stat__icon")?getComputedStyle(q(".zf-stat__icon")).backgroundColor:null,'+
      ' chartBorder:q(".zf-chart")?getComputedStyle(q(".zf-chart")).borderTopWidth:null,'+
      ' docH:document.documentElement.scrollHeight,'+
      ' errs:(window.__e||[]).length};})())');
    var d=JSON.parse(r);
    var onPage = d.href.indexOf(path.replace('.html',''))>=0;
    chk(name+' 打开正确 ('+path+')', onPage, d.href);
    chk(name+' 无 JS 报错', d.errs===0, d.errs);
    if(k===0){
      chk('首页 .zf-grid 仍是 grid（未被 admin 的 flex 波及）', d.isGrid==='grid', d.isGrid);
      console.log('       首页 body.class = "'+d.bodyCls+'"  (应不含 zf-admin-page)');
      chk('首页 body 无 zf-admin-page 类', d.bodyCls.indexOf('zf-admin-page')<0, d.bodyCls);
      chk('首页有卡片', d.cardCount>0, d.cardCount);
    }
    if(path.indexOf('/pages/')>=0 && (path.indexOf('court')>=0||path.indexOf('contract')>=0)){
      chk(name+' .zf-chart 仍有自己的边框（admin 规则未外溢）', d.chartBorder!=='0px', d.chartBorder);
    }
  }
  console.log('');
  console.log('用户端通过 '+pass+' / '+(pass+fail));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function(e){console.log('FATAL '+(e&&e.stack||e));process.exit(1);});
