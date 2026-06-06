# 공통코드 변경(마이그레이션) 설계서

- **작성일**: 2026-06-06
- **대상**: `C:\it` IT Project Portal (DB + 백엔드 + 프론트엔드 풀스택)
- **입력 기준**: `C:\it\code.csv` (156행, 기존→변경 매핑. 값ID 기준 정렬 정합 완료)
- **범위 결정**: 풀스택 전체 / 운영 데이터 백필 포함 / **현재 CSV에 존재하는 31개 그룹만 대상**
- **상태**: 설계 검토 완료(2026-06-06 재검토 반영), 구현 계획 대기

> **2026-06-06 재검토 변경점**
> 1. code.csv가 값ID 기준으로 재정렬되어, 기존 §4의 독립정렬 이상행(TCHN_TP·SD·KPN_TC·CUR·DUP_AMT·BG_RQS)이 **모두 정합 해소**됨. 매칭 규칙 = **값ID join**(= 현재 행 위치).
> 2. 스코프를 **현재 CSV에 존재하는 코드로 한정**. 기존 33그룹 중 `VLR_TC / ASCT_STS_C / DBR_TC` 3개는 CSV에 없어 **대상 제외**(변경하지 않음).
> 3. **`IT_MNGC_TP` 매핑 정정**: 기존 표의 "IT_MNGC_TP→IT_MNGC_TP 명칭만"은 오류. 실제는 **`IT_MNGC_TP → TMN_YN`** + 값ID `001→0`, `002→1` (단말여부) — 백필 대상.
> 4. TMN 병합 충돌은 이전 확정대로 **TMN_USG를 009/010/011로 재번호**(§4) 유지.

---

## 1. 목적 (Goal)

`code.csv`에 정의된 공통코드 변경(그룹ID 리네임·병합, 값ID 리맵, 명칭/유효기간/계층 변경)을
**DB 시드 → 업무데이터 백필 → 백엔드/프론트 코드 참조** 순으로 정합성 깨짐 없이 일괄 반영한다.

성공 기준:
- `TPRMPP_CCODEM`이 `code.csv`의 "변경" 목표 상태와 일치한다.
- 업무 테이블에 저장된 구(舊) 값ID가 모두 신(新) 값ID로 백필되어 고아 코드가 0건이다.
- 백엔드/프론트의 모든 구 그룹ID 리터럴이 신 그룹ID로 교체되어, 타입체크·테스트·핵심 화면 QA가 통과한다.

---

## 2. 현황 (Findings)

### 2.1 DB
- 공통코드 저장 테이블: **`TPRMPP_CCODEM`** (PK: `CO_C_ID, CDVA_ID, STT_DTM`).
  - 주요 컬럼: `CO_C_ID`(그룹ID), `CDVA_ID`(값ID), `STT_DTM`/`END_DTM`(유효기간),
    `CO_C_NM`/`CDVA_NM`/`CO_CDVA_NM`(명칭), `C_SQN_SNO`(정렬), `CO_C_INTN_NM`(인스턴스명),
    `HRK_CDVA_ID`(상위값ID, 계층), `DEL_YN`.
- 변경로그 테이블: **`TPRMPP_CCODEL`** (감사 스냅샷).
- **FK 제약 없음** — 업무 테이블은 코드값을 단순 `VARCHAR2` 문자열로 저장(느슨한 참조).
- 시드 적재 경로: SQL 마이그레이션이 아니라 **`EXPDAT.DMP`(Oracle Data Pump)**. 개별 INSERT 마이그레이션 부재.
- Flyway 규약: `V{YYYYMMDD}_{NNN}__{설명}.sql`, **최신 버전 `V20260605_007`**.
  → 신규 마이그레이션은 `V20260606_001__...` 부터.

