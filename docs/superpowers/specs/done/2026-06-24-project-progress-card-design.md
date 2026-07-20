# [사업 진행 현황] 단계별 카드 (BPROJA 기반) 설계

> 작성일: 2026-06-24
> 선행: 1차(BPROJA 신설+읽기), 2차-A(단계 서비스 BPROJA 적재). 본 작업은 2차-A 코드 정정 1건을 선행 포함.

## 1. 목적 / 배경

정보화사업 상세 화면의 "사업 진행 현황" 섹션은 현재 프로젝트의 **단일 대표상태코드**(`project.stsTc` = BPROJA
MAX)로 선형 타임라인을 그린다. 이를 **단계별 독립 진행 표시**로 교체한다: 각 단계가 자신의 BPROJA 행
상태에 따라 완료/진행중/미실시를 독립적으로 표시한다(비선형 허용).

## 2. 단계 정의 / 판정 규칙

### 단계 정의 (프론트 `IT_PTL_STS_TIMELINE` 재사용, 1건 수정)
`it_frontend/app/utils/common.ts`의 `IT_PTL_STS_TIMELINE`(10단계×코드대역)을 단계 정의의 단일 소스로
재사용한다. **요구사항 구체화 대역만 `['23','24']` → `['28','29']`로 수정**(사용자 제공 CCODEM 코드표 기준).

| 단계 | 코드대역 |
|---|---|
| 예산편성 | 01, 02, 03, 09 |
| 정실협(계획) | 11, 19 |
| 사전협의 | 21, 22 |
| 요구사항 구체화 | **28, 29** (기존 23,24에서 수정) |
| 타당성검토 | 31, 32, 39 |
| 소요예산 산정 | 41, 42, 49 |
| 과업심의위원회 | 51, 52, 59 |
| 입찰/계약 | 61, 62, 69 |
| 대금지급 | 71, 72, 79 |
| 성과평가 | 81, 89 |

### 판정 규칙 (해당 프로젝트의 활성 BPROJA `IT_PTL_STS_TC` 코드 집합 기준)
각 단계(대역 B)에 대해:
- B 내 코드가 **하나도 없음 → 미실시** (`-` 아이콘)
- B 내 코드 중 **`*9`(완료코드 09/19/29/39/49/59/69/79/89)가 있음 → 완료** (`V`/체크 아이콘)
- B 내 코드가 있으나 `*9` 없음 → **진행중** (`...` 점 3개 애니메이션)

`*9`는 각 대역의 유일·최상위 코드이므로 "대역 내 *9 존재 = 완료"가 곧 "대역 최대코드가 완료"와 같다.
비선형 진행을 허용한다(앞 단계 미실시인데 뒤 단계 완료 가능).

## 3. 백엔드 (최소 변경)

- `ProjectDto.Response`에 필드 추가:
  ```java
  @Schema(description = "해당 사업의 활성 BPROJA 단계 상태코드 목록(IT_PTL_STS_TC)")
  private java.util.List<String> bprojaStsCodes;
  ```
- `ProjectService.getProject(prjMngNo)`: 대표상태 계산을 위해 **이미 조회 중인**
  `bprojaRepository.findByAbusMngNoAndDelYn(prjMngNo, "N")` 결과를 재사용해
  `response.setBprojaStsCodes(rows.stream().map(Bproja::getStsTc).filter(Objects::nonNull).toList())`로 채운다.
  (추가 쿼리 없음. 대표상태 주입 직후 같은 리스트를 활용하도록 구현.)
- 목록(배치) 경로(`enrichProjectListBatch`)는 카드 미사용이므로 `bprojaStsCodes` 미설정(목록 응답엔 불필요).

## 4. 프론트엔드

- `utils/common.ts`:
  - `IT_PTL_STS_TIMELINE`의 요구사항 구체화 대역 `['23','24']` → `['28','29']`.
  - 순수 헬퍼 추가:
    ```ts
    export type StageProgress = '완료' | '진행중' | '미실시';
    /** 단계 코드대역과 활성 BPROJA 코드 집합으로 단계 진행상태 판정 */
    export const getStageProgress = (codes: string[], stageCodes: string[]): StageProgress => {
        const inBand = codes.filter((c) => stageCodes.includes(c));
        if (inBand.length === 0) return '미실시';
        return inBand.some((c) => c.endsWith('9')) ? '완료' : '진행중';
    };
    ```
