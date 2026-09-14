# 전산예산 신청서 원장 스냅샷 v3 설계

## 1. 목적

전산예산 신청서가 상신 시점의 정보화사업, 경상사업, 전산업무비 원장을 충분히 보존하도록 스냅샷을 v3로 확장한다. 현재 PDF에서 사용하지 않는 원장 컬럼도 함께 저장하여, 이후 PDF 구조나 표시 항목이 바뀌더라도 과거 신청서 원장을 수정하거나 현재 운영 원장을 다시 조회하지 않고 저장된 신청서만으로 다시 렌더링할 수 있게 한다.

이번 변경의 직접 요구사항은 정보화사업·경상사업 품목의 통화가 외화일 때 PDF의 `당해 요청금액`을 원화 환산액이 아니라 외화 원금으로 표시하는 것이다.

## 2. 설계 원칙

- 신규 상신만 `form.version = 3`과 `IT_BUDGET_V3` 정규형을 사용한다.
- 기존 v1·v2 JSON은 수정, 백필, 재저장하지 않는다.
- v2 DTO와 해시 입력 구조는 동결하여 기존 `payloadDigest` 검증 결과가 바뀌지 않게 한다.
- v3는 현재 PDF용 표시 모델과 상신 시점 전체 원장 스냅샷을 함께 저장한다.
- 원장 스냅샷은 서버가 같은 읽기 트랜잭션에서 가져온 엔티티로만 생성한다.
- PDF는 현재 운영 원장을 재조회하지 않고 저장된 신청서 JSON만 사용한다.
- DB 스키마는 변경하지 않는다.

## 3. 범위

### 3.1 포함

- `BPROJM`, `BITEMM`, `BCOSTM`, `BTERMM`의 영속 스칼라 컬럼 스냅샷
- 상속된 `BaseEntity`의 삭제, GUID, 진행 순번, 생성·수정 감사 컬럼
- v3 사업 품목의 외화 원금 `foreignAmount`
- v1·v2·v3 버전별 백엔드 읽기와 무결성 검증
- v1·v2·v3 프론트 파싱, 렌더 모델 변환, PDF 표시
- OpenAPI 생성 타입과 백엔드·프론트 회귀 테스트
- 신규 엔티티 컬럼의 스냅샷 누락을 막는 구조 계약 테스트

### 3.2 제외

- JPA 연관 객체와 프록시 상태
- 원장 이력 테이블의 별도 저장
- 기존 신청서 JSON 변환 또는 데이터 보정
- 원장 금액 계산식과 결재 상태 전이 변경
- CAPPLM 물리 컬럼 변경

## 4. 선택한 구조

v3는 기존 표시용 `payload.projects`, `payload.costs`, `payload.summary`를 유지하고 `payload.ledger`를 추가한다. 표시 모델은 현재 PDF를 단순하게 유지하고, `ledger`는 미래 PDF 변경을 위한 원장 증적의 단일 출처가 된다.

표시 모델과 원장 스냅샷을 모두 두는 이유는 다음과 같다.

- v2 렌더러를 최소 변경으로 재사용할 수 있다.
- 코드명, 조직명, 사용자명처럼 원장 밖에서 해석한 상신 시점 표시값을 보존할 수 있다.
- 향후 표시 항목을 추가할 때 원장의 미사용 컬럼을 이용할 수 있다.
- 원장 물리명과 사용자 표시 의미를 한 구조에 섞지 않는다.

두 표현은 같은 엔티티 집합으로 한 번에 생성하고 전체 `payloadDigest`에 포함한다. 식별자, 개정 순번, 부모·자식 관계와 핵심 금액은 저장 전 교차 검증하여 서로 다른 원장을 가리킬 수 없게 한다.

## 5. v3 문서 구조

