/**
 * 정통법(Detailed FP) 복잡도 매트릭스·점수표·SW기능 분류.
 * 분류 기준 문서(.agents/skills/fp/references/methodology.md)의 표를 코드로 옮긴 것으로,
 * 이 파일이 복잡도 판정과 SW기능↔FP유형 대응의 단일 진실 공급원입니다.
 * 매트릭스를 바꿔야 할 일이 생기면 기준 문서와 이 파일을 함께 고쳐야 합니다.
 */

/** 복잡도 표기. L=Low(단순) · A=Average(보통) · H=High(복잡). 낮은 순서로 정렬되어 있습니다. */
export const COMPLEXITIES = ['L', 'A', 'H'];

/** 복잡도 한글 설명 */
export const COMPLEXITY_LABEL = { L: '단순', A: '보통', H: '복잡' };

/** 복잡도 영문 원어(정통법 용어) */
export const COMPLEXITY_NAME = { L: 'Low', A: 'Average', H: 'High' };

/** SW기능 열이 없던 과거 산정본의 Low/Average/High 표기를 L/A/H로 대응시키는 표 */
const LEGACY_COMPLEXITY = { Low: 'L', Average: 'A', High: 'H' };

/**
 * CSV의 복잡도 표기를 L/A/H로 정규화합니다.
 * 현행 표기(L/A/H)는 그대로, 과거 표기(Low/Average/High)는 대응값을 돌려줍니다.
 * @param {string} value CSV 복잡도 열 값
 * @returns {'L'|'A'|'H'|null} 인식할 수 없는 값이면 null
 */
export function normalizeComplexity(value) {
  if (COMPLEXITIES.includes(value)) return value;
  return LEGACY_COMPLEXITY[value] ?? null;
}

/** FP 유형별 L/A/H 점수표 */
export const FP_SCORES = {
  ILF: { L: 7, A: 10, H: 15 },
  EIF: { L: 5, A: 7, H: 10 },
  EI: { L: 3, A: 4, H: 6 },
  EO: { L: 4, A: 5, H: 7 },
  EQ: { L: 3, A: 4, H: 6 },
};

export const DATA_TYPES = ['ILF', 'EIF'];
export const TX_TYPES = ['EI', 'EO', 'EQ'];
export const ALL_TYPES = [...DATA_TYPES, ...TX_TYPES];

/**
 * SW기능 → FP유형 대응표. 산정 명세의 SW기능 열은 이 키 중 하나여야 하며
 * 같은 행의 FP유형은 대응값과 일치해야 합니다.
 * 등록·수정·삭제=EI, 조회=EQ, 출력=EO, 내부논리파일=ILF, 외부연계파일=EIF.
 * 배열 순서는 리포트 표의 표시 순서입니다.
 */
export const SW_FUNCTION_TYPE = {
  등록: 'EI',
  수정: 'EI',
  삭제: 'EI',
  조회: 'EQ',
  출력: 'EO',
  내부논리파일: 'ILF',
  외부연계파일: 'EIF',
};

export const SW_FUNCTIONS = Object.keys(SW_FUNCTION_TYPE);

/**
 * FP유형만으로 SW기능이 유일하게 정해지는 경우의 값을 돌려줍니다.
 * EI는 등록·수정·삭제 셋 중 하나라 정할 수 없으므로 null입니다.
 * @param {string} type ILF|EIF|EI|EO|EQ
 * @returns {string|null}
 */
export function defaultSwFunction(type) {
  const candidates = SW_FUNCTIONS.filter((f) => SW_FUNCTION_TYPE[f] === type);
  return candidates.length === 1 ? candidates[0] : null;
}

/**
 * 매트릭스 정의: retBands는 RET/FTR 구간, detBands는 DET 구간의 상한선(포함).
 * grid[행][열] = 복잡도. 마지막 구간의 상한은 Infinity.
 */
