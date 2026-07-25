# 보안·에러 처리 잔여과제 조치 설계 (SEC-08~09, ERR-08~10)

- **작성일**: 2026-07-25
- **상태**: 승인 대기 (사용자 검토 중)
- **범위**: `TASK.md`의 🔒 보안(SEC-08, SEC-09), ⚠️ 에러 처리(ERR-08, ERR-09, ERR-10) 5개 항목. ERR-08은 사용자 결정에 따라 ⚙️ 백엔드 BE-13(기준계획 조회 N+1·동률 비결정성 제거)을 함께 종료한다.
- **형태**: 통합 로드맵 1건 — 3개 Phase(A/B/C). 각 항목은 설계 수준까지 기술하고, 실제 구현은 Phase별 후속 계획(plan)으로 진행.
- **선행 관련 스펙**:
  - `2026-07-19-security-error-handling-remediation-design.md` (SEC-03~07, ERR-03~07 로드맵. 본 문서는 그 후속으로 발견된 잔여 결함을 다룬다)
  - `2026-07-21-backend-backlog-cleanup-design.md` (ERR-08을 BE-13과 묶어 선승인한 설계. §4.1이 본 문서 Phase B의 기준선)
  - `2026-06-29-security-hardening-design.md` (SEC-01 Refresh Token 회전 동시성 — Phase A가 보존해야 할 불변식)

---

## 1. 목표와 비목표

### 1.1 목표

1. **보안 통제의 실효성 복원**: 재사용 탐지 시 토큰 패밀리 폐기와 로그인 실패 이력이 트랜잭션 롤백으로 유실되어 통제가 사실상 무력화된 두 경로를 독립 커밋으로 확정한다.
2. **정상 빈 상태와 실패의 구분**: 조회·파싱·변환 실패가 "정상 빈 결과"와 구분 불가능하게 처리되는 백엔드(ERR-08, ERR-09)·프론트(ERR-10) 경로를 관측·표면화 가능하게 만든다.
3. **결정성 확보**: 기준 계획 탐색의 N+1과 동률 비결정성을 단일 결정적 쿼리로 제거한다(BE-13 동반 종료).

### 1.2 비목표 (명시적 제외)

- **원 업무 롤백 금지 정책은 유지**한다. 본 문서의 독립 커밋(`REQUIRES_NEW`)은 CLAUDE.md §7("실패가 원 업무를 롤백하면 안 되는 부수효과")과 방향이 반대인 경우(SEC-08/09: 부수효과가 **원 업무의 거부에 의해 롤백되면 안 됨**)를 다루지만, 같은 격리 도구를 사용하며 원 업무를 롤백시키지 않는다.
- DB 스키마 변경(DDL/마이그레이션)은 만들지 않는다. ERR-08 조인 쿼리의 보조 인덱스는 실행계획 검증 후 **필요할 때만** 별도 Flyway로 추가한다(조건부, 본 로드맵 핵심 경로 아님).
- 정책 문서 반전은 없다. ERR-10 통화 통합은 CLAUDE.md 프론트 §4의 기존 규칙을 **준수(강제)**하는 것으로, 정책 변경이 아니다.

### 1.3 기존 정책과의 정합성

| 정책 SoT | 본 설계의 준수/변경 |
| --- | --- |
| CLAUDE.md §7 (부수효과 비롤백) | SEC-08/09는 독립 커밋 패턴을 **재사용**해 보안 부수효과가 거부 롤백에 휩쓸리지 않게 한다. 원 업무 비롤백 정책은 유지 |
| it_backend/CLAUDE.md §4 (DB 예외 전파) | ERR-08/09는 DB·시스템 예외를 삼키지 않고 상위로 전파 |
| it_backend/CLAUDE.md §8 (Tiptap 변수 해석 tri-state) | ERR-08은 "잘못된 형식 vs 데이터 없음 vs 권한 없음" 구분 선례를 스냅샷 파싱에 적용 |
| it_frontend/CLAUDE.md §2·§4 (스토어 warnings 반환·통화 공용 컴포저블) | ERR-10은 두 규칙을 준수·강제 |

