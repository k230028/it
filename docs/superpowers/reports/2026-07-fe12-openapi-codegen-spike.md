# FE-12 OpenAPI 타입 codegen 비교 스파이크 (2026-07-29)

## 측정 환경

- 스펙 출처: 이미 기동되어 있던 로컬 백엔드(`http://localhost:28080`, 포트 확인 결과 사전 실행 상태였음)의 `GET /v3/api-docs`. 별도로 `./gradlew bootRun`을 실행하지 않았다(이미 떠 있었으므로 불필요).
- OpenAPI 버전: `3.1.0`
- paths: 159 / operations(HTTP 메서드 기준): 235 / `components.schemas`: 234
- 스펙 파일 크기: 232,611 bytes (스크래치 `openapi.json`, 커밋되지 않음)
- Node v22.18.0, npm 10.9.3
- 모든 codegen은 `C:\Users\gonna\AppData\Local\Temp\claude\...\scratchpad\fe12`에서 실행하고 종료 후 삭제했다. `it_frontend` 저장소는 건드리지 않았다(Step 5 확인 결과 참조).

## 비교

| 기준 | openapi-typescript@7 | orval@7 |
| --- | --- | --- |
| 산출물 | 타입 선언 파일 1개 (`.d.ts`) — `paths`/`components["schemas"]`/`operations` 타입만 제공, 호출 함수는 생성하지 않음 | 태그별로 분리된 클라이언트 함수 파일 36개 + 공용 스키마 파일 1개(`it.schemas.ts`) — 엔드포인트별 호출 함수·URL 빌더·응답 타입을 모두 생성 |
| 런타임 의존성 | 없음(타입 전용, `tsc`에서만 사용) | `client: 'fetch'` 모드는 기본적으로 런타임 의존성 없음(네이티브 `fetch` 직접 호출). `client: 'vue-query'` 등 다른 모드를 선택하면 TanStack Query 등 런타임 의존성이 추가됨(이번 스파이크는 `fetch` 모드만 실측) |
| 기존 `$apiFetch`/`useApiFetch` 래퍼 호환 | 완전 호환. 함수를 생성하지 않으므로 기존 래퍼 호출부는 그대로 두고 `paths["/api/..."]["get"]["responses"]["200"]["content"]["application/json"]` 형태로 요청/응답 타입만 참조하면 됨. 통합 마찰 없음 | 기본 `client: 'fetch'`는 `fetch(url, options)`를 직접 호출하는 함수를 생성해 `credentials:'include'`나 401 리프레시 로직이 전혀 없음. `override.mutator`로 자체 함수를 주입하면 생성 함수가 그 함수를 호출하도록 바뀌는 것을 실측으로 확인(`orval-mutator/project/project.ts`에서 `customFetch(url, options)` 호출 코드 생성됨). 단, `useApiFetch`(반응형 GET, Nuxt `useFetch` 기반)는 fetch/vue-query 클라이언트 모드 어느 쪽도 그 형태(`{data, pending, error, refresh}`)를 그대로 재현하지 못함 — reactive GET 쪽은 orval 산출물을 감싸는 추가 래퍼가 필요 |
| 401 refresh 합류(공유 refreshPromise) 유지 | 해당 없음(타입만 생성하므로 실제 요청 로직은 100% 기존 `$apiFetch`/`useApiFetch` 그대로 유지) | 커스텀 mutator가 내부에서 `useNuxtApp().$apiFetch`를 그대로 호출하도록 구현하면 refreshPromise 공유 로직 자체는 보존 가능(mutator는 얇은 위임 함수). 단, `$apiFetch`는 Nuxt 플러그인이 `useNuxtApp()`으로 주입하는 값이라 mutator가 Vue/Nuxt 컴포저블 컨텍스트 밖에서 호출되는 경로가 있다면 별도 검증 필요 — 이번 스파이크에서는 스텁 함수로 "호출 위임이 되는지"까지만 구조적으로 확인했고, 실제 `$apiFetch`를 연결한 end-to-end 401 재시도 동작은 미측정(스파이크 시간 예산 밖) |
| 생성 시간 | 실행 1회 전체 8.48s(첫 실행, `npx` 패키지 다운로드/설치 포함), 툴 자체 보고 생성 시간 428.6ms | 실행 1회 전체 27.9s(첫 실행, `npx` 패키지 다운로드/설치 포함). 툴 자체의 순수 생성 시간은 별도 표시되지 않음 |
| 산출 파일 수·라인 수 | 1개 파일, 13,328줄 | 37개 파일(태그 36개 + 스키마 1개), 총 15,594줄 |
| 수기 DTO 드리프트 차단 효과 | 스펙 변경 시 타입만 자동 갱신되고 실제 fetch 호출 코드는 개발자가 직접 작성 → 요청 경로/파라미터 오탈자는 여전히 컴파일러가 못 잡는 영역이 남음(문자열 경로를 수기로 조합하는 경우) | 요청 함수(URL 빌더 포함)까지 생성되므로 경로·파라미터·요청/응답 바디까지 스펙과 어긋나면 컴파일 단계에서 즉시 드러남 → 드리프트 차단 범위가 더 넓음 |
| 도입 비용 | 낮음: 타입 파일 하나만 codegen 스크립트로 추가하고 기존 `$apiFetch`/`useApiFetch` 호출부의 타입 인자를 점진적으로 교체하면 됨. 기존 코드 구조 변경 불필요 | 중간~높음: `override.mutator`로 `$apiFetch`를 감싸는 어댑터 작성, `client: 'fetch'`가 만드는 함수 시그니처(`Promise<{data, status, headers}>`)를 프로젝트 관례와 맞추는 작업, `useApiFetch`(반응형 GET) 쪽은 별도 통합 설계 필요. 스펙의 OpenAPI 3.1 `securitySchemes` 관련 ajv 검증 경고(치명적이진 않음, 산출물은 정상 생성됨)도 확인됨 |

