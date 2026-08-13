# 지정맥 MFA 손가락 선택 항목 제거 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지정맥 MFA 화면에서 `인증할 손가락` 선택 항목을 제거하면서 기존 BioAgent 기본 손가락 값 기반 인증 흐름을 유지한다.

**Architecture:** 화면 책임을 가진 `MfaDialog.vue`에서 손가락 선택 UI와 이벤트 연결만 제거한다. 인증 상태와 BioAgent 요청 기본값은 `useMfa.ts`에 그대로 유지하여 연계 규격에는 영향을 주지 않는다.

**Tech Stack:** Nuxt 4, Vue 3, TypeScript, Vitest, Vue Test Utils

## Global Constraints

- BioAgent 요청의 `fingertype` 기본값 `10`은 유지한다.
- `useMfa`의 지정맥 인증 흐름과 공개 인터페이스는 변경하지 않는다.
- MFA 대화상자의 다른 문구와 레이아웃은 변경하지 않는다.

---

### Task 1: 지정맥 손가락 선택 UI 제거

**Files:**
- Modify: `it_frontend/tests/unit/components/mfa/MfaDialog.test.ts`
- Modify: `it_frontend/app/components/mfa/MfaDialog.vue`

**Interfaces:**
- Consumes: `useSharedMfa()`가 제공하는 기존 MFA 상태와 제어 함수
- Produces: 지정맥 선택 시에도 `[data-testid="mfa-finger-type"]`을 렌더링하지 않는 `MfaDialog`

- [ ] **Step 1: 실패하는 컴포넌트 테스트 작성**

기존 “지정맥은 등록한 손가락을 고를 수 있어야 한다” 테스트를 다음 동작 검증으로 교체한다.

```ts
it('지정맥에도 인증할 손가락 선택 항목을 두지 않는다', () => {
    const wrapper = mountDialog();

    expect(wrapper.find('[data-testid="mfa-finger-type"]').exists()).toBe(false);
});
```

- [ ] **Step 2: 테스트가 올바른 이유로 실패하는지 확인**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts`

Expected: FAIL. 현재 지정맥 화면에 `mfa-finger-type` 요소가 존재한다.

- [ ] **Step 3: 최소 구현 적용**

`MfaDialog.vue`에서 다음 항목만 제거한다.

```ts
// BioAgentFingerType, BIO_AGENT_FINGER_TYPES import
// fingerType, selectFingerType destructuring
// onSelectFinger change handler
```

템플릿에서는 `mfa-finger-type` 라벨과 `<select>` 블록 전체를 제거한다.

- [ ] **Step 4: 컴포넌트 테스트 통과 확인**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts`

Expected: PASS.

- [ ] **Step 5: 관련 지정맥 인증 테스트와 정적 검사 확인**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts tests/unit/composables/useMfa.test.ts`

Run: `npm run typecheck`

Expected: 모든 테스트와 타입 검사가 통과한다.

- [ ] **Step 6: 변경 커밋**

```bash
git add app/components/mfa/MfaDialog.vue tests/unit/components/mfa/MfaDialog.test.ts
git commit -m "fix: 지정맥 MFA 손가락 선택 제거"
```

### Task 2: MFA 헤더와 인증수단 버튼 간격 추가

**Files:**
- Modify: `it_frontend/app/components/mfa/MfaDialog.vue`

**Interfaces:**
- Consumes: 기존 `.mfa-dialog` 본문 컨테이너와 PrimeVue Dialog 헤더 슬롯
- Produces: 헤더 하단과 인증수단 버튼 행 사이의 16px 시각적 간격

- [ ] **Step 1: 변경 전 브라우저 간격 측정**

로컬 MFA 대화상자에서 `.mfa-dialog`의 계산된 `padding-top`과 헤더 하단부터 버튼 행 상단까지의 거리를 측정한다.

Expected: `.mfa-dialog`의 `padding-top`이 `0px`이고 버튼 행이 헤더에 맞붙어 있다.

- [ ] **Step 2: 최소 스타일 적용**

```css
.mfa-dialog {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding-top: 1rem;
}
```

- [ ] **Step 3: 컴포넌트 테스트와 타입 검사 실행**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts`

Run: `npm run typecheck`

Expected: 테스트와 타입 검사가 통과한다.

- [ ] **Step 4: 브라우저 시각 검증**