---

## 2. 실행 순서 (Phase)

| Phase | 우선순위 | 항목 | 성격 |
| :---: | :---: | --- | --- |
| **A** | 🟠 High | SEC-08, SEC-09 | 백엔드 트랜잭션 무결성 — 보안 통제 복원 |
| **B** | 🟠 High | ERR-08(+BE-13), ERR-09 | 백엔드 오류 표면화·결정적 조회 |
| **C** | 🟠 High | ERR-10 | 프론트 오류 상태·통화 통합 |

Phase 내·간 항목은 파일이 서로 겹치지 않아 병렬 진행이 가능하지만, 리뷰 체크포인트를 위해 Phase 단위로 나눈다. 권장 순서는 보안(A) → 백엔드(B) → 프론트(C).

**재사용 패턴(코드베이스 기존 선례)**

- 독립 커밋: `domain/log/listener/AuditLogWriter.java:26`(`@Transactional(propagation = REQUIRES_NEW)` + `entityManager.flush()`, 별도 빈), 호출부 `AuditLogPersister.writeSafely`(try/catch 격리). 그 외 `FileUploadUnitService:55`, `NotificationOutboxService:26`, `NotificationDispatchService:32`, `NotificationEventListener:51,85`.
- 관측: `AuditFailureRecorder`(Micrometer 카운터 `<area>.<event>.failure` + 문맥 `log.warn/error`, 제한된 태그, `ThreadLocal` 재진입 가드).
- 격리 통합 테스트: `domain/log/listener/AuditFailureIsolationIT.java`(`@Tag("it")`, `@SpringBootTest`, `@ActiveProfiles("test-it")`, `OracleAvailableCondition`, `TransactionTemplate` + `@MockitoSpyBean` + `JdbcTemplate` COUNT 대조).
- 프론트 warnings-list: `stores/review.ts`(warnings 반환) → `pages/info/documents/[id]/review.vue`(`notifyLoadWarnings`로 toast·인라인 표면화). 실패 시 이전 상태 되돌림 선례: `review.ts viewVersion`의 `viewingVersion.value = null`.

---

## 3. Phase A — 🟠 보안 트랜잭션 무결성

대상 파일(공통): `common/system/service/AuthService.java`(클래스 레벨 `@Transactional` 없음, 메서드별 부여).

### 3.1 SEC-08 · Refresh Token 재사용 탐지 시 패밀리 폐기 커밋 보장

**현황/격차 (확인됨)**

- `refreshAccessToken`(line 216, `@Transactional`)은 재사용/만료 탐지 시 삭제 후 **같은 트랜잭션에서** `InvalidRefreshTokenException`(`extends RuntimeException`)을 던진다.
  - 재사용 분기: `refreshTokenRepository.deleteByEno(...)`(line 245) → `throw`(line 247). 기본 롤백 규칙(unchecked)으로 **line 245 삭제가 롤백**된다 → 패밀리가 DB에 잔존.
  - 만료 분기: `refreshTokenRepository.delete(refreshToken)`(line 254) → `throw`(line 255). 동일 결함.
  - grace 분기(line 239 throw)는 삭제가 없어 무관. DB 미스 경로(`findRefreshTokenByValue`, 500-504)도 삭제 없음.
- **단순 `REQUIRES_NEW` 삭제 빈만으로는 교착 위험**: 탐지 read가 `RefreshTokenRepository.findByEcyRnwPubTokCone`(line 55, `@Lock(PESSIMISTIC_WRITE)`)로 토큰 행을 잠근다. `REQUIRES_NEW` inner TX가 그 잠긴 행을 `deleteByEno`로 지우려 하면, suspend된 outer TX가 쥔 락을 기다려 self-deadlock(락 타임아웃까지 정지)이 발생한다. `AuditLogWriter` 선례가 안전한 이유는 INSERT(경합 없음)이기 때문이고, 여기서는 outer가 잠근 행을 DELETE하므로 경합 프로파일이 다르다.

