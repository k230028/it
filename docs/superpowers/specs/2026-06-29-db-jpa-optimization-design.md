# DB / JPA 최적화 조치 계획 (Design / Spec)

> 🗓️ 작성일: 2026-06-29
> 🎯 목적: `TASK.md` §🗄️ DB / JPA 최적화의 ⬜ Open **12건**을 실행 트랙별로 묶어 단계별 조치 계획을 정의한다.
> 📎 관련: [`TASK.md`](../../../TASK.md) §🗄️ DB / JPA 최적화, [`2026-06-22-backend-improvement-roadmap-design.md`](2026-06-22-backend-improvement-roadmap-design.md) (T12·T13·T14·T16 상위 테마)
> 🧭 SoT: 백엔드 규약은 [`it_backend/CLAUDE.md`](../../../it_backend/CLAUDE.md) §5.4(QueryDSL)·§5.5(트랜잭션/캐시)·§5.5.4(네이티브 매핑)·§4.4(Flyway)를 따른다.

---

## 1. 배경 & 범위

### 1.1 범위 결정 (브레인스토밍, 2026-06-29)
- **범위**: DB/JPA 12건 **전부** (A 순수 코드 + B 인덱스 + C 캐시).
- **B(인덱스)**: 실제 적용은 운영/DBA 의존이므로, 본 계획에는 **로컬 Oracle `EXPLAIN PLAN` 검증 절차 + 후보 인덱스 마이그레이션 스크립트 작성**까지 담고, `dev`/`prod` 적용은 DBA에 위임한다.
- **검증 방식**: **Testcontainers Oracle 기반 `@DataJpaTest` 인프라 선구축**(T18 strategy B) 후 프로젝션·bulk·N+1을 DB-backed 테스트로 검증한다.
- **캐시(C/T13)**: **Caffeine 전환**으로 결정 — `CacheManager`를 Caffeine으로 교체해 per-cache TTL을 지원하고 `tiptapMetadata`·unread-count를 일관 처리한다.

### 1.2 12건 → 페이즈 매핑

| # | TASK 항목 (근거) | Phase |
| :--: | --- | :--: |
| 1 | `BudgetWorkService.applyItemRates()` 전체 BBUGTM 메모리 로드+루프 soft delete → 벌크 UPDATE | P1 |
| 2 | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → flush 명시 | P1 |
| 3 | `EvaluationService`·`CommitteeService.buildUserMap` 사용자명 N+1 | P2 |
| 4 | `CouncilService:298` per-evaluator count 반복 → 배치 COUNT | P2 |
| 5 | `findProjectsForCouncilAll`/`ByDepartment` (18컬럼) native `Object[]` → DTO (오매핑 위험, 최우선) | P3 |
| 6 | Native `Object[]` → DTO/`@SqlResultSetMapping` (`CouncilRepository`·`ApplicationRepository`·`ServiceRequestDocRepository`·`LoginHistoryRepository`·`EvaluationRepository`) | P3 |
| 7 | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 DTO 프로젝션(1000자 텍스트 제외) | P3 |
| 8 | 협의회 목록 `BASCTM`/`BCMMTM` 역방향 조회 인덱스 검토 | P4 |
| 9 | `BRDOCM` `findLatestVersionsAll()` 실행계획 검증 + 복합 인덱스 | P4 |
| 10 | `BRIVGM` 검토의견 목록 인덱스 추가 | P4 |
| 11 | 실시간 로그 피드 커서 폴링 인덱스/실행계획 검증 (`V_ITPAPP_LOG_FEED`) | P4 |
| 12 | 캐시 TTL 미적용 보완 (T13) — Caffeine 전환 | P5 |

> P0(Testcontainers 인프라)는 12건의 **검증 전제**로, 항목 자체는 아니지만 선행 산출물이다.

---

## 2. 페이즈 분해 (실행 순서)

