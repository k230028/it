# 📋 IT Portal 백로그

> 🗓️ **기준일:** 2026-06-24
> 🎯 **목적:** `REVIEW.md` 정비 과정에서 확인한 기술 부채, 미구현 항목, 후속 검증 과제를 추적합니다.

### 🔑 범례 (Legend)

| 상태 | 의미 | 우선순위 | 의미 |
| :--: | --- | :--: | --- |
| ✅ Done | 완료 | 🔴 Critical | 즉시 조치 (보안/데이터 손실) |
| ⬜ Open | 미착수 | 🟠 High | 가급적 조속 조치 |
| ✔️ Resolved | 해소(거짓양성 등) | 🟡 Medium | 유지보수 개선 |
| ☑️ Accepted | 감내(업스트림 미해결) | 🟢 Low | 선택 개선 |

> 📦 **완료/종료 항목**은 [`TASK_DONE.md`](TASK_DONE.md)에 보관합니다.

---

## 🚧 진행 중

> 🕒 최종 업데이트: 2026-06-24

### 🔒 보안

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | `Authorization: Bearer` 헤더 폴백 운영 활성화 여부 결정 후 `it_backend/CLAUDE.md`에 명시                                                                       | 현재 운영에서도 동작 — XSS 탈취 토큰 헤더 전송 경로 오픈                                                   |
| ⬜ Open | 🟡 Medium | `$apiFetch` 401 갱신 후 원요청 재시도 결과가 호출자에게 반환되는지 E2E로 검증                                                                                          | `plugins/auth.ts` refresh 재시도 흐름 브라우저 회귀 필요                                           |
| ⬜ Open | 🟡 Medium | `it-portal-user` 쿠키 변조 시 프론트 관리자 가드가 일시적으로 관리자 화면을 노출하지 않는지 E2E 검증                                                                            | 프론트 쿠키는 UX 상태이며 최종 권한은 백엔드가 판단해야 함                                                    |
| ⬜ Open | 🟡 Medium | SSO 운영 설정 검증 강화 — `app.sso.allow-direct-eno=false`, `app.frontend-url` 실제 값, 프록시 헤더 덮어쓰기 점검                                                   | `SsoController`, `AuthController.getClientIp()` 운영 안전장치                               |
| ⬜ Open | 🟡 Medium | Access Token Blocklist 도입 검토 — 로그아웃 시 잔존 토큰(최대 15분) 무효화 필요 여부 결정                                                                              | `AuthService.logout()` Stateless 한계, 고보안 시나리오용                                        |
| ⬜ Open | 🟠 High | 게시판 멘션·결재 알림 진단 로그 운영 노출 정리 — 사번 목록, 작성자, 본문 snippet이 INFO 로그에 남지 않도록 삭제 또는 DEBUG 강등 | `BoardPostService.java:254`, `ApplicationService.java:201`, 탐지: 2026-06-24 |
| ⬜ Open | 🟡 Medium | [후속/T10] Refresh Token 재사용 탐지(토큰 패밀리/세대 카운터) 도입 — Phase 3에서 회전(rotation)만 구현되어 탈취된 구 토큰의 재사용 탐지가 없음. 회전 시 무효화된 토큰이 다시 제출되면 패밀리 전체 폐기하는 메커니즘 필요 | `AuthService`(rotation 구현부), 스파이크: `docs/superpowers/plans/2026-06-22-phase3-security-hardening-spike-blocklist.md`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | Tiptap 변수 metadata 프로젝트 카탈로그 권한 필터링 — 현재 인증 사용자 공통 프로젝트 목록을 반환하므로 사용자 권한/부서 기준 목록 제한 필요 | `TiptapVariableController.java`, `TiptapVariableService.java:51`, 탐지: 2026-06-24 |
| ⬜ Open | 🟠 High | `ContractRepositoryImpl`·`DeliberationRepositoryImpl`·`PaymentRepositoryImpl` — `bbrC` 부서 필터 MVP 미적용(쿼리 조건 없음). 서비스가 bbrC를 전달해도 Repository가 무시 → 일반 사용자가 타부서 계약·심의·지급 목록 전체 열람 가능. `EstimateRepositoryImpl`(적용됨)과 불일치. Bcontm/Bdelim/Bpaymm에 주관부서코드 컬럼 추가 또는 대상 테이블 JOIN 필요 | `ContractRepositoryImpl.java:47`, `DeliberationRepositoryImpl.java:47`, `PaymentRepositoryImpl.java:43`, 발견일: 2026-06-09 (line 309 과업심의 bbrC 항목 통합·확장) |
| ⬜ Open | 🟡 Medium | 사업집행 4단계 `changeStatus` — 단방향 상태전이(인접만)는 검증하나 역할(ADMIN/작업자/신청자)별 전이 권한 분기 없음. 업무 요건(제출=본인/관리자, 완료=관리자/작업자 등) 확정 후 서비스 계층 role 분기 추가 | `EstimateService.java:115`, `DeliberationService/ContractService/PaymentService` 동일, 발견일: 2026-06-09 |

### 📦 의존성 취약점 (Snyk, 업스트림 미해결)

> ✅ 활성 항목 없음 — 종료 내역은 [`TASK_DONE.md`](TASK_DONE.md) 참조

### 🤝 사전협의

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | 사전협의 세션/코멘트 상태를 서버 영속화로 전환 | `stores/review.ts`가 세션 상태를 메모리 전용으로 보관 |
| ⬜ Open | 🟡 Medium | 검토의견 응답에 작성자 팀명(`authorTeam`) 필드 추가 | `ReviewCommentDto.Response`와 `useReviewCommentApi.ts` 임시값 사용 |
| ⬜ Open | 🟡 Medium | 검토의견 첨부파일 응답 매핑 추가 | `useReviewCommentApi.ts`가 `attachments`를 빈 배열로 고정 |

