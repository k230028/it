# TASK 백로그 정리 및 조치 계획 설계

> 🗓️ 작성일: 2026-06-28
> 🎯 목적: `TASK.md` ⬜ Open 항목을 코드베이스와 대조 검증하여 완료(stale) 항목을 `TASK_DONE.md`로 이관하고, 잔여 항목의 실행 로드맵과 보안 High 2건의 상세 설계를 정의한다.
> 관련 문서: [`TASK.md`](../../../TASK.md), [`TASK_DONE.md`](../../../TASK_DONE.md)

---

## 1. 배경

`TASK.md`는 IT Portal 백로그의 SoT이며, 본 작업 시점 기준 **모든 항목이 ⬜ Open**이었다(완료분은 2026-06-27에 이미 이관됨). 사용자 요청은 두 가지다.

1. **완료 항목 정리** — 실제로는 이미 해소됐으나 Open으로 남은 stale 항목을 찾아 `TASK_DONE.md`로 이관.
2. **조치 계획 수립** — 보안 High 우선 + 전체 잔여 항목 로드맵.

완료 판정 방식은 **코드 대조 검증**(추측 금지, 실제 코드 근거 기반)으로 결정했다.

## 2. 검증 방법론

6개 병렬 read-only 에이전트가 `TASK.md`의 전 섹션 Open 항목을 코드베이스(`it_backend`/`it_frontend`/`it_database`/`meta`)와 대조했다. 각 항목을 `DONE` / `PARTIAL` / `STILL_OPEN` / `EXTERNAL`로 판정하고 `file:line` 근거를 수집했다.

에이전트 판정은 **메인 세션에서 spot-check로 재확인**했고, 이관 대상은 직접 코드 확인 후 확정했다. 이 과정에서 에이전트 오판 2건을 정정했다(§4).

## 3. 검증 결과 요약

대다수 항목이 `STILL_OPEN`(정상 추적) 또는 `EXTERNAL`(KDB/운영 협의 의존)로 확인됐다. **TASK.md 백로그는 대체로 정확**했고, 실제 완료된 stale 항목은 소수였다.

| 영역 | 검증 항목 수 | 주요 결과 |
| --- | :--: | --- |
| 🔒 보안 | 10 | bbrC 부서필터·changeStatus role 분기·SSO eno 로그·Tiptap 권한필터·토큰 재사용탐지/Blocklist 모두 Open 재확인. SSO 운영설정/`$apiFetch` 재시도는 코드 완성·검증(E2E/배포) 잔여 |
| 🤝 사전협의 | 3 | 세션 영속화·authorTeam·첨부 매핑 모두 Open 재확인 |
| ⚠️ 에러 처리 | 6 | `@Valid`·`@Transactional(readOnly)`·catch 바인딩 모두 Open. Java 헤더주석은 일부만 보강된 PARTIAL |
| 🗄️ DB/JPA | 18 | **`ProjectService.enrichProjectListBatch` N+1 → DONE(이관)**. N+1·인덱스·프로젝션 다수 Open |
| 🎨 프론트/⚙️ 백엔드 리팩토링 | 11 | **`applyAthIds` → Resolved(이관)**. Mock→API·환율 통일·HostAddressProvider 등 Open |
| 📝 Tiptap/실시간로그 | 14 | 백엔드 구현 완료, prop 확대·드릴다운·SSE·EXPLAIN 등 Open/외부 |
| 📬 게시판 | 14 | 서버 페이지네이션·첨부·다운로드카운트 등 Open |
| 🔌 EAI | 8 | IF_ID/UMS 발급·GWE 규칙 EXTERNAL, 도메인 연동 Open, 패턴 문서화 DONE |
| 📒 메타 | 5 | **12종 테이블 등재 → DONE(이관)**. PK 정합(BBUGTM/BRDOCM) EXTERNAL |

## 4. TASK_DONE.md 이관 (확정 3건)

