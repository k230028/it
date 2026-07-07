# IT Project Portal — 『Clean Code』 기준 코드 품질 진단 보고서

- **진단일**: 2026-07-07
- **기준**: 로버트 마틴(Robert C. Martin) 『Clean Code』
- **범위**: it_backend (Java 378개 파일, 테스트 166개), it_frontend (Vue/TS 416개 파일, 테스트 125개)
- **방법**: 백엔드 Java · 프론트엔드 Vue/TS · 테스트/아키텍처 3개 리뷰 에이전트 병렬 진단 + CRITICAL 발견 직접 교차 검증

---

## 1. 종합 평가

| 영역 | 점수 | 한 줄 요약 |
|------|------|-----------|
| 백엔드 (Spring Boot) | **3.6 / 5** | 기본기(계층 규율, 예외 처리, 트랜잭션)는 탄탄하나 대형 서비스의 함수 비대·중복이 반복 |
| 프론트엔드 (Nuxt 4) | **3.5 / 5** | 정적 검사·보안 기준선은 준수하나 `any` 우회 관행이 실제 버그를 은닉 |
| 테스트 품질 | **3.5 / 5** | 커버리지 게이트 실존·AAA 준수 양호, 리포지토리 계층 검증 공백 |
| 아키텍처 경계 | **3.0 / 5** | DTO 변환 규율 준수, God Class 집중이 최대 부채 |

**결론**: "동작은 잘 하지만 유지보수 비용이 누적되는" 성숙한 코드베이스. 죽은 코드 0건, `System.out`/`printStackTrace` 0건, 생성자 주입 100%, `v-html` 13곳 전부 DOMPurify 적용 등 위생은 상위권이나, **핵심 도메인(budget/project, cost, council)에 SRP 위반이 집중**되어 있고 그 비대함이 테스트 비대화까지 전이되고 있음.

---

## 2. ⚠️ 진단 중 발견한 실제 버그 (CRITICAL — 직접 검증 완료)

**`ornYn`/`odnYn` 필드명 불일치를 `as any`가 은닉** — 백엔드 응답 필드는 `odnYn`(경상여부, `ProjectDto.java`/`Bprojm.java`)인데 프론트 3곳이 존재하지 않는 `ornYn`을 읽고 있음:

| 위치 | 증상 |
|------|------|
| `it_frontend/app/pages/info/projects/[id].vue:128` — `(project.value as any)?.ornYn` | 상세 화면의 경상사업 판정이 **항상 false** |
| `it_frontend/app/composables/usePdfReport.ts:843` — `(project as any).ornYn` | PDF 보고서에서 경상사업이 항상 "[정보화사업]" 타이틀로 출력 |
| `it_frontend/app/pages/info/projects/index.vue:441,449,451` — `slotProps.data.ornYn` | 목록 구분 배지가 항상 '정보화'로 표시 (raw 데이터는 `odnYn`) |

참고: `form.vue:729,1260`처럼 `detail.odnYn` → 로컬 폼 필드 `ornYn`으로 명시 매핑해 쓰는 곳은 정상.

**Clean Code 관점의 의미**: `as any` + `eslint-disable`이 없었다면 컴파일러가 즉시 잡았을 버그. 동일한 우회 패턴이 프로덕션 코드 48개 파일, 184건에 퍼져 있어 같은 유형의 버그가 재생산될 구조.

---

## 3. Clean Code 원칙별 진단

### 3.1 함수 (3장) — 가장 큰 약점

- `usePdfReport.ts` `generateReport`: **단일 함수 약 1,100줄** (203~1304행). 헤더/워터마크/섹션/푸터가 전부 한 함수에 있어 단위 테스트 사실상 불가능.
- `ProjectService.java:399` `updateProject`: 약 150줄. 결재확인·권한검증·XSS 새니타이징·품목 CUD 동기화를 한 메서드가 처리.
- `Bcostm.java:185` `update`: **매개변수 20개**(연속 String 15개) — 인자 순서를 바꿔도 컴파일러가 못 잡음. 같은 코드베이스에 `Bprojm.UpdateCommand` record 선례가 있는데 미적용.
- `form.vue` `executeSave`(873~989행, 약 115줄): payload 역변환 + 필드 매핑 35개 + API 호출 + 다이얼로그 + 라우팅을 한 함수에서 처리.

### 3.2 클래스/모듈, SRP (10장) — 800줄 규약 반복 위반

| 파일 | 크기 | 비고 |
|------|------|------|
| `it_frontend/app/pages/info/projects/form.vue` | 2,149줄 | 스크립트만 1,413줄, 함수/const 82개 |
| `it_frontend/app/pages/info/plan/[id].vue` | 2,078줄 | |
| `it_frontend/app/composables/useCostListPage.ts` | 1,790줄 | 조회/편집/직원검색/엑셀업로드/내보내기 다책임 |
| `it_backend/.../project/service/ProjectService.java` | 1,178줄 | |
| `it_backend/.../work/service/BudgetWorkService.java` | 1,035줄 | |
| `it_backend/.../council/controller/CouncilController.java` | 976줄 | 서비스 8개 주입, M3~M7 전 모듈 라우팅 |
| `it_backend/.../cost/service/CostService.java` | 958줄 | |