로컬 화면을 다시 불러오고 `.mfa-dialog`의 계산된 `padding-top`이 `16px`인지 확인한다. 헤더와 버튼 행 사이에 여백이 생기며 기존 좌우 여백과 버튼 간격은 유지되어야 한다.

### Task 3: 인증수단 전환 크기 고정과 아이콘 추가

**Files:**
- Modify: `it_frontend/app/types/mfa.ts`
- Modify: `it_frontend/app/components/mfa/MfaDialog.vue`
- Modify: `it_frontend/tests/unit/components/mfa/MfaDialog.test.ts`

**Interfaces:**
- Consumes: `MFA_METHODS`, `MFA_METHOD_LABEL`, PrimeIcons 7
- Produces: 인증수단별 아이콘 매핑과 고정 높이 인증 콘텐츠 영역

- [ ] **Step 1: 실패하는 컴포넌트 테스트 작성**

각 인증수단 버튼의 장식 아이콘 클래스와 `aria-hidden="true"`, 인증 본문의 `mfa-challenge` 영역 존재를 검증한다.

```ts
expect(wrapper.get('[data-testid="mfa-method-FINGER_VEIN"] .pi-key').attributes('aria-hidden')).toBe('true');
expect(wrapper.get('[data-testid="mfa-method-FIDO"] .pi-shield').attributes('aria-hidden')).toBe('true');
expect(wrapper.get('[data-testid="mfa-method-MOTP"] .pi-mobile').attributes('aria-hidden')).toBe('true');
expect(wrapper.get('[data-testid="mfa-challenge"]').exists()).toBe(true);
```

- [ ] **Step 2: 테스트가 올바른 이유로 실패하는지 확인**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts`

Expected: 아이콘과 `mfa-challenge` 영역이 아직 없어 FAIL.

- [ ] **Step 3: 아이콘 매핑과 콘텐츠 영역 구현**

`MFA_METHOD_ICON: Record<MfaMethod, string>`에 `FINGER_VEIN: 'pi-key'`, `FIDO: 'pi-shield'`, `MOTP: 'pi-mobile'`을 정의한다. 버튼 안에 `aria-hidden="true"` 아이콘을 렌더링하고 인증별 본문 전체를 `mfa-dialog__challenge`로 묶는다.

- [ ] **Step 4: 콘텐츠 영역 크기 고정**

```css
.mfa-dialog__challenge {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    height: 14rem;
    overflow-y: auto;
}
```

- [ ] **Step 5: 검증 실행**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts tests/unit/composables/useMfa.test.ts`

Run: `npm run typecheck`

Expected: 관련 테스트와 타입 검사가 통과한다.

### Task 4: MFA 본문 밀도와 BioAgent 안내 조정

**Files:**
- Modify: `it_frontend/app/components/mfa/MfaDialog.vue`
- Modify: `it_frontend/tests/unit/components/mfa/MfaDialog.test.ts`

**Interfaces:**
- Consumes: 기존 인증수단 버튼과 BioAgent 실행 안내
- Produces: 52px 인증수단 버튼, 14rem 콘텐츠 영역, 한 줄 안내와 `실행` 버튼

- [ ] **Step 1: 실패하는 라벨 테스트 작성**

```ts
expect(wrapper.get('[data-testid="mfa-agent-launch"]').text()).toBe('실행');
```

- [ ] **Step 2: RED 확인**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts`

Expected: 기존 라벨 `BioAgent 실행` 때문에 FAIL.

- [ ] **Step 3: 최소 구현**

- 실행 버튼 라벨을 `실행`으로 변경한다.
- `.mfa-dialog__method`에 `min-height: 3.25rem`을 적용한다.
- `.mfa-dialog__challenge` 높이를 `14rem`으로 변경한다.
- 안내 문구에 전용 클래스를 부여하고 `white-space: nowrap`, `font-size: 0.75rem`, `min-width: 0`을 적용한다.
- 실행 버튼은 줄어들지 않도록 `flex-shrink: 0`으로 유지한다.

- [ ] **Step 4: 검증**

Run: `npm test -- tests/unit/components/mfa/MfaDialog.test.ts tests/unit/composables/useMfa.test.ts`

Run: `npm run typecheck`

Expected: 관련 테스트와 타입 검사가 통과한다.
