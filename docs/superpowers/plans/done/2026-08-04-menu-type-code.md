# 메뉴유형코드 MNU_TP_C 정합 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메뉴관리 화면의 유형 입력을 공통코드 `MNU_TP_C`(GRP·LNK·PGE) 조회 결과로 선택·저장하게 하고, 코드표에 없는 `HED`·`DYN`을 시스템에서 제거한다.

**Architecture:** 코드표를 유일한 메뉴유형 체계로 삼는 원자적 전환이다. DB 마이그레이션이 `HED`·`DYN`→`GRP`, `LNK`→`PGE`로 기존 데이터를 한 번에 이관하고, 백엔드는 신규 세 값만 허용하도록 검증을 교체하며, 프론트는 하드코딩 배열을 코드 조회로 바꾼다. 구값 수용 분기나 조회 시 변환 레이어를 두지 않는다.

**Tech Stack:** Oracle + Flyway (`it_database/migrations`), Spring Boot + JUnit5 + Mockito + AssertJ (`it_backend`), Nuxt 4 + Vue 3 + PrimeVue + Vitest (`it_frontend`)

## Global Constraints

- 설계 SoT는 `docs/superpowers/specs/2026-08-04-menu-type-code-design.md`다. 계약이 모호하면 코드가 아니라 스펙을 따른다.
- 유효한 메뉴유형은 정확히 `GRP`, `LNK`, `PGE` 셋뿐이다. 어떤 파일에도 `HED`·`DYN` 문자열을 남기지 않는다(로그 테이블 `TPRMPP_CMENUML`의 기존 DB 저장값은 예외로 손대지 않는다).
- `PGE` = 내부 화면(라우트 카탈로그 경로 필수), `LNK` = 외부 링크(이번 범위에서는 저장 차단), `GRP` = 컨테이너(화면경로 금지).
- 루트 메뉴(`hrkMnuId == null`)는 `GRP`만 허용한다.
- 커밋과 배포 순서는 `it_database` → `it_backend` → `it_frontend`다. 레포마다 `git -C <경로>`로 각자의 `main`에 커밋한다.
- 신규 주석은 한글로 쓴다(루트 `CLAUDE.md` §4.1).
- 마이그레이션 파일명은 `V{YYYYMMDD_NNN}__{CamelCase설명}.sql`이며 적용된 스크립트는 수정하지 않는다.

## File Structure

| 파일 | 책임 | 변경 |
| --- | --- | --- |
| `it_database/migrations/V20260804_001__AlignMenuTypeWithMnuTpC.sql` | 기존 메뉴유형 데이터 이관 | 생성 |
| `it_backend/.../menu/service/AdminMenuService.java` | 쓰기 경로의 유형·경로·계층 검증 | 수정 |
| `it_backend/.../menu/service/MenuQueryService.java` | 트리 조립, 동적 확장, 빈 컨테이너 제거 | 수정 |
| `it_backend/.../menu/service/MenuChildrenResolver.java` | 동적 확장 지점 계약(주석만) | 수정 |
| `it_backend/.../menu/service/BoardListMenuResolver.java` | 게시판 동적 자식 생성 | 수정 |
| `it_backend/.../menu/dto/MenuDto.java` | 응답 DTO(주석만) | 수정 |
| `it_frontend/app/types/menu.ts`, `app/composables/useAdminMenu.ts` | 메뉴유형 union 타입 | 수정 |
| `it_frontend/app/utils/breadcrumb.ts` | Breadcrumb 클릭 가능 판정 | 수정 |
| `it_frontend/app/pages/admin/menus/index.vue` | 유형 Select의 코드 연동 | 수정 |
| `it_frontend/app/types/api.d.ts` | 백엔드 스펙 생성물 | 재생성 |
| `it_frontend/tests/support/adminMenusPage.ts` | 메뉴관리 화면 마운트 하네스(테스트 전용) | 생성 |

테스트는 각 대상 옆의 기존 파일을 갱신하고, 화면의 새 동작만 `tests/unit/pages/admin-menus-type-code.test.ts`로 분리한다. 두 화면 테스트 파일이 같은 마운트 배선을 쓰므로 그 배선은 `tests/support/adminMenusPage.ts`로 꺼내 공유한다(Task 5).

---

### Task 1: 메뉴유형 데이터 이관 마이그레이션

**Files:**
- Create: `it_database/migrations/V20260804_001__AlignMenuTypeWithMnuTpC.sql`

**Interfaces:**
- Consumes: 없음
- Produces: `TPRMPP_CMENUM.MNU_TP_C`가 `GRP`·`LNK`·`PGE`만 갖는 상태. 이후 모든 백엔드 태스크가 이 상태를 전제한다.

- [ ] **Step 1: 마이그레이션 스크립트 작성**

`it_database/migrations/V20260804_001__AlignMenuTypeWithMnuTpC.sql`:

```sql
--- ============================================================================
--- 메뉴유형코드(MNU_TP_C)를 공통코드 기준으로 정합
--- ============================================================================
--- TPRMPP_CMENUM.MNU_TP_C를 공통코드 MNU_TP_C가 정의한 세 값으로 이관한다.
---   HED(헤더), DYN(동적게시판) → GRP(메뉴그룹)
---   LNK(구: 내부화면)          → PGE(페이지화면)
--- 이후 LNK는 외부 링크 전용 값으로 재정의된다.
---
--- [HED 제거 근거]
---   AdminMenuService가 "HED ⟺ 루트"를 강제해 왔으므로 유형은 HRK_MNU_ID IS NULL과
---   중복된 진실이었다. 상단 헤더는 트리 루트를 그대로 사용하므로 유형을 보지 않는다.
--- [DYN 제거 근거]
---   동적 노드는 MBRD0001 하나뿐이고 MenuChildrenResolver가 이미 유형이 아니라
---   MNU_ID 일치로 자식을 만든다.
---
--- [V20260720_008 주석 정정]
---   해당 스크립트는 "CMENUM의 개발 전용 메뉴유형(DYN/HED): 개발환경 전용 값으로 분석
---   제외"라고 기록했으나, 두 값은 실제로 런타임 동작을 좌우했다. 이 스크립트로 그
---   판단을 무효화하고 코드표를 유일한 체계로 삼는다.
---
--- [로그 테이블 제외]
---   TPRMPP_CMENUML은 갱신하지 않는다. V20260720_008이 세운 "로그 테이블의 코드값은
---   감사 이력 보존 원칙에 따라 과거 저장값을 변경하지 않는다"를 따른다.
---
--- [DEL_YN 조건 없음]
---   soft-delete된 행도 복구 시 유효해야 하므로 전량 갱신한다.
--- ============================================================================

UPDATE ITPOWN.TPRMPP_CMENUM SET MNU_TP_C = 'GRP' WHERE MNU_TP_C IN ('HED','DYN');

UPDATE ITPOWN.TPRMPP_CMENUM SET MNU_TP_C = 'PGE' WHERE MNU_TP_C = 'LNK';

COMMIT;
```

- [ ] **Step 2: 적용 전 상태를 기록**

sqlplus 콘솔에 접속해 비밀번호를 프롬프트에 입력한 뒤 실행한다.

Run:
```bash
sqlplus ITPAPP@127.0.0.1:11521/XEPDB1
```

접속 후:
```sql
SELECT MNU_TP_C, COUNT(*) FROM ITPOWN.TPRMPP_CMENUM GROUP BY MNU_TP_C ORDER BY MNU_TP_C;
```

