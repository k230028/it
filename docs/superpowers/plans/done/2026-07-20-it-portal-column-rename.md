# IT포탈 메타 표준 컬럼 rename 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 코드 컬럼 9종을 메타 표준용어(`IT_PTL_*`, `IOE_C`)로 rename하고 DB·백엔드·프론트를 일관 반영한다.

**Architecture:** 신규 Flyway 스크립트 1건으로 17개 테이블 컬럼 rename(20건)+IOE_C 타입확장(8건)+코멘트(20건)+CCODEM 그룹ID DML(6건)을 적용한다. 코드 측은 `컬럼 물리명 = 필드 camelCase` 컨벤션에 따라 백엔드 필드/JSON 프로퍼티/네이티브 SQL과 프론트 타입/그룹 문자열을 전면 rename한다.

**Tech Stack:** Oracle 19c(로컬 XEPDB1), Flyway, Spring Boot 4.1/JPA/QueryDSL, Nuxt 4/TypeScript.

**Spec:** `docs/superpowers/specs/2026-07-20-it-portal-column-rename-design.md`

## Global Constraints

- 적용된 기존 `V*.sql`은 수정 금지. 신규 버전은 `V20260720_001__RenameItPortalMetaColumns.sql`.
- `ITPOWN_DDL_live.sql`, `docs/meta-compliance-report.md`, `meta/meta.txt`는 수정하지 않는다(덤프/재생성 산출물).
- `NOW_CTT_MANR_C`(BBIZCM), `IT_PTL_BG_PRN_TC` 공통코드 그룹, 과거 마이그레이션·`docs/superpowers/` 산출물 내 옛 이름은 변경 대상 아님.
- 4개 리포(it/, it_backend/, it_frontend/, it_database/)는 각각 커밋한다 (`git -C`).
- 백엔드 테스트 워커 기동 이슈(메모리 참조)가 재현되면 `compileJava compileTestJava`로 검증하고 그 사실을 커밋/보고에 명시한다.

**rename 매핑 (전 태스크 공통):**

| DB 컬럼 | 새 DB 컬럼 | camelCase | 새 camelCase | 새 코멘트 |
|---|---|---|---|---|
| LGN_TC | IT_PTL_LGN_TC | lgnTc | itPtlLgnTc | IT포탈로그인구분코드 |
| INFM_SVC_TC | IT_PTL_INFM_SVC_TC | infmSvcTc | itPtlInfmSvcTc | IT포탈알림서비스구분코드 |
| SD_TC | IT_PTL_SD_TC | sdTc | itPtlSdTc | IT포탈발송구분코드 |
| DCD_STS_C | IT_PTL_DCD_STS_C | dcdStsC | itPtlDcdStsC | IT포탈결재상태코드 |
| APF_PRG_STS_C | IT_PTL_APF_PRG_STS_C | apfPrgStsC | itPtlApfPrgStsC | IT포탈신청서진행상태코드 |
| BLB_TC | IT_PTL_BLB_TC | blbTc, **blbTp**(레거시) | itPtlBlbTc | IT포탈게시판구분코드 |
| RPL_OPNN_TC | IT_PTL_RPL_OPNN_TC | rplOpnnTc | itPtlRplOpnnTc | IT포탈회신의견구분코드 |
| BG_PRN_TC | IOE_C (VARCHAR2(7)) | bgPrnTc | ioeC | IT포탈예산성격구분코드 |
| CTT_MANR_C | IT_PTL_CTT_MANR_C | cttManrC | itPtlCttManrC | IT포탈계약방법코드 |

---

### Task 1: Flyway 마이그레이션 스크립트 작성

**Files:**
- Create: `it_database/migrations/V20260720_001__RenameItPortalMetaColumns.sql`

**Interfaces:**
- Produces: 새 물리 컬럼명·CCODEM 그룹ID (Task 2~4가 의존)

- [ ] **Step 1: 스크립트 작성** — 아래 내용 그대로 생성:

