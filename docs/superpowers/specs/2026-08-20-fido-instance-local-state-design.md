# FIDO 인스턴스 로컬 상태 제거 설계 (SEC-16)

- 작성일: 2026-08-20
- 대상 과제: `TASK.md` SEC-16 (FIDO 폴링의 인스턴스 로컬 상태)
- 전제: [SEC-13](2026-08-16-mfa-multi-instance-store-design.md)로 MFA 거래 저장소는 이미 Oracle 공유 테이블(`TPRMPP_CMFATM`)로 옮겨졌다. 이 설계는 SEC-13이 저장소 인터페이스 밖에 남겨둔 두 곳(`FidoMfaProvider`의 로컬 맵, `MfaService`의 로컬 만료·취소 추적 맵)을 마저 정리한다.

## 1. 배경

SEC-13 완료 후에도 두 곳의 상태가 인스턴스 메모리에만 있다.

1. `FidoMfaProvider.pendingByTransactionId` — OnePass `svcTrId`를 challenge 시작 시 인스턴스 로컬 `ConcurrentHashMap`에 보관한다. FIDO는 사용자가 다른 기기(휴대폰)에서 승인하는 흐름이라 3초 주기로 검증 재조회가 일어나는데, 이 폴링이 challenge를 시작한 인스턴스가 아닌 곳으로 가면 `pendingByTransactionId`에 항목이 없어 `FidoMfaProvider.verify`가 `undecided()` 대신 `failure()`를 반환한다. 3초 폴링 × `app.mfa.max-failures`(기본 5) = 약 15초 만에 거래가 `LOCKED`가 되어 사용자가 승인할 기회를 잃는다. **이것이 유일한 실제 버그다.**
2. `MfaService.knownExpiryByTokenHash`·`cancelledExpiryByTokenHash` — `findActiveTransaction`이 조회 실패(`findByTokenHash`가 빈 값 반환) 시 `MFA_EXPIRED`와 `MFA_REQUIRED`를 구분하는 데 쓰는 보조 맵이다. SEC-13 완료 후 재확인한 결과, JPA 저장소는 취소된 거래도 물리 삭제하지 않고 `CANCELLED` 상태로 계속 반환하므로 `assertVerifiable`이 이미 이를 올바르게 처리한다. 이 로컬 맵은 오직 **만료 정리 배치가 이미 지운 거래**에 대해서만 사유 판정에 관여하며, 다른 인스턴스에서 시작된 거래는 이 구분을 못 해 `MFA_REQUIRED`로 폴백한다 — 보안·정합성 문제가 아니라 에러 코드 정확도 저하다. 사용자 확인 결과 이번에 함께 정리한다.

## 2. 접근 방식

두 상태 모두 "저장소가 이미 갖고 있는 정보를 컨텍스트로 주고받는다"는 SEC-13과 같은 원칙을 따른다. 새로운 인프라(캐시, 메시지 큐 등)를 들이지 않는다.

### 2.1 svcTrId 경로

`MfaChallengeData`(챌린지 시작 응답)와 `MfaVerifyContext`(검증 요청)에 nullable `providerTransactionId` 필드를 추가한다. FIDO만 값을 채우고 mOTP·지정맥은 계속 null이다.

```
시작: FidoMfaProvider.start()
  → OnePassClient.startFido()가 svcTrId를 생성해 MfaChallengeData.providerTransactionId에 담아 반환
  → MfaService.startChallenge()가 MfaTransaction.svcTrId로 저장(TPRMPP_CMFATM.APN_CER_SVC_TR_NO에 영속)

검증: MfaService.verifyChallenge()
  → 저장된 transaction.svcTrId()를 MfaVerifyContext.providerTransactionId에 실어 전달
  → FidoMfaProvider.verify()가 onePassClient.confirmFido(context.providerTransactionId()) 호출
```

`FidoMfaProvider`는 로컬 맵(`pendingByTransactionId`), LRU 축출 로직(`maxPendingTransactions`, `removeExpiredTransactions`), `PendingFido` 레코드가 전부 사라진다. challenge 식별자 일치 검증은 `MfaService.isExpectedProviderChallenge`가 `verify()` 호출 이전에 저장된 해시로 이미 수행하므로 `FidoMfaProvider.verify()`에서 중복 확인하지 않는다.

`svcTrId`(=OnePass 거래번호)는 해시가 아니라 원문 그대로 저장한다. 사용자 비밀이 아니고, `confirmFido` 호출에 원문이 필요하기 때문이다(SEC-13 설계 문서 §4.1과 동일한 근거).

