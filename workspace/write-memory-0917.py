"""把本轮记录追加到 .workbuddy/memory/2026-09-17.md（不存在则创建）。"""
import io
import os

MEM_DIR = r'D:/Program Files (x86)/gitee/zhixiaofa/.workbuddy/memory'
os.makedirs(MEM_DIR, exist_ok=True)
target = os.path.join(MEM_DIR, '2026-09-17.md')

src = r'D:/Program Files (x86)/gitee/zhixiaofa/workspace/memory-append-0917.md'
with io.open(src, 'r', encoding='utf-8', newline='') as f:
    add = f.read()

before = 0
if os.path.exists(target):
    with io.open(target, 'r', encoding='utf-8', newline='') as f:
        before = len(f.read())

with io.open(target, 'a', encoding='utf-8', newline='') as f:
    if before == 0:
        f.write('# 2026-09-17 工作日志\n')
    f.write(add)

with io.open(target, 'r', encoding='utf-8', newline='') as f:
    after = len(f.read())

print('文件:', target)
print('字符数: %d -> %d (+%d)' % (before, after, after - before))
print('--- 尾部 200 字 ---')
with io.open(target, 'r', encoding='utf-8', newline='') as f:
    print(f.read()[-200:])
