# 결재 상태 코드화 + 재상신 + 회수 기능 설계

- 작성일: 2026-05-25
- 범위: `common/approval` 도메인 (Capplm, Cdecim, Cappla) 및 Ccodem
- 영향: it_backend, it_frontend, it_database (Flyway), PDF 렌더링

---

## 1. 배경 및 목표

### 1.1 현재 문제점
- `Capplm.apfSts`가 한글 문자열("결재중"/"결재완료"/"반려")로 관리되어 다국어/일관성/검색 측면에서 취약하며, `Cdecim.dcdTp`/`dcdSts` 등 결재 상태 표현이 여러 컬럼에 분산되어 있다.
- 반려된 신청서를 다시 상신할 수 없다. 원본 BPROJM/BCOSTM이 한 번 CAPPLA에 연결된 시점부터 미상신 목록에서 제외되어 재상신 진입점이 사라진다.
- 신청자가 결재 진행 중 신청서를 철회(회수)할 수 있는 기능이 없다.

### 1.2 목표
1. 결재 상태를 공통코드(Ccodem) 기반으로 전면 코드화한다 (호환 모드 없이 단일 컷오버).
2. 반려/회수된 신청서의 원본 데이터에 대해 재상신을 허용한다.
3. 신청서 회수 기능을 신청자/중간결재자/관리자에게 제공한다. 마지막 결재자 승인 전까지 가능.
4. `Cappla.apfRelSno` 채번을 글로벌 시퀀스에서 신청서 단위 1~N 채번으로 변경한다.

---

## 2. 공통코드 정의 (Ccodem)

| cId | cVl | cNm | 비고 |
|-----|-----|-----|------|
| `APF_STS` | `001` | 결재중 | 기본값 |
| `APF_STS` | `002` | 결재완료 | 마지막 결재자 승인 |
| `APF_STS` | `003` | 반려 | 중간 결재자 반려 |
| `APF_STS` | `004` | 회수 | 신청자/중간결재자/관리자 회수 |
| `DCD_STS` | `001` | 미결재 | (기존 `dcdTp IS NULL` 대체) |
| `DCD_STS` | `002` | 승인 | |
| `DCD_STS` | `003` | 반려 | |
| `DCD_STS` | `004` | 회수무효 | 회수로 인해 무효화된 잔여 미결재 항목 |
| `INF_TP` | `006` | 결재회수 | 회수 알림 신규 코드 |

종결 상태: `APF_STS_C ∈ {002, 003, 004}`. 종결 상태의 신청서는 재처리 불가.

---

## 3. 엔티티 / 스키마 변경

### 3.1 Capplm (TPRMPP_CAPPLM)
- `APF_STS_C VARCHAR2(3) NOT NULL` 신규 추가 (값: `001`~`004`).
- `APF_STS` 컬럼은 단일 컷오버 후 DROP.
- `updateStatus(String)` → `updateStatus(ApprovalStatus enum)` 시그니처 교체.
- 회수 정보(`recallInfo: {recallEno, recallDtm, recallOpnn}`)는 `APF_DTL_CONE` JSON 내 항목으로 기록.

### 3.2 Cdecim (TPRMPP_CDECIM)
- `DCD_STS_C VARCHAR2(3) NOT NULL` 신규 추가 (값: `001`~`004`).
- 기존 `DCD_TP`/`DCD_STS` 컬럼은 단일 컷오버 후 DROP.
- 단, 사전에 grep으로 `dcdTp`의 모든 참조처를 재확인하고, 다른 의미로 쓰이는 경우가 있으면 컬럼 유지 결정.

### 3.3 Cappla (TPRMPP_CAPPLA) — 채번 정책 변경
- 기존: `@GeneratedValue(SEQUENCE, "SEQ_CAPPLA")` 글로벌 시퀀스.
- 신규: `APF_REL_SNO`는 동일 `APF_MNG_NO` 내 1, 2, 3… 순번. 등록 시 `ApplicationService.submit()`에서 명시 채번.
- 구현: `@GeneratedValue` 제거 → 등록 루프 인덱스 + 1 부여.
- 유니크 제약: `UQ_CAPPLA_APF_REL UNIQUE (APF_MNG_NO, APF_REL_SNO)` 추가.
- `SEQ_CAPPLA` 시퀀스는 DROP.
- PK는 단일 `APF_REL_SNO` 유지 (논리적으로는 복합키지만 물리 스키마 영향 최소화).

