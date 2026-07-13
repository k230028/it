# 사업계획(Bizplan) 기능 설계

- 작성일: 2026-07-13
- 근거 요구사항: `prds/ing/PRD_20260707.md` (사업계획 로직 반영)
- 선행 프로세스: 예산작성/신청 → 예산작업 → 정보기술부문 계획 → **사업계획**

## 1. 개요

정보기술부문 계획에 포함된 사업별로 **사업계획 문서**(보고서 + 일정/품목/계약)를 작성하는 기능을 추가한다.
기존 '사업 목록' 메뉴 위치에 반영하되, 새 라우트(`/project/bizplan`)를 신설하고 DB 메뉴 경로만 변경한다
(기존 `/info/projects` 페이지·라우트는 예산편성 흐름에서 계속 사용하므로 그대로 유지).

화면 스타일은 소요예산 산정(`project/estimate`) 목록/상세를 미러링한다.

## 2. 확정 결정 사항

| 항목 | 결정 |
|---|---|
| 메뉴 반영 | 새 라우트 `/project/bizplan` 신설 + DB 메뉴(경로/명칭) UPDATE. `/info/projects`는 유지 |
| 목록 데이터 | 정보기술부문 계획(`TPRMPP_BPLANA`)에 포함된 사업만 노출 |
| 생성 시점 | 상세 최초 진입 시 BBIZPM 자동 생성(lazy create) + 상태 21 부여 |
| 보고서 형태 | Tiptap 리치텍스트 HTML을 `REDT_CONE_INF`(CLOB)에 저장 |
| 권한 | 주관부서(`svnDpmC` == 사용자 `bbrC`)와 ADMIN이 작성·저장·[완료] 모두 수행 |
| 상태 저장 위치 | **A안**: BBIZPM에 상태 컬럼 없음. `TPRMPP_BPROJA`에만 기록 |
| 완료 후 수정 | 상태 29 유지 상태에서 반복 수정·저장 허용 (21로 회귀 없음) |

상태코드 (공통코드 `IT_PTL_STS_TC`):

| 코드값 | 코드값명 | 코드값상세코드(진행률) |
|---|---|---|
| 21 | 사업계획 작성중 | 10 |
| 29 | 사업계획 작성완료 | 100 |

백엔드 협의회 로직은 재정렬 후 09/32/39를 사용 중이므로 21/29는 실사용 충돌이 없다.
프론트 `IT_PTL_STS_TIMELINE`의 2x 밴드 라벨만 '사전협의' → '사업계획'으로 교체한다.

## 3. 데이터 모델

### 3.1 신규 테이블 (마스터 4 + 로그 4)

| 마스터 | 로그 | PK | 비고 |
|---|---|---|---|
| `TPRMPP_BBIZPM` 사업계획기본 | `TPRMPP_BBIZPL` | `ABUS_MNG_NO` | 사업과 1:1, 상태 컬럼 없음 |
| `TPRMPP_BBIZSM` 사업일정기본 | `TPRMPP_BBIZSL` | `ABUS_MNG_NO + SNO` | |
| `TPRMPP_BBIZGM` 사업품목기본 | `TPRMPP_BBIZGL` | `ABUS_MNG_NO + SNO` | `CTT_SNO`로 계약 행 참조 |
| `TPRMPP_BBIZCM` 사업계약기본 | `TPRMPP_BBIZCL` | `ABUS_MNG_NO + SNO` | |

컬럼 구성은 PRD의 테이블 설계를 그대로 따른다 (BBIZPM: ABUS_MNG_NO, ABUS_NM, REDT_CONE_INF,
BG_NO, TOT_RQM_AMT, IT_PTL_EDRT_TC / BBIZSM: DSD_CONE, STT_DT, END_DT / BBIZGM: GCL_NM, IOE_C,
QTY, AMT, FC_AMT, CUR_C, XCR, XCR_BSE_DT, CTT_SNO / BBIZCM: CTT_NM, NOW_CTT_MANR_C, CTT_TRM_MM_NBR).
모든 테이블에 BaseEntity 감사 7컬럼(FST_ENR_USID/DTM, LST_CHG_USID/DTM, DEL_YN, GUID, GUID_PRG_SNO)을
기존 DDL과 동일한 NOT NULL DEFAULT로 포함한다.

