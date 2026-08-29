# 공통 데이터 이관(개발→운영) 설계

- 작성일: 2026-08-29
- 상태: 사용자 설계 승인 완료 (화면 형태·반영 방식·파일 포맷·메뉴 키 전략 4개 결정 포함)
- 관련 저장소: `it_backend`, `it_frontend`, `it_database`

## 1. 개요와 목표

운영 이관 시 주요 공통 테이블 데이터를 **개발서버에서 파일 1개로 다운로드**하고, **운영서버에서 그 파일을 그대로 업로드**해 반영하는 관리자 기능을 만든다.

대상 데이터(요청 4종 + 부수 1종):

| 구분 | 테이블 | 엔티티 | PK |
| --- | --- | --- | --- |
| 메뉴 | `TPRMPP_CMENUM` | `domain/menu/entity/Cmenum` | `MNU_ID` (시퀀스 채번) |
| 메뉴권한 매핑 | `TPRMPP_CMENUA` | `domain/menu/entity/Cmenua` | (`MNU_ID`, `ATH_ID`) |
| 경로(화면 카탈로그) | `TPRMPP_CMENUD` | `domain/menu/entity/Cmenud` | `SRE_PTH` |
| 공통코드 | `TPRMPP_CCODEM` | `common/code/entity/Ccodem` | (`CO_C_ID_NM`, `CDVA_ID`, `STT_DT`) |
| 다국어 | `TPRMPP_CLANGM` | `common/i18n/entity/Clangm` | (`TC_ID_CONE`, `TC_COL_NM`, `DTT_LAN_C`) |

메뉴권한 매핑을 포함하는 이유: `MenuQueryService.isAllowed()`는 매핑 0건이면 전체 공개로 판정하므로, 메뉴만 이관하면 운영에서 관리자 메뉴가 전 사용자에게 노출된다.

## 2. 확정된 설계 결정

1. **화면 형태**: `/admin/migration/common-data` 단일 통합 이관 화면 신설. 파일 1개로 왕복.
2. **반영 방식**: 업서트. 파일에 있는 행은 추가/갱신(논리삭제 행은 부활), 운영에만 있는 행은 유지. 삭제 없음.
3. **파일 포맷**: xlsx 멀티시트 1개 파일, 시트·헤더는 한국어 고정(기존 공통코드 왕복 양식과 동일 근거 — locale에 따라 바꾸면 반입 파서가 해석 불가).
4. **메뉴 키 전략**: 개발서버 `MNU_ID`를 운영에 그대로 이식하고, 커밋 후 `SQ_TPRMPP_CMENUM_1`을 `max+1`로 재동기화. 운영 독자 생성 메뉴와 ID가 충돌하면 덮어쓰므로 dry-run에서 경고로 표시.

## 3. 범위

### 포함
- 백엔드: export(JSON 전량)·dry-run·commit API 3본과 서비스/플래너
- 프론트: 통합 이관 화면 + exceljs 기반 xlsx 생성·파싱 + dry-run→확정 흐름
- DB: 신규 화면 메뉴 시드 마이그레이션 1건
- 시퀀스 재동기화, 변경로그 자동 기록(JPA 경유), 캐시 evict

### 제외 (YAGNI)
- 완전 동기화(삭제) 모드 — 업서트만 제공
- 각 관리 화면(메뉴/경로/다국어)에 개별 업로드 버튼 추가
- 변경로그 테이블(`CMENUL`/`CCODEL`/`CLANGL`) 자체의 이관 — 업로드 부수효과로만 생성
- 첨부파일(`CFILEM`) 저장 — 파일은 브라우저에서만 다뤄지고 서버에 보관하지 않음
- Data Pump 등 DB 레벨 이관과의 통합

## 4. 전체 흐름

