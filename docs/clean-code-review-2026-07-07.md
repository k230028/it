# IT Project Portal — 『Clean Code』 기준 코드 품질 진단 보고서

- **최초 진단일**: 2026-07-07
- **재점검·현행화일**: 2026-07-26
- **기준**: 로버트 마틴(Robert C. Martin) 『Clean Code』
- **범위**: it_backend (Spring Boot), it_frontend (Nuxt 4 / Vue·TS)
- **방법**: (최초) 백엔드·프론트·테스트/아키텍처 3개 리뷰 에이전트 병렬 진단 + CRITICAL 직접 교차 검증. (재점검) 지적사항 전건을 현재 코드에 대해 3개 병렬 검증 에이전트 + 직접 스팟 확인으로 대조.

> **재점검 요지**: 최초 진단의 즉시조치(§5 1순위) 항목은 **전부 해소**되었다. 실사용자 영향 CRITICAL 버그(`ornYn`), 입력검증 공백(`@Valid` 6곳), API 규약 위반(`createCost` 201), RBAC 중복(`validateModifyPermission`), 환율 이원화(BE-04)가 모두 반영됐고, 타입 우회(`any`+`eslint-disable`)는 **184건 → 3건**으로 급감했다. 남은 최대 부채는 여전히 **핵심 도메인 서비스의 비대함**이며, 일부(ProjectService·CouncilController·CostService)는 오히려 라인이 증가했다.

---

## 0. 재점검 요약 (2026-07-26)

| # | 항목 | 최초(07-07) | 현재(07-26) | 상태 |
|---|------|------|------|------|
| 1 | `ornYn`→`odnYn` 필드 버그 (프론트 3곳) | CRITICAL | 3곳 전부 수정 | ✅ 해소 |
| 2 | mutating 엔드포인트 `@Valid` 누락 6곳 | 결함 | 6곳 전부 추가 | ✅ 해소 |
| 3 | `CostController.createCost` 200 반환 | 규약위반 | 201 Created + Location | ✅ 해소 |
| 4 | `validateModifyPermission` 100% 중복 | 보안회귀 위험 | `OwnershipVerifier`로 통합(+단위테스트) | ✅ 해소 |
| 5 | 환율 환산 규칙 이원화 (BE-04) | 정합성 리스크 | `BITEMM.amt`=KRW 직접 합산으로 통일 | ✅ 해소 |
| 6 | `any`+`eslint-disable` 프로덕션 우회 | 48파일·184건 | **2파일·3건** | ✅ 대폭 개선 |
| 7 | `form.vue` `executeSave` God 함수 | ~115줄 인라인 | `useProjectFormSave.ts`로 추출 | ✅ 해소 |
| 8 | `useCostListPage.ts` God composable | 1,790줄 | 358줄(헬퍼 분리) | ✅ 해소 |
| 9 | BudgetWorkService 기본 편성률 `100` 리터럴 | 매직넘버 | `DEFAULT_DUP_RT`/`PERCENT_BASE` 상수화 | ✅ 해소 |
| 10 | BE-02 리포지토리 통합테스트 공백 | 자인 부채 | `CinfmmRepositoryImplTest` 등 추가 | ✅ 해소 |
| 11 | `usePdfReport.generateReport` ~1,100줄 함수 | God 함수 | 파일 이관·헬퍼 분리, 함수 ~595줄 잔존 | 🟡 부분 |
| 12 | `Bitemm.builder()` 20필드 블록 반복 | ProjectService 3곳 | 2곳으로 감소(여전히 반복) | 🟡 부분 |
| 13 | `SsoAgentClient` 성공 로그 INFO+사용자데이터 | 잠재 PII | 변화 없음(line 124~128) | ⚠️ 잔존 |
| 14 | `Bcostm.update` 매개변수 20개 | 인자혼동 위험 | 20개 유지, `UpdateCommand` 미도입 | ⚠️ 잔존 |
| 15 | `ProjectService.updateProject` 비대 | ~150줄 | **~214줄로 증가** | ⚠️ 악화 |
| 16 | 대형 서비스 God Class | ProjectService 1,178 등 | ProjectService 1,350·CouncilController 1,215 등 **증가** | ⚠️ 악화 |
| 17 | 대형 테스트 파일(`useCostListPage.test.ts`) | 단일 describe·it 99 | 단일 describe·**it 101**(2,140줄) | ⚠️ 잔존 |
| 18 | IOE 자본예산 분류 리터럴 재정의 | `[id].vue:76` | `[id].vue:121`로 이동, 여전히 로컬 재정의 | ⚠️ 잔존 |

