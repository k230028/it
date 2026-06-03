# 컬럼명 정합 — 도메인별 런북

대상 도메인의 엔티티 그룹(마스터 + `*L` 미러 + `@IdClass`)에 다음을 순서대로 수행한다.

## 1) 타깃맵 산출
    python targetmap.py <엔티티.java> overrides.json
각 엔티티의 `현재필드 -> 목표필드`를 확보한다. 옛 토큰 목록(현재필드들)을 메모한다.

## 2) 코드모드 적용 (컴파일 주도)
- 엔티티/`*L`/`@IdClass`/DTO 필드 **선언**을 목표명으로 리네임.
  (`*Nm` 파생 표시필드는 예외 — 도메인명 유지, 이중접미사만 단일 Nm으로 정리)
- `./gradlew compileJava` → 컴파일 에러가 가리키는 게터(`getOld`)·빌더(`.old(`)·
  QueryDSL(`Q*.old`) 참조를 목표명으로 수정. green 될 때까지 반복.
- **주의:** native `@Query`는 컬럼명이라 변경 금지. 다른 엔티티의 동명 필드는 건드리지 않음.

## 3) 런타임 스캔
    python scan_runtime_refs.py "<옛토큰,쉼표>" -- "../../it_backend/src/main/java/**/*.java" "../../it_backend/src/test/java/**/*.java"
잔존 0이어야 함. 잡힌 파생쿼리/JPQL/Sort는 목표명으로 수정.
(파생쿼리 메서드명 변경 시 호출부·테스트 목도 함께 정합)

## 4) 테스트 정합
    ./gradlew compileTestJava
목 메서드명·게터를 목표명으로 정합. green 확인.

## 5) 게이트 일괄 검증
    tools/colname-align/verify_domain.sh "<옛토큰,쉼표>"
`== ALL GREEN ==` 확인(compile/scan/boot/typecheck).

## 6) 프론트 락스텝
해당 도메인 API 소비 타입(읽기/쓰기 payload/표시 `*Nm`) 정합 → `npm run typecheck`.
타 도메인 동명 필드는 건드리지 않음.

## 7) 원자적 커밋
    git commit -m "refactor(<domain>): 변수명 컬럼명 정합 (<old->new 요약>)"
백엔드+프론트 한 커밋. 메시지에 변경 필드 맵 기록.
