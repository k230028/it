# 관리자 실시간 WAS 로그 뷰어 설계

작성일: 2026-08-20

## 1. 배경

관리자 화면의 "실시간 로그"(`/admin/realtime-logs`, `RealtimeLogService`)는 이름과 달리 **DB 변경이력 피드**다.
`V_ITPAPP_LOG_FEED`가 20개 로그 테이블을 UNION ALL 한 결과에서 C/U/D 변경 행을 보여줄 뿐, 애플리케이션이
남기는 서버 로그는 화면 어디에서도 볼 수 없다.

서버 로그는 `logback-spring.xml`이 `/log/springitp/it-backend.log`에 월 단위 롤오버로 남긴다(root INFO,
12개월·3GB 보관). 백엔드는 `war` 패키징으로 외부 WAS에 배포되고, `app.server.instance-id`(SVR1/SVR2)가
이미 존재하는 것에서 보듯 **2대 이상의 인스턴스로 운영**한다. 장애 상황에서 관리자가 스택트레이스를 보려면
서버에 SSH로 접속해 파일을 직접 열어야 하고, 어느 인스턴스가 요청을 처리했는지 모르면 두 서버를 모두 뒤져야 한다.

## 2. 목표

1. 관리자가 브라우저에서 애플리케이션 로그를 실시간에 가깝게 본다.
2. 어느 인스턴스의 로그인지 명확히 구분하고, 화면에서 인스턴스를 골라 조회한다.
3. 레벨·로거·키워드로 좁히고, 예외의 전체 스택트레이스를 펼쳐 본다.
4. 재배포 없이 특정 패키지 로그 레벨을 한시적으로 올린다.
5. 화면에 보이는 범위를 파일로 내려받는다.

## 3. 범위 밖

- **로그 본문 마스킹.** 토큰·사번·개인정보 패턴 치환은 이번 범위에 넣지 않는다(§9 참조).
- **WAS 컨테이너 자체 로그**(catalina.out 등). 애플리케이션 logback이 만든 이벤트만 다룬다.
- **파일 로그 조회.** 링버퍼는 프로세스 메모리에만 있으므로 재기동 이전 로그는 보이지 않는다.
  과거 로그가 필요하면 기존대로 서버 파일을 본다.
- **로그 검색 인프라**(ELK 등) 도입.
- 기존 `/admin/realtime-logs`(DB 변경이력) 화면 변경. 두 화면은 별개로 둔다.

## 4. 설계 결정

### 4.1 수집 방식 — 인메모리 링버퍼 Appender

파일 tail 대신 logback Appender가 이벤트를 메모리 링버퍼에 담는다.

- 파일 경로·OS 권한·WAS 종류에 의존하지 않는다.
- 레벨·로거·스레드·예외가 파싱 없이 구조화된 필드로 남아 서버 측 필터가 정확하다.
- 대가: 재기동 시 버퍼가 사라지고 과거 로그를 볼 수 없다(§3에서 명시적으로 제외).

### 4.2 전달 방식 — 커서 폴링

SSE 대신 기존 `/admin/realtime-logs`와 같은 커서 폴링을 쓴다. 프록시 버퍼링·연결 수 제한·httpOnly 쿠키
재인증을 새로 검증할 필요가 없고, 프론트 폴링 패턴(`useRealtimeLogs`)의 선례를 따를 수 있다.

### 4.3 인스턴스 도달 — 피어 팜아웃

화면에서 SVR2를 골라도 L4가 SVR1로 보낼 수 있다. 요청을 받은 인스턴스가 대상이 자신이 아니면
설정에 적힌 피어 URL로 위임 호출해 결과를 돌려준다.

대안이었던 인스턴스 직접 접속(방화벽·DNS·쿠키 도메인 등 인프라 변경 필요)과 DB 공유 테이블 적재
(DDL·쓰기 부하, DB 장애 시 정작 그 장애 로그가 남지 않음)를 물리치고 선택했다. 인프라 변경이 없고
한 화면에서 전체 서버를 볼 수 있다.

### 4.4 감사 기록 — 애플리케이션 로그

관리자 행위(조회 진입·레벨 변경·다운로드) 감사를 위한 신규 테이블은 만들지 않는다. `Clognh`는 로그인
이력 전용이고 범용 관리자 행위 감사 테이블은 현재 없다. 행위자 사번·대상 인스턴스·파라미터를 담은
구조화된 WARN 로그를 남기면 파일 appender가 12개월 보관하므로 추적 가능성은 확보된다.
DB 적재가 필요해지면 후속 과제로 분리한다(§10).