### 2.2 백엔드 (Spring Boot, `it_backend`)
구 그룹ID를 문자열 리터럴/enum/상수로 하드코딩한 핵심 파일(영향 ≥15):
- `common/code/service/CodeService.java` — `"BG_RQS"`
- `domain/budget/cost/util/XcrLookupService.java` — `CUR_C_ID = "CUR"`
- `domain/budget/project/service/ProjectService.java` — `PRJ_TP, RPR_STS, PUL_DTT, TCHN_TP, MN_USR, BZ_DTT, IOE`
- `domain/budget/cost/service/CostService.java` — `IOE, DFR_CLE, PUL_DTT, DUP_IOE`
- `domain/budget/work/service/BudgetWorkService.java` — `IOE, DUP_IOE`
- `domain/budget/status/repository/BudgetStatusQueryRepositoryImpl.java` — `IOE, RPR_STS`
- `common/approval/domain/ApprovalStatus.java` — enum, `APF_STS` 값 `01~04`
- `common/approval/domain/DecisionStatus.java` — enum, `DCD_STS` 값 `001~004` (그룹 불변)
- `domain/council/service/FeasibilityService.java`, `EvaluationService.java` — `KPN_TC, CKG_ITM_C`
- council 엔티티/리포지토리 — `CKG_ITM_C`(대상). ⚠ `ASCT_STS_C, DBR_TC, VLR_TC`는 **현재 CSV 미존재 → 대상 제외**(코드 변경 없음)
- `common/board/service/BoardPostService.java` — `BLB_TC='001'`
- `domain/budget/plan/service/PlanService.java` — `PUL_DTT`

### 2.3 프론트엔드 (Nuxt 4, `it_frontend`)
- 코드 조회는 컴포저블 `app/composables/useCodeOptions.ts` 중심(약 95%): `useCodeOptions('PRJ_TP')`.
  - 엔드포인트: `GET /api/ccodem/{cId}`, `GET /api/ccodem/type/{cTp}`.
- 그룹ID 리터럴/직접 API 경로(`/api/ccodem/CUR` 등)를 가진 파일 약 **40개**.
- 값ID 하드코딩 비교: `app/pages/info/cost/form.vue` (`'PUL_DTT_002'`),
  `app/pages/info/projects/[id].vue` (IOE 서브타입 배열/switch),
  `app/pages/board/[blbMngNo]/index.vue` (`BLB_TC='001'`),
  `app/composables/useApprovalStatus.ts` (`APF_STS_LABEL` `01~04`).
- 타입 정의: `app/types/council.ts`, `app/types/notification.ts`.

### 2.4 핵심 발견 — 물리 컬럼명은 이미 신규명
업무 테이블의 `@Column(name=...)`은 **이미 신규 물리명**을 사용 중:
`DCD_STS_C, APF_PRG_STS_C, IOE_C, CUR_C, DFR_CLE_C, ASCT_STS_C, INFM_SVC_TC, BG_UNT_ABUS_C, ABUS_TC, BZ_TP_C, EXE_PTT_YN`.
→ **컬럼 리네임 DDL 불필요.** 이번 작업은 ① CCODEM 시드값 ② 컬럼에 저장된 값ID 백필 ③ 코드 그룹ID 리터럴 교체에 집중.

---

## 3. 권위 있는 그룹ID 매핑 (code.csv 추출, 31그룹)

> 값ID 변경 컬럼이 0보다 큰 그룹 = **업무데이터 백필 대상**(Phase 2). 그 외는 CCODEM 시드 + 코드 리터럴 교체만.

