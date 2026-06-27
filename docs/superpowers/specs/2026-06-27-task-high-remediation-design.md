# TASK.md 잔여 High 항목 조치 설계 (2026-06-27)

> 🗓️ 작성일: 2026-06-27
> 🎯 목적: `TASK.md` 잔여 🟠 High 항목을 현재 코드 기준으로 검증하고, 처리 순서를 배치로 묶어 조치 계획을 수립한다.
> 📦 선행 작업: 완료/해소 28건을 `TASK_DONE.md`로 아카이빙(2026-06-27) 완료.

## 1. 검증 결과 (2026-06-27 코드 대조)

백로그 메모(2026-06-22~24) 기준 잔여 🟠 High 8건을 현재 코드에서 검증했다.

| # | 항목 | 영역 | 상태 | 근거 |
| :-: | --- | --- | --- | --- |
| 1 | 게시판 멘션/결재 알림 INFO 로그 PII 노출 | 보안 | ✅ VALID | `BoardPostService.java:254,267,269,278,284,287`(사번목록·본문 snippet), `ApplicationService.java:221`(결재자 사번) 모두 `log.info` |
| 2 | `Contract/Deliberation/PaymentRepositoryImpl` bbrC 필터 미적용 | 보안 | ✅ VALID | 3개 모두 `bbrC` 파라미터 수신하나 WHERE 미적용("MVP 미적용" 주석). `EstimateRepositoryImpl:46`만 `p.svnDpmC.eq(bbrC)` 적용 |
| 3 | 사전협의 세션/코멘트 서버 영속화 | 사전협의 | ✅ VALID(부분) | `stores/review.ts`: 코멘트·버전이력은 서버 연동. `draftContent`·`submitForReview` 신규버전·검토자 `status`는 메모리 전용 |
| 4 | `BudgetWorkService.applyRates()` 벌크화 | DB | ✅ VALID | `:171~174, 209~212` 레코드별 개별 upsert SELECT(존재 확인) 루프 |
| 5 | `CostService.enrichCostListBatch()` 단말 N+1 | DB | ✅ VALID | `:641` 행별 `attachTerminals()`; `:390` 삭제경로 행별 `findByTermBgNoAndTermBgSno()` |
| 6 | 결재 대기/대시보드 인덱스(CDECIM/CAPPLM) | DB | ✅ VALID | 후보 인덱스 미존재(라이브 DDL 50개 인덱스 중 해당 컬럼 없음) |
| 7 | 요구사항 대시보드 인덱스(BRDOCM/BRIVGM) | DB | ✅ VALID | 후보 인덱스 미존재(감사 trail 인덱스만 존재) |
| 8 | 테스트 스텁 정합(실패 6건) | 백엔드 | ❎ RESOLVED | `./gradlew test --tests *CostServiceTest --tests *BudgetWorkServiceTest` → BUILD SUCCESSFUL. stale → 종료(아카이빙 완료) |

→ 실제 조치 대상은 **7건**(1~7).

## 2. 처리 배치 (위험도 × 노력)

### 배치 1 — 보안 Quick Win (즉시, 저노력, 마이그레이션 불필요)

**대상:** #1 멘션/결재 알림 INFO 로그 PII 정리

- `BoardPostService.publishMentionNotifications()`의 `[멘션 진단]` 로그 6곳: 사번 목록(`explicitEnos`/`rawEnos`/`existingEnos`/`recipients`)·본문 snippet을 `log.debug`로 강등하거나 삭제.
- `ApplicationService`의 `[알림 진단]` 로그 중 `:221` 결재자 사번(`next.getDcrEno()`)을 `log.debug`로 강등. count만 남기는 `:214`는 유지 가능.
- 운영 로그 정책: 사번·본문은 INFO 금지(CLAUDE.md §4.2 PII 정책). 진단 목적이면 DEBUG로 일원화.
- **검증:** 변경 후 백엔드 컴파일 + 관련 단위테스트(있으면) 통과. 로그 레벨만 변경이므로 회귀 위험 낮음.

### 배치 2 — DB 인덱스 보강 (저위험, 가산형 마이그레이션)

**대상:** #6, #7

- 신규 Flyway `V20260627_001__AddDashboardListIndexes.sql`:
  - `CDECIM(DCD_ENO, DCD_DT, DCD_MNG_NO)`
  - `CAPPLM(APF_STS, RQS_DT DESC)`
  - `BRDOCM(FST_ENR_USID, DEL_YN, FST_ENR_DTM, DOC_MNG_NO, FSG_YN)` (실행계획 확인 후 컬럼 순서 확정)
  - `BRIVGM(DOC_MNG_NO, DOC_VRS, DEL_YN, FST_ENR_DTM)`
- 네이밍 규칙·적용 프로파일은 CLAUDE.md §4.4 준수. 운영은 DBA 적용.
- **검증:** `local-ext`/`local-int` 기동 시 적용 확인. `EXPLAIN PLAN` 결과를 마이그레이션 주석/TASK.md에 기록. 인덱스 추가는 가산적이므로 롤백 위험 낮음.

### 배치 3 — N+1 제거 (중노력, 회귀 위험 → 테스트 동반)

**대상:** #4, #5

- `CostService.enrichCostListBatch()`: 단말기를 사전 일괄 조회(`IT_MNGC_NO`/`BG_NO` 묶음 IN 조회) 후 그룹핑해 행별 `attachTerminals()` 제거. 삭제 경로 `deleteCost()`도 동일하게 일괄 조회/삭제(또는 `@Modifying` 벌크) 전환.
- `BudgetWorkService.applyRates()`: 레코드별 존재 확인 SELECT를 제거하고 Oracle `MERGE INTO` 또는 키 집합 일괄 조회 후 메모리 분기(insert/update)로 전환. `applyItemRates()` 메모리 루프 soft delete도 가능 시 `@Modifying` 벌크 UPDATE 검토(별도 Medium 항목, 본 배치 선택).
- **검증:** 기존 `CostServiceTest`/`BudgetWorkServiceTest`(이미 통과 인프라 존재)에 배치 경로 케이스 보강. 동작 동등성(결과 동일·쿼리 수 감소) 확인.

### 배치 4 — 스키마 결정 + 신규 API (고노력, 별도 spec 분리 권장)

**대상:** #2, #3

- **#2 bbrC 부서 필터(보안):** `Bcontm/Bdelim/Bpaymm`에 주관부서코드 컬럼 추가 또는 대상 테이블(BPROJM/BCOSTM) JOIN으로 부서 필터 적용. 대상 2종(사업/전산업무비) 구조상 단일 JOIN 곤란 → 스키마 설계 필요. 과업심의(Stage ②) bbrC 후속 항목과 통합 검토. **별도 brainstorming/spec 권장.**
- **#3 사전협의 서버 영속화:** `draftContent` 자동저장 + `submitForReview` 버전 스냅샷 서버 저장 + 검토자 `status`/`completedAt` 백엔드 API 신설. Pinia 메모리 상태를 서버 SoT로 전환. 신규 엔드포인트·DTO·마이그레이션 필요. **별도 spec 권장.**

## 3. 실행 권고

- 배치 1~3은 이번 사이클에서 순차 실행 가능(각각 독립).
- 배치 4(#2, #3)는 스키마/신규 API 설계가 필요하므로 각각 별도 spec로 분리. 특히 #2는 cross-department 데이터 노출(보안 High)이므로 우선 spec 착수 권장.
- 각 배치 완료 시 `TASK.md`에서 해당 행 제거 → `TASK_DONE.md` 이관.

## 4. 범위 제외

- 🟡 Medium / 🟢 Low 잔여 항목, 후속 체크리스트(Tiptap·실시간로그·게시판·EAI·과업심의·메타용어사전)는 본 계획 범위 밖(High 집중). `TASK.md`에 유지.
