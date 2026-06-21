# Phase 5 — 리팩토링 & 테스트 (T17·T18) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 백엔드 개선 로드맵 **Phase 5(저우선)** 의 두 테마를 안전하게 처리한다. T17은 일관 스타일·중복 추출·미사용 제거(행위 보존 정리), T18은 통합 테스트 인프라 구축과 대량 테스트 실패(`NoClassDefFoundError`) 원인 규명이다. 위험이 낮은 정리부터 시작해 마지막에 테스트 인프라 조사(T18)를 둔다. T18의 조사 결과가 통합 테스트 작성을 좌우하므로, 신규 통합 테스트(Task 13~15)는 **Task 12(스파이크)가 빌드 가능한 테스트 실행 환경을 확정한 뒤**에만 착수한다.

**Architecture:** 모든 변경은 기존 레이어드 아키텍처(Controller→Service→Repository) 내부의 비행위(non-behavioral) 정리 또는 테스트 추가다. 새 공통 헬퍼(`buildCodeNameMap`)는 `domain` 하위에 두고, BBUGTM 합산 헬퍼는 `BbugtmRepositoryImpl` 내부 private 메서드로 추출한다. 감사 로그 통합 테스트는 JPA 엔티티 리스너(`ChangeLogEntityListener`)가 Spring 빈이 아니라 `ApplicationContextHolder.getBean()`으로 `AuditLogPersister`를 조회하는 구조를 실제로 기동시킨다.

**Tech Stack:** Java 25, Spring Boot 4.1.0, Spring Data JPA + QueryDSL 5.1.0, JUnit 5 + AssertJ + Mockito. 빌드/테스트: `./gradlew`(루트 `it_backend`).

**범위 메모 (실측 기반):**
- `Collectors.toList()` 실측 **51건 / 22파일** (Grep 확정, 로드맵 수치와 일치).
- `DomainTargetResolver` — **현재 소스에 존재하지 않음.** 로드맵·TASK.md 계획 문구일 뿐 추출 대상 인라인 코드가 식별되지 않는다 → **이 계획에서는 보류(Task 7에서 명시적 No-op 처리)**. 잘못된 "추출"을 발명하지 않는다.
- `AuditLogEvent` — **현재 활성 인스턴스화/`publishEvent` 호출 0건.** 실제 감사 로그는 `ChangeLogEntityListener → AuditLogPersister` 동기 경로(§5.12.1)가 담당하므로 이 클래스는 **사용되지 않는 잔재**다. 로드맵의 "record 변환"보다 **삭제**가 옳다(Task 4).
- `BoardCommentService` 미사용 import는 line 24 `java.time.LocalDate`(line 27 `Collectors`는 **사용 중**이므로 제거 금지).
- `FileService.FL_MNG_NO_RETRY`(line 126)는 코드에서 미참조이나 **line 115 JavaDoc `{@value #FL_MNG_NO_RETRY}`가 참조**한다 → 필드만 지우면 JavaDoc 깨짐. 필드와 `{@value}` 문장을 **함께** 정리한다(Task 2).
- `BcostmL @Column(length)` — 로드맵은 단수지만 실측 **12개 컬럼**이 DDL과 불일치. 메타데이터 정정이므로 한 번에 처리(Task 3).

---

## File Structure

| 파일 | 책임 | 작업 |
| --- | --- | --- |
| `common/board/service/BoardCommentService.java` | 미사용 import `java.time.LocalDate`(L24) 제거 | Modify |
| `infra/file/service/FileService.java` | 미사용 필드 `FL_MNG_NO_RETRY`(L126) + 참조 JavaDoc 문장 정리 | Modify |
| `domain/log/entity/BcostmL.java` | `@Column(length)` 12건을 DDL(`TPRMPP_BCOSTL`)에 일치하도록 정정 | Modify |
| `domain/log/listener/AuditLogEvent.java` | 미사용 잔재 이벤트 클래스 삭제 | Delete |
| `domain/budget/cost/util/CodeNameMapBuilder.java` | `cId`+`cdvas`→`Map<cdva,cdvaNm>` 공통 헬퍼(@Component) | Create |
| `domain/budget/cost/service/CostService.java` | `buildCodeNameMap` 공통화 호출 + `.toList()` 전환 | Modify |
| `domain/budget/project/service/ProjectService.java` | `buildCodeNameMap` 공통화 호출 + `.toList()` 전환 | Modify |
| `domain/budget/work/repository/BbugtmRepositoryImpl.java` | `sum…DupBg…` 3메서드의 group-by 합산 + Tuple→Map 본문을 private 헬퍼로 추출 | Modify |
| (T17 `.toList()` 스윕) 최대 22파일 | `Collectors.toList()`→`.toList()` (소비자 가변성 확인 통과분만) | Modify |
| `test/.../domain/log/listener/AuditLogIntegrationTest.java` | 감사 로그 리스너→퍼시스터→`*L` INSERT 경로 통합 테스트 | Create |
| `test/.../domain/estimate/repository/EstimateRepositoryIntegrationTest.java` | EstimateRepository JOIN·bbrC·lstYn/delYn 통합 테스트 | Create |
| `test/.../common/notification/repository/CinfmmRepositoryImplTest.java` | Cinfmm inbox/countUnread/markAllRead 테스트 | Create |
| `build.gradle` | (Task 12 결과에 따라) H2 또는 byte-buddy/mockito 핀, 테스트 JVM args | Modify (조건부) |

모든 main 경로 접두사: `it_backend/src/main/java/com/kdb/it/` (테스트는 `it_backend/src/test/java/com/kdb/it/`).
모든 명령은 루트 `it_backend`에서 실행: `cd it_backend && ./gradlew ...`.

---

## Task 1: 미사용 import 제거 (BoardCommentService)

**위험: LOW. 행위 변화 없음. TDD 불필요 — 변경 → 컴파일 → 커밋.**

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/board/service/BoardCommentService.java:24`

**배경(실측):** `java.time.LocalDate`(line 24)는 이 파일 어디에서도 사용되지 않는다(Grep 확인). 반면 `java.util.stream.Collectors`(line 27)는 line 65에서 실제 사용 중이므로 **제거 대상 아님**. 로드맵의 "BoardCommentService 미사용 import"는 line 24의 `LocalDate` 한 줄만 가리킨다.

- [ ] **Step 1: import 제거**

다음 줄을 삭제한다.

```java
import java.time.LocalDate;
```

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL (미사용 import 경고 1건 해소).

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/board/service/BoardCommentService.java && git commit -m "refactor: remove unused LocalDate import in BoardCommentService"
```

---

## Task 2: 미사용 필드 + 참조 JavaDoc 정리 (FileService)

