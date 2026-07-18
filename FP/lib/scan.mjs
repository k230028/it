/**
 * 코드베이스 물리 규모 실측기.
 * 테이블·화면·API 수를 소스에서 직접 계수하여 리포트의 규모 지표를 항상 현행화합니다.
 * 하드코딩된 수치를 리포트에 남기지 않기 위한 모듈입니다.
 *
 * 테이블 수는 DDL 덤프(it_database/ITPOWN_DDL_live.sql)의 CREATE TABLE을 SoT로 삼습니다.
 * JPA @Table만 세면 엔티티 없는 테이블이 누락되므로(기능 철회 후 남은 잔여 테이블 등)
 * 물리 테이블과 엔티티 매핑을 각각 세고 그 차이를 orphans/unmapped로 드러냅니다.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, extname } from 'node:path';

/** 화면 영역 분류 시 "기타"로 묶을 최소 기준(이 값 미만 화면 수를 가진 영역) */
const MINOR_AREA_THRESHOLD = 3;

/** Flyway 관리 테이블 — 업무 테이블이 아니므로 규모 계수에서 제외 */
const NON_BUSINESS_TABLES = new Set(['FLYWAY_SCHEMA_HISTORY']);

/**
 * 디렉터리를 재귀 순회하며 확장자가 일치하는 파일 경로를 수집합니다.
 * 디렉터리가 없으면 빈 배열을 반환합니다(선택적 경로 대응).
 */
function walk(dir, ext) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, ext));
    else if (extname(entry.name) === ext) out.push(full);
  }
  return out;
}

/** 정규식 전역 매칭 건수를 셉니다. */
function countMatches(text, regex) {
  return (text.match(regex) ?? []).length;
}

/**
 * 백엔드 Java 소스에서 엔티티 매핑 테이블·컨트롤러·엔드포인트를 계수합니다.
 *
 * @Table을 언급하기만 하고 엔티티가 아닌 파일(로그 대상 지정 애노테이션, ID 생성기 등)이
 * 섞여 있으므로 @Entity가 함께 선언된 파일만 엔티티로 인정합니다.
 * @param {string} backendSrc it_backend/src/main/java 경로
 */
function scanBackend(backendSrc) {
  const files = walk(backendSrc, '.java');
  const entityTables = new Set();
  let controllers = 0;
  let endpoints = 0;

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    if (/@Entity\b/.test(text)) {
      for (const m of text.matchAll(/@Table\s*\(\s*name\s*=\s*"([A-Za-z0-9_]+)"/g)) {
        entityTables.add(m[1].toUpperCase());
      }
    }
    if (/@(RestController|Controller)\b/.test(text)) controllers += 1;
    endpoints += countMatches(text, /@(Get|Post|Put|Patch|Delete)Mapping\b/g);
  }
  return { entityTables: [...entityTables].sort(), controllers, endpoints };
}

/**
 * DDL 덤프에서 물리 테이블명을 계수합니다. Flyway 관리 테이블은 제외합니다.
 * 덤프 파일이 없으면 빈 배열을 반환하여 호출측이 엔티티 기준으로 폴백하게 합니다.
 * @param {string} ddlPath it_database/ITPOWN_DDL_live.sql 경로
 */
function scanDdlTables(ddlPath) {
  if (!existsSync(ddlPath)) return [];
  const text = readFileSync(ddlPath, 'utf8');
  const names = new Set();
  for (const m of text.matchAll(/CREATE\s+TABLE\s+"?(?:[A-Za-z0-9_]+"?\."?)?([A-Za-z0-9_]+)"?/gi)) {
    const name = m[1].toUpperCase();
    if (!NON_BUSINESS_TABLES.has(name)) names.add(name);
  }
  return [...names].sort();
}

/**
 * 테이블명 접미사로 성격을 분류합니다.
 * 명명 규칙: *M=마스터/상세, *L=변경로그, *I=인터페이스, 그 외(A/D/H)=관계·부가.
 * 변경로그(*L)는 별도 ILF가 아니라 마스터의 RET로 처리하므로 구분이 필요합니다.
 */
function classifyTables(tableNames) {
  const bySuffix = { M: 0, L: 0, I: 0, other: 0 };
  for (const name of tableNames) {
    const suffix = name.slice(-1).toUpperCase();
    if (suffix === 'M') bySuffix.M += 1;
    else if (suffix === 'L') bySuffix.L += 1;
    else if (suffix === 'I') bySuffix.I += 1;
    else bySuffix.other += 1;
  }
  return bySuffix;
}

/**
 * 프론트엔드 페이지를 최상위 라우트 영역별로 집계합니다.
 * 루트 직속 페이지(index.vue, login.vue)와 소규모 영역은 "기타"로 병합합니다.
 */
function scanPages(pagesDir) {
  const files = walk(pagesDir, '.vue');
  const byArea = new Map();

  for (const file of files) {
    const rel = relative(pagesDir, file).replace(/\\/g, '/');
    const area = rel.includes('/') ? rel.split('/')[0] : '기타';
    byArea.set(area, (byArea.get(area) ?? 0) + 1);
  }

  // 화면 수가 적은 영역은 "기타"로 병합하여 표를 읽기 쉽게 유지
  const major = [];
  let minor = 0;
  for (const [area, count] of byArea) {
    if (area !== '기타' && count >= MINOR_AREA_THRESHOLD) major.push({ area, count });
    else minor += count;
  }
  major.sort((a, b) => b.count - a.count);
  if (minor > 0) major.push({ area: '기타', count: minor });

  return { total: files.length, byArea: major };
}

/**
 * 코드베이스 전체 물리 규모를 실측합니다.
 *
 * 테이블은 DDL 덤프(물리 실체)를 우선하고, 덤프가 없으면 엔티티 매핑으로 폴백합니다.
 * orphans(테이블만 존재)·unmapped(엔티티만 존재)는 규모 지표의 근거를 검증 가능하게
 * 남기기 위한 진단 정보입니다.
 * @param {{backendSrc:string, ddlPath:string, pagesDir:string,
 *          componentsDir:string, composablesDir:string}} paths
 * @returns {{tables:{total:number, bySuffix:object, names:string[], source:'ddl'|'entity',
 *           entityMapped:number, orphans:string[], unmapped:string[]}, controllers:number,
 *           endpoints:number, pages:{total:number, byArea:Array<{area:string,count:number}>},
 *           components:number, composables:number}}
 * @throws {Error} 백엔드 소스에서 @Entity 매핑 테이블을 하나도 찾지 못한 경우(경로 오설정 조기 발견)
 */
export function scanCodebase(paths) {
  const { entityTables, controllers, endpoints } = scanBackend(paths.backendSrc);
  if (entityTables.length === 0) {
    throw new Error(`${paths.backendSrc}에서 @Entity 매핑 테이블을 찾지 못했습니다. 경로를 확인하세요.`);
  }

  const ddlTables = scanDdlTables(paths.ddlPath);
  const usingDdl = ddlTables.length > 0;
  const names = usingDdl ? ddlTables : entityTables;

  return {
    tables: {
      total: names.length,
      bySuffix: classifyTables(names),
      names,
      source: usingDdl ? 'ddl' : 'entity',
      entityMapped: entityTables.length,
      orphans: usingDdl ? ddlTables.filter((t) => !entityTables.includes(t)) : [],
      unmapped: usingDdl ? entityTables.filter((t) => !ddlTables.includes(t)) : [],
    },
    controllers,
    endpoints,
    pages: scanPages(paths.pagesDir),
    components: walk(paths.componentsDir, '.vue').length,
    composables: walk(paths.composablesDir, '.ts').length,
  };
}
