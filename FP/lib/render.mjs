/**
 * 리포트 HTML 렌더러.
 * 집계 결과와 실측 규모를 받아 완성된 HTML 문서 문자열을 반환합니다.
 * 이 파일이 리포트 레이아웃의 단일 진실 공급원이며, 매 실행마다 동일한 형태를 보장합니다.
 */

import { COMPLEXITIES } from './fp-rules.mjs';

/** 리포트 본문에 노출할 FP 유형 한글 표기 */
const TYPE_LABEL = {
  ILF: '내부논리파일',
  EIF: '외부인터페이스파일',
  EI: '외부입력',
  EO: '외부출력',
  EQ: '외부조회',
};

/** 테이블 접미사 분류 설명 (scan.mjs classifyTables의 키와 대응) */
const SUFFIX_ROWS = [
  { key: 'M', label: '마스터·상세', token: '*M', note: '논리파일 본체' },
  { key: 'L', label: '변경로그', token: '*L', note: '마스터의 RET(+1)' },
  { key: 'I', label: '인터페이스', token: '*I', note: 'EIF / 역할매핑 ILF' },
  { key: 'other', label: '관계·부가', token: '*A/D/H', note: '논리파일 병합/RET' },
];

/** HTML 특수문자를 이스케이프합니다. */
const esc = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c],
  );

/** 천단위 구분 숫자 */
const num = (n) => n.toLocaleString('ko-KR');

/** 분모가 0이어도 안전한 백분율 */
const pct = (part, total) => (total === 0 ? 0 : (part / total) * 100);
const pct1 = (part, total) => pct(part, total).toFixed(1);

/** 억/백만원 단위 표기 */
const won = (v) => `약 ${(v / 1_000_000).toFixed(1)} 백만원`;

/** 복잡도 분포 스택 막대 */
function complexityBar(stats) {
  const total = COMPLEXITIES.reduce((sum, c) => sum + stats[c], 0);
  if (total === 0) return '<div class="bar"></div>';
  const seg = (cls, c) =>
    stats[c] > 0 ? `<i class="${cls}" style="width:${pct(stats[c], total)}%"></i>` : '';
  return `<div class="bar">${seg('l', 'Low')}${seg('a', 'Average')}${seg('h', 'High')}</div>`;
}

/** 유형 1행 (데이터/트랜잭션 공통) */
function typeRow(type, stats) {
  const dash = (n) => (n === 0 ? '–' : num(n));
  return `        <tr>
          <td><span class="type ${type.toLowerCase()}">${type}</span> <span class="muted">${TYPE_LABEL[type]}</span></td>
          <td class="n">${num(stats.count)}</td>
          <td class="n">${dash(stats.Low)}</td><td class="n">${dash(stats.Average)}</td><td class="n">${dash(stats.High)}</td>
          <td>${complexityBar(stats)}</td>
          <td class="n"><b>${num(stats.fp)}</b></td>
        </tr>`;
}

/** 소계 행 */
function subtotalRow(label, s) {
  return `        <tr class="total">
          <td>${esc(label)}</td><td class="n">${num(s.count)}</td>
          <td class="n">${num(s.Low)}</td><td class="n">${num(s.Average)}</td><td class="n">${num(s.High)}</td>
          <td></td><td class="n">${num(s.fp)}</td>
        </tr>`;
}

/** 유형별 표 (데이터기능 / 트랜잭션기능 공통 골격) */
function typeTable(unitHeader, types, byType, total, subtotalLabel) {
  return `    <div class="tw">
    <table>
      <thead>
        <tr>
          <th>유형</th><th class="n">${esc(unitHeader)}</th>
          <th class="n">Low</th><th class="n">Average</th><th class="n">High</th>
          <th style="width:150px">복잡도 분포</th><th class="n">FP</th>
        </tr>
      </thead>
      <tbody>
${types.map((t) => typeRow(t, byType[t])).join('\n')}
${subtotalRow(subtotalLabel, total)}
      </tbody>
    </table>
    </div>`;
}

/**
 * 물리 테이블과 엔티티 매핑 수의 차이 주석.
 * 차이가 없으면 아무것도 렌더링하지 않습니다.
 */
function orphanTableNote(tables) {
  const blocks = [];
  if (tables.orphans.length > 0) {
    blocks.push(`<b>엔티티 없는 테이블 ${num(tables.orphans.length)}건</b> —
      물리 ${num(tables.total)}개 중 JPA 엔티티가 매핑된 것은 ${num(tables.entityMapped)}개입니다.
      아래 테이블은 DB에만 남아 있어 트랜잭션 기능이 없으므로 논리파일로 계상하지 않았습니다:
      <span class="type">${tables.orphans.map(esc).join('</span> · <span class="type">')}</span>`);
  }
  if (tables.unmapped.length > 0) {
    blocks.push(`<b>DDL 덤프에 없는 엔티티 ${num(tables.unmapped.length)}건</b> —
      덤프가 최신이 아닐 수 있습니다:
      <span class="type">${tables.unmapped.map(esc).join('</span> · <span class="type">')}</span>`);
  }
  if (blocks.length === 0) return '';
  return `        <div class="note">${blocks.join('<br><br>')}</div>`;
}