**목표**: 재사용/만료 탐지 시 패밀리 폐기가 인증 거부와 무관하게 **확정 커밋**되며, 비관적 락 교착이 없고, SEC-01 회전 동시성 불변식을 보존한다.

**조치 설계 (2-트랜잭션 분리)**

1. `refreshAccessToken`을 **비트랜잭션 오케스트레이터**로 전환. 잠금 read + 회전 판정은 **별도 협력 빈**의 `@Transactional` 메서드 `rotate(refreshTokenValue)`로 분리(SEC-01의 `@Lock(PESSIMISTIC_WRITE)` 회전 로직은 `rotate()` 안에서 그대로 유지). **반드시 별도 빈이어야 한다** — 같은 `AuthService` 내부 메서드로 두면 프록시 self-invocation으로 `@Transactional`이 무시되어 TX 분리가 성립하지 않는다(`RefreshTokenRevoker`/`LoginHistoryWriter`를 별도 빈으로 두는 이유와 동일).
2. `rotate()`는 정상 경로에서 회전 후 새 토큰을 반환한다. **재사용/만료 탐지 시 삭제하지 않고** 타입 마커 예외(`RefreshReuseDetectedException(eno)` / `RefreshExpiredException(eno)` — 내부 신호 전용, 인증 거부용 아님)를 던진다. 이 예외로 `rotate()`의 내부 TX가 롤백되며 **비관적 락이 해제**된다(탐지 시점까지는 read만 했으므로 롤백해도 유실 없음).
3. 신규 빈 `RefreshTokenRevoker`(`@Component`):
   - `revokeFamilyByEno(String eno)` — `@Transactional(propagation = REQUIRES_NEW)`, `refreshTokenRepository.deleteByEno(eno)` + `entityManager.flush()`.
   - `revokeSingle(...)`(만료 단일 토큰용, 필요 시) — 동일 격리. (`deleteByFamNm`은 없으며 패밀리 폐기는 user-wide `deleteByEno`가 관례.)
4. 오케스트레이터는 마커 예외를 catch → `RefreshTokenRevoker.revoke...()` 호출(이 시점엔 `rotate()` 내부 TX가 이미 종료되어 **락 없음** → 교착 없음, 독립 커밋) → 그 다음 `throw new InvalidRefreshTokenException()`(기존 인증 거부 계약·쿠키 삭제 흐름 유지).

> 검증 선행: 계획 단계에서 탐지 read가 실제로 `PESSIMISTIC_WRITE`인지 확정한다. 잠금이 없다면 단순 `REQUIRES_NEW` 폐기 빈으로 충분하지만, 위 2-TX 구조는 두 경우를 모두 포섭하므로 기본 설계로 채택한다.

**영향 파일**: `common/system/service/AuthService.java`, 신규 `RefreshTokenRevoker`(+ 필요 시 `rotate()`를 담을 협력 빈), 내부 신호 예외 2종. (엔티티/리포지토리 시그니처 변경 없음.)

**검증**: §3.3.

### 3.2 SEC-09 · 로그인 실패 이력의 독립 커밋과 계정 잠금 복원

**현황/격차 (확인됨, 상시 발생)**

- `login`(line 153, `@Transactional`)의 두 실패 분기는 `recordLoginFailure(...)` 저장(내부 `loginHistoryRepository.save`, line 562) 직후 **무조건** `RuntimeException`을 던진다(존재하지 않는 사번 162→163, 비밀번호 불일치 169→170). 저장된 `Clognh` 실패 행이 `login` 트랜잭션과 함께 **항상 롤백**된다.
- 결과: `LoginAttemptService.checkLocked`(line 38, `@Transactional(readOnly=true)`)가 세는 `LOGIN_FAILURE` 행이 커밋되지 않아 카운트가 0에 머물고, `MAX_FAILURES=5`(line 24)/`WINDOW_MINUTES=10`(line 25) 잠금이 **발동 불가**. SEC-03 브루트포스 방어가 무력화됨.
- `recordLoginSuccess`(line 181)는 이후 throw가 없어 정상 커밋 → 성공 행만 남고 실패 행만 유실.
- 실패 이력은 INSERT라 락 경합이 없다 → `AuditLogWriter`형 단순 독립 커밋으로 충분(SEC-08과 달리 교착 무관).