### ⚠️ 에러 처리 (주석 FIXME 등록 완료 — 코드 수정 후속)

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 프론트 toast 누락 다발 — 구체 사이트(`useCostListPage` 코드로드/검색, `projects/form.vue`, `terminal/[id].vue`, `ResourceTableSection` 등) 개별 항목으로 분해·조치 완료. 잔여 silent 경로는 아래 개별 행 참조 | 본 섹션 개별 행으로 분해, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] 사전협의 자동 저장 실패 사용자 알림 및 재시도 정책 보강 — `console.warn`과 경고 toast 적용 확인                                                                                                      | `pages/info/documents/[id]/review.vue:180`, 조치일: 2026-06-24                       |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] 사전협의 버전/코멘트/검토자 — `stores/review.ts`가 실패 시 `loadWarnings` 리스트로 호출자에 전달(toast 표시)하도록 기조치 확인 | `stores/review.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 전산업무비 일괄 업로드 실패 행/원인 상세화 — 행별 catch가 `err.data?.message` 추출해 `failedReasons` 수집, 집계 toast detail에 실패 사유 요약(최대 5건 + 외 N건) 노출 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX 내보내기 이미지 fetch 실패 시 `src` 포함 `console.warn` 진단 로그 추가(외부 export catch는 toast 유지) | `useHwpxExport.ts`, 조치일: 2026-06-24 |
| ⬜ Open | 🟡 Medium | Java 파일 헤더 주석 전수 보강                                                                                                                                                                                 | 다수 Java 파일이 `package`로 바로 시작하며 파일 역할/흐름/연동 테이블 헤더가 없음                            |
| ⬜ Open | 🟡 Medium | `AdminDto` 잔여 DTO JavaDoc 보강                                                                                                                                                                        | 자격등급/사용자/조직/역할/로그인 이력/토큰/첨부파일/통계 DTO는 기본 설명만 존재                                  |
| ⬜ Open | 🟡 Medium | `LoginAttemptService` 조회 전용 트랜잭션 경계 명시 — 클래스 레벨 `@Transactional(readOnly=true)` 적용 검토 | `LoginAttemptService.java`, 발견일: 2026-06-01 |
| ⬜ Open | 🟡 Medium | `PlanService` 클래스 레벨 `@Transactional(readOnly=true)` 적용 — 조회 위주 서비스에서 메서드별 트랜잭션 누락 방지, 쓰기 메서드는 `@Transactional` 오버라이드 | `PlanService.java:43`, 탐지: 2026-06-24 |
| ⬜ Open | 🟡 Medium | mutating 컨트롤러 요청 본문 `@Valid` 누락 점검 및 보강 — 협의회/게시판 POST·PUT 요청 DTO 검증 일관성 회복 | `CouncilController.java`, `BoardPostController.java`, 탐지: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useTiptapImageInsertion.ts` blob URL 해제 — 성공/실패 경로 모두 `URL.revokeObjectURL()` 보장 확인(기조치) | `useTiptapImageInsertion.ts` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟡 Medium | [확인 2026-06-24] `usePdfReport.ts` 한글 폰트 로드 실패 시 `console.error` + 경고 toast('일부 글자가 깨질 수 있습니다') 후 Roboto 폴백 기조치 확인 | `usePdfReport.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] HWPX/Tiptap 실패 경로 보강 — `ExcalidrawNodeView` SVG 재생성 실패 `loadError` 표시, `useTiptapTableTools.syncColumnWidths`·`useHwpxExport` warn 로그. `hwpx-images.ts`는 선택적 null 처리로 기조치 확인 | `ExcalidrawNodeView.vue`, `useHwpxExport.ts`, `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useTiptapTableTools.syncColumnWidths` 빈 catch → `catch (e)` + `console.warn` 추가 | `useTiptapTableTools.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] 손상된 `it-portal-user` 쿠키/구버전 `localStorage.user` 파싱 실패 시 `console.warn` + 손상 데이터 정리(쿠키 만료, `user.value=null`) | `stores/auth.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `info/projects/form.vue` 편집 모드 데이터 로드 실패 시 toast 후 목록 리다이렉트 적용 확인 | `pages/info/projects/form.vue:712`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `approval/[apfMngNo].vue` 결재 상세 로드 실패 — `toast.error` + `/approval/list` 리다이렉트 적용 확인(기조치) | `pages/approval/[apfMngNo].vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `board/[blbMngNo]/[nacMngNo]/index.vue` 삭제 실패 — `console.error` + `toast.error` 적용 확인(기조치) | `pages/board/[blbMngNo]/[nacMngNo]/index.vue` 현행 코드 확인, 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `EmployeeSearchDialog.vue` 조직도·부서원 목록 로드 실패 — 양쪽 경로 `toast.error` 적용 확인(기조치) | `components/common/EmployeeSearchDialog.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ExcalidrawWrapper.vue` 내보내기·초기화·장면 복원 실패 toast 적용 확인 | `components/ExcalidrawWrapper.vue:92`, `components/ExcalidrawWrapper.vue:160`, `components/ExcalidrawWrapper.vue:201`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useEmployeeSearch.ts` 직원 검색 실패 — warn toast + 빈 목록 처리 적용 확인(기조치) | `composables/useEmployeeSearch.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟠 High | [완료 2026-06-24] `useGlobalSearch` 실패를 빈 결과와 구분 — `console.warn` + `searchError` ref 인라인 오류 상태, `GlobalSearchBar`가 "검색 중 오류" 표시(타입어헤드 노이즈 방지로 toast 미사용). 단위 테스트 추가 | `composables/useGlobalSearch.ts`, `components/GlobalSearchBar.vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `useCostListPage.ts` 공통코드 로드 실패 — `toast.error` 적용 확인(기조치) | `composables/useCostListPage.ts` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `useCostListPage` 전년도 상세 조회 폴백 실패 `console.warn` 추가(요약 데이터 폴백 추적). 자동완성 빈 결과 폴백은 정상 UX로 유지 | `useCostListPage.ts`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `ResourceTableSection.vue` 소요자원 코드 로드 실패 시 `useToast` 추가 + `toast.error` 알림 | `components/projects/ResourceTableSection.vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `terminal/[id].vue` 삭제 실패 시 `useToast` import + `toast.error`(백엔드 메시지 추출) 추가 | `pages/info/cost/terminal/[id].vue`, 조치일: 2026-06-24 |
| ✔️ Resolved | 🟠 High | [확인 2026-06-24] `info/cost/form.vue` 초기 데이터 로드 실패 — `toast.error` 적용 확인(기조치) | `pages/info/cost/form.vue` 현행 코드 확인, 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `ResultReviewProgress.vue` 상태 전이 실패 `console.warn` 기록 추가 확인 (toast 억제 유지) | `components/council/result/ResultReviewProgress.vue:60`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `saveTemp`/`saveComplete`/`submitApproval` 3개 catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟡 Medium | [완료 2026-06-24] `council-request/[id].vue` `councilStatus` `?? '01'`→`?? null`(fail-closed). `readonly = councilStatus !== '01'`로 로드 실패(null) 시 화면 잠금, 정상 DRAFT 편집 불변 | `pages/info/council-request/[id].vue`, 조치일: 2026-06-24 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `CommitteeSelector.vue`(위원 저장·기본위원)·`ScheduleStatus.vue`(일정 확정) catch를 `catch (e: unknown)` + `err.data?.message` 추출로 통일 | `CommitteeSelector.vue`, `ScheduleStatus.vue`, 조치일: 2026-06-24 |
| ⬜ Open | 🟢 Low | `council-request/result/[id].vue` — `handleNotify`(통보 성공이나 수신자 null 시 무피드백)·`handleRequestApproval`·`handleStartResultWriting` catch 바인딩 없음. 백엔드 오류 메시지(`e.data?.message`) 미전달. `prepare/[id].vue`의 `catch (e: unknown)` 패턴으로 통일 | `pages/info/council-request/result/[id].vue:273,299,314`, 탐지: 2026-06-14 |

