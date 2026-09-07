# 전산업무비 저장 충돌 감지와 병합 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산업무비·금융정보단말 저장 요청에 개정본 스탬프를 왕복시켜, 다른 사용자의 변경을 덮어쓰는 저장을 차단하고 사용자가 필드·단말 행 단위로 병합하게 한다.

**Architecture:** 조회 응답이 부모 BCOSTM과 활성 BTERMM 전체를 정규화한 SHA-256 스탬프를 함께 내려주고, 저장 요청이 그 값을 되돌려 보낸다. 서버는 부모 행을 `PESSIMISTIC_WRITE`로 잠근 **뒤** 스탬프를 재계산해 비교하고, 다르면 현재 상태 전체를 담아 409로 롤백한다. 원본 스냅샷은 서버가 보관하지 않고 프론트엔드가 화면 로드 시점 값을 들고 있다가 3-way 차이를 클라이언트에서 계산한다.

**Tech Stack:** Spring Boot (JPA, Jackson, JUnit 5 + Mockito + AssertJ), Nuxt 4 CSR (Vue 3 Composition API, PrimeVue, Vitest), Oracle.

**Spec:** `docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md`

## Global Constraints

- 신규 JavaDoc·TSDoc·주석은 한글로 작성한다. 공개 API와 서비스 메서드에는 입력과 실패 조건을 기록한다.
- 커밋은 경로를 명시해 스테이징한다. `git add -A`·`git add .`·`git commit -a`를 쓰지 않는다.
- `it_backend`, `it_frontend`는 각각 독립 원격 저장소다. 커밋은 각 저장소 디렉터리 안에서 수행한다.
- 백엔드 DTO/OpenAPI 계약을 먼저 확정한 뒤 프론트에서 `npm run codegen`과 `npm run codegen:check`를 실행한다. 생성 타입은 수기로 편집하지 않는다.
- 스탬프 다이제스트는 64자리 소문자 SHA-256 hexadecimal이다. 정규식 `[a-f0-9]{64}`.
- 오류 코드는 `COST_STAMP_REQUIRED`(400), `COST_SOURCE_CHANGED`(409), `COST_CONCURRENT_UPDATE`(409) 세 개만 쓴다.
- 검사 면제 경로는 `preserveSubmittedAmounts=true`인 이관·관리자 경로다. 면제는 스탬프 검사에만 적용하며 부모 행 잠금은 유지한다.
- DB 마이그레이션은 없다. `it_database`는 건드리지 않는다.
- Gradle은 파일 락을 피하려 `--no-daemon`으로 실행하고, `check` 전에 `spotlessApply`를 돌린다.

## 태스크 순서와 배포

스탬프 누락을 400으로 차단하므로 배포 순서가 강제된다. **태스크 순서가 곧 배포 안전 순서다.** Task 1~4가 백엔드 1단계(필드 수용만, 검증 없음), Task 5~9가 프론트, **Task 10이 실제 차단을 켜는 마지막 단계**다. Task 10을 Task 5~9보다 먼저 배포하면 구버전 프론트의 전산업무비 저장이 전부 실패한다.

---

### Task 1: CostConcurrencyStamper

부모 원장과 활성 단말 목록에서 결정적인 스탬프를 만드는 순수 계산 컴포넌트다. 조회와 저장 검증이 **반드시 같은 이 함수**를 호출하게 해서, 사용자가 아무것도 바꾸지 않았는데 충돌이 나는 사고를 막는다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamper.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamperTest.java`

**Interfaces:**
- Consumes: `com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson` (`digest(Object)`, `money(BigDecimal)`, `exchangeRate(BigDecimal)`). `common/` 아래 컴포넌트이므로 `domain/`에서 의존해도 계층 규칙을 위반하지 않는다.
- Produces: `String CostConcurrencyStamper.stamp(Bcostm cost, List<Btermm> terminals)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamperTest.java`:

```java
package com.kdb.it.domain.budget.cost.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson;
import com.kdb.it.domain.budget.cost.entity.Bcostm;
import com.kdb.it.domain.budget.cost.entity.Btermm;
import java.math.BigDecimal;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * CostConcurrencyStamper 단위 테스트
 *
 * <p>스탬프가 단말 입력 순서와 금액 스케일에 흔들리지 않고, 업무 내용 변경에만 반응하는지 검증합니다. DB 없이 실행됩니다.
 */
class CostConcurrencyStamperTest {

    private final CostConcurrencyStamper stamper =
            new CostConcurrencyStamper(new ItBudgetCanonicalJson(new ObjectMapper()));

    private static Bcostm cost() {
        return Bcostm.builder()
                .costBgNo("COST_2026_0001")
                .bgSno(2)
                .ioeC("IOE_SEVS")
                .cttNm("서버 유지보수")
                .costTotXpAmt(new BigDecimal("1000"))
                .curC("KRW")
                .bseYy("2026")
                .build();
    }

    private static Btermm terminal(String mngNo, Integer sno, String name) {
        return Btermm.builder()
                .tmnMngNo(mngNo)
                .sno(sno)
                .spfTmnNm(name)
                .termRqmBgAmt(new BigDecimal("500"))
                .build();
    }

    @Test
    @DisplayName("단말 입력 순서가 달라도 스탬프는 같다")
    void terminalOrderDoesNotChangeStamp() {
        Btermm first = terminal("TMN-1", 1, "단말A");
        Btermm second = terminal("TMN-2", 1, "단말B");
        assertThat(stamper.stamp(cost(), List.of(first, second)))
                .isEqualTo(stamper.stamp(cost(), List.of(second, first)));
    }

    @Test
    @DisplayName("금액 스케일 차이는 충돌이 아니다")
    void moneyScaleDoesNotChangeStamp() {
        String scaled =
                stamper.stamp(
                        Bcostm.builder()
                                .costBgNo("COST_2026_0001")
                                .bgSno(2)
                                .costTotXpAmt(new BigDecimal("1000.000"))
                                .build(),
                        List.of());
        String plain =
                stamper.stamp(
                        Bcostm.builder()
                                .costBgNo("COST_2026_0001")
                                .bgSno(2)
                                .costTotXpAmt(new BigDecimal("1000"))
                                .build(),
                        List.of());
        assertThat(scaled).isEqualTo(plain);
    }

    @Test
    @DisplayName("부모 업무 필드가 바뀌면 스탬프가 달라진다")
    void parentFieldChangeChangesStamp() {
        String before = stamper.stamp(cost(), List.of());
        String after =
                stamper.stamp(
                        Bcostm.builder()
                                .costBgNo("COST_2026_0001")
                                .bgSno(2)
                                .ioeC("IOE_SEVS")
                                .cttNm("서버 유지보수 연장")
                                .costTotXpAmt(new BigDecimal("1000"))
                                .curC("KRW")
                                .bseYy("2026")
                                .build(),
                        List.of());
        assertThat(after).isNotEqualTo(before);
    }

    @Test
    @DisplayName("단말이 추가되면 스탬프가 달라진다")
    void addedTerminalChangesStamp() {
        assertThat(stamper.stamp(cost(), List.of(terminal("TMN-1", 1, "단말A"))))
                .isNotEqualTo(
                        stamper.stamp(
                                cost(),
                                List.of(
                                        terminal("TMN-1", 1, "단말A"),
                                        terminal("TMN-2", 1, "단말B"))));
    }

    @Test
    @DisplayName("단말이 삭제되면 스탬프가 달라진다")
    void removedTerminalChangesStamp() {
        assertThat(
                        stamper.stamp(
                                cost(),
                                List.of(
                                        terminal("TMN-1", 1, "단말A"),
                                        terminal("TMN-2", 1, "단말B"))))
                .isNotEqualTo(stamper.stamp(cost(), List.of(terminal("TMN-1", 1, "단말A"))));
    }

    @Test
    @DisplayName("감사 필드만 다르면 충돌이 아니다")
    void auditOnlyChangeDoesNotChangeStamp() {
        assertThat(
                        stamper.stamp(
                                Bcostm.builder()
                                        .costBgNo("COST_2026_0001")
                                        .bgSno(2)
                                        .cttNm("서버 유지보수")
                                        .lstChgUsid("EMP-999")
                                        .lstChgDtm(LocalDateTime.of(2026, 9, 8, 14, 25))
                                        .build(),
                                List.of()))
                .isEqualTo(
                        stamper.stamp(
                                Bcostm.builder()
                                        .costBgNo("COST_2026_0001")
                                        .bgSno(2)
                                        .cttNm("서버 유지보수")
                                        .lstChgUsid("EMP-001")
                                        .lstChgDtm(LocalDateTime.of(2026, 1, 1, 0, 0))
                                        .build(),
                                List.of()));
    }

    @Test
    @DisplayName("결재 상태(LST_YN)가 달라도 충돌이 아니다")
    void approvalStateDoesNotChangeStamp() {
        assertThat(
                        stamper.stamp(
                                Bcostm.builder()
                                        .costBgNo("COST_2026_0001")
                                        .bgSno(2)
                                        .cttNm("서버 유지보수")
                                        .lstYn("Y")
                                        .build(),
                                List.of()))
                .isEqualTo(
                        stamper.stamp(
                                Bcostm.builder()
                                        .costBgNo("COST_2026_0001")
                                        .bgSno(2)
                                        .cttNm("서버 유지보수")
                                        .lstYn("N")
                                        .build(),
                                List.of()));
    }

    @Test
    @DisplayName("스탬프는 64자리 소문자 16진수다")
    void stampIsLowercaseSha256Hex() {
        assertThat(stamper.stamp(cost(), List.of())).matches("[a-f0-9]{64}");
    }
}
```

`Bcostm`은 `@Getter`와 `@SuperBuilder`만 가지며 setter가 없다. 감사 필드는 `BaseEntity`의 `lstChgUsid`·`lstChgDtm`이고 `@SuperBuilder` 덕분에 빌더로 지정할 수 있다. `java.time.LocalDateTime` import를 추가한다.

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew test --tests '*CostConcurrencyStamperTest' --no-daemon
```

기대: 컴파일 실패 — `CostConcurrencyStamper` 심볼을 찾을 수 없음.

- [ ] **Step 3: 구현한다**

`it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamper.java`:

