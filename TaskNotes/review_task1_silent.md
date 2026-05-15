# Silent Failure Detection Report

> 스코프: `it_backend/src/main/java` (Java/Spring 234 files) + `it_frontend/app` (TS/Vue ~194 files)
> 날짜: 2026-05-16 | 작성: Silent Failure Hunter Agent
> 규칙: 탐지 목록만 (코드 변경 없음)

---

## BACKEND

### CRITICAL

#### B-C-01 -- ChangeLogEntityListener: 감사 로그 인프라 예외 전체 삼킴

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:75`
- **심각도**: CRITICAL
- **이슈**: `catch (Exception e)` 블록이 `log.warn` 한 줄만 출력하고 리턴. 감사 로그 저장 실패 전체가 무시됨. DB 연결 오류, 제약 조건 위반 등 인프라 장애도 동일하게 삼켜짐.
- **영향**: 감사 로그가 조용히 누락되어 컴플라이언스 이슈 발생 가능. 운영자는 실패 여부 파악 불가.
- **수정 권고**: `// FIXME: [B-C-01] 감사 로그 저장 실패 시 warn 레벨 + 스택 트레이스 필수. 인프라 오류는 별도 알람 채널 고려.`
- **TASK.md 등록**: YES -- 감사 로그 누락 시 알람 메커니즘 도입

#### B-C-02 -- ChangeLogEntityListener: delYn 리플렉션 실패 시 삭제가 수정으로 오기록

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:91`
- **심각도**: CRITICAL
- **이슈**: `IllegalAccessException` 발생 시 로그 없이 `return "U"` (update) 반환. 삭제 이벤트가 수정으로 잘못 기록됨.
- **영향**: 감사 로그 데이터 무결성 훼손. 컴플라이언스 감사 시 잘못된 이력 제공.
- **수정 권고**: `// FIXME: [B-C-02] delYn 리플렉션 실패 시 반드시 warn 로그 + 원인 예외 포함.`
- **TASK.md 등록**: YES

#### B-C-03 -- ApplicationService.getApplicationsByIds: null 반환으로 실패 항목 조용히 제거

- **위치**: `it_backend/src/main/java/com/kdb/it/common/approval/service/ApplicationService.java:440`
- **심각도**: CRITICAL
- **이슈**: ID 목록 조회 루프에서 `IllegalArgumentException` catch 후 `null` 반환, 이후 `filter(Objects::nonNull)`로 제거. 호출자는 몇 개가 누락됐는지 알 수 없고 로그도 없음.
- **영향**: 결재 문서 누락이 조용히 발생. 대량 처리 시 부분 실패가 성공으로 보임.
- **수정 권고**: `// FIXME: [B-C-03] null 필터링 대신 실패 ID 목록을 로그(warn)에 남기고, 호출자에게 실패 건수 반환하거나 예외를 재발생시킬 것.`
- **TASK.md 등록**: YES

#### B-C-04 -- ProjectService.getProjectsByIds: null 반환으로 실패 항목 조용히 제거

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/budget/project/service/ProjectService.java:564`
- **심각도**: CRITICAL
- **이슈**: B-C-03과 동일 패턴. 프로젝트 ID 목록 조회 중 예외 시 null 반환 후 필터링.
- **영향**: 예산 프로젝트 데이터 누락이 조용히 발생.
- **수정 권고**: `// FIXME: [B-C-04] B-C-03 참조. 실패 프로젝트 ID warn 로그 및 호출자 통지 필요.`
- **TASK.md 등록**: YES

#### B-C-05 -- CostService.getCostsByIds: null 반환으로 실패 항목 조용히 제거

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/budget/cost/service/CostService.java:351`
- **심각도**: CRITICAL
- **이슈**: B-C-03과 동일 패턴. 비용 ID 목록 조회 중 예외 시 null 반환 후 필터링.
- **영향**: 예산 비용 데이터 누락이 조용히 발생.
- **수정 권고**: `// FIXME: [B-C-05] B-C-03 참조. 실패 비용 ID warn 로그 및 호출자 통지 필요.`
- **TASK.md 등록**: YES

---

### HIGH

#### B-H-01 -- FileService: 벌크 업로드 루프에서 스택 트레이스 없이 파일명만 기록

