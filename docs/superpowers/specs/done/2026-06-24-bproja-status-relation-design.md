# 정보화사업관계(TPRMPP_BPROJA) 신설 + 상태 정규화 설계 (1차: 기반 + 읽기)

> 작성일: 2026-06-24
> 범위: **1차 — DB 기반 + 백엔드 엔티티/리포지토리 + 읽기 경로 + 프론트 표시**. 단계별 write 통합은 **2차(별도 계획)**.

## 1. 목적 / 배경

`TPRMPP_BPROJM`(정보화사업 마스터)와 `TPRMPP_BPROJL`(변경 로그)에는 프로젝트의 단일 상태 컬럼
`IT_PTL_STS_TC`(`stsTc`, 프로젝트상태)가 있다. 이 단일 코드는 "예산편성 작업 완료(09/19)",
"정보기술부문계획 정실협 진행중(11)"처럼 **사실상 단계(stage) 진행 위치를 인코딩**한 값이다.

이를 정규화한다. 프로젝트의 상태를 마스터 단일 컬럼이 아니라, **프로젝트(`ABUS_MNG_NO`) ↔ 각 단계
문서**의 관계 테이블 `TPRMPP_BPROJA`(정보화사업관계)에서 관리한다. 각 관계 행은 그 단계 원본문서의
key와 해당 단계의 상태(`IT_PTL_STS_TC`)를 담는다.

## 2. 핵심 모델

`TPRMPP_BPROJA`는 **한 프로젝트당 단계별 다건** 행을 갖는 정규화 테이블이다.

| 항목 | 내용 |
|---|---|
| PK | `ABUS_MNG_NO`(30) + `CNCD_RFR_NO`(30) |
| `ABUS_MNG_NO` | 프로젝트(정보화사업) 관리번호 |
| `CNCD_RFR_NO` | **해당 단계 원본문서의 key** (아래 매핑) |
| `IT_PTL_STS_TC`(2, NULL 허용) | 해당 단계의 IT포탈상태구분코드 |
| 감사 7컬럼 | `BaseEntity` 공통 컬럼으로 충족(재선언 불필요) |

### 단계 ↔ 원본테이블 ↔ CNCD_RFR_NO key 매핑

| 단계 | 원본테이블 | 엔티티 | `CNCD_RFR_NO`에 들어갈 key |
|---|---|---|---|
| 사전협의 | `TPRMPP_BRDOCM` | `Brdocm` | `DOC_MNG_NO` |
| 예산편성 | `TPRMPP_BBUGTM` | `Bbugtm` | `BG_NO` |
| 정보기술부문계획 | `TPRMPP_BPLANM` | `Bplanm` | `REQ_DOC_NO` |
| 타당성검토 | `TPRMPP_BASCTM` | `Basctm` | `IT_PTL_ASCT_ID` |
| 소요예산 | `TPRMPP_BESTIM` | `Bestim` | `RQM_BG_REQ_DOC_NO` |
| 과업심의 | `TPRMPP_BDELIM` | `Bdelim` | `DOC_MNG_NO` |
| 입찰계약 | `TPRMPP_BCONTM` | `Bcontm` | `DOC_MNG_NO` |
| 대금지급 | `TPRMPP_BPAYMM` | `Bpaymm` | `DOC_MNG_NO` |

> 참고: 실행 4단계(`Bestim`/`Bdelim`/`Bcontm`/`Bpaymm`)는 이미 자기 문서 key + 프로젝트참조
> (`CNCD_RFR_NO`=대상관리번호=`ABUS_MNG_NO`, `BG_PRN_TC='100'`일 때) + 자기 상태(`IT_PTL_STS_TC`)를
> 보유한다. 즉 2차 write 통합 시 단계 서비스는 보유 데이터로 BPROJA를 직접 동기화할 수 있다.

### 대표 상태(프로젝트 단일 상태) 도출 규칙

