# SEC-16 FIDO 인스턴스 로컬 상태 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `FidoMfaProvider`의 인스턴스 로컬 `svcTrId` 맵(다중 인스턴스에서 폴링이 15초 만에 거래를 잠그는 실제 버그)과 `MfaService`의 로컬 만료·취소 추적 맵(에러 코드 정확도 문제)을 제거한다.

**Architecture:** `svcTrId`는 `MfaChallengeData`·`MfaVerifyContext`에 `providerTransactionId` 필드로 실어 컨텍스트로 주고받고, 이미 SEC-13에서 마련된 `TPRMPP_CMFATM.APN_CER_SVC_TR_NO`에 영속한다. 만료 판정은 `MfaTransactionStore`에 사유 판정 전용 `isExpired()` 조회 메서드를 추가해 대체한다.

**Tech Stack:** 기존 SEC-13 스택과 동일(Spring Data JPA, Oracle). 새 인프라 없음.

**Spec:** [docs/superpowers/specs/2026-08-20-fido-instance-local-state-design.md](../specs/2026-08-20-fido-instance-local-state-design.md)

## Global Constraints

- 신규 주석은 한글로 작성한다.
- `MfaChallengeData`·`MfaVerifyContext`는 record라 필드 추가가 모든 위치 인자 생성 호출부를 깨뜨린다. Java는 모듈 전체를 한 번에 컴파일하므로, 이 계획은 production 코드와 테스트를 하나의 Task로 묶어 매 단계 컴파일 가능한 중간 상태를 보장하지 않고 **Task 완료 시점에만** 전체가 컴파일·통과하도록 한다(계획 사유는 아래 Task 1 설명 참고).
- `FingerVeinMfaProvider`는 이번 범위 밖이다 — 자신만의 로컬 randomKey 맵을 그대로 유지한다(FIDO의 인스턴스 간 폴링 문제와 무관, 즉시 검증 방식이라 SEC-16의 대상이 아니다).
- `LoginPendingTransactionStore` 쪽은 손대지 않는다 — 로컬 맵을 애초에 쓰지 않는다.
- 각 작업 완료 후 `cd C:\it\it_backend && ./gradlew test --tests 'com.kdb.it.common.mfa.*'`로 확인한 뒤, `./gradlew test`로 전체 회귀를 확인한다.

---

## Task 1: 값 객체·도메인·공급자·저장소·서비스 — svcTrId 컨텍스트 경유, 로컬 맵 제거

**저장소:** `it_backend`

이 Task는 의도적으로 크다. `MfaChallengeData`·`MfaVerifyContext` record에 필드를 추가하면 이를 생성하는 모든 호출부(운영 코드 3곳, 테스트 8개 파일)가 함께 깨진다. Java는 전체 모듈을 한 번에 컴파일하므로 "일부만 고치고 컴파일되는" 중간 상태를 만들 수 없다 — 이 변경은 원자적 단위다. 아래 단계 순서대로 진행하되, **전체 테스트는 모든 단계를 마친 뒤 한 번** 돌린다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MfaChallengeData.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MfaVerifyContext.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/OnePassClient.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/FidoMfaProvider.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/provider/MockMfaProvider.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionEntity.java`
- Modify: `it_backend/src/main/java/com/kdb/it/common/mfa/service/MfaService.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/domain/MfaTransactionRestoreTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/MfaValueObjectsTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/OnePassClientTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/FingerVeinMfaProviderTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/provider/MfaProviderRegistryTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/service/MfaServiceTest.java`
- Modify: `it_backend/src/test/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStoreTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStoreIT.java` (기존 SEC-13 IT 테스트에 케이스 추가)

### Step 1: MfaChallengeData에 providerTransactionId 추가

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.provider;

import java.time.Instant;
import java.util.Objects;

/**
 * 화면에 반환 가능한 MFA challenge 정보이며 외부 토큰이나 원본 응답은 포함하지 않는다.
 *
 * @param challengeId 공급자 challenge 식별자
 * @param qrData 표시용 QR 데이터. 없으면 null
 * @param randomKey 지정맥이 BioAgent에 전달할 6자리 랜덤키. 다른 수단은 null
 * @param expiresAt 서버 기준 만료 시각
 * @param providerTransactionId OnePass 서비스 거래 식별자(svcTrId). FIDO만 값이 있고 다른 수단은 null이다.
 */
public record MfaChallengeData(
        String challengeId,
        String qrData,
        String randomKey,
        Instant expiresAt,
        String providerTransactionId) {

    public MfaChallengeData {
        if (challengeId == null || challengeId.isBlank()) {
            throw new IllegalArgumentException("challenge 식별자는 필수입니다.");
        }
        Objects.requireNonNull(expiresAt, "MFA 만료 시각은 필수입니다.");
    }
}
```

### Step 2: MfaVerifyContext에 providerTransactionId 추가

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.provider;

import java.util.Objects;

/**
 * MFA challenge의 명시적 검증 요청 정보이다.
 *
 * @param providerTransactionId OnePass 서비스 거래 식별자(svcTrId). FIDO만 값이 있고 다른 수단은 null이다.
 */
public record MfaVerifyContext(
        MfaStartContext startContext,
        String challengeId,
        String verificationValue,
        String providerTransactionId) {

    public MfaVerifyContext {
        Objects.requireNonNull(startContext, "MFA 시작 거래는 필수입니다.");
        if (challengeId == null || challengeId.isBlank()) {
            throw new IllegalArgumentException("challenge 식별자는 필수입니다.");
        }
        verificationValue = verificationValue == null ? "" : verificationValue;
    }
}
```

### Step 3: OnePassClient — providerTransactionId를 challenge()에 관통, FidoStart 래퍼 제거

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.provider;

import com.kdb.it.common.mfa.config.MfaProperties;
import java.security.SecureRandom;
import java.util.LinkedHashMap;
import java.util.Map;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/** OnePass mOTP/FIDO HTTP 요청을 안전한 MFA 공급자 데이터로 변환하는 클라이언트이다. */
public final class OnePassClient {

    private static final String SUCCESS_CODE = "100000";
    private static final String OTP_AUTH_TYPE = "OTP01";
    private static final int MAX_QR_LENGTH = 16_384;
    private static final ParameterizedTypeReference<Map<String, Object>> MAP_TYPE =
            new ParameterizedTypeReference<>() {};

    private final RestClient restClient;
    private final MfaProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    /**
     * 설정된 endpoint와 timeout으로 OnePass HTTP 클라이언트를 생성한다.
     *
     * @param properties OnePass endpoint, 기관/서비스 식별자 및 timeout
     */
    public OnePassClient(MfaProperties properties) {
        this.properties = properties;
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(properties.connectTimeout());
        factory.setReadTimeout(properties.readTimeout());
        this.restClient = RestClient.builder().requestFactory(factory).build();
    }

    /** mOTP challenge를 시작한다. */
    public MfaChallengeData requestMotpChallenge(MfaStartContext context) {
        String svcTrId = newServiceTransactionId();
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("command", "requestServiceAuth");
        request.put("svcTrId", svcTrId);
        request.put("siteId", properties.siteId());
        request.put("svcId", properties.svcId());
        request.put("loginId", context.eno());
        request.put("crossDomain", true);
        request.put("authType", OTP_AUTH_TYPE);
        return challenge(request(request), context, null);
    }

    /** FIDO challenge를 시작한다. svcTrId를 challenge의 providerTransactionId에 실어 반환한다. */
    public MfaChallengeData requestFidoChallenge(MfaStartContext context) {
        return startFido(context);
    }

    /** 명시적으로 제출된 mOTP만 OnePass에 검증 요청한다. */
    public MfaVerificationResult verifyMotp(
            MfaStartContext context, String challengeId, String otp) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("command", "requestVerifyOtp");
        request.put("trId", challengeId);
        request.put("otpValue", otp);
        request.put("crossDomain", true);
        request.put("authType", OTP_AUTH_TYPE);
        return success(request(request))
                ? MfaVerificationResult.success()
                : MfaVerificationResult.failure();
    }

    /** FIDO challenge를 시작하고 발급한 서비스 거래 식별자를 challenge의 providerTransactionId에 담아 반환한다. */
    MfaChallengeData startFido(MfaStartContext context) {
        String svcTrId = newServiceTransactionId();
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("command", "requestServiceAuth");
        request.put("svcTrId", svcTrId);
        request.put("siteId", properties.siteId());
        request.put("svcId", properties.svcId());
        request.put("loginId", context.eno());
        request.put("bizAlarmType", "1");
        request.put("crossDomain", true);
        return challenge(request(request), context, svcTrId);
    }

    /**
     * FIDO 시작 시 발급한 동일 서비스 거래 식별자로 OnePass 결과를 확인한다.
     *
     * <p>거래 조회 자체가 성공({@code resultCode=100000})했는데 {@code trStatus}가 승인(1)이 아니면 사용자가 아직 기기에서 처리하지
     * 않은 상태로 보고 {@link MfaVerificationResult#undecided()}를 반환한다. 제공된 연동 규격에 사용자 거부를 뜻하는 별도 {@code
     * trStatus} 값이 정의되어 있지 않아, 거부와 대기를 구분하지 못하고 모두 미결정으로 처리한다. 거부한 거래도 challenge 만료 시각까지 미결정으로 남을 뿐
     * 승인되지는 않는다. 규격에 거부 상태값이 추가되면 이 분기에서 {@link MfaVerificationResult#failure()}로 분리한다.
     *
     * @param svcTrId FIDO 시작에서 발급한 서비스 거래 식별자
     * @return 승인이면 성공, 거래 조회는 됐으나 미승인이면 미결정, 그 밖의 응답이면 실패
     */
    MfaVerificationResult confirmFido(String svcTrId) {
        Map<String, Object> request = new LinkedHashMap<>();
        request.put("command", "trResultConfirm");
        request.put("svcTrId", svcTrId);
        request.put("crossDomain", true);
        Map<String, Object> response = request(request);
        if (!success(response)) {
            return MfaVerificationResult.failure();
        }
        return "1".equals(text(resultData(response), "trStatus"))
                ? MfaVerificationResult.success()
                : MfaVerificationResult.undecided();
    }

    private MfaChallengeData challenge(
            Map<String, Object> response, MfaStartContext context, String providerTransactionId) {
        if (!success(response)) {
            throw new OnePassProviderException(
                    text(response, "resultCode"), text(response, "resultMsg"));
        }
        Map<String, Object> resultData = resultData(response);
        String challengeId = text(resultData, "trId");
        if (challengeId.isBlank()) {
            throw new IllegalStateException("OnePass MFA 응답에 challenge 식별자가 없습니다.");
        }
        String qrData = optionalText(resultData, "qrImage");
        if (qrData != null && qrData.length() > MAX_QR_LENGTH) {
            throw new IllegalArgumentException("OnePass QR 데이터가 허용 길이를 초과했습니다.");
        }
        return new MfaChallengeData(challengeId, qrData, null, context.expiresAt(), providerTransactionId);
    }

    private Map<String, Object> request(Map<String, Object> request) {
        try {
            Map<String, Object> response =
                    restClient
                            .post()
                            .uri(properties.endpoint())
                            .contentType(MediaType.APPLICATION_JSON)
                            .body(request)
                            .retrieve()
                            .body(MAP_TYPE);
            if (response == null) {
                throw new IllegalStateException("OnePass MFA 통신 또는 응답 처리에 실패했습니다.");
            }
            return response;
        } catch (Exception ignored) {
            throw new IllegalStateException("OnePass MFA 통신 또는 응답 처리에 실패했습니다.");
        }
    }

    private String newServiceTransactionId() {
        StringBuilder value = new StringBuilder(20);
        for (int index = 0; index < 20; index++) {
            value.append(secureRandom.nextInt(10));
        }
        return value.toString();
    }

    private static boolean success(Map<String, Object> response) {
        return SUCCESS_CODE.equals(text(response, "resultCode"));
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> resultData(Map<String, Object> response) {
        Object value = response.get("resultData");
        return value instanceof Map ? (Map<String, Object>) value : Map.of();
    }

    private static String text(Map<String, Object> response, String key) {
        Object value = response.get(key);
        return value == null ? "" : value.toString();
    }

    private static String optionalText(Map<String, Object> response, String key) {
        Object value = response.get(key);
        return value == null ? null : value.toString();
    }
}
```

