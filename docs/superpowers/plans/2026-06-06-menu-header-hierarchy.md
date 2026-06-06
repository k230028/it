# 메뉴 관리체계 3계층 개편 (HED 헤더 계층) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더를 실제 DB 메뉴 노드(`HED` 타입)로 승격해 메뉴 트리를 `HED → GRP/LNK → 서브링크`의 단일 자기참조 3계층 트리로 통합하고, 관리자 화면에서 관리 가능하게 한다.

**Architecture:** `SYS_HRK_MNU_ID` 코드 그룹핑과 하드코딩 헤더(`AppHeader.vue`)를 폐기한다. 7개 HED 루트 노드를 신설하고 기존 루트를 그 자식으로 reparent하여 깊이를 +1(최대 4)한다. 백엔드 트리 빌드/가지치기와 프론트 헤더/사이드바가 모두 동일한 HED-루트 트리를 단일 소스로 사용한다. CDP는 플레이스홀더 자식 1개를 둔 빈 헤더로 만든다.

**Tech Stack:** Oracle (수동 마이그레이션 SQL, 멱등), Spring Boot 4 / Java 25 (JPA, `ddl-auto=validate`, JUnit5 + Mockito + AssertJ), Nuxt 4 / Vue 3 / TypeScript (Vitest, PrimeVue).

---

## ⚠️ 실행 순서 (필수)

백엔드는 `spring.jpa.hibernate.ddl-auto=validate`이므로 **엔티티와 DB 스키마가 부팅 시점에 일치**해야 한다. `SYS_HRK_MNU_ID`를 드롭하는 마이그레이션(007)과 해당 필드를 제거한 엔티티는 같은 정지 구간에서 함께 적용한다.

권장 순서:
1. **백엔드 앱을 정지**한다 (`bootRun` 중지).
2. 백엔드 코드 변경(Task 4~9)을 모두 적용한다. (앱이 떠 있지 않으므로 validate 미실행)
3. 마이그레이션 **005 → 006 → 007**을 순서대로 실행한다.
4. 백엔드 앱을 기동(`./gradlew bootRun`)하여 validate 통과를 확인한다.
5. 프론트엔드 변경(Task 10~17)을 적용하고 `npm run check` + `npm test`로 검증한다.

> 마이그레이션 005·006은 가산적(additive)이라 단독 실행도 안전하지만, 007(컬럼 드롭)은 엔티티에서 `sysHrkMnuId`가 제거된 뒤(또는 앱 정지 중)에만 실행해야 한다.

---

## 파일 구조 (생성/수정 대상)

**DB (생성)**
- `it_database/migrations/V20260606_005__AddHedMenuTypeAndDepth.sql` — CHECK 제약 완화
- `it_database/migrations/V20260606_006__InsertHeadersAndReparent.sql` — HED/CDP 삽입 + reparent + 경로/깊이 재계산
- `it_database/migrations/V20260606_007__DropSysHrkMnuId.sql` — 컬럼 드롭 + 인덱스 재생성

**백엔드 (수정)**
- `domain/menu/entity/Cmenum.java` — `sysHrkMnuId` 필드 제거
- `domain/log/entity/CmenumL.java` — `sysHrkMnuId` 필드 제거
- `domain/menu/dto/MenuDto.java` — `Node`/`UpsertRequest`에서 `sysHrkMnuId` 제거 (`Route`는 유지)
- `domain/menu/service/MenuQueryService.java` — `toNode` 필드 제거, `prune`에 `HED` 포함
- `domain/menu/service/AdminMenuService.java` — `MAX_DEPTH=4`, HED 검증, `sysHrkMnuId` 제거
- `domain/menu/service/BoardListMenuResolver.java` — `sysHrkMnuId` 제거, depth/path를 HED 기준으로
- 테스트 2종 수정 + HED 테스트 추가 (Task 9)

**프론트 (수정/생성)**
- `app/types/menu.ts` — `MenuNode`에 `HED` 추가·`sysHrkMnuId` 제거, `CONTEXT_BY_SYS_HRK_MNU_ID`/`ContextCode` 삭제
- `app/composables/useMenu.ts` — `treeByContext` 폐기, `headers`/`activeHeader`/`sidebarItems` + 순수함수 `resolveActiveHeaderId`
- `app/composables/useAdminMenu.ts` — `MenuUpsertRequest`에서 `sysHrkMnuId` 제거, `'HED'` 허용
- `app/pages/admin/menus/index.vue` — 유형 Select에 `HED` 추가, `시스템상위메뉴ID` 입력 제거
- `app/components/AppHeader.vue` — DB 기반 헤더 렌더
- `app/components/AppSidebar.vue` — `sidebarItems` 사용
- `app/utils/menuPresentation.ts` — HED 7개 + CDP 아이콘 추가
- `app/pages/cdp/index.vue` (생성) — 준비중 페이지
- `tests/unit/composables/useMenu.test.ts` (생성) — `resolveActiveHeaderId` 테스트

> `app/pages/admin/routes/index.vue`와 `MenuDto.Route`/`RouteCatalogItem`은 라우트 카탈로그(`TPRMPP_CMENUD`) 소관이며 `SYS_HRK_MNU_ID`를 유지하므로 **수정하지 않는다.**

---

## Phase 1 — 데이터베이스 마이그레이션

### Task 1: 마이그레이션 005 — CHECK 제약 완화 (HED + 깊이 4)

**Files:**
- Create: `it_database/migrations/V20260606_005__AddHedMenuTypeAndDepth.sql`

- [ ] **Step 1: 마이그레이션 파일 작성**

`TPRMPP_CMENUM`의 두 CHECK 제약을 멱등하게 재정의한다. (`TPRMPP_CMENUL`에는 CHECK 제약이 없으므로 대상 아님.)

```sql
-- 메뉴 유형코드에 HED(헤더) 추가, 메뉴 깊이 상한 3 → 4.
-- HED 계층 도입으로 모든 노드가 깊이 +1 되며 최대 깊이가 4가 된다.
-- 멱등성: 제약이 존재하면 drop 후 재생성한다.
DECLARE
    PROCEDURE drop_con(p_con VARCHAR2) IS
        v NUMBER;
    BEGIN
        SELECT COUNT(*) INTO v FROM USER_CONSTRAINTS WHERE CONSTRAINT_NAME = p_con;
        IF v > 0 THEN
            EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CMENUM DROP CONSTRAINT ' || p_con;
        END IF;
    END;
BEGIN
    drop_con('CK_CMENUM_TP');
    drop_con('CK_CMENUM_DEP');
    EXECUTE IMMEDIATE q'[ALTER TABLE TPRMPP_CMENUM ADD CONSTRAINT CK_CMENUM_TP CHECK (MNU_TP_C IN ('LNK','GRP','DYN','HED'))]';
    EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CMENUM ADD CONSTRAINT CK_CMENUM_DEP CHECK (MNU_DEP BETWEEN 1 AND 4)';
END;
/
```

- [ ] **Step 2: 실행 및 검증 (로컬 DB가 떠 있을 때)**

Run (루트에서):
```powershell
sqlplus ITPAPP/****@127.0.0.1:1521/XEPDB1 @it_database\migrations\V20260606_005__AddHedMenuTypeAndDepth.sql
```
Expected: `PL/SQL procedure successfully completed.` (오류 없이 완료). 재실행해도 동일하게 성공해야 한다(멱등).

> 비밀번호는 `it_database/connect-db.ps1` 기본값과 동일. 스크립트 실행이 번거로우면 `.\it_database\connect-db.ps1`로 접속 후 `@경로`로 실행한다.

- [ ] **Step 3: 커밋**

```bash
git add it_database/migrations/V20260606_005__AddHedMenuTypeAndDepth.sql
git commit -m "feat(db): 메뉴 CHECK 제약 완화 — HED 유형 + 깊이 4 (마이그레이션 005)"
```

---

### Task 2: 마이그레이션 006 — HED/CDP 삽입 + reparent + 경로 재계산

**Files:**
- Create: `it_database/migrations/V20260606_006__InsertHeadersAndReparent.sql`