---

## 4. 상태 전이

```
                  [등록]
                    ↓
                001 결재중 ──(중간 반려)──→ 003 반려  (종결)
                  │ │
                  │ └──(마지막 승인)──→ 002 결재완료  (종결)
                  │
                  └──(신청자/중간결재자/관리자 회수)──→ 004 회수  (종결)
```

- 종결 상태(002/003/004): 추가 결재 처리 불가. 단, 원본(BPROJM/BCOSTM)의 신규 신청서 작성은 허용.
- 회수는 마지막 결재자(`lstDcdYn='Y'`)가 아직 승인하지 않은 경우에만 가능.

---

## 5. 회수 API 신규

### 5.1 엔드포인트
`POST /api/applications/{apfMngNo}/recall`

- Body: `{ "recallOpnn": "회수 사유 (필수)" }`
- 응답: 204 No Content
- 권한 게이트: 백엔드 단일 진실. 프론트의 버튼 표시는 UX 힌트일 뿐.

### 5.2 처리 흐름
1. `Capplm` 조회 (없으면 IllegalArgumentException).
2. `APF_STS_C != '001'` → IllegalStateException ("회수 가능한 상태가 아닙니다").
3. 결재선 조회. 마지막 결재자(`lstDcdYn='Y'`)가 이미 `DCD_STS_C='002'`이면 IllegalStateException.
4. 권한 검증 (헬퍼 `canRecall()`):
   - 신청자 본인(`currentEno == capplm.rqsEno`) OR
   - 중간결재자(결재선에 포함되며 `lstDcdYn='N'`인 사번) OR
   - 관리자(`ROLE_ADMIN`)
   - 외의 경우 AccessDeniedException.
5. `Capplm.APF_STS_C = '004'` 업데이트.
6. `APF_DTL_CONE` JSON에 `recallInfo` 항목 기록 (회수자/회수일시/사유).
7. 결재선에서 `DCD_STS_C='001'`(미결재)인 항목들을 `'004'`(회수무효)로 일괄 업데이트. 이미 승인된 항목(`'002'`)은 보존.
8. `ApprovalRecalledEvent` 발행 (AFTER_COMMIT 리스너가 신청자 + 기승인 중간결재자에게 `INF_TP_C='006' 결재회수` 알림 발송).

### 5.3 권한 검증 헬퍼
```java
boolean canRecall(Capplm capplm, List<Cdecim> approvers, String currentEno, boolean isAdmin) {
    if (!"001".equals(capplm.getApfStsC())) return false;
    if (isAdmin) return true;
    if (currentEno.equals(capplm.getRqsEno())) return true;
    return approvers.stream()
        .filter(a -> !"Y".equals(a.getLstDcdYn()))
        .anyMatch(a -> currentEno.equals(a.getDcdEno()));
}
```

---

## 6. 재상신 정책

- 원본 BPROJM/BCOSTM의 최신 CAPPLM 상태가 `APF_STS_C ∈ {003 반려, 004 회수}`이거나 CAPPLA 연결 자체가 없으면 미상신 목록에 포함.
- `ProjectRepositoryImpl.searchByCondition` / `CostRepositoryImpl.searchByCondition`의 `apfSts='none'` 가상 키워드 처리 변경:
  - 기존: CAPPLA 연결 없음.
  - 신규: CAPPLA 연결 없음 OR 최신 CAPPLM이 종결-비완료(`003`/`004`).
- 사이드바 [결재 상신] 미상신 건수 배지도 동일 규칙 적용.
- 재상신은 신규 `APF_MNG_NO`로 새 Capplm 생성. 이전 신청서와의 링크 컬럼은 추가하지 않음 (사용자 결정).

---

## 7. ApplicationService 변경점

