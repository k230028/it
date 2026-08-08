# TASK.md 저비용 잔여과제 배치 4 — 조치계획

작성일: 2026-08-08
기준 HEAD: it_frontend `6d23724`, it_backend `70b83f6d`, it_database `38509ed`
작업트리: 네 저장소 모두 clean, `versions.lock` 최신.

전제: 같은 날 배치 3(Tier 1·2)과 BE-22·BE-24 재조사·BE-28 부분 조치·BE-33까지 반영한 이후 남은 항목만 대상으로 한다.

아래 수치는 전부 이 문서 작성 시점의 **실측값**이다.

---

## 0. 활성 항목 분류 (30건)

| 분류 | 건수 | 항목 |
| --- | ---: | --- |
| 🏛️ 외부·운영 의존 | 6 | BE-18·BE-23·EAI-01·EAI-02·EAI-05·EAI-06 |
| 조건 도달 시 착수 | 7 | BRD-02·BRD-03·BRD-05·BRD-06·LOG-03·LOG-04·EAI-07 |
| 조사 완료·조치 안 함으로 종결 | 2 | FE-25(대안 3개 검토·기각)·BE-28(시퀀스 미수정 결정) |
| 정책·업무 확정 선행 | 4 | FE-19 잔여·FE-29 잔여·BE-32·BE-03 |
| 대규모 | 4 | CQ-15·CQ-22·BE-25·FE-15 |
| **착수 가능** | **7** | FE-30·SEC-10·BE-21·BE-24·BE-20·BE-19·CQ-18 |

---

## Tier 1 — 즉시 착수 (저비용·저위험)

### T1-1. FE-30 제목 셀 stale 정정 (문서만)

FE-30의 근거란에는 **"② 2026-08-08 완료 … FE-30 전 항목 완료"**가 기록돼 있는데 제목 셀은 여전히 `— **①③ 완료, ② 잔여**`다. 배치 3에서 ②(면제 구조 규칙 단위 전환)를 완료하면서 근거란만 갱신하고 제목을 놓쳤다.

**조치**: 제목을 완료 표기로 바꾸고 우선순위를 ✅로 올린다. 코드 변경 없음.

### T1-2. SEC-10 advisory 재확인 (조사)

`brace-expansion` GHSA-mh99-v99m-4gvg는 2026-07-24 갱신 시점에 영향 버전을 `<=5.0.7`, 패치를 `5.0.8`로만 명시해 1.x/2.x 라인의 판정이 없었다. 그래서 `maintenance-v1=1.1.17`·`maintenance-v2=2.1.3`이 공개됐어도 갱신하지 않고 대기 중이다.

**조치**: `npm audit` 재실행 + advisory 상태 재확인. 공식 패치 판정이 내려왔으면 소비자별 호환 범위에서 갱신하고 해당 advisory 제거를 확인한다. 아직이면 **재확인 날짜만 갱신**하고 종료한다.

**금지**: `npm audit fix --force`(nuxt/exceljs 다운그레이드 유발), 5.x 라인의 전역 override(CJS named export가 minimatch 계약과 불일치).

### T1-3. BE-21 재검토 판정 (조사)

`ApplicationService.java:189`가 결재선 전 행에 `DECISION_TYPE_REQUEST`(`'10'`)를 부여해 최종결재자에게도 '요청'이 들어간다. 등재 당시 "이 컬럼을 읽는 코드가 없어 무해"로 판정했다.

**조치**: `DCD_TP_C`를 읽는 코드가 그동안 생겼는지 전수 확인한다. 없으면 재확인 날짜를 갱신하고 🟢 유지, 생겼으면 그 소비처 기준으로 값을 정정한다. 코드 변경 없이 끝날 가능성이 높다.

### T1-4. BE-24 Phase 1-B 중 **통합 테스트만** (DB 변경 없음)

BE-24는 Phase 0 진단으로 중복 활성행 0건, `BCOSTM`/`BPROJM` 모두 `MAX(SNO)=1`(다중 버전 경로 미사용)을 확인했다. 남은 것은 코드가 전제하는 불변식을 DB가 강제하게 하는 스키마 방어다.

