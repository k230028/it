# Document Information Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 네 저장소의 CLAUDE, README, 가이드와 운영 기록을 독자와 수명에 맞게 재분류하고 중복 단일 출처를 확립한다.

**Architecture:** 필수 작업 계약은 CLAUDE, 온보딩은 README, 반복 구현법은 guides, 날짜가 있는 배포 기록은 operations가 소유한다. 각 상위 문서는 상세 본문을 복제하지 않고 정식 문서로 연결한다.

**Tech Stack:** Markdown, PowerShell, ripgrep, Git

**Spec:** `docs/superpowers/specs/2026-08-18-document-information-architecture-design.md`

## Global Constraints

- 기존 미커밋 README 변경을 보존한다.
- 문서의 명령·경로·설정은 실제 코드베이스와 대조한다.
- 비밀값을 명령행 예시에 추가하지 않는다.
- 적용된 Flyway 마이그레이션은 수정하지 않는다.
- 모든 가이드는 인덱스에서 도달 가능해야 한다.

---

### Task 1: 루트 문서 책임 정리

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`

- [x] 루트 CLAUDE에서 설치·운영 상세를 제거하고 SoT, 공유 작업 안전, 공통 규칙과 검증 진입점만 유지한다.
- [x] 사람이 수행하는 설치·실행·IDE·운영 절차가 README에서 완결되는지 확인한다.
- [x] 루트 문서 간 중복 정책은 한쪽을 링크로 바꾼다.

### Task 2: 백엔드 문서 책임과 인덱스 정리

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Modify: `it_backend/README.md`
- Modify: `it_backend/docs/guides/README.md`
- Move: `it_backend/docs/guides/security/file-read-migration.md` → `it_backend/docs/operations/file-read-migration.md`
- Delete: 백엔드 가이드 루트의 이동 안내 파일

- [x] CLAUDE에는 강제 규칙과 검증 명령, README에는 온보딩과 운영 진입점만 남긴다.
- [x] 모든 활성 가이드를 주제별 인덱스에 등록한다.
- [x] 날짜·배포 현황을 가진 파일 정규화 기록을 operations로 옮기고 참조를 갱신한다.

### Task 3: 프론트엔드 문서 책임과 인덱스 정리

**Files:**
- Modify: `it_frontend/CLAUDE.md`
- Modify: `it_frontend/README.md`
- Modify: `it_frontend/docs/guides/README.md`
- Delete: 프론트엔드 가이드 루트의 이동 안내 파일

- [x] CLAUDE의 상세 설명을 정식 가이드 링크로 축약한다.
- [x] 신청서 확장 가이드를 비롯한 모든 활성 가이드를 인덱스에 등록한다.
- [x] 저장소 내부에 삭제 대상 경로 참조가 없는지 확인한다.

### Task 4: 데이터베이스 문서 체계 신설

**Files:**
- Create: `it_database/CLAUDE.md`
- Modify: `it_database/README.MD`
- Create: `it_database/docs/guides/README.md`
- Create: `it_database/docs/guides/migrations.md`
- Create: `it_database/docs/guides/import-export.md`
- Create: `it_database/docs/operations/dump-history-rewrite.md`

- [x] README를 설치, 빠른 시작, 가져오기·내보내기, 문서 링크 순서로 재구성한다.
- [x] 마이그레이션 작성·검증 규칙을 반복 가이드로 분리한다.
- [x] 위험한 Git 히스토리 재작성 절차를 운영 런북으로 분리한다.

### Task 5: 문서 무결성 검증

**Files:**
- Verify: 네 저장소의 변경 문서 전체

- [x] 상대 Markdown 링크의 대상이 모두 존재하는지 검사한다.
- [x] 가이드 인덱스와 실제 파일 목록이 일치하는지 검사한다.
- [x] 삭제한 이동 안내 경로의 잔여 참조를 검사한다.
- [x] 네 저장소의 diff를 각각 검토하고 기존 미커밋 변경 보존을 확인한다.
