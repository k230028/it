# EAI 개별부 플러그형 구조 설계서 (멀티 시스템 연동: UMS + GWE)

- **작성일**: 2026-06-07
- **상태**: 설계 승인 완료 (구현 계획 수립 대기)
- **선행 작업**: `2026-06-07-eai-integration-design.md` (EAI 표준전문 포팅, UMS 구현 완료)
- **참조 구현**: ePAMS `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\service\EaiService.java`
  - `getParamUMS` (구현됨) / `getParamGWE` (주석 처리된 원본, 메신저·메일)

---

## 1. 목적 및 범위

EAI 표준전문의 **개별부(param07)만 교체**하여 하나의 공유 헤더/전송 인프라로 **다양한 시스템과 연동**할 수 있도록
`EaiMessageBuilder`를 SPI 기반으로 구조 개선한다. 신규 채널로 **GWE(그룹웨어 메신저/메일)**를 추가한다.

### 1.1 결정된 방향 (브레인스토밍 합의)

| 항목 | 결정 |
|------|------|
| 요청/SPI 모델 | **Sealed 페이로드 + 공통헤더 + SPI 레지스트리** |
| GWE 범위 | **메신저(1) + 메일(3) 둘 다** |
| 헤더 | param01~06, 08 + 길이필드 — **공유, 무변경** |
| 개별부 | `EaiPayloadSection` SPI로 분리, 페이로드 타입으로 디스패치 |
| 회귀 보증 | UMS 출력 **바이트 골든** + 기존 동일성 테스트 유지 |

### 1.2 범위 외 (Non-goals)

- `NotificationDispatcher` 실연동 (별도 과제).
- GWE 발송이력 DB 저장(ePAMS `insertNotificationSendHistory`) — 전문 발송에 불필요.
- 헤더(param01~06) 필드 레이아웃 변경 — 절대 변경 금지(회귀).

---

## 2. 아키텍처 및 컴포넌트

```
com.kdb.it.infra.eai/
├── dto/
│   ├── EaiPayload.java          // sealed interface permits UmsPayload, GwePayload
│   ├── UmsPayload.java          // record (@Builder) — 기존 UMS 필드
│   ├── GwePayload.java          // record (@Builder) — GWE 필드 (메신저+메일)
│   ├── EaiRequest.java          // record { String ifId, EaiPayload payload } + 팩토리 ums()/gwe()
│   └── EaiResult.java           // (변경 없음)
├── service/
│   ├── EaiPayloadSection.java   // SPI: supports / systemCode / build
│   ├── EaiSectionContext.java   // record — 섹션 공유 유틸 (cs, props, date, randomDigits, lpad)
│   ├── UmsPayloadSection.java   // @Component — 기존 param07Ums 이동
│   ├── GwePayloadSection.java   // @Component — 신규 (getParamGWE 포팅)
│   ├── EaiMessageBuilder.java   // 헤더 + 섹션 위임
│   └── HostAddressProvider.java // (변경 없음)
└── config/
    └── EaiInfraConfig.java      // randomDigits 시임 빈 추가 (8/9자리 공용)
```

### 2.1 SPI 계약

```java
/** 표준전문 개별부(param07) 채널 1개를 책임지는 전략. 무상태 빈으로 구현. */
public interface EaiPayloadSection {
    /** 이 섹션이 처리할 수 있는 페이로드인지. */
    boolean supports(EaiPayload payload);
    /** 헤더 거래공통부 RMS_SYS_C 값 (예: "UMS", "GWE"). */
    String systemCode();
    /** 개별부 문자열 조립 (전송 전, charset 미적용). */
    String build(EaiPayload payload, EaiSectionContext ctx);
}
```

```java
/** 섹션이 필요로 하는 공유 도구 묶음. EaiMessageBuilder가 호출 시점에 구성. */
public record EaiSectionContext(
        java.nio.charset.Charset cs,
        com.kdb.it.infra.eai.config.EaiProperties props,
        java.util.function.UnaryOperator<String> dateFn,   // pattern -> 시각문자열 (Clock 시임)
        java.util.function.IntFunction<String> randomDigits // len -> 0패딩 난수 (SecureRandom 시임)
) {
    /** 좌측 패딩 (EaiMessageBuilder.lpad 위임). */
    public String lpad(String type, int offset, String str) {
        return EaiMessageBuilder.lpad(cs, type, offset, str);
    }
    public String date(String pattern) { return dateFn.apply(pattern); }
    public int bytes(String s) { return s.getBytes(cs).length; }
}
```

### 2.2 책임 분리

- **`EaiMessageBuilder`** — 헤더 6부 + 종료부 + 길이필드(공통). 페이로드 타입으로 섹션 선택 →
  `section.systemCode()`(param02 RMS_SYS_C)와 `section.build()`(param07) 호출.
- **`EaiPayloadSection` 구현체** — 채널 1개의 개별부 + 그 채널 systemCode. **신규 시스템 = record 1개 + Section 1개 추가**(헤더/서비스 무수정).
- **`EaiSectionContext`** — charset/props/시각·난수 시임/lpad를 한 객체로 전달 → 섹션은 무상태, 결정성 시임 보존.

### 2.3 주입 흐름

`EaiService`가 Spring으로 `List<EaiPayloadSection>`을 받아 `EaiMessageBuilder` 생성자에 전달
(기존 props/clock/guidRandom/host와 함께). 섹션은 `@Component` 무상태 빈.

```java
public EaiMessageBuilder(EaiProperties props, Clock clock, Supplier<String> guidRandom,
                         HostAddressProvider host, java.util.function.IntFunction<String> randomDigits,
                         List<EaiPayloadSection> sections) { ... }
```

---

## 3. 데이터 모델

### 3.1 EaiPayload (sealed)

```java
public sealed interface EaiPayload permits UmsPayload, GwePayload {}
```

### 3.2 UmsPayload (record, 기존 UMS 필드)

`umsBzDttId, umsTrSno, emplNum, cstNm, reqCh, deptKey, deptNm, sendDt, sendTime, umData1~7`
(기존 `EaiRequest`의 UMS 필드를 그대로 이전. `system`/`ifId`는 제외 — 헤더/섹션으로 이동.)

### 3.3 GwePayload (record, 신규)

| 필드 | 기본값 | 용도 |
|------|--------|------|
| `msgGubun` | (필수) | `"1"`=메신저 / `"3"`=메일 |
| `recvIds` | (필수) | 수신자 사번/부서코드 콤마목록 |
| `subject` | "" | 제목 |
| `contents` | "" | 본문(HTML, 치환 완료본) |
| `destGubun` | `"1"` | `"1"`=사용자 / `"2"`=부서 |
| `url` | "" | 메신저 클릭 URL |
| `ccRecvIds` | "" | 메일 참조 |
| `bccRecvIds` | "" | 메일 숨은참조 |
| `attFlag` | "" | 메일 첨부여부 |
| `att` | "" | 메일 첨부정보 |
| `sendId` | `"systemalert"` | 전송자 사번 |
| `sendName` | `"관리자"` | 전송자 이름 |

null→기본값 보정은 record compact constructor에서 처리. `@Builder`(Lombok)로 생성 편의 제공.

### 3.4 EaiRequest (record)

```java
public record EaiRequest(String ifId, EaiPayload payload) {
    public static EaiRequest ums(String ifId, UmsPayload p) { return new EaiRequest(ifId, p); }
    public static EaiRequest gwe(String ifId, GwePayload p) { return new EaiRequest(ifId, p); }
}
```

---

## 4. GWE 개별부 필드 매핑 (ePAMS getParamGWE → IT Portal)

