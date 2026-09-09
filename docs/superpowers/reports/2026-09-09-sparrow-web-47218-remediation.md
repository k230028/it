# Sparrow 정적분석 이슈 조치 (issues_k140024_Web_47218_381581)

- 원본: `prds/issues_k140024_Web_47218_381581.xls` (검출 2026-09-09 10:43:36, 총 17건)
- 대상: `it_backend` 전용. 프론트·DB 변경 없음
- 검증: `./gradlew test` BUILD SUCCESSFUL, `./gradlew spotlessApply` 적용 완료

## 1. 조치 요약

| 체커 | 건수 | 조치 |
| --- | --- | --- |
| `UNCHECKED_NULL` | 6 | 불필요한 방어 코드 제거 (5) + 중복 null 보정 제거 (1) |
| `NULL_RETURN_STD` | 8 | 잠금 조회 결과에 명시적 null 검사 1회 추가 |
| `SENSITIVE_COOKIE_..._WITHOUT_SECURE_ATTRIBUTE` | 1 | Secure 플래그 기본값 fail-secure 전환 |
| `USING_HASH_WITHOUT_SALT` | 2 | 오탐 (이미 확인 처리, 코드 변경 없음) |

## 2. 근본 원인

`UNCHECKED_NULL` 6건과 `NULL_RETURN_STD` 8건은 서로 다른 결함이 아니라 하나의 패턴입니다. **null을 절대 반환하지 않는 자체 헬퍼의 반환값을 `Objects.requireNonNull` / `Objects.requireNonNullElse`로 다시 감싼 코드**가, 분석기에게 "이 값은 null일 수 있다고 개발자가 판단한 지점"으로 읽히고, 같은 값을 감싸지 않고 쓰는 다른 지점이 미검사 역참조로 집계된 것입니다.

즉 조치 방향은 검사를 늘리는 쪽이 아니라 **도달 불가능한 방어 코드를 걷어내 실제 계약과 코드를 일치시키는 쪽**입니다.

## 3. 파일별 변경

### 3.1 `ProjectAmountCalculator.calculate` — 967993, 967994, 967995

`ProjectAmountPolicy.normalize`·`sumNormalized`는 `amount == null ? BigDecimal.ZERO : amount`로 시작해 항상 값을 반환합니다. 반환값을 감싼 `Objects.requireNonNull` 4개를 제거했습니다. `restoreCurrentRequestAmount`의 `requireNonNull(totalRequiredAmt, "저장 총소요금액")`은 **파라미터에 대한 실제 계약 검증**(JavaDoc `@throws NullPointerException`)이므로 유지하고, FQN 호출만 import 사용으로 정리했습니다.

### 3.2 `NotificationDispatchService.dispatch` — 967997 ~ 968004 (8건)

`Objects.requireNonNull(...orElseThrow(), "잠금 조회한 알림 행")`을 벤더 권고 형태인 명시적 검사로 바꿨습니다. `row`는 이후 43·47·49·53·54·56행에서 계속 역참조되므로 대입 직후 한 번만 검사해 8건을 함께 덮습니다. 실패 시 동작(예외 발생)은 종전과 같고 메시지에 `infmMsgNo`가 붙어 진단성이 올라갑니다.

### 3.3 `ProjectBudgetSummaryService.applyStoredAmountSnapshot` — 968006

`warnSnapshotDiff(response, "dfrAmt", nvl(response.getDfrAmt()), storedPaidAmt)`의 `nvl()`은 `warnSnapshotDiff` 내부가 이미 `nvl(derivedAmount)`를 적용하므로 중복이었고, 바로 위 세 줄(`tyyBgAmt`·`prjBgAmt`·`mplAmt`)과도 형태가 달랐습니다. 제거해 네 줄을 같은 형태로 맞췄습니다. 동작 변화 없습니다.

### 3.4 `MigrationMatchDiagnostics.checkRateReconcile` — 968007

`MigrationDiagnostics.cell`은 빈 셀을 `""`로 반환하므로 `Objects.requireNonNullElse(..., "")`를 제거했습니다. 같은 메서드 아래쪽(조정열 순회)은 이미 `cell()`을 그대로 쓰고 있어 형태도 일치합니다.

### 3.5 `DelegatedBudgetSheetAdapter.adapt` — 968008

`AdapterSupport.cellOf`도 `value == null ? "" : value.trim()`으로 끝나므로 `Objects.requireNonNullElse(..., "")`를 제거했습니다. 바로 앞뒤의 `branchName`·`itemName` 호출과 형태가 같아졌습니다.

