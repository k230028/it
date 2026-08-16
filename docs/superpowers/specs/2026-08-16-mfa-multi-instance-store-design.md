# MFA 거래 저장소 다중 인스턴스 지원 설계 (SEC-13)

- 작성일: 2026-08-16
- 대상 과제: `TASK.md` SEC-13 (MFA 거래의 다중 인스턴스 지원)
- 전제: Redis 등 별도 캐시 서버를 운영하지 않는다. 공유 저장소는 기존 Oracle을 사용한다.

## 1. 배경

로그인 대기 거래와 MFA 거래를 애플리케이션 메모리에만 두어 서버 재시작 시 진행 중 거래가 폐기되고 다중 인스턴스 배포를 지원하지 못한다. [`2026-08-10-internal-mfa-integration-design.md`](done/2026-08-10-internal-mfa-integration-design.md) §8에서 이번 범위 제외로 두었던 항목이며, WAS 다중화가 예정되어 해소가 필요해졌다.

## 2. 공유해야 하는 상태

MFA 흐름은 4단계에 걸쳐 서버 상태를 읽고 쓴다. TTL은 `app.mfa.challenge-ttl` 기본값 90초다.

| 단계 | 요청 | 상태 |
| --- | --- | --- |
| 1 | `POST /api/auth/login/start` | `LoginPendingTransaction` 저장, `mfa-login-pending` 쿠키 발급 |
| 2 | `POST /api/mfa/challenges` | 1을 조회해 소유자 확인, OnePass 호출, `MfaTransaction`과 `svcTrId` 저장 |
| 3 | `POST /api/mfa/challenges/{id}/verify` | 2를 조회. FIDO는 3초 주기 폴링. 승인 시 증표 해시 결속, `mfa-proof` 쿠키 발급 |
| 4 | 로그인 완료 또는 `@MfaRequired` 결재 명령 | 증표를 1회 소비 |

인스턴스 로컬 상태는 네 곳에 있다.

1. `InMemoryMfaTransactionStore` — `transactions`(거래 토큰 해시 키), `proofTransactions`(증표 해시 키)
2. `InMemoryLoginPendingTransactionStore` — `transactions`
3. `MfaService`의 `knownExpiryByTokenHash`, `cancelledExpiryByTokenHash` — 만료·취소 판별 보조
4. `FidoMfaProvider.pendingByTransactionId` — OnePass `svcTrId` 보관

3과 4는 저장소 인터페이스 밖에 있어 저장소 구현만 교체하면 남는다. 특히 4가 위험하다. 폴링이 challenge를 시작한 인스턴스가 아닌 곳으로 가면 `FidoMfaProvider.verify`가 `undecided()`가 아니라 `failure()`를 반환해 실패로 집계되고, 3초 폴링 × `app.mfa.max-failures`(기본 5) = 약 15초 만에 거래가 `LOCKED`가 된다. 사용자는 휴대폰에서 승인할 기회를 잃는다.

## 3. 접근 방식

| 안 | 내용 | 판단 |
| --- | --- | --- |
| A | Oracle 공유 테이블 | **채택** |
| B | LB 세션 고정(sticky) + 메모리 유지 | 롤링 배포·인스턴스 장애 시 진행 중 거래 소멸. LB 설정이 정합성의 전제가 됨 |
| C | 임베디드 분산 캐시(Hazelcast 등) | 클러스터 포트·스플릿브레인 운영 부담이 Oracle보다 큼 |

A를 채택하는 근거는 셋이다.

- 필요한 원자성이 전부 **단일 UPDATE의 영향 행 수**로 표현된다. 분산 락도 `SELECT FOR UPDATE`도 필요 없다.
- `TPRMPP_CRTOKM`이 이미 Refresh Token을 `ECY_RNW_PUB_TOK_CONE`(SHA-256 HEX)로 Oracle에 보관한다. 인증 토큰 해시를 DB에 두는 것은 이 시스템의 기존 자세와 어긋나지 않는다.
- Oracle은 이미 백업·모니터링 체계 안에 있어 신규 운영 대상이 늘지 않는다.

