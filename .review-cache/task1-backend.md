# 백엔드 한글 주석 누락/오류 탐지 보고서

생성일: 2026-05-26
분석 범위: C:/it/it_backend/src/main/java (257 파일)
분석 기준: CLAUDE.md 섹션4.1 (한글 주석 원칙), it_backend/CLAUDE.md 섹션7
작성 목적: comment-analyzer 에이전트가 이 목록을 받아 주석을 추가/수정하기 위한 탐지 목록
주의: 코드 자체(비즈니스 로직)는 수정 대상이 아님. 주석만 추가/수정 대상.

---

## 요약

| 구분 | 건수 |
|------|------|
| [MISMATCH] 주석 내용이 실제 코드와 불일치 | 2 |
| [MISSING-CRITICAL] public 서비스 메서드 JavaDoc 완전 누락 | 7 |
| [MISSING-PARAM] @param/@return/@throws 일부 누락 | 15 |
| [MISSING-METHOD] private/내부 메서드 JavaDoc 누락 | 12 |
| [MISSING-FIELD] 필드 주석 누락 | 3 |
| [TODO-NOTE] 기존 FIXME/TODO 주석에 영향 범위 미기재 | 5 |
| **합계** | **44** |

---
## [MISMATCH] 주석 내용 오류 (2건)

### 1. ProjectService.java - JavaDoc 블록 물리적 오배치

**파일**: `domain/budget/project/service/ProjectService.java`
**심각도**: MISMATCH (HIGH)

**문제**: L1013~L1033의 JavaDoc 블록은 `validateModifyPermission()` 메서드(L1115)에 대한
설명이지만, 물리적으로 `buildCodeNameMap()` 메서드(L1041) 바로 위에 위치하여
JavaDoc 처리기가 buildCodeNameMap()의 문서로 인식함.
뒤이어 L1034~1040에 buildCodeNameMap()의 별도 JavaDoc 블록이 존재하여 두 블록이 연속으로 나타남.

```
L1013  /**
L1014   * RBAC 수정/삭제 권한 검증 헬퍼  <- validateModifyPermission 설명
...
L1033   */
L1034  /**
L1035   * C_ID 기준 cdva->C_NM 맵 생성  <- buildCodeNameMap 설명
...
L1040   */
L1041  private Map<String, String> buildCodeNameMap(...)  <- 이 메서드에 두 JavaDoc이 표시됨
```

**수정 방법**: L1013~L1033 블록을 validateModifyPermission() 메서드 직전(약 L1115 위)으로 이동.

---

### 2. ProjectService.java - 고아(orphaned) JavaDoc 블록

**파일**: `domain/budget/project/service/ProjectService.java`
**심각도**: MISMATCH (MEDIUM)

**문제**: L665~670 JavaDoc 블록이 @param response, @param prjMngNo, @param prjSno를
기술하고 있으나 바로 다음 L671에서 또 다른 블록이 시작됨.
즉 L665~670 블록은 어떤 메서드에도 연결되지 않은 고아 JavaDoc임.

```
L665   * @param response 신청서 정보를 설정할 응답 DTO
L666   * @param prjMngNo 프로젝트관리번호
L667   * @param prjSno   프로젝트순번
L668  */
L671  /**   <- 바로 다음 새 JavaDoc 시작
L679  private void enrichProjectListBatch(...)
```

**수정 방법**: L665~670 블록의 원래 의도 확인 후 해당 메서드에 재연결하거나 삭제.

---
## [MISSING-CRITICAL] public 서비스 메서드 JavaDoc 완전 누락 (7건)

### 3. ApplicationService.java - canRecall() JavaDoc 누락

**파일**: `common/approval/service/ApplicationService.java`
**위치**: L661
**메서드**: `private boolean canRecall(Capplm capplm, List<Cdecim> approvers, String currentEno, boolean isAdmin)`

**문제**: 단일 행 주석만 존재. 복잡한 권한 로직
(결재중 상태 체크 + 관리자/신청자/중간결재자 3가지 분기)이 있으나 @param, @return, @throws 전혀 없음.

**필요 항목**:
- @param capplm - 대상 신청서 엔티티
- @param approvers - 결재선 목록 (중간결재자 여부 판단용)
- @param currentEno - 현재 요청 사용자 사번
- @param isAdmin - 관리자 여부 플래그
- @return - 회수 가능 여부 (true=허용)
- 예외 미발생 명시

