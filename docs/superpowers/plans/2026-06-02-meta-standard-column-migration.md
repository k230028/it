# ITPAPP 표준명칭 컬럼 마이그레이션 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `docs/meta-compliance-report.md`의 확정 매핑대로 ITPAPP 스키마의 비표준 컬럼명을 표준 물리명으로 일괄 변경하고, 백엔드(JPA/네이티브쿼리)·프론트(타입변경 컬럼만)를 정합화한다.

**Architecture:** 전략은 **물리명만 변경**이다. DB 컬럼명과 JPA `@Column(name=...)`·네이티브 SQL만 바꾸고 Java 필드명(camelCase)·DTO·API JSON 키·프론트 필드명은 그대로 둔다. 따라서 타입이 동일한 rename은 프론트에 무영향이고, **타입까지 바뀌는 7개 컬럼만** 프론트 타입 정의를 함께 수정한다. DB 변경은 보고서를 입력으로 받는 멱등(idempotent) 생성기가 Flyway 스타일 SQL을 만들어 수동 실행한다(Flyway 런타임은 미설치 상태이므로 sqlplus 수동 적용).

**Tech Stack:** Oracle 21c XE(ITPAPP), Spring Boot + Spring Data JPA/Hibernate + QueryDSL(MyBatis 없음), Nuxt 4 + TypeScript, sqlplus(`C:\app\KDB\product\21c\dbhomeXE\bin`), Python 3.11(생성기).

---

## 핵심 컨텍스트 (실행 전 반드시 숙지)

1. **매핑 원천(SoT):** `docs/meta-compliance-report.md`.
   - §3 지정(전문가) 94건 = rename 대상(이 중 5건은 "타입변경 수반").
   - §4 표준명(타입변경) 2건 = 이름 유지, DATE→VARCHAR2(8) 타입만 변환.
   - §5 등록예정 8건 = **rename 없음**(현재명 유지). DB 변경 대상 아님. meta.csv 등록만(부록 B).
   - §6 삭제후보 5건 = 컬럼 DROP.
   - §2 타깃 신규등록 3건(`DVM_CGPR_ID`,`DVM_TLR_USID`,`SVN_DPM_TLR_USID`) = DB는 그대로 rename(타입 동일), meta.csv 등록만 별도(부록 B).

2. **L/M 이중 테이블:** 모든 마스터 테이블 `TPRMPP_xxxxM`은 변경로그 테이블 `TPRMPP_xxxxL`을 가지며 **동일 컬럼을 공유**한다. 모든 rename/drop/retype은 **두 테이블 모두**에 적용한다(보고서 "사용테이블" 칼럼이 둘 다 명시).

3. **동일테이블 타깃 충돌 점검 결과(라이브 DB 실데이터 기준):** 7개 충돌 쌍을 실제 데이터 적재로 재판정했다.

   **(a) 진짜 충돌 — 양쪽 다 데이터 보유 → 보류(이번 범위 제외):** 사용자 쌍별 지정 후 별도 마이그레이션. 생성기가 자동 격리한다.

   | 테이블(L+M) | 충돌 컬럼(데이터 행수) | 지정 타깃 |
   |---|---|---|
   | BITEML, BITEMM | `GCL_SNO`(63), `PRJ_SNO`(63) | SNO |
   | BTERML, BTERMM | `IT_MNGC_SNO`(114), `TMN_SNO`(114) | SNO |
   | CBLBCL, CBLBCM | `HRK_NAC_MNG_NO`(31), `NAC_GRP_NO`(135) | CNCD_RFR_NO |

   **(b) 가짜 충돌 — 한쪽이 전부 NULL → 빈 컬럼 drop으로 자동 해소(이번에 반영):** 빈 중복 컬럼을 `삭제후보`(보고서 §6)로 재분류하여 충돌을 제거했다. 파트너 컬럼은 정상 rename된다.

   | 테이블(L+M) | 채택(rename) | drop(빈 컬럼) | 타깃 |
   |---|---|---|---|
   | BRIVGL, BRIVGM | `IDC_ID`(3) | `MARK_ID`(0) | RFR_ID |
   | BRIVGL, BRIVGM | `QOT_CONE`(3) | `QTD_CONE`(0) | RFR_CONE |
   | CBLBCL | `END_DT`(0) | `END_YMD`(0) | END_DTM |
   | CBLBCL | `STT_DT`(0) | `STT_YMD`(0) | STT_DTM |

   주의 1: `END_DT`/`STT_DT`/`PRJ_SNO`/`IT_MNGC_SNO`는 충돌 테이블에서만 영향받고, 충돌 없는 테이블(예: `END_DT`@BPROJL/BPROJM)에서는 정상 rename된다. 생성기가 (테이블,타깃) 단위로 판별한다.
   주의 2: (b)의 "한쪽 전부 NULL"은 **개발 DB 기준**이다. 운영 적용 전 동일 점검(부록 D 쿼리)으로 운영 DB에서도 빈 컬럼임을 반드시 재확인한다. 운영에 데이터가 있으면 (a)로 되돌려 보류한다.

4. **타입변경으로 프론트까지 영향받는 7개 컬럼**(Java 필드 타입이 바뀜):

   | 컬럼 | 테이블 | 현재 Java | 변경 후 | 프론트 영향 |
   |---|---|---|---|---|
   | `CMMT_MNG_NO`→CMMT_SNO | CCMMTM/L | String | Long | `cmmtMngNo: string`→`number` |
   | `CMMT_GRP_NO`→CMMT_TGT_SNO | CCMMTM/L | String | Long | `cmmtGrpNo` 류 |
   | `HRK_CMMT_MNG_NO`→HRK_CMMT_SNO | CCMMTM/L | String | Long | `hrkCmmtMngNo` 류 |
   | `FSG_TLM`→RVW_FSG_TLM_DT | BRDOCM/L | LocalDate | String | 날짜→문자열 |
   | `LBL_FSG_TLM`→FLF_FSG_DT | BPROJM/L | LocalDate | String | 날짜→문자열 |
   | `FST_DFR_DT`(이름유지) | BCOSTM/L | LocalDate | String | 날짜→문자열 |
   | `XCR_BSE_DT`(이름유지) | BCOSTM/L | LocalDate | String | 날짜→문자열 |

