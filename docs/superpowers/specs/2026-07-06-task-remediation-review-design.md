# TASK 잔여 항목 조치 필요성 검토 및 실행 설계

> 작성일: 2026-07-06
> 목적: `TASK.md`의 에러 처리, DB/JPA 최적화, 프론트엔드 리팩토링, 백엔드 리팩토링 항목을 실제 코드와 대조해 조치 필요성을 판정하고 실행 순서를 정의한다.
> 관련: `TASK.md` §에러 처리, §DB / JPA 최적화, §프론트엔드 리팩토링, §백엔드 리팩토링
> SoT: 공통 규약은 `AGENTS.md`, 백엔드 규약은 `it_backend/CLAUDE.md`, 프론트엔드 규약은 `it_frontend/CLAUDE.md`를 따른다.

---

## 1. 범위와 판정 기준

### 1.1 범위

이번 설계는 코드 변경을 바로 수행하지 않고, 다음 네 개 섹션의 잔여 항목을 실행 가능한 단위로 재분류한다.

- 에러 처리: 사용자에게 실패가 보이지 않거나 빈 데이터와 실패가 구분되지 않는 항목.
- DB/JPA 최적화: 이미 완료된 12건 이후 남은 운영 반영, 토큰 조회 정합성, 캐시 키 정합성 항목.
- 프론트엔드 리팩토링: Mock 데이터 제거, 타입 안정성, 표시 유틸 중복 정리.
- 백엔드 리팩토링: 통합 테스트, 트랜잭션 계약, 환율 규칙, 문서 품질 후속.

### 1.2 판정 기준

항목별 조치 필요성은 다음 기준으로 판단한다.

| 판정 | 의미 | 처리 |
| --- | --- | --- |
| 즉시 조치 | 보안, 데이터 정합성, 사용자 오판 가능성이 있음 | Wave 1~2 우선 배치 |
| 계획 조치 | 기능 회귀 위험 또는 유지보수 비용이 있으나 결정/순서가 필요 | Wave 3~4 배치 |
| 적용 확인 완료 | `C:\it\it_database\ITPOWN_DDL_live.sql`에 반영되어 dev/prod 적용 완료로 간주 | 구현 계획에서 제외하고 `TASK_DONE.md` 이관 대상으로 처리 |
| 재분류 | 코드가 이미 일부 정리되어 기존 TASK 표현이 부정확함 | TASK 문구 정정 또는 결정 항목으로 전환 |

---

## 2. 조치 필요성 검토 결과

### 2.1 에러 처리

| 항목 | 판정 | 근거 | 조치 방향 |
| --- | --- | --- | --- |
| 예산 작업 DUP 코드 조회 실패 | 즉시 조치 | `app/pages/budget/work.vue`가 조회 실패를 삼키고 `dupCodesLoaded=true`로 진행 | 계산·저장 차단, 재시도 안내 toast, 실패 상태 노출 |
| HWPX 이미지 변환 실패 | 즉시 조치 | `app/utils/hwpx-images.ts`가 개별 이미지 실패를 무시하고 결과에서 누락 | 누락 이미지 목록 수집, 호출자에게 부분 성공 경고 전달 |
| 사전협의 버전 본문·코멘트 실패 | 계획 조치 | `app/stores/review.ts`, `app/pages/info/documents/[id]/index.vue`가 실패를 빈 값과 혼동 | 버전별 오류 상태를 store에 두고 UI에서 재시도 가능하게 표시 |
| 클립보드 기록·알림 폴링 실패 | 계획 조치 | 백그라운드성 실패라 사용자 흐름 차단은 부적절하나 진단 부재 | 중복 제한 warn 또는 상태 카운터 추가, 사용자 주도 작업만 toast |
| 감사로그 리플렉션 실패 | 계획 조치 | `AuditLogPersister`가 접근 실패와 실제 null을 구분하지 못함 | 필드명·대상 클래스 포함 warn, 업무 트랜잭션 영향은 유지하지 않음 |

### 2.2 DB/JPA 최적화

