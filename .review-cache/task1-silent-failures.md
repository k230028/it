# Silent Failure / Swallowed Error 탐지 보고서

생성일: 2026-05-26
대상: C:\it (it_backend + it_frontend)
탐지 항목 총계: CRITICAL 1 / HIGH 22 / MEDIUM 14 / LOW 4

---

## TASK.md 등록 후보 (HIGH 이상)

| 번호 | 파일 | 라인 | 심각도 | 요약 |
|------|------|------|--------|------|
| B-H-01 | ChangeLogEntityListener.java | L75-81 | HIGH | 스택트레이스 누락 warn 로그 |
| B-H-02 | ApplicationService.java | L492-504 | HIGH | getApplicationsByIds null 필터 silently 손실 |
| B-H-03 | ProjectService.java | L611-613 | HIGH | null 필터로 프로젝트 silently 손실 |
| B-H-04 | CostService.java | L393-395 | HIGH | null 필터로 비용 항목 silently 손실 |
| B-H-05 | PlanService.java | L118-122 | HIGH | 빈 catch로 예산 건수 0 반환 |
| B-H-06 | GeminiService.java | L103-108 | HIGH | RestClient 타임아웃 미설정 스레드 고갈 위험 |
| F-C-01 | info/projects/form.vue | L604-606 | CRITICAL | 편집 데이터 로드 실패시 빈 폼 표시 데이터 덮어쓰기 위험 |
| F-H-01 | EmployeeSearchDialog.vue | L88-91 | HIGH | 조직도 로드 실패 console.error만 |
| F-H-02 | EmployeeSearchDialog.vue | L204-210 | HIGH | 부서원 목록 실패시 빈 배열 silent fallback |
| F-H-03 | ExcalidrawWrapper.vue | L85-89 | HIGH | exportData 실패시 null 반환 |
| F-H-04 | ExcalidrawWrapper.vue | L150-153 | HIGH | Excalidraw 초기화 실패 console.error만 |
| F-H-05 | useCostListPage.ts | L366-368 | HIGH | 코드 로드 실패 console.error만 |
| F-H-06 | useCostListPage.ts | L987-988 | HIGH | 대량업로드 행 파싱 실패 catch{} 완전 무시 |
| F-H-07 | useEmployeeSearch.ts | L75-77 | HIGH | 직원 검색 실패 console.error만 |
| F-H-08 | useGlobalSearch.ts | L75-79 | HIGH | 글로벌 검색 실패 빈 배열 silent fallback |
| F-H-09 | useHwpxExport.ts | L123-125 | HIGH | SVG 변환 실패시 다이어그램 silently 제거 |
| F-H-10 | useTiptapImageInsertion.ts | L67-69 | HIGH | 업로드 실패시 blob URL 미해제 메모리 누수 |
| F-H-11 | approval/list.vue | L213-214 | HIGH | 결재 처리 실패 console.error만 |
| F-H-12 | approval/[apfMngNo].vue | L48-49 | HIGH | 결재 상세 로드 실패 빈 화면 |
| F-H-13 | board/.../index.vue | L38 | HIGH | catch{} 완전 빈 블록 |
| F-H-14 | budget/report.vue | L170-172 | HIGH | PDF 생성 실패 console.error만 |
| F-H-15 | budget/report.vue | L249-251 | HIGH | 데이터 로드 실패시 PDF 버튼 활성 유지 |
| F-H-16 | info/projects/report.vue | L164-166 | HIGH | PDF 생성 실패 console.error만 |
| F-H-17 | info/projects/report.vue | L199-201 | HIGH | 프로젝트 로드 실패시 PDF 버튼 비활성화 안됨 |
| F-H-18 | info/cost/form.vue | L184-186 | HIGH | 초기 데이터 로드 실패 console.error만 |

---

## 상세 탐지 목록

### it_backend

---

#### C:\it\it_backend\src\main\java\com\kdb\it\domain\log\listener\ChangeLogEntityListener.java

- **L75-81** | HIGH | catch (Exception e) 에서 e.getMessage()만 로깅, 스택트레이스 누락
  - 현황: log.warn 호출시 마지막 인자로 e 대신 e.getMessage() 전달
  - 영향: 예외 발생 위치 추적 불가, 운영 장애 대응 어려움
  - TODO: // TODO: [B-H-01] e.getMessage() 대신 e를 마지막 인자로 전달하여 스택트레이스 포함 필요

- **L92-95** | MEDIUM | catch (IllegalAccessException e) 에서 오류 변수 사용 없이 기본값 반환
  - 영향: 필드 접근 실패 원인 추적 불가
  - TODO: // TODO: [B-M-03] IllegalAccessException 발생 시 원인 로깅 후 기본값 반환 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\domain\log\listener\AuditLogPersister.java

- **L155-162** | MEDIUM | resolveCurrentUserId() 미인증 상태에서 null 반환
  - 기존 주석 // TODO: [B-M-02] 존재, 추적 중

---

#### C:\it\it_backend\src\main\java\com\kdb\it\commonpproval\service\ApplicationService.java

- **L492-504** | HIGH | IllegalArgumentException catch 후 null 반환, stream filter로 silently 손실
  - 현황: 개별 조회 실패시 null 반환 -> .filter(Objects::nonNull) 로 silently 제거
  - 영향: 일부 결재 건이 이유 없이 목록에서 사라짐, 사용자 인지 불가
  - FIXME: // FIXME: [B-H-02] null 반환 대신 Optional 또는 예외 전파로 변경, 최소 warn 로그 추가 필요

- **L385-423** | MEDIUM | bulkApprove 에서 failureCount 항상 0
  - 현황: catch 블록에서 rethrow 후 failureCount++ 도달 불가
  - TODO: // TODO: [B-M-04] failureCount 증가 후 continue 처리로 변경 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\domainudget\project\service\ProjectService.java

- **L611-613** | HIGH | null 반환 후 stream filter로 프로젝트 항목 silently 손실
  - FIXME: // FIXME: [B-H-03] null 필터 패턴 제거, 조회 실패시 예외 전파 또는 warn 로그 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\domainudget\cost\service\CostService.java

- **L393-395** | HIGH | null 반환 후 stream filter로 비용 항목 silently 손실
  - FIXME: // FIXME: [B-H-04] null 필터 패턴 제거, 조회 실패시 예외 전파 또는 warn 로그 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\domainudget\plan\service\PlanService.java

- **L118-122** | HIGH | catch (JsonProcessingException e) {} 완전 빈 블록, 예산 건수 0 반환
  - FIXME: // FIXME: [B-H-05] 빈 catch 블록 제거, JsonProcessingException 로깅 후 BusinessException 전파 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\commondmin\service\AdminLogService.java

- **L165-181** | MEDIUM | readField() 필드 미발견시 null 반환
  - 기존 주석 // TODO: [B-M-01] 존재, 추적 중

---

#### C:\it\it_backend\src\main\java\com\kdb\it\infrai\service\GeminiService.java

- **L103-108** | HIGH | RestClient 빌드시 타임아웃 미설정
  - FIXME: // FIXME: [B-H-06] connectTimeout/readTimeout 설정 필요, 미설정시 스레드풀 고갈 위험

- **L272-278** | MEDIUM | catch (IOException e) { return FilePartResult.skip() } 로그 없이 silent skip
  - TODO: // TODO: [B-M-05] IOException 발생시 warn 로그 추가 후 skip 처리 필요

---

#### C:\it\it_backend\src\main\java\com\kdb\it\common\system\security\JwtAuthenticationFilter.java

- **L127-133** | LOW | catch (Exception ex) 로그 후 필터 체인 계속 진행 (의도적 설계)
  - 판단: 인증 필터 표준 패턴. 변경 불필요

---

#### StubNotificationDispatcher.java + NotificationEventListener.java

- LOW | catch warn-only (의도적 설계)
  - 판단: CLAUDE.md 5.12.2. @TransactionalEventListener(AFTER_COMMIT) 실패해도 비즈니스 트랜잭션 롤백 불가. 변경 불필요

---

### it_frontend

---

#### C:\it\it_frontend\app\components\common\EmployeeSearchDialog.vue

- **L88-91** | HIGH | 조직도 트리 로드 실패시 console.error만 출력, toast 없음 (CLAUDE.md 4.2.1 위반)
  - 영향: 사용자 인지 불가, 빈 트리 표시
  - TODO: // TODO: [F-H-01] console.error 제거, toast.error 알림 및 에러 로거 호출 필요 (CLAUDE.md 4.2.1)

- **L204-210** | HIGH | 부서원 목록 로드 실패시 users.value = [] silent fallback
  - 영향: API 오류인지 빈 부서인지 구분 불가
  - TODO: // TODO: [F-H-02] toast.error 알림 및 에러 로거 추가 필요

---

#### C:\it\it_frontend\app\components\cost\TerminalFormDialog.vue

- **L136-139** | MEDIUM | 통화 목록 로드 실패시 console.warn 후 빈 배열 반환
  - TODO: // TODO: [F-M-01] 통화 목록 로드 실패시 toast.warn 알림 필요

---

#### C:\it\it_frontend\app\components\ExcalidrawWrapper.vue

- **L85-89** | HIGH | exportData() 실패시 null 반환
  - 영향: 다이어그램 저장 silently 실패
  - TODO: // TODO: [F-H-03] null 반환 대신 예외 전파 또는 toast.error, 호출측 null 처리 필요

- **L121-123** | MEDIUM | JSON 파싱 실패 catch {} 완전 빈 블록
  - TODO: // TODO: [F-M-02] catch (e) {}로 변경 후 warn 로그 추가

- **L150-153** | HIGH | Excalidraw 초기화 실패시 console.error만, 빈 에디터 노출
  - TODO: // TODO: [F-H-04] toast.error 알림 및 에러 상태 UI 표시 필요

- **L189-192** | MEDIUM | 씬 복원 실패시 console.error만
  - TODO: // TODO: [F-M-03] warn 로그로 변경, toast 알림 필요

---

#### C:\it\it_frontend\app\composables\useAdminTableEdit.ts

- **L201** | MEDIUM | catch {} 에러 변수 없음, toast는 있으나 로그 없음
  - TODO: // TODO: [F-M-04] catch (e) {}로 변경, 에러 로거 호출 추가 필요

---

#### C:\it\it_frontend\app\composables\useCostListPage.ts

- **L366-368** | HIGH | 코드 로드 실패시 console.error만 (CLAUDE.md 4.2.1 위반)
  - TODO: // TODO: [F-H-05] console.error 제거, toast.error 알림 추가

- **L427-429** | MEDIUM | 직원 검색 실패시 console.error만
  - TODO: // TODO: [F-M-05] toast.error 알림 추가 필요

- **L722-724** | MEDIUM | 삭제 실패 로그에 itMngcNo 식별자 누락
  - TODO: // TODO: [F-M-06] 삭제 실패 로그에 itMngcNo 등 식별자 포함 필요

- **L987-988** | HIGH | 대량업로드 행 파싱 실패 catch {} 완전 무시
  - 영향: 업로드 결과에서 일부 행 silently 누락
  - TODO: // TODO: [F-H-06] catch (e) {}로 변경, 파싱 실패 행 번호와 원인 수집 후 결과 요약에 포함 필요

---

#### C:\it\it_frontend\app\composables\useEmployeeSearch.ts

- **L75-77** | HIGH | 직원 검색 API 실패시 console.error만 (CLAUDE.md 4.2.1 위반)
  - TODO: // TODO: [F-H-07] toast.error 알림 추가, 검색 실패와 결과 없음 상태 구분 필요

---

#### C:\it\it_frontend\app\composables\useGlobalSearch.ts

- **L75-79** | HIGH | 글로벌 검색 실패시 suggestions.value = [] silent fallback
  - TODO: // TODO: [F-H-08] catch (e)로 변경, warn 로그 추가. 인라인 오류 표시 검토

---

#### C:\it\it_frontend\app\composables\useHwpxExport.ts

- **L123-125** | HIGH | Excalidraw SVG 변환 실패시 다이어그램 silently 제거
  - 영향: 내보낸 HWPX 파일에 다이어그램 없음, 데이터 손실
  - TODO: // TODO: [F-H-09] warn 로그 및 toast로 일부 다이어그램 변환 실패 알림 필요

- **L142-145** | MEDIUM | 이미지 fetch 실패시 catch {} null 반환, 로그 없음
  - TODO: // TODO: [F-M-07] catch (e)로 변경, warn 로그 추가

---

#### C:\it\it_frontend\app\composables\usePdfReport.ts

- **L174-178** | MEDIUM | 한글 폰트 로드 실패시 Roboto fallback, 사용자 알림 없음
  - 영향: PDF에 한글 깨짐 가능
  - TODO: // TODO: [F-M-08] warn 로그 추가, toast.warn으로 한글 폰트 미적용 안내 필요

---

#### C:\it\it_frontend\app\composables\useTiptapImageInsertion.ts

- **L67-69** | HIGH | 이미지 업로드 실패시 blob URL 미해제 (메모리 누수) + toast 없음
  - 영향: blob URL 메모리 누수 + 업로드 실패 사용자 인지 불가
  - TODO: // TODO: [F-H-10] finally에서 URL.revokeObjectURL(blobUrl) 호출, catch에서 toast.error 필요

- **L119-122** | MEDIUM | 붙여넣기 이미지 처리 실패시 console.error만
  - TODO: // TODO: [F-M-09] toast.error 알림 추가 필요

- **L144-147** | MEDIUM | 드래그 이미지 처리 실패시 console.error만
  - TODO: // TODO: [F-M-10] toast.error 알림 추가 필요

---

#### C:\it\it_frontend\app\composables\useNotifications.ts

