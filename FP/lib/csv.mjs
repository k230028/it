/**
 * fp-estimate.csv 파서.
 * 산정 명세 CSV를 읽어 검증된 행 객체 배열로 변환합니다.
 */

import { readFileSync } from 'node:fs';
import {
  ALL_TYPES,
  COMPLEXITIES,
  SW_FUNCTIONS,
  SW_FUNCTION_TYPE,
  defaultSwFunction,
  normalizeComplexity,
} from './fp-rules.mjs';

/** 현행 CSV 열 순서. 새 산정본은 반드시 이 헤더로 작성합니다. */
export const CSV_HEADER = [
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
];

/**
 * SW기능 열이 없던 과거 산정본 헤더. 직전 산정본 비교·추이 계산을 위해 읽기만 지원하며,
 * 이 형식의 EI 행은 등록·수정·삭제를 알 수 없어 SW기능이 빈 값(미기재)으로 남습니다.
 */
const LEGACY_HEADER = CSV_HEADER.filter((col) => col !== 'SW기능');

/** SW기능 열의 위치. 과거 형식 행을 현행 형식으로 맞출 때 삽입 지점으로 씁니다. */
const SW_INDEX = CSV_HEADER.indexOf('SW기능');

/**
 * CSV 한 줄을 필드 배열로 분리합니다.
 * 이 CSV는 따옴표 인용을 쓰지 않으므로 단순 split이지만,
 * 향후 인용 필드가 유입되면 조용히 깨지므로 호출측에서 열 개수로 검증합니다.
 */
function splitLine(line) {
  return line.split(',').map((field) => field.trim());
}

/**
 * 헤더가 현행 또는 과거 스키마와 일치하는지 검증하고 어느 형식인지 돌려줍니다.
 * @returns {'current'|'legacy'}
 * @throws {Error} 둘 다 아닌 경우
 */
function detectHeader(fields, csvPath) {
  const actual = fields.join(',');
  if (actual === CSV_HEADER.join(',')) return 'current';
  if (actual === LEGACY_HEADER.join(',')) return 'legacy';
  throw new Error(
    `${csvPath} 헤더가 기대와 다릅니다.\n  기대: ${CSV_HEADER.join(',')}\n  실제: ${actual}`,
  );
}

/**
 * SW기능 열을 검증합니다. 현행 형식은 값이 필수이고, 과거 형식은 FP유형에서 유도되지 않는
 * EI 행에 한해 빈 값을 허용합니다. 값이 있으면 FP유형과의 대응이 맞아야 합니다.
 */
function assertSwFunction(sw, type, legacy, lineNo, csvPath) {
  if (sw === '') {
    if (legacy) return;
    throw new Error(`${csvPath}:${lineNo} SW기능이 비어 있습니다 (허용: ${SW_FUNCTIONS.join(', ')})`);
  }
  if (!SW_FUNCTIONS.includes(sw)) {
    throw new Error(`${csvPath}:${lineNo} 알 수 없는 SW기능 "${sw}" (허용: ${SW_FUNCTIONS.join(', ')})`);
  }
  if (SW_FUNCTION_TYPE[sw] !== type) {
    const allowed = SW_FUNCTIONS.filter((f) => SW_FUNCTION_TYPE[f] === type).join('·');
    throw new Error(
      `${csvPath}:${lineNo} SW기능 "${sw}"는 FP유형 ${SW_FUNCTION_TYPE[sw]}에 대응하는데 행의 FP유형은 ${type}입니다 ` +
        `(${type}에 허용되는 SW기능: ${allowed})`,
    );
  }
}

/** 데이터 행 하나를 객체로 변환하고 값 범위를 검증합니다. fields는 현행 열 순서여야 합니다. */
function parseRow(fields, lineNo, csvPath, legacy) {
  const [domain, name, desc, sw, type, ret, det, complexity, fp, change] = fields;

  if (!ALL_TYPES.includes(type)) {
    throw new Error(`${csvPath}:${lineNo} 알 수 없는 FP유형 "${type}" (허용: ${ALL_TYPES.join(', ')})`);
  }
  assertSwFunction(sw, type, legacy, lineNo, csvPath);

  const normalizedComplexity = normalizeComplexity(complexity);
  if (!normalizedComplexity) {
    throw new Error(`${csvPath}:${lineNo} 알 수 없는 복잡도 "${complexity}" (허용: ${COMPLEXITIES.join(', ')})`);
  }

  const parsed = {
    domain,
    name,
    desc,
    // 등록·수정·삭제·조회·출력·내부논리파일·외부연계파일. 과거 형식의 EI 행만 빈 값(미기재).
    sw,
    type,
    ret: Number(ret),
    det: Number(det),
    csvComplexity: normalizedComplexity,
    csvFp: Number(fp),
    // 직전 산정본 대비 변경 사유(자유 기술). 빈 값은 "변동 없음"을 뜻합니다.
    change,
  };

  for (const key of ['ret', 'det', 'csvFp']) {
    if (!Number.isFinite(parsed[key]) || parsed[key] < 0) {
      throw new Error(`${csvPath}:${lineNo} ${key} 값이 올바른 숫자가 아닙니다: "${fields.join(',')}"`);
    }
  }
  return parsed;
}

/**
 * 과거 형식 행에 SW기능 열을 끼워 넣어 현행 열 순서로 맞춥니다.
 * FP유형만으로 정해지는 값(조회·출력·내부논리파일·외부연계파일)은 채우고 EI는 빈 값으로 둡니다.
 */
function upgradeLegacyFields(fields) {
  const type = fields[SW_INDEX]; // 과거 형식에서는 이 자리가 FP유형
  const upgraded = [...fields];
  upgraded.splice(SW_INDEX, 0, defaultSwFunction(type) ?? '');
  return upgraded;
}

/**
 * 산정 명세 CSV를 읽어 행 배열을 반환합니다.
 * 복잡도는 CSV 표기(L/A/H 또는 과거의 Low/Average/High)와 무관하게 L/A/H로 정규화됩니다.
 * @param {string} csvPath fp-estimate.csv 절대경로
 * @returns {Array<{domain:string, name:string, desc:string, sw:string, type:string,
 *                  ret:number, det:number, csvComplexity:string, csvFp:number, change:string}>}
 * @throws {Error} 파일 없음, 헤더 불일치, 열 개수 불일치, 값 검증 실패,
 *                 SW기능 누락 또는 FP유형과의 대응 불일치 시
 */
export function readEstimateCsv(csvPath) {
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error(`${csvPath}에 데이터 행이 없습니다.`);

  const legacy = detectHeader(splitLine(lines[0]), csvPath) === 'legacy';
  const columnCount = legacy ? LEGACY_HEADER.length : CSV_HEADER.length;

  return lines.slice(1).map((line, idx) => {
    const lineNo = idx + 2; // 헤더 1줄 + 0-based 보정
    const fields = splitLine(line);
    if (fields.length !== columnCount) {
      throw new Error(
        `${csvPath}:${lineNo} 열 개수가 ${columnCount}이 아닙니다(${fields.length}). ` +
          `필드에 쉼표가 포함되었는지 확인하세요: "${line}"`,
      );
    }
    return parseRow(legacy ? upgradeLegacyFields(fields) : fields, lineNo, csvPath, legacy);
  });
}