| Phase | 성격 | 항목 | 완료 게이트 |
| :--: | --- | --- | --- |
| **P0** 인프라 | Testcontainers Oracle `@DataJpaTest` 토대 | (전제) | 베이스 클래스로 1개 리포지토리 라운드트립 테스트 GREEN + CI 통과 |
| **P1** 정합·안정성 | flush 명시, 벌크 UPDATE | #2, #1 | 동작 보존 + DB-backed 테스트 |
| **P2** N+1 일괄조회 | 사용자명/카운트 N+1 | #3, #4 | 쿼리 수 감소 검증(로그/카운트) |
| **P3** 프로젝션 | native `Object[]`→DTO, 목록 DTO | #5(최우선), #6, #7 | 매핑 동등성 테스트 GREEN |
| **P4** 인덱스 검증 | EXPLAIN + 후보 마이그레이션 | #8~#11 | EXPLAIN 결과 문서화 + `V*.sql` 작성(미적용) |
| **P5** 캐시 | Caffeine 전환 | #12 | TTL 동작 + evict 정합 테스트 |

**순서 근거**: P0(검증 토대) → P1·P2(저위험 코드) → P3(고위험 오매핑) → P4(운영 게이트) → P5(횡단 인프라 변경). 각 Phase는 독립 PR, `./gradlew compileJava` + 해당 테스트 통과를 완료 조건으로 둔다.

---

## 3. P0 — Testcontainers Oracle 인프라

### 3.1 현황
- `application-test.properties`는 DataSource/JPA를 **제외**(`spring.autoconfigure.exclude`)하고 있어 리포지토리 통합 테스트 불가. 현재 Mockito 단위 테스트만 존재.

### 3.2 설계
- **의존성** (`build.gradle`, testImplementation): `org.testcontainers:junit-jupiter`, `org.testcontainers:oracle-free`. 이미지는 라이선스 부담 없는 **`gvenzl/oracle-free:slim-faststart`** 사용(공식 이미지 대비 경량·고속 기동).
- **싱글톤 컨테이너 패턴**: static `@Container` + `withReuse(true)`(로컬). 테스트 클래스마다 재기동하지 않도록 베이스에서 1회 기동, 클래스 간 공유.
- **세션 스키마 정합**: 운영과 동일하게 `ALTER SESSION SET CURRENT_SCHEMA=ITPOWN`을 HikariCP `connection-init-sql`로 적용(§CLAUDE 2). 컨테이너 안에 `ITPOWN` 스키마 생성.
- **스키마 시드**: 컨테이너 기동 후 **Flyway로 `it_database/migrations/V*.sql` 적용**(baseline 없이 빈 스키마 전체 적용 경로, §4.4). 이로써 테스트 DDL이 실제 마이그레이션과 동일하게 유지된다.
- **베이스 클래스** `AbstractOracleRepositoryTest`:
  - `@DataJpaTest` + `@AutoConfigureTestDatabase(replace = NONE)`(내장 DB 치환 비활성) + `@Import(QuerydslConfig.class)`로 `JPAQueryFactory` 빈 주입.
  - `@DynamicPropertySource`로 컨테이너 JDBC URL/계정 주입.
  - 전용 프로파일 `application-test-it.properties`(DataSource/JPA 활성)로 분리해 기존 `application-test.properties`(슬라이스 단위 테스트용)와 공존.
- **로컬 전용 게이트 (결정 2026-06-29)**: 통합 테스트는 **로컬 전용**으로 둔다(CI Docker 비의존). `@Tag("it")`로 분리하고 별도 `integrationTest` 태스크를 만들어, 기본 `./gradlew test`(단위, CI 게이트)에서는 **제외**(`useJUnitPlatform { excludeTags 'it' }`)한다. 개발자가 로컬에서 Docker 기동 후 `./gradlew integrationTest`로 실행한다. Docker 미존재 시 통합 테스트는 `@EnabledIfDockerAvailable`(Testcontainers `@Testcontainers(disabledWithoutDocker = true)`)로 자동 스킵해 로컬에서도 Docker 없이 단위 빌드가 깨지지 않게 한다.

### 3.3 산출물
- `build.gradle` 의존성, `application-test-it.properties`, `AbstractOracleRepositoryTest`, 스모크 테스트 1건(임의 리포지토리 save/find 라운드트립).

---

## 4. P1 — 정합·안정성 (순수 코드)