## 4. 테이블 설계

명명은 `TPRMPP_C{4자}M` 관례(`CRTOKM`, `CCODEM`, `CMENUM`)를 따른다.

| 테이블 | 대응 인터페이스 |
| --- | --- |
| `TPRMPP_CMFTRM` | `MfaTransactionStore` |
| `TPRMPP_CMFLPM` | `LoginPendingTransactionStore` |

### 4.1 TPRMPP_CMFTRM (MFA거래마스터)

MFA 거래를 **한 테이블**로 둔다. 현재 메모리 구현은 거래 토큰 키 맵과 증표 키 맵 두 개를 쓰느라 `verifyAndBindProof`에서 `synchronized` 블록으로 두 맵 사이를 옮기고 실패 시 되돌린다. 한 행에 두 해시 컬럼을 두고 각각 인덱스를 걸면 그 전이가 UPDATE 한 문장이 되어 되돌림 로직이 사라진다.

| 컬럼 | 한글명 | 타입 | 제약 | 설명 |
| --- | --- | --- | --- | --- |
| `CER_TR_TOK_CONE` | 인증거래토큰내용 | `VARCHAR2(64 CHAR)` | PK | 서버 challengeId(UUID)의 SHA-256 HEX |
| `ENO` | 사원번호 | `VARCHAR2(32)` | NOT NULL | 거래 소유자 |
| `USG_TC` | 용도구분코드 | `VARCHAR2(1)` | NOT NULL | `1`=LOGIN, `2`=APPROVAL |
| `CER_MNS_TC` | 인증수단구분코드 | `VARCHAR2(2)` | NOT NULL | `10`=FINGER_VEIN, `20`=FIDO, `30`=MOTP |
| `CER_STS_C` | 인증상태코드 | `VARCHAR2(2)` | NOT NULL | §4.3 |
| `END_DTM` | 종료일시 | `TIMESTAMP(3)` | NOT NULL | 만료 시각 |
| `VRF_DTM` | 검증일시 | `TIMESTAMP(3)` | NULL | 검증 완료 시각 |
| `FLUR_NOT` | 실패횟수 | `NUMBER(5)` | NOT NULL, 기본 0 | |
| `CER_CHLG_TOK_CONE` | 인증challenge토큰내용 | `VARCHAR2(64 CHAR)` | NULL | 공급자 challenge 식별자의 SHA-256 HEX |
| `CRTT_TOK_CONE` | 증표토큰내용 | `VARCHAR2(64 CHAR)` | NULL, UNIQUE | 1회용 증표의 SHA-256 HEX |
| `SVC_TRNO` | 서비스거래번호 | `VARCHAR2(20)` | NULL | OnePass `svcTrId` 원문 |

`SVC_TRNO`만 원문이고 나머지 식별자는 전부 해시다. `confirmFido(svcTrId)` 호출에 원문이 필요해 해시로 둘 수 없다. OnePass가 발급한 거래 식별자이며 사용자 비밀이 아니므로 원문 보관이 타당하다. 이 컬럼이 생기면 `FidoMfaProvider`의 로컬 맵과 LRU 축출 로직(`maxPendingTransactions`)이 전부 제거된다.

`CRTT_TOK_CONE`의 UNIQUE 인덱스는 Oracle이 전 컬럼 NULL 행을 유니크 인덱스에 넣지 않으므로 증표 미결속 행이 아무리 많아도 충돌하지 않는다.

### 4.2 TPRMPP_CMFLPM (MFA로그인대기마스터)

| 컬럼 | 한글명 | 타입 | 제약 |
| --- | --- | --- | --- |
| `CER_TR_TOK_CONE` | 인증거래토큰내용 | `VARCHAR2(64 CHAR)` | PK |
| `ENO` | 사원번호 | `VARCHAR2(32)` | NOT NULL |
| `END_DTM` | 종료일시 | `TIMESTAMP(3)` | NOT NULL |

### 4.3 인증상태코드