**목표**: 로그인 실패 이력이 로그인 거부와 무관하게 커밋되어 계정 잠금 근거가 남는다.

**조치 설계**

1. 신규 빈 `LoginHistoryWriter`(`@Component`): `recordFailure(Clognh failure)` — `@Transactional(propagation = REQUIRES_NEW)`, `loginHistoryRepository.save(...)` + `entityManager.flush()`.
2. `AuthService.recordLoginFailure`의 저장을 `loginHistoryWriter.recordFailure(...)`로 대체. 기존 throw는 유지 → 실패 행이 독립 커밋되어 잔존.
3. 성공 경로는 변경하지 않는다(정상 커밋).

**영향 파일**: `common/system/service/AuthService.java`, 신규 `LoginHistoryWriter`. (`LoginAttemptService`·리포지토리·엔티티 변경 없음.)

### 3.3 Phase A 검증

- **통합(`@Tag("it")`)**: `AuditFailureIsolationIT`를 모델로 신설.
  - SEC-08: 회전(`avlYn='N'`)된 토큰을 grace 이후 재사용 → `refreshAccessToken` 호출 → `InvalidRefreshTokenException` 확인 **및** `JdbcTemplate`로 해당 `eno`의 `TPRMPP_CRTOKM` 패밀리 행 `COUNT(*) = 0` 확인. 만료 토큰 분기도 동일하게 삭제 잔존 확인.
  - SEC-09: 오답 로그인 N회 → `Clognh` 실패 행 `COUNT(*) = N`이 커밋 잔존 확인, 5회째 `checkLocked`가 `CustomGeneralException`(계정 잠금)을 던지는지 확인.
- **단위 갱신**: `AuthServiceTest`(순수 Mockito, 트랜잭션 부재로 두 결함을 구조적으로 검출 못함)를 신규 협력 빈(`RefreshTokenRevoker`/`LoginHistoryWriter`) 호출 검증으로 갱신. 기존 `refreshAccessToken_재사용탐지_패밀리폐기`(405-427), `login_비밀번호불일치_실패이력저장`(131-154)은 새 협력자 기준으로 재작성.
- **인증 공통 변경 게이트**: `./gradlew clean test`(it_backend/CLAUDE.md §9).

---

## 4. Phase B — 🟠 백엔드 오류 표면화

### 4.1 ERR-08 (+BE-13) · 평가 스냅샷 손상과 정상 빈 결과를 구분, 기준 계획 결정적 조회

> **2026-07-25 현행 재확인(중요 정정)**: 최초 조사가 stale한 옛 코드 상태를 보고했다. 실제 코드를 직접 읽어 확인한 결과, ERR-08은 **대부분 이미 조치되어 있고 BE-13은 완료 상태**다. 아래 현황은 실제 현행 기준이며, 남은 작업은 "손상 스냅샷 시 화면 전체 500" → "부분 데이터 + 불완전 플래그(우아한 저하)"로의 **설계 개선**이다(사용자 결정).

대상 파일: `domain/council/service/PlanEvaluationService.java`(`@Slf4j` **있음**, line 40), DTO `domain/council/dto/CouncilDto.java`, 소비자 `domain/council/controller/CouncilController.java`.

**현황/격차 (실제 현행 확인)**

