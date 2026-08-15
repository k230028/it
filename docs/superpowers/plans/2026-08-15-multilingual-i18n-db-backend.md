# 한국어·영어 다국어 DB·백엔드 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_CLANGM` 번역 저장소를 만들고 메뉴·공통코드 사용자 API와 관리자 API가 언어 선택, 필드별 fallback, 번역 편집, 언어별 캐시를 안전하게 지원하게 한다.

**Architecture:** 범용 JPA 번역 모듈이 대상·언어·물리 컬럼을 검증하고 대상 키 단위 일괄 조회/저장을 담당한다. 메뉴와 공통코드 서비스는 원본 조회 뒤 번역 맵을 한 번만 읽어 기존 DTO 표시 필드에 overlay한다. 관리자 저장은 원본과 번역을 같은 트랜잭션으로 처리하며 transaction-aware Caffeine 캐시를 전체 언어에 대해 무효화한다.

**Tech Stack:** Oracle 19c+, Flyway, Java 25, Spring Boot 4.1, Spring Data JPA, QueryDSL 5.1, Caffeine, JUnit 5, Mockito, MockMvc, 실제 Oracle 통합 테스트.

**Spec:** `docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md`

## Global Constraints

- 테이블명과 물리 컬럼명은 승인 설계에서 변경하지 않는다.
- `DTT_LAN_C`는 애플리케이션에서 `ko`, `en`만 허용하되 DB CHECK로 두 언어만 고정하지 않는다.
- `DTT_NM`·`TC_COL_NM`의 허용 조합과 `DTT_NM` 값은 DB와 Java 양쪽에서 검증한다.
- `ko` 사용자 조회는 번역 테이블을 읽지 않는다.
- `en` 조회는 모든 대상 키를 모아 한 번의 논리 조회로 번역하며 행별 조회를 금지한다.
- 번역이 없거나 삭제됐거나 공백이면 해당 원본 한국어만 fallback한다.
- 기존 사용자 DTO 필드명과 코드 식별 필드는 바꾸지 않는다.
- 관리자 `translations`가 `null`이면 기존 번역 유지, 빈 목록이면 제출된 번역 없음으로 해석해 기존 번역을 일괄 삭제하지 않는다. 삭제는 해당 컬럼의 빈 `text` 항목으로 명시한다.
- 공통코드 PK 변경 시 번역 키를 같은 트랜잭션에서 이동한다.
- 메뉴·공통코드 삭제 시 연결 번역을 논리 삭제한다.
- 관련 없는 dirty 파일은 수정·스테이징하지 않는다.

---

### Task 1: 번역 마스터 Flyway DDL

**Files:**
- Create: `it_database/migrations/V20260815_001__CreateLanguageTranslationMaster.sql`
- Create: `it_database/docs/verification/V20260815_001__CreateLanguageTranslationMaster.verify.sql`

**Interfaces:**
- Produces: `ITPOWN.TPRMPP_CLANGM`, `PK_CLANGM`, `IX_TPRMPP_CLANGM_01`
- Preserves: `BaseEntity` 공통 컬럼과 논리 삭제 규약

- [ ] **Step 1: 스키마 검증 SQL을 먼저 작성한다**

검증 파일은 `USER_TAB_COLUMNS`, `USER_CONSTRAINTS`, `USER_CONS_COLUMNS`, `USER_IND_COLUMNS`를 조회해 다음을 한 행씩 확인한다.

```text
TC_ID_CONE VARCHAR2(255 CHAR) NOT NULL
DTT_LAN_C  VARCHAR2(2 CHAR)   NOT NULL
TC_COL_NM  VARCHAR2(255 CHAR) NOT NULL
TC_DES     VARCHAR2(2000 CHAR) NOT NULL
DTT_NM     VARCHAR2(100 CHAR) NOT NULL
PK 순서    TC_ID_CONE, DTT_LAN_C, TC_COL_NM
인덱스     DTT_NM, DTT_LAN_C, TC_ID_CONE
```

