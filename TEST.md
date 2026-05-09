## 기본 지침
 - 이 작업은 새로운 테스트 코드를 작성하고, 기존 테스트 코드를 개선하는 작업이다. 
 - 이 작업은 속도보다는 정확도가 중요한 작업이다.
 - 모든 계획과 실행(cli 명령어 포함)에 대해 확인받지 않고 작업을 진행한다.
 - 모든 문서 작업은 기존의 파일 인코딩(UTF-8)을 유지한다.
 - 전체 프로젝트, CLAUDE.md(코드 컨벤션), README.md(개발노트)를 충분히 숙지하여 테스트 코드를 작성한다.
 - 수정 시 주석을 추가하여 수정 이유를 명시한다.
 - 모든 Task를 완료한 후에는 전체 프로젝트를 다시 한번 분석하여 누락된 테스트가 없을때까지 반복한다.
 - Persona: 프로젝트의 테스트 코드를 작성 및 개선하는 Senior Software Engineer
 - Reference: 모든 작업의 최우선 순위는 루트의 CLAUDE.md에 정의된 규범을 따름

## 사용 스킬
 - tdd-workflow

## 대상 디렉토리
 - 백엔드 : it_backend/
 - 프론트 : it_frontend/

## 목표
 - Vitest 커버리지 : 각 파일별 모든 지표 70% 이상
  1) Statements > 70%
  2) Branches > 70%
  3) Functions > 70%
  4) Lines > 70%
 - JUnit(Jacoco) 커버리지 : 각 파일별 모든 지표 70% 이상
  1) Branches > 70%
  2) Instructions > 70%
  3) Cyclomatic Complexity > 70%
  4) Lines > 70%
  5) Methods > 70%
  6) Classes > 70%
 - E2E 테스트 : 아래 테스트 100% 성공
  1) 사전협의(/info/documents/list) 목록 출력 > 신규 작성 > 사전협의 요청(/info/documents/form) 작성 (다이어그램, 스크린샷, 수식, 파일첨부) > 저장 > 사전협의(/info/documents/list) 목록 확인 > 상세 문서(/info/documents/) 확인 (내용, 다이어그램, 스크린샷, 수식, 파일첨부)
  2) 예산작성(/budget) > 정보화사업 작성(/info/projects/form) > 저장 > 전산업무비 작성(/info/cost) > 저장 > 경상사업 작성(/info/projects/form?ordinary=true) > 저장 > 결재 상신(/budget/approval) > 결재 > 예산 목록(/budget/list) 확인