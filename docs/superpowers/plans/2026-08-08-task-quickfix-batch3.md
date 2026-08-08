# TASK.md 저비용 잔여과제 배치 3 — 조치계획

작성일: 2026-08-08
기준 HEAD: it_frontend `9890e79`, it_backend `e2f6f4d5`, it_database `e556bc76`
작업트리: 양 저장소 모두 clean. `versions.lock`(갱신시각 2026-08-07 17:54)이 세 HEAD와 **이미 일치**하므로 BE-03 ④는 이번 배치에서 별도 항목으로 두지 않는다(배치 종료 시 재실행만 한다).

전제: 2026-08-06 배치 1(ERR-15·FE-26·FE-28②③·FE-29①·FE-30①③·BE-27·BE-34·CQ-23)과 2026-08-07 배치 2(CQ-24·FE-19 T1/T2-1·FE-22·FE-23·FE-27·FE-28①·FE-29③·FE-32) 완료 이후 남은 항목만 대상으로 한다.

아래 수치는 전부 이 문서 작성 시점의 **실측값**이며 TASK.md에 기록된 과거 측정값과 다를 수 있다.

---

## 실행 결과 — Tier 1 (2026-08-08)

**Tier 1 5건 전부 완료.**

| 항목 | 상태 | 실행 커밋 |
| --- | --- | --- |
| T1-1 FE-19 9개 파일 0건화 | 완료. `ignoreFiles` 회수 포함 | frontend `bab0d88`·`3f6eddc` |
| T1-2 `TiptapTableFloatingToolbar` hex 11건 | 완료. 1116줄 불변 확인 | frontend `bab0d88` |
| T1-3 CQ-19 `Btermm.update` 명령 객체 전환 | 완료 | backend `645960c9` |
| T1-4 FE-29① 재시도 라벨 | **범위 축소 후 종결** — 아래 참조 | frontend `3dc317a` |
| T1-5 BE-22 DBA 인계 노트 | 완료 | database `38509ed` |

**실측 결과 vs 기대치**

| 지표 | 착수 시점 | 기대 | 실제 |
| --- | --- | --- | --- |
| FE-19 SFC 위반 | 83건 / 14파일 | 50건 / 5파일 | **49건 / 4파일** |
| `.stylelintrc.json` `ignoreFiles` | 17항목 | 8항목 | **7항목** |

기대보다 1건·1파일 더 줄었다. `TerminalTableSection.vue`의 `rule-empty-line-before` 1건이 기준선 밖 파일이라 함께 처리 가능하다고 본 판단이 맞았다.

**계획과 달라진 점 3가지**

1. **T1-4의 전제가 틀렸다.** 계획은 `다시 시도` 15건을 `다시 조회`로 통일하라고 적었으나, 착수 전 실측에서 `다시 조회` 57건이 **전부** `useRefreshGuard`의 `retry*Refresh`에 붙어 있고 `다시 시도` 15건은 최초 로드 복구·보조 로드·쓰기 재전송임이 드러났다. 두 라벨은 이미 서로 다른 동작을 인코딩하고 있어 통일하면 FE-29가 "다시" 문구에 대해 경고한 것과 **같은 의미 뭉갬**이 된다. 실제 이상치인 `다시 불러오기` 2건만 정리하고 규칙을 `it_frontend/CLAUDE.md` §2에 등재하는 것으로 범위를 줄였다. **교훈: "표기가 흩어져 있다"는 관찰은 착수 전에 각 표기가 무엇에 붙어 있는지부터 확인해야 한다.**
2. **`--float-*` 토큰 9개를 새로 만들어야 했다.** 계획은 hex 11건을 "토큰으로 치환"이라고만 적었으나, 이 툴바의 회색·빨강은 프로젝트 표준인 zinc 램프가 아니라 Tailwind gray/red라 대응하는 기존 토큰이 **하나도 없었다**. 값을 바꾸면 시각 회귀이므로 그대로 옮기고, zinc 정렬은 CQ-22가 이 파일을 분해할 때로 미룬다는 주석을 토큰 정의에 남겼다.
3. **CSS 주석에 `*/`가 들어가 파서가 깨졌다.** 토큰 섹션 주석에 `--indigo-*` 와 `--color-danger-*`를 슬래시로 이어 적었더니 `*/`가 주석 종료로 해석돼 `tokens.css`가 통째로 파스 실패했다. `format:check`가 잡아냈다. 토큰 이름을 나열할 때 `*` 뒤에 `/`를 붙이지 않는다.