소스 비대화가 테스트에 그대로 전이: `useCostListPage.test.ts`는 **단일 describe에 it() 99개**(2,026줄). 반면 `useCouncil.test.ts`는 describe 18개로 잘 분리된 사내 모범 사례 존재.

### 3.3 중복 (DRY)

- **[보안 위험 중복]** `validateModifyPermission`이 `ProjectService.java:1149`와 `CostService.java:939`에 100% 동일 복제 — 한쪽만 정책이 바뀌면 RBAC이 서비스마다 어긋나는 보안 회귀로 직결. 기존 `OwnershipVerifier` 패턴(§5.18)으로 통합 가능.
- `Bitemm.builder()` 20개 필드 블록이 `ProjectService` 3곳(330, 473, 513행)에 반복. `CostService`의 단말기 환율 환산 블록 2곳 반복(266~272 / 350~356행).
- **환율 환산 규칙 이원화**(TASK.md BE-04 자인): `BudgetWorkService`는 환율 미적용, `ProjectBudgetSummaryService`는 `amt × xcr` 적용 — 실데이터 정합성 리스크.
- 프론트: IOE 자본예산 분류 규칙이 공유 헬퍼(`ioeCategoryHelpers.ts:116`)가 있는데도 `projects/[id].vue:76`에서 리터럴로 재정의.

### 3.4 오류 처리 (7장) — 대체로 양호, 국소 결함

- 백엔드 `catch(Exception)` 18건 전수 확인 결과 전부 로깅+재throw 또는 근거가 주석으로 명시된 의도적 격리 — **예외 삼킴 없음**.
- **mutating 엔드포인트 6곳 `@Valid` 누락**(자체 규약 §5.5.2 위반):
  - `CostController.java:170` `createCost`
  - `AdminBoardMetaController.java:36` `create`
  - `GuideDocController.java:96` `createDocument`
  - `ServiceRequestDocController.java:115` `createDocument`
  - `BoardCommentController.java:55` `create`
  - `AdminMenuController.java:105` `move`
- `CostController.createCost`만 `201 Created` + Location 헤더 대신 `200 OK` 반환 (API 규약 위반).

### 3.5 타입 안전 (2장/17장 결합) — 프론트 구조적 약점

- `any` + `eslint-disable-next-line @typescript-eslint/no-explicit-any` 조합이 프로덕션 코드 **48개 파일, 184건**. `eslint.config.mjs`는 테스트 파일에만 완화를 허용한다고 명시했으나 프로덕션에서 라인 단위 우회가 관행화.
- 예: `approval/list.vue`는 `Approval`/`BulkApprovalItem` 타입을 import하고도 DataTable 콜백은 전부 `any` 선언.
- §2의 CRITICAL 버그가 이 관행의 직접 결과물.

### 3.6 단위 테스트 (9장)

**강점**
- 커버리지 게이트 실존·강제: `it_backend/build.gradle:171-207` jacoco 클래스별 LINE/BRANCH/COMPLEXITY 70%, `vitest.config.ts` lines 70% (pages는 E2E 커버 분리 — 의도적 설계).
- `ProjectServiceTest.java`: Given-When-Then, 한글 `@DisplayName`, AssertJ, 예외 케이스까지 일관 준수 (69개 테스트, 테스트당 평균 ~2.2 assert).
- Oracle 미가동 시 자동 skip 하네스(`AbstractOracleRepositoryTest`, TCP 프로브) — Repeatable 원칙 준수.
- 계층 격리 양호: Mockito 69 / `@WebMvcTest` 33 / `@DataJpaTest` 4 / `@SpringBootTest` 2.

**약점**
- **계층 불균형**: 서비스 테스트 69개 vs 리포지토리 14개 — QueryDSL `BooleanBuilder` 동적 쿼리가 Mock에 가려져 실제 SQL 정합성 미검증(TASK.md BE-02 자인).
- E2E 스펙 19개 작성됐으나 정기 실행 검증 미확인(TASK.md LOG-07).
- 게시판 서비스 커버리지 미달(BRD-10), HWPX/PDF/Excel 회귀 테스트 공백(BE-01) — 자인된 부채.

### 3.7 아키텍처 경계 (11장)

- DTO 변환 규율 준수: 표본 컨트롤러 전부 `XxxDto.Response` 반환, Entity 직접 노출 0건.
- Controller→Repository 직접 호출은 사실상 1건(`DevAuthController.java:52` — 운영 비활성 게이트로 실질 리스크 낮음).
- 프론트 API 호출 계층은 문서화된 컨벤션(GET은 composable, mutating은 `$apiFetch` 직접)과 일치.
- 의도적 계층 예외(`ApplicationService → BprojaSyncService`)는 CLAUDE.md에 근거와 함께 명시 — 숨은 결합 아님.