### 4.1 #2 `FeasibilityService.replacePerformances()` flush 명시
- **현상**: JPQL `DELETE` 후 `flush()` 없이 곧바로 `persist()` → 영속성 컨텍스트 동기화 순서에 따라 DELETE가 INSERT 뒤로 밀려 PK 충돌/유령 행 위험.
- **조치**: JPQL DELETE 직후 `entityManager.flush()` 명시(또는 Spring Data `deleteAll`+`saveAll`로 통일). **권장: 명시 flush** — 기존 JPQL 일괄 삭제 성능 유지하면서 순서 보장.
- **검증**: 기존 성과지표 존재 상태에서 replace 후 잔존 행 0 + 신규 행만 존재(DB-backed 테스트).

### 4.2 #1 `BudgetWorkService.applyItemRates()` 벌크 UPDATE
- **현상**(`BudgetWorkService.java` L283-284): `findByBseYyAndDelYn(bgYy,"N")`로 해당 연도 BBUGTM 전체를 메모리 로드 후 루프 `prior.delete()`.
- **조치**: `@Modifying @Query` 벌크 UPDATE로 전환.
  ```java
  @Modifying(clearAutomatically = true, flushAutomatically = true)
  @Query("UPDATE Bbugtm b SET b.delYn='Y', b.lstChgUsid=:usid, b.lstChgDtm=:now " +
         "WHERE b.bseYy=:bgYy AND b.delYn='N'")
  int softDeleteByBseYy(@Param("bgYy") String bgYy, @Param("usid") String usid, @Param("now") LocalDateTime now);
  ```
  - `clearAutomatically=true`: 벌크 후 1차 캐시를 비워, 직후 재삽입 로직이 stale 엔티티를 보지 않게 한다(roadmap T16 명시 요구).
  - `flushAutomatically=true`: 선행 변경을 DB에 반영 후 UPDATE 실행.
- **⚠️ DECISION — 감사로그 트레이드오프**: `@Modifying` 벌크는 `@PreUpdate`→`ChangeLogEntityListener`(§5.12.1)를 **우회**하므로 이 선정리 구간의 행별 `BbugtmL` 변경로그가 생성되지 않는다. 본 구간은 직후 전량 재삽입되는 **과도적 선정리**라 행별 로그 가치가 낮다고 보고:
  - **권장안**: 벌크 UPDATE 채택 + UPDATE문에 감사컬럼(`LST_CHG_USID/DTM`) 수동 세팅. 선정리 구간의 행별 *L 로그 손실은 **수용**.
  - **대안(보수)**: 행별 로그가 업무 감사상 필수면 루프 `delete()` 유지(현행). → 이 경우 #1은 "감내"로 종료.
  - **결정(2026-06-29): 권장안 채택** — 벌크 UPDATE + 감사컬럼 수동 세팅, 선정리 구간 행별 *L 로그 손실 수용.
- **검증**: 과거 BBUGTM 잔존 상태에서 applyItemRates 후 (a) 과거 행 전량 `DEL_YN='Y'`, (b) 신규 행만 활성, (c) 단일 UPDATE 쿼리 1회(N+1 제거) 확인.

---

## 5. P2 — N+1 일괄조회

공통 패턴: per-row `findByEno`/count 루프 → 키 집합 추출 후 `findBy...In` 또는 GROUP BY 1회 조회 → `Map` 선구성(roadmap T12, `ScheduleService`가 동일 패턴으로 선완료).

### 5.1 #3 사용자명 N+1 (`EvaluationService`, `CommitteeService.buildUserMap`)
- 대상 사번 집합 수집 → `userRepository.findByEnoIn(enos)` 1회 → `Map<eno,name>`로 치환.
- `CommitteeService.buildUserMap`은 이미 Map 구성 메서드명이 있으므로 내부 조회만 일괄로 교체.

### 5.2 #4 `CouncilService:298` per-evaluator count
- 평가자별 count 쿼리 반복 → 단일 GROUP BY COUNT(`SELECT asctId, COUNT(*) ... GROUP BY asctId`)로 `Map<asctId, count>` 선구성 후 조회. 별도 배치 리포지토리 메서드 추가.
- **검증**: 평가자 N명일 때 count 쿼리가 1회로 수렴.

---

## 6. P3 — 프로젝션 (오매핑 위험 우선)

