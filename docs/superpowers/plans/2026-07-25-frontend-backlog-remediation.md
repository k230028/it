# 프론트엔드 잔여과제 통합 조치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트엔드 직접 과제 11건과 프론트 변경이 필요한 교차 과제 10건을 사용자 오류 상태, 서버 권한, 운영 데이터, 성능, 공통 UI 계약 순으로 안전하게 종료한다.

**Architecture:** 이 문서는 서로 독립적인 14개 작업 패키지를 순서화하는 마스터 구현 계획이다. `C:\it`, `it_frontend`, `it_backend`가 독립 Git 저장소이므로 교차 기능은 백엔드 계약 PR을 먼저 만들고 이를 참조하는 프론트 PR을 뒤이어 만든다. 공통 기본값과 변환은 순수 유틸로 분리하고, 서버가 SoT인 검토 상태·작성자 조직·첨부 권한은 백엔드 계약을 먼저 구현한 뒤 프론트를 연결한다. ERR-10은 이미 작성된 상세 계획을 단일 실행 기준으로 사용하며, 나머지 태스크는 각자 RED → GREEN → 검증 → 저장소별 커밋으로 끝난다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript 6, Pinia 3, PrimeVue 4, Tiptap 3, Vitest 4, Vue Test Utils, Playwright 1.58, Spring Boot 4.1, Java 25, Spring Data JPA, Oracle, Flyway

## 실행 종료 기록 (2026-07-26)

- 구현과 검증을 완료한 범위는 `TASK_DONE.md`의 완료 이력에 따라 통합한다.
- `REV-01`, `REV-04`, `TIP-02`, `TIP-03`, `TIP-05`, `TIP-07`, `TIP-08`, `TIP-09`는 사용자 결정으로 후속 범위에서 폐기했다.
- 폐기 항목은 완료로 판정하지 않는다. 알려진 정책 불일치·접근성 제한·제품 결함과 expected-failure 증거는 분석 문서와 테스트에 보존한다.
- 아래 체크박스와 원래 완료 정의는 계획 수립 당시 실행 계약의 이력이며, 이번 종료 범위는 이 절과 `TASK_DONE.md`가 우선한다.

## Global Constraints

- 모든 신규 JavaDoc/TSDoc/인라인 주석은 한글로 작성한다.
- 프론트 API URL은 `runtimeConfig.public.apiBase` 기반 절대 URL이며 인증 요청은 `credentials: 'include'`를 유지한다.
- 사용자 시작 요청의 실패를 `console.error`만 남기고 종료하지 않고 화면 상태 또는 toast로 알린다.
- JWT·사번·이름·권한·로그 본문은 `localStorage`에 저장하지 않는다.
- 서버 권한은 JWT 인증 사용자와 서비스 계층 검증으로 강제하고 프론트 식별값을 신뢰하지 않는다.
- 신규 프론트 순수 로직·store·composable에는 Vitest, 핵심 사용자 흐름에는 Playwright를 추가한다.
- 모든 물리 컬럼명은 `C:\it\meta\meta.txt`의 용어를 사용하고 코드에는 `ITPOWN.` 스키마 접두어를 쓰지 않는다.
- Flyway 파일명은 `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`이며 적용된 파일을 수정하지 않는다.
- 기능 PR은 `npm run check`, 관련 Vitest와 Playwright를 통과하고, 백엔드 변경 PR은 `.\gradlew test`를 통과한다.
- 교차 기능은 `it_backend`와 `it_frontend`에 각각 원자적 커밋을 만들고 두 PR 설명에 상대 PR을 교차 참조한다.
- FE-03 포맷 변경은 모든 기능 PR 뒤 독립 커밋으로만 수행한다.
- FE-04와 FE-02/05는 `pages/info/council-request/index.vue`·`pages/project/estimate/index.vue`를 공유 수정하므로 단일 `it_frontend` 작업 트리에서 실행 순서(단계 4 → 단계 9)를 지키고 두 작업을 동시 브랜치로 분기하지 않는다. `formatBudget` 지역 중복은 여러 화면에 더 있으나 FE-02/05는 “의미가 같은 표현”만 통합하고 나머지는 범위 외로 둔다.
- `docs/03-analysis/` 산출물 경로가 아직 없으므로 파일 생성 전에 디렉토리를 만든다(Write 도구는 부모 디렉토리를 자동 생성).

---

## 1. 목표와 실행 원칙

1. 사용자에게 잘못된 정상 상태를 보여 주는 오류를 가장 먼저 제거한다.
2. 서버가 단일 진실 공급원이어야 하는 검토 상태·권한·첨부파일은 API와 보안 계약을 먼저 확정한다.
3. 공통 기본값과 순수 변환 로직은 유틸과 Vitest로 잠근 뒤 화면에 적용한다.
4. 성능 개선은 DOM 렌더링 부하와 API 전송량을 구분해 검증한다.
5. 포맷팅과 스타일 정리는 기능 변경이 끝난 후 별도 변경으로 수행한다.
6. 각 과제는 코드 변경, 자동화 테스트, 수동 검증 또는 운영 데이터 증거 중 필요한 항목이 모두 확보되어야 완료로 처리한다.

## 2. 조사 결과와 기준선

### 2.1 현재 기준선

- `it_frontend` 작업 트리는 계획 수립 시점에 깨끗하다.
- 루트 저장소에는 사용자가 작업 중인 기존 문서 변경이 있으므로 이 계획은 기존 파일을 수정하지 않고 신규 문서로 작성한다.
- 2026-07-25 `prettier --list-different .` 재측정 결과 포맷 드리프트는 22개 파일이다. `TASK.md`의 33개는 과거 기준선이므로 FE-03 완료 판정에는 최신 목록을 사용한다.
- `app/pages/budget/status.vue`의 ESLint 경고는 `:footerClass` 3곳으로 재현된다.
- `tests/unit/components/common/ProjectListContainer.test.ts`, `tests/unit/components/common/ProjectListCard.test.ts`, `tests/unit/utils/common.test.ts`, `tests/e2e/tiptap-variable.spec.ts`, `tests/e2e/admin/realtime-logs.spec.ts`, `tests/e2e/board.spec.ts` 등 확장 가능한 기존 테스트가 있다.

### 2.2 범위 해석

| 구분 | 과제 | 처리 원칙 |
| --- | --- | --- |
| 즉시 안전성 조치 | ERR-10 | 기존 상세 계획을 선행 실행한다. |
| 프론트 독립 조치 | FE-02/03/05/06/07/08/10/11, TIP-05/06, LOG-05 | 프론트 PR만으로 완료 가능하되 자동화 또는 수동 검증을 남긴다. |
| 기존 API 재사용 | FE-01 | 공통게시판 공지와 확정 협의회 일정을 운영 데이터로 사용한다. |
| 프론트 우선·백엔드 선택 확장 | FE-04 | 우선 DOM 부하를 줄이고, API 데이터량 기준을 넘으면 서버 페이지네이션을 추가한다. |
| 프론트·백엔드 동시 변경 | FE-09, REV-01/02/03, BRD-11 | 서버 계약과 권한을 먼저 확정한 뒤 프론트를 연결한다. |
| 운영 데이터 검증 | TIP-02/03 | 코드 변경 전에 로컬 Oracle 데이터와 내보내기 결과를 증거로 확인한다. |

### 2.3 File Structure

```text
it_frontend/
  app/
    utils/
      codeDefaults.ts                         # FE-10 해당없음 코드 SoT
      terminalExcelImport.ts                  # FE-09 지급주기 전용 Excel 변환
      common.ts                               # FE-02/05 파일 크기·축약 금액 포맷
    composables/
      costList/useCostRowEditing.ts           # FE-08 신규 비용 행 기본값
      useInfoHomeFeed.ts                      # FE-01 공지·협의회 일정 조합
      useProgressiveList.ts                   # FE-04 필터 후 점진 노출
      useFiles.ts                             # BRD-11/REV-03 공통 파일 API
      useReviewCommentApi.ts                  # REV-02/03 댓글 응답 매핑
      useRealtimeLogPreferences.ts            # LOG-05 UI 선호 저장
    stores/review.ts                          # REV-01 서버 세션 상태 반영
    types/
      board.ts                                # BRD-11 게시글 첨부 DTO
      review.ts                               # REV-01/02/03 세션·조직·첨부 타입
    components/
      TiptapEditor.vue                        # TIP-06 중복 확장 제거
      common/
        ProjectListContainer.vue              # FE-04 더보기 UI
        ProjectListCard.vue                   # FE-06 의미 기반 태그 클래스
      cost/TerminalTableSection.vue           # FE-09 Excel 업로드 연결
      review/
        ReviewToolbar.vue                     # REV-01 인증 사용자 완료 흐름
        ReviewCommentPopover.vue              # FE-02 공용 파일 크기 포맷
        ReviewMessenger.vue                   # FE-02 공용 파일 크기 포맷
      admin/realtime/RealtimeFeedTable.vue    # LOG-05 즐겨찾기 표시
    pages/
      info/index.vue                          # FE-01 운영 공지·일정
      project/bizplan/[abusMngNo].vue         # FE-11 오류 계약 행 안내
      project/bizplan/index.vue               # FE-04 점진 노출 소비자
      project/estimate/index.vue              # FE-04 점진 노출 소비자
      info/council-request/index.vue           # FE-04/05 점진 노출·금액 포맷
      board/[blbMngNo]/form.vue                # BRD-11 작성 후 파일 업로드
      board/[blbMngNo]/[nacMngNo]/edit.vue     # BRD-11 파일 추가·삭제
      board/[blbMngNo]/[nacMngNo]/index.vue    # BRD-11 파일 조회·다운로드
      info/documents/[id]/review.vue           # REV-01/03 인증·첨부 연결
      admin/realtime-logs.vue                  # LOG-05 필터 상태
      budget/status.vue                        # FE-07 속성명 경고
    assets/css/tags.css                        # FE-06 의미 기반 색상
  tests/
    unit/
      composables/costList/useCostRowEditing.test.ts
      composables/useInfoHomeFeed.test.ts
      composables/useProgressiveList.test.ts
      composables/useReviewCommentApi.test.ts
      composables/useRealtimeLogPreferences.test.ts
      components/common/ProjectListContainer.test.ts
      components/common/ProjectListCard.test.ts
      components/TiptapEditor.test.ts
      pages/projectBizplanValidation.test.ts
      utils/common.test.ts
      utils/terminalExcelImport.test.ts
    e2e/
      board.spec.ts
      cost.spec.ts
      tiptap-variable.spec.ts
      admin/realtime-logs.spec.ts

it_backend/
  src/main/java/com/kdb/it/
    common/board/
      dto/BoardPostDto.java                    # BRD-11 첨부 메타 응답
      service/BoardPostService.java            # BRD-11 파일 캐시 동기화
    domain/budget/document/
      controller/ReviewCommentController.java  # REV-02/03 댓글 API
      dto/ReviewCommentDto.java                # REV-02/03 조직·첨부 응답
      service/ReviewCommentService.java
    infra/file/
      authz/ReviewCommentFileReadAuthorizer.java
      authz/FileReadAuthorizerRegistry.java
      service/FileService.java
  src/test/java/com/kdb/it/
    common/board/service/BoardPostServiceTest.java
    domain/budget/document/service/ReviewCommentServiceTest.java
    infra/file/authz/ReviewCommentFileReadAuthorizerTest.java

docs/superpowers/specs/
  2026-07-25-review-session-contract.md        # REV-01 메타용어·상태전이 승인 산출물
```

