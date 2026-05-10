# 도메인 기반 레이어드 아키텍쳐

현재 레이어드 아키텍쳐로 구성되어있는 백엔드 프로젝트를 확장이 용이한 도메인 기반 레이어드 아키텍쳐로 리팩토링해주고 네이밍 컨벤션도 직관적인 명칭으로 통일시켜줘.
이후 관련된 프론트엔드 프로젝트에 백엔드 수정사항을 반영해줘.

[백엔드 프로젝트 구조]
1. 도메인별로 디렉토리 구조를 분리
 - common(공통) : system(로그인, 인증), iam(조직, 사용자, 권한관리, 역할), approval(신청서, 결재), code(코드), util(공통 유틸리티) 등
 - budget(예산) : project(사업), cost(전산업무비) 등
2. 도메인별로 API, Service, Repository, Controller, DTO, Entity를 분리

* 단방향 의존성: budget 도메인이 common 도메인을 참조할 수는 있지만, common이 budget을 참조해서는 안됨 (상위 -> 하위 흐름 유지)
* 서비스 간 호출 제한: 가능하면 Controller에서 여러 Service를 조합하거나, 별도의 Facade 레이어를 두어 도메인 Service 간의 직접적인 결합을 방지
* 순환 참조 금지: A 도메인이 B를 참조하고, B가 다시 A를 참조하는 상황을 방지하기 위한 구조로 개선

[백엔드 네이밍 컨벤션] 직관적인 명칭으로 통일
1. Entity는 DB Table 명칭을 사용
2. Service는 도메인 또는 비즈니스 로직 명칭을 사용
3. Repository는 도메인 또는 데이터 소스 명칭을 사용
4. Controller는 도메인 또는 API 명칭을 사용
5. DTO는 도메인 또는 API 요청/응답 명칭을 사용

* 변수명은 CamelCase로 작성
* 메서드명은 camelCase로 작성
* 클래스명은 PascalCase로 작성
* 인터페이스명은 PascalCase로 작성
* 상수명은 UPPER_SNAKE_CASE로 작성
* DTO 세분화: 요청용은 ~Request, 응답용은 ~Response 또는 ~Info를 접미사로 붙여 용도를 명확히 합니다. (예: BudgetCreateRequest, BudgetListResponse)
* Repository 메서드: Spring Data JPA를 사용하신다면 find..., exists..., count... 등 표준화된 명칭을 사용하도록 명시
* Entity 명칭: DB 테이블 명칭을 따르되, Java 클래스이므로 단수형 PascalCase를 유지 (예: TB_CORP_BUDGET -> CorpBudget)