# Phase 1 — 알림 인프라 + UI (`01-alrm`)

> 마일스톤: M01-NOTIFICATION · 상태: Planned · 작성일: 2026-05-19

## 1. 페이즈 목표
알림 마스터 테이블 `TPRMPP_CINFMM`, 백엔드 알림 API, 결재·게시판 트리거 통합, AppHeader 뱃지/드롭다운 UI를 본 운영 코드에 추가한다. 외부 EAI 시스템 실연동은 본 페이즈 범위 외이며, 어댑터 인터페이스와 Stub 구현만 둔다.

## 2. 접근(Approach) 결정 사항

| 의사결정 | 선택 | 근거 |
|---|---|---|
| 알림 vs 수신자 모델 | **1행 = 1수신자** (`Cinfmm`에 `RCV_USID` 컬럼) | 읽음 상태 보관 단순화, 사용자 확정. 대량 발송은 배치 insert로 흡수 |
| 비동기 발송 | `@TransactionalEventListener(phase=AFTER_COMMIT)` | 결재/게시판 원본 트랜잭션 보호 (`it_backend/CLAUDE.md §5.12.2`) |
| 멘션 파싱 | 정규식 `@\d{4,14}` (사번) 우선 | XSS 면역(HtmlSanitizer 정책과 결합), 사번이 사용자명보다 안정적 |
| 채번 | Oracle `SEQ_CINFMM` + `INF-{YYYY}-{NEXTVAL:08d}` | 결재 `ApplicationService.submit()` line 125-127 `String.format("APF-%s-%08d", year, seq)` 패턴 미러. 게시물·댓글의 4자리 시퀀스 패턴보다 확장성 있음 |
| EAI 발송 | `NotificationDispatcher` 인터페이스 + `StubNotificationDispatcher` 빈 | 실 어댑터 교체 가능 구조, 본 페이즈는 INAPP만 즉시 적재 |
| 실시간성 | **폴링** (라우트 전환 + 60초 인터벌) | Phase 1 MVP, SSE/WebSocket은 별도 마일스톤 |

## 3. 데이터 모델

### 3.1 `TPRMPP_CINFMM` 컬럼 정의

| 컬럼 | 타입 | NULL | 기본값 | 코멘트 |
|---|---|---|---|---|
| `INF_MNG_NO`  | VARCHAR2(32)  | NOT NULL | (PK) | 알림관리번호 (`INF-{YYYY}-{NEXTVAL:08}`) — 결재 `APF-...` 패턴 미러 |
| `INF_TP_C`    | VARCHAR2(3)   | NOT NULL | — | 알림종류구분코드 (Ccodem cId=`CINF_TP`) |
| `INF_TTL`     | VARCHAR2(100) | NULL | — | 알림제목 |
| `INF_CONE`    | VARCHAR2(300) | NULL | — | 알림내용(미리보기) |
| `INF_LNK_URL` | VARCHAR2(300) | NULL | — | 알림연결URL — 클릭 시 이동 경로(앱 내부 라우트) |
| `RCV_USID`    | VARCHAR2(14)  | NOT NULL | — | 수신자사번 |
| `RDD_YN`      | VARCHAR2(1)   | NOT NULL | 'N' | 읽음여부 |
| `RDD_DTM`     | DATE          | NULL | — | 읽음일시 |
| `EAI_SD_TP_C` | VARCHAR2(3)   | NULL | — | EAI발송구분코드 (Ccodem cId=`CEAI_SD_TP`) |
| `EAI_SD_DTM`  | DATE          | NULL | — | EAI발송일시 (NULL=미발송) |
| `EAI_SD_CONE` | VARCHAR2(4000)| NULL | — | EAI발송내용(페이로드 스냅샷, JSON 권장) |
| `DEL_YN`        | VARCHAR2(1)  | — | 'N' | (BaseEntity) 삭제여부 |
| `GUID`          | VARCHAR2(38) | — | UUID | (BaseEntity) |
| `GUID_PRG_SNO`  | NUMBER       | — | 1   | (BaseEntity) |
| `FST_ENR_DTM`   | TIMESTAMP    | — | sysdate | (BaseEntity) JPA Auditing |
| `FST_ENR_USID`  | VARCHAR2(14) | — | — | (BaseEntity) JPA Auditing |
| `LST_CHG_DTM`   | TIMESTAMP    | — | sysdate | (BaseEntity) JPA Auditing |
| `LST_CHG_USID`  | VARCHAR2(14) | — | — | (BaseEntity) JPA Auditing |

