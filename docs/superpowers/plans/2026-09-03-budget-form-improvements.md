# 전산예산 작성 화면 개선(변경1~5) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전산예산 작성·상신 화면에 기 지급금액 라벨, 사업연도 선택 규칙, 소요자원 입력 개선, 국내점포 결재라인 자동지정, 임시저장·작성완료 상태 분리를 반영한다.

**Architecture:** 신청서 상태 코드 `0`을 작성완료로 신설하고 수기등록을 `9`로 옮긴 뒤, 저장 시 결재선 없는 신청서 행을 스탬프하는 공통 `ApprovalStamper`로 원천 저장과 상태를 연결한다. 결재라인 자동지정은 직위코드 공통코드 그룹으로 판정하는 제안 API를 두고 프론트가 상신 화면 진입 시 채운다. 프론트는 800줄 상한을 넘긴 작성 화면에 줄을 더하지 않도록 새 마크업을 자식 컴포넌트와 feature composable로 분리한다.

**Tech Stack:** Oracle Flyway SQL(`it_database`), Spring Boot 3 + JPA/QueryDSL + JUnit5/Mockito(`it_backend`), Nuxt 4 + PrimeVue + Vitest(`it_frontend`)

**Spec:** `docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md`

## Global Constraints

- 세 하위 디렉터리(`it_backend`, `it_frontend`, `it_database`)는 독립 Git 저장소다. 커밋은 `git -C <repo> add <경로>`로 경로를 명시하고 `git add -A`·`-a`를 쓰지 않는다. 커밋 전 `git -C <repo> diff --cached --stat`을 확인한다.
- 신규 JavaDoc·TSDoc·주석은 한글로 쓴다.
- 마이그레이션 파일명은 `V{YYYYMMDD_NNN}__{CamelCase}.sql`이며 오늘 날짜 기준 `V20260903_001`부터 쓴다(설계서의 `V20260904_*` 표기는 예시였고 실제 번호는 이 계획을 따른다). 신규 DDL은 없고 코드·데이터 MERGE/UPDATE만 있다.
- 신청서 상태 코드: `0 작성완료(신설)`, `1 결재중`, `2 결재완료`, `3 반려`, `4 회수`, `9 수기등록(0에서 이동)`.
- 결재자 직위코드 시드 8건: `B1EX 팀장(1차)`, `I3EX CO(1차)`, `B1AX 부장(2차)`, `B1CX 실장(2차)`, `B1BX 지점장(2차)`, `B1AY 국장(2차)`, `B1GX 센터장(2차)`, `Z2C 사장(2차)`. 판정은 정확 일치.
- 산정근거 코드 4건: `01 견적서`, `02 내부산출`, `03 타행사례`, `99 기타(직접입력)`. 저장은 스키마 변경 없이 코드명 문자열을 `BITEMM.CNCD_FDTN_CONE`에 넣는다.
- 결재자 후보 사번 접두사는 `K`(프론트 `EMPLOYEE_ASSIGNABLE_ENO_PREFIX`와 동일).
- 국외점포 판정은 부점코드가 `9`로 시작하는 경우다.
- 프론트 파일 줄 수 상한 800. 기준선 초과 파일(`app/pages/info/projects/form.vue` 809, `app/pages/info/cost/form.vue` 801, `app/pages/info/projects/[id].vue` 906)은 줄 수를 늘리면 `tests/unit/architecture/max-lines-ratchet.test.ts`가 실패한다. 이 파일들은 반드시 줄을 줄이는 방향으로만 고친다.
- 백엔드 DTO 계약을 바꾼 뒤 프론트에서 `npm run codegen`과 `npm run codegen:check`를 실행한다. `app/types/api.d.ts`는 손으로 고치지 않는다.
- 사용자 노출 문구는 `i18n/messages/{도메인}.ts`의 ko·en 두 곳에 함께 넣는다.
- Health Stack: 백엔드 `./gradlew test`, 프론트 `npm run format:check`·`npm run check`·`npm test`, 루트 `./scripts/update-versions-lock.ps1`.

## 파일 구조

| 저장소 | 파일 | 책임 |
| --- | --- | --- |
| it_database | `migrations/V20260903_001__AddDraftedApplicationStatusCode.sql` | 상태코드 0/9 정리, 기존 0→9 이관, 영문 번역, 검증 |
| it_database | `migrations/V20260903_002__SeedApprovalLinePositionCodes.sql` | 결재자 직위코드 그룹 시드 |
| it_database | `migrations/V20260903_003__SeedBudgetBasisTypeCodes.sql` | 산정근거 코드 그룹 시드 |
| it_backend | `common/approval/domain/ApprovalStatus.java` | `DRAFTED("0")`, `MANUAL("9")` |
| it_backend | `common/approval/service/ApprovalStamper.java` (이동·확장) | 결재선 없는 신청서 스탬프(`stamp`, `stampDrafted`) |
| it_backend | `common/approval/entity/Capplm.java` | `renewDraft(title)` |
| it_backend | `domain/budget/project/dto/ProjectDto.java`, `domain/budget/cost/dto/CostDto.java` | `complete` 필드 |
| it_backend | `domain/budget/project/service/ProjectService.java`, `domain/budget/cost/service/CostService.java` | 저장 시 작성완료 스탬프 |
| it_backend | `domain/budget/common/repository/BudgetListVersionScope.java` | 작성완료 스코프의 초안 노출 |
| it_backend | `common/approval/repository/ApplicationRepository.java`, `service/ApplicationService.java` | 결재함 목록 0 제외, 미상신 건수 스코프 0 |
| it_backend | `common/iam/BranchCodes.java` | 국외점포 판정 공통 헬퍼 |
| it_backend | `common/iam/repository/UserRepository.java` | 직위코드 후보 조회 |
| it_backend | `common/approval/service/ApprovalLineSuggestionService.java`, `dto/ApplicationDto.java`, `controller/ApplicationController.java` | 결재라인 제안 API |
| it_backend | `common/code/CommonCodeGroups.java` | 신규 그룹 상수 |
| it_frontend | `app/utils/budgetYear.ts` | 9월 기준 기본연도, 선택지, 유의사항 판정 |
| it_frontend | `app/features/project/useProjectYearNotice.ts` | 당해연도 선택 유의사항 팝업 |
| it_frontend | `app/components/projects/ProjectPaidAmountField.vue`, `ProjectPaidAmountSummary.vue` | 변경1 라벨·보조 문구 |
| it_frontend | `app/composables/project/useResourceAmountFocus.ts` | 금액 0 포커스 처리 |
| it_frontend | `app/features/project/resourceBasis.ts`, `app/components/projects/ResourceBasisCell.vue` | 산정근거 Select 전환 |
| it_frontend | `app/components/projects/ProjectFormHeader.vue`, `app/components/cost/CostFormActions.vue` | 임시저장·저장 버튼 |
| it_frontend | `app/features/project/useProjectFormSave.ts`, `app/pages/info/cost/form.vue` | `complete` 전송 |
| it_frontend | `app/composables/useApprovalStatus.ts`, `app/utils/common.ts`, i18n | 0·9 라벨, 임시저장 배지 |
| it_frontend | `app/composables/useBudgetApprovalPage.ts` | 상신 대상 스코프 `0` |
| it_frontend | `app/composables/useApprovals.ts`, `app/features/approval/useApprovalLineSuggestion.ts`, `app/pages/budget/report.vue` | 결재라인 자동지정 |

---

### Task 1: 상태코드 마이그레이션 (0 작성완료, 9 수기등록)

**Files:**
- Create: `it_database/migrations/V20260903_001__AddDraftedApplicationStatusCode.sql`
- Modify: `it_database/migrations/_verify/code-migration-verify.sql` (그룹 현황 목록에 신규 그룹 두 개 추가)

**Interfaces:**
- Produces: `TPRMPP_CCODEM` 그룹 `IT_PTL_APF_PRG_STS_C`에 `0 작성완료`·`9 수기등록`. `TPRMPP_CAPPLM`·`TPRMPP_CAPPLL`의 기존 `0` 행이 `9`로 바뀜. Task 4의 enum이 이 값을 전제한다.

- [ ] **Step 1: 번호 선점용 빈 파일 커밋**

```powershell
cd C:\it\it_database
New-Item -ItemType File migrations\V20260903_001__AddDraftedApplicationStatusCode.sql
New-Item -ItemType File migrations\V20260903_002__SeedApprovalLinePositionCodes.sql
New-Item -ItemType File migrations\V20260903_003__SeedBudgetBasisTypeCodes.sql
git add migrations\V20260903_001__AddDraftedApplicationStatusCode.sql migrations\V20260903_002__SeedApprovalLinePositionCodes.sql migrations\V20260903_003__SeedBudgetBasisTypeCodes.sql
git commit -m "chore: 전산예산 작성 화면 개선 마이그레이션 번호 선점"
```

- [ ] **Step 2: 마이그레이션 본문 작성**

`migrations/V20260903_001__AddDraftedApplicationStatusCode.sql`:

```sql
-- ============================================================================
-- 신청서상태(IT_PTL_APF_PRG_STS_C)에 '작성완료(0)'를 신설하고 수기등록을 '9'로 옮긴다 (변경5)
-- ============================================================================
-- [왜]
--   저장만 한 원천(신청서 없음)과 작성완료(결재선 없는 신청서 0)를 나누기 위해 코드 0이 필요하다.
--   0은 편성요청서 반입이 '수기등록'으로 쓰고 있었으므로 9로 옮긴다.
--   설계: docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md §8
-- [순서]
--   1) 코드값 MERGE  2) 기존 0 행 사전 진단  3) CAPPLM·CAPPLL 0→9  4) 영문 번역  5) 검증
-- [재실행 안전]
--   MERGE는 (그룹, 코드값, 시작일) 기준이고 UPDATE는 두 번째 실행에서 대상이 0건이다.
-- ============================================================================

-- 1) 코드값
MERGE INTO ITPOWN.TPRMPP_CCODEM target
USING (SELECT 'IT_PTL_APF_PRG_STS_C' AS CO_C_ID_NM, '0' AS CDVA_ID, '20260101' AS STT_DT FROM DUAL) source
   ON (target.CO_C_ID_NM = source.CO_C_ID_NM
       AND target.CDVA_ID = source.CDVA_ID
       AND target.STT_DT = source.STT_DT)
WHEN MATCHED THEN
    UPDATE SET target.CDVA_NM = '작성완료',
               target.C_SQN_SNO = 0,
               target.END_DT = '99991231',
               target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (CO_C_ID_NM, CDVA_ID, STT_DT, END_DT, CO_C_NM, CDVA_NM, C_SQN_SNO,
            FST_ENR_USID, FST_ENR_DTM, DEL_YN)
    VALUES ('IT_PTL_APF_PRG_STS_C', '0', '20260101', '99991231', '신청서상태', '작성완료', 0,
            'MIGRATION', SYSDATE, 'N');

MERGE INTO ITPOWN.TPRMPP_CCODEM target
USING (SELECT 'IT_PTL_APF_PRG_STS_C' AS CO_C_ID_NM, '9' AS CDVA_ID, '20260101' AS STT_DT FROM DUAL) source
   ON (target.CO_C_ID_NM = source.CO_C_ID_NM
       AND target.CDVA_ID = source.CDVA_ID
       AND target.STT_DT = source.STT_DT)
WHEN MATCHED THEN
    UPDATE SET target.CDVA_NM = '수기등록',
               target.C_SQN_SNO = 9,
               target.END_DT = '99991231',
               target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (CO_C_ID_NM, CDVA_ID, STT_DT, END_DT, CO_C_NM, CDVA_NM, C_SQN_SNO,
            FST_ENR_USID, FST_ENR_DTM, DEL_YN)
    VALUES ('IT_PTL_APF_PRG_STS_C', '9', '20260101', '99991231', '신청서상태', '수기등록', 9,
            'MIGRATION', SYSDATE, 'N');

-- 2) 사전 진단: 이 시점의 0 행은 모두 반입 산출물(등록자결재요청내용='수기등록')이어야 한다.
DECLARE
    v_unmarked NUMBER;
BEGIN
    SELECT COUNT(*)
      INTO v_unmarked
      FROM ITPOWN.TPRMPP_CAPPLM
     WHERE IT_PTL_APF_PRG_STS_C = '0'
       AND (RGPR_DCD_REQ_CONE IS NULL OR RGPR_DCD_REQ_CONE <> '수기등록');
    IF v_unmarked > 0 THEN
        RAISE_APPLICATION_ERROR(-20010,
            '수기등록 표식이 없는 상태 0 신청서가 ' || v_unmarked || '건 있어 이관을 중단합니다');
    END IF;
END;
/

-- 3) 기존 수기등록 행 이관
UPDATE ITPOWN.TPRMPP_CAPPLM SET IT_PTL_APF_PRG_STS_C = '9' WHERE IT_PTL_APF_PRG_STS_C = '0';
UPDATE ITPOWN.TPRMPP_CAPPLL SET IT_PTL_APF_PRG_STS_C = '9' WHERE IT_PTL_APF_PRG_STS_C = '0';
COMMIT;

-- 4) 영문 번역 (TC_ID_CONE = '{그룹길이}:{그룹}{코드길이}:{코드}{시작일길이}:{시작일}')
MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT '20:IT_PTL_APF_PRG_STS_C1:08:20260101' AS TC_ID_CONE, 'CDVA_NM' AS TC_COL_NM, 'Drafted' AS TC_DES FROM DUAL UNION ALL
    SELECT '20:IT_PTL_APF_PRG_STS_C1:08:20260101', 'CO_C_NM', 'Application Status' FROM DUAL UNION ALL
    SELECT '20:IT_PTL_APF_PRG_STS_C1:98:20260101', 'CDVA_NM', 'Manually Registered' FROM DUAL UNION ALL
    SELECT '20:IT_PTL_APF_PRG_STS_C1:98:20260101', 'CO_C_NM', 'Application Status' FROM DUAL
) source
ON (target.TC_ID_CONE = source.TC_ID_CONE
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = source.TC_COL_NM)
WHEN MATCHED THEN
    UPDATE SET target.TC_DES = source.TC_DES, target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.TC_ID_CONE, 'en', source.TC_COL_NM, source.TC_DES, '공통코드', 'N');
COMMIT;

-- 5) 검증: 코드 두 건이 있고, 수기등록 표식이 붙은 0 행이 남아 있지 않아야 한다.
DECLARE
    v_codes    NUMBER;
    v_leftover NUMBER;
BEGIN
    SELECT COUNT(*)
      INTO v_codes
      FROM ITPOWN.TPRMPP_CCODEM
     WHERE CO_C_ID_NM = 'IT_PTL_APF_PRG_STS_C'
       AND ((CDVA_ID = '0' AND CDVA_NM = '작성완료') OR (CDVA_ID = '9' AND CDVA_NM = '수기등록'))
       AND DEL_YN = 'N';
    SELECT COUNT(*)
      INTO v_leftover
      FROM ITPOWN.TPRMPP_CAPPLM
     WHERE IT_PTL_APF_PRG_STS_C = '0'
       AND RGPR_DCD_REQ_CONE = '수기등록';
    IF v_codes <> 2 THEN
        RAISE_APPLICATION_ERROR(-20011, 'IT_PTL_APF_PRG_STS_C 0/9 코드 신설 실패');
    END IF;
    IF v_leftover > 0 THEN
        RAISE_APPLICATION_ERROR(-20012, '수기등록 신청서 ' || v_leftover || '건이 상태 0으로 남아 있습니다');
    END IF;
END;
/
```

- [ ] **Step 3: 검증 SQL 그룹 목록 갱신**

`migrations/_verify/code-migration-verify.sql`의 `=== CCODEM 그룹 현황(영향 그룹) ===` IN 목록 끝에 두 그룹을 추가한다.

```sql
    'IOE_C','IT_PTL_INFM_SVC_TC','IT_PTL_EDRT_TC','DFR_CLE_C','CUR_C','IT_PTL_APF_PRG_STS_C','BG_UNT_ABUS_C','ABUS_TC',
    'IT_PTL_APF_DCR_PT_C','IT_PTL_CNCD_FDTN_TC')
```

- [ ] **Step 4: 아직 기동하지 않는다**

Task 2·3 파일이 비어 있는 상태로 백엔드를 기동하면 빈 스크립트가 적용돼 이후 본문을 채울 때 checksum이 어긋난다. 세 파일 본문을 모두 채운 뒤 Task 3 Step 2에서 한 번만 기동해 `20260903.001~003`을 함께 확인한다. 이 태스크의 결과 검증 SQL은 그때 실행한다.

Run (SQL 클라이언트, 비밀번호는 콘솔 프롬프트):
```sql
SELECT CDVA_ID, CDVA_NM, C_SQN_SNO FROM ITPOWN.TPRMPP_CCODEM WHERE CO_C_ID_NM = 'IT_PTL_APF_PRG_STS_C' AND DEL_YN = 'N' ORDER BY C_SQN_SNO;
SELECT IT_PTL_APF_PRG_STS_C, COUNT(*) FROM ITPOWN.TPRMPP_CAPPLM GROUP BY IT_PTL_APF_PRG_STS_C;
```
Expected: 0 작성완료, 1~4, 9 수기등록. 상태 `0` 건수 없음.

- [ ] **Step 5: Commit**

```powershell
cd C:\it\it_database
git add migrations\V20260903_001__AddDraftedApplicationStatusCode.sql migrations\_verify\code-migration-verify.sql
git diff --cached --stat
git commit -m "feat: 신청서상태 작성완료(0) 신설과 수기등록 9 이관"
```

---

### Task 2: 결재자 직위코드 시드

**Files:**
- Modify: `it_database/migrations/V20260903_002__SeedApprovalLinePositionCodes.sql` (Task 1에서 선점한 빈 파일)

**Interfaces:**
- Produces: 그룹 `IT_PTL_APF_DCR_PT_C` 8행. `CDVA_ID`=직위코드, `CDVA_NM`=직위명, `CO_CDVA_NM`=차수(`1`/`2`). Task 8의 `ApprovalLineSuggestionService`가 `CodeDto.Response.cdvaDtlC`(=`CO_CDVA_NM`)로 차수를 읽는다.

- [ ] **Step 1: 시드 작성**

```sql
-- ============================================================================
-- 결재자직위코드(IT_PTL_APF_DCR_PT_C) 그룹 시드 (변경4 결재라인 자동지정)
-- ============================================================================
-- [구조] CDVA_ID=직위코드(TPRMPP_CUSERI.PT_C), CDVA_NM=직위명, CO_CDVA_NM=차수(1=1차, 2=2차)
-- [값 출처] 사용자 제공 2026-09-03. 사장은 3자리 코드 Z2C이며 정확 일치로 판정한다.
-- [운영 조정] 직위 체계가 바뀌면 코드 수정 없이 이 그룹의 행을 고친다.
-- [재실행 안전] (그룹, 코드값, 시작일) 기준 MERGE
-- ============================================================================
MERGE INTO ITPOWN.TPRMPP_CCODEM target
USING (
    SELECT 'B1EX' AS CDVA_ID, '팀장'   AS CDVA_NM, '1' AS CO_CDVA_NM, 1 AS C_SQN_SNO FROM DUAL UNION ALL
    SELECT 'I3EX', 'CO',     '1', 2 FROM DUAL UNION ALL
    SELECT 'B1AX', '부장',   '2', 3 FROM DUAL UNION ALL
    SELECT 'B1CX', '실장',   '2', 4 FROM DUAL UNION ALL
    SELECT 'B1BX', '지점장', '2', 5 FROM DUAL UNION ALL
    SELECT 'B1AY', '국장',   '2', 6 FROM DUAL UNION ALL
    SELECT 'B1GX', '센터장', '2', 7 FROM DUAL UNION ALL
    SELECT 'Z2C',  '사장',   '2', 8 FROM DUAL
) source
ON (target.CO_C_ID_NM = 'IT_PTL_APF_DCR_PT_C'
    AND target.CDVA_ID = source.CDVA_ID
    AND target.STT_DT = '20260101')
WHEN MATCHED THEN
    UPDATE SET target.CDVA_NM = source.CDVA_NM,
               target.CO_CDVA_NM = source.CO_CDVA_NM,
               target.C_SQN_SNO = source.C_SQN_SNO,
               target.END_DT = '99991231',
               target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (CO_C_ID_NM, CDVA_ID, STT_DT, END_DT, CO_C_NM, CDVA_NM, CO_CDVA_NM, C_SQN_SNO,
            FST_ENR_USID, FST_ENR_DTM, DEL_YN)
    VALUES ('IT_PTL_APF_DCR_PT_C', source.CDVA_ID, '20260101', '99991231', '결재자직위코드',
            source.CDVA_NM, source.CO_CDVA_NM, source.C_SQN_SNO, 'MIGRATION', SYSDATE, 'N');
COMMIT;

DECLARE
    v_found NUMBER;
BEGIN
    SELECT COUNT(*)
      INTO v_found
      FROM ITPOWN.TPRMPP_CCODEM
     WHERE CO_C_ID_NM = 'IT_PTL_APF_DCR_PT_C'
       AND CO_CDVA_NM IN ('1', '2')
       AND DEL_YN = 'N';
    IF v_found <> 8 THEN
        RAISE_APPLICATION_ERROR(-20013, 'IT_PTL_APF_DCR_PT_C 시드 8건 신설 실패: ' || v_found);
    END IF;
END;
/
```