5. **테이블 → 엔티티 파일 매핑(마스터 + 로그):**

   | 테이블 | 마스터 엔티티 | 로그 엔티티 |
   |---|---|---|
   | BCOSTM/L | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java` | `.../domain/log/entity/BcostmL.java` |
   | BPROJM/L | `.../domain/budget/project/entity/Bprojm.java` | `.../domain/log/entity/BprojmL.java` |
   | BPROJA | `.../domain/budget/plan/entity/Bproja.java` | (없음) |
   | BPLANM/L | `.../domain/budget/plan/entity/Bplanm.java` | `.../domain/log/entity/BplanmL.java` |
   | BBUGTM/L | `.../domain/budget/work/entity/Bbugtm.java` | `.../domain/log/entity/BbugtL.java` |
   | BITEMM/L | `.../domain/budget/project/entity/Bitemm.java` | `.../domain/log/entity/BitemmL.java` |
   | BTERMM/L | `.../domain/budget/cost/entity/Btermm.java` | `.../domain/log/entity/BtermmL.java` |
   | BGDOCM/L | `.../domain/budget/document/entity/Bgdocm.java` | `.../domain/log/entity/BgdocmL.java` |
   | BRDOCM/L | `.../domain/budget/document/entity/Brdocm.java` | `.../domain/log/entity/BrdocmL.java` |
   | BRIVGM/L | `.../domain/budget/document/entity/Brivgm.java` | `.../domain/log/entity/BrivgmL.java` |
   | CBLBMM/L | `.../common/board/entity/Cblbmm.java` | `.../domain/log/entity/CblbmmL.java` |
   | CBLBCM/L | `.../common/board/entity/Cblbcm.java` | `.../domain/log/entity/CblbcmL.java` |
   | CCMMTM/L | `.../common/board/entity/Ccmmtm.java` | `.../domain/log/entity/CcmmtmL.java` |
   | CRTOKM | `.../common/system/entity/Crtokm.java` | (없음) |

6. **네이티브 쿼리(물리명 직접 참조) 3개 repo** — rename과 동시 수정 필수:
   - `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java` → `IT_MNGC_NO`(→BG_NO), `IT_MNGC_SNO`(BCOST에선 →SNO)
   - `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/BtermmRepository.java` → `TMN_MNG_NO`(등록예정·유지), `TMN_SNO`(보류 — 충돌)
   - `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java` → `PRJ_MNG_NO`(→ABUS_MNG_NO), `PRJ_SNO`(BPROJ에선 →SNO), `PRJ_STS`(→STS_TC)

7. **DB 접속:** `sqlplus ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1` (개발). 비밀번호는 `it_backend/src/main/resources/application.properties`의 `${DB_PASSWORD:kdb1234!!}` 기준.

8. **빌드/검증 명령(확인됨):** 백엔드 `cd it_backend && ./gradlew test` / `./gradlew clean build`. 프론트 `cd it_frontend && npm run typecheck && npm run lint && npm test`.

---

## File Structure

**생성/추가:**
- `it_database/migrations/_generate_rename.py` — 보고서→멱등 SQL 생성기(재실행 가능 도구)
- `it_database/migrations/V20260602_001__RenameStdColumns.sql` — 단순 rename
- `it_database/migrations/V20260602_002__RenameStdColumnsRetype.sql` — rename + 타입변환
- `it_database/migrations/V20260602_003__RetypeStdColumns.sql` — 타입만 변환(DATE→VARCHAR2(8))
- `it_database/migrations/V20260602_004__DropUnusedColumns.sql` — 컬럼 DROP
- `it_database/migrations/_apply_entity_rename.py` — 엔티티 `@Column(name)` 일괄 치환 코드모드
- `docs/superpowers/plans/2026-06-02-meta-standard-column-migration.md` — 본 계획

**수정:** §5 표의 엔티티 파일들, §6의 repo 3개, 프론트 타입 파일(`it_frontend/app/types/board.ts`, `it_frontend/app/composables/useCost.ts` 등 타입변경 컬럼 참조처).

---

## Phase 1 — 사전 준비 & DB 백업

### Task 1: 작업 브랜치 + DB 스키마 백업

**Files:** (없음 — 환경 준비)

- [ ] **Step 1: 브랜치 생성**

```bash
cd /c/it
git checkout -b feat/meta-standard-column-migration
```

- [ ] **Step 2: 현재 라이브 DDL 재추출(롤백 기준 스냅샷)**

`it_database/migrations/ITPAPP_DDL_live.sql`이 최신인지 확인하고, 변경 전 사본을 남긴다.

```bash
cd /c/it
cp it_database/migrations/ITPAPP_DDL_live.sql it_database/migrations/ITPAPP_DDL_pre_migration.sql
```

- [ ] **Step 3: 대상 테이블 데이터 백업(개발 DB)**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/exp.exe" ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 \
  file=it_database/migrations/pre_migration_backup.dmp \
  tables=TPRMPP_BCOSTM,TPRMPP_BCOSTL,TPRMPP_BPROJM,TPRMPP_BPROJL,TPRMPP_BPLANM,TPRMPP_BPLANL,TPRMPP_BBUGTM,TPRMPP_BBUGTL,TPRMPP_BITEMM,TPRMPP_BITEML,TPRMPP_BTERMM,TPRMPP_BTERML,TPRMPP_BGDOCM,TPRMPP_BGDOCL,TPRMPP_BRDOCM,TPRMPP_BRDOCL,TPRMPP_BRIVGM,TPRMPP_BRIVGL,TPRMPP_CBLBMM,TPRMPP_CBLBML,TPRMPP_CBLBCM,TPRMPP_CBLBCL,TPRMPP_CCMMTM,TPRMPP_CCMMTL,TPRMPP_CRTOKM
```

Expected: `Export terminated successfully` (또는 `exp` 미가용 시 Step 3을 Data Pump `expdp`로 대체).

- [ ] **Step 4: 커밋**

```bash
cd /c/it
git add it_database/migrations/ITPAPP_DDL_pre_migration.sql
git commit -m "chore: snapshot DDL before standard-column migration"
```

---

## Phase 2 — DB 마이그레이션 SQL 생성

### Task 2: SQL 생성기 작성

**Files:**
- Create: `it_database/migrations/_generate_rename.py`

- [ ] **Step 1: 생성기 파일 작성**

아래 전체 내용을 그대로 작성한다. 보고서 §3/§4/§6을 파싱하고, (테이블,타깃) 단위 충돌을 자동 격리하며, 멱등 PL/SQL을 4개 SQL로 출력한다.

```python
# -*- coding: utf-8 -*-
"""docs/meta-compliance-report.md → 멱등 Flyway SQL 생성. 루트(C:\\it)에서 실행."""
import re
from collections import defaultdict

REPORT = 'docs/meta-compliance-report.md'
OUT = 'it_database/migrations'

# 타입까지 바뀌는 rename: 타깃타입 + 값 변환식({old} 치환). 데이터 보존 변환에 사용.
RETYPE_CONV = {
    'CMMT_SNO':       ('NUMBER(9,0)',     "TO_NUMBER({old})"),
    'CMMT_TGT_SNO':   ('NUMBER(9,0)',     "TO_NUMBER({old})"),
    'HRK_CMMT_SNO':   ('NUMBER(9,0)',     "TO_NUMBER({old})"),
    'RVW_FSG_TLM_DT': ('VARCHAR2(8 CHAR)', "TO_CHAR({old},'YYYYMMDD')"),
    'FLF_FSG_DT':     ('VARCHAR2(8 CHAR)', "TO_CHAR({old},'YYYYMMDD')"),
}
# Java 타입까지 바뀌는(=프론트 영향) rename 컬럼.
RETYPE_COLS = {'CMMT_MNG_NO','CMMT_GRP_NO','HRK_CMMT_MNG_NO','FSG_TLM','LBL_FSG_TLM'}

def parse_report():
    rows=[]; sec=None
    for ln in open(REPORT,encoding='utf-8').read().splitlines():
        h=re.match(r'## \d+[a-z]?\.\s*(.+)',ln)
        if h: sec=h.group(1); continue
        if not ln.startswith('| `'): continue
        c=[x.strip() for x in ln.strip().strip('|').split('|')]
        if not c or not c[0].startswith('`'): continue
        col=c[0].strip('`')
        if sec and sec.startswith('지정(전문가)'):
            newcol=re.split(r'\s*/\s*',c[3])[0].strip().upper()
            tables=[t.strip() for t in c[2].split(',')]
            mt=re.search(r'\((VARCHAR2|NUMBER|CLOB|DATE)(\d+)?\)',c[3])
            ttype=mt.group(1) if mt else None
            tlen=int(mt.group(2)) if (mt and mt.group(2)) else None
            rows.append(dict(col=col,newcol=newcol,tables=tables,kind='rename',
                ttype=ttype,tlen=tlen,
                typechange=(col in RETYPE_COLS) or ('타입변경' in c[4])))
        elif sec and sec.startswith('표준명(타입변경)'):
            tables=[t.strip() for t in c[1].split(',')]
            rows.append(dict(col=col,newcol=col,tables=tables,kind='retype',typechange=True))
        elif sec and sec.startswith('삭제후보'):
            tables=[t.strip() for t in c[2].split(',')]
            rows.append(dict(col=col,newcol=None,tables=tables,kind='drop',typechange=False))
    return rows

def expand(rows):
    out=[]
    for r in rows:
        for short in r['tables']:
            out.append(dict(table=f'TPRMPP_{short}',col=r['col'],newcol=r['newcol'],
                kind=r['kind'],typechange=r['typechange'],
                ttype=r.get('ttype'),tlen=r.get('tlen')))
    return out

def detect_conflicts(items):
    grp=defaultdict(list)
    for it in items:
        if it['kind'] in('rename','retype'):
            grp[(it['table'],it['newcol'])].append(it['col'])
    return {k for k,v in grp.items() if len(set(v))>1}

