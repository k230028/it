# 컬럼명 정합 리팩토링 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 거버넌스 준수를 위해 전 도메인(42개 엔티티 + `*L` 미러)의 영속 필드명을 `lowerCamelCase(물리 컬럼명)`으로 정합하되, 재현·감사 가능한 도구와 도메인별 검증 게이트로 안전하게 롤아웃한다.

**Architecture:** 먼저 4개의 파이썬 도구(필드맵 파서·충돌 분석기·타깃맵 빌더·런타임 참조 스캐너)와 검증 하네스를 구축하고 stdlib `unittest`로 테스트한다. 그 후 충돌 매핑표를 생성·승인(거버넌스 산출물)하고, 도메인별로 [코드모드 적용 → 컴파일 → 런타임 스캔 → 테스트 → 실기동 → 프론트 락스텝 → 원자적 커밋] 게이트를 반복한다. `project` 도메인은 파일럿으로 이미 완료(기준 템플릿).

**Tech Stack:** Java 25 / Spring Boot 4 / Spring Data JPA + QueryDSL 5.1 (Gradle), Nuxt 4 / TypeScript, 도구는 Python 3.11 + stdlib `unittest`.

**Spec:** `docs/superpowers/specs/2026-06-03-column-name-alignment-refactor-design.md`

---

## File Structure

신규 도구 디렉토리 (리포 루트):
```
tools/colname-align/
  fieldmap.py              # .java에서 (@Column 물리명, 필드명) 쌍 파싱 + camelCase 변환
  collision.py             # 전 엔티티 스캔 → 재사용 컬럼 검출 → 소유자/접두사 제안
  targetmap.py             # 엔티티별 {현재필드: 목표필드} 생성 (camel + 충돌 오버라이드)
  scan_runtime_refs.py     # 컴파일 비가시 참조(파생쿼리/JPQL/Sort/프론트 키) 스캔
  verify_domain.sh         # 도메인 게이트 일괄 실행 (compile→scan→test→boot→typecheck)
  domain-prefix.json       # 도메인→접두사 설정 (거버넌스 입력)
  overrides.json           # 충돌 컬럼 목표명 오버라이드 (승인본에서 도출)
  test_fieldmap.py         # unittest
  test_collision.py        # unittest
  test_targetmap.py        # unittest
  test_scan_runtime_refs.py# unittest
  README.md                # 도메인별 런북(운영 절차)
```

거버넌스 산출물:
```
it_backend/docs/guides/colname-collision-map.md   # 재사용 컬럼 → 소유자/접두사 (승인본)
```

각 파일은 단일 책임을 가진다: 파싱(fieldmap), 충돌탐지(collision), 목표명 결정(targetmap),
잔존참조 탐지(scan), 게이트 실행(verify). 도구는 순수 함수 + CLI 래퍼로 작성해 테스트 가능하게 한다.

---

## Task 1: 필드맵 파서 (`fieldmap.py`)

**Files:**
- Create: `tools/colname-align/fieldmap.py`
- Test: `tools/colname-align/test_fieldmap.py`

파일럿에서 정규식이 주석 안 괄호(`(물리컬럼 …)`)에 걸려 일부 필드를 놓친 버그가 있었다.
견고한 파서: `@Column(name="X"` 매칭 후 **다음 `private <타입> <필드>;`** 를 찾는다.

- [ ] **Step 1: 실패 테스트 작성**

```python
# tools/colname-align/test_fieldmap.py
import unittest
from fieldmap import parse_pairs, camel

class TestFieldmap(unittest.TestCase):
    def test_camel_basic(self):
        self.assertEqual(camel("ABUS_MNG_NO"), "abusMngNo")
        self.assertEqual(camel("SVN_DPM_C"), "svnDpmC")
        self.assertEqual(camel("PRLM_HRK_OGZ_C_CONE"), "prlmHrkOgzCCone")

    def test_parse_skips_parens_in_comment(self):
        src = '''
            @Column(name = "TOT_XP_AMT", precision = 18, scale = 3, comment = "일반관리비 (물리컬럼 TOT_XP_AMT=총비용금액)")
            private BigDecimal mngc;
            @Column(name = "BSE_YY", length = 4, comment = "기준연도")
            private String bgYy;
        '''
        pairs = parse_pairs(src)
        self.assertEqual(pairs, [("TOT_XP_AMT", "mngc"), ("BSE_YY", "bgYy")])

    def test_deviations_only(self):
        src = '''
            @Column(name = "PRJ_NM", length = 100, comment = "프로젝트명")
            private String prjNm;
            @Column(name = "ABUS_MNG_NO", length = 30)
            private String prjMngNo;
        '''
        devs = [(c, f, camel(c)) for c, f in parse_pairs(src) if f != camel(c)]
        self.assertEqual(devs, [("ABUS_MNG_NO", "prjMngNo", "abusMngNo")])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd tools/colname-align && python -m unittest test_fieldmap -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'fieldmap'`

