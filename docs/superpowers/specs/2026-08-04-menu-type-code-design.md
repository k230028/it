# 메뉴유형코드 MNU_TP_C 정합 설계

## 목표

메뉴관리(`/admin/menus`)의 유형 입력을 하드코딩 배열 대신 공통코드 `MNU_TP_C` 조회 결과로 선택·저장하게 한다. 이를 위해 코드표가 정의한 세 값(GRP·LNK·PGE)을 시스템의 유일한 메뉴유형 체계로 삼고, 현재 코드에만 존재하는 HED·DYN을 제거한다.

## 배경

메뉴유형은 현재 세 곳에 하드코딩되어 있고 코드표와 어긋난다.

| 위치 | 값 |
| --- | --- |
| `it_frontend/app/pages/admin/menus/index.vue` Select | `HED`, `GRP`, `LNK`, `DYN` |
| `it_frontend/app/types/menu.ts`·`app/composables/useAdminMenu.ts` union | `LNK`, `GRP`, `DYN`, `HED` |
| `it_backend` `AdminMenuService.validateTypePath` 화이트리스트 | `LNK`, `GRP`, `DYN`, `HED` |
| 공통코드 `TPRMPP_CCODEM` (`CO_C_ID_NM='MNU_TP_C'`) | `GRP`(메뉴그룹), `LNK`(링크메뉴), `PGE`(페이지화면) |

코드표는 `it_database/migrations/V20260720_008__AlignCommonCodesWithProd.sql`이 운영 기준으로 시드했다. 같은 파일 주석은 "CMENUM의 개발 전용 메뉴유형(DYN/HED): 개발환경 전용 값으로 분석 제외"라고 적었으나, 실제로는 두 값 모두 런타임 동작을 좌우한다. 따라서 코드표를 그대로 Select에 연결하면 두 가지가 깨진다.

- 기존 헤더(HED) 메뉴를 편집하면 유형이 빈 값으로 보이고, 저장 시 상단 내비게이션이 사라진다.
- `PGE`를 선택하면 백엔드 화이트리스트에 없어 `400 잘못된 메뉴유형코드: PGE`로 저장이 실패한다.

## 결정

### 유형 매핑

| 현재 | 이후 | 근거 |
| --- | --- | --- |
| `HED` | `GRP` | `validateHierarchy`가 이미 "HED ⟺ 루트"를 강제하므로 유형은 `hrkMnuId == null`과 중복된 진실이다. 상단 헤더는 `useMenu`에서 `headers = tree`(루트 그대로)로 뽑으므로 유형을 보지 않는다. |
| `DYN` | `GRP` | 노드가 `MBRD0001` 하나뿐이고, `MenuQueryService.resolveDyn`은 이미 유형이 아니라 resolver 레지스트리의 `mnuId` 일치로 자식을 만든다. |
| `LNK` | `PGE` | 화면경로를 가진 기존 메뉴는 전부 라우트 카탈로그의 내부 화면이다. |
| — | `LNK` | 외부 URL·타 시스템 링크 전용으로 신설한다. 이번 범위에서는 저장을 차단한다. |

`PGE`는 내부 화면, `LNK`는 외부 링크로 정의한다.

### 전환 방식

원자적 전환을 택한다. 백엔드는 신규 세 값만 허용하고, 데이터 이관은 DB 마이그레이션이 한 번에 수행한다. 구값 수용 분기나 조회 시 변환 레이어를 두지 않는다. 임시 분기가 남지 않고 DB에 두 체계가 공존하지 않는 대신, 배포 순서를 지켜야 하며 그 사이 짧은 구간에서 메뉴 저장이 실패할 수 있다.

## 동작 계약

- 메뉴관리 화면의 유형 Select는 `/api/ccodem/MNU_TP_C` 조회 결과를 `C_SQN_SNO` 순으로 렌더한다. 화면에 유형 값을 하드코딩하지 않는다.
- 유형 라벨은 코드값명(`메뉴그룹`·`링크메뉴`·`페이지화면`)을 표시하고, 저장 값은 코드값(`GRP`·`LNK`·`PGE`)을 보낸다.
- `PGE` 메뉴는 화면경로가 필수이며 라우트 카탈로그(`TPRMPP_CMENUD`)에 존재해야 한다.
- `GRP` 메뉴는 화면경로를 가질 수 없다.
- `LNK` 메뉴는 저장할 수 없다. 화면은 선택 시 미지원 안내를 표시하고 저장 버튼을 비활성화하며, 백엔드도 400으로 거부한다.
- 루트 메뉴(상위 없음)는 `GRP`만 허용한다. `PGE`와 `LNK`는 상위 메뉴가 필수다.
- 동적 게시판 노드는 유형과 무관하게 resolver 레지스트리에 `mnuId`가 등록된 경우에만 자식을 생성한다.
- 사용자 메뉴 트리에서 자식이 0개가 된 `GRP` 노드는 계속 제거한다.
- Breadcrumb에서 클릭 가능한 항목은 `PGE` 노드다.

