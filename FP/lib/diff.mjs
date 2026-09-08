/**
 * 산정본 간 변경 비교기.
 * 직전 날짜의 fp-estimate-YYYY-MM-DD.csv와 이번 산정본을 대조해
 * 추가·삭제·수정된 단위프로세스와 UFP 증감을 산출합니다.
 *
 * 비교 키는 `도메인/단위프로세스명`입니다. 같은 기능의 이름을 바꾸면
 * 삭제+추가로 잡히므로, 개명 시에는 CSV의 `변경내용` 열에 사유를 남깁니다.
 */

import { readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { readEstimateCsv } from './csv.mjs';
import { recalcRow } from './fp-rules.mjs';

/** fp-estimate-YYYY-MM-DD.csv 파일명에서 날짜를 뽑는 패턴 */
const CSV_NAME_PATTERN = /^fp-estimate-(\d{4}-\d{2}-\d{2})\.csv$/;

/** 행 비교 키. 도메인과 기능명 조합으로 동일 단위프로세스를 식별합니다. */
function keyOf(row) {
  return `${row.domain}/${row.name}`;
}

/**
 * 기준일보다 이전인 산정본 중 가장 최근 것의 날짜를 찾습니다.
 * 날짜 형식이 YYYY-MM-DD라 문자열 정렬이 곧 시간 정렬입니다.
 * @param {string} fpDir FP 디렉터리 절대경로
 * @param {string} date 기준일 YYYY-MM-DD
 * @returns {string|null} 직전 산정본 날짜. 없으면 null(최초 산정)
 */
export function findPreviousCsv(fpDir, date) {
  if (!existsSync(fpDir)) return null;
  const dates = readdirSync(fpDir)
    .map((name) => name.match(CSV_NAME_PATTERN)?.[1])
    .filter((d) => d && d < date)
    .sort();
  return dates.length > 0 ? dates[dates.length - 1] : null;
}

/** 행에 재계산 복잡도·FP를 붙여 비교 가능한 형태로 만듭니다. */
function withScore(row) {
  const { complexity, fp } = recalcRow(row);
  return { ...row, complexity, fp };
}

/** 두 행 사이에서 실제로 달라진 항목만 골라 사람이 읽을 문구로 만듭니다. */
function fieldDeltas(before, after) {
  const deltas = [];
  // 과거 형식 산정본의 EI 행은 SW기능이 비어 있으므로 양쪽 모두 값이 있을 때만 비교합니다.
  if (before.sw && after.sw && before.sw !== after.sw) deltas.push(`SW기능 ${before.sw}→${after.sw}`);
  if (before.type !== after.type) deltas.push(`유형 ${before.type}→${after.type}`);
  if (before.ret !== after.ret) deltas.push(`RET/FTR ${before.ret}→${after.ret}`);
  if (before.det !== after.det) deltas.push(`DET ${before.det}→${after.det}`);
  if (before.complexity !== after.complexity) {
    deltas.push(`복잡도 ${before.complexity}→${after.complexity}`);
  }
  if (before.fp !== after.fp) deltas.push(`FP ${before.fp}→${after.fp}`);
  return deltas;
}

/** 행 배열의 FP 합계(UFP)를 구합니다. */
function ufpOf(rows) {
  return rows.reduce((sum, r) => sum + r.fp, 0);
}

/**
 * 이번 산정본을 직전 산정본과 대조합니다.
 * @param {Array<object>} currentRows 이번 산정본 행(readEstimateCsv 결과)
 * @param {string} fpDir FP 디렉터리 절대경로
 * @param {string} date 이번 산정일 YYYY-MM-DD
 * @returns {{baseline:string|null, added:Array, removed:Array, changed:Array,
 *            unchanged:number, ufpBefore:number, ufpAfter:number, ufpDelta:number,
 *            undocumented:string[], staleNotes:string[]}}
 *          baseline이 null이면 최초 산정이라 비교 대상이 없다는 뜻입니다.
 *          undocumented는 수치가 바뀌었는데 `변경내용`이 비어 있는 행,
 *          staleNotes는 바뀐 게 없는데 `변경내용`이 적힌 행입니다.
 */
export function diffEstimates(currentRows, fpDir, date) {
  const baseline = findPreviousCsv(fpDir, date);
  const after = currentRows.map(withScore);

  if (!baseline) {
    return {
      baseline: null,
      added: [],
      removed: [],
      changed: [],
      unchanged: 0,
      ufpBefore: 0,
      ufpAfter: ufpOf(after),
      ufpDelta: 0,
      undocumented: [],
      staleNotes: [],
    };
  }

  const before = readEstimateCsv(join(fpDir, `fp-estimate-${baseline}.csv`)).map(withScore);
  const beforeByKey = new Map(before.map((r) => [keyOf(r), r]));
  const afterByKey = new Map(after.map((r) => [keyOf(r), r]));

  const added = after.filter((r) => !beforeByKey.has(keyOf(r)));
  const removed = before.filter((r) => !afterByKey.has(keyOf(r)));

  const changed = [];
  const undocumented = [];
  const staleNotes = [];
  let unchanged = 0;

  for (const row of after) {
    const prev = beforeByKey.get(keyOf(row));
    if (!prev) continue; // 신규 행은 added에서 처리
    const deltas = fieldDeltas(prev, row);
    if (deltas.length === 0) {
      unchanged += 1;
      if (row.change) staleNotes.push(keyOf(row));
      continue;
    }
    changed.push({ ...row, deltas, fpDelta: row.fp - prev.fp });
    if (!row.change) undocumented.push(keyOf(row));
  }

  const ufpBefore = ufpOf(before);
  const ufpAfter = ufpOf(after);

  return {
    baseline,
    added,
    removed,
    changed,
    unchanged,
    ufpBefore,
    ufpAfter,
    ufpDelta: ufpAfter - ufpBefore,
    undocumented,
    staleNotes,
  };
}