- `components/projects/ProjectProgressSection.vue`:
  - prop을 `statusCodes: string[]`로 교체(기존 `statusCode?`/`statusLabel?` 제거).
  - `IT_PTL_STS_TIMELINE`를 순회하며 각 단계에 `getStageProgress(props.statusCodes ?? [], stage.codes)`로 상태 산출.
  - 표시: 완료=체크 아이콘(`pi pi-check`), 진행중=점 3개 `...` 애니메이션, 미실시=`-` 아이콘(`pi pi-minus`). 각 단계 라벨(`stage.label`) 함께.
  - 기존 선형 진행선/`timelineProgressWidth`/`getProjectTimelineIndex` 의존 로직은 제거(또는 단계별 표시에 맞게 대체). `getProjectTimelineIndex`가 다른 곳에서 안 쓰이면 그대로 두되 본 컴포넌트에선 미사용.
- `pages/info/projects/[id].vue`:
  - `<ProjectProgressSection :status-code="project.stsTc" :status-label="statusLabel" />`
    → `<ProjectProgressSection :status-codes="project.bprojaStsCodes ?? []" />`로 교체.
  - 상세 응답 타입(`useProjects.ts`의 Project 타입 등)에 `bprojaStsCodes?: string[]` 추가.

## 5. 2차-A 정정 (선행 포함)

- `BudgetWorkService`의 예산편성 upsert 상태코드 `"21"` → `"03"`(예산편성 작업 진행중). 21은 사전협의 코드였음.
- 2차 설계 spec `docs/superpowers/specs/2026-06-24-bproja-stage-sync-design.md` §2 대역표 정정(예산편성 01–09,
  사전협의 21–22로 바로잡기) 및 2차-A 계획 `docs/superpowers/plans/2026-06-24-bproja-stage-sync.md`의
  예산편성 코드 표기 정정.

## 6. 에러 / 경계

- `bprojaStsCodes` 비어있음(BPROJA 미적재 프로젝트) → 전 단계 미실시(`-`). 정상.
- 어느 대역에도 속하지 않는 코드 → 무시(판정에서 제외).
- 한 대역에 진행중·완료 코드가 동시 존재(예: 03과 09) → `*9` 우선으로 완료.

## 7. 테스트

- `getStageProgress` 단위 테스트: 미실시(빈/대역밖), 진행중(비-*9), 완료(*9 존재), 혼재(*9 우선). 파일
  `it_frontend/tests/unit/utils/common.test.ts`(있으면 보강, 없으면 신설).
- 프론트 `npm run check`(typecheck+lint) 오류 0.
- 백엔드 `./gradlew compileJava`(test worker 이슈로 컴파일 게이트).

## 8. 컴포넌트 경계 / 책임

- **utils/common**: 단계 정의(`IT_PTL_STS_TIMELINE`) + 판정(`getStageProgress`). 순수 함수, 독립 테스트.
- **ProjectProgressSection**: 표시만 담당. 의존: `statusCodes` prop + `IT_PTL_STS_TIMELINE`/`getStageProgress`.
- **ProjectService**: `bprojaStsCodes` 공급(BPROJA 조회 결과 재사용). 의존: BprojaRepository(기존).

## 9. 파일 영향 요약

- **백엔드(it_backend)**: `ProjectDto.java`(필드+빌더), `ProjectService.java`(getProject 주입), `BudgetWorkService.java`(코드 21→03 정정).
- **프론트(it_frontend)**: `utils/common.ts`(대역 수정+헬퍼), `components/projects/ProjectProgressSection.vue`(교체), `pages/info/projects/[id].vue`(prop 교체), 상세 타입(`useProjects.ts` 등) 필드 추가, `tests/unit/utils/common.test.ts`.
- **문서(top-level)**: 2차 spec §2·2차-A 계획 코드 정정.
- **무변경**: DB(스키마 불변), 목록 경로, 대표상태 MAX 로직.