## 구현 구조

### 데이터 마이그레이션 (`it_database/migrations/`)

`V20260804_001__AlignMenuTypeWithMnuTpC.sql`을 추가한다.

```sql
UPDATE ITPOWN.TPRMPP_CMENUM SET MNU_TP_C = 'GRP' WHERE MNU_TP_C IN ('HED','DYN');
UPDATE ITPOWN.TPRMPP_CMENUM SET MNU_TP_C = 'PGE' WHERE MNU_TP_C = 'LNK';
COMMIT;
```

soft-delete된 행도 복구 시 유효해야 하므로 `DEL_YN` 조건 없이 전량 갱신한다. 로그 테이블 `TPRMPP_CMENUML`은 갱신하지 않는다 — `V20260720_008`이 세운 "로그 테이블의 코드값은 감사 이력 보존 원칙에 따라 과거 저장값을 변경하지 않는다"를 따른다. 스크립트 헤더에 `V20260720_008` 주석의 "DYN/HED는 개발환경 전용 값" 판단이 이번 정합으로 무효가 되었음을 남긴다.

### 백엔드 (`it_backend`)

`AdminMenuService`

- `validateTypePath`의 화이트리스트를 `List.of("GRP","LNK","PGE")`로 교체한다.
- 기존 `LNK` 분기의 규칙(화면경로 필수 + 라우트 카탈로그 존재 확인)을 `PGE` 분기로 옮긴다.
- `LNK`는 `400 외부링크 메뉴는 아직 지원하지 않습니다`로 거부한다.
- `GRP`는 화면경로를 가질 수 없다는 기존 규칙을 유지한다.
- `validateHierarchy`의 `"HED".equals(mnuTpC)` 판정을 계층 위치 기준으로 바꾼다. 루트(`hrkMnuId == null`)이면 `GRP`여야 하고, `PGE`·`LNK`는 상위 메뉴가 있어야 한다. 유형과 위치가 이중으로 갖던 진실이 하나로 합쳐진다.

`MenuQueryService`

- `buildTree`에서 `"DYN".equals(m.getMnuTpC())` 게이트를 제거하고 resolver 레지스트리 조회 결과로 확장 여부를 판단한다.
- `prune`의 container 판정 `GRP || DYN || HED`를 `GRP`로 단순화한다.

`BoardListMenuResolver`

- `toNode`가 만드는 동적 자식의 `mnuTpC`를 `"LNK"`에서 `"PGE"`로 바꾼다.

`MenuDto.Node`

- `mnuTpC` 필드 주석을 `// GRP / LNK / PGE`로 고친다.

### 프론트엔드 (`it_frontend`)

`app/pages/admin/menus/index.vue`

- `useCodeOptions('MNU_TP_C')`로 옵션을 조회하고 Select에 `option-label="cdNm"`·`option-value="cdId"`로 바인딩한다. 하드코딩 배열을 제거한다.
- 신규 폼 기본 유형을 `'GRP'`로 바꾼다. 이 화면에는 상위메뉴 선택 입력이 없어 `startNew`가 항상 `hrkMnuId: null`로 만들고, 루트는 `GRP`만 허용하기 때문이다. 현재도 기본값 `'LNK'`로는 신규 저장이 계층 검증에 걸려 실패하고 `HED`를 골라야만 성공하므로, `'GRP'` 기본값이 기존 동작과 대등하다. 신규 생성 후 원하는 위치로는 기존처럼 드래그&드롭으로 옮긴다.
- 화면경로 입력 노출 조건을 `mnuTpC === 'PGE'`로 바꾼다.
- `LNK` 선택 시 미지원 안내를 표시하고 저장 버튼을 비활성화한다. 백엔드 400을 그대로 받기보다 화면에서 먼저 알린다.

`app/types/menu.ts`·`app/composables/useAdminMenu.ts`