| 경로 | 위치 | 현재 동작 |
| --- | --- | --- |
| 사업 목록 파싱 | `parseSnapshotBusinesses` 151-174 | 빈/null=빈 목록(정상). 파싱 실패 → `log.error` + **`DataCorruptionException` throw**(169-171, 광역 `catch(Exception)`) → 엔드포인트 500 |
| 전산업무비 건수 | `countCostDetails` 184-195 | 빈/null=0(정상). 파싱 실패 → `log.error` + **`DataCorruptionException` throw**(191-193, 광역 `catch(Exception)`) |
| 사업명 해석 | `resolveBusinessNames` 398-423 | `getPlan`은 try 밖(403, 실패 전파). 파싱 실패 → `log.warn` + 빈 맵 → 호출부 관리번호 폴백(419-420) |
| 기준 계획 탐색 | `findBaselinePlan` 219-235 | **이미 결정적 조인 쿼리** `councilRepository.findBaselineReqDocNos("02","13",bseYy,"신규",...,PageRequest.of(0,1))`(`CouncilRepository.java:76`). 0행=null, `getPlan` 실패 전파. **N+1·catch-all 없음 → BE-13 완료** |

- **BE-13 완료**: `findBaselineReqDocNos`(JPQL, `ORDER BY c.fstEnrDtm DESC, c.itPtlAsctId DESC` + Pageable 단건)와 통합 테스트(`CouncilBaselineLookupIt`)가 이미 존재. 본 항목에서는 **검증만** 수행하고 완료 이관한다.
- 남은 격차: (a) `parseSnapshotBusinesses`·`countCostDetails`의 파싱 실패가 화면 전체를 500으로 만든다(부분 데이터 미제공). (b) 두 곳이 광역 `catch(Exception)`이라 파싱 아닌 예외까지 "손상"으로 오분류할 여지(try 본문이 순수 파싱이라 실현 위험은 낮으나 계약상 부정확). (c) 응답 DTO(`PlanTargetsResponse`, `PlanResultSummaryResponse`)에 불완전 신호 필드가 없어 부분 데이터를 표현할 수 없다. (d) `parseSnapshotBusinesses`와 `resolveBusinessNames`가 같은 `redtConeInf`를 공용 `SNAPSHOT_MAPPER`로 중복 파싱.

**목표(우아한 저하)**: 파싱 실패 시 화면 전체를 실패시키지 않고, **파싱된 부분은 반환**하되 응답에 **명시적 불완전 플래그**로 표시한다. 로그는 유지, DB·권한 예외는 계속 전파. BE-13은 검증 후 완료 이관한다.

**조치 설계**

1. **파싱 실패 처리 전환(핵심)**: `parseSnapshotBusinesses`·`countCostDetails`의 광역 `catch(Exception)` + `DataCorruptionException` throw를 **`catch(JsonProcessingException)`(정확한 클래스는 import 기준)** → `log.warn`(문맥 `reqDocNo`) + **부분 결과 반환 + 불완전 신호 세팅**으로 바꾼다. 파싱 아닌 예외는 전파(광역 catch 제거로 자동). `resolveBusinessNames`의 warn+관리번호 폴백도 동일 불완전 신호에 편입.
2. **불완전 신호 필드**: `PlanTargetsResponse`·`PlanResultSummaryResponse`(record)에 `boolean snapshotIncomplete` 컴포넌트 추가(JSON 신규 필드라 하위 호환). `CouncilController`는 그대로 통과.
3. **중복 파싱 통합**: 두 곳의 스냅샷 파싱을 단일 헬퍼(`ParsedSnapshot`/`parseSnapshot`)로 통합.
4. **BE-13 검증**: `findBaselineReqDocNos`의 결정적 정렬·전파 계약을 기존 단위·`CouncilBaselineLookupIt`로 회귀 확인(신규 구현 없음). 완료 이관 근거로 기록.
5. **프론트 최소 표면화**: 협의회 결과 화면이 `snapshotIncomplete=true`일 때 배너("일부 스냅샷을 해석하지 못했습니다") 노출.
6. **테스트 갱신**: `PlanEvaluationServiceTest`에서 파싱 실패를 검증하는 테스트를 "`DataCorruptionException` 기대"에서 "`snapshotIncomplete=true` + 부분 데이터" 기대로 전환(현재 코드가 이미 throw하므로 RED가 뒤집힌다는 점을 실행자에게 명시). DB 예외 전파 테스트는 유지.

