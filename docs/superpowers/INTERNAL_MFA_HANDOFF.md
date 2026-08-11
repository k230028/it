# 내부망 MFA 작업 인계

## 작업 브랜치와 worktree

- 루트 문서: `codex/internal-mfa`, `C:\it\.worktrees\internal-mfa`
- 백엔드: `codex/internal-mfa`, `C:\it\.worktrees\internal-mfa\it_backend`
- 프론트엔드: `codex/internal-mfa`, `C:\it\.worktrees\internal-mfa\it_frontend`
- 데이터베이스: `codex/internal-mfa`, `C:\it\.worktrees\internal-mfa\it_database`

## 확정된 변경 요구

- MFA 적용 대상은 수동 로그인과 사용자 전자결재 신청·승인·반려·회수·상신이다.
- 인증수단은 지정맥(기본), FIDO, mOTP이며 마지막 인증수단 코드만 쿠키에 저장한다.
- 5분 인증 재사용 기능과 체크박스는 제거했다. 전자결재 동작마다 새 MFA를 수행한다.
- MFA 거래는 서버 메모리의 1회용 거래이며 DB/JPA/Flyway 변경은 없다.
- `local-ext`는 대화상자 확인 시 모의 성공한다. `local-int`, `dev`, `prod`는 실제 연동만 허용한다.

## 완료 상태

- Task 1: 메모리 거래 모델과 원자적 1회 소비 저장소 완료·리뷰 완료.
- Task 2: 프로파일 설정과 mock 우회 방지 완료·리뷰 완료.
- Task 3: OnePass/FIDO/mOTP/지정맥/모의 공급자 완료·리뷰 완료.
- Task 4: MFA 거래 서비스와 `/api/mfa` 완료·리뷰 완료.
- Task 5: 수동 로그인 `start → MFA → complete` 전환 완료·리뷰 완료.
- Task 6: 전자결재 서버 강제 구현 및 리뷰 지적 수정 완료. 마지막 수정 커밋 `8cc88320`은 focused 40개, 관련 컨트롤러 회귀, Spotless를 통과했으나 종료 요청으로 독립 재리뷰와 전체 `test/check`는 아직 수행하지 않았다.
- Task 7~9: 프론트 공통 MFA UI, 로그인 UI, 전자결재 UI 연결 미착수.
- Task 10: 전체 검증·운영 문서·`versions.lock` 갱신 미착수.

## 다음 세션 첫 작업

1. 백엔드 `8cc88320`의 Task 6 fix round 1 diff를 독립 재리뷰한다.
2. 백엔드 `./gradlew test`, `./gradlew check`, `./gradlew jacocoTestCoverageVerification`를 실행한다.
3. Task 7부터 프론트 구현을 재개한다.
4. 최종 검증 뒤 각 저장소 커밋을 확정하고 `versions.lock`을 갱신한다.

상세 요구사항과 작업 순서는 다음 문서를 따른다.

- `docs/superpowers/specs/2026-08-10-internal-mfa-integration-design.md`
- `docs/superpowers/plans/2026-08-10-internal-mfa-integration.md`