매핑(구 `SYS_HRK_MNU_ID` → HED):
`01→MHED0002(사업/예산)`, `02→MHED0004(IT자체감사)`, `03→MHED0007(관리자)`, `04→MHED0006(게시판)`, `05→MHED0001(사전협의)`, `06→MHED0005(전자결재)`. 신규 `MHED0003`=IT/AI CDP.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- HED 헤더 계층 도입: 7개 HED 루트 + CDP 플레이스홀더 삽입 → 기존 루트 reparent
--   → 전체 MNU_DEP/WHL_MNU_PTH 재계산.
-- 한글 포함: NLS_LANG=.AL32UTF8 환경에서 실행.
-- 멱등성: MERGE(WHEN NOT MATCHED) + reparent는 "아직 루트인 비-HED"만 대상으로 하며,
--          경로/깊이 재계산은 현재 트리 구조로부터 매번 동일 결과를 산출한다.
SET DEFINE OFF;
SET SQLBLANKLINES ON;

-- 1) /cdp 라우트 선등록 (LNK FK 전제). CMENUD는 SYS_HRK_MNU_ID 컬럼을 유지한다.
MERGE INTO TPRMPP_CMENUD t
USING (SELECT '/cdp' AS SRE_PTH, 'IT/AI CDP 준비중' AS SRE_MNU_NM, '07' AS SYS_HRK_MNU_ID FROM DUAL) s
ON (t.SRE_PTH = s.SRE_PTH)
WHEN NOT MATCHED THEN
  INSERT (SRE_PTH, SRE_MNU_NM, SYS_HRK_MNU_ID, USE_YN, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.SRE_PTH, s.SRE_MNU_NM, s.SYS_HRK_MNU_ID, 'Y', 'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

-- 2) HED 7행 + CDP 플레이스홀더(MCDP0001) 삽입.
--    SYS_HRK_MNU_ID는 마이그레이션 007에서 드롭되므로 임시값('00'/'07')을 넣는다.
MERGE INTO TPRMPP_CMENUM t
USING (
  SELECT 'MHED0001' AS MNU_ID, CAST(NULL AS VARCHAR2(10)) AS HRK_MNU_ID, '00' AS SYS_HRK_MNU_ID,
         '사전협의' AS MNU_NM, 'HED' AS MNU_TP_C, CAST(NULL AS VARCHAR2(300)) AS SRE_PTH,
         10 AS MNU_SOT_SQN_SNO, 'N' AS HID_YN, 1 AS MNU_DEP, '/MHED0001' AS WHL_MNU_PTH FROM DUAL UNION ALL
  SELECT 'MHED0002', NULL, '00', '사업/예산',  'HED', NULL, 20, 'N', 1, '/MHED0002' FROM DUAL UNION ALL
  SELECT 'MHED0003', NULL, '00', 'IT/AI CDP', 'HED', NULL, 30, 'N', 1, '/MHED0003' FROM DUAL UNION ALL
  SELECT 'MHED0004', NULL, '00', 'IT자체감사','HED', NULL, 40, 'N', 1, '/MHED0004' FROM DUAL UNION ALL
  SELECT 'MHED0005', NULL, '00', '전자결재',  'HED', NULL, 50, 'N', 1, '/MHED0005' FROM DUAL UNION ALL
  SELECT 'MHED0006', NULL, '00', '게시판',    'HED', NULL, 60, 'N', 1, '/MHED0006' FROM DUAL UNION ALL
  SELECT 'MHED0007', NULL, '00', '관리자',    'HED', NULL, 70, 'N', 1, '/MHED0007' FROM DUAL UNION ALL
  -- CDP 플레이스홀더 (준비중 LNK)
  SELECT 'MCDP0001', 'MHED0003', '07', '준비중', 'LNK', '/cdp', 10, 'N', 2, '/MHED0003/MCDP0001' FROM DUAL
) s ON (t.MNU_ID = s.MNU_ID)
WHEN NOT MATCHED THEN
  INSERT (MNU_ID, HRK_MNU_ID, SYS_HRK_MNU_ID, MNU_NM, MNU_TP_C, SRE_PTH, MNU_SOT_SQN_SNO, HID_YN, MNU_DEP, WHL_MNU_PTH,
          DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.MNU_ID, s.HRK_MNU_ID, s.SYS_HRK_MNU_ID, s.MNU_NM, s.MNU_TP_C, s.SRE_PTH, s.MNU_SOT_SQN_SNO, s.HID_YN, s.MNU_DEP, s.WHL_MNU_PTH,
          'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

-- 3) 관리자 헤더 권한 매핑 (MHED0007 → ITPAD001). 일반 사용자에게 헤더 자체가 숨겨진다.
MERGE INTO TPRMPP_CMENUA t
USING (SELECT 'MHED0007' AS MNU_ID, 'ITPAD001' AS ATH_ID FROM DUAL) s
ON (t.MNU_ID = s.MNU_ID AND t.ATH_ID = s.ATH_ID)
WHEN NOT MATCHED THEN
  INSERT (MNU_ID, ATH_ID, DEL_YN, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID)
  VALUES (s.MNU_ID, s.ATH_ID, 'N', RAWTOHEX(SYS_GUID()), 1, SYSDATE, 'SYSTEM');

-- 4) 기존 루트(아직 HRK_MNU_ID가 NULL인 비-HED 노드)를 해당 HED 밑으로 reparent.
--    이미 reparent 된 경우 HRK_MNU_ID가 채워져 있어 재실행 시 영향 없음(멱등).
UPDATE TPRMPP_CMENUM
   SET HRK_MNU_ID = CASE SYS_HRK_MNU_ID
                      WHEN '01' THEN 'MHED0002'
                      WHEN '02' THEN 'MHED0004'
                      WHEN '03' THEN 'MHED0007'
                      WHEN '04' THEN 'MHED0006'
                      WHEN '05' THEN 'MHED0001'
                      WHEN '06' THEN 'MHED0005'
                    END
 WHERE HRK_MNU_ID IS NULL
   AND MNU_ID NOT LIKE 'MHED%'
   AND DEL_YN = 'N';

-- 5) 전체 트리의 MNU_DEP/WHL_MNU_PTH를 현재 부모 관계로부터 재계산(멱등).
--    HED 루트는 LEVEL 1/'/MHEDxxxx', 그 자손은 LEVEL/SYS_CONNECT_BY_PATH로 일관 갱신.
UPDATE TPRMPP_CMENUM m
   SET (m.MNU_DEP, m.WHL_MNU_PTH) = (
        SELECT t.LVL, t.PTH
          FROM (
            SELECT MNU_ID, LEVEL AS LVL, SYS_CONNECT_BY_PATH(MNU_ID, '/') AS PTH
              FROM TPRMPP_CMENUM
             WHERE DEL_YN = 'N'
             START WITH HRK_MNU_ID IS NULL
           CONNECT BY PRIOR MNU_ID = HRK_MNU_ID
          ) t
         WHERE t.MNU_ID = m.MNU_ID
       )
 WHERE m.DEL_YN = 'N'
   AND EXISTS (
        SELECT 1 FROM (
            SELECT MNU_ID
              FROM TPRMPP_CMENUM
             WHERE DEL_YN = 'N'
             START WITH HRK_MNU_ID IS NULL
           CONNECT BY PRIOR MNU_ID = HRK_MNU_ID
        ) t2
         WHERE t2.MNU_ID = m.MNU_ID
       );