- **L92** | LOW | 알림 폴링 실패 silently 무시 (의도적 설계)
  - 판단: 폴링 특성상 일시적 실패는 다음 주기 자동 복구. 변경 불필요

---

#### C:\it\it_frontend\app\components\TiptapToolbar.vue

- **L226** | MEDIUM | 이미지 업로드 실패시 imageDialogVisible.value = false 누락 + toast 없음
  - TODO: // TODO: [F-M-11] catch에 imageDialogVisible.value = false 추가 및 toast.error 필요

---

#### C:\it\it_frontend\app\components\projects\ResourceTableSection.vue

- **L279-280** | MEDIUM | IOE 코드 fetch 실패시 console.error만
  - TODO: // TODO: [F-M-12] console.error 제거, toast.warn 또는 에러 로거로 변경 필요

---

#### C:\it\it_frontend\app\pages\approval\list.vue

- **L213-214** | HIGH | 결재 처리 실패시 console.error만 (CLAUDE.md 4.2.1 위반)
  - TODO: // TODO: [F-H-11] toast.error 결재 처리 실패 알림 추가 필수

---

#### C:\it\it_frontend\app\pages\approval\[apfMngNo].vue

- **L48-49** | HIGH | 결재 상세 로드 실패시 console.error만, 빈 화면 노출
  - TODO: // TODO: [F-H-12] toast.error 알림 및 목록으로 리다이렉트 필요

---

#### C:\it\it_frontend\app\pages\board\[blbMngNo]\[nacMngNo]\index.vue

- **L38** | HIGH | catch {} 완전 빈 블록 (에러 변수, 로그, toast 모두 없음)
  - 영향: 빈 게시글 페이지 노출, 원인 추적 불가
  - TODO: // TODO: [F-H-13] catch (e) {}로 변경, 에러 로거 및 toast.error 알림, 목록으로 리다이렉트 필요

---

#### C:\it\it_frontend\app\pages\budget\report.vue

- **L170-172** | HIGH | PDF 생성 실패시 console.error만
  - TODO: // TODO: [F-H-14] toast.error 알림 추가

- **L249-251** | HIGH | 예산 데이터 로드 실패시 PDF 버튼 활성 유지
  - TODO: // TODO: [F-H-15] 데이터 로드 실패시 PDF 버튼 비활성화 처리 필요

---

#### C:\it\it_frontend\app\pages\info\projects\form.vue

- **L604-606** | CRITICAL | 편집 모드 데이터 로드 실패시 빈 폼 표시, 기존 데이터 덮어쓰기 위험
  - 영향: 사용자가 빈 폼 저장시 기존 프로젝트 데이터 전체 삭제 위험 (데이터 손실)
  - FIXME: // FIXME: [F-C-01] 편집 데이터 로드 실패시 즉시 toast.error 후 목록 리다이렉트 필수

- **L921-922** | MEDIUM | catch {} 에러 변수 없음
  - TODO: // TODO: [F-M-13] catch (e) {}로 변경, 에러 로거 추가 필요

---

#### C:\it\it_frontend\app\pages\info\projects\report.vue

- **L164-166** | HIGH | PDF 생성 실패시 console.error만
  - TODO: // TODO: [F-H-16] toast.error 알림 추가 필요

- **L199-201** | HIGH | 프로젝트 데이터 로드 실패시 PDF 버튼 비활성화 안됨
  - TODO: // TODO: [F-H-17] 데이터 로드 실패시 PDF 버튼 비활성화 처리 필요

---

#### C:\it\it_frontend\app\pages\info\cost\form.vue

- **L184-186** | HIGH | 비용 폼 초기 데이터 로드 실패시 console.error만 (CLAUDE.md 4.2.1 위반)
  - TODO: // TODO: [F-H-18] toast.error 알림 및 에러 상태 UI 처리 필요

---

## 의도적 silent failure (변경 불필요)

| 파일 | 패턴 | 근거 |
|------|------|------|
| NotificationEventListener.java | @TransactionalEventListener catch warn-only | CLAUDE.md 5.12.2: 알림은 부수효과, 실패해도 비즈니스 트랜잭션 롤백 불가 |
| StubNotificationDispatcher.java | catch RuntimeException warn-only | 동일 |
| JwtAuthenticationFilter.java | catch Exception log-continue | Spring Security 표준 패턴, 이후 미인증 요청은 SecurityConfig가 차단 |
| JwtUtil.java | catch returning false | JWT 검증 실패를 boolean으로 표현하는 올바른 패턴 |
| useNotifications.ts | 폴링 실패 무시 | 폴링 특성상 일시적 실패는 다음 주기에서 자동 복구 |

---

*보고서 생성: Silent Failure Hunter Agent / 2026-05-26*