**추가로 확인한 사실 2가지**

- **TASK.md FE-19의 잔여 분포 서술이 부정확했다.** "`rule-empty-line-before` 38건 전부 CQ-15 기준선 파일"이라고 적혀 있었으나 34건은 기준선 **밖** 파일인 `EmployeeSearchDialog.vue`이고, 막히는 이유는 기준값 상향 금지가 아니라 **800줄 상한**이다(788 + 34 = 822). TASK.md를 정정했다.
- **CQ-19의 좌표가 드리프트해 있었다.** `CostService.java:383` → 285, `CostServiceTest.java:832` → 853(CQ-01 서비스 분해 여파). 소비처 수(production 1 + 테스트 1)는 그대로여서 저비용 판정은 유지됐다.

**검증**: 백엔드 `./gradlew check` BUILD SUCCESSFUL. 프론트 `format:check`·`check`·`lint:css` 통과, `npm test` 204파일 2443건 전건 통과(첫 실행에서 `refresh-banner-visibility.test.ts` 등 2건이 20초 타임아웃으로 실패했으나 재실행 시 전건 통과 — TASK.md CQ-23에 기록된 "전체 병렬 실행에서만 간헐 실패하는 무거운 테스트"와 같은 현상이며 이번 변경과 무관하다). `test:e2e`는 배치 1·2와 같은 이유로 실행하지 않았다.

**면제 회수 완료**(frontend `3f6eddc`): `ignoreFiles` 17 → **7항목**. 기대치 8보다 하나 더 줄었는데, `TerminalTableSection.vue`가 예상과 달리 0건이 돼 함께 회수됐기 때문이다.

**훅 우회 절차(다음 배치도 같은 벽을 만난다)**: `.stylelintrc.json`은 `~/.claude/scripts/hooks/config-protection.js`의 `PROTECTED_FILES`에 등재돼 있어 편집이 하드 차단된다. 이 훅은 **파일명 단위로만 판단**하므로 "면제를 없애는 강화"와 "규칙을 끄는 약화"를 구분하지 못한다. 해제는 `~/.claude/scripts/lib/hook-flags.js`가 읽는 환경변수로 한다:

```
ECC_DISABLED_HOOKS=pre:config-protection
```

`settings.json`의 `env` 블록에 넣고 세션을 재시작하거나 `ECC_DISABLED_HOOKS=pre:config-protection claude`로 띄운다. `ECC_HOOK_PROFILE=minimal`도 이 훅을 끄지만 `standard,strict` 등록 훅 전부가 함께 꺼져 과하다. **회수 작업에만 쓰고 끝나면 되돌린다.**

**다음 착수 대상**: Tier 2(T2-1 `ProjectListCard` hex 6 → T2-2 `plan/[id]` 2건 → T2-3 FE-30② 규칙 단위 전환 → T2-4 FE-20).

---

## 0. 착수 전 실측 결과

### 0.1 FE-19 stylelint 잔여

`npm run lint:css` 기준 **게이트 대상 파일의 위반은 0건**이다. 잔여 83건은 전부 `.stylelintrc.json`의 `ignoreFiles` 17항목 안에 있다(면제를 해제한 임시 설정으로 측정).

규칙별 분포(SFC 기준, 총 83건 / 14파일):

| 규칙 | 건수 |
| --- | ---: |
| `rule-empty-line-before` | 38 |
| `color-no-hex` | 33 |
| `declaration-property-value-disallowed-list` | 2 |
| `media-feature-range-notation` | 2 |
| `declaration-block-no-shorthand-property-overrides` | 2 |
| `no-descending-specificity` | 2 |
| 나머지 4종 각 1 | 4 |

파일별 분포와 제약(줄 수는 실측, "기준선"은 `scripts/max-lines-baselines.mjs` 등재 여부):

