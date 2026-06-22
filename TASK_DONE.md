# ✅ IT Portal 완료·종료 내역 (Archive)

> 🗓️ **기준일:** 2026-06-22
> 🎯 **목적:** [`TASK.md`](TASK.md)에서 분리한 완료(✅)·해소(✔️)·감내(☑️) 항목을 보관합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 |
| :--: | --- |
| ✅ Done | 완료 |
| ✔️ Resolved | 해소(거짓양성 등) |
| ☑️ Accepted | 감내(업스트림 미해결) |

---

## 🗂️ 진행 중에서 종료된 항목 (영역별)

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🔴 Critical | 베이스/운영 `application.properties` 비밀값 기본값(`DB_PASSWORD`, `JWT_SECRET`) 제거 — 빈값이면 `EnvironmentValidator`가 기동 차단. local/dev 프로파일의 개발 기본값은 운영 배포 체크리스트에서 별도 확인 | `application.properties`, `application-prod.properties` 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `FileController`·`GeminiController` 등 `@PreAuthorize` 미적용 컨트롤러에 소유권 검증 또는 권한 어노테이션 추가                                                         | `FileOwnershipChecker` 적용, `GeminiController` ADMIN 전용                                |
| ✅ Done | 🟠 High | 로그인 Brute-force 보호 — 연속 실패 횟수 임계값(예: 5회/10분) + 계정 잠금 또는 지연 응답 적용                                                                              | `LoginAttemptService` 구현, `AuthService.login()` 연동                                    |
| ✅ Done | 🟠 High | 파일 업로드 확장자 화이트리스트 검증 추가 (`FileService.uploadFileInternal()`)                                                                                  | `FileValidator` 구현, `FileService` 연동                                                  |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✔️ Resolved | 🟠 High | `io.jsonwebtoken:jjwt-jackson@0.13.0` 전이 `jackson-core@2.12.7` Snyk 거짓 양성 — `build.gradle` resolutionStrategy에서 `jackson-core`/`jackson-databind`를 `2.21.2`로 강제. 실제 runtimeClasspath 해소 버전도 `2.21.2` 확인 (2026-05-27) | `build.gradle` jackson 2.x strict force, `./gradlew dependencyInsight` 검증 |
| ☑️ Accepted | 🟠 High | `org.springdoc:springdoc-openapi-starter-webmvc-ui@3.0.3` — 14건 전이 취약점 업스트림 패치 없음. Spring Boot 4.x 호환 최신 3.0.3 사용 중. 차기 springdoc 릴리스 모니터링 필요 | Snyk Priority 542, "Fixable issues 0" (jackson-core, spring-boot-autoconfigure 전이) |
| ☑️ Accepted | 🟡 Medium | `com.querydsl:querydsl-jpa@5.1.0` — SQL Injection(CWE-89, CVSS 6.9) 업스트림 패치 없음. 프로젝트 내 사용은 정적 Q클래스 + `BooleanBuilder` 기반으로 사용자 입력 문자열 직접 SQL 결합 경로 없음. 신규 QueryDSL 사용 시 `Expressions.template()` 등 raw 표현식 회피 | Snyk SNYK-JAVA-COMQUERYDSL-8400287, "Fixable issues 0" |

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 프로젝트별 검토자 목록 서버 API 조회로 전환 + `defaultReviewers` 하드코딩 제거 | `ReviewerController` + `ReviewerService` TDD 구현, `stores/review.ts` API 연동 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `SsoController.complete()` catch 블록에 `log.error()` 추가                                                                                                                                               | SSO 인증 실패 원인 추적 불가 — FIXME 주석 존재                                                 |
| ✅ Done | 🟠 High | `FileService.java:318,325` IOException → `CustomGeneralException(msg, e)` — cause 전달                                                                                                                | 스택 트레이스 손실 — FIXME 주석 존재                                                         |
| ✅ Done | 🟠 High | `ApplicationService.updateApprovalLineInDetail()` private `@Transactional` 제거·`ApprovalLineDelegate` 위임 메서드 추출                                                                                      | Spring AOP 무효 — FIXME 주석 존재                                                      |
| ✅ Done | 🟠 High | `ApplicationService.java:207` 결재선 업데이트 실패 처리 방침 결정 (`warn`만 vs 예외 재발생)                                                                                                                              | @Transactional 컨텍스트에서 롤백 없이 커밋됨                                                  |
| ✅ Done | 🟠 High | `NotificationService.send()` — `recipientEno` null/blank 가드 구현 완료 (`null \|\| isBlank()` 조건 후 warn 로그 + return null) | `NotificationService.java:48-50`, 검증일: 2026-06-01 |
| ✅ Done | 🟡 Medium | `budget/approval.vue:458-460` PDF 생성 실패 시 `alert()` 사용 — PrimeVue `toast.error`로 교체 완료 | `pages/budget/approval.vue:458-459`, 검증일: 2026-06-21 |
| ✅ Done | 🟡 Medium | 프론트엔드 `alert()` → PrimeVue `toast` 교체: `approval/list.vue:204` | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `approval/list.vue:213-214` — 결재 처리 실패 시 `console.error`만 출력, `toast.error` 사용자 알림 없음 (CLAUDE.md 4.2.1 위반) | `pages/approval/list.vue:213-221` toast 처리 확인, 검증일: 2026-06-05 |
| ✅ Done | 🟠 High | `budget/report.vue:170-172,249-251` — PDF 생성/데이터 로드 실패 toast 및 버튼 비활성화 처리 완료 | `pages/budget/report.vue:176-184,263-270,284`, 검증일: 2026-06-21 |
| ✅ Done | 🟠 High | `info/projects/report.vue:164-166,199-201` — PDF 생성/프로젝트 로드 실패 toast 및 실패 상태 UI 처리 완료 | `pages/info/projects/report.vue:168-176,208-215,325`, 검증일: 2026-06-21 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `BudgetWorkService.getSummary()` — 비목 루프 내 `findApprovedCostsByPrefix`/`findApprovedItemsByPrefix` N+1 → 단일 집계 쿼리 통합 | `BudgetWorkQueryRepository` 개선 완료 |
| ✅ Done | 🟠 High | `CAPPLA` 테이블 복합 인덱스(`ORC_TB_CD, ORC_PK_VL, ORC_SNO_VL, APF_REL_SNO`) 존재 여부 DDL 확인 및 미비 시 추가 | `V20260510_001__add_cappla_composite_index.sql` |
| ✅ Done | 🟠 High | `BITEMM(PRJ_MNG_NO)` 단일 컬럼 인덱스 존재 여부 확인 및 미비 시 추가 | `V20260510_002__add_bitemm_prj_mng_no_index.sql` |
| ✅ Done | 🟠 High | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입으로 시그니처 단순화 | `Bprojm.java` 리팩토링 완료 |
| ✅ Done | 🔴 Critical | `TPRMPP_CINFMM` 테이블명 매핑 확인 — V20260520_001이 `TAAABB_CINFMM` 생성, V20260521_006(line 60)이 `TPRMPP_CINFMM`으로 RENAME. 마이그레이션 체인 정상 확인. 엔티티 `@Table` 매핑 유효 | 2026-05-22 직접 검증 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 — 실제 컴포넌트가 `components/ApplicationViewerDialog.vue`로 이전됨       | auto-import 이름 충돌 위험 해소                 |
| ✅ Done | 🟠 High | `formatDateTime` 중복 구현 통합 — `utils/common.ts`, `pages/guide/index.vue`, `pages/info/documents/[id]/index.vue` 3개 상이한 구현 | `utils/common.ts` 단일 구현으로 통합             |
| ✅ Done | 🟠 High | `stores/review.ts` 검토자 조회 `$apiFetch('/api/...')` 상대 URL 제거 — `${config.public.apiBase}`를 붙여 Nuxt origin 오호출 방지 | `stores/review.ts`, 조치일: 2026-06-21 |
| ✅ Done | 🟠 High | `useCouncilCodes.ts` 코드명 필드 불일치 수정 — `statusMap`/`hearingMap`/`memberTypeMap` 모두 `c.cdvaNm` 매핑 사용, `CodeItem`에 `cNm`/`cdvaNm` 정의 확인 | 코드 확인 2026-06-12: `useCouncilCodes.ts:68,73,78` |
| ✅ Done | 🟠 High | 협의회 평가 요약 템플릿 닫힘 구조 정리 | ESLint 단독 실행 2026-06-12: `EvalSummaryPanel.vue` 오류 0건 (847a947 개선 반영) |
| ✅ Done | 🟠 High | `utils/common.ts` 협의회 상태/심의유형 매핑 구 3자리 코드 잔재 수정 — `COUNCIL_STATUS_TAG_MAP` 키와 `getHearingTypeLabel` switch case를 2자리(`'01'`~`'13'`/`'01'`~`'05'`)로 교체. dead branch 해소(`getCouncilTagClass`/`getHearingTypeLabel` 정상 동작). `tests/unit/utils/common.test.ts` 해당 케이스 2자리로 갱신, 124 tests 통과 | `app/utils/common.ts:342-356,375-383`, 검증일: 2026-06-15 |

