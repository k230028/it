# IT Portal 프로젝트 공용 스킬

이 디렉터리는 반복 사용하는 프로젝트 워크플로우의 단일 위치입니다. 일반 프로젝트 규칙은 루트 `CLAUDE.md`가 SoT이며 스킬에는 실행 판단과 전문 절차만 둡니다.

| 스킬 | 용도 | 이전 지침 |
| --- | --- | --- |
| `it-doc-sync` | 문서·주석 점검, 현행화, 표준화, 개선과 완전성 검증 | `REVIEW.md`, `docs/prompts/ETC.md` |
| `it-test-maintenance` | 커버리지, 단위·통합·E2E 테스트와 결과 보고서 | `TEST.md` |
| `it-clean-code-audit` | 근거 기반 Clean Code·유지보수성 진단 | `docs/prompts/CLEAN_CODE_REVIEW.md` |
| `it-db-gap` | 로컬 DDL과 운영 메타 스냅샷 Gap 분석 | `docs/prompts/DB_GAP.md` |
| `fp` | 정통법 기능점수·비용 산정 | `FP/FP.md` |

각 스킬은 독립적으로 호출합니다. 전체 품질 점검을 요청받더라도 필요한 스킬만 선택하며 모든 스킬을 자동으로 연쇄 실행하지 않습니다.

Claude Code 호환 경로 `.claude/skills/{skill-name}/SKILL.md`에는 Git으로 추적하는 얇은 어댑터만 둡니다. 어댑터는 이 디렉터리의 canonical `SKILL.md`를 읽으므로 실행 지침은 복제하지 않습니다.