## 5. 백엔드 설계

### 5.1 패키지 구성

`it_backend/src/main/java/com/kdb/it/common/admin/waslog/`

| 클래스 | 책임 |
| --- | --- |
| `appender/RingBufferAppender` | `AppenderBase<ILoggingEvent>` 구현. 이벤트를 `WasLogBuffer`에 적재 |
| `appender/WasLogBuffer` | 정적 싱글턴 링버퍼. 적재·스냅샷 두 연산만 노출 |
| `dto/WasLogEntry` | `record(seq, timestamp, level, thread, logger, message, throwable)` |
| `dto/WasLogDto` | 요청 조건·응답 스냅샷·레벨 변경 요청/응답 |
| `service/WasLogService` | 필터링·커서·인스턴스 라우팅 |
| `service/LevelOverrideRegistry` | 런타임 레벨 변경분과 원복 예정 시각 보관 |
| `service/LevelOverrideRestoreScheduler` | 만료분 원복 |
| `client/WasLogPeerClient` | 피어 위임 호출(`RestClient`) |
| `config/WasLogProperties` | 버퍼 크기·피어 목록·내부 비밀값·로거 화이트리스트 |
| `controller/WasLogController` | `/api/admin/was-logs/**` |
| `controller/WasLogInternalController` | 피어 전용 `/internal/was-logs/**` |

`RingBufferAppender`는 Spring 컨텍스트보다 먼저 뜨므로 빈이 아니다. 그래서 버퍼를 정적 싱글턴으로 두고
서비스는 그 스냅샷만 읽는다. 버퍼 크기는 logback XML의 `<capacity>`로 주입하고 기본 2000건.

### 5.2 링버퍼

- 고정 크기 배열 + 쓰기 인덱스. 가득 차면 가장 오래된 항목을 덮어쓴다.
- `AtomicLong` 단조 증가 `seq`가 커서 역할을 한다.
- 적재는 짧은 `synchronized` 블록. 로깅 경로이므로 O(1) 이상의 작업을 하지 않는다.
- 예외는 `ThrowableProxyUtil.asString`으로 문자열화하되 **8KB**에서 절단, 메시지는 **4KB**에서 절단해
  버퍼 메모리 상한을 고정한다(최악 2000 × 12KB ≈ 24MB).
- 기동 시각으로 만든 `bufferEpoch`를 함께 노출한다. 인스턴스가 재기동하면 `seq`가 0부터 다시 시작하므로,
  프론트는 `bufferEpoch`가 바뀌면 커서를 버리고 처음부터 다시 받는다.

### 5.3 조회 API

```
GET /api/admin/was-logs
  ?instanceId=SVR2&afterSeq=1234&limit=200
  &levels=ERROR,WARN&logger=com.kdb.it&q=키워드
```

| 응답 필드 | 의미 |
| --- | --- |
| `instanceId` | 실제로 응답한 인스턴스 |
| `bufferEpoch` | 버퍼 세대 식별자. 바뀌면 커서 무효 |
| `entries[]` | `afterSeq` 초과분 중 필터 통과분, seq 오름차순 |
| `lastSeq` | 다음 요청에 쓸 커서 |
| `dropped` | `afterSeq` 이후 일부가 버퍼에서 밀려났으면 true |
| `levelOverrides[]` | 해당 인스턴스에 적용 중인 런타임 레벨 변경과 만료 시각(§5.5) |
| `peerError` | 피어 위임 실패 사유. 성공 시 null |

- `limit` 기본 200 / 상한 200(`RealtimeLogService` 관례와 동일).
- `levels`는 `ERROR/WARN/INFO/DEBUG/TRACE`만 허용, 그 외는 `IllegalArgumentException`.
- `q`는 message와 logger에 대한 대소문자 무시 부분일치. 정규식은 받지 않는다(ReDoS 차단).
- 필터는 스냅샷을 뜬 뒤 메모리에서 적용한다.

`GET /api/admin/was-logs/instances` → `[{ id, self, reachable }]`. `reachable`은 피어 헬스 확인 결과.

### 5.4 피어 팜아웃

```properties
app.was-log.buffer-capacity=2000
app.was-log.peers.SVR1=http://svr1-host:28080
app.was-log.peers.SVR2=http://svr2-host:28080
app.was-log.internal-secret=${WAS_LOG_INTERNAL_SECRET:}
```

- 대상이 자기 `app.server.instance-id`면 로컬 버퍼를 읽고, 아니면 해당 피어의
  `/internal/was-logs/**`를 `RestClient`(connect 1s / read 3s)로 호출한다.