Expected: `HED`, `GRP`, `LNK`, `DYN` 중 일부가 나온다. 각 건수를 적어 둔다. `PGE`는 0건이다.

- [ ] **Step 3: 로컬 백엔드를 기동해 Flyway로 적용**

Run:
```bash
cd C:/it/it_backend && ./gradlew bootRun --args='--spring.profiles.active=local-ext'
```

Expected: 기동 로그에 `Migrating schema "ITPOWN" to version "20260804.001 - AlignMenuTypeWithMnuTpC"`가 나오고 오류 없이 기동된다. IDE가 아니라 `gradlew bootRun`으로 실행해야 `processResources`가 마이그레이션을 포함한다. 확인 후 기동을 종료한다.

- [ ] **Step 4: 적용 결과 검증**

sqlplus에서:
```sql
SELECT MNU_TP_C, COUNT(*) FROM ITPOWN.TPRMPP_CMENUM GROUP BY MNU_TP_C ORDER BY MNU_TP_C;
```

Expected: `GRP`와 `PGE`만 남는다. `GRP` 건수 = 이전 `HED` + `GRP` + `DYN` 합계, `PGE` 건수 = 이전 `LNK` 건수. `HED`·`DYN`·`LNK`는 0건이다.

```sql
SELECT COUNT(*) FROM ITPOWN.TPRMPP_CMENUM WHERE HRK_MNU_ID IS NULL AND MNU_TP_C <> 'GRP';
```

Expected: `0` — 모든 루트가 `GRP`다. 0이 아니면 이후 백엔드 계층 검증이 기존 데이터를 거부하므로 진행하지 말고 원인을 확인한다.

- [ ] **Step 5: 커밋**

```bash
git -C C:/it/it_database add migrations/V20260804_001__AlignMenuTypeWithMnuTpC.sql
git -C C:/it/it_database commit -m "feat: 메뉴유형코드를 공통코드 MNU_TP_C 기준으로 이관

HED·DYN을 GRP로, 기존 LNK를 PGE로 옮긴다. LNK는 외부 링크 전용 값으로
재정의되며 백엔드 후속 커밋에서 검증이 교체된다."
```

---

### Task 2: 백엔드 유형·계층 검증 교체

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/AdminMenuServiceTest.java`

**Interfaces:**
- Consumes: Task 1이 이관한 `MNU_TP_C` 데이터
- Produces: `private void validateTypePath(String mnuTpC, String srePth)`와 `private void validateHierarchy(String mnuTpC, String hrkMnuId)`의 새 계약. `create`·`update`·`move` 세 경로가 모두 이 검증을 거친다.

- [ ] **Step 1: 실패하는 테스트를 작성**

`AdminMenuServiceTest.java`에서 기존 테스트 4개를 아래로 **교체**한다.

`create_LNK유형_메뉴저장및ID반환` → `create_PGE유형_메뉴저장및ID반환`:

```java
    @Test
    @DisplayName("create: PGE 유형이고 유효한 화면경로이면 메뉴를 저장하고 ID를 반환한다")
    void create_PGE유형_메뉴저장및ID반환() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("예산목록")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .hrkMnuId("P1")
                        .build();
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(Cmenud.builder().srePth("/budget/list").delYn("N").build()));
        given(cmenumRepository.nextMnuId()).willReturn("M0001");
        given(cmenumRepository.findByMnuIdAndDelYn("P1", "N"))
                .willReturn(Optional.of(node("P1", "MHED0002", 2, "/MHED0002/P1")));

        String mnuId = service.create(req);

        assertThat(mnuId).isEqualTo("M0001");
        ArgumentCaptor<Cmenum> captor = ArgumentCaptor.forClass(Cmenum.class);
        verify(cmenumRepository).save(captor.capture());
        assertThat(captor.getValue().getMnuTpC()).isEqualTo("PGE");
        assertThat(captor.getValue().getSrePth()).isEqualTo("/budget/list");
    }
```

`create_HED유형_루트헤더저장` → `create_GRP유형_루트그룹저장`:

```java
    @Test
    @DisplayName("create: GRP 유형이고 화면경로가 없으면 루트 그룹을 저장한다")
    void create_GRP유형_루트그룹저장() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("정보화")
                        .mnuTpC("GRP")
                        .srePth(null)
                        .hrkMnuId(null)
                        .build();
        given(cmenumRepository.nextMnuId()).willReturn("MHED0009");

        String mnuId = service.create(req);

        assertThat(mnuId).isEqualTo("MHED0009");
        ArgumentCaptor<Cmenum> captor = ArgumentCaptor.forClass(Cmenum.class);
        verify(cmenumRepository).save(captor.capture());
        assertThat(captor.getValue().getMnuDep()).isEqualTo(1);
        assertThat(captor.getValue().getWhlMnuPth()).isEqualTo("/MHED0009");
    }
```

`create_LNK유형_화면경로없음_예외` → `create_PGE유형_화면경로없음_예외`:

```java
    @Test
    @DisplayName("create: PGE 메뉴에 화면경로가 없으면 예외를 던진다")
    void create_PGE유형_화면경로없음_예외() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder().mnuNm("페이지").mnuTpC("PGE").srePth(null).build();

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("PGE 메뉴는 화면경로가 필수입니다.");
    }
```

`create_비HED루트_예외` → `create_비GRP루트_예외`:

```java
    @Test
    @DisplayName("create: GRP가 아닌 메뉴를 루트로 생성하면 예외를 던진다")
    void create_비GRP루트_예외() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("루트페이지")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .hrkMnuId(null)
                        .build();
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(Cmenud.builder().srePth("/budget/list").delYn("N").build()));

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최상위(루트) 메뉴는 메뉴그룹(GRP)만 가능합니다.");
    }
```

`move_HED를루트로이동`의 `.mnuTpC("HED")`를 `.mnuTpC("GRP")`로 바꾸고, 주석 `// given: 비-HED는 루트 이동이 금지되므로 HED를 대상으로 루트 이동 재계산을 검증한다.`를 `// given: 루트에는 GRP만 놓을 수 있으므로 GRP를 대상으로 루트 이동 재계산을 검증한다.`로 바꾸며, 테스트명을 `move_GRP를루트로이동`, `@DisplayName`을 `"move: GRP를 루트로 이동하면 depth=1로 재계산한다"`로 바꾼다.

`move_HED를하위로이동_예외`는 **삭제한다.** 헤더와 그룹이 한 유형으로 합쳐지면서 "헤더는 하위로 이동할 수 없다"는 제약이 사라졌다(스펙 동작 계약). 대신 아래 신규 테스트 4개를 추가한다.

