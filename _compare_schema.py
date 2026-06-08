# -*- coding: utf-8 -*-
import csv, re, io

CSV_PATH = r"C:\it\table.csv"
DDL_PATH = r"C:\it\it_database\ITPAPP_DDL_live.sql"

# ---------- meta CSV 파싱 ----------
# 컬럼: 영문테이블,한글테이블,영문컬럼,한글컬럼,DATA TYPE,NULL 여부,정수,소수점,PK
meta = {}  # table -> {col -> dict}
with io.open(CSV_PATH, encoding="utf-8-sig") as f:
    r = csv.reader(f)
    header = next(r)
    for row in r:
        if len(row) < 5 or not row[0].strip():
            continue
        tbl = row[0].strip()
        col = row[2].strip()
        dtype = row[4].strip().upper()
        prec = row[6].strip() if len(row) > 6 else ""
        scale = row[7].strip() if len(row) > 7 else ""
        # 정규화된 타입 문자열
        if dtype == "VARCHAR2":
            tnorm = "VARCHAR2(%s)" % prec if prec else "VARCHAR2"
        elif dtype == "NUMBER":
            if prec and scale:
                tnorm = "NUMBER(%s,%s)" % (prec, scale)
            elif prec:
                tnorm = "NUMBER(%s)" % prec
            else:
                tnorm = "NUMBER"
        else:
            tnorm = dtype
        meta.setdefault(tbl, {})[col] = {"type": tnorm, "raw": dtype, "prec": prec, "scale": scale}

# ---------- DDL 파싱 ----------
ddl_txt = io.open(DDL_PATH, encoding="utf-8", errors="replace").read()
live = {}  # table -> {col -> typestr}

# CREATE TABLE 블록 분리
blocks = re.split(r'CREATE TABLE ', ddl_txt)
for b in blocks[1:]:
    m = re.match(r'"ITPAPP"\."([A-Z0-9_]+)"', b)
    if not m:
        continue
    tbl = m.group(1)
    # 괄호 본문 추출: 첫 ( 부터
    start = b.find("(")
    if start < 0:
        continue
    body = b[start+1:]
    cols = {}
    for line in body.splitlines():
        line = line.strip().rstrip(",").strip()
        cm = re.match(r'"([A-Z0-9_]+)"\s+(.+)', line)
        if not cm:
            continue
        col = cm.group(1)
        rest = cm.group(2)
        if col in ("CONSTRAINT",):
            continue
        # 타입 추출
        tm = re.match(r'(VARCHAR2|NUMBER|DATE|CLOB|CHAR|TIMESTAMP|BLOB|FLOAT)\s*(\([^)]*\))?', rest)
        if not tm:
            continue
        base = tm.group(1)
        paren = tm.group(2) or ""
        if base == "VARCHAR2":
            pm = re.search(r'\((\d+)', paren)
            tnorm = "VARCHAR2(%s)" % pm.group(1) if pm else "VARCHAR2"
        elif base == "NUMBER":
            pm = re.search(r'\((\d+)\s*,\s*(\d+)\)', paren)
            if pm:
                p, s = pm.group(1), pm.group(2)
                tnorm = "NUMBER(%s)" % p if s == "0" else "NUMBER(%s,%s)" % (p, s)
            else:
                pm2 = re.search(r'\((\d+)\)', paren)
                tnorm = "NUMBER(%s)" % pm2.group(1) if pm2 else "NUMBER"
        else:
            tnorm = base
        if col not in cols:  # CONSTRAINT 라인 등 중복 방지, 첫 정의 사용
            cols[col] = tnorm
    live[tbl] = cols

meta_tbls = set(meta.keys())
live_tbls = set(live.keys())

out = []
def p(s=""):
    out.append(s)

p("# 메타DB(table.csv) vs 현재DB(ITPAPP_DDL_live.sql) 스키마 비교")
p("")
p("- 메타 테이블 수: %d" % len(meta_tbls))
p("- 현재DB 테이블 수: %d" % len(live_tbls))
p("")

only_meta = sorted(meta_tbls - live_tbls)
only_live = sorted(live_tbls - meta_tbls)
both = sorted(meta_tbls & live_tbls)

p("## 1. 테이블 차이")
p("")
p("### 메타에만 있음 (현재DB 없음) : %d개" % len(only_meta))
for t in only_meta:
    p("- %s" % t)
p("")
p("### 현재DB에만 있음 (메타 없음) : %d개" % len(only_live))
for t in only_live:
    p("- %s" % t)
p("")

p("## 2. 공통 테이블 컬럼/타입 차이 (%d개 테이블 검사)" % len(both))
p("")
any_diff = False
for t in both:
    mc = meta[t]
    lc = live[t]
    mcols = set(mc.keys())
    lcols = set(lc.keys())
    only_m = sorted(mcols - lcols)
    only_l = sorted(lcols - mcols)
    type_diff = []
    for c in sorted(mcols & lcols):
        mt = mc[c]["type"]
        lt = lc[c]
        # DATE/CLOB 등은 그대로 비교; 비교 정규화
        if mt != lt:
            type_diff.append((c, mt, lt))
    if only_m or only_l or type_diff:
        any_diff = True
        p("### %s" % t)
        if only_m:
            p("- 메타에만 있는 컬럼: %s" % ", ".join(only_m))
        if only_l:
            p("- 현재DB에만 있는 컬럼: %s" % ", ".join(only_l))
        for c, mt, lt in type_diff:
            p("- 타입차이 `%s`: 메타=%s / 현재DB=%s" % (c, mt, lt))
        p("")
if not any_diff:
    p("공통 테이블의 컬럼/타입 차이 없음.")

io.open(r"C:\it\_schema_diff.md", "w", encoding="utf-8").write("\n".join(out))
print("\n".join(out))