- [ ] **Step 2: 검증 SQL 준비 (기동은 Task 3에서)**

Task 3 Step 2의 기동 뒤 다음을 실행한다.

```sql
SELECT CDVA_ID, CDVA_NM, CO_CDVA_NM FROM ITPOWN.TPRMPP_CCODEM WHERE CO_C_ID_NM = 'IT_PTL_APF_DCR_PT_C' AND DEL_YN = 'N' ORDER BY C_SQN_SNO;
```
Expected: 8행, 앞 두 행 차수 1, 나머지 2.

- [ ] **Step 3: Commit**

```powershell
cd C:\it\it_database
git add migrations\V20260903_002__SeedApprovalLinePositionCodes.sql
git commit -m "feat: 결재라인 자동지정용 결재자직위코드 시드"
```

---

### Task 3: 산정근거 코드 시드

**Files:**
- Modify: `it_database/migrations/V20260903_003__SeedBudgetBasisTypeCodes.sql`

**Interfaces:**
- Produces: 그룹 `IT_PTL_CNCD_FDTN_TC` 4행. 프론트 Task 13이 `useCodeOptions('IT_PTL_CNCD_FDTN_TC')`로 읽고 `cdNm`을 저장 문자열로 쓴다. **코드명은 저장 데이터의 매핑 키이므로 바꾸지 않는다.**

- [ ] **Step 1: 시드 작성**

```sql
-- ============================================================================
-- 산정근거구분코드(IT_PTL_CNCD_FDTN_TC) 그룹 시드 (변경3 산정근거 Select)
-- ============================================================================
-- [저장 방식] 스키마를 바꾸지 않고 코드명 문자열('견적서' 등)을 BITEMM.CNCD_FDTN_CONE에 저장한다.
--   기타(99)는 사용자가 직접 입력한 텍스트를 저장한다.
-- [주의] CDVA_NM은 저장된 문자열과의 매핑 키다. 이름을 바꾸면 기존 행이 '기타'로 보이므로
--   바꿔야 하면 BITEMM 데이터 이관 마이그레이션을 함께 만든다.
-- ============================================================================
MERGE INTO ITPOWN.TPRMPP_CCODEM target
USING (
    SELECT '01' AS CDVA_ID, '견적서'        AS CDVA_NM, 1 AS C_SQN_SNO FROM DUAL UNION ALL
    SELECT '02', '내부산출',      2 FROM DUAL UNION ALL
    SELECT '03', '타행사례',      3 FROM DUAL UNION ALL
    SELECT '99', '기타(직접입력)', 4 FROM DUAL
) source
ON (target.CO_C_ID_NM = 'IT_PTL_CNCD_FDTN_TC'
    AND target.CDVA_ID = source.CDVA_ID
    AND target.STT_DT = '20260101')
WHEN MATCHED THEN
    UPDATE SET target.CDVA_NM = source.CDVA_NM,
               target.C_SQN_SNO = source.C_SQN_SNO,
               target.END_DT = '99991231',
               target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (CO_C_ID_NM, CDVA_ID, STT_DT, END_DT, CO_C_NM, CDVA_NM, C_SQN_SNO,
            FST_ENR_USID, FST_ENR_DTM, DEL_YN)
    VALUES ('IT_PTL_CNCD_FDTN_TC', source.CDVA_ID, '20260101', '99991231', '산정근거구분코드',
            source.CDVA_NM, source.C_SQN_SNO, 'MIGRATION', SYSDATE, 'N');
COMMIT;

MERGE INTO ITPOWN.TPRMPP_CLANGM target
USING (
    SELECT '19:IT_PTL_CNCD_FDTN_TC2:018:20260101' AS TC_ID_CONE, 'CDVA_NM' AS TC_COL_NM, 'Quotation' AS TC_DES FROM DUAL UNION ALL
    SELECT '19:IT_PTL_CNCD_FDTN_TC2:028:20260101', 'CDVA_NM', 'Internal Estimate' FROM DUAL UNION ALL
    SELECT '19:IT_PTL_CNCD_FDTN_TC2:038:20260101', 'CDVA_NM', 'Peer Bank Case' FROM DUAL UNION ALL
    SELECT '19:IT_PTL_CNCD_FDTN_TC2:998:20260101', 'CDVA_NM', 'Other (free text)' FROM DUAL
) source
ON (target.TC_ID_CONE = source.TC_ID_CONE
    AND target.DTT_LAN_C = 'en'
    AND target.TC_COL_NM = source.TC_COL_NM)
WHEN MATCHED THEN
    UPDATE SET target.TC_DES = source.TC_DES, target.DEL_YN = 'N'
WHEN NOT MATCHED THEN
    INSERT (TC_ID_CONE, DTT_LAN_C, TC_COL_NM, TC_DES, DTT_NM, DEL_YN)
    VALUES (source.TC_ID_CONE, 'en', source.TC_COL_NM, source.TC_DES, '공통코드', 'N');
COMMIT;

DECLARE
    v_found NUMBER;
BEGIN
    SELECT COUNT(*) INTO v_found
      FROM ITPOWN.TPRMPP_CCODEM
     WHERE CO_C_ID_NM = 'IT_PTL_CNCD_FDTN_TC' AND DEL_YN = 'N';
    IF v_found <> 4 THEN
        RAISE_APPLICATION_ERROR(-20014, 'IT_PTL_CNCD_FDTN_TC 시드 4건 신설 실패: ' || v_found);
    END IF;
END;
/
```

- [ ] **Step 2: 세 마이그레이션 로컬 적용 확인 후 Commit**

`it_backend/README.md`의 로컬 기동 절차로 백엔드를 기동해 Flyway 로그에서 `20260903.001`·`002`·`003` 성공을 확인한다. 실패하면 `RAISE_APPLICATION_ERROR` 메시지로 원인을 판단한다. 이어서 Task 1 Step 4·Task 2 Step 2의 검증 SQL을 실행하고 다음을 실행한다.

```sql
SELECT CDVA_ID, CDVA_NM FROM ITPOWN.TPRMPP_CCODEM WHERE CO_C_ID_NM = 'IT_PTL_CNCD_FDTN_TC' AND DEL_YN = 'N' ORDER BY C_SQN_SNO;
```

```powershell
cd C:\it\it_database
git add migrations\V20260903_003__SeedBudgetBasisTypeCodes.sql
git commit -m "feat: 소요자원 산정근거구분코드 시드"
```

---

### Task 4: ApprovalStatus enum과 목록 스코프 규칙

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/approval/domain/ApprovalStatus.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/common/repository/BudgetListVersionScope.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/domain/ApprovalStatusTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/budget/common/repository/BudgetListVersionScopeTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApprovalStamperTest.java` (`"0"` 기대값을 `"9"`로; 계획 당시 경로 `domain/migration/service/MigrationApprovalStamperTest.java`)

**Interfaces:**
- Produces: `ApprovalStatus.DRAFTED` (code `"0"`, label `"작성완료"`), `ApprovalStatus.MANUAL` (code `"9"`). 이후 모든 태스크가 문자열 대신 이 상수를 쓴다.

- [ ] **Step 1: 실패하는 테스트 작성**

`ApprovalStatusTest.java` 전체를 다음으로 교체한다.

```java
package com.kdb.it.common.approval.domain;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class ApprovalStatusTest {

    @Test
    @DisplayName("공통코드 0은 작성완료 상태로 해석한다")
    void resolvesDraftedCode() {
        ApprovalStatus status = ApprovalStatus.ofCode("0");

        assertThat(status).isEqualTo(ApprovalStatus.DRAFTED);
        assertThat(status.label()).isEqualTo("작성완료");
        assertThat(status.isTerminated()).isFalse();
    }

    @Test
    @DisplayName("수기등록은 코드 9로 옮겨졌다")
    void resolvesManualRegistrationCode() {
        ApprovalStatus status = ApprovalStatus.ofCode("9");

        assertThat(status).isEqualTo(ApprovalStatus.MANUAL);
        assertThat(status.label()).isEqualTo("수기등록");
        assertThat(ApprovalStatus.ofLabel("수기등록").code()).isEqualTo("9");
    }
}
```

`BudgetListVersionScopeTest.java`에서 두 테스트를 고친다.

```java
    @ParameterizedTest
    @ValueSource(strings = {"none", "0", "1", "3", "4", "작성완료", "결재중", "반려", "회수"})
    @DisplayName("미상신·작성완료·결재중·반려·회수 스코프는 재상신 초안까지 노출한다")
    void includesDraftsForOpenScopes(String apfSts) {
        assertThat(BudgetListVersionScope.includesDrafts(apfSts)).isTrue();
    }

    @ParameterizedTest
    @ValueSource(strings = {"2", "결재완료", "9", "수기등록"})
    @DisplayName("결재완료·수기등록 스코프는 최종본만 노출해 과거 승인본 중복을 막는다")
    void excludesDraftsForCompletedScope(String apfSts) {
        assertThat(BudgetListVersionScope.includesDrafts(apfSts)).isFalse();
    }

    @Test
    @DisplayName("알 수 없는 값은 최종본만 노출하는 쪽으로 처리한다")
    void excludesDraftsForUnknownValue() {
        assertThat(BudgetListVersionScope.includesDrafts("X")).isFalse();
    }