```java
    @Test
    @DisplayName("create: LNK 메뉴는 아직 지원하지 않으므로 예외를 던진다")
    void create_LNK유형_미지원_예외() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("외부링크")
                        .mnuTpC("LNK")
                        .srePth("https://example.com")
                        .hrkMnuId("P1")
                        .build();

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("외부링크 메뉴는 아직 지원하지 않습니다.");
    }

    @Test
    @DisplayName("create: 알 수 없는 메뉴유형코드이면 예외를 던진다")
    void create_알수없는유형_예외() {
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder().mnuNm("구헤더").mnuTpC("HED").hrkMnuId(null).build();

        assertThatThrownBy(() -> service.create(req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("잘못된 메뉴유형코드: HED");
    }

    @Test
    @DisplayName("update: 루트 메뉴의 유형을 PGE로 바꾸면 예외를 던진다")
    void update_루트메뉴를PGE로변경_예외() {
        Cmenum root = node("MHED0009", null, 1, "/MHED0009");
        given(cmenumRepository.findByMnuIdAndDelYn("MHED0009", "N")).willReturn(Optional.of(root));
        given(cmenudRepository.findBySrePthAndDelYn("/budget/list", "N"))
                .willReturn(Optional.of(Cmenud.builder().srePth("/budget/list").delYn("N").build()));
        MenuDto.UpsertRequest req =
                MenuDto.UpsertRequest.builder()
                        .mnuNm("루트")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .build();

        assertThatThrownBy(() -> service.update("MHED0009", req))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최상위(루트) 메뉴는 메뉴그룹(GRP)만 가능합니다.");
    }

    @Test
    @DisplayName("move: PGE 메뉴를 루트로 이동하면 예외를 던진다")
    void move_PGE를루트로이동_예외() {
        Cmenum target =
                Cmenum.builder()
                        .mnuId("M0002")
                        .hrkMnuId("P1")
                        .mnuNm("예산목록")
                        .mnuTpC("PGE")
                        .srePth("/budget/list")
                        .mnuSotSqnSno(10)
                        .hidYn("N")
                        .mnuDep(3)
                        .whlMnuPth("/H/P1/M0002")
                        .delYn("N")
                        .build();
        given(cmenumRepository.findByMnuIdAndDelYn("M0002", "N")).willReturn(Optional.of(target));

        assertThatThrownBy(() -> service.move("M0002", null))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("최상위(루트) 메뉴는 메뉴그룹(GRP)만 가능합니다.");
    }

    @Test
    @DisplayName("move: GRP 메뉴를 다른 메뉴 하위로 이동하면 허용한다")
    void move_GRP를하위로이동_허용() {
        Cmenum target = node("MHED0009", null, 1, "/MHED0009");
        Cmenum newParent = node("MHED0001", null, 1, "/MHED0001");
        given(cmenumRepository.findByMnuIdAndDelYn("MHED0009", "N")).willReturn(Optional.of(target));
        given(cmenumRepository.findByMnuIdAndDelYn("MHED0001", "N"))
                .willReturn(Optional.of(newParent));
        given(cmenumRepository.findSubtreeByPathPrefix("/MHED0009")).willReturn(List.of(target));

        service.move("MHED0009", "MHED0001");

        assertThat(target.getHrkMnuId()).isEqualTo("MHED0001");
        assertThat(target.getMnuDep()).isEqualTo(2);
        assertThat(target.getWhlMnuPth()).isEqualTo("/MHED0001/MHED0009");
    }
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminMenuServiceTest"
```

Expected: FAIL. `create_PGE유형_메뉴저장및ID반환`은 `잘못된 메뉴유형코드: PGE`로, `create_비GRP루트_예외`·`update_루트메뉴를PGE로변경_예외`·`move_PGE를루트로이동_예외`는 기대 메시지 불일치로, `move_GRP를하위로이동_허용`은 `헤더(HED)가 아닌 메뉴는...`로 실패한다.

- [ ] **Step 3: 검증 로직 교체**

`AdminMenuService.java`의 `validateTypePath`를 통째로 아래로 바꾼다.

```java
    /**
     * 메뉴유형코드와 화면경로의 조합을 검증한다.
     *
     * <p>유효한 유형은 공통코드 MNU_TP_C가 정의한 GRP·LNK·PGE 셋뿐이다. PGE(페이지화면)는 내부 화면이므로 화면경로가 필수이고 라우트 카탈로그에
     * 등록돼 있어야 한다. GRP(메뉴그룹)는 컨테이너라 화면경로를 가질 수 없다. LNK(링크메뉴)는 외부 링크 전용 값으로 신설했으나 아직 렌더링·URL 검증을
     * 구현하지 않아 저장을 막는다.
     *
     * @param mnuTpC 메뉴유형코드
     * @param srePth 화면경로 (없으면 null)
     * @throws ResponseStatusException 유형이 목록 밖이거나, LNK이거나, 유형·경로 조합이 규칙에 어긋나는 경우
     */
    private void validateTypePath(String mnuTpC, String srePth) {
        if (!List.of("GRP", "LNK", "PGE").contains(mnuTpC))
            throw badRequest("잘못된 메뉴유형코드: " + mnuTpC);
        if ("LNK".equals(mnuTpC)) throw badRequest("외부링크 메뉴는 아직 지원하지 않습니다.");
        if ("PGE".equals(mnuTpC)) {
            if (srePth == null || srePth.isBlank()) throw badRequest("PGE 메뉴는 화면경로가 필수입니다.");
            cmenudRepository
                    .findBySrePthAndDelYn(srePth, "N")
                    .orElseThrow(() -> badRequest("라우트 카탈로그에 없는 경로: " + srePth));
        } else if (srePth != null) {
            throw badRequest(mnuTpC + " 메뉴는 화면경로를 가질 수 없습니다.");
        }
    }
```

`validateHierarchy`를 통째로 아래로 바꾼다.

```java
    /**
     * 최상위(루트) 메뉴는 메뉴그룹(GRP)만 허용한다.
     *
     * <p>종전에는 HED(헤더) 유형이 "루트 전용"을 뜻해 유형과 계층 위치가 같은 사실을 이중으로 표현했다. HED를 GRP로 흡수하면서 판정 근거를 계층
     * 위치 하나로 합쳤다. 그 결과 GRP는 루트와 하위 어디에도 놓일 수 있고, 기존 헤더를 다른 메뉴 하위로 이동하는 것도 허용된다.
     *
     * @param mnuTpC 메뉴유형코드
     * @param hrkMnuId 상위메뉴ID (루트면 null)
     * @throws ResponseStatusException 루트인데 GRP가 아닌 경우
     */
    private void validateHierarchy(String mnuTpC, String hrkMnuId) {
        if (hrkMnuId == null && !"GRP".equals(mnuTpC)) {
            throw badRequest("최상위(루트) 메뉴는 메뉴그룹(GRP)만 가능합니다. 상위 메뉴를 지정하세요.");
        }
    }
```

`update` 메서드에서 `load` 직후에 계층 검증을 추가한다. 아래 두 줄을

```java
        validateTypePath(req.getMnuTpC(), req.getSrePth());
        Cmenum menu = load(mnuId);
```

다음으로 바꾼다.

```java
        validateTypePath(req.getMnuTpC(), req.getSrePth());
        Cmenum menu = load(mnuId);
        // 대상의 현재 계층 위치를 기준으로 다시 검증한다. 이 호출이 없으면 루트 메뉴의 유형만 바꿔 "루트는 GRP" 규칙을 우회할 수 있다.
        validateHierarchy(req.getMnuTpC(), menu.getHrkMnuId());
```

`update`의 JavaDoc `@throws` 문구 `메뉴가 없거나 LNK/GRP/DYN 경로 규칙을 위반하는 경우`를 `메뉴가 없거나 유형·경로·계층 규칙을 위반하는 경우`로 바꾼다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.service.AdminMenuServiceTest"
```

Expected: PASS (전 테스트 통과).

- [ ] **Step 5: 컨트롤러 테스트에 남은 구값 확인**

Run:
```bash
cd C:/it/it_backend && grep -rn "\"HED\"\|\"DYN\"" src/test/java/com/kdb/it/domain/menu/controller/
```

Expected: 출력 없음. 나오면 해당 픽스처의 `HED`→`GRP`, `DYN`→`GRP`로 바꾸고 `./gradlew test --tests "com.kdb.it.domain.menu.controller.*"`가 통과하는지 확인한다.

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/menu/service/AdminMenuService.java src/test/java/com/kdb/it/domain/menu/
git -C C:/it/it_backend commit -m "feat: 메뉴유형 검증을 공통코드 GRP/LNK/PGE 기준으로 교체

PGE가 화면경로 규칙을 이어받고 LNK는 미지원으로 막는다. HED가 갖던
'루트 전용' 의미는 계층 위치 판정으로 대체하고, update에도 계층 검증을
추가해 루트 유형 변경으로 규칙을 우회하지 못하게 한다."
```

