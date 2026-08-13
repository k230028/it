# Oracle/Tibero 범용 DB 분석 스킬 설계

## 1. 목적

OpenCode 전역 스킬 `db-cli-analysis`를 제공해 Oracle과 Tibero 프로젝트의 라이브 DB를 조회 전용으로 분석한다. 스킬은 DB 관련 질문에 자동으로 발견되지만, 정적 코드와 DDL만으로 판단할 수 있으면 접속하지 않는다.

## 2. 범위

- Oracle: SQL*Plus(`sqlplus`), 대안 SQLcl(`sql`)
- Tibero: tbSQL(`tbsql`)
- 라이브 스키마, 테이블, 컬럼, 제약조건, 인덱스, 제한된 데이터 정합성 조회
- 정적 근거와 라이브 검증 근거를 구분한 결과 보고
- 완전 조회 전용: `SELECT`와 `WITH ... SELECT`만 허용
- 제외: DML, DDL, PL/SQL, 트랜잭션 제어, `EXPLAIN PLAN`, 세션 변경

## 3. 파일 구조

```text
~/.config/opencode/skills/db-cli-analysis/
├── SKILL.md
├── scripts/
│   └── invoke-db-analysis.ps1
└── references/
    ├── oracle.md
    ├── tibero.md
    └── safety.md

<프로젝트 루트>/
└── agents(db).md
```

기존 `AGENTS.md`, `CLAUDE.md`, `.gitignore`는 수정하지 않는다. `agents(db).md`는 OpenCode instructions 또는 references에 등록하지 않는다.

## 4. 프로젝트 설정 계약

`agents(db).md`는 하나의 활성 프로필만 가진다.

````markdown
# DB Analysis Configuration

```yaml
db_analysis:
  dbms: "oracle"
  client: "sqlplus"
  username: "ITPAPP_RO"
  connect: "127.0.0.1:11521/XEPDB1"
  password: "CHANGE_ME"
  schema: "ITPOWN"
  read_only: true
  dedicated_read_only_account: true
```
````

허용 DBMS와 클라이언트 조합은 `oracle/sqlplus`, `oracle/sql`, `tibero/tbsql`뿐이다. 문자열은 모두 큰따옴표를 사용한다. 비밀번호 원문 저장 위험은 사용자가 수용했지만 실제 비밀번호는 구현 산출물이나 Git 커밋에 넣지 않는다.

## 5. 접속 결정

1. DB 관련 질문인지 판단한다.
2. 현재 스키마·실데이터·배포 상태 확인이 필요한 경우에만 라이브 접속한다.
3. `agents(db).md`가 없거나 Git 추적 중이면 접속을 중단한다.
4. 설정 스키마와 클라이언트 존재를 확인한다.
5. SQL을 검증한 뒤 헬퍼를 통해 실행한다.
6. 접속 실패 시 DBMS, 계정, 접속 대상을 추측하거나 우회하지 않는다.

## 6. 보안 경계

- 에이전트는 `agents(db).md`를 `read`로 열거나 내용을 출력하지 않는다.
- PowerShell 헬퍼만 설정 파일을 직접 파싱한다.
- 비밀번호는 argv, 환경변수, 임시 SQL, 로그에 넣지 않는다.
- 클라이언트 프로세스 stdin에 비밀번호와 검증된 SQL을 순서대로 전달한다.
- 설정 파일은 Git 비추적 상태여야 하며, 추적 중이면 실행을 거부한다.
- 완전 조회 전용의 실제 경계는 SELECT 권한만 가진 전용 계정이다. `dedicated_read_only_account: true`가 아니면 실행하지 않는다.
- 민감 컬럼과 `SELECT *`를 거부하고 기본 최대 200행을 요구한다.

## 7. SQL 검증

경량 토크나이저가 문자열 리터럴과 주석을 제거한 뒤 다음을 검사한다.

- 단일 문장
- 최상위 `SELECT` 또는 `WITH ... SELECT`
- 금지: DML, DDL, PL/SQL, 트랜잭션 제어, `EXPLAIN PLAN`, `FOR UPDATE`
- 금지: `HOST`, `!`, `@`, `@@`, `START`, `SPOOL`, `STORE`, `GET`, `EDIT`
- 금지: `&name`, `&&name`, `${...}` 치환
- 금지: `SELECT *`

SQL 문자열 검사만으로 SELECT 내부 사용자 정의 함수의 부작용을 증명할 수 없으므로 전용 읽기 계정을 필수로 한다.

## 8. DB별 실행

### Oracle

- SQL*Plus: `sqlplus -S username@connect`
- SQLcl: `sql -S username@connect`
- 출력 설정과 `WHENEVER SQLERROR EXIT SQL.SQLCODE`를 주입한다.
- 다른 소유자 객체는 `schema.object`로 조회하며 `ALTER SESSION`을 사용하지 않는다.

### Tibero

- tbSQL: `tbsql username@connect`
- tbSQL 오류 패턴과 종료 코드를 함께 확인한다.
- Tibero 버전별 카탈로그 차이는 프로젝트 DB에서 조회 가능한 뷰를 먼저 확인한다.

## 9. 오류 처리

- 설정 오류: 누락 필드만 보고하고 값은 출력하지 않는다.
- Git 추적: `agents(db).md` 경로만 보고하고 접속하지 않는다.
- 클라이언트 없음: 필요한 실행 파일 이름만 보고한다.
- 인증/접속 실패: 클라이언트 stderr에서 비밀번호와 접속 문자열을 마스킹한다.
- SQL 거부: 위반한 정책 항목을 보고하며 SQL을 실행하지 않는다.
- DB 오류: 오류 코드와 비밀 제거 메시지를 반환한다.

## 10. 테스트

- 설정 파싱: Oracle/Tibero 정상, 필드 누락, 잘못된 조합, 자리표시자 비밀번호
- Git 추적 거부
- SQL allowlist: SELECT, WITH SELECT
- SQL denylist: DML/DDL/PLSQL/EXPLAIN/클라이언트 명령/치환/다중 문장/SELECT *
- 가짜 CLI 프로세스로 stdin 인증과 SQL 전달 확인
- 출력에서 비밀번호 마스킹 확인
- PowerShell 5.1과 PowerShell 7 호환 실행

## 11. 배포

- 전역 설치: `~/.config/opencode/skills/db-cli-analysis/`
- 폐쇄망 이관본: 바탕화면 이관 패키지의 `db-cli-analysis/`
- 적용에는 OpenCode 재시작이 필요하다.
