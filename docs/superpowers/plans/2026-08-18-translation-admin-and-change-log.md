# 다국어 번역 변경로그·관리자 다국어 관리 화면 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TPRMPP_CLANGM` 변경 이력을 `TPRMPP_CLANGL`에 자동 적재하고, 관리자가 `/admin/translations` 전용 화면에서 메뉴·공통코드의 영어 번역을 관리한다.

**Architecture:** 로그 적재는 기존 감사 로그 인프라(`@LogTarget` + `ChangeLogEntityListener` + `AuditLogPersister`)에 얹는다 — 로그 엔티티 1개, 마스터 어노테이션 1줄, `AdminLogService` 정의 1줄이 배선의 전부다. 관리자 화면은 원본 마스터와 번역을 백엔드에서 병합해 내려주는 신규 조회 API(`GET /api/admin/translations/{target}/entries`)를 소비하고, 저장은 기존 `PUT /api/admin/translations/{target}`을 재사용한다.

**Tech Stack:** Oracle 19c + Flyway, Spring Boot(JPA/Hibernate 6, JUnit 5, Mockito, AssertJ), Nuxt 4 CSR + PrimeVue + vue-i18n, Vitest, Playwright

**설계 문서:** [`docs/superpowers/specs/2026-08-18-translation-admin-and-change-log-design.md`](../specs/2026-08-18-translation-admin-and-change-log-design.md)

## Global Constraints

- 저장소는 4개로 분리되어 있고 각각 독립 원격이다. 커밋은 `git -C it_database`, `git -C it_backend`, `git -C it_frontend`, 루트(`C:\it`)로 나눠 수행한다.
- `git add`는 **경로를 명시**한다. `git add -A`, `git add .`, `git commit -a`를 쓰지 않는다. 워킹트리에 남의 변경이 함께 있는 것이 정상이므로, 커밋 직전 `git diff --cached --stat`으로 스테이징 목록이 의도한 경로와 정확히 일치하는지 확인한다.
- 교차 저장소 변경은 **백엔드 계약 커밋을 먼저** 만들고 프론트 커밋을 뒤이어 만든다(Task 2~6 → Task 7~10).
- 모든 신규 주석은 한글로 쓴다. 단순 대입·트리비얼 메서드에는 주석을 달지 않는다.
- 프론트의 사용자 노출 문구는 예외 없이 i18n 키를 통한다. 하드코딩 리터럴이 하나라도 남으면 `npm run check:copy` ratchet(현재 0건)이 실패한다.
- 적용된 Flyway 스크립트는 체크섬 추적 대상이므로 수정하지 않는다. 변경은 항상 새 버전 스크립트로 추가한다.
- 마이그레이션 파일명은 `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`.
- 스키마 접두어는 마이그레이션 SQL에만 쓴다(`ITPOWN.테이블명`). 애플리케이션 코드는 `CURRENT_SCHEMA=ITPOWN` 세션 설정에 의존하므로 접두어를 쓰지 않는다.
- 로컬 DB 확인은 `sqlplus ITPAPP@127.0.0.1:11521/XEPDB1`. 자동 실행 시 비밀번호는 `DB_PASSWORD` 환경변수를 **stdin으로만** 전달하고 명령행 인자로 넘기지 않는다.

---

### Task 1: `TPRMPP_CLANGL` 테이블·시퀀스 생성

**Files:**
- Create: `it_database/migrations/V20260818_001__CreateClangmChangeLog.sql`
- Create: `it_database/docs/verification/V20260818_001__CreateClangmChangeLog.verify.sql`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces: 테이블 `ITPOWN.TPRMPP_CLANGL`(PK `LOG_HIS_TGR_SNO`), 시퀀스 `ITPOWN.SQ_TPRMPP_CLANGL_1`. Task 2의 `ClangmL` 엔티티가 이 스키마에 매핑된다.

- [ ] **Step 1: 마이그레이션 스크립트 작성**

`it_database/migrations/V20260818_001__CreateClangmChangeLog.sql`:

```sql
-- 구분언어마스터(TPRMPP_CLANGM)의 변경 이력을 적재하는 로그 테이블을 생성한다.
--
-- [컬럼 구성]
--   마스터 업무 컬럼 5개 + BaseLogEntity 공통 컬럼. 라이브 TPRMPP_CCODEL과 같은 규칙으로
--   마스터 PK 컬럼(TC_ID_CONE, DTT_LAN_C, TC_COL_NM)만 NOT NULL이고 나머지 업무 컬럼은
--   NULL을 허용한다.
--
-- [CHECK 제약 미복제]
--   마스터의 CK_CLANGM_DTT_COL(구분명-컬럼명 조합 제한)은 복제하지 않는다. 로그는 과거
--   시점 스냅샷이므로 번역 대상 컬럼 집합이 나중에 바뀌면 이미 적재된 행이 제약을 위반한다.
--
-- [인덱스]
--   보조 인덱스를 두지 않는다. 공용 로그 화면의 조회는 AdminLogService의
--   'order by e.logSno desc' 하나뿐이라 PK 인덱스로 충분하고, 기존 *L 테이블도 PK만 갖는다.

CREATE TABLE ITPOWN.TPRMPP_CLANGL (
    LOG_HIS_TGR_SNO NUMBER(18)          NOT NULL,
    TC_ID_CONE      VARCHAR2(255 CHAR)  NOT NULL,
    DTT_LAN_C       VARCHAR2(2 CHAR)    NOT NULL,
    TC_COL_NM       VARCHAR2(255 CHAR)  NOT NULL,
    TC_DES          VARCHAR2(2000 CHAR),
    DTT_NM          VARCHAR2(100 CHAR),
    CHG_DTT_YN      VARCHAR2(1 CHAR),
    CHG_DTM         DATE                NOT NULL,
    CHG_USID        VARCHAR2(14 CHAR),
    FST_ENR_USID    VARCHAR2(14 CHAR)   DEFAULT '00000000000000' NOT NULL,
    FST_ENR_DTM     DATE                DEFAULT SYSDATE NOT NULL,
    DEL_YN          VARCHAR2(1 CHAR)    DEFAULT 'N' NOT NULL,
    GUID            VARCHAR2(38 CHAR)   DEFAULT '00000000000000000000000000000000000000' NOT NULL,
    GUID_PRG_SNO    NUMBER(4)           DEFAULT 0 NOT NULL,
    LST_CHG_USID    VARCHAR2(14 CHAR)   DEFAULT '00000000000000' NOT NULL,
    LST_CHG_DTM     DATE                DEFAULT SYSDATE NOT NULL,
    CONSTRAINT PK_CLANGL PRIMARY KEY (LOG_HIS_TGR_SNO)
);

CREATE SEQUENCE ITPOWN.SQ_TPRMPP_CLANGL_1
    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE MAXVALUE 999999999999999000;

COMMENT ON TABLE ITPOWN.TPRMPP_CLANGL IS '프로젝트관리_구분언어기본변경로그';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.LOG_HIS_TGR_SNO IS '로그이력전문일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.TC_ID_CONE IS '구분코드ID내용';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.DTT_LAN_C IS '구분언어코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.TC_COL_NM IS '구분코드컬럼명';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.TC_DES IS '구분코드설명';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.DTT_NM IS '구분명';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.CHG_DTT_YN IS '변경구분여부';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.CHG_DTM IS '변경일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.CHG_USID IS '변경사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.FST_ENR_USID IS '최초등록사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.FST_ENR_DTM IS '최초등록일시';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.DEL_YN IS '삭제여부';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.GUID IS 'GUID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.GUID_PRG_SNO IS 'GUID진행일련번호';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.LST_CHG_USID IS '최종변경사용자ID';
COMMENT ON COLUMN ITPOWN.TPRMPP_CLANGL.LST_CHG_DTM IS '최종변경일시';
```

- [ ] **Step 2: Flyway SoT 확인**

테이블과 시퀀스 정의는 `it_database/migrations/V20260818_001__CreateClangmChangeLog.sql`에서만 관리한다.
백엔드 리소스에 별도 DDL 사본을 만들지 않는다.

- [ ] **Step 3: 검증 스크립트 작성**

`it_database/docs/verification/V20260818_001__CreateClangmChangeLog.verify.sql`:

```sql
SET PAGESIZE 100
SET LINESIZE 220
SET FEEDBACK ON

PROMPT [1] 컬럼 계약 (마스터 업무 컬럼 5개 + 로그 공통 컬럼)
SELECT column_name,
       data_type,
       char_length,
       nullable,
       data_default
  FROM all_tab_columns
 WHERE owner = 'ITPOWN'
   AND table_name = 'TPRMPP_CLANGL'
 ORDER BY column_id;

PROMPT [2] PK는 LOG_HIS_TGR_SNO 단일이어야 한다
SELECT ac.constraint_name,
       acc.position,
       acc.column_name
  FROM all_constraints ac
  JOIN all_cons_columns acc
    ON acc.owner = ac.owner
   AND acc.constraint_name = ac.constraint_name
   AND acc.table_name = ac.table_name
 WHERE ac.owner = 'ITPOWN'
   AND ac.table_name = 'TPRMPP_CLANGL'
   AND ac.constraint_type = 'P'
 ORDER BY acc.position;

PROMPT [3] CHECK 제약은 NOT NULL 자동 생성분 외에 없어야 한다
SELECT constraint_name, search_condition
  FROM all_constraints
 WHERE owner = 'ITPOWN'
   AND table_name = 'TPRMPP_CLANGL'
   AND constraint_type = 'C';

PROMPT [4] 시퀀스 기준값
SELECT sequence_name, min_value, max_value, increment_by, cache_size, cycle_flag
  FROM all_sequences
 WHERE sequence_owner = 'ITPOWN'
   AND sequence_name = 'SQ_TPRMPP_CLANGL_1';

PROMPT [5] 마스터와 업무 컬럼 길이가 일치해야 한다 (불일치 행이 나오면 실패)
SELECT m.column_name,
       m.char_length AS master_len,
       l.char_length AS log_len
  FROM all_tab_columns m
  JOIN all_tab_columns l
    ON l.owner = m.owner
   AND l.table_name = 'TPRMPP_CLANGL'
   AND l.column_name = m.column_name
 WHERE m.owner = 'ITPOWN'
   AND m.table_name = 'TPRMPP_CLANGM'
   AND m.column_name IN ('TC_ID_CONE', 'DTT_LAN_C', 'TC_COL_NM', 'TC_DES', 'DTT_NM')
   AND NVL(m.char_length, -1) <> NVL(l.char_length, -1);
```

- [ ] **Step 4: 마이그레이션 적용**

백엔드를 로컬 프로파일로 기동하면 Flyway가 `filesystem:../it_database/migrations`를 읽어 신규 스크립트를 적용한다.

Run: `cd it_backend && ./gradlew bootRun`
Expected: 기동 로그에 `Migrating schema "ITPOWN" to version "20260818.001 - CreateClangmChangeLog"` 출력. 확인 후 기동을 중단한다.

- [ ] **Step 5: 검증 스크립트 실행**

Run:

```bash
{ printf '%s\n' "$DB_PASSWORD"; cat it_database/docs/verification/V20260818_001__CreateClangmChangeLog.verify.sql; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

Expected: [1]에 16개 컬럼, [2]에 `PK_CLANGL` / position 1 / `LOG_HIS_TGR_SNO`, [3]에 `NOT NULL` 조건만, [4]에 `MAX_VALUE = 999999999999999000`, **[5]는 0건**(no rows selected).

- [ ] **Step 6: 커밋**

```bash
git -C it_database add migrations/V20260818_001__CreateClangmChangeLog.sql docs/verification/V20260818_001__CreateClangmChangeLog.verify.sql
git -C it_database diff --cached --stat
git -C it_database commit -m "feat: 구분언어마스터 변경로그 테이블 TPRMPP_CLANGL 생성"
```

---

### Task 2: `ClangmL` 로그 엔티티와 마스터 연결

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/domain/log/entity/ClangmL.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/i18n/entity/Clangm.java` (import 2줄 + 클래스 어노테이션 1줄)
- Test: `it_backend/src/test/java/com/kdb/it/domain/log/entity/ClangmLSchemaContractTest.java`

**Interfaces:**
- Consumes: Task 1의 `TPRMPP_CLANGL` 테이블
- Produces: `com.kdb.it.domain.log.entity.ClangmL`(필드 `tcIdCone`, `dttLanC`, `tcColNm`, `tcDes`, `dttNm`). Task 3의 `LogDefinition`이 이 클래스를 참조한다.

`AuditLogPersister.copyColumnFields()`는 원본과 로그 엔티티의 `@Column(name)`을 **대소문자 무시 문자열 비교**로 매칭한다(`AuditLogPersister.java:214`). 컬럼명이 어긋나면 예외 없이 값이 비어 적재되므로, 계약 테스트가 이 태스크의 핵심이다.

- [ ] **Step 1: 실패하는 계약 테스트 작성**

`it_backend/src/test/java/com/kdb/it/domain/log/entity/ClangmLSchemaContractTest.java`:

```java
package com.kdb.it.domain.log.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.domain.log.annotation.LogTarget;
import jakarta.persistence.Column;
import jakarta.persistence.Table;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;

/** 번역 로그 엔티티가 마스터·로그 테이블 계약을 지키는지 고정합니다. */
class ClangmLSchemaContractTest {

    /** 마스터에서 로그로 복사되어야 하는 업무 컬럼입니다. */
    private static final List<String> BUSINESS_COLUMNS =
            List.of("TC_ID_CONE", "DTT_LAN_C", "TC_COL_NM", "TC_DES", "DTT_NM");

    @Test
    void 번역로그는_로그기반클래스를_상속하고_로그테이블에_매핑된다() {
        assertThat(BaseLogEntity.class).isAssignableFrom(ClangmL.class);
        assertThat(ClangmL.class.getAnnotation(Table.class).name()).isEqualTo("TPRMPP_CLANGL");
    }

    @Test
    void 마스터에_로그대상_어노테이션이_연결되어_있다() {
        LogTarget logTarget = Clangm.class.getAnnotation(LogTarget.class);

        assertThat(logTarget).isNotNull();
        assertThat(logTarget.entity()).isEqualTo(ClangmL.class);
    }

    @Test
    void 업무컬럼은_마스터와_컬럼명과_길이가_일치한다() {
        Map<String, Column> masterColumns = columnsOf(Clangm.class);
        Map<String, Column> logColumns = columnsOf(ClangmL.class);

        for (String columnName : BUSINESS_COLUMNS) {
            assertThat(masterColumns).as("마스터 컬럼 " + columnName).containsKey(columnName);
            assertThat(logColumns).as("로그 컬럼 " + columnName).containsKey(columnName);
            assertThat(logColumns.get(columnName).length())
                    .as(columnName + " 길이")
                    .isEqualTo(masterColumns.get(columnName).length());
        }
    }

    private static Map<String, Column> columnsOf(Class<?> type) {
        return Arrays.stream(type.getDeclaredFields())
                .filter(field -> field.isAnnotationPresent(Column.class))
                .collect(
                        Collectors.toMap(
                                field -> field.getAnnotation(Column.class).name(),
                                field -> field.getAnnotation(Column.class)));
    }
}
```

- [ ] **Step 2: 컴파일 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.entity.ClangmLSchemaContractTest"`
Expected: FAIL — `cannot find symbol: class ClangmL` 컴파일 오류.

- [ ] **Step 3: 로그 엔티티 작성**

`it_backend/src/main/java/com/kdb/it/domain/log/entity/ClangmL.java`:

```java
package com.kdb.it.domain.log.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.experimental.SuperBuilder;

/** 구분언어마스터(TPRMPP_CLANGM) 변경 로그 엔티티. */
@Entity
@Table(name = "TPRMPP_CLANGL", comment = "프로젝트관리_구분언어기본변경로그")
@Getter
@SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class ClangmL extends BaseLogEntity {

    // 변경로그 복사는 @Column(name)으로 매칭하므로 마스터(Clangm)와 컬럼명이 일치해야 한다.
    @Column(name = "TC_ID_CONE", length = 255, comment = "구분코드ID내용")
    private String tcIdCone;

    @Column(name = "DTT_LAN_C", length = 2, comment = "구분언어코드")
    private String dttLanC;

    @Column(name = "TC_COL_NM", length = 255, comment = "구분코드컬럼명")
    private String tcColNm;

    @Column(name = "TC_DES", length = 2000, comment = "구분코드설명")
    private String tcDes;

    @Column(name = "DTT_NM", length = 100, comment = "구분명")
    private String dttNm;
}
```

- [ ] **Step 4: 마스터에 `@LogTarget` 연결**

`it_backend/src/main/java/com/kdb/it/common/i18n/entity/Clangm.java` — import 블록에 두 줄을 추가하고(알파벳 순서상 `com.kdb.it.domain.entity.BaseEntity` 바로 뒤),

```java
import com.kdb.it.domain.log.annotation.LogTarget;
import com.kdb.it.domain.log.entity.ClangmL;
```

클래스 선언부 `@Entity` 바로 위에 어노테이션을 추가한다:

```java
/** 메뉴와 공통코드의 다국어 명칭을 저장하는 번역 마스터 엔티티입니다. */
@LogTarget(entity = ClangmL.class)
@Entity
@Table(name = "TPRMPP_CLANGM", comment = "언어별구분코드마스터")
```

`BaseEntity`가 이미 `ChangeLogEntityListener`를 `@EntityListeners`로 등록하고 있으므로 다른 배선은 필요 없다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.domain.log.entity.ClangmLSchemaContractTest"`
Expected: PASS (3 tests)

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/domain/log/entity/ClangmL.java src/main/java/com/kdb/it/common/i18n/entity/Clangm.java src/test/java/com/kdb/it/domain/log/entity/ClangmLSchemaContractTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m "feat: 번역 마스터 변경로그 엔티티 ClangmL 추가"
```

---

### Task 3: 공용 로그 화면에 번역 로그 등록

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminLogService.java:329` (`buildDefinitions()`의 목록 마지막 항목 뒤)
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminLogServiceDefinitionTest.java`

**Interfaces:**
- Consumes: Task 2의 `ClangmL`
- Produces: 로그 키 `clangm` → `/api/admin/logs/clangm`, 화면 `/admin/logs/clangm`

- [ ] **Step 1: 실패하는 테스트 작성**

`it_backend/src/test/java/com/kdb/it/common/admin/service/AdminLogServiceDefinitionTest.java`:

```java
package com.kdb.it.common.admin.service;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.domain.log.entity.ClangmL;
import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** 로그 테이블 정의 목록에 번역 로그가 등록되어 있는지 고정합니다. */
class AdminLogServiceDefinitionTest {

    @Test
    void 번역로그가_공용_로그정의에_등록되어_있다() throws Exception {
        Method method = AdminLogService.class.getDeclaredMethod("buildDefinitions");
        method.setAccessible(true);
        AdminLogService service = new AdminLogService(null);

        @SuppressWarnings("unchecked")
        Map<String, ?> definitions = (Map<String, ?>) method.invoke(service);

        assertThat(definitions).containsKey("clangm");
        Object definition = definitions.get("clangm");
        Method entityClass = definition.getClass().getDeclaredMethod("entityClass");
        entityClass.setAccessible(true);
        assertThat(entityClass.invoke(definition)).isEqualTo(ClangmL.class);
    }
}
```

`AdminLogService`의 생성자 시그니처가 `EntityManager` 단일 인자가 아니면 실제 시그니처에 맞춰 `new AdminLogService(...)` 인자를 `null`로 채운다. `buildDefinitions()`는 주입 객체를 쓰지 않는다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.service.AdminLogServiceDefinitionTest"`
Expected: FAIL — `Expecting map: ... to contain key: "clangm"`

- [ ] **Step 3: 로그 정의 추가**

`AdminLogService.java`의 import에 `import com.kdb.it.domain.log.entity.ClangmL;`를 추가하고(기존 로그 엔티티 import와 같은 알파벳 위치), `buildDefinitions()`의 목록 마지막 줄을 다음과 같이 바꾼다:

```java
                        new LogDefinition("ccodem", "공통코드 로그", CcodemL.class),
                        new LogDefinition("clangm", "다국어 번역 로그", ClangmL.class));
```

키는 마스터 기준으로 짓는 기존 관례(`ccodem`, `capplm`)를 따른다. 목록은 `buildDefinitions()`가 키 기준으로 정렬하므로 삽입 위치는 노출 순서에 영향을 주지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.admin.service.AdminLogServiceDefinitionTest"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/admin/service/AdminLogService.java src/test/java/com/kdb/it/common/admin/service/AdminLogServiceDefinitionTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m "feat: 공용 로그 화면에 다국어 번역 로그 등록"
```

---

### Task 4: 로그 적재 통합 검증

**Files:**
- Test: `it_backend/src/test/java/com/kdb/it/common/i18n/entity/ClangmChangeLogIt.java`

**Interfaces:**
- Consumes: Task 1~3
- Produces: 없음(검증 전용)

실제 Oracle에 붙는 통합 테스트이므로 `integrationTest` 소스셋 규약(`*It` 접미사)을 따른다. 기존 `ClangmRepositoryIt`와 같은 위치·형식이다.

- [ ] **Step 1: 기존 통합 테스트 형식 확인**

Run: `cd it_backend && sed -n '1,40p' src/test/java/com/kdb/it/common/i18n/repository/ClangmRepositoryIt.java`
Expected: 클래스 레벨 어노테이션(`@SpringBootTest` 또는 `@DataJpaTest` 계열)과 활성 프로파일을 확인한다. 아래 테스트의 헤더를 그 형식에 맞춘다.

- [ ] **Step 2: 실패하는 통합 테스트 작성**

`it_backend/src/test/java/com/kdb/it/common/i18n/entity/ClangmChangeLogIt.java` — 클래스 어노테이션은 Step 1에서 확인한 `ClangmRepositoryIt`의 것을 그대로 쓴다.

```java
package com.kdb.it.common.i18n.entity;

import static org.assertj.core.api.Assertions.assertThat;

