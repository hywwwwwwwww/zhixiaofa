import re
p = r'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp/vendor/bootstrap-icons/bootstrap-icons.min.css'
s = open(p, encoding='utf-8').read()
# 先看看该文件里 bi- 图标规则的通用形态
m = re.search(r'\.bi-chat-square-text::before\{[^}]*\}', s)
print('SAMPLE:', m.group(0) if m else 'none')
names = ['bi-file-earmark-check', 'bi-file-earmark-text', 'bi-file-earmark-pencil',
         'bi-file-earmark-diff', 'bi-file-earmark-ruled', 'bi-file-earmark-break',
         'bi-clipboard-check', 'bi-clipboard2-check', 'bi-pencil-square',
         'bi-journal-text', 'bi-chat-square-text', 'bi-star']
for n in names:
    mm = re.search(re.escape(n) + r'::before\{[^}]*\}', s)
    print(n, '->', mm.group(0) if mm else 'NOT FOUND')
