# DB Analysis Configuration

이 파일은 `db-cli-analysis` 전역 스킬의 로컬 접속 설정입니다. OpenCode instructions 또는 references에 등록하지 마십시오.

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

실제 비밀번호를 입력한 뒤 Windows ACL을 OpenCode 실행 계정만 읽을 수 있도록 제한하십시오. 이 파일이 Git 추적 상태이면 스킬은 접속을 거부합니다.