### 🗄️ DB / JPA 최적화

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟠 High | `BudgetWorkService.applyRates()` — 원본 레코드별 개별 Upsert SELECT → 벌크 처리 또는 Oracle MERGE INTO 전환 | `BudgetWorkService.java L150-213` |
| ⬜ Open | 🟠 High | `CostService.enrichCostListBatch()` 단말기 첨부 N+1 제거 — 단말기 행별 `attachTerminals()` 개별 조회를 일괄 조회로 전환 | `CostService.java L508, L531, L598` |
| ⬜ Open | 🟡 Medium | `BudgetWorkService.applyItemRates()` 전체 연도 BBUGTM 메모리 로드 + 루프 Soft Delete → `@Modifying` 벌크 UPDATE | `BudgetWorkService.java L243-244` |
| ⬜ Open | 🟡 Medium | `ProjectRepositoryImpl`/`CostRepositoryImpl` `selectFrom` 전체 컬럼 → 목록 API용 DTO 프로젝션 (1000자 텍스트 컬럼 제외) | `ProjectRepositoryImpl.java L140`, `CostRepositoryImpl.java L163` |
| ⬜ Open | 🟡 Medium | Native Query `Object[]` 반환 → DTO 프로젝션 또는 `@SqlResultSetMapping` 적용 | `CouncilRepository`, `ApplicationRepository`, `ServiceRequestDocRepository`, `LoginHistoryRepository`, `EvaluationRepository` |
| ⬜ Open | 🟡 Medium | `ProjectService.enrichProjectListBatch()` 사업별 비목 요약 N+1 제거 — BITEMM을 사업 키 묶음으로 일괄 조회 | `ProjectService.java L662, L684, L783` |
| ⬜ Open | 🟡 Medium | `FeasibilityService.replacePerformances()` JPQL DELETE 후 flush 없이 persist → `flush()` 명시 또는 Spring Data `deleteAll` 통일 | `FeasibilityService.java L225` |
| ⬜ Open | 🟡 Medium | 협의회 일정/평가 사용자명 조회 N+1 제거 | `ScheduleService`, `EvaluationService`에서 사번별 `findByEno()` 반복 |
| ⬜ Open | 🟡 Medium | 협의회 위원/상태 조회 배치화 검토 | `CommitteeService`, `CouncilService` 반복 조회 후보 |
| ⬜ Open | 🟠 High | 결재 대기/대시보드 쿼리 인덱스 보강 검토 | `ApplicationRepository`가 `CDECIM.DCD_ENO`, `DCD_DT`, `CAPPLM.APF_STS`, `RQS_DT` 기준 조회. 후보: `CDECIM(DCD_ENO, DCD_DT, DCD_MNG_NO)`, `CAPPLM(APF_STS, RQS_DT DESC)` |
| ⬜ Open | 🟠 High | 요구사항 정의서 대시보드 `BRDOCM`/`BRIVGM` 보조 인덱스 검토 | `ServiceRequestDocRepository`가 `FST_ENR_USID`, `DEL_YN`, `FST_ENR_DTM`, `DOC_MNG_NO`, `FSG_YN` 조건 반복 사용 |
| ⬜ Open | 🟡 Medium | 협의회 목록 `BASCTM`/`BCMMTM` 역방향 조회 인덱스 검토 | 후보: `BASCTM(PRJ_MNG_NO, PRJ_SNO, DEL_YN)`, `BCMMTM(ENO, DEL_YN, ASCT_ID)` |
| ⬜ Open | 🟡 Medium | `ScheduleService` 위원 사용자명 조회 N+1 제거 — 위원별 `userRepository.findByEno` 반복을 `findByEnoIn` 일괄 조회로 전환 | `ScheduleService.java:311`, 탐지: 2026-06-05 |
| ⬜ Open | 🟠 High | 전산업무비 삭제 시 단말기 조회 N+1 제거 | `CostService`가 비용별 `btermmRepository.findByItMngcNoAndItMngcSno()` 반복 호출. `IT_MNGC_NO` 기준 단말기 일괄 조회 후 그룹핑 |
| ⬜ Open | 🟡 Medium | `BRDOCM` 최신버전 목록 조회 실행계획 검증 및 복합 인덱스 검토 | `findLatestVersionsAll()`의 `DEL_YN='N'` + 상관 서브쿼리 `MAX(DOC_VRS)` + `FST_ENR_DTM DESC` 정렬. 후보: `(DEL_YN, DOC_MNG_NO, DOC_VRS, FST_ENR_DTM)` |
| ⬜ Open | 🟡 Medium | `BRIVGM` 검토의견 목록 조회 인덱스 추가 검토 | 댓글 목록이 `(DOC_MNG_NO, DOC_VRS, DEL_YN)` 필터와 `FST_ENR_DTM ASC` 정렬을 사용. 후보: `(DOC_MNG_NO, DOC_VRS, DEL_YN, FST_ENR_DTM)` |
| ⬜ Open | 🟡 Medium | `CouncilRepository.findWithDetails()` Native Query `Object[]` 전용 DTO/projection 전환 우선 처리 | 16개 컬럼 순서와 서비스 캐스팅이 강하게 결합되어 오매핑 위험 |
| ⬜ Open | 🟡 Medium | `CinfmmRepositoryImpl.markAllReadByRcvUsid()` QueryDSL 벌크 UPDATE 후 `LST_CHG_DTM`/`LST_CHG_USID` 미갱신 — JPA Auditing 우회, 1차 캐시 stale 발생. `clearAutomatically` 또는 감사 컬럼 명시 SET 추가 | `CinfmmRepositoryImpl.java:67-78` (→ `CouncilRepository.java:67` 동일 패턴 참조) |
| ⬜ Open | 🟡 Medium | 실시간 로그 피드 커서 폴링 인덱스/실행계획 검증 — `CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC`, `LOG_KEY`, `CHG_DTT_YN` 필터와 5/30분 집계가 View 기반으로 충분히 지원되는지 확인 | `RealtimeLogRepository.java`, `V_ITPAPP_LOG_FEED`, 탐지: 2026-06-05 |
| ⬜ Open | 🟡 Medium | `Deliberation/Contract/PaymentService.get()` 상세 조회 대상명 별도 SELECT 제거 — `loadCurrent()` + `resolveTargetName()` 2쿼리를 `EstimateRepositoryImpl`처럼 BPROJM/BCOSTM LEFT JOIN 프로젝션 단일 쿼리로 통일. 목록→상세 순차 로드 시 누적 N+1 | `DeliberationService.java:148`, `ContractService.java:146`, `PaymentService.java:176`, 탐지: 2026-06-09 |
| ⬜ Open | 🟢 Low | `applyAthIds()` 적용 대상 최소화 — prune 이후 잔존 노드의 mnuId 집합 기준으로 권한 Map 구성 검토. 메뉴 권한 캐시 도입(2026-06-22 `MenuAuthMapProvider`) 완료됨 → 실익 재평가 | `MenuQueryService.java:62`, 탐지: 2026-06-12 |
| ⬜ Open | 🟡 Medium | [후속/T13] 캐시 TTL 미적용 보완 — 현재 `ConcurrentMapCacheManager`는 TTL 미지원. `tiptapMetadata`는 프로젝트 쓰기 시 stale 가능(`ProjectService` 쓰기경로에 `@CacheEvict` 추가 또는 Caffeine 도입 필요); `NotificationService` unread-count는 60s TTL 미적용(evict-on-write로 대체됨). Caffeine 전환 또는 쓰기경로 evict 보강 결정 필요 | `ProjectService`, `TiptapVariableService`(metadata), `NotificationService`, 탐지: 2026-06-22 |
| ✅ Done | 🟢 Low | [완료 2026-06-24] `AdminMenuService.create()`/`delete()` 트랜잭션 경계 재검증 — 클래스 레벨 `@Transactional` 적용 확인 | `AdminMenuService.java:24`, 탐지: 2026-06-22, 조치일: 2026-06-24 |
| ⬜ Open | 🟢 Low | [후속] `BtermmL.IND_RSN` `@Column(length=600)` — `TPRMPP_BTERML` DDL 대조해 `BcostmL`과 동일한 `@Column(length)` 드리프트 여부 확인 (BcostmL은 2026-06-22 정정 완료) | `BtermmL.java`, `TPRMPP_BTERML`, 탐지: 2026-06-22 |