### 3.2 인덱스
- `PK_CINFMM` ON (`INF_MNG_NO`)
- `IX_CINFMM_RCV` ON (`RCV_USID`, `DEL_YN`, `RDD_YN`, `FST_ENR_DTM` DESC) — 사용자별 미읽음/최근 알림 조회 핵심 인덱스

> 원본테이블/관리번호 컬럼은 본 페이즈에서 제거되어 별도 인덱스 없음. 운영 가드 대안은 §10 위험 항목 참조.

### 3.3 시퀀스
- `SEQ_CINFMM` START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE

### 3.4 공통코드 시드 (`TPRMPP_CCODEM`)
- `CINF_TP` (알림종류구분)
  - `APPROVAL_REQUEST` 결재요청
  - `APPROVAL_RESULT`  결재결과
  - `MENTION_POST`     게시물 멘션
  - `MENTION_COMMENT`  댓글 멘션
  - `SYSTEM`           시스템 알림
- `CEAI_SD_TP` (EAI발송구분)
  - `INAPP` 사내 인앱 알림
  - `EMAIL` 이메일
  - `SMS`   문자
  - `TALK`  알림톡(INFT)

## 4. 백엔드 설계 (`com.kdb.it.common.notification`)

### 4.1 파일 트리
```
common/notification/
├── entity/
│   └── Cinfmm.java                 ← TPRMPP_CINFMM 매핑
├── repository/
│   ├── CinfmmRepository.java       ← JpaRepository<Cinfmm, String>
│   ├── CinfmmRepositoryCustom.java
│   └── CinfmmRepositoryImpl.java   ← QueryDSL: findByRcvUsid, countUnread
├── service/
│   ├── NotificationService.java    ← 발송/조회/읽음/삭제 비즈니스 로직
│   └── NotificationNumberingService.java ← INF_MNG_NO 채번
├── controller/
│   └── NotificationController.java ← /api/notifications/**
├── dto/
│   └── NotificationDto.java        ← 내부 정적 중첩 (Item, UnreadCount, CreateCommand)
├── dispatcher/
│   ├── NotificationDispatcher.java        ← 발송 전략 SPI
│   └── StubNotificationDispatcher.java    ← INAPP만 적재, EXTERNAL은 로깅
└── event/
    ├── NotificationEvent.java       ← 공용 이벤트
    └── NotificationEventListener.java
```

### 4.2 엔티티 골격 (`Cinfmm.java`)
```java
@Entity
@Table(name = "TPRMPP_CINFMM", comment = "알림 마스터")
@Getter @SuperBuilder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
public class Cinfmm extends BaseEntity {

    @Id
    @Column(name = "INF_MNG_NO", length = 32, nullable = false, comment = "알림관리번호")
    private String infMngNo;

    @Column(name = "INF_TP_C", length = 3, nullable = false, comment = "알림종류구분코드")
    private String infTpC;

    @Column(name = "INF_TTL", length = 100, comment = "알림제목")
    private String infTtl;

    @Column(name = "INF_CONE", length = 300, comment = "알림내용")
    private String infCone;

    @Column(name = "INF_LNK_URL", length = 300, comment = "알림연결URL")
    private String infLnkUrl;

    @Column(name = "RCV_USID", length = 14, nullable = false, comment = "수신자사번")
    private String rcvUsid;

    @Column(name = "RDD_YN", length = 1, nullable = false, comment = "읽음여부")
    private String rddYn;

    @Column(name = "RDD_DTM", comment = "읽음일시")
    private LocalDateTime rddDtm;

    @Column(name = "EAI_SD_TP_C", length = 3, comment = "EAI발송구분코드")
    private String eaiSdTpC;

    @Column(name = "EAI_SD_DTM", comment = "EAI발송일시")
    private LocalDateTime eaiSdDtm;

    @Column(name = "EAI_SD_CONE", length = 4000, comment = "EAI발송내용")
    private String eaiSdCone;

    public void markRead() {
        this.rddYn = "Y";
        this.rddDtm = LocalDateTime.now();
    }

    public void markDispatched(String eaiSdTpC, String payload) {
        this.eaiSdTpC = eaiSdTpC;
        this.eaiSdDtm = LocalDateTime.now();
        this.eaiSdCone = payload;
    }
}
```

