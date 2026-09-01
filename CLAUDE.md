---
[ 프로젝트 메인 가이드 ]
이 파일은 IT Project Portal 4개 저장소의 공통 작업 계약과 문서 단일 출처를 정의합니다.
백엔드 작업은 `it_backend/CLAUDE.md`, 프론트엔드 작업은 `it_frontend/CLAUDE.md`, DB 작업은 `it_database/CLAUDE.md`를 추가로 읽습니다.
---

## 1. 프로젝트와 저장소

IT Project Portal은 정보화 예산·사업·인력과 관리자 실시간 로그를 관리합니다.

| 저장소 | 책임 | 상세 규칙 |
| --- | --- | --- |
| `C:\it` | 공통 문서·도구·제품 요구사항 | 이 파일 |
| `it_backend` | Spring Boot API | `it_backend/CLAUDE.md` |
| `it_frontend` | Nuxt 4 CSR UI | `it_frontend/CLAUDE.md` |
| `it_database` | Oracle DDL·시드·Flyway 마이그레이션 | `it_database/CLAUDE.md` |

세 하위 디렉터리는 각각 독립 원격 저장소이며 루트 Git에는 포함되지 않습니다. 호환 커밋 조합은 `versions.lock`에 기록하고 `scripts/update-versions-lock.ps1`로 갱신합니다. 교차 저장소 변경은 백엔드 API 계약을 먼저 확정하고 프론트 타입과 소비 코드를 뒤이어 갱신합니다.

주요 루트 경로:

- `docs/`: 리포트·운영 기록·Superpowers 산출물
- `meta/`: 엔티티·컬럼 명명 SoT와 코드·조직·테이블 목록
- `prds/`: 제품 요구사항
- `FP/`: 기능점수 규칙과 산출물
- `tools/`, `scripts/`: 분석·운영 도구
- `TASK.md`, `TASK_DONE.md`: 활성 과제와 완료 기록

## 2. 단일 진실 공급원

| 주제 | SoT |
| --- | --- |
| API·엔티티·서버 인증·운영 비밀값 | `it_backend/CLAUDE.md`와 백엔드 코드 |
| UI·라우팅·클라이언트 인증 책임 | `it_frontend/CLAUDE.md`와 프론트엔드 코드 |
| 물리 데이터 모델 | `it_database/migrations/` |
| ORM 매핑 | 백엔드 엔티티 |
| 조회용 데이터 모델 인덱스 | `it_backend/docs/guides/persistence/data-model.md` |
| 엔티티·컬럼 명명 | `meta/meta.txt` |
| 컴포넌트 사용법 | `it_frontend/docs/guides/components/` |
| 미구현·기술부채 | `TASK.md` |

문서 역할은 다음처럼 구분합니다.

- `README.md`: 사람을 위한 설치·실행·구조 개요·문제 해결
- `CLAUDE.md`: 에이전트가 반드시 지킬 규칙·금지 사항·검증 명령
- `docs/guides/`: 반복해서 참고하는 구현법·계약·예제
- `docs/operations/`: 날짜가 있는 배포·복구·인계 기록
- `docs/superpowers/`: 설계와 구현 계획

같은 설명을 복제하지 말고 SoT를 링크합니다. 파일·테스트 개수나 완료 날짜 같은 시점성 정보는 CLAUDE에 넣지 않습니다.

## 3. 공통 작업 규칙

### 공유 워킹트리

여러 작업이 동시에 네 워킹트리를 공유하므로 무관한 변경이 존재하는 것이 정상입니다.

- `git add -A`, `git add .`, `git commit -a`를 사용하지 않고 경로를 명시합니다.
- 한 파일에 변경이 섞이면 `git add -p` 또는 cached patch로 자기 hunk만 스테이징합니다.
- 커밋 전 `git diff --cached --stat`과 `git rev-parse --abbrev-ref HEAD`를 확인합니다.
- 사용자나 다른 작업의 변경을 되돌리거나 정리하지 않습니다.
- 이미 푸시된 혼합 커밋은 이력을 재작성하지 말고 `TASK_DONE.md`에 대응 관계를 기록합니다.

### 코드와 주석

- 신규 JavaDoc·TSDoc·인라인 주석은 한글로 작성합니다.
- 단순 대입이나 자명한 메서드에는 주석을 추가하지 않습니다.
- 공개 API, 서비스 메서드, composable 반환 함수에는 입력과 실패 조건을 기록합니다.
- TODO/FIXME는 후속 조치가 가능한 문장으로 쓰고 장기 과제는 `TASK.md`에 등록합니다.
- 문서·주석 현행화 작업에서 별도 요청 없이 비즈니스 로직을 바꾸지 않습니다.

