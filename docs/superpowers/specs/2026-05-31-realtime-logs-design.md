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
| 통합 계층 | Oracle View `V_ITPAPP_LOG_FEED` (UNION ALL, 공통 컬럼만) |
| 노출 범위 | 표준 로그 컬럼만. 변경 본문(BEFORE/AFTER)은 본 화면 범위 밖 |
| 화면 구성 | 상단 KPI Strip + 하단 풀폭 라이브 피드 (200건 슬라이딩 윈도우) |
| 디자인 무드 | Dark Ops Console (페이지 스코프, 전역 테마 영향 없음) |
| 인터랙션 | 신규 행 페이드인 + 좌측 액센트 글로우, sparkline, C/U/D 도넛, Top 5 테이블 카드 |
| 증분 커서 | `(chgDtm, logTbl, logSno)` 복합 커서. 동시각 로그 누락 방지 |

## 4. 데이터 계층

### 4.1 Oracle View 정의

뷰명: **`V_ITPAPP_LOG_FEED`**

표준 컬럼(`BaseLogEntity` 기준)만 노출하며 본문/도메인 컬럼은 제외한다.

```sql
CREATE OR REPLACE VIEW V_ITPAPP_LOG_FEED AS
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
- `LOG_TBL` / `LOG_KEY` 목록은 백엔드 `AdminLogService.getTables()`의 허용 로그 정의와도 일치해야 한다.
- 향후 `*L` 테이블 추가 시 본 View DDL을 Flyway 마이그레이션으로 갱신.

### 4.2 인덱스

- 각 `*L` 테이블의 `CHG_DTM`에 인덱스 필요. 누락된 테이블은 마이그레이션에 포함.
- 인덱스명: `IX_{POSTFIX}_CHG_DTM` (예: `IX_BPROJL_CHG_DTM`).
- 실행계획 검증 후 필요 시 `(CHG_DTM, LOG_HIS_TGR_SNO)` 복합 인덱스로 조정한다. `UNION ALL` View의 top-N 정렬이 각 테이블 인덱스를 실제로 활용하는지 `EXPLAIN PLAN`으로 확인한다.

### 4.3 마이그레이션 파일

`it_database/migrations/V20260531_001__CreateRealtimeLogView.sql`

내용:
1. 모든 `*L` 테이블 대상 `CHG_DTM` 인덱스 보강 (Oracle은 `EXECUTE IMMEDIATE` + `EXCEPTION WHEN OTHERS THEN NULL` 패턴으로 멱등 처리).
2. `V_ITPAPP_LOG_FEED` View `CREATE OR REPLACE`.
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
| `cursorLogTbl` | string | (null) | 마지막 수신 행의 `LOG_TBL`. `since`와 함께 증분 커서로 사용 |
| `cursorLogSno` | long | (null) | 마지막 수신 행의 `LOG_HIS_TGR_SNO`. `since`와 함께 증분 커서로 사용 |
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

초기 조회(`since` 미지정)는 최근 200건을 반환한다.

```sql
SELECT LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM,
       CHG_USID, GUID, DEL_YN
  FROM V_ITPAPP_LOG_FEED
 WHERE 1 = 1
   -- tables/chgTypes 필터는 값이 있을 때만 동적 추가
 ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC
 FETCH FIRST :limit ROWS ONLY
```

증분 조회는 `(CHG_DTM, LOG_TBL, LOG_HIS_TGR_SNO)` 복합 커서를 사용한다. `CHG_DTM`만 사용하면 같은 시각에 여러 테이블에서 생성된 로그가 누락될 수 있다.

```sql
SELECT LOG_TBL, LOG_KEY, LOG_HIS_TGR_SNO, CHG_DTT_YN, CHG_DTM,
       CHG_USID, GUID, DEL_YN
  FROM V_ITPAPP_LOG_FEED
 WHERE (
       CHG_DTM > :since
    OR (CHG_DTM = :since AND LOG_TBL > :cursorLogTbl)
    OR (CHG_DTM = :since AND LOG_TBL = :cursorLogTbl AND LOG_HIS_TGR_SNO > :cursorLogSno)
 )
   -- tables/chgTypes 필터는 값이 있을 때만 동적 추가
 ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC
 FETCH FIRST :limit ROWS ONLY
```

집계 두 건은 별도 쿼리(`COUNT GROUP BY`)로 분리.

`tables`와 `chgTypes`는 Repository로 넘기기 전에 Service에서 검증한다.

- `tables`: 백엔드 로그 정의(`AdminLogService.getTables()` 또는 동일 원천에서 분리한 허용 목록)에 존재하는 `LOG_KEY`만 허용.
- `chgTypes`: `C`, `U`, `D`만 허용.
- 빈 문자열/빈 배열은 필터 없음으로 처리.
- 네이티브 쿼리의 `IN (:list)` + null 분기 조합은 피하고, 값이 있을 때만 `IN` 절을 동적으로 추가한다.
- 동일 시각 로그가 뒤늦게 커밋될 가능성을 줄이기 위해 클라이언트는 `(logTbl, logSno)` 기준으로 중복 제거한다. 운영 중 `CHG_DTM` 정밀도가 초 단위로 확인되면 증분 조회는 최근 커서 시각에서 1~2초를 겹쳐 조회하는 overlap 전략으로 보강한다.

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
- 폴링 주기마다 마지막 수신 행의 `(chgDtm, logTbl, logSno)`를 커서로 쿼리.
- 신규 행 prepend, 200건 초과 시 tail drop.
- 일시정지 토글 시 polling stop, 재개 시 마지막 복합 커서로 1회 catch-up 후 polling resume.
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
- View는 `ORDER BY CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC` + `FETCH FIRST 200`로 최신 구간만 조회한다.
- 집계 두 건(최근 5분 GROUP BY, 30분 분단위)도 인덱스 시간범위 스캔.
- 클라이언트 슬라이딩 윈도우 200건, virtualscroll로 DOM 부담 차단.
- `UNION ALL` View의 정렬/limit 실행계획은 마이그레이션 적용 후 `EXPLAIN PLAN`으로 검증한다. 각 테이블 `CHG_DTM` 인덱스가 사용되지 않으면 View 내부 top-N 전략 또는 복합 인덱스 조정을 후속 처리한다.

## 10. 테스트

### 10.1 백엔드 (JUnit + AssertJ + Mockito)

- `RealtimeLogServiceTest` — 쿼리 조립(`since` null/지정, `tables` 필터, `chgTypes` 필터).
- `RealtimeLogServiceTest` — 복합 커서 `(chgDtm, logTbl, logSno)` 생성/갱신, 동일 `chgDtm` 로그 누락 방지.
- `RealtimeLogServiceTest` — `tables`, `chgTypes` allowlist 검증 및 빈 필터 처리.
- `RealtimeLogControllerTest` — ADMIN 200, USER 403, 미인증 401.
- `RealtimeLogRepositoryIT` — View 존재, 결정적 정렬, FETCH FIRST 동작(개발 DB 기준).
- `RealtimeLogRepositoryIT` — `V_ITPAPP_LOG_FEED`의 `LOG_KEY`/`LOG_TBL` 목록이 백엔드 로그 테이블 정의와 일치하는지 검증.
- DB 검증 — `EXPLAIN PLAN`으로 최근 200건 조회와 최근 5분/30분 집계의 인덱스 사용 여부 확인.

### 10.2 프론트엔드 (Vitest)

- `useRealtimeLogs` — 폴링 시작/중지, 신규 행 prepend, 200건 초과 tail drop, 복합 커서 갱신, visibilitychange handler, 일시정지 catch-up.
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