```java
package com.kdb.it.domain.budget.cost.service;

import com.kdb.it.common.approval.itbudget.service.ItBudgetCanonicalJson;
import com.kdb.it.domain.budget.cost.entity.Bcostm;
import com.kdb.it.domain.budget.cost.entity.Btermm;
import java.math.BigDecimal;
import java.util.Comparator;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 전산업무비 개정본의 업무 내용을 SHA-256 스탬프로 요약한다.
 *
 * <p>조회 응답과 저장 검증이 같은 입력 집합을 쓰도록 이 컴포넌트 하나만 사용한다. 공통 감사 필드(LST_CHG_DTM 등)와 결재 상태 필드(LST_YN)는
 * 입력에서 제외하므로, 결재 진행이나 의미상 동일한 원복은 충돌로 판정되지 않는다.
 */
@Component
@RequiredArgsConstructor
public class CostConcurrencyStamper {

    private final ItBudgetCanonicalJson canonical;

    /**
     * 부모 원장과 활성 단말 목록으로 개정본 스탬프를 계산한다.
     *
     * @param cost 대상 전산업무비 개정본
     * @param terminals 같은 개정본의 {@code DEL_YN='N'} 단말 목록. 입력 순서는 결과에 영향을 주지 않는다. null은 빈 목록으로 취급한다.
     * @return 64자리 소문자 SHA-256 다이제스트
     * @throws IllegalArgumentException 금액·환율 소수 자릿수가 계약을 벗어난 경우
     */
    public String stamp(Bcostm cost, List<Btermm> terminals) {
        return canonical.digest(new StampInput(parent(cost), children(terminals)));
    }

    private ParentView parent(Bcostm cost) {
        return new ParentView(
                cost.getCostBgNo(),
                cost.getBgSno(),
                cost.getIoeC(),
                cost.getCttNm(),
                cost.getCttOppNm(),
                canonical.money(cost.getCostTotXpAmt()),
                canonical.money(cost.getFcAmt()),
                cost.getDfrCleC(),
                cost.getFstDfrDt(),
                cost.getCurC(),
                canonical.exchangeRate(cost.getXcr()),
                cost.getXcrBseDt(),
                cost.getSectSysUtzYn(),
                cost.getIndRsn(),
                cost.getCgprId(),
                cost.getCgprNm(),
                cost.getPrlmHrkOgzCCone(),
                cost.getCostSvnDpmC(),
                cost.getSvnTemC(),
                cost.getSvnDpmNm(),
                cost.getSvnTemNm(),
                cost.getBseYy(),
                cost.getBgUntAbusC(),
                cost.getTmnYn(),
                cost.getAbusTc(),
                cost.getCncdRfrNo());
    }

    private List<TerminalView> children(List<Btermm> terminals) {
        return terminals == null
                ? List.of()
                : terminals.stream()
                        .map(this::child)
                        .sorted(
                                Comparator.comparing(
                                                TerminalView::tmnMngNo,
                                                Comparator.nullsFirst(Comparator.naturalOrder()))
                                        .thenComparing(
                                                TerminalView::sno,
                                                Comparator.nullsFirst(Comparator.naturalOrder())))
                        .toList();
    }

    private TerminalView child(Btermm terminal) {
        return new TerminalView(
                terminal.getTmnMngNo(),
                terminal.getSno(),
                terminal.getSpfTmnNm(),
                terminal.getTmnKdTc(),
                terminal.getNsfUsgCone(),
                terminal.getTmnClsfC(),
                canonical.money(terminal.getTermRqmBgAmt()),
                canonical.money(terminal.getFcAmt()),
                terminal.getCurC(),
                canonical.exchangeRate(terminal.getXcr()),
                terminal.getXcrBseDt(),
                terminal.getDfrCleC(),
                terminal.getIndRsn(),
                terminal.getCgprId(),
                terminal.getCgprNm(),
                terminal.getTermSvnDpmC(),
                terminal.getSvnDpmNm(),
                terminal.getTermSvnTemC(),
                terminal.getSvnTemNm(),
                terminal.getRmk());
    }

    private record StampInput(ParentView parent, List<TerminalView> terminals) {}

    private record ParentView(
            String costBgNo,
            Integer bgSno,
            String ioeC,
            String cttNm,
            String cttOppNm,
            BigDecimal costTotXpAmt,
            BigDecimal fcAmt,
            String dfrCleC,
            String fstDfrDt,
            String curC,
            BigDecimal xcr,
            String xcrBseDt,
            String sectSysUtzYn,
            String indRsn,
            String cgprId,
            String cgprNm,
            String prlmHrkOgzCCone,
            String costSvnDpmC,
            String svnTemC,
            String svnDpmNm,
            String svnTemNm,
            String bseYy,
            String bgUntAbusC,
            String tmnYn,
            String abusTc,
            String cncdRfrNo) {}

    private record TerminalView(
            String tmnMngNo,
            Integer sno,
            String spfTmnNm,
            String tmnKdTc,
            String nsfUsgCone,
            String tmnClsfC,
            BigDecimal termRqmBgAmt,
            BigDecimal fcAmt,
            String curC,
            BigDecimal xcr,
            String xcrBseDt,
            String dfrCleC,
            String indRsn,
            String cgprId,
            String cgprNm,
            String termSvnDpmC,
            String svnDpmNm,
            String termSvnTemC,
            String svnTemNm,
            String rmk) {}
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --tests '*CostConcurrencyStamperTest' --no-daemon
```

기대: 8개 테스트 모두 PASS.

`Bcostm`·`Btermm`의 getter 이름이 위 코드와 다르면 컴파일 에러가 난다. `it_backend/src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java`와 `Btermm.java`의 필드명을 확인해 맞춘다. 필드를 임의로 빼거나 더하지 않는다 — 빠뜨린 필드는 그 필드의 동시 수정을 감지하지 못하는 구멍이 된다.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamper.java \
        src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStamperTest.java
git diff --cached --stat
git commit -m "feat: add cost concurrency stamper"
```

---

### Task 2: 조회 응답과 수정 요청에 concurrencyStamp 노출

배포 1단계의 백엔드 몫이다. 응답에 스탬프를 싣고 요청에서 받아들이기만 하며 **검증은 하지 않는다**. 이 단계는 구버전 프론트를 깨뜨리지 않는다.

`concurrencyStamp`를 `Response`의 `requiredProperties`에 넣지 않는다. 상세 조회에서만 채우고 목록·bulk 응답에서는 비므로, 필수로 선언하면 생성 타입이 사실과 달라진다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java` (`Response` 클래스, `UpdateRequest` 클래스)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostQueryAssembler.java` (`assembleDetail`)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostQueryAssemblerTest.java`
- Modify (컴파일 유지): `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostQueryServiceTest.java:45`, `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java:265` — 둘 다 `new CostQueryAssembler(...)`를 직접 호출한다