/** 물리 테이블 분류 표 */
function tableScaleTable(tables, logicalFiles) {
  const rows = SUFFIX_ROWS.filter((r) => tables.bySuffix[r.key] > 0)
    .map(
      (r) => `            <tr><td>${esc(r.label)} (<span class="type">${esc(r.token)}</span>)</td>
              <td class="n">${num(tables.bySuffix[r.key])}</td><td class="desc">${esc(r.note)}</td></tr>`,
    )
    .join('\n');
  return `        <div class="tw">
        <table>
          <thead><tr><th>구분</th><th class="n">개수</th><th>FP 처리</th></tr></thead>
          <tbody>
${rows}
            <tr class="total"><td>합계</td><td class="n">${num(tables.total)}</td>
              <td class="desc">→ 논리파일 ${num(logicalFiles)}</td></tr>
          </tbody>
        </table>
        </div>`;
}

/** 화면 영역별 표 */
function pageScaleTable(pages, scale) {
  const rows = pages.byArea
    .map((a) => `            <tr><td>${esc(a.area)}</td><td class="n">${num(a.count)}</td></tr>`)
    .join('\n');
  return `        <div class="tw">
        <table>
          <thead><tr><th>영역</th><th class="n">화면</th></tr></thead>
          <tbody>
${rows}
            <tr class="total"><td>합계</td><td class="n">${num(pages.total)}</td></tr>
          </tbody>
        </table>
        </div>
        <p class="sub" style="margin-top:10px">컴포넌트 ${num(scale.components)} · 컴포저블 ${num(scale.composables)}</p>`;
}

/** 데이터기능 중 복잡도 상위(Average/High) 상세 행. 해당 항목이 없으면 섹션 자체를 생략합니다. */
function topDataRows(rows) {
  const notable = rows.filter((r) => ['ILF', 'EIF'].includes(r.type) && r.complexity !== 'Low');
  if (notable.length === 0) return '';
  const color = { Average: 'var(--avg)', High: 'var(--high)' };
  const body = notable
    .sort((a, b) => b.fp - a.fp)
    .map(
      (r) => `        <tr>
          <td>${esc(r.name)}</td><td class="type">${esc(r.desc)}</td>
          <td class="n">${num(r.ret)}</td><td class="n">${num(r.det)}</td>
          <td><span class="cx"><b style="color:${color[r.complexity]}">${r.complexity}</b></span></td>
          <td class="n"><b>${num(r.fp)}</b></td>
        </tr>`,
    )
    .join('\n');
  return `    <h3>복잡도 상위 데이터 기능</h3>
    <div class="tw">
    <table>
      <thead><tr><th>논리파일</th><th>물리 테이블</th><th class="n">RET</th><th class="n">DET</th><th>복잡도</th><th class="n">FP</th></tr></thead>
      <tbody>
${body}
      </tbody>
    </table>
    </div>`;
}

/** 업무 영역별 규모 표 */
function groupTable(byGroup, ufp, totals) {
  const max = Math.max(...byGroup.map((g) => g.fp));
  const rows = byGroup
    .map(
      (g) => `        <tr>
          <td><b>${esc(g.key)}</b><div class="desc">${esc(g.desc)}</div></td>
          <td class="n">${num(g.data)}</td><td class="n">${num(g.tx)}</td><td class="n">${num(g.count)}</td>
          <td class="n"><b>${num(g.fp)}</b></td>
          <td><div class="bar"><i style="width:${pct1(g.fp, max)}%;background:var(--accent)"></i></div><span class="cx">${pct1(g.fp, ufp)}%</span></td>
        </tr>`,
    )
    .join('\n');
  return `    <div class="tw">
    <table>
      <thead><tr><th>영역</th><th class="n">데이터</th><th class="n">트랜잭션</th><th class="n">계</th><th class="n">FP</th><th style="width:34%">비중</th></tr></thead>
      <tbody>
${rows}
        <tr class="total"><td>합계</td><td class="n">${num(totals.data)}</td><td class="n">${num(totals.tx)}</td>
          <td class="n">${num(totals.count)}</td><td class="n">${num(ufp)}</td><td></td></tr>
      </tbody>
    </table>
    </div>`;
}

/** UFP 구성 비중 막대 */
function compositionBars(byType, ufp) {
  return Object.entries(byType)
    .filter(([, s]) => s.count > 0)
    .map(([type, s]) => {
      const p = pct(s.fp, ufp);
      // 폭이 좁으면 막대 안 라벨이 잘리므로 8% 미만은 우측에만 표기
      const inner = p >= 8 ? num(s.fp) : '';
      const right = p >= 8 ? `${p.toFixed(1)}%` : `${num(s.fp)} · ${p.toFixed(1)}%`;
      return `      <div class="row">
        <span class="lab"><span class="type ${type.toLowerCase()}">${type}</span> ${TYPE_LABEL[type]}</span>
        <div class="track"><div class="fill" style="width:${p.toFixed(1)}%;background:var(--${type.toLowerCase()})">${inner}</div></div>
        <span class="amt">${right}</span>
      </div>`;
    })
    .join('\n');
}

