# AGENTS.md — 포인터 문서

이 문서는 포인터입니다. 본문을 여기에 두지 않습니다 — 모든 규칙·디렉토리 구조·환경·명령은 [CLAUDE.md](CLAUDE.md)를 단일 진실 공급원(SoT)으로 따릅니다.

이 파일을 읽는 에이전트는 아래 순서로 컨텍스트를 로드하십시오.

1. 루트 공통 규약: [CLAUDE.md](CLAUDE.md)
2. 백엔드 작업 시: [it_backend/CLAUDE.md](it_backend/CLAUDE.md)
3. 프론트엔드 작업 시: [it_frontend/CLAUDE.md](it_frontend/CLAUDE.md)
4. 데이터베이스 작업 시: [it_database/CLAUDE.md](it_database/CLAUDE.md)

주요 섹션 바로가기 (CLAUDE.md 기준):

- 프로젝트와 저장소·주요 루트 경로 — §1
- 단일 진실 공급원과 문서 역할 — §2
- 공통 작업 규칙 (공유 워킹트리, 한글 주석, 인증·비밀값, DB 변경) — §3
- 작업 흐름과 성능·계약·실패 상태 기준 — §4
- Health Stack (검사·테스트 명령) — §5

반복 사용하는 프로젝트 공용 워크플로우 스킬은 [.agents/skills/README.md](.agents/skills/README.md)를 참고하십시오.

이 파일에는 CLAUDE.md와 중복되는 본문을 추가하지 마십시오. 규칙 변경은 CLAUDE.md에만 반영합니다.
