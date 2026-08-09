# No-DDL Quick Closures Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** DDL 변경 없이 현재 근거만으로 종결 가능한 FE-25·BE-21·BE-28을 활성 과제에서 제거하고, 재검토 조건은 상시 규칙과 운영 문서에 보존한다.

**Architecture:** 애플리케이션 동작은 바꾸지 않는다. FE-25는 현 설계의 두 독립 실패 표면을 Accepted로 보존하고, BE-21은 미래 소비처 추가 시 의미 확정을 요구하는 백엔드 규칙으로 전환한다. BE-28은 확정된 CYCLE/NOCYCLE 운영 설계와 감시 쿼리를 DBA 인계 문서에 반영한다.

**Tech Stack:** Markdown, Git, PowerShell, Spring Boot/Oracle 운영 규약

## Global Constraints

- DDL·Flyway migration·엔티티 스키마는 수정하지 않는다.
- `TASK.md`에 이미 존재하는 공통게시판·EAI 행 삭제 변경은 사용자 소유이므로 커밋에 포함하지 않는다.
- FE-25·BE-21·BE-28의 기존 조사 근거를 잃지 않고 `TASK_DONE.md`로 옮긴다.
- `versions.lock`은 실제 서브레포 HEAD로 갱신한다.
- 백엔드의 기존 미추적 `graphify-out/`은 건드리지 않는다.

---

### Task 1: FE-25 두 실패 표면의 Accepted 종결

**Files:**
- Read: `it_frontend/app/components/council/result/ResultForm.vue`
- Read: `it_frontend/app/pages/info/council-request/result/[id].vue`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: 자식 `resultFetch`와 부모 `councilFetch`의 독립 `useRefreshGuard` 계약
- Produces: FE-25 Accepted 완료 기록과 활성 목록 제거

- [ ] **Step 1: 두 조회와 실패 문구가 독립적인지 재확인**

Run:

```powershell
rg -n "resultRefreshFailed|detailRefreshFailed|attemptResultRefresh|attemptDetailRefresh" `
  it_frontend/app/components/council/result/ResultForm.vue `
  "it_frontend/app/pages/info/council-request/result/[id].vue"
```

Expected: 자식은 결과서 내용, 부모는 협의회 상세를 재조회하며 각자 별도 배너와 재시도 핸들러를 가진다.

- [ ] **Step 2: FE-25를 Accepted로 이관**

`TASK_DONE.md`에 다음 판정을 기록한다.

```markdown
| ☑️ Accepted | FE-25 | 두 배너는 같은 문장의 중복이 아니라 결과서 내용과 협의회 상세의 독립 실패를 각각 복구한다. 둘 중 하나를 숨기면 해당 데이터의 재시도 경로가 사라지므로 현 동작을 유지한다. |
```

`TASK.md`에서는 FE-25 행만 제거한다.

- [ ] **Step 3: 문서 정합성 확인**

Run:

```powershell
rg -n "FE-25" TASK.md TASK_DONE.md
```

Expected: 활성 행 0건, 새 Accepted 기록 1건이며 과거 언급은 보존된다.

---

### Task 2: BE-21 미소비 결재유형 정책을 상시 규칙으로 전환

**Files:**
- Modify: `it_backend/CLAUDE.md`
- Read: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java`
- Read: `it_backend/src/main/java/com/kdb/it/common/approval/entity/Cdecim.java`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: `Cdecim.DECISION_TYPE_REQUEST = "10"`, `ApplicationService.submit`의 결재선 생성
- Produces: `DCD_TP_C` 읽기 기능 추가 전 의미 확정을 요구하는 백엔드 상시 규칙

- [ ] **Step 1: 읽기 소비처가 없는지 전수 확인**

Run:

```powershell
rg -n -i "dcdTpC|DCD_TP_C|DECISION_TYPE" it_backend/src it_frontend/app
```

Expected: 운영 코드는 엔티티 선언과 `ApplicationService` 쓰기 1곳뿐이며 프론트 소비처는 0건이다. 테스트 픽스처·쓰기 계약 테스트는 허용한다.

- [ ] **Step 2: 백엔드 상시 규칙 추가**

`it_backend/CLAUDE.md`의 도메인 공통 규칙에 다음 의미를 추가한다.

```markdown
- 결재선의 `DCD_TP_C`는 현재 모든 행에 요청(`10`)을 기록하고 읽기 기능은 없다. 이 값을 조회·응답·분기에서 처음 소비할 때는 최종결재자 포함 행별 의미와 코드셋을 먼저 확정하고 계약 테스트를 추가한다.
```

- [ ] **Step 3: 문서 검사 후 백엔드 커밋**

Run:

```powershell
git -C it_backend diff --check
rg -n "DCD_TP_C" it_backend/CLAUDE.md
```

Expected: 공백 오류 0건, 상시 규칙 1건.

Commit:

```powershell
git -C it_backend add -- CLAUDE.md
git -C it_backend commit -m "docs: 결재유형 소비 전 의미 확정 규칙 추가"
```

- [ ] **Step 4: BE-21을 Accepted로 이관**

`TASK_DONE.md`에 읽기 소비처 0건과 상시 규칙 위치를 기록하고 `TASK.md`의 BE-21 행을 제거한다.

---

### Task 3: BE-28 시퀀스 감시 문서 현행화

**Files:**
- Modify: `it_database/docs/operations/2026-07-24-migration-handover.md`
- Read: `it_backend/CLAUDE.md`
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`