## 위험

- 백엔드 스펙 변경 시 프론트 타입이 즉시 깨진다 → CI에서 생성 결과 diff 확인 단계 필요.
- 4-repo 토폴로지상 스펙 스냅샷 보관 위치 결정 필요(`it_frontend` 커밋 vs 빌드 시 생성).
- (실측 중 발견) 스펙이 OpenAPI 3.1이고 orval의 내부 ajv 스키마 검증이 3.1의 `securitySchemes/BearerAuth`를 완전히 지원하지 못해 경고가 출력됨(`SyntaxError: Swagger schema validation failed ... must NOT have unevaluated properties`). 산출물 생성 자체는 정상 완료되지만, 향후 orval/ajv 버전에 따라 이 경고가 오류로 격상될 가능성을 배제할 수 없어 도입 시 버전 고정과 CI 실패 감시가 필요.
- (실측 중 발견) orval 기본 `fetch` 클라이언트가 만드는 함수 시그니처(`Promise<{data, status, headers}>`)는 현재 프로젝트의 `$apiFetch`(ofetch 기반, 데이터 자체를 직접 반환) 및 `useApiFetch`(Nuxt `useFetch` 반응형 반환값) 관례와 다르다. 전면 도입 시 마이그레이션 코드가 상당히 늘어날 것으로 예상되나 정확한 규모는 미측정(1시간 타임박스 내 별도 실측 안 함).
- `override.mutator`를 통한 `$apiFetch` 실결합은 이번 스파이크에서 구조(호출 위임)만 확인했고, 401 리프레시가 실제로 동작하는지의 런타임 검증(브라우저/E2E)은 미측정(사유: 타임박스 내 프로덕션 코드 변경 없이 검증할 방법이 없어 범위 밖으로 판단).

## 결론

**조건부 채택 — openapi-typescript만 우선 도입, orval은 보류.**
1. openapi-typescript는 기존 `$apiFetch`/`useApiFetch` 래퍼를 전혀 건드리지 않고 타입만 얹을 수 있어(생성물 1개, 런타임 의존성 0) 도입 비용과 리스크가 가장 낮다.
2. orval은 드리프트 차단 범위가 더 넓지만, 기본 클라이언트 시그니처가 프로젝트 관례와 달라 `override.mutator` 어댑터 설계와 `useApiFetch`(반응형 GET) 통합이 별도 작업으로 필요하며, OpenAPI 3.1 스키마 검증 경고까지 겹쳐 이번 타임박스 안에서 "그대로 붙이면 끝"이라고 보기 어렵다.
3. 스펙이 이미 3.1이고 두 도구 모두 정상적으로(경고 유무 차이만 있을 뿐) 산출물을 생성했으므로, 스펙 자체의 문제로 인한 채택 불가 사유는 없다.

## 후속 조치

- 채택 시(openapi-typescript): 별도 계획으로 `npm run codegen` 스크립트(스펙 스냅샷 보관 위치 포함), CI 검증 단계(스펙 diff 감지), 최초 마이그레이션 범위(예: 프로젝트/예산 도메인부터)를 정의한다.
- orval 재검토 조건(TASK.md FE-12에 등록 예정): (a) `override.mutator` 어댑터로 `$apiFetch`의 401 refreshPromise 공유가 실제 브라우저 환경에서 동작함을 별도 스파이크로 검증, (b) `useApiFetch`(반응형 GET) 대응 방식(orval `vue-query` 모드 도입 여부 포함) 결정, (c) 사용 중인 orval 버전에서 OpenAPI 3.1 `securitySchemes` 검증 경고가 해소되었는지 확인.