const DATA_MATRIX = {
  retBands: [1, 5, Infinity], // 1개 / 2~5개 / 6개 이상
  detBands: [19, 50, Infinity], // 1~19 / 20~50 / 51 이상
  grid: [
    ['L', 'L', 'A'],
    ['L', 'A', 'H'],
    ['A', 'H', 'H'],
  ],
};

const EI_MATRIX = {
  retBands: [1, 2, Infinity], // 0~1개 / 2개 / 3개 이상
  detBands: [4, 15, Infinity], // 1~4 / 5~15 / 16 이상
  grid: [
    ['L', 'L', 'A'],
    ['L', 'A', 'H'],
    ['A', 'H', 'H'],
  ],
};

const EO_EQ_MATRIX = {
  retBands: [1, 3, Infinity], // 0~1개 / 2~3개 / 4개 이상
  detBands: [5, 19, Infinity], // 1~5 / 6~19 / 20 이상
  grid: [
    ['L', 'L', 'A'],
    ['L', 'A', 'H'],
    ['A', 'H', 'H'],
  ],
};

/** FP 유형 → 적용 매트릭스 */
const MATRIX_BY_TYPE = {
  ILF: DATA_MATRIX,
  EIF: DATA_MATRIX,
  EI: EI_MATRIX,
  EO: EO_EQ_MATRIX,
  EQ: EO_EQ_MATRIX,
};

/** 값이 속한 구간의 인덱스를 찾습니다. bands는 오름차순 상한선 배열. */
function bandIndex(value, bands) {
  const idx = bands.findIndex((upper) => value <= upper);
  return idx === -1 ? bands.length - 1 : idx;
}

/**
 * RET/FTR과 DET로 복잡도를 판정합니다.
 * @param {string} type ILF|EIF|EI|EO|EQ
 * @param {number} retOrFtr 데이터기능이면 RET, 트랜잭션이면 FTR
 * @param {number} det DET 개수
 * @returns {'L'|'A'|'H'}
 * @throws {Error} 알 수 없는 FP 유형이거나 RET/DET가 숫자가 아닌 경우
 */
export function judgeComplexity(type, retOrFtr, det) {
  const matrix = MATRIX_BY_TYPE[type];
  if (!matrix) throw new Error(`알 수 없는 FP 유형: ${type}`);
  if (!Number.isFinite(retOrFtr) || !Number.isFinite(det)) {
    throw new Error(`RET/FTR·DET는 숫자여야 합니다: ${type} ${retOrFtr}/${det}`);
  }
  const row = bandIndex(retOrFtr, matrix.retBands);
  const col = bandIndex(det, matrix.detBands);
  return matrix.grid[row][col];
}

/**
 * FP 유형과 복잡도로 점수를 구합니다.
 * @throws {Error} 유형·복잡도 조합이 점수표에 없는 경우
 */
export function scoreOf(type, complexity) {
  const score = FP_SCORES[type]?.[complexity];
  if (score === undefined) throw new Error(`점수표에 없는 조합: ${type}/${complexity}`);
  return score;
}

/**
 * CSV 행의 복잡도·점수를 매트릭스로 재계산하고 원본 값과 대조합니다.
 * CSV의 복잡도/점수 열을 신뢰하지 않고 항상 재계산하므로 리포트 수치는 매 실행마다 결정적입니다.
 * @param {{domain:string, name:string, type:string, ret:number, det:number,
 *          csvComplexity:string, csvFp:number}} row 파싱된 CSV 행(csvComplexity는 L/A/H)
 * @returns {{complexity: string, fp: number, mismatch: string|null}}
 *          mismatch는 CSV 값과 재계산 값이 다를 때만 설명 문자열
 */
export function recalcRow(row) {
  const complexity = judgeComplexity(row.type, row.ret, row.det);
  const fp = scoreOf(row.type, complexity);
  const drifted = complexity !== row.csvComplexity || fp !== row.csvFp;
  return {
    complexity,
    fp,
    mismatch: drifted
      ? `${row.domain}/${row.name}: CSV=${row.csvComplexity}(${row.csvFp}) → 재계산=${complexity}(${fp})`
      : null,
  };
}