```json
{
  "form": { "id": "it-budget", "version": 3 },
  "payload": {
    "projects": [
      {
        "id": "P-2027-001",
        "revision": 2,
        "items": [
          {
            "id": "I-001",
            "currency": "USD",
            "amount": "1350000.000",
            "foreignAmount": "1000.000"
          }
        ]
      }
    ],
    "costs": [],
    "summary": {
      "total": "1350000.000",
      "asset": "1350000.000",
      "cost": "0.000"
    },
    "ledger": {
      "format": "IT_BUDGET_LEDGER_V1",
      "aggregates": [
        {
          "kind": "PROJECT",
          "id": "P-2027-001",
          "revision": 2,
          "parent": {
            "table": "BPROJM",
            "columns": {
              "ABUS_MNG_NO": "P-2027-001",
              "SNO": 2,
              "ABUS_NM": "차세대 시스템",
              "FST_ENR_DTM": "2026-09-15T09:00:00",
              "LST_CHG_DTM": "2026-09-15T10:30:00"
            }
          },
          "children": [
            {
              "table": "BITEMM",
              "columns": {
                "GCL_MNG_NO": "I-001",
                "SNO": 1,
                "CUR_C": "USD",
                "AMT": "1350000.000",
                "FC_AMT": "1000.000",
                "XCR": "1350.0000"
              }
            }
          ]
        }
      ]
    }
  },
  "approvalLine": {},
  "integrity": {
    "algorithm": "SHA-256",
    "canonicalization": "IT_BUDGET_V3",
    "payloadDigest": "sha256:...",
    "capturedAt": "2026-09-15T10:31:00Z",
    "sources": []
  }
}
```

`PROJECT` aggregate는 `BPROJM` 부모와 `BITEMM` 자식, `COST` aggregate는 `BCOSTM` 부모와 `BTERMM` 자식을 가진다. aggregate 순서는 사용자가 선택한 문서 순서를 유지하고 자식은 원장 복합키로 안정 정렬한다.

## 6. 원장 컬럼 캡처 계약

### 6.1 포함 기준

각 원장 엔티티와 `BaseEntity` 계층에서 `@Column`으로 매핑된 모든 필드를 포함한다.

- 복합키와 부모 연결 키
- 업무 입력과 설명
- 코드, 통화, 환율, 외화·원화 금액
- 최종 여부와 삭제 여부
- GUID와 GUID 진행 순번
- 최초 등록자·일시, 최종 변경자·일시

`@JoinColumn`, 컬렉션, 연관 엔티티, 계산 메서드와 transient 값은 제외한다. 연관 관계에 필요한 실제 외래키가 별도 스칼라 `@Column`로 존재하면 그 컬럼은 포함한다.

### 6.2 키와 값 표현

- 키는 `@Column(name)`의 실제 대문자 물리 컬럼명을 사용한다.
- 금액은 소수점 3자리 문자열이다.
- 환율은 소수점 4자리 문자열이다.
- 그 외 `BigDecimal`은 해당 컬럼 scale을 보존한 문자열이다.
- 날짜와 일시는 ISO 8601 문자열이다.
- 정수와 boolean은 JSON 숫자와 boolean으로 유지한다.
- 문자열은 임의 trim이나 유니코드 정규화를 하지 않는다.
- SQL NULL은 JSON null로 보존한다.

원장 캡처기는 컬럼마다 getter를 명시하여 값 의미와 숫자 정규화를 통제한다. 런타임 리플렉션으로 엔티티 전체를 직렬화하지 않는다.

### 6.3 누락 방지

구조 계약 테스트가 네 엔티티와 `BaseEntity`의 `@Column(name)` 집합을 수집하고, 각 테이블 캡처기가 선언한 컬럼 키 집합과 정확히 비교한다. 엔티티에 컬럼이 추가되면 캡처 코드와 테스트 픽스처를 함께 갱신하기 전까지 빌드가 실패한다.

읽기 시에는 과거 v3 문서를 위해 ledger column map의 필드 추가를 허용한다. 필수 테이블명, aggregate 식별자, 복합키와 값의 JSON 스칼라 여부는 검증하지만, 나중에 추가된 원장 컬럼이 과거 v3에 없다는 이유로 문서를 손상 처리하지 않는다. 원장 구조의 의미가 바뀌는 경우에만 `ledger.format`을 올린다.

## 7. 표시 모델 계약

v3의 표시 모델은 v2 필드를 유지하고 사업 품목에 다음 필드를 추가한다.

```json
{
  "currency": "USD",
  "amount": "1350000.000",
  "foreignAmount": "1000.000"
}
```

- `amount`: 원장 `BITEMM.AMT`, 원화 환산 당해 요청금액
- `foreignAmount`: 원장 `BITEMM.FC_AMT`, 외화 원금이며 KRW 품목은 null
- `currency`: 원장 `BITEMM.CUR_C`

표시 모델의 `foreignAmount`는 원장 캡처와 별도로 임의 계산하지 않는다.

## 8. PDF 표시 규칙

정보화사업과 경상사업의 소요예산 상세 표에 다음 규칙을 적용한다.