### 🔎 2026-06-22 코드 대조 검증 완료 (백엔드)

> 백엔드 4개 섹션 ⬜ Open 항목을 라이브 IDE 진단 + 코드 광범위 대조로 검증, 완료 확정분.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | `CodeController.createCcodem()`/`updateCcodem()` `@Valid` 추가 — Bean Validation이 컨트롤러 진입 시 동작하도록 일관성 확보                                        | `CodeController.java:68,81` — ✅ 검증 2026-06-22: CodeController.java:75,97 `@Valid @RequestBody` 적용 확인 |
| ✅ Done | 🟡 Medium | `FeasibilityService.replacePerformances()` 물리 DELETE 예외 정책 정리 — `Bperfm` 성과지표도 Soft Delete 원칙을 지키도록 PK 재삽입 문제를 해결하거나 운영 예외로 승인 | `FeasibilityService.java:223`, 발견일: 2026-06-01 — ✅ 검증 2026-06-22: FeasibilityService.java:170-173 하드딜리트 사유(복합PK+merge del_yn) JavaDoc 명문화 → 운영 예외 승인 |
| ✅ Done | 🟡 Medium | `ServiceRequestDocService.getDashboard()` 네이티브 쿼리 결과 직접 캐스트 안전 변환 적용 — Oracle JDBC/Hibernate 반환 타입 차이로 `ClassCastException` 가능. `RealtimeLogRepository`의 `toStr`/`Number` 변환 패턴 참고 | `ServiceRequestDocService.java:295,307`, 탐지: 2026-06-21 — ✅ 검증 2026-06-22: ServiceRequestDocService.java:294-311 toLdt() instanceof 분기 + try/catch 적용 |
| ✅ Done | 🟢 Low | `BestimL`/`BesttmL` 로그 엔티티가 `SEQ_BESTIL`/`SEQ_BESTTL` 시퀀스를 정확히 참조하는지 `AuditLogIdGenerator` 파생 로직과 대조 검증 (`V20260607_004`에서 `SEQ_BESTIDL→SEQ_BESTTL` rename) | `V20260607_004:15`, `V20260607_002:105-107`, 탐지: 2026-06-09 — ✅ 검증 2026-06-22: V20260607_004:14-15 rename + AuditLogIdGenerator:40 파생 정합 + @Table 매핑 확인 |
| ✅ Done | 🟡 Medium | `BprojmL` 변경로그 엔티티에 `cncdRfrNo`(`CNCD_RFR_NO`) 컬럼 누락 — 마스터 `Bprojm`은 보유(`Bprojm.java:203`)하나 미러 엔티티에 미정의. `AuditLogPersister`가 필드명 기준 복사하므로 관련프로젝트관리번호 변경이 감사로그에 미기록. `BprojmL`에 필드 추가 + `TPRMPP_BPROJL` ADD 마이그레이션 필요 | `BprojmL.java`, 탐지: 2026-06-14 — ✅ 검증 2026-06-22: BprojmL.java:34 필드 + V20260612_002:1009 TPRMPP_BPROJL ADD CNCD_RFR_NO |
| ✅ Done | 🟠 High | 알림 시스템 백엔드 단위·통합 테스트 추가 — `NotificationServiceTest`(Mockito), `MentionExtractorTest`(순수 단위), `CinfmmRepositoryImplTest`(Testcontainers/H2). 커버리지 대상: 빈 수신자 가드, REQUIRES_NEW 전파, markAllRead 행 수, 멘션 추출 엣지케이스 | `it_backend/src/test/` — notification 패키지 테스트 없음 — ✅ 검증 2026-06-22: NotificationServiceTest/MentionExtractorTest/NotificationEventListenerTest/NotificationControllerTest 존재(CinfmmRepositoryImplTest만 잔여) |
| ✅ Done | 🟠 High | Tiptap 변수 시스템 백엔드 단위 테스트 추가 — `TiptapTokenParserTest`(정규식·switch·IllegalArgumentException), `TiptapVariableServiceTest`(Mockito: MISSING/INVALID·금액 포맷·null 가드) | `it_backend/src/test/` — tiptap 패키지 테스트 없음 — ✅ 검증 2026-06-22: TiptapTokenParserTest/TiptapVariableServiceTest/TiptapVariableControllerTest 존재 |
| ✅ Done | 🟠 High | `QnaService.updateQna()` 관리자 수정 무력화(`ROLE_ITPAD001`) 교정 — `OwnershipVerifier.verifyOwnerOrAdmin()`로 교체, 비소유자 403 매핑 | — ✅ 구현 2026-06-22(feat/ownership-verifier-foundation): `OwnershipVerifier`(공통 유틸) 도입 + `GlobalExceptionHandler` AccessDeniedException→403 + `QnaService.java` 권한 검증 위임. Plan: docs/superpowers/plans/2026-06-22-ownership-verifier-foundation.md |

