# BPROJA 단계 상태 적재 통합 (2차-A, 6단계) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 6개 단계 서비스(소요예산/과업심의/입찰계약/대금지급/예산편성/계획)가 문서 생성·상태변경·삭제 시 공통 `BprojaSyncService`를 통해 `TPRMPP_BPROJA`에 `(프로젝트 ABUS_MNG_NO, 단계 자기 key, 통합 IT_PTL_STS_TC)`를 upsert/softDelete 하도록 통합한다.

**Architecture:** 신규 `BprojaSyncService`(upsert/softDelete 단일 진입점, 멱등·방어적, 호출자 트랜잭션 참여)를 만들고, 각 단계 서비스에 의존성 주입 후 create/changeStatus/delete 끝에 호출 1–2줄을 추가한다. 실행 4단계는 native 상태(41–79)가 이미 통합코드라 항등 주입하되 `bgPrnTc='100'`일 때만 기록한다. 예산편성·계획은 상태 컬럼이 없어 생성 시 진행중(21/11)만 기록한다. 읽기 경로(대표상태 MAX)는 1차 구현이 그대로 동작하므로 변경 없음.

**Tech Stack:** Spring Boot 4 / Java 25 / JPA / QueryDSL, Oracle. 대상 repo: 중첩 git repo `C:\it\it_backend`(branch `main`).

---

## 선행 사실 / 제약

- **검증 방법**: 프로젝트 메모리상 `./gradlew test`는 test worker JVM 기동 단계에서 크래시하므로, 본 계획의 검증은 `cd C:/it/it_backend && ./gradlew compileJava -q`(BUILD SUCCESSFUL)로 한다. JUnit 테스트는 작성하되 실행 불가할 수 있어 **컴파일 통과를 1차 게이트**로 삼는다(1차 계획과 동일 기준).
- 1차에서 `Bproja` 엔티티에 `changeStatus(String)`가, `BaseEntity`에 `delete()`/`restore()`가 이미 있다. `BprojaRepository`(`JpaRepository<Bproja, BprojaId>`)와 `BprojaId(abusMngNo, cncdRfrNo)`(`@AllArgsConstructor`)도 존재한다.
- `Bproja`는 `@SuperBuilder`라 `Bproja.builder().abusMngNo(..).cncdRfrNo(..).stsTc(..).build()`로 생성하며, `@PrePersist`가 `delYn/guid/guidPrgSno` 기본값을 채운다.
- 실행 4단계 서비스(`EstimateService`/`DeliberationService`/`ContractService`/`PaymentService`)는 동일 패턴: 상수 `STS_DRAFT`(41/51/61/71)·`TGT_PROJECT="100"`, `create(req,user)`가 save 후 `docNo` 반환, `changeStatus`가 `e.changeStatus(to)`, `delete`가 `e.delete()`. 프로젝트키는 `cncdRfrNo`(생성 시 `req.cncdRfrNo()`, 이후 `e.getCncdRfrNo()`), 대상구분은 `bgPrnTc`(생성 시 `req.bgPrnTc()`, 이후 `e.getBgPrnTc()`).
- **라인 번호는 작성 시점 근사값**이다. 구현 시 반드시 내용(메서드명·인접 코드)으로 위치를 특정한다.

## File Structure

- **신규**: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/BprojaSyncService.java` — BPROJA upsert/softDelete 단일 진입점.
- **변경(의존성 주입 + 호출)**:
  - `domain/estimate/service/EstimateService.java`
  - `domain/deliberation/service/DeliberationService.java`
  - `domain/contract/service/ContractService.java`
  - `domain/payment/service/PaymentService.java`
  - `domain/budget/work/service/BudgetWorkService.java`
  - `domain/budget/plan/service/PlanService.java`
- **무변경**: 엔티티/리포지토리/DB(모두 기보유), 협의회(2차-B).

---

### Task 1: `BprojaSyncService` 신설

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/BprojaSyncService.java`

- [ ] **Step 1: 서비스 작성**

```java
package com.kdb.it.domain.budget.project.service;

import com.kdb.it.domain.budget.project.entity.Bproja;
import com.kdb.it.domain.budget.project.entity.BprojaId;
import com.kdb.it.domain.budget.project.repository.BprojaRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * 정보화사업관계(BPROJA) 동기화 서비스.
 *
 * <p>각 업무 단계 서비스가 문서 생성/상태변경/삭제 시 호출하는 단일 진입점이다.
 * {@code (프로젝트 ABUS_MNG_NO, 단계 자기 key, 통합 IT_PTL_STS_TC)}를 upsert 하거나
 * 단계 문서 삭제 시 대응 BPROJA 행을 Soft Delete 한다. 멱등·방어적이며, 호출자 트랜잭션에
 * 참여하므로 단계 작업이 롤백되면 BPROJA 변경도 함께 롤백된다.</p>
 */
@Service
@RequiredArgsConstructor
public class BprojaSyncService {

    private final BprojaRepository bprojaRepository;

    /**
     * BPROJA upsert: 존재하면 상태 갱신 + DEL_YN='N' 복원, 없으면 INSERT.
     *
     * @param abusMngNo  프로젝트관리번호(실제 BPROJM 사업). null/blank면 no-op.
     * @param cncdRfrNo  단계 원본문서 key. null/blank면 no-op.
     * @param itPtlStsTc 통합 IT포탈상태구분코드. null이면 no-op.
     */
    @Transactional
    public void upsert(String abusMngNo, String cncdRfrNo, String itPtlStsTc) {
        if (!StringUtils.hasText(abusMngNo) || !StringUtils.hasText(cncdRfrNo) || itPtlStsTc == null) {
            return;
        }
        bprojaRepository.findById(new BprojaId(abusMngNo, cncdRfrNo))
                .ifPresentOrElse(
                        existing -> {
                            existing.changeStatus(itPtlStsTc); // 상태 최신화
                            existing.restore();                 // DEL_YN='N' 복원(재활성)
                        },
                        () -> bprojaRepository.save(Bproja.builder()
                                .abusMngNo(abusMngNo)
                                .cncdRfrNo(cncdRfrNo)
                                .stsTc(itPtlStsTc)
                                .build()));
    }

    /**
     * 단계 문서 Soft Delete 시 대응 BPROJA 행을 DEL_YN='Y' 처리. 없으면 no-op.
     *
     * @param abusMngNo 프로젝트관리번호. null/blank면 no-op.
     * @param cncdRfrNo 단계 원본문서 key. null/blank면 no-op.
     */
    @Transactional
    public void softDelete(String abusMngNo, String cncdRfrNo) {
        if (!StringUtils.hasText(abusMngNo) || !StringUtils.hasText(cncdRfrNo)) {
            return;
        }
        bprojaRepository.findById(new BprojaId(abusMngNo, cncdRfrNo))
                .ifPresent(Bproja::delete);
    }
}
```

- [ ] **Step 2: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 3: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/project/service/BprojaSyncService.java && git commit -m "feat(backend): BPROJA 동기화 서비스(BprojaSyncService) 신설"
```

---

### Task 2: 소요예산(EstimateService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java`

- [ ] **Step 1: 의존성 주입**

기존 `private final ProjectRepository projectRepository;` 등 주입 필드 그룹에 한 줄 추가:

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: create — save 직후 진행 코드 upsert**

`create(...)`에서 `estimateRepository.save(entity);` 바로 다음, `return docNo;` 앞에 추가:

```java
        if (TGT_PROJECT.equals(req.bgPrnTc())) {
            bprojaSyncService.upsert(req.cncdRfrNo(), docNo, STS_DRAFT); // 41
        }
```

> 확인됨: `EstimateDto.CreateRequest`에 `bgPrnTc` 컴포넌트가 존재하므로 `req.bgPrnTc()` 가드를 그대로 사용한다(다른 3개 실행 단계와 동일 패턴).

- [ ] **Step 3: changeStatus — 전이 직후 upsert**

`changeStatus(...)`에서 `e.changeStatus(to);` 바로 다음에 추가:

```java
        if (TGT_PROJECT.equals(e.getBgPrnTc())) {
            bprojaSyncService.upsert(e.getCncdRfrNo(), docNo, to);
        }
```

- [ ] **Step 4: delete — 삭제 직후 softDelete**

`delete(...)`에서 `e.delete();` 바로 다음에 추가:

```java
        if (TGT_PROJECT.equals(e.getBgPrnTc())) {
            bprojaSyncService.softDelete(e.getCncdRfrNo(), docNo);
        }
```

- [ ] **Step 5: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java && git commit -m "feat(backend): 소요예산 단계 BPROJA 상태 적재 통합"
```

---

### Task 3: 과업심의(DeliberationService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java`

- [ ] **Step 1: 의존성 주입**

주입 필드 그룹에 추가:

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: create — save 직후 upsert**

`create(...)`의 저장 직후(`deliberationRepository.save(...)` 다음), `return docNo;` 앞에 추가. (이 서비스의 초기 상태 상수는 `STS_DRAFT="51"`, 대상구분 상수는 `TGT_PROJECT="100"` — 실제 상수명은 파일에서 확인.)

```java
        if ("100".equals(req.bgPrnTc())) {
            bprojaSyncService.upsert(req.cncdRfrNo(), docNo, "51");
        }
```

- [ ] **Step 3: changeStatus — 전이 직후 upsert**

`changeStatus(...)`의 `e.changeStatus(to);` 다음에 추가:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.upsert(e.getCncdRfrNo(), docNo, to);
        }
```

- [ ] **Step 4: delete — 삭제 직후 softDelete**

`delete(...)`의 `e.delete();` 다음에 추가:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.softDelete(e.getCncdRfrNo(), docNo);
        }
```

- [ ] **Step 5: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/deliberation/service/DeliberationService.java && git commit -m "feat(backend): 과업심의 단계 BPROJA 상태 적재 통합"
```

---

### Task 4: 입찰계약(ContractService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/service/ContractService.java`

- [ ] **Step 1: 의존성 주입**

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: create — save 직후 upsert** (초기 상태 `"61"`)

`create(...)`의 저장 직후, `return docNo;` 앞:

```java
        if ("100".equals(req.bgPrnTc())) {
            bprojaSyncService.upsert(req.cncdRfrNo(), docNo, "61");
        }
```

- [ ] **Step 3: changeStatus — 전이 직후 upsert**

`e.changeStatus(to);` 다음:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.upsert(e.getCncdRfrNo(), docNo, to);
        }
```

- [ ] **Step 4: delete — softDelete**

`e.delete();` 다음:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.softDelete(e.getCncdRfrNo(), docNo);
        }
```

- [ ] **Step 5: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/contract/service/ContractService.java && git commit -m "feat(backend): 입찰계약 단계 BPROJA 상태 적재 통합"
```

---

### Task 5: 대금지급(PaymentService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/service/PaymentService.java`

- [ ] **Step 1: 의존성 주입**

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: create — save 직후 upsert** (초기 상태 `"71"`)

`create(...)`의 저장 직후, `return docNo;` 앞:

```java
        if ("100".equals(req.bgPrnTc())) {
            bprojaSyncService.upsert(req.cncdRfrNo(), docNo, "71");
        }
```

- [ ] **Step 3: changeStatus — 전이 직후 upsert**

`e.changeStatus(to);` 다음:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.upsert(e.getCncdRfrNo(), docNo, to);
        }
```

- [ ] **Step 4: delete — softDelete**

`e.delete();` 다음:

```java
        if ("100".equals(e.getBgPrnTc())) {
            bprojaSyncService.softDelete(e.getCncdRfrNo(), docNo);
        }
```

- [ ] **Step 5: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 6: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/payment/service/PaymentService.java && git commit -m "feat(backend): 대금지급 단계 BPROJA 상태 적재 통합"
```

---

### Task 6: 예산편성(BudgetWorkService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java`

상태 컬럼이 없는 단계. 프로젝트 = `item.orcPkVl()` (단, `"BPROJM".equals(item.orcTb())`), 단계 key = `bbugtm.getBgNo()`, 상태 = 고정 진행중 `"21"`. 완료(22)는 본 계획 제외(스펙 §4.3, §8).

- [ ] **Step 1: 의존성 주입**

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: applyItemRates의 BPROJM 분기에서 save 직후 upsert**

`applyItemRates(...)`의 `if ("BPROJM".equals(item.orcTb())) { ... }` 블록에서, 해당 `Bbugtm` 저장(`bbugtmRepository.save(bbugtm);`) 바로 다음에 추가:

```java
            bprojaSyncService.upsert(item.orcPkVl(), bbugtm.getBgNo(), "21"); // 예산편성 진행중
```

> 위치 특정: BPROJM 분기 내부의 `bbugtmRepository.save(bbugtm)` 호출 직후. `item.orcPkVl()`은 그 분기에서 프로젝트 ABUS_MNG_NO이며, `bbugtm`은 방금 저장한 엔티티. 변수명이 다르면(예: 저장 대상이 `bbugtm`이 아닌 다른 지역변수) 실제 변수명으로 맞춘다.

- [ ] **Step 3: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 4: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java && git commit -m "feat(backend): 예산편성 단계 BPROJA 진행중 적재 통합"
```

---

### Task 7: 정보기술부문계획(PlanService) 통합

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java`

상태 컬럼 없음. 프로젝트 = `Bplana` fan-out의 `prjMngNo`(프로젝트 목록 루프만, 전산업무비 `itMngcNos` 루프 제외), 단계 key = `reqDocNo`, 상태 = 고정 진행중 `"11"`. 삭제 시 softDelete. 완료(19)는 본 계획 제외.

- [ ] **Step 1: 의존성 주입**

`PlanService`의 주입 필드 그룹에 추가:

```java
    private final com.kdb.it.domain.budget.project.service.BprojaSyncService bprojaSyncService;
```

- [ ] **Step 2: createPlan — 프로젝트 Bplana 루프에서 upsert**

`createPlan(...)`의 `for (String prjMngNo : prjMngNos) { ... bplanaRepository.save(relation); }` 루프 내부, `bplanaRepository.save(relation);` 다음에 추가:

```java
                bprojaSyncService.upsert(prjMngNo, reqDocNo, "11"); // 계획 진행중
```

> 주의: 바로 아래의 `for (String itMngcNo : itMngcNos) { ... }`(전산업무비) 루프에는 **추가하지 않는다** — 전산업무비는 프로젝트가 아니다.

- [ ] **Step 3: deletePlan — Bplana 소프트삭제 루프에서 softDelete**

`deletePlan(...)`의 `for (Bplana relation : relations) { relation.delete(); bplanaRepository.save(relation); }` 루프 내부, `bplanaRepository.save(relation);` 다음에 추가:

```java
                bprojaSyncService.softDelete(relation.getPrjMngNo(), reqDocNo);
```

> `relations`에는 전산업무비 관계도 섞여 있으나, 그 `prjMngNo`로는 BPROJA 행이 없어 `softDelete`가 no-op이므로 안전하다.

- [ ] **Step 4: 컴파일 검증**

Run: `cd C:/it/it_backend && ./gradlew compileJava -q`
Expected: BUILD SUCCESSFUL

- [ ] **Step 5: 커밋**

```bash
cd C:/it/it_backend && git add src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java && git commit -m "feat(backend): 정보기술부문계획 단계 BPROJA 진행중 적재/삭제 통합"
```

---

### Task 8: 최종 검증

- [ ] **Step 1: 백엔드 컴파일** — `cd C:/it/it_backend && ./gradlew compileJava -q` → BUILD SUCCESSFUL
- [ ] **Step 2: 잔여 참조 점검** — 6개 서비스에 `bprojaSyncService` 주입·호출이 모두 들어갔는지, 실행 4단계는 `'100'` 가드가 있는지, 계획은 프로젝트 루프에만 들어갔는지 grep/리뷰로 확인.
- [ ] **Step 3: (선택) 로컬 구동 스모크** — `local-ext`/`local-int` `gradlew bootRun` 기동 후, 소요예산/계획 등에서 문서 생성 시 `TPRMPP_BPROJA`에 행이 적재되고 프로젝트 목록 대표상태(MAX)가 반영되는지 확인. (협의회 화면은 2차-B 전까지 깨진 상태이므로 검증 대상 제외.)

---

## Self-Review

- **Spec 커버리지(2차-A)**: BprojaSyncService(§3)=Task 1 ✓; 실행4 upsert/softDelete + '100' 가드(§4.1)=Task 2–5 ✓; 예산편성 진행중 21 + BPROJM 분기(§4.3)=Task 6 ✓; 계획 진행중 11 + fan-out + 삭제 softDelete(§4.4)=Task 7 ✓; 읽기 경로 무변경(§5)=변경 없음 ✓; 타당성/협의회(§4.2)·완료 트리거(§8)는 의도적 제외(2차-B) ✓.
- **Placeholder 스캔**: 모든 코드 스텝에 실제 코드 포함. 라인 번호는 "내용으로 특정" 명시. EstimateService create의 `bgPrnTc()` 유무 분기는 구현 시 확인하도록 구체 지시(placeholder 아님).
- **타입 일관성**: `BprojaSyncService.upsert(String,String,String)`/`softDelete(String,String)` 시그니처는 Task 1 정의 → Task 2–7에서 동일 사용 ✓. `BprojaId(abusMngNo, cncdRfrNo)`·`Bproja.builder()`·`changeStatus`/`restore`/`delete`는 1차 산출물과 일치 ✓.
- **위험**: (1) 실행 4단계 `CreateRequest.bgPrnTc()` 존재 여부 — Estimate는 100 전용일 수 있어 Task 2에 분기 지시. (2) 트랜잭션 참여로 BPROJA 실패 시 단계 작업 롤백(의도). (3) test worker 이슈로 compileJava 검증.