- `submit()`:
  - `apfSts("결재중")` → `apfStsC("001")`.
  - Cappla 채번: 등록 루프 인덱스 `i+1`로 `APF_REL_SNO` 부여.
  - 기존 동일 결재자 자동 승인 분기에서 `DCD_STS_C` 사용.
- `approve()`:
  - 현재 차례 판정 (`dcdTp == null`) → `"001".equals(dcdStsC)`.
  - 종결 상태 전이 시 `apfStsC = '002' or '003'`.
- `recall()` 신규 (위 §5 흐름).
- 모든 한글 비교/할당을 enum/코드값 비교로 치환.

---

## 8. Repository 변경점

- `ApplicationRepository`의 native query (`countPendingByEno`, `countInProgressByEno`, `countRejectedByEno`, `countMonthlyCompletedByBbrC`, `findPendingListByEno`, `findMonthlyTrendByBbrC`) WHERE 절의 한글 문자열을 코드값으로 교체.
- `ApplicationMapRepository`에 `findMaxRelSnoByApfMngNo(String apfMngNo): int` 추가 (재상신 외 추가 항목 등록 시나리오 대비).
- `ProjectRepositoryImpl` / `CostRepositoryImpl`의 `apfSts='none'` 키워드 분기에 "최신 CAPPLM의 APF_STS_C가 NULL OR IN ('003','004')" 조건 적용.

---

## 9. 마이그레이션 (Flyway)

| 버전 | 파일명 | 내용 |
|------|--------|------|
| V20260525_001 | AddApprovalStatusCodes.sql | Ccodem INSERT (APF_STS 4건, DCD_STS 4건, INF_TP 006). MERGE 또는 WHERE NOT EXISTS로 멱등성. |
| V20260525_002 | AddCapplmApfStsC.sql | `APF_STS_C` 컬럼 추가 + DECODE 백필 + NOT NULL. |
| V20260525_003 | AddCdecimDcdStsC.sql | `DCD_STS_C` 컬럼 추가 + 백필 (`dcdTp IS NULL → '001'`, `'승인' → '002'`, `'반려' → '003'`) + NOT NULL. |
| V20260525_004 | DropLegacyApprovalColumns.sql | `APF_STS`, `DCD_TP`, `DCD_STS` DROP. |
| V20260525_005 | RefactorCapplaRelSno.sql | 임시 컬럼 경유 2단계 리넘버링 (PK 충돌 회피) + UQ 인덱스 + `SEQ_CAPPLA` DROP. |

### 9.1 Cappla 리넘버링 안전 절차
1. `ALTER TABLE TPRMPP_CAPPLA ADD APF_REL_SNO_NEW NUMBER`
2. `UPDATE` with `ROW_NUMBER() OVER (PARTITION BY APF_MNG_NO ORDER BY APF_REL_SNO)`.
3. PK 제약 임시 해제 → `APF_REL_SNO = APF_REL_SNO_NEW` → PK 재생성.
4. `APF_REL_SNO_NEW` DROP, `UQ_CAPPLA_APF_REL (APF_MNG_NO, APF_REL_SNO)` 추가, `SEQ_CAPPLA` DROP.

---

## 10. 프론트엔드 영향

- 신청서 목록/상세: `apfStsC` 라벨 매핑 composable (`useApprovalStatus()`).
- 회수 버튼: `apfStsC === '001'` AND (본인 OR 중간결재자 OR 관리자) 조건으로 노출. UX 힌트일 뿐 실제 권한 검증은 백엔드.
- 회수 확인 모달 → 회수 사유 입력 필수.
- 사이드바 [결재 상신] 미상신 배지: 반려/회수 신청서 포함 안내 문구 보강.
- 결재 대시보드 카드(`countRejected` 등) 코드 기준으로 조회.

---

## 11. PDF / 결재선 렌더링

- `apfDtlCone` JSON의 결재선 상태 라벨은 백엔드 `ApprovalLineDelegate`에서 저장 시 코드, 렌더링 시 한글 라벨로 변환.
- 회수된 신청서 PDF에는 "회수" 워터마크를 추가.
- 기존 저장된 JSON의 한글 라벨 마이그레이션은 불필요 (저장 시점부터 적용, 읽기 호환 유지).

