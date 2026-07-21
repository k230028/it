# Clean Code Wave 1 — 저위험 일괄 정리 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기능 불변 정리 5건(CQ-07 포매터+상수화, CQ-12 프로젝트 설명, CQ-14 REST Docs 제거, CQ-10 미사용 컴포넌트, CQ-08 검증 규칙 문서화)과 Wave 3 조건부 항목 트리거 정의(CQ-01, CQ-06)를 처리한다.

**Architecture:** 모든 태스크는 동작 변경 없음(기능 불변)이 원칙이다. 포매터 일괄 포맷은 diff 격리를 위해 웨이브 첫 커밋으로 단독 수행하고, 이후 태스크는 내용 변경만 다룬다. 백엔드 변경은 it_backend 저장소, 프론트·문서는 루트 저장소에 커밋한다.

**Tech Stack:** Spotless(google-java-format AOSP), Gradle, Vue 3/Nuxt 4, PrimeVue Toast

**스펙:** `docs/superpowers/specs/2026-07-21-clean-code-debt-design.md`
**선행:** Wave 0 완료 (`2026-07-21-clean-code-wave0-verification-foundation.md`) — `./gradlew check`가 커버리지 게이트를 포함한 상태

---

## 사전 확정된 의사결정

| 결정 | 내용 | 이유 |
| --- | --- | --- |
| 포맷 스타일 | google-java-format **AOSP** 변형(4칸 들여쓰기) | 기존 코드가 4칸 들여쓰기 — 기본 GJF(2칸)보다 diff와 이질감이 작음 |
| Toast 상수 전환 범위 | 상수 정의 + **장시간 표시(5000/6000/8000) 21개소만 선도 전환** | 336개소 일괄 치환은 diff 폭이 커서 "점진 정리"(TASK.md) 원칙에 따라 도메인 리팩터링 시 확산 |
| CQ-08 | 코드 변경 없이 Javadoc + Swagger 스키마 설명 보강으로 종결 | 브레인스토밍에서 "현행 유지 + 문서화" 확정 |
| CQ-12 설명 문구 | `IT Project Portal backend API` (ASCII) | Gradle 메타데이터 인코딩 이슈 회피 |

---

### Task 1: 사전 상태 확인

**Files:** 없음

- [ ] **Step 1: 두 저장소의 작업 트리 확인**

Run: `cd C:\it; git status --short` 그리고 `cd C:\it\it_backend; git status --short`
Expected: 이번 작업과 무관한 변경이 없어야 한다. **it_backend에 미커밋 변경이 있으면 일괄 포맷(Task 2)을 진행하지 말고 먼저 정리한다** — 포맷 diff와 섞이면 리뷰 불가능해진다.

---

### Task 2: Spotless 도입 + 전체 일괄 포맷 (CQ-07 1/3)

**Files:**
- Modify: `it_backend/build.gradle` — plugins 블록(1~8행), `java` 블록(14~18행) 뒤에 spotless 블록 추가
- Reformat: `it_backend/src/**/*.java` 전체 (내용 변경 없음)

- [ ] **Step 1: 플러그인 추가**

plugins 블록을 다음으로 교체:

```gradle
plugins {
	id 'java'
	id 'war'
	id 'org.springframework.boot' version '4.1.0'
	id 'io.spring.dependency-management' version '1.1.7'
	id 'org.asciidoctor.jvm.convert' version '4.0.5'
	id 'jacoco'
	id 'com.diffplug.spotless' version '7.0.4'
}
```

(참고: asciidoctor 플러그인은 Task 4에서 제거하므로 이 시점에는 그대로 둔다.)

- [ ] **Step 2: spotless 설정 블록 추가**

`java { toolchain { ... } }` 블록 아래에 추가:

```gradle
// CQ-07: Java 포매터 — google-java-format AOSP(4칸 들여쓰기) 기준
// spotlessCheck는 check 태스크에 자동 연결되어 포맷 위반 시 빌드가 실패한다
spotless {
	java {
		target 'src/main/java/**/*.java', 'src/test/java/**/*.java'
		googleJavaFormat('1.28.0').aosp()
		removeUnusedImports()
		trimTrailingWhitespace()
		endWithNewline()
	}
}
```

- [ ] **Step 3: 플러그인 해석 검증 (폐쇄망 분기점)**