프로젝트 목록/상세에서 표시·필터에 쓰는 "프로젝트상태"는 **그 프로젝트의 BPROJA 행 중
`IT_PTL_STS_TC` 코드값이 가장 높은(MAX) 1건**으로 도출한다. 코드는 2자리 zero-pad 문자열이므로
사전식 MAX = 숫자 MAX이다. `DEL_YN='N'` 행만 대상. BPROJA 행이 없으면 대표 상태는 `null`.

## 3. 의사결정 기록 (사용자 확인 완료)

1. **`CNCD_RFR_NO` 의미**: sentinel 아님. 각 단계 원본테이블의 key(위 매핑).
2. **카디널리티**: 프로젝트당 단계별 다건.
3. **적재 방식**: 각 단계 서비스가 생성/상태변경 시 upsert — **단, 2차 범위**.
4. **프로젝트 상태 도출**: 대표 1건 = `IT_PTL_STS_TC` MAX.
5. **기존 데이터 이관**: 안 함(빈 테이블 시작).
6. **감사 로그**: BPROJA는 마스터/*L 로그 패턴 **미적용**(`@LogTarget` 없음, `BPROJAL` 없음).
   `BaseEntity`의 `ChangeLogEntityListener`는 `@LogTarget` 부재 시 no-op이므로 정합.
7. **범위/단계화**: 1차 = 기반 + 읽기, 2차 = 8개 단계 write 통합.

## 4. 1차 범위 상세

### 4.1 DB 마이그레이션
파일: `it_database/migrations/V20260624_002__CreateBprojaDropStatus.sql`

- `CREATE TABLE TPRMPP_BPROJA`:
  - `ABUS_MNG_NO VARCHAR2(30) NOT NULL`
  - `CNCD_RFR_NO VARCHAR2(30) NOT NULL`
  - `IT_PTL_STS_TC VARCHAR2(2)` (NULL 허용)
  - `FST_ENR_USID VARCHAR2(14) DEFAULT '00000000000000' NOT NULL`
  - `FST_ENR_DTM DATE DEFAULT SYSDATE NOT NULL`
  - `DEL_YN VARCHAR2(1) DEFAULT 'N' NOT NULL`
  - `GUID VARCHAR2(38) DEFAULT '00000000000000000000000000000000000000' NOT NULL`
  - `GUID_PRG_SNO NUMBER(4) DEFAULT 0 NOT NULL`
  - `LST_CHG_USID VARCHAR2(14) DEFAULT '00000000000000' NOT NULL`
  - `LST_CHG_DTM DATE DEFAULT SYSDATE NOT NULL`
  - `CONSTRAINT PK_TPRMPP_BPROJA PRIMARY KEY (ABUS_MNG_NO, CNCD_RFR_NO)`
  - 컬럼 COMMENT 부여(메타 용어사전 기준 한글명).
- `ALTER TABLE TPRMPP_BPROJM DROP COLUMN IT_PTL_STS_TC;`
- `ALTER TABLE TPRMPP_BPROJL DROP COLUMN IT_PTL_STS_TC;`
- 데이터 이관 DML 없음.

> `ddl-auto=update`는 컬럼 DROP/RENAME을 수행하지 않으므로(it_backend/CLAUDE.md §5.2.1) 반드시
> Flyway 스크립트로 명시한다. 적용된 스크립트는 체크섬 추적 대상 — 수정 금지, 변경은 새 버전.
> 자동 적용은 `local-ext`/`local-int` 프로파일만. `dev`/`prod`는 DBA 수동 적용.

### 4.2 백엔드 — 신규
- `domain/budget/project/entity/Bproja.java`
  - `extends BaseEntity`, `@Table(name="TPRMPP_BPROJA", comment="정보화사업관계")`, `@IdClass(BprojaId.class)`.
  - 필드: `@Id abusMngNo`, `@Id cncdRfrNo`, `stsTc(IT_PTL_STS_TC)`만 선언(감사컬럼은 상속).
  - `@LogTarget` 미부착.
  - 상태 변경 메서드 `changeStatus(String)` + upsert 편의 정적 팩토리(2차 사용 대비, 1차에선 미사용 가능).
- `domain/budget/project/entity/BprojaId.java` — `(abusMngNo, cncdRfrNo)` 복합키 클래스(`Serializable`, equals/hashCode).
- `domain/budget/project/repository/BprojaRepository.java` — `JpaRepository<Bproja, BprojaId>`.
  - 대표상태 조회 메서드:
    - 단건: `findTopByAbusMngNoAndDelYnOrderByStsTcDesc(String abusMngNo, String delYn)` 또는 JPQL `MAX(stsTc)`.
    - 배치: `@Query`로 `ABUS_MNG_NO IN (:ids)` + `GROUP BY ABUS_MNG_NO`의 `MAX(IT_PTL_STS_TC)` 투영
      (예: `List<Object[]>` 또는 전용 projection record `AbusStatus(abusMngNo, stsTc)`).

### 4.3 백엔드 — 변경
- `Bprojm.java`: `stsTc` 필드/`@Column(IT_PTL_STS_TC)` 제거. `UpdateCommand` 레코드의 `stsTc`
  컴포넌트 제거, `update(...)` 오버로드 2종 시그니처에서 `stsTc` 파라미터·할당 제거.
- `BprojmL.java`: `stsTc` 필드/`@Column(IT_PTL_STS_TC)` 제거.
- `ProjectService.java`:
  - 생성(`create`)·수정(`update`) 경로에서 `request.getStsTc()` 전달/`Bprojm` 상태 set 제거.
  - 배치 조회 경로(약 720~791행 인근): 응답 목록의 `ABUS_MNG_NO` 집합으로 `BprojaRepository` 배치
    대표상태(MAX) 1회 조회 → `response.setStsTc(...)` 주입, 이어서 기존 `setCodeNames`/`stsTcNm` 해석.
  - 단건(`setCodeNames` 약 856~924행): `BprojaRepository`에서 단건 대표상태 조회 후 `stsTc` 주입 →
    `IT_PTL_STS_TC` 공통코드명으로 `stsTcNm` 해석(기존 코드명 해석 로직 재사용).
- `ProjectRepositoryImpl.java`(:158 인근): `bprojm.stsTc.eq(condition.getStsTc())` 제거하고,
  대표상태 기준 필터로 교체. 구현 방식:
  - QueryDSL에서 BPROJA를 서브쿼리로 묶어 `ABUS_MNG_NO`별 `MAX(IT_PTL_STS_TC)`를 구하고
    `condition.getStsTc()`와 일치하는 프로젝트만 통과(EXISTS/서브쿼리 비교).
  - BPROJA 미존재 프로젝트는 상태 필터 미지정 시 정상 노출(LEFT 성격), 상태 필터 지정 시 제외.
- `ProjectDto.java`: `Response.stsTc`/`stsTcNm` 필드명 **유지**(API 계약 안정). `Request`/`Create`/
  `SearchCondition`의 `stsTc`는 유지하되, 쓰기 경로에서는 더 이상 영속화하지 않음(읽기·검색 필터 용도).

### 4.4 프론트엔드
- `pages/info/projects/index.vue`: 응답 `stsTc` 계약 불변 → `getStatusName(p.stsTc)` 표시·태그·
  다중필터·엑셀내보내기 로직 **변경 없음**(동작 회귀만 확인).
- `pages/info/projects/[id].vue`, `components/projects/ProjectProgressSection.vue`: `stsTc` 표시
  의존 — 변경 없음 확인.
- `pages/info/projects/form.vue`:
  - 상태는 더 이상 프로젝트가 소유하지 않음 → 저장 payload에서 `stsTc: f.prjSts` **제거**.
  - 상태 입력 컨트롤은 **읽기전용(파생 표시)** 로 전환(로드 시 `project.stsTc` 표시만, 편집 불가).
  - 실제 상태 전이는 2차에서 단계별로 발생.

### 4.5 문서/메타
- `meta/table.csv`: `TPRMPP_BPROJA` 행 추가, `TPRMPP_BPROJM`/`BPROJL`의 `IT_PTL_STS_TC` 행 제거.
- `it_backend/docs/guides/data-model.md`: BPROJA 매핑·상태 정규화 설명 추가.

## 5. 컴포넌트 경계 / 책임

- **Bproja(엔티티)**: 프로젝트-단계 관계 1건과 그 상태를 표현. 의존: `BaseEntity`.
- **BprojaRepository**: (a) 단건 대표상태, (b) 배치 대표상태(MAX) 조회. 의존: JPA.
- **ProjectService**: 프로젝트 조회 응답에 대표상태를 합성. BPROJA를 읽기만(1차). 의존: BprojaRepository.
- **ProjectRepositoryImpl**: 상태 필터를 대표상태 서브쿼리로 구현. 의존: QueryDSL + BPROJA Q타입.
- 각 단계 서비스(2차): BPROJA writer. 1차에서는 관여하지 않음.

## 6. 데이터 흐름

```
[조회] ProjectService.list/get
   → ProjectRepository(QueryDSL, BPROJM)         프로젝트 행
   → BprojaRepository.batchMaxStatus(abusMngNos) 프로젝트별 대표상태(MAX IT_PTL_STS_TC)
   → DTO.stsTc/stsTcNm 합성 → 프론트 표시

[검색-상태필터] SearchCondition.stsTc
   → ProjectRepositoryImpl: BPROJA 대표상태 == 조건 인 프로젝트만 통과

[쓰기] ProjectService.create/update
   → BPROJM 저장(상태 미포함). BPROJA 미기록(2차에서 단계 서비스가 기록).
```

## 7. 에러 / 경계 처리

- BPROJA 비어있음(1차 기본): 대표상태 `null` → 프론트는 빈 상태로 표시. 정상.
- `stsTc` 코드명 해석 실패: 기존 `setCodeNames` 패턴대로 `stsTcNm` 미설정(빈값) 유지.
- 마이그레이션 멱등성: `CREATE TABLE`/`DROP COLUMN`은 Flyway 버전 1회 적용. 재적용 금지(체크섬).

## 8. 검증 계획

- 백엔드 컴파일: `cd it_backend && ./gradlew compileJava` → BUILD SUCCESSFUL
  (메모리: `gradlew test` worker 기동 이슈가 있어 1차 검증은 컴파일 우선).
- 프론트 정적 점검: `cd it_frontend && npm run check` → 오류 0.
- 로컬 마이그레이션: `local-ext`/`local-int` 프로파일 `gradlew bootRun` 기동 시 V20260624_002 적용 로그 확인.
- 회귀 관찰: 프로젝트 목록/상세 200, 상태 컬럼 공란(BPROJA 미적재) 정상 동작.

## 9. 1차 알려진 결과 (수용된 트레이드오프)

2차 write 통합 전까지 BPROJA가 비어 있어(이관 없음 + writer 없음) **프로젝트 상태 표시가 공란**이
된다. 이는 단계화에 따른 의도된 중간 상태이며 사용자 확인 완료.

## 10. 2차 (이번 범위 아님 — 별도 계획)

8개 단계 서비스가 문서 생성/상태변경 시 BPROJA upsert:
`BPROJA(ABUS_MNG_NO=대상관리번호, CNCD_RFR_NO=단계 자기 key, IT_PTL_STS_TC=단계 상태)`.
실행 4단계는 보유 필드(`cncdRfrNo`=대상, 자기 문서 key, `stsTc`)로 직접 동기화 가능. 나머지 4단계
(`Brdocm`/`Bbugtm`/`Bplanm`/`Basctm`)는 프로젝트 참조 경로·상태 컬럼 보유 여부를 2차 계획에서 확인.
