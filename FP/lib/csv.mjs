/**
 * fp-estimate.csv 파서.
 * 산정 명세 CSV를 읽어 검증된 행 객체 배열로 변환합니다.
 */

import { readFileSync } from 'node:fs';
import { ALL_TYPES, COMPLEXITIES } from './fp-rules.mjs';

/** CSV 열 순서 (헤더 검증에 사용) */
const EXPECTED_HEADER = [
  '세부업무(도메인)',
  '단위프로세스명(기능)',
  '기능설명',
  'FP유형',
  'RET/FTR',
  'DET',
  '복잡도',
  'FP점수',
  '변경내용',
];

const COLUMN_COUNT = EXPECTED_HEADER.length;

/**
 * CSV 한 줄을 필드 배열로 분리합니다.
 * 이 CSV는 따옴표 인용을 쓰지 않으므로 단순 split이지만,
 * 향후 인용 필드가 유입되면 조용히 깨지므로 호출측에서 열 개수로 검증합니다.
 */
function splitLine(line) {
  return line.split(',').map((field) => field.trim());
}

/** 헤더가 기대한 스키마와 일치하는지 검증합니다. */
function assertHeader(fields, csvPath) {
  const actual = fields.join(',');
  const expected = EXPECTED_HEADER.join(',');
  if (actual !== expected) {
    throw new Error(`${csvPath} 헤더가 기대와 다릅니다.\n  기대: ${expected}\n  실제: ${actual}`);
  }
}

/** 데이터 행 하나를 객체로 변환하고 값 범위를 검증합니다. */
function parseRow(fields, lineNo, csvPath) {
  const [domain, name, desc, type, ret, det, complexity, fp, change] = fields;

  if (!ALL_TYPES.includes(type)) {
    throw new Error(`${csvPath}:${lineNo} 알 수 없는 FP유형 "${type}" (허용: ${ALL_TYPES.join(', ')})`);
  }
  if (!COMPLEXITIES.includes(complexity)) {
    throw new Error(`${csvPath}:${lineNo} 알 수 없는 복잡도 "${complexity}"`);
  }

  const parsed = {
    domain,
    name,
    desc,
    type,
    ret: Number(ret),
    det: Number(det),
    csvComplexity: complexity,
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
 * 산정 명세 CSV를 읽어 행 배열을 반환합니다.
 * @param {string} csvPath fp-estimate.csv 절대경로
 * @returns {Array<{domain:string, name:string, desc:string, type:string,
 *                  ret:number, det:number, csvComplexity:string, csvFp:number, change:string}>}
 * @throws {Error} 파일 없음, 헤더 불일치, 열 개수 불일치, 값 검증 실패 시
 */
export function readEstimateCsv(csvPath) {
  const raw = readFileSync(csvPath, 'utf8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim() !== '');
  if (lines.length < 2) throw new Error(`${csvPath}에 데이터 행이 없습니다.`);

  assertHeader(splitLine(lines[0]), csvPath);

  return lines.slice(1).map((line, idx) => {
    const lineNo = idx + 2; // 헤더 1줄 + 0-based 보정
    const fields = splitLine(line);
    if (fields.length !== COLUMN_COUNT) {
      throw new Error(
        `${csvPath}:${lineNo} 열 개수가 ${COLUMN_COUNT}이 아닙니다(${fields.length}). ` +
          `필드에 쉼표가 포함되었는지 확인하세요: "${line}"`,
      );
    }
    return parseRow(fields, lineNo, csvPath);
  });
}