| 파일 | 줄 수 | 기준선 | 위반 내역 |
| --- | ---: | :---: | --- |
| `common/EmployeeSearchDialog.vue` | 788 | — | `rule-empty-line-before` 34, `declaration-property-value-disallowed-list` 1 |
| `editor/TiptapTableFloatingToolbar.vue` | 1116 | ✅ 1116 | `color-no-hex` 11, `declaration-property-value-disallowed-list` 1 |
| `common/ProjectListCard.vue` | 417 | — | `color-no-hex` 6, `media-feature-range-notation` 2 |
| `budget/BudgetSummaryToggle.vue` | 120 | — | `color-no-hex` 4 |
| `editor/VariableNodeView.vue` | 161 | — | `color-no-hex` 4 |
| `editor/AttachmentNodeView.vue` | 446 | — | `color-no-hex` 2, `declaration-block-no-shorthand-property-overrides` 2 |
| `pages/info/plan/[id].vue` | 1283 | ✅ 1283 | `at-rule-empty-line-before` 1, `property-no-deprecated` 1, `rule-empty-line-before` 1, `value-keyword-case` 1 |
| `pages/board/[blbMngNo]/[nacMngNo]/index.vue` | 659 | — | `color-no-hex` 3 |
| `board/BoardCommentTree.vue` | 580 | — | `color-no-hex` 1, `declaration-property-value-keyword-no-deprecated` 1 |
| `cost/TerminalTableSection.vue` | 786 | — | `color-no-hex` 1, `rule-empty-line-before` 1 |
| `pages/budget/work.vue` | 1036 | ✅ 1036 | `rule-empty-line-before` 2 |
| `editor/BlockMathNodeView.vue` | 220 | — | `no-descending-specificity` 1 |
| `editor/InlineMathNodeView.vue` | 196 | — | `no-descending-specificity` 1 |
| `admin/realtime/RealtimeFeedTable.vue` | 329 | — | `color-no-hex` 1 |

**TASK.md 기록 정정**: FE-19 항목은 잔여 `rule-empty-line-before` 38건이 "전부 CQ-15 기준선 파일"이라고 적고 있으나 사실이 아니다. 38건 중 **34건은 기준선 밖 파일인 `EmployeeSearchDialog.vue`**에 있다. 결론(이번에 손대지 못함)은 같지만 **막히는 이유가 다르다** — 기준값 상향 금지가 아니라 **800줄 상한**이다. 이 파일은 788줄이라 `--fix`가 빈 줄 34개를 넣으면 822줄이 되고, 기준선 밖 파일의 800줄 초과를 금지하는 ratchet 규칙 ②에 걸린다(기준선 신규 등재는 금지 방향). 실제로 기준선 때문에 막히는 것은 `work.vue` 2건과 `plan/[id].vue` 1건뿐이고, `TerminalTableSection.vue`의 1건은 786줄 기준선 밖이라 자유롭다.

### 0.2 CQ-19 (Btermm.update 15 위치인자)

- **같은 도메인에 이미 검증된 선례가 있다.** CQ-06 조치로 `Bcostm.update`가 명령 객체로 전환돼 있고(`CostService.java:160`의 `target.update(toUpdateCommand(request))`, 전용 테스트 `BcostmUpdateCommandTest.java`), 그 패턴을 그대로 옮기면 된다.
- 잔여 `Btermm.update`(15개 위치 인자)의 소비처는 **production 1곳 + 테스트 1곳**뿐이다: `CostService.java:285`, `CostServiceTest.java:853`.
- **TASK.md 좌표 드리프트**: 기록된 `CostService.java:383` / `CostServiceTest.java:832`는 CQ-01 서비스 분해 이후 각각 285 / 853으로 이동했다.

### 0.3 FE-29 ① 재시도 버튼 라벨 통일

TASK.md는 "착수 전 소비처 manifest 작성이 선행돼야 하며 관련 문자열이 수백 건"이라 적었다. 실측하면 **본문 문구를 빼고 버튼 라벨만 골라내는 것이 grep 한 줄로 끝난다**:

| 라벨 | 건수 |
| --- | ---: |
| `label="다시 조회"` | 57 |
| `label="다시 시도"` | 15 |
| `label="다시 불러오기"` | 2 |
| `label="다시 진단하기"` | 1 |

`다시 진단하기`는 재조회가 아니라 진단 재실행이라 통일 대상이 아니다. 실질 대상은 74건이며 `다시 조회`(57)가 다수다. **manifest가 이미 확보됐으므로 이 항목은 저비용으로 강등한다.**

### 0.4 BE-22 (dev/prod 마이그레이션 DBA 인계 노트)

- 대상 마이그레이션 2개 모두 존재: `it_database/migrations/V20260724_001__AddBesttImprovementOpinionSno.sql`, `V20260724_002__AlignConstraintsWithProduction.sql`.
- 저장소에 기존 DBA 런북·인계 문서가 **없다**(`it_database/docs/` 자체가 없음). 신규 문서 작성이며 코드 변경이 아니라 위험이 없다. 🟠 High인데도 저비용인 유일한 항목이다.

---

## Tier 1 — 즉시 착수 (저비용·저위험)

각 항목은 독립적이며 순서 의존이 없다. 커밋은 항목 단위로 나눈다.

### T1-1. FE-19 — 위반 0건으로 만들 수 있는 9개 파일 (22건 해소)

대상과 처리 방법:

| 파일 | 처리 |
| --- | --- |
| `budget/BudgetSummaryToggle.vue` (hex 4) | `tokens.css` 토큰 치환. 값 동일 유지 |
| `editor/VariableNodeView.vue` (hex 4) | 동일 |
| `pages/board/[blbMngNo]/[nacMngNo]/index.vue` (hex 3) | 동일 |
| `admin/realtime/RealtimeFeedTable.vue` (hex 1) | 동일 |
| `board/BoardCommentTree.vue` (hex 1 + deprecated keyword 1) | 토큰 치환 + deprecated 값 최신 표기로 교체 |
| `cost/TerminalTableSection.vue` (hex 1 + empty-line 1) | 토큰 치환 + `--fix`(786줄 → 787, 기준선 밖이라 자유) |
| `editor/AttachmentNodeView.vue` (hex 2 + shorthand-overrides 2) | 토큰 치환 + shorthand/longhand 선언 순서 교정 |
| `editor/BlockMathNodeView.vue`·`InlineMathNodeView.vue` (특이도 각 1) | 배치 2의 `ResourceTableSection` 선례대로 특이도 낮은 블록을 앞으로 이동 |

**주의**:
- 신규 토큰은 값이 기존 hex와 **동일**해야 한다(색이 바뀌면 시각 회귀다). 같은 값이 이미 토큰으로 있으면 신설하지 않는다.
- `declaration-block-no-shorthand-property-overrides`와 `no-descending-specificity`는 **선언·규칙 순서를 바꾸는 수정**이라 캐스케이드가 달라질 수 있다. 배치 2의 교훈대로 "겹치는 선언이 실제로 무엇을 이기고 있었는지"를 먼저 확인하고, 결과가 달라지는 경우에는 순서 교환 대신 불필요한 선언 제거로 푼다.

**완료 조건**: 위 9개 파일을 `.stylelintrc.json`의 `ignoreFiles`에서 제거하고 `npm run lint:css` 통과. `ignoreFiles` 17 → 8항목.

**차단 요인 주의**: `.stylelintrc.json`은 config-protection 훅 대상이다. 배치 2에서 사용자가 "면제를 없애는 강화 방향"이라는 근거로 우회를 승인한 선례가 있으나 **이번에도 별도 승인이 필요**하다. 승인이 나지 않으면 위반만 0건으로 만들고 면제 제거는 다음 배치로 넘긴다(코드 수정 자체는 유효하다).

### T1-2. FE-19 — `TiptapTableFloatingToolbar.vue` hex 11건

CQ-15 기준선 파일(1116줄)이므로 **줄 수가 변하면 ratchet이 깨진다**. 배치 2에서 확정한 규칙을 적용한다: `var(--토큰명)`이 원래 hex보다 길어 Prettier `printWidth: 100`을 넘기면 줄바꿈이 삽입되므로 **토큰 이름을 17자 이하로 잡는다**. 치환 후 `wc -l`로 1116 불변을 실측 확인한다.