---

### 4. ApplicationService.java - getDashboard() @throws 누락

**파일**: `common/approval/service/ApplicationService.java`
**위치**: L515

**문제**: @param @return 문서화는 되어 있으나 DB 조회 실패 시 전파될 수 있는
DataAccessException 계열 예외에 대한 @throws 없음.
raw Object 배열 캐스팅 실패 시 ClassCastException 가능성 주석도 없음.

**필요 항목**: @throws DataAccessException DB 조회 실패 시 (또는 GlobalExceptionHandler 위임 명시)

---

### 5. ChangeLogEntityListener.java - 전 메서드 JavaDoc 누락

**파일**: `domain/log/ChangeLogEntityListener.java`
**위치**: L43, L51, L65, L69, L84, L98

**문제**: JPA 라이프사이클 리스너 핵심 클래스인데 모든 메서드에 JavaDoc 전혀 없음.

누락 메서드:
- L43: public void onPrePersist(Object entity) - INSERT 전 로그 저장 진입점
- L51: public void onPreUpdate(Object entity) - UPDATE 전 처리 진입점
- L65: public void onPostUpdate(Object entity) - UPDATE 후 처리 진입점
- L69: private void persistLog(...) - 실제 로그 적재 메서드, 가장 복잡한 로직
- L84: private String resolveUpdateType(...) - 생성/수정 타입 판별 로직
- L98: private Field findField(...) - 리플렉션 기반 필드 탐색, null 반환 케이스 설명 필요

**필요 항목** (공통): 각 메서드별 역할, @param, @return, @throws (리플렉션 실패 처리 포함)

---

### 6. NotificationService.java - 복수 메서드 @param 완전 누락

**파일**: `common/notification/service/NotificationService.java`
**위치**: L94, L107, L113, L119, L134

누락 메서드:
- L94:  public long unreadCount(String recipientEno) - @param recipientEno 없음
- L107: public void markRead(String infMngNo, String currentEno) - @param 2개 없음, @throws 없음
- L113: public void markAllRead(String recipientEno) - @param 없음
- L119: public void softDelete(String infMngNo, String currentEno) - @param 2개 없음, @throws 없음
- L134: private Cinfmm loadOwned(String infMngNo, String currentEno) - @param/@return/@throws 모두 없음

---

### 7. AuditLogIdGenerator.java - generate() JavaDoc 완전 누락

**파일**: `domain/audit/AuditLogIdGenerator.java`
**위치**: L22

**문제**: Hibernate ID 생성기 구현체의 핵심 메서드인데 JavaDoc 전혀 없음.
채번 형식(INF-{YYYY}-{8자리 시퀀스}), 시퀀스 이름, 실패 시 동작을 설명해야 함.

---

### 8. AdminLogService.java - 복수 메서드 JavaDoc 누락

**파일**: `common/admin/service/AdminLogService.java`
**위치**: L118, L126, L165, L216

누락 메서드:
- L118: private Object getDefinition(...) - 복잡한 타입 분기 로직이지만 JavaDoc 없음
- L126: private Pageable safePageable(...) - null 방어 로직이지만 @param/@return 없음
- L165: private Object readField(...) - 리플렉션 기반, null 반환 조건 미설명, TODO [B-M-01] 존재
- L216: private boolean isUserField(...) - 필드명 판별 기준 미설명

---

### 9. SsoWebConfig.java - webappDocumentRoot() JavaDoc 누락

**파일**: `config/SsoWebConfig.java`
**위치**: L23

**문제**: @Bean 메서드인데 JavaDoc 없음. 운영/개발 경로 차이 및 경로 선택 기준 설명 필요.

---
## [MISSING-PARAM] @param/@return/@throws 일부 누락 (15건)

### 10. CodeService.java - 조회 메서드 @return 누락

**파일**: `common/code/service/CodeService.java`
**위치**: L38, L51, L64

- L38: getCcodemsByCId(String cId) - @return 없음 (캐시 키 및 반환 타입 설명 필요)
- L51: getCcodem(String cId, String cdva) - @return 없음, @throws (코드 미존재) 없음
- L64: getCcodemsByCTp(String cTp) - @return 없음

---

### 11. CodeService.java - validateBudgetPeriod() @throws 누락

**파일**: `common/code/service/CodeService.java`  위치: L178

