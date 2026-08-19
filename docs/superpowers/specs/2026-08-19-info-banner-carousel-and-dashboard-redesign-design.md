# 정보화사업 홈 배너 캐러셀·즐겨찾기·KPI 카드 재구성 설계

작성일: 2026-08-19

## 1. 배경

`/info` 홈 대시보드(`it_frontend/app/pages/info/index.vue`, 781줄)는 세 가지 요구를 받았다.

첫째, 화면 오른쪽 하단에 이미지 캐러셀(배너)이 없다. 공지성 이미지를 홈에 노출할 창구가
전혀 없어 관리자가 배너를 올릴 방법이 없다.

둘째, 우측 바로가기 패널의 세 항목(사업 가이드·요구사항 작성기·사전진단)이 실제 사용
빈도와 맞지 않는다. 사용자가 홈에서 가장 자주 가는 곳은 예산 작성 화면이다.

셋째, 상단 KPI 카드 4종 중 `진행중인 사업`·`집행완료 예산`은 올해 데이터만 보여준다.
예산 편성 업무는 올해와 내년을 나란히 비교해야 하는데 내년 수치를 볼 곳이 없다.

## 2. 목표

1. `/info` 오른쪽 하단에 활성 배너 이미지를 순차 전환하는 캐러셀을 표시한다.
2. 관리자가 전용 화면에서 배너 이미지를 업로드하고 활성·비활성을 전환한다.
3. 배너는 신규 테이블 없이 기존 `TPRMPP_CFILEM`을 재사용한다.
4. 우측 바로가기 패널을 예산 작성 중심 4항목으로 교체한다.
5. 상단 KPI 카드를 올해·내년 대칭 구조 4종으로 교체한다.

## 3. 범위 밖

- 배너 클릭 시 링크 이동. `TPRMPP_CFILEM`에 링크를 담을 여유 컬럼이 없고, 공용 테이블에
  배너 전용 컬럼을 추가하지 않기로 결정했다. 배너는 이미지 표시 전용이다.
- 배너 노출 순서 수동 조정. 업로드 순(`FL_MPN_ID` 오름차순) 고정이다. 순서를 바꾸려면
  비활성화 후 재업로드한다.
- 배너 게시 기간(시작일·종료일) 관리. 활성·비활성 두 상태만 둔다.
- `/info` 외 위치의 배너. `PK_CONE`을 위치 식별자로 쓰는 구조라 확장은 가능하지만
  이번에는 `/info` 하나만 시드한다.
- `TPRMPP_CFILEM` 스키마 변경. 컬럼 추가·변경 없이 기존 컬럼만 사용한다.
- 간트 타임라인·공지사항·주요 일정 영역. 이번 변경 대상이 아니다.
- `/admin/translations` 경로가 `TPRMPP_CMENUD` 카탈로그에 누락된 기존 결함. 별건이며
  `TASK.md`에 등록한다.

## 4. 사전 조사 결과

설계 결정의 근거가 된 코드 사실이다.

| 사실 | 위치 |
| --- | --- |
| `/api/files`가 목록(`pkColNm`+`pkCone`+`DEL_YN='N'`)·업로드·논리삭제·미리보기를 이미 제공 | `it_backend/.../infra/file/controller/FileController.java` |
| 파일 읽기 권한은 **default-deny** — 미등록 `PK_COL_NM`은 관리자만 읽을 수 있다 | `it_backend/.../infra/file/authz/FileReadAuthorizerRegistry.java` |
| `BaseEntity.delete()`/`restore()`가 `DEL_YN` 토글을 이미 제공 | `it_backend/.../domain/entity/BaseEntity.java` |
| `FileValidator` 허용 확장자에 pdf·hwp·doc·xls·ppt가 포함 — 이미지 전용이 아니다 | `it_backend/.../infra/file/FileValidator.java` |
| PGE 메뉴 저장 시 `TPRMPP_CMENUD` 경로 카탈로그 존재를 강제 | `it_backend/.../domain/menu/service/AdminMenuService.java` `requireUsableCatalogPath()` |
| PrimeVue 4.5.4 + `@primevue/nuxt-module` 자동 임포트 → `Carousel` 사용 가능 | `it_frontend/nuxt.config.ts` |
| 관리자 전용 컨트롤러는 클래스 레벨 `@PreAuthorize("hasRole('ADMIN')")` 패턴 | `it_backend/.../domain/menu/controller/AdminRouteController.java` |
| `buildInfoDashboardSummary`는 연도에 의존하지 않는 순수 집계 함수 | `it_frontend/app/utils/infoDashboardSummary.ts` |