### 6.1 #5 `findProjectsForCouncil*` 18컬럼 native `Object[]` (최우선)
- **위험**: 18개 컬럼 순서와 서비스 캐스팅이 강결합 → 컬럼 추가/순서 변경 시 조용한 오매핑.
- **조치**: 전용 `record` DTO + **단일 `fromRow(Object[])` 팩토리**로 18컬럼 매핑을 한 곳에 집중. 컬럼 순서 변경은 SQL과 팩토리만 동기.
- **타입 안전**(§5.5.4 필수): 직접 캐스트 금지. `toStr()`/`toLdt()`/`((Number)v).longValue()` 헬퍼 사용(Oracle JDBC가 `VARCHAR2(1)`→Character/String, `TIMESTAMP`→Timestamp/LocalDateTime 혼용 반환). `RealtimeLogRepository` 패턴 재사용.
- **검증**: 동일 데이터에 대해 기존 `Object[]` 경로와 신규 DTO 경로 결과 동등성 테스트.

### 6.2 #6 기타 native `Object[]` → DTO
- 대상: `CouncilRepository`(잔여), `ApplicationRepository`, `ServiceRequestDocRepository`, `LoginHistoryRepository`, `EvaluationRepository`.
- 각 native 쿼리에 record DTO + `fromRow` 팩토리 적용. `@SqlResultSetMapping`은 Oracle 타입 quirk(§5.5.4) 때문에 매핑 제어가 약하므로 **수동 팩토리 매퍼를 표준**으로 한다(`@SqlResultSetMapping`은 타입이 단순한 케이스에 한해 선택).

### 6.3 #7 `ProjectRepositoryImpl`/`CostRepositoryImpl` 목록 DTO 프로젝션
- **현상**: `ProjectRepositoryImpl.java` L140, `CostRepositoryImpl.java` L163의 `selectFrom(entity)`가 1000자 텍스트 컬럼 포함 **전체 컬럼**을 목록 API에서 로드.
- **조치**: QueryDSL `Projections.constructor(ProjectListDto.class, entity.col1, entity.col2, ...)`로 **목록용 경량 DTO** 구성, 1000자 텍스트/대용량 컬럼 제외. 상세 API는 기존 전체 엔티티 조회 유지.
- `bbrC` 부서 필터(§5.14)·정렬·페이지네이션 등 기존 `BooleanBuilder` 조건은 그대로 유지하고 select 절만 프로젝션으로 교체.
- **검증**: 목록 DTO 필드값이 엔티티 경로와 동등 + select 컬럼에 대용량 텍스트 미포함.

---

## 7. P4 — 인덱스 검증 (운영 의존)

### 7.1 절차 (각 항목 공통)
1. 로컬 Oracle(`ITPAPP@127.0.0.1:11521/XEPDB1`, §CLAUDE 3.1.1)에 실데이터로 `EXPLAIN PLAN FOR <쿼리>; SELECT * FROM TABLE(DBMS_XPLAN.DISPLAY);` 실행, 현재 실행계획(Full Scan/정렬 비용) 기록.
2. 후보 복합 인덱스 생성 후 재측정, 개선폭 기록.
3. 효과 확인 시 신규 `V{YYYYMMDD}_NNN__Add*Index.sql` 작성(§4.4 네이밍). 기존 V* 수정 금지(체크섬 불변).
4. **`dev`/`prod` 적용은 DBA 위임** — 스크립트는 `local-ext`/`local-int` Flyway로만 자동 적용. 결과는 본 문서 부록 또는 별도 `EXPLAIN` 기록 문서에 남긴다.

