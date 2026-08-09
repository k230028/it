# Remaining Non-DDL API Contracts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DDL 없이 실행 가능한 잔여 과제인 FE-15 수동 API 타입 전환과 BE-03 읽기 프로젝션을 완료하고, 운영 증거가 필요한 항목만 활성 과제로 남긴다.

**Architecture:** 백엔드 응답 DTO의 required·nullable·enum OpenAPI 계약을 먼저 고정하고 생성 스키마를 갱신한 다음, 프론트 수동 미러 타입을 `components['schemas']` 기반 alias로 교체한다. 화면 편집 상태는 생성 요청/응답 타입과 분리하며, BE-03은 쓰기 엔티티를 유지하고 읽기 경로만 projection으로 바꾼다.

**Tech Stack:** Java 21 / Spring Boot / springdoc-openapi / JUnit 5 / Oracle integration tests / Nuxt 4 / TypeScript / openapi-typescript / Vitest

## Global Constraints

- `it_database`와 DDL은 수정하지 않는다.
- 기존 API URL·HTTP method·JSON 필드명은 유지한다.
- 백엔드 계약 테스트는 누락된 required·nullable·enum 때문에 RED가 난 뒤 애노테이션으로 GREEN이 되어야 한다.
- 프론트 생성물은 `npm run codegen`으로만 갱신하고 `npm run codegen:check`로 재현성을 확인한다.
- 루트 `TASK.md`의 사용자 BRD/EAI 변경과 `it_backend/graphify-out/`은 스테이징하지 않는다.

---

### Task 1: FE-15 응답 계약 공통 테스트와 단순 도메인 전환

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/architecture/ApiResponseOpenApiContractTest.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/dto/AuthDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/bizplan/dto/BizplanDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/dto/ContractDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/dto/DeliberationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/dto/PaymentDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dto/NotificationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/system/tiptap/dto/TiptapVariableDto.java`
- Modify: `it_frontend/app/types/auth.ts`
- Modify: `it_frontend/app/types/bizplan.ts`
- Modify: `it_frontend/app/types/contract.ts`
- Modify: `it_frontend/app/types/deliberation.ts`
- Modify: `it_frontend/app/types/estimate.ts`
- Modify: `it_frontend/app/types/payment.ts`
- Modify: `it_frontend/app/types/notification.ts`
- Modify: `it_frontend/app/types/tiptapVariable.ts`
- Modify generated: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: springdoc `@Schema(requiredMode = REQUIRED, nullable = true, allowableValues = {...})`
- Produces: 기존 공개 타입 이름을 유지하는 생성 스키마 alias

- [x] **Step 1: RED 계약 테스트를 작성한다.** `ModelConverters.getInstance().readAllAsResolvedSchema(...)`로 각 응답 schema의 required 집합과 nullable 필드를 확인한다. 예를 들어 `BizplanDetail`은 `abusMngNo`·`stsTc`·`schedules`·`items`·`contracts`를 포함한 모든 응답 필드가 required이고, `abusNm`·`bgNo`·`totRqmAmt`·`itPtlEdrtTc`·`redtConeInf`는 nullable이어야 한다.
- [x] **Step 2: `./gradlew test --tests '*ApiResponseOpenApiContractTest'`를 실행해 required 누락으로 실패하는지 확인한다.**
- [x] **Step 3: 응답 record/class 필드에 required·nullable·enum을 명시한다.** 요청 DTO의 선택 필드는 변경하지 않는다.
- [x] **Step 4: 계약 테스트를 재실행해 GREEN을 확인한다.**
- [x] **Step 5: 백엔드를 기동해 `npm run codegen`을 실행한다.** 생성 타입에서 응답 필드의 `?`와 nullable 간극이 사라졌는지 타입검사로 확인한다.
- [x] **Step 6: 수동 미러를 다음 형태로 교체한다.**

```ts
import type { components } from '~/types/api';
export type BizplanDetail = components['schemas']['BizplanDetail'];
export type EstimateListItem = components['schemas']['EstimateListItem'];
export type NotificationItem = components['schemas']['NotificationItem'];
```

UI 전용 상수와 `ClientStatus`, `ResolvedValue` 같은 화면 상태 타입은 그대로 유지한다.
- [x] **Step 7: 관련 Vitest, `npm run check`, `npm run codegen:check`를 실행하고 백엔드·프론트를 별도 커밋한다.**

### Task 2: FE-15 예산·게시판 계약 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardMetaDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardPostDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/dto/BoardCommentDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/dto/BudgetWorkDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/status/dto/BudgetStatusDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/it/dto/ItBudgetDto.java`
- Modify: `it_frontend/app/types/board.ts`
- Modify: `it_frontend/app/types/budget-work.ts`
- Modify: `it_frontend/app/types/budgetStatus.ts`
- Modify: `it_frontend/app/types/itBudget.ts`
- Modify generated: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: Task 1의 OpenAPI 계약 테스트 helper와 생성 타입 alias 패턴
- Produces: 게시판/예산 API 타입은 생성 스키마, `TargetItem`·`SummaryDisplayRow`는 UI 전용 타입으로 분리

