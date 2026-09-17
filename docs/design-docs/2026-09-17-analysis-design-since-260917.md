# 분석/설계서

## 주요내용

### [요청자 정보]

| 항목 | 내용 |
| --- | --- |
| 요청일자 | 2026-09-17 |
| 요청부서 | (미기재) |
| 요청문서번호 | (미기재) |
| 요청자명 | (미기재) |

### [작성자 정보]

| 항목 | 내용 |
| --- | --- |
| 작성일자 | 2026-09-17 |
| 작성자명 | (미기재) |

※ 사용자 대화 요청 기준 · Git 작성자명 미설정

### [분석/설계 내용]

#### 1. 배경 및 개요

- **(배경)** 일반 사용자 화면 권한·전산업무비 입력·전결권 수정 개선
- **(요청)** 사용자 직접 요청 4건 · FE-89~92 등록
- **(수집 구간)** 2026-09-17 00:00 ~ 19:36 · 커밋 0건 · 미커밋 변경 기준
- **(개요 도식)** 업무별 변경 요약

```flow
[사용자 요청 4건]
      ↓
      ├─ ① 게시판·가이드 : 사용자 권한 · 작성 버튼
      ├─ ② 전산업무비 : 200바이트 · 증감 사유 · 일괄 작성
      ├─ ③ 직원 정보 : 전화 · 메신저 · 일반 사용자
      └─ ④ 정보화사업 : 전결권 직접 선택 · 자동 변경 방지
      ↓
[효과] 권한에 맞는 화면 · 입력 오류 예방 · 전결권 수정 편의
```

- **(요건 목록)**

| 요건 | 요건명 | 한 줄 요약 | 영역 | 출처 |
| --- | --- | --- | --- | --- |
| **1** | 게시판·가이드 권한 | 일반 사용자 작성·편집 버튼 숨김 | ① | 사용자 요청 · TASK FE-89 |
| **2** | 전산업무비 증감 사유 | 200바이트 제한·일괄 입력란 추가 | ② | 사용자 요청 · TASK FE-90 |
| **3** | 직원 연락 버튼 | 일반 사용자 연락 버튼 5종 표시 | ③ | 사용자 요청 · TASK FE-91 |
| **4** | 전결권 임의변경 | 사용자 지정 코드 선택·재계산 방지 | ④ | 사용자 요청 · TASK FE-92 |

#### 2. 개발 요건 / 관련 화면

| 요건 | 개발 요건 | 관련 화면(경로) | 요청 경위 |
| --- | --- | --- | --- |
| **1** | 주요일정·FAQ·사업 가이드 작성 권한 | `/board/[blbMngNo]` · `/guide` | 사용자 대화 · FE-89 |
| **2** | 단건·일괄 증감 사유 입력 | `/info/cost/form` · `/info/cost` | 사용자 대화 · FE-90 |
| **3** | 직원 연락 수단 개방 | 공통 직원 정보 다이얼로그 | 사용자 대화 · FE-91 |
| **4** | 전결권 수동 변경 | `/info/projects/form` | 사용자 대화 · FE-92 · `docs/superpowers/specs/done/2026-09-17-portal-user-fixes-design.md` |

#### 3. 개발 방향 설계

##### 가. 요건별 설계 방향

- **요건 1. 게시판·가이드 권한**

| 구분 | 내용 |
| --- | --- |
| **현행** | 주요일정·FAQ·가이드 작성 버튼 일반 사용자 노출 |
| **변경** | 게시판 003·004 관리자 표시 · 가이드 관리자 편집 가드 |
| **영향도** | 목록·상세 수정 버튼 · 서버 권한 정책 변경 없음 |

- **요건 2. 전산업무비 증감 사유**

| 구분 | 내용 |
| --- | --- |
| **현행** | 단건 UI 600바이트 · DB 200바이트 · 일괄 입력란 부재 |
| **변경** | UTF-8 200바이트 공통 상수 · 입력·붙여넣기·저장 검증 |
| **변경(목록)** | 예산 우측 선택 입력란 · 계약상대처 폭 90px · 열 폭 조정 |
| **영향도** | 단건·일괄 작성 및 수정 · 기존 indRsn API 필드 재사용 |

- **요건 3. 직원 연락 버튼**

| 구분 | 내용 |
| --- | --- |
| **현행** | 전화 3종·쪽지·대화 시스템관리자 전용 |
| **변경** | 로그인 행번 존재 시 5종 표시 |
| **영향도** | 공통 직원 정보 다이얼로그 · 발신자·수신자·호출 규약 유지 |

- **요건 4. 전결권 임의변경**