def guard_rename(table,old,new,newtype=None):
    s=(f"DECLARE\n  has_old NUMBER; has_new NUMBER;\nBEGIN\n"
       f"  SELECT COUNT(*) INTO has_old FROM user_tab_columns WHERE table_name='{table}' AND column_name='{old}';\n"
       f"  SELECT COUNT(*) INTO has_new FROM user_tab_columns WHERE table_name='{table}' AND column_name='{new}';\n"
       f"  IF has_old=1 AND has_new=0 THEN\n"
       f"    EXECUTE IMMEDIATE 'ALTER TABLE {table} RENAME COLUMN {old} TO {new}';\n"
       f"  END IF;\nEND;\n/")
    if newtype: s+=f"\nALTER TABLE {table} MODIFY ({new} {newtype});"
    return s

def guard_drop(table,col):
    return (f"DECLARE\n  has_col NUMBER;\nBEGIN\n"
            f"  SELECT COUNT(*) INTO has_col FROM user_tab_columns WHERE table_name='{table}' AND column_name='{col}';\n"
            f"  IF has_col=1 THEN\n    EXECUTE IMMEDIATE 'ALTER TABLE {table} DROP COLUMN {col}';\n  END IF;\nEND;\n/")

def guard_rename_resize(table,old,new,tlen):
    """단순 rename(VARCHAR2) + 표준 길이 정규화.
    길이 축소 시: 초과 행을 TRIM(패딩 제거)하여 맞춘다. TRIM 후에도 초과하는 실데이터가 있으면
    MODIFY 를 건너뛰고(데이터 손실 방지) SKIP 메시지를 남긴다(길이는 현행 유지, 별도 코드매핑 필요)."""
    return (guard_rename(table,old,new)+"\n"
            # 패딩만 잘라 길이에 맞춤(맞는 행만 TRIM, 이미 맞는 행은 불변)
            f"UPDATE {table} SET {new}=TRIM({new})\n"
            f"  WHERE {new} IS NOT NULL AND LENGTH({new})>{tlen} AND LENGTH(TRIM({new}))<={tlen};\n"
            # TRIM 후에도 초과(실데이터)면 MODIFY 보류, 아니면 표준길이 적용
            f"DECLARE over_cnt NUMBER;\nBEGIN\n"
            f"  SELECT COUNT(*) INTO over_cnt FROM {table} WHERE {new} IS NOT NULL AND LENGTH({new})>{tlen};\n"
            f"  IF over_cnt=0 THEN\n"
            f"    EXECUTE IMMEDIATE 'ALTER TABLE {table} MODIFY ({new} VARCHAR2({tlen} CHAR))';\n"
            f"  ELSE\n"
            f"    DBMS_OUTPUT.PUT_LINE('SKIP MODIFY {table}.{new}: 실데이터 '||over_cnt||'행이 길이 {tlen} 초과 — 코드/값 매핑 필요');\n"
            f"  END IF;\nEND;\n/")

def guard_retype_rename(table,old,new,newtype,conv):
    """타입이 바뀌는 rename: 타깃컬럼 ADD -> 값 변환 UPDATE -> 구컬럼 DROP (멱등, 데이터 보존).
    단순 RENAME+MODIFY 는 데이터가 있으면 ORA-01439 로 실패하고 값 변환도 안 되므로 이 패턴을 쓴다."""
    convexpr=conv.format(old=old)
    return (f"DECLARE\n  has_new NUMBER; has_old NUMBER;\nBEGIN\n"
            f"  SELECT COUNT(*) INTO has_new FROM user_tab_columns WHERE table_name='{table}' AND column_name='{new}';\n"
            f"  IF has_new=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE {table} ADD ({new} {newtype})'; END IF;\n"
            f"END;\n/\n"
            f"UPDATE {table} SET {new}={convexpr} WHERE {old} IS NOT NULL AND {new} IS NULL;\n"
            f"DECLARE has_old NUMBER;\nBEGIN\n"
            f"  SELECT COUNT(*) INTO has_old FROM user_tab_columns WHERE table_name='{table}' AND column_name='{old}';\n"
            f"  IF has_old=1 THEN EXECUTE IMMEDIATE 'ALTER TABLE {table} DROP COLUMN {old}'; END IF;\n"
            f"END;\n/")

def header(title):
    return (f"-- ============================================================\n"
            f"-- {title}\n-- 생성: _generate_rename.py (보고서 기반, 멱등). 직접 수정 금지.\n"
            f"-- ============================================================\n")

def main():
    items=expand(parse_report()); conflicts=detect_conflicts(items)
    simple=[]; rt_rename=[]; rt_only=[]; drops=[]; deferred=[]
    for it in items:
        if it['kind'] in('rename','retype') and (it['table'],it['newcol']) in conflicts:
            deferred.append(it); continue
        if it['kind']=='drop': drops.append(it)
        elif it['kind']=='retype': rt_only.append(it)
        elif it['typechange']: rt_rename.append(it)
        else: simple.append(it)

    with open(f'{OUT}/V20260602_001__RenameStdColumns.sql','w',encoding='utf-8') as f:
        f.write(header('표준명칭 변경: RENAME + VARCHAR2 표준길이 정규화(패딩 자동 trim)'))
        f.write("SET SERVEROUTPUT ON\n")
        for it in sorted(simple,key=lambda x:(x['table'],x['col'])):
            f.write(f"\n-- {it['table']}: {it['col']} -> {it['newcol']}")
            if it['ttype']=='VARCHAR2' and it['tlen']:
                f.write(f" (VARCHAR2 길이 {it['tlen']} 정규화)\n")
                f.write(guard_rename_resize(it['table'],it['col'],it['newcol'],it['tlen'])+"\n")
            else:
                # NUMBER/CLOB/길이미상: 이름만 변경(정밀도/CLOB은 패딩 개념 없음 → 미변경)
                f.write("\n"+guard_rename(it['table'],it['col'],it['newcol'])+"\n")
        f.write("\nCOMMIT;\n")

    with open(f'{OUT}/V20260602_002__RenameStdColumnsRetype.sql','w',encoding='utf-8') as f:
        f.write(header('표준명칭 변경: 타입변경 동반 (데이터 보존 변환: ADD→UPDATE→DROP)'))
        for it in sorted(rt_rename,key=lambda x:(x['table'],x['col'])):
            spec=RETYPE_CONV.get(it['newcol'])
            assert spec,f"RETYPE_CONV 누락: {it['newcol']}"
            nt,conv=spec
            f.write(f"\n-- {it['table']}: {it['col']} -> {it['newcol']} ({nt}), 값 변환 {conv.format(old=it['col'])}\n")
            f.write(guard_retype_rename(it['table'],it['col'],it['newcol'],nt,conv)+"\n")
        f.write("\nCOMMIT;\n")

    with open(f'{OUT}/V20260602_003__RetypeStdColumns.sql','w',encoding='utf-8') as f:
        f.write(header('타입만 변환 (DATE -> VARCHAR2(8), 값 YYYYMMDD 변환)'))
        for it in sorted(rt_only,key=lambda x:(x['table'],x['col'])):
            t,c=it['table'],it['col']
            f.write(f"\n-- {t}: {c} DATE -> VARCHAR2(8)\n")
            f.write(f"DECLARE has_tmp NUMBER; BEGIN\n"
                    f"  SELECT COUNT(*) INTO has_tmp FROM user_tab_columns WHERE table_name='{t}' AND column_name='{c}_TMP';\n"
                    f"  IF has_tmp=0 THEN EXECUTE IMMEDIATE 'ALTER TABLE {t} ADD ({c}_TMP VARCHAR2(8 CHAR))'; END IF;\nEND;\n/\n")
            f.write(f"UPDATE {t} SET {c}_TMP=TO_CHAR({c},'YYYYMMDD') WHERE {c} IS NOT NULL AND {c}_TMP IS NULL;\n")
            f.write(f"ALTER TABLE {t} DROP COLUMN {c};\n")
            f.write(f"ALTER TABLE {t} RENAME COLUMN {c}_TMP TO {c};\n")
        f.write("\nCOMMIT;\n")

    with open(f'{OUT}/V20260602_004__DropUnusedColumns.sql','w',encoding='utf-8') as f:
        f.write(header('삭제후보 컬럼 DROP'))
        for it in sorted(drops,key=lambda x:(x['table'],x['col'])):
            f.write(f"\n-- {it['table']}: DROP {it['col']}\n"+guard_drop(it['table'],it['col'])+"\n")
        f.write("\nCOMMIT;\n")

    g=defaultdict(list)
    for it in deferred: g[(it['table'],it['newcol'])].append(it['col'])
    with open(f'{OUT}/_rename_conflicts.txt','w',encoding='utf-8') as f:
        f.write("동일 테이블 타깃 충돌 (보류 — 사용자 쌍별 지정 필요)\n")
        for (t,n),cs in sorted(g.items()): f.write(f"  {t}: {' , '.join(sorted(set(cs)))} -> {n}\n")
    print(f"simple={len(simple)} retype_rename={len(rt_rename)} retype_only={len(rt_only)} drops={len(drops)} deferred={len(deferred)}")