허용 조합 CHECK에는 `메뉴/MNU_NM`과 승인된 공통코드 다섯 컬럼만 포함하고, `DTT_LAN_C IN ('ko','en')` 조건은 포함하지 않는다.

- [ ] **Step 2: 미적용 DB에서 검증 실패를 확인한다**

Run: 프로젝트 표준 Oracle 클라이언트로 검증 파일 실행.

Expected: `TPRMPP_CLANGM`이 없으므로 컬럼·PK·인덱스 조회가 0행이다.

- [ ] **Step 3: DDL migration을 작성한다**

다음 순서와 제약을 구현한다.

```sql
CREATE TABLE ITPOWN.TPRMPP_CLANGM (
    TC_ID_CONE VARCHAR2(255 CHAR) NOT NULL,
    DTT_LAN_C VARCHAR2(2 CHAR) NOT NULL,
    TC_COL_NM VARCHAR2(255 CHAR) NOT NULL,
    TC_DES VARCHAR2(2000 CHAR) NOT NULL,
    DTT_NM VARCHAR2(100 CHAR) NOT NULL,
    DEL_YN VARCHAR2(1 CHAR) DEFAULT 'N' NOT NULL,
    GUID VARCHAR2(38 CHAR) DEFAULT '00000000000000000000000000000000000000' NOT NULL,
    GUID_PRG_SNO NUMBER(4) DEFAULT 0 NOT NULL,
    FST_ENR_USID VARCHAR2(14 CHAR) DEFAULT '00000000000000' NOT NULL,
    FST_ENR_DTM DATE DEFAULT SYSDATE NOT NULL,
    LST_CHG_USID VARCHAR2(14 CHAR) DEFAULT '00000000000000' NOT NULL,
    LST_CHG_DTM DATE DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_CLANGM PRIMARY KEY (TC_ID_CONE, DTT_LAN_C, TC_COL_NM),
    CONSTRAINT CK_CLANGM_DTT_COL CHECK (
        (DTT_NM = '메뉴' AND TC_COL_NM = 'MNU_NM') OR
        (DTT_NM = '공통코드' AND TC_COL_NM IN
            ('CO_C_NM','CDVA_NM','CO_CDVA_ABV_NM','CO_CDVA_SPS','CO_C_INTN_CONE'))
    ),
    CONSTRAINT CK_CLANGM_DEL_YN CHECK (DEL_YN IN ('Y','N'))
);
CREATE INDEX ITPOWN.IX_TPRMPP_CLANGM_01
    ON ITPOWN.TPRMPP_CLANGM (DTT_NM, DTT_LAN_C, TC_ID_CONE);
```

기존 DDL의 공통 컬럼 타입·기본값과 정확히 다르면 현재 `TPRMPP_CMENUM`/`TPRMPP_CCODEM` 정의를 따라 위 초안을 조정한다. 테이블·모든 컬럼에 한국어 `COMMENT ON`을 작성하고 migration은 재실행용 예외 무시 블록 없이 단방향으로 유지한다.

- [ ] **Step 4: 로컬 Flyway 적용과 검증 SQL을 실행한다**

Run: `cd it_backend && ./gradlew bootRun --args='--spring.profiles.active=local'` 후 애플리케이션 시작 로그에서 `V20260815.001` 성공을 확인하고 종료한다.

Run: Task 1의 검증 SQL.

Expected: 컬럼·PK·CHECK·인덱스가 모두 예상 결과와 일치한다.

- [ ] **Step 5: DB 저장소에 DDL을 커밋한다**

```powershell
git -C it_database add -- migrations/V20260815_001__CreateLanguageTranslationMaster.sql docs/verification/V20260815_001__CreateLanguageTranslationMaster.verify.sql
git -C it_database diff --cached --check
git -C it_database commit -m "feat: add language translation master"
```

