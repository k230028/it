# 설계안: 소유권/권한 검증 하드닝 (Authorization Hardening)

> 🗓️ 작성일: 2026-06-22
> 🎯 출처: `TASK.md` 🔒 보안 클러스터 분석
> 📦 산출물: 본 spec → 구현 계획(writing-plans) → 구현
> 🔗 상위 로드맵: [`2026-06-22-backend-improvement-roadmap-design.md`](2026-06-22-backend-improvement-roadmap-design.md) 의 **T1(공통 OwnershipVerifier)** + **T3(bbrC 서버검증 중 대시보드)** 슬라이스를 **구현 즉시 착수 가능한 상세 수준**으로 확장한 문서. 로드맵은 테마 묶음(굵은 선), 본 spec은 메서드·시그니처·테스트케이스 수준의 실행본.

---

## 1. 목적 및 배경

인증된 임의 사용자가 타인·타부서 리소스를 수정·삭제·조회할 수 있는 **수평적 권한 상승(horizontal privilege escalation) 및 데이터 노출** 취약점을 닫는다.

핵심 사실:
- 공통 유틸 **`OwnershipVerifier`(`common/system/security`)는 이미 존재**하며 실패 시 `AccessDeniedException`(403)을 던진다. `GlobalExceptionHandler`가 403으로 매핑한다.
- **`FileOwnershipChecker.checkReadAccess()` / `checkOwnership()`도 이미 구현**되어 있다(단건 삭제에만 연결됨).

따라서 본 작업은 **신규 인프라 구축이 아니라 기존 유틸을 누락된 호출 지점에 연결(wiring)하고 예외 규약을 표준화**하는 작업이다.

## 2. 범위

### 2.1 포함 (TASK.md 항목 매핑)

| # | 항목 | 근거 위치 | TASK 우선순위 |
|---|---|---|---|
| 1 | 집행 4단계(Estimate/Deliberation/Contract/Payment) write 메서드 소유권 검증 | `EstimateService.java:82`, `DeliberationService.java:86`, `ContractService.java:86`, `PaymentService.java:93` | 🟠 High |
| 2 | 요구사항정의서 create/newVersion/update/delete 소유권 검증 (principal 추가) | `ServiceRequestDocController.java:113,130,145,166`, `ServiceRequestDocService.java:190` | 🟠 High |
| 3 | FileController download/preview/getFile/getFiles → `checkReadAccess()` | `FileController.java:62,69,167,191` | 🟠 High |
| 4 | FileController updateFileMeta/deleteFilesByOrc → 소유권/관리자 검증 | `FileController.java:127,153` | 🟠 High |
| 5 | documents/dashboard·badge-count → 클라이언트 bbrC 대신 JWT 클레임/`isAdmin()` 기준 | `ServiceRequestDocController.java:183,197` | 🟡 Medium |
| 6 | BoardPostService/BoardCommentService 403 표준화(`OwnershipVerifier.verifyOwnerOrAdmin`) | `BoardPostService`/`BoardCommentService` | 🟡 Medium |
| 7 | CLAUDE.md §5.18에 `OwnershipVerifier`를 소유권 검증 표준 수단으로 명시 | `it_backend/CLAUDE.md §5.18` | 🟢 Low |
| 8 | 완료 항목 TASK.md → TASK_DONE.md 이관 | `TASK.md`, `TASK_DONE.md` | — |

### 2.2 제외 (별도 spec으로 분리)

- **bbrC 리포지토리 필터(Contract/Deliberation/Payment)** — `ContractRepositoryImpl.java:47` 등. 대상이 2종(정보화사업/전산업무비)이라 단일 JOIN이 곤란. **주관부서코드 컬럼 추가(스키마 마이그레이션) vs 대상 테이블 JOIN** 설계 결정이 선행되어야 하므로 본 계획에 포함하지 않는다. (로드맵 T3의 리포지토리 필터 부분)
- **집행 4단계 `changeStatus` 역할별 전이 권한 분기** — `EstimateService.java:115` 외. "제출=본인/관리자, 완료=관리자/작업자" 같은 **업무 규칙 확정이 선행**되어야 한다. 본 계획에서는 소유자/관리자 기본 검증만 적용하고, 세부 역할 분기는 제외한다.

> 참고: 로드맵 T1에 함께 묶인 `QnaService ROLE_ITPAD001 → isAdmin()` 교정은 본 spec 범위에 추가 가능한 소규모 항목 — Phase 4에서 함께 처리 검토(구현 계획 단계에서 확정).

## 3. 공통 접근

- **쓰기 경로(수정·삭제·상태전이·상세저장)**: 상태/존재 검증 **이전에** 다음을 호출한다.
  ```java
  OwnershipVerifier.verifyOwnerOrAdmin(entity.getFstEnrUsid(), user);
  ```
  실패 시 `AccessDeniedException`(403). 검증 순서를 "소유권 → 상태"로 두어 권한 없는 사용자에게 상태 정보가 새지 않도록 한다.
- **파일 읽기 경로**: service 호출 전에 다음을 삽입한다.
  ```java
  fileOwnershipChecker.checkReadAccess(flMpnId, userDetails);
  ```
  비-게시판(`PK_COL_NM != "공통게시판"`) 파일은 기존 정책상 읽기 허용 → 회귀 없음.