## 5. 설계 결정

### 5.1 배너 저장소 — `TPRMPP_CFILEM` 재사용

신규 테이블 없이 공용 첨부파일 테이블을 쓴다.

| 컬럼 | 값 | 의미 |
| --- | --- | --- |
| `PK_COL_NM` | `배너` | 첨부파일 용도 |
| `PK_CONE` | `/info` | 배너 위치 |
| `FL_TP_CONE` | `이미지` | 파일 종류 |
| `DEL_YN` | `N` = 활성 / `Y` = 비활성 | 노출 여부 |

`/info` 캐러셀은 `PK_COL_NM='배너' AND PK_CONE='/info' AND DEL_YN='N'`인 행을
`FL_MPN_ID` 오름차순으로 순차 전환한다.

### 5.2 배너 API — 전용 엔드포인트 `/api/banners`

범용 `/api/files`에 복원 엔드포인트를 추가하는 안을 버리고 배너 전용 컨트롤러를 둔다.

- 범용 복원 엔드포인트는 삭제된 게시판 첨부·요구사항정의서까지 되살릴 수 있어 보안
  표면이 넓다. 복원은 배너에만 필요하다.
- `PK_COL_NM='배너'`·`PK_CONE='/info'` 규약을 서버가 강제한다. 클라이언트가 임의
  값을 보낼 여지가 없다.
- `FileService`에 위임하는 얇은 계층이라 신규 코드가 적다.

| 엔드포인트 | 권한 | 동작 |
| --- | --- | --- |
| `GET /api/banners` | 인증 사용자 | 활성 배너 목록. `FL_MPN_ID` 오름차순 |
| `GET /api/banners/admin` | ADMIN | 활성·비활성 전체 목록 |
| `POST /api/banners` | ADMIN | multipart 업로드. `pkColNm`·`pkCone`·`flTpCone`은 서버가 고정 |
| `PATCH /api/banners/{flMpnId}/active` | ADMIN | `{"active": boolean}` → `restore()`/`delete()` |

`PATCH`는 대상 행의 `PK_COL_NM`이 `배너`가 아니면 거부한다. 배너 API로 다른 종류의
파일을 복원할 수 없다.

응답 DTO는 `flMpnId`·`flNm`·`apgFlSz`·`active`·`previewUrl`·`fstEnrDtm`·`fstEnrUsid`를
담는다. `previewUrl`은 기존 `/api/files/{flMpnId}/preview` 상대 경로를 재사용한다.

### 5.3 배너 권한 — read authorizer 신설이 필수

파일 읽기는 default-deny이므로 `배너` 종류를 등록하지 않으면 일반 사용자에게 캐러셀
이미지가 403으로 막힌다.

- `BannerFileReadAuthorizer` — `배너` → 인증 사용자 전체 허용.
  `GuideDocFileReadAuthorizer`와 같은 전사 공개 패턴이다.
- `BannerFileTargetWriteAuthorizer` — `배너` → `user.isAdmin()`만 허용하고
  `allowsGenericMutation()`을 `false`로 둔다. 범용 `/api/files` PUT·DELETE가 배너 행을
  건드리지 못하게 막아 관리 창구를 배너 API 하나로 강제한다.

`allowsGenericMutation()=false`는 `FileService.deleteFile()`·`updateFileMeta()`·
`deleteFilesByOrc()`에서 검사되며 업로드 경로에는 적용되지 않는다. 업로드는
`verifyTargetWriteAccess()`가 ADMIN으로 막는다.

`/admin/files`(첨부파일 조회 화면)는 조회 전용이므로 영향이 없다.

### 5.4 배너 파일 검증 — 이미지 확장자 재검증

