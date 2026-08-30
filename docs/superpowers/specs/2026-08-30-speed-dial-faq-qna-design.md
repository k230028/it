# 스피드다이얼 FAQ·Q&A 설계

## 1. 목적과 범위

인증된 사용자가 어느 업무 화면에서든 FAQ를 확인하고 Q&A 문의를 등록할 수 있도록
우측 하단 전역 스피드다이얼을 추가한다.

이번 변경은 이미 운영 중인 범용 게시판을 재사용한다.

| 기능 | 게시판 | 고유 게시판 유형 코드 (`IT_PTL_BLB_TC`) |
| --- | --- | --- |
| FAQ | FAQ | `004` |
| Q&A | Q&A | `005` |

DB 테이블이나 게시판을 새로 만들지 않는다. FAQ와 Q&A는 각각 고유한
`IT_PTL_BLB_TC` 유형 코드로 지정한다. 런타임에는 게시판관리번호를 설정값으로
보관하거나 직접 참조하지 않고, 해당 유형 코드의 활성 게시판을 조회한다.

현재 운영 데이터의 `BLBM-0426`(FAQ), `BLBM-0427`(Q&A)은 초기 데이터 보정
마이그레이션에서만 각각 `004`, `005` 유형으로 지정한다. 이후 게시판관리번호가
변경되거나 게시판이 재생성되어도 새 게시판에 같은 고유 유형을 유지하면 기능은
영향을 받지 않는다. 각 유형은 활성 게시판이 정확히 하나만 존재하도록 관리한다.

범위에 포함하는 내용:

- `AppShell` 기반 전역 스피드다이얼 UI
- 문의 작성용 전용 API와 Q&A 게시글 저장
- FAQ 조회용 전용 API와 다이얼로그
- FAQ/Q&A 고유 게시판 유형 코드와 활성 게시판 단일성 보장
- FAQ 등록 후 활성 시스템관리자 전원에 대한 GWE 메일 알림
- Tiptap 공통 에디터 적용
- 한국어·영어 번역과 단위/API/E2E 검증

범위에 포함하지 않는 내용:

- FAQ·Q&A 전용 신규 테이블
- 기존 게시판의 일반 CRUD 계약 변경
- 로그인 화면의 스피드다이얼 노출
- 관리자 화면의 스피드다이얼 노출

## 2. 현재 구조와 재사용 지점

### 2.1 프론트엔드

인증 화면은 `AppShell`이 사이드바·헤더·본문을 감싼다. 관리자 페이지도 기본
레이아웃을 사용하므로 별도 레이아웃 분기가 아니라 현재 라우트의 `/admin` 접두사로
스피드다이얼 노출 여부를 판정한다. 로그인 레이아웃은 `AppShell` 밖이므로 자동으로
제외된다.

본문 입력은 `components/editor/TiptapEditor.vue`를 사용한다. 이 컴포넌트는
Tiptap HTML을 `v-model`로 주고받고 `readonly` 모드를 지원하므로 문의 입력과 FAQ
본문 표시에 같은 에디터 계약을 적용할 수 있다.

### 2.2 백엔드

범용 게시판은 `BoardPostController` → `BoardPostService` → `BoardPostRepository`
구조로 게시글을 저장하고, 저장 전에 `HtmlSanitizer`로 본문을 정화한다. 스피드다이얼은
범용 게시글 API를 프론트에서 직접 조립하지 않고 `SpeedDialController`와
`SpeedDialService`를 façade로 둔다.

GWE 메일은 `GwePayload`와 `EaiService`를 직접 호출하지 않고 기존
`NotificationOutboxService` → `NotificationDispatcherRouter` 경로를 재사용한다.
알림 채널 `04`가 GWE 메일 채널이며, 발송 실패는 PENDING/FAILED 재시도 경계를
그대로 따른다.

## 3. 컴포넌트와 책임

### 3.1 프론트엔드 컴포넌트

#### `SpeedDial.vue`

- `AppShell`에서 한 번만 마운트한다.
- `route.path.startsWith('/admin')`이면 렌더링하지 않는다.
- 접힌 상태에서는 스피드다이얼 버튼만, 펼친 상태에서는 `문의하기`와
  `자주하는 질문` 버튼을 표시한다.
- 다이얼로그의 업무 상태는 직접 소유하지 않고 `useSpeedDial`에 위임한다.

#### `SpeedDialQnaDialog.vue`

- `ClientOnly` 안에서 `TiptapEditor`를 편집 모드로 표시한다.
- 화면 정보는 읽기 전용으로 표시한다.
  - 화면명: `useMenu().nodeByPath`에서 현재 경로와 일치하는 메뉴명
  - URL: `route.fullPath`
  - 메뉴를 찾지 못하면 현재 라우트 경로를 화면명 fallback으로 사용한다.