COMMIT;
```

- [ ] **Step 2: 실행**

Run:
```powershell
sqlplus ITPAPP/****@127.0.0.1:1521/XEPDB1 @it_database\migrations\V20260606_006__InsertHeadersAndReparent.sql
```
Expected: 각 MERGE/UPDATE 행수 출력 후 `Commit complete.` 오류 없음.

- [ ] **Step 3: 데이터 검증 쿼리**

Run (sqlplus 세션에서):
```sql
-- (a) HED 7개 존재 + 정렬
SELECT MNU_ID, MNU_NM, MNU_DEP, WHL_MNU_PTH FROM TPRMPP_CMENUM
 WHERE MNU_TP_C='HED' ORDER BY MNU_SOT_SQN_SNO;
-- (b) 더 이상 비-HED 루트가 없어야 함 → 0건
SELECT COUNT(*) AS ORPHAN_ROOTS FROM TPRMPP_CMENUM
 WHERE HRK_MNU_ID IS NULL AND MNU_TP_C<>'HED' AND DEL_YN='N';
-- (c) 최대 깊이 ≤ 4
SELECT MAX(MNU_DEP) AS MAX_DEPTH FROM TPRMPP_CMENUM WHERE DEL_YN='N';
-- (d) 예시 경로 확인 (관리자 최심 경로)
SELECT MNU_ID, MNU_DEP, WHL_MNU_PTH FROM TPRMPP_CMENUM WHERE MNU_ID='MADM0019';
```
Expected:
- (a) `MHED0001`~`MHED0007` 7행, 모두 `MNU_DEP=1`, `WHL_MNU_PTH='/MHEDxxxx'`.
- (b) `ORPHAN_ROOTS = 0`.
- (c) `MAX_DEPTH = 4`.
- (d) `MADM0019`: `MNU_DEP=4`, `WHL_MNU_PTH='/MHED0007/MADM0017/MADM0018/MADM0019'`.

- [ ] **Step 4: 커밋**

```bash
git add it_database/migrations/V20260606_006__InsertHeadersAndReparent.sql
git commit -m "feat(db): HED 헤더 7개 + CDP 플레이스홀더 삽입 및 트리 reparent (마이그레이션 006)"
```

---

### Task 3: 마이그레이션 007 — SYS_HRK_MNU_ID 드롭 + 인덱스 재생성

**Files:**
- Create: `it_database/migrations/V20260606_007__DropSysHrkMnuId.sql`

> ⚠️ 이 마이그레이션은 **백엔드 엔티티에서 `sysHrkMnuId`가 제거된 뒤(또는 앱 정지 중)** 실행한다. 실행 순서 섹션 참조.

- [ ] **Step 1: 마이그레이션 파일 작성**

```sql
-- SYS_HRK_MNU_ID 폐기: 그룹핑은 부모 HED(HRK_MNU_ID)가 담당한다.
-- IDX_CMENUM_TREE가 SYS_HRK_MNU_ID를 선두 컬럼으로 포함하므로 인덱스 드롭 → 컬럼 드롭 → 인덱스 재생성.
-- CMENUM, CMENUL 양쪽 컬럼 제거. 멱등성: 존재 여부 확인 후 처리.
DECLARE
    v NUMBER;
BEGIN
    SELECT COUNT(*) INTO v FROM USER_INDEXES WHERE INDEX_NAME = 'IDX_CMENUM_TREE';
    IF v > 0 THEN EXECUTE IMMEDIATE 'DROP INDEX IDX_CMENUM_TREE'; END IF;

    SELECT COUNT(*) INTO v FROM USER_TAB_COLS
     WHERE TABLE_NAME = 'TPRMPP_CMENUM' AND COLUMN_NAME = 'SYS_HRK_MNU_ID';
    IF v > 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CMENUM DROP COLUMN SYS_HRK_MNU_ID'; END IF;

    SELECT COUNT(*) INTO v FROM USER_TAB_COLS
     WHERE TABLE_NAME = 'TPRMPP_CMENUL' AND COLUMN_NAME = 'SYS_HRK_MNU_ID';
    IF v > 0 THEN EXECUTE IMMEDIATE 'ALTER TABLE TPRMPP_CMENUL DROP COLUMN SYS_HRK_MNU_ID'; END IF;

    SELECT COUNT(*) INTO v FROM USER_INDEXES WHERE INDEX_NAME = 'IDX_CMENUM_TREE';
    IF v = 0 THEN
        EXECUTE IMMEDIATE 'CREATE INDEX IDX_CMENUM_TREE ON TPRMPP_CMENUM (HRK_MNU_ID, MNU_SOT_SQN_SNO)';
    END IF;
END;
/
```

- [ ] **Step 2: 실행 및 검증**

Run:
```powershell
sqlplus ITPAPP/****@127.0.0.1:1521/XEPDB1 @it_database\migrations\V20260606_007__DropSysHrkMnuId.sql
```
Then 검증:
```sql
SELECT COUNT(*) AS REMAINING FROM USER_TAB_COLS
 WHERE COLUMN_NAME='SYS_HRK_MNU_ID' AND TABLE_NAME IN ('TPRMPP_CMENUM','TPRMPP_CMENUL');
SELECT COLUMN_NAME, COLUMN_POSITION FROM USER_IND_COLUMNS
 WHERE INDEX_NAME='IDX_CMENUM_TREE' ORDER BY COLUMN_POSITION;
```
Expected: `REMAINING = 0`; 인덱스 컬럼이 `HRK_MNU_ID`(1), `MNU_SOT_SQN_SNO`(2).

- [ ] **Step 3: 커밋**

```bash
git add it_database/migrations/V20260606_007__DropSysHrkMnuId.sql
git commit -m "feat(db): SYS_HRK_MNU_ID 컬럼 폐기 + 인덱스 재생성 (마이그레이션 007)"
```

---

## Phase 2 — 백엔드

### Task 4: 엔티티에서 `sysHrkMnuId` 필드 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/entity/Cmenum.java:35-36`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/log/entity/CmenumL.java:27-28`

- [ ] **Step 1: `Cmenum`에서 필드 삭제**

`Cmenum.java`에서 다음 블록을 삭제한다:
```java
    @Column(name = "SYS_HRK_MNU_ID", length = 10, nullable = false, comment = "시스템상위메뉴ID")
    private String sysHrkMnuId;
```

- [ ] **Step 2: `CmenumL`에서 필드 삭제**

`CmenumL.java`에서 다음 블록을 삭제한다:
```java
    @Column(name = "SYS_HRK_MNU_ID", length = 10, comment = "시스템상위메뉴ID")
    private String sysHrkMnuId;
```

- [ ] **Step 3: 컴파일은 Task 9 일괄 검증** (이 시점엔 서비스/테스트가 아직 필드를 참조하므로 단독 컴파일 실패가 정상)

---

### Task 5: `MenuDto`에서 `sysHrkMnuId` 제거 (Node·UpsertRequest)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java`

- [ ] **Step 1: `Node`에서 필드 삭제**

`MenuDto.java`의 `Node` 클래스에서 다음 줄을 삭제한다:
```java
        private String sysHrkMnuId;
```

- [ ] **Step 2: `UpsertRequest`에서 필드 삭제**

`UpsertRequest` 클래스에서 다음 줄을 삭제한다:
```java
        @NotBlank @Schema(description = "시스템상위메뉴ID") private String sysHrkMnuId;
```

> `Route` 클래스의 `sysHrkMnuId`는 라우트 카탈로그(CMENUD)용이므로 **유지**한다.

---

### Task 6: `MenuQueryService` — `toNode` 정리 + `prune`에 HED 포함

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java:120` (prune container 판정)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java:130` (toNode)

- [ ] **Step 1: `prune`의 컨테이너 판정에 `HED` 추가**

HED가 비어 있으면(권한 필터로 자식이 모두 사라지면) 헤더가 숨겨져야 한다. `prune` 내부의 다음 줄을:
```java
            boolean container = "GRP".equals(n.getMnuTpC()) || "DYN".equals(n.getMnuTpC());
```
다음으로 교체한다:
```java
            boolean container = "GRP".equals(n.getMnuTpC()) || "DYN".equals(n.getMnuTpC()) || "HED".equals(n.getMnuTpC());
```

- [ ] **Step 2: `toNode`에서 `sysHrkMnuId` 빌더 호출 제거**

`toNode`의 다음 줄을:
```java
                .mnuId(m.getMnuId()).hrkMnuId(m.getHrkMnuId()).sysHrkMnuId(m.getSysHrkMnuId())
```
다음으로 교체한다:
```java
                .mnuId(m.getMnuId()).hrkMnuId(m.getHrkMnuId())
```

---

### Task 7: `AdminMenuService` — 깊이 4 + HED 검증 규칙

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`

- [ ] **Step 1: `MAX_DEPTH` 상향**

`AdminMenuService.java:23`의:
```java
    private static final int MAX_DEPTH = 3;
```
를:
```java
    private static final int MAX_DEPTH = 4;
```

- [ ] **Step 2: `create`에서 `sysHrkMnuId` 제거 + HED/루트 규칙 추가**

`create` 메서드를 다음으로 교체한다:
```java
    public String create(MenuDto.UpsertRequest req) {
        validateTypePath(req.getMnuTpC(), req.getSrePth());
        validateHierarchy(req.getMnuTpC(), req.getHrkMnuId());
        String mnuId = cmenumRepository.nextMnuId();

        int depth = 1;
        String whlPth = "/" + mnuId;
        if (req.getHrkMnuId() != null) {
            Cmenum parent = load(req.getHrkMnuId());
            depth = parent.getMnuDep() + 1;
            if (depth > MAX_DEPTH) throw badRequest("메뉴 깊이는 최대 " + MAX_DEPTH + "단입니다.");
            whlPth = parent.getWhlMnuPth() + "/" + mnuId;
        }

        Cmenum menu = Cmenum.builder()
                .mnuId(mnuId).hrkMnuId(req.getHrkMnuId())
                .mnuNm(req.getMnuNm()).mnuTpC(req.getMnuTpC()).srePth(req.getSrePth())
                .mnuSotSqnSno(SORT_STEP).hidYn(req.getHidYn() == null ? "N" : req.getHidYn())
                .mnuDep(depth).whlMnuPth(whlPth).delYn("N")
                .build();
        cmenumRepository.save(menu);
        replaceRoles(mnuId, req.getAthIds());
        return mnuId;
    }
```

- [ ] **Step 3: `update`에서 `sysHrkMnuId` 세터 제거**

`update` 메서드에서 다음 줄을 삭제한다:
```java
        menu.setSysHrkMnuId(req.getSysHrkMnuId());
```

- [ ] **Step 4: `move`에 HED 위치 규칙 추가**

`move` 메서드 본문 첫 줄(`Cmenum target = load(mnuId);`) 바로 다음에 검증 호출을 추가한다:
```java
        Cmenum target = load(mnuId);
        validateHierarchy(target.getMnuTpC(), newHrkMnuId);
        String oldPrefix = target.getWhlMnuPth();
```

- [ ] **Step 5: `validateHierarchy` 헬퍼 추가**

`validateTypePath` 메서드 바로 아래(helpers 영역)에 추가한다:
```java
    /**
     * HED(헤더)는 최상위 전용, 비-HED는 반드시 상위 메뉴를 가져야 한다.
     *
     * @param mnuTpC     메뉴유형코드
     * @param hrkMnuId   상위메뉴ID (루트면 null)
     * @throws ResponseStatusException HED가 상위를 갖거나, 비-HED가 루트로 지정된 경우
     */
    private void validateHierarchy(String mnuTpC, String hrkMnuId) {
        boolean isHed = "HED".equals(mnuTpC);
        if (isHed && hrkMnuId != null) {
            throw badRequest("헤더(HED) 메뉴는 최상위에만 위치할 수 있습니다.");
        }
        if (!isHed && hrkMnuId == null) {
            throw badRequest("헤더(HED)가 아닌 메뉴는 최상위(루트)로 둘 수 없습니다. 상위 헤더를 지정하세요.");
        }
    }
