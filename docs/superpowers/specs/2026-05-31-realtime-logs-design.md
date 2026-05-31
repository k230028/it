# 실시간 로그 모니터링 — 설계 문서

- 작성일: 2026-05-31
- 작성자: 브레인스토밍 세션
- 화면 경로: `/admin/realtime-logs`
- 사이드바 위치: `[관리자] > [실시간 로그]` ([상세 로그] 바로 위)

## 1. 배경 / 목적

`TPRMPP_*L` 형태의 모든 변경 로그 테이블(현 20+개, `BaseLogEntity` 상속)을 한 화면에서 흐름으로 관찰할 수 있는 실시간 모니터링 화면을 추가한다. 기존 `[관리자] > [상세 로그]`는 테이블 단위로 검색/필터 중심이고, 본 화면은 "전 도메인의 변경 흐름을 라이브로 본다"는 관제실 성격이다.

## 2. 사용자 / 권한

- 관리자(`ROLE_ADMIN`, `ITPAD001`)만 접근.
- 프론트: `definePageMeta({ middleware: 'admin', layout: 'admin' })`, 사이드바 `admin: true`.
- 백엔드: 컨트롤러 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`.
- View 자체는 Oracle DB 권한으로 `ITPAPP` 사용자에게만 SELECT 허용.

## 3. 핵심 결정

| 항목 | 결정 |
|------|------|
| 갱신 방식 | 자동 폴링 (기본 5초, 3·5·10초 선택, 일시정지 토글) |
| 통합 계층 | Oracle View `V_ITPALL_LOG_FEED` (UNION ALL, 공통 컬럼만) |
| 노출 범위 | 표준 로그 컬럼만. 변경 본문(BEFORE/AFTER)은 본 화면 범위 밖 |
| 화면 구성 | 상단 KPI Strip + 하단 풀폭 라이브 피드 (200건 슬라이딩 윈도우) |
| 디자인 무드 | Dark Ops Console (페이지 스코프, 전역 테마 영향 없음) |
| 인터랙션 | 신규 행 페이드인 + 좌측 액센트 글로우, sparkline, C/U/D 도넛, Top 5 테이블 카드 |

## 4. 데이터 계층

### 4.1 Oracle View 정의

뷰명: **`V_ITPALL_LOG_FEED`**

표준 컬럼(`BaseLogEntity` 기준)만 노출하며 본문/도메인 컬럼은 제외한다.

```sql
CREATE OR REPLACE VIEW V_ITPALL_LOG_FEED AS
SELECT 'TPRMPP_BPROJL' AS LOG_TBL,
       'bprojm'        AS LOG_KEY,
       LOG_HIS_TGR_SNO,
       CHG_DTT_YN,
       CHG_DTM,
       CHG_USID,
       GUID,
       GUID_PRG_SNO,
       FST_ENR_DTM,
       FST_ENR_USID,
       LST_CHG_DTM,
       LST_CHG_USID,
       DEL_YN
  FROM TPRMPP_BPROJL
UNION ALL
SELECT 'TPRMPP_BCOSTL', 'bcostm', LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM,
       CHG_USID, GUID, GUID_PRG_SNO, FST_ENR_DTM, FST_ENR_USID,
       LST_CHG_DTM, LST_CHG_USID, DEL_YN
  FROM TPRMPP_BCOSTL
