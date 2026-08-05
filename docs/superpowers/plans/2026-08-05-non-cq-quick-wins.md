# 비(非)Clean Code 잔여과제 Quick Win 조치 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `TASK.md`의 Clean Code 부채(CQ-\*) 섹션을 제외한 활성 항목 중, 설계 결정·DBA 협의·외부 의존 없이 **코드로 바로 끝낼 수 있는 10개**를 위험도 낮은 순으로 상환한다.

**Architecture:** 저장소별로 묶어 Wave를 나눈다. Wave 0은 문서·주석만 고치므로 런타임 영향이 0이고, Wave 1은 `it_backend` 단독, Wave 2는 `it_frontend` 단독으로 닫힌다. Wave 3만 백엔드 OpenAPI 계약이 프론트 생성물에 파급되므로 4-repo 규약(백엔드 계약 커밋 먼저 → 프론트 재생성 커밋)을 적용한다. 각 Task는 독립 커밋이며 앞 Task에 의존하지 않는다 — 중간에 멈춰도 남은 것이 깨지지 않는다.

**Tech Stack:** Spring Boot 4.1 / Java 25 / Gradle / Spring Cache(Caffeine) / JUnit 5 · Nuxt 4 / Vue 3 / TypeScript / Vitest / stylelint

---

## 0. 선정 결과 — 비(非)CQ 활성 항목 전수 분류

`TASK.md` 2026-08-05 기준. Clean Code 부채(CQ-01·15·18·19·22)는 사용자 지시에 따라 전부 제외했다.

### 채택 (10개) — 이 계획의 실행 대상

| ID | 우선순위 | 왜 쉬운가 (코드 실측 근거) | Task |
| --- | :---: | --- | :---: |
| — | — | `TASK.md` 백엔드 표에 **BE-32 행이 76·78행에 두 번** 들어가 있다(내용 동일). 계획 수립 중 발견한 문서 결함 | T1 |
| FE-31 | 🟢 Low | 주석 1개 문단만 정정. `app/pages/admin/menus/index.vue:61-62`가 `fetchAdminTree()` 반환 객체를 그대로 `useRefreshGuard`(78행)에 넘겨 보존이 실제로 켜짐을 확인 | T2 |
| BE-29 | 🟡 Medium | `AdminService` 4개 메서드(95·141·221·245행)에 `@Transactional`만 있고 캐시 애노테이션 0개. 붙일 블록은 `CodeService.java:116-120`에 이미 있어 그대로 복제 | T3 |
| BE-26 | 🟢 Low | 배치 헬퍼 `loadUserNameMap`(822행)·`resolveUserName(eno, map)`(839행)이 **이미 존재**하고 `getCodes`(72-86행)가 동일 패턴의 모범형. `getOrganizations`만 미적용 | T4 |
| FE-24 | 🟢 Low | `useBoard.ts:49`가 `key` 없이 `useApiFetch`를 연다. `ApiFetchOptions`는 Nuxt `useFetch` 옵션을 그대로 전개하므로(`useApiFetch.ts:194-196`) `key` 지정이 곧바로 가능 | T5 |
| FE-33 | 🟢 Low | `useBoardAttachments.ts` 238·275행의 `await refresh()`를 같은 파일 163행에서 이미 만든 `attemptRefresh`로 교체 | T6 |
| FE-22 | 🟢 Low | `useRefreshGuard.ts`의 Toast 호출부가 246-251행 한 곳뿐이라 옵션 1개 추가로 분기 완결 | T7 |
| FE-19 | 🟢 Low | 실측 302건 중 **empty-line 계열 133건**이 `stylelint --fix` 자동 수정 대상. 수작업 판단이 필요한 것은 `selector-class-pattern`·`color-no-hex`뿐 | T8 |
| FE-30 ③ | 🟢 Low | `scripts/codegen.mjs`를 ESLint 대상에 편입하는 설정 변경 (FE-30의 3개 소항목 중 ③만 채택) | T9 |
| BE-31 | 🟡 Medium | `GuideDocController.java` 89·126행 문자열 2개. 다만 OpenAPI 스펙이 바뀌어 프론트 `api.d.ts` 재생성이 동반됨 | T10 |

### 보류 — 쉽지만 **업무·설계 결정이 선행**해야 함 (6건)

착수 전에 결정만 내려주면 각각 반나절 이하다. §5에 결정 항목을 정리했다.

| ID | 결정해야 할 것 |
| --- | --- |
| BE-19 | `abusTc`에 `@NotBlank`를 걸면 기존 클라이언트가 400을 받는다 — "누락"과 "고의적 해당없음(`'0'`)"을 입력 단계에서 가를지 |
| FE-25 | `ResultForm`·부모의 배너 2중 노출을 허용할지, 부모 배너로 합칠지 |
| FE-26 | `prepare/[id].vue` 탭0에서 일으킨 실패의 탭1 배너를 어떻게 보이게 할지(탭 전환 유도 vs 배너 승격) |
| FE-29 | 재시도 버튼 라벨·"다시" 유무의 **표준 문구**를 먼저 확정해야 일괄 치환 가능 |
| BE-30 | `getSummary`의 대표 ioeC(588행)·편성률(622행) 채택 기준을 BE-17 결정 #2(대표 편성행)와 어떻게 맞출지 |
| FE-30 ①② | `useApprovalDashboard`·`useDocumentDashboard`의 `enableKeepPreviousData` 비노출이 의도인지 / `ignoreFiles` grandfather를 파일 단위에서 규칙 단위로 바꿀지 |

### 보류 — **선행 조사·재현 환경**이 필요 (6건)

| ID | 막는 것 |
| --- | --- |
| ERR-14 | 401 무한 재시도 상한. 국소 변경이나 **인증 흐름**이라 재현 하네스부터 필요 — 별도 계획 권장 |
| ERR-15 | census 재실시(정규식 + 파일 단위 전수)가 선행. 대상 4개 파일은 확정돼 있으나 총계가 과소 집계 |
| FE-20 | `useCostEditingState` merge watcher 보존 조건 확장 — 편집 세션 상태 회귀 위험 |
| FE-21 | 응답 순서 역전 가드 2곳 + FE-28②의 순서 역전 테스트 동반 |
| FE-23 | `clearNuxtData()`·언마운트 purge 경로를 테스트 대역에 신규 구현해야 함 |
| FE-27 · FE-28① | 대상 파일 목록이 리뷰 산출물에 남아 있지 않아 `tests/unit`·14개 화면 재조사가 선행 |

`BE-27`(Oracle IT 공유 조직 fixture `"120"` 격리)도 여기에 둔다 — 3개 IT 클래스가 `"120"`을 공유할 뿐 아니라 `OrganizationNameProjectionIt`이 `findAll()` 전역 상태와 대조하는 단언(100·144-159행)을 갖고 있어 접두사 격리 시 단언까지 재설계해야 한다. 트리거(Gradle 병렬 테스트 도입)도 아직 발생하지 않았다.

### 보류 — **대형·고위험** (4건)

`BE-03`(운영 관측 의존 + 계약 분리) · `BE-24`(활성 최신행 단일성: 데이터 정리 + Oracle 함수 인덱스 + 통합 테스트) · `BE-25`(복합 PK 정합화) · `BE-28`(채번 포맷 확대 — `BBUGTM`의 SQL `LPAD` 때문에 MAXVALUE만 늘리면 번호가 조용히 충돌). **단 BE-28의 감시 쿼리 1회 실행**은 §6에 상시 점검으로 분리했다.

### 제외 — 외부·운영 의사결정 의존

`SEC-10`(advisory 판정 대기) · `BE-18`(구 경로 WARN 0건 조건 미충족) · `BE-20`·`BE-22`(DBA) · `BE-21`(결재유형 실사용 기능 부재) · `BE-23`(아티팩트 저장소 합의) · `BE-32`·`BE-33`(업무 담당자 상태 코드 확정) · `LOG-03`·`LOG-04`(운영 임계치) · `BRD-02`·`BRD-03`·`BRD-05`·`BRD-06`(트리거 조건 미도달) · `EAI-01`·`02`·`05`·`06`·`07`(KDB 운영팀) · `FE-15`(백엔드 OpenAPI required·nullable 보강 선행) · `FE-32`(공유 테스트 대역 수정 — 전 파일 영향 검토 선행).

