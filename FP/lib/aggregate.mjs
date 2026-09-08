/**
 * FP 집계기.
 * CSV 행을 유형별·복잡도별·업무영역별로 합산하고 UFP를 산출합니다.
 * 복잡도/점수는 CSV 값을 쓰지 않고 매트릭스로 재계산하므로 매 실행 결과가 결정적입니다.
 */

import {
  recalcRow,
  DATA_TYPES,
  TX_TYPES,
  ALL_TYPES,
  COMPLEXITIES,
  SW_FUNCTIONS,
  SW_FUNCTION_TYPE,
} from './fp-rules.mjs';

/** SW기능이 비어 있는 행(과거 형식 EI)을 묶는 표시용 키 */
export const SW_UNSPECIFIED = '미기재';

/**
 * 업무 영역 그룹 정의. match는 CSV의 도메인 문자열을 받아 해당 그룹인지 판정하며,
 * 배열 순서대로 먼저 일치하는 그룹에 귀속됩니다(마지막은 fallback).
 */
const GROUPS = [
  {
    key: '예산관리',
    desc: '사업·전산관리비 CRUD, 예산현황·편성률 집계, IT부문 비교',
    match: (d) => d.startsWith('budget'),
  },
  {
    key: '협의회',
    desc: '타당성검토·평가위원·일정·평가의견·결과서·Q&A',
    match: (d) => d.startsWith('council'),
  },
  {
    key: '집행 4단계',
    desc: '산정 · 심의 · 계약 · 지급',
    match: (d) => ['estimate', 'deliberation', 'contract', 'payment'].includes(d),
  },
  // 위 그룹에 걸리지 않는 나머지(common/*, iam, board, code, menu, infra/* 등)
  {
    key: '공통·인프라',
    desc: '시스템관리·결재·게시판·코드·인증·메뉴·알림·파일·AI',
    match: () => true,
  },
];

/** 도메인 문자열이 속한 그룹 키를 반환합니다. */
function groupOf(domain) {
  return GROUPS.find((g) => g.match(domain)).key;
}

/** 건수·FP·복잡도(L/A/H) 분포가 모두 0인 슬롯을 만듭니다. */
function emptyStats() {
  const stats = { count: 0, fp: 0 };
  for (const c of COMPLEXITIES) stats[c] = 0;
  return stats;
}

/** 유형별 빈 집계 슬롯을 만듭니다. */
function emptyTypeStats() {
  const stats = {};
  for (const type of ALL_TYPES) stats[type] = emptyStats();
  return stats;
}

/** 유형별 개수·복잡도 분포·FP를 합산합니다. */
function tallyByType(rows) {
  const byType = emptyTypeStats();
  for (const row of rows) {
    const slot = byType[row.type];
    slot.count += 1;
    slot.fp += row.fp;
    slot[row.complexity] += 1;
  }
  return byType;
}

/** 업무 영역 그룹별로 데이터/트랜잭션 건수와 FP를 합산합니다. */
function tallyByGroup(rows) {
  const map = new Map(
    GROUPS.map((g) => [g.key, { key: g.key, desc: g.desc, data: 0, tx: 0, count: 0, fp: 0 }]),
  );
  for (const row of rows) {
    const slot = map.get(groupOf(row.domain));
    slot.count += 1;
    slot.fp += row.fp;
    if (DATA_TYPES.includes(row.type)) slot.data += 1;
    else slot.tx += 1;
  }
  return [...map.values()].filter((g) => g.count > 0).sort((a, b) => b.fp - a.fp);
}

/**
 * SW기능(등록·수정·삭제·조회·출력·내부논리파일·외부연계파일)별 건수·FP를 합산합니다.
 * 표시 순서는 SW_FUNCTIONS 순이며, SW기능이 비어 있는 과거 형식 행은 마지막 '미기재'로 묶습니다.
 * @returns {Array<{sw:string, type:string, count:number, fp:number}>} 건수가 0인 SW기능은 제외
 */
function tallyBySwFunction(rows) {
  const map = new Map(SW_FUNCTIONS.map((sw) => [sw, { sw, type: SW_FUNCTION_TYPE[sw], count: 0, fp: 0 }]));
  map.set(SW_UNSPECIFIED, { sw: SW_UNSPECIFIED, type: 'EI', count: 0, fp: 0 });
  for (const row of rows) {
    const slot = map.get(row.sw || SW_UNSPECIFIED);
    slot.count += 1;
    slot.fp += row.fp;
  }
  return [...map.values()].filter((s) => s.count > 0);
}

/** 주어진 유형 목록의 합계(건수·FP·복잡도 분포)를 구합니다. */
function subtotal(byType, types) {
  const sum = emptyStats();
  for (const type of types) {
    sum.count += byType[type].count;
    sum.fp += byType[type].fp;
    for (const c of COMPLEXITIES) sum[c] += byType[type][c];
  }
  return sum;
}

/**
 * 파싱된 CSV 행을 집계하여 리포트 렌더링에 필요한 모든 수치를 산출합니다.
 * @param {Array<object>} csvRows readEstimateCsv 결과
 * @returns {{rows:Array, byType:object, dataTotal:object, txTotal:object,
 *           ufp:number, byGroup:Array, bySwFunction:Array, mismatches:string[]}}
 *          byType·dataTotal·txTotal의 복잡도 분포 키는 L/A/H이고,
 *          mismatches는 CSV 값과 매트릭스 재계산 값이 어긋난 행의 설명 목록
 */
export function aggregate(csvRows) {
  const mismatches = [];
  const rows = csvRows.map((row) => {
    const { complexity, fp, mismatch } = recalcRow(row);
    if (mismatch) mismatches.push(mismatch);
    return { ...row, complexity, fp };
  });

  const byType = tallyByType(rows);
  const dataTotal = subtotal(byType, DATA_TYPES);
  const txTotal = subtotal(byType, TX_TYPES);

  return {
    rows,
    byType,
    dataTotal,
    txTotal,
    ufp: dataTotal.fp + txTotal.fp,
    byGroup: tallyByGroup(rows),
    bySwFunction: tallyBySwFunction(rows),
    mismatches,
  };
}