| 필드 (길이, lpad) | 출처 | IT Portal 값 |
|---|---|---|
| `MSG_KEY` (32, C) | 생성 | `"mailt"` + `props.appC()`(PRM,3) + `props.appBzLv1C()`(PP,2) + 일시(yyyyMMddHHmmss,14) + 난수(8) = 32 |
| `MSG_GUBUN` (1, C) | payload | `msgGubun` |
| `SEND_ID` (50, C) | payload | `sendId` (기본 systemalert) |
| `SEND_NAME` (100, C) | payload | `sendName` (기본 관리자) |
| `DEST_GUBUN` (1, C) | payload | `destGubun` (기본 1) |
| `RECV_IDS` (4000, C) | payload | `recvIds` |
| `CC_RECV_IDS` (500, C) | payload | `ccRecvIds` |
| `BCC_RECV_IDS` (500, C) | payload | `bccRecvIds` |
| `SUBJECT` (200, C) | payload | `subject` |
| `CONTENTS` (4000, C) | payload | `contents` |
| `URL` (500, C) | payload | `url` |
| `ATT_FLAG` (1, C) | payload | `attFlag` |
| `ATT` (4000, C) | payload | `att` |
| `SYSTEM_CODE` (3, C) | props | `props.fwdiSysC()` = IPP |

- 필드 순서/길이는 ePAMS `getParamGWE` 주석 원본을 그대로 따른다.
- **헤더 RMS_SYS_C** = `GwePayloadSection.systemCode()` = `"GWE"`.
- ⚠ **KDB 확인 필요**: UMS/GWE의 실제 `RMS_SYS_C` 값, GWE `IF_ID`, `MSG_KEY` 접두("mailt") 규칙 — `TASK.md` 등록.

### 4.1 난수 시임 (헤더 미변경 원칙)

- **헤더 GUID는 기존 `guidRandom`(9자리 `Supplier<String>`) 시임을 그대로 사용** — 헤더 코드/시임 무변경 → 바이트 회귀 위험 0.
- GWE `MSG_KEY`의 8자리 난수를 위해 **별도 신규 시임** `IntFunction<String> randomDigits`(len→0패딩)를 추가. **섹션 전용**(헤더는 건드리지 않음).
- `EaiInfraConfig`에 `eaiRandomDigits` 빈 추가(`SecureRandom` 기반). 테스트에선 고정 주입.
- `EaiMessageBuilder`는 `guidRandom`(헤더용, 기존)과 `randomDigits`(섹션 컨텍스트용, 신규)를 모두 보유.

---

## 5. 데이터 흐름

```
호출자 → EaiRequest.gwe("IPPO...", GwePayload.builder()
                 .msgGubun("3").recvIds("k0001,k0002").subject("제목").contents("<p>본문</p>").build())
      → eaiService.sendEai(request)
      → EaiMessageBuilder.build(request):
           section = sections에서 supports(payload) 매칭 (GwePayloadSection)
           ctx    = new EaiSectionContext(cs, props, this::date, this::randomDigits)
           헤더 param01~06 (param02: RMS_SYS_C = section.systemCode(), IF_ID = request.ifId())
           param07 = section.build(payload, ctx)
           param08 = "@@" + 길이필드 3종
      → enabled=false면 빌드+마스킹 로깅 후 skip / true면 RestClient octet-stream 전송
      → EaiResult
```

---

## 6. 오류 처리

| 상황 | 결과 |
|------|------|
| 페이로드 매칭 섹션 없음 | `EaiResult.failure("지원하지 않는 페이로드: ...")` |
| 개별부 빌드 실패 (`IndexOutOfBoundsException`/`NumberFormatException`) | `EaiResult.failure(...)` |
| `enabled=false` | `EaiResult.skip()` + 마스킹 로깅 |
| 전송 IOException/타임아웃 | `EaiResult.failure(...)` |

- 전부 비차단(부수효과 원칙). 민감정보 마스킹 로깅 유지 — GWE 본문/수신자도 개별부 구간이라 마스킹 경계 내.

---

## 7. 테스트 전략 (4겹)

