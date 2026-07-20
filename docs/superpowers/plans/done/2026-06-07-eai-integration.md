# EAI 통합 (KDB 표준전문 발송) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ePAMS의 EAI 호출 로직을 참고하여, KDB 표준전문(고정길이 전문)을 EAI 게이트웨이로 전송하는 범용 `EaiService`를 `com.kdb.it.infra.eai`에 포팅한다.

**Architecture:** 전문 조립(`EaiMessageBuilder`)과 전송(`EaiService`)을 분리한다. 비결정 필드(시각/난수/IP·MAC)는 주입 시임(`Clock`/`Supplier<String>`/`HostAddressProvider`)으로 외부화하여 테스트 가능하게 한다. 인코딩은 명시적 MS949. 개발/CI에선 `eai.enabled=false`로 전송을 스킵하고 전문만 로깅한다. ePAMS 조립 로직을 전사한 동결 참조 빌더와 신규 빌더의 결과를 `byte[]` 단위로 비교하는 특성화 테스트로 충실 포팅을 보증한다.

**Tech Stack:** Java 25, Spring Boot 4.0.5, Spring `RestClient`(octet-stream, `byte[]`), JUnit 5 + AssertJ + Mockito, `MockRestServiceServer`(spring-test), Lombok.

**Spec:** `docs/superpowers/specs/2026-06-07-eai-integration-design.md`

**참조 (읽기 전용):**
- `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\service\EaiService.java` (전문 조립 원본)
- `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\dto\EaiDTO.java`
- `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java` (RestClient 컨벤션)

**작업 디렉토리:** 모든 경로는 `it_backend/` 기준. 패키지 루트 `com.kdb.it`.

**공통 규약:** 한글 주석(루트 CLAUDE.md §4.1), 생성자 주입, 작은 파일. 테스트는 `src/test/java` 미러 구조.

---

## File Structure

| 파일 | 책임 |
|------|------|
| `infra/eai/config/EaiProperties.java` | `@ConfigurationProperties("eai")` 설정 바인딩 (enabled/url/charset/timeout/시스템식별자) |
| `infra/eai/config/EaiInfraConfig.java` | `EaiProperties` 등록 + 결정성 시임 빈(`Clock`/`Supplier<String> eaiGuidRandom`) + EAI 전용 `RestClient` 빈 |
| `infra/eai/dto/EaiRequest.java` | UMS 발송 요청 (`@Getter @Builder`, 기본값) |
| `infra/eai/dto/EaiResult.java` | 발송 결과 `record` (success/skipped/responseRaw/errorMessage + 정적 팩토리) |
| `infra/eai/service/HostAddressProvider.java` | IP/MAC 공급 SPI + 기본 구현 (`InetAddress`) |
| `infra/eai/service/EaiMessageBuilder.java` | 표준전문(param01~08) 조립 + `lpad` + MS949 길이계산 |
| `infra/eai/service/EaiService.java` | 전송 오케스트레이션(enabled 분기, RestClient, 결과/로그/마스킹) |
| `test/.../infra/eai/service/EpamsReferenceMessageBuilder.java` | ePAMS 조립 로직 전사본 (동결, 테스트 전용 오라클) |
| `test/.../infra/eai/service/EaiMessageBuilderTest.java` | 바이트 동일성 + lpad + MS949 + 구간 진단 |
| `test/.../infra/eai/service/EaiServiceTest.java` | enabled 분기 / MockRestServiceServer / 실패 처리 |
| `test/.../infra/eai/dto/EaiResultTest.java` | 결과 팩토리 단위 테스트 |
| `src/main/resources/application.properties` | `eai.*` 기본값 추가 |
| `TASK.md` (루트) | 후속 과제 등록 |

> 의존성: 신규 라이브러리 불필요. `RestClient`는 `spring-boot-starter-web`, `MockRestServiceServer`는 `spring-boot-starter-test`에 이미 포함.

---

## Task 1: EaiResult record (발송 결과 모델)

가장 의존성이 적은 값 타입부터 시작한다.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/dto/EaiResult.java`
- Test: `src/test/java/com/kdb/it/infra/eai/dto/EaiResultTest.java`

- [ ] **Step 1: Write the failing test**

```java
// src/test/java/com/kdb/it/infra/eai/dto/EaiResultTest.java
package com.kdb.it.infra.eai.dto;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class EaiResultTest {

    @Test
    @DisplayName("success: success=true, skipped=false, 응답 보관")
    void success_setsFlags() {
        EaiResult r = EaiResult.success("OK-RAW");
        assertThat(r.success()).isTrue();
        assertThat(r.skipped()).isFalse();
        assertThat(r.responseRaw()).isEqualTo("OK-RAW");
        assertThat(r.errorMessage()).isNull();
    }

    @Test
    @DisplayName("skipped: 전송 스킵 상태 (success=false, skipped=true)")
    void skipped_setsFlags() {
        EaiResult r = EaiResult.skip();
        assertThat(r.success()).isFalse();
        assertThat(r.skipped()).isTrue();
        assertThat(r.responseRaw()).isNull();
        assertThat(r.errorMessage()).isNull();
    }

    @Test
    @DisplayName("failure: success=false, 오류메시지 보관")
    void failure_setsMessage() {
        EaiResult r = EaiResult.failure("전송 실패: timeout");
        assertThat(r.success()).isFalse();
        assertThat(r.skipped()).isFalse();
        assertThat(r.errorMessage()).isEqualTo("전송 실패: timeout");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.dto.EaiResultTest"`
Expected: 컴파일 실패 (`EaiResult` 미존재).

- [ ] **Step 3: Write minimal implementation**

```java
// src/main/java/com/kdb/it/infra/eai/dto/EaiResult.java
package com.kdb.it.infra.eai.dto;

/**
 * EAI 발송 결과.
 *
 * <p>ePAMS의 어색한 {@code null}/빈 {@code EaiDTO} 반환 패턴을 대체한다.
 * 호출자 흐름을 차단하지 않는 부수효과 원칙을 따른다(실패해도 예외 전파 없음).</p>
 *
 * @param success      전송 성공 여부
 * @param skipped      전송 스킵 여부 ({@code eai.enabled=false})
 * @param responseRaw  게이트웨이 원시 응답(성공 시), 그 외 null
 * @param errorMessage 실패 사유(실패 시), 그 외 null
 */
public record EaiResult(boolean success, boolean skipped, String responseRaw, String errorMessage) {

    /** 전송 성공. */
    public static EaiResult success(String responseRaw) {
        return new EaiResult(true, false, responseRaw, null);
    }

    /** 전송 스킵(비활성화). 전문은 빌드·로깅되었으나 HTTP는 호출되지 않음.
     *  주의: record 컴포넌트 접근자 {@code skipped()}와 시그니처가 충돌하므로 팩토리명은 {@code skip()}. */
    public static EaiResult skip() {
        return new EaiResult(false, true, null, null);
    }

    /** 전송/빌드 실패. 예외 전파 없이 결과로만 표현. */
    public static EaiResult failure(String errorMessage) {
        return new EaiResult(false, false, null, errorMessage);
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.dto.EaiResultTest"`
Expected: PASS (3개).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/dto/EaiResult.java it_backend/src/test/java/com/kdb/it/infra/eai/dto/EaiResultTest.java
git commit -m "feat(eai): EaiResult 발송 결과 record 추가"
```

---

## Task 2: EaiProperties (설정 바인딩)

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/config/EaiProperties.java`

설정 클래스는 단위 테스트보다 통합 바인딩이 의미 있으므로, 여기서는 클래스만 만들고 바인딩 검증은 Task 9(서비스 통합)에서 확인한다. (스프링 컨텍스트 없이 단순 getter라 TDD 가치 낮음 — 코딩표준 "트리비얼 테스트 생략" 적용.)

- [ ] **Step 1: Create EaiProperties**

```java
// src/main/java/com/kdb/it/infra/eai/config/EaiProperties.java
package com.kdb.it.infra.eai.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * EAI 게이트웨이 연동 설정 — 접두사 {@code eai}.
 *
 * <p>시스템 식별자(IPP/PRM/PP)는 소스 하드코딩 없이 프로퍼티/프로파일로 관리한다.
 * 비결정 값(시각/난수/IP·MAC)은 본 설정이 아니라 별도 시임 빈으로 주입한다.</p>
 *
 * @param enabled        실제 HTTP 전송 여부. false면 전문 빌드·로깅만 수행.
 * @param url            EAI 게이트웨이 URL. enabled=true일 때 필수.
 * @param charset        고정길이 전문 인코딩(기본 MS949).
 * @param connectTimeout 연결 타임아웃(ms).
 * @param readTimeout    읽기 타임아웃(ms).
 * @param sysEnvTc       시스템환경구분코드 1자리(운영 "P" / 그 외 "L").
 * @param fwdiSysC       전송시스템코드 3자리(FWDI_SYS_C/FST_FWDI_SYS_C, GUID 접두로도 사용).
 * @param bzCS3          업무코드_S3 3자리.
 * @param appC           어플리케이션코드 3자리(APP_C).
 * @param appBzLv1C      어플리케이션업무1레벨코드 2자리(APP_BZ_LV1_C).
 */
@ConfigurationProperties(prefix = "eai")
public record EaiProperties(
        boolean enabled,
        String url,
        String charset,
        int connectTimeout,
        int readTimeout,
        String sysEnvTc,
        String fwdiSysC,
        String bzCS3,
        String appC,
        String appBzLv1C
) {
    /** 누락 기본값 보정 — 프로퍼티 미지정 시 안전한 기본값 적용. */
    public EaiProperties {
        if (charset == null || charset.isBlank()) charset = "MS949";
        if (connectTimeout <= 0) connectTimeout = 3000;
        if (readTimeout <= 0) readTimeout = 3000;
        if (sysEnvTc == null || sysEnvTc.isBlank()) sysEnvTc = "L";
        if (fwdiSysC == null || fwdiSysC.isBlank()) fwdiSysC = "IPP";
        if (bzCS3 == null || bzCS3.isBlank()) bzCS3 = "IPP";
        if (appC == null || appC.isBlank()) appC = "PRM";
        if (appBzLv1C == null || appBzLv1C.isBlank()) appBzLv1C = "PP";
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiProperties.java
git commit -m "feat(eai): EaiProperties 설정 바인딩 추가 (시스템식별자 IPP/PRM/PP)"
```

---

## Task 3: EaiRequest (UMS 발송 요청 DTO)

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/dto/EaiRequest.java`

ePAMS `EaiDTO`에서 **UMS 발송 + 거래공통부에 필요한 필드만** 발췌한다. 빌드 검증은 빌더 테스트(Task 6)에서 사용되므로 여기선 클래스만 생성한다.

- [ ] **Step 1: Create EaiRequest**

```java
// src/main/java/com/kdb/it/infra/eai/dto/EaiRequest.java
package com.kdb.it.infra.eai.dto;

import lombok.Builder;
import lombok.Getter;

/**
 * EAI UMS 발송 요청.
 *
 * <p>ePAMS {@code EaiDTO}에서 UMS(SMS/알림톡/이메일) 발송과 거래공통부 조립에
 * 필요한 필드만 발췌했다. 템플릿ID({@code umsBzDttId})와 인터페이스ID({@code ifId})는
 * KDB 발급값으로, 호출자가 채널별로 지정한다.</p>
 */
@Getter
@Builder
public class EaiRequest {

    /** 수신시스템코드 RMS_SYS_C (기본 "EAI"). UMS 발송 시 호출자가 "UMS" 지정. */
    @Builder.Default
    private final String system = "EAI";

    /** 인터페이스ID IF_ID (KDB 발급, 최대 12자리). */
    @Builder.Default
    private final String ifId = "";

    /** UMS업무구분ID/템플릿 UMS_BZ_DTT_ID (7자리, 1번째 글자 S/A/E = SMS/알림톡/이메일). */
    @Builder.Default
    private final String umsBzDttId = "";

    /** UMS거래일련번호 UMS_TR_SNO (채번값, 숫자 문자열). */
    @Builder.Default
    private final String umsTrSno = "";

    /** 수신자 행번 REQ_USID/CNO (퇴직자 금지). */
    private final String emplNum;

    /** 수신자명/고객명 CST_NM, REQ_USR_NM. */
    private final String cstNm;

    /** 수신 채널값 UMS_SD_CHN_NO (휴대폰번호/이메일). */
    private final String reqCh;

    /** 요청부점코드 REQ_BBR_C (3자리). */
    private final String deptKey;

    /** 요청부점명 REQ_BBR_NM. */
    private final String deptNm;

    /** 발송예정일자 UMS_SD_MPL_DT (yyyyMMdd, null이면 당일). */
    private final String sendDt;

    /** 발송예정시각 UMS_SD_MPL_TM (HHmmss, null이면 즉시). */
    private final String sendTime;

    /** 가변데이터 (템플릿 치환용). */
    private final String umData1;
    private final String umData2;
    private final String umData3;
    private final String umData4;
    private final String umData5;
    private final String umData6;
    private final String umData7;
}
```

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/dto/EaiRequest.java
git commit -m "feat(eai): EaiRequest UMS 발송 요청 DTO 추가"
```

---

## Task 4: HostAddressProvider (IP/MAC 공급 시임)

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/service/HostAddressProvider.java`

- [ ] **Step 1: Create interface + default impl**

```java
// src/main/java/com/kdb/it/infra/eai/service/HostAddressProvider.java
package com.kdb.it.infra.eai.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.NetworkInterface;
import java.net.SocketException;
import java.net.UnknownHostException;

/**
 * 표준전문 시스템공통부의 IP/MAC 주소 공급 시임.
 *
 * <p>운영에선 로컬 호스트에서 조회하고, 테스트에선 고정값 구현으로 대체하여
 * 전문 바이트를 결정적으로 만든다. 반환값은 패딩 전 원시 문자열이다.</p>
 */
public interface HostAddressProvider {

    /** 패딩 전 IP 주소(예: "10.1.2.3"). 조회 실패 시 빈 문자열. */
    String ipAddress();

    /** 패딩 전 MAC 주소 hex(구분자 없음, 예: "001122334455"). 조회 실패 시 빈 문자열. */
    String macAddress();

    /** 운영용 기본 구현 — {@link InetAddress}/{@link NetworkInterface} 기반. */
    @Slf4j
    @Component
    class LocalHostAddressProvider implements HostAddressProvider {

        @Override
        public String ipAddress() {
            try {
                return InetAddress.getLocalHost().getHostAddress();
            } catch (UnknownHostException e) {
                log.info("EAI ipAddress 조회 실패");
                return "";
            }
        }

        @Override
        public String macAddress() {
            try {
                InetAddress local = InetAddress.getLocalHost();
                NetworkInterface ni = NetworkInterface.getByInetAddress(local);
                if (ni == null) {
                    return "";
                }
                byte[] mac = ni.getHardwareAddress();
                if (mac == null) {
                    return "";
                }
                StringBuilder sb = new StringBuilder();
                for (byte b : mac) {
                    sb.append(String.format("%02X", b));
                }
                return sb.toString();
            } catch (UnknownHostException | SocketException e) {
                log.info("EAI macAddress 조회 실패");
                return "";
            }
        }
    }
}
```

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/HostAddressProvider.java
git commit -m "feat(eai): HostAddressProvider IP/MAC 공급 시임 추가"
```

---

## Task 5: EaiMessageBuilder — lpad + charset 길이계산 (먼저 핵심 헬퍼 TDD)

전문 조립의 토대인 `lpad`와 charset 바이트 길이를 먼저 TDD로 고정한다. 전체 조립(param01~08)은 Task 6에서 추가한다.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java`
- Test: `src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java`

- [ ] **Step 1: Write the failing test (lpad + MS949 길이)**

```java
// src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java
package com.kdb.it.infra.eai.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.Charset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class EaiMessageBuilderTest {

    private static final Charset MS949 = Charset.forName("MS949");

    @Test
    @DisplayName("lpad: 숫자 타입은 '0', 그 외 타입은 공백으로 좌측 패딩")
    void lpad_padsLeft() {
        assertThat(EaiMessageBuilder.lpad(MS949, "N", 5, "42")).isEqualTo("00042");
        assertThat(EaiMessageBuilder.lpad(MS949, "C", 5, "ab")).isEqualTo("   ab");
    }

    @Test
    @DisplayName("lpad: null/빈 문자열은 전체 패딩")
    void lpad_nullBecomesFullPad() {
        assertThat(EaiMessageBuilder.lpad(MS949, "C", 3, null)).isEqualTo("   ");
        assertThat(EaiMessageBuilder.lpad(MS949, "N", 3, "")).isEqualTo("000");
    }

    @Test
    @DisplayName("lpad: MS949에서 한글 1자는 2바이트로 계산되어 패딩 폭이 줄어든다")
    void lpad_koreanIsTwoBytes() {
        // "가" = MS949 2바이트 → offset 4면 앞에 공백 2칸
        assertThat(EaiMessageBuilder.lpad(MS949, "C", 4, "가")).isEqualTo("  가");
        assertThat("가".getBytes(MS949)).hasSize(2);
    }

    @Test
    @DisplayName("lpad: 내용 바이트가 offset을 초과하면 IndexOutOfBoundsException")
    void lpad_overflowThrows() {
        assertThatThrownBy(() -> EaiMessageBuilder.lpad(MS949, "C", 1, "abc"))
                .isInstanceOf(IndexOutOfBoundsException.class);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiMessageBuilderTest"`
Expected: 컴파일 실패 (`EaiMessageBuilder` 미존재).

- [ ] **Step 3: Write minimal implementation (lpad만)**

```java
// src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java
package com.kdb.it.infra.eai.service;

import java.nio.charset.Charset;

/**
 * KDB 표준전문(고정길이 전문) 조립기.
 *
 * <p>ePAMS {@code EaiService.getReqData()}의 필드·오프셋·기본값을 그대로 옮기되,
 * (1) 인코딩을 명시적 charset(MS949)으로 중앙화하고,
 * (2) 시각/난수/IP·MAC를 주입 시임으로 외부화하여 테스트 가능하게 한다.</p>
 *
 * <p>전체 조립 메서드 {@code build()}는 Task 6에서 추가된다. 본 단계는 토대 헬퍼 {@code lpad}만 제공한다.</p>
 */
public class EaiMessageBuilder {

    /**
     * 좌측 패딩. ePAMS {@code lpad}와 동일 규칙.
     *
     * @param cs     길이 계산에 사용할 charset (MS949)
     * @param type   "N"이면 '0', 그 외("C")면 공백으로 패딩
     * @param offset 목표 바이트 폭
     * @param str    원본(null이면 빈 문자열로 취급)
     * @return 좌측 패딩된 문자열
     * @throws IndexOutOfBoundsException 원본 바이트 길이가 offset을 초과할 때
     */
    public static String lpad(Charset cs, String type, int offset, String str) {
        String tmp = (str == null) ? "" : str;
        String pad = "C".equals(type) ? " " : "0";
        int len = offset - tmp.getBytes(cs).length;
        if (len < 0) {
            throw new IndexOutOfBoundsException(
                    "전문 필드 초과: offset=" + offset + ", actual=" + tmp.getBytes(cs).length);
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) {
            sb.append(pad);
        }
        sb.append(tmp);
        return sb.toString();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiMessageBuilderTest"`
Expected: PASS (4개).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java
git commit -m "feat(eai): EaiMessageBuilder lpad + MS949 길이계산 헬퍼"
```

---

## Task 6: EaiMessageBuilder.build() — 표준전문 전체 조립 (param01~08)

ePAMS의 `getParam01~07` + 종료부를 인스턴스 메서드로 옮긴다. 시각/난수/IP·MAC는 주입 시임 사용.

**Files:**
- Modify: `src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java`
- Test: `src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java` (여기선 스모크 테스트만 추가. 본격 검증은 Task 7.)

- [ ] **Step 1: Write a smoke test (조립이 깨지지 않고 길이필드가 채워지는지)**

`EaiMessageBuilderTest`에 아래 중첩 클래스를 추가한다(기존 lpad 테스트는 유지).

```java
    @org.junit.jupiter.api.Nested
    @DisplayName("build() 스모크")
    class BuildSmoke {

        private EaiMessageBuilder fixedBuilder() {
            // 시각 고정: 2026-06-07T09:30:15.123 (KST)
            java.time.Clock clock = java.time.Clock.fixed(
                    java.time.LocalDateTime.of(2026, 6, 7, 9, 30, 15, 123_000_000)
                            .atZone(java.time.ZoneId.of("Asia/Seoul")).toInstant(),
                    java.time.ZoneId.of("Asia/Seoul"));
            com.kdb.it.infra.eai.config.EaiProperties props = new com.kdb.it.infra.eai.config.EaiProperties(
                    false, "", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
            HostAddressProvider host = new HostAddressProvider() {
                @Override public String ipAddress() { return "10.0.0.1"; }
                @Override public String macAddress() { return "001122334455"; }
            };
            return new EaiMessageBuilder(props, clock, () -> "000000001", host);
        }

        private com.kdb.it.infra.eai.dto.EaiRequest umsRequest() {
            return com.kdb.it.infra.eai.dto.EaiRequest.builder()
                    .system("UMS").ifId("IPPO00012345").umsBzDttId("SMS2096")
                    .umsTrSno("7").emplNum("K1234567").cstNm("홍길동")
                    .reqCh("01012345678").deptKey("182").deptNm("디지털금융부")
                    .umData1("123456").build();
        }

        @Test
        @DisplayName("build()는 비어있지 않은 byte[]를 만들고 앞 24바이트가 길이필드(숫자)다")
        void build_producesLengthHeader() {
            byte[] msg = fixedBuilder().build(umsRequest());
            assertThat(msg).isNotEmpty();
            String head = new String(msg, 0, 24, MS949);
            assertThat(head).matches("\\d{24}"); // 전체/헤더/출력매체 길이 3종 = 8자리씩
            assertThat(msg).endsWith("@@".getBytes(MS949)); // 종료부
        }
    }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiMessageBuilderTest"`
Expected: 컴파일 실패 (생성자/`build` 미존재).

- [ ] **Step 3: Implement full assembly**

`EaiMessageBuilder.java`를 아래 전체 내용으로 교체한다(기존 `lpad`는 유지·통합).

```java
// src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;

import java.nio.charset.Charset;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.function.Supplier;

/**
 * KDB 표준전문(고정길이 전문) 조립기.
 *
 * <p>ePAMS {@code EaiService.getReqData()}의 필드·오프셋·기본값을 그대로 옮기되,
 * 인코딩을 명시적 charset(MS949)으로 중앙화하고, 시각/난수/IP·MAC를 주입 시임으로
 * 외부화하여 테스트 가능하게 한다. 본 빌더는 전송을 수행하지 않는다.</p>
 */
public class EaiMessageBuilder {

    /** 가변데이터 JSON 안정 직렬화를 위한 항목 키. */
    private static final String[] UM_KEYS =
            {"UM_DATA_1", "UM_DATA_2", "UM_DATA_3", "UM_DATA_4", "UM_DATA_5", "UM_DATA_6", "UM_DATA_7"};

    private final EaiProperties props;
    private final Clock clock;
    private final Supplier<String> guidRandom; // 9자리 숫자 문자열 공급
    private final HostAddressProvider host;
    private final Charset cs;

    public EaiMessageBuilder(EaiProperties props, Clock clock, Supplier<String> guidRandom, HostAddressProvider host) {
        this.props = props;
        this.clock = clock;
        this.guidRandom = guidRandom;
        this.host = host;
        this.cs = Charset.forName(props.charset());
    }

    /** 표준전문(param01~08) 전체를 조립해 charset 바이트로 반환. */
    public byte[] build(EaiRequest req) {
        String p01 = param01();
        String p02 = param02(req);
        String p03 = param03();
        String p04 = param04();
        String p05 = param05();
        String p06 = param06();
        String p07 = param07Ums(req);
        String p08 = "@@";

        String whlTgrLe = lpad(cs, "N", 8, String.valueOf(bytes(p01 + p02 + p03 + p04 + p05 + p06 + p07 + p08)));
        String herLen   = lpad(cs, "N", 8, String.valueOf(bytes(p01 + p02 + p03 + p04 + p05 + p06)));
        String proMdaLen = lpad(cs, "N", 8, String.valueOf(bytes(p06)));

        // 길이 3종(24바이트)으로 param01 앞 24자리 교체
        String param = whlTgrLe + herLen + proMdaLen + p01.substring(24)
                + p02 + p03 + p04 + p05 + p06 + p07 + p08;
        return param.getBytes(cs);
    }

    // ── 01. 시스템공통부 ─────────────────────────────────────────────────────
    private String param01() {
        String dt = date("yyyyMMdd");
        String dt2 = date("HHmmssSSS");
        String guid = props.fwdiSysC() + dt + dt2 + guidRandom.get() + guidRandom.get();
        String ipAddr = String.format("%40s", host.ipAddress());
        String macAddr = String.format("%12s", host.macAddress());

        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "N", 8, ""));   // WHL_TGR_LEN  (조립 후 교체)
        p.append(lpad(cs, "N", 8, ""));   // HER_LEN      (조립 후 교체)
        p.append(lpad(cs, "N", 8, ""));   // PRO_MDA_LEN  (조립 후 교체)
        p.append("1.0");                  // TGR_VRS_INF
        p.append("ko");                   // MLAN_TC
        p.append(props.sysEnvTc());       // SYS_ENV_TC
        p.append(ipAddr);                 // IP_ADDR (40)
        p.append(macAddr);                // MAC_ADDR (12)
        p.append(guid);                   // GUID
        p.append("0001");                 // GUID_PRG_SNO
        p.append(guid);                   // FST_GUID
        p.append(props.fwdiSysC());       // FWDI_SYS_C
        p.append(props.fwdiSysC());       // FST_FWDI_SYS_C
        p.append(lpad(cs, "C", 12, ""));  // SYS_CO_RSRV
        return p.toString();
    }

    // ── 02. 거래공통부 ───────────────────────────────────────────────────────
    private String param02(EaiRequest req) {
        String reqDtm = date("yyyyMMddHHmmssSSS");
        String trSlsDt = date("yyyyMMdd");
        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "C", 10, ""));               // TR_ID
        p.append(lpad(cs, "C", 3, req.getSystem()));   // RMS_SYS_C
        p.append(lpad(cs, "C", 10, ""));               // SRE_ID
        p.append(lpad(cs, "C", 10, ""));               // LKG_SRE_ID
        p.append(lpad(cs, "C", 1, ""));                // SRE_CNTR_TC
        p.append("Q");                                 // REQ_RPD_TC
        p.append("2");                                 // DTLS_TP_TC
        p.append("TR");                                // CHN_TP_C
        p.append(lpad(cs, "C", 2, ""));                // MSG_CHN_C
        p.append("S");                                 // SYNC_PRC_TC
        p.append(lpad(cs, "C", 1, ""));                // RLT_TC
        p.append("00000");                             // PAGE_ROW_COUNT
        p.append(lpad(cs, "C", 1, ""));                // NEXT_PAGE_YN
        p.append("00000");                             // REQ_PAGE_NO
        p.append(reqDtm);                              // REQ_DTM
        p.append(lpad(cs, "C", 17, ""));               // RPD_DTM
        p.append(trSlsDt);                             // TR_SLS_DT
        p.append("0");                                 // TR_SLS_DT_TC
        p.append("0");                                 // SML_TC
        p.append(lpad(cs, "C", 8, ""));                // SML_SLS_YMD
        p.append("N");                                 // MSK_CCC_YN
        p.append("N");                                 // ATH_TES_ALY_YN
        p.append("N");                                 // LQN_TR_YN
        p.append(lpad(cs, "C", 1, ""));                // RE_TR_FLAG
        p.append("01");                                // CSG_TC
        p.append("10");                                // FSC_DT_BSE_TC
        p.append(lpad(cs, "C", 3, ""));                // BLGT_BBR_C
        p.append(lpad(cs, "C", 14, ""));               // USID
        p.append(lpad(cs, "C", 4, ""));                // PSC_C
        p.append(lpad(cs, "C", 4, ""));                // DTS_C
        p.append(lpad(cs, "C", 3, ""));                // TMN_ITL_BBR_C
        p.append(lpad(cs, "C", 10, ""));               // TMN_NO
        p.append(lpad(cs, "C", 3, ""));                // AAP_BBR_C
        p.append(lpad(cs, "C", 10, ""));               // NML_PRC_RMS_TR_ID
        p.append(lpad(cs, "C", 10, ""));               // FRM_ERR_RMS_TR_ID
        p.append(lpad(cs, "C", 10, ""));               // NRPD_RMS_TR_ID
        p.append(lpad(cs, "C", 4, ""));                // FOOE_IST_C
        p.append(lpad(cs, "C", 4, ""));                // FOOE_NEK_TC
        p.append(lpad(cs, "C", 3, ""));                // FOOE_HED_TP_TC
        p.append(lpad(cs, "C", 8, ""));                // FOOE_REQ_BYCL_C
        p.append(lpad(cs, "C", 20, ""));               // FOOE_REQ_TR_TC
        p.append(lpad(cs, "C", 1, ""));                // ONLD_CNTR_TP_TC
        p.append(lpad(cs, "C", 4, ""));                // ADN_FOOE_IST_CD
        p.append(lpad(cs, "C", 12, req.getIfId()));    // IF_ID
        p.append("00");                                // EAI_FWDI_SVR_NO
        p.append("11");                                // MCI_FWDI_SVR_NO
        p.append(lpad(cs, "C", 10, ""));               // MCI_SES_ID
        p.append(lpad(cs, "C", 10, ""));               // CC_ID
        p.append(lpad(cs, "C", 8, ""));                // CC_PRC_DT
        p.append("00000");                             // CC_PRC_TO
        p.append("000000000");                         // CC_TD_SNO
        p.append("00");                                // CC_PRC_TC
        p.append(lpad(cs, "C", 10, ""));               // CC_CALL_TR_ID
        p.append(lpad(cs, "C", 1, ""));                // RSD_CC_YN
        p.append(lpad(cs, "C", 10, ""));               // DTL_CC_ID
        p.append(lpad(cs, "C", 2, ""));                // CC_PRC_RLT_C
        p.append("0000000000000000.000");              // CC_ACL_TFR_AMT
        p.append("0000000000000000.000");              // CC_TFR_TGT_AMT
        p.append(lpad(cs, "C", 1, ""));                // CC_XTR_DETS_RE_ROM_YN
        p.append(lpad(cs, "C", 8, ""));                // CST_NO
        p.append(lpad(cs, "C", 40, ""));               // TR_CO_RSRV
        return p.toString();
    }

    // ── 03. 채널공통부 ───────────────────────────────────────────────────────
    private String param03() {
        StringBuilder p = new StringBuilder();
        p.append("2");                       // BKB_TC
        p.append(lpad(cs, "C", 20, ""));     // BKB_CWT_NO
        p.append(lpad(cs, "C", 129, ""));    // CSF_CHN_RSRV
        p.append(lpad(cs, "C", 2, ""));      // NFF_CNC_MDA_KD_C
        p.append("00");                      // CHN_TP_ADN_C
        p.append(lpad(cs, "C", 64, ""));     // NFF_CNC_MCN_ID
        p.append(lpad(cs, "C", 2, ""));      // NFF_ISO_NTN_SYM_C
        p.append(lpad(cs, "C", 5, ""));      // NFF_CIR_NO
        p.append(lpad(cs, "C", 4, ""));      // NFF_CHN_BZ_TC
        p.append(lpad(cs, "C", 10, ""));     // IB_SRE_MNU_ID
        p.append(lpad(cs, "C", 3, ""));      // TELB_SVC_C
        p.append(lpad(cs, "C", 1, ""));      // XP_LGN_TR_YN
        p.append(lpad(cs, "C", 1, ""));      // NFF_CST_TC
        p.append(lpad(cs, "C", 8, ""));      // USR_NO
        p.append(lpad(cs, "C", 1, ""));      // ADMR_ATH_YN
        p.append(lpad(cs, "C", 2, ""));      // SECT_MDA_TC
        p.append(lpad(cs, "C", 1, ""));      // CFA_KPN_MDA_TC
        p.append(lpad(cs, "C", 2, ""));      // MCT_TC
        p.append(lpad(cs, "C", 1, ""));      // USR_CER_MANR_C
        p.append("N");                       // CSR_TPR_CNFM_FLAG
        p.append(lpad(cs, "C", 38, ""));     // CSR_TPR_CNFM_NO
        p.append(lpad(cs, "C", 102, ""));    // NFF_CHN_RSRV
        return p.toString();
    }

    // ── 04. 책임자승인공통부 ─────────────────────────────────────────────────
    private String param04() {
        StringBuilder p = new StringBuilder();
        p.append("00");                      // RSPR_APV_STS_TC
        p.append("00");                      // RSPR_APV_LEV_NBR
        p.append(lpad(cs, "C", 2, ""));      // RSPR_TR_TC
        p.append("00");                      // RSPR_APV_MSG_CNT
        p.append("00");                      // RSPR_CNT
        p.append("00");                      // RSPR_APV_DKEY_CNT
        p.append("00");                      // APV_RSPR_CNT
        p.append(lpad(cs, "C", 18, ""));     // APV_TR_SRE_DKEY
        p.append(lpad(cs, "C", 29, ""));     // RSPR_APV_RSRV
        p.append("00");                      // IDFC_MNG_CNT
        return p.toString();
    }

    // ── 05. 메시지공통부 ─────────────────────────────────────────────────────
    private String param05() {
        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "C", 1, ""));      // MSG_IDCT_TC
        p.append(lpad(cs, "C", 50, ""));     // ERR_OCC_TGR_ITM
        p.append("000");                     // MSG_CNT
        p.append("00");                      // ETC_PRO_DAT_CNT
        return p.toString();
    }

    // ── 06. 출력매체부 ───────────────────────────────────────────────────────
    private String param06() {
        return "000"; // PRO_MDA_CNT
    }

    // ── 07. 개별부(UMS 입력데이터) ───────────────────────────────────────────
    private String param07Ums(EaiRequest req) {
        String umsBzDttId = req.getUmsBzDttId();
        String reqUsid = req.getEmplNum();
        String umsSdChnNo = req.getReqCh();
        String sendDt = req.getSendDt();
        String sendTime = req.getSendTime();

        String trDt = date("yyyyMMdd");
        String trTm = date("HHmmss");

        String umsTrSno = req.getUmsTrSno();
        String umsRetNo = umsBzDttId + trDt + String.format("%08d", Integer.parseInt(umsTrSno));

        String umsTmeChnNo = "1588-1500";
        if (!umsBzDttId.isEmpty() && "E".equals(umsBzDttId.substring(0, 1))) {
            umsTmeChnNo = "hrd@kdb.co.kr";
        }

        String reqUsrNm = req.getCstNm();
        String reqBbrC = req.getDeptKey();
        String reqBbrNm = req.getDeptNm();

        String umsSdChnTpC = umsBzDttId.isEmpty() ? "" : umsBzDttId.substring(0, 1);
        if ("E".equals(umsSdChnTpC)) {
            umsSdChnTpC = "M";
        }

        String variDatS0 = variableDataJson(req);
        String variDatLenN9 = String.valueOf(bytes(variDatS0));

        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "C", 7, umsBzDttId));                                 // UMS_BZ_DTT_ID
        p.append(trDt);                                                         // TR_DT
        p.append(lpad(cs, "N", 10, umsTrSno));                                  // UMS_TR_SNO
        p.append(lpad(cs, "C", 23, umsRetNo));                                  // UMS_RET_NO
        p.append(lpad(cs, "C", 8, reqUsid));                                    // CNO
        p.append(lpad(cs, "C", 100, reqUsrNm));                                 // CST_NM
        p.append(lpad(cs, "C", 30, ""));                                        // SECT_EML_CNFM_NO
        p.append(lpad(cs, "C", 200, umsSdChnNo));                               // UMS_SD_CHN_NO
        p.append(lpad(cs, "C", 4000, ""));                                      // UMS_SD_CHN_ADDR_CONE
        p.append(lpad(cs, "C", 8, (sendDt == null) ? trDt : sendDt));           // UMS_SD_MPL_DT
        p.append(lpad(cs, "C", 6, (sendTime == null) ? "" : sendTime));        // UMS_SD_MPL_TM
        p.append(lpad(cs, "C", 100, umsTmeChnNo));                              // UMS_TME_CHN_NO
        p.append(props.appC());                                                 // APP_C
        p.append(props.appBzLv1C());                                            // APP_BZ_LV1_C
        p.append(lpad(cs, "C", 14, reqUsid));                                   // REQ_USID
        p.append(lpad(cs, "C", 100, reqUsrNm));                                 // REQ_USR_NM
        p.append(lpad(cs, "C", 3, reqBbrC));                                    // REQ_BBR_C
        p.append(lpad(cs, "C", 100, reqBbrNm));                                 // REQ_BBR_NM
        p.append("N");                                                          // UMS_CKG_C
        p.append(lpad(cs, "C", 4000, ""));                                      // APG_FL_CONE
        p.append(lpad(cs, "C", 6, trTm));                                       // TR_TM
        p.append(umsSdChnTpC);                                                  // UMS_SD_CHN_TP_C
        p.append("10");                                                         // CHN_REQ_TP_C
        p.append(lpad(cs, "C", 100, ""));                                       // BZ_DCM_INF_CONE
        p.append(lpad(cs, "C", 1000, ""));                                      // UMS_BZ_RFR_CONE
        p.append(lpad(cs, "C", 1, "N"));                                        // DEL_YN
        p.append(lpad(cs, "C", 14, "SYSTEM"));                                  // LST_CHG_USID
        p.append(props.bzCS3());                                                // BZ_C_S3
        p.append(lpad(cs, "N", 9, variDatLenN9));                               // VARI_DAT_LEN_N9
        p.append(variDatS0);                                                    // VARI_DAT_S0
        return p.toString();
    }

    /**
     * 가변데이터 JSON 안정 직렬화.
     * {@code {"type":"dataSet","entries":{"UM_DATA_1":"v1",...}}} (비어있지 않은 항목만, 키 순서 고정).
     * ePAMS는 json.simple(HashMap, 순서 불안정)을 썼으나, 결정적 비교를 위해 삽입 순서를 고정한다.
     */
    private String variableDataJson(EaiRequest req) {
        String[] vals = {req.getUmData1(), req.getUmData2(), req.getUmData3(), req.getUmData4(),
                req.getUmData5(), req.getUmData6(), req.getUmData7()};
        StringBuilder entries = new StringBuilder();
        boolean first = true;
        for (int i = 0; i < UM_KEYS.length; i++) {
            String v = vals[i];
            if (v == null || v.isEmpty()) {
                continue;
            }
            if (!first) {
                entries.append(",");
            }
            entries.append("\"").append(UM_KEYS[i]).append("\":\"").append(escape(v)).append("\"");
            first = false;
        }
        return "{\"type\":\"dataSet\",\"entries\":{" + entries + "}}";
    }

    /** JSON 문자열 값 최소 이스케이프(역슬래시·따옴표). */
    private static String escape(String v) {
        return v.replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private int bytes(String s) {
        return s.getBytes(cs).length;
    }

    private String date(String pattern) {
        return DateTimeFormatter.ofPattern(pattern, Locale.ROOT).format(LocalDateTime.now(clock));
    }

    /**
     * 좌측 패딩. ePAMS {@code lpad}와 동일 규칙.
     *
     * @throws IndexOutOfBoundsException 원본 바이트 길이가 offset을 초과할 때
     */
    public static String lpad(Charset cs, String type, int offset, String str) {
        String tmp = (str == null) ? "" : str;
        String pad = "C".equals(type) ? " " : "0";
        int len = offset - tmp.getBytes(cs).length;
        if (len < 0) {
            throw new IndexOutOfBoundsException(
                    "전문 필드 초과: offset=" + offset + ", actual=" + tmp.getBytes(cs).length);
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < len; i++) {
            sb.append(pad);
        }
        sb.append(tmp);
        return sb.toString();
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiMessageBuilderTest"`
Expected: PASS (기존 lpad 4개 + 스모크 1개).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java
git commit -m "feat(eai): EaiMessageBuilder 표준전문 전체 조립(param01~08, MS949)"
```

---

## Task 7: 동일성 검증 — ePAMS 참조 빌더 전사본 + 바이트 비교 테스트

ePAMS `getReqData`의 UMS 조립을 **독립적으로 전사한 동결 오라클**을 만들고, 신규 빌더와 `byte[]` 동일성을 단언한다. 참조 빌더는 신규 빌더의 헬퍼에 의존하지 않는다(자체 `pad`/JSON 보유) — 그래야 향후 신규 빌더 수정이 참조에 전파되지 않아 회귀를 잡는다.

**Files:**
- Create: `src/test/java/com/kdb/it/infra/eai/service/EpamsReferenceMessageBuilder.java`
- Modify: `src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java`

- [ ] **Step 1: Create the frozen reference oracle (test-only)**

```java
// src/test/java/com/kdb/it/infra/eai/service/EpamsReferenceMessageBuilder.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;

import java.nio.charset.Charset;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.function.Supplier;

/**
 * [테스트 전용 / 동결] ePAMS {@code EaiService.getReqData()} UMS 조립 로직의 독립 전사본.
 *
 * <p>신규 {@link EaiMessageBuilder}와 바이트 단위로 동일함을 증명하기 위한 오라클이다.
 * 신규 빌더의 헬퍼를 재사용하지 않고 자체 구현을 가진다(독립성). 이 파일은 가급적 수정하지 않는다.</p>
 */
class EpamsReferenceMessageBuilder {

    private final EaiProperties props;
    private final Clock clock;
    private final Supplier<String> guidRandom;
    private final HostAddressProvider host;
    private final Charset cs;

    EpamsReferenceMessageBuilder(EaiProperties props, Clock clock, Supplier<String> guidRandom, HostAddressProvider host) {
        this.props = props;
        this.clock = clock;
        this.guidRandom = guidRandom;
        this.host = host;
        this.cs = Charset.forName(props.charset());
    }

    byte[] buildUms(EaiRequest req) {
        String p01 = p01();
        String p02 = p02(req);
        String p03 = p03();
        String p04 = p04();
        String p05 = p05();
        String p06 = "000";
        String p07 = p07(req);
        String p08 = "@@";

        String whl = pad("N", 8, String.valueOf(len(p01 + p02 + p03 + p04 + p05 + p06 + p07 + p08)));
        String her = pad("N", 8, String.valueOf(len(p01 + p02 + p03 + p04 + p05 + p06)));
        String pro = pad("N", 8, String.valueOf(len(p06)));

        String s = whl + her + pro + p01.substring(24) + p02 + p03 + p04 + p05 + p06 + p07 + p08;
        return s.getBytes(cs);
    }

    private String p01() {
        String dt = fmt("yyyyMMdd");
        String dt2 = fmt("HHmmssSSS");
        String guid = props.fwdiSysC() + dt + dt2 + guidRandom.get() + guidRandom.get();
        String ip = String.format("%40s", host.ipAddress());
        String mac = String.format("%12s", host.macAddress());
        return pad("N", 8, "") + pad("N", 8, "") + pad("N", 8, "")
                + "1.0" + "ko" + props.sysEnvTc() + ip + mac + guid + "0001" + guid
                + props.fwdiSysC() + props.fwdiSysC() + pad("C", 12, "");
    }

    private String p02(EaiRequest req) {
        String reqDtm = fmt("yyyyMMddHHmmssSSS");
        String trSlsDt = fmt("yyyyMMdd");
        return pad("C", 10, "") + pad("C", 3, req.getSystem()) + pad("C", 10, "") + pad("C", 10, "")
                + pad("C", 1, "") + "Q" + "2" + "TR" + pad("C", 2, "") + "S" + pad("C", 1, "")
                + "00000" + pad("C", 1, "") + "00000" + reqDtm + pad("C", 17, "") + trSlsDt + "0" + "0"
                + pad("C", 8, "") + "N" + "N" + "N" + pad("C", 1, "") + "01" + "10" + pad("C", 3, "")
                + pad("C", 14, "") + pad("C", 4, "") + pad("C", 4, "") + pad("C", 3, "") + pad("C", 10, "")
                + pad("C", 3, "") + pad("C", 10, "") + pad("C", 10, "") + pad("C", 10, "") + pad("C", 4, "")
                + pad("C", 4, "") + pad("C", 3, "") + pad("C", 8, "") + pad("C", 20, "") + pad("C", 1, "")
                + pad("C", 4, "") + pad("C", 12, req.getIfId()) + "00" + "11" + pad("C", 10, "") + pad("C", 10, "")
                + pad("C", 8, "") + "00000" + "000000000" + "00" + pad("C", 10, "") + pad("C", 1, "")
                + pad("C", 10, "") + pad("C", 2, "") + "0000000000000000.000" + "0000000000000000.000"
                + pad("C", 1, "") + pad("C", 8, "") + pad("C", 40, "");
    }

    private String p03() {
        return "2" + pad("C", 20, "") + pad("C", 129, "") + pad("C", 2, "") + "00" + pad("C", 64, "")
                + pad("C", 2, "") + pad("C", 5, "") + pad("C", 4, "") + pad("C", 10, "") + pad("C", 3, "")
                + pad("C", 1, "") + pad("C", 1, "") + pad("C", 8, "") + pad("C", 1, "") + pad("C", 2, "")
                + pad("C", 1, "") + pad("C", 2, "") + pad("C", 1, "") + "N" + pad("C", 38, "") + pad("C", 102, "");
    }

    private String p04() {
        return "00" + "00" + pad("C", 2, "") + "00" + "00" + "00" + "00" + pad("C", 18, "") + pad("C", 29, "") + "00";
    }

    private String p05() {
        return pad("C", 1, "") + pad("C", 50, "") + "000" + "00";
    }

    private String p07(EaiRequest req) {
        String umsBzDttId = req.getUmsBzDttId();
        String reqUsid = req.getEmplNum();
        String umsSdChnNo = req.getReqCh();
        String sendDt = req.getSendDt();
        String sendTime = req.getSendTime();
        String trDt = fmt("yyyyMMdd");
        String trTm = fmt("HHmmss");
        String umsTrSno = req.getUmsTrSno();
        String umsRetNo = umsBzDttId + trDt + String.format("%08d", Integer.parseInt(umsTrSno));
        String umsTmeChnNo = "1588-1500";
        if (!umsBzDttId.isEmpty() && "E".equals(umsBzDttId.substring(0, 1))) {
            umsTmeChnNo = "hrd@kdb.co.kr";
        }
        String reqUsrNm = req.getCstNm();
        String reqBbrC = req.getDeptKey();
        String reqBbrNm = req.getDeptNm();
        String umsSdChnTpC = umsBzDttId.isEmpty() ? "" : umsBzDttId.substring(0, 1);
        if ("E".equals(umsSdChnTpC)) {
            umsSdChnTpC = "M";
        }
        String vari = json(req);
        String variLen = String.valueOf(len(vari));

        return pad("C", 7, umsBzDttId) + trDt + pad("N", 10, umsTrSno) + pad("C", 23, umsRetNo)
                + pad("C", 8, reqUsid) + pad("C", 100, reqUsrNm) + pad("C", 30, "") + pad("C", 200, umsSdChnNo)
                + pad("C", 4000, "") + pad("C", 8, (sendDt == null) ? trDt : sendDt)
                + pad("C", 6, (sendTime == null) ? "" : sendTime) + pad("C", 100, umsTmeChnNo)
                + props.appC() + props.appBzLv1C() + pad("C", 14, reqUsid) + pad("C", 100, reqUsrNm)
                + pad("C", 3, reqBbrC) + pad("C", 100, reqBbrNm) + "N" + pad("C", 4000, "") + pad("C", 6, trTm)
                + umsSdChnTpC + "10" + pad("C", 100, "") + pad("C", 1000, "") + pad("C", 1, "N")
                + pad("C", 14, "SYSTEM") + props.bzCS3() + pad("N", 9, variLen) + vari;
    }

    private String json(EaiRequest req) {
        String[] keys = {"UM_DATA_1", "UM_DATA_2", "UM_DATA_3", "UM_DATA_4", "UM_DATA_5", "UM_DATA_6", "UM_DATA_7"};
        String[] vals = {req.getUmData1(), req.getUmData2(), req.getUmData3(), req.getUmData4(),
                req.getUmData5(), req.getUmData6(), req.getUmData7()};
        StringBuilder e = new StringBuilder();
        boolean first = true;
        for (int i = 0; i < keys.length; i++) {
            if (vals[i] == null || vals[i].isEmpty()) {
                continue;
            }
            if (!first) {
                e.append(",");
            }
            e.append("\"").append(keys[i]).append("\":\"")
                    .append(vals[i].replace("\\", "\\\\").replace("\"", "\\\"")).append("\"");
            first = false;
        }
        return "{\"type\":\"dataSet\",\"entries\":{" + e + "}}";
    }

    private int len(String s) {
        return s.getBytes(cs).length;
    }

    private String fmt(String pattern) {
        return DateTimeFormatter.ofPattern(pattern, Locale.ROOT).format(LocalDateTime.now(clock));
    }

    private String pad(String type, int offset, String str) {
        String tmp = (str == null) ? "" : str;
        String p = "C".equals(type) ? " " : "0";
        int n = offset - tmp.getBytes(cs).length;
        if (n < 0) {
            throw new IndexOutOfBoundsException();
        }
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < n; i++) {
            sb.append(p);
        }
        return sb.append(tmp).toString();
    }
}
```

- [ ] **Step 2: Add the byte-equivalence test (with section diagnostics)**

`EaiMessageBuilderTest`에 아래 공유 픽스처 헬퍼(클래스 필드 영역)와 중첩 클래스를 추가한다.

```java
    // 클래스 최상단(필드 영역)에 공유 픽스처 헬퍼 추가
    private static java.time.Clock fixedClock() {
        return java.time.Clock.fixed(
                java.time.LocalDateTime.of(2026, 6, 7, 9, 30, 15, 123_000_000)
                        .atZone(java.time.ZoneId.of("Asia/Seoul")).toInstant(),
                java.time.ZoneId.of("Asia/Seoul"));
    }

    private static com.kdb.it.infra.eai.config.EaiProperties fixedProps() {
        return new com.kdb.it.infra.eai.config.EaiProperties(
                false, "", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
    }

    private static HostAddressProvider fixedHost() {
        return new HostAddressProvider() {
            @Override public String ipAddress() { return "10.0.0.1"; }
            @Override public String macAddress() { return "001122334455"; }
        };
    }

    private static com.kdb.it.infra.eai.dto.EaiRequest fixedSmsRequest() {
        return com.kdb.it.infra.eai.dto.EaiRequest.builder()
                .system("UMS").ifId("IPPO00012345").umsBzDttId("SMS2096")
                .umsTrSno("7").emplNum("K1234567").cstNm("홍길동")
                .reqCh("01012345678").deptKey("182").deptNm("디지털금융부")
                .umData1("123456").build();
    }

    @org.junit.jupiter.api.Nested
    @DisplayName("ePAMS 참조 동일성")
    class EpamsEquivalence {

        private EaiMessageBuilder actual() {
            return new EaiMessageBuilder(fixedProps(), fixedClock(), () -> "000000001", fixedHost());
        }

        private EpamsReferenceMessageBuilder reference() {
            return new EpamsReferenceMessageBuilder(fixedProps(), fixedClock(), () -> "000000001", fixedHost());
        }

        @Test
        @DisplayName("신규 빌더는 ePAMS 참조 조립과 바이트 단위로 동일하다 (SMS)")
        void byteForByte_sms() {
            byte[] ref = reference().buildUms(fixedSmsRequest());
            byte[] act = actual().build(fixedSmsRequest());

            // 진단: 길이필드(0~23) 구간 먼저 비교 → 어긋난 구간 즉시 식별
            assertThat(new String(act, 0, 24, MS949))
                    .as("길이필드(전체/헤더/출력매체)")
                    .isEqualTo(new String(ref, 0, 24, MS949));
            // 전체 동일성
            assertThat(act).as("전문 전체 byte[]").isEqualTo(ref);
        }

        @Test
        @DisplayName("알림톡(A) 템플릿도 참조와 동일하다")
        void byteForByte_alimtalk() {
            com.kdb.it.infra.eai.dto.EaiRequest alt = com.kdb.it.infra.eai.dto.EaiRequest.builder()
                    .system("UMS").ifId("IPPO00012345").umsBzDttId("ALT0165")
                    .umsTrSno("42").emplNum("K7654321").cstNm("김철수")
                    .reqCh("01099998888").deptKey("182").deptNm("디지털금융부")
                    .umData1("987654").build();
            assertThat(actual().build(alt)).isEqualTo(reference().buildUms(alt));
        }
    }
```

- [ ] **Step 3: Run test to verify it passes**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiMessageBuilderTest"`
Expected: **PASS** (lpad 4 + 스모크 1 + 동일성 2). 불일치 시 길이필드 진단 단언이 먼저 깨져 위치를 알려준다.

> 디버깅 팁: 불일치 시 `param07Ums`(개별부)의 필드 폭/순서를 ePAMS 원본(`getParamUMS`)과 1:1 대조한다. 가장 흔한 원인은 한 필드의 `offset` 오타.

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/test/java/com/kdb/it/infra/eai/service/EpamsReferenceMessageBuilder.java it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java
git commit -m "test(eai): ePAMS 참조 빌더 전사본 vs 신규 빌더 바이트 동일성 검증"
```

---

## Task 8: EaiInfraConfig — 시임 빈 + RestClient + Properties 등록

`EaiProperties` 바인딩 활성화, 결정성 시임의 운영 빈, EAI 전용 `RestClient`(타임아웃)를 구성한다.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java`

- [ ] **Step 1: Create config**

```java
// src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java
package com.kdb.it.infra.eai.config;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.util.function.Supplier;

/**
 * EAI 인프라 빈 구성.
 *
 * <p>{@link EaiProperties} 바인딩 활성화, 표준전문의 비결정 필드용 운영 시임 빈
 * ({@link Clock}, GUID 난수 공급), EAI 전용 {@link RestClient}(타임아웃 적용)를 등록한다.</p>
 */
@Configuration
@EnableConfigurationProperties(EaiProperties.class)
public class EaiInfraConfig {

    /** GUID 9자리 난수 생성기(스레드 안전). */
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /** EAI 전용 시각 시임. 빈명을 명시해 전역 Clock과 충돌을 피한다. */
    @Bean
    public Clock eaiClock() {
        return Clock.systemDefaultZone();
    }

    /** GUID 난수부(9자리) 공급. ePAMS getRandomNum(9)와 동일 규격. */
    @Bean
    public Supplier<String> eaiGuidRandom() {
        return () -> String.format("%09d", SECURE_RANDOM.nextInt(999_999_999) + 1);
    }

    /** EAI 전용 RestClient — octet-stream 바이트 송수신, 연결/읽기 타임아웃 적용. */
    @Bean
    public RestClient eaiRestClient(EaiProperties props) {
        SimpleClientHttpRequestFactory rf = new SimpleClientHttpRequestFactory();
        rf.setConnectTimeout(Duration.ofMillis(props.connectTimeout()));
        rf.setReadTimeout(Duration.ofMillis(props.readTimeout()));
        return RestClient.builder().requestFactory(rf).build();
    }
}
```

> 주의: `eaiClock`/`eaiGuidRandom`/`eaiRestClient` 빈명은 `EaiService` 생성자의 `@Qualifier`/파라미터명과 일치해야 한다(Task 9). 프로젝트에 이미 전역 `Clock` 빈이 있다면 본 `eaiClock`은 제거하고 `EaiService`에서 `Clock.systemDefaultZone()`을 직접 사용하도록 조정한다.

- [ ] **Step 2: Verify compilation**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java
git commit -m "feat(eai): EaiInfraConfig (Properties 등록 + 시임 빈 + RestClient 타임아웃)"
```

---

## Task 9: EaiService — 전송 오케스트레이션 + 통합 테스트

`enabled` 분기, RestClient 전송, `EaiResult` 반환, 민감정보 마스킹 로깅을 구현한다.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/service/EaiService.java`
- Test: `src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java`

- [ ] **Step 1: Write the failing test**

```java
// src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;
import com.kdb.it.infra.eai.dto.EaiResult;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.Charset;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.http.HttpMethod.POST;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

class EaiServiceTest {

    private static final Charset MS949 = Charset.forName("MS949");
    private static final ZoneId KST = ZoneId.of("Asia/Seoul");

    private Clock fixedClock() {
        return Clock.fixed(LocalDateTime.of(2026, 6, 7, 9, 30, 15, 123_000_000).atZone(KST).toInstant(), KST);
    }

    private HostAddressProvider host() {
        return new HostAddressProvider() {
            @Override public String ipAddress() { return "10.0.0.1"; }
            @Override public String macAddress() { return "001122334455"; }
        };
    }

    private EaiRequest req() {
        return EaiRequest.builder()
                .system("UMS").ifId("IPPO00012345").umsBzDttId("SMS2096").umsTrSno("7")
                .emplNum("K1234567").cstNm("홍길동").reqCh("01012345678")
                .deptKey("182").deptNm("디지털금융부").umData1("123456").build();
    }

    private EaiService service(EaiProperties props, RestClient client) {
        return new EaiService(props, client, fixedClock(), () -> "000000001", host());
    }

    @Test
    @DisplayName("enabled=false면 HTTP 미호출, EaiResult.skipped 반환")
    void disabled_skipsHttp() {
        EaiProperties props = new EaiProperties(false, "", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        RestClient client = RestClient.builder().baseUrl("http://eai.invalid").build();
        EaiResult r = service(props, client).sendEai(req());
        assertThat(r.skipped()).isTrue();
        assertThat(r.success()).isFalse();
    }

    @Test
    @DisplayName("enabled=true면 octet-stream으로 전문 전송, 성공 시 success")
    void enabled_sendsOctetStream() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://eai.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://eai.test/eai"))
                .andExpect(method(POST))
                .andRespond(withSuccess("RES-OK".getBytes(MS949), MediaType.APPLICATION_OCTET_STREAM));
        RestClient client = builder.build();

        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        EaiResult r = service(props, client).sendEai(req());

        server.verify();
        assertThat(r.success()).isTrue();
        assertThat(r.responseRaw()).isEqualTo("RES-OK");
    }

    @Test
    @DisplayName("전송 실패(5xx)면 예외 전파 없이 EaiResult.failure")
    void serverError_returnsFailure() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://eai.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://eai.test/eai")).andRespond(withServerError());
        RestClient client = builder.build();

        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        EaiResult r = service(props, client).sendEai(req());

        assertThat(r.success()).isFalse();
        assertThat(r.skipped()).isFalse();
        assertThat(r.errorMessage()).isNotBlank();
    }

    @Test
    @DisplayName("전문 빌드 실패(필드 초과)면 EaiResult.failure")
    void buildOverflow_returnsFailure() {
        // emplNum 9바이트 > CNO 8 → IndexOutOfBoundsException 유발
        EaiRequest bad = EaiRequest.builder()
                .system("UMS").ifId("IPPO00012345").umsBzDttId("SMS2096").umsTrSno("7")
                .emplNum("K12345678").cstNm("홍길동").reqCh("01012345678")
                .deptKey("182").deptNm("디지털금융부").umData1("123456").build();
        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        RestClient client = RestClient.builder().baseUrl("http://eai.test").build();
        EaiResult r = service(props, client).sendEai(bad);
        assertThat(r.success()).isFalse();
        assertThat(r.errorMessage()).contains("전문");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiServiceTest"`
Expected: 컴파일 실패 (`EaiService` 미존재).

- [ ] **Step 3: Write implementation**

```java
// src/main/java/com/kdb/it/infra/eai/service/EaiService.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;
import com.kdb.it.infra.eai.dto.EaiResult;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

import java.nio.charset.Charset;
import java.time.Clock;
import java.util.function.Supplier;

/**
 * EAI 게이트웨이 발송 오케스트레이션.
 *
 * <p>전문 조립({@link EaiMessageBuilder})과 전송을 연결한다. {@code eai.enabled=false}면
 * 전문을 빌드·로깅만 하고 HTTP를 호출하지 않는다(개발/CI 안전). 모든 실패는 예외를 전파하지 않고
 * {@link EaiResult}로 표현한다(부수효과 원칙). 민감정보(휴대폰/OTP) 노출 방지를 위해 전문 전체를
 * 평문 로깅하지 않고 마스킹한다.</p>
 */
@Slf4j
@Service
public class EaiService {

    private final EaiProperties props;
    private final RestClient restClient;
    private final Charset charset;
    private final EaiMessageBuilder builder;

    public EaiService(EaiProperties props,
                      @Qualifier("eaiRestClient") RestClient restClient,
                      Clock eaiClock,
                      @Qualifier("eaiGuidRandom") Supplier<String> guidRandom,
                      HostAddressProvider host) {
        this.props = props;
        this.restClient = restClient;
        this.charset = Charset.forName(props.charset());
        this.builder = new EaiMessageBuilder(props, eaiClock, guidRandom, host);
    }

    /**
     * UMS 표준전문을 조립해 EAI로 전송한다.
     *
     * @param request 발송 요청
     * @return 전송 결과(성공/스킵/실패). 절대 예외를 던지지 않는다.
     */
    public EaiResult sendEai(EaiRequest request) {
        byte[] message;
        try {
            message = builder.build(request);
        } catch (IndexOutOfBoundsException | NumberFormatException e) {
            log.warn("EAI 전문 조립 실패: ifId={}, tpl={}, 사유={}",
                    request.getIfId(), request.getUmsBzDttId(), e.getMessage());
            return EaiResult.failure("전문 조립 실패: " + e.getMessage());
        }

        if (!props.enabled()) {
            log.info("EAI 비활성화(eai.enabled=false) — 전송 스킵. ifId={}, tpl={}, len={}바이트, 미리보기=[{}]",
                    request.getIfId(), request.getUmsBzDttId(), message.length, maskedPreview(message));
            return EaiResult.skip();
        }

        try {
            byte[] response = restClient.post()
                    .uri(props.url())
                    .contentType(MediaType.APPLICATION_OCTET_STREAM)
                    .body(message)
                    .retrieve()
                    .body(byte[].class);
            String responseRaw = (response == null) ? "" : new String(response, charset);
            log.info("EAI 전송 성공: ifId={}, tpl={}, reqLen={}바이트", request.getIfId(), request.getUmsBzDttId(), message.length);
            return EaiResult.success(responseRaw);
        } catch (RuntimeException e) {
            log.warn("EAI 전송 실패: ifId={}, tpl={}, 사유={}", request.getIfId(), request.getUmsBzDttId(), e.getMessage());
            return EaiResult.failure("전송 실패: " + e.getMessage());
        }
    }

    /**
     * 로그용 마스킹 미리보기 — 헤더 앞 60바이트만 노출하고 개별부(민감정보 구간)는 가린다.
     * 휴대폰번호/OTP가 포함된 개별부 전체 평문 로깅을 금지한다.
     */
    private String maskedPreview(byte[] message) {
        int head = Math.min(60, message.length);
        String prefix = new String(message, 0, head, charset);
        return prefix + (message.length > head ? "...(개별부 " + (message.length - head) + "바이트 마스킹)" : "");
    }
}
```

> 참고: 테스트는 생성자를 직접 호출(빈 주입 우회)하므로 `@Qualifier`는 런타임 주입에만 영향. `eaiClock` 파라미터명이 Task 8의 빈명과 일치해야 한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.EaiServiceTest"`
Expected: PASS (4개).

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiService.java it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java
git commit -m "feat(eai): EaiService 전송 오케스트레이션(enabled 분기, 마스킹 로깅, 비차단 실패)"
```

---

## Task 10: 설정 기본값(application.properties) + TASK.md + 전체 검증

**Files:**
- Modify: `src/main/resources/application.properties`
- Modify: `TASK.md` (루트 `C:\it\TASK.md`)

- [ ] **Step 1: Add eai.* defaults**

`application.properties` 끝에 추가:

```properties

# ── EAI (KDB 표준전문 발송) ─────────────────────────────────────────────
# 개발/CI: 전송 스킵(전문 빌드·로깅만). 운영 프로파일에서 eai.enabled=true + eai.url 주입.
eai.enabled=false
eai.url=${EAI_URL:}
eai.charset=MS949
eai.connect-timeout=3000
eai.read-timeout=3000
eai.sys-env-tc=L
# IT Portal 시스템 식별자 (확정: IPP / PRM / PP)
eai.fwdi-sys-c=IPP
eai.bz-c-s3=IPP
eai.app-c=PRM
eai.app-bz-lv1-c=PP
```

- [ ] **Step 2: Verify app context loads with new beans**

Run: `./gradlew test`
Expected: 전체 테스트 PASS. (컨텍스트 로딩 테스트가 있다면 `EaiInfraConfig`/`EaiService` 빈 등록도 함께 검증됨.)

- [ ] **Step 3: Append follow-ups to TASK.md**

`TASK.md`에 아래 항목 추가(적절한 섹션 또는 신규 "EAI" 섹션):

```markdown
## EAI (KDB 표준전문 발송)
- [ ] KDB EAI 운영팀으로부터 IT Portal 전용 **IF_ID(인터페이스ID)** 및 **UMS 템플릿(업무구분ID)** 발급·확정. (시스템 식별자 IPP/PRM/PP는 프로퍼티로 확정)
- [ ] 운영 프로파일에서 `eai.enabled=true` + `eai.url`(환경변수 `EAI_URL`) 주입, 배포 체크리스트 반영.
- [ ] (선택) `NotificationDispatcher` 실연동 어댑터로 `EaiService` 연결 — 알림톡/SMS/이메일 채널 발송.
- [ ] 발신채널 상수(`1588-1500`, `hrd@kdb.co.kr`)는 ePAMS(eHR) 값 — IT Portal 발신처로 교체 필요 시 프로퍼티화.
```

- [ ] **Step 4: Full clean test (공통 영향 변경 재검증)**

Run: `./gradlew clean test`
Expected: BUILD SUCCESSFUL, 모든 EAI 테스트 포함 통과.

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/resources/application.properties TASK.md
git commit -m "chore(eai): application.properties 기본값 + TASK.md 후속 과제 등록"
```

---

## Self-Review (작성자 점검 완료)

**Spec coverage:**
- §2 패키지 배치 → Task 1~9 (infra/eai config/dto/service 전부 생성). ✅
- §3.2 전문 조립 충실도(param01~08, lpad, 길이 3종, MS949 중앙화) → Task 5·6. ✅
- §3.3 결정성 시임(Clock/guidRandom/HostAddressProvider) → Task 4·6·8. ✅
- §4 동일성 검증(참조 전사본 + 바이트 비교 + 구간 진단) → Task 7. ✅
- §5.1/§5.2 EaiProperties + IPP/PRM/PP 프로퍼티 관리 → Task 2·8·10. ✅
- §5.3 실패 처리(EaiResult, 비차단) → Task 1·9. ✅
- §5.4 보안(민감정보 마스킹, url/식별자 주입) → Task 9·10. ✅
- §1 HTTP RestClient octet-stream byte[] → Task 8·9. ✅
- §1 enabled=false 스킵 → Task 9. ✅

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함. "TODO/적절히 처리" 없음. ✅

**Type consistency:**
- `EaiProperties` record 시그니처(10개 컴포넌트, 순서: enabled,url,charset,connectTimeout,readTimeout,sysEnvTc,fwdiSysC,bzCS3,appC,appBzLv1C)가 Task 2 정의 ↔ Task 6/7/9 생성자 호출에서 동일. ✅
- `EaiMessageBuilder(props, clock, guidRandom, host)` 4-인자 생성자: Task 6 정의 ↔ Task 9 사용 일치. ✅
- `EaiMessageBuilder.build(EaiRequest)` / `EpamsReferenceMessageBuilder.buildUms(EaiRequest)` 메서드명 일관. ✅
- `EaiResult.success/skipped/failure` 정적 팩토리: Task 1 정의 ↔ Task 9 사용 일치. ✅
- `EaiService.sendEai(EaiRequest)` 메서드명: Task 9 정의 ↔ 테스트 호출 일치. ✅
- 빈명 `eaiRestClient`/`eaiClock`/`eaiGuidRandom`: Task 8 정의 ↔ Task 9 `@Qualifier`/파라미터명 일치. ✅

**알려진 가정/리스크:**
- `eaiClock` 빈을 EAI 전용으로 명시 등록. 프로젝트에 이미 전역 `Clock` 빈이 있으면 Task 8 주석대로 조정.
- 동일성 테스트는 "신규 빌더 == 내 손으로 전사한 ePAMS 로직"을 보증한다. 실제 KDB 게이트웨이 수용 여부는 IF_ID/템플릿 발급 후 운영 검증 필요(TASK.md 등록).