- `mnuTpC` union을 `'GRP' | 'LNK' | 'PGE'`로 교체한다.

`app/utils/breadcrumb.ts`

- 클릭 가능 판정을 `node?.mnuTpC === 'PGE'`로 바꾼다.

`app/types/api.d.ts`

- 백엔드 스펙 생성물이므로 백엔드 변경 후 재생성하고 `npm run codegen:check`로 드리프트가 없음을 확인한다.

## 오류 처리

- 코드 조회(`/api/ccodem/MNU_TP_C`)가 실패하면 `useCodeOptions`가 빈 배열을 반환한다. 이때 옵션 목록만 비고 `form.mnuTpC`에는 기본값이나 선택 노드의 값이 그대로 남으므로, Select는 라벨이 빈 채로 보이지만 저장은 그 값으로 정상 수행된다. 즉 조회 실패가 잘못된 유형을 저장시키지는 않는다. 사용자가 유형을 바꿀 수 없는 상태이므로 화면은 옵션이 비었을 때 안내 문구를 표시하고, 조회 실패 자체는 기존 공통 오류 Toast로 알린다.
- `LNK` 저장 차단은 화면과 백엔드 양쪽에 둔다. 화면 가드는 UX용이고 최종 판단은 백엔드가 한다.
- 마이그레이션 적용 전 백엔드가 먼저 배포되면 기존 `HED`·`LNK` 메뉴의 저장이 400으로 실패한다. 조회는 유형을 검증하지 않으므로 영향이 없다. 반대로 마이그레이션만 먼저 적용되면 구버전 백엔드가 `GRP` 루트를 "헤더가 아닌 메뉴는 루트로 둘 수 없습니다"로 거부한다. 두 경우 모두 저장 경로에 한정되며 배포 순서로 회피한다.

## 테스트

- `AdminMenuService`: `PGE`의 화면경로 필수·카탈로그 존재 검증, `GRP`의 화면경로 금지, `LNK`의 400, 루트가 `GRP`가 아니면 거부, `PGE`·`LNK`가 루트면 거부.
- `MenuQueryService`: 자식이 빈 `GRP` 노드가 사용자 트리에서 제거되는지, resolver가 등록된 `mnuId`의 노드가 유형과 무관하게 확장되는지.
- `BoardListMenuResolver`: 생성한 동적 자식의 `mnuTpC`가 `PGE`인지.
- `useMenu.test.ts`: `'HED'` 픽스처를 `'GRP'`로 갱신하고 헤더 추출이 루트 기준으로 유지되는지.
- `AppBreadcrumb.test.ts`: `'LNK'` 픽스처를 `'PGE'`로 갱신하고 클릭 가능 판정이 유지되는지.
- `useAdminMenu.test.ts`: 요청 본문의 유형 값 갱신.
- 메뉴관리 화면: 코드 조회 결과로 Select 옵션이 렌더되는지, 신규 폼의 기본 유형이 `GRP`인지, `LNK` 선택 시 저장이 비활성화되는지, 코드 조회가 빈 배열일 때 안내 문구가 표시되는지.
- 마이그레이션 적용 후 상단 헤더 내비게이션과 게시판 동적 메뉴 조회 스모크.

## 커밋과 배포 순서

`it_database` → `it_backend` → `it_frontend` 순으로 커밋하고 같은 순서로 배포한다. 백엔드 계약 커밋이 이를 참조하는 프론트 커밋보다 먼저 온다는 루트 `CLAUDE.md`의 4-repo 규약을 따른다. 완료 후 `scripts/update-versions-lock.ps1`로 `versions.lock`을 갱신한다. 배포 사이 구간에서 메뉴 저장이 일시적으로 실패할 수 있음을 릴리스 노트에 남긴다.

로컬은 `local-ext`·`local-int` 프로파일에서 Flyway가 마이그레이션을 자동 적용한다. dev·prod는 DBA가 적용한다.

## 제외 범위

- 외부링크(`LNK`) 메뉴의 URL 입력, 검증, 사이드바·헤더 렌더링, 새 탭 오픈은 구현하지 않는다. 실수요가 생길 때 별도로 설계한다.
- 공통코드 `MNU_TP_C`의 코드값·코드값명은 변경하지 않는다.
- 메뉴 권한(`athIds`) 편집, 드래그&드롭 이동, 삭제 동작은 변경하지 않는다.
- 로그 테이블 `TPRMPP_CMENUML`의 기존 저장값은 변경하지 않는다.
