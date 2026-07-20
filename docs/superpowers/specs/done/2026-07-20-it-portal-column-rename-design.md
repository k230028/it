# IT포탈 메타 표준 컬럼 rename 설계 (2026-07-20)

## 1. 목적

기관 메타 표준용어 정합화의 일환으로, IT포탈 고유 의미를 갖는 코드 컬럼 9개를
`IT_PTL_*` 접두 표준용어(예산성격구분코드는 기존 표준용어 `IOE_C` 재사용)로 rename하고
타입·코멘트를 표준에 맞춘다. 백엔드 엔티티/DTO/서비스와 프론트 타입/화면 코드도
`컬럼 물리명 = 엔티티 필드 camelCase` 컨벤션에 맞춰 전면 rename한다.

## 2. 변경 대상 (SoT: 사용자 제공 표)

| 기존 | 변경후 이름 | 변경후 타입 | 변경후 코멘트 | 대상 테이블 |
|---|---|---|---|---|
| LGN_TC | IT_PTL_LGN_TC | VARCHAR2(1) | IT포탈로그인구분코드 | CLOGNH |
| INFM_SVC_TC | IT_PTL_INFM_SVC_TC | VARCHAR2(2) | IT포탈알림서비스구분코드 | CINFMM |
| SD_TC | IT_PTL_SD_TC | VARCHAR2(2) | IT포탈발송구분코드 | CINFMM |
| DCD_STS_C | IT_PTL_DCD_STS_C | VARCHAR2(1) | IT포탈결재상태코드 | CDECIM |
| APF_PRG_STS_C | IT_PTL_APF_PRG_STS_C | VARCHAR2(2) | IT포탈신청서진행상태코드 | CAPPLM, CAPPLL |
| BLB_TC | IT_PTL_BLB_TC | VARCHAR2(3) | IT포탈게시판구분코드 | CBLBMM, CBLBML |
| RPL_OPNN_TC | IT_PTL_RPL_OPNN_TC | VARCHAR2(2) | IT포탈회신의견구분코드 | BRIVGM, BRIVGL |
| BG_PRN_TC | IOE_C | VARCHAR2(7) | IT포탈예산성격구분코드 | BCONTM, BCONTL, BDELIM, BDELIL, BESTIM, BESTIL, BPAYMM, BPAYML |
| CTT_MANR_C | IT_PTL_CTT_MANR_C | VARCHAR2(2) | IT포탈계약방법코드 | BCONTM, BCONTL |

- 테이블 접두 `TPRMPP_` 생략 표기. 총 17개 테이블, rename 20건.
- 타입 변경은 `BG_PRN_TC → IOE_C`의 `VARCHAR2(3 CHAR) → VARCHAR2(7 CHAR)` 확장 1종뿐이다
  (라이브 데이터는 BESTIM에 '100' 4건뿐으로 확장 안전). 나머지는 현행 타입과 동일하여 MODIFY 불필요.
- `BBIZCM.NOW_CTT_MANR_C`(현재계약방법코드)는 별개 표준용어로 **변경 대상 아님**.

## 3. DB 마이그레이션

- 신규 스크립트 1건: `it_database/migrations/V20260720_001__RenameItPortalMetaColumns.sql`
  - `ALTER TABLE ... RENAME COLUMN` 20건 — Oracle이 NOT NULL 제약·인덱스
    (IX_CDECIM_PENDING, IX_CAPPLM_USER_STS, IDX_BCONTM/BDELIM/BESTIM/BPAYMM_TGT)를 자동 승계.
  - `ALTER TABLE ... MODIFY (IOE_C VARCHAR2(7 CHAR))` 8건.
  - `COMMENT ON COLUMN` 20건 — 위 표의 코멘트를 마스터·로그 테이블 동일 적용.
  - 공통코드 그룹ID DML: `TPRMPP_CCODEM.CO_C_ID_NM` UPDATE 6건
    (`APF_PRG_STS_C`, `BLB_TC`, `CTT_MANR_C`, `DCD_STS_C`, `INFM_SVC_TC`, `SD_TC` → 각 `IT_PTL_*`).
    - V20260715 선례에 따라 재실행 안전성(신규 그룹ID 기존재 시 중복 처리)을 고려한다.
    - `LGN_TC` 그룹은 CCODEM에 없음 → DML 없음. `TPRMPP_CCODEL`에도 대상 그룹 행 없음 → 미변경.
    - `IT_PTL_BG_PRN_TC` 그룹은 **현행 유지** (컬럼 새 이름 `IOE_C`는 기존 비목코드 그룹과 값 체계가 달라 통합 불가.
      이 컬럼에 한해 '그룹ID=컬럼 물리명' 컨벤션 예외를 허용하고 그룹ID는 `IT_PTL_BG_PRN_TC`를 유지한다).