`MfaTransactionStatus`에 `CANCELLED`, `CONSUMED`를 추가한다.

| 코드 | enum | 비고 |
| --- | --- | --- |
| `10` | `PENDING` | |
| `20` | `VERIFIED` | |
| `30` | `LOCKED` | 실패 횟수 초과 |
| `40` | `CANCELLED` | 사용자가 대화상자를 닫음 |
| `50` | `CONSUMED` | 증표 1회 소비 완료 |

`EXPIRED`는 저장하지 않고 `END_DTM` 비교로 파생한다.

현재 메모리 구현은 소비·취소 시 항목을 `remove` 해버려 "만료됨"과 "취소됨"과 "없음"을 구분하지 못하고, 그 보완이 `MfaService`의 로컬 맵 두 개였다. 행을 상태와 함께 남기면 두 맵이 제거되고 `findActiveTransaction`의 사유 판정이 정확해진다.

이 코드값은 화면 표시용이 아니라 내부 판정용이므로 공통코드(`TPRMPP_CCODEM`)에 등재하지 않는다.

### 4.4 인덱스

PK 제약이 `CER_TR_TOK_CONE` 인덱스를 소유한다. 그 밖의 인덱스는 `IX_{테이블명}_##` 규칙을 따른다.

| 인덱스 | 대상 | 용도 |
| --- | --- | --- |
| `UX_TPRMPP_CMFTRM_01` | `(CRTT_TOK_CONE)` UNIQUE | 증표 조회, 중복 결속 차단 |
| `IX_TPRMPP_CMFTRM_02` | `(END_DTM)` | 만료 행 정리 배치 |
| `IX_TPRMPP_CMFLPM_01` | `(END_DTM)` | 만료 행 정리 배치 |

시퀀스는 사용하지 않는다. PK가 해시값이다.

## 5. 원자적 연산

모든 상태 전이는 조건부 UPDATE 한 문장이며, 영향 행 수 1이 성공이다. 동시 요청 중 정확히 한 건만 1을 받으므로 "1회 소비" 보장은 DB가 담당한다.

```sql
-- consumeVerifiedOnce
UPDATE TPRMPP_CMFTRM
   SET CER_STS_C = '50'
 WHERE CRTT_TOK_CONE = :proofHash
   AND ENO = :eno AND USG_TC = :purpose
   AND CER_STS_C = '20' AND END_DTM > :now
```

```sql
-- verifyAndBindProof (두 맵 전이를 대체)
UPDATE TPRMPP_CMFTRM
   SET CER_STS_C = '20', VRF_DTM = :now, CRTT_TOK_CONE = :proofHash
 WHERE CER_TR_TOK_CONE = :tokenHash
   AND CER_STS_C = '10' AND END_DTM > :now
```

```sql
-- fail (증가와 잠금 판정을 한 문장으로)
UPDATE TPRMPP_CMFTRM
   SET FLUR_NOT = FLUR_NOT + 1,
       CER_STS_C = CASE WHEN FLUR_NOT + 1 >= :maxFailures THEN '30' ELSE '10' END
 WHERE CER_TR_TOK_CONE = :tokenHash
   AND CER_STS_C = '10' AND END_DTM > :now
```

```sql
-- cancelChallenge
UPDATE TPRMPP_CMFTRM
   SET CER_STS_C = '40'
 WHERE CER_TR_TOK_CONE = :tokenHash
   AND CER_STS_C = '10' AND END_DTM > :now
```

0행이면 사유(만료·취소·상태 불일치·미존재)를 판별하는 SELECT를 한 번 더 수행해 `MfaErrorCode`를 정한다. 이때도 원문은 조회하지 않고 상태와 만료 시각만 읽는다.

`consumeVerifiedOnce`의 반환값 `ProofConsumption`은 다음으로 매핑한다.

| 결과 | 조건 |
| --- | --- |
| `CONSUMED` | UPDATE 1행 |
| `EXPIRED` | 0행이고 행이 존재하며 `END_DTM <= :now` |
| `REJECTED` | 0행이고 행이 존재하며 사번·용도·상태 불일치 |
| `MISSING` | 0행이고 행 없음 |