**에지 케이스**: `context.providerTransactionId()`가 null인 상태로 `FidoMfaProvider.verify()`가 호출되면(이론상 발생하지 않아야 하지만, MFA 거래가 FIDO 방식인데 `svcTrId`가 비어 있는 비정상 상태에 대한 방어) `MfaVerificationResult.failure()`를 반환한다.

### 2.2 MfaService 로컬 맵 제거

`cancelledExpiryByTokenHash`는 죽은 코드다 — `findActiveTransaction`의 `.containsKey(tokenHash)` 분기와 그 아래 폴백 분기가 둘 다 `MFA_REQUIRED`를 던져 결과가 동일하다. 그냥 삭제한다.

`knownExpiryByTokenHash`는 `MfaTransactionStore`에 사유 판정 전용 메서드를 추가해 대체한다.

```java
/**
 * findByTokenHash가 이 tokenHash에 대해 방금 빈 값을 반환했을 때, 그 이유가
 * "존재했으나 만료됨"인지 확인한다. 사유 판정 전용이며 업무 흐름에서 호출하지 않는다.
 */
boolean isExpired(String tokenHash, Instant now);
```

- `JpaMfaTransactionStore`: `END_DTM` 필터 없이 PK로 한 번 더 조회해 만료 여부를 판정한다(만료 정리 배치의 10분 유예 창 안에서는 행이 남아 있으므로 판정 가능). DB가 근거를 갖고 있으므로 **다른 인스턴스에서 시작된 거래도 정확히 구분된다** — 기존 로컬 맵보다 오히려 더 정확하다.
- `InMemoryMfaTransactionStore`: 인스턴스 로컬 소규모 보조 맵(`expiryByTokenHash`)을 저장소 내부에 새로 둔다. `save()` 시 채우고 이 메서드에서만 조회한다. 단일 인스턴스 dev 전용이라 정확도 손실이 없고, 기존 `findByTokenHash`의 읽기 시 축출(evict-on-read) 동작은 건드리지 않는다 — 그 동작에 `InMemoryMfaTransactionStoreTest`의 여러 테스트(`consumeVerifiedOnce`가 만료 거래에 `MISSING`을 반환하는 경로 등)가 이미 의존하고 있어, 순서를 바꾸면 기존 테스트가 깨진다.

`findActiveTransaction`은 다음으로 단순화된다.

```java
private MfaTransaction findActiveTransaction(String tokenHash, Instant now) {
    return transactionStore
            .findByTokenHash(tokenHash, now)
            .orElseThrow(
                    () -> new MfaException(
                            transactionStore.isExpired(tokenHash, now)
                                    ? MfaErrorCode.MFA_EXPIRED
                                    : MfaErrorCode.MFA_REQUIRED));
}
```

`registerLoginPending`·`startChallenge`의 `removeExpiredTracking(now)` 호출과 그 메서드 자체, `consumeProof`의 두 맵 정리 호출도 함께 제거된다.

`LoginPendingTransactionStore` 쪽은 손대지 않는다 — 로컬 맵을 애초에 쓰지 않으며(`findLoginPending`은 미스 시 항상 `MFA_EXPIRED`, `consumeLoginProof`는 항상 `MFA_REQUIRED`를 던지는 기존 동작 그대로), 이번 정리 범위 밖이다.

## 3. 영향받는 파일

`MfaChallengeData`·`MfaVerifyContext`는 record라 필드 추가 시 위치 인자를 쓰는 모든 생성 호출부가 함께 바뀐다.

| 파일 | 변경 |
| --- | --- |
| `common/mfa/provider/MfaChallengeData.java` | `providerTransactionId` 필드 추가(nullable) |
| `common/mfa/provider/MfaVerifyContext.java` | `providerTransactionId` 필드 추가(nullable) |
| `common/mfa/provider/OnePassClient.java` | `challenge()` 헬퍼가 `providerTransactionId`를 받도록, `startFido()`가 `FidoStart` 래퍼 없이 `MfaChallengeData`를 직접 반환하도록 변경 |
| `common/mfa/provider/FidoMfaProvider.java` | 로컬 맵·LRU 축출·`PendingFido` 제거, `svcTrId`를 컨텍스트로 수수 |
| `common/mfa/domain/MfaTransaction.java` | `svcTrId` 필드 추가(생성자·`pending()`·`withStatus()`·`bindProofHash()`·`restore()` 전체에 관통) |
| `common/mfa/store/MfaTransactionStore.java` | `isExpired(String, Instant): boolean` 추가 |
| `common/mfa/store/InMemoryMfaTransactionStore.java` | `expiryByTokenHash` 보조 맵 추가, `isExpired()` 구현, `save()`에서 `svcTrId` 보관 |
| `common/mfa/store/JpaMfaTransactionStore.java` | `isExpired()` 구현(무조건 PK 조회), `save()`/`toDomain()`이 `APN_CER_SVC_TR_NO`를 실제로 채우고 읽도록 변경 |
| `common/mfa/store/MfaTransactionEntity.java` | `create()`가 `svcTrNo` 파라미터를 받도록 변경(컬럼 자체는 SEC-13에서 이미 존재) |
| `common/mfa/service/MfaService.java` | 로컬 맵 2개·`removeExpiredTracking()` 제거, `findActiveTransaction` 단순화, `startChallenge`가 `svcTrId` 저장, `verifyChallenge`가 `MfaVerifyContext`에 `svcTrId` 실어 전달 |