### Task 2: 번역 엔티티·복합키·대상 키 규약

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/entity/Clangm.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/entity/ClangmId.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/model/SupportedLanguage.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/model/TranslationTarget.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/model/TranslationColumns.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/service/TranslationTargetKey.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/entity/ClangmSchemaContractTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/service/TranslationTargetKeyTest.java`

**Interfaces:**
- Produces: `SupportedLanguage.normalize(String)`, `TranslationTarget.validateColumn(String)`, `TranslationTargetKey.menu(String)`, `TranslationTargetKey.code(String,String,String)`
- Consumes: `com.kdb.it.domain.entity.BaseEntity`

- [ ] **Step 1: 복합키와 키 생성 실패 테스트를 작성한다**

```java
@Test
void 공통코드키는_각_값의_길이와_콜론과_값을_연결한다() {
    assertThat(TranslationTargetKey.code("ABUS_TC", "10", "20260101"))
            .isEqualTo("7:ABUS_TC2:108:20260101");
}

@Test
void 콜론이_포함된_원본도_서로_다른_키를_만든다() {
    assertThat(TranslationTargetKey.code("A:B", "C", "20260101"))
            .isNotEqualTo(TranslationTargetKey.code("A", "B:C", "20260101"));
}

@Test
void 미지원언어는_한국어로_정규화한다() {
    assertThat(SupportedLanguage.normalize(" FR ")).isEqualTo(SupportedLanguage.KO);
    assertThat(SupportedLanguage.normalize(" EN ")).isEqualTo(SupportedLanguage.EN);
}
```

스키마 계약 테스트는 `Clangm`이 `BaseEntity`를 상속하고 `@IdClass(ClangmId.class)`를 사용하며 세 `@Id`의 `@Column` 이름·길이가 DDL과 같음을 reflection으로 검증한다.

- [ ] **Step 2: 단위 테스트 RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.*"`

Expected: 신규 타입이 없어 컴파일에 실패한다.

- [ ] **Step 3: 모델과 엔티티를 구현한다**

`SupportedLanguage`은 `KO("ko")`, `EN("en")`만 정의하고 trim/lowercase 후 미지원 값을 `KO`로 반환한다. `TranslationTarget`은 DB 값 `메뉴`, `공통코드`와 허용 물리 컬럼 집합을 보유한다. `Clangm`은 모든 컬럼에 한국어 `comment`를 지정하고 `TC_DES`, `DTT_NM`을 필수로 매핑한다. `ClangmId`는 직렬화 가능하며 세 PK 필드만 가지고 `equals/hashCode`를 구현한다.

`TranslationTargetKey`는 null을 거부하고 `String.length()` 기준으로 길이 접두를 만든 뒤 전체가 255자를 넘으면 `IllegalArgumentException`을 던진다.

- [ ] **Step 4: 모델 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.*" spotlessCheck`

Expected: 신규 단위 테스트와 Spotless가 통과한다.

- [ ] **Step 5: 엔티티 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/common/i18n src/test/java/com/kdb/it/common/i18n
git -C it_backend diff --cached --check
git -C it_backend commit -m "feat: map language translation master"
```

### Task 3: 번역 저장소와 일괄 카탈로그 서비스

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/dto/TranslationDto.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/service/TranslationCatalogService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/repository/ClangmRepositoryIt.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/service/TranslationCatalogServiceTest.java`

**Interfaces:**
- Produces: `TranslationDto.Value(String language, String columnName, String text)`
- Produces: `Map<String, Map<String,String>> findActive(target, language, targetKeys)`, `List<TranslationDto.Value> findAll(target, targetKey)`, `apply(target, targetKey, values)`, `softDeleteTarget(target,targetKey)`, `moveTarget(target,oldKey,newKey)`

- [ ] **Step 1: 저장·복원·삭제·일괄 조회 실패 테스트를 작성한다**

반드시 다음 사례를 포함한다.

- `ko` 조회는 repository를 호출하지 않고 빈 맵 반환
- `en`에서 삭제되지 않은 행만 `(targetKey,columnName) -> text`로 반환
- 1,001개 대상 키는 최대 900개씩 분할 조회해 Oracle `IN` 한도를 넘지 않음
- 허용하지 않은 언어·컬럼과 공백 번역 신규 저장은 거부
- 기존 삭제 행에 비어 있지 않은 텍스트를 저장하면 `DEL_YN='N'` 복원
- 빈 텍스트를 보내면 기존 행만 논리 삭제하고 신규 행은 만들지 않음
- `values == null` 또는 빈 목록은 기존 번역을 건드리지 않음
- 대상 키 이동 시 새 키 충돌을 거부하고 모든 컬럼 행을 새 키로 복제·이전 처리

