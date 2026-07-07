# 실시간 로그 운영 정책 및 실행계획 판단 (2026-07-07)

## 범위
- 대상: `GET /api/admin/realtime-logs`, `V_ITPAPP_LOG_FEED`
- 요구: LOG-03, LOG-04, LOG-06
- 원칙: 테이블/컬럼/PK 변경 없음. 필요 시 인덱스 또는 View만 검토.

## LOG-03: Push 전환 정책
- 현재 구현은 관리자 화면의 폴링 방식으로 유지한다.
- SSE/WebSocket 전환은 이번 범위에서 구현하지 않고, 운영 feature flag로 분리한다.
- 제안 flag:
  - `realtime-log.push.enabled=false`
  - `realtime-log.push.transport=sse`
  - `realtime-log.poll.interval-ms=5000`
- 전환 검토 임계치:
  - 동시 관리자 모니터링 사용자 20명 이상이 30분 이상 지속
  - `/api/admin/realtime-logs` p95 응답시간 1초 초과가 10분 이상 지속
  - DB AWR/운영 모니터링에서 `V_ITPAPP_LOG_FEED` 조회가 상위 부하 쿼리로 반복 관측
- 실제 push 구현은 인증 쿠키 기반 연결 유지, 관리자 권한 재검증, 연결 수 제한, 장애 시 폴링 fallback을 포함하는 별도 기능으로 분리한다.

## LOG-04: 보존 정책
- 보존 정책은 테이블 분리나 신규 아카이브 테이블 없이 운영 설정과 View 분리로 다룬다.
- 기본 조회 View는 최근 운영 관측 구간만 대상으로 삼고, 장기 보관/감사용 조회가 필요하면 별도 archive View를 설계한다.
- 권장 운영 기준:
  - 온라인 조회 기본 대상: 최근 30일
  - 감사/조사 보존: 기관 정책에 맞춘 별도 백업 또는 DBA 관리 영역
  - 삭제/파티션/아카이브 테이블 생성은 본 애플리케이션 Flyway 범위가 아닌 운영 DBA 절차로 분리
- 이번 slice에서는 LOG-04를 문서화로 종결하고 테이블 DDL을 추가하지 않는다.

## LOG-06: 쿼리/인덱스 상황
- `RealtimeLogRepository`는 `V_ITPAPP_LOG_FEED`를 조회하며, 최신 피드는 `CHG_DTM DESC, LOG_TBL DESC, LOG_HIS_TGR_SNO DESC` 순으로 정렬한다.
- 증분 조회는 `(CHG_DTM, LOG_TBL, LOG_HIS_TGR_SNO)` 복합 커서 조건을 사용한다.
- 기존 마이그레이션 `it_database/migrations/V20260629_005__AddRealtimeLogFeedIndex.sql`이 이미 `TPRMPP_CCODEL(CHG_DTM)` 누락 인덱스를 보강했다.
- 기존 노트 `docs/superpowers/notes/2026-06-29-p4-explain-results.md`에 따르면 `V_ITPAPP_LOG_FEED`는 20개 로그 테이블의 `UNION ALL` View라 단일 기반 테이블 커버링 인덱스를 만들 수 없다.
- 같은 노트에서 19개 로그 테이블은 이미 `CHG_DTM` 인덱스를 사용했고, `TPRMPP_CCODEL`만 full scan이어서 `IX_CCODEL_CHG_DTM`을 추가한 것으로 확인된다.

## 실행계획 재측정 상태
- 로컬에 `sqlplus`와 SQLcl은 존재한다.
- 로컬 Oracle 접속(`ITPAPP@127.0.0.1:11521/XEPDB1`) 후 `ALTER SESSION SET CURRENT_SCHEMA=ITPOWN` 기준으로 객체 상태를 확인했다.
- `ALL_OBJECTS` 확인 결과 `ITPOWN.V_ITPAPP_LOG_FEED` View와 `ITPOWN.IX_CCODEL_CHG_DTM` Index는 모두 `VALID` 상태다.
- `ALL_IND_COLUMNS` 확인 결과 `IX_CCODEL_CHG_DTM`은 `ITPOWN.TPRMPP_CCODEL(CHG_DTM)` 단일 컬럼 인덱스다.
- 이번 작업에서는 이미 적용된 `V20260629_005`와 2026-06-29 실행계획 증거, 로컬 객체 상태 확인이 있어 추가 인덱스/View DDL은 만들지 않았다.
- 추가 후보 인덱스는 Oracle 실데이터 분포와 View 정의 재확인 없이 안전하게 확정하기 어렵다.

## 결정
- 신규 DB 마이그레이션 없음.
- 테이블/컬럼/PK 변경 없음.
- LOG-06은 기존 실행계획 증거와 기존 인덱스 보강을 근거로 "추가 DDL 보류"로 정리한다.