- [ ] **Step 3: 최소 구현**

```python
# tools/colname-align/fieldmap.py
"""엔티티 .java 소스에서 (@Column 물리명, Java 필드명) 쌍을 파싱한다."""
import re
import sys

_COL = re.compile(r'@Column\(\s*name\s*=\s*"([A-Z0-9_]+)"')
_FLD = re.compile(r'private\s+[\w<>\.\[\],\s]+?\s(\w+)\s*;')


def camel(col: str) -> str:
    """물리 컬럼명 → lowerCamelCase. 예: ABUS_MNG_NO → abusMngNo"""
    parts = col.lower().split('_')
    return parts[0] + ''.join(p.capitalize() for p in parts[1:])


def parse_pairs(src: str):
    """소스 문자열에서 [(컬럼명, 필드명), ...] 반환.
    @Column(name="X" 매칭 후 그 뒤 400자 내 첫 'private <타입> <필드>;'를 필드로 본다.
    주석 안 괄호에 영향받지 않는다."""
    out = []
    for m in _COL.finditer(src):
        tail = src[m.end():m.end() + 400]
        fm = _FLD.search(tail)
        if fm:
            out.append((m.group(1), fm.group(1)))
    return out


def deviations(src: str):
    """[(컬럼, 현재필드, 목표필드), ...] — 현재≠목표 인 것만."""
    return [(c, f, camel(c)) for c, f in parse_pairs(src) if f != camel(c)]


if __name__ == "__main__":
    for path in sys.argv[1:]:
        with open(path, encoding="utf-8") as fh:
            s = fh.read()
        for c, f, t in deviations(s):
            print(f"{path}\t{f} -> {t}\t(col {c})")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd tools/colname-align && python -m unittest test_fieldmap -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/colname-align/fieldmap.py tools/colname-align/test_fieldmap.py
git commit -m "feat(tools): 컬럼-필드 파서 (주석 괄호 견고) + camelCase 변환"
```

---

## Task 2: 충돌 분석기 (`collision.py`)

**Files:**
- Create: `tools/colname-align/collision.py`
- Test: `tools/colname-align/test_collision.py`

2개 이상 엔티티에 등장하는 컬럼을 검출한다. 소유자/접두사 결정은 사람이 하므로,
도구는 "재사용 컬럼 → 보유 엔티티 목록"까지만 산출한다.

- [ ] **Step 1: 실패 테스트 작성**

```python
# tools/colname-align/test_collision.py
import unittest
from collision import reused_columns

class TestCollision(unittest.TestCase):
    def test_detects_reused(self):
        per_entity = {
            "Bbugtm": [("BG_NO", "bgMngNo"), ("BSE_YY", "bgYy")],
            "Bcostm": [("BG_NO", "itMngcNo"), ("TOT_XP_AMT", "itMngcBgAmt")],
            "Bplanm": [("TOT_XP_AMT", "mngc"), ("BSE_YY", "plnYy")],
        }
        result = reused_columns(per_entity)
        self.assertEqual(result["BG_NO"], ["Bbugtm", "Bcostm"])
        self.assertEqual(result["TOT_XP_AMT"], ["Bcostm", "Bplanm"])
        self.assertEqual(result["BSE_YY"], ["Bbugtm", "Bplanm"])

    def test_unique_excluded(self):
        per_entity = {"A": [("X_C", "x")], "B": [("Y_C", "y")]}
        self.assertEqual(reused_columns(per_entity), {})

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd tools/colname-align && python -m unittest test_collision -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'collision'`

- [ ] **Step 3: 최소 구현**