- [ ] **Step 2: 테스트 RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.service.TranslationCatalogServiceTest"`

Expected: repository와 서비스가 없어 컴파일에 실패한다.

- [ ] **Step 3: repository와 서비스를 구현한다**

`ClangmRepository`는 다음 조회를 제공한다.

```java
List<Clangm> findByDttNmAndDttLanCAndTcIdConeInAndDelYn(
        String dttNm, String language, Collection<String> targetKeys, String delYn);
List<Clangm> findByDttNmAndTcIdCone(String dttNm, String targetKey);
```

`TranslationCatalogService`는 입력 컬렉션을 방어적으로 복사하고 900개씩 분할한다. `apply`는 요청 내 `(language,columnName)` 중복을 400 계열 업무 예외로 거부하고, `ko` 번역 행은 저장하지 않는다. 현재 관리자 UI는 `en`만 보내지만 서비스는 지원 enum을 기준으로 검증한다. 변경 메서드는 `@Transactional`을 사용한다.

- [ ] **Step 4: 단위·Oracle 통합 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.*"`

Run: `cd it_backend && ./gradlew integrationTest --tests "*ClangmRepositoryIt"`

Expected: 논리 삭제 필터, PK 분리, 일괄 조회가 실제 Oracle에서도 통과한다.

- [ ] **Step 5: 카탈로그 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/common/i18n src/test/java/com/kdb/it/common/i18n
git -C it_backend diff --cached --check
git -C it_backend commit -m "feat: add translation catalog service"
```

### Task 4: 메뉴 사용자 조회 언어 적용

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/MenuQueryController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/controller/MenuQueryControllerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`

**Interfaces:**
- Changes: `getMenuTree(List<String> athIds)` → `getMenuTree(List<String> athIds, String lang)`
- Produces: `GET /api/menus?lang=ko|en`, 기존 `MenuDto.Node.mnuNm`에 localized/fallback 값

- [ ] **Step 1: 컨트롤러·서비스 실패 테스트를 작성한다**

다음 literal 결과를 검증한다.

```java
// lang=en이고 루트 번역만 있으면 루트는 영어, 자식은 원본 한국어다.
assertThat(tree.getFirst().getMnuNm()).isEqualTo("Administration");
assertThat(tree.getFirst().getChildren().getFirst().getMnuNm()).isEqualTo("사용자 관리");
```

컨트롤러 테스트는 `lang=en`, 생략, `lang=FR`가 각각 서비스에 `en`, `ko`, `ko`로 전달됨을 확인한다. 서비스 테스트는 `ko`에서 번역 서비스를 호출하지 않고, `en`에서 전체 메뉴 ID를 한 번에 전달하는지 검증한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.controller.MenuQueryControllerTest" --tests "com.kdb.it.domain.menu.service.MenuQueryServiceTest"`

Expected: `lang` 파라미터와 새 서비스 시그니처가 없어 실패한다.

- [ ] **Step 3: 메뉴 트리에 번역 overlay를 구현한다**

컨트롤러에서 `@RequestParam(name = "lang", required = false)`를 받고 `SupportedLanguage.normalize` 결과를 전달한다. 서비스는 원본 `MenuTreeRow` 목록에서 메뉴 ID를 수집한 뒤 `TranslationTarget.MENU`, `MNU_NM` 번역 맵을 한 번 읽고 `toNode` 시 적용한다. 권한 필터·정렬·경로·아이콘·트리 구조는 변경하지 않는다.

- [ ] **Step 4: 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.*" spotlessCheck`

Expected: 기존 메뉴 회귀와 신규 언어/fallback 테스트가 모두 통과한다.

