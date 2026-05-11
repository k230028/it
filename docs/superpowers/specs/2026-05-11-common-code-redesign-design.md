# 공통코드 체계 개선 설계 (TAAABB_CCODEM 재정의)

- 작성일: 2026-05-11
- 작성자: brainstorming 세션 (사용자 협업)
- 영향 범위: DB(`TAAABB_CCODEM`, `TAAABB_CCODEL` + 다운스트림 FK 컬럼 다수), `it_backend` 공통코드 도메인, `it_frontend` 공통코드 호출부 전반
- 전략: **빅뱅(Big Bang) 일괄 전환 · 단일 PR · 단일 운영 점검창**
- 후속: 본 설계 승인 후 `writing-plans` 스킬로 구현 계획 문서 작성

---

## 1. 배경 & 목표

### 1.1 현행 구조와 한계

| 항목 | 현행 |
|------|------|
| 테이블 | `TAAABB_CCODEM` |
| PK | (`C_ID`, `STT_DT`) |
| `C_ID` 값 예시 | `CUR-001`, `PRJ_TP_001`, `BG-RQS-STA` (Dash/Underbar 혼재) |
| `C_NM` | 코드 표시명 (예: `USD`) |
| `CDVA` | 코드값 (예: `1400` 환율) |
| `C_DES` | 행별 설명 (예: `미화`) |
| `CTT_TP` | 코드값구분 (예: `CUR`) — 사실상 카테고리 |
| `CTT_TP_DES` | 카테고리 설명 (예: `환율`) |

문제점:
1. `C_ID`가 "카테고리+값"을 합성한 단일 문자열이라 카테고리/값 분리가 모호.
2. `Dash(-)`와 `Underbar(_)`가 데이터·코드 양쪽에서 혼재.
3. 상위-하위 코드 관계(예: 전산여비 > 국내출장)를 표현할 컬럼이 없음.

### 1.2 목표

- 코드(코드ID) = **컬럼/엔티티 이름** (예: `CUR`, `PRJ_TP`)
- 코드값 = 코드 내 식별자 (예: `001`, `002`, `STA`, `END`)
- 표시명/설명/하위구분/상위코드를 명시적 컬럼으로 분리
- 코드 식별자 표기를 `Underbar(_)` 단일 컨벤션으로 통일

---

## 2. 의사결정 요약

| 결정사항 | 채택안 |
|---------|--------|
| 신구 컬럼 매핑 의미 | PRD 문구 그대로 (C_NM=옛 CDVA, C_DES=옛 CTT_TP_DES, CDVA_DTL=옛 C_NM) |
| 효력일자 운영 | 코드값별 시점 버전 관리 유지 — PK = (C_ID, CDVA, STT_DT) |
| 다운스트림 FK 저장 형식 | CDVA만 저장 (컬럼명이 C_ID 역할) — 예: `Bprojm.PRJ_TP = '001'` |
| 설정형 코드(BG_RQS) | C_ID=BG_RQS, CDVA=STA/END (알파별칭 허용) |
| 마이그레이션 전략 | 빅뱅 일괄 전환 (단일 PR · 단일 점검창) |
| API 응답/URL | `GET /api/ccodem/{cId}`, `/{cId}/{cdva}` — cdId 폐기, cId+cdva 분리 |
| HRK_C 형식 | `{C_ID}_{CDVA}` 합성 문자열 (cross-category 참조 허용) |
| Java 필드 정렬 | 전체 정합 (cttTp → cTp 등 필드명도 rename) |

---

## 3. 데이터 모델

### 3.1 신규 `TAAABB_CCODEM`

