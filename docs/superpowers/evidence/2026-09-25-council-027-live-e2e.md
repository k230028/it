# COUNCIL-027 실제 연동 종단 검증 증적

## 실행 환경

- 실행일: 2026-09-25
- 프론트엔드: `0a817efe`, `http://127.0.0.1:3000`
- 백엔드 기준 커밋: `45f3400d` + 본 검증 중 로컬 수정, `local-ext`, `http://localhost:28080`
- 루트 기준 커밋: `db8cadc` + 본 증적·TASK 로컬 수정
- 데이터베이스: 로컬 Oracle XEPDB1, `ITPAPP` 접속·`ITPOWN` 현재 스키마
- 역할: OWNER, APPROVER, ADMIN, INFOSEC, EVALUATOR_A, EVALUATOR_B, OUTSIDER를 서로 분리한 브라우저 컨텍스트에서 사용

사번·성명·정확한 협의회 및 결재 식별자는 Git에 기록하지 않았다. 재현과 로컬 정리에 필요한 값은 비추적 `.tmp/council-local/council-027-roles.env`와 `council-027-state.json`에 보관했다.

## 시나리오 결과

| 번호 | 검증 내용 | 결과 | 관찰한 상태·응답 |
| ---: | --- | :--: | --- |
| 1 | OWNER 일반 사업 협의회 신청 | PASS | 201, 상태 01 |
| 2 | OUTSIDER·INFOSEC의 유형 03 상세 및 관리 경계 | PASS | 권한 밖 상세·쓰기 403 |
| 3 | 타당성검토표 저장, DB 재조회 스탬프, 낡은 스탬프 충돌 | PASS | 작성완료 02, 낡은 저장 409 |
| 4 | MFA 결재 상신 후 공통 결재 회수 | PASS | 03→02 |
| 5 | 재상신 후 APPROVER 반려 | PASS | 03→01 |
| 6 | 수정·작성완료·재상신 후 APPROVER 승인 | PASS | 01→02→03→04 |
| 7 | ADMIN 개최준비 및 평가위원 2명 편성 | PASS | 04→05, 비위원 일정 조회 403 |
| 8 | 위원 일정 응답, ADMIN 일정 확정·개최 | PASS | 05→06→07 |
| 9 | 평가 항목 누락과 미완료 차단, 위원별 6개 항목 제출 | PASS | 누락·미완료 400, 07→08→09 |
| 10 | 결과서 저장·확정, 위원 2명 결과 확인 | PASS | 확정 후 PUT 409, 09→10→11 |
| 11 | 결과 결재 상신과 팀장·부서장 순차 승인 | PASS | 11→12→13, 완료 후 쓰기 409 |
| 12 | 역할별 목록 접근, 직접 URL 재진입과 완료 화면 렌더 | PASS | HTTP 200, 완료 배너·결과서·평균점수 표시 |

브라우저 캡처와 API 단계별 JSON은 개인정보·내부 식별자를 포함할 수 있어 `.tmp/council-local/`에만 보관했다. 최종 캡처는 `council-027-completed.png`, 단계별 결과는 `council-027-phase1-results.json`과 `council-027-phase2-results.json`이다.

## 실행 중 발견하고 수정한 결함

1. 신규 타당성검토표 개요를 필수 필드 설정 전에 persist해 Oracle `ORA-01400`이 발생했다. 필수값을 채운 뒤 persist하도록 순서를 바꿨다.
2. 성과지표를 JPQL 벌크 삭제한 뒤 같은 복합키로 다시 persist할 때 관리 중 엔티티가 남아 `NonUniqueObjectException`이 발생했다. 삭제 flush 뒤 영속성 컨텍스트를 초기화했다.
3. 저장 응답의 동시성 스탬프와 곧바로 실행한 GET의 스탬프가 달랐다. flush·clear 후 DB 값을 재조회해 응답 스탬프를 계산하도록 바꿨다.
4. 비위원의 `GET /api/council/{id}/schedule/my`가 빈 목록 200을 반환했다. 위원 여부를 확인하고 403을 반환하도록 바꿨다.
5. 비위원의 결과서 검토가 일반 `SecurityException` 때문에 400으로 변환됐다. `AccessDeniedException`으로 통일해 403을 반환하도록 바꿨다.

## DB 대조와 검증 명령

최종 읽기 전용 대조 결과는 협의회 상태 13, 활성 위원 2명, 일정 응답자 2명, 평가자 2명, 평가 12행, 결과 확인자 2명, 결과서 1행, 사업 상태 45였다.

```powershell
cd C:\it\it_backend
.\gradlew.bat test --tests "com.kdb.it.domain.council.*"
```

- council 도메인: 47개 테스트 클래스, 501건 통과, 실패·오류 0
- 이번에 바꾼 Java 파일 6개: Spotless 개별 검사 통과
- 전체 `spotlessJavaCheck`: 실패. 이번 변경 밖 `BizplanListQueryIntegrationTest`와 `BizplanServiceTest`에 기존 포맷 위반이 남아 있다.

## 데이터 보존과 남은 범위

완료 상태 13과 공통 결재 이력이 생긴 자료는 수동 삭제하지 않았다. 로컬 검증 자료와 정확한 식별자는 `.tmp/council-local/`에 보존했고, 대상 사업 원본은 로컬 전용 `C027_BPROJM_BAK`·`C027_BPROJA_BAK`에 보관했다. 개발계·운영계 실행, 심의유형 02·04의 전체 수명주기, 완료 후 추진부서 통보는 별도 범위다.
