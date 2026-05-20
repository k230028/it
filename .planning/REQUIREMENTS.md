# Requirements — 알림(Notification) 기능

## R1. 알림 마스터 테이블 신규 생성
- **R1.1** `TAAABB_CINFMM` 테이블을 신설한다. 명명은 META.md 기준 `C(공통) + INFM(알림) + M(마스터)`을 따른다.
- **R1.2** 모든 컬럼명/타입/길이는 META.md(용어사전)와 DOMAIN.md(도메인사전)를 기반으로 한다.
- **R1.3** 다음 컬럼은 **사용자 요구로 반드시 포함**한다.
  - `EAI_SD_TP_C` VARCHAR2(3) — EAI발송구분코드
  - `EAI_SD_DTM`  DATE       — EAI발송일시
  - `EAI_SD_CONE` VARCHAR2(4000) — EAI발송내용
- **R1.4** `BaseEntity`를 상속해 공통 컬럼(DEL_YN, GUID, FST_ENR_DTM/USID, LST_CHG_DTM/USID)을 자동 포함한다.
- **R1.5** 1행 = 1수신자 구조로 한다. 동일 알림을 N명에게 보낼 때 N행을 생성한다(읽음 상태를 동일 행에 보관).

## R2. 트리거 — 결재요청 알림
- **R2.1** 결재 신청이 생성되어 결재선이 진행될 때, 다음 결재 차례인 결재자에게 알림 1건을 발송한다.
- **R2.2** 결재 신청자(`RQS_ENO`)에게도 결재 완료/반려 시 결과 알림을 발송한다.
- **R2.3** 발송은 `@TransactionalEventListener`로 결재 커밋 이후 비동기 처리한다(원본 결재 트랜잭션을 차단·롤백시키지 않는다).

## R3. 트리거 — 멘션 알림
- **R3.1** 공통 게시판 게시물(`Cblbcm`) 또는 댓글(`Ccmmtm`) 본문에서 멘션 표기(예: `@사번` 또는 `@사용자명`)가 검출되면 해당 사용자에게 알림을 발송한다.
- **R3.2** 멘션 파싱 규약과 식별 규칙(사번 우선·중복 제거·작성자 자기 멘션 제외)은 PLAN에서 확정한다.

## R4. UI — 헤더 알림 뱃지/드롭다운
- **R4.1** `AppHeader.vue`의 기존 placeholder 종 아이콘(현재 빨간 점만 있음)을 실제 알림 컨트롤로 대체한다.
- **R4.2** 미읽음 알림이 1건 이상이면 아이콘에 **숫자 뱃지**를 표시한다. 99 초과는 `99+`로 표기한다.
- **R4.3** 종 아이콘 클릭 시 드롭다운(PrimeVue OverlayPanel/Popover)이 열리며 최근 알림 목록(상위 N건, 기본 20)을 표시한다.
- **R4.4** 드롭다운 항목 클릭 시:
  - 해당 알림을 읽음 처리(`PATCH /api/notifications/{infMngNo}/read`)
  - `INF_LNK_URL`(알림연결URL)이 있으면 해당 경로로 이동
- **R4.5** "모두 읽음" 액션을 제공한다(`PATCH /api/notifications/read-all`).

## R5. API
- **R5.1** `GET /api/notifications` — 인증 사용자의 알림 목록(페이지·필터: 읽음/미읽음).
- **R5.2** `GET /api/notifications/unread-count` — 미읽음 카운트(헤더 뱃지용).
- **R5.3** `PATCH /api/notifications/{infMngNo}/read` — 단건 읽음 처리(소유자 검증).
- **R5.4** `PATCH /api/notifications/read-all` — 본인 미읽음 일괄 읽음.
- **R5.5** `DELETE /api/notifications/{infMngNo}` — Soft Delete(소유자 검증).
- **R5.6** 모든 엔드포인트는 인증 사용자 본인 `RCV_USID` 데이터만 접근 가능(타인 알림 조회·수정·삭제 금지).

## R6. 비기능 요구사항
- **R6.1** 뱃지 조회는 페이지·라우트 전환마다 호출 가능 — 인덱스(`RCV_USID, DEL_YN, RDD_YN`)로 200ms 이내 응답.
- **R6.2** 발송 실패(예: EAI 외부 호출 실패)는 알림 자체 레코드에는 영향 없이 `EAI_SD_DTM=NULL` 상태로 남겨 재시도 가능 구조를 둔다.
- **R6.3** 알림 본문은 plain text로만 저장한다(XSS 면역). 사용자 입력에서 멘션 파싱 후 본문은 절단된 미리보기로 가공.

## 비범위(Out of Scope)
- SSE/WebSocket 실시간 push (Phase 1은 폴링 또는 라우트 전환 기준 조회). 추후 Phase로 분리.
- 사용자별 알림 종류 on/off 설정 화면(추후).
- EAI 외부 시스템 실제 연동(현 단계는 발송 페이로드 적재까지). 외부 어댑터는 인터페이스만 두고 Stub 구현.