`FileValidator`는 pdf·hwp 등도 통과시킨다. `BannerService`가 업로드 시
`jpg`·`jpeg`·`png`·`gif`만 허용하도록 한 번 더 검증하고, 위반 시
`CustomGeneralException`을 던진다. 검증은 `FileValidator` 통과 이후 배너 계층에서
수행하며 공용 화이트리스트는 건드리지 않는다.

### 5.5 캐러셀 컴포넌트

`it_frontend/app/components/info/InfoBannerCarousel.vue` 신설.

- PrimeVue `Carousel`. `circular`, `autoplayInterval=5000`, `numVisible=1`, `numScroll=1`.
- 이미지는 16:9 비율 컨테이너에 `object-cover`로 맞춘다.
- 이전·다음 버튼과 인디케이터를 노출해 자동 전환 외 수동 조작을 허용한다.
- 활성 배너가 0건이면 카드 자체를 렌더하지 않는다. 빈 카드가 홈에 남지 않는다.
- 조회 중에는 같은 비율의 스켈레톤을 표시한다.
- 조회 실패는 캐러셀을 숨기고 콘솔 경고만 남긴다. 홈 진입을 배너 때문에 막지 않는다.

배치는 `/info` 우측 패널에서 즐겨찾기 카드 **아래**다. 요구사항의 "오른쪽 하단"에
해당한다. `xl` 미만 화면에서는 우측 패널이 본문 아래로 내려가는 기존 반응형 동작을
그대로 따른다.

### 5.6 배너 관리 화면

`it_frontend/app/pages/admin/banners.vue` 신설. `definePageMeta({ middleware: 'admin' })`.

- 상단: `PageHeader` + [배너 업로드] 버튼(숨김 `input[type=file]`, `accept="image/*"`)
- 본문: `StyledDataTable` — 썸네일·파일명·크기·등록자·등록일시·활성 `ToggleSwitch`
- 썸네일 클릭 시 원본 미리보기 다이얼로그
- 활성 토글은 `PATCH /api/banners/{flMpnId}/active` 호출 후 목록을 갱신하고 토스트로
  결과를 알린다.

### 5.7 메뉴 시드

`it_database/migrations/V20260819_001__SeedBannerAdminMenu.sql` 신설.
`V20260818_002__SeedTranslationAdminMenu.sql`과 같은 재실행 안전 패턴을 따른다.

1. `TPRMPP_CMENUD`에 `/admin/banners` 경로 카탈로그 행 추가.
   `AdminMenuService.requireUsableCatalogPath()`가 PGE 메뉴 저장 시 이 행을 요구하므로
   빠지면 관리자가 `/admin/menus`에서 배너 메뉴를 다시 저장할 수 없다.
2. `TPRMPP_CMENUM`에 부모 `MADM0010`(콘텐츠 관리) 하위로 `배너 관리` 메뉴 추가.
   `MNU_TP_C='PGE'`, `SRE_PTH='/admin/banners'`, `IMK_NM='pi pi-images'`,
   정렬번호는 형제 최대값 + 10.
3. `TPRMPP_CLANGM`에 영문 메뉴명 `Banners` MERGE.

`IMK_NM`은 CSS 클래스로 바인딩되므로 `^[a-z0-9 -]{1,100}$`를 만족해야 한다.
`pi pi-images`를 프론트 선택지 목록(`app/utils/menuPresentation.ts`의
`MENU_ICON_OPTIONS`)에도 추가해 메뉴관리 화면에서 재선택할 수 있게 한다.

동일 `SRE_PTH`의 활성 메뉴가 이미 있으면 건너뛰고, `MADM0010`이 없는 스키마에서는
조용히 건너뛴다.

### 5.8 즐겨찾기 재구성

우측 패널의 기존 3항목을 아래 4항목으로 교체한다.

| 순서 | 표시명 | 경로 | 아이콘 |
| --- | --- | --- | --- |
| 1 | 정보화사업 예산 작성 | `/info/projects/form` | `pi pi-briefcase` |
| 2 | 경상사업 예산 작성 | `/info/projects/form?ordinary=true` | `pi pi-sync` |
| 3 | 전산업무비 예산 작성 | `/info/cost/form` | `pi pi-desktop` |
| 4 | 전산예산 목록 | `/budget/list` | `pi pi-list` |

