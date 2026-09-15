import assert from "node:assert/strict";
import test from "node:test";
import { parseScenarios } from "../scripts/run-scenarios.mjs";

const TABLE = `
| TEST ID | 시나리오명 | 구분 | 점검 포인트 | 예상결과 |
| --- | --- | --- | --- | --- |
| **TC-01** | 요건 1 – A | Vitest | \`tests/unit/a.test.ts\` · \`tests/unit/b.test.ts\` · 검증 | ok |
| **TC-02** | 요건 1 – B | Jacoco | \`src/test/java/.../cost/service/CostQueryAssemblerTest.java\` · 검증 | ok |
| **TC-03** | 요건 2 – C | E2E | \`tests/e2e/flow.spec.ts\` · \`test('목록을 표시한다')\` | ok |
| **TC-04** | 요건 2 – D | 사용자 | 화면에서 조작 | ok |
| TC-05 | 요건 3 – E | 알수없음 | 없음 | ok |
`;

test("시나리오 표에서 구분별 테스트 참조를 뽑는다", () => {
  const rows = parseScenarios(TABLE);
  assert.deepEqual(rows.map((r) => r.id), ["TC-01", "TC-02", "TC-03", "TC-04", "TC-05"]);
  assert.deepEqual(rows[0].vitestFiles, ["tests/unit/a.test.ts", "tests/unit/b.test.ts"]);
  assert.deepEqual(rows[1].junitClasses, ["CostQueryAssemblerTest"]);
  assert.deepEqual(rows[2].e2eFiles, ["tests/e2e/flow.spec.ts"]);
  assert.deepEqual(rows[2].e2eTitles, ["목록을 표시한다"]);
  assert.equal(rows[3].kind, "manual");
  assert.equal(rows[4].kind, "unknown");
});

test("굵게 표시가 없는 TEST ID와 있는 ID를 같게 다룬다", () => {
  const rows = parseScenarios("| TC-09 | x | Vitest | `tests/unit/x.test.ts` | ok |\n| **TC-10** | y | Vitest | 없음 | ok |");
  assert.deepEqual(rows.map((r) => r.id), ["TC-09", "TC-10"]);
  assert.deepEqual(rows[1].vitestFiles, []);
});

test("Playwright JSON을 spec 파일별로 집계하고 flaky는 재시도 통과로 센다", async () => {
  const { parsePlaywrightJson } = await import("../scripts/run-scenarios.mjs");
  const json = {
    suites: [
      {
        title: "a.spec.ts", file: "a.spec.ts", specs: [],
        suites: [{
          title: "그룹", file: "a.spec.ts",
          specs: [
            { title: "통과", file: "a.spec.ts", tests: [{ status: "expected", results: [] }] },
            { title: "재시도 통과", file: "a.spec.ts", tests: [{ status: "flaky", results: [{ error: { message: "Timeout 10000ms" } }, {}] }] },
          ],
        }],
      },
      {
        title: "b.spec.ts", file: "b.spec.ts",
        specs: [{ title: "실패", file: "b.spec.ts", tests: [{ status: "unexpected", results: [{ error: { message: "expect(locator).toBeVisible()\n\nCall log" } }] }] }],
      },
    ],
  };
  const byFile = parsePlaywrightJson(json);
  const a = byFile.get("tests/e2e/a.spec.ts");
  assert.deepEqual({ ...a, titles: undefined }, { status: "passed", total: 2, passed: 2, failed: 0, skipped: 0, retried: 1, failures: [], titles: undefined });
  assert.deepEqual([...a.titles], [["통과", "passed"], ["재시도 통과", "passed"]]);
  const b = byFile.get("tests/e2e/b.spec.ts");
  assert.equal(b.status, "failed");
  assert.deepEqual(b.failures, ["실패: expect(locator).toBeVisible()"]);
  assert.equal(b.titles.get("실패"), "failed");
});