- **파일 메타수정/일괄삭제**: `checkOwnership(flMpnId, eno)` 또는 일괄삭제는 대상 레코드 소유자/관리자 기준 검증.
- **bbrC 대시보드**: 비관리자는 요청 파라미터 `bbrC`를 **무시**하고 `user.getBbrC()`로 강제한다. 관리자(`isAdmin()`)만 임의 `bbrC` 조회를 허용한다.

## 4. 단계별 설계 (위험도·의존성 순)

### Phase 1 — 집행 4단계 소유권 검증 (High)
- 대상: `EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`의 `update`/`delete`/`changeStatus`/`saveLines`·`saveResult`·`saveContract`·`savePayments`.
- 이미 `CustomUserDetails user` 파라미터를 보유 → `loadCurrent()` 직후 `verifyOwnerOrAdmin(e.getFstEnrUsid(), user)` 라인만 추가.
- 가장 적은 변경으로 최대 보안 이득 → 최우선.

### Phase 2 — 요구사항정의서 소유권 검증 (High)
- 컨트롤러 4개 메서드(`createDocument`/`createNewVersion`/`updateDocument`/`deleteDocument`)에 `@AuthenticationPrincipal CustomUserDetails user` 파라미터 추가.
- 서비스로 전달 → 수정·삭제·새버전은 최신 버전 소유자(`FST_ENR_USID`) 기준 검증. 생성은 소유권 검증 대상이 아니나 작성자 기록을 위해 principal 사용.
- **시그니처 변경 포함** → MockMvc 컨트롤러 테스트에 principal 주입 필요.

### Phase 3 — 파일 권한 (High)
- 읽기 4개 경로(`getFiles`/`getFile`/`downloadFile`/`previewFile`)에 `@AuthenticationPrincipal` 추가 후 `checkReadAccess` 연결.
  - 목록 조회(`getFiles`)는 결과 항목별 검증 또는 조건 검증 방식 결정 — 구현 계획에서 상세화.
- `updateFileMeta` → `checkOwnership`, `deleteFilesByOrc` → 대상 소유자/관리자 검증 추가.

### Phase 4 — bbrC 대시보드 + 403 표준화 + 문서 (Medium/Low)
- `getDashboard`/`getBadgeCount`에 `@AuthenticationPrincipal` 추가, 서버측 bbrC 강제.
- `BoardPostService`/`BoardCommentService`의 본인 게시물·댓글 수정/삭제 실패를 `CustomGeneralException`(400) → `OwnershipVerifier.verifyOwnerOrAdmin`(403)로 통일.
- `it_backend/CLAUDE.md §5.18` 보안 규칙에 `OwnershipVerifier` 표준 수단 명시.
- 완료 항목을 `TASK.md` → `TASK_DONE.md`로 이관.

## 5. 에러 / 응답 계약

| 상황 | 예외 | HTTP |
|---|---|---|
| 본인/관리자 아님 | `AccessDeniedException` | 403 Forbidden |
| 인증 정보 없음(principal null) | `AccessDeniedException` | 403 |
| 대상 리소스 없음 | 기존 도메인 예외 유지 | 400/404 (현행 유지) |

- 검증 순서: **소유권(403) → 상태/존재**. 권한 없는 사용자에게 리소스 상태가 노출되지 않도록 한다.

## 6. 테스트 전략 (TDD — CLAUDE.md §5.9 의무)

- 각 쓰기/읽기 경로마다 3케이스:
  - (a) 소유자 → 성공
  - (b) 관리자(`isAdmin()=true`) → 성공
  - (c) 타인 → `AccessDeniedException`(403)
- bbrC 대시보드: 비관리자가 타부서 bbrC 요청 시 본인 부서로 강제되는지 검증.
- 기존 테스트 스텁 영향 점검(TASK.md 백엔드 리팩토링 후속 항목 — `CostServiceTest`, `BudgetWorkServiceTest`).
- 변경 후 `./gradlew test`, 보안 공통 영향이므로 `./gradlew clean test` 재검증.

## 7. 리스크

- **시그니처 변경(Phase 2/3/4)**: 컨트롤러 테스트(MockMvc)에 `@AuthenticationPrincipal` 주입 필요. `@WithMockUser` 또는 커스텀 principal 설정.
- **읽기권한 회귀(Phase 3)**: Tiptap 이미지 `previewFile`이 httpOnly 쿠키로 호출됨. 비-게시판 파일은 기존처럼 허용되므로 회귀 없음을 테스트로 확정.
- **bbrC 강제(Phase 4)**: 프론트가 보내던 `bbrC`가 비관리자에서 무시되므로 기존 화면 동작 동일성(본인 부서 데이터) 검증 필요.
- **목록 조회(`getFiles`) 권한 모델**: 항목별 `checkReadAccess`는 N건 반복 호출이 될 수 있음 → 구현 계획에서 성능·정책 상세화.

## 8. 분리된 후속 (별도 spec 예정)

- **bbrC 리포지토리 필터 spec**: Contract/Deliberation/Payment 목록의 부서 필터. 스키마(주관부서코드 컬럼 추가) vs 대상 테이블 JOIN 결정 포함. (`TASK.md` 🟠 High 유지, 로드맵 T3)
- **changeStatus 역할 전이 권한 spec**: 업무 규칙 확정 후 서비스 계층 role 분기. (`TASK.md` 🟡 Medium 유지)