---

## Wave 0 — 문서·주석 (런타임 영향 없음)

### Task 1: `TASK.md` BE-32 중복 행 제거

`TASK.md` 백엔드 표에 BE-32가 76행·78행 두 번 등재돼 있다. 내용이 완전히 동일하므로 뒤쪽 1개만 지운다.

**Files:**
- Modify: `TASK.md:78`

- [ ] **Step 1: 중복을 실측으로 확인**

```bash
grep -c '^| BE-32 ' TASK.md
```

Expected: `2`

- [ ] **Step 2: 78행(두 번째 BE-32 행) 전체를 삭제**

`| BE-32 |  🟡 Medium   | 정책  | ...PRJ_STS_COUNCIL_DONE = "39"의 의미 확정 | ... |` 로 시작하는 **두 번째** 행만 삭제한다. 76행의 첫 번째 행은 그대로 둔다. BE-33 행(77행) 아래에 BE-32가 다시 오는 순서 자체가 중복의 흔적이다.

- [ ] **Step 3: 삭제 확인**

```bash
grep -c '^| BE-32 ' TASK.md
```

Expected: `1`

- [ ] **Step 4: 커밋**

```bash
git add TASK.md
git commit -m "docs: TASK.md BE-32 중복 행 제거"
```

---

### Task 2: FE-31 — `admin/menus` 관리 트리 가드 주석 정정

**Files:**
- Modify: `it_frontend/app/pages/admin/menus/index.vue:65-72`

- [ ] **Step 1: 현재 동작을 코드로 재확인**

61-62행이 `fetchAdminTree()`의 반환 객체(`adminTreeFetch`)를 그대로 78행 `useRefreshGuard(adminTreeFetch, ...)`에 넘긴다. `useRefreshGuard`는 204행에서 `target.enableKeepPreviousData?.()`를 생성 시점에 호출하므로 **보존이 실제로 켜진다**. 따라서 재조회 실패 시 `adminTree`는 undefined가 되지 않고 직전 정상값을 유지한다.

- [ ] **Step 2: 주석 블록을 교체**

기존 (65-72행):

```
/**
 * 관리 트리 재조회 실패 가드 (ERR-13)
 *
 * 사이드바 메뉴(`/api/menus`)와 **다른 조회**(`/api/admin/menus`)이며 독립적으로 실패한다.
 * 실패하면 `adminTree`가 undefined가 되어 **이 화면의 좌측 편집 트리가 비는데**, 사이드바
 * 가드의 문구는 전역 내비게이션을 말하므로 사용자가 빈 트리를 보며 다른 대상의 안내를 읽게 된다.
 * 그래서 가드를 합치지 않고 대상별로 하나씩 둔다 — 배너 문구가 실제로 빈 대상과 일치해야 한다.
 */
```

교체 후:

```
/**
 * 관리 트리 재조회 실패 가드 (ERR-13)
 *
 * 사이드바 메뉴(`/api/menus`)와 **다른 조회**(`/api/admin/menus`)이며 독립적으로 실패한다.
 * `fetchAdminTree()`가 `useApiFetch` 반환 객체를 그대로 돌려주고 이 화면이 그것을 가드에
 * 그대로 넘기므로 생성 시점에 `enableKeepPreviousData()`가 켜진다. 그래서 재조회가 실패해도
 * (401·403 제외) `adminTree`는 비지 않고 **직전 정상값을 그대로 유지**한다 — 좌측 편집 트리는
 * 빈 트리가 아니라 **낡은 값**으로 남는다.
 *
 * 그래서 배너가 더 중요하다. 화면이 멀쩡해 보이는 만큼 사용자가 낡은 값을 최신으로 오인하기
 * 쉽고, 사이드바 가드의 문구는 전역 내비게이션을 말하므로 대상이 어긋난다. 가드를 합치지 않고
 * 대상별로 하나씩 두는 이유다 — 배너 문구가 실제로 낡은 대상과 일치해야 한다.
 */
```

- [ ] **Step 3: 포맷·정적 분석 통과 확인**

```bash
cd it_frontend && npm run format:check && npm run check
```

Expected: 두 명령 모두 성공 종료(주석만 바뀌었으므로 오류 0건)

- [ ] **Step 4: 커밋**

```bash
cd it_frontend && git add app/pages/admin/menus/index.vue && git commit -m "docs: FE-31 관리 트리 가드 주석을 보존 도입 후 실제 동작에 맞춰 정정"
```

- [ ] **Step 5: `TASK.md`에서 FE-31 행 제거하고 `TASK_DONE.md`로 이관**

`TASK.md` 프론트엔드 표의 FE-31 행을 삭제하고 `TASK_DONE.md`에 2026-08-05 절로 옮긴다. 루트 저장소에서 커밋한다.

```bash
git add TASK.md TASK_DONE.md && git commit -m "docs: FE-31 완료 이관"
```

---

## Wave 1 — `it_backend` 단독

> Gradle 주의: `binary/output.bin` 파일락이 걸리면 `--no-daemon`으로 재실행한다. 백그라운드 셸은 cwd를 상속하지 않으므로 **항상 `cd it_backend`를 명령에 포함**한다.

### Task 3: BE-29 — 공통코드 CRUD를 `AdminCodeService`로 추출하고 `@CacheEvict` 적용

> **⚠️ 2026-08-05 개정 — 최초 계획이 CQ-01 동결선을 고려하지 못했다.**
>
> 최초 계획은 `AdminService`에 애노테이션만 더하는 것이었다. 실행 결과 `AdminService.java`가 866 → 888줄이 되어 **CQ-01 동결선 게이트(`MaxLinesRatchetTest`)가 깨졌다.** `src/test/resources/architecture/max-lines-baselines.properties`는 등재 파일의 실제 줄 수가 기준값과 **정확히 일치**할 것을 요구하므로(4행, 증가·감소 모두 실패), 이 파일에는 **한 줄도 더할 수 없다.**
>
> 첫 구현자는 기준값을 866→888로 올려 게이트를 통과시켰으나, 같은 파일 11행이 **"기준값 상향은 허용된 해소 수단이 아니다"**라고 명시한다. 8행이 지시하는 정공법은 **"기능 추가로 불가피하게 초과하면 같은 PR에서 동등 이상 분량을 추출해 상쇄한다"**이다.
>
> 참고로 `@Caching` 래퍼 대신 반복 가능 `@CacheEvict`를 쓰는 대안은 증가분을 22→~9줄로 줄일 뿐, 875 ≠ 866이라 게이트는 그대로 깨진다. **증가량이 아니라 증가 자체가 막힌다.**
>
> 사용자 결정(2026-08-05): **추출로 상쇄한다.** 공통코드 CRUD를 `AdminCodeService`로 분리하면 `@CacheEvict`는 새 서비스에 붙고 `AdminService`는 줄어 기준선을 낮추거나 지울 수 있다. `TASK.md` CQ-01의 "나머지 서비스 분해는 **트리거 유지** — 해당 도메인 기능 변경 착수 시 수행"이라는 원칙과도 정합한다(BE-29가 그 트리거다). **Task 4(BE-26)도 같은 파일을 늘리므로 이 추출이 함께 해소한다.**

`AdminService`는 `CodeService`와 같은 `CodeRepository`로 코드를 쓰지만 캐시 애노테이션이 하나도 없어, 관리자 화면에서 코드를 바꿔도 `codesByCid`/`budgetPeriod` 캐시가 최대 1시간 stale로 남는다. `it_backend/CLAUDE.md` §4는 "`@Cacheable` 원본을 변경하는 모든 쓰기 경로에 영향 범위에 맞는 `@CacheEvict`를 적용하고 TTL을 정합성 보장의 주 수단으로 쓰지 않는다"를 요구한다.

