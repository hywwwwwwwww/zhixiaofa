/* 验证自定义下拉：渲染、展开、取值回写、change 事件、截图 */
var cdp = require('C:/Users/Hanyuw/.workbuddy/binaries/node/workspace/cdp.js');
var http = require('http');
var fs = require('fs');
var CDP = 9363, APP = 8080, HOST = '127.0.0.1', CTX = '/zhixiaofa';
var COOKIE = __CK__;
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function httpPut(u){return new Promise(function(res,rej){var x=new URL(u);
 var q=http.request({hostname:x.hostname,port:x.port,path:x.pathname+x.search,method:'PUT'},function(r){
  var b='';r.on('data',function(c){b+=c;});r.on('end',function(){try{res(JSON.parse(b));}catch(e){res({raw:b});}});});
 q.on('error',rej);q.end();});}
function closeTab(id){return new Promise(function(res){var q=http.request({hostname:HOST,port:CDP,path:'/json/close/'+id,method:'GET'},function(r){r.resume();r.on('end',res);});q.on('error',function(){res();});q.end();});}
async function ev(send,e){var r=await send('Runtime.evaluate',{expression:e,returnByValue:true,awaitPromise:true});
 if(r&&r.result&&r.result.exceptionDetails){return 'EXC:'+JSON.stringify(r.result.exceptionDetails).slice(0,300);}
 return r&&r.result&&r.result.result?r.result.result.value:undefined;}
var pass=0, fail=0;
function chk(name, ok, extra){ if(ok){pass++;console.log('  OK   '+name);} else {fail++;console.log('  FAIL '+name+'   '+(extra===undefined?'':extra));} }