| 구분 | 내용 |
| --- | --- |
| **현행** | 금액·품목 변경 시 전결권 자동 산정 |
| **변경** | 카드 우측 수정 아이콘 · 표준 다이얼로그 · 30~35 선택 |
| **변경(코드)** | IT_PTL_EDRT_TC · EDRT_USER · 순서 21~26 |
| **변경(보존)** | 사용자 지정 코드 재계산 제외 · 계속사업 조회 후 보존 |
| **변경(저장)** | 닫기 무변경 · 다이얼로그 저장 후 폼 전체 저장으로 영속화 |
| **영향도** | 정보화사업 폼·상세 전결권 표시 · 기존 edrtTc API 계약 유지 |

##### 나. 화면

| 구분 | 화면명 | 경로 | 변경 요약 |
| --- | --- | --- | --- |
| **변경** | 주요일정·FAQ 목록·상세 | `/board/[blbMngNo]` | 요건 1 · 작성·편집 표시 |
| **변경** | 사업 가이드 | `/guide` | 요건 1 · 관리자 편집 |
| **변경** | 전산업무비 단건·일괄 | `/info/cost/form` · `/info/cost` | 요건 2 · 200바이트·새 컬럼 |
| **변경** | 직원 정보 | 공통 다이얼로그 | 요건 3 · 연락 버튼 5종 |
| **변경** | 정보화사업 작성·상세 | `/info/projects/form` · `/info/projects/[id]` | 요건 4 · 수동 전결권 |

##### 다. DB

| 구분 | 객체명 | 신설/변경 | 마이그레이션 | 비고 |
| --- | --- | --- | --- | --- |
| **공통코드** | TPRMPP_CCODEM · TPRMPP_CLANGM | 데이터 추가 | `V20260917_001__AddUserDefinedApprovalAuthority.sql` | 30~35 6건 · 영문명 6건 |

- **(로컬 적용)** 신규 DML 직접 적용·계약 검증 통과 · 기존 Flyway 20260907.002 실패로 전체 migrate 미완료
- **(운영 적용)** DBA 검토 대기 · 기존 테이블·이력 수정 없음

##### 라. 수정대상

| 구분 | 해당 | 신설 | 변경 | 삭제 | 비고 |
| --- | :-: | :-: | :-: | :-: | --- |
| **EAI(온라인)** | 해당없음 | - | - | - | 인터페이스 변경 없음 |
| **EAI(배치)** | 해당없음 | - | - | - | 배치 변경 없음 |
| **소스코드(프론트)** | 해당 | 5 | 18 | 0 | 운영 app·i18n 기준 · 테스트·환경 설정 별도 |
| **소스코드(백엔드)** | 해당 | 0 | 0 | 0 | 테스트 1파일 변경 · 운영 소스 변경 없음 |
| **기타** | 해당 | - | - | 0 | TASK·설계·결과서·DB 인계·증적 추가 |

##### 마. 변경대상 파일 목록

- **it_frontend 운영 코드**

- **[변경]** `app/components/common/EmployeeInfoDialog.vue`
- **[변경]** `app/components/cost/CostFormSections.vue`
- **[변경]** `app/components/cost/CostListTable.vue`
- **[변경]** `app/components/projects/ProjectApprovalAuthorityField.vue`
- **[변경]** `app/composables/cost/useCostFormSave.ts`
- **[변경]** `app/composables/costList/useCostPersistence.ts`
- **[변경]** `app/composables/costList/useCostRowEditing.ts`
- **[변경]** `app/composables/costListPageHelpers.ts`
- **[변경]** `app/composables/useProjectDetailPage.ts`
- **[변경]** `app/composables/useProjectFormPage.ts`
- **[변경]** `app/features/project/useContinueProjectSearch.ts`
- **[변경]** `app/features/project/useProjectFormApproval.ts`
- **[변경]** `app/pages/board/[blbMngNo]/[nacMngNo]/index.vue`
- **[변경]** `app/pages/board/[blbMngNo]/index.vue`
- **[변경]** `app/pages/guide/index.vue`
- **[변경]** `app/pages/info/projects/form.vue`
- **[변경]** `app/utils/common.ts`
- **[변경]** `i18n/messages/project.ts`
- **[신설]** `app/components/cost/CostListTable.css`
- **[신설]** `app/components/projects/ProjectApprovalAuthorityDialog.vue`
- **[신설]** `app/utils/approvalAuthority.ts`
- **[신설]** `app/utils/boardAccess.ts`
- **[신설]** `app/utils/costInputLimits.ts`

- **it_frontend 검증** 테스트 17파일 · 예열 단계의 실제 SSO 이동 제거
- **it_backend 검증** `src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java`
- **it_database 신규** `migrations/V20260917_001__AddUserDefinedApprovalAuthority.sql` · 동일 버전 검증 SQL · 운영 인계
- **공통 문서** TASK·TASK_DONE · 설계·계획 · 분석/설계서·결과서 · 운영 적용 대기

#### 4. 테스트 시나리오 (총 14건)

| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 |
| --- | --- | --- | --- | --- |
| **TC-01** | 요건 1 권한별 작성 조건·가이드 조회 실패 회귀 | Vitest | `tests/unit/utils/boardAccess.test.ts` · `tests/unit/pages/guide-detail-load-failure.test.ts` · `tests/unit/pages/guide-attachment-error.test.ts` · `tests/unit/pages/board/boardPostDetailTabFlow.test.ts` | 일반 사용자 숨김 · 관리자 편집 유지 |
| **TC-02** | 요건 1 일반 사용자 화면 권한 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('일반사용자는 주요일정 FAQ 사업 가이드 작성 편집 버튼을 볼 수 없다')` | 대상 화면 작성·편집 버튼 미노출 |
| **TC-03** | 요건 1 관리자 화면 권한 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('시스템관리자는 주요일정 FAQ 사업 가이드 작성 편집 버튼을 유지한다')` | 관리자 작성·편집 버튼 노출 |
| **TC-04** | 요건 2 단건 입력·저장 바이트 경계 | Vitest | `tests/unit/components/cost/CostFormSections.test.ts` · `tests/unit/composables/cost/useCostFormSave.test.ts` | 200바이트 허용 · 201바이트 거부 |
| **TC-05** | 요건 2 일괄 변경 추적·붙여넣기·저장 검증 | Vitest | `tests/unit/composables/costListPageHelpers.test.ts` · `tests/unit/composables/costList/useCostRowEditing.test.ts` · `tests/unit/composables/costList/useCostPersistence.test.ts` · `tests/unit/components/cost/CostListTable.test.ts` · `tests/unit/pages/project-domain-i18n.test.ts` | 사유 단독 변경 감지 · 초과값 저장 차단 |
| **TC-06** | 요건 2 단건 작성 화면 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('단건 증감 사유는 200바이트를 표시하고 초과 입력을 거부한다')` | 200바이트 표시 · 초과 입력 시 이전 값 유지 |
| **TC-07** | 요건 2 일괄 작성 화면 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('일괄 작성은 예산 다음 증감 사유를 수정하고 200바이트를 제한한다')` | 예산 우측 컬럼 · 선택 입력 · 바이트 제한 |
| **TC-08** | 요건 3 직원 연락 표시·호출 계약 | Vitest | `tests/unit/components/EmployeeInfoDialog.test.ts` | 일반 사용자 연락 5종 · 기존 요청 형식 유지 |
| **TC-09** | 요건 3 일반 사용자 직원 정보 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('일반사용자의 직원 정보에 연락 버튼 5종이 표시된다')` | 전화 3종 · 쪽지 · 대화 표시 |
| **TC-10** | 요건 4 수동 전결권 보존·선택 다이얼로그 | Vitest | `tests/unit/features/project/useProjectFormApproval.test.ts` · `tests/unit/features/project/useContinueProjectSearch.test.ts` · `tests/unit/components/projects/ProjectApprovalAuthorityDialog.test.ts` · `tests/unit/components/projects/ProjectApprovalAuthorityField.test.ts` | 30~35 보존 · 자동 산정 유지 · 취소 무변경 |
| **TC-11** | 요건 4 신규·수정 API 서비스 저장 | Jacoco | `src/test/java/com/kdb/it/domain/budget/project/service/ProjectServiceTest.java` | 30~35 신규·수정 시 입력 코드 보존 |
| **TC-12** | 요건 4 전결권 선택 화면 | E2E | `tests/e2e/portal-user-fixes.spec.ts` · `test('전결권 임의변경은 사용자 지정 코드만 선택하고 닫기는 반영하지 않는다')` | 6개 선택지 · 저장 반영 · 닫기 취소 |
| **TC-13** | 요건 3 실제 전화·메신저 연동 | 사용자 | 직원 정보 · 전화 3종·쪽지·대화 동작 · 사유: 외부 시스템 실호출 | 실제 수신 및 통화 연결 |
| **TC-14** | 요건 4 배포 환경 코드·저장 재조회 | 사용자 | 공통코드 30~35 · 사업 저장 후 재접속 · 사유: 배포 환경 및 실DB 데이터 | 수동 코드·명칭 유지 · 금액 변경 후 동일 코드 |

### [진행경과 및 계획]

- **'26.09.17(목) 18:49** 요건 1~4 설계 · TASK·계획 등록 (미커밋)
- **'26.09.17(목) 18:50** 요건 4 구현 · 백엔드 저장 계약 테스트 (미커밋)
- **'26.09.17(목) 19:02** 요건 1~4 구현 · 프론트 수정·DB 스크립트 (미커밋)
- **'26.09.17(목) 19:36** 요건 1~4 검증 · 공식 자동화 시나리오 12건 통과 (미커밋)
- **'26.09.--(예정)** 개발계 적용 · 검토 후 일정 확정
- **'26.09.--(예정)** 운영계 적용 · DBA 검토 후 일정 확정