```python
# tools/colname-align/collision.py
"""전 엔티티에서 재사용(2개 이상 엔티티 등장) 컬럼을 검출한다."""
import sys
import glob
import os
from fieldmap import parse_pairs


def reused_columns(per_entity: dict) -> dict:
    """입력 {엔티티명: [(컬럼,필드),...]} → {컬럼: [보유엔티티 정렬]} (2개 이상만)."""
    owners: dict = {}
    for entity, pairs in per_entity.items():
        for col, _field in pairs:
            owners.setdefault(col, set()).add(entity)
    return {c: sorted(es) for c, es in owners.items() if len(es) >= 2}


def scan_dir(root: str) -> dict:
    """엔티티 디렉토리 트리에서 {엔티티명: [(컬럼,필드)]} 구성. @Entity 파일만."""
    per_entity = {}
    for path in glob.glob(os.path.join(root, "**", "*.java"), recursive=True):
        with open(path, encoding="utf-8", errors="replace") as fh:
            s = fh.read()
        if "@Entity" not in s and "@MappedSuperclass" not in s:
            continue
        name = os.path.basename(path)[:-5]
        per_entity[name] = parse_pairs(s)
    return per_entity


if __name__ == "__main__":
    root = sys.argv[1] if len(sys.argv) > 1 else "../../it_backend/src/main/java"
    reused = reused_columns(scan_dir(root))
    for col in sorted(reused):
        print(f"{col}\t{', '.join(reused[col])}")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd tools/colname-align && python -m unittest test_collision -v`
Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/colname-align/collision.py tools/colname-align/test_collision.py
git commit -m "feat(tools): 재사용 컬럼 충돌 분석기"
```

---

## Task 3: 타깃맵 빌더 (`targetmap.py`)

**Files:**
- Create: `tools/colname-align/targetmap.py`
- Test: `tools/colname-align/test_targetmap.py`

엔티티별 `{현재필드: 목표필드}`를 만든다. 기본은 `camel(col)`, 단 승인된 충돌 오버라이드
(`{엔티티: {컬럼: 목표명}}`)가 있으면 그것을 우선한다.

- [ ] **Step 1: 실패 테스트 작성**

```python
# tools/colname-align/test_targetmap.py
import unittest
from targetmap import build_target_map

class TestTargetMap(unittest.TestCase):
    def test_default_camel(self):
        pairs = [("ABUS_MNG_NO", "prjMngNo"), ("PRJ_NM", "prjNm")]
        self.assertEqual(build_target_map("Bprojm", pairs, {}),
                         {"prjMngNo": "abusMngNo"})

    def test_collision_override(self):
        pairs = [("BG_NO", "itMngcNo"), ("TOT_XP_AMT", "itMngcBgAmt")]
        override = {"Bcostm": {"BG_NO": "costBgNo", "TOT_XP_AMT": "costTotXpAmt"}}
        self.assertEqual(
            build_target_map("Bcostm", pairs, override),
            {"itMngcNo": "costBgNo", "itMngcBgAmt": "costTotXpAmt"},
        )

    def test_override_equal_target_still_renamed(self):
        pairs = [("BG_NO", "bgMngNo")]
        override = {"Bbugtm": {"BG_NO": "bgNo"}}
        self.assertEqual(build_target_map("Bbugtm", pairs, override),
                         {"bgMngNo": "bgNo"})

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd tools/colname-align && python -m unittest test_targetmap -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'targetmap'`

- [ ] **Step 3: 최소 구현**

```python
# tools/colname-align/targetmap.py
"""엔티티별 {현재필드: 목표필드} 생성. camel(col) 기본, 충돌 오버라이드 우선."""
import sys
import json
from fieldmap import parse_pairs, camel


def build_target_map(entity: str, pairs, overrides: dict) -> dict:
    """overrides = {엔티티: {컬럼: 목표명}}. 현재필드 != 목표필드 인 항목만 반환."""
    ov = overrides.get(entity, {})
    result = {}
    for col, current in pairs:
        target = ov.get(col, camel(col))
        if current != target:
            result[current] = target
    return result


if __name__ == "__main__":
    # 사용: python targetmap.py <엔티티.java> <overrides.json>
    java_path, ov_path = sys.argv[1], sys.argv[2]
    with open(java_path, encoding="utf-8") as fh:
        pairs = parse_pairs(fh.read())
    with open(ov_path, encoding="utf-8") as fh:
        overrides = json.load(fh)
    entity = java_path.split("/")[-1][:-5]
    for cur, tgt in build_target_map(entity, pairs, overrides).items():
        print(f"{cur} -> {tgt}")
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd tools/colname-align && python -m unittest test_targetmap -v`
Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/colname-align/targetmap.py tools/colname-align/test_targetmap.py
git commit -m "feat(tools): 타깃 필드명 맵 빌더 (충돌 오버라이드 지원)"
```

---

## Task 4: 런타임 참조 스캐너 (`scan_runtime_refs.py`)