---

## 1. 종합 평가 (재점검 반영)

| 영역 | 최초 | 현재 | 한 줄 요약 |
|------|------|------|-----------|
| 백엔드 (Spring Boot) | 3.6 | **3.8** | 정확성·입력검증·RBAC 중복 등 결함 다수 해소. 다만 핵심 서비스 라인은 오히려 증가 |
| 프론트엔드 (Nuxt 4) | 3.5 | **4.2** | CRITICAL 버그·`any` 우회·God composable가 대거 해소되어 구조적 위험 크게 완화 |
| 테스트 품질 | 3.5 | **3.7** | BE-02 리포지토리 통합테스트 보강. 대형 단일 테스트 파일은 잔존 |
| 아키텍처 경계 | 3.0 | **3.1** | God Class가 여전히 최대 부채이며 일부 클래스는 라인 증가 |

**결론**: 최초 진단이 "즉시 저비용·고효과"로 분류한 실사용자 영향 결함과 재발 구조(타입 우회)는 **성공적으로 정리**되었다. 위생 지표(죽은 코드 0, `System.out`/`printStackTrace` 0, 생성자 주입 100%, `v-html` DOMPurify)는 상위권을 유지하고, `console.log`도 실코드 0건이다. 반면 **SRP 위반(대형 서비스)** 은 분해가 진행되지 않았을 뿐 아니라 기능 추가로 `ProjectService`(1,350)·`CouncilController`(1,215)·`CostService`(1,046)가 커졌다. 남은 로드맵의 무게중심은 이제 명확히 **God Class 분해**로 이동했다.

---

## 2. 진단 중 발견한 실제 버그 (CRITICAL) — ✅ 해소 완료

**`ornYn`/`odnYn` 필드명 불일치** — 최초 진단이 지적한 프론트 3곳이 **전부 수정**됨:

| 위치 | 최초 증상 | 현재 |
|------|-----------|------|
| `pages/info/projects/[id].vue` | `(project.value as any)?.ornYn`로 경상판정 항상 false | `[id].vue:124-125` `project.value?.odnYn === 'Y'` (주석: "서버 응답 필드 odnYn 기준") |
| `composables/usePdfReport.ts:843` | PDF에서 경상사업이 항상 "[정보화사업]" | 파일 이관 후 `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`·`pdf/projectSection.ts:52` `project.odnYn === 'Y'` |
| `pages/info/projects/index.vue:441,449,451` | 목록 배지 항상 '정보화'(raw는 `odnYn`) | `field="odnYn"`/`slotProps.data.odnYn`로 정정 |

- 잔존 `ornYn`은 전부 로컬 폼 필드/명시 매핑(`projectFormModel.ts:44`, `useProjectFormSave.ts:177` `odnYn: f.ornYn`, `useProjectFormLoad.ts:192` `ornYn: project.odnYn` 등)으로 정상.
- **신규 관찰(경미)**: `useContinueProjectSearch.ts:99`는 조회 쿼리 파라미터로 `ornYn:'N'`을 전송하는데, 다른 호출부는 `odnYn:'N'`을 사용한다. 리뷰가 지적한 read-bug와는 별개이나 잠재적 필터 불일치이므로 한 번 확인을 권장.

**의미**: `as any`+`eslint-disable`이 은닉했던 버그였고, 그 우회 관행 자체가 §3.5대로 **184건 → 3건**으로 정리되어 재발 구조도 함께 축소됐다.

