"""把首页指标卡的 CSS 片段追加到 app.css 末尾（保留行尾与编码）。"""
import io

CSS = r'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/css/app.css'
FRAG = r'D:/Program Files (x86)/gitee/zhixiaofa/workspace/home-stat.css.fragment'

with io.open(CSS, 'r', encoding='utf-8', newline='') as f:
    s = f.read()
with io.open(FRAG, 'r', encoding='utf-8', newline='') as f:
    frag = f.read()

# 幂等：已存在则先删掉旧块（从标记行到文件末尾的两个空行前）
MARK = '/* ================================================================ 首页 · 使用概览指标卡'
if MARK in s:
    s = s[:s.index(MARK)].rstrip() + '\n\n'

if not s.endswith('\n'):
    s += '\n'

s = s + frag

with io.open(CSS, 'w', encoding='utf-8', newline='') as f:
    f.write(s)

print('app.css 字符数:', len(s))
print('花括号:', s.count('{'), s.count('}'))
print('作用域选择器数:', s.count('.zf-content--home'))