- 구분은 `기능 개선`, `오류/결함`, `기타` 세 개의 PrimeVue Checkbox로 표시한다.
  - 업무 구분은 하나만 선택할 수 있게 상호 배타적으로 동작한다.
  - 선택하지 않으면 제출하지 않는다.
- 문의 본문은 비어 있지 않은 의미 있는 Tiptap HTML만 허용한다.
- 이미지·파일 첨부 기능은 스피드다이얼 문의에서는 제공하지 않는다.
- 성공하면 안내 Toast 후 닫고, 실패하면 현재 화면 정보·구분·본문을 유지한다.

#### `SpeedDialFaqDialog.vue`

- FAQ 조회 성공 후 FAQ 제목을 아코디언 항목으로 표시한다.
- 항목 본문은 `TiptapEditor`의 `readonly` 모드로 표시한다.
- 본문을 렌더링하기 전 `isomorphic-dompurify`를 적용한다.
- 조회 중, 빈 결과, 실패·재시도 상태를 분리해 표시한다.

### 3.2 프론트엔드 composable

`useSpeedDial`은 다음을 담당한다.

- `isOpen`, `dialogMode`, 문의 폼 상태
- 현재 화면명·URL 스냅샷 생성
- FAQ 조회(`useApiFetch`)
- Q&A 등록(`$apiFetch`)
- Tiptap 빈 문서 및 입력 길이 검증
- 다이얼로그 닫힘·성공 후 초기화

재조회 실패는 이전 FAQ 데이터를 정상 데이터처럼 유지하지 않고 공통 재조회 오류
상태로 표시한다. 명시적인 재시도는 `$apiFetch` 또는 기존 재조회 가드 계약을
사용한다.

## 4. API 계약

### 4.1 FAQ 조회

`GET /api/speed-dial/faqs`

응답:

```json
[
  {
    "postId": "NAC-2026-0001",
    "title": "예산 입력은 어떻게 하나요?",
    "contentHtml": "<p>...</p>",
    "createdAt": "2026-08-30T10:20:00"
  }
]
```

규칙:

- `IT_PTL_BLB_TC='004'`, `USE_YN='Y'`, `DEL_YN='N'`인 FAQ 게시판을 조회한다.
- FAQ 유형의 활성 게시판이 정확히 하나가 아니면 서버 설정 오류로 처리한다.
- 선택된 FAQ 게시판의 `DEL_YN='N'` 게시글만 조회한다.
- 사용자에게 공개 가능한 게시글만 조회한다.
- 최신 등록순의 안정된 정렬을 사용한다.
- 서버에서 최대 조회 건수를 제한한다.
- 게시글 엔티티 전체를 반환하지 않고 전용 projection/DTO를 사용한다.
- FAQ 유형 게시판이 없거나 비활성이면 공통 Not Found 오류를 반환한다.
- FAQ 유형 게시판이 둘 이상이면 공통 Conflict/설정 오류를 반환하고 임의의
  게시판을 선택하지 않는다.

### 4.2 Q&A 문의 등록

`POST /api/speed-dial/qna`

요청:

```json
{
  "screenName": "정보화사업",
  "screenUrl": "/info/projects?tab=active",
  "category": "IMPROVEMENT",
  "content": "검색 조건을 저장할 수 있으면 좋겠습니다."
}
```

`category` 허용값:

| 값 | 표시명 |
| --- | --- |
| `IMPROVEMENT` | 기능 개선 |
| `BUG` | 오류/결함 |
| `OTHER` | 기타 |

처리 규칙:

- 서버가 `IT_PTL_BLB_TC='005'`, `USE_YN='Y'`, `DEL_YN='N'`인 Q&A 게시판을
  조회하고 클라이언트의 게시판 ID는 받지 않는다.
- Q&A 유형의 활성 게시판이 정확히 하나가 아니면 서버 설정 오류로 처리한다.
- 인증 주체에서 작성자 사번을 결정한다.
- `screenName`, `screenUrl`, `content`의 길이·형식·빈 값을 Bean Validation으로
  검증한다.
- 화면 URL은 단일 `/`로 시작하는 내부 경로만 허용해 외부 링크 저장을 차단한다.
- 서버가 다음 구조로 제목과 본문을 조립한다.

```text
제목: [스피드다이얼 문의] {구분 표시명} - {화면명}

본문:
화면(URL): {화면명} ({화면 URL})
구분: {구분 표시명}
문의 및 요청 내용:
{정화된 Tiptap HTML}
```