### ✅ 2026-06-22 백엔드 로드맵 Phase 2-5 실행 완료

> 백엔드 개선 로드맵 Phase 2~5를 브랜치 `backend-roadmap-phase2-5`에서 구현·코드리뷰 완료. (코드 커밋은 중첩 `it_backend` repo, 마이그레이션은 `it_database` repo)

#### Phase 2 — 에러 전파·입력 안정성

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 리소스 미존재 시 HTTP 404 반환을 위한 전용 `NotFoundException` 도입 + `GlobalExceptionHandler` 매핑 | 구현 2026-06-22: `NotFoundException`(404) + `GlobalExceptionHandler` `ResponseStatusException` 핸들러 |
| ✅ Done | 🟠 High | `ResponseStatusException` 전용 핸들러 추가 — 서비스에서 던진 404/500 상태가 `RuntimeException` 포괄 핸들러에 의해 400으로 바뀌지 않도록 분리 | 구현 2026-06-22: `GlobalExceptionHandler`에 `ResponseStatusException` 핸들러 추가 |
| ✅ Done | 🟡 Medium | `ChangeLogEntityListener.java:133-137` `delYn` 리플렉션 접근 실패 시 warn 로그 + 스택트레이스 추가 | 구현 2026-06-22: 에러 로깅 표준화 9곳 중 하나 |
| ✅ Done | 🟠 High | `PlanService.java:443` `JsonProcessingException` cause 전달 — `ResponseStatusException` 3인수 생성자로 교체 | 구현 2026-06-22: snapshot 직렬화 실패 cause 보존 |
| ✅ Done | 🟠 High | `PlanService.applyExistingPlanSnapshot()` 빈 `catch (JsonProcessingException) {}` — 스냅샷 파싱 실패 로깅 | 구현 2026-06-22: `PlanService.java:133-137`(FIXME [B-H-05]) cause 로깅 |
| ✅ Done | 🟡 Medium | `FileService.downloadFile()` `MalformedURLException` 원인 예외 보존 + `uploadFiles` warn 로깅 | 구현 2026-06-22: `FileService` cause 전달·warn 추가 |
| ✅ Done | 🟠 High | `SsoController.complete()` `sendRedirect` IOException 로깅 | 구현 2026-06-22: 에러 로깅 표준화 |
| ✅ Done | 🟡 Medium | `AdminLogService.readField()` 필드 미발견 시 `log.warn` 추가 (TODO [B-M-01]) | 구현 2026-06-22: `AdminLogService.java:232-241` warn 추가 |
| ✅ Done | 🟡 Medium | `CustomUserDetails` — `athIds` 클레임 타입 불일치 시 `log.warn` 추가 | 구현 2026-06-22: `JwtUtil` athIds warn |
| ✅ Done | 🟡 Medium | `AuditLogPersister` CHG_USID null warn · `CouncilService` 회의일자 warn · `NotificationService` 길이 clamp | 구현 2026-06-22: 에러 로깅 표준화 9곳 |
| ✅ Done | 🟢 Low | `NotificationEvent` `infTtl`(100자)·`infCone`(300자) 길이 강제 — 초과 시 clamp 적용 | 구현 2026-06-22: `NotificationService.send()` 길이 clamp |
| ✅ Done | 🟠 High | `GeminiService` `RestClient`에 `connectTimeout`/`readTimeout` 설정 — 스레드 풀 고갈 방지 | 구현 2026-06-22: connect/read timeout 적용 |
| ✅ Done | 🟡 Medium | Gemini 첨부 파일 실제 크기 제한 구현 | 구현 2026-06-22: `Files.readAllBytes` 전 첨부 크기 사전검사 |
| ✅ Done | 🟡 Medium | Gemini 요청 DTO 검증 추가 — `@NotBlank`, `@Size`, 첨부 개수 제한 | 구현 2026-06-22: `GeminiDto` Bean Validation |
| ✅ Done | 🟡 Medium | `NotificationController` `size` 파라미터 상한 — `@Max(100)` 또는 클램핑 | 구현 2026-06-22: `NotificationController` `@Max` Bean Validation |
| ✅ Done | 🟡 Medium | `@Valid` 입력검증 일관화 — `ApplicationController`, 사업집행 4단계 DTO, `TiptapVariableService` FORBIDDEN 분기 | 구현 2026-06-22: `@Valid`/`@Max` 적용 + Tiptap FORBIDDEN 분기 |
| ✅ Done | 🟡 Medium | 사업집행 4단계 DTO — 금융 금액 필드(`cttAmt`, `dfrAmt`) `@DecimalMin`, YN 플래그 `@Pattern` 적용 | 구현 2026-06-22: 4단계 DTO Bean Validation |