- 내부 엔드포인트는 `X-Internal-Token` 헤더를 `app.was-log.internal-secret`과 상수 시간 비교로 검증한다.
  **비밀값이 비어 있으면 내부 컨트롤러를 아예 등록하지 않는다**(`@ConditionalOnProperty`). 설정 실수로
  인증 없는 로그 엔드포인트가 열리는 사고를 구조적으로 막는다.
- 비밀값은 환경변수로 주입한다. properties 파일·문서·로그에 값을 적지 않는다.
- 피어 호출이 실패해도 200으로 응답하되 `peerError`에 사유를 담아 **화면에 표면화**한다. 빈 목록으로
  위장해 "로그가 없다"고 오해하게 만들지 않는다.

### 5.5 런타임 레벨 변경

```
POST /api/admin/was-logs/level
  { instanceId, logger, level, ttlMinutes }
```

- Actuator 엔드포인트를 노출하는 대신 `LoggingSystem` 빈만 주입해
  `setLogLevel(logger, level)`을 호출한다. 노출 표면을 늘리지 않는다.
- `logger`는 접두어 화이트리스트(`com.kdb.it`, `org.springframework`, `org.hibernate`)에 속해야 한다.
  루트 로거 전체 변경은 허용하지 않는다.
- `ttlMinutes`는 필수이며 1~120 범위. 변경 직전 `getLoggerConfiguration().getConfiguredLevel()`을
  `LevelOverrideRegistry`에 원복값으로 저장한다.
- `LevelOverrideRestoreScheduler`가 30초 주기(`@Scheduled(fixedDelay)`)로 만료분을 원복한다. 스케줄링은
  기존 `NotificationSchedulingConfig`의 `@EnableScheduling`으로 이미 활성이다.
- 대상 인스턴스가 자신이 아니면 §5.4의 위임 경로로 적용한다. 인스턴스별로 따로 적용되며
  "전체 인스턴스 일괄 변경"은 제공하지 않는다.
- 재기동하면 설정 파일 레벨로 자연 복원된다.
- 현재 적용 중인 오버라이드 목록은 조회 응답의 `levelOverrides[]`로 함께 내려 화면에 상시 표시한다.

### 5.6 다운로드

```
GET /api/admin/was-logs/download?instanceId=&levels=&logger=&q=
```

현재 필터를 적용한 버퍼 전체를 `text/plain; charset=UTF-8` 첨부로 반환한다. 파일명은
`was-log_{instanceId}_{yyyyMMdd_HHmmss}.log`. 본문 형식은 `FILE_LOG_PATTERN`과 동일하게 맞춰
기존 로그 파일과 같은 도구로 열 수 있게 한다.

### 5.7 보안

- `/api/admin/**` 규칙에 따라 `hasRole('ADMIN')` + 컨트롤러 `@PreAuthorize`를 함께 건다.
- `/internal/was-logs/**`는 Spring Security에서 별도 체인으로 분리하고 §5.4의 토큰만으로 인증한다.
  JWT 사용자 인증을 요구하지 않는 대신 조건부 등록과 공유 비밀로 막는다.
- 조회 진입·레벨 변경·다운로드 시 행위자 사번·대상 인스턴스·파라미터를 WARN으로 남긴다(§4.4).

## 6. 프론트엔드 설계

### 6.1 구성

| 파일 | 책임 |
| --- | --- |
| `app/pages/admin/was-logs.vue` | 페이지 조립 |
| `app/components/admin/waslog/WasLogToolbar.vue` | 인스턴스·레벨·로거·키워드·일시정지·다운로드·레벨변경 진입 |
| `app/components/admin/waslog/WasLogTable.vue` | 가상 스크롤 목록 |
| `app/components/admin/waslog/WasLogDetailPanel.vue` | 선택 행의 전체 메시지·스택트레이스 |
| `app/components/admin/waslog/WasLogLevelDialog.vue` | 로거·레벨·TTL 입력 |
| `app/composables/useWasLogFeed.ts` | 폴링·커서·버퍼 관리 |
| `app/types/wasLog.ts` | 응답 타입 |

### 6.2 폴링 동작

- 3초 주기. 응답의 `lastSeq`를 다음 요청 `afterSeq`로 보낸다.
- 문서가 비활성(`visibilitychange`)이거나 일시정지 상태면 폴링을 멈춘다.
- 프론트 보관 상한 2000줄. 초과분은 앞에서 버린다.
- `bufferEpoch`가 바뀌면 목록을 비우고 커서를 초기화한 뒤 "서버가 재기동되었습니다" 안내를 띄운다.
- `dropped`가 true면 "일부 로그가 버퍼에서 밀려났습니다" 배지를 표시한다.
- `peerError`가 있으면 목록 위에 오류 배너를 띄운다. 조용히 비우지 않는다.
- 자동 스크롤은 **사용자가 목록 하단에 있을 때만** 동작한다. 위로 스크롤하면 자동으로 일시정지 상태가 된다.
- 인스턴스·필터를 바꾸면 커서와 목록을 초기화한다.

### 6.3 표시 규칙

- 레벨별 색상은 PrimeVue 태그로, ERROR/WARN을 시각적으로 분리한다.
- 예외가 있는 행에만 펼침 아이콘을 노출한다.
- **모든 라벨은 i18n 키로 작성한다.** 하드코딩 한국어 문자열을 두지 않는다(FE-49가 지적한 재발 패턴).

### 6.4 메뉴 등록

`it_database/migrations/V20260820_002__SeedWasLogAdminMenu.sql`로 관리자 메뉴를 추가하면서
**`TPRMPP_CMENUA` 권한 매핑 행을 함께 넣는다**. `MenuQueryService.isAllowed()`가 매핑 0건을 전체 공개로
판정하므로, 매핑을 빠뜨리면 비관리자 사이드바에 노출된다(BE-45가 지적한 최근 3개 시드의 공통 결함).

## 7. 오류 처리

| 상황 | 처리 |
| --- | --- |
| 알 수 없는 `instanceId` | 400, 허용 목록 안내 |
| 피어 타임아웃·연결 실패 | 200 + `peerError`, 화면 배너 |
| 화이트리스트 밖 로거 레벨 변경 | 400 |
| `ttlMinutes` 범위 밖 | 400 |
| 내부 토큰 불일치 | 401, 본문 없음 |
| 버퍼 밀림 | 200 + `dropped=true`, 화면 배지 |

## 8. 테스트

**백엔드**

- `WasLogBufferTest` — 용량 초과 시 오래된 항목 폐기, `seq` 단조 증가, 메시지·스택트레이스 절단.
- `WasLogServiceTest` — 레벨·로거·키워드 필터, `afterSeq` 커서, `dropped` 판정, `limit` 상한.
- `WasLogControllerTest` — 잘못된 레벨·인스턴스 400, 정상 응답 형태.
- `AdminSecurityBoundaryTest` 확장 — 비관리자 403, 미인증 401.
- `WasLogPeerClientTest` — 피어 실패가 예외가 아니라 `peerError`로 표면화되는지.
- `WasLogInternalControllerTest` — 토큰 불일치 401, 비밀값 미설정 시 빈 미등록.
- `LevelOverrideRestoreSchedulerTest` — TTL 만료 시 원래 레벨 복원, 미만료 시 유지(`Clock` 주입).

**프론트엔드**

- `useWasLogFeed` — 커서 전달, 일시정지 시 미호출, `bufferEpoch` 변경 시 초기화, 보관 상한.
- `WasLogTable` — 레벨 태그 렌더, 예외 행만 펼침 노출.
- `WasLogToolbar` — 필터 변경 시 커서 초기화 이벤트.

## 9. 수용한 리스크 — 마스킹 미적용

로그 본문에 토큰·사번·개인정보가 포함되면 화면과 다운로드 파일에 **그대로 노출된다**. 통제 수단은
ADMIN 권한과 §4.4의 감사 로그뿐이다. 다운로드 파일이 개인 PC로 나가면 그 이후 추적은 끊긴다.
사용자가 이 트레이드오프를 확인하고 진행을 결정했다. 필요해지면 §5.2의 적재 직전 지점에
마스킹 필터를 끼우는 것으로 후속 대응할 수 있다(적재 경로가 한 곳이라 삽입 지점이 명확하다).

## 10. 후속 과제 후보

- 로그 본문 마스킹 필터.
- 관리자 행위 감사의 DB 적재(§4.4).
- 재기동 이전 로그 조회를 위한 파일 페이지네이션.
- 전체 인스턴스 일괄 레벨 변경.

## 11. 확인이 필요한 기본값

| 항목 | 제안값 | 근거 |
| --- | --- | --- |
| 버퍼 크기 | 2000건 | 메모리 24MB 상한, 평시 수 분 분량 |
| 폴링 주기 | 3초 | 기존 실시간 로그 화면과 동일 감각 |
| 레벨 TTL 상한 | 120분 | 장애 분석 1회 세션 |
| 피어 타임아웃 | connect 1s / read 3s | 화면 응답성 우선, 실패는 표면화 |