```sql
-- IT포탈 메타 표준용어 정합화: 코드 컬럼 9종 rename, IOE_C 타입 확장, 코멘트 정비, 공통코드 그룹ID 정합.
-- RENAME COLUMN은 NOT NULL 제약과 인덱스(IX_CDECIM_PENDING, IX_CAPPLM_USER_STS, IDX_*_TGT)를 자동 승계한다.

-- 1) 로그인 이력
ALTER TABLE ITPOWN.TPRMPP_CLOGNH RENAME COLUMN LGN_TC TO IT_PTL_LGN_TC;
COMMENT ON COLUMN ITPOWN.TPRMPP_CLOGNH.IT_PTL_LGN_TC IS 'IT포탈로그인구분코드';

-- 2) 알림
ALTER TABLE ITPOWN.TPRMPP_CINFMM RENAME COLUMN INFM_SVC_TC TO IT_PTL_INFM_SVC_TC;
ALTER TABLE ITPOWN.TPRMPP_CINFMM RENAME COLUMN SD_TC TO IT_PTL_SD_TC;
COMMENT ON COLUMN ITPOWN.TPRMPP_CINFMM.IT_PTL_INFM_SVC_TC IS 'IT포탈알림서비스구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CINFMM.IT_PTL_SD_TC IS 'IT포탈발송구분코드';

-- 3) 결재선
ALTER TABLE ITPOWN.TPRMPP_CDECIM RENAME COLUMN DCD_STS_C TO IT_PTL_DCD_STS_C;
COMMENT ON COLUMN ITPOWN.TPRMPP_CDECIM.IT_PTL_DCD_STS_C IS 'IT포탈결재상태코드';

-- 4) 신청서(마스터/로그)
ALTER TABLE ITPOWN.TPRMPP_CAPPLM RENAME COLUMN APF_PRG_STS_C TO IT_PTL_APF_PRG_STS_C;
ALTER TABLE ITPOWN.TPRMPP_CAPPLL RENAME COLUMN APF_PRG_STS_C TO IT_PTL_APF_PRG_STS_C;
COMMENT ON COLUMN ITPOWN.TPRMPP_CAPPLM.IT_PTL_APF_PRG_STS_C IS 'IT포탈신청서진행상태코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CAPPLL.IT_PTL_APF_PRG_STS_C IS 'IT포탈신청서진행상태코드';

-- 5) 게시판(마스터/로그)
ALTER TABLE ITPOWN.TPRMPP_CBLBMM RENAME COLUMN BLB_TC TO IT_PTL_BLB_TC;
ALTER TABLE ITPOWN.TPRMPP_CBLBML RENAME COLUMN BLB_TC TO IT_PTL_BLB_TC;
COMMENT ON COLUMN ITPOWN.TPRMPP_CBLBMM.IT_PTL_BLB_TC IS 'IT포탈게시판구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_CBLBML.IT_PTL_BLB_TC IS 'IT포탈게시판구분코드';

-- 6) 검토의견(마스터/로그)
ALTER TABLE ITPOWN.TPRMPP_BRIVGM RENAME COLUMN RPL_OPNN_TC TO IT_PTL_RPL_OPNN_TC;
ALTER TABLE ITPOWN.TPRMPP_BRIVGL RENAME COLUMN RPL_OPNN_TC TO IT_PTL_RPL_OPNN_TC;
COMMENT ON COLUMN ITPOWN.TPRMPP_BRIVGM.IT_PTL_RPL_OPNN_TC IS 'IT포탈회신의견구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BRIVGL.IT_PTL_RPL_OPNN_TC IS 'IT포탈회신의견구분코드';

-- 7) 집행 4단계: BG_PRN_TC -> IOE_C (표준용어 재사용, VARCHAR2(3->7) 확장)
ALTER TABLE ITPOWN.TPRMPP_BESTIM RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BESTIL RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BDELIM RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BDELIL RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BCONTM RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BCONTL RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BPAYMM RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BPAYML RENAME COLUMN BG_PRN_TC TO IOE_C;
ALTER TABLE ITPOWN.TPRMPP_BESTIM MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BESTIL MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BDELIM MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BDELIL MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BCONTM MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BCONTL MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BPAYMM MODIFY (IOE_C VARCHAR2(7 CHAR));
ALTER TABLE ITPOWN.TPRMPP_BPAYML MODIFY (IOE_C VARCHAR2(7 CHAR));
COMMENT ON COLUMN ITPOWN.TPRMPP_BESTIM.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BESTIL.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BDELIM.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BDELIL.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCONTM.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCONTL.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPAYMM.IOE_C IS 'IT포탈예산성격구분코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BPAYML.IOE_C IS 'IT포탈예산성격구분코드';

-- 8) 계약방법(마스터/로그) — BBIZCM.NOW_CTT_MANR_C는 별개 표준용어로 변경하지 않는다.
ALTER TABLE ITPOWN.TPRMPP_BCONTM RENAME COLUMN CTT_MANR_C TO IT_PTL_CTT_MANR_C;
ALTER TABLE ITPOWN.TPRMPP_BCONTL RENAME COLUMN CTT_MANR_C TO IT_PTL_CTT_MANR_C;
COMMENT ON COLUMN ITPOWN.TPRMPP_BCONTM.IT_PTL_CTT_MANR_C IS 'IT포탈계약방법코드';
COMMENT ON COLUMN ITPOWN.TPRMPP_BCONTL.IT_PTL_CTT_MANR_C IS 'IT포탈계약방법코드';

-- 9) 공통코드 그룹ID 정합 (그룹ID = 컬럼 물리명 컨벤션, V20260715 선례).
--    LGN_TC 그룹은 CCODEM에 없어 제외. IT_PTL_BG_PRN_TC 그룹은 IOE_C(비목코드) 그룹과
--    값 체계가 달라 현행 유지한다. CCODEL에는 대상 그룹 행이 없음(2026-07-20 확인).
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_INFM_SVC_TC' WHERE CO_C_ID_NM = 'INFM_SVC_TC';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_SD_TC' WHERE CO_C_ID_NM = 'SD_TC';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_DCD_STS_C' WHERE CO_C_ID_NM = 'DCD_STS_C';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_APF_PRG_STS_C' WHERE CO_C_ID_NM = 'APF_PRG_STS_C';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_BLB_TC' WHERE CO_C_ID_NM = 'BLB_TC';
UPDATE ITPOWN.TPRMPP_CCODEM SET CO_C_ID_NM = 'IT_PTL_CTT_MANR_C' WHERE CO_C_ID_NM = 'CTT_MANR_C';
```