Run: `cd C:\it\it_backend; ./gradlew spotlessCheck`
Expected: 플러그인이 해석되고 다수의 포맷 위반 목록과 함께 FAILED(정상 — 아직 미적용 상태).
**플러그인/의존성 해석 실패 시**(로컬 repo → Nexus → mavenCentral 폴백 모두 불가): Step 1~2 변경을 되돌리고, TASK.md CQ-07 행에 "폐쇄망 저장소에 Spotless 아티팩트 반입 필요"를 기록한 뒤 이 태스크만 중단한다(Task 5·6 상수화는 계속 진행).
**google-java-format이 Java 25 문법 파싱에 실패하면**: `googleJavaFormat('1.28.0').aosp()`를 `palantirJavaFormat('2.58.0')`으로 교체해 재시도하고, 그래도 실패하면 위와 같이 기록 후 중단한다.

- [ ] **Step 4: 일괄 포맷 적용**

Run: `cd C:\it\it_backend; ./gradlew spotlessApply`
Expected: `BUILD SUCCESSFUL`, `git status --short`에 다수의 `.java` 수정 파일

- [ ] **Step 5: 동작 불변 검증**

Run: `cd C:\it\it_backend; ./gradlew check`
Expected: `BUILD SUCCESSFUL` — 테스트 전체 통과 + 커버리지 게이트 통과 + spotlessCheck 통과