### 3.8 기타 냄새 (17장)

- SSO 토큰 검증 성공 로그가 사용자 데이터를 INFO로 그대로 기록(`SsoAgentClient.java:122`) — 현재 설정은 사번뿐이라 위험 낮으나 `requestData` 설정 확장 시 PII 노출 구조.
- Toast `life: 3000/2000/1500` 매직 넘버 수백 곳 반복.
- `BudgetWorkService.java:321` 기본 편성률 `100` 리터럴 — `DEFAULT_ALLOCATION_RATE` 상수화 권장.
- Java 들여쓰기 4/8-space 혼재(`AdminService.java` 등) — 포맷터(Spotless/google-java-format) 미도입.
- `it_frontend/CLAUDE.md` §4.10의 "console.log 제거 대상" 기록은 이미 해결됨(실 코드 0건) — 문서 현행화 필요.

---

## 4. 강점 요약 (실제 확인된 것만)

- **위생**: 죽은 코드/주석 처리 코드 0건, `@Deprecated` 0건, `System.out`/`printStackTrace` 0건, 방치된 TODO 없음.
- **DI/트랜잭션**: 생성자 주입(`@RequiredArgsConstructor`) 100%, 클래스 레벨 `@Transactional(readOnly=true)` + 쓰기 메서드 오버라이드 패턴 일관.
- **성능**: `FetchType.EAGER` 0건, 배치 조회 헬퍼로 N+1 명시적 회피(문서화됨).
- **보안**: Path Traversal 방어 정석 구현(`FileService.downloadFile`), `v-html` 13곳 전부 DOMPurify, 인증 미들웨어의 오픈 리다이렉트 방어(`getSafeNextPath`), 토큰 마스킹.
- **정적 품질**: `npm run typecheck` / `npm run lint` 0 오류·0 경고.
- **부채 관리**: TASK.md 48개 항목 중 다수가 자인·추적 중(BE-02, BE-04, BRD-10 등) — 부채 관리 체계 자체는 잘 작동.

---

## 5. 개선 로드맵 (우선순위순)

| 순위 | 시기 | 항목 | 근거 |
|------|------|------|------|
| 1 | 즉시 (저비용·고효과) | `ornYn`→`odnYn` 버그 3곳 수정, `@Valid` 누락 6곳 추가, `createCost` 201 응답 정정 | 실사용자 영향 버그 + 입력 검증 공백. 전부 몇 줄 수정 |
| 2 | 단기 | `validateModifyPermission` 중복을 `OwnershipVerifier`로 통합, 환율 환산 규칙 단일화(BE-04) | RBAC 이원화·데이터 정합성 리스크 직결 |
| 3 | 단기~중기 | `any`+`eslint-disable` 184건을 핵심 도메인(결재/예산/PDF)부터 기존 타입 재사용으로 점진 치환. 리뷰 체크리스트에 "any+disable 금지" 추가 | CRITICAL 버그 재발 방지책 |
| 4 | 중기 | God Class/Composable 분해: `ProjectService`(Query/Command 분리), `useCostListPage.ts`(하위 composable 분리), `usePdfReport.ts`(섹션별 순수 함수화), `CouncilController`(M3~M7 모듈 경계로 물리 분리). 대형 테스트 파일도 함께 분리 | 최대 아키텍처 부채이자 테스트 비대화의 근본 원인 |
| 5 | 중기~장기 | BE-02 리포지토리 통합테스트 확대, E2E 핵심 3개 시나리오(로그인/프로젝트/결재) CI 편입, `Bcostm.UpdateCommand` record 도입, 포맷터 도입, 매직 넘버 상수화 | 검증 공백 해소 + 예방적 개선 |

---

## 부록: 주요 참고 파일

**백엔드**
- `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`
- `it_backend/src/main/java/com/kdb/it/domain/council/controller/CouncilController.java`
- `it_backend/src/main/java/com/kdb/it/domain/budget/cost/controller/CostController.java`
- `it_backend/src/main/java/com/kdb/it/common/sso/SsoAgentClient.java`

**프론트엔드**
- `it_frontend/app/pages/info/projects/[id].vue`
- `it_frontend/app/pages/info/projects/index.vue`
- `it_frontend/app/pages/info/projects/form.vue`
- `it_frontend/app/composables/usePdfReport.ts`
- `it_frontend/app/composables/useCostListPage.ts`
- `it_frontend/app/composables/useProjects.ts`
- `it_frontend/app/composables/ioeCategoryHelpers.ts`

**테스트/설정**
- `it_backend/build.gradle` (jacoco 게이트)
- `it_frontend/vitest.config.ts` (coverage 임계값)
- `it_frontend/tests/unit/composables/useCostListPage.test.ts`
- `C:\it\TASK.md`