/** 보정계수 표 */
function factorTable(factors, composite) {
  const rows = factors
    .map(
      (f) => `        <tr><td>${esc(f.label)}</td><td class="n">${f.value.toFixed(2)}</td><td class="desc">${esc(f.basis)}</td></tr>`,
    )
    .join('\n');
  const applied =
    factors
      .filter((f) => f.value !== 1)
      .map((f) => f.value.toFixed(2))
      .join(' × ') || '1.00';
  return `    <div class="tw">
    <table>
      <thead><tr><th>보정계수</th><th class="n">적용값</th><th>근거</th></tr></thead>
      <tbody>
${rows}
        <tr class="total"><td>합성 보정계수</td><td class="n">≈ ${composite.toFixed(3)}</td><td class="desc">${applied}</td></tr>
      </tbody>
    </table>
    </div>`;
}

/** 개발비 산출 표 */
function costTable(adjustedFp, cfg) {
  const base = adjustedFp * cfg.unitPrice;
  const withProfit = base * (1 + cfg.profitRate);
  const withVat = withProfit * (1 + cfg.vatRate);
  return `    <div class="tw">
    <table>
      <thead><tr><th>항목</th><th>계산</th><th class="n">금액</th></tr></thead>
      <tbody>
        <tr><td>FP당 단가</td><td class="desc">보정 전 개발원가 단가</td>
          <td class="n">${num(cfg.unitPrice)} 원/FP</td></tr>
        <tr><td>개발원가</td><td class="desc">${num(adjustedFp)} × ${num(cfg.unitPrice)}</td>
          <td class="n"><b>${won(base)}</b></td></tr>
        <tr><td>+ 이윤 ${(cfg.profitRate * 100).toFixed(0)}%</td><td class="desc">× ${(1 + cfg.profitRate).toFixed(2)}</td>
          <td class="n">${won(withProfit)}</td></tr>
        <tr class="total"><td>+ 부가세 ${(cfg.vatRate * 100).toFixed(0)}%</td><td class="desc">× ${(1 + cfg.vatRate).toFixed(2)}</td>
          <td class="n">${won(withVat)}</td></tr>
      </tbody>
    </table>
    </div>`;
}

/** 변경 구분 뱃지. 색 관례는 기존 .type.{ilf|ei|eo} 클래스를 재사용합니다. */
function changeBadge(kind) {
  const map = { added: ['추가', 'ei'], removed: ['삭제', 'eo'], changed: ['수정', 'ilf'] };
  const [label, tone] = map[kind];
  return `<span class="type ${tone}">${label}</span>`;
}

/** 변경 행 하나를 표 행으로 렌더합니다. */
function changeRow(kind, row, detail) {
  return `            <tr>
              <td>${changeBadge(kind)}</td>
              <td>${esc(row.domain)}</td>
              <td><b>${esc(row.name)}</b></td>
              <td class="cx">${esc(detail)}</td>
              <td class="desc">${esc(row.change || '—')}</td>
            </tr>`;
}

/**
 * 직전 산정본 대비 변경 섹션.
 * 최초 산정(baseline 없음)이면 비교 대상이 없다는 안내만 냅니다.
 */
