# IT Portal 백로그

> 기준일: 2026-05-06
> 목적: `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

## 진행 중

| 상태 | 우선순위 | 영역 | 과제 | 근거 |
|------|----------|------|------|------|
| [Open] | High | 사전협의 | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `it_frontend/app/stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| [Open] | High | 사전협의 | 프로젝트별 검토자 목록을 서버 API에서 조회 | `defaultReviewers`가 하드코딩된 모의 데이터 |
| [Open] | Medium | 인증 | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증 | `plugins/auth.ts`의 refresh 재시도 흐름은 실제 브라우저 회귀 테스트 필요 |
| [Open] | Medium | 보안 | 운영 프로파일에서 `app.cookie.secure=true`, CORS Origin 고정값 적용 여부 검증 | 개발값이 운영에 유입되면 쿠키/Origin 정책이 약해짐 |
| [Open] | High | 보안 | DB 비밀번호와 JWT 시크릿을 환경변수 또는 비공개 프로파일로 분리 | `it_backend/src/main/resources/application.properties`에 개발용 기본값이 존재 |
| [Open] | Medium | 사전협의 | 검토의견 응답에 작성자 팀명 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts`가 authorTeam 임시값을 사용 |
| [Open] | Medium | 사전협의 | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 attachments를 빈 배열로 고정 |
| [Open] | Medium | 문서/내보내기 | HWPX/PDF/Excel 내보내기 회귀 테스트 범위 확대 | `utils/hwpx.ts` 변환 로직이 HTML 파싱, 이미지 패키징, XML 생성을 함께 담당 |
| [Open] | Medium | 테스트 | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |

## 완료

| 상태 | 일자 | 영역 | 조치 |
|------|------|------|------|
| [Done] | 2026-04-29 | 인증 | Access Token 쿠키 Max-Age를 JWT 기본 유효시간 15분과 일치시킴 |
| [Done] | 2026-04-29 | 문서 | 인증 주석을 httpOnly 쿠키 전략 기준으로 정리 |
| [Done] | 2026-04-29 | 테스트 | `CookieUtilTest`를 추가하여 JWT 쿠키 보안 속성과 만료 시간을 검증 |
| [Done] | 2026-05-06 | 문서 | JWT 설정 키명과 CORS 개발 Origin 문서를 실제 설정값 기준으로 갱신 |
| [Done] | 2026-05-06 | 주석 | 사전협의 코멘트 작성자 팀명/첨부파일 TODO를 백엔드 DTO와 프론트 매퍼에 명시 |