- 적용된 기존 V* 스크립트는 수정하지 않는다 (Flyway 체크섬).
- `ITPOWN_DDL_live.sql`은 라이브 덤프 산출물이므로 직접 수정하지 않는다.
  로컬 적용·검증 후 사용자의 "데이터 현행화" 덤프 절차로 재추출된다.
- dev/prod는 DBA 수동 적용 대상 (기존 운영 규약 동일).

## 4. 백엔드 변경

필드 rename 매핑 (`컬럼 camelCase = 필드명` 컨벤션 유지):

| 기존 필드 | 새 필드 |
|---|---|
| lgnTc | itPtlLgnTc |
| infmSvcTc | itPtlInfmSvcTc |
| sdTc | itPtlSdTc |
| dcdStsC | itPtlDcdStsC |
| apfPrgStsC | itPtlApfPrgStsC |
| blbTc | itPtlBlbTc |
| rplOpnnTc | itPtlRplOpnnTc |
| bgPrnTc | ioeC |
| cttManrC | itPtlCttManrC |

- 엔티티 10종+ (Clognh, Cinfmm, Cdecim, Capplm, Cblbmm, Brivgm, Bcontm, Bdelim, Bestim, Bpaymm
  및 로그 엔티티 CapplmL, CblbmmL, BrivgmL, BcontmL, BdelimL, BestimL, BpaymmL):
  `@Column(name, length, comment)` 및 필드명 변경. QueryDSL Q클래스는 빌드 시 재생성.
- 기존 매핑 불일치 동시 정정 (실 DDL 기준):
  - `CblbmmL.blbTp` → 필드명을 `itPtlBlbTc`로 통일.
  - `BrivgmL`의 RPL_OPNN_TC `length=1` → `2`.
  - `CapplmL`의 APF_PRG_STS_C `length=3` → `2`.
  - 엔티티 comment는 표준 코멘트 문자열과 일치시키고, "(대상구분)" 등 부가 설명은 JavaDoc으로 이동.
- DTO·서비스·리포지토리·컨트롤러·테스트(~82파일)의 필드/게터/세터/JSON 프로퍼티 rename.
- `CommonCodeGroups` 상수값 변경: `SEND_DTT="IT_PTL_SD_TC"`, `INFM_SVC="IT_PTL_INFM_SVC_TC"`,
  `APF_STS="IT_PTL_APF_PRG_STS_C"` 외 그룹ID 문자열 사용처(DecisionStatus 등) 전수 갱신.
- API JSON 프로퍼티가 변경되므로 프론트와 **동시 반영·동시 배포**를 전제로 한다
  (프론트 외 외부 API 소비자는 없음).

## 5. 프론트엔드 변경

- `types/`(contract, deliberation, estimate, payment, notification 등),
  `composables/`(useContracts, useApprovalStatus, useAdminApi, usePayments, useDeliberations,
  useReviewCommentApi 등), `stores/review.ts`, `pages/`(admin/login-history, board, project/* 등)
  ~21개 파일의 camelCase 필드 rename (백엔드 표와 동일 매핑).
- 공통코드 그룹 문자열 변경: `useCodeOptions('LGN_TC')` → `'IT_PTL_LGN_TC'` 등
  6개 그룹ID 사용처 갱신. `'IT_PTL_BG_PRN_TC'` 사용처는 그대로 유지.
- 주석·문서 문자열의 컬럼명 표기도 새 이름으로 현행화.

## 6. 문서 현행화

- `it_backend/docs/guides/persistence/data-model.md`의 해당 컬럼 표기 갱신.
- `meta/table.txt`의 대상 컬럼 행(이름·타입·논리명) 갱신.
- `docs/meta-compliance-report.md`는 라이브 DB 기준 재생성 산출물이므로 이번에 수정하지 않는다.

## 7. 검증

1. 로컬 Oracle에 신규 마이그레이션 적용(sqlplus 직접 실행 또는 local-ext Flyway) 후
   컬럼명·타입·코멘트·CCODEM 그룹ID를 조회로 확인.
2. 백엔드: `./gradlew compileJava compileTestJava` (테스트 워커 기동 이슈로 컴파일 검증 우선,
   가능 시 `./gradlew test`).
3. 프론트: `npm run check`, `npm test`.
4. 잔존 참조 스캔: 구 컬럼명/구 필드명(`LGN_TC`, `lgnTc` 등)이 소스에 남지 않는지 grep 확인
   (적용 완료된 과거 마이그레이션 스크립트·리포트 문서 제외).

## 8. 커밋 전략

it/, it_backend/, it_frontend/, it_database/는 독립 git 리포이므로 각각 커밋한다.
백엔드·프론트는 JSON 계약이 함께 바뀌므로 같은 작업 단위로 연달아 커밋·배포한다.