**위험: LOW. 행위 변화 없음.**

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java` (L110–126)

**배경(실측):** `FL_MNG_NO_RETRY`(line 126) 상수는 코드 로직에서 참조되지 않는다. 그러나 `generateFlMpnId()` JavaDoc(line 114–116)이 `{@value #FL_MNG_NO_RETRY}`로 이 상수를 인용한다. 따라서 필드만 삭제하면 `{@value}` 태그가 해소 불가가 되어 Javadoc 경고가 발생한다. 현재 코드에는 재시도 로직이 없으므로(상수가 죽은 코드), **필드와 그 필드를 설명하는 JavaDoc 문장을 함께 제거**한다.

- [ ] **Step 1: 죽은 상수와 참조 JavaDoc 문장 제거**

`generateFlMpnId()`의 JavaDoc에서 재시도 관련 문단을 삭제한다. 변경 전:

```java
    /**
     * 파일매핑ID 채번
     *
     * <p>Oracle 시퀀스(SEQ_CFILEM) 값을 기반으로 생성합니다.</p>
     *
     * <p>시퀀스가 기존 데이터의 최대값보다 작게 재설정되면 PK 충돌(ORA-00001)이
     * 발생할 수 있으므로, INSERT 충돌 시 최대 {@value #FL_MNG_NO_RETRY}회까지
     * 다음 NEXTVAL을 시도하여 자동 회복합니다(`uploadFileInternal`에서 활용).</p>
     *
     * @return 파일매핑ID (예: FL_00000001)
     */
    private String generateFlMpnId() {
        Long seq = fileRepository.getNextSequenceValue();
        return String.format("FL_%08d", seq);
    }

    /** PK 충돌 회복 시 최대 재시도 횟수 (시퀀스가 기존 최대값보다 작게 재설정된 경우 대비) */
    private static final int FL_MNG_NO_RETRY = 5;
```

변경 후:

```java
    /**
     * 파일매핑ID 채번
     *
     * <p>Oracle 시퀀스(SEQ_CFILEM) 값을 기반으로 생성합니다.</p>
     *
     * @return 파일매핑ID (예: FL_00000001)
     */
    private String generateFlMpnId() {
        Long seq = fileRepository.getNextSequenceValue();
        return String.format("FL_%08d", seq);
    }
```

> 주의: 만약 재시도 로직을 **실제로 구현**할 의도가 있다면 이 정리는 보류하고 별도 기능 과제로 분리한다. 본 Task는 "죽은 상수 제거"가 목적이다.

- [ ] **Step 2: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/infra/file/service/FileService.java && git commit -m "refactor: drop unused FL_MNG_NO_RETRY constant and stale javadoc in FileService"
```

---

## Task 3: BcostmL `@Column(length)` 정정

**위험: LOW–MEDIUM. 메타데이터 정정(런타임 행위 영향 없음; `ddl-auto=update`는 컬럼을 축소하지 않음). 정확성 검증이 핵심.**

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/BcostmL.java`
- 참조(DDL 권위): `it_database/ITPOWN_DDL_live.sql` (테이블 `TPRMPP_BCOSTL`)

**배경(실측):** `BcostmL`(`@Table(name="TPRMPP_BCOSTL")`)의 `@Column(length)` 12개가 실제 DDL과 불일치한다. 대부분 엔티티가 DB보다 **넓게** 선언되어 있다. JPA `@Column(length)`는 문서·DDL 생성 메타데이터이므로 정확성 차원의 정정이다.

- [ ] **Step 1: DDL 대조 재확인(권위 확인)**

Run:
```bash
cd it_backend && grep -nE "VARCHAR2|TPRMPP_BCOSTL" ../it_database/ITPOWN_DDL_live.sql | head -60
```
실제 DDL의 컬럼별 길이를 **이 출력으로 직접 확인**한 뒤 아래 표를 검증한다(스펙을 그대로 신뢰하지 말 것).

| 필드 | 현재 `@Column` | DDL(`TPRMPP_BCOSTL`) | 정정값 |
| --- | --- | --- | --- |
| `costBgNo` (`BG_NO`) | length 32 | `VARCHAR2(15 CHAR)` | **15** |
| `lstYn` (`LST_YN`) | length 4 | `VARCHAR2(1 CHAR)` | **1** |
| `ioeC` (`IOE_C`) | length 3 | `VARCHAR2(7 CHAR)` | **7** |
| `cttNm` (`CTT_NM`) | length 800 | `VARCHAR2(100 CHAR)` | **100** |
| `dfrCleC` (`DFR_CLE_C`) | length 3 | `VARCHAR2(1 CHAR)` | **1** |
| `sectSysUtzYn` (`SECT_SYS_UTZ_YN`) | length 4 | `VARCHAR2(1 CHAR)` | **1** |
| `indRsn` (`IND_RSN`) | length 600 | `VARCHAR2(200 CHAR)` | **200** |
| `cgprId` (`CGPR_ID`) | length 32 | `VARCHAR2(14 CHAR)` | **14** |
| `costSvnDpmC` (`SVN_DPM_C`) | length 3 | `VARCHAR2(20 CHAR)` | **20** |
| `bgUntAbusC` (`BG_UNT_ABUS_C`) | length 100 | `VARCHAR2(3 CHAR)` | **3** |
| `tmnYn` (`TMN_YN`) | length 100 | `VARCHAR2(1 CHAR)` | **1** |
| `abusTc` (`ABUS_TC`) | length 100 | `VARCHAR2(2 CHAR)` | **2** |

> `cttOppNm`(100), `curC`(3), `svnTemC`(5), `bseYy`(4)는 이미 일치 → 변경 금지.

- [ ] **Step 2: 12개 `length` 속성 정정**

각 필드의 `length=` 값만 위 표의 정정값으로 변경한다(이름·comment 유지). 예:

변경 전:
```java
    @Column(name = "BG_NO", length = 32, comment = "전산업무비코드")
    private String costBgNo;
```
변경 후:
```java
    @Column(name = "BG_NO", length = 15, comment = "전산업무비코드")
    private String costBgNo;
```

나머지 11개도 동일 패턴으로 정정(`LST_YN`→1, `IOE_C`→7, `CTT_NM`→100, `DFR_CLE_C`→1, `SECT_SYS_UTZ_YN`→1, `IND_RSN`→200, `CGPR_ID`→14, `SVN_DPM_C`→20, `BG_UNT_ABUS_C`→3, `TMN_YN`→1, `ABUS_TC`→2).

- [ ] **Step 3: 마스터 엔티티 드리프트 확인(권장)**

Run:
```bash
cd it_backend && grep -nE "length" src/main/java/com/kdb/it/domain/budget/cost/entity/Bcostm.java | head -40
```
`Bcostm`(마스터)에 동일 드리프트가 있으면 후속 정리 대상으로 `TASK.md`에 메모(본 Task 범위는 `BcostmL`만).

- [ ] **Step 4: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/log/entity/BcostmL.java && git commit -m "fix: correct BcostmL @Column lengths to match TPRMPP_BCOSTL DDL"
```

---

## Task 4: 잔재 이벤트 클래스 삭제 (AuditLogEvent)

**위험: LOW. 미사용 코드 삭제. 삭제 후 컴파일로 미참조 확정.**

**Files:**
- Delete: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogEvent.java`

**배경(실측):** `AuditLogEvent`는 `@TransactionalEventListener(BEFORE_COMMIT)` 기반 설계의 잔재다. 실제 감사 로그는 `ChangeLogEntityListener → AuditLogPersister.persist()` 동기 경로(§5.12.1)가 담당하며, `new AuditLogEvent(...)` 인스턴스화도 `publishEvent(...)` 호출도 `src/main` 전역에 **0건**이다(Grep 확인). 또한 접근자 `getChgTc()`가 필드 `chgTp`와 이름이 어긋나 record 변환 시 호환 문제까지 있다. 로드맵의 "record 변환"보다 **삭제**가 정확하다. "잔여 이벤트 주석 정리"는 별도 주석 잔재가 없으므로(Grep 0건) 본 삭제로 충족된다.

- [ ] **Step 1: 사용처 0건 재확인 (삭제 전 게이트)**

Run:
```bash
cd it_backend && grep -rn "AuditLogEvent" src/main src/test
```
Expected: **자기 자신 선언만** 출력(`AuditLogEvent.java` 내부 라인) — 외부 참조가 있으면 삭제를 중단하고 재평가한다.

- [ ] **Step 2: 파일 삭제**

```bash
cd it_backend && git rm src/main/java/com/kdb/it/domain/log/listener/AuditLogEvent.java
```

- [ ] **Step 3: 컴파일 확인**

Run: `cd it_backend && ./gradlew compileJava compileTestJava`
Expected: BUILD SUCCESSFUL (미참조였으므로 깨짐 없음).

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git commit -m "refactor: delete unused AuditLogEvent (audit log uses synchronous listener path)"
```

---

## Task 5: `buildCodeNameMap` 공통 헬퍼 추출

**위험: MEDIUM. 행위 보존 리팩토링이나 두 호출처 동작이 미세하게 다름 → TDD로 안전망 후 추출.**

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilder.java`
- Create test: `it_backend/src/test/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilderTest.java`
- Modify: `CostService.java`(L799–804), `ProjectService.java`(L977–981)

**배경(실측):** `buildCodeNameMap`이 두 서비스에 중복되며 **본문이 동일하지 않다**:
- `CostService`(L799): null/empty 가드 + `c.getCdvaNm() != null` 필터 보유(안전 superset).
- `ProjectService`(L977): 두 가드 모두 없음 → `cdvaNm`이 null이면 `Collectors.toMap`에서 NPE 가능.

공통 헬퍼는 **CostService의 안전 변형**을 채택한다(가드 추가는 ProjectService 입장에서 동작 강화이며, null 코드명을 맵에서 제외하는 것은 표시용 매핑에서 합당). 헬퍼는 `CcodemRepository`에 의존하므로 정적 유틸이 아니라 `@Component`로 둔다.

- [ ] **Step 1: 헬퍼 단위 테스트 작성 (RED)**

Create `it_backend/src/test/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilderTest.java`:

```java
package com.kdb.it.domain.budget.cost.util;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CcodemRepository;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * CodeNameMapBuilder 단위 테스트 — cdva 필터, null 코드명 제외, 빈 입력 가드 검증.
 */
@ExtendWith(MockitoExtension.class)
class CodeNameMapBuilderTest {

    @Mock
    private CcodemRepository ccodemRepository;

    private CodeNameMapBuilder sut() {
        return new CodeNameMapBuilder(ccodemRepository);
    }

    // 주의: Ccodem 픽스처 생성 방식(@Setter vs @Builder)을 실제 엔티티에서 확인 후 맞춘다.
    private Ccodem code(String cdva, String cdvaNm) {
        Ccodem c = new Ccodem();
        c.setCdva(cdva);
        c.setCdvaNm(cdvaNm);
        return c;
    }

    @Test
    @DisplayName("cdvas가 비어 있으면 빈 맵을 반환한다")
    void emptyCdvas_returnsEmptyMap() {
        assertThat(sut().build("IOE_C", Set.of())).isEmpty();
    }

    @Test
    @DisplayName("지정한 cdva만 cdva→cdvaNm으로 매핑한다")
    void filtersByCdva() {
        given(ccodemRepository.findByCIdWithValidDate("IOE_C", null))
                .willReturn(List.of(code("100", "사업"), code("200", "전산업무비")));

        Map<String, String> result = sut().build("IOE_C", Set.of("100"));

        assertThat(result).containsExactlyEntriesOf(Map.of("100", "사업"));
    }

    @Test
    @DisplayName("코드명이 null인 항목은 맵에서 제외한다")
    void excludesNullCodeName() {
        given(ccodemRepository.findByCIdWithValidDate("IOE_C", null))
                .willReturn(List.of(code("100", null), code("200", "전산업무비")));

        Map<String, String> result = sut().build("IOE_C", Set.of("100", "200"));

        assertThat(result).containsExactlyEntriesOf(Map.of("200", "전산업무비"));
    }
}
```

> 주의: `Ccodem`의 실제 setter/생성 방식을 먼저 확인한다(`grep -n "class Ccodem" -A40 .../Ccodem.java`). Lombok `@Setter`가 없으면 빌더(`Ccodem.builder()...`)로 픽스처를 바꾼다. `findByCIdWithValidDate` 시그니처도 `CcodemRepository`에서 확인 후 두 번째 인자(`null`)를 맞춘다.

- [ ] **Step 2: 테스트 실패 확인 (RED)**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.cost.util.CodeNameMapBuilderTest"`
Expected: 컴파일 실패 — `CodeNameMapBuilder` 심볼 없음.

- [ ] **Step 3: 헬퍼 구현 (GREEN)**

Create `it_backend/src/main/java/com/kdb/it/domain/budget/cost/util/CodeNameMapBuilder.java`:

```java
package com.kdb.it.domain.budget.cost.util;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CcodemRepository;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

/**
 * 공통코드 {@code cId} 기준으로 지정한 {@code cdva} 집합을 {@code cdva → CDVA_NM} 맵으로 만든다.
 *
 * <p>예산/사업 서비스에서 비목·구분 코드 표시명을 한 번에 조회하기 위한 공통 헬퍼.
 * {@code cdvas}가 비어 있으면 빈 맵을 반환하고, 코드명이 null인 항목은 제외한다(표시용 매핑).</p>
 */
@Component
@RequiredArgsConstructor
public class CodeNameMapBuilder {

    private final CcodemRepository ccodemRepository;

    /**
     * @param cId   공통코드 ID(예: {@code IOE_C})
     * @param cdvas 매핑 대상 코드값 집합. null/빈 집합이면 빈 맵 반환.
     * @return {@code cdva → CDVA_NM} 맵(코드명 null 항목 제외, 중복 키는 선순위 유지)
     */
    public Map<String, String> build(String cId, Set<String> cdvas) {
        if (cdvas == null || cdvas.isEmpty()) {
            return Map.of();
        }
        return ccodemRepository.findByCIdWithValidDate(cId, null).stream()
                .filter(c -> cdvas.contains(c.getCdva()) && c.getCdvaNm() != null)
                .collect(Collectors.toMap(Ccodem::getCdva, Ccodem::getCdvaNm, (a, b) -> a));
    }
}
```

- [ ] **Step 4: 테스트 통과 확인 (GREEN)**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.cost.util.CodeNameMapBuilderTest"`
Expected: PASS (3 tests).

- [ ] **Step 5: CostService를 헬퍼로 위임**

`CostService`에 필드 주입 추가(`@RequiredArgsConstructor`이면 `private final CodeNameMapBuilder codeNameMapBuilder;` 한 줄 추가) 후, private `buildCodeNameMap(String, Set<String>)` 메서드(L799–804)를 제거하고 호출처(L592·594·596·598·776·778·780)를 `codeNameMapBuilder.build(...)`로 치환한다.

변경 전(메서드):
```java
    /** C_ID 기준 cdva→CDVA_NM 맵 생성 (지정 cdva만 필터링, 코드명 null은 제외) */
    private Map<String, String> buildCodeNameMap(String cId, Set<String> cdvas) {
        if (cdvas == null || cdvas.isEmpty()) return Map.of();
        return ccodemRepository.findByCIdWithValidDate(cId, null).stream()
                .filter(c -> cdvas.contains(c.getCdva()) && c.getCdvaNm() != null)
                .collect(Collectors.toMap(Ccodem::getCdva, Ccodem::getCdvaNm, (a, b) -> a));
    }
```
변경 후: (메서드 삭제, 호출부를 `codeNameMapBuilder.build(cId, cdvas)`로 변경)

> `ccodemRepository`가 CostService의 다른 곳에서 더는 쓰이지 않으면 해당 필드도 함께 제거(컴파일/사용처 확인 후). 사용처가 남아 있으면 유지.

- [ ] **Step 6: ProjectService를 헬퍼로 위임**

동일하게 `ProjectService`에 `CodeNameMapBuilder` 주입, private `buildCodeNameMap`(L977–981) 제거, 호출처(L763–769)를 `codeNameMapBuilder.build(...)`로 치환.

> **동작 차이 주의:** ProjectService의 기존 호출이 null `cdvaNm`을 맵에 포함하길 기대하는 곳은 없어야 한다(맵은 표시명 lookup 용도). 호출처 사용 흐름을 읽어 null 키 제외가 안전한지 확인한 뒤 치환한다.

- [ ] **Step 7: 영향 테스트 + 컴파일**

Run:
```bash
cd it_backend && ./gradlew compileJava \
  && ./gradlew test --tests "com.kdb.it.domain.budget.cost.*" --tests "com.kdb.it.domain.budget.project.*"
```
Expected: BUILD SUCCESSFUL.

- [ ] **Step 8: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget src/test/java/com/kdb/it/domain/budget && git commit -m "refactor: extract CodeNameMapBuilder shared helper from Cost/Project services"
```

---

## Task 6: BbugtmRepositoryImpl 합산 본문 헬퍼 추출

**위험: MEDIUM. QueryDSL 본문 공통화 — 회귀 위험 존재 → 추출 전후 동작 보존 확인.**

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryImpl.java`

**배경(실측):** `sumAssetDupBgByPrjMngNos`(L275–304), `sumCostDupBgByPrjMngNos`(L309–338), `sumDupBgByPrjMngNos`(L211–240) 세 메서드가 **BBUGTM×BITEMM group-by-abusMngNo 합산 + Tuple→Map** 골격을 거의 그대로 반복한다. Asset/Cost 변형은 `bitemm.ioeC.in(...)` 필터 유무·파라미터명만 다르다. 공통 본문을 private 헬퍼로 추출해 3중복을 1개로 줄인다.

> **순서 원칙(systematic refactoring):** 이 모듈에 동작 보존을 검증할 테스트가 없다. 추출을 **순수 기계적(본문 이동만, 조건/순서 불변)** 으로 제한하고 Step 4 diff 리뷰로 보장한다.

- [ ] **Step 1: 공통 헬퍼 추출 (기계적)**

`BbugtmRepositoryImpl`에 private 헬퍼를 추가한다. `ioeC` 필터는 선택적으로 받는다(null/empty면 미적용):

```java
    /**
     * BBUGTM(중복편성) × BITEMM 조인 후 abusMngNo 별 {@code bgDupAmt} 합계를 구한다.
     *
     * @param prjMngNos  사업관리번호 목록(비면 빈 맵)
     * @param bgYy       기준연도
     * @param ioeCodes   비목코드 필터. null/빈 집합이면 비목 조건 미적용.
     * @return abusMngNo → 합계(없으면 0)
     */
    private Map<String, BigDecimal> sumDupBgByIoe(
            List<String> prjMngNos, String bgYy, Set<String> ioeCodes) {
        if (prjMngNos == null || prjMngNos.isEmpty()) {
            return Map.of();
        }
        QBbugtm bbugtm = QBbugtm.bbugtm;
        QBitemm bitemm = QBitemm.bitemm;

        BooleanBuilder where = new BooleanBuilder()
                .and(bbugtm.bseYy.eq(bgYy))
                .and(bbugtm.fntTbNm.eq("BITEMM"))
                .and(bitemm.abusMngNo.in(prjMngNos))
                .and(bbugtm.delYn.eq("N"))
                .and(bitemm.delYn.eq("N"))
                .and(bitemm.lstYn.eq("Y"));
        if (ioeCodes != null && !ioeCodes.isEmpty()) {
            where.and(bitemm.ioeC.in(ioeCodes));
        }

        List<Tuple> results = queryFactory
                .select(bitemm.abusMngNo, bbugtm.bgDupAmt.sum())
                .from(bbugtm)
                .join(bitemm).on(
                        bbugtm.pkColNm.eq(bitemm.gclMngNo),
                        bbugtm.fntTbCrySno.eq(bitemm.sno))
                .where(where)
                .groupBy(bitemm.abusMngNo)
                .fetch();

        Map<String, BigDecimal> map = new HashMap<>();
        for (Tuple t : results) {
            String key = t.get(bitemm.abusMngNo);
            BigDecimal sum = t.get(bbugtm.bgDupAmt.sum());
            if (key != null) {
                map.put(key, sum != null ? sum : BigDecimal.ZERO);
            }
        }
        return map;
    }
```

> `where`를 `where(...)` 가변인자에서 `BooleanBuilder`로 바꾸는 것이 유일한 형태 변화다. 조건 집합·조인·groupBy·Tuple 처리는 원본과 **완전히 동일**해야 한다. `BooleanBuilder` import 누락 시 추가.

- [ ] **Step 2: 세 public 메서드를 헬퍼 위임으로 축약**

```java
    @Override
    public Map<String, BigDecimal> sumAssetDupBgByPrjMngNos(
            List<String> prjMngNos, String bgYy, Set<String> assetGclDttCodes) {
        if (assetGclDttCodes == null || assetGclDttCodes.isEmpty()) {
            return Map.of();
        }
        return sumDupBgByIoe(prjMngNos, bgYy, assetGclDttCodes);
    }

    @Override
    public Map<String, BigDecimal> sumCostDupBgByPrjMngNos(
            List<String> prjMngNos, String bgYy, Set<String> costGclDttCodes) {
        if (costGclDttCodes == null || costGclDttCodes.isEmpty()) {
            return Map.of();
        }
        return sumDupBgByIoe(prjMngNos, bgYy, costGclDttCodes);
    }

    @Override
    public Map<String, BigDecimal> sumDupBgByPrjMngNos(List<String> prjMngNos, String bgYy) {
        return sumDupBgByIoe(prjMngNos, bgYy, null);
    }
```

> Asset/Cost는 원래 "비목 코드 집합이 비면 빈 맵"이라는 **추가 가드**가 있었으므로 public 메서드에 유지한다(헬퍼의 null=미필터 동작과 의미가 다르기 때문). `sumDupBgByPrjMngNos`(필터 없음)는 원본에 ioeC 가드가 없었으므로 그대로 위임. 단, `sumDupBgByPrjMngNos`의 실제 시그니처(파라미터)를 원본 L211에서 재확인 후 맞춘다.

- [ ] **Step 3: 컴파일**

Run: `cd it_backend && ./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 4: diff 리뷰 게이트 (동작 보존 확인)**

Run: `cd it_backend && git diff src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryImpl.java`
확인 항목: (a) 세 메서드의 where 조건 집합이 추출 전과 1:1 동일, (b) Asset/Cost의 빈-집합 가드 보존, (c) 조인 on 절·groupBy·정렬 불변. 하나라도 어긋나면 되돌린다.

- [ ] **Step 5: 영향 테스트**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.budget.work.*"`
Expected: 기존 테스트 PASS(있다면). 없으면 컴파일 + diff 게이트로 갈음.

- [ ] **Step 6: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/work/repository/BbugtmRepositoryImpl.java && git commit -m "refactor: collapse duplicated dup-budget sum queries in BbugtmRepositoryImpl"
```

---

## Task 7: DomainTargetResolver — 보류(No-op) 명시

**위험: NONE. 코드 변경 없음.**

**배경(실측):** 로드맵 T17의 "DomainTargetResolver @Component 추출"은 **추출 대상 인라인 코드가 현재 소스에 존재하지 않는다**(Grep 결과 소스 0건, 문서 참조만). 추출할 실체가 없으므로 임의의 컴포넌트를 발명하지 않는다.

- [ ] **Step 1: 부재 재확인**

Run: `cd it_backend && grep -rn "DomainTargetResolver" src`
Expected: 0건.

- [ ] **Step 2: 백로그 메모**

`TASK.md`의 해당 줄에 "Phase 5 착수 시 소스 부재 확인(2026-06-22) — 추출 대상 인라인 로직이 식별되면 재등록" 한 줄을 남기고, 본 계획에서는 변경하지 않는다(커밋 없음, Task 16의 백로그 정리에서 일괄 반영).

---

## Task 8~11: `Collectors.toList()` → `.toList()` 스윕 (패키지별 커밋)

**위험: MEDIUM. `.toList()`는 불변 리스트를 반환하므로 일괄 치환 금지. 각 호출처마다 결과가 이후 변경(add/remove/set/sort/clear)되지 않는지 확인 후에만 치환.**

**실측:** `Collectors.toList()` 총 **51건 / 22파일**. 기계적 전체 치환은 금지하며, 호출처별 가변성 점검을 거친다.

### 가변성 점검 절차 (각 호출처 공통)

각 `Collectors.toList()` 한 건마다:
1. 결과가 담기는 변수/표현식을 식별한다.
2. 그 결과에 대해 다음 중 하나라도 일어나면 **치환 제외**(원형 유지 또는 `new ArrayList<>(...)`로 명시):
   - `.add(...)`, `.remove(...)`, `.set(...)`, `.clear(...)`, `.addAll(...)`, `.sort(...)`, `Collections.sort(...)`, `.removeIf(...)`
   - 메서드 밖으로 반환되어 **호출자가 변경**할 수 있는 경우(반환 후 사용처까지 추적)
   - `List` 필드에 저장되어 이후 변경되는 경우
3. 위 어디에도 해당하지 않으면(즉시 소비/조회 전용/다른 read-only 호출에 전달) **`.collect(Collectors.toList())` → `.toList()`** 로 치환한다.
4. 파일 내 `Collectors` 사용이 모두 사라지면 `import java.util.stream.Collectors;` 도 제거한다(단, `Collectors.toMap`/`toSet`/`groupingBy` 등이 남아 있으면 import 유지).

### 점검용 Grep

대상 식별:
```bash
cd it_backend && grep -rn "Collectors.toList()" src/main
```
각 후보 파일에서 변경 호출 흔적 탐색(가변성 1차 스크리닝):
```bash
cd it_backend && grep -nE "\.(add|remove|set|sort|clear|addAll|removeIf)\(|Collections\.sort" src/main/java/<대상파일>
```
(스크리닝은 보조 신호일 뿐, 변수 단위 추적이 최종 판단이다.)

### 워크드 예시 (실측 3건)

**예시 A — 치환 가능: `OrganizationService.getOrganizations()` (L46–50)**
```java
    public List<OrganizationDto.Response> getOrganizations() {
        return organizationRepository.findAll().stream()
                .map(OrganizationDto.Response::fromEntity)
                .collect(Collectors.toList());          // ← 즉시 return, 호출자 변경 없음(조회 응답)
    }
```
결과가 곧바로 반환되고 컨트롤러 응답으로만 직렬화된다 → 변경 없음 → **`.toList()` 치환 가능**. 치환 후 이 파일에 다른 `Collectors.*`가 없으면 import도 제거.
```java
        return organizationRepository.findAll().stream()
                .map(OrganizationDto.Response::fromEntity)
                .toList();
```

**예시 B — 치환 가능(중간 변수, read-only 전달): `PlanService` (L83–92)**
```java
        List<String> userEnos = plans.stream()
                .map(Bplanm::getFstEnrUsid)
                .filter(eno -> eno != null && !eno.isBlank())
                .distinct()
                .collect(Collectors.toList());          // ← 아래에서 findAllById 인자로만 사용(읽기)
        Map<String, String> userNameByEno = userEnos.isEmpty()
                ? Map.of()
                : cuserIRepository.findAllById(userEnos).stream() ...
```
`userEnos`는 `findAllById(...)`(JPA 조회 입력)로만 전달되고 변경되지 않는다 → **`.toList()` 치환 가능**. (단, PlanService에는 `Collectors.toMap`이 다수 남으므로 import는 유지.)

**예시 C — 치환 전 추적 필요: `ScheduleService` (L116·128·163)**
세 곳의 결과가 각각 어디로 흘러가는지(중첩 빌드의 중간 리스트인지, 빌더에 set 되는지, 정렬되는지)를 변수 단위로 추적해야 한다. `116`은 내부 리스트를 다시 매핑/수집하는 중간값으로 보이며, 외부로 노출돼 변경되지 않으면 치환 가능. **반환 리스트가 컨트롤러에서 정렬/추가되는 패턴이 있으면 제외.** 추적 결과를 커밋 메시지나 PR 본문에 한 줄로 남긴다.

### 커밋 그룹핑 (패키지 단위)

리뷰 가능성을 위해 패키지별로 커밋을 나눈다. 각 그룹은 **치환 → `compileJava` → 해당 패키지 테스트(있으면) → 커밋** 순으로 진행한다.

- [ ] **Task 8 — `common/*` 패키지** (`FileService`는 infra라 Task 11)
  - 대상: `common/iam`(UserService L56, OrganizationService L49), `common/code`(CodeService L45·74), `common/board`(BoardPostService L65, BoardMetaService L30, BoardCommentService L65), `common/system`(LoginHistoryDto L97, AuthService L359), `common/approval`(ApplicationDto L332).
  - 각 호출처 가변성 점검 후 치환. `Collectors`가 완전히 사라지는 파일만 import 제거.
  - Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.common.*"`
  - Commit: `refactor: use Stream.toList() for immutable results in common services`

- [ ] **Task 9 — `domain/budget/*` 패키지**
  - 대상: `cost/service/CostService`(L153·181·411·642·666; L544·556은 `.distinct().collect`/`.map(...).collect` — 변수 추적 필수), `project/service/ProjectService`(L130·163·199·664·712·723·963), `project/service/ProjectBudgetSummaryService`(L55·91), `document/service/ServiceRequestDocService`(L81·129), `document/service/ReviewCommentService`(L47), `plan/service/PlanService`(L87·144·169·370·385·394·411·425).
  - **주의:** `ProjectService` L712/L723, `CostService` L544/L556은 결과 리스트가 이후 `findBy...In`/`distinct` 입력으로 쓰이는 중간값일 가능성이 큼 — 읽기 전용이면 치환, 변경되면 제외.
  - Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.budget.*"`
  - Commit: `refactor: use Stream.toList() for immutable results in budget domain`

- [ ] **Task 10 — `domain/council/*` + `domain/menu/*` 패키지**
  - 대상: `council/service`(ScheduleService L116·128·163, FeasibilityService L226, EvaluationService L102·134·281, CouncilService L120·127·134·260), `menu/service`(MenuQueryService L47, BoardListMenuResolver L34).
  - **주의:** council 서비스들은 목록·정렬 가공이 잦다 — 예시 C 절차로 각 건 추적.
  - Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.domain.council.*" --tests "com.kdb.it.domain.menu.*"`
  - Commit: `refactor: use Stream.toList() for immutable results in council/menu domain`

- [ ] **Task 11 — `infra/file/*` 패키지**
  - 대상: `FileService` L242 (`return list.stream().map(this::toResponse).collect(Collectors.toList());`). 즉시 return·조회 응답 → 치환 가능성 높음. 반환 후 컨트롤러에서 변경하지 않는지 호출자 1단계 확인 후 치환.
  - Run: `cd it_backend && ./gradlew compileJava && ./gradlew test --tests "com.kdb.it.infra.*"`
  - Commit: `refactor: use Stream.toList() for immutable results in file service`

> 어떤 호출처든 **변경되는 리스트**로 판명되면 `.toList()` 대신 그대로 두거나, 의도가 "가변 복사본"이면 `.collect(Collectors.toCollection(ArrayList::new))`로 의도를 명시한다. 불확실하면 보수적으로 **치환하지 않는다**.

---

## Task 12: 테스트 대량 실패(`NoClassDefFoundError`) 원인 규명 — 스파이크

> **SUB-SKILL:** Use superpowers:systematic-debugging. 가설을 세우기 전에 **실제 실패를 재현·관측**한다. 이 Task는 수정이 아니라 **진단**이 목적이며, 근본 원인 없는 추측 수정 금지.

**위험: 조사 Task. 산출물은 근본 원인 진단 + 최소 수정 제안(또는 적용).**

**Files (조건부):**
- Read: `it_backend/build.gradle`, `it_backend/src/test/resources/application-test.properties`
- Modify(원인 확정 시): `build.gradle`

**배경(실측):**
- 빌드: Java 25 toolchain, Spring Boot 4.1.0. 테스트 의존성은 **`spring-boot-starter-test`가 아니라** Boot 4의 분리 스타터(`spring-boot-starter-data-jpa-test`, `-security-test`, `-webmvc-test`, `-actuator-test`, `restdocs`)로 구성. Mockito/byte-buddy/JUnit/AssertJ는 **BOM을 통해 전이(transitive)** 로만 들어오며 **버전 핀이 없다**.
- 테스트 JVM args 없음(`--add-opens`/`-javaagent`/`jvmArgs` 미설정). `mockito-extensions/org.mockito.plugins.MockMaker` 리소스 없음.
- H2/Testcontainers **의존성 없음**. `application-test.properties`는 DataSource/Hibernate/JPA 오토컨피그를 **제외**하고 Flyway를 끈다(순수 단위 테스트 전제).
- 의심 1순위: **byte-buddy가 JDK 25 클래스파일/런타임을 다루기에 너무 오래된 전이 버전** → Mockito 목 생성 시 `NoClassDefFoundError`/`IllegalStateException` 계열. JDK 25에서 Mockito inline mock-maker의 self-attach가 경고/실패할 수 있어 `-XX:+EnableDynamicAgentLoading` 또는 명시적 `-javaagent`가 필요할 수 있음(현재 미설정).

### 진단 절차

- [ ] **Step 1: 실패 재현 및 정확한 클래스명 캡처**

Run:
```bash
cd it_backend && ./gradlew clean test --no-build-cache 2>&1 | tee /tmp/phase5-test-run.log
```
로그에서 **첫 번째** 실패의 `NoClassDefFoundError: <FQCN>` / `Caused by:` 체인을 그대로 인용해 기록한다(추정 금지, 실제 메시지 기준). 실패가 특정 테스트군에 국한되는지 전역인지 구분한다.

- [ ] **Step 2: 전이 의존성 버전 관측**

Run:
```bash
cd it_backend && ./gradlew -q dependencies --configuration testRuntimeClasspath > /tmp/phase5-testdeps.txt
grep -nE "byte-buddy|mockito|junit|assertj|objenesis" /tmp/phase5-testdeps.txt
```
해석된 `net.bytebuddy:byte-buddy`, `byte-buddy-agent`, `org.mockito:mockito-core` 버전을 기록한다. byte-buddy가 JDK 25 미지원 버전이면(실제 해석값 기준으로 판단) 1순위 가설 확정.

- [ ] **Step 3: 가설별 분기**

`NoClassDefFoundError`의 FQCN에 따라:
- **`net.bytebuddy.*` 또는 Mockito 내부 클래스** → byte-buddy 버전 문제. 수정안: build.gradle 주석(L71–75) 권장대로 BOM property 오버라이드로 byte-buddy를 JDK 25 지원 버전으로 핀(`ext['byte-buddy.version'] = '<지원버전>'`). 필요 시 `mockito-core` 명시 의존성 추가.
- **`org.h2.*` 또는 DataSource/JPA 관련** → `@DataJpaTest` 류가 임베디드 DB를 찾다 실패. 단위 테스트만 깨졌다면 잘못 활성화된 오토컨피그 의심. 수정안: 해당 테스트에 적절한 슬라이스/제외 적용 또는 H2 추가(Task 13 인프라와 연계).
- **`javaagent`/dynamic agent 경고가 에러로 승격** → `test` 태스크에 `jvmArgs '-XX:+EnableDynamicAgentLoading'`(및 필요 시 `-javaagent:<byte-buddy-agent.jar>`) 추가.
- 그 외 FQCN → 해당 모듈을 `dependencies`에서 역추적해 누락/충돌 식별.

- [ ] **Step 4: 최소 수정 적용 후 재검증**

가설에 해당하는 **최소 변경 하나만** 적용하고:
```bash
cd it_backend && ./gradlew clean test 2>&1 | tee /tmp/phase5-test-run-2.log
```
실패 수가 줄거나 사라지는지 확인. 한 번에 하나씩 바꿔 인과를 분리한다(systematic-debugging).

- [ ] **Step 5: 결과 기록 + 커밋(수정이 있었던 경우)**

원인·증거·수정안을 `docs/superpowers/`에 메모하거나 `TASK.md`에 근거(`build.gradle:라인`, 해석 버전)와 함께 남긴다. build.gradle을 고쳤다면:
```bash
cd it_backend && git add build.gradle && git commit -m "fix: pin byte-buddy/configure test JVM for JDK 25 mockito compatibility"
```
> 근본 원인이 불명확하면 수정하지 말고 관측 사실만 기록한 뒤 후속 과제로 등록한다. **추측 수정 금지.**

---

## Task 13: 감사 로그 리스너 통합 테스트

> **전제: Task 12가 테스트 실행 환경을 통과시킨 뒤 착수.** 통합 테스트는 실 JPA 컨텍스트 + `ApplicationContextHolder` 빈이 필요하다.

**위험: MEDIUM. 신규 통합 테스트 인프라 첫 도입.**

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/log/listener/AuditLogIntegrationTest.java`
- 참조(현행 단위 테스트, 대비): `ChangeLogEntityListenerTest.java`(MockedStatic 기반), `AuditLogPersisterTest.java`(@InjectMocks 기반)

**배경(실측):** 현재 감사 로그 검증은 **순수 Mockito 단위 테스트**뿐이다. `ChangeLogEntityListener`는 Spring 빈이 아니라 JPA 엔티티 리스너이며 `ApplicationContextHolder.getBean(AuditLogPersister.class)`로 퍼시스터를 조회한다. 통합 테스트는 **실 영속 흐름**(업무 엔티티 persist → 리스너 → 퍼시스터 → `*L` INSERT)을 한 번이라도 실제로 태운다. 이 코드베이스에는 **기존 `@SpringBootTest`/`@DataJpaTest` 동작 예시가 없으므로**(`ItApplicationTests`는 `@Disabled`) 본 Task가 그 패턴의 기준점이 된다.

- [ ] **Step 1: 테스트 DB 전략 결정 (Task 12 산출물 반영)**

두 경로 중 하나를 택한다(Task 12에서 막힘 원인이 정리된 전제):
- **(A) H2 인메모리** — `build.gradle`에 `testImplementation 'com.h2database:h2'` 추가 + 전용 `application-audit-it.properties`로 JPA/`ddl-auto=create-drop` 활성화. 장점: 빠름/CI 친화. 단점: Oracle 전용 SQL(시퀀스, `CURRENT_SCHEMA`) 미재현.
- **(B) 실 Oracle** — `@AutoConfigureTestDatabase(replace = Replace.NONE)` + 로컬 XE(`connect-db.ps1` 환경). 장점: 운영 동등. 단점: 환경 의존, CI에선 `@Disabled` 또는 태그 분리.

감사 로그 경로는 Oracle 전용 SQL 의존이 적으므로 **(A) H2 우선**, 불가 시 (B).

- [ ] **Step 2: 통합 테스트 작성**

기존 단위 테스트 컨벤션(패키지 미러, `@DisplayName` 한글, AAA 주석, AssertJ)을 따른다. 골격(전략 A 기준):

```java
package com.kdb.it.domain.log.listener;

import static org.assertj.core.api.Assertions.assertThat;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Import;
import org.springframework.security.test.context.support.WithMockUser;
import org.springframework.test.context.ActiveProfiles;

/**
 * 감사 로그 통합 테스트 — 업무 엔티티 persist 시 ChangeLogEntityListener가
 * AuditLogPersister를 통해 짝 *L 로그를 실제 INSERT 하는 전체 경로를 검증한다.
 *
 * <p>단위 테스트({@code ChangeLogEntityListenerTest})는 MockedStatic으로 퍼시스터를
 * 스텁하지만, 본 테스트는 실 JPA 컨텍스트와 ApplicationContextHolder 빈을 기동한다.</p>
 */
@DataJpaTest
@ActiveProfiles("audit-it")
@Import({AuditLogPersister.class, com.kdb.it.common.system.ApplicationContextHolder.class})
class AuditLogIntegrationTest {

    @Autowired
    private EntityManager em;

    @Test
    @WithMockUser(username = "EMP001")
    @DisplayName("@LogTarget 엔티티 INSERT 시 짝 *L 로그가 함께 적재된다")
    void persistLogTarget_writesPairedLogRow() {
        // Arrange: @LogTarget이 부착된 가장 가벼운 업무 엔티티 생성 (NOT NULL 기본값은 생성 시점에 채워져야 함 — §5.12.1.1)
        // Act: em.persist(entity); em.flush();
        // Assert: 짝 *L 테이블 count가 1 증가했는지 JPQL count로 확인
        long before = ((Number) em.createQuery(
                "select count(l) from <PairLogEntity> l").getSingleResult()).longValue();
        // em.persist(...); em.flush();
        long after = ((Number) em.createQuery(
                "select count(l) from <PairLogEntity> l").getSingleResult()).longValue();
        assertThat(after).isEqualTo(before + 1);
    }
}
```

> 실행자 확정 항목: (1) `ApplicationContextHolder`의 정확한 패키지·빈 등록 방식(리스너가 정적 `getBean`으로 의존하므로 컨텍스트에 반드시 노출 — `@Import` 또는 `@TestConfiguration`), (2) 가장 가벼운 `@LogTarget` 엔티티와 그 `*L` 짝 선택(`<PairLogEntity>`를 실제 엔티티명으로 치환; NOT NULL 기본값이 생성 시점에 채워지는지 §5.12.1.1 확인 — 그렇지 않으면 H2에서도 제약 위반), (3) H2에서 Oracle 전용 채번(시퀀스)이 없는 엔티티를 고를 것. Oracle 전용 채번이 끼면 전략 (B)로 전환.

- [ ] **Step 3: 실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.listener.AuditLogIntegrationTest"`
Expected: PASS(전략 A). 전략 B면 로컬 Oracle 기동 후 실행, CI에서는 `@Disabled` 또는 커스텀 태그.

- [ ] **Step 4: 커밋**

```bash
cd it_backend && git add src/test/java/com/kdb/it/domain/log/listener/AuditLogIntegrationTest.java build.gradle src/test/resources/ && git commit -m "test: add audit-log listener integration test (real JPA persist path)"
```

---

## Task 14: EstimateRepository 통합 테스트

> **전제: Task 12 통과 + Task 13에서 정립한 DB 전략 재사용.**

**위험: MEDIUM.**

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryIntegrationTest.java`
- 참조(현행, 인터페이스 모킹뿐): `EstimateRepositoryTest.java`

**배경(실측):** `EstimateRepositoryImpl.search(stsTc, cncdRfrNo, bbrC)`는 `Bestim LEFT JOIN Bprojm`(on `p.abusMngNo = e.cncdRfrNo AND p.lstYn='Y' AND p.delYn='N'`) 후 `e.delYn='N'`, `e.lstYn='Y'`, 선택적 `bbrC`(→`p.svnDpmC`) 조건으로 `EstimateDto.ListItem`을 프로젝션한다. **bbrC 부서 필터가 실제 SQL 조건으로 적용되는 유일한 4단계 리포지토리**(§5.18). 현재 테스트는 인터페이스 자체를 모킹해 SQL/JOIN을 전혀 검증하지 않는다. 통합 테스트로 JOIN·bbrC·lstYn/delYn 필터의 실제 동작을 확인한다.

> Oracle 전용 주의: `nextDocSeq()`는 `SELECT SEQ_BESTIM.NEXTVAL FROM DUAL` — H2에서 미동작. 본 테스트는 `search(...)`만 대상으로 하므로 시퀀스를 건드리지 않게 픽스처를 `em.persist`로 직접 적재한다(채번 우회). 시퀀스/`existsBy...` 검증이 필요하면 전략 (B) 실 Oracle.

- [ ] **Step 1: 통합 테스트 작성**

```java
package com.kdb.it.domain.estimate.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.estimate.dto.EstimateDto;
import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * EstimateRepositoryImpl.search 통합 테스트 — Bestim↔Bprojm JOIN, bbrC 부서 필터,
 * lstYn/delYn 조건이 실제 SQL에서 의도대로 동작하는지 검증한다.
 */
@DataJpaTest
@ActiveProfiles("audit-it")
@Import({EstimateRepositoryImpl.class, EstimateRepositoryIntegrationTest.QueryDslTestConfig.class})
class EstimateRepositoryIntegrationTest {

    @TestConfiguration
    static class QueryDslTestConfig {
        @Bean
        JPAQueryFactory jpaQueryFactory(EntityManager em) {
            return new JPAQueryFactory(em);
        }
    }

    @Autowired
    private EntityManager em;
    @Autowired
    private EstimateRepositoryImpl sut;

    @Test
    @DisplayName("bbrC를 지정하면 해당 부서(svnDpmC) 사업과 매칭된 산정만 반환한다")
    void search_withBbrC_filtersByDept() {
        // Arrange: 부서 A/B 사업(Bprojm) + 각 산정(Bestim) 적재 (em.persist + flush)
        // Act
        List<EstimateDto.ListItem> result = sut.search(null, null, "18001");
        // Assert: 부서 18001 매칭분만, lstYn='Y'/delYn='N'만
        assertThat(result).allSatisfy(item -> { /* 부서/상태 검증 */ });
    }

    @Test
    @DisplayName("bbrC가 null이면 부서 제한 없이 유효 산정 전체를 반환한다")
    void search_nullBbrC_returnsAll() {
        // ...
    }
}
```

> 실행자 확정: `Bestim`/`Bprojm` 픽스처는 빌더로 최소 필드(`cncdRfrNo`, `lstYn`, `delYn`, `svnDpmC`, `stsTc`)만 채워 적재. `EstimateDto.ListItem` 생성자 시그니처를 확인해 단언 대상 필드를 맞춘다. `EstimateRepositoryImpl`이 `JPAQueryFactory` 생성자 주입임을 전제로 `QueryDslTestConfig`가 빈을 제공한다.

- [ ] **Step 2: 실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.estimate.repository.EstimateRepositoryIntegrationTest"`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/test/java/com/kdb/it/domain/estimate/repository/EstimateRepositoryIntegrationTest.java && git commit -m "test: add EstimateRepository integration test for join/bbrC/lstYn filters"
```

---

## Task 15: CinfmmRepositoryImplTest 추가

> **전제: Task 12 통과 + DB 전략 재사용.**

**위험: MEDIUM.**

**Files:**
- Create: `it_backend/src/test/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImplTest.java`

**배경(실측):** `CinfmmRepositoryImplTest`는 **현재 존재하지 않는다**. `CinfmmRepositoryImpl`은 `findInbox`(페이징/미읽음 필터), `countUnread`, `markAllReadByRmsEno`(QueryDSL **bulk update** — 영속성 컨텍스트 우회)를 제공한다. 특히 bulk update는 영향 행수와 "이미 읽음/삭제된 행 불변"을 검증할 가치가 큰 통합 대상이다.

- [ ] **Step 1: 통합 테스트 작성**

```java
package com.kdb.it.common.notification.repository;

import static org.assertj.core.api.Assertions.assertThat;

import com.querydsl.jpa.impl.JPAQueryFactory;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

/**
 * CinfmmRepositoryImpl 통합 테스트 — 수신자 inbox 조회, 미읽음 카운트,
 * 일괄 읽음(bulk update)의 영향 행수와 비대상 행 불변을 검증한다.
 */
@DataJpaTest
@ActiveProfiles("audit-it")
@Import({CinfmmRepositoryImpl.class, CinfmmRepositoryImplTest.QueryDslTestConfig.class})
class CinfmmRepositoryImplTest {

    @TestConfiguration
    static class QueryDslTestConfig {
        @Bean
        JPAQueryFactory jpaQueryFactory(EntityManager em) {
            return new JPAQueryFactory(em);
        }
    }

    @Autowired
    private EntityManager em;
    @Autowired
    private CinfmmRepositoryImpl sut;

    @Test
    @DisplayName("countUnread는 본인의 미읽음(inqYn=N, delYn=N)만 센다")
    void countUnread_countsOnlyOwnUnread() {
        // Arrange: rmsEno=EMP001 미읽음 2건, 읽음 1건, 삭제 1건 + 타인 1건 적재 (em.persist + flush)
        // Act
        long count = sut.countUnread("EMP001");
        // Assert
        assertThat(count).isEqualTo(2);
    }

    @Test
    @DisplayName("markAllReadByRmsEno는 본인 미읽음만 읽음 처리하고 영향 행수를 반환한다")
    void markAllRead_updatesOnlyOwnUnread() {
        // Arrange: 미읽음 2건 + 이미읽음 1건
        // Act
        long updated = sut.markAllReadByRmsEno("EMP001");
        em.clear();   // bulk update는 PC 우회 — 재조회 전 컨텍스트 비움
        // Assert: 영향 2건, 이미 읽힌 행은 그대로
        assertThat(updated).isEqualTo(2);
        assertThat(sut.countUnread("EMP001")).isZero();
    }
}
```

> 실행자 확정: `markAllReadByRmsEno`는 bulk update라 영속성 컨텍스트를 갱신하지 않으므로 단언 전 `em.clear()` 필수. `Cinfmm` 픽스처는 `rmsEno`, `inqYn`, `delYn`, `fstEnrDtm` 최소 필드로 적재. 채번(`INF-...`)은 검증 대상이 아니므로 `em.persist`로 PK 직접 지정.

- [ ] **Step 2: 실행**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.notification.repository.CinfmmRepositoryImplTest"`
Expected: PASS.

- [ ] **Step 3: 커밋**

```bash
cd it_backend && git add src/test/java/com/kdb/it/common/notification/repository/CinfmmRepositoryImplTest.java && git commit -m "test: add CinfmmRepositoryImpl integration test (inbox/unread/markAllRead)"
```

---

## Task 16: 통합 검증 & 백로그 동기화

**Files:**
- Modify: `TASK.md`(루트), 필요 시 `TASK_DONE.md`

- [ ] **Step 1: 전체 컴파일 + 테스트**

Run: `cd it_backend && ./gradlew clean compileJava compileTestJava test`
Expected: BUILD SUCCESSFUL(Task 12 이후 환경 기준). 통합 테스트 전략이 (B) 실 Oracle이면 해당 테스트는 환경 가용 시에만 실행되도록 분리됐는지 확인.

- [ ] **Step 2: 백로그 이관**

`TASK.md`의 Phase 5(T17·T18) 항목 중 본 계획에서 처리된 행을 정리한다:
- 완료: `LocalDate` import 제거, `FL_MNG_NO_RETRY` 정리, `BcostmL @Column` 정정, `AuditLogEvent` 삭제, `buildCodeNameMap` 공통화, `BbugtmRepositoryImpl` 합산 추출, `Collectors.toList()` 스윕(치환분), 감사로그/Estimate/Cinfmm 통합 테스트.
- 보류·정정: `DomainTargetResolver`(소스 부재 — Task 7 메모), `AuditLogEvent`는 "record 변환"이 아니라 **삭제**로 처리됨을 한 줄 명시, `Collectors.toList()` 중 **가변 리스트로 판명되어 치환 제외한 호출처** 목록을 남김.
- `NoClassDefFoundError`(Task 12): 근본 원인·수정안(또는 미해결 시 관측 사실)을 근거(`build.gradle:라인`, 해석 버전)와 함께 기록.

- [ ] **Step 3: 커밋**

```bash
cd /c/it && git add TASK.md TASK_DONE.md && git commit -m "docs: sync Phase 5 refactor/test outcomes to backlog"
```

---

## Self-Review

- **Spec coverage:** 로드맵 T17의 9개 묶음 항목과 T18의 4개 항목을 모두 다룬다. 단, 실측으로 **(1) `DomainTargetResolver`는 소스 부재 → 보류(Task 7), (2) `AuditLogEvent`는 미사용 잔재 → record 변환 대신 삭제(Task 4), (3) "잔여 이벤트 주석 정리"는 잔재 주석 0건이라 Task 4 삭제로 충족, (4) `BoardCommentService` 미사용 import는 `Collectors`(사용 중)가 아니라 `LocalDate`(L24)** 로 교정했다. 발명 대신 코드 사실에 맞췄다.
- **Placeholder scan:** 정리·삭제·추출 Task(1~7, 8~11)는 실측 before/after를 인용. 통합 테스트(13~15)는 **이 코드베이스에 기존 통합 테스트 동작 예시가 전무**하여(`@SpringBootTest`는 `@Disabled`, `@DataJpaTest` 0건) 골격 + "실행자 확정 항목"으로 명시했고, 픽스처 세부(`<PairLogEntity>`, DTO 생성자 등)는 의도적으로 실행 시 확인하도록 표시했다. 각 골격은 실측된 메서드 시그니처(`search(stsTc,cncdRfrNo,bbrC)`, `markAllReadByRmsEno`, `countUnread`)에 정렬돼 있다.
- **위험 순서:** LOW(import/필드/@Column/미사용클래스) → MEDIUM 리팩토링(헬퍼 추출) → 스윕(가변성 게이트) → 스파이크(Task 12) → 통합 테스트. 통합 테스트는 Task 12가 빌드/실행 환경을 풀어야 의미가 있으므로 그 뒤에 배치했다(문서 상단·각 Task 전제에 명시).
- **`.toList()` 안전성:** `.toList()`가 **불변 리스트**를 반환한다는 사실을 근거로 일괄 치환을 금지하고, 변수 단위 가변성 추적 절차 + 실측 워크드 예시 3건(치환 가능 2 / 추적 필요 1) + 패키지별 커밋 그룹을 제시했다. 불확실하면 보수적으로 치환하지 않는다는 기본값을 명시했다.
- **독립 커밋성:** Task 1~6, 8~15는 각각 독립 커밋. Task 7·16은 백로그 메모. 각 코드 Task는 `compileJava`(또는 TDD RED→GREEN) 게이트로 닫는다.
- **실측 수치:** `Collectors.toList()` = **51건 / 22파일**(Grep 확정).
- **마이그레이션 안전:** `BcostmL @Column(length)` 정정은 `ddl-auto=update`가 컬럼을 축소하지 않으므로 런타임 무해한 메타데이터 정정임을 명시(축소가 필요하면 별도 Flyway). DDL은 적용 Task에서 `grep`으로 권위 재확인하도록 했다.
- **주의(실행자):** (1) Task 5 헬퍼는 `CcodemRepository.findByCIdWithValidDate` 시그니처·`Ccodem` 픽스처 생성 방식을 먼저 확인. (2) Task 6 추출은 where 조건/조인/groupBy 불변을 diff 게이트로 보장. (3) Task 13~15는 `@DataJpaTest`에 `JPAQueryFactory`/`ApplicationContextHolder` 빈과 H2 의존성을 함께 갖춰야 기동하며, Oracle 전용 SQL(시퀀스)을 건드리지 않도록 픽스처를 `em.persist`로 적재한다.