if __name__=='__main__': main()
```

- [ ] **Step 2: 생성기 실행**

```bash
cd /c/it
python it_database/migrations/_generate_rename.py
```

Expected (정확히 이 카운트여야 함):
```
simple=233 retype_rename=10 retype_only=8 drops=15 deferred=12
```

- [ ] **Step 3: 충돌 격리 검증**

```bash
cd /c/it
cat it_database/migrations/_rename_conflicts.txt
```

Expected: 진짜 충돌 3쌍만 — BITEML/BITEMM(GCL_SNO,PRJ_SNO→SNO), BTERML/BTERMM(IT_MNGC_SNO,TMN_SNO→SNO), CBLBCL/CBLBCM(HRK_NAC_MNG_NO,NAC_GRP_NO→CNCD_RFR_NO). 총 6행(쌍×L/M). (BRIVG·CBLBC의 빈 컬럼 충돌은 drop 재분류로 이미 해소됨.)

- [ ] **Step 4: 생성 SQL 멱등성 육안 점검**

```bash
cd /c/it
head -20 it_database/migrations/V20260602_001__RenameStdColumns.sql
```

Expected: 각 블록이 `user_tab_columns` 존재 검사 후에만 `RENAME COLUMN` 하는 `DECLARE...BEGIN...END;/` 형태. (재실행 안전.)

- [ ] **Step 5: 커밋**

```bash
cd /c/it
git add it_database/migrations/_generate_rename.py it_database/migrations/V20260602_*.sql it_database/migrations/_rename_conflicts.txt
git commit -m "feat(db): generate idempotent standard-column rename migrations"
```

---

## Phase 3 — DB 마이그레이션 적용 & 검증

### Task 3: 마이그레이션 실행

**Files:** (DB 상태 변경)

- [ ] **Step 1: 적용 전 컬럼 존재 확인(기준값 캡처)**

`it_database/migrations/_verify.sql` 작성:

```sql
SET PAGESIZE 0
SET FEEDBACK OFF
SELECT 'BG_NO@BCOSTM='||COUNT(*) FROM user_tab_columns WHERE table_name='TPRMPP_BCOSTM' AND column_name='BG_NO';
SELECT 'IT_MNGC_NO@BCOSTM='||COUNT(*) FROM user_tab_columns WHERE table_name='TPRMPP_BCOSTM' AND column_name='IT_MNGC_NO';
SELECT 'CMMT_SNO@CCMMTM='||COUNT(*) FROM user_tab_columns WHERE table_name='TPRMPP_CCMMTM' AND column_name='CMMT_SNO';
EXIT
```

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/_verify.sql
```

Expected (적용 전): `BG_NO@BCOSTM=0`, `IT_MNGC_NO@BCOSTM=1`, `CMMT_SNO@CCMMTM=0`.

- [ ] **Step 1b: 길이축소 사전검증 (패딩 trim으로 안 되는 실데이터 식별)**

VARCHAR2 길이가 표준보다 줄어드는 컬럼 중, **TRIM(패딩 제거) 후에도 표준 길이를 초과하는 실데이터**가 있으면 V001이 자동으로 길이축소를 건너뛴다(SKIP). 사전에 그 목록을 파악한다. `it_database/migrations/_lenreduce_check.sql`:

```sql
SET PAGESIZE 0
SET FEEDBACK OFF
-- trim 후에도 표준 길이를 초과하는 행수(>0 이면 길이축소 보류 + 코드/값 매핑 필요)
SELECT 'PUL_DTT@BPROJM ->ABUS_TC(2) over='||SUM(CASE WHEN LENGTH(TRIM(PUL_DTT))>2 THEN 1 ELSE 0 END) FROM TPRMPP_BPROJM;
SELECT 'PUL_DTT@BCOSTM ->ABUS_TC(2) over='||SUM(CASE WHEN LENGTH(TRIM(PUL_DTT))>2 THEN 1 ELSE 0 END) FROM TPRMPP_BCOSTM;
SELECT 'PRJ_STS@BPROJM ->STS_TC(2) over='||SUM(CASE WHEN LENGTH(TRIM(PRJ_STS))>2 THEN 1 ELSE 0 END) FROM TPRMPP_BPROJM;
EXIT
```

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/_lenreduce_check.sql
```

Expected(현재 개발 DB): `PUL_DTT ... over=23`, `PRJ_STS ... over=23`. 이들은 rename은 되지만 **길이축소는 자동 보류**(현행 길이 유지)되고 SKIP 메시지로 표시된다. 코드값 매핑은 별도 과제(부록 C). 그 외 컬럼은 패딩 trim으로 표준 길이가 자동 적용된다.

- [ ] **Step 2: 001 RENAME + 길이정규화 적용**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/V20260602_001__RenameStdColumns.sql
```

Expected: `Commit complete.` 출력 중 `SKIP MODIFY TPRMPP_BPROJM.ABUS_TC: 실데이터 23행이 길이 2 초과 — 코드/값 매핑 필요` 류 메시지 2~3건(PUL_DTT, PRJ_STS). 그 외 VARCHAR2 컬럼은 표준 길이로 정규화됨.

- [ ] **Step 2b: 타입변환 데이터 사전검증 (값 변환 가능성 확인)**

VARCHAR2→NUMBER 변환 대상에 숫자 아닌 값이 있으면 `TO_NUMBER`가 실패한다. 적용 전 점검. `it_database/migrations/_pretype_check.sql`:

```sql
SET PAGESIZE 0
SET FEEDBACK OFF
-- CMMT_* 3컬럼: 숫자 아닌 값 개수(0 이어야 함). CCMMTM + 로그 CCMMTL 모두.
SELECT 'CCMMTM.CMMT_MNG_NO nonnum='||COUNT(*) FROM TPRMPP_CCMMTM
  WHERE CMMT_MNG_NO IS NOT NULL AND NOT REGEXP_LIKE(CMMT_MNG_NO,'^[0-9]+$');
SELECT 'CCMMTM.CMMT_GRP_NO nonnum='||COUNT(*) FROM TPRMPP_CCMMTM
  WHERE CMMT_GRP_NO IS NOT NULL AND NOT REGEXP_LIKE(CMMT_GRP_NO,'^[0-9]+$');
SELECT 'CCMMTM.HRK_CMMT_MNG_NO nonnum='||COUNT(*) FROM TPRMPP_CCMMTM
  WHERE HRK_CMMT_MNG_NO IS NOT NULL AND NOT REGEXP_LIKE(HRK_CMMT_MNG_NO,'^[0-9]+$');
SELECT 'CCMMTL.CMMT_MNG_NO nonnum='||COUNT(*) FROM TPRMPP_CCMMTL
  WHERE CMMT_MNG_NO IS NOT NULL AND NOT REGEXP_LIKE(CMMT_MNG_NO,'^[0-9]+$');
-- 변환 대상 행수(보존 검증 기준값)
SELECT 'BRDOCM.FSG_TLM notnull='||COUNT(FSG_TLM) FROM TPRMPP_BRDOCM;
SELECT 'BPROJM.LBL_FSG_TLM notnull='||COUNT(LBL_FSG_TLM) FROM TPRMPP_BPROJM;
EXIT
```

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/_pretype_check.sql
```

Expected: 모든 `nonnum=0`. (현재 개발 DB: CCMMTM/CCMMTL 0행이므로 0. `notnull` 값(예: BRDOCM.FSG_TLM=2, BPROJM.LBL_FSG_TLM=9)은 Step 3 이후 보존 검증의 기준값으로 기록.) `nonnum>0`이면 해당 행 데이터를 먼저 정제(숫자화)한 뒤 진행.

- [ ] **Step 3: 002 타입변경 동반 변환 적용 (데이터 보존)**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/V20260602_002__RenameStdColumnsRetype.sql
```

