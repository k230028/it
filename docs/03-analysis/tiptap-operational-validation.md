# Tiptap 운영 데이터·E2E 검증 현황

- 검증일: 2026-07-26
- 대상: TIP-02, TIP-03, TIP-07, TIP-09
- 상태: 자동화 subset 완료, 인수조건 미완료

## TIP-03 운영 데이터 측정

로컬 Oracle `ITPAPP@127.0.0.1:11521/XEPDB1`에서 2026년 최신·활성 사업/품목과 `CO_C_ID_NM='IOE_C'` 코드를 실제 집계했다. 접속 비밀번호는 결과·로그·커밋에 기록하지 않았다.

| 카테고리 | 건수 | 합계 |
| --- | ---: | ---: |
| IT_BUDGET | 23 | 54,357,800,000원 |
| CAP_BUDGET | 15 | 53,157,800,000원 |
| OPEX | 8 | 1,200,000,000원 |

- 미매핑 코드는 0그룹이다.
- 검증 SQL의 `IOE_DVC/HW/SW/CPIT` 4종 기준에서는 건수와 합계 모두 `IT_BUDGET = CAP_BUDGET + OPEX`가 성립한다.
- SQLPlus 재실행 2회에서 같은 결과와 정상 종료를 확인했다.

그러나 승인/seed/검증 SQL은 CAP_BUDGET에 `IOE_CPIT`를 포함하는 반면, 운영 조회 `BudgetStatusQueryRepositoryImpl`은 `IOE_DVC`, `IOE_HW`, `IOE_SW` 3종만 사용한다. 현재 측정 데이터의 `IOE_CPIT`가 0건이어서 결과가 같을 뿐 정책이 정렬된 것은 아니다. 포함 정책을 결정하고 런타임과 검증 기준을 일치시키기 전까지 TIP-03은 활성 상태로 유지한다.

## TIP-02 자동화 subset과 미충족 인수조건

완료된 자동화:

- 카테고리·연도·항목 선택 후 실제 변수 삽입과 화면 해석 금액
- 사업 선택 후 저장 요청 HTML의 정확한 `data-token`
- MISSING 상태의 원본 토큰·tooltip·`aria-label`
- `E2E_LOCAL_DB=true`에서 실제 품목 금액 변경, API 반영, `finally` 원복과 시작값 동일 재조회
- HWPX 다운로드와 JSZip `Contents/section0.xml` inspection

남은 인수조건:

- 실제 Vue NodeView DOM에 `data-token`이 없어 저장 HTML 검증이 렌더링 DOM 인수조건을 대체하지 못한다. TIP-07에서 수정한다.
- HWPX source의 `data-snapshot`을 99억원, 최신 resolve 응답을 125억원으로 설정해도 section XML은 99억원을 출력한다. TIP-09에서 내보내기 전 최신 해석을 적용한다.

HWPX 회귀 테스트는 `test.fail`로 알려진 실패를 명시하되 assertion을 실제 실행한다. XML에 125억원 포함, 99억원 미포함, 미해석 토큰 0건을 요구하므로 현재 제품에서는 expected failure이고, 제품 수정 후에는 unexpected pass가 되어 annotation 제거를 요구한다.

## 변이 검증

- 화면 금액: resolve mock을 125억원에서 126억원으로 바꾸자 기대 125억원 assertion이 RED가 되었고 원복 후 GREEN으로 복귀했다.
- HWPX: stale snapshot/resolve를 99억원으로 두자 XML이 실제 99억원을 포함하고 기대 125억원이 없어 RED가 되었다. resolve를 125억원으로 바꾼 뒤에도 현재 exporter가 snapshot을 복사해 동일 결함을 재현했으며, 이를 TIP-09 expected-failure로 고정했다.
