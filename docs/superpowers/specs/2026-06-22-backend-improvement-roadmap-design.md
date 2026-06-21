# 백엔드 개선 로드맵 (Design / Spec)

> 🗓️ 작성일: 2026-06-22
> 🎯 목적: `TASK.md` 백엔드 4개 섹션(🔒 보안 · ⚠️ 에러 처리 · 🗄️ DB/JPA · ⚙️ 백엔드 리팩토링)의 잔여 ⬜ Open 항목을 **코드 광범위 대조로 검증**한 뒤, 공통 테마로 묶어 단계별 개선 계획을 정의한다.
> 📎 관련: [`TASK.md`](../../../TASK.md) (활성 백로그), [`TASK_DONE.md`](../../../TASK_DONE.md) (완료 아카이브)

---

## 1. 배경 & 검증 방법

### 1.1 검증 방식 (2-tier, Tier 2 광범위 적용)
- **Tier 1 — 마커 기반:** IDE 라이브 진단(FIXME/TODO/미사용 30건)을 "아직 열려있음"의 권위 기준으로 사용. `[B-x-xx]` 코드·`파일:라인`을 인용한 TASK 행과 대조.
- **Tier 2 — 설계성 항목:** 마커가 없는 소유권 검증·N+1·인덱스·캐시 항목은 인용 파일에 국한하지 않고 **관련 서비스/리포지토리/마이그레이션 전반을 직접 대조**하여 조치 흔적 유무로 판정.
- 판정은 읽기 전용 병렬 에이전트 4개(보안/에러처리/DB·JPA/리팩토링)가 수행, 근거를 `파일:라인` 또는 `V*.sql`로 명시.

### 1.2 검증 결과 요약
| 섹션 | DONE(이관) | OPEN | PARTIAL | SKIP/범위외 |
| --- | :--: | :--: | :--: | :--: |
| 🔒 보안 | 1 | 28 | 3 | 3(프론트/정책) |
| ⚠️ 에러 처리(백엔드) | 1 | 11 | 1 | 다수(프론트) |
| 🗄️ DB / JPA | 3 | 36 | 4 | — |
| ⚙️ 백엔드 리팩토링 | 2 | 7 | 2 | 1(프론트)·1(런타임) |

**완료 확정 7건은 `TASK_DONE.md` → "🔎 2026-06-22 코드 대조 검증 완료(백엔드)"로 이관 완료.**
(CodeController @Valid · Feasibility 물리DELETE 정책 · getDashboard 안전캐스트 · BestimL 시퀀스 정합 · BprojmL cncdRfrNo · 알림 테스트 · Tiptap 테스트)

### 1.3 신규 발견(미등록) — TASK.md 등록 권장
라이브 진단에서 확인됐으나 TASK.md에 미등록된 잔여:
- `ApplicationController.java:148,176` — `@Valid` 누락(Bean Validation 미동작). → Phase 2 T7 포함
- `BoardCommentService.java:242` — 멘션 진단 INFO 로그 5건(PII 사번) 운영 전 제거. → Phase 3 T11 포함
- `BoardCommentService.java:24` 미사용 import, `FileService.java:126` 미사용 필드 `FL_MNG_NO_RETRY`. → Phase 5 T17 포함

---

## 2. 개선 로드맵 (5단계)

각 테마(T)는 **개별 항목을 공통 조치로 묶은 단위**다. 우선순위는 보안·데이터 정합 > 안정성 > 성능 > 정리 순.

### 🔴 Phase 1 — Critical: 데이터 정합 & 권한 (즉시)

| 테마 | 공통 조치 | 묶인 항목 | 의존성 |
| --- | --- | --- | --- |
| **T1. 공통 `OwnershipVerifier` 유틸** | `e.getFstEnrUsid().equals(user.getEno()) \|\| user.isAdmin()` 표준 검증기를 `common`에 도입 후 위임 | FileController(읽기/수정/삭제 권한), 요구사항정의서 CRUD 소유권, 사업집행 4단계 쓰기 5메서드, QnaService `ROLE_ITPAD001`→`isAdmin()` 교정 | 없음(선행 유틸) |
| **T2. `findByIds` null-삼킴 제거** | `IllegalArgumentException` catch+null 필터 패턴 제거 → 실패 ID warn 로그 + 호출자 통지/예외 | ApplicationService(B-H-02/B-C-03), ProjectService(B-H-03/B-C-04), CostService(B-H-04/B-C-05) | 공통 처리 패턴 합의 |
| **T3. 수평 권한(bbrC) 서버 검증** | 클라 제공 `bbrC` 신뢰 제거 → JWT 클레임/`isAdmin()` 기준 서비스 계층 필터 | documents `/dashboard`·`/badge-count`, 사업집행 4단계 Contract/Deliberation/Payment Repository bbrC 필터(Estimate 패턴 이식) | T1 유틸 재사용 |

