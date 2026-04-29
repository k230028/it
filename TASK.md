# IT Portal 백로그

> 기준일: 2026-04-29
> 목적: `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

## 진행 중

| 상태 | 우선순위 | 영역 | 과제 | 근거 |
|------|----------|------|------|------|
| [Open] | High | 사전협의 | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `it_frontend/app/stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| [Open] | High | 사전협의 | 프로젝트별 검토자 목록을 서버 API에서 조회 | `defaultReviewers`가 하드코딩된 모의 데이터 |
| [Open] | Medium | 사전협의 | 코멘트 API 응답에 첨부파일과 작성자 팀 정보 매핑 추가 | `useReviewCommentApi.ts`의 `attachments`, `authorTeam` TODO |
| [Open] | Medium | 인증 | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증 | `plugins/auth.ts`의 refresh 재시도 흐름은 실제 브라우저 회귀 테스트 필요 |
| [Open] | Medium | 보안 | 운영 프로파일에서 `app.cookie.secure=true`, CORS Origin 고정값 적용 여부 검증 | 개발값이 운영에 유입되면 쿠키/Origin 정책이 약해짐 |
| [Open] | Medium | 테스트 | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |

## 완료

| 상태 | 일자 | 영역 | 조치 |
|------|------|------|------|
| [Done] | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| [Done] | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| [Done] | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