## 3. 선행 설계 결정

### 3.1 FE-01 운영 데이터 소스

- 공지: 활성 공통게시판 중 `itPtlBlbTc='001'`인 공지 게시판의 최신 공개 게시물 5건을 사용한다.
- 일정: 현재 사용자가 조회할 수 있는 확정 협의회 일정 중 오늘 이후 항목을 날짜·시간순으로 사용한다.
- API 실패를 정적 예시 데이터로 대체하지 않는다. 로딩, 오류, 빈 결과를 서로 다른 화면 상태로 표시하고 오류 상태에 재시도를 제공한다.
- 활성 공지 게시판이 없는 경우는 “등록된 공지가 없습니다”라는 운영 설정 빈 상태로 처리하고, API 자체 실패와 구분한다.
- 사용하는 코드값 `itPtlBlbTc='001'`(공지 게시판 유형)과 `asctStsC='06'`(확정 협의회 상태)은 구현 전 `CCODEM`/`meta.txt`에서 실제 코드값을 확인하고, 다르면 명명 상수로 교정한다.

### 3.2 FE-04 목록 성능 계약

- 1차 목표는 전체 카드 DOM 렌더링 제거다. 세 화면 모두 최초 20건만 노출하고 “더보기”로 20건씩 확장한다.
- 검색·필터·연도 변경 시 표시 건수를 최초값으로 초기화한다.
- 데이터 정렬과 필터링은 전체 결과에 먼저 적용하고 마지막 단계에서 화면 표시 범위를 잘라야 한다.
- API 응답 건수와 전송 크기를 계측한다. 운영 예상 최대치가 합의 임계값을 넘거나 응답 시간이 유의미하게 증가하면 백엔드 커서 또는 페이지 기반 조회를 후속 API 게이트로 연다.
- 클라이언트 “더보기”만 적용한 상태에서는 “DOM 성능 개선 완료”로 기록하고, 네트워크 성능까지 해결했다고 기록하지 않는다.

### 3.3 FE-09/10 해당없음 코드 계약

- 백엔드 `CodeDefaults.NOT_APPLICABLE`에 대응하는 프론트 상수 `NOT_APPLICABLE_CODE = '0'`를 `app/utils/codeDefaults.ts`에 둔다.
- Excel 지급주기(`dfrCleC`)가 비어 있거나 코드와 일치하지 않으면 해당없음으로 변환한다.
- 사용자가 입력한 값이 코드와 일치하지 않은 행은 조용히 성공시키지 않고 행 번호와 함께 경고 toast를 표시한다.
- 단말종류·단말분류처럼 빈 값이 허용되는 컬럼의 공용 `codeId()` 계약은 변경하지 않는다.

### 3.4 REV-01 검토 상태 모델

검토 요청·참여·완료 상태는 브라우저 메모리나 사용자가 선택한 검토자 값이 아니라 서버 상태와 인증 사용자로 결정한다.

- 논리 키: 문서 관리번호 + 문서 버전 + 검토자 사번
- 최소 상태: `PENDING`, `IN_PROGRESS`, `COMPLETED`
- 최소 이력: 요청자, 요청시각, 검토자, 참여시각, 완료시각
- 검토 요청 권한: 문서 소유자 또는 관리자
- 완료 권한: 현재 인증 사용자가 해당 문서 버전에 배정된 검토자인 경우에만 허용
- 완료 API는 클라이언트에서 임의 `reviewerEno`를 받지 않는다.
- 물리 테이블명과 컬럼명은 구현 전에 `meta/meta.txt`에서 용어를 확인한다. 적합한 메타용어가 없으면 임의 약어를 만들지 않고 명명 결정을 별도 기록한다.

권장 API 계약:

```text
GET  /api/documents/{docMngNo}/review-session?docVrs={version}
POST /api/documents/{docMngNo}/review-session
PATCH /api/documents/{docMngNo}/review-session/me/complete
```

### 3.5 REV-02 작성자 팀명 계약

- `ReviewCommentDto.Response`에 `authorTeam`을 추가한다.
- 작성자 사번, 이름, 현재 팀명을 한 번에 조회하는 배치 프로젝션을 사용해 댓글별 추가 쿼리를 막는다.
- 프론트 `authorTeam` 타입은 고정된 검토팀 열거형으로 강제하지 않고 실제 조직명을 표현할 수 있는 문자열로 변경한다.
- 퇴직·조직 미조회 사용자는 빈 문자열 또는 “소속 미상” 표시 정책으로 처리한다.

### 3.6 REV-03/BRD-11 첨부파일 계약

- 새 파일 저장소를 만들지 않고 기존 `CFILEM`과 공통 파일 API를 재사용한다.
- 게시글 첨부는 기존 `pkColNm='공통게시판'`, `pkCone=nacMngNo` 계약을 사용한다.
- 검토의견 첨부는 댓글 식별자를 부모키로 사용하는 별도 원천 구분값을 추가하고, 파일 읽기 권한 판정기가 댓글의 상위 문서 접근 권한을 확인하게 한다.
- 작성 화면에서는 부모 레코드를 먼저 만든 뒤 파일을 업로드한다. 파일 업로드 일부 실패 시 본문 생성 성공을 숨기지 않고, 실패 파일 목록과 재시도 동작을 제공한다.
- 게시글의 `flApgYn`, `flNbr` 캐시는 파일 추가·삭제 성공 후 서버에서 동기화한다. 프론트가 이 값을 임의 계산해 저장하지 않는다.

### 3.7 LOG-05 저장 범위

`it_frontend/CLAUDE.md`는 인증·권한·개인정보를 localStorage에 저장하지 못하게 한다.

- localStorage에는 로그 테이블 식별자와 필터 UI 설정만 버전이 있는 키로 저장한다.
- 사용자 사번, 이름, 권한은 저장하지 않는다.
- “사용자별”을 계정 간 서버 동기화 의미로 요구하면 localStorage 구현을 중단하고 서버 사용자 환경설정 API로 전환한다.
- 이번 계획의 기본 해석은 동일 브라우저 프로필에 종속된 개인 UI 환경설정이다.

## 4. 실행 순서

| 단계 | 목적 | 포함 과제 | 선행조건 |
| --- | --- | --- | --- |
| 0 | 계약과 기준선 확정 | REV-01, LOG-05, FE-04의 결정 사항 | 관계자 결정 |
| 1 | 잘못된 정상 상태 제거 | ERR-10 | 기존 상세 계획 |
| 2 | 비용 코드 정합성 잠금 | FE-10, FE-08, FE-09 | 없음 |
| 3 | 공통 화면 안정화 | TIP-06, FE-07, FE-11 | 단계 1과 병행 가능 |
| 4 | 운영 데이터·목록 성능 | FE-01, FE-04 | API 응답 계약 확인 |
| 5 | 게시판 첨부 연결 | BRD-11 | 파일 캐시 동기화 방식 확정 |
| 6 | 검토 워크플로 서버화 | REV-02, REV-01, REV-03 | 검토 상태 모델·파일 원천값 확정 |
| 7 | Tiptap 운영 검증 | TIP-03, TIP-02, TIP-05 | TIP-06, ERR-10 완료 |
| 8 | 로그 개인화 | LOG-05 | 저장 범위 결정 |
| 9 | 공통화·디자인 정리 | FE-02, FE-05, FE-06 | 기능 변경 종료 |
| 10 | 포맷 드리프트 제거 | FE-03 | 모든 기능 PR 병합 |

## 5. 단계별 상세 계획

### 단계 0. 설계 게이트

#### 작업 0-1. 검토 세션 계약 확정

대상: REV-01

**Files:**

- Create: `docs/superpowers/specs/2026-07-25-review-session-contract.md`

- [ ] **Step 1: 논리 키를 `DOC_MNG_NO + DOC_VRS_SNO + IVG_USID`로 확정하고 중복 배정 금지 제약을 기록한다.**
- [ ] **Step 2: 세션 상태 `PENDING → IN_PROGRESS → COMPLETED`와 취소·재요청 허용 여부를 전이표로 기록한다.**
- [ ] **Step 3: 요청은 문서 소유자/관리자, 참여·완료는 배정된 JWT 인증 사용자만 가능하다고 기록한다.**
- [ ] **Step 4: 완료 API body에 `reviewerEno`가 없고 두 번째 동일 완료는 기존 완료 응답을 반환하는 멱등 계약을 기록한다.**
- [ ] **Step 5: 검토자 변경은 `PENDING`에서만 허용하고 참여 이후에는 409를 반환하는 정책을 승인받는다.**
- [ ] **Step 6: 메타용어 `DOC_MNG_NO`, `DOC_VRS_SNO`, `IVG_USID`, `IVG_STS_C`, `REQ_DTM`, `PTP_DTM` 사용과 완료 시각 DATE 용어 부재를 명시한다.**
- [ ] **Step 7: 메타 담당자와 업무 담당자의 승인 결과를 문서에 남긴다.**
- [ ] **Step 8: 승인된 계약 문서를 커밋한다.**