| 항목 | 판정 | 근거 | 조치 방향 |
| --- | --- | --- | --- |
| P4 후보 인덱스 dev/prod 적용 | 적용 확인 완료 | `ITPOWN_DDL_live.sql`에 `IX_BASCTM_PRJ_DEL`, `IX_BCMMTM_ENO_DEL_ASCT`, `IX_BRDOCM_DEL_DOC_VRS_FED`, `IX_BRIVGM_DOC_VRS_DEL_FED` 확인 | 코드 작업 제외, 완료 이관 |
| 작성자 소속 컬럼 dev/prod 적용 | 적용 확인 완료 | `ITPOWN_DDL_live.sql`에 `BPROJM/BPROJL.SVN_TEM_C`, `BCOSTM/BCOSTL.PRLM_HRK_OGZ_C_CONE`, `BRDOCM/BRDOCL.SVN_DPM_C/SVN_TEM_C` 확인 | 코드 작업 제외, 완료 이관 |
| Refresh Token 원문 조회 정합화 | 즉시 조치 | `findByTokCone`가 긴 JWT 원문을 조회하고 엔티티 `unique=true`와 DDL 정합이 약함 | SHA-256 해시 컬럼 추가, 해시 UNIQUE 조회, 원문 컬럼 유지 여부 결정 |
| Tiptap metadata null 부서 캐시 키 | 즉시 조치 | 일반 사용자 캐시 키가 `#user.bbrC`라 null 계정에서 키 생성 실패와 격리 불명확 | 명시 키(`ALL`, `DEPT:{bbrC}`, `USER_NO_DEPT:{eno}`)로 분리 |

### 2.3 프론트엔드 리팩토링

| 항목 | 판정 | 근거 | 조치 방향 |
| --- | --- | --- | --- |
| `info/index.vue` 정적 데이터 전환 | 계획 조치 | 백엔드 엔드포인트 또는 운영 데이터 소스 결정 필요 | 별도 기능 API spec 선행 |
| 예산 조회/비교 Mock 제거 | 계획 조치 | `useItBudget`와 `ItBudgetController`가 준비되어 있고 페이지 wiring만 잔여 | `summary.vue`, `comparison.vue`를 API 응답 기반으로 전환 |
| `any` 제거 | 계획 조치 | `useProjects`, `useTabs`, 집행 4단계 화면에 `any` catch/입력 반복 | 요청 DTO와 `unknown` 오류 포맷터 도입 |
| 파일 크기·금액 표시 통합 | 계획 조치 | 공통 유틸은 있으나 일부 화면이 로컬 함수 유지 | `formatFileSize`, `formatBudget` 사용 규칙 적용 |

### 2.4 백엔드 리팩토링

| 항목 | 판정 | 근거 | 조치 방향 |
| --- | --- | --- | --- |
| 문서/내보내기 회귀 테스트 | 계획 조치 | HWPX/PDF/Excel 유틸이 복합 로직을 담당 | 에러 처리 Wave와 묶어 단위 테스트 보강 |
| 감사로그 리스너 통합 테스트 | 계획 조치 | 단위 테스트는 있으나 실제 JPA 리스너 경로 보강 필요 | `AbstractOracleRepositoryTest` 기반 통합 테스트 추가 |
| `EstimateRepositoryImpl.search()` 통합 테스트 | 계획 조치 | 기존 Mockito 단위 테스트 중심 | 로컬 Oracle 통합 테스트로 QueryDSL 조건 검증 |
| 목록 프로젝션 DTO 작업 | 계획 조치 | 별도 계획으로 분리된 성능 작업 | 범위가 커서 후속 Wave로 분리 |
| 품목 금액 환율 환산 규칙 통일 | 재분류 | `BudgetWorkService`는 원화 정규화 금액 사용, `ProjectBudgetSummaryService`는 `amt × xcr` 사용 | 단일 규칙 결정 선행 후 코드 정리 |
| 파일 다건 업로드 부분 성공 계약 | 즉시 조치 | 단일 `@Transactional` 안에서 일부 실패를 성공 목록과 함께 반환 | 개별 파일 트랜잭션 또는 전체 실패 계약 중 하나로 재설계 |
| 알림 문구 중복 | 계획 조치 | 영향도 낮은 중복 | 공통 formatter 후속 정리 |
| Javadoc 잔여 경고 | 계획 조치 | 기능 리스크 낮음, 양이 큼 | 별도 문서 품질 작업으로 분리 |

---

## 3. 권장 실행 전략