```

- [ ] **Step 6: `validateTypePath`에 `HED` 허용**

`validateTypePath`의 다음 줄을:
```java
        if (!List.of("LNK", "GRP", "DYN").contains(mnuTpC)) throw badRequest("잘못된 메뉴유형코드: " + mnuTpC);
```
다음으로 교체한다 (HED는 GRP/DYN과 동일하게 화면경로를 가질 수 없음 — 기존 else 분기가 처리):
```java
        if (!List.of("LNK", "GRP", "DYN", "HED").contains(mnuTpC)) throw badRequest("잘못된 메뉴유형코드: " + mnuTpC);
```

---

### Task 8: `BoardListMenuResolver` — HED 기준 경로/깊이 + `sysHrkMnuId` 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/BoardListMenuResolver.java`

게시판 DYN 노드 `MBRD0001`은 이제 `MHED0006` 밑(depth 2)이므로, 동적 자식은 depth 3, 경로는 `/MHED0006/MBRD0001/MBRD-xxx`가 되어야 Breadcrumb 조상 해석이 맞는다.

- [ ] **Step 1: 부모 헤더 상수 추가**

`BOARD_DYN_MNU_ID` 상수 아래에 추가한다:
```java
    /** 게시판 헤더(HED) MNU_ID. 마이그레이션 006 시드와 일치해야 함. */
    private static final String BOARD_HEADER_MNU_ID = "MHED0006";
```

- [ ] **Step 2: `toNode` 교체 (sysHrkMnuId 제거, depth 3, HED 포함 경로)**

`toNode` 메서드를 다음으로 교체한다:
```java
    private MenuDto.Node toNode(BoardMetaDto.Response b) {
        String childMnuId = "MBRD-" + b.getBlbMngNo();
        return MenuDto.Node.builder()
                .mnuId(childMnuId)
                .hrkMnuId(BOARD_DYN_MNU_ID)
                .mnuNm(b.getBlbNm())
                .mnuTpC("LNK")
                .srePth("/board/" + b.getBlbMngNo())
                .mnuDep(3)
                // Breadcrumb가 조상(게시판 헤더·DYN)을 해석하도록 헤더부터 전체 경로를 채운다.
                .whlMnuPth("/" + BOARD_HEADER_MNU_ID + "/" + BOARD_DYN_MNU_ID + "/" + childMnuId)
                // 가변 리스트 필수: MenuQueryService.sortRecursive가 children을 in-place 정렬한다.
                .children(new ArrayList<>())
                .build();
    }
```

---

### Task 9: 백엔드 테스트 수정/추가 + 전체 테스트 통과

**Files:**
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`

> `AdminMenuControllerTest`, `AdminRouteServiceTest`, `AdminRouteControllerTest`, `BoardListMenuResolverTest`도 `sysHrkMnuId`를 참조할 수 있다. Step 6에서 컴파일·테스트로 확인하고, 컨트롤러 테스트의 `UpsertRequest` 빌더에 `.sysHrkMnuId(...)` 호출이 있으면 제거한다(라우트 관련 `Route`/`Cmenud`의 `sysHrkMnuId`는 유지).

- [ ] **Step 1: `MenuQueryServiceTest` 헬퍼에서 `sysHrkMnuId` 제거**

`node(...)` 헬퍼의:
```java
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).sysHrkMnuId("01").mnuNm(id)
                .mnuTpC(type).mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
```
를:
```java
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).mnuNm(id)
                .mnuTpC(type).mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
```
그리고 `dynNode_getsChildrenFromMatchingResolver` 테스트의 dyn 빌더에서 `.sysHrkMnuId("04")` 호출을 삭제한다.

- [ ] **Step 2: `MenuQueryServiceTest`에 HED prune 회귀 테스트 추가**

`MenuQueryServiceTest` 클래스 끝(마지막 `}` 앞)에 추가한다:
```java
    @Test
    void hedHeader_isPruned_whenAllChildrenUnauthorized_butKept_whenPlaceholderVisible() {
        // 관리자 헤더 H1: admin 전용 자식 A. CDP 헤더 H2: 공개 플레이스홀더 P.
        given(cmenumRepository.findAllActive()).willReturn(List.of(
                node("H1", null, "HED", 1, "/H1"),
                node("A",  "H1", "LNK", 2, "/H1/A"),
                node("H2", null, "HED", 1, "/H2"),
                node("P",  "H2", "LNK", 2, "/H2/P")
        ));
        given(cmenuaRepository.findAllActive()).willReturn(List.of(
                Cmenua.builder().mnuId("H1").athId("ITPAD001").delYn("N").build(),
                Cmenua.builder().mnuId("A").athId("ITPAD001").delYn("N").build()
        ));

        // 비관리자: H1(관리자 헤더) 숨김, H2(CDP)는 플레이스홀더 P 덕분에 유지
        List<MenuDto.Node> userTree = service.getMenuTree(List.of("ITPZZ001"));
        assertThat(userTree).extracting(MenuDto.Node::getMnuId).containsExactly("H2");

        // 관리자: H1 + H2 모두 노출
        List<MenuDto.Node> adminTree = service.getMenuTree(List.of("ITPAD001"));
        assertThat(adminTree).extracting(MenuDto.Node::getMnuId).containsExactlyInAnyOrder("H1", "H2");
    }
