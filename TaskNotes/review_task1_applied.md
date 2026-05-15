# 한글 주석 적용 매니페스트 (review_task1_applied)

> 적용 일시: 2026-05-16
> 입력 보고서: review_task1_java.md / review_task1_ts.md / review_task1_silent.md
> 규칙: 비즈니스 로직 수정 없음 -- 주석 전용 / 신규 주석 한글 / CRITICAL.HIGH 실패에 TODO[]/FIXME[] 마커

---

## 1. 수정된 파일 목록

### 백엔드 (Java/Spring)

| 파일 | 적용 항목 |
|------|----------|
| common/code/controller/CodeController.java | 클래스 JavaDoc 보강, createCcodem/updateCcodem @param/@return/@implNote 추가, @Valid 누락 TODO |
| common/code/service/CodeService.java | 클래스 JavaDoc 캐시 전략 추가, findCodeEntitiesByCId 캐시 동작 주석 |
| common/code/repository/CodeRepositoryImpl.java | 5개 @Override 메서드 JavaDoc 신규 작성 |
| domain/budget/status/service/BudgetStatusService.java | readOnly 클래스 수준 주의사항 추가 |
| domain/council/service/CouncilApprovalEventListener.java | @EventListener vs @TransactionalEventListener 설계 의도 주석 |
| exception/CustomGeneralException.java | 스테일 사용 위치 주석 -> 정확한 사용 범위로 교체 |
| domain/log/listener/AuditLogPersister.java | resolveCurrentUserId null 반환 경고 TODO [B-M-02] |
| common/system/security/JwtUtil.java | getAthIdsFromToken 빈 권한 반환 TODO [B-M-04] |
| infra/ai/service/GeminiService.java | RestClient 타임아웃 미설정 FIXME [B-H-04], 파일읽기 무로그 TODO [B-H-03] |
| common/admin/service/AdminLogService.java | null 반환 NPE 위험 TODO [B-M-01] |
| domain/log/listener/ChangeLogEntityListener.java | 감사로그 삼킴 FIXME [B-C-01], delYn 리플렉션 실패 FIXME [B-C-02] |
| common/approval/service/ApplicationService.java | null 필터링 FIXME [B-C-03] |
| domain/budget/project/service/ProjectService.java | null 필터링 FIXME [B-C-04] |
| domain/budget/cost/service/CostService.java | null 필터링 FIXME [B-C-05] |
| infra/file/service/FileService.java | 벌크 업로드 스택트레이스 TODO [B-H-01], MalformedURL cause 미전달 FIXME [B-H-02] |
| domain/budget/plan/service/PlanService.java | 빈 catch 블록 FIXME [B-H-05] |
| common/system/controller/SsoController.java | sendRedirect IOException TODO [B-H-06] |

### 프론트엔드 (TypeScript/Vue)