Expected: `Commit complete.` (각 컬럼: 타깃컬럼 ADD → `TO_NUMBER`/`TO_CHAR(...,'YYYYMMDD')` 값 변환 UPDATE → 구컬럼 DROP. DATE 2/9행 값이 'YYYYMMDD' 문자열로 보존됨.)

- [ ] **Step 4: 003 타입만 변환 적용**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/V20260602_003__RetypeStdColumns.sql
```

Expected: `Commit complete.` (FST_DFR_DT/XCR_BSE_DT DATE→VARCHAR2(8), 값은 YYYYMMDD 문자열.)

- [ ] **Step 5: 004 컬럼 DROP 적용**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/V20260602_004__DropUnusedColumns.sql
```

Expected: `Commit complete.`

- [ ] **Step 6: 적용 후 검증(동일 스크립트 재실행)**

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/_verify.sql
```

Expected (적용 후): `BG_NO@BCOSTM=1`, `IT_MNGC_NO@BCOSTM=0`, `CMMT_SNO@CCMMTM=1`.

- [ ] **Step 6b: 데이터 보존 검증 (타입변환 컬럼 값/행수)**

타입변환으로 값이 유실/오변환되지 않았는지 확인. `it_database/migrations/_postdata_check.sql`:

```sql
SET PAGESIZE 0
SET FEEDBACK OFF
-- 변환 후 타깃컬럼 notnull 행수가 Step 2b 기준값과 일치해야 함.
SELECT 'BRDOCM.RVW_FSG_TLM_DT notnull='||COUNT(RVW_FSG_TLM_DT) FROM TPRMPP_BRDOCM;
SELECT 'BPROJM.FLF_FSG_DT notnull='||COUNT(FLF_FSG_DT) FROM TPRMPP_BPROJM;
SELECT 'BCOSTM.FST_DFR_DT notnull='||COUNT(FST_DFR_DT) FROM TPRMPP_BCOSTM;
-- 값 형식 검증: 'YYYYMMDD' 8자리 숫자 아닌 값 0 이어야 함.
SELECT 'RVW_FSG_TLM_DT bad='||COUNT(*) FROM TPRMPP_BRDOCM
  WHERE RVW_FSG_TLM_DT IS NOT NULL AND NOT REGEXP_LIKE(RVW_FSG_TLM_DT,'^[0-9]{8}$');
SELECT 'FLF_FSG_DT bad='||COUNT(*) FROM TPRMPP_BPROJM
  WHERE FLF_FSG_DT IS NOT NULL AND NOT REGEXP_LIKE(FLF_FSG_DT,'^[0-9]{8}$');
SELECT 'FST_DFR_DT bad='||COUNT(*) FROM TPRMPP_BCOSTM
  WHERE FST_DFR_DT IS NOT NULL AND NOT REGEXP_LIKE(FST_DFR_DT,'^[0-9]{8}$');