로그 테이블은 기존 규약대로: `LOG_HIS_TGR_SNO NUMBER(18)` 단일 PK(시퀀스 채번) + 원본 컬럼
스냅샷(NULL 허용) + `CHG_DTT_YN`(C/U/D) + `CHG_DTM` + `CHG_USID` + 감사 컬럼 미러.
적재는 트리거가 아니라 기존 `@LogTarget` 엔티티 리스너(`ChangeLogEntityListener` →
`AuditLogPersister`)가 자동 수행한다.

### 3.2 시퀀스

- 로그 PK용 4개 신설: `SEQ_BBIZPL`, `SEQ_BBIZSL`, `SEQ_BBIZGL`, `SEQ_BBIZCL`
  (`AuditLogIdGenerator`의 `SEQ_{Postfix}` 규칙과 정합).
- 마스터 채번 시퀀스는 불필요 — `ABUS_MNG_NO`는 기존 사업(`TPRMPP_BPROJM`)의 값을 사용.

### 3.3 상태 기록 (BPROJA)

- `TPRMPP_BPROJA`에 `(ABUS_MNG_NO, CNCD_RFR_NO = 'BIZ-' || ABUS_MNG_NO)` 행을
  `BprojaSyncService.upsert()`로 생성/갱신 (예: `BIZ-PRJ-2026-0001`, 17자 ≤ VARCHAR2(30)).
- 접두사 `BIZ-`는 협의회가 이미 `CNCD_RFR_NO = ABUS_MNG_NO` 원본값을 쓰고 있어 충돌을 피하기 위함.
- `it_backend/docs/guides/data-model.md`의 BPROJA 단계별 키 매핑표에 "사업계획 = `BIZ-{ABUS_MNG_NO}`" 행 추가.

### 3.4 행 관리 정책

- 자식 3개 테이블의 `SNO`는 **안정 유지**: 기존 행은 SNO로 UPDATE, 화면에서 지운 행은 `DEL_YN='Y'`
  소프트 삭제, 신규 행은 **프론트가 현재 최대 SNO+1로 부여**하고 서버는 (ABUS_MNG_NO, SNO) 기준
  upsert 한다(품목 `CTT_SNO`가 같은 요청의 신규 계약 SNO를 참조할 수 있어야 하므로 서버 채번 불가).
  품목의 `CTT_SNO`가 계약 `SNO`를 참조하므로 재부여하지 않습니다.
- `TOT_RQM_AMT` = 유효 품목(`DEL_YN='N'`) `AMT` 합계로 저장 시 서버가 자동 계산.
- `BG_NO`는 최초 생성 시 BPROJA의 예산편성 행(`CNCD_RFR_NO LIKE 'BG-%'`)에서 자동 연계, 없으면 NULL. 화면 읽기 전용.
- `ABUS_NM`은 생성 시 `TPRMPP_BPROJM.ABUS_NM` 복사(문서 스냅샷).
- `IT_PTL_EDRT_TC`는 사용자가 공통코드 Select로 선택.

## 4. 백엔드 설계

### 4.1 패키지 구조 — `com.kdb.it.domain.bizplan` (estimate 패턴 미러)

```
domain/bizplan/
├── controller/BizplanController.java
├── service/BizplanService.java
├── repository/BizplanRepository(+Custom/Impl, QueryDSL 목록)
│              BbizsmRepository, BbizgmRepository, BbizcmRepository
├── entity/Bbizpm, Bbizsm(+Id), Bbizgm(+Id), Bbizcm(+Id)
│          BbizpmL, BbizsmL, BbizgmL, BbizcmL  (BaseLogEntity 상속)
└── dto/BizplanDto.java (정적 중첩 클래스 + @Schema)
```

- 마스터 엔티티: `BaseEntity` 상속 + `@LogTarget(엔티티L.class)` + 복합키 `@IdClass` + 전 `@Column` 한글 comment.
- `@LogTarget` NOT NULL 기본값 함정(it_backend CLAUDE.md §5.12.1.1): 필수 컬럼 기본값은 생성자/팩토리에서 설정.
- 컬럼 물리명은 meta 용어사전(`C:\it\meta`) 등록 용어를 사용 (PRD 제공 물리명 기준).

