---
name: fp
classification: workflow
description: |
  정통법(Detailed FP) 기준 기능점수 산정 방법 및 실무 가이드.
  소프트웨어 사업 대가산정(KOSA 가이드)의 핵심인 정통법 기능점수(Detailed FP) 산정을 위한
  구체적인 절차를 안내하고, 사용자의 시스템 정보를 입력받아 기능점수를 산출합니다.

  Triggers: 기능점수, FP 산정, 정통법, Detailed FP, 기능점수 산정,
  소프트웨어 대가산정, KOSA, UFP, ILF, EIF, EI, EO, EQ,
  function point, software cost estimation, FP calculation,
  機能ポイント, 機能規模測定, ファンクションポイント,
  功能点, 软件规模估算,
  puntos de función, estimación de software,
  points de fonction, estimation logicielle

  Do NOT use for: general cost estimation without FP methodology, hardware cost, or non-software projects.
argument-hint: "[system-name|feature-description]"
user-invocable: true
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash
---

# 정통법(Detailed FP) 기능점수 산정 스킬

> 소프트웨어 사업 대가산정을 위한 정통법(Detailed FP) 기능점수 산정 가이드

## 개요

정통법은 소프트웨어 사업 대가산정(KOSA 가이드)의 핵심 방법론으로, 간이법과 달리 각 기능의 상세 구성 요소(필드 수, 연관 테이블 수)를 세밀하게 분석하여 정확한 규모를 산출합니다.

---

## 용어 정의

| 용어 | 전체명 | 설명 |
|------|--------|------|
| **DET** | Data Element Type (데이터 요소 유형) | 화면에 보이는 입력/출력 필드의 수 (에러 메시지, 자동 생성 필드 포함) |
| **RET** | Record Element Type (레코드 요소 유형) | ILF/EIF 내 논리적 부분 그룹(서브 테이블 구조)의 수 |
| **FTR** | File Type Referenced (참조 파일 유형) | 트랜잭션 수행 시 읽거나 쓰는 ILF/EIF의 수 |
| **ILF** | Internal Logical File (내부논리파일) | 시스템 경계 내에서 유지·관리(CRUD)되는 DB 테이블 군 |
| **EIF** | External Interface File (외부인터페이스파일) | 시스템 경계 밖에서 관리되며 참조용으로만 읽는 데이터 |
| **EI** | External Input (외부입력) | 외부 데이터를 받아 ILF를 갱신하거나 시스템 상태를 변경하는 기능 |
| **EO** | External Output (외부출력) | 계산·파생 데이터 생성이 수반되어 외부로 출력하는 기능 |
| **EQ** | External Inquiry (외부조회) | 계산 없이 단순히 ILF/EIF 데이터를 조회·출력하는 기능 |
| **UFP** | Unadjusted Function Point (미조정 기능점수) | 보정 전 순수 기능점수 합계 |

---

## 산정 워크플로우 (5단계)

### Step 1: 산정 범위 및 경계 설정

```
1. 측정 대상 시스템/애플리케이션 정의
2. 시스템 경계(System Boundary) 설정
   - 내부 영역: ILF 유지·관리 대상
   - 외부 영역: EIF 참조 대상
```

### Step 2: 데이터 기능 산정 (ILF, EIF)

시스템 논리 데이터 모델(ERD 등)을 기반으로 산정합니다.

**[데이터 기능 복잡도 매트릭스 (RET × DET)]**

| RET \ DET | 1 ~ 19 DET | 20 ~ 50 DET | 51개 이상 DET |
|-----------|------------|-------------|---------------|
| 1개       | Low        | Low         | Average       |
| 2 ~ 5개   | Low        | Average     | High          |
| 6개 이상  | Average    | High        | High          |

**[데이터 기능 FP 점수표]**

| 유형 | Low | Average | High |
|------|-----|---------|------|
| **ILF** | 7 | 10 | 15 |
| **EIF** | 5 | 7  | 10 |

