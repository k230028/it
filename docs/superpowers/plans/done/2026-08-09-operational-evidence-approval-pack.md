# Operational Evidence Approval Pack Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DDL 없이 남아 있는 모든 활성 과제를 재분류하고, 운영 증거나 담당자 결정이 필요한 항목을 한 번의 승인으로 수집·판정할 수 있는 요청서로 만든다.

**Architecture:** 코드 변경을 시작하기 전에 운영 게이트별 원본 증거, 관측 기간, 판정식, 승인 후 조치를 고정한다. 실행 가능한 코드 과제가 없으면 임의 구현하지 않고 활성 상태를 유지하며, DDL 대상은 별도 제외표에 둔다.

**Tech Stack:** Markdown / Git synthetic staging / Oracle AWR·운영 로그·배포 이력 증거

## Global Constraints

- `it_database`, Flyway migration, 테이블·인덱스·시퀀스는 수정하지 않는다.
- 사용자의 `TASK.md` BRD/EAI 정리는 보존하고 이번 변경만 synthetic staging한다.
- `it_backend/graphify-out/`은 읽거나 스테이징하지 않는다.
- 운영 자료가 없으면 임계치 충족을 추정하지 않고 해당 항목을 활성 상태로 유지한다.
- 개인정보·토큰·DB 비밀번호·SSO 벤더 바이너리는 승인 문서에 첨부하지 않는다.

---

### Task 1: 활성 과제 전수 분류

**Files:**
- Read: `TASK.md`
- Read: `docs/superpowers/reports/2026-08-09-non-ddl-wave1-evidence.md`
- Read: `docs/superpowers/specs/2026-08-09-all-non-ddl-tasks-design.md`

**Interfaces:**
- Consumes: 현재 작업 트리의 활성 행
- Produces: 즉시 실행·운영 증거·업무 결정·DDL 제외의 상호 배타적 분류

- [x] **Step 1: 활성 ID를 행 단위로 추출한다.** `BE-03`, `BE-18`, `BE-23`, `BE-24`, `LOG-03`, `LOG-04`, `BRD-02`만 남아 있음을 확인한다.
- [x] **Step 2: DDL 항목을 제외한다.** `BE-24`는 함수 기반 UNIQUE 인덱스, `BRD-02`는 Oracle Text 인덱스가 필요하므로 구현 범위에서 제외한다.
- [x] **Step 3: 남은 다섯 항목의 차단 종류를 확인한다.** `BE-03`·`BE-18`·`LOG-03`은 운영 관측, `BE-23`·`LOG-04`는 담당자 정책 결정이 필요하며 즉시 실행 가능한 코드 항목은 0건이다.

### Task 2: 운영 증거 승인 요청서 작성

**Files:**
- Create: `docs/superpowers/reports/2026-08-09-operational-evidence-approval-request.md`
- Read: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/ReviewerController.java`
- Read: `it_backend/sso/README.md`
- Read: `it_backend/docs/guides/operations/logging.md`
- Read: `it_frontend/app/composables/useRealtimeLogs.ts`

**Interfaces:**
- Consumes: Task 1의 다섯 외부 게이트
- Produces: 증거 묶음 `EV-BE03`, `EV-BE18`, `DEC-BE23`, `EV-LOG03`, `DEC-LOG04`

- [x] **Step 1: `BE-03`의 14일 관측 요구를 고정한다.** 릴리스 ID·관측 구간·Project/Cost endpoint별 호출량·p50/p95/p99·오류율·AWR SQL ID/실행횟수/elapsed/CPU/buffer gets를 요구하고, 병목이 확인된 API만 추가 projection 후보로 승인한다.
- [x] **Step 2: `BE-18`의 제거 증거를 고정한다.** 전역 경로 포함 릴리스의 배포 ID·배포 시각과 이후 연속 14일 운영 로그에서 `폐기 예정 검토자 경로가 호출되었습니다`가 0건임을 요구한다.
- [x] **Step 3: `BE-23`의 저장소 결정을 고정한다.** 저장소 URL, group/artifact/version 좌표, 소유팀, 읽기·쓰기 주체, 계약상 보존기간, 체크섬·서명 검증, 장애 시 원본 회수 절차를 승인 입력으로 요구한다.
- [x] **Step 4: `LOG-03`의 같은 구간 관측을 고정한다.** 관리자 동시 세션, `/api/admin/realtime-logs` 호출량·p95·오류율, 관련 AWR 부하를 같은 시계열로 제출하고 기존 세 임계치 중 충족 항목이 있을 때만 push 설계를 시작한다.
- [x] **Step 5: `LOG-04`의 정책 결정을 고정한다.** DB 감사로그 온라인 보존기간, 암호화 백업 위치·보존기간, 삭제 승인 주체, 실행 주체, 복구 표본·주기, 법무/준법 근거를 필수 승인값으로 요구한다.
- [x] **Step 6: 민감정보 제거 기준과 승인 응답 양식을 추가한다.** AWR SQL text·로그 사용자 식별자는 마스킹하고, 승인자는 항목별 `승인/보류`와 증거 위치만 답하도록 한다.

### Task 3: TASK 추적성 보강

**Files:**
- Modify synthetic index only: `TASK.md`

**Interfaces:**
- Consumes: Task 2 승인 요청서
- Produces: 다섯 활성 행에서 동일 승인 요청서로 연결되는 추적성

- [x] **Step 1: 다섯 행에 승인 요청서 링크와 증거 ID를 추가한다.** 기존 재개 조건과 임계치는 변경하지 않는다.
- [x] **Step 2: `BE-24`·`BRD-02`는 수정하지 않는다.** 이번 범위가 DDL 제외임을 승인 요청서의 제외표로만 명시한다.

### Task 4: 검증·커밋·승인 요청

**Files:**
- Modify: `docs/superpowers/plans/2026-08-09-operational-evidence-approval-pack.md`

**Interfaces:**
- Consumes: Tasks 1~3 문서
- Produces: 재현 가능한 승인 패킷과 사용자 승인 질문

- [x] **Step 1: 문서의 활성 ID가 `TASK.md`와 정확히 일치하는지 `rg`로 확인한다.** 다섯 외부 항목, 두 DDL 제외 항목, 즉시 코드 항목 0건이어야 한다.
- [x] **Step 2: `git diff --check`와 네 저장소 상태를 확인한다.** `it_database`·프론트·백엔드는 깨끗하고 backend에는 기존 `graphify-out/`만 남아야 한다.
- [x] **Step 3: 사용자 `TASK.md` 변경을 제외해 synthetic staging하고 루트 문서를 커밋한다.**
- [x] **Step 4: 사용자에게 다섯 항목의 운영 자료 수집·정책 결정 승인을 한 번에 요청한다.** 승인 전에는 코드 변경이나 운영 조회를 수행하지 않는다.
