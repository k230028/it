# IMK_NM 컬럼 부재 환경의 메뉴 조회 내성 설계

- 작성일: 2026-08-13
- 대상: `it_backend` (프론트 변경 없음)
- 관련: `it_database/migrations/V20260806_002__AddMenuIconColumn.sql`, `docs/db-schema-gap/db-schema-gap-2026-08-12.md` §3.3

## 1. 배경과 문제

메뉴 아이콘은 `V20260806_002`가 프론트 하드코딩 맵에서 DB로 옮기면서 `TPRMPP_CMENUM.IMK_NM`(이미지키명)이
단일 출처가 됐습니다. 같은 스크립트가 변경 스냅샷 로그 `TPRMPP_CMENUL`에도 같은 컬럼을 추가합니다.

이 마이그레이션이 적용되지 않은 환경에서는 다음이 깨집니다.

| 부재 위치 | 증상 |
| --- | --- |
| `TPRMPP_CMENUM.IMK_NM` | `Cmenum` 엔티티 조회가 `ORA-00904`. `/api/menus`가 500이 되어 **사이드바·헤더·Breadcrumb·탭 제목이 전부 뜨지 않음** |
| `TPRMPP_CMENUL.IMK_NM` | 조회는 되지만 메뉴 저장 시 `@LogTarget` 스냅샷 INSERT가 실패 |

운영 기준 파일(`meta/table.txt`)에는 `CMENUM`에만 반영되고 `CMENUL`에는 누락돼 있으나, 환경마다
적용 상태가 다를 수 있으므로 **어느 쪽이 없어도 메뉴 조회는 동작해야 한다**를 목표로 합니다.

## 2. 범위

**포함** — 사용자 메뉴 트리(`getMenuTree`)와 관리 메뉴 트리(`getAdminMenuTree`) 조회가 `IMK_NM` 유무와
무관하게 동작하고, 컬럼이 없을 때 내장 기본 아이콘이 채워집니다.

**제외** — 메뉴 저장(`AdminMenuService`)과 변경 로그 스냅샷은 손대지 않습니다. 컬럼이 없는 환경에서
메뉴 저장은 종전대로 실패합니다. 아이콘 편집이 필요한 환경은 DDL을 반영하는 것이 정답이며, 이 설계는
**읽기 가용성만** 확보합니다. `Cmenum` 엔티티, `AdminRouteService`, 프론트엔드는 변경하지 않습니다.

## 3. 구성 요소

### 3.1 컬럼 존재 판정 — `CmenumRepositoryCustom.isIconColumnPresent()`

`TPRMPP_CMENUM.IMK_NM`의 존재 여부를 판정해 캐시합니다. 별도 빈을 두지 않고 `CmenumRepositoryImpl`에
둡니다 — 이 판정의 유일한 존재 이유가 §3.2의 조회 select 목록을 결정하는 것이고, 같은 구현체가 이미
`EntityManager`를 갖고 있기 때문입니다.

```sql
SELECT COUNT(*) FROM ALL_TAB_COLUMNS
 WHERE OWNER = SYS_CONTEXT('USERENV','CURRENT_SCHEMA')
   AND TABLE_NAME = 'TPRMPP_CMENUM'
   AND COLUMN_NAME = 'IMK_NM'
```

- **지연 판정**: 기동 시점이 아니라 최초 메뉴 조회 시 1회 실행합니다. 기동 순서나 DB 미기동에 걸리지
  않게 하기 위함입니다.
- **1회 캐시**: 결과를 `volatile boolean`에 담고 이후 재조회하지 않습니다. 스키마는 런타임에 바뀌지
  않으며, 메뉴 조회는 모든 화면 진입마다 도는 경로라 매번 카탈로그를 읽지 않습니다.
- `OWNER`를 `SYS_CONTEXT('USERENV','CURRENT_SCHEMA')`로 잡는 이유: 접속 계정은 `ITPAPP`, 객체 소유
  스키마는 `ITPOWN`이고 베이스 설정이 세션 `CURRENT_SCHEMA`를 `ITPOWN`으로 전환합니다
  (`it_backend/CLAUDE.md` §2). `USER_TAB_COLUMNS`는 접속 계정 소유 객체만 보므로 쓸 수 없습니다.

