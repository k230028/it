# BPROJA 단계 상태 적재 통합 설계 (2차)

> 작성일: 2026-06-24
> 선행: 1차 `docs/superpowers/specs/2026-06-24-bproja-status-relation-design.md` (BPROJA 신설 + 읽기 경로 완료).
> 범위: **2차 — 각 단계 서비스가 문서 생성/상태변경/삭제 시 BPROJA를 upsert/softDelete**.
>
> **재스코프(2026-06-24, 조사 결과 반영):**
> - **2차-A(본 계획 대상, 6단계)**: `BprojaSyncService` + 실행 4단계(소요예산/과업심의/입찰계약/대금지급) + 예산편성 + 계획.
> - **2차-B(별도)**: 타당성/협의회(Basctm) 통합 + **CouncilRepository 런타임 회귀 수정** + 협의회 "신청 대상" 판정 재설계. 별도 brainstorm 필요 (아래 §4.2, §12).
> - 사전협의(Brdocm)는 프로젝트 연결 경로 부재로 계속 제외(아래 §7).

## 1. 목적 / 배경

1차에서 `TPRMPP_BPROJA`(정보화사업관계)를 신설하고, 프로젝트 대표상태 = 그 프로젝트의 BPROJA 행 중
`IT_PTL_STS_TC` 최댓값(MAX)으로 읽도록 구현했다. 단 BPROJA를 채우는 writer는 없어 빈 테이블이었다.

2차는 각 업무 단계 서비스가 자신의 문서 생성/상태변경/삭제 시점에 **공통 동기화 서비스**를 호출해
BPROJA에 `(프로젝트 ABUS_MNG_NO, 단계 자기 key, 통합 IT_PTL_STS_TC)` 행을 upsert/softDelete 하도록
통합한다. 이로써 프로젝트 목록/상세의 대표상태가 실제 파이프라인 진행을 반영한다.

## 2. 통합 상태코드 체계 (확정)

`IT_PTL_STS_TC`(CCODEM 그룹)는 파이프라인 전체를 단조 증가로 인코딩한 **단일 통합 코드군**이다.
따라서 대표상태 = MAX(IT_PTL_STS_TC)는 "가장 진행된 단계"를 의미한다.

| 코드대역 | 단계 |
|---|---|
| 01–09 | 사전협의 (이번 범위 제외) |
| 11–19 | 정보기술부문계획 |
| 21–22 | 예산편성 |
| 23–24 | 요구사항 구체화 |
| 31–39 | 타당성검토 |
| 41–49 | 소요예산 |
| 51–59 | 과업심의 |
| 61–69 | 입찰/계약 |
| 71–79 | 대금지급 |
| 81–89 | 정산/완료 |

각 단계는 native 상태를 위 통합코드로 매핑해 upsert 한다. 실행 4단계는 native `stsTc`가 이미
통합 대역(41–79)이라 **항등 매핑**이다.

## 3. 핵심 컴포넌트: `BprojaSyncService`

신설: `domain/budget/project/service/BprojaSyncService.java` (또는 동일 패키지). 모든 단계가 이 한
지점을 통해 BPROJA를 변경한다.

```
@Service
@RequiredArgsConstructor
@Transactional          // 호출자 트랜잭션에 참여(직호출, 동일 트랜잭션)
class BprojaSyncService {
    private final BprojaRepository bprojaRepository;

    /** (프로젝트, 단계 key, 통합상태)로 BPROJA upsert. 있으면 상태 갱신+DEL_YN='N' 복원, 없으면 INSERT. */
    void upsert(String abusMngNo, String cncdRfrNo, String itPtlStsTc);

    /** 단계 문서 Soft Delete 시 대응 BPROJA 행을 DEL_YN='Y' 처리(없으면 no-op). */
    void softDelete(String abusMngNo, String cncdRfrNo);
}
```