(async function(){
  var t=await httpPut('http://'+HOST+':'+CDP+'/json/new?about:blank');
  var conn=await cdp.connect(t.webSocketDebuggerUrl); var send=conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Network.setCookie',{name:'JSESSIONID',value:COOKIE,domain:HOST,path:CTX,url:'http://'+HOST+':'+APP+CTX+'/'});
  await send('Page.navigate',{url:'http://'+HOST+':'+APP+CTX+'/admin/laws.html'});
  await sleep(3600);

  console.log('===== A. 渲染与初始状态 =====');
  var a=await ev(send, 'JSON.stringify({' +
    'wraps:document.querySelectorAll(".zf-selectwrap").length,' +
    'trigs:document.querySelectorAll(".zf-select").length,' +
    'menus:document.querySelectorAll(".zf-select__menu").length,' +
    'natSel:document.querySelectorAll("#law-filter select.zf-form-control").length,' +
    'selHidden:(function(){var s=document.querySelector("#law-filter [data-filter=category]");if(!s)return null;var cs=getComputedStyle(s);return cs.opacity==='+"'0'"+'&&parseFloat(cs.width)<=2;})()' +
    '})');
  var d=JSON.parse(a);
  console.log('  ' + a);
  chk('有自定义下拉包裹', d.wraps >= 2, d.wraps);
  chk('触发器已渲染', d.trigs >= 2, d.trigs);
  chk('原生 select 仍在 DOM 中', d.natSel >= 2, d.natSel);
  chk('原生 select 已视觉隐藏', d.selHidden === true, d.selHidden);

  console.log('===== B. 分类下拉的初始标签 =====');
  var lab = await ev(send, '(function(){var ws=document.querySelectorAll(".zf-selectwrap");' +
    'for(var i=0;i<ws.length;i++){var s=ws[i].querySelector("select[data-filter=category]");' +
    'if(s)return ws[i].querySelector(".zf-select__value").textContent;}})()');
  chk('触发器显示「全部分类」', lab === '全部分类', JSON.stringify(lab));

  console.log('===== C. 展开后的选项（应为新分类名 7 项 + 全部）=====');
  await ev(send, '(function(){var ws=document.querySelectorAll(".zf-selectwrap");for(var i=0;i<ws.length;i++){' +
    'if(ws[i].querySelector("select[data-filter=category]")){ws[i].querySelector(".zf-select").click();return 1;}}return 0;})()');
  await sleep(500);
  var op = await ev(send, 'JSON.stringify({open:!!document.querySelector(".zf-selectwrap--open"),' +
    'exp:(function(){var ws=document.querySelectorAll(".zf-selectwrap");for(var i=0;i<ws.length;i++){' +
    'if(ws[i].querySelector("select[data-filter=category]"))return ws[i].querySelector(".zf-select").getAttribute("aria-expanded");}})(),' +
    'opts:(function(){var m=document.querySelector(".zf-selectwrap--open .zf-select__menu");if(!m)return null;' +
    'var o=m.querySelectorAll(".zf-select__opt"),r=[];for(var i=0;i<o.length;i++)r.push(o[i].textContent.trim());return r;})()' +
    '})');
  var od=JSON.parse(op); console.log('  ' + op);
  var want=['全部分类','劳动合同','劳动报酬','工作时间与休息休假','社会保险','解除与终止','保密与竞业限制','其他'];
  chk('弹层已展开', od.open === true);
  chk('aria-expanded=true', od.exp === 'true', od.exp);
  chk('选项 = 8 项新分类名', od.opts && od.opts.length === 8, od.opts && od.opts.length);
  chk('选项内容正确', od.opts && JSON.stringify(od.opts) === JSON.stringify(want), JSON.stringify(od.opts));
  var shot1 = await send('Page.captureScreenshot', {format:'png'});
  fs.writeFileSync(require('path').join(__dirname,'shots','240-select-open.png'), Buffer.from(shot1.result.data,'base64'));
  console.log('  截图 shots/240-select-open.png（展开态）');

  console.log('===== D. 选中「劳动报酬」：取值回写 + change 事件 =====');
  await ev(send, '(function(){var s=document.querySelector("#law-filter [data-filter=category]");' +
    'window.__CH=0; if(window.jQuery){jQuery(s).on("change",function(){window.__CH++;});} return 1;})()');
  await ev(send, '(function(){var m=document.querySelector(".zf-selectwrap--open .zf-select__menu");' +
    'var o=m.querySelectorAll(".zf-select__opt");for(var i=0;i<o.length;i++){' +
    'if(o[i].textContent.trim()==="劳动报酬"){o[i].dispatchEvent(new MouseEvent("mousedown",{bubbles:true}));return 1;}}return 0;})()');
  await sleep(900);
  var dd = await ev(send, 'JSON.stringify({' +
    'val:document.querySelector("#law-filter [data-filter=category]").value,' +
    'label:(function(){var ws=document.querySelectorAll(".zf-selectwrap");for(var i=0;i<ws.length;i++){' +
    'if(ws[i].querySelector("select[data-filter=category]"))return ws[i].querySelector(".zf-select__value").textContent;}})(),' +
    'changes:window.__CH||0,' +
    'closed:!document.querySelector(".zf-selectwrap--open")' +
    '})');
  var vd=JSON.parse(dd); console.log('  ' + dd);
  chk('原生 select 的 value 已回写', vd.val === '劳动报酬', JSON.stringify(vd.val));
  chk('change 事件已触发', vd.changes >= 1, vd.changes);
  chk('触发器标签已更新', vd.label === '劳动报酬', JSON.stringify(vd.label));
  chk('选完自动收起', vd.closed === true);
  var shot2 = await send('Page.captureScreenshot', {format:'png'});
  fs.writeFileSync(require('path').join(__dirname,'shots','240-select-picked.png'), Buffer.from(shot2.result.data,'base64'));
  console.log('  截图 shots/240-select-picked.png（选中态）');

  console.log('===== E. 重置按钮把原生 select 置空后，标签应跟上 =====');
  await ev(send, '(function(){jQuery("#law-filter").find("[data-filter]").val("");return 1;})()');
  await sleep(900);
  var rs = await ev(send, '(function(){var ws=document.querySelectorAll(".zf-selectwrap");for(var i=0;i<ws.length;i++){' +
    'if(ws[i].querySelector("select[data-filter=category]"))return ws[i].querySelector(".zf-select__value").textContent;}})()');
  chk('置空后标签回到「全部分类」', rs === '全部分类', JSON.stringify(rs));

  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass+fail));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function(e){console.log('FATAL '+(e&&e.stack||e));process.exit(1);});