### 인증과 비밀값

- 브라우저 토큰은 백엔드 httpOnly 쿠키로 전달하며 프론트엔드 저장소에서 읽거나 저장하지 않습니다.
- 프론트 라우트 가드는 UX 보호일 뿐이며 서버가 JWT와 서비스 계층에서 최종 권한을 검증합니다.
- 운영 비밀값은 환경변수 또는 비공개 프로파일로 주입합니다.
- Oracle 비밀번호를 명령행 인자, 셸 히스토리, 문서, 로그에 기록하지 않습니다. 수동 작업은 콘솔 프롬프트, CI·무인 실행은 Wallet 별칭을 사용합니다.
- 상세 인증 정책은 `it_backend/CLAUDE.md`와 `it_backend/docs/guides/security/`를 따릅니다.

### 데이터베이스 변경

- 물리 변경은 `it_database/migrations/V{YYYYMMDD_NNN}__{CamelCaseDescription}.sql`로 추가합니다.
- 적용된 Flyway 스크립트는 수정하지 않고 새 버전으로 변경합니다.
- ITPOWN의 데이터베이스 문자셋은 `AL32UTF8`, `VARCHAR2` 길이 기준은 BYTE semantics입니다. 신규·변경 DDL은 세션 기본값에 맡기지 않고 `VARCHAR2(n BYTE)`를 명시하며, 저장 가능 여부는 글자 수가 아니라 UTF-8 바이트 길이와 `LENGTHB`로 확인합니다.
- 엔티티·검증·운영 적용 규칙은 `it_database/CLAUDE.md`와 `it_database/docs/guides/migrations.md`를 따릅니다.

## 4. 작업 흐름

1. 요청 범위의 CLAUDE와 가이드를 읽습니다.
2. 코드·설정·테스트에서 문서의 사실관계를 확인합니다.
3. 기존 공통 구현과 SoT를 검색한 뒤 최소 범위로 변경합니다.
4. 변경 유형에 맞는 테스트와 Health Stack을 실행합니다.
5. 문서·OpenAPI 타입·마이그레이션 등 함께 바뀌는 계약을 확인합니다.

성능·계약·실패 상태를 바꾸는 구현은 다음 공통 기준을 지킵니다.

- 목록 API는 DB 필터·명시적 안정 정렬·유한한 페이지 또는 상한을 함께 적용하고, bulk API는 IN 배치 조회로 N+1을 만들지 않습니다.
- 백엔드 DTO/OpenAPI 계약을 먼저 확정한 뒤 프론트에서 `npm run codegen`과 `npm run codegen:check`를 실행합니다. 생성 타입은 수기로 편집하지 않습니다.
- 빈 결과·누락 값·잘못된 입력·조회 실패를 같은 상태로 취급하지 않습니다. malformed 값은 정상 기본값이나 미존재로 숨기지 말고 진단·경고·차단 중 계약에 맞게 표면화합니다.
- 초기 조회 실패는 정상 빈 화면으로 대체하지 않고 재시도 가능한 오류 상태로 유지하며, 재조회 실패 때 이전 성공 데이터를 새 성공처럼 표시하지 않습니다.
- 정보화사업·경상사업은 `BPROJM(ABUS_MNG_NO, SNO)`의 순번으로 재상신 이력을 식별하며 `ODN_YN='Y'`가 경상사업, NULL 또는 `N`이 정보화사업입니다. 전산업무비는 `BCOSTM(BG_NO, BG_SNO)`를 사용합니다. 후속 업무 목록·집계·bulk 조회는 `LST_YN='Y'` 최종본만 사용하고, 미상신 작성 목록은 재상신 초안을 포함해 응답 순번을 보존합니다. 이력 조회·수정·결재 매핑도 관리번호와 순번을 함께 사용합니다.

Superpowers 산출물은 `docs/superpowers/{specs,plans,done}/`에 둡니다. 프로젝트 규칙과 일반 스킬이 충돌하면 이 저장소의 CLAUDE와 `docs/guides/`가 우선합니다.

## 5. Health Stack

루트에서 필요한 저장소만 선택해 실행합니다.

```powershell
# 백엔드
cd C:\it\it_backend
./gradlew test

# 프론트엔드
cd C:\it\it_frontend
npm run format:check
npm run check
npm test

# 호환 버전 기록
cd C:\it
./scripts/update-versions-lock.ps1
```

전체 설치·기동 URL·IDE 설정은 `README.md`, 세부 검증 명령은 각 하위 저장소 CLAUDE와 테스트 가이드를 따릅니다.