### 4.3 Repository 쿼리 핵심
- `JpaRepository<Cinfmm, String>` 표준 CRUD
- Custom (QueryDSL):
  - `Page<Cinfmm> findInbox(String rcvUsid, Boolean unreadOnly, Pageable pageable)`
  - `long countUnread(String rcvUsid)`
  - `int markAllReadByRcvUsid(String rcvUsid)` — `JPAQueryFactory.update(...)` bulk
- 모든 쿼리에 `delYn.eq("N")` 고정.

### 4.4 Service 메서드
| 메서드 | 트랜잭션 | 비고 |
|---|---|---|
| `send(NotificationEvent ev)` | `@Transactional` | 채번 → 엔티티 빌드 → save → dispatcher.dispatch() |
| `listForCurrentUser(...)` | `@Transactional(readOnly=true)` | 본인 `eno`만 |
| `unreadCount()` | `@Transactional(readOnly=true)` | 본인만 |
| `markRead(infMngNo)` | `@Transactional` | 소유자 검증 → 비소유 시 `AccessDeniedException` |
| `markAllRead()` | `@Transactional` | 본인 미읽음 일괄 |
| `softDelete(infMngNo)` | `@Transactional` | 소유자 검증 → `entity.delete()` |

### 4.5 Controller (`/api/notifications`)
- 기본 인증 필요 라우트(SecurityConfig 추가 패턴 불필요). 모든 메서드에서 `@AuthenticationPrincipal`로 본인 식별.
- DTO는 `NotificationDto.Item`, `NotificationDto.UnreadCount` 정적 중첩 + `@Schema(name, description)` 부착.

### 4.6 이벤트 발행 & 리스너 (개념 코드)
```java
applicationEventPublisher.publishEvent(
    NotificationEvent.builder()
        .recipientEno(nextApproverEno)
        .infTpC("APPROVAL_REQUEST")
        .infTtl("결재요청: " + apfNm)
        .infCone(StringUtils.abbreviate(apfNm, 290))
        .infLnkUrl("/approval/" + apfMngNo)
        // 원본 추적 메타는 EAI 페이로드 JSON에 보관 (운영 추적용)
        .eaiPayload(Map.of("source", "CAPPLM", "sourceMngNo", apfMngNo))
        .build()
);

@Component
@RequiredArgsConstructor
public class NotificationEventListener {
    private final NotificationService notificationService;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void on(NotificationEvent ev) {
        try {
            notificationService.send(ev);
        } catch (Exception e) {
            log.warn("Notification send failed: recipient={}, type={}", ev.recipientEno(), ev.infTpC(), e);
        }
    }
}
```

## 5. 결재·게시판 통합 지점

> 코드 다이브 결과 반영 (2026-05-19). 정확한 클래스/메서드/줄번호 기준.

### 5.1 결재요청 알림 (`com.kdb.it.common.approval.service.ApplicationService`)

#### 5.1.1 데이터 모델 확정
- 결재선 엔티티: `Cdecim` (`TPRMPP_CDECIM`), 복합키 `(DCD_MNG_NO, DCD_SQN)`. `DCD_MNG_NO = APF_MNG_NO` 동일 값.
- 핵심 컬럼:
  - `DCD_ENO` VARCHAR2(10) — 결재자 사번 (※ 알림 `RCV_USID`는 VC14, 실제 사번 값 길이는 짧아 호환 OK)
  - `DCD_TP` VARCHAR2(32) — `null=미결재`, `"결재"=처리됨`
  - `DCD_STS` VARCHAR2(32) — `null|"승인"|"반려"`
  - `LST_DCD_YN` VARCHAR2(1) — `'Y'`=최종결재자
