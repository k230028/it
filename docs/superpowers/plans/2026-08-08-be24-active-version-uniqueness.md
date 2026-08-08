# BE-24 활성 최신 버전 단일성 — 재조사와 조치계획

작성일: 2026-08-08
기준 HEAD: it_backend `645960c9`
추적 항목: `TASK.md` BE-24 (🟠 High)

## 요약 — TASK.md의 대상 지정을 정정해야 한다

BE-24는 "집행 문서 3종(`BDELIM`·`BCONTM`·`BPAYMM`)의 활성 최신 버전 단일성"을 과제로 적고 있으나, 코드를 실측한 결과 **위험이 있는 테이블과 위험이 없는 테이블이 뒤바뀌어 있다.**

| 대상 | TASK.md 기술 | 실측 |
| --- | --- | --- |
| `BDELIM`·`BCONTM`·`BPAYMM` | 활성 최신행 1건을 보장하지 않는다 (🟠 High) | **현재 코드로는 중복 활성행이 발생할 수 없다** — §1 |
| `BCOSTM`(·`BPROJM` 확인 필요) | 언급 없음 | **구조적으로 활성행이 누적될 수 있다** — §2. 세 Repository의 `.distinct()` 우회가 이것 때문이다 |

즉 BE-24가 요구하는 "버전 전환을 잠금·원자 갱신으로 처리한다"는 **세 집행 문서 테이블에는 전환 로직 자체가 없어 적용 대상이 아니고**, 정작 전환이 필요한 곳은 다른 테이블이다.

---

## 1. 집행 문서 3종 — 중복 활성행은 현재 코드로 발생 불가

실측 근거:

- `DeliberationService.java:65`, `ContractService.java:67`, `PaymentService.java:75`가 생성 시 `docVrsSno`를 **`1` 상수**로 넣는다.
- 세 도메인 어디에도 `lstYn`을 `'N'`으로 바꾸는 코드가 없다(`domain/{deliberation,contract,payment}` 전수 grep 결과 `lstYn("Y")` 3곳이 전부).
- 물리 PK가 `(DOC_MNG_NO, DOC_VRS_SNO)`이고 `DOC_VRS_SNO`가 항상 `1`이므로, **같은 `DOC_MNG_NO`의 두 번째 행은 PK 위반으로 애초에 저장되지 않는다.**

따라서 `fetchOne()`이 `NonUniqueResultException`을 낼 수 있다는 BE-24의 서술은 이 테이블들에 대해서는 성립하지 않는다. 🟠 High의 근거도 약하다.

남는 정당한 작업은 **스키마 방어(defense-in-depth)** 하나다 — 코드가 전제하는 불변식을 DB가 강제하게 해서, 나중에 버전 기능이 실제로 추가될 때 조용히 깨지지 않도록 한다. 성격은 🟢 Low~🟡 Medium이다.

## 2. 진짜 위험 — `BCOSTM`의 활성행 누적

실측 근거:

- `Bcostm.java:28` 클래스 주석이 "동일 관리번호에 여러 버전(일련번호)이 존재할 수 있으며 `LST_YN='Y'`인 …"이라며 **다중 버전을 전제**한다.
- PK는 `(COST_BG_NO, BG_SNO)`이고 `CostService.createCost:94`가 `costRepository.getNextSnoValue(costBgNo)`로 **다음 일련번호를 계산해** 새 행을 만든다.
- 새 행은 `CostDto.java:216`에서 `.lstYn("Y")`("신규는 항상 최신")로 저장되는데, **이전 행의 `LST_YN`을 `'N'`으로 내리는 코드가 없다**(`domain/budget/cost` 전수 grep에서 `lstYn` 쓰기는 이 한 곳뿐).

결과적으로 같은 `COST_BG_NO`에 `LST_YN='Y'` 행이 2건 이상 남을 수 있고, 이것이 세 집행 문서 Repository에 붙은 아래 우회의 원인이다.

```
// BPROJM/BCOSTM 2중 LEFT JOIN이 버전 전환 중 lstYn='Y' 중복 행으로 팬아웃되어
// NonUniqueResultException이 나는 것을 방어한다(search()와 동일한 가드).
.distinct()
```

`.distinct()`는 **팬아웃으로 늘어난 행 수만 줄일 뿐 어느 버전이 채택되는지는 정하지 않는다.** 조인이 가져오는 `abusNm`/`cttNm`이 서로 다른 버전에서 올 수 있고 그때 결과는 비결정적이다.

`BPROJM`도 같은 구조인지는 추가 확인이 필요하다 — `BprojmId`는 `(ABUS_MNG_NO, SNO)`이고 `Bprojm.lstYn`이 `'N'`으로 내려가는 지점을 찾지 못했으나, `ProjectService:228`·`467`의 `lstYn("Y")`는 `Bprojm`이 아니라 **품목(`Bitemm`)** 이었다. `Bprojm` 생성 지점을 별도로 확인해야 한다.

## 3. 지금 판단할 수 없는 것 — DB 실데이터

