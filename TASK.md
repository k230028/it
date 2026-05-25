# IT Portal 백로그

> 기준일: 2026-05-26
> 목적: `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

## 진행 중

> 최종 업데이트: 2026-05-19

### 보안

| 상태     | 우선순위     | 과제                                                                                                                                            | 근거                                                                                    |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| [Open] | Critical | `application.properties` 비밀값 기본값(`DB_PASSWORD`, `JWT_SECRET`) 제거 — 현재 기본값 때문에 환경변수 미설정 시에도 `EnvironmentValidator`를 통과함                        | `spring.datasource.password=${DB_PASSWORD:kdb1234!!}`, `jwt.secret=${JWT_SECRET:...}` |
| [Done] | High     | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                                         | `FileOwnershipChecker` 적용, `GeminiController` ADMIN 전용                                |
| [Done] | High     | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                                              | `LoginAttemptService` 구현, `AuthService.login()` 연동                                    |
| [Done] | High     | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                                                  | `FileValidator` 구현, `FileService` 연동                                                  |
| [Open] | Medium   | 운영 프로파일에서 `app.cookie.secure=true`, `cors.allowed-origins` 실제 오리진 강제 설정 및 구동 시 검증                                                             | 기본값이 각각 `false`, `localhost`이므로 환경변수 미설정 시 보안 취약                                      |
| [Open] | Medium   | `gemini.api.key` 운영 필수 여부 결정 후 `EnvironmentValidator` 검증 대상에 포함 또는 Gemini 기능 비활성 정책 명시                                                        | 현재 `EnvironmentValidator`는 `spring.datasource.password`, `jwt.secret`만 검사             |
| [Open] | Medium   | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                                       | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈                                                   |
| [Open] | Medium   | X-Forwarded-For 신뢰 프록시 목록 제한 — Nginx 등에서 헤더 덮어쓰기 설정 적용                                                                                        | `AuthController.getClientIp()`가 헤더 무조건 신뢰                                             |
| [Open] | Medium   | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                                          | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요                                           |
| [Open] | Medium   | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드가 일시적으로 관리자 화면을 노출하지 않는지 E2E 검증                                                                            | 프론트 쿠키는 UX 상태이며 최종 권한은 백엔드가 판단해야 함                                                    |
| [Open] | Medium   | SSO 운영 설정 검증 강화 — `app.sso.allow-direct-eno=false`, `app.frontend-url` 실제 값, 프록시 헤더 덮어쓰기 점검                                                   | `SsoController`, `AuthController.getClientIp()` 운영 안전장치                               |
| [Open] | High     | Refresh Token Rotation 도입 — `/api/auth/refresh` 호출 시 Access Token뿐 아니라 Refresh Token도 신규 발급·DB 교체                                             | `AuthService.java:206-236` 현재 Access만 재발급, 탈취 시 7일간 유효                                |
| [Open] | Medium   | Access Token Blocklist 도입 검토 — 로그아웃 시 잔존 토큰(최대 15분) 무효화 필요 여부 결정                                                                              | `AuthService.logout()` Stateless 한계, 고보안 시나리오용                                        |
| [Open] | Medium   | `SecurityConfig.CorsConfiguration#allowedHeaders` `List.of("*")` → 실제 사용 헤더(Content-Type, Authorization 등) 명시 화이트리스트                          | `SecurityConfig.java:200` 운영 헤더 제한 미적용                                                |
| [Open] | Medium   | `SecurityConfig` 관리자 URL 패턴 `/api/plan/**`을 실제 `PlanController` 경로 `/api/plans/**`와 일치하도록 정비 | 현재는 클래스 레벨 `@PreAuthorize`가 보호하지만 이중 보호 문서/코드가 불일치 |
| [Open] | Medium   | `UserDto.DetailResponse`의 휴대폰/내선/이메일 노출 권한 검증 — `UserController` 본인 또는 ADMIN 한정 응답 처리 확인                                                      | `UserDto.java`, `UserController.java:72`                                              |
| [Open] | High     | `CodeController.createCcodem()`/`updateCcodem()` `@Valid` 추가 — Bean Validation이 컨트롤러 진입 시 동작하도록 일관성 확보                                        | `CodeController.java:68,81`                                                           |
| [Open] | High     | `FileController` 다운로드/미리보기/단건조회/목록조회에 파일 읽기 권한 검증 적용 | `downloadFile()`/`previewFile()`이 `FileOwnershipChecker.checkReadAccess()` 없이 `fileService.downloadFile()` 직접 호출 |
| [Open] | High     | `FileController.updateFileMeta()`와 `deleteFilesByOrc()`에 소유권 또는 관리자/도메인 권한 검증 추가 | 인증 사용자라면 임의 `flMngNo` 또는 `orcDtt+orcPkVl`로 메타 수정/일괄 삭제 호출 가능 |
| [Open] | Medium   | `NotificationController` `size` 파라미터 상한 미적용 — `GET /api/notifications?size=100000` 식의 비정상 페이지 크기 방지를 위해 `@Max(100)` 또는 서비스 내 클램핑 추가 | `NotificationController.java` |
| [Open] | Medium   | Gemini 요청 DTO 검증 추가 — `@NotBlank`, `@Size`, 첨부 개수 제한 적용 | `GeminiDto.Request`, `GeminiService.generate()` |
| [Open] | Medium   | Gemini 첨부 파일 실제 크기 제한 구현 | DTO 주석의 파일당 20MB 제한과 달리 `Files.readAllBytes(filePath)` 전 크기 검사 코드 없음 |
| [Open] | High     | 리소스 미존재 시 HTTP 404 반환을 위한 전용 `NotFoundException` 도입 + `GlobalExceptionHandler` 매핑                                                             | `UserController.java:72`, `GuideDocService.java:65,129,154` — 현재 400 반환               |
| [Open] | High     | `ResponseStatusException` 전용 핸들러 추가 — 서비스에서 던진 404/500 상태가 `RuntimeException` 포괄 핸들러에 의해 400으로 바뀌지 않도록 분리 | `GlobalExceptionHandler.java`, `PlanService.java` |
| [Open] | Medium   | `CustomUserDetails` — `athIds` 클레임 타입 불일치 시 `log.warn` 추가 (권한 강등 탐지 어려움) | `JwtUtil` / `CustomUserDetails` 관련 클레임 파싱 경로 |
| [Open] | Medium   | 사번(`eno`) PII INFO 로그 정책 정립 — DEBUG 강등 또는 마스킹 처리                                                                                              | `CouncilService.java:94`, 기타 로그인 이력 출력 위치 전수 검토                                       |

