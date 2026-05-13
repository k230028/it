# IT Portal 백로그

> 기준일: 2026-05-14
> 목적: `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

## 진행 중

> 최종 업데이트: 2026-05-14

### 보안

| 상태     | 우선순위     | 과제                                                                                                                      | 근거                                               |
| ------ | -------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| [Open] | Critical | `application.properties` 비밀값 기본값(`DB_PASSWORD`, `JWT_SECRET`) 제거 — 현재 기본값 때문에 환경변수 미설정 시에도 `EnvironmentValidator`를 통과함 | `spring.datasource.password=${DB_PASSWORD:kdb1234!!}`, `jwt.secret=${JWT_SECRET:...}` |
| [Done] | High     | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                   | `FileOwnershipChecker` 적용, `GeminiController` ADMIN 전용 |
| [Done] | High     | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                        | `LoginAttemptService` 구현, `AuthService.login()` 연동    |
| [Done] | High     | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                            | `FileValidator` 구현, `FileService` 연동                  |
| [Open] | Medium   | 운영 프로파일에서 `app.cookie.secure=true`, `cors.allowed-origins` 실제 오리진 강제 설정 및 구동 시 검증                                       | 기본값이 각각 `false`, `localhost`이므로 환경변수 미설정 시 보안 취약 |
| [Open] | Medium   | `gemini.api.key` 운영 필수 여부 결정 후 `EnvironmentValidator` 검증 대상에 포함 또는 Gemini 기능 비활성 정책 명시                              | 현재 `EnvironmentValidator`는 `spring.datasource.password`, `jwt.secret`만 검사 |
| [Open] | Medium   | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                 | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈              |
| [Open] | Medium   | X-Forwarded-For 신뢰 프록시 목록 제한 — Nginx 등에서 헤더 덮어쓰기 설정 적용                                                                  | `AuthController.getClientIp()`가 헤더 무조건 신뢰        |
| [Open] | Medium   | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                    | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요      |
| [Open] | Medium   | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드가 일시적으로 관리자 화면을 노출하지 않는지 E2E 검증                                             | 프론트 쿠키는 UX 상태이며 최종 권한은 백엔드가 판단해야 함 |
| [Open] | Medium   | SSO 운영 설정 검증 강화 — `app.sso.allow-direct-eno=false`, `app.frontend-url` 실제 값, 프록시 헤더 덮어쓰기 점검                                 | `SsoController`, `AuthController.getClientIp()` 운영 안전장치 |

### 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | High | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| [Done] | High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `ReviewerController` + `ReviewerService` TDD 구현, `stores/review.ts` API 연동 |
| [Open] | Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| [Open] | Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Done] | High | `SsoController.complete()` catch 블록에 `log.error()` 추가 | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재 |
| [Done] | High | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달 | 스택 트레이스 손실 — FIXME 주석 존재 |
| [Done] | High | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·`ApprovalLineDelegate` 위임 메서드 추출 | Spring AOP 무효 — FIXME 주석 존재 |
| [Done] | High | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생) | @Transactional 컨텍스트에서 롤백 없이 커밋됨 |
| [Open] | Medium | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204` | UX 불일치 — TODO 주석 존재 |
| [Open] | Medium | 프론트엔드 toast 알림 누락 다발 보완 (`useCostListPage`, `projects/form.vue`, `budget/report.vue`, `terminal/[id].vue` 등) | catch 블록 사용자 피드백 없음 — TODO 주석 존재 |
| [Open] | High | 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강 | `pages/info/documents/[id]/review.vue` 자동 저장 catch가 실패를 삼킴 |
| [Open] | Medium | 사전협의 버전/코멘트/검토자 API 실패 표시 보강 | `stores/review.ts`, `pages/info/documents/[id]/index.vue` 실패 시 빈 상태 폴백 |
| [Open] | Medium | 전산업무비 일괄 업로드 실패 행/원인 로깅 및 결과 상세화 | `useCostListPage.ts` 행별 catch에서 실패 수만 증가 |
| [Open] | Medium | HWPX 내보내기 이미지 누락 진단 강화 | `useHwpxExport.ts` 이미지 fetch 실패 시 null 반환 |
| [Open] | Medium | Gemini 파일 첨부 실패 로그 보강 | `GeminiService.java` 파일 읽기 실패 시 skip만 반환 |
| [Open] | Medium | 감사로그 `delYn` 리플렉션 실패 시 경고 로그 및 변경유형 판정 검증 | `ChangeLogEntityListener.java` 실패 시 `U`로 폴백 |
| [Open] | Medium | Java 파일 헤더 주석 전수 보강 | 다수 Java 파일이 `package`로 바로 시작하며 파일 역할/흐름/연동 테이블 헤더가 없음 |
| [Open] | Medium | `AdminDto` 잔여 DTO JavaDoc 보강 | 자격등급/사용자/조직/역할/로그인 이력/토큰/첨부파일/통계 DTO는 기본 설명만 존재 |

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
| [Open] | Medium | 공통 `useDeptFilter` composable 구현 또는 규칙 폐기 결정 | 기존 CLAUDE 규칙과 달리 `app/composables/useDeptFilter.ts`가 없음 |
| [Open] | Medium | Tiptap 표 도구 계약 문서화 및 주석 보강 | `useTiptapTableTools.ts`, `TiptapTableFloatingToolbar.vue`가 복잡도 대비 계약 설명 부족 |

### 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
|------|----------|------|------|
| [Open] | Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 | Java 25 환경, 가독성·불변성 향상. `common/board` 포함 다수 잔존 |
| [Open] | Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| [Open] | Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| [Open] | Low | `AuditLogEvent.java` → Java record 전환 | Java 25 환경, 3개 필드 + getter 구성 |
| [Open] | Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | JOIN + WHERE + GROUP BY 동일 패턴, 집계 기준 컬럼만 다름 |

## 완료

| 상태 | 일자 | 영역 | 조치 |
|------|------|------|------|
| [Done] | 2026-05-14 | 문서 | 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/백엔드/프론트 README·CLAUDE에 반영 |
| [Done] | 2026-05-14 | 문서 | 로그인 Brute-force 보호 설명을 DB 로그인 이력(`TAAABB_CLOGNH`) 집계 방식으로 정정 |
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
| [Done] | 2026-05-09 | 보안 | `LoginAttemptService` — `TAAABB_CLOGNH` 로그인 실패 이력 기반 5회/10분 Brute-force 차단, `AuthService.login()` 연동 |
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
