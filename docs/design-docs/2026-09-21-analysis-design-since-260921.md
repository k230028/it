# 분석/설계서

## 주요내용

### [요청자 정보]

| 항목 | 내용 |
| --- | --- |
| 요청일자 | 2026-09-21 |
| 요청부서 | (미기재) |
| 요청문서번호 | (미기재) |
| 요청자명 | K230028 |

### [작성자 정보]

| 항목 | 내용 |
| --- | --- |
| 작성일자 | 2026-09-21 |
| 작성자명 | K230028 |

### [분석/설계 내용]

#### 1. 배경 및 개요

- **(배경)** 첨부 업로드 실패에도 저장 완료 안내·화면 이동 발생
- **(요청)** 파일명 100바이트 초과 안내·실패 상태 보존
- **(수집 구간)** 2026-09-21 FE-93 미커밋 작업분
- **(개요 도식)** 첨부파일 선택부터 저장 결과 확인까지

```flow
[첨부 실패 오인 방지 1건]
      │
      ├─ ① 파일 선택 : 길이 검사 · 초과 파일 안내
      ├─ ② 저장 처리 : 사전 검증 · 기존 파일 보존
      └─ ③ 결과 확인 : 실패 안내 · 화면 유지 · 재시도
      │
[효과] 실패 조기 발견 · 입력 보존 · 완료 오인 방지
```

- **(요건 목록)**

| 요건 | 요건명 | 한 줄 요약 | 영역 | 출처 |
| --- | --- | --- | --- | --- |
| **1** | 첨부 파일명·저장 실패 처리 | UTF-8 100바이트 검사·실패 시 작성 화면 유지 | ①②③ | 사용자 오류 문의 · FE-93 · `docs/superpowers/specs/done/2026-09-21-attachment-name-and-save-failure-design.md` |

#### 2. 개발 요건 / 관련 화면

| 요건 | 개발 요건 | 관련 화면(경로) | 요청 경위 |
| --- | --- | --- | --- |
| **1** | 파일명 검증·저장 완료 오인 방지 | 사업 작성(`/info/projects/form`) · 비용 작성(`/info/cost/form`) · 금융단말 상세(`/info/cost/terminal/[id]`) | K230028 대화 요청 |

#### 3. 개발 방향 설계

##### 가. 요건별 설계 방향

- **요건 1. 첨부파일 검증과 실패 처리**

| 구분 | 내용 |
| --- | --- |
| **현행** | 파일명 사전 검사 없음 · 사업 첨부 실패 후 완료 흐름 진행 |
| **변경** | 공통 첨부 선택 시 확장자 포함 UTF-8 100바이트 검사 |
| **저장 검사** | 사업·비용 본문 저장 전 검사 · 첨부 삭제 전 재검사 |
| **선택 정책** | 초과 파일 포함 선택 묶음 미추가 · 기존 선택 보존 · 인라인 오류 |
| **실패 처리** | 사업 본문 저장 사실 안내 · 완료 안내·이동 중단 · 실패 파일 보존 |
| **재시도** | 생성된 관리번호·스탬프 유지 · 중복 신규 생성 방지 |
| **영향도** | 공통 첨부 선택 필드 사용 화면 · 사업 정상·병합 저장 후처리 |
| **DB 기준** | `FL_NM` 100 BYTE · `V20260831_003`의 BYTE 전환 계약 |
| **제외** | DB 길이 확장·파일명 자동 절단·서버 API 계약 변경 없음 |
| **기존 제약** | 본문·첨부 별도 요청 · 본문 저장의 자동 롤백 없음 |

##### 나. 화면

| 구분 | 화면명 | 경로 | 변경 요지 |
| --- | --- | --- | --- |
| **변경** | 정보화사업·경상사업 작성/수정 | `/info/projects/form` | 파일명 사전 검사 · 첨부 실패 시 작성 화면 유지 |
| **변경** | 전산업무비 작성/수정 | `/info/cost/form` | 본문 저장·파일 삭제 전 파일명 검사 |
| **변경** | 금융단말 상세 수정 | `/info/cost/terminal/[id]` | 공통 선택 필드·첨부 동기화 검사 적용 |

##### 다. DB

- **해당없음** · 기존 100바이트 한도 유지 · 신규 마이그레이션 없음

##### 라. 수정대상

| 구분 | 해당 | 신설 | 변경 | 삭제 | 비고 |
| --- | :-: | :-: | :-: | :-: | --- |
| **EAI(온라인)** | 해당없음 | - | - | - | |
| **EAI(배치)** | 해당없음 | - | - | - | |
| **소스코드(프론트)** | 해당 | 1 | 8 | 0 | 테스트 신설 1·변경 4 별도 |
| **소스코드(백엔드)** | 해당없음 | 0 | 0 | 0 | |
| **기타** | 해당 | 3 | 2 | 0 | 분석설계·상세설계·계획 · TASK·완료기록 |

##### 마. 변경대상 파일 목록