```

`MigrationApprovalStamperTest.java`의 `지정한_수기등록상태로_생성한다`에서 `isEqualTo("0")`을 `isEqualTo("9")`로, `@DisplayName`의 `'0'`을 `'9'`로 바꾼다.

- [ ] **Step 2: 실패 확인**

```powershell
cd C:\it\it_backend
./gradlew test --tests 'com.kdb.it.common.approval.domain.ApprovalStatusTest' --tests 'com.kdb.it.domain.budget.common.repository.BudgetListVersionScopeTest'
```
Expected: `DRAFTED` 심볼 없음으로 컴파일 실패.

- [ ] **Step 3: 구현**

`ApprovalStatus.java` 상수와 클래스 주석:

```java
/** 신청서 결재상태 (Ccodem cId='IT_PTL_APF_PRG_STS_C'). 0 작성완료는 결재선 없는 저장 상태, 9 수기등록은 엑셀 반입 표식이다. */
public enum ApprovalStatus {
    DRAFTED("0", "작성완료"),
    IN_PROGRESS("1", "결재중"),
    COMPLETED("2", "결재완료"),
    REJECTED("3", "반려"),
    RECALLED("4", "회수"),
    MANUAL("9", "수기등록");
```

`BudgetListVersionScope.java`의 `DRAFT_VISIBLE_CODES`:

```java
    /**
     * 재상신 초안까지 노출해야 하는 결재상태 코드입니다.
     *
     * <p>작성완료는 저장한 초안 자신이 그 상태이고, 결재중은 상신된 초안, 반려·회수는 최종본으로 승격되지 못한 채 남은 초안이라 모두
     * {@code LST_YN='N'}일 수 있습니다.
     */
    private static final Set<String> DRAFT_VISIBLE_CODES =
            Set.of(
                    ApprovalStatus.DRAFTED.code(),
                    ApprovalStatus.IN_PROGRESS.code(),
                    ApprovalStatus.REJECTED.code(),
                    ApprovalStatus.RECALLED.code());
```
`includesDrafts` JavaDoc의 "미상신·결재중·반려·회수"를 "미상신·작성완료·결재중·반려·회수"로 고친다.

- [ ] **Step 4: 통과 확인**

```powershell
./gradlew test --tests 'com.kdb.it.common.approval.domain.ApprovalStatusTest' --tests 'com.kdb.it.domain.budget.common.repository.BudgetListVersionScopeTest' --tests 'com.kdb.it.domain.migration.service.MigrationApprovalStamperTest'
```
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
cd C:\it\it_backend
git add src/main/java/com/kdb/it/common/approval/domain/ApprovalStatus.java src/main/java/com/kdb/it/domain/budget/common/repository/BudgetListVersionScope.java src/test/java/com/kdb/it/common/approval/domain/ApprovalStatusTest.java src/test/java/com/kdb/it/domain/budget/common/repository/BudgetListVersionScopeTest.java src/test/java/com/kdb/it/domain/migration/service/MigrationApprovalStamperTest.java
git commit -m "feat: 신청서상태 작성완료(0) 추가, 수기등록 9 이동"
```

---

### Task 5: 공통 ApprovalStamper와 작성완료 스탬프

**Files:**
- Move: `domain/migration/service/MigrationApprovalStamper.java` → `common/approval/service/ApprovalStamper.java` (git mv 후 클래스명 변경)
- Move: `src/test/.../domain/migration/service/MigrationApprovalStamperTest.java` → `src/test/.../common/approval/service/ApprovalStamperTest.java`
- Modify: `common/approval/entity/Capplm.java` (`renewDraft`)
- Modify: `domain/migration/request/service/RequestFormFileImporter.java`, `domain/migration/service/MigrationImportService.java` (타입·import 교체)
- Modify: `src/test/.../RequestFormFileImporterTest.java`, `MigrationImportServiceTest.java`, `MigrationImportIt.java` (타입·import 교체)

**Interfaces:**
- Produces:
  - `String ApprovalStamper.stamp(String fntTbNm, String pkColNm, Integer fntTbCrySno, String title, String actorEno, String bseYy)` — 기존과 동일(결재완료)
  - `String ApprovalStamper.stamp(..., ApprovalStatus status)` — 기존과 동일
  - `String ApprovalStamper.stampDrafted(String fntTbNm, String pkColNm, Integer fntTbCrySno, String title, String actorEno, String bbrC, String bseYy)` — 최신 신청서가 `0`이면 제목만 갱신하고 그 번호를, `1`이면 `IllegalStateException`, 그 외에는 새 `0` 신청서 번호를 반환
  - `void Capplm.renewDraft(String title)`

- [ ] **Step 1: 파일 이동**

```powershell
cd C:\it\it_backend
git mv src/main/java/com/kdb/it/domain/migration/service/MigrationApprovalStamper.java src/main/java/com/kdb/it/common/approval/service/ApprovalStamper.java
git mv src/test/java/com/kdb/it/domain/migration/service/MigrationApprovalStamperTest.java src/test/java/com/kdb/it/common/approval/service/ApprovalStamperTest.java
```

- [ ] **Step 2: 실패하는 테스트 작성**

`ApprovalStamperTest.java`: 패키지를 `com.kdb.it.common.approval.service`로, 클래스명·`@InjectMocks` 타입을 `ApprovalStamper`/`stamper`로 바꾸고 기존 테스트는 유지한 채 다음을 추가한다.

```java
    @Test
    @DisplayName("작성완료 스탬프: 연결된 신청서가 없으면 결재선 없는 0 신청서를 새로 만든다")
    void 작성완료_신규생성() {
        when(applicationMapRepository.findByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(
                        "BPROJM", "PRJ-2026-0001", 1))
                .thenReturn(List.of());
        when(applicationRepository.getNextVal()).thenReturn(5L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        String apfNo =
                stamper.stampDrafted("BPROJM", "PRJ-2026-0001", 1, "사업A", "K10001", "D001", "2026");

        assertThat(apfNo).isEqualTo("APF-2026-00000005");
        org.mockito.Mockito.verify(applicationRepository).save(capplmCaptor.capture());
        Capplm saved = capplmCaptor.getValue();
        assertThat(saved.getItPtlApfPrgStsC()).isEqualTo(ApprovalStatus.DRAFTED.code());
        assertThat(saved.getDcdReqTtl()).isEqualTo("사업A");
        assertThat(saved.getDcdReqBbrC()).isEqualTo("D001");
        assertThat(saved.getDcdReqDtm()).isNull();
        assertThat(saved.getRgprDcdReqCone()).isNull();
        assertThat(saved.getFstEnrUsid()).isEqualTo("K10001");
    }

    @Test
    @DisplayName("작성완료 스탬프: 최신 신청서가 이미 0이면 새로 만들지 않고 제목만 갱신한다")
    void 작성완료_멱등갱신() {
        Cappla link = Cappla.builder().apfDcmNo("APF-2026-00000003").fntTbNm("BPROJM").build();
        Capplm existing =
                Capplm.builder()
                        .apfMngNo("APF-2026-00000003")
                        .itPtlApfPrgStsC(ApprovalStatus.DRAFTED.code())
                        .dcdReqTtl("옛 제목")
                        .build();
        when(applicationMapRepository.findByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(
                        "BPROJM", "PRJ-2026-0001", 1))
                .thenReturn(List.of(link));
        when(applicationRepository.findById("APF-2026-00000003")).thenReturn(Optional.of(existing));

        String apfNo =
                stamper.stampDrafted("BPROJM", "PRJ-2026-0001", 1, "새 제목", "K10001", "D001", "2026");

        assertThat(apfNo).isEqualTo("APF-2026-00000003");
        assertThat(existing.getDcdReqTtl()).isEqualTo("새 제목");
        org.mockito.Mockito.verify(applicationRepository, org.mockito.Mockito.never())
                .save(any(Capplm.class));
    }

    @Test
    @DisplayName("작성완료 스탬프: 최신 신청서가 결재중이면 저장을 거부한다")
    void 작성완료_결재중_거부() {
        Cappla link = Cappla.builder().apfDcmNo("APF-2026-00000004").fntTbNm("BPROJM").build();
        Capplm inProgress =
                Capplm.builder()
                        .apfMngNo("APF-2026-00000004")
                        .itPtlApfPrgStsC(ApprovalStatus.IN_PROGRESS.code())
                        .build();
        when(applicationMapRepository.findByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(
                        "BPROJM", "PRJ-2026-0001", 1))
                .thenReturn(List.of(link));
        when(applicationRepository.findById("APF-2026-00000004")).thenReturn(Optional.of(inProgress));

        org.assertj.core.api.Assertions.assertThatThrownBy(
                        () ->
                                stamper.stampDrafted(
                                        "BPROJM", "PRJ-2026-0001", 1, "제목", "K10001", "D001", "2026"))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("결재중");
    }

    @Test
    @DisplayName("작성완료 스탬프: 최신 신청서가 반려면 새 0 신청서를 만든다")
    void 작성완료_반려후_신규생성() {
        Cappla link = Cappla.builder().apfDcmNo("APF-2026-00000002").fntTbNm("BCOSTM").build();
        Capplm rejected =
                Capplm.builder()
                        .apfMngNo("APF-2026-00000002")
                        .itPtlApfPrgStsC(ApprovalStatus.REJECTED.code())
                        .build();
        when(applicationMapRepository.findByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(
                        "BCOSTM", "COST-2026-0001", 2))
                .thenReturn(List.of(link));
        when(applicationRepository.findById("APF-2026-00000002")).thenReturn(Optional.of(rejected));
        when(applicationRepository.getNextVal()).thenReturn(9L);
        when(applicationRepository.save(any(Capplm.class))).thenAnswer(i -> i.getArgument(0));

        String apfNo =
                stamper.stampDrafted("BCOSTM", "COST-2026-0001", 2, null, "K10001", "D001", null);

        assertThat(apfNo).startsWith("APF-").endsWith("00000009");
        org.mockito.Mockito.verify(applicationRepository).save(capplmCaptor.capture());
        // 제목이 비면 관리번호로 대신하고, 연도가 비면 올해를 쓴다
        assertThat(capplmCaptor.getValue().getDcdReqTtl()).isEqualTo("COST-2026-0001");
    }
```
필요한 import: `java.util.List`, `java.util.Optional`.

- [ ] **Step 3: 실패 확인**

```powershell
./gradlew compileTestJava
```
Expected: `ApprovalStamper`·`stampDrafted`·`renewDraft` 심볼 없음.

- [ ] **Step 4: 구현**

`Capplm.java`에 추가:

```java
    /**
     * 작성완료 신청서의 제목을 다시 저장한 원천 제목으로 맞춥니다.
     *
     * @param title 새 결재요청제목
     */
    public void renewDraft(String title) {
        this.dcdReqTtl = title;
    }
```

`ApprovalStamper.java` 전체:

```java
package com.kdb.it.common.approval.service;

import com.kdb.it.common.approval.domain.ApprovalStatus;
import com.kdb.it.common.approval.domain.MigrationApprovalMarker;
import com.kdb.it.common.approval.entity.Cappla;
import com.kdb.it.common.approval.entity.Capplm;
import com.kdb.it.common.approval.repository.ApplicationMapRepository;
import com.kdb.it.common.approval.repository.ApplicationRepository;
import java.time.LocalDate;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 결재선 없는 신청서 받이를 원천에 붙입니다.
 *
 * <p>두 용도가 있습니다. 엑셀 반입은 결재완료·수기등록 상태의 받이를 만들고({@link #stamp}), 작성 화면의 [저장]은 작성완료({@code 0})
 * 받이를 만듭니다({@link #stampDrafted}). 결재선({@code TPRMPP_CDECIM})은 만들지 않아 실제 결재를 거친 신청서와 구분됩니다.
 *
 * <p>신청서번호는 기존 {@code APF-{연도}-{8자리}} 형식을 그대로 씁니다. {@code ApplicationMapRepository}가 신청서번호 사전식
 * 내림차순을 시간순으로 전제하므로 별도 접두어를 쓰지 않습니다.
 *
 * <p>{@code TPRMPP_CAPPLM}, {@code TPRMPP_CAPPLA} 모두 최초등록자·최종변경자가 물리 NOT NULL이고 이관 배치는 로그인 세션 없이 실행될
 * 수 있어, JPA Auditing에 기대지 않고 {@code actorEno}로 두 필드를 직접 채웁니다. 이 대입을 지우면 무인 실행에서 {@code ORA-01400}이
 * 재발합니다.
 */
@Service
@RequiredArgsConstructor
@Transactional
public class ApprovalStamper {

    private final ApplicationRepository applicationRepository;
    private final ApplicationMapRepository applicationMapRepository;

    /**
     * 원천 한 건에 결재완료 상태의 이관 받이를 만듭니다.
     *
     * @param fntTbNm 원천테이블명 — {@code BCOSTM} 또는 {@code BPROJM}
     * @param pkColNm 원천 PK
     * @param fntTbCrySno 원천 일련번호
     * @param title 결재요청제목
     * @param actorEno 업로드 사용자 사번
     * @param bseYy 예산연도 (신청서번호 연도부)
     * @return 생성한 신청서식별번호
     */
    public String stamp(
            String fntTbNm,
            String pkColNm,
            Integer fntTbCrySno,
            String title,
            String actorEno,
            String bseYy) {
        return stamp(fntTbNm, pkColNm, fntTbCrySno, title, actorEno, bseYy, ApprovalStatus.COMPLETED);
    }

    /**
     * 원천 한 건에 호출자가 지정한 상태의 이관 받이를 만듭니다. 등록자결재요청내용에 {@link MigrationApprovalMarker#NOTE}를 남깁니다.
     *
     * @param status 생성할 신청서 진행상태
     * @return 생성한 신청서식별번호
     */
    public String stamp(
            String fntTbNm,
            String pkColNm,
            Integer fntTbCrySno,
            String title,
            String actorEno,
            String bseYy,
            ApprovalStatus status) {
        return create(
                fntTbNm,
                pkColNm,
                fntTbCrySno,
                title,
                actorEno,
                null,
                bseYy,
                status,
                MigrationApprovalMarker.NOTE,
                LocalDate.now());
    }

    /**
     * 작성 화면의 [저장]에 대응하는 작성완료({@code 0}) 받이를 만들거나 갱신합니다.
     *
     * <p>같은 원천 개정본에 연결된 최신 신청서가 이미 작성완료면 제목만 갱신해 멱등하게 동작하고, 결재중이면 저장을 거부합니다. 신청서가 없거나
     * 결재완료·반려·회수·수기등록이면 새 작성완료 신청서를 만듭니다. 결재요청일시는 비워 두고 실제 상신 신청서에만 기록합니다.
     *
     * @param fntTbNm 원천테이블명 — {@code BCOSTM} 또는 {@code BPROJM}
     * @param pkColNm 관리번호
     * @param fntTbCrySno 개정 순번
     * @param title 결재요청제목. 비면 관리번호를 씁니다
     * @param actorEno 저장 사용자 사번
     * @param bbrC 결재요청부점코드 (원천의 주관부서)
     * @param bseYy 예산연도. 비면 올해를 씁니다
     * @return 작성완료 신청서식별번호
     * @throws IllegalStateException 최신 신청서가 결재중인 경우
     */
    public String stampDrafted(
            String fntTbNm,
            String pkColNm,
            Integer fntTbCrySno,
            String title,
            String actorEno,
            String bbrC,
            String bseYy) {
        List<Cappla> links =
                applicationMapRepository.findByFntTbNmAndPkColNmAndFntTbCrySnoOrderByApfDcmNoDesc(
                        fntTbNm, pkColNm, fntTbCrySno);
        if (!links.isEmpty()) {
            Capplm latest = applicationRepository.findById(links.get(0).getApfDcmNo()).orElse(null);
            if (latest != null) {
                String status = latest.getItPtlApfPrgStsC();
                if (ApprovalStatus.IN_PROGRESS.code().equals(status)) {
                    throw new IllegalStateException("결재중인 문서는 저장할 수 없습니다.");
                }
                if (ApprovalStatus.DRAFTED.code().equals(status)) {
                    latest.renewDraft(resolveTitle(title, pkColNm));
                    return latest.getApfMngNo();
                }
            }
        }
        return create(
                fntTbNm, pkColNm, fntTbCrySno, title, actorEno, bbrC, bseYy, ApprovalStatus.DRAFTED, null, null);
    }

    private String create(
            String fntTbNm,
            String pkColNm,
            Integer fntTbCrySno,
            String title,
            String actorEno,
            String bbrC,
            String bseYy,
            ApprovalStatus status,
            String note,
            LocalDate requestDate) {
        String year =
                (bseYy == null || bseYy.isBlank()) ? String.valueOf(LocalDate.now().getYear()) : bseYy;
        Long sequence = applicationRepository.getNextVal();
        String apfDcmNo = String.format("APF-%s-%08d", year, sequence);

        Capplm application =
                Capplm.builder()
                        .apfMngNo(apfDcmNo)
                        .itPtlApfPrgStsC(status.code())
                        .dcdReqTtl(resolveTitle(title, pkColNm))
                        .dcdReqUsid(actorEno)
                        .dcdReqBbrC(bbrC)
                        .dcdReqDtm(requestDate)
                        .rgprDcdReqCone(note)
                        .fstEnrUsid(actorEno)
                        .lstChgUsid(actorEno)
                        .build();
        applicationRepository.save(application);

        Cappla applicationMap =
                Cappla.builder()
                        .apfDcmNo(apfDcmNo)
                        .fntTbNm(fntTbNm)
                        .pkColNm(pkColNm)
                        .fntTbCrySno(fntTbCrySno)
                        .fstEnrUsid(actorEno)
                        .lstChgUsid(actorEno)
                        .build();
        applicationMapRepository.save(applicationMap);

        return apfDcmNo;
    }

    private static String resolveTitle(String title, String fallback) {
        return (title == null || title.isBlank()) ? fallback : title;
    }
}
```

참조 교체: `RequestFormFileImporter.java`, `MigrationImportService.java`, `RequestFormFileImporterTest.java`, `MigrationImportServiceTest.java`, `MigrationImportIt.java`에서 `import com.kdb.it.domain.migration.service.MigrationApprovalStamper;`를 `import com.kdb.it.common.approval.service.ApprovalStamper;`로, 타입명 `MigrationApprovalStamper`를 `ApprovalStamper`로 바꾼다(필드명 `approvalStamper`/`stamper`는 유지). JavaDoc의 `{@link ... MigrationApprovalStamper}`도 같이 바꾼다.

```powershell
cd C:\it\it_backend
Get-ChildItem -Recurse src -Include *.java | Select-String -List "MigrationApprovalStamper" | Select-Object -ExpandProperty Path
```
Expected: 위 다섯 파일과 `ApprovalStamper.java` 자신만 나오며, 교체 후 재실행하면 0건이어야 한다.

- [ ] **Step 5: 통과 확인**

```powershell
./gradlew test --tests 'com.kdb.it.common.approval.service.ApprovalStamperTest' --tests 'com.kdb.it.domain.migration.request.service.RequestFormFileImporterTest' --tests 'com.kdb.it.domain.migration.service.MigrationImportServiceTest'
```
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/java/com/kdb/it/common/approval/service/ApprovalStamper.java src/main/java/com/kdb/it/common/approval/entity/Capplm.java src/main/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporter.java src/main/java/com/kdb/it/domain/migration/service/MigrationImportService.java src/test/java/com/kdb/it/common/approval/service/ApprovalStamperTest.java src/test/java/com/kdb/it/domain/migration/request/service/RequestFormFileImporterTest.java src/test/java/com/kdb/it/domain/migration/service/MigrationImportServiceTest.java src/test/java/com/kdb/it/domain/migration/MigrationImportIt.java
git diff --cached --stat
git commit -m "refactor: 결재 스탬퍼를 공통 패키지로 옮기고 작성완료 스탬프 추가"
```

---

### Task 6: 저장 요청의 `complete` 플래그와 작성완료 스탬프

**Files:**
- Modify: `domain/budget/project/dto/ProjectDto.java` (`CreateRequest`, `UpdateRequest`)
- Modify: `domain/budget/cost/dto/CostDto.java` (`CreateRequest`, `UpdateRequest`)
- Modify: `domain/budget/project/service/ProjectService.java`
- Modify: `domain/budget/cost/service/CostService.java`
- Test: `src/test/.../project/service/ProjectServiceTest.java`, `src/test/.../cost/service/CostServiceTest.java`

**Interfaces:**
- Consumes: `ApprovalStamper.stampDrafted(...)` (Task 5)
- Produces: 요청 DTO 4개에 `Boolean complete` (`@NotNull`). `true`=저장(작성완료), `false`=임시저장. 반입 경로는 값을 채우지 않으며 스탬프하지 않는다. 프론트 Task 15가 이 필드를 보낸다.

- [ ] **Step 1: 실패하는 테스트 작성**

`ProjectServiceTest.java`: `@Mock` 목록에 추가하고 테스트 두 개를 넣는다.

```java
    @Mock private com.kdb.it.common.approval.service.ApprovalStamper approvalStamper;
```

```java
    @Test
    @DisplayName("createProject: complete=true면 주관부서·사업명으로 작성완료 신청서를 스탬프한다")
    void createProject_completeTrue_stampsDrafted() {
        given(projectRepository.getNextSequenceValue()).willReturn(7L);
        ProjectDto.CreateRequest request =
                ProjectDto.CreateRequest.builder()
                        .abusNm("작성완료 사업")
                        .bseYy("2026")
                        .svnDpmC("D001")
                        .complete(true)
                        .build();

        projectService.createProject(request);

        verify(approvalStamper)
                .stampDrafted(
                        eq("BPROJM"),
                        eq("PRJ-2026-0007"),
                        any(),
                        eq("작성완료 사업"),
                        eq("10001"),
                        eq("D001"),
                        eq("2026"));
    }

    @Test
    @DisplayName("createProject: complete=false(임시저장)나 미지정(반입)이면 스탬프하지 않는다")
    void createProject_completeFalse_doesNotStamp() {
        given(projectRepository.getNextSequenceValue()).willReturn(8L);
        ProjectDto.CreateRequest draft =
                ProjectDto.CreateRequest.builder().abusNm("임시저장").bseYy("2026").complete(false).build();
        ProjectDto.CreateRequest imported =
                ProjectDto.CreateRequest.builder().abusNm("반입").bseYy("2026").build();

        projectService.createProject(draft);
        projectService.createProject(imported, true);

        verify(approvalStamper, org.mockito.Mockito.never())
                .stampDrafted(any(), any(), any(), any(), any(), any(), any());
    }
```
`authentication.getName()`이 `"10001"`을 돌려주도록 `@BeforeEach setUpSecurity`에 `given(authentication.getName()).willReturn("10001");`을 추가한다. `eq`는 `org.mockito.ArgumentMatchers.eq` static import.

`CostServiceTest.java`: `@Mock private com.kdb.it.common.approval.service.ApprovalStamper approvalStamper;`와 `@Mock private SecurityContext securityContext; @Mock private Authentication authentication;`(이미 있으면 재사용)을 두고 테스트를 추가한다.

```java
    @Test
    @DisplayName("createCost: complete=true면 계약명·주관부서로 작성완료 신청서를 스탬프한다")
    void createCost_completeTrue_stampsDrafted() {
        given(securityContext.getAuthentication()).willReturn(authentication);
        given(authentication.getName()).willReturn("K10001");
        SecurityContextHolder.setContext(securityContext);
        CostDto.CreateRequest request =
                CostDto.CreateRequest.builder()
                        .costBgNo(IT_MNGC_NO)
                        .cttNm("작성완료 계약")
                        .costSvnDpmC("BBR001")
                        .bseYy("2026")
                        .complete(true)
                        .build();
        given(costRepository.getNextSnoValue(IT_MNGC_NO)).willReturn(1);
        given(costRepository.save(any(Bcostm.class))).willAnswer(inv -> inv.getArgument(0));

        costService.createCost(request);

        verify(approvalStamper)
                .stampDrafted(
                        eq("BCOSTM"), eq(IT_MNGC_NO), eq(1), eq("작성완료 계약"), eq("K10001"), eq("BBR001"), eq("2026"));
        SecurityContextHolder.clearContext();
    }