- 다음 결재자 식별 로직(재사용):
  ```java
  List<Cdecim> approvers = approverRepository.findByDcdMngNoOrderByDcdSqnAsc(apfMngNo);
  Cdecim next = approvers.stream()
      .filter(a -> a.getDcdTp() == null)
      .findFirst()
      .orElse(null); // null이면 결재선 완료
  ```

#### 5.1.2 발행 지점 — 신청서 등록 직후 (`ApplicationService.submit()` L122-187)
- 시그니처: `public String submit(ApplicationDto.CreateRequest request)`
- 발행 위치: 메서드 끝 `return apfMngNo;` (L186) 직전.
- 케이스 1: 기안자 == 1차 결재자 자동 승인 분기(L179-184)가 실행됐다면 → 2차 결재자(`approvers.get(1).getDcdEno()`)에게 알림.
- 케이스 2: 자동 승인 없었다면 → 1차 결재자(`approvers.get(0).getDcdEno()`)에게 알림.
- 단순화 패턴: 두 케이스를 위 "다음 결재자 식별" 한 줄로 통합.

#### 5.1.3 발행 지점 — 결재 처리 직후 (`ApplicationService.approve()` L217-309)
- 시그니처: `public void approve(String apfMngNo, ApplicationDto.ApproveRequest request)`
- 이미 발행 중인 이벤트: `eventPublisher.publishEvent(new ApprovalCompletedEvent(apfMngNo, newApfSts))` (L307)
  - 발행 조건: 신청서가 "결재완료" 또는 "반려"로 종결될 때만.
  - `ApprovalCompletedEvent(String apfMngNo, String newStatus)` — 이미 record로 존재.
- 알림 처리 분기:
  - **결재완료/반려 → 신청자 알림**: 새 `NotificationEventListener`가 `ApprovalCompletedEvent`를 `@TransactionalEventListener(AFTER_COMMIT)`로 구독해 `RQS_ENO`(신청자)에게 `APPROVAL_RESULT` 발행. **추가 발행 코드 불필요** — 기존 이벤트 그대로 활용.
  - **중간 승인 → 다음 결재자 알림**: `approve()` 메서드 끝(L308 직후, 종결 분기 아닐 때)에 신규 발행 코드 추가. "다음 결재자 식별" 로직으로 다음 차례 식별 후 `publishEvent(new NotificationEvent(...))`. 종결된 경우(`newApfSts != null`)에는 발행하지 않음(이미 종결).

#### 5.1.4 기존 이벤트 패턴 (참고)
- `CouncilApprovalEventListener` (`domain/council/service/CouncilApprovalEventListener.java`)는 `@EventListener` + `@Transactional`(동기) 사용 — 협의회 상태가 결재와 같은 트랜잭션이어야 하므로.
- 알림은 부수 효과이므로 **반드시 `@TransactionalEventListener(phase=AFTER_COMMIT)`** 사용 (CLAUDE.md §5.12.2 명시).

### 5.2 멘션 알림 (`com.kdb.it.common.board.service.*`)

#### 5.2.1 데이터 모델 확정
- `Cblbcm` (`TPRMPP_CBLBCM`) — 게시물. 본문: `NAC_CONE` VARCHAR2(4000), HTML, sanitize 필수. 작성자: `FST_ENR_USID`(BaseEntity).
- `Ccmmtm` (`TPRMPP_CCMMTM`) — 댓글. 본문: `CMMT_CONE` VARCHAR2(4000), HTML, sanitize 필수. 작성자: `FST_ENR_USID`.
- 모든 service 메서드는 `CustomUserDetails user` 파라미터를 받아 작성자 사번을 `user.getEno()`로 식별 가능.