판정에 실패하면(권한·뷰 부재 등) **컬럼 없음으로 간주**합니다. 이 방향의 오판은 아이콘이 기본값으로
표시될 뿐이지만, 반대 방향의 오판은 조회가 500으로 죽습니다. `it_backend/CLAUDE.md` §4의 "Repository는
DB 예외를 전파한다" 규칙에 대한 의도적 예외이며, 업무 조회가 아니라 카탈로그 탐지라는 점을 코드 주석에
남깁니다.

`spring.jpa.hibernate.ddl-auto=none`(`application.properties`)이므로 컬럼이 없어도 **기동은 성공**하고
런타임 조회에서만 `ORA-00904`가 납니다. 이 설계가 성립하는 전제입니다.

### 3.2 `MenuTreeRow` 프로젝션 + `findActiveMenuTreeRows()` (신규)

`CmenumRepositoryCustom`에 `List<MenuTreeRow> findActiveMenuTreeRows()`를 추가합니다.
`MenuTreeRow`는 트리 조립에 필요한 컬럼만 담는 `record`입니다
(`it_backend/CLAUDE.md` §4의 "응답 직렬화 전용 조회는 `*Row` 프로젝션" 규약).

```
mnuId, hrkMnuId, mnuNm, mnuTpC, srePth, mnuSotSqnSno, hidYn, mnuDep, whlMnuPth, imkNm
```

구현은 기존 저장소와 같은 QueryDSL 생성자 프로젝션이며 **select 목록만** 갈립니다.
`WHERE DEL_YN = 'N'` 조건은 기존 `findAllActive()`와 동일합니다.

| 조건 | select 목록 | 사용 생성자 |
| --- | --- | --- |
| 컬럼 있음 | 9개 컬럼 + `IMK_NM` | 10인자 canonical |
| 컬럼 없음 | 9개 컬럼만 | 9인자 보조(`imkNm = null`) |

`null` 리터럴을 select에 넣지 않고 **컬럼을 select 목록에서 아예 빼는** 방식입니다. SQL에 `IMK_NM`이
등장할 여지가 없어 `ORA-00904`가 원천 차단되고, Hibernate의 typed-null 렌더링 동작에 의존하지 않습니다.

### 3.3 `MenuIconDefaults` (신규, `domain/menu/service`)

`MNU_ID → 아이콘 클래스` 불변 맵입니다. 값의 출처는 **2026-08-13 로컬 DB의 `TPRMPP_CMENUM` 현재 값**
(`DEL_YN='N'` 중 `IMK_NM IS NOT NULL`) 42건입니다. 마이그레이션 시드가 아니라 실제 DB 값을 뜬 이유는
시드 이후 관리 화면에서 편집된 값(`MAUD0003`·`MAUD0009` = `pi pi-clock`)과 시드 이후 생성된 메뉴
(`MNU0001006`, `MNU0001012`)를 포함해야 하기 때문입니다.

<details>
<summary>42건 전량</summary>