**영향 파일**: `domain/council/service/PlanEvaluationService.java`, `domain/council/dto/CouncilDto.java`, 기준계획 조인 쿼리 리포지토리, `domain/council/controller/CouncilController.java`(변경 최소), 협의회 결과 화면 컴포넌트(배너), 관련 테스트.

**검증**: 파싱 실패 주입→불완전 플래그+경고 로그+부분데이터, 미존재→정상 빈 결과(무플래그), DB 예외→전파(폴백 안 함), 기준계획 동률 입력→결정적 단일 선택. 조인 쿼리 EXPLAIN 확인(필요 시 조건부 인덱스).

### 4.2 ERR-09 · 네이티브 조회 타입 변환 실패를 실제 NULL과 구분

대상 파일: `common/util/NativeRowMapper.java`(69줄, static 유틸, private 생성자).

**현황/격차 (확인됨)**

- `toLd`(line 32)만 조용히 null: 잘못된 날짜 문자열 parse 실패(catch 46-49, `return null` 48), 미지원 타입 fallthrough(52-53). 형제 `toLdt`(28)/`toLong`(60)/`toInt`(67)는 이미 `IllegalStateException`을 던진다.
- 반환 null이 실제 SQL NULL과 바이트 동일하고, **호출부 중앙 로깅이 없다**.
- 영향 날짜 필드 4개: `CouncilProjectRow`(`toLd r[6]` cnrcDt 84, `r[13]` sttDt 91, `r[14]` endDt 92), `RecentReviewingRow`(`toLd r[4]` fsgTlm 40). 두 DTO 주석이 "DATE/String yyyyMMdd 혼용"을 명시 — parse 실패가 실제로 도달 가능한 컬럼.

**목표**: 변환 실패를 실제 NULL과 구분해 중앙에서 관측 가능하게 한다. 리스트/대시보드 read라 한 건 불량이 화면 전체를 깨지 않게 한다.

**조치 설계 (throw 대신 중앙 진단 채택)**

- 형제 메서드는 예외를 던지지만, `toLd` 대상은 목록·대시보드 표시 날짜라 한 건의 레거시 불량 값으로 전체 read를 500 처리하는 것은 UX상 부적절하다. TASK.md가 "예외 전파 **또는** 공통 경고 정책"을 모두 허용하므로, 호출부 부재 로깅을 해소하는 **중앙 경고**를 채택한다(코드베이스 관측 관례와 정합).
- `NativeRowMapper`에 static SLF4J 로거 추가. `toLd`:
  - `v == null` 또는 blank 문자열 → `null`(실제 NULL, 무경고).
  - `java.sql.Date`/`LocalDate`/`Timestamp` 등 지원 타입 → 변환.
  - 불량 문자열(parse 실패)·미지원 타입 → **원본 값 + 실제 클래스(타입) 문맥을 포함한 `log.warn`** 후 `null` 반환.
- 결과: 반환값은 두 경우 모두 null이지만, 변환 실패는 중앙 로그로 구분·관측된다. 호출부(Row DTO `fromRow`) 시그니처 변경 없음(파급 최소).

> Micrometer 카운터는 `NativeRowMapper`가 스프링 빈이 아니어서(정적 유틸, 다수 호출부가 static 사용) 이번 범위에서 제외한다. 로그 기반 관측으로 충분하며, 향후 빈 전환 시 카운터 추가를 잔여로 남긴다.

**영향 파일**: `common/util/NativeRowMapper.java`. (호출부 무변경.)

**검증**: `NativeRowMapperTest`의 silent-null 4건(200-204, 187-189, 193-197, 213-217) 갱신 — 실제 null/blank는 null 유지, 불량 데이터는 null 반환 **및** Logback `ListAppender`로 문맥 warn 발생을 검증(형제 메서드의 throw 테스트 102-118/254-266/308-320와 대비되는 진단 계약). 통합 매핑 테스트(`CouncilProjectRowMappingIt`, `ServiceRequestDocDashboardMappingIt`)는 회귀 확인.

---

## 5. Phase C — 🟠 프론트 오류 상태 (ERR-10)