### 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | High | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| [Done] | High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `ReviewerController` + `ReviewerService` TDD 구현, `stores/review.ts` API 연동 |
| [Open] | Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| [Open] | Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태     | 우선순위     | 과제                                                                                                                                                                                                  | 근거                                                                               |
| ------ | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Done] | High     | `SsoController.complete()` catch 블록에 `log.error()` 추가                                                                                                                                               | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재                                                 |
| [Done] | High     | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달                                                                                                                | 스택 트레이스 손실 — FIXME 주석 존재                                                         |
| [Done] | High     | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·`ApprovalLineDelegate` 위임 메서드 추출                                                                                      | Spring AOP 무효 — FIXME 주석 존재                                                      |
| [Done] | High     | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생)                                                                                                                              | @Transactional 컨텍스트에서 롤백 없이 커밋됨                                                  |
| [Open] | High     | `NotificationService.send()` — `recipientEno` 미입력 시 `null` 반환 (NPE 위험). `Optional<Cinfmm>` 또는 예외 처리로 교체 | `NotificationService.java:56-58` |
| [Open] | High     | `NotificationEventListener.onApprovalCompleted()` — AFTER_COMMIT 페이즈 내 `applicationRepository.findById()` 호출이 외부 트랜잭션 종료 후 수행되어 Lazy 연관 접근 시 `LazyInitializationException` 발생 가능. `@Transactional(REQUIRES_NEW)` 추가 또는 `send()` 내부로 이동 필요 | `NotificationEventListener.java:57-58` |
| [Open] | Low      | `NotificationEvent` `infTtl`(100자)·`infCone`(300자) 길이 제한이 JavaDoc에만 명시되고 `send()` 내에서 강제 적용되지 않음 — 초과 시 `ORA-12899` 런타임 오류로 알림 유실 | `NotificationService.java:send()`, `NotificationEvent.java` |
| [Open] | Medium   | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204`                                                                                                                                      | UX 불일치 — TODO 주석 존재                                                              |
| [Open] | Medium   | 프론트엔드 toast 알림 누락 다발 보완 (`useCostListPage`, `projects/form.vue`, `budget/report.vue`, `terminal/[id].vue` 등)                                                                                        | catch 블록 사용자 피드백 없음 — TODO 주석 존재                                                 |
| [Open] | High     | 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강                                                                                                                                                                    | `pages/info/documents/[id]/review.vue` 자동 저장 catch가 실패를 삼킴                       |
| [Open] | Medium   | 사전협의 버전/코멘트/검토자 API 실패 표시 보강                                                                                                                                                                        | `stores/review.ts`, `pages/info/documents/[id]/index.vue` 실패 시 빈 상태 폴백           |
| [Open] | Medium   | 전산업무비 일괄 업로드 실패 행/원인 로깅 및 결과 상세화                                                                                                                                                                    | `useCostListPage.ts` 행별 catch에서 실패 수만 증가                                         |
| [Open] | Medium   | HWPX 내보내기 이미지 누락 진단 강화                                                                                                                                                                              | `useHwpxExport.ts` 이미지 fetch 실패 시 null 반환                                        |
| [Open] | Medium   | Gemini 파일 첨부 실패 로그 보강                                                                                                                                                                               | `GeminiService.java` 파일 읽기 실패 시 skip만 반환                                         |
| [Open] | Medium   | 감사로그 `delYn` 리플렉션 실패 시 경고 로그 및 변경유형 판정 검증                                                                                                                                                           | `ChangeLogEntityListener.java` 실패 시 `U`로 폴백                                      |
| [Open] | Medium   | Java 파일 헤더 주석 전수 보강                                                                                                                                                                                 | 다수 Java 파일이 `package`로 바로 시작하며 파일 역할/흐름/연동 테이블 헤더가 없음                            |
| [Open] | Medium   | `AdminDto` 잔여 DTO JavaDoc 보강                                                                                                                                                                        | 자격등급/사용자/조직/역할/로그인 이력/토큰/첨부파일/통계 DTO는 기본 설명만 존재                                  |
| [Open] | Critical | `ApplicationService.getApplicationsByIds()`·`ProjectService.findByIds()`·`CostService.findByIds()` — `IllegalArgumentException` catch 후 `null` 반환 + `Objects::nonNull` 필터 패턴 제거. 실패 항목 수가 호출자에게 가려짐 | `ApplicationService.java:440`, `ProjectService.java:564`, `CostService.java:351` |
| [Open] | High     | `ChangeLogEntityListener.beforeAnyOperation()` `catch (Exception e)` — 감사로그 영속화 실패 시 스택 트레이스 + 알람 필요                                                                                                | `ChangeLogEntityListener.java:75` 현재 `log.warn`만                                 |
| [Open] | High     | `GeminiService` `RestClient`에 `connectTimeout`/`readTimeout` 설정 — Gemini API 응답 지연 시 스레드 풀 고갈 가능                                                                                                    | `GeminiService.java:98` 타임아웃 미지정                                                 |
| [Open] | High     | `PlanService.applyExistingPlanSnapshot()` 빈 `catch (JsonProcessingException) {}` — 스냅샷 파싱 실패 시 카운트 0 폴백으로 잘못된 예산 보고서 산출                                                                             | `PlanService.java:108`                                                           |
| [Open] | High     | `useTiptapImageInsertion.ts` 임시 blob URL 미해제 — 이미지 업로드 실패 catch 경로 + 성공 경로 모두 `URL.revokeObjectURL()` 보장                                                                                            | `useTiptapImageInsertion.ts:60,111,135` 메모리 누수 위험                                |
| [Open] | Medium   | `usePdfReport.ts` 한글 폰트 로드 실패 시 Roboto 폴백 — 한글 문자 깨짐 가능, 사용자 경고 토스트 추가                                                                                                                              | `usePdfReport.ts:174` 무경고 폴백                                                     |
| [Open] | Medium   | Excalidraw/HWPX/Tiptap 실패 경로 사용자 알림 보강 — 내보내기 실패, 장면 복원 실패, 이미지 누락을 빈 결과와 구분 | `ExcalidrawWrapper.vue`, `ExcalidrawNodeView.vue`, `useHwpxExport.ts`, `hwpx-images.ts`, `useTiptapTableTools.ts` |
| [Open] | Medium   | 손상된 `it-portal-user` 쿠키와 구버전 `localStorage.user` 파싱 실패 시 warn 로그 및 정리 정책 추가 | `stores/auth.ts` |
| [Open] | Critical | `info/projects/form.vue:604-606` — 편집 모드 데이터 로드 실패 시 빈 폼 표시, 사용자가 저장하면 기존 프로젝트 전체 데이터 덮어쓰기 위험. 실패 즉시 `toast.error` 후 목록 리다이렉트 필수 | `pages/info/projects/form.vue:604-606`, 발견일: 2026-05-26 |
| [Open] | High     | `approval/list.vue:213-214` — 결재 처리 실패 시 `console.error`만 출력, `toast.error` 사용자 알림 없음 (CLAUDE.md 4.2.1 위반) | `pages/approval/list.vue:213-214`, 발견일: 2026-05-26 |
| [Open] | High     | `approval/[apfMngNo].vue:48-49` — 결재 상세 로드 실패 시 빈 화면 노출. `toast.error` 알림 및 목록 리다이렉트 필요 | `pages/approval/[apfMngNo].vue:48-49`, 발견일: 2026-05-26 |
| [Open] | High     | `board/[blbMngNo]/[nacMngNo]/index.vue:38` — `catch {}` 완전 빈 블록, 에러 변수·로그·toast 모두 없음. 빈 게시글 페이지 노출 | `pages/board/[blbMngNo]/[nacMngNo]/index.vue:38`, 발견일: 2026-05-26 |
| [Open] | High     | `EmployeeSearchDialog.vue:88-91,204-210` — 조직도 트리 로드 실패 및 부서원 목록 실패 시 `console.error`만 출력. `toast.error` 알림 추가 필요 | `components/common/EmployeeSearchDialog.vue`, 발견일: 2026-05-26 |
| [Open] | High     | `ExcalidrawWrapper.vue:85-89,150-153` — `exportData()` 실패 시 `null` 반환으로 다이어그램 저장 silently 실패, 초기화 실패 시 빈 에디터 노출. 예외 전파 또는 `toast.error` 필요 | `components/ExcalidrawWrapper.vue`, 발견일: 2026-05-26 |
| [Open] | High     | `useEmployeeSearch.ts:75-77` — 직원 검색 API 실패 시 `console.error`만 출력. `toast.error` 알림 및 실패/결과 없음 상태 구분 필요 (CLAUDE.md 4.2.1 위반) | `composables/useEmployeeSearch.ts:75-77`, 발견일: 2026-05-26 |
| [Open] | High     | `useGlobalSearch.ts:75-79` — 글로벌 검색 실패 시 `suggestions.value = []` silent fallback. 경고 로그 및 인라인 오류 표시 검토 필요 | `composables/useGlobalSearch.ts:75-79`, 발견일: 2026-05-26 |
| [Open] | High     | `useCostListPage.ts:366-368` — 코드 로드 실패 시 `console.error`만 출력. `toast.error` 알림 추가 필요 (CLAUDE.md 4.2.1 위반) | `composables/useCostListPage.ts:366-368`, 발견일: 2026-05-26 |
| [Open] | High     | `budget/report.vue:170-172,249-251` — PDF 생성 실패 시 `console.error`만 출력, 데이터 로드 실패 시 PDF 버튼 활성 유지. `toast.error` 및 버튼 비활성화 처리 필요 | `pages/budget/report.vue:170-172,249-251`, 발견일: 2026-05-26 |
| [Open] | High     | `info/projects/report.vue:164-166,199-201` — PDF 생성 실패 시 `console.error`만 출력, 프로젝트 로드 실패 시 PDF 버튼 비활성화 안됨. `toast.error` 및 버튼 비활성화 필요 | `pages/info/projects/report.vue:164-166,199-201`, 발견일: 2026-05-26 |
| [Open] | High     | `info/cost/form.vue:184-186` — 비용 폼 초기 데이터 로드 실패 시 `console.error`만 출력. `toast.error` 알림 및 에러 상태 UI 처리 필요 (CLAUDE.md 4.2.1 위반) | `pages/info/cost/form.vue:184-186`, 발견일: 2026-05-26 |

### DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Done] | High | `BudgetWorkService.getSummary()` — 비목 루프 내 `findApprovedCostsByPrefix`/`findApprovedItemsByPrefix` N+1 → 단일 집계 쿼리 통합 | `BudgetWorkQueryRepository` 개선 완료 |
| [Open] | High | `BudgetWorkService.getProjectSummary()` — BBUGTM 루프 내 `gclMngNo→prjMngNo` 개별 SELECT + `resolveProjectName()` 사업별 SELECT → IN절 일괄 조회 | `BudgetWorkService.java L600, L683` |
| [Open] | High | `BudgetWorkService.applyRates()` — 원본 레코드별 개별 Upsert SELECT → 벌크 처리 또는 Oracle MERGE INTO 전환 | `BudgetWorkService.java L150-213` |
| [Done] | High | `CAPPLA` 테이블 복합 인덱스(`ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO`) 존재 여부 DDL 확인 및 미비 시 추가 | `V20260510_001__add_cappla_composite_index.sql` |
| [Done] | High | `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 존재 여부 확인 및 미비 시 추가 | `V20260510_002__add_bitemm_prj_mng_no_index.sql` |
| [Open] | High | `CostService.enrichCostListBatch()` 단말기 첨부 N+1 제거 — 단말기 행별 `attachTerminals()` 개별 조회를 일괄 조회로 전환 | `CostService.java L508, L531, L598` |
| [Done] | High | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입으로 시그니처 단순화 | `Bprojm.java` 리팩토링 완료 |
| [Open] | Medium | `BudgetWorkService.applyItemRates()` 전체 연도 BBUGTM 메모리 로드 + 루프 Soft Delete → `@Modifying` 벌크 UPDATE | `BudgetWorkService.java L243-244` |
| [Open] | Medium | `CouncilRepository.updateProjectStatus()` `@Modifying` Native Query 후 1차 캐시 stale → `clearAutomatically=true` 또는 엔티티 기반 업데이트 | `CouncilRepository.java L67` |
| [Open] | Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 API용 DTO 프로젝션 (1000자 텍스트 컬럼 제외) | `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| [Open] | Medium | Native Query `Object[]` 반환 → DTO 프로젝션 또는 `@SqlResultSetMapping` 적용 | `CouncilRepository`, `ApplicationRepository`, `ServiceRequestDocRepository`, `LoginHistoryRepository`, `EvaluationRepository` |
| [Open] | Medium | `ProjectService.enrichProjectListBatch()` 사업별 비목 요약 N+1 제거 — BITEMM을 사업 키 묶음으로 일괄 조회 | `ProjectService.java L662, L684, L783` |
| [Open] | Medium | `ApplicationService.getPendingCount()` full entity 조회 후 `.size()` → `count` 쿼리 전환 | `ApplicationService.java L535`, `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| [Open] | Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → `flush()` 명시 또는 Spring Data `deleteAll` 통일 | `FeasibilityService.java L225` |
| [Open] | Medium | 협의회 일정/평가 사용자명 조회 N+1 제거 | `ScheduleService`, `EvaluationService`에서 사번별 `findByEno()` 반복 |
| [Open] | Medium | 협의회 위원/상태 조회 배치화 검토 | `CommitteeService`, `CouncilService` 반복 조회 후보 |
| [Open] | High | 결재 대기/대시보드 쿼리 인덱스 보강 검토 | `ApplicationRepository`가 `CDECIM.DCD_ENO`, `DCD_DT`, `CAPPLM.APF_STS`, `RQS_DT` 기준 조회. 후보: `CDECIM(DCD_ENO, DCD_DT, DCD_MNG_NO)`, `CAPPLM(APF_STS, RQS_DT DESC)` |
| [Open] | High | 요구사항 정의서 대시보드 `BRDOCM`/`BRIVGM` 보조 인덱스 검토 | `ServiceRequestDocRepository`가 `FST_ENR_USID`, `DEL_YN`, `FST_ENR_DTM`, `DOC_MNG_NO`, `FSG_YN` 조건 반복 사용 |
| [Open] | Medium | 협의회 목록 `BASCTM`/`BCMMTM` 역방향 조회 인덱스 검토 | 후보: `BASCTM(PRJ_MNG_NO, PRJ_SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, ASCT_ID)` |
| [Open] | Medium | `ReviewCommentService` 검토의견 작성자명 조회 N+1 제거 | 댓글 목록 행마다 `userRepository.findById()` 호출. 사번 일괄 조회 또는 조인 프로젝션 검토 |
| [Open] | Medium | `CouncilRepository.findWithDetails()` Native Query `Object[]` 전용 DTO/projection 전환 우선 처리 | 16개 컬럼 순서와 서비스 캐스팅이 강하게 결합되어 오매핑 위험 |
| [Done] | Critical | `TPRMPP_CINFMM` 테이블명 매핑 확인 — V20260520_001이 `TAAABB_CINFMM` 생성, V20260521_006(line 60)이 `TPRMPP_CINFMM`으로 RENAME. 마이그레이션 체인 정상 확인. 엔티티 `@Table` 매핑 유효 | 2026-05-22 직접 검증 |
| [Open] | Medium | `CinfmmRepositoryImpl.markAllReadByRcvUsid()` QueryDSL 벌크 UPDATE 후 `LST_CHG_DTM`/`LST_CHG_USID` 미갱신 — JPA Auditing 우회, 1차 캐시 stale 발생. `clearAutomatically` 또는 감사 컬럼 명시 SET 추가 | `CinfmmRepositoryImpl.java:67-78` (→ `CouncilRepository.java:67` 동일 패턴 참조) |
| [Open] | Medium | `GET /api/notifications/unread-count` — 사용자당 60초 폴링 × 3,000명 = 상시 DB `COUNT(*)`. `@Cacheable` (TTL 60s, per-user key) 또는 SSE 전환으로 DB 부하 경감 | `NotificationService.java:94-97` |
| [Open] | Medium | `TiptapVariableService.resolve()` — 토큰별 개별 집계 쿼리(최대 200 토큰 × 2쿼리 = 400 DB 호출). 동일 `(year, category)` 결과를 인트라-요청 Map으로 캐시 후 배치 처리로 전환 | `TiptapVariableService.java:74-80` |
| [Open] | Medium | `TiptapVariableService.getMetadata()` — 활성 사업 전체 목록을 매 호출마다 DB 조회. `@Cacheable` + 사업 변경 시 evict 또는 사업 코드 검색 파라미터로 온디맨드 조회 전환 | `TiptapVariableService.java:44-55` |
| [Open] | Low    | `SEQ_CINFMM NOCACHE` 설정 — 대량 알림 발송 시 시퀀스 redo 경합. `CACHE 20` 이상으로 변경하는 마이그레이션 추가 | `V20260520_001__CreateCinfmmTable.sql:78-83` |