- 저장은 기존 `BoardPostService`의 게시글 생성·그룹 초기화·HTML 정화 경로를
  재사용한다.
- 성공 응답은 생성된 Q&A 게시글 관리번호를 반환한다.

## 5. FAQ 등록 메일 알림

### 5.1 발생 조건

기존 `POST /api/boards/{blbMngNo}/posts`를 통한 게시글 등록 중 대상 게시판의
`IT_PTL_BLB_TC='004'`인 경우 FAQ 등록 이벤트를 발행한다. FAQ 게시판 등록
권한은 서버에서 시스템관리자(`ITPAD001`)로 강제한다. FAQ 유형 게시판의 활성
단일성은 게시판 관리 저장 시에도 검증한다.

이벤트에는 게시글 ID, 제목, 정화된 본문, 등록자 사번, FAQ 화면 내부 링크를 담는다.
게시글 저장 트랜잭션의 성공 여부와 이벤트 처리는 분리한다.

### 5.2 커밋 후 발송 흐름

```text
FAQ 게시글 저장
  → FaqRegisteredEvent 발행
  → AFTER_COMMIT 리스너
  → 활성 ITPAD001 보유자 조회
  → 수신자별 NotificationEvent 생성
  → NotificationOutboxService.enqueue(REQUIRES_NEW)
  → NotificationDispatcherRouter 채널 04
  → GWE 메일 발송 또는 기존 재시도
```

활성 시스템관리자는 다음 조건으로 조회한다.

- `CROLEI.ATH_ID='ITPAD001'`
- 역할의 `USE_YN='Y'`, `DEL_YN='N'`
- 사용자 `DEL_YN='N'`
- 중복 사번은 한 번만 발송

수신자 조회가 0명인 경우 FAQ 저장은 성공으로 유지하고 메일만 발송하지 않는다.
메일 제목과 본문은 `MailPayload` JSON으로 전달하며, 본문에는 FAQ 제목·등록자명·FAQ
화면 링크를 포함한다. 본문 길이 예산을 초과하면 기존 알림 계층의 안전한 fallback을
따른다.

메일 아웃박스 적재·전송·재시도 실패는 FAQ 등록 트랜잭션을 롤백하지 않는다. 외부
응답·예외 문자열은 사용자에게 직접 노출하지 않고 기존 공통 오류·로그 정책을 따른다.

## 6. 보안과 데이터 정화

- 서버 권한이 최종 보안 경계다. 프론트의 `/admin` 숨김은 UI 정책일 뿐이다.
- Q&A 등록은 인증 사용자만 가능하다.
- FAQ 조회는 인증 사용자만 가능하며, 공개 게시글 조건을 서버에서 확인한다.
- FAQ 등록은 시스템관리자만 가능하다.
- Q&A 입력 본문과 FAQ 등록 본문은 서버 `HtmlSanitizer`로 저장 전 정화한다.
- FAQ 본문 표시 시 프론트에서도 `isomorphic-dompurify`로 이중 정화한다.
- 화면 URL은 내부 경로만 허용해 Open Redirect·외부 링크 저장을 차단한다.
- Tiptap은 `ClientOnly`로 렌더링해 SSR 환경에서 브라우저 의존 모듈이 실행되지
  않게 한다.
- 게시글 내용·개인정보를 진단 SQL이나 일반 로그에 남기지 않는다.

## 7. 파일 구성 예상

### 백엔드

- `common/speeddial/controller/SpeedDialController.java`
- `common/speeddial/dto/SpeedDialDto.java`
- `common/speeddial/service/SpeedDialService.java`
- FAQ/Q&A 유형 게시판 단일 조회·검증을 담당하는 resolver/repository 확장
- `common/speeddial/event/FaqRegisteredEvent.java`
- `common/speeddial/event/FaqRegisteredEventListener.java`
- 게시판 projection/repository 조회 확장
- 관리자 수신자 조회 repository 확장
- `application*.properties` 설정과 OpenAPI 계약 테스트

### 프론트엔드

- `app/components/layout/SpeedDial.vue`
- `app/components/layout/SpeedDialQnaDialog.vue`
- `app/components/layout/SpeedDialFaqDialog.vue`
- `app/composables/useSpeedDial.ts`
- `app/types/speed-dial.ts`
- `i18n/messages/layout.ts` 또는 전용 `speedDial.ts`
- 관련 Vitest/Playwright 테스트

DB 마이그레이션에는 다음을 포함한다.