| 컬럼 | 타입 | NULL | PK | 주석 / 비고 |
|------|------|------|----|------------|
| C_ID | VARCHAR2(32) | N | ✓ | 코드ID. prefix만, `_` 통일 (예: `CUR`, `PRJ_TP`, `BG_RQS`) |
| CDVA | VARCHAR2(32) | N | ✓ | 코드값. 숫자형(`001`) 또는 별칭(`STA`/`END`) |
| STT_DT | DATE | N | ✓ | 시작일자 (시점 버전 PK) |
| END_DT | DATE | Y | | 종료일자 |
| C_NM | VARCHAR2(100) | Y | | 코드명. **옛 CDVA 값** (예: `1400`, `신규개발`) |
| C_DES | VARCHAR2(500) | Y | | 코드설명. **옛 CTT_TP_DES** (예: `환율`, `사업유형`) |
| CDVA_DTL | VARCHAR2(100) | Y | | 코드값상세. **옛 C_NM** (예: `USD`) |
| C_TP | VARCHAR2(100) | Y | | 코드타입. **옛 CTT_TP rename**, (C_ID,CDVA) 내 추가구분용 |
| C_TP_DES | VARCHAR2(500) | Y | | 코드타입설명. **옛 CTT_TP_DES rename** |
| HRK_C | VARCHAR2(65) | Y | | 상위코드. `{C_ID}_{CDVA}` 합성 문자열(최대 32+1+32). cross-category 허용 |
| C_SQN | NUMBER | Y | | 코드순서 |
| + BaseEntity 공통컬럼 | | | | DEL_YN, GUID, FST_ENR_DTM/USID, LST_CHG_DTM/USID |

**보조 인덱스 권장:**
- `IDX_CCODEM_CID_VALID (C_ID, DEL_YN, STT_DT, END_DT)` — 카테고리 다건 조회용
- `IDX_CCODEM_HRK_C (HRK_C)` — 자식 코드 역조회용 (도입 후 수요 발생 시)

### 3.2 신규 `TAAABB_CCODEL` (변경 로그)

`BaseLogEntity`를 상속하므로 자체 PK는 자동 채번 컬럼이 별도. 비즈니스 컬럼은 마스터와 동일 셋(CDVA_DTL, C_TP, C_TP_DES, HRK_C 추가 + CTT_TP/CTT_TP_DES 제거).

### 3.3 변환 매핑 매트릭스 (옛 → 신규)

| 신규 컬럼 | 변환 규칙 |
|----------|-----------|
| C_ID | `REPLACE(old.C_ID, '-', '_')` 후 `REGEXP_REPLACE('_[A-Z0-9]+$', '')` |
| CDVA | `REGEXP_SUBSTR(REPLACE(old.C_ID,'-','_'), '[A-Z0-9]+$')` |
| C_NM | `old.CDVA` |
| C_DES | `old.CTT_TP_DES` |
| CDVA_DTL | `old.C_NM` |
| C_TP | `old.CTT_TP` (대다수는 NULL이 될 가능성, 단순 rename 보존) |
| C_TP_DES | `old.CTT_TP_DES` (필요시 NULL로 정리) |
| HRK_C | NULL (이번 회차에는 빈 값. 후속 도메인 합의 후 UPDATE) |
| C_SQN | `old.C_SQN` |
| STT_DT / END_DT | 동일 |

**예시 — USD 환율 행 변환**
```
이전: C_ID=CUR-001, C_NM=USD, CDVA=1400, C_DES=미화,
      CTT_TP=CUR, CTT_TP_DES=환율
이후: C_ID=CUR, CDVA=001, C_NM=1400, C_DES=환율,
      CDVA_DTL=USD, C_TP=NULL, C_TP_DES=NULL, HRK_C=NULL
```

**예시 — 예산신청기간 행 변환**
```
이전: C_ID=BG-RQS-STA, C_NM=시작일자, CDVA=2026-04-15, ...
이후: C_ID=BG_RQS, CDVA=STA, C_NM=2026-04-15, C_DES=예산신청기간, ...
```

---

## 4. Flyway 마이그레이션 파일

### 4.1 파일 분할

> 파일명의 `V20260512`는 가상의 적용 예정일(D-day)을 표기한 예시이며, 실제 적용일은 PR 작성·운영 점검창 일정 확정 시점에 동기 갱신한다.