| 파일 | 적용 항목 |
|------|----------|
| composables/useBudgetStatus.ts | @throws 인증 갱신 실패 조건, 스테일 설계참조 한글화 |
| composables/useAdminApi.ts | updateCode URL 인코딩 경고, 스테일 설계참조 한글화 |
| stores/review.ts | loadSession/submitForReview/addComment/viewVersion 실패 조건, TODO(HIGH) 등급 명시 |
| composables/useReviewCommentApi.ts | authorTeam TODO 위치 재배치 |
| composables/useCostListPage.ts | cNm 스테일 주석 수정, rowKey _localId 설명 추가 |
| composables/useCodeOptions.ts | @param cId 404 토스트 조건 추가 |
| composables/useBudgetPeriod.ts | API 오류 시 isWithinPeriod=false 경고 추가 |
| composables/useBudgetAllocationSummary.ts | @param plnYy Ref 재조회 동작, non-null assertion 근거 주석 |
| composables/useBudgetStatusCostTab.ts | @param bgYy Ref 갱신 동작 주석 |
| composables/useCouncilCodes.ts | suppressNotFound/suppressNetworkError 동작 주석 |
| composables/useGlobalSearch.ts | 에러 시 빈 배열 폴백 및 토스트 미표시 주석 |
| composables/useTabs.ts | addTab any 타입 이유 주석 |
| composables/useAdminTableEdit.ts | enterEditMode JSON 직렬화 손실 경고, FIXME [F-H-03] |
| composables/useProjects.ts | createProject/updateProject any 이유 주석 |
| composables/useCouncil.ts | requestApproval  as any 이유 주석 |
| composables/usePlan.ts | createPlan/deletePlan @returns Promise await 필수 경고 |
| composables/usePdfReport.ts | TODO [F-M-07] 한글 폰트 폴백 토스트 미표시 경고 |
| composables/useEmployeeSearch.ts | FIXME [F-H-09] 직원 검색 실패 토스트 미표시 |
| composables/useTiptapImageInsertion.ts | FIXME [F-H-10] 이미지 처리 3개 catch, blob URL 누수 |
| middleware/auth.global.ts | getSingleQueryValue @returns null/number/object 조건 명시 |
| plugins/auth.ts | as unknown as 이중 캐스팅 이유 주석 |
| pages/info/cost/terminal/[id].vue | FIXME [F-C-01] 삭제 실패 사용자 피드백 없음 |
| pages/info/projects/form.vue | FIXME [F-C-02], TODO [F-H-01] (3곳), FIXME [F-H-02], TODO [F-M-03] |
| pages/budget/report.vue | FIXME [F-C-03], TODO [F-M-01], TODO [F-M-02] (2곳) |
| pages/board/[blbMngNo]/[nacMngNo]/index.vue | FIXME [F-H-05] 삭제 catch 빈 블록 |
| pages/info/plan/[id].vue | FIXME [F-H-06] JSON 파싱 catch 빈 블록 |
| pages/info/projects/[id].vue | TODO [F-M-05] IOE 코드 로드 실패 토스트 미표시 |
| pages/info/projects/report.vue | TODO [F-M-04] (2곳) |
| pages/info/cost/form.vue | FIXME [F-H-12] (3곳) |
| components/board/BoardCommentTree.vue | FIXME [F-H-04] (4곳) |
| components/common/EmployeeSearchDialog.vue | TODO [F-H-07], FIXME [F-H-08] |
| components/TiptapToolbar.vue | FIXME [F-H-11] 이미지 업로드 실패 다이얼로그 미닫힘 |

---

## 2. 적용 vs 스킵 요약

| 카테고리 | 전체 | 적용 | 스킵 |
|---------|------|------|------|
| 백엔드 누락 JavaDoc | 9 | 9 | 0 |
| 백엔드 스테일/부정확 주석 | 3 | 3 | 0 |
| 백엔드 CRITICAL 실패 마커 | 5 | 5 | 0 |
| 백엔드 HIGH 실패 마커 | 6 | 6 | 0 |
| 백엔드 MEDIUM 마커 | 4 | 4 | 0 |
| 프론트 누락 주석 (1-A~D) | 16 | 16 | 0 |
| 프론트 스테일/부정확 주석 | 5 | 5 | 0 |
| 프론트 타입/비동기 경고 주석 | 14 | 13 | 1 |
| 프론트 CRITICAL 실패 마커 | 3 | 3 | 0 |
| 프론트 HIGH 실패 마커 | 12 | 12 | 0 |
| 프론트 MEDIUM 실패 마커 | 7 | 5 | 2 |

### 스킵 항목

- CouncilController.java 엔드포인트 JavaDoc -- 확인 결과 이미 완전한 JavaDoc 존재. 재작성 불필요.
- F-M-06 (useGlobalSearch.ts) -- 동일 파일에 유사 설명 주석 이미 존재하여 중복 방지.
- F-L-01, F-L-02 -- LOW 심각도. 규칙에 따라 LOW는 trivial하지 않으면 스킵.

---

## 3. TASK.md 승급 후보

다음 항목은 주석 마커 외에 실제 코드 변경이 필요한 장기 과제입니다:

1. @Valid 일관성 부재 -- CodeController createCcodem/updateCcodem (TODO 마커 적용 완료)
2. NotFoundException 전용 클래스 도입 -- UserController, GuideDocService HTTP 400 vs 404 불일치
3. 사번(eno) PII 로그 정책 -- CouncilService.java:94 INFO 레벨 로그
4. 감사 로그 누락 알람 메커니즘 -- B-C-01 (FIXME 마커 적용 완료)
5. blob URL 메모리 누수 -- F-H-10 useTiptapImageInsertion.ts URL.revokeObjectURL 미호출
6. 외부 API 타임아웃 정책 -- B-H-04 GeminiService RestClient (FIXME 마커 적용 완료)
7. 데이터 로드 실패 시 편집 폼 보호 -- F-C-02 프로젝트 폼, F-C-03 보고서 (FIXME 마커 적용 완료)