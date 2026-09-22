/**
 * 全站静态自检：
 *   1) ES5 合规扫描（含内联 JS + 独立 js 文件）
 *   2) 内联 JS 语法检查（node --check）
 *   3) 全站 ?v= 版本号一致性
 *   4) CSS 花括号平衡
 *
 * 用法：node static-check.js [期望版本号]
 *
 * 【本轮修正的两个误报源】
 *   a) 检幂运算符时用的正则会误伤注释里的 Markdown 粗体（两颗星号连写），
 *      本项目注释写得很密，实测一次报出 26 条假阳性。
 *      → 先剥掉注释再扫代码。
 *   b) 版本号之前写死成 '?v=20260916n'，升版后整个校验形同虚设。
 *      → 改为从命令行参数或自动探测取当前版本。
 *
 * 【踩坑】上面注释里不要写"星号加斜杠"这种字符组合 ——
 * 它会直接闭合块注释，导致后续整段代码变成裸文本，报
 * "SyntaxError: Unexpected end of input"，而且行号指到文件末尾，
 * 极难定位。写注释时提到正则一定要用文字描述，不要贴字面量。
 */
var fs = require('fs');
var path = require('path');
var cp = require('child_process');

var ROOT = path.resolve(__dirname, '..', 'src', 'main', 'webapp');

var BT = String.fromCharCode(96);      // 反引号
var NL = String.fromCharCode(10);      // 换行

/**
 * 剥掉注释。
 *
 * 【为什么不自己写状态机】第一版手写了一个逐字符状态机（区分单引号/双引号/
 * 模板串/行注释/块注释），在 common.js 上实测漏剥 20 个 JSDoc 块 ——
 * 根因是源码里有 `/['"]/` 这类**正则字面量里含引号**，状态机把它当成字符串
 * 起始，此后 `'` 与 `"` 的配对全部错位，块注释再也识别不到。
 * 手写 JS 词法分析这种坑太多，改用两步正则：
 *   1) 先把字符串字面量整体替换成等长占位（保留字符数，便于回溯行号）
 *   2) 再删 /.../ 与 /* ... *\/ 注释
 * 这样含引号的正则最多影响一步，不会污染注释识别。
 */