남은 `declaration-property-value-disallowed-list` 1건(`rgba(255,255,255,*)` 계열)도 함께 처리 가능하면 이 파일을 0건으로 만들어 `ignoreFiles`에서 회수한다. 처리 시 줄 수 불변을 다시 확인한다.

### T1-3. CQ-19 — `Btermm.update` 명령 객체 전환

1. `Btermm.UpdateCommand`를 `Bcostm.UpdateCommand`와 같은 형태(`@Builder`, static nested, null 방어)로 추가한다.
2. `Btermm.update(UpdateCommand)`로 시그니처를 바꾸고 `dfrCleC`의 `CodeDefaults.orNotApplicable()` 보정은 **현재 위치 그대로 유지**한다(동작 변경 금지).
3. `CostService.java:285`의 호출을 `toTerminalUpdateCommand(request)` 경유로 바꾼다.
4. `CostServiceTest.java:853`의 15인자 `verify`를 `ArgumentCaptor<UpdateCommand>` 방식으로 바꾼다(같은 파일 798·1925·1999행에 이미 같은 패턴이 있다).
5. `BcostmUpdateCommandTest`에 대응하는 `BtermmUpdateCommandTest`를 추가한다(전 필드 대입 1건 + null 커맨드 거부 1건).

**RED 확인**: 커맨드의 필드 하나를 엔티티에 대입하지 않게 되돌리면 새 테스트가 실패해야 한다.

**주의**: `CostService.java`는 351줄, `Btermm.java`는 207줄로 둘 다 800줄 상한에 여유가 있다. 백엔드 `MaxLinesRatchetTest`의 `LIMIT`은 배치 2에서 800으로 복귀했으므로 그 기준으로 확인한다.

### T1-4. FE-29 ① — 재시도 버튼 라벨 통일

1. `label="다시 시도"` 15건(11파일)을 먼저 분류한다. **재조회 재시도**면 `다시 조회`로 통일하고, **쓰기 재전송**이면 의미가 달라 통일 대상이 아니므로 그대로 둔다. 후보 파일: `TerminalFormDialog`·`CommitteeSelector`·`ResultReviewProgress`·`TiptapEditor`·`budget/index`·`guide/index`·`info/cost/form`·`documents/[id]/review`·`projects/form`·`projects/[id]`·`bizplan/[abusMngNo]`.
2. `label="다시 불러오기"` 2건은 재조회이므로 `다시 조회`로 통일한다.
3. `label="다시 진단하기"` 1건은 제외한다.
4. 통일 규칙을 `it_frontend/CLAUDE.md` §2(재조회 가드 절)에 한 줄로 등재해 재발을 막는다.

**주의**: CQ-15 기준선 파일이 포함돼 있다(`projects/[id]` 1226, `projects/form` 1266, `info/cost/form` 993, `guide/index` 955, `bizplan/[abusMngNo]` 1088). 라벨 문자열 길이 변화가 Prettier 줄바꿈을 유발할 수 있으므로 **수정 후 줄 수 불변을 확인**한다.

### T1-5. BE-22 — DBA 인계 노트 작성

`it_database/docs/operations/2026-07-24-migration-handover.md`를 신설하고 TASK.md BE-22의 (a)(b)(c)를 실행 가능한 절차로 옮긴다.