import com.kdb.it.common.i18n.model.TranslationColumns;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import jakarta.persistence.EntityManager;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** 번역 마스터 변경이 TPRMPP_CLANGL에 적재되는지 검증합니다. */
class ClangmChangeLogIt {

    @Autowired private ClangmRepository repository;
    @Autowired private EntityManager entityManager;

    @Test
    void 번역_생성_수정_논리삭제가_각각_로그로_남는다() {
        String targetKey = "MNU_LOG_IT_0001";

        Clangm created =
                repository.saveAndFlush(
                        Clangm.builder()
                                .tcIdCone(targetKey)
                                .dttLanC("en")
                                .tcColNm(TranslationColumns.MNU_NM)
                                .tcDes("Dashboard")
                                .dttNm("메뉴")
                                .delYn("N")
                                .build());
        created.update("Main Dashboard");
        repository.saveAndFlush(created);
        created.delete();
        repository.saveAndFlush(created);
        entityManager.clear();

        List<Object[]> rows =
                entityManager
                        .createNativeQuery(
                                "SELECT CHG_DTT_YN, TC_DES FROM TPRMPP_CLANGL "
                                        + "WHERE TC_ID_CONE = ?1 ORDER BY LOG_HIS_TGR_SNO")
                        .setParameter(1, targetKey)
                        .getResultList();

        assertThat(rows).hasSize(3);
        assertThat(rows.get(0)[0]).isEqualTo("C");
        assertThat(rows.get(0)[1]).isEqualTo("Dashboard");
        assertThat(rows.get(1)[0]).isEqualTo("U");
        assertThat(rows.get(1)[1]).isEqualTo("Main Dashboard");
        assertThat(rows.get(2)[0]).isEqualTo("D");
    }
}
```

`AuditLogPersister`는 원 트랜잭션 **커밋 이후**(`afterCommit`) 별도 트랜잭션으로 로그를 쓴다. 위 테스트가 트랜잭션 롤백 방식(`@Transactional`)으로 돌면 로그 행이 보이지 않는다. Step 1에서 확인한 `ClangmRepositoryIt`가 `@Transactional`을 쓰고 있다면 이 클래스에는 붙이지 않고, 테스트 종료 시 `repository.deleteById(...)`와 `TPRMPP_CLANGL` 정리 native 쿼리로 직접 뒷정리한다.

- [ ] **Step 3: 통합 테스트 실행**

Run: `cd it_backend && ./gradlew integrationTest --tests "com.kdb.it.common.i18n.entity.ClangmChangeLogIt"`
Expected: PASS. 실패하면 로그에서 `[감사로그 예약 실패]` 또는 `[감사로그 기록 실패]` ERROR를 먼저 확인한다 — 컬럼명 불일치나 시퀀스 부재가 이 경로로 드러난다.

- [ ] **Step 4: 커밋**

```bash
git -C it_backend add src/test/java/com/kdb/it/common/i18n/entity/ClangmChangeLogIt.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m "test: 번역 마스터 변경로그 적재 통합 검증"
```

---

### Task 5: 번역 현황 조회 서비스

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/common/i18n/service/TranslationEntryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/i18n/dto/TranslationDto.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/i18n/service/TranslationEntryServiceTest.java`

**Interfaces:**
- Consumes: `CmenumRepository.findAllActive()`, `CodeRepository`, `TranslationTargetKey.menu(String)` / `.code(String, String, String)`, `TranslationTarget.dbName()` / `.columns()`
- Produces:
  - `TranslationDto.Entry(String targetKey, Map<String,String> source, String label, List<TranslationDto.ColumnValue> columns, boolean translated, String lastChangedBy, LocalDateTime lastChangedAt)`
  - `TranslationDto.ColumnValue(String columnName, String koText, int maxLength, Map<String,String> translations)`
  - `TranslationEntryService.findEntries(TranslationTarget target)` → `List<TranslationDto.Entry>`
  - `ClangmRepository.findActiveByTargetAndKeys(String target, Collection<String> targetKeys)` → `List<Clangm>`

- [ ] **Step 1: 공통코드 전량 조회 메서드 확인**

Run: `cd it_backend && grep -n "findAll\|delYn = 'N'" src/main/java/com/kdb/it/common/code/repository/CodeRepository.java`
Expected: 활성 공통코드 전량을 반환하는 메서드가 있으면 그 이름을 쓴다. 없으면 다음을 `CodeRepository`에 추가한다:

```java
    /** 활성 공통코드를 전량 조회합니다. */
    @Query("SELECT c FROM Ccodem c WHERE c.delYn = 'N'")
    List<Ccodem> findAllActive();
```

이후 단계의 코드는 `findAllActive()`를 쓴다고 가정한다.

- [ ] **Step 2: 실패하는 서비스 테스트 작성**

`it_backend/src/test/java/com/kdb/it/common/i18n/service/TranslationEntryServiceTest.java`:

```java
package com.kdb.it.common.i18n.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.dto.TranslationDto;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.common.i18n.model.TranslationColumns;
import com.kdb.it.common.i18n.model.TranslationTarget;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class TranslationEntryServiceTest {

    @Mock private CmenumRepository menuRepository;
    @Mock private CodeRepository codeRepository;
    @Mock private ClangmRepository translationRepository;

    @Test
    void 메뉴는_번역이_있으면_번역완료로_표시한다() {
        TranslationEntryService service = service();
        when(menuRepository.findAllActive()).thenReturn(List.of(menu("MNU0001001", "대시보드")));
        when(translationRepository.findActiveByTargetAndKeys("메뉴", List.of("MNU0001001")))
                .thenReturn(
                        List.of(
                                translation(
                                        "MNU0001001", "en", TranslationColumns.MNU_NM,
                                        "Dashboard")));

        List<TranslationDto.Entry> entries = service.findEntries(TranslationTarget.MENU);

        assertThat(entries).hasSize(1);
        TranslationDto.Entry entry = entries.get(0);
        assertThat(entry.targetKey()).isEqualTo("MNU0001001");
        assertThat(entry.label()).isEqualTo("MNU0001001");
        assertThat(entry.source()).containsEntry("mnuId", "MNU0001001");
        assertThat(entry.translated()).isTrue();
        assertThat(entry.columns()).hasSize(1);
        assertThat(entry.columns().get(0).koText()).isEqualTo("대시보드");
        assertThat(entry.columns().get(0).maxLength()).isEqualTo(100);
        assertThat(entry.columns().get(0).translations()).containsEntry("en", "Dashboard");
    }

    @Test
    void 번역이_없는_메뉴는_미번역으로_표시한다() {
        TranslationEntryService service = service();
        when(menuRepository.findAllActive()).thenReturn(List.of(menu("MNU0001002", "예산")));
        when(translationRepository.findActiveByTargetAndKeys("메뉴", List.of("MNU0001002")))
                .thenReturn(List.of());

        List<TranslationDto.Entry> entries = service.findEntries(TranslationTarget.MENU);

        assertThat(entries.get(0).translated()).isFalse();
        assertThat(entries.get(0).columns().get(0).translations()).isEmpty();
        assertThat(entries.get(0).lastChangedAt()).isNull();
    }

    @Test
    void 공통코드는_길이prefix_대상키로_번역을_병합한다() {
        TranslationEntryService service = service();
        when(codeRepository.findAllActive()).thenReturn(List.of(code()));
        String targetKey = "8:ABUS_PPO3:0018:20260101";
        when(translationRepository.findActiveByTargetAndKeys("공통코드", List.of(targetKey)))
                .thenReturn(
                        List.of(
                                translation(
                                        targetKey, "en", TranslationColumns.CDVA_NM,
                                        "New Development")));

        List<TranslationDto.Entry> entries = service.findEntries(TranslationTarget.COMMON_CODE);

        assertThat(entries.get(0).targetKey()).isEqualTo(targetKey);
        assertThat(entries.get(0).source())
                .containsEntry("cId", "ABUS_PPO")
                .containsEntry("cdva", "001")
                .containsEntry("sttDt", "20260101");
        assertThat(entries.get(0).columns()).hasSize(5);
        assertThat(columnOf(entries.get(0), TranslationColumns.CDVA_NM).translations())
                .containsEntry("en", "New Development");
        // CO_CDVA_SPS는 원본 2000자와 TC_DES 2000자 중 작은 값이 그대로 2000이다
        assertThat(columnOf(entries.get(0), TranslationColumns.CO_CDVA_SPS).maxLength())
                .isEqualTo(2000);
        assertThat(columnOf(entries.get(0), TranslationColumns.CDVA_NM).maxLength()).isEqualTo(200);
        // 5개 대상 컬럼 중 1개만 번역되었으므로 완료가 아니다
        assertThat(entries.get(0).translated()).isFalse();
    }

    @Test
    void 대상키가_구백개를_넘으면_나눠서_조회한다() {
        TranslationEntryService service = service();
        List<Cmenum> menus =
                java.util.stream.IntStream.range(0, 901)
                        .mapToObj(index -> menu("MNU" + index, "메뉴" + index))
                        .toList();
        when(menuRepository.findAllActive()).thenReturn(menus);
        when(translationRepository.findActiveByTargetAndKeys(
                        org.mockito.ArgumentMatchers.eq("메뉴"),
                        org.mockito.ArgumentMatchers.anyList()))
                .thenReturn(List.of());

        assertThat(service.findEntries(TranslationTarget.MENU)).hasSize(901);
        org.mockito.Mockito.verify(translationRepository, org.mockito.Mockito.times(2))
                .findActiveByTargetAndKeys(
                        org.mockito.ArgumentMatchers.eq("메뉴"),
                        org.mockito.ArgumentMatchers.anyList());
    }

    private TranslationEntryService service() {
        return new TranslationEntryService(menuRepository, codeRepository, translationRepository);
    }

    private static TranslationDto.ColumnValue columnOf(
            TranslationDto.Entry entry, String columnName) {
        return entry.columns().stream()
                .filter(column -> column.columnName().equals(columnName))
                .findFirst()
                .orElseThrow();
    }

    private static Cmenum menu(String mnuId, String mnuNm) {
        return Cmenum.builder().mnuId(mnuId).mnuNm(mnuNm).delYn("N").build();
    }

    private static Ccodem code() {
        return Ccodem.builder()
                .cId("ABUS_PPO")
                .cdva("001")
                .sttDt("20260101")
                .cNm("사업목적")
                .cdvaNm("신규개발")
                .cdvaDes("신규")
                .cdvaDtl("신규 개발 사업")
                .cTpDes("사업목적 코드")
                .delYn("N")
                .build();
    }

    private static Clangm translation(
            String targetKey, String language, String columnName, String text) {
        return Clangm.builder()
                .tcIdCone(targetKey)
                .dttLanC(language)
                .tcColNm(columnName)
                .tcDes(text)
                .dttNm("메뉴")
                .delYn("N")
                .build();
    }
}
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.service.TranslationEntryServiceTest"`
Expected: FAIL — `cannot find symbol: class TranslationEntryService`

- [ ] **Step 4: DTO 확장**

