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
- `it_database/migrations/V20260519_007__CreateCinfmmTable.sql`
- `it_backend/.../common/notification/**` (entity / repository / service / controller / event)
- `it_frontend/app/components/NotificationBell.vue`, `NotificationDropdown.vue`
- `it_frontend/app/composables/useNotifications.ts`
- 결재·게시판 도메인의 이벤트 발행 지점 통합 패치
- 단위·통합·E2E 테스트

### 성공 기준 (Success Criteria)
- [ ] Flyway 적용으로 `TAAABB_CINFMM`이 운영 스키마에 존재
- [ ] 결재 신청 후 다음 결재자에게 알림 1건이 비동기로 적재됨 (통합 테스트 통과)
- [ ] 게시물·댓글 멘션 시 멘션된 사용자에게 알림이 적재됨
- [ ] AppHeader 종 아이콘에 미읽음 수 뱃지 노출, 클릭 시 드롭다운 표시
- [ ] 본인 외 알림에 접근 시 403/404 응답
- [ ] 백엔드 `./gradlew test` / 프론트엔드 `npm test` / E2E `npm run test:e2e` 통과

## (예약) Phase 2 — 실시간 push (SSE/WebSocket)
- Phase 1 검증 후 별도 마일스톤으로 분리. 본 ROADMAP 범위 외.
