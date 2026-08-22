# 메뉴 관리 준비중 체크박스와 준비중 경로 자동 등록 설계

작성일: 2026-08-22

## 1. 배경

아직 화면이 없는 메뉴는 공용 준비중 화면(`app/pages/preparing/[[slug]].vue`)을 가리킨다.
이 화면 하나가 `/preparing`과 `/preparing/{slug}`를 모두 처리하므로 프론트 코드는 건드릴
필요가 없지만, 준비중 메뉴를 하나 늘리려면 관리자가 두 화면을 오가야 한다.

1. `/admin/routes`에서 `/preparing/{slug}`를 직접 입력해 카탈로그에 등록한다.
2. `/admin/menus`에서 그 경로를 골라 메뉴를 만든다.

`AdminMenuService.requireUsableCatalogPath()`가 PGE 메뉴에 활성 카탈로그 행을 요구하므로
1번을 건너뛸 수 없다. 게다가 `app.vue`가 페이지를 KeepAlive로 캐시하고 `/admin/menus`는
라우트 카탈로그를 setup에서 한 번만 조회하므로, 1번을 마치고 2번으로 돌아와도 방금 등록한
경로가 선택지에 없다(새로고침해야 보인다).

slug는 관리자가 매번 손으로 짓는다. 현재 등록분은 `/preparing/audit-daily`,
`/preparing/audit-daily-manage`, `/preparing/cdp`, `/preparing/project` 4건이다.

## 2. 목표

1. `/admin/menus` 한 화면에서 준비중 메뉴를 만든다.
2. 준비중 경로 이름을 사람이 짓지 않는다. 기존 경로와 절대 겹치지 않게 서버가 만든다.
3. 준비중이던 메뉴를 실제 화면으로 바꾸면 자동 생성했던 경로를 자동으로 회수한다.

## 3. 범위 밖

- 준비중 화면 자체의 표시 변경. 제목·아이콘·영역명은 지금처럼 메뉴 트리에서 읽는다.
- 기존 수동 등록 준비중 경로 4건의 정리·개명. 그대로 둔다.
- `/admin/routes` 화면 변경. 자동 생성분도 그 목록에 일반 행으로 보인다.
- `admin/menus`의 KeepAlive 재조회 일반화(`onActivated` 패턴 도입). 이 설계는 저장 직후
  자기 화면의 카탈로그만 갱신한다.

## 4. 설계 결정

### 4.1 처리 위치 — 백엔드 한 트랜잭션

프론트가 `createRoute()` 후 `createMenu()`를 부르는 안은 두 가지 이유로 채택하지 않는다.

- 경로 이름이 메뉴 ID 기반인데 `mnuId`는 `CmenumRepositoryImpl.nextMnuId()`가 서버에서
  채번한다. 프론트는 저장 전에 경로를 만들 수 없다.
- 중간 실패 시 어느 메뉴도 참조하지 않는 카탈로그 행이 남는다.

서버가 카탈로그 등록과 메뉴 저장을 한 트랜잭션에서 처리하면 둘 다 사라진다.

### 4.2 경로 이름 — 메뉴 ID 기반

자동 생성 경로는 `/preparing/{mnuId 소문자}`다. 예: `MNU0001018` → `/preparing/mnu0001018`.

`mnuId`가 유일하므로 중복 탐색이나 재시도 없이 충돌이 불가능하다. 순번 기반(`temp-4`)은
기존 경로를 조회해 번호를 정해야 하고 동시 저장 시 경합이 생긴다. 메뉴명 기반 슬러그는
한글 메뉴명에서 만들 수 없고 메뉴명을 바꾸면 경로와 어긋난다.

경로만 보고 어느 메뉴인지 알기 어려운 점은 카탈로그 경로명(`SRE_MNU_NM`)에
`{메뉴명} (준비중)`을 넣어 보완한다. 이 값은 `/admin/routes` 목록과 `/admin/menus`의
경로 선택지 라벨에 그대로 쓰인다.

