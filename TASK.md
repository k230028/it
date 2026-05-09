# IT Portal 백로그

> 기준일: 2026-05-06
> 목적: `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

## 진행 중

> 최종 업데이트: 2026-05-09

### 보안

| 상태     | 우선순위     | 과제                                                                                                                      | 근거                                               |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Open] | Critical | `application.properties` 비밀값 기본값(`:default`) 제거 — 환경변수 미설정 시 개발값이 운영에 사용됨. 구동 시 빈값이면 `IllegalStateException`으로 강제 실패 적용 | `DB_PASSWORD`, `JWT_SECRET` 기본값 하드코딩 확인          |
| [Open] | High     | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                   | 인증된 모든 사용자가 타인 파일 삭제·AI API 무제한 호출 가능            |
| [Open] | High     | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                        | `AuthService.login()`에 실패 횟수 제한 없음               |
| [Open] | High     | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                            | `.jsp`, `.sh` 등 악성 확장자 업로드 가능                    |
| [Open] | Medium   | 운영 프로파일에서 `app.cookie.secure=true`, `cors.allowed-origins` 실제 오리진 강제 설정 및 구동 시 검증                                       | 기본값이 각각 `false`, `localhost`이므로 환경변수 미설정 시 보안 취약 |
| [Open] | Medium   | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                 | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈              |
| [Open] | Medium   | X-Forwarded-For 신뢰 프록시 목록 제한 — Nginx 등에서 헤더 덮어쓰기 설정 적용                                                                  | `AuthController.getClientIp()`가 헤더 무조건 신뢰        |
| [Open] | Medium   | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                    | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요      |

### 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | High | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| [Open] | High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `stores/review.ts:49` 목 데이터(R001~R004)가 프로덕션에 노출 |
| [Open] | Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| [Open] | Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | High | `SsoController.complete()` catch 블록에 `log.error()` 추가 | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재 |
| [Open] | High | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달 | 스택 트레이스 손실 — FIXME 주석 존재 |
| [Open] | High | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·위임 메서드 추출 | Spring AOP 무효 — FIXME 주석 존재 |
| [Open] | High | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생) | @Transactional 컨텍스트에서 롤백 없이 커밋됨 |
| [Open] | Medium | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204` | UX 불일치 — TODO 주석 존재 |
| [Open] | Medium | 프론트엔드 toast 알림 누락 다발 보완 (`useCostListPage`, `projects/form.vue`, `budget/report.vue`, `terminal/[id].vue` 등) | catch 블록 사용자 피드백 없음 — TODO 주석 존재 |

### DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | High | `BudgetWorkService.getSummary()` — 비목 루프 내 `findApprovedCostsByPrefix`/`findApprovedItemsByPrefix` N+1 → 단일 집계 쿼리 통합 | `BudgetWorkService.java L400-417` |
| [Open] | High | `BudgetWorkService.getProjectSummary()` — BBUGTM 루프 내 `gclMngNo→prjMngNo` 개별 SELECT + `resolveProjectName()` 사업별 SELECT → IN절 일괄 조회 | `BudgetWorkService.java L600, L683` |
| [Open] | High | `BudgetWorkService.applyRates()` — 원본 레코드별 개별 Upsert SELECT → 벌크 처리 또는 Oracle MERGE INTO 전환 | `BudgetWorkService.java L150-213` |
| [Open] | High | `CAPPLA` 테이블 복합 인덱스(`ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO`) 존재 여부 DDL 확인 및 미비 시 추가 | 3개 RepositoryImpl에서 동일 패턴 상관 서브쿼리 반복 |
| [Open] | High | `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 존재 여부 확인 및 미비 시 추가 | `Bitemm.java L63`, `BbugtmRepositoryImpl.java L218` |
| [Open] | High | `Bprojm.update()` 35+ 파라미터 → `UpdateCommand` 객체 도입으로 시그니처 단순화 | `Bprojm.java L245` |
| [Open] | Medium | `BudgetWorkService.applyItemRates()` 전체 연도 BBUGTM 메모리 로드 + 루프 Soft Delete → `@Modifying` 벌크 UPDATE | `BudgetWorkService.java L243-244` |
| [Open] | Medium | `CouncilRepository.updateProjectStatus()` `@Modifying` Native Query 후 1차 캐시 stale → `clearAutomatically=true` 또는 엔티티 기반 업데이트 | `CouncilRepository.java L67` |
| [Open] | Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 API용 DTO 프로젝션 (1000자 텍스트 컬럼 제외) | `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| [Open] | Medium | `CouncilRepository` Native Query `Object[]` 반환 → DTO 프로젝션 또는 `@SqlResultSetMapping` 적용 | `CouncilRepository.java L168, L235` |
| [Open] | Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → `flush()` 명시 또는 Spring Data `deleteAll` 통일 | `FeasibilityService.java L225` |

### 프론트엔드 리팩토링

| 상태     | 우선순위   | 과제                                                                                                                      | 근거                                      |
| ------ | ------ | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| [Open] | High   | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 — 실제 컴포넌트가 `components/ApplicationViewerDialog.vue`로 이전됨       | auto-import 이름 충돌 위험                    |
| [Open] | High   | `formatDateTime` 중복 구현 통합 — `utils/common.ts`, `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` 3개 상이한 구현 | 출력 형식 불일치                               |
| [Open] | Medium | `RichEditor.client.vue` → `TiptapEditor`/`TiptapToolbar` 마이그레이션 검토 (HTML 구조 차이·HtmlSanitizer 영향 선행 검토 필요)               | PrimeVue Quill 기반 구버전 에디터               |
| [Open] | Medium | `useProjectOptions.ts` 인라인 전환 검토 — `yearOptions` 배열만 반환하는 단순 composable                                                 | `pages/info/projects/form.vue` 1곳에서만 사용 |

### 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 (약 30곳) | Java 25 환경, 가독성·불변성 향상 |
| [Open] | Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| [Open] | Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| [Open] | Low | `AuditLogEvent.java` → Java record 전환 | Java 25 환경, 3개 필드 + getter 구성 |
| [Open] | Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | JOIN + WHERE + GROUP BY 동일 패턴, 집계 기준 컬럼만 다름 |

## 완료

| 상태 | 일자 | 영역 | 조치 |
|------|------|------|------|
| [Done] | 2026-05-09 | 주석 | java-reviewer·typescript-reviewer 탐지 결과 → 오류 주석 교정, 누락 JavaDoc/TSDoc 추가 |
| [Done] | 2026-05-09 | 주석 | silent-failure-hunter 탐지 결과 → 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 추가 |
| [Done] | 2026-05-09 | 문서 | it_backend/README.md, it_frontend/README.md 전면 재작성 (설계 결정, API 맵, 보안 흐름 포함) |
| [Done] | 2026-05-09 | 문서 | it_backend/CLAUDE.md §5.6 보안 규칙 보강 (미적용 컨트롤러 목록, 비밀값 기본값 위험, Brute-force 등) |
| [Done] | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| [Done] | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| [Done] | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| [Done] | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| [Done] | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |
