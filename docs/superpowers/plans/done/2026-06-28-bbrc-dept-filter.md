# bbrC 부서 필터 적용 (Contract/Deliberation/Payment) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 사업집행 ②과업심의·③계약·④지급 목록 조회 RepositoryImpl에 부서(bbrC) 필터를 실제 쿼리 조건으로 적용해, 일반 사용자가 타부서 문서를 열람하지 못하게 한다.

**Architecture:** 대상구분(`bgPrnTc`)에 따라 주관부서가 정보화사업(`Bprojm.svnDpmC`, 100) 또는 전산업무비(`Bcostm.costSvnDpmC`, 200)에 있으므로, 두 대상 마스터를 각각 `cncdRfrNo` 키로 LEFT JOIN(최신버전 `lstYn='Y'`·미삭제 `delYn='N'`)한 뒤 `bgPrnTc`로 분기해 부서를 비교한다. `EstimateRepositoryImpl`(사업 단일 대상, 이미 적용됨)의 검증된 패턴을 2대상으로 확장한다.

**Tech Stack:** Spring Boot 4.1 / Java 25 / QueryDSL 5.1 / Oracle. 빌드 `./gradlew`(작업 디렉토리 `it_backend`).

---

## 사전 확정 사실 (조사 완료)

| 항목 | 값 |
| --- | --- |
| 사업 주관부서 | `Bprojm.svnDpmC`(`SVN_DPM_C`), PK `abusMngNo`(`ABUS_MNG_NO`), 최신버전 `lstYn='Y'` |
| 전산업무비 주관부서 | `Bcostm.costSvnDpmC`(`SVN_DPM_C`), 대상키 `costBgNo`(`BG_NO`), 최신버전 `lstYn`='Y'(`Bcostm.java:62`) |
| JOIN 키 | `bgPrnTc='100'` → `cncdRfrNo = Bprojm.abusMngNo` / `bgPrnTc='200'` → `cncdRfrNo = Bcostm.costBgNo` |
| Q타입 | `com.kdb.it.domain.budget.project.entity.QBprojm`, `com.kdb.it.domain.budget.cost.entity.QBcostm` |
| 현재 상태 | 3개 `*RepositoryImpl.search(stsTc, bgPrnTc, cncdRfrNo, bbrC)`가 `bbrC` 인자를 받지만 쿼리 미반영(주석 "MVP 미적용") |
| 서비스 흐름 | Controller → `service.list(...)` → (관리자=bbrC null, 일반=user.bbrC) → `repository.search(...)`. bbrC는 이미 레포까지 전달됨 — **수정은 RepositoryImpl 한정** |
| DTO 컬럼 순서 | 변경 없음(아래 각 Task의 `Projections.constructor` 순서 보존) |

## 테스트 전략 (중요)

이 프로젝트는 QueryDSL 동적 쿼리를 검증할 DB 기반 통합테스트 인프라가 **없다**(`TASK.md` 후속/T18, `application-test.properties`는 DataSource 제외, 기존 `*RepositoryTest`는 Mockito로 인터페이스만 목킹 → impl 미검증). 따라서 본 변경의 자동 단위테스트는 작성하지 않는다(작성해도 필터 로직을 실제로 검증하지 못함). 검증은 다음 3단계로 수행한다:

1. **컴파일** — `./gradlew compileJava` (QueryDSL Q타입 참조·문법 검증).
2. **전체 회귀** — `./gradlew test` (기존 테스트 무파손 확인).
3. **로컬 Oracle 기능 검증** — Task 5에서 2개 부서 시드 후 관리자/일반사용자 목록 응답 차이 확인.

각 RepositoryImpl 수정(Task 1~3)은 컴파일 단계까지 함께 검증하고, 기능 검증은 3건 모두 반영 후 Task 5에서 일괄 수행한다.

---

## File Structure

- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationRepositoryImpl.java` (search에 부서 JOIN/필터 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/repository/ContractRepositoryImpl.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentRepositoryImpl.java`
- Modify (문서): `it_backend/CLAUDE.md` §5.18 보안 규칙 (미해결 표기 갱신)
- Modify (문서): `TASK.md` / `TASK_DONE.md` (완료 이관)

---

