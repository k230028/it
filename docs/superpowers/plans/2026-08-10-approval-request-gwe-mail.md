# 결재요청 그룹웨어 메일 연동 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 결재요청만 그룹웨어 메일로 발송하고 절대 링크 및 EAI 204/200 응답 계약을 정확히 처리한다.

**Architecture:** 결재 도메인은 기존 알림 이벤트와 GWE 채널 선택만 유지하고, 외부 메일 표현은 `NotificationDispatcherRouter`가 책임진다. HTTP 상태 및 오류 전문 해석은 EAI 인프라 계층에 한정하며 기존 실패 상태와 재시도 흐름을 재사용한다.

**Tech Stack:** Java 25, Spring Boot 4.1, Spring RestClient, JUnit 5, AssertJ, Mockito, Gradle

## Global Constraints

- 결재완료·반려·회수는 그룹웨어로 발송하지 않는다.
- 메일은 `Msg_gubun=3`, `Msg_key=mailt...`, `ATT_FLAG=0`, 빈 메신저 URL을 사용한다.
- 메일 링크는 `app.frontend-url`과 `/approval/list?tab=pending`를 결합한다.
- HTTP 204만 성공이고 HTTP 200은 EAI 오류 전문이다.
- `eai.enabled=false`의 스킵 동작과 기존 재시도 흐름을 유지한다.
- 개발·운영 EAI URL을 코드에 하드코딩하지 않는다.

---

### Task 1: 결재요청 GWE 메일 페이로드

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouter.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/dispatcher/NotificationDispatcherRouterTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/approval/service/ApplicationServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/common/notification/event/NotificationEventListenerTest.java`

**Interfaces:**
- Consumes: `Cinfmm` 제목·본문·수신자·추천 URL 및 `${app.frontend-url}`
- Produces: `EaiRequest.gwe(String, GwePayload)` 메일 페이로드

- [ ] **Step 1: 메일 페이로드 회귀 테스트 작성**

```java
assertThat(payload.msgGubun()).isEqualTo("3");
assertThat(payload.recvIds()).isEqualTo("K0001");
assertThat(payload.url()).isEmpty();
assertThat(payload.attFlag()).isEqualTo("0");
assertThat(payload.contents()).contains("https://itp.example/approval/list?tab=pending");
```

- [ ] **Step 2: RED 확인**

Run: `./gradlew test --tests '*NotificationDispatcherRouterTest'`

Expected: 기존 `msgGubun=1`, 상대 URL 전달, 링크 없는 본문 때문에 실패.

- [ ] **Step 3: 최소 구현**

```java
.msgGubun("3")
.recvIds(notification.getRmsEno().trim().toUpperCase(Locale.ROOT))
.contents(mailContents(notification, absoluteApprovalUrl()))
.url("")
.attFlag("0")
```

HTML 동적 값은 이스케이프하고 기준 URL 후행 `/`를 제거한 뒤 승인 경로를 붙인다.

- [ ] **Step 4: 이벤트 범위 테스트 보강**

`ApplicationServiceTest`는 최초/중간 결재요청의 GWE 채널을, `NotificationEventListenerTest`는 완료·반려 결과 이벤트 채널이 null임을 검증한다.

- [ ] **Step 5: GREEN 확인**

Run: `./gradlew test --tests '*NotificationDispatcherRouterTest' --tests '*ApplicationServiceTest' --tests '*NotificationEventListenerTest'`

Expected: PASS.

### Task 2: GWE 메일 전문 계약

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/service/GwePayloadSection.java`
- Modify: `it_backend/src/test/java/com/kdb/it/infra/eai/service/EpamsGweReferenceBuilder.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/service/GwePayloadSectionTest.java`

**Interfaces:**
- Consumes: `GwePayload.msgGubun()`
- Produces: MS949 고정 길이 GWE 업무 개별부

- [ ] **Step 1: 메시지 구분별 키 테스트 작성**

```java
assertThat(mailSection).startsWith("mailtPRMPP");
assertThat(messengerSection).startsWith("alertPRMPP");
```

- [ ] **Step 2: RED 확인**

Run: `./gradlew test --tests '*GwePayloadSectionTest'`

Expected: 메신저 키가 기존 `mailt`이므로 실패.

- [ ] **Step 3: 최소 구현**

```java
String prefix = "1".equals(g.msgGubun()) ? "alert" : "mailt";
```

동결 참조 빌더에도 문서의 동일한 분기를 반영한다.

- [ ] **Step 4: GREEN 확인**

Run: `./gradlew test --tests '*GwePayloadSectionTest' --tests '*EaiMessageBuilderTest'`

Expected: PASS.

### Task 3: EAI HTTP 상태와 오류 전문 판정

**Files:**
- Create: `it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiErrorResponseParser.java`
- Modify: `it_backend/src/main/java/com/kdb/it/infra/eai/service/EaiService.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiErrorResponseParserTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/infra/eai/service/EaiServiceTest.java`

**Interfaces:**
- Consumes: HTTP 상태와 MS949 응답 바이트
- Produces: `EaiResult.success("")` 또는 `EaiResult.failure(String)`

- [ ] **Step 1: 파서 및 서비스 실패 테스트 작성**

고정 헤더의 `RLT_TC=2`, `MSG_IDCT_TC=1`과 전문 내 `SEEAI\\d{5}`를 사용해 오류를 식별한다. HTTP 204는 성공, HTTP 200 오류 전문은 코드가 포함된 실패, 기타 상태와 파싱 불가 200은 실패여야 한다.

```java
assertThat(result.success()).isFalse();
assertThat(result.errorMessage()).contains("SEEAI00001");
```

- [ ] **Step 2: RED 확인**

Run: `./gradlew test --tests '*EaiErrorResponseParserTest' --tests '*EaiServiceTest'`

Expected: 파서 부재 및 기존 HTTP 200 성공 판정 때문에 실패.

- [ ] **Step 3: 최소 파서 구현**

```java
Optional<String> parse(byte[] response, Charset charset)
```

바이트 기준 고정 위치와 `SEEAI` 코드를 검사하고 제한된 오류 메시지만 반환한다. 전문 전체는 로그에 포함하지 않는다.

- [ ] **Step 4: RestClient exchange 상태 판정 구현**

204면 성공, 200이면 파서 결과 또는 `EAI 오류 응답 파싱 실패`, 그 밖의 상태는 제한된 HTTP 상태 오류를 반환한다.

- [ ] **Step 5: GREEN 확인**

Run: `./gradlew test --tests '*EaiErrorResponseParserTest' --tests '*EaiServiceTest'`

Expected: PASS.

### Task 4: 전체 검증

**Files:**
- Verify: `it_backend` 전체 변경 파일

**Interfaces:**
- Consumes: Tasks 1~3 변경
- Produces: 포맷·정적 검사·전체 단위 테스트 증거

- [ ] **Step 1: 변경 검사**

Run: `git diff --check && git diff --stat`

Expected: 공백 오류 없음, 계획 범위 파일만 변경.

- [ ] **Step 2: Health Stack 실행**

Run: `./gradlew spotlessCheck test`

Expected: BUILD SUCCESSFUL, 테스트 실패 0.

- [ ] **Step 3: 변경 파일 커밋**

Run: `git add <계획에 열거된 변경 파일>; git commit -m "fix: 결재요청 그룹웨어 메일 연동 정합성 개선"`

Expected: 백엔드 저장소에 하나의 기능 커밋 생성.