```
V20260512_001__ccodem_v2_schema.sql        -- 신규 TAAABB_CCODEM_V2 생성
V20260512_002__ccodel_v2_schema.sql        -- 신규 TAAABB_CCODEL_V2 생성
V20260512_003__ccodem_v2_data_load.sql     -- 변환 INSERT + 로그 INSERT
V20260512_004__ccodem_v2_data_verify.sql   -- 사전 검증 쿼리 (실패 시 RAISE)
V20260512_005__downstream_fk_data.sql      -- 다운스트림 FK 'PRJ_TP_001' → '001' 일괄 UPDATE
V20260512_006__rename_swap.sql             -- TAAABB_CCODEM → _OLD, _V2 → 정식명
V20260512_007__rename_swap_log.sql         -- TAAABB_CCODEL → _OLD, _V2 → 정식명
```

**스왑 방식 선택 이유:** PK 변경 + 데이터 변환 + 로그 정합을 한 in-place ALTER로 보장하기 어렵다. 신규 테이블에 변환 INSERT → swap 방식은 단순하고 롤백 가능.

### 4.2 사전 검증 쿼리

```sql
-- 신규 PK 중복 후보 탐지 (반드시 0건이어야 진행 가능)
SELECT prefix, postfix, stt_dt, COUNT(*)
  FROM (SELECT REGEXP_REPLACE(REPLACE(C_ID,'-','_'), '_[A-Z0-9]+$', '') prefix,
               REGEXP_SUBSTR(REPLACE(C_ID,'-','_'), '[A-Z0-9]+$')        postfix,
               STT_DT
          FROM TAAABB_CCODEM
         WHERE DEL_YN = 'N')
 GROUP BY prefix, postfix, stt_dt
HAVING COUNT(*) > 1;

-- 다운스트림 FK dangling 검출 (PRJ_TP 예시 — 컬럼별 반복 필요)
SELECT DISTINCT p.PRJ_TP
  FROM TAAABB_BPROJM p
 WHERE p.PRJ_TP IS NOT NULL
   AND p.PRJ_TP NOT IN (
     SELECT REGEXP_SUBSTR(REPLACE(c.C_ID,'-','_'), '[A-Z0-9]+$')
       FROM TAAABB_CCODEM c
      WHERE REGEXP_REPLACE(REPLACE(c.C_ID,'-','_'), '_[A-Z0-9]+$', '') = 'PRJ_TP'
        AND c.DEL_YN = 'N');
```

검증 결과 0건이 아니면 스크립트 내 `RAISE_APPLICATION_ERROR`로 즉시 실패시켜 마이그레이션 중단.

### 4.3 변경 로그(`CCODEL_V2`) 정합

마이그레이션은 `ChangeLogEntityListener`를 우회하므로 자동 로그가 남지 않는다. `V20260512_003`에서 변환된 모든 행에 대해 동일 트랜잭션 내에 1건씩 `INSERT INTO TAAABB_CCODEL_V2`를 수행하고 변경 사유 컬럼에 `'SCHEMA_MIGRATION_20260512'`를 기록한다.

---

## 5. 백엔드 변경

### 5.1 엔티티

**`CcodemId` — 복합키 3개로 확장**
```java
public class CcodemId implements Serializable {
    private String cId;
    private String cdva;
    private LocalDate sttDt;
}
```

**`Ccodem` — 신규 필드 + rename**
```java
@Id @Column(name="C_ID",  length=32, nullable=false) private String cId;
@Id @Column(name="CDVA",  length=32, nullable=false) private String cdva;
@Id @Column(name="STT_DT",           nullable=false) private LocalDate sttDt;

@Column(name="C_NM",     length=100) private String cNm;
@Column(name="C_DES",    length=500) private String cDes;
@Column(name="CDVA_DTL", length=100) private String cdvaDtl;
@Column(name="C_TP",     length=100) private String cTp;
@Column(name="C_TP_DES", length=500) private String cTpDes;
@Column(name="HRK_C",    length=67)  private String hrkC;
@Column(name="C_SQN")                private Integer cSqn;
@Column(name="END_DT")               private LocalDate endDt;
```

