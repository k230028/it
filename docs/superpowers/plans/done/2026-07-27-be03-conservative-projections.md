# BE-03 보수적 프로젝션 1차 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** BE-03 경계선 6개 묶음에 응답 계약을 바꾸지 않는 보수적 프로젝션(응답이 실제 사용하는 컬럼 전체를 담는 view)을 적용하고, 가이드 문서 목록은 사용자 승인에 따라 목록 응답 계약을 분리(본문 CLOB 제외)한다.

**Architecture:** 저장소별 기존 프로젝션 선례(`ApplicationRepository.ApplicationSummaryView`, `OrganizationRepository.OrganizationNameView`, `CostRepository.CostRepresentativeView`, `BoardPostListProjectionIt` 패턴)를 따른다. 읽기·쓰기 공유 메서드는 기존 엔티티 메서드를 유지하고 **응답 전용 신규 메서드만 추가**한다. 신규 조회마다 기존 엔티티 조회와의 결과 동등성(컬럼·정렬·null 계약)을 `AbstractOracleRepositoryTest` 기반 Oracle IT로 선행 검증한다(CLAUDE.md §9). 가이드 목록 계약 분리는 4-repo 규약대로 **백엔드 계약 커밋 → 프론트 커밋** 순서를 지킨다.

**Tech Stack:** Java 25 / Spring Boot 4.1 / Spring Data JPA(인터페이스 프로젝션) / QueryDSL(Projections) / JUnit5+Mockito+AssertJ / Oracle IT(`@Tag("it")`), 프론트 Nuxt 4 + Vitest

**사용자 승인 (2026-07-27):** ① 6건 전부 구현 ② 가이드 목록 CLOB 계약 분리를 지금 함께 진행.