이를 **두 조각으로 나눈다**:

- **(a) 통합 테스트 — 지금 한다.** 집행 문서 3종에 대해 "같은 `DOC_MNG_NO`로 두 번째 활성행을 넣으면 PK 위반으로 거부된다"를 실측으로 고정한다. DB 스키마를 바꾸지 않고 현재 불변식을 문서화하는 것이라 위험이 없다. BE-33에서 만든 `ProjectStatusFilterIt`과 같은 하네스(`AbstractOracleRepositoryTest`)를 쓴다.
- **(b) 함수 기반 UNIQUE 인덱스 — 별도 승인 후.** `CREATE UNIQUE INDEX ... ON (CASE WHEN LST_YN='Y' AND DEL_YN='N' THEN DOC_MNG_NO END)`. DB 스키마 변경이라 마이그레이션과 DBA 인계 노트가 따른다.

**(a)만으로도** "이 불변식은 우연이 아니라 검증된다"가 성립한다. (b)는 나중에 버전 기능이 실제로 추가될 때의 안전망이다.

### T1-5. BE-20 결정 요청

`TPRMPP_CINFMM.INFM_SD_STS_C`의 운영 DEFAULT는 `'10'`인데 앱 코드셋은 `01`(발송대기)·`02`(발송완료)·`03`(발송실패)뿐이라 DEFAULT가 도달 불가능한 값이다. 분석은 BE-22 인계 노트 부록 A에 이미 정리돼 있다.

**앱이 모든 INSERT에서 값을 명시하므로 현재 동작에는 영향이 없다.** 선택지는 둘이다:

1. **DEFAULT를 `'01'`로 정렬** — 마이그레이션 `ALTER TABLE ... MODIFY (INFM_SD_STS_C DEFAULT '01')` 한 줄. DB 변경이라 승인 필요.
2. **운영 코드셋에 `'10'`을 추가** — 운영이 정본이라면 앱 코드셋을 넓혀야 하는데, 그러면 `Cinfmm.DISPATCH_*` 상수와 라우터 분기가 함께 늘어난다.

**권장은 1.** 다만 "운영과 앱 중 무엇이 정본인가"는 DBA·업무 확인이 필요하므로 **이번 배치에서는 확인 요청까지만** 하고 조치는 답을 받은 뒤로 미룬다.

---

## Tier 2 — 중간 규모 (착수 조건은 충족)

### T2-1. BE-19 — `abusTc` 입력 검증

`ProjectDto.CreateRequest.abusTc`에 검증이 없어 누락값이 `CodeDefaults.orNotApplicable()`로 조용히 `'0'`(해당없음)이 된다. 누락과 고의적 '해당없음' 선택이 구분되지 않는다.

**한 줄 어노테이션으로 끝나지 않는다** — `app/pages/info/projects/form.vue`에 `abusTc` 바인딩이 **아예 없어서** 지금 `@NotBlank`를 붙이면 사업 등록이 전부 400이 된다. 순서가 중요하다:

1. 프론트에 `abusTc` 선택 UI를 추가하고 저장 payload에 싣는다(공통코드 그룹 확인 선행).
2. 프론트 배포가 선행된 뒤 백엔드 `@NotBlank`를 추가한다.
3. 기존 데이터에 `'0'`인 행이 얼마나 있는지 확인해 마이그레이션 필요 여부를 판단한다.

**교차 저장소 순서 규약**(루트 `CLAUDE.md` §2)과 반대 방향이라는 점에 주의한다 — 보통은 백엔드 계약을 먼저 커밋하지만, 이 건은 프론트가 값을 보내기 시작해야 백엔드 검증이 안전하다.

### T2-2. CQ-18 — `components/` 루트 4개의 `common` 편입