- [ ] **Step 5: 메뉴 조회 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/domain/menu/controller/MenuQueryController.java src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java src/test/java/com/kdb/it/domain/menu/controller/MenuQueryControllerTest.java src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java
git -C it_backend commit -m "feat: localize menu query"
```

### Task 5: 공통코드 사용자 조회 언어 적용

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/controller/CodeController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/service/CodeService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/dto/CodeDto.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/code/controller/CodeControllerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/code/service/CodeServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/code/repository/CodeResponseProjectionIt.java`

**Interfaces:**
- Changes: 모든 사용자 조회 메서드의 마지막 인자에 정규화된 `SupportedLanguage` 추가
- Preserves: `CodeDto.Response` JSON 필드명과 식별·정렬 필드

- [ ] **Step 1: 물리 컬럼별 overlay 실패 테스트를 작성한다**

다음 매핑을 각각 단언한다.

| 물리 컬럼 | DTO 필드 |
| --- | --- |
| `CO_C_NM` | `cNm` |
| `CDVA_NM` | `cdvaNm` |
| `CO_CDVA_ABV_NM` | `cdvaDes` |
| `CO_CDVA_SPS` | `cdvaDtl` |
| `CO_C_INTN_CONE` | `cTpDes` |

`cTp`(`CO_C_INTN_NM`)과 `cdvaDtlC`(`CO_CDVA_NM`)는 번역이 존재해도 원본이 유지되는 테스트를 추가한다. 동일 목록에서 일부 컬럼만 번역됐을 때 번역/한국어가 섞여 반환되는지도 검증한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.code.controller.CodeControllerTest" --tests "com.kdb.it.common.code.service.CodeServiceTest"`

Expected: 사용자 조회 메서드가 언어를 받지 않고 번역 서비스를 호출하지 않아 실패한다.

- [ ] **Step 3: 공통코드 응답 overlay를 구현한다**

모든 `CcodemResponseRow`를 먼저 조회한 뒤 `TranslationTargetKey.code(cId, cdva, sttDt)` 목록으로 번역을 일괄 조회한다. DTO 변환 함수는 원본 row와 필드별 번역 맵을 받아 기존 JSON 이름에 결과를 채운다. `budget-period`도 동일한 언어 규칙을 적용한다. 내부 업무 분기용 `findCodeEntitiesByCId` 캐시는 기존 원본 엔티티 계약을 유지한다.

- [ ] **Step 4: 단위·projection 통합 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.code.*"`

Run: `cd it_backend && ./gradlew integrationTest --tests "*CodeResponseProjectionIt"`

Expected: 기존 필드 투영과 새 localized DTO 매핑이 모두 통과한다.

- [ ] **Step 5: 공통코드 조회 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/common/code src/test/java/com/kdb/it/common/code
git -C it_backend commit -m "feat: localize common code queries"
```

### Task 6: 관리자 메뉴 번역 계약과 트랜잭션

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminMenuController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/controller/AdminMenuControllerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/dto/MenuOpenApiContractTest.java`

**Interfaces:**
- Adds: `List<TranslationDto.Value> translations` to `MenuDto.UpsertRequest`
- Produces: 별도 `MenuDto.AdminNode`에 한국어 `mnuNm`과 `translations`; 사용자 `MenuDto.Node`에는 translations 없음

- [ ] **Step 1: 관리자 계약 실패 테스트를 작성한다**

조회 테스트는 한국어 원본 메뉴명과 `[{language:"en",columnName:"MNU_NM",text:"..."}]`가 함께 반환되는지 확인한다. 생성·수정은 원본 저장과 `TranslationCatalogService.apply(MENU,mnuId,translations)`가 같은 호출에서 실행되는지 검증한다. 번역 저장 예외 시 원본 저장도 롤백되는 통합 또는 transaction-boundary 테스트를 추가한다. 삭제는 `softDeleteTarget` 호출을 검증한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.*"`

Expected: 관리자 전용 DTO와 번역 필드가 없어 실패한다.

- [ ] **Step 3: 관리자 메뉴 DTO와 서비스를 구현한다**