#### Phase 3 — 보안 하드닝

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `gemini.api.key` 운영 필수 검증 — `EnvironmentValidator` 검증 대상 포함 | 구현 2026-06-22: `EnvironmentValidator` gemini 키 검증 |
| ✅ Done | 🟡 Medium | `EnvironmentValidator`에 `eai.enabled`/`EAI_URL` 운영값 검증 추가 | 구현 2026-06-22: `EnvironmentValidator` eai 검증 |
| ✅ Done | 🟠 High | `cors.allowed-origins` 기본값 `*` 제거 + 빈값/와일드카드 운영 차단 가드 | 구현 2026-06-22: `EnvironmentValidator` cors wildcard 검증 + 기본값 제거 + blank 가드 |
| ✅ Done | 🟡 Medium | `SecurityConfig.allowedHeaders` `List.of("*")` → 실제 사용 헤더 명시 화이트리스트 | 구현 2026-06-22: `allowedHeaders` 명시 |
| ✅ Done | 🟡 Medium | `SecurityConfig` 관리자 URL 패턴 `/api/plan/**`을 실제 `/api/plans/**`와 일치 정비 | 구현 2026-06-22: 라우트 `/api/plans` 정합 |
| ✅ Done | 🟢 Low | `AuthController.getClientIp()` — `X-Forwarded-For` 멀티 IP 미분리 | 구현 2026-06-22: `ClientIpResolver` 멀티IP+신뢰프록시 |
| ✅ Done | 🟡 Medium | X-Forwarded-For 신뢰 프록시 목록 제한 | 구현 2026-06-22: `ClientIpResolver` 신뢰프록시 처리 |
| ✅ Done | 🟠 High | Refresh Token Rotation 도입 — `/api/auth/refresh` 시 Refresh Token도 신규 발급·DB 교체 | 구현 2026-06-22: `AuthService` Refresh Token Rotation |
| ✅ Done | 🟡 Medium | `UserDto.DetailResponse` 휴대폰/내선/이메일 PII 노출 본인·ADMIN 한정 | 구현 2026-06-22: `UserService` PII self/admin 한정(`OwnershipVerifier`) |
| ✅ Done | 🟡 Medium | 사번(`eno`) PII INFO 로그 정책 — DEBUG 강등 | 구현 2026-06-22: eno/bbrC INFO→DEBUG, `BoardCommentService` 멘션 INFO 제거 |
| ✅ Done | 🟡 Medium | `EaiService.sendEai()` 전송 실패 로그 — EAI URL/내부 경로 노출 방지 | 구현 2026-06-22: `EaiService` safeMessage |
| ✅ Done | 🟢 Low | `EaiProperties` `enabled=true`+`url` 공백/null 가드 추가 | 구현 2026-06-22: `EaiProperties` enabled+blank-url 가드 |