**Files:**
- Create: `tools/colname-align/scan_runtime_refs.py`
- Test: `tools/colname-align/test_scan_runtime_refs.py`

컴파일러가 못 잡는 참조를 검출하는 **가장 중요한 도구**. 옛 필드명 토큰 목록을 받아,
파생 쿼리 메서드명(`findAllBy` 포함)·JPQL 속성 경로·Sort 문자열을 찾는다.

- [ ] **Step 1: 실패 테스트 작성**

```python
# tools/colname-align/test_scan_runtime_refs.py
import unittest
from scan_runtime_refs import find_refs

class TestScan(unittest.TestCase):
    def test_derived_query_incl_findallby(self):
        src = (
            'Optional<Bprojm> findByPrjMngNoAndDelYn(String a, String b);\n'
            'List<Bprojm> findAllByPrjMngNoInAndDelYn(Collection<String> c, String d);\n'
            'boolean existsByPrjMngNoAndDelYn(String a, String b);\n'
        )
        hits = find_refs(src, ["prjMngNo"])
        kinds = sorted({h[0] for h in hits})
        self.assertIn("derived-query", kinds)
        self.assertEqual(len(hits), 3)  # 세 메서드 모두

    def test_jpql_property_path(self):
        src = '@Query("SELECT p FROM Bprojm p WHERE p.prjMngNo = :id")\n'
        hits = find_refs(src, ["prjMngNo"])
        self.assertEqual([h[0] for h in hits], ["jpql-path"])

    def test_native_query_excluded(self):
        src = '@Query(value = "UPDATE T SET X=1 WHERE C=:prjMngNo", nativeQuery = true)\n'
        self.assertEqual(find_refs(src, ["prjMngNo"]), [])

    def test_sort_string(self):
        src = 'Sort.by("prjMngNo").descending();\n'
        hits = find_refs(src, ["prjMngNo"])
        self.assertEqual([h[0] for h in hits], ["sort-string"])

if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd tools/colname-align && python -m unittest test_scan_runtime_refs -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'scan_runtime_refs'`

- [ ] **Step 3: 최소 구현**

```python
# tools/colname-align/scan_runtime_refs.py
"""옛 필드명 토큰에 대한 컴파일 비가시 참조를 검출한다.
파생 쿼리 메서드명(findAllBy 포함), JPQL 속성 경로, Sort 문자열."""
import re
import sys
import glob


def _cap(token: str) -> str:
    return token[0].upper() + token[1:]


def find_refs(src: str, tokens):
    """[(종류, 라인번호, 라인), ...]. native 쿼리 라인은 제외."""
    hits = []
    derived = re.compile(
        r'\b(?:findAll|find|readAll|read|getAll|get|queryAll|query|stream|count|exists|delete|removeAll|remove)By[A-Za-z]*('
        + '|'.join(_cap(t) for t in tokens) + r')[A-Za-z]*\b'
    )
    for i, line in enumerate(src.splitlines(), 1):
        if 'nativeQuery = true' in line or 'nativeQuery=true' in line:
            continue
        if derived.search(line):
            hits.append(("derived-query", i, line.strip()))
            continue
        for t in tokens:
            if re.search(r'@Query|SELECT |FROM |WHERE |JOIN ', line) and re.search(r'\b[a-z]\.' + re.escape(t) + r'\b', line):
                hits.append(("jpql-path", i, line.strip())); break
            if re.search(r'(Sort\.by|Sort\.Order|orderBy)\s*\(\s*"' + re.escape(t) + r'"', line):
                hits.append(("sort-string", i, line.strip())); break
    return hits


def scan_paths(globs, tokens):
    out = []
    for g in globs:
        for path in glob.glob(g, recursive=True):
            with open(path, encoding="utf-8", errors="replace") as fh:
                for kind, ln, text in find_refs(fh.read(), tokens):
                    out.append((path, kind, ln, text))
    return out


if __name__ == "__main__":
    # 사용: python scan_runtime_refs.py <tokens,쉼표> -- <glob...>
    sep = sys.argv.index("--")
    tokens = sys.argv[1].split(",")
    globs = sys.argv[sep + 1:]
    rows = scan_paths(globs, tokens)
    for path, kind, ln, text in rows:
        print(f"{path}:{ln}\t[{kind}]\t{text}")
    print(f"\n총 {len(rows)}건")
    sys.exit(1 if rows else 0)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd tools/colname-align && python -m unittest test_scan_runtime_refs -v`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add tools/colname-align/scan_runtime_refs.py tools/colname-align/test_scan_runtime_refs.py