테스트(업무 코드는 위 표에 포함, 아래는 테스트 전용 영향):

| 파일 | 변경 |
| --- | --- |
| `MfaValueObjectsTest.java` | `MfaChallengeData`·`MfaVerifyContext` 생성 호출부 인자 추가 |
| `MfaServiceTest.java` | 동일(다수 호출부), `svcTrId` 저장·전달 검증 케이스 추가 |
| `FingerVeinMfaProviderTest.java` | 생성 호출부 인자 추가(값은 계속 null) |
| `MfaProviderRegistryTest.java` | 생성 호출부 인자 추가 |
| `OnePassClientTest.java` | 생성 호출부 인자 추가. `FidoMfaProvider(client(), N)` 생성자 오버로드와 LRU 축출·`maxPendingTransactions=0` 거부 시나리오 테스트를 제거하고, `svcTrId`가 `MfaChallengeData.providerTransactionId`로 노출되는지 확인하는 케이스로 교체 |
| `InMemoryMfaTransactionStoreTest.java` | `isExpired()` 계약 테스트 추가 |
| `JpaMfaTransactionStoreIT.java` | `isExpired()` 계약 테스트 추가(로컬 Oracle), `svcTrId` round-trip 테스트 추가 |

이 표가 이번 작업에서 가장 범위가 넓은 지점이다 — 신규 로직은 작지만 기존 레코드 시그니처 변경의 파급이 여러 테스트 파일에 걸친다.

## 4. 테스트 전략

| 대상 | 방식 |
| --- | --- |
| `svcTrId` round-trip | `JpaMfaTransactionStoreIT`에 저장→조회 시 `svcTrId`가 그대로 나오는지 확인하는 케이스 추가(로컬 Oracle) |
| `isExpired()` 계약 | `InMemoryMfaTransactionStoreTest`·`JpaMfaTransactionStoreIT` 양쪽에 동일 시나리오(만료 전/후/미존재) 추가 |
| FIDO 컨텍스트 경유 | `OnePassClientTest`에서 `FidoMfaProvider.start()`가 반환한 `MfaChallengeData.providerTransactionId()`가 실제 `svcTrId`와 일치하는지, `verify()`가 로컬 상태 없이 컨텍스트만으로 `confirmFido`를 호출하는지 확인 |
| 다중 인스턴스 시뮬레이션 | `MfaServiceTest`에 "인스턴스 A가 시작한 FIDO 거래를 인스턴스 B에 해당하는 새 `FidoMfaProvider`/`MfaService` 조합으로 검증"하는 케이스를 추가해, 로컬 맵이 없어도 폴링이 `undecided()`를 정상적으로 받는지 확인(SEC-13에서 남긴 §2 위험의 실제 해소 증거) |
| `svcTrId` null 방어 | `FidoMfaProvider.verify()`에 `providerTransactionId == null`이면 `failure()`를 반환하는 단위 테스트 |
| 회귀 | 전체 MFA 패키지 테스트(`./gradlew test --tests 'com.kdb.it.common.mfa.*'`) |

## 5. 문서·과제 개정

- `TASK.md`에서 SEC-16 행을 제거하고 `TASK_DONE.md`에 완료 기록을 추가한다(SEC-13과 같은 형식).
- SEC-13 설계 문서(`2026-08-16-mfa-multi-instance-store-design.md`) §8의 "범위 밖" 서술이나 이 계획의 §1 배경 설명이 SEC-16 완료 이후에도 유효하므로 별도 수정은 필요 없다 — 과거 시점 기록으로 남긴다.
