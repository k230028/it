---
name: fp
description: Use when calculating or revising Detailed Function Points, UFP, ILF, EIF, EI, EO, EQ, RET, DET, FTR, or software project cost estimates for this IT Portal project.
---

# IT Portal 정통법 기능점수 산정

## 핵심 원칙

기능점수는 현재 코드·DDL을 실측해 날짜별 CSV로 남기고 프로젝트 생성기로 재계산한다. 매트릭스와 비용 값을 답변에 복제하지 말고 코드 SoT를 사용한다.

상세 분류 기준이 필요하면 [references/methodology.md](references/methodology.md)를 읽는다.

## SoT

| 내용 | 파일 |
| --- | --- |
| 복잡도 매트릭스·점수 | `FP/lib/fp-rules.mjs` |
| 보정계수·FP 단가·이윤·부가세 | `FP/lib/config.mjs` |
| CSV 파싱·검증 | `FP/lib/csv.mjs` |
| 코드·DDL 실측 | `FP/lib/scan.mjs` |
| 집계·UFP | `FP/lib/aggregate.mjs` |
| 직전 산정 비교 | `FP/lib/diff.mjs` |
| HTML 리포트 | `FP/generate-report.mjs` |
| 보고용 아티팩트 | `FP/build-artifact.mjs` |
| 규칙·파서 회귀 테스트 | `FP/tests/` |

## 워크플로우

1. 루트 `CLAUDE.md`와 프론트엔드·백엔드·DB 규칙을 읽고 시스템 경계를 확정한다.
2. DDL과 코드에서 논리 데이터 그룹을 식별해 ILF·EIF와 RET·DET를 산정한다.
3. 화면, API, 배치에서 사용자 인식 단위 프로세스를 식별해 EI·EO·EQ와 FTR·DET를 산정한다.
4. `FP/fp-estimate-YYYY-MM-DD.csv`를 아래 헤더 형식으로 새로 만든다. 이전 산정본을 덮어쓰지 않는다.
5. 직전 산정 대비 값이 달라진 행에만 `변경내용`을 기록한다. 최초 산정은 전 행 `최초 산정`으로 표시한다.
6. 생성기를 실행하고 경고, CSV 재계산값, 코드 실측값, 고아 테이블·엔티티를 확인한다.
7. 경영진·발주처 보고가 요청된 경우에만 아티팩트를 추가 생성한다.

```powershell
node FP/generate-report.mjs --date=YYYY-MM-DD
node FP/build-artifact.mjs --date=YYYY-MM-DD
node --test FP/tests/fp-rules.test.mjs FP/tests/csv.test.mjs
```

### CSV 형식

```text
세부업무(도메인),단위프로세스명(기능),기능설명,SW기능,FP유형,RET/FTR,DET,복잡도,FP점수,변경내용
```

- `SW기능`은 등록·수정·삭제·조회·출력·내부논리파일·외부연계파일 중 하나를 모든 행에 적는다. 등록·수정·삭제는 `EI`, 조회는 `EQ`, 출력은 `EO`, 내부논리파일은 `ILF`, 외부연계파일은 `EIF`에 대응하며 생성기가 `FP유형`과의 대응을 검증한다. EI는 ILF를 새로 만들면 등록, 기존 행의 값·상태를 바꾸면 수정, 물리·논리 삭제면 삭제로 적는다.
- `복잡도`는 `H`·`A`·`L`로 적는다(H=High, A=Average, L=Low). 생성기는 RET/FTR·DET로 재계산해 CSV 값과 대조한다.
- CSV 필드에는 쉼표를 넣지 않는다. 생성기는 리포트와 같은 날짜의 CSV가 없으면 중단되어야 한다.
- `SW기능` 열이 없고 복잡도가 `Low/Average/High`인 과거 산정본은 비교·추이 계산을 위해 읽기만 지원한다. 새 산정본에는 쓰지 않는다.

## 결과 형식

- 시스템 경계와 산정 기준일
- 유형별 기능 수와 UFP, SW기능별 건수·FP
- 복잡도는 H·A·L로 표기
- 적용한 보정계수·단가의 실제 SoT 값
- 직전 산정 대비 증감과 변경 근거
- CSV, 검증 리포트, 선택적 아티팩트 경로
- 경고와 수동 검토가 필요한 가정

## 흔한 실수

- 물리 테이블 하나를 무조건 ILF 하나로 센다.
- 단순 조회와 파생·집계 출력을 같은 유형으로 분류한다.
- 단가나 이윤율을 문서에 복사해 `config.mjs`와 이중 관리한다.
- 기능명을 바꾸고 `변경내용`을 비워 삭제·추가처럼 보이게 한다.
- `SW기능`과 `FP유형`을 어긋나게 적거나(조회+EI 등) EI 행의 `SW기능`을 비운다.
- 복잡도를 `Low/Average/High`나 상·중·하로 적는다.
- 생성된 HTML을 직접 수정한다.