| 기존 그룹ID     | 변경 그룹ID                         |  행수 | 값ID 변경 | 비고                     |
| ----------- | ------------------------------- | --: | -----: | ---------------------- |
| TMN_USG     | **IT_PTL_TMN_SVC_TC**           |   4 |      3 | [확정] TMN_KD와 병합, 값 001/002/003→**009/010/011** 재번호(§4), 999 유지 |
| TMN_MAGR    | **IT_PTL_TMN_KD_TC**            |   4 |      0 | 리네임                    |
| TMN_KD      | **IT_PTL_TMN_SVC_TC**           |   8 |      0 | TMN_USG와 병합(001~008 유지) |
| TCHN_TP     | **IT_PTL_TCHN_TP_TC**           |   7 |      0 | 리네임 (값-명칭 정합 확인됨)      |
| SYS_RQC     | SYS_RQC                         |   7 |      0 | 명칭만                    |
| SYS_PVC     | SYS_PVC                         |   7 |      0 | 명칭만                    |
| SD          | **SD_TC**                       |   4 |      0 | 리네임 (값-명칭 정합 확인됨)      |
| RPR_STS     | **IT_PTL_RPR_STS_TC**           |   6 |      0 | 리네임                    |
| PUL_DTT     | **ABUS_TC**                     |   2 |      2 | 값ID 001/002→01/02      |
| PRJ_TP      | PRJ_TP                          |   6 |      0 | 명칭만                    |
| PRJ_PUL_PTT | **EXE_PTT_YN**                  |   2 |      0 | 리네임                    |
| PRIT_C      | PRIT_C                          |   3 |      0 | 명칭만(그룹명 추가)            |
| NAC_TP      | NAC_TP                          |   3 |      0 | 명칭만                    |
| MN_USR      | **CST_TP_TC**                   |   4 |      0 | 리네임                    |
| KPN_TC      | KPN_TC                          |   2 |      0 | 명칭만 (값 정합 확인됨)         |
| IT_MNGC_TP  | **TMN_YN**                      |   2 |      2 | [정정] 리네임+값ID 001→0, 002→1 |
| IOE         | **IOE_C**                       |  22 |      0 | 리네임                    |
| INFM_SVC    | **INFM_SVC_TC**                 |   6 |      0 | 리네임                    |
| EDRT_MNGC   | **IT_PTL_EDRT_TC**              |   4 |      4 | 병합+값ID 001~004→10~13   |
| EDRT_CPIT   | **IT_PTL_EDRT_TC**              |   4 |      4 | 병합+값ID 001~004→20~23   |
| DUP_IOE     | DUP_IOE                         |   7 |      0 | 계층(HRK_CDVA_ID) 추가     |
| DUP_AMT     | DUP_AMT                         |   2 |      0 | 계층(HRK) 추가, 값 정합 확인됨   |
| DFR_CLE     | **DFR_CLE_C**                   |   5 |      5 | 값ID 001~004/999→1~4/9  |
| DCD_STS     | DCD_STS                         |   4 |      0 | 불변                     |
| CUR         | **CUR_C**                       |   5 |      0 | 리네임+명칭(값ID=통화코드 유지)    |
| CKG_ITM_C   | CKG_ITM_C                       |   6 |      0 | 명칭만                    |
| BZ_DTT      | BZ_DTT                          |   7 |      0 | 명칭만                    |
| BLB_TC      | BLB_TC                          |   2 |      0 | 명칭만                    |
| BG_RQS      | BG_RQS                          |   2 |      0 | 불변(STA/END 정합 확인됨)     |
| APF_STS     | **APF_PRG_STS_C**               |   4 |      4 | 값ID 01~04→1~4          |
| ABUS_C      | **BG_UNT_ABUS_C**               |   2 |      1 | 값ID 01→501 (502 유지)    |

> **대상 제외(현재 CSV 미존재)**: `VLR_TC`, `ASCT_STS_C`, `DBR_TC` — 이번 마이그레이션에서 변경하지 않음.
> 모든 행에서 `STT_DTM`이 임의값→실제일자로, `END_DTM`이 `9999-12-31`로 정규화됨(유효기간 정비).
>
> **값ID 변경(백필 대상) 그룹 8종**: TMN_USG(재번호), PUL_DTT→ABUS_TC, IT_MNGC_TP→TMN_YN, EDRT_MNGC/EDRT_CPIT→IT_PTL_EDRT_TC, DFR_CLE→DFR_CLE_C, APF_STS→APF_PRG_STS_C, ABUS_C→BG_UNT_ABUS_C.

---

## 4. code.csv 정합 상태 — 재검토 결과 (2026-06-06)

code.csv가 **값ID 기준으로 재정렬**되어, 기존/변경 두 영역이 동일 값ID로 행 위치까지 정합한다.
이전 판본에서 "사람 검증 필요"로 표시했던 독립정렬 이상행은 **모두 해소**되었다:

- **값-명칭 정합 확인(시프트 아님)**: `TCHN_TP`(004 블록체인/005 플랫폼/006 핀테크/999 기타),
  `SD_TC`(02 카카오/03 문자/04 이메일), `KPN_TC`(001 임시저장/002 저장) — 값ID-명칭 1:1 일치.
- **스왑 아님(값ID join 정합)**: `CUR_C`(CNY/EUR/JPY/SGD/USD 동일),
  `DUP_AMT`(200=0, 300=200000000), `BG_RQS`(STA=시작/END=종료) — 명칭/계층만 추가, 값 의미 불변.

→ **매칭 규칙(SoT) = 값ID join**. code.csv의 각 행은 기존(좌)·변경(우)이 같은 값ID로 짝지어진다.
계층 병합(TMN, EDRT)으로 값ID가 재배정되는 경우만 명시적 매핑을 적용한다.

