# IT Project Portal 폴더 구조·아키텍처 분석 보고서

- **최초 작성일**: 2026-07-08
- **재점검·현행화일**: 2026-07-26
- **분석 범위**: `C:\it` 모노레포 전체 (it_frontend, it_backend, it_database, 루트 문서/도구)
- **방법론**: (최초) 5개 영역 병렬 분석 후 36건 후보를 개별 에이전트가 실제 명령(git, grep, wc -l)으로 재검증 → 30건 확정. (재점검) 확정 지적 15건 + LOW 항목을 현재 상태 대비 병렬 검증 에이전트 + 직접 확인으로 대조.

> **재점검 요지**: 문서 정합성 계열은 진전이 있었다 — `meta.csv` 경로 오류가 실제 경로(`meta/meta.txt`)로 정정됐고(양 문서), 백엔드 로그 폴더는 추적 해제 + `.gitignore` 등록 + logback 기본 경로 지정으로 실질 해소, AGENTS.md 포트 오기(8080→28080)도 정정됐다. 반면 **저장소 위생(DB 덤프·평문 비밀번호·벤더 바이너리)과 코드 구조(800줄 위반, DB 빈 스키마 재구축)** 는 대부분 그대로다. 프론트 800줄 위반은 28→24개로 줄었으나 백엔드는 7개를 유지(일부 라인 증가).

---

## 0. 재점검 요약 (2026-07-26)

| #   | 심각도  | 항목                             | 상태           | 핵심 근거                                                                                                                                               |
| --- | ---- | ------------------------------ | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | HIGH | 백엔드 런타임 로그 git 커밋              | 🟡 부분해소      | 추적 해제 + `.gitignore(/LOG_PATH_IS_UNDEFINED/)` + logback 기본값 지정. 로컬 폴더(1.52MB)만 잔존                                                                   |
| 2   | MED  | 4-repo 구조 미문서화                 | ⚠️ 잔존        | `versions.lock`/`.gitmodules` 없음, CLAUDE.md/AGENTS.md 미기재                                                                                           |
| 3   | MED  | `meta.csv` SoT 경로 부재           | ✅ 해소         | CLAUDE.md:32·AGENTS.md:33 모두 `meta/meta.txt`로 정정, gap_analysis 디렉토리 제거                                                                              |
| 4   | MED  | AGENTS.md 낡은 사본                | 🟡 부분해소      | 포트 8080→28080 정정. 그러나 여전히 82행 상이(이전 71)                                                                                                             |
| 5   | MED  | 작업 추적 채널 분산                    | ⚠️ 잔존        | TaskNotes·루트 일회성 문서(+ETC.md 신규) 잔존, prds 36 / superpowers plans 72·specs 49                                                                         |
| 6   | MED  | it_database `.git` 비대          | 🟡 부분해소      | `apply-ddl-live.log` 추적 해제. `EXPDAT.DMP`는 **git 관리 유지 확정**(팀 결정) — 임계치(예: .git>200MB/분기 1회) 도달 시 `git filter-repo`로 과거 블롭 정리(force-push+재클론). 런북 README §4.2 |
| 7   | MED  | DB 비밀번호 평문 하드코딩                | ⚠️ 잔존        | `kdb1234!!` 6파일 7행 그대로 추적                                                                                                                           |
| 8   | MED  | 벤더 SSO 바이너리 + 미사용 lombok.jar   | ⚠️ 잔존        | `sso/` 24 tracked(.class 5), `lib/lombok.jar`(2MB) 추적·미참조                                                                                           |
| 9   | MED  | 프론트 빌드 캐시 커밋 + 스크립트 산재         | 🟡 부분해소      | ps1은 루트→`oss/`로 이동. `tsconfig.test.tsbuildinfo`·`preview/*.html` 5건 추적 잔존                                                                           |
| 10  | MED  | 800줄 위반 — 백엔드                  | ⚠️ 잔존(7개)    | 목록 갱신: `AdminService` 신규 진입, `CostDto` 이탈, ProjectService/CouncilController 증가                                                                      |
| 11  | MED  | 800줄 위반 — 프론트                  | 🟡 개선(28→24) | 대형 composable(useCostListPage·usePdfReport) 이탈. pages 16/24                                                                                         |
| 12  | MED  | components/ 루트 평면 파일           | ⚠️ 잔존(24→25) | `components/editor` 미분리, 에디터/앱크롬 혼재 지속                                                                                                              |
| 13  | MED  | DB 빈 스키마 재구축 불가                | ⚠️ 잔존        | 최초 마이그레이션 여전히 `V20260622_006`(ALTER-first), full-CREATE baseline 없음                                                                                 |
| 14  | MED  | 프론트 타입 수동 이중관리                 | ⚠️ 잔존        | `app/types/` 18파일, codegen 의존성 없음                                                                                                                   |
| 15  | MED  | it_database README가 삭제 스크립트 참조 | ⚠️ 잔존        | `connect-db.ps1/.bat` 부재, README 25·30·222·231행 참조 잔존                                                                                               |