| 항목 | 판정 | 근거 |
| --- | :--: | --- |
| `ProjectService.enrichProjectListBatch()` 비목 N+1 제거 | ✅ Done | `ProjectService.java:715`(enrich)·`:678` `sumDupBgByPrjMngNos()` 배치, `BbugtmRepositoryImpl.java:262` |
| `applyAthIds()` 적용 대상 최소화 (Low) | ✔️ Resolved | `MenuQueryService.java:47-49` prune된 트리에만 적용 + `MenuAuthMapProvider` 캐시로 조회비용 해소 → 추가 최적화 실익 낮음 |
| 메타 미등재 테이블 12종 등재 | ✅ Done | `meta/table.csv`에 사업집행 4단계 6테이블 + `*L` 로그 6종 등재 확인 |

### 정정된 에이전트 오판 (이관 제외, Open 유지)

- **`ApplicationContextHolder.publishEvent()`** — 에이전트는 DONE 판정했으나, `ApplicationContextHolder.java:38-53`의 `publishEvent()` JavaDoc이 구 `@TransactionalEventListener(BEFORE_COMMIT)` 기반 감사로그 방식을 그대로 설명하며 메서드도 미사용. → 주석 정리/미사용 메서드 제거 필요. **Open 유지(W2)**.
- **`BRIVGM` 검토의견 인덱스** — 에이전트는 06-27 추가 `IX_BRIVGM_DOC_DEL_FSG`로 DONE 판정했으나, 해당 인덱스는 대시보드 "미완료 검토"(`FSG_YN`)용으로 `(DOC_MNG_NO, DEL_YN, FSG_YN)` 구성. 검토의견 목록 쿼리(`FST_ENR_DTM ASC` 정렬)는 미커버. **Open 유지(W4)**.

## 5. 실행 로드맵 (Wave)

`TASK.md` 상단에 동일 표를 신설했다. 웨이브 정의는 다음과 같다.

- **W1 (보안 High)**: 즉시 조치. bbrC 부서필터(plan 완료). 사전협의 영속화는 재검토 후 W3·Medium로 재범위(§6.2). → §6 상세.
- **W2 (코드부채)**: 단독 수정 가능한 Medium/Low 다수. 묶음 PR로 처리.
- **W3 (기능 spec 필요)**: 백엔드 신규 엔드포인트/스키마가 동반되는 Mock→API 및 기능 확장. 기능별 별도 spec.
- **W4 (외부/운영 의존)**: KDB EAI 발급, DBA 인덱스/EXPLAIN, 메타 PK 정합 등.
- **Backlog (선택)**: 성능/확장/품질 개선.

## 6. 보안 High 2건 상세 설계

### 6.1 [W1-①] bbrC 부서 필터 적용

**문제**: `ContractRepositoryImpl.java:47`·`DeliberationRepositoryImpl.java:47`·`PaymentRepositoryImpl.java:43`의 `search()`가 `bbrC` 파라미터를 받지만 쿼리 조건에 추가하지 않아, 일반 사용자가 타부서 계약·심의·지급 목록을 전체 열람 가능. (CLAUDE.md §5.18에 보안 HIGH로 기록됨.) 과업심의 목록(`TASK.md` 과업심의 §)도 동일 뿌리.

**기준 구현**: `EstimateRepositoryImpl.java:46,61` — 사업(100) 단일 대상이므로 `Bprojm` LEFT JOIN + `p.svnDpmC.eq(bbrC)` 단일 조건으로 적용됨.

**난점**: Deliberation/Contract/Payment는 대상 2종 — `bgPrnTc='100'`(정보화사업, `Bprojm.svnDpmC`)과 `bgPrnTc='200'`(전산업무비, `Bcostm`의 주관부서 컬럼). 단일 JOIN으로 두 대상의 주관부서를 동시에 매핑하기 곤란.

**설계 옵션**:

| 옵션 | 방식 | 장점 | 단점 |
| --- | --- | --- | --- |
| **A. 조건부 LEFT JOIN** | `Bprojm`·`Bcostm` 둘 다 LEFT JOIN 후 `(bgPrnTc='100' AND p.svnDpmC=bbrC) OR (bgPrnTc='200' AND c.<deptCol>=bbrC)` | 스키마 변경 없음, 즉시 적용 | 쿼리 복잡, `Bcostm` 주관부서 컬럼 확인 필요, JOIN 키(cncdRfrNo↔대상관리번호) 정합 확인 필요 |
| **B. 주관부서 비정규화** | `Bcontm/Bdelim/Bpaymm`에 주관부서코드 컬럼 추가 + 생성 시점 채움 + 기존행 백필 마이그레이션 | 쿼리 단순, 인덱스 용이 | 스키마 변경·백필·쓰기경로 수정·감사로그(`*L`) 동반 |

