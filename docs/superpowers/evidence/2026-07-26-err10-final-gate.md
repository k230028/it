# ERR-10 최종 게이트 증빙 영수증

검증일: 2026-07-26
목적: ERR-10 완료 이관 직전의 코드·테스트·리뷰 상태를 재현 가능한 SHA와 명령 종료 결과로 고정한다.

## 검증 대상 SHA

| 저장소 | SHA | 용도 |
| --- | --- | --- |
| root | `0439417e036cca7521de73c4aff4a5ef5f42ad4b` | ERR-10 완료 이관 전 root 문서 기준점 |
| frontend | `8d3eda3cc142bf8d9287546c836af44cc328afa7` | C1~C4 제품 코드와 지정 Playwright 4개 spec을 실행한 구현 기준점 |
| frontend | `4e91e9c135b69f6454ffe1847c049cbb12f6a235` | 누락된 정상 통화 fixture에만 유효 `cdvaDtl`을 보강한 최종 테스트 기준점 |
| backend | `52552cc1be7ad4d324836df7b6f638a7b1a1bebb` | C4 서버 인가를 포함한 최종 Gradle 검증 기준점 |

`8d3eda3..4e91e9c`의 변경은 `CurrencyErrorStates.test.ts`와 `TerminalFormDialog.test.ts`의 정상 응답 fixture뿐이다. 제품 코드와 E2E spec은 변경하지 않았다. 전체 Vitest는 이 fixture 보정 후 통과했고, typecheck·lint는 `4e91e9c` 기준으로 다시 통과했다. 지정 Playwright는 제품/E2E 기준점 `8d3eda3`에서 실행했다.

## 최종 명령 영수증

| 저장소 | SHA | 명령 | 종료 | 식별 가능한 출력·수량 |
| --- | --- | --- | :--: | --- |
| backend | `52552cc1` | `.\gradlew test` | 0 | `> Task :test UP-TO-DATE`, `BUILD SUCCESSFUL in 3s`, `COMMAND_EXIT final_gradlew_test=0` |
| backend | `52552cc1` | `.\gradlew spotlessCheck` | 0 | `> Task :spotlessJavaCheck UP-TO-DATE`, `BUILD SUCCESSFUL in 3s`, `COMMAND_EXIT gradlew_spotlessCheck=0` |
| frontend | `4e91e9c` | `npm run typecheck` | 0 | `> nuxt typecheck`, `COMMAND_EXIT final_npm_run_typecheck=0` |
| frontend | `4e91e9c` | `npm run lint` | 0 | `✖ 3 problems (0 errors, 3 warnings)`, `COMMAND_EXIT final_npm_run_lint=0` |
| frontend | `4e91e9c` | `npm test -- --run` | 0 | `vitest run --run`, `COMMAND_EXIT npm_test_run=0`; 기존 최종 기록 135 files / 1,746 tests passed |
| frontend | `8d3eda3` | `npx playwright test tests/e2e/error-recovery-currency.spec.ts tests/e2e/error-recovery-tiptap.spec.ts tests/e2e/report-pdf-latest.spec.ts tests/e2e/result-review-sync.spec.ts` | 0 | `Running 9 tests using 1 worker`, `9 passed (1.1m)`, `COMMAND_EXIT playwright_err10_four_e2e=0` |

lint 경고는 `app/pages/budget/status.vue` 822·992·1150행의 `:footerClass` 하이픈화 3건뿐이다. 오류는 없으며 FE-07 소유의 deferred minor이므로 ERR-10에서 수정하지 않았다.

## 최종 수정 라운드 추가 증빙

최종 리뷰에서 확인된 PDF 복구 진입점과 Tiptap 문서 수명 경계를 보완했다. 아래 행은 이전 frontend SHA 행을 대체하는 **최종 프론트 검증 기준**이다.

| 저장소 | SHA | 범위 |
| --- | --- | --- |
| frontend | `a6f0cba339b92d3600532cc9023721dba5e676cc` | ERR-10 최종 수정 2건을 포함한 전체 프론트 검증 기준 |