---

## 3. Clean Code 원칙별 진단 (현행화)

### 3.1 함수 (3장) — 부분 개선

- ✅ `form.vue` `executeSave`(구 873~989행, ~115줄): 제거되고 `features/project/useProjectFormSave.ts`의 `saveProject`로 추출(`form.vue:348,511`).
- 🟡 `usePdfReport.ts` `generateReport`(구 ~1,100줄): 파일 자체가 삭제되고 `features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts`로 이관, `pdf/`(textPrimitives·projectSection·compat)로 헬퍼가 분리됨. 다만 `generateReport`는 여전히 단일 함수 **~595줄**(61~656행)로 남아 추가 분해 여지가 있음.
- ⚠️ `ProjectService.java` `updateProject`(구 ~150줄): `Bprojm.UpdateCommand` record를 도입해 엔티티 갱신부는 개선됐으나, 품목 CUD 동기화 로직이 인라인으로 커지면서 **~214줄(387~600행)로 오히려 증가**.
- ⚠️ `Bcostm.java` `update`: **여전히 매개변수 20개**(String 17 + BigDecimal 3, 185~205행). `Bprojm`에는 `UpdateCommand` record가 도입됐으나 `Bcostm`은 미적용 — 선례가 있는데도 이전 지적이 그대로.

### 3.2 클래스/모듈, SRP (10장) — 최대 잔여 부채, 일부 악화

**프론트 대형 파일 (개선 뚜렷)**

| 파일 | 최초 | 현재 | 비고 |
|------|------|------|------|
| `pages/info/projects/form.vue` | 2,149 | **1,158** | 저장 로직 composable 추출 |
| `pages/info/plan/[id].vue` | 2,078 | **1,185** | |
| `composables/useCostListPage.ts` | 1,790 | **358** | `costListPageHelpers.ts` 등으로 분리 ✅ |
| `composables/usePdfReport.ts` | (대형) | **삭제** | feature 단위로 재배치 |

**백엔드 대형 서비스 (분해 미진행, 라인 증가)**

| 파일 | 최초 | 현재 | 비고 |
|------|------|------|------|
| `project/service/ProjectService.java` | 1,178 | **1,350** | ⚠️ 증가 |
| `council/controller/CouncilController.java` | 976 | **1,215** | ⚠️ 증가, 서비스 다수 주입 구조 유지 |
| `cost/service/CostService.java` | 958 | **1,046** | ⚠️ 증가 |
| `work/service/BudgetWorkService.java` | 1,035 | **1,016** | 소폭 감소 |

**테스트 비대화 — 잔존**: 소스 `useCostListPage.ts`는 358줄로 쪼개졌으나, `useCostListPage.test.ts`는 **여전히 2,140줄·단일 describe·it() 101개**(최초 99개보다 오히려 증가). 소스 분해가 테스트 구조 정리로 이어지지 않았다. `useCouncil.test.ts`(describe 18개)의 사내 모범 사례를 이 파일에도 적용 필요.

### 3.3 중복 (DRY) — 대부분 해소

- ✅ **[보안 위험 중복 해소]** `validateModifyPermission`(구 `ProjectService:1149`·`CostService:939`)는 제거되고 공통 유틸 `common/system/security/OwnershipVerifier.verifyModifiable(...)`로 통합. `ProjectService`(401,745)·`CostService`(297,520)가 이를 호출하며 `OwnershipVerifierTest`로 검증됨.
- ✅ **환율 환산 규칙 단일화(BE-04)**: `BITEMM.amt`는 KRW 금액으로 직접 합산하도록 통일(TASK_DONE.md BE-04, `c2aa574..d407430`). 서비스 간 이원화 리스크 해소.
- 🟡 `Bitemm.builder()` 20필드 블록: `ProjectService` 내 반복이 3곳 → **2곳**으로 감소(여전히 반복). 빌더 공통화 여지 잔존.
- ⚠️ 프론트 IOE 자본예산 분류: 공유 헬퍼(`ioeCategoryHelpers.ts`)가 있는데도 `projects/[id].vue:121`에 `isCapitalIoeType`가 로컬로 재정의됨(위치만 구 76행 → 121행으로 이동). 미통합.

