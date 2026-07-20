# EAI 통합 설계서 (KDB 표준전문 발송)

- **작성일**: 2026-06-07
- **상태**: 설계 승인 완료 (구현 계획 수립 대기)
- **참조 구현**: ePAMS
  - `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\service\EaiService.java`
  - `D:\workspace\ePAMS\src\main\java\epams\domain\com\eai\dto\EaiDTO.java`
  - `D:\workspace\ePAMS\src\main\java\epams\domain\com\login\service\MFALoginService.java`

---

## 1. 목적 및 범위

ePAMS의 EAI 호출/구현 로직을 참고하여, IT Project Portal 백엔드에 **KDB 표준전문(고정길이 전문)을
EAI 게이트웨이로 전송하는 범용 EaiService**를 포팅한다.

### 1.1 결정된 방향 (브레인스토밍 합의)

| 항목 | 결정 | 비고 |
|------|------|------|
| 용도 | **범용 EaiService 포팅** | 알림 파이프라인(`NotificationDispatcher`)과 **분리**. 어디서든 직접 호출 가능. 향후 MFA/OTP 등 확장 여지. |
| 개별부(입력데이터) | **UMS만** (SMS/알림톡/이메일) | ePAMS `getParamUMS` 포팅. GWE(그룹웨어 메신저/메일)는 범위 외. |
| HTTP 클라이언트 | **Spring RestClient** | `application/octet-stream` raw `byte[]` POST/응답. `infra/ai` 외부호출 컨벤션과 일치. |
| 인코딩 | **명시적 MS949** | 고정길이 전문 한글 2바이트. `lpad` 길이계산이 `getBytes(MS949)` 기반. 한 곳에 중앙화. |
| 개발/비운영 동작 | **설정 플래그 + 전문 로깅** | `eai.enabled=false`면 전문 빌드·로깅만, 실제 HTTP 전송 스킵. |
| 충실성 검증 | **바이트 동일성 테스트** | ePAMS 참조 조립(전사본) vs 신규 빌더 결과 `byte[]` 완전 일치. |

### 1.2 범위 외 (Non-goals)

- `NotificationDispatcher` SPI 실연동 (별도 과제). 본 설계는 독립 `EaiService` 포팅에 한정.
- GWE(그룹웨어) 개별부 빌더.
- MFA/OTP 로그인 흐름 구현 (현재 프로젝트에 없음). EaiService는 향후 그런 흐름이 추가될 때 호출 가능한 형태로만 준비.

---

## 2. 아키텍처 및 패키지 배치

이 프로젝트는 외부 시스템 연동을 `infra/`에 둔다(`infra/ai` = Gemini 외부 API, `infra/file`).
EAI도 외부 게이트웨이로 raw byte를 POST하는 outbound 연동이므로 동일하게 배치한다.
(ePAMS는 `epams.domain.com.eai`에 두었으나 본 프로젝트 컨벤션을 따른다.)

```
com.kdb.it.infra.eai/
├── config/
│   ├── EaiProperties.java          // @ConfigurationProperties("eai")
│   └── EaiRestClientConfig.java    // EAI 전용 RestClient 빈 (octet-stream, 타임아웃)
├── dto/
│   ├── EaiRequest.java             // UMS 발송 요청 (@Builder, 기본값 포함)
│   └── EaiResult.java              // record(boolean success, boolean skipped, String responseRaw, String errorMessage)
└── service/
    ├── EaiService.java             // sendEAI(request): 빌드 → RestClient 전송 → EaiResult
    ├── EaiMessageBuilder.java      // 표준전문(param01~08) 조립 + lpad + MS949 길이계산
    └── HostAddressProvider.java    // IP/MAC 공급 (운영 빈 / 테스트 고정)
```

### 2.1 핵심 분리 원칙

ePAMS는 `EaiService` 한 파일(약 800줄)에 **전문 조립 + HTTP 전송 + 시각/난수/IP·MAC 생성**이 뒤섞여
단위 테스트가 불가능하다. 본 설계는 다음을 분리한다.