| 명령 | 종료 | 식별 가능한 출력·수량 |
| --- | :--: | --- |
| `npm test -- --run tests/unit/components/TiptapEditor.test.ts tests/unit/pages/infoProjectsReport.test.ts` (RED 전) | 1 | 새 Tiptap 2건·PDF 1건이 각각 기존 동작 부재로 실패 |
| 같은 명령 (GREEN 후) | 0 | `2 passed`, `19 passed (19)` |
| `npx playwright test tests/e2e/error-recovery-tiptap.spec.ts tests/e2e/report-pdf-latest.spec.ts` | 0 | `5 passed (56.1s)` |
| `npm run check` | 0 | typecheck 통과, ESLint 0 errors·기존 `budget/status.vue` 경고 3건 |
| `npm test -- --run` | 0 | `135 passed`, `1751 passed (1751)` |
| `npx playwright test tests/e2e/error-recovery-currency.spec.ts tests/e2e/error-recovery-tiptap.spec.ts tests/e2e/report-pdf-latest.spec.ts tests/e2e/result-review-sync.spec.ts` | 0 | `9 passed (1.1m)` |

- `8552f20`: ERROR 토큰을 에디터 업데이트 시 실제 문서 토큰과 교집합으로 정리하고, 외부 문서·`variableValues` 교체 시 비동기 해석 세대를 무효화했다. 완료 응답은 현재 문서의 활성 토큰일 때만 병합한다.
- `a6f0cba`: PDF 최신 생성 실패 상태에 명시적 `다시 시도` 버튼을 추가했다. 이 버튼은 결재선·양식 데이터를 변경하지 않고 `generatePdf()`를 호출하며 기존 revision·상신 가드를 그대로 사용한다. PDF E2E도 결재자 변경 대신 이 버튼을 클릭하도록 수정했다.
- ERR-10 신규/수정 테스트의 Arrange/Act/Assert 주석을 준비/실행/검증으로 정리했다. 생성된 `tsconfig.test.tsbuildinfo`는 검증 후 복원했고 프론트 작업 트리는 clean 상태다.

## 핵심 E2E 수령 결과

| spec | 통과 | 확인한 계약 |
| --- | :--: | --- |
| `error-recovery-currency.spec.ts` | 2 | 최초 ERROR 재시도 복구, 재오픈 실패 STALE·마지막 정상값 유지 |
| `error-recovery-tiptap.spec.ts` | 1 | 단건 해석 ERROR, 재시도 성공 뒤 최신 칩 표시 |
| `report-pdf-latest.spec.ts` | 4 | 생성 중 상신 차단, 최신 결재선, revision 역전 무시, 실패 뒤 재시도 |
| `result-review-sync.spec.ts` | 2 | 5xx 재시도 복구, 403 권한 배너·재시도 미표시 |

## 레인 리뷰 수락

각 행의 `PASS`는 Task 1~4 리뷰 완료 보고서의 요구사항 대조·선별 테스트·self-review 결과를 최종 게이트에 이관한 판정이다. 범위는 구현 커밋과 리뷰 후속 커밋을 함께 포함한다.

| 레인 | 검토한 commit range | 수락 근거 | verdict |
| --- | --- | --- | :--: |
| C1 통화 | frontend `79ac8fc4..1ad2d025` | single-flight·ERROR/STALE·손상/기준일자 행 제외; 최종 composable 27 tests 통과, 소비자/UI 포함 35 tests 통과, 통화 E2E 2/2 | PASS |
| C2 Tiptap | frontend `ff45d248..be4e8c2` | 단건 ERROR·재시도·인스턴스 sequence guard; 단위 3 files / 26 tests, E2E 1/1 | PASS |
| C3 PDF | frontend `da0e8bf..9a46dd6` | revision guard·상신 차단·Blob 회수·경쟁/재시도; 단위 2 files / 29 tests, 최종 E2E 4/4 | PASS |
| C4 상태 동기화 | backend `ea2a3aaf..0a98a438`, frontend `b59b61e..8d3eda3` | 서버 ADMIN 인가(MockMvc 4 tests), 오류 분류·epoch/single-flight; 프론트 단위 2 files / 26 tests, E2E 2/2 | PASS |

## 문서 이관 경계

- `TASK.md`는 이전 이관 커밋 `9237af8`에서 ERR-10을 활성 목록에서 이미 제거했다. 이번 최종 게이트는 중복 행을 만들지 않았다.
- `TASK_DONE.md`의 ERR-10 완료 근거는 본 문서를 최종 영수증으로 참조한다.
- 문서 외 frontend/backend 변경은 없고, `tsconfig.test.tsbuildinfo` 생성물은 커밋하지 않고 복원했다.
