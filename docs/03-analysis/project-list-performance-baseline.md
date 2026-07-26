# 사업 카드 목록 성능 기준선 (FE-04)

측정일: 2026-07-26  
대상: 사업계획(`/project/bizplan`), 소요예산 산정(`/project/estimate`), 정보화실무협의회(`/info/council-request`)

## 목적과 판정 기준

FE-04는 API 전체 조회 크기를 바꾸지 않고, 필터·정렬이 끝난 결과에서 카드 DOM만 20건씩 점진 노출한다. 수용 기준은 최초 카드 DOM 20개 이하와 필터 입력 후 다음 paint까지 100ms 이하이다. 1,000건 응답 본문이 1MB 초과하거나 인증된 로컬 실서버 p95가 500ms 초과할 때만 서버 페이지네이션 High 과제를 등록한다.

## 버전 관리된 측정 하네스와 전제 조건

영구 하네스는 `it_frontend/tests/e2e/project-list-performance.spec.ts`이며 커밋 `fa1367b`에 추가됐다. `FE04_PERF=1`일 때만 실행되므로 일반 E2E에서는 skip된다. `FE04_PERF_MODE=pre|post`를 필수로 하며, pre는 fixture 전량 카드 렌더링, post는 20개 카드와 100ms 필터 기준을 검증한다.

- Node 의존성과 Playwright Chromium이 설치돼야 한다(`npm ci`, 필요 시 `npx playwright install chromium`).
- 하네스가 `playwright.config.ts`로 Nuxt 개발 서버(3002)를 기동한다. 3002 포트가 비어 있어야 한다.
- 목록 API와 공통 보조 API는 Playwright route fixture로 대체하므로 백엔드 기동·로그인 세션은 필요 없다. 따라서 시간은 **합성 응답 파싱·클라이언트 렌더링** 값이며 live server p95가 아니다.
- fixture는 세 화면의 현재 DTO 목록 표시 필드를 고정값과 `index` 기반 식별자·날짜·상태로 결정적으로 생성한다. 100/500/1,000건, 화면별 조합을 각각 3회 실행하고 JSON stringify bytes도 계산한다.

post 재현 명령:

```powershell
cd C:\it\it_frontend\.worktrees\frontend-backlog-remediation
$env:FE04_PERF = '1'
$env:FE04_PERF_MODE = 'post'
npm run test:e2e -- tests/e2e/project-list-performance.spec.ts --project=chromium
```

출력의 `FE04_PERF ... raw=... median=...`이 원시 3회 샘플과 중앙값이다. first card render는 탐색 직전부터 첫 `.v3-card` 가시화까지의 벽시계 시간, DOM nodes는 첫 카드 직후 전체 요소 수, filter는 `사업명 검색` 입력부터 다음 `requestAnimationFrame`까지다. bytes는 `Buffer.byteLength(JSON.stringify(fixture))`이므로 gzip 전송량이 아니다.

## pre 재현 절차 (기준 frontend `e728738`)

다음은 제품 변경을 커밋하지 않는 명시적 임시 detached worktree 절차다. 하네스는 `fa1367b`의 버전만 복사하고, 측정 뒤 해당 worktree만 제거한다.

```powershell
cd C:\it\it_frontend
$temp = 'C:\it\it_frontend\.worktrees\fe04-baseline-e728738'
if (Test-Path -LiteralPath $temp) { throw "이미 존재하는 임시 경로: $temp" }
git worktree add --detach $temp e728738
Set-Location $temp
npm ci
git -C C:\it\it_frontend show fa1367b:tests/e2e/project-list-performance.spec.ts |
  Set-Content -Encoding utf8 .\tests\e2e\project-list-performance.spec.ts
$env:FE04_PERF = '1'
$env:FE04_PERF_MODE = 'pre'
npm run test:e2e -- tests/e2e/project-list-performance.spec.ts --project=chromium
Set-Location C:\it\it_frontend
git worktree remove --force $temp
```

이번 pre 측정은 위 절차와 같은 `C:\it\it_frontend\.worktrees\fe04-baseline-e728738` detached worktree에서 `e728738`로 실행했고, 복사한 하네스는 커밋하지 않았다. 생성물과 임시 worktree는 측정 뒤 제거했다.

## 원시 증거와 중앙값

표의 원시 값은 `[first card ms / DOM nodes / cards / filter ms]` 순서의 3회 샘플이다. pre 측정 SHA는 frontend `e728738`(하네스 원본 `fa1367b`를 비커밋 복사), post 측정 SHA는 frontend `fa1367b`(제품 구현 `c029c5f` 포함)다.