`it_backend/src/main/java/com/kdb/it/common/i18n/dto/TranslationDto.java`의 `Value` 레코드 아래에 추가:

```java
    /** 원본 한 건과 그 번역 현황입니다. */
    public record Entry(
            String targetKey,
            Map<String, String> source,
            String label,
            List<ColumnValue> columns,
            boolean translated,
            String lastChangedBy,
            LocalDateTime lastChangedAt) {}

    /**
     * 번역 대상 컬럼 한 개의 한국어 원문과 언어별 번역입니다.
     *
     * <p>{@code maxLength}는 원본 컬럼 길이와 {@code TC_DES}(2000) 중 작은 값이며, 관리자 화면 입력 제한에 씁니다.
     */
    public record ColumnValue(
            String columnName, String koText, int maxLength, Map<String, String> translations) {}
```

파일 상단에 `import java.time.LocalDateTime;`, `import java.util.List;`, `import java.util.Map;`를 추가한다.

- [ ] **Step 5: 저장소 조회 메서드 추가**

`it_backend/src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java`의 `findActiveByTargetAndLanguageAndKeys` 아래에 추가:

```java
    /** 지정 대상 키에 속한 활성 번역을 언어 구분 없이 일괄 조회합니다. */
    @Query(
            "SELECT c FROM Clangm c WHERE c.dttNm = :target "
                    + "AND c.tcIdCone IN :targetKeys AND c.delYn = 'N'")
    List<Clangm> findActiveByTargetAndKeys(
            @Param("target") String target, @Param("targetKeys") Collection<String> targetKeys);
```

- [ ] **Step 6: 서비스 구현**

`it_backend/src/main/java/com/kdb/it/common/i18n/service/TranslationEntryService.java`:

```java
package com.kdb.it.common.i18n.service;

import com.kdb.it.common.code.entity.Ccodem;
import com.kdb.it.common.code.repository.CodeRepository;
import com.kdb.it.common.i18n.dto.TranslationDto;
import com.kdb.it.common.i18n.entity.Clangm;
import com.kdb.it.common.i18n.model.TranslationColumns;
import com.kdb.it.common.i18n.model.TranslationTarget;
import com.kdb.it.common.i18n.repository.ClangmRepository;
import com.kdb.it.domain.menu.entity.Cmenum;
import com.kdb.it.domain.menu.repository.CmenumRepository;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 원본 마스터와 번역 마스터를 병합해 관리자 화면용 번역 현황 목록을 만드는 서비스입니다.
 *
 * <p>번역 행 자체의 생성·변경은 {@link TranslationCatalogService}가 담당하고, 이 서비스는 조회만 합니다.
 */
@Service
public class TranslationEntryService {

    /** Oracle IN 절 한계(1000)를 넘지 않도록 나누는 단위입니다. */
    private static final int ORACLE_IN_BATCH_SIZE = 900;

    /** 번역 문구 저장 컬럼 TC_DES의 길이입니다. */
    private static final int TRANSLATION_TEXT_MAX_LENGTH = 2000;

    /** 번역 대상 원본 컬럼의 길이입니다. 화면 입력 제한은 이 값과 TC_DES 길이 중 작은 값을 씁니다. */
    private static final Map<String, Integer> SOURCE_COLUMN_LENGTHS =
            Map.of(
                    TranslationColumns.MNU_NM, 100,
                    TranslationColumns.CO_C_NM, 100,
                    TranslationColumns.CDVA_NM, 200,
                    TranslationColumns.CO_CDVA_ABV_NM, 100,
                    TranslationColumns.CO_CDVA_SPS, 2000,
                    TranslationColumns.CO_C_INTN_CONE, 500);

    private final CmenumRepository menuRepository;
    private final CodeRepository codeRepository;
    private final ClangmRepository translationRepository;

    public TranslationEntryService(
            CmenumRepository menuRepository,
            CodeRepository codeRepository,
            ClangmRepository translationRepository) {
        this.menuRepository = menuRepository;
        this.codeRepository = codeRepository;
        this.translationRepository = translationRepository;
    }

    /**
     * 대상 구분의 활성 원본을 전부 나열하고 등록된 번역을 병합합니다.
     *
     * <p>번역이 없는 원본도 {@code translated=false}로 포함하므로 미번역 항목을 화면에서 찾을 수 있습니다.
     *
     * @param target 번역 대상 구분
     * @return 원본 순서를 유지한 번역 현황 목록
     */
    @Transactional(readOnly = true)
    public List<TranslationDto.Entry> findEntries(TranslationTarget target) {
        List<Draft> drafts =
                target == TranslationTarget.MENU ? menuDrafts() : commonCodeDrafts();
        Map<String, List<Clangm>> translations =
                findTranslations(target, drafts.stream().map(Draft::targetKey).toList());

        List<TranslationDto.Entry> entries = new ArrayList<>(drafts.size());
        for (Draft draft : drafts) {
            entries.add(toEntry(draft, translations.getOrDefault(draft.targetKey(), List.of())));
        }
        return entries;
    }

    private List<Draft> menuDrafts() {
        List<Draft> drafts = new ArrayList<>();
        for (Cmenum menu : menuRepository.findAllActive()) {
            drafts.add(
                    new Draft(
                            TranslationTargetKey.menu(menu.getMnuId()),
                            Map.of("mnuId", menu.getMnuId()),
                            menu.getMnuId(),
                            Map.of(TranslationColumns.MNU_NM, menu.getMnuNm())));
        }
        return drafts;
    }

    private List<Draft> commonCodeDrafts() {
        List<Draft> drafts = new ArrayList<>();
        for (Ccodem code : codeRepository.findAllActive()) {
            Map<String, String> koTexts = new LinkedHashMap<>();
            koTexts.put(TranslationColumns.CO_C_NM, code.getCNm());
            koTexts.put(TranslationColumns.CDVA_NM, code.getCdvaNm());
            koTexts.put(TranslationColumns.CO_CDVA_ABV_NM, code.getCdvaDes());
            koTexts.put(TranslationColumns.CO_CDVA_SPS, code.getCdvaDtl());
            koTexts.put(TranslationColumns.CO_C_INTN_CONE, code.getCTpDes());
            drafts.add(
                    new Draft(
                            TranslationTargetKey.code(
                                    code.getCId(), code.getCdva(), code.getSttDt()),
                            Map.of(
                                    "cId", code.getCId(),
                                    "cdva", code.getCdva(),
                                    "sttDt", code.getSttDt()),
                            code.getCId() + " / " + code.getCdva(),
                            koTexts));
        }
        return drafts;
    }

    private Map<String, List<Clangm>> findTranslations(
            TranslationTarget target, List<String> targetKeys) {
        Map<String, List<Clangm>> grouped = new LinkedHashMap<>();
        for (int from = 0; from < targetKeys.size(); from += ORACLE_IN_BATCH_SIZE) {
            List<String> batch =
                    List.copyOf(
                            targetKeys.subList(
                                    from,
                                    Math.min(from + ORACLE_IN_BATCH_SIZE, targetKeys.size())));
            for (Clangm row :
                    translationRepository.findActiveByTargetAndKeys(target.dbName(), batch)) {
                grouped.computeIfAbsent(row.getTcIdCone(), ignored -> new ArrayList<>()).add(row);
            }
        }
        return grouped;
    }

    private TranslationDto.Entry toEntry(Draft draft, List<Clangm> rows) {
        List<TranslationDto.ColumnValue> columns = new ArrayList<>();
        boolean translated = true;
        for (Map.Entry<String, String> koText : draft.koTexts().entrySet()) {
            Map<String, String> byLanguage = new LinkedHashMap<>();
            for (Clangm row : rows) {
                if (row.getTcColNm().equals(koText.getKey())
                        && row.getTcDes() != null
                        && !row.getTcDes().isBlank()) {
                    byLanguage.put(row.getDttLanC(), row.getTcDes());
                }
            }
            if (byLanguage.isEmpty()) {
                translated = false;
            }
            columns.add(
                    new TranslationDto.ColumnValue(
                            koText.getKey(),
                            koText.getValue(),
                            maxLengthOf(koText.getKey()),
                            byLanguage));
        }

        Clangm latest = null;
        for (Clangm row : rows) {
            if (latest == null || isAfter(row.getLstChgDtm(), latest.getLstChgDtm())) {
                latest = row;
            }
        }
        return new TranslationDto.Entry(
                draft.targetKey(),
                draft.source(),
                draft.label(),
                columns,
                translated,
                latest == null ? null : latest.getLstChgUsid(),
                latest == null ? null : latest.getLstChgDtm());
    }

    /** 원본 컬럼 길이와 번역 문구 길이 중 작은 값을 화면 입력 제한으로 씁니다. */
    private static int maxLengthOf(String columnName) {
        return Math.min(
                TRANSLATION_TEXT_MAX_LENGTH,
                SOURCE_COLUMN_LENGTHS.getOrDefault(columnName, TRANSLATION_TEXT_MAX_LENGTH));
    }

    private static boolean isAfter(LocalDateTime candidate, LocalDateTime current) {
        if (candidate == null) {
            return false;
        }
        return current == null || candidate.isAfter(current);
    }

    /** 원본 한 건에서 뽑아낸 병합 전 값입니다. */
    private record Draft(
            String targetKey,
            Map<String, String> source,
            String label,
            Map<String, String> koTexts) {}
}
```

`getLstChgDtm()` / `getLstChgUsid()`는 `BaseEntity`의 `@Getter`가 만든 것이고, `Cmenum`·`Ccodem`은 `@SuperBuilder`를 갖고 있어 테스트의 `builder()` 호출이 부모 필드(`delYn`)까지 받는다.

- [ ] **Step 7: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.service.TranslationEntryServiceTest"`
Expected: PASS (4 tests)

- [ ] **Step 8: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/i18n/service/TranslationEntryService.java src/main/java/com/kdb/it/common/i18n/dto/TranslationDto.java src/main/java/com/kdb/it/common/i18n/repository/ClangmRepository.java src/main/java/com/kdb/it/common/code/repository/CodeRepository.java src/test/java/com/kdb/it/common/i18n/service/TranslationEntryServiceTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m "feat: 원본·번역 병합 조회 서비스 TranslationEntryService 추가"
```

---

### Task 6: 번역 현황 조회 엔드포인트

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/i18n/controller/TranslationAdminController.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/i18n/controller/TranslationAdminControllerTest.java`

**Interfaces:**
- Consumes: `TranslationEntryService.findEntries(TranslationTarget)`
- Produces: `GET /api/admin/translations/{target}/entries` → `List<TranslationDto.Entry>`. Task 8의 프론트가 이 응답을 소비한다.

- [ ] **Step 1: 실패하는 컨트롤러 테스트 추가**

`TranslationAdminControllerTest.java`의 `@Mock` 선언 아래에 mock을 추가하고, 기존 테스트의 `new TranslationAdminController(service)` 호출을 모두 `new TranslationAdminController(service, entryService)`로 바꾼 뒤 다음 테스트를 추가한다:

```java
    @Mock TranslationEntryService entryService;

    @Test
    void 번역현황_목록을_대상별로_조회한다() {
        TranslationAdminController controller =
                new TranslationAdminController(service, entryService);
        var entries =
                List.of(
                        new TranslationDto.Entry(
                                "MNU0001001",
                                java.util.Map.of("mnuId", "MNU0001001"),
                                "MNU0001001",
                                List.of(
                                        new TranslationDto.ColumnValue(
                                                TranslationColumns.MNU_NM,
                                                "대시보드",
                                                100,
                                                java.util.Map.of("en", "Dashboard"))),
                                true,
                                "00000000000001",
                                java.time.LocalDateTime.of(2026, 8, 18, 9, 0)));
        when(entryService.findEntries(TranslationTarget.MENU)).thenReturn(entries);

        assertThat(controller.getEntries("menu").getBody()).isEqualTo(entries);
    }

    @Test
    void 번역현황_목록도_알수없는_대상을_거부한다() {
        TranslationAdminController controller =
                new TranslationAdminController(service, entryService);

        assertThatThrownBy(() -> controller.getEntries("project"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("project");
    }
```

필요한 import: `com.kdb.it.common.i18n.service.TranslationEntryService`.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.controller.TranslationAdminControllerTest"`
Expected: FAIL — 컴파일 오류(`constructor TranslationAdminController cannot be applied`)

- [ ] **Step 3: 엔드포인트 구현**

`TranslationAdminController.java`에 필드와 메서드를 추가한다. 클래스에 `@RequiredArgsConstructor`가 붙어 있으므로 `final` 필드를 추가하면 생성자가 두 인자로 확장된다.

```java
    private final TranslationCatalogService translationCatalogService;
    private final TranslationEntryService translationEntryService;

    /** 대상 구분의 원본 전체와 등록된 번역을 병합해 반환합니다. */
    @GetMapping("/{target}/entries")
    @Operation(summary = "대상별 번역 현황 목록")
    public ResponseEntity<List<TranslationDto.Entry>> getEntries(
            @PathVariable(name = "target") String target) {
        return ResponseEntity.ok(translationEntryService.findEntries(parseTarget(target)));
    }
```

import에 `com.kdb.it.common.i18n.service.TranslationEntryService`를 추가한다.

경로 충돌은 없다 — 기존 `GET /{target}`은 세그먼트 1개, 신규는 `/{target}/entries`로 2개다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_backend && ./gradlew test --tests "com.kdb.it.common.i18n.controller.TranslationAdminControllerTest"`
Expected: PASS (기존 3개 + 신규 2개)

- [ ] **Step 5: 백엔드 품질 게이트 실행**

Run: `cd it_backend && ./gradlew check`
Expected: BUILD SUCCESSFUL. 포맷 오류가 나면 spotless 계열 태스크 안내에 따라 포맷을 적용하고 다시 실행한다.

- [ ] **Step 6: 커밋**

```bash
git -C it_backend add src/main/java/com/kdb/it/common/i18n/controller/TranslationAdminController.java src/test/java/com/kdb/it/common/i18n/controller/TranslationAdminControllerTest.java
git -C it_backend diff --cached --stat
git -C it_backend commit -m "feat: 번역 현황 목록 조회 API 추가"
```

---

### Task 7: 관리자 메뉴 시드

**Files:**
- Create: `it_database/migrations/V20260818_002__SeedTranslationAdminMenu.sql`

**Interfaces:**
- Consumes: Task 1의 마이그레이션 버전 순서
- Produces: `SRE_PTH = '/admin/translations'`인 활성 메뉴 행. Task 10의 E2E가 이 메뉴로 화면에 진입한다.

- [ ] **Step 1: 시드 스크립트 작성**

`it_database/migrations/V20260818_002__SeedTranslationAdminMenu.sql`:

```sql
-- ============================================================================
-- 다국어 관리 관리자 메뉴 시드
-- ============================================================================
-- 메뉴·공통코드의 언어별 표시명을 관리하는 화면(/admin/translations)의 메뉴 행을 추가한다.
--
-- [부모 메뉴]
--   공통코드(MADM0005)·자격등급(MADM0006)·사용자(MADM0007)·역할(MADM0008)·조직(MADM0009)과
--   같은 데이터 정비 성격이므로 그 형제들의 부모인 MADM0004(데이터 관리)를 부모로 둔다.
--   V20260811_002·V20260813_001과 같은 판단이다.
--
-- [채번]
--   MNU_ID는 CmenumRepositoryImpl.nextMnuId()와 같은 형식('MNU' + SQ_TPRMPP_CMENUM_1
--   시퀀스를 7자리로 LPAD)을 SQL에서 재현한다.
--
-- [아이콘]
--   IMK_NM은 CSS 클래스로 바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족해야 한다.
--   'pi pi-language'를 쓰고 프론트 선택지 목록(utils/menuPresentation.ts MENU_ICON_OPTIONS)에도
--   같은 값을 추가해 메뉴관리 화면에서 재선택할 수 있게 한다.
--
-- [영문 메뉴명]
--   다국어 관리 화면 자체가 영어로도 표시되어야 하므로 TPRMPP_CLANGM에 영문 번역을 함께 넣는다.
--   V20260815_002와 같은 MERGE 패턴으로 재실행에 안전하다.
--
-- [재실행 안전]
--   같은 화면경로의 활성(DEL_YN='N') 메뉴가 이미 있으면 건너뛴다. 부모(MADM0004)가 없는
--   스키마에서도 조용히 건너뛴다.
-- ============================================================================

DECLARE
    c_parent_id   CONSTANT VARCHAR2(10) := 'MADM0004';
    c_sre_pth     CONSTANT VARCHAR2(40) := '/admin/translations';
    v_parent_path ITPOWN.TPRMPP_CMENUM.WHL_MNU_PTH%TYPE;
    v_parent_dep  ITPOWN.TPRMPP_CMENUM.MNU_DEP%TYPE;
    v_mnu_id      ITPOWN.TPRMPP_CMENUM.MNU_ID%TYPE;
    v_max_sort    NUMBER;
    v_exists      NUMBER;
BEGIN
    BEGIN
        SELECT WHL_MNU_PTH, MNU_DEP
          INTO v_parent_path, v_parent_dep
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE MNU_ID = c_parent_id
           AND DEL_YN = 'N';
    EXCEPTION
        WHEN NO_DATA_FOUND THEN
            RETURN; -- 데이터 관리 그룹이 없는 스키마는 시드 대상이 아니다
    END;

    SELECT COUNT(*)
      INTO v_exists
      FROM ITPOWN.TPRMPP_CMENUM
     WHERE SRE_PTH = c_sre_pth
       AND DEL_YN = 'N';

    IF v_exists = 0 THEN
        SELECT 'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0') INTO v_mnu_id FROM DUAL;

        SELECT NVL(MAX(MNU_SOT_SQN_SNO), 0)
          INTO v_max_sort
          FROM ITPOWN.TPRMPP_CMENUM
         WHERE HRK_MNU_ID = c_parent_id
           AND DEL_YN = 'N';

        INSERT INTO ITPOWN.TPRMPP_CMENUM (
            MNU_ID, HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO,
            HID_YN, MNU_DEP, WHL_MNU_PTH, IMK_NM,
            DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_USID, FST_ENR_DTM, LST_CHG_USID, LST_CHG_DTM
        ) VALUES (
            v_mnu_id, c_parent_id, '다국어 관리', 'PGE', c_sre_pth, v_max_sort + 10,
            'N', v_parent_dep + 1, v_parent_path || '/' || v_mnu_id, 'pi pi-language',
            'N',
            LOWER(REGEXP_REPLACE(RAWTOHEX(SYS_GUID()), '(.{8})(.{4})(.{4})(.{4})(.{12})', '\1-\2-\3-\4-\5')),
            1, 'MIGRATION', SYSDATE, 'MIGRATION', SYSDATE
        );
    END IF;
END;
/

MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT m.MNU_ID AS tc_id_cone
      FROM ITPOWN.TPRMPP_CMENUM m
     WHERE m.SRE_PTH = '/admin/translations'
       AND m.DEL_YN = 'N'
) source
ON (
    target.TC_ID_CONE = source.tc_id_cone
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = 'MNU_NM'
)
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.tc_id_cone, 'en', 'MNU_NM', 'Translations', '메뉴', 'N');

COMMIT;
```

- [ ] **Step 2: 마이그레이션 적용**

Run: `cd it_backend && ./gradlew bootRun`
Expected: `Migrating schema "ITPOWN" to version "20260818.002 - SeedTranslationAdminMenu"`. 확인 후 기동을 중단한다.

- [ ] **Step 3: 시드 결과 확인**

Run:

```bash
{ printf '%s\n' "$DB_PASSWORD"; echo "SELECT m.MNU_ID, m.MNU_NM, m.HRK_MNU_ID, m.IMK_NM, c.TC_DES FROM ITPOWN.TPRMPP_CMENUM m LEFT JOIN ITPOWN.TPRMPP_CLANGM c ON c.TC_ID_CONE = m.MNU_ID AND c.DTT_LAN_C = 'en' AND c.TC_COL_NM = 'MNU_NM' WHERE m.SRE_PTH = '/admin/translations' AND m.DEL_YN = 'N';"; } | sqlplus -S ITPAPP@127.0.0.1:11521/XEPDB1
```

Expected: 1행. `MNU_NM = 다국어 관리`, `HRK_MNU_ID = MADM0004`, `IMK_NM = pi pi-language`, `TC_DES = Translations`.

- [ ] **Step 4: 커밋**

```bash
git -C it_database add migrations/V20260818_002__SeedTranslationAdminMenu.sql
git -C it_database diff --cached --stat
git -C it_database commit -m "feat: 다국어 관리 화면 관리자 메뉴 시드"
```

---

### Task 8: 프론트 API 클라이언트 확장

**Files:**
- Modify: `it_frontend/app/composables/useAdminApi.ts`
- Modify: `it_frontend/app/types/api.d.ts` (생성물 — 직접 편집하지 않고 재생성)
- Test: `it_frontend/tests/unit/composables/useAdminApi.test.ts`

**Interfaces:**
- Consumes: Task 6의 `GET /api/admin/translations/{target}/entries`, 기존 `PUT /api/admin/translations/{target}?targetKey=`
- Produces:
  - 타입 `AdminTranslationTarget = 'menu' | 'common-code'`
  - 타입 `AdminTranslationEntryResponse`, `AdminTranslationColumnValue`, `AdminTranslationValueRequest`
  - `fetchTranslationEntries(target)`, `saveTranslations(target, targetKey, translations)`

- [ ] **Step 1: 실패하는 테스트 추가**

`it_frontend/tests/unit/composables/useAdminApi.test.ts`에 추가한다. 기존 파일의 mock 설정(`mockApiFetch`, `mockUseApiFetch` 등)을 그대로 재사용하고, 변수명이 다르면 파일의 실제 이름에 맞춘다.

```typescript
    describe('다국어 번역', () => {
        it('번역 현황 목록을 대상별 경로로 조회한다', () => {
            useAdminApi().fetchTranslationEntries('common-code');

            // fetchLogs와 같이 반응형 URL을 쓰므로 getter를 호출해 확인한다
            const [urlArg] = mockUseApiFetch.mock.calls[0];
            expect(typeof urlArg === 'function' ? urlArg() : urlArg).toBe(
                'http://localhost:28080/api/admin/translations/common-code/entries',
            );
        });

        it('번역 저장은 대상 키를 인코딩해 PUT으로 보낸다', async () => {
            await useAdminApi().saveTranslations('common-code', '8:ABUS_PPO3:0018:20260101', [
                { language: 'en', columnName: 'CDVA_NM', text: 'New Development' },
            ]);

            expect(mockApiFetch).toHaveBeenCalledWith(
                'http://localhost:28080/api/admin/translations/common-code?targetKey=8%3AABUS_PPO3%3A0018%3A20260101',
                {
                    method: 'PUT',
                    body: {
                        translations: [
                            { language: 'en', columnName: 'CDVA_NM', text: 'New Development' },
                        ],
                    },
                },
            );
        });
    });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useAdminApi.test.ts`
Expected: FAIL — `fetchTranslationEntries is not a function`

- [ ] **Step 3: 타입과 함수 추가**

`it_frontend/app/composables/useAdminApi.ts` — 파일의 타입 선언 영역에 추가:

```typescript
/** 번역 대상 구분 — 백엔드 TranslationTarget과 1:1 대응 */
export type AdminTranslationTarget = 'menu' | 'common-code';