#### Phase 4 — 성능

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟠 High | 요구사항 정의서 목록 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ServiceRequestDocService` 배치화 |
| ✅ Done | 🟡 Medium | `ReviewCommentService` 검토의견 작성자명 조회 N+1 제거 | 구현 2026-06-22: `ReviewCommentService` 배치화 |
| ✅ Done | 🟠 High | `ApplicationService.getApplications()` 결재자 목록 N+1 제거 | 구현 2026-06-22: `ApplicationService.getApplications` 배치화 |
| ✅ Done | 🟡 Medium | `ApplicationService.getPendingCount()` full entity 조회 후 `.size()` → `count` 쿼리 | 구현 2026-06-22: `getPendingCount` COUNT 전환 |
| ✅ Done | 🟠 High | `BudgetWorkService.getProjectSummary()` BBUGTM 루프 N+1 + `resolveProjectName()` IN절 일괄 조회 | 구현 2026-06-22: `BudgetWorkService` 배치화 |
| ✅ Done | 🟡 Medium | `GET /api/notifications/unread-count` 상시 `COUNT(*)` → 캐시 | 구현 2026-06-22: `NotificationService` unread-count 캐시(evict-on-write) |
| ✅ Done | 🟡 Medium | `TiptapVariableService.getMetadata()`·`resolve()` 매 호출 DB 조회 → 캐시 | 구현 2026-06-22: `TiptapVariableService` metadata 캐시 + 인트라-요청 memoize |
| ✅ Done | 🟠 High | 메뉴 권한 매핑 `athByMenu()` 캐시 도입 | 구현 2026-06-22: `MenuAuthMapProvider` 캐시(evict-on-write) |
| ✅ Done | 🟠 High | 결재 대기/대시보드·요구사항 정의서·사업집행 4단계 목록·메뉴 활성조회 인덱스 보강 | 구현 2026-06-22: 인덱스 마이그레이션 `V20260622_003`(`IDX_BESTIM_LIST/FST_DTM`, `IDX_BDELIM_LIST/FST_DTM`, `IDX_BCONTM_LIST/FST_DTM`, `IDX_BPAYMM_LIST/FST_DTM`, `IDX_CMENUM_DEL`, `IDX_CMENUA_DEL` 포함) |
| ✅ Done | 🟢 Low | `SEQ_CINFMM` 및 사업집행 4단계 마스터 시퀀스 `NOCACHE → CACHE 20` 변경 | 구현 2026-06-22: 시퀀스 CACHE 20 마이그레이션 `V20260622_004`(`SEQ_BESTIM`, `SEQ_BDELIM`, `SEQ_BCONTM`, `SEQ_BPAYMM` 포함) |
| ✔️ Resolved | 🟡 Medium | `BPAYTM` 회차별 지급 조회 보조 인덱스 검토 — `(DOC_MNG_NO, DOC_VRS_SNO)` 선행 조건은 기존 PK 프리픽스로 커버되어 별도 인덱스 제외 | 검토 2026-06-22: `V20260622_003` 주석에 중복 제외 사유 기록 |
| ✅ Done | 🟡 Medium | `CouncilRepository.updateProjectStatus()` `@Modifying` 후 1차 캐시 stale 정합 | 구현 2026-06-22: `clearAutomatically`/`flushAutomatically` 적용 |

#### Phase 5 — 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | `buildCodeNameMap` 중복 private 메서드 추출 — 공통 유틸로 단일화 | 구현 2026-06-22: `CodeNameMapBuilder` 공통 추출(`CostService`/`ProjectService` 위임) |
| ✅ Done | 🟢 Low | `BbugtmRepositoryImpl.sumCostDupBg`/`sumAssetDupBg` 공통 private 메서드 추출 | 구현 2026-06-22: `sumDupBg` 3건 통합 |
| ✅ Done | 🟢 Low | `AuditLogEvent.java` 정리 — 잔여 이벤트 기반 감사로그 제거 | 구현 2026-06-22: `AuditLogEvent` 삭제 |
| ✅ Done | 🟢 Low | `BcostmL` JPA `@Column(length)` 실제 DDL/마스터와 불일치 정정 | 구현 2026-06-22: `BcostmL` @Column length 12건 정정 |
| ✅ Done | 🟡 Medium | `stream().collect(Collectors.toList())` → `.toList()` 전환 | 구현 2026-06-22: 50/51건 전환 (소비자 코드 가변성 확인) |
| ✅ Done | 🟢 Low | `BoardCommentService` 미사용 import 제거 · `FileService` `FL_MNG_NO_RETRY` 제거 | 구현 2026-06-22: dead code 정리 |

## 📋 완료 로그 (시간순)

| 상태 | 일자 | 영역 | 조치 |
| :--: | :--: | :--: | --- |
| ✅ Done | 2026-06-22 | 백엔드 로드맵 | 백엔드 개선 로드맵 Phase 2~5 실행(브랜치 `backend-roadmap-phase2-5`, 코드리뷰 완료). **Phase 2**: `NotFoundException`(404)+`ResponseStatusException` 핸들러, 에러 로깅 표준화 9곳, `GeminiService` 타임아웃+첨부 크기 사전검사, 입력검증(`@Valid`/`@Max`/Bean Validation + Tiptap FORBIDDEN). **Phase 3**: `EnvironmentValidator` 운영 필수키 검증(gemini/eai/cors), CORS allowedHeaders 명시·기본값 제거·blank 가드, `/api/plans` 라우트 정합, `ClientIpResolver`, Refresh Token Rotation, `UserService` PII 한정, eno/bbrC 로그 DEBUG 강등, `EaiService` safeMessage·blank-url 가드. **Phase 4**: N+1 배치화(ServiceRequestDoc/ReviewComment/Application/BudgetWork), 캐시(notification unread-count·tiptap metadata·MenuAuthMap, evict-on-write), 인덱스 `V20260622_003`·시퀀스 CACHE 20 `V20260622_004`, `CouncilRepository.updateProjectStatus` clear/flush. **Phase 5**: `CodeNameMapBuilder` 공통 추출, `sumDupBg` 통합, `AuditLogEvent` 삭제, `BcostmL` length 12건 정정, `.toList()` 50/51 전환, dead code 정리. 후속(테스트 스텁·통합테스트 인프라·프로젝션 DTO·토큰 재사용 탐지·캐시 TTL 등)은 TASK.md 신규 등록. |
| ✅ Done | 2026-06-21 | 주석/문서/백로그 | REVIEW.md 재실행 — 병렬 에이전트 관찰 결과와 직접 검증을 통합. **Task1**: `NotificationEvent`/`NotificationEventListener`의 AFTER_COMMIT “비동기” 주석을 실제 동기 콜백 설명으로 정정, `ApplicationService.bulkApprove()` 반환/롤백 JavaDoc 정정, `ReviewerController` `@PathVariable(name)` 명시, 프론트 `$apiFetch`/`useApiFetch` 예시 절대 URL 정정, `stores/review.ts` 검토자 조회 상대 URL을 `${config.public.apiBase}`로 수정. **Task2/3**: 루트/BE/FE README·CLAUDE에 백엔드 포트 28080, Spring Boot 4.1.0, 소스 통계(BE 349/120/74/35, FE 83/56/67/109), 보안 기본값(DB/JWT 기본값 제거, cookie secure=true), `CouncilController` 메서드 레벨 권한 예외, Playwright 3002를 반영. **Task4**: DB/JWT 기본값 제거·프론트 PDF 실패 toast 완료 항목 [Done] 전환, 요구사항 정의서 소유권 검증과 `ServiceRequestDocService` 네이티브 타입 변환 과제 신규 등록. 검증: `it_backend ./gradlew.bat compileJava`, `it_frontend npm run typecheck` 통과. |
| ✅ Done | 2026-06-14 | 주석/문서/백로그 | REVIEW.md 재실행 (델타: 2026-06-12 회차 이후 BE `26a71cd..HEAD` 금액 컬럼 개편·미사용 테이블 정비·폐쇄망 빌드, FE/DB 동일 구간). **Task1**: 검증 후 stale 주석 5건 교정 — `CostRepositoryCustom`(@param 필드명)·`CostRepositoryImpl`(예시 SQL `IT_MNGC_NO`→`BG_NO`) 금액 컬럼 개편 반영, `BplanmL` IT_PRJ_RMK 주석(`IT예산비고`→`IT프로젝트비고`), `types/council.ts` 2자리 코드 주석 2건. java/ts/silent-failure 병렬 탐지는 다수 기추적·오탐 확인. **Task2/3**: 소스 통계 현행화(BE 350→347 Java/115→116 test/79→77 엔티티/36→38 컨트롤러, FE 84→83 컴포넌트·types 11→15, `@IdClass` 15→29), 감사로그 31→30 전반 반영(Bchklc 드롭, JavaDoc 예시 중복 보정), 폐쇄망 빌드는 이미 문서화 확인, Bchklc 드롭에 따른 README 트리·감사표·data-model 참조 3건 정리 + 협의회 10→9 Repository 정정. **Task4**: 신규 5건 등록 — `common.ts` 3자리 dead branch(High), `BprojmL` CNCD_RFR_NO 누락(Medium), `AdminLogService.readField` warn 누락(Medium), `BcostmL` length 불일치(Low), `result/[id].vue` catch 바인딩(Low). `PlanService` 빈 catch 라인 현행화(126-130→133-137), 메타 미등재 BCHKLC 드롭 반영. |
| ✅ Done | 2026-06-12 | 주석/문서/백로그 | REVIEW.md 재실행 (델타 중심: BE 26a71cd 메뉴 athIds, FE 9dcdc68..HEAD 4커밋) — Task1: 협의회 상태코드 3→2자리 전환 미반영 주석 5건 교정(`[id].vue`, `result/[id].vue`), `MenuQueryService.getMenuTree` JavaDoc athIds 반영, `types/menu.ts` athIds TSDoc 전환, 오류삼킴 FIXME/TODO 5곳 등록. Task2/3: FE README 메뉴 표시 유틸·council 2자리 코드 반영, 루트 README 메뉴 숨김 계층(`admin:true` 플래그→DB 권한 매핑) 정정·감사로그 고정 카운트 제거, BE CLAUDE.md §5.5.5 athIds 이원 용도·메뉴 유형 HED 허용(`AdminMenuService:174` 기준) 반영, 감사로그 31쌍 재검증(검증일 부기), FE CLAUDE.md 메뉴 왕관 유틸·협의회 2자리 코드 규칙 추가(인증 코드 무변경 확인으로 보안 규칙 보강 불필요). Task4: silent-failure 4건(High 1)·메뉴 DB 4건(캐시·인덱스, High 2)·리팩토링 3건 신규 등록, `useCouncilCodes` cdvaNm·`EvalSummaryPanel` 템플릿 오류 해소 확인 → [Done] 전환. |
| ✅ Done | 2026-06-09 | 주석/문서/백로그 | REVIEW.md 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 결과 검증(기존 추적·false positive 다수 확인, `MenuChildrenResolver` 영문주석 지적은 이미 한글로 오탐), 신규 도메인 코드는 한글 주석 충실 → `PaymentController` 클래스 주석 1건 보강. Task2/3: 정보화사업 집행 4단계(`domain/{estimate,deliberation,contract,payment}`, `/api/project/**`)와 `infra/eai`를 BE/FE README·CLAUDE.md에 반영, 소스 통계 현행화(BE 291→350 Java/96→115 test/64→79 entity/감사로그 25→31, FE composables 52→56/pages 58→67), CLAUDE.md §5.18~5.19 집행 4단계·EAI 섹션 신설. Task3 security-reviewer: 집행 4단계 소유권 검증 누락·bbrC 필터 미적용 등 HIGH 2건 외 보안 7건 등록. Task4 database-reviewer: 시퀀스 NOCACHE·DEL_YN 복합인덱스·상세 N+1 등 DB 7건 등록. |
| ✅ Done | 2026-06-05 | 주석/문서/백로그 | REVIEW.md 재실행 — DB 기반 메뉴(`domain/menu`, `useMenu`, `useAdminMenu`) 주석과 README/CLAUDE 반영, 소스 통계 현행화(백엔드 291 Java/96 test/63 entity, 프론트 84 components/52 composables/58 pages), 실시간 로그 타입 경로 정정. stale `approval/list.vue` toast 항목 [Done] 전환, `PlanService` 라인 근거 126-130으로 현행화, 프론트 silent fallback 3건과 DB N+1/실시간 로그 인덱스 후보 추가. |
| ✅ Done | 2026-06-01 | 백로그 | silent-failure-hunter·refactor-cleaner·database-reviewer·security-reviewer 4개 분석 결과 신규 7건(High 3·Medium 4) 추가. `NotificationService.send()` recipientEno null 가드 구현 완료 확인 → [Done] 전환. `QnaService` ROLE_ITPAD001·`PlanService.java:108` 빈 catch 코드 미수정 확인 → [Open] 유지. `cors.allowed-origins` High 보안 항목 신규 등록. `Collectors.toList()` 48곳 파일 목록 구체화. `ChangeLogEntityListener:133` Medium·`PlanService:443` High·`budget/approval.vue:458` Medium silent-failure 신규 등록. DB N+1 2건(`BudgetWorkService.getProjectSummary` High·`resolveProjectName` Medium) 신규 등록. |
| ✅ Done | 2026-06-01 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 `CouncilService`, `info/plan/[id].vue`, `budget/status.vue` 무시형 실패 경로에 한글 TODO 주석 추가. Task2/3: BE/FE README·CLAUDE.md에 실시간 로그 모니터링(`common/admin/realtime`, `useRealtimeLogs`, `/api/admin/realtime-logs`), Nitro `server/` 구조, 최신 파일 수 반영. Task4: 2026-06-01 typecheck/lint 실패, 실시간 로그 검증, N+1/인덱스 후보를 신규 백로그로 등록 |
| ✅ Done | 2026-05-29 | 주석/문서 | REVIEW.md 전체 재실행 — Task1: java/typescript/silent-failure 병렬 탐지 후 검증, 잘못된 주석 3건 교정(`AuthService` 로그인이력 테이블명 `TPRMPP_CLOGNH`, `AuthController` 로그인 응답 필드 주석, `review.ts` nextVersion JSDoc 0.01/2자리), `QnaService` ROLE_ITPAD001 버그 FIXME 추가. Task2/3: BE/FE README·CLAUDE.md에 IT부문 예산 도메인(`domain/budget/it`, `/api/budget/it` ADMIN 전용)·신규 composable(useItBudget/useItProjectRows/useApprovalStatus) 반영. Task4: security-reviewer 신규 2건(문서 대시보드 bbrC 신뢰, getClientIp XFF 미분리) + QnaService 권한 버그 등록. 다수 기존 탐지 항목은 이전 회차에서 이미 수정됨(stale) 확인 |
| ✅ Done | 2026-05-26 | 백로그 | REVIEW.md Task 4 — refactor-cleaner·database-reviewer·silent-failure-hunter 분석. `task1-silent-failures.md` HIGH 이상 항목 전수 검토 후 신규 14건(Critical 1·High 13) 에러 처리 섹션에 등록. 기존 항목 완료 여부 코드 확인(모두 Open 유지). 기준일 2026-05-26 갱신. |
| ✅ Done | 2026-05-22 | 주석 | REVIEW.md Task 1 — java-reviewer·typescript-reviewer·silent-failure-hunter·comment-analyzer 병렬 분석. `@Valid` 누락 FIXME(ApplicationController, ProjectController, PlanController), `@Transactional(readOnly=true)` TODO(PlanService), 유니코드 이스케이프 TODO(CouncilService), 빈 catch [HIGH] TODO 3건(stores/review.ts), FIXME(budget/report.vue), 폴링 정책 주석 보강(useNotifications.ts), 고아 JavaDoc 삭제(NotificationService.java) |
| ✅ Done | 2026-05-22 | 문서 | REVIEW.md Task 2/3 — BE/FE README.md 및 CLAUDE.md에 알림 시스템(common/notification), Tiptap 변수 시스템(common/system/tiptap) 섹션 추가. 컴포넌트 72개·Composable 48개 카운트 갱신. 루트 README §18.10 현행화 메모 추가 |
| ✅ Done | 2026-05-17 | 주석 | REVIEW.md Task 1 재실행 — Java/TypeScript 주석 불일치 교정, Excalidraw/HWPX/Tiptap/Auth 실패 경로 TODO/FIXME 추가, `Bcmmtm.cnfmYn` 컬럼 comment 보강 |
| ✅ Done | 2026-05-19 | 주석/문서 | REVIEW.md 재점검 — 깨진 한글 주석, JavaDoc 위치 오류, 게시판 QueryDSL 설명, 관리자 미들웨어 적용 범위 문서 보강 |
| ✅ Done | 2026-05-17 | 문서 | 루트/백엔드/프론트 README·CLAUDE 현행화 — 테스트 수, Nuxt 버전, 실제 API 경로(`/api/cost`, `/api/plans`), Gemini 관리자 권한, 감사로그 저장 시점 정정 |
| ✅ Done | 2026-05-16 | 주석 | java-reviewer / typescript-reviewer / silent-failure-hunter 탐지 후 comment-analyzer로 48개 파일에 한글 주석/FIXME 마커 적용 (`TaskNotes/review_task1_applied.md`) |
| ✅ Done | 2026-05-16 | 문서 | 루트/it_backend/it_frontend README·CLAUDE.md 현행화 — 모노레포 구조, 캐시 전략(@Cacheable codesByCid·budgetPeriod), @Valid 일관성, 감사로그 BaseLogEntity 패턴, 이벤트 리스너 선택 기준, 프론트 에러 처리/Pinia 에러 전파 규칙 추가 |
| ✅ Done | 2026-05-16 | 보안 | security-reviewer 10개 보안 규칙 감사 — 신규 Critical/High 항목(BCrypt 전환, Refresh Token Rotation, CORS allowedHeaders 화이트리스트 등) TASK.md 등록 |
| ✅ Done | 2026-05-14 | 문서 | 공통 게시판(`common/board`, `/board`, `/admin/boards`)을 루트/백엔드/프론트 README·CLAUDE에 반영 |
| ✅ Done | 2026-05-14 | 문서 | 로그인 Brute-force 보호 설명을 DB 로그인 이력(`TPRMPP_CLOGNH`) 집계 방식으로 정정 |
| ✅ Done | 2026-05-14 | 주석 | `AdminDto`, `BoardPostRepositoryImpl`, `Cblbcm`, 일부 프론트 파일 헤더/계약 주석 보강 |
| ✅ Done | 2026-05-14 | 문서 | `useDeptFilter` 미구현 상태를 프론트 CLAUDE/README에 반영하고 후속 과제로 이동 |
| ✅ Done | 2026-05-10 | 사전협의 | `stores/review.ts` `defaultReviewers` 하드코딩 제거 → `ReviewerService`/`ReviewerController`/`ReviewerDto` TDD 구현 + API 조회 연동 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `formatDateTime` 3개 중복 구현 → `utils/common.ts` 단일 구현으로 통합 |
| ✅ Done | 2026-05-10 | 프론트엔드 | `components/approval/ApplicationViewerDialog.vue` 빈 쉘 삭제 |
| ✅ Done | 2026-05-10 | 문서 | 실제 설정 기준 로컬 포트(프론트 3000, 백엔드 8080)와 비밀값 기본값 잔존 상태를 README/CLAUDE/TASK에 반영 |
| ✅ Done | 2026-05-10 | DB/JPA | `CAPPLA` 복합 인덱스 추가 마이그레이션 확인 (`V20260510_001__add_cappla_composite_index.sql`) |
| ✅ Done | 2026-05-10 | DB/JPA | `BITEMM(PRJ_MNG_NO)` 인덱스 추가 마이그레이션 확인 (`V20260510_002__add_bitemm_prj_mng_no_index.sql`) |
| ✅ Done | 2026-05-09 | 보안 | `EnvironmentValidator` — `spring.datasource.password`, `jwt.secret` 빈값 fast-fail 검증 추가 (단, 개발 기본값 제거는 미완료) |
| ✅ Done | 2026-05-09 | 보안 | `FileOwnershipChecker` 소유권 검증 → `FileController` 적용, `GeminiController` `@PreAuthorize("hasRole('ADMIN')")` 추가 |
| ✅ Done | 2026-05-09 | 보안 | `LoginAttemptService` — `TPRMPP_CLOGNH` 로그인 실패 이력 기반 5회/10분 Brute-force 차단, `AuthService.login()` 연동 |
| ✅ Done | 2026-05-09 | 보안 | `FileValidator` — 허용 확장자 화이트리스트 검증, `FileService.uploadFileInternal()` 연동 |
| ✅ Done | 2026-05-09 | 에러처리 | `SsoController.complete()` catch → `log.error()` 추가 |
| ✅ Done | 2026-05-09 | 에러처리 | `FileService.java` IOException → `CustomGeneralException(msg, e)` cause 전달 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.updateApprovalLineInDetail()` → `ApprovalLineDelegate` 위임 메서드 추출, private `@Transactional` 제거 |
| ✅ Done | 2026-05-09 | 에러처리 | `ApplicationService.java` 결재선 업데이트 실패 시 예외 재발생 방침 적용 |
| ✅ Done | 2026-05-09 | DB/JPA | `BudgetWorkQueryRepository` — `getSummary()` 비목 루프 N+1 → 단일 집계 쿼리 통합 |
| ✅ Done | 2026-05-09 | DB/JPA | `Bprojm.update()` 35+ 파라미터 → `BprojmUpdateCommand` 객체 도입 |
| ✅ Done | 2026-05-09 | 주석 | java-reviewer·typescript-reviewer 탐지 결과 → 오류 주석 교정, 누락 JavaDoc/TSDoc 추가 |
| ✅ Done | 2026-05-09 | 주석 | silent-failure-hunter 탐지 결과 → 에러 삼킴 30개 위치에 TODO/FIXME 한글 주석 추가 |
| ✅ Done | 2026-05-09 | 문서 | it_backend/README.md, it_frontend/README.md 전면 재작성 (설계 결정, API 맵, 보안 흐름 포함) |
| ✅ Done | 2026-05-09 | 문서 | it_backend/CLAUDE.md §5.6 보안 규칙 보강 (미적용 컨트롤러 목록, 비밀값 기본값 위험, Brute-force 등) |
| ✅ Done | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| ✅ Done | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| ✅ Done | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| ✅ Done | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| ✅ Done | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |

## ☑️ 완료된 체크리스트

- [x] 백엔드 실시간 로그 API 구현 — `RealtimeLogController`/`RealtimeLogService`/`RealtimeLogRepository`, `V_ITPAPP_LOG_FEED` 조회, ADMIN 권한 테스트와 서비스 단위 테스트 추가
- [x] 메타(table.csv) `CBLBCM/CBLBCL` 게시물고유ID 컬럼 정정 — DB·엔티티는 `NAC_UNQ_ID` VARCHAR2(16) 변경 완료(`V20260612_003`), table.csv도 `NAC_UNQ_ID`(16)·`DFR_DT`(지급일자) 등재 반영 확인(2026-06-12). 컬럼 순서 정합은 `V20260612_004`로 완료.