- **`EaiMessageBuilder`** — 전문 조립만 담당(순수 함수에 가깝게). 게이트웨이 없이 바이트 정합성 테스트 가능.
- **`EaiService`** — 전송 오케스트레이션(설정 분기, RestClient 호출, 결과/로그/실패 처리).
- **결정성 시임** — 시각/난수/IP·MAC를 주입 가능하게 하여 충실성을 깨지 않으면서 테스트 가능성만 추가.

---

## 3. 데이터 흐름 및 전문 조립 충실도

### 3.1 데이터 흐름

```
호출자 → EaiRequest(@Builder) → EaiService.sendEAI()
            │                         │
            │                         ├─ enabled=false → 전문 빌드+로깅, HTTP 스킵 → EaiResult.skipped()
            │                         │
   EaiMessageBuilder.build()          └─ enabled=true  → RestClient POST(octet-stream, byte[])
            │                                                │
   byte[] 표준전문 (MS949)                            EaiResult(success, responseRaw)
```

### 3.2 전문 조립 충실도

`param01`(시스템공통부) ~ `param08`(종료부)을 ePAMS와 **필드·오프셋·기본값 그대로** 옮긴다.

- 길이 3종 계산 후 `param01` 앞 24자리 교체:
  - `WHL_TGR_LEN` 전체전문길이 (param01~08)
  - `HER_LEN` 헤더길이 (param01~06)
  - `PRO_MDA_LEN` 출력매체부길이 (param06)
- `lpad(type, offset, str)` 패딩 규칙 동일 (`"C"`→공백 패딩, 그 외→`"0"` 패딩, 초과 시 `IndexOutOfBoundsException`).
- 개별부는 `getParamUMS` 포팅: `UMS_BZ_DTT_ID`, `TR_DT`, `UMS_TR_SNO`, `UMS_RET_NO`(템플릿ID(7)+연월일(8)+일련번호(8)),
  수신자/요청자 정보, `UMS_SD_CHN_TP_C`(S/A/M), 가변데이터 JSON(`UM_DATA_1..7`) 등.

#### 변경점 (단 한 가지)

`str.getBytes()` → `str.getBytes(MS949)`를 **`EaiMessageBuilder`의 charset 상수 한 곳**으로 모은다.
ePAMS는 플랫폼 기본 charset에 의존(환경마다 길이계산이 달라질 위험). 본 설계는 MS949를 명시.

### 3.3 결정성 시임 (동일성 검증의 전제조건)

전문에는 비결정적 필드가 섞여 있다. 이를 잡지 않으면 어떤 비교 테스트도 매 실행마다 깨진다.

| 비결정 필드 | 시임 |
|------------|------|
| GUID (`{eai.fwdi-sys-c=IPP}`+yyyyMMdd+HHmmssSSS+rand9+rand9), 요청일시 `REQ_DTM`, 거래일자/시각 `TR_DT`/`TR_TM` | `java.time.Clock` |
| GUID 난수부 | `Supplier<String> guidRandom` |
| IP/MAC | `HostAddressProvider` |

```java
EaiMessageBuilder(EaiProperties props,
                  Clock clock,
                  Supplier<String> guidRandom,
                  HostAddressProvider host)
```

운영에선 실제 빈(시스템 시각/`SecureRandom`/`InetAddress`), 테스트에선 고정값 주입.

---

## 4. 동일성 검증 (특성화 테스트)

충실 포팅을 보증하는 핵심 테스트. ePAMS의 `getReqData` 조립 로직을 **그대로 전사한 참조 빌더**
`EpamsReferenceMessageBuilder`(테스트 전용, 동결)를 `src/test`에 둔다.

두 빌더에 **동일한 고정 입력**(같은 Clock/GUID난수/IP·MAC, 같은 `EaiRequest`, 같은 MS949)을 주입하고
결과 `byte[]`가 완전히 일치함을 단언한다.