| MNU_ID | IMK_NM | MNU_ID | IMK_NM |
| --- | --- | --- | --- |
| MADM0001 | pi pi-sitemap | MAUD0008 | pi pi-cog |
| MADM0002 | pi pi-link | MAUD0009 | pi pi-clock |
| MADM0003 | pi pi-chart-line | MBRD0001 | pi pi-comments |
| MADM0004 | pi pi-database | MCDP0001 | pi pi-clock |
| MADM0010 | pi pi-comments | MDOC0001 | pi pi-home |
| MADM0012 | pi pi-shield | MDOC0002 | pi pi-folder |
| MADM0016 | pi pi-bolt | MDOC0005 | pi pi-chart-pie |
| MADM0017 | pi pi-history | MHED0001 | pi pi-file-check |
| MADM0018 | pi pi-wallet | MHED0002 | pi pi-wallet |
| MADM0020 | pi pi-chart-bar | MHED0003 | pi pi-sparkles |
| MADM0022 | pi pi-briefcase | MHED0004 | pi pi-check-square |
| MADM0025 | pi pi-desktop | MHED0005 | pi pi-send |
| MADM0028 | pi pi-file-check | MHED0006 | pi pi-comments |
| MADM0032 | pi pi-shield | MHED0007 | pi pi-cog |
| MAPV0001 | pi pi-home | MINF0001 | pi pi-home |
| MAPV0002 | pi pi-inbox | MINF0002 | pi pi-book |
| MAPV0005 | pi pi-send | MINF0003 | pi pi-wallet |
| MAUD0001 | pi pi-home | MINF0009 | pi pi-chart-pie |
| MAUD0002 | pi pi-check-square | MINF0012 | pi pi-chart-bar |
| MAUD0003 | pi pi-clock | MINF0015 | pi pi-briefcase |
| | | MNU0001006 | pi pi-sitemap |
| | | MNU0001012 | pi pi-upload |

</details>

`MNU0001006`·`MNU0001012`는 로컬에서만 생성된 메뉴라 다른 환경에는 없을 수 있습니다. 조회는
`MNU_ID` 일치 기준이므로 대상 행이 없으면 그냥 쓰이지 않습니다.

**이 맵은 서버 코드에 고정된 스냅샷이며 갱신 의무가 없습니다.** 컬럼이 있는 정상 환경에서는 한 번도
읽히지 않고, 없는 환경은 어차피 아이콘 편집이 불가능하기 때문입니다.

### 3.4 적용 지점

`MenuQueryService.toNode()` 한 곳에서 채웁니다.

```
imkNm = 컬럼 있음 ? row.imkNm()
                  : MenuIconDefaults.iconOf(row.mnuId())   // 없으면 null
```

**적용 조건은 "컬럼이 없을 때만"입니다.** 컬럼이 있으면 `null`도 DB의 뜻이므로 그대로 둡니다.
관리자가 일부러 비운 아이콘을 서버가 되살리면 `V20260806_002`가 만든 "아이콘 단일 출처 = 메뉴 행"이
깨집니다.

사용자 트리와 관리 트리에 **동일하게** 적용합니다. 관리 화면에서만 아이콘이 비어 보이는 비일관을
피하기 위함이며, 해당 환경에서는 저장 자체가 막혀 편집 폼을 쓸 수 없습니다.

맵에 없는 메뉴는 `null`로 내려가고 프론트 `iconFor()`가 `DEFAULT_MENU_ICON`(`pi pi-folder`)으로
받습니다 — 기존 동작입니다.

## 4. 데이터 흐름

```
GET /api/menus
  └ MenuQueryService.getMenuTree(athIds)
      ├ CmenumRepository.isIconColumnPresent()        ← 최초 1회만 카탈로그 조회
      ├ CmenumRepository.findActiveMenuTreeRows()     ← 조건부 select
      │    (컬럼 없음 → imkNm 전부 null)
      ├ 권한·숨김·게시판 필터링 (기존 그대로)
      └ toNode()  → 컬럼 없으면 MenuIconDefaults로 imkNm 채움
```

프론트는 종전과 같은 `MenuNode`를 받습니다. `imkNm`의 `@Schema` 계약(`REQUIRED`, `nullable = true`)도
바뀌지 않으므로 `app/types/api.d.ts` 재생성이 필요 없습니다.

## 5. 오류 처리

| 상황 | 동작 |
| --- | --- |
| `ALL_TAB_COLUMNS` 조회 실패 | 컬럼 없음으로 간주하고 기본 맵 적용. 조회는 계속 성공 |
| 컬럼 없음 + 맵에 없는 `MNU_ID` | `imkNm = null` → 프론트가 `pi pi-folder` |
| 컬럼 있음 + `IMK_NM IS NULL` | `imkNm = null` (기본 맵 미적용) → 프론트가 `pi pi-folder` |
| `TPRMPP_CMENUL.IMK_NM` 부재 | 조회에 영향 없음. 메뉴 저장은 종전대로 실패 (범위 밖) |