### 5.1 소비 대상 컬럼 한정

메모리 구현의 `consumeVerifiedOnce`는 증표 맵을 먼저 보고 없으면 거래 맵을 다시 본다. 이 폴백은 `MfaTransactionStore.verify()`가 거래를 증표 결속 없이 `VERIFIED`로 올리는 경로를 위한 것인데, **`verify()`는 운영 코드에 호출부가 없다.** `MfaService`는 `verifyAndBindProof()`만 사용하므로 `VERIFIED` 거래에는 항상 증표 해시가 결속된다.

따라서 신규 구현은 `CRTT_TOK_CONE`만 대상으로 하고 거래 토큰으로 증표를 소비하는 경로를 두지 않는다. 사용되지 않는 `verify()`는 인터페이스에서 제거해 두 구현이 같은 계약을 갖게 한다.

## 6. 접근 계층과 트랜잭션 경계

### 6.1 접근 계층

`common/mfa/store/`에 `JpaMfaTransactionStore`, `JpaLoginPendingTransactionStore`를 추가하고 기존 `InMemory*` 구현은 단위 테스트용으로 남긴다.

접근 방식은 **JPA 엔티티 + Spring Data `@Modifying @Query`(nativeQuery)** 로 한다. 프로젝트에 `JdbcTemplate` 사용처가 없어 새 영속성 관용구를 들이지 않는 쪽을 택했다. `@Modifying`은 UPDATE 영향 행 수를 `int`로 반환하므로 §5의 판정을 그대로 표현한다.

두 엔티티는 다음 규칙을 **예외 적용**한다. 근거는 수명 90초의 휘발성 인증 상태이고 업무 데이터가 아니라는 점이다.

| 규칙 | 예외 내용 |
| --- | --- |
| 모든 업무 엔티티는 `BaseEntity` 상속 | 미상속. 감사 컬럼(`FST_ENR_USID` 등)을 두지 않는다 |
| 논리 삭제(`DEL_YN='Y'`) | 물리 삭제. 논리 삭제하면 행이 무한 증가한다 |
| 감사 대상 엔티티는 `@LogTarget` | 미적용. 인증 상태 전이를 감사로그로 남기지 않는다 |

`@Column`에 한글 `comment`를 지정하는 규칙은 그대로 지킨다.

### 6.2 트랜잭션 경계

증표 소비는 **호출자 트랜잭션과 분리**한다. 소비 메서드에 `@Transactional(propagation = REQUIRES_NEW)`를 지정한다.

`MfaGuardAspect.consumeProof`는 컨트롤러 메서드에 `@Around`로 붙어 `joinPoint.proceed()` **이전에** 증표를 소비한다. 컨트롤러에는 트랜잭션이 없으므로 현재는 소비가 업무 트랜잭션 밖에서 확정된다. 업무 명령이 실패해도 증표는 되살아나지 않으며, 이는 재사용 차단 관점에서 의도된 동작이다. `REQUIRES_NEW`는 이후 누군가 상위에 트랜잭션을 추가해도 이 성질이 유지되게 못박는 장치다.

## 7. 시간 기준과 만료 정리

### 7.1 시간 기준

만료 판정 시각은 지금처럼 애플리케이션이 `Instant.now(clock)`으로 계산해 파라미터로 전달한다. `SYSTIMESTAMP`를 쓰면 고정 `Clock` 기반 기존 테스트가 무력해진다.

대신 **인스턴스 간 시계 동기화(NTP)가 운영 전제**가 된다. TTL 90초 대비 통상 수십 밀리초의 스큐는 무시할 수 있으나, 초 단위 이상 어긋나면 만료 판정이 인스턴스마다 달라진다. 운영 문서에 제약으로 기록한다.

`END_DTM`을 `DATE`가 아닌 `TIMESTAMP(3)`으로 두는 이유도 같다. Oracle `DATE`는 초 단위라 절삭 시 최대 1초만큼 만료가 늦춰진다. `meta.txt`의 일시 용어는 `DATE`이므로 이 두 컬럼은 메타 사전 예외로 기록한다.

