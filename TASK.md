# 📋 IT Portal 백로그

> 🗓️ **기준일:** 2026-06-24
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

## 🗺️ 실행 로드맵 (2026-06-28 코드 대조 검증 기준)

> 잔여 ⬜ Open 항목을 조치 우선순위로 묶은 웨이브 요약. 상세 항목은 아래 영역별 표/체크리스트 참조. 코드 대조 검증 결과와 보안 High 2건 상세 설계는 [`docs/superpowers/specs/2026-06-28-task-remediation-design.md`](docs/superpowers/specs/2026-06-28-task-remediation-design.md).

| Wave | 성격 | 주요 항목 | 산출물 |
| :--: | --- | --- | --- |
| **W1** ✅ 완료 | — | `bbrC` 부서필터(`Contract/Deliberation/PaymentRepositoryImpl` + 과업심의 목록) — 구현·it_backend main 통합(2026-06-29). plan [`2026-06-28-bbrc-dept-filter.md`](docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md). **런타임 기능검증(로컬 Oracle) 잔여** | TASK_DONE 이관 |
| **W2** 🟡 코드부채 | 단독 수정 가능 | `@Valid` 보강(Council/BoardPost), 클래스레벨 `@Transactional(readOnly)`(Plan/LoginAttempt), N+1 제거(ScheduleService·`CouncilService.deriveCurrentYearBudget`·Deliberation/Contract/Payment.get), `CinfmmRepositoryImpl` 감사컬럼, `BtermmL` length 정정, SSO eno 로그 강등, `changeStatus` role 분기, 환율 규칙 통일, `HostAddressProvider` 진단, `ApplicationContextHolder` 주석 정리, council-request/result catch 바인딩 | 묶음 PR(들) |
| **W3** 🧩 기능 spec 필요 | 백엔드 신규 엔드포인트/스키마 동반 | Mock→API(`info/index`, budget summary·comparison), 사전협의 검토자/세션 status 영속화(선행: 검토플로우 실제 인증연동)·`authorTeam`·첨부 매핑, 게시판 서버 페이지네이션·첨부 UI·다운로드 카운트·댓글 첨부, Tiptap 변수 prop 확대·권한 필터링, 실시간로그 드릴다운·필터 저장 | 기능별 spec→plan |
| **W4** 🏛️ 외부/운영 의존 | KDB·DBA·운영 협의 | EAI IF_ID/UMS 발급·도메인 연동, 실시간로그 EXPLAIN/인덱스/보존정책, 메타 PK 정합(BBUGTM/BRDOCM), BPOVWM 데이터 이관, 인덱스 적용(BASCTM/BCMMTM/BRDOCM/BRIVGM/실시간로그) | 체크리스트 추적 |
| **Backlog** 🟢 선택 | 성능/확장/품질 | SSE/WebSocket 전환, 조회수 Redis, Oracle Text 검색, 목록 프로젝션 DTO(T16), 통합테스트 인프라(T18), Java 헤더주석/`AdminDto` JavaDoc 보강, `CodeNameMapBuilder` 이동, 토큰 재사용 탐지(T10)/Blocklist | 여유 시 |

---

## 🚧 진행 중