---

### Task 3: 백엔드 트리 조회에서 DYN·HED 제거

**Files:**
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuQueryService.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/MenuChildrenResolver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/service/BoardListMenuResolver.java`
- Modify: `it_backend/src/main/java/com/kdb/it/domain/menu/dto/MenuDto.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/MenuQueryServiceTest.java`
- Test: `it_backend/src/test/java/com/kdb/it/domain/menu/service/BoardListMenuResolverTest.java`

**Interfaces:**
- Consumes: Task 2가 확정한 유형 3종
- Produces: `MenuQueryService`의 동적 확장이 유형이 아니라 resolver 레지스트리의 `mnuId` 일치로 결정된다. `BoardListMenuResolver`가 만드는 자식의 `mnuTpC`는 `PGE`다.

- [ ] **Step 1: 실패하는 테스트를 작성**

`MenuQueryServiceTest.java`에서 동적 게시판 테스트의 `.mnuTpC("DYN")`을 `.mnuTpC("GRP")`로 바꾼다. 이것만으로 "유형이 아니라 레지스트리로 확장한다"가 검증된다.

빈 컨테이너 제거 테스트의 픽스처에서 `node("H1", null, "HED", 1, "/H1")`을 `node("H1", null, "GRP", 1, "/H1")`으로, `node("A", "H1", "LNK", 2, "/H1/A")`를 `node("A", "H1", "PGE", 2, "/H1/A")`로 바꾼다. 같은 파일에 남은 `"HED"`·`"DYN"`·`"LNK"` 문자열을 모두 같은 규칙으로 치환한다.

아래 테스트를 추가한다.

```java
    @Test
    @DisplayName("resolver가 없는 GRP 노드는 동적 확장을 시도하지 않는다")
    void grpWithoutResolver_isNotExpanded() {
        Cmenum grp = node("G1", null, "GRP", 1, "/G1");
        Cmenum child = node("C1", "G1", "PGE", 2, "/G1/C1");
        given(cmenumRepository.findAllActive()).willReturn(List.of(grp, child));
        given(menuAuthMapProvider.getMenuAuthMap()).willReturn(Map.of());

        List<MenuDto.Node> tree = service.getMenuTree(List.of("ITPZZ001"));

        assertThat(tree).extracting(MenuDto.Node::getMnuId).containsExactly("G1");
        assertThat(tree.get(0).getChildren())
                .extracting(MenuDto.Node::getMnuId)
                .containsExactly("C1");
    }
```

`BoardListMenuResolverTest.java`는 이미 유형을 단언하고 있으므로 새 테스트를 만들지 않고 기존 단언을 고친다. 세 곳이다.

클래스 JavaDoc의 `<p>DYN 게시판 노드(MBRD0001)의 children을 게시판 목록으로 변환하는 로직을 검증한다.`를 아래로 바꾼다.

```java
 * <p>게시판 동적 노드(MBRD0001)의 children을 게시판 목록으로 변환하는 로직을 검증한다.
```

`@DisplayName("resolveChildren: 게시판 목록을 LNK 노드로 변환한다")`를 아래로 바꾼다.

```java
    @DisplayName("resolveChildren: 게시판 목록을 PGE 노드로 변환한다")
```

같은 테스트 본문의

```java
        assertThat(first.getMnuTpC()).isEqualTo("LNK");
```

를 아래로 바꾼다.

```java
        assertThat(first.getMnuTpC()).isEqualTo("PGE");
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.service.MenuQueryServiceTest" --tests "com.kdb.it.domain.menu.service.BoardListMenuResolverTest"
```

Expected: FAIL. 동적 게시판 테스트는 `GRP`로 바뀌면서 `resolveDyn`이 호출되지 않아 자식이 비고, `BoardListMenuResolverTest`는 `LNK`가 나와 `PGE` 단언에 실패한다.

- [ ] **Step 3: 구현 수정**

`MenuQueryService.buildTree`에서

```java
            if ("DYN".equals(m.getMnuTpC()) && athIds != null) {
                nodeDto.setChildren(resolveDyn(m.getMnuId(), athIds));
            }
```

를 아래로 바꾼다.

```java
            // 동적 확장 여부는 유형이 아니라 resolver 등록 여부로 판단한다. resolveDyn이 이미
            // mnuId 일치로 resolver를 고르므로 유형 게이트는 같은 사실을 중복 표현한 것이었다.
            if (athIds != null && hasResolver(m.getMnuId())) {
                nodeDto.setChildren(resolveDyn(m.getMnuId(), athIds));
            }
```

`resolveDyn` 바로 위에 헬퍼를 추가한다.

```java
    /** 이 메뉴 ID를 담당하는 동적 확장 resolver가 등록돼 있는지 확인한다. */
    private boolean hasResolver(String mnuId) {
        return resolvers != null && resolvers.stream().anyMatch(r -> r.mnuId().equals(mnuId));
    }
```

`resolveDyn`의 이름은 그대로 두되 JavaDoc이 없으므로 위에 주석을 단다.

```java
    /** 등록된 resolver로 동적 하위 노드를 만든다. 담당 resolver가 없으면 빈 목록을 돌려준다. */
```

`prune`의 시그니처 위 주석 `/** 사용자 트리에서 children 0개가 된 GRP/DYN 노드 제거. */`을 `/** 사용자 트리에서 children 0개가 된 GRP 노드 제거. */`로 바꾸고, 본문의

```java
            boolean container =
                    "GRP".equals(n.getMnuTpC())
                            || "DYN".equals(n.getMnuTpC())
                            || "HED".equals(n.getMnuTpC());
```

를 아래로 바꾼다.

```java
            boolean container = "GRP".equals(n.getMnuTpC());
```

`MenuChildrenResolver.java`의 주석 `/** 이 resolver가 담당하는 DYN 노드의 MNU_ID. */`을 `/** 이 resolver가 담당하는 동적 확장 대상 노드의 MNU_ID. */`로 바꾼다.

`BoardListMenuResolver.java`에서 `.mnuTpC("LNK")`를 `.mnuTpC("PGE")`로 바꾸고, 상수 주석 `/** 시드의 게시판 DYN 노드 MNU_ID (V20260603_008 시드와 일치해야 함). */`을 `/** 시드의 게시판 동적 노드 MNU_ID (V20260603_008 시드와 일치해야 함). */`으로, `/** 게시판 헤더(HED) MNU_ID. 마이그레이션 006 시드와 일치해야 함. */`을 `/** 게시판 최상위 그룹 MNU_ID. 마이그레이션 006 시드와 일치해야 함. */`으로 바꾼다.

`MenuDto.java`의 `private String mnuTpC; // LNK / GRP / DYN` 주석을 `private String mnuTpC; // GRP / LNK / PGE`로 바꾼다.

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run:
```bash
cd C:/it/it_backend && ./gradlew test --tests "com.kdb.it.domain.menu.*"
```

