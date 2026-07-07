# IT Project Portal 폴더 구조·아키텍처 분석 보고서

- **작성일**: 2026-07-08
- **분석 범위**: `C:\it` 모노레포 전체 (it_frontend, it_backend, it_database, 루트 문서/도구)
- **방법론**: 5개 영역(저장소 루트, 백엔드, 프론트엔드, 데이터베이스, 문서/경계) 병렬 분석 후, 도출된 36건의 개선점 후보를 개별 에이전트가 실제 명령(git, grep, wc -l 등)으로 재검증. 30건 확정, 4건은 "CLAUDE.md에 이미 의도된 설계로 문서화됨"으로 기각, 나머지 2건은 재검증 오류로 별도 확인 후 확정.

## 종합 평가

아키텍처 자체는 건강하다. 백엔드의 도메인 우선 + 5레이어 구조는 대부분 도메인에서 일관되고, 프론트의 API 호출은 `useApiFetch`/`$apiFetch` 래퍼로 일원화되어 있으며(하드코딩 0건), Flyway 네이밍은 27개 전수 위반 0건, 테스트 트리도 main과 대칭이다. 실제 개선이 필요한 곳은 코드 구조가 아니라 다음 네 가지다.

1. 저장소 토폴로지(중첩 git 4개 구조)의 미문서화
2. 저장소 위생 — 커밋된 런타임 로그·DB 덤프·벤더 바이너리
3. 800줄 상한 위반 파일 (백엔드 7개, 프론트 28개)
4. 문서 드리프트 (AGENTS.md, meta.csv 경로, DB 부트스트랩 절차)

---

## HIGH — 즉시 조치 권장

### 1. 백엔드 런타임 로그가 git에 커밋된 채 계속 증가 중
- **근거**: `it_backend/LOG_PATH_IS_UNDEFINED/it-backend.log`(1,105,456바이트)가 git 추적 상태(커밋 `ec0f58f` 포함)이고 실행할 때마다 갱신됨(최종 수정 Jul 8 00:43). logback의 `LOG_PATH` 프로퍼티가 미정의일 때 생성되는 산출물 폴더.
- **권장 조치**: `git rm --cached`로 추적 해제 + `.gitignore` 등록. logback 설정에 `LOG_PATH` 기본값(`c:/itp_log`) 지정해 폴더 자체가 생성되지 않게 수정. CLAUDE.md §5.20 로그 경로 정책과 일치시킬 것.

---

## MEDIUM — 계획적 개선

### 저장소·문서 정합성

**2. 4개 분리 저장소 구조가 문서화되어 있지 않음**
- **근거**: `C:/it/.gitignore` 1~3행이 it_frontend/it_backend/it_database를 모두 제외. 세 디렉토리는 각각 독립 git 저장소(origin: `gonnabe88/{it_frontend,it_backend,it_database}`), 외부 저장소(`gonnabe88/it`)는 문서·스킬·도구 285개 파일만 추적. submodule/subtree 설정 없음. 루트 CLAUDE.md는 단일 트리로만 기술.
- **영향**: API 계약 변경처럼 프론트+백+DDL을 함께 바꾸는 작업이 원자적으로 커밋될 수 없고, 호환되는 커밋 조합의 기록이 없음.
- **권장 조치**: (1) git submodule 또는 서브레포 커밋 SHA를 기록하는 manifest(`versions.lock`) 도입, (2) 루트 CLAUDE.md에 4-repo 구조와 릴리스 시 동기화 절차 명문화, (3) MEMORY의 "중첩 저장소는 it_backend"만 기록된 부분을 3개 전부로 정정.

**3. SoT가 존재하지 않는 파일을 가리킴**
- **근거**: CLAUDE.md:32, AGENTS.md:32가 메타용어사전 SoT로 `C:\it\meta.csv`를 지정하나 실존하지 않음. 실제 파일은 `meta/meta.txt`(5,468,175바이트, 78,643행 CSV). 참조 문서 8개 이상(docs/meta-compliance-report.md 등). `meta/gap_analysis/db_gap_summary.md`도 존재하지 않는 `meta/table.csv`(실제는 `table.txt`)를 참조.
- **권장 조치**: `meta/meta.txt`를 `meta.csv`로 리네임하거나 CLAUDE.md·AGENTS.md의 SoT 경로를 실제 경로로 수정. gap_analysis 문서의 table.csv 참조도 보정.