정책: it_frontend/CLAUDE.md §2(스토어는 toast 직접 호출 금지·warnings 반환, 컴포넌트가 표면화; `console.error`만 남기고 종료 금지), §4(통화=`useProjectCurrencies`·`TOAST_LIFE`), §6(변수 삽입 후 `resolveTokens`·최신 맵 병합·stale 무시).

두 유형으로 나뉜다 — (a) 사용자 시작 핵심 동작(표면화 + stale 상신 차단), (b) 공용 조회 폴백(실패 vs 정상 빈결과 구분).

### 5.1 통화 조회 공용 컴포저블 통합 (cost/form.vue + TerminalFormDialog.vue)

**현황**: 두 화면이 공용 `useProjectCurrencies`(`composables/useProjectCurrencies.ts`, catch 53-58에서 `loadError=true` 노출)를 쓰지 않고 인라인 복제 — CLAUDE.md §4 위반.

- `pages/info/cost/form.vue`: 인라인 `loadCurrencyOptions`(205-227), catch 222-225 `console.warn`만, `currencyOptions`가 `['KRW']`(198) 유지, **오류 ref 자체가 없음**. 추가로 `currencyAutoFillMap`(xcr+xcrBseDt, 199-221) 생성.
- `components/cost/TerminalFormDialog.vue`: 인라인 `loadOptions`(155-183)의 통화 호출(161-165)만 `.catch(()=>[])`로 삼킴 → KRW 축소. 나머지 옵션은 未catch라 `loadAll` catch(254-266)의 `loadError`+toast+재시도 버튼(템플릿 407-420)으로 이미 처리됨.

**조치**: `useProjectCurrencies`에 `currencyAutoFillMap`(cost/form용)·`previewRates`(TerminalFormDialog용) 산출을 흡수. 두 화면의 인라인 복제 제거 후 공용 `loadError`를 표면화 — cost/form은 인라인 오류+재시도 신설, TerminalFormDialog는 통화 호출의 `.catch(()=>[])` 제거해 기존 `loadAll` 오류 경로에 편입. `TOAST_LIFE` 사용. ERR-10 + §4 위반 동시 해소.

### 5.2 사용자 시작 핵심 동작

- **`components/council/result/ResultReviewProgress.vue`**(watcher 47-67, catch 55-64): 자동 배경 동기화라 마지막 정상 상태 유지·자동재시도는 두되(§2), 오류 분류 도입 — 4xx(이미 11/12/13 상태·권한)=억제+진단 로그, 5xx/네트워크=`warnOncePerMinute`(선례 `useTableCellSelection.ts:101-108`)로 throttle된 toast + **명시적 재시도 컨트롤**(watcher 재실행에만 의존하지 않음). `syncReviewStatus`(useCouncil)의 오류에서 상태 코드로 분류.
- **`pages/info/projects/report.vue`**(generatePdf 176-204): "URL 미반환"(비throw) 분기(184-193)가 현재 `console.error`만 하고 **stale `pdfUrl` 유지 → 오래된 미리보기로 상신 가능**(submitApproval 268-327이 PDF 재검사 없음). throw 분기(catch 194-203)처럼 `pdfError` 설정 + 오류 toast + 재시도, stale URL 재사용 차단, `submitApproval`에 유효 PDF 가드 추가.

### 5.3 TiptapEditor 토큰 해석 상태 구분

**현황**: `components/TiptapEditor.vue` `resolveMissingVariables`(241-277) catch(268-275)가 실패를 `'STALE'`로 설정 — 성공 경로의 `'MISSING'`(264) 및 `useTiptapVariables.resolveTokens`의 네트워크 오류 전체 STALE 마킹과 **의미 중첩** → 실패가 "이전 값"과 시각적으로 구분 불가.

**조치**: `ResolvedValue` 상태에 실패 전용 값(예: `'ERROR'`) 도입 — 권한없음·데이터없음·일시오류를 STALE에 합치지 않음. throttle 진단 + 칩 인라인 표시(같은 파일의 `metadataError` 재시도 Message 모델 208-228/524-534 준용). `useTiptapVariables`와 칩 렌더·관련 테스트(`useTiptapVariables.test.ts` STALE 케이스 line 165) 동반 갱신.