- **위치**: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java:405`
- **심각도**: HIGH
- **이슈**: `catch (Exception e)` 블록이 failList에 파일명+메시지만 추가. e 자체(스택 트레이스)는 기록 안 함. 디스크 full, 권한 오류, 네트워크 단절 등 구분 불가.
- **영향**: 파일 업로드 실패 원인 진단 불가능.
- **수정 권고**: `// TODO: [B-H-01] log.warn("파일 업로드 실패: {}", fileName, e) 로 스택 트레이스 포함 필요.`
- **TASK.md 등록**: NO

#### B-H-02 -- FileService: MalformedURLException을 cause 없이 CustomGeneralException으로 변환

- **위치**: `it_backend/src/main/java/com/kdb/it/infra/file/service/FileService.java:528`
- **심각도**: HIGH
- **이슈**: `throw new CustomGeneralException(...)` 호출 시 원본 MalformedURLException e를 cause로 전달 안 함. 스택 트레이스 유실.
- **영향**: URL 오류 진단 불가. 로그에 원본 예외 없음.
- **수정 권고**: `// FIXME: [B-H-02] new CustomGeneralException(msg, e) 형태로 원본 예외를 cause로 전달할 것.`
- **TASK.md 등록**: NO

#### B-H-03 -- GeminiService: 파일 읽기 IOException 무로그 스킵

- **위치**: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java:268`
- **심각도**: HIGH
- **이슈**: 파일 읽기 실패 시 `catch (IOException e)` 블록이 FilePartResult.skip() 반환만 하고 로그 없음. AI 분석 대상 파일이 조용히 제외됨.
- **영향**: AI 분석 결과가 불완전해도 사용자/운영자 모름.
- **수정 권고**: `// TODO: [B-H-03] log.warn("AI 분석 파일 읽기 실패, 스킵: {}", filePath, e) 최소한 warn 로그 필요.`
- **TASK.md 등록**: NO

#### B-H-04 -- GeminiService: RestClient 타임아웃 미설정 (스레드 풀 고갈 위험)

- **위치**: `it_backend/src/main/java/com/kdb/it/infra/ai/service/GeminiService.java:98`
- **심각도**: HIGH
- **이슈**: `RestClient.builder().baseUrl(baseUrl).build()` -- connectTimeout / readTimeout 없음. Gemini API 응답 지연 시 스레드 무한 대기.
- **영향**: Gemini API 장애 시 서버 스레드 풀 고갈로 전체 서비스 장애 가능.
- **수정 권고**: `// FIXME: [B-H-04] HttpClient에 connectTimeout(5s), readTimeout(60s) 설정 후 RestClient에 주입 필요.`
- **TASK.md 등록**: YES -- 외부 API 타임아웃 정책 수립

#### B-H-05 -- PlanService: JsonProcessingException 완전 무시 (빈 catch 블록)

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/budget/plan/service/PlanService.java:108`
- **심각도**: HIGH
- **이슈**: 스냅샷 JSON 파싱 `catch (JsonProcessingException e)` 블록이 완전히 비어있음 ({}). 파싱 실패 시 카운트 0으로 집계되어 정상인 척 반환.
- **영향**: 계획 데이터 집계 오류가 조용히 발생. 예산 보고서 수치 오류.
- **수정 권고**: `// FIXME: [B-H-05] 빈 catch 블록 절대 금지. log.error("플랜 스냅샷 JSON 파싱 실패, id={}", id, e) 최소 필요.`
- **TASK.md 등록**: NO

#### B-H-06 -- SsoController: SSO 실패 catch 내부에서 IOException 미처리

- **위치**: `it_backend/src/main/java/com/kdb/it/common/system/controller/SsoController.java:145`
- **심각도**: HIGH
- **이슈**: SSO 실패 catch 블록에서 `response.sendRedirect()` 호출 -- 이 메서드가 IOException을 던질 수 있으나 내부 처리 없음.
- **영향**: 리다이렉트 실패 시 예외가 상위로 전파되어 500 응답 또는 빈 응답 반환.
- **수정 권고**: `// TODO: [B-H-06] sendRedirect() IOException을 내부 try-catch로 감싸고 에러 로그 추가 필요.`
- **TASK.md 등록**: NO

---

### MEDIUM

#### B-M-01 -- AdminLogService: 리플렉션 필드 미발견 시 null 반환 (NPE 위험)