git commit -m "feat(tools): 런타임 참조 스캐너 (파생쿼리/JPQL/Sort, native 제외)"
```

---

## Task 5: 검증 하네스 (`verify_domain.sh`)

**Files:**
- Create: `tools/colname-align/verify_domain.sh`

도메인 게이트를 한 번에 실행한다. 옛 토큰 목록을 인자로 받아 스캐너까지 수행.

- [ ] **Step 1: 스크립트 작성**

```bash
# tools/colname-align/verify_domain.sh
#!/usr/bin/env bash
# 사용: verify_domain.sh "prjMngNo,prjSno,..." (도메인 옛 토큰 쉼표구분)
set -uo pipefail
TOKENS="${1:?옛 토큰 목록(쉼표구분) 필요}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/it_backend"

echo "== 1) compileJava =="
./gradlew compileJava -q || { echo "FAIL: compileJava"; exit 1; }

echo "== 2) compileTestJava =="
./gradlew compileTestJava -q || { echo "FAIL: compileTestJava"; exit 1; }

echo "== 3) 런타임 참조 스캔 (잔존 0 이어야 함) =="
python "$ROOT/tools/colname-align/scan_runtime_refs.py" "$TOKENS" -- \
  "src/main/java/**/*.java" "src/test/java/**/*.java" \
  && echo "스캔: 잔존 없음" || { echo "FAIL: 런타임 참조 잔존"; exit 1; }

echo "== 4) bootRun 실기동 검증 (최대 150초) =="
timeout 150 ./gradlew bootRun > /tmp/cna_boot.log 2>&1 &
for i in $(seq 1 30); do
  sleep 5
  grep -qE "Started ItApplication" /tmp/cna_boot.log && { echo "BOOT_OK"; break; }
  grep -qE "APPLICATION FAILED TO START|PropertyReferenceException|No property" /tmp/cna_boot.log && { echo "FAIL: 부팅 오류"; break; }
done
pkill -f "bootRun" 2>/dev/null; pkill -f "ItApplication" 2>/dev/null
grep -qE "Started ItApplication" /tmp/cna_boot.log || { echo "FAIL: 부팅 미확인"; exit 1; }

echo "== 5) 프론트 typecheck =="
cd "$ROOT/it_frontend" && npm run typecheck 2>&1 | grep -vE "server/(sso-auth-redirect|color-scheme)" | grep -E "error TS" \
  && { echo "FAIL: 프론트 신규 타입에러"; exit 1; } || echo "typecheck: 신규 에러 없음"

echo "== ALL GREEN =="
```

- [ ] **Step 2: 실행 권한 + 동작 확인 (현 상태 = project까지 완료라 GREEN 기대)**

Run: `chmod +x tools/colname-align/verify_domain.sh && tools/colname-align/verify_domain.sh "prjMngNo"`
Expected: `== ALL GREEN ==` (이미 정합된 project 토큰이므로 잔존 0, 부팅 OK)

- [ ] **Step 3: 커밋**

```bash
git add tools/colname-align/verify_domain.sh
git commit -m "feat(tools): 도메인 검증 하네스 (compile/scan/boot/typecheck)"
```

---

## Task 6: 충돌 매핑표 생성 + 승인 (거버넌스 산출물)

**Files:**
- Create: `tools/colname-align/domain-prefix.json`
- Create: `tools/colname-align/overrides.json`
- Create: `it_backend/docs/guides/colname-collision-map.md`

- [ ] **Step 1: 도메인→접두사 설정 작성**

```json
// tools/colname-align/domain-prefix.json
{
  "Bcostm": "cost", "Btermm": "term", "Bplanm": "pln",
  "Bgdocm": "gdoc", "Brdocm": "rdoc", "Brivgm": "rivg",
  "Bitemm": "item", "Bbugtm": "bug"
}
```

- [ ] **Step 2: 재사용 컬럼 목록 산출**

Run: `cd tools/colname-align && python collision.py ../../it_backend/src/main/java > /tmp/reused.txt && cat /tmp/reused.txt`
Expected: `BG_NO`, `TOT_XP_AMT`, `SVN_DPM_C`, `BSE_YY`, `ABUS_TC` 등 재사용 컬럼과 보유 엔티티 목록 출력

- [ ] **Step 3: 충돌 매핑표 작성 (사람이 주 소유자 판정)**

각 재사용 컬럼에 대해 의미상 주 소유 도메인을 정하고 표로 기록한다. 예시(실제는 Step 2 결과로 채움):

```markdown
<!-- it_backend/docs/guides/colname-collision-map.md -->
# 컬럼명 충돌 매핑표 (거버넌스 승인본)