**Files (개정):**
- Create: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminCodeService.java` — 공통코드 섹션(구 `AdminService` 65~367행)의 public 5개(`getCodes`·`createCode`·`updateCode`·`deleteCode`·`bulkUpsertCodes`)와 private(`record CodeKey`·`validateCodeKey`·`toCodeResponse`)를 **순수 이동**. 쓰기 4개에 `@Caching(evict=...)` 적용.
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java` — 공통코드 섹션 제거, 미사용 import·필드 제거, 클래스 JavaDoc 정정.
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/controller/AdminController.java` — 공통코드 엔드포인트 5개의 배선만 변경. **URL·HTTP 메서드·DTO·`@PreAuthorize`·`@Operation` 문자열 불변**(바뀌면 프론트 `codegen:check` 드리프트).
- Test: `AdminCodeServiceTest.java`(신규, 기존 `AdminServiceTest`에서 이동) · `AdminCodeServiceCacheEvictTest.java`(신규 리플렉션 회귀) · `AdminServiceTest.java`(이동분 제거) · `AdminControllerTest.java`·`AdminSecurityBoundaryTest.java`(`@MockitoBean` 추가)
- Modify: `it_backend/src/test/resources/architecture/max-lines-baselines.properties` — `AdminService.java` 실측이 800 이하면 **항목 삭제**, 초과면 실측값으로 **하향**. **상향 금지.**

**실행 결과(2026-08-05, 커밋 `699dbbb`):** `AdminService.java` 866 → **581줄** → 800 이하이므로 기준선 항목 **삭제**. `AdminCodeService.java` **346줄**(신규 등재 불필요). `./gradlew check` BUILD SUCCESSFUL.

아래 원본 Step 1~7은 최초(애노테이션만 추가) 절차의 기록이다. 실제 실행은 위 개정 방향을 따랐다.

- [ ] **Step 1: 실패하는 테스트를 작성**

애노테이션 존재 자체를 리플렉션으로 고정한다. 캐시 동작 통합 테스트는 컨텍스트 기동이 필요해 무겁고, 여기서 막고 싶은 회귀는 "쓰기 메서드에 evict를 빠뜨리는 것"이다.

Create `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceCacheEvictTest.java`:

```java
package com.kdb.it.common.admin.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;

/**
 * BE-29 회귀 방지: AdminService의 공통코드 쓰기 경로는 CodeService와 같은 CodeRepository를
 * 쓰므로 같은 캐시(codesByCid·budgetPeriod)를 반드시 무효화해야 합니다.
 */
class AdminServiceCacheEvictTest {

