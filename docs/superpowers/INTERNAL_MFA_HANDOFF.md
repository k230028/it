# 내부망 MFA 작업 완료 기록

구현 계획의 Task 1~10을 모두 완료했습니다. 이 문서는 세션 인계용이었으므로 남은 참조만 정리합니다.

## 산출물

- 설계: [`specs/done/2026-08-10-internal-mfa-integration-design.md`](specs/done/2026-08-10-internal-mfa-integration-design.md)
- 계획: [`plans/done/2026-08-10-internal-mfa-integration.md`](plans/done/2026-08-10-internal-mfa-integration.md)
- 운영 문서: [`it_backend/README.md`의 「내부망 MFA」](../../it_backend/README.md), [`it_frontend/README.md`의 「추가 인증(MFA) 연결」](../../it_frontend/README.md)
- 재사용 규칙: `it_backend/CLAUDE.md` §5, `it_frontend/CLAUDE.md` §3, 루트 `CLAUDE.md` §4.2

## 계획과 달라진 결정

- **FIDO 재조회 판정** — `MfaVerificationResult`가 성공·실패 2값이라 미승인 응답이 실패로 집계됐고, 허용 실패 횟수(5)와 3초 폴링이 겹쳐 약 15초 만에 거래가 잠겼습니다. `Outcome(VERIFIED/UNDECIDED/FAILED)`을 도입해 재조회를 실패로 세지 않도록 고쳤습니다(계획에 없던 선행 수정).
- **`openMfa`의 `loginPendingId` 제거** — Task 5가 로그인 대기 식별자를 httpOnly 쿠키로 만들어 프론트가 읽거나 되돌려보낼 수 없습니다. 계획 Task 8의 시그니처에서 이 인자를 뺐습니다.
- **회수 명령 집약** — 두 화면에 인라인으로 흩어져 있던 회수 요청을 `useApprovals.recallApplication`으로 모았습니다. 화면마다 요청을 다시 조립하면 MFA 적용이 빠질 수 있습니다.
- **단건 `/approve` 미사용** — 백엔드는 `POST /api/applications/{id}/approve`를 보호하지만 프론트는 단건도 `bulk-approve`로 처리하므로 호출부가 없습니다. 보호 엔드포인트 7개 중 프론트 연결은 6곳입니다.

## 남은 과제

`TASK.md`의 SEC-10~SEC-13(지정맥 연동 규격 확인, 서버 검증 규격 도입, FIDO 거부 상태 구분, 다중 인스턴스 지원)을 참조합니다.
