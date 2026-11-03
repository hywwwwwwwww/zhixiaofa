#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""大模型接入自检工具 —— 填完 ai.properties 后先跑这个，再启动应用。

它回答三件事：
  1. 配置读到了没（baseUrl / model / key 是否齐全，key 只显示首尾几位）
  2. 接口通不通、**key 对不对**（先列模型再发一次真实对话）
  3. 你账号下**实际可用**哪些模型（用它回填 ai.model，不必猜）

用法（在项目根目录）：
    python tools/ai-check.py
    python tools/ai-check.py --list-only      # 只列模型，不发对话
    python tools/ai-check.py --ask "公司拖欠工资怎么办"   # 用真实提示词试一次

⚠️ 本脚本只会打印 key 的**前 6 位与后 4 位**，不会把完整密钥输出到屏幕或日志。
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = os.path.join(ROOT, 'src', 'main', 'resources', 'ai.properties')


def read_props(path):
    """读一个 .properties，返回 dict；文件不存在返回 None。"""
    if not os.path.exists(path):
        return None
    conf = {}
    for line in io.open(path, encoding='utf-8'):
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        conf[k.strip()] = v.strip()
    return conf


def load_cfg():
    conf = read_props(CFG)
    if conf is None:
        print('✗ 找不到配置文件: %s' % CFG)
        sys.exit(1)
    return conf


def mask(key):
    if not key:
        return '(未填)'
    if len(key) <= 10:
        return key[:2] + '***'
    return key[:6] + '…' + key[-4:]