---

## 12. 테스트 전략

### 12.1 단위 테스트 (ApplicationServiceTest)
- `submit_setsApfStsCTo001()`
- `submit_assignsApfRelSnoSequentiallyStartingFromOne()`
- `submit_multipleOrcItems_assigns1To3()`
- `approve_lastApproverApproves_setsApfStsCTo002()`
- `approve_middleApproverRejects_setsApfStsCTo003()`
- `recall_byRequester_setsApfStsCTo004_andInvalidatesPendingApprovers()`
- `recall_byMiddleApprover_setsApfStsCTo004_preservesApprovedHistory()`
- `recall_byAdmin_succeeds()`
- `recall_byUnrelatedUser_throwsAccessDenied()`
- `recall_whenLastApproverAlreadyApproved_throwsIllegalState()`
- `recall_terminatedApplication_throwsIllegalState()` (002/003/004 입력)

### 12.2 통합 테스트
- `POST /api/applications/{apfMngNo}/recall` 응답 코드 매트릭스.
- 미상신 쿼리: 반려/회수 신청서를 가진 BPROJM이 결과에 포함되는지.

### 12.3 마이그레이션 검증
- V005 Cappla 리넘버링: 임시 DB에서 dry-run, 데이터 행수/PK 무결성 비교.
- 모든 V 스크립트 멱등성: 동일 환경에서 재실행 시 NO-OP.

---

## 13. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| 단일 컷오버 중 결재 진행 신청서 존재 | 데이터 불일치 | 배포 직전 결재 진행 중인 신청서 목록 확보. 배포 직후 스모크 테스트. |
| Cappla PK 리넘버링 중 충돌 | 마이그레이션 실패 | 임시 컬럼 경유 2단계 절차 (§9.1). |
| `dcdTp`가 다른 의미로 사용 중일 가능성 | 데이터 손실 | DROP 전 grep으로 모든 참조 재확인. 의미 모호 시 컬럼 유지. |
| 결재선 JSON 한글 라벨 호환 | PDF 깨짐 | `ApprovalLineDelegate`에서 저장은 코드, 출력은 라벨 변환. |
| 중간결재자 회수가 업무적 혼란 | 사용자 항의 | 회수 사유 필수화. 회수 알림에 회수자 사번/사유 명시. 운영 가이드 사전 공지. |
| Ccodem 캐시 미반영 | 코드 인식 실패 | 마이그레이션 직후 `CodeService` 캐시 evict 및 워밍업 확인. |

---

## 14. 작업 순서 (단일 컷오버)

1. Flyway V001~V005 작성 및 dev DB 검증.
2. 백엔드 코드 변경 (엔티티/서비스/리포지토리/회수 API/이벤트/알림 리스너).
3. 프론트엔드 코드 변경 (라벨 매핑/회수 버튼/미상신 안내).
4. PDF 렌더링 워터마크 처리.
5. 테스트 (단위/통합/마이그레이션 dry-run).
6. 운영 배포: Flyway 일괄 실행 → 백엔드/프론트 동시 배포.
7. 스모크 테스트 및 결재 진행 중 신청서 상태 점검.

---

## 15. 사용자 결정 사항 요약

- 재상신: 신규 신청서 생성 방식 (원본 참조 컬럼 추가 없음).
- 원본 제약 해제: 최신 CAPPLM 상태가 반려/회수면 재상신 허용.
- 코드화: Ccodem 신규 + 컬럼 교체 + 전체 일괄 적용.
- 회수 시점: 마지막 결재자 승인 전까지.
- 회수 권한: 신청자 + 중간결재자 + 관리자.
- 중간결재자 회수: 신청서 전체 회수 + 기결정 결재 이력 보존.
- PDF: 회수 시 워터마크 추가.
- 권한 검증: 백엔드 단일 진실 (프론트는 UX 힌트).
- 배포 방식: 호환 모드 생략, 단일 컷오버.
- Cappla 채번: 신청서 단위 1~N 채번으로 변경, UQ 제약 추가.