`FidoStart` record가 사라졌다 — `MfaChallengeData` 자체가 `providerTransactionId`를 담으므로 별도 래퍼가 필요 없다.

### Step 4: FidoMfaProvider — 로컬 맵·LRU 전부 제거

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.provider;

/** OnePass FIDO 인증 공급자다. 상태는 MfaService가 영속 계층(TPRMPP_CMFATM)에 보관하고 컨텍스트로 전달한다. */
public final class FidoMfaProvider implements MfaProvider {

    private final OnePassClient onePassClient;

    public FidoMfaProvider(OnePassClient onePassClient) {
        this.onePassClient = onePassClient;
    }

    @Override
    public MfaChallengeData start(MfaStartContext context) {
        return onePassClient.startFido(context);
    }

    /**
     * 컨텍스트로 전달된 서비스 거래 식별자로 OnePass 결과를 확인한다.
     *
     * <p>challenge 식별자 일치 검증은 {@code MfaService.isExpectedProviderChallenge}가 저장된 해시로 이 메서드 호출
     * 이전에 이미 수행하므로 여기서 다시 확인하지 않는다.
     */
    @Override
    public MfaVerificationResult verify(MfaVerifyContext context) {
        String svcTrId = context.providerTransactionId();
        if (svcTrId == null) {
            return MfaVerificationResult.failure();
        }
        return onePassClient.confirmFido(svcTrId);
    }
}
```

### Step 5: MockMfaProvider — 생성 호출부에 인자 추가

`it_backend/src/main/java/com/kdb/it/common/mfa/provider/MockMfaProvider.java`의 9행을 교체:

```java
        return new MfaChallengeData(context.transactionId(), null, "000000", context.expiresAt(), null);
```

### Step 6: MfaTransaction — svcTrId 필드 추가

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.domain;

import java.time.Instant;
import java.util.Objects;

/** 상태 전이를 새 인스턴스로 반환하는 불변 MFA 거래다. */
public final class MfaTransaction {

    private final String tokenHash;
    private final String eno;
    private final MfaPurpose purpose;
    private final MfaMethod method;
    private final Instant expiresAt;
    private final String providerChallengeHash;
    private final String svcTrId;
    private final String proofHash;
    private final MfaTransactionStatus status;
    private final Instant verifiedAt;
    private final int failureCount;

    private MfaTransaction(
            String tokenHash,
            String eno,
            MfaPurpose purpose,
            MfaMethod method,
            Instant expiresAt,
            String providerChallengeHash,
            String svcTrId,
            String proofHash,
            MfaTransactionStatus status,
            Instant verifiedAt,
            int failureCount) {
        Objects.requireNonNull(tokenHash, "토큰 해시는 필수입니다.");
        Objects.requireNonNull(eno, "사원번호는 필수입니다.");
        Objects.requireNonNull(purpose, "MFA 목적은 필수입니다.");
        Objects.requireNonNull(method, "MFA 수단은 필수입니다.");
        Objects.requireNonNull(expiresAt, "만료 시각은 필수입니다.");
        Objects.requireNonNull(status, "MFA 상태는 필수입니다.");
        if (failureCount < 0) {
            throw new IllegalArgumentException("실패 횟수는 음수일 수 없습니다.");
        }
        if (status == MfaTransactionStatus.VERIFIED && verifiedAt == null) {
            throw new IllegalArgumentException("검증 완료 거래에는 검증 시각이 필요합니다.");
        }
        if ((status == MfaTransactionStatus.PENDING || status == MfaTransactionStatus.LOCKED)
                && verifiedAt != null) {
            throw new IllegalArgumentException("대기 또는 잠금 거래에는 검증 시각이 있을 수 없습니다.");
        }
        this.tokenHash = tokenHash;
        this.eno = eno;
        this.purpose = purpose;
        this.method = method;
        this.expiresAt = expiresAt;
        this.providerChallengeHash = providerChallengeHash;
        this.svcTrId = svcTrId;
        this.proofHash = proofHash;
        this.status = status;
        this.verifiedAt = verifiedAt;
        this.failureCount = failureCount;
    }

    /** 대기 상태의 MFA 거래를 생성한다. */
    public static MfaTransaction pending(
            String tokenHash, String eno, MfaPurpose purpose, MfaMethod method, Instant expiresAt) {
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                null,
                null,
                null,
                MfaTransactionStatus.PENDING,
                null,
                0);
    }

    /**
     * 공급자 challenge 해시와 서비스 거래 식별자를 결속한 대기 상태 MFA 거래를 생성한다.
     *
     * @param svcTrId OnePass 서비스 거래 식별자(svcTrId). FIDO만 값이 있고 다른 수단은 null이다.
     */
    public static MfaTransaction pending(
            String tokenHash,
            String eno,
            MfaPurpose purpose,
            MfaMethod method,
            Instant expiresAt,
            String providerChallengeHash,
            String svcTrId) {
        Objects.requireNonNull(providerChallengeHash, "공급자 challenge 해시는 필수입니다.");
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                providerChallengeHash,
                svcTrId,
                null,
                MfaTransactionStatus.PENDING,
                null,
                0);
    }

    /** 만료되지 않은 대기 거래를 검증 완료 상태로 전이한다. */
    public MfaTransaction verify(Instant now) {
        if (isExpiredAt(now)) {
            return withStatus(MfaTransactionStatus.EXPIRED, verifiedAt, failureCount);
        }
        if (status != MfaTransactionStatus.PENDING) {
            return this;
        }
        return withStatus(MfaTransactionStatus.VERIFIED, now, failureCount);
    }

    /** 실패 횟수를 올리고 최대 횟수에 도달하면 거래를 잠근다. */
    public MfaTransaction fail(Instant now, int maxFailures) {
        if (maxFailures < 1) {
            throw new IllegalArgumentException("최대 실패 횟수는 1 이상이어야 합니다.");
        }
        if (isExpiredAt(now)) {
            return withStatus(MfaTransactionStatus.EXPIRED, verifiedAt, failureCount);
        }
        if (status != MfaTransactionStatus.PENDING) {
            return this;
        }
        int nextFailureCount = failureCount + 1;
        MfaTransactionStatus nextStatus =
                nextFailureCount >= maxFailures
                        ? MfaTransactionStatus.LOCKED
                        : MfaTransactionStatus.PENDING;
        return withStatus(nextStatus, null, nextFailureCount);
    }

    /** 지정 시각에 거래가 만료됐는지 확인한다. */
    public boolean isExpiredAt(Instant now) {
        return !now.isBefore(expiresAt);
    }

    private MfaTransaction withStatus(
            MfaTransactionStatus nextStatus, Instant nextVerifiedAt, int nextFailureCount) {
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                providerChallengeHash,
                svcTrId,
                proofHash,
                nextStatus,
                nextVerifiedAt,
                nextFailureCount);
    }

    public String tokenHash() {
        return tokenHash;
    }

    public String eno() {
        return eno;
    }

    public MfaPurpose purpose() {
        return purpose;
    }

    public MfaMethod method() {
        return method;
    }

    public Instant expiresAt() {
        return expiresAt;
    }

    /** 공급자 challenge의 SHA-256 해시이며 원문은 저장하지 않는다. */
    public String providerChallengeHash() {
        return providerChallengeHash;
    }

    /** OnePass 서비스 거래 식별자(svcTrId) 원문이다. FIDO만 값이 있고 다른 수단은 null이다. */
    public String svcTrId() {
        return svcTrId;
    }

    /** 검증 후 발급한 1회용 증표의 SHA-256 해시이며 원문은 저장하지 않는다. */
    public String proofHash() {
        return proofHash;
    }

    /** 검증 완료 거래에만 1회용 증표 해시를 결속한다. */
    public MfaTransaction bindProofHash(String nextProofHash) {
        if (status != MfaTransactionStatus.VERIFIED || proofHash != null) {
            return this;
        }
        Objects.requireNonNull(nextProofHash, "MFA 증표 해시는 필수입니다.");
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                providerChallengeHash,
                svcTrId,
                nextProofHash,
                status,
                verifiedAt,
                failureCount);
    }

    /**
     * 영속 계층에 저장된 상태를 그대로 복원한다.
     *
     * <p>JPA 저장소의 엔티티→도메인 매핑 전용이다. 업무 흐름은 이 메서드가 아니라 {@link #pending}과
     * {@link #verify}·{@link #fail}·{@link #bindProofHash} 등 전이 메서드를 사용해야 한다.
     *
     * @param tokenHash 거래 토큰 해시
     * @param eno 사원번호
     * @param purpose MFA 목적
     * @param method MFA 수단
     * @param expiresAt 만료 시각
     * @param providerChallengeHash 공급자 challenge 해시. 없으면 null
     * @param svcTrId OnePass 서비스 거래 식별자 원문. FIDO가 아니면 null
     * @param proofHash 증표 해시. 없으면 null
     * @param status 저장된 상태
     * @param verifiedAt 검증 시각. 없으면 null
     * @param failureCount 실패 횟수
     * @return 저장된 필드를 그대로 담은 거래
     */
    public static MfaTransaction restore(
            String tokenHash,
            String eno,
            MfaPurpose purpose,
            MfaMethod method,
            Instant expiresAt,
            String providerChallengeHash,
            String svcTrId,
            String proofHash,
            MfaTransactionStatus status,
            Instant verifiedAt,
            int failureCount) {
        return new MfaTransaction(
                tokenHash,
                eno,
                purpose,
                method,
                expiresAt,
                providerChallengeHash,
                svcTrId,
                proofHash,
                status,
                verifiedAt,
                failureCount);
    }

    public MfaTransactionStatus status() {
        return status;
    }

    public Instant verifiedAt() {
        return verifiedAt;
    }

    public int failureCount() {
        return failureCount;
    }
}
```