UNION ALL
-- ... 나머지 *L 테이블 동일 패턴 ...
;
```

- `LOG_TBL` / `LOG_KEY` 상수 컬럼은 통합 후에도 출처 식별 및 드릴다운에 사용.
- `LOG_KEY` 값은 `app/utils/adminLogs.ts`의 `ADMIN_LOG_TABLES[].key`와 일치.
- 향후 `*L` 테이블 추가 시 본 View DDL을 Flyway 마이그레이션으로 갱신.

### 4.2 인덱스

- 각 `*L` 테이블의 `CHG_DTM`에 인덱스 필요. 누락된 테이블은 마이그레이션에 포함.
- 인덱스명: `IX_{POSTFIX}_CHG_DTM` (예: `IX_BPROJL_CHG_DTM`).

### 4.3 마이그레이션 파일

`it_database/migrations/V20260531_001__CreateRealtimeLogView.sql`

내용:
1. 모든 `*L` 테이블 대상 `CHG_DTM` 인덱스 보강 (Oracle은 `EXECUTE IMMEDIATE` + `EXCEPTION WHEN OTHERS THEN NULL` 패턴으로 멱등 처리).
2. `V_ITPALL_LOG_FEED` View `CREATE OR REPLACE`.
3. 재실행 안전(idempotent) 유지.

## 5. 백엔드

### 5.1 패키지 / 파일

```
common/admin/realtime/
├── RealtimeLogController.java    (@RestController, @PreAuthorize hasRole('ADMIN'))
├── RealtimeLogService.java       (@Transactional(readOnly = true))
├── RealtimeLogRepository.java    (네이티브 쿼리)
└── RealtimeLogDto.java           (record 기반)
```

### 5.2 API

`GET /api/admin/realtime-logs`

| 파라미터 | 타입 | 기본값 | 설명 |
|----------|------|--------|------|
| `since` | ISO-8601 | (null) | 이 시각 이후 로그만 반환. 미지정 시 최근 200건 |
| `limit` | int | 200 | 최대 200 제한 |
| `tables` | comma string | (null) | `LOG_KEY` 목록 필터. 예: `bprojm,bcostm` |
| `chgTypes` | comma string | (null) | `C,U,D` 중 부분집합 필터 |

응답 (합성 예시값):

```json
{
  "rows": [
    {
      "logTbl": "TPRMPP_BPROJL",
      "logKey": "bprojm",
      "logSno": 123456,
      "chgTp": "U",
      "chgDtm": "2026-05-31T23:14:06.231",
      "chgUsid": "X000001",
      "guid": "00000000-0000-0000-0000-000000000000",
      "delYn": "N"
    }
  ],
  "serverTime": "2026-05-31T23:14:07.000",
  "tableCounts": { "bprojm": 41, "bcostm": 22, "ccodem": 18 },
  "perMinute": [3, 5, 2, 7, 11, 9]
}
```

- `tableCounts`: 최근 5분 윈도우 기준 `LOG_KEY`별 카운트. Top 5만 클라이언트 사용.
- `perMinute`: 최근 30분 분단위 카운트 배열(최신이 끝). Sparkline용.
- 응답 본문에 변경 내역(JSON, BEFORE/AFTER) 미포함 → PII/대용량 회피.

### 5.3 Repository 쿼리

QueryDSL은 View에 적합하지 않으므로 네이티브 쿼리 사용:

```sql
SELECT LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM,
       CHG_USID, GUID, DEL_YN
  FROM V_ITPALL_LOG_FEED
 WHERE CHG_DTM > :since
   AND (:tables IS NULL OR LOG_KEY IN (:tableList))
   AND (:chgTypes IS NULL OR CHG_DTT_YN IN (:chgTypeList))
 ORDER BY CHG_DTM DESC
 FETCH FIRST :limit ROWS ONLY