**4. AGENTS.md가 CLAUDE.md의 낡은 사본**
- **근거**: `diff CLAUDE.md AGENTS.md` 71행 상이. 백엔드 포트를 8080으로 오기(4곳, 실제 28080). docs/ 구조를 "PDCA 문서(01-plan~04-report, archive)"로 기술하나 실제로는 `superpowers/{notes,plans,specs}`, `test/`만 존재. 협의회 역할 구분, 주석 현행화 원칙 등 신규 정책 누락.
- **권장 조치**: AGENTS.md를 "본문은 CLAUDE.md 참조" 수준의 얇은 포인터 문서로 축소하거나, CLAUDE.md 갱신 시 동기화를 REVIEW.md 워크플로우 체크리스트에 포함. 최소한 포트·docs 구조 오류는 즉시 보정.

**5. 작업 추적 채널이 5~6개로 분산**
- **근거**: TASK.md(92행), TASK_DONE.md(504행), TaskNotes/(Obsidian vault, Tasks 4건), prds/(ing 1건+done 35건), docs/superpowers/(plans 54, specs 41, notes 2), 루트 일회성 지시문서 4건(REVIEW.md, TEST.md, CLEAN_CODE_REVIEW.md, DB_GAP.md). CLAUDE.md §2/§4.3에는 TASK.md·docs만 등재.
- **권장 조치**: 채널별 역할을 §4.3에 1줄씩 명시. TaskNotes(4건뿐)는 폐기 또는 TASK.md로 흡수. 일회성 지시문서는 `docs/prompts/`로 이동.

### 저장소 위생

**6. it_database `.git`이 74MB로 비대**
- **근거**: `EXPDAT.DMP`(8,482,816바이트)가 88회, `apply-ddl-live.log`(106KB)가 21회 반복 커밋. `it_database/.gitignore`는 사실상 비어 있어 어떤 산출물도 제외되지 않음. `tools/diff_report2.txt`, `tools/local_defaults.txt` 등 일회성 산출물도 추적 중.
- **권장 조치**: `git rm --cached` + `.gitignore`에 `*.DMP`, `*.log`, `tools/diff_report*.txt` 등록. 덤프 백업이 필요하면 Git LFS 또는 저장소 외부 경로 분리. 필요 시 `git filter-repo`로 과거 88개 blob 정리.

**7. DB 비밀번호 평문이 6개 git 추적 파일에 하드코딩**
- **근거**: `kdb1234!!`가 `apply-ddl-live.ps1:6`, `export-ddl-live.ps1:6`, `export.par`, `import.par`, `import_data_only.par`, `README.MD:130,136`에 존재. 로컬 XE 한정·저장소 비공개이나 CLAUDE.md §4.2 원칙(환경변수 주입)과 불일치.
- **권장 조치**: ps1의 `$Password` 기본값 제거 → 필수 파라미터 또는 `DB_PASSWORD` 환경변수 전환. `*.par`는 USERID 제거 후 실행 시 인자로 전달. README 예시는 플레이스홀더로 교체.

**8. 벤더 SSO 배포물(.class 바이너리)과 미사용 lombok.jar가 소스 저장소에 추적**
- **근거**: `sso/별첨1._SSO_Web_Agent(SA-WEB)/` 하위 Penta Security JSP·web.xml·컴파일된 `.class` 5종·`config.properties`, `lib/lombok.jar`(2.0MB, build.gradle 어디서도 미참조)가 git 추적.
- **권장 조치**: SSO 에이전트 배포물은 저장소 밖(사내 아티팩트 저장소)으로 이전. lombok은 Gradle 의존성으로만 관리하고 `lib/` 제거.

**9. 프론트 빌드 캐시(`tsconfig.test.tsbuildinfo`)가 중첩 저장소에 커밋 + 운영 스크립트 루트 산재**
- **근거**: it_frontend 자체 중첩 저장소에서 `tsconfig.test.tsbuildinfo`(증분 타입체크 캐시), `*.ps1` 3종(check/make/rebuild-npm-repo), `preview/*.html` 5건이 추적. `dist/`, `coverage/` 등은 정상적으로 미추적.
- **권장 조치**: `tsconfig.test.tsbuildinfo`를 `.gitignore`에 추가 + 추적 해제. ps1 스크립트는 `scripts/`로 이동. `preview/`는 `docs/`로 이동.

### 코드 구조