경로 근거는 `it_frontend/app/pages/budget/index.vue`(예산 작성 유형 선택 페이지)의
카드 이동 경로와 `TPRMPP_CMENUM`의 `예산 목록`(`/budget/list`) 메뉴다.

중요도 배지(10/5/5)는 제거한다. 새 4항목은 모두 동급이라 숫자에 의미가 없고,
`QUICK_LINK_PRIORITY` 상수와 `info.dashboard.priority` i18n 키도 함께 제거한다.

예산 작성 화면 3종은 각각 `budget-period` 미들웨어로 신청기간을 검증한다. 즐겨찾기는
링크만 제공하고 기간 검증은 대상 화면이 그대로 담당한다.

### 5.9 KPI 카드 재구성

| 현재 | 변경 후 | 비고 |
| --- | --- | --- |
| 올해 사업 | 올해 사업 | 유지 |
| 진행중인 사업 | **내년 사업** | 신규 |
| 편성요청 예산 | 올해 편성요청 예산 | 표시명만 변경 |
| 집행완료 예산 | **내년 편성요청 예산** | 신규 |

- `올해 사업`·`내년 사업`은 건수형 카드다. 총 건수 + 정보화사업·경상사업·전산업무비
  세그먼트 막대 구조를 그대로 쓴다.
- `올해 편성요청 예산`·`내년 편성요청 예산`은 금액형 카드다. 신청액 + 편성액 + 자본예산·
  일반관리비 구성비 막대 구조를 그대로 쓴다.
- 올해 = `new Date().getFullYear()`, 내년 = 올해 + 1. 기존 페이지의 연도 기준과 같다.
- 관리자용 전체·부서 `InfoDashboardScopeToggle`은 4개 카드 모두 유지한다.

내년 데이터는 `fetchProjects({bseYy:내년, odnYn:'N'})`,
`fetchProjects({bseYy:내년, odnYn:'Y'})`, `fetchCosts({bseYy:내년})` 3건을 추가 호출한다.
`buildInfoDashboardSummary`는 연도에 의존하지 않으므로 그대로 재사용하고 변경하지 않는다.

간트 타임라인(`사업별 진행현황`)은 올해 데이터만 쓰는 기존 동작을 유지한다.

### 5.10 `info/index.vue` 구조 정리

`info/index.vue`는 781줄이고 KPI 카드 4개가 거의 동일한 마크업을 인라인 중복한다.
내년 카드 2개를 그대로 추가하면 1000줄을 넘어선다. 이번 변경 범위 안에서만 정리한다.

- `app/components/info/InfoKpiCountCard.vue` — 건수형 카드. props: 아이콘·색상 토큰·
  제목·총건수·세그먼트 배열(`{label, value, colorClass}`), `v-model` 스코프.
- `app/components/info/InfoKpiBudgetCard.vue` — 금액형 카드. props: 아이콘·색상 토큰·
  제목·신청액·편성액·구성비 세그먼트, `v-model` 스코프.
- `app/composables/useInfoDashboardYear.ts` — 연도 하나를 받아
  정보화사업·경상사업·전산업무비를 조회하고 부서 범위 필터를 적용해
  `{ department, all }` 두 범위의 `InfoDashboardSummary`를 반환한다.
  기존 `dashboardSummaries` 계산 로직을 그대로 옮긴다.

간트 타임라인·공지사항·주요 일정 영역은 손대지 않는다. 무관한 리팩터링을 하지 않는다.

### 5.11 i18n

`it_frontend/i18n/messages/info.ts`(ko/en 양쪽)에 추가·변경한다.

- 추가: `nextYearProjects`, `thisYearRequestedBudget`, `nextYearRequestedBudget`,
  `quickLinkProjectBudget`, `quickLinkOrdinaryBudget`, `quickLinkCostBudget`,
  `quickLinkBudgetList`, `bannerTitle`
- 제거: `activeProjects`, `completedBudget`, `executionComplete`, `remaining`,
  `projectGuide`, `requirementWriter`, `preDiagnosis`, `priority`
