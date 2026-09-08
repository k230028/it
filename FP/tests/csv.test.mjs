/**
 * csv.mjs 회귀 테스트. 현행 헤더(SW기능 포함)와 과거 헤더를 모두 다룬다. 실행: node --test FP/tests
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CSV_HEADER, readEstimateCsv } from '../lib/csv.mjs';
import { aggregate, SW_UNSPECIFIED } from '../lib/aggregate.mjs';

const dir = mkdtempSync(join(tmpdir(), 'fp-csv-'));
let seq = 0;

/** 헤더와 행을 임시 CSV로 저장하고 경로를 돌려줍니다. */
function csvFile(header, rows) {
  const path = join(dir, `fp-estimate-${++seq}.csv`);
  writeFileSync(path, [header.join(','), ...rows].join('\n'), 'utf8');
  return path;
}

const LEGACY_HEADER = CSV_HEADER.filter((c) => c !== 'SW기능');

test('현행 헤더에는 SW기능 열이 FP유형 앞에 있다', () => {
  assert.deepEqual(CSV_HEADER, [
    '세부업무(도메인)',
    '단위프로세스명(기능)',
    '기능설명',
    'SW기능',
    'FP유형',
    'RET/FTR',
    'DET',
    '복잡도',
    'FP점수',
    '변경내용',
  ]);
});

test('현행 형식: SW기능과 L/A/H 복잡도를 읽는다', () => {
  const rows = readEstimateCsv(
    csvFile(CSV_HEADER, [
      'budget,정보화사업,Bprojm,내부논리파일,ILF,6,83,H,15,',
      'budget,정보화사업 등록,POST,등록,EI,2,20,H,6,최초 산정',
      'budget,정보화사업 목록,GET,조회,EQ,1,10,L,3,',
      'budget,예산현황,집계,출력,EO,3,25,H,7,',
      'system,사용자,eHR,외부연계파일,EIF,1,10,L,5,',
    ]),
  );
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((r) => [r.sw, r.type, r.csvComplexity]),
    [
      ['내부논리파일', 'ILF', 'H'],
      ['등록', 'EI', 'H'],
      ['조회', 'EQ', 'L'],
      ['출력', 'EO', 'H'],
      ['외부연계파일', 'EIF', 'L'],
    ],
  );
  assert.equal(rows[1].change, '최초 산정');
});

test('현행 형식: SW기능이 비면 실패한다', () => {
  assert.throws(
    () => readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 등록,POST,,EI,2,20,H,6,'])),
    /SW기능이 비어 있습니다/,
  );
});

test('현행 형식: SW기능과 FP유형의 대응이 어긋나면 실패한다', () => {
  assert.throws(
    () => readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 목록,GET,조회,EI,1,10,L,3,'])),
    /SW기능 "조회"는 FP유형 EQ에 대응하는데 행의 FP유형은 EI/,
  );
  assert.throws(
    () => readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 목록,GET,검색,EQ,1,10,L,3,'])),
    /알 수 없는 SW기능 "검색"/,
  );
});

test('현행 형식: 과거 복잡도 표기도 L/A/H로 정규화되고 그 밖의 값은 실패한다', () => {
  const rows = readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 목록,GET,조회,EQ,1,10,Low,3,']));
  assert.equal(rows[0].csvComplexity, 'L');
  assert.throws(
    () => readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 목록,GET,조회,EQ,1,10,중,3,'])),
    /알 수 없는 복잡도 "중" \(허용: L, A, H\)/,
  );
});

test('과거 형식: SW기능 없는 9열 헤더를 읽고 EI 외에는 SW기능을 유도한다', () => {
  const rows = readEstimateCsv(
    csvFile(LEGACY_HEADER, [
      'budget,정보화사업,Bprojm,ILF,6,83,High,15,',
      'budget,정보화사업 등록,POST,EI,2,20,High,6,',
      'budget,정보화사업 목록,GET,EQ,1,10,Low,3,',
    ]),
  );
  assert.deepEqual(
    rows.map((r) => [r.sw, r.type, r.csvComplexity]),
    [
      ['내부논리파일', 'ILF', 'H'],
      ['', 'EI', 'H'],
      ['조회', 'EQ', 'L'],
    ],
  );
  const agg = aggregate(rows);
  assert.equal(agg.mismatches.length, 0);
  assert.deepEqual(
    agg.bySwFunction.map((s) => [s.sw, s.count, s.fp]),
    [
      ['조회', 1, 3],
      ['내부논리파일', 1, 15],
      [SW_UNSPECIFIED, 1, 6],
    ],
  );
  assert.equal(agg.byType.ILF.H, 1);
});

test('열 개수가 헤더와 다르면 실패한다', () => {
  assert.throws(
    () => readEstimateCsv(csvFile(CSV_HEADER, ['budget,정보화사업 목록,GET,조회,EQ,1,10,L,3'])),
    /열 개수가 10이 아닙니다\(9\)/,
  );
});