재사용 컬럼은 주 소유 도메인이 원형(camel)을, 나머지는 도메인 접두사를 사용한다.

| 물리 컬럼 | 주 소유(원형) | 비소유 도메인 → 목표명 |
|---|---|---|
| BG_NO | Bbugtm → `bgNo` | Bcostm → `costBgNo`, Btermm → `termBgNo` |
| TOT_XP_AMT | Bplanm → `totXpAmt` | Bcostm → `costTotXpAmt` |
| SVN_DPM_C | Bprojm → `svnDpmC` | Bcostm → `costSvnDpmC` |
| BSE_YY | Bbugtm → `bseYy` | Bcostm → `costBseYy`, Bplanm → `plnBseYy` |
| ABUS_TC | Bprojm → `abusTc` | Bcostm → `costAbusTc` |
```

위 표를 토대로 코드모드 오버라이드 JSON을 작성한다:

```json
// tools/colname-align/overrides.json  (Step 3 표에서 도출)
{
  "Bcostm": {"BG_NO": "costBgNo", "TOT_XP_AMT": "costTotXpAmt", "SVN_DPM_C": "costSvnDpmC", "BSE_YY": "costBseYy", "ABUS_TC": "costAbusTc"},
  "Btermm": {"BG_NO": "termBgNo"},
  "Bplanm": {"BSE_YY": "plnBseYy"}
}
```

- [ ] **Step 4: 사용자 승인 (거버넌스 게이트)**

충돌 매핑표를 사용자에게 제시하고 주 소유자 판정을 승인받는다. 승인 전 코드 착수 금지.

- [ ] **Step 5: 커밋**

```bash
git add tools/colname-align/domain-prefix.json tools/colname-align/overrides.json it_backend/docs/guides/colname-collision-map.md
git commit -m "docs(governance): 컬럼명 충돌 매핑표 + 코드모드 오버라이드 (승인본)"
```

---

## Task 7: 도메인별 런북 (`README.md`)

**Files:**
- Create: `tools/colname-align/README.md`

한 도메인을 정합하는 절차를 고정한다(이후 모든 도메인에 동일 적용).

- [ ] **Step 1: 런북 작성**

```markdown
<!-- tools/colname-align/README.md -->
# 컬럼명 정합 — 도메인별 런북

대상 도메인의 엔티티 그룹(마스터 + `*L` 미러 + `@IdClass`)에 다음을 순서대로 수행한다.

## 1) 타깃맵 산출
    python targetmap.py <엔티티.java> overrides.json
각 엔티티의 `현재필드 -> 목표필드`를 확보한다. 옛 토큰 목록(현재필드들)을 메모한다.

## 2) 코드모드 적용 (컴파일 주도)
- 엔티티/`*L`/`@IdClass`/DTO 필드 **선언**을 목표명으로 리네임.
  (`*Nm` 파생 표시필드는 예외 — 도메인명 유지, 이중접미사만 단일 Nm으로 정리)
- `./gradlew compileJava` → 컴파일 에러가 가리키는 게터(`getOld`)·빌더(`.old(`)·
  QueryDSL(`Q*.old`) 참조를 목표명으로 수정. green 될 때까지 반복.
- **주의:** native `@Query`는 컬럼명이라 변경 금지. 다른 엔티티의 동명 필드는 건드리지 않음.

## 3) 런타임 스캔
    python scan_runtime_refs.py "<옛토큰,쉼표>" -- "../../it_backend/src/main/java/**/*.java" "../../it_backend/src/test/java/**/*.java"
잔존 0이어야 함. 잡힌 파생쿼리/JPQL/Sort는 목표명으로 수정.
(파생쿼리 메서드명 변경 시 호출부·테스트 목도 함께 정합)

## 4) 테스트 정합
    ./gradlew compileTestJava
목 메서드명·게터를 목표명으로 정합. green 확인.

## 5) 게이트 일괄 검증
    tools/colname-align/verify_domain.sh "<옛토큰,쉼표>"
`== ALL GREEN ==` 확인(compile/scan/boot/typecheck).

## 6) 프론트 락스텝
해당 도메인 API 소비 타입(읽기/쓰기 payload/표시 `*Nm`) 정합 → `npm run typecheck`.
타 도메인 동명 필드는 건드리지 않음.

