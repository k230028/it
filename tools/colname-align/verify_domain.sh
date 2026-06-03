#!/usr/bin/env bash
# 사용: verify_domain.sh "prjMngNo,prjSno,..." (도메인 옛 토큰 쉼표구분)
set -uo pipefail
TOKENS="${1:?옛 토큰 목록(쉼표구분) 필요}"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT/it_backend"

echo "== 1) compileJava =="
./gradlew compileJava -q || { echo "FAIL: compileJava"; exit 1; }

echo "== 2) compileTestJava =="
./gradlew compileTestJava -q || { echo "FAIL: compileTestJava"; exit 1; }

echo "== 3) 런타임 참조 스캔 (잔존 0 이어야 함) =="
python "$ROOT/tools/colname-align/scan_runtime_refs.py" "$TOKENS" -- \
  "src/main/java/**/*.java" "src/test/java/**/*.java" \
  && echo "스캔: 잔존 없음" || { echo "FAIL: 런타임 참조 잔존"; exit 1; }

echo "== 4) bootRun 실기동 검증 (최대 150초) =="
timeout 150 ./gradlew bootRun > /tmp/cna_boot.log 2>&1 &
for i in $(seq 1 30); do
  sleep 5
  grep -qE "Started ItApplication" /tmp/cna_boot.log && { echo "BOOT_OK"; break; }
  grep -qE "APPLICATION FAILED TO START|PropertyReferenceException|No property" /tmp/cna_boot.log && { echo "FAIL: 부팅 오류"; break; }
done
pkill -f "bootRun" 2>/dev/null; pkill -f "ItApplication" 2>/dev/null
grep -qE "Started ItApplication" /tmp/cna_boot.log || { echo "FAIL: 부팅 미확인"; exit 1; }

echo "== 5) 프론트 typecheck =="
cd "$ROOT/it_frontend" && npm run typecheck 2>&1 | grep -vE "server/(sso-auth-redirect|color-scheme)" | grep -E "error TS" \
  && { echo "FAIL: 프론트 신규 타입에러"; exit 1; } || echo "typecheck: 신규 에러 없음"

echo "== ALL GREEN =="
