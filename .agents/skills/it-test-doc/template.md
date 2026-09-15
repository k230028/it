# 테스트 결과서

## 주요내용

### [요청자 정보]

| 항목 | 내용 |
| --- | --- |
| 요청일자 | {YYYY-MM-DD} |
| 요청부서 | {부서명} |
| 요청문서번호 | {문서번호 또는 (미기재)} |
| 요청자명 | {성명 직급} |

### [작성자 정보]

| 항목 | 내용 |
| --- | --- |
| 작성일자 | {YYYY-MM-DD} |
| 작성자명 | {성명} |

### [테스트 결과]

- **(대상 문서)** 분석/설계서 `docs/design-docs/{파일명}.md` · 요건 {N}건 · 시나리오 {N}건
- **(실행 일시)** {YYYY-MM-DD HH:mm} ~ {HH:mm} · it_frontend `{해시}` · it_backend `{해시}`
- **(실행 명령)** `npx vitest run …` · `./gradlew test --tests …` · `npx playwright test …`
- **(증적 위치)** `docs/test-docs/evidence/{작성일}/` · 세부내용 표의 증적 경로는 이 디렉터리 기준
- **(결과 요약)** 총 {N}건 · PASS {n} · FAIL {n} · 미실시 {n}(사용자 {n}·E2E {n}) · 미확인 {n}
- **(결과 도식)** 구분별 결과를 한눈에

```flow
[시나리오 {N}건]
      │
      ├─ Vitest   : {n}건 → PASS {n} · FAIL {n}
      ├─ Jacoco   : {n}건 → PASS {n} · FAIL {n}
      ├─ E2E      : {n}건 → {PASS n · FAIL n | 미실시 n}
      └─ 사용자   : {n}건 → 미실시 {n}(현업 확인 후 기입)
      │
[판정] {자동화 PASS n/n · 사용자 확인 대기 n}
```

#### 테스트 세부내용 (총 {N}건)

| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 | 실제결과 | 증적 |
| --- | --- | --- | --- | --- | --- | --- |
| **TC-01** | 요건 1 – {시나리오} | Vitest | `tests/unit/…` · {검증 내용} · {설계서 예상결과} | PASS | PASS | `{파일}` {n}/{n} passed · 로그 `vitest.log` |
| **TC-02** | 요건 1 – {시나리오} | Jacoco | `src/test/java/…` · {검증 내용} · {설계서 예상결과} | PASS | PASS | `{클래스}` {n}/{n} passed · `TEST-….xml` |
| **TC-03** | {…} | E2E | `tests/e2e/….spec.ts` · `test('…')` · {검증 내용} · {설계서 예상결과} | PASS | PASS | `{spec}` → '…' passed · `playwright-results.json` |
| **TC-04** | {…} | E2E | `tests/e2e/….spec.ts` · `test('…')` (신설) · {검증 내용} | PASS | 미확인 | `{spec}`: test 미작성 — '…' · it-test-maintenance로 작성 후 재실행 |
| **TC-05** | {…} | 사용자 | {화면} · {조작} · 사유: {…} | PASS | 미실시 | 사용자 확인 필요 |

#### FAIL 상세

- **TC-{nn}** {시나리오명} · {실패 테스트명}: {오류 메시지 요지} · 조치 {수정 예정 / 결함 등록 / 환경 원인}

FAIL이 없으면 이 절을 두지 않는다.

#### E2E 증적 스크린샷

- **TC-{nn}** {시나리오명} · {n}장 · {PASS|FAIL}
  - **TC-{nn}-1** {테스트 제목} · PASS · `e2e/screenshots/{spec}-01-pass.png`
    ![TC-{nn}-1 {테스트 제목} · PASS](evidence/{작성일}/e2e/screenshots/{spec}-01-pass.png)
  - **TC-{nn}-2** {테스트 제목} · FAIL · `e2e/screenshots/{spec}-02-fail.png`
    ![TC-{nn}-2 {테스트 제목} · FAIL](evidence/{작성일}/e2e/screenshots/{spec}-02-fail.png)

E2E 시나리오가 없으면 이 절을 두지 않는다. 사용자 시나리오의 스크린샷을 사용자가 주면 같은 형식으로 `#### 사용자 증적 스크린샷` 절을 추가한다.

## 붙임

- [vitest.log](evidence/{작성일}/vitest.log) — Vitest 실행 로그 원문
- [gradle-test.log](evidence/{작성일}/gradle-test.log) — JUnit(Gradle) 실행 로그 원문
- [playwright.log](evidence/{작성일}/e2e/playwright.log) — E2E 실행 로그 원문

붙임은 실행 로그 링크만 둔다. PDF 변환 시 링크된 텍스트 파일이 새 쪽부터 원문으로 첨부된다.