### Step 7: MfaTransactionStore — isExpired() 추가

`it_backend/src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java`의 `findByTokenHash` 선언(22행) 바로 다음 줄에 추가:

```java

    /**
     * findByTokenHash가 이 tokenHash에 대해 방금 빈 값을 반환했을 때, 그 이유가 "존재했으나 만료됨"인지
     * 확인한다. 사유 판정 전용이며 업무 흐름에서 호출하지 않는다.
     */
    boolean isExpired(String tokenHash, Instant now);
```

### Step 8: InMemoryMfaTransactionStore — 자체 만료 추적 보조 맵 추가

`InMemoryMfaTransactionStore.java`의 필드 선언부(16~21행)를 다음으로 교체:

```java
    private final ConcurrentHashMap<String, MfaTransaction> transactions =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, MfaTransaction> proofTransactions =
            new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Instant> expiryByTokenHash =
            new ConcurrentHashMap<>();
```

`save()` 메서드(24~27행)를 다음으로 교체(만료 추적 보조 맵도 함께 채운다):

```java
    // 인터페이스 계약보다 관대하게, 주어진 거래를 상태와 무관하게 그대로 저장한다.
    @Override
    public void save(MfaTransaction transaction) {
        transactions.put(transaction.tokenHash(), transaction);
        expiryByTokenHash.put(transaction.tokenHash(), transaction.expiresAt());
    }
```

`consumeVerifiedOnce` 메서드 끝(현재 132행, `}` 직전) 다음에 새 메서드를 추가:

```java

    /**
     * 인스턴스 로컬 보조 맵으로 만료 여부를 판정한다. 단일 인스턴스 dev 전용 저장소라 인스턴스 간
     * 정확도 손실이 없다. {@code save()} 시 채우며, {@code findByTokenHash}의 읽기 시 축출(evict-on-read)
     * 동작과는 독립적으로 유지한다 — 그 축출 순서에 기존 테스트 여러 개가 의존하고 있어 건드리지 않는다.
     */
    @Override
    public boolean isExpired(String tokenHash, Instant now) {
        Instant expiresAt = expiryByTokenHash.get(tokenHash);
        return expiresAt != null && !now.isBefore(expiresAt);
    }
```

### Step 9: JpaMfaTransactionStore — svcTrId 영속·조회, isExpired() 구현

`save()` 메서드(38~47행)를 다음으로 교체:

```java
    @Override
    @Transactional
    public void save(MfaTransaction transaction) {
        repository.save(
                MfaTransactionEntity.create(
                        transaction.tokenHash(),
                        transaction.eno(),
                        purposeCode(transaction.purpose()),
                        methodCode(transaction.method()),
                        toLocalDateTime(transaction.expiresAt()),
                        transaction.providerChallengeHash(),
                        transaction.svcTrId()));
    }
```

`toDomain()` 메서드(107~119행)를 다음으로 교체:

```java
    private MfaTransaction toDomain(MfaTransactionEntity entity) {
        return MfaTransaction.restore(
                entity.getTokenHash(),
                entity.getEno(),
                purpose(entity.getPurposeCode()),
                method(entity.getMethodCode()),
                toInstant(entity.getEndDtm()),
                entity.getTryTokenHash(),
                entity.getSvcTrNo(),
                entity.getProofTokenHash(),
                status(entity.getStatusCode()),
                entity.getVrfDtm() == null ? null : toInstant(entity.getVrfDtm()),
                entity.getFailureCount());
    }
```

`consumeVerifiedOnce` 메서드 끝, `private static String purposeCode(...)` 선언 바로 앞에 새 메서드를 추가:

```java
    @Override
    @Transactional(readOnly = true)
    public boolean isExpired(String tokenHash, Instant now) {
        return repository
                .findById(tokenHash)
                .map(entity -> !toLocalDateTime(now).isBefore(entity.getEndDtm()))
                .orElse(false);
    }

```

(`repository.findById`는 `MfaTransactionJpaRepository extends JpaRepository<MfaTransactionEntity, String>`가 이미 상속하는 메서드라 리포지토리 자체는 변경할 필요가 없다.)

### Step 10: MfaTransactionEntity — create()가 svcTrNo를 받도록 변경

`create()` 메서드(95~115행)를 다음으로 교체:

```java
    /**
     * 신규 대기 거래를 생성한다.
     *
     * <p>로그인/MFA 시작 시점은 {@code AuditorAware}가 개입할 수 없는 비인증 흐름이 대부분이므로, 거래 소유자 사번을 최초·최종 감사자로 명시적으로
     * 기록한다({@code Crtokm.create}와 같은 방식).
     *
     * @param tokenHash 거래 토큰 해시(PK)
     * @param eno 거래 소유자 사번(감사자로도 함께 기록됨)
     * @param purposeCode IT포탈추가인증용도구분코드
     * @param methodCode IT포탈추가인증수단구분코드
     * @param endDtm 만료 시각
     * @param tryTokenHash 공급자 challenge 해시. 없으면 null
     * @param svcTrNo OnePass 서비스 거래 식별자 원문. FIDO가 아니면 null
     * @return 소유자 사번이 감사자로 기록된 PENDING 상태 신규 엔티티
     */
    public static MfaTransactionEntity create(
            String tokenHash,
            String eno,
            String purposeCode,
            String methodCode,
            LocalDateTime endDtm,
            String tryTokenHash,
            String svcTrNo) {
        MfaTransactionEntity entity =
                MfaTransactionEntity.builder()
                        .tokenHash(tokenHash)
                        .eno(eno)
                        .purposeCode(purposeCode)
                        .methodCode(methodCode)
                        .statusCode(STATUS_PENDING)
                        .endDtm(endDtm)
                        .failureCount(0)
                        .tryTokenHash(tryTokenHash)
                        .svcTrNo(svcTrNo)
                        .build();
        entity.initializeAuditActors(eno);
        return entity;
    }
```

