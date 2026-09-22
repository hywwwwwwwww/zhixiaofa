"""把 home.html + app.css 的 HEAD 版本导出到一个临时副本，用于"改造前/后"对比实测。
只能在临时目录里做，不动工作区源文件。
"""
import io
import os
import subprocess

REPO = r'D:/Program Files (x86)/gitee/zhixiaofa'
TMP = os.path.join(REPO, 'workspace', '.tmp', 'baseline')
os.makedirs(os.path.join(TMP, 'pages'), exist_ok=True)
os.makedirs(os.path.join(TMP, 'css'), exist_ok=True)

targets = [
    ('src/main/webapp/pages/home.html', 'pages/home.html'),
    ('src/main/webapp/css/app.css', 'css/app.css'),
]

for src, dst in targets:
    r = subprocess.run(['git', 'show', 'HEAD:' + src], cwd=REPO,
                       capture_output=True)
    if r.returncode != 0:
        print('FAIL', src, r.stderr.decode('utf-8', 'replace')[:200])
        continue
    out = os.path.join(TMP, dst)
    with io.open(out, 'wb') as f:
        f.write(r.stdout)
    print('OK  ', dst, len(r.stdout), 'bytes')
