# 다국어 번역 변경로그와 관리자 다국어 관리 화면 설계

작성일: 2026-08-18

## 1. 배경

`TPRMPP_CLANGM`(구분언어마스터)은 `V20260815_001__CreateLanguageTranslationMaster.sql`로 도입되어
메뉴와 공통코드의 언어별 표시명을 저장하고 있다. 두 가지가 비어 있다.

첫째, 다른 마스터 테이블과 달리 변경로그 테이블이 없다. `TPRMPP_CCODEM`은 `TPRMPP_CCODEL`,
`TPRMPP_CAPPLM`은 `TPRMPP_CAPPLL`을 갖는데 `TPRMPP_CLANGM`만 이력이 남지 않는다. 번역 문구는
사용자 화면에 그대로 노출되므로 누가 언제 무엇을 바꿨는지 추적할 수 있어야 한다.

둘째, 관리자 API `/api/admin/translations/{target}`(GET/PUT)은 구현되어 있으나 이를 사용하는
화면이 없다. 현재 번역 등록·수정은 DB 직접 조작이나 시드 마이그레이션으로만 가능하다.
`2026-08-15-multilingual-i18n-design.md` §6.6이 계획한 관리자 UI가 미구현 상태다.

## 2. 목표

1. `TPRMPP_CLANGM`의 생성·수정·논리삭제를 `TPRMPP_CLANGL`에 자동 기록한다.
2. 관리자가 기존 공용 로그 화면에서 번역 변경 이력을 조회한다.
3. 관리자가 전용 화면에서 메뉴·공통코드의 영어 번역을 등록·수정·삭제한다.
4. 아직 번역되지 않은 원본을 화면에서 발견할 수 있다.

## 3. 범위 밖

- 지원 언어 추가(현재 `SupportedLanguage`는 ko/en). 언어가 늘면 화면은 그대로 두고
  enum과 다이얼로그 입력 쌍만 확장한다.
- 번역 대상 구분 추가. `TranslationTarget` enum(메뉴/공통코드) 확장이 선행되어야 한다.
- 기존 `/admin/menus`, `/admin/codes` 화면 변경. 번역 편집 창구는 전용 화면 하나로 둔다.
- 번역 항목별 이력 조회 화면. 이력은 공용 로그 화면(`/admin/logs/clangm`)에서만 본다.

## 4. 설계 결정

### 4.1 관리자 화면 형태 — 전용 화면 신설

`2026-08-15-multilingual-i18n-design.md` §6.6은 `/admin/menus`, `/admin/codes` 편집
다이얼로그 안에 영어 입력 영역을 추가하는 안이었다. 전용 화면으로 바꾼다.

- `codes.vue`(732줄), `menus/index.vue`(657줄)를 더 키우지 않는다.
- 번역 누락 항목을 대상 구분에 상관없이 한 화면에서 필터로 찾을 수 있다.
- 같은 저장 로직이 두 화면에 중복되지 않는다.

### 4.2 목록 기준 — 원본 기준 전체

`TPRMPP_CLANGM`에 저장된 행만 나열하면 아직 번역하지 않은 메뉴·공통코드를 화면에서
찾을 수 없다. 원본 마스터(`TPRMPP_CMENUM`, `TPRMPP_CCODEM`)의 활성 행을 전부 나열하고
번역이 없는 행은 `한국어 대체 표시` 상태로 보여준다.

### 4.3 목록 조회 위치 — 백엔드 통합 조회

원본과 번역의 병합을 백엔드에서 수행하고 프론트는 완성된 목록을 한 번 받는다.
공통코드의 번역 대상 키는 `TranslationTargetKey.code()`가 만드는 길이-prefix 형식
(`4:CO_C` + `3:001` + `8:20260101`)이다. 프론트에서 원본과 번역을 조인하려면 이 규칙을
클라이언트에 복제해야 하고, 규칙이 어긋나면 오류 없이 다른 행에 저장된다. 키 생성 규칙은
백엔드에만 둔다.