    @Test
    @DisplayName("createCost: 반입 경로(createCostForMigration)는 complete와 무관하게 스탬프하지 않는다")
    void createCostForMigration_doesNotStamp() {
        CostDto.CreateRequest request =
                CostDto.CreateRequest.builder().costBgNo(IT_MNGC_NO).cttNm("반입").complete(true).build();
        given(costRepository.getNextSnoValue(IT_MNGC_NO)).willReturn(1);
        given(costRepository.save(any(Bcostm.class))).willAnswer(inv -> inv.getArgument(0));

        costService.createCostForMigration(request, 2026);

        verify(approvalStamper, org.mockito.Mockito.never())
                .stampDrafted(any(), any(), any(), any(), any(), any(), any());
    }
```
`CostDto.CreateRequest`에 `bseYy` 빌더 필드가 없으면(`@Builder` 필드 목록 확인) `bseYy` 검증을 `any()`로 바꾼다.

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew compileTestJava
```
Expected: `complete(...)` 빌더 메서드 없음.

- [ ] **Step 3: DTO 구현**

`ProjectDto.CreateRequest`·`UpdateRequest`, `CostDto.CreateRequest`·`UpdateRequest` 각각의 마지막 필드 뒤에 추가한다(네 곳 동일).

```java
        /**
         * 저장 종류. {@code true}는 저장(작성완료 신청서 0 스탬프), {@code false}는 임시저장(신청서 없음).
         *
         * <p>화면 경로는 필수다. 엑셀 반입처럼 서비스 내부에서 DTO를 만드는 경로는 비워 두며 그때는 스탬프하지 않는다.
         */
        @jakarta.validation.constraints.NotNull(message = "저장 종류(complete)는 필수입니다.")
        @Schema(
                description = "작성완료 여부 (true=저장, false=임시저장)",
                requiredMode = Schema.RequiredMode.REQUIRED)
        private Boolean complete;
```

`@Valid @RequestBody`로 이 DTO를 받는 컨트롤러가 `ProjectController`·`CostController` 외에 더 있는지 확인한다.

```powershell
Get-ChildItem -Recurse src/main -Include *.java | Select-String "@Valid @RequestBody (ProjectDto|CostDto)\.(Create|Update)Request"
```
Expected: `ProjectController`와 `CostController`만. 다른 컨트롤러가 나오면 그 호출 프론트도 Task 15에서 `complete`를 보내도록 목록에 적는다.

- [ ] **Step 4: 서비스 구현**

`ProjectService.java`: 필드와 헬퍼를 추가한다.

```java
    /** 작성완료 신청서 스탬프 — [저장] 시 결재선 없는 신청서 0을 만든다 */
    private final com.kdb.it.common.approval.service.ApprovalStamper approvalStamper;
```

```java
    /**
     * 작성완료 저장이면 원천에 작성완료 신청서를 스탬프합니다.
     *
     * @param complete 요청의 저장 종류. null(반입 경로)이나 false면 아무것도 하지 않습니다
     * @param project 저장이 끝난 사업 엔티티
     * @throws IllegalStateException 최신 신청서가 결재중인 경우
     */
    private void stampDraftedIfCompleted(Boolean complete, Bprojm project) {
        if (!Boolean.TRUE.equals(complete)) {
            return;
        }
        approvalStamper.stampDrafted(
                "BPROJM",
                project.getAbusMngNo(),
                project.getSno(),
                project.getAbusNm(),
                currentEno(),
                project.getSvnDpmC(),
                project.getBseYy());
    }

    /** 인증 주체 사번. 미인증이면 null */
    private static String currentEno() {
        org.springframework.security.core.Authentication auth =
                org.springframework.security.core.context.SecurityContextHolder.getContext()
                        .getAuthentication();
        return auth == null ? null : auth.getName();
    }
```

`createProject(request, skipBudgetPeriodValidation)`의 `bprojaSyncService.upsert(prjMngNo, prjMngNo, "01");` 바로 뒤와, `updateProject(prjMngNo, sno, request)`의 `applyAmountSnapshot(project, request.getDfrAmt());` 바로 뒤에 각각 `stampDraftedIfCompleted(request.getComplete(), project);`를 넣는다.

`CostService.java`: 필드 `private final com.kdb.it.common.approval.service.ApprovalStamper approvalStamper;`와 같은 형태의 헬퍼를 추가한다.

```java
    private void stampDraftedIfCompleted(Boolean complete, Bcostm cost) {
        if (!Boolean.TRUE.equals(complete)) {
            return;
        }
        approvalStamper.stampDrafted(
                COST_TABLE,
                cost.getCostBgNo(),
                cost.getBgSno(),
                cost.getCttNm(),
                currentEno(),
                cost.getCostSvnDpmC(),
                cost.getBseYy());
    }
```
(`COST_TABLE` 상수가 `"BCOSTM"`으로 이미 있는지 확인하고 없으면 `private static final String COST_TABLE = "BCOSTM";`을 둔다. `currentEno()`는 ProjectService와 같은 코드.)

private `createCost(request, skip, preserveSubmittedAmounts, idYear)`의 `return cost.getCostBgNo();` 앞에, private `updateCost(...)`의 `return target.getCostBgNo();` 앞에 각각 `if (!preserveSubmittedAmounts) { stampDraftedIfCompleted(request.getComplete(), cost /* update는 target */); }`를 넣는다.

- [ ] **Step 5: 통과 확인**

```powershell
./gradlew test --tests 'com.kdb.it.domain.budget.project.service.ProjectServiceTest' --tests 'com.kdb.it.domain.budget.cost.service.CostServiceTest'
```
Expected: PASS.

- [ ] **Step 6: Commit**

```powershell
git add src/main/java/com/kdb/it/domain/budget/project/dto/ProjectDto.java src/main/java/com/kdb/it/domain/budget/cost/dto/CostDto.java src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java src/test/java/com/kdb/it/domain/budget/cost/service/CostServiceTest.java
git commit -m "feat: 저장 요청 complete 플래그로 작성완료 신청서 스탬프"
```

---

### Task 7: 결재함 목록에서 작성완료 제외, 미상신 건수 스코프 전환

**Files:**
- Modify: `common/approval/repository/ApplicationRepository.java`
- Modify: `common/approval/service/ApplicationService.java` (`getApplications`, `getPendingCount`)
- Test: `src/test/.../common/approval/service/ApplicationServiceTest.java`

**Interfaces:**
- Produces: `List<ApplicationReadView> ApplicationRepository.findTop500ByItPtlApfPrgStsCNotOrderByApfMngNoDesc(String status)`. `getPendingCount`는 `apfSts="0"`으로 집계한다.

- [ ] **Step 1: 테스트 수정**

`ApplicationServiceTest.java`에서 `findTop500ByOrderByApfMngNoDesc()` 스텁 전부(6곳)를 다음으로 바꾼다.

```java
        given(applicationRepository.findTop500ByItPtlApfPrgStsCNotOrderByApfMngNoDesc(
                        ApprovalStatus.DRAFTED.code()))
                .willReturn(List.of(v1, v2));
```

`getPendingCount` 테스트(약 535행)에서 `projectRepository.countBySearchCondition`·`costRepository.countBySearchCondition` 스텁이 `any()`이면 그대로 두고, 검증을 추가한다.

```java
        ArgumentCaptor<ProjectDto.SearchCondition> captor =
                ArgumentCaptor.forClass(ProjectDto.SearchCondition.class);
        verify(projectRepository).countBySearchCondition(captor.capture());
        assertThat(captor.getValue().getApfSts()).isEqualTo("0");
```

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew compileTestJava
```

- [ ] **Step 3: 구현**

`ApplicationRepository.java`의 `findTop500ByOrderByApfMngNoDesc` 아래에 추가한다.

```java
    /**
     * 지정한 상태를 제외한 신청서 read view를 최신순 상한 500건으로 조회합니다.
     *
     * <p>결재함 목록은 결재선이 없는 작성완료({@code 0}) 신청서를 보이지 않습니다.
     *
     * @param itPtlApfPrgStsC 제외할 신청서 상태 코드
     * @return 신청서 read view 목록 (최신순, 최대 500건)
     */
    List<ApplicationReadView> findTop500ByItPtlApfPrgStsCNotOrderByApfMngNoDesc(
            String itPtlApfPrgStsC);
```

`ApplicationService.getApplications()`:

```java
    public List<ApplicationDto.Response> getApplications() {
        // 결재선 없는 작성완료(0) 신청서는 결재함 대상이 아니므로 제외한다 (최신순 상한 500건)
        return assembleList(
                applicationRepository.findTop500ByItPtlApfPrgStsCNotOrderByApfMngNoDesc(
                        ApprovalStatus.DRAFTED.code()));
    }
```

`getPendingCount`의 `projectCondition.setApfSts("none");`과 `costCondition.setApfSts("none");`을 `setApfSts(ApprovalStatus.DRAFTED.code())`로 바꾸고 JavaDoc의 "apfSts='none' … CAPPLA 연결이 없는" 설명을 "apfSts='0' — 최신 신청서가 작성완료인 원천 = 상신 대상"으로 고친다.

- [ ] **Step 4: 통과 확인**

```powershell
./gradlew test --tests 'com.kdb.it.common.approval.service.ApplicationServiceTest'
```

- [ ] **Step 5: Commit**

```powershell
git add src/main/java/com/kdb/it/common/approval/repository/ApplicationRepository.java src/main/java/com/kdb/it/common/approval/service/ApplicationService.java src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java
git commit -m "feat: 결재함 목록에서 작성완료 제외, 상신 대상 건수는 작성완료 기준"
```

---

### Task 8: 결재라인 제안 API

**Files:**
- Create: `common/iam/BranchCodes.java`
- Modify: `domain/migration/request/service/adapter/FormAdapterContext.java` (`foreignBranch`가 `BranchCodes` 사용)
- Modify: `common/code/CommonCodeGroups.java` (그룹 상수 2개)
- Modify: `common/iam/repository/UserRepository.java` (후보 조회 2개)
- Modify: `common/approval/dto/ApplicationDto.java` (`ApprovalLineSuggestion`)
- Create: `common/approval/service/ApprovalLineSuggestionService.java`
- Modify: `common/approval/controller/ApplicationController.java`
- Test: `src/test/.../common/iam/BranchCodesTest.java`, `src/test/.../common/approval/service/ApprovalLineSuggestionServiceTest.java`, `src/test/.../common/approval/controller/ApplicationControllerTest.java`

**Interfaces:**
- Consumes: 그룹 `IT_PTL_APF_DCR_PT_C`(Task 2), `CodeService.getCcodemsByCId(String cId, LocalDate)` → `List<CodeDto.Response>` (`getCdva()`=직위코드, `getCdvaDtlC()`=차수)
- Produces:
  - `boolean BranchCodes.isForeign(String bbrC)`
  - `List<CuserI> UserRepository.findByBbrCAndTemCAndPtCInAndDelYn(String, String, Collection<String>, String)`, `findByBbrCAndPtCInAndDelYn(String, Collection<String>, String)`
  - `ApplicationDto.ApprovalLineSuggestion ApprovalLineSuggestionService.suggest(String drafterEno)`
  - `GET /api/applications/approval-line/suggestion` → `ApplicationApprovalLineSuggestion` 스키마 (프론트 Task 16이 소비)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/test/java/com/kdb/it/common/iam/BranchCodesTest.java`:

```java
package com.kdb.it.common.iam;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class BranchCodesTest {

    @Test
    @DisplayName("부점코드가 9로 시작하면 국외점포다")
    void foreignWhenPrefixNine() {
        assertThat(BranchCodes.isForeign("920")).isTrue();
        assertThat(BranchCodes.isForeign("120")).isFalse();
        assertThat(BranchCodes.isForeign(null)).isFalse();
        assertThat(BranchCodes.isForeign("")).isFalse();
    }
}
```

`src/test/java/com/kdb/it/common/approval/service/ApprovalLineSuggestionServiceTest.java`:

```java
package com.kdb.it.common.approval.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;

import com.kdb.it.common.approval.dto.ApplicationDto;
import com.kdb.it.common.approval.dto.ApplicationDto.ApprovalLineSuggestion.SuggestionReason;
import com.kdb.it.common.code.dto.CodeDto;
import com.kdb.it.common.code.service.CodeService;
import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

/** 국내점포 결재라인 자동지정 판정 규칙을 고정합니다 (설계 §7.1). */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ApprovalLineSuggestionServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private CodeService codeService;
    @InjectMocks private ApprovalLineSuggestionService service;

    private static CuserI user(String eno, String bbrC, String temC, String ptC, String name) {
        return CuserI.builder().eno(eno).bbrC(bbrC).temC(temC).ptC(ptC).usrNm(name).build();
    }

    private static CodeDto.Response code(String cdva, String tier) {
        return CodeDto.Response.builder().cdva(cdva).cdvaDtlC(tier).build();
    }

    @BeforeEach
    void seedPositionCodes() {
        given(codeService.getCcodemsByCId(eq("IT_PTL_APF_DCR_PT_C"), any()))
                .willReturn(
                        List.of(
                                code("B1EX", "1"), code("I3EX", "1"),
                                code("B1AX", "2"), code("B1CX", "2"), code("B1BX", "2"),
                                code("B1AY", "2"), code("B1GX", "2"), code("Z2C", "2")));
        given(userRepository.findByEno("K10001"))
                .willReturn(Optional.of(user("K10001", "120", "T01", "B2AX", "기안자")));
    }

    @Test
    @DisplayName("같은 팀 팀장 1명, 같은 부점 부장 1명이면 둘 다 지정한다")
    void suggestsBothWhenSingleCandidates() {
        given(userRepository.findByBbrCAndTemCAndPtCInAndDelYn(eq("120"), eq("T01"), any(), eq("N")))
                .willReturn(List.of(user("K20001", "120", "T01", "B1EX", "팀장")));
        given(userRepository.findByBbrCAndPtCInAndDelYn(eq("120"), any(), eq("N")))
                .willReturn(List.of(user("K30001", "120", "T09", "B1AX", "부장")));

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.isForeignBranch()).isFalse();
        assertThat(result.getTeamLead().getEno()).isEqualTo("K20001");
        assertThat(result.getDeptHead().getEno()).isEqualTo("K30001");
        assertThat(result.getTeamLeadReason()).isNull();
        assertThat(result.getDeptHeadReason()).isNull();
    }

    @Test
    @DisplayName("후보가 없으면 NONE, 2명 이상이면 MULTIPLE 사유로 비운다")
    void reportsNoneAndMultiple() {
        given(userRepository.findByBbrCAndTemCAndPtCInAndDelYn(eq("120"), eq("T01"), any(), eq("N")))
                .willReturn(List.of());
        given(userRepository.findByBbrCAndPtCInAndDelYn(eq("120"), any(), eq("N")))
                .willReturn(
                        List.of(
                                user("K30001", "120", "T09", "B1AX", "부장"),
                                user("K30002", "120", "T08", "B1CX", "실장")));

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.getTeamLead()).isNull();
        assertThat(result.getTeamLeadReason()).isEqualTo(SuggestionReason.NONE);
        assertThat(result.getDeptHead()).isNull();
        assertThat(result.getDeptHeadReason()).isEqualTo(SuggestionReason.MULTIPLE);
    }

    @Test
    @DisplayName("사번 접두사가 K가 아니거나 기안자 본인이면 후보에서 뺀다")
    void excludesNonPrefixAndSelf() {
        given(userRepository.findByEno("K10001"))
                .willReturn(Optional.of(user("K10001", "120", "T01", "B1EX", "팀장 기안자")));
        given(userRepository.findByBbrCAndTemCAndPtCInAndDelYn(eq("120"), eq("T01"), any(), eq("N")))
                .willReturn(
                        List.of(
                                user("K10001", "120", "T01", "B1EX", "팀장 기안자"),
                                user("A20002", "120", "T01", "I3EX", "외부 CO")));
        given(userRepository.findByBbrCAndPtCInAndDelYn(eq("120"), any(), eq("N")))
                .willReturn(List.of(user("K30001", "120", "T09", "B1AX", "부장")));

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.getTeamLead()).isNull();
        assertThat(result.getTeamLeadReason()).isEqualTo(SuggestionReason.NONE);
        assertThat(result.getDeptHead().getEno()).isEqualTo("K30001");
    }

    @Test
    @DisplayName("1차와 2차가 같은 사람이면 2차를 DUPLICATE로 비운다")
    void reportsDuplicateWhenSamePerson() {
        given(userRepository.findByBbrCAndTemCAndPtCInAndDelYn(eq("120"), eq("T01"), any(), eq("N")))
                .willReturn(List.of(user("K20001", "120", "T01", "B1EX", "팀장 겸 부장")));
        given(userRepository.findByBbrCAndPtCInAndDelYn(eq("120"), any(), eq("N")))
                .willReturn(List.of(user("K20001", "120", "T01", "B1EX", "팀장 겸 부장")));

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.getTeamLead().getEno()).isEqualTo("K20001");
        assertThat(result.getDeptHead()).isNull();
        assertThat(result.getDeptHeadReason()).isEqualTo(SuggestionReason.DUPLICATE);
    }

    @Test
    @DisplayName("국외점포(부점코드 9로 시작) 기안자는 자동지정하지 않는다")
    void skipsForeignBranch() {
        given(userRepository.findByEno("K10001"))
                .willReturn(Optional.of(user("K10001", "920", "T01", "B2AX", "런던")));

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.isForeignBranch()).isTrue();
        assertThat(result.getTeamLead()).isNull();
        assertThat(result.getDeptHead()).isNull();
    }

    @Test
    @DisplayName("직위코드 그룹이 비어 있으면 두 차수 모두 NONE으로 응답한다")
    void reportsNoneWhenCodeGroupEmpty() {
        given(codeService.getCcodemsByCId(anyString(), any())).willReturn(List.of());

        ApplicationDto.ApprovalLineSuggestion result = service.suggest("K10001");

        assertThat(result.getTeamLeadReason()).isEqualTo(SuggestionReason.NONE);
        assertThat(result.getDeptHeadReason()).isEqualTo(SuggestionReason.NONE);
    }

    @Test
    @DisplayName("기안자를 찾지 못하면 IllegalArgumentException")
    void throwsWhenDrafterMissing() {
        given(userRepository.findByEno("NOBODY")).willReturn(Optional.empty());

        org.assertj.core.api.Assertions.assertThatThrownBy(() -> service.suggest("NOBODY"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
```
`CodeDto.Response`에 `@Builder`가 없으면 `new CodeDto.Response()` 후 setter 또는 `fromEntity(Ccodem.builder()...)`로 바꾼다(테스트 컴파일 시 확인).

`ApplicationControllerTest.java`에 `@MockitoBean private ApprovalLineSuggestionService approvalLineSuggestionService;`와 테스트 두 개를 추가한다.

```java
    @Test
    @DisplayName("GET /api/applications/approval-line/suggestion - 비인증 → 401")
    void suggestApprovalLine_비인증_401() throws Exception {
        mockMvc.perform(get("/api/applications/approval-line/suggestion"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET /api/applications/approval-line/suggestion - 인증 주체 사번으로 제안한다")
    @WithMockUser(username = "10001")
    void suggestApprovalLine_인증_200() throws Exception {
        given(approvalLineSuggestionService.suggest("10001"))
                .willReturn(ApplicationDto.ApprovalLineSuggestion.foreign());
        mockMvc.perform(get("/api/applications/approval-line/suggestion"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.foreignBranch").value(true));
    }
```

- [ ] **Step 2: 실패 확인**

```powershell
./gradlew compileTestJava
```
Expected: `BranchCodes`, `ApprovalLineSuggestionService`, `ApprovalLineSuggestion` 심볼 없음.

- [ ] **Step 3: 구현**

`common/iam/BranchCodes.java`:

```java
package com.kdb.it.common.iam;

/** 부점코드 판정 규칙 모음. 편성요청서 반입과 결재라인 자동지정이 같은 기준을 쓴다. */
public final class BranchCodes {

    /** 국외 점포 부점코드의 앞자리. 실측 조직표에서 `9**`가 국외 점포다(예: 런던지점 `920`). */
    public static final String FOREIGN_PREFIX = "9";

    private BranchCodes() {}

    /**
     * 국외점포인지 판정합니다.
     *
     * @param bbrC 부점코드. null·빈 값은 국내로 봅니다
     * @return 국외점포면 true
     */
    public static boolean isForeign(String bbrC) {
        return bbrC != null && bbrC.startsWith(FOREIGN_PREFIX);
    }
}
```

`FormAdapterContext.java`: `FOREIGN_DEPT_PREFIX` 상수를 지우고 `foreignBranch()` 본문을 `return com.kdb.it.common.iam.BranchCodes.isForeign(resolvedDeptCode);`로 바꾼다(JavaDoc은 유지).

`CommonCodeGroups.java` 끝에 추가:

```java
    /** 결재자직위코드 — 전산예산 결재라인 자동지정. CDVA=PT_C, CO_CDVA_NM=차수(1/2) */
    public static final String APF_DCR_PT = "IT_PTL_APF_DCR_PT_C";

    /** 산정근거구분코드 — 소요자원 산정근거 선택지 */
    public static final String CNCD_FDTN = "IT_PTL_CNCD_FDTN_TC";
```

`UserRepository.java`에 추가:

```java
    /**
     * 같은 부점·같은 팀에서 지정한 직위코드를 가진 재직자를 조회합니다 (1차 결재자 후보).
     *
     * @param bbrC 부점코드
     * @param temC 팀코드
     * @param ptCs 직위코드 목록
     * @param delYn 삭제여부 ('N'=재직)
     * @return 후보 목록 (조직 정보 포함)
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "organization")
    java.util.List<CuserI> findByBbrCAndTemCAndPtCInAndDelYn(
            String bbrC, String temC, Collection<String> ptCs, String delYn);

    /**
     * 같은 부점에서 지정한 직위코드를 가진 재직자를 조회합니다 (2차 결재자 후보).
     *
     * @param bbrC 부점코드
     * @param ptCs 직위코드 목록
     * @param delYn 삭제여부 ('N'=재직)
     * @return 후보 목록 (조직 정보 포함)
     */
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = "organization")
    java.util.List<CuserI> findByBbrCAndPtCInAndDelYn(
            String bbrC, Collection<String> ptCs, String delYn);
```

`ApplicationDto.java`에 추가:

```java
    /** 결재라인 자동지정 제안 응답입니다. 비운 차수는 사유를 함께 돌려줍니다. */
    @Getter
    @lombok.Builder
    @Schema(name = "ApplicationApprovalLineSuggestion", description = "결재라인 자동지정 제안")
    public static class ApprovalLineSuggestion {
        /** 차수를 비운 이유 */
        public enum SuggestionReason {
            /** 후보 없음 */
            NONE,
            /** 후보 2명 이상 */
            MULTIPLE,
            /** 1차 결재자와 같은 사람 */
            DUPLICATE
        }

        @Schema(description = "국외점포라 자동지정하지 않았으면 true", requiredMode = Schema.RequiredMode.REQUIRED)
        private boolean foreignBranch;

        @Schema(description = "1차 결재자 (동일팀 팀장·CO)", nullable = true)
        private com.kdb.it.common.iam.dto.UserDto.ListResponse teamLead;

        @Schema(description = "2차 결재자 (동일부점 부·실·지점장, 국장, 센터장, 사장)", nullable = true)
        private com.kdb.it.common.iam.dto.UserDto.ListResponse deptHead;

        @Schema(description = "1차를 비운 이유", nullable = true)
        private SuggestionReason teamLeadReason;

        @Schema(description = "2차를 비운 이유", nullable = true)
        private SuggestionReason deptHeadReason;

        /** 국외점포 응답 (자동지정 없음) */
        public static ApprovalLineSuggestion foreign() {
            return ApprovalLineSuggestion.builder().foreignBranch(true).build();
        }
    }
```

`common/approval/service/ApprovalLineSuggestionService.java`:

```java
package com.kdb.it.common.approval.service;

import com.kdb.it.common.approval.dto.ApplicationDto;
import com.kdb.it.common.approval.dto.ApplicationDto.ApprovalLineSuggestion.SuggestionReason;
import com.kdb.it.common.code.CommonCodeGroups;
import com.kdb.it.common.code.dto.CodeDto;
import com.kdb.it.common.code.service.CodeService;
import com.kdb.it.common.iam.BranchCodes;
import com.kdb.it.common.iam.dto.UserDto;
import com.kdb.it.common.iam.entity.CuserI;
import com.kdb.it.common.iam.repository.UserRepository;
import java.time.LocalDate;
import java.util.List;
import java.util.Objects;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 전산예산 요청서 결재라인 자동지정 제안.
 *
 * <p>국내점포 기안자에 대해 1차(같은 부점·같은 팀의 1차 직위)와 2차(같은 부점의 2차 직위)를 직위코드 공통코드 그룹
 * {@link CommonCodeGroups#APF_DCR_PT}로 판정합니다. 후보가 정확히 1명일 때만 지정하고 그 외에는 사유를 돌려줍니다. 국외점포는 자동지정하지
 * 않습니다.
 */
@Slf4j
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ApprovalLineSuggestionService {

    /** 결재자 후보 사번 접두사 — 프론트 직원 검색과 같은 규칙 */
    static final String APPROVER_ENO_PREFIX = "K";

    private static final String TIER_TEAM_LEAD = "1";
    private static final String TIER_DEPT_HEAD = "2";

    private final UserRepository userRepository;
    private final CodeService codeService;

    /** 차수별 후보 판정 결과 */
    private record Pick(CuserI user, SuggestionReason reason) {}

    /**
     * 기안자 기준 결재라인을 제안합니다.
     *
     * @param drafterEno 기안자 사번
     * @return 제안 결과. 국외점포면 {@code foreignBranch=true}에 결재자 없음
     * @throws IllegalArgumentException 기안자 사용자 행이 없는 경우
     */
    public ApplicationDto.ApprovalLineSuggestion suggest(String drafterEno) {
        CuserI drafter =
                userRepository
                        .findByEno(drafterEno)
                        .orElseThrow(
                                () -> new IllegalArgumentException("사용자를 찾을 수 없습니다: " + drafterEno));
        if (BranchCodes.isForeign(drafter.getBbrC())) {
            return ApplicationDto.ApprovalLineSuggestion.foreign();
        }

        List<CodeDto.Response> positions =
                codeService.getCcodemsByCId(CommonCodeGroups.APF_DCR_PT, LocalDate.now());
        List<String> teamLeadCodes = codesOfTier(positions, TIER_TEAM_LEAD);
        List<String> deptHeadCodes = codesOfTier(positions, TIER_DEPT_HEAD);
        if (positions.isEmpty()) {
            log.warn("결재자직위코드 그룹({})이 비어 있어 자동지정하지 않습니다", CommonCodeGroups.APF_DCR_PT);
        }

        Pick teamLead =
                pick(
                        teamLeadCodes.isEmpty() || drafter.getTemC() == null
                                ? List.of()
                                : userRepository.findByBbrCAndTemCAndPtCInAndDelYn(
                                        drafter.getBbrC(), drafter.getTemC(), teamLeadCodes, "N"),
                        drafterEno);
        Pick deptHead =
                pick(
                        deptHeadCodes.isEmpty()
                                ? List.of()
                                : userRepository.findByBbrCAndPtCInAndDelYn(
                                        drafter.getBbrC(), deptHeadCodes, "N"),
                        drafterEno);
        if (teamLead.user() != null
                && deptHead.user() != null
                && Objects.equals(teamLead.user().getEno(), deptHead.user().getEno())) {
            deptHead = new Pick(null, SuggestionReason.DUPLICATE);
        }

        return ApplicationDto.ApprovalLineSuggestion.builder()
                .foreignBranch(false)
                .teamLead(toResponse(teamLead.user()))
                .teamLeadReason(teamLead.reason())
                .deptHead(toResponse(deptHead.user()))
                .deptHeadReason(deptHead.reason())
                .build();
    }

    private static List<String> codesOfTier(List<CodeDto.Response> positions, String tier) {
        return positions.stream()
                .filter(code -> tier.equals(code.getCdvaDtlC()))
                .map(CodeDto.Response::getCdva)
                .toList();
    }

    /** 사번 접두사·본인 제외 후 정확히 1명이면 지정, 0명이면 NONE, 2명 이상이면 MULTIPLE */
    private static Pick pick(List<CuserI> candidates, String drafterEno) {
        List<CuserI> eligible =
                candidates.stream()
                        .filter(user -> user.getEno() != null && user.getEno().startsWith(APPROVER_ENO_PREFIX))
                        .filter(user -> !user.getEno().equals(drafterEno))
                        .toList();
        if (eligible.isEmpty()) {
            return new Pick(null, SuggestionReason.NONE);
        }
        if (eligible.size() > 1) {
            return new Pick(null, SuggestionReason.MULTIPLE);
        }
        return new Pick(eligible.get(0), null);
    }

    private static UserDto.ListResponse toResponse(CuserI user) {
        return user == null ? null : UserDto.ListResponse.fromEntity(user, user.getBbrNm());
    }
}
```

`ApplicationController.java`: 필드 `private final ApprovalLineSuggestionService approvalLineSuggestionService;`를 추가하고 `/pending-count` 엔드포인트 아래에 넣는다.

```java
    /**
     * 결재라인 자동지정 제안
     *
     * <p>로그인 사용자를 기안자로 보고 동일팀 팀장·CO(1차), 동일부점 부점장급(2차)을 직위코드로 찾아 돌려줍니다. 국외점포는 빈 결과입니다.
     *
     * @param auth 인증 주체 (사번)
     * @return HTTP 200 + 제안 결과
     */
    @GetMapping("/approval-line/suggestion")
    @Operation(
            summary = "결재라인 자동지정 제안",
            description = "국내점포 기안자의 1차(동일팀 팀장·CO)·2차(동일부점 부점장급) 결재자를 직위코드로 제안합니다.")
    public ResponseEntity<ApplicationDto.ApprovalLineSuggestion> suggestApprovalLine(
            Authentication auth) {
        return ResponseEntity.ok(approvalLineSuggestionService.suggest(auth.getName()));
    }
```

- [ ] **Step 4: 통과 확인**

```powershell
./gradlew test --tests 'com.kdb.it.common.iam.BranchCodesTest' --tests 'com.kdb.it.common.approval.service.ApprovalLineSuggestionServiceTest' --tests 'com.kdb.it.common.approval.controller.ApplicationControllerTest' --tests 'com.kdb.it.domain.migration.request.service.adapter.*'
```
Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add src/main/java/com/kdb/it/common/iam/BranchCodes.java src/main/java/com/kdb/it/domain/migration/request/service/adapter/FormAdapterContext.java src/main/java/com/kdb/it/common/code/CommonCodeGroups.java src/main/java/com/kdb/it/common/iam/repository/UserRepository.java src/main/java/com/kdb/it/common/approval/dto/ApplicationDto.java src/main/java/com/kdb/it/common/approval/service/ApprovalLineSuggestionService.java src/main/java/com/kdb/it/common/approval/controller/ApplicationController.java src/test/java/com/kdb/it/common/iam/BranchCodesTest.java src/test/java/com/kdb/it/common/approval/service/ApprovalLineSuggestionServiceTest.java src/test/java/com/kdb/it/common/approval/controller/ApplicationControllerTest.java
git diff --cached --stat
git commit -m "feat: 국내점포 결재라인 자동지정 제안 API"
```

---

### Task 9: 백엔드 가이드 문서와 전체 테스트

**Files:**
- Create: `it_backend/docs/guides/domains/approval-status.md`
- Modify: `it_backend/docs/guides/README.md` (목차에 링크 한 줄)

- [ ] **Step 1: 가이드 작성**

`docs/guides/domains/approval-status.md`:

```markdown
# 신청서 상태와 작성완료 스탬프

## 상태 코드 (`IT_PTL_APF_PRG_STS_C`, `ApprovalStatus`)

| 코드 | 상수 | 의미 | 결재선 |
| --- | --- | --- | --- |
| `0` | `DRAFTED` | 작성완료. [저장]으로 만든 결재선 없는 신청서 | 없음 |
| `1` | `IN_PROGRESS` | 결재중 | 있음 |
| `2` | `COMPLETED` | 결재완료 | 있음 |
| `3` | `REJECTED` | 반려 | 있음 |
| `4` | `RECALLED` | 회수 | 있음 |
| `9` | `MANUAL` | 수기등록(편성요청서 반입). 등록자결재요청내용 `수기등록` 표식 | 없음 |

신청서가 없는 원천은 **임시저장**이다. 상신 대상은 최신 신청서가 `0`인 원천이며, 반려·회수 건은 다시 [저장]해야 상신 대상이 된다.

## 스탬프 규칙 (`ApprovalStamper`)

- `stamp(...)`: 반입 전용. 결재완료 또는 수기등록 상태의 받이를 만든다.
- `stampDrafted(...)`: `ProjectService`·`CostService`가 요청의 `complete=true`일 때 호출한다. 같은 `(원천, 관리번호, 순번)`의 최신 신청서가 `0`이면 제목만 갱신하고, `1`이면 `IllegalStateException`, 그 외에는 새 `0` 신청서를 만든다.
- 결재 상신(`ApplicationService.submit`)은 묶음 단위로 새 `1` 신청서를 만든다. `0` 행은 갱신하지 않고 최신 신청서번호 판정으로 자연히 덮인다.

## 목록·집계

- `BudgetListVersionScope`: `0`·`1`·`3`·`4` 스코프는 재상신 초안(`LST_YN='N'`)까지 노출한다.
- 결재함 목록(`GET /api/applications`)과 대시보드는 `0`을 제외한다.
- 사이드바 상신 대상 건수(`/pending-count`)는 `apfSts=0`으로 집계한다.
```

`docs/guides/README.md`의 도메인 목록에 `- [신청서 상태와 작성완료 스탬프](domains/approval-status.md)`를 추가한다.

- [ ] **Step 2: 전체 테스트**

```powershell
cd C:\it\it_backend
./gradlew test
```
Expected: BUILD SUCCESSFUL. 실패하면 `build/reports/tests/test/index.html`에서 실패 클래스를 확인하고 이 계획의 해당 태스크로 돌아가 고친다. (`EOFException`으로 BUILD FAILED인데 테스트는 통과면 `build/test-results/test/binary`를 지우고 재실행한다.)

- [ ] **Step 3: Commit**

```powershell
git add docs/guides/domains/approval-status.md docs/guides/README.md
git commit -m "docs: 신청서 상태 코드와 작성완료 스탬프 가이드"
```

---

### Task 10: OpenAPI 타입 재생성

**Files:**
- Modify (생성물): `it_frontend/app/types/api.d.ts`

**Interfaces:**
- Consumes: Task 6·8의 DTO 변경
- Produces: `components['schemas']['ApplicationApprovalLineSuggestion']`, `ProjectCreateRequest.complete`, `CostCreateRequest.complete` 등 생성 타입. 이후 프론트 태스크가 이 타입을 쓴다.

- [ ] **Step 1: 백엔드 기동 후 codegen**

`it_backend/README.md` 절차로 로컬 백엔드를 기동한 상태에서:

```powershell
cd C:\it\it_frontend
npm run codegen
npm run codegen:check
```
Expected: `codegen:check` 종료코드 0.

- [ ] **Step 2: 생성 결과 확인**

```powershell
Select-String -Path app/types/api.d.ts -Pattern "ApplicationApprovalLineSuggestion: \{|complete: boolean;" | Select-Object -First 6
```
Expected: 스키마 1건과 `complete: boolean;` 4건(Project/Cost의 Create/Update).

- [ ] **Step 3: Commit**

```powershell
git add app/types/api.d.ts
git commit -m "chore: 작성완료 플래그와 결재라인 제안 API 타입 재생성"
```

---

### Task 11: 사업연도 기본값·선택지·유의사항 팝업 (변경2)

**Files:**
- Modify: `app/utils/budgetYear.ts`
- Create: `app/features/project/useProjectYearNotice.ts`
- Modify: `app/composables/useProjectFormPage.ts` (`yearOptions` computed, notice 배선)
- Modify: `app/features/project/projectFormModel.ts` (주석만: "9월 이상이면 내년")
- Modify: `i18n/messages/project.ts` (ko `project.form.yearNotice`, en 동일 키), `i18n/messages/common.ts`(변경 없음, `common.actions.confirm`·`cancel` 재사용)
- Test: `tests/unit/utils/budgetYear.test.ts`, `tests/unit/features/project/useProjectYearNotice.test.ts`

**Interfaces:**
- Produces:
  - `defaultBudgetYear(now?: Date): number` — 9월부터 내년
  - `budgetYearOptions(now?: Date, currentValue?: number | null): number[]` — `[올해, 내년]`, 현재값이 밖이면 앞에 추가
  - `requiresCurrentYearNotice(selectedYear: number, now?: Date): boolean`
  - `useProjectYearNotice({ form, isEditMode, confirm, t })` — `form.bgYy` 변화를 감시해 팝업
- 주의: `defaultBudgetYear`는 목록·상신·건수 화면도 공유하므로 전체 기본연도 전환이 9월로 옮겨진다(설계 §5.1의 의도적 결정).

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/utils/budgetYear.test.ts` 전체 교체:

```ts
import { describe, expect, it } from 'vitest';
import {
    budgetYearOptions,
    defaultBudgetYear,
    requiresCurrentYearNotice,
} from '~/utils/budgetYear';

describe('defaultBudgetYear', () => {
    it('8월까지는 현재 연도를 반환한다', () => {
        expect(defaultBudgetYear(new Date(2026, 0, 1))).toBe(2026);
        expect(defaultBudgetYear(new Date(2026, 7, 31))).toBe(2026);
    });

    it('9월부터는 다음 연도를 반환한다', () => {
        expect(defaultBudgetYear(new Date(2026, 8, 1))).toBe(2027);
        expect(defaultBudgetYear(new Date(2026, 11, 31))).toBe(2027);
    });
});

describe('budgetYearOptions', () => {
    it('올해와 내년 두 개만 제공한다', () => {
        expect(budgetYearOptions(new Date(2026, 2, 1))).toEqual([2026, 2027]);
        expect(budgetYearOptions(new Date(2026, 10, 1))).toEqual([2026, 2027]);
    });

    it('수정 중인 과거연도 값은 선택지 앞에 보존한다', () => {
        expect(budgetYearOptions(new Date(2026, 2, 1), 2024)).toEqual([2024, 2026, 2027]);
        expect(budgetYearOptions(new Date(2026, 2, 1), 2027)).toEqual([2026, 2027]);
        expect(budgetYearOptions(new Date(2026, 2, 1), null)).toEqual([2026, 2027]);
    });
});

describe('requiresCurrentYearNotice', () => {
    it('9월 이후 올해를 고르면 유의사항이 필요하다', () => {
        expect(requiresCurrentYearNotice(2026, new Date(2026, 8, 1))).toBe(true);
        expect(requiresCurrentYearNotice(2027, new Date(2026, 8, 1))).toBe(false);
        expect(requiresCurrentYearNotice(2026, new Date(2026, 7, 31))).toBe(false);
    });
});
```

`tests/unit/features/project/useProjectYearNotice.test.ts`:

```ts
/**
 * 9월 이후 당해연도 선택 시 유의사항 팝업 배선을 검증합니다.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { effectScope, nextTick, ref } from 'vue';
import type { EffectScope } from 'vue';
import { useProjectYearNotice } from '~/features/project/useProjectYearNotice';

describe('useProjectYearNotice', () => {
    let scope: EffectScope;
    const confirmRequire = vi.fn();
    const t = (key: string) => key;

    beforeEach(() => {
        vi.useFakeTimers();
        vi.setSystemTime(new Date(2026, 9, 15)); // 10월
        confirmRequire.mockReset();
    });

    afterEach(() => {
        scope?.stop();
        vi.useRealTimers();
    });

    const setup = (bgYy: number, editMode = false) => {
        const form = ref({ bgYy });
        const isEditMode = ref(editMode);
        scope = effectScope();
        scope.run(() =>
            useProjectYearNotice({
                form,
                isEditMode,
                confirm: { require: confirmRequire },
                t,
            }),
        );
        return form;
    };

    it('신규 작성에서 9월 이후 올해를 고르면 유의사항 팝업을 띄운다', async () => {
        const form = setup(2027);
        form.value.bgYy = 2026;
        await nextTick();

        expect(confirmRequire).toHaveBeenCalledTimes(1);
        expect(confirmRequire.mock.calls[0][0]).toMatchObject({
            header: 'project.form.yearNotice.title',
            message: 'project.form.yearNotice.body',
        });
    });

    it('취소하면 내년으로 되돌린다', async () => {
        const form = setup(2027);
        form.value.bgYy = 2026;
        await nextTick();

        confirmRequire.mock.calls[0][0].reject();
        expect(form.value.bgYy).toBe(2027);
    });

    it('내년을 고르거나 수정 모드면 팝업을 띄우지 않는다', async () => {
        const form = setup(2026);
        form.value.bgYy = 2027;
        await nextTick();
        expect(confirmRequire).not.toHaveBeenCalled();

        const editForm = setup(2027, true);
        editForm.value.bgYy = 2026;
        await nextTick();
        expect(confirmRequire).not.toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: 실패 확인**

```powershell
cd C:\it\it_frontend
npx vitest run tests/unit/utils/budgetYear.test.ts tests/unit/features/project/useProjectYearNotice.test.ts
```
Expected: `budgetYearOptions` export 없음 등으로 FAIL.

- [ ] **Step 3: 구현**

`app/utils/budgetYear.ts` 전체:

```ts
/** 회계연도 전환 월(0 기준). 8 = 9월. 1~8월은 올해, 9~12월은 내년이 기본 예산연도다. */
export const BUDGET_YEAR_SWITCH_MONTH_INDEX = 8;

/** 9월부터 다음 회계연도를 기본 예산연도로 사용합니다. */
export function defaultBudgetYear(now: Date = new Date()): number {
    return now.getMonth() < BUDGET_YEAR_SWITCH_MONTH_INDEX
        ? now.getFullYear()
        : now.getFullYear() + 1;
}

/**
 * 작성 화면의 사업연도 선택지를 만듭니다. 과거연도는 노출하지 않습니다.
 *
 * @param now 기준 시각
 * @param currentValue 수정 중인 사업의 연도. 선택지 밖이면 빈 값으로 보이지 않도록 앞에 보존한다
 * @returns `[올해, 내년]` 또는 `[현재값, 올해, 내년]`
 */
export function budgetYearOptions(
    now: Date = new Date(),
    currentValue?: number | null,
): number[] {
    const year = now.getFullYear();
    const options = [year, year + 1];
    if (
        currentValue != null &&
        Number.isInteger(currentValue) &&
        !options.includes(currentValue)
    ) {
        options.unshift(currentValue);
    }
    return options;
}

/**
 * 9월 이후 당해연도를 선택했는지 판정합니다. 이 경우 IT기획팀 사전협의 유의사항을 안내해야 합니다.
 */
export function requiresCurrentYearNotice(selectedYear: number, now: Date = new Date()): boolean {
    return now.getMonth() >= BUDGET_YEAR_SWITCH_MONTH_INDEX && selectedYear === now.getFullYear();
}
```

`app/features/project/useProjectYearNotice.ts`:

```ts
/**
 * [features/project/useProjectYearNotice.ts] 사업연도 유의사항 팝업
 *
 * 신규 작성에서 9월 이후 당해연도를 고르면 IT기획팀 사전협의 안내를 띄우고, 취소하면 직전 값으로 되돌립니다.
 * 수정 모드는 Select가 비활성이라 대상이 아닙니다.
 */
import { watch } from 'vue';
import type { Ref } from 'vue';
import { requiresCurrentYearNotice } from '~/utils/budgetYear';

export const useProjectYearNotice = (ctx: {
    form: Ref<{ bgYy: number }>;
    isEditMode: Ref<boolean>;
    confirm: { require: (options: Record<string, unknown>) => void };
    t: (key: string) => string;
}) => {
    const { form, isEditMode, confirm, t } = ctx;
    watch(
        () => form.value.bgYy,
        (year, previous) => {
            if (isEditMode.value || previous === undefined || year === previous) return;
            if (!requiresCurrentYearNotice(year)) return;
            confirm.require({
                header: t('project.form.yearNotice.title'),
                message: t('project.form.yearNotice.body'),
                icon: 'pi pi-exclamation-triangle',
                acceptLabel: t('common.actions.confirm'),
                rejectLabel: t('common.actions.cancel'),
                reject: () => {
                    form.value.bgYy = previous;
                },
            });
        },
    );
};
```

`app/composables/useProjectFormPage.ts`:
- import에 `import { budgetYearOptions } from '~/utils/budgetYear';`와 `import { useProjectYearNotice } from '~/features/project/useProjectYearNotice';`를 추가한다.
- `yearOptions` 정의(268~270행)를 다음으로 바꾼다.

```ts
    /** 사업연도(bgYy) 선택지: 올해·내년. 수정 중인 과거연도는 보존한다 */
    const yearOptions = computed(() => budgetYearOptions(new Date(), form.value.bgYy));
```
- `useProjectFormSave(...)` 호출 뒤에 `useProjectYearNotice({ form, isEditMode, confirm, t });`를 추가한다.
- `projectFormModel.ts`의 `bgYy` 주석을 `// 사업연도 (9월 이상이면 내년, 아니면 올해)`로 고친다.

`i18n/messages/project.ts`: ko `project.form`에 (`placeholders` 형제로) 추가:

```ts
                yearNotice: {
                    title: '유의사항 안내',
                    body: '매년 9월 이후 당해년도 예산 신청은 IT기획팀 전산예산 담당자와 사전협의 후 진행하셔야 하며, 협의되지 않은 예산은 반려될 수 있습니다.',
                },
```
en:

```ts
                yearNotice: {
                    title: 'Notice',
                    body: 'From September onward, current-year budget requests require prior consultation with the IT Planning Team budget officer. Requests without consultation may be rejected.',
                },
```

`tests/unit/composables/useProjectFormPage.test.ts`에서 `yearOptions`를 배열로 단정하는 부분이 있으면 `.value`로 접근하도록 고친다.

- [ ] **Step 4: 통과 확인**

```powershell
npx vitest run tests/unit/utils/budgetYear.test.ts tests/unit/features/project/useProjectYearNotice.test.ts tests/unit/composables/useProjectFormPage.test.ts tests/unit/composables/useBudgetApprovalPage.test.ts tests/unit/composables/useCostListPage.test.ts
```
Expected: PASS. (`useBudgetApprovalPage.test.ts`·`useCostListPage.test.ts`가 8월 기준 기본연도를 단정하면 9월 기준으로 고친다.)

- [ ] **Step 5: Commit**

```powershell
git add app/utils/budgetYear.ts app/features/project/useProjectYearNotice.ts app/composables/useProjectFormPage.ts app/features/project/projectFormModel.ts i18n/messages/project.ts tests/unit/utils/budgetYear.test.ts tests/unit/features/project/useProjectYearNotice.test.ts tests/unit/composables/useProjectFormPage.test.ts
git commit -m "feat: 사업연도 선택지 올해·내년, 9월 기준 기본값과 당해연도 유의사항 팝업"
```

---

### Task 12: 기 지급금액 라벨 (변경1)

**Files:**
- Create: `app/components/projects/ProjectPaidAmountField.vue`, `app/components/projects/ProjectPaidAmountSummary.vue`
- Modify: `app/pages/info/projects/form.vue` (636~649행 블록을 컴포넌트로 교체 — 줄 수 감소)
- Modify: `app/pages/info/projects/[id].vue` (736~745행 블록을 컴포넌트로 교체 — 줄 수 감소)
- Modify: `i18n/messages/project.ts`
- Test: `tests/unit/components/projects/ProjectPaidAmountField.test.ts`

**Interfaces:**
- Produces: `<ProjectPaidAmountField v-model="number" :year="number" :locale-tag="string" :guide-id="string | undefined" />`, `<ProjectPaidAmountSummary :year="number" :amount="number" />`
- i18n: `project.form.fields.paidBudget = '{year} 이전 지급금액 (원)'`, `project.form.fields.paidBudgetNote = '* 당해 지급예정액 포함'`, `project.detail.fields.paidBudget = '{year} 이전 지급금액'`, `project.detail.fields.paidBudgetNote = '* 당해 지급예정액 포함'`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/components/projects/ProjectPaidAmountField.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { defineComponent, h } from 'vue';
import { koTestTranslator } from '../../../helpers/i18n';
import ProjectPaidAmountField from '~/components/projects/ProjectPaidAmountField.vue';

vi.stubGlobal('useI18n', () => ({ t: koTestTranslator }));

const InputNumberStub = defineComponent({
    props: { modelValue: { type: Number, default: 0 } },
    setup: (props) => () => h('input', { value: props.modelValue }),
});

describe('ProjectPaidAmountField', () => {
    it('사업연도를 라벨에 넣고 당해 지급예정액 포함 안내를 보인다', () => {
        const wrapper = mount(ProjectPaidAmountField, {
            props: { modelValue: 0, year: 2027, localeTag: 'ko-KR' },
            global: {
                stubs: { InputNumber: InputNumberStub, FormFieldLabel: { template: '<label>{{ label }}</label>', props: ['label'] } },
            },
        });

        expect(wrapper.text()).toContain('2027 이전 지급금액 (원)');
        expect(wrapper.text()).toContain('* 당해 지급예정액 포함');
    });
});
```

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/components/projects/ProjectPaidAmountField.test.ts
```

- [ ] **Step 3: 구현**

i18n ko (`project.detail.fields`, `project.form.fields`):

```ts
                    paidBudget: '{year} 이전 지급금액',
                    paidBudgetNote: '* 당해 지급예정액 포함',
```
```ts
                    paidBudget: '{year} 이전 지급금액 (원)',
                    paidBudgetNote: '* 당해 지급예정액 포함',
```
en:

```ts
                    paidBudget: 'Payments before {year}',
                    paidBudgetNote: '* Includes the amount scheduled for the current year',
```
```ts
                    paidBudget: 'Payments before {year} (KRW)',
                    paidBudgetNote: '* Includes the amount scheduled for the current year',
```

`app/components/projects/ProjectPaidAmountField.vue`:

```vue
<!--
[components/projects/ProjectPaidAmountField.vue] 기 지급금액 입력 필드
정보화사업 폼의 "{사업연도} 이전 지급금액 (원)" 입력과 당해 지급예정액 포함 안내를 담는다.
-->
<script setup lang="ts">
import FormFieldLabel from '~/components/common/FormFieldLabel.vue';

defineProps<{
    /** 사업연도 — 라벨의 기준연도 */
    year: number;
    /** InputNumber 로케일 태그 */
    localeTag: string;
    /** 길라잡이 식별자 */
    guideId?: string;
}>();
const amount = defineModel<number>({ required: true });
const { t } = useI18n({ useScope: 'global' });
</script>

<template>
    <div class="flex flex-col gap-2 flex-1">
        <FormFieldLabel :label="t('project.form.fields.paidBudget', { year })" />
        <InputNumber
            v-model="amount"
            :data-guide-id="guideId"
            mode="currency"
            currency="KRW"
            :locale="localeTag"
            :min="0"
            placeholder="0"
            fluid
            input-class="text-right"
        />
        <p class="text-xs text-zinc-500 dark:text-zinc-400">
            {{ t('project.form.fields.paidBudgetNote') }}
        </p>
    </div>
</template>
```

`app/components/projects/ProjectPaidAmountSummary.vue`:

```vue
<!--
[components/projects/ProjectPaidAmountSummary.vue] 상세 화면의 기 지급금액 표시
-->
<script setup lang="ts">
import { formatScreenCurrency } from '~/utils/common';

defineProps<{
    /** 사업연도 */
    year: number;
    /** 기 지급금액 (원) */
    amount: number;
}>();
const { t } = useI18n({ useScope: 'global' });
</script>

<template>
    <div class="leading-tight">
        <div class="text-xs text-zinc-500">
            {{ t('project.detail.fields.paidBudget', { year }) }}
        </div>
        <div class="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            {{ formatScreenCurrency(amount) }}
        </div>
        <div class="text-[11px] text-zinc-400">
            {{ t('project.detail.fields.paidBudgetNote') }}
        </div>
    </div>
</template>
```
(`formatScreenCurrency`가 `~/utils/common`에 export돼 있지 않으면 `[id].vue`가 쓰는 동일 import 경로로 맞춘다.)

`form.vue`: `import ProjectPaidAmountField from '~/components/projects/ProjectPaidAmountField.vue';`를 추가하고 636~649행의 `<div v-if="!isOrdinary" class="flex flex-col gap-2 flex-1"> … </div>` 블록 전체를 다음으로 교체한다.

```vue
                    <ProjectPaidAmountField
                        v-if="!isOrdinary"
                        v-model="form.dfrAmt"
                        :year="form.bgYy"
                        :locale-tag="localeTag"
                        :guide-id="guide.infoGuideId('schedule.dfrAmt')"
                    />
```

`[id].vue`: `import ProjectPaidAmountSummary from '~/components/projects/ProjectPaidAmountSummary.vue';`를 추가하고 736~745행의 `<div v-if="!isOrdinary" class="leading-tight"> … </div>` 블록을 교체한다.

```vue
                                        <ProjectPaidAmountSummary
                                            v-if="!isOrdinary"
                                            :year="Number(project.bseYy)"
                                            :amount="project.dfrAmt ?? 0"
                                        />
```

- [ ] **Step 4: 통과와 줄 수 확인**

```powershell
npx vitest run tests/unit/components/projects/ProjectPaidAmountField.test.ts tests/unit/architecture/max-lines-ratchet.test.ts
(Get-Content app/pages/info/projects/form.vue).Count; (Get-Content "app/pages/info/projects/[id].vue").Count
```
Expected: PASS. form.vue ≤ 803, [id].vue ≤ 902 (각각 기준선보다 줄어야 한다).

- [ ] **Step 5: Commit**

```powershell
git add app/components/projects/ProjectPaidAmountField.vue app/components/projects/ProjectPaidAmountSummary.vue app/pages/info/projects/form.vue "app/pages/info/projects/[id].vue" i18n/messages/project.ts tests/unit/components/projects/ProjectPaidAmountField.test.ts
git commit -m "feat: 기 지급금액 라벨을 사업연도 이전 지급금액으로 변경"
```

---

### Task 13: 소요자원 상세내용 (변경3)

**Files:**
- Modify: `i18n/messages/project.ts` (`resource.columns.item`, 검증 문구)
- Create: `app/composables/project/useResourceAmountFocus.ts`
- Create: `app/features/project/resourceBasis.ts`
- Create: `app/components/projects/ResourceBasisCell.vue`
- Modify: `app/types/resource.ts` (`basisCode?: string | null`)
- Modify: `app/components/projects/ResourceTableSection.vue` (금액 포커스 핸들러, 산정근거 컬럼 교체, `addRow` 초기값)
- Modify: `app/features/project/useProjectFormSave.ts` (기타 텍스트 검증)
- Test: `tests/unit/composables/project/useResourceAmountFocus.test.ts`, `tests/unit/features/project/resourceBasis.test.ts`, `tests/unit/components/projects/ResourceBasisCell.test.ts`

**Interfaces:**
- Consumes: 그룹 `IT_PTL_CNCD_FDTN_TC`(Task 3) via `useCodeOptions('IT_PTL_CNCD_FDTN_TC')` → `options.value: CodeOption[]` (`cdId`=코드, `cdNm`=코드명)
- Produces:
  - `clearZeroAmount(row, field)`, `restoreZeroAmount(row, field)` (field: `'gclAmt' | 'laterAmt'`)
  - `BASIS_OTHER_CODE = '99'`, `BasisOption {code,label}`, `resolveBasisSelection(basis, options)`, `toBasisValue(code, otherText, options)`, `findRowsMissingOtherBasis(items)`
  - `ResourceItem.basisCode?: string | null` (UI 전용, 페이로드에 보내지 않음)
  - `<ResourceBasisCell :row="ResourceItem" :options="BasisOption[]" :guide-id="string | undefined" />`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/composables/project/useResourceAmountFocus.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
import { clearZeroAmount, restoreZeroAmount } from '~/composables/project/useResourceAmountFocus';
import type { ResourceItem } from '~/types/resource';

const row = (gclAmt: number, laterAmt: number): ResourceItem => ({
    category: '', subCategory: '', item: '', quantity: 0, currency: 'KRW', basis: '',
    introDate: null, paymentCycle: '', infoProtection: 'N', integratedInfra: 'N', gclAmt, laterAmt,
});

describe('useResourceAmountFocus', () => {
    it('포커스 시 0이면 빈칸(null)으로 만들고 0보다 크면 유지한다', () => {
        const zero = row(0, 0);
        clearZeroAmount(zero, 'gclAmt');
        expect(zero.gclAmt).toBeNull();

        const positive = row(1000, 0);
        clearZeroAmount(positive, 'gclAmt');
        expect(positive.gclAmt).toBe(1000);
    });

    it('블러 시 비어 있으면 0으로 되돌리고 값이 있으면 유지한다', async () => {
        const empty = row(0, 0);
        clearZeroAmount(empty, 'laterAmt');
        restoreZeroAmount(empty, 'laterAmt');
        await nextTick();
        expect(empty.laterAmt).toBe(0);

        const typed = row(0, 500);
        restoreZeroAmount(typed, 'laterAmt');
        await nextTick();
        expect(typed.laterAmt).toBe(500);
    });
});
```

`tests/unit/features/project/resourceBasis.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
    BASIS_OTHER_CODE,
    findRowsMissingOtherBasis,
    resolveBasisSelection,
    toBasisValue,
} from '~/features/project/resourceBasis';
import type { ResourceItem } from '~/types/resource';

