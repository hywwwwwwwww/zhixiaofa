/* 看板优化后实测：逐项验证是否生效 */
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
 if(r&&r.result&&r.result.exceptionDetails){return 'EXC:'+JSON.stringify(r.result.exceptionDetails).slice(0,300);}
 return r&&r.result&&r.result.result?r.result.result.value:undefined;}
var pass=0,fail=0;
function chk(n,ok,extra){ if(ok){pass++;console.log('   OK   '+n);} else {fail++;console.log('   FAIL '+n+'   实际='+(extra===undefined?'':extra));} }
(async function(){
  var t=await httpPut('http://'+HOST+':'+CDP+'/json/new?about:blank');
  var conn=await cdp.connect(t.webSocketDebuggerUrl); var send=conn.send;
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await send('Network.setCookie',{name:'JSESSIONID',value:COOKIE,domain:HOST,path:CTX,url:'http://'+HOST+':'+APP+CTX+'/'});
  await send('Page.navigate',{url:'http://'+HOST+':'+APP+CTX+'/admin/index.html'});
  await sleep(4500);

  console.log('===== A. 指标卡末行居中（flex，非 grid）=====');
  var a = await ev(send, 'JSON.stringify((function(){var g=document.querySelector("#metric-grid");var cs=getComputedStyle(g);' +
    'var cards=g.querySelectorAll(".zf-stat");var rs=[];for(var i=0;i<cards.length;i++){var r=cards[i].getBoundingClientRect();rs.push(Math.round(r.left)+","+Math.round(r.width));}' +
    'var gb=g.getBoundingClientRect();var firstW=cards.length?Math.round(cards[0].getBoundingClientRect().width):0;' +
    '/* 按 top 分行，末行右缘是否贴到网格右缘（容差 2px） */' +
    'var rows={};for(var i=0;i<cards.length;i++){var b=cards[i].getBoundingClientRect();var k=Math.round(b.top);if(!rows[k])rows[k]=[];rows[k].push(b.right);}' +
    'var ks=Object.keys(rows).sort(function(x,y){return x-y;});var lastRow=rows[ks[ks.length-1]]||[];' +
    'var maxRight=0;for(var i=0;i<lastRow.length;i++){if(lastRow[i]>maxRight)maxRight=lastRow[i];}' +
    'return {display:cs.display, justify:cs.justifyContent, 张数:cards.length, 卡宽:firstW, 行数:ks.length,' +
    ' 末行铺满: Math.abs(maxRight - gb.right) < 2, 网格宽:Math.round(gb.width)};})())');
  console.log('  ' + a); var ad=JSON.parse(a);
  chk('容器改为 flex', ad.display === 'flex', ad.display);
  chk('网格左对齐（不再居中漂浮）', ad.justify === 'flex-start', ad.justify);
  chk('卡片已收窄到 ~178px（原 271px）', ad.卡宽 > 150 && ad.卡宽 < 200, ad.卡宽);
  chk('末行被 flex-grow 填满（无右侧空列）', ad.末行铺满 === true, ad.末行铺满);
  chk('11 张卡仍在', ad.张数 === 11, ad.张数);

  console.log('===== B. 指标卡：图标语义色 + 数值等宽 =====');
  var b = await ev(send, 'JSON.stringify((function(){function pick(sel){var e=document.querySelector(sel);if(!e)return null;var ic=e.querySelector(".zf-stat__icon");' +
    'var lb=e.querySelector(".zf-stat__label");return {标签:lb?lb.textContent.trim():null, 图标底:ic?getComputedStyle(ic).backgroundColor:null, 图标色:ic?getComputedStyle(ic).color:null};}' +
    'var v=document.querySelector(".zf-stat__value");' +
    'return {普通:pick("#metric-grid .zf-stat"), 知识:pick(".zf-stat--knowledge"), 风险:pick(".zf-stat--danger"), 运维:pick(".zf-stat--ops"),' +
    ' 数值字体:v?getComputedStyle(v).fontFamily.slice(0,26):null};})())');
  console.log('  ' + b); var bd=JSON.parse(b);
  // 图标按业务域分三组：业务蓝（基类）/ 知识资源紫 / 风险红 / 运维灰蓝
  chk('知识资源卡图标为紫', bd.知识 && bd.知识.图标底 === 'rgb(237, 228, 253)', bd.知识 && bd.知识.图标底);
  chk('风险卡图标为红', bd.风险 && bd.风险.图标底 === 'rgb(253, 234, 234)', bd.风险 && bd.风险.图标底);
  chk('运维卡图标为灰蓝', bd.运维 && bd.运维.图标底 === 'rgb(230, 234, 240)', bd.运维 && bd.运维.图标底);
  chk('业务卡图标保持基类浅蓝', bd.普通 && bd.普通.图标底 === 'rgb(219, 234, 254)', bd.普通 && bd.普通.图标底);
  chk('三组颜色互不相同', !!(bd.知识 && bd.风险 && bd.运维 && bd.普通 &&
      bd.知识.图标底 !== bd.普通.图标底 && bd.风险.图标底 !== bd.普通.图标底 && bd.运维.图标底 !== bd.普通.图标底), '');
  chk('数值用等宽字体', /Consolas|mono/i.test(bd.数值字体 || ''), bd.数值字体);

  console.log('===== C. 消「卡中卡双描边」=====');
  var c = await ev(send, 'JSON.stringify((function(){var e=document.querySelector("#trend-chart");var cs=getComputedStyle(e);' +
    'return {border:cs.borderTopWidth, radius:cs.borderTopLeftRadius, pad:cs.padding, bg:cs.backgroundColor};})())');
  console.log('  ' + c); var cd=JSON.parse(c);
  chk('图表容器无边框', cd.border === '0px', cd.border);
  chk('图表容器无内边距', cd.pad === '0px', cd.pad);
  chk('图表容器透明底', cd.bg === 'rgba(0, 0, 0, 0)', cd.bg);

  console.log('===== D. 主角卡唯一阴影 + 顶部主色条 =====');
  var d = await ev(send, 'JSON.stringify((function(){var e=document.querySelector(".zf-card--hero");var cs=getComputedStyle(e);' +
    'var before=getComputedStyle(e,"::before");' +
    'var plain=document.querySelector(".zf-content .zf-card:not(.zf-card--hero)");' +
    'var ps=plain?getComputedStyle(plain).boxShadow:"none";' +
    'function blur(s){var m=String(s).match(/\\d+px\\s+(\\d+)px/);return m?+m[1]:0;}' +
    'return {hero阴影:cs.boxShadow.slice(0,44), 数据卡阴影:ps.slice(0,44),' +
    ' 主角模糊:blur(cs.boxShadow), 数据卡模糊:blur(ps),' +
    ' 顶条高:before.height, 顶条色:before.backgroundColor};})())');
  console.log('  ' + d); var dd=JSON.parse(d);
  chk('主角卡有阴影', dd.hero阴影 && dd.hero阴影 !== 'none', dd.hero阴影);
  chk('顶部主色条 3px 蓝', dd.顶条高 === '3px' && dd.顶条色 === 'rgb(66, 133, 244)', dd.顶条高 + '/' + dd.顶条色);
  // 阴影口径：数据卡给极浅投影（在浅灰画布上"浮起"），主角卡用更重的投影保持层级
  chk('数据卡有极浅投影', dd.数据卡阴影 && dd.数据卡阴影 !== 'none', dd.数据卡阴影);
  chk('主角卡模糊半径明显大于数据卡', dd.主角模糊 > dd.数据卡模糊, dd.主角模糊 + ' vs ' + dd.数据卡模糊);
  chk('主角卡阴影与数据卡不同（层级分明）', dd.hero阴影 !== dd.数据卡阴影, '');

  console.log('===== E. 快捷入口压扁（横排）+ hover =====');
  var e2 = await ev(send, 'JSON.stringify((function(){var q=document.querySelector(".zf-card.zf-quick");var cs=getComputedStyle(q);' +
    'var blk=q.closest(".zf-card--plain").getBoundingClientRect();var r=q.getBoundingClientRect();' +
    'var c=document.querySelector(".zf-card--plain");var ccs=getComputedStyle(c);' +
    'return {display:cs.display, direction:cs.flexDirection, 单项高:Math.round(r.height), 整块高:Math.round(blk.height), 块底色:ccs.backgroundColor};})())');
  console.log('  ' + e2); var ed=JSON.parse(e2);
  chk('快捷项改为横排 flex', ed.display === 'flex' && ed.direction === 'row', ed.display + '/' + ed.direction);
  chk('单项高度压缩到 ≤64px', ed.单项高 <= 64, ed.单项高);
  chk('整块高度压到 ≤260px（原 406）', ed.整块高 <= 260, ed.整块高);
  chk('辅助卡底色为浅灰', ed.块底色 !== 'rgb(255, 255, 255)', ed.块底色);

  console.log('===== F. 图表配色已走主色系（取 ECharts 实例配色）=====');
  var f = await ev(send, 'JSON.stringify((function(){var out={};' +
    'try{var inst=echarts.getInstanceByDom(document.querySelector("#trend-chart"));if(inst)out.折线=inst.getOption().color.slice(0,5);}catch(e){out.折线="err";}' +
    'try{var p=echarts.getInstanceByDom(document.querySelector("#pie-qa"));if(p)out.饼图=p.getOption().color.slice(0,5);}catch(e){out.饼图="err";}' +
    'try{var s=echarts.getInstanceByDom(document.querySelector("#bar-slow"));if(s)out.慢接口=s.getOption().color;}catch(e){out.慢接口="err";}' +
    'try{var b2=echarts.getInstanceByDom(document.querySelector("#bar-articles"));if(b2)out.柱图=b2.getOption().color;}catch(e){out.柱图="err";}' +
    'return out;})())');
  console.log('  ' + f); var fd=JSON.parse(f);
  chk('折线第一色=主色', fd.折线 && fd.折线[0] === '#4285f4', fd.折线 && fd.折线[0]);
  chk('饼图第一色=主色', fd.饼图 && fd.饼图[0] === '#4285f4', fd.饼图 && fd.饼图[0]);
  chk('慢接口=danger 红', fd.慢接口 && fd.慢接口[0] === '#ef4444', JSON.stringify(fd.慢接口));
  chk('排行柱=主色', fd.柱图 && fd.柱图[0] === '#4285f4', JSON.stringify(fd.柱图));

  console.log('===== G. 区块顺序 + 页面高度 =====');
  var g = await ev(send, 'JSON.stringify((function(){var c=document.querySelector(".zf-content");var out=[];' +
    'for(var i=0;i<c.children.length;i++){var e=c.children[i];out.push({cls:(e.className||"").split(" ").slice(0,2).join("."), h:Math.round(e.getBoundingClientRect().height), t:(e.innerText||"").replace(/\\s+/g," ").trim().slice(0,14)});}' +
    'return {docH:document.documentElement.scrollHeight, 区块:out};})())');
  var gd=JSON.parse(g);
  console.log('  docH = ' + gd.docH + '（优化前 2692）');
  gd.区块.forEach(function(x){ console.log('    ' + x.t.padEnd(16) + ' ' + x.cls.padEnd(26) + x.h + 'px'); });
  chk('第二个区块是业务趋势', gd.区块[1] && gd.区块[1].t.indexOf('业务趋势') >= 0, gd.区块[1] && gd.区块[1].t);
  chk('快捷入口已移到最后', gd.区块[gd.区块.length-2] && gd.区块[gd.区块.length-2].t.indexOf('管理快捷入口') >= 0, gd.区块[gd.区块.length-2] && gd.区块[gd.区块.length-2].t);
  chk('页面总高压到 <2500', gd.docH < 2500, gd.docH);

  var shot = await send('Page.captureScreenshot', {format:'png', captureBeyondViewport:true});
  fs.writeFileSync(require('path').join(__dirname,'shots','270-dashboard-after.png'), Buffer.from(shot.result.data,'base64'));
  console.log('\n===== H. 截图 -> shots/270-dashboard-after.png =====');
  console.log('');
  console.log('通过 ' + pass + ' / ' + (pass+fail));
  conn.socket.destroy(); await closeTab(t.id);
})().catch(function(e){console.log('FATAL '+(e&&e.stack||e));process.exit(1);});
