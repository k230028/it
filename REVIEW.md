## 기본 지침
 - 이 작업은 모든 계획과 실행(cli 명령어 포함)에 대해 확인받지 않고 작업을 진행한다.
 - 모든 문서 작업은 기존의 파일 인코딩(UTF-8)을 유지하며, [현행화 대상 파일]의 기존 구조를 파괴하지 않고 섹션을 추가하거나 내용을 보강하는 방식으로 진행한다.
 - 이 작업은 it_backend, it_frontend 디렉토리 전체를 분석하여 진행한다. 속도보다는 정확도가 중요한 작업이다.
 - 전체 프로젝트를 분석하여 불합리한 구조, 비효율적인 코드, 개선이 필요해 보이는 로직을 찾아내어 수정하고 [현행화 대상 파일]를 업데이트한다.
 - 수정 시 주석을 추가하여 수정 이유를 명시하고, 영향도가 클 것으로 예상되는 부분은 TASK.md에 기록한다.
 - [Task 1]부터 [Task 4]까지 순차적으로 충분히 숙지한 후에 진행한다.
 - 모든 Task를 완료한 후에는 전체 프로젝트를 다시 한번 분석하여 [현행화 대상 파일]이 최신 상태인지 확인하고, 누락된 부분이 없을때까지 반복한다.
 - Persona: 프로젝트의 기술 부채를 해결하고 문서를 최신화하는 Senior Software Engineer
 - Reference: 모든 작업의 최우선 순위는 루트의 CLAUDE.md에 정의된 규범을 따름

### 현행화 대상 파일
 - C:\it\README.md
 - C:\it\CLAUDE.md
 - C:\it\TASK.md
 - C:\it\it_frontend\README.md
 - C:\it\it_frontend\CLAUDE.md
 - C:\it\it_backend\README.md
 - C:\it\it_backend\CLAUDE.md

## [Task 1: Source Code Annotation]
 - Scope: 프로젝트 내 모든 소스 파일 (.js, .ts, .vue, .java 등)
 - Instruction:
  - CLAUDE.md의 주석 규칙을 로드하여 표준 포맷을 확인한다.
  - 파일 헤더, 클래스/인터페이스, public/private 메소드, 복잡한 로직의 변수에 주석이 누락되었는지 전수 조사한다.
  - 기존 주석 중 코드의 실제 동작과 일치하지 않거나, 가독성이 낮은 주석은 최신 로직에 맞게 한글로 수정한다.
  - 개선이 필요해 보이는 로직은 TODO:, FIXME: 등의 태그 주석을 설정한다.
  - 주의: 비즈니스 로직(코드 자체)은 절대 수정하지 않는다.

## [Task 2: README.md (Development Notes) Update]
 - Format: 표준 오픈소스 또는 기술 위키 양식을 준수한다.
 - Instruction:
  - 현재 코드베이스를 빠짐없이 꼼꼼히 분석하여 아키텍처의 핵심 설계 결정(Design Decisions), 주요 모듈 간 관계, 사용된 핵심 기술 스택의 특징을 '개발 노트' 섹션에 상세히 기술한다.
  - 신규 개발자가 프로젝트에 투입되었을 때 흐름을 파악할 수 있도록 컨텍스트 위주로 작성한다.
  - 작성 중 CLAUDE.md에 내용은 Task 3(CLAUDE.md) 진행 시 반영되도록 기억한다.
  - 작성 중 개선이 필요해 보이는 로직이 있다면 Task 4(TASK.md) 진행 시 반영되도록 기억한다.

## [Task 3: CLAUDE.md (Code Convention) Update]
 - Format: 표준 CLAUDE.md 양식을 준수한다.
 - Instruction:
  - 현재 코드베이스를 분석하여 코드 컨벤션 등 CLAUDE.md에 작성해야 할 내용을 상세히 기술한다.

## [Task 4: TASK.md (Project Backlog) Maintenance]
 - Instruction:
  - 기존 TASK.md의 항목을 전수 검사한다.
  - 소스 코드 내에 TODO:, FIXME: 등의 태그가 있거나, 주석 수정 중 발견된 잠재적 개선점(성능, 보안, 리팩토링 필요성)을 신규 과제로 등록한다.
  - 이미 완료된 작업(코드상으로 구현이 끝난 항목)은 [Done] 또는 [완료] 상태로 업데이트하고 조치 일자를 기록한다.