규칙:
- `abusMngNo` 또는 `cncdRfrNo`가 null/blank, 또는 `itPtlStsTc`가 null이면 **no-op**(방어).
- upsert: `bprojaRepository.findById(new BprojaId(abusMngNo, cncdRfrNo))` → 존재 시
  `changeStatus(itPtlStsTc)` + `restore()`(DEL_YN='N'), 없으면 `Bproja.builder()...build()` 후
  `bprojaRepository.save(...)`. (신규 INSERT는 `@PrePersist`가 BaseEntity 기본값을 채움.)
- softDelete: 존재 시 `delete()`(DEL_YN='Y'), 없으면 no-op.
- 동일 트랜잭션 직호출이므로 upsert 실패는 원본 단계 작업과 함께 롤백(상태 일관성 우선).
  BPROJA는 `@LogTarget` 미부착이라 감사로그 부담 없음.

> `Bproja`에는 1차에서 추가한 `changeStatus(String)`가 있고, `BaseEntity`에 `delete()`/`restore()`가
> 있다. upsert/softDelete는 이를 사용한다.

## 4. 단계별 통합 지점 (코드 확인 완료)

각 서비스에 `BprojaSyncService` 의존성을 주입하고, 아래 위치에 호출 1–2줄을 추가한다.
라인 번호는 작성 시점 기준 근사값이며, 구현 시 내용으로 위치를 특정한다.

### 4.1 실행 4단계 (소요예산/과업심의/입찰계약/대금지급)
네 서비스는 동일 패턴. 대상구분 `bgPrnTc`가 **'100'(사업)일 때만** 기록(‘200’ 전산업무비는 프로젝트
아님 → 미기록). 프로젝트 = `cncdRfrNo`, 단계 key = `docNo`, 상태 = native `stsTc`(통합 항등).

| 단계 | 서비스 | create | changeStatus | delete |
|---|---|---|---|---|
| 소요예산 | `EstimateService` | `create` (save 직후): `if("100".equals(req.bgPrnTc())) sync.upsert(req.cncdRfrNo(), docNo, "41")` | `changeStatus` (`e.changeStatus(to)` 직후): `if("100".equals(e.getBgPrnTc())) sync.upsert(e.getCncdRfrNo(), docNo, to)` | `delete` (`e.delete()` 직후): `if("100".equals(e.getBgPrnTc())) sync.softDelete(e.getCncdRfrNo(), docNo)` |
| 과업심의 | `DeliberationService` | save 직후, `"51"` | changeStatus, `to` | delete → softDelete |
| 입찰계약 | `ContractService` | save 직후, `"61"` | changeStatus, `to` | delete → softDelete |
| 대금지급 | `PaymentService` | save 직후, `"71"` | changeStatus, `to` | delete → softDelete |

- create의 초기 상태코드는 각 서비스의 `STS_DRAFT` 상수(41/51/61/71)와 동일.
- changeStatus의 `to`는 `req.stsTc()`(42/49, 52/59, 62/69, 72/79). native=통합이라 그대로 전달.
- delete는 상태를 바꾸지 않고 **softDelete**(BPROJA 행 DEL_YN='Y') 호출.

### 4.2 타당성검토 (CouncilService, 엔티티 Basctm) — **2차-B로 분리(본 계획 제외)**
타당성/협의회 통합은 깨진 협의회 코드와 얽혀 있어 별도 작업으로 분리한다. 참고용으로 통합 방향만 기록.

- 프로젝트 = `abusMngNo`, 단계 key = `itPtlAsctId`, 상태 = `itPtlAsctPrgStsTc`를 매핑:
  협의회상태(01–13) → 타당성 통합코드: `01–04`→**31**, `05–12`→**32**, `13`→**39**.
- 통합 지점(예정): `createCouncil`(save 직후)·`changeStatus`(전이 직후)에서 `sync.upsert(...)`.

