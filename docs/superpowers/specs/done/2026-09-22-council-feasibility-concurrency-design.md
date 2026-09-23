# 정보화실무협의회 타당성검토표 동시 편집 충돌 감지 (경량)

- 과제: [COUNCIL-012](../../../../TASK_COUNCIL.md)
- 선례: [전산업무비 저장 충돌 감지와 병합](2026-09-08-cost-concurrency-conflict-merge-design.md), 정보화사업 확장(BE-102, `docs/operations/2026-09-08-project-concurrency-rollout.md`). 스탬프·409 계약은 그대로 옮기고 화면 해소는 경량으로 줄인다.
- 범위: `it_backend` `domain/council`(스탬퍼·가드·예외·DTO 필드·`FeasibilityService`·컨트롤러·테스트)과 `GlobalExceptionHandler`의 핸들러 1개(사용자 확인 필요한 범위 밖 파일 — 선례 두 건과 같은 자리), `it_frontend` Step1(`useCouncilRequestPage`·`[id].vue`·`i18n council`·생성 타입·테스트). DB 마이그레이션 없음.

## 1. 문제

Step1 타당성검토표 저장(`POST/PUT /api/council/{asctId}/feasibility`)은 `lockWritableDraft`로 **트랜잭션 동안만** 원장을 잠근다. 사람이 화면을 열어 둔 수 분은 보호하지 않으므로, 같은 주관부서 동료 둘이나 담당자와 IT기획 관리자가 같은 검토표를 열면 나중 저장이 앞의 저장을 오류 없이 덮어쓴다. 성과지표(`BPERFM`)는 요청 목록으로 **전체 교체**하므로 상대가 추가한 행이 사라진다.

2026-09-22 확인: 협의회 쓰기 중 두 명 이상이 같은 문서를 고칠 수 있는 곳은 Step1 검토표와 개최결과서뿐이고(그 밖은 사번 단위 행 또는 상태 가드가 있는 관리자 단발 액션), 결과서는 IT기획 관리자끼리라 이번 범위에서 제외한다. 사용자 결정: 3-way 병합 대신 **경량 해소**(다시 불러오기 / 덮어쓰기).

## 2. 개정본 스탬프

`GET /api/council/{asctId}/feasibility` 응답(`FeasibilityResponse`)에 `concurrencyStamp`(SHA-256 64자 소문자 16진수)를 싣는다. 신규 `CouncilFeasibilityStamper`가 계산하며 조회 조립과 저장 검증이 같은 함수를 쓴다. `ItBudgetCanonicalJson.digest`를 재사용한다(`common/` 의존, 계층 규칙 위반 아님).

### 2.1 해시 입력

- 사업개요 `BPOVWM`: `IT_PTL_ASCT_ID`, `ABUS_NM`, `ABUS_TRM_CONE`, `ABUS_NCS_CONE`, `RQM_BG_AMT`(`canonical.money`), `IT_PTL_EDRT_TC`, `ABUS_CONE`, `LW_RGL_YN`, `LW_FDTN`, `DGOG_PPO_CONE`, `FL_MPN_ID`.
- 자체점검 `BCHKLM` 활성 행(`DEL_YN='N'`)을 `IT_PTL_CKG_ITM_TC` 오름차순으로: 항목코드, 점수, 의견.
- 성과지표 `BPERFM` 활성 행을 `EVL_DTP_SNO` 오름차순으로: 순번, 지표명, 정의, 산식, 측정시점, 측정주기.

### 2.2 제외

공통 감사 필드(`FST_ENR_*`, `LST_CHG_*`, `DEL_YN`)와 **저장유형 `KPN_TP_TC`(10/20)**. 임시저장↔작성완료 전환과 수정 복귀(COUNCIL-010 `reopenAsDraft`)는 내용 변경이 아니므로 충돌로 보지 않는다.

## 3. 저장 API 계약

`FeasibilityRequest`에 `concurrencyStamp`(선택, `@Schema(nullable = true)`)를 추가한다. 검사는 `lockWritableDraft`로 원장을 잠근 **뒤**, 사업개요를 수정하기 **전**에 한다.

| 상황 | HTTP | 코드 | 본문 |
| --- | ---: | --- | --- |
| 사업개요가 아직 없음(최초 저장) | — | 검사 없음 | 스탬프가 있어도 무시 |
| 사업개요가 있는데 스탬프 형식이 64자 16진수가 아님(있으나 깨짐) | 400 | `COUNCIL_STAMP_INVALID` | 코드·메시지만 |
| 사업개요가 있는데 스탬프가 **없음**(빈 화면으로 연 뒤 상대가 먼저 만든 경우) 또는 현재 스탬프와 다름 | 409 | `COUNCIL_SOURCE_CHANGED` | `changedBy`·`changedByEno`·`changedAt`·`currentStamp`·`current`(`FeasibilityResponse`) |
| 잠금 대기 3초 초과 | 409 | 기존 `ResponseStatusException` 유지(메시지 "다른 작업이 협의회를 변경하고 있습니다…") | 변경 없음 |

선례와 다른 점 하나: 누락을 400이 아니라 409로 다룬다. 협의회는 미작성(200/null) 상태에서 화면을 열 수 있어 클라이언트가 정당하게 스탬프를 갖지 못하는 경우가 있고, 그때도 상대 저장을 조용히 덮어쓰면 안 되기 때문이다. 형식이 깨진 값만 400이다.

성공 응답은 `200 FeasibilitySaveResponse { concurrencyStamp }`(기존 `Void` → 본문 추가)로 바꿔, 클라이언트가 재조회 없이 다음 저장에 쓸 최신 스탬프를 받는다. 저장 직후 재계산하므로 응답 스탬프는 방금 저장한 내용과 일치한다.