> 🕒 최종 업데이트: 2026-06-28 (전체 Open 항목 코드 대조 검증 → stale 3건 `TASK_DONE.md` 이관, 실행 로드맵 Wave 1~4 신설. W1 보안 High = bbrC 부서필터 1건으로 확정, plan 작성 완료(`docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md`). 사전협의 영속화는 재검토 결과 코멘트는 이미 영속·검토자상태는 Phase-1 미성숙으로 시기상조 → Medium·W3로 재범위)

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                                       | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈                                                   |
| ⬜ Open | 🟡 Medium | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                                          | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요                                           |
| ⬜ Open | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드가 일시적으로 관리자 화면을 노출하지 않는지 E2E 검증                                                                            | 프론트 쿠키는 UX 상태이며 최종 권한은 백엔드가 판단해야 함                                                    |
| ⬜ Open | 🟡 Medium | SSO 운영 설정 검증 강화 — `app.sso.allow-direct-eno=false`, `app.frontend-url` 실제 값, 프록시 헤더 덮어쓰기 점검                                                   | `SsoController`, `AuthController.getClientIp()` 운영 안전장치                               |
| ⬜ Open | 🟡 Medium | Access Token Blocklist 도입 검토 — 로그아웃 시 잔존 토큰(최대 15분) 무효화 필요 여부 결정                                                                              | `AuthService.logout()` Stateless 한계, 고보안 시나리오용                                        |
| ⬜ Open | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대 카운터) 도입 — Phase 3에서 회전(rotation)만 구현되어 탈취된 구 토큰의 재사용 탐지가 없음. 회전 시 무효화된 토큰이 다시 제출되면 패밀리 전체 폐기하는 메커니즘 필요 | `AuthService`(rotation 구현부), 스파이크: `docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | Tiptap 변수 metadata 프로젝트 카탈로그 권한 필터링 — 현재 인증 사용자 공통 프로젝트 목록을 반환하므로 사용자 권한/부서 기준 목록 제한 필요 | `TiptapVariableController.java`, `TiptapVariableService.java:51`, 탐지: 2026-06-24 |
| ⬜ Open | 🟡 Medium | SSO 인증 흐름 INFO 로그에 사번(eno) 평문 노출 — 성공 경로 routine INFO 로그가 PII를 운영 로그에 남김. 알림/게시판 PII 강등(2026-06-27)과 동일 정책으로 INFO→DEBUG 강등 검토 | `SsoController.java:321,373`, 탐지: 2026-06-27 |
| ⬜ Open | 🟡 Medium | 사업집행 4단계 `changeStatus` — 단방향 상태전이(인접만)는 검증하나 역할(ADMIN/작업자/신청자)별 전이 권한 분기 없음. 업무 요건(제출=본인/관리자, 완료=관리자/작업자 등) 확정 후 서비스 계층 role 분기 추가 | `EstimateService.java:115`, `DeliberationService/ContractService/PaymentService` 동일, 발견일: 2026-06-09 |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

> ✅ 활성 항목 없음 — 종료 내역은 [`TASK_DONE.md`](TASK_DONE.md) 참조

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 사전협의 검토자/세션 status 서버 영속화 — **선행조건: 검토 플로우 실제 인증 연동**. (2026-06-28 재검토: 코멘트 상태는 이미 서버 영속 — `useReviewCommentApi` createComment/resolveComment + BRIVGM `FSG_YN`. 휘발 갭은 검토자별 검토상태/세션 status뿐인데, `review.vue:101` currentUser가 모의 고정값이고 `ReviewToolbar.vue:75` 검토완료가 수동 검토자 picker라 다중검토자 워크플로우가 Phase-1 미성숙 → 영속화 시기상조. BRIVGM 재사용은 grain 불일치(코멘트 1건/행 vs 검토자-완료 1건/검토자)로 부적합) | `stores/review.ts`(completeReview/submitForReview 메모리 전용), `review.vue:101`(모의 currentUser), `ReviewToolbar.vue:75` |
| ⬜ Open | 🟡 Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| ⬜ Open | 🟡 Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

> 📦 프론트 toast/silent-failure sweep 26건(2026-06-24 완료)·`AdminMenuService`는 [`TASK_DONE.md`](TASK_DONE.md)로 이관(2026-06-27).

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | Java 파일 헤더 주석 전수 보강                                                                                                                                                                                 | 다수 Java 파일이 `package`로 바로 시작하며 파일 역할/흐름/연동 테이블 헤더가 없음                            |
| ⬜ Open | 🟡 Medium | `AdminDto` 잔여 DTO JavaDoc 보강                                                                                                                                                                        | 자격등급/사용자/조직/역할/로그인 이력/토큰/첨부파일/통계 DTO는 기본 설명만 존재                                  |
| ⬜ Open | 🟡 Medium | `LoginAttemptService` 조회 전용 트랜잭션 경계 명시 — 클래스 레벨 `@Transactional(readOnly=true)` 적용 검토 | `LoginAttemptService.java`, 발견일: 2026-06-01 |
| ⬜ Open | 🟡 Medium | `PlanService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 — 조회 위주 서비스에서 메서드별 트랜잭션 누락 방지, 쓰기 메서드는 `@Transactional` 오버라이드 | `PlanService.java:43`, 탐지: 2026-06-24 |
| ⬜ Open | 🟡 Medium | mutating 컨트롤러 요청 본문 `@Valid` 누락 점검 및 보강 — 협의회/게시판 POST·PUT 요청 DTO 검증 일관성 회복 | `CouncilController.java`, `BoardPostController.java`, 탐지: 2026-06-24 |
| ⬜ Open | 🟢 Low | `council-request/result/[id].vue` — `handleNotify`(통보 성공이나 수신자 null 시 무피드백)·`handleRequestApproval`·`handleStartResultWriting` catch 바인딩 없음. 백엔드 오류 메시지(`e.data?.message`) 미전달. `prepare/[id].vue`의 `catch (e: unknown)` 패턴으로 통일 | `pages/info/council-request/result/[id].vue:273,299,314`, 탐지: 2026-06-14 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | `BudgetWorkService.applyItemRates()` 전체 연도 BBUGTM 메모리 로드 + 루프 Soft Delete → `@Modifying` 벌크 UPDATE | `BudgetWorkService.java L243-244` |
| ⬜ Open | 🟡 Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 API용 DTO 프로젝션 (1000자 텍스트 컬럼 제외) | `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| ⬜ Open | 🟡 Medium | Native Query `Object[]` 반환 → DTO 프로젝션 또는 `@SqlResultSetMapping` 적용 | `CouncilRepository`, `ApplicationRepository`, `ServiceRequestDocRepository`, `LoginHistoryRepository`, `EvaluationRepository` |
| ⬜ Open | 🟡 Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → `flush()` 명시 또는 Spring Data `deleteAll` 통일 | `FeasibilityService.java L225` |
| ⬜ Open | 🟡 Medium | 협의회 일정/평가 사용자명 조회 N+1 제거 | `ScheduleService`, `EvaluationService`에서 사번별 `findByEno()` 반복 |
| ⬜ Open | 🟡 Medium | 협의회 위원/상태 조회 배치화 검토 | `CommitteeService`, `CouncilService` 반복 조회 후보 |
| ⬜ Open | 🟡 Medium | 협의회 목록 `BASCTM`/`BCMMTM` 역방향 조회 인덱스 검토 | 후보: `BASCTM(PRJ_MNG_NO, PRJ_SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, ASCT_ID)` |
| ⬜ Open | 🟡 Medium | `ScheduleService` 위원 사용자명 조회 N+1 제거 — 위원별 `userRepository.findByEno` 반복을 `findByEnoIn` 일괄 조회로 전환 | `ScheduleService.java:311`, 탐지: 2026-06-05 |
| ⬜ Open | 🟡 Medium | `BRDOCM` 최신버전 목록 조회 실행계획 검증 및 복합 인덱스 검토 | `findLatestVersionsAll()`의 `DEL_YN='N'` + 상관 서브쿼리 `MAX(DOC_VRS)` + `FST_ENR_DTM DESC` 정렬. 후보: `(DEL_YN, DOC_MNG_NO, DOC_VRS, FST_ENR_DTM)` |
| ⬜ Open | 🟡 Medium | `BRIVGM` 검토의견 목록 조회 인덱스 추가 검토 | 댓글 목록이 `(DOC_MNG_NO, DOC_VRS, DEL_YN)` 필터와 `FST_ENR_DTM ASC` 정렬을 사용. 후보: `(DOC_MNG_NO, DOC_VRS, DEL_YN, FST_ENR_DTM)`. (2026-06-28 재검증: 06-27 추가 `IX_BRIVGM_DOC_DEL_FSG`는 대시보드 미완료 검토용 별개 인덱스로 본 정렬 쿼리 미커버 → Open 유지) |
| ⬜ Open | 🟡 Medium | `CouncilRepository.findWithDetails()` Native Query `Object[]` 전용 DTO/projection 전환 우선 처리 | 16개 컬럼 순서와 서비스 캐스팅이 강하게 결합되어 오매핑 위험 |
| ⬜ Open | 🟡 Medium | `CinfmmRepositoryImpl.markAllReadByRcvUsid()` QueryDSL 벌크 UPDATE 후 `LST_CHG_DTM`/`LST_CHG_USID` 미갱신 — JPA Auditing 우회, 1차 캐시 stale 발생. `clearAutomatically` 또는 감사 컬럼 명시 SET 추가 | `CinfmmRepositoryImpl.java:67-78` (→ `CouncilRepository.java:67` 동일 패턴 참조) |
| ⬜ Open | 🟡 Medium | 실시간 로그 피드 커서 폴링 인덱스/실행계획 검증 — `CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC`, `LOG_KEY`, `CHG_DTT_YN` 필터와 5/30분 집계가 View 기반으로 충분히 지원되는지 확인 | `RealtimeLogRepository.java`, `V_ITPAPP_LOG_FEED`, 탐지: 2026-06-05 |
| ⬜ Open | 🟡 Medium | `Deliberation/Contract/PaymentService.get()` 상세 조회 대상명 별도 SELECT 제거 — `loadCurrent()` + `resolveTargetName()` 2쿼리를 `EstimateRepositoryImpl`처럼 BPROJM/BCOSTM LEFT JOIN 프로젝션 단일 쿼리로 통일. 목록→상세 순차 로드 시 누적 N+1 | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176`, 탐지: 2026-06-09 |
| ⬜ Open | 🟡 Medium | [후속/T13] 캐시 TTL 미적용 보완 — 현재 `ConcurrentMapCacheManager`는 TTL 미지원. `tiptapMetadata`는 프로젝트 쓰기 시 stale 가능(`ProjectService` 쓰기경로에 `@CacheEvict` 추가 또는 Caffeine 도입 필요); `NotificationService` unread-count는 60s TTL 미적용(evict-on-write로 대체됨). Caffeine 전환 또는 쓰기경로 evict 보강 결정 필요 | `ProjectService`, `TiptapVariableService`(metadata), `NotificationService`, 탐지: 2026-06-22 |
| ⬜ Open | 🟢 Low | [후속] `BtermmL.IND_RSN` `@Column(length=600)` — `TPRMPP_BTERML` DDL 대조해 `BcostmL`과 동일한 `@Column(length)` 드리프트 여부 확인 (BcostmL은 2026-06-22 정정 완료) | `BtermmL.java`, `TPRMPP_BTERML`, 탐지: 2026-06-22 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
> 🗓️ 2026-06-24 리팩토링 일괄 처리 — Phase 0~4 17건 완료/종료(거짓양성·이미반영 포함)는 [`TASK_DONE.md`](TASK_DONE.md) §🎨 참조. 아래는 백엔드 신규 엔드포인트가 필요한 Mock→API 연동(별도 기능 spec 예정) 잔여분.