## 6. 테스트

| 테스트 | 검증 |
| --- | --- |
| `MenuIconDefaultsTest` | 맵 42건이 저장 규약 정규식 `^[a-z0-9 -]{1,100}$`를 만족 (`it_backend/CLAUDE.md` §8과 동일 규칙) |
| `MenuQueryServiceTest` | 컬럼 없음일 때 기본 맵이 채워지고, 컬럼 있음일 때 `null`이 `null`로 남는지 |
| `CmenumMenuTreeProjectionIt` | 프로젝션이 기존 `findAllActive()` 엔티티 조회와 결과·`null` 계약이 동일한지, `isIconColumnPresent()`가 실재 로컬 스키마에서 `true`인지 (`it_backend/CLAUDE.md` §9의 신규 조회 요구) |

`*It` 접미사 테스트는 `@Tag("it")`을 붙여 `./gradlew integrationTest`에서만 돕니다.

## 7. 문서 갱신

- `it_backend/CLAUDE.md` §8 메뉴 아이콘 항목: 컬럼 부재 시 조회 폴백이 있다는 한 줄 추가
- `docs/db-schema-gap/db-schema-gap-2026-08-12.md` §5.1: 앱 조회는 내성이 생겼으나 **운영 DDL 반영은
  여전히 필요**하다는 메모 (아이콘 편집과 변경 이력은 컬럼이 있어야 동작)

## 7.1 구현 중 확정된 변경 (2026-08-13, 리뷰 반영)

리뷰에서 드러난 결함 때문에 §3의 설계가 아래와 같이 바뀌었습니다. **코드의 SoT는 항상
`it_backend/CLAUDE.md` §8과 실제 코드이며, 이 절은 왜 바뀌었는지를 남깁니다.**

| 항목 | 설계 원안 | 실제 구현 | 이유 |
| --- | --- | --- | --- |
| 프로브 실행 경로 | `EntityManager` 네이티브 쿼리 | `DataSource`에서 직접 연 커넥션 | JPA 경유 예외는 트랜잭션을 rollback-only로 만들어 §5의 "판정 실패도 조회는 성공" 보증이 커밋 시점에 깨짐 |
| 판정 실패 처리 | 실패를 '없음'으로 접고 캐시 | 실패는 캐시하지 않고 **60초 냉각** 후 재시도 | 영구 캐시는 순단 한 번으로 프로세스를 폴백에 고정. 반대로 무제한 재시도는 풀 고갈 시 매 요청이 두 번째 커넥션을 30초씩 기다려 고갈을 심화 |
| 판정값 전달 | 저장소가 내부에서 재판정 | `findActiveMenuTreeRows(boolean)` — 호출부가 한 번 판정해 전달 | 판정이 더 이상 영구 캐시가 아니므로 두 번 호출하면 select 목록과 아이콘 채움 여부가 어긋날 수 있음 |
| 운영 신호 | 없음 | 컬럼 부재·판정 실패 각각 WARN 로그 | 아이콘이 스냅샷으로 바뀐 이유를 운영자가 구분할 수 있어야 함 |

**남은 제약 2가지** — 둘 다 `it_backend/CLAUDE.md` §8에 규칙으로 기록했습니다.

- 성공한 판정은 프로세스 수명 동안 캐시하므로, **가동 중인 시스템에 DDL을 반영하면 재기동해야**
  아이콘 편집이 반영됩니다.
- `AdminRouteService`(화면경로 중복 검사)는 여전히 엔티티 조회라, 컬럼 부재 환경에서는 **라우트 삭제도
  실패**합니다. §2의 "조회만" 범위 결정에 따른 잔여이며, 필요해지면 별도 과제로 다룹니다.

## 8. 검증 명령

```
cd it_backend && ./gradlew test
cd it_backend && ./gradlew integrationTest
```