`changedBy`는 세 테이블 활성 행의 `LST_CHG_DTM` 중 가장 최근 행의 `LST_CHG_USID`를 `UserRepository`로 이름 해석한 값이며(해석 실패 시 사번 그대로), `changedAt`은 그 시각이다.

## 4. 백엔드 구성

- `CouncilFeasibilityStamper`(`@Component`): `stamp(Bpovwm, List<Bchklm>, List<Bperfm>): String`.
- `CouncilConflictException`(`final class extends RuntimeException`): `status`·`code`·`changedBy`·`changedByEno`·`changedAt`·`currentStamp`·`current(FeasibilityResponse)` — `ProjectConflictException`과 같은 형태.
- `CouncilDto.ConflictResponse`(`@Schema(name = "CouncilConflictResponse")`): `timestamp`·`status`·`code`·`message` + 위 5개.
- `GlobalExceptionHandler.handleCouncilConflict`: 선례 두 핸들러와 같은 형태 — 범위 밖 파일이므로 구현 전 사용자 확인.
- `FeasibilityService`
  - `getFeasibility`: 응답에 `stamper.stamp(...)`를 채운다.
  - `saveFeasibility`: 잠금 → (사업개요 있으면) 활성 자체점검·성과지표 조회 → 현재 스탬프 계산 → 표 3 판정 → 기존 저장 → 저장 후 스탬프 재계산해 반환. 상태 전이(`02`)는 기존 그대로.
  - 판정은 별도 `CouncilFeasibilityConcurrencyGuard.verifyStamp(request, overview, selfChecks, performances)`에 두어 서비스가 800줄 상한에 가까워지지 않게 한다.
- 컨트롤러 `POST/PUT` 반환형 `ResponseEntity<CouncilDto.FeasibilitySaveResponse>`, `@ApiResponse` 400/409 추가.

## 5. 프론트 (Step1)

- `useCouncilRequestPage`
  - `concurrencyStamp = ref<string | null>(null)`: 프리필(`initForm`)에서 `feasibilityRaw.concurrencyStamp`로 채우고, 저장 성공 응답의 `concurrencyStamp`로 갱신한다. `FeasibilityData`(= `FeasibilityResponse` 타입)에 필드가 생기므로 폼 객체에도 실리지만, 요청에는 이 ref 값을 명시적으로 넣는다(`{ ...form, kpnTc, concurrencyStamp }`).
  - `useCouncilLifecycleApi.saveFeasibility`가 `FeasibilitySaveResponse`를 반환하도록 바꾼다.
  - 409 `COUNCIL_SOURCE_CHANGED`(`current`·`currentStamp` 있음)는 실패 토스트 대신 `conflict = ref<CouncilConflictResponse | null>`에 담아 다이얼로그를 연다. 그 밖의 409·400은 기존 실패 토스트.
  - `reloadFromServer()`: `initForm(conflict.current)`·스탬프 갱신·`formDirty=false`·다이얼로그 닫기. 내 입력은 버린다.
  - `overwriteWithMine(kpnTc)`: `concurrencyStamp = conflict.currentStamp`로 같은 저장을 한 번 더 시도(임시저장/작성완료 중 원래 누른 것). 또 409면 다이얼로그가 새 정보로 다시 열린다.
- `[id].vue`: 확인 다이얼로그(PrimeVue `Dialog`) — 제목 "다른 사용자가 수정했습니다", 본문 "{changedBy}님이 {changedAt}에 저장했습니다. 지금 저장하면 그 내용을 덮어씁니다.", 버튼 [다시 불러오기](secondary) / [내 입력으로 덮어쓰기](danger) / [닫기]. i18n `council.requestDetail.conflict.*` 5키(ko/en).
- 성과지표 전체 교체 특성상 "덮어쓰기"는 상대가 추가한 행을 지운다 — 본문 문구에 명시한다.

## 6. 테스트

- 백엔드: `CouncilFeasibilityStamperTest`(같은 내용 같은 스탬프, `KPN_TP_TC`·감사 필드 변화는 불변, 성과지표 순서 무관·내용 변화는 변함), `FeasibilityServiceTest`(최초 저장 검사 없음, 누락 409, 형식 오류 400, 불일치 409 본문, 일치 시 저장·새 스탬프 반환, `changedBy` 해석), `CouncilAccessBoundaryTest` 기존 POST/PUT 케이스에 스탬프 반영, 컨트롤러 슬라이스 409 본문 스키마 이름 `CouncilConflictResponse`.
- 프론트: `useCouncilRequestPage.test.ts`(프리필로 스탬프 보관, 요청에 스탬프 포함, 저장 응답으로 갱신, 409 → conflict 세팅·토스트 없음, 다시 불러오기 → 폼·스탬프 갱신, 덮어쓰기 → `currentStamp`로 재저장), `codegen:check`.
- 게이트: `./gradlew test`·`spotlessJavaCheck`, `npm run check`·`npm test`.

## 7. 배포 순서

프론트 → 백엔드 순서로 배포한다. 백엔드가 먼저 나가면 구 프론트는 스탬프 없이 저장해 사업개요가 있는 검토표마다 409를 받는다. 프론트가 먼저 나가면 구 백엔드가 `concurrencyStamp`를 무시할 뿐이다(요청 DTO의 알 수 없는 속성은 기존 설정대로 무시되는지 codegen 전에 확인한다 — 무시되지 않으면 백엔드 DTO 필드 추가만 먼저 배포한다).

## 8. 하지 않는 것

- 3-way 병합 UI, 결과서(`BRSLTM`)·위원별 입력의 스탬프, `@Version` 컬럼, 서버 측 원본 보관.