## 7) 원자적 커밋
    git commit -m "refactor(<domain>): 변수명 컬럼명 정합 (<old->new 요약>)"
백엔드+프론트 한 커밋. 메시지에 변경 필드 맵 기록.
```

- [ ] **Step 2: 커밋**

```bash
git add tools/colname-align/README.md
git commit -m "docs(tools): 도메인별 정합 런북"
```

---

## Task 8: 워크드 예제 — `cost` 도메인 정합

**Files:**
- Modify: `it_backend/.../budget/cost/entity/Bcostm.java`, `BcostmId.java`, `Btermm.java`, `BtermmId.java`
- Modify: `it_backend/.../domain/log/entity/BcostmL.java`, `BtermmL.java`
- Modify: `it_backend/.../budget/cost/dto/*.java`, `.../cost/service/*.java`, `.../cost/repository/*.java`
- Modify: 교차 참조 리포지토리(QueryDSL) + 관련 테스트
- Modify: `it_frontend` cost 도메인 소비처

런북(Task 7)을 `cost` 도메인에 적용한다. Bcostm 타깃맵(충돌 오버라이드 반영):
`itMngcNo→costBgNo`, `itMngcSno→costBgSno`, `itMngcBgAmt→costTotXpAmt`, `infPrtYn→sectSysUtzYn`,
`cgprEno→cgprId`, `biceDpmC→costSvnDpmC`, `biceTemC→svnTemC`, `bgYy→costBseYy`,
`abusC→bgUntAbusC`, `itMngcTp→bgXpTc`, `pulDtt→costAbusTc`, `cncdItMngcNo→cncdRfrNo`
(Btermm 타깃맵은 `python targetmap.py Btermm.java overrides.json`로 산출)

- [ ] **Step 1: 타깃맵 산출 + 옛 토큰 메모**

Run: `cd tools/colname-align && python targetmap.py ../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java overrides.json && python targetmap.py ../../it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Btermm.java overrides.json`
Expected: 각 엔티티의 `현재 -> 목표` 목록 출력. 옛 토큰 집합 기록(예: `itMngcNo,itMngcSno,itMngcBgAmt,infPrtYn,cgprEno,biceDpmC,biceTemC,bgYy,abusC,itMngcTp,pulDtt,cncdItMngcNo,tmnSno,...`).

- [ ] **Step 2: 코드모드 적용 + 컴파일 주도 정합**

런북 2)를 따라 Bcostm/Btermm/BcostmL/BtermmL/BcostmId/BtermmId/DTO 선언을 리네임하고
`./gradlew compileJava`로 호출부·QueryDSL을 green까지 정합.

Run: `cd it_backend && ./gradlew compileJava -q`
Expected: 최종 EXIT 0 (반복 정합 후)

- [ ] **Step 3: 런타임 스캔 (잔존 0)**

Run: `cd tools/colname-align && python scan_runtime_refs.py "itMngcNo,itMngcSno,itMngcBgAmt,infPrtYn,cgprEno,biceDpmC,biceTemC,bgYy,abusC,itMngcTp,pulDtt,cncdItMngcNo,tmnSno" -- "../../it_backend/src/main/java/**/*.java" "../../it_backend/src/test/java/**/*.java"`
Expected: `총 0건` (잔존 있으면 수정 후 재실행)

- [ ] **Step 4: 테스트 정합 + 게이트**

Run: `tools/colname-align/verify_domain.sh "itMngcNo,itMngcSno,itMngcBgAmt,infPrtYn,cgprEno,biceDpmC,biceTemC,bgYy,abusC,itMngcTp,pulDtt,cncdItMngcNo,tmnSno"`
Expected: `== ALL GREEN ==`

- [ ] **Step 5: 프론트 락스텝 + typecheck**

cost 도메인 소비 타입/사용처를 목표명으로 정합.
Run: `cd it_frontend && npm run typecheck`
Expected: 신규 에러 0 (기존 server/ 2건 외)

- [ ] **Step 6: 원자적 커밋**

```bash
cd /c/it/it_backend && git add -A && git commit -m "refactor(cost): 변수명 컬럼명 정합 (itMngcNo->costBgNo 등, 충돌 도메인접두사)"
cd /c/it/it_frontend && git add -A && git commit -m "refactor(cost): 화면 변수명 컬럼명 정합"
```

---

## Task 9: 나머지 도메인 롤아웃 트래커

