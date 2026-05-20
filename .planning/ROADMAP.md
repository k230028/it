# Roadmap — 알림(Notification) 마일스톤

## 개요
- 마일스톤: **알림 기능 추가**
- 마일스톤 코드: `M01-NOTIFICATION`
- 시작일: 2026-05-19
- 단일 페이즈 마일스톤(MVP 범위).

## Phase 1 — 알림 인프라 + UI (`01-alrm`)
- **Goal**: 알림 마스터 테이블(`TAAABB_CINFMM`), 백엔드 API, AppHeader 뱃지·드롭다운, 결재요청·멘션 트리거를 본 운영 코드에 통합한다.
- **Depends on**: (없음)
- **Status**: Planned
- **상세**: [`phases/01-alrm/PLAN.md`](phases/01-alrm/PLAN.md)

### 산출물
- `it_database/migrations/V20260520_001__CreateCinfmmTable.sql` ✅
- `it_backend/.../common/notification/**` (entity / repository / service / controller / event)
- `it_frontend/app/components/NotificationBell.vue`, `NotificationDropdown.vue`
- `it_frontend/app/composables/useNotifications.ts`
- 결재·게시판 도메인의 이벤트 발행 지점 통합 패치
- 단위·통합·E2E 테스트

### 성공 기준 (Success Criteria) — 검증 결과
- [x] Flyway 마이그레이션 `V20260520_001` 로컬 DB 적용 (테이블/시퀀스/인덱스/시드 9건)
- [x] 결재 신청·진행 시 다음 결재자에게 알림 발행 (`ApplicationService.submit/approve` 통합)
- [x] 게시물·댓글 본문에서 `@사번` 멘션 추출 후 알림 발행 (`BoardPostService`/`BoardCommentService` 통합)
- [x] AppHeader 종 아이콘에 미읽음 수 뱃지 (99+ 처리), PrimeVue Popover 드롭다운
- [x] 본인 외 알림 접근 시 `AccessDeniedException` (NotificationService.loadOwned)
- [x] 백엔드 컴파일 + 알림 단위 테스트 통과 / 프론트 typecheck + 알림 단위 테스트 통과
- [ ] cross-user E2E 시나리오 (백로그)

## (예약) Phase 2 — 실시간 push (SSE/WebSocket)
- Phase 1 검증 후 별도 마일스톤으로 분리. 본 ROADMAP 범위 외.