---

## HIGH — 즉시 조치 권장

### 1. 백엔드 런타임 로그가 git에 커밋된 채 계속 증가 중 — 🟡 부분해소
- **최초 근거**: `it_backend/LOG_PATH_IS_UNDEFINED/it-backend.log`(~1.1MB)가 git 추적 상태이고 실행마다 갱신.
- **현재**: git **추적 해제됨**(`git -C it_backend ls-files -- LOG_PATH_IS_UNDEFINED/` 공란) + `it_backend/.gitignore:48`에 `/LOG_PATH_IS_UNDEFINED/` 등록. 근본 원인도 처리됨 — `logback-spring.xml:16`이 `LOG_PATH` 기본값(local `c:/itp_log`, prod `/log/springitp`) 지정. **잔여**: 로컬 작업트리에 폴더/파일(현재 1.52MB)이 남아 있으나 untracked. 로컬 정리만 하면 종결.

---

## MEDIUM — 계획적 개선

### 저장소·문서 정합성

**2. 4개 분리 저장소 구조가 문서화되어 있지 않음 — ⚠️ 잔존**
- **현재**: `C:/it/.gitignore` 1~3행이 여전히 it_frontend/it_backend/it_database 제외. 루트에 `versions.lock`·`manifest`·`.gitmodules` 없음. CLAUDE.md §2는 단일 트리로 기술(§90의 부수 언급 외 토폴로지 명문화 없음), AGENTS.md도 미기재.
- **권장 조치**: (변동 없음) 서브레포 커밋 SHA manifest(`versions.lock`) 도입 + 루트 CLAUDE.md에 4-repo 구조·릴리스 동기화 절차 명문화 + MEMORY의 "중첩 저장소는 it_backend"를 3개 전부로 정정.

**3. SoT가 존재하지 않는 파일을 가리킴 — ✅ 해소**
- **현재**: `C:\it\meta.csv`는 여전히 부재하나, CLAUDE.md:32·AGENTS.md:33이 모두 실존 파일 `` `C:\it\meta\meta.txt` ``(5.47MB)를 가리키도록 **정정 완료**. `meta/gap_analysis/` 디렉토리 자체가 제거되어 `table.csv` 오참조 재발 소지도 사라짐(`meta/table.txt` 존재).

**4. AGENTS.md가 CLAUDE.md의 낡은 사본 — 🟡 부분해소**
- **현재**: 백엔드 포트 오기 **정정 완료**(8080 0건, 4곳 모두 28080: AGENTS.md 40·41·57·111). 다만 `diff CLAUDE.md AGENTS.md`가 **82행 상이**(이전 71행, CLAUDE.md 162 vs AGENTS.md 132)로 여전히 드리프트. "얇은 포인터 문서화"는 미이행.
- **권장 조치**: AGENTS.md를 "본문은 CLAUDE.md 참조" 수준으로 축소하거나 REVIEW.md 워크플로우 체크리스트에 동기화 편입.

**5. 작업 추적 채널이 5~6개로 분산 — ⚠️ 잔존(일부 증가)**
- **현재**: TASK.md·TASK_DONE.md·TaskNotes(Obsidian) 유지. prds 36건(md), docs/superpowers plans 72·specs 49로 증가. 루트 일회성 지시문서(REVIEW.md·TEST.md·DB_GAP.md·CLEAN_CODE_REVIEW.md) 잔존 + **ETC.md 신규 추가**. CLAUDE.md §2/§4.3에는 여전히 TASK.md·docs만 등재.
- **권장 조치**: 채널별 역할을 §4.3에 1줄씩 명시. TaskNotes 폐기/흡수, 일회성 지시문서는 `docs/prompts/`로 이동.

### 저장소 위생

**6. it_database `.git`이 비대 — 🟡 방식 확정 (git 관리 유지 + 정기 히스토리 정리)**