- [ ] **Step 2: 정합성 자체 확인**

Run: `grep -c "RENAME COLUMN" it_database/migrations/V20260720_001__RenameItPortalMetaColumns.sql`
Expected: `20`
Run: `grep -c "MODIFY (IOE_C" ...` → `8`, `grep -c "COMMENT ON COLUMN" ...` → `20`, `grep -c "UPDATE ITPOWN.TPRMPP_CCODEM" ...` → `6`

- [ ] **Step 3: 커밋**

```bash
git -C /c/it/it_database add migrations/V20260720_001__RenameItPortalMetaColumns.sql
git -C /c/it/it_database commit -m "feat: IT포탈 메타 표준 컬럼 rename 마이그레이션 (9종 20건, CCODEM 그룹ID 6건)"
```

---

### Task 2: 백엔드 전면 rename

**Files:**
- Modify: `it_backend/src/main/java/**`, `it_backend/src/test/java/**` 중 매핑 대상 83개 파일 (아래 벌크 치환 + 수동 정리)

**Interfaces:**
- Consumes: Task 1의 새 물리 컬럼명
- Produces: 새 JSON 프로퍼티명 (itPtlLgnTc, itPtlInfmSvcTc, itPtlSdTc, itPtlDcdStsC, itPtlApfPrgStsC, itPtlBlbTc, itPtlRplOpnnTc, ioeC, itPtlCttManrC) — Task 3 프론트가 동일 이름 사용

- [ ] **Step 1: 벌크 치환 (식별자·SQL·그룹ID 문자열)** — Git Bash에서 실행. 룩비하인드 `(?<![A-Z0-9_])`가 `NOW_CTT_MANR_C`, `IT_PTL_BG_PRN_TC`, `GBL_LGN_TC` 오매칭을 차단한다.