```powershell
cd C:\it
git add docs/superpowers/specs/2026-07-25-review-session-contract.md
git commit -m "docs: 검토 세션 계약 확정 (REV-01)"
```

Expected: 미승인 상태에서는 REV-01 구현 태스크를 시작하지 않는다.

#### 작업 0-2. localStorage 사용자별 의미 확정

대상: LOG-05

- [ ] **Step 1: 이번 범위를 동일 브라우저 프로필의 UI 선호 저장으로 기록한다.**
- [ ] **Step 2: 저장 필드를 `favoriteLogKeys`, `filter`, `version`으로 제한하고 개인정보·권한·로그 row 저장 금지를 기록한다.**
- [ ] **Step 3: 계정 간 동기화 요구가 새로 확인되면 LOG-05를 구현하지 않고 서버 환경설정 API 과제로 재분류한다.**

#### 작업 0-3. 목록 성능 기준선 측정

대상: FE-04

**Files:**

- Create: `docs/03-analysis/project-list-performance-baseline.md`

- [ ] **Step 1: 사업계획, 예산추정, 협의회 요청에 100/500/1,000건 fixture를 주입한다.**
- [ ] **Step 2: 각 데이터량의 first content render 시간, 전체 DOM node 수, 필터 클릭 후 next paint를 3회 측정해 중앙값을 기록한다.**
- [ ] **Step 3: 세 API의 response body bytes와 서버 응답 시간을 별도 표로 기록한다.**
- [ ] **Step 4: 최초 카드 DOM 20개와 필터 후 100ms 이내 반응을 FE-04 수용 기준으로 기록한다.**
- [ ] **Step 5: 1,000건 응답이 1MB를 넘거나 p95 서버 응답이 500ms를 넘으면 서버 페이지네이션을 별도 High 과제로 등록한다.**
- [ ] **Step 6: 기준선 문서를 커밋한다.**

```powershell
cd C:\it
git add docs/03-analysis/project-list-performance-baseline.md
git commit -m "docs: 사업 카드 목록 성능 기준선 기록 (FE-04)"
```

### Task 1: ERR-10 핵심 실패 상태 승격

대상: ERR-10

상세 구현은 기존 계획 `docs/superpowers/plans/2026-07-25-security-error-phase-c-frontend-states.md`를 단일 실행 기준으로 사용한다.

- [ ] **Step 1: `superpowers:subagent-driven-development` 또는 `superpowers:executing-plans`로 ERR-10 상세 계획의 C1~C4를 실행한다.**
- [ ] **Step 2: 통화, Tiptap, PDF, 결과 상태 동기화의 상세 계획 테스트 명령을 모두 실행한다.**
- [ ] **Step 3: 상세 계획의 네 lane 커밋과 최종 검증 결과를 `TASK_DONE.md`에 기록한다.**
- [ ] **Step 4: 실패가 KRW·빈 목록·STALE·이전 PDF로 정상처럼 보이는 잔여 폴백이 없음을 `rg`와 E2E로 확인한다.**

### Task 2: FE-10·FE-08·FE-09 비용 코드 정합성

#### 작업 2-1. 해당없음 상수 도입

대상: FE-10

**Files:**

- Create: `it_frontend/app/utils/codeDefaults.ts`
- Modify: `it_frontend/app/components/cost/TerminalFormDialog.vue`
- Modify: `it_frontend/app/components/cost/TerminalTableSection.vue`
- Modify: `it_frontend/app/composables/costList/useCostRowEditing.ts`
- Modify: `it_frontend/app/pages/info/cost/form.vue`
- Modify: `it_frontend/app/components/projects/ResourceTableSection.vue`
- Create: `it_frontend/tests/unit/composables/costList/useCostRowEditing.test.ts`

**Interfaces:**

- Produces: `export const NOT_APPLICABLE_CODE = '0' as const`
- Consumes: 백엔드 `CodeDefaults.NOT_APPLICABLE`

- [ ] **Step 1: 상수 계약을 잠그는 실패 테스트를 작성한다.**

```ts
import { NOT_APPLICABLE_CODE } from '../../../../app/utils/codeDefaults';

expect(NOT_APPLICABLE_CODE).toBe('0');
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/costList/useCostRowEditing.test.ts
```

Expected: FAIL with `Cannot find module .../codeDefaults`.

- [ ] **Step 3: 상수를 만들고 업무상 해당없음인 8개 리터럴만 교체한다.**

```ts
/** 백엔드 CodeDefaults.NOT_APPLICABLE과 동일한 해당없음 코드 */
export const NOT_APPLICABLE_CODE = '0' as const;
```

- [ ] **Step 4: 숫자 `0`과 다른 업무 코드가 치환되지 않았는지 확인한다.**

```powershell
rg -n "abusTc: '0'|dfrCleC: '0'" app
npm test -- --run tests/unit/composables/costList/useCostRowEditing.test.ts tests/unit/components/cost/TerminalFormDialog.test.ts
npm run typecheck
```

Expected: `rg` 결과 0건, tests PASS, typecheck PASS.

- [ ] **Step 5: 커밋한다.**

```powershell
git add app/utils/codeDefaults.ts app/components/cost/TerminalFormDialog.vue app/components/cost/TerminalTableSection.vue app/composables/costList/useCostRowEditing.ts app/pages/info/cost/form.vue app/components/projects/ResourceTableSection.vue tests/unit/composables/costList/useCostRowEditing.test.ts
git commit -m "refactor: 해당없음 코드 기본값 통합 (FE-10)"
```

#### 작업 2-2. 신규 비용 행 기본값 잠금

대상: FE-08

**Files:**

- Modify: `it_frontend/app/composables/costList/useCostRowEditing.ts`
- Modify: `it_frontend/tests/unit/composables/costList/useCostRowEditing.test.ts`

**Interfaces:**

- Consumes: `NOT_APPLICABLE_CODE`
- Produces: 기존 `addRow(): void` 계약을 유지하며 신규 `ItCostEx`를 `costs.value[0]`에 추가

- [ ] **Step 1: `addRow()` 기본값 실패 테스트를 작성한다.**

```ts
editing.addRow();
expect(costs.value[0]).toMatchObject({
    abusTc: NOT_APPLICABLE_CODE,
    dfrCleC: NOT_APPLICABLE_CODE,
    bseYy: 2026,
    cgprId: 'K000001',
});
```

- [ ] **Step 2: 신규 행의 위치, 로그인 사용자 있음/없음, 기준연도 폴백 케이스를 각각 실행해 실패를 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/costList/useCostRowEditing.test.ts
```

Expected: 기존 리터럴 또는 미구성 fixture 때문에 적어도 한 assertion FAIL.

- [ ] **Step 3: `addRow()`가 상수와 기존 연도·담당자 폴백만 사용하도록 최소 수정한다.**

- [ ] **Step 4: 테스트와 타입체크를 통과시킨다.**

```powershell
npm test -- --run tests/unit/composables/costList/useCostRowEditing.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: 커밋한다.**

```powershell
git add app/composables/costList/useCostRowEditing.ts tests/unit/composables/costList/useCostRowEditing.test.ts
git commit -m "test: 신규 비용 행 기본값 잠금 (FE-08)"
```

#### 작업 2-3. Excel 지급주기 전용 매핑

대상: FE-09

**Files:**

- Create: `it_frontend/app/utils/terminalExcelImport.ts`
- Modify: `it_frontend/app/components/cost/TerminalTableSection.vue`
- Create: `it_frontend/tests/unit/utils/terminalExcelImport.test.ts`
- Modify: `it_frontend/tests/e2e/cost.spec.ts`

**Interfaces:**

- Consumes: `CodeOption[]`, `NOT_APPLICABLE_CODE`
- Produces: `mapPaymentCycle(label: string, options: CodeOption[]): { code: string; matched: boolean }`
- Produces: `PaymentCycleImportWarning { excelRow: number; rawValue: string }`

- [ ] **Step 1: 공백, 일치, 미일치 지급주기 변환의 실패 테스트를 작성한다.**

```ts
expect(mapPaymentCycle('', options)).toEqual({ code: NOT_APPLICABLE_CODE, matched: true });
expect(mapPaymentCycle('월', options)).toEqual({ code: '01', matched: true });
expect(mapPaymentCycle('격주', options)).toEqual({
    code: NOT_APPLICABLE_CODE,
    matched: false,
});
```

- [ ] **Step 2: 테스트가 모듈 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/utils/terminalExcelImport.test.ts
```

- [ ] **Step 3: 순수 변환 함수와 경고 타입을 구현한다.**

```ts
export interface PaymentCycleImportWarning {
    excelRow: number;
    rawValue: string;
}

export const mapPaymentCycle = (
    label: string,
    options: CodeOption[],
): { code: string; matched: boolean } => {
    const normalized = label.trim();
    if (!normalized) return { code: NOT_APPLICABLE_CODE, matched: true };
    const option = options.find((item) => item.cdNm.trim() === normalized);
    return option
        ? { code: option.cdva, matched: true }
        : { code: NOT_APPLICABLE_CODE, matched: false };
};
```

- [ ] **Step 4: Excel 행 번호를 `rowIndex + 1`이 아니라 실제 worksheet 행 번호로 보존해 경고 toast에 넣는다.**

Expected detail example: `지급주기 미일치 2건을 해당없음으로 처리했습니다. (3행: 격주, 8행: 분기말)`.

- [ ] **Step 5: 기존 nullable `codeId()`는 변경하지 않고 단위/E2E를 실행한다.**

```powershell
npm test -- --run tests/unit/utils/terminalExcelImport.test.ts
npm run test:e2e -- tests/e2e/cost.spec.ts
npm run check
```

Expected: 업로드 직후 모든 `dfrCleC`가 non-blank, 경고 행 번호 일치, PASS.

- [ ] **Step 6: 커밋한다.**

```powershell
git add app/utils/terminalExcelImport.ts app/components/cost/TerminalTableSection.vue tests/unit/utils/terminalExcelImport.test.ts tests/e2e/cost.spec.ts
git commit -m "fix: 단말 Excel 지급주기 기본값 보정 (FE-09)"
```

### 단계 3. 공통 화면 안정화

#### Task 3: TIP-06·FE-07 화면 경고 제거

#### 작업 3-1. Tiptap 확장 중복 제거

대상: TIP-06

**Files:**

- Modify: `it_frontend/app/components/TiptapEditor.vue`
- Create: `it_frontend/tests/unit/components/TiptapEditor.test.ts`
- Modify: `it_frontend/tests/e2e/tiptap-variable.spec.ts`

**Interfaces:**

- Consumes: `StarterKit.configure({ link: false, underline: false })`
- Produces: 별도 `Underline`, `Link.configure({ openOnClick: false, autolink: true })`만 등록된 editor

- [ ] **Step 1: `console.warn`을 감시해 에디터 mount 시 중복 확장 경고가 없다는 테스트를 작성한다.**

```ts
expect(warnings.filter((message) => message.includes('Duplicate extension names'))).toEqual([]);
```

- [ ] **Step 2: 현 구현에서 테스트가 경고를 포착하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/components/TiptapEditor.test.ts
```