Expected: PASS.

- [ ] **Step 5: 운영 소스에 구값이 남아 있지 않은지 확인**

Run:
```bash
cd C:/it/it_backend && grep -rn "\"HED\"\|\"DYN\"" src/main/java
```

Expected: 출력 없음.

- [ ] **Step 6: 전체 품질 게이트**

Run:
```bash
cd C:/it/it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL. 실패하면 원인을 고친 뒤 다시 실행한다.

- [ ] **Step 7: 커밋**

```bash
git -C C:/it/it_backend add src/main/java/com/kdb/it/domain/menu/ src/test/java/com/kdb/it/domain/menu/
git -C C:/it/it_backend commit -m "refactor: 메뉴 트리 조회에서 DYN·HED 분기 제거

동적 확장은 resolver 등록 여부로 판단하고, 빈 컨테이너 제거 대상은 GRP만
남긴다. 게시판 동적 자식의 유형을 PGE로 맞춘다."
```

---

### Task 4: 프론트 메뉴유형 타입과 Breadcrumb 판정

**Files:**
- Modify: `it_frontend/app/types/menu.ts:16`
- Modify: `it_frontend/app/composables/useAdminMenu.ts:14`
- Modify: `it_frontend/app/utils/breadcrumb.ts:29`
- Test: `it_frontend/tests/unit/components/AppBreadcrumb.test.ts`
- Test: `it_frontend/tests/unit/composables/useMenu.test.ts`
- Test: `it_frontend/tests/unit/composables/useAdminMenu.test.ts`

**Interfaces:**
- Consumes: Task 2·3이 확정한 백엔드 유형 3종
- Produces: `MenuNode['mnuTpC']`와 `MenuUpsertRequest['mnuTpC']`의 타입이 `'GRP' | 'LNK' | 'PGE'`. Task 5가 이 타입에 맞춰 화면을 고친다.

- [ ] **Step 1: 실패하는 테스트를 작성**

`tests/unit/components/AppBreadcrumb.test.ts`에서 `mnuTpC: 'LNK'`를 `mnuTpC: 'PGE'`로 모두 바꾼다. `mnuTpC: 'GRP'`는 그대로 둔다(GRP는 여전히 route 없음).

`tests/unit/composables/useMenu.test.ts`에서 `mnuTpC: 'HED'`를 `mnuTpC: 'GRP'`로, `mnuTpC: 'LNK'`를 `mnuTpC: 'PGE'`로 모두 바꾼다.

`tests/unit/composables/useAdminMenu.test.ts`에서 `mnuTpC: 'LNK'`를 `mnuTpC: 'PGE'`로 바꾼다. `mnuTpC: 'GRP'`는 그대로 둔다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/AppBreadcrumb.test.ts tests/unit/composables/useMenu.test.ts tests/unit/composables/useAdminMenu.test.ts
```

Expected: FAIL. `AppBreadcrumb.test.ts`에서 `PGE` 노드의 `route`가 `undefined`가 되어 클릭 가능 단언이 깨진다.

- [ ] **Step 3: 타입과 판정 수정**

`app/types/menu.ts:16`의

```ts
    mnuTpC: 'LNK' | 'GRP' | 'DYN' | 'HED';
```

를 아래로 바꾼다.

```ts
    /** 메뉴유형코드 — 공통코드 MNU_TP_C 기준. GRP=메뉴그룹, LNK=링크메뉴(미지원), PGE=페이지화면 */
    mnuTpC: 'GRP' | 'LNK' | 'PGE';
```

`app/composables/useAdminMenu.ts:14`의 `mnuTpC: 'LNK' | 'GRP' | 'DYN' | 'HED';`도 같은 union으로 바꾼다(주석은 중복하지 않는다).

`app/utils/breadcrumb.ts:29`의

```ts
                route: node?.mnuTpC === 'LNK' ? (node.srePth ?? undefined) : undefined,
```

를 아래로 바꾼다.

```ts
                route: node?.mnuTpC === 'PGE' ? (node.srePth ?? undefined) : undefined,
```

같은 파일 상단 주석 `GRP 노드는 route 가 없어 PrimeVue Breadcrumb 에서 비활성 처리됩니다.`는 그대로 유효하므로 두고, 그 아래에 한 줄을 덧붙인다.

```ts
 * 내부 화면(PGE) 노드만 route 를 갖습니다.
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/components/AppBreadcrumb.test.ts tests/unit/composables/useMenu.test.ts tests/unit/composables/useAdminMenu.test.ts
```

Expected: PASS.

- [ ] **Step 5: 타입 검사**

Run:
```bash
cd C:/it/it_frontend && npm run typecheck
```

Expected: 통과. `app/pages/admin/menus/index.vue`의 하드코딩 배열은 문자열 리터럴이라 타입 오류를 내지 않을 수 있다. 오류가 나면 Task 5에서 함께 고치므로 여기서는 오류 메시지만 기록하고 넘어간다.

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_frontend add app/types/menu.ts app/composables/useAdminMenu.ts app/utils/breadcrumb.ts tests/unit/components/AppBreadcrumb.test.ts tests/unit/composables/useMenu.test.ts tests/unit/composables/useAdminMenu.test.ts
git -C C:/it/it_frontend commit -m "refactor: 메뉴유형 타입을 GRP/LNK/PGE로 교체

Breadcrumb의 클릭 가능 판정 기준을 내부 화면(PGE)으로 옮긴다."
```

---

### Task 5: 메뉴관리 화면 테스트 하네스 분리

이 태스크는 제품 코드를 바꾸지 않는다. Task 6의 새 테스트가 같은 마운트 배선을 필요로 하는데, 그 배선이 기존 테스트 파일 안에 파묻혀 있어 복제 없이는 재사용할 수 없다. 배선을 support 모듈로 꺼내고 기존 테스트가 그대로 통과하는지만 확인한다.

**Files:**
- Create: `it_frontend/tests/support/adminMenusPage.ts`
- Modify: `it_frontend/tests/unit/pages/admin-menus-refresh-failure.test.ts:56-179`

**Interfaces:**
- Consumes: `createNuxtFetchFake`(`tests/support/nuxtAsyncData`). 이 헬퍼는 `{ useFetch, control }`을 돌려주고, `control.value`가 조회가 성공할 때 반환할 값이다. `control`에 `setData` 같은 메서드는 없으므로 값 교체는 **마운트 전에** 해야 한다.
- Produces:
  - `setupAdminMenusGlobals(apiFetchMock: unknown): void` — 페이지가 요구하는 Nuxt 전역 스텁을 등록한다.
  - `createAdminMenusMount(opts: { apiFetchMock; toastAdd; stubs?: Record<string, unknown> })` → `{ mountMenusPage }`. `mountMenusPage(overrides?: { menuTypeCodes?: unknown[] })`는 `{ wrapper, sidebar, adminTree, codes }`를 돌려주며 `sidebar`·`adminTree`·`codes`는 `createNuxtFetchFake`의 control 객체다.
  - `buttonByLabel(wrapper, label)`, `menuOf(wrapper)`, `menuTypeCodeFixture()`

- [ ] **Step 1: support 모듈 생성**

`tests/support/adminMenusPage.ts`를 만든다(기존 `nuxtAsyncData.ts`와 같은 디렉터리다 — `tests/unit/support/`가 아니다). 기존 `admin-menus-refresh-failure.test.ts`의 56~179행(`toastAdd`/`apiFetchMock` 선언 제외, 픽스처·스텁·`mountMenusPage`·`buttonByLabel`·`menuOf`)을 그대로 옮기고, 아래 네 가지만 바꾼다.

1. `vi.stubGlobal('useNuxtApp', ...)` 등 전역 등록을 `setupAdminMenusGlobals(apiFetchMock)` 함수로 감싼다. `vi.mock('primevue/usetoast', ...)`은 호이스팅되므로 **옮기지 않고 각 테스트 파일에 남긴다.**
2. `mountMenusPage`가 닫아 두던 `apiFetchMock`을 인자로 받는다.
3. `Select` 스텁을 호출자가 교체할 수 있도록 `stubs` 인자를 받아 기본 스텁 위에 얹는다.
4. 공통코드 조회 대역의 초기값을 `mountMenusPage(overrides)`로 갈아끼울 수 있게 한다. `control.value`는 조회가 실행되는 시점에 읽히므로 마운트 후에 바꾸면 이미 늦다.

```ts
/**
 * ============================================================================
 * [tests/unit/support/adminMenusPage.ts] admin/menus 페이지 마운트 하네스
 * ============================================================================
 * 이 화면은 네 개의 조회(`/api/menus`, `/api/admin/menus`, `/api/admin/routes`,
 * `/api/ccodem/MNU_TP_C`)를 서로 독립적으로 실패시킬 수 있어야 하므로 `useFetch`
 * 대역을 URL별로 갈라 끼운다. 여러 테스트 파일이 같은 배선을 쓰므로 여기 모은다.
 *
 * `vi.mock`은 파일 단위로 호이스팅되므로 이 모듈로 옮길 수 없다. `primevue/usetoast`
 * mock은 각 테스트 파일에 남긴다.
 * ============================================================================
 */
