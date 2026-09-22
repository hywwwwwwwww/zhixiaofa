/**
 * 单测 stripComments 在真实 common.js 上的效果。
 */
var fs = require('fs');
var path = require('path');
var src = fs.readFileSync(path.resolve(__dirname, '..', 'src', 'main', 'webapp', 'js', 'common.js'), 'utf8');

// 直接从 static-check.js 里取函数（复制粘贴同一实现，确保一致）
var BT = String.fromCharCode(96), NL = String.fromCharCode(10), BS = String.fromCharCode(92);

function stripComments(code) {
  var out = '';
  var i = 0, n = code.length;
  var state = 0;
  while (i < n) {
    var c = code[i], d = code[i + 1];
    if (state === 0) {
      if (c === '/' && d === '/') { state = 4; i += 2; continue; }
      if (c === '/' && d === '*') { state = 5; i += 2; continue; }
      if (c === "'") { state = 1; out += c; i++; continue; }
      if (c === '"') { state = 2; out += c; i++; continue; }
      if (c === BT) { state = 3; out += c; i++; continue; }
      out += c; i++; continue;
    }
    if (state === 4) { if (c === NL) { state = 0; out += c; } i++; continue; }
    if (state === 5) { if (c === '*' && d === '/') { state = 0; i += 2; } else { i++; } continue; }
    if (c === BS) { out += c + (d === undefined ? '' : d); i += 2; continue; }
    if ((state === 1 && c === "'") || (state === 2 && c === '"') || (state === 3 && c === BT)) { state = 0; }
    out += c; i++;
  }
  return out;
}

var clean = stripComments(src);
console.log('原始行数:', src.split(NL).length);
console.log('剥离后行数:', clean.split(NL).length);
console.log('原始含 "/**":', src.split('/**').length - 1);
console.log('剥离后含 "/**":', clean.split('/**').length - 1);
console.log('原始含 "**":', src.split('**').length - 1);
console.log('剥离后含 "**":', clean.split('**').length - 1);

// 逐行找残留的 **
var bad = [];
clean.split(NL).forEach(function (l, i) {
  if (l.indexOf('**') >= 0) { bad.push((i + 1) + ': ' + l.trim().slice(0, 80)); }
});
console.log('剥离后仍含 ** 的行数:', bad.length);
bad.slice(0, 10).forEach(function (b) { console.log('  ' + b); });