"이미 중복이 존재하는가"는 코드로 알 수 없고 DB 조회가 필요하다. 로컬 Oracle 접속은 비밀번호를 콘솔 프롬프트에만 입력하는 정책(`CLAUDE.md` §3.1.1)이라 **사용자가 직접 실행해야 한다.**

```sql
SELECT 'BCOSTM' AS tbl, COUNT(*) AS dup_keys FROM (
  SELECT COST_BG_NO FROM ITPOWN.TPRMPP_BCOSTM
   WHERE LST_YN = 'Y' AND DEL_YN = 'N'
   GROUP BY COST_BG_NO HAVING COUNT(*) > 1)
UNION ALL
SELECT 'BPROJM', COUNT(*) FROM (
  SELECT ABUS_MNG_NO FROM ITPOWN.TPRMPP_BPROJM
   WHERE LST_YN = 'Y' AND DEL_YN = 'N'
   GROUP BY ABUS_MNG_NO HAVING COUNT(*) > 1)
UNION ALL
SELECT 'BDELIM', COUNT(*) FROM (
  SELECT DOC_MNG_NO FROM ITPOWN.TPRMPP_BDELIM
   WHERE LST_YN = 'Y' AND DEL_YN = 'N'
   GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1)
UNION ALL
SELECT 'BCONTM', COUNT(*) FROM (
  SELECT DOC_MNG_NO FROM ITPOWN.TPRMPP_BCONTM
   WHERE LST_YN = 'Y' AND DEL_YN = 'N'
   GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1)
UNION ALL
SELECT 'BPAYMM', COUNT(*) FROM (
  SELECT DOC_MNG_NO FROM ITPOWN.TPRMPP_BPAYMM
   WHERE LST_YN = 'Y' AND DEL_YN = 'N'
   GROUP BY DOC_MNG_NO HAVING COUNT(*) > 1);
```

`BCOSTM`이 0이 아니면 §2가 이론이 아니라 **현재 진행 중인 데이터 손상**이며 우선순위를 그쪽으로 옮겨야 한다.

---

## 조치계획

### Phase 0 — 확인 (사용자·DBA)

1. 위 진단 SQL을 로컬·dev에서 실행해 테이블별 중복 키 수를 확보한다.
2. `Bprojm` 생성 경로에서 `lstYn`이 `'N'`으로 내려가는 지점이 있는지 확정한다(이 문서 작성 시점에는 찾지 못함).

Phase 1의 A/B는 배타적이지 않고 **우선순위 문제**다. Phase 0 결과가 순서를 정한다.

### Phase 1-A — `BCOSTM` 활성행 단일화 (중복이 존재하면 최우선)

1. **버전 전환을 원자적으로 만든다.** `CostService.createCost`가 기존 `costBgNo`에 새 `BG_SNO`를 붙일 때, 같은 키의 기존 활성 행을 `LST_YN='N'`으로 내리는 갱신을 **같은 트랜잭션 + 비관적 잠금**(`SELECT ... FOR UPDATE`) 아래 수행한다.
2. **기존 데이터 정리**: 각 키에서 가장 큰 `BG_SNO` 1건만 `'Y'`로 남기고 나머지를 `'N'`으로 내리는 마이그레이션. 감사 로그(`*L`) 영향은 BE-22 인계 노트와 같은 방식으로 사전 공지한다.
3. **함수 기반 UNIQUE 인덱스**로 재발을 막는다.

   ```sql
   CREATE UNIQUE INDEX IX_TPRMPP_BCOSTM_02 ON ITPOWN.TPRMPP_BCOSTM (
       CASE WHEN LST_YN = 'Y' AND DEL_YN = 'N' THEN COST_BG_NO END);
   ```

   **순서 주의**: 1 → 2 → 3. 1을 먼저 하지 않고 3을 적용하면 다음 버전 생성이 즉시 실패한다.
4. **`.distinct()` 우회 제거 판단**: 원인이 사라지면 세 Repository의 `.distinct()`는 불필요해진다. 제거는 별도 커밋으로 하고 제거 전후 결과 동일성을 Oracle 통합 테스트로 확인한다.
5. Oracle 통합 테스트: 중복 활성행 삽입 거부 / 버전 전환 후 단건 조회가 최신 버전을 돌려주는가 / 목록의 조인 팬아웃이 사라졌는가.

### Phase 1-B — 집행 문서 3종 스키마 방어 (중복이 없으면 낮은 우선순위)

1. 세 테이블에 같은 형태의 함수 기반 UNIQUE 인덱스를 추가한다. 현재 데이터는 PK 덕분에 이미 조건을 만족하므로 **정리 단계가 필요 없다.**
2. Oracle 통합 테스트로 중복 활성행 삽입이 거부됨을 고정한다.
3. `TASK.md` BE-24의 우선순위를 🟠 High → 🟡 Medium으로 내리고 대상 기술을 이 문서 기준으로 정정한다.

### 검증

```bash
cd it_backend && ./gradlew check
```

```bash
cd it_backend && ./gradlew integrationTest
```

DB 스키마 변경이 포함되므로 dev/prod 적용은 `it_database/docs/operations/`에 BE-22와 같은 형식의 인계 노트를 함께 작성한다.