### 7.2 만료 정리

정확성은 정리 작업과 무관하다. 모든 조회·UPDATE 조건에 `END_DTM > :now`가 들어가므로 만료 행은 어떤 경로로도 사용되지 않는다. 정리는 순수하게 용량 관리다.

`MfaTransactionCleanupScheduler`를 추가해 5분 주기로 실행한다.

```sql
DELETE FROM TPRMPP_CMFTRM WHERE END_DTM < :now - INTERVAL '10' MINUTE
```

유예 10분은 만료 직후 요청이 사유(만료/미존재)를 정확히 구분할 수 있게 하는 창이다. 다중 인스턴스에서 여러 인스턴스가 동시에 실행해도 `DELETE`는 멱등이라 잠금이 필요 없다.

## 8. 코드 변경 범위

| 파일 | 변경 |
| --- | --- |
| `it_database/migrations/V20260816_002__CreateMfaTransactionTables.sql` | 신규. 테이블 2개, 인덱스 3개, 컬럼 코멘트 |
| `common/mfa/domain/MfaTransactionStatus.java` | `CANCELLED`, `CONSUMED` 추가 |
| `common/mfa/domain/MfaTransaction.java` | `svcTrId` 필드, `cancel()`·`consume()` 전이 추가 |
| `common/mfa/store/MfaTransactionEntity.java` | 신규 엔티티 |
| `common/mfa/store/LoginPendingTransactionEntity.java` | 신규 엔티티 |
| `common/mfa/store/JpaMfaTransactionStore.java` | 신규 구현 |
| `common/mfa/store/JpaLoginPendingTransactionStore.java` | 신규 구현 |
| `common/mfa/store/MfaTransactionStore.java` | 호출부 없는 `verify()` 제거 (§5.1) |
| `common/mfa/store/MfaTransactionCleanupScheduler.java` | 신규 정리 배치 |
| `common/mfa/service/MfaService.java` | 로컬 맵 2개 제거, `findActiveTransaction`이 상태로 사유 판정 |
| `common/mfa/provider/MfaChallengeData.java` | `providerTransactionId` 추가(FIDO만 non-null) |
| `common/mfa/provider/MfaVerifyContext.java` | `providerTransactionId` 추가 |
| `common/mfa/provider/FidoMfaProvider.java` | 로컬 맵·LRU 제거, `svcTrId`를 컨텍스트로 수수 |
| `common/mfa/config/MfaConfig.java` | 저장소 구현 선택 |
| `config/EnvironmentValidator.java` | `prod`에서 메모리 저장소 금지 |

가장 파급이 큰 것은 `FidoMfaProvider`다. 지금은 `svcTrId`를 공급자가 내부에 숨기고 있어 `MfaService`가 볼 수 없다. 이를 테이블로 옮기려면 `start()`가 값을 반환하고 `verify()`가 값을 받아야 하므로 `MfaChallengeData`와 `MfaVerifyContext`가 함께 바뀐다.

### 8.1 함께 고칠 결함

`FidoMfaProvider.verify`는 `pending == null`과 challenge 식별자 불일치를 한데 묶어 `failure()`를 반환한다. 둘을 분리한다.

- challenge 식별자 불일치 → `failure()` 유지 (공격 신호)
- 대상 거래 미존재 → `undecided()` (인스턴스 어긋남, 만료 정리 경합)

이 수정은 저장소를 공유해도 정리 경합에서 여전히 유효하며, 최악의 결과를 "잠김"에서 "만료 후 재시도"로 낮춘다.

## 9. 설정과 전환

`app.mfa.store` 속성을 추가한다(`jpa` | `memory`, 기본 `jpa`).

- `local-ext`, `local-int`: `jpa`. Flyway가 형제 디렉터리에서 신규 스크립트를 적용한다.
- `prod`: `jpa` 강제. `EnvironmentValidator`가 `memory` 설정을 기동 실패로 처리한다. MFA 우회 설정 경로를 만들지 않는 기존 방침과 같은 형태다.
- 단위 테스트: `InMemory*`를 직접 생성해 쓰므로 빈 선택과 무관하다.