### 🎨 프론트엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | `RichEditor.client.vue` → `TiptapEditor`/`TiptapToolbar` 마이그레이션 검토 (HTML 구조 차이·HtmlSanitizer 영향 선행 검토 필요)               | PrimeVue Quill 기반 구버전 에디터               |
| ⬜ Open | 🟡 Medium | `useProjectOptions.ts` 인라인 전환 검토 — `yearOptions` 배열만 반환하는 단순 composable                                                 | `pages/info/projects/form.vue` 1곳에서만 사용 |
| ⬜ Open | 🟢 Low | `ReviewVersionHistory.vue` 로컬 `formatDateTime()` 유지 여부 검토 — 축약 표시가 의도라면 함수명을 도메인 전용으로 변경 | `components/review/ReviewVersionHistory.vue` |
| ⬜ Open | 🟡 Medium | `info/index.vue` 정적 KPI/공지/일정 데이터를 실제 API 또는 운영 데이터 소스로 전환 | 파일 헤더가 정적 데이터/향후 API 연결 예정임을 명시 |
| ⬜ Open | 🟠 High | 프론트 ESLint 오류 정리 — dead import, 미사용 변수, type-only import, 템플릿 파싱 오류 우선 처리 | 2026-05-14 `npm run lint` 기준 62 errors / 137 warnings. `EvalSummaryPanel.vue`, `result/[id].vue`, cost 컴포넌트 등 |
| ⬜ Open | 🟠 High | 전산업무비 컴포넌트 지급주기 prop 이름 정합화 — `dfrCleCOptions`와 호출부 `dfr-cle-options` 불일치 해소 | 2026-05-19 `npm run typecheck` 실패. `TerminalTableSection.vue`, `CostFormTableSection.vue`, `TerminalFormDialog.vue`, `pages/info/cost/form.vue` |
| ⬜ Open | 🟠 High | 협의회 결과 페이지 단일 template root 복구 | `pages/info/council-request/result/[id].vue`의 `EmployeeSearchDialog`가 루트 밖에 남아 `vue/no-multiple-template-root` 발생 |
| ⬜ Open | 🟡 Medium | `budget/list.vue` 탭 제거 후 잔여 dead code 정리 | 미사용 import/filter/pageSize/download 함수 다수 |
| ⬜ Open | 🟡 Medium | cost 컴포넌트 type-only import 및 미사용 환율 함수 정리 | `TerminalFormDialog.vue`, `CostFormTableSection.vue`, `TerminalTableSection.vue` lint 유형 |
| ⬜ Open | 🟢 Low | `ResultForm.vue` emit/type 선언 단순화 | `ResultData` 미사용, `'saved' | 'confirmed'` 단일 시그니처로 축약 가능 |
| ⬜ Open | 🟢 Low | `useTableColumnResize.ts` 숫자 파싱/배열 초기화 스타일 정리 | `Number.parseInt/parseFloat`, `Array.from` 등 일관 스타일 후보 |
| ⬜ Open | 🟡 Medium | 공통 `useDeptFilter` composable 구현 또는 규칙 폐기 결정 | 기존 CLAUDE 규칙과 달리 `app/composables/useDeptFilter.ts`가 없음 |
| ⬜ Open | 🟡 Medium | Tiptap 표 도구 계약 문서화 및 주석 보강 | `useTiptapTableTools.ts`, `TiptapTableFloatingToolbar.vue`가 복잡도 대비 계약 설명 부족 |
| ⬜ Open | 🟠 High | `pages/info/plan/[id].vue` 타입체크 실패 수정 — ExcelJS 컬럼 타입과 TiptapEditor `model-value` string 폴백 정리 | `npm run typecheck` 실패: `ws.columns`, `planData.*Cone` `string \| undefined` |
| ⬜ Open | 🟠 High | 프론트 typecheck 실패 현행화 — Nitro SSO 미들웨어 event 타입, color-scheme 플러그인 cookie decode 타입, vue-router/volar `sfc-route-blocks` export 호환성 확인 | 2026-06-01 `npm run typecheck` 실패: `server/middleware/sso-auth-redirect.ts`, `server/plugins/color-scheme.ts`, `vue-router/volar/sfc-route-blocks` |
| ⬜ Open | 🟠 High | 프론트 ESLint 오류 현행화 — 운영 코드 `any`, `ResultForm` emit overload, `useTableColumnResize` 배열 초기화, `result/[id].vue` 단일 template root, 테스트 mock 타입 정리 | 2026-06-01 `npm run lint -- --quiet` 기준 73 errors |
| ⬜ Open | 🟡 Medium | 정보기술부문 예산 조회/비교 화면 목업 데이터 API 연동 | `pages/budget/summary.vue`, `pages/budget/comparison.vue`의 `MOCK_ROWS`/`MOCK_FSS_ROWS`/`MOCK_YOY_ROWS` TODO |
| ⬜ Open | 🟡 Medium | 관리자 화면 `사용여부` 옵션/태그 로직 중복 제거 | `pages/admin/auth-grades.vue`, `pages/admin/roles.vue`가 동일한 `useYnOptions`와 표시 로직을 각각 보유 |
| ⬜ Open | 🟡 Medium | `/admin/boards` 관리자 레이아웃 적용 여부 결정 | 페이지는 `middleware: 'admin'`만 선언하며, 다른 `/admin/**` 페이지와 달리 `layout: 'admin'`이 없음 |
| ⬜ Open | 🟡 Medium | `useNotifications` 모듈 스코프 싱글턴 상태(`unreadCount`, `items`, `loading`, `pollHandle`) — 테스트 간 누출·SSR 전역 공유 위험. Pinia 스토어(`stores/notification.ts`) 전환 또는 `useState()` 기반 SSR-safe ref 검토 | `composables/useNotifications.ts:17-21` |
| ⬜ Open | 🟢 Low | `useNotifications.refresh()` 명시적 호출 경로(드롭다운 열기 등)에 호출자 catch+toast 보장 여부 확인 — composable 계약상 에러 전파이나 AppHeader 등 실제 호출부에 toast 핸들링이 없을 수 있음 | `composables/useNotifications.ts` |
| ⬜ Open | 🟢 Low | 사업집행 3개 목록 페이지 대상구분 선택 Dialog 로직 공통화 — `deliberation/contract/payment/index.vue`가 `selectedTgt`/`selectedProject`/`selectedCost`/`hasTarget`/`selectedCncdRfrNo`/`resetSelection` 패턴을 중복 보유. `useProjectCostSelector()` composable 추출 | `pages/project/{deliberation,contract,payment}/index.vue:56~`, 탐지: 2026-06-09 |
| ⬜ Open | 🟢 Low | 사업집행 4개 composable `changeStatus(docNo, stsTc)` 중복 — URL만 다르고 구현 동일. 중장기 `useDocumentApi(baseUrl)` 팩토리 도입 시 일괄 처리 후보 | `useEstimates.ts:115`, `useDeliberations.ts:115`, `useContracts.ts:115`, `usePayments.ts:117`, 탐지: 2026-06-09 |
| ⬜ Open | 🟢 Low | `contract/index.vue` 빈 `/* ── 상태 표시 ── */` 주석 잔재 제거 — `estimate/index.vue`의 statusLabel 헬퍼 자리이나 contract에서는 함수 없이 주석만 남음 | `pages/project/contract/index.vue:57`, 탐지: 2026-06-09 |
| ⬜ Open | 🟠 High | `result/[id].vue` `reviewProgressEnabled`의 `s >= '05'` 문자열 사전순 비교 — `'SKIPPED' >= '05'`도 true라 생략된 협의회에서 위원 검토 패널이 노출될 수 있음. 허용 상태 집합(`Set.has`) 판정으로 교체 (FIXME 주석 등록 완료) | `pages/info/council-request/result/[id].vue:147`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | `AppSidebar.vue` 미사용 함수 `_isGroupExpanded` 제거 — 호출 0건, eslint-disable 지시어로 가려져 있음 | `AppSidebar.vue:176`, 탐지: 2026-06-12 |
| ⬜ Open | 🟢 Low | 위원유형 라벨 로직 중복 정리 — `ScheduleStatus.vue` 로컬 맵(`{'01':'당연',...}`)을 `useCouncilCodes().getMemberTypeLabel`로 통일하고, `CommitteeList.vue`/`CommitteeSelector.vue`의 1줄 `typeLabel` 래퍼 제거 | `ScheduleStatus.vue:167-169`, `CommitteeList.vue:34`, `CommitteeSelector.vue:310`, 탐지: 2026-06-12 |

