# 공용 준비중 페이지 (`/preparing/{slug}`) 설계

- 작성일: 2026-08-09
- 상태: 승인됨

## 배경

준비중 안내 화면이 `it_frontend/app/pages/cdp/index.vue` 한 곳에만 존재하고 문구도 "IT/AI CDP"로 하드코딩돼 있다. 화면이 아직 없는 메뉴가 늘어날 때마다 준비중 페이지 파일을 새로 만들어야 한다.

현재 배선:

- 메뉴 `MCDP0001` (`MNU_NM='준비중'`, `MNU_TP_C='PGE'`, 헤더 `MHED0003` IT/AI CDP) → `SRE_PTH='/cdp'`
- 라우트 카탈로그 `TPRMPP_CMENUD`에 `/cdp` 행 등록

> 메뉴 유형은 V20260804_001에서 구 `LNK`(내부화면)가 전부 `PGE`로 이관됐고 `LNK`는 외부 링크 전용으로 재정의됐습니다. 준비중 메뉴는 `PGE`입니다.

## 목표

준비중 화면을 메뉴에 종속되지 않은 공용 URL로 분리하고, 새 준비중 메뉴를 **프론트 코드 변경 없이** 관리자 화면에서만 추가할 수 있게 한다.

## 설계

### 1. URL 형태 — `/preparing/{slug}`

`TPRMPP_CMENUD.SRE_PTH`가 PK이고 프론트 `useMenu().nodeByPath`도 경로를 키로 쓰므로, 여러 메뉴가 같은 경로를 가리키면 탭 제목과 Breadcrumb이 한 메뉴 기준으로 덮어써진다. 준비중 메뉴마다 고유 경로를 갖도록 슬러그를 붙인다.

### 2. 프론트엔드

**신규** `it_frontend/app/pages/preparing/[[slug]].vue`

- Nuxt 선택적 동적 파라미터로 `/preparing`과 `/preparing/{slug}`를 파일 하나가 처리한다.
- 제목은 `useMenu().nodeByPath`에서 현재 경로의 `mnuNm`을 읽는다. 화면에 메뉴 구조를 하드코딩하지 않는다는 규칙(`it_frontend/CLAUDE.md` §4)에 맞고, 관리자가 메뉴명을 바꾸면 화면도 따라간다.
- 메뉴 트리에 없는 경로로 직접 진입하면 일반 문구(`준비 중`)로 폴백한다.
- 탭 제목·Breadcrumb은 `AppHeader`/`AppBreadcrumb`가 이미 `nodeByPath`로 채우므로 `definePageMeta({ tabTitle })`을 두지 않는다.
- 권한 가드 없음 — 전역 `auth.global.ts`만 적용(현행 `/cdp`와 동일).

**삭제** `it_frontend/app/pages/cdp/index.vue`

### 3. 데이터

`it_database/migrations/V20260809_002__MoveCdpPlaceholderToPreparingRoute.sql` + 보정 `V20260809_003__FixCdpPlaceholderRepointMenuType.sql`

1. `TPRMPP_CMENUD`에 `/preparing/cdp` 삽입 (`SRE_MNU_NM='IT/AI CDP 준비중'`, 멱등)
2. CDP 헤더(`MHED0003`) 하위의 `/cdp` 메뉴를 `SRE_PTH='/preparing/cdp'`로 repoint
3. `TPRMPP_CMENUD`의 `/cdp` 행을 `DEL_YN='Y'`로 논리 삭제 — 단 다른 메뉴가 아직 `/cdp`를 참조하면 dead link가 되므로 건드리지 않음

_002는 대상을 `MNU_TP_C='LNK'`로 찾아 0건이 갱신됐고(유형이 이미 `PGE`), 적용된 스크립트는 수정하지 않으므로 _003으로 보정했습니다. `/cdp`를 가리키는 활성 메뉴가 둘 이상일 수 있어 경로만으로는 대상을 특정할 수 없고, 상위 메뉴(`HRK_MNU_ID='MHED0003'`)까지 함께 봅니다.

`TPRMPP_CMENUM.SRE_PTH`와 `TPRMPP_CMENUD` 사이에 물리 FK가 없어(논리 전제만 존재) 순서 제약이 없고, 논리 삭제라 이력이 남는다.

### 4. 테스트

`it_frontend/tests/unit/pages/preparing-page.test.ts`

- 메뉴 트리에 있는 경로 → 해당 메뉴명을 제목으로 표시
- 메뉴 트리에 없는 경로 → 일반 폴백 문구 표시

### 5. 운영 절차

새 준비중 메뉴 추가는 코드 배포 없이 관리자 화면에서 완결된다.

1. 관리자 > 라우트 카탈로그에서 `/preparing/{이름}` 등록
2. 관리자 > 메뉴에서 해당 경로를 가리키는 `PGE` 메뉴 생성

이 절차를 `it_frontend/docs/guides/architecture/preparing-page.md`에 기록한다.

## 범위 밖

- `/cdp` → `/preparing/cdp` 리다이렉트 (경로를 하나로 정리하기로 결정)
- 준비 예정일·담당자 등 부가 정보 표시