- **요건 1. 첨부파일 검증과 실패 처리**
  - [신설] `it_frontend/app/utils/attachmentFileName.ts`
  - [변경] `it_frontend/app/components/common/AttachmentUploadField.vue`
  - [변경] `it_frontend/app/features/project/useProjectFormSave.ts`
  - [변경] `it_frontend/app/features/project/useProjectAttachments.ts`
  - [변경] `it_frontend/app/features/cost/useCostAttachments.ts`
  - [변경] `it_frontend/app/composables/useProjectFormPage.ts`
  - [변경] `it_frontend/app/composables/cost/useCostFormSave.ts`
  - [변경] `it_frontend/app/pages/info/cost/form.vue`
  - [변경] `it_frontend/i18n/messages/common.ts`
  - 테스트 신설 1파일 · 변경 4파일
- **공통·기타**
  - [변경] `TASK.md` · `TASK_DONE.md`
  - [신설] `docs/design-docs/2026-09-21-analysis-design-since-260921.md`
  - [신설] `docs/superpowers/specs/done/2026-09-21-attachment-name-and-save-failure-design.md`
  - [신설] `docs/superpowers/plans/done/2026-09-21-attachment-name-and-save-failure.md`

#### 4. 테스트 시나리오 (총 9건)

| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 |
| --- | --- | --- | --- | --- |
| **TC-01** | 파일명 바이트 경계 | Vitest | `tests/unit/utils/attachmentFileName.test.ts` | 영문·한글·이모지·확장자 포함 100바이트 허용·초과 차단 |
| **TC-02** | 사업 저장 실패·재시도 | Vitest | `tests/unit/features/project/useProjectFormSave.test.ts` | 실패 시 완료·이동 차단 · 생성 1회 후 동일 사업 수정 |
| **TC-03** | 첨부 삭제 전 검증 | Vitest | `tests/unit/features/project/useProjectAttachments.test.ts` · `tests/unit/features/cost/useCostAttachments.test.ts` | 초과 파일이 있으면 기존 파일 삭제 요청 없음 |
| **TC-04** | 비용·단말·사업 폼 회귀 | Vitest | `tests/unit/composables/cost/useCostFormSave.test.ts` · `tests/unit/components/cost/TerminalFormDialog.test.ts` · `tests/unit/composables/useProjectFormPage.test.ts` | 기존 저장·잠금·재시도 계약 유지 |
| **TC-05** | 파일명 초과 화면 안내 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('첨부 파일명은 UTF-8 100바이트까지 선택되고 초과 선택은 화면에서 안내한다')` | 오류 지속 표시 · 기존 정상 선택 유지 |
| **TC-06** | 정보화사업 실패 후 재시도 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('정보화사업 첨부 업로드 실패 후 완료 이동 없이 재시도한다')` | 작성 화면·실패 첨부 유지 · 재저장 성공 |
| **TC-07** | 경상사업 실패 후 재시도 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('경상사업 첨부 업로드 실패 후 완료 이동 없이 재시도한다')` | 공통 사업 실패·재시도 정책 유지 |
| **TC-08** | 네 화면 정상 교체 회귀 | E2E | `tests/e2e/budget-attachment-deletion.spec.ts` · `test('정보화사업 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` · `test('경상사업 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` · `test('전산업무비 인계받은 작성안의 첨부를 삭제 교체하고 재조회한다')` · `test('금융단말 상세 수정에서 인계받은 첨부를 삭제 교체하고 재조회한다')` | 삭제·업로드·재조회 정상 동작 |
| **TC-09** | 실제 파일 업로드 확인 | 사용자 | 배포 후 실제 예산안의 파일 선택·업로드·재조회 · 사유: 실DB 데이터 | 100바이트 정상 저장 · 초과 이름 안내 확인 |

### [진행경과 및 계획]

- **'26.09.21(월) 09:53** 요건 1 구현 · 파일명·실패 후처리 수정 (미커밋)
- **'26.09.21(월) 09:57** 요건 1 검증 · 자동화 시나리오 8건 통과 · 실DB 1건 미실시
- **'26.09.--(예정)** 개발계 적용
- **'26.09.--(예정)** 운영계 적용

## FE-93 추가 적용: 본문 에디터 파일명 사전 검사 (2026-09-21)

- 사업 가이드와 요구사항정의서 작성·수정의 서버 업로드형 에디터에 확장자 포함 UTF-8 100바이트 검사를 추가했다.
- 파일 선택, 이미지 선택, 이미지 붙여넣기·드래그 경로에서 공통 검사 함수를 사용한다. 초과하면 구체적인 파일명 안내를 표시하고 업로드 콜백을 호출하지 않는다.
- 파일 선택 입력값을 초기화하여 재선택할 수 있고, 다이얼로그를 유지한다. 붙여넣기·드래그는 임시 이미지 노드를 만들기 전에 거부한다.
- Base64 본문 이미지와 엑셀 내용 일괄 입력은 파일 테이블 저장 경로가 아니므로 이 검사를 적용하지 않는다.
- 관련 단위 테스트 26건 통과. 요구사항정의서 브라우저 테스트에서 긴 파일 선택 및 이미지 붙여넣기 시 파일 API 요청 0건, 본문 이미지 미삽입, 화면 유지 확인.
- 이번 추가분 증적: it_frontend/.cache/editor-name-{check,format,unit,e2e}.log. 실DB 업로드 시험은 미실시.

- 추가분 최종 검증: 전체 단위 538파일·6,092건 통과, 관련 브라우저 1건 통과, npm run check 및 format:check 종료코드 0. 기존 PDF는 추가분 반영 전 산출물이며 이번 기록은 Markdown에 반영함.