DB 뷰를 만드는 안은 메뉴와 공통코드의 컬럼 집합이 달라 뷰 하나로 묶기 어렵고 Flyway
관리 대상만 늘어나므로 채택하지 않는다.

### 4.4 이력 노출 — 공용 로그 화면에만 등록

`AdminLogService.buildDefinitions()`에 정의 한 줄을 추가하면 `/admin/logs/clangm`이
기존 로그 19종과 동일한 검색·페이징·상세를 제공한다. 전용 화면의 항목별 이력 패널은
대상 키 필터 조회 API가 추가로 필요한 데 비해 얻는 것이 적어 두지 않는다.

### 4.5 편집 UX — 행 클릭 편집 다이얼로그

공통코드의 번역 대상 컬럼은 5개(`CO_C_NM`, `CDVA_NM`, `CO_CDVA_ABV_NM`, `CO_CDVA_SPS`,
`CO_C_INTN_CONE`)다. 표에 모두 펼치면 가로 스크롤이 길어진다. 목록에는 대표 컬럼만 두고
다이얼로그에서 한국어 원문과 영어 입력을 쌍으로 배치한다.

## 5. 데이터 계층

### 5.1 `V20260818_001__CreateClangmChangeLog.sql`

`ITPOWN.TPRMPP_CLANGL`을 생성한다. 컬럼은 마스터 업무 컬럼 5개와 `BaseLogEntity` 공통
컬럼으로 구성한다.

| 컬럼              | 타입               | NULL | 비고                          |
| ----------------- | ------------------ | ---- | ----------------------------- |
| `LOG_HIS_TGR_SNO` | NUMBER(18)         | N    | PK. `SQ_TPRMPP_CLANGL_1` 발급 |
| `TC_ID_CONE`      | VARCHAR2(255 CHAR) | N    | 마스터 PK 컬럼                |
| `DTT_LAN_C`       | VARCHAR2(2 CHAR)   | N    | 마스터 PK 컬럼                |
| `TC_COL_NM`       | VARCHAR2(255 CHAR) | N    | 마스터 PK 컬럼                |
| `TC_DES`          | VARCHAR2(2000 CHAR)| Y    |                               |
| `DTT_NM`          | VARCHAR2(100 CHAR) | Y    |                               |
| `CHG_DTT_YN`      | VARCHAR2(1 CHAR)   | Y    | C/U/D                         |
| `CHG_DTM`         | DATE               | N    |                               |
| `CHG_USID`        | VARCHAR2(14 CHAR)  | Y    |                               |
| `FST_ENR_USID`    | VARCHAR2(14 CHAR)  | N    | 기본값 `'00000000000000'`     |
| `FST_ENR_DTM`     | DATE               | N    | 기본값 `SYSDATE`              |
| `DEL_YN`          | VARCHAR2(1 CHAR)   | N    | 기본값 `'N'`                  |
| `GUID`            | VARCHAR2(38 CHAR)  | N    | 기본값 `'000...0'`(38자)      |
| `GUID_PRG_SNO`    | NUMBER(4)          | N    | 기본값 `0`                    |
| `LST_CHG_USID`    | VARCHAR2(14 CHAR)  | N    | 기본값 `'00000000000000'`     |
| `LST_CHG_DTM`     | DATE               | N    | 기본값 `SYSDATE`              |

라이브 `TPRMPP_CCODEL` DDL(`it_database/ITPOWN_DDL_live.sql:1791`)과 같은 규칙이다.
마스터 PK 컬럼만 `NOT NULL`이고 나머지 업무 컬럼은 NULL을 허용한다. PK는
`PK_CLANGL(LOG_HIS_TGR_SNO)` 단일이다.

마스터의 `CK_CLANGM_DTT_COL` 체크 제약은 복제하지 않는다. 로그는 과거 시점 스냅샷이므로
번역 대상 컬럼 집합이 나중에 바뀌면 이미 적재된 과거 행이 제약을 위반한다.

보조 인덱스를 두지 않는다. 공용 로그 화면의 조회는 `order by e.logSno desc`
(`AdminLogService.java:69`) 하나뿐이라 PK 인덱스로 충분하고, 기존 `*L` 테이블도 PK만 갖는다.