### 3.6 `CookieUtil.addResponseCookie` — 968009

체커는 리터럴 `setSecure(true)`를 요구하지만, 이 프로젝트는 개발 환경 HTTP 접속을 위해 `app.cookie.secure`로 프로파일 분기합니다. 하드코딩 대신 **설정 누락 시 평문으로 떨어지지 않도록** 주입 기본값을 뒤집었습니다.

- `CookieUtil`: `@Value("${app.cookie.secure:false}")` → `:true`
- `MfaController`: 같은 생성자 파라미터 기본값도 `:true`

프로파일 값은 그대로입니다 — `application.properties`·`prod`=true, `dev`·`local-*`·`test`=false. 운영은 `EnvironmentValidator.requireTrue("app.cookie.secure")`가 기동 시 다시 강제하므로, 이 변경 뒤에는 **명시적으로 false를 넣은 개발 프로파일에서만** Secure가 꺼집니다.

## 4. 오탐 (코드 변경 없음)

두 건 모두 리포트에서 이미 `확인 / 오탐 확인`으로 처리되어 있으며, 코드 확인 결과 타당합니다.

- **968005 `SecurityConfig.cspHash`** — CSP `script-src 'sha256-...'` 소스 표현식은 W3C 명세가 **솔트 없는 원문 SHA-256**을 요구합니다. 솔트를 넣으면 브라우저 검증이 실패합니다.
- **967996 `FingerVeinMfaProvider.sha256`** — 지문정맥 단말 규격이 정한 검증값 해시입니다. 비밀번호 저장이 아니고, 원문에 거래마다 새로 뽑는 `randomKey`(SecureRandom)와 당일 날짜가 이미 포함되어 사전공격 대상이 아닙니다.

## 5. 재검사 시 확인할 점

- 3.2의 `if (row == null)`은 `Optional.orElseThrow()` 특성상 실제로는 도달하지 않는 분기입니다. `NotificationDispatchService`의 branch coverage가 12분의 11(0.92)로 게이트(0.70)를 여유 있게 통과하는 것을 확인했습니다.
- 3.6은 리터럴 `setSecure(true)`가 아니므로 재검사에서 968009가 다시 나올 수 있습니다. 그 경우 위 근거로 오탐 처리하되, 근거는 "설정으로 관리한다"가 아니라 "운영 기동 시 fail-fast로 강제한다"입니다.

---

# 2차 조치 (재검사 issues_k140024_Web_47218_381621, 검출 2026-09-09 14:20:58)

1차 조치 후 재검사에서 17건 → 7건으로 줄었습니다. 남은 7건을 2차로 조치했습니다.

## 6. 1차 결과 판정

| 1차 조치 | 결과 |
| --- | --- |
| `NotificationDispatchService`에 명시적 `if (row == null)` 추가 | **8건 전부 해소** |
| 해시 2건 오탐 처리 | 목록에서 제외됨 |
| 불필요한 `requireNonNull`·`requireNonNullElse` 제거 (UNCHECKED_NULL 6건) | **효과 없음 — 6건 그대로 재검출** |

재검사 스니펫에 1차 수정본(주석·라인번호가 바뀐 코드)이 그대로 찍혀 있어 판정이 확실합니다. **1차 리포트 §2에 적은 근본 원인 분석은 틀렸습니다.** 중복 방어 코드를 걷어낸 것 자체는 유효한 정리였지만 이 체커와는 무관했습니다.

두 결과를 합치면 실제 규칙은 이렇습니다.

> **Sparrow는 `Objects.requireNonNull`·`requireNonNullElse`를 null 검사로 인정하지 않고, 문장 단위 `if (x == null)`만 인정한다.**

`DelegatedBudgetSheetAdapter`가 가장 선명한 증거입니다 — 인자가 완전히 같은 `addItem` 두 호출 중 **두 번째만** 검출됐습니다. 첫 호출이 헬퍼 내부의 null 검사를 "이 값은 nullable" 근거로 만들고, 이후 같은 값을 쓰는 지점이 미검사 역참조로 집계되는 구조입니다. `ProjectAmountCalculator`에서 첫 호출(L49)만 빠지고 L50·51·53이 잡힌 것도 같은 모양입니다.

## 7. 2차 변경 (0건 목표)

남은 6건은 모두 NPE가 실제로 불가능한 자리라 도달 불가능한 분기가 늘어나지만, 검출 0건을 목표로 하기로 결정했습니다. 1차에서 8건을 실제로 지운 것과 같은 변환을 적용했습니다.