부수 효과로 준비중 메뉴 둘이 같은 경로를 갖는 상황이 구조적으로 불가능해진다. 같은 경로를
쓰는 메뉴가 둘이면 `useMenu.ts`의 `indexByPath()`가 나중 노드로 덮어써 탭 제목·브레드크럼·
사이드바 활성 표시가 한쪽으로 고정된다(같은 날 `/admin/menus` 중복에서 확인된 증상).

### 4.3 준비중 여부의 단일 출처 — 경로 접두

준비중 여부를 별도 컬럼으로 저장하지 않는다. `srePth`가 `/preparing/`로 시작하면 준비중이다.
컬럼을 추가하면 경로와 플래그가 어긋날 수 있고, 마이그레이션으로 기존 4건을 채워야 한다.

따라서 `MenuNode` 응답에는 필드를 추가하지 않는다. 프론트 체크박스는 `srePth` 접두로
상태를 복원한다.

### 4.4 자동 회수 범위 — 자기 메뉴의 자동 경로만

체크를 해제하고 실제 경로로 바꿔 저장하면, 직전 경로가 **정확히 그 메뉴의 자동 경로**
(`/preparing/{그 메뉴 mnuId 소문자}`)일 때만 카탈로그 행을 논리삭제한다.

`/preparing/cdp` 같은 수동 등록 경로는 다른 메뉴가 쓸 수 있고 사람이 의미를 담아 만든
값이므로 건드리지 않는다. 같은 이유로 이미 `/preparing/`로 시작하는 경로를 가진 메뉴를
준비중으로 저장하면 그 경로를 그대로 유지하고 자동 경로로 갈아치우지 않는다.

## 5. API 계약

`MenuDto.UpsertRequest`에 필드 하나를 추가한다.

```java
@Schema(description = "준비중 여부 Y/N. Y면 서버가 준비중 경로를 만들어 카탈로그에 등록하고 srePth는 무시한다")
private String preparingYn;
```

`hidYn`과 같이 Y/N 문자열을 쓴다. null은 `N`으로 본다. 요청 DTO 전용 필드이며 `Cmenum`에
저장하지 않는다.

계약이 바뀌므로 백엔드 기동 후 프론트에서 `npm run codegen`으로 `app/types/api.d.ts`를
재생성하고 `npm run codegen:check`을 통과시킨다.

## 6. 서버 동작

`AdminMenuService`에 준비중 경로 해석 단계를 추가한다.

### 6.1 준비중 경로 상수와 판정

`MenuPathPolicy`에 접두 상수와 판정을 둔다. 프론트도 같은 규약을 쓰므로
`app/utils/menuPath.ts`에 대응 헬퍼(`PREPARING_PATH_PREFIX`, `isPreparingPath()`)를 둔다.

### 6.2 생성 (`create`)

현재는 `validateTypePath(req)` → `nextMnuId()` 순서다. 준비중이면 경로가 `mnuId`에서
나오므로 순서를 바꾼다.

1. `validateHierarchy(mnuTpC, hrkMnuId)`
2. `mnuId = nextMnuId()`
3. 준비중이면 `resolvePreparingPath(mnuId, null, req)` — 아래 6.4. 생성에는 비교할
   기존 경로가 없으므로 항상 새 경로를 만든다
4. `validateTypePath(mnuTpC, 확정된 경로)`
5. 기존과 같이 `Cmenum` 저장 + `replaceRoles`

### 6.3 수정 (`update`)

1. `load(mnuId)`로 기존 메뉴를 읽고 직전 `srePth`를 기억한다
2. 준비중이면 `resolvePreparingPath(mnuId, 직전 srePth, req)`, 아니면 `req.getSrePth()`
3. `validateTypePath` → `validateHierarchy`
4. 필드 반영
5. 준비중이 아니고 직전 경로가 `/preparing/{mnuId 소문자}`와 정확히 같으면 그 `Cmenud`를
   논리삭제한다(4.4). 메뉴가 이미 새 경로를 가리킨 뒤이므로 참조 중 삭제가 아니다.