Expected: FAIL because `link` and `underline` are registered twice.

- [ ] **Step 3: `StarterKit`의 두 내장 확장을 끄고 별도 설정 확장을 유지한다.**

```ts
StarterKit.configure({
    heading: false,
    codeBlock: false,
    link: false,
    underline: false,
});
```

- [ ] **Step 4: mount/unmount 반복과 상세·편집 브라우저 콘솔을 검증한다.**

```powershell
npm test -- --run tests/unit/components/TiptapEditor.test.ts
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts
npm run check
```

Expected: 중복 확장 경고 0건, link/underline 동작 유지, PASS.

- [ ] **Step 5: 커밋한다.**

```powershell
git add app/components/TiptapEditor.vue tests/unit/components/TiptapEditor.test.ts tests/e2e/tiptap-variable.spec.ts
git commit -m "fix: Tiptap 중복 확장 등록 제거 (TIP-06)"
```

#### 작업 3-2. 예산 현황 속성명 경고 제거

대상: FE-07

**Files:**

- Modify: `it_frontend/app/pages/budget/status.vue`
- Test: `it_frontend/tests/unit/pages/budgetStatusFooterTotals.test.ts`

- [ ] **Step 1: 현재 경고 3건을 기준선으로 재현한다.**

```powershell
cd C:\it\it_frontend
npx eslint app/pages/budget/status.vue
```

Expected: `vue/attribute-hyphenation` warnings for `:footerClass`.

- [ ] **Step 2: 3개 속성을 `:footer-class`로 변경한다.**

- [ ] **Step 3: ESLint와 푸터 합계 회귀 테스트를 실행한다.**

```powershell
npx eslint app/pages/budget/status.vue
npm test -- --run tests/unit/pages/budgetStatusFooterTotals.test.ts
```

Expected: warning 0건, PASS.

- [ ] **Step 4: 커밋한다.**

```powershell
git add app/pages/budget/status.vue tests/unit/pages/budgetStatusFooterTotals.test.ts
git commit -m "style: 예산 현황 footer 속성명 정리 (FE-07)"
```

#### Task 4: FE-11 계약방법 오류 행 식별

대상: FE-11

**Files:**

- Modify: `it_frontend/app/pages/project/bizplan/[abusMngNo].vue`
- Create: `it_frontend/app/utils/bizplanValidation.ts`
- Create: `it_frontend/tests/unit/pages/projectBizplanValidation.test.ts`
- Create: `it_frontend/tests/e2e/bizplan.spec.ts`

**Interfaces:**

- Produces: `findMissingContractMethodRows(contracts): number[]` — 화면 기준 1부터 시작하는 행 번호
- Consumes: 계약 배열의 `nowCttManrC`, `_deleted` 값

- [ ] **Step 1: 누락 행 번호 계산의 실패 테스트를 작성한다.**

```ts
expect(
  findMissingContractMethodRows([
    { nowCttManrC: '', _deleted: false },
    { nowCttManrC: '01', _deleted: false },
    { nowCttManrC: null, _deleted: false },
    { nowCttManrC: null, _deleted: true },
  ]),
).toEqual([1, 3]);
```

- [ ] **Step 2: 유틸 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/pages/projectBizplanValidation.test.ts
```

- [ ] **Step 3: 순수 함수와 페이지 오류 상태를 구현한다.**

Toast detail contract: `계약방법이 비어 있는 행: 1, 3 (총 2건)`.

- [ ] **Step 4: 누락 Select에 `aria-invalid="true"`와 오류 클래스를 적용하고 최초 오류 input에 `scrollIntoView({ block: 'center' })` 후 focus한다.**

- [ ] **Step 5: 값을 선택하면 해당 행 오류를 제거하는 단위/E2E를 실행한다.**

```powershell
npm test -- --run tests/unit/pages/projectBizplanValidation.test.ts
npm run test:e2e -- tests/e2e/bizplan.spec.ts
npm run check
```

Expected: 첫 오류 포커스, 행 번호 toast, 수정 즉시 오류 해제, PASS.

- [ ] **Step 6: 커밋한다.**

```powershell
git add app/pages/project/bizplan/[abusMngNo].vue app/utils/bizplanValidation.ts tests/unit/pages/projectBizplanValidation.test.ts tests/e2e/bizplan.spec.ts
git commit -m "fix: 계약방법 누락 행 안내 강화 (FE-11)"
```

### 단계 4. 운영 데이터와 목록 성능

#### Task 5: FE-01 정보 홈 공지·일정 API 연결

대상: FE-01

**Files:**

- Create: `it_frontend/app/composables/useInfoHomeFeed.ts`
- Modify: `it_frontend/app/pages/info/index.vue`
- Create: `it_frontend/tests/unit/composables/useInfoHomeFeed.test.ts`
- Create: `it_frontend/tests/unit/pages/infoHomeFeed.test.ts`
- Create: `it_frontend/tests/e2e/info-home.spec.ts`

**Interfaces:**

- Consumes: `GET /api/boards/meta`, `GET /api/boards/{blbMngNo}/posts?page=0&size=5`, `GET /api/council`
- Produces: `InfoHomeNotice { id; boardId; title; createdAt; route }`
- Produces: `InfoHomeSchedule { id; title; date; time }`
- Produces: `useInfoHomeFeed(): { notices; schedules; noticeState; scheduleState; retryNotices; retrySchedules }`

- [ ] **Step 1: 공지·일정 정규화와 독립 오류 상태의 실패 테스트를 작성한다.**

```ts
expect(feed.notices.value).toHaveLength(5);
expect(feed.schedules.value.map((item) => `${item.date}${item.time}`)).toEqual([
    '202607261000',
    '202607271400',
]);
expect(feed.noticeState.value).toBe('ERROR');
expect(feed.scheduleState.value).toBe('READY');
```

- [ ] **Step 2: 모듈 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useInfoHomeFeed.test.ts
```

- [ ] **Step 3: 활성 공지 게시판(`useYn='Y'`, `itPtlBlbTc='001'`)을 찾고 최신 공개 게시물 5건을 조회한다.**

게시판 없음은 `EMPTY`, API 실패는 `ERROR`로 구분한다. 실패를 정적 예시로 대체하지 않는다.

- [ ] **Step 4: 권한 필터링된 `/api/council` 결과에서 `asctStsC='06'`, `cnrcDt >= 오늘`, `cnrcDt/cnrcTm non-null`만 날짜·시간순으로 변환한다.**

- [ ] **Step 5: 페이지의 정적 공지 5건과 정적 일정 2건을 제거하고 영역별 LOADING/ERROR/EMPTY/READY 및 재시도 버튼을 연결한다.**

- [ ] **Step 6: 한쪽 실패가 다른 영역을 가리지 않는 단위/E2E를 실행한다.**

```powershell
npm test -- --run tests/unit/composables/useInfoHomeFeed.test.ts tests/unit/pages/infoHomeFeed.test.ts
npm run test:e2e -- tests/e2e/info-home.spec.ts
npm run check
```

Expected: 공지 없음, 게시물 없음, 일정 없음, 한쪽 실패, 재시도 성공 모두 PASS.

- [ ] **Step 7: 커밋한다.**

```powershell
git add app/composables/useInfoHomeFeed.ts app/pages/info/index.vue tests/unit/composables/useInfoHomeFeed.test.ts tests/unit/pages/infoHomeFeed.test.ts tests/e2e/info-home.spec.ts
git commit -m "feat: 정보 홈 공지와 협의회 일정 운영 데이터 연결 (FE-01)"
```

#### Task 6: FE-04 카드 목록 “더보기” 도입

대상: FE-04

**Files:**

- Modify: `it_frontend/app/components/common/ProjectListContainer.vue`
- Create: `it_frontend/app/composables/useProgressiveList.ts`
- Modify: `it_frontend/app/pages/project/bizplan/index.vue`
- Modify: `it_frontend/app/pages/project/estimate/index.vue`
- Modify: `it_frontend/app/pages/info/council-request/index.vue`
- Modify: `it_frontend/tests/unit/components/common/ProjectListContainer.test.ts`
- Create: `it_frontend/tests/unit/composables/useProgressiveList.test.ts`
- Create: `it_frontend/tests/e2e/project-list-progressive.spec.ts`

**Interfaces:**

- Consumes: 정렬·필터가 끝난 `ComputedRef<readonly T[]>`, 페이지별 필터 reset key
- Produces: `useProgressiveList<T>(items, resetKey, pageSize = 20)`
- Produces: `{ visibleItems; visibleCount; totalCount; hasMore; showMore; reset }`
- Produces: `ProjectListContainer` props `count`, `totalCount`, `hasMore`와 event `load-more`

- [ ] **Step 1: 0/1/20/21/45건, 더보기, reset key 변경의 실패 테스트를 작성한다.**

```ts
expect(list.visibleItems.value).toHaveLength(20);
list.showMore();
expect(list.visibleItems.value).toHaveLength(40);
resetKey.value = '2027|완료';
await nextTick();
expect(list.visibleItems.value).toHaveLength(20);
```

