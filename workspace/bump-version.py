"""全站 ?v= 版本号统一升级。

背景：本项目无构建步骤，改 css/js 后浏览器会命中旧缓存，
必须把 19 个 html 里的 ?v= 全部 +1。

用法：python bump-version.py <旧版本> <新版本>
"""
import io
import os
import re
import sys

ROOT = r'D:/Program Files (x86)/gitee/zhixiaofa/src/main/webapp'

old = sys.argv[1] if len(sys.argv) > 1 else '20260916s'
new = sys.argv[2] if len(sys.argv) > 2 else '20260916t'

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    if 'vendor' in dirpath.replace('\\', '/').split('/'):
        continue
    for fn in filenames:
        if fn.endswith('.html'):
            files.append(os.path.join(dirpath, fn))

total = 0
changed = []
for fp in sorted(files):
    with io.open(fp, 'r', encoding='utf-8', newline='') as f:
        s = f.read()
    n = s.count('?v=' + old)
    if n:
        s2 = s.replace('?v=' + old, '?v=' + new)
        with io.open(fp, 'w', encoding='utf-8', newline='') as f:
            f.write(s2)
        total += n
        changed.append((os.path.relpath(fp, ROOT).replace('\\', '/'), n))

print('升级版本号 %s -> %s' % (old, new))
print('涉及文件 %d 个，替换 %d 处' % (len(changed), total))
for name, n in changed:
    print('  %-42s %d' % (name, n))

# 校验
left = 0
for fp in sorted(files):
    with io.open(fp, 'r', encoding='utf-8', newline='') as f:
        left += f.read().count('?v=' + old)
print('残留旧版本号:', left)