**선결 회귀(2차-B에서 반드시 수반):** `CouncilRepository`의 네이티브 SQL이 1차에서 DROP된
`BPROJM.IT_PTL_STS_TC`와 코드값명 전환에서 rename된 `BPROJM.BZ_TP_C`를 참조해 **현재 런타임에 깨져
있다**(ORA-00904, 라이브 ITPOWN 스키마 확인). 구체:
- `updateProjectStatus`(`UPDATE TPRMPP_BPROJM SET IT_PTL_STS_TC=...`, line 92) — `createCouncil`(190),
  완료 경로(310, 364)에서 호출. → BPROJA upsert로 대체하고 메서드 제거.
- `findProjectsForCouncilAll`/`findProjectsForCouncilByDepartment`(151~, 203~) — `p.IT_PTL_STS_TC`,
  `p.BZ_TP_C` 참조. → `BZ_TP_C`는 `ABUS_PPO_CONE`로, 단일 상태 게이트('09'/'32')는 BPROJA 대표상태
  기반으로 **재설계**(예산편성 완료=신청자격 개념을 BPROJA 모델로 재정의해야 하므로 설계 결정 필요).

### 4.3 예산편성 (BudgetWorkService, 엔티티 Bbugtm)
상태 컬럼 없음. 프로젝트 = `item.orcPkVl()` (단, `"BPROJM".equals(item.orcTb())`일 때만), 단계
key = `bbugtm.getBgNo()`, 상태 = 고정 **21(진행중)**.
- `applyItemRates`의 BPROJM 분기에서 `bbugtmRepository.save(bbugtm)` 직후:
  `sync.upsert(item.orcPkVl(), bbugtm.getBgNo(), "21")`.
- **완료(22) 전이**: 현재 BudgetWorkService에 편성 확정/승인 액션이 없어 **이번 범위에서는 진행중까지만**
  기록한다. 편성 확정 액션이 도입되면 동일 패턴으로 `upsert(..., "22")`를 추가한다(§8 후속).

### 4.4 정보기술부문계획 (PlanService, 엔티티 Bplanm + 연관 Bplana)
상태 컬럼 없음. 계획은 N:M(한 계획 ↔ 여러 프로젝트)으로 `Bplana`(reqDocNo↔prjMngNo) fan-out.
프로젝트 = `prjMngNo`(루프 변수), 단계 key = `reqDocNo`, 상태 = 고정 **11(진행중)**.
- `createPlan`의 `Bplana` 생성 루프에서 각 `bplanaRepository.save(relation)` 직후:
  `sync.upsert(prjMngNo, reqDocNo, "11")`. (전산업무비 `itMngcNos` 루프는 프로젝트가 아니므로 제외.)
- `deletePlan`의 `Bplana` 소프트삭제 루프에서: `sync.softDelete(relation.getPrjMngNo(), reqDocNo)`.
- **완료(19) 전이**: PlanService에 제출/확정 액션이 없어 **이번 범위에서는 진행중까지만** 기록한다.
  제출/확정 액션 도입 시 `upsert(..., "19")` 추가(§8 후속).

## 5. 데이터 흐름

```
[단계 생성]  XxxService.create → 엔티티 save → BprojaSyncService.upsert(프로젝트, key, 통합상태)
[상태변경]   XxxService.changeStatus → entity.changeStatus → upsert(프로젝트, key, 통합상태)
[삭제]       XxxService.delete → entity.delete → softDelete(프로젝트, key)
[조회]       (1차 그대로) ProjectService가 BPROJA MAX 대표상태를 합성 → 화면 표시/필터
```

대표상태 합성·필터는 1차 구현이 그대로 동작하므로 ProjectService/ProjectRepositoryImpl 변경 없음.

## 6. 에러 / 경계 처리

- 실행 4단계 `bgPrnTc='200'`, 타당성 `abusMngNo` null, 예산편성 `orcTb≠'BPROJM'`,
  계획 전산업무비 항목 → 모두 upsert 호출 안 함(또는 no-op).
- upsert/softDelete는 호출자 트랜잭션에 참여(`@Transactional` 전파 기본). 단계 작업이 롤백되면 BPROJA도 롤백.
- 동일 `(abusMngNo, cncdRfrNo)`로 재호출 시 upsert가 멱등(상태만 최신화, DEL_YN 복원).