    @ParameterizedTest
    @ValueSource(strings = {"createCode", "updateCode", "deleteCode", "bulkUpsertCodes"})
    @DisplayName("공통코드 쓰기 메서드는 codesByCid·budgetPeriod를 allEntries로 무효화한다")
    void 공통코드_쓰기메서드_캐시무효화_적용됨(String methodName) {
        Method method =
                Arrays.stream(AdminService.class.getDeclaredMethods())
                        .filter(m -> m.getName().equals(methodName))
                        .findFirst()
                        .orElseThrow(() -> new AssertionError("메서드를 찾을 수 없습니다: " + methodName));

        Caching caching = method.getAnnotation(Caching.class);
        assertThat(caching).as("%s에 @Caching(evict=...)가 없습니다 (BE-29)", methodName).isNotNull();

        List<String> evictedCaches =
                Arrays.stream(caching.evict())
                        .map(CacheEvict::value)
                        .flatMap(Arrays::stream)
                        .toList();

        assertThat(evictedCaches).contains("codesByCid", "budgetPeriod");
        assertThat(caching.evict()).allMatch(CacheEvict::allEntries);
    }
}
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd it_backend && ./gradlew test --tests '*AdminServiceCacheEvictTest*'
```

Expected: FAIL — 4개 파라미터 전부 `@Caching(evict=...)가 없습니다 (BE-29)`

- [ ] **Step 3: import 추가**

`AdminService.java`의 import 블록(27~33행)에서 `lombok.RequiredArgsConstructor` 다음, `org.springframework.data.domain.Page` 앞에 삽입한다:

```java
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Caching;
```

- [ ] **Step 4: 4개 메서드에 evict 블록 추가**

`createCode`(94행), `updateCode`(140행), `deleteCode`(220행), `bulkUpsertCodes`(244행)의 각 `@Transactional` **바로 아래**에 동일 블록을 넣는다. `CodeService.java:116-120`과 같은 형태다.

```java
    @Transactional
    @Caching(
            evict = {
                @CacheEvict(value = "budgetPeriod", allEntries = true),
                @CacheEvict(value = "codesByCid", allEntries = true)
            })
    public void createCode(AdminDto.CodeRequest req) {
```

`updateCode`·`deleteCode`·`bulkUpsertCodes`도 시그니처만 다르고 애노테이션 블록은 글자 그대로 같다.

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --tests '*AdminServiceCacheEvictTest*'
```

Expected: PASS (4 파라미터 전부)

- [ ] **Step 6: 전체 품질 게이트**

```bash
cd it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL (Spotless 포맷 + JaCoCo 커버리지 검증 포함)

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/admin/service/AdminService.java src/test/java/com/kdb/it/common/admin/service/AdminServiceCacheEvictTest.java && git commit -m "fix: BE-29 AdminService 공통코드 CRUD에 CacheEvict 적용"
```

---

### Task 4: BE-26 — `getOrganizations`의 등록·변경자명 N+1 제거

`toOrgResponse`가 행마다 `resolveUserName(String)`(811행)을 호출해 단건 쿼리를 낸다. 같은 클래스의 `getCodes`(72-86행)가 이미 배치 패턴의 모범형이고, 필요한 헬퍼 `loadUserNameMap`(822행)과 `resolveUserName(eno, map)`(839행)도 이미 있다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminService.java:639-640, 696-710`
- Test: `it_backend/src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java` (기존 파일에 추가)

- [ ] **Step 1: 실패하는 테스트를 작성**

`AdminServiceTest`에 다음 테스트를 추가한다. 조직 2건에 서로 다른 등록자·변경자가 있어도 **배치 조회 1회**만 나가는 것을 고정한다.

```java
    @Test
    @DisplayName("getOrganizations: 등록자·변경자명을 배치 1회로 조회한다 (BE-26 N+1 방지)")
    void getOrganizations_사용자명_배치조회_1회() {
        OrganizationRepository.OrganizationAdminView first =
                mock(OrganizationRepository.OrganizationAdminView.class);
        given(first.getPrlmOgzCCone()).willReturn("120");
        given(first.getFstEnrUsid()).willReturn("E001");
        given(first.getLstChgUsid()).willReturn("E002");
        OrganizationRepository.OrganizationAdminView second =
                mock(OrganizationRepository.OrganizationAdminView.class);
        given(second.getPrlmOgzCCone()).willReturn("130");
        given(second.getFstEnrUsid()).willReturn("E003");
        given(second.getLstChgUsid()).willReturn("E004");

        given(orgRepository.findAdminViewsByDelYn("N")).willReturn(List.of(first, second));
        given(userRepository.findNameViewsByEnoIn(anySet())).willReturn(List.of());

        adminService.getOrganizations();

        // 배치 조회는 정확히 1회, 단건 조회는 0회여야 한다
        verify(userRepository, times(1)).findNameViewsByEnoIn(anySet());
        verify(userRepository, never()).findNameViewByEno(anyString());
    }
```

`AdminServiceTest`의 기존 mock 필드명(`orgRepository`·`userRepository`·`adminService`)을 그대로 사용한다. 기존 파일에 없는 import(`static org.mockito.ArgumentMatchers.anySet`, `anyString`, `static org.mockito.Mockito.never`, `times`, `verify`, `mock`)만 추가한다. `getOrganizations`가 `mock`으로 만든 프로젝션의 나머지 게터를 호출하면 Mockito 기본값(`null`/`0`)이 돌아오므로 별도 stubbing이 필요 없다.

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd it_backend && ./gradlew test --tests '*AdminServiceTest*'
```

Expected: FAIL — `findNameViewByEno`가 4회 호출되어 `never()` 단언 위반

- [ ] **Step 3: `getOrganizations`를 배치 패턴으로 교체**

기존 (639-640행):

```java
    public List<AdminDto.OrgResponse> getOrganizations() {
        return orgRepository.findAdminViewsByDelYn("N").stream().map(this::toOrgResponse).toList();
    }
```

교체 후:

```java
    public List<AdminDto.OrgResponse> getOrganizations() {
        List<OrganizationRepository.OrganizationAdminView> organizations =
                orgRepository.findAdminViewsByDelYn("N");

        // 감사 필드의 고유 ENO를 한 번의 배치 쿼리로 이름 조회 (N+1 방지 — BE-26)
        Map<String, String> userNameMap =
                loadUserNameMap(
                        organizations.stream()
                                .flatMap(o -> Stream.of(o.getFstEnrUsid(), o.getLstChgUsid())));

        return organizations.stream().map(o -> toOrgResponse(o, userNameMap)).toList();
    }
```

`List`·`Map`·`Stream` import는 21·22·26행에 이미 있다.

- [ ] **Step 4: `toOrgResponse`가 맵을 받도록 변경**

기존 696-710행의 시그니처와 사용자명 인자 2개만 바꾼다:

```java
    /** 관리자 조직 프로젝션을 OrgResponse DTO로 변환합니다. 사용자명은 배치 조회된 맵에서 찾습니다. */
    private AdminDto.OrgResponse toOrgResponse(
            OrganizationRepository.OrganizationAdminView o, Map<String, String> userNameMap) {
        return new AdminDto.OrgResponse(
                o.getPrlmOgzCCone(),
                o.getBbrNm(),
                o.getBbrWrenNm(),
                o.getItmSqnSno(),
                o.getPrlmHrkOgzCCone(),
                o.getFstEnrDtm(),
                o.getFstEnrUsid(),
                resolveUserName(o.getFstEnrUsid(), userNameMap),
                o.getLstChgDtm(),
                o.getLstChgUsid(),
                resolveUserName(o.getLstChgUsid(), userNameMap));
    }
```

> 동작 차이 1건: 단건 `resolveUserName`은 미등록 사번에 ENO 원문을 돌려주고, 맵 버전(839-844행)도 `getOrDefault(eno, eno)`로 같다. 다만 `loadUserNameMap`은 `usrNm`이 null인 사용자를 필터링하므로 이름이 null인 등록 사용자도 ENO 원문으로 표시된다 — 종전 단건 경로는 null을 그대로 반환했다. `getCodes`가 이미 같은 규칙이므로 관리자 화면 전체가 일관되는 방향이다.

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_backend && ./gradlew test --tests '*AdminServiceTest*'
```

Expected: PASS (신규 테스트 + 기존 `AdminServiceTest` 전부)

- [ ] **Step 6: 전체 품질 게이트**

```bash
cd it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL

- [ ] **Step 7: 커밋**

```bash
cd it_backend && git add src/main/java/com/kdb/it/common/admin/service/AdminService.java src/test/java/com/kdb/it/common/admin/service/AdminServiceTest.java && git commit -m "perf: BE-26 getOrganizations 등록·변경자명 배치 조회로 N+1 제거"
```

- [ ] **Step 8: 과제 이관**

루트에서 `TASK.md`의 BE-26·BE-29 행을 `TASK_DONE.md`로 옮기고 커밋한다.

```bash
git add TASK.md TASK_DONE.md && git commit -m "docs: BE-26·BE-29 완료 이관"
```

---

## Wave 2 — `it_frontend` 단독

### Task 5: FE-24 — `useBoard`에 명시 `key`를 주어 관리자/공개 화면 분리

`useBoard.ts:49`가 키 없이 `${BASE}/boards/meta`를 열어 `admin/boards/index.vue`와 공개 게시판 화면이 같은 asyncData 키를 공유한다. 그래서 ERR-13에서 `enableKeepPreviousData` 노출을 포기했고, 결과적으로 관리자 화면은 재조회 실패 시 목록이 빈다. 화면별 키를 주면 파급이 끊겨 보존을 되살릴 수 있다.

**Files:**
- Modify: `it_frontend/app/composables/useBoard.ts:15-49` (JSDoc + 시그니처 + 반환)
- Modify: `it_frontend/app/pages/admin/boards/index.vue:20, 23-36` (호출부 + 가드 JSDoc)
- Test: `it_frontend/tests/unit/pages/refresh-banner-visibility.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성**

이 테스트 파일에는 아직 `admin/boards` describe 블록이 없다. 새로 추가한다. 배선은 같은 파일 256-309행(`board/[blbMngNo]/[nacMngNo]/index.vue` 케이스)의 `routeFetchFakes` + `collect` 패턴을 그대로 따른다 — 화면이 노출하지 않는 재조회 경로를 테스트가 직접 밟아야 하기 때문이다.

`info/documents/list.vue` describe 블록(576행) **다음**에 추가한다:

```typescript
describe('admin/boards/index.vue — 재조회 실패 시 보존된 목록 (FE-24)', () => {
    it('재조회가 실패해도 보존된 게시판 목록이 남는다', async () => {
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
        const metaFake = createNuxtFetchFake<unknown[]>({
            value: [{ blbMngNo: 'BLB-1', blbNm: '공지사항', useYn: 'Y' }],
        });
        const metaInstances: { refresh: () => Promise<unknown> }[] = [];
        vi.stubGlobal(
            'useFetch',
            routeFetchFakes([
                {
                    match: '/api/boards/meta',
                    useFetch: metaFake.useFetch,
                    collect: metaInstances as unknown[],
                },
            ]),
        );

        const { wrapper } = await mountKeepAlivePage(
            () => import('~/pages/admin/boards/index.vue'),
        );
        expect(wrapper.find('.datatable-stub').attributes('data-rows')).toBe('1');

        /* 재조회만 실패시킨다 — key 분리 전에는 보존이 꺼져 있어 목록이 빈다 */
        metaFake.control.behavior = 'fail';
        await metaInstances[0]!.refresh();
        await flushPromises();

        expect(wrapper.find('.datatable-stub').attributes('data-rows')).toBe('1');

        errorSpy.mockRestore();
        wrapper.unmount();
    });
});
```

`.datatable-stub`/`data-rows`는 이 파일의 기존 규약이다(229-253행 `info/plan/index.vue` 케이스와 동일). `admin/boards/index.vue:12`가 `StyledDataTable`을 명시 import하므로 같은 스텁이 걸린다. 렌더 결과가 다르면 **단언 셀렉터만** 실제 렌더에 맞추고 나머지 구조는 유지한다.

> **대역 함정 주의(FE-32):** `createNuxtFetchFake`는 성공 시 `control.value`를 그대로 재대입하므로 같은 대역으로 성공을 2회 재현하면 `shallowRef`가 변경을 감지하지 못한다. 위 테스트는 성공 → 실패 순서라 걸리지 않는다. 성공을 두 번 내도록 확장하려면 `control.value`를 매번 **새 배열로** 갈아 끼운다(`useCostPersistence.test.ts`의 우회 방식과 동일).

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/refresh-banner-visibility.test.ts
```

Expected: FAIL — 재조회 실패 후 목록이 비어 단언 불일치

- [ ] **Step 3: `useBoard`가 키를 받고 보존 스위치를 노출하도록 변경**

37-49행:

```typescript
export const useBoard = (options: { key?: string } = {}) => {
    const config = useRuntimeConfig();
    const { $apiFetch } = useNuxtApp();
    const BASE = `${config.public.apiBase}/api`;

    const {
        data: boards,
        pending,
        error,
        status,
        refresh,
        runWithErrorToastSuppressed,
        enableKeepPreviousData,
    } = useApiFetch<BoardMeta[]>(`${BASE}/boards/meta`, { key: options.key });
```

파일 하단의 `return { ... }`에도 `enableKeepPreviousData`를 추가한다. `key`가 `undefined`면 Nuxt가 종전대로 URL 기반 키를 만들므로 공개 화면 동작은 그대로다.

- [ ] **Step 4: JSDoc의 비노출 사유를 정정**

25-35행의 "`enableKeepPreviousData`는 의도적으로 노출하지 않는다" 문단을 다음으로 교체한다:

```
 *   **보존 스위치는 `key`로 화면을 분리한 뒤에만 안전하다** (FE-24). 이 파사드가 여는
 *   `${BASE}/boards/meta`는 `admin/boards/index.vue`(관리자 전용) 외에 `board/index.vue`·
 *   `board/[blbMngNo]/index.vue`(공개 화면)도 연다. Nuxt는 같은 키의 최초 인스턴스가 만든
 *   `default`만 보관하므로 키를 공유하면 관리자 화면이 켠 보존이 공개 화면까지 샌다.
 *   그래서 `admin/boards/index.vue`만 `useBoard({ key: 'admin-board-meta' })`로 별도 키를
 *   열고 공개 화면은 기본 키를 그대로 쓴다. 키가 분리된 뒤이므로 `enableKeepPreviousData`를
 *   노출해도 파급이 없다.
```

- [ ] **Step 5: 관리자 화면 호출부를 변경**

`it_frontend/app/pages/admin/boards/index.vue:20`을 다음으로 바꾼다:

```typescript
const boardResource = useBoard({ key: 'admin-board-meta' });
```

21행의 구조분해(`const { boards, pending, createBoard, updateBoard, deleteBoard } = boardResource;`)와 가드에 `boardResource`를 그대로 넘기는 배선(37행 이하)은 이미 올바르므로 손대지 않는다.

- [ ] **Step 6: 관리자 화면의 가드 JSDoc도 정정**

23-36행 JSDoc에 "**마지막 정상값 보존(3keep)은 켜지지 않는다**" ... "재조회 실패 시 목록이 비는 것을 감수한다"는 서술이 남아 있다. 키를 분리했으므로 사실과 달라진다. 해당 문단을 다음으로 교체한다:

```
 * **마지막 정상값 보존(3keep)이 켜진다** (FE-24). 종전에는 `useBoard`가 여는 `/boards/meta`를
 * 공개 게시판 화면과 같은 asyncData 키로 공유해 보존이 그쪽까지 샜기 때문에 스위치 자체를
 * 노출하지 않았다. 이 화면만 `key: 'admin-board-meta'`로 별도 키를 열어 파급을 끊었으므로
 * 재조회가 실패해도(401·403 제외) 목록은 비지 않고 직전 정상값으로 남는다 — 배너는 "무엇을
 * 못 불러왔는지"를 설명하는 역할에 집중한다.
```

- [ ] **Step 7: 테스트 통과 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/refresh-banner-visibility.test.ts
```

Expected: PASS — 신규 케이스와 기존 케이스 전부. 특히 **공개 게시판 화면 케이스(256·311행)가 그대로 통과해야** 키 분리가 공개 화면에 영향을 주지 않았음이 확인된다.

- [ ] **Step 8: 프론트 게이트 전체**

```bash
cd it_frontend && npm run format:check && npm run check && npm test
```

Expected: 전부 성공

- [ ] **Step 9: 커밋**

```bash
cd it_frontend && git add app/composables/useBoard.ts app/pages/admin/boards/index.vue tests/unit/pages/refresh-banner-visibility.test.ts && git commit -m "fix: FE-24 useBoard 명시 key로 관리자·공개 화면 분리 후 재조회 보존 복원"
```

---

### Task 6: FE-33 — 게시판 첨부 업로드·삭제 뒤 재조회를 가드 경로로 전환

`useBoardAttachments.ts` 238·275행이 가드의 `attemptRefresh`가 아니라 원시 `refresh()`를 호출한다. 보존은 이미 켜져 있어(160-165행에서 가드 생성) 데이터는 남지만 `refreshFailed` 배너가 절대 세팅되지 않아, 사용자는 낡은 목록을 최신으로 오인한다. `edit.vue`에는 첨부 삭제 UI가 있어 실제로 밟히는 경로다.

**Files:**
- Modify: `it_frontend/app/composables/useBoardAttachments.ts:238, 275`
- Test: `it_frontend/tests/unit/pages/refresh-banner-visibility.test.ts:352` 부근

- [ ] **Step 1: 실패하는 테스트를 작성**

311-362행의 `edit.vue` 케이스가 이미 이 경로를 정확히 밟는다(삭제 버튼 클릭 → 삭제 성공 → 뒤따르는 목록 재조회만 실패). 배너 단언만 없다. 355-357행의 보존 단언 **바로 아래**에 다음을 추가한다:

```typescript
        /* FE-33: 이 재조회도 가드를 거치므로 "다시 조회" 배너가 함께 떠야 한다.
           보존만 되고 배너가 없으면 사용자가 낡은 목록을 최신으로 오인한다. */
        expect(wrapper.find('.message-stub').exists()).toBe(true);
```

`.message-stub`은 이 파일의 배너 단언 규약이다(246행 `info/plan/index.vue` 케이스와 동일).

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/refresh-banner-visibility.test.ts
```

Expected: FAIL — 배너가 렌더되지 않음

- [ ] **Step 3: 업로드 경로(238행)를 교체**

기존:

```typescript
            await refresh();
```

교체 후:

```typescript
            await attemptRefresh(
                '첨부파일은 업로드되었지만 목록을 다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
            );
```

- [ ] **Step 4: 삭제 경로(275행)를 교체**

기존:

```typescript
            if (targetGeneration === parentGeneration && targetParentId === parentId.value) {
                await refresh();
            }
```

교체 후:

```typescript
            if (targetGeneration === parentGeneration && targetParentId === parentId.value) {
                await attemptRefresh(
                    '첨부파일은 삭제되었지만 목록을 다시 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.',
                );
            }
```

두 문구 모두 쓰기가 선행한 지점(Class B)이므로 `useRefreshGuard.ts` 29-31행의 규칙대로 "쓰기는 반영되었고 목록만 못 불러왔다"를 분명히 한다.

- [ ] **Step 5: 테스트 통과 확인**

```bash
cd it_frontend && npx vitest run tests/unit/pages/refresh-banner-visibility.test.ts && npm test
```

Expected: PASS

- [ ] **Step 6: 커밋**

```bash
cd it_frontend && git add app/composables/useBoardAttachments.ts tests/unit/pages/refresh-banner-visibility.test.ts && git commit -m "fix: FE-33 게시판 첨부 업로드·삭제 후 재조회를 가드 경로로 전환"
```

---

### Task 7: FE-22 — `useRefreshGuard`에 Toast 억제 옵션 추가

C-3 지점(`onActivated` 재조회·툴바 새로고침·검색/페이징)은 KeepAlive 재방문마다 실행되므로, 백엔드가 지속적으로 400/409/422를 내면 탭을 오갈 때마다 Toast가 반복된다. 배너만으로도 `it_frontend/CLAUDE.md` §2("toast 또는 화면 상태")를 만족하므로 지점별로 Toast를 끌 수 있게 한다.

**Files:**
- Modify: `it_frontend/app/composables/useRefreshGuard.ts:99-117, 193-199, 242-253`
- Test: `it_frontend/tests/unit/composables/useRefreshGuard.test.ts`

- [ ] **Step 1: 실패하는 테스트를 작성**

```typescript
    it("notifyMode: 'banner'면 실패해도 Toast를 띄우지 않고 배너 상태만 남긴다", async () => {
        const toast = { add: vi.fn() } as unknown as ToastServiceMethods;
        await effectScope().run(async () => {
            const target = createFailingTarget();
            const guard = useRefreshGuard(target, { toast, notifyMode: 'banner' });

            const outcome = await guard.attemptRefresh('목록을 불러오지 못했습니다.');

            expect(outcome).toBe('failed');
            expect(guard.refreshFailed.value).toBe(true);
            expect(guard.refreshFailureDetail.value).toBe('목록을 불러오지 못했습니다.');
            expect(toast.add).not.toHaveBeenCalled();
        });
    });
```

`createFailingTarget` 상당의 헬퍼가 이 파일에 없으면 기존 실패 케이스가 쓰는 대역 구성 방식을 그대로 재사용한다(가드는 활성 effect scope를 요구하므로 `effectScope().run()` 감싸기는 필수다).

- [ ] **Step 2: 테스트가 실패하는 것을 확인**

```bash
cd it_frontend && npx vitest run tests/unit/composables/useRefreshGuard.test.ts
```

Expected: FAIL — `notifyMode`가 타입에 없고(타입 오류) Toast가 1회 호출됨

- [ ] **Step 3: 옵션 타입에 `notifyMode` 추가**

`RefreshGuardOptions`(99-117행)의 `keepPreviousData` 아래에 추가한다:

```typescript
    /**
     * 실패 안내 채널 (기본 `'toast+banner'`).
     *
     * `'banner'`로 두면 배너 상태·진단 로그만 남기고 Toast를 띄우지 않는다. KeepAlive
     * `onActivated` 재조회처럼 **사용자가 명시적으로 일으키지 않은 반복 실행 지점**에서
     * 탭을 오갈 때마다 Toast가 반복되는 것을 막기 위한 옵션이다(FE-22). 배너만으로도
     * `it_frontend/CLAUDE.md` §2의 "toast 또는 화면 상태" 요건은 만족한다.
     * 쓰기가 선행한 지점(Class B)에는 쓰지 않는다 — 저장 직후의 실패는 즉시 알려야 한다.
     */
    notifyMode?: 'toast+banner' | 'banner';
```

- [ ] **Step 4: 옵션 구조분해에 기본값 추가**

193-199행 구조분해의 `keepPreviousData = true,` 다음 줄에 넣는다:

```typescript
        notifyMode = 'toast+banner',
```

- [ ] **Step 5: Toast 호출을 조건부로 변경**

242-253행 실패 분기를 다음으로 바꾼다:

```typescript
        if (outcome === 'failed') {
            console.error(`${logLabel}:`, cause);
            refreshFailed.value = true;
            refreshFailureDetail.value = failureDetail;
            /* 진단 로그와 배너는 항상 남긴다 — Toast만 지점별로 끌 수 있다 (FE-22) */
            if (notifyMode === 'toast+banner') {
                toast.add({
                    severity: 'error',
                    summary,
                    detail: failureDetail,
                    life: TOAST_LIFE.ERROR,
                });
            }
            return 'failed';
        }
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
cd it_frontend && npx vitest run tests/unit/composables/useRefreshGuard.test.ts && npm test
```

Expected: PASS — 신규 케이스와 기존 케이스 전부. 기본값이 종전 동작이므로 회귀가 없어야 한다.

- [ ] **Step 7: 커밋**

```bash
cd it_frontend && git add app/composables/useRefreshGuard.ts tests/unit/composables/useRefreshGuard.test.ts && git commit -m "feat: FE-22 useRefreshGuard에 notifyMode 옵션 추가"
```

- [ ] **Step 8: `TASK.md` FE-22 항목을 갱신**

이 Task는 **옵션 추가까지만** 한다. 어느 C-3 지점에 `notifyMode: 'banner'`를 적용할지는 화면별 판단이므로, FE-22 항목을 "옵션 도입 완료 — 지점별 적용 잔여"로 고쳐 남긴다.

---

### Task 8: FE-19 — stylelint 자동 수정 가능 위반 일괄 해소

**측정 정정:** `TASK.md`의 `411건/28파일`은 2026-08-01 값이다. 2026-08-05 재실측 결과 **302건/26파일**이다. 규칙별 분포:

| 건수 | 규칙 | `--fix` 대상 |
| ---: | --- | :---: |
| 122 | `rule-empty-line-before` | ✅ |
| 81 | `selector-class-pattern` | ❌ (vendor vs 자체 BEM 정책 확정 필요) |
| 61 | `color-no-hex` | ❌ (디자인 토큰 치환 필요) |
| 8 | `at-rule-empty-line-before` | ✅ |
| 6 | `color-hex-length` | ✅ |
| 4 | `declaration-property-value-disallowed-list` | ❌ |
| 4 | `no-descending-specificity` | ❌ |
| 3 | `declaration-empty-line-before` | ✅ |
| 13 | 나머지(표기 정규화·중복 속성 등) | 일부 ✅ |

이 Task는 **`--fix`로 자동 해소되는 것만** 처리하고, `selector-class-pattern`·`color-no-hex`는 FE-19에 남긴다.

**Files:**
- Modify: `it_frontend/app/**/*.vue` (자동 수정)
- Modify: `it_frontend/.stylelintrc.json:45-76` (0건이 된 파일만 `ignoreFiles`에서 제거)

- [ ] **Step 1: `ignoreFiles`를 우회하는 측정용 설정을 만든다**

`.stylelintrc.json`의 `ignoreFiles`가 대상 파일을 전부 제외하므로 프로젝트 설정으로는 측정도 수정도 되지 않는다(그냥 실행하면 위반 0건으로 보인다). 스크래치패드에 1~44행을 그대로 복사하고 45~76행의 `ignoreFiles` 블록만 뺀 사본을 `<scratch>/stylelint-measure.json`으로 저장한다. **저장소에 커밋하지 않는다.**

- [ ] **Step 2: 수정 전 건수를 기록**

```bash
cd it_frontend && npx stylelint "app/**/*.vue" --config <scratch>/stylelint-measure.json --config-basedir "C:\it\it_frontend" --formatter json --output-file <scratch>/before.json
```

Expected: 종료 코드 2(위반 존재), `before.json` 기준 302건/26파일

> `--config-basedir`가 없으면 `extends`·`customSyntax`가 해석되지 않아 `ConfigurationError`(종료 코드 78)가 난다. `--formatter json`은 stdout으로 흘리면 셸에서 유실될 수 있으므로 `--output-file`로 받는다.

- [ ] **Step 3: 자동 수정 실행**

```bash
cd it_frontend && npx stylelint "app/**/*.vue" --config <scratch>/stylelint-measure.json --config-basedir "C:\it\it_frontend" --fix
```

- [ ] **Step 4: 수정 후 건수를 측정하고 0건이 된 파일을 추린다**

```bash
cd it_frontend && npx stylelint "app/**/*.vue" --config <scratch>/stylelint-measure.json --config-basedir "C:\it\it_frontend" --formatter json --output-file <scratch>/after.json
```

Expected: 총 건수가 302 → 약 160건대로 감소. `after.json`에서 `warnings`가 빈 배열인 파일 경로를 뽑는다.

- [ ] **Step 5: 0건이 된 파일만 `ignoreFiles`에서 제거**

`.stylelintrc.json`의 `ignoreFiles` 배열에서 Step 4가 뽑은 경로를 지운다. 위반이 남은 파일은 그대로 둔다. **`app/assets/css/tokens.css`·`primevue.css`·`app/components/editor/styles/tiptap-editor.css` 3개는 FE-19의 SFC grandfather 대상이 아니므로 손대지 않는다.**

- [ ] **Step 6: 프로젝트 설정으로 게이트가 통과하는지 확인**

```bash
cd it_frontend && npm run lint:css
```

Expected: 성공 종료 — grandfather를 푼 파일이 실제로 게이트를 통과함

- [ ] **Step 7: 시각 회귀가 없는지 diff로 확인**

`--fix`가 건드린 것은 빈 줄과 hex 축약 표기이므로 렌더 결과는 바뀌지 않아야 한다. **선택자·속성값이 바뀐 hunk가 하나도 없는지** 확인한다.

```bash
cd it_frontend && git diff
```

Expected: 변경 내용이 빈 줄 추가/삭제와 `#ffffff` → `#fff` 류뿐. 그 밖의 hunk가 보이면 그 파일만 되돌리고 FE-19에 남긴다.

- [ ] **Step 8: 나머지 프론트 게이트**

```bash
cd it_frontend && npm run format:check && npm test
```

Expected: 전부 성공

- [ ] **Step 9: 커밋**

```bash
cd it_frontend && git add app .stylelintrc.json && git commit -m "style: FE-19 stylelint 자동 수정 가능 위반 해소 후 ignoreFiles 축소"
```

- [ ] **Step 10: `TASK.md` FE-19 항목의 실측 수치를 갱신**

측정 정정(411/28 → 302/26 → 수정 후 실측값)과 잔여 규칙(`selector-class-pattern` 81 · `color-no-hex` 61)을 반영하고, `ignoreFiles` 잔여 파일 목록을 실제와 맞춘다. 항목 자체는 잔여가 있으므로 `TASK.md`에 남긴다.

---

### Task 9: FE-30 ③ — `scripts/codegen.mjs`를 ESLint 검사 대상에 편입

codegen 스크립트가 정적 분석 게이트 밖에 있어, `npm run codegen:check`가 CI 게이트로 동작하는데도 스크립트 자체의 결함은 걸러지지 않는다.

**Files:**
- Modify: `it_frontend/eslint.config.mjs`

- [ ] **Step 1: 현재 제외되고 있음을 확인**

```bash
cd it_frontend && npx eslint scripts/codegen.mjs
```

Expected: 검사되지 않음(패턴 미매치 또는 ignore 경고)

- [ ] **Step 2: `ignores`에서 `scripts/**`를 빼고 전용 블록을 추가**

`eslint.config.mjs:19`의 `'scripts/**',`를 삭제하고, 같은 `.append(...)` 인자 목록에서 `tests/**/*.ts` 블록(34-43행) **앞**에 다음 블록을 넣는다. `scripts/`는 타입 정보가 없는 Node 실행 스크립트이므로 type-aware 규칙을 끄고 Node 전역만 연다.

```javascript
    // FE-30: codegen 등 빌드 스크립트도 정적 분석 대상에 포함한다. 다만 tsconfig 프로젝트에
    // 속하지 않아 type-aware 규칙은 적용할 수 없으므로 해당 규칙만 끈다.
    {
        files: ['scripts/**/*.mjs'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                process: 'readonly',
                console: 'readonly',
                fetch: 'readonly',
                URL: 'readonly',
                Buffer: 'readonly',
                __dirname: 'readonly',
            },
        },
        rules: {
            '@typescript-eslint/no-unsafe-assignment': 'off',
            '@typescript-eslint/no-unsafe-member-access': 'off',
            '@typescript-eslint/no-unsafe-call': 'off',
            '@typescript-eslint/no-unsafe-argument': 'off',
            '@typescript-eslint/no-unsafe-return': 'off',
        },
    },
```

`eslint.config.mjs` 자체와 `tailwind.config.js`는 `ignores`에 그대로 둔다 — 이 Task의 대상이 아니다. type-aware 규칙이 여전히 `scripts/`에 걸려 "not found in project" 파싱 오류가 나면, 이 블록에 `languageOptions.parserOptions = { project: null }`을 추가한다.

- [ ] **Step 3: 검사가 실제로 도는지 확인**

```bash
cd it_frontend && npx eslint scripts/codegen.mjs
```

Expected: 파일이 검사됨. 위반이 나오면 **스크립트 로직은 바꾸지 말고** 규칙 위반만 최소 수정한다 — 이 Task의 범위는 게이트 편입이다.

- [ ] **Step 4: 전체 정적 분석 통과 확인**

```bash
cd it_frontend && npm run check && npm run codegen:check
```

Expected: `check` 성공. `codegen:check`는 백엔드 기동이 필요하므로 여기서는 실패해도 무방하며, Task 10에서 확인한다.

- [ ] **Step 5: 커밋**

```bash
cd it_frontend && git add eslint.config.mjs scripts/codegen.mjs && git commit -m "chore: FE-30 codegen 스크립트를 ESLint 검사 대상에 편입"
```

---

## Wave 3 — 크로스 레포 (4-repo 규약 적용)

### Task 10: BE-31 — Swagger `description`의 레거시 파라미터명 정정 + `api.d.ts` 재생성

공통 첨부파일 API의 실제 파라미터는 `pkColNm`·`pkCone`·`flTpCone`인데 `GuideDocController`의 `@Operation(description=...)` 2곳이 아직 `orcDtt=가이드문서`, `orcPkVl={docMngNo}`로 안내한다. 이 문자열이 OpenAPI 스펙을 타고 `it_frontend/app/types/api.d.ts` 220·1003행에 그대로 실려 있어, 실제로 `guide/index.vue`가 잘못된 파라미터로 호출해 400을 냈던 전례가 있다(2026-08-01 `fe5be3b`에서 수정).

> **순서 규약:** 백엔드 계약 커밋을 **먼저** 만들고 프론트 재생성 커밋을 뒤이어 만든다. 두 커밋 사이에 `npm run codegen:check`가 드리프트로 실패하는 것은 **정상**이다.

> **CQ-01 후속 확인과 겹친다:** `TASK.md` CQ-01에 "`CouncilController` 7분해로 `paths` **순서**가 바뀌었을 수 있어 `codegen:check`가 붉게 뜰 수 있다"는 미확인 잔여가 있다. 이 Task가 그 확인 기회다 — Step 6에서 diff를 반드시 분류한다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/document/controller/GuideDocController.java:89, 126`
- Regenerate: `it_frontend/app/types/api.d.ts`
- Modify: `versions.lock`

- [ ] **Step 1: 생성 API 설명(89행)을 정정**

기존:

```java
                            + "첨부파일은 생성 후 POST /api/files (orcDtt=가이드문서, orcPkVl={docMngNo})로 별도 등록합니다.")