import { vi } from 'vitest';
import { defineComponent, h, toValue } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';

import type { MenuNode } from '~/types/menu';
import { createNuxtFetchFake } from './nuxtAsyncData'; // 같은 tests/support/ 디렉터리

/** 공통코드 `/api/ccodem/MNU_TP_C`가 돌려주는 원본 응답 (useCodeOptions가 정규화한다) */
export const menuTypeCodeFixture = () => [
    { cdva: 'GRP', cdvaNm: '메뉴그룹', cId: 'MNU_TP_C', cNm: '메뉴유형코드', cSqn: 1 },
    { cdva: 'LNK', cdvaNm: '링크메뉴', cId: 'MNU_TP_C', cNm: '메뉴유형코드', cSqn: 2 },
    { cdva: 'PGE', cdvaNm: '페이지화면', cId: 'MNU_TP_C', cNm: '메뉴유형코드', cSqn: 3 },
];

/** 페이지 setup이 요구하는 Nuxt 전역 스텁을 등록한다. */
export const setupAdminMenusGlobals = (apiFetchMock: unknown) => {
    vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:28080' } }));
    vi.stubGlobal('useNuxtApp', () => ({ $apiFetch: apiFetchMock }));
    vi.stubGlobal('useAuth', () => ({ refresh: vi.fn(), logout: vi.fn(), user: { value: null } }));
    vi.stubGlobal('useRoute', () => ({ path: '/admin/menus' }));
    vi.stubGlobal('definePageMeta', () => {});
};
```

이어서 기존 파일의 `sidebarFixture`, `adminTreeFixture`, `ButtonStub`, `MessageStub`, `StubTreeNode`, `TreeStub`, `passthroughStub`을 **주석까지 그대로** 옮겨 `export` 한다. 마지막으로 마운트 팩토리를 아래 형태로 만든다.

```ts
export const createAdminMenusMount = (opts: {
    apiFetchMock: { mockReset: () => { mockResolvedValue: (v: unknown) => void } };
    toastAdd: { mockClear: () => void };
    stubs?: Record<string, unknown>;
}) => {
    /* 공통코드 대역의 초기값은 마운트 전에 정해져야 한다 — control.value는 조회가
       실행되는 시점에 읽히므로 마운트 후 교체는 반영되지 않는다. */
    const mountMenusPage = async (overrides: { menuTypeCodes?: unknown[] } = {}) => {
        const sidebar = createNuxtFetchFake<MenuNode[]>({ value: sidebarFixture() });
        const adminTree = createNuxtFetchFake<MenuNode[]>({ value: adminTreeFixture() });
        const routes = createNuxtFetchFake<unknown[]>({ value: [] });
        /* 유형 Select가 여는 공통코드 조회. 분기하지 않으면 사이드바 대역으로 흘러가
           사이드바 단언을 오염시킨다. */
        const codes = createNuxtFetchFake<unknown[]>({
            value: overrides.menuTypeCodes ?? menuTypeCodeFixture(),
        });
        vi.stubGlobal('useFetch', (url: unknown, options?: Record<string, unknown>) => {
            const target = String(toValue(url));
            /* `/api/admin/menus`가 `/api/menus`보다 먼저 걸러져야 한다 */
            if (target.includes('/api/admin/menus')) return adminTree.useFetch(url, options);
            if (target.includes('/api/admin/routes')) return routes.useFetch(url, options);
            if (target.includes('/api/ccodem/')) return codes.useFetch(url, options);
            return sidebar.useFetch(url, options);
        });
        opts.apiFetchMock.mockReset().mockResolvedValue(undefined);
        opts.toastAdd.mockClear();

        const MenusPage = (await import('~/pages/admin/menus/index.vue')).default;
        const SuspenseWrapper = defineComponent({
            components: { MenusPage },
            template: '<Suspense><MenusPage /></Suspense>',
        });

        const wrapper = mount(SuspenseWrapper, {
            global: {
                stubs: {
                    Button: ButtonStub,
                    Message: MessageStub,
                    Tree: TreeStub,
                    Select: passthroughStub('Select'),
                    InputText: passthroughStub('InputText'),
                    Checkbox: passthroughStub('Checkbox'),
                    IconCrown: passthroughStub('IconCrown'),
                    ...(opts.stubs ?? {}),
                },
            },
        });
        await flushPromises();
        return {
            wrapper,
            sidebar: sidebar.control,
            adminTree: adminTree.control,
            codes: codes.control,
        };
    };

    return { mountMenusPage };
};

export const buttonByLabel = (wrapper: ReturnType<typeof mount>, label: string) =>
    wrapper.findAll('button').find((b) => b.attributes('data-label') === label);
```

`menuOf`도 기존 파일에서 그대로 옮겨 `export` 한다.

- [ ] **Step 2: 기존 테스트 파일이 하네스를 쓰도록 수정**

`admin-menus-refresh-failure.test.ts`에서 옮긴 정의들을 지우고 아래 import와 호출로 대체한다. `toastAdd`·`apiFetchMock` 선언과 `vi.mock('primevue/usetoast', ...)`은 그대로 남긴다.

```ts
import {
    buttonByLabel,
    createAdminMenusMount,
    menuOf,
    setupAdminMenusGlobals,
} from '../../support/adminMenusPage';

const toastAdd = vi.fn();
const apiFetchMock = vi.fn();