같은 스크립트에서 시퀀스를 생성한다.

```sql
CREATE SEQUENCE ITPOWN.SQ_TPRMPP_CLANGL_1
    START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE MAXVALUE 999999999999999000;
```

`MAXVALUE`는 `V20260730_003__NormalizeSequenceMaxValues.sql`이 통일한 기준값이다.
스키마와 시퀀스 정의의 SoT는 `it_database/migrations`의 Flyway 이력이며,
백엔드 리소스에는 별도 참조용 DDL 사본을 두지 않는다.

검증 스크립트는 `it_database/docs/verification/V20260818_001__CreateClangmChangeLog.verify.sql`에
둔다(기존 `V20260815_001` 검증 스크립트와 같은 위치·형식).

### 5.2 `V20260818_002__SeedTranslationAdminMenu.sql`

`/admin/translations` 메뉴 행을 추가한다. `V20260811_002__SeedMigrationAdminMenu.sql`과
동일한 패턴이다.

- 부모: `MADM0004`(데이터 관리). 공통코드(`MADM0005`)·자격등급·사용자·역할·조직과 같은
  데이터 정비 성격이다.
- `MNU_ID`: `'MNU' || LPAD(ITPOWN.SQ_TPRMPP_CMENUM_1.NEXTVAL, 7, '0')`
- `IMK_NM`: `pi pi-language`. `^[a-z0-9 -]{1,100}$`를 만족한다. 프론트
  `utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS`에도 같은 값을 추가한다.
- `MNU_SOT_SQN_SNO`: 형제 중 최대값 + 1
- 재실행 안전: 같은 `SRE_PTH`의 활성(`DEL_YN='N'`) 행이 있으면 건너뛴다. 부모가 없는
  스키마에서도 조용히 건너뛴다.

`TPRMPP_CMENUD`(화면경로 카탈로그) 행은 추가하지 않는다. 기존 관리자 화면 시드도
`SRE_PTH`를 메뉴 행에 직접 넣는다.

## 6. 백엔드

### 6.1 감사 로그 연결

배선은 세 곳이다.

1. `com.kdb.it.domain.log.entity.ClangmL extends BaseLogEntity` 신설. 필드는
   `tcIdCone`, `dttLanC`, `tcColNm`, `tcDes`, `dttNm` 다섯 개이며 각 `@Column(name)`이
   마스터 `Clangm`과 정확히 일치해야 한다. `AuditLogPersister.copyColumnFields()`가
   `@Column(name)` 기준으로 값을 복사하므로, 이름이 어긋나면 예외 없이 값이 비어 적재된다.
2. `Clangm`에 `@LogTarget(entity = ClangmL.class)` 추가. `BaseEntity`가 이미
   `ChangeLogEntityListener`를 등록하고 있어 다른 설정은 필요 없다. 번역 생성(C), 수정(U),
   `delete()` 논리삭제(D)가 모두 기록된다.
3. `AdminLogService.buildDefinitions()`에
   `new LogDefinition("clangm", "다국어 번역 로그", ClangmL.class)` 추가.

로그 키는 마스터 기준으로 이름 짓는 기존 관례(`ccodem`, `capplm`)를 따라 `clangm`으로 한다.

### 6.2 목록 조회 API

`GET /api/admin/translations/{target}/entries`

`TranslationAdminController`에 추가한다. 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`가
그대로 적용된다. `{target}`은 기존 `parseTarget()`이 해석하는 `menu` / `common-code`다.

응답은 `TranslationDto.Entry` 목록이다.

```java
public record Entry(
        String targetKey,            // 번역 마스터 대상 키
        Map<String, String> source,  // 원본 식별자: menu={mnuId}, common-code={cId,cdva,sttDt}
        String label,                // 목록 표시용 원본 식별 문자열
        List<ColumnValue> columns,   // 번역 대상 컬럼별 원문·번역
        boolean translated,          // 번역 대상 컬럼이 모두 채워졌는지
        String lastChangedBy,        // 번역 행 중 가장 최근 LST_CHG_USID (없으면 null)
        LocalDateTime lastChangedAt) {}  // 번역 행 중 가장 최근 LST_CHG_DTM (없으면 null)