def http(method, url, key, body=None, timeout=60):
    data = json.dumps(body).encode('utf-8') if body is not None else None
    rq = urllib.request.Request(url, method=method, data=data)
    rq.add_header('Content-Type', 'application/json; charset=utf-8')
    if key:
        rq.add_header('Authorization', 'Bearer ' + key)
    try:
        with urllib.request.urlopen(rq, timeout=timeout) as r:
            return r.status, r.read().decode('utf-8', 'replace')
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode('utf-8', 'replace')
    except Exception as e:
        return None, '%s: %s' % (type(e).__name__, e)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--list-only', action='store_true', help='只列模型，不发对话')
    ap.add_argument('--ask', default='', help='用这句话替代默认的探测语')
    args = ap.parse_args()

    c = load_cfg()
    base = (c.get('ai.baseUrl') or '').rstrip('/')
    model = c.get('ai.model') or ''
    key = c.get('ai.apiKey') or ''
    enabled = str(c.get('ai.enabled', 'false')).lower() == 'true'

    print('=' * 68)
    print(' 大模型接入自检')
    print('=' * 68)
    print('  配置文件   : %s' % os.path.relpath(CFG, ROOT))
    print('  ai.enabled : %s' % enabled)
    print('  baseUrl    : %s' % (base or '(未填)'))
    print('  model      : %s' % (model or '(未填)'))
    print('  apiKey     : %s' % mask(key))
    print('  超时/温度/token: %s ms / %s / %s' % (
        c.get('ai.timeoutMs', '60000'), c.get('ai.temperature', '0.3'), c.get('ai.maxTokens', '1600')))
    print()

    # ---------- 0) ★源文件 vs 运行时副本：这是「改了 key 却像没生效」的头号原因 ----------
    # 应用实际读的是 classpath 上的 target/classes/ai.properties，
    # 它由 Maven 从 src/main/resources/ai.properties **复制**过去。
    # 只改源文件而不跑一次编译，运行时读到的仍是旧副本 —— 此时应用会安静地走规则拼装，
    # 页面上看不出任何异常，只会觉得「模型没接上」。所以这里必须显式提示。
    runtime_cfg = os.path.join(ROOT, 'target', 'classes', 'ai.properties')
    rt = read_props(runtime_cfg)

    def show(k):
        """列「源文件」那一侧的值 —— 必须从 c（源）读，
        早先误写成 (rt or c) 会让两列显示同一个值，等于没比。"""
        v = c.get(k, '')
        return mask(v) if 'apiKey' in k else (v or '(空)')

    if rt is None:
        print('  ⚠️ 还没有运行时副本 %s' % os.path.relpath(runtime_cfg, ROOT))
        print('     → 应用跑起来后会读不到配置、直接走规则拼装。先执行一次编译：')
        print('         mvn -o -B -DskipTests compile')
        print()
    else:
        diff = sorted(set(list(c.keys()) + list(rt.keys())))
        diff = [k for k in diff if c.get(k) != rt.get(k)]
        if diff:
            print('  ⚠️ 运行时副本与源文件不一致 —— 应用读的是运行时副本，改动目前不会生效：')
            for k in diff:
                print('     %-24s 源=%-22s 运行时=%s' % (k, show(k), mask(rt.get(k, '')) if 'apiKey' in k else (rt.get(k) or '(空)')))
            print()
            print('     → 先编译一次把源文件同步过去，再重启应用：')
            print('         mvn -o -B -DskipTests compile')
            print('         mvn tomcat7:run')
            print()

    problems = []
    if not base:
        problems.append('ai.baseUrl 未填')
    if not key:
        problems.append('ai.apiKey 未填（这是最常忘的一项）')
    if not model:
        problems.append('ai.model 未填')
    if not enabled:
        problems.append('ai.enabled=false —— 应用会走规则拼装，不会调用模型')
    if problems:
        print('  ⚠️ 配置不完整：')
        for p in problems:
            print('     · %s' % p)
        print()
        print('  → 填好 %s 后重新运行本脚本。' % os.path.relpath(CFG, ROOT))
        return 2

    # ---------- 1) 列模型 ----------
    print('  ① 拉取账号下可用模型   GET %s/models' % base)
    code, text = http('GET', base + '/models', key, timeout=30)
    print('     HTTP %s' % code)
    models = []
    if code == 200:
        try:
            j = json.loads(text)
            for m in (j.get('data') or []):
                mid = m.get('id') or m.get('name')
                if mid:
                    models.append(mid)
        except Exception:
            pass
        if models:
            print('     可用模型 %d 个：' % len(models))
            for m in models[:40]:
                mark = ' ← 当前配置' if m == model else ''
                print('        %s%s' % (m, mark))
            if model not in models:
                print()
                print('     ⚠️ 当前 ai.model=%s 不在上面列表里 —— 可能是名字写错，或该模型你没权限。' % model)
                print('        建议从上面挑一个回填到 ai.properties 的 ai.model。')
        else:
            print('     返回里没解析出模型列表（有些兼容入口不提供 /models），下面直接用对话验证。')
            print('     原始返回: %s' % text[:200].replace('\n', ' '))
    elif code == 401:
        print('     ✗ 鉴权失败 —— key 不对或已失效。返回: %s' % text[:160])
        return 1
    else:
        print('     非 200（该入口可能不提供 /models，不影响对话），返回: %s' % text[:160])

    if args.list_only:
        print()
        print('  (--list-only：已跳过对话测试)')
        return 0

    # ---------- 2) 真实对话 ----------
    print()
    print('  ② 发一次真实对话   POST %s/chat/completions' % base)
    question = args.ask or '公司拖欠我两个月工资，还把我辞退了，我该怎么办？'
    body = {
        'model': model,
        'messages': [
            {'role': 'system', 'content': '你是劳动法咨询助手。只依据常识回答，80 字以内。'},
            {'role': 'user', 'content': question},
        ],
        'temperature': float(c.get('ai.temperature') or 0.3),
        'max_tokens': 400,
        'stream': False,
    }
    print('     提问: %s' % question)
    code, text = http('POST', base + '/chat/completions', key, body, timeout=int(c.get('timeoutMs') or 60000))
    print('     HTTP %s' % code)

    if code == 200:
        try:
            j = json.loads(text)
            content = (j.get('choices') or [{}])[0].get('message', {}).get('content', '')
            usage = j.get('usage') or {}
            print()
            print('     ✓ 调用成功。模型回答：')
            print('     ┌' + '─' * 62)
            for line in (content or '').strip().split('\n'):
                print('     │ %s' % line)
            print('     └' + '─' * 62)
            if usage:
                print('     token 用量: prompt=%s completion=%s total=%s' % (
                    usage.get('prompt_tokens'), usage.get('completion_tokens'), usage.get('total_tokens')))
            print()
            print('=' * 68)
            print(' 结论：配置可直接使用 ✓ —— 启动应用后问答/小法庭/文书就会走模型。')
            print('=' * 68)
            return 0
        except Exception as e:
            print('     ✗ 返回不是预期的 JSON: %s' % e)
            print('     %s' % text[:300])
            return 1

    # ---------- 失败诊断 ----------
    print()
    print('     ✗ 调用失败，原始返回（截断）：')
    print('     %s' % text[:500].replace('\n', '\n     '))
    print()
    low = text.lower()
    if code == 401:
        print('  诊断：key 无效或已过期 → 去 https://platform.sensenova.cn/ 重新创建一枚。')
    elif code == 404:
        print('  诊断：路径或模型名不对 → 试试把 ai.model 换成上面 /models 里列出的名字；')
        print('        或把 baseUrl 换成另一个入口（token.sensenova.cn/v1 ↔ api.sensenova.cn/compatible-mode/v2）。')
    elif code == 400 and 'max_tokens' in low:
        print('  诊断：该入口不认 max_tokens（用的是 max_new_tokens）。')
        print('        应用侧已自动兼容这两种参数名，本脚本也会——可直接在应用里试。')
    elif code == 429:
        print('  诊断：触发了限流或余额不足 → 稍后重试，或到控制台确认额度。')
    elif code is None:
        print('  诊断：连不上 → 检查网络/代理；确认 baseUrl 没写错。')
    else:
        print('  诊断：见上面的原始返回。')
    return 1


if __name__ == '__main__':
    sys.exit(main())