- `currency == KRW`: `amount`를 원화로 표시한다. 예: `₩1,350,000`
- `currency != KRW`이고 v3: `foreignAmount`를 해당 통화로 표시한다. 예: `US$1,000.00`
- v3 외화 품목인데 `foreignAmount`가 null이면 잘못된 원화값을 외화로 가장하지 않고 `-`로 표시한다.
- v1·v2: 저장된 구조와 기존 출력 결과를 그대로 유지한다.
- 총괄표, 사업별 합계와 정렬은 계속 원화 환산액을 사용한다.

통화 포맷은 전산업무비와 동일한 공통 포맷터를 사용한다. v3 금액 문자열의 소수점 3자리 정밀도를 임의 반올림하지 않는다.

## 9. 버전과 무결성

백엔드 reader는 버전별 DTO와 정규형을 명시적으로 분리한다.

- v1: 기존 비검증 legacy adapter
- v2: 동결된 v2 DTO와 `IT_BUDGET_V2`
- v3: 전체 원장 ledger를 포함한 v3 DTO와 `IT_BUDGET_V3`

v2 내부 모델이나 canonical JSON에 v3 필드를 추가해 null로 직렬화하는 방식은 금지한다. 기존 v2 해시 입력 바이트가 달라질 수 있기 때문이다.

v3 `payloadDigest`는 표시 모델, summary와 ledger 전체를 포함한다. `approvalLine`, `capturedAt`, recall 정보는 기존과 같이 payload 해시 밖에 둔다. 저장 후 ledger column 하나라도 바뀌면 무결성 검증이 실패한다.

미리보기·상신 사이 변경 감지를 위한 기존 source digest는 감사·GUID를 제외한 업무 컬럼 기준을 유지한다. 최종 저장 v3 payload에는 감사·GUID도 포함되며 최종 payload digest로 보호한다.

## 10. 백엔드 변경

- v2 모델·DTO·codec을 동결된 버전 전용 타입으로 보존한다.
- v3 snapshot 모델과 HTTP DTO를 추가한다.
- `ItBudgetSnapshotBuilder`가 표시 모델과 ledger를 동일 aggregate에서 생성한다.
- 사업 품목 표시 모델에 `Bitemm.fcAmt`를 `foreignAmount`로 넣는다.
- 네 원장 캡처기를 물리 컬럼명 기반으로 확장한다.
- `ItBudgetApprovalFacade`가 신규 미리보기와 상신을 version 3으로 생성한다.
- `ItBudgetSnapshotReader`가 v2와 v3를 각각 깊게 검증하고 버전별 digest를 계산한다.
- OpenAPI 계약에서 신규 미리보기 snapshot을 v3로 노출한다.

스냅샷 생성은 기존 exact revision 조회와 잠금 트랜잭션 안에서 수행한다. 현재 원장을 나중에 다시 조회해 ledger를 채우지 않는다.

## 11. 프론트엔드 변경

- 양식 definition의 신규 생성 버전을 3으로 올린다.
- v2 validator와 adapter는 변경하지 않고 v3 validator와 adapter를 추가한다.
- v3 ledger는 알려진 envelope·aggregate·row 구조와 JSON 스칼라 값만 검증하며 column map은 추가 키를 허용한다.
- v3 사업 품목의 `foreignAmount`를 렌더 모델 `fcAmt`로 옮긴다.
- PDF 사업 품목 금액 포맷을 snapshot version별로 분기한다.
- OpenAPI 타입은 백엔드 기동 후 `npm run codegen`으로 생성하며 수기로 수정하지 않는다.

현재 미리보기와 저장 문서 모두 서버가 반환한 같은 v3 snapshot을 사용한다.

## 12. 오류 처리

- 지원하지 않는 form version 또는 canonicalization은 손상 문서로 차단한다.
- v3 ledger envelope, aggregate 식별자, 부모·자식 테이블 또는 복합키가 손상되면 PDF와 결재 상태 변경을 차단한다.
- payload digest 불일치는 기존 무결성 실패 계약을 사용한다.
- v3 외화 품목의 `foreignAmount` 누락은 저장 JSON 자체를 변조로 판정하지 않는다. 원장에 실제로 null일 수 있으므로 PDF 셀을 `-`로 표시한다.
- 정상적인 과거 v1·v2 문서를 v3 데이터 부족으로 실패시키지 않는다.

## 13. 테스트 전략

### 13.1 백엔드