```bash
cd /c/it/it_backend
git grep -lE 'LGN_TC|INFM_SVC_TC|SD_TC|DCD_STS_C|APF_PRG_STS_C|BLB_TC|RPL_OPNN_TC|BG_PRN_TC|CTT_MANR_C' -- src \
| xargs perl -i -pe '
  s/(?<![A-Z0-9_])LGN_TC(?![A-Z0-9_])/IT_PTL_LGN_TC/g;
  s/(?<![A-Z0-9_])INFM_SVC_TC(?![A-Z0-9_])/IT_PTL_INFM_SVC_TC/g;
  s/(?<![A-Z0-9_])SD_TC(?![A-Z0-9_])/IT_PTL_SD_TC/g;
  s/(?<![A-Z0-9_])DCD_STS_C(?![A-Z0-9_])/IT_PTL_DCD_STS_C/g;
  s/(?<![A-Z0-9_])APF_PRG_STS_C(?![A-Z0-9_])/IT_PTL_APF_PRG_STS_C/g;
  s/(?<![A-Z0-9_])BLB_TC(?![A-Z0-9_])/IT_PTL_BLB_TC/g;
  s/(?<![A-Z0-9_])RPL_OPNN_TC(?![A-Z0-9_])/IT_PTL_RPL_OPNN_TC/g;
  s/(?<![A-Z0-9_])BG_PRN_TC(?![A-Z0-9_])/IOE_C/g;
  s/(?<![A-Z0-9_])CTT_MANR_C(?![A-Z0-9_])/IT_PTL_CTT_MANR_C/g;'
git grep -lE 'lgnTc|infmSvcTc|sdTc|dcdStsC|apfPrgStsC|blbTc|blbTp|rplOpnnTc|bgPrnTc|cttManrC|LgnTc|InfmSvcTc|SdTc|DcdStsC|ApfPrgStsC|BlbTc|BlbTp|RplOpnnTc|BgPrnTc|CttManrC' -- src \
| xargs perl -i -pe '
  s/(?<![A-Za-z0-9_])lgnTc/itPtlLgnTc/g;        s/LgnTc/ItPtlLgnTc/g;
  s/(?<![A-Za-z0-9_])infmSvcTc/itPtlInfmSvcTc/g; s/InfmSvcTc/ItPtlInfmSvcTc/g;
  s/(?<![A-Za-z0-9_])sdTc/itPtlSdTc/g;           s/SdTc/ItPtlSdTc/g;
  s/(?<![A-Za-z0-9_])dcdStsC/itPtlDcdStsC/g;     s/DcdStsC/ItPtlDcdStsC/g;
  s/(?<![A-Za-z0-9_])apfPrgStsC/itPtlApfPrgStsC/g; s/ApfPrgStsC/ItPtlApfPrgStsC/g;
  s/(?<![A-Za-z0-9_])blbTc/itPtlBlbTc/g;         s/BlbTc/ItPtlBlbTc/g;
  s/(?<![A-Za-z0-9_])blbTp/itPtlBlbTc/g;         s/BlbTp/ItPtlBlbTc/g;
  s/(?<![A-Za-z0-9_])rplOpnnTc/itPtlRplOpnnTc/g; s/RplOpnnTc/ItPtlRplOpnnTc/g;
  s/(?<![A-Za-z0-9_])bgPrnTc/ioeC/g;             s/BgPrnTc/IoeC/g;
  s/(?<![A-Za-z0-9_])cttManrC/itPtlCttManrC/g;   s/(?<![Nn]ow)CttManrC/ItPtlCttManrC/g;'
```

- [ ] **Step 2: 엔티티 `@Column` 20건 최종 상태 확인·정리** — 벌크 치환 후 name은 이미 새 이름. Edit 툴로 comment·length를 아래 최종 상태로 맞춘다 (comment의 한글은 벌크 치환에 포함되지 않음):