| 모드 | 화면 | 건수 | bytes | 원시 3회 샘플 | 중앙값 |
| --- | --- | ---: | ---: | --- | --- |
| pre | 사업계획 | 100 | 18,501 | [2240/2833/100/34.3; 892/2833/100/29.1; 941/2833/100/45.4] | 941/2833/100/34.3 |
| pre | 사업계획 | 500 | 92,501 | [1279/12844/500/69.0; 1256/12844/500/68.0; 1312/12844/500/73.0] | 1279/12844/500/69.0 |
| pre | 사업계획 | 1,000 | 185,001 | [1610/25333/1000/433.4; 1476/25344/1000/421.9; 1533/25344/1000/448.7] | 1533/25344/1000/433.4 |
| pre | 소요예산 산정 | 100 | 28,301 | [1442/2847/100/38.8; 975/2836/100/23.2; 992/2847/100/43.3] | 992/2847/100/38.8 |
| pre | 소요예산 산정 | 500 | 141,501 | [1264/12847/500/85.1; 1455/12836/500/58.4; 1216/12836/500/64.2] | 1264/12836/500/64.2 |
| pre | 소요예산 산정 | 1,000 | 283,001 | [1652/25336/1000/386.5; 1481/25347/1000/357.8; 1556/25336/1000/402.7] | 1556/25336/1000/386.5 |
| pre | 정보화실무협의회 | 100 | 35,093 | [1538/3445/100/24.3; 1418/3445/100/22.6; 1011/3445/100/20.6] | 1418/3445/100/22.6 |
| pre | 정보화실무협의회 | 500 | 175,893 | [1491/15845/500/60.8; 1591/15845/500/78.6; 1599/15845/500/94.5] | 1591/15845/500/78.6 |
| pre | 정보화실무협의회 | 1,000 | 351,894 | [2282/31345/1000/148.8; 2261/31345/1000/144.1; 2053/31345/1000/110.8] | 2261/31345/1000/144.1 |
| post | 사업계획 | 100 | 18,501 | [9395/837/20/25.1; 884/837/20/21.0; 891/837/20/15.6] | 891/837/20/21.0 |
| post | 사업계획 | 500 | 92,501 | [920/837/20/24.9; 893/837/20/14.7; 901/837/20/19.3] | 901/837/20/19.3 |
| post | 사업계획 | 1,000 | 185,001 | [885/837/20/22.4; 919/837/20/21.6; 877/837/20/16.4] | 885/837/20/21.6 |
| post | 소요예산 산정 | 100 | 28,301 | [952/840/20/19.8; 881/840/20/25.4; 901/840/20/25.0] | 901/840/20/25.0 |
| post | 소요예산 산정 | 500 | 141,501 | [883/840/20/22.0; 875/840/20/15.1; 871/840/20/19.4] | 875/840/20/19.4 |
| post | 소요예산 산정 | 1,000 | 283,001 | [946/840/20/21.5; 883/840/20/13.5; 907/840/20/17.9] | 907/840/20/17.9 |
| post | 정보화실무협의회 | 100 | 35,093 | [1380/969/20/27.4; 897/969/20/14.9; 902/969/20/25.0] | 902/969/20/25.0 |
| post | 정보화실무협의회 | 500 | 175,893 | [1406/969/20/29.3; 949/969/20/27.5; 925/969/20/20.7] | 949/969/20/27.5 |
| post | 정보화실무협의회 | 1,000 | 351,894 | [962/969/20/25.4; 1403/969/20/21.3; 916/969/20/13.6] | 962/969/20/21.3 |

post 1,000건은 세 화면 모두 카드 20개, filter 중앙값 21.6ms/17.9ms/21.3ms로 수용 기준을 충족한다. cold-start 원시값은 중앙값에서 완화하되 삭제하지 않는다.

## 로컬 실서버 확인과 결정

인증 없는 `curl.exe --max-time 10 http://localhost:28080/api/project/bizplans`, `/api/project/estimates`, `/api/council`은 모두 `status=000`, 연결 실패(약 2.26초, 0 bytes)였다. 백엔드가 기동하지 않아 인증된 실응답 p95는 측정하지 못했다. 위 route 측정값을 서버 p95로 해석하지 않으며, 백엔드와 권한 세션이 준비되면 같은 endpoint를 최소 20회 실측해야 한다.

합성 본문 최대값은 351,894B로 1MB 미만이다. 확보된 증거상 High 서버 페이지네이션 과제는 등록하지 않는다. FE-04는 네트워크 성능 해결이 아니라 DOM 개선 완료로만 판정한다.
