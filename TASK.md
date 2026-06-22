# 📋 IT Portal 백로그

> 🗓️ **기준일:** 2026-06-22
> 🎯 **목적:** `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 | 우선순위 | 의미 |
| :--: | --- | :--: | --- |
| ✅ Done | 완료 | 🔴 Critical | 즉시 조치 (보안/데이터 손실) |
| ⬜ Open | 미착수 | 🟠 High | 가급적 조속 조치 |
| ✔️ Resolved | 해소(거짓양성 등) | 🟡 Medium | 유지보수 개선 |
| ☑️ Accepted | 감내(업스트림 미해결) | 🟢 Low | 선택 개선 |

> 📦 **완료/종료 항목**은 [`TASK_DONE.md`](TASK_DONE.md)에 보관합니다.

---

## 🚧 진행 중

> 🕒 최종 업데이트: 2026-06-22

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 운영 프로파일에서 `cors.allowed-origins` 실제 오리진 강제 설정 및 구동 시 검증. `app.cookie.secure=true`는 적용됨, `SecurityConfig` fallback과 운영 CORS 값 검증은 미구현 | `application-prod.properties`, `SecurityConfig.java:73` |
| ⬜ Open | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                                       | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈                                                   |
| ⬜ Open | 🟡 Medium | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                                          | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요                                           |
| ⬜ Open | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드가 일시적으로 관리자 화면을 노출하지 않는지 E2E 검증                                                                            | 프론트 쿠키는 UX 상태이며 최종 권한은 백엔드가 판단해야 함                                                    |
| ⬜ Open | 🟡 Medium | SSO 운영 설정 검증 강화 — `app.sso.allow-direct-eno=false`, `app.frontend-url` 실제 값, 프록시 헤더 덮어쓰기 점검                                                   | `SsoController`, `AuthController.getClientIp()` 운영 안전장치                               |
| ⬜ Open | 🟡 Medium | Access Token Blocklist 도입 검토 — 로그아웃 시 잔존 토큰(최대 15분) 무효화 필요 여부 결정                                                                              | `AuthService.logout()` Stateless 한계, 고보안 시나리오용                                        |
| ⬜ Open | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대 카운터) 도입 — Phase 3에서 회전(rotation)만 구현되어 탈취된 구 토큰의 재사용 탐지가 없음. 회전 시 무효화된 토큰이 다시 제출되면 패밀리 전체 폐기하는 메커니즘 필요 | `AuthService`(rotation 구현부), 스파이크: `docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md`, 탐지: 2026-06-22 |
| ⬜ Open | 🟠 High | `FileController` 다운로드/미리보기/단건조회/목록조회에 파일 읽기 권한 검증 적용 | `downloadFile()`/`previewFile()`이 `FileOwnershipChecker.checkReadAccess()` 없이 `fileService.downloadFile()` 직접 호출 |
| ⬜ Open | 🟠 High | `FileController.updateFileMeta()`와 `deleteFilesByOrc()`에 소유권 또는 관리자/도메인 권한 검증 추가 | 인증 사용자라면 임의 `flMngNo` 또는 `orcDtt+orcPkVl`로 메타 수정/일괄 삭제 호출 가능 |
| ⬜ Open | 🟡 Medium | `GET /api/documents/dashboard`, `/badge-count` — 클라이언트 제공 `bbrC` 신뢰로 수평적 데이터 노출. 인증 사용자가 임의 부서코드로 타 부서 집계 조회 가능. JWT 클레임 `bbrC` 또는 `isAdmin()` 기준 서비스 계층 검증 필요 | `ServiceRequestDocController.java:183,197`, 발견일: 2026-05-29 |
| ⬜ Open | 🟠 High | 요구사항 정의서 생성/수정/삭제/새 버전 생성 API 소유권 검증 추가 — 인증 사용자라면 문서번호 기준으로 타 문서 변경 가능 여부 검증 필요. `@AuthenticationPrincipal`을 받아 작성자·부서·관리자 기준 서비스 계층 검증 적용 | `ServiceRequestDocController.java:113,145,166`, `ServiceRequestDocService.java:190`, 탐지: 2026-06-21 |
| ⬜ Open | 🟢 Low | `AuthController.getClientIp()` — `X-Forwarded-For` 멀티 IP(`client, proxy1, ...`) 미분리로 전체 문자열을 IP로 저장. `ip.split(",")[0].trim()` 추가 필요. IP 기반 Brute-force 도입 시 위조 우회 벡터 | `AuthController.java:256`, 발견일: 2026-05-29 |
| ⬜ Open | 🟠 High | 사업집행 4단계 서비스 — 쓰기 메서드(update/delete/changeStatus/saveLines·saveResult·saveContract·savePayments)가 `CustomUserDetails user`를 받지만 소유자/관리자 검증을 하지 않음. 인증된 임의 직원이 타인의 산정·심의·계약·지급 문서를 수정·삭제·상태전이 가능. `e.getFstEnrUsid().equals(user.getEno()) \|\| user.isAdmin()` 검증 추가(공통 OwnershipVerifier 유틸 권장) | `EstimateService.java:82`, `DeliberationService.java:86`, `ContractService.java:86`, `PaymentService.java:93`, 발견일: 2026-06-09 |
| ⬜ Open | 🟠 High | `ContractRepositoryImpl`·`DeliberationRepositoryImpl`·`PaymentRepositoryImpl` — `bbrC` 부서 필터 MVP 미적용(쿼리 조건 없음). 서비스가 bbrC를 전달해도 Repository가 무시 → 일반 사용자가 타부서 계약·심의·지급 목록 전체 열람 가능. `EstimateRepositoryImpl`(적용됨)과 불일치. Bcontm/Bdelim/Bpaymm에 주관부서코드 컬럼 추가 또는 대상 테이블 JOIN 필요 | `ContractRepositoryImpl.java:47`, `DeliberationRepositoryImpl.java:47`, `PaymentRepositoryImpl.java:43`, 발견일: 2026-06-09 (line 309 과업심의 bbrC 항목 통합·확장) |
| ⬜ Open | 🟡 Medium | 사업집행 4단계 `changeStatus` — 단방향 상태전이(인접만)는 검증하나 역할(ADMIN/작업자/신청자)별 전이 권한 분기 없음. 업무 요건(제출=본인/관리자, 완료=관리자/작업자 등) 확정 후 서비스 계층 role 분기 추가 | `EstimateService.java:115`, `DeliberationService/ContractService/PaymentService` 동일, 발견일: 2026-06-09 |
| ⬜ Open | 🟡 Medium | 사업집행 4단계 DTO — 금융 금액 필드(`cttAmt`, `dfrAmt`) `@DecimalMin("0")` 미적용으로 null·음수 저장 가능, YN 플래그(`taskDbrOmtYn`)는 `@Pattern(regexp="^[YN]$")` 미적용 | `ContractDto.WorkRequest`, `PaymentDto.CreateRequest/UpdateRequest/LineRequest`, `DeliberationDto.ResultRequest`, 발견일: 2026-06-09 |
| ⬜ Open | 🟡 Medium | 소유권 검증 403 표준화 — `BoardPostService`/`BoardCommentService`가 본인 게시물·댓글 수정/삭제 실패에 `CustomGeneralException`(400)을 던짐. 신규 `OwnershipVerifier.verifyOwnerOrAdmin()`(403)로 통일해 QnA와 의미 일관성 확보 (`CostService`는 이미 `AccessDeniedException` 사용) | `BoardPostService`/`BoardCommentService`, 탐지: 2026-06-22(ownership-verifier 후속) |
| ⬜ Open | 🟢 Low | `it_backend/CLAUDE.md §5.18` 보안 규칙에 신규 공통 유틸 `OwnershipVerifier`(`common/system/security`)를 소유권 검증 표준 수단으로 명시 | `OwnershipVerifier.java`, 탐지: 2026-06-22 |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

> ✅ 활성 항목 없음 — 종료 내역은 [`TASK_DONE.md`](TASK_DONE.md) 참조

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| ⬜ Open | 🟡 Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| ⬜ Open | 🟡 Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | `NotificationEventListener.onApprovalCompleted()` — AFTER_COMMIT 페이즈 내 `applicationRepository.findById()` 호출이 외부 트랜잭션 종료 후 수행되어 Lazy 연관 접근 시 `LazyInitializationException` 발생 가능. `@Transactional(REQUIRES_NEW)` 추가 또는 `send()` 내부로 이동 필요 | `NotificationEventListener.java:57-58` |
| ⬜ Open | 🟡 Medium | 프론트엔드 toast 알림 누락 다발 보완 (`useCostListPage`, `projects/form.vue`, `budget/report.vue`, `terminal/[id].vue` 등)                                                                                        | catch 블록 사용자 피드백 없음 — TODO 주석 존재                                                 |
| ⬜ Open | 🟠 High | 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강                                                                                                                                                                    | `pages/info/documents/[id]/review.vue` 자동 저장 catch가 실패를 삼킴                       |
| ⬜ Open | 🟡 Medium | 사전협의 버전/코멘트/검토자 API 실패 표시 보강                                                                                                                                                                        | `stores/review.ts`, `pages/info/documents/[id]/index.vue` 실패 시 빈 상태 폴백           |
| ⬜ Open | 🟡 Medium | 전산업무비 일괄 업로드 실패 행/원인 로깅 및 결과 상세화                                                                                                                                                                    | `useCostListPage.ts` 행별 catch에서 실패 수만 증가                                         |
| ⬜ Open | 🟡 Medium | HWPX 내보내기 이미지 누락 진단 강화                                                                                                                                                                              | `useHwpxExport.ts` 이미지 fetch 실패 시 null 반환                                        |
| ⬜ Open | 🟡 Medium | Java 파일 헤더 주석 전수 보강                                                                                                                                                                                 | 다수 Java 파일이 `package`로 바로 시작하며 파일 역할/흐름/연동 테이블 헤더가 없음                            |
| ⬜ Open | 🟡 Medium | `AdminDto` 잔여 DTO JavaDoc 보강                                                                                                                                                                        | 자격등급/사용자/조직/역할/로그인 이력/토큰/첨부파일/통계 DTO는 기본 설명만 존재                                  |
| ⬜ Open | 🔴 Critical | `ApplicationService.getApplicationsByIds()`·`ProjectService.findByIds()`·`CostService.findByIds()` — `IllegalArgumentException` catch 후 `null` 반환 + `Objects::nonNull` 필터 패턴 제거. 실패 항목 수가 호출자에게 가려짐 | `ApplicationService.java:440`, `ProjectService.java:564`, `CostService.java:351` |
| ⬜ Open | 🟠 High | `ChangeLogEntityListener.beforeAnyOperation()` `catch (Exception e)` — 감사로그 영속화 실패 시 알람 필요 (스택트레이스는 2026-06-22 추가됨, 알람 연동만 잔여)                                                                                                | `ChangeLogEntityListener.java:75` 현재 `log.warn`만 |
| ⬜ Open | 🟡 Medium | `LoginAttemptService` 조회 전용 트랜잭션 경계 명시 — 클래스 레벨 `@Transactional(readOnly=true)` 적용 검토 | `LoginAttemptService.java`, 발견일: 2026-06-01 |
| ⬜ Open | 🟠 High | `useTiptapImageInsertion.ts` 임시 blob URL 미해제 — 이미지 업로드 실패 catch 경로 + 성공 경로 모두 `URL.revokeObjectURL()` 보장                                                                                            | `useTiptapImageInsertion.ts:60,111,135` 메모리 누수 위험                                |
| ⬜ Open | 🟡 Medium | `usePdfReport.ts` 한글 폰트 로드 실패 시 Roboto 폴백 — 한글 문자 깨짐 가능, 사용자 경고 토스트 추가                                                                                                                              | `usePdfReport.ts:174` 무경고 폴백                                                     |
| ⬜ Open | 🟡 Medium | Excalidraw/HWPX/Tiptap 실패 경로 사용자 알림 보강 — 내보내기 실패, 장면 복원 실패, 이미지 누락을 빈 결과와 구분 | `ExcalidrawWrapper.vue`, `ExcalidrawNodeView.vue`, `useHwpxExport.ts`, `hwpx-images.ts`, `useTiptapTableTools.ts` |
| ⬜ Open | 🟡 Medium | 손상된 `it-portal-user` 쿠키와 구버전 `localStorage.user` 파싱 실패 시 warn 로그 및 정리 정책 추가 | `stores/auth.ts` |
| ⬜ Open | 🔴 Critical | `info/projects/form.vue:604-606` — 편집 모드 데이터 로드 실패 시 빈 폼 표시, 사용자가 저장하면 기존 프로젝트 전체 데이터 덮어쓰기 위험. 실패 즉시 `toast.error` 후 목록 리다이렉트 필수 | `pages/info/projects/form.vue:604-606`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `approval/[apfMngNo].vue:48-49` — 결재 상세 로드 실패 시 빈 화면 노출. `toast.error` 알림 및 목록 리다이렉트 필요 | `pages/approval/[apfMngNo].vue:48-49`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `board/[blbMngNo]/[nacMngNo]/index.vue:38` — `catch {}` 완전 빈 블록, 에러 변수·로그·toast 모두 없음. 빈 게시글 페이지 노출 | `pages/board/[blbMngNo]/[nacMngNo]/index.vue:38`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `EmployeeSearchDialog.vue:88-91,204-210` — 조직도 트리 로드 실패 및 부서원 목록 실패 시 `console.error`만 출력. `toast.error` 알림 추가 필요 | `components/common/EmployeeSearchDialog.vue`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `ExcalidrawWrapper.vue:85-89,150-153` — `exportData()` 실패 시 `null` 반환으로 다이어그램 저장 silently 실패, 초기화 실패 시 빈 에디터 노출. 예외 전파 또는 `toast.error` 필요 | `components/ExcalidrawWrapper.vue`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `useEmployeeSearch.ts:75-77` — 직원 검색 API 실패 시 `console.error`만 출력. `toast.error` 알림 및 실패/결과 없음 상태 구분 필요 (CLAUDE.md 4.2.1 위반) | `composables/useEmployeeSearch.ts:75-77`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `useGlobalSearch.ts:75-79` — 글로벌 검색 실패 시 `suggestions.value = []` silent fallback. 경고 로그 및 인라인 오류 표시 검토 필요 | `composables/useGlobalSearch.ts:75-79`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `useCostListPage.ts:366-368` — 코드 로드 실패 시 `console.error`만 출력. `toast.error` 알림 추가 필요 (CLAUDE.md 4.2.1 위반) | `composables/useCostListPage.ts:366-368`, 발견일: 2026-05-26 |
| ⬜ Open | 🟡 Medium | `useCostListPage.ts` 전년도/계속사업 폴백 실패 상태 표시 — 단말기 재조회, 자동완성, 전년도 상세 조회 실패가 빈 결과와 구분되지 않음. 경고 로그 또는 degraded-state 표시 추가 | `useCostListPage.ts:1324,1416,1442`, 탐지: 2026-06-05 |
| ⬜ Open | 🟡 Medium | `ResourceTableSection.vue` 소요자원 코드 로드 실패 사용자 피드백 보강 — `console.error`만 있고 옵션 누락 상태가 화면에 설명되지 않음 | `components/projects/ResourceTableSection.vue:279-280`, 탐지: 2026-06-05 |
| ⬜ Open | 🟡 Medium | `terminal/[id].vue` 삭제 실패 시 PrimeVue toast 추가 — `useToast()`는 import되어 있으나 catch가 FIXME + `console.error`만 수행 | `pages/info/cost/terminal/[id].vue:36-38`, 탐지: 2026-06-05 |
| ⬜ Open | 🟠 High | `info/cost/form.vue:184-186` — 비용 폼 초기 데이터 로드 실패 시 `console.error`만 출력. `toast.error` 알림 및 에러 상태 UI 처리 필요 (CLAUDE.md 4.2.1 위반) | `pages/info/cost/form.vue:184-186`, 발견일: 2026-05-26 |
| ⬜ Open | 🟠 High | `ResultReviewProgress.vue` — `syncReviewStatus()` 상태 전이 실패를 catch가 완전 삼킴(로그 0건). 10→11 자동 전이 실패 추적 불가. `console.warn(e)` 기록 추가 (toast 억제는 유지, FIXME 주석 등록 완료) | `components/council/result/ResultReviewProgress.vue:61`, 탐지: 2026-06-12 |
| ⬜ Open | 🟡 Medium | `council-request/[id].vue` — `saveTemp`/`saveComplete`/`submitApproval` catch 바인딩 없음. 백엔드 오류 메시지(`e.data?.message`) 대신 일반 문구만 노출. `prepare/[id].vue`의 `catch (e: unknown)` 패턴으로 통일 (TODO 주석 등록 완료) | `pages/info/council-request/[id].vue:370,407,476`, 탐지: 2026-06-12 |
| ⬜ Open | 🟡 Medium | `council-request/[id].vue` — `councilStatus`의 `?? '01'` 폴백이 데이터 미로드(null)를 DRAFT로 둔갑시켜 편집 가드 해제. 로드 실패 상태에서 빈 데이터 저장 위험. null 유지 + 가드 보강 (TODO 주석 등록 완료) | `pages/info/council-request/[id].vue:189`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | `CommitteeSelector.vue`(위원 저장·기본위원 배정)·`ScheduleStatus.vue`(일정 확정) catch 바인딩 없음 — 업무 오류 메시지 미전달. `EvaluationForm.vue` 오류 추출 패턴으로 통일 | `CommitteeSelector.vue:261,295`, `ScheduleStatus.vue:159`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | `council-request/result/[id].vue` — `handleNotify`(통보 성공이나 수신자 null 시 무피드백)·`handleRequestApproval`·`handleStartResultWriting` catch 바인딩 없음. 백엔드 오류 메시지(`e.data?.message`) 미전달. `prepare/[id].vue`의 `catch (e: unknown)` 패턴으로 통일 | `pages/info/council-request/result/[id].vue:273,299,314`, 탐지: 2026-06-14 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | `BudgetWorkService.getProjectSummary()` — BBUGTM 루프 내 `gclMngNo→prjMngNo` 개별 SELECT + `resolveProjectName()` 사업별 SELECT → IN절 일괄 조회 | `BudgetWorkService.java L600, L683` |
| ⬜ Open | 🟠 High | `BudgetWorkService.applyRates()` — 원본 레코드별 개별 Upsert SELECT → 벌크 처리 또는 Oracle MERGE INTO 전환 | `BudgetWorkService.java L150-213` |
| ⬜ Open | 🟠 High | `CostService.enrichCostListBatch()` 단말기 첨부 N+1 제거 — 단말기 행별 `attachTerminals()` 개별 조회를 일괄 조회로 전환 | `CostService.java L508, L531, L598` |
| ⬜ Open | 🟡 Medium | `BudgetWorkService.applyItemRates()` 전체 연도 BBUGTM 메모리 로드 + 루프 Soft Delete → `@Modifying` 벌크 UPDATE | `BudgetWorkService.java L243-244` |
| ⬜ Open | 🟡 Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 API용 DTO 프로젝션 (1000자 텍스트 컬럼 제외) | `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| ⬜ Open | 🟡 Medium | Native Query `Object[]` 반환 → DTO 프로젝션 또는 `@SqlResultSetMapping` 적용 | `CouncilRepository`, `ApplicationRepository`, `ServiceRequestDocRepository`, `LoginHistoryRepository`, `EvaluationRepository` |
| ⬜ Open | 🟡 Medium | `ProjectService.enrichProjectListBatch()` 사업별 비목 요약 N+1 제거 — BITEMM을 사업 키 묶음으로 일괄 조회 | `ProjectService.java L662, L684, L783` |
| ⬜ Open | 🟡 Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → `flush()` 명시 또는 Spring Data `deleteAll` 통일 | `FeasibilityService.java L225` |
| ⬜ Open | 🟡 Medium | 협의회 일정/평가 사용자명 조회 N+1 제거 | `ScheduleService`, `EvaluationService`에서 사번별 `findByEno()` 반복 |
| ⬜ Open | 🟡 Medium | 협의회 위원/상태 조회 배치화 검토 | `CommitteeService`, `CouncilService` 반복 조회 후보 |
| ⬜ Open | 🟠 High | 결재 대기/대시보드 쿼리 인덱스 보강 검토 | `ApplicationRepository`가 `CDECIM.DCD_ENO`, `DCD_DT`, `CAPPLM.APF_STS`, `RQS_DT` 기준 조회. 후보: `CDECIM(DCD_ENO, DCD_DT, DCD_MNG_NO)`, `CAPPLM(APF_STS, RQS_DT DESC)` |
| ⬜ Open | 🟠 High | 요구사항 정의서 대시보드 `BRDOCM`/`BRIVGM` 보조 인덱스 검토 | `ServiceRequestDocRepository`가 `FST_ENR_USID`, `DEL_YN`, `FST_ENR_DTM`, `DOC_MNG_NO`, `FSG_YN` 조건 반복 사용 |
| ⬜ Open | 🟡 Medium | 협의회 목록 `BASCTM`/`BCMMTM` 역방향 조회 인덱스 검토 | 후보: `BASCTM(PRJ_MNG_NO, PRJ_SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, ASCT_ID)` |
| ⬜ Open | 🟡 Medium | `ScheduleService` 위원 사용자명 조회 N+1 제거 — 위원별 `userRepository.findByEno` 반복을 `findByEnoIn` 일괄 조회로 전환 | `ScheduleService.java:311`, 탐지: 2026-06-05 |
| ⬜ Open | 🟠 High | 전산업무비 삭제 시 단말기 조회 N+1 제거 | `CostService`가 비용별 `btermmRepository.findByItMngcNoAndItMngcSno()` 반복 호출. `IT_MNGC_NO` 기준 단말기 일괄 조회 후 그룹핑 |
| ⬜ Open | 🟡 Medium | `BRDOCM` 최신버전 목록 조회 실행계획 검증 및 복합 인덱스 검토 | `findLatestVersionsAll()`의 `DEL_YN='N'` + 상관 서브쿼리 `MAX(DOC_VRS)` + `FST_ENR_DTM DESC` 정렬. 후보: `(DEL_YN, DOC_MNG_NO, DOC_VRS, FST_ENR_DTM)` |
| ⬜ Open | 🟡 Medium | `BRIVGM` 검토의견 목록 조회 인덱스 추가 검토 | 댓글 목록이 `(DOC_MNG_NO, DOC_VRS, DEL_YN)` 필터와 `FST_ENR_DTM ASC` 정렬을 사용. 후보: `(DOC_MNG_NO, DOC_VRS, DEL_YN, FST_ENR_DTM)` |
| ⬜ Open | 🟡 Medium | `CouncilRepository.findWithDetails()` Native Query `Object[]` 전용 DTO/projection 전환 우선 처리 | 16개 컬럼 순서와 서비스 캐스팅이 강하게 결합되어 오매핑 위험 |
| ⬜ Open | 🟡 Medium | `CinfmmRepositoryImpl.markAllReadByRcvUsid()` QueryDSL 벌크 UPDATE 후 `LST_CHG_DTM`/`LST_CHG_USID` 미갱신 — JPA Auditing 우회, 1차 캐시 stale 발생. `clearAutomatically` 또는 감사 컬럼 명시 SET 추가 | `CinfmmRepositoryImpl.java:67-78` (→ `CouncilRepository.java:67` 동일 패턴 참조) |
| ⬜ Open | 🟡 Medium | 실시간 로그 피드 커서 폴링 인덱스/실행계획 검증 — `CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC`, `LOG_KEY`, `CHG_DTT_YN` 필터와 5/30분 집계가 View 기반으로 충분히 지원되는지 확인 | `RealtimeLogRepository.java`, `V_ITPAPP_LOG_FEED`, 탐지: 2026-06-05 |
| ⬜ Open | 🟠 High | 사업집행 4단계 채번 시퀀스(`SEQ_BESTIM`/`SEQ_BDELIM`/`SEQ_BCONTM`/`SEQ_BPAYMM`) `NOCACHE → CACHE 20` 변경 마이그레이션 — 3,000명 동시 신청 시 redo 경합. (`SEQ_CINFMM` 항목과 별개) | `V20260607_002:105`, `V20260607_005:80`, `V20260607_008:84`, `V20260607_011:165` 모두 `NOCACHE NOCYCLE`, 탐지: 2026-06-09 |
| ⬜ Open | 🟠 High | 사업집행 4단계 마스터(`BESTIM`/`BDELIM`/`BCONTM`/`BPAYMM`) 목록 조회 복합 인덱스 보강 — 핵심 WHERE `DEL_YN='N' AND LST_YN='Y'`가 기존 단일 인덱스(`IDX_*_STS`)에 미포함. `(DEL_YN, LST_YN, IT_PTL_STS_TC)` 후보 | `EstimateRepositoryImpl:41-43`, `V20260607_002:32-33` 외 3개 마이그레이션, 탐지: 2026-06-09 |
| ⬜ Open | 🟡 Medium | 사업집행 4단계 목록 정렬 컬럼 `FST_ENR_DTM DESC` 보조 인덱스 검토 — 건수 증가 시 FULL TABLE SCAN 후 정렬 발생 | `EstimateRepositoryImpl:63`, `Deliberation/Contract/PaymentRepositoryImpl` 동일, 탐지: 2026-06-09 |
| ⬜ Open | 🟡 Medium | `Deliberation/Contract/PaymentService.get()` 상세 조회 대상명 별도 SELECT 제거 — `loadCurrent()` + `resolveTargetName()` 2쿼리를 `EstimateRepositoryImpl`처럼 BPROJM/BCOSTM LEFT JOIN 프로젝션 단일 쿼리로 통일. 목록→상세 순차 로드 시 누적 N+1 | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176`, 탐지: 2026-06-09 |
| ⬜ Open | 🟡 Medium | `BPAYTM`(회차별 지급) `(DOC_MNG_NO, DOC_VRS_SNO, DEL_YN)` 보조 인덱스 검토 — PK에 DEL_YN 미포함으로 `findBy...AndDelYn()` 시 PK 범위 스캔 후 필터. 지급 회차 누적 시 IO 증가 | `V20260607_011:60`, `PaymentService.java:178`, 탐지: 2026-06-09 |
| ⬜ Open | 🟠 High | `TPRMPP_CMENUA` DEL_YN 인덱스 추가 — `findAllActive()`의 `DEL_YN='N'` 필터가 PK 외 인덱스 없이 수행. `(DEL_YN, MNU_ID)` 복합 인덱스 후보(`findActiveByMnuId`도 동시 이득) | `V20260603_007__CreateMenuTables.sql`, `CmenuaRepository`, 탐지: 2026-06-12 |
| ⬜ Open | 🟡 Medium | `TPRMPP_CMENUM` DEL_YN 인덱스 검토 — `IDX_CMENUM_TREE` 선두 컬럼이 `SRE_TC`라 `findAllActive()`에 미활용. 소규모 테이블이므로 `EXPLAIN PLAN` 확인 후 적용 판단 | `V20260603_007__CreateMenuTables.sql`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | `applyAthIds()` 적용 대상 최소화 — prune 이후 잔존 노드의 mnuId 집합 기준으로 권한 Map 구성 검토. 메뉴 권한 캐시 도입(2026-06-22 `MenuAuthMapProvider`) 완료됨 → 실익 재평가 | `MenuQueryService.java:62`, 탐지: 2026-06-12 |
| ⬜ Open | 🟡 Medium | [후속/T13] 캐시 TTL 미적용 보완 — 현재 `ConcurrentMapCacheManager`는 TTL 미지원. `tiptapMetadata`는 프로젝트 쓰기 시 stale 가능(`ProjectService` 쓰기경로에 `@CacheEvict` 추가 또는 Caffeine 도입 필요); `NotificationService` unread-count는 60s TTL 미적용(evict-on-write로 대체됨). Caffeine 전환 또는 쓰기경로 evict 보강 결정 필요 | `ProjectService`, `TiptapVariableService`(metadata), `NotificationService`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | [후속] `AdminMenuService.create()`/`delete()` `@Transactional` 누락(다중 쓰기) — Phase 4 캐시 evict-on-write 전제를 강화하기 위해 트랜잭션 경계 추가 권장 | `AdminMenuService`, 탐지: 2026-06-22 |
| ⬜ Open | 🟢 Low | [후속] `BtermmL.IND_RSN` `@Column(length=600)` — `TPRMPP_BTERML` DDL 대조해 `BcostmL`과 동일한 `@Column(length)` 드리프트 여부 확인 (BcostmL은 2026-06-22 정정 완료) | `BtermmL.java`, `TPRMPP_BTERML`, 탐지: 2026-06-22 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | `RichEditor.client.vue` → `TiptapEditor`/`TiptapToolbar` 마이그레이션 검토 (HTML 구조 차이·HtmlSanitizer 영향 선행 검토 필요)               | PrimeVue Quill 기반 구버전 에디터               |
| ⬜ Open | 🟡 Medium | `useProjectOptions.ts` 인라인 전환 검토 — `yearOptions` 배열만 반환하는 단순 composable                                                 | `pages/info/projects/form.vue` 1곳에서만 사용 |
| ⬜ Open | 🟢 Low | `ReviewVersionHistory.vue` 로컬 `formatDateTime()` 유지 여부 검토 — 축약 표시가 의도라면 함수명을 도메인 전용으로 변경 | `components/review/ReviewVersionHistory.vue` |
| ⬜ Open | 🟡 Medium | `info/index.vue` 정적 KPI/공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환 | 파일 헤더가 정적 데이터/향후 API 연결 예정임을 명시 |
| ⬜ Open | 🟠 High | 프론트 ESLint 오류 정리 — dead import, 미사용 변수, type-only import, 템플릿 파싱 오류 우선 처리 | 2026-05-14 `npm run lint` 기준 62 errors / 137 warnings. `EvalSummaryPanel.vue`, `result/[id].vue`, cost 컴포넌트 등 |
| ⬜ Open | 🟠 High | 전산업무비 컴포넌트 지급주기 prop 이름 정합화 — `dfrCleCOptions`와 호출부 `dfr-cle-options` 불일치 해소 | 2026-05-19 `npm run typecheck` 실패. `TerminalTableSection.vue`, `CostFormTableSection.vue`, `TerminalFormDialog.vue`, `pages/info/cost/form.vue` |
| ⬜ Open | 🟠 High | 협의회 결과 페이지 단일 template root 복구 | `pages/info/council-request/result/[id].vue`의 `EmployeeSearchDialog`가 루트 밖에 남아 `vue/no-multiple-template-root` 발생 |
| ⬜ Open | 🟡 Medium | `budget/list.vue` 탭 제거 후 잔여 dead code 정리 | 미사용 import/filter/pageSize/download 함수 다수 |
| ⬜ Open | 🟡 Medium | cost 컴포넌트 type-only import 및 미사용 환율 함수 정리 | `TerminalFormDialog.vue`, `CostFormTableSection.vue`, `TerminalTableSection.vue` lint 유형 |
| ⬜ Open | 🟢 Low | `ResultForm.vue` emit/type 선언 단순화 | `ResultData` 미사용, `'saved' | 'confirmed'` 단일 시그니처로 축약 가능 |
| ⬜ Open | 🟢 Low | `useTableColumnResize.ts` 숫자 파싱/배열 초기화 스타일 정리 | `Number.parseInt/parseFloat`, `Array.from` 등 일관 스타일 후보 |
| ⬜ Open | 🟡 Medium | 공통 `useDeptFilter` composable 구현 또는 규칙 폐기 결정 | 기존 CLAUDE 규칙과 달리 `app/composables/useDeptFilter.ts`가 없음 |
| ⬜ Open | 🟡 Medium | Tiptap 표 도구 계약 문서화 및 주석 보강 | `useTiptapTableTools.ts`, `TiptapTableFloatingToolbar.vue`가 복잡도 대비 계약 설명 부족 |
| ⬜ Open | 🟠 High | `pages/info/plan/[id].vue` 타입체크 실패 수정 — ExcelJS 컬럼 타입과 TiptapEditor `model-value` string 폴백 정리 | `npm run typecheck` 실패: `ws.columns`, `planData.*Cone` `string \| undefined` |
| ⬜ Open | 🟠 High | 프론트 typecheck 실패 현행화 — Nitro SSO 미들웨어 event 타입, color-scheme 플러그인 cookie decode 타입, vue-router/volar `sfc-route-blocks` export 호환성 확인 | 2026-06-01 `npm run typecheck` 실패: `server/middleware/sso-auth-redirect.ts`, `server/plugins/color-scheme.ts`, `vue-router/volar/sfc-route-blocks` |
| ⬜ Open | 🟠 High | 프론트 ESLint 오류 현행화 — 운영 코드 `any`, `ResultForm` emit overload, `useTableColumnResize` 배열 초기화, `result/[id].vue` 단일 template root, 테스트 mock 타입 정리 | 2026-06-01 `npm run lint -- --quiet` 기준 73 errors |
| ⬜ Open | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 목업 데이터 API 연동 | `pages/budget/summary.vue`, `pages/budget/comparison.vue`의 `MOCK_ROWS`/`MOCK_FSS_ROWS`/`MOCK_YOY_ROWS` TODO |
| ⬜ Open | 🟡 Medium | 관리자 화면 `사용여부` 옵션/태그 로직 중복 제거 | `pages/admin/auth-grades.vue`, `pages/admin/roles.vue`가 동일한 `useYnOptions`와 표시 로직을 각각 보유 |
| ⬜ Open | 🟡 Medium | `/admin/boards` 관리자 레이아웃 적용 여부 결정 | 페이지는 `middleware: 'admin'`만 선언하며, 다른 `/admin/**` 페이지와 달리 `layout: 'admin'`이 없음 |
| ⬜ Open | 🟡 Medium | `useNotifications` 모듈 스코프 싱글턴 상태(`unreadCount`, `items`, `loading`, `pollHandle`) — 테스트 간 누출·SSR 전역 공유 위험. Pinia 스토어(`stores/notification.ts`) 전환 또는 `useState()` 기반 SSR-safe ref 검토 | `composables/useNotifications.ts:17-21` |
| ⬜ Open | 🟢 Low | `useNotifications.refresh()` 명시적 호출 경로(드롭다운 열기 등)에 호출자 catch+toast 보장 여부 확인 — composable 계약상 에러 전파이나 AppHeader 등 실제 호출부에 toast 핸들링이 없을 수 있음 | `composables/useNotifications.ts` |
| ⬜ Open | 🟢 Low | 사업집행 3개 목록 페이지 대상구분 선택 Dialog 로직 공통화 — `deliberation/contract/payment/index.vue`가 `selectedTgt`/`selectedProject`/`selectedCost`/`hasTarget`/`selectedCncdRfrNo`/`resetSelection` 패턴을 중복 보유. `useProjectCostSelector()` composable 추출 | `pages/project/{deliberation,contract,payment}/index.vue:56~`, 탐지: 2026-06-09 |
| ⬜ Open | 🟢 Low | 사업집행 4개 composable `changeStatus(docNo, stsTc)` 중복 — URL만 다르고 구현 동일. 중장기 `useDocumentApi(baseUrl)` 팩토리 도입 시 일괄 처리 후보 | `useEstimates.ts:115`, `useDeliberations.ts:115`, `useContracts.ts:115`, `usePayments.ts:117`, 탐지: 2026-06-09 |
| ⬜ Open | 🟢 Low | `contract/index.vue` 빈 `/* ── 상태 표시 ── */` 주석 잔재 제거 — `estimate/index.vue`의 statusLabel 헬퍼 자리이나 contract에서는 함수 없이 주석만 남음 | `pages/project/contract/index.vue:57`, 탐지: 2026-06-09 |
| ⬜ Open | 🟠 High | `result/[id].vue` `reviewProgressEnabled`의 `s >= '05'` 문자열 사전순 비교 — `'SKIPPED' >= '05'`도 true라 생략된 협의회에서 위원 검토 패널이 노출될 수 있음. 허용 상태 집합(`Set.has`) 판정으로 교체 (FIXME 주석 등록 완료) | `pages/info/council-request/result/[id].vue:147`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | `AppSidebar.vue` 미사용 함수 `_isGroupExpanded` 제거 — 호출 0건, eslint-disable 지시어로 가려져 있음 | `AppSidebar.vue:176`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | 위원유형 라벨 로직 중복 정리 — `ScheduleStatus.vue` 로컬 맵(`{'01':'당연',...}`)을 `useCouncilCodes().getMemberTypeLabel`로 통일하고, `CommitteeList.vue`/`CommitteeSelector.vue`의 1줄 `typeLabel` 래퍼 제거 | `ScheduleStatus.vue:167-169`, `CommitteeList.vue:34`, `CommitteeSelector.vue:310`, 탐지: 2026-06-12 |

### ⚙️ 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| ⬜ Open | 🟡 Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| ⬜ Open | 🟡 Medium | 소요예산 산정 `EstimateRepositoryImpl.search()` QueryDSL에 대한 통합 테스트 부재 (프로젝트에 `@DataJpaTest` 인프라 없음, 현재 Mockito 단위테스트만). 단계별 화면 안정화 후 통합 테스트 보강 | `it_backend/src/test/.../estimate/repository/EstimateRepositoryTest.java`, 탐지: 2026-06-07 |
| ⬜ Open | 🟢 Low | `ApplicationContextHolder.publishEvent()` 잔여 이벤트 기반 감사로그 주석 정리 — `AuditLogEvent`는 2026-06-22 삭제됨, `ApplicationContextHolder` 측 잔여 참조/주석만 점검 | 현재 감사로그는 `ChangeLogEntityListener`가 `AuditLogPersister.persist()` 직접 호출 |
| ⬜ Open | 🟠 High | [후속] 테스트 스텁 정합 — `CostServiceTest`에 `@Mock CodeNameMapBuilder` 주입 추가(Phase 5 `CodeNameMapBuilder` 필드 도입으로 NPE 4건); `BudgetWorkServiceTest`의 단일키 finder 스텁(`findByGclMngNoAndDelYn`/`findByAbusMngNoAndDelYn`/`findByCostBgNoAndDelYn`)을 신규 배치 메서드(`findBy...InAndDelYn`) 스텁으로 갱신(Phase 4 N+1 배치화로 호출경로 변경). 두 파일은 미커밋 작업과 겹쳐 이번 작업에서 미수정. 전체 1422 tests 중 실패 6건이 이 스텁 불일치 | `CostServiceTest`, `BudgetWorkServiceTest`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | [후속/T18] 통합테스트 인프라 부재로 Task13-15(감사로그 리스너 통합테스트, `EstimateRepository` 통합테스트, `CinfmmRepositoryImplTest`) 미착수 — H2(strategy A) 또는 Oracle(strategy B) DB-backed 테스트 전략 결정 필요. 현재 `application-test.properties`는 DataSource/JPA 제외, H2/Testcontainers 의존성 없음. (참고: 기존 `NoClassDefFoundError` 대량실패는 재현 안 됨 — byte-buddy 1.18.10/mockito 5.23.0 Java25 정상) | `application-test.properties`, 탐지: 2026-06-22 (기존 NoClassDefFoundError 분석 항목 대체) |
| ⬜ Open | 🟡 Medium | [후속/T16] 목록 프로젝션 DTO 작업(`ProjectRepositoryImpl`/`CostRepositoryImpl` DTO, `@SqlResultSetMapping`, `CouncilRepository.findWithDetails`, 4단계 상세 JOIN) 별도 계획으로 분리됨 — 미착수 | `ProjectRepositoryImpl`, `CostRepositoryImpl`, `CouncilRepository`, 탐지: 2026-06-22 |
| ⬜ Open | 🟢 Low | [후속/minor] `CodeNameMapBuilder` 위치(`domain/budget/cost/util`)가 `ProjectService`와 공유되므로 `common` 패키지로 이동 검토 | `CodeNameMapBuilder`, 탐지: 2026-06-22 |

## 📝 PRD_20260517 Tiptap 변수 입력 후속 과제

- [ ] PRD_20260517 follow-up: 다음 페이지에 Tiptap 변수 prop 적용
      - app/pages/info/documents/[id]/index.vue
      - app/pages/info/plan/form.vue
      - app/pages/info/documents/form.vue
      - app/pages/board/** 상세
      - app/pages/guide/** 상세
- [ ] PRD_20260517 follow-up: E2E 시나리오 2/3/5 자동화 (사업별 / 실DB 갱신 / HWPX 내보내기)
- [ ] PRD_20260517 follow-up: Tiptap 변수 카테고리 매핑 (IT_BUDGET 일반관리비 포함 여부) 운영 데이터 검증
- [ ] PRD_20260517 follow-up: VariableNodeView 스크립트 - 작성 직후 resolveTokens 호출 (현재 LOADING 상태 표시)

### 🧪 수동 검증 체크리스트 (병합 후 확인)

- [ ] info/plan에서 변수 칩 정상 표시
- [ ] 다크모드 색상 대비 충분
- [ ] 키보드만으로 변수 삽입 가능
- [ ] NodeView aria-label 부여 확인 (DevTools)
- [ ] 모바일 뷰포트(768px 이하) 팝업 위치 정상

## 📡 실시간 로그 모니터링

- [ ] `/api/admin/realtime-logs` 통합/E2E 검증 — Flyway `V20260531_001` 적용 DB에서 관리자/일반사용자/미인증 접근과 since 커서 증분 조회 확인
- [ ] 라이브 피드 행 클릭 → 변경 본문(BEFORE/AFTER) 인라인 드릴다운 (`/admin/logs/[logKey]` 데이터 재사용)
- [ ] SSE 또는 WebSocket push 전환 (관리자 수·트래픽 증가 시)
- [ ] 로그 데이터 보존 정책 / 아카이브 분리 View
- [ ] 사용자별 즐겨찾기 테이블 필터 저장 (localStorage)
- [ ] `V_ITPAPP_LOG_FEED` 실행계획 `EXPLAIN PLAN` 검증 결과 기록 및 필요 시 복합 인덱스 도입
- [ ] Spring Boot bootRun 환경 셋업 후 V20260531_001 마이그레이션 적용 검증
- [ ] Playwright E2E (`tests/e2e/admin/realtime-logs.spec.ts`) 백엔드+프론트 dev 모드 기동 후 실제 실행

## 📬 공통 게시판 후속 과제

- [ ] `Bgdocm.docCone` BLOB → CLOB 마이그레이션 (게시판 도입 후 일관성 회복)
- [ ] 본문 검색 Oracle Text 인덱스 도입 (게시판당 1만 건/검색 1초 초과 시)
- [ ] 조회수 카운터 Redis 전환 (다중 인스턴스 운영 시)
- [ ] 알림(메일/슬랙) 연동 — 공지·중요 게시물 등록, 본인 게시물 댓글 알림
- [ ] 첨부파일 다운로드 카운트 컬럼 (`FL_DWN_NBR`) — 자료실 인기 자료 통계
- [ ] 댓글 첨부파일 지원 (ORC_DTT="공통게시판댓글" 추가)
- [ ] 답변글·댓글 최대 깊이 UI 5단계 캡 구현 (현재 무제한)
- [ ] 검색 키워드 최소 2자 강제 (현재 미적용)
- [ ] 본문 최대 크기 정책 결정 및 검증 추가 (현재 오픈이슈)
- [ ] 게시물 목록 서버사이드 페이지네이션 — 백엔드 `Page<T>` 응답 + 전체 건수 반환 (현재 클라이언트 페이징 size=1000)
- [ ] `board/index.vue` + `AppSidebar.vue` 공통 권한 필터 추출 (현재 `inqAthC` 로직 중복)
- [ ] 게시판 단위 테스트 확대 — `BoardMetaService`, `BoardPostService` 커버리지 80%+
- [ ] 게시판 첨부파일 UI/API 연결 — 현재 게시물 타입에 `flApgYn`, `flNbr`만 있고 파일 업로드 흐름은 미연동
- [ ] 게시판 권한 코드(`inqAthC`, `enrAthC`)가 `ROLE.ADMIN` 외 역할을 정확히 매핑하는지 프론트/백엔드 통합 테스트 추가

## 🔌 EAI (KDB 표준전문 발송)
- [ ] KDB EAI 운영팀으로부터 IT Portal 전용 **IF_ID(인터페이스ID)** 및 **UMS 템플릿(업무구분ID)** 발급·확정. (시스템 식별자 IPP/PRM/PP는 프로퍼티로 확정)
- [ ] 운영 프로파일에서 `eai.enabled=true` + `eai.url`(환경변수 `EAI_URL`) 주입, 배포 체크리스트 반영.
- [ ] (선택) `NotificationDispatcher` 실연동 어댑터로 `EaiService` 연결 — 알림톡/SMS/이메일 채널 발송.
- [ ] `EaiService` 도메인 미연동 해소 — `infra/eai` 전체가 구현·테스트 완비 상태이나 `Estimate/Deliberation/Contract/PaymentService` 어디서도 `EaiService.sendEai()`를 호출하지 않아 상태전이 시 EAI 알림이 실제 발송되지 않음. 각 `changeStatus()`에 발송 연결(부수효과, 실패 무전파) 검토. (발견일: 2026-06-09)
- [ ] 발신채널 상수(`1588-1500`, `hrd@kdb.co.kr`)는 ePAMS(eHR) 값 — IT Portal 발신처로 교체 필요 시 프로퍼티화.
- [ ] (코드리뷰 LOW-2) `eai.enabled=true`인데 `eai.url`이 비어 있으면 기동 시점 검증으로 차단 — `@PostConstruct` 또는 `EaiProperties` `@AssertTrue`. 현재는 첫 호출 시 `EaiResult.failure`로만 표면화되어 오설정이 조용히 누락될 수 있음.
- [ ] (코드리뷰 LOW-4) `EaiServiceTest`에 `umsTrSno=""`/비숫자 케이스 추가 — `Integer.parseInt` `NumberFormatException` → `EaiResult.failure` 경로 명시적 커버.
- [ ] (플러그형) GWE `RMS_SYS_C`("GWE")·`IF_ID`·`MSG_KEY` 접두("mailt") 실제 규칙 KDB 확인. GWE 발신자 상수(systemalert/관리자)·SYSTEM_CODE 운영값 확인.
- [ ] 신규 시스템 연동 시 EaiPayload(record) + EaiPayloadSection(@Component) 1쌍 추가 패턴 따름.

## 🏛️ 과업심의위원회 (Stage ②) 후속 과제

- [ ] 과업심의 목록 부서(bbrC) 필터 미적용 — 대상이 사업/전산업무비 2종이라 단일 join 곤란. 후속 고도화.

## 📒 메타 용어사전(table.csv) 정합성 후속 과제 (2026-06-11 스키마 통일 작업 잔여)

- [ ] 메타 미등재 테이블 12종 등재 — 사업집행 4단계(`BESTIM/BESTTM/BDELIM/BCONTM/BPAYMM/BPAYTM` + 각 `*L` 로그). 컬럼명은 이미 표준 명칭 사용 중. (`BCHKLC` 사전점검 항목은 2026-06-12 `V20260612_001`로 테이블 드롭되어 등재 불필요)
- [ ] 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 정정(N → Y) — 지급 회차는 지급일자 미확정(작성중) 상태로 저장될 수 있어 DB는 NULL 허용 유지(2026-06-12 결정, `V20260612_004` 헤더 참조). 운영 메타 NULL여부=N 등재가 stale — 정정 필요.
- [ ] BPOVWM 드롭된 `PRJ_BG_AMR`(테스트 1행) 값은 `RQM_BG_AMT`로 승계되지 않음 — 운영 데이터 이관 시 소요예산금액 원천 확인 필요.
- [ ] `TPRMPP_BBUGTM` PK 정합 보류 — 운영(table.csv)은 PK(`BG_NO`) 단일이나 로컬은 PK(`BG_NO`,`SNO`)이고 `BG_NO` 중복 20건 존재. 운영 PK 정의 재확인(메타 stale 가능성) 또는 로컬 데이터 중복 정리 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
- [ ] `TPRMPP_BRDOCM` PK 정합 보류 — 운영은 PK(`DOC_MNG_NO`) 단일이나 로컬은 PK(`DOC_MNG_NO`,`DOC_VRS_SNO`)이고 중복 2건 존재. 문서 버전 관리 구조상 운영 PK 정의 재확인 필요. 해소 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