사용자 응답 오염을 막기 위해 기존 `Node`에 번역 필드를 추가하지 않는다. `getAdminMenuTree()`는 `List<MenuDto.AdminNode>`를 반환하고 각 메뉴 ID의 모든 활성 번역을 일괄 조회해 붙인다. `UpsertRequest.translations == null/empty`는 이전 클라이언트 호환을 위해 기존 번역 유지로 처리한다. 생성 시 서버 채번한 `mnuId`로 번역을 저장하고, 수정·삭제도 기존 `@Transactional` 범위 안에서 처리한다.

- [ ] **Step 4: 메뉴 관리자·OpenAPI 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.*" spotlessCheck`

Expected: 사용자 Node 스키마에는 translations가 없고 관리자 Node/요청에만 존재한다.

- [ ] **Step 5: 관리자 메뉴 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/domain/menu src/test/java/com/kdb/it/domain/menu
git -C it_backend commit -m "feat: manage menu translations"
```

### Task 7: 관리자 공통코드 번역 계약과 PK 이동

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/dto/AdminDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminCodeService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/controller/AdminControllerTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminCodeServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminCodeServiceCacheEvictTest.java`

**Interfaces:**
- Adds: `List<TranslationDto.Value> translations` to `AdminDto.CodeRequest` and `AdminDto.CodeResponse`
- Preserves: translations 생략 요청과 기존 한글 CRUD 계약

- [ ] **Step 1: 생성·수정·삭제·bulk 실패 테스트를 작성한다**

테스트는 다음을 검증한다.

- 조회 목록은 한국어 원본과 모든 활성 영어 번역을 반환
- 생성·수정·bulk는 각 행의 번역을 동일 트랜잭션에서 적용
- `(cId,cdva,sttDt)` 변경 시 old/new `TranslationTargetKey`가 다르면 `moveTarget` 후 제출 번역 적용
- PK가 바뀌지 않으면 이동하지 않음
- 삭제 시 원본과 번역 모두 논리 삭제
- `CO_C_INTN_NM`, `CO_CDVA_NM` 번역 요청은 400
- 번역 저장 실패 시 원본 생성·변경도 롤백

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.controller.AdminControllerTest" --tests "com.kdb.it.common.admin.service.AdminCodeServiceTest"`

Expected: DTO 번역 필드와 서비스 연동이 없어 실패한다.

- [ ] **Step 3: 관리자 공통코드 계약을 구현한다**

`getCodes`는 행별 조회 대신 모든 대상 키를 모아 한 번에 활성 번역을 붙인다. `CodeRequest.translations`를 생성/수정/bulk 경로 모두 전달한다. PK 이동은 기존 행을 논리 삭제하고 새 행을 만드는 현재 로직과 같은 트랜잭션에서 수행하며, 번역 대상 키 충돌 시 전체 요청을 실패시킨다.

- [ ] **Step 4: 관리자 코드 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.*" spotlessCheck`

Expected: 단건·bulk·PK 이동·rollback 테스트가 모두 통과한다.

- [ ] **Step 5: 관리자 공통코드 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/common/admin src/test/java/com/kdb/it/common/admin
git -C it_backend commit -m "feat: manage common code translations"
```

### Task 8: 언어별 캐시와 모든 언어 무효화

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/config/CacheConfig.java`
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/service/LocalizedCacheKeyService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/code/service/CodeService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminCodeService.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/service/LocalizedCacheKeyServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/code/service/CodeServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminCodeServiceCacheEvictTest.java`

**Interfaces:**
- Adds caches: `localizedMenuTrees`, `localizedCodeResponses`
- Produces stable keys containing normalized language, sorted authority IDs, endpoint discriminator, target date, and code identifiers

- [ ] **Step 1: 캐시 격리·무효화 실패 테스트를 작성한다**

같은 권한/코드 조건의 `ko`와 `en` 호출이 서로 다른 키를 만들고, 권한 ID 입력 순서가 달라도 같은 메뉴 키를 만드는지 검증한다. 메뉴 원본/번역 create-update-delete는 `localizedMenuTrees` 전체를, 코드 원본/번역 단건-bulk-PK이동-delete는 `localizedCodeResponses` 전체를 무효화하는지 테스트한다.

- [ ] **Step 2: RED를 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*LocalizedCacheKeyServiceTest" --tests "*MenuQueryServiceTest" --tests "*AdminCodeServiceCacheEvictTest"`