`dev`/`prod` DB는 DBA가 마이그레이션을 수동 적용한다. 테이블이 없는 상태로 `jpa`를 켜면 기동 즉시 실패하므로 적용 누락이 조용히 넘어가지 않는다.

## 10. 테스트

| 대상 | 방식 |
| --- | --- |
| 상태 전이·매핑 | 기존 `InMemoryMfaTransactionStoreTest` 계약을 공유 추상 테스트로 승격해 두 구현에 동일 적용 |
| 원자적 소비 | `@Tag("it")` Oracle 통합 테스트. 동시 요청 N건 중 1건만 `CONSUMED` |
| 만료 경계 | 고정 `Clock`으로 `END_DTM` 직전·직후 판정 |
| 사유 판정 | 만료·취소·소비·미존재 각각이 정확한 `MfaErrorCode`를 내는지 |
| 정리 배치 | 유예 시간 이전 행 보존, 이후 행 삭제 |
| FIDO 미존재 거래 | `undecided()` 반환으로 실패 횟수가 늘지 않음 |
| 다중 인스턴스 | 저장소 인스턴스 2개가 같은 스키마를 공유할 때 1→2→3→4 흐름 성립 |

## 11. 문서 개정 범위

| 문서 | 개정 내용 |
| --- | --- |
| `it_backend/CLAUDE.md` §5 | "거래는 서버 메모리에만 두고 DB 테이블·JPA 엔티티·Flyway 스크립트를 추가하지 않습니다" 삭제. 해시만 저장하고 원문을 저장하지 않는다는 원칙과 `BaseEntity`·감사 예외를 명시 |
| `2026-08-10-internal-mfa-integration-design.md` §8 | 메모리 전용·다중 인스턴스 미지원 서술을 본 설계 참조로 대체 |
| `it_backend/docs/guides/persistence/data-model.md` | 신규 테이블 2개 등재 |
| `it_backend/README.md` 「내부망 MFA」 | `app.mfa.store` 설정, NTP 동기화 전제 |
| `meta/meta.txt` | 신규 용어 7개 등재 (§12) |
| `TASK.md` / `TASK_DONE.md` | SEC-13 이관 |

## 12. 미결 사항

**신규 메타 용어 7개** — `meta.txt`에 없는 용어다. 등재 여부와 표현을 확정해야 한다.

| 한글명 | 영문약어 |
| --- | --- |
| 인증거래토큰내용 | `CER_TR_TOK_CONE` |
| 인증challenge토큰내용 | `CER_CHLG_TOK_CONE` |
| 증표토큰내용 | `CRTT_TOK_CONE` |
| 인증수단구분코드 | `CER_MNS_TC` |
| 서비스거래번호 | `SVC_TRNO` |
| MFA거래마스터 | `TPRMPP_CMFTRM` |
| MFA로그인대기마스터 | `TPRMPP_CMFLPM` |

기존 용어에서 파생한 것들이다. `CER_STS_C`(인증상태코드), `USG_TC`(용도구분코드), `END_DTM`(종료일시), `VRF_DTM`(검증일시), `FLUR_NOT`(실패횟수), `ENO`(사원번호)는 사전에 있는 용어를 그대로 쓴다.

**`TIMESTAMP(3)` 사용** — `meta.txt`의 일시 용어는 `DATE`다. 만료 판정 정밀도를 위한 예외이며, 일관성을 우선한다면 `DATE` + 앱에서 초 단위 절삭으로 대체할 수 있다.

**SEC-12와의 관계** — 별개 과제다. `trStatus != "1"`을 전부 실패로 처리하면 정상 대기 응답도 실패로 집계되어 약 15초 만에 거래가 잠긴다. 본 설계는 SEC-12의 판정 변경을 포함하지 않으며, §8.1의 `pending == null` 분리만 포함한다.