- [x] **Step 1: 게시판과 예산 응답 schema의 required·nullable·Y/N enum 기대값을 계약 테스트에 추가하고 RED를 확인한다.**
- [x] **Step 2: 응답 DTO 애노테이션을 보강하고 GREEN을 확인한다.**
- [x] **Step 3: codegen 후 API 미러 타입만 alias로 교체한다.** `BoardPostCreateWithAttachmentsResult`, `BoardPostSearchCondition`, `TargetItem`, `SummaryDisplayRow`는 서버 schema가 아닌 UI/워크플로 타입이므로 유지한다.
- [x] **Step 4: 게시판·예산 단위 테스트와 프론트 전체 타입검사를 실행해 별도 커밋한다.**

### Task 3: FE-15 협의회·요구사항·결재·Cost 경계 전환

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/council/dto/CouncilDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ServiceRequestDocDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/dto/ApplicationInfoDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java`
- Modify: `it_frontend/app/types/council.ts`
- Modify: `it_frontend/app/composables/useDocuments.ts`
- Modify: `it_frontend/app/composables/useDocumentDashboard.ts`
- Modify: `it_frontend/app/composables/useApprovals.ts`
- Modify: `it_frontend/app/composables/useApprovalDashboard.ts`
- Modify: `it_frontend/app/composables/useCost.ts`
- Create: `it_frontend/app/types/cost-editor.ts`
- Modify generated: `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: Task 1의 alias 패턴
- Produces: API 응답 `ItCostResponse = components['schemas']['CostDto.Response']`, 편집 입력 `EditableCost`와 `EditableTerminal` 분리

- [x] **Step 1: 협의회·문서·결재·Cost 응답 계약 테스트를 추가하고 RED를 확인한다.**
- [x] **Step 2: DTO 계약을 보강하고 GREEN을 확인한다.**
- [x] **Step 3: 수동 응답 미러를 생성 alias로 교체한다.**
- [x] **Step 4: Cost 화면이 필요로 하는 `Date` 허용과 신규행 필수값은 다음 UI 모델로 분리한다.**

```ts
export type EditableCost = Omit<CostResponse, 'fstDfrDt' | 'xcrBseDt' | 'terminals'> & {
  fstDfrDt: string | Date;
  xcrBseDt?: string | Date;
  terminals?: EditableTerminal[];
};
```

- [x] **Step 5: 관련 테스트, `npm run check`, 전체 `npm test`를 실행하고 커밋한다.**

### Task 4: BE-03 BBUGTM·ProjectKeyView·알림함 읽기 프로젝션

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BudgetReadView.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetRepresentativeSelector.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/project/repository/ProjectRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/notification/repository/NotificationInboxRow.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryCustom.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/service/NotificationService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/work/repository/BudgetReadProjectionIt.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/repository/NotificationInboxProjectionIt.java`

**Interfaces:**
- Consumes: BE-17의 최신 `bgNo DESC, sno DESC` 대표행 정책
- Produces: 쓰기 엔티티와 분리된 최소 읽기 view

- [x] **Step 1: 엔티티 조회와 projection의 필드·정렬·페이지 합계 동등성 통합 테스트를 작성하고 신규 메서드 부재 RED를 확인한다.**
- [x] **Step 2: `BudgetReadView` 7개 getter와 `ProjectKeyView(abusMngNo, abusNm)`, `NotificationInboxRow` 8개 필드를 구현한다.**
- [x] **Step 3: 예산 요약 3개 조회 경로와 알림함 조회만 projection으로 바꾸고 쓰기 경로는 엔티티로 유지한다.**
- [x] **Step 4: 서비스 단위 테스트와 Oracle 통합 테스트를 실행하고 예산·알림을 별도 커밋한다.**

### Task 5: 문서 이관과 최종 검증

**Files:**
- Modify synthetic index only: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`

**Interfaces:**
- Consumes: Tasks 1~4 커밋과 검증 출력
- Produces: FE-15 완료 이관, BE-03은 운영 증거 의존 잔여만 활성 유지

- [x] **Step 1: 백엔드 `./gradlew check`와 프론트 `npm test`, `npm run check`, `npm run format:check`, `npm run codegen:check`를 실행한다.**
- [x] **Step 2: `it_database` 무변경과 각 저장소 작업 트리를 확인한다.**
- [x] **Step 3: FE-15를 `TASK_DONE.md`로 옮기고 BE-03에는 AWR/Project·Cost 계약 분리 외부 게이트만 남긴다.**
- [x] **Step 4: 사용자 `TASK.md` 변경을 synthetic staging으로 보존하면서 문서와 `versions.lock`을 커밋한다.**
