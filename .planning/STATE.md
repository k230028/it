# Project State

## 현재 상황 (2026-05-20)
- 활성 마일스톤: M01-NOTIFICATION
- 활성 페이즈: Phase 1 — 알림 인프라 + UI (`01-alrm`)
- 페이즈 상태: **Planned (코드 다이브 완료)** — 실행 착수 가능

## 진행 로그
- 2026-05-19 23:20 — `/gsd-map-codebase`로 `.planning/codebase/` 생성 (이전 세션)
- 2026-05-19 23:30 — 알림 기능 마일스톤 착수, PLAN.md v1 작성
- 2026-05-19 23:50 — 사용자 결정 반영: TTL→INF_TTL, CONE→INF_CONE, LINK_URL→INF_LNK_URL, ORC_TB_CD/ORC_MNG_NO 제거
- 2026-05-20 — 사전 코드 다이브 완료. PLAN.md §5/§10/§12 보강:
  - 결재: `ApplicationService.submit()` L122-187, `approve()` L217-309, 기존 `ApprovalCompletedEvent` 재활용
  - 게시판: `BoardPostService.createPost/updatePost/createReply`, `BoardCommentService.createComment/createReply/updateComment` 발행 지점 명시
  - 채번 패턴 정정: `INF-{YYYY}-{seq:08d}` (결재 `APF-` 패턴 미러)
  - 결재 도메인 미확인 위험 해소

- 2026-05-20 — **실행 Step 1~9 완료**:
  - Step 1: `V20260520_001__CreateCinfmmTable.sql` 작성·로컬 DB 적용. TABLE/SEQ/INDEX/시드 9건 모두 생성 (NLS_LANG=AL32UTF8 필요)
  - Step 2-5: 백엔드 코어 12개 파일 (entity/repository/service/dispatcher/event/listener/util/dto/controller). 컴파일 exit 0 ✅
  - Step 6: `ApplicationService.submit/approve` 알림 발행 통합 — 신청 직후/중간 승인/결재완료·반려 모두 커버. 기존 `ApprovalCompletedEvent`를 `NotificationEventListener.onApprovalCompleted`가 구독
  - Step 7: `BoardPostService` + `BoardCommentService` 멘션 알림 통합 — `MentionExtractor`로 `@사번` 추출, 자기 멘션 제외
  - Step 8: 프론트 `types/notification.ts`, `composables/useNotifications.ts` (싱글톤 컴포저블, 60초 폴링)
  - Step 9: 프론트 `NotificationBell.vue` (뱃지+99+), `NotificationDropdown.vue` (PrimeVue Popover), `AppHeader.vue` placeholder 교체

- 2026-05-20 — **Step 10·11 완료**:
  - Step 10: 단위·E2E 테스트 작성
    - `MentionExtractorTest.java` (백엔드 단위, 11개 케이스)
    - `useNotifications.test.ts` (프론트 단위, 4개 케이스 — 초기 1건 실패 후 deep clone 격리로 해소)
    - `notifications.spec.ts` (Playwright smoke 4개 시나리오: 뱃지 노출/99+/드롭다운/0건)
  - Step 11: 회귀 결과
    - 백엔드 알림 단위 테스트 — `./gradlew test --tests "com.kdb.it.common.notification.*"` ✅
    - 프론트 알림 단위 테스트 — `npx vitest run tests/unit/composables/useNotifications.test.ts` 4/4 ✅
    - 백엔드 전체 회귀 — 협의회(`ResultServiceTest.saveResult`, `ScheduleServiceTest.confirmSchedule`) 2건 사전 존재 회귀, 알림 작업과 무관 (변경 모듈 미사용)
    - 프론트 전체 회귀 — `utils/common.test.ts` `getHearingTypeLabel` 14건 사전 존재 회귀, 알림 작업과 무관
  - Playwright E2E 실행은 dev server 기동 + Playwright auth.setup의 수동 로그인 단계를 요구하므로 사용자 환경에서 별도 실행

## M02-SNO-MIGRATION 착수 (2026-05-21)
- 설계문서 점검 완료. `.planning/phases/02-sno/PLAN.md` 생성.
- 발견된 설계 누락 4건 (P-1~P-4): `BtermmId`, `BperfmId`, `CorgnI.update()` 추가 수정 필요, `BtermmL` 경로 오정. 상세는 PLAN.md §2 참조.
- 사전 확인 4개 쿼리(사전-1~4) 실행 후 Phase 1 착수 가능.

## 페이즈 마무리 (2026-05-20)
- **Phase 1 — 알림 인프라 + UI**: 11단계 모두 산출 완료. 신규 16개 + 수정 5개 = 21개 파일
- **검증 결과**: 컴파일/타입체크/단위 테스트(알림 범위 100% 통과). 회귀 미발견 (외부 사전 회귀만 존재)
- **잔여 백로그** (Phase 2 이상):
  - 협의회·utils 사전 회귀 정리
  - 실시간 push (SSE/WebSocket)
  - EAI 외부 어댑터 실 구현
  - 사용자명 멘션 + 자동완성
  - 알림 보존·아카이브 정책
  - cross-user E2E 시나리오 (결재 신청 → 다른 사용자 알림 수신)
