# Plan: DB 컬럼명 도메인 표준화 마이그레이션

## Executive Summary

| 항목 | 내용 |
|------|------|
| Feature | column-domain-standardization |
| 작성일 | 2026-05-18 |
| 대상 | Oracle DB 전체 테이블 + JPA 엔티티 49개 + 관련 DTO/Repository/Frontend 타입 |
| SoT 기준 | [C:\it\DOMAIN.md](../../../DOMAIN.md) |

### Value Delivered (4관점)

| 관점 | 내용 |
|------|------|
| Problem | 컬럼명에 도메인 접미사가 비일관 적용되어 데이터 타입·길이·의미를 추론하기 어렵고, 신규 컬럼 작성 시 표준이 불명확함 |
| Solution | `***_<도메인물리명>` 접미사 강제 + 도메인별 데이터 타입/길이/정밀도 통일 |
| Function/UX Effect | API/화면은 컬럼 alias로 영향 최소화. JPA 매핑·DTO만 일괄 변경 |
| Core Value | DOMAIN.md를 SoT로 하는 컬럼 표준 수립 → 향후 신규 테이블/컬럼 추가 시 자동 검증 가능 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 컬럼명 접미사·타입 불일치 누적 (`XCR` vs `XCR_RT`, `GCL_QTT` vs `GCL_QTY`, `IOE_C` 등) → 도메인 명세 일원화 필요 |
| WHO | IT Portal 백엔드(Spring Boot 4 / JPA), 프론트엔드(Nuxt 4 TS 타입), DBA |
| RISK | (1) 컬럼 RENAME 시 미반영 쿼리/리포트 깨짐 (2) NUMBER 정밀도 축소 시 데이터 손실 (3) 운영 무중단 배포 어려움 |
| SUCCESS | `./gradlew test` + `npm run typecheck` 통과, Flyway 마이그레이션 멱등 실행, QA 회귀 0건 |
| SCOPE | 49 entities × ~475 `@Column` / Oracle DDL / FK·인덱스 / 프론트 응답 DTO 키 |
| OUT OF SCOPE | 테이블명 변경, 시퀀스 명명, 로그 테이블 스키마 변경(이미 표준화됨) |

---

## 1. 표준 규칙 (DOMAIN.md 추출)

### 1.1 접미사 명명 규칙

```
<의미부>_<도메인물리명>
```

- `<의미부>` : 의미 토큰 (예: `GCL`, `PRJ`, `BG_FDTN`)
- `<도메인물리명>` : DOMAIN.md `도메인물리명` 칼럼 값 (예: `AMT`, `DT`, `NM`, `YN`, `RT`)
- 복합키/FK 컬럼도 동일 규칙 (`PRJ_MNG_NO` → `_NO`는 번호 도메인)

### 1.2 도메인 그룹 → 표준 타입 매핑

| 도메인 그룹 | 대표 물리명 | Oracle 타입 | 비고 |
|-------------|------------|-------------|------|
| 코드 | C | VARCHAR2(3) | 공통코드 식별자 (2026-05-18 추가) |
| ID | EID/GUID/UUID/USID/MAC | VARCHAR2(14~38) | 물리명별 고정 길이 |
| 금액 | AMT/PR/UPR/TX/INT/BBL ... | NUMBER(18,3) | 본세 MNTX·주세 LQTX는 NUMBER(18) |
| 날짜 | DT/YM/YY/MM/DD/MD/TM/HM/YHY/YQRT | VARCHAR2(2/4/6/8) | 문자열 일자 |
| 날짜 | DTM | DATE | 일시 |
| 날짜 | TS | TIMESTAMP | |
| 내용 | TTL/DES/CONE/RMK/PTH/OTL/URL ... | VARCHAR2(20~4000) | 항목별 길이 다름 |
| 내용 | INF | CLOB | |
| 내용 | IMG | BLOB | |
| 내용 | STI | SDO_GEOMETRY | |
| 단위 | LEN/DEP/QTY/AGE/SZ/SQM/TTS/ASCR | NUMBER(10) 또는 NUMBER(10,6) | 수량(QTY) 2026-05-18 확인 |
| 명칭 | NM/ALS | VARCHAR2(100) | LNM/FNM은 VARCHAR2(60) |
| 번호 | NO/CNO/CRN/BRN/ENO/SOSN/NOS/BIN/EPN | VARCHAR2(6~32) | 물리명별 고정 |
| 수 | NBR/CNT/CFC/IXN/WERE/AVRV ... | NUMBER(3~18, scale 0~10) | 항목별 |
| 여부 | YN | VARCHAR2(1) | 값: 'Y'/'N' |
| 연락처 | ZIP/ZCA/BZCA/TPN/MBTNO/ADDR | VARCHAR2(6~300) | |
| 율/비율 | RT/IRT/MGN/PTG/RATO/TXR/ITSR/PBB/CPI | NUMBER(8,5) | XCR=NUMBER(9,4), PBB=NUMBER(15,10) |
| 일련번호 | SNO | NUMBER(9) | |

