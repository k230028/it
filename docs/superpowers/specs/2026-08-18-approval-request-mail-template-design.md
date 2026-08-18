# 결재요청 메일 서식 설계

작성일: 2026-08-18

## 1. 배경

결재요청 알림은 `ApplicationService.publishApprovalRequestNotification`이 발행하고
`NotificationDispatcherRouter.dispatchGwe`가 EAI GWE 채널로 메일 발송한다. 현재 메일 본문은
`mailContents(infmMsgCone)`가 만드는 두 줄짜리 HTML이 전부다.

```html
<p>{알림 본문}</p><p><a href="{프론트URL}/approval/list?tab=pending">결재 화면으로 이동</a></p>
```

결재자가 메일만 보고는 어떤 신청서인지, 규모가 얼마인지 알 수 없어 포탈에 접속해야 한다.
같은 신청서의 PDF 신청서(`it_frontend/app/features/approval/forms/itBudget/`)에는 이미
"예산편성 신청 총괄표"가 있으나 메일에는 반영되어 있지 않다.

2026-08-18 EAI 전문 문자셋을 MS949에서 UTF-8로 전환하면서 한글 1자가 3바이트가 되었고,
GWE 전문의 `CONTENTS` 필드는 4000바이트 고정이다. 본문 설계는 이 예산 안에서 이루어져야 한다.

## 2. 목표

1. 메일 제목을 `[IT정보화포탈] {신청서 제목} 결재 요청` 형식으로 바꾼다.
2. 본문에 신청서 개요(제목·문서번호·신청일자·기안자·작성부서·상세 바로가기)를 담는다.
3. 본문에 신청내용 총괄표(정보화사업/경상사업/전산업무비)를 담는다.
4. 본문 서식을 포탈·PDF 신청서와 같은 계열로 맞춘다.
5. 위 전부를 `CONTENTS` 4000바이트 안에서 처리한다.

## 3. 범위 밖

- 인앱 알림 변경. `ttl`과 `infmMsgCone`은 그대로 두어 알림 목록 표시가 바뀌지 않는다.
- 인앱 클릭 경로(`infmRcdUrl = /approval/list?tab=pending`) 변경. 결재 대기 목록 고정은
  기존 사용자 정책이며 이번 변경은 메일 본문 링크에만 적용한다.
- 결재결과(03)·결재회수(06) 등 다른 알림 종류. 현재 GWE 메일을 쓰는 것은 결재요청(02)뿐이다.
- 첨부파일(GWE `ATT` 필드) 활용.
- `CONTENTS` 필드 폭 확장 요청. EAI 규격 개정이 필요해 별건으로 다룬다.

## 4. 설계 결정

### 4.1 데이터 소스 — 상신 시점 스냅샷 JSON 재사용

`ApplicationService.create()`는 요청 본문의 `apfDtlCone`을 `Capplm.dcdReqInf`에 저장한다.
이 JSON의 구조는 `{ "projects": [...], "costs": [...], "approvalLine": {...} }`이며,
PDF 총괄표가 쓰는 것과 같은 데이터다.

메일도 이 JSON으로 렌더링한다.

- `Bprojm`·`Bcostm` 리포지토리를 새로 참조하지 않는다.
- 상신 시점 스냅샷이므로 PDF 신청서와 값이 어긋나지 않는다.
- 원본이 나중에 바뀌어도 재시도 발송 내용이 달라지지 않는다.

대안으로 발송 시점에 도메인을 재조회하는 안을 검토했으나 기각했다. `common.notification`에서
`domain.budget`을 참조하는 것은 CLAUDE.md가 정한 의존 방향(`domain`·`infra` → `common`)의
역방향이라 SPI를 따로 세워야 하고, 재시도 시점 원본 변경이 메일 내용을 바꾼다.

### 4.2 전달 경로 — `SD_DOC_CONE` 기존 배선 사용

`Cinfmm.SD_DOC_CONE`(발송문서내용, 4000자, 주석상 "외부 발송 페이로드 (JSON 권장)")과
그 배선이 이미 존재하며 GWE 경로만 이를 무시하고 있다.

```
ApplicationService.create()
  └ ApprovalMailRenderer.render(...) → {"subject": ..., "html": ...}
  └ NotificationEvent.sdPayload = 그 JSON                    (기존 필드)
NotificationOutboxService:47   → Cinfmm.sdDocCone 저장        (기존 배선)
NotificationDispatchService:39 → dispatch(row, sdDocCone)     (기존 배선)
NotificationDispatcherRouter.dispatchGwe(notification, sdPayload)
  ├ sdPayload 있음 → 파싱해 SUBJECT·CONTENTS 로 사용
  └ sdPayload 없음 → 기존 mailContents(infmMsgCone) 폴백
```

`NotificationDispatchService`는 성공 시 `markDispatchSent(itPtlSdTc, row.getSdDocCone())`로
같은 값을 되쓰므로 페이로드가 유실되지 않는다.

Flyway 스크립트, 신규 컬럼, 레이어 변경이 모두 필요 없다.

### 4.3 제목과 본문의 분리 — JSON 페이로드

메일 제목은 인앱 제목과 분리한다. 인앱은 `"결재요청: {제목}"`을 유지하고, 메일은
`"[IT정보화포탈] {제목} 결재 요청"`을 쓴다. 포탈 안에서 `[IT정보화포탈]` 접두어는 군더더기다.

분리 방법으로 dispatcher가 제목을 조립하는 안 대신 `sdPayload`를 `{subject, html}` JSON으로
두는 안을 택했다. 결재 업무 문구가 범용 발송 계층에 하드코딩되지 않고, `SD_DOC_CONE` 컬럼
주석의 "JSON 권장"과도 맞는다.

### 4.4 4000바이트 예산 배분

메일 클라이언트가 `<style>` 블록을 자주 제거하므로 CSS는 전부 인라인 `style=` 속성으로 넣는다.
그만큼 바이트를 더 쓰므로 렌더러가 조립하면서 바이트를 세고 예산 안에서 멈춘다.

| 구성 | 처리 |
| --- | --- |
| 신청서 개요 | 필수. 항상 전량 포함 |
| 총괄표 합계 | 필수. 최대 4행(정보화사업·전산업무비·경상사업·합계)이라 저렴 |
| 구분별 목록 | 남는 예산 안에서 한 행씩 채우고 멈춤 |
| 잘린 나머지 | `외 N건 · 전체 보기` 링크로 접음 |

`EaiTextFitter`(2026-08-18 도입)는 최후 안전망으로 남기고 정상 경로에서는 발동하지 않는다.

### 4.5 서식

PDF 신청서 테마(`it_frontend/app/utils/approvalFormPdfTheme.ts`)를 따른다.

| 용도 | 값 |
| --- | --- |
| 타이틀 바·제목 | `#1e3a8a` |
| 표 머리글 배경 | `#f3f4f6` |
| 표 테두리 | `#d1d5db` |

## 5. 메일 내용

### 5.1 제목

```
[IT정보화포탈] {Capplm.dcdReqTtl} 결재 요청
```

### 5.2 본문 구성

1. **타이틀 바** — `결재 요청`
2. **신청서 개요** (라벨-값 2열 표)
   | 항목 | 출처 |
   | --- | --- |
   | 신청서 제목 | `Capplm.dcdReqTtl` |
   | 문서번호 | `Capplm.apfMngNo` |
   | 신청일자 | `Capplm.dcdReqDtm` |
   | 기안자 | `AuthorOrgResolver.resolveCurrent()` (상신자 = 기안자) |
   | 작성부서 | `OrgNameResolver.resolveName(Capplm.dcdReqBbrC)` |
   | 바로가기 | `{app.frontend-url}/approval/{apfMngNo}` |
3. **신청내용 — 합계**
   `구분 | 건수 | 총 예산 | 자본예산 | 일반관리비`
   행 순서: 정보화사업 · 전산업무비 · 경상사업 · 합계. 항목이 없는 구분은 행을 생략한다.
4. **신청내용 — 구분별 목록**
   `순번 | 사업명/계약명 | 총 예산 | 자본예산 | 일반관리비`
   구분 안에서 총 예산 내림차순 정렬. 예산이 허용하는 만큼만 싣는다.

### 5.3 스냅샷 필드 매핑