- 유지하되 의미 재확인: `requestedBudget`은 `thisYearRequestedBudget`으로 대체하고 제거

`it_frontend/i18n/messages/admin.ts`에 `admin.banners.*` 키를 추가한다(제목·업로드·
활성·비활성·컬럼명·토스트 문구·확장자 오류).

제거 대상 키가 다른 화면에서 쓰이지 않는지 확인한 뒤 제거한다.

## 6. 구성 요소와 의존 관계

### 6.1 백엔드 신규 (`it_backend`)

```
com.kdb.it.domain.banner
├── controller/BannerController.java      → BannerService
├── service/BannerService.java            → FileService, FileRepository
└── dto/BannerDto.java                    (Response, ActiveRequest)

com.kdb.it.infra.file.authz
├── BannerFileReadAuthorizer.java         (배너 → 인증 사용자 전체)
└── BannerFileTargetWriteAuthorizer.java  (배너 → ADMIN, allowsGenericMutation=false)
```

`FileRepository`에 활성·비활성을 함께 조회하는 메서드
(`findAllByPkColNmAndPkConeOrderByFlMpnIdAsc`)를 추가한다. 기존 메서드는 모두
`DEL_YN`을 조건으로 받으므로 관리자 목록에 쓸 수 없다.

`FileService`·`Cfilem`·`FileValidator`는 변경하지 않는다.

### 6.2 프론트엔드 신규·변경 (`it_frontend`)

```
신규
├── app/composables/useBanners.ts
├── app/composables/useInfoDashboardYear.ts
├── app/components/info/InfoBannerCarousel.vue
├── app/components/info/InfoKpiCountCard.vue
├── app/components/info/InfoKpiBudgetCard.vue
└── app/pages/admin/banners.vue

변경
├── app/pages/info/index.vue          (KPI 4종 교체·즐겨찾기 교체·캐러셀 배치·카드 추출)
├── app/utils/menuPresentation.ts     (MENU_ICON_OPTIONS에 pi pi-images 추가)
├── i18n/messages/info.ts
└── i18n/messages/admin.ts
```

`app/utils/infoDashboardSummary.ts`와 `app/utils/infoDashboardScope.ts`는 변경하지 않는다.

### 6.3 데이터베이스 (`it_database`)

```
migrations/V20260819_001__SeedBannerAdminMenu.sql
migrations/_verify/banner-menu-seed-verify.sql
```

## 7. 데이터 흐름

**배너 표시**

```
/info 진입
  → useBanners().fetchActiveBanners()
  → GET /api/banners
  → BannerService: FileRepository.findAllByPkColNmAndPkConeAndDelYn('배너','/info','N')
  → BannerDto.Response[] (previewUrl 포함)
  → InfoBannerCarousel: <img :src="previewUrl">
  → GET /api/files/{id}/preview (httpOnly 쿠키 인증)
  → FileOwnershipChecker.checkReadAccess → BannerFileReadAuthorizer → 인증 사용자 허용
```

**배너 업로드**

```
/admin/banners 파일 선택
  → POST /api/banners (multipart)
  → @PreAuthorize hasRole('ADMIN')
  → BannerService: 이미지 확장자 검증
  → FileService.uploadFileAndGet(file, {flTpCone:'이미지', pkColNm:'배너', pkCone:'/info'})
  → TPRMPP_CFILEM INSERT (DEL_YN='N')
```

**활성 토글**

```
ToggleSwitch 변경
  → PATCH /api/banners/{flMpnId}/active {"active": false}
  → BannerService: 대상 행 PK_COL_NM='배너' 확인
  → Cfilem.delete() / restore() → DEL_YN 'Y'/'N'
  → 목록 갱신 + 토스트
```

## 8. 오류 처리

| 상황 | 처리 |
| --- | --- |
| 배너 0건 | 캐러셀 카드를 렌더하지 않는다 |
| 배너 조회 실패 | 캐러셀을 숨기고 콘솔 경고만 남긴다. 홈 진입을 막지 않는다 |
| 개별 이미지 로드 실패(`@error`) | 해당 슬라이드를 목록에서 제외한다 |
| 이미지 아닌 확장자 업로드 | 400 + `허용되지 않은 이미지 형식입니다` 토스트 |
| 비관리자의 업로드·토글 시도 | 403 |
| 존재하지 않는 `flMpnId` 토글 | 404 |
| `PK_COL_NM`이 `배너`가 아닌 행 토글 시도 | 403 |
| 내년 사업·예산 데이터 없음 | 카드에 0건·0억원을 표시한다. 오류가 아니다 |

