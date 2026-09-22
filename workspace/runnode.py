# -*- coding: utf-8 -*-
"""跑一个 node 脚本并把 stdout/stderr 完整打出来。
本环境 bash shim 缺 coreutils，且 node 脚本被 SIGTERM 时看不到任何输出，
用 Python subprocess 拿到真实返回码与输出最可靠。
"""
import subprocess, sys, io, os

NODE = r'C:\Users\Hanyuw\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'
WS = r'D:\Program Files (x86)\gitee\zhixiaofa\workspace'

script = sys.argv[1]
args = sys.argv[2:]

env = dict(os.environ)
env['NODE_PATH'] = r'C:\Users\Hanyuw\.workbuddy\binaries\node\workspace\node_modules'

p = subprocess.run([NODE, script] + args, cwd=WS, capture_output=True, env=env)
print('=== returncode:', p.returncode)
out = p.stdout.decode('utf-8', 'replace')
err = p.stderr.decode('utf-8', 'replace')
if out:
    print('=== stdout ===')
    print(out)
if err:
    print('=== stderr ===')
    print(err)