PDF 총괄표(`useItBudgetApprovalFormPdf.ts`)와 동일하게 계산한다. 값이 어긋나면 같은 신청서의
메일과 PDF가 다른 금액을 보여주게 되므로 이 매핑이 계약이다.

| 구분 | 판별 | 이름 | 총 예산 | 자본예산 | 일반관리비 |
| --- | --- | --- | --- | --- | --- |
| 정보화사업 | `projects` 중 `odnYn != 'Y'` | `abusNm` | `totRqmAmt` | `assetBg` | `costBg` |
| 경상사업 | `projects` 중 `odnYn == 'Y'` | `abusNm` | `totRqmAmt` | `assetBg` | `costBg` |
| 전산업무비 | `costs` 전체 | `cttNm` | `costTotXpAmt` | `assetBg` | `costTotXpAmt - assetBg` |

- 경상사업은 스냅샷에 이미 대표 1건으로 합산되어 들어오므로 메일이 추가로 합산하지 않는다.
- null 금액은 0으로 취급한다.
- 합계 행은 세 구분의 각 열을 그대로 더한다.
- 금액은 천 단위 구분자를 넣고 `원`을 붙인다 (PDF와 동일).

## 6. 컴포넌트

| 클래스 | 패키지 | 책임 |
| --- | --- | --- |
| `ApprovalMailRenderer` | `common.approval.mail` | 신청서 + 스냅샷 → `{subject, html}` |
| `ApprovalMailSnapshot` | `common.approval.mail` | `dcdReqInf` 파싱용 record (projects/costs) |
| `ApprovalMailPayload` | `common.approval.mail` | `{subject, html}` record. dispatcher가 역직렬화 |
| `MailHtml` | `common.approval.mail` | 인라인 CSS 상수, 표·행 조립, HTML 이스케이프, 바이트 계수 |

`ApprovalMailRenderer`는 리포지토리를 주입받지 않는다. 필요한 값은 전부 인자로 받으므로
단위 테스트가 DB 없이 돈다.

JSON 역직렬화는 Jackson 버전 특정 `JsonNode`가 아니라 전용 record로 받는다 (CLAUDE.md §7).

## 7. 오류 처리

- `dcdReqInf`가 null·빈 문자열·파싱 실패이면 총괄표를 생략하고 개요만으로 본문을 만든다.
  파싱 실패는 WARN으로 남기되 상신 트랜잭션을 실패시키지 않는다.
- 렌더링 자체가 실패하면 `sdPayload`를 null로 두어 dispatcher가 기존 폴백 경로를 탄다.
  메일 서식 문제로 결재요청 알림이 유실되지 않는다.
- dispatcher의 `sdPayload` 파싱이 실패해도 같은 폴백을 탄다.

## 8. 테스트

**`ApprovalMailRendererTest`**
- 개요 6개 항목이 모두 본문에 나타난다
- 구분별 합계와 총합계가 스냅샷 값과 일치한다
- 항목이 없는 구분은 합계 행과 목록이 모두 생략된다
- 목록이 총 예산 내림차순으로 정렬된다
- 렌더링 결과가 UTF-8 4000바이트를 넘지 않는다 (대량 항목 입력)
- 예산 초과로 잘리면 `외 N건` 표기가 붙는다
- 사업명에 `<`, `&`, `"`가 있어도 HTML이 깨지지 않는다
- `dcdReqInf`가 null이거나 깨진 JSON이면 개요만 렌더링한다

**`NotificationDispatcherRouterTest`**
- `sdPayload`가 있으면 그 subject·html이 GWE 전문에 실린다
- `sdPayload`가 null이거나 파싱 실패면 기존 `mailContents` 폴백을 쓴다

**`ApplicationServiceTest`**
- 상신 시 발행되는 `NotificationEvent.sdPayload`가 채워진다
- 렌더링 실패가 상신을 실패시키지 않는다

## 9. 검증

- `./gradlew check`
- 로컬 기동 후 상신 → `EAI_WIRE_LOG_LEVEL=DEBUG` 요청 덤프에서 개별부 바이트와
  `물음표(0x3F)=0개` 확인
- 실제 메일 수신 후 서식·링크 확인