```
[개발서버] /admin/migration/common-data
  └─ [전체 다운로드]
     → GET /api/admin/migration/common-data/export  (전량 JSON)
     → 프론트 exceljs가 시트 5개 xlsx 생성: 공통데이터_YYYY-MM-DD.xlsx

[운영서버] /admin/migration/common-data
  └─ 파일 업로드(FileDropzonePicker)
     → 프론트 exceljs 파싱·정규화 (시트명·헤더 매칭)
     → POST /api/admin/migration/common-data/dry-run   (저장 없음, 요약·경고·오류)
     → 운영자가 요약 확인 후 [확정 반영]
     → POST /api/admin/migration/common-data           (단일 트랜잭션, 201)
```

엑셀 파싱은 단말기 일괄업로드 선례(`useTerminalBulkImportPage.ts` ↔ `MigrationController`)대로 프론트가 담당하고 서버는 정규화된 JSON 행 배열만 받는다. 서버 POI 파싱(편성요청서 방식)은 외부 작성 양식에 적합한 방식이라 배제 — 이 파일은 시스템이 직접 생성한 규격 파일이다.

## 5. 파일 포맷 (xlsx, 시트 5개, 한국어 고정)

내보내기는 `DEL_YN='N'` 행만 포함한다. 헤더 행 1행 + 데이터 행. 모든 셀은 문자열로 기록한다(공통코드 시작·종료일자 YYYYMMDD 문자열 보존).

### 시트 「메뉴」 — TPRMPP_CMENUM

| 헤더 | 컬럼 | 비고 |
| --- | --- | --- |
| 메뉴ID | MNU_ID | 7자리 문자열 |
| 상위메뉴ID | HRK_MNU_ID | 최상위는 빈값 |
| 메뉴명 | MNU_NM | |
| 메뉴유형 | MNU_TP_C | GRP/LNK/PGE |
| 아이콘 | IMK_NM | |
| 화면경로 | SRE_PTH | CMENUD 참조 |
| 정렬순서 | MNU_SOT_SQN_SNO | |
| 숨김여부 | HID_YN | Y/N |
| 메뉴깊이 | MNU_DEP | 1~4 |
| 전체메뉴경로 | WHL_MNU_PTH | `/0000001/0000002` 형태 |

### 시트 「메뉴권한」 — TPRMPP_CMENUA

| 헤더 | 컬럼 |
| --- | --- |
| 메뉴ID | MNU_ID |
| 자격등급ID | ATH_ID |

### 시트 「경로」 — TPRMPP_CMENUD

| 헤더 | 컬럼 |
| --- | --- |
| 화면경로 | SRE_PTH |
| 화면메뉴명 | SRE_MNU_NM |
| 사용여부 | USE_YN |
| 비고 | RMK |

### 시트 「공통코드」 — TPRMPP_CCODEM

기존 공통코드 화면 왕복 양식(`useAdminCodesPage.ts`) 13열을 그대로 사용한다:
코드ID, 코드값, 코드명, 코드값명, 코드값약어명, 코드값상세코드, 코드타입, 타입설명, 코드값상세, 상위코드, 시작일자, 종료일자, 순서.

### 시트 「다국어」 — TPRMPP_CLANGM

| 헤더 | 컬럼 | 비고 |
| --- | --- | --- |
| 대상키 | TC_ID_CONE | 메뉴=MNU_ID, 공통코드=길이-prefix 인코딩 |
| 대상컬럼명 | TC_COL_NM | |
| 언어코드 | DTT_LAN_C | 2자 |
| 번역내용 | TC_DES | |
| 구분명 | DTT_NM | 메뉴/공통코드 |

## 6. 백엔드 API

패키지 `domain/migration/commondata/` 신설. `CommonDataMigrationController`:

- 매핑: `/api/admin/migration/common-data`
- 방어: `SecurityConfig`의 `/api/admin/**` hasRole(ADMIN) + 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 이중 방어(기존 관행)
- Swagger `@Tag` + `@Operation` 필수

| 메서드·경로 | 역할 | 응답 |
| --- | --- | --- |
| `GET /export` | 5개 테이블 전량 JSON | `ExportResponse(menus, menuAuths, routes, codes, translations)` |
| `POST /dry-run` | 저장 없이 검증·계획 요약 | 테이블별 `{추가, 갱신, 부활, 변동없음}` 건수 + `warnings[]` + `errors[]` |
| `POST` | 단일 `@Transactional` 확정 반영 | dry-run과 동일 요약 + 시퀀스 재동기화 결과, 201 |