## 9. 테스트

### 9.1 백엔드 (`it_backend`)

| 테스트 | 검증 |
| --- | --- |
| `BannerFileReadAuthorizerTest` | 인증 사용자 허용, 비인증 거부 |
| `BannerFileTargetWriteAuthorizerTest` | ADMIN 허용, 일반 사용자 거부, `allowsGenericMutation()==false` |
| `FileReadAuthorizerRegistryTest` 보강 | `배너` 종류가 레지스트리에 등록됨 |
| `BannerServiceTest` | 이미지 외 확장자 거부, 활성·비활성 토글, 배너 아닌 행 토글 거부, `FL_MPN_ID` 오름차순 정렬 |
| `BannerControllerTest` | 비관리자 업로드·토글 403, 활성 목록은 일반 사용자 200 |
| `FileControllerTest` 보강 | 범용 DELETE로 배너 행 삭제 시 403 |

### 9.2 프론트엔드 (`it_frontend`)

| 테스트 | 검증 |
| --- | --- |
| `tests/unit/composables/useBanners.test.ts` | 목록·업로드·토글 요청 형태 |
| `tests/unit/components/InfoBannerCarousel.test.ts` | 0건 시 미렌더, n건 시 슬라이드 n개, 로드 실패 슬라이드 제외 |
| `tests/unit/composables/useInfoDashboardYear.test.ts` | 연도별 조회 파라미터, 부서·전체 범위 집계 |
| `tests/unit/components/InfoKpiCountCard.test.ts` | 세그먼트 비율 계산, 총합 0일 때 0% |
| `tests/unit/utils/infoDashboardSummary.test.ts` | 기존 테스트 유지(집계 함수 미변경 확인) |
| `tests/e2e/info-home.spec.ts` 갱신 | KPI 4종 제목, 즐겨찾기 4항목 경로, 캐러셀 존재 여부 |
| `tests/e2e/admin/banners.spec.ts` 신설 | 업로드 → 목록 노출 → 비활성 → `/info` 미노출 → 재활성 |

### 9.3 데이터베이스 (`it_database`)

`migrations/_verify/banner-menu-seed-verify.sql` — `/admin/banners`의 `TPRMPP_CMENUD`
행 1건, `TPRMPP_CMENUM` 활성 메뉴 1건, `TPRMPP_CLANGM` 영문명 1건을 확인한다.

### 9.4 Health Stack

```powershell
cd C:\it\it_backend; ./gradlew test
cd C:\it\it_frontend; npm run format:check; npm run check; npm test
cd C:\it; ./scripts/update-versions-lock.ps1
```

## 10. 구현 순서

교차 저장소 변경이므로 백엔드 API 계약을 먼저 확정한다.

1. `it_database` — 메뉴 시드 마이그레이션 + 검증 스크립트
2. `it_backend` — authorizer 2종 → `FileRepository` 메서드 → `BannerDto`/`BannerService`/
   `BannerController` → 테스트
3. `it_frontend` — `useBanners` → `InfoBannerCarousel` → `/admin/banners` → i18n
4. `it_frontend` — `useInfoDashboardYear` → KPI 카드 컴포넌트 2종 → `info/index.vue`
   KPI·즐겨찾기·캐러셀 반영 → i18n
5. 테스트·Health Stack → `versions.lock` 갱신

## 11. 미해결 위험

- **배너 이미지 용량.** 업로드 크기 상한은 기존 multipart 설정을 그대로 따른다. 큰
  이미지를 올리면 홈 진입이 느려질 수 있다. 관리 화면에 파일 크기를 표시해 운영자가
  판단하게 하고, 자동 리사이즈는 넣지 않는다.
- **`/admin/translations` 경로 카탈로그 누락.** 기존 결함이며 이번 범위 밖이다.
  `TASK.md`에 등록한다.