| 파일 | 이슈 | 변경 |
| --- | --- | --- |
| `ProjectAmountCalculator.calculate` | 968010/11/12 | `paidAmt`를 `resolvedPaidAmt`로 받아 문장 단위 확정, 누적 지역변수 두 개도 같은 형태로 확정. 이후 정규화·합산은 확정된 값만 사용 |
| `ProjectBudgetSummaryService.applyStoredAmountSnapshot` | 968015 | `response.getDfrAmt()`를 `derivedPaidAmt`로 받아 확정 후 전달 |
| `MigrationMatchDiagnostics.checkRateReconcile` | 968016 | `rawRate` 확정 후 파싱·`isBlank`에 사용 |
| `DelegatedBudgetSheetAdapter.adapt` | 968017 | `currency`·`itemName` 확정 후 `addItem` 두 번 호출 |
| `CookieUtil.addResponseCookie` | 968018 | `cookie.setSecure(source.isSecure())` → `if (source.isSecure()) { cookie.setSecure(true); }` |

`ProjectAmountCalculator`의 `paidAmt`와 `ProjectBudgetSummaryService`의 `response.getDfrAmt()`는 실제로 null이 들어오는 값이라 이 가드가 죽은 코드가 아닙니다. 나머지 셋은 도달하지 않는 분기이며, 주석에 그 사실과 이유를 남겼습니다.

`CookieUtil`은 동작이 같습니다 — Servlet `Cookie`의 Secure 기본값이 false라서 조건부 `setSecure(true)`와 결과가 동일하고, 대신 체커가 찾는 리터럴 형태가 됩니다.

## 8. 커버리지 게이트 대응

`jacocoTestCoverageVerification`은 **클래스별** LINE·BRANCH·COMPLEXITY 각각 0.70을 요구합니다. 도달 불가 분기는 COMPLEXITY의 missed만 늘리므로, 여유가 없던 클래스가 게이트를 깨뜨릴 수 있습니다.

`DelegatedBudgetSheetAdapter`는 조치 전 COMPLEXITY 0.731이라 가드 2개를 그냥 넣으면 0.679로 게이트가 깨집니다. 미검증 상태였던 `supports()`와 `ownerOverride()`(담당자 보정, MIG-03) 테스트 3개를 함께 추가해 해소했습니다.

조치 후 대상 클래스 커버리지 — 전부 통과:

| 클래스 | LINE | BRANCH | COMPLEXITY |
| --- | --- | --- | --- |
| `NotificationDispatchService` | 0.944 | 0.917 | 0.875 |
| `ProjectAmountCalculator` | 0.939 | 0.900 | 0.875 |
| `ProjectBudgetSummaryService` | 1.000 | 0.857 | 0.897 |
| `MigrationMatchDiagnostics` | 0.927 | 0.866 | 0.804 |
| `DelegatedBudgetSheetAdapter` | 0.961 | 0.824 | 0.786 (조치 전 0.731) |
| `CookieUtil` | 0.922 | 1.000 | 0.950 |

## 9. 검증

- `./gradlew test` — BUILD SUCCESSFUL (전체 통과)
- `./gradlew spotlessApply` 적용
- `./gradlew check` — `ProjectConcurrencyStamper`(BRANCH 0.50)와 `CostTerminalSynchronizer`(COMPLEXITY 0.65) 두 건 실패. **조치 전과 수치까지 동일**하며 두 클래스 모두 이번 변경 대상이 아닙니다. 공유 워킹트리의 다른 작업 변경분에서 온 기존 실패입니다.

## 10. 다음 재검사에서 확인할 점

- UNCHECKED_NULL 6건과 쿠키 1건이 모두 사라져야 정상입니다. 남는다면 §6의 규칙(문장 단위 `if`만 인정)이 이 체커에는 적용되지 않는다는 뜻이므로, 더 손대지 말고 오탐 처리로 전환하는 편이 낫습니다 — 코드는 이미 NPE가 불가능한 상태이고, 더 넣을 수 있는 것은 도달 불가능한 분기뿐입니다.
- 쿠키(968018)가 남으면 체커가 `setSecure` 호출 자체가 아니라 `addCookie` 시점의 상수 전파를 본다는 뜻입니다. 이 경우 코드로는 해소할 수 없으므로(개발 환경 HTTP 접속 요구와 상충) 오탐 처리하고, 근거로 `EnvironmentValidator.requireTrue("app.cookie.secure")`의 운영 기동 fail-fast를 답니다.