const options = [
    { code: '01', label: '견적서' },
    { code: '02', label: '내부산출' },
    { code: '03', label: '타행사례' },
    { code: '99', label: '기타(직접입력)' },
];

const item = (basis: string, basisCode?: string | null): ResourceItem => ({
    category: '', subCategory: '', item: '', quantity: 0, currency: 'KRW', basis, basisCode,
    introDate: null, paymentCycle: '', infoProtection: 'N', integratedInfra: 'N', gclAmt: 0, laterAmt: 0,
});

describe('resolveBasisSelection', () => {
    it('코드명과 정확히 일치하면 그 코드로 복원한다', () => {
        expect(resolveBasisSelection('견적서', options)).toEqual({ code: '01', otherText: '' });
    });

    it('일치하지 않는 텍스트는 기타와 직접입력 텍스트로 복원한다', () => {
        expect(resolveBasisSelection('단가 x 수량', options)).toEqual({
            code: BASIS_OTHER_CODE,
            otherText: '단가 x 수량',
        });
    });

    it('빈 값은 미선택이다', () => {
        expect(resolveBasisSelection('', options)).toEqual({ code: null, otherText: '' });
        expect(resolveBasisSelection('   ', options)).toEqual({ code: null, otherText: '' });
    });
});

describe('toBasisValue', () => {
    it('일반 코드는 코드명을, 기타는 텍스트를, 미선택은 빈 문자열을 저장값으로 만든다', () => {
        expect(toBasisValue('02', '', options)).toBe('내부산출');
        expect(toBasisValue(BASIS_OTHER_CODE, '직접 근거', options)).toBe('직접 근거');
        expect(toBasisValue(null, '무시', options)).toBe('');
    });
});