/** 번역 대상 컬럼 한 개의 한국어 원문과 언어별 번역 */
export interface AdminTranslationColumnValue {
    columnName: string;
    koText: string | null;
    /** 원본 컬럼 길이와 TC_DES(2000) 중 작은 값 — 입력 제한에 그대로 쓴다 */
    maxLength: number;
    translations: Record<string, string>;
}

/** 원본 한 건과 그 번역 현황 */
export interface AdminTranslationEntryResponse {
    targetKey: string;
    source: Record<string, string>;
    label: string;
    columns: AdminTranslationColumnValue[];
    translated: boolean;
    lastChangedBy: string | null;
    lastChangedAt: string | null;
}

/** 저장 요청 한 건 — text가 빈 문자열이면 서버가 논리 삭제한다 */
export interface AdminTranslationValueRequest {
    language: string;
    columnName: string;
    text: string;
}
```

`useAdminApi()` 안, 공통코드 블록 뒤에 추가:

```typescript
    // ==========================================================================
    // 다국어 번역 (TPRMPP_CLANGM)
    // ==========================================================================

    /** 대상 구분의 원본 전체와 번역 현황 조회 — 대상이 바뀌면 자동 재조회한다(fetchLogs와 같은 형식) */
    const fetchTranslationEntries = (
        target: AdminTranslationTarget | Ref<AdminTranslationTarget>,
    ) =>
        useApiFetch<AdminTranslationEntryResponse[]>(
            () => `${BASE}/translations/${unref(target)}/entries`,
            { watch: [isRef(target) ? target : ref(target)] },
        );

    /** 번역 저장 — text가 빈 문자열이면 해당 번역이 논리 삭제된다 */
    const saveTranslations = (
        target: AdminTranslationTarget,
        targetKey: string,
        translations: AdminTranslationValueRequest[],
    ) =>
        $apiFetch(
            `${BASE}/translations/${target}?targetKey=${encodeURIComponent(targetKey)}`,
            { method: 'PUT', body: { translations } },
        );
```

반환 객체(`return { ... }`)에 `fetchTranslationEntries`, `saveTranslations`를 추가한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useAdminApi.test.ts`
Expected: PASS

- [ ] **Step 5: 백엔드 스펙 기준 타입 재생성**

백엔드를 기동한 상태에서 실행한다.

Run: `cd it_frontend && npm run codegen`
Expected: `app/types/api.d.ts`에 `/api/admin/translations/{target}/entries` 경로가 추가된다.

Run: `cd it_frontend && npm run codegen:check`
Expected: 드리프트 없음.

- [ ] **Step 6: 커밋**

```bash
git -C it_frontend add app/composables/useAdminApi.ts app/types/api.d.ts tests/unit/composables/useAdminApi.test.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m "feat: 다국어 번역 관리자 API 클라이언트 추가"
```

---

### Task 9: 번역 관리 화면 컴포저블

**Files:**
- Create: `it_frontend/app/composables/useAdminTranslationsPage.ts`
- Test: `it_frontend/tests/unit/composables/useAdminTranslationsPage.test.ts`

**Interfaces:**
- Consumes: Task 8의 `fetchTranslationEntries`, `saveTranslations`, `AdminTranslationEntryResponse`
- Produces: `useAdminTranslationsPage()` 반환 객체
  - 상태: `activeTarget`, `entries`, `pending`, `globalSearch`, `translationStatus`, `codeIdFilter`, `codeIdOptions`, `filteredEntries`, `dialogVisible`, `editingEntry`, `draft`, `saving`
  - 동작: `openDialog(entry)`, `closeDialog()`, `saveDialog()`, `buildPayload()`, `refresh()`

편집 대상 언어는 `en` 하나다. 지원 언어가 늘면 `draft`를 `Record<언어, Record<컬럼, string>>`으로 넓힌다.

- [ ] **Step 1: 실패하는 테스트 작성**

`it_frontend/tests/unit/composables/useAdminTranslationsPage.test.ts`:

```typescript
/**
 * ============================================================================
 * [tests/unit/composables/useAdminTranslationsPage.test.ts]
 * 다국어 관리 화면 컴포저블 계약
 * ============================================================================
 * 필터 규칙과 저장 페이로드 구성을 고정합니다. 저장 페이로드는 변경된 컬럼만 담아야
 * 하고, 빈 입력은 빈 문자열로 전송되어 서버에서 논리 삭제로 처리됩니다.
 * ============================================================================
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useAdminTranslationsPage } from '~/composables/useAdminTranslationsPage';
import type { AdminTranslationEntryResponse } from '~/composables/useAdminApi';

// useAdminApi와 primevue/usetoast는 컴포저블이 명시적으로 import하므로 vi.mock으로 대체한다
// (useAdminCodesPage.test.ts와 같은 경계). useI18n은 Nuxt 자동 import라 stubGlobal을 쓴다.
const mocks = vi.hoisted(() => ({
    fetchTranslationEntries: vi.fn(),
    saveTranslations: vi.fn(),
    toastAdd: vi.fn(),
}));

vi.mock('~/composables/useAdminApi', () => ({
    useAdminApi: () => ({
        fetchTranslationEntries: mocks.fetchTranslationEntries,
        saveTranslations: mocks.saveTranslations,
    }),
}));

vi.mock('primevue/usetoast', () => ({
    useToast: () => ({ add: mocks.toastAdd }),
}));

vi.stubGlobal('useI18n', () => ({ t: (key: string) => key }));

const menuEntry = (
    targetKey: string,
    koText: string,
    enText: string | null,
): AdminTranslationEntryResponse => ({
    targetKey,
    source: { mnuId: targetKey },
    label: targetKey,
    columns: [
        {
            columnName: 'MNU_NM',
            koText,
            maxLength: 100,
            translations: enText === null ? {} : { en: enText },
        },
    ],
    translated: enText !== null,
    lastChangedBy: enText === null ? null : '00000000000001',
    lastChangedAt: enText === null ? null : '2026-08-18T09:00:00',
});

describe('다국어 관리 화면 컴포저블', () => {
    beforeEach(() => {
        mocks.fetchTranslationEntries.mockReset();
        mocks.saveTranslations.mockReset();
        mocks.toastAdd.mockReset();
        mocks.fetchTranslationEntries.mockReturnValue({
            data: ref([
                menuEntry('MNU0001001', '대시보드', 'Dashboard'),
                menuEntry('MNU0001002', '예산', null),
            ]),
            pending: ref(false),
            refresh: vi.fn(),
        });
        mocks.saveTranslations.mockResolvedValue(undefined);
    });

    it('미번역 필터는 번역이 비어 있는 항목만 남긴다', () => {
        const page = useAdminTranslationsPage();

        page.translationStatus.value = 'untranslated';

        expect(page.filteredEntries.value.map((entry) => entry.targetKey)).toEqual([
            'MNU0001002',
        ]);
    });

    it('번역완료 필터는 번역이 모두 채워진 항목만 남긴다', () => {
        const page = useAdminTranslationsPage();

        page.translationStatus.value = 'translated';

        expect(page.filteredEntries.value.map((entry) => entry.targetKey)).toEqual([
            'MNU0001001',
        ]);
    });

    it('통합검색은 라벨과 한국어 원문과 번역을 모두 본다', () => {
        const page = useAdminTranslationsPage();

        page.globalSearch.value = 'Dashboard';

        expect(page.filteredEntries.value).toHaveLength(1);

        page.globalSearch.value = '예산';

        expect(page.filteredEntries.value.map((entry) => entry.targetKey)).toEqual([
            'MNU0001002',
        ]);
    });

    it('저장은 변경된 컬럼만 보낸다', async () => {
        const page = useAdminTranslationsPage();
        page.openDialog(menuEntry('MNU0001001', '대시보드', 'Dashboard'));

        page.draft.value.MNU_NM = 'Main Dashboard';
        await page.saveDialog();

        expect(mocks.saveTranslations).toHaveBeenCalledWith('menu', 'MNU0001001', [
            { language: 'en', columnName: 'MNU_NM', text: 'Main Dashboard' },
        ]);
    });

    it('변경이 없으면 저장을 호출하지 않고 다이얼로그만 닫는다', async () => {
        const page = useAdminTranslationsPage();
        page.openDialog(menuEntry('MNU0001001', '대시보드', 'Dashboard'));

        await page.saveDialog();

        expect(mocks.saveTranslations).not.toHaveBeenCalled();
        expect(page.dialogVisible.value).toBe(false);
    });

    it('번역을 비우면 빈 문자열로 보내 논리 삭제한다', async () => {
        const page = useAdminTranslationsPage();
        page.openDialog(menuEntry('MNU0001001', '대시보드', 'Dashboard'));

        page.draft.value.MNU_NM = '';
        await page.saveDialog();

        expect(mocks.saveTranslations).toHaveBeenCalledWith('menu', 'MNU0001001', [
            { language: 'en', columnName: 'MNU_NM', text: '' },
        ]);
    });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useAdminTranslationsPage.test.ts`
Expected: FAIL — `Failed to resolve import "~/composables/useAdminTranslationsPage"`

- [ ] **Step 3: 컴포저블 구현**

`it_frontend/app/composables/useAdminTranslationsPage.ts`:

```typescript
/**
 * ============================================================================
 * [composables/useAdminTranslationsPage.ts] 다국어 관리 화면 상태·동작
 * ============================================================================
 * /admin/translations 화면의 조회·필터·편집 다이얼로그 로직을 담습니다.
 * 편집 언어는 영어 하나이며, 지원 언어가 늘면 draft를 언어별 맵으로 넓힙니다.
 * ============================================================================
 */
import { useToast } from 'primevue/usetoast';
import {
    useAdminApi,
    type AdminTranslationEntryResponse,
    type AdminTranslationTarget,
    type AdminTranslationValueRequest,
} from '~/composables/useAdminApi';
import { TOAST_LIFE } from '~/utils/toast';

/** 번역 현황 필터 */
export type TranslationStatusFilter = 'all' | 'untranslated' | 'translated';

/** 편집 대상 언어 — 현재 지원 언어는 ko/en이고 ko는 원본이므로 편집 대상이 아니다 */
const EDIT_LANGUAGE = 'en';

export const useAdminTranslationsPage = () => {
    const { t } = useI18n();
    const toast = useToast();
    const { fetchTranslationEntries, saveTranslations } = useAdminApi();

    const activeTarget = ref<AdminTranslationTarget>('menu');
    const globalSearch = ref('');
    const translationStatus = ref<TranslationStatusFilter>('all');
    const codeIdFilter = ref<string | null>(null);
    const dialogVisible = ref(false);
    const editingEntry = ref<AdminTranslationEntryResponse | null>(null);
    const draft = ref<Record<string, string>>({});
    const saving = ref(false);

    // 대상 구분 ref를 그대로 넘기면 useApiFetch가 URL 변경을 감지해 재조회한다
    const { data, pending, refresh } = fetchTranslationEntries(activeTarget);

    const entries = computed<AdminTranslationEntryResponse[]>(() => data.value ?? []);

    /** 대상 구분이 바뀌면 이전 탭의 필터가 새 목록에 남지 않도록 초기화한다 */
    watch(activeTarget, () => {
        globalSearch.value = '';
        translationStatus.value = 'all';
        codeIdFilter.value = null;
    });

    /** 공통코드 탭의 코드ID 선택지 */
    const codeIdOptions = computed(() =>
        [...new Set(entries.value.map((entry) => entry.source.cId).filter(Boolean))].sort(),
    );

    const filteredEntries = computed(() => {
        const keyword = globalSearch.value.trim().toLowerCase();
        return entries.value.filter((entry) => {
            if (translationStatus.value === 'translated' && !entry.translated) {
                return false;
            }
            if (translationStatus.value === 'untranslated' && entry.translated) {
                return false;
            }
            if (codeIdFilter.value && entry.source.cId !== codeIdFilter.value) {
                return false;
            }
            if (!keyword) {
                return true;
            }
            const haystack = [
                entry.label,
                ...entry.columns.map((column) => column.koText ?? ''),
                ...entry.columns.flatMap((column) => Object.values(column.translations)),
            ]
                .join(' ')
                .toLowerCase();
            return haystack.includes(keyword);
        });
    });

    /** 행 편집을 시작하고 현재 번역을 초안으로 복사한다 */
    const openDialog = (entry: AdminTranslationEntryResponse) => {
        editingEntry.value = entry;
        draft.value = Object.fromEntries(
            entry.columns.map((column) => [
                column.columnName,
                column.translations[EDIT_LANGUAGE] ?? '',
            ]),
        );
        dialogVisible.value = true;
    };

    const closeDialog = () => {
        dialogVisible.value = false;
        editingEntry.value = null;
        draft.value = {};
    };

    /** 초안과 원본 번역을 비교해 변경된 컬럼만 저장 요청으로 만든다 */
    const buildPayload = (): AdminTranslationValueRequest[] => {
        const entry = editingEntry.value;
        if (!entry) {
            return [];
        }
        return entry.columns
            .filter(
                (column) =>
                    (draft.value[column.columnName] ?? '') !==
                    (column.translations[EDIT_LANGUAGE] ?? ''),
            )
            .map((column) => ({
                language: EDIT_LANGUAGE,
                columnName: column.columnName,
                text: draft.value[column.columnName] ?? '',
            }));
    };

    /** 변경분을 저장한다. 변경이 없으면 요청 없이 닫는다. */
    const saveDialog = async () => {
        const entry = editingEntry.value;
        const payload = buildPayload();
        if (!entry || payload.length === 0) {
            closeDialog();
            return;
        }
        saving.value = true;
        try {
            await saveTranslations(activeTarget.value, entry.targetKey, payload);
            toast.add({
                severity: 'success',
                summary: t('admin.translations.toast.saved'),
                detail: t('admin.translations.toast.savedDetail'),
                life: TOAST_LIFE.NORMAL,
            });
            closeDialog();
            await refresh();
        } catch {
            toast.add({
                severity: 'error',
                summary: t('admin.translations.toast.saveFailed'),
                detail: t('admin.translations.toast.saveFailedDetail'),
                life: TOAST_LIFE.LONG,
            });
        } finally {
            saving.value = false;
        }
    };

    return {
        activeTarget,
        entries,
        pending,
        globalSearch,
        translationStatus,
        codeIdFilter,
        codeIdOptions,
        filteredEntries,
        dialogVisible,
        editingEntry,
        draft,
        saving,
        openDialog,
        closeDialog,
        saveDialog,
        buildPayload,
        refresh,
    };
};
```

`saveDialog()`의 `refresh()`는 저장 후 서버 상태를 다시 읽어 상태 배지와 최종변경 정보를 갱신하기 위한 것이다. 대상 구분 변경에 따른 재조회는 `useApiFetch`의 반응형 URL이 처리하므로 `watch`에서 다시 부르지 않는다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd it_frontend && npx vitest run tests/unit/composables/useAdminTranslationsPage.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git -C it_frontend add app/composables/useAdminTranslationsPage.ts tests/unit/composables/useAdminTranslationsPage.test.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m "feat: 다국어 관리 화면 컴포저블 추가"
```

---

### Task 10: 번역 관리 화면과 문구

**Files:**
- Create: `it_frontend/app/pages/admin/translations.vue`
- Modify: `it_frontend/i18n/messages/admin.ts` (ko 블록과 en 블록 양쪽)
- Modify: `it_frontend/app/utils/menuPresentation.ts:19` (`MENU_ICON_OPTIONS`)

**Interfaces:**
- Consumes: Task 9의 `useAdminTranslationsPage()`
- Produces: 라우트 `/admin/translations`. Task 11의 E2E가 이 화면을 조작한다.

- [ ] **Step 1: i18n 문구 추가**

`it_frontend/i18n/messages/admin.ts`의 **ko 블록**(파일 앞쪽, `codes:` 인접 위치)에 추가:

```typescript
            translations: {
                title: '다국어 관리',
                subtitle: 'TPRMPP_CLANGM — 메뉴·공통코드 언어별 표시명 관리',
                cardTitle: '번역 현황',
                searchPlaceholder: '식별자, 한국어 원문, 영어 번역 검색...',
                targets: {
                    menu: '메뉴',
                    commonCode: '공통코드',
                },
                status: {
                    all: '전체',
                    untranslated: '미번역',
                    translated: '번역완료',
                    fallbackBadge: '한국어 대체 표시',
                    doneBadge: '번역완료',
                },
                filters: {
                    codeId: '공통코드ID',
                    codeIdPlaceholder: '전체',
                },
                columns: {
                    identifier: '식별자',
                    korean: '한국어 원문',
                    english: '영어 번역',
                    status: '상태',
                    lastChanged: '최종변경',
                },
                dialog: {
                    title: '번역 편집',
                    korean: '한국어 원문',
                    english: '영어 번역',
                    emptyHint: '비워서 저장하면 등록된 번역이 삭제됩니다.',
                },
                toast: {
                    saved: '저장 완료',
                    savedDetail: '번역이 저장되었습니다.',
                    saveFailed: '저장 실패',
                    saveFailedDetail: '번역 저장 중 오류가 발생했습니다.',
                },
            },
```

같은 파일의 **en 블록**(파일 뒤쪽, 626행 이후의 `menus:`/`codes:`와 같은 위치)에 대응 키를 추가:

```typescript
            translations: {
                title: 'Translations',
                subtitle: 'TPRMPP_CLANGM — Manage localized names for menus and common codes',
                cardTitle: 'Translation status',
                searchPlaceholder: 'Search identifier, Korean source, English translation...',
                targets: {
                    menu: 'Menus',
                    commonCode: 'Common codes',
                },
                status: {
                    all: 'All',
                    untranslated: 'Not translated',
                    translated: 'Translated',
                    fallbackBadge: 'Shows Korean',
                    doneBadge: 'Translated',
                },
                filters: {
                    codeId: 'Code ID',
                    codeIdPlaceholder: 'All',
                },
                columns: {
                    identifier: 'Identifier',
                    korean: 'Korean source',
                    english: 'English translation',
                    status: 'Status',
                    lastChanged: 'Last changed',
                },
                dialog: {
                    title: 'Edit translation',
                    korean: 'Korean source',
                    english: 'English translation',
                    emptyHint: 'Saving an empty value removes the existing translation.',
                },
                toast: {
                    saved: 'Saved',
                    savedDetail: 'The translation has been saved.',
                    saveFailed: 'Save failed',
                    saveFailedDetail: 'An error occurred while saving the translation.',
                },
            },
```

메뉴 아이콘 라벨도 양쪽 `admin.menus.icons`에 추가한다 — ko: `language: '다국어'`, en: `language: 'Language'`.

- [ ] **Step 2: 메뉴 아이콘 선택지 추가**

`it_frontend/app/utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS` 배열에 추가:

```typescript
    { labelKey: 'admin.menus.icons.language', value: 'pi pi-language' },
```

- [ ] **Step 3: 화면 작성**

`it_frontend/app/pages/admin/translations.vue`:

```vue
<!--
================================================================================
[pages/admin/translations.vue] 다국어 관리 페이지
================================================================================
관리자가 메뉴·공통코드의 언어별 표시명(TPRMPP_CLANGM)을 관리하는 화면입니다.

[주요 기능]
  - 대상 구분(메뉴/공통코드) 전환
  - 통합검색 + 번역상태 필터 + 공통코드ID 필터
  - 행 클릭 시 편집 다이얼로그에서 한국어 원문 대비 영어 번역 입력
  - 영어 입력을 비우고 저장하면 해당 번역 행이 논리 삭제됨

[연동 API]
  - GET /api/admin/translations/:target/entries
  - PUT /api/admin/translations/:target?targetKey=...
================================================================================
-->
<script setup lang="ts">
import PageHeader from '~/components/common/PageHeader.vue';
import TableCard from '~/components/common/TableCard.vue';
import TableSearchInput from '~/components/common/TableSearchInput.vue';
import StyledDataTable from '~/components/common/StyledDataTable.vue';
import AppDialogFooter from '~/components/common/AppDialogFooter.vue';
import EmployeeLink from '~/components/common/EmployeeLink.vue';
import { formatDateTime } from '~/utils/common';
import { useAdminTranslationsPage } from '~/composables/useAdminTranslationsPage';

definePageMeta({ middleware: 'admin' });

const { t } = useI18n();
const {
    activeTarget,
    pending,
    globalSearch,
    translationStatus,
    codeIdFilter,
    codeIdOptions,
    filteredEntries,
    dialogVisible,
    editingEntry,
    draft,
    saving,
    openDialog,
    closeDialog,
    saveDialog,
} = useAdminTranslationsPage();

