#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
法律正文导入工具 —— 把官方 Word/文本文件按「第X条」切分，回填 law_article.content

【为什么需要它】
  `LawSyncService` 只能从国家法律法规数据库抓到「目录树」（法规名 + 条号 + 分类），
  抓不到条文正文：官网的正文与文件下载都要求「已登录会话」
  （实测：GET /law-search/download/pc 给了 bbbs 仍返回 {"msg":"系统异常"}），
  正文只通过带签名的 OFD 阅读器展示，无法匿名批量抓取。
  因此正文的权威来源是「官方文档导入」——就是本工具。

【怎么用】
  1) 到 https://flk.npc.gov.cn/ 搜索目标法律 → 进详情页 → 下载 Word（.docx）
     （免费注册登录后即可下载；6 部法律约需下载 6 次）
  2) 把 .docx 放到任意目录，然后：
       python tools/import-law-docx.py --file 中华人民共和国劳动合同法.docx --law 中华人民共和国劳动合同法
     默认是「预演」，只打印匹配结果、不写库；确认无误后加 --apply 真正写入。
  3) 支持 .docx / .doc（另存为 .txt 或 .html 后同样支持）/ .txt / .html

【匹配规则】
  以 (law_name, article_no) 为准，与 law_article 表的唯一索引 uk_law_name_no 一致。
  例：文档里的「第二十条 → 正文」会更新
      WHERE law_name='中华人民共和国劳动合同法' AND article_no='第二十条' 的那一行。
  只更新 content（可选 --set-title 用「第X章/节」回填章节列），不动其他列。

【安全】
  · 默认 dry-run，必须显式 --apply 才写库
  · 写库前自动建/刷新备份表 law_article_bak_docximport