- **위치**: `it_backend/src/main/java/com/kdb/it/common/admin/service/AdminLogService.java:172`
- **심각도**: MEDIUM
- **이슈**: 클래스 계층에서 필드를 찾지 못하면 null 반환. 호출자가 null 체크 없이 사용 시 NPE.
- **영향**: 관리 로그 생성 중 NPE로 인한 로그 누락.
- **수정 권고**: `// TODO: [B-M-01] null 반환 대신 Optional<Field> 반환 또는 NoSuchFieldException throw로 호출자 명시 처리 유도.`
- **TASK.md 등록**: NO

#### B-M-02 -- AuditLogPersister: 인증 컨텍스트 없을 때 chgUsid null 기록

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/log/listener/AuditLogPersister.java:158`
- **심각도**: MEDIUM
- **이슈**: resolveCurrentUserId()가 인증 컨텍스트 없을 때 null 반환. 감사 로그 chgUsid 컬럼에 null 기록.
- **영향**: 감사 로그 사용자 추적 불가.
- **수정 권고**: `// TODO: [B-M-02] 인증 컨텍스트 없을 때 "SYSTEM" 또는 "ANONYMOUS" 기본값 사용 + warn 로그.`
- **TASK.md 등록**: NO

#### B-M-03 -- ScheduleService: 루프 내 per-member findByEno() N+1 쿼리

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/council/service/ScheduleService.java:280`
- **심각도**: MEDIUM
- **이슈**: 회의 참석자 목록 처리 시 멤버별 findByEno() 호출. 기존 TODO 주석 존재하나 미해결.
- **영향**: 대규모 회의 처리 시 DB 부하 급증.
- **수정 권고**: `// TODO: [B-M-03] findAllByEnoIn(enoList) 배치 조회로 교체하여 N+1 제거.`
- **TASK.md 등록**: YES -- N+1 쿼리 개선

#### B-M-04 -- JwtUtil: athIds 클레임 타입 불일치 시 무경고 빈 권한 반환

- **위치**: `it_backend/src/main/java/com/kdb/it/common/system/security/JwtUtil.java:171`
- **심각도**: MEDIUM
- **이슈**: athIds 클레임이 List<?> 타입이 아닐 경우 List.of() (빈 권한 목록) 반환. warn 로그 없음.
- **영향**: JWT 토큰 구조 변경 시 권한이 조용히 제거됨. 403 응답 폭증하나 원인 파악 어려움.
- **수정 권고**: `// TODO: [B-M-04] 타입 불일치 시 log.warn("JWT athIds 클레임 타입 오류: {}", claim.getClass()) 추가.`
- **TASK.md 등록**: NO

---

### LOW

#### B-L-01 -- ChangeLogEntityListener: JPA 트랜잭션 격리를 위한 예외 삼킴 (의도적이나 문서 부재)

- **위치**: `it_backend/src/main/java/com/kdb/it/domain/log/listener/ChangeLogEntityListener.java:75`
- **심각도**: LOW
- **이슈**: 감사 로그 실패가 메인 트랜잭션을 롤백시키지 않도록 예외 삼킴은 의도적일 수 있으나, 코드 주석으로 설계 의도가 명시되지 않음.
- **수정 권고**: `// TODO: [B-L-01] 의도적 예외 삼킴이라면 "감사 로그 실패는 메인 트랜잭션 영향 없음 -- 의도적 설계" 주석 명시.`
- **TASK.md 등록**: NO

#### B-L-02 -- 백엔드 전반: 구조화된 오류 응답 누락

- **위치**: 여러 Controller 예외 핸들러
- **심각도**: LOW
- **이슈**: 일부 에러 응답에 스택 트레이스나 오류 코드 없이 메시지만 반환.
- **수정 권고**: `// TODO: [B-L-02] 모든 에러 응답에 errorCode, message, timestamp 구조화 필드 포함 권고.`
- **TASK.md 등록**: NO

---

## FRONTEND

### CRITICAL

#### F-C-01 -- cost/terminal/[id].vue: 삭제 실패 시 사용자 피드백 없음