```java
@Test
@DisplayName("새 EaiMessageBuilder는 ePAMS 참조 조립과 바이트 단위로 동일하다")
void newBuilder_matchesEpamsReference_byteForByte() {
    byte[] reference = epamsReference.buildUms(fixedRequest); // ePAMS 로직 전사본
    byte[] actual    = messageBuilder.build(fixedRequest);    // 신규 모듈화 빌더
    assertThat(actual).isEqualTo(reference);                  // 완전 일치
}
```

### 4.1 진단 보조 단언

실패 시 어느 구간이 어긋났는지 즉시 식별하기 위해 구간별 비교를 추가한다.

- 세 길이필드 (오프셋 0~23)
- 헤더부 (param01~06)
- 개별부 (param07, UMS)

각 구간 `new String(slice, MS949)` 비교.

### 4.2 의의

이 테스트가 통과하면 "HttpURLConnection→RestClient 전환, charset 중앙화, 파일 분리"가
**와이어 포맷을 한 바이트도 바꾸지 않았음**이 증명된다.

### 4.3 그 외 단위/통합 테스트

| 테스트 | 검증 |
|--------|------|
| `lpad` 패딩/오버플로 | `"C"` 공백·그 외 `"0"` 패딩, 초과 시 `IndexOutOfBoundsException` |
| MS949 한글 길이계산 | 한글 1자 = 2바이트, 길이필드 정합 |
| `enabled=false` | 전문 빌드·로깅 후 HTTP **미호출**, `EaiResult.skipped()` |
| `enabled=true` 전송 | `MockRestServiceServer`로 octet-stream `byte[]` 전송·응답 검증 |
| 전송 실패 | IOException/타임아웃 시 예외 전파 없이 `EaiResult.failure(...)` |

---

## 5. 설정 · 시스템식별자 · 실패 처리

### 5.1 `EaiProperties` (`@ConfigurationProperties("eai")`)

```properties
eai.enabled=false                  # 운영 프로파일에서만 true (개발/CI는 false → 전송 스킵)
eai.url=                           # 운영 게이트웨이 URL (운영 프로파일에서 환경변수 주입)
eai.charset=MS949                  # 고정길이 전문 인코딩
eai.connect-timeout=3000           # ms (ePAMS 3초)
eai.read-timeout=3000              # ms
# ── IT Portal 시스템 식별자 (확정: IPP / PRM / PP) ──────────────────────────
eai.fwdi-sys-c=IPP                 # 전송시스템코드 FWDI_SYS_C / FST_FWDI_SYS_C (3자리, GUID 접두로도 사용)
eai.bz-c-s3=IPP                    # 업무코드_S3 BZ_C_S3 (3자리)
eai.app-c=PRM                      # 어플리케이션코드 APP_C (3자리)
eai.app-bz-lv1-c=PP                # 어플리케이션업무1레벨코드 APP_BZ_LV1_C (2자리)
```

모든 시스템 식별자는 `EaiProperties`로 바인딩되어 **소스 하드코딩 없이 프로퍼티/프로파일로 관리**한다.
GUID 접두는 `eai.fwdi-sys-c` 값(IPP)을 사용한다(ePAMS가 `EHR` 시스템코드를 GUID 접두로 쓴 것과 동일 패턴).

### 5.2 시스템 식별자 매핑 (IT Portal: IPP / PRM / PP)

ePAMS의 `EHR`/`HUR`/`XH`는 ePAMS(인사 eHR) 시스템 식별자다. IT Portal은 아래 값을 사용하며,
모두 `EaiProperties`로 **프로퍼티 관리**한다(프로파일별 오버라이드 가능).

| ePAMS 필드 | ePAMS 값 | IT Portal 값 | 프로퍼티 |
|---|---|---|---|
| 전송시스템코드 `FWDI_SYS_C`/`FST_FWDI_SYS_C` (+ GUID 접두) | `EHR` (3) | **IPP** (3) | `eai.fwdi-sys-c` |
| 업무코드 `BZ_C_S3` | `EHR` (3) | **IPP** (3) | `eai.bz-c-s3` |
| 어플리케이션코드 `APP_C` | `HUR` (3) | **PRM** (3) | `eai.app-c` |
| 어플리케이션업무1레벨코드 `APP_BZ_LV1_C` | `XH` (2) | **PP** (2) | `eai.app-bz-lv1-c` |

- ePAMS가 `EHR`을 시스템코드·업무코드에 재사용한 패턴 그대로 **IPP**를 두 필드에 적용(3개 코드 → 4개 필드).
- ⚠ **여전히 KDB 발급 필요**: `ifId`(인터페이스ID)와 `umsBzDttId`(UMS업무구분ID/템플릿)는 시스템 식별자와
  별개로 KDB EAI 운영팀에서 발급받는 값이다. ePAMS처럼 **호출자가 `EaiRequest`에 지정**한다
  (예: SMS·알림톡 템플릿ID, 발송용 IF_ID). 실제 게이트웨이 연동 전 확정해야 함을 `TASK.md`에 등록한다.

### 5.3 실패 처리 (부수효과 원칙)

ePAMS는 빌드 실패 시 `null`, 전송 실패 시 빈 `new EaiDTO()`를 반환하는 어색한 패턴이다.
이를 `EaiResult` record로 정리한다.

| 상황 | 결과 | 비고 |
|------|------|------|
| 전문 빌드 실패 (`IndexOutOfBoundsException` = 필드 초과) | `EaiResult.failure(...)` | 예외 전파 안 함, 로그 |
| `enabled=false` | `EaiResult.skipped()` | 전문 MS949 빌드 후 로깅, HTTP 미호출 |
| 전송 IOException/타임아웃 | `EaiResult.failure(...)` | 로그만, 호출자 흐름 차단 금지 |
| 정상 | `EaiResult.success(responseRaw)` | |

- ePAMS의 `System.out.println` 다수 → SLF4J 로깅으로 교체.

### 5.4 보안

- raw 전문에 **휴대폰번호·OTP** 등 민감정보가 포함될 수 있음 → 디버그 로그 시 개별부 일부 **마스킹**
  (전문 전체 평문 로깅 금지). 자바 보안 규칙(error-messages/PII) 준수.
- `eai.url`·시스템식별자는 환경변수/프로파일 주입. 소스 하드코딩 금지.

---

## 6. 구현 산출물 요약

| 파일 | 책임 |
|------|------|
| `infra/eai/config/EaiProperties.java` | 설정 바인딩 |
| `infra/eai/dto/EaiRequest.java` | UMS 발송 요청 (`@Builder`, 기본값) |
| `infra/eai/dto/EaiResult.java` | 발송 결과 record |
| `infra/eai/service/EaiMessageBuilder.java` | 표준전문 조립 (param01~08, lpad, MS949) |
| `infra/eai/service/HostAddressProvider.java` | IP/MAC 공급 (운영/테스트 분리) |
| `infra/eai/service/EaiService.java` | 전송 오케스트레이션 |
| `infra/eai/config/EaiRestClientConfig.java` | EAI 전용 RestClient 빈 (octet-stream, 타임아웃) |
| `test/.../EpamsReferenceMessageBuilder.java` | ePAMS 조립 로직 전사본 (동결, 테스트 전용) |
| `test/.../EaiMessageBuilderTest.java` | 바이트 동일성 + lpad + MS949 + 구간 진단 |
| `test/.../EaiServiceTest.java` | enabled 분기, MockRestServiceServer, 실패 처리 |

## 7. 후속 과제 (TASK.md)

- 시스템 식별자는 IPP / PRM / PP로 확정(프로퍼티 관리). KDB EAI 운영팀으로부터 **IF_ID(인터페이스ID) / UMS 템플릿(업무구분ID)** 발급·확정만 잔여.
- (선택) `NotificationDispatcher` 실연동 어댑터로 EaiService 연결 (알림톡/SMS/이메일 채널).
- 운영 프로파일 `eai.enabled=true` + `eai.url` 환경변수 주입 및 배포 체크리스트 반영.