### 1.3 예외 처리

- **PK/FK는 의미 보존 우선**: `GCL_MNG_NO`, `PRJ_SNO` 등 기존 표준 유지
- **BaseEntity 공통 컬럼**: `DEL_YN`, `GUID`, `FST_ENR_DTM`, `FST_ENR_USID`, `LST_CHG_DTM`, `LST_CHG_USID` — 이미 도메인 준수 (변경 없음)

---

## 2. 영향 범위 (스캔 결과)

| 영역 | 수치 | 비고 |
|------|------|------|
| 엔티티 클래스 | 49개 | `domain/budget/*`, `domain/council/*`, `domain/log/*` |
| `@Column` 어노테이션 | 약 475개 | Grep 기준 |
| 복합키 IdClass | 10개 | `BitemmId`, `BprojmId`, `BcostmId` 등 |
| Native/JPQL 쿼리 | TBD | Phase 0에서 전수 추출 |
| 프론트엔드 응답 키 사용처 | TBD | `it_frontend/types`, `composables/use*` |

### 2.1 비표준 컬럼 샘플 (재명명 후보)

| 현재 | 도메인 후보 | 제안 |
|------|-------------|------|
| `XCR` (환율, NUMBER(15,4)) | 율/비율 → XCR | 컬럼명 유지 + 타입을 `NUMBER(9,4)`로 표준화 |
| `CUR` (통화코드, VARCHAR(10)) | 코드 → C | `CUR_C`로 변경, `VARCHAR2(3)`로 축소 (ISO 4217 3자리) |
| `IOE_C` (품목구분) | 코드 → C | 이미 표준 ✓ 단 길이를 `VARCHAR2(3)`로 조정 (현재 32) |
| `GCL_QTT` (수량) | 단위 → QTY | `GCL_QTY`로 변경, `NUMBER(10)` (DOMAIN.md 2026-05-18 반영 ✓) |
| `INF_PRT_YN` | 여부 → YN | 이미 표준 ✓ |
| `XCR_BSE_DT` | 날짜 → DT | 이미 표준 ✓ (단 VARCHAR2(8) 표준 적용 검토) |
| `ITD_DT` (VARCHAR2(32)) | 날짜 → DT | 길이를 VARCHAR2(8)로 조정 |
| `BG_FDTN` (VARCHAR2(100)) | 내용 → FDTN(VC4000) | 길이 4000으로 확장 검토 |

> 정확한 차이 목록은 Phase 0 산출물(`column-audit.csv`)에서 확정.

---

## 3. 마이그레이션 전략

### 3.1 원칙

1. **Flyway 멱등성 보장**: `V20260518_xxx__*.sql` 형식, `ALTER TABLE ... RENAME COLUMN`은 존재 체크 후 수행 (PL/SQL 블록)
2. **단계별 분리 (Expand-Migrate-Contract)**
   - **Expand**: 새 컬럼 추가 또는 RENAME + JPA 매핑 동시 변경
   - **Migrate**: 데이터 복사/검증
   - **Contract**: 구 컬럼 제거 (별도 PR/배포)
3. **무중단 배포 불필요 가정**: 사내 시스템 + 야간 배포 가능 → 단일 트랜잭션 RENAME 채택 가능 (DBA 확인 필요)
4. **타입 축소 데이터 보존**: NUMBER 정밀도 축소 전 `MAX(LENGTH(value)) ≤ 표준` 검증 SQL 선행 실행

### 3.2 단계 구성

| 단계 | 결과물 | 검증 |
|------|--------|------|
| Phase 0: 감사(Audit) | 모든 컬럼 × DOMAIN.md 매핑 CSV, 변경 후보 목록 | DBA 리뷰 + 비표준 항목 결정 |
| Phase 1: DOMAIN.md 확장 | "코드(C)" 등 누락 도메인 추가 결정 | 의사결정 회의록 |
| Phase 2: 마이그레이션 스크립트 작성 | 도메인 그룹별 Flyway SQL 파일 (5~7개) | 로컬 XEPDB1 실행 성공 |
| Phase 3: JPA 엔티티/IdClass 수정 | 49개 엔티티 컬럼명·타입·precision 일치 | `./gradlew test` 통과 |
| Phase 4: Repository/Query 동기화 | Native SQL/JPQL/QueryDSL 전수 grep & 수정 | 단위·통합 테스트 통과 |
| Phase 5: 프론트엔드 타입 동기화 | DTO 키 변경 시 매핑 alias 또는 TS 타입 갱신 | `npm run typecheck` + `/qa` |
| Phase 6: 운영 배포 + 검증 | Flyway 자동 실행, 사후 회귀 | `/gstack qa` 핵심 시나리오 통과 |

### 3.3 도메인 그룹별 마이그레이션 파일 분할

병합 충돌·롤백 단위를 작게 유지하기 위해 도메인 그룹별 분리:

```
it_database/migrations/
├── V20260518_001__domain_audit_baseline.sql        -- 사전 검증 뷰 (조회 전용)
├── V20260518_002__domain_money_columns.sql         -- 금액 도메인
├── V20260518_003__domain_date_columns.sql          -- 날짜 도메인
├── V20260518_004__domain_name_text_columns.sql     -- 명칭/내용 도메인
├── V20260518_005__domain_number_unit_columns.sql   -- 수/단위 도메인
├── V20260518_006__domain_ratio_yn_columns.sql      -- 율/여부 도메인
├── V20260518_007__domain_contact_id_columns.sql    -- 연락처/ID/번호 도메인
├── V20260518_008__domain_code_columns.sql          -- 코드 도메인 (VARCHAR2(3))
└── V20260518_009__domain_drop_legacy_columns.sql   -- Contract 단계(별도 배포)
```

각 파일 템플릿(멱등성):
```sql
DECLARE
  v_cnt NUMBER;
BEGIN
  SELECT COUNT(*) INTO v_cnt
    FROM USER_TAB_COLUMNS
   WHERE TABLE_NAME = 'TAAABB_BITEMM' AND COLUMN_NAME = 'GCL_QTT';
  IF v_cnt = 1 THEN
    EXECUTE IMMEDIATE 'ALTER TABLE TAAABB_BITEMM RENAME COLUMN GCL_QTT TO GCL_QTY';
    EXECUTE IMMEDIATE 'ALTER TABLE TAAABB_BITEMM MODIFY (GCL_QTY NUMBER(10))';
  END IF;
END;
/
```

---

## 4. 검증 계획

### 4.1 자동 검증

1. **사전 SQL 어서션** (Phase 2 실행 전):
   ```sql
   SELECT TABLE_NAME, COLUMN_NAME, DATA_LENGTH
     FROM USER_TAB_COLUMNS
    WHERE COLUMN_NAME LIKE '%_NM' AND DATA_LENGTH > 100;
   -- 결과 0건이어야 RENAME 안전
   ```
2. **JPA 부트스트랩 검증**: `spring.jpa.hibernate.ddl-auto=validate`로 컬럼 일치 자동 확인
3. **회귀 테스트**: 기존 단위·통합 테스트 100% 통과 + 80% 커버리지 유지

### 4.2 수동 검증

- `/qa` 핵심 시나리오: 로그인 / 프로젝트 조회·생성 / 결재 / 협의회
- Swagger UI에서 변경 컬럼이 API 응답에 정상 포함되는지 확인
- 운영 DB 백업 후 Flyway dry-run

### 4.3 롤백 전략

| 단계 | 롤백 방법 |
|------|----------|
| Phase 2 (RENAME) | 역방향 `RENAME COLUMN` SQL 사전 작성 |
| Phase 3 (JPA) | 직전 커밋 revert |
| Phase 6 (배포) | WAR 직전 버전 재배포 + Flyway repair |

---

## 5. 의사결정 필요 항목

1. **DOMAIN.md 추가 도메인 검토**
   - ✓ **코드(`_C`, VARCHAR2(3))**: 2026-05-18 추가됨
   - 통화(`_CUR`), 구분(`_TP`) 등 추가 카테고리 필요 여부 — 일단 모두 코드(C) 도메인에 흡수 가능한지 확인
   - `IOE_C`, `DFR_CLE` 등 기존 코드성 컬럼은 길이 표준(3)에 맞춰 데이터 검증 선행
   - 결정자: DBA + 백엔드 리드
2. **타입 정밀도 강제 수준**
   - 모든 금액 컬럼을 `NUMBER(18,3)`으로 통일할지, 일부 기존 정밀도 유지할지
3. **PK 컬럼 처리**
   - `*_MNG_NO`, `*_SNO`는 비즈니스 식별자라 유지 권장
4. **운영 무중단 필요 여부**
   - 필요시 Expand-Contract 2단계 배포, 불필요시 1회 RENAME

---

## 6. 산출물 체크리스트

- [ ] `docs/03-analysis/column-domain-standardization.analysis.md` — Phase 0 감사 결과
- [ ] `docs/02-design/features/column-domain-standardization.design.md` — 변경 컬럼 전체 매핑표
- [ ] `it_database/migrations/V20260518_00*.sql` — Flyway 스크립트 (7~8개)
- [ ] 엔티티 49개 패치 + IdClass 동기화
- [ ] `it_frontend/app/types/` TS 타입 갱신 (필요 시)
- [ ] `docs/04-report/column-domain-standardization.report.md` — 사후 결과 보고

---

## 7. 일정(잠정)

| 주차 | 작업 |
|------|------|
| W1 | Phase 0~1 (감사 + DOMAIN.md 확장 의사결정) |
| W2 | Phase 2~3 (마이그레이션 SQL + JPA 매핑) |
| W3 | Phase 4~5 (Repository/Query/Frontend) |
| W4 | Phase 6 (스테이징 검증 → 운영 배포) |

---

## 8. 다음 액션

1. 본 계획 리뷰 및 승인
2. Phase 0 감사 스크립트 실행 → `column-audit.csv` 생성
3. DOMAIN.md 누락 도메인 의사결정 회의 소집