**Interfaces:**
- Consumes: `CostConcurrencyStamper.stamp(Bcostm, List<Btermm>)` (Task 1)
- Produces: `CostDto.Response.getConcurrencyStamp()` / `setConcurrencyStamp(String)`, `CostDto.UpdateRequest.getConcurrencyStamp()` / `setConcurrencyStamp(String)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`CostQueryAssemblerTest`에 다음 테스트를 추가한다. 기존 파일의 mock 필드 선언 방식과 조립 방식을 그대로 따르고, `CostConcurrencyStamper`와 `BtermmRepository` mock을 생성자 인자에 추가한다.

```java
    @Test
    @DisplayName("상세 조립은 활성 단말로 계산한 동시성 스탬프를 응답에 싣는다")
    void assembleDetailAttachesConcurrencyStamp() {
        Bcostm cost = Bcostm.builder().costBgNo("COST_2026_0001").bgSno(2).build();
        List<Btermm> terminals = List.of(Btermm.builder().tmnMngNo("TMN-1").sno(1).build());
        given(btermmRepository.findByTermBgNoAndTermBgSnoAndDelYn("COST_2026_0001", 2, "N"))
                .willReturn(terminals);
        given(concurrencyStamper.stamp(cost, terminals)).willReturn("a".repeat(64));

        CostDto.Response response = assembler.assembleDetail(cost);

        assertThat(response.getConcurrencyStamp()).isEqualTo("a".repeat(64));
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew test --tests '*CostQueryAssemblerTest' --no-daemon
```

기대: 컴파일 실패 — `getConcurrencyStamp()` 심볼 없음.

- [ ] **Step 3: DTO에 필드를 추가한다**

`CostDto.Response` 클래스 본문의 마지막 필드 뒤에 추가한다.

```java
        /** 개정본 동시성 스탬프. 상세 조회에서만 채우며, 저장 요청에 그대로 되돌려 보낸다. */
        @Schema(
                description = "개정본 동시성 스탬프 (저장 요청에 그대로 되돌려 보낸다)",
                example = "9f2c1d0ab34e5f6789012345678901234567890123456789012345678901abcd",
                nullable = true)
        private String concurrencyStamp;
```

`CostDto.UpdateRequest` 클래스 본문의 마지막 필드 뒤에 추가한다.

```java
        /** 조회 응답에서 받은 개정본 동시성 스탬프. 사용자 저장 경로에서 필수다. */
        @Schema(
                description = "조회 시 받은 개정본 동시성 스탬프",
                example = "9f2c1d0ab34e5f6789012345678901234567890123456789012345678901abcd",
                nullable = true)
        private String concurrencyStamp;
```

`Response`의 `@Schema(requiredProperties = {...})` 목록은 **수정하지 않는다**.

- [ ] **Step 4: 조립기가 스탬프를 채우게 한다**

`CostQueryAssembler`의 필드 선언부에 두 의존성을 추가한다.

```java
    private final BtermmRepository btermmRepository;
    private final CostConcurrencyStamper concurrencyStamper;
```

`assembleDetail`의 `terminalAssembler.attach(response);` 다음 줄에 추가한다.

```java
        // 저장 검증과 같은 함수로 계산해야 사용자가 바꾸지 않은 문서에서 충돌이 나지 않는다.
        response.setConcurrencyStamp(
                concurrencyStamper.stamp(
                        cost,
                        btermmRepository.findByTermBgNoAndTermBgSnoAndDelYn(
                                cost.getCostBgNo(), cost.getBgSno(), "N")));
```

목록(`assembleList`)·이력(`assembleHistory`)·bulk(`assembleBulk`)는 건드리지 않는다. 상세 조회에만 질의 한 건이 추가된다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --tests '*CostQueryAssemblerTest' --tests '*CostDtoMappingTest' --no-daemon
```

기대: 전부 PASS.

`new CostQueryAssembler(...)`는 **세 개의 테스트 파일**에서 호출된다 — `CostQueryAssemblerTest.java:180`, `CostQueryServiceTest.java:45`, `CostServiceTest.java:265`. 세 곳 모두에 새 인자 두 개를 추가해야 컴파일된다. Lombok `@RequiredArgsConstructor`는 필드 선언 순서를 따르므로 인자 순서도 선언 순서에 맞춘다.

```bash
./gradlew test --tests '*CostQueryServiceTest' --tests '*CostServiceTest' --no-daemon
```

- [ ] **Step 6: 커밋한다**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java \
        src/main/java/com/kdb/it/domain/budget/cost/service/CostQueryAssembler.java \
        src/test/java/com/kdb/it/domain/budget/cost/service/CostQueryAssemblerTest.java
git diff --cached --stat
git commit -m "feat: expose cost concurrency stamp on detail response"
```

---

### Task 3: 충돌 예외·응답 DTO·전역 핸들러

`ItBudgetApprovalDto.ErrorResponse`는 `changedBy`·`currentStamp`·`current`를 담을 수 없으므로 전산업무비 전용 예외와 응답을 만든다. 공통 필드 이름과 형식은 기존 오류 응답과 맞춘다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/exception/CostConflictException.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java` (`ConflictResponse` record 추가)
- Modify: `it_backend/src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java` (핸들러 추가)
- Test: `it_backend/src/test/java/com/kdb/it/exception/CostConflictExceptionHandlerTest.java`

**Interfaces:**
- Produces:
  - `CostConflictException(HttpStatus status, String code, String message, String changedBy, LocalDateTime changedAt, String currentStamp, CostDto.Response current)`
  - 접근자: `status()`, `code()`, `changedBy()`, `changedAt()`, `currentStamp()`, `current()`
  - `CostDto.ConflictResponse(LocalDateTime timestamp, int status, String code, String message, String changedBy, LocalDateTime changedAt, String currentStamp, Response current)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/exception/CostConflictExceptionHandlerTest.java`:

```java
package com.kdb.it.exception;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.exception.CostConflictException;
import java.time.LocalDateTime;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;

/** 전산업무비 저장 충돌 예외가 코드·현재 상태를 담은 응답으로 변환되는지 검증합니다. */
class CostConflictExceptionHandlerTest {

    private final GlobalExceptionHandler handler = new GlobalExceptionHandler();

    @Test
    @DisplayName("충돌 예외는 409와 현재 상태·스탬프를 반환한다")
    void conflictCarriesCurrentState() {
        CostDto.Response current = CostDto.Response.builder().costBgNo("COST_2026_0001").build();
        LocalDateTime changedAt = LocalDateTime.of(2026, 9, 8, 14, 25);
        CostConflictException exception =
                new CostConflictException(
                        HttpStatus.CONFLICT,
                        "COST_SOURCE_CHANGED",
                        "다른 사용자가 이 전산업무비를 수정했습니다.",
                        "홍길동",
                        changedAt,
                        "b".repeat(64),
                        current);

        ResponseEntity<CostDto.ConflictResponse> response = handler.handleCostConflict(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(409);
        assertThat(response.getBody().code()).isEqualTo("COST_SOURCE_CHANGED");
        assertThat(response.getBody().changedBy()).isEqualTo("홍길동");
        assertThat(response.getBody().changedAt()).isEqualTo(changedAt);
        assertThat(response.getBody().currentStamp()).isEqualTo("b".repeat(64));
        assertThat(response.getBody().current()).isSameAs(current);
    }

    @Test
    @DisplayName("스탬프 누락은 400과 빈 현재 상태를 반환한다")
    void missingStampIsBadRequest() {
        CostConflictException exception =
                new CostConflictException(
                        HttpStatus.BAD_REQUEST,
                        "COST_STAMP_REQUIRED",
                        "동시성 스탬프가 필요합니다.",
                        null,
                        null,
                        null,
                        null);

        ResponseEntity<CostDto.ConflictResponse> response = handler.handleCostConflict(exception);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().status()).isEqualTo(400);
        assertThat(response.getBody().current()).isNull();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew test --tests '*CostConflictExceptionHandlerTest' --no-daemon
```

기대: 컴파일 실패 — `CostConflictException` 심볼 없음.

- [ ] **Step 3: 예외를 만든다**

`it_backend/src/main/java/com/kdb/it/domain/budget/cost/exception/CostConflictException.java`:

```java
package com.kdb.it.domain.budget.cost.exception;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import java.time.LocalDateTime;
import org.springframework.http.HttpStatus;

/**
 * 전산업무비 저장의 동시성 위반을 HTTP 상태와 현재 원장 상태로 전달한다.
 *
 * <p>{@code COST_STAMP_REQUIRED}(400)는 현재 상태 없이, {@code COST_SOURCE_CHANGED}·{@code
 * COST_CONCURRENT_UPDATE}(409)는 사용자가 병합할 수 있도록 현재 상태와 최신 스탬프를 함께 담는다.
 */
public final class CostConflictException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final String changedBy;
    private final LocalDateTime changedAt;
    private final String currentStamp;
    private final transient CostDto.Response current;

    public CostConflictException(
            HttpStatus status,
            String code,
            String message,
            String changedBy,
            LocalDateTime changedAt,
            String currentStamp,
            CostDto.Response current) {
        super(message);
        this.status = status;
        this.code = code;
        this.changedBy = changedBy;
        this.changedAt = changedAt;
        this.currentStamp = currentStamp;
        this.current = current;
    }

    public HttpStatus status() {
        return status;
    }

    public String code() {
        return code;
    }

    public String changedBy() {
        return changedBy;
    }

    public LocalDateTime changedAt() {
        return changedAt;
    }

    public String currentStamp() {
        return currentStamp;
    }

    public CostDto.Response current() {
        return current;
    }
}
```

- [ ] **Step 4: 응답 DTO를 만든다**

`CostDto` 클래스 본문 안, `Response` 클래스 선언 바로 뒤에 추가한다. 내부 record는 springdoc에서 단순 이름으로 노출되어 다른 DTO와 충돌하므로 `@Schema(name = ...)`를 반드시 명시한다.

```java
    /**
     * 전산업무비 저장 충돌 응답
     *
     * <p>{@code current}는 저장 직전 잠금 상태에서 읽은 상세 응답이며 단말 목록 전체를 포함한다. 400 응답에서는 {@code changedBy}·{@code
     * changedAt}·{@code currentStamp}·{@code current}가 모두 null이다.
     */
    @Schema(name = "CostConflictResponse", description = "전산업무비 저장 충돌 응답")
    public record ConflictResponse(
            LocalDateTime timestamp,
            int status,
            String code,
            String message,
            String changedBy,
            LocalDateTime changedAt,
            String currentStamp,
            Response current) {}
```

`java.time.LocalDateTime` import가 없으면 추가한다.

- [ ] **Step 5: 전역 핸들러에 매핑을 추가한다**

`GlobalExceptionHandler`의 `handleItBudgetApproval` 바로 아래에 추가한다.

```java
    /** 전산업무비 저장 충돌을 코드와 현재 원장 상태로 반환한다. */
    @ExceptionHandler(CostConflictException.class)
    public ResponseEntity<CostDto.ConflictResponse> handleCostConflict(CostConflictException e) {
        log.warn("전산업무비 저장 충돌: code={}, status={}", e.code(), e.status().value());
        CostDto.ConflictResponse body =
                new CostDto.ConflictResponse(
                        LocalDateTime.now(),
                        e.status().value(),
                        e.code(),
                        e.getMessage(),
                        e.changedBy(),
                        e.changedAt(),
                        e.currentStamp(),
                        e.current());
        return ResponseEntity.status(e.status()).body(body);
    }
```

`com.kdb.it.domain.budget.cost.dto.CostDto`와 `com.kdb.it.domain.budget.cost.exception.CostConflictException` import를 추가한다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --tests '*CostConflictExceptionHandlerTest' --no-daemon
```

기대: 2개 PASS.

- [ ] **Step 7: 커밋한다**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/exception/CostConflictException.java \
        src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java \
        src/main/java/com/kdb/it/exception/GlobalExceptionHandler.java \
        src/test/java/com/kdb/it/exception/CostConflictExceptionHandlerTest.java
git diff --cached --stat
git commit -m "feat: add cost conflict exception and response contract"
```

---

### Task 4: 잠금 타임아웃 판정 공통화

`ItBudgetApprovalFacade.isLockTimeout`과 같은 판정을 전산업무비에서도 써야 한다. 복제하지 않고 공용 유틸로 옮긴다.

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/system/exception/LockTimeouts.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java` (private `isLockTimeout` 제거, 유틸 위임)
- Test: `it_backend/src/test/java/com/kdb/it/common/system/exception/LockTimeoutsTest.java`

**Interfaces:**
- Produces: `boolean LockTimeouts.isLockTimeout(Throwable failure)`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_backend/src/test/java/com/kdb/it/common/system/exception/LockTimeoutsTest.java`:

```java
package com.kdb.it.common.system.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.sql.SQLException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.dao.CannotAcquireLockException;

/** Oracle 잠금 대기 초과를 원인 사슬에서 찾아내는지 검증합니다. */
class LockTimeoutsTest {

    @Test
    @DisplayName("ORA-30006은 잠금 타임아웃이다")
    void oracle30006IsLockTimeout() {
        assertThat(LockTimeouts.isLockTimeout(new SQLException("lock wait", "61000", 30006)))
                .isTrue();
    }

    @Test
    @DisplayName("ORA-00054는 잠금 타임아웃이다")
    void oracle54IsLockTimeout() {
        assertThat(LockTimeouts.isLockTimeout(new SQLException("resource busy", "61000", 54)))
                .isTrue();
    }

    @Test
    @DisplayName("중첩된 원인도 찾아낸다")
    void nestedCauseIsFound() {
        assertThat(
                        LockTimeouts.isLockTimeout(
                                new RuntimeException(new CannotAcquireLockException("locked"))))
                .isTrue();
    }

    @Test
    @DisplayName("null 입력은 잠금 타임아웃이 아니다")
    void nullIsNotLockTimeout() {
        assertThat(LockTimeouts.isLockTimeout(null)).isFalse();
    }

    @Test
    @DisplayName("무관한 예외는 잠금 타임아웃이 아니다")
    void unrelatedFailureIsNotLockTimeout() {
        assertThat(LockTimeouts.isLockTimeout(new IllegalStateException("nope"))).isFalse();
    }
}
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew test --tests '*LockTimeoutsTest' --no-daemon
```

기대: 컴파일 실패 — `LockTimeouts` 심볼 없음.

- [ ] **Step 3: 유틸을 만든다**

`it_backend/src/main/java/com/kdb/it/common/system/exception/LockTimeouts.java`:

```java
package com.kdb.it.common.system.exception;

import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.Set;

/** 원인 사슬에서 Oracle 잠금 대기 초과를 판정한다. */
public final class LockTimeouts {

    private LockTimeouts() {}

    /**
     * 예외 사슬 어딘가에 잠금 대기 초과가 있는지 확인한다.
     *
     * <p>순환 참조가 있는 사슬에서도 종료되도록 방문한 예외를 식별자 기준으로 기억한다.
     *
     * @param failure 검사할 예외. null이면 false를 반환한다.
     * @return JPA·Spring 잠금 예외이거나 ORA-30006·ORA-00054이면 true
     */
    public static boolean isLockTimeout(Throwable failure) {
        Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
        for (var cause = failure; cause != null && seen.add(cause); cause = cause.getCause()) {
            if (cause instanceof jakarta.persistence.LockTimeoutException
                    || cause instanceof org.springframework.dao.CannotAcquireLockException
                    || cause instanceof java.sql.SQLException sql
                            && (sql.getErrorCode() == 30006 || sql.getErrorCode() == 54))
                return true;
        }
        return false;
    }
}
```

- [ ] **Step 4: 기존 호출부를 유틸로 바꾼다**

`ItBudgetApprovalFacade`에서 private `isLockTimeout` 메서드 전체를 삭제하고, 호출부를 `LockTimeouts.isLockTimeout(exception)`으로 바꾼다. `com.kdb.it.common.system.exception.LockTimeouts` import를 추가한다. 사용하지 않게 된 `Collections`·`IdentityHashMap`·`Set` import가 남으면 제거한다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --tests '*LockTimeoutsTest' --tests '*ItBudget*' --no-daemon
```

기대: 신규 5개 PASS, 기존 전산예산 결재 테스트 회귀 없음.

- [ ] **Step 6: 커밋한다**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/system/exception/LockTimeouts.java \
        src/main/java/com/kdb/it/common/approval/itbudget/service/ItBudgetApprovalFacade.java \
        src/test/java/com/kdb/it/common/system/exception/LockTimeoutsTest.java
git diff --cached --stat
git commit -m "refactor: extract shared lock timeout detection"
```

---

### Task 5: 프론트엔드 타입 생성과 스탬프 왕복

배포 1단계의 프론트 몫이다. 조회 응답의 스탬프를 편집 모델에 보관하고 저장 요청에 되돌려 보낸다. 이 시점의 백엔드는 값을 무시하므로 동작 변화가 없다.

`ItCost`는 `CostResponse`에서 파생되고 `concurrencyStamp`가 `Omit` 목록에 없으므로 codegen만 하면 타입이 자동으로 따라온다. `useCostFormSave`의 `payload = { ...cost, complete }` 전개도 값을 그대로 실어 보낸다. 즉 **추가 코드 없이 왕복이 성립하는지 확인하는 것**이 이 태스크의 핵심이며, 확인 테스트를 남긴다.

**Files:**
- Modify: codegen 산출물 (`npm run codegen` 결과, 수기 편집 금지)
- Test: `it_frontend/tests/unit/composables/cost/useCostFormSave.test.ts`

**Interfaces:**
- Consumes: `CostDto.Response.concurrencyStamp`, `CostDto.UpdateRequest.concurrencyStamp` (Task 2)
- Produces: `ItCost['concurrencyStamp']` — `string | null | undefined`

- [ ] **Step 1: 백엔드를 띄우고 타입을 생성한다**

```bash
cd C:/it/it_backend
./gradlew bootRun --no-daemon
```

다른 터미널에서:

```bash
cd C:/it/it_frontend
npm run codegen
npm run codegen:check
curl -s http://localhost:8080/v3/api-docs | grep -o '"CostConflictResponse"'
```

기대: `codegen:check` 통과, `CostConflictResponse` 스키마 존재. 스키마 이름이 `Response`처럼 단순 이름으로 나오면 Task 3 Step 4의 `@Schema(name = ...)`가 빠진 것이다.

- [ ] **Step 2: 실패하는 테스트를 작성한다**

`it_frontend/tests/unit/composables/cost/useCostFormSave.test.ts`에 추가한다. 이 파일이 이미 쓰는 ctx 조립 방식을 그대로 따른다 (아래 `createSave`는 그 헬퍼를 가리킨다. 파일에 헬퍼가 없으면 기존 테스트가 `useCostFormSave({...})`를 직접 호출하는 형태를 따라 인라인으로 조립한다).

```ts
    it('조회에서 받은 concurrencyStamp를 수정 요청에 그대로 실어 보낸다', async () => {
        const updateCost = vi.fn().mockResolvedValue({});
        const { saveCosts } = createSave({
            updateCost,
            costs: ref([
                {
                    costBgNo: 'COST_2026_0001',
                    cttNm: '서버 유지보수',
                    concurrencyStamp: 'a'.repeat(64),
                } as unknown as ItCost,
            ]),
        });

        await saveCosts(true, { background: true });

        expect(updateCost).toHaveBeenCalledWith(
            'COST_2026_0001',
            expect.objectContaining({ concurrencyStamp: 'a'.repeat(64) }),
            undefined,
        );
    });
```

- [ ] **Step 3: 테스트를 실행한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/useCostFormSave.test.ts
```

기대: PASS. 실패하면 `payload` 조립이 `concurrencyStamp`를 떨어뜨리고 있다는 뜻이다. `useCostFormSave.ts`의 `const payload: ItCost & { complete: boolean } = { ...cost, complete };`가 전개 형태인지 확인하고, 필드를 골라 담는 형태로 바뀌어 있다면 `concurrencyStamp`를 추가한다.

- [ ] **Step 4: 품질 게이트를 통과시킨다**

```bash
cd C:/it/it_frontend
npm run format:check
npm run check
npm test
```

기대: 전부 PASS.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it/it_frontend
git status --short
git add tests/unit/composables/cost/useCostFormSave.test.ts
git diff --cached --stat
git commit -m "test: pin cost concurrency stamp round-trip"
```

codegen이 갱신한 생성 타입 파일 경로를 `git status --short`로 확인해 함께 명시적으로 추가한다.

---

### Task 6: useCostConflictMerge — 3-way 차이 계산

원본(base)·내 편집(mine)·서버 현재(theirs)로 필드와 단말 행의 차이를 계산하고, 사용자의 선택을 저장 payload로 조립한다. 순수 함수이므로 UI 없이 단위 테스트한다.

**Files:**
- Create: `it_frontend/app/composables/cost/useCostConflictMerge.ts`
- Test: `it_frontend/tests/unit/composables/cost/useCostConflictMerge.test.ts`

**Interfaces:**
- Produces:
  - `interface CostFieldConflict { path: keyof ItCost; base: unknown; mine: unknown; theirs: unknown }`
  - `type CostTerminalChange = 'ADDED_BY_THEM' | 'DELETED_BY_THEM' | 'MODIFIED'`
  - `interface CostTerminalConflict { key: string; change: CostTerminalChange; mine: Terminal | null; theirs: Terminal | null }`
  - `interface CostConflict { fields: CostFieldConflict[]; terminals: CostTerminalConflict[] }`
  - `interface CostResolutionChoices { fields: Record<string, 'mine' | 'theirs'>; terminals: Record<string, 'mine' | 'theirs'> }`
  - `buildCostConflict(base: ItCost, mine: ItCost, theirs: ItCost): CostConflict`
  - `applyCostResolution(mine: ItCost, theirs: ItCost, conflict: CostConflict, choices: CostResolutionChoices, currentStamp: string): ItCost`

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`it_frontend/tests/unit/composables/cost/useCostConflictMerge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyCostResolution, buildCostConflict } from '~/composables/cost/useCostConflictMerge';
import type { ItCost, Terminal } from '~/types/cost-editor';

const terminal = (tmnMngNo: string, sno: number, name: string): Terminal =>
    ({ tmnMngNo, sno, spfTmnNm: name }) as unknown as Terminal;

const cost = (over: Partial<ItCost> = {}): ItCost =>
    ({
        costBgNo: 'COST_2026_0001',
        cttNm: '서버 유지보수',
        terminals: [],
        ...over,
    }) as unknown as ItCost;

describe('buildCostConflict', () => {
    it('양쪽이 같으면 충돌이 없다', () => {
        const conflict = buildCostConflict(cost(), cost(), cost());
        expect(conflict.fields).toEqual([]);
        expect(conflict.terminals).toEqual([]);
    });

    it('나만 바꾼 필드는 충돌이 아니다', () => {
        expect(buildCostConflict(cost(), cost({ cttNm: '내 값' }), cost()).fields).toEqual([]);
    });

    it('상대만 바꾼 필드는 충돌이 아니다', () => {
        expect(buildCostConflict(cost(), cost(), cost({ cttNm: '상대 값' })).fields).toEqual([]);
    });

    it('양쪽이 다르게 바꾼 필드만 충돌로 보고한다', () => {
        expect(
            buildCostConflict(cost(), cost({ cttNm: '내 값' }), cost({ cttNm: '상대 값' })).fields,
        ).toEqual([{ path: 'cttNm', base: '서버 유지보수', mine: '내 값', theirs: '상대 값' }]);
    });

    it('상대가 추가한 단말을 ADDED_BY_THEM으로 보고한다', () => {
        const conflict = buildCostConflict(
            cost(),
            cost(),
            cost({ terminals: [terminal('TMN-1', 1, '단말A')] }),
        );
        expect(conflict.terminals).toEqual([
            {
                key: 'TMN-1#1',
                change: 'ADDED_BY_THEM',
                mine: null,
                theirs: terminal('TMN-1', 1, '단말A'),
            },
        ]);
    });

    it('상대가 삭제한 단말을 DELETED_BY_THEM으로 보고한다', () => {
        const base = cost({ terminals: [terminal('TMN-1', 1, '단말A')] });
        const conflict = buildCostConflict(base, base, cost({ terminals: [] }));
        expect(conflict.terminals[0]?.change).toBe('DELETED_BY_THEM');
    });

    it('양쪽이 같은 단말을 다르게 고치면 MODIFIED로 보고한다', () => {
        const base = cost({ terminals: [terminal('TMN-1', 1, '단말A')] });
        const conflict = buildCostConflict(
            base,
            cost({ terminals: [terminal('TMN-1', 1, '내 단말')] }),
            cost({ terminals: [terminal('TMN-1', 1, '상대 단말')] }),
        );
        expect(conflict.terminals[0]?.change).toBe('MODIFIED');
    });

    it('스탬프 필드 자체는 충돌로 보지 않는다', () => {
        expect(
            buildCostConflict(
                cost(),
                cost({ concurrencyStamp: 'a'.repeat(64) } as Partial<ItCost>),
                cost({ concurrencyStamp: 'b'.repeat(64) } as Partial<ItCost>),
            ).fields,
        ).toEqual([]);
    });
});

describe('applyCostResolution', () => {
    it('선택한 쪽 값으로 payload를 만들고 최신 스탬프를 싣는다', () => {
        const mine = cost({ cttNm: '내 값' });
        const theirs = cost({ cttNm: '상대 값' });
        const conflict = buildCostConflict(cost(), mine, theirs);

        const resolved = applyCostResolution(
            mine,
            theirs,
            conflict,
            { fields: { cttNm: 'theirs' }, terminals: {} },
            'c'.repeat(64),
        );

        expect(resolved.cttNm).toBe('상대 값');
        expect(resolved.concurrencyStamp).toBe('c'.repeat(64));
    });

    it('상대가 추가한 단말을 theirs로 선택하면 목록에 남긴다', () => {
        const added = terminal('TMN-9', 1, '상대 단말');
        const mine = cost();
        const theirs = cost({ terminals: [added] });
        const conflict = buildCostConflict(cost(), mine, theirs);

        const resolved = applyCostResolution(
            mine,
            theirs,
            conflict,
            { fields: {}, terminals: { 'TMN-9#1': 'theirs' } },
            'd'.repeat(64),
        );

        expect(resolved.terminals).toEqual([added]);
    });

    it('상대가 추가한 단말을 mine으로 선택하면 목록에서 뺀다', () => {
        const added = terminal('TMN-9', 1, '상대 단말');
        const mine = cost();
        const theirs = cost({ terminals: [added] });
        const conflict = buildCostConflict(cost(), mine, theirs);

        const resolved = applyCostResolution(
            mine,
            theirs,
            conflict,
            { fields: {}, terminals: { 'TMN-9#1': 'mine' } },
            'd'.repeat(64),
        );

        expect(resolved.terminals).toEqual([]);
    });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/useCostConflictMerge.test.ts
```

기대: 모듈을 찾을 수 없어 실패.

- [ ] **Step 3: 구현한다**

`it_frontend/app/composables/cost/useCostConflictMerge.ts`:

```ts
import type { ItCost, Terminal } from '~/types/cost-editor';

/** 양쪽이 서로 다르게 바꾼 부모 필드 하나. */
export interface CostFieldConflict {
    path: keyof ItCost;
    base: unknown;
    mine: unknown;
    theirs: unknown;
}

/** 상대의 단말 변경 종류. 사용자가 선택으로 해소한다. */
export type CostTerminalChange = 'ADDED_BY_THEM' | 'DELETED_BY_THEM' | 'MODIFIED';

/** 단말 행 하나의 충돌. `key`는 `tmnMngNo#sno`다. */
export interface CostTerminalConflict {
    key: string;
    change: CostTerminalChange;
    mine: Terminal | null;
    theirs: Terminal | null;
}

/** 병합 다이얼로그가 표시할 차이 전체. */
export interface CostConflict {
    fields: CostFieldConflict[];
    terminals: CostTerminalConflict[];
}

/** 사용자 선택. 키가 없는 항목은 mine으로 취급한다. */
export interface CostResolutionChoices {
    fields: Record<string, 'mine' | 'theirs'>;
    terminals: Record<string, 'mine' | 'theirs'>;
}

/** 차이 비교에서 제외하는 편집 전용·서버 관리 필드. */
const IGNORED_FIELDS = new Set<string>([
    'concurrencyStamp',
    'terminals',
    'lstChgDtm',
    'apfMngNo',
    'apfSts',
    'apfStsC',
    'lstYn',
    'delYn',
]);

const terminalKey = (terminal: Terminal): string =>
    `${terminal.tmnMngNo ?? ''}#${terminal.sno ?? ''}`;

const sameValue = (left: unknown, right: unknown): boolean =>
    JSON.stringify(left ?? null) === JSON.stringify(right ?? null);

const byKey = (terminals: Terminal[] | null | undefined): Map<string, Terminal> =>
    new Map((terminals ?? []).map((terminal) => [terminalKey(terminal), terminal]));

/**
 * 원본·내 편집·서버 현재로 병합이 필요한 차이만 뽑는다.
 *
 * 한쪽만 바꾼 값은 충돌이 아니다. 양쪽이 원본에서 서로 다르게 벗어난 항목과, 상대가 추가하거나 삭제한 단말만 보고한다.
 *
 * @param base 화면을 연 시점의 원본
 * @param mine 사용자가 편집한 값
 * @param theirs 서버가 409와 함께 돌려준 현재 값
 * @returns 사용자가 선택해야 하는 필드·단말 목록
 */
export const buildCostConflict = (base: ItCost, mine: ItCost, theirs: ItCost): CostConflict => {
    const fields: CostFieldConflict[] = [];
    const paths = new Set<string>([...Object.keys(mine), ...Object.keys(theirs)]);
    for (const path of paths) {
        if (IGNORED_FIELDS.has(path)) continue;
        if (path.startsWith('_')) continue;
        const baseValue = (base as Record<string, unknown>)[path];
        const mineValue = (mine as Record<string, unknown>)[path];
        const theirsValue = (theirs as Record<string, unknown>)[path];
        if (sameValue(mineValue, theirsValue)) continue;
        if (sameValue(mineValue, baseValue)) continue;
        if (sameValue(theirsValue, baseValue)) continue;
        fields.push({
            path: path as keyof ItCost,
            base: baseValue,
            mine: mineValue,
            theirs: theirsValue,
        });
    }
    fields.sort((left, right) => String(left.path).localeCompare(String(right.path)));

    const baseTerminals = byKey(base.terminals);
    const mineTerminals = byKey(mine.terminals);
    const theirsTerminals = byKey(theirs.terminals);
    const terminals: CostTerminalConflict[] = [];
    for (const key of new Set([...mineTerminals.keys(), ...theirsTerminals.keys()])) {
        const mineRow = mineTerminals.get(key) ?? null;
        const theirsRow = theirsTerminals.get(key) ?? null;
        const baseRow = baseTerminals.get(key) ?? null;
        if (sameValue(mineRow, theirsRow)) continue;
        if (!theirsRow) {
            if (baseRow) {
                terminals.push({ key, change: 'DELETED_BY_THEM', mine: mineRow, theirs: null });
            }
            continue;
        }
        if (!mineRow) {
            terminals.push({
                key,
                change: baseRow ? 'MODIFIED' : 'ADDED_BY_THEM',
                mine: null,
                theirs: theirsRow,
            });
            continue;
        }
        if (sameValue(mineRow, baseRow)) continue;
        if (sameValue(theirsRow, baseRow)) continue;
        terminals.push({ key, change: 'MODIFIED', mine: mineRow, theirs: theirsRow });
    }
    terminals.sort((left, right) => left.key.localeCompare(right.key));

    return { fields, terminals };
};

/**
 * 사용자의 선택을 반영한 저장 payload를 만든다.
 *
 * 충돌하지 않은 항목은 내 편집을 유지하되, 상대만 바꾼 값은 서버 현재 값을 따른다. 재저장은 서버가 준 최신 스탬프를 쓴다.
 *
 * @param mine 사용자가 편집한 값
 * @param theirs 서버가 409와 함께 돌려준 현재 값
 * @param conflict {@link buildCostConflict} 결과
 * @param choices 사용자 선택. 키가 없으면 mine으로 취급한다.
 * @param currentStamp 409 응답의 `currentStamp`
 * @returns 재저장에 쓸 payload
 */
export const applyCostResolution = (
    mine: ItCost,
    theirs: ItCost,
    conflict: CostConflict,
    choices: CostResolutionChoices,
    currentStamp: string,
): ItCost => {
    const resolved: Record<string, unknown> = { ...theirs, ...mine };
    for (const field of conflict.fields) {
        const path = field.path as string;
        resolved[path] = choices.fields[path] === 'theirs' ? field.theirs : field.mine;
    }

    const rows = byKey(mine.terminals);
    for (const row of conflict.terminals) {
        const pick = choices.terminals[row.key] ?? 'mine';
        if (pick === 'theirs') {
            if (row.theirs) rows.set(row.key, row.theirs);
            else rows.delete(row.key);
        } else if (row.change === 'ADDED_BY_THEM') {
            rows.delete(row.key);
        } else if (row.mine) {
            rows.set(row.key, row.mine);
        }
    }

    resolved.terminals = [...rows.values()];
    resolved.concurrencyStamp = currentStamp;
    return resolved as unknown as ItCost;
};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/useCostConflictMerge.test.ts
```

기대: 11개 PASS.

- [ ] **Step 5: 커밋한다**

```bash
cd C:/it/it_frontend
git add app/composables/cost/useCostConflictMerge.ts \
        tests/unit/composables/cost/useCostConflictMerge.test.ts
git diff --cached --stat
git commit -m "feat: add cost conflict three-way merge calculation"
```

---

### Task 7: CostConflictMergeDialog 컴포넌트

차이가 있는 항목만 `내 값 / 서버 값` 선택으로 보여주고, 단말 행은 변경 종류 배지를 붙인다. 필드가 많은 화면이므로 **차이 없는 항목은 렌더링하지 않는다**.

**Files:**
- Create: `it_frontend/app/components/cost/CostConflictMergeDialog.vue`
- Modify: `it_frontend/i18n/messages/cost.ts` (ko·en 양쪽에 `cost.form.conflict.*` 추가)
- Test: `it_frontend/tests/unit/components/cost/CostConflictMergeDialog.test.ts`

**Interfaces:**
- Consumes: `CostConflict`, `CostResolutionChoices` (Task 6)
- Produces: props `{ visible: boolean; conflict: CostConflict; changedBy: string | null; changedAt: string | null }`, emits `{ 'update:visible': [boolean]; resolve: [CostResolutionChoices]; cancel: [] }`

- [ ] **Step 1: i18n 키를 추가한다**

`it_frontend/i18n/messages/cost.ts`의 ko 블록 `cost.form` 아래에 추가한다.

```ts
                conflict: {
                    header: '다른 사용자가 먼저 저장했습니다',
                    guide: '{name} 님이 {time}에 이 전산업무비를 수정했습니다. 항목마다 남길 값을 고르세요.',
                    guideUnknown:
                        '다른 사용자가 이 전산업무비를 수정했습니다. 항목마다 남길 값을 고르세요.',
                    columnField: '항목',
                    columnMine: '내 값',
                    columnTheirs: '서버 값',
                    terminals: '금융정보단말기',
                    addedByThem: '상대가 추가',
                    deletedByThem: '상대가 삭제',
                    modified: '양쪽 수정',
                    empty: '(없음)',
                    keepMine: '내 값 유지',
                    keepTheirs: '서버 값 사용',
                    apply: '선택한 값으로 저장',
                    cancel: '저장 취소',
                },
```

en 블록의 같은 위치에 대응 문구를 추가한다.

```ts
                conflict: {
                    header: 'Another user saved first',
                    guide: '{name} modified this record at {time}. Choose which value to keep for each item.',
                    guideUnknown:
                        'Another user modified this record. Choose which value to keep for each item.',
                    columnField: 'Field',
                    columnMine: 'My value',
                    columnTheirs: 'Server value',
                    terminals: 'Financial terminals',
                    addedByThem: 'Added by them',
                    deletedByThem: 'Deleted by them',
                    modified: 'Both modified',
                    empty: '(none)',
                    keepMine: 'Keep mine',
                    keepTheirs: 'Use server',
                    apply: 'Save selected values',
                    cancel: 'Cancel save',
                },
```

- [ ] **Step 2: 실패하는 테스트를 작성한다**

`it_frontend/tests/unit/components/cost/CostConflictMergeDialog.test.ts`. 기존 `tests/unit/components/cost/TerminalFormDialog.test.ts`의 마운트 방식(PrimeVue 스텁·i18n 설정)을 그대로 따른다.

```ts
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import CostConflictMergeDialog from '~/components/cost/CostConflictMergeDialog.vue';
import type { CostConflict } from '~/composables/cost/useCostConflictMerge';

const conflict: CostConflict = {
    fields: [{ path: 'cttNm', base: '원본', mine: '내 값', theirs: '상대 값' }],
    terminals: [
        {
            key: 'TMN-9#1',
            change: 'ADDED_BY_THEM',
            mine: null,
            theirs: { tmnMngNo: 'TMN-9', sno: 1, spfTmnNm: '상대 단말' } as never,
        },
    ],
};

const mountDialog = () =>
    mount(CostConflictMergeDialog, {
        props: { visible: true, conflict, changedBy: '홍길동', changedAt: '2026-09-08T14:25:00' },
        global: {
            stubs: {
                Dialog: { template: '<div><slot /><slot name="footer" /></div>' },
                Button: {
                    props: ['label'],
                    template: '<button v-bind="$attrs" @click="$emit(\'click\')">{{ label }}</button>',
                },
            },
        },
    });

describe('CostConflictMergeDialog', () => {
    it('충돌 필드와 단말 행을 모두 보여준다', () => {
        const wrapper = mountDialog();
        expect(wrapper.text()).toContain('cttNm');
        expect(wrapper.text()).toContain('내 값');
        expect(wrapper.text()).toContain('상대 값');
        expect(wrapper.text()).toContain('TMN-9');
    });

    it('기본 선택은 내 값이며 적용하면 선택을 emit 한다', async () => {
        const wrapper = mountDialog();
        await wrapper.get('[data-testid="conflict-apply"]').trigger('click');
        expect(wrapper.emitted('resolve')?.[0]?.[0]).toEqual({
            fields: { cttNm: 'mine' },
            terminals: { 'TMN-9#1': 'mine' },
        });
    });

    it('취소하면 cancel을 emit 한다', async () => {
        const wrapper = mountDialog();
        await wrapper.get('[data-testid="conflict-cancel"]').trigger('click');
        expect(wrapper.emitted('cancel')).toHaveLength(1);
    });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/components/cost/CostConflictMergeDialog.test.ts
```

기대: 컴포넌트를 찾을 수 없어 실패.

- [ ] **Step 4: 컴포넌트를 구현한다**

`it_frontend/app/components/cost/CostConflictMergeDialog.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { CostConflict, CostResolutionChoices } from '~/composables/cost/useCostConflictMerge';

const props = defineProps<{
    visible: boolean;
    conflict: CostConflict;
    changedBy: string | null;
    changedAt: string | null;
}>();

const emit = defineEmits<{
    'update:visible': [boolean];
    resolve: [CostResolutionChoices];
    cancel: [];
}>();

const { t } = useI18n();

const fieldChoices = ref<Record<string, 'mine' | 'theirs'>>({});
const terminalChoices = ref<Record<string, 'mine' | 'theirs'>>({});

/** 다이얼로그가 열릴 때마다 선택을 내 값 기준으로 초기화한다. */
watch(
    () => [props.visible, props.conflict] as const,
    () => {
        fieldChoices.value = Object.fromEntries(
            props.conflict.fields.map((field) => [String(field.path), 'mine' as const]),
        );
        terminalChoices.value = Object.fromEntries(
            props.conflict.terminals.map((row) => [row.key, 'mine' as const]),
        );
    },
    { immediate: true },
);

const guide = computed(() =>
    props.changedBy
        ? t('cost.form.conflict.guide', { name: props.changedBy, time: props.changedAt ?? '' })
        : t('cost.form.conflict.guideUnknown'),
);

const changeLabel = (change: string) =>
    change === 'ADDED_BY_THEM'
        ? t('cost.form.conflict.addedByThem')
        : change === 'DELETED_BY_THEM'
          ? t('cost.form.conflict.deletedByThem')
          : t('cost.form.conflict.modified');

/** 원시값은 그대로, 객체는 JSON으로, 빈 값은 안내 문구로 보여준다. */
const display = (value: unknown) =>
    value === null || value === undefined || value === ''
        ? t('cost.form.conflict.empty')
        : typeof value === 'object'
          ? JSON.stringify(value)
          : String(value);

const apply = () => {
    emit('resolve', { fields: fieldChoices.value, terminals: terminalChoices.value });
    emit('update:visible', false);
};

const cancel = () => {
    emit('cancel');
    emit('update:visible', false);
};
</script>

<template>
    <Dialog
        :visible="visible"
        modal
        :header="t('cost.form.conflict.header')"
        :style="{ width: '60rem' }"
        @update:visible="emit('update:visible', $event)"
    >
        <p class="mb-4">{{ guide }}</p>

        <table v-if="conflict.fields.length" class="w-full mb-4">
            <thead>
                <tr>
                    <th>{{ t('cost.form.conflict.columnField') }}</th>
                    <th>{{ t('cost.form.conflict.columnMine') }}</th>
                    <th>{{ t('cost.form.conflict.columnTheirs') }}</th>
                </tr>
            </thead>
            <tbody>
                <tr v-for="field in conflict.fields" :key="String(field.path)">
                    <td>{{ field.path }}</td>
                    <td>
                        <label>
                            <input
                                v-model="fieldChoices[String(field.path)]"
                                type="radio"
                                :name="`field-${String(field.path)}`"
                                value="mine"
                            />
                            {{ display(field.mine) }}
                        </label>
                    </td>
                    <td>
                        <label>
                            <input
                                v-model="fieldChoices[String(field.path)]"
                                type="radio"
                                :name="`field-${String(field.path)}`"
                                value="theirs"
                            />
                            {{ display(field.theirs) }}
                        </label>
                    </td>
                </tr>
            </tbody>
        </table>

        <section v-if="conflict.terminals.length">
            <h3>{{ t('cost.form.conflict.terminals') }}</h3>
            <table class="w-full">
                <tbody>
                    <tr v-for="row in conflict.terminals" :key="row.key">
                        <td>
                            <span>{{ row.key }}</span>
                            <span>{{ changeLabel(row.change) }}</span>
                        </td>
                        <td>
                            <label>
                                <input
                                    v-model="terminalChoices[row.key]"
                                    type="radio"
                                    :name="`terminal-${row.key}`"
                                    value="mine"
                                />
                                {{ t('cost.form.conflict.keepMine') }}
                            </label>
                        </td>
                        <td>
                            <label>
                                <input
                                    v-model="terminalChoices[row.key]"
                                    type="radio"
                                    :name="`terminal-${row.key}`"
                                    value="theirs"
                                />
                                {{ t('cost.form.conflict.keepTheirs') }}
                            </label>
                        </td>
                    </tr>
                </tbody>
            </table>
        </section>

        <template #footer>
            <Button
                data-testid="conflict-cancel"
                :label="t('cost.form.conflict.cancel')"
                severity="secondary"
                @click="cancel"
            />
            <Button
                data-testid="conflict-apply"
                :label="t('cost.form.conflict.apply')"
                @click="apply"
            />
        </template>
    </Dialog>
</template>
```

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/components/cost/CostConflictMergeDialog.test.ts
npm run check:copy
```

기대: 3개 PASS, 문구 검사 통과.

- [ ] **Step 6: 커밋한다**

```bash
cd C:/it/it_frontend
git add app/components/cost/CostConflictMergeDialog.vue \
        i18n/messages/cost.ts \
        tests/unit/components/cost/CostConflictMergeDialog.test.ts
git diff --cached --stat
git commit -m "feat: add cost conflict merge dialog"
```

---

### Task 8: 상세 폼에 병합 흐름 연결

`useCostFormData`가 화면 로드 시점의 원본을 보관하고, `useCostFormSave`가 409를 잡아 병합 다이얼로그를 연다. **저장 실패로 사용자의 입력을 버리지 않는다.**

**Files:**
- Modify: `it_frontend/app/composables/cost/useCostFormData.ts` (원본 스냅샷 보관·노출)
- Modify: `it_frontend/app/composables/cost/useCostFormSave.ts` (409 분기)
- Modify: 전산업무비 작성 페이지 (다이얼로그 마운트 — Step 6에서 경로 확인)
- Test: `it_frontend/tests/unit/composables/cost/useCostFormData.test.ts`, `it_frontend/tests/unit/composables/cost/useCostFormSave.test.ts`

**Interfaces:**
- Consumes: `buildCostConflict`, `applyCostResolution`, `CostConflict`, `CostResolutionChoices` (Task 6), `CostConflictMergeDialog` (Task 7)
- Produces:
  - `useCostFormData()` 반환에 `baselines: Ref<Map<string, ItCost>>` 추가 — 키는 `costBgNo`
  - `useCostFormSave()` 반환에 `conflict: Ref<CostConflict | null>`, `conflictVisible: Ref<boolean>`, `conflictChangedBy: Ref<string | null>`, `conflictChangedAt: Ref<string | null>`, `resolveConflict(choices: CostResolutionChoices): Promise<boolean>`, `cancelConflict(): void` 추가
  - `useCostFormSave()` ctx에 `baselines: Ref<Map<string, ItCost>>` 필수 인자 추가

- [ ] **Step 1: 원본 보관 테스트를 작성한다**

`tests/unit/composables/cost/useCostFormData.test.ts`에 추가한다. 이 파일의 기존 mock 설정(라우트·API)을 그대로 쓴다.

```ts
    it('조회한 원본을 costBgNo 키로 깊은 복사해 보관한다', async () => {
        const { costs, baselines, loadFormData } = useCostFormData();
        await loadFormData();
        const loaded = costs.value[0]!;
        expect(baselines.value.get(loaded.costBgNo!)).toEqual(loaded);
        expect(baselines.value.get(loaded.costBgNo!)).not.toBe(loaded);
    });

    it('편집해도 보관한 원본은 바뀌지 않는다', async () => {
        const { costs, baselines, loadFormData } = useCostFormData();
        await loadFormData();
        const loaded = costs.value[0]!;
        const before = baselines.value.get(loaded.costBgNo!)!.cttNm;
        loaded.cttNm = '편집한 값';
        expect(baselines.value.get(loaded.costBgNo!)!.cttNm).toBe(before);
    });
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/useCostFormData.test.ts
```

기대: `baselines`가 없어 실패.

- [ ] **Step 3: 원본 보관을 구현한다**

`useCostFormData.ts`에 추가한다.

```ts
    /** 화면을 연 시점의 서버 원본. 저장 충돌 시 3-way 비교의 base로 쓴다. */
    const baselines = ref(new Map<string, ItCost>());

    /** 편집으로 오염되지 않도록 깊은 복사본을 보관한다. 신규 행은 원본이 없으므로 건너뛴다. */
    const rememberBaseline = (cost: ItCost) => {
        if (cost.costBgNo) {
            baselines.value.set(cost.costBgNo, JSON.parse(JSON.stringify(cost)) as ItCost);
        }
    };
```

`loadFormData` 안에서 서버 응답으로 `costs`를 채우는 두 지점 뒤에 호출을 넣는다.

```ts
                if (costData) {
                    const loaded = normalizeCostDates(costData);
                    costs.value.push(loaded);
                    rememberBaseline(loaded);
                }
```

```ts
                if (data) {
                    costs.value = data.map(normalizeCostDates);
                    costs.value.forEach(rememberBaseline);
                }
```

`loadFormData` 시작부의 `costs.value = [];` 옆에 `baselines.value = new Map();`을 넣어 재조회 때 이전 원본이 남지 않게 한다. 반환 객체에 `baselines`를 추가한다.

- [ ] **Step 4: 409 분기 테스트를 작성한다**

`tests/unit/composables/cost/useCostFormSave.test.ts`에 추가한다.

```ts
    const conflictError = (theirsName: string) => ({
        statusCode: 409,
        data: {
            code: 'COST_SOURCE_CHANGED',
            changedBy: '홍길동',
            changedAt: '2026-09-08T14:25:00',
            currentStamp: 'e'.repeat(64),
            current: { costBgNo: 'COST_2026_0001', cttNm: theirsName, terminals: [] },
        },
    });

    const baselineMap = () =>
        ref(
            new Map([
                [
                    'COST_2026_0001',
                    {
                        costBgNo: 'COST_2026_0001',
                        cttNm: '원본',
                        terminals: [],
                    } as unknown as ItCost,
                ],
            ]),
        );

    const mineRow = () =>
        ref([
            {
                costBgNo: 'COST_2026_0001',
                cttNm: '내 값',
                terminals: [],
                concurrencyStamp: 'a'.repeat(64),
            } as unknown as ItCost,
        ]);

    it('409 COST_SOURCE_CHANGED를 받으면 병합 다이얼로그를 열고 입력을 유지한다', async () => {
        const updateCost = vi.fn().mockRejectedValue(conflictError('상대 값'));
        const costs = mineRow();
        const { saveCosts, conflict, conflictVisible } = createSave({
            updateCost,
            costs,
            baselines: baselineMap(),
        });

        const saved = await saveCosts(true, { background: true });

        expect(saved).toBe(false);
        expect(conflictVisible.value).toBe(true);
        expect(conflict.value?.fields).toEqual([
            { path: 'cttNm', base: '원본', mine: '내 값', theirs: '상대 값' },
        ]);
        expect(costs.value[0]?.cttNm).toBe('내 값');
    });

    it('병합 선택을 적용하면 최신 스탬프로 다시 저장한다', async () => {
        const updateCost = vi
            .fn()
            .mockRejectedValueOnce(conflictError('상대 값'))
            .mockResolvedValueOnce({});
        const { saveCosts, resolveConflict } = createSave({
            updateCost,
            costs: mineRow(),
            baselines: baselineMap(),
        });

        await saveCosts(true, { background: true });
        const resolved = await resolveConflict({ fields: { cttNm: 'theirs' }, terminals: {} });

        expect(resolved).toBe(true);
        expect(updateCost).toHaveBeenLastCalledWith(
            'COST_2026_0001',
            expect.objectContaining({ cttNm: '상대 값', concurrencyStamp: 'e'.repeat(64) }),
            undefined,
        );
    });

    it('병합을 취소해도 편집 내용은 남는다', async () => {
        const updateCost = vi.fn().mockRejectedValue(conflictError('상대 값'));
        const costs = mineRow();
        const { saveCosts, cancelConflict, conflictVisible } = createSave({
            updateCost,
            costs,
            baselines: baselineMap(),
        });

        await saveCosts(true, { background: true });
        cancelConflict();

        expect(conflictVisible.value).toBe(false);
        expect(costs.value[0]?.cttNm).toBe('내 값');
    });
```

- [ ] **Step 5: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/useCostFormSave.test.ts
```

기대: `conflictVisible`이 없어 실패.

- [ ] **Step 6: 409 분기를 구현한다**

`baselines`를 ctx 필수 인자로 추가하면 **Task 5에서 추가한 테스트가 ctx를 만들 때 이 인자를 넘기지 않아 타입 에러가 난다.** 테스트 헬퍼(`createSave` 또는 각 테스트의 인라인 ctx 조립)가 `baselines`를 기본값 `ref(new Map())`으로 채우게 먼저 고친 뒤 구현을 진행한다. 프로덕션 코드에서는 옵셔널로 만들지 않는다 — 원본 없이 저장하면 병합의 base가 사라진다.

`useCostFormSave.ts`의 ctx 타입에 `baselines: Ref<Map<string, ItCost>>`를 추가하고, import와 상태를 추가한다.

```ts
import {
    applyCostResolution,
    buildCostConflict,
    type CostConflict,
    type CostResolutionChoices,
} from '~/composables/cost/useCostConflictMerge';
```

```ts
    const conflict = ref<CostConflict | null>(null);
    const conflictVisible = ref(false);
    const conflictChangedBy = ref<string | null>(null);
    const conflictChangedAt = ref<string | null>(null);
    const pendingConflict = ref<{
        cost: ItCost;
        complete: boolean;
        theirs: ItCost;
        currentStamp: string;
        bgSno?: number;
    } | null>(null);

    /** 서버 충돌 응답만 병합 대상으로 인정한다. 다른 실패는 기존 토스트 경로를 유지한다. */
    const asSourceChanged = (error: unknown) => {
        const data = (error as { data?: Record<string, unknown> })?.data;
        return data && data.code === 'COST_SOURCE_CHANGED' ? data : null;
    };
```

저장 루프의 수정 분기를 다음으로 바꾼다.

```ts
                if (payload.costBgNo) {
                    const sno = Number(ctx.route.query.sno);
                    const revision = Number.isInteger(sno) && sno > 0 ? sno : undefined;
                    try {
                        await ctx.updateCost(payload.costBgNo, payload, revision);
                    } catch (error) {
                        const changed = asSourceChanged(error);
                        if (!changed) throw error;
                        const theirs = changed.current as ItCost;
                        const base = ctx.baselines.value.get(payload.costBgNo) ?? theirs;
                        conflict.value = buildCostConflict(base, cost, theirs);
                        conflictChangedBy.value = (changed.changedBy as string) ?? null;
                        conflictChangedAt.value = (changed.changedAt as string) ?? null;
                        pendingConflict.value = {
                            cost,
                            complete,
                            theirs,
                            currentStamp: changed.currentStamp as string,
                            bgSno: revision,
                        };
                        conflictVisible.value = true;
                        return false;
                    }
                } else {
```

병합 확정과 취소를 추가하고 반환 객체에 노출한다.

```ts
    /**
     * 병합 선택을 반영해 최신 스탬프로 다시 저장한다.
     *
     * @param choices 사용자가 항목마다 고른 값
     * @returns 재저장 성공 여부. 다시 충돌하면 다이얼로그를 열어 둔 채 false를 반환한다.
     */
    const resolveConflict = async (choices: CostResolutionChoices): Promise<boolean> => {
        const pending = pendingConflict.value;
        if (!pending || !conflict.value) return false;
        const merged = applyCostResolution(
            pending.cost,
            pending.theirs,
            conflict.value,
            choices,
            pending.currentStamp,
        );
        Object.assign(pending.cost, merged);
        try {
            await ctx.updateCost(
                merged.costBgNo as string,
                { ...merged, complete: pending.complete },
                pending.bgSno,
            );
        } catch (error) {
            const changed = asSourceChanged(error);
            if (!changed) throw error;
            const theirs = changed.current as ItCost;
            // 병합 중 또 바뀌었다. 방금 만든 병합 결과를 새 base이자 mine으로 삼아 다시 고르게 한다.
            conflict.value = buildCostConflict(merged, merged, theirs);
            conflictChangedBy.value = (changed.changedBy as string) ?? null;
            conflictChangedAt.value = (changed.changedAt as string) ?? null;
            pendingConflict.value = {
                ...pending,
                theirs,
                currentStamp: changed.currentStamp as string,
            };
            conflictVisible.value = true;
            return false;
        }
        conflictVisible.value = false;
        conflict.value = null;
        pendingConflict.value = null;
        return true;
    };

    /** 병합을 취소한다. 편집 내용은 그대로 두고 저장만 포기한다. */
    const cancelConflict = () => {
        conflictVisible.value = false;
        conflict.value = null;
        pendingConflict.value = null;
    };
```

반환문을 다음으로 바꾼다.

```ts
    return {
        isSubmitting,
        saveCosts,
        conflict,
        conflictVisible,
        conflictChangedBy,
        conflictChangedAt,
        resolveConflict,
        cancelConflict,
    };
```

- [ ] **Step 7: 페이지에 다이얼로그를 마운트한다**

```bash
cd C:/it/it_frontend
grep -rn "useCostFormSave" app/pages app/components
```

찾은 페이지에서 `useCostFormData()`의 `baselines`를 `useCostFormSave` ctx로 넘기고, 새 반환값을 구조 분해한 뒤 템플릿에 다이얼로그를 추가한다.

```vue
        <CostConflictMergeDialog
            v-model:visible="conflictVisible"
            :conflict="conflict ?? { fields: [], terminals: [] }"
            :changed-by="conflictChangedBy"
            :changed-at="conflictChangedAt"
            @resolve="resolveConflict"
            @cancel="cancelConflict"
        />
```

- [ ] **Step 8: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/cost/
npm run format:check
npm run check
```

기대: 전부 PASS.

- [ ] **Step 9: 커밋한다**

```bash
cd C:/it/it_frontend
git add app/composables/cost/useCostFormData.ts \
        app/composables/cost/useCostFormSave.ts \
        tests/unit/composables/cost/useCostFormData.test.ts \
        tests/unit/composables/cost/useCostFormSave.test.ts
git diff --cached --stat
git commit -m "feat: wire cost conflict merge into detail form save"
```

Step 7에서 수정한 페이지 파일 경로를 확인해 함께 명시적으로 추가한다.

---

### Task 9: 목록 인라인 편집의 충돌 표면화

목록은 여러 행을 순차 저장하므로 병합 다이얼로그를 쓰지 않는다. 충돌 행만 전용 문구로 표시해 사용자가 그 행을 다시 조회하게 한다. 성공한 행은 그대로 둔다.

**Files:**
- Modify: `it_frontend/app/composables/costList/useCostPersistence.ts` (`runRowWrite`)
- Modify: `it_frontend/i18n/messages/cost.ts` (ko·en `cost.toast.conflictRow`)
- Test: `it_frontend/tests/unit/composables/costList/useCostPersistence.test.ts`

**Interfaces:**
- Consumes: 409 응답의 `data.code === 'COST_SOURCE_CHANGED'` (Task 3)
- Produces: 인터페이스 변경 없음 — 기존 `CostSaveFailure.message`에 충돌 전용 문구가 들어간다.

- [ ] **Step 1: i18n 키를 추가한다**

ko 블록 `cost.toast` 아래:

```ts
                conflictRow: '다른 사용자가 먼저 저장했습니다. 이 행을 다시 조회한 뒤 수정하세요.',
```

en 블록 같은 위치:

```ts
                conflictRow: 'Another user saved first. Reload this row before editing.',
```

- [ ] **Step 2: 실패하는 테스트를 작성한다**

`tests/unit/composables/costList/useCostPersistence.test.ts`에 추가한다. 이 파일의 기존 ctx 조립 방식을 그대로 따른다.

```ts
    it('충돌한 행은 전용 문구로 표시하고 다른 행의 저장은 계속한다', async () => {
        const updateCost = vi
            .fn()
            .mockRejectedValueOnce({
                statusCode: 409,
                data: { code: 'COST_SOURCE_CHANGED', message: '변경됨' },
            })
            .mockResolvedValueOnce({});
        const { saveAndExitEdit, saveFailures } = createPersistence({
            updateCost,
            costs: ref([
                { costBgNo: 'COST-A', cttNm: '가', _status: 'modified' },
                { costBgNo: 'COST-B', cttNm: '나', _status: 'modified' },
            ] as never),
        });

        await saveAndExitEdit();

        expect(saveFailures.value).toHaveLength(1);
        expect(saveFailures.value[0]?.key).toBe('COST-A');
        expect(saveFailures.value[0]?.message).toBe(
            '다른 사용자가 먼저 저장했습니다. 이 행을 다시 조회한 뒤 수정하세요.',
        );
        expect(updateCost).toHaveBeenCalledTimes(2);
    });
```

- [ ] **Step 3: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/costList/useCostPersistence.test.ts
```

기대: 서버 원문 메시지가 들어가서 문구 비교에 실패.

- [ ] **Step 4: 구현한다**

`useCostPersistence.ts`의 `runRowWrite` catch 블록에서 메시지 결정 부분만 바꾼다.

```ts
        } catch (e) {
            console.error(`[CostList] ${operation} 실패 (key=${rowKey(row)}):`, e);
            // 충돌은 원인이 정해져 있으므로 서버 원문 대신 다음 행동을 알려주는 문구를 쓴다.
            const isConflict =
                (e as { data?: { code?: string } })?.data?.code === 'COST_SOURCE_CHANGED';
            const message = isConflict
                ? t('cost.toast.conflictRow')
                : formatApiError(getErrorMessage(e, t('cost.toast.saveFailureFallback')));
            row._saveError = message;
```

이후 로직은 그대로 둔다.

- [ ] **Step 5: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_frontend
npm test -- tests/unit/composables/costList/useCostPersistence.test.ts
npm run check:copy
```

기대: PASS.

- [ ] **Step 6: 커밋한다**

```bash
cd C:/it/it_frontend
git add app/composables/costList/useCostPersistence.ts \
        i18n/messages/cost.ts \
        tests/unit/composables/costList/useCostPersistence.test.ts
git diff --cached --stat
git commit -m "feat: surface cost save conflicts on list rows"
```

---

### Task 10: 저장 검증 활성화 (마지막 배포 단계)

여기서 처음으로 400·409가 실제로 발생한다. **Task 5~9가 배포된 뒤에 배포한다.**

검사는 반드시 잠금 획득 뒤, 그리고 `target`이나 `request`에 어떤 변경도 가하기 전에 수행한다. private `updateCost`는 `approvalWriteGuard.verifyWritable` 다음의 `request.setXcr(...)`부터 원장을 만지기 시작하므로 그 사이가 유일하게 안전한 지점이다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java` (public `updateCost` 두 개, private `updateCost`)
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java`

**Interfaces:**
- Consumes: `CostConcurrencyStamper.stamp` (Task 1), `CostConflictException` (Task 3), `LockTimeouts.isLockTimeout` (Task 4), `CostDto.UpdateRequest.getConcurrencyStamp()` (Task 2)

409 응답의 `current`는 `CostService`에 이미 주입된 `queryService.getCost(String costBgNo, Integer bgSno)`로 만든다 (`CostQueryService.java:44`). 이 메서드는 `assembleDetail`을 거치므로 Task 2에서 넣은 `concurrencyStamp`도 함께 채워진다.

- [ ] **Step 1: 실패하는 테스트를 작성한다**

`CostServiceTest`의 `costService` 조립부(`new CostService(...)`)에 `concurrencyStamper` mock 인자를 필드 선언 순서에 맞게 추가하고, 중첩 클래스를 추가한다.

```java
    @Nested
    @DisplayName("저장 동시성 검증")
    class ConcurrencyStampChecks {

        private Bcostm locked() {
            Bcostm cost = Bcostm.builder().costBgNo("COST-1").bgSno(1).build();
            given(costRepository.findCurrentVersionsForUpdate("COST-1")).willReturn(List.of(cost));
            given(btermmRepository.findByTermBgNoAndTermBgSnoAndDelYn("COST-1", 1, "N"))
                    .willReturn(List.of());
            return cost;
        }

        @Test
        @DisplayName("스탬프가 없으면 400으로 차단한다")
        void missingStampIsRejected() {
            locked();
            CostDto.UpdateRequest request = CostDto.UpdateRequest.builder().build();
            assertThatThrownBy(() -> costService.updateCost("COST-1", request))
                    .isInstanceOf(CostConflictException.class)
                    .satisfies(
                            e ->
                                    assertThat(((CostConflictException) e).code())
                                            .isEqualTo("COST_STAMP_REQUIRED"));
        }

        @Test
        @DisplayName("형식이 어긋난 스탬프도 400으로 차단한다")
        void malformedStampIsRejected() {
            locked();
            CostDto.UpdateRequest request =
                    CostDto.UpdateRequest.builder().concurrencyStamp("ZZZ").build();
            assertThatThrownBy(() -> costService.updateCost("COST-1", request))
                    .isInstanceOf(CostConflictException.class)
                    .satisfies(
                            e ->
                                    assertThat(((CostConflictException) e).code())
                                            .isEqualTo("COST_STAMP_REQUIRED"));
        }

        @Test
        @DisplayName("스탬프가 다르면 409와 현재 상태를 돌려준다")
        void staleStampIsConflict() {
            Bcostm cost = locked();
            given(concurrencyStamper.stamp(eq(cost), anyList())).willReturn("b".repeat(64));
            given(queryService.getCost("COST-1", 1))
                    .willReturn(CostDto.Response.builder().costBgNo("COST-1").build());
            CostDto.UpdateRequest request =
                    CostDto.UpdateRequest.builder().concurrencyStamp("a".repeat(64)).build();

            assertThatThrownBy(() -> costService.updateCost("COST-1", request))
                    .isInstanceOf(CostConflictException.class)
                    .satisfies(
                            e -> {
                                CostConflictException conflict = (CostConflictException) e;
                                assertThat(conflict.code()).isEqualTo("COST_SOURCE_CHANGED");
                                assertThat(conflict.currentStamp()).isEqualTo("b".repeat(64));
                                assertThat(conflict.current()).isNotNull();
                            });
        }

        @Test
        @DisplayName("스탬프가 같으면 저장을 진행한다")
        void matchingStampProceeds() {
            Bcostm cost = locked();
            given(concurrencyStamper.stamp(eq(cost), anyList())).willReturn("a".repeat(64));
            CostDto.UpdateRequest request =
                    CostDto.UpdateRequest.builder().concurrencyStamp("a".repeat(64)).build();

            assertThat(costService.updateCost("COST-1", request)).isEqualTo("COST-1");
        }

        @Test
        @DisplayName("이관 경로는 스탬프 없이도 저장한다")
        void migrationPathIsExempt() {
            Bcostm cost = locked();
            costService.updateCostForMigration("COST-1", CostDto.UpdateRequest.builder().build());
            verify(concurrencyStamper, never()).stamp(eq(cost), anyList());
        }

        @Test
        @DisplayName("잠금 대기 초과는 재시도 가능한 409로 바꾼다")
        void lockTimeoutBecomesConcurrentUpdate() {
            given(costRepository.findCurrentVersionsForUpdate("COST-1"))
                    .willThrow(new org.springframework.dao.CannotAcquireLockException("locked"));
            CostDto.UpdateRequest request =
                    CostDto.UpdateRequest.builder().concurrencyStamp("a".repeat(64)).build();

            assertThatThrownBy(() -> costService.updateCost("COST-1", request))
                    .isInstanceOf(CostConflictException.class)
                    .satisfies(
                            e ->
                                    assertThat(((CostConflictException) e).code())
                                            .isEqualTo("COST_CONCURRENT_UPDATE"));
        }

        @Test
        @DisplayName("이관 경로의 잠금 대기 초과는 그대로 전파한다")
        void migrationLockTimeoutIsNotTranslated() {
            given(costRepository.findCurrentVersionsForUpdate("COST-1"))
                    .willThrow(new org.springframework.dao.CannotAcquireLockException("locked"));

            assertThatThrownBy(
                            () ->
                                    costService.updateCostForMigration(
                                            "COST-1", CostDto.UpdateRequest.builder().build()))
                    .isInstanceOf(org.springframework.dao.CannotAcquireLockException.class);
        }
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew test --tests '*CostServiceTest' --no-daemon
```

기대: 컴파일 실패 또는 예외가 던져지지 않아 실패.

- [ ] **Step 3: 검증을 구현한다**

`CostService`의 필드 선언부에 추가한다.

```java
    private final CostConcurrencyStamper concurrencyStamper;
```

private `updateCost`의 `approvalWriteGuard.verifyWritable(...)` 호출 바로 다음, `if (!preserveSubmittedAmounts) { request.setXcr(...) }` 블록 **앞**에 삽입한다.

```java
        // 원장을 만지기 전에 검사해야 한다. 아래 블록부터 target과 request가 수정되므로 이 지점이 유일하게 안전하다.
        if (!preserveSubmittedAmounts) {
            verifyConcurrencyStamp(request, target);
        }
```

private 메서드를 추가한다.

```java
    /**
     * 잠근 개정본의 현재 스탬프와 요청 스탬프를 비교한다.
     *
     * @param request 사용자 저장 요청
     * @param target 잠금이 걸린 대상 개정본
     * @throws CostConflictException 스탬프가 없거나 형식이 어긋나면 400, 현재 상태와 다르면 409
     */
    private void verifyConcurrencyStamp(CostDto.UpdateRequest request, Bcostm target) {
        String submitted = request.getConcurrencyStamp();
        if (submitted == null || !submitted.matches("[a-f0-9]{64}")) {
            throw new CostConflictException(
                    HttpStatus.BAD_REQUEST,
                    "COST_STAMP_REQUIRED",
                    "동시성 스탬프가 필요합니다. 화면을 다시 조회한 뒤 저장하세요.",
                    null,
                    null,
                    null,
                    null);
        }
        String current =
                concurrencyStamper.stamp(
                        target,
                        btermmRepository.findByTermBgNoAndTermBgSnoAndDelYn(
                                target.getCostBgNo(), target.getBgSno(), "N"));
        if (current.equals(submitted)) return;
        throw new CostConflictException(
                HttpStatus.CONFLICT,
                "COST_SOURCE_CHANGED",
                "다른 사용자가 이 전산업무비를 수정했습니다.",
                resolveCgprName(target.getLstChgUsid()),
                target.getLstChgDtm(),
                current,
                queryService.getCost(target.getCostBgNo(), target.getBgSno()));
    }
```

감사 필드는 `BaseEntity`의 `getLstChgUsid()`(최종 변경자 사번)와 `getLstChgDtm()`(최종 변경일시)다 (`BaseEntity.java:83,88`). `resolveCgprName`은 `CostService`에 이미 있는 사번→이름 해석 헬퍼다. 해석할 수 없으면 사번이 그대로 표시되게 둔다.

**알려진 한계:** 이 구현은 부모의 감사 필드만 본다. 단말만 수정된 경우 자식의 `LST_CHG_DTM`이 더 최근이므로 표시되는 수정자가 부정확할 수 있다. 스펙 11.1의 "부모·자식 중 최신" 규칙은 Task 11에서 잔여 과제로 등록한다.

- [ ] **Step 4: 잠금 타임아웃을 409로 변환한다**

사용자 진입점 두 개를 감싼다. `updateCostForMigration`은 감싸지 않는다.

```java
    @Transactional
    public String updateCost(String itMngcNo, CostDto.UpdateRequest request) {
        return runUserUpdate(() -> updateCost(itMngcNo, null, request, false));
    }

    /** 정확한 예산일련번호의 미상신 개정본을 수정합니다. */
    @Transactional
    public String updateCost(String itMngcNo, Integer bgSno, CostDto.UpdateRequest request) {
        return runUserUpdate(() -> updateCost(itMngcNo, bgSno, request, false));
    }

    /**
     * 사용자 수정 경로의 잠금 대기 초과를 재시도 가능한 409로 바꾼다.
     *
     * @param update 실제 수정 로직
     * @return 수정된 관리번호
     * @throws CostConflictException 잠금 대기 5초를 넘긴 경우
     */
    private String runUserUpdate(java.util.function.Supplier<String> update) {
        try {
            return update.get();
        } catch (RuntimeException exception) {
            if (LockTimeouts.isLockTimeout(exception))
                throw new CostConflictException(
                        HttpStatus.CONFLICT,
                        "COST_CONCURRENT_UPDATE",
                        "다른 작업이 이 전산업무비를 수정 중입니다. 잠시 후 다시 시도하세요.",
                        null,
                        null,
                        null,
                        null);
            throw exception;
        }
    }
```

- [ ] **Step 5: 실제 DB로 오래된 스탬프 저장을 막는지 검증한다**

단위 테스트는 스탬프 계산과 저장 로직을 모두 mock으로 갈라놓으므로, 둘이 실제로 맞물리는지는 확인하지 못한다. 실 DB로 한 번 확인한다.

스레드 두 개로 진짜 동시성을 재현하지 않는다. Oracle 행 잠금 경합 테스트는 불안정하고, 이 계획이 막으려는 결함은 "잠금이 겹치는 순간"이 아니라 **저장 요청 사이에 벌어진 변경**이다. 순차 시나리오가 그 결함을 정확히 재현한다. 잠금 경합 경로는 Step 1의 `lockTimeoutBecomesConcurrentUpdate`가 덮는다.

`it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStampIt.java`:

```java
package com.kdb.it.domain.budget.cost.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.domain.budget.cost.dto.CostDto;
import com.kdb.it.domain.budget.cost.exception.CostConflictException;
import com.kdb.it.support.AbstractOracleRepositoryTest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 조회에서 받은 스탬프가 실제 저장 검증과 맞물리는지 실 DB로 확인합니다. */
@DisplayName("전산업무비 동시성 스탬프 왕복")
class CostConcurrencyStampIt extends AbstractOracleRepositoryTest {

    @Autowired CostService costService;
    @Autowired CostQueryService queryService;

    @Test
    @DisplayName("조회한 스탬프로 저장하면 성공하고, 같은 스탬프로 다시 저장하면 409다")
    void staleStampIsRejectedOnSecondSave() {
        String costBgNo = existingCostBgNo();
        CostDto.Response loaded = queryService.getCost(costBgNo);
        String stamp = loaded.getConcurrencyStamp();
        assertThat(stamp).matches("[a-f0-9]{64}");

        CostDto.UpdateRequest first = updateRequestFrom(loaded);
        first.setCttNm("첫 번째 저장");
        first.setConcurrencyStamp(stamp);
        costService.updateCost(costBgNo, first);

        // 같은 스탬프를 다시 쓰는 것이 곧 "오래된 화면으로 저장"이다.
        CostDto.UpdateRequest second = updateRequestFrom(loaded);
        second.setCttNm("두 번째 저장");
        second.setConcurrencyStamp(stamp);

        assertThatThrownBy(() -> costService.updateCost(costBgNo, second))
                .isInstanceOf(CostConflictException.class)
                .satisfies(
                        e -> {
                            CostConflictException conflict = (CostConflictException) e;
                            assertThat(conflict.code()).isEqualTo("COST_SOURCE_CHANGED");
                            assertThat(conflict.currentStamp()).isNotEqualTo(stamp);
                            assertThat(conflict.current()).isNotNull();
                        });
        assertThat(queryService.getCost(costBgNo).getCttNm()).isEqualTo("첫 번째 저장");
    }
}
```

`existingCostBgNo()`와 `updateRequestFrom(...)`은 이 테스트 클래스 안에 만든다. `AbstractOracleRepositoryTest`가 쓰는 시드 데이터에서 미상신 상태의 전산업무비 하나를 골라 관리번호를 돌려주고, 응답 DTO의 필드를 `UpdateRequest`로 옮기면 된다. 같은 저장소의 다른 `*It` 테스트가 시드를 어떻게 고르는지 참고한다.

```bash
cd C:/it/it_backend
./gradlew integrationTest --tests '*CostConcurrencyStampIt' --no-daemon
```

Oracle이 없으면 이 테스트는 건너뛴다. 건너뛴 경우 **통과했다고 보고하지 않는다** — Step 7의 수동 확인으로 대체하고 그 사실을 커밋 메시지에 남긴다.

- [ ] **Step 6: 테스트가 통과하는지 확인한다**

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --no-daemon
```

기대: 전체 백엔드 테스트 PASS.

기존 `CostServiceTest`·`CostControllerTest`에서 스탬프 없이 `updateCost`를 부르던 테스트가 400으로 깨진다. 그 테스트에 유효한 스탬프를 넣고 `concurrencyStamper` mock이 같은 값을 반환하게 고친다. **검증을 끄거나 조건을 완화하는 방식으로 회피하지 않는다** — 그러면 이 태스크가 막으려는 결함이 그대로 남는다.

- [ ] **Step 7: 커밋한다**

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java \
        src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git diff --cached --stat
git commit -m "feat: reject stale cost saves with concurrency stamp check"
```

기존 컨트롤러 테스트를 고쳤다면 그 경로도 함께 명시적으로 추가한다.

---

### Task 11: 배포 절차와 잔여 과제 기록

**Files:**
- Create: `C:/it/docs/operations/2026-09-08-cost-concurrency-rollout.md` (루트 저장소)
- Modify: `C:/it/TASK.md` (루트 저장소)
- Modify: `C:/it/versions.lock` (스크립트로 갱신)

- [ ] **Step 1: 배포 절차를 기록한다**

`C:/it/docs/operations/2026-09-08-cost-concurrency-rollout.md`:

```markdown
# 전산업무비 동시성 스탬프 배포 절차

## 순서

1. 백엔드 1단계 — 조회 응답의 `concurrencyStamp` 노출과 요청 필드 수용 (Task 1~4). 검증 없음. 구버전 프론트에 영향 없음.
2. 프론트엔드 — 스탬프 왕복, 병합 다이얼로그, 목록 충돌 표시 (Task 5~9).
3. 캐시된 구버전 번들이 만료될 때까지 대기.
4. 백엔드 2단계 — `COST_STAMP_REQUIRED` 400 차단 활성화 (Task 10).

2~4 사이에는 동시 저장 보호가 없다. 간격을 짧게 유지한다.

## 되돌리기

4단계만 되돌리면 보호는 사라지지만 저장은 정상 동작한다. 1~3단계를 되돌릴 필요는 없다.

## 확인

- 상세 조회 응답에 `concurrencyStamp`가 64자리 16진수로 내려오는가
- 두 브라우저에서 같은 문서를 열고 한쪽을 저장한 뒤 다른 쪽을 저장하면 병합 다이얼로그가 뜨는가
- 병합 다이얼로그에서 서버 값을 골라 저장하면 성공하는가
- 한쪽이 금융정보단말 행을 추가한 뒤 다른 쪽이 저장하면 그 행이 사라지지 않는가
- 이관·관리자 일괄 업로드가 스탬프 없이 성공하는가
```

- [ ] **Step 2: 잔여 과제를 등록한다**

`C:/it/TASK.md`에 추가한다.

```markdown
- 전산업무비 충돌 응답의 `changedBy`가 부모 `LST_CHG_ENO`만 본다. 단말만 수정된 경우 자식의 감사 정보가 더 최근이므로, 부모·자식 중 최신 수정자를 고르도록 개선해야 한다. (스펙 `docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md` 11.1)
- 정보화사업(BPROJM·BITEMM) 저장 경로에 같은 동시성 스탬프 규약을 확장해야 한다.
- 병합 다이얼로그가 필드명을 원시 컬럼명(`cttNm` 등)으로 보여준다. 화면 라벨과 같은 문구로 바꿔야 한다.
```

- [ ] **Step 3: 호환 버전을 기록한다**

```bash
cd C:/it
./scripts/update-versions-lock.ps1
```

- [ ] **Step 4: 커밋한다**

```bash
cd C:/it
git add docs/operations/2026-09-08-cost-concurrency-rollout.md TASK.md versions.lock
git diff --cached --stat
git commit -m "docs: record cost concurrency rollout and follow-ups"
```

---

## 전체 검증

모든 태스크를 마친 뒤 실행한다.

```bash
cd C:/it/it_backend
./gradlew spotlessApply --no-daemon
./gradlew test --no-daemon

cd C:/it/it_frontend
npm run format:check
npm run check
npm test
```

수동 확인은 배포 문서(Task 11 Step 1)의 "확인" 항목을 따른다. **두 브라우저로 같은 문서를 여는 시나리오는 단위 테스트로 대체할 수 없으므로 반드시 실제로 해본다.** 특히 금융정보단말 행이 사라지지 않는지는 이 계획이 막으려는 가장 큰 피해이므로 직접 확인한다.