### 5.4 Phase C 검증

- Vitest: `useProjectCurrencies` 통합(기존 loadError 테스트 54-68 확장), `useTiptapVariables` 신규 상태, `report.vue generatePdf` 빈-URL 분기 로직, `ResultReviewProgress` 오류 분류. (컴포넌트 mount 대신 로직 레벨 — 기존 관례.)
- 수동 QA 체크리스트(ERR-07 선례): 각 경로 fetch/parse 실패 주입 시 정상 빈결과와 구분되는 경고·재시도 노출, stale 상신 차단, 토큰 실패/이전값 구분 확인.
- `npm run check`·`npm test`·`npm run test:e2e:core`.

---

## 6. 리스크와 완화

| 리스크 | 완화 |
| --- | --- |
| SEC-08 `REQUIRES_NEW` 삭제의 비관적 락 교착 | 2-TX 분리(§3.1): 잠금 read TX 종료 후 폐기 실행 |
| SEC-08/09 인증 공통 변경이 로그인·갱신 흐름을 깸 | `./gradlew clean test` + 격리 통합 테스트로 커밋 잔존 양방향 검증 |
| ERR-08 예외 전파가 기존 화면의 폴백 의존을 깸 | 파싱 실패는 부분데이터+불완전 플래그로 유지, DB·권한만 전파. 관련 3 테스트 갱신, 프론트 배너로 표면화 |
| ERR-08 조인 쿼리 성능 | 실행계획 검증, 필요 시에만 조건부 Flyway 인덱스(로컬 자동·dev/prod DBA) |
| ERR-09 중앙 로그가 반환값을 바꾸지 않아 데이터 레벨 구분 부재 | 관측(로그) 레벨 구분으로 요건 충족(TASK.md 허용 범위), 리스트 read 복원력 우선. 향후 카운터는 잔여 |
| ERR-10 Tiptap 상태 추가 파급 | 칩 렌더·`useTiptapVariables` 테스트 동반 갱신 |
| ERR-10 통화 컴포저블 통합 시 자동채움/환율맵 차이 | 두 화면 산출을 컴포저블에 먼저 흡수한 뒤 소비 전환, 회귀 테스트 |

---

## 7. 미결 항목 (계획 작성 중 확정 완료)

1. **SEC-08 탐지 read 잠금 모드** — **확정**: `RefreshTokenRepository.findByEcyRnwPubTokCone`/`findByFamNmAndAvlYn`가 `@Lock(PESSIMISTIC_WRITE)`. 2-TX 분리가 필수(단순 `REQUIRES_NEW` 삭제는 self-deadlock).
2. **ERR-08 기준계획 조인** — **확정(이미 구현)**: `CouncilRepository.findBaselineReqDocNos`(JPQL, `Basctm`↔계획, `ORDER BY c.fstEnrDtm DESC, c.itPtlAsctId DESC` + Pageable). BE-13 완료 → 검증만.
3. **ERR-08 불완전 신호 형태** — **확정**: `boolean snapshotIncomplete`.
4. **ERR-08 조인 인덱스** — **불필요(BE-13 완료)**: 기존 쿼리·인덱스로 충족. 신규 Flyway 없음.
5. **ERR-10 Tiptap 실패 상태 명칭** — **확정**: `'ERROR'` 상태 도입. 단, `resolveTokens`(4개 읽기전용 화면이 STALE 계약 의존)는 불변으로 두고 에디터 단건 경로(`resolveInsertedToken`)에서만 STALE→ERROR 승격.

---

## 8. 다음 단계

본 스펙 승인 후 `writing-plans` 스킬로 Phase별 구현 계획(plan)을 작성한다. Phase A(보안) 계획을 우선 수립하고, Phase B·C를 순차 진행한다. 완료 항목은 `TASK.md` → `TASK_DONE.md` 이관 규약을 따른다(SEC-08/09, ERR-08~10, BE-13).
