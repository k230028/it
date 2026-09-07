# IT Portal 잔여과제

## 2026-09-08 현재 상태

전산업무비 동시성 스탬프·병합 기능([`docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md`](docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md), 배포 절차는 [`docs/operations/2026-09-08-cost-concurrency-rollout.md`](docs/operations/2026-09-08-cost-concurrency-rollout.md)) 구현 과정에서 의도적으로 뒤로 미룬 항목을 아래 표에 등록합니다. 기능 자체는 배포 가능하지만 아래 항목은 배포를 막지 않는 후속 개선입니다.

| ID | 우선순위 | 상태 | 과제 | 다음 조치 | 근거 문서 |
| -- | :------: | ---- | ---- | --------- | --------- |
| BE-101 | 높음 | ⬜ Open | 전산업무비 충돌 응답의 `changedBy`가 부모 BCOSTM의 `LST_CHG_USID`만 사용한다(`CostConcurrencyGuard.changedBy`, 69번 줄 부근). 금융정보단말(BTERMM) 행만 수정된 충돌에서는 자식의 감사 정보가 더 최근인데도 부모 수정자로 잘못 표시된다 | 설계 5절(충돌 응답)대로 부모·자식 중 `LST_CHG_DTM`이 더 최근인 쪽의 사번을 골라 `changedBy`를 해석하도록 `CostConcurrencyGuard`를 수정한다 | `docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md` 5절(충돌 응답) |
| BE-102 | 보통 | ⬜ Open | 동시성 스탬프·충돌 병합 규약이 전산업무비(BCOSTM·BTERMM)에만 있다. 정보화사업(BPROJM·BITEMM)도 부모·자식 구조가 같아 같은 lost update 노출이 있다 | `CostConcurrencyGuard`·`CostConcurrencyStamper`와 같은 패턴을 정보화사업 저장 경로에 적용해 `concurrencyStamp` 왕복과 409 병합을 확장한다 | `docs/superpowers/specs/2026-09-08-cost-concurrency-conflict-merge-design.md` §2(범위) |
| BE-103 | 낮음 | ⬜ Open | 외화 금융정보단말 스탬프 왕복(환율 정규화 포함)이 단위 테스트로만 검증되고, Oracle 통합 테스트는 KRW 단말만 시드해 실제 DB 왕복은 확인하지 않는다 | 통합 테스트 시드에 외화 단말(환율 포함) 케이스를 추가한다 | `it_backend/src/test/java/com/kdb/it/domain/budget/cost/service/CostConcurrencyStampIt.java` |
| FE-74 | 낮음 | ⬜ Open | 병합 다이얼로그(`CostConflictMergeDialog.vue`)가 충돌 필드를 `cttNm`처럼 원시 컬럼명으로 보여준다. 편집 화면은 같은 필드를 사람이 읽는 라벨로 표시하는데 병합 다이얼로그만 어긋난다 | 편집 화면이 쓰는 필드 라벨 매핑을 병합 다이얼로그에서도 재사용하도록 정리한다 | `it_frontend/app/components/cost/CostConflictMergeDialog.vue` |
| FE-75 | 보통 | ⬜ Open | 사용자가 새로 추가한 금융정보단말 행이, 상대방이 그 행을 건드리지 않은 채 저장한 경우에도 `applyCostResolution`(프론트 병합 적용)을 거쳐 살아남는지 증명하는 테스트가 없다. 현재는 수기 추적으로만 확인했다 | `useCostConflictMerge`(또는 `useCostFormSave`) 테스트에 "한쪽이 추가한 단말 행이 병합 후에도 남아 있다"를 검증하는 케이스를 추가한다 | `it_frontend/app/composables/cost/useCostConflictMerge.ts`, `it_frontend/tests/unit/composables/cost/useCostConflictMerge.test.ts` |
| FE-76 | 낮음 | ⬜ Open | `app/types/api.d.ts`를 재생성할 때 로컬 개발 서버의 파일시스템 경로가 OpenAPI `@example` 값으로 그대로 캡처되어, 다른 개발자 환경에서 `npm run codegen:check`가 drift로 실패할 수 있다 | 백엔드 OpenAPI 예시 값을 서버 측에서 환경 독립적인 값으로 정규화한다(경로 대신 고정 예시 문자열 사용 등) | `it_frontend/app/types/api.d.ts` |
| FE-77 | 낮음 | ⬜ Open | 병합 다이얼로그로 충돌을 해소해 저장에 성공해도 `resolveConflict`가 자동저장 상태를 clean으로 표시하지 않아, 다음 자동저장 주기에 동일 내용의 PUT이 한 번 더 나간다 | `resolveConflict` 성공 경로에서 autosave dirty 플래그를 초기화한다 | `it_frontend/app/composables/cost/useCostFormSave.ts` |
| FE-78 | 높음 | ⬜ Open | 기준 스냅샷이 없을 때 병합 로직이 보수적으로 빈 base로 대체하는데, 이 경우 한쪽에만 있는 금융정보단말 행이 충돌로 표면화되지 않고 조용히 합집합으로 병합된다. 동료가 삭제한 단말 행이 이 경로로 되살아날 수 있다 | `buildCostConflict`(프론트엔드 `useCostConflictMerge.ts`)에 "기준 스냅샷 없음" 신호를 명시적으로 전달해, base 부재 시에는 단말 행 차이를 자동 병합하지 않고 충돌로 보고하도록 바꾼다 | `it_frontend/app/composables/cost/useCostConflictMerge.ts:94`(`buildCostConflict`) |
| CQ-45 | 보통 | ⬜ Open | `CostDto.java`가 `max-lines-baselines.properties`에 804줄 예외로 등록되어 있다. 예외 기준선을 올려 둔 채로는 파일이 계속 커져도 게이트가 걸리지 않는다 | 책임 단위로 DTO를 분해해 기준선 예외 등록을 해제한다 | `it_backend/src/test/resources/architecture/max-lines-baselines.properties` |
| CQ-46 | 보통 | ⬜ Open | `CostService.java`가 800줄 ratchet 중 789줄까지 차 있어 다음 작은 변경만으로도 게이트를 넘길 여유가 거의 없다 | 저장·조회·검증 책임을 별도 컴포넌트로 더 분리해 여유를 확보한다(이번 작업에서 `CostConcurrencyGuard`를 분리한 것과 같은 방향) | `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java` |

세부 구현 내용, 검증 명령과 결과는 각 근거 문서와 태스크 실행 기록을 참조합니다.

## 2026-09-03 이전 상태

SEC-21~23, BE-90~100, FE-68~73, CQ-42~44의 구현·검증 및 운영 인계 내용은 [`TASK_DONE.md`](TASK_DONE.md)에 기록했습니다.

실제 Oracle/Flyway 적용이 필요한 `V20260903_004`·`V20260903_005`는 코드 과제가 아니라 DBA 배포 단계이며 [`meta/backlog.md`](meta/backlog.md)에 `적용대기`로 관리합니다. 운영 적용·재추출 전에는 실제 인덱스 현황인 `meta/index.txt`를 수정하지 않습니다.