### 4.2 API — `@RequestMapping("/api/project/bizplans")`

클래스 레벨 `@PreAuthorize` 없이 서비스 계층 권한 검증(집행 4단계와 동일).
모든 `@RequestParam`/`@PathVariable`에 `name=` 명시, mutating 요청 `@Valid`.

| 메서드 | 경로 | 동작 |
|---|---|---|
| GET | `/` | 목록: BPLANA 포함 사업 + BBIZPM/BPROJA left join(상태·총소요금액). ADMIN=전체, 일반=자기 부서 사업만 |
| POST | `/{abusMngNo}` | 진입(create-or-get): BBIZPM 없으면 생성 + BPROJA 21 upsert 후 상세 반환. 있으면 상세만 반환(멱등) |
| GET | `/{abusMngNo}` | 상세 재조회 (부수효과 없음) |
| PUT | `/{abusMngNo}` | 전체 저장: 보고서 HTML·전결권 + 일정/품목/계약 리스트 병합 |
| POST | `/{abusMngNo}/status` | [완료]: body `{stsTc:'29'}`, 21→29 전이만 허용 |

### 4.3 서비스 로직 — `BizplanService`

- 클래스 `@Transactional(readOnly=true)` + 쓰기 메서드 `@Transactional` 오버라이드.
- `getOrCreate(abusMngNo, user)`: `Bprojm` 존재 + BPLANA 포함 검증(미포함 404).
  신규 생성 시 ABUS_NM 복사·BG_NO 자동 연계 후 `BprojaSyncService.upsert(abusMngNo, "BIZ-"+abusMngNo, "21")`.
- `save(abusMngNo, dto, user)`: 자식 행 병합(§3.4 정책), 같은 요청 내 유효 계약 SNO인지 `CTT_SNO` 검증,
  `TOT_RQM_AMT` 재계산. 상태 29에서도 저장 허용(상태 변화 없음).
- `complete(abusMngNo, user)`: BPROJA 현재 상태 21 확인 후 29 upsert, 그 외 400.
- 권한: 수정·완료 모두 `OwnershipVerifier.verifyOwnerOrAdmin()` 재사용(소유 = 사업 주관부서).
- 완료 시 메일 발송(EaiService) 없음. 삭제 API 없음 (요구 범위 외).

### 4.4 Flyway 마이그레이션 — `it_database/migrations/`

1. `V20260713_001__CreateBizplanTables.sql` — 마스터 4 + 로그 4 CREATE TABLE
   (`ITPOWN.` 접두, 감사 컬럼 NOT NULL DEFAULT, PK 제약) + 전 컬럼 `COMMENT ON`
2. `V20260713_002__CreateBizplanLogSequences.sql` — 로그 시퀀스 4개 (멱등 생성 패턴)
3. `V20260713_003__MergeBizplanStatusCodes.sql` — CCODEM `IT_PTL_STS_TC` 21/29 MERGE
   (기존 행 있으면 명칭·상세코드 갱신, 없으면 삽입)
4. `V20260713_004__UpdateBizplanMenu.sql` — 기존 '사업 목록' 메뉴 행의 경로를
   `/project/bizplan`, 명칭을 '사업계획'으로 UPDATE

기존 파일 수정 금지(체크섬), 헤더 주석에 목적 명시 — 기존 마이그레이션 스타일 준수.

## 5. 프론트엔드 설계

### 5.1 라우트/화면 (estimate 미러)

- `app/pages/project/bizplan/index.vue` — 목록.
  `PageHeader` + `ProjectListFilterBar` + `ProjectListContainer` + `ProjectListCard`(명시적 import).
  클라이언트 필터(사업명/부서/상태). 상태 배지: 미작성(gray)/작성중 21(amber)/작성완료 29(emerald),
  CTA "작성하기/작성 계속/수정". 카드 클릭 → `/project/bizplan/{abusMngNo}`. 신규 다이얼로그 없음(진입=생성).