- **위치**: `it_frontend/app/pages/info/cost/terminal/[id].vue:36`
- **심각도**: CRITICAL
- **이슈**: 비용 삭제 API 실패 시 console.error 만 실행. 토스트/알림 없음. 사용자는 삭제 성공 여부 모름.
- **영향**: 사용자가 삭제 실패를 인지 못하고 업무 진행. 데이터 불일치 발생 가능.
- **수정 권고**: `// FIXME: [F-C-01] catch 블록에 toast.add({ severity: "error", summary: "삭제 실패" }) 추가 필수.`
- **TASK.md 등록**: NO

#### F-C-02 -- projects/form.vue: 편집 모드 데이터 로드 실패 시 빈 폼 저장 위험

- **위치**: `it_frontend/app/pages/info/projects/form.vue:563`
- **심각도**: CRITICAL
- **이슈**: 편집 모드 초기 데이터 로드 실패 시 console.error(e) 만 실행. 토스트/이동 없음. 사용자가 빈 폼을 기존 데이터로 착각하고 저장할 수 있음.
- **영향**: 프로젝트 데이터 덮어쓰기로 인한 데이터 손실 위험.
- **수정 권고**: `// FIXME: [F-C-02] 편집 데이터 로드 실패 시 toast 표시 후 목록 페이지로 강제 이동 필요.`
- **TASK.md 등록**: YES -- 폼 편집 모드 데이터 로드 실패 처리 개선

#### F-C-03 -- budget/report.vue: 데이터 로드 실패 시 빈 PDF 생성 위험

- **위치**: `it_frontend/app/pages/budget/report.vue:246`
- **심각도**: CRITICAL
- **이슈**: 보고서 데이터 로드 실패 catch 블록이 loading.value = false 만 설정. 빈 데이터로 PDF 생성 버튼 활성화됨.
- **영향**: 빈 PDF 또는 불완전한 보고서가 공식 문서로 제출될 수 있음.
- **수정 권고**: `// FIXME: [F-C-03] 데이터 로드 실패 시 PDF 생성 버튼 비활성화 + toast 에러 표시 필수.`
- **TASK.md 등록**: YES

---

### HIGH

#### F-H-01 -- projects/form.vue: 부서 정보 fetch 3개 catch 블록 console.error만

- **위치**: `it_frontend/app/pages/info/projects/form.vue:375,430,500`
- **심각도**: HIGH
- **이슈**: 부서 정보, 담당자 목록, 관련 데이터 fetch 실패 시 각각 console.error 만 실행. 토스트 없음. 폼에 빈 선택지 표시.
- **영향**: 폼 데이터 불완전 상태에서 사용자가 저장 진행 가능.
- **수정 권고**: `// TODO: [F-H-01] 각 fetch 실패 catch에 toast.add({ severity: "warn" }) 추가.`
- **TASK.md 등록**: NO

#### F-H-02 -- projects/form.vue: catch {} 빈 에러 바인딩으로 스택 트레이스 유실

- **위치**: `it_frontend/app/pages/info/projects/form.vue:870`
- **심각도**: HIGH
- **이슈**: catch {} -- 에러 변수 바인딩 없음. TypeScript 4+ 문법이나 스택 트레이스 완전 유실. 빈 배열 폴백 반환.
- **영향**: 실패 원인 진단 불가.
- **수정 권고**: `// FIXME: [F-H-02] catch (err) 로 수정 후 console.error("[projects/form] 데이터 로드 실패:", err) 추가 필요.`
- **TASK.md 등록**: NO

#### F-H-03 -- useAdminTableEdit.ts: catch {} 빈 에러 바인딩

- **위치**: `it_frontend/app/composables/useAdminTableEdit.ts:199`
- **심각도**: HIGH
- **이슈**: catch {} -- 에러 변수 없음. 토스트는 표시되나 로그 전혀 없음. 서버 오류 메시지 손실.
- **영향**: 관리 테이블 편집 실패 원인 로그 없음.
- **수정 권고**: `// FIXME: [F-H-03] catch (err) 로 수정 후 console.error("[useAdminTableEdit] 저장 실패:", err) 추가 필요.`
- **TASK.md 등록**: NO

#### F-H-04 -- BoardCommentTree.vue: 댓글 CRUD 4개 catch {} 빈 블록

- **위치**: `it_frontend/app/components/board/BoardCommentTree.vue:43,59,83,97`
- **심각도**: HIGH
- **이슈**: 댓글 생성/수정/삭제/조회 4개 catch 블록 모두 catch {} -- 에러 변수 없음, 로그 없음.
- **영향**: 댓글 작업 실패 원인 추적 불가.
- **수정 권고**: `// FIXME: [F-H-04] 각 catch (err) 로 수정 후 console.error("[BoardCommentTree] 댓글 작업 실패:", err) 추가 필요.`
- **TASK.md 등록**: NO

