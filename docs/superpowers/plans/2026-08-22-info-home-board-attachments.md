# Info Home Board Attachments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 정보 홈 공지사항과 게시판 기반 주요 일정에 게시판 목록과 동일한 첨부파일 아이콘과 다운로드 흐름을 제공한다.

**Architecture:** `useInfoHomeFeed`가 게시물별 첨부 메타데이터를 공통 batch API로 조회해 피드 모델에 연결한다. `BoardAttachmentActions` 공통 컴포넌트가 1~2개 직접 다운로드와 3개 이상 표준 목록 다이얼로그를 캡슐화하고 공지·일정 화면이 이를 공유한다.

**Tech Stack:** Nuxt 4, Vue 3 Composition API, TypeScript, PrimeVue, Vitest, Vue Test Utils, Playwright

**Spec:** `docs/superpowers/specs/2026-08-22-info-home-board-attachments-design.md`

## Global Constraints

- 백엔드 API 계약은 변경하지 않고 기존 `/api/files/batch`, 단건 다운로드, 게시물 첨부 ZIP API를 재사용한다.
- `FileFormatIcon`, `AppDialogHeader`, `AppDialogFooter`와 기존 board 번역을 재사용한다.
- 첨부 조회 실패는 공지·일정 본문을 숨기지 않는다.
- 공유 dirty `main` 워킹트리의 기존 사용자 변경을 보존하며 이 작업에서는 커밋하지 않는다.
- 신규 코드 주석은 한글로 작성한다.

---

### Task 1: 정보 홈 피드 첨부 메타데이터 연결

**Files:**
- Modify: `it_frontend/tests/unit/composables/useInfoHomeFeed.test.ts`
- Modify: `it_frontend/app/composables/useInfoHomeFeed.ts`

**Interfaces:**
- Consumes: `useFiles().fetchFilesBatch('공통게시판', postIds): Promise<Record<string, FileRecord[]>>`
- Produces: `InfoHomeNotice.attachments: FileRecord[]`, `InfoHomeSchedule.attachments: FileRecord[]`

- [ ] **Step 1: 실패 테스트 작성**

  공지 게시물과 게시판 일정에 서로 다른 파일 fixture를 연결하고 이미지 파일은 제외하며, 협의회 일정은 빈 배열인지 검증한다. 첨부 batch 요청 실패 시 공지·일정 상태는 `READY`이고 `attachments`만 빈 배열인지 별도 테스트한다.

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/composables/useInfoHomeFeed.test.ts`

  Expected: `attachments`가 없고 `/api/files/batch`가 호출되지 않아 FAIL.

- [ ] **Step 3: 최소 구현**

  `flNbr > 0 || flApgYn === 'Y'`인 게시물 번호를 모아 batch 조회하고 `첨부파일` 유형만 각 피드 항목에 연결한다. batch 오류는 빈 파일 맵으로 복구한다.

- [ ] **Step 4: GREEN 확인**

  Run: `npm test -- tests/unit/composables/useInfoHomeFeed.test.ts`

  Expected: PASS.

### Task 2: 공통 게시판 첨부 액션 컴포넌트

**Files:**
- Create: `it_frontend/tests/unit/components/common/BoardAttachmentActions.test.ts`
- Create: `it_frontend/app/components/common/BoardAttachmentActions.vue`
- Modify: `it_frontend/docs/guides/components/common-components.md`

**Interfaces:**
- Consumes: `files: FileRecord[]`
- Produces: 1~2개 파일 형식 아이콘 직접 다운로드, 3개 이상 개수 배지와 표준 목록 다이얼로그

- [ ] **Step 1: 실패 테스트 작성**

  두 파일 fixture에서 PDF·Excel 형식 아이콘과 파일명 라벨을 확인하고, 클릭 시 해당 파일 다운로드 Blob을 요청하는지 검증한다. 세 파일 fixture에서는 개수 배지가 표시되고 클릭 후 목록·체크박스·전체/선택 다운로드 액션이 나타나는지 검증한다.

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/components/common/BoardAttachmentActions.test.ts`

  Expected: 컴포넌트가 존재하지 않아 FAIL.

- [ ] **Step 3: 최소 구현**

  기존 게시판 목록의 아이콘 클래스, 다운로드 처리, 표준 다이얼로그 구조와 선택 상태를 공통 컴포넌트로 구현한다. 루트 클릭 이벤트를 중단하고 실패 Toast는 기존 번역을 사용한다.

- [ ] **Step 4: GREEN 확인 및 리팩터링**

  Run: `npm test -- tests/unit/components/common/BoardAttachmentActions.test.ts`

  Expected: PASS. 중복 다운로드 보조 로직을 컴포넌트 내부 함수로 정리한 뒤 다시 PASS.

### Task 3: 정보 홈 공지·일정 렌더링 연결

**Files:**
- Modify: `it_frontend/tests/unit/pages/infoHomeFeed.test.ts`
- Modify: `it_frontend/app/pages/info/index.vue`
- Modify: `it_frontend/app/components/info/InfoScheduleItem.vue`

**Interfaces:**
- Consumes: `InfoHomeNotice.attachments`, `InfoHomeSchedule.attachments`, `BoardAttachmentActions`
- Produces: 공지·일정 카드의 다운로드 가능한 첨부 UI

- [ ] **Step 1: 실패 테스트 작성**

  공지와 게시판 일정에 공통 첨부 액션이 표시되고, 협의회 일정에는 표시되지 않으며, 일정 카운트다운이 여전히 마지막 액션인지 검증한다.

- [ ] **Step 2: RED 확인**

  Run: `npm test -- tests/unit/pages/infoHomeFeed.test.ts`

  Expected: 공통 첨부 액션이 렌더링되지 않아 FAIL.

- [ ] **Step 3: 최소 구현**

  공지 행을 일반 컨테이너와 제목 `NuxtLink`로 분리하고 첨부 액션을 우측 메타 영역에 배치한다. 일정의 기존 종이클립 카운트 영역을 공통 첨부 액션으로 교체하고 카운트다운 순서를 유지한다.

- [ ] **Step 4: GREEN 확인**

  Run: `npm test -- tests/unit/pages/infoHomeFeed.test.ts`

  Expected: PASS.

### Task 4: 회귀 및 사용자 흐름 검증

**Files:**
- Modify if needed: `it_frontend/tests/e2e/info-home.spec.ts`

**Interfaces:**
- Consumes: 완성된 정보 홈 첨부 조회·렌더링 흐름
- Produces: 브라우저 수준 회귀 증거

- [ ] **Step 1: E2E fixture에 공지·일정 첨부 batch 응답 추가**

  공지에는 2개, 게시판 일정에는 3개 파일을 반환하고 협의회 일정은 파일 응답 대상에서 제외한다.

- [ ] **Step 2: 정보 홈 첨부 흐름 검증**

  Run: `npm run test:e2e -- tests/e2e/info-home.spec.ts`

  Expected: 공지 직접 다운로드 아이콘과 일정 첨부 목록 다이얼로그가 표시되고 다운로드 요청이 발생해 PASS.

- [ ] **Step 3: 정적 검사와 관련 회귀 테스트**

  Run: `npm run format:check`

  Run: `npm run check`

  Run: `npm test -- tests/unit/composables/useInfoHomeFeed.test.ts tests/unit/components/common/BoardAttachmentActions.test.ts tests/unit/pages/infoHomeFeed.test.ts`

  Expected: 모두 PASS.

- [ ] **Step 4: 변경 범위 검토**

  Run: `git diff --check`

  Run: `git status --short`

  Expected: 공백 오류가 없고 기존 사용자 변경이 유지된다.