**Interfaces:**
- Consumes: 연도 결합 `%04d` 시퀀스의 CYCLE 허용 조건, 비연도 식별번호의 NOCYCLE 규칙
- Produces: 현재 운영 설계와 일치하는 감시 쿼리·재검토 임계치

- [ ] **Step 1: stale 서술을 현재 설계로 교체**

부록 B를 다음 기준으로 수정한다. 2026-08-08 운영 확인은 연도 결합 13건을 CYCLE로
기록하지만, 2026-08-07까지 현행화된 `ITPOWN_DDL_live.sql` 스냅샷은 15건 모두
NOCYCLE이다. 환경·시점 차이를 단정으로 덮지 않고 런타임 카탈로그를 기준으로 판정한다.

```text
CYCLE로 관측된 연도 결합 시퀀스: 누적 9,999에서 실패하지 않고 순환한다. 안전 조건은 연간 발급량 < 9,999이다.
NOCYCLE로 관측된 시퀀스: last_number가 9,999에 도달하면 ORA-08004가 발생한다. BBUGTM과 CBLBMM은 운영 설계상 NOCYCLE이며 실질 도달 위험이 낮다.
재검토 트리거: 어느 한 해 발급량이 5,000건을 넘을 때.
LPAD 채번: 2026-08-08 제거 완료. Java String.format은 초과 자릿수를 자르지 않는다.
```

감시 쿼리는 `cycle_flag`, `last_number`, `max_value`를 함께 보여주고 연도별 발급량은 해당 업무 테이블의 연도 접두어 집계로 별도 확인한다고 명시한다.

- [ ] **Step 2: 완료된 부록 A도 현재 상태로 정정**

BE-20이 이미 `V20260808_001__AlignCinfmmDispatchStatusDefault.sql`로 DEFAULT를 `01`에 맞췄음을 기록하고 “별도 추적” 문구를 제거한다.

- [ ] **Step 3: stale 문구가 사라졌는지 검증**

Run:

```powershell
rg -n "영구 누적|LPAD\(SQ_TPRMPP_BBUGTM|별도 항목\(BE-20\)" `
  it_database/docs/operations/2026-07-24-migration-handover.md
rg -n "cycle_flag|5,000|V20260808_001" `
  it_database/docs/operations/2026-07-24-migration-handover.md
git -C it_database diff --check
```

Expected: stale 문구 0건, 새 근거 3종 존재, 공백 오류 0건.

- [ ] **Step 4: 데이터베이스 문서 커밋**

```powershell
git -C it_database add -- docs/operations/2026-07-24-migration-handover.md
git -C it_database commit -m "docs: 채번 시퀀스 감시 조건 현행화"
```

- [ ] **Step 5: BE-28을 Accepted로 이관**

`TASK_DONE.md`에 DDL 무변경 결정, 감시 트리거, 운영 문서 위치를 기록하고 `TASK.md`의 BE-28 행을 제거한다.

---

### Task 4: 루트 완료 이력·버전 잠금 정합화

**Files:**
- Modify: `TASK.md`
- Modify: `TASK_DONE.md`
- Modify: `versions.lock`
- Create: `docs/superpowers/plans/2026-08-09-no-ddl-quick-closures.md`

**Interfaces:**
- Consumes: Task 1~3의 판정과 서브레포 커밋
- Produces: 활성 과제 3건 감소, 재현 가능한 서브레포 SHA

- [ ] **Step 1: versions.lock 갱신**

Run:

```powershell
.\scripts\update-versions-lock.ps1
```

- [ ] **Step 2: 사용자 TASK.md 변경을 제외하고 우리 행 삭제만 stage**

HEAD의 `TASK.md`에서 FE-25·BE-21·BE-28만 제거한 blob을 index에 올리고, working tree의 BRD-03·BRD-05·BRD-06 및 EAI-01·EAI-02·EAI-05·EAI-06·EAI-07 삭제는 stage하지 않는다.

- [ ] **Step 3: 최종 문서 검증**

Run:

```powershell
git diff --check
git diff --cached --check
rg -n "^\| (FE-25|BE-21|BE-28)\s*\|" TASK.md
rg -n "\| (FE-25|BE-21|BE-28) \|" TASK_DONE.md
```

Expected: 활성 행 0건, 새 완료 기록 각 1건, staged/working diff에 공백 오류 0건.

- [ ] **Step 4: 루트 커밋**

```powershell
git commit -m "docs: DDL 없는 조건부 과제 3건 종결"
```

- [ ] **Step 5: 저장소 상태 확인**

Run:

```powershell
git status --short
git -C it_frontend status --short
git -C it_backend status --short
git -C it_database status --short
```

Expected: 루트에는 사용자 소유 `TASK.md` BRD·EAI 행 삭제만 남고, 프론트·DB는 clean, 백엔드는 기존 `graphify-out/`만 남는다.
