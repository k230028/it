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
| **W1** ✅ 완료 | — | `bbrC` 부서필터(`Contract/Deliberation/PaymentRepositoryImpl` + 과업심의 목록) — 구현·it_backend main 통합·**런타임 검증 완료**(로컬 Oracle 실데이터, 2026-06-29). plan [`2026-06-28-bbrc-dept-filter.md`](docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md) | TASK_DONE 이관 완료 |
| **W2** ✅ 완료 | — | 영향도 낮은 코드부채 13건 묶음 처리(4 PR) — `@Valid` 보강(Council/BoardPost), 클래스레벨 `@Transactional(readOnly)`(Plan/LoginAttempt), N+1 제거(ScheduleService·`CouncilService.deriveCurrentYearBudget`·Deliberation/Contract/Payment.get), `CinfmmRepositoryImpl` 감사컬럼, `BtermmL` length 정정, SSO eno 로그 강등, `HostAddressProvider` 진단, `ApplicationContextHolder` 주석 정리, `CodeNameMapBuilder` 이동, council-request/result catch 바인딩. plan [`2026-06-29-low-impact-task-bundling.md`](docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md)·design [`2026-06-29-low-impact-task-bundling-design.md`](docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md). **카브아웃 2건(`changeStatus` role 분기·환율 규칙 통일)은 결정 선행 필요로 W3 재범위** | TASK_DONE 이관 완료 |
| **W3** 🧩 기능 spec/결정 필요 | 백엔드 신규 엔드포인트/스키마 또는 업무요건 결정 동반 | Mock→API(`info/index` 엔드포인트 필요; budget summary·comparison은 `ItBudgetController`·`useItBudget` 준비됨 → 페이지 wiring만 잔여), 사전협의 검토자/세션 status 영속화(선행: 검토플로우 실제 인증연동)·`authorTeam`·첨부 매핑, 게시판 서버 페이지네이션·첨부 UI·다운로드 카운트·댓글 첨부·본문 최대크기 정책(DECISION), Tiptap 변수 prop 확대·권한 필터링, 실시간로그 드릴다운·필터 저장, **(W2 카브아웃) 사업집행 4단계 `changeStatus` role 분기(업무요건 확정 선행)·품목 금액 환율 환산 규칙 통일(`BudgetWorkService` no-xcr vs `ProjectBudgetSummaryService` ×xcr 활성 충돌, DECISION 선행)** | 기능별 spec→plan |
| **W4** 🏛️ 외부/운영 의존 | KDB·DBA·운영 협의 | EAI IF_ID/UMS 발급·도메인 연동, 메타 PK 정합(BBUGTM/BRDOCM), BPOVWM 데이터 이관, **인덱스 dev/prod 적용(`V20260629_002~005`, 스크립트·로컬검증 완료 → DBA 적용 대기)** | 체크리스트 추적 |
| **Backlog** 🟢 선택 | 성능/확장/품질 | SSE/WebSocket 전환, 조회수 Redis, Oracle Text 검색, 목록 프로젝션 DTO(T16), 통합테스트 인프라(T18), 클래스 JavaDoc 누락 컨트롤러 소수 잔여(전수 86% 완료, PR-2), 토큰 재사용 탐지(T10)/Blocklist | 여유 시 |

---

## 🚧 진행 중