### 프론트엔드 리팩토링

| 상태     | 우선순위   | 과제                                                                                                                      | 근거                                      |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [Done] | High   | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 — 실제 컴포넌트가 `components/ApplicationViewerDialog.vue`로 이전됨       | auto-import 이름 충돌 위험 해소                 |
| [Done] | High   | `formatDateTime` 중복 구현 통합 — `utils/common.ts`, `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` 3개 상이한 구현 | `utils/common.ts` 단일 구현으로 통합             |
| [Open] | Medium | `RichEditor.client.vue` → `TiptapEditor`/`TiptapToolbar` 마이그레이션 검토 (HTML 구조 차이·HtmlSanitizer 영향 선행 검토 필요)               | PrimeVue Quill 기반 구버전 에디터               |
| [Open] | Medium | `useProjectOptions.ts` 인라인 전환 검토 — `yearOptions` 배열만 반환하는 단순 composable                                                 | `pages/info/projects/form.vue` 1곳에서만 사용 |
| [Open] | Low | `ReviewVersionHistory.vue` 로컬 `formatDateTime()` 유지 여부 검토 — 축약 표시가 의도라면 함수명을 도메인 전용으로 변경 | `components/review/ReviewVersionHistory.vue` |
| [Open] | Medium | `info/index.vue` 정적 KPI/공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환 | 파일 헤더가 정적 데이터/향후 API 연결 예정임을 명시 |
| [Open] | High | 프론트 ESLint 오류 정리 — dead import, 미사용 변수, type-only import, 템플릿 파싱 오류 우선 처리 | 2026-05-14 `npm run lint` 기준 62 errors / 137 warnings. `EvalSummaryPanel.vue`, `result/[id].vue`, cost 컴포넌트 등 |
| [Open] | High | `useCouncilCodes.ts` 코드명 필드 불일치 수정 — `CodeItem`은 `cdvaNm`을 정의하지만 매핑 로직은 존재하지 않는 `cNm`을 사용 | 2026-05-19 `npm run typecheck` 실패. `statusMap`/`hearingMap`/`memberTypeMap`에서 실제 CCODEM 응답 필드 SoT 확인 필요 |
| [Open] | High | 전산업무비 컴포넌트 지급주기 prop 이름 정합화 — `dfrCleCOptions`와 호출부 `dfr-cle-options` 불일치 해소 | 2026-05-19 `npm run typecheck` 실패. `TerminalTableSection.vue`, `CostFormTableSection.vue`, `TerminalFormDialog.vue`, `pages/info/cost/form.vue` |
| [Open] | High | 협의회 평가 요약 템플릿 닫힘 구조 정리 | `EvalSummaryPanel.vue` `vue/no-parsing-error`, `x-invalid-end-tag` 발생 |
| [Open] | High | 협의회 결과 페이지 단일 template root 복구 | `pages/info/council-request/result/[id].vue`의 `EmployeeSearchDialog`가 루트 밖에 남아 `vue/no-multiple-template-root` 발생 |
| [Open] | Medium | `budget/list.vue` 탭 제거 후 잔여 dead code 정리 | 미사용 import/filter/pageSize/download 함수 다수 |
| [Open] | Medium | cost 컴포넌트 type-only import 및 미사용 환율 함수 정리 | `TerminalFormDialog.vue`, `CostFormTableSection.vue`, `TerminalTableSection.vue` lint 유형 |
| [Open] | Low | `ResultForm.vue` emit/type 선언 단순화 | `ResultData` 미사용, `'saved' | 'confirmed'` 단일 시그니처로 축약 가능 |
| [Open] | Low | `useTableColumnResize.ts` 숫자 파싱/배열 초기화 스타일 정리 | `Number.parseInt/parseFloat`, `Array.from` 등 일관 스타일 후보 |
| [Open] | Medium | 공통 `useDeptFilter` composable 구현 또는 규칙 폐기 결정 | 기존 CLAUDE 규칙과 달리 `app/composables/useDeptFilter.ts`가 없음 |
| [Open] | Medium | Tiptap 표 도구 계약 문서화 및 주석 보강 | `useTiptapTableTools.ts`, `TiptapTableFloatingToolbar.vue`가 복잡도 대비 계약 설명 부족 |
| [Open] | High | `pages/info/plan/[id].vue` 타입체크 실패 수정 — ExcelJS 컬럼 타입과 TiptapEditor `model-value` string 폴백 정리 | `npm run typecheck` 실패: `ws.columns`, `planData.*Cone` `string \| undefined` |
| [Open] | Medium | `/admin/boards` 관리자 레이아웃 적용 여부 결정 | 페이지는 `middleware: 'admin'`만 선언하며, 다른 `/admin/**` 페이지와 달리 `layout: 'admin'`이 없음 |
| [Open] | Medium | `useNotifications` 모듈 스코프 싱글턴 상태(`unreadCount`, `items`, `loading`, `pollHandle`) — 테스트 간 누출·SSR 전역 공유 위험. Pinia 스토어(`stores/notification.ts`) 전환 또는 `useState()` 기반 SSR-safe ref 검토 | `composables/useNotifications.ts:17-21` |
| [Open] | Low    | `useNotifications.refresh()` 명시적 호출 경로(드롭다운 열기 등)에 호출자 catch+toast 보장 여부 확인 — composable 계약상 에러 전파이나 AppHeader 등 실제 호출부에 toast 핸들링이 없을 수 있음 | `composables/useNotifications.ts` |