- **현황**: `EXPDAT.DMP`(현재 10.0MB, ITPOWN 스키마 Data Pump 전체 export — 데이터+DDL)는 **의도된 팀 백업**이자 표준 복구 수단(`impdp parfile=import.par`=REPLACE / `import_data_only.par`=DATA_ONLY·TRUNCATE). 팀 논의 결과 **git으로 계속 관리**하기로 확정했다(외부화/LFS 미채택). 운영상 필요한 것은 최신 1개뿐이며 과거 이력은 불필요.
- **문제**: 매 갱신 ~10MB 블롭이 히스토리에 누적 → 현재 `.git` 84MB, 갱신할수록 무한 증가. **`git gc`로는 줄지 않는다**(도달 가능한 히스토리는 영구 보존) — 실제 용량 회수는 **히스토리 재작성**으로만 가능하다.
- **확정 방식(A: main 커밋 + 정기 정리)**:
  1. 지금처럼 `EXPDAT.DMP`를 main에 커밋(워크플로우 불변).
  2. 저장소가 임계치(권장: `.git` > 200MB 또는 분기 1회)에 이르면 과거 덤프 블롭을 히스토리에서 제거해 회수한다. 신선한 클론에서 최신 덤프 백업 → `git filter-repo --path EXPDAT.DMP --invert-paths --force` → 최신 덤프 복원·재커밋 → `git push --force` → **전원 재클론/재설정 공지**. (BFG `--delete-files EXPDAT.DMP`도 동일. filter-repo/BFG는 별도 설치.) **운영 런북은 `it_database/README.MD` §4.2** 참조.
- **트레이드오프**: 정리 사이엔 저장소가 커지고(갱신×10MB), 매 갱신 10MB를 원격에 push, 정리 시마다 force-push+재클론. **소규모 팀 전제라 재클론 비용이 낮아 수용 가능**하다는 판단.
- **반려된 대안**: 외부화(공유경로/GitHub Release)·Git LFS·orphan `db-dump` 브랜치 — 검토했으나 팀 규모가 작아 A의 단순성(외부 인프라·워크플로우 변경 불요)을 우선.
- **상태**: 방식 확정. 현재 84MB는 첫 정기 정리 시 회수(그전까지 유지). 사내 GitLab 이관 후에도 A 유지 가능하며, 필요 시 그 시점에 재검토.

**7. DB 비밀번호 평문이 git 추적 파일에 하드코딩 — ⚠️ 잔존**
- **현재**: `kdb1234!!`가 여전히 6파일 7행 추적: `README.MD:130,136`, `apply-ddl-live.ps1:6`, `export-ddl-live.ps1:6`, `export.par:1`, `import.par:1`, `import_data_only.par:1`. CLAUDE.md §4.2(환경변수 주입) 원칙과 불일치 지속.
- **권장 조치**: (변동 없음) ps1 기본값 제거 → 필수 파라미터/`DB_PASSWORD` 환경변수. `*.par`는 USERID 제거. README는 플레이스홀더로 교체.

**8. 벤더 SSO 배포물(.class)과 미사용 lombok.jar 추적 — ⚠️ 잔존**
- **현재**: `it_backend/sso/` 24개 파일 추적(.class 5종: Business/CheckAuth/Logout/ConfigureSetting/ConfigureSettingListner, config.properties 2, .java/.jsp/web.xml 포함). `lib/lombok.jar`(2,040,253바이트) 추적·디스크 존재. `build.gradle:153,157`은 lombok을 정상 Gradle 의존성(`compileOnly`+`annotationProcessor`)으로 관리 → 커밋된 `lib/lombok.jar`은 **중복·미사용**.
- **권장 조치**: SSO 배포물은 저장소 밖(사내 아티팩트 저장소)으로 이전, `lib/lombok.jar` 제거.

**9. 프론트 빌드 캐시 커밋 + 운영 스크립트 산재 — 🟡 부분해소**
- **현재**: ps1 스크립트는 **루트에서 `it_frontend/oss/`로 이동**(check-npm-repo-coverage·lib-npm-platform·make-local-npm-repo·rebuild-local-npm-repo 4종). 그러나 `tsconfig.test.tsbuildinfo`(19KB)는 **여전히 추적**이며 `.gitignore` 미등록, `preview/*.html` 5건도 추적 잔존.
- **권장 조치**: `tsconfig.test.tsbuildinfo`를 `.gitignore` 추가 + 추적 해제. `preview/`는 `docs/`로 이동.

### 코드 구조