| 파일 | 최종 @Column (핵심 속성) |
|---|---|
| `common/system/entity/Clognh.java` | `name = "IT_PTL_LGN_TC", nullable = false, length = 1, comment = "IT포탈로그인구분코드"` |
| `common/notification/entity/Cinfmm.java` | `name = "IT_PTL_INFM_SVC_TC", length = 2, nullable = false, comment = "IT포탈알림서비스구분코드"` / `name = "IT_PTL_SD_TC", length = 2, comment = "IT포탈발송구분코드"` |
| `common/approval/entity/Cdecim.java` | `name = "IT_PTL_DCD_STS_C", length = 1, nullable = false, comment = "IT포탈결재상태코드"` |
| `common/approval/entity/Capplm.java` | `name = "IT_PTL_APF_PRG_STS_C", length = 2, nullable = false, comment = "IT포탈신청서진행상태코드"` |
| `domain/log/entity/CapplmL.java` | `name = "IT_PTL_APF_PRG_STS_C", length = 2, comment = "IT포탈신청서진행상태코드"` — **length 3→2 정정** |
| `common/board/entity/Cblbmm.java` | `name = "IT_PTL_BLB_TC", nullable = false, length = 3, comment = "IT포탈게시판구분코드"` — 필드 `itPtlBlbTc`(구 blbTp), JavaDoc의 "Java 필드명 blbTp 유지" 문구 삭제 |
| `domain/log/entity/CblbmmL.java` | `name = "IT_PTL_BLB_TC", length = 3, comment = "IT포탈게시판구분코드"` — 필드 `itPtlBlbTc` |
| `domain/budget/document/entity/Brivgm.java` | `name = "IT_PTL_RPL_OPNN_TC", length = 2, nullable = false, comment = "IT포탈회신의견구분코드"` — "(물리컬럼 ...)" 부연은 삭제, 의견유형 값 설명은 JavaDoc 유지 |
| `domain/log/entity/BrivgmL.java` | `name = "IT_PTL_RPL_OPNN_TC", length = 2, comment = "IT포탈회신의견구분코드"` — **length 1→2 정정** |
| `domain/estimate/entity/Bestim.java`, `domain/log/entity/BestimL.java`, `domain/deliberation/entity/Bdelim.java`, `domain/log/entity/BdelimL.java`, `domain/contract/entity/Bcontm.java`, `domain/log/entity/BcontmL.java`, `domain/payment/entity/Bpaymm.java`, `domain/log/entity/BpaymmL.java` | `name = "IOE_C", length = 7, comment = "IT포탈예산성격구분코드"` — **length 3→7**, "(대상구분: 100=정보화사업, 200=전산업무비)"는 기존 클래스 JavaDoc에 이미 있으므로 comment 속성에서 제거 |
| `domain/contract/entity/Bcontm.java`, `domain/log/entity/BcontmL.java` | `name = "IT_PTL_CTT_MANR_C", length = 2, comment = "IT포탈계약방법코드"` |

- [ ] **Step 3: 주석·설명 문자열 현행화** — 다음 파일의 한글 주석/`@Schema` description에서 옛 표기를 새 이름으로 정리 (grep으로 잔존 확인하며 Edit):
  - `Clognh.java`, `LoginHistoryDto.java`, `LoginHistoryRepository.java`, `AdminDto.java`: `공통코드 C_ID='LGN_TC'` → `공통코드 IT_PTL_LGN_TC`
  - `Cinfmm.java`(26–27행 JavaDoc): `C_ID='INFM_SVC'`/`C_ID='SD'` → 그룹 `IT_PTL_INFM_SVC_TC`/`IT_PTL_SD_TC`
  - `NotificationEvent.java`(49행): `Ccodem.cId='INFM_SVC'` → `IT_PTL_INFM_SVC_TC`
  - `DecisionStatus.java`, `Cdecim.java`, `ApplicationInfoDto.java`, `ApplicationService.java`: `DCD_STS_C` 표기는 벌크 치환으로 이미 `IT_PTL_DCD_STS_C`가 됨 — 문맥만 확인
  - `BoardMetaDto.java` `@Schema` description: `공통코드 BLB_TC` → `공통코드 IT_PTL_BLB_TC` (벌크 치환 결과 확인)

- [ ] **Step 4: CommonCodeGroups 상수 확인** — 벌크 치환 후 아래 최종 상태인지 확인 (자동 반영됨):

```java
public static final String SEND_DTT = "IT_PTL_SD_TC";
public static final String INFM_SVC = "IT_PTL_INFM_SVC_TC";
public static final String APF_STS = "IT_PTL_APF_PRG_STS_C";
```

- [ ] **Step 5: 컴파일 검증**

Run: `cd /c/it/it_backend && ./gradlew compileJava compileTestJava`
Expected: `BUILD SUCCESSFUL` (QueryDSL Q클래스 재생성 포함)

- [ ] **Step 6: 테스트 시도**

Run: `./gradlew test`
Expected: PASS. 워커 JVM 기동 크래시(기지 이슈) 재현 시 Step 5 결과로 갈음하고 보고에 명시.

- [ ] **Step 7: 잔존 참조 0건 확인**

```bash
cd /c/it/it_backend
grep -rPn '(?<![A-Z0-9_])(LGN_TC|INFM_SVC_TC|SD_TC|DCD_STS_C|APF_PRG_STS_C|BLB_TC|RPL_OPNN_TC|BG_PRN_TC|CTT_MANR_C)(?![A-Z0-9_])' src
grep -rPn '(?<![A-Za-z0-9_])(lgnTc|infmSvcTc|sdTc|dcdStsC|apfPrgStsC|blbTc|blbTp|rplOpnnTc|bgPrnTc|cttManrC)' src
```