Expected: 신규 캐시와 키 서비스가 없어 실패한다.

- [ ] **Step 3: 캐시를 구현한다**

`CacheConfig`에 두 캐시를 기존 준정적 TTL/크기로 등록한다. `LocalizedCacheKeyService`는 null-safe한 구분자/길이 접두 방식으로 충돌 없는 키를 만들며 언어는 항상 normalize한다. 컨트롤러에서 호출되는 public 사용자 조회 메서드에 `@Cacheable`을 적용하고 관리자 쓰기 서비스에는 기존 evict와 함께 신규 cache `allEntries=true`를 추가한다. 기존 transaction-aware cache manager를 유지해 실패한 트랜잭션이 캐시를 비우지 않게 한다.

- [ ] **Step 4: 캐시 테스트 GREEN을 확인한다**

Run: `cd it_backend && ./gradlew test --tests "*Cache*Test" --tests "*MenuQueryServiceTest" --tests "*CodeServiceTest" spotlessCheck`

Expected: 언어 격리, 입력 순서 정규화, 쓰기 후 전체 언어 evict가 통과한다.

- [ ] **Step 5: 캐시 slice를 커밋한다**

```powershell
git -C it_backend add -- src/main/java/com/kdb/it/config/CacheConfig.java src/main/java/com/kdb/it/common/i18n/service/LocalizedCacheKeyService.java src/main/java/com/kdb/it/domain/menu/service src/main/java/com/kdb/it/common/code/service src/main/java/com/kdb/it/common/admin/service src/test/java/com/kdb/it
git -C it_backend commit -m "feat: isolate localized response caches"
```

### Task 9: 전체 API 계약·DB 매핑 검증

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/entity/MenuSchemaContractTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/dto/MenuOpenApiContractTest.java`
- Create: `it_backend/src/test/java/com/kdb/it/common/i18n/MultilingualApiContractTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/repository/CmenumMenuTreeProjectionIt.java`

**Interfaces:**
- Verifies: DDL ↔ JPA ↔ 서비스 ↔ OpenAPI 일치

- [ ] **Step 1: 교차 계층 계약 테스트를 완성한다**

`MultilingualApiContractTest`는 사용자 API의 `lang` optional/default와 관리자 요청·응답의 `translations` 배열 스키마를 검증한다. 실제 Oracle 통합 테스트는 메뉴와 공통코드 원본, `ko/en` 번역, 논리 삭제 번역을 넣고 `ko/en/미지원` 결과를 literal로 비교한다.

- [ ] **Step 2: 백엔드 전체 검증을 실행한다**

```powershell
cd it_backend
./gradlew spotlessCheck test
./gradlew integrationTest
```

Expected: 모든 단위·MockMvc·스키마 계약·Oracle 통합 테스트가 통과한다.

- [ ] **Step 3: OpenAPI 문서를 직접 확인한다**

로컬 백엔드를 기동하고 `/v3/api-docs`에서 다음을 확인한다.

- `/api/menus`와 사용자 공통코드 GET에 optional `lang`
- `MenuUpsertRequest`, 관리자 메뉴 응답, `AdminDto.CodeRequest/CodeResponse`에 번역 목록
- 일반 `MenuNode`와 `CodeDto.Response`에는 번역 목록 없음

- [ ] **Step 4: 백엔드 최종 계약을 커밋한다**

```powershell
git -C it_backend add -- src/test/java/com/kdb/it
git -C it_backend diff --cached --check
git -C it_backend commit -m "test: verify multilingual api contracts"
```

- [ ] **Step 5: 다음 계획에 전달할 기준 SHA를 기록한다**

Run: `git -C it_backend rev-parse HEAD` 및 `git -C it_database rev-parse HEAD`

Expected: 프론트 코드 생성과 최종 `versions.lock`이 참조할 두 SHA를 실행 로그에 남긴다.