### ⚙️ 백엔드 리팩토링

| 상태 | 우선순위 | 과제 | 근거 |
| :--: | :--: | --- | --- |
| ⬜ Open | 🟡 Medium | 문서/내보내기 회귀 테스트 범위 확대 (HWPX/PDF/Excel) | `utils/hwpx.ts` HTML 파싱·이미지 패키징·XML 생성 통합 담당 |
| ⬜ Open | 🟡 Medium | `domain/log` 감사로그 리스너 통합 테스트 보강 | JaCoCo 제외 대상이나 업무 감사 추적에 중요 |
| ⬜ Open | 🟡 Medium | 소요예산 산정 `EstimateRepositoryImpl.search()` QueryDSL에 대한 통합 테스트 부재 (프로젝트에 `@DataJpaTest` 인프라 없음, 현재 Mockito 단위테스트만). 단계별 화면 안정화 후 통합 테스트 보강 | `it_backend/src/test/.../estimate/repository/EstimateRepositoryTest.java`, 탐지: 2026-06-07 |
| ⬜ Open | 🟢 Low | `ApplicationContextHolder.publishEvent()` 잔여 이벤트 기반 감사로그 주석 정리 — `AuditLogEvent`는 2026-06-22 삭제됨, `ApplicationContextHolder` 측 잔여 참조/주석만 점검 | 현재 감사로그는 `ChangeLogEntityListener`가 `AuditLogPersister.persist()` 직접 호출 |
| ⬜ Open | 🟠 High | [후속] 테스트 스텁 정합 — `CostServiceTest`에 `@Mock CodeNameMapBuilder` 주입 추가(Phase 5 `CodeNameMapBuilder` 필드 도입으로 NPE 4건); `BudgetWorkServiceTest`의 단일키 finder 스텁(`findByGclMngNoAndDelYn`/`findByAbusMngNoAndDelYn`/`findByCostBgNoAndDelYn`)을 신규 배치 메서드(`findBy...InAndDelYn`) 스텁으로 갱신(Phase 4 N+1 배치화로 호출경로 변경). 두 파일은 미커밋 작업과 겹쳐 이번 작업에서 미수정. 전체 1422 tests 중 실패 6건이 이 스텁 불일치 | `CostServiceTest`, `BudgetWorkServiceTest`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | [후속/T18] 통합테스트 인프라 부재로 Task13-15(감사로그 리스너 통합테스트, `EstimateRepository` 통합테스트, `CinfmmRepositoryImplTest`) 미착수 — H2(strategy A) 또는 Oracle(strategy B) DB-backed 테스트 전략 결정 필요. 현재 `application-test.properties`는 DataSource/JPA 제외, H2/Testcontainers 의존성 없음. (참고: 기존 `NoClassDefFoundError` 대량실패는 재현 안 됨 — byte-buddy 1.18.10/mockito 5.23.0 Java25 정상) | `application-test.properties`, 탐지: 2026-06-22 (기존 NoClassDefFoundError 분석 항목 대체) |
| ⬜ Open | 🟡 Medium | [후속/T16] 목록 프로젝션 DTO 작업(`ProjectRepositoryImpl`/`CostRepositoryImpl` DTO, `@SqlResultSetMapping`, `CouncilRepository.findWithDetails`, 4단계 상세 JOIN) 별도 계획으로 분리됨 — 미착수 | `ProjectRepositoryImpl`, `CostRepositoryImpl`, `CouncilRepository`, 탐지: 2026-06-22 |
| ⬜ Open | 🟢 Low | [후속/minor] `CodeNameMapBuilder` 위치(`domain/budget/cost/util`)가 `ProjectService`와 공유되므로 `common` 패키지로 이동 검토 | `CodeNameMapBuilder`, 탐지: 2026-06-22 |
| ⬜ Open | 🟡 Medium | [기술부채] 품목 금액 환율 환산 규칙 통일 — `ProjectBudgetSummaryService`(amt × xcr)와 과거 `recalcCurrentYearBudget`(× 미적용)의 비대칭. MPL_AMT는 현재 AMT 규칙을 지점별로 미러링 중. 단일 규칙으로 정리 | 2026-06-22 품목 예정금액(MPL_AMT) 전환에서 분리 |
| ⬜ Open | 🟢 Low | [후속/perf] `CouncilService.deriveCurrentYearBudget` 협의회 목록 N+1 — 행마다 `findByAbusMngNoAndDelYn` 호출. 협의회 목록 규모 증가 시 배치 prefetch로 전환 | `CouncilService`, 탐지: 2026-06-22 (품목 MPL_AMT 전환) |
| ⬜ Open | 🟡 Medium | EAI HostAddressProvider 로컬 IP/MAC 조회 실패 진단 보강 — 원인 예외 없이 info만 남아 전문 공통부 공백 원인 추적 곤란 | `HostAddressProvider.java:34`, `HostAddressProvider.java:57`, 탐지: 2026-06-24 |