EXIT
```

```bash
cd /c/it
"/c/app/KDB/product/21c/dbhomeXE/bin/sqlplus.exe" -S ITPAPP/'kdb1234!!'@127.0.0.1:1521/XEPDB1 @it_database/migrations/_postdata_check.sql
```

Expected: `RVW_FSG_TLM_DT notnull=2`, `FLF_FSG_DT notnull=9`(= Step 2b 기준값과 동일), 모든 `bad=0`. 불일치 시 Step 7 롤백.

- [ ] **Step 7: (실패 시에만) 롤백**

001~004 중 실패하면, 백업으로 복원: 대상 테이블 truncate 후 `pre_migration_backup.dmp`를 `imp`로 적재하거나, 실패한 SQL의 역방향 rename을 수동 실행한다. 멱등 가드 덕분에 성공분 재실행은 무해하므로, 데이터 원인(예: 숫자 아닌 값) 교정 후 해당 SQL만 재적용한다.

- [ ] **Step 8: 커밋(검증 스크립트)**

```bash
cd /c/it
git add it_database/migrations/_verify.sql it_database/migrations/_pretype_check.sql it_database/migrations/_postdata_check.sql it_database/migrations/_lenreduce_check.sql
git commit -m "test(db): add schema + data-preservation + length-reduce verification"
```

---

## Phase 4 — 백엔드 엔티티 `@Column(name)` 정합화

### Task 4: 엔티티 일괄 치환 코드모드 작성

**Files:**
- Create: `it_database/migrations/_apply_entity_rename.py`

- [ ] **Step 1: 코드모드 작성**

보고서의 rename 매핑을 읽어, §5 표의 엔티티 파일에서 `@Column(name="OLD"` → `@Column(name="NEW"`로 치환한다. 충돌(보류) 컬럼과 등록예정 컬럼은 건너뛴다. 마스터/로그 두 파일 모두 처리.

```python
# -*- coding: utf-8 -*-
"""보고서 rename 매핑으로 JPA @Column(name) 치환. 루트(C:\\it)에서 실행."""
import re
from collections import defaultdict

REPORT='docs/meta-compliance-report.md'
BK='it_backend/src/main/java/com/kdb/it'
# 테이블약칭 -> [엔티티 파일들]
ENT={
 'BCOSTM':[f'{BK}/domain/budget/cost/entity/Bcostm.java'],'BCOSTL':[f'{BK}/domain/log/entity/BcostmL.java'],
 'BPROJM':[f'{BK}/domain/budget/project/entity/Bprojm.java'],'BPROJL':[f'{BK}/domain/log/entity/BprojmL.java'],
 'BPROJA':[f'{BK}/domain/budget/plan/entity/Bproja.java'],
 'BPLANM':[f'{BK}/domain/budget/plan/entity/Bplanm.java'],'BPLANL':[f'{BK}/domain/log/entity/BplanmL.java'],
 'BBUGTM':[f'{BK}/domain/budget/work/entity/Bbugtm.java'],'BBUGTL':[f'{BK}/domain/log/entity/BbugtL.java'],
 'BITEMM':[f'{BK}/domain/budget/project/entity/Bitemm.java'],'BITEML':[f'{BK}/domain/log/entity/BitemmL.java'],
 'BTERMM':[f'{BK}/domain/budget/cost/entity/Btermm.java'],'BTERML':[f'{BK}/domain/log/entity/BtermmL.java'],
 'BGDOCM':[f'{BK}/domain/budget/document/entity/Bgdocm.java'],'BGDOCL':[f'{BK}/domain/log/entity/BgdocmL.java'],
 'BRDOCM':[f'{BK}/domain/budget/document/entity/Brdocm.java'],'BRDOCL':[f'{BK}/domain/log/entity/BrdocmL.java'],
 'BRIVGM':[f'{BK}/domain/budget/document/entity/Brivgm.java'],'BRIVGL':[f'{BK}/domain/log/entity/BrivgmL.java'],
 'CBLBMM':[f'{BK}/common/board/entity/Cblbmm.java'],'CBLBML':[f'{BK}/domain/log/entity/CblbmmL.java'],
 'CBLBCM':[f'{BK}/common/board/entity/Cblbcm.java'],'CBLBCL':[f'{BK}/domain/log/entity/CblbcmL.java'],
 'CCMMTM':[f'{BK}/common/board/entity/Ccmmtm.java'],'CCMMTL':[f'{BK}/domain/log/entity/CcmmtmL.java'],
 'CRTOKM':[f'{BK}/common/system/entity/Crtokm.java'],
}
RETYPE_COLS={'CMMT_MNG_NO','CMMT_GRP_NO','HRK_CMMT_MNG_NO','FSG_TLM','LBL_FSG_TLM'}

def parse():
    rows=[]; sec=None
    for ln in open(REPORT,encoding='utf-8').read().splitlines():
        h=re.match(r'## \d+[a-z]?\.\s*(.+)',ln)
        if h: sec=h.group(1); continue
        if not ln.startswith('| `'): continue
        c=[x.strip() for x in ln.strip().strip('|').split('|')]
        if sec and sec.startswith('지정(전문가)'):
            rows.append((c[0].strip('`'),re.split(r'\s*/\s*',c[3])[0].strip().upper(),[t.strip() for t in c[2].split(',')]))
    return rows

def main():
    rows=parse()
    # (table,newcol)->[old] 충돌 판정
    grp=defaultdict(set)
    exp=[]
    for col,new,tables in rows:
        for t in tables: grp[(t,new)].add(col); exp.append((t,col,new))
    conflict={k for k,v in grp.items() if len(v)>1}
    changed=0; skipped=[]
    for t,col,new in exp:
        if (t,new) in conflict: skipped.append((t,col,'충돌보류')); continue
        for fp in ENT.get(t,[]):
            try: txt=open(fp,encoding='utf-8').read()
            except FileNotFoundError: skipped.append((t,col,'파일없음')); continue
            pat=f'@Column(name = "{col}"'; pat2=f'@Column(name="{col}"'
            if pat in txt: txt=txt.replace(pat,f'@Column(name = "{new}"'); changed+=1
            elif pat2 in txt: txt=txt.replace(pat2,f'@Column(name="{new}"'); changed+=1
            else: skipped.append((t,col,f'미발견@{fp.split("/")[-1]}')); continue
            open(fp,'w',encoding='utf-8').write(txt)
    print(f'changed={changed}')
    for s in skipped: print('  SKIP',s)

if __name__=='__main__': main()
```

- [ ] **Step 2: 코드모드 실행**

```bash
cd /c/it
python it_database/migrations/_apply_entity_rename.py
```

Expected: `changed=` 양수, SKIP 목록에 충돌보류(BITEM/BTERM/BRIVG/CBLBC 관련) 외 "미발견"이 없어야 함. "미발견"이 있으면 해당 엔티티의 `@Column` 표기(공백/length 인자 등)를 직접 확인 후 수동 수정.

- [ ] **Step 3: 컴파일 확인**

```bash
cd /c/it/it_backend
./gradlew compileJava
```

Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: 커밋**

```bash
cd /c/it
git add it_database/migrations/_apply_entity_rename.py it_backend/src/main/java
git commit -m "refactor(be): rename @Column physical names to standard terms"
```

---

## Phase 5 — 타입변경 컬럼의 Java 필드 타입 정합화

### Task 5: 5개 rename+retype 컬럼의 필드 타입 변경

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/entity/Ccmmtm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CcmmtmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brdocm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BrdocmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bprojm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BprojmL.java`

- [ ] **Step 1: 댓글 식별자 3필드 String→Long (Ccmmtm.java, CcmmtmL.java)**

각 파일에서 아래 3필드의 타입을 변경(필드명 유지):

```java
    // 변경 전: private String cmmtMngNo;   →  변경 후:
    @Column(name = "CMMT_SNO")
    private Long cmmtMngNo;

    // 변경 전: private String cmmtGrpNo;   →  변경 후:
    @Column(name = "CMMT_TGT_SNO")
    private Long cmmtGrpNo;

    // 변경 전: private String hrkCmmtMngNo;  →  변경 후:
    @Column(name = "HRK_CMMT_SNO")
    private Long hrkCmmtMngNo;
```

- [ ] **Step 2: 날짜→문자열 필드 (Brdocm/BrdocmL: fsgTlm, Bprojm/BprojmL: lblFsgTlm)**

```java
    // Brdocm.java, BrdocmL.java — 변경 전: private LocalDate fsgTlm;  →
    @Column(name = "RVW_FSG_TLM_DT")
    private String fsgTlm;

    // Bprojm.java, BprojmL.java — 변경 전: private LocalDate lblFsgTlm;  →
    @Column(name = "FLF_FSG_DT")
    private String lblFsgTlm;
```

- [ ] **Step 3: 영향 받는 서비스/매퍼 컴파일 오류 해소**

```bash
cd /c/it/it_backend
./gradlew compileJava
```

Expected: 처음엔 `cmmtMngNo`/`fsgTlm`을 String/LocalDate로 다루던 서비스에서 컴파일 오류 발생 가능. 오류 메시지의 파일을 열어, 비교·할당부를 Long/String에 맞게 수정(예: `.equals()` 인자, `LocalDate.parse()` 제거). 오류가 0이 될 때까지 반복 후 `BUILD SUCCESSFUL` 확인.

- [ ] **Step 4: 커밋**

```bash
cd /c/it
git add it_backend/src/main/java
git commit -m "refactor(be): change field types for retyped standard columns"
```

### Task 6: 이름유지 타입변경 2필드 (FST_DFR_DT, XCR_BSE_DT) LocalDate→String

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BcostmL.java`

- [ ] **Step 1: 필드 타입 변경(@Column name 동일)**

```java
    // Bcostm.java, BcostmL.java — 변경 전: private LocalDate fstDfrDt;  →
    @Column(name = "FST_DFR_DT")
    private String fstDfrDt;

    // 변경 전: private LocalDate xcrBseDt;  →
    @Column(name = "XCR_BSE_DT")
    private String xcrBseDt;
```

- [ ] **Step 2: 컴파일 + 사용처 정합화**

```bash
cd /c/it/it_backend
./gradlew compileJava
```

Expected: `BUILD SUCCESSFUL` (사용처에서 LocalDate 연산이 있으면 String 처리로 수정).

- [ ] **Step 3: 커밋**

```bash
cd /c/it
git add it_backend/src/main/java
git commit -m "refactor(be): change FST_DFR_DT/XCR_BSE_DT fields to String(YYYYMMDD)"
```

---

## Phase 6 — 네이티브 쿼리 정합화

### Task 7: 네이티브 SQL 물리명 치환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/repository/CostRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/repository/CouncilRepository.java`

(BtermmRepository는 `TMN_SNO`가 충돌보류, `TMN_MNG_NO`는 등록예정·유지 → 이번 변경 없음.)

- [ ] **Step 1: CostRepository — IT_MNGC_NO→BG_NO, IT_MNGC_SNO→SNO**

`CostRepository.java`의 네이티브 쿼리에서:

```java
    // 변경 전:
    // @Query(value = "SELECT NVL(MAX(IT_MNGC_SNO), 0) + 1 FROM TPRMPP_BCOSTM WHERE IT_MNGC_NO = :itMngcNo", nativeQuery = true)
    // 변경 후:
    @Query(value = "SELECT NVL(MAX(SNO), 0) + 1 FROM TPRMPP_BCOSTM WHERE BG_NO = :itMngcNo", nativeQuery = true)
    Integer getNextSnoValue(@Param("itMngcNo") String itMngcNo);
```

`:itMngcNo` 바인드 파라미터명과 메서드 시그니처는 유지(필드명 불변 전략).

- [ ] **Step 2: CouncilRepository — PRJ_MNG_NO→ABUS_MNG_NO, PRJ_SNO→SNO, PRJ_STS→STS_TC**

`CouncilRepository.java`의 네이티브 쿼리 문자열에서 물리명만 치환:
- `PRJ_MNG_NO` → `ABUS_MNG_NO`
- `PRJ_SNO` → `SNO`
- `PRJ_STS` → `STS_TC`

바인드 파라미터명(`:prjMngNo` 등)과 메서드 시그니처는 유지.

- [ ] **Step 3: 남은 네이티브 쿼리에 구(舊) 물리명 잔존 여부 확인**

```bash
cd /c/it
grep -rnE "IT_MNGC_NO|PRJ_MNG_NO|PRJ_STS\b" it_backend/src/main/java --include=*.java | grep -i "select\|where\|update\|nativeQuery"
```

Expected: rename된 구 물리명이 네이티브 쿼리 문자열에 더 이상 없음(바인드 파라미터·필드명 라인은 무관).

- [ ] **Step 4: 커밋**

```bash
cd /c/it
git add it_backend/src/main/java
git commit -m "refactor(be): update native SQL column names to standard terms"
```

---

## Phase 7 — 삭제 컬럼의 엔티티 필드 제거

### Task 8: DROP된 컬럼 필드 제거 (불필요/미사용 5 + 빈 중복 4)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/entity/Bitemm.java` (+ `BitemmL.java`) — `GCL_DTT`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/entity/Brivgm.java` (+ `BrivgmL.java`) — `IVG_TP`, `MARK_ID`, `QTD_CONE`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/entity/Cblbcm.java` (+ `CblbcmL.java`) — `KD_C`, `PRIT_C`, `END_YMD`, `STT_YMD`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java` (+ `BtermmL.java`) — `TMN_USG`

- [ ] **Step 1: 각 엔티티에서 해당 `@Column` + 필드 선언 삭제**

삭제 대상 필드(camelCase): 불필요/미사용 — `gclDtt`(GCL_DTT), `ivgTp`(IVG_TP), `kdC`(KD_C), `pritC`(PRIT_C), `tmnUsg`(TMN_USG); 빈 중복컬럼 — `markId`(MARK_ID), `qtdCone`(QTD_CONE), `endYmd`(END_YMD), `sttYmd`(STT_YMD). 각 `@Column(name="...")` 어노테이션 줄과 바로 아래 `private ... ;` 필드 줄을 마스터/로그 두 파일에서 제거(해당 엔티티에 필드가 없으면 건너뜀 — 일부 빈 컬럼은 로그 엔티티에만 존재할 수 있음).

- [ ] **Step 2: 컴파일 + 사용처 제거**

```bash
cd /c/it/it_backend
./gradlew compileJava
```

Expected: 삭제 필드를 참조하던 코드가 있으면 컴파일 오류 → 해당 참조 제거 후 `BUILD SUCCESSFUL`.

- [ ] **Step 3: 커밋**

```bash
cd /c/it
git add it_backend/src/main/java
git commit -m "refactor(be): remove dropped (unused) column fields"
```

---

## Phase 8 — 프론트엔드 타입변경 정합화

### Task 9: 타입변경 7개 컬럼의 프론트 타입 수정

**Files:**
- Modify: `it_frontend/app/types/board.ts`
- Modify: `it_frontend/app/composables/useCost.ts`
- (그 외 `cmmtMngNo`/`fsgTlm`/`lblFsgTlm`/`fstDfrDt`/`xcrBseDt` 참조 파일)

- [ ] **Step 1: 구(舊) 타입 참조 위치 전수 조사**

```bash
cd /c/it
grep -rnE "cmmtMngNo|cmmtGrpNo|hrkCmmtMngNo|fsgTlm|lblFsgTlm|fstDfrDt|xcrBseDt" it_frontend/app --include=*.ts --include=*.vue
```

Expected: 영향 파일 목록 확보. 각 위치에서 타입 가정(문자열/Date)을 아래 규칙으로 수정.

- [ ] **Step 2: board.ts 댓글 식별자 타입 number화**

`it_frontend/app/types/board.ts`에서 댓글 식별자 필드를 `string`→`number`로:

```typescript
  // 변경 전: cmmtMngNo: string  →
  cmmtMngNo: number
  // cmmtGrpNo, hrkCmmtMngNo 동일하게 number로
  cmmtGrpNo?: number
  hrkCmmtMngNo?: number
```

- [ ] **Step 3: 댓글 식별자 사용처(컴포넌트) 시그니처 수정**

`it_frontend/app/components/board/BoardCommentTree.vue` 등에서:

```typescript
// 변경 전: const onDeleteComment = async (cmmtMngNo: string) => {
const onDeleteComment = async (cmmtMngNo: number) => {
    await deleteComment(cmmtMngNo)
}
```

`deleteComment`/API 호출부가 string을 요구하면 `String(cmmtMngNo)`로 변환하거나 호출 타입도 number로 통일.

- [ ] **Step 4: 날짜→문자열 필드 타입 정리(useCost.ts 등)**

`fsgTlm`,`lblFsgTlm`,`fstDfrDt`,`xcrBseDt`는 API가 `'YYYYMMDD'` 문자열을 반환하므로 타입을 `string`으로 고정하고, 날짜 포맷팅 사용처는 `YYYYMMDD` 파싱 헬퍼로 표시:

```typescript
  // 변경 전: fstDfrDt: string | Date  →
  fstDfrDt?: string  // 'YYYYMMDD'
  xcrBseDt?: string  // 'YYYYMMDD'
```

- [ ] **Step 5: 타입체크 + 린트**

```bash
cd /c/it/it_frontend
npm run typecheck
npm run lint
```

Expected: 둘 다 0 error. (남은 타입 불일치는 Step 1 목록을 따라 수정.)

- [ ] **Step 6: 커밋**

```bash
cd /c/it
git add it_frontend/app
git commit -m "refactor(fe): align types for retyped standard columns"
```

---

## Phase 9 — 통합 검증

### Task 10: 백엔드 테스트 + 기동 스모크

**Files:** (검증)

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd /c/it/it_backend
./gradlew clean test
```

Expected: `BUILD SUCCESSFUL`. 실패 시 보고서 매핑과 엔티티/쿼리 불일치 추적(특히 충돌보류 컬럼을 잘못 건드렸는지).

- [ ] **Step 2: 백엔드 기동 + 핵심 API 스모크**

```bash
cd /c/it/it_backend
./gradlew bootRun
```

별 터미널에서:

```bash
curl -s -i http://localhost:8080/swagger-ui/index.html | head -1
```

Expected: `HTTP/1.1 200`. 예산/프로젝트/비용 조회 API 한 건씩 호출해 500 없이 응답(컬럼 매핑 정상) 확인 후 기동 종료.

- [ ] **Step 3: 프론트 빌드 + 단위테스트**

```bash
cd /c/it/it_frontend
npm run typecheck && npm run lint && npm test
```

Expected: 모두 통과.

- [ ] **Step 4: 최종 커밋 & 정리**

```bash
cd /c/it
rm -f it_database/migrations/_verify.sql it_database/migrations/_pretype_check.sql it_database/migrations/_postdata_check.sql it_database/migrations/_lenreduce_check.sql
git add -A
git commit -m "test: verify standard-column migration across DB/BE/FE"
```

---

## 부록 A — 보류(별도 마이그레이션 필요): 진짜 충돌 3쌍

핵심 컨텍스트 §3(a)의 3쌍(BITEM `GCL_SNO`/`PRJ_SNO`, BTERM `IT_MNGC_SNO`/`TMN_SNO`, CBLBC `HRK_NAC_MNG_NO`/`NAC_GRP_NO`)은 양쪽 모두 데이터를 보유하므로 자동 해소 불가. 사용자 쌍별 지정(어느 컬럼이 표준명, 다른 하나는 별도명/병합/삭제)이 확정되면 `_generate_rename.py`의 입력 보고서를 갱신·재실행하여 `V20260603_001__...`로 처리한다. 본 계획의 SQL/엔티티/쿼리 작업은 이들을 자동 제외하므로 데이터 손상 위험은 없다.

(나머지 4쌍은 한쪽이 전부 NULL인 빈 중복 컬럼이어서 보고서 §6 `삭제후보`로 재분류 → 빈 컬럼 drop + 파트너 정상 rename으로 **이번 마이그레이션에 반영됨**.)

## 부록 E — 격리 스키마 검증 하네스(구현·검증 완료)

마이그레이션을 운영/개발 데이터를 건드리지 않고 별도 스키마 `ITPAPP_TEST`에서 검증하는 하네스가 `it_database/migrations/test/`에 구축되어 있다. **현재 12개 시나리오 전부 PASS 확인됨.**

```bash
# 루트(C:\it)에서 — 생성→복제→시드→적용→검증 일괄
bash it_database/migrations/test/run_test.sh
# 기대: PASS=12  FAIL=0  / RESULT: ALL PASS
```

구성: `01_setup.sql`(ITPAPP: ITPAPP_TEST 생성 + 전 `TPRMPP_*` 구조복제), `02_seed.sql`(엣지케이스 시드), `03_assert.sql`(12 검증), `99_teardown.sql`(스키마 삭제), `README.md`. 검증 항목: 단순 rename, VARCHAR2 길이정규화, 패딩 자동 trim, 길이축소 오버플로우 보류, DATE→VARCHAR2(8) 값변환, VARCHAR2→NUMBER 값변환, 진짜충돌 보류, 빈중복 해소, drop.

> 이 하네스로 생성기(`_generate_rename.py`)와 SQL 패턴의 정확성이 사전 검증된다. 실제 Phase 3 적용 전, 동일 하네스로 회귀 검증할 것.

## 부록 D — 운영 DB 빈 컬럼 재확인 쿼리(§3(b) 적용 전 필수)

§3(b)의 drop 재분류는 개발 DB 기준이다. 운영 적용 전 아래로 운영 DB에서도 해당 컬럼이 전부 NULL인지 확인한다(모두 0이어야 함). 0이 아니면 해당 쌍을 부록 A(보류)로 되돌린다.

```sql
SET PAGESIZE 0
SET FEEDBACK OFF
SELECT 'BRIVGM.MARK_ID='||COUNT(MARK_ID) FROM TPRMPP_BRIVGM;
SELECT 'BRIVGL.MARK_ID='||COUNT(MARK_ID) FROM TPRMPP_BRIVGL;
SELECT 'BRIVGM.QTD_CONE='||COUNT(QTD_CONE) FROM TPRMPP_BRIVGM;
SELECT 'BRIVGL.QTD_CONE='||COUNT(QTD_CONE) FROM TPRMPP_BRIVGL;
SELECT 'CBLBCL.END_YMD='||COUNT(END_YMD) FROM TPRMPP_CBLBCL;
SELECT 'CBLBCL.STT_YMD='||COUNT(STT_YMD) FROM TPRMPP_CBLBCL;
EXIT
```

## 부록 C — 길이축소 보류(코드/값 매핑 필요)

아래는 표준 타깃 길이가 매우 짧아(코드화 의도) TRIM 패딩 제거 후에도 실데이터가 초과하는 컬럼이다. V001이 rename은 하되 **길이축소(MODIFY)는 자동 보류**하고 SKIP 메시지를 남긴다. 실제 길이축소는 "현행 값 → 표준 코드값" 매핑 규칙이 정해진 뒤 별도 데이터 마이그레이션으로 처리한다.

| 컬럼 → 타깃(길이) | 테이블 | trim 후 초과행(개발 DB) |
|---|---|---|
| `PUL_DTT` → ABUS_TC (2) | BCOSTM/L, BPROJM/L | 23행 (길이 3) |
| `PRJ_STS` → STS_TC (2) | BPROJM/L | 23행 (길이 9) |

> 그 외 길이축소 컬럼(`ABUS_C`100→3, `IT_MNGC_NO`32→15, `BZ_MNG_NO`255→20, `MN_USR`32→3 등)은 패딩 trim만으로 표준 길이에 맞으므로 V001에서 자동 정규화된다.

## 부록 B — meta.csv 신규 표준어 등록(데이터 거버넌스, DB와 독립)

DB rename과 무관하게, 표준어 사전에 다음을 등록해야 사전상 정합이 완성된다(미등록이어도 DB/코드 동작에는 영향 없음):
- 타깃 신규등록 3건: `DVM_CGPR_ID`(개발담당자ID), `DVM_TLR_USID`(개발담당자사용자ID), `SVN_DPM_TLR_USID`(주관부서담당자사용자ID)
- 등록예정 8건(현재명 유지): `CPIT_BG_RMK`,`GCL_MNG_NO`,`ITR_INFR_YN`,`IT_BG_CONE`,`IT_PRJ_RMK`,`MNGC_BG_RMK`,`ORN_YN`,`TMN_MNG_NO`

`meta.csv`에 `No.,표준용어논리명,표준용어물리명,데이터타입,데이터길이,...` 형식으로 행 추가 후, 본 보고서 분석 스크립트를 재실행하면 해당 컬럼들이 "표준 준수(등록)"으로 승격된다.

---

## 데이터 마이그레이션 요약 (스키마 변경과 별개)

| 변경 종류 | 데이터 처리 | 위치 |
|---|---|---|
| 단순 rename (227) | `RENAME COLUMN` — 데이터 자동 보존 | V001 |
| VARCHAR2 길이 정규화(축소 포함) | **초과 행만 `TRIM`(패딩 제거) 후 `MODIFY` 표준 길이.** TRIM 후에도 초과하는 실데이터가 있으면 MODIFY 자동 보류(SKIP, 손실 방지) | V001, Task3 Step1b |
| 타입변경 rename (10): VARCHAR2→NUMBER, DATE→VARCHAR2(8) | **타깃컬럼 ADD → `TO_NUMBER`/`TO_CHAR(,'YYYYMMDD')` 값 변환 UPDATE → 구컬럼 DROP** (데이터 보존). 단순 MODIFY는 데이터 있으면 ORA-01439 실패 → 사용 안 함 | V002, Task3 Step2b/6b |
| 타입만 변환 (8): DATE→VARCHAR2(8) | 임시컬럼 + `TO_CHAR(,'YYYYMMDD')` + drop/rename | V003 |
| drop (9) | 데이터 의도적 제거 | V004 |
| 빈 중복컬럼 drop (4쌍, 6 table-col) | 한쪽 전부 NULL → 빈 컬럼 drop + 파트너 rename(자동 해소). 운영 전 부록 D 재확인 | V001/V004, 부록 D |
| 진짜 충돌 3쌍 | **양쪽 데이터 보유 → 보류**(사용자 쌍별 지정 시 별도 데이터 마이그레이션) | 부록 A |

검증: 변환 전 사전검증(Step 2b: 비숫자 값 0, 변환대상 행수 기록), 변환 후 보존검증(Step 6b: notnull 행수 일치 + 'YYYYMMDD' 형식 검증).

## Self-Review 결과

- **Spec coverage:** §3 rename(233 table-col)→Phase 4, 타입변경 rename 5→Phase 5 Task5, §4 retype 2→Task6, §6 drop(불필요 5 + 빈중복 4 = 15 table-col)→Phase 7, 네이티브쿼리→Phase 6, 프론트 타입변경→Phase 8, 진짜 충돌 3쌍→부록 A(보류), 빈중복 4쌍→drop 반영(부록 D 운영 재확인), 신규등록→부록 B. 전 항목 커버.
- **데이터 마이그레이션:** rename은 무손실, 타입변경 10건은 값 변환(ADD→UPDATE→DROP)으로 데이터 보존, VARCHAR2 길이 정규화는 패딩 자동 trim 후 표준 길이 적용(실데이터 초과 시 자동 보류·플래그, 부록 C), 사전/사후 데이터 검증 단계 포함. 위 "데이터 마이그레이션 요약" 표 참조.
- **Placeholder scan:** SQL/엔티티/쿼리 모두 실제 코드·실명 컬럼·실파일 경로 사용. "TODO" 없음(생성기 `RETYPE_CONV` 누락 시 `assert`로 즉시 실패하도록 방어).
- **Type consistency:** 코드모드 함수·SQL 가드·엔티티 경로가 §5 매핑과 일치. 충돌 격리 기준이 생성기/코드모드 양쪽에서 동일((table,newcol) 다중 → 제외).