```

- [ ] **Step 3: `AdminMenuServiceTest` 헬퍼에서 `sysHrkMnuId` 제거**

`node(...)` 헬퍼의:
```java
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).sysHrkMnuId("01").mnuNm(id)
                .mnuTpC("GRP").mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
```
를:
```java
        return Cmenum.builder().mnuId(id).hrkMnuId(parent).mnuNm(id)
                .mnuTpC("GRP").mnuSotSqnSno(10).hidYn("N").mnuDep(dep).whlMnuPth(path).delYn("N").build();
```
그리고 `UpsertRequest.builder()`를 쓰는 모든 테스트에서 `.sysHrkMnuId("01")`/`.sysHrkMnuId("02")` 호출을 삭제한다. 또한 `create_깊이초과_예외`의 parent 빌더에서 `.sysHrkMnuId("01")`를 삭제한다.

- [ ] **Step 4: 깊이 한도 테스트를 4단 기준으로 갱신**

(a) `move_rejectsWhenResultingDepthExceedsThree`를 다음으로 교체한다:
```java
    @Test
    void move_rejectsWhenResultingDepthExceedsFour() {
        // B(depth2)+자식 C(depth3)를 depth3 부모 아래로 이동 → C가 depth5가 되어 거부
        Cmenum target = node("B", "A", 2, "/A/B");
        Cmenum child  = node("C", "B", 3, "/A/B/C");
        Cmenum newParent = node("P", "O", 3, "/N/O/P");
        given(cmenumRepository.findByMnuIdAndDelYn("B", "N")).willReturn(Optional.of(target));
        given(cmenumRepository.findByMnuIdAndDelYn("P", "N")).willReturn(Optional.of(newParent));
        given(cmenumRepository.findSubtreeByPathPrefix("/A/B")).willReturn(List.of(target, child));

        assertThatThrownBy(() -> service.move("B", "P"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("깊이");
    }
```

(b) `create_깊이초과_예외`를 depth-4 부모 기준으로 교체한다:
```java
    @Test
    @DisplayName("create: 깊이가 4단을 초과하면 예외를 던진다")
    void create_깊이초과_예외() {
        // given: depth=4인 부모에 추가하면 depth=5 → 예외
        Cmenum parent = Cmenum.builder().mnuId("D4").hrkMnuId("D3")
                .mnuNm("4단메뉴").mnuTpC("GRP").mnuSotSqnSno(10).hidYn("N")
                .mnuDep(4).whlMnuPth("/D1/D2/D3/D4").delYn("N").build();
        MenuDto.UpsertRequest req = MenuDto.UpsertRequest.builder()
                .mnuNm("5단메뉴").mnuTpC("GRP")
                .hrkMnuId("D4").srePth(null).build();
        given(cmenumRepository.findByMnuIdAndDelYn("D4", "N")).willReturn(Optional.of(parent));
        given(cmenumRepository.nextMnuId()).willReturn("MNU0000004");

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("깊이");
    }
```

(c) `create_GRP유형_루트메뉴저장` 테스트는 이제 `hrkMnuId=null`인 GRP 생성이 `validateHierarchy`로 거부된다. 이 테스트를 HED 루트 생성으로 교체한다:
```java
    @Test
    @DisplayName("create: HED 유형이고 화면경로가 없으면 루트 헤더를 저장한다")
    void create_HED유형_루트헤더저장() {
        // given
        MenuDto.UpsertRequest req = MenuDto.UpsertRequest.builder()
                .mnuNm("새 헤더").mnuTpC("HED")
                .hrkMnuId(null).srePth(null).hidYn("N").athIds(null)
                .build();
        given(cmenumRepository.nextMnuId()).willReturn("MNU0000002");
        given(cmenuaRepository.findActiveByMnuId("MNU0000002")).willReturn(List.of());

        // when
        String result = service.create(req);

        // then
        assertThat(result).isEqualTo("MNU0000002");
        ArgumentCaptor<Cmenum> captor = ArgumentCaptor.forClass(Cmenum.class);
        verify(cmenumRepository).save(captor.capture());
        assertThat(captor.getValue().getMnuDep()).isEqualTo(1);
        assertThat(captor.getValue().getWhlMnuPth()).isEqualTo("/MNU0000002");
    }
```

- [ ] **Step 5: HED 검증 테스트 2건 추가**

`AdminMenuServiceTest` 클래스 끝에 추가한다:
```java
    @Test
    @DisplayName("create: 비-HED 메뉴를 루트로 생성하면 예외를 던진다")
    void create_비HED루트_예외() {
        MenuDto.UpsertRequest req = MenuDto.UpsertRequest.builder()
                .mnuNm("루트GRP").mnuTpC("GRP").hrkMnuId(null).srePth(null).build();
        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최상위");
    }

    @Test
    @DisplayName("move: HED 헤더를 다른 메뉴 밑으로 이동하면 예외를 던진다")
    void move_HED를하위로이동_예외() {
        Cmenum header = Cmenum.builder().mnuId("MHED0009").hrkMnuId(null)
                .mnuNm("헤더").mnuTpC("HED").mnuSotSqnSno(10).hidYn("N")
                .mnuDep(1).whlMnuPth("/MHED0009").delYn("N").build();
        given(cmenumRepository.findByMnuIdAndDelYn("MHED0009", "N")).willReturn(Optional.of(header));

        assertThatThrownBy(() -> service.move("MHED0009", "MHED0002"))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최상위");
    }
```

- [ ] **Step 6: 전체 테스트 실행**

Run:
```bash
cd it_backend && ./gradlew test
```
Expected: `BUILD SUCCESSFUL`. 실패 시 컴파일 오류(잔존 `sysHrkMnuId` 참조)부터 해결한다. `AdminMenuControllerTest` 등에서 `UpsertRequest.builder().sysHrkMnuId(...)` 잔존 호출이 있으면 제거한다.

- [ ] **Step 7: 커밋**

```bash
git add it_backend/src
git commit -m "feat(menu): HED 헤더 계층 백엔드 — 엔티티/DTO/서비스/리졸버 + 테스트"
```

---

## Phase 3 — 프론트엔드

### Task 10: `types/menu.ts` — HED 타입 추가, 컨텍스트 매핑 삭제

**Files:**
- Modify: `it_frontend/app/types/menu.ts`

- [ ] **Step 1: `MenuNode` 갱신 + 컨텍스트 매핑 제거**

파일 전체를 다음으로 교체한다:
```ts
/**
 * ============================================================================
 * [types/menu.ts] 메뉴 관리 프론트 타입
 * ============================================================================
 * 백엔드 MenuDto.Node, RouteCatalog DTO와 1:1 대응하는 타입을 정의합니다.
 * 트리는 HED(헤더) 루트 → GRP/LNK → 서브링크의 3계층 자기참조 구조입니다.
 * 사이드바·Breadcrumb·관리자 메뉴/라우트 화면이 공통으로 사용합니다.
 * ============================================================================
 */

// 백엔드 MenuDto.Node와 1:1 대응
export interface MenuNode {
  mnuId: string;
  hrkMnuId: string | null;
  mnuNm: string;
  mnuTpC: 'LNK' | 'GRP' | 'DYN' | 'HED';
  srePth: string | null;
  mnuSotSqnSno: number | null;
  hidYn: string;
  mnuDep: number;
  whlMnuPth: string;
  children: MenuNode[] | null;
}

export interface RouteCatalogItem {
  srePth: string;
  sreMnuNm: string;
  sysHrkMnuId: string | null;
  useYn: string;
  rmk: string | null;
}
```

> `RouteCatalogItem.sysHrkMnuId`는 라우트 카탈로그(CMENUD)용이라 유지한다. `CONTEXT_BY_SYS_HRK_MNU_ID`와 `ContextCode`는 삭제한다.

---

### Task 11: `useMenu.ts` — 헤더/활성헤더/사이드바 + 순수함수 (TDD)

**Files:**
- Modify: `it_frontend/app/composables/useMenu.ts`
- Test: `it_frontend/tests/unit/composables/useMenu.test.ts` (생성)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `it_frontend/tests/unit/composables/useMenu.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { resolveActiveHeaderId } from '~/composables/useMenu';
import type { MenuNode } from '~/types/menu';

const leaf = (id: string, path: string | null): MenuNode => ({
  mnuId: id, hrkMnuId: null, mnuNm: id, mnuTpC: 'LNK', srePth: path,
  mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 2, whlMnuPth: `/${id}`, children: null,
});
const header = (id: string, children: MenuNode[]): MenuNode => ({
  mnuId: id, hrkMnuId: null, mnuNm: id, mnuTpC: 'HED', srePth: null,
  mnuSotSqnSno: 10, hidYn: 'N', mnuDep: 1, whlMnuPth: `/${id}`, children,
});

const tree: MenuNode[] = [
  header('MHED0002', [leaf('MINF0001', '/info'), leaf('MINF0006', '/budget/list')]),
  header('MHED0001', [leaf('MDOC0001', '/info/documents'), leaf('MDOC0006', '/info/documents/list?status=reviewing')]),
  header('MHED0007', [leaf('MADM0019', '/admin/logs/bbugt')]),
];

describe('resolveActiveHeaderId', () => {
  it('정확히 일치하는 경로의 헤더를 찾는다', () => {
    expect(resolveActiveHeaderId(tree, '/info')).toBe('MHED0002');
  });
  it('가장 긴 접두 경로의 헤더가 우선한다(/info/documents → 사전협의)', () => {
    expect(resolveActiveHeaderId(tree, '/info/documents')).toBe('MHED0001');
    expect(resolveActiveHeaderId(tree, '/info/documents/list')).toBe('MHED0001');
  });
  it('하위 경로 접두 매칭(/budget/list → 사업/예산)', () => {
    expect(resolveActiveHeaderId(tree, '/budget/list')).toBe('MHED0002');
  });
  it('쿼리스트링을 무시하고 매칭한다', () => {
    expect(resolveActiveHeaderId(tree, '/admin/logs/bbugt')).toBe('MHED0007');
  });
  it('매칭이 없으면 첫 번째 헤더로 폴백한다', () => {
    expect(resolveActiveHeaderId(tree, '/unknown/page')).toBe('MHED0002');
  });
  it('빈 트리는 null을 반환한다', () => {
    expect(resolveActiveHeaderId([], '/info')).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실행 — 실패 확인**

Run:
```bash
cd it_frontend && npx vitest run tests/unit/composables/useMenu.test.ts
```
Expected: FAIL — `resolveActiveHeaderId` is not exported / not a function.

- [ ] **Step 3: `useMenu.ts` 구현**

파일 전체를 다음으로 교체한다:
```ts
/**
 * ============================================================================
 * [composables/useMenu.ts] DB 기반 메뉴 트리 단일 소스
 * ============================================================================
 * /api/menus 에서 역할 필터링된 HED-루트 트리를 1회 조회하여
 *  - headers      : 헤더(HED) 루트 목록
 *  - activeHeader : 현재 라우트가 속한 헤더
 *  - sidebarItems : activeHeader의 자식(사이드바 렌더 대상)
 *  - nodeById     : Breadcrumb 경로 라벨 역인덱스
 *  - nodeByPath   : srePth → 노드 역인덱스
 * 를 제공합니다. 순수 헬퍼는 테스트 가능하도록 별도 export 합니다.
 * ============================================================================
 */
import { computed } from 'vue';
import { useApiFetch } from '~/composables/useApiFetch';
import type { MenuNode } from '~/types/menu';

/** 트리를 mnuId → 노드 Map으로 평탄화. */
export function flattenById(tree: MenuNode[]): Map<string, MenuNode> {
  const map = new Map<string, MenuNode>();
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      map.set(n.mnuId, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return map;
}

/** LNK 노드를 srePth → 노드 Map으로 인덱싱 (Breadcrumb 역인덱스). */
export function indexByPath(tree: MenuNode[]): Map<string, MenuNode> {
  const map = new Map<string, MenuNode>();
  const walk = (nodes: MenuNode[]) => {
    for (const n of nodes) {
      if (n.srePth) map.set(n.srePth, n);
      if (n.children?.length) walk(n.children);
    }
  };
  walk(tree);
  return map;
}

/**
 * 현재 경로가 속한 헤더(HED 루트)의 mnuId를 찾는다.
 *
 * 각 헤더 서브트리에서 srePth가 현재 경로의 접두(또는 정확히 일치)인 노드를 찾고,
 * 가장 긴 srePth를 가진 노드의 헤더를 선택한다. (예: '/info/documents'가 '/info'보다 우선)
 * 매칭이 없으면 첫 번째 헤더로 폴백한다. 트리가 비면 null.
 */
export function resolveActiveHeaderId(tree: MenuNode[], path: string): string | null {
  const cleanPath = (path.split('?')[0] ?? path);
  let bestId: string | null = null;
  let bestLen = -1;
  for (const headerNode of tree) {
    const walk = (n: MenuNode) => {
      if (n.srePth) {
        const p = (n.srePth.split('?')[0] ?? n.srePth);
        if ((cleanPath === p || cleanPath.startsWith(p + '/')) && p.length > bestLen) {
          bestLen = p.length;
          bestId = headerNode.mnuId;
        }
      }
      n.children?.forEach(walk);
    };
    walk(headerNode);
  }
  return bestId ?? (tree[0]?.mnuId ?? null);
}

/**
 * 서버 권한 필터링이 적용된 HED-루트 메뉴 트리를 제공한다.
 *
 * 반환값:
 * - tree: `/api/menus` 원본 트리(루트 = 헤더)
 * - headers: 헤더(HED) 루트 목록
 * - activeHeader: 현재 라우트가 속한 헤더 노드(없으면 첫 헤더)
 * - sidebarItems: activeHeader의 자식 목록(사이드바 렌더 대상)
 * - nodeById / nodeByPath: Breadcrumb와 경로 역조회용 인덱스
 * - pending / refresh: Nuxt `useFetch` 호환 조회 상태와 재조회 함수
 *
 * 실패 조건: `useApiFetch`가 401 갱신을 시도한 뒤에도 실패하면 error ref로 전파되며,
 * 호출 화면은 기존 메뉴 상태를 기준으로 fallback UI를 처리해야 한다.
 */
export function useMenu() {
  const config = useRuntimeConfig();
  const route = useRoute();
  const { data, pending, refresh } = useApiFetch<MenuNode[]>(`${config.public.apiBase}/api/menus`);

  const tree = computed<MenuNode[]>(() => data.value ?? []);
  const headers = computed<MenuNode[]>(() => tree.value);
  const activeHeader = computed<MenuNode | null>(() => {
    const id = resolveActiveHeaderId(tree.value, route.path);
    return tree.value.find((h) => h.mnuId === id) ?? null;
  });
  const sidebarItems = computed<MenuNode[]>(() => activeHeader.value?.children ?? []);
  const nodeById = computed(() => flattenById(tree.value));
  const nodeByPath = computed(() => indexByPath(tree.value));

  return { tree, headers, activeHeader, sidebarItems, nodeById, nodeByPath, pending, refresh };
}
```

- [ ] **Step 4: 테스트 실행 — 통과 확인**

Run:
```bash
cd it_frontend && npx vitest run tests/unit/composables/useMenu.test.ts
```
Expected: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
git add it_frontend/app/composables/useMenu.ts it_frontend/app/types/menu.ts it_frontend/tests/unit/composables/useMenu.test.ts
git commit -m "feat(menu): useMenu HED 헤더/활성헤더/사이드바 + resolveActiveHeaderId (프론트)"
```

---

### Task 12: `useAdminMenu` + 관리자 메뉴 페이지 — HED 지원, `sysHrkMnuId` 제거

**Files:**
- Modify: `it_frontend/app/composables/useAdminMenu.ts:12-20`
- Modify: `it_frontend/app/pages/admin/menus/index.vue`

- [ ] **Step 1: `MenuUpsertRequest` 갱신**

`useAdminMenu.ts`의 인터페이스를 다음으로 교체한다:
```ts
export interface MenuUpsertRequest {
  mnuNm: string;
  mnuTpC: 'LNK' | 'GRP' | 'DYN' | 'HED';
  hrkMnuId?: string | null;
  srePth?: string | null;
  hidYn?: string;
  athIds?: string[];
}
```

- [ ] **Step 2: 관리자 페이지의 폼 상태에서 `sysHrkMnuId` 제거**

`admin/menus/index.vue`의 `form` 초기값을:
```ts
const form = ref<MenuUpsertRequest>({ mnuNm: '', sysHrkMnuId: '', mnuTpC: 'LNK', srePth: null, hidYn: 'N', athIds: [] });
```
다음으로 교체한다:
```ts
const form = ref<MenuUpsertRequest>({ mnuNm: '', mnuTpC: 'LNK', srePth: null, hidYn: 'N', athIds: [] });
```

`startNew`의:
```ts
  form.value = { mnuNm: '', sysHrkMnuId: '01', mnuTpC: 'LNK', hrkMnuId: null, srePth: null, hidYn: 'N', athIds: [] };
```
를:
```ts
  form.value = { mnuNm: '', mnuTpC: 'LNK', hrkMnuId: null, srePth: null, hidYn: 'N', athIds: [] };
```

`loadForm`의:
```ts
  form.value = { mnuNm: n.mnuNm, sysHrkMnuId: n.sysHrkMnuId, mnuTpC: n.mnuTpC, hrkMnuId: n.hrkMnuId,
                 srePth: n.srePth, hidYn: n.hidYn, athIds: [] };  // athIds: 읽기 트리 미포함 → 빈 배열 시작
```
를:
```ts
  form.value = { mnuNm: n.mnuNm, mnuTpC: n.mnuTpC, hrkMnuId: n.hrkMnuId,
                 srePth: n.srePth, hidYn: n.hidYn, athIds: [] };  // athIds: 읽기 트리 미포함 → 빈 배열 시작
```

- [ ] **Step 3: 폼 템플릿에서 `시스템상위메뉴ID` 입력 제거 + 유형에 HED 추가**

`admin/menus/index.vue` 템플릿의 다음 블록을 삭제한다:
```html
      <div><label class="block text-sm">시스템상위메뉴ID</label><InputText v-model="form.sysHrkMnuId" class="w-24" /></div>
```

유형 Select의:
```html
        <Select v-model="form.mnuTpC" :options="['LNK', 'GRP', 'DYN']" class="w-40" />
```
를 다음으로 교체한다:
```html
        <Select v-model="form.mnuTpC" :options="['HED', 'GRP', 'LNK', 'DYN']" class="w-40" />
```

- [ ] **Step 4: 타입 체크**

Run:
```bash
cd it_frontend && npm run typecheck
```
Expected: 통과 (이 단계 후 잔존 타입 오류는 Task 13·14 컴포넌트에서 해결).

---

### Task 13: `AppHeader.vue` — DB 기반 헤더 렌더

**Files:**
- Modify: `it_frontend/app/components/AppHeader.vue` (script: navItems/isActive 영역 31~56행, 템플릿 nav 블록 227~239행)

- [ ] **Step 1: script의 헤더 로직 교체**

`AppHeader.vue`의 `<script setup>`에서 `isAdmin`/`NavItem`/`navItems`/`isActive` 영역(현재 31~56행)을 다음으로 교체한다. (`useAuth`/`IconCrown` import는 유지.)

기존:
```ts
// 시스템관리자 여부 (ITPAD001 역할 보유 시 [관리자] 메뉴 표시)
const isAdmin = computed(() => user.value?.athIds?.includes(ROLE.ADMIN));

interface NavItem {
    label: string;
    route: string;
    activePrefix: string;
    excludePrefix?: string;
    adminIcon?: boolean;
}

/** 단순 네비게이션 메뉴 목록 */
const navItems = computed<NavItem[]>(() => [
    { label: '사전협의', route: '/info/documents', activePrefix: '/info/documents' },
    { label: '사업·예산', route: '/info', activePrefix: '/info', excludePrefix: '/info/documents' },
    { label: 'IT·AI CDP', route: '/cdp', activePrefix: '/cdp' },
    { label: 'IT자체감사', route: '/audit', activePrefix: '/audit' },
    { label: '전자결재', route: '/approval', activePrefix: '/approval' },
    { label: '게시판', route: '/board', activePrefix: '/board' },
    ...(isAdmin.value ? [{ label: '관리자', route: '/admin/codes', activePrefix: '/admin', adminIcon: true }] : [])
]);

/** 현재 경로가 메뉴 항목의 활성 경로에 해당하는지 확인 (excludePrefix가 있으면 해당 경로 제외) */
const isActive = (item: NavItem) =>
    route.path.startsWith(item.activePrefix) &&
    !(item.excludePrefix && route.path.startsWith(item.excludePrefix));
```

교체:
```ts
import { useMenu } from '~/composables/useMenu';
import type { MenuNode } from '~/types/menu';

/** 관리자 헤더 MNU_ID. 마이그레이션 006 시드와 일치 — 왕관 아이콘 표시 판정용. */
const ADMIN_HEADER_MNU_ID = 'MHED0007';

// DB 기반 헤더 목록(HED 루트)과 현재 활성 헤더. 권한 필터링은 서버 /api/menus 가 수행한다.
const { headers, activeHeader } = useMenu();

/** 헤더가 현재 활성 상태인지 */
const isActive = (item: MenuNode) => activeHeader.value?.mnuId === item.mnuId;

/** 헤더 클릭 시 이동할 첫 번째 화면 경로(깊이 우선 탐색). */
const firstTarget = (item: MenuNode): string | undefined => {
    if (item.srePth) return item.srePth;
    for (const child of item.children ?? []) {
        const t = firstTarget(child);
        if (t) return t;
    }
    return undefined;
};

/** 헤더 클릭 → 해당 헤더의 첫 화면으로 이동. */
const onHeaderClick = (item: MenuNode) => {
    const target = firstTarget(item);
    if (target) navigateTo(target);
};
```

> `useAuth`의 `user`는 로그아웃/사용자 표시에서 계속 사용되므로 `const { user, logout } = useAuth();`는 유지한다. `ROLE` import가 더 이상 사용되지 않으면 import 줄(`import { ROLE } from '~/types/auth';`)을 제거한다(typecheck/lint의 미사용 경고로 확인).

- [ ] **Step 2: 템플릿 nav 블록 교체**

템플릿의 `<nav>` 블록(현재 227~239행)을 다음으로 교체한다:
```html
            <nav class="flex items-center flex-1 gap-6">
                <button
                    v-for="item in headers"
                    :key="item.mnuId"
                    class="flex items-center px-4 py-2 font-semibold text-base whitespace-nowrap transition-colors hover:bg-indigo-50 dark:hover:bg-indigo-800/50 hover:text-indigo-600 dark:hover:text-indigo-400"
                    :class="isActive(item)
                        ? 'border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400'
                        : 'text-zinc-700 dark:text-zinc-200'"
                    @click="onHeaderClick(item)">
                    <span>{{ item.mnuNm }}</span>
                    <IconCrown v-if="item.mnuId === ADMIN_HEADER_MNU_ID" class="w-4 h-4 ml-1.5 text-yellow-500" />
                </button>
            </nav>
```

> `ADMIN_HEADER_MNU_ID`는 Step 1에서 `<script setup>` 최상위에 선언되므로 템플릿에서 접근 가능하다.

---

### Task 14: `AppSidebar.vue` — `sidebarItems` 사용

**Files:**
- Modify: `it_frontend/app/components/AppSidebar.vue:37` (useMenu 구조분해), `:101-108` (context computed 제거), `:155` (menuItems)

- [ ] **Step 1: `useMenu` 구조분해 교체**

`AppSidebar.vue:37`의:
```ts
const { treeByContext } = useMenu();
```
를:
```ts
const { sidebarItems } = useMenu();
```

- [ ] **Step 2: 라우트 prefix 컨텍스트 computed 제거**

다음 블록(현재 101~108행)을 삭제한다:
```ts
const context = computed(() => {
    if (route.path.startsWith('/info/documents')) return 'documents';
    if (route.path.startsWith('/approval')) return 'approval';
    if (route.path.startsWith('/audit')) return 'audit';
    if (route.path.startsWith('/admin')) return 'admin';
    if (route.path.startsWith('/board')) return 'board';
    return 'info';
});
```

> `const route = useRoute();`(62행)는 배지 폴링 `watch(() => route.fullPath, ...)`와 `isSubItemActive`에서 계속 사용하므로 유지한다.

- [ ] **Step 3: `menuItems` 소스 교체**

`AppSidebar.vue:155`의:
```ts
const menuItems = computed<MenuNode[]>(() => treeByContext.value[context.value] ?? []);
```
를:
```ts
// activeHeader의 자식(구 루트들)을 사이드바 메뉴로 렌더링한다. 아이콘/배지/DYN 게시판은 서버+규약 맵 소관.
const menuItems = computed<MenuNode[]>(() => sidebarItems.value);
```

> 사이드바 렌더 템플릿은 변경 불필요하다. `menuItems`는 여전히 "헤더의 자식"(=기존 컨텍스트 루트 집합)이므로 기존 3단 렌더 구조와 동일한 형태를 유지한다.

---

### Task 15: `menuPresentation.ts` — HED + CDP 아이콘 추가

**Files:**
- Modify: `it_frontend/app/utils/menuPresentation.ts` (MENU_ICON 객체)

- [ ] **Step 1: HED·CDP 아이콘 항목 추가**

`MENU_ICON` 객체 시작부(`export const MENU_ICON: Record<string, string> = {` 다음 줄)에 헤더·CDP 아이콘을 추가한다:
```ts
  // 헤더(HED) 계층
  MHED0001: 'pi pi-file-check',   // 사전협의
  MHED0002: 'pi pi-wallet',       // 사업/예산
  MHED0003: 'pi pi-sparkles',     // IT/AI CDP
  MHED0004: 'pi pi-check-square', // IT자체감사
  MHED0005: 'pi pi-send',         // 전자결재
  MHED0006: 'pi pi-comments',     // 게시판
  MHED0007: 'pi pi-cog',          // 관리자
  // IT/AI CDP 플레이스홀더
  MCDP0001: 'pi pi-clock',
```

> 기존 MNU_ID 항목은 변경하지 않는다(노드 ID 불변).

---

### Task 16: `/cdp` 준비중 페이지 생성

**Files:**
- Create: `it_frontend/app/pages/cdp/index.vue`

- [ ] **Step 1: 페이지 작성**

Create `it_frontend/app/pages/cdp/index.vue`:
```vue
<!--
================================================================================
[pages/cdp/index.vue] IT/AI CDP 준비중 안내 페이지
================================================================================
IT/AI CDP 헤더의 플레이스홀더 화면입니다(메뉴 MCDP0001 → /cdp).
실제 CDP 콘텐츠가 추가되기 전까지 준비중 안내를 노출합니다.
================================================================================
-->
<script setup lang="ts">
// 인증된 모든 사용자 접근 가능(전역 auth 미들웨어). 별도 권한 가드 없음.
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24 text-center">
    <i class="pi pi-sparkles text-5xl text-indigo-400 mb-4" />
    <h1 class="text-2xl font-bold text-zinc-800 dark:text-zinc-100">IT/AI CDP</h1>
    <p class="mt-2 text-zinc-500 dark:text-zinc-400">준비 중인 메뉴입니다. 곧 제공될 예정입니다.</p>
  </div>
</template>
```

- [ ] **Step 2: 검증 + 커밋 (Task 12~16 프론트 변경 일괄)**

Run 먼저 검증:
```bash
cd it_frontend && npm run check && npm test
```
Expected: typecheck/lint 통과, 단위 테스트 통과.

```bash
git add it_frontend/app it_frontend/tests
git commit -m "feat(menu): DB 기반 헤더/사이드바 + CDP 준비중 페이지 + 관리자 HED 편집 (프론트)"
```

---

### Task 17: 통합 스모크 검증 (수동)

**Files:** 없음 (실행 검증만)

- [ ] **Step 1: 두 서버 기동**

Run:
```powershell
# 터미널 1
cd it_backend; ./gradlew bootRun
# 터미널 2
cd it_frontend; npm run dev
```
Expected: 백엔드가 `ddl-auto=validate`를 통과하여 정상 기동(엔티티 ↔ 스키마 일치). 프론트 http://localhost:3000 기동.

- [ ] **Step 2: 헤더/사이드바 동작 확인 (일반 사용자)**

`/info`로 로그인 후:
- 헤더에 `사전협의·사업/예산·IT/AI CDP·IT자체감사·전자결재·게시판` 6개 탭 노출, `관리자` 미노출.
- `IT/AI CDP` 클릭 → `/cdp` 진입, "준비 중" 안내 + 사이드바에 "준비중" 링크 표시.
- `사업/예산` 클릭 → 사이드바에 전산예산/정보화사업 등 노출.
- `/info/documents` 진입 시 `사전협의` 헤더가 활성(밑줄)로 표시.

- [ ] **Step 3: 관리자 확인**

관리자(ITPAD001)로 로그인:
- 헤더에 `관리자` 탭(왕관 아이콘) 추가 노출. 클릭 시 관리자 첫 화면 진입, 사이드바에 데이터/콘텐츠/이력·보안/상세로그 노출.
- `/admin/menus`에서 트리에 HED 7개가 최상위로 보이고, 유형 Select에 `HED` 옵션이 있으며 `시스템상위메뉴ID` 입력이 없는지 확인.
- Breadcrumb이 `관리자 > 상세 로그 > 전산예산 > 예산 작업·편성 결과` 형태로 헤더부터 표시되는지 확인(`/admin/logs/bbugt`).

- [ ] **Step 4: 이상 시 회귀 점검**

증상별 점검 포인트:
- 사이드바가 비어 보임 → `GET /api/menus` 응답이 HED 루트 트리인지(Network 탭), `resolveActiveHeaderId` 폴백 확인.
- 관리자 헤더가 일반 사용자에게 보임 → 마이그레이션 006의 `MHED0007↔ITPAD001` 매핑과 `MenuQueryService.prune`의 HED 포함 여부 확인.

---

## Self-Review 결과

- **스펙 커버리지:** §3 데이터 모델→Task 1·2·3, §4 마이그레이션→Task 1~3, §5 백엔드→Task 4~9, §6 프론트→Task 10~16, §7 엣지/§8 테스트→Task 9·11·17. 모든 섹션이 태스크에 매핑됨.
- **플레이스홀더:** 없음(모든 코드/SQL/명령 실제값).
- **타입 일관성:** `MenuNode.mnuTpC`(LNK/GRP/DYN/HED), `MenuUpsertRequest`(sysHrkMnuId 제거), `resolveActiveHeaderId(tree,path)` 시그니처가 사용처(useMenu/테스트)와 일치. `ADMIN_HEADER_MNU_ID`='MHED0007'와 마이그레이션 006의 관리자 헤더 ID 일치. `BOARD_HEADER_MNU_ID`='MHED0006'와 게시판 헤더 ID 일치.
- **실행 순서:** 백엔드 코드 → 마이그레이션 005·006·007 → 기동 순서를 상단에 명시(validate 충돌 방지).
```