| ⬜ Open | 🟡 Medium | `info/index.vue` 정적 KPI/공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환 | 파일 헤더가 정적 데이터/향후 API 연결 예정임을 명시. 백엔드 엔드포인트 필요 |
| ⬜ Open | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 목업 데이터 API 연동 | `pages/budget/summary.vue`, `pages/budget/comparison.vue`의 `MOCK_ROWS`/`MOCK_FSS_ROWS`/`MOCK_YOY_ROWS` TODO. 백엔드 엔드포인트 필요 |

### ⚙️ 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| ⬜ Open | 🟡 Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| ⬜ Open | 🟡 Medium | 소요예산 산정 `EstimateRepositoryImpl.search()` QueryDSL에 대한 통합 테스트 부재 (프로젝트에 `@DataJpaTest` 인프라 없음, 현재 Mockito 단위테스트만). 단계별 화면 안정화 후 통합 테스트 보강 | `it_backend/src/test/.../estimate/repository/EstimateRepositoryTest.java`, 탐지: 2026-06-07 |
| ⬜ Open | 🟢 Low | `ApplicationContextHolder.publishEvent()` 잔여 이벤트 기반 감사로그 주석 정리 — `AuditLogEvent`는 2026-06-22 삭제됨, `ApplicationContextHolder` 측 잔여 참조/주석만 점검 | 현재 감사로그는 `ChangeLogEntityListener`가 `AuditLogPersister.persist()` 직접 호출. (2026-06-28 재검증: `ApplicationContextHolder.java:38-53` `publishEvent()` JavaDoc이 구 `@TransactionalEventListener(BEFORE_COMMIT)` 방식을 그대로 설명 + 메서드 미사용 → 주석 정리/미사용 메서드 제거 필요, Open 유지) |
| ⬜ Open | 🟡 Medium | [후속/T18] 통합테스트 인프라 부재로 Task13-15(감사로그 리스너 통합테스트, `EstimateRepository` 통합테스트, `CinfmmRepositoryImplTest`) 미착수 — H2(strategy A) 또는 Oracle(strategy B) DB-backed 테스트 전략 결정 필요. 현재 `application-test.properties`는 DataSource/JPA 제외, H2/Testcontainers 의존성 없음. (참고: 기존 `NoClassDefFoundError` 대량실패는 재현 안 됨 — byte-buddy 1.18.10/mockito 5.23.0 Java25 정상) | `application-test.properties`, 탐지: 2026-06-22 (기존 NoClassDefFoundError 분석 항목 대체) |
| ⬜ Open | 🟡 Medium | [후속/T16] 목록 프로젝션 DTO 작업(`ProjectRepositoryImpl`/`CostRepositoryImpl` DTO, `@SqlResultSetMapping`, `CouncilRepository.findWithDetails`, 4단계 상세 JOIN) 별도 계획으로 분리됨 — 미착수 | `ProjectRepositoryImpl`, `CostRepositoryImpl`, `CouncilRepository`, 탐지: 2026-06-22 |
| ⬜ Open | 🟢 Low | [후속/minor] `CodeNameMapBuilder` 위치(`domain/budget/cost/util`)가 `ProjectService`와 공유되므로 `common` 패키지로 이동 검토 | `CodeNameMapBuilder`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | [기술부채] 품목 금액 환율 환산 규칙 통일 — `ProjectBudgetSummaryService`(amt × xcr)와 과거 `recalcCurrentYearBudget`(× 미적용)의 비대칭. MPL_AMT는 현재 AMT 규칙을 지점별로 미러링 중. 단일 규칙으로 정리 | 2026-06-22 품목 예정금액(MPL_AMT) 전환에서 분리 |
| ⬜ Open | 🟢 Low | [후속/perf] `CouncilService.deriveCurrentYearBudget` 협의회 목록 N+1 — 행마다 `findByAbusMngNoAndDelYn` 호출. 협의회 목록 규모 증가 시 배치 prefetch로 전환 | `CouncilService`, 탐지: 2026-06-22 (품목 MPL_AMT 전환) |
| ⬜ Open | 🟡 Medium | EAI HostAddressProvider 로컬 IP/MAC 조회 실패 진단 보강 — 원인 예외 없이 info만 남아 전문 공통부 공백 원인 추적 곤란 | `HostAddressProvider.java:34`, `HostAddressProvider.java:57`, 탐지: 2026-06-24 |

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
- [ ] (코드리뷰 LOW-4) `EaiServiceTest`에 `umsTrSno=""`/비숫자 케이스 추가 — `Integer.parseInt` `NumberFormatException` → `EaiResult.failure` 경로 명시적 커버.
- [ ] (플러그형) GWE `RMS_SYS_C`("GWE")·`IF_ID`·`MSG_KEY` 접두("mailt") 실제 규칙 KDB 확인. GWE 발신자 상수(systemalert/관리자)·SYSTEM_CODE 운영값 확인.
- [ ] 신규 시스템 연동 시 EaiPayload(record) + EaiPayloadSection(@Component) 1쌍 추가 패턴 따름.