#### F-H-05 -- board/index.vue: 게시글 삭제 catch {} 빈 블록

- **위치**: `it_frontend/app/pages/board/[blbMngNo]/[nacMngNo]/index.vue:38`
- **심각도**: HIGH
- **이슈**: 게시글 삭제 catch 블록 catch {} -- 에러 변수 없음, 로그 없음.
- **영향**: 삭제 실패 원인 추적 불가. 사용자 피드백 없음.
- **수정 권고**: `// FIXME: [F-H-05] catch (err) 로 수정 후 console.error + toast 추가 필요.`
- **TASK.md 등록**: NO

#### F-H-06 -- info/plan/[id].vue: JSON 파싱 catch {} 빈 블록으로 null 반환

- **위치**: `it_frontend/app/pages/info/plan/[id].vue:76`
- **심각도**: HIGH
- **이슈**: catch {} -- 에러 없음, null 반환. plnMngNo 컨텍스트 없이 완전 실패 무시.
- **영향**: 계획 상세 페이지 일부 데이터 null로 렌더링. 원인 추적 불가.
- **수정 권고**: `// FIXME: [F-H-06] catch (err) 로 수정 후 console.error("[plan/id] JSON 파싱 실패:", err) 추가 필요.`
- **TASK.md 등록**: NO

#### F-H-07 -- EmployeeSearchDialog.vue: 조직도 로드 실패 토스트 없음

- **위치**: `it_frontend/app/components/common/EmployeeSearchDialog.vue:88`
- **심각도**: HIGH
- **이슈**: 조직도 트리 로드 실패 시 console.error 만 실행. 다이얼로그는 빈 상태로 열림.
- **영향**: 사용자가 조직도 로드 실패 인지 못하고 빈 다이얼로그에서 시간 낭비.
- **수정 권고**: `// TODO: [F-H-07] 조직도 로드 실패 시 toast.add({ severity: "error", summary: "조직도 로드 실패" }) 추가.`
- **TASK.md 등록**: NO

#### F-H-08 -- EmployeeSearchDialog.vue: 사용자 목록 실패 시 빈 배열 폴백 (빈 부서처럼 보임)

- **위치**: `it_frontend/app/components/common/EmployeeSearchDialog.vue:204`
- **심각도**: HIGH
- **이슈**: 사용자 목록 fetch 실패 시 users.value = [] 설정. 토스트 없음. 실제 빈 부서와 구분 불가.
- **영향**: 사용자가 담당자 선택 불가 상태를 빈 부서로 오해.
- **수정 권고**: `// FIXME: [F-H-08] 실패 시 빈 배열 폴백 대신 toast.add({ severity: "error" }) + 빈 배열 유지.`
- **TASK.md 등록**: NO

#### F-H-09 -- useEmployeeSearch.ts: 검색 실패 시 빈 배열 (결과 없음처럼 보임)

- **위치**: `it_frontend/app/composables/useEmployeeSearch.ts:75`
- **심각도**: HIGH
- **이슈**: 직원 검색 API 실패 시 employeeSuggestions.value = [] + console.error. 토스트 없음. 실제 검색 결과 없음과 구분 불가.
- **영향**: 직원 검색 장애가 조용히 발생. 사용자는 검색 결과가 없다고 오해.
- **수정 권고**: `// FIXME: [F-H-09] 검색 실패 시 toast.add({ severity: "warn", summary: "직원 검색 실패" }) 추가.`
- **TASK.md 등록**: NO

#### F-H-10 -- useTiptapImageInsertion.ts: 이미지 3개 catch 블록 toast 없음 + blob URL 누수

- **위치**: `it_frontend/app/composables/useTiptapImageInsertion.ts:60,111,135`
- **심각도**: HIGH
- **이슈**: 이미지 업로드/삽입/처리 실패 3개 catch 블록 모두 console.error 만. 토스트 없음. 임시 blob URL이 에디터 DOM에 잔류.
- **영향**: 사용자 피드백 없음 + 메모리 누수 (blob URL revoke 미호출).
- **수정 권고**: `// FIXME: [F-H-10] 각 catch에 toast 추가 + URL.revokeObjectURL(blobUrl) 호출 필요.`
- **TASK.md 등록**: YES -- blob URL 메모리 누수 개선