**10. 800줄 상한 위반 — 백엔드 7개**
- **근거**: `ProjectService.java` 1,178줄, `ProjectDto.java` 1,087줄, `BudgetWorkService.java` 1,031줄, `CouncilController.java` 976줄, `CostService.java` 958줄, `CouncilDto.java` 875줄, `CostDto.java` 825줄. CouncilController는 서비스 8개를 주입받는 구조(이미 docs/clean-code-review-2026-07-07.md에 분해 계획 등재된 기지 부채).
- **권장 조치**: CouncilController를 기능군(개최준비/일정/결과/평가)별로 분할. ProjectService·BudgetWorkService는 조회/변경 단위로 추출. 1000줄대 Dto는 요청/응답 record로 축소.

**11. 800줄 상한 위반 — 프론트 28개, 페이지 모놀리스에 집중**
- **근거**: `pages/info/projects/form.vue` 2,149줄, `pages/info/plan/[id].vue` 2,078줄, `composables/useCostListPage.ts` 1,790줄, `utils/hwpx.ts` 1,499줄, `pages/info/documents/[id]/index.vue` 1,408줄, `components/TiptapToolbar.vue` 1,286줄 등. 28개 중 17개가 `pages/` 소속.
- **권장 조치**: 최대 페이지부터 섹션 단위 컴포넌트로 추출하고 화면 로직은 composable로 이동. `useCostListPage.ts`는 이미 존재하는 `costListPageHelpers.ts` 분리 패턴을 탭/필터/내보내기 단위로 확장.

**12. components/ 루트에 평면 파일 24개 — 에디터 도메인과 앱 크롬 미분리**
- **근거**: `components/`는 도메인 폴더(council, common, admin 등)와 루트 평면 24파일이 혼재. Tiptap 계열 8개(TiptapEditor/TiptapToolbar 등)와 Excalidraw 2개가 앱 크롬(AppHeader/AppSidebar 등)과 같은 층위.
- **권장 조치**: `components/editor/` 신설해 Tiptap·Excalidraw·NodeView 계열 이동. 앱 크롬은 `components/layout/`으로 분리. `extensions/tiptap-content-extensions.ts`(1,030줄), `tiptap-extensions.ts`(997줄)도 editor 하위로 이동.

**13. DB 빈 스키마 재구축 불가 + 스냅샷-마이그레이션 이중 SoT 드리프트**
- **근거**: pre-baseline 마이그레이션(V20260603_005~V20260607_007 등 38개 이상)이 커밋 `be2c394`에서 삭제되어 현존 최초 스크립트 `V20260622_006`은 빈 스키마에 없는 테이블을 ALTER TABLE → 빈 스키마에 전체 V* 적용 시 ORA-00942로 실패. 그럼에도 README.MD:262, 루트 CLAUDE.md §4.4는 "빈 스키마는 전체 V* 순서대로 적용"이라 기술. `V20260706_002`가 추가한 컬럼이 DDL 스냅샷(`ITPOWN_DDL_live.sql`, 2026-07-06 커밋)에 없어 스냅샷이 마이그레이션보다 뒤처짐이 실증됨.
- **권장 조치**: 부트스트랩 경로를 "빈 스키마는 apply-ddl-live.ps1(스냅샷) → Flyway baseline → 이후 V*" 순서로 README·CLAUDE.md §4.4에 정정. 스냅샷 재생성 시점 규칙과 "스냅샷+baseline == 마이그레이션 적용 결과" 검증 절차 추가.

**14. 프론트 API 타입(`app/types/`)과 백엔드 DTO의 수동 이중 관리**
- **근거**: `app/types/`에 16개 타입 파일(auth, board, contract, council 등)이 백엔드 DTO를 손으로 옮겨 적는 구조이며, package.json에 OpenAPI codegen(openapi-typescript, orval 등) 의존성이 없음. 백엔드에는 이미 Swagger UI가 노출되어 있음(`localhost:28080/swagger-ui`).
- **권장 조치**: openapi-typescript 등 codegen 도입을 검토해 드리프트 위험 축소.

**15. it_database README가 삭제된 접속 스크립트를 참조**
- **근거**: README.MD가 `it_database/connect-db.ps1`, `it_database/connect-db.bat`를 4곳에서 참조(25, 30, 222, 231행)하나 두 파일 모두 디스크에 존재하지 않음.
- **권장 조치**: README의 해당 절을 현재 접속 방법(직접 sqlplus 접속, CLAUDE.md §3.1.1 참조)으로 갱신하거나 스크립트를 복원.

---

## LOW — 여유 시 정리