- [ ] **Step 2: composable 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useProgressiveList.test.ts
```

- [ ] **Step 3: 전체 필터·정렬 결과의 마지막 단계에서만 `slice(0, visibleCount)`하는 composable을 구현한다.**

- [ ] **Step 4: 컨테이너에 `더보기 (20건)` 버튼, `현재 N / 전체 M건` 안내와 `load-more` event를 추가한다.**

- [ ] **Step 5: 세 페이지의 `v-for`를 `visibleItems`로 바꾸고 검색·필터·연도 reset key를 연결한다.**

- [ ] **Step 6: 단위/E2E와 성능 기준선을 재측정한다.**

```powershell
npm test -- --run tests/unit/composables/useProgressiveList.test.ts tests/unit/components/common/ProjectListContainer.test.ts
npm run test:e2e -- tests/e2e/project-list-progressive.spec.ts
npm run check
```

Expected: 최초 카드 DOM 최대 20개, 정렬 유지, 필터 변경 시 20개로 reset, PASS.

- [ ] **Step 7: API 응답 크기가 단계 0 임계값을 넘으면 이 PR을 DOM 개선으로만 기록하고 서버 페이지네이션을 새 TASK로 남긴다.**

- [ ] **Step 8: 커밋한다.**

```powershell
git add app/components/common/ProjectListContainer.vue app/composables/useProgressiveList.ts app/pages/project/bizplan/index.vue app/pages/project/estimate/index.vue app/pages/info/council-request/index.vue tests/unit/components/common/ProjectListContainer.test.ts tests/unit/composables/useProgressiveList.test.ts tests/e2e/project-list-progressive.spec.ts
git commit -m "perf: 사업 카드 목록 점진 노출 도입 (FE-04)"
```

### Task 7: BRD-11 게시판 첨부파일

대상: BRD-11

**Files:**

- Modify: `it_frontend/app/types/board.ts`
- Modify: `it_frontend/app/composables/useBoardPost.ts`
- Create: `it_frontend/app/composables/useBoardAttachments.ts`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/form.vue`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue`
- Modify: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue`
- Modify: `it_frontend/tests/unit/composables/useBoardPost.test.ts`
- Create: `it_frontend/tests/unit/composables/useBoardAttachments.test.ts`
- Modify: `it_frontend/tests/e2e/board.spec.ts`
- Create: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardPostFileCacheService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/board/service/BoardPostFileCacheServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/authz/BoardFileReadAuthorizerTest.java`

**Interfaces:**

- Consumes: 기존 `useFiles()`와 `pkColNm='공통게시판'`, `pkCone=nacMngNo`
- Produces: `useBoardAttachments(nacMngNo): { files; pending; error; uploadPendingFiles; deleteAttachment; retryFailed }`
- Produces: `BoardPostFileCacheService.sync(String nacMngNo, int activeFileCount)`
- Produces: `FileRepository.countByPkColNmAndPkConeAndDelYn(...)`

- [ ] **Step 1: 게시글 캐시 동기화의 백엔드 실패 테스트를 작성한다.**

```java
fileCacheService.sync("NAC-001", 2);
assertThat(post.getFlApgYn()).isEqualTo("Y");
assertThat(post.getFlNbr()).isEqualTo(2);

fileCacheService.sync("NAC-001", 0);
assertThat(post.getFlApgYn()).isEqualTo("N");
assertThat(post.getFlNbr()).isZero();
```

- [ ] **Step 2: 업로드 성공·부분 성공·삭제 뒤 실제 활성 파일 수로 동기화되지 않아 실패하는지 확인한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*BoardPostFileCacheServiceTest" --tests "*FileServiceTest"
```

- [ ] **Step 3: `BoardPostFileCacheService`와 repository count를 구현하고 `FileService`의 단건·bulk 업로드 및 삭제 성공 뒤 `공통게시판` 부모만 동기화한다.**

`FileService`는 클라이언트가 전달한 파일 수를 사용하지 않고 커밋된 `CFILEM DEL_YN='N'` 개수를 다시 센다. `BoardPostFileCacheService`는 이 재집계 값을 신규 캐시 로직으로 중복 작성하지 않고 기존 엔티티 메서드 `Cblbcm.updateFileCache(boolean hasFile, int fileCount)`에 위임해 물리 컬럼 `FL_APG_YN`·`APG_FL_NBR`를 갱신한다.

- [ ] **Step 4: 게시글 작성 전에 선택한 파일을 메모리에 보관하고 `createPost()` 성공 뒤 `uploadFilesBulk(files, '첨부파일', nacMngNo, '공통게시판')`를 호출하는 프론트 실패 테스트를 작성한다.**

```ts
expect(createPost).toHaveBeenCalledBefore(uploadFilesBulk);
expect(result.failedFiles).toEqual(['실패.pdf']);
```

- [ ] **Step 5: `useBoardAttachments`를 구현하고 생성 성공과 파일 부분 실패를 분리한다.**

본문 성공 + 파일 일부 실패 메시지: `게시글은 등록되었지만 1개 파일 업로드에 실패했습니다. 실패.pdf`.

- [ ] **Step 6: 수정 화면에 기존 파일 조회·신규 추가·개별 삭제, 상세 화면에 파일명·크기·인증 다운로드를 연결한다.**

`getDownloadUrl()`을 단순 `<a href>`로 열어 쿠키가 누락되는 환경이면 `$apiFetch<Blob>` 기반 다운로드 버튼을 사용한다.

- [ ] **Step 7: 공개/비공개 읽기와 소유자/관리자/일반 사용자 삭제 권한을 검증한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*BoardPostFileCacheServiceTest" --tests "*FileServiceTest" --tests "*BoardFileReadAuthorizerTest"
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useBoardPost.test.ts tests/unit/composables/useBoardAttachments.test.ts
npm run test:e2e -- tests/e2e/board.spec.ts
npm run check
```

Expected: 부분 실패 후 재시도 가능, `flNbr`와 활성 `CFILEM` 일치, 권한 테스트 PASS.

- [ ] **Step 8: 백엔드 계약을 먼저 커밋한다.**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/board/service/BoardPostFileCacheService.java src/main/java/com/kdb/it/infra/file/repository/FileRepository.java src/main/java/com/kdb/it/infra/file/service/FileService.java src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java src/test/java/com/kdb/it/common/board/service/BoardPostFileCacheServiceTest.java src/test/java/com/kdb/it/infra/file/authz/BoardFileReadAuthorizerTest.java
git commit -m "feat: 게시판 첨부파일 캐시 동기화 연결 (BRD-11)"
```

- [ ] **Step 9: 백엔드 커밋 SHA를 기록하고 프론트를 별도 커밋한다.**

```powershell
cd C:\it\it_frontend
git add app/types/board.ts app/composables/useBoardPost.ts app/composables/useBoardAttachments.ts app/pages/board/[blbMngNo]/form.vue app/pages/board/[blbMngNo]/[nacMngNo]/edit.vue app/pages/board/[blbMngNo]/[nacMngNo]/index.vue tests/unit/composables/useBoardPost.test.ts tests/unit/composables/useBoardAttachments.test.ts tests/e2e/board.spec.ts
git commit -m "feat: 게시판 첨부파일 작성·조회 UI 연결 (BRD-11)"
```

### 단계 6. 검토 워크플로

#### Task 8: REV-02 작성자 팀명 실제 응답

대상: REV-02

**Files:**

- Modify: `it_backend/src/main/java/com/kdb/it/common/iam/repository/UserRepository.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/dto/ReviewCommentDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java`
- Modify: `it_frontend/app/types/review.ts`
- Modify: `it_frontend/app/composables/useReviewCommentApi.ts`
- Modify: `it_frontend/tests/unit/composables/useReviewCommentApi.test.ts`

**Interfaces:**

- Produces: `UserRepository.ReviewCommentAuthorView { getEno(); getUsrNm(); getTemNm(); }`
- Produces: `ReviewCommentDto.Response.authorTeam: String`
- Produces: 프론트 `ReviewComment.authorTeam: string`

- [ ] **Step 1: 목록 조회가 작성자 사번 집합을 한 번만 배치 조회하고 팀명을 반환하는 실패 테스트를 작성한다.**

```java
assertThat(result.getFirst().getAuthorTeam()).isEqualTo("디지털기획팀");
verify(userRepository).findReviewCommentAuthorViewsByEnoIn(Set.of("K000001", "K000002"));
```

- [ ] **Step 2: 현재 DTO에 `authorTeam`이 없어 실패하는지 확인한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ReviewCommentServiceTest"
```

- [ ] **Step 3: `CuserI.eno/usrNm/temNm` 배치 projection과 DTO 필드를 추가한다.**

팀명 미조회는 빈 문자열, 사용자 미조회는 `authorName=사번`, `authorTeam=""`으로 고정한다.

- [ ] **Step 4: 단건 생성 응답도 같은 projection 변환 helper를 사용해 목록과 계약을 맞춘다.**

- [ ] **Step 5: 프론트 고정 열거형 `ReviewerTeam`(`app/types/review.ts`의 `'개발/운영팀' | '계약팀' | '기획팀' | 'PMO팀'` 유니온)을 일반 `string`으로 넓히고 임시 고정값 `'개발/운영팀'`을 제거한 뒤 API 필드를 그대로 매핑한다.**

- [ ] **Step 6: 서버·프론트 테스트를 실행한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*ReviewCommentServiceTest"
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useReviewCommentApi.test.ts
npm run check
```

Expected: 같은 이름·다른 팀, 팀명 없음, 사용자 없음, 목록/생성 응답 모두 PASS.

