# IT Portal 프로젝트 공용 스킬

이 디렉터리는 반복 사용하는 프로젝트 워크플로우의 단일 위치입니다. 일반 프로젝트 규칙은 루트 `CLAUDE.md`가 SoT이며 스킬에는 실행 판단과 전문 절차만 둡니다.

| 스킬 | 용도 | 이전 지침 |
| --- | --- | --- |
| `it-doc-sync` | 문서·주석 점검, 현행화, 표준화, 개선과 완전성 검증 | `REVIEW.md`, `docs/prompts/ETC.md` |
| `it-test-maintenance` | 커버리지, 단위·통합·E2E 테스트와 결과 보고서 | `TEST.md` |
| `it-clean-code-audit` | 근거 기반 Clean Code·유지보수성 진단 | `docs/prompts/CLEAN_CODE_REVIEW.md` |
| `it-db-gap` | 로컬 DDL과 운영 메타 스냅샷 Gap 분석 | `docs/prompts/DB_GAP.md` |
| `it-db-migration` | Flyway 마이그레이션 작성·번호 선점·적용·검증과 실패 복구 라우팅 | 신규 자동화 |
| `fp` | 정통법 기능점수·비용 산정 | `FP/FP.md` |
| `it-readme-pdf` | 루트 README와 직접 연결된 Markdown을 단일 PDF로 생성·검증 | 신규 자동화 |
| `it-design-doc` | 기간·PRD 단위 변경분을 공공기관 공문서 스타일 분석/설계서로 작성 | 신규 자동화 |
| `it-design-doc-pdf` | 분석/설계서 Markdown(사용자 수정본 포함)을 브랜드 디자인 A4 PDF로 변환·검증 | 신규 자동화 |
| `it-test-doc` | 분석/설계서의 시나리오로 Vitest·JUnit·E2E를 실행하고 증적과 함께 테스트 결과서 작성 | 신규 자동화 |
| `it-test-doc-pdf` | 테스트 결과서 Markdown을 PASS/FAIL 배지가 있는 브랜드 디자인 A4 PDF로 변환·검증 | 신규 자동화 |

각 스킬은 독립적으로 호출합니다. 전체 품질 점검을 요청받더라도 필요한 스킬만 선택하며 모든 스킬을 자동으로 연쇄 실행하지 않습니다.

## 이 프로젝트에 적용하지 않는 로컬 스킬

`hookify-rules`, `plankton-code-quality`는 개발자가 개인적으로 내려받은 Codex 커뮤니티 스킬이며 Git으로 추적하지 않습니다. 둘 다 `.Codex/` 경로와 `uv`·`bun`·`ruff`·`biome` 도구 체계를 전제하지만 이 저장소의 품질 게이트는 Gradle Spotless·JaCoCo와 npm·ESLint·Prettier·Stylelint입니다. 프로젝트 작업에 적용하지 마십시오.

Claude Code 호환 경로 `.claude/skills/{skill-name}/SKILL.md`에는 Git으로 추적하는 얇은 어댑터만 둡니다. 어댑터는 이 디렉터리의 canonical `SKILL.md`를 읽으므로 실행 지침은 복제하지 않습니다.