#### 5.2.2 멘션 파싱 유틸 (`common/notification/util/MentionExtractor.java`)
```java
public static Set<String> extractEnos(String htmlContent, String authorEno) {
    if (htmlContent == null) return Set.of();
    // HtmlSanitizer 통과한 HTML에서 @사번 패턴 추출 (HTML 태그 안에는 @사번 패턴이 들어가지 않음)
    Matcher m = Pattern.compile("@(\\d{4,14})").matcher(htmlContent);
    Set<String> enos = new LinkedHashSet<>();
    while (m.find()) {
        String eno = m.group(1);
        if (!eno.equals(authorEno)) {   // 자기 멘션 제외
            enos.add(eno);
        }
    }
    return enos;
}
```
사용자명 fallback(`@홍길동`)은 본 페이즈 범위 외 — 별도 백엔드 사용자 검색 비용. 사번 멘션만 지원.

#### 5.2.3 발행 지점 — 게시물 (`BoardPostService`)
- `createPost(...)` L92-129 — `sanitizedCone` 생성(L102) 후 `postRepository.save(post)`(L127) 직후 `return` 전에 발행.
- `updatePost(...)` L141-154 — `sanitizedCone` 생성(L152) 후 `post.update(...)`(L153) 직후 발행. **변경 감지 후 멘션 차이(추가된 사번만)**만 발행하는 것이 정상 동작이지만 본 페이즈는 단순화: 수정 본문의 모든 멘션을 신규로 간주(중복 발송 가드는 §10 위험 항목 참조).
- `createReply(...)` L183-234 — `sanitizedCone` 생성(L204) 후 `postRepository.save(reply)`(L232) 직후 발행.
- `linkUrl` 구성: `String.format("/board/%s?postId=%s", blbMngNo, nacMngNo)` — 게시판 라우트 규약은 실행 시 프론트엔드 라우트 코드 확인 필요.

#### 5.2.4 발행 지점 — 댓글 (`BoardCommentService`)
- `createComment(...)` L67-95 — `sanitized` 생성(L80) 후 `commentRepository.save(comment)`(L93) 직후 발행.
- `createReply(...)` L109-149 — `sanitized` 생성(L129) 후 `commentRepository.save(reply)`(L147) 직후 발행.
- `updateComment(...)` L160-168 — `comment.updateContent(...)`(L167) 직후 발행. 위와 동일하게 단순화.
- `linkUrl` 구성: 게시물 라우트 + 댓글 앵커 (예: `?postId=...&commentId=...`).

#### 5.2.5 이벤트 타입
- `MENTION_POST` — 게시물(또는 답글) 본문 멘션
- `MENTION_COMMENT` — 댓글(또는 대댓글) 본문 멘션

## 6. 프론트엔드 설계

### 6.1 파일 트리
```
it_frontend/app/
├── components/
│   ├── AppHeader.vue                 ← 기존 placeholder 종 아이콘을 <NotificationBell/>로 교체
│   ├── NotificationBell.vue          ← 종 + 뱃지 + Popover trigger
│   └── NotificationDropdown.vue      ← OverlayPanel/Popover 컨텐츠 (목록, 모두읽음)
├── composables/
│   └── useNotifications.ts           ← 미읽음 카운트, 목록, 폴링, 액션 래퍼
└── types/
    └── notification.ts               ← NotificationItem, NotificationType
```

### 6.2 composable 시그니처
```ts
export interface NotificationItem {
  infMngNo: string;
  infTpC: 'APPROVAL_REQUEST'|'APPROVAL_RESULT'|'MENTION_POST'|'MENTION_COMMENT'|'SYSTEM';
  infTtl: string | null;
  infCone: string | null;
  infLnkUrl: string | null;
  rddYn: 'Y'|'N';
  fstEnrDtm: string; // ISO
}

export function useNotifications() {
  const unreadCount = ref(0);
  const items = ref<NotificationItem[]>([]);
  const loading = ref(false);

  const refresh = async () => { /* GET /api/notifications, /unread-count 병렬 */ };
  const markRead = async (no: string) => { /* PATCH */ };
  const markAllRead = async () => { /* PATCH /read-all */ };
  const remove = async (no: string) => { /* DELETE */ };

  // 라우트 전환 + 60초 인터벌 폴링
  onMounted(() => { refresh(); pollHandle = setInterval(refresh, 60_000); });
  onBeforeUnmount(() => clearInterval(pollHandle));
  watch(() => useRoute().fullPath, refresh);

  return { unreadCount, items, loading, refresh, markRead, markAllRead, remove };
}
```