- `IT_PTL_BLB_TC` 공통코드 `004`(FAQ), `005`(Q&A) 등록
- 현재 `BLBM-0426`, `BLBM-0427`의 초기 유형 지정
- 두 유형에 활성 게시판이 정확히 하나인지 확인하는 검증 SQL

마이그레이션 이후 애플리케이션 런타임 코드에는 위 게시판관리번호를 하드코딩하지
않는다.

## 8. 오류·상태 처리

| 상태 | 문의 다이얼로그 | FAQ 다이얼로그 |
| --- | --- | --- |
| 초기 | 현재 화면 정보와 빈 Tiptap 문서 | 조회 시작 상태 |
| 입력 오류 | 필드별 안내, API 미호출 | 해당 없음 |
| 조회/등록 중 | 제출 버튼 loading, 입력 유지 | skeleton/loading |
| 성공 | Toast 후 닫기·폼 초기화 | 아코디언 표시 |
| 실패 | 공통 오류 Toast, 입력 유지 | 오류 메시지·재시도 |
| 빈 결과 | 해당 없음 | FAQ 없음 안내 |

FAQ 다이얼로그가 열릴 때마다 불필요한 중복 조회를 만들지 않으며, 명시적 재시도는
독립 요청으로 처리한다. AppShell이 유지되는 KeepAlive 화면 전환에서도 전역 이벤트
리스너나 타이머를 추가하지 않는다.

## 9. 검증 계획

### 백엔드

- `SpeedDialService` 단위 테스트
  - FAQ projection 변환·정렬·상한
  - Q&A 제목/본문 템플릿 조립
  - 허용되지 않은 category·URL·빈 본문 차단
  - FAQ/Q&A 유형 코드 조회와 활성 게시판 단일성 정책
- `BoardPostService` 회귀 테스트
  - FAQ 등록 권한
  - FAQ 이벤트 발행
  - 일반 게시판 등록에는 FAQ 이벤트가 발행되지 않음
- FAQ 이벤트 리스너 테스트
  - 활성 시스템관리자 전원 조회
  - 중복 제거
  - 수신자별 GWE 채널 이벤트 생성
  - 수신자 0명·메일 실패 시 저장과 분리
- Controller MockMvc/OpenAPI 계약 테스트
  - 인증·권한·Bean Validation
  - 응답 schema와 enum/nullable 계약
- 백엔드 Health Stack: `./gradlew test`

### 프론트엔드

- `SpeedDial` 컴포넌트 단위 테스트
  - 일반 경로 노출
  - `/admin` 경로 비노출
  - 펼침·다이얼로그 전환
- `useSpeedDial` 단위 테스트
  - 화면명·URL 자동 입력
  - 구분 단일 선택
  - Tiptap 빈 문서 차단
  - 성공 후 초기화·실패 시 입력 보존
- FAQ/Q&A 다이얼로그 단위 테스트
  - `TiptapEditor` 편집/읽기 전용 계약
  - loading·empty·error·retry 상태
  - HTML 정화 렌더링
- Playwright E2E
  - 일반 화면에서 스피드다이얼 표시
  - 관리자 화면에서 숨김
  - Tiptap으로 문의 작성 후 Q&A API 요청 검증
  - FAQ 조회와 아코디언 표시
- 백엔드 계약 변경 후 `npm run codegen` 및 `npm run codegen:check`
- 프론트엔드 Health Stack: `npm run format:check`, `npm run check`, `npm test`
- CSS 변경 시 `npm run lint:css`, 사용자 흐름 변경 시 `npm run test:e2e`

## 10. 완료 기준

다음 조건을 모두 만족하면 구현 완료로 본다.

1. `/admin`과 로그인 화면을 제외한 인증 화면에서 스피드다이얼을 사용할 수 있다.
2. 문의하기가 현재 화면명·URL·구분·Tiptap HTML을 Q&A 게시판에 저장한다.
3. 자주하는 질문이 `IT_PTL_BLB_TC='004'`인 FAQ 게시판의 최신 활성 글을
   다이얼로그로 표시한다.
4. FAQ 등록 시 활성 시스템관리자 전원에게 GWE 메일 아웃박스가 생성된다.
5. 메일 실패가 FAQ 저장을 롤백하지 않고 재시도 정책으로 남는다.
6. 문의가 `IT_PTL_BLB_TC='005'`인 Q&A 게시판에 저장된다.
7. FAQ/Q&A 유형 게시판의 활성 단일성 및 게시판관리번호 변경 시나리오가
   검증된다.
8. 서버 권한·정화·URL 검증과 관련 회귀 테스트가 통과한다.
9. 프론트·백엔드·OpenAPI 타입·E2E Health Stack이 통과한다.
