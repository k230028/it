# Flyway checksum repair 운영 인계 양식

이 문서는 REPO-04의 환경별 운영 실행 기록 양식이다. 이 저장소 작업에서는 운영 DB 접속이나 `flyway repair`를 실행하지 않는다.

## 공통 금지사항

- migration script를 수정하지 않는다.
- `flyway_schema_history` 행을 삭제하거나 checksum을 SQL로 수동 수정하지 않는다.
- 계정, 비밀번호, Wallet 경로, 토큰 및 실제 secret을 문서·명령행·로그에 기록하지 않는다.
- 승인된 Flyway workflow와 변경 승인 없이 repair를 실행하지 않는다.

## 환경별 실행 기록

| 환경 | 대상 인스턴스 식별자 | 승인자/승인번호 | 실행일시(KST) | 상태 |
|---|---|---|---|---|
| local | 별도 보안 기록 | 미실행 | 미실행 | 대기 |
| dev | 별도 보안 기록 | 미실행 | 미실행 | 대기 |
| prod | 별도 보안 기록 | 미실행 | 미실행 | 대기 |

### 사전 확인

- [ ] 애플리케이션 중지 창과 backup/rollback 조건 승인
- [ ] `V20260825_001` migration artifact의 현재 checksum을 승인된 artifact 저장소에서 확인
- [ ] 대상 환경 `flyway_schema_history`의 해당 version, checksum, success 확인
- [ ] 구 checksum으로 이미 적용된 환경인지 판정
- [ ] repair 전 `validate` 결과와 확인자 기록

기준선: 현재 로컬 점검에서 확인된 delta row는 13개이며 history의 `success=1` 상태로 기록되어 있다. 이 값은 환경별 실제 결과를 대신하지 않으며, 운영/개발 결과는 아래 표에 별도로 기록한다.

| 환경 | before checksum | artifact checksum | delta 여부 | before validate | 확인자 |
|---|---|---|---|---|---|
| local | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |
| dev | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |
| prod | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |

### 승인된 실행

구 checksum으로 이미 적용되어 artifact와 불일치하는 환경에 한해서만, 승인된 Flyway workflow에서 애플리케이션을 중지한 뒤 `flyway repair`를 1회 실행한다. 명령은 환경의 보안 실행 시스템에서 수행하며 이 문서에는 명령행 비밀값을 복사하지 않는다.

### 사후 확인

- [ ] `flyway validate` 성공
- [ ] `flyway_schema_history` 대상 행 `success=1`
- [ ] repair 후 checksum이 현재 artifact와 일치
- [ ] 애플리케이션 기동 및 health check 성공
- [ ] 확인자·시각·변경 승인번호 기록

| 환경 | after checksum | after validate | success=1 | health check | 확인자/시각 |
|---|---|---|---|---|---|
| local | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |
| dev | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |
| prod | 미실행 | 미실행 | 미확인 | 미실행 | 미지정 |

현재 상태는 운영 인계 대기이며, 실제 환경별 repair 결과가 기입되기 전에는 REPO-04를 완료로 표시하지 않는다.

