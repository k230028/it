# 분석/설계서

## 주요내용

### [요청자 정보]

| 항목 | 내용 |
| --- | --- |
| 요청일자 | 2026-09-18 |
| 요청부서 | (미기재) |
| 요청문서번호 | (미기재) |
| 요청자명 | K230028 |

### [작성자 정보]

| 항목 | 내용 |
| --- | --- |
| 작성일자 | 2026-09-18 |
| 작성자명 | K230028 |

### [분석/설계 내용]

#### 1. 배경 및 개요

- **(배경)** 임시저장 예산작성안의 기존 첨부 삭제·교체 차단
- **(요청)** 사용자 대화 요청 · 본인·동일 부서·관리자 삭제 허용
- **(수집 구간)** 2026-09-18 작업분 · BE-115 · 미커밋 변경 기준
- **(개요 도식)** 예산작성안 인계 후 첨부 교체

```flow
[예산 첨부 삭제 권한 개선 1건]
      │
      ├─ ① 삭제 권한 : 본인 · 동일 부서 · 시스템관리자
      ├─ ② 업무 화면 : 정보화·경상사업 · 전산업무비 · 금융단말
      └─ ③ 기존 보호 : 타부서 차단 · 반입 원본 보존 · 연결 변경 제한
      │
[효과] 작성안 인계 · 첨부 교체 · 권한 일관성
```

- **(요건 목록)**

| 요건 | 요건명 | 한 줄 요약 | 영역 | 출처 |
| --- | --- | --- | --- | --- |
| **1** | 예산 첨부 삭제 권한 | 본인·주관부서·관리자 삭제 허용 | ①②③ | 사용자 요청 · BE-115 · `docs/superpowers/specs/done/2026-09-18-budget-attachment-deletion-design.md` |

#### 2. 개발 요건 / 관련 화면

| 요건 | 개발 요건 | 관련 화면(경로) | 요청 경위 |
| --- | --- | --- | --- |
| **1** | 예산 첨부 삭제·교체 허용 | 정보화·경상사업(`/info/projects/form`) · 전산업무비(`/info/cost/form`) · 금융단말(`/info/cost/terminal/[id]`) | K230028 대화 요청 · BE-115 |

#### 3. 개발 방향 설계

##### 가. 요건별 설계 방향

- **요건 1. 예산 첨부 삭제 권한**

| 구분 | 내용 |
| --- | --- |
| **현행** | 사업 첨부 범용 삭제 차단 · 비용 첨부 업로더·관리자 한정 |
| **변경** | 업로더 본인 또는 시스템관리자 또는 주관부서 일치 시 허용 |
| **부서 기준** | 활성 최종 원장 주관부서와 인증 사용자 부서코드 비교 |
| **경계** | 타부서 차단 · 부서·부모 누락 시 부서 예외 불허 |
| **삭제 범위** | 단건·일괄 논리 삭제 · 일괄 부모 조회 최대 1회 |
| **기존 보호** | 파일 연결 수정 권한 유지 · 반입 원본·배너·사용자가이드 보호 |
| **영향도** | 네 예산 업무 첨부 · API 요청·응답 필드 변경 없음 |
| **기존 제약** | 첨부 개정 순번 없음 · 관리번호의 최종 원장 부서 기준 |
| **검증 범위** | 서버 실제 권한 판정 · 화면 API 모의 교체 흐름 |

##### 나. 화면

| 구분 | 화면명 | 경로 | 변경 요지 |
| --- | --- | --- | --- |
| **변경** | 정보화사업·경상사업 | `/info/projects/form` | 기존 삭제·교체 요청의 서버 권한 변경 |
| **변경** | 전산업무비 개별 작성·수정 | `/info/cost/form` | 동일 부서의 첨부 삭제 허용 |
| **변경** | 금융단말 상세 수정 | `/info/cost/terminal/[id]` | 전산업무비 첨부 정책 공유 |

- **(화면 구현)** 기존 첨부 UI 재사용 · 운영 프론트 소스 변경 없음
- **(금융단말 범위)** 상세 수정 다이얼로그 첨부 포함 · 목록·연결 신규 모드 제외

##### 다. DB

- **해당없음** · 스키마·데이터 변경 없음 · 신규 마이그레이션 없음

##### 라. 수정대상

| 구분 | 해당 | 신설 | 변경 | 삭제 | 비고 |
| --- | :-: | :-: | :-: | :-: | --- |
| **EAI(온라인)** | 해당없음 | - | - | - | |
| **EAI(배치)** | 해당없음 | - | - | - | |
| **소스코드(프론트)** | 해당없음 | 0 | 0 | 0 | E2E 테스트 1파일 신설 별도 |
| **소스코드(백엔드)** | 해당 | 1 | 6 | 0 | 테스트 신설 1·변경 3파일 별도 |
| **기타** | 해당 | 3 | 4 | 0 | 분석설계·상세설계·계획 신설 · TASK·완료기록·백엔드 가이드·CLAUDE 변경 |

- **(집계 기준)** Git 추적 대상 19파일 · 테스트 결과서·PDF·증적은 로컬 산출물로 별도

##### 마. 변경대상 파일 목록

- **요건 1. 예산 첨부 삭제 권한**
  - **it_backend**
    - [신설] `src/main/java/com/kdb/it/infra/file/authz/BudgetFileDeleteAuthorizer.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/FileOwnershipChecker.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/authz/FileTargetWriteAuthorizer.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/authz/FileTargetWriteAuthorizerRegistry.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/authz/ProjectFileTargetWriteAuthorizer.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/controller/FileController.java`
    - [변경] `src/main/java/com/kdb/it/infra/file/service/FileService.java`
    - 테스트 신설 1파일 · 변경 3파일
  - **it_frontend**
    - E2E 테스트 신설 1파일
- **공통·기타**
  - [변경] `it_backend/CLAUDE.md` · `it_backend/docs/guides/security/file-security.md`
  - [변경] `TASK.md` · `TASK_DONE.md`
  - [신설] `docs/design-docs/2026-09-18-analysis-design-since-260918.md`
  - [신설] `docs/superpowers/specs/done/2026-09-18-budget-attachment-deletion-design.md`
  - [신설] `docs/superpowers/plans/done/2026-09-18-budget-attachment-deletion.md`

#### 4. 테스트 시나리오 (총 10건)

| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 |
| --- | --- | --- | --- | --- |
| **TC-01** | 삭제 권한·부서·보호 경계 | Jacoco | `src/test/java/com/kdb/it/infra/file/BudgetAttachmentDeletionTest.java` · 실제 컨트롤러·권한·서비스 조합 | 본인·동일 부서·관리자 허용 · 타부서 차단 |
| **TC-02** | 삭제 API 응답 회귀 | Jacoco | `src/test/java/com/kdb/it/infra/file/controller/FileControllerTest.java` · MockMvc 응답 검증 | 허용 204 · 거부 403 |
| **TC-03** | 공통 파일 권한·연결 수정 회귀 | Jacoco | `src/test/java/com/kdb/it/infra/file/service/FileServiceTest.java` · `src/test/java/com/kdb/it/infra/file/FileOwnershipCheckerTest.java` · `src/test/java/com/kdb/it/infra/file/authz/ProjectFileTargetWriteAuthorizerTest.java` · `src/test/java/com/kdb/it/infra/file/authz/CostFileTargetWriteAuthorizerTest.java` · `src/test/java/com/kdb/it/infra/file/authz/FileTargetWriteAuthorizerRegistryTest.java` | 기존 비예산 권한·보호 종류 유지 |
| **TC-04** | 사업 첨부 처리 순서·실패 보존 | Vitest | `tests/unit/features/project/useProjectAttachments.test.ts` | 삭제 후 업로드 · 실패 시 대기 상태 유지 |
| **TC-05** | 비용 첨부·금융단말 경계 | Vitest | `tests/unit/features/cost/useCostAttachments.test.ts` · `tests/unit/pages/costAttachmentFormBoundaries.test.ts` · `tests/unit/pages/costAttachmentDetailBoundaries.test.ts` | 공통 첨부 처리·단말 상세 범위 유지 |
| **TC-06** | 정보화사업 첨부 교체 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('정보화사업 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` | 기존 파일 제거 · 새 파일 재조회 |
| **TC-07** | 경상사업 첨부 교체 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('경상사업 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` | 공통 사업 첨부 교체 성공 |
| **TC-08** | 전산업무비 첨부 교체 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('전산업무비 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` | 인계받은 비용 첨부 교체 성공 |
| **TC-09** | 금융단말 첨부 교체 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('금융단말 상세 수정에서 인계받은 첨부를 삭제 교체하고 재조회한다')` | 상세 수정 다이얼로그 교체 성공 |
| **TC-10** | 운영 인계 문서 확인 | 사용자 | 실제 두 사용자 계정의 인계 문서 삭제·교체 · 사유: 실DB 데이터 | 적용 후 실제 파일 목록 변경 확인 |

### [진행경과 및 계획]

- **'26.09.18(금) 17:36** 요건 1 검증 · 파일 기능 회귀 324건 통과 (미커밋)
- **'26.09.18(금) 17:48** 백엔드 전체 검사·패키징 통과 · 5,573건 통과·2건 건너뜀
- **'26.09.18(금) 17:58** 최종 시나리오 9건 통과 · JUnit 144·Vitest 25·화면 E2E 4건 · 실DB 확인 1건 미실시
- **'26.09.--(예정)** 개발계 적용
- **'26.09.--(예정)** 운영계 적용