### 3.4 오류 처리 (7장) — ✅ 지적 결함 해소

- ✅ **mutating 엔드포인트 `@Valid` 6곳 전부 추가**:
  - `CostController.java:196` `createCost` — `@Valid @RequestBody CostDto.CreateRequest`
  - `AdminBoardMetaController.java:36` `create`
  - `GuideDocController.java:85` `createDocument`
  - `ServiceRequestDocController.java:103` `createDocument`
  - `BoardCommentController.java:53` `create`
  - `AdminMenuController.java:104` `move`
- ✅ `CostController.createCost`가 `ResponseEntity.created(URI.create("/api/cost/"+itMngcNo))`로 **201 Created + Location** 반환(Swagger `responseCode="201"`).
- 백엔드 `catch(Exception)`의 로깅+재throw/의도적 격리 원칙은 유지(예외 삼킴 없음).

### 3.5 타입 안전 (2장/17장) — ✅ 대폭 개선

- `any`+`eslint-disable-next-line @typescript-eslint/no-explicit-any` 조합이 프로덕션 **48파일·184건 → 2파일·3건**으로 급감: `composables/useApiFetch.ts:209`, `composables/costList/useCostExcelTransfer.ts:147,153`뿐.
- `eslint.config.mjs`의 "테스트 파일에만 완화" 취지가 실제로 준수되는 상태에 근접. §2 CRITICAL 버그의 재발 토양이 사실상 제거됨.

### 3.6 단위 테스트 (9장)

**강점(유지)**
- 커버리지 게이트 실존·강제: jacoco 클래스별 LINE/BRANCH/COMPLEXITY, `vitest.config.ts` lines 임계값.
- Given-When-Then·한글 `@DisplayName`·AssertJ 일관. Oracle 미가동 시 자동 skip 하네스.
- 집행 4단계 테스트 충분(ContractServiceTest·DeliberationServiceTest·PaymentServiceTest 등).

**개선/잔존**
- ✅ **BE-02 리포지토리 통합테스트 확대**: `CinfmmRepositoryImplTest` 등 추가(TASK_DONE.md BE-02, `53bc356`)로 QueryDSL 동적 쿼리 검증 공백을 일부 해소.
- ⚠️ 대형 단일 테스트 파일(`useCostListPage.test.ts` 2,140줄) 잔존 — §3.2 참조.

### 3.7 아키텍처 경계 (11장)

- DTO 변환 규율·Controller→Repository 미직결·프론트 API 호출 계층 컨벤션은 최초 진단대로 양호 유지.
- 최대 부채는 여전히 대형 서비스/컨트롤러의 SRP 위반(§3.2).

### 3.8 기타 냄새 (17장)

- ✅ `BudgetWorkService`의 기본 편성률 `100` 리터럴 → `DEFAULT_DUP_RT`(=100)·`PERCENT_BASE`(BigDecimal 100)로 상수화(50~54행).
- ✅ `it_frontend/CLAUDE.md`의 "console.log 제거 대상" 기록은 해소 확인 — 실코드 0건(유일 매치 `useAuth.ts:69`는 JSDoc 예시 주석).
- ⚠️ SSO 토큰 검증 성공 로그가 추출 사용자 데이터를 INFO로 기록(`SsoAgentClient.java:124~128`, `resultData=extractRequestData(user)`) — 변화 없음. 토큰 자체는 `mask()` 처리되나 성공 로그의 사용자 데이터는 INFO 잔존. `requestData` 확장 시 PII 노출 구조.
- Toast `life` 매직 넘버 반복, Java 들여쓰기 혼재/포맷터 미도입은 미확인 항목(별도 재점검 대상).

---