### Step 3: 트랜잭션 기능 산정 (EI, EO, EQ)

제공될 UI(화면), API, 배치 처리 사양서를 기반으로 산정합니다.

**[외부입력(EI) 복잡도 매트릭스 (FTR × DET)]**

| FTR \ DET | 1 ~ 4 DET | 5 ~ 15 DET | 16개 이상 DET |
|-----------|-----------|------------|---------------|
| 0 ~ 1개   | Low       | Low        | Average       |
| 2개       | Low       | Average    | High          |
| 3개 이상  | Average   | High       | High          |

**[외부출력(EO) / 외부조회(EQ) 복잡도 매트릭스 (FTR × DET)]**

| FTR \ DET | 1 ~ 5 DET | 6 ~ 19 DET | 20개 이상 DET |
|-----------|-----------|------------|---------------|
| 0 ~ 1개   | Low       | Low        | Average       |
| 2 ~ 3개   | Low       | Average    | High          |
| 4개 이상  | Average   | High       | High          |

**[트랜잭션 기능 FP 점수표]**

| 유형 | Low | Average | High |
|------|-----|---------|------|
| **EI** | 3 | 4 | 6 |
| **EO** | 4 | 5 | 7 |
| **EQ** | 3 | 4 | 6 |

### Step 4: 미조정 기능점수(UFP) 합산

```
UFP = (ILF 총점) + (EIF 총점) + (EI 총점) + (EO 총점) + (EQ 총점)
```

### Step 5: 보정계수(VAF) 적용 및 최종 개발비용 산출

```
1. 보정계수 산출 (각 항목별 난이도 계수표 참조)
   - 규모 보정계수
   - 애플리케이션 유형 보정계수
   - 언어 보정계수
   - 품질 및 특성 보정계수
   - 다중 사이트 보정계수 (해당 시)

2. 보정 후 기능점수
   = UFP × 규모 보정 × 타입 보정 × 언어 보정 × 품질 보정 (등)

3. 최종 금액 산정 (공공사업 기준)
   개발비 = 보정 후 기능점수 × FP 당 단가(해당 연도 고시단가)
   + 이윤(보통 10%) + 부가세(10%)
```

---

## 실무 체크리스트

### DET 카운팅 규칙
- **포함 O:** 사용자가 직접 입력/선택하거나 DB와 교환되는 데이터 단위
- **포함 X:** 단순 라벨, 아이콘, 페이징 버튼
- **버튼 처리:** 액션 버튼(저장, 조회)은 전체를 1~2개로 산정

### EO vs EQ 구분 기준

| 조건 | 유형 |
|------|------|
| 합계/평균/집계 등 수학 연산(파생) 포함 | **EO** |
| 그래프/차트 생성 | **EO** |
| 있는 값 그대로 조회·출력 | **EQ** |

### ILF vs EIF 구분 기준

| 조건 | 유형 |
|------|------|
| 우리 시스템 DB에 저장·관리 | **ILF** |
| 외부 시스템 DB (읽기만 가능) | **EIF** |
| 외부 REST API 실시간 호출 데이터 | **EIF** |

---

## 사용법

이 스킬을 호출하면 다음 절차로 기능점수를 산정합니다:

1. **시스템 범위 파악** - 대상 기능 목록 확인
2. **데이터 기능 식별** - ILF/EIF 목록 작성 및 DET/RET 카운팅
3. **트랜잭션 기능 식별** - EI/EO/EQ 목록 작성 및 DET/FTR 카운팅
4. **복잡도 판정** - 매트릭스 적용으로 Low/Average/High 결정
5. **UFP 합산** - 기능 유형별 점수 합산
6. **산정 결과표 출력** - 항목별 상세 내역 및 UFP 최종값 제시

```
예시 호출:
/fp 근태관리 시스템
/fp src/main 기능점수 산정해줘
```