## 🏛️ 과업심의위원회 (Stage ②) 후속 과제


## 📒 메타 용어사전(table.csv) 정합성 후속 과제 (2026-06-11 스키마 통일 작업 잔여)

- [ ] 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 정정(N → Y) — 지급 회차는 지급일자 미확정(작성중) 상태로 저장될 수 있어 DB는 NULL 허용 유지(2026-06-12 결정, `V20260612_004` 헤더 참조). 운영 메타 NULL여부=N 등재가 stale — 정정 필요.
- [ ] BPOVWM 드롭된 `PRJ_BG_AMR`(테스트 1행) 값은 `RQM_BG_AMT`로 승계되지 않음 — 운영 데이터 이관 시 소요예산금액 원천 확인 필요.
- [ ] `TPRMPP_BBUGTM` PK 정합 보류 — 운영(table.csv)은 PK(`BG_NO`) 단일이나 로컬은 PK(`BG_NO`,`SNO`)이고 `BG_NO` 중복 20건 존재. 운영 PK 정의 재확인(메타 stale 가능성) 또는 로컬 데이터 중복 정리 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
- [ ] `TPRMPP_BRDOCM` PK 정합 보류 — 운영은 PK(`DOC_MNG_NO`) 단일이나 로컬은 PK(`DOC_MNG_NO`,`DOC_VRS_SNO`)이고 중복 2건 존재. 문서 버전 관리 구조상 운영 PK 정의 재확인 필요. 해소 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