### Step 11: MfaService — 로컬 맵 제거, svcTrId 저장·전달

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.service;

import com.kdb.it.common.mfa.config.MfaProperties;
import com.kdb.it.common.mfa.domain.LoginPendingTransaction;
import com.kdb.it.common.mfa.domain.MfaPurpose;
import com.kdb.it.common.mfa.domain.MfaTransaction;
import com.kdb.it.common.mfa.domain.MfaTransactionStatus;
import com.kdb.it.common.mfa.dto.MfaDto;
import com.kdb.it.common.mfa.exception.MfaErrorCode;
import com.kdb.it.common.mfa.exception.MfaException;
import com.kdb.it.common.mfa.provider.MfaChallengeData;
import com.kdb.it.common.mfa.provider.MfaProviderRegistry;
import com.kdb.it.common.mfa.provider.MfaStartContext;
import com.kdb.it.common.mfa.provider.MfaVerificationResult;
import com.kdb.it.common.mfa.provider.MfaVerifyContext;
import com.kdb.it.common.mfa.provider.OnePassProviderException;
import com.kdb.it.common.mfa.store.LoginPendingTransactionStore;
import com.kdb.it.common.mfa.store.MfaTransactionStore;
import com.kdb.it.common.mfa.store.MfaTransactionStore.ProofConsumption;
import com.kdb.it.common.system.security.CustomUserDetails;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Optional;
import java.util.UUID;
import org.springframework.stereotype.Service;

/** MFA 거래 생성, 소유권 검증, 외부 인증 및 1회용 증표 소비를 조정한다. */
@Service
public class MfaService {

    private static final SecureRandom PROOF_RANDOM = new SecureRandom();
    private static final int PROOF_BYTES = 32;

    private final MfaTransactionStore transactionStore;
    private final LoginPendingTransactionStore loginPendingTransactionStore;
    private final MfaProviderRegistry providerRegistry;
    private final MfaProperties properties;
    private final Clock clock;