## 4. 강점 요약 (재확인)

- **위생**: 죽은 코드/주석 처리 코드 0건, `@Deprecated` 0건, `System.out`/`printStackTrace` 0건, 프론트 `console.log` 실코드 0건.
- **DI/트랜잭션**: 생성자 주입 100%, 클래스 레벨 `@Transactional(readOnly=true)` + 쓰기 오버라이드 패턴 일관.
- **보안**: Path Traversal 방어, `v-html` DOMPurify, 오픈 리다이렉트 방어, 토큰 마스킹. RBAC 검증은 `OwnershipVerifier`로 단일화되며 강화됨.
- **부채 관리**: TASK/TASK_DONE 추적 체계가 실제로 작동 — BE-02·BE-04·OwnershipVerifier 표준화 등이 Done으로 이관됨(단, `ornYn` 버그·`createCost` 201은 코드로만 반영되고 개별 태스크로는 미기록).

---

## 5. 개선 로드맵 (현행화)

| 순위 | 상태 | 항목 | 비고 |
|------|------|------|------|
| 1 | ✅ 완료 | `ornYn`→`odnYn` 3곳, `@Valid` 6곳, `createCost` 201 | 즉시조치 전건 반영 |
| 2 | ✅ 완료 | `validateModifyPermission`→`OwnershipVerifier` 통합, 환율 규칙 단일화(BE-04) | RBAC·정합성 리스크 해소 |
| 3 | ✅ 대부분 | `any`+`eslint-disable` 184→3건 | 잔여 3건(`useApiFetch`·`useCostExcelTransfer`) 정리 + 리뷰 체크리스트 "any+disable 금지" 상시화 |
| 4 | ⏳ 진행 요망 (최우선) | God Class 분해: `ProjectService`(Query/Command 분리)·`CouncilController`(모듈 경계 분할)·`CostService`. 프론트 `usePdfReport.generateReport` 잔여 분해. **대형 테스트 파일(`useCostListPage.test.ts`) 분리** | 라인이 오히려 증가 중 — 남은 최대 부채 |
| 5 | 🟡 부분 | `Bcostm.UpdateCommand` record 도입, `Bitemm.builder` 공통화(잔여 2곳), `SsoAgentClient` INFO 로깅 하향, IOE 분류 헬퍼 통합, 포맷터/매직넘버 정리 | 예방적 개선 (BE-02는 완료) |

---

## 부록: 주요 참고 파일 (경로 갱신)

**백엔드**
- `it_backend/.../budget/project/service/ProjectService.java` (1,350줄)
- `it_backend/.../budget/cost/service/CostService.java` (1,046줄)
- `it_backend/.../budget/cost/entity/Bcostm.java` (222줄, `update` 20파라미터)
- `it_backend/.../budget/work/service/BudgetWorkService.java` (1,016줄)
- `it_backend/.../council/controller/CouncilController.java` (1,215줄)
- `it_backend/.../common/system/security/OwnershipVerifier.java` (신규 공통 유틸)
- `it_backend/.../common/sso/SsoAgentClient.java`

**프론트엔드**
- `it_frontend/app/pages/info/projects/[id].vue`, `index.vue`, `form.vue`
- `it_frontend/app/features/project/useProjectFormSave.ts` (구 `executeSave` 이관처)
- `it_frontend/app/features/approval/forms/itBudget/useItBudgetApprovalFormPdf.ts` + `pdf/` (구 `usePdfReport` 이관처)
- `it_frontend/app/composables/useCostListPage.ts` (358줄) + `costListPageHelpers.ts`
- `it_frontend/app/composables/ioeCategoryHelpers.ts`

**테스트/설정**
- `it_backend/build.gradle` (jacoco 게이트)
- `it_frontend/vitest.config.ts` (coverage 임계값)
- `it_frontend/tests/unit/composables/useCostListPage.test.ts` (2,140줄 — 분리 대상)
- `C:\it\TASK.md`, `C:\it\TASK_DONE.md`