포함할 내용:
- **사전 점검 SQL**: `V20260724_002` 적용 전 `TPRMPP_BBIZCM`·`TPRMPP_BBIZCL`의 `NOW_CTT_MANR_C` NULL 건수 확인 쿼리와, 0이 아닐 때의 처리(값 채운 뒤 재실행).
- **실패 복구 절차**: 가드(`RAISE_APPLICATION_ERROR`)로 중단된 경우 Flyway 이력에 실패 시도가 남을 수 있으므로 `flyway repair` 후 재적용. 재적용이 안전한 근거(backfill은 `WHERE ... IS NULL` 멱등, `ALTER ... DEFAULT` 2문 멱등, `align_nullable`은 `ALL_TAB_COLUMNS.NULLABLE` 선확인)를 함께 적는다.
- **유지보수 창 비용**: `V20260724_001`의 `TPRMPP_BESTTM` PK DROP/ADD는 기존 PK가 이미 올바라도 무조건 재생성된다는 점.
- **감사 이력 사전 공지**: `*L` 변경로그 테이블 backfill이 "당시 값 없음"을 코드값으로 덮어쓴다는 점.
- 부록으로 BE-28의 시퀀스 감시 쿼리(`SELECT sequence_name, last_number FROM all_sequences WHERE sequence_owner='ITPOWN'`)를 같은 문서에 넣어 운영 인계 창구를 하나로 만든다. **BE-28의 해소 자체는 이 배치 범위가 아니다**(포맷 확대 여부 결정이 선행).

문서만 추가하므로 코드 게이트 영향이 없다.

---

## Tier 2 — 조건부 (Tier 1 완료 후 판단)

### T2-1. FE-19 `ProjectListCard.vue` hex 6건

hex 6건은 T1-1과 같은 방식으로 처리 가능하다. 그러나 같은 파일의 `media-feature-range-notation` 2건은 **처리하지 않는다** — 배치 2에서 이미 되돌린 이력이 있다. 이 저장소에는 browserslist도 `postcss-preset-env`도 없고 autoprefixer가 range 문법을 down-level하지 않아 **Safari 16.4 미만에서 미디어 블록이 통째로 무시**된다. 최소 지원 브라우저를 확정하기 전에는 규칙을 `"prefix"`로 고정할지 결정할 수 없다.

따라서 이 파일은 hex만 처리하고 **`ignoreFiles`에는 남긴다**(0건이 되지 않음). T1-1과 별도 항목으로 두는 이유다.

### T2-2. FE-19 `pages/info/plan/[id].vue` 2건

기준선 파일(1283줄). 4건 중 **줄 수가 변하지 않는 2건**만 처리한다: `property-no-deprecated` 1, `value-keyword-case` 1. `rule-empty-line-before`·`at-rule-empty-line-before` 2건은 빈 줄 삽입이라 기준값 상향을 유발하므로 보류한다. 0건이 되지 않으므로 `ignoreFiles`에 남는다.

### T2-3. FE-30 ② — `ignoreFiles` 규칙 단위 전환 재검토

TASK.md의 착수 조건은 "FE-19 잔여가 줄어든 뒤"다. Tier 1·2 완료 시 `ignoreFiles`의 SFC 항목이 14 → 5 안팎(`EmployeeSearchDialog`·`ProjectListCard`·`plan/[id]`·`work.vue`, 조건부 `TiptapTableFloatingToolbar`)으로 줄어 **파일 단위 면제를 규칙 단위 면제로 바꾸는 것이 현실적**이 된다. 남은 파일마다 실제 위반 규칙이 1~2종으로 좁혀지므로, 파일 전체를 게이트 밖에 두는 대신 그 규칙만 `overrides`로 끄면 새로 추가되는 CSS는 나머지 규칙의 검사를 받는다.

**착수 조건**: Tier 1·2 완료 후 잔여 파일별 규칙이 실제로 1~2종인지 재실측. `.stylelintrc.json` 편집이므로 config-protection 훅 승인이 다시 필요하다.

### T2-4. FE-20 — 편집 중 다른 행의 미저장 편집 보존

**Tier 1이 아니다.** 실측상 수정 지점 자체는 좁지만(`useCostEditingState.ts` 285줄, 병합 watcher 146행~) 보존 조건을 `_saveError` 보유 행에서 `_status === 'modified'` 행까지 넓히는 것은 **동작 변경**이며, 같은 파일의 `suppressedWhileEditing`·`viewMode` watch와 상호작용한다(217~220행 주석이 그 경계를 설명한다).

착수 시 순서:
1. 현재 병합 watcher의 보존 조건과 `suppressedWhileEditing` 경로가 각각 어떤 케이스를 담당하는지 특성화 테스트로 먼저 고정한다.
2. 그 위에서 보존 대상을 넓히고, **저장 대상 행은 서버 원본으로 갱신되어야 한다**(넓히기가 지나치면 저장 결과가 화면에 반영되지 않는 새 결함이 생긴다).
3. RED 확인: 보존 조건을 되돌리면 새 테스트가 실패해야 한다.