- `app/pages/project/bizplan/[abusMngNo].vue` — 상세. 좌 3/4 본문 + 우 1/4 sticky 목차.
  진입 시 `POST /{abusMngNo}`(create-or-get), 이후 GET refresh. 섹션:
  1. 사업 진행 현황 — `ProjectProgressSection` 재사용
  2. 사업 개요 — 사업명·예산번호·총소요금액(읽기 전용), 전결권 Select(`useCodeOptions('IT_PTL_EDRT_TC')`)
  3. 보고서 — Tiptap 에디터(요구사항정의서 패턴 재사용), `v-html` 표시는 DOMPurify 새니타이즈
  4. 사업일정 — `StyledDataTable` 인라인 편집(일정내용/시작일/종료일, DatePicker→YYYYMMDD)
  5. 사업품목 — 품목명/비목 Select(CCODEM IOE 그룹)/수량/금액/외화금액/통화(`useProjectCurrencies`)/
     환율/환율기준일/계약 연결 Select(같은 화면 계약 행)
  6. 사업계약 — 계약명/계약방법 Select/기간월수.
     계약방법 Select는 기존 계약 화면(`project/contract/[docNo].vue`)이 쓰는
     `CTT_MANR_LABEL` 상수(`types/contract.ts`)를 재사용
- 행 편집: StyledDataTable 가이드의 `_status`(new/modified/deleted)/`_localId` + `row-deleted` 패턴.
- 헤더 `#actions`: **[저장]**(PUT 전체) / **[완료]**(상태 21일 때만 노출, 확인 다이얼로그 후 status 29).
  상태 29에서도 모든 편집·저장 가능.

### 5.2 Composable/타입

- `app/composables/useBizplans.ts`: GET=`useApiFetch`, 변경=`$apiFetch`+toast,
  상태전이=`useDocumentStatusApi.createChangeStatus` 팩토리, 절대 URL `${apiBase}/api/project/bizplans`.
- `app/types/bizplan.ts`: `BizplanListItem`/`BizplanDetail`/`BizplanSaveRequest` +
  `BIZPLAN_STATUS = { IN_PROGRESS: '21', DONE: '29' }` + 라벨 상수.

### 5.3 타임라인 라벨 교체

- `app/utils/common.ts` `IT_PTL_STS_TIMELINE` 밴드 2:
  `{ label: '사전협의', codes: ['21','29'] }` → `{ label: '사업계획', codes: ['21','29'] }`.
  진행현황 카드 전체에 일괄 반영.

### 5.4 메뉴

- §4.4의 마이그레이션으로 DB 메뉴 데이터 변경. 프론트 코드에는 정적 메뉴 없음(`useMenu`가 서버 결과 렌더링).

## 6. 에러 처리

- 모든 변경 호출 try/catch + PrimeVue toast (`console.error` 단독 금지).
- BPLANA 미포함/존재하지 않는 사업 진입(404) 시 toast 안내 후 목록 복귀.
- 저장 검증 실패(400: 날짜 형식, CTT_SNO 불일치, 잘못된 상태 전이)는 서버 메시지를 toast로 표시.
- 로그 적재 실패는 기존 규약대로 원본 트랜잭션을 롤백하지 않는다(리스너가 예외 삼킴 + error 로그).

## 7. 테스트/검증 계획

- 백엔드 단위 테스트(`BizplanService`): 진입 생성/멱등, 저장 병합(SNO 유지·소프트삭제·MAX+1)·
  총소요금액 합산·CTT_SNO 검증, 21→29 전이·잘못된 전이 거부, 타부서 사용자 권한 거부.
  로컬 gradle test worker 이슈 발생 시 컴파일 검증(`compileJava`/`compileTestJava`)으로 대체.
- 프론트: `npm run typecheck` / `npm run lint`.
- QA: 두 서버 기동 후 시나리오 — 목록 진입(미작성 확인) → 상세 진입(21 부여 확인) → 보고서/일정/품목/계약
  작성·저장 → [완료](29 확인) → 재수정·저장(29 유지 확인) → 타임라인 '사업계획' 라벨 확인.

## 8. 범위 제외 (YAGNI)

- 사업계획 삭제 API/버튼
- 완료 시 메일 발송(EaiService)
- 결재(전자결재) 연동 — 전결권구분코드는 저장만 하고 결재 프로세스는 미연동
- Excel/PDF 내보내기
