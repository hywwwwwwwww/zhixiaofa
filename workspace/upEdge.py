"""启动一个持久 headless Edge 并等待调试端口可用。

用法: python workspace/upEdge.py <port> [profileDirName]

为什么不用 Bash 的 run_in_background: 本环境 Bash 工具调用结束时子进程会被回收，
必须用 Python 的 DETACHED_PROCESS 真正脱离父进程。
"""
import os
import subprocess
import sys
import time
import urllib.request
import json

EDGE = r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def port_alive(port):
    try:
        with urllib.request.urlopen('http://127.0.0.1:%d/json/version' % port, timeout=1.5) as r:
            return json.loads(r.read().decode('utf-8'))
    except Exception:
        return None


def main():
    port = int(sys.argv[1])
    name = sys.argv[2] if len(sys.argv) > 2 else ('tmp-edge-%d' % port)
    prof = os.path.join(ROOT, 'workspace', name)
    os.makedirs(prof, exist_ok=True)

    v = port_alive(port)
    if v:
        print('ALREADY UP  port=%d  browser=%s' % (port, v.get('Browser')))
        return

    args = [EDGE,
            '--headless=new',
            '--remote-debugging-port=%d' % port,
            '--user-data-dir=%s' % prof,
            '--no-first-run',
            '--no-default-browser-check',
            '--disable-gpu',
            '--disable-features=Translate',
            'about:blank']
    flags = 0
    if sys.platform == 'win32':
        flags = subprocess.DETACHED_PROCESS | subprocess.CREATE_NEW_PROCESS_GROUP
    subprocess.Popen(args, creationflags=flags, close_fds=True,
                     stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                     stderr=subprocess.DEVNULL)
    print('LAUNCHED  port=%d  profile=%s' % (port, prof))

    for i in range(60):
        time.sleep(0.5)
        v = port_alive(port)
        if v:
            print('READY after %.1fs  browser=%s' % ((i + 1) * 0.5, v.get('Browser')))
            return
    print('TIMEOUT: port %d never came up' % port)
    sys.exit(1)


if __name__ == '__main__':
    main()