**실측 결과 저비용이 아니다.** 소비처는 **48개 파일**이고(`PageHeader` 47 · `AppDialogFooter` 29 · `TableCard` 21 · `AppDialogHeader` 4, 한 파일이 여럿을 쓰므로 합집합 48), `components/common` 컴포넌트는 명시 import가 규약(`it_frontend/CLAUDE.md` §5)이라 48파일에 각 1줄이 추가된다.

**결정적 제약**: 그중 **9개가 CQ-15 줄 수 기준선 파일**이다.

```
components/editor/TiptapToolbar.vue      pages/budget/status.vue
pages/admin/codes.vue                    pages/budget/work.vue
pages/budget/approval.vue                pages/info/cost/form.vue
pages/budget/list.vue                    pages/info/cost/index.vue
pages/info/projects/index.vue
```

import 1줄 추가가 곧 ratchet 실패(`toBe`)이므로 이 9개는 같은 커밋에서 **다른 줄을 줄여 상쇄**해야 한다. 배치 2·3에서 쓴 "중복 주석 압축" 수법이 있지만 9개 파일에 반복하는 것은 부담이 크다.

**대안**: 자동 등록 접두사를 그대로 받아들여 `<CommonPageHeader>`로 태그를 바꾸는 방법도 있으나, 태그명이 길어져 역시 줄바꿈을 유발할 수 있고 48파일의 태그를 전부 고쳐야 한다.

**권장**: CQ-15가 기준선 파일 수를 줄인 뒤에 착수한다. 지금은 비용 대비 이득이 낮다.

---

## Tier 3 — 이번 배치 제외

| 항목 | 사유 |
| --- | --- |
| FE-19 잔여 | `EmployeeSearchDialog.vue`(788줄 + `--fix` 34줄 = 822줄로 800 상한 초과)는 CQ-15 분해 선행. 나머지는 브라우저 지원 정책·기준선 제약 |
| FE-29 잔여 | "다시" 문구 141곳을 "최초 로드 vs 재조회" 규칙으로 감사해야 함. 규칙 확정 선행 |
| FE-15 | 백엔드 OpenAPI 애노테이션(required·nullable) 보강이 선행 |
| BE-03 | 운영 관측(AWR/호출량) 데이터가 있어야 조정 가능 |
| BE-25 | 4개 엔티티의 복합 PK 정합화 + Oracle 통합 테스트. 대규모 |
| BE-32 | `PRJ_STS_COUNCIL_DONE = "39"`의 의미 확정에 업무 담당자 필요 |
| CQ-15·CQ-22 | 대규모 분해. CQ-22는 두 서버 기동 환경이 착수 조건 |
| FE-25·BE-28 | 조사·결정 완료로 사실상 종결. 추가 조치 없음 |
| 🏛️ 6건, 조건 대기 7건 | 외부 의존 또는 조건 미도달 |

---

## 실행 순서와 검증

1. **T1-1**(문서) → 검증 불필요
2. **T1-3**(조사) → 코드 grep만
3. **T1-2**(조사) → `cd it_frontend && npm audit`
4. **T1-4(a)**(백엔드 통합 테스트) → `./gradlew check` + `integrationTest`
5. **T1-5**(확인 요청) → 답을 받은 뒤 조치
6. Tier 2는 별도 판단

검증 명령:

```bash
cd it_backend && ./gradlew check && ./gradlew integrationTest
```

```bash
cd it_frontend && npm run format:check && npm run check && npm run lint:css && npm test
```

## 기대 효과

| 지표 | 착수 시점 | Tier 1 후 |
| --- | ---: | ---: |
| 활성 항목 | 30 | 29 (FE-30 종결) |
| 착수 가능 항목 | 7 | 3 (BE-19·CQ-18·BE-20 조치분) |
| 승인 대기로 넘어가는 항목 | 0 | 2 (BE-20 정본 확인, BE-24 (b) 인덱스) |

Tier 1은 **완료 항목을 늘리기보다 "판정이 끝나지 않아 남아 있던 것"을 정리**하는 성격이다. 실제 코드 변경은 T1-4(a) 통합 테스트 하나뿐이다.