### 6.3 AppHeader 패치
- 현재 placeholder (`AppHeader.vue` 251-255행):
  ```html
  <button ...>
    <i class="pi pi-bell text-lg"/>
    <span class="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full ..."/>
  </button>
  ```
- 다음으로 교체:
  ```html
  <NotificationBell />
  ```
- `NotificationBell.vue`는 `useNotifications()` 사용. 뱃지는 `unreadCount > 0`일 때만 노출, `unreadCount > 99 ? '99+' : unreadCount`.
- 드롭다운은 PrimeVue `<Popover>` 사용. 행 클릭 시 `markRead(item.infMngNo).then(() => item.infLnkUrl && navigateTo(item.infLnkUrl))`.

### 6.4 에러 처리
- `it_frontend/CLAUDE.md §4.2.1`에 따라 `useToast`로 사용자 메시지 표시. `console.error` 단독 사용 금지.

## 7. 마이그레이션 (`it_database/migrations/V20260520_001__CreateCinfmmTable.sql`) — ✅ 완료

- DDL: 테이블 + PK + 인덱스 1개 (`IX_CINFMM_RCV`) + 시퀀스 (`SEQ_CINFMM`)
- DML: `TPRMPP_CCODEM`에 `CINF_TP` 5건, `CEAI_SD_TP` 4건 시드 INSERT
- 멱등성: Flyway가 성공한 스크립트 재실행을 자동 차단하므로 별도 PL/SQL `EXCEPTION` 가드 미사용 (기존 마이그레이션 패턴과 일치)
- 스키마 prefix `ITPAPP.`, 테이블스페이스 `USERS`, 코멘트 한글 (기존 컨벤션 준수)

## 8. 실행 순서(Task Order) — 작은 단위 커밋 권장

1. **DB**: V20260519_007 마이그레이션 작성 + 로컬 적용, 테이블 생성 확인
2. **백엔드 엔티티/리포지토리**: `Cinfmm`, `CinfmmRepository(+Custom/Impl)` + 단위 테스트 (Repository 슬라이스)
3. **백엔드 서비스/채번**: `NotificationNumberingService`, `NotificationService`, `NotificationDispatcher` 인터페이스 + Stub + 단위 테스트
4. **백엔드 이벤트**: `NotificationEvent`, `NotificationEventListener` + 통합 테스트
5. **백엔드 컨트롤러/DTO**: `NotificationController`, `NotificationDto` + MockMvc 테스트 (소유자 검증 케이스 포함)
6. **결재 통합**: 다음 결재자/신청자 알림 트리거 통합 + 통합 테스트 (`@SpringBootTest`)
7. **게시판 통합**: 게시물/댓글 멘션 추출 + 트리거 통합 + 단위 테스트
8. **프론트엔드 타입/composable**: `types/notification.ts`, `useNotifications.ts` + Vitest 단위 테스트
9. **프론트엔드 UI**: `NotificationBell.vue`, `NotificationDropdown.vue`, `AppHeader.vue` 교체 + Vitest 컴포넌트 테스트
10. **E2E**: 결재 신청 → 다른 사용자 로그인 → 뱃지·드롭다운 → 클릭 이동 (Playwright)
11. **회귀**: `./gradlew test`, `npm test`, `npm run test:e2e`

## 9. 테스트 계획

### 9.1 백엔드 단위
- `NotificationServiceTest`:
  - `send`: 채번/저장/dispatcher 호출
  - `markRead`: 본인이면 RDD_YN/RDD_DTM 갱신 / 타인이면 `AccessDeniedException`
  - `markAllRead`: 본인 미읽음만 일괄 갱신
  - `softDelete`: DEL_YN='Y', 타인 호출 시 거절