### 7.2 후보 인덱스 (TASK 근거)
| # | 테이블/쿼리 | 후보 인덱스 |
| :--: | --- | --- |
| 8 | `BASCTM`/`BCMMTM` 역방향 조회 | `BASCTM(PRJ_MNG_NO, PRJ_SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, ASCT_ID)` |
| 9 | `BRDOCM.findLatestVersionsAll()` (DEL_YN='N' + 상관서브쿼리 `MAX(DOC_VRS)` + `FST_ENR_DTM DESC`) | `(DEL_YN, DOC_MNG_NO, DOC_VRS, FST_ENR_DTM)` |
| 10 | `BRIVGM` 검토의견 목록 (`(DOC_MNG_NO,DOC_VRS,DEL_YN)` 필터 + `FST_ENR_DTM ASC`) | `(DOC_MNG_NO, DOC_VRS, DEL_YN, FST_ENR_DTM)` (기존 `IX_BRIVGM_DOC_DEL_FSG`는 대시보드용 별개 — 본 정렬 미커버) |
| 11 | 실시간 로그 피드 `V_ITPAPP_LOG_FEED` (`CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC` + `LOG_KEY`/`CHG_DTT_YN` 필터 + 5/30분 집계) | View 기반 EXPLAIN 후 하위 로그 테이블에 커서/집계 커버 인덱스 검토 |

---

## 8. P5 — 캐시 (Caffeine 전환)

### 8.1 현황
- `CacheConfig`는 `ConcurrentMapCacheManager`(TTL 미지원). `tiptapMetadata`는 프로젝트 쓰기 시 stale 가능, unread-count는 60s TTL 미적용(현재 evict-on-write로 대체).

### 8.2 설계
- **의존성**: `com.github.ben-manes.caffeine:caffeine`.
- `CacheConfig`에서 `CacheManager`를 **`CaffeineCacheManager`**로 교체. per-cache TTL/최대크기 지정.
- **캐시별 정책**:
  | 캐시 | TTL | 비고 |
  | --- | --- | --- |
  | `codesByCid`, `budgetPeriod` | 길게(예: 1h) | 이미 쓰기 시 `@CacheEvict`(§5.5.1) — TTL은 안전망 |
  | `tiptapMetadata` | 중간(예: 10m) + **쓰기 evict 보강** | `ProjectService` create/update/delete에 `@CacheEvict(cacheNames="tiptapMetadata", allEntries=true)` 추가 |
  | notification unread-count | 60s, per-user 키 | TTL 도입으로 evict 누락 시에도 stale 한도 보장 |
- **기존 `@Cacheable`/`@CacheEvict` 의미 보존**: §5.5.1 공통코드 캐시 규약 불변. CacheManager 교체만으로 기존 어노테이션 동작 유지되는지 회귀 테스트.
- **검증**: TTL 경과 후 재로딩 + 쓰기 후 즉시 evict(특히 `tiptapMetadata`) 동작 테스트.

---

## 9. 횡단 사항 & 리스크

| 리스크 | 대응 |
| --- | --- |
| 벌크 UPDATE가 감사로그 리스너 우회(#1) | §4.2 DECISION — 선정리 구간 행별 로그 손실 수용(권장) 또는 현행 유지 |
| native 프로젝션 컬럼 순서 결합(#5,#6) | `fromRow` 단일 팩토리로 집중 + §5.5.4 타입 헬퍼 강제, 동등성 테스트 |
| Testcontainers Oracle 이미지/CI 비용(P0) | 통합 테스트 **로컬 전용**(CI 제외), `gvenzl/oracle-free:slim-faststart` + 싱글톤 reuse, `@Tag("it")` 분리 + Docker 미존재 시 자동 스킵 |
| Flyway 체크섬 불변(P4) | 인덱스는 항상 신규 V* 스크립트로만 추가, 기존 수정 금지 |
| 인덱스 운영 적용 권한 | `dev`/`prod`는 DBA 위임, 본 계획은 검증+스크립트 작성까지 |
| CacheManager 교체 회귀(P5) | 공통코드(§5.5.1) 등 기존 캐시 동작 회귀 테스트로 보호 |

## 10. 완료/추적
- 각 Phase 완료 시 해당 TASK 행을 `TASK.md`→`TASK_DONE.md`로 이관(근거 `파일:라인`/`V*.sql` 명시).
- P4 인덱스는 스크립트 작성·로컬 검증 완료를 "코드측 완료"로, 운영 적용은 W4 체크리스트로 잔존.

## 11. 범위 밖
- 환율 환산 규칙 통일(`BudgetWorkService` vs `ProjectBudgetSummaryService`) — DECISION 선행 별도 과제(W3 카브아웃).
- SSE/WebSocket 전환, 조회수 Redis, Oracle Text — Backlog.
- 프론트엔드 Mock→API 연동 — 별도 기능 spec.