/** 대상 구분 선택지 */
const targetOptions = computed(() => [
    { label: t('admin.translations.targets.menu'), value: 'menu' as const },
    { label: t('admin.translations.targets.commonCode'), value: 'common-code' as const },
]);

/** 번역상태 필터 선택지 */
const statusOptions = computed(() => [
    { label: t('admin.translations.status.all'), value: 'all' as const },
    { label: t('admin.translations.status.untranslated'), value: 'untranslated' as const },
    { label: t('admin.translations.status.translated'), value: 'translated' as const },
]);

/** 목록에 대표로 보여줄 컬럼 — 메뉴는 MNU_NM, 공통코드는 CDVA_NM */
const primaryColumnName = computed(() =>
    activeTarget.value === 'menu' ? 'MNU_NM' : 'CDVA_NM',
);

const primaryColumn = (entry: (typeof filteredEntries.value)[number]) =>
    entry.columns.find((column) => column.columnName === primaryColumnName.value);
</script>

<template>
    <div class="flex flex-col h-full gap-4">
        <PageHeader
            :title="t('admin.translations.title')"
            :subtitle="t('admin.translations.subtitle')"
        />

        <TableCard
            fill
            icon="pi-language"
            :title="t('admin.translations.cardTitle')"
            :count="filteredEntries.length"
        >
            <template #toolbar>
                <SelectButton
                    v-model="activeTarget"
                    :options="targetOptions"
                    option-label="label"
                    option-value="value"
                    :allow-empty="false"
                />
                <TableSearchInput
                    v-model="globalSearch"
                    :placeholder="t('admin.translations.searchPlaceholder')"
                    width="26rem"
                />
                <Select
                    v-model="translationStatus"
                    :options="statusOptions"
                    option-label="label"
                    option-value="value"
                />
                <Select
                    v-if="activeTarget === 'common-code'"
                    v-model="codeIdFilter"
                    :options="codeIdOptions"
                    :placeholder="t('admin.translations.filters.codeIdPlaceholder')"
                    show-clear
                    filter
                />
                <div class="flex-1" />
            </template>

            <div class="flex-1 min-h-0 flex flex-col">
                <StyledDataTable
                    :value="filteredEntries"
                    :loading="pending"
                    data-key="targetKey"
                    scrollable
                    scroll-height="flex"
                    selection-mode="single"
                    @row-click="openDialog($event.data)"
                >
                    <Column
                        :header="t('admin.translations.columns.identifier')"
                        header-style="width: var(--col-md)"
                    >
                        <template #body="{ data }">{{ data.label }}</template>
                    </Column>

                    <Column :header="t('admin.translations.columns.korean')">
                        <template #body="{ data }">{{ primaryColumn(data)?.koText }}</template>
                    </Column>

                    <Column :header="t('admin.translations.columns.english')">
                        <template #body="{ data }">
                            {{ primaryColumn(data)?.translations.en }}
                        </template>
                    </Column>

                    <Column
                        :header="t('admin.translations.columns.status')"
                        header-style="width: var(--col-sm); text-align: center"
                        body-style="text-align: center"
                    >
                        <template #body="{ data }">
                            <Tag
                                v-if="data.translated"
                                :value="t('admin.translations.status.doneBadge')"
                                severity="success"
                                class="text-xs"
                            />
                            <Tag
                                v-else
                                :value="t('admin.translations.status.fallbackBadge')"
                                severity="warn"
                                class="text-xs"
                            />
                        </template>
                    </Column>

                    <Column
                        :header="t('admin.translations.columns.lastChanged')"
                        header-style="width: var(--col-md)"
                    >
                        <template #body="{ data }">
                            <div v-if="data.lastChangedBy" class="flex flex-col">
                                <EmployeeLink :eno="data.lastChangedBy" />
                                <span class="text-xs text-muted-color">
                                    {{ formatDateTime(data.lastChangedAt) }}
                                </span>
                            </div>
                        </template>
                    </Column>
                </StyledDataTable>
            </div>
        </TableCard>

        <Dialog
            v-model:visible="dialogVisible"
            modal
            :header="t('admin.translations.dialog.title')"
            :style="{ width: '48rem' }"
            @hide="closeDialog"
        >
            <div v-if="editingEntry" class="flex flex-col gap-4">
                <p class="text-sm text-muted-color">{{ editingEntry.label }}</p>
                <div
                    v-for="column in editingEntry.columns"
                    :key="column.columnName"
                    class="flex flex-col gap-2"
                >
                    <label class="text-sm font-medium">{{ column.columnName }}</label>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-muted-color">
                                {{ t('admin.translations.dialog.korean') }}
                            </span>
                            <InputText :model-value="column.koText ?? ''" readonly />
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-xs text-muted-color">
                                {{ t('admin.translations.dialog.english') }}
                            </span>
                            <InputText
                                v-model="draft[column.columnName]"
                                :maxlength="column.maxLength"
                            />
                        </div>
                    </div>
                </div>
                <p class="text-xs text-muted-color">
                    {{ t('admin.translations.dialog.emptyHint') }}
                </p>
            </div>

            <template #footer>
                <!-- AppDialogFooter는 버튼을 우측 정렬로 감싸는 슬롯 래퍼다(props·emit 없음) -->
                <AppDialogFooter>
                    <Button
                        :label="t('common.actions.cancel')"
                        severity="secondary"
                        class="btn-neutral"
                        @click="closeDialog"
                    />
                    <Button
                        :label="t('common.actions.save')"
                        :loading="saving"
                        @click="saveDialog"
                    />
                </AppDialogFooter>
            </template>
        </Dialog>
    </div>
</template>
```

- [ ] **Step 4: 정적 검사 실행**

Run: `cd it_frontend && npm run format:check && npm run check`
Expected: 통과. `check:copy` ratchet이 하드코딩 문구를 지적하면 해당 문구를 i18n 키로 옮긴다.

- [ ] **Step 5: 단위 테스트 전체 실행**

Run: `cd it_frontend && npm test`
Expected: 전부 PASS. i18n 키 병렬성(ko/en 동일 구조)을 검사하는 테스트가 있으면 여기서 누락 키가 드러난다.

- [ ] **Step 6: 커밋**

```bash
git -C it_frontend add app/pages/admin/translations.vue i18n/messages/admin.ts app/utils/menuPresentation.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m "feat: 관리자 다국어 관리 화면 추가"
```

---

### Task 11: E2E 검증과 문서·버전 고정

**Files:**
- Create: `it_frontend/tests/e2e/admin/translations.spec.ts`
- Modify: `README.md` (루트, 변경 이력)
- Modify: `versions.lock` (루트, 스크립트로 갱신)

**Interfaces:**
- Consumes: Task 1~10 전체
- Produces: 없음(최종 검증)

- [ ] **Step 1: 기존 관리자 E2E 형식 확인**

Run: `cd it_frontend && sed -n '1,40p' tests/e2e/admin/realtime-logs.spec.ts`
Expected: 로그인 상태 주입 방식(`auth.setup.ts` 기반 storageState 등)과 `test.describe` 형식을 확인한다. 아래 스펙의 헤더를 그 형식에 맞춘다.

- [ ] **Step 2: E2E 스펙 작성**

`it_frontend/tests/e2e/admin/translations.spec.ts` — 로그인 처리는 Step 1에서 확인한 형식을 따른다.

```typescript
import { expect, test } from '@playwright/test';

test.describe('관리자 다국어 관리', () => {
    test('메뉴 영어 번역을 저장하면 상태가 번역완료로 바뀐다', async ({ page }) => {
        await page.goto('/admin/translations');

        // 미번역 항목만 남긴 뒤 첫 행을 연다
        await page.getByRole('combobox').first().click();
        await page.getByRole('option', { name: '미번역' }).click();

        const firstRow = page.locator('tbody tr').first();
        await expect(firstRow).toBeVisible();
        const identifier = await firstRow.locator('td').first().innerText();
        await firstRow.click();

        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        await dialog.locator('input:not([readonly])').first().fill('E2E Translated');
        await dialog.getByRole('button', { name: '저장' }).click();

        await expect(dialog).toBeHidden();
        await page.getByRole('combobox').first().click();
        await page.getByRole('option', { name: '번역완료' }).click();
        await expect(page.locator('tbody tr', { hasText: identifier })).toBeVisible();
    });
});
```

- [ ] **Step 3: 두 서버 기동 후 E2E 실행**

백엔드(`cd it_backend && ./gradlew bootRun`)와 프론트(`cd it_frontend && npm run dev`)를 각각 띄운 뒤 실행한다.

Run: `cd it_frontend && npm run test:e2e -- tests/e2e/admin/translations.spec.ts`
Expected: PASS

- [ ] **Step 4: 전체 게이트 실행**

Run:

```bash
cd it_backend && ./gradlew check
```

Run:

```bash
cd it_frontend && npm run check && npm test && npm run codegen:check
```

Expected: 모두 통과.

- [ ] **Step 5: 로그 화면 육안 확인**

브라우저에서 `/admin/translations`로 번역을 한 건 수정한 뒤 `/admin/logs/clangm`을 연다.
Expected: 방금 변경이 `변경구분여부 U`(신규 등록이면 `C`)로 최상단에 보이고, 상세에서 `TC_DES` 변경 전후를 확인할 수 있다.

- [ ] **Step 6: E2E 커밋**

```bash
git -C it_frontend add tests/e2e/admin/translations.spec.ts
git -C it_frontend diff --cached --stat
git -C it_frontend commit -m "test: 관리자 다국어 관리 화면 E2E 추가"
```

- [ ] **Step 7: 문서와 버전 고정**

`README.md`의 변경 이력에 한 줄을 추가한다(기존 항목 형식을 따른다):

```markdown
- 2026-08-18: 다국어 번역 변경로그(TPRMPP_CLANGL) 추가와 관리자 다국어 관리 화면(/admin/translations) 신설
```

Run: `pwsh -File scripts/update-versions-lock.ps1`
Expected: `versions.lock`의 세 저장소 커밋 해시가 갱신된다.

```bash
git add README.md versions.lock
git diff --cached --stat
git commit -m "docs: 다국어 관리 화면·변경로그 반영 및 버전 고정"
```

---

## 실행 순서 요약

| 순서 | 태스크    | 저장소                    | 산출물                             |
| ---- | --------- | ------------------------- | ---------------------------------- |
| 1    | Task 1    | it_database, it_backend   | `TPRMPP_CLANGL` + 시퀀스           |
| 2    | Task 2~4  | it_backend                | 로그 엔티티·연결·적재 검증         |
| 3    | Task 5~6  | it_backend                | 번역 현황 조회 서비스·API          |
| 4    | Task 7    | it_database               | 관리자 메뉴 시드                   |
| 5    | Task 8~10 | it_frontend               | API 클라이언트·컴포저블·화면       |
| 6    | Task 11   | it_frontend, 루트         | E2E, 문서, `versions.lock`         |

Task 1은 Task 2의 선행이고, Task 6은 Task 8의 선행이다(백엔드 계약 커밋 우선 규칙). Task 7은 Task 1 이후 아무 때나 넣을 수 있으나 마이그레이션 버전 순서상 Task 1 뒤여야 한다.