권장 전략은 위험도 우선 Wave 처리다. 보안과 데이터 정합성 항목을 먼저 줄이고, Mock 제거와 테스트 보강은 그 다음에 진행한다. 전면 리팩토링은 리뷰 단위가 커지고 운영 반영 항목과 코드 변경 항목이 섞이므로 채택하지 않는다.

| Wave | 목표 | 주요 산출물 | 완료 게이트 |
| :--: | --- | --- | --- |
| W0 | 결정/완료 이관 분리 | 로컬 DDL 적용 확인 항목 완료 이관, 환율·파일업로드 계약 결정 기록 | 코드 작업 항목과 완료 이관 항목 분리 |
| W1 | 보안·캐시 정합성 | Refresh Token 해시 조회 설계/마이그레이션, Tiptap cache key 수정 | 백엔드 테스트 통과, 기존 토큰 전환 경로 검증 |
| W2 | 사용자 영향 에러 처리 | DUP 코드 실패 차단, HWPX 부분 실패 노출, 감사로그 진단 | 프론트 단위 테스트/타입체크, 백엔드 테스트 |
| W3 | 프론트 API 연결·타입 정리 | 예산 조회/비교 API wiring, `any` 제거, 표시 유틸 통합 | `npm run typecheck`, 관련 Vitest 통과 |
| W4 | 백엔드 테스트·계약 보강 | 파일 업로드 계약 정리, Oracle 통합 테스트 추가 | `./gradlew test`, 필요 시 `integrationTest` |

---

## 4. 설계 상세

### 4.1 W0: 결정/완료 이관

DB/JPA의 P4 후보 인덱스와 작성자 소속 컬럼은 `C:\it\it_database\ITPOWN_DDL_live.sql`에 반영되어 있으면 dev/prod 적용 완료로 간주한다. 현재 DDL에서 대상 인덱스와 컬럼이 확인되었으므로 구현 계획에는 포함하지 않고 `TASK.md`에서 `TASK_DONE.md`로 이관한다.

환율 규칙은 먼저 업무 결정을 받아야 한다. `BITEMM.AMT`가 저장 시점 원화 정규화 금액이라면 모든 집계는 `amt`를 그대로 사용하고 `xcr`은 표시/감사 정보로만 둔다. 반대로 `amt`가 외화 금액이라는 업무 정의라면 저장 경로부터 재정의해야 하므로 영향 범위가 커진다. 현재 코드 주석과 `BudgetWorkServiceXcrLookupTest`는 전자를 지지하므로, 기본 설계는 “`BITEMM.AMT`는 원화 정규화 금액”으로 둔다.

파일 다건 업로드는 부분 성공을 유지할지, 하나라도 실패하면 전체 실패로 할지 결정한다. 사용자 경험상 부분 성공이 필요하면 파일 1건당 독립 트랜잭션으로 커밋 결과와 응답을 일치시킨다.

### 4.2 W1: 보안·캐시 정합성

Refresh Token 조회는 원문 JWT 대신 SHA-256 해시 기준으로 바꾼다. 새 nullable 컬럼을 추가하고 기존 활성 토큰은 첫 refresh 또는 로그인 시 해시를 채우는 점진 전환을 기본으로 한다. 전환 완료 후에는 해시 UNIQUE 인덱스를 기준 조회 경로로 사용한다. 원문 컬럼은 즉시 제거하지 않고 호환 기간을 둔다.

Tiptap metadata 캐시는 별도 key resolver를 둔다. 관리자·부서매니저는 `ALL`, 부서코드가 있는 일반 사용자는 `DEPT:{bbrC}`, 부서코드가 없는 일반 사용자는 `USER_NO_DEPT:{eno}`로 격리한다. 부서코드가 없는 사용자는 전체 사업을 보여주지 않고 빈 사업 목록을 반환한다.

### 4.3 W2: 사용자 영향 에러 처리

DUP 코드 조회 실패는 예산 계산의 전제 실패로 다룬다. `dupCodesLoaded`와 별개로 `dupCodesError`를 두고, 계산·저장 버튼을 비활성화하며 재시도 액션을 제공한다.

HWPX 이미지 처리는 성공 이미지와 실패 이미지 목록을 함께 반환하는 구조로 바꾼다. 내보내기 호출자는 실패 목록이 있으면 다운로드 전에 경고하거나, 다운로드 후 누락 목록을 표시한다. 완전 실패와 부분 실패는 구분한다.