- [ ] **Step 7: 백엔드 응답 계약을 커밋한다.**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/iam/repository/UserRepository.java src/main/java/com/kdb/it/domain/budget/document/dto/ReviewCommentDto.java src/main/java/com/kdb/it/domain/budget/document/service/ReviewCommentService.java src/test/java/com/kdb/it/domain/budget/document/service/ReviewCommentServiceTest.java
git commit -m "feat: 검토의견 작성자 팀명 응답 추가 (REV-02)"
```

- [ ] **Step 8: 백엔드 커밋 SHA를 기록하고 프론트 매핑을 별도 커밋한다.**

```powershell
cd C:\it\it_frontend
git add app/types/review.ts app/composables/useReviewCommentApi.ts tests/unit/composables/useReviewCommentApi.test.ts
git commit -m "feat: 검토의견 작성자 팀명 표시 (REV-02)"
```

#### Task 9: REV-01 검토 세션 서버 영속화

대상: REV-01

이 작업은 단계 0의 승인 산출물이 없으면 구현하지 않는다. 현재 메타용어사전에는 `DOC_MNG_NO`, `DOC_VRS_SNO`, `IVG_USID`, `IVG_STS_C`, `REQ_DTM`, `PTP_DTM`은 있으나 “검토완료일시” DATE 용어가 없다. `IVG_FSG_DT`는 VARCHAR2(8) 일자이므로 완료 시각 요구사항을 충족하지 않는다.

- [ ] **Step 1: `docs/superpowers/specs/2026-07-25-review-session-contract.md`의 상태 전이·재요청·검토자 변경·동시 완료·물리 명칭을 승인받는다.**

- [ ] **Step 2: 메타 담당자가 완료 시각 DATE 용어를 추가하거나, 완료 일자만 저장하도록 업무 요구사항을 변경한다.**

- [ ] **Step 3: 승인 문서를 입력으로 `superpowers:writing-plans`를 다시 실행해 REV-01 전용 계획을 만든다.**

전용 계획에는 마이그레이션, 엔티티, 저장소, 서비스, DTO, 컨트롤러, `useReviewSessionApi`, Pinia 교체, 보안 테스트, Playwright 파일 경로와 실제 코드를 포함한다.

- [ ] **Step 4: 전용 계획 완료 전에는 메모리 전용 버튼을 서버 영속화처럼 표시하지 않고 REV-01을 `BLOCKED-BY-CONTRACT`로 유지한다.**

#### Task 10: REV-03 검토의견 첨부 연결

대상: REV-03

**Files:**

- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/controller/FileController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/repository/FileRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/infra/file/authz/ReviewCommentFileReadAuthorizer.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/infra/file/authz/ReviewCommentFileReadAuthorizerTest.java`
- Modify: `it_frontend/app/composables/useFiles.ts`
- Modify: `it_frontend/app/composables/useReviewCommentApi.ts`
- Modify: `it_frontend/app/stores/review.ts`
- Modify: `it_frontend/app/pages/info/documents/[id]/review.vue`
- Modify: `it_frontend/tests/unit/composables/useReviewCommentApi.test.ts`
- Create: `it_frontend/tests/e2e/review-comment-attachments.spec.ts`

**Interfaces:**

- Consumes: `pkColNm='검토의견'`, `pkCone=ipmOpnnSno.toString()`
- Produces: `GET /api/files/batch?pkColNm=검토의견&pkCone=1&pkCone=2`
- Produces: `Record<string, FileRecord[]>` 형태의 부모별 파일 묶음

- [ ] **Step 1: 여러 댓글 부모를 한 쿼리로 조회하고 부모별 읽기 권한을 적용하는 실패 테스트를 작성한다.**

```java
assertThat(result.get("101")).hasSize(2);
assertThat(result.get("102")).isEmpty();
verify(fileRepository).findAllByPkColNmAndPkConeInAndDelYn(
        "검토의견", Set.of("101", "102"), "N");
```

- [ ] **Step 2: batch API 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*FileServiceTest" --tests "*ReviewCommentFileReadAuthorizerTest"
```

- [ ] **Step 3: batch repository/service/controller를 구현하고 기존 `FileOwnershipChecker` 판정을 `(pkColNm, pkCone)`별 한 번만 수행한다.**

- [ ] **Step 4: `ReviewCommentFileReadAuthorizer`가 `Brivgm.ipmOpnnSno`로 댓글을 찾고 댓글의 `docMngNo + docVrsSno`로 정확한 `Brdocm` 버전을 조회해 관리자/작성자/주관부서 규칙을 재사용하게 한다.**

- [ ] **Step 5: 프론트가 댓글 목록 조회 후 부모키 전체를 batch 조회해 `attachments`를 병합하는 실패 테스트를 작성한다.**

```ts
expect(apiFetch).toHaveBeenCalledTimes(2);
expect(result[0]?.attachments[0]?.id).toBe('FL_00000001');
```

- [ ] **Step 6: 댓글 생성 성공 뒤 파일 bulk 업로드를 실행하고 부분 실패 파일명과 재시도를 보존한다.**

- [ ] **Step 7: 댓글 작성자 또는 관리자만 삭제 가능하도록 기존 파일 소유권 검증과 UI 노출을 맞춘다.**

- [ ] **Step 8: 서버·프론트·직접 URL 권한 E2E를 실행한다.**

```powershell
cd C:\it\it_backend
.\gradlew test --tests "*FileServiceTest" --tests "*ReviewCommentFileReadAuthorizerTest"
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useReviewCommentApi.test.ts
npm run test:e2e -- tests/e2e/review-comment-attachments.spec.ts
npm run check
```

Expected: N+1 HTTP 요청 없음, 부분 실패 재시도, 비권한 직접 URL 403, PASS.

- [ ] **Step 9: 백엔드 batch API와 권한 판정기를 커밋한다.**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/infra/file/controller/FileController.java src/main/java/com/kdb/it/infra/file/service/FileService.java src/main/java/com/kdb/it/infra/file/repository/FileRepository.java src/main/java/com/kdb/it/infra/file/authz/ReviewCommentFileReadAuthorizer.java src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java src/test/java/com/kdb/it/infra/file/authz/ReviewCommentFileReadAuthorizerTest.java
git commit -m "feat: 검토의견 첨부파일 배치 조회와 권한 연결 (REV-03)"
```

- [ ] **Step 10: 백엔드 커밋 SHA를 기록하고 프론트 첨부 흐름을 별도 커밋한다.**

```powershell
cd C:\it\it_frontend
git add app/composables/useFiles.ts app/composables/useReviewCommentApi.ts app/stores/review.ts app/pages/info/documents/[id]/review.vue tests/unit/composables/useReviewCommentApi.test.ts tests/e2e/review-comment-attachments.spec.ts
git commit -m "feat: 검토의견 첨부파일 작성·조회 UI 연결 (REV-03)"
```

### Task 11: TIP-03·TIP-02·TIP-05 Tiptap 운영 데이터와 E2E

#### 작업 7-1. 변수 카테고리 운영 데이터 검증

대상: TIP-03

**Files:**

- Create: `it_backend/src/test/resources/sql/verify_tiptap_budget_categories.sql`
- Modify: `TASK_DONE.md`

- [ ] **Step 1: 저장소와 동일한 분류 집계를 SQL로 작성한다.**

```sql
WITH ITEMS AS (
    SELECT P.BSE_YY,
           I.GCL_MNG_NO,
           I.AMT,
           C.CO_C_INTN_NM AS C_TP
      FROM TPRMPP_BPROJM P
      JOIN TPRMPP_BITEMM I
        ON I.ABUS_MNG_NO = P.ABUS_MNG_NO
       AND I.FNT_TB_CRY_SNO = P.SNO
       AND I.DEL_YN = 'N'
       AND I.LST_YN = 'Y'
      LEFT JOIN TPRMPP_CCODEM C
        ON C.CO_C_ID_NM = 'IOE_C'
       AND C.CDVA_ID = I.IOE_C
       AND C.DEL_YN = 'N'
     WHERE P.BSE_YY = '2026'
       AND P.DEL_YN = 'N'
       AND P.LST_YN = 'Y'
)
SELECT 'IT_BUDGET' CATEGORY, COUNT(*) ITEM_COUNT, NVL(SUM(AMT), 0) REQUEST_SUM
  FROM ITEMS
UNION ALL
SELECT 'CAP_BUDGET', COUNT(*), NVL(SUM(AMT), 0)
  FROM ITEMS
 WHERE C_TP IN ('IOE_DVC', 'IOE_HW', 'IOE_SW', 'IOE_CPIT')
UNION ALL
SELECT 'OPEX', COUNT(*), NVL(SUM(AMT), 0)
  FROM ITEMS
 WHERE C_TP IN ('IOE_IDR', 'IOE_SEVS', 'IOE_XPN', 'IOE_LEAFE');

SELECT I.IOE_C, C.CO_C_INTN_NM AS C_TP, COUNT(*) ITEM_COUNT, NVL(SUM(I.AMT), 0) REQUEST_SUM
  FROM TPRMPP_BITEMM I
  LEFT JOIN TPRMPP_CCODEM C ON C.CO_C_ID_NM = 'IOE_C' AND C.CDVA_ID = I.IOE_C AND C.DEL_YN = 'N'
 WHERE I.DEL_YN = 'N'
   AND I.LST_YN = 'Y'
   AND (C.CO_C_INTN_NM IS NULL OR C.CO_C_INTN_NM NOT IN (
       'IOE_DVC', 'IOE_HW', 'IOE_SW', 'IOE_CPIT',
       'IOE_IDR', 'IOE_SEVS', 'IOE_XPN', 'IOE_LEAFE'
   ))
 GROUP BY I.IOE_C, C.CO_C_INTN_NM
 ORDER BY I.IOE_C;
```

> **물리 컬럼 주의:** `TPRMPP_CCODEM`의 코드그룹은 `CO_C_ID_NM`(값 `'IOE_C'`), 코드값은 `CDVA_ID`, 하위분류(구분)명은 `CO_C_INTN_NM`이다. `C_ID`/`CDVA`/`C_TP`는 엔티티·QueryDSL 약어이므로 raw SQL에 그대로 쓰면 `ORA-00904`가 발생하고, `CO_C_ID_NM='IOE'`(정확히는 `'IOE_C'`가 아닌 값)로 필터하면 0건이 반환된다. 자본예산 하위코드는 `IoeCategories.CAPITAL_CTPS`(`IOE_DVC`/`IOE_HW`/`IOE_SW`/`IOE_CPIT`)를 기준으로 한다. OPEX 하위코드(`IOE_IDR`/`IOE_SEVS`/`IOE_XPN`/`IOE_LEAFE`)는 시드 값이므로 실행 전 실제 `CO_C_INTN_NM` 값과 대조하고, 두 번째 쿼리의 미매핑 목록으로 누락 여부를 최종 확인한다.

- [ ] **Step 2: 로컬 Oracle에서 실행하고 결과를 보존한다.**

```powershell
sqlplus "ITPAPP/$env:DB_PASSWORD@127.0.0.1:11521/XEPDB1" @src/test/resources/sql/verify_tiptap_budget_categories.sql
```

- [ ] **Step 3: `IT_BUDGET = CAP_BUDGET + OPEX`와 미매핑 코드 0건 여부를 판정한다.**

불일치가 있으면 코드 변경을 시작하지 않고 IOE 포함 정책을 새 TASK로 등록한다. 일치하면 TIP-03은 코드 변경 없이 검증 완료로 종료한다.