```

집계 두 건은 별도 쿼리(`COUNT GROUP BY`)로 분리.

## 6. 프론트엔드

### 6.1 라우팅 / 사이드바

- 페이지: `app/pages/admin/realtime-logs.vue`
- `definePageMeta({ middleware: 'admin', layout: 'admin' })`
- `app/components/AppSidebar.vue` `menuItems` admin 그룹의 `[상세 로그]` 바로 위에 항목 삽입. `admin: true` 플래그, `IconActivity` 아이콘(맥동하는 점).

### 6.2 파일 배치

```
app/pages/admin/realtime-logs.vue
app/composables/useRealtimeLogs.ts
app/components/admin/realtime/
├── RealtimeKpiStrip.vue       — 상단 메트릭 스트립(컨테이너)
├── RealtimeSparkline.vue      — 분당 발생량 SVG
├── RealtimeChgTypeDonut.vue   — C/U/D 분포 도넛 SVG
├── RealtimeTopTables.vue      — Top 5 테이블 랭킹
├── RealtimeFeedTable.vue      — 라이브 피드 (PrimeVue DataTable virtualscroll)
└── RealtimeDetailDrawer.vue   — 우측 슬라이드 패널(요약만, 변경 본문은 후속)
app/utils/realtimeLogs.ts      — LOG_KEY → 한글 라벨 매핑(adminLogs.ts 재사용)
```

### 6.3 Composable: `useRealtimeLogs`

상태:
- `rows: Ref<LogFeedRow[]>` — 슬라이딩 윈도우(최대 200)
- `tableCounts: Ref<Record<string, number>>`
- `perMinute: Ref<number[]>`
- `paused: Ref<boolean>`
- `intervalMs: Ref<3000 | 5000 | 10000>` (기본 5000)
- `loading`, `error`

동작:
- 폴링 주기마다 `since` = 마지막 수신 `chgDtm` 으로 쿼리.
- 신규 행 prepend, 200건 초과 시 tail drop.
- 일시정지 토글 시 polling stop, 재개 시 마지막 `since`로 1회 catch-up 후 polling resume.
- `document.visibilityState === 'hidden'` 진입 시 polling pause, 복귀 시 resume.
- 페이지 언마운트 시 cleanup.
- API 호출은 `$apiFetch` (이벤트 핸들러/타이머 내부 일회성 호출 패턴, `useNotifications` 선례).

### 6.4 페이지 구조

```vue
<template>
  <div class="ops-canvas" data-theme="ops">
    <RealtimeHeader v-model:paused="paused"
                    v-model:interval-ms="intervalMs"
                    :server-time="serverTime" />
    <RealtimeKpiStrip :rows="rows"
                      :per-minute="perMinute"
                      :table-counts="tableCounts" />
    <RealtimeFeedTable :rows="rows"
                       @row-click="openDrawer" />
    <RealtimeDetailDrawer v-model:visible="drawerVisible"
                          :row="selectedRow" />
  </div>
</template>
```

### 6.5 슬라이딩 윈도우

- 최대 200건 유지. 초과 시 가장 오래된 행 제거.
- PrimeVue `DataTable` virtualscroll 사용 → DOM 부담 최소화.

## 7. 디자인 (Dark Ops Console)

### 7.1 격리 원칙

전역 테마(라이트/다크)와 무관하게 본 페이지만 Ops 무드 적용. 루트 요소에 `data-theme="ops"` 부여 후 페이지 스코프 CSS 변수로 처리하여 다른 관리자 화면과 충돌 없음.

### 7.2 토큰

```css
.ops-canvas {
  --ops-bg:        oklch(15% 0.01 250);   /* 깊은 네이비 블랙 */
  --ops-surface:   oklch(20% 0.015 250);
  --ops-border:    oklch(28% 0.015 250);
  --ops-text:      oklch(94% 0.005 250);
  --ops-text-dim:  oklch(65% 0.01 250);
  --ops-accent-c:  oklch(78% 0.16 195);   /* Create — cyan */
  --ops-accent-u:  oklch(82% 0.15 80);    /* Update — amber */
  --ops-accent-d:  oklch(70% 0.18 15);    /* Delete — rose */
  --ops-mono:      'JetBrains Mono', 'D2Coding', ui-monospace, monospace;

  background: var(--ops-bg);
  color: var(--ops-text);
}
```

### 7.3 레이아웃 (1440 기준)

- 상단 헤더 sticky: 좌측에 맥동하는 인디케이터 + "실시간 로그", 중앙에 폴링 주기 셀렉트와 일시정지 토글, 우측에 서버시각(모노스페이스).
- KPI Strip(4 카드): 최근 5분 총 건수 / 분당 sparkline / C·U·D 도넛 / Top 5 테이블 랭킹.
- 라이브 피드: 풀폭 테이블. 컬럼 — `TIME`(mono, ms 포함) / `TBL`(LOG_KEY 라벨 + 코드 칩) / `USER`(사번 mono) / `OP`(C/U/D 색칩) / `GUID`(앞 8자 mono) / `DEL`(N/Y 칩).

### 7.4 모션

- 신규 행: `opacity 0 → 1` + 좌측 액센트 border `width 0 → 3px` (240ms, `cubic-bezier(0.16, 1, 0.3, 1)`).
- 4초 후 글로우 페이드 아웃.
- Sparkline: 새 분 진입 시 마지막 바만 `transform: scaleY()` 애니메이션.
- `@media (prefers-reduced-motion: reduce)`: 모든 모션 비활성. 신규 행은 좌측 border만 즉시 표시.

### 7.5 타이포

- 본문 / 라벨: Pretendard (시스템 기본 유지)
- 타임스탬프 / GUID / 테이블 코드 / 사번 / 카운트 숫자: `--ops-mono`

### 7.6 컴포넌트 베이스

- 라이브 피드: PrimeVue `DataTable` virtualscroll + Pass Through API로 헤더/행 클래스 오버라이드.
- StyledDataTable은 사용하지 않음(라이트 톤 기반이라 톤 충돌).
- Sparkline / Donut: 외부 차트 라이브러리 없이 SVG 자체 구현(50~80라인).

## 8. 보안

- 컨트롤러 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")`.
- 미들웨어는 UX 가드(`middleware/admin.ts`). 보안 경계는 서버.
- 응답 본문에 변경 내역 미포함 → PII 노출 최소화.
- View SELECT 권한은 `ITPAPP` 한정.

