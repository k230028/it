# 사용자가이드 관리 설계 (2026-08-30)

## 1. 배경

포털에는 전 직원이 내려받을 수 있는 사용자 매뉴얼을 올려 둘 자리가 없다. 관리자가 가이드
파일을 교체하려면 지금은 게시판 글로 올리고 사용자에게 위치를 안내해야 한다.

시스템에는 이미 같은 형태의 선례가 있다. `/info` 홈 배너(`BannerService`)는 전용 테이블 없이
공통첨부파일기본(`TPRMPP_CFILEM`)을 재사용하고, 관리자 화면에서 업로드·활성 전환을 하며,
읽기 판정기 하나로 전사 공개를 표현한다. 사용자가이드는 이 흐름을 그대로 따른다.

## 2. 목표

- 관리자가 `/admin/user-guides` 화면에서 사용자가이드 파일을 업로드·교체한다.
- 파일 메타데이터는 `TPRMPP_CFILEM`으로 관리한다(전용 테이블 없음).
- 현재 가이드가 있으면 헤더 [통합검색] 좌측 [사용자가이드] 버튼으로 전 직원이 내려받는다.

## 3. 범위 밖

- 가이드 본문을 포털 안에서 렌더링하는 뷰어(내려받기만 제공)
- 가이드 제목·설명·버전 등 파일명 외의 메타데이터 관리
- 여러 가이드를 동시에 노출하는 목록 UI (단일 파일 교체 방식으로 확정)
- 비로그인 사용자 접근 (헤더는 인증 후 화면에만 있다)

## 4. 설계 결정

### 4.1 전용 테이블 없이 CFILEM 재사용

배너와 같은 판단이다. 관리 대상이 "파일 한 건"뿐이라 별도 마스터 테이블을 만들면 컬럼이
대부분 비고, 마이그레이션·엔티티·권한 판정기가 늘어난다.

서버가 다음 규약을 고정한다. 클라이언트는 이 값들을 보내지 않는다.

| 컬럼 | 고정값 | 비고 |
| --- | --- | --- |
| `APG_FL_KD_NM` | `사용자가이드` | 신규 종류. `FileKindRegistry`가 판정기 선언에서 자동 인식 |
| `APG_FL_LNK_CTZ_NM` | `HEADER` | 노출 위치. 배너의 `/info`와 같은 역할이나 헤더는 전역이라 위치명을 쓴다 |
| `FL_TP_CONE` | `첨부파일` | |

### 4.2 기존 `가이드문서` 종류를 쓰지 않는다

`가이드문서`는 예산 도메인 `Bgdocm`(문서관리번호)에 묶인 종류이고
`GuideDocFileReadAuthorizer`가 그 전제로 판정한다. 부모 레코드가 없는 전역 파일을 같은 종류에
끼워 넣으면 계약이 오염되므로 새 종류 `사용자가이드`를 만든다.

### 4.3 단일 파일 교체 방식

**불변식: `DEL_YN='N'`인 사용자가이드 행은 항상 0건 또는 1건이다.**

- 업로드하면 같은 트랜잭션에서 기존 활성 행을 모두 `DEL_YN='Y'`로 내리고 새 행만 활성으로 둔다.
- 이전 파일은 이력으로 남고 물리 파일도 지우지 않는다. 잘못 올렸을 때 되돌릴 수 있어야 한다.
- 되돌리기(`active=true`)도 같은 트랜잭션에서 다른 활성 행을 먼저 내린 뒤 대상을 복원한다.
- 현재 가이드를 내리면(`active=false`) 활성 0건이 되고 헤더 버튼이 사라진다.

### 4.4 전용 다운로드 엔드포인트를 만들지 않는다

`UserGuideFileReadAuthorizer`가 종류 `사용자가이드`에 대해 인증 사용자 전체 읽기를 허용하면
기존 `GET /api/files/{flMpnId}/download`가 그대로 동작한다. 새 다운로드 경로는 권한 판정을 두
곳으로 흩뜨릴 뿐이라 만들지 않는다.

### 4.5 허용 확장자를 문서 형식으로 좁힌다

공통 `FileValidator` 화이트리스트는 이미지·압축까지 포함한다. 사용자가이드는
`pdf, hwp, hwpx, docx, pptx`만 받는다(모두 공통 화이트리스트의 부분집합). 배너가
이미지 확장자로 좁히는 것과 같은 방식으로 서비스에서 한 번 더 검증한다.

## 5. 백엔드 설계

### 5.1 신규 파일

- `infra/file/authz/UserGuideFileReadAuthorizer` — 종류 `사용자가이드`, `canRead`는 `user != null`
- `domain/userguide/dto/UserGuideDto` — `Response`, `ActiveRequest`
- `domain/userguide/service/UserGuideService`
- `domain/userguide/controller/UserGuideController`

### 5.2 API 계약

기본 URL `/api/user-guides`.

| 메서드 | 경로 | 권한 | 동작 |
| --- | --- | --- | --- |
| GET | `/active` | 인증 사용자 | 현재 가이드 1건. 없으면 `204 No Content` |
| GET | `/admin` | `ROLE_ADMIN` | 활성 + 이력 전체. 파일매핑ID 내림차순(최신 우선) |
| POST | `` | `ROLE_ADMIN` | multipart 업로드. 기존 활성 건 자동 비활성 |
| PATCH | `/{flMpnId}/active` | `ROLE_ADMIN` | 되돌리기(`true`) / 현재 가이드 내리기(`false`) |

`UserGuideDto.Response` 필드: `flMpnId`, `flNm`, `apgFlSz`, `active`, `downloadUrl`,
`fstEnrDtm`, `fstEnrUsid`.