### 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 | Java 25 환경, 가독성·불변성 향상. `common/board` 포함 다수 잔존 |
| [Open] | Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| [Open] | Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| [Open] | High | 백엔드 테스트 대량 `NoClassDefFoundError`/`ClassNotFoundException` 원인 분석 | 2026-05-17 `./gradlew test` 기준 compileJava 통과 후 194 tests 중 155 failed, Spring context/Mockito 초기화 단계에서 실패 |
| [Open] | High | 알림 시스템 백엔드 단위·통합 테스트 추가 — `NotificationServiceTest`(Mockito), `MentionExtractorTest`(순수 단위), `CinfmmRepositoryImplTest`(Testcontainers/H2). 커버리지 대상: 빈 수신자 가드, REQUIRES_NEW 전파, markAllRead 행 수, 멘션 추출 엣지케이스 | `it_backend/src/test/` — notification 패키지 테스트 없음 |
| [Open] | High | Tiptap 변수 시스템 백엔드 단위 테스트 추가 — `TiptapTokenParserTest`(정규식·switch·IllegalArgumentException), `TiptapVariableServiceTest`(Mockito: MISSING/INVALID·금액 포맷·null 가드) | `it_backend/src/test/` — tiptap 패키지 테스트 없음 |
| [Open] | Low | `AuditLogEvent.java` → Java record 전환 | Java 25 환경, 3개 필드 + getter 구성 |
| [Open] | Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | JOIN + WHERE + GROUP BY 동일 패턴, 집계 기준 컬럼만 다름 |
| [Open] | Low | `ApplicationContextHolder.publishEvent()`/`AuditLogEvent` 잔여 이벤트 기반 감사로그 주석 정리 | 현재 감사로그는 `ChangeLogEntityListener`가 `AuditLogPersister.persist()` 직접 호출 |