## 9. 성능 / 부하

- 관리자 동시 폴링자 수가 적다(추정 1~10). 5초 폴링 × N 관리자 = 분당 12N 쿼리.
- View는 `CHG_DTM DESC ORDER BY` + `FETCH FIRST 200` → 인덱스 활용 시 O(log n) 도달.
- 집계 두 건(최근 5분 GROUP BY, 30분 분단위)도 인덱스 시간범위 스캔.
- 클라이언트 슬라이딩 윈도우 200건, virtualscroll로 DOM 부담 차단.

## 10. 테스트

### 10.1 백엔드 (JUnit + AssertJ + Mockito)

- `RealtimeLogServiceTest` — 쿼리 조립(`since` null/지정, `tables` 필터, `chgTypes` 필터).
- `RealtimeLogControllerTest` — ADMIN 200, USER 403, 미인증 401.
- `RealtimeLogRepositoryIT` — View 존재, 정렬, FETCH FIRST 동작(개발 DB 기준).

### 10.2 프론트엔드 (Vitest)

- `useRealtimeLogs` — 폴링 시작/중지, 신규 행 prepend, 200건 초과 tail drop, `since` 갱신, visibilitychange handler, 일시정지 catch-up.
- 분단위 버킷화 유틸 — perMinute 배열 길이/정렬/0 패딩.

### 10.3 E2E (Playwright)

- 관리자 로그인 → `/admin/realtime-logs` 진입.
- API mock으로 5초 간격 신규 행 푸시 → DOM에 신규 행 등장 검증.
- 일시정지 토글 → 폴링 중단 검증(추가 호출 없음).

## 11. TASK.md 후속 과제 (이번 범위 밖)

- 변경 본문(BEFORE/AFTER JSON) 드릴다운 패널 — 기존 `/admin/logs/[logKey]`와 통합 검토.
- SSE / WebSocket 기반 push 전환(트래픽·관리자 수 증가 시).
- 로그 데이터 보존 정책 / 아카이브 분리 View.
- 사용자별 즐겨찾기 테이블 필터.

## 12. 작업 산출물 체크리스트

- [ ] `it_database/migrations/V20260531_001__CreateRealtimeLogView.sql`
- [ ] `RealtimeLogController` / `Service` / `Repository` / `Dto`
- [ ] `RealtimeLogServiceTest`, `RealtimeLogControllerTest`, `RealtimeLogRepositoryIT`
- [ ] `app/pages/admin/realtime-logs.vue`
- [ ] `app/composables/useRealtimeLogs.ts`
- [ ] `app/components/admin/realtime/*` (6개 컴포넌트)
- [ ] `app/utils/realtimeLogs.ts`
- [ ] `AppSidebar.vue` 메뉴 항목 추가
- [ ] Vitest 단위 테스트
- [ ] Playwright E2E 시나리오