```

교체 후:

```java
                            + "첨부파일은 생성 후 POST /api/files (pkColNm=가이드문서, pkCone={docMngNo})로 별도 등록합니다.")
```

- [ ] **Step 2: 삭제 API 설명(126행)을 정정**

기존:

```java
                            + "연결된 첨부파일은 DELETE /api/files/bulk (orcDtt=가이드문서, orcPkVl={docMngNo})로 별도 정리합니다.")
```

교체 후:

```java
                            + "연결된 첨부파일은 DELETE /api/files/bulk (pkColNm=가이드문서, pkCone={docMngNo})로 별도 정리합니다.")
```

- [ ] **Step 3: 운영 소스에 잔여가 없는지 확인**

```bash
grep -rn "orcDtt\|orcPkVl" it_backend/src/main it_frontend/app
```

Expected: 예산작업 도메인(`BudgetWorkService`·`BudgetWorkDto`·`BudgetWorkController`·`BbugtmRepositoryImpl`·`app/types/budget-work.ts`·`app/pages/budget/work.vue`·`BudgetProjectSummaryTable.vue`)의 `orcPkVl`만 남는다 — **이들은 BBUGTM의 실제 필드명이므로 대상이 아니다.** `app/pages/guide/index.vue`·`info/documents/*`의 `orcPkVl`은 지역 변수명이고 `uploadFile(file, '첨부파일', orcPkVl, '가이드문서')`처럼 위치 인자로 넘기므로 쿼리 파라미터명과 무관하다 — 손대지 않는다.

- [ ] **Step 4: 백엔드 품질 게이트 후 계약 커밋**

```bash
cd it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL

```bash
cd it_backend && git add src/main/java/com/kdb/it/domain/budget/document/controller/GuideDocController.java && git commit -m "docs: BE-31 가이드문서 API 설명의 레거시 첨부 파라미터명 정정"
```

- [ ] **Step 5: 백엔드를 기동하고 프론트 타입을 재생성**

```bash
cd it_backend && ./gradlew bootRun
```

기동 확인(`http://localhost:28080/swagger-ui/index.html`) 후 다른 셸에서:

```bash
cd it_frontend && npm run codegen
```

- [ ] **Step 6: diff를 두 부류로 분류 (CQ-01 후속 확인)**

```bash
cd it_frontend && git diff app/types/api.d.ts
```

기대 변경은 **(a)** 220·1003행의 `@description` 문자열 2곳뿐이다. **(b)** `paths` 항목의 **순서만** 바뀐 hunk가 함께 보이면 그것은 CQ-01의 `CouncilController` 7분해로 springdoc의 핸들러 탐색 순서가 달라진 결과이며 **회귀가 아니다**. 오퍼레이션이 **없어지거나 새로 생기거나 시그니처가 바뀐** hunk가 있으면 그때만 회귀로 판단하고 멈춘다.

- [ ] **Step 7: 드리프트 게이트 통과 확인**

```bash
cd it_frontend && npm run codegen:check && npm run check && npm test
```

Expected: 전부 성공

- [ ] **Step 8: 프론트 재생성 커밋**

```bash
cd it_frontend && git add app/types/api.d.ts && git commit -m "chore: BE-31 백엔드 설명 정정 반영해 api.d.ts 재생성"
```

- [ ] **Step 9: `versions.lock` 갱신**

```bash
pwsh scripts/update-versions-lock.ps1
git add versions.lock && git commit -m "chore: versions.lock 갱신 — BE-31 반영"
```

- [ ] **Step 10: `TASK.md` 갱신**

BE-31을 `TASK_DONE.md`로 이관한다. CQ-01의 "후속 확인 필요(codegen 순서)" 문단은 Step 6에서 실제로 확인한 결과(순서만 바뀌었는지, 아무 변화가 없었는지)로 갱신한다.

---

## 5. 착수 전 결정이 필요한 항목 (보류 6건)

각 항목은 결정만 내려주면 반나절 이하다. 결정 후 이 계획에 Task를 추가하거나 별도 계획을 쓴다.

| ID | 질문 | 선택지 |
| --- | --- | --- |
| BE-19 | `ProjectDto.CreateRequest.abusTc`(217-220행) 누락을 400으로 막을까? | (a) `@NotBlank` 추가 — 누락과 고의적 '해당없음'을 입력 단계에서 구분. 기존 클라이언트가 400을 받을 수 있음 (b) 현행 유지 — `CodeDefaults.orNotApplicable()`(275행)이 계속 `'0'`으로 보정 |
| BE-30 | `getSummary` 대표 ioeC(588행 `ioeCodes.get(0)`)·편성률(622행 `findFirst()`) 채택 기준 | (a) BE-17 결정 #2와 동일하게 대표 편성행 기준으로 통일 (b) 현행 encounter-order 유지 + 근거 주석만 명시 |
| FE-25 | `ResultForm`·부모의 재조회 실패 배너 2중 노출 | (a) 허용(문구가 분리돼 있어 중복 문장은 아님) (b) 부모 배너로 합침 |
| FE-26 | `prepare/[id].vue` 탭0 → 탭1 배너 비가시 | (a) 실패 시 탭1로 전환 유도 (b) 배너를 탭 밖 페이지 레벨로 승격 (c) 현행 유지 + 제한사항 문서화 |
| FE-29 | 재시도 버튼 라벨·"다시" 유무 표준 문구 | 표준을 1개 정하면 전 화면 일괄 치환 가능. `refreshFailedAfterSave` 개명 여부도 함께 결정 |
| FE-30 ①② | 대시보드 2종의 `enableKeepPreviousData` 비노출이 의도인가 / `ignoreFiles` grandfather를 규칙 단위로 바꿀까 | ①은 Task 5(FE-24)와 같은 처방을 그대로 적용 가능. ②는 Task 8 이후 잔여 파일이 줄어든 뒤 재검토 |

---

## 6. 상시 점검 (계획 외 — BE-28 감시)

BE-28 본 조치(채번 포맷 확대)는 대형이지만 **감시는 쿼리 1회**다. `%04d` 계열 15개 시퀀스의 상한이 9,999로 좁혀져 있고 영구 누적이므로 주기적으로 확인한다.

```bash
sqlplus ITPAPP@127.0.0.1:11521/XEPDB1
```

접속 후(비밀번호는 콘솔 프롬프트에만 입력):

```sql
SELECT sequence_name, last_number, max_value
  FROM all_sequences
 WHERE sequence_owner = 'ITPOWN'
   AND max_value = 9999
 ORDER BY last_number DESC;
```

2026-07-30 기준 `CBLBCM`(게시물) 410 · `BITEMM`(사업 품목) 437이 선두다. 어느 하나가 **8,000을 넘으면** BE-28 본 조치를 착수한다. `BBUGTM`은 Oracle `LPAD` 채번이라 MAXVALUE만 늘리면 번호가 조용히 충돌하므로 **채번 포맷을 먼저 넓혀야 한다.**

---

## 6.5 실행 중 확인된 사실 (2026-08-06)

실행하며 드러난 것들. 계획 수립 시점에는 몰랐던 내용이다.

**프론트 `npm test`가 이미 red다 (선행 실패 2건).** 이 브랜치의 분기점부터 실패하며 이 계획의 어떤 변경과도 무관하다. `git stash` 대조로 확인했다.
- `tests/unit/architecture/max-lines-ratchet.test.ts` — `app/pages/admin/codes.vue`의 기준값 1061 vs 실측 1041. 분해로 줄었는데 기준값을 낮추지 않은 것으로 보인다(CQ-15 ratchet의 "감소도 실패" 규칙).
- `tests/unit/middleware/council-manager.test.ts` — `navigateTo` 단언 4건.
두 건 모두 이 계획 범위 밖이라 손대지 않았다. **별도 과제로 등재가 필요하다.**

**백엔드 CQ-01 동결선과 기능 변경의 구조적 충돌.** Task 3에서 실증됐다. 동결선은 실측과 기준값의 **정확한 일치**를 요구하므로 등재된 파일에는 한 줄도 더할 수 없고, 규약이 허용하는 해소 수단은 "같은 PR에서 동등 이상 분량 추출" 또는 "분해 후 기준값 하향"뿐이다. **등재 파일에 기능을 추가하는 모든 후속 과제가 같은 벽에 부딪힌다** — 계획 단계에서 대상 파일의 동결선 등재 여부를 먼저 확인해야 한다.

**프론트 테스트 대역은 Nuxt asyncData 키 캐시를 구현하지 않는다.** `tests/support/nuxtAsyncData.ts`의 `createNuxtFetchFake`는 호출마다 독립 ref를 만들고 `options.key`를 실행 코드에서 읽지 않는다(파일 내 "key" 출현은 전부 JSDoc 인용). 따라서 **"같은 키를 공유해 보존이 샌다"는 종류의 결함은 이 대역으로 재현할 수 없다.** FE-24의 회귀 가드를 호출부 계약 단언으로 세운 이유이며, 같은 계열 과제(FE-23·FE-32 등)를 계획할 때 이 한계를 전제해야 한다.

**`TASK.md` BE-26의 "동작 차이" 우려는 실재하지 않았다.** 단건 `resolveUserName(eno)`의 `Optional.map(...).orElse(eno)`는 매핑 결과가 null이면 빈 Optional이 되어 `eno`를 돌려준다 — 배치 경로(`getOrDefault(eno, eno)`)와 결과가 같다. 이름이 null인 등록 사용자에 대해 신·구 경로가 동일하게 동작한다.

---

## 7. 실행 순서 요약

```
Wave 0 (루트 + 프론트, 런타임 영향 0)
  T1  TASK.md BE-32 중복 제거
  T2  FE-31 주석 정정

Wave 1 (it_backend 단독 — ./gradlew check)
  T3  BE-29 CacheEvict
  T4  BE-26 N+1 제거

Wave 2 (it_frontend 단독 — npm run check && npm test && npm run lint:css)
  T5  FE-24 useBoard key 분리
  T6  FE-33 attemptRefresh 전환
  T7  FE-22 notifyMode 옵션
  T8  FE-19 stylelint --fix
  T9  FE-30③ codegen.mjs ESLint 편입

Wave 3 (크로스 레포 — 백엔드 커밋 먼저)
  T10 BE-31 @Operation 정정 + api.d.ts 재생성 + versions.lock
```

Wave 간 의존은 없다. Wave 2 내부에서 **T5와 T6은 둘 다 `refresh-banner-visibility.test.ts`를 건드리므로 순서대로** 수행한다.