### 🟠 Phase 2 — High: 에러 전파 & 입력 안정성 (단기)

| 테마 | 공통 조치 | 묶인 항목 |
| --- | --- | --- |
| **T4. 예외→HTTP 매핑 정비** | 전용 `NotFoundException`(404) 도입 + `GlobalExceptionHandler`에 `ResponseStatusException`/`AccessDeniedException` 핸들러 분리(403/404/500 보존) | 404 매핑, ResponseStatusException 핸들러, AccessDeniedException 핸들러 |
| **T5. 에러 로깅 표준화(B-H/B-M 묶음)** | cause 전달·스택트레이스·warn 로그 일괄 보강 | ChangeLogEntityListener(stacktrace B-H-01 / delYn B-C-02 / B-M-03), AuditLogPersister(CHG_USID B-M-02), PlanService(snapshot B-H-05 / JsonProcessing cause), FileService(업로드 B-H-01 / downloadFile cause), SsoController(sendRedirect B-H-06), AdminLogService(readField B-M-01), JwtUtil(athIds warn B-M-04), CouncilService(회의일자 파싱 warn), Gemini(file read warn B-H-03/B-M-05), NotificationEvent 길이 강제 |
| **T6. 외부호출 안전장치** | `RestClient` connect/readTimeout 설정 + 첨부 크기 사전검사 | GeminiService 타임아웃, Gemini 첨부 파일 크기 제한 |
| **T7. 입력 검증 표준화** | 컨트롤러 `@Valid` + DTO Bean Validation | ApplicationController `@Valid`, GeminiDto(@NotBlank/@Size/첨부수), 사업집행 4단계 DTO(@DecimalMin/@Pattern), NotificationController size `@Max`, TiptapVariableService 권한 FORBIDDEN 분기 |

### 🟠 Phase 3 — 보안 하드닝 (단기~중기)

| 테마 | 공통 조치 | 묶인 항목 |
| --- | --- | --- |
| **T8. 구동시 환경검증 확장** | `EnvironmentValidator`에 운영 필수 키 검증 추가(빈값/와일드카드 차단) | gemini.api.key, eai.enabled/EAI_URL, cors.allowed-origins `*` 차단, SSO 운영값(allow-direct-eno/frontend-url) |
| **T9. CORS·헤더·프록시** | 화이트리스트화 + 경로 정합 + IP 파싱 | allowedHeaders `List.of("*")`→명시, allowed-origins 기본값 `*` 제거, `/api/plan/**`→`/api/plans/**`, getClientIp 멀티IP `split(",")[0]` + 신뢰 프록시 allowlist |
| **T10. 토큰 수명주기** | refresh 시 토큰 회전 + (선택) 블록리스트 | Refresh Token Rotation, Access Token Blocklist(검토) |
| **T11. PII 노출 차단** | 응답 권한 한정 + 로그 강등/제거 | UserDto.DetailResponse 본인/ADMIN 한정, eno INFO 로그 DEBUG/마스킹, BoardCommentService 멘션 INFO 로그 제거, EaiService `e.getMessage()`→안전 추출, EaiProperties enabled+blank-url 가드 |

### 🟡 Phase 4 — 성능 (중기)

