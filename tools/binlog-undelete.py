#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
从 MySQL binlog(ROW 格式) 生成「反删除」恢复脚本

【背景】2026-09-21 执行 `sql/data.sql`（含 15 处 DELETE FROM）重置了数据库，
        而我原先承诺的「重置前全量备份」因表名被 CR 污染而**静默失败**。
        幸运的是本机 MySQL 开启了 binlog 且格式为 ROW，
        **被删除的每一行的原始值都记录在 binlog 里** —— 本工具把它还原成 INSERT 语句。

【原理】`mysqlbinlog --base64-output=DECODE-ROWS -v` 会把行事件解码成可读形式：
            ### DELETE FROM `db`.`tbl`
            ### WHERE
            ###   @1=15
            ###   @2='张三'
        把每个 DELETE 块翻成 `INSERT IGNORE INTO tbl VALUES (...)`，
        用 IGNORE 跳过当前已存在的行（重置脚本自己插回去的那些种子行），
        于是「被删掉的增量数据」就被补回来了。

【用法】
    # 生成恢复脚本（默认抓今天 21:02~21:15 那个窗口，可用参数覆盖）
    python tools/binlog-undelete.py --out sql/restore-prereset-20260921.sql

    # 只处理某些表
    python tools/binlog-undelete.py --tables contract,qa_record --out xxx.sql

    # 确认后执行恢复
    mysql -u root -p zhixiaofa < sql/restore-prereset-20260921.sql