### 4.1 유일한 명시적 재배정 — TMN 병합 [확정됨 2026-06-06]
CSV는 `TMN_USG/001~003`과 `TMN_KD/001~003`을 **둘 다 `IT_PTL_TMN_SVC_TC`의 같은 값ID**로 적어 충돌한다.
CSV로는 해소 불가하므로 매핑테이블에서 **TMN_USG 계열을 재번호**한다:
`TMN_USG/001 트레이딩→009`, `002 리서치→010`, `003 리스크관리→011`, `999 기타→999`.
최종 `IT_PTL_TMN_SVC_TC` 값집합 = {001~008(단말종류, from TMN_KD), 009/010/011(단말용도, from TMN_USG), 999 기타}.
`TMN_USG` 그룹은 잔존하지 않음(폐기). → **TMN_USG 저장값을 쓰는 업무 컬럼은 009/010/011로 백필**.

→ 산출물: **검증된 old→new 매핑테이블**(`code-mapping.reviewed.csv` 또는 `.sql`).
이 테이블이 이후 모든 단계의 단일 SoT가 된다. code.csv 자체를 직접 SQL에 사용하지 않는다(TMN 충돌 때문).

---

## 5. 접근법 (Hybrid A+B)

- **CCODEM 시드(접근법 B)**: 영향 그룹을 `DEL_YN='Y'` 처리 또는 DELETE 후,
  검증된 매핑테이블의 "변경" 목표 상태로 **재INSERT**. 독립정렬·병합 모호성을 회피하고 결정론적.
- **업무데이터 백필 + 코드 리터럴(접근법 A)**: 검증된 매핑테이블을 SoT로
  값ID가 바뀐 그룹에 한해 업무 컬럼을 UPDATE하고, BE/FE 그룹ID 리터럴을 교체.
- **호환 레이어(접근법 C)는 채택하지 않음** — 사내 단일배포 앱, YAGNI.
- 배포 모델: DB 마이그레이션 + WAR + 프론트 generate를 **단일 조정 배포(빅뱅)**. 점진적 이중읽기 불필요.

---

## 6. 단계별 구현 계획 (Phases)

### Phase 0 — 매핑 확정 (선행, §4)
- code.csv의 31그룹·156행을 정밀 파싱하여 **old(group,value) → new(group,value,name,seq,hrk,stt,end)** 매핑 확정.
- §4 이상행을 사람이 검수·결정. 산출물 `it_database/migrations/_data/code-mapping.reviewed.csv`.
- 값ID 변경 그룹(PUL_DTT, EDRT_*, DFR_CLE, CUR, APF_STS, ABUS_C, +스왑 그룹)별
  **영향 업무 컬럼 목록** 확정(예: `ABUS_TC`←PUL_DTT 값, `APF_PRG_STS_C`←APF_STS 값,
  `BG_UNT_ABUS_C`←ABUS_C 값, `CUR_C`←CUR 값, `DFR_CLE_C`←DFR_CLE 값).

### Phase 1 — DB 마이그레이션 (Flyway, `V20260606_001__MigrateCommonCodes.sql`)
1. (백업) 영향 그룹 CCODEM 행을 임시 백업 테이블 또는 주석 스냅샷으로 보존.
2. CCODEM 영향 그룹 정리 후 "변경" 목표 상태로 재적재(재INSERT). 계층(`HRK_CDVA_ID`)·유효기간 포함.
3. `TPRMPP_CCODEL`에 변경 스냅샷 기록(감사).
4. 멱등성 보장(재실행 안전) — 존재여부 가드/`MERGE` 사용.

### Phase 2 — 업무데이터 백필 (`V20260606_002__BackfillBusinessCodeValues.sql`)
- 값ID가 바뀐 그룹(§3 "백필 대상 8종")에 한해 업무 컬럼 UPDATE (검증 매핑 기준). 예:
  - `Bprojm.ABUS_TC`: `001→01, 002→02` (PUL_DTT)
  - `Capplm.APF_PRG_STS_C`: `01→1 … 04→4` (APF_STS)
  - `Bcostm.BG_UNT_ABUS_C`: `01→501` (ABUS_C, 502 유지)
  - `Bcostm/Btermm.DFR_CLE_C`: `001→1 … 999→9` (DFR_CLE)
  - `*.TMN_YN`: `001→0, 002→1` (IT_MNGC_TP, [정정] 단말여부)
  - TMN 단말용도 저장 컬럼: `001→009, 002→010, 003→011` (TMN_USG 재번호분)
  - `*.CUR_C`: 값ID 유지(통화코드 동일) — 명칭만 변경, **백필 불요**.
  - `IT_PTL_EDRT_TC`: 전결권은 임계값 조회용(업무 저장 여부 Phase 0에서 확인).
- 백필 전/후 **고아 코드 카운트 쿼리**로 검증.