DTO는 record 묶음(`CommonDataMigrationDto.MenuRow/MenuAuthRow/RouteRow/CodeRow/TranslationRow/Request/PlanSummary/...`)으로 작성하고 `@NotEmpty`/`@Valid` 검증을 건다. 요청 본문은 dry-run과 commit이 동일한 `Request(rows 5종)`를 공유한다.

오류가 1건이라도 있으면 commit은 400으로 거부한다(dry-run과 commit 사이 데이터 변경 가능성에 대비해 commit도 동일 검증을 재수행).

## 7. 업서트·검증 규칙

### 반영 순서 (참조 무결성)
경로 → 메뉴 → 메뉴권한 → 공통코드 → 다국어. 전 과정 단일 트랜잭션.

### 테이블별 업서트
- **경로**: `SRE_PTH`로 조회(논리삭제 포함), 있으면 갱신·부활, 없으면 생성.
- **메뉴**: `MNU_ID`로 동일 처리. `WHL_MNU_PTH`는 파일 값을 그대로 저장(ID 이식이므로 재계산 불필요).
- **메뉴권한**: 복합키 존재 시 유지(갱신할 비키 컬럼 없음), 없으면 생성. 운영에만 있는 매핑 유지.
- **공통코드**: 기존 `AdminCodeService.bulkUpsertCodes()` 재사용 — 논리삭제 부활(restore), GUID NOT NULL 함정 회피, `codesByCid`·`budgetPeriod` 캐시 evict를 그대로 물려받는다.
- **다국어**: 3중 자연키로 동일 업서트. `TranslationTarget`/`TranslationColumns` 규칙(구분명↔허용 컬럼명, DB CHECK `CK_CLANGM_DTT_COL`과 동일)을 사전 검증.

모든 쓰기는 JPA 엔티티 경유로 수행한다 → `@LogTarget` 리스너가 `CMENUL`/`CCODEL`/`CLANGL` 변경로그를 자동 기록하고 BaseEntity 공통 컬럼(GUID 등)이 채워진다. 네이티브 벌크 SQL 금지.

### 시퀀스 재동기화
메뉴 커밋 후 파일·운영을 합친 최대 `MNU_ID`(숫자 해석) 기준으로 `SQ_TPRMPP_CMENUM_1`을 `ALTER SEQUENCE … RESTART START WITH max+1`(Oracle 21c 지원)로 재동기화한다. 현재 시퀀스가 이미 그보다 크면 건드리지 않는다. DATA_ONLY 임포트에서 겪은 ORA-00001 재발 방지 조치.

### dry-run 검증

**오류(반영 차단)**
- 필수값 누락, 허용값 위반: 메뉴유형(GRP/LNK/PGE), 숨김·사용여부(Y/N), 메뉴깊이(1~4), 언어코드 2자
- 다국어 구분명↔대상컬럼명 조합이 CHECK 규칙 위반
- 메뉴의 상위메뉴ID가 파일에도 운영에도 없음
- 메뉴권한의 자격등급ID가 `TPRMPP_CAUTHI`에 없음
- 시트 내 PK 중복
- 메뉴 행이 1건 이상인데 메뉴권한 행이 0건(관리자 메뉴 전체 공개 사고 방지)

**경고(반영 가능, 화면 표시)**
- 같은 `MNU_ID`인데 운영의 화면경로 또는 메뉴명이 파일과 다름(운영 독자 메뉴 덮어쓰기 가능성)
- 다국어 대상키가 가리키는 메뉴/공통코드가 파일에도 운영에도 없음
- 메뉴의 화면경로가 경로 시트에도 운영 카탈로그에도 없음