각 도메인은 Task 7 런북 + Task 8 패턴을 1회 적용 = 1 원자적 커밋. 충돌 오버라이드는 Task 6 승인본 사용.
도메인마다 `verify_domain.sh "<옛토큰>"` 가 `== ALL GREEN ==` 이어야 커밋한다.

**순서 1 — 예산 잔여:**
- [ ] `plan` (Bplanm + BplanmL)
- [ ] `document` (Brdocm, Brivgm, Bgdocm + `*L`)
- [ ] `work` (Bbugtm + BbugtL)
- [ ] `status` (집계 전용 — 엔티티 없으면 DTO/QueryDSL만)
- [ ] `it` (IT부문 예산 — DTO/QueryDSL)

**순서 2 — 공통:**
- [ ] `approval` (Cappla, Capplm, Cdecim + `*L`)
- [ ] `board` (Cblbmm, Cblbcm, Ccmmtm + `*L`)
- [ ] `code` (Ccodem + CcodemL)
- [ ] `iam` (CuserI, CauthI, CorgnI, CroleI)
- [ ] `notification` (Cinfmm)
- [ ] `system` (Clognh, Crtokm)

**순서 3 — 협의회·기타:**
- [ ] `council` 서브테이블군 (Basctm, Bchklc, Bcmmtm, Bevalm, Bpovwm, Bperfm, Bpqnam, Bmqnam, Brsltm, Bschdm 등 + `*L`)
- [ ] `cdp` (경력개발)
- [ ] `audit` / `infra/file` (Cfilem 등)

- [ ] **각 도메인 완료 시 본 트래커 체크박스 갱신 + data-model.md 매핑표 반영**

- [ ] **전체 완료 후 최종 회귀:** `./gradlew clean test` + `bootRun` + 핵심 화면 수동 QA

---

## Self-Review 결과

- **Spec 커버리지:** §2 명명규칙→Task1·3, §2.4 충돌→Task2·6, §3 툴링→Task1~5, §3.3 스캐너→Task4, §4 게이트→Task5·7, §5 순서→Task9, §6 테스트/롤백→Task5·8·9, §7 거버넌스산출물→Task6 ✅
- **플레이스홀더:** 도구 코드·테스트·명령·기대출력 모두 구체화. Task8/9는 런북(Task7)을 참조하는 반복 절차로, 동일 코드 중복 대신 결정적 도구+런북으로 표현(거버넌스 재현성 목적에 부합) ✅
- **타입 일관성:** `parse_pairs`/`camel`/`reused_columns`/`build_target_map`/`find_refs` 시그니처가 Task 간 일치 ✅

---

## 실행 진행 현황 (2026-06-04 기준, 일시 중단)

### 완료 (각 도메인 verify_domain.sh ALL GREEN: compile·scan0·BOOT_OK·typecheck신규0)

| Task | 도메인 | 백엔드 커밋 | 프론트 커밋 |
|---|---|---|---|
| 1~5 | 툴링(파서·충돌·타깃맵·스캐너·하네스) | root: e294ef7,a1b0554,89a97c7,ab47e0e,bc2c05b,(scan fix 8c18a0f) | — |
| 6 | 충돌 매핑표(승인본) | it_backend d8079ac / root 556d6a8,c5d7008 | — |
| 7 | 런북 | root fb83cc0 | — |
| 8 | cost (워크드 예제) | ff43bea, 44b994c | 9ef5b3e |
| 9 | project (파일럿, 선행) | d5d45c9, 430d187 | 22540af, e96b998 |
| 9 | plan | 9091cd9 | 430c394 |
| 9 | document | 8223a0b | afd3306 |
| 9 | work | 5c25430 | (DTO 미변경으로 불필요) |
| 9 | status | ff9b968 | 4188f93 |
| 9 | it | (이미 준수, 작업 불필요) | (불필요) |

### 남은 도메인 (재개 시 런북 + 도메인별 게이트 반복)
- 공통: approval, board, code, iam, notification, system
- 협의회·기타: council(서브테이블군), cdp, audit, infra

### 후속 정비 항목
- **work `BudgetWorkDto`** 요청/응답 필드(orcTb·dupRt 등) DTO 미정합 — 엔티티는 정합됨. 일관성 위해 추후 DTO 정합 검토.
- 재개 절차: `tools/colname-align/README.md` 런북 + `overrides.json`(승인된 충돌맵) 사용. 각 도메인 옛 토큰으로 `verify_domain.sh` ALL GREEN 후 원자적 커밋.