public record ColumnValue(
        String columnName,
        String koText,                    // 원본 마스터의 한국어 값
        Map<String, String> translations) {}  // 언어코드 → 번역 문구
```

한국어 원문은 원본 마스터에서 읽고 `TPRMPP_CLANGM`에 저장하지 않는다. 기존
`TranslationCatalogService.validateValues()`가 한국어 저장을 거부하는 규칙과 일관된다.

페이징을 두지 않는다. `/api/admin/codes`도 전량 반환이며 대상 규모(메뉴 수백, 공통코드
수천)가 같은 수준이다.

### 6.3 `TranslationEntryService` 신설

`TranslationCatalogService`는 200줄이 넘고 "번역 행 CRUD"라는 책임이 뚜렷하다.
"원본 + 번역 병합 조회"는 별도 클래스로 분리한다.

처리 흐름:

1. 대상별 원본 활성 행 조회 — 메뉴는 `CmenumRepository`, 공통코드는 `CcodemRepository`
2. `TranslationTargetKey.menu()` / `.code()`로 대상 키 생성
3. `ClangmRepository`에 전 언어 조회 메서드를 하나 추가해 대상 키 목록으로 벌크 조회.
   기존 `findActiveByTargetAndLanguageAndKeys`와 같은 900건 배치 규칙을 적용한다
   (Oracle IN 절 1000개 한계)
4. 대상 키로 병합해 `Entry` 목록 생성

의존은 두 원본 저장소와 `ClangmRepository`뿐이고 상태를 갖지 않는다.

### 6.4 저장

기존 `PUT /api/admin/translations/{target}?targetKey=`를 그대로 쓴다. 빈 문자열 저장 시
논리 삭제, 지원 언어 검증, 컬럼 화이트리스트 검증이 이미 구현되어 있다. 새 저장 API를
만들지 않는다.

### 6.5 테스트

- `ClangmLSchemaContractTest` — `ClangmSchemaContractTest` 패턴. `ClangmL`의 컬럼명과
  길이가 `Clangm`과 일치하는지 검증한다. 컬럼명 불일치는 예외 없이 값이 비는 유일한
  실패 모드이므로 이 테스트가 회귀 방어의 핵심이다.
- `TranslationEntryServiceTest` — 번역·미번역이 섞인 목록 병합, 공통코드 길이-prefix 키
  생성, 논리 삭제된 번역이 미번역으로 보이는지.
- 통합 테스트(`./gradlew integrationTest`) — `Clangm` 저장·수정·논리삭제 후
  `TPRMPP_CLANGL`에 `C`/`U`/`D` 행이 각각 적재되는지.
- `TranslationAdminControllerTest` — `/entries`의 권한(비관리자 403)과 잘못된 `{target}` 처리.

## 7. 프론트엔드

### 7.1 파일 구성

`codes.vue` + `useAdminCodesPage.ts` 패턴을 따른다.

- `app/pages/admin/translations.vue` — 템플릿과 컴포저블 구조 분해만 두는 얇은 페이지.
  `definePageMeta({ middleware: 'admin' })`.
- `app/composables/useAdminTranslationsPage.ts` — 조회, 필터, 다이얼로그 상태, 저장 로직
- `app/composables/useAdminApi.ts` — `fetchTranslationEntries(target)`(`useApiFetch`),
  `saveTranslations(target, targetKey, values)`(`$apiFetch`) 추가
- `app/types/api.d.ts` — 백엔드 스펙에서 재생성. `npm run codegen:check`가 드리프트를 잡는다.
- `app/utils/menuPresentation.ts` — `MENU_ICON_OPTIONS`에 `pi pi-language` 추가

### 7.2 화면 구성

`PageHeader` + `TableCard` 안에 대상 구분 탭(메뉴 / 공통코드)을 둔다. 탭 전환 시 해당
대상의 목록을 조회한다.

필터는 세 가지다.

- `TableSearchInput` 통합검색(원본 식별자, 한국어 원문, 영어 번역 대상)
- 번역상태: 전체 / 미번역 / 번역완료
- 공통코드ID(공통코드 탭에서만 노출)

`StyledDataTable` 컬럼은 원본 식별자, 한국어 원문, 영어 번역, 상태, 최종변경자·일시다.
공통코드는 대표 컬럼(`CDVA_NM`)만 목록에 표시하고 나머지는 다이얼로그에서 다룬다.
번역이 없는 행에는 `한국어 대체 표시` 배지를 띄운다.

계층 트리 그룹핑은 하지 않는다. 평면 목록 + 필터가 `codes.vue`와 조작감이 같다.

### 7.3 편집 다이얼로그

행을 클릭하면 열린다. 번역 대상 컬럼마다 `한국어 원문(읽기 전용) ↔ 영어 입력`을 세로로
배치한다. 메뉴는 `MNU_NM` 한 쌍, 공통코드는 다섯 쌍이다.

- 기술 필드 `CO_C_INTN_NM`, `CO_CDVA_NM`은 입력을 제공하지 않는다. 백엔드
  `TranslationTarget`의 컬럼 화이트리스트와 일치한다.
- 입력 최대 길이는 `min(원본 컬럼 길이, 2000)`이다.
- 저장은 변경된 항목만 모아 `PUT` 1회. 성공 시 토스트를 띄우고 목록을 갱신한다.
- 영어 입력을 비우고 저장하면 백엔드가 해당 번역 행을 논리 삭제하고 목록은 다시
  `한국어 대체 표시`로 돌아간다. 이것이 번역 삭제 동작이므로 별도 삭제 버튼을 두지 않는다.

### 7.4 다국어 문구

새 화면의 모든 고정 문구는 `i18n/messages/admin.ts`의 `admin.translations.*` 아래에
ko/en 양쪽으로 추가한다. FE-37로 사이트 전체 고정 문구 감사가 0건이 된 상태라 하드코딩
리터럴이 남으면 `npm run check:copy` ratchet이 실패한다.

### 7.5 테스트

- `tests/unit/composables` — `useAdminTranslationsPage`의 대상 전환, 번역상태 필터,
  저장 페이로드가 변경 항목만 담는지, 빈 입력이 삭제 요청으로 나가는지
- `tests/e2e/admin/translations.spec.ts` — 관리자 로그인 → `/admin/translations` →
  영어 번역 입력·저장 → 목록 상태가 번역완료로 바뀌는지

## 8. 완료 기준

1. `Clangm` 생성·수정·논리삭제가 `TPRMPP_CLANGL`에 `C`/`U`/`D`로 적재된다.
2. `/admin/logs/clangm`에서 번역 변경 이력을 검색·페이징·상세 조회할 수 있다.
3. `/admin/translations`에서 메뉴·공통코드의 번역 현황을 대상별로 조회하고 미번역
   항목만 필터할 수 있다.
4. 다이얼로그에서 영어 번역을 등록·수정하고, 비워서 저장하면 삭제된다.
5. 저장 직후 사용자 화면의 영어 메뉴·공통코드 표시명에 반영된다.
6. `./gradlew check`, `npm run check`, `npm test`, `npm run codegen:check`가 통과한다.

## 9. 참조

- `docs/superpowers/specs/2026-08-15-multilingual-i18n-design.md` — 다국어 전체 설계
- `it_database/migrations/V20260815_001__CreateLanguageTranslationMaster.sql` — 마스터 DDL
- `it_database/ITPOWN_DDL_live.sql:1791` — `TPRMPP_CCODEL` 라이브 DDL(로그 테이블 기준)
- `it_backend/src/main/java/com/kdb/it/domain/log/` — 감사 로그 인프라
- `it_backend/src/main/java/com/kdb/it/common/i18n/` — 번역 마스터·서비스·관리자 API