#### F-H-11 -- TiptapToolbar.vue: 이미지 업로드 실패 시 다이얼로그 닫힘 처리 누락

- **위치**: `it_frontend/app/components/TiptapToolbar.vue:226`
- **심각도**: HIGH
- **이슈**: 이미지 업로드 실패 catch 블록이 console.error 만 실행. imageDialogVisible = false 미설정으로 다이얼로그가 열린 채 남음.
- **영향**: 사용자가 업로드 실패 후 다이얼로그를 수동으로 닫아야 함. UX 손상.
- **수정 권고**: `// FIXME: [F-H-11] catch에서 imageDialogVisible.value = false + toast.add({ severity: "error" }) 추가.`
- **TASK.md 등록**: NO

#### F-H-12 -- info/cost/form.vue: 3개 데이터 로드 실패 catch 블록 toast 없음

- **위치**: `it_frontend/app/pages/info/cost/form.vue:167,191,213`
- **심각도**: HIGH
- **이슈**: 비용 폼 초기 데이터 로드 3개 catch 블록 모두 console.error 만. 빈 폼으로 저장 진행 가능.
- **영향**: 비용 데이터 불완전 저장 위험.
- **수정 권고**: `// FIXME: [F-H-12] 각 catch에 toast.add({ severity: "error" }) + 저장 버튼 비활성화 고려.`
- **TASK.md 등록**: NO

---

### MEDIUM

#### F-M-01 -- budget/report.vue: PDF 생성 실패 toast 없음

- **위치**: `it_frontend/app/pages/budget/report.vue:169`
- **심각도**: MEDIUM
- **이슈**: PDF 생성 실패 시 console.error 만. 사용자는 생성 실패 인지 불가.
- **수정 권고**: `// TODO: [F-M-01] PDF 생성 실패 catch에 toast.add({ severity: "error", summary: "PDF 생성 실패" }) 추가.`
- **TASK.md 등록**: NO

#### F-M-02 -- budget/report.vue: sessionStorage JSON.parse 실패 console.error (warn이 적절)

- **위치**: `it_frontend/app/pages/budget/report.vue:200,211`
- **심각도**: MEDIUM
- **이슈**: sessionStorage 파싱 실패 시 console.error 사용. 복구 가능한 상황이므로 console.warn이 적절.
- **수정 권고**: `// TODO: [F-M-02] console.error를 console.warn으로 변경.`
- **TASK.md 등록**: NO

#### F-M-03 -- projects/form.vue: 전년도 프로젝트 로드 실패 toast 없음

- **위치**: `it_frontend/app/pages/info/projects/form.vue:930`
- **심각도**: MEDIUM
- **이슈**: 전년도 프로젝트 참조 데이터 로드 실패 시 console.error 만. 토스트 없음.
- **수정 권고**: `// TODO: [F-M-03] 전년도 데이터 로드 실패 시 toast.add({ severity: "warn" }) 추가.`
- **TASK.md 등록**: NO

#### F-M-04 -- projects/report.vue: PDF/프로젝트 로드 실패 console.error만

- **위치**: `it_frontend/app/pages/info/projects/report.vue:164,198`
- **심각도**: MEDIUM
- **이슈**: 프로젝트 보고서 데이터 및 PDF 생성 실패 모두 console.error 만. F-C-03과 유사 패턴.
- **수정 권고**: `// TODO: [F-M-04] F-C-03 참조. 데이터 로드 실패 시 PDF 버튼 비활성화 + toast 추가.`
- **TASK.md 등록**: NO

#### F-M-05 -- projects/[id].vue: IOE 코드 fetch 실패 toast 없음

- **위치**: `it_frontend/app/pages/info/projects/[id].vue:55`
- **심각도**: MEDIUM
- **이슈**: IOE 코드 fetch 실패 시 console.error 만. 프로젝트 상세 페이지 일부 레이블 깨질 수 있음.
- **수정 권고**: `// TODO: [F-M-05] IOE 코드 로드 실패 시 toast.add({ severity: "warn" }) 추가.`
- **TASK.md 등록**: NO