## 완료

| 상태 | 일자 | 영역 | 조치 |
|------|------|------|------|
| [Done] | 2026-05-26 | 백로그 | REVIEW.md Task 4 — refactor-cleaner·database-reviewer·silent-failure-hunter 분석. `task1-silent-failures.md` HIGH 이상 항목 전수 검토 후 신규 14건(Critical 1·High 13) 에러 처리 섹션에 등록. 기존 항목 완료 여부 코드 확인(모두 Open 유지). 기준일 2026-05-26 갱신. |
| [Done] | 2026-05-22 | 주석 | REVIEW.md Task 1 — java-reviewer·typescript-reviewer·silent-failure-hunter·comment-analyzer 병렬 분석. `@Valid` 누락 FIXME(ApplicationController, ProjectController, PlanController), `@Transactional(readOnly=true)` TODO(PlanService), 유니코드 이스케이프 TODO(CouncilService), 빈 catch [HIGH] TODO 3건(stores/review.ts), FIXME(budget/report.vue), 폴링 정책 주석 보강(useNotifications.ts), 고아 JavaDoc 삭제(NotificationService.java) |
| [Done] | 2026-05-22 | 문서 | REVIEW.md Task 2/3 — BE/FE README.md 및 CLAUDE.md에 알림 시스템(common/notification), Tiptap 변수 시스템(common/system/tiptap) 섹션 추가. 컴포넌트 72개·Composable 48개 카운트 갱신. 루트 README §18.10 현행화 메모 추가 |
| [Done] | 2026-05-17 | 주석 | REVIEW.md Task 1 재실행 — Java/TypeScript 주석 불일치 교정, Excalidraw/HWPX/Tiptap/Auth 실패 경로 TODO/FIXME 추가, `Bcmmtm.cnfmYn` 컬럼 comment 보강 |
| [Done] | 2026-05-19 | 주석/문서 | REVIEW.md 재점검 — 깨진 한글 주석, JavaDoc 위치 오류, 게시판 QueryDSL 설명, 관리자 미들웨어 적용 범위 문서 보강 |
| [Done] | 2026-05-17 | 문서 | 루트/백엔드/프론트 README·CLAUDE 현행화 — 테스트 수, Nuxt 버전, 실제 API 경로(`/api/cost`, `/api/plans`), Gemini 관리자 권한, 감사로그 저장 시점 정정 |
| [Done] | 2026-05-16 | 주석 | java-reviewer / typescript-reviewer / silent-failure-hunter 탐지 후 comment-analyzer로 48개 파일에 한글 주석/FIXME 마커 적용 (`TaskNotes/review_task1_applied.md`) |
| [Done] | 2026-05-16 | 문서 | 루트/it_backend/it_frontend README·CLAUDE.md 현행화 — 모노레포 구조, 캐시 전략(@Cacheable codesByCid·budgetPeriod), @Valid 일관성, 감사로그 BaseLogEntity 패턴, 이벤트 리스너 선택 기준, 프론트 에러 처리/Pinia 에러 전파 규칙 추가 |
| [Done] | 2026-05-16 | 보안 | security-reviewer 10개 보안 규칙 감사 — 신규 Critical/High 항목(BCrypt 전환, Refresh Token Rotation, CORS allowedHeaders 화이트리스트 등) TASK.md 등록 |
| [Done] | 2026-05-14 | 문서 | 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/백엔드/프론트 README·CLAUDE에 반영 |
| [Done] | 2026-05-14 | 문서 | 로그인 Brute-force 보호 설명을 DB 로그인 이력(`TPRMPP_CLOGNH`) 집계 방식으로 정정 |
| [Done] | 2026-05-14 | 주석 | `AdminDto`, `BoardPostRepositoryImpl`, `Cblbcm`, 일부 프론트 파일 헤더/계약 주석 보강 |
| [Done] | 2026-05-14 | 문서 | `useDeptFilter` 미구현 상태를 프론트 CLAUDE/README에 반영하고 후속 과제로 이동 |
| [Done] | 2026-05-10 | 사전협의 | `stores/review.ts` `defaultReviewers` 하드코딩 제거 → `ReviewerService`/`ReviewerController`/`ReviewerDto` TDD 구현 + API 조회 연동 |
| [Done] | 2026-05-10 | 프론트엔드 | `formatDateTime` 3개 중복 구현 → `utils/common.ts` 단일 구현으로 통합 |
| [Done] | 2026-05-10 | 프론트엔드 | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 |
| [Done] | 2026-05-10 | 문서 | 실제 설정 기준 로컬 포트(프론트 3000, 백엔드 8080)와 비밀값 기본값 잔존 상태를 README/CLAUDE/TASK에 반영 |
| [Done] | 2026-05-10 | DB/JPA | `CAPPLA` 복합 인덱스 추가 마이그레이션 확인 (`V20260510_001__add_cappla_composite_index.sql`) |
| [Done] | 2026-05-10 | DB/JPA | `BITEMM(PRJ_MNG_NO)` 인덱스 추가 마이그레이션 확인 (`V20260510_002__add_bitemm_prj_mng_no_index.sql`) |
| [Done] | 2026-05-09 | 보안 | `EnvironmentValidator` — `spring.datasource.password`, `jwt.secret` 빈값 fast-fail 검증 추가 (단, 개발 기본값 제거는 미완료) |
| [Done] | 2026-05-09 | 보안 | `FileOwnershipChecker` 소유권 검증 → `FileController` 적용, `GeminiController` `@PreAuthorize("hasRole('ADMIN')")` 추가 |
| [Done] | 2026-05-09 | 보안 | `LoginAttemptService` — `TPRMPP_CLOGNH` 로그인 실패 이력 기반 5회/10분 Brute-force 차단, `AuthService.login()` 연동 |
| [Done] | 2026-05-09 | 보안 | `FileValidator` — 허용 확장자 화이트리스트 검증, `FileService.uploadFileInternal()` 연동 |
| [Done] | 2026-05-09 | 에러처리 | `SsoController.complete()` catch → `log.error()` 추가 |
| [Done] | 2026-05-09 | 에러처리 | `FileService.java` IOException → `CustomGeneralException(msg, e)` cause 전달 |
| [Done] | 2026-05-09 | 에러처리 | `ApplicationService.updateApprovalLineInDetail()` → `ApprovalLineDelegate` 위임 메서드 추출, private `@Transactional` 제거 |
| [Done] | 2026-05-09 | 에러처리 | `ApplicationService.java` 결재선 업데이트 실패 시 예외 재발생 방침 적용 |
| [Done] | 2026-05-09 | DB/JPA | `BudgetWorkQueryRepository` — `getSummary()` 비목 루프 N+1 → 단일 집계 쿼리 통합 |
| [Done] | 2026-05-09 | DB/JPA | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입 |
| [Done] | 2026-05-09 | 주석 | java-reviewer·typescript-reviewer 탐지 결과 → 오류 주석 교정, 누락 JavaDoc/TSDoc 추가 |
| [Done] | 2026-05-09 | 주석 | silent-failure-hunter 탐지 결과 → 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 추가 |
| [Done] | 2026-05-09 | 문서 | it_backend/README.md, it_frontend/README.md 전면 재작성 (설계 결정, API 맵, 보안 흐름 포함) |
| [Done] | 2026-05-09 | 문서 | it_backend/CLAUDE.md §5.6 보안 규칙 보강 (미적용 컨트롤러 목록, 비밀값 기본값 위험, Brute-force 등) |
| [Done] | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| [Done] | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| [Done] | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| [Done] | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| [Done] | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |

## PRD_20260517 Tiptap 변수 입력 후속 과제

- [ ] PRD_20260517 follow-up: 다음 페이지에 Tiptap 변수 prop 적용
      - app/pages/info/documents/[id]/index.vue
      - app/pages/info/plan/form.vue
      - app/pages/info/documents/form.vue
      - app/pages/board/** 상세
      - app/pages/guide/** 상세
- [ ] PRD_20260517 follow-up: E2E 시나리오 2/3/5 자동화 (사업별 / 실DB 갱신 / HWPX 내보내기)
- [ ] PRD_20260517 follow-up: Tiptap 변수 카테고리 매핑 (IT_BUDGET 일반관리비 포함 여부) 운영 데이터 검증
- [ ] PRD_20260517 follow-up: VariableNodeView 스크립트 - 작성 직후 resolveTokens 호출 (현재 LOADING 상태 표시)

### 수동 검증 체크리스트 (병합 후 확인)

- [ ] info/plan에서 변수 칩 정상 표시
- [ ] 다크모드 색상 대비 충분
- [ ] 키보드만으로 변수 삽입 가능
- [ ] NodeView aria-label 부여 확인 (DevTools)
- [ ] 모바일 뷰포트(768px 이하) 팝업 위치 정상

## 공통 게시판 후속 과제

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
