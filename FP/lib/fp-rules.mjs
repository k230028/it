/**
 * 정통법(Detailed FP) 복잡도 매트릭스 및 점수표.
 * FP.md Step 2·3의 표를 코드로 옮긴 것으로, 이 파일이 복잡도 판정의 단일 진실 공급원입니다.
 * 매트릭스를 바꿔야 할 일이 생기면 FP.md와 이 파일을 함께 고쳐야 합니다.
 */

/** FP 유형별 Low/Average/High 점수표 (FP.md Step 2·3) */
export const FP_SCORES = {
  ILF: { Low: 7, Average: 10, High: 15 },
  EIF: { Low: 5, Average: 7, High: 10 },
  EI: { Low: 3, Average: 4, High: 6 },
  EO: { Low: 4, Average: 5, High: 7 },
  EQ: { Low: 3, Average: 4, High: 6 },
};

export const DATA_TYPES = ['ILF', 'EIF'];
export const TX_TYPES = ['EI', 'EO', 'EQ'];
export const ALL_TYPES = [...DATA_TYPES, ...TX_TYPES];
export const COMPLEXITIES = ['Low', 'Average', 'High'];

/**
 * 매트릭스 정의: retBands는 RET/FTR 구간, detBands는 DET 구간의 상한선(포함).
 * grid[행][열] = 복잡도. 마지막 구간의 상한은 Infinity.
 */
const DATA_MATRIX = {
  retBands: [1, 5, Infinity], // 1개 / 2~5개 / 6개 이상
  detBands: [19, 50, Infinity], // 1~19 / 20~50 / 51 이상
  grid: [
    ['Low', 'Low', 'Average'],
    ['Low', 'Average', 'High'],
    ['Average', 'High', 'High'],
  ],
};

const EI_MATRIX = {
  retBands: [1, 2, Infinity], // 0~1개 / 2개 / 3개 이상
  detBands: [4, 15, Infinity], // 1~4 / 5~15 / 16 이상
  grid: [
    ['Low', 'Low', 'Average'],
    ['Low', 'Average', 'High'],
    ['Average', 'High', 'High'],
  ],
};

const EO_EQ_MATRIX = {
  retBands: [1, 3, Infinity], // 0~1개 / 2~3개 / 4개 이상
  detBands: [5, 19, Infinity], // 1~5 / 6~19 / 20 이상
  grid: [
    ['Low', 'Low', 'Average'],
    ['Low', 'Average', 'High'],
    ['Average', 'High', 'High'],
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
 * @returns {'Low'|'Average'|'High'}
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
 *          csvComplexity:string, csvFp:number}} row 파싱된 CSV 행
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