"""

import argparse
import io
import os
import re
import subprocess
import sys
import zipfile

# ---------------------------------------------------------------- 文档解析

ARTICLE_RE = re.compile(r'^第[一二三四五六七八九十百千零〇两]+条$')
CHAPTER_RE = re.compile(r'^第[一二三四五六七八九十百千零〇两]+章\s*(.*)$')
SECTION_RE = re.compile(r'^第[一二三四五六七八九十百千零〇两]+节\s*(.*)$')


def read_docx(path):
    """读 .docx 的段落文本（word/document.xml 里的 <w:p>）"""
    with zipfile.ZipFile(path) as z:
        names = [n for n in z.namelist() if n == 'word/document.xml']
        if not names:
            raise RuntimeError('不是标准的 .docx（找不到 word/document.xml）')
        xml = z.read('word/document.xml').decode('utf-8', 'replace')
    paras = []
    for p in re.findall(r'<w:p[ >].*?</w:p>', xml, re.S):
        # 段落里的文本片段：<w:t>…</w:t>；<w:tab/> 视作空白
        txt = ''.join(re.findall(r'<w:t[^>]*>(.*?)</w:t>', p, re.S))
        txt = (txt.replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
                  .replace('&quot;', '"').replace('&apos;', "'"))
        txt = txt.replace('<w:tab/>', ' ').strip()
        paras.append(txt)
    return paras


def read_text(path):
    raw = open(path, 'rb').read()
    for enc in ('utf-8', 'utf-8-sig', 'gbk', 'gb18030'):
        try:
            t = raw.decode(enc)
            break
        except Exception:
            continue
    else:
        t = raw.decode('utf-8', 'replace')
    if path.lower().endswith(('.html', '.htm')):
        t = re.sub(r'(?is)<(script|style)[^>]*>.*?</\1>', ' ', t)
        t = re.sub(r'(?i)<(br|/p|/div|/h\d)[^>]*>', '\n', t)
        t = re.sub(r'(?s)<[^>]+>', '', t)
        t = (t.replace('&nbsp;', ' ').replace('&amp;', '&')
              .replace('&lt;', '<').replace('&gt;', '>'))
    return t.replace('\r\n', '\n').replace('\r', '\n').split('\n')


def load_paragraphs(path):
    ext = os.path.splitext(path)[1].lower()
    if ext == '.docx':
        return read_docx(path)
    if ext == '.doc':
        raise SystemExit('不支持旧版 .doc —— 请在 Word 里「另存为」.docx 或 .txt 后再试')
    return read_text(path)


def split_articles(paras):
    """把段落序列切成 {条号: 正文}；同时记录章节标题用于回填"""
    out, chapter, section = {}, None, None
    cur_no, buf = None, []

    def flush():
        if cur_no:
            text = ' '.join(x for x in buf if x).strip()
            text = re.sub(r'\s{2,}', ' ', text)
            if text:
                out[cur_no] = (text, chapter, section)

    for raw in paras:
        line = raw.strip().lstrip('\ufeff')
        if not line:
            continue
        # 去掉行内的页码/页眉噪声
        if re.fullmatch(r'[-—\s]*\d+[-—\s]*', line):
            continue
        # 「第一条 正文…」写在同一段的紧凑排版
        m_inline = re.match(r'^(第[一二三四五六七八九十百千零〇两]+条)\s*(.*)$', line)
        if ARTICLE_RE.match(line) or (m_inline and m_inline.group(2)):
            flush()
            cur_no = m_inline.group(1)
            buf = [m_inline.group(2)]
            continue
        m_ch, m_se = CHAPTER_RE.match(line), SECTION_RE.match(line)
        if m_ch:
            flush(); cur_no, buf = None, []
            chapter, section = line, None
            continue
        if m_se:
            flush(); cur_no, buf = None, []
            section = line
            continue
        if cur_no:
            buf.append(line)
    flush()
    return out


# ---------------------------------------------------------------- 数据库

def db_conn(argv_mysql, cfg_path):
    raw = open(cfg_path, 'rb').read()
    try:
        cfg = raw.decode('utf-8')
    except Exception:
        cfg = raw.decode('gbk', 'replace')
    g = lambda k: re.search(r'%s\s*=\s*(\S+)' % k, cfg).group(1)
    url = g('jdbc.url')
    m = re.search(r'//([^:/]+):(\d+)/([^?]+)', url)
    return dict(mysql=argv_mysql, host=m.group(1), port=m.group(2), db=m.group(3),
                user=g('jdbc.username'), pwd=g('jdbc.password'))


def sql(conn, stmt, want_rows=True):
    args = [conn['mysql'], '-h', conn['host'], '-P', conn['port'],
            '-u', conn['user'], '-p' + conn['pwd'],
            '--default-character-set=utf8mb4', '-N', '-B', conn['db'], '-e', stmt]
    p = subprocess.run(args, capture_output=True, timeout=120)
    out = p.stdout.decode('utf-8', 'replace')
    err = '\n'.join(l for l in p.stderr.decode('utf-8', 'replace').split('\n')
                    if 'Using a password' not in l).strip()
    if err and 'ERROR' in err:
        raise RuntimeError(err)
    return out


def esc(s):
    return (s.replace('\\', '\\\\').replace("'", "\\'"))


# ---------------------------------------------------------------- 主流程

def main():
    ap = argparse.ArgumentParser(description='把官方文档的条文正文导入 law_article')
    ap.add_argument('--file', required=True, help='官方文档路径（.docx/.txt/.html）')
    ap.add_argument('--law', required=True, help='法规全名，须与 law_article.law_name 完全一致')
    ap.add_argument('--apply', action='store_true', help='真正写库（默认只预演）')
    ap.add_argument('--set-title', action='store_true', help='同时用「第X章/节」回填 title 列')
    ap.add_argument('--mysql', default=r'D:\Program Files\MySQL\MySQL Server 8.0\bin\mysql.exe')
    ap.add_argument('--db-config', default='src/main/resources/db.properties')
    a = ap.parse_args()

    paras = load_paragraphs(a.file)
    arts = split_articles(paras)
    print('文档: %s' % a.file)
    print('  段落数 %d，解析出条文 %d 条' % (len(paras), len(arts)))
    if not arts:
        raise SystemExit('没有解析出「第X条」，请检查文档格式')

    conn = db_conn(a.mysql, a.db_config)
    rows = sql(conn, "SELECT article_no FROM law_article WHERE law_name='%s';" % esc(a.law))
    have = set(x.strip() for x in rows.split('\n') if x.strip())
    print('  库中该法律已有 %d 条' % len(have))

    hit = [k for k in arts if k in have]
    miss = [k for k in arts if k not in have]
    extra = sorted(have - set(arts))
    print('  ✓ 能对应上 %d 条' % len(hit))
    print('  · 文档有、库中没有 %d 条%s' % (len(miss), ('：' + '、'.join(miss[:8])) if miss else ''))
    print('  · 库中有、文档没有 %d 条%s' % (len(extra), ('：' + '、'.join(extra[:8])) if extra else ''))

    if hit:
        k = hit[0]
        print()
        print('  示例（%s）：%s' % (k, arts[k][0][:120] + ('…' if len(arts[k][0]) > 120 else '')))

    if not a.apply:
        print()
        print('（预演模式，未写库。确认无误后加 --apply）')
        return

    sql(conn, "DROP TABLE IF EXISTS law_article_bak_docximport;")
    sql(conn, "CREATE TABLE law_article_bak_docximport AS SELECT * FROM law_article;")
    print()
    print('已备份到 law_article_bak_docximport')

    n = 0
    for k in hit:
        text, ch, se = arts[k]
        sets = ["content='%s'" % esc(text)]
        if a.set_title:
            title = ' · '.join(x for x in (ch, se) if x)
            if title:
                sets.append("title='%s'" % esc(title))
        sql(conn, "UPDATE law_article SET %s WHERE law_name='%s' AND article_no='%s' LIMIT 1;"
                  % (', '.join(sets), esc(a.law), esc(k)))
        n += 1
    print('已写入 %d 条正文' % n)
    left = sql(conn, "SELECT COUNT(*) FROM law_article WHERE law_name='%s' AND (content IS NULL OR content='');" % esc(a.law))
    print('该法律仍无正文的条数: %s' % left.strip())


if __name__ == '__main__':
    main()