`useCostTerminalDialogs.ts:205,208`·`useCostExcelTransfer.ts:214` 세 재조회 지점이 회귀 관찰 대상이다.

---

## Tier 3 — 이번 배치 제외 (착수 조건 미충족)

| 항목 | 제외 사유 |
| --- | --- |
| FE-19 `EmployeeSearchDialog.vue` 35건 | 788줄 + `--fix` 34줄 = 822줄로 **800줄 상한 초과**. 파일 분해가 선행돼야 한다(CQ-15와 묶어야 하는 항목) |
| FE-19 `work.vue` 2건, `plan/[id].vue` 2건 | CQ-15 기준선 파일에 빈 줄을 넣어야 해소되는 규칙 — 기준값 상향은 금지 방향 |
| FE-15 | 백엔드 OpenAPI 애노테이션(required·nullable) 보강이 선행 |
| BE-19 | 프론트 `projects/form.vue`에 `abusTc` 바인딩 신설이 선행(지금 `@NotBlank`를 붙이면 사업 등록이 전부 400) |
| BE-24·BE-25 | 기존 중복 데이터 정리 + 제약 추가 + Oracle 통합 테스트 — 저비용 아님 |
| BE-28 | 채번 포맷 확대 vs MAXVALUE 환원 결정 선행. `BBUGTM`은 SQL `LPAD` 채번이라 순서를 틀리면 번호가 조용히 충돌 |
| BE-20·BE-32·BE-33 | 업무 담당자·DBA 확정 필요(대표상태 정의, 코드셋 정합, 상수 의미) |
| CQ-15·CQ-22 | 대규모 분해. CQ-22는 두 서버 기동이 가능한 환경이 착수 조건 |
| CQ-18 | 소비처 manifest 작성 후 컴포넌트별 분할 실행 — 중간 규모 |
| FE-29 "다시" 문구 혼재 | 141곳을 "최초 로드 vs 재조회" 규칙으로 감사해야 함. 규칙 확정이 선행 |
| SEC-10 | 공식 advisory 판정 대기(외부 의존) |
| BE-18·BE-23·EAI-01/02/05/06·LOG-03/04·BRD-* | 외부·운영 의사결정 또는 조건 도달 시 착수 |

---

## 실행 순서와 검증

권장 순서(각 단계 후 커밋):

1. **T1-3**(백엔드, 독립) → `cd it_backend && ./gradlew check`
2. **T1-5**(문서, 독립) → 검증 불필요
3. **T1-1** → **T1-2** → **T2-1** → **T2-2**(프론트 CSS, 같은 게이트 공유)
4. **T1-4**(프론트 라벨)
5. Tier 2 판단(T2-3 → T2-4)
6. 마지막에 `scripts/update-versions-lock.ps1` 실행 + TASK.md/TASK_DONE.md 반영

검증 명령:

```bash
cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test
```

```bash
cd it_backend && ./gradlew check
```

`npm run test:e2e`는 배치 1·2와 같이 두 서버를 동시에 띄울 수 없어 실행하지 않는다. CSS 변경이 캐스케이드를 건드리는 T1-1의 순서 교정 2종은 그 대신 **변경 전후의 계산된 스타일을 코드로 대조**해 판단한다.

## 기대 효과

| 지표 | 착수 시점 | Tier 1 후 | Tier 1+2 후 |
| --- | ---: | ---: | ---: |
| FE-19 SFC 위반 | 83건 / 14파일 | 50건 / 5파일 | 42건 / 5파일 |
| `.stylelintrc.json` `ignoreFiles` | 17항목 | 8항목(승인 시) | 8항목 |
| TASK.md 활성 항목 | 26 | 23(CQ-19·FE-29①·BE-22 해소) | 23 |

`ignoreFiles` 3항목(`tokens.css`·`primevue.css`·`tiptap-editor.css`)은 토큰 원천과 vendor 보정이라 회수 대상이 아니다.