- `MentionExtractorTest`: 사번 추출, 중복 제거, 빈 입력, 작성자 자기 멘션 제외
- `CinfmmRepositoryImplTest` (Slice + H2 or Testcontainers): `findInbox`, `countUnread`

### 9.2 백엔드 통합
- `ApprovalNotificationIT`: 결재 신청 후 다음 결재자에게 1건 적재, 커밋 이후 발송 검증
- `BoardMentionNotificationIT`: 게시물에 `@사번` 작성 시 해당 사용자에게 1건 적재
- `NotificationControllerIT` (MockMvc): 모든 엔드포인트 본인/타인 권한 검증, 페이지네이션, 미읽음 카운트

### 9.3 프론트엔드 단위 (Vitest)
- `useNotifications.test.ts`: refresh가 두 엔드포인트 병렬 호출, markRead 후 unreadCount 감소, 폴링 타이머 cleanup
- `NotificationBell.test.ts`: 뱃지 노출 조건, 99+ 처리, Popover 토글

### 9.4 E2E (Playwright)
- `notifications.spec.ts`:
  1. 결재자 A로 로그인, 미읽음 0 확인
  2. 결재 신청자 B로 결재 신청 (테스트 fixture)
  3. A 페이지 리프레시 → 뱃지 1 표시
  4. 종 아이콘 클릭 → 드롭다운에 결재요청 알림 표시
  5. 알림 클릭 → 결재 상세로 이동, 뱃지 0
  6. "모두 읽음" 동작 검증 (멘션 추가 후)

## 10. 위험 및 대응

| 위험 | 영향 | 대응 |
|---|---|---|
| EAI 외부 시스템 미연동 상태 | 운영 시 INAPP만 동작 | `StubNotificationDispatcher`로 명시 + Phase 2에 실 어댑터 분리 |
| **원본 추적 컬럼 미보유** (사용자 결정으로 ORC_TB_CD/ORC_MNG_NO 제외) | (a) 중복 발송 가드 정확도 저하 (b) 원본 취소 시 연쇄 무효화 어려움 (c) 도메인별 통계 집계 어려움 (d) 라우팅 리팩토링 시 기존 URL 깨짐 | (a) 가드는 `INF_LNK_URL + RCV_USID + RDD_YN='N'` 조합으로 근사. 정확도 100%는 아님 (b) 원본 취소 후속 정리는 호출자가 URL `LIKE` 매칭으로 수행 (c) URL prefix(`/approval/`, `/board/`) 기준 GROUP BY (d) `EAI_SD_CONE`에 원본 ID를 JSON 페이로드로 보관해 fallback 추적 (e) 운영 통계 요구 강해지면 후속 페이즈에서 컬럼 추가 검토 |
| ~~결재 도메인 코드 미확인 부분~~ (사전 다이브 완료) | — | **해소됨**. `Cdecim` 컬럼·`ApplicationService.submit()`/`approve()` 시그니처·기존 `ApprovalCompletedEvent` 패턴이 §5.1에 박혔음. 다음 결재자 식별 로직 재사용 가능 |
| 폴링 부하 (3,000명 × 60초 = 50 RPS 최대) | 인덱스 200ms 이내 응답 목표. 운영 모니터링 필요 | Phase 2에서 SSE로 전환 검토. 폴링 인터벌은 환경변수화 |
| 사용자명 멘션 미지원 (사번만) | 기존 사용자가 `@홍길동` 적어도 알림 X | 멘션 입력 UX(드롭다운 사번 선택)는 별도 백로그 |
| 멱등 마이그레이션 안정성 | 재실행 시 오류 가능 | DDL은 PL/SQL `EXCEPTION` 가드, DML은 `MERGE` |

## 11. 후속 백로그 (Phase 2 이후)
- 실시간 push (SSE 또는 WebSocket)
- 알림 종류별 사용자 on/off 설정
- EAI 외부 어댑터 실 구현 (EMAIL/SMS/알림톡)
- 사용자명 멘션 + 멘션 자동완성 UX
- 알림 보존 기간 정책 + 아카이브 배치
- 수정 시 멘션 차이만 발송 (추가된 사번에만 발송, 제거된 사번은 무시) — Phase 1은 단순화로 수정 본문의 모든 멘션을 신규 간주