감사로그 리플렉션 실패는 업무 저장을 막지 않는 현행 정책을 유지한다. 대신 필드명, 대상 클래스, 예외 메시지를 warn 로그로 남긴다. 실제 값이 null인 경우에는 warn을 남기지 않는다.

### 4.4 W3: 프론트 API 연결·타입 정리

예산 조회/비교 화면은 `MOCK_ROWS`, `MOCK_FSS_ROWS`, `MOCK_YOY_ROWS`를 제거하고 `useItBudget().fetchSummary`, `fetchComparison` 결과를 computed로 변환한다. 로딩, 오류, 빈 상태를 화면에서 구분한다.

`useProjects`에는 최소 요청 DTO를 추가하고, `useTabs`는 `RouteLocationNormalizedLoaded` 전체 대신 `path`, `fullPath`, `meta.title`만 받는 좁은 입력 타입을 둔다. 오류 처리에서는 `catch (e: unknown)`과 공통 `formatApiError`를 사용한다.

파일 크기·금액 표시 중복은 `utils/common.ts`를 기준으로 통합한다. `0`을 빈 값으로 볼지 실제 `0`으로 표시할지는 화면별 업무 의미를 확인해 명시한다.

### 4.5 W4: 백엔드 테스트·계약 보강

파일 업로드 부분 성공 계약이 확정되면 서비스 경계를 맞춘다. 부분 성공 유지 시 개별 파일 저장을 `REQUIRES_NEW` 또는 별도 내부 서비스로 분리해 rollback-only 전파를 차단한다. 전체 실패 정책이면 첫 실패에서 예외를 전파하고 성공 목록 응답을 제거한다.

통합 테스트는 이미 존재하는 `AbstractOracleRepositoryTest`를 재사용한다. 우선순위는 감사로그 리스너, `EstimateRepositoryImpl.search()`, `CinfmmRepositoryImpl` 순서다. DB 미가동 시 스킵되는 로컬 전용 테스트와 기본 `./gradlew test` 경계를 유지한다.

---

## 5. 테스트 전략

| 영역 | 테스트 |
| --- | --- |
| Refresh Token | 해시 생성, 해시 조회, 기존 원문 토큰 호환, 중복 해시 방지, 회전 재사용 탐지 |
| Tiptap metadata | 관리자 `ALL`, 일반 사용자 `DEPT:{bbrC}`, 부서 없음 `USER_NO_DEPT:{eno}`, 캐시 키 null 미발생 |
| DUP 코드 실패 | API 실패 시 저장 차단, 재시도 성공 시 계산 재개 |
| HWPX 이미지 | 전체 성공, 일부 실패, 전체 실패, 실패 목록 UI 전달 |
| 예산 조회/비교 | API 응답 변환, 로딩/오류/빈 상태, Mock 상수 제거 |
| 파일 업로드 | 부분 성공 또는 전체 실패 계약에 맞는 커밋 결과 검증 |
| Oracle 통합 테스트 | 감사로그 리스너, Estimate QueryDSL 조건, Cinfmm 조회 정합성 |

---

## 6. 범위 밖

- 공통 게시판 Oracle Text, Redis 조회수, SSE/WebSocket 전환은 이번 Wave에 포함하지 않는다.
- `info/index.vue` 운영 데이터 전환은 백엔드 API 스펙이 먼저 필요하므로 별도 기능 설계로 분리한다.
- Javadoc 잔여 1,107건은 기능 안정화와 별도 문서 품질 작업으로 분리한다.
- DB/JPA P4 인덱스와 작성자 소속 컬럼의 dev/prod 적용 추적은 `ITPOWN_DDL_live.sql` 확인 기준으로 완료 처리한다.

---

## 7. 완료 기준

- 각 Wave는 변경 파일, 테스트 결과, `TASK.md`/`TASK_DONE.md` 이관 근거를 남긴다.
- 코드 변경 Wave는 관련 단위 테스트를 먼저 추가하고, 구현 후 최소 게이트를 통과해야 한다.
- 적용 확인 완료 항목은 `ITPOWN_DDL_live.sql` 근거와 함께 `TASK_DONE.md`로 이관한다.
- 결정 선행 항목은 결정 내용이 문서화되기 전 구현하지 않는다.