describe('findRowsMissingOtherBasis', () => {
    it('기타를 골랐는데 텍스트가 없는 행 번호(1부터)를 돌려준다', () => {
        const rows = [item('견적서', '01'), item('', BASIS_OTHER_CODE), item('내용', BASIS_OTHER_CODE), item('', null)];
        expect(findRowsMissingOtherBasis(rows)).toEqual([2]);
    });
});
```

`tests/unit/components/projects/ResourceBasisCell.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick, reactive } from 'vue';
import { koTestTranslator } from '../../../helpers/i18n';
import ResourceBasisCell from '~/components/projects/ResourceBasisCell.vue';
import { BASIS_OTHER_CODE } from '~/features/project/resourceBasis';
import type { ResourceItem } from '~/types/resource';

vi.stubGlobal('useI18n', () => ({ t: koTestTranslator }));
vi.mock('~/composables/useDatabaseByteLimit', () => ({
    useDatabaseByteLimit: () => ({ acceptText: () => true, restoreRejectedInput: () => undefined }),
}));

const options = [
    { code: '01', label: '견적서' },
    { code: '99', label: '기타(직접입력)' },
];

const mountCell = (row: ResourceItem) =>
    mount(ResourceBasisCell, {
        props: { row, options },
        global: {
            stubs: {
                Select: {
                    props: ['modelValue', 'options'],
                    emits: ['update:modelValue'],
                    template: '<select data-testid="basis-select" :value="modelValue" @change="$emit(\'update:modelValue\', $event.target.value || null)"><option value=""></option><option v-for="o in options" :key="o.value" :value="o.value">{{ o.label }}</option></select>',
                },
                Textarea: { props: ['modelValue'], template: '<textarea data-testid="basis-text" :value="modelValue" />' },
                TextLengthIndicator: true,
            },
        },
    });

describe('ResourceBasisCell', () => {
    it('저장된 텍스트가 코드명과 다르면 기타로 복원하고 텍스트 입력을 보인다', async () => {
        const row = reactive<ResourceItem>({
            category: '', subCategory: '', item: '', quantity: 0, currency: 'KRW', basis: '단가 x 수량',
            introDate: null, paymentCycle: '', infoProtection: 'N', integratedInfra: 'N', gclAmt: 0, laterAmt: 0,
        });
        const wrapper = mountCell(row);
        await nextTick();

        expect(row.basisCode).toBe(BASIS_OTHER_CODE);
        expect(wrapper.find('[data-testid="basis-text"]').exists()).toBe(true);
    });

    it('견적서를 고르면 저장값이 코드명이 되고 텍스트 입력은 사라진다', async () => {
        const row = reactive<ResourceItem>({
            category: '', subCategory: '', item: '', quantity: 0, currency: 'KRW', basis: '',
            introDate: null, paymentCycle: '', infoProtection: 'N', integratedInfra: 'N', gclAmt: 0, laterAmt: 0,
        });
        const wrapper = mountCell(row);
        await nextTick();

        await wrapper.find('[data-testid="basis-select"]').setValue('01');
        expect(row.basisCode).toBe('01');
        expect(row.basis).toBe('견적서');
        expect(wrapper.find('[data-testid="basis-text"]').exists()).toBe(false);
    });
});
```

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/composables/project/useResourceAmountFocus.test.ts tests/unit/features/project/resourceBasis.test.ts tests/unit/components/projects/ResourceBasisCell.test.ts
```

- [ ] **Step 3: 순수 모듈 구현**

`app/types/resource.ts`의 `ResourceItem`에 추가:

```ts
    /** 산정근거 선택 코드 (UI 전용, 저장값은 basis). 미결정이면 undefined, 미선택이면 null */
    basisCode?: string | null;
```

`app/composables/project/useResourceAmountFocus.ts`:

```ts
/**
 * [composables/project/useResourceAmountFocus.ts] 소요자원 금액 입력의 0 처리
 *
 * 포커스 시 값이 0이면 빈칸으로 보이도록 모델을 비우고, 블러 시 비어 있으면 0으로 되돌립니다.
 * PrimeVue InputNumber는 blur 이벤트 뒤에 내부 모델을 갱신하므로 복원은 nextTick 이후에 수행합니다.
 */
import { nextTick } from 'vue';
import type { ResourceItem } from '~/types/resource';

export type ResourceAmountField = 'gclAmt' | 'laterAmt';

type NullableAmounts = Record<ResourceAmountField, number | null>;

/** 포커스: 0이면 빈칸(null) */
export const clearZeroAmount = (row: ResourceItem, field: ResourceAmountField): void => {
    if (row[field] === 0) (row as unknown as NullableAmounts)[field] = null;
};

/** 블러: 비어 있으면 0으로 복원 */
export const restoreZeroAmount = (row: ResourceItem, field: ResourceAmountField): void => {
    void nextTick(() => {
        if ((row as unknown as NullableAmounts)[field] == null) row[field] = 0;
    });
};
```

`app/features/project/resourceBasis.ts`:

```ts
/**
 * [features/project/resourceBasis.ts] 소요자원 산정근거 선택 규칙
 *
 * 저장 컬럼(BITEMM.CNCD_FDTN_CONE)은 그대로 두고, 견적서·내부산출·타행사례는 코드명 문자열을,
 * 기타(99)는 직접입력 텍스트를 저장합니다. 복원은 저장 문자열이 코드명과 정확히 일치하는지로 판정합니다.
 */
import type { ResourceItem } from '~/types/resource';

/** 기타(직접입력) 코드 */
export const BASIS_OTHER_CODE = '99';

export interface BasisOption {
    code: string;
    label: string;
}

export interface BasisSelection {
    code: string | null;
    otherText: string;
}

/** 저장 문자열 → 선택 상태 */
export const resolveBasisSelection = (basis: string, options: BasisOption[]): BasisSelection => {
    const text = (basis ?? '').trim();
    if (!text) return { code: null, otherText: '' };
    const match = options.find((o) => o.code !== BASIS_OTHER_CODE && o.label === text);
    return match ? { code: match.code, otherText: '' } : { code: BASIS_OTHER_CODE, otherText: basis };
};

/** 선택 상태 → 저장 문자열 */
export const toBasisValue = (
    code: string | null,
    otherText: string,
    options: BasisOption[],
): string => {
    if (code === null) return '';
    if (code === BASIS_OTHER_CODE) return otherText;
    return options.find((o) => o.code === code)?.label ?? '';
};

/** 기타를 골랐는데 텍스트가 없는 행 번호(1부터) */
export const findRowsMissingOtherBasis = (items: ResourceItem[]): number[] =>
    items.flatMap((item, index) =>
        item.basisCode === BASIS_OTHER_CODE && !item.basis.trim() ? [index + 1] : [],
    );
```

- [ ] **Step 4: 셀 컴포넌트 구현**

`app/components/projects/ResourceBasisCell.vue`:

```vue
<!--
[components/projects/ResourceBasisCell.vue] 산정근거 셀
Select(견적서·내부산출·타행사례·기타) 하나와, 기타일 때만 보이는 직접입력 Textarea로 구성한다.
저장값은 row.basis(문자열), 선택 코드는 row.basisCode(UI 전용)에 둔다.
-->
<script setup lang="ts">
import { computed, watch } from 'vue';
import TextLengthIndicator from '~/components/common/TextLengthIndicator.vue';
import { useDatabaseByteLimit } from '~/composables/useDatabaseByteLimit';
import { projectFormLimits } from '~/utils/projectFormLimits';
import {
    BASIS_OTHER_CODE,
    resolveBasisSelection,
    toBasisValue,
    type BasisOption,
} from '~/features/project/resourceBasis';
import type { ResourceItem } from '~/types/resource';

const props = defineProps<{
    /** 소요자원 행 (basis·basisCode를 직접 갱신한다) */
    row: ResourceItem;
    /** 산정근거 선택지 (부모가 공통코드로 한 번 조회) */
    options: BasisOption[];
    /** 길라잡이 식별자 */
    guideId?: string;
}>();

const { t } = useI18n({ useScope: 'global' });
const { acceptText, restoreRejectedInput } = useDatabaseByteLimit();

const selectOptions = computed(() => props.options.map((o) => ({ label: o.label, value: o.code })));
const isOther = computed(() => props.row.basisCode === BASIS_OTHER_CODE);
const missingOther = computed(() => isOther.value && !props.row.basis.trim());

/* 저장 문자열에서 선택 코드를 한 번 복원한다 (선택지가 로드된 뒤, 아직 미결정인 행만) */
watch(
    () => props.options,
    (options) => {
        if (options.length > 0 && props.row.basisCode === undefined) {
            props.row.basisCode = resolveBasisSelection(props.row.basis, options).code;
        }
    },
    { immediate: true },
);

const onCodeChange = (code: string | null) => {
    props.row.basisCode = code;
    props.row.basis = toBasisValue(code, '', props.options);
};

const onOtherTextChange = (value: string) => {
    if (acceptText(value, projectFormLimits.resourceBasis)) props.row.basis = value;
};
</script>

<template>
    <div class="flex flex-col gap-1">
        <Select
            :model-value="row.basisCode ?? null"
            :data-guide-id="guideId"
            :options="selectOptions"
            option-label="label"
            option-value="value"
            show-clear
            class="w-full"
            :placeholder="t('project.form.resource.basisPlaceholder')"
            @update:model-value="onCodeChange"
        />
        <div v-if="isOther" class="relative">
            <Textarea
                :model-value="row.basis"
                rows="1"
                auto-resize
                class="w-full pt-5"
                :invalid="missingOther"
                :placeholder="t('project.form.resource.basisOtherPlaceholder')"
                @update:model-value="onOtherTextChange"
                @input="restoreRejectedInput($event, row.basis, projectFormLimits.resourceBasis)"
            />
            <TextLengthIndicator
                v-bind="projectFormLimits.resourceBasis"
                :value="row.basis"
                :hide-below-width="150"
            />
        </div>
    </div>
</template>
```