## 12. 부록 — 사전 코드 다이브 노트 (2026-05-20)

### 12.1 결재 도메인 정리
| 항목 | 결과 |
|---|---|
| 신청서 등록 메서드 | `ApplicationService.submit()` L122-187 |
| 결재 처리 메서드 | `ApplicationService.approve()` L217-309 |
| 결재선 조회 | `ApproverRepository.findByDcdMngNoOrderByDcdSqnAsc(apfMngNo)` |
| 다음 결재자 식별 | `approvers.stream().filter(a -> a.getDcdTp() == null).findFirst()` |
| 기존 이벤트 | `ApprovalCompletedEvent(String apfMngNo, String newStatus)` — record. `approve()` L307에서 발행 중 |
| 기존 리스너 패턴 | `CouncilApprovalEventListener` — `@EventListener` + `@Transactional`(동기). 알림은 다르게 `@TransactionalEventListener(AFTER_COMMIT)` |
| 기안자 자동 승인 분기 | `submit()` L179-184. 1차 결재자가 기안자와 동일하면 자동 승인 + `approvalLineDelegate.doUpdate()` 호출 |

### 12.2 게시판 도메인 정리
| 항목 | 결과 |
|---|---|
| 게시물 본문 컬럼 | `Cblbcm.NAC_CONE` VC4000 HTML, sanitize 필수 |
| 댓글 본문 컬럼 | `Ccmmtm.CMMT_CONE` VC4000 HTML, sanitize 필수 |
| 작성자 식별 | `BaseEntity.FST_ENR_USID` (자동 채워짐). 서비스 레이어에서는 `CustomUserDetails user.getEno()`로 즉시 사용 가능 |
| 게시물 채번 | `String.format("NAC-%d-%04d", year, postRepository.getNextSequenceValue())` |
| 댓글 채번 | `generateCmmtId()` (BoardCommentService 내부 헬퍼) |
| HTML sanitize | `HtmlSanitizer.sanitize(rawHtml)` — 모든 service create/update에서 저장 직전 호출 |

### 12.3 채번 인프라
- 전 도메인 공통 패턴: `@Query("SELECT SEQ_<TABLE>.NEXTVAL FROM DUAL", nativeQuery = true) Long getNextVal()`
- 알림 적용: `CinfmmRepository.getNextVal()` + `String.format("INF-%d-%08d", year, seq)`
- 시퀀스 DDL: `CREATE SEQUENCE SEQ_CINFMM START WITH 1 INCREMENT BY 1 NOCACHE NOCYCLE`

### 12.4 프론트엔드 사전 다이브
- `AppHeader.vue` L251-255 = 종 아이콘 placeholder (빨간 점만 있음) — `<NotificationBell/>`로 교체.
- `ReviewCommentPopover.vue` = 수동 Teleport+위치 계산 패턴. **우리 케이스는 anchor가 명확하므로 PrimeVue `<Popover>` 컴포넌트 직접 사용 권장** (더 짧고 표준적).
- `CouncilStatusBadge.vue`, `AppSidebar.vue` = 뱃지 사용 사례. 우리는 단순히 `<span class="absolute...">` overlay + 카운트 텍스트로 충분.
- API 호출: GET은 `useApiFetch<T>` (반응형), POST/PUT/DELETE는 `$apiFetch` (`it_frontend/CLAUDE.md §4.2`). 인증 쿠키 자동 전송.

### 12.5 채택 정정 사항 (PLAN 본문에 반영 완료)
1. PK 채번 형식: `INF_YYYY{seq}` → **`INF-{YYYY}-{seq:08d}`** (결재 `APF-` 패턴과 일관)
2. §5.1·§5.2 통합 지점: 정확한 클래스명·메서드·줄번호·기존 이벤트(`ApprovalCompletedEvent`) 재활용 명시
3. 멘션 파싱: `authorEno` 파라미터를 받아 자기 멘션 제외 내장
4. §10 결재 도메인 미확인 위험 항목 해소 처리