function stripComments(code) {
  var s = code;
  // 模板串（可能跨行）→ 占位
  s = s.replace(new RegExp(BT + '[\\s\\S]*?' + BT, 'g'), function (m) {
    return '""' + new Array(Math.max(0, m.length - 1)).join(' ');
  });
  // 单/双引号字符串 → 占位（不处理跨行，JS 字符串本身不跨行）
  s = s.replace(/'[^'\n\\]*(?:\\.[^'\n\\]*)*'/g, function (m) {
    return '""' + new Array(Math.max(0, m.length - 2)).join(' ');
  });
  s = s.replace(/"[^"\n\\]*(?:\\.[^"\n\\]*)*"/g, function (m) {
    return '""' + new Array(Math.max(0, m.length - 2)).join(' ');
  });
  // 块注释（保留换行，保证行号不错位）
  s = s.replace(/\/\*[\s\S]*?\*\//g, function (m) {
    return m.replace(/[^\n]/g, ' ');
  });
  // 行注释
  s = s.replace(/\/\/[^\n]*/g, function (m) {
    return new Array(m.length + 1).join(' ');
  });
  return s;
}

var BAD = [
  [/=>/, '箭头函数'],
  [/\blet\s/, 'let'],
  [/\bconst\s/, 'const'],
  [new RegExp(BT), '模板字符串'],
  [/\?\./, '可选链'],
  [/\.includes\(/, 'Array.includes'],
  [/\*\*/, '幂运算符', 'line'],
  [/\.\.\./, '展开运算符', 'line']
];

function scan(label, code, report) {
  var clean = stripComments(code);
  BAD.forEach(function (pair) {
    if (pair[2] === 'line') {
      // 【行级规则】幂运算符 / 展开运算符这类符号，必须按行判断，
      // 不能用跨行正则。
      // 原因：`**` 跨行匹配会把 JSDoc 里连续两行的星号（`* @param x` 的星号
      // 与下一行开头的 `*`）拼成一个 `**`，实测在 common.js 里一次误报 20+ 条。
      var cls = clean.split(NL);
      cls.forEach(function (ln, i) {
        var mm = ln.match(pair[0]);
        if (mm) {
          report.push('  ' + label + ' [' + pair[1] + '] 第' + (i + 1) + '行 :: ' +
            JSON.stringify(ln.trim().slice(0, 90)));
        }
      });
      return;
    }
    var r = new RegExp(pair[0].source, 'g');
    var mm;
    while ((mm = r.exec(clean)) !== null) {
      var line = clean.substring(0, mm.index).split(NL).length;
      var lineText = code.split(NL)[line - 1] || '';
      report.push('  ' + label + ' [' + pair[1] + '] 第' + line + '行 :: ' +
        JSON.stringify(lineText.trim().slice(0, 90)));
    }
  });
}

// ---------- 收集所有 html ----------
function walk(dir, acc) {
  fs.readdirSync(dir).forEach(function (f) {
    var fp = path.join(dir, f);
    var st = fs.statSync(fp);
    if (st.isDirectory()) {
      if (f === 'vendor' || f === 'node_modules') { return; }
      walk(fp, acc);
    } else if (/\.html$/.test(f)) { acc.push(fp); }
  });
  return acc;
}

var htmls = walk(ROOT, []);
var report = [];
var blocks = [];

htmls.forEach(function (fp) {
  var src = fs.readFileSync(fp, 'utf8');
  var rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  var re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g;
  var m, idx = 0;
  while ((m = re.exec(src)) !== null) {
    if (!m[1].trim()) { continue; }
    scan(rel + '#blk' + (idx++), m[1], report);
    blocks.push({ file: rel, idx: idx - 1, code: m[1] });
  }
});

// 独立 js 文件也扫（排除 vendor）
function walkJs(dir, acc) {
  fs.readdirSync(dir).forEach(function (f) {
    var fp = path.join(dir, f);
    var st = fs.statSync(fp);
    if (st.isDirectory()) {
      if (f === 'vendor') { return; }
      walkJs(fp, acc);
    } else if (/\.js$/.test(f)) { acc.push(fp); }
  });
  return acc;
}
walkJs(ROOT, []).forEach(function (fp) {
  var rel = path.relative(ROOT, fp).replace(/\\/g, '/');
  scan(rel, fs.readFileSync(fp, 'utf8'), report);
});

console.log('扫描范围：' + htmls.length + ' 个 html + ' +
  walkJs(ROOT, []).length + ' 个 js');
if (report.length) {
  console.log('ES5 违规 ' + report.length + ' 条：');
  report.slice(0, 40).forEach(function (l) { console.log(l); });
  if (report.length > 40) { console.log('  ...还有 ' + (report.length - 40) + ' 条'); }
} else {
  console.log('ES5 扫描: PASS（已剥离注释，避免 Markdown 粗体误报）');
}

// ---------- 语法检查 ----------
var tmpDir = path.resolve(__dirname, '.tmp', 'syntax');
if (!fs.existsSync(tmpDir)) { fs.mkdirSync(tmpDir, { recursive: true }); }
var synFail = 0;
blocks.forEach(function (b, i) {
  var f = path.join(tmpDir, 'b' + i + '.js');
  fs.writeFileSync(f, b.code, 'utf8');
  try {
    cp.execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' });
  } catch (e) {
    synFail++;
    console.log('syntax FAIL ' + b.file + '#blk' + b.idx);
    console.log(String(e.stderr || e.message).substring(0, 400));
  }
});
console.log('内联 JS 语法: ' + (blocks.length - synFail) + '/' + blocks.length + ' OK');

// ---------- 版本号 ----------
var expect = process.argv[2];
if (!expect) {
  var sample = fs.readFileSync(path.join(ROOT, 'pages', 'home.html'), 'utf8');
  var vm = sample.match(/\?v=(\w+)/);
  expect = vm ? vm[1] : null;
}
var total = 0, files = 0, others = {};
htmls.forEach(function (fp) {
  var t = fs.readFileSync(fp, 'utf8');
  var re = /\?v=(\w+)/g, m, n = 0;
  while ((m = re.exec(t)) !== null) {
    n++; total++;
    if (m[1] !== expect) {
      others[m[1]] = (others[m[1]] || 0) + 1;
    }
  }
  if (n) { files++; }
});
console.log('版本号: 期望 ' + expect + '，共 ' + files + ' 个文件 / ' + total + ' 处');
if (Object.keys(others).length) {
  console.log('  【不一致】' + JSON.stringify(others));
} else {
  console.log('  一致性: PASS');
}

// ---------- CSS 花括号 ----------
var css = fs.readFileSync(path.join(ROOT, 'css', 'app.css'), 'utf8');
var ob = (css.match(/\{/g) || []).length;
var cb = (css.match(/\}/g) || []).length;
console.log('app.css 花括号: ' + ob + '/' + cb + ' ' + (ob === cb ? 'PASS' : '【不平衡】'));
