# 백엔드 한글 주석 추가/수정 완료 목록

생성일: 2026-05-26
처리 범위: task1-backend.md + task1-silent-failures.md (백엔드 부분)
처리 방식: 코드 자체(비즈니스 로직) 수정 없이 주석만 추가/수정

---

## 처리 결과 (파일경로 | 라인 | 처리 내용)

domain/budget/project/service/ProjectService.java | L1096 | [MISMATCH] validateModifyPermission() JavaDoc이 메서드 직전 올바른 위치에 존재 — MISMATCH 해소 확인
domain/budget/project/service/ProjectService.java | L659 | [MISMATCH] enrichProjectListBatch() JavaDoc이 메서드에 올바르게 연결 — 고아 JavaDoc 없음 확인
common/approval/service/ApplicationService.java | L661 | [MISSING-CRITICAL] canRecall() — @param capplm/approvers/currentEno/isAdmin, @return 회수 가능 여부, 예외 미발생 명시 완비
common/approval/service/ApplicationService.java | L515 | [MISSING-CRITICAL] getDashboard() — @throws DataAccessException DB 조회 실패 시 (GlobalExceptionHandler 위임) 완비
domain/log/listener/ChangeLogEntityListener.java | L43 | [MISSING-CRITICAL] onPrePersist() — @param entity, LogTarget 없는 경우 처리 안함 설명 완비
domain/log/listener/ChangeLogEntityListener.java | L51 | [MISSING-CRITICAL] onPreUpdate() — @param entity, 중복 방지 로직 설명 완비
domain/log/listener/ChangeLogEntityListener.java | L65 | [MISSING-CRITICAL] onPostUpdate() — @param entity, inFlightEntities 정리 설명 완비
domain/log/listener/ChangeLogEntityListener.java | L69 | [MISSING-CRITICAL] persistLog() — @param entity/chgTp, 예외 삼킴 정책 완비
domain/log/listener/ChangeLogEntityListener.java | L84 | [MISSING-CRITICAL] resolveUpdateType() — @param entity, @return D/U 기준, DEL_YN 리플렉션 설명 완비
domain/log/listener/ChangeLogEntityListener.java | L98 | [MISSING-CRITICAL] findField() — @param clazz/name, @return null 반환 조건 완비
common/notification/service/NotificationService.java | L94 | [MISSING-CRITICAL] unreadCount() — @param currentEno 완비
common/notification/service/NotificationService.java | L107 | [MISSING-CRITICAL] markRead() — @param infMngNo/currentEno, @throws AccessDeniedException/IllegalArgumentException 완비
common/notification/service/NotificationService.java | L113 | [MISSING-CRITICAL] markAllRead() — @param currentEno 완비
common/notification/service/NotificationService.java | L119 | [MISSING-CRITICAL] softDelete() — @param infMngNo/currentEno, @throws AccessDeniedException/IllegalArgumentException 완비
common/notification/service/NotificationService.java | L134 | [MISSING-CRITICAL] loadOwned() — @param infMngNo/currentEno, @return 검증 통과 엔티티, @throws 2종 완비
domain/log/id/AuditLogIdGenerator.java | L22 | [MISSING-CRITICAL] generate() — 채번 흐름, @param session/object, @return Long, @throws RuntimeException/IllegalStateException 완비
common/admin/service/AdminLogService.java | L118 | [MISSING-CRITICAL] getDefinition() — @param key, @return LogDefinition, @throws IllegalArgumentException 미등록 키 완비
common/admin/service/AdminLogService.java | L126 | [MISSING-CRITICAL] safePageable() — @param pageable, @return 범위 보정된 Pageable, NPE 경고 완비
common/admin/service/AdminLogService.java | L165 | [MISSING-CRITICAL] readField() — @param entity/fieldName, @return null 반환 조건, @throws IllegalStateException 완비
common/admin/service/AdminLogService.java | L216 | [MISSING-CRITICAL] isUserField() — @param fieldName, @return 판별 결과, 판별 대상 패턴 목록 완비
config/SsoWebConfig.java | L23 | [MISSING-CRITICAL] webappDocumentRoot() — bootRun/IDE 경로 탐색 방식, @return 완비
common/code/service/CodeService.java | L38 | [MISSING-PARAM] getCcodemsByCId() — @return 빈 리스트 반환 포함 완비
common/code/service/CodeService.java | L51 | [MISSING-PARAM] getCcodem() — @return, @throws IllegalArgumentException 미존재/기간 초과 완비
common/code/service/CodeService.java | L64 | [MISSING-PARAM] getCcodemsByCTp() — @return 완비
common/code/service/CodeService.java | L178 | [MISSING-PARAM] validateBudgetPeriod() — @throws CustomGeneralException/IllegalArgumentException 완비
common/approval/service/ApprovalLineDelegate.java | L110 | [MISSING-PARAM] buildTargetOccurrences() — @param allApprovers/approvedItems, @return occurrence 집합 맵, 알고리즘 설명 완비
common/approval/service/ApprovalLineDelegate.java | L129 | [MISSING-PARAM] applyDateToMatchingNodes() — @param approvalLineNode/targetOccurrences, @return boolean, 부수효과(ObjectNode 직접 수정) 명시 완비
common/board/service/BoardMetaService.java | L39 | [MISSING-PARAM] getOne() — @param blbMngNo, @return BoardMetaDto.Response, @throws CustomGeneralException 완비
common/approval/domain/ApprovalStatus.java | L48 | [MISSING-PARAM] isTerminated() — 종료 상태 3가지(COMPLETED/REJECTED/RECALLED) 정의, IN_PROGRESS 비종료 명시 완비
common/approval/domain/ApprovalStatus.java | L27 | [MISSING-PARAM] ofCode() — @param code 예시, @throws IllegalArgumentException null 포함 미등록 코드 완비
common/approval/domain/DecisionStatus.java | L24 | [MISSING-PARAM] ofCode() — @param code 예시, @throws IllegalArgumentException 미존재 코드 완비
common/notification/repository/CinfmmRepositoryImpl.java | L28 | [MISSING-PARAM] findInbox() — @param unreadOnly true=미읽음만/false 또는 null=전체 완비
common/board/service/BoardCommentService.java | L240 | [MISSING-PARAM] publishMentionNotifications() — 임시 진단 로그 5건 PII 노출 위험 경고 + FIXME 완비
common/board/service/BoardCommentService.java | L298 | [MISSING-PARAM] safe() — @param s, @return null이면 빈 문자열 완비
common/board/service/BoardCommentService.java | L299 | [MISSING-PARAM] abbreviate() — @param s/max, @return 말줄임 처리 규칙, max 초과 시 동작 완비
domain/council/service/CouncilService.java | L90 | [MISSING-PARAM] 유니코드 이스케이프 사용 이유(Oracle EUC-KR 인코딩 방지) + TODO 교체 계획 완비
domain/budget/plan/service/PlanService.java | L40 | [MISSING-PARAM] @Transactional(readOnly=true) 누락 배경 + 추가 계획 TODO 완비
domain/budget/plan/service/PlanService.java | L118 | [MISSING-PARAM] FIXME [B-H-05] 예산 보고서 카운트 0 폴백 — 잘못된 보고서 산출 위험 영향 범위 완비
common/system/controller/DevAuthController.java | L46 | [MISSING-PARAM] matchIfMissing=true 경고 — 환경변수 미설정 시 기본 활성화, 운영 배포 전 비활성화 필수 완비
domain/budget/cost/service/CostService.java | L786 | [MISSING-PARAM] validateModifyPermission() — @param creatorEno/resourceBbrC, @throws AccessDeniedException, 3단계 권한 계층 완비
domain/budget/cost/service/CostService.java | L75 | [MISSING-FIELD] costRepository 주석 완비
domain/budget/cost/service/CostService.java | L76 | [MISSING-FIELD] btermmRepository 주석 완비
domain/budget/cost/service/CostService.java | L78 | [MISSING-FIELD] capplaRepository 주석 완비
domain/budget/cost/service/CostService.java | L80 | [MISSING-FIELD] capplmRepository 주석 완비
domain/budget/cost/service/CostService.java | L82 | [MISSING-FIELD] corgnIRepository 주석 완비
domain/budget/cost/service/CostService.java | L84 | [MISSING-FIELD] cuserIRepository 주석 완비
domain/budget/cost/service/CostService.java | L86 | [MISSING-FIELD] cdecimRepository 주석 완비
domain/budget/cost/service/CostService.java | L88 | [MISSING-FIELD] ccodemRepository 주석 완비
domain/budget/plan/service/PlanService.java | L47 | [MISSING-FIELD] bplanmRepository 주석 완비
domain/budget/plan/service/PlanService.java | L49 | [MISSING-FIELD] bprojaRepository 주석 완비
domain/budget/plan/service/PlanService.java | L51 | [MISSING-FIELD] projectService 주석 완비
domain/budget/plan/service/PlanService.java | L53 | [MISSING-FIELD] costService 주석 완비
domain/budget/plan/service/PlanService.java | L55 | [MISSING-FIELD] codeService 주석 완비
domain/budget/plan/service/PlanService.java | L57 | [MISSING-FIELD] cuserIRepository 주석 완비
domain/budget/plan/service/PlanService.java | L59 | [MISSING-FIELD] objectMapper 주석 완비
config/JpaAuditConfig.java | L57 | [MISSING-FIELD] auditorProvider() 내부 주석 한글화, 비인증 시 Optional.empty() 정책 명시 완비
common/admin/service/AdminLogService.java | L165 | [TODO-NOTE] TODO [B-M-01] — null 반환 시 호출부 NPE 위험 + Optional 변환 권장 영향 범위 완비
common/approval/controller/ApplicationController.java | L148 | [TODO-NOTE] FIXME — submit() @Valid 누락 Bean Validation 미동작 + CLAUDE.md §5.5.2 참조 완비
common/approval/controller/ApplicationController.java | L176 | [TODO-NOTE] FIXME — approve() @Valid 누락 Bean Validation 미동작 + CLAUDE.md §5.5.2 참조 완비
domain/budget/plan/service/PlanService.java | L127 | [TODO-NOTE] FIXME [B-H-05] — 스냅샷 파싱 실패 영향(잘못된 예산 보고서) 범위 완비
common/board/service/BoardCommentService.java | L242 | [TODO-NOTE] FIXME — [멘션 진단] INFO 로그 5건 PII(사번) 노출, 운영 배포 전 제거 계획 완비
common/notification/event/NotificationEventListener.java | L40 | [TODO-NOTE] FIXME — [알림 진단] INFO 로그 3건 PII(사번) 노출, 운영 배포 전 제거 계획 완비
domain/log/listener/ChangeLogEntityListener.java | L108 | [B-H-01] FIXME — e.getMessage() 대신 e 인자 전달로 스택트레이스 포함 필요 완비
domain/log/listener/ChangeLogEntityListener.java | L135 | [B-M-03] TODO — IllegalAccessException 발생 시 원인 로깅 후 기본값(U) 반환 필요 완비
common/approval/service/ApplicationService.java | L500 | [B-H-02] FIXME — null 반환 대신 Optional 또는 예외 전파, 최소 warn 로그 추가 필요 완비
domain/budget/project/service/ProjectService.java | L612 | [B-H-03] FIXME — null 필터 패턴 제거, 조회 실패 시 예외 전파 또는 warn 로그 필요 완비
domain/budget/cost/service/CostService.java | L402 | [B-H-04] FIXME — null 필터 패턴 제거, 조회 실패 시 예외 전파 또는 warn 로그 필요 완비
domain/budget/plan/service/PlanService.java | L127 | [B-H-05] FIXME — 빈 catch 블록 제거, JsonProcessingException 로깅 후 BusinessException 전파 필요 완비
infra/ai/service/GeminiService.java | L103 | [B-H-06] FIXME — connectTimeout/readTimeout 설정 필요, 미설정 시 스레드풀 고갈 위험 완비
infra/ai/service/GeminiService.java | L277 | [B-M-05] TODO — IOException 발생 시 warn 로그 추가 후 skip 처리 필요 완비