- [ ] **Step 5: 테이블·저장 배선**

`ResourceTableSection.vue`:
- import 추가: `ResourceBasisCell`, `clearZeroAmount`·`restoreZeroAmount`(`~/composables/project/useResourceAmountFocus`), `type BasisOption`(`~/features/project/resourceBasis`).
- `paymentCycleOptions` 아래에 추가:

```ts
/* 산정근거(IT_PTL_CNCD_FDTN_TC) 공통코드 — 저장값은 코드명 문자열, 기타(99)는 직접입력 */
const { options: basisCodeOptions } = useCodeOptions('IT_PTL_CNCD_FDTN_TC');
const basisOptions = computed<BasisOption[]>(() =>
    basisCodeOptions.value.map((o) => ({ code: o.cdId, label: o.cdNm })),
);
```
- `addRow()`의 객체에 `basisCode: null,`을 추가한다.
- `updateLimitedText`의 `field` 타입을 `'item'`만 남긴다(산정근거는 셀이 처리).
- 당해 요청금액 `InputNumber`에 `@focus="clearZeroAmount(data, 'gclAmt')" @blur="restoreZeroAmount(data, 'gclAmt')"`, 익년 이후 금액에 `'laterAmt'`로 같은 두 속성을 추가한다.
- 산정근거 `<Column>`의 `#body` 내용(`<div class="relative"> … </div>`)을 다음으로 교체한다.

```vue
                    <template #body="{ data }">
                        <ResourceBasisCell
                            :row="data"
                            :options="basisOptions"
                            :guide-id="scopedGuideId('resource.basis')"
                        />
                    </template>
```

`useProjectFormSave.ts`: import `findRowsMissingOtherBasis`를 추가하고 `saveProject`에서 `if (!datesOk) return;` 앞에 넣는다.

```ts
        const missingBasisRows = findRowsMissingOtherBasis(form.value.resourceItems);
        if (missingBasisRows.length > 0) {
            confirm.require({
                message: t('project.validation.missingOtherBasis', {
                    rows: missingBasisRows.join(', '),
                }),
                header: t('project.validation.requiredHeader'),
                icon: 'pi pi-exclamation-triangle',
                rejectProps: { class: 'hidden' },
                acceptLabel: t('common.actions.confirm'),
            });
            return;
        }
```

i18n ko:
- `project.form.resource.columns.item: '항목(품목 등)'`
- `project.form.resource` 하위에 `basisPlaceholder: '산정근거 선택'`, `basisOtherPlaceholder: '산정근거를 직접 입력하세요'`
- `project.validation` 하위에 `missingOtherBasis: '산정근거를 기타로 선택한 행에 내용이 없습니다: {rows}행'`

en: `item: 'Item (goods, etc.)'`, `basisPlaceholder: 'Select basis'`, `basisOtherPlaceholder: 'Enter the basis'`, `missingOtherBasis: 'Rows with "Other" basis need text: row {rows}'`.

- [ ] **Step 6: 통과 확인**

```powershell
npx vitest run tests/unit/composables/project/useResourceAmountFocus.test.ts tests/unit/features/project/resourceBasis.test.ts tests/unit/components/projects/ResourceBasisCell.test.ts tests/unit/features/project tests/unit/composables/useProjectFormPage.test.ts
npm run typecheck
```
Expected: PASS, typecheck 0 errors (CQ-44의 기존 2건은 별도 과제이므로 새 오류가 없는지만 본다).

- [ ] **Step 7: Commit**

```powershell
git add app/types/resource.ts app/composables/project/useResourceAmountFocus.ts app/features/project/resourceBasis.ts app/components/projects/ResourceBasisCell.vue app/components/projects/ResourceTableSection.vue app/features/project/useProjectFormSave.ts i18n/messages/project.ts tests/unit/composables/project/useResourceAmountFocus.test.ts tests/unit/features/project/resourceBasis.test.ts tests/unit/components/projects/ResourceBasisCell.test.ts
git commit -m "feat: 소요자원 항목 라벨, 금액 0 포커스 빈칸, 산정근거 Select 전환"
```

---

### Task 14: 상태 라벨·배지·상신 대상 스코프 (변경5 조회 측)

**Files:**
- Modify: `app/composables/useApprovalStatus.ts`
- Modify: `app/utils/common.ts` (`getApprovalTagClass`)
- Modify: `app/composables/useBudgetApprovalPage.ts` (`SCOPE_UNSUBMITTED`)
- Modify: `app/pages/info/projects/index.vue` (결재현황 Tag 기본값), `app/pages/budget/list.vue` (신청서 없음 배지), `app/components/cost/CostListTable.vue`·`app/components/cost/CostFormTableSection.vue`(`'예산 작성'` → `'임시저장'`), `app/composables/cost/useCostFormData.ts`(`apfSts: '예산 작성'` → `'임시저장'`)
- Modify: `i18n/messages/approval.ts`, `i18n/messages/cost.ts`, `i18n/messages/budget.ts`
- Test: `tests/unit/composables/useApprovalStatus.test.ts`, `tests/unit/composables/useBudgetApprovalPage.test.ts`, `tests/unit/pages/budget-approval-i18n.test.ts`

**Interfaces:**
- Produces: `APF_STS_LABEL['0'] = 'approval.status.drafted'`, `['9'] = 'approval.status.manual'`; i18n `approval.status.drafted='작성완료'`, `approval.status.unsaved='임시저장'`, `approval.status.manual='수기등록'`; `getApprovalTagClass('작성완료')='kdb-tag-gray'`; 상신 화면 상신 대상 스코프 `'0'`.

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/composables/useApprovalStatus.test.ts`에 추가:

```ts
    it('작성완료(0)와 수기등록(9) 코드를 표시한다', () => {
        const { labelOf, isInProgress, isTerminated } = useApprovalStatus();

        expect(labelOf('0')).toBe('작성완료');
        expect(labelOf('9')).toBe('수기등록');
        expect(isInProgress('0')).toBe(false);
        expect(isTerminated('0')).toBe(false);
        activeLocale.value = 'en';
        expect(labelOf('0')).toBe('Drafted');
        activeLocale.value = 'ko';
    });
```

`tests/unit/composables/useBudgetApprovalPage.test.ts`에서 상신 대상 조회 조건이 `'none'`임을 단정하는 기대값을 `'0'`으로 바꾼다.

```powershell
Select-String -Path tests/unit/composables/useBudgetApprovalPage.test.ts,tests/unit/pages/budget-approval-i18n.test.ts,tests/unit/pages/budgetApprovalColumns.test.ts -Pattern "'none'|미상신"
```
나온 줄마다 `'none'` → `'0'`, 라벨 `'미상신'` → `'작성완료'`로 고친다.

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/composables/useApprovalStatus.test.ts tests/unit/composables/useBudgetApprovalPage.test.ts tests/unit/pages/budget-approval-i18n.test.ts
```

- [ ] **Step 3: 구현**

`useApprovalStatus.ts`: 파일 상단 코드표 주석을 갱신하고 맵에 추가한다.

```ts
 * 결재 상태 코드표 (IT_PTL_APF_PRG_STS_C):
 *   0  = 작성완료 — [저장]으로 만든 결재선 없는 신청서 (상신 대상). 신청서 없음은 '임시저장'
 *   1  = 결재중   — 결재선에 회람 중이며 아직 최종 완료 전
 *   2  = 결재완료 — 결재선 전원 승인 완료
 *   3  = 반려    — 결재자 중 한 명 이상이 반려 처리
 *   4  = 회수    — 기안자가 결재 상신을 직접 회수
 *   9  = 수기등록 — 편성요청서 반입 표식 (결재선 없음)
```
```ts
export const APF_STS_LABEL: Record<string, string> = {
    '0': 'approval.status.drafted',
    '00': 'approval.status.drafted',
    '1': 'approval.status.inProgress',
    ...
    '9': 'approval.status.manual',
    '09': 'approval.status.manual',
};
```

`i18n/messages/approval.ts` ko `status`에 `drafted: '작성완료'`, `unsaved: '임시저장'`, `manual: '수기등록'`; en에 `drafted: 'Drafted'`, `unsaved: 'Unsaved Draft'`, `manual: 'Manually Registered'`.

`app/utils/common.ts` `getApprovalTagClass`의 `case '임시저장':` 위에 추가:

```ts
        case '작성완료':
            return 'kdb-tag-gray'; // 결재선 없는 저장 상태 (상신 대상)
```

`useBudgetApprovalPage.ts`:

```ts
    /** 상신 대상: 최신 신청서가 작성완료(0)인 항목. 임시저장(신청서 없음)은 상신 대상이 아니다 */
    const SCOPE_UNSUBMITTED = '0';
```
같은 파일의 주석 `apfSts=none: 결재 신청이 없는 항목(미상신)`을 `apfSts=0: 작성완료(상신 대상) 항목`으로 고친다.

`i18n/messages/budget.ts` ko `approval`: `subtitle: '조회된 전체 작성완료 목록이 일괄 상신됩니다.'`, `scopeUnsubmitted: '작성완료'`, `empty: '{year}년도 작성완료(상신 대상) 전산예산 항목이 없습니다.'`, `subtitlePending: '결재가 진행 중인 항목입니다. 상신은 작성완료 조회에서 합니다.'`. en: `'All drafted items in the list are submitted together.'`, `scopeUnsubmitted: 'Drafted'`, `empty: 'No drafted IT budget items for {year}.'`.

`i18n/messages/cost.ts`: `approvalDraft: '임시저장'` / en `'Unsaved Draft'`. `CostListTable.vue`·`CostFormTableSection.vue`의 `getApprovalTagClass(data.apfSts || '예산 작성')`를 `getApprovalTagClass(data.apfSts || '임시저장')`로, `useCostFormData.ts`의 `apfSts: '예산 작성'`을 `apfSts: '임시저장'`으로 바꾼다.

`app/pages/info/projects/index.vue` 결재현황 Tag: `:value="slotProps.data.applicationInfo?.apfSts ?? t('approval.status.unsaved')"`, `:class="getApprovalTagClass(slotProps.data.applicationInfo?.apfSts ?? '임시저장')"`.

`app/pages/budget/list.vue` 결재현황 컬럼의 `<div v-if="slotProps.data.apfSts" …>` 블록 뒤에 형제로 추가한다.

```vue
                            <Tag
                                v-else
                                :value="t('approval.status.unsaved')"
                                class="kdb-tag-gray border-0"
                                rounded
                            />
```

- [ ] **Step 4: 통과 확인**

```powershell
npx vitest run tests/unit/composables/useApprovalStatus.test.ts tests/unit/composables/useBudgetApprovalPage.test.ts tests/unit/pages tests/unit/composables/useCostListPage.test.ts tests/unit/architecture/user-facing-copy-ratchet.test.ts
```
Expected: PASS. (`user-facing-copy-ratchet`이 하드코딩 문구 `'임시저장'` 때문에 실패하면 해당 두 컴포넌트에서 `t('cost.list.approvalDraft')`로 대체한다.)

- [ ] **Step 5: Commit**

```powershell
git add app/composables/useApprovalStatus.ts app/utils/common.ts app/composables/useBudgetApprovalPage.ts app/pages/info/projects/index.vue app/pages/budget/list.vue app/components/cost/CostListTable.vue app/components/cost/CostFormTableSection.vue app/composables/cost/useCostFormData.ts i18n/messages/approval.ts i18n/messages/cost.ts i18n/messages/budget.ts tests/unit/composables/useApprovalStatus.test.ts tests/unit/composables/useBudgetApprovalPage.test.ts tests/unit/pages/budget-approval-i18n.test.ts
git diff --cached --stat
git commit -m "feat: 작성완료·임시저장 배지와 상신 대상 스코프를 작성완료로 전환"
```

---

### Task 15: 임시저장·저장 버튼과 `complete` 전송 (변경5 작성 측)

**Files:**
- Modify: `app/components/projects/ProjectFormHeader.vue` (`draftAllowed` prop, `saveDraft` emit)
- Create: `app/components/cost/CostFormActions.vue`
- Modify: `app/features/project/useProjectFormSave.ts` (`saveProject(complete)`, 페이로드 `complete`)
- Modify: `app/features/project/useProjectFormLoad.ts`, `app/composables/useProjectFormPage.ts` (`isDrafted`)
- Modify: `app/pages/info/projects/form.vue` (헤더 배선 2줄)
- Modify: `app/pages/info/cost/form.vue` (`saveCosts(complete)`, 액션 컴포넌트로 교체 — 줄 수 감소)
- Modify: `i18n/messages/common.ts` (`actions.saveDraft`)
- Test: `tests/unit/components/projects/ProjectFormHeader.test.ts`, `tests/unit/components/cost/CostFormActions.test.ts`, `tests/unit/features/project/useProjectFormSave.test.ts`(존재하면 케이스 추가, 없으면 새로 만든다)

**Interfaces:**
- Consumes: 생성 타입의 `complete: boolean`(Task 10)
- Produces:
  - `ProjectFormHeader` props `{ editMode, ordinary, title, statusName, submitting, draftAllowed }`, emits `cancel | save | saveDraft`
  - `CostFormActions` props `{ showAddRow: boolean; draftAllowed: boolean }`, emits `addRow | cancel | save | saveDraft`
  - `saveProject(complete = true)`; `useProjectFormPage` 반환에 `isDrafted: ComputedRef<boolean>`
  - i18n `common.actions.saveDraft = '임시저장'` / `'Save Draft'`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/components/projects/ProjectFormHeader.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { koTestTranslator } from '../../../helpers/i18n';
import ProjectFormHeader from '~/components/projects/ProjectFormHeader.vue';

vi.stubGlobal('useI18n', () => ({ t: koTestTranslator }));

const ButtonStub = {
    props: ['label', 'disabled'],
    emits: ['click'],
    template: '<button :disabled="disabled" @click="$emit(\'click\')">{{ label }}</button>',
};

const mountHeader = (draftAllowed: boolean) =>
    mount(ProjectFormHeader, {
        props: { editMode: false, ordinary: false, title: '등록', statusName: '-', submitting: false, draftAllowed },
        global: { stubs: { Button: ButtonStub } },
    });

describe('ProjectFormHeader', () => {
    it('임시저장·저장 버튼을 보이고 각각 이벤트를 낸다', async () => {
        const wrapper = mountHeader(true);
        const buttons = wrapper.findAll('button');
        expect(buttons.map((b) => b.text())).toEqual(['취소', '임시저장', '저장']);

        await buttons[1].trigger('click');
        await buttons[2].trigger('click');
        expect(wrapper.emitted('saveDraft')).toHaveLength(1);
        expect(wrapper.emitted('save')).toHaveLength(1);
    });

    it('작성완료된 사업은 임시저장 버튼을 숨긴다', () => {
        const wrapper = mountHeader(false);
        expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['취소', '저장']);
    });
});
```

`tests/unit/components/cost/CostFormActions.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { koTestTranslator } from '../../../helpers/i18n';
import CostFormActions from '~/components/cost/CostFormActions.vue';

vi.stubGlobal('useI18n', () => ({ t: koTestTranslator }));

const ButtonStub = {
    props: ['label'],
    emits: ['click'],
    template: '<button @click="$emit(\'click\')">{{ label }}</button>',
};

describe('CostFormActions', () => {
    it('행 추가·취소·임시저장·저장 버튼을 순서대로 보이고 이벤트를 낸다', async () => {
        const wrapper = mount(CostFormActions, {
            props: { showAddRow: true, draftAllowed: true },
            global: { stubs: { Button: ButtonStub } },
        });
        const buttons = wrapper.findAll('button');
        expect(buttons.map((b) => b.text())).toEqual(['행 추가', '취소', '임시저장', '저장']);
        await buttons[2].trigger('click');
        expect(wrapper.emitted('saveDraft')).toHaveLength(1);
    });

    it('행 추가 숨김·임시저장 불가면 취소·저장만 보인다', () => {
        const wrapper = mount(CostFormActions, {
            props: { showAddRow: false, draftAllowed: false },
            global: { stubs: { Button: ButtonStub } },
        });
        expect(wrapper.findAll('button').map((b) => b.text())).toEqual(['취소', '저장']);
    });
});
```
(`'행 추가'`는 `cost.form.actions.addRow`의 실제 ko 문구로 맞춘다.)

`tests/unit/features/project/useProjectFormSave.test.ts`가 있으면 저장 페이로드 검증 케이스에 다음을 추가하고, 없으면 `projectFormAmounts.test.ts`의 페이로드 캡처 방식으로 새 파일을 만든다.

```ts
    it('saveProject(false)는 complete=false, 기본 호출은 complete=true를 보낸다', async () => {
        const { saveProject } = setup(); // 기존 테스트의 composable 생성 헬퍼
        saveProject(false);
        await flushPromises();
        expect(mocks.createProject.mock.calls[0][0]).toMatchObject({ complete: false });

        saveProject();
        await flushPromises();
        expect(mocks.createProject.mock.calls[1][0]).toMatchObject({ complete: true });
    });
```

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/components/projects/ProjectFormHeader.test.ts tests/unit/components/cost/CostFormActions.test.ts tests/unit/features/project
```

- [ ] **Step 3: 구현**

`i18n/messages/common.ts` `actions`에 `saveDraft: '임시저장'` (en `'Save Draft'`).

`ProjectFormHeader.vue`: props에 `/** 임시저장 허용 여부 — 작성완료된 사업은 [저장]만 보인다 */ draftAllowed: boolean;`, emits에 `saveDraft: [];`를 추가하고 버튼 영역을 교체한다.

```vue
        <div class="flex items-center gap-2">
            <Button
                :label="t('common.actions.cancel')"
                severity="secondary"
                @click="$emit('cancel')"
            />
            <Button
                v-if="draftAllowed"
                :label="t('common.actions.saveDraft')"
                severity="secondary"
                outlined
                :disabled="submitting"
                @click="$emit('saveDraft')"
            />
            <Button
                :label="t('common.actions.save')"
                :disabled="submitting"
                @click="$emit('save')"
            />
        </div>
```

`app/components/cost/CostFormActions.vue`:

```vue
<!--
[components/cost/CostFormActions.vue] 전산업무비 폼 액션 버튼
단건 수정 헤더와 다건 등록 헤더가 같은 버튼 묶음(행 추가·취소·임시저장·저장)을 쓴다.
-->
<script setup lang="ts">
defineProps<{
    /** 행 추가 버튼 노출 (다건 등록 화면) */
    showAddRow: boolean;
    /** 임시저장 허용 여부 — 작성완료된 항목이 하나라도 있으면 [저장]만 보인다 */
    draftAllowed: boolean;
}>();
defineEmits<{ addRow: []; cancel: []; save: []; saveDraft: [] }>();
const { t } = useI18n({ useScope: 'global' });
</script>

<template>
    <div class="flex items-center gap-2">
        <Button v-if="showAddRow" :label="t('cost.form.actions.addRow')" @click="$emit('addRow')" />
        <Button
            :label="t('common.actions.cancel')"
            severity="secondary"
            class="btn-neutral"
            @click="$emit('cancel')"
        />
        <Button
            v-if="draftAllowed"
            :label="t('common.actions.saveDraft')"
            severity="secondary"
            outlined
            @click="$emit('saveDraft')"
        />
        <Button :label="t('common.actions.save')" @click="$emit('save')" />
    </div>
</template>
```

`useProjectFormSave.ts`:
- `executeSave` 시그니처를 `const executeSave = async (complete: boolean) => {`로 바꾸고 페이로드 `items: items,` 뒤에 `complete, // 저장 종류: true=작성완료(신청서 0), false=임시저장`을 추가한다.
- `saveProject`를 `const saveProject = (complete = true) => {`로 바꾸고 마지막 `executeSave();`를 `executeSave(complete);`로 바꾼다. JSDoc에 `@param complete true면 작성완료 저장, false면 임시저장`을 추가한다.

`useProjectFormLoad.ts`: ctx에 `applicationStatusCode: Ref<string | null>;`을 추가하고, 상세 로드 성공 지점(`form.value = { ...form.value, prjNm: ...` 직전)에 `ctx.applicationStatusCode.value = project.applicationInfo?.apfStsC ?? null;`을 넣는다. 신규 모드 초기화(createInitialForm 리셋) 지점에서는 `null`로 되돌린다.

`useProjectFormPage.ts`: `const form = ref(...)` 아래에 추가하고 `useProjectFormLoad({...})`에 `applicationStatusCode`를 넘기며 반환 객체에 `isDrafted`를 추가한다.

```ts
    /** 현재 개정본에 연결된 최신 신청서 상태코드 (없으면 null) */
    const applicationStatusCode = ref<string | null>(null);
    /** 작성완료(0)된 개정본 여부 — 이후에는 [저장]만 노출한다 */
    const isDrafted = computed(() => applicationStatusCode.value === '0');
```

`form.vue`: 구조분해에 `isDrafted`를 추가하고 헤더를 다음으로 바꾼다(속성 2줄 증가, Task 12에서 8줄 줄었으므로 기준선 이내).

```vue
        <ProjectFormHeader
            class="col-span-full min-w-0"
            :edit-mode="isEditMode"
            :ordinary="isOrdinary"
            :title="title"
            :status-name="getStatusName(form.prjSts) || '-'"
            :submitting="isSubmitting"
            :draft-allowed="!isDrafted"
            @cancel="cancel"
            @save="saveProject(true)"
            @save-draft="saveProject(false)"
        />
```

`tests/unit/composables/useProjectFormPage.test.ts`의 `useProjectFormLoad` 대역이 ctx를 검사하면 `applicationStatusCode`를 받도록 시그니처를 넓힌다.

`app/pages/info/cost/form.vue`:
- `import CostFormActions from '~/components/cost/CostFormActions.vue';` 추가.
- `const saveCosts = async () => {`를 `const saveCosts = async (complete = true) => {`로 바꾸고 `const payload = { ...cost };` 다음 줄에 `payload.complete = complete; // 저장 종류: true=작성완료, false=임시저장`를 넣는다.
- `const isDraftAllowed = computed(() => costs.value.every((cost) => cost.apfStsC !== '0'));`를 `costs` 선언 뒤에 추가한다.
- 단건 수정 헤더의 `<div class="flex items-center gap-2"> … </div>`(취소·저장 2버튼)를 다음으로 교체한다.

```vue
            <CostFormActions
                :show-add-row="false"
                :draft-allowed="isDraftAllowed"
                @cancel="cancel"
                @save="saveCosts(true)"
                @save-draft="saveCosts(false)"
            />
```
- `<PageHeader v-else :title="title">`의 `#actions` 슬롯 내용(행 추가·취소·저장 3버튼)을 다음으로 교체한다.

```vue
            <template #actions>
                <CostFormActions
                    :show-add-row="true"
                    :draft-allowed="isDraftAllowed"
                    @add-row="addCostRow"
                    @cancel="cancel"
                    @save="saveCosts(true)"
                    @save-draft="saveCosts(false)"
                />
            </template>
```

- [ ] **Step 4: 통과와 줄 수 확인**

```powershell
npx vitest run tests/unit/components/projects/ProjectFormHeader.test.ts tests/unit/components/cost/CostFormActions.test.ts tests/unit/features/project tests/unit/composables/useProjectFormPage.test.ts tests/unit/architecture/max-lines-ratchet.test.ts
npm run typecheck
(Get-Content app/pages/info/projects/form.vue).Count; (Get-Content app/pages/info/cost/form.vue).Count
```
Expected: PASS. `form.vue` ≤ 809, `cost/form.vue` ≤ 801. 넘으면 이 태스크의 새 마크업을 더 줄이지 말고 Task 12와 같은 방식으로 인접 블록을 자식 컴포넌트로 뺀다.

- [ ] **Step 5: Commit**

```powershell
git add app/components/projects/ProjectFormHeader.vue app/components/cost/CostFormActions.vue app/features/project/useProjectFormSave.ts app/features/project/useProjectFormLoad.ts app/composables/useProjectFormPage.ts app/pages/info/projects/form.vue app/pages/info/cost/form.vue i18n/messages/common.ts tests/unit/components/projects/ProjectFormHeader.test.ts tests/unit/components/cost/CostFormActions.test.ts tests/unit/features/project tests/unit/composables/useProjectFormPage.test.ts
git diff --cached --stat
git commit -m "feat: 작성 화면 임시저장·저장 버튼과 complete 전송"
```

---

### Task 16: 결재라인 자동지정 (변경4 프론트)

**Files:**
- Modify: `app/composables/useApprovals.ts` (`fetchApprovalLineSuggestion`, 타입 export)
- Create: `app/features/approval/useApprovalLineSuggestion.ts`
- Modify: `app/pages/budget/report.vue` (진입 시 제안 적용, 경고 배너)
- Modify: `i18n/messages/budget.ts` (`budget.report.suggestion.*`)
- Test: `tests/unit/features/approval/useApprovalLineSuggestion.test.ts`

**Interfaces:**
- Consumes: `GET /api/applications/approval-line/suggestion`(Task 8), 생성 타입 `ApplicationApprovalLineSuggestion`(Task 10)
- Produces:
  - `useApprovals().fetchApprovalLineSuggestion(): Promise<ApprovalLineSuggestion>`
  - `useApprovalLineSuggestion({ approvalLine, fetchSuggestion, t })` → `{ notices: Ref<string[]>, applySuggestion(): Promise<boolean> }` (채운 차수가 하나라도 있으면 true)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/unit/features/approval/useApprovalLineSuggestion.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';
import { useApprovalLineSuggestion } from '~/features/approval/useApprovalLineSuggestion';
import type { ApprovalLine } from '~/types/approvalForm';

const emptyPerson = () => ({ id: '', name: '', rank: '', date: '' });
const line = (): ApprovalLine => ({
    drafter: { id: 'K10001', name: '기안자', rank: '과장', date: '' },
    teamLead: emptyPerson(),
    deptHead: emptyPerson(),
    additionalApprovers: [],
});
const t = (key: string, params: Record<string, unknown> = {}) =>
    `${key}${params.role ? `:${params.role}` : ''}`;

describe('useApprovalLineSuggestion', () => {
    it('제안된 팀장·부서장으로 빈 결재선을 채운다', async () => {
        const approvalLine = ref(line());
        const { applySuggestion, notices } = useApprovalLineSuggestion({
            approvalLine,
            fetchSuggestion: vi.fn(async () => ({
                foreignBranch: false,
                teamLead: { eno: 'K20001', usrNm: '팀장', ptCNm: '팀장' },
                deptHead: { eno: 'K30001', usrNm: '부장', ptCNm: '부장' },
            })),
            t,
        });

        expect(await applySuggestion()).toBe(true);
        expect(approvalLine.value.teamLead).toMatchObject({ id: 'K20001', name: '팀장', rank: '팀장' });
        expect(approvalLine.value.deptHead).toMatchObject({ id: 'K30001', name: '부장' });
        expect(notices.value).toEqual([]);
    });

    it('비운 차수는 사유별 안내를 남기고 국외점포는 아무것도 하지 않는다', async () => {
        const approvalLine = ref(line());
        const { applySuggestion, notices } = useApprovalLineSuggestion({
            approvalLine,
            fetchSuggestion: vi.fn(async () => ({
                foreignBranch: false,
                teamLead: null,
                deptHead: null,
                teamLeadReason: 'NONE',
                deptHeadReason: 'MULTIPLE',
            })),
            t,
        });
        expect(await applySuggestion()).toBe(false);
        expect(notices.value).toEqual([
            'budget.report.suggestion.none:budget.report.suggestion.roleTeamLead',
            'budget.report.suggestion.multiple:budget.report.suggestion.roleDeptHead',
        ]);

        const foreign = useApprovalLineSuggestion({
            approvalLine: ref(line()),
            fetchSuggestion: vi.fn(async () => ({ foreignBranch: true })),
            t,
        });
        expect(await foreign.applySuggestion()).toBe(false);
        expect(foreign.notices.value).toEqual([]);
    });

    it('이미 지정된 차수는 덮어쓰지 않고, 조회 실패는 안내만 남긴다', async () => {
        const approvalLine = ref(line());
        approvalLine.value.teamLead = { id: 'K99999', name: '수동', rank: '', date: '' };
        const filled = useApprovalLineSuggestion({
            approvalLine,
            fetchSuggestion: vi.fn(async () => ({
                foreignBranch: false,
                teamLead: { eno: 'K20001', usrNm: '팀장' },
                deptHead: { eno: 'K30001', usrNm: '부장' },
            })),
            t,
        });
        await filled.applySuggestion();
        expect(approvalLine.value.teamLead.id).toBe('K99999');
        expect(approvalLine.value.deptHead.id).toBe('K30001');

        const failed = useApprovalLineSuggestion({
            approvalLine: ref(line()),
            fetchSuggestion: vi.fn(async () => {
                throw new Error('network');
            }),
            t,
        });
        expect(await failed.applySuggestion()).toBe(false);
        expect(failed.notices.value).toEqual(['budget.report.suggestion.failed']);
    });
});
```

- [ ] **Step 2: 실패 확인**

```powershell
npx vitest run tests/unit/features/approval/useApprovalLineSuggestion.test.ts
```

- [ ] **Step 3: 구현**

`useApprovals.ts`: 타입과 함수를 추가하고 반환 객체에 `fetchApprovalLineSuggestion`을 넣는다.

```ts
/** 결재라인 자동지정 제안 응답 */
export type ApprovalLineSuggestion = components['schemas']['ApplicationApprovalLineSuggestion'];
```
```ts
    /**
     * 로그인 사용자를 기안자로 한 결재라인 자동지정 제안을 조회합니다.
     *
     * @throws 401/403/API 오류를 호출자에게 전파합니다
     */
    const fetchApprovalLineSuggestion = async () =>
        await $apiFetch<ApprovalLineSuggestion>(`${API_BASE_URL}/approval-line/suggestion`);
```

`app/features/approval/useApprovalLineSuggestion.ts`:

```ts
/**
 * [features/approval/useApprovalLineSuggestion.ts] 결재라인 자동지정 적용
 *
 * 상신 화면 진입 시 제안 API를 한 번 호출해 비어 있는 팀장·부서장만 채우고, 비운 차수의 사유를 안내 문구로 남깁니다.
 * 조회 실패는 안내만 남기고 상신을 막지 않습니다.
 */
import { ref } from 'vue';
import type { Ref } from 'vue';
import type { ApprovalLineSuggestion } from '~/composables/useApprovals';
import type { ApprovalLine, ApprovalLinePerson } from '~/types/approvalForm';

type Translate = (key: string, params?: Record<string, unknown>) => string;

const REASON_KEYS: Record<string, string> = {
    NONE: 'budget.report.suggestion.none',
    MULTIPLE: 'budget.report.suggestion.multiple',
    DUPLICATE: 'budget.report.suggestion.duplicate',
};

const toPerson = (user: { eno?: string; usrNm?: string; ptCNm?: string | null }): ApprovalLinePerson => ({
    id: user.eno ?? '',
    name: user.usrNm ?? '',
    rank: user.ptCNm ?? '',
    date: '',
});

export const useApprovalLineSuggestion = (ctx: {
    approvalLine: Ref<ApprovalLine>;
    fetchSuggestion: () => Promise<ApprovalLineSuggestion>;
    t: Translate;
}) => {
    const { approvalLine, fetchSuggestion, t } = ctx;
    /** 비운 차수·조회 실패 안내 문구 */
    const notices = ref<string[]>([]);

    /**
     * 제안을 적용합니다. 이미 지정된 차수는 덮어쓰지 않습니다.
     *
     * @returns 한 차수라도 새로 채웠으면 true
     */
    const applySuggestion = async (): Promise<boolean> => {
        notices.value = [];
        let suggestion: ApprovalLineSuggestion;
        try {
            suggestion = await fetchSuggestion();
        } catch (error) {
            console.warn('[ApprovalLineSuggestion] 제안 조회 실패', error);
            notices.value = [t('budget.report.suggestion.failed')];
            return false;
        }
        if (suggestion.foreignBranch) return false;

        let filled = false;
        const slots = [
            { key: 'teamLead', user: suggestion.teamLead, reason: suggestion.teamLeadReason, role: 'roleTeamLead' },
            { key: 'deptHead', user: suggestion.deptHead, reason: suggestion.deptHeadReason, role: 'roleDeptHead' },
        ] as const;
        for (const slot of slots) {
            if (approvalLine.value[slot.key].id) continue;
            if (slot.user) {
                approvalLine.value[slot.key] = toPerson(slot.user);
                filled = true;
            } else if (slot.reason && REASON_KEYS[slot.reason]) {
                notices.value.push(
                    t(REASON_KEYS[slot.reason], { role: t(`budget.report.suggestion.${slot.role}`) }),
                );
            }
        }
        return filled;
    };

    return { notices, applySuggestion };
};
```

`report.vue`:
- import: `import { useApprovalLineSuggestion } from '~/features/approval/useApprovalLineSuggestion';`, `useApprovals()` 구조분해에 `fetchApprovalLineSuggestion` 추가.
- `approvalLine` 선언 아래:

```ts
/* 결재라인 자동지정 — 진입 시 한 번 적용하고 비운 차수는 배너로 안내한다 */
const { notices: suggestionNotices, applySuggestion } = useApprovalLineSuggestion({
    approvalLine,
    fetchSuggestion: fetchApprovalLineSuggestion,
    t,
});
```
- `onActivated`의 데이터 로드 성공 분기에서 `/* 초기 PDF 생성 */ await generatePdf();` 앞에 `await applySuggestion();`을 넣는다(sessionStorage에 새 선택이 있어 데이터를 새로 받은 경우에만 실행되며, 재방문 분기는 그대로).
- 템플릿 `#approval-line` 슬롯의 `<ApprovalLineSelector` 앞에 배너를 넣는다.

```vue
                <Message
                    v-for="notice in suggestionNotices"
                    :key="notice"
                    severity="warn"
                    :closable="false"
                    class="mb-2"
                >
                    {{ notice }}
                </Message>
```

`i18n/messages/budget.ts` ko `report`에 추가:

```ts
                suggestion: {
                    roleTeamLead: '1차 결재자(팀장·CO)',
                    roleDeptHead: '2차 결재자(부점장급)',
                    none: '{role} 후보가 없어 자동지정하지 못했습니다. 결재선을 직접 지정해 주세요.',
                    multiple: '{role} 후보가 2명 이상이라 자동지정하지 못했습니다. 결재선을 직접 지정해 주세요.',
                    duplicate: '{role}가 1차 결재자와 같은 사람이라 비워 두었습니다. 결재선을 직접 지정해 주세요.',
                    failed: '결재라인 자동지정 정보를 불러오지 못했습니다. 결재선을 직접 지정해 주세요.',
                },
```
en:

```ts
                suggestion: {
                    roleTeamLead: 'first approver (team lead / CO)',
                    roleDeptHead: 'second approver (department head)',
                    none: 'No candidate for the {role}. Please set the approval line manually.',
                    multiple: 'More than one candidate for the {role}. Please set the approval line manually.',
                    duplicate: 'The {role} is the same person as the first approver. Please set the approval line manually.',
                    failed: 'Could not load the approval line suggestion. Please set the approval line manually.',
                },
```

- [ ] **Step 4: 통과 확인**

```powershell
npx vitest run tests/unit/features/approval tests/unit/composables/useApprovals.test.ts tests/unit/pages/infoProjectsReport.test.ts
npm run typecheck
```

- [ ] **Step 5: Commit**

```powershell
git add app/composables/useApprovals.ts app/features/approval/useApprovalLineSuggestion.ts app/pages/budget/report.vue i18n/messages/budget.ts tests/unit/features/approval/useApprovalLineSuggestion.test.ts
git commit -m "feat: 전산예산 상신 화면 결재라인 자동지정"
```

---

### Task 17: Health Stack, 호환 버전, 완료 기록

**Files:**
- Modify: `C:\it\versions.lock` (스크립트로 갱신)
- Modify: `C:\it\TASK_DONE.md` (완료 항목 추가)
- Modify: `C:\it\docs\superpowers\specs\2026-09-03-budget-form-improvements-design.md` (§8.2 마이그레이션 파일명을 실제 `V20260903_*`로 정정)

- [ ] **Step 1: 프론트 전체 검증**

```powershell
cd C:\it\it_frontend
npm run format:check
npm run check
npm test
```
Expected: 모두 통과. `format:check` 실패는 `npm run format` 후 해당 파일만 다시 스테이징한다. `check`의 CQ-43·CQ-44 기존 실패(`boardContent.ts`, `pdf/projectSection.ts`)는 이 계획 범위 밖이므로 그 두 건 외에 새 오류가 없어야 한다.

- [ ] **Step 2: 백엔드 전체 검증**

```powershell
cd C:\it\it_backend
./gradlew test
```

- [ ] **Step 3: 수동 시나리오 확인**

로컬 백엔드·프론트를 기동해 다음을 확인한다.

1. 정보화사업 신규: 연도 Select에 올해·내년만 보인다. (시스템 날짜를 10월로 바꾸거나 `requiresCurrentYearNotice`를 콘솔에서 호출해) 올해 선택 시 "유의사항 안내" 팝업이 뜨고 취소하면 내년으로 돌아간다.
2. 기 지급금액 라벨이 `2027 이전 지급금액 (원)` 형태이고 아래에 `* 당해 지급예정액 포함`이 보인다.
3. 소요자원 금액 `₩0` 칸을 클릭하면 빈칸, 벗어나면 `₩0`. 산정근거는 Select이며 기타를 고르면 텍스트 입력이 나타나고 비운 채 저장하면 행 번호 안내가 뜬다.
4. [임시저장] 후 목록 배지 `임시저장`, [저장] 후 `작성완료`. 결재 상신 화면 "작성완료" 스코프에 저장 건만 보인다. 작성완료 건을 다시 열면 [임시저장] 버튼이 없다.
5. 상신 화면 진입 시 국내 기안자의 팀장·부서장이 채워지거나 사유 배너가 보인다. 상신 후 결재함 목록에 작성완료 신청서가 나타나지 않는다.

- [ ] **Step 4: 호환 버전과 완료 기록**

```powershell
cd C:\it
./scripts/update-versions-lock.ps1
```

`TASK_DONE.md`에 다음 행을 추가한다(기존 표 형식에 맞춘다).

```markdown
| 2026-09-03 | 전산예산 작성 화면 개선(변경1~5): 기 지급금액 라벨, 사업연도 선택·유의사항, 소요자원 입력, 결재라인 자동지정, 임시저장·작성완료 | it_database V20260903_001~003, it_backend ApprovalStamper·ApprovalLineSuggestionService, it_frontend 작성·상신 화면 | `docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md`, `docs/superpowers/plans/2026-09-03-budget-form-improvements.md` |
```

설계서 §8.2의 `V20260904_001__AddDraftedApplicationStatusCode.sql`을 `V20260903_001__AddDraftedApplicationStatusCode.sql`로, §7.4의 `V20260904_002__SeedApprovalLinePositionCodes.sql`을 `V20260903_002__SeedApprovalLinePositionCodes.sql`로 고친다.

- [ ] **Step 5: Commit (루트)**

```powershell
cd C:\it
git add versions.lock TASK_DONE.md docs/superpowers/specs/2026-09-03-budget-form-improvements-design.md
git diff --cached --stat
git commit -m "docs: 전산예산 작성 화면 개선 완료 기록과 호환 버전 갱신"
```