## 📝 PRD_20260517 Tiptap 변수 입력 후속 과제

- [ ] PRD_20260517 follow-up: 다음 페이지에 Tiptap 변수 prop 적용
      - app/pages/info/documents/[id]/index.vue
      - app/pages/info/plan/form.vue
      - app/pages/info/documents/form.vue
      - app/pages/board/** 상세
      - app/pages/guide/** 상세
- [ ] PRD_20260517 follow-up: E2E 시나리오 2/3/5 자동화 (사업별 / 실DB 갱신 / HWPX 내보내기)
- [ ] PRD_20260517 follow-up: Tiptap 변수 카테고리 매핑 (IT_BUDGET 일반관리비 포함 여부) 운영 데이터 검증
- [ ] PRD_20260517 follow-up: VariableNodeView 스크립트 - 작성 직후 resolveTokens 호출 (현재 LOADING 상태 표시)

### 🧪 수동 검증 체크리스트 (병합 후 확인)

- [ ] info/plan에서 변수 칩 정상 표시
- [ ] 다크모드 색상 대비 충분
- [ ] 키보드만으로 변수 삽입 가능
- [ ] NodeView aria-label 부여 확인 (DevTools)
- [ ] 모바일 뷰포트(768px 이하) 팝업 위치 정상

## 📡 실시간 로그 모니터링

- [ ] `/api/admin/realtime-logs` 통합/E2E 검증 — Flyway `V20260531_001` 적용 DB에서 관리자/일반사용자/미인증 접근과 since 커서 증분 조회 확인
- [ ] 라이브 피드 행 클릭 → 변경 본문(BEFORE/AFTER) 인라인 드릴다운 (`/admin/logs/[logKey]` 데이터 재사용)
- [ ] SSE 또는 WebSocket push 전환 (관리자 수·트래픽 증가 시)
- [ ] 로그 데이터 보존 정책 / 아카이브 분리 View
- [ ] 사용자별 즐겨찾기 테이블 필터 저장 (localStorage)
- [ ] `V_ITPAPP_LOG_FEED` 실행계획 `EXPLAIN PLAN` 검증 결과 기록 및 필요 시 복합 인덱스 도입
- [ ] Spring Boot bootRun 환경 셋업 후 V20260531_001 마이그레이션 적용 검증
- [ ] Playwright E2E (`tests/e2e/admin/realtime-logs.spec.ts`) 백엔드+프론트 dev 모드 기동 후 실제 실행

## 📬 공통 게시판 후속 과제

- [ ] `Bgdocm.docCone` BLOB → CLOB 마이그레이션 (게시판 도입 후 일관성 회복)
- [ ] 본문 검색 Oracle Text 인덱스 도입 (게시판당 1만 건/검색 1초 초과 시)
- [ ] 조회수 카운터 Redis 전환 (다중 인스턴스 운영 시)
- [ ] 알림(메일/슬랙) 연동 — 공지·중요 게시물 등록, 본인 게시물 댓글 알림
- [ ] 첨부파일 다운로드 카운트 컬럼 (`FL_DWN_NBR`) — 자료실 인기 자료 통계
- [ ] 댓글 첨부파일 지원 (ORC_DTT="공통게시판댓글" 추가)
- [ ] 답변글·댓글 최대 깊이 UI 5단계 캡 구현 (현재 무제한)
- [ ] 검색 키워드 최소 2자 강제 (현재 미적용)
- [ ] 본문 최대 크기 정책 결정 및 검증 추가 (현재 오픈이슈)
- [ ] 게시물 목록 서버사이드 페이지네이션 — 백엔드 `Page<T>` 응답 + 전체 건수 반환 (현재 클라이언트 페이징 size=1000)
- [ ] `board/index.vue` + `AppSidebar.vue` 공통 권한 필터 추출 (현재 `inqAthC` 로직 중복)
- [ ] 게시판 단위 테스트 확대 — `BoardMetaService`, `BoardPostService` 커버리지 80%+
- [ ] 게시판 첨부파일 UI/API 연결 — 현재 게시물 타입에 `flApgYn`, `flNbr`만 있고 파일 업로드 흐름은 미연동
- [ ] 게시판 권한 코드(`inqAthC`, `enrAthC`)가 `ROLE.ADMIN` 외 역할을 정확히 매핑하는지 프론트/백엔드 통합 테스트 추가

## 🔌 EAI (KDB 표준전문 발송)
- [ ] KDB EAI 운영팀으로부터 IT Portal 전용 **IF_ID(인터페이스ID)** 및 **UMS 템플릿(업무구분ID)** 발급·확정. (시스템 식별자 IPP/PRM/PP는 프로퍼티로 확정)
- [ ] 운영 프로파일에서 `eai.enabled=true` + `eai.url`(환경변수 `EAI_URL`) 주입, 배포 체크리스트 반영.
- [ ] (선택) `NotificationDispatcher` 실연동 어댑터로 `EaiService` 연결 — 알림톡/SMS/이메일 채널 발송.
- [ ] `EaiService` 도메인 미연동 해소 — `infra/eai` 전체가 구현·테스트 완비 상태이나 `Estimate/Deliberation/Contract/PaymentService` 어디서도 `EaiService.sendEai()`를 호출하지 않아 상태전이 시 EAI 알림이 실제 발송되지 않음. 각 `changeStatus()`에 발송 연결(부수효과, 실패 무전파) 검토. (발견일: 2026-06-09)
- [ ] 발신채널 상수(`1588-1500`, `hrd@kdb.co.kr`)는 ePAMS(eHR) 값 — IT Portal 발신처로 교체 필요 시 프로퍼티화.
- [ ] (코드리뷰 LOW-4) `EaiServiceTest`에 `umsTrSno=""`/비숫자 케이스 추가 — `Integer.parseInt` `NumberFormatException` → `EaiResult.failure` 경로 명시적 커버.
- [ ] (플러그형) GWE `RMS_SYS_C`("GWE")·`IF_ID`·`MSG_KEY` 접두("mailt") 실제 규칙 KDB 확인. GWE 발신자 상수(systemalert/관리자)·SYSTEM_CODE 운영값 확인.
- [ ] 신규 시스템 연동 시 EaiPayload(record) + EaiPayloadSection(@Component) 1쌍 추가 패턴 따름.

## 🏛️ 과업심의위원회 (Stage ②) 후속 과제

- [ ] 과업심의 목록 부서(bbrC) 필터 미적용 — 대상이 사업/전산업무비 2종이라 단일 join 곤란. 후속 고도화.

## 📒 메타 용어사전(table.csv) 정합성 후속 과제 (2026-06-11 스키마 통일 작업 잔여)

- [ ] 메타 미등재 테이블 12종 등재 — 사업집행 4단계(`BESTIM/BESTTM/BDELIM/BCONTM/BPAYMM/BPAYTM` + 각 `*L` 로그). 컬럼명은 이미 표준 명칭 사용 중. (`BCHKLC` 사전점검 항목은 2026-06-12 `V20260612_001`로 테이블 드롭되어 등재 불필요)
- [ ] 메타 `BPAYTM/BPAYTL.DFR_DT` NULL여부 정정(N → Y) — 지급 회차는 지급일자 미확정(작성중) 상태로 저장될 수 있어 DB는 NULL 허용 유지(2026-06-12 결정, `V20260612_004` 헤더 참조). 운영 메타 NULL여부=N 등재가 stale — 정정 필요.
- [ ] BPOVWM 드롭된 `PRJ_BG_AMR`(테스트 1행) 값은 `RQM_BG_AMT`로 승계되지 않음 — 운영 데이터 이관 시 소요예산금액 원천 확인 필요.
- [ ] `TPRMPP_BBUGTM` PK 정합 보류 — 운영(table.csv)은 PK(`BG_NO`) 단일이나 로컬은 PK(`BG_NO`,`SNO`)이고 `BG_NO` 중복 20건 존재. 운영 PK 정의 재확인(메타 stale 가능성) 또는 로컬 데이터 중복 정리 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
- [ ] `TPRMPP_BRDOCM` PK 정합 보류 — 운영은 PK(`DOC_MNG_NO`) 단일이나 로컬은 PK(`DOC_MNG_NO`,`DOC_VRS_SNO`)이고 중복 2건 존재. 문서 버전 관리 구조상 운영 PK 정의 재확인 필요. 해소 후 `V20260612_002` 재실행 시 자동 정합 (2026-06-12 전면 정합 작업 잔여).