> 🕒 최종 업데이트: 2026-06-30 (🗄️ DB/JPA 최적화 12건 전체 완료 — P0 로컬 Oracle `@DataJpaTest` 하네스 신설 후 P1 벌크/flush·P2 N+1·P3 프로젝션 봉인·P4 인덱스·P5 Caffeine을 페이즈별 구현+2단계 리뷰로 조치. `it_backend` main `0e247a5`·`it_database` main `37fd523`. `TASK_DONE.md` §🗄️ 2026-06-30 이관. 잔여: 협의회 BPROJM 컬럼 드리프트 버그(`task_11b75a35`), P4 인덱스 dev/prod DBA 적용. design/plans `docs/superpowers/{specs,plans}/2026-06-29-db-jpa-*`)
>
> 🕒 이전 업데이트: 2026-06-29 (보안 하드닝 구현 완료 — #1·#2·#3·#5·#6·#7 6건 조치, #4 감내. 보안 § 잔여 = Blocklist(감내) 외 0건. plan `docs/superpowers/plans/2026-06-29-security-hardening.md`·design `docs/superpowers/specs/2026-06-29-security-hardening-design.md`)
>
> 🕒 이전 업데이트: 2026-06-29 (보안 하드닝 착수 — 보안 7건 plan `docs/superpowers/plans/2026-06-29-security-hardening.md`·design `docs/superpowers/specs/2026-06-29-security-hardening-design.md`. #4 Blocklist 감내(☑️ Accepted), 에러처리 클래스 JavaDoc 종료)
>
> 🕒 이전 업데이트: 2026-06-29 (재검증 — 종료 7건, 재범위/정정 7건, 2차 안전 묶음 W2b 착수. plan `docs/superpowers/plans/2026-06-29-task-recheck-improvement.md`·design `docs/superpowers/specs/2026-06-29-task-recheck-improvement-design.md`)
>
> 🕒 이전 업데이트: 2026-06-29 (W2+Low 영향도 낮은 백로그 13건 묶음 처리 완료(4 PR: it_backend `b58558d..1da0e32`, it_frontend `9035174`) → `TASK_DONE.md` 이관. SSO eno 로그 강등, `@Valid`/`@Transactional(readOnly)` 보강, N+1 4건 제거, 감사컬럼/length 정정, `HostAddressProvider` 진단, `ApplicationContextHolder`/`CodeNameMapBuilder` 정리, council-request/result catch 통일. plan `docs/superpowers/plans/2026-06-29-low-impact-task-bundling.md`·design `docs/superpowers/specs/2026-06-29-low-impact-task-bundling-design.md`. 카브아웃 2건(`changeStatus` role 분기·환율 규칙 통일)은 결정 선행 필요로 W3 재범위)
>
> 🕒 이전 업데이트: 2026-06-28 (전체 Open 항목 코드 대조 검증 → stale 3건 `TASK_DONE.md` 이관, 실행 로드맵 Wave 1~4 신설. W1 보안 High = bbrC 부서필터 1건으로 확정, plan 작성 완료(`docs/superpowers/plans/2026-06-28-bbrc-dept-filter.md`). 사전협의 영속화는 재검토 결과 코멘트는 이미 영속·검토자상태는 Phase-1 미성숙으로 시기상조 → Medium·W3로 재범위)

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ☑️ Accepted | 🟡 Medium | Access Token Blocklist 도입 검토 — 로그아웃 시 잔존 토큰(최대 15분) 무효화 필요 여부 결정. 감내(2026-06-29 결정): stateless JWT·access 15분 단기·사내 3천명. 로그아웃 시 refresh 삭제 + T10 재사용 탐지로 탈취 대응. 잔존 access(최대 15분)는 수용.                                                                              | `AuthService.logout()` Stateless 한계, 고보안 시나리오용                                        |

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

> ✅ 잔여 없음 — 종료 내역은 [`TASK_DONE.md`](TASK_DONE.md) 참조

### 🗄️ DB / JPA 최적화

> ✅ **12건 전체 완료 (2026-06-30)** — P0~P5 페이즈로 조치 후 [`TASK_DONE.md`](TASK_DONE.md) §🗄️ 2026-06-30으로 이관. 코드: `it_backend` main `0e247a5`, `it_database` main `37fd523`. design `docs/superpowers/specs/2026-06-29-db-jpa-optimization-design.md`, plans `docs/superpowers/plans/2026-06-29-db-jpa-p0~p5-*.md`. 아래는 잔여 후속 과제.

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | **[버그] 협의회 `CouncilRepository` BPROJM 컬럼 드리프트 2건** — `IT_PTL_STS_TC`(실제 `IT_PTL_RPR_STS_TC`, L93·179·181·232·234)와 `findByDepartment`의 `p.BBR_C`(BPROJM에 없음, 실제 `SVN_DPM_C` 추정, L112)가 라이브 스키마에서 `ORA-00904` → 협의회 신청대상/부서별 목록 쿼리 런타임 실패. P3 프로젝션은 동작 보존이라 미수정(범위 외). 별도 태스크 `task_11b75a35` | `CouncilRepository.java`, `all_tab_columns`(ITPOWN.TPRMPP_BPROJM), 탐지: 2026-06-30 |
| ⬜ Open | 🟡 Medium | [W4] P4 후보 인덱스(`V20260629_002~005`) **dev/prod 적용 (DBA)** — 로컬 ITPOWN 적용·Flyway local-ext 검증(success=1) 완료, dev/prod는 DBA 검토 후 수동 적용 | `it_database/migrations/V20260629_002~005`, EXPLAIN `docs/superpowers/notes/2026-06-29-p4-explain-results.md` |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
> 🗓️ 2026-06-24 리팩토링 일괄 처리 — Phase 0~4 17건 완료/종료(거짓양성·이미반영 포함)는 [`TASK_DONE.md`](TASK_DONE.md) §🎨 참조. 아래는 백엔드 신규 엔드포인트가 필요한 Mock→API 연동(별도 기능 spec 예정) 잔여분.

| ⬜ Open | 🟡 Medium | `info/index.vue` 정적 KPI/공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환 | 파일 헤더가 정적 데이터/향후 API 연결 예정임을 명시. 백엔드 엔드포인트 필요 |
| ⬜ Open | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 — 백엔드 `ItBudgetController`·`useItBudget` 준비됨, 페이지 wiring만 잔여 (W3 기능) | `pages/budget/summary.vue`, `pages/budget/comparison.vue`의 `MOCK_ROWS`/`MOCK_FSS_ROWS`/`MOCK_YOY_ROWS`를 준비된 `ItBudgetController`/`useItBudget`에 연결 |

### ⚙️ 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| ⬜ Open | 🟡 Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| ⬜ Open | 🟡 Medium | 소요예산 산정 `EstimateRepositoryImpl.search()` QueryDSL에 대한 통합 테스트 부재 (프로젝트에 `@DataJpaTest` 인프라 없음, 현재 Mockito 단위테스트만). 단계별 화면 안정화 후 통합 테스트 보강 | `it_backend/src/test/.../estimate/repository/EstimateRepositoryTest.java`, 탐지: 2026-06-07 |
| ⬜ Open | 🟡 Medium | [후속/T18] 통합테스트 인프라 부재로 Task13-15(감사로그 리스너 통합테스트, `EstimateRepository` 통합테스트, `CinfmmRepositoryImplTest`) 미착수 — H2(strategy A) 또는 Oracle(strategy B) DB-backed 테스트 전략 결정 필요. 현재 `application-test.properties`는 DataSource/JPA 제외, H2/Testcontainers 의존성 없음. (참고: 기존 `NoClassDefFoundError` 대량실패는 재현 안 됨 — byte-buddy 1.18.10/mockito 5.23.0 Java25 정상) | `application-test.properties`, 탐지: 2026-06-22 (기존 NoClassDefFoundError 분석 항목 대체) |
| ⬜ Open | 🟡 Medium | [후속/T16] 목록 프로젝션 DTO 작업(`ProjectRepositoryImpl`/`CostRepositoryImpl` DTO, `@SqlResultSetMapping`, `CouncilRepository.findWithDetails`, 4단계 상세 JOIN) 별도 계획으로 분리됨 — 미착수 | `ProjectRepositoryImpl`, `CostRepositoryImpl`, `CouncilRepository`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | **[W3 카브아웃][기술부채][DECISION]** 품목 금액 환율 환산 규칙 통일 — `BudgetWorkService`(no-xcr, `:224,322`) vs `ProjectBudgetSummaryService`(×xcr, `:86`) 활성 충돌(이중환산 위험). 단일 규칙 결정 **선행 필요** 후 정리. (2026-06-29: W2 묶음에서 카브아웃 — 단일 규칙 결정 선행) | `BudgetWorkService.java:224,322`(환율 미적용) vs `ProjectBudgetSummaryService.java:86`(amt × xcr) |

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

- [ ] `/api/admin/realtime-logs` 통합/E2E 검증 — `V_ITPAPP_LOG_FEED`(비버전 로컬 DDL `ITPOWN_DDL_live.sql:3609`) 적용 DB에서 관리자/일반사용자/미인증 접근과 since 커서 증분 조회 확인
- [ ] 라이브 피드 행 클릭 → 변경 본문(BEFORE/AFTER) 인라인 드릴다운 (`/admin/logs/[logKey]` 데이터 재사용)
- [ ] SSE 또는 WebSocket push 전환 (관리자 수·트래픽 증가 시)
- [ ] 로그 데이터 보존 정책 / 아카이브 분리 View
- [ ] 사용자별 즐겨찾기 테이블 필터 저장 (localStorage)
- [ ] `V_ITPAPP_LOG_FEED` 실행계획 `EXPLAIN PLAN` 검증 결과 기록 및 필요 시 복합 인덱스 도입
- [ ] Playwright E2E (`tests/e2e/admin/realtime-logs.spec.ts`) 백엔드+프론트 dev 모드 기동 후 실제 실행

## 📬 공통 게시판 후속 과제

- [ ] (DECISION) 본문 최대 크기 정책 결정 — 실제 `Cblbcm.nacCone VARCHAR2(4000)`
- [ ] 본문 검색 Oracle Text 인덱스 도입 (게시판당 1만 건/검색 1초 초과 시)
- [ ] 조회수 카운터 Redis 전환 (다중 인스턴스 운영 시)
- [ ] 알림(메일/슬랙) 연동 — 공지·중요 게시물 등록, 본인 게시물 댓글 알림
- [ ] 첨부파일 다운로드 카운트 컬럼 (`FL_DWN_NBR`) — 자료실 인기 자료 통계
- [ ] 댓글 첨부파일 지원 (ORC_DTT="공통게시판댓글" 추가)
- [ ] 답변글·댓글 최대 깊이 UI 5단계 캡 구현 (현재 무제한)
- [ ] 검색 키워드 최소 2자 강제 (현재 미적용)
- [ ] 본문 최대 크기 정책 결정 및 검증 추가 (현재 오픈이슈)
- [ ] 게시물 목록 서버사이드 페이지네이션 — 백엔드 `Page<T>` 응답 + 전체 건수 반환 (현재 클라이언트 페이징 size=1000)
- [ ] 게시판 단위 테스트 확대 — `BoardMetaService`, `BoardPostService` 커버리지 80%+
- [ ] 게시판 첨부파일 UI/API 연결 — 현재 게시물 타입에 `flApgYn`, `flNbr`만 있고 파일 업로드 흐름은 미연동

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

- [ ] (EXTERNAL) BPOVWM 드롭된 `PRJ_BG_AMR`(테스트 1행) 값은 `RQM_BG_AMT`로 승계되지 않음 — 메타 정정은 완료, 운영 데이터 이관 시 소요예산금액 원천 확인 필요(운영/DBA 의존).
- [ ] `TPRMPP_BBUGTM` PK 정합 보류 — 운영(table.csv)은 PK(`BG_NO`) 단일이나 로컬은 PK(`BG_NO`,`SNO`)이고 `BG_NO` 중복 20건 존재. 운영 PK 정의 재확인(메타 stale 가능성) 또는 로컬 데이터 중복 정리 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
- [ ] `TPRMPP_BRDOCM` PK 정합 보류 — 운영은 PK(`DOC_MNG_NO`) 단일이나 로컬은 PK(`DOC_MNG_NO`,`DOC_VRS_SNO`)이고 중복 2건 존재. 문서 버전 관리 구조상 운영 PK 정의 재확인 필요. 해소 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