- 신규 미리보기와 상신이 version 3, `IT_BUDGET_V3`를 생성한다.
- 외화 `BITEMM.FC_AMT`가 표시 모델과 ledger에 같은 값으로 저장된다.
- 네 엔티티와 `BaseEntity`의 모든 `@Column`이 해당 캡처 키에 존재한다.
- 자식 순서가 달라도 v3 canonical digest가 같다.
- ledger의 업무·감사·GUID 컬럼 변조가 payload digest 불일치로 차단된다.
- 기존 저장 v2 fixture의 digest가 변경 없이 검증된다.
- v1, v2, v3 정상 문서를 모두 읽는다.
- v3 필수 identity와 table 구조 손상을 차단한다.
- 과거 v3에 나중에 추가된 선택 컬럼이 없어도 읽을 수 있다.
- OpenAPI의 v3 사업 품목에 `foreignAmount`와 ledger가 노출된다.

### 13.2 프론트엔드

- v1·v2 fixture는 기존 렌더 결과를 유지한다.
- v3 외화 정보화사업 품목의 당해 요청금액은 외화 원금과 통화기호를 표시한다.
- v3 외화 경상사업 품목도 같은 규칙을 적용한다.
- v3 KRW 품목은 기존 원화 표시를 유지한다.
- v3 외화 품목의 `foreignAmount`가 null이면 `-`를 표시한다.
- 총괄 금액과 정렬은 원화 환산액을 계속 사용한다.
- ledger column map의 추가 키를 허용하고 비스칼라 값은 거부한다.
- PDF docDefinition 스냅샷에서 관련 셀만 의도대로 바뀐다.

### 13.3 품질 게이트

- 백엔드: `./gradlew test`
- 백엔드 OpenAPI 기동 확인
- 프론트: `npm run codegen`, `npm run codegen:check`
- 프론트: `npm run format:check`, `npm run check`, `npm test`
- 실제 샘플 PDF를 PNG로 렌더링하여 정보화사업·경상사업의 KRW·외화 품목을 육안 확인

## 14. 배포 순서

1. v1·v2 reader를 유지하면서 v3 생성·읽기와 OpenAPI를 지원하는 백엔드를 배포한다.
2. 백엔드 OpenAPI에서 프론트 타입을 재생성한다.
3. v3 미리보기 파싱과 PDF 렌더링을 지원하는 프론트를 배포한다.
4. 신규 상신이 v3로 저장되고 기존 v2 조회·결재가 정상인지 확인한다.
5. 호환 커밋 조합을 루트 `versions.lock`에 기록한다.

백엔드는 v3 응답을 먼저 내므로 프론트와 같은 배포 묶음으로 전환한다. 순차 배포가 필요하면 백엔드에 짧은 전환 플래그를 두되 v2 문서 구조를 수정하지 않는다.

## 15. 완료 기준

- 신규 전산예산 신청서는 v3로 저장된다.
- v3에는 네 원장의 모든 영속 스칼라 컬럼이 상신 시점 값으로 들어 있다.
- 엔티티 컬럼 추가 시 캡처 누락 테스트가 실패한다.
- 정보화사업·경상사업의 외화 품목 당해 요청금액이 외화 원금으로 표시된다.
- 원화 품목, 총괄 합계와 정렬은 기존 원화 기준을 유지한다.
- 기존 v1·v2 신청서의 조회, PDF, 메일과 결재가 기존대로 동작한다.
- v2 payload digest가 이전 fixture와 동일하게 검증된다.
- v3 표시 모델과 ledger 전체가 payload digest로 보호된다.
- 현재 원장을 재조회하지 않고 저장된 v3 JSON만으로 PDF를 다시 만들 수 있다.
- 백엔드·프론트 품질 게이트와 실제 PDF 렌더 검증이 통과한다.

## 16. 기존 v2 설계 변경 기록

2026-09-06 v2 설계는 PDF·메일 최소 필드만 저장하고 감사·GUID를 제외하도록 결정했다. 실제 운영에서 사업 품목 외화 원금이 누락되어 과거 신청서의 표시 구조를 안전하게 바꾸기 어렵다는 한계가 확인됐다.

2026-09-15 결정으로 다음을 변경한다.

- v2 계약은 역사 데이터 호환을 위해 동결한다.
- 신규 v3부터 표시용 최소 모델과 전체 원장 ledger를 함께 저장한다.
- 원장 컬럼 누락을 빌드 시점 계약 테스트로 차단한다.
- additive 원장 컬럼은 같은 ledger format 안에서 선택 필드로 축적하고, 의미나 구조가 바뀔 때만 ledger format을 올린다.