**10. 800줄 상한 위반 — 백엔드 7개(유지) — ⚠️ 잔존**
- **현재 목록**(라인 재측정): `ProjectService.java` **1,350**, `CouncilController.java` **1,215**, `CostService.java` **1,046**, `BudgetWorkService.java` **1,016**, `CouncilDto.java` **926**, `ProjectDto.java` **875**, `AdminService.java` **808**(신규 진입). 이전 목록의 `CostDto.java`는 **667줄로 감소해 이탈**. 총 개수는 7개로 동일하나 ProjectService(+172)·CouncilController(+239)·CostService(+88)가 증가.
- **권장 조치**: CouncilController 기능군별 분할, ProjectService·BudgetWorkService 조회/변경 추출, 대형 Dto record 축소. (clean-code-review-2026-07-07.md §3.2와 통합 과제)

**11. 800줄 상한 위반 — 프론트 28→24개 — 🟡 개선**
- **현재**: 총 **24개**(이전 28), `pages/` 소속 **16개**. 대형 composable이 대거 이탈 — `useCostListPage.ts`(1,790→358), `usePdfReport.ts`(삭제)로 composable 초과는 `useTiptapTableTools.ts`(816) 하나뿐. 상위: `utils/hwpx.ts` 1,400, `pages/info/documents/[id]/index.vue` 1,350, `pages/budget/status.vue` 1,207, `components/TiptapToolbar.vue` 1,196, `pages/info/plan/[id].vue` 1,185, `pages/info/plan/form.vue` 1,176, `pages/info/projects/form.vue` 1,158, `components/TiptapEditor.vue` 1,148 등.
- **권장 조치**: 최대 페이지부터 섹션 컴포넌트/ composable 추출 지속.

**12. components/ 루트에 평면 파일 24→25개 — ⚠️ 잔존**
- **현재**: 루트 평면 **25개**로 오히려 1개 증가. Tiptap/노드뷰 계열 9(TiptapEditor·TiptapToolbar·TiptapTableFloatingToolbar·AttachmentNodeView·Block/InlineMathNodeView·ResizableImageNodeView·VariableNodeView·MentionAutocomplete), Excalidraw 2가 앱 크롬 10(App*·PageHeader·GlobalSearchBar·Notification*)과 동일 층위. `components/editor/` 미신설.
- **권장 조치**: `components/editor/`·`components/layout/` 신설해 이동. tiptap-extensions 계열도 editor 하위로.

**13. DB 빈 스키마 재구축 불가 + 스냅샷-마이그레이션 이중 SoT 드리프트 — ⚠️ 잔존**
- **현재**: `migrations/`(61개)의 최초 스크립트가 여전히 `V20260622_006__AddMplAmtToBitemm.sql`이며 `ALTER TABLE TPRMPP_BITEMM ADD (...)`로 시작(컬럼 존재 가드는 있으나 **테이블 존재를 전제**) → 빈 스키마에서 실패. `V*_001` 전체 CREATE 부트스트랩 없음. CLAUDE.md §4.4가 인용한 `baseline-version=20260620.001`에 해당하는 `V20260620*` 스크립트도 부재. 전체 DDL 덤프 `ITPOWN_DDL_live.sql`(CREATE TABLE 89개, 추적)은 존재하나 **Flyway 체인 밖**이라 빈 스키마 경로에서 적용되지 않음.
- **권장 조치**: 부트스트랩 경로를 "빈 스키마 = 스냅샷(ITPOWN_DDL_live.sql) → Flyway baseline → 이후 V*"로 README·CLAUDE.md §4.4에 정정 + "스냅샷+baseline == 마이그레이션 적용 결과" 검증 절차 추가. **드리프트 복구(데이터 포함)는 #6의 `EXPDAT.DMP` impdp 경로와 정합**되도록, 덤프 생성 시 기록하는 마이그레이션 헤드 태그를 공유해 "덤프 = 어느 V*까지 반영"을 명시한다. (DDL-only `ITPOWN_DDL_live.sql`과 data 포함 `EXPDAT.DMP`의 역할 구분도 함께 문서화.)

**14. 프론트 API 타입과 백엔드 DTO의 수동 이중 관리 — ⚠️ 잔존**
- **현재**: `app/types/` **18개** 수기 타입 파일(이전 ~16). `package.json`에 openapi-typescript/orval/codegen 의존성 없음. 백엔드 Swagger UI는 노출 중.
- **권장 조치**: openapi-typescript 등 codegen 도입 검토로 드리프트 축소.

**15. it_database README가 삭제된 접속 스크립트를 참조 — ⚠️ 잔존**
- **현재**: `connect-db.ps1`/`connect-db.bat` 여전히 부재하나 `README.MD`가 4곳(25·30·222·231행)에서 참조 지속.
- **권장 조치**: 해당 절을 현재 접속 방법(직접 sqlplus, CLAUDE.md §3.1.1)으로 갱신하거나 스크립트 복원.