vi.stubGlobal('useToast', () => ({ add: toastAdd }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
setupAdminMenusGlobals(apiFetchMock);

const { mountMenusPage } = createAdminMenusMount({ apiFetchMock, toastAdd });
```

기존 테스트 본문은 손대지 않는다. `mountMenusPage()`가 `codes`를 더 돌려주지만 기존 테스트는 무시한다.

- [ ] **Step 3: 기존 테스트가 그대로 통과하는지 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/pages/admin-menus-refresh-failure.test.ts
```

Expected: PASS. 이 태스크는 동작을 바꾸지 않으므로 이전과 같은 결과여야 한다. 실패하면 옮기는 과정에서 빠뜨린 스텁이 있는 것이다.

- [ ] **Step 4: 커밋**

```bash
git -C C:/it/it_frontend add tests/unit/support/adminMenusPage.ts tests/unit/pages/admin-menus-refresh-failure.test.ts
git -C C:/it/it_frontend commit -m "test: admin/menus 마운트 하네스를 support 모듈로 분리

유형 코드 테스트가 같은 배선을 복제하지 않고 재사용하도록 꺼낸다.
공통코드 조회 분기도 함께 추가한다. 동작 변화는 없다."
```

---

### Task 6: 메뉴관리 화면의 유형 Select를 공통코드로 연결

**Files:**
- Modify: `it_frontend/app/pages/admin/menus/index.vue`
- Test: `it_frontend/tests/unit/pages/admin-menus-type-code.test.ts` (생성)

**Interfaces:**
- Consumes: Task 4의 `MenuUpsertRequest['mnuTpC']` union, Task 5의 `createAdminMenusMount`·`setupAdminMenusGlobals`·`buttonByLabel`, 그리고 `useCodeOptions(cId: string)` → `{ options: ComputedRef<CodeOption[]>, ... }`. `CodeOption`은 `cdId: string`(코드값)과 `cdNm: string`(표시명)을 갖는다.
- Produces: 없음(최종 소비자)

- [ ] **Step 1: 실패하는 테스트 파일을 작성**

`tests/unit/pages/admin-menus-type-code.test.ts`를 만든다.

```ts
/**
 * ============================================================================
 * [tests/unit/pages/admin-menus-type-code.test.ts]
 * ============================================================================
 * 메뉴관리 화면의 유형 입력이 공통코드 MNU_TP_C 조회 결과로 렌더되는지 검증한다.
 *
 * 하드코딩 배열(['HED','GRP','LNK','DYN'])을 쓰던 시절에는 코드표에 없는 값을 저장해
 * 백엔드 검증에 걸리거나, 코드표에 있는 PGE를 아예 고를 수 없었다. 여기서는 Select
 * 스텁이 옵션 라벨과 선택값을 실제로 렌더해 "무엇을 고를 수 있는가"를 화면 텍스트로
 * 관측한다. 값을 렌더하지 않는 passthrough 스텁으로는 이 회귀를 잡을 수 없다.
 * ============================================================================
 */
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import { flushPromises } from '@vue/test-utils';

import {
    buttonByLabel,
    createAdminMenusMount,
    setupAdminMenusGlobals,
} from '../../support/adminMenusPage';

const toastAdd = vi.fn();
const apiFetchMock = vi.fn();

vi.stubGlobal('useToast', () => ({ add: toastAdd }));
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: toastAdd }) }));
setupAdminMenusGlobals(apiFetchMock);

interface StubOption {
    cdId?: string;
    cdNm?: string;
}

/** 옵션 라벨과 현재 선택값을 렌더하는 Select 스텁. */
const SelectStub = defineComponent({
    name: 'Select',
    props: ['modelValue', 'options', 'optionLabel', 'optionValue', 'filter', 'placeholder'],
    setup(props) {
        return () =>
            h(
                'div',
                { class: 'select-stub', 'data-value': String(props.modelValue ?? '') },
                ((props.options as StubOption[]) ?? [])
                    .map((o) => (typeof o === 'string' ? o : (o.cdNm ?? '')))
                    .join(', '),
            );
    },
});

const { mountMenusPage } = createAdminMenusMount({
    apiFetchMock,
    toastAdd,
    stubs: { Select: SelectStub },
});

/** 편집 폼을 신규 모드로 띄우고, 유형을 지정한 값으로 바꾼다. */
const openNewForm = async (
    wrapper: Awaited<ReturnType<typeof mountMenusPage>>['wrapper'],
    mnuTpC?: string,
) => {
    const page = wrapper.findComponent({ name: 'MenusPage' });
    const vm = page.vm as unknown as { startNew: () => void; form: { mnuTpC: string } };
    vm.startNew();
    if (mnuTpC) vm.form.mnuTpC = mnuTpC;
    await flushPromises();
    return page;
};

describe('admin/menus — 유형 Select 공통코드 연동', () => {
    it('공통코드 MNU_TP_C 조회 결과를 옵션으로 렌더한다', async () => {
        const { wrapper } = await mountMenusPage();
        await openNewForm(wrapper);

        const select = wrapper.find('.select-stub');
        expect(select.text()).toContain('메뉴그룹');
        expect(select.text()).toContain('링크메뉴');
        expect(select.text()).toContain('페이지화면');
        expect(select.text()).not.toContain('HED');
        wrapper.unmount();
    });

    it('신규 폼의 기본 유형은 GRP다', async () => {
        // 이 화면에는 상위메뉴 선택 입력이 없어 신규는 항상 루트로 만들어지고,
        // 루트는 GRP만 허용되므로 기본값이 GRP가 아니면 신규 저장이 항상 실패한다.
        const { wrapper } = await mountMenusPage();
        await openNewForm(wrapper);

        expect(wrapper.find('.select-stub').attributes('data-value')).toBe('GRP');
        wrapper.unmount();
    });

    it('LNK를 고르면 미지원 안내를 띄우고 저장 버튼을 비활성화한다', async () => {
        const { wrapper } = await mountMenusPage();
        await openNewForm(wrapper, 'LNK');

        expect(wrapper.text()).toContain('외부링크 메뉴는 아직 지원하지 않습니다');
        expect(buttonByLabel(wrapper, '저장')?.attributes('disabled')).toBeDefined();
        wrapper.unmount();
    });

    it('PGE를 고르면 화면경로 입력이 나타난다', async () => {
        const { wrapper } = await mountMenusPage();
        await openNewForm(wrapper, 'PGE');

        expect(wrapper.text()).toContain('화면경로');
        wrapper.unmount();
    });

    it('코드 조회가 비면 유형을 바꿀 수 없다고 안내한다', async () => {
        // 대역의 초기값을 비워서 마운트한다. control.value는 조회 실행 시점에 읽히므로
        // 마운트 뒤에 바꾸면 이미 늦다.
        const { wrapper } = await mountMenusPage({ menuTypeCodes: [] });
        await openNewForm(wrapper);

        expect(wrapper.text()).toContain('유형 코드를 불러오지 못했습니다');
        wrapper.unmount();
    });
});
```

`vm.form`은 `ref`가 `setup` 반환에서 unwrap되므로 `.value` 없이 접근한다.

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/pages/admin-menus-type-code.test.ts
```

Expected: FAIL. 옵션이 `HED, GRP, LNK, DYN` 문자열 배열이라 `메뉴그룹` 같은 라벨이 없고 `HED`가 그대로 보이며, 기본값이 `LNK`이고, 미지원 안내와 코드 조회 실패 안내 문구가 없다.

- [ ] **Step 3: 화면 구현**

`app/pages/admin/menus/index.vue`의 import 블록에 아래를 추가한다.

```ts
import { useCodeOptions } from '~/composables/useCodeOptions';
```

`const menu = useMenu();` 다음 줄에 아래를 추가한다.

```ts
/* 메뉴유형은 공통코드 MNU_TP_C가 단일 기준이다. 화면에 값을 하드코딩하지 않는다. */
const { options: menuTypeOptions } = useCodeOptions('MNU_TP_C');
```

`const form = ref<MenuUpsertRequest>({ ... })`의 `mnuTpC: 'LNK'`를 `mnuTpC: 'GRP'`로 바꾼다.

`startNew`의

```ts
    form.value = { mnuNm: '', mnuTpC: 'LNK', hrkMnuId: null, srePth: null, hidYn: 'N', athIds: [] };
```

를 아래로 바꾼다.

```ts
    /* 이 화면에는 상위메뉴 선택 입력이 없어 신규는 항상 루트로 만들어진다. 루트는 GRP만
       허용되므로 기본값을 GRP로 둔다. 원하는 위치로는 생성 후 드래그&드롭으로 옮긴다. */
    form.value = { mnuNm: '', mnuTpC: 'GRP', hrkMnuId: null, srePth: null, hidYn: 'N', athIds: [] };
```

템플릿의 유형 블록

```html
            <div>
                <label class="block text-sm">유형</label>
                <Select
                    v-model="form.mnuTpC"
                    :options="['HED', 'GRP', 'LNK', 'DYN']"
                    class="w-40"
                />
            </div>
```

을 아래로 바꾼다.

```html
            <div>
                <label class="block text-sm">유형</label>
                <Select
                    v-model="form.mnuTpC"
                    :options="menuTypeOptions"
                    option-label="cdNm"
                    option-value="cdId"
                    class="w-40"
                />
                <!-- 코드 조회가 실패하면 옵션만 비고 현재 값은 남는다. 유형을 바꿀 수 없는
                     상태이므로 명시적으로 알린다. -->
                <p v-if="!menuTypeOptions.length" class="text-xs text-red-600">
                    유형 코드를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
                </p>
                <p v-else-if="form.mnuTpC === 'LNK'" class="text-xs text-amber-600">
                    외부링크 메뉴는 아직 지원하지 않습니다.
                </p>
            </div>
```

화면경로 블록의 조건을 바꾼다.

```html
            <div v-if="form.mnuTpC === 'PGE'">
```

저장 버튼에 비활성 조건을 추가한다.

```html
                <Button
                    label="저장"
                    icon="pi pi-check"
                    :disabled="form.mnuTpC === 'LNK'"
                    @click="save"
                />
```

파일 상단 주석 블록의 `[연동 API]` 줄 아래에 한 줄을 덧붙인다.

```
[유형 코드] 메뉴유형(GRP/LNK/PGE)은 공통코드 MNU_TP_C 조회 결과로만 렌더합니다.
```

- [ ] **Step 4: 테스트가 통과하는지 확인**

Run:
```bash
cd C:/it/it_frontend && npx vitest run tests/unit/pages/admin-menus-type-code.test.ts tests/unit/pages/admin-menus-refresh-failure.test.ts
```

Expected: PASS (두 파일 모두).

- [ ] **Step 5: 프론트에 구값이 남아 있지 않은지 확인**

Run:
```bash
cd C:/it/it_frontend && grep -rn "'HED'\|'DYN'" app/ tests/
```

Expected: 출력 없음.

- [ ] **Step 6: 커밋**

```bash
git -C C:/it/it_frontend add app/pages/admin/menus/index.vue tests/unit/pages/admin-menus-type-code.test.ts
git -C C:/it/it_frontend commit -m "feat: 메뉴관리 유형을 공통코드 MNU_TP_C로 선택

하드코딩 배열을 제거하고 코드 조회 결과를 Select에 바인딩한다. 신규 기본값을
GRP로 맞추고, 미지원인 LNK는 안내와 함께 저장을 막는다."
```

---

### Task 7: 생성 타입 재생성과 전체 품질 게이트

**Files:**
- Modify: `it_frontend/app/types/api.d.ts` (생성물)
- Modify: `C:/it/versions.lock`

**Interfaces:**
- Consumes: Task 1~6의 모든 변경
- Produces: 없음(마무리)

- [ ] **Step 1: 백엔드를 기동한 상태로 타입 재생성**

백엔드가 떠 있어야 OpenAPI 스펙을 읽을 수 있다. 별도 터미널에서:

```bash
cd C:/it/it_backend && ./gradlew bootRun --args='--spring.profiles.active=local-ext'
```

기동 후:

```bash
cd C:/it/it_frontend && npm run codegen
```

Expected: `app/types/api.d.ts`가 갱신되고, `메뉴유형코드 LNK/GRP/DYN/HED` 주석이 사라진다.

- [ ] **Step 2: 드리프트 확인**

Run:
```bash
cd C:/it/it_frontend && npm run codegen:check
```

Expected: 차이 없음으로 통과.

- [ ] **Step 3: 프론트 전체 게이트**

Run:
```bash
cd C:/it/it_frontend && npm run format:check && npm run check && npm test
```

Expected: 세 명령 모두 통과. 단, `tests/unit/middleware/council-manager.test.ts`(4건)와 `tests/unit/architecture/max-lines-ratchet.test.ts`는 이 작업과 무관한 기존 실패일 수 있다. 실패하면 `git stash` 없이 `git -C C:/it/it_frontend stash list`로 다른 작업물이 섞이지 않았는지 먼저 확인하고, 이 계획이 건드린 파일이 원인인지 판별한 뒤 원인일 때만 고친다.

- [ ] **Step 4: 백엔드 전체 게이트**

Run:
```bash
cd C:/it/it_backend && ./gradlew check
```

Expected: BUILD SUCCESSFUL.

- [ ] **Step 5: 화면 수동 확인**

두 서버를 띄우고 http://localhost:3000/admin/menus 에 접속한다.

확인 항목:
- 상단 헤더 내비게이션이 이전과 동일하게 보인다.
- 게시판 헤더 아래 동적 게시판 목록이 그대로 나온다.
- 좌측 트리에서 아무 메뉴나 고르면 유형 Select에 `메뉴그룹`·`링크메뉴`·`페이지화면` 세 개가 뜬다.
- 내부 화면 메뉴를 고르면 유형이 `페이지화면`이고 화면경로 입력이 보인다.
- `링크메뉴`를 고르면 미지원 안내가 뜨고 저장 버튼이 눌리지 않는다.
- 메뉴명을 바꿔 저장하면 성공 토스트가 뜨고 트리에 반영된다.

- [ ] **Step 6: 타입 재생성 커밋**

```bash
git -C C:/it/it_frontend add app/types/api.d.ts
git -C C:/it/it_frontend commit -m "chore: 메뉴유형 변경에 맞춰 API 타입 재생성"
```

- [ ] **Step 7: versions.lock 갱신과 커밋**

Run:
```bash
powershell -File C:/it/scripts/update-versions-lock.ps1
```

Expected: `versions.lock`의 세 SHA가 방금 만든 커밋으로 갱신된다.

```bash
git -C C:/it add versions.lock
git -C C:/it commit -m "chore: 메뉴유형코드 정합 작업 versions.lock 갱신"
```

---

## 완료 조건

- `TPRMPP_CMENUM.MNU_TP_C`에 `GRP`·`PGE`만 존재한다.
- `it_backend/src/main/java`와 `it_frontend/app`·`tests`에 `HED`·`DYN` 문자열이 없다.
- 메뉴관리 화면의 유형 Select가 `/api/ccodem/MNU_TP_C` 조회 결과만으로 렌더된다.
- `./gradlew check`와 `npm run format:check && npm run check && npm test`가 통과한다(무관한 기존 실패 제외).
- `versions.lock`이 네 레포의 최신 커밋을 가리킨다.