### Phase 3 — 백엔드 리터럴 교체
- §2.2 파일의 구 그룹ID 문자열/상수/enum을 신 그룹ID로 교체.
- 가능하면 그룹ID를 **상수 클래스 1곳**(예: `CommonCodeGroups`)으로 모아 재발 방지(소규모 리팩터, 작업 범위 내).
- `XcrLookupService.CUR_C_ID`, `CodeService`의 `BG_RQS` 등 개별 수정.
- `./gradlew test` 통과.

### Phase 4 — 프론트엔드 리터럴 교체
- `useCodeOptions('구ID')` 및 `/api/ccodem/구ID` 직접 호출을 신ID로 교체(약 40개 파일).
- 값ID 하드코딩 비교(`PUL_DTT_002`, `APF_STS_LABEL` 01~04, `BLB_TC='001'`, IOE 서브타입 배열) 점검·수정.
- `app/types/council.ts`, `notification.ts` 동기화.
- `npm run typecheck && npm run lint && npm test` 통과.

### Phase 5 — 검증 & QA (§9)

---

## 7. 롤백 (Rollback)
- DB: Phase 1/2 마이그레이션은 영향 그룹 백업 스냅샷으로 역적용하는 **다운(보상) 스크립트** 동봉.
  Flyway는 성공분을 추적하므로 적용 스크립트는 수정 금지 — 롤백은 신규 보상 마이그레이션으로.
- 코드: Phase 3/4는 git 브랜치 단위 revert.
- 백업: Phase 1 시작 시 `CTAS`로 `TPRMPP_CCODEM_BAK_20260606` 생성.

---

## 8. 백필 무결성 전략
- 각 값-리맵 그룹마다: 백필 전 `SELECT 컬럼, COUNT(*) ... GROUP BY` 분포 캡처 → 백필 후 분포가
  구ID 0건·신ID로 이동했는지 대조.
- 전 업무 테이블에 대해 "코드 컬럼 값이 CCODEM에 존재하지 않는 행" = 0 을 확인하는 **고아 검출 쿼리** 작성.

---

## 9. 검증 (Verification)
- DB: CCODEM이 매핑테이블 "변경" 상태와 1:1 일치(자동 비교 쿼리). 고아 코드 0건.
- 백엔드: `./gradlew test` green, 구 그룹ID 리터럴 잔존 0건(grep).
- 프론트: `typecheck/lint/test` green, 구 그룹ID 리터럴 잔존 0건(grep).
- E2E/QA(`/qa`): 로그인, 사업 조회/생성, 예산 조회, 결재 처리, 협의회, 비용/단말기 폼, 게시판.
- 그룹ID 잔존 검사: 양 코드베이스에서 구 ID 정규식 전수 grep → 0.

---

## 10. 리스크
| 리스크 | 영향 | 완화 |
|---|---|---|
| code.csv 이상행 오해석(§4) | 잘못된 코드/명칭 → 데이터 오염 | Phase 0 사람 검증, 매핑테이블 SoT화 |
| 값ID 백필 누락 | 고아 코드, 화면 공백 | 고아 검출 쿼리, 분포 전후 대조 |
| 그룹ID 리터럴 누락 | 런타임 조회 실패 | 전수 grep 0 검증, 상수 집약 |
| DMP 재적재와의 충돌 | 환경 간 시드 불일치 | 시드 SoT를 Flyway로 이관(또는 DMP 재생성 메모) |
| @Cacheable 캐시 잔존 | 구 코드 노출 | 배포 시 캐시 무효화/재기동 |

---

## 11. 범위 외 (Out of Scope)
- 업무 테이블 **물리 컬럼명 변경**(이미 신규명, 불필요).
- 공통코드 **관리 UI/CRUD** 기능 개선.
- `meta.csv`/`table.csv` 용어사전 갱신은 후속(문서 동기화)으로 분리 가능.

---

## 12. 산출물 (Deliverables)
1. `it_database/migrations/_data/code-mapping.reviewed.csv` — 검증된 old→new 매핑(SoT).
2. `V20260606_001__MigrateCommonCodes.sql` (+ 보상 스크립트).
3. `V20260606_002__BackfillBusinessCodeValues.sql` (+ 보상 스크립트).
4. 백엔드 그룹ID 리터럴 교체(+ 선택적 `CommonCodeGroups` 상수).
5. 프론트엔드 그룹ID/값ID 참조 교체.
6. 검증 쿼리 모음(고아 검출·분포 대조).