**작업 저장소·브랜치:**
- 백엔드: `C:\it\it_backend`, 신규 브랜치 `feature/be03-conservative-projections` (base: `main`. BE-17 PR #4와 파일 겹침 없음)
- 프론트: `C:\it\it_frontend`, 신규 브랜치 `feature/be03-guide-list-split` (Task 7만)
- 테스트 실행은 반드시 `cd` 후 실행. Gradle 파일락 시 `--no-daemon`.

**조사 근거 (2026-07-27 코드 실측 — 구현 시 재확인 필수):**

| 묶음 | 읽기 메서드 | 응답 소비 getter | 비고 |
|---|---|---|---|
| Estimate | `EstimateRepository.findByRqmBgReqDocNoAndLstYnAndDelYn` ← `EstimateService.loadCurrent` ← `get()` | 7/13: rqmBgReqDocNo, docVrsSno, cncdRfrNo, stsTc, reqCone, fstEnrUsid, fstEnrDtm | loadCurrent는 update/delete/changeStatus/saveLines 쓰기와 공유 — 유지 |
| Application | `ApplicationRepository.findAll/findById` ← `getApplications/getApplication/getApfDtlCone` | 8/15: apfMngNo, itPtlApfPrgStsC, dcdReqTtl, dcdReqInf(CLOB), dcdReqUsid, dcdReqDtm, rgprDcdReqCone, dcdReqBbrC | findById는 approve/recall 쓰기와 공유 — 유지. `ApplicationDto`에 `fromReadViews` 팩토리 기존 존재(재활용/확장) |
| 공통코드 | `CodeRepositoryImpl.findByCIdWithValidDate/findByCIdAndCdvaWithValidDate/findByCTpWithValidDate` ← `CodeService.getCcodemsByCId/getCcodem/getCcodemsByCTp` → `CodeDto.Response` | 18/20 (guid, guidPrgSno 제외) | `@Cacheable findCodeEntitiesByCId`(엔티티 리스트 캐시)와 타 서비스 직접 소비자는 **건드리지 않음**. REST 응답 경로만 전환 |
| 가이드 | `GuideDocRepository.findAllByDelYn`(목록)/`findByDocMngNoAndDelYn`(단건) | 8/10 (guid, guidPrgSno 제외), 본문 nacTxtInf=CLOB | **목록 계약 분리**: 목록 응답에서 본문 제외(승인됨). 단건은 기존 계약 유지 |
| 게시판 | `BoardMetaRepositoryImpl.findAllActiveOrdered`(메타 목록), `BoardCommentRepositoryImpl.findCommentsByPost`(댓글 목록) | 메타 10/17(업무필드 전부, BaseEntity 0), 댓글 11/14(guid, guidPrgSno, lstChgUsid 제외) | 메타 단건 `findByBlbMngNoAndDelYn`은 쓰기 공유 — 유지. 목록 2경로만 전환 |
| 조직 | `OrganizationRepository.findAll` ← `OrganizationService.getOrganizations`(3/12), `AdminService.getOrganizations`(10/12) | 소비자별 상이 | 소비자별 별도 view 2종 |

**공통 구현 규칙 (모든 백엔드 Task):**
1. View는 해당 Repository의 중첩 인터페이스(기존 선례와 동일 위치·명명 `*View`) 또는 QueryDSL `Projections.constructor` + record. 파생 쿼리로 표현 불가한 조건(유효일 범위 등)은 명시 JPQL alias 프로젝션.
2. 기존 엔티티 메서드·시그니처는 삭제/변경하지 않는다. 응답 전용 신규 메서드만 추가.
3. DTO에는 기존 `fromEntity`를 유지하고 `fromView` 팩토리를 추가한다. **응답 JSON은 필드·순서·null 처리까지 기존과 동일해야 한다** (가이드 목록 제외 — Task 6 계약 분리).
4. 단위 테스트: 서비스가 view 메서드를 호출하고 응답이 동일함을 검증. Oracle IT: `AbstractOracleRepositoryTest` 기반으로 (a) view 조회와 기존 엔티티 조회의 결과 필드 동등성 (b) 정렬 계약 (c) null 필드 계약 검증. 선례: `ApplicationReadProjectionIt`, `OrganizationNameProjectionIt`, `BoardPostListProjectionIt`.
5. 한글 JavaDoc(입력·실패 조건), 커밋 메시지 `<type>: <한글>`.
6. 각 Task 완료 시 `./gradlew test` 해당 패키지 + 신규 Oracle IT는 `./gradlew integrationTest --tests <해당IT>`(로컬 Oracle 필요 — 실행 불가 환경이면 컴파일 확인 후 보고서에 명시).

---

### Task 0: 백엔드 브랜치 생성

- [ ] `cd C:\it\it_backend && git checkout main && git pull && git checkout -b feature/be03-conservative-projections`

### Task 1: Estimate 상세 응답 전용 프로젝션

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/repository/EstimateRepository.java` — 중첩 `EstimateDetailView` 인터페이스(getter: getRqmBgReqDocNo, getDocVrsSno, getCncdRfrNo, getStsTc, getReqCone, getFstEnrUsid, getFstEnrDtm) + `Optional<EstimateDetailView> findDetailViewByRqmBgReqDocNoAndLstYnAndDelYn(String, String, String)` 파생 쿼리
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/dto/EstimateDto.java` — `Detail.fromView(EstimateDetailView, ...)` 팩토리 (기존 fromEntity와 동일 매핑; abusNm 보강 로직 등 주변 인자는 기존 시그니처 확인 후 동일 유지)
- Modify: `it_backend/src/main/java/com/kdb/it/domain/estimate/service/EstimateService.java` — `get()`만 view 경로로 전환. `loadCurrent()`와 모든 쓰기 흐름은 불변. `get()` 내 line 조회에 필요한 docVrsSno는 view에서 취득
- Test: `EstimateServiceTest` GetTests 갱신(view mock), 신규 `EstimateDetailProjectionIt`(Oracle IT — 동일 문서의 entity 조회 vs view 조회 필드 동등성·미존재 문서 empty 계약)

**Steps:** TDD(서비스 단위 테스트 RED → repo/DTO/service 구현 → GREEN → IT 작성 → 커밋 `feat: 소요예산 상세 응답 전용 프로젝션 적용 (BE-03)`)

### Task 2: Application 읽기 경로 프로젝션

**Files:**
- Modify: `ApplicationRepository.java` — 중첩 `ApplicationReadView`(getter: getApfMngNo, getItPtlApfPrgStsC, getDcdReqTtl, getDcdReqInf, getDcdReqUsid, getDcdReqDtm, getRgprDcdReqCone, getDcdReqBbrC) + `List<ApplicationReadView> findAllProjectedBy()` + `Optional<ApplicationReadView> findReadViewByApfMngNo(String)`
- Modify: `ApplicationDto.java` — 기존 `fromReadViews` 팩토리 확인 후 이 view 대응 `Response.fromReadView` 추가(기존 fromEntity와 응답 동일)
- Modify: `ApplicationService.java` — `getApplications()`(findAll), `getApplication()`(findById), `getApfDtlCone()`(findById)의 **읽기 전용 경로만** view로 전환. `approve()`/`recall()`의 findById는 불변. ※ 현재 findAll/findById에 delYn 필터가 없는 그대로의 의미를 보존한다(쿼리에 임의 필터 추가 금지)
- Test: `ApplicationServiceTest` 해당 케이스 갱신, `ApplicationReadProjectionIt`에 신규 view 동등성 케이스 추가(기존 IT 파일 확장)

**Steps:** TDD → 커밋 `feat: 결재신청 읽기 경로 응답 전용 프로젝션 적용 (BE-03)`

### Task 3: 공통코드 REST 응답 경로 프로젝션

**Files:**
- Modify: `CodeRepository.java` — 명시 JPQL alias 프로젝션 3종: `List<CcodemResponseView> findResponseViewsByCIdWithValidDate(...)` 등 기존 QueryDSL 3메서드(findByCIdWithValidDate/findByCIdAndCdvaWithValidDate/findByCTpWithValidDate)와 **동일 조건·동일 정렬**(cSqn asc nulls last, cdva asc — JPQL에서 Oracle NULLS LAST 표현 확인, 불가 시 QueryDSL Impl에 view 메서드 추가로 대체). View getter 18개: cId, cdva, cdvaNm, sttDt, endDt, cNm, cdvaDes, cdvaDtl, cTp, cTpDes, hrkC, cSqn, cdvaDtlC, delYn, fstEnrDtm, fstEnrUsid, lstChgDtm, lstChgUsid
- Modify: `CodeDto.java` — `Response.fromView`
- Modify: `CodeService.java` — `getCcodemsByCId`/`getCcodem`/`getCcodemsByCTp`(REST 응답 경로)만 전환. `@Cacheable findCodeEntitiesByCId`·`findCodeEntitiesByCIdWithoutCache`·`getBudgetPeriod`와 모든 직접 엔티티 소비자(BudgetWorkService 등)는 불변
- Test: `CodeServiceTest` 갱신, 신규 `CodeResponseProjectionIt`(유효일 경계·정렬·null 동등성 — 이 경로는 기존 IT가 스모크뿐이므로 엔티티 조회 vs view 조회 비교를 반드시 포함)

**Steps:** TDD → 커밋 `feat: 공통코드 REST 응답 경로 프로젝션 적용 (BE-03)`

### Task 4: 게시판 메타·댓글 목록 프로젝션

**Files:**
- Modify: `BoardMetaRepositoryCustom/Impl` — `findAllActiveOrderedViews()` : QueryDSL `Projections.constructor`로 record `BoardMetaListRow(blbMngNo, blbNm, itPtlBlbTc, repUseYn, cmmtUseYn, flEsnYn, hedTagUseYn, sreSqnNo, useYn, rmk)` 반환, 동일 where/orderBy
- Modify: `BoardCommentRepositoryCustom/Impl` — `findCommentRowsByPost(String)` : record `BoardCommentListRow(cmmtMngNo, nacMngNo, cmmtCone, cmmtGrpNo, cmmtGrpSqn, cmmtGrpLev, hrkCmmtMngNo, delYn, fstEnrUsid, fstEnrDtm, lstChgDtm)`, 동일 정렬(cmmtGrpNo asc, cmmtGrpSqn asc)
- Modify: `BoardMetaDto`/`BoardCommentDto` — `Response.from(row)` 오버로드(삭제 댓글 마스킹 로직 포함 동일)
- Modify: `BoardMetaService.getAllActive()`, `BoardCommentService.getComments()`만 전환. 단건·쓰기 경로 불변
- Test: 두 서비스 단위 테스트 갱신, `BoardCommentRepositoryIt` 확장 + 신규 `BoardMetaListProjectionIt`(정렬·필터 동등성)

**Steps:** TDD → 커밋 `feat: 게시판 메타·댓글 목록 프로젝션 적용 (BE-03)`

### Task 5: 조직 목록 소비자별 프로젝션

**Files:**
- Modify: `OrganizationRepository.java` — `OrganizationListView`(getPrlmOgzCCone, getPrlmHrkOgzCCone, getBbrNm) + 대응 조회 메서드 ※ 기존 OrganizationService.findAll에 delYn 필터가 없었는지 실측 확인 — 없었다면 `findListViewsBy()` 전건 조회로 의미 보존; `OrganizationAdminView`(getPrlmOgzCCone, getBbrNm, getBbrWrenNm, getItmSqnSno, getPrlmHrkOgzCCone, getFstEnrDtm, getFstEnrUsid, getLstChgDtm, getLstChgUsid) + `findAdminViewsByDelYn("N")`(기존 인메모리 `"N".equals(delYn)` 필터와 동등)
- Modify: `OrganizationService.getOrganizations()`, `AdminService.getOrganizations()` 전환(각 DTO fromView). CRUD·findById·OrganizationNameView 경로 불변
- Test: `OrganizationServiceTest`/`AdminServiceTest` 갱신, `OrganizationNameProjectionIt` 확장 또는 신규 IT(동등성·delYn 계약)

**Steps:** TDD → 커밋 `feat: 조직 목록 소비자별 응답 전용 프로젝션 적용 (BE-03)`

### Task 6: 가이드 문서 목록 계약 분리 (백엔드 — 계약 커밋 선행)

**계약 변경(승인됨):** `GET /api/guide-documents` 목록 응답에서 `nacTxtInf` 제거. 단건 `GET /api/guide-documents/{id}`는 기존 전체 응답 유지.

**Files:**
- Modify: `GuideDocRepository.java` — `GuideDocListView`(getDocMngNo, getDocTtlCone, getDelYn, getFstEnrDtm, getFstEnrUsid, getLstChgDtm, getLstChgUsid — CLOB 본문 제외) + `List<GuideDocListView> findListViewsByDelYn(String)`
- Modify: `GuideDocDto.java` — 신규 `ListResponse` record(본문 없는 7필드) + Swagger `@Schema`
- Modify: `GuideDocService.getDocumentList()` → `List<ListResponse>`; `GuideDocController.getDocuments()` 반환 타입 변경. 단건·CRUD 불변
- Test: `GuideDocServiceTest`/`GuideDocControllerTest` 갱신, 신규 `GuideDocListProjectionIt`(CLOB 미로드 view와 entity 필드 동등성)

**Steps:** TDD → 커밋 `feat!: 가이드 문서 목록 응답에서 본문 제외 — 목록 계약 분리 (BE-03)` (계약 변경이므로 `!` 표기)

### Task 7: 가이드 프론트 전환 (it_frontend — 백엔드 계약 커밋 이후)

**Files:**
- Branch: `cd C:\it\it_frontend && git checkout -b feature/be03-guide-list-split`
- Modify: `app/composables/useGuideDocuments.ts` — 목록 타입 `GuideDocumentSummary`(nacTxtInf 없음) 분리, `fetchGuideDocuments`는 Summary[], 단건 `fetchGuideDocument`는 기존 `GuideDocument` 유지
- Modify: `app/pages/guide/index.vue` — `currentGuide`가 목록 항목 선택 시 **단건 조회로 본문 로드**하도록 전환(선택 문서의 nacTxtInf는 단건 응답에서). 편집 시작·비교 watch(78행), 초기 로드(130행), 렌더링(695행) 경로 모두 단건 데이터 기준으로 정합. 저장/삭제 후 refresh 흐름 유지. KeepAlive 재활성화(onActivated) 재조회 규칙 준수
- Test: `tests/unit/composables/useGuideDocuments.test.ts` 갱신. `npm run check` + `npm test` 통과
- 커밋: `feat!: 가이드 목록 경량 응답 전환 및 선택 시 단건 본문 조회 (BE-03)`

### Task 8: 전체 검증·문서 마감

- [ ] 백엔드 `./gradlew test` 전체 + (가능 시) `./gradlew integrationTest` 신규 IT
- [ ] 프론트 `npm run check` + `npm test`
- [ ] 전체 최종 코드 리뷰(백엔드 diff main..HEAD, 프론트 diff)
- [ ] `C:\it\TASK.md` BE-03 행 갱신: 1차 적용 완료 기록, 잔여 = 운영 관측 후 컬럼 조정 + Project/Cost·알림함 계약 분리 + BBUGTM·ProjectKeyView 프로젝션 재계획
- [ ] `versions.lock` 갱신 여부 확인(`scripts/update-versions-lock.ps1`) — 교차 저장소 계약 변경 포함이므로 실행
- [ ] 루트 커밋 `docs: BE-03 보수적 프로젝션 1차 적용 기록`

## 완료 기준

- 6개 묶음 모두 응답 전용 view 경로 적용(가이드는 목록 계약 분리), 기존 엔티티 메서드·쓰기 경로 불변
- 응답 JSON 불변(가이드 목록 제외), 신규 조회마다 Oracle IT 동등성 케이스 존재(로컬 Oracle 미가용 시 컴파일 확인 + Task 8에 실행 보류 명시)
- 백엔드·프론트 각 테스트 스위트 GREEN

## 명시적 비범위

- Project/Cost wide 검색·알림함 응답 계약 분리 (별도 결정 트랙)
- BBUGTM·`ProjectKeyView` 프로젝션 (BE-17 후속 — 별도 재계획)
- `@Cacheable` 코드 캐시 구조 변경, AdminService 코드 CRUD의 CacheEvict 공백(기존 리스크 — TASK.md 별도 등록 후보)
- `AdminService.getOrganizations`의 resolveUserName N+1 (별도 개선 후보)