"""

import argparse
import io
import os
import re
import subprocess
import sys
from collections import Counter

DEFAULT_MYSQLBINLOG = r'D:\Program Files\MySQL\MySQL Server 8.0\bin\mysqlbinlog.exe'

DEL_RE = re.compile(r'^### DELETE FROM `([^`]+)`\.`([^`]+)`\s*$')
SET_RE = re.compile(r'^###\s+@(\d+)=(.*)$')


def read_db_config(path):
    raw = open(path, 'rb').read()
    try:
        cfg = raw.decode('utf-8')
    except Exception:
        cfg = raw.decode('gbk', 'replace')
    g = lambda k: re.search(r'%s\s*=\s*(\S+)' % k, cfg).group(1)
    m = re.search(r'//([^:/]+):(\d+)/([^?]+)', g('jdbc.url'))
    return dict(host=m.group(1), port=m.group(2), db=m.group(3),
                user=g('jdbc.username'), pwd=g('jdbc.password'))


def clean_value(v):
    """剥掉 mysqlbinlog 尾部的 /* ... */ 注释；_binary 前缀转成普通字面量"""
    v = v.strip()
    v = re.sub(r'\s*/\*.*?\*/\s*$', '', v).strip()
    if v.startswith('_binary '):
        v = v[len('_binary '):].strip()
    return v


def parse_binlog(text, want_tables=None):
    """返回 {表名: [ [值,...], ... ]}

    注意 mysqlbinlog 的行事件长这样（每行一个记录块，块与块之间没有分隔符）：
        ### DELETE FROM `db`.`tbl`
        ### WHERE
        ###   @1=15
        ###   @2='张三'
        ### DELETE FROM `db`.`tbl`      <-- 下一个块直接开始
        ### WHERE
        ...
    所以**每遇到新的块头都必须先把上一个块落盘**，
    否则只会保留最后一行（第一版就踩了这个坑，4613 行只抓到 1 行）。
    """
    out = {}

    def flush():
        if cur_tbl and cur_vals:
            n = max(cur_vals)
            out.setdefault(cur_tbl, []).append([cur_vals.get(i) for i in range(1, n + 1)])

    cur_tbl, cur_vals = None, None
    for line in text.split('\n'):
        m = DEL_RE.match(line)
        if m:
            flush()
            db, tbl = m.group(1), m.group(2)
            if want_tables and tbl not in want_tables:
                cur_tbl, cur_vals = None, None
                continue
            cur_tbl, cur_vals = tbl, {}
            continue
        if cur_tbl is None:
            continue
        m2 = SET_RE.match(line)
        if m2:
            cur_vals[int(m2.group(1))] = clean_value(m2.group(2))
            continue
        if line.strip().startswith('### WHERE'):
            # WHERE 是块内的正常行，不能当块结束
            continue
        if line.startswith('###'):
            # 其它 ### 行（如下一个 INSERT 块的头）→ 结束当前块
            flush()
            cur_tbl, cur_vals = None, None
    flush()
    return out


def main():
    ap = argparse.ArgumentParser(description='从 binlog 生成反删除恢复脚本')
    ap.add_argument('--out', required=True, help='输出的 .sql 路径')
    ap.add_argument('--start', default='2026-09-21 21:02:00')
    ap.add_argument('--stop', default='2026-09-21 21:15:00')
    ap.add_argument('--tables', default='', help='只处理这些表（逗号分隔）')
    ap.add_argument('--mysqlbinlog', default=DEFAULT_MYSQLBINLOG)
    ap.add_argument('--db-config', default='src/main/resources/db.properties')
    a = ap.parse_args()

    cfg = read_db_config(a.db_config)
    want = set(x.strip() for x in a.tables.split(',')) if a.tables else None

    # 列出 binlog
    p = subprocess.run([a.mysqlbinlog.replace('mysqlbinlog.exe', 'mysql.exe'),
                        '-h', cfg['host'], '-P', cfg['port'], '-u', cfg['user'], '-p' + cfg['pwd'],
                        '-N', '-B', '-e', 'SHOW BINARY LOGS;'], capture_output=True, timeout=60)
    logs = [l.split('\t')[0].strip() for l in
            p.stdout.decode('utf-8', 'replace').replace('\r\n', '\n').split('\n') if l.strip()]

    print('binlog 共 %d 个，扫描时间窗 %s ~ %s' % (len(logs), a.start, a.stop))
    found = {}
    for name in logs:
        q = subprocess.run([a.mysqlbinlog, '--read-from-remote-server', '--host=' + cfg['host'],
                            '--port=' + cfg['port'], '--user=' + cfg['user'],
                            '--password=' + cfg['pwd'], '--base64-output=DECODE-ROWS', '-v',
                            '--start-datetime=' + a.start, '--stop-datetime=' + a.stop, name],
                           capture_output=True, timeout=1200)
        txt = q.stdout.decode('utf-8', 'replace')
        if not txt.strip():
            continue
        part = parse_binlog(txt, want)
        if part:
            for t, rows in part.items():
                found.setdefault(t, []).extend(rows)
            print('  %-36s 命中 %s' % (name, {k: len(v) for k, v in part.items()}))

    if not found:
        print('没有抓到任何 DELETE 行事件（时间窗/表名可能不对）')
        return 1

    print()
    print('%-26s %8s' % ('表', '被删行数'))
    print('-' * 36)
    for t in sorted(found, key=lambda x: -len(found[x])):
        print('%-26s %8d' % (t, len(found[t])))
    total = sum(len(v) for v in found.values())
    print('%-26s %8d' % ('合计', total))

    os.makedirs(os.path.dirname(os.path.abspath(a.out)), exist_ok=True)
    with io.open(a.out, 'w', encoding='utf-8', newline='\n') as f:
        f.write('-- 由 tools/binlog-undelete.py 生成\n')
        f.write('-- 来源：MySQL binlog (ROW 格式)，时间窗 %s ~ %s\n' % (a.start, a.stop))
        f.write('-- 作用：把被 sql/data.sql 的 DELETE 掉的增量数据补回来。\n')
        f.write('--       用 INSERT IGNORE，种子行已存在会自动跳过，不会重复。\n')
        f.write('-- 用法：mysql -u root -p zhixiaofa < %s\n' % os.path.basename(a.out))
        f.write('SET NAMES utf8mb4;\nSET FOREIGN_KEY_CHECKS = 0;\n\n')
        for t in sorted(found):
            f.write('-- %s: %d 行\n' % (t, len(found[t])))
            for row in found[t]:
                vals = ', '.join('NULL' if v is None else v for v in row)
                f.write('INSERT IGNORE INTO `%s` VALUES (%s);\n' % (t, vals))
            f.write('\n')
        f.write('SET FOREIGN_KEY_CHECKS = 1;\n')
    print()
    print('已写入 %s（%d 条 INSERT）' % (a.out, total))
    return 0


if __name__ == '__main__':
    sys.exit(main())
