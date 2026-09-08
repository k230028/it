/**
 * fp-rules.mjs 회귀 테스트. 실행: node --test FP/tests
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  COMPLEXITIES,
  SW_FUNCTIONS,
  SW_FUNCTION_TYPE,
  defaultSwFunction,
  judgeComplexity,
  normalizeComplexity,
  recalcRow,
  scoreOf,
} from '../lib/fp-rules.mjs';

test('복잡도는 L/A/H 세 값만 쓴다', () => {
  assert.deepEqual(COMPLEXITIES, ['L', 'A', 'H']);
});

test('과거 표기 Low/Average/High는 L/A/H로 정규화되고 그 밖의 값은 null', () => {
  assert.equal(normalizeComplexity('Low'), 'L');
  assert.equal(normalizeComplexity('Average'), 'A');
  assert.equal(normalizeComplexity('High'), 'H');
  assert.equal(normalizeComplexity('H'), 'H');
  assert.equal(normalizeComplexity('high'), null);
  assert.equal(normalizeComplexity(''), null);
});

test('매트릭스 판정과 점수표가 L/A/H 표기로 일치한다', () => {
  assert.equal(judgeComplexity('ILF', 1, 10), 'L');
  assert.equal(judgeComplexity('ILF', 3, 30), 'A');
  assert.equal(judgeComplexity('ILF', 6, 83), 'H');
  assert.equal(judgeComplexity('EI', 2, 10), 'A');
  assert.equal(judgeComplexity('EQ', 4, 3), 'A');
  assert.equal(scoreOf('ILF', 'H'), 15);
  assert.equal(scoreOf('EI', 'L'), 3);
  assert.throws(() => scoreOf('EI', 'High'), /점수표에 없는 조합/);
});

test('SW기능 대응표: 등록·수정·삭제=EI, 조회=EQ, 출력=EO, 내부논리파일=ILF, 외부연계파일=EIF', () => {
  assert.deepEqual(SW_FUNCTIONS, ['등록', '수정', '삭제', '조회', '출력', '내부논리파일', '외부연계파일']);
  assert.equal(SW_FUNCTION_TYPE.등록, 'EI');
  assert.equal(SW_FUNCTION_TYPE.수정, 'EI');
  assert.equal(SW_FUNCTION_TYPE.삭제, 'EI');
  assert.equal(SW_FUNCTION_TYPE.조회, 'EQ');
  assert.equal(SW_FUNCTION_TYPE.출력, 'EO');
  assert.equal(SW_FUNCTION_TYPE.내부논리파일, 'ILF');
  assert.equal(SW_FUNCTION_TYPE.외부연계파일, 'EIF');
});

test('FP유형만으로 정해지는 SW기능은 유도되고 EI는 유도되지 않는다', () => {
  assert.equal(defaultSwFunction('ILF'), '내부논리파일');
  assert.equal(defaultSwFunction('EIF'), '외부연계파일');
  assert.equal(defaultSwFunction('EO'), '출력');
  assert.equal(defaultSwFunction('EQ'), '조회');
  assert.equal(defaultSwFunction('EI'), null);
});

test('recalcRow는 L/A/H 기준으로 CSV 값과 대조한다', () => {
  const ok = recalcRow({ domain: 'd', name: 'n', type: 'EI', ret: 2, det: 10, csvComplexity: 'A', csvFp: 4 });
  assert.equal(ok.mismatch, null);
  const drifted = recalcRow({ domain: 'd', name: 'n', type: 'EI', ret: 2, det: 10, csvComplexity: 'H', csvFp: 6 });
  assert.match(drifted.mismatch, /CSV=H\(6\) → 재계산=A\(4\)/);
});