Expected: 두 명령 모두 출력 없음 (exit 1)

- [ ] **Step 8: 커밋**

```bash
git -C /c/it/it_backend add -A src
git -C /c/it/it_backend commit -m "refactor: IT포탈 메타 표준 컬럼 rename 반영 (엔티티·DTO·네이티브SQL·그룹ID)"
```

---

### Task 3: 프론트엔드 전면 rename

**Files:**
- Modify: `it_frontend/app/**` 22개, `it_frontend/tests/**` 9개 파일
  (types/{payment,notification,estimate,deliberation,contract,board}.ts, composables/{useContracts,useApprovalStatus,useAdminApi,usePayments,useDeliberations,useReviewCommentApi}.ts, stores/review.ts, components/NotificationDropdown.vue, pages/admin/{login-history,boards/index}.vue, pages/board/[blbMngNo]/index.vue, pages/project/{payment,deliberation,contract}/*.vue, tests/unit/*, tests/e2e/*)

**Interfaces:**
- Consumes: Task 2의 새 JSON 프로퍼티명 (동일 매핑 표)

- [ ] **Step 1: 벌크 치환** — Git Bash에서 실행:

```bash
cd /c/it/it_frontend
git grep -lE 'LGN_TC|INFM_SVC_TC|SD_TC|DCD_STS_C|APF_PRG_STS_C|BLB_TC|RPL_OPNN_TC|BG_PRN_TC|CTT_MANR_C' -- app tests \
| xargs perl -i -pe '
  s/(?<![A-Z0-9_])LGN_TC(?![A-Z0-9_])/IT_PTL_LGN_TC/g;
  s/(?<![A-Z0-9_])INFM_SVC_TC(?![A-Z0-9_])/IT_PTL_INFM_SVC_TC/g;
  s/(?<![A-Z0-9_])SD_TC(?![A-Z0-9_])/IT_PTL_SD_TC/g;
  s/(?<![A-Z0-9_])DCD_STS_C(?![A-Z0-9_])/IT_PTL_DCD_STS_C/g;
  s/(?<![A-Z0-9_])APF_PRG_STS_C(?![A-Z0-9_])/IT_PTL_APF_PRG_STS_C/g;
  s/(?<![A-Z0-9_])BLB_TC(?![A-Z0-9_])/IT_PTL_BLB_TC/g;
  s/(?<![A-Z0-9_])RPL_OPNN_TC(?![A-Z0-9_])/IT_PTL_RPL_OPNN_TC/g;
  s/(?<![A-Z0-9_])BG_PRN_TC(?![A-Z0-9_])/IOE_C/g;
  s/(?<![A-Z0-9_])CTT_MANR_C(?![A-Z0-9_])/IT_PTL_CTT_MANR_C/g;'
git grep -lE 'lgnTc|infmSvcTc|sdTc|dcdStsC|apfPrgStsC|blbTc|blbTp|rplOpnnTc|bgPrnTc|cttManrC|LgnTc|InfmSvcTc|SdTc|DcdStsC|ApfPrgStsC|BlbTc|BlbTp|RplOpnnTc|BgPrnTc|CttManrC' -- app tests \
| xargs perl -i -pe '
  s/(?<![A-Za-z0-9_])lgnTc/itPtlLgnTc/g;        s/LgnTc/ItPtlLgnTc/g;
  s/(?<![A-Za-z0-9_])infmSvcTc/itPtlInfmSvcTc/g; s/InfmSvcTc/ItPtlInfmSvcTc/g;
  s/(?<![A-Za-z0-9_])sdTc/itPtlSdTc/g;           s/SdTc/ItPtlSdTc/g;
  s/(?<![A-Za-z0-9_])dcdStsC/itPtlDcdStsC/g;     s/DcdStsC/ItPtlDcdStsC/g;
  s/(?<![A-Za-z0-9_])apfPrgStsC/itPtlApfPrgStsC/g; s/ApfPrgStsC/ItPtlApfPrgStsC/g;
  s/(?<![A-Za-z0-9_])blbTc/itPtlBlbTc/g;         s/BlbTc/ItPtlBlbTc/g;
  s/(?<![A-Za-z0-9_])blbTp/itPtlBlbTc/g;         s/BlbTp/ItPtlBlbTc/g;
  s/(?<![A-Za-z0-9_])rplOpnnTc/itPtlRplOpnnTc/g; s/RplOpnnTc/ItPtlRplOpnnTc/g;
  s/(?<![A-Za-z0-9_])bgPrnTc/ioeC/g;             s/BgPrnTc/IoeC/g;
  s/(?<![A-Za-z0-9_])cttManrC/itPtlCttManrC/g;   s/(?<![Nn]ow)CttManrC/ItPtlCttManrC/g;'
```

주의: `useCodeOptions('IT_PTL_BG_PRN_TC')` 등 기존 `IT_PTL_*` 그룹 문자열은 룩비하인드가 보호하므로 변경되지 않아야 한다. `useCodeOptions('LGN_TC')`(login-history.vue)는 `'IT_PTL_LGN_TC'`로 바뀐다.

- [ ] **Step 2: 타입 검사·린트**

Run: `cd /c/it/it_frontend && npm run check`
Expected: 오류 0건

- [ ] **Step 3: 단위 테스트**

Run: `npm test`
Expected: PASS (E2E는 서버 기동 필요로 이번 검증 범위에서 제외)

- [ ] **Step 4: 잔존 참조 0건 확인**

```bash
cd /c/it/it_frontend
grep -rPn '(?<![A-Z0-9_])(LGN_TC|INFM_SVC_TC|SD_TC|DCD_STS_C|APF_PRG_STS_C|BLB_TC|RPL_OPNN_TC|BG_PRN_TC|CTT_MANR_C)(?![A-Z0-9_])' app tests
grep -rPn '(?<![A-Za-z0-9_])(lgnTc|infmSvcTc|sdTc|dcdStsC|apfPrgStsC|blbTc|blbTp|rplOpnnTc|bgPrnTc|cttManrC)' app tests
```

Expected: 두 명령 모두 출력 없음 (exit 1)

- [ ] **Step 5: 커밋**

```bash
git -C /c/it/it_frontend add -A app tests
git -C /c/it/it_frontend commit -m "refactor: IT포탈 메타 표준 컬럼 rename 반영 (타입·컴포저블·화면·테스트)"
```

---

### Task 4: 로컬 DB 적용 및 검증, _verify 스크립트 현행화

**Files:**
- Modify: `it_database/migrations/_verify/code-migration-verify.sql` (그룹ID·컬럼명 7건 현행화)

**Interfaces:**
- Consumes: Task 1 스크립트, Task 2 코드 (bootRun으로 Flyway 적용)

- [ ] **Step 1: Flyway로 로컬 적용** — 수동 sqlplus 적용은 flyway_schema_history 불일치를 만들므로 금지. 백엔드로 적용한다:

Run: `cd /c/it/it_backend && ./gradlew bootRun --args='--spring.profiles.active=local-ext'` (백그라운드, 기동 로그에서 `Successfully applied 1 migration` 확인 후 중단)

- [ ] **Step 2: SQL 검증** — sqlplus(`ITPAPP@127.0.0.1:11521/XEPDB1`)로 실행:

```sql
ALTER SESSION SET CURRENT_SCHEMA=ITPOWN;
-- 옛 이름 잔존 0건 + 새 이름 20건 확인
SELECT COLUMN_NAME, TABLE_NAME FROM ALL_TAB_COLUMNS WHERE OWNER='ITPOWN'
 AND COLUMN_NAME IN ('LGN_TC','INFM_SVC_TC','SD_TC','DCD_STS_C','APF_PRG_STS_C','BLB_TC','RPL_OPNN_TC','BG_PRN_TC','CTT_MANR_C');
SELECT COUNT(*) FROM ALL_TAB_COLUMNS WHERE OWNER='ITPOWN'
 AND COLUMN_NAME IN ('IT_PTL_LGN_TC','IT_PTL_INFM_SVC_TC','IT_PTL_SD_TC','IT_PTL_DCD_STS_C','IT_PTL_APF_PRG_STS_C','IT_PTL_BLB_TC','IT_PTL_RPL_OPNN_TC','IT_PTL_CTT_MANR_C')
  OR (COLUMN_NAME='IOE_C' AND TABLE_NAME IN ('TPRMPP_BESTIM','TPRMPP_BESTIL','TPRMPP_BDELIM','TPRMPP_BDELIL','TPRMPP_BCONTM','TPRMPP_BCONTL','TPRMPP_BPAYMM','TPRMPP_BPAYML'));
-- IOE_C 타입: 8행 모두 VARCHAR2 7 CHAR
SELECT TABLE_NAME, DATA_LENGTH, CHAR_LENGTH FROM ALL_TAB_COLUMNS WHERE OWNER='ITPOWN' AND COLUMN_NAME='IOE_C'
 AND TABLE_NAME IN ('TPRMPP_BESTIM','TPRMPP_BESTIL','TPRMPP_BDELIM','TPRMPP_BDELIL','TPRMPP_BCONTM','TPRMPP_BCONTL','TPRMPP_BPAYMM','TPRMPP_BPAYML');
-- 그룹ID: 옛 6개 0건, 새 6개 존재
SELECT CO_C_ID_NM, COUNT(*) FROM TPRMPP_CCODEM WHERE CO_C_ID_NM IN
 ('INFM_SVC_TC','SD_TC','DCD_STS_C','APF_PRG_STS_C','BLB_TC','CTT_MANR_C',
  'IT_PTL_INFM_SVC_TC','IT_PTL_SD_TC','IT_PTL_DCD_STS_C','IT_PTL_APF_PRG_STS_C','IT_PTL_BLB_TC','IT_PTL_CTT_MANR_C')
 GROUP BY CO_C_ID_NM ORDER BY 1;
```

Expected: 첫 SELECT 0행 / 새 이름 20건 / IOE_C 8행 CHAR_LENGTH=7 / 그룹은 IT_PTL_* 6개만 조회 — IT_PTL_APF_PRG_STS_C=4, IT_PTL_BLB_TC=2, IT_PTL_CTT_MANR_C=4, IT_PTL_DCD_STS_C=4, IT_PTL_INFM_SVC_TC=6, IT_PTL_SD_TC=4 (2026-07-20 로컬 기준).

- [ ] **Step 3: `_verify/code-migration-verify.sql` 현행화** — Task 2 Step 1의 대문자 perl 룰을 이 파일에 적용 (`'SD_TC'`→`'IT_PTL_SD_TC'`, `'INFM_SVC_TC'`→`'IT_PTL_INFM_SVC_TC'`, `'APF_PRG_STS_C'`→`'IT_PTL_APF_PRG_STS_C'`, `c.APF_PRG_STS_C`→`c.IT_PTL_APF_PRG_STS_C` 등 7개소).

- [ ] **Step 4: 커밋**

```bash
git -C /c/it/it_database add migrations/_verify/code-migration-verify.sql
git -C /c/it/it_database commit -m "chore: 검증 스크립트 그룹ID·컬럼명 현행화 (IT_PTL_* rename 반영)"
```

---

### Task 5: 메타 문서 현행화 및 최종 스캔

**Files:**
- Modify: `meta/table.txt` (대상 컬럼 20행: 컬럼명·논리명·타입 갱신)

**Interfaces:**
- Consumes: 확정된 새 이름·타입·논리명 (Global Constraints의 매핑 표)

- [ ] **Step 1: table.txt 갱신** — `grep -nE 'LGN_TC|INFM_SVC_TC|SD_TC|DCD_STS_C|APF_PRG_STS_C|BLB_TC|RPL_OPNN_TC|BG_PRN_TC|CTT_MANR_C' meta/table.txt`로 20행을 찾아 각 행의 컬럼 물리명→새 이름, 논리명→새 코멘트, IOE_C 행은 타입 `VARCHAR2 7`로 수정 (탭 구분 형식 유지). `it_backend/docs/guides/persistence/data-model.md`는 대상 컬럼 언급이 없음을 확인했으므로(2026-07-20) 수정하지 않는다.

- [ ] **Step 2: 전 리포 최종 스캔** — 다음 위치에 옛 이름이 남지 않았는지 확인: `it_backend/src`, `it_frontend/app`, `it_frontend/tests`, `it_database/migrations/_verify`, `meta/table.txt`. 허용 잔존: 적용 완료된 과거 `V*.sql`, `ITPOWN_DDL_live.sql`(재추출 대상), `docs/`(이력 문서), `meta/meta.txt`(기관 사전).

- [ ] **Step 3: 커밋**

```bash
git -C /c/it add meta/table.txt
git -C /c/it commit -m "docs: 메타 테이블 정의 현행화 (IT포탈 표준 컬럼 rename 반영)"
```

- [ ] **Step 4: 마무리 보고** — 사용자에게 dev/prod DBA 적용 필요성과 `ITPOWN_DDL_live.sql` 재추출("데이터 현행화") 필요성을 안내.