### Task 1: DeliberationRepositoryImpl — bbrC 부서 필터

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationRepositoryImpl.java`

- [ ] **Step 1: import 추가**

파일 상단 import 블록에 Q타입 2개를 추가한다(기존 import 유지).

```java
import com.kdb.it.domain.budget.project.entity.QBprojm;
import com.kdb.it.domain.budget.cost.entity.QBcostm;
```

- [ ] **Step 2: search() 본문 교체**

클래스 JavaDoc의 "bbrC 필터: ... MVP에서는 미적용" 문구를 적용 설명으로 바꾸고, `search()` 전체를 아래로 교체한다.

```java
    /**
     * 과업심의 목록 동적 검색.
     *
     * <p>stsTc·bgPrnTc·cncdRfrNo 모두 null/빈값이면 전체 조회(관리자 뷰).
     * bbrC 지정 시 대상구분(bgPrnTc)에 따라 사업(Bprojm.svnDpmC) 또는
     * 전산업무비(Bcostm.costSvnDpmC) 주관부서와 비교한다.</p>
     *
     * @param stsTc     상태구분코드 필터
     * @param bgPrnTc   예산성격구분코드(대상구분) 필터
     * @param cncdRfrNo 관련참조번호(대상관리번호) 필터
     * @param bbrC      주관부서코드 필터 (JWT 클레임 bbrC). null/빈값이면 전체 조회(관리자)
     * @return 조회된 목록 항목 리스트 (최초등록일시 DESC)
     */
    @Override
    public List<DeliberationDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBdelim d = QBdelim.bdelim;
        QBprojm p = QBprojm.bprojm;   // 대상구분 100(정보화사업) 주관부서 소스
        QBcostm c = QBcostm.bcostm;   // 대상구분 200(전산업무비) 주관부서 소스

        BooleanBuilder where = new BooleanBuilder();
        where.and(d.delYn.eq("N"));
        where.and(d.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(d.stsTc.eq(stsTc));
        if (StringUtils.hasText(bgPrnTc))   where.and(d.bgPrnTc.eq(bgPrnTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(d.cncdRfrNo.eq(cncdRfrNo));
        // bbrC 부서 필터: 사업(100)=Bprojm.svnDpmC, 전산업무비(200)=Bcostm.costSvnDpmC와 비교
        if (StringUtils.hasText(bbrC)) {
            where.and(
                    d.bgPrnTc.eq("100").and(p.svnDpmC.eq(bbrC))
                            .or(d.bgPrnTc.eq("200").and(c.costSvnDpmC.eq(bbrC)))
            );
        }

        return queryFactory.select(Projections.constructor(DeliberationDto.ListItem.class,
                        d.docMngNo, d.docVrsSno, d.bgPrnTc, d.cncdRfrNo, d.stsTc, d.taskDbrRltTc, d.fstEnrUsid, d.fstEnrDtm))
                .from(d)
                // 100: 사업 마스터(최신·미삭제), 200: 전산업무비 마스터(최신·미삭제)를 각각 대상키로 조인
                .leftJoin(p).on(p.abusMngNo.eq(d.cncdRfrNo).and(p.lstYn.eq("Y")).and(p.delYn.eq("N")))
                .leftJoin(c).on(c.costBgNo.eq(d.cncdRfrNo).and(c.lstYn.eq("Y")).and(c.delYn.eq("N")))
                .where(where)
                .orderBy(d.fstEnrDtm.desc())
                .fetch();
    }
```

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL (QBprojm/QBcostm 참조 정상 해석).

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/deliberation/repository/DeliberationRepositoryImpl.java
git commit -m "fix: 과업심의 목록 bbrC 부서 필터 적용 (대상 2종 조건부 JOIN)"
```

---

### Task 2: ContractRepositoryImpl — bbrC 부서 필터

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/contract/repository/ContractRepositoryImpl.java`

> 주의: 기존 코드는 QBcontm 별칭으로 `c`를 사용한다. 전산업무비(Bcostm) 별칭과 충돌하므로 계약 마스터 별칭을 `ct`로 바꾸고 모든 참조를 갱신한다.

- [ ] **Step 1: import 추가**

```java
import com.kdb.it.domain.budget.project.entity.QBprojm;
import com.kdb.it.domain.budget.cost.entity.QBcostm;
```

- [ ] **Step 2: search() 본문 교체**

```java
    @Override
    public List<ContractDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBcontm ct = QBcontm.bcontm;  // 계약 마스터
        QBprojm p = QBprojm.bprojm;   // 대상구분 100(정보화사업) 주관부서 소스
        QBcostm c = QBcostm.bcostm;   // 대상구분 200(전산업무비) 주관부서 소스

        BooleanBuilder where = new BooleanBuilder();
        where.and(ct.delYn.eq("N"));
        where.and(ct.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     where.and(ct.stsTc.eq(stsTc));
        if (StringUtils.hasText(bgPrnTc))   where.and(ct.bgPrnTc.eq(bgPrnTc));
        if (StringUtils.hasText(cncdRfrNo)) where.and(ct.cncdRfrNo.eq(cncdRfrNo));
        // bbrC 부서 필터: 사업(100)=Bprojm.svnDpmC, 전산업무비(200)=Bcostm.costSvnDpmC와 비교
        if (StringUtils.hasText(bbrC)) {
            where.and(
                    ct.bgPrnTc.eq("100").and(p.svnDpmC.eq(bbrC))
                            .or(ct.bgPrnTc.eq("200").and(c.costSvnDpmC.eq(bbrC)))
            );
        }

        return queryFactory.select(Projections.constructor(ContractDto.ListItem.class,
                        ct.docMngNo, ct.docVrsSno, ct.bgPrnTc, ct.cncdRfrNo, ct.stsTc, ct.cttNm, ct.cttAmt, ct.fstEnrUsid, ct.fstEnrDtm))
                .from(ct)
                .leftJoin(p).on(p.abusMngNo.eq(ct.cncdRfrNo).and(p.lstYn.eq("Y")).and(p.delYn.eq("N")))
                .leftJoin(c).on(c.costBgNo.eq(ct.cncdRfrNo).and(c.lstYn.eq("Y")).and(c.delYn.eq("N")))
                .where(where)
                .orderBy(ct.fstEnrDtm.desc())
                .fetch();
    }
```

또한 클래스 JavaDoc/주석에 "bbrC ... MVP 미적용" 문구가 있으면 Task 1과 동일 취지로 적용 설명으로 갱신한다.

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/contract/repository/ContractRepositoryImpl.java
git commit -m "fix: 계약 목록 bbrC 부서 필터 적용 (대상 2종 조건부 JOIN)"
```

---

### Task 3: PaymentRepositoryImpl — bbrC 부서 필터

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/payment/repository/PaymentRepositoryImpl.java`

> 주의: 기존 코드는 QBpaymm 별칭으로 `p`를 사용한다. 사업(Bprojm) 별칭과 충돌하므로 지급 마스터 별칭을 `pm`으로 바꾸고 모든 참조를 갱신한다.

- [ ] **Step 1: import 추가**

```java
import com.kdb.it.domain.budget.project.entity.QBprojm;
import com.kdb.it.domain.budget.cost.entity.QBcostm;
```

- [ ] **Step 2: search() 본문 교체**

```java
    @Override
    public List<PaymentDto.ListItem> search(String stsTc, String bgPrnTc, String cncdRfrNo, String bbrC) {
        QBpaymm pm = QBpaymm.bpaymm;  // 지급 마스터
        QBprojm p = QBprojm.bprojm;   // 대상구분 100(정보화사업) 주관부서 소스
        QBcostm c = QBcostm.bcostm;   // 대상구분 200(전산업무비) 주관부서 소스

        BooleanBuilder where = new BooleanBuilder();
        where.and(pm.delYn.eq("N"));
        where.and(pm.lstYn.eq("Y"));
        if (StringUtils.hasText(stsTc))     { where.and(pm.stsTc.eq(stsTc)); }
        if (StringUtils.hasText(bgPrnTc))   { where.and(pm.bgPrnTc.eq(bgPrnTc)); }
        if (StringUtils.hasText(cncdRfrNo)) { where.and(pm.cncdRfrNo.eq(cncdRfrNo)); }
        // bbrC 부서 필터: 사업(100)=Bprojm.svnDpmC, 전산업무비(200)=Bcostm.costSvnDpmC와 비교
        if (StringUtils.hasText(bbrC)) {
            where.and(
                    pm.bgPrnTc.eq("100").and(p.svnDpmC.eq(bbrC))
                            .or(pm.bgPrnTc.eq("200").and(c.costSvnDpmC.eq(bbrC)))
            );
        }

        return queryFactory
                .select(Projections.constructor(PaymentDto.ListItem.class,
                        pm.docMngNo, pm.docVrsSno, pm.bgPrnTc, pm.cncdRfrNo, pm.stsTc, pm.cttNm, pm.cttAmt, pm.fstEnrUsid, pm.fstEnrDtm))
                .from(pm)
                .leftJoin(p).on(p.abusMngNo.eq(pm.cncdRfrNo).and(p.lstYn.eq("Y")).and(p.delYn.eq("N")))
                .leftJoin(c).on(c.costBgNo.eq(pm.cncdRfrNo).and(c.lstYn.eq("Y")).and(c.delYn.eq("N")))
                .where(where)
                .orderBy(pm.fstEnrDtm.desc())
                .fetch();
    }
```

- [ ] **Step 3: 컴파일 검증**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: 커밋**

```bash
cd it_backend
git add src/main/java/com/kdb/it/domain/payment/repository/PaymentRepositoryImpl.java
git commit -m "fix: 지급 목록 bbrC 부서 필터 적용 (대상 2종 조건부 JOIN)"
```

---

### Task 4: 전체 회귀 테스트

**Files:** (없음 — 검증만)

- [ ] **Step 1: 전체 테스트 실행**

Run: `cd it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL. 기존 `DeliberationServiceTest`/`ContractServiceTest`/`PaymentServiceTest`(Mockito, 레포 목킹)는 시그니처 무변경이므로 영향 없음. 실패 시 베이스 커밋에서도 동일 재현되는 기존 실패인지 워크트리 대조로 구분한다.

---

### Task 5: 로컬 Oracle 기능 검증

**Files:** (없음 — 수동 검증)

접속: `sqlplus ITPAPP/<pw>@127.0.0.1:11521/XEPDB1` (CLAUDE.md §3.1.1).

- [ ] **Step 1: 2개 부서 시드 데이터 확인/구성**

목표: 서로 다른 주관부서(`SVN_DPM_C`)를 가진 ① 사업(100) 대상과 ② 전산업무비(200) 대상, 그리고 각 대상에 연결된 과업심의 1건씩을 준비한다. 운영 시드가 이미 두 부서 데이터를 포함하면 아래 조회로 확인만 한다.

```sql
-- 사업 주관부서 분포 확인 (대상구분 100 매칭 대상)
SELECT SVN_DPM_C, COUNT(*) FROM TPRMPP_BPROJM WHERE LST_YN='Y' AND DEL_YN='N' GROUP BY SVN_DPM_C;
-- 전산업무비 주관부서 분포 확인 (대상구분 200 매칭 대상)
SELECT SVN_DPM_C, COUNT(*) FROM TPRMPP_BCOSTM WHERE LST_YN='Y' AND DEL_YN='N' GROUP BY SVN_DPM_C;
-- 과업심의가 어떤 대상구분/대상에 연결됐는지
SELECT BG_PRN_TC, CNCD_RFR_NO, STS_TC FROM TPRMPP_BDELIM WHERE LST_YN='Y' AND DEL_YN='N';
```

두 부서 데이터가 없으면, 기존 작성중 과업심의 1건의 `CNCD_RFR_NO`가 가리키는 대상의 `SVN_DPM_C`를 확인해 둔다(검증 기준 부서 A).

- [ ] **Step 2: 관리자 조회 — 전체 반환 확인**

백엔드 기동(`./gradlew bootRun`) 후, 관리자 계정으로 로그인해 과업심의 목록 호출.

Run(예): `curl -s -b cookies.txt "http://localhost:28080/api/project/deliberations" | jq 'length'`
Expected: 전체 건수(부서 무관). 관리자는 `service.list`에서 bbrC=null로 전달되어 필터 미적용.

- [ ] **Step 3: 일반 사용자(부서 A) 조회 — 자기 부서만 반환 확인**

부서 A 소속 일반 사용자로 로그인(개발환경 `DevAuthController` 사용자 전환 또는 SSO) 후 동일 호출.

Run(예): `curl -s -b cookies_userA.txt "http://localhost:28080/api/project/deliberations" | jq '[.[] | .cncdRfrNo]'`
Expected: 부서 A 주관 대상에 연결된 과업심의만 반환. 부서 B 대상 문서는 미포함.

- [ ] **Step 4: 계약·지급도 동일 확인**

`/api/project/contracts`, `/api/project/payments`에 대해 Step 2~3을 반복.
Expected: 일반 사용자는 자기 부서 주관 대상 문서만, 관리자는 전체.

- [ ] **Step 5: 검증 결과 기록**

검증 일자·부서·건수 차이를 `TASK_DONE.md` 이관 근거에 남길 수 있도록 메모.

---

### Task 6: 문서 갱신 및 백로그 이관

**Files:**
- Modify: `it_backend/CLAUDE.md` (§5.18 보안 규칙 — bbrC 미해결 표기 갱신)
- Modify: `TASK.md`, `TASK_DONE.md`

- [ ] **Step 1: CLAUDE.md §5.18 갱신**

§5.18 "보안 규칙(집행 4단계)"의 다음 문장을 적용 완료로 바꾼다.

기존:
```
- **(미해결, TASK.md 보안 HIGH)** 부서(bbrC) 필터는 **목록 RepositoryImpl에서 실제 쿼리 조건으로 포함**해야 효력이 있습니다. `EstimateRepositoryImpl`은 적용되어 있으나 `Contract`/`Deliberation`/`PaymentRepositoryImpl`은 MVP 미적용 → 일반 사용자가 타부서 목록 열람 가능. `changeStatus`의 역할 분기(상태 전이 주체별 권한 차등)도 미적용 상태로 추적 중입니다.
```

변경:
```
- 부서(bbrC) 필터는 4개 도메인(`Estimate`/`Deliberation`/`Contract`/`Payment`) `RepositoryImpl` 목록 쿼리에 모두 적용됩니다. 사업(100)은 `Bprojm.svnDpmC`, 전산업무비(200)는 `Bcostm.costSvnDpmC`를 `cncdRfrNo` 조인 후 `bgPrnTc`로 분기 비교합니다(2026-06-28). `changeStatus`의 역할 분기(상태 전이 주체별 권한 차등)는 여전히 미적용 상태로 추적 중입니다(TASK.md).
```

- [ ] **Step 2: TASK.md에서 항목 제거 + 과업심의 체크리스트 정리**

`TASK.md` 🔒 보안 섹션의 `ContractRepositoryImpl·DeliberationRepositoryImpl·PaymentRepositoryImpl ... bbrC 부서 필터 MVP 미적용` High 행을 제거하고, "🏛️ 과업심의위원회" 섹션의 `과업심의 목록 부서(bbrC) 필터 미적용` 체크리스트 항목도 제거한다(동일 뿌리 해소). 상단 로드맵 W1에서 ①항목 완료 표기.

- [ ] **Step 3: TASK_DONE.md 이관**

`TASK_DONE.md`에 dated 항목 추가:
```
| ✅ Done | 🟠 High | 사업집행 ②③④ 목록 bbrC 부서 필터 적용 — 대상구분(bgPrnTc) 100=Bprojm.svnDpmC / 200=Bcostm.costSvnDpmC 조건부 LEFT JOIN. EstimateRepositoryImpl 패턴을 2대상으로 확장. 일반 사용자 타부서 열람 차단 | `DeliberationRepositoryImpl`/`ContractRepositoryImpl`/`PaymentRepositoryImpl`, 검증일: 2026-06-28(로컬 Oracle 기능검증) |
```

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add CLAUDE.md && git commit -m "docs: bbrC 부서필터 4도메인 적용 완료 반영 (§5.18)"
cd .. && git add TASK.md TASK_DONE.md && git commit -m "docs: bbrC 부서필터 High 완료 이관"
```

---

## Self-Review

- **Spec 커버리지**: §6.1 옵션 A(조건부 LEFT JOIN) 채택, `Bcostm.lstYn` 확인으로 fan-out 위험 제거(단일 현재행 조인). 3개 RepositoryImpl + 과업심의 체크리스트 모두 커버.
- **Placeholder 스캔**: 시드 데이터는 운영 데이터 상황에 따라 "확인 또는 구성"으로 명시(부서 A는 실제 데이터에서 도출). curl 예시는 `(예)`로 표기 — 인증 쿠키 획득 방식은 환경별 상이하나 검증 의도/Expected는 명확.
- **타입 일관성**: 별칭 충돌 회피(Contract `ct`, Payment `pm`), DTO `Projections.constructor` 컬럼 순서 기존과 동일 유지. JOIN 키/최신버전 조건 3파일 동일.
- **알려진 제약**: QueryDSL 자동 단위테스트는 인프라 부재(T18)로 작성 불가 — 컴파일+회귀+로컬 Oracle 기능검증으로 대체(테스트 전략 절 명시).
