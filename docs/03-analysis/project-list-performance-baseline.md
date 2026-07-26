# 사업 카드 목록 성능 기준선 (FE-04)

측정일: 2026-07-26  
대상: 사업계획(`/project/bizplan`), 소요예산 산정(`/project/estimate`), 정보화실무협의회(`/info/council-request`)

## 목적과 수용 기준

FE-04는 API 전체 조회 크기를 바꾸지 않고, 필터·정렬이 끝난 결과에서 카드 DOM만 20건씩 점진 노출한다. 수용 기준은 최초 카드 DOM 20개 이하와 필터 입력 후 다음 paint까지 100ms 이하이다. 서버 페이지네이션 후속 과제는 1,000건 응답 본문이 1MB 초과이거나, 인증된 로컬 실서버 응답 p95가 500ms 초과할 때만 High로 등록한다.

## 재현 방법

임시 Playwright 하네스 `tests/e2e/project-list-baseline.tmp.spec.ts`를 각 측정 후 삭제한다. 기존 `playwright.config.ts`의 Chromium 프로젝트와 실제 Nuxt 화면을 사용하고, 각 목록 API만 route fixture로 대체했다. 따라서 아래 시간은 **합성 응답의 전송·파싱·클라이언트 렌더링 측정**이며 서버 응답 시간 또는 서버 p95가 아니다.

```powershell
cd C:\it\it_frontend\.worktrees\frontend-backlog-remediation
npm run test:e2e -- tests/e2e/project-list-baseline.tmp.spec.ts --project=chromium
```

- 데이터 형태: 현재 TypeScript DTO의 필수/목록 표시 필드를 유지한 JSON 배열이다. 사업계획은 `abusMngNo`, `abusNm`, 부서/연도/금액/상태/최종변경일시, 산정은 문서·연계번호/사업명/금액/기간/부서/상태/요청일시, 협의회는 협의회·사업 식별자/상태/유형/일정/예산/부서/설명/신청여부를 채웠다.
- 각 화면·100/500/1,000건 조합을 독립 탐색으로 3회 반복했다.
- first card render: 탐색 직전부터 첫 `.v3-card`가 보일 때까지의 벽시계 시간(첫 실행의 Nuxt dev cold-start 영향을 중앙값으로 완화).
- DOM nodes: 첫 카드가 보인 직후 `document` 하위 전체 요소 수. 카드 수는 별도로 기록했다.
- filter → next paint: `사업명 검색` 입력에 `합성 사업 0`을 채운 순간부터 다음 `requestAnimationFrame`까지다.
- bytes: `Buffer.byteLength(JSON.stringify(fixture))`로 계산한 응답 본문 바이트다. gzip/네트워크 전송량이 아니다.

## 변경 전 합성 측정 중앙값

| 화면 | 건수 | 본문 bytes | first card render (ms) | 전체 DOM nodes | 카드 수 | filter → next paint (ms) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 사업계획 | 100 | 18,501 | 970 | 2,833 | 100 | 32.7 |
| 사업계획 | 500 | 92,501 | 1,292 | 12,833 | 500 | 78.4 |
| 사업계획 | 1,000 | 185,001 | 1,575 | 25,344 | 1,000 | 442.5 |
| 소요예산 산정 | 100 | 28,301 | 1,005 | 2,847 | 100 | 32.6 |
| 소요예산 산정 | 500 | 141,501 | 1,270 | 12,847 | 500 | 85.2 |
| 소요예산 산정 | 1,000 | 283,001 | 1,648 | 25,347 | 1,000 | 411.1 |
| 정보화실무협의회 | 100 | 35,093 | 1,448 | 3,445 | 100 | 27.5 |
| 정보화실무협의회 | 500 | 175,893 | 1,526 | 15,845 | 500 | 60.0 |
| 정보화실무협의회 | 1,000 | 351,894 | 2,146 | 31,345 | 1,000 | 116.9 |

## 로컬 실서버 확인과 결정

다음 명령으로 인증 없는 로컬 API 가용성을 먼저 확인했다.

```powershell
curl.exe -sS -o NUL -w "http://localhost:28080/api/project/bizplans status=%{http_code} time_total=%{time_total}s bytes=%{size_download}`n" --max-time 10 http://localhost:28080/api/project/bizplans
curl.exe -sS -o NUL -w "http://localhost:28080/api/project/estimates status=%{http_code} time_total=%{time_total}s bytes=%{size_download}`n" --max-time 10 http://localhost:28080/api/project/estimates
curl.exe -sS -o NUL -w "http://localhost:28080/api/council status=%{http_code} time_total=%{time_total}s bytes=%{size_download}`n" --max-time 10 http://localhost:28080/api/council
```

모두 `status=000`, 연결 실패(약 2.26초, 0 bytes)였다. 백엔드가 기동하지 않아 인증된 실응답 3회 이상의 p95는 측정할 수 없었다. 이 결과는 서버 지연값이 아니며, 백엔드 기동 및 권한 있는 세션이 준비되면 위 세 endpoint를 같은 요청 조건으로 최소 20회 재측정하는 후속 증거가 필요하다.

1,000건 합성 본문 최대값은 351,894 bytes로 1MB 미만이다. 따라서 현재 확보된 증거상 High 서버 페이지네이션 과제는 등록하지 않는다. 실서버 p95 500ms 초과 여부는 미판정이며, FE-04는 DOM 개선으로만 완료 기록한다.

## 변경 후 비교

FE-04 구현과 동일 명령 재실행 결과를 후속 문서 커밋에 추가한다.