1. **UMS 회귀 골든 (최우선)** — 리팩터링 *전* 고정 시드 UMS 전문(11,014바이트)을 캡처해 **골든 16진 픽스처**로 저장.
   리팩터링 후 `EaiMessageBuilder.build(EaiRequest.ums(...))`가 **바이트 100% 일치**함을 단언.
   → SPI 분리가 UMS 출력을 한 바이트도 바꾸지 않음을 증명.
2. **UMS 동일성 (기존 유지)** — `EpamsReferenceMessageBuilder`를 신규 요청 형태로 맞춘 뒤 신규 빌더와 byte 동일성 유지.
3. **GWE 동일성 (신규)** — 테스트 전용 `EpamsGweReferenceBuilder`(getParamGWE 필드 레이아웃 전사) vs
   `GwePayloadSection` 출력 byte 동일성. **메신저(1)·메일(3) 두 픽스처.**
   ⚠ 원본 getParamGWE는 주석/비실행 → 참조는 필드명세 전사본(구조 일관성 증명).
4. **레지스트리/디스패치 + 서비스** — UmsPayload→UmsPayloadSection, GwePayload→GwePayloadSection 라우팅 단위 테스트,
   미지원 페이로드→failure, `EaiServiceTest`에 GWE 발송(MockRestServiceServer) 추가. 기존 UMS 서비스 테스트 마이그레이션.

전체 `./gradlew clean test` 통과.

---

## 8. 마이그레이션 (파괴적 변경, 내부 한정)

- `EaiRequest.builder().system("UMS").umsBzDttId(...)...` → `EaiRequest.ums(ifId, UmsPayload.builder()...)`.
- `system`(→ 섹션 systemCode), `ifId`(→ EaiRequest), UMS 필드(→ UmsPayload)로 이동.
- 영향: `EaiMessageBuilderTest`, `EaiServiceTest`, `EpamsReferenceMessageBuilder` 픽스처. (EAI 모듈은 신규 — 외부 호출자 없음.)

---

## 9. 산출물 요약

| 파일 | 구분 | 책임 |
|------|------|------|
| `dto/EaiPayload.java` | 신규 | sealed 마커 |
| `dto/UmsPayload.java` | 신규 | UMS 페이로드 record |
| `dto/GwePayload.java` | 신규 | GWE 페이로드 record |
| `dto/EaiRequest.java` | 교체 | { ifId, payload } + 팩토리 |
| `service/EaiPayloadSection.java` | 신규 | SPI |
| `service/EaiSectionContext.java` | 신규 | 섹션 공유 컨텍스트 |
| `service/UmsPayloadSection.java` | 신규 | UMS 개별부 (param07Ums 이동) |
| `service/GwePayloadSection.java` | 신규 | GWE 개별부 |
| `service/EaiMessageBuilder.java` | 수정 | 헤더 + 섹션 위임 |
| `config/EaiInfraConfig.java` | 수정 | randomDigits 빈 추가 |
| `service/EaiService.java` | 수정 | List<EaiPayloadSection> 주입 전달 |
| `test/.../EpamsReferenceMessageBuilder.java` | 수정 | 신규 요청 형태 |
| `test/.../EpamsGweReferenceBuilder.java` | 신규 | GWE 전사 오라클 |
| `test/.../UmsGoldenTest.java` | 신규 | UMS 골든 회귀 |
| `test/.../GwePayloadSectionTest.java` | 신규 | GWE 동일성 |
| `test/.../EaiMessageBuilderTest.java`, `EaiServiceTest.java` | 수정 | 마이그레이션 + GWE 추가 |

## 10. 후속 과제 (TASK.md)

- KDB EAI 운영팀: UMS/GWE `RMS_SYS_C` 실제값, GWE `IF_ID`, `MSG_KEY` 접두 규칙 확정.
- GWE 발신자 상수(`systemalert`/`관리자`)·SYSTEM_CODE의 운영값 확인.