**문제**: @param은 있으나 예산기간 유효성 실패 시 throw하는 예외 타입(@throws) 없음.

---

### 12. ApprovalLineDelegate.java - private 복잡 로직 메서드 JavaDoc 누락

**파일**: `common/approval/service/ApprovalLineDelegate.java`  위치: L110, L129

- L110: private buildTargetOccurrences(...) - 결재선 노드 탐색, @param/@return 없음
- L129: private void applyDateToMatchingNodes(...) - 날짜 적용 로직, @param 없음, side-effect 설명 없음

---

### 13. BoardMetaService.java - getOne() @param/@return 누락

**파일**: `common/board/service/BoardMetaService.java`  위치: L39
**메서드**: `public Cblbmm getOne(String blbMngNo)`

**문제**: @param, @return, @throws (미존재 시 예외) 모두 없음.

---

### 14. ApprovalStatus.java - isTerminated(), ofCode() JavaDoc 누락

**파일**: `common/approval/domain/ApprovalStatus.java`

**문제**: 두 메서드 모두 JavaDoc 없음.
isTerminated()의 종료 상태 정의 (APPROVED/REJECTED/INVALIDATED 포함 여부) 미설명.
ofCode()의 null 입력 처리 및 예외 발생 여부 미설명.

---

### 15. DecisionStatus.java - ofCode() JavaDoc 누락

**파일**: `common/approval/domain/DecisionStatus.java`

**문제**: 미존재 코드 입력 시 동작(예외 발생 여부) 설명 없음.

---

### 16. CinfmmRepositoryImpl.java - findInbox() @param 설명 불충분

**파일**: `common/notification/repository/CinfmmRepositoryImpl.java`

**문제**: @param unreadOnly 의미 (true=미읽음만, false=전체) 및 QueryDSL 조건 분기 목적 설명 없음.

---

### 17. BoardCommentService.java - publishMentionNotifications() 진단 로그 제거 계획 미기재

**파일**: `common/board/service/BoardCommentService.java`  위치: L244

**문제**: 메서드 내 [멘션 진단] 접두사 INFO 로그 5건이 존재하나 임시 진단 로그임을 명시하지 않음.
운영 환경에서 PII(사용자 사번) 로그가 남을 수 있음.

**필요 항목**: JavaDoc에 진단 로그 제거 예정 (FIXME 참조) 또는 관련 TODO 번호 명시.

---

### 18. BoardCommentService.java - safe(), abbreviate() JavaDoc 누락

**파일**: `common/board/service/BoardCommentService.java`  위치: L298, L299

**문제**: private 헬퍼 메서드 두 개 모두 JavaDoc 없음.
abbreviate(String s, int max)의 max 초과 시 동작(말줄임 문자 삽입) 미설명.

---

### 19. CouncilService.java - 유니코드 이스케이프 쿼리 파라미터 주석 누락

**파일**: `domain/council/service/CouncilService.java`

**문제**: 쿼리 파라미터에 유니코드 이스케이프 리터럴 사용 이유(인코딩 이슈 방지 목적) 인접 주석 없음.
기존 TODO는 있으나 메서드 JavaDoc에는 미기재.

---

### 20. PlanService.java - @Transactional(readOnly=true) 누락 TODO 설명 불충분

**파일**: `domain/budget/plan/service/PlanService.java`  위치: L40

**문제**: TODO 주석만 있고 왜 누락되었는지, 언제까지 추가할 것인지 설명 없음.
클래스 내 조회 메서드들이 readOnly 트랜잭션 없이 실행 중임.

---

### 21. PlanService.java - JSON 파싱 실패 catch 블록 영향 범위 미기재

**파일**: `domain/budget/plan/service/PlanService.java`  위치: L118

**문제**: 기존 FIXME [B-H-05]가 있으나 예산 보고서 데이터 영향 범위
(기본값 대체 여부, 해당 항목 무시 여부)가 catch 블록에 설명되지 않음.

---

### 22. DevAuthController.java - matchIfMissing=true 위험성 경고 미흡

**파일**: `common/system/DevAuthController.java`

**문제**: 환경변수 미설정 시 기본값이 활성화(true)임을 클래스 주석에 명시하지 않음.
운영 배포 전 비활성화 필요성을 경고하고 있으나 기본이 활성 상태임을 강조하지 않아 실수 여지가 있음.

