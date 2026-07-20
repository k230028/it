# EAI 개별부 플러그형 구조 (UMS + GWE) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** EAI 표준전문의 개별부(param07)를 `EaiPayloadSection` SPI + sealed 페이로드로 분리해, 공유 헤더/전송 인프라로 여러 시스템(UMS·GWE)을 연동할 수 있게 한다.

**Architecture:** 헤더(param01~06,08)는 `EaiMessageBuilder`에 그대로 두고, 개별부는 페이로드 타입으로 디스패치되는 섹션 전략으로 분리. 섹션은 무상태 `@Component`, 공유 도구는 `EaiSectionContext`로 전달. UMS 출력은 바이트 골든으로 회귀 보증.

**Tech Stack:** Java 25, Spring Boot 4.0.5, Lombok, JUnit5 + AssertJ, MS949 고정길이 전문.

**Spec:** `docs/superpowers/specs/2026-06-07-eai-pluggable-payload-design.md`
**참조:** ePAMS `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\service\EaiService.java` (`getParamGWE` 주석 원본)

**Repo:** 백엔드 코드는 자체 repo `C:\it\it_backend`(브랜치 `feat/eai-pluggable-payload`). gradle: `(cd it_backend && ./gradlew ...)`. 한글 주석. 패키지 `com.kdb.it.infra.eai`.

**중요 — 회귀 불변식:** 헤더(param01~06) 바이트와 UMS 개별부 바이트는 **한 바이트도 바뀌면 안 됨**. Task 1의 골든과 기존 동일성 테스트가 가드.

---

## Task 1: UMS 골든 회귀 픽스처 캡처 (리팩터링 전 최우선)

현재 빌더가 만드는 UMS 전문 바이트를 Base64로 캡처해 테스트 리소스로 고정한다. 이후 모든 리팩터링은 이 골든과 일치해야 한다.

**Files:**
- Create: `src/test/java/com/kdb/it/infra/eai/service/UmsGoldenCaptureTest.java` (임시 캡처용)
- Create: `src/test/resources/eai/ums-golden.b64` (캡처 산출물)

- [ ] **Step 1: 캡처 테스트 작성 (현재 flat EaiRequest API 사용)**

```java
// src/test/java/com/kdb/it/infra/eai/service/UmsGoldenCaptureTest.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.EaiRequest;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Base64;

class UmsGoldenCaptureTest {

    @Test
    void captureGolden() throws Exception {
        Clock clock = Clock.fixed(LocalDateTime.of(2026, 6, 7, 9, 30, 15, 123_000_000)
                .atZone(ZoneId.of("Asia/Seoul")).toInstant(), ZoneId.of("Asia/Seoul"));
        EaiProperties props = new EaiProperties(false, "", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        HostAddressProvider host = new HostAddressProvider() {
            @Override public String ipAddress() { return "10.0.0.1"; }
            @Override public String macAddress() { return "001122334455"; }
        };
        EaiRequest req = EaiRequest.builder()
                .system("UMS").ifId("IPPO00012345").umsBzDttId("SMS2096").umsTrSno("7")
                .emplNum("K1234567").cstNm("홍길동").reqCh("01012345678")
                .deptKey("182").deptNm("디지털금융부").umData1("123456").build();

        byte[] msg = new EaiMessageBuilder(props, clock, () -> "000000001", host).build(req);

        Path out = Path.of("src/test/resources/eai/ums-golden.b64");
        Files.createDirectories(out.getParent());
        Files.writeString(out, Base64.getEncoder().encodeToString(msg));
        System.out.println("GOLDEN_LEN=" + msg.length);
    }
}
```

- [ ] **Step 2: 실행하여 골든 파일 생성**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.UmsGoldenCaptureTest"`
Expected: PASS, 콘솔에 `GOLDEN_LEN=11014`, `src/test/resources/eai/ums-golden.b64` 생성됨.
확인: `ls -l it_backend/src/test/resources/eai/ums-golden.b64` 존재 + 비어있지 않음.

- [ ] **Step 3: 캡처 테스트 삭제 (산출물만 보존)**

캡처는 1회성이므로 테스트 클래스를 삭제한다(골든 검증은 Task 6에서 신규 API로 작성).
Run: `rm it_backend/src/test/java/com/kdb/it/infra/eai/service/UmsGoldenCaptureTest.java`

- [ ] **Step 4: Commit**

```bash
git add it_backend/src/test/resources/eai/ums-golden.b64
git commit -m "test(eai): UMS 전문 바이트 골든 픽스처 캡처 (리팩터링 회귀 가드)"
```

---

## Task 2: sealed EaiPayload + UmsPayload + GwePayload records

개별부 데이터 모델. 기존 flat `EaiRequest`는 아직 건드리지 않음(Task 6에서 교체) — 이 단계는 순수 추가라 컴파일 green.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/dto/EaiPayload.java`
- Create: `src/main/java/com/kdb/it/infra/eai/dto/UmsPayload.java`
- Create: `src/main/java/com/kdb/it/infra/eai/dto/GwePayload.java`

- [ ] **Step 1: EaiPayload (sealed)**

```java
// src/main/java/com/kdb/it/infra/eai/dto/EaiPayload.java
package com.kdb.it.infra.eai.dto;

/**
 * EAI 표준전문 개별부(param07)의 채널별 입력 데이터.
 *
 * <p>sealed — 신규 채널 추가 시 permits에 등록하고 대응 {@code EaiPayloadSection}을 추가한다.</p>
 */
public sealed interface EaiPayload permits UmsPayload, GwePayload {
}
```

- [ ] **Step 2: UmsPayload (record, @Builder)**

```java
// src/main/java/com/kdb/it/infra/eai/dto/UmsPayload.java
package com.kdb.it.infra.eai.dto;

import lombok.Builder;

/**
 * UMS(SMS/알림톡/이메일) 개별부 입력.
 *
 * <p>기존 {@code EaiRequest}의 UMS 필드를 그대로 이전했다. 헤더용 {@code ifId}/{@code systemCode}는
 * 페이로드가 아니라 {@link EaiRequest}/섹션이 책임진다.</p>
 */
@Builder
public record UmsPayload(
        String umsBzDttId,  // UMS업무구분ID/템플릿 (7자리, 1번째 글자 S/A/E)
        String umsTrSno,    // UMS거래일련번호 (숫자 문자열)
        String emplNum,     // 수신자 행번 (CNO/REQ_USID)
        String cstNm,       // 수신자명/고객명
        String reqCh,       // 수신 채널값 (휴대폰/이메일)
        String deptKey,     // 요청부점코드
        String deptNm,      // 요청부점명
        String sendDt,      // 발송예정일자 (yyyyMMdd, null=당일)
        String sendTime,    // 발송예정시각 (HHmmss, null=즉시)
        String umData1, String umData2, String umData3, String umData4,
        String umData5, String umData6, String umData7
) implements EaiPayload {

    /** null 기본값 보정 — 필수값은 빈 문자열로, 나머지는 그대로. */
    public UmsPayload {
        umsBzDttId = umsBzDttId == null ? "" : umsBzDttId;
        umsTrSno = umsTrSno == null ? "" : umsTrSno;
    }
}
```

- [ ] **Step 3: GwePayload (record, @Builder, 기본값 보정)**

```java
// src/main/java/com/kdb/it/infra/eai/dto/GwePayload.java
package com.kdb.it.infra.eai.dto;

import lombok.Builder;

/**
 * GWE(그룹웨어 메신저/메일) 개별부 입력.
 *
 * <p>{@code msgGubun}: "1"=메신저, "3"=메일. 메신저 전용 {@code url},
 * 메일 전용 {@code ccRecvIds/bccRecvIds/attFlag/att}.</p>
 */
@Builder
public record GwePayload(
        String msgGubun,    // "1" 메신저 / "3" 메일
        String recvIds,     // 수신자 사번/부서코드 콤마목록
        String subject,     // 제목
        String contents,    // 본문(HTML, 치환 완료본)
        String destGubun,   // "1" 사용자 / "2" 부서 (기본 "1")
        String url,         // 메신저 클릭 URL
        String ccRecvIds,   // 메일 참조
        String bccRecvIds,  // 메일 숨은참조
        String attFlag,     // 메일 첨부여부
        String att,         // 메일 첨부정보
        String sendId,      // 전송자 사번 (기본 "systemalert")
        String sendName     // 전송자 이름 (기본 "관리자")
) implements EaiPayload {

    /** null 기본값 보정. */
    public GwePayload {
        msgGubun = msgGubun == null ? "" : msgGubun;
        recvIds = recvIds == null ? "" : recvIds;
        subject = subject == null ? "" : subject;
        contents = contents == null ? "" : contents;
        destGubun = (destGubun == null || destGubun.isBlank()) ? "1" : destGubun;
        url = url == null ? "" : url;
        ccRecvIds = ccRecvIds == null ? "" : ccRecvIds;
        bccRecvIds = bccRecvIds == null ? "" : bccRecvIds;
        attFlag = attFlag == null ? "" : attFlag;
        att = att == null ? "" : att;
        sendId = (sendId == null || sendId.isBlank()) ? "systemalert" : sendId;
        sendName = (sendName == null || sendName.isBlank()) ? "관리자" : sendName;
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/dto/EaiPayload.java it_backend/src/main/java/com/kdb/it/infra/eai/dto/UmsPayload.java it_backend/src/main/java/com/kdb/it/infra/eai/dto/GwePayload.java
git commit -m "feat(eai): sealed EaiPayload + UmsPayload/GwePayload record 추가"
```

---

## Task 3: EaiPayloadSection SPI + EaiSectionContext + UmsPayloadSection

개별부 전략 인터페이스와 공유 컨텍스트, UMS 구현체(기존 param07Ums 로직 이전)를 추가한다. 순수 추가(아직 빌더는 자체 param07Ums 유지) → green.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/service/EaiPayloadSection.java`
- Create: `src/main/java/com/kdb/it/infra/eai/service/EaiSectionContext.java`
- Create: `src/main/java/com/kdb/it/infra/eai/service/UmsPayloadSection.java`

- [ ] **Step 1: SPI 인터페이스**

```java
// src/main/java/com/kdb/it/infra/eai/service/EaiPayloadSection.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.dto.EaiPayload;

/**
 * 표준전문 개별부(param07) 채널 1개를 책임지는 전략(SPI).
 *
 * <p>무상태 {@code @Component}로 구현한다. 신규 채널 = 새 페이로드 record + 새 섹션 1개.</p>
 */
public interface EaiPayloadSection {

    /** 이 섹션이 처리할 수 있는 페이로드인지. */
    boolean supports(EaiPayload payload);

    /** 헤더 거래공통부 RMS_SYS_C 값 (예: "UMS", "GWE"). */
    String systemCode();

    /** 개별부 문자열 조립 (charset 미적용, 전송 전 단계). */
    String build(EaiPayload payload, EaiSectionContext ctx);
}
```

- [ ] **Step 2: 공유 컨텍스트**

```java
// src/main/java/com/kdb/it/infra/eai/service/EaiSectionContext.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;

import java.nio.charset.Charset;
import java.util.function.IntFunction;
import java.util.function.UnaryOperator;

/**
 * 개별부 섹션이 필요로 하는 공유 도구 묶음.
 *
 * <p>{@link EaiMessageBuilder}가 호출 시점에 charset·설정·시각/난수 시임을 묶어 전달한다.
 * 섹션이 무상태로 유지되면서도 결정성 시임(테스트 고정값)을 공유받는다.</p>
 *
 * @param cs           고정길이 전문 charset (MS949)
 * @param props        EAI 설정 (시스템 식별자 등)
 * @param dateFn       패턴 → 시각문자열 (Clock 시임 바인딩)
 * @param randomDigits 길이 → 0~9 난수 문자열 (SecureRandom 시임 바인딩)
 */
public record EaiSectionContext(
        Charset cs,
        EaiProperties props,
        UnaryOperator<String> dateFn,
        IntFunction<String> randomDigits
) {
    /** 좌측 패딩 (ePAMS lpad 규칙). */
    public String lpad(String type, int offset, String str) {
        return EaiMessageBuilder.lpad(cs, type, offset, str);
    }

    /** 시각 문자열 (예: "yyyyMMdd"). */
    public String date(String pattern) {
        return dateFn.apply(pattern);
    }

    /** charset 기준 바이트 길이. */
    public int bytes(String s) {
        return s.getBytes(cs).length;
    }
}
```

- [ ] **Step 3: UmsPayloadSection (param07Ums 이전 + variableDataJson 이동)**

```java
// src/main/java/com/kdb/it/infra/eai/service/UmsPayloadSection.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.dto.EaiPayload;
import com.kdb.it.infra.eai.dto.UmsPayload;
import org.springframework.stereotype.Component;

/**
 * UMS 개별부 섹션 — SMS/알림톡/이메일.
 *
 * <p>기존 {@code EaiMessageBuilder.param07Ums}를 그대로 이전했다. 출력 바이트는 불변.</p>
 */
@Component
public class UmsPayloadSection implements EaiPayloadSection {

    private static final String[] UM_KEYS =
            {"UM_DATA_1", "UM_DATA_2", "UM_DATA_3", "UM_DATA_4", "UM_DATA_5", "UM_DATA_6", "UM_DATA_7"};

    @Override
    public boolean supports(EaiPayload payload) {
        return payload instanceof UmsPayload;
    }

    @Override
    public String systemCode() {
        return "UMS";
    }

    @Override
    public String build(EaiPayload payload, EaiSectionContext ctx) {
        UmsPayload u = (UmsPayload) payload;

        String umsBzDttId = u.umsBzDttId();
        String reqUsid = u.emplNum();
        String umsSdChnNo = u.reqCh();
        String sendDt = u.sendDt();
        String sendTime = u.sendTime();

        String trDt = ctx.date("yyyyMMdd");
        String trTm = ctx.date("HHmmss");

        String umsTrSno = u.umsTrSno();
        String umsRetNo = umsBzDttId + trDt + String.format("%08d", Integer.parseInt(umsTrSno));

        String umsTmeChnNo = "1588-1500";
        if (!umsBzDttId.isEmpty() && "E".equals(umsBzDttId.substring(0, 1))) {
            umsTmeChnNo = "hrd@kdb.co.kr";
        }

        String reqUsrNm = u.cstNm();
        String reqBbrC = u.deptKey();
        String reqBbrNm = u.deptNm();

        String umsSdChnTpC = umsBzDttId.isEmpty() ? "" : umsBzDttId.substring(0, 1);
        if ("E".equals(umsSdChnTpC)) {
            umsSdChnTpC = "M";
        }

        String variDatS0 = variableDataJson(u);
        String variDatLenN9 = String.valueOf(ctx.bytes(variDatS0));

        String sdMplDt = (sendDt == null) ? trDt : sendDt;
        String sdMplTm = (sendTime == null) ? "" : sendTime;

        StringBuilder p = new StringBuilder();
        p.append(ctx.lpad("C", 7, umsBzDttId));    // UMS_BZ_DTT_ID
        p.append(trDt);                            // TR_DT
        p.append(ctx.lpad("N", 10, umsTrSno));     // UMS_TR_SNO
        p.append(ctx.lpad("C", 23, umsRetNo));     // UMS_RET_NO
        p.append(ctx.lpad("C", 8, reqUsid));       // CNO
        p.append(ctx.lpad("C", 100, reqUsrNm));    // CST_NM
        p.append(ctx.lpad("C", 30, ""));           // SECT_EML_CNFM_NO
        p.append(ctx.lpad("C", 200, umsSdChnNo));  // UMS_SD_CHN_NO
        p.append(ctx.lpad("C", 4000, ""));         // UMS_SD_CHN_ADDR_CONE
        p.append(ctx.lpad("C", 8, sdMplDt));       // UMS_SD_MPL_DT
        p.append(ctx.lpad("C", 6, sdMplTm));       // UMS_SD_MPL_TM
        p.append(ctx.lpad("C", 100, umsTmeChnNo)); // UMS_TME_CHN_NO
        p.append(ctx.props().appC());              // APP_C
        p.append(ctx.props().appBzLv1C());         // APP_BZ_LV1_C
        p.append(ctx.lpad("C", 14, reqUsid));      // REQ_USID
        p.append(ctx.lpad("C", 100, reqUsrNm));    // REQ_USR_NM
        p.append(ctx.lpad("C", 3, reqBbrC));       // REQ_BBR_C
        p.append(ctx.lpad("C", 100, reqBbrNm));    // REQ_BBR_NM
        p.append("N");                             // UMS_CKG_C
        p.append(ctx.lpad("C", 4000, ""));         // APG_FL_CONE
        p.append(ctx.lpad("C", 6, trTm));          // TR_TM
        p.append(umsSdChnTpC);                     // UMS_SD_CHN_TP_C
        p.append("10");                            // CHN_REQ_TP_C
        p.append(ctx.lpad("C", 100, ""));          // BZ_DCM_INF_CONE
        p.append(ctx.lpad("C", 1000, ""));         // UMS_BZ_RFR_CONE
        p.append(ctx.lpad("C", 1, "N"));           // DEL_YN
        p.append(ctx.lpad("C", 14, "SYSTEM"));     // LST_CHG_USID
        p.append(ctx.props().bzCS3());             // BZ_C_S3
        p.append(ctx.lpad("N", 9, variDatLenN9));  // VARI_DAT_LEN_N9
        p.append(variDatS0);                       // VARI_DAT_S0
        return p.toString();
    }

    /** 가변데이터 JSON 안정 직렬화 (키 순서 고정, 비어있지 않은 항목만). */
    private String variableDataJson(UmsPayload u) {
        String[] vals = {u.umData1(), u.umData2(), u.umData3(), u.umData4(),
                u.umData5(), u.umData6(), u.umData7()};
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

    private static String escape(String v) {
        return v.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t");
    }
}
```

- [ ] **Step 4: 컴파일 확인**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiPayloadSection.java it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiSectionContext.java it_backend/src/main/java/com/kdb/it/infra/eai/service/UmsPayloadSection.java
git commit -m "feat(eai): EaiPayloadSection SPI + EaiSectionContext + UmsPayloadSection"
```

---

## Task 4: GwePayloadSection + GWE 동일성 테스트

GWE 개별부 구현체와, ePAMS getParamGWE 필드 레이아웃을 전사한 독립 참조 빌더로 바이트 동일성을 검증한다.

**Files:**
- Create: `src/main/java/com/kdb/it/infra/eai/service/GwePayloadSection.java`
- Create: `src/test/java/com/kdb/it/infra/eai/service/EpamsGweReferenceBuilder.java`
- Create: `src/test/java/com/kdb/it/infra/eai/service/GwePayloadSectionTest.java`

- [ ] **Step 1: 실패 테스트 작성 (GWE 동일성 — 메신저/메일)**

```java
// src/test/java/com/kdb/it/infra/eai/service/GwePayloadSectionTest.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.config.EaiProperties;
import com.kdb.it.infra.eai.dto.GwePayload;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.Charset;
import java.time.format.DateTimeFormatter;
import java.time.LocalDateTime;
import java.util.Locale;
import java.util.function.IntFunction;
import java.util.function.UnaryOperator;

import static org.assertj.core.api.Assertions.assertThat;

class GwePayloadSectionTest {

    private static final Charset MS949 = Charset.forName("MS949");

    private EaiSectionContext fixedCtx() {
        LocalDateTime fixed = LocalDateTime.of(2026, 6, 7, 9, 30, 15, 123_000_000);
        UnaryOperator<String> dateFn = pattern ->
                DateTimeFormatter.ofPattern(pattern, Locale.ROOT).format(fixed);
        IntFunction<String> randomDigits = len -> "1".repeat(len); // 고정 난수
        EaiProperties props = new EaiProperties(false, "", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        return new EaiSectionContext(MS949, props, dateFn, randomDigits);
    }

    @Test
    @DisplayName("GwePayloadSection은 ePAMS getParamGWE 참조 전사와 바이트 동일 (메일)")
    void byteForByte_mail() {
        GwePayload mail = GwePayload.builder()
                .msgGubun("3").recvIds("k0001,k0002").subject("제목입니다")
                .contents("<p>본문</p>").ccRecvIds("k9999").attFlag("Y").att("file.pdf").build();
        EaiSectionContext ctx = fixedCtx();
        String actual = new GwePayloadSection().build(mail, ctx);
        String reference = new EpamsGweReferenceBuilder(ctx).build(mail);
        assertThat(actual.getBytes(MS949)).isEqualTo(reference.getBytes(MS949));
    }

    @Test
    @DisplayName("메신저(1) 케이스도 참조와 동일")
    void byteForByte_messenger() {
        GwePayload msgr = GwePayload.builder()
                .msgGubun("1").recvIds("k0001").subject("알림").contents("내용").url("http://it.kdb.co.kr/x").build();
        EaiSectionContext ctx = fixedCtx();
        assertThat(new GwePayloadSection().build(msgr, ctx).getBytes(MS949))
                .isEqualTo(new EpamsGweReferenceBuilder(ctx).build(msgr).getBytes(MS949));
    }

    @Test
    @DisplayName("systemCode는 GWE, GwePayload만 supports")
    void metadata() {
        GwePayloadSection s = new GwePayloadSection();
        assertThat(s.systemCode()).isEqualTo("GWE");
        assertThat(s.supports(GwePayload.builder().msgGubun("3").recvIds("k1").build())).isTrue();
    }
}
```

- [ ] **Step 2: 참조 전사 빌더 (테스트 전용 오라클)**

```java
// src/test/java/com/kdb/it/infra/eai/service/EpamsGweReferenceBuilder.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.dto.GwePayload;

/**
 * [테스트 전용 / 동결] ePAMS {@code getParamGWE}(주석 원본)의 개별부 필드 레이아웃 독립 전사.
 *
 * <p>{@link GwePayloadSection}과 바이트 동일함을 증명하기 위한 오라클. 자체 헬퍼만 사용.</p>
 */
class EpamsGweReferenceBuilder {

    private final EaiSectionContext ctx;

    EpamsGweReferenceBuilder(EaiSectionContext ctx) {
        this.ctx = ctx;
    }

    String build(GwePayload g) {
        String msgKey = "mailt" + ctx.props().appC() + ctx.props().appBzLv1C()
                + ctx.date("yyyyMMddHHmmss") + ctx.randomDigits().apply(8);

        StringBuilder p = new StringBuilder();
        p.append(pad("C", 32, msgKey));               // MSG_KEY
        p.append(pad("C", 1, g.msgGubun()));          // MSG_GUBUN
        p.append(pad("C", 50, g.sendId()));           // SEND_ID
        p.append(pad("C", 100, g.sendName()));        // SEND_NAME
        p.append(pad("C", 1, g.destGubun()));         // DEST_GUBUN
        p.append(pad("C", 4000, g.recvIds()));        // RECV_IDS
        p.append(pad("C", 500, g.ccRecvIds()));       // CC_RECV_IDS
        p.append(pad("C", 500, g.bccRecvIds()));      // BCC_RECV_IDS
        p.append(pad("C", 200, g.subject()));         // SUBJECT
        p.append(pad("C", 4000, g.contents()));       // CONTENTS
        p.append(pad("C", 500, g.url()));             // URL
        p.append(pad("C", 1, g.attFlag()));           // ATT_FLAG
        p.append(pad("C", 4000, g.att()));            // ATT
        p.append(pad("C", 3, ctx.props().fwdiSysC())); // SYSTEM_CODE
        return p.toString();
    }

    private String pad(String type, int offset, String str) {
        return EaiMessageBuilder.lpad(java.nio.charset.Charset.forName("MS949"), type, offset, str);
    }
}
```

- [ ] **Step 3: GwePayloadSection 구현**

```java
// src/main/java/com/kdb/it/infra/eai/service/GwePayloadSection.java
package com.kdb.it.infra.eai.service;

import com.kdb.it.infra.eai.dto.EaiPayload;
import com.kdb.it.infra.eai.dto.GwePayload;
import org.springframework.stereotype.Component;

/**
 * GWE(그룹웨어) 개별부 섹션 — 메신저(1)/메일(3).
 *
 * <p>ePAMS {@code getParamGWE}(주석 원본)의 필드 레이아웃을 포팅했다.
 * {@code MSG_KEY} = "mailt" + APP_C + APP_BZ_LV1_C + 일시(14) + 난수(8) = 32자.</p>
 */
@Component
public class GwePayloadSection implements EaiPayloadSection {

    @Override
    public boolean supports(EaiPayload payload) {
        return payload instanceof GwePayload;
    }

    @Override
    public String systemCode() {
        return "GWE";
    }

    @Override
    public String build(EaiPayload payload, EaiSectionContext ctx) {
        GwePayload g = (GwePayload) payload;

        String msgKey = "mailt" + ctx.props().appC() + ctx.props().appBzLv1C()
                + ctx.date("yyyyMMddHHmmss") + ctx.randomDigits().apply(8);

        StringBuilder p = new StringBuilder();
        p.append(ctx.lpad("C", 32, msgKey));            // MSG_KEY      메시지키값
        p.append(ctx.lpad("C", 1, g.msgGubun()));       // MSG_GUBUN    알림구분 (1메신저/3메일)
        p.append(ctx.lpad("C", 50, g.sendId()));        // SEND_ID      전송자 사번
        p.append(ctx.lpad("C", 100, g.sendName()));     // SEND_NAME    전송자 이름
        p.append(ctx.lpad("C", 1, g.destGubun()));      // DEST_GUBUN   수신자 구분 (1사용자/2부서)
        p.append(ctx.lpad("C", 4000, g.recvIds()));     // RECV_IDS     수신자 정보
        p.append(ctx.lpad("C", 500, g.ccRecvIds()));    // CC_RECV_IDS  참조 (메일)
        p.append(ctx.lpad("C", 500, g.bccRecvIds()));   // BCC_RECV_IDS 숨은참조 (메일)
        p.append(ctx.lpad("C", 200, g.subject()));      // SUBJECT      제목
        p.append(ctx.lpad("C", 4000, g.contents()));    // CONTENTS     내용 (HTML)
        p.append(ctx.lpad("C", 500, g.url()));          // URL          메신저 클릭URL
        p.append(ctx.lpad("C", 1, g.attFlag()));        // ATT_FLAG     첨부여부 (메일)
        p.append(ctx.lpad("C", 4000, g.att()));         // ATT          첨부정보 (메일)
        p.append(ctx.lpad("C", 3, ctx.props().fwdiSysC())); // SYSTEM_CODE 발송요청 시스템코드
        return p.toString();
    }
}
```

- [ ] **Step 4: 테스트 실행 (green)**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.service.GwePayloadSectionTest"`
Expected: PASS (3). 불일치 시 어느 필드 offset이 틀렸는지 ePAMS getParamGWE와 1:1 대조.

- [ ] **Step 5: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/service/GwePayloadSection.java it_backend/src/test/java/com/kdb/it/infra/eai/service/EpamsGweReferenceBuilder.java it_backend/src/test/java/com/kdb/it/infra/eai/service/GwePayloadSectionTest.java
git commit -m "feat(eai): GwePayloadSection (그룹웨어 메신저/메일) + 바이트 동일성 검증"
```

---

## Task 5: randomDigits 시임 빈 (EaiInfraConfig)

GWE MSG_KEY 8자리 난수용 신규 시임. 헤더 GUID 시임(`eaiGuidRandom`)은 **건드리지 않는다**.

**Files:**
- Modify: `src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java`

- [ ] **Step 1: eaiRandomDigits 빈 추가**

`EaiInfraConfig.java`에 import와 빈을 추가한다.

import 추가:
```java
import java.util.function.IntFunction;
```

`eaiGuidRandom` 빈 아래에 추가:
```java
    /** 길이 인자 난수(0~9) 공급 — GWE MSG_KEY(8자리) 등 섹션 전용. 헤더 GUID 시임과 별개. */
    @Bean
    public IntFunction<String> eaiRandomDigits() {
        return len -> {
            StringBuilder sb = new StringBuilder(len);
            for (int i = 0; i < len; i++) {
                sb.append(SECURE_RANDOM.nextInt(10));
            }
            return sb.toString();
        };
    }
```

- [ ] **Step 2: 컴파일 확인**

Run: `./gradlew compileJava`
Expected: BUILD SUCCESSFUL.

- [ ] **Step 3: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai/config/EaiInfraConfig.java
git commit -m "feat(eai): GWE MSG_KEY용 randomDigits 시임 빈 추가"
```

---

## Task 6: 컷오버 — EaiRequest record 교체 + 빌더 위임 + 서비스/테스트 마이그레이션

flat `EaiRequest`를 `{ifId, payload}` record로 교체하고, `EaiMessageBuilder`가 섹션에 위임하도록 재배선한다. 모든 호출처/테스트를 신규 API로 마이그레이션한다. **이 태스크 종료 시 컴파일·전체 테스트 green** (UMS 골든 + 동일성 + GWE 포함).

**Files:**
- Replace: `src/main/java/com/kdb/it/infra/eai/dto/EaiRequest.java`
- Modify: `src/main/java/com/kdb/it/infra/eai/service/EaiMessageBuilder.java` (build/param02 재배선, param07Ums·variableDataJson·escape 제거, randomDigits/sections 필드 추가)
- Modify: `src/main/java/com/kdb/it/infra/eai/service/EaiService.java` (sections/randomDigits 주입, 로깅 필드 변경)
- Modify: `src/test/java/com/kdb/it/infra/eai/service/EpamsReferenceMessageBuilder.java` (UmsPayload 입력)
- Modify: `src/test/java/com/kdb/it/infra/eai/service/EaiMessageBuilderTest.java` (픽스처 마이그레이션 + 골든 테스트)
- Modify: `src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java` (픽스처 마이그레이션 + GWE 발송)

- [ ] **Step 1: EaiRequest record로 교체**

```java
// src/main/java/com/kdb/it/infra/eai/dto/EaiRequest.java  (전체 교체)
package com.kdb.it.infra.eai.dto;

/**
 * EAI 발송 요청 — 헤더 식별자({@code ifId}) + 개별부 페이로드.
 *
 * <p>채널별 데이터는 {@link EaiPayload}(sealed)로 분리한다. 헤더 RMS_SYS_C는
 * 페이로드에 대응하는 섹션의 systemCode가 결정한다.</p>
 *
 * @param ifId    인터페이스ID IF_ID (KDB 발급, 최대 12자리)
 * @param payload 개별부 입력 (UmsPayload/GwePayload)
 */
public record EaiRequest(String ifId, EaiPayload payload) {

    /** UMS 발송 요청. */
    public static EaiRequest ums(String ifId, UmsPayload payload) {
        return new EaiRequest(ifId, payload);
    }

    /** GWE 발송 요청. */
    public static EaiRequest gwe(String ifId, GwePayload payload) {
        return new EaiRequest(ifId, payload);
    }
}
```

- [ ] **Step 2: EaiMessageBuilder 재배선**

(a) 필드/생성자: `guidRandom`은 유지하고 `randomDigits`/`sections` 추가. import에 `java.util.List`, `java.util.function.IntFunction`, `com.kdb.it.infra.eai.dto.EaiPayload` 추가.

기존:
```java
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
```
교체:
```java
    private final EaiProperties props;
    private final Clock clock;
    private final Supplier<String> guidRandom;        // 헤더 GUID 9자리 (변경 없음)
    private final HostAddressProvider host;
    private final java.util.function.IntFunction<String> randomDigits; // 섹션용 길이 인자 난수
    private final java.util.List<EaiPayloadSection> sections;          // 개별부 전략 레지스트리
    private final Charset cs;

    public EaiMessageBuilder(EaiProperties props, Clock clock, Supplier<String> guidRandom,
                             HostAddressProvider host,
                             java.util.function.IntFunction<String> randomDigits,
                             java.util.List<EaiPayloadSection> sections) {
        this.props = props;
        this.clock = clock;
        this.guidRandom = guidRandom;
        this.host = host;
        this.randomDigits = randomDigits;
        this.sections = sections;
        this.cs = Charset.forName(props.charset());
    }
```

(b) `build(EaiRequest req)` 재배선. 기존 build()의 `param07Ums(req)` 호출과 `param02(req)` 호출을 섹션 위임으로 교체:

기존 build() 본문 시작부:
```java
    public byte[] build(EaiRequest req) {
        String p01 = param01();
        String p02 = param02(req);
        String p03 = param03();
        String p04 = param04();
        String p05 = param05();
        String p06 = param06();
        String p07 = param07Ums(req);
        String p08 = "@@";
```
교체:
```java
    public byte[] build(EaiRequest req) {
        com.kdb.it.infra.eai.dto.EaiPayload payload = req.payload();
        EaiPayloadSection section = sections.stream()
                .filter(s -> s.supports(payload))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException(
                        "지원하지 않는 EAI 페이로드: " + payload.getClass().getSimpleName()));
        EaiSectionContext ctx = new EaiSectionContext(cs, props, this::date, randomDigits);

        String p01 = param01();
        String p02 = param02(section.systemCode(), req.ifId());
        String p03 = param03();
        String p04 = param04();
        String p05 = param05();
        String p06 = param06();
        String p07 = section.build(payload, ctx);
        String p08 = "@@";
```
(build()의 나머지 — 길이필드 계산 + param 조립 + getBytes — 그대로 둔다.)

(c) `param02` 시그니처 변경: `private String param02(EaiRequest req)` → `private String param02(String rmsSysC, String ifId)`. 본문에서 `req.getSystem()` → `rmsSysC`, `req.getIfId()` → `ifId` 두 곳만 교체. 나머지 라인 불변.

기존:
```java
    private String param02(EaiRequest req) {
        String reqDtm = date("yyyyMMddHHmmssSSS");
        String trSlsDt = date("yyyyMMdd");
        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "C", 10, ""));             // TR_ID                 거래 ID
        p.append(lpad(cs, "C", 3, req.getSystem())); // RMS_SYS_C             수신시스템코드 (UMS)
```
교체(시그니처 + 두 줄):
```java
    private String param02(String rmsSysC, String ifId) {
        String reqDtm = date("yyyyMMddHHmmssSSS");
        String trSlsDt = date("yyyyMMdd");
        StringBuilder p = new StringBuilder();
        p.append(lpad(cs, "C", 10, ""));             // TR_ID                 거래 ID
        p.append(lpad(cs, "C", 3, rmsSysC));         // RMS_SYS_C             수신시스템코드
```
그리고 param02 내 IF_ID 줄:
```java
        p.append(lpad(cs, "C", 12, req.getIfId()));  // IF_ID                 인터페이스ID
```
→
```java
        p.append(lpad(cs, "C", 12, ifId));           // IF_ID                 인터페이스ID
```

(d) `param07Ums(...)` 메서드 전체와 `variableDataJson(...)` + `escape(...)` + `UM_KEYS` 상수를 **삭제**(UmsPayloadSection으로 이전됨). `import com.kdb.it.infra.eai.dto.EaiRequest;`는 유지(build 시그니처). `date()`/`lpad()`/param01·03·04·05·06은 그대로.

> 주의: `bytes()` private 메서드는 build()의 길이필드 계산(`bytes(p01 + ...)`)에서 계속 쓰이므로 **유지**한다. param07Ums에서만 쓰던 다른 헬퍼가 있으면 미사용 경고 확인 후 정리.

- [ ] **Step 3: EaiService 마이그레이션**

생성자에 `sections`/`randomDigits` 주입을 추가하고 빌더 생성을 갱신, 로깅 필드를 페이로드 무관하게 변경.

기존 생성자:
```java
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
```
교체:
```java
    public EaiService(EaiProperties props,
                      @Qualifier("eaiRestClient") RestClient restClient,
                      Clock eaiClock,
                      @Qualifier("eaiGuidRandom") Supplier<String> guidRandom,
                      HostAddressProvider host,
                      @Qualifier("eaiRandomDigits") java.util.function.IntFunction<String> randomDigits,
                      java.util.List<EaiPayloadSection> sections) {
        this.props = props;
        this.restClient = restClient;
        this.charset = Charset.forName(props.charset());
        this.builder = new EaiMessageBuilder(props, eaiClock, guidRandom, host, randomDigits, sections);
    }
```

로깅: `request.getIfId()` → `request.ifId()`, `request.getUmsBzDttId()` → `request.payload().getClass().getSimpleName()` (4곳). 예:
```java
            log.warn("EAI 전문 조립 실패: ifId={}, payload={}, 사유={}",
                    request.ifId(), request.payload().getClass().getSimpleName(), e.getMessage());
```
```java
            log.info("EAI 비활성화(eai.enabled=false) — 전송 스킵. ifId={}, payload={}, len={}바이트, 미리보기=[{}]",
                    request.ifId(), request.payload().getClass().getSimpleName(), message.length, maskedPreview(message));
```
```java
            log.info("EAI 전송 성공: ifId={}, payload={}, reqLen={}바이트",
                    request.ifId(), request.payload().getClass().getSimpleName(), message.length);
```
```java
            log.warn("EAI 전송 실패: ifId={}, payload={}, 사유={}",
                    request.ifId(), request.payload().getClass().getSimpleName(), e.getMessage());
```
빌드 실패 catch에 `IllegalArgumentException`(섹션 없음)도 포함:
```java
        } catch (IllegalArgumentException | IndexOutOfBoundsException | NumberFormatException e) {
```

- [ ] **Step 4: EpamsReferenceMessageBuilder 마이그레이션 (UmsPayload 입력)**

`buildUms(EaiRequest req)`의 입력을 `(UmsPayload u, String ifId)`로 바꾸고, 내부 `req.getXxx()`를 `u.xxx()`/`ifId`로, `req.getSystem()`은 `"UMS"` 리터럴로 교체. p02의 RMS_SYS_C는 `"UMS"`, IF_ID는 `ifId`. p07은 UmsPayload 게터 사용. (필드 레이아웃·pad·json은 불변.)

시그니처:
```java
    byte[] buildUms(com.kdb.it.infra.eai.dto.UmsPayload u, String ifId) {
```
p02 내부 `pad("C", 3, req.getSystem())` → `pad("C", 3, "UMS")`, `pad("C", 12, req.getIfId())` → `pad("C", 12, ifId)`.
p07 내부 `req.getUmsBzDttId()` → `u.umsBzDttId()`, `req.getEmplNum()` → `u.emplNum()`, `req.getReqCh()` → `u.reqCh()`, `req.getSendDt()` → `u.sendDt()`, `req.getSendTime()` → `u.sendTime()`, `req.getUmsTrSno()` → `u.umsTrSno()`, `req.getCstNm()` → `u.cstNm()`, `req.getDeptKey()` → `u.deptKey()`, `req.getDeptNm()` → `u.deptNm()`. json()의 `req.getUmDataN()` → `u.umDataN()`. (이스케이프에 `\n\r\t` 포함되어 있는지 확인 — UmsPayloadSection.escape와 동일해야 함.)

- [ ] **Step 5: EaiMessageBuilderTest 마이그레이션 + UMS 골든 테스트**

(a) 공유 픽스처/빌더 생성을 신규 API로:
```java
    private static EaiMessageBuilder fixedBuilderNew() {
        return new EaiMessageBuilder(fixedProps(), fixedClock(), () -> "000000001", fixedHost(),
                len -> "1".repeat(len),
                java.util.List.of(new UmsPayloadSection(), new GwePayloadSection()));
    }
    private static com.kdb.it.infra.eai.dto.UmsPayload fixedSmsPayload() {
        return com.kdb.it.infra.eai.dto.UmsPayload.builder()
                .umsBzDttId("SMS2096").umsTrSno("7").emplNum("K1234567").cstNm("홍길동")
                .reqCh("01012345678").deptKey("182").deptNm("디지털금융부").umData1("123456").build();
    }
    private static com.kdb.it.infra.eai.dto.EaiRequest fixedSmsRequest() {
        return com.kdb.it.infra.eai.dto.EaiRequest.ums("IPPO00012345", fixedSmsPayload());
    }
```
(b) 기존 `BuildSmoke`/`EpamsEquivalence`의 빌더를 `fixedBuilderNew()`로, request를 `EaiRequest.ums(...)`로, reference 호출을 `new EpamsReferenceMessageBuilder(...).buildUms(fixedSmsPayload(), "IPPO00012345")`로 교체. (알림톡 케이스도 `EaiRequest.ums("IPPO00012345", UmsPayload.builder().umsBzDttId("ALT0165")....build())` + reference는 그 payload/ifId로.)
(c) lpad 정적 테스트는 변경 없음.
(d) 골든 회귀 테스트 추가:
```java
    @org.junit.jupiter.api.Nested
    @DisplayName("UMS 골든 회귀")
    class UmsGolden {
        @Test
        @DisplayName("리팩터링 후에도 캡처된 골든 바이트와 100% 일치")
        void matchesGolden() throws Exception {
            byte[] golden = java.util.Base64.getDecoder().decode(
                    java.nio.file.Files.readString(
                            java.nio.file.Path.of("src/test/resources/eai/ums-golden.b64")).trim());
            byte[] actual = fixedBuilderNew().build(fixedSmsRequest());
            assertThat(actual).isEqualTo(golden);
        }
    }
```

- [ ] **Step 6: EaiServiceTest 마이그레이션 + GWE 발송**

(a) `service(props, client)` 헬퍼가 신규 생성자 사용:
```java
    private EaiService service(EaiProperties props, RestClient client) {
        return new EaiService(props, client, fixedClock(), () -> "000000001", host(),
                len -> "1".repeat(len),
                java.util.List.of(new UmsPayloadSection(), new GwePayloadSection()));
    }
```
(b) `req()` → `EaiRequest.ums("IPPO00012345", UmsPayload.builder()....build())`. 빌드오버플로 케이스의 `emplNum("K12345678")`도 UmsPayload로.
(c) GWE 발송 테스트 추가:
```java
    @Test
    @DisplayName("GWE 메일 발송 — octet-stream 전송 성공")
    void gwe_mail_sends() {
        RestClient.Builder builder = RestClient.builder().baseUrl("http://eai.test");
        MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
        server.expect(requestTo("http://eai.test/eai")).andExpect(method(POST))
                .andRespond(withSuccess("RES-OK".getBytes(MS949), MediaType.APPLICATION_OCTET_STREAM));
        RestClient client = builder.build();
        EaiProperties props = new EaiProperties(true, "http://eai.test/eai", "MS949", 3000, 3000, "L", "IPP", "IPP", "PRM", "PP");
        EaiRequest gwe = EaiRequest.gwe("IPPG00000001", com.kdb.it.infra.eai.dto.GwePayload.builder()
                .msgGubun("3").recvIds("k0001,k0002").subject("공지").contents("<p>본문</p>").build());
        EaiResult r = service(props, client).sendEai(gwe);
        server.verify();
        assertThat(r.success()).isTrue();
    }
```

- [ ] **Step 7: 전체 EAI 테스트 실행 (green)**

Run: `./gradlew test --tests "com.kdb.it.infra.eai.*"`
Expected: 전부 PASS — lpad, build 스모크, UMS 동일성, **UMS 골든**, GWE 동일성, 서비스(UMS+GWE), EaiResult.
골든 불일치 시 → 헤더/UMS 개별부 레이아웃이 바뀐 것이므로 Step 2의 param02/섹션 이전을 재점검.

- [ ] **Step 8: Commit**

```bash
git add it_backend/src/main/java/com/kdb/it/infra/eai it_backend/src/test/java/com/kdb/it/infra/eai
git commit -m "refactor(eai): 개별부 SPI 컷오버 — EaiRequest record + 섹션 위임, UMS 골든/동일성 유지"
```

---

## Task 7: 전체 검증 + TASK.md

**Files:**
- Modify: `TASK.md` (루트 repo `C:\it`)

- [ ] **Step 1: 전체 clean test**

Run: `(cd it_backend && ./gradlew clean test)`
Expected: BUILD SUCCESSFUL, 컨텍스트 로딩 시 `UmsPayloadSection`/`GwePayloadSection`/`eaiRandomDigits` 빈 정상 주입, EAI 전부 green, 기존 1000+ 테스트 무회귀.

- [ ] **Step 2: TASK.md 후속 과제 추가 (루트 repo)**

`C:\it\TASK.md`의 EAI 섹션에 추가:
```markdown
- [ ] (플러그형) GWE `RMS_SYS_C`("GWE")·`IF_ID`·`MSG_KEY` 접두("mailt") 실제 규칙 KDB 확인. GWE 발신자 상수(systemalert/관리자)·SYSTEM_CODE 운영값 확인.
- [ ] 신규 시스템 연동 시 EaiPayload(record) + EaiPayloadSection(@Component) 1쌍 추가 패턴 따름.
```
Commit (루트 repo): `git -C C:/it add TASK.md && git -C C:/it commit -m "docs(eai): 플러그형 개별부 후속 과제 등록"`

- [ ] **Step 3: 최종 commit 확인 (백엔드 repo)**

Run: `git -C it_backend log --oneline -7`
Expected: Task1~6 커밋 확인.

---

## Self-Review (작성자 점검 완료)

**Spec coverage:**
- §2 SPI/컨텍스트/디스패치 → Task 3·6. ✅
- §3 데이터 모델(sealed/records/EaiRequest) → Task 2·6. ✅
- §4 GWE 필드 매핑 + 4.1 난수 시임 → Task 4·5. ✅
- §5 데이터 흐름(섹션 위임, systemCode→RMS_SYS_C, ifId→IF_ID) → Task 6. ✅
- §6 오류 처리(섹션 없음→failure 등) → Task 6 Step3. ✅
- §7 테스트 4겹(골든/UMS동일성/GWE동일성/서비스) → Task 1·4·6. ✅
- §8 마이그레이션 → Task 6. ✅

**Placeholder scan:** 모든 코드 스텝 실제 코드. ✅ (param01/03/04/05/06·build 길이필드는 "변경 없음"으로 명시 — 기존 파일 유지.)

**Type consistency:**
- `EaiSectionContext(cs, props, dateFn, randomDigits)` + 메서드 lpad/date/bytes: Task 3 정의 ↔ UmsPayloadSection/GwePayloadSection/참조빌더 사용 일치. ✅
- `EaiPayloadSection.supports/systemCode/build`: Task 3 정의 ↔ 구현체·빌더 디스패치 일치. ✅
- `EaiMessageBuilder(props,clock,guidRandom,host,randomDigits,sections)`: Task 6 정의 ↔ EaiService/테스트 사용 일치. ✅
- `EaiRequest.ums/gwe`, `EaiRequest.ifId()/payload()`: Task 6 정의 ↔ 서비스/테스트 사용 일치. ✅
- `UmsPayload`/`GwePayload` 게터(record 접근자): Task 2 정의 ↔ 섹션·참조빌더 사용 일치. ✅

**알려진 가정/리스크:**
- 골든 캡처(Task 1)는 현재 flat API로, 검증(Task 6)은 신규 API로 — 동일 필드값이므로 바이트 동일 전제. 첫 컷오버에서 불일치 시 param02/섹션 이전 오류 신호(의도된 가드).
- GWE 참조는 주석 원본 전사 → 구조 일관성 증명(실행본 대조 아님, KDB 확인 캐비엇 §10).