- 루트에 §4.3 정책 밖 문서 6종 산재(DB_GAP*, TEST.md, REVIEW.md, CLEAN_CODE_REVIEW.md, TASK_DONE.md) — 일부(REVIEW.md, TEST.md)는 README에 공식 워크플로우로 이미 등재된 의도적 구성
- AGENTS.md가 CLAUDE.md와 별개로 이중 관리(위 MEDIUM 4번과 별개로 구조적 중복 자체도 정리 대상)
- 생성 산출물이 git 추적 중: `docs/test/*.html` 8개, `.review-cache/` 9개, `.superpowers/` pid 파일 2개
- 외부 도구 fork(`everything-claude-code/`)와 개인 Obsidian 볼트(`TaskNotes/`, `.obsidian/`)가 프로젝트 루트에 혼재
- FP 산정 보고서 2벌 병존(`FP/fp-estimate-report.md` vs `docs/fp_estimation_report.md`), DB Gap 분석 산출물도 2세대 병존(루트 `DB_GAP_RESULT.md` vs `meta/gap_analysis/`)
- 백엔드 `domain/entity` 패키지가 `BaseEntity` 1개 파일용으로 존재해 이름이 실체와 불일치(19개 패키지가 임포트)
- 백엔드 레이어 어휘 혼재: `common/approval`의 domain+entity 이중 패키지, `common/sso`의 평면 구조, `common/admin`의 realtime 수직 슬라이스 혼재
- 백엔드 루트에 maven-repo 관리 스크립트·매니페스트 6종 산재(`scripts/` 디렉토리가 이미 있음에도)
- DB 도구가 3곳(루트, `tools/`, `migrations/_data/`)에 분산, 명명도 실체와 불일치(`_data/`에 마이그레이션 생성기 코드)
- Superpowers 산출물 보관처 이원화(루트 `docs/superpowers/` vs `it_frontend/docs/superpowers/`)
- 루트 CLAUDE.md §2 디렉토리 트리가 실제 최상위 구성의 절반 미만만 기술(meta/, prds/, tools/, TaskNotes/, FP/ 누락)
- 프론트 `stores/review.ts`의 서버 상태·세션 상태 혼합 패턴 — 이미 CLAUDE.md §4.7.0에 "기존 예외, 신규 복제 금지"로 문서화된 레거시 부채

---

## 검증에서 기각된 항목 (오탐 방지 참고)

다음은 최초 분석에서 개선점으로 지적됐으나, 재검증 결과 실제로는 CLAUDE.md에 이미 의도된 설계로 문서화되어 있거나 사실과 다른 것으로 확인되어 기각됨.

- **감사 로그(`domain/log`)가 common 소속 엔티티의 로그까지 보유** → it_backend/CLAUDE.md §4.2, §5.2에 Capplm↔CapplmL 등 짝이 명시적 예시로 규정된 의도된 설계
- **정보화사업 집행 4단계(contract·deliberation·payment) 테스트 사실상 부재** → ContractServiceTest 39건, DeliberationServiceTest 45건, PaymentServiceTest 45건 등 이미 충분히 존재
- **`server/` Nitro 미들웨어가 운영(정적 CSR 배포)에서 실행되지 않아 dev/prod 불일치** → `nuxt.config.ts`의 head 인라인 스크립트와 `middleware/auth.global.ts`의 클라이언트 SSO 리다이렉트가 운영에서 동일 UX를 보장하는 의도된 이중 설계
- **`pages/info/projects` vs `pages/project` 라우트 이원화** → it_frontend/CLAUDE.md §4.6에 정보화사업/집행 4단계로 명시된 의도된 구분

---

## 권장 실행 순서

1. **1시간 내 가능한 정리**: HIGH 1건(로그 추적 해제 + logback 기본값) + meta.csv 경로 정정 + AGENTS.md 포트 오기 수정
2. **문서 현행화 배치**: CLAUDE.md §2 저장소 토폴로지 명문화, DB 부트스트랩 경로 정정, README의 삭제된 스크립트 참조 제거 — 기존 REVIEW.md 현행화 워크플로우에 포함 가능
3. **저장소 위생 배치**: it_database 덤프/로그/비밀번호, 백엔드 벤더 바이너리, 프론트 빌드 캐시 정리
4. **구조 리팩터링(별도 과제)**: 프론트 페이지 모놀리스 분해 → components/editor 분리 → 백엔드 비대 클래스 정리(기존 clean-code 이행계획과 통합)