**필요 항목**: @ConditionalOnProperty 위에 주의 주석 추가 -
matchIfMissing=true이므로 환경변수 미설정 시 이 컨트롤러가 기본 활성화됨.
운영 배포 전 dev-auth.enabled=false 설정 필수.

---

### 23. CostService.java - validateModifyPermission() @param/@throws 불완전

**파일**: `domain/budget/cost/service/CostService.java`  위치: L786

**문제**: 메서드 위에 단일 줄 참조 주석만 있고 @param, @throws, 권한 계층 설명 없음.
ProjectService와 동일 로직이라면 같은 수준의 JavaDoc이 필요함.

---

### 24. CostService.java - 리포지토리 필드 주석 누락

**파일**: `domain/budget/cost/service/CostService.java`  위치: L75~L82 (private final 필드 6개)

**문제**: 필드 선언에 주석 없음. 타 서비스는 각 필드에 한 줄 설명 주석을 달고 있으나 CostService는 전혀 없음.
대상 필드: costRepository, capplaRepository, applicationRepository, ccodemRepository, eventPublisher 등

---
## [MISSING-METHOD] private/내부 메서드 JavaDoc 누락 (12건)

| # | 파일 | 위치 | 메서드명 | 누락 항목 |
|---|------|------|----------|-----------|
| 25 | AdminLogService.java | L118 | getDefinition() | 타입 분기 기준 설명 |
| 26 | AdminLogService.java | L165 | readField() | null 반환 조건, TODO [B-M-01] 연계 |
| 27 | AdminLogService.java | L216 | isUserField() | 판별 대상 필드명 목록 |
| 28 | AdminLogService.java | L126 | safePageable() | null 입력 시 기본값 명시 |
| 29 | BoardCommentService.java | L298 | safe() | null 처리 동작 |
| 30 | BoardCommentService.java | L299 | abbreviate() | max 초과 시 말줄임 동작 |
| 31 | ChangeLogEntityListener.java | L84 | resolveUpdateType() | 생성/수정 판별 기준 |
| 32 | ChangeLogEntityListener.java | L98 | findField() | null 반환 조건 (리플렉션 실패) |
| 33 | ApprovalLineDelegate.java | L110 | buildTargetOccurrences() | 탐색 알고리즘 설명 |
| 34 | ApprovalLineDelegate.java | L129 | applyDateToMatchingNodes() | side-effect 명시 |
| 35 | ProjectService.java | L1041 | buildCodeNameMap() | 기존 JavaDoc 오배치됨 (항목1 수정 필요) |
| 36 | NotificationService.java | L134 | loadOwned() | AccessDeniedException 발생 조건 |

---

## [MISSING-FIELD] 필드 주석 누락 (3건)

### 37. CostService.java - 서비스 필드 설명 전무

