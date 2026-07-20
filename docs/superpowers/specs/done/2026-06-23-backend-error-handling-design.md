# 백엔드 에러 처리 보강 설계 (Critical + High)

> 🗓️ 작성일: 2026-06-23
> 🎯 출처: `TASK.md` §⚠️ 에러 처리 (백엔드 3건)
> 📦 범위: Critical + High 우선. 프론트엔드 에러 처리 sweep(12건)은 별도 spec→plan 사이클.

## 1. 배경

`TASK.md`의 "⚠️ 에러 처리" 섹션은 주석 FIXME 등록까지 완료되고 코드 수정만 남은 후속 과제다.
이번 사이클은 그중 **백엔드 Critical+High 3건**을 다룬다. 코드 현행 확인 결과:

- **B-1** (🔴): `ApplicationService.getApplicationsByIds()`, `ProjectService.findByIds()`,
  `CostService.findByIds()`가 `catch (IllegalArgumentException) → return null → filter(Objects::nonNull)`
  패턴으로 누락 ID를 조용히 버린다. 호출자는 실패 건수를 알 수 없다. (`ApplicationService.java:497~`,
  `ProjectService.java:631~`, `CostService.java:403~`)
- **B-2** (🟠): `NotificationEventListener.onApprovalCompleted()`/`onApprovalRecalled()`의
  `applicationRepository.findById()`가 `@TransactionalEventListener(AFTER_COMMIT)` 콜백 —
  외부 트랜잭션 종료 후 non-tx 컨텍스트에서 실행되어 지연로딩 접근 시
  `LazyInitializationException` 잠재. (`NotificationEventListener.java:52~, 82~`)
- **B-3** (🟠): `ChangeLogEntityListener.persistLog()`의 catch가 `log.warn`만 수행 —
  감사로그 유실을 운영에서 능동 인지 못함. 스택트레이스는 2026-06-22 추가됨, 알람 연동만 잔여.
  (`ChangeLogEntityListener.java:101~`)

## 2. 설계

### B-1 🔴 bulk-get 실패 건 가시화

**결정**: 응답 계약을 부분 성공 래퍼로 변경한다 (실패 ID/건수를 호출자에 노출).

**래퍼 정의** — 각 도메인 DTO에 정적 중첩(§5.3 패턴):

```java
// 예: ApplicationDto.BulkResponse
@Schema(name = "ApplicationBulkResponse", description = "신청서 일괄 조회 결과 (부분 성공)")
public record BulkResponse(
        @Schema(description = "조회 성공 항목") List<Response> items,
        @Schema(description = "조회 실패(미존재) 관리번호 목록") List<String> failedIds
) {}
```

`ProjectDto.BulkResponse`(items=`ProjectDto.Response`), `CostDto.BulkResponse`(items=`CostDto.Response`)
동일 패턴.

**서비스 변경** (3곳 동형):
- `catch` 블록에서 `null` 반환 제거 → 실패 ID를 리스트에 수집.
- `log.warn("bulk-get 누락: type={}, failedIds={}", <도메인>, failedIds)` 기록.
- 반환 타입을 `List<Response>` → `BulkResponse`로 변경.

**컨트롤러 변경** (3곳):
- `ApplicationController.bulkGetApplications`, Project/Cost 대응 엔드포인트가
  `BulkResponse`를 `200 OK` body로 그대로 반환.

**프론트 직접 호출부 동시 수정** (이 계약 변경의 직접 파급분만 — 큰 프론트 sweep과 별개):
- 3개 bulk-get 엔드포인트 호출자에서 응답 구조 변경 반영: `items`를 목록으로 사용,
  `failedIds.length > 0`이면 `toast` 경고("N건을 불러오지 못했습니다").
- 실제 호출부는 plan 단계에서 grep으로 식별(`bulk-get`, `findByIds`, `BulkGetRequest` 사용처).

**테스트** (Mockito 단위, 3개 서비스 각각):
- 전건 존재 → `failedIds` empty, `items` 전건.
- 일부 누락 → `items`에 정상분, `failedIds`에 누락 ID.
- 전건 누락 → `items` empty, `failedIds` 전부.

### B-2 🟠 NotificationEventListener 트랜잭션 경계

**결정**: `onApprovalCompleted`, `onApprovalRecalled` 두 핸들러에
`@Transactional(propagation = Propagation.REQUIRES_NEW)` 추가.

- 근거: §5.16 — Spring 7 AFTER_COMMIT 페이즈는 non-transactional synchronization 컨텍스트.
  `NotificationService.send()`가 이미 `REQUIRES_NEW`인 것과 동일 근거.
- 현재 핸들러는 스칼라 필드(`getDcdReqTtl`, `getDcdReqUsid`)만 읽어 동작 회귀 위험 낮음.
  트랜잭션 경계로 향후 연관 접근까지 안전 확보.
- `onNotificationEvent`는 `findById` 없이 곧장 `send()`(REQUIRES_NEW) 호출이므로 변경 불필요.

**테스트**: 이벤트 발행 시 핸들러가 조회 후 `NotificationService.send()`를 호출하는지 검증
(mock 기반 동작 회귀 방지 수준; 실제 tx 경계는 단위 테스트 한계 명시).

### B-3 🟠 ChangeLogEntityListener 감사로그 실패 알람

**결정**: `persistLog()` catch의 `log.warn` → `log.error`로 승격.

- 감사로그 유실이 로그 수집/모니터링 알람 규칙(ERROR 레벨)에 걸리도록 함.
- 향후 EAI/관리자 인앱 알림 연동 자리를 명시 주석으로 남김 (지금은 YAGNI로 신규 파이프라인 보류).
- **기각된 대안**: 감사로그 실패 시 관리자 인앱 `NotificationEvent` 발행 — 알림 저장 자체가
  또 감사로그 대상이라 재귀/연쇄 실패 위험. 채택하지 않음.

## 3. 영향 범위 / 비범위

**포함**:
- `ApplicationService`, `ProjectService`, `CostService` (B-1)
- `ApplicationController`, `ProjectController`(또는 대응), `CostController`(또는 대응) (B-1)
- 각 도메인 DTO에 `BulkResponse` 중첩 (B-1)
- 3개 bulk-get 직접 프론트 호출부 (B-1 계약 파급)
- `NotificationEventListener` (B-2)
- `ChangeLogEntityListener` (B-3)

**비범위**:
- 프론트엔드 에러 처리 sweep 12건 (별도 사이클)
- 백엔드 에러 처리 Medium/Low 항목 (`LoginAttemptService` readOnly 등)
- 신규 알림/알람 파이프라인 구축

## 4. 검증

- `./gradlew test` — 신규/변경 단위 테스트 통과.
- 인증/결재/변경로그 공통 영향이므로 `./gradlew clean test` 재검증 (§5.9).
- 프론트 호출부 수정 시 `npm run typecheck` (it_frontend).

## 5. 리스크

| 리스크 | 완화 |
| --- | --- |
| B-1 응답 shape 변경이 프론트 호출부를 깨뜨림 | 직접 호출부를 동일 PR에서 함께 수정. plan에서 grep으로 전수 식별. |
| B-2 `REQUIRES_NEW`가 기존 동작을 바꿈 | 스칼라 필드 전용 접근이라 회귀 위험 낮음; 동작 회귀 테스트로 보강. |
| B-3 `log.error` 승격으로 정상 운영에서 노이즈 | 감사로그 실패는 비정상 상황이므로 ERROR가 적절. 빈도 모니터링 후 재평가. |