### 캐시
공통코드 캐시는 재사용 경로가 evict한다. 메뉴·번역을 서빙하는 캐시가 존재하면(구현 시 확인) 커밋 마지막에 함께 evict한다. 코드 캐시 미갱신으로 재기동이 필요했던 전례가 있으므로 evict 누락 여부를 통합 테스트로 확인한다.

## 8. 프론트엔드

- 페이지: `app/pages/admin/migration/common-data.vue` (`definePageMeta({ middleware: 'admin' })`)
- 상태: `app/composables/useCommonDataMigrationPage.ts` — `useTerminalBulkImportPage.ts` 구조 답습
- 순수 변환(시트↔행 정규화)은 `app/utils/` 유틸로 분리해 단위 테스트 대상으로 만든다
- 화면 구성:
  - 상단: [전체 다운로드] 버튼(`DownloadButton`) — export API 호출 후 exceljs로 파일 생성
  - 하단: `FileDropzonePicker` → 파싱 결과 표(시트별 행수) → dry-run 요약 표(테이블별 추가/갱신/부활/변동없음) → 오류·경고 목록 → [확정 반영] 버튼(오류 있으면 비활성)
- API 호출: 변경은 `$apiFetch`, 오류 문구는 `formatApiError`, 토스트는 `TOAST_LIFE`
- 백엔드 계약 확정 후 `npm run codegen` 재생성

## 9. DB 시드 마이그레이션

`it_database/migrations/V{YYYYMMDD_NNN}__SeedCommonDataMigrationMenu.sql` 1건:

1. `TPRMPP_CMENUD` MERGE — `/admin/migration/common-data` 경로 카탈로그
2. `TPRMPP_CMENUM` — 기존 이관 그룹 메뉴 하위에 「공통 데이터 이관」 추가 (시퀀스 채번)
3. `TPRMPP_CMENUA` — `ITPAD001` 매핑 (NOT EXISTS 가드)
4. `TPRMPP_CLANGM` — 영문 메뉴명

레퍼런스: `V20260822_001__SeedAdminMenuCatalogPathsAndAuthMapping.sql`, `V20260829_003__ReplaceMigrationMenuWithTerminalBulkImport.sql`.

## 10. 테스트 전략

TDD로 진행한다.

**백엔드**
- 플래너 단위 테스트: 추가/갱신/부활/변동없음 분류, 각 오류·경고 케이스, 시트 내 PK 중복
- 서비스 통합 테스트: 반영 순서, 논리삭제 부활, 변경로그 자동 생성, 시퀀스 재동기화(현재값이 더 크면 무변경 포함), 오류 존재 시 commit 400, 캐시 evict
- 컨트롤러: ADMIN 아닌 사용자 403

**프론트**
- xlsx 생성·파싱 유틸 단위 테스트(왕복 무손실: export JSON → xlsx → 파싱 → 동일 JSON)
- composable 흐름 테스트(dry-run 실패 시 확정 버튼 비활성 등)

**검증 명령**: `it_backend ./gradlew test`, `it_frontend npm run format:check && npm run check && npm test`, 계약 변경 시 `npm run codegen:check`.

## 11. 리스크와 대응

| 리스크 | 대응 |
| --- | --- |
| 운영 독자 생성 메뉴와 MNU_ID 충돌 → 덮어쓰기 | dry-run 경고로 표시, 운영자 확인 후 확정 |
| 메뉴권한 누락 이관 → 관리자 메뉴 전체 공개 | 메뉴권한 시트를 파일에 필수 포함, 메뉴 시트만 있고 메뉴권한 시트가 없으면 오류 |
| 시퀀스 미동기화 → 이후 메뉴 생성 시 ORA-00001 | 커밋 트랜잭션에서 재동기화 수행 |
| 대량 행(다국어 수천 건) 업로드 성능 | JPA 배치 크기 내 처리, 5개 테이블 합계 수천 건 수준이라 단일 트랜잭션 허용 범위. 초과 징후 시 saveAll 청크 처리 |
| dry-run과 commit 사이 데이터 변경 | commit이 동일 검증을 재수행, 오류 시 400 |