#### F-M-06 -- useGlobalSearch.ts: 검색 실패 시 빈 제안 목록 (사용자 알림 없음)

- **위치**: `it_frontend/app/composables/useGlobalSearch.ts:73`
- **심각도**: MEDIUM
- **이슈**: 전역 검색 API 실패 시 빈 배열 반환. 사용자 알림 없음. 검색 결과 없음과 구분 불가.
- **수정 권고**: `// TODO: [F-M-06] 검색 실패 시 toast.add({ severity: "warn", summary: "검색 서비스 일시 오류" }) 추가.`
- **TASK.md 등록**: NO

#### F-M-07 -- usePdfReport.ts: 한글 폰트 로드 실패 시 Roboto 폴백 (사용자 알림 없음)

- **위치**: `it_frontend/app/composables/usePdfReport.ts:174`
- **심각도**: MEDIUM
- **이슈**: 한글 폰트 로드 실패 시 Roboto로 폴백. 사용자 알림 없음. PDF에 한글 깨짐 발생 가능.
- **수정 권고**: `// TODO: [F-M-07] 한글 폰트 로드 실패 시 toast.add({ severity: "warn", summary: "PDF 한글 폰트 로드 실패 -- 일부 글자가 깨질 수 있습니다" }) 추가.`
- **TASK.md 등록**: NO

---

### LOW

#### F-L-01 -- approval/list.vue 외 다수: alert() 사용 (PrimeVue toast 미통일)

- **위치**: `it_frontend/app/pages/approval/list.vue:207` 외 다수
- **심각도**: LOW
- **이슈**: 일부 페이지에서 에러 피드백에 alert() 사용. 기존 TODO 주석 존재하나 미해결.
- **수정 권고**: `// TODO: [F-L-01] alert() 전수 제거 후 toast.add() 통일. TASK.md 등록된 기술 부채.`
- **TASK.md 등록**: YES (기존 등록 확인 필요)

#### F-L-02 -- ExcalidrawWrapper.vue: export/init/scene 로드 null 반환

- **위치**: `it_frontend/app/components/ExcalidrawWrapper.vue:85,149,187`
- **심각도**: LOW
- **이슈**: Excalidraw 내보내기/초기화/씬 로드 실패 시 null 반환. toast 없음.
- **수정 권고**: `// TODO: [F-L-02] null 반환 대신 toast.add({ severity: "warn" }) + 빈 상태 명시 처리 권고.`
- **TASK.md 등록**: NO

---

## TASK.md 등록 대상 요약

| ID | 위치 | 내용 | 우선순위 |
|----|------|------|----------|
| B-C-01 | ChangeLogEntityListener:75 | 감사 로그 누락 시 알람 메커니즘 도입 | HIGH |
| B-C-02 | ChangeLogEntityListener:91 | 감사 로그 이벤트 타입 오기록 수정 | HIGH |
| B-C-03 | ApplicationService:440 | 결재 문서 벌크 조회 실패 처리 개선 | HIGH |
| B-C-04 | ProjectService:564 | 프로젝트 벌크 조회 실패 처리 개선 | HIGH |
| B-C-05 | CostService:351 | 비용 벌크 조회 실패 처리 개선 | HIGH |
| B-H-04 | GeminiService:98 | 외부 AI API 타임아웃 정책 수립 | HIGH |
| B-M-03 | ScheduleService:280 | N+1 쿼리 개선 (findAllByEnoIn 배치) | MEDIUM |
| F-C-02 | projects/form.vue:563 | 폼 편집 모드 데이터 로드 실패 처리 | HIGH |
| F-C-03 | budget/report.vue:246 | 보고서 데이터 실패 시 PDF 버튼 비활성화 | HIGH |
| F-H-10 | useTiptapImageInsertion.ts:60 | blob URL 메모리 누수 개선 | MEDIUM |
| F-L-01 | approval/list.vue 외 | alert() 전수 제거 후 toast 통일 | LOW |

---

## 통계 요약

| 구분 | CRITICAL | HIGH | MEDIUM | LOW | 합계 |
|------|---------|------|--------|-----|------|
| Backend | 5 | 6 | 4 | 2 | 17 |
| Frontend | 3 | 12 | 7 | 2 | 24 |
| **합계** | **8** | **18** | **11** | **4** | **41** |

TASK.md 등록 대상: 11건