`update()` 메서드 시그니처도 신규 필드 셋으로 재작성.

### 5.2 Repository

```java
public interface CodeRepository extends JpaRepository<Ccodem, CcodemId>, CodeRepositoryCustom {
    boolean existsByCIdAndCdvaAndSttDt(String cId, String cdva, LocalDate sttDt);
}

public interface CodeRepositoryCustom {
    Optional<Ccodem> findByCIdAndCdvaWithValidDate(String cId, String cdva, LocalDate targetDate);
    List<Ccodem>     findByCIdWithValidDate(String cId, LocalDate targetDate);  // 카테고리 다건
    List<Ccodem>     findChildrenOfHrkC(String hrkC);                            // 자식 역조회
    List<Ccodem>     findAllActive();
}
```

QueryDSL 구현(`CodeRepositoryImpl`)에서 `qCcodem.cId.eq` + `qCcodem.cdva.eq` 조건을 적절히 적용.

### 5.3 Service

```java
@Cacheable(value="codesByCid", key="#p0")
public List<Ccodem> findCodeEntitiesByCId(String cId) { ... }

public CodeDto.Response       getCcodem(String cId, String cdva, LocalDate targetDate);
public List<CodeDto.Response> getCcodemsByCId(String cId, LocalDate targetDate);

@Cacheable("budgetPeriod")
public CodeDto.BudgetPeriodResponse getBudgetPeriod() {
    var sta = codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS","STA",null).orElseThrow(...);
    var end = codeRepository.findByCIdAndCdvaWithValidDate("BG_RQS","END",null).orElseThrow(...);
    return BudgetPeriodResponse.builder()
        .startDate(sta.getCNm())   // 날짜는 C_NM에 저장
        .endDate(end.getCNm())
        .build();
}
```

캐시 키 `codesByType` → `codesByCid` 교체. evict도 동일.

### 5.4 DTO

```java
class Response {
    String cId;        // 옛 cdId 폐기
    String cdva;
    String cNm;
    String cDes;
    String cdvaDtl;
    String cTp;        // 옛 cttTp 폐기
    String cTpDes;
    String hrkC;
    Integer cSqn;
    LocalDate sttDt;
    LocalDate endDt;
    // + BaseEntity 감사 필드 (delYn, fstEnrDtm, fstEnrUsid, lstChgDtm, lstChgUsid)
}
class CreateRequest { /* 동일 필드 셋 */ }
class UpdateRequest { /* sttDt는 PathVariable/Query, 본문에서는 미수정 */ }
```

### 5.5 Controller

```
GET    /api/ccodem/{cId}                                 → List<Response>  (카테고리 다건)
GET    /api/ccodem/{cId}/{cdva}                          → Response         (단건)
GET    /api/ccodem/budget-period                         → BudgetPeriodResponse
POST   /api/ccodem                                       → 201 Created
PUT    /api/ccodem/{cId}/{cdva}?sttDt=YYYY-MM-DD         → 200 OK
DELETE /api/ccodem/{cId}/{cdva}?sttDt=YYYY-MM-DD         → 204 No Content
```

관리자 화면용 `/api/admin/codes` 동일하게 (cId, cdva) 복합 식별로 교체.

### 5.6 로그 엔티티 (`CcodemL`)

마스터와 동일 신규 컬럼 셋 반영. `ChangeLogEntityListener`가 자동 변경 로그를 기록하므로 별도 트리거 변경 없음.

### 5.7 영향 받는 파일

- `common/code/entity/Ccodem.java`, `CcodemId.java`
- `domain/log/entity/CcodemL.java`
- `common/code/repository/CodeRepository.java`, `CodeRepositoryCustom.java`, `CodeRepositoryImpl.java`
- `common/code/service/CodeService.java`
- `common/code/controller/CodeController.java`
- `common/code/dto/CodeDto.java`
- 테스트: `src/test/.../code/service/CodeServiceTest.java`
- 관리자: `common/admin/service/AdminService.java`, `common/admin/controller/AdminController.java` 내 코드 CRUD

---

## 6. 프론트엔드 변경

### 6.1 `composables/useCodeOptions.ts`

```ts
export interface CodeOption {
    cId:  string;
    cdva: string;
    cNm:  string;
    cDes?: string | null;
    cdvaDtl?: string | null;
    cTp?: string | null;
    cTpDes?: string | null;
    hrkC?: string | null;
    cSqn?: number | null;
}

export const useCodeOptions = (cId: string) => {
    const config = useRuntimeConfig();
    const url = `${config.public.apiBase}/api/ccodem/${cId}`;
    const { data } = useApiFetch<CodeOption[]>(url);

    const options = computed(() =>
        [...(data.value ?? [])].sort(
            (a, b) => (a.cSqn ?? Infinity) - (b.cSqn ?? Infinity)
        )
    );

    const getCodeName = (cdva: string | null | undefined): string => {
        if (!cdva) return '-';
        const found = options.value.find(o => o.cdva === cdva);
        return found ? found.cNm : cdva;
    };

    return { options, getCodeName };
};
```

호출부 변경 패턴:
- DB FK 컬럼이 `'PRJ_TP_001'` → `'001'`로 변환되므로 `getCodeName(form.value.prjTp)`는 그대로 동작.
- 옵션의 `opts[0]!.cdId`를 폼에 직접 박는 코드는 `opts[0]!.cdva`로 교체.
- `opt.cdId === val` 비교는 `opt.cdva === val`로 교체.

### 6.2 `composables/useAdminApi.ts`

```ts
export interface AdminCodeResponse {
    cId: string; cdva: string;
    cNm?: string; cDes?: string;
    cdvaDtl?: string; cTp?: string; cTpDes?: string; hrkC?: string;
    cSqn?: number;
    sttDt?: string; endDt?: string;
    // BaseEntity 감사 필드
}

updateCode(cId: string, cdva: string, sttDt: string, payload: AdminCodeRequest)
deleteCode(cId: string, cdva: string, sttDt: string)
```

`pages/admin/codes.vue`의 `onBatchSave`/`deleteCode` 호출 인자 (cdId) → (cId, cdva) 분리로 교체.

### 6.3 주요 호출부 일괄 교체 대상

- `pages/info/projects/form.vue`, `pages/info/projects/[id].vue`
- `pages/info/cost/form.vue`, `pages/info/cost/index.vue`
- `components/cost/TerminalTableSection.vue`, `TerminalFormDialog.vue`, `CostFormTableSection.vue`
- `composables/useCostListPage.ts`, `useBudgetStatusCostTab.ts`, `useCouncilCodes.ts`, `useCurrencyRates.ts`
- `pages/budget/work.vue`, `components/budget/BudgetSummaryCards.vue`, `components/plan/PlanExpenseCostCard.vue`
- `pages/admin/codes.vue`

### 6.4 테스트 mock 갱신

`tests/unit/composables/useCodeOptions.test.ts`, `useCouncilCodes.test.ts`, `useCurrencyRates.test.ts`, `useAdminApi.test.ts`, `useBudgetStatusCostTab.test.ts` 등의 mock 응답을 `{ cdId, cdNm }` 형식에서 `{ cId, cdva, cNm }` 형식으로 일괄 교체.

### 6.5 관리자 화면 (`pages/admin/codes.vue`)

- 그리드 컬럼 분할: `cdId` 단일 컬럼 → `C_ID`, `CDVA` 두 컬럼
- 신규 표시 컬럼: `CDVA_DTL`, `C_TP`, `C_TP_DES`, `HRK_C`
- 행 추가 다이얼로그 필드 동일 분리/추가
- 엑셀 일괄 업로드(`bulkUpsertCodes`) 템플릿 헤더 갱신

---

## 7. 롤아웃 · QA · 롤백