| 테마 | 공통 조치 | 묶인 항목 |
| --- | --- | --- |
| **T12. N+1 일괄조회 공통 패턴** | per-row `findById/findByEno` 루프 → `findBy...In` 또는 JOIN 프로젝션 + Map 선구성 | BudgetWorkService(getProjectSummary/resolveProjectName/computeIfAbsent·applyRates/applyItemRates 벌크), CostService(enrichCostListBatch 단말기·삭제 단말기), ProjectService(enrichProjectListBatch), ServiceRequestDoc 작성자명, ReviewComment 작성자명, Schedule/Evaluation 사용자명, Council 위원/상태, ApplicationService 결재자, getPendingCount→COUNT 쿼리 |
| **T13. 캐시 도입(@Cacheable+evict)** | 준정적·고빈도 조회 캐시 | NotificationService unread-count(TTL 60s/per-user), TiptapVariableService(resolve 인트라요청 Map·getMetadata), 메뉴 athByMenu(@Cacheable + 쓰기 @CacheEvict) |
| **T14. 인덱스 마이그레이션 묶음** | 신규 `V*.sql` 일괄 추가 | 결재 CDECIM/CAPPLM, 요구사항 BRDOCM/BRIVGM, 협의회 BASCTM/BCMMTM, 실시간로그 피드, 사업집행 4단계 마스터 복합·FST_ENR_DTM·BPAYTM, 메뉴 CMENUA/CMENUM DEL_YN |
| **T15. 시퀀스 CACHE 20** | `NOCACHE`→`CACHE 20` ALTER 마이그레이션 | SEQ_CINFMM, 사업집행 4단계 SEQ_BESTIM/BDELIM/BCONTM/BPAYMM |
| **T16. 프로젝션 & 캐시정합** | 전체 엔티티 조회→목록 DTO 프로젝션, bulk update 정합 | ProjectRepositoryImpl/CostRepositoryImpl DTO, Native Object[]→DTO/@SqlResultSetMapping, CouncilRepository.findWithDetails, CouncilRepository.updateProjectStatus/CinfmmRepositoryImpl.markAllRead(clearAutomatically/감사컬럼), FeasibilityService flush 명시, 4단계 상세 JOIN, applyAthIds 최소화 |

### 🟢 Phase 5 — 리팩토링 & 테스트 (저우선)

| 테마 | 공통 조치 | 묶인 항목 |
| --- | --- | --- |
| **T17. 코드 정리** | 일관 스타일·중복 추출·미사용 제거 | `Collectors.toList()`→`.toList()`(51건/22파일, 소비자 가변성 확인 후), buildCodeNameMap 공통 추출, DomainTargetResolver @Component 추출, BbugtmRepositoryImpl sumCost/AssetDupBg 추출, AuditLogEvent→record, 잔여 이벤트(publishEvent/AuditLogEvent) 주석 정리, BoardCommentService 미사용 import·FileService 미사용 필드 제거, BcostmL @Column(length) 정정 |
| **T18. 테스트 보강** | 통합 테스트 인프라 + 회귀 | 감사로그 리스너 통합 테스트(현재 Mockito 단위만), EstimateRepository 통합 테스트, CinfmmRepositoryImplTest 추가, 백엔드 테스트 대량 실패(`NoClassDefFoundError`) 원인 분석(런타임 `./gradlew test` 필요) |

---

## 3. 실행 원칙
- **선행 유틸 우선:** T1(OwnershipVerifier)·T2(실패통지 패턴)·T4(예외핸들러)는 다수 항목의 공통 기반이므로 먼저 구축한 뒤 적용 지점을 일괄 전환한다.
- **TDD:** 권한/에러 전파 변경은 실패 케이스 테스트 선작성(RED→GREEN). CLAUDE.md §4·테스트 규칙 준수.
- **마이그레이션 불변성:** 인덱스/시퀀스는 기존 `V*.sql` 수정 금지, 신규 버전 스크립트로만 추가(`it_database/migrations/`).
- **검증 게이트:** 각 Phase 종료 시 `./gradlew compileJava` + 관련 단위테스트 통과를 완료 조건으로 한다.
- **백로그 동기화:** 항목 완료 시 `TASK.md`→`TASK_DONE.md` 이관(근거 `파일:라인` 명시), 미등록 신규 3건은 TASK.md에 선등록.

## 4. 범위 밖 (이 로드맵 비대상)
- 프론트엔드 항목(.vue/composables/stores) — TASK.md에 그대로 유지.
- `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 — 정책/문서 결정 과제(`it_backend/CLAUDE.md`).
- 의존성 취약점(springdoc/querydsl) — 업스트림 모니터링(아카이브 ☑️ Accepted).