---

## LOW — 여유 시 정리 (현행화 메모)

- 루트 §4.3 정책 밖 문서: DB_GAP.md·TEST.md·REVIEW.md·CLEAN_CODE_REVIEW.md·TASK_DONE.md·**ETC.md(신규)** 잔존. 일부(REVIEW.md·TEST.md)는 README 공식 워크플로우로 등재된 의도적 구성.
- AGENTS.md 이중 관리(위 MEDIUM 4와 별개 구조 중복) 지속.
- 생성 산출물 추적: `docs/test/*.html`, `.review-cache/`, `.superpowers/` pid 파일 등.
- 외부 도구 fork(`everything-claude-code/`)와 개인 Obsidian 볼트(`TaskNotes/`, `.obsidian/`) 프로젝트 루트 혼재.
- **정리 진전**: `docs/fp_estimation_report.md`·`docs/meta-compliance-report.md`·`meta/gap_analysis/`가 제거됨(작업트리 반영) → FP 보고서·DB Gap 산출물 2벌 병존 문제는 일부 해소. `FP/fp-estimate-report.md`가 잔여 정본.
- 백엔드 `domain/entity` 패키지가 `BaseEntity` 1개 파일용으로 존재(19개 패키지 임포트) — 이름/실체 불일치.
- 백엔드 레이어 어휘 혼재(`common/approval` domain+entity 이중, `common/sso` 평면, `common/admin` realtime 수직 슬라이스).
- DB 도구가 3곳(루트, `tools/`, `migrations/_data/`) 분산.
- Superpowers 산출물 보관처 이원화(루트 `docs/superpowers/` vs `it_frontend/docs/superpowers/`).
- 루트 CLAUDE.md §2 디렉토리 트리가 실제 최상위 구성 절반 미만 기술(meta/, prds/, tools/, TaskNotes/, FP/ 누락).
- 프론트 `stores/review.ts`의 서버/세션 상태 혼합 — CLAUDE.md §4.7.0에 "기존 예외, 신규 복제 금지"로 문서화된 레거시.

---

## 검증에서 기각된 항목 (오탐 방지 참고 — 유지)

재검증 결과 CLAUDE.md에 이미 의도된 설계로 문서화되어 있거나 사실과 다른 것으로 확인되어 기각된 항목(현행화 시점에도 유효):

- **감사 로그(`domain/log`)가 common 소속 엔티티 로그까지 보유** → it_backend/CLAUDE.md §4.2·§5.2에 Capplm↔CapplmL 등 짝이 명시된 의도된 설계.
- **집행 4단계(contract·deliberation·payment) 테스트 부재** → ContractServiceTest/DeliberationServiceTest/PaymentServiceTest 등 이미 충분.
- **`server/` Nitro 미들웨어가 운영에서 미실행되어 dev/prod 불일치** → head 인라인 스크립트 + `middleware/auth.global.ts` 클라이언트 SSO 리다이렉트가 동일 UX 보장하는 의도된 이중 설계.
- **`pages/info/projects` vs `pages/project` 라우트 이원화** → it_frontend/CLAUDE.md §4.6의 정보화사업/집행 4단계 의도된 구분.

---

## 권장 실행 순서 (현행화)

1. **완료된 정리**: HIGH 1(로그 추적 해제+logback 기본값), meta.csv 경로 정정, AGENTS.md 포트 오기 정정 — ✅ 반영됨.
2. **다음 1시간 배치**: `tsconfig.test.tsbuildinfo`·`preview/` 정리, README connect-db 참조 제거, LOG_PATH_IS_UNDEFINED 로컬 폴더 삭제. (`EXPDAT.DMP`는 git 관리 유지 확정(#6 A안) — 저장소가 임계치에 이르면 `git filter-repo`로 과거 덤프 블롭 정리, 최초 84MB도 이때 회수)
3. **문서 현행화 배치**: CLAUDE.md §2 4-repo 토폴로지 명문화, DB 부트스트랩 경로 정정(#13), AGENTS.md 얇은 포인터화, §4.3 작업 채널 역할 명시.
4. **저장소 위생 배치**: DB 평문 비밀번호 환경변수화(#7), 백엔드 벤더 SSO 바이너리·lib/lombok.jar 정리(#8).
5. **구조 리팩터링(별도 과제)**: 백엔드 대형 서비스 분해(ProjectService·CouncilController·CostService — 라인 증가 중) → components/editor 분리 → 프론트 잔여 800줄 페이지 분해. (clean-code-review-2026-07-07.md 이행계획과 통합)
