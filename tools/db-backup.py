#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
数据库快照备份工具（带自校验）

【为什么需要它】
  2026-09-21 我在做「重置前备份」时踩了一个坑：从 `mysql -N -B` 读表名时，
  输出是 CRLF，`.split('\\n')` 会在每个名字尾部留一个 `\\r`，
  拼出的表名变成了 "law_article\\r_bak_reset" —— MySQL 把 `\\r` 当空白，
  `CREATE TABLE law_article _bak_reset...` 直接语法报错，
  **而我当时没检查返回值，于是 16 张表的备份全部静默失败。**
  本工具用 `.strip()` 剥掉换行符，并且**逐表比对源表与备份表的行数**，
  任何一张对不上就整体报错退出。

用法：
    python tools/db-backup.py                 # 快照 -> <表名>_bak_<时间戳>
    python tools/db-backup.py --suffix seed   # 自定义后缀
    python tools/db-backup.py --list          # 只看有哪些备份表
    python tools/db-backup.py --verify xxx    # 校验某批备份是否与源表一致
"""

import argparse
import os
import re
import subprocess
import sys
import time

DEFAULT_MYSQL = r'D:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe'


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


class Db:
    def __init__(self, cfg, mysql):
        self.cfg, self.mysql = cfg, mysql

    def run(self, stmt, database=None, check=True):
        args = [self.mysql, '-h', self.cfg['host'], '-P', self.cfg['port'],
                '-u', self.cfg['user'], '-p' + self.cfg['pwd'],
                '--default-character-set=utf8mb4', '-N', '-B']
        if database:
            args.append(database)
        args += ['-e', stmt]
        p = subprocess.run(args, capture_output=True, timeout=600)
        out = p.stdout.decode('utf-8', 'replace')
        err = '\n'.join(l for l in p.stderr.decode('utf-8', 'replace').split('\n')
                        if 'Using a password' not in l).strip()
        if check and ('ERROR' in err or p.returncode != 0):
            raise RuntimeError('SQL 失败: %s\n  stmt=%s' % (err[:300], stmt[:200]))
        # 关键：CRLF 输出必须 strip，否则表名会带上 \r
        rows = [l.strip() for l in out.replace('\r\n', '\n').split('\n') if l.strip()]
        return rows

    def tables(self):
        return self.run("SELECT TABLE_NAME FROM information_schema.TABLES "
                        "WHERE TABLE_SCHEMA='%s' AND TABLE_TYPE='BASE TABLE' "
                        "ORDER BY TABLE_NAME;" % self.cfg['db'])

    def count(self, t):
        return int(self.run('SELECT COUNT(*) FROM `%s`;' % t, self.cfg['db'])[0])

    def exists(self, t):
        return bool(self.run("SELECT COUNT(*) FROM information_schema.TABLES "
                             "WHERE TABLE_SCHEMA='%s' AND TABLE_NAME='%s';"
                             % (self.cfg['db'], t), self.cfg['db'])[0] != '0')


def do_backup(db, suffix, skip_re):
    stamp = suffix or time.strftime('%Y%m%d_%H%M%S')
    tgt = db.tables()
    todo = [t for t in tgt if not re.search(skip_re, t) and not t.endswith('_bak_' + stamp)]
    print('将备份 %d 张表 -> 后缀 _bak_%s' % (len(todo), stamp))
    made = []
    for t in todo:
        dst = '%s_bak_%s' % (t, stamp)
        db.run('DROP TABLE IF EXISTS `%s`;' % dst, db.cfg['db'])
        db.run('CREATE TABLE `%s` AS SELECT * FROM `%s`;' % (dst, t), db.cfg['db'])
        made.append((t, dst))

    print()
    print('%-26s %10s %10s %s' % ('源表', '源行数', '备份行数', '校验'))
    print('-' * 62)
    bad = []
    for t, dst in made:
        a, b = db.count(t), db.count(dst)
        ok = (a == b)
        if not ok:
            bad.append(t)
        print('%-26s %10d %10d %s' % (t, a, b, '✓' if ok else '✗ 不一致'))
    print()
    if bad:
        print('!! 有 %d 张表的备份行数与源表不一致：%s' % (len(bad), bad))
        return 1
    print('全部 %d 张表备份完成且行数一致 ✓' % len(made))
    return 0


def do_list(db):
    rows = db.run("SELECT TABLE_NAME, TABLE_ROWS FROM information_schema.TABLES "
                  "WHERE TABLE_SCHEMA='%s' AND TABLE_NAME LIKE '%%\\_bak\\_%%' ORDER BY TABLE_NAME;"
                  % db.cfg['db'])
    print('已有备份表 %d 个：' % len(rows))
    for r in rows:
        name = r.split('\t')[0]
        try:
            n = db.count(name)
        except Exception:
            n = -1
        print('  %-52s %d 行' % (name, n))
    return 0


def do_verify(db, stamp):
    ok = True
    print('%-26s %10s %10s %s' % ('源表', '源行数', '备份行数', '校验'))
    print('-' * 62)
    for t in db.tables():
        dst = '%s_bak_%s' % (t, stamp)
        if not db.exists(dst):
            continue
        a, b = db.count(t), db.count(dst)
        if a != b:
            ok = False
        print('%-26s %10d %10d %s' % (t, a, b, '✓' if a == b else '✗'))
    print()
    print('结论: %s' % ('备份与源表一致 ✓' if ok else '存在不一致 ✗'))
    return 0 if ok else 1


def main():
    ap = argparse.ArgumentParser(description='数据库快照备份（带行数自校验）')
    ap.add_argument('--suffix', default='', help='备份后缀（默认用时间戳）')
    ap.add_argument('--list', action='store_true', help='列出已有备份表')
    ap.add_argument('--verify', default='', help='校验指定后缀的备份')
    ap.add_argument('--mysql', default=DEFAULT_MYSQL)
    ap.add_argument('--db-config', default='src/main/resources/db.properties')
    ap.add_argument('--skip', default=r'_bak_', help='跳过匹配该正则的表名（默认 _bak_）')
    a = ap.parse_args()

    db = Db(read_db_config(a.db_config), a.mysql)
    if a.list:
        return do_list(db)
    if a.verify:
        return do_verify(db, a.verify)
    return do_backup(db, a.suffix, a.skip)


if __name__ == '__main__':
    sys.exit(main())