    public MfaService(
            MfaTransactionStore transactionStore,
            LoginPendingTransactionStore loginPendingTransactionStore,
            MfaProviderRegistry providerRegistry,
            MfaProperties properties,
            Clock clock) {
        this.transactionStore = transactionStore;
        this.loginPendingTransactionStore = loginPendingTransactionStore;
        this.providerRegistry = providerRegistry;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Task 5의 자격증명 검증 성공 뒤 사용할 로그인 대기 거래를 등록한다.
     *
     * @param eno 자격증명을 통과한 사용자 사원번호
     * @return httpOnly 쿠키에 보관할 대기 식별자와 서버 기준 남은 시간
     * @throws IllegalArgumentException 사원번호가 비어 있는 경우
     */
    public MfaDto.LoginPendingRegistration registerLoginPending(String eno) {
        if (eno == null || eno.isBlank()) {
            throw new IllegalArgumentException("로그인 대기 거래의 사원번호는 필수입니다.");
        }
        Instant now = Instant.now(clock);
        Instant expiresAt = now.plus(properties.challengeTtl());
        UUID pendingId = UUID.randomUUID();
        loginPendingTransactionStore.save(
                new LoginPendingTransaction(hash(pendingId.toString()), eno, expiresAt));
        return new MfaDto.LoginPendingRegistration(pendingId, remainingSeconds(expiresAt, now));
    }

    /**
     * 소유자가 새 MFA challenge를 시작한다.
     *
     * @param request 목적과 인증 수단
     * @param currentUser JWT에서 복원한 현재 사용자
     * @param pendingCookie 로그인 대기 증표 원문
     * @return 공급자 표시 정보와 서버 기준 남은 시간
     * @throws MfaException 로그인 대기 증표 또는 JWT 소유권이 없거나 공급자를 시작할 수 없는 경우
     */
    public MfaDto.MfaChallengeResponse startChallenge(
            MfaDto.MfaStartRequest request,
            Optional<CustomUserDetails> currentUser,
            String pendingCookie) {
        Instant now = Instant.now(clock);
        String eno = resolveOwnerForStart(request.purpose(), currentUser, pendingCookie, now);
        Instant expiresAt = now.plus(properties.challengeTtl());
        UUID challengeId = UUID.randomUUID();
        MfaStartContext context =
                new MfaStartContext(challengeId.toString(), eno, request.purpose(), expiresAt);
        MfaChallengeData challenge;
        try {
            challenge = providerRegistry.start(request.method(), context);
        } catch (OnePassProviderException exception) {
            throw new MfaException(
                    MfaErrorCode.MFA_UNAVAILABLE,
                    exception.providerCode(),
                    exception.providerMessage());
        } catch (RuntimeException exception) {
            throw new MfaException(MfaErrorCode.MFA_UNAVAILABLE);
        }
        String tokenHash = hash(challengeId.toString());
        transactionStore.save(
                MfaTransaction.pending(
                        tokenHash,
                        eno,
                        request.purpose(),
                        request.method(),
                        expiresAt,
                        hash(challenge.challengeId()),
                        challenge.providerTransactionId()));
        return new MfaDto.MfaChallengeResponse(
                challengeId,
                challenge.challengeId(),
                challenge.qrData(),
                challenge.randomKey(),
                remainingSeconds(expiresAt, now));
    }

    /**
     * 소유자가 공급자 검증을 요청하고 성공 시 짧은 수명의 증표를 얻는다.
     *
     * @param challengeId 서버가 발급한 MFA 거래 식별자
     * @param request 공급자 challenge 식별자와 검증 값
     * @param currentUser JWT에서 복원한 현재 사용자
     * @param pendingCookie 로그인 대기 증표 원문
     * @return 검증 성공 여부와 서버 기준 증표 남은 시간. 외부 공급자가 아직 결과를 확정하지 않았으면 {@code verified=false}와 {@code
     *     proof=null}을 반환하며 실패 횟수를 늘리지 않는다.
     * @throws MfaException 거래 만료, 소유권 위반, 인증 실패 또는 잠금 상태인 경우
     */
    public VerifiedChallenge verifyChallenge(
            UUID challengeId,
            MfaDto.MfaVerifyRequest request,
            Optional<CustomUserDetails> currentUser,
            String pendingCookie) {
        Instant now = Instant.now(clock);
        String tokenHash = hash(challengeId.toString());
        MfaTransaction transaction = findActiveTransaction(tokenHash, now);
        assertTransactionOwner(transaction, currentUser, pendingCookie, now);
        assertVerifiable(transaction);

        if (!isExpectedProviderChallenge(transaction, request.providerChallengeId())) {
            throwFailedVerification(tokenHash, now);
        }

        MfaVerificationResult verification;
        try {
            verification =
                    providerRegistry.verify(
                            transaction.method(),
                            new MfaVerifyContext(
                                    new MfaStartContext(
                                            challengeId.toString(),
                                            transaction.eno(),
                                            transaction.purpose(),
                                            transaction.expiresAt()),
                                    request.providerChallengeId(),
                                    request.verificationValue(),
                                    transaction.svcTrId()));
        } catch (RuntimeException exception) {
            throw new MfaException(MfaErrorCode.MFA_UNAVAILABLE);
        }
        if (!verification.decided()) {
            // FIDO처럼 사용자가 다른 기기에서 승인하는 수단의 재조회는 실패로 집계하지 않는다.
            return new VerifiedChallenge(
                    new MfaDto.MfaVerifyResponse(
                            false, remainingSeconds(transaction.expiresAt(), now)),
                    null);
        }
        if (!verification.verified()) {
            throwFailedVerification(tokenHash, now);
        }

        String proof = newProof();
        MfaTransaction verified =
                transactionStore
                        .verifyAndBindProof(tokenHash, hash(proof), now)
                        .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_EXPIRED));
        if (verified.status() != MfaTransactionStatus.VERIFIED) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
        return new VerifiedChallenge(
                new MfaDto.MfaVerifyResponse(true, remainingSeconds(verified.expiresAt(), now)),
                proof);
    }

    /**
     * 진행 중 MFA 거래를 취소해 이후 검증을 막는다.
     *
     * @param challengeId 서버가 발급한 MFA 거래 식별자
     * @param currentUser JWT에서 복원한 현재 사용자
     * @param pendingCookie 로그인 대기 증표 원문
     * @throws MfaException 거래 소유자가 아닌 경우
     */
    public void cancelChallenge(
            UUID challengeId, Optional<CustomUserDetails> currentUser, String pendingCookie) {
        Instant now = Instant.now(clock);
        String tokenHash = hash(challengeId.toString());
        MfaTransaction transaction = findActiveTransaction(tokenHash, now);
        assertTransactionOwner(transaction, currentUser, pendingCookie, now);
        transactionStore.delete(tokenHash, now);
    }

    /**
     * 결재 명령 직전에 현재 JWT 사용자에게 귀속된 MFA 증표를 원자적으로 한 번 소비한다.
     *
     * @param currentUser 현재 JWT 사용자
     * @param proofCookie MFA 증표 원문
     * @throws MfaException 유효하지 않거나 이미 사용된 증표인 경우
     */
    public void consumeApprovalProof(CustomUserDetails currentUser, String proofCookie) {
        consumeProof(currentUser.getEno(), proofCookie, MfaPurpose.APPROVAL, Instant.now(clock));
    }

    /**
     * 로그인 완료 직전에 로그인 대기 사용자에게 귀속된 MFA 증표를 원자적으로 한 번 소비한다.
     *
     * @param pendingCookie 로그인 대기 증표 원문
     * @param proofCookie MFA 증표 원문
     * @return pending 거래와 동일한 사번
     * @throws MfaException 유효하지 않거나 이미 사용된 증표인 경우
     */
    public synchronized String consumeLoginProof(String pendingCookie, String proofCookie) {
        Instant now = Instant.now(clock);
        if (pendingCookie == null || pendingCookie.isBlank()) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
        LoginPendingTransaction pending =
                loginPendingTransactionStore
                        .findByTokenHash(hash(pendingCookie), now)
                        .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_REQUIRED));
        consumeProof(pending.eno(), proofCookie, MfaPurpose.LOGIN, now);
        loginPendingTransactionStore
                .consumeOnce(hash(pendingCookie), pending.eno(), now)
                .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_REQUIRED));
        return pending.eno();
    }

    private String resolveOwnerForStart(
            MfaPurpose purpose,
            Optional<CustomUserDetails> currentUser,
            String pendingCookie,
            Instant now) {
        if (purpose == MfaPurpose.APPROVAL) {
            return currentUser
                    .map(CustomUserDetails::getEno)
                    .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_REQUIRED));
        }
        return findLoginPending(pendingCookie, now).eno();
    }

    /**
     * 활성 거래를 조회한다. 없으면 저장소에 사유(만료 vs 그 밖)를 물어 정확한 에러 코드를 던진다.
     * 만료 정리 배치가 이미 물리 삭제한 오래된 거래는 저장소도 사유를 알 수 없어 MFA_REQUIRED로
     * 폴백한다(만료 직후 유예 창 안에서만 정확한 구분이 보장됨 — SEC-13 §7.2와 동일한 한계).
     */
    private MfaTransaction findActiveTransaction(String tokenHash, Instant now) {
        return transactionStore
                .findByTokenHash(tokenHash, now)
                .orElseThrow(
                        () ->
                                new MfaException(
                                        transactionStore.isExpired(tokenHash, now)
                                                ? MfaErrorCode.MFA_EXPIRED
                                                : MfaErrorCode.MFA_REQUIRED));
    }

    private void assertTransactionOwner(
            MfaTransaction transaction,
            Optional<CustomUserDetails> currentUser,
            String pendingCookie,
            Instant now) {
        String ownerEno;
        if (transaction.purpose() == MfaPurpose.LOGIN) {
            if (pendingCookie == null || pendingCookie.isBlank()) {
                throw new MfaException(MfaErrorCode.MFA_REQUIRED);
            }
            ownerEno =
                    loginPendingTransactionStore
                            .findByTokenHash(hash(pendingCookie), now)
                            .map(LoginPendingTransaction::eno)
                            .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_REQUIRED));
        } else {
            ownerEno =
                    currentUser
                            .map(CustomUserDetails::getEno)
                            .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_REQUIRED));
        }
        if (!transaction.eno().equals(ownerEno)) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
    }

    private LoginPendingTransaction findLoginPending(String pendingCookie, Instant now) {
        if (pendingCookie == null || pendingCookie.isBlank()) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
        return loginPendingTransactionStore
                .findByTokenHash(hash(pendingCookie), now)
                .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_EXPIRED));
    }

    private static void assertVerifiable(MfaTransaction transaction) {
        if (transaction.status() == MfaTransactionStatus.LOCKED) {
            throw new MfaException(MfaErrorCode.MFA_LOCKED);
        }
        if (transaction.status() != MfaTransactionStatus.PENDING) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
    }

    private static long remainingSeconds(Instant expiresAt, Instant now) {
        long milliseconds = Duration.between(now, expiresAt).toMillis();
        return Math.max(0, (milliseconds + 999) / 1_000);
    }

    private boolean isExpectedProviderChallenge(
            MfaTransaction transaction, String providerChallengeId) {
        if (transaction.providerChallengeHash() == null || providerChallengeId == null) {
            return false;
        }
        return MessageDigest.isEqual(
                transaction.providerChallengeHash().getBytes(StandardCharsets.US_ASCII),
                hash(providerChallengeId).getBytes(StandardCharsets.US_ASCII));
    }

    private void throwFailedVerification(String tokenHash, Instant now) {
        MfaTransaction failed =
                transactionStore
                        .fail(tokenHash, now, properties.maxFailures())
                        .orElseThrow(() -> new MfaException(MfaErrorCode.MFA_EXPIRED));
        if (failed.status() == MfaTransactionStatus.LOCKED) {
            throw new MfaException(MfaErrorCode.MFA_LOCKED);
        }
        throw new MfaException(MfaErrorCode.MFA_FAILED);
    }

    private void consumeProof(String eno, String proofCookie, MfaPurpose purpose, Instant now) {
        if (proofCookie == null || proofCookie.isBlank()) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
        String tokenHash = hash(proofCookie);
        ProofConsumption consumption =
                transactionStore.consumeVerifiedOnce(tokenHash, eno, purpose, now);
        if (consumption == ProofConsumption.EXPIRED) {
            throw new MfaException(MfaErrorCode.MFA_EXPIRED);
        }
        if (consumption != ProofConsumption.CONSUMED) {
            throw new MfaException(MfaErrorCode.MFA_REQUIRED);
        }
    }

    private static String hash(String value) {
        try {
            byte[] digest =
                    MessageDigest.getInstance("SHA-256")
                            .digest(value.getBytes(StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(digest);
        } catch (NoSuchAlgorithmException exception) {
            throw new IllegalStateException("SHA-256 알고리즘을 사용할 수 없습니다.", exception);
        }
    }

    private static String newProof() {
        byte[] bytes = new byte[PROOF_BYTES];
        PROOF_RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /**
     * 검증 응답 본문과 분리되어 쿠키로만 전달할 1회용 증표다.
     *
     * @param response 클라이언트에 반환할 검증 응답
     * @param proof 검증 성공 시의 증표 원문. 아직 결과가 확정되지 않은 재조회 응답에서는 null이다.
     */
    public record VerifiedChallenge(MfaDto.MfaVerifyResponse response, String proof) {}
}
```

주요 변경: `knownExpiryByTokenHash`·`cancelledExpiryByTokenHash` 필드와 `removeExpiredTracking()` 제거(및 `registerLoginPending`·`startChallenge`의 호출부), `cancelChallenge`의 `cancelledExpiryByTokenHash.put(...)` 제거, `consumeProof`의 두 맵 `.remove(...)` 제거, `findActiveTransaction` 단순화, `startChallenge`가 `challenge.providerTransactionId()`를 `MfaTransaction.pending(...)`에 7번째 인자로 전달, `verifyChallenge`가 `transaction.svcTrId()`를 `MfaVerifyContext`에 4번째 인자로 전달. `ConcurrentHashMap` import 제거.

### Step 12: MfaTransactionRestoreTest — restore() 인자 순서 변경 반영

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.domain;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import org.junit.jupiter.api.Test;

/** 영속 계층 매핑 전용 restore() 팩토리와 확장된 상태값의 계약을 고정한다. */
class MfaTransactionRestoreTest {

    private static final Instant EXPIRES_AT = Instant.parse("2026-08-20T00:01:30Z");
    private static final Instant VERIFIED_AT = Instant.parse("2026-08-20T00:00:30Z");

    @Test
    void restore는_저장된_필드를_그대로_복원한다() {
        MfaTransaction restored =
                MfaTransaction.restore(
                        "token-hash",
                        "E10001",
                        MfaPurpose.APPROVAL,
                        MfaMethod.FIDO,
                        EXPIRES_AT,
                        "try-hash",
                        "12345678901234567890",
                        "proof-hash",
                        MfaTransactionStatus.CONSUMED,
                        VERIFIED_AT,
                        2);

        assertThat(restored.tokenHash()).isEqualTo("token-hash");
        assertThat(restored.eno()).isEqualTo("E10001");
        assertThat(restored.purpose()).isEqualTo(MfaPurpose.APPROVAL);
        assertThat(restored.method()).isEqualTo(MfaMethod.FIDO);
        assertThat(restored.expiresAt()).isEqualTo(EXPIRES_AT);
        assertThat(restored.providerChallengeHash()).isEqualTo("try-hash");
        assertThat(restored.svcTrId()).isEqualTo("12345678901234567890");
        assertThat(restored.proofHash()).isEqualTo("proof-hash");
        assertThat(restored.status()).isEqualTo(MfaTransactionStatus.CONSUMED);
        assertThat(restored.verifiedAt()).isEqualTo(VERIFIED_AT);
        assertThat(restored.failureCount()).isEqualTo(2);
    }

    @Test
    void restore는_취소_상태를_검증시각_없이_복원할_수_있다() {
        MfaTransaction restored =
                MfaTransaction.restore(
                        "token-hash-2",
                        "E10001",
                        MfaPurpose.LOGIN,
                        MfaMethod.MOTP,
                        EXPIRES_AT,
                        null,
                        null,
                        null,
                        MfaTransactionStatus.CANCELLED,
                        null,
                        0);

        assertThat(restored.status()).isEqualTo(MfaTransactionStatus.CANCELLED);
        assertThat(restored.verifiedAt()).isNull();
        assertThat(restored.svcTrId()).isNull();
    }
}
```

### Step 13: MfaValueObjectsTest — 생성 호출부 인자 추가

전체 파일을 다음으로 교체:

```java
package com.kdb.it.common.mfa.provider;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.kdb.it.common.mfa.domain.MfaMethod;
import com.kdb.it.common.mfa.domain.MfaPurpose;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** MFA 값 객체와 공급자 레지스트리의 입력 검증 계약을 고정한다. */
class MfaValueObjectsTest {

    private static final Instant EXPIRES_AT = Instant.parse("2026-08-11T00:01:30Z");

    @Test
    void startContext_거래식별자가_비어_있으면_거부한다() {
        assertThatThrownBy(() -> new MfaStartContext(null, "E10001", MfaPurpose.LOGIN, EXPIRES_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MfaStartContext("  ", "E10001", MfaPurpose.LOGIN, EXPIRES_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void startContext_사원번호가_비어_있으면_거부한다() {
        assertThatThrownBy(() -> new MfaStartContext("tx-1", null, MfaPurpose.LOGIN, EXPIRES_AT))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MfaStartContext("tx-1", "", MfaPurpose.LOGIN, EXPIRES_AT))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void startContext_목적과_만료시각은_필수다() {
        assertThatThrownBy(() -> new MfaStartContext("tx-1", "E10001", null, EXPIRES_AT))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MfaStartContext("tx-1", "E10001", MfaPurpose.LOGIN, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void verifyContext_시작거래와_challenge식별자는_필수다() {
        MfaStartContext start = startContext();

        assertThatThrownBy(() -> new MfaVerifyContext(null, "challenge-1", "", null))
                .isInstanceOf(NullPointerException.class);
        assertThatThrownBy(() -> new MfaVerifyContext(start, null, "", null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MfaVerifyContext(start, " ", "", null))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void verifyContext_검증값이_null이면_빈_문자열로_접는다() {
        MfaVerifyContext context = new MfaVerifyContext(startContext(), "challenge-1", null, null);

        assertThat(context.verificationValue()).isEmpty();
    }

    @Test
    void verifyContext_공급자거래식별자를_그대로_보관한다() {
        MfaVerifyContext context =
                new MfaVerifyContext(startContext(), "challenge-1", "", "svc-tr-id");

        assertThat(context.providerTransactionId()).isEqualTo("svc-tr-id");
    }

    @Test
    void challengeData_식별자와_만료시각을_검증한다() {
        assertThatThrownBy(() -> new MfaChallengeData(null, "qr", null, EXPIRES_AT, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MfaChallengeData(" ", "qr", null, EXPIRES_AT, null))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> new MfaChallengeData("challenge-1", "qr", null, null, null))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void challengeData_QR이_없어도_생성된다() {
        assertThat(new MfaChallengeData("challenge-1", null, null, EXPIRES_AT, null).qrData())
                .isNull();
    }

    @Test
    void challengeData_공급자거래식별자를_그대로_보관한다() {
        assertThat(
                        new MfaChallengeData("challenge-1", null, null, EXPIRES_AT, "svc-tr-id")
                                .providerTransactionId())
                .isEqualTo("svc-tr-id");
    }

    @Test
    void registry_기본생성자는_어떤_인증수단도_활성화하지_않는다() {
        MfaProviderRegistry registry = new MfaProviderRegistry();

        assertThatThrownBy(() -> registry.start(MfaMethod.FIDO, startContext()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void registry_등록되지_않은_인증수단은_거부한다() {
        MfaProviderRegistry registry =
                new MfaProviderRegistry(Map.of(MfaMethod.MOTP, new MockMfaProvider()));

        assertThatThrownBy(() -> registry.start(MfaMethod.FINGER_VEIN, startContext()))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(
                        () ->
                                registry.verify(
                                        MfaMethod.FIDO,
                                        new MfaVerifyContext(startContext(), "challenge-1", "", null)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void registry_인증수단이_null이면_거부한다() {
        MfaProviderRegistry registry =
                new MfaProviderRegistry(Map.of(MfaMethod.MOTP, new MockMfaProvider()));

        assertThatThrownBy(() -> registry.start(null, startContext()))
                .isInstanceOf(NullPointerException.class);
    }

    @Test
    void registry_등록된_인증수단은_공급자에게_위임한다() {
        MfaProviderRegistry registry =
                new MfaProviderRegistry(Map.of(MfaMethod.MOTP, new MockMfaProvider()));
        MfaStartContext context = startContext();

        MfaChallengeData challenge = registry.start(MfaMethod.MOTP, context);
        MfaVerificationResult result =
                registry.verify(
                        MfaMethod.MOTP,
                        new MfaVerifyContext(context, challenge.challengeId(), "", null));

        assertThat(challenge.challengeId()).isEqualTo(context.transactionId());
        assertThat(result.verified()).isTrue();
    }

    private static MfaStartContext startContext() {
        return new MfaStartContext("tx-1", "E10001", MfaPurpose.LOGIN, EXPIRES_AT);
    }
}
```

### Step 14: MfaProviderRegistryTest — 생성 호출부 인자 추가

23~32행을 다음으로 교체:

```java
        MfaChallengeData challenge = registry.start(MfaMethod.FINGER_VEIN, context);

        assertThat(challenge.challengeId()).isEqualTo("transaction-1");
        assertThat(
                        registry.verify(
                                        MfaMethod.FINGER_VEIN,
                                        new MfaVerifyContext(context, "transaction-1", "", null))
                                .verified())
                .isTrue();
```

### Step 15: FingerVeinMfaProviderTest — 생성 호출부 인자 추가

`FingerVeinMfaProvider`는 이번 범위 밖이지만, `MfaVerifyContext` 생성 호출부는 전부 4번째 인자(`null`)가 필요하다. 다음 6개 호출부에 `null`을 추가한다(파일의 다른 부분은 변경하지 않는다):

- 82행: `new MfaVerifyContext(context("tx-hash"), challenge.challengeId(), hash)` → `new MfaVerifyContext(context("tx-hash"), challenge.challengeId(), hash, null)`
- 96행: 동일 패턴으로 `null` 추가
- 109행: `new MfaVerifyContext(context("tx-hash"), challenge.challengeId(), "FE00")` → 끝에 `, null` 추가
- 124~125행: `new MfaVerifyContext(context("tx-target"), target.challengeId(), foreignHash)` → 끝에 `, null` 추가
- 136~139행: `new MfaVerifyContext(context("tx-hash"), "tx-hash", expectedHash("20260811", ENO, "123456", "SUCC"))` → 끝에 `, null` 추가
- 150행, 154행: `new MfaVerifyContext(context("tx-hash"), challenge.challengeId(), hash)` (두 곳) → 각각 끝에 `, null` 추가
- 169행: `new MfaVerifyContext(expired, challenge.challengeId(), hash)` → 끝에 `, null` 추가
- 183행: `new MfaVerifyContext(context("tx-first"), "tx-first", hash)` → 끝에 `, null` 추가

### Step 16: MfaServiceTest — 생성 호출부 인자 추가, 만료 관련 주석 정리

`MfaChallengeData`를 직접 생성하는 5개 지점(`successProvider()`, `failureProvider()`, `verification_비밀값과QR원문을로그에남기지않는다`, `미결정응답은실패횟수를소진하지않고증표도발급하지않는다`, `미결정응답뒤의실제실패는여전히실패로집계한다`) 모두 5번째 인자로 `null`을 추가한다. 예:

```java
                return new MfaChallengeData("provider-id", null, null, context.expiresAt(), null);
```

`만료된_거래의_검증은_만료로_구분한다` 테스트(현재 741~773행 부근)에서 마지막 줄의 주석 `// 만료 추적 맵도 다음 challenge 시작 시 정리된다.`를 삭제한다 — 로컬 맵이 제거되어 더 이상 사실이 아니다. 그 아래의 `service.startChallenge(...)` 호출 자체는 그대로 둔다(새 challenge가 예외 없이 시작되는지 확인하는 목적은 여전히 유효하다).

### Step 17: InMemoryMfaTransactionStoreTest — isExpired() 계약 테스트 추가

`consumeVerifiedOnce_missingTransaction_isMissing` 테스트 뒤(현재 파일의 마지막 `@Test` 다음, `verifiedStore` 헬퍼 앞)에 추가:

```java

    @Test
    @DisplayName("isExpired는 저장된 거래가 만료된 경우에만 true다")
    void isExpired_reflectsSavedExpiry() {
        MfaTransactionStore store = new InMemoryMfaTransactionStore();
        store.save(pending("token-not-expired", now().plusSeconds(60)));
        store.save(pending("token-expired", now()));

        assertThat(store.isExpired("token-not-expired", now())).isFalse();
        assertThat(store.isExpired("token-expired", now())).isTrue();
        assertThat(store.isExpired("token-absent", now())).isFalse();
    }
```

### Step 18: JpaMfaTransactionStoreIT — svcTrId round-trip과 isExpired() 케이스 추가

로컬 Oracle이 필요한 통합 테스트다. `verifyAndBindProof_pendingTransaction_becomesVerified` 테스트 뒤에 두 테스트를 추가한다(파일 상단 import에 이미 `MfaMethod`·`MfaPurpose`·`MfaTransaction`이 있으므로 추가 import는 필요 없다):

```java

    @Test
    @DisplayName("저장한 svcTrId는 조회 시 그대로 돌아온다")
    void save_svcTrId_roundTrips() {
        Instant now = Instant.now();
        tokenHash = newToken();
        store.save(
                MfaTransaction.pending(
                        tokenHash,
                        "ITEST01",
                        MfaPurpose.LOGIN,
                        MfaMethod.FIDO,
                        now.plusSeconds(90),
                        "try-hash",
                        "12345678901234567890"));

        assertThat(store.findByTokenHash(tokenHash, now))
                .get()
                .extracting(MfaTransaction::svcTrId)
                .isEqualTo("12345678901234567890");
    }

    @Test
    @DisplayName("isExpired는 만료 전에는 false, 만료 후에는 true다")
    void isExpired_reflectsEndDtm() {
        Instant now = Instant.now();
        tokenHash = newToken();
        store.save(pending(tokenHash, now.plusSeconds(1)));

        assertThat(store.isExpired(tokenHash, now)).isFalse();
        assertThat(store.isExpired(tokenHash, now.plusSeconds(2))).isTrue();
        assertThat(store.isExpired("absent-token", now)).isFalse();
    }
```

`pending(String, Instant)` 헬퍼는 5-인자 `MfaTransaction.pending(...)`을 호출하므로 Step 6의 변경과 무관하게 그대로 컴파일된다(5-인자 오버로드는 이번에 손대지 않았다).

### Step 19: OnePassClientTest — FIDO 로컬 맵 관련 테스트 제거·재작성

다음 5개 테스트를 **완전히 삭제**한다 — 전제(로컬 맵·LRU·재사용 idempotency)가 사라졌다:

- `fidoProvider_startTwiceForSameTransaction_reusesFirstChallenge` (129~148행)
- `fidoProvider_dropsOldestPendingTransactionAtCapacity` (151~170행)
- `fidoProvider_rejectsCapacityBelowOne` (173~178행)
- `fidoProvider_removesExpiredPendingTransactionsBeforeConfirming` (181~203행)
- `fidoProvider_treatsUnknownChallengeAsFailureNotUndecided` (377~393행)

다음 4개 테스트는 **컨텍스트에 svcTrId를 수동으로 실어 전달하도록 수정**한다(`FidoMfaProvider`가 더는 로컬 맵에서 조회하지 않으므로, 호출자가 `challenge.providerTransactionId()`를 `MfaVerifyContext`에 직접 실어야 한다):

`fidoProvider_reusesStartServiceTransactionIdForDocumentedConfirmRequest` (88~126행)를 다음으로 교체:

```java
    @Test
    void fidoProvider_reusesStartServiceTransactionIdForDocumentedConfirmRequest()
            throws Exception {
        List<Map<String, Object>> requests = new java.util.ArrayList<>();
        AtomicInteger callCount = new AtomicInteger();
        startServer(
                exchange -> {
                    requests.add(requestBody(exchange));
                    if (callCount.getAndIncrement() == 0) {
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trId\":\"fido-tr\",\"qrImage\":\"qr\"}}");
                    } else {
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trStatus\":\"1\"}}");
                    }
                });
        FidoMfaProvider provider = new FidoMfaProvider(client());

        MfaChallengeData challenge = provider.start(context());
        MfaVerificationResult result =
                provider.verify(
                        new MfaVerifyContext(
                                context(),
                                challenge.challengeId(),
                                "",
                                challenge.providerTransactionId()));

        assertFidoStartRequest(requests.getFirst());
        assertThat(requests.get(1))
                .isEqualTo(
                        Map.of(
                                "command",
                                "trResultConfirm",
                                "svcTrId",
                                requests.getFirst().get("svcTrId"),
                                "crossDomain",
                                true));
        assertThat(challenge)
                .isEqualTo(
                        new MfaChallengeData(
                                "fido-tr", "qr", null, context().expiresAt(), challenge.providerTransactionId()));
        assertThat(challenge.providerTransactionId()).isEqualTo(requests.getFirst().get("svcTrId"));
        assertThat(result.verified()).isTrue();
    }
```

`fidoProvider_treatsNestedNonApprovedStatusAsUndecided` (324~350행)를 다음으로 교체:

```java
    @Test
    void fidoProvider_treatsNestedNonApprovedStatusAsUndecided() throws Exception {
        AtomicInteger callCount = new AtomicInteger();
        startServer(
                exchange -> {
                    requestBody(exchange);
                    if (callCount.getAndIncrement() == 0) {
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trId\":\"fido-tr\",\"qrImage\":\"qr\"}}");
                    } else {
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trStatus\":\"0\"}}");
                    }
                });
        FidoMfaProvider provider = new FidoMfaProvider(client());
        MfaChallengeData challenge = provider.start(context());

        MfaVerificationResult result =
                provider.verify(
                        new MfaVerifyContext(
                                context(),
                                challenge.challengeId(),
                                "",
                                challenge.providerTransactionId()));

        assertThat(result.outcome()).isEqualTo(MfaVerificationResult.Outcome.UNDECIDED);
        assertThat(result.verified()).isFalse();
    }
```

`fidoProvider_treatsNonSuccessResultCodeAsFailure` (352~374행)를 다음으로 교체:

```java
    @Test
    void fidoProvider_treatsNonSuccessResultCodeAsFailure() throws Exception {
        AtomicInteger callCount = new AtomicInteger();
        startServer(
                exchange -> {
                    requestBody(exchange);
                    if (callCount.getAndIncrement() == 0) {
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trId\":\"fido-tr\",\"qrImage\":\"qr\"}}");
                    } else {
                        respond(exchange, 200, "{\"resultCode\":\"900001\"}");
                    }
                });
        FidoMfaProvider provider = new FidoMfaProvider(client());
        MfaChallengeData challenge = provider.start(context());

        MfaVerificationResult result =
                provider.verify(
                        new MfaVerifyContext(
                                context(),
                                challenge.challengeId(),
                                "",
                                challenge.providerTransactionId()));

        assertThat(result.outcome()).isEqualTo(MfaVerificationResult.Outcome.FAILED);
    }
```

`fidoProvider_confirmsDifferentChallengesConcurrentlyAndConsumesEachOnSuccess` (396~464행)를 다음으로 교체 — 마지막 "재확인은 실패한다" 블록을 제거한다(그 보장은 이제 `JpaMfaTransactionStoreIT.consumeVerifiedOnce_concurrentConsumers_exactlyOneSucceeds`가 DB 계층에서 검증하며, `FidoMfaProvider`는 더는 상태가 없어 같은 컨텍스트로 다시 호출하면 매번 새로 `confirmFido`를 호출한다):

```java
    @Test
    void fidoProvider_confirmsDifferentChallengesConcurrently() throws Exception {
        AtomicInteger startCount = new AtomicInteger();
        CountDownLatch confirmationsEntered = new CountDownLatch(2);
        CountDownLatch releaseConfirmations = new CountDownLatch(1);
        startServer(
                exchange -> {
                    Map<String, Object> request = requestBody(exchange);
                    if ("requestServiceAuth".equals(request.get("command"))) {
                        int sequence = startCount.incrementAndGet();
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trId\":\"fido-"
                                        + sequence
                                        + "\",\"qrImage\":\"qr\"}}");
                        return;
                    }
                    confirmationsEntered.countDown();
                    try {
                        releaseConfirmations.await(2, TimeUnit.SECONDS);
                        respond(
                                exchange,
                                200,
                                "{\"resultCode\":\"100000\",\"resultData\":{\"trStatus\":\"1\"}}");
                    } catch (InterruptedException exception) {
                        Thread.currentThread().interrupt();
                    }
                });
        FidoMfaProvider provider = new FidoMfaProvider(client(Duration.ofSeconds(3)));
        MfaStartContext firstContext = context("transaction-1");
        MfaStartContext secondContext = context("transaction-2");
        MfaChallengeData firstChallenge = provider.start(firstContext);
        MfaChallengeData secondChallenge = provider.start(secondContext);
        ExecutorService verifierExecutor = Executors.newFixedThreadPool(2);
        try {
            Future<MfaVerificationResult> firstResult =
                    verifierExecutor.submit(
                            () ->
                                    provider.verify(
                                            new MfaVerifyContext(
                                                    firstContext,
                                                    firstChallenge.challengeId(),
                                                    "",
                                                    firstChallenge.providerTransactionId())));
            Future<MfaVerificationResult> secondResult =
                    verifierExecutor.submit(
                            () ->
                                    provider.verify(
                                            new MfaVerifyContext(
                                                    secondContext,
                                                    secondChallenge.challengeId(),
                                                    "",
                                                    secondChallenge.providerTransactionId())));

            assertThat(confirmationsEntered.await(500, TimeUnit.MILLISECONDS)).isTrue();
            releaseConfirmations.countDown();

            assertThat(firstResult.get(2, TimeUnit.SECONDS).verified()).isTrue();
            assertThat(secondResult.get(2, TimeUnit.SECONDS).verified()).isTrue();
        } finally {
            releaseConfirmations.countDown();
            verifierExecutor.shutdownNow();
        }
    }
```

나머지 `MfaChallengeData`/`MfaVerifyContext` 생성 호출부에도 각각 5번째/4번째 인자로 `null`을 추가한다(위에서 전체 교체한 FIDO 관련 테스트들은 이미 처리됐으므로 제외):

- `motpStart_sendsDocumentedRequestAndMapsNestedSafeResponse` 테스트의 `assertThat(challenge).isEqualTo(new MfaChallengeData("motp-tr", "qr", null, context().expiresAt()));` → 끝에 `, null` 추가
- `motpProvider_delegatesStartAndVerifyToClient` 테스트의 `provider.verify(new MfaVerifyContext(context(), challenge.challengeId(), "123456"));` → 끝에 `, null` 추가

`fidoStart_exposesChallengeThroughClientFacade` 테스트(308~322행)는 `OnePassClient.requestFidoChallenge`를 직접 호출하는 경로라 `providerTransactionId`가 실제 svcTrId 값이어야 한다. `MfaChallengeData` 전체를 `isEqualTo`로 비교하던 기존 방식 대신, 실제 요청에서 쓰인 svcTrId와 일치하는지 확인하도록 전체를 다음으로 교체한다:

```java
    @Test
    void fidoStart_exposesChallengeThroughClientFacade() throws Exception {
        List<Map<String, Object>> requests = new java.util.ArrayList<>();
        startServer(
                exchange -> {
                    requests.add(requestBody(exchange));
                    respond(
                            exchange,
                            200,
                            "{\"resultCode\":\"100000\",\"resultData\":{\"trId\":\"fido-tr\",\"qrImage\":\"qr\"}}");
                });

        MfaChallengeData challenge = client().requestFidoChallenge(context());

        assertThat(challenge)
                .isEqualTo(
                        new MfaChallengeData(
                                "fido-tr", "qr", null, context().expiresAt(), challenge.providerTransactionId()));
        assertThat(challenge.providerTransactionId())
                .isEqualTo(requests.getFirst().get("svcTrId"));
    }
```

이 교체가 308~322행의 기존 `fidoStart_exposesChallengeThroughClientFacade`를 대체한다.)

- `rejectsOversizedNestedQrImage` 테스트는 `MfaChallengeData`를 직접 생성하지 않으므로 변경 불필요.

### Step 20: 전체 테스트 실행

Run: `cd C:/it/it_backend && ./gradlew test --tests 'com.kdb.it.common.mfa.*'`
Expected: BUILD SUCCESSFUL, 회귀 없음(삭제한 5개 테스트만큼 총 개수 감소).

Run: `cd C:/it/it_backend && ./gradlew integrationTest --tests 'com.kdb.it.common.mfa.store.JpaMfaTransactionStoreIT'` (로컬 Oracle 필요)
Expected: BUILD SUCCESSFUL, 6개 테스트(기존 4개 + 신규 2개) 통과.

Run: `cd C:/it/it_backend && ./gradlew test`
Expected: BUILD SUCCESSFUL, 전체 회귀 없음.

### Step 21: Commit

```bash
cd C:/it/it_backend
git add src/main/java/com/kdb/it/common/mfa/provider/MfaChallengeData.java \
        src/main/java/com/kdb/it/common/mfa/provider/MfaVerifyContext.java \
        src/main/java/com/kdb/it/common/mfa/provider/OnePassClient.java \
        src/main/java/com/kdb/it/common/mfa/provider/FidoMfaProvider.java \
        src/main/java/com/kdb/it/common/mfa/provider/MockMfaProvider.java \
        src/main/java/com/kdb/it/common/mfa/domain/MfaTransaction.java \
        src/main/java/com/kdb/it/common/mfa/store/MfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStore.java \
        src/main/java/com/kdb/it/common/mfa/store/MfaTransactionEntity.java \
        src/main/java/com/kdb/it/common/mfa/service/MfaService.java \
        src/test/java/com/kdb/it/common/mfa/domain/MfaTransactionRestoreTest.java \
        src/test/java/com/kdb/it/common/mfa/provider/MfaValueObjectsTest.java \
        src/test/java/com/kdb/it/common/mfa/provider/OnePassClientTest.java \
        src/test/java/com/kdb/it/common/mfa/provider/FingerVeinMfaProviderTest.java \
        src/test/java/com/kdb/it/common/mfa/provider/MfaProviderRegistryTest.java \
        src/test/java/com/kdb/it/common/mfa/service/MfaServiceTest.java \
        src/test/java/com/kdb/it/common/mfa/store/InMemoryMfaTransactionStoreTest.java \
        src/test/java/com/kdb/it/common/mfa/store/JpaMfaTransactionStoreIT.java
git commit -m "feat: SEC-16 FIDO 인스턴스 로컬 상태 제거 — svcTrId 컨텍스트 경유, MfaService 로컬 맵 삭제"
```

---

## Task 2: 문서·과제 정리

**저장소:** `C:\it` (루트, 이 프로젝트의 공유 워킹트리 관례에 따라 main에 직접 커밋)

**Files:**
- Modify: `C:/it/TASK.md`
- Modify: `C:/it/TASK_DONE.md`

**Interfaces:** 없음(문서 전용).

- [ ] **Step 1: TASK.md에서 SEC-16 제거**

`C:/it/TASK.md`에서 SEC-16 행을 정확히 삭제(표의 다른 행에는 손대지 않는다):

```
| SEC-16 |     🟢 Low      | MFA  | FIDO 폴링의 인스턴스 로컬 상태          | SEC-13로 거래 저장소는 Oracle 공유 테이블로 옮겼지만 `FidoMfaProvider.pendingByTransactionId`(OnePass `svcTrId`)와 `MfaService`의 만료·취소 판별용 로컬 맵은 여전히 인스턴스 메모리에 있다. 폴링이 challenge를 시작한 인스턴스가 아닌 곳으로 가면 `undecided()` 대신 `failure()`가 반환돼 약 15초 만에 거래가 잠긴다(설계 §2). `TPRMPP_CMFATM.APN_CER_SVC_TR_NO`는 이 값을 담기 위해 이미 마련돼 있으나 아직 어떤 코드도 채우지 않는다. 다중 인스턴스 배포 직전에 `MfaChallengeData`·`MfaVerifyContext`에 `providerTransactionId`를 추가하고 `FidoMfaProvider`가 컨텍스트로 값을 주고받도록 고쳐야 한다.
```

- [ ] **Step 2: TASK_DONE.md에 완료 기록 추가**

`C:/it/TASK_DONE.md`의 "🗂️ 진행 중에서 종료된 항목" 아래(가장 최근 항목 앞)에 추가:

```markdown
### ✅ 2026-08-20 SEC-16 FIDO 인스턴스 로컬 상태 제거

`FidoMfaProvider`의 `svcTrId` 로컬 맵(LRU 축출 포함)과 `MfaService`의 만료·취소 추적 로컬 맵
2개를 모두 제거했다. `svcTrId`는 `MfaChallengeData`·`MfaVerifyContext`의 새 필드
`providerTransactionId`로 컨텍스트를 통해 주고받고, SEC-13에서 이미 마련해둔
`TPRMPP_CMFATM.APN_CER_SVC_TR_NO`에 실제로 영속·조회한다. 만료 판정은
`MfaTransactionStore.isExpired()` 조회 메서드로 대체했다 — Jpa 구현은 DB를 근거로 다른
인스턴스에서 시작된 거래도 정확히 판별하고, InMemory 구현은 자체 보조 맵으로 단일 인스턴스
dev 용도를 그대로 지원한다.

| 상태 | 항목 | 조치 | 저장소 커밋 | 검증 증거 |
| :--: | --- | --- | --- | --- |
| ✅ Done | SEC-16 | svcTrId 컨텍스트 경유, 로컬 맵 2종 제거, FidoMfaProvider·OnePassClient 단순화 | it_backend `<커밋 SHA>` | `./gradlew test` BUILD SUCCESSFUL, `./gradlew integrationTest --tests '*JpaMfaTransactionStoreIT*'` BUILD SUCCESSFUL(로컬 Oracle) |
```

`<커밋 SHA>`는 Task 1의 실제 커밋 해시로 채운다(`git -C it_backend log --oneline -1`).

- [ ] **Step 3: Commit**

```bash
cd C:/it
git add TASK.md TASK_DONE.md
git commit -m "docs: SEC-16 완료 이관"
```

---

## 최종 확인

```bash
cd C:/it/it_backend
./gradlew test
./gradlew integrationTest --tests '*Mfa*IT'
./gradlew check
```
