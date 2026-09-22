"""在同一个进程内完成：拉起 headless Edge → 跑 node 脚本 → 关掉本次拉起的 Edge。

用法:
    python workspace/rundetached.py <port> <script.js> [args...]

环境变量:
    EDGE_EXTRA_FLAGS   追加到 Edge 命令行的额外参数（空格分隔），
                       例如 EDGE_EXTRA_FLAGS="--disable-extensions"
    EDGE_PROFILE_SUFFIX  给 profile 目录名加后缀，避免不同参数共用同一 profile

为什么需要它: 本环境每次 Bash 工具调用结束后，其子进程都会被回收，
所以「先起 Edge，再另起一次调用跑 node」必然 ECONNREFUSED。
必须把两者放进同一次调用里。
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NODE = r'C:\Users\Hanyuw\.workbuddy\binaries\node\versions\22.22.2-3\node.exe'


def probe(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % port, timeout=1.5) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None


def main():
    port = sys.argv[1]
    script = sys.argv[2]
    extra = sys.argv[3:]

    extra_flags = os.environ.get('EDGE_EXTRA_FLAGS', '').split()
    prof_suffix = os.environ.get('EDGE_PROFILE_SUFFIX', '')

    port = int(port)
    prof = os.path.join(ROOT, 'workspace', 'tmp-edge-%d%s' % (port, prof_suffix))
    os.makedirs(prof, exist_ok=True)

    started = False
    proc = None
    if probe(port):
        print('[rundetached] reusing Edge on %d' % port)
    else:
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
        argv = [EDGE, '--headless=new', '--remote-debugging-port=%d' % port,
                '--user-data-dir=%s' % prof,
                '--no-first-run', '--no-default-browser-check',
                '--disable-gpu'] + extra_flags + ['about:blank']
        print('[rundetached] argv: %s' % ' '.join(argv))
        proc = subprocess.Popen(argv, creationflags=flags, close_fds=True,
                                stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                                stderr=subprocess.DEVNULL)
        started = True
        for _ in range(60):
            time.sleep(0.5)
            if probe(port):
                break
        else:
            print('[rundetached] ERROR: Edge did not come up on %d' % port)
            return 1
        print('[rundetached] Edge up on %d' % port)

    try:
        p = subprocess.run([NODE, os.path.join(ROOT, 'workspace', script)] + extra,
                           cwd=ROOT, capture_output=True, text=False)
        out = p.stdout.decode('utf-8', 'replace')
        err = p.stderr.decode('utf-8', 'replace')
        print('=== returncode: %d' % p.returncode)
        if out.strip():
            print('=== stdout ===')
            print(out)
        if err.strip():
            print('=== stderr ===')
            print(err)
        return p.returncode
    finally:
        if started and proc is not None:
            # 只杀本次拉起的进程树，绝不动用户自己的 Edge
            subprocess.run(['taskkill', '/F', '/T', '/PID', str(proc.pid)],
                           capture_output=True)
            print('[rundetached] killed Edge tree pid=%d' % proc.pid)


if __name__ == '__main__':
    sys.exit(main())