- [ ] **Step 4: 기준연도, 세 합계, 미매핑 목록, 판정을 `TASK_DONE.md`에 기록한다.**

- [ ] **Step 5: 재실행 가능한 SQL을 백엔드 저장소에 커밋한다.**

```powershell
cd C:\it\it_backend
git add src/test/resources/sql/verify_tiptap_budget_categories.sql
git commit -m "test: Tiptap 예산 카테고리 운영 데이터 검증 (TIP-03)"
```

- [ ] **Step 6: 실행 결과를 루트 문서 저장소에 별도 커밋한다.**

```powershell
cd C:\it
git add TASK_DONE.md
git commit -m "docs: Tiptap 예산 카테고리 검증 결과 기록 (TIP-03)"
```

#### 작업 7-2. E2E 시나리오 자동화

대상: TIP-02

**Files:**

- Modify: `it_frontend/tests/e2e/tiptap-variable.spec.ts`
- Create: `it_frontend/tests/e2e/fixtures/tiptap-db.ts`
- Modify: `it_frontend/playwright.config.ts`

- [ ] **Step 1: 사업 선택·변수 삽입 후 `data-token`과 해석 금액을 assertion하는 시나리오 2를 작성한다.**

- [ ] **Step 2: 로컬 API fixture로 원본 금액을 변경하고 `try/finally`에서 원복하는 시나리오 3을 작성한다.**

테스트는 `process.env.E2E_LOCAL_DB === 'true'`가 아니면 skip한다.

- [ ] **Step 3: HWPX 응답을 파일로 저장하고 JSZip으로 `Contents/section0.xml`을 읽어 미해석 `{{...}}` 0건과 기대 금액 포함을 검사한다.**

```ts
expect(sectionXml).not.toMatch(/\{\{[^}]+\}\}/);
expect(sectionXml).toContain(expectedFormattedAmount);
```

- [ ] **Step 4: 기존 시나리오 1/4를 에디터 표시 확인에서 실제 삽입 성공·오류 상태 assertion으로 강화한다.**

- [ ] **Step 5: 로컬 전용과 mock 시나리오를 실행한다.**

```powershell
cd C:\it\it_frontend
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts
$env:E2E_LOCAL_DB='true'
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts --grep "@local-db"
Remove-Item Env:E2E_LOCAL_DB
```

Expected: 원복 후 DB 값이 시작값과 동일, HWPX 미해석 토큰 0건, PASS.

- [ ] **Step 6: 커밋한다.**

```powershell
git add tests/e2e/tiptap-variable.spec.ts tests/e2e/fixtures/tiptap-db.ts playwright.config.ts
git commit -m "test: Tiptap 사업 변수와 HWPX E2E 자동화 (TIP-02)"
```

#### 작업 7-3. 수동 접근성·반응형 검증

대상: TIP-05

**Files:**

- Modify: `TASK_DONE.md`
- Create when defects exist: `docs/03-analysis/tiptap-accessibility-findings.md`

- [ ] **Step 1: 1280×800 밝은/어두운 모드에서 정상·LOADING·STALE·ERROR 변수 칩 대비를 확인한다.**
- [ ] **Step 2: 키보드만으로 검색 열기, 결과 이동, 삽입, Escape 닫기, 재시도 후 원래 편집 위치 복귀를 확인한다.**
- [ ] **Step 3: 버튼과 결과 옵션의 접근 가능한 이름을 브라우저 accessibility tree에서 확인한다.**
- [ ] **Step 4: 390×844에서 팝업이 viewport를 벗어나지 않고 내부 스크롤되며 키보드에 가리지 않는지 확인한다.**
- [ ] **Step 5: 결함이 없으면 시나리오·브라우저·viewport·결과를 `TASK_DONE.md`에 기록한다.**
- [ ] **Step 6: 결함이 있으면 재현 절차와 화면 증거를 별도 findings 문서에 기록하고 새 TASK ID를 만든다.**
- [ ] **Step 7: 증거 문서를 커밋한다.**

```powershell
cd C:\it
git add TASK_DONE.md
if (Test-Path 'docs/03-analysis/tiptap-accessibility-findings.md') { git add docs/03-analysis/tiptap-accessibility-findings.md }
git commit -m "test: Tiptap 접근성·반응형 수동 검증 기록 (TIP-05)"
```

### Task 12: LOG-05 실시간 로그 개인화

대상: LOG-05

**Files:**

- Create: `it_frontend/app/composables/useRealtimeLogPreferences.ts`
- Modify: `it_frontend/app/components/admin/realtime/RealtimeFeedTable.vue`
- Modify: `it_frontend/app/pages/admin/realtime-logs.vue`
- Create: `it_frontend/tests/unit/composables/useRealtimeLogPreferences.test.ts`
- Modify: `it_frontend/tests/e2e/admin/realtime-logs.spec.ts`

**Interfaces:**

- Storage key: `it-portal:realtime-log-preferences:v1`
- Stored shape: `{ version: 1; favoriteLogKeys: string[]; filter: 'all' | 'favorites' }`
- Produces: `toggleFavorite(logKey)`, `setFilter(filter)`, `reconcile(availableLogKeys)`, `filteredRows`

- [ ] **Step 1: 정상 저장, 손상 JSON, 잘못된 version/type, 중복 키, 삭제된 logKey의 실패 테스트를 작성한다.**

```ts
expect(preferences.favoriteLogKeys.value).toEqual(['BPROJ']);
preferences.toggleFavorite('BCOST');
expect(JSON.parse(localStorage.getItem(STORAGE_KEY)!)).toEqual({
    version: 1,
    favoriteLogKeys: ['BPROJ', 'BCOST'],
    filter: 'all',
});
```

- [ ] **Step 2: composable 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/composables/useRealtimeLogPreferences.test.ts
```

- [ ] **Step 3: SSR 안전 가드와 명시적 스키마 검증을 포함한 composable을 구현한다.**

손상·구버전 값은 `{ version: 1, favoriteLogKeys: [], filter: 'all' }`로 복구하고 저장소도 덮어쓴다.

- [ ] **Step 4: `row.logKey`를 즐겨찾기 식별자로 사용하고 테이블 행에 별 토글, 헤더에 전체/즐겨찾기 필터를 연결한다.**

- [ ] **Step 5: 현재 snapshot의 `rows.map(row => row.logKey)`로 `reconcile()`하되, 폴링 한 번에 일시적으로 없는 키를 즉시 삭제하지 않고 서버가 제공하는 전체 `tableCounts` key 집합을 사용한다.**

- [ ] **Step 6: localStorage payload에 사번·이름·권한·`LogFeedRow` 본문이 없는지 assertion한다.**

- [ ] **Step 7: 단위/E2E와 새로고침 유지 테스트를 실행한다.**

```powershell
npm test -- --run tests/unit/composables/useRealtimeLogPreferences.test.ts
npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts
npm run check
```

Expected: 손상 복구, 즐겨찾기 없음, 삭제 키 정리, 새로고침 유지, PASS.

- [ ] **Step 8: 커밋한다.**

```powershell
git add app/composables/useRealtimeLogPreferences.ts app/components/admin/realtime/RealtimeFeedTable.vue app/pages/admin/realtime-logs.vue tests/unit/composables/useRealtimeLogPreferences.test.ts tests/e2e/admin/realtime-logs.spec.ts
git commit -m "feat: 실시간 로그 즐겨찾기 필터 저장 (LOG-05)"
```

### Task 13: FE-02·FE-05·FE-06 공통화와 디자인 정책

#### 작업 9-1. 의미가 같은 포맷터만 공통화

대상: FE-02, FE-05

**Files:**

- Modify: `it_frontend/app/utils/common.ts`
- Modify: `it_frontend/app/components/review/ReviewCommentPopover.vue`
- Modify: `it_frontend/app/components/review/ReviewMessenger.vue`
- Modify: `it_frontend/app/pages/info/council-request/index.vue`
- Modify: `it_frontend/app/pages/project/estimate/index.vue`
- Modify: `it_frontend/app/pages/info/cost/[id].vue`
- Modify: `it_frontend/app/pages/info/cost/terminal/[id].vue`
- Modify: `it_frontend/app/pages/info/projects/[id].vue`
- Modify: `it_frontend/app/pages/project/estimate/[docNo].vue`
- Modify: `it_frontend/tests/unit/utils/common.test.ts`

**Interfaces:**

- Produces: `formatBudgetCompact(amount: number | null | undefined): string | null`
- Produces: `formatCurrencyAmount(value: number | null | undefined, currency = 'KRW', empty = '-'): string`
- Consumes: 기존 `formatFileSize(bytes)`의 공백 포함 단위 계약

- [ ] **Step 1: 경계값 실패 테스트를 작성한다.**

```ts
expect(formatBudgetCompact(null)).toBeNull();
expect(formatBudgetCompact(9_999)).toBe('9,999');
expect(formatBudgetCompact(10_000)).toBe('1만');
expect(formatBudgetCompact(100_000_000)).toBe('1.0억');
expect(formatBudgetCompact(-10_000)).toBe('-10,000');
expect(formatCurrencyAmount(null)).toBe('-');
expect(formatCurrencyAmount(0, 'KRW')).toContain('0');
```

- [ ] **Step 2: 신규 export 부재로 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/utils/common.test.ts
```

- [ ] **Step 3: 기존 화면 동작과 같은 양수 만/억 축약을 구현하고 음수는 locale 문자열로 유지한다.**

- [ ] **Step 4: 두 review 컴포넌트의 `formatSize`를 삭제하고 `formatFileSize`를 import한다.**

표기는 기존 공용 계약인 `1.5 KB`처럼 공백 포함으로 통일한다.

- [ ] **Step 5: council-request/estimate index의 로컬 `formatBudget`를 `formatBudgetCompact`로 교체해 FE-05 이름 충돌을 없앤다.**

- [ ] **Step 6: null 시 `'-'`, 숫자 0 유지 계약이 같은 네 상세 화면만 `formatCurrencyAmount`로 교체한다.**

- [ ] **Step 7: 공용 유틸과 타입체크를 실행하고 잔여 중복을 확인한다.**

```powershell
npm test -- --run tests/unit/utils/common.test.ts
rg -n "const formatSize|const formatBudget = \\((prjBg|totalBudget)|new Intl.NumberFormat\\('ko-KR', \\{ style: 'currency'" app/components/review app/pages/info/cost app/pages/info/projects app/pages/project/estimate
npm run check
```