**권장**: 옵션 A를 우선 검토하되, plan 단계에서 `Bcostm` 주관부서 컬럼명과 대상관리번호 JOIN 키를 확인한 뒤 확정. 컬럼/JOIN이 깔끔하면 A, 매핑이 불안정하면 B.

**plan 단계 선행 조사**: ① `Bcostm` 엔티티의 주관부서 컬럼 ② `Bdelim/Bcontm/Bpaymm.cncdRfrNo`가 `bgPrnTc`별로 `Bprojm.abusMngNo`/`Bcostm` 키와 매핑되는 규칙 ③ 과업심의 목록 화면이 동일 RepositoryImpl을 쓰는지.

**검증(TDD)**: CLAUDE.md §5.14 의무 — `bbrC` 지정/null 케이스 + `bgPrnTc` 100/200 혼재 케이스 Repository/Service 테스트.

### 6.2 [재범위 → W3] 사전협의 검토자/세션 status 영속화

> **2026-06-28 재검토 결론: 지금 영속화는 시기상조. 새 테이블/BRIVGM 재사용 모두 부적합·불필요 → High에서 Medium·W3로 재범위.**

**문제(원항목)**: `stores/review.ts`의 사전협의 세션 상태가 메모리 전용이라 새로고침 시 초기화.

**현황 분석**: 다음은 **이미 서버 영속**된다 — 버전 이력(`useDocuments.fetchVersionHistory`), 코멘트 본문/해결상태(`useReviewCommentApi.createComment/resolveComment`, BRIVGM `FSG_YN`), 검토자 목록(`/api/reviews/{docMngNo}/reviewers`). 항목 제목의 "**코멘트 상태**"는 이미 충족 — 새로고침에도 코멘트는 유지된다.

**실제 미영속 갭**: 검토자별 검토상태(`completeReview`, `review.ts:278-289`), 세션 status, 검토요청 버전 스냅샷(`submitForReview`, `review.ts:211-236`) — 모두 메모리 전용.

**재검토 결과 — 영속화 보류 근거**:
1. **BRIVGM 재사용 부적합(grain 불일치)**: BRIVGM은 코멘트 1건=1행이며 `findByDocMngNoAndDocVrsSnoAndDelYnOrderByFstEnrDtmAsc`가 전 행을 코멘트로 반환. `FSG_YN`은 "코멘트 해결"이지 "검토자 검토완료"가 아님. 검토자-완료는 (문서버전×검토자) grain — BRIVGM에 표식 행을 끼우면 모든 코멘트 조회를 오염시키는 취약한 해킹이 됨.
2. **Phase-1 미성숙(영속화 시기상조)**: `review.vue:101-106` currentUser가 모의 고정값(`R003 이철수`), `ReviewToolbar.vue:75-93` 검토완료가 로그인 본인이 아닌 **수동 검토자 picker** 다이얼로그. 다중검토자 워크플로우가 실제 인증과 미연동. 이 상태에서 검토자 상태를 영속화하면 모의/수동 데이터를 저장하고 스키마를 미성숙 단계에 고정.

**선행조건**: 검토 플로우를 실제 로그인 사용자와 연동(currentUser 모의값 제거) + 다중검토자 요건 확정. 이후 영속화 스키마 설계(신규 테이블 또는 Brdocm 상태컬럼)를 별도 spec으로 진행.

**재범위**: 🟠 High → 🟡 Medium, W1 → W3. 본 시점에 빌드 plan은 작성하지 않는다.

## 7. 후속 단계

- W1은 **bbrC 부서필터 1건**으로 확정 — 실행계획 [`2026-06-28-bbrc-dept-filter.md`](../plans/2026-06-28-bbrc-dept-filter.md) 작성 완료. subagent-driven 또는 inline 실행으로 진행.
- 사전협의 영속화(구 W1-②)는 위 재검토로 W3·Medium 재범위 — 검토플로우 인증 연동 선행 후 별도 spec.
- W2는 묶음 PR, W3는 기능별 spec, W4는 체크리스트 추적으로 별도 진행.