- [ ] **Step 6: 단독 커밋 (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add -A
git commit -m "style: Spotless(google-java-format AOSP) 도입 및 전체 일괄 포맷 적용"
```

이 커밋에는 build.gradle의 Spotless 설정과 포맷 결과만 포함한다. 다른 내용 변경 금지.

---

### Task 3: Gradle 프로젝트 설명 교체 (CQ-12)

**Files:**
- Modify: `it_backend/build.gradle:12`

- [ ] **Step 1: description 교체**

```gradle
description = 'IT Project Portal backend API'
```

(변경 전: `description = 'Demo project for Spring Boot'`)

- [ ] **Step 2: 설정 로드 확인**

Run: `cd C:\it\it_backend; ./gradlew help -q`
Expected: 오류 없이 종료

- [ ] **Step 3: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add build.gradle
git commit -m "chore: Gradle 프로젝트 설명을 실제 서비스명으로 교체"
```

---

### Task 4: 미사용 REST Docs·Asciidoctor 설정 제거 (CQ-14)

조사 결과 `src/docs` 디렉터리가 없고 `@AutoConfigureRestDocs`/`MockMvcRestDocumentation`을 사용하는 테스트도 없다(의존성·플러그인 배관만 존재). Asciidoctor 플러그인은 Gradle 10 제거 예정 API 경고의 근원이다.

**Files:**
- Modify: `it_backend/build.gradle` — 아래 5개 지점

- [ ] **Step 1: 관련 설정 5개 지점 제거**

1. plugins 블록에서 제거: `id 'org.asciidoctor.jvm.convert' version '4.0.5'`
2. `ext { set('snippetsDir', file("build/generated-snippets")) }` 블록 전체 제거 (현재 77~79행 — ext에 snippetsDir 외 다른 속성 없음 확인됨)
3. dependencies에서 제거: `testImplementation 'org.springframework.boot:spring-boot-restdocs'`
4. dependencies에서 제거: `testImplementation 'org.springframework.restdocs:spring-restdocs-mockmvc'`
5. `tasks.named('test')` 블록에서 `outputs.dir snippetsDir` 라인 제거, 그리고 파일 하단의 asciidoctor 태스크 블록 전체 제거:

```gradle
tasks.named('asciidoctor') {
	inputs.dir snippetsDir
	dependsOn test
}
```

- [ ] **Step 2: 빌드·태스크 목록 검증**

Run: `cd C:\it\it_backend; ./gradlew clean check`
Expected: `BUILD SUCCESSFUL` (clean은 JaCoCo 리포트도 삭제하므로 check까지 함께 실행해 재생성)

Run: `cd C:\it\it_backend; ./gradlew tasks --all | Select-String -Pattern "asciidoctor"`
Expected: 매칭 없음

- [ ] **Step 3: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add build.gradle
git commit -m "chore: 미사용 REST Docs·Asciidoctor 빌드 설정 제거"
```

---

### Task 5: 백엔드 편성률 매직 넘버 상수화 (CQ-07 2/3)

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java` — 상수 2개 추가, 사용처 3곳 치환 (Task 2의 일괄 포맷으로 라인이 이동했을 수 있으므로 아래 코드 내용으로 검색해 위치를 찾는다)

- [ ] **Step 1: 클래스 상단에 상수 추가**

클래스 필드 선언부(기존 의존성 필드들 위)에 추가:

```java
    /** 편성률 기본값(%): 편성률 미지정 항목은 전액(100%) 편성으로 간주한다. */
    private static final int DEFAULT_DUP_RT = 100;

    /** 백분율(%) 환산 기준값. 요청금액 × (편성률/100) 계산에 사용한다. */
    private static final BigDecimal PERCENT_BASE = BigDecimal.valueOf(100);
```

- [ ] **Step 2: 기본값 대입부 치환 (기존 319~320행 부근)**

```java
// 변경 전
Integer assetDupRt = item.assetDupRt() != null ? item.assetDupRt() : 100;
Integer costDupRt = item.costDupRt() != null ? item.costDupRt() : 100;
// 변경 후
Integer assetDupRt = item.assetDupRt() != null ? item.assetDupRt() : DEFAULT_DUP_RT;
Integer costDupRt = item.costDupRt() != null ? item.costDupRt() : DEFAULT_DUP_RT;
```

- [ ] **Step 3: 역산부 치환 (기존 925~929행 부근, `요청금액 역산` 주석 블록)**

`.multiply(BigDecimal.valueOf(100))` → `.multiply(PERCENT_BASE)`

- [ ] **Step 4: calculateDupBg 치환 (기존 1030~1037행 부근)**

```java
// 변경 전
return requestAmount
        .multiply(BigDecimal.valueOf(dupRt))
        .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
// 변경 후
return requestAmount
        .multiply(BigDecimal.valueOf(dupRt))
        .divide(PERCENT_BASE, 2, RoundingMode.HALF_UP);
```

- [ ] **Step 5: 검증**

Run: `cd C:\it\it_backend; ./gradlew check`
Expected: `BUILD SUCCESSFUL` — BudgetWorkService 관련 기존 테스트 전체 통과

- [ ] **Step 6: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/budget/work/service/BudgetWorkService.java
git commit -m "refactor: 편성률 매직 넘버를 도메인 상수로 정리"
```

---

### Task 6: 프론트 Toast 표시시간 상수 도입 (CQ-07 3/3)

조사 결과 `life:` 리터럴 336개소/78개 파일(3000이 194건, 4000이 98건, 5000/6000/8000 합계 21건). 상수를 정의하고 장시간 표시(5000/6000/8000) 사용처만 선도 전환한다. 나머지는 "신규 코드 상수 사용" 규칙으로 점진 확산한다.

**Files:**
- Create: `it_frontend/app/utils/toast.ts`
- Create: `it_frontend/tests/unit/utils/toast.test.ts`
- Modify: `life: 5000|6000|8000` 사용 파일 전체(실행 시점에 grep으로 확정, 예: `app/plugins/router-error.client.ts:49`)
- Modify: `it_frontend/CLAUDE.md` — 신규 코드 규칙 1줄 추가

- [ ] **Step 1: 상수 파일 작성**

```ts
/**
 * Toast 표시 시간 상수(ms).
 *
 * PrimeVue `toast.add({ life })`에 사용한다.
 * 신규 코드는 숫자 리터럴 대신 이 상수를 사용한다(CQ-07).
 * 기존 리터럴(3000/4000 등)은 해당 화면 리팩터링 시 점진 전환한다.
 */
export const TOAST_LIFE = {
    /** 짧은 확인성 알림 — 저장 완료 등 */
    SHORT: 2000,
    /** 일반 알림 기본값 */
    NORMAL: 3000,
    /** 경고·안내 등 조금 더 읽을 시간이 필요한 알림 */
    LONG: 5000,
    /** 상세 안내처럼 기존 6초 표시를 유지해야 하는 알림 */
    EXTENDED: 6000,
    /** 오류 등 반드시 읽어야 하는 알림 */
    ERROR: 8000,
} as const;
```

- [ ] **Step 2: 상수 테스트 작성**

```ts
import { describe, it, expect } from 'vitest';
import { TOAST_LIFE } from '~/utils/toast';

describe('TOAST_LIFE', () => {
    it('기존 표시 시간을 동일하게 보존한다', () => {
        expect(TOAST_LIFE).toEqual({
            SHORT: 2000,
            NORMAL: 3000,
            LONG: 5000,
            EXTENDED: 6000,
            ERROR: 8000,
        });
    });

    it('표시 시간이 용도별 오름차순이다', () => {
        // 표시 시간의 상대 순서를 함께 검증한다.
        expect(TOAST_LIFE.SHORT).toBeLessThan(TOAST_LIFE.NORMAL);
        expect(TOAST_LIFE.NORMAL).toBeLessThan(TOAST_LIFE.LONG);
        expect(TOAST_LIFE.LONG).toBeLessThan(TOAST_LIFE.EXTENDED);
        expect(TOAST_LIFE.EXTENDED).toBeLessThan(TOAST_LIFE.ERROR);
    });
});
```

Run: `cd C:\it\it_frontend; npx vitest run tests/unit/utils/toast.test.ts`
Expected: PASS

- [ ] **Step 3: 장시간 표시 사용처 확정**

Run: `cd C:\it\it_frontend; rg -n "life: (5000|6000|8000)" app` (rg가 없으면 PowerShell `Select-String` 사용 — `npx rg`는 npm registry를 조회하므로 사용 금지)
Expected: 21개소 내외 목록 확보 (조사 시점 기준: 5000×18, 6000×2, 8000×1)

- [ ] **Step 4: 사용처 치환**

각 파일에서:
- `life: 5000` → `life: TOAST_LIFE.LONG`
- `life: 6000` → `life: TOAST_LIFE.EXTENDED` (기능 불변을 위해 기존 6초 유지)
- `life: 8000` → `life: TOAST_LIFE.ERROR`
- 각 파일 상단에 명시 import 추가(Vitest에서 Nuxt auto-import가 동작하지 않으므로): `import { TOAST_LIFE } from '~/utils/toast';`

- [ ] **Step 5: 검증**

Run: `cd C:\it\it_frontend; npm run check` 그리고 `npm test`
Expected: 타입/린트/단위 테스트 전체 통과. `life: (5000|6000|8000)` 재검색 시 매칭 0

- [ ] **Step 6: 신규 코드 규칙 기록**

`it_frontend/CLAUDE.md`의 코딩 규칙 절에 1줄 추가:

```markdown
- Toast 표시 시간은 `~/utils/toast`의 `TOAST_LIFE` 상수를 사용합니다(신규 코드 필수, 기존 리터럴은 화면 리팩터링 시 점진 전환).
```

- [ ] **Step 7: Commit (루트 저장소)**

```bash
cd C:\it
git add it_frontend/app/utils/toast.ts it_frontend/tests/unit/utils/toast.test.ts it_frontend/app it_frontend/CLAUDE.md
git commit -m "refactor: Toast 표시시간 상수 TOAST_LIFE 도입 및 장시간 알림 선도 전환"
```

---

### Task 7: 미사용 프론트 컴포넌트 제거 (CQ-10)

조사 결과 두 컴포넌트 모두 자동 등록명(디렉터리 접두사·Lazy 변형 포함)까지 전수 grep했을 때 정의 파일 외 참조 0건.

**Files:**
- Delete: `it_frontend/app/components/icons/IconActivity.vue` (11줄, 등록명 `IconsIconActivity`/`icons-icon-activity`)
- Delete: `it_frontend/app/components/review/ReviewVersionHistory.vue` (97줄, 등록명 `ReviewVersionHistory`/`review-version-history`)

- [ ] **Step 1: 삭제 직전 참조 재확인 (실행 시점 최신화)**

Run:
```bash
cd C:\it\it_frontend
rg -n "IconActivity|icon-activity" app tests
rg -n "ReviewVersionHistory|review-version-history" app tests
```
Expected: 각 컴포넌트의 정의 파일 자신(및 내부 docblock)만 매칭. 그 외 매칭이 나오면 **삭제하지 말고** 해당 사용처를 TASK.md CQ-10에 기록 후 이 태스크 중단.

- [ ] **Step 2: 파일 삭제**

```bash
cd C:\it\it_frontend
git rm app/components/icons/IconActivity.vue app/components/review/ReviewVersionHistory.vue
```

- [ ] **Step 3: 검증**

Run: `cd C:\it\it_frontend; npm run check` 그리고 `npm test`
Expected: 타입 검사(자동 등록 컴포넌트 참조 오류 없음)·린트·단위 테스트 전체 통과

- [ ] **Step 4: Commit (루트 저장소)**

```bash
cd C:\it
git add -A it_frontend/app/components
git commit -m "chore: 미사용 컴포넌트 IconActivity, ReviewVersionHistory 제거"
```

---

### Task 8: 메뉴 이동 검증 규칙 문서화 (CQ-08)

코드 동작 변경 없음. "null=루트 이동" 규칙을 Javadoc과 Swagger 스키마에 명시해 종결한다.

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java` — MoveRequest(현재 54~59행 부근)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/controller/AdminMenuController.java` — move 메서드 Javadoc(현재 96~108행 부근)

- [ ] **Step 1: MoveRequest Javadoc·스키마 보강**

```java
    /**
     * 부모 이동 요청.
     *
     * <p>검증 규칙: {@code newHrkMnuId}가 null이면 루트(최상위)로 이동한다.
     * 루트 이동이 합법이므로 필드 단위 필수 검증(@NotNull)을 두지 않으며,
     * 빈 본문({})의 요청도 루트 이동으로 해석된다. 잘못된 대상 메뉴·순환 계층은
     * 서비스 계층에서 검증한다.</p>
     */
    @Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
    @Schema(name = "MenuMoveRequest", description = "newHrkMnuId가 null이면 루트(최상위)로 이동")
    public static class MoveRequest {
        @Schema(description = "새 상위메뉴ID(루트로 이동하면 null)") private String newHrkMnuId;
    }
```

- [ ] **Step 2: 컨트롤러 Javadoc 보강**

move 메서드 Javadoc의 `@param req` 줄을 다음으로 교체:

```java
     * @param req 새 상위 메뉴 ID(newHrkMnuId가 null이면 루트로 이동 — 필드 필수 검증을 두지 않는 이유)
```

- [ ] **Step 3: 검증**

Run: `cd C:\it\it_backend; ./gradlew check`
Expected: `BUILD SUCCESSFUL` (spotlessCheck 포함 — Javadoc 포맷도 포매터 기준 충족)

- [ ] **Step 4: Commit (it_backend 저장소)**

```bash
cd C:\it\it_backend
git add src/main/java/com/kdb/it/domain/menu
git commit -m "docs: 메뉴 이동 API의 null=루트 이동 검증 규칙 명시 (CQ-08)"
```

---

### Task 9: Wave 3 — 조건부 항목 트리거 정의 + Wave 1 종료 처리

**Files:**
- Modify: `TASK.md` — CQ-01, CQ-06 근거/조건 교체 및 CQ-07/08/10/12/14 Done 처리
- Modify: `TASK_DONE.md` — 완료 근거 기록

- [ ] **Step 1: CQ-01 행의 근거/조건 교체**

```
착수 트리거: 대상 4개(`ProjectService`, `CostService`, `BudgetWorkService`, `CouncilController`) 중 해당 도메인의 기능 변경 착수 시, 같은 계획에 Query/Command(조회·변경) 분리와 모듈별 컨트롤러·테스트 분리를 포함해 수행한다. 단독 빅뱅 분해는 하지 않는다 (2026-07-21 Clean Code 로드맵 Wave 3 확정)
```

- [ ] **Step 2: CQ-06 행의 근거/조건 교체**

```
착수 트리거: 비용 도메인 리팩터링(CQ-01의 `CostService` 분해 포함) 착수 시 `Bprojm.UpdateCommand` 선례(record + 위임 오버로드)를 따라 `Bcostm.update`의 20개 매개변수를 record로 전환하고 호출부를 함께 갱신한다 (2026-07-21 Clean Code 로드맵 Wave 3 확정)
```

- [ ] **Step 3: 완료 항목 Done 처리**

CQ-07, CQ-08, CQ-10, CQ-12, CQ-14 행의 우선순위를 `✅ Done`으로 바꾸고 근거/조건을 완료 근거(날짜·핵심 내용)로 교체한다. CQ-07은 "Spotless 도입 + 일괄 포맷 + 편성률/Toast 상수화 완료, 잔여 Toast 리터럴은 점진 전환 규칙으로 관리"를 명시한다. Task 2가 폐쇄망 분기로 중단된 경우 CQ-07은 Done 처리하지 않고 잔여 사유를 기록한다.

- [ ] **Step 4: TASK_DONE.md에 `2026-07-21 Clean Code Wave 1` 절 추가**

항목별 완료 근거와 커밋 해시(it_backend 커밋은 저장소 구분 표기)를 기록한다.

- [ ] **Step 5: 최종 검증 및 Commit (루트 저장소)**

Run: `cd C:\it\it_frontend; npm run check` 그리고 `npm test` → Expected: 통과
Run: `cd C:\it\it_backend; ./gradlew check` → Expected: `BUILD SUCCESSFUL`

```bash
cd C:\it
git add TASK.md TASK_DONE.md
git commit -m "docs: Clean Code Wave 1 완료 이관 및 CQ-01/CQ-06 착수 트리거 확정"
```