Expected: 대상 중복 0건, 표현 계약이 다른 포맷터는 잔존 가능, PASS.

- [ ] **Step 8: 커밋한다.**

```powershell
git add app/utils/common.ts app/components/review/ReviewCommentPopover.vue app/components/review/ReviewMessenger.vue app/pages/info/council-request/index.vue app/pages/project/estimate/index.vue app/pages/info/cost/[id].vue app/pages/info/cost/terminal/[id].vue app/pages/info/projects/[id].vue app/pages/project/estimate/[docNo].vue tests/unit/utils/common.test.ts
git commit -m "refactor: 파일·금액 표시 포맷터 공통화 (FE-02 FE-05)"
```

#### 작업 9-2. ProjectListCard 의미 기반 색상

대상: FE-06

**Files:**

- Modify: `it_frontend/app/assets/css/tags.css`
- Modify: `it_frontend/app/components/common/ProjectListCard.vue`
- Modify: `it_frontend/tests/unit/components/common/ProjectListCard.test.ts`

**Interfaces:**

- Produces: `.project-card-status--{amber|indigo|blue|emerald|slate}`
- Produces: `.project-card-chip--{ghost|emerald|violet|amber}`
- Keeps: `.v3-cta--*`와 CTA Tailwind 색상 계약

- [ ] **Step 1: tone별 의미 클래스가 렌더링되는 실패 테스트를 작성한다.**

```ts
expect(wrapper.get('[data-testid="project-status"]').classes()).toContain(
    'project-card-status--amber',
);
```

- [ ] **Step 2: 현재 raw class map 때문에 실패하는지 확인한다.**

```powershell
cd C:\it\it_frontend
npm test -- --run tests/unit/components/common/ProjectListCard.test.ts
```

- [ ] **Step 3: `tags.css`에 일반 span 전용 modifier를 `@apply`로 추가한다.**

PrimeVue `.kdb-tag-*`의 `!important` 규칙은 재사용하지 않는다.

- [ ] **Step 4: 컴포넌트 map을 의미 클래스명으로 바꾸고 상태·칩에 test id를 유지한다.**

- [ ] **Step 5: 단위·CSS lint·밝은/어두운 시각 회귀를 실행한다.**

```powershell
npm test -- --run tests/unit/components/common/ProjectListCard.test.ts
npm run lint:css
npm run check
```

Expected: tone 매핑 PASS, CSS lint PASS, CTA 색상 변화 없음.

- [ ] **Step 6: 커밋한다.**

```powershell
git add app/assets/css/tags.css app/components/common/ProjectListCard.vue tests/unit/components/common/ProjectListCard.test.ts
git commit -m "style: 사업 카드 상태 색상 정책 통합 (FE-06)"
```

### Task 14: FE-03 Prettier 일괄 정리

대상: FE-03

**Files:** `npm run format:check`가 열거하는 운영·테스트 파일만 수정한다.

- [ ] **Step 1: 모든 기능 PR 병합 후 최신 위반 목록을 보존한다.**

```powershell
cd C:\it\it_frontend
npx prettier --list-different . | Tee-Object -FilePath .prettier-drift.txt
```

- [ ] **Step 2: 포맷터를 한 번 실행한다.**

```powershell
npm run format
```

- [ ] **Step 3: `.prettier-drift.txt`에 없던 파일, 생성물, 외부 파일, 사용자 작업 파일이 diff에 들어오지 않았는지 검토한다.**

```powershell
git status --short
git diff --stat
git diff --check
```

- [ ] **Step 4: 기준선에 기록된 파일만 stage하고 임시 파일을 삭제한 뒤 전체 정적 검증을 실행한다.**

```powershell
git add --pathspec-from-file=.prettier-drift.txt
Remove-Item -LiteralPath .prettier-drift.txt
npm run format:check
npm run check
npm test
```

Expected: 모두 PASS.

- [ ] **Step 5: 포맷 변경만 커밋한다.**

```powershell
git commit -m "style: 프론트엔드 포맷 드리프트 정리 (FE-03)"
```

## 6. 권장 작업 패키지와 PR 분할

| 패키지 | 과제 | 저장소/PR |
| --- | --- | --- |
| FE-WP-01 | ERR-10 | 기존 상세 계획의 frontend/backend lane별 PR |
| FE-WP-02 | FE-10, FE-08, FE-09 | `it_frontend` |
| FE-WP-03 | TIP-06, FE-07 | `it_frontend` |
| FE-WP-04 | FE-11 | `it_frontend` |
| FE-WP-05 | FE-01 | `it_frontend` |
| FE-WP-06 | FE-04 | `it_frontend` + 루트 성능 증거 |
| FE-WP-07 | BRD-11 | `it_backend` 계약 PR → `it_frontend` 소비 PR |
| FE-WP-08 | REV-02 | `it_backend` 응답 PR → `it_frontend` 매핑 PR |
| FE-WP-09 | REV-01 | 루트 계약 승인 후 별도 frontend/backend/DB 계획 |
| FE-WP-10 | REV-03 | `it_backend` batch/인가 PR → `it_frontend` 첨부 PR |
| FE-WP-11 | TIP-03, TIP-02, TIP-05 | backend SQL, frontend E2E, 루트 증거를 저장소별 분리 |
| FE-WP-12 | LOG-05 | `it_frontend` |
| FE-WP-13 | FE-02, FE-05, FE-06 | `it_frontend` |
| FE-WP-14 | FE-03 | `it_frontend` 포맷 전용 |

ERR-10 기존 계획 내부의 변경량이 크면 해당 계획의 lane 단위로 다시 나눈다. 교차 기능은 백엔드 PR이 먼저 CI를 통과한 뒤 프론트 PR에서 계약 SHA를 기록하고, 배포는 양쪽이 모두 준비된 시점에 묶는다.

## 7. 검증 명령과 완료 증거

### 7.1 PR별 기본 검증

```powershell
cd C:\it\it_frontend
npm run check
npm test
```

스타일 변경이 있으면:

```powershell
npm run lint:css
```

관련 화면 E2E:

```powershell
npm run test:e2e -- tests/e2e/cost.spec.ts
npm run test:e2e -- tests/e2e/board.spec.ts
npm run test:e2e -- tests/e2e/tiptap-variable.spec.ts
npm run test:e2e -- tests/e2e/admin/realtime-logs.spec.ts
```

백엔드 변경이 있으면:

```powershell
cd C:\it\it_backend
.\gradlew test
```

### 7.2 최종 통합 검증

1. `npm run format:check`
2. `npm run check`
3. `npm test`
4. 관련 Playwright 전체 시나리오
5. 백엔드 전체 테스트
6. 로컬 Oracle 마이그레이션 재실행 안전성 및 데이터 확인
7. 프론트·백엔드 동시 기동 후 로그인, 사업 목록, 비용 Excel 업로드, 게시판 첨부, 검토 요청/완료, Tiptap 내보내기 수동 스모크

### 7.3 TASK 종료 규칙

각 항목은 다음 증거를 `TASK_DONE.md`에 남긴 뒤 `TASK.md`에서 제거한다.

- 변경 PR 또는 커밋
- 주요 변경 파일
- 자동화 테스트 명령과 결과
- 운영 데이터 검증이 필요한 경우 실행 SQL과 판정
- 수동 검증이 필요한 경우 시나리오와 결과
- 후속 제한사항이 있으면 새 TASK ID로 분리

## 8. 리스크와 중단 조건

| 리스크 | 대응 |
| --- | --- |
| 검토 세션 테이블을 성급히 만들어 문서 버전 정책과 충돌 | REV-01 구현 전에 단계 0 계약과 메타용어 확인을 완료한다. |
| 클라이언트 더보기로 API 과다 전송 문제가 가려짐 | DOM과 네트워크 기준선을 별도 기록하고 필요 시 서버 페이지네이션 과제를 유지한다. |
| 첨부 업로드 부분 실패로 본문과 파일 상태가 어긋남 | 부모 생성 성공과 파일 실패를 분리 표시하고 재시도 가능한 상태를 제공한다. |
| 작성자 팀을 고정 열거형으로 캐스팅해 실제 조직명이 손실됨 | 응답과 프론트 타입을 일반 문자열로 바꾼다. |
| localStorage에 사용자 정보가 저장됨 | UI 식별자만 저장하고 계정 동기화 요구 시 서버 설정으로 전환한다. |
| 포맷 일괄 변경이 기능 diff를 가림 | FE-03을 마지막 독립 PR로 제한한다. |
| 실DB E2E가 공유 데이터를 오염 | 로컬 전용 fixture, 고유 키, `finally` 원복, 운영 실행 차단을 적용한다. |

## 9. 최종 완료 정의

프론트엔드 전체 조치는 다음 조건을 모두 만족할 때 완료다.

- 범위 21건이 `TASK_DONE.md`의 증거와 함께 종료되거나, 외부 의사결정이 필요한 별도 과제로 명확히 재분류되어 있다.
- 핵심 실패가 정상값, 빈값, 오래된 미리보기로 보이지 않는다.
- 검토 요청·완료와 첨부 접근 권한이 서버에서 강제된다.
- 비용 Excel 업로드와 신규 행이 동일한 해당없음 코드 계약을 사용한다.
- 정보 홈에 정적 공지·일정 샘플이 남아 있지 않다.
- 대량 카드 목록은 전체 DOM을 한 번에 만들지 않는다.
- Tiptap 운영 데이터, HWPX, 접근성·반응형 검증 증거가 있다.
- `format:check`, 타입체크, ESLint, Vitest, 관련 E2E, 백엔드 테스트가 모두 통과한다.

## 10. Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-25-frontend-backlog-remediation.md`. Two execution options:

1. **Subagent-Driven (recommended)** — use `superpowers:subagent-driven-development`, dispatch a fresh worker per task, and review between tasks.
2. **Inline Execution** — use `superpowers:executing-plans` in this session, execute task batches, and stop at review checkpoints.

실행 시작 시 `superpowers:using-git-worktrees`로 `C:\it`, `it_frontend`, `it_backend` 각각의 격리 작업 트리를 만든다. REV-01은 단계 0 계약 승인이 끝나기 전까지 실행 대상에서 제외한다.