`downloadUrl`은 `/api/files/{flMpnId}/download` 상대 경로다.

### 5.3 오류 처리

| 상황 | 응답 |
| --- | --- |
| 허용 확장자 밖 | `CustomGeneralException` → 400, 허용 목록을 메시지에 담는다 |
| `flMpnId` 없음 | `CustomGeneralException` → 400 |
| 대상이 `사용자가이드` 종류가 아님 | `AccessDeniedException` → 403 |
| `active` 누락 | `ActiveRequest`의 Bean Validation → 400 |
| 관리자 아님 | `@PreAuthorize` → 403 |

`GET /active`의 `204`는 "가이드가 아직 없음"이라는 정상 상태다. 조회 실패(5xx·네트워크)와
구분되며, 프론트는 이 둘을 같은 화면으로 합치지 않는다(§6.2).

## 6. 프론트엔드 설계

### 6.1 신규 파일

- `app/composables/useUserGuide.ts` — 4개 엔드포인트 래퍼
- `app/pages/admin/user-guides.vue` — 관리 화면 (`definePageMeta({ middleware: 'admin' })`)
- `app/components/layout/UserGuideButton.vue` — 헤더 버튼

`AppHeader.vue`는 이미 크므로 버튼을 별도 컴포넌트로 분리하고, 우측 영역의
`<GlobalSearchBar />` **바로 앞**에 삽입한다.

### 6.2 헤더 버튼 상태

조회 실패를 "가이드 없음"으로 위장하지 않는다(루트 `CLAUDE.md` §4).

| 상태 | 표시 |
| --- | --- |
| 조회 중 | 숨김 (깜빡임 방지) |
| 성공 · 가이드 있음 | 버튼 노출. 클릭 시 인증 쿠키를 포함해 Blob을 받아 저장 |
| 성공 · 가이드 없음(`204`) | 숨김 |
| 조회 실패 | 버튼 노출. 클릭 시 재조회하고, 그래도 실패하면 오류 토스트 |

다운로드는 `useAttachmentDownload`와 같은 방식으로 `$apiFetch`에 `responseType: 'blob'`을 써서
받는다. 다운로드 URL은 인증이 필요하므로 `<a href>`로 직접 열지 않는다.

### 6.3 관리 화면

- 목록 컬럼: 파일명, 크기, 등록자(`EmployeeLink`), 등록일시, 현재 가이드 여부
- 헤더 액션: [가이드 업로드] — 숨김 `file input`을 여는 방식(배너 화면과 동일)
- 행 액션: [내려받기]. 현재 가이드 행에는 [현재 가이드 내리기], 이력 행에는 [현재 가이드로 지정]
- 확장자는 요청 전에 프론트에서 먼저 걸러 토스트로 알린다(서버 거절 전 사용자 안내)

### 6.4 i18n

`i18n/messages/admin.ts`에 `admin.userGuides.*`, `i18n/messages/layout.ts`에
`layout.header.userGuide.*`를 ko·en 양쪽에 추가한다.

## 7. 데이터베이스 마이그레이션

`it_database/migrations/V20260830_003__SeedUserGuideAdminMenu.sql` — 재실행 안전.
배너 선례의 메뉴 시드와 권한 매핑 시드를 한 파일로 합친다.

1. `TPRMPP_CMENUD` — 경로 카탈로그 `/admin/user-guides` (`AdminMenuService`가 PGE 메뉴 저장 시 요구)
2. `TPRMPP_CMENUM` — 메뉴 행. 부모 `MADM0010`(콘텐츠 관리), `MNU_TP_C='PGE'`, 아이콘 `pi pi-book`
3. `TPRMPP_CLANGM` — 영문 메뉴명 `User Guide`
4. `TPRMPP_CMENUA` — `ITPAD001` 권한 매핑. 매핑 0건은 `MenuQueryService`가 전체 공개로 취급하므로 반드시 채운다

부모 `MADM0010`이 없는 스키마에서는 조용히 건너뛴다. 같은 화면경로의 활성 메뉴가 이미 있으면
건너뛴다.

검증 스크립트 `it_database/migrations/_verify/user-guide-menu-seed-verify.sql`을 함께 추가한다.

`utils/menuPresentation.ts`의 `MENU_ICON_OPTIONS`에는 `pi pi-book`이 이미 있으므로 메뉴관리
화면에서 다시 선택할 수 있다. 프론트 수정은 필요 없다.

## 8. 테스트

**백엔드**

- `UserGuideServiceTest` — 업로드 시 기존 활성 건 비활성, 되돌리기 후에도 활성 1건, 확장자 거절, 종류 봉인(`사용자가이드`가 아닌 파일 거부)
- `UserGuideControllerTest` — 비관리자 403, 가이드 없을 때 `204`, `active` 누락 400
- `UserGuideFileReadAuthorizerTest` — 담당 종류, 인증 사용자 허용 / `null` 거부

**프론트엔드**

- `UserGuideButton` — §6.2의 네 상태, 다운로드 호출과 실패 토스트
- `pages/admin/user-guides` — 업로드 성공·확장자 거절·되돌리기 흐름

**계약**

백엔드 DTO·OpenAPI 확정 후 `npm run codegen` → `npm run codegen:check`. 생성 타입은 수기로
편집하지 않는다.

**Health Stack**

```powershell
cd C:\it\it_backend; ./gradlew test
cd C:\it\it_frontend; npm run format:check; npm run check; npm test
cd C:\it; ./scripts/update-versions-lock.ps1
```

## 9. 후속 과제 후보

- 가이드 내려받기 이력 집계 (누가 언제 받았는지)
- 가이드 여러 건을 주제별로 노출하는 목록 UI