### 7.1 실행 순서

```
D-3  운영 DB 사본으로 마이그레이션 리허설 1회
D-2  사전 검증 쿼리를 운영 DB에 read-only 실행 → 충돌 0건 확인
D-1  운영 백업 + 다운스트림 FK 변환 대상 행수 카운트 보관

T-0  점검 모드 진입 (사용자 차단)
T+0  Flyway V20260512_001~007 일괄 적용
T+1  백엔드 신규 jar 배포 (./gradlew clean build → bootRun)
T+2  프론트 신규 빌드 배포 (npm run generate)
T+3  스모크 테스트 체크리스트 수행 (§7.3)
T+4  점검 모드 해제

T+24 24시간 모니터링 후 _OLD 테이블 제거 결정 (실제 DROP은 D+30)
```

### 7.2 롤백

**발동 조건:**
- 스모크 테스트 중 코드 변환 오류 발생
- 백엔드 부팅 실패 (JPA 매핑/`EnvironmentValidator` 오류)
- 사전 검증으로 잡지 못한 PK 중복이 INSERT 단계에서 노출

**절차:**
- `V20260512_006/007`을 역방향으로 실행하는 `Vundo*` SQL을 사전 작성·배포 패키지에 포함
- 신/구 jar·dist는 점검 직전 버전을 별도 보관 디렉토리에 두고 swap

### 7.3 스모크 테스트 체크리스트

| 영역 | 시나리오 | 확인 포인트 |
|------|---------|------------|
| 관리자 공통코드 | `/admin/codes` 진입, 행 수정 1건 저장 | C_ID/CDVA 분리 표시, 저장 성공 |
| 사업등록 폼 | `/info/projects/form` 진입 | PRJ_TP/BZ_DTT/PUL_DTT/CUR 드롭다운 정상 |
| 사업상세 | `/info/projects/[id]` | `getCodeName` 변환 결과 한글로 표시 |
| 예산현황 | `/budget/status` | 분류 탭 코드명 한글 변환 |
| 예산신청 | 신청 가능 기간 검증 | `BG_RQS/STA`, `BG_RQS/END` 조회 동작 |
| 결재함 | `/budget/approval` | 사업유형/상태 코드명 변환 |

### 7.4 자동 QA

- 점검창 직전: `./gradlew clean test` + `npm test` + `npm run test:e2e` (사전협의/예산현황/사업폼 핵심 시나리오)
- 점검창 내: `/gstack qa` 또는 `/qa`로 로그인→사업조회→공통코드 변환 화면 자동 스캔
- 점검창 직후: 24시간 동안 백엔드 `WARN` 이상 로그 모니터링, 코드 변환 실패 0건 확인

---

## 8. 후속 과제 (TASK.md 등록)

1. **HRK_C 데이터 확정** — 도메인별(전산여비/비목/조직 등) 부모-자식 관계 정의 워크숍 후 별도 UPDATE 마이그레이션
2. **C_TP / C_TP_DES 정리** — 카테고리화 후 실제로 사용처가 있는 코드 식별. 사용처 없으면 다음 회차에 컬럼 제거 검토
3. **_OLD 테이블 DROP** — 무사고 30일 경과 시 `TAAABB_CCODEM_OLD`/`_CCODEL_OLD` 제거

---

## 9. 비범위 (Out of Scope)

- 코드 검색 화면의 UX 개선
- 코드 권한 분리 (어떤 코드는 누가 편집 가능한지)
- 다국어 코드명 지원
- 다단계 계층(2단계 이상) 자동 펼침 UI — HRK_C는 1단계만 사용 권장, 다단계는 재귀 조회로 가능하나 본 회차 미구현

---

## 10. 다음 단계

본 설계 승인 후 `writing-plans` 스킬을 호출하여 다음을 산출:
- 단계별 작업 항목과 실행 순서
- 각 단계의 검증 기준 (테스트/스모크)
- 점검창 타임라인 (D-3 ~ T+24h)
- 롤백 의사결정 트리