function changeSection(diff, date) {
  if (!diff.baseline) {
    return `  <section>
    <div class="sec-head"><span class="sec-no">변경</span><h2>직전 산정 대비 변경</h2>
      <span class="sec-note">최초 산정</span></div>
    <div class="note">
      <b>비교할 직전 산정본이 없습니다.</b> ${esc(date)} 산정본이 첫 번째 날짜별 명세이므로
      이번 리포트는 기준선(baseline)이 됩니다. 다음 산정부터 이 섹션에 추가 · 삭제 · 수정된
      단위프로세스와 UFP 증감이 자동으로 표시됩니다.
    </div>
  </section>`;
  }

  const sign = (n) => (n > 0 ? `+${num(n)}` : num(n));
  const rows = [
    ...diff.added.map((r) => changeRow('added', r, `신규 ${r.type} · FP +${r.fp}`)),
    ...diff.removed.map((r) => changeRow('removed', r, `제외 ${r.type} · FP -${r.fp}`)),
    ...diff.changed.map((r) => changeRow('changed', r, `${r.deltas.join(' · ')} (FP ${sign(r.fpDelta)})`)),
  ].join('\n');

  const warnings = [];
  if (diff.undocumented.length > 0) {
    warnings.push(`<b>변경내용 미기재 ${num(diff.undocumented.length)}건</b> —
      수치가 바뀌었으나 사유가 비어 있습니다:
      <span class="type">${diff.undocumented.slice(0, 12).map(esc).join('</span> · <span class="type">')}</span>`);
  }
  if (diff.staleNotes.length > 0) {
    warnings.push(`<b>변동 없는데 변경내용 기재 ${num(diff.staleNotes.length)}건</b> —
      직전 산정본의 메모가 남아 있을 수 있습니다:
      <span class="type">${diff.staleNotes.slice(0, 12).map(esc).join('</span> · <span class="type">')}</span>`);
  }

  const body =
    rows.length > 0
      ? `    <div class="tw">
    <table>
      <thead><tr><th>구분</th><th>도메인</th><th>단위프로세스</th><th>변동 항목</th><th>변경 사유(CSV 기재)</th></tr></thead>
      <tbody>
${rows}
      </tbody>
    </table>
    </div>`
      : `    <div class="note">기능 구성과 수치가 <b>직전 산정본과 동일</b>합니다. 변동 없음.</div>`;

  return `  <section>
    <div class="sec-head"><span class="sec-no">변경</span><h2>직전 산정 대비 변경</h2>
      <span class="sec-note">기준 ${esc(diff.baseline)}</span></div>
    <p>
      <b>${esc(diff.baseline)}</b> 산정본과 대조한 결과입니다 —
      추가 <b>${num(diff.added.length)}건</b> · 삭제 <b>${num(diff.removed.length)}건</b> ·
      수정 <b>${num(diff.changed.length)}건</b> · 변동 없음 ${num(diff.unchanged)}건.
      UFP는 <b>${num(diff.ufpBefore)} → ${num(diff.ufpAfter)}</b>
      (<b>${sign(diff.ufpDelta)} FP</b>${diff.ufpBefore > 0 ? ` · ${pct1(diff.ufpDelta, diff.ufpBefore)}%` : ''})로 변동했습니다.
      비교 키는 <span class="type">도메인/단위프로세스명</span>이므로 기능명을 바꾸면 삭제+추가로 잡힙니다.
    </p>
${body}
${warnings.length > 0 ? `    <div class="note warn">${warnings.join('<br><br>')}</div>` : ''}
  </section>`;
}

/** CSV 재계산 불일치 경고 블록 (불일치가 있을 때만 노출) */
function mismatchNote(mismatches) {
  if (mismatches.length === 0) return '';
  const items = mismatches.map((m) => `<li>${esc(m)}</li>`).join('');
  return `    <div class="note warn"><b>⚠️ CSV 값과 매트릭스 재계산 결과가 ${mismatches.length}건 불일치합니다.</b>
      리포트 수치는 <b>재계산 값</b> 기준입니다. 해당 날짜의 산정 CSV를 갱신하세요.
      <ul style="margin:8px 0 0 18px">${items}</ul></div>`;
}

const STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700;900&display=swap');
  :root{
    --ink:#14171c; --ink-2:#41474f; --ink-3:#767d86;
    --rule:#dfe3e8; --rule-2:#eef1f4; --paper:#fff; --wash:#f6f7f9;
    --accent:#1c4ed8; --accent-wash:#eaf0fe;
    --ilf:#1c4ed8; --eif:#0e7c86; --ei:#b4530a; --eo:#7c3aed; --eq:#0f766e;
    --low:#8b929b; --avg:#c2820b; --high:#c0392b;
    /* 본문·제목 모두 Noto Sans KR. CDN 미도달(오프라인) 시 시스템 한글 폰트로 폴백 */
    --sans:"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",-apple-system,"Segoe UI",sans-serif;
    --mono:"Noto Sans Mono","D2Coding",Consolas,monospace;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--wash);color:var(--ink);font-family:var(--sans);font-size:15px;
    line-height:1.7;-webkit-font-smoothing:antialiased;padding:clamp(12px,3vw,44px);
    word-break:keep-all}
  .sheet{max-width:1080px;margin:0 auto;background:var(--paper);border:1px solid var(--rule);
    box-shadow:0 1px 2px rgba(20,23,28,.04),0 12px 34px -14px rgba(20,23,28,.14)}
  .pad{padding:clamp(22px,4vw,60px)}
  .masthead{border-bottom:2px solid var(--ink);padding-bottom:26px}
  .eyebrow{font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:700}
  h1{font-weight:900;font-size:clamp(25px,4vw,40px);line-height:1.25;letter-spacing:-.03em;margin:10px 0 14px}
  /* ch은 라틴 "0" 폭(≈8.6px) 기준이라 한글에 쓰면 의도한 글자 수의 절반에서 줄이 끊긴다.
     본문은 한글이므로 폭 제한을 두지 않고 .sheet 폭(≈한글 62자/줄)에 맡긴다. */
  .dek{color:var(--ink-2);font-size:15.5px}
  .meta{display:flex;flex-wrap:wrap;gap:6px 26px;margin-top:20px;font-size:12.5px;
    color:var(--ink-3);font-family:var(--mono)}
  .meta b{color:var(--ink-2);font-weight:700}
  .hero{display:grid;grid-template-columns:1.35fr 1fr 1fr 1fr;border:1px solid var(--rule);
    margin-top:34px;background:var(--rule);gap:1px}
  .hero > div{background:var(--paper);padding:22px 20px}
  .hero .lead{background:var(--ink);color:#fff}
  .hero .lead .k{color:rgba(255,255,255,.62)}
  .hero .lead .v{color:#fff}
  .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-3);font-weight:700}
  .v{font-weight:900;font-size:clamp(29px,4.2vw,44px);line-height:1.05;letter-spacing:-.04em;
    margin-top:12px;font-variant-numeric:tabular-nums}
  .v small{font-size:.42em;font-weight:700;letter-spacing:0;margin-left:5px;color:var(--ink-3)}
  .hero .lead .v small{color:rgba(255,255,255,.6)}
  .sub{font-size:12.5px;color:var(--ink-3);margin-top:8px;line-height:1.5}
  .hero .lead .sub{color:rgba(255,255,255,.62)}
  section{margin-top:52px}
  .sec-head{display:flex;align-items:baseline;gap:14px;border-bottom:1px solid var(--ink);
    padding-bottom:9px;margin-bottom:22px}
  .sec-no{font-family:var(--mono);font-size:12px;color:var(--accent);font-weight:700}
  h2{font-weight:900;font-size:22px;letter-spacing:-.02em}
  .sec-note{margin-left:auto;font-size:12px;color:var(--ink-3);font-family:var(--mono)}
  h3{font-size:14px;font-weight:700;margin:30px 0 12px;letter-spacing:-.01em}
  p{color:var(--ink-2)}
  p + p{margin-top:10px}
  .tw{overflow-x:auto;-webkit-overflow-scrolling:touch}
  table{width:100%;border-collapse:collapse;font-size:13.5px;min-width:480px}
  th,td{padding:10px 12px;text-align:left;border-bottom:1px solid var(--rule-2)}
  thead th{font-size:10.5px;letter-spacing:.09em;text-transform:uppercase;color:var(--ink-3);
    font-weight:700;border-bottom:1px solid var(--ink);white-space:nowrap}
  td.n,th.n{text-align:right;font-family:var(--mono);font-variant-numeric:tabular-nums;white-space:nowrap}
  tbody tr:hover{background:var(--wash)}
  tr.total{background:var(--wash)}
  tr.total td{border-top:2px solid var(--ink);border-bottom:none;font-weight:700;color:var(--ink)}
  tr.total td.n{font-size:15px}
  .type{font-family:var(--mono);font-weight:700;font-size:12px;letter-spacing:.04em}
  .type.ilf{color:var(--ilf)} .type.eif{color:var(--eif)}
  .type.ei{color:var(--ei)} .type.eo{color:var(--eo)} .type.eq{color:var(--eq)}
  .desc{color:var(--ink-3);font-size:12.5px}
  .muted{color:var(--ink-3)}
  .bar{display:flex;height:8px;border-radius:99px;overflow:hidden;background:var(--rule-2);min-width:96px}
  .bar i{display:block;height:100%}
  .bar .l{background:var(--low)} .bar .a{background:var(--avg)} .bar .h{background:var(--high)}
  .cx{font-family:var(--mono);font-size:11.5px;color:var(--ink-3);white-space:nowrap}
  .cx b{color:var(--ink-2);font-weight:700}
  .comp{display:grid;gap:12px;margin-top:8px}
  .row{display:grid;grid-template-columns:150px 1fr 100px;gap:14px;align-items:center}
  .row .lab{font-size:13px;font-weight:700}
  .row .track{background:var(--rule-2);height:26px;border-radius:2px;overflow:hidden}
  .row .fill{height:100%;display:flex;align-items:center;padding-left:10px;color:#fff;
    font-family:var(--mono);font-size:11.5px;font-weight:700}
  .row .amt{text-align:right;font-family:var(--mono);font-size:13px;
    font-variant-numeric:tabular-nums;color:var(--ink-2)}
  .formula{background:var(--ink);color:#e9ecf1;font-family:var(--mono);font-size:13px;
    padding:20px 22px;line-height:2;overflow-x:auto;white-space:pre}
  .formula b{color:#fff;font-weight:700}
  .formula .c{color:#8b95a5}
  .note{border-left:3px solid var(--accent);background:var(--accent-wash);padding:14px 18px;
    font-size:13.5px;color:var(--ink-2);margin-top:18px}
  .warn{border-left-color:#c0392b;background:#fdeeec}
  .note b{color:var(--ink)}
  /* grid 자식은 min-width:auto 기본값 탓에 내부 테이블이 칼럼을 밀어내 페이지가 가로 스크롤됨.
     .tw 내부 스크롤로 가두려면 min-width:0이 필수 */
  .grid2{display:grid;grid-template-columns:1fr 1fr;gap:34px;min-width:0}
  .grid2 > div{min-width:0}
  /* 2단 칼럼은 480px에 못 미쳐(1080 - .pad 120 - gap 34, ÷2 ≈ 467) 표 기본 min-width가
     항상 .tw 횡스크롤을 만든다. 이 섹션 표는 열 수가 적어 좁혀도 읽히므로 하한을 푼다. */
  .grid2 table{min-width:0}
  ol.assump{margin:6px 0 0 20px;color:var(--ink-2);font-size:13.5px}
  ol.assump li{margin-bottom:9px;padding-left:4px}
  ol.assump li b{color:var(--ink)}
  footer{margin-top:56px;border-top:1px solid var(--rule);padding-top:20px;font-size:12px;
    color:var(--ink-3);display:flex;flex-wrap:wrap;gap:10px 24px}
  footer a{color:var(--accent);text-decoration:none;border-bottom:1px solid var(--accent-wash)}
  footer a:hover{border-bottom-color:var(--accent)}
  @media (max-width:860px){
    .hero{grid-template-columns:1fr 1fr}
    .grid2{grid-template-columns:1fr;gap:22px}
    .row{grid-template-columns:104px 1fr 84px;gap:10px}
  }
  @media (max-width:520px){ .hero{grid-template-columns:1fr} }
  @media print{
    body{background:#fff;padding:0;font-size:11pt}
    .sheet{border:none;box-shadow:none;max-width:none}
    section{break-inside:avoid}
    .hero .lead{background:#fff!important;color:var(--ink)!important;border:1px solid var(--ink)}
    .hero .lead .v,.hero .lead .k,.hero .lead .sub{color:var(--ink)!important}
    .formula{background:#fff;color:var(--ink);border:1px solid var(--ink)}
    .formula .c{color:var(--ink-3)}
  }`;

/**
 * 리포트 HTML 문서를 생성합니다.
 * @param {{date:string, scale:object, agg:object, config:object,
 *          csvName:string, rowCount:number, diff:object}} input date는 YYYY-MM-DD 형식,
 *          diff는 diffEstimates 결과(직전 산정본 대비 변경)
 * @returns {string} 완성된 HTML 문서 문자열
 */
export function renderReport({ date, scale, agg, config, csvName, rowCount, diff }) {
  const { byType, dataTotal, txTotal, ufp, byGroup } = agg;
  const composite = config.factors.reduce((acc, f) => acc * f.value, 1);
  const adjustedFp = Math.round(ufp * composite);
  const totals = { data: dataTotal.count, tx: txTotal.count, count: dataTotal.count + txTotal.count };

  return `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>IT Project Portal — 시스템 규모 및 기능점수(FP) 산정 리포트 (${esc(date)})</title>
<style>${STYLE}
</style>
</head>
<body>
<div class="sheet"><div class="pad">

  <header class="masthead">
    <div class="eyebrow">System Scale &amp; Function Point Estimate</div>
    <h1>IT Project Portal<br>시스템 규모 및 기능점수 산정 리포트</h1>
    <p class="dek">
      정보화 예산·사업·인력 관리 포탈(사내 임직원 약 3,000명)의 전체 개발 규모를
      KOSA 「소프트웨어사업 대가산정 가이드」 <b>정통법(Detailed FP)</b> 기준으로 산정한 결과입니다.
      물리 테이블·화면·API를 코드에서 직접 계수하여 논리파일과 단위 프로세스로 환산했습니다.
    </p>
    <div class="meta">
      <span><b>산정일</b> ${esc(date)}</span>
      <span><b>기준</b> 정통법 Detailed FP</span>
      <span><b>대상</b> it_frontend + it_backend</span>
      <span><b>명세</b> ${esc(csvName)} (${num(rowCount)}행)</span>
    </div>
  </header>

  <div class="hero">
    <div class="lead">
      <div class="k">미조정 기능점수 UFP</div>
      <div class="v">${num(ufp)}<small>FP</small></div>
      <div class="sub">데이터 ${num(dataTotal.fp)} + 트랜잭션 ${num(txTotal.fp)}</div>
    </div>
    <div>
      <div class="k">물리 테이블</div>
      <div class="v">${num(scale.tables.total)}<small>개</small></div>
      <div class="sub">→ 논리파일 ${num(dataTotal.count)}개<br>(ILF ${num(byType.ILF.count)} · EIF ${num(byType.EIF.count)})</div>
    </div>
    <div>
      <div class="k">화면(페이지)</div>
      <div class="v">${num(scale.pages.total)}<small>개</small></div>
      <div class="sub">Nuxt 4 라우트 기준<br>컴포넌트 ${num(scale.components)} · 컴포저블 ${num(scale.composables)}</div>
    </div>
    <div>
      <div class="k">단위 프로세스</div>
      <div class="v">${num(txTotal.count)}<small>개</small></div>
      <div class="sub">REST 컨트롤러 ${num(scale.controllers)}개<br>엔드포인트 ${num(scale.endpoints)}개</div>
    </div>
  </div>

  <section>
    <div class="sec-head"><span class="sec-no">STEP 1</span><h2>산정 범위 및 시스템 경계</h2></div>
    <p>
      <b>측정 대상</b>은 IT 정보화 포탈 신규 개발 전체입니다 —
      예산 편성·정보화사업·집행 4단계(산정/심의/계약/지급)·협의회 심의·전자결재·게시판·공통코드·메뉴·알림·파일·관리자 실시간 모니터링.
    </p>
    <p>
      <b>시스템 내부(ILF)</b>는 본 시스템이 직접 C·R·U·D 하는 데이터입니다.
      <b>시스템 외부(EIF)</b>는 사내 <b>SSO/eHR</b>이 원천인 사용자·조직·자격등급 정보로,
      로그인 시 참조(읽기)만 수행하므로 EIF로 분류했습니다.
    </p>
    <div class="note">
      <b>화면 vs 단위 프로세스</b> — 프론트엔드 화면 ${num(scale.pages.total)}개는 백엔드 단위 프로세스와 1:N로 대응합니다.
      중복 계상을 피하기 위해 트랜잭션 기능은 <b>화면이 아닌 단위 프로세스(엘리멘터리 프로세스) 기준</b>으로 산정했습니다.
      화면 수는 규모 참고 지표로만 제시합니다.
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">규모</span><h2>물리 규모 실측</h2>
      <span class="sec-note">코드 계수 기준</span></div>
    <div class="grid2">
      <div>
        <h3>데이터베이스 — 물리 테이블 ${num(scale.tables.total)}개</h3>
${tableScaleTable(scale.tables, dataTotal.count)}
${orphanTableNote(scale.tables)}
      </div>
      <div>
        <h3>화면 — Nuxt 4 페이지 ${num(scale.pages.total)}개</h3>
${pageScaleTable(scale.pages, scale)}
      </div>
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">STEP 2</span><h2>데이터 기능 (ILF / EIF)</h2>
      <span class="sec-note">${num(dataTotal.fp)} FP</span></div>
${typeTable('논리파일', ['ILF', 'EIF'], byType, dataTotal, '데이터 기능 소계')}

    <h3>산정 규칙</h3>
    <div class="tw">
    <table>
      <thead><tr><th style="width:80px">항목</th><th>규칙</th></tr></thead>
      <tbody>
        <tr><td><b>DET</b></td><td class="desc">엔티티 <span class="type">@Column</span> 수.
          <span class="type">BaseEntity</span> 공통 감사컬럼(<span class="type">DEL_YN·GUID·FST_ENR_*·LST_CHG_*</span>)은
          반복 그룹으로 묶어 <b>1 DET</b>.</td></tr>
        <tr><td><b>RET</b></td><td class="desc">마스터 1 + 종속 상세테이블(+1) + 변경로그 <span class="type">*L</span>(+1).</td></tr>
        <tr><td><b>병합</b></td><td class="desc">마스터+상세는 단일 논리파일로 병합 —
          사업+품목, 전산관리비+단말기, 대금지급+회차, 소요예산+팀별.</td></tr>
      </tbody>
    </table>
    </div>
${topDataRows(agg.rows)}
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">STEP 3</span><h2>트랜잭션 기능 (EI / EO / EQ)</h2>
      <span class="sec-note">${num(txTotal.fp)} FP</span></div>
${typeTable('단위프로세스', ['EI', 'EO', 'EQ'], byType, txTotal, '트랜잭션 기능 소계')}

    <h3>분류 규칙</h3>
    <div class="tw">
    <table>
      <thead><tr><th style="width:70px">유형</th><th>판정 기준</th></tr></thead>
      <tbody>
        <tr><td><span class="type ei">EI</span></td><td class="desc">ILF 갱신·상태변경 —
          등록/수정/삭제/상태전이/상세저장/로그인/업로드/읽음처리.
          <b>게시글 상세조회는 조회수 갱신을 동반하여 EI</b>로 판정.</td></tr>
        <tr><td><span class="type eo">EO</span></td><td class="desc">계산·집계·파생이 개입하는 출력 —
          예산현황·편성률·증감률·부서 KPI·대시보드·실시간 로그 집계·Tiptap 변수치환·Gemini AI 생성.</td></tr>
        <tr><td><span class="type eq">EQ</span></td><td class="desc">계산 없는 단순 조회 —
          목록·상세·검색·파일 다운로드·이미지 미리보기.</td></tr>
      </tbody>
    </table>
    </div>
    <div class="note">복잡도는 FP.md의 <b>FTR × DET 매트릭스</b>로 결정적 산출
      (<span class="type">lib/fp-rules.mjs</span> 재계산) — 임의 판단 없음.</div>
${mismatchNote(agg.mismatches)}
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">분포</span><h2>업무 영역별 규모</h2>
      <span class="sec-note">${num(totals.count)} 기능 · ${num(ufp)} FP</span></div>
${groupTable(byGroup, ufp, totals)}
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">STEP 4</span><h2>미조정 기능점수 (UFP)</h2></div>
    <div class="formula"><span class="c">UFP = ILF + EIF + EI + EO + EQ</span>
    = <b>${num(byType.ILF.fp)}</b> + <b>${num(byType.EIF.fp)}</b> + <b>${num(byType.EI.fp)}</b> + <b>${num(byType.EO.fp)}</b> + <b>${num(byType.EQ.fp)}</b>
    = 데이터기능(<b>${num(dataTotal.fp)}</b>) + 트랜잭션기능(<b>${num(txTotal.fp)}</b>)
    = <b>${num(ufp)} FP</b></div>
    <div class="comp" style="margin-top:24px">
${compositionBars(byType, ufp)}
    </div>
  </section>

  <section>
    <div class="sec-head"><span class="sec-no">STEP 5</span><h2>보정 및 개발비 산출</h2>
      <span class="sec-note">가정값 포함</span></div>
    <div class="note warn">
      <b>⚠️ 아래 보정계수는 대표값(가정)입니다.</b>
      FP당 단가 · 이윤율 · 부가세율은 지정값이며, 보정계수는 실제 제안 · 예산 산정 시
      해당 연도 고시 「소프트웨어사업 대가산정 가이드」 표와 사업 특성에 맞춰
      <b>반드시 교체</b>하십시오(<span class="type">generate-report.mjs</span>의 <span class="type">CONFIG</span>).
      본 리포트의 확정 산출물은 <b>UFP ${num(ufp)}</b>까지입니다.
    </div>

    <h3>5-1. 보정 후 기능점수</h3>
${factorTable(config.factors, composite)}
    <div class="formula" style="margin-top:16px">보정 후 FP ≈ <b>${num(ufp)}</b> × <b>${composite.toFixed(3)}</b> ≈ <b>${num(adjustedFp)} FP</b></div>

    <h3>5-2. 개발원가 및 최종 금액</h3>
${costTable(adjustedFp, config)}
    <div class="note">
      보정 미적용 <b>UFP ${num(ufp)}</b> 기준으로는 개발원가 ≈ <b>${won(ufp * config.unitPrice)}</b>,
      이윤·부가세 포함 ≈ <b>${won(ufp * config.unitPrice * (1 + config.profitRate) * (1 + config.vatRate))}</b>.
    </div>
  </section>

${changeSection(diff, date)}

  <section>
    <div class="sec-head"><span class="sec-no">비고</span><h2>가정 및 주의사항</h2></div>
    <ol class="assump">
      <li><b>보정계수는 대표 가정값</b> — 실제 산정은 사업 특성별 보정계수표로 교체 필요.
        FP당 단가 ${num(config.unitPrice)}원은 보정 전 개발원가 기준 지정값.</li>
      <li><b>이윤·부가세</b>는 CONFIG 설정값(이윤 ${(config.profitRate * 100).toFixed(0)}% +
        부가세 ${(config.vatRate * 100).toFixed(0)}%)을 따름. 공공사업 정식 산정은 직접경비 별도 +
        이윤율(개발원가+직접경비의 25% 이내) 규정이 다를 수 있음.</li>
      <li><b>DET/FTR은 엔티티·DTO 필드 기반 추정</b> — 일부 대형 응답 DTO는 사용자 인식 항목 기준으로 보수적 평가.
        화면 요건 확정 시 ±5% 내외 변동 가능.</li>
      <li><b>EIF 판정(${num(byType.EIF.count)}건)</b> — 사용자/조직/자격등급을 SSO/eHR 외부 원천으로 보아 EIF 처리.
        본 시스템이 직접 유지관리하는 것으로 본다면 ILF로 재분류(<b>+${num(byType.EIF.count * 2)} FP</b>).</li>
      <li><b>개발 전용 API 포함</b> — DevAuthController 등 개발 전용 엔드포인트도 산정에 포함.
        운영 범위에서 제외 시 해당 행 차감.</li>
      <li><b>변경로그(*L) ${num(scale.tables.bySuffix.L)}종</b> 중 엔티티가 매핑된
        ${num(scale.tables.bySuffix.L - scale.tables.orphans.filter((t) => t.toUpperCase().endsWith('L')).length)}종은
        별도 ILF가 아닌 마스터 논리파일의 RET(+1)로 처리하여 중복 계상 회피.</li>
      <li><b>화면 ${num(scale.pages.total)}개는 규모 참고 지표</b> — FP 산정의 계상 단위가 아님(단위 프로세스 기준 산정).</li>
    </ol>
  </section>

  <footer>
    <span><b>산출물</b></span>
    <span><a href="../${esc(csvName)}">${esc(csvName)}</a> — ${num(rowCount)}개 단위기능 상세 명세</span>
    <span><a href="../FP.md">FP.md</a> — 정통법 산정 방법론</span>
    <span class="muted">generate-report.mjs 자동 생성 · ${esc(date)}</span>
  </footer>

</div></div>
</body>
</html>
`;
}