## 7. 사전협의(Brdocm) 제외 (확정)

요구사항정의서(`Brdocm`)는 스키마/코드상 프로젝트(`ABUS_MNG_NO`)를 특정할 경로가 없다
(`ServiceRequestDocService`는 프로젝트를 다루지 않음, BPROJM↔BRDOCM 연관 테이블 없음). BPROJA의
`ABUS_MNG_NO`는 항상 실제 BPROJM 프로젝트여야 하므로, 사전협의는 이번 범위에서 **적재 제외**한다.
연결 경로(필드/연관 테이블)가 확정되거나 요구사항정의서 작성 흐름에 "대상 프로젝트 선택"이 도입되면
동일 `BprojaSyncService.upsert` 패턴으로 추가한다(별도 작업).

## 8. 후속(이번 범위 아님)

- 예산편성 완료(22)·계획 완료(19) 전이: 각 도메인에 확정/제출 액션이 도입될 때 upsert 추가.
- 사전협의(01–09) 적재: 프로젝트 연결 경로 확정 후.
- 정산/완료(81–89) 단계: 해당 도메인 존재 시.

## 9. 컴포넌트 경계 / 책임

- **BprojaSyncService**: BPROJA upsert/softDelete의 단일 진입점. 의존: `BprojaRepository`. 멱등·방어적.
- **각 단계 서비스**: 자신의 create/changeStatus/delete 끝에서 sync 호출. 프로젝트/ key/ 상태를 in-scope
  값으로 전달. 매핑이 필요한 타당성만 작은 매퍼 사용.
- **CouncilStatusMapper(또는 private)**: 협의회상태→통합코드(31/32/39) 변환. 순수 함수.

## 10. 테스트

프로젝트 메모리상 `./gradlew test` worker가 불안정하므로 1차와 동일하게 `./gradlew compileJava`를
1차 검증으로 한다. 가능 범위에서 단위 테스트 작성:
- `BprojaSyncService`: 신규 upsert(INSERT), 기존 upsert(상태 갱신+복원), softDelete, null no-op.
- `CouncilStatusMapper`: 01–04→31, 05–12→32, 13→39 경계.
- 각 단계 서비스: create/changeStatus/delete 후 BprojaSyncService 호출 인자 검증(목 기반) — 특히
  `bgPrnTc='200'` 시 미호출, 예산편성 `orcTb≠'BPROJM'` 시 미호출.

## 11. 파일 영향 요약 (2차-A)

- **신규**: `BprojaSyncService.java`.
- **변경(주입+호출)**: `EstimateService`, `DeliberationService`, `ContractService`, `PaymentService`,
  `BudgetWorkService`, `PlanService`. (CouncilService는 2차-B.)
- **무변경**: `ProjectService`/`ProjectRepositoryImpl`(1차 읽기 경로 그대로), 엔티티(필요 메서드 기보유),
  DB(BPROJA 1차 생성됨, 신규 마이그레이션 없음).

## 12. 2차-B (별도 작업, 본 계획 제외)

타당성/협의회(Basctm) 통합은 아래 회귀 수정 + 재설계를 수반하므로 별도 brainstorm으로 진행한다.
- `CouncilRepository`의 `updateProjectStatus`(BPROJM 단일 상태 UPDATE) 제거 → `BprojaSyncService.upsert`로 대체.
- `findProjectsForCouncilAll`/`ByDepartment`의 `IT_PTL_STS_TC`·`BZ_TP_C` 의존 수정(컬럼 rename 반영 +
  신청 대상 판정을 BPROJA 대표상태 기반으로 재정의).
- Basctm create/changeStatus에 협의회상태→통합코드(31/32/39) 매핑 upsert 추가(§4.2).
> 비고: BZ_TP_C 깨짐은 코드값명 전환에서 비롯한 선행 회귀로, 1차 이전부터 존재했을 가능성이 큼.