### 6.4 준비중 경로 해석 (`resolvePreparingPath`)

```
if (mnuTpC != "PGE")  -> 400 "준비중은 페이지화면만 가능합니다."

# 저장된 메뉴의 현재 경로만 본다. 생성은 비교 대상이 없으므로 항상 새 경로를 만들고,
# 요청 본문의 srePth는 어느 쪽에서도 쓰지 않는다.
if (수정 && 저장된 메뉴의 srePth가 /preparing/로 시작) -> 그 경로를 그대로 쓴다
else                                                 -> path = "/preparing/" + mnuId.toLowerCase()

Cmenud 조회(path, DEL_YN='N')
  없으면 생성: SRE_MNU_NM = "{메뉴명} (준비중)", USE_YN='Y', RMK='준비중 메뉴 자동 등록'
  있으면  재사용하고 SRE_MNU_NM만 현재 메뉴명 기준으로 갱신
return path
```

같은 메뉴를 다시 저장해도 같은 경로가 나오고 카탈로그 행은 하나만 유지되므로 멱등하다.

## 7. 프론트 동작 (`app/pages/admin/menus/index.vue`)

- `form`에 `preparingYn` 추가. `startNew()`는 `'N'`, `loadForm()`은
  `isPreparingPath(n.srePth) ? 'Y' : 'N'`으로 복원한다.
- 화면경로 라벨 옆에 `Checkbox` **준비중**. `form.mnuTpC === 'PGE'`일 때만 보인다.
- 체크되면 경로 `Select`를 `disabled`로 두고 안내 문구를 띄운다:
  *저장하면 준비중 경로가 자동으로 등록됩니다.*
- 유형을 PGE 밖으로 바꾸면 `preparingYn`을 `'N'`으로 되돌린다(기존 `mnuTpC` 워처에서
  `srePth`를 비우는 자리와 같은 곳).
- `saveDisabled`의 `(PGE|LNK) && !srePth` 조건에서 `preparingYn === 'Y'`를 예외로 둔다.
- `save()` 성공 후 기존 두 재조회(관리 트리·사이드바)에 더해 라우트 카탈로그
  `refresh()`를 호출한다. 자동 등록된 경로가 같은 화면의 선택지에 바로 반영되어야 한다.

문구는 `i18n/messages/admin.ts`의 `admin.menus`에 한국어·영어를 함께 추가한다.

## 8. 테스트

**백엔드** (`AdminMenuServiceTest`)

- 준비중으로 생성하면 `/preparing/{mnuid}` 메뉴와 카탈로그 행이 함께 생긴다
- 같은 메뉴를 준비중으로 다시 저장해도 카탈로그 행이 늘지 않고 경로가 같다
- 메뉴명을 바꿔 다시 저장하면 카탈로그 경로명이 새 메뉴명으로 갱신된다
- 준비중을 해제하고 실제 경로로 바꾸면 자동 경로 카탈로그가 논리삭제된다
- 수동 등록 `/preparing/cdp`를 쓰던 메뉴는 준비중으로 저장해도 경로가 유지되고,
  해제해도 그 카탈로그 행이 남는다
- `GRP`·`LNK`에 `preparingYn='Y'`를 보내면 400

**프론트** (`tests/unit/pages/`)

- PGE일 때만 준비중 체크박스가 보인다
- 체크하면 경로 Select가 비활성이고 경로 없이도 저장 버튼이 활성이다
- `/preparing/*` 경로를 가진 메뉴를 선택하면 체크박스가 체크 상태로 복원된다
- 저장 성공 후 라우트 카탈로그 재조회가 호출된다

## 9. 문서·계약 영향

- `app/types/api.d.ts` 재생성(§5)
- 백엔드 OpenAPI 스키마는 DTO 주석으로 자동 반영된다
- DB 스키마 변경 없음 — 마이그레이션 불필요