**파일**: `domain/budget/cost/service/CostService.java`  위치: L75~L82
6개 private final 필드 모두 주석 없음. (#24 항목과 동일)

---

### 38. PlanService.java - 의존성 필드 주석 없음

**파일**: `domain/budget/plan/service/PlanService.java`  위치: 클래스 상단 필드 블록

**문제**: 서비스 의존성 필드에 주석 없음.
XcrLookupService, BudgetAmountCalculator 같은 비자명한 의존성은 역할 설명이 필요함.

---

### 39. JpaAuditConfig.java - auditorProvider() 내부 주석 영한 혼용

**파일**: `config/JpaAuditConfig.java`  위치: auditorProvider() 메서드

**문제**: 메서드 내부 주석이 영어/한국어 혼용. CLAUDE.md 섹션4.1 기준 모든 신규 주석은 한글이어야 함.
또한 인증 미완료 시 감사 필드에 어떤 값이 기록되는지 (anonymous, null 등) 정책 주석 없음.

---

## [TODO-NOTE] 기존 FIXME/TODO 영향 범위 미기재 (5건)

### 40. AdminLogService.java - TODO [B-M-01] 영향 범위 미기재

**파일**: `common/admin/service/AdminLogService.java`  위치: L165 readField() 메서드

**문제**: null 반환 위험 TODO 주석이 있으나
null 반환 시 호출자(로그 레코드 생성 흐름)에 어떤 영향이 발생하는지 설명 없음.

---

### 41. ApplicationController.java - @Valid 누락 FIXME 3건

**파일**: `common/approval/controller/ApplicationController.java`  위치: 3개 mutating 엔드포인트

**문제**: 코드 내 FIXME 주석으로 @Valid 누락을 인식하고 있으나
Bean Validation 없이 현재 서비스가 운영 중임. TASK.md 등록 권고.

---

### 42. PlanService.java - [B-H-05] 예산보고서 영향 미기재

**파일**: `domain/budget/plan/service/PlanService.java`  위치: L118
기존 FIXME [B-H-05]가 있으나 예산 보고서 영향 범위 미기재. (#21 참조)

---

### 43. BoardCommentService.java - [멘션 진단] 로그 제거 계획 없음

**파일**: `common/board/service/BoardCommentService.java`
위치: publishMentionNotifications() 내 5개 INFO 로그

임시 진단 로그임을 JavaDoc에 명시하지 않음. (#17 참조)

---

### 44. NotificationEventListener.java - [알림 진단] 로그 제거 계획 없음

**파일**: `common/notification/event/NotificationEventListener.java`
위치: L38~L48 onNotificationEvent() 내

**문제**: [알림 진단] 접두사 INFO 로그 3건이 존재하나 임시 진단 로그임을 JavaDoc에 명시하지 않음.
운영 환경에서 recipient=사번, type=코드 형태 로그가 계속 남을 수 있음.

---
## 미분석 파일 목록 (comment-analyzer 추가 점검 권장)

분석 시간상 생략되었거나 표면 검토만 수행된 파일 목록입니다.

  domain/budget/project/controller/ProjectController.java
  domain/budget/cost/controller/CostController.java
  domain/budget/plan/controller/PlanController.java
  domain/council/controller/CouncilController.java
  domain/council/repository/CouncilRepositoryImpl.java
  common/approval/controller/ApprovalController.java
  common/approval/repository/ApplicationRepositoryImpl.java
  common/board/controller/BoardPostController.java
  common/board/controller/BoardCommentController.java
  common/board/repository/BoardPostRepositoryImpl.java
  common/iam/controller/UserController.java
  common/iam/controller/OrganizationController.java
  common/notification/controller/NotificationController.java
  infra/ai/controller/GeminiController.java
  infra/file/controller/FileController.java
  domain/cdp/service/ (전체 미검토)
  domain/cdp/controller/ (전체 미검토)

---

## 검토 완료 파일 (이상 없음)

  ItApplication.java
  config/JwtUtil.java
  config/JwtAuthenticationFilter.java
  config/CustomUserDetails.java
  common/system/AuthService.java
  common/approval/entity/Cappla.java, Capplm.java, Cdecim.java
  exception/GlobalExceptionHandler.java
  infra/file/service/FileService.java
  common/iam/service/LoginAttemptService.java, OrganizationService.java, LoginHistoryService.java
  common/iam/service/UserService.java
  common/admin/service/AdminService.java
  common/board/service/EvaluationService.java
  common/board/service/BoardMetaService.java (getOne 제외)
  domain/council/service/CouncilApprovalService.java
  domain/budget/work/service/BudgetWorkService.java
  domain/budget/status/service/BudgetStatusService.java
  common/system/tiptap/TiptapVariableService.java, TiptapTokenParser.java
  common/util/CookieUtil.java, HtmlSanitizer.java
  domain/entity/BaseEntity.java, domain/log/BaseLogEntity.java
  domain/audit/AuditLogPersister.java, AuditLogId.java
  common/notification/event/NotificationEventListener.java
  common/notification/service/NotificationDispatcher.java
  common/notification/entity/MentionExtractor.java
  common/board/service/ReviewerService.java, ReviewCommentService.java
  domain/budget/document/service/GuideDocService.java, ServiceRequestDocService.java
  common/system/EnvironmentValidator.java, CustomPasswordEncoder.java, ApplicationContextHolder.java
  config/JacksonConfig.java, QuerydslConfig.java, SwaggerConfig.java, SecurityConfig.java
  common/approval/repository/ApplicationMapRepository.java
  domain/budget/project/service/BudgetAmountCalculator.java
  infra/file/FileOwnershipChecker.java, FileValidator.java
  domain/council/service/CouncilApprovalEventListener.java
  domain/council/service/CommitteeService.java, FeasibilityService.java, QnaService.java
  domain/council/service/ResultService.java, ScheduleService.java

---

보고서 종료
저장 경로: C:/it/.review-cache/task1-backend.md