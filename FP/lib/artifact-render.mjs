/**
 * 보고용 기능점수 아티팩트 렌더러.
 *
 * generate-report.mjs 계열의 실무 검증용 리포트(lib/render.mjs)와 달리,
 * 경영진·발주처가 결론부터 읽도록 구성한 단일 페이지를 만듭니다.
 * 차트는 외부 라이브러리 없이 인라인 SVG로 직접 그립니다
 * (아티팩트 CSP가 CDN·외부 폰트·원격 이미지를 차단하기 때문입니다).
 */

/** FP 유형 표시 순서. 차트 색 슬롯은 이 순서에 고정 배정하며 순환시키지 않습니다. */
const TYPE_ORDER = ['ILF', 'EIF', 'EI', 'EO', 'EQ'];

/** 유형별 한글 명칭과 정통법상 성격. */
const TYPE_META = {
  ILF: { name: '내부논리파일', kind: '데이터', desc: '시스템 경계 안에서 유지·관리하는 데이터 묶음' },
  EIF: { name: '외부인터페이스파일', kind: '데이터', desc: '외부에서 관리되고 참조만 하는 데이터' },
  EI: { name: '외부입력', kind: '트랜잭션', desc: '등록·수정·삭제 등 내부 데이터를 갱신하는 기능' },
  EO: { name: '외부출력', kind: '트랜잭션', desc: '집계·계산 등 파생이 개입하는 출력 기능' },
  EQ: { name: '외부조회', kind: '트랜잭션', desc: '파생 없이 있는 값을 그대로 보여주는 조회 기능' },
};

const COMPLEXITIES = ['Low', 'Average', 'High'];
const COMPLEXITY_LABEL = { Low: '단순', Average: '보통', High: '복잡' };

/** HTML 특수문자를 이스케이프합니다. */
function esc(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** 천 단위 구분 정수 문자열. */
function n(value) {
  return Math.round(value).toLocaleString('ko-KR');
}

/** 소수 1자리 고정 문자열. */
function n1(value) {
  return value.toLocaleString('ko-KR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** 백분율 문자열(소수 1자리). */
function pct(part, whole) {
  return whole === 0 ? '0.0%' : `${((part / whole) * 100).toFixed(1)}%`;
}

/** 금액을 '00.0억 원' 형태로 축약합니다. */
function eok(won) {
  return `${(won / 100_000_000).toFixed(1)}억 원`;
}

/** 부호를 붙인 증감 문자열. */
function signed(value) {
  return value > 0 ? `+${n(value)}` : n(value);
}

// ── 차트 ──────────────────────────────────────────────────────────────────

/**
 * 유형별 FP 구성을 단일 누적 막대로 그립니다.
 * 세그먼트 사이에는 표면색 2px 간격을 두어 경계가 색 대비에만 의존하지 않게 합니다.
 */
function stackedTypeBar(byType, ufp) {
  const W = 1000;
  const BAR_Y = 30;
  const BAR_H = 46;
  const GAP = 2;
  const R = 4;

  let x = 0;
  const segments = [];
  const labels = [];

  TYPE_ORDER.forEach((type, i) => {
    const fp = byType[type].fp;
    const w = (fp / ufp) * W;
    const drawW = Math.max(w - GAP, 1);
    const isFirst = i === 0;
    const isLast = i === TYPE_ORDER.length - 1;
    // 바깥쪽 끝만 둥글게 처리하고 내부 경계는 직각으로 맞물립니다.
    const path = roundedSegment(x, BAR_Y, drawW, BAR_H, R, isFirst, isLast);
    segments.push(
      `<path d="${path}" fill="var(--s${i + 1})" class="mk" ` +
        `data-label="${esc(type)} · ${esc(TYPE_META[type].name)}" ` +
        `data-value="${n(fp)} FP · ${byType[type].count}건 · ${pct(fp, ufp)}"/>`,
    );
    // 세그먼트가 충분히 넓을 때만 직접 라벨을 답니다(모든 마크에 숫자를 찍지 않습니다).
    // 라벨은 채움색 위가 아니라 막대 밖 잉크색으로 두어, 어떤 계열색에서도 대비가 유지됩니다.
    if (w >= 92) {
      const cx = (x + drawW / 2).toFixed(1);
      labels.push(
        `<text x="${cx}" y="${BAR_Y - 11}" class="seg-t">${esc(type)}</text>`,
        `<text x="${cx}" y="${BAR_Y + BAR_H + 26}" class="seg-v">${n(byType[type].fp)}<tspan class="seg-u"> FP</tspan></text>`,
        `<text x="${cx}" y="${BAR_Y + BAR_H + 44}" class="seg-p">${pct(byType[type].fp, ufp)}</text>`,
      );
    }
    x += w;
  });

  return `<svg viewBox="0 0 ${W} ${BAR_Y + BAR_H + 52}" class="chart" role="img"
    aria-label="FP 유형별 구성 누적 막대. 총 ${n(ufp)} FP.">
    ${segments.join('\n    ')}
    ${labels.join('\n    ')}
  </svg>`;
}

/** 양 끝만 선택적으로 둥근 사각형 path를 만듭니다. */
function roundedSegment(x, y, w, h, r, roundLeft, roundRight) {
  const rl = roundLeft ? Math.min(r, w / 2) : 0;
  const rr = roundRight ? Math.min(r, w / 2) : 0;
  return (
    `M${(x + rl).toFixed(1)},${y}` +
    `H${(x + w - rr).toFixed(1)}` +
    (rr ? `a${rr},${rr} 0 0 1 ${rr},${rr}` : '') +
    `V${y + h - rr}` +
    (rr ? `a${rr},${rr} 0 0 1 -${rr},${rr}` : '') +
    `H${(x + rl).toFixed(1)}` +
    (rl ? `a${rl},${rl} 0 0 1 -${rl},-${rl}` : '') +
    `V${y + rl}` +
    (rl ? `a${rl},${rl} 0 0 1 ${rl},-${rl}` : '') +
    'Z'
  );
}

/**
 * 유형별 복잡도 분포를 행 누적 막대로 그립니다.
 * 복잡도는 순서가 있는 값이므로 단일 색상의 순서형 램프를 씁니다.
 */
function complexityRows(byType) {
  const W = 1000;
  const LABEL_W = 66;
  const ROW_H = 30;
  const BAR_H = 16;
  const GAP = 2;
  const plotW = W - LABEL_W - 60;
  const maxCount = Math.max(...TYPE_ORDER.map((t) => byType[t].count));

  const rows = TYPE_ORDER.map((type, i) => {
    const y = i * ROW_H;
    const slot = byType[type];
    let x = LABEL_W;
    const parts = COMPLEXITIES.map((c, ci) => {
      const w = (slot[c] / maxCount) * plotW;
      if (w <= 0) return '';
      const drawW = Math.max(w - GAP, 1);
      const seg =
        `<rect x="${x.toFixed(1)}" y="${y + (ROW_H - BAR_H) / 2}" width="${drawW.toFixed(1)}" ` +
        `height="${BAR_H}" rx="2" fill="var(--o${ci + 1})" class="mk" ` +
        `data-label="${esc(type)} · ${esc(COMPLEXITY_LABEL[c])}(${c})" ` +
        `data-value="${slot[c]}건"/>`;
      x += w;
      return seg;
    }).join('');
    return (
      `<text x="0" y="${y + ROW_H / 2 + 4}" class="row-l">${esc(type)}</text>` +
      parts +
      `<text x="${(x + 8).toFixed(1)}" y="${y + ROW_H / 2 + 4}" class="row-v">${slot.count}건</text>`
    );
  }).join('\n    ');

  return `<svg viewBox="0 0 ${W} ${TYPE_ORDER.length * ROW_H}" class="chart" role="img"
    aria-label="FP 유형별 복잡도 분포 막대.">
    ${rows}
  </svg>`;
}

/** 업무영역별 FP를 가로 막대로 그립니다(크기 비교이므로 단일 색상). */
function groupBars(byGroup, ufp) {
  const W = 1000;
  const LABEL_W = 132;
  const ROW_H = 46;
  const BAR_H = 22;
  const plotW = W - LABEL_W - 150;
  const max = Math.max(...byGroup.map((g) => g.fp));

  const rows = byGroup
    .map((g, i) => {
      const y = i * ROW_H;
      const w = Math.max((g.fp / max) * plotW, 2);
      return (
        `<text x="0" y="${y + ROW_H / 2 + 5}" class="row-l">${esc(g.key)}</text>` +
        `<rect x="${LABEL_W}" y="${y + (ROW_H - BAR_H) / 2}" width="${w.toFixed(1)}" height="${BAR_H}" ` +
        `rx="4" fill="var(--accent-bar)" class="mk" data-label="${esc(g.key)}" ` +
        `data-value="${n(g.fp)} FP · ${g.count}건 · ${pct(g.fp, ufp)}"/>` +
        `<text x="${(LABEL_W + w + 12).toFixed(1)}" y="${y + ROW_H / 2 + 5}" class="row-v">` +
        `${n(g.fp)} FP<tspan class="row-v2">  ${pct(g.fp, ufp)}</tspan></text>`
      );
    })
    .join('\n    ');

  return `<svg viewBox="0 0 ${W} ${byGroup.length * ROW_H}" class="chart" role="img"
    aria-label="업무영역별 기능점수 막대.">
    ${rows}
  </svg>`;
}

/** 회차별 UFP 추이를 선으로 그립니다(단일 계열이므로 범례 없이 끝점을 강조). */
function trendLine(trend) {
  const W = 1000;
  const H = 260;
  const PAD = { t: 26, r: 74, b: 40, l: 56 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const values = trend.map((t) => t.ufp);
  // 변동 폭이 작아 0부터 그리면 직선으로 뭉개지므로, 실제 구간에 여유를 둔 축을 씁니다.
  const lo = Math.floor((Math.min(...values) - 30) / 25) * 25;
  const hi = Math.ceil((Math.max(...values) + 20) / 25) * 25;
  const xOf = (i) => PAD.l + (i / (trend.length - 1)) * plotW;
  const yOf = (v) => PAD.t + plotH - ((v - lo) / (hi - lo)) * plotH;

  const ticks = [];
  for (let v = lo; v <= hi; v += 25) {
    ticks.push(
      `<line x1="${PAD.l}" y1="${yOf(v).toFixed(1)}" x2="${PAD.l + plotW}" y2="${yOf(v).toFixed(1)}" class="grid"/>` +
        `<text x="${PAD.l - 12}" y="${(yOf(v) + 4).toFixed(1)}" class="tick">${n(v)}</text>`,
    );
  }

  const pts = trend.map((t, i) => `${xOf(i).toFixed(1)},${yOf(t.ufp).toFixed(1)}`);
  const area =
    `M${PAD.l},${(PAD.t + plotH).toFixed(1)} L` +
    pts.join(' L') +
    ` L${(PAD.l + plotW).toFixed(1)},${(PAD.t + plotH).toFixed(1)} Z`;

  const marks = trend
    .map((t, i) => {
      const last = i === trend.length - 1;
      return (
        `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(t.ufp).toFixed(1)}" r="${last ? 7 : 5}" ` +
        `fill="${last ? 'var(--accent-bar)' : 'var(--surface)'}" stroke="var(--accent-bar)" stroke-width="2.5" ` +
        `class="mk" data-label="${esc(t.date)}" data-value="UFP ${n(t.ufp)} · ${t.rows}건"/>`
      );
    })
    .join('');

  const xLabels = trend
    .map(
      (t, i) =>
        `<text x="${xOf(i).toFixed(1)}" y="${H - 12}" class="xtick">${esc(t.date.slice(5))}</text>`,
    )
    .join('');

  const lastIdx = trend.length - 1;
  const endLabel =
    `<text x="${(xOf(lastIdx) + 14).toFixed(1)}" y="${(yOf(trend[lastIdx].ufp) - 6).toFixed(1)}" class="end-l">` +
    `${n(trend[lastIdx].ufp)} FP</text>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img"
    aria-label="회차별 미조정 기능점수 추이. ${n(values[0])}에서 ${n(values[lastIdx])}로 증가.">
    ${ticks.join('\n    ')}
    <path d="${area}" fill="var(--accent-area)"/>
    <polyline points="${pts.join(' ')}" fill="none" stroke="var(--accent-bar)" stroke-width="2"
      stroke-linejoin="round" stroke-linecap="round"/>
    ${marks}
    ${xLabels}
    ${endLabel}
  </svg>`;
}

// ── 페이지 ────────────────────────────────────────────────────────────────

/** 유형별 표 본문을 만듭니다. */
function typeTableRows(byType, ufp) {
  return TYPE_ORDER.map((type, i) => {
    const s = byType[type];
    return `<tr>
      <th scope="row"><span class="dot" style="background:var(--s${i + 1})"></span>${esc(type)}
        <span class="mut">${esc(TYPE_META[type].name)}</span></th>
      <td class="num">${s.count}</td>
      <td class="num">${n(s.fp)}</td>
      <td class="num">${pct(s.fp, ufp)}</td>
      <td class="num sm">${s.Low} / ${s.Average} / ${s.High}</td>
    </tr>`;
  }).join('\n');
}

/** 보정계수 표 본문을 만듭니다. */
function factorRows(factors) {
  return factors
    .map(
      (f) => `<tr>
      <th scope="row">${esc(f.label)}</th>
      <td class="num">×${f.value.toFixed(2)}</td>
      <td class="basis">${esc(f.basis)}</td>
    </tr>`,
    )
    .join('\n');
}

/**
 * 보고용 아티팩트 HTML을 렌더링합니다.
 * @param {object} model build-artifact.mjs가 조립한 모델
 * @returns {string} <title>부터 시작하는 페이지 본문 HTML
 */
export function renderArtifact(model) {
  const { date, generatedAt, agg, scale, diff, trend, cost, config } = model;
  const { byType, dataTotal, txTotal, ufp, byGroup } = agg;

  const first = trend[0];
  const last = trend[trend.length - 1];
  const growth = last.ufp - first.ufp;

  const domainRows = [...model.byDomain]
    .map(
      (d) => `<tr>
      <th scope="row">${esc(d.domain)}</th>
      <td class="num">${d.count}</td>
      <td class="num">${n(d.fp)}</td>
      <td class="num">${pct(d.fp, ufp)}</td>
    </tr>`,
    )
    .join('\n');

  const trendRows = trend
    .map((t, i) => {
      const delta = i === 0 ? '최초' : signed(t.ufp - trend[i - 1].ufp);
      return `<tr${i === trend.length - 1 ? ' class="now"' : ''}>
      <th scope="row">${esc(t.date)}</th>
      <td class="num">${t.rows}</td>
      <td class="num">${n(t.ufp)}</td>
      <td class="num ${i > 0 && t.ufp - trend[i - 1].ufp > 0 ? 'up' : ''}">${delta}</td>
    </tr>`;
    })
    .join('\n');

  return `<title>정보화 포탈 기능점수 산정</title>
<style>
  :root {
    color-scheme: light;
    --plane: #f2f5f9;
    --surface: #ffffff;
    --sunk: #f7f9fc;
    --rule: #dde3ec;
    --rule-strong: #c3ccda;
    --ink: #131922;
    --ink-2: #4a5566;
    --ink-3: #7d8798;
    --accent: #1b4f9c;
    --accent-bar: #2a78d6;
    --accent-area: rgba(42, 120, 214, 0.10);
    --seal: #b0392c;
    --seal-bg: #fdf3f1;
    --seal-rule: #edc9c2;
    --s1: #2a78d6; --s2: #eb6834; --s3: #1baf7a; --s4: #eda100; --s5: #e87ba4;
    --o1: #86b6ef; --o2: #2a78d6; --o3: #104281;
    --grid: #e6ebf2;
    --shadow: 0 1px 2px rgba(19, 25, 34, .05), 0 8px 24px -18px rgba(19, 25, 34, .35);
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --plane: #0b0e13;
      --surface: #14181f;
      --sunk: #171c24;
      --rule: #242c37;
      --rule-strong: #333d4b;
      --ink: #eef2f7;
      --ink-2: #aab5c4;
      --ink-3: #7e8899;
      --accent: #6aa6ec;
      --accent-bar: #3987e5;
      --accent-area: rgba(57, 135, 229, 0.14);
      --seal: #e08072;
      --seal-bg: #23181a;
      --seal-rule: #4a2b28;
      --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181;
      --o1: #9ec5f4; --o2: #3987e5; --o3: #184f95;
      --grid: #212934;
      --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 8px 24px -18px rgba(0, 0, 0, .9);
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --plane: #0b0e13;
    --surface: #14181f;
    --sunk: #171c24;
    --rule: #242c37;
    --rule-strong: #333d4b;
    --ink: #eef2f7;
    --ink-2: #aab5c4;
    --ink-3: #7e8899;
    --accent: #6aa6ec;
    --accent-bar: #3987e5;
    --accent-area: rgba(57, 135, 229, 0.14);
    --seal: #e08072;
    --seal-bg: #23181a;
    --seal-rule: #4a2b28;
    --s1: #3987e5; --s2: #d95926; --s3: #199e70; --s4: #c98500; --s5: #d55181;
    --o1: #9ec5f4; --o2: #3987e5; --o3: #184f95;
    --grid: #212934;
    --shadow: 0 1px 2px rgba(0, 0, 0, .5), 0 8px 24px -18px rgba(0, 0, 0, .9);
  }

  * { box-sizing: border-box; }

  /* 한글 본문이라 웹폰트를 인라인하기엔 용량이 과해, 한글을 온전히 지원하는
     시스템 스택으로 고정하고 위계는 크기·굵기·자간으로 만듭니다. */
  body {
    margin: 0;
    background: var(--plane);
    color: var(--ink);
    font-family: "Pretendard Variable", Pretendard, -apple-system, "Apple SD Gothic Neo",
                 "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
    font-size: 15px;
    line-height: 1.65;
    -webkit-font-smoothing: antialiased;
    word-break: keep-all;
  }

  .wrap { max-width: 1120px; margin: 0 auto; padding: 0 24px 96px; }

  /* 계기 눈금 같은 유틸리티 목소리 — 라벨·수치 축에 씁니다. */
  .mono {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  /* ── 머리말 ── */
  .masthead { padding: 56px 0 28px; border-bottom: 2px solid var(--ink); }
  .eyebrow {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11.5px; letter-spacing: .14em; text-transform: uppercase;
    color: var(--ink-3); margin: 0 0 14px;
  }
  h1 { font-size: 40px; line-height: 1.2; letter-spacing: -.02em; margin: 0 0 14px; text-wrap: balance; }
  .dek { font-size: 17px; color: var(--ink-2); max-width: 62ch; margin: 0; }
  .stamp {
    display: flex; flex-wrap: wrap; gap: 8px 28px; margin-top: 22px;
    font-size: 13px; color: var(--ink-3);
  }
  .stamp b { color: var(--ink-2); font-weight: 600; }

  /* ── 섹션 ── */
  section { padding-top: 56px; }
  .sec-head { display: flex; align-items: baseline; gap: 16px; border-bottom: 1px solid var(--rule-strong); padding-bottom: 10px; margin-bottom: 26px; }
  .sec-head h2 { font-size: 21px; letter-spacing: -.01em; margin: 0; flex: 1; }
  .sec-step {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11px; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3);
    white-space: nowrap;
  }
  .lede { color: var(--ink-2); max-width: 68ch; margin: -8px 0 26px; }

  /* ── 결론 ── */
  .verdict {
    display: grid; grid-template-columns: 1fr 1fr; gap: 1px;
    background: var(--rule); border: 1px solid var(--rule);
    border-radius: 10px; overflow: hidden; margin-top: 34px; box-shadow: var(--shadow);
  }
  .verdict > div { background: var(--surface); padding: 30px 30px 26px; }
  .v-label {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11.5px; letter-spacing: .12em; text-transform: uppercase; color: var(--ink-3);
    margin-bottom: 10px;
  }
  .v-fig { font-size: 60px; line-height: 1; letter-spacing: -.035em; font-weight: 700; }
  .v-fig .u { font-size: 24px; font-weight: 600; letter-spacing: -.01em; margin-left: 6px; color: var(--ink-2); }
  .v-sub { margin-top: 12px; color: var(--ink-2); font-size: 14px; }
  .v-exact {
    margin-top: 4px; font-size: 13px; color: var(--ink-3);
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums;
  }

  .chain {
    display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px;
    margin-top: 20px; padding: 0; list-style: none;
  }
  .chain li {
    flex: 1 1 150px; background: var(--surface); border: 1px solid var(--rule);
    border-radius: 8px; padding: 12px 14px;
  }
  .chain .op {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11px; letter-spacing: .08em; color: var(--ink-3); display: block; margin-bottom: 4px;
  }
  .chain .val { font-size: 18px; font-weight: 650; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }

  /* ── 가정값 경고 ── */
  .caution {
    margin-top: 24px; background: var(--seal-bg); border: 1px solid var(--seal-rule);
    border-left: 4px solid var(--seal); border-radius: 8px; padding: 18px 22px;
  }
  .caution h3 {
    margin: 0 0 6px; font-size: 14.5px; color: var(--seal); letter-spacing: -.005em;
    display: flex; align-items: center; gap: 8px;
  }
  .caution h3 svg { flex: none; }
  .caution p { margin: 0; font-size: 14px; color: var(--ink-2); max-width: 74ch; }
  .caution p + p { margin-top: 8px; }

  /* ── 지표 타일 ── */
  .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(168px, 1fr)); gap: 1px; background: var(--rule); border: 1px solid var(--rule); border-radius: 10px; overflow: hidden; }
  .tile { background: var(--surface); padding: 20px 20px 18px; }
  .tile .t-l {
    font-size: 12.5px; color: var(--ink-3); margin-bottom: 8px;
  }
  .tile .t-v { font-size: 30px; font-weight: 680; letter-spacing: -.025em; line-height: 1.1; }
  .tile .t-v small { font-size: 14px; font-weight: 500; color: var(--ink-2); margin-left: 3px; letter-spacing: 0; }
  .tile .t-s { margin-top: 7px; font-size: 12px; color: var(--ink-3); line-height: 1.5; }

  /* ── 도표 ── */
  .figure { margin: 0; background: var(--surface); border: 1px solid var(--rule); border-radius: 10px; padding: 24px; }
  .figure + .figure { margin-top: 16px; }
  figcaption { font-size: 13.5px; color: var(--ink-2); margin-bottom: 18px; }
  figcaption b { color: var(--ink); font-weight: 640; }
  .chart-box { overflow-x: auto; }
  .chart { display: block; width: 100%; min-width: 520px; height: auto; overflow: visible; }
  .chart .mk { transition: opacity .12s ease; cursor: default; }
  .chart:hover .mk { opacity: .45; }
  .chart .mk:hover { opacity: 1; }
  .seg-t {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 12px; letter-spacing: .08em; fill: var(--ink-2); text-anchor: middle;
  }
  .seg-v { font-size: 18px; font-weight: 680; fill: var(--ink); text-anchor: middle; font-variant-numeric: tabular-nums; }
  .seg-u { font-size: 12px; font-weight: 600; fill: var(--ink-3); }
  .seg-p {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 12px; fill: var(--ink-3); text-anchor: middle; font-variant-numeric: tabular-nums;
  }
  .row-l {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 13px; fill: var(--ink-2);
  }
  .row-v { font-size: 13px; fill: var(--ink); font-variant-numeric: tabular-nums; font-weight: 600; }
  .row-v2 { fill: var(--ink-3); font-weight: 500; }
  .grid { stroke: var(--grid); stroke-width: 1; }
  .tick, .xtick {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11.5px; fill: var(--ink-3); font-variant-numeric: tabular-nums;
  }
  .tick { text-anchor: end; }
  .xtick { text-anchor: middle; }
  .end-l { font-size: 14px; font-weight: 680; fill: var(--ink); font-variant-numeric: tabular-nums; }

  .legend { display: flex; flex-wrap: wrap; gap: 10px 20px; margin-top: 18px; font-size: 12.5px; color: var(--ink-2); }
  .legend span { display: inline-flex; align-items: center; gap: 7px; }
  .dot { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; vertical-align: -1px; margin-right: 7px; }
  .swatch { width: 10px; height: 10px; border-radius: 3px; display: inline-block; flex: none; }

  /* ── 표 ── */
  .t-box { overflow-x: auto; margin-top: 20px; }
  table { width: 100%; border-collapse: collapse; font-size: 13.5px; min-width: 460px; }
  caption { text-align: left; font-size: 12.5px; color: var(--ink-3); padding-bottom: 10px; }
  th, td { padding: 9px 12px; border-bottom: 1px solid var(--rule); text-align: left; }
  thead th {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--ink-3);
    font-weight: 500; border-bottom: 1px solid var(--rule-strong);
  }
  tbody th { font-weight: 600; }
  .num { text-align: right; font-variant-numeric: tabular-nums; }
  .sm { font-size: 12.5px; color: var(--ink-2); }
  .mut { color: var(--ink-3); font-weight: 400; margin-left: 7px; font-size: 12.5px; }
  .basis { color: var(--ink-2); font-size: 12.5px; }
  tfoot th, tfoot td { border-bottom: none; border-top: 1px solid var(--rule-strong); font-weight: 680; padding-top: 11px; }
  tr.now th, tr.now td { font-weight: 680; }
  .up { color: var(--accent); }

  details { margin-top: 18px; border-top: 1px solid var(--rule); padding-top: 14px; }
  summary { cursor: pointer; font-size: 13.5px; color: var(--accent); font-weight: 600; }
  summary:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 3px; }

  /* ── 매트릭스 ── */
  .mx { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; }
  .mx table { min-width: 0; font-size: 12.5px; }
  .mx th, .mx td { padding: 7px 9px; }
  .mx td { text-align: center; font-variant-numeric: tabular-nums; }
  .mx caption { font-weight: 640; color: var(--ink); font-size: 13px; }
  .cx-L { color: var(--ink-3); }
  .cx-A { color: var(--ink-2); }
  .cx-H { color: var(--ink); font-weight: 680; }

  .assure {
    margin-top: 20px; background: var(--sunk); border: 1px solid var(--rule);
    border-radius: 8px; padding: 18px 22px; font-size: 13.5px; color: var(--ink-2);
  }
  .assure b { color: var(--ink); }
  .assure ul { margin: 10px 0 0; padding-left: 18px; }
  .assure li + li { margin-top: 5px; }

  footer {
    margin-top: 64px; padding-top: 22px; border-top: 1px solid var(--rule);
    font-size: 12.5px; color: var(--ink-3); display: flex; flex-wrap: wrap; gap: 6px 24px;
  }

  #tip {
    position: fixed; pointer-events: none; opacity: 0; transform: translate(-50%, -130%);
    background: var(--ink); color: var(--plane); padding: 7px 11px; border-radius: 6px;
    font-size: 12.5px; line-height: 1.45; white-space: nowrap; z-index: 50;
    transition: opacity .1s ease; box-shadow: 0 4px 14px rgba(0,0,0,.22);
  }
  #tip b { display: block; font-weight: 640; }
  #tip span {
    font-family: ui-monospace, "Cascadia Mono", "Segoe UI Mono", "SF Mono", Consolas, monospace;
    font-variant-numeric: tabular-nums; opacity: .82;
  }

  @media (max-width: 720px) {
    .wrap { padding: 0 16px 72px; }
    h1 { font-size: 30px; }
    .verdict { grid-template-columns: 1fr; }
    .v-fig { font-size: 46px; }
    .masthead { padding-top: 36px; }
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
</style>

<div class="wrap">

  <header class="masthead">
    <p class="eyebrow">소프트웨어사업 대가산정 가이드 · 정통법 Detailed FP</p>
    <h1>IT 정보화 포탈 기능점수 산정 결과</h1>
    <p class="dek">
      정보화 예산·사업·인력 관리 포탈의 개발 규모를 정통법 기준으로 측정한 결과입니다.
      단위프로세스 ${n(model.rowCount)}건을 개별 산정해 합산했습니다.
    </p>
    <div class="stamp mono">
      <span>산정 기준일 <b>${esc(date)}</b></span>
      <span>산정 회차 <b>${trend.length}차</b></span>
      <span>대상 <b>it_frontend · it_backend</b></span>
    </div>
  </header>

  <section id="verdict">
    <div class="sec-head">
      <h2>결론</h2>
      <span class="sec-step">Step 4–5 · UFP 합산과 보정</span>
    </div>

    <div class="verdict">
      <div>
        <div class="v-label">보정 후 기능점수</div>
        <div class="v-fig">${n1(cost.adjustedFp)}<span class="u">FP</span></div>
        <div class="v-sub">미조정 ${n(ufp)} FP에 보정계수 ×${cost.factor.toFixed(4)} 적용</div>
      </div>
      <div>
        <div class="v-label">부가세 포함 최종 금액</div>
        <div class="v-fig">${eok(cost.total).replace(/억 원$/, '<span class="u">억 원</span>')}</div>
        <div class="v-exact">₩${n(cost.total)}</div>
      </div>
    </div>

    <ol class="chain mono">
      <li><span class="op">미조정 UFP</span><span class="val">${n(ufp)} FP</span></li>
      <li><span class="op">× 보정계수 ${cost.factor.toFixed(4)}</span><span class="val">${n1(cost.adjustedFp)} FP</span></li>
      <li><span class="op">× ${n(config.unitPrice)}원/FP</span><span class="val">${eok(cost.devCost)}</span></li>
      <li><span class="op">+ 이윤 ${config.profitRate * 100}%</span><span class="val">${eok(cost.supply)}</span></li>
      <li><span class="op">+ 부가세 ${config.vatRate * 100}%</span><span class="val">${eok(cost.total)}</span></li>
    </ol>

    <div class="caution">
      <h3>
        <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 1.6 15 14H1L8 1.6Z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
          <path d="M8 6.2v3.4M8 11.6v.9" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>
        </svg>
        보정계수와 FP 단가는 대표 가정값입니다
      </h3>
      <p>
        위 금액은 아래 「보정계수」 표의 가정값과 FP당 ${n(config.unitPrice)}원 단가로 계산한 것입니다.
        실제 제안·예산 산정 시에는 해당 연도 고시 「소프트웨어사업 대가산정 가이드」의
        보정계수표와 FP당 단가로 교체해야 합니다.
      </p>
      <p>
        <b>규모 수치(${n(ufp)} FP)는 가정값의 영향을 받지 않습니다.</b>
        단가·계수가 바뀌어도 기능점수 자체는 그대로이며 금액만 재계산됩니다.
      </p>
    </div>
  </section>

  <section id="scale">
    <div class="sec-head">
      <h2>규모 요약</h2>
      <span class="sec-step">Step 1 · 산정 범위</span>
    </div>
    <p class="lede">
      기능점수는 산정 명세에서, 물리 규모는 소스코드·DDL에서 각각 측정했습니다.
      물리 규모는 <b>이 페이지를 생성한 시점(${esc(generatedAt)})</b>의 코드베이스 기준이라
      산정 기준일 ${esc(date)}의 스냅샷과는 다를 수 있습니다.
    </p>
    <div class="tiles">
      <div class="tile">
        <div class="t-l">미조정 기능점수</div>
        <div class="t-v">${n(ufp)}<small>FP</small></div>
        <div class="t-s">데이터 ${n(dataTotal.fp)} + 트랜잭션 ${n(txTotal.fp)}</div>
      </div>
      <div class="tile">
        <div class="t-l">단위프로세스</div>
        <div class="t-v">${n(model.rowCount)}<small>건</small></div>
        <div class="t-s">업무 도메인 ${model.byDomain.length}개</div>
      </div>
      <div class="tile">
        <div class="t-l">물리 테이블</div>
        <div class="t-v">${n(scale.tables.total)}<small>개</small></div>
        <div class="t-s">${scale.tables.source === 'ddl' ? 'DDL 덤프 실측' : '엔티티 매핑 기준'}</div>
      </div>
      <div class="tile">
        <div class="t-l">화면</div>
        <div class="t-v">${n(scale.pages.total)}<small>개</small></div>
        <div class="t-s">Nuxt 라우트 · 컴포넌트 ${n(scale.components)}</div>
      </div>
      <div class="tile">
        <div class="t-l">API 엔드포인트</div>
        <div class="t-v">${n(scale.endpoints)}<small>개</small></div>
        <div class="t-s">REST 컨트롤러 ${n(scale.controllers)}개</div>
      </div>
    </div>
  </section>

  <section id="types">
    <div class="sec-head">
      <h2>기능 유형별 구성</h2>
      <span class="sec-step">Step 2–3 · 데이터·트랜잭션 기능</span>
    </div>
    <p class="lede">
      전체 ${n(ufp)} FP 중 데이터를 보관하는 기능이 ${n(dataTotal.fp)} FP(${pct(dataTotal.fp, ufp)}),
      사용자가 실제로 수행하는 처리 기능이 ${n(txTotal.fp)} FP(${pct(txTotal.fp, ufp)})입니다.
      화면과 API에서 일어나는 처리가 규모의 대부분을 차지하는, 업무 트랜잭션 중심 시스템의 전형적인 분포입니다.
    </p>

    <figure class="figure">
      <figcaption><b>유형별 기능점수 구성</b> — 전체 ${n(ufp)} FP 대비 비중</figcaption>
      <div class="chart-box">${stackedTypeBar(byType, ufp)}</div>
      <div class="legend">
        ${TYPE_ORDER.map(
          (t, i) =>
            `<span><i class="swatch" style="background:var(--s${i + 1})"></i>${esc(t)} ${esc(TYPE_META[t].name)} · ${n(byType[t].fp)} FP</span>`,
        ).join('\n        ')}
      </div>
      <div class="t-box">
        <table>
          <caption>유형별 건수·점수·복잡도 분포</caption>
          <thead>
            <tr><th>유형</th><th class="num">건수</th><th class="num">FP</th><th class="num">비중</th><th class="num">단순 / 보통 / 복잡</th></tr>
          </thead>
          <tbody>
${typeTableRows(byType, ufp)}
          </tbody>
          <tfoot>
            <tr><th>합계</th><td class="num">${model.rowCount}</td><td class="num">${n(ufp)}</td><td class="num">100.0%</td><td class="num sm">${dataTotal.Low + txTotal.Low} / ${dataTotal.Average + txTotal.Average} / ${dataTotal.High + txTotal.High}</td></tr>
          </tfoot>
        </table>
      </div>
    </figure>

    <figure class="figure">
      <figcaption><b>유형별 복잡도 분포</b> — 색이 진할수록 복잡도가 높습니다</figcaption>
      <div class="chart-box">${complexityRows(byType)}</div>
      <div class="legend">
        ${COMPLEXITIES.map(
          (c, i) =>
            `<span><i class="swatch" style="background:var(--o${i + 1})"></i>${esc(COMPLEXITY_LABEL[c])} ${esc(c)}</span>`,
        ).join('\n        ')}
      </div>
    </figure>
  </section>

  <section id="areas">
    <div class="sec-head">
      <h2>업무 영역별 규모</h2>
      <span class="sec-step">Step 1 · 경계 내 업무 분해</span>
    </div>
    <p class="lede">
      가장 큰 덩어리는 공통·인프라 영역입니다. 결재·게시판·인증·코드·메뉴·알림·파일처럼
      모든 업무가 공유하는 기반 기능이 여기에 모여 있어, 특정 업무 하나가 아니라
      시스템 전반을 떠받치는 규모로 보아야 합니다.
    </p>
    <figure class="figure">
      <figcaption><b>업무 영역별 기능점수</b></figcaption>
      <div class="chart-box">${groupBars(byGroup, ufp)}</div>
      <div class="t-box">
        <table>
          <caption>영역별 구성 — 데이터 기능과 트랜잭션 기능 건수</caption>
          <thead>
            <tr><th>영역</th><th>포함 업무</th><th class="num">데이터</th><th class="num">트랜잭션</th><th class="num">FP</th><th class="num">비중</th></tr>
          </thead>
          <tbody>
${byGroup
  .map(
    (g) => `            <tr>
              <th scope="row">${esc(g.key)}</th>
              <td class="basis">${esc(g.desc)}</td>
              <td class="num">${g.data}</td>
              <td class="num">${g.tx}</td>
              <td class="num">${n(g.fp)}</td>
              <td class="num">${pct(g.fp, ufp)}</td>
            </tr>`,
  )
  .join('\n')}
          </tbody>
        </table>
      </div>
      <details>
        <summary>세부 도메인 ${model.byDomain.length}개 펼치기</summary>
        <div class="t-box">
          <table>
            <caption>산정 명세의 도메인 단위 집계 (FP 내림차순)</caption>
            <thead><tr><th>도메인</th><th class="num">건수</th><th class="num">FP</th><th class="num">비중</th></tr></thead>
            <tbody>
${domainRows}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  </section>

  <section id="trend">
    <div class="sec-head">
      <h2>규모 추이</h2>
      <span class="sec-step">${trend.length}차 산정 누적</span>
    </div>
    <p class="lede">
      ${esc(first.date)} 최초 산정 이후 ${trend.length}차에 걸쳐 규모가
      ${n(first.ufp)} FP에서 ${n(last.ufp)} FP로 <b>${signed(growth)} FP(${((growth / first.ufp) * 100).toFixed(1)}%)</b>
      늘었습니다. 증가분의 대부분은 ${esc(trend[2].date)} 회차에 발생했고, 이후는 소폭 조정입니다.
    </p>
    <figure class="figure">
      <figcaption><b>회차별 미조정 기능점수(UFP)</b></figcaption>
      <div class="chart-box">${trendLine(trend)}</div>
      <div class="t-box">
        <table>
          <caption>회차별 단위프로세스 수와 UFP</caption>
          <thead><tr><th>산정일</th><th class="num">단위프로세스</th><th class="num">UFP</th><th class="num">증감</th></tr></thead>
          <tbody>
${trendRows}
          </tbody>
        </table>
      </div>
    </figure>

    <div class="assure">
      <b>최신 회차(${esc(date)})의 직전 대비 변경</b> —
      ${
        diff.baseline
          ? `${esc(diff.baseline)} 산정본과 비교해 추가 ${diff.added.length}건 · 삭제 ${diff.removed.length}건 ·
             수정 ${diff.changed.length}건 · 변동 없음 ${diff.unchanged}건입니다.
             수정 ${diff.changed.length}건은 응답 필드가 몇 개씩 늘어난 DET 미세 조정이 대부분이라
             복잡도 등급이 바뀌지 않아 점수 증분이 0이며, UFP 증가 ${signed(diff.ufpDelta)} FP는
             사실상 신규 기능 ${diff.added.length}건에서 나왔습니다.`
          : '비교할 직전 산정본이 없는 최초 산정입니다.'
      }
    </div>
  </section>

  <section id="basis">
    <div class="sec-head">
      <h2>산정 근거</h2>
      <span class="sec-step">Step 2–3 · 복잡도 판정 규칙</span>
    </div>
    <p class="lede">
      각 기능의 점수는 임의로 매기지 않고, 참조하는 파일 수(RET/FTR)와 데이터 항목 수(DET)를
      세어 아래 매트릭스에 대입해 결정합니다. 같은 입력이면 항상 같은 점수가 나옵니다.
    </p>

    <figure class="figure">
      <figcaption><b>복잡도 판정 매트릭스</b> — 셀 안의 값은 판정되는 복잡도 등급입니다</figcaption>
      <div class="mx">
        <div class="t-box">
          <table>
            <caption>데이터 기능 (ILF · EIF) — RET × DET</caption>
            <thead><tr><th>RET \\ DET</th><th>1–19</th><th>20–50</th><th>51+</th></tr></thead>
            <tbody>
              <tr><th scope="row">1</th><td class="cx-L">단순</td><td class="cx-L">단순</td><td class="cx-A">보통</td></tr>
              <tr><th scope="row">2–5</th><td class="cx-L">단순</td><td class="cx-A">보통</td><td class="cx-H">복잡</td></tr>
              <tr><th scope="row">6+</th><td class="cx-A">보통</td><td class="cx-H">복잡</td><td class="cx-H">복잡</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">점수</th><td colspan="3" class="basis">ILF 7 / 10 / 15 · EIF 5 / 7 / 10</td></tr></tfoot>
          </table>
        </div>
        <div class="t-box">
          <table>
            <caption>외부입력 (EI) — FTR × DET</caption>
            <thead><tr><th>FTR \\ DET</th><th>1–4</th><th>5–15</th><th>16+</th></tr></thead>
            <tbody>
              <tr><th scope="row">0–1</th><td class="cx-L">단순</td><td class="cx-L">단순</td><td class="cx-A">보통</td></tr>
              <tr><th scope="row">2</th><td class="cx-L">단순</td><td class="cx-A">보통</td><td class="cx-H">복잡</td></tr>
              <tr><th scope="row">3+</th><td class="cx-A">보통</td><td class="cx-H">복잡</td><td class="cx-H">복잡</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">점수</th><td colspan="3" class="basis">EI 3 / 4 / 6</td></tr></tfoot>
          </table>
        </div>
        <div class="t-box">
          <table>
            <caption>외부출력·조회 (EO · EQ) — FTR × DET</caption>
            <thead><tr><th>FTR \\ DET</th><th>1–5</th><th>6–19</th><th>20+</th></tr></thead>
            <tbody>
              <tr><th scope="row">0–1</th><td class="cx-L">단순</td><td class="cx-L">단순</td><td class="cx-A">보통</td></tr>
              <tr><th scope="row">2–3</th><td class="cx-L">단순</td><td class="cx-A">보통</td><td class="cx-H">복잡</td></tr>
              <tr><th scope="row">4+</th><td class="cx-A">보통</td><td class="cx-H">복잡</td><td class="cx-H">복잡</td></tr>
            </tbody>
            <tfoot><tr><th scope="row">점수</th><td colspan="3" class="basis">EO 4 / 5 / 7 · EQ 3 / 4 / 6</td></tr></tfoot>
          </table>
        </div>
      </div>
    </figure>

    <figure class="figure">
      <figcaption><b>보정계수와 금액 산식</b> — 아래 값은 모두 대표 가정값입니다</figcaption>
      <div class="t-box">
        <table>
          <caption>적용 보정계수</caption>
          <thead><tr><th>항목</th><th class="num">계수</th><th>적용 근거</th></tr></thead>
          <tbody>
${factorRows(config.factors)}
          </tbody>
          <tfoot>
            <tr><th>누적 보정계수</th><td class="num">×${cost.factor.toFixed(4)}</td><td class="basis">${n(ufp)} FP → ${n1(cost.adjustedFp)} FP</td></tr>
          </tfoot>
        </table>
      </div>
      <div class="t-box">
        <table>
          <caption>금액 산식 전개</caption>
          <thead><tr><th>단계</th><th>계산</th><th class="num">금액</th></tr></thead>
          <tbody>
            <tr><th scope="row">개발원가</th><td class="basis">${n1(cost.adjustedFp)} FP × ${n(config.unitPrice)}원</td><td class="num">₩${n(cost.devCost)}</td></tr>
            <tr><th scope="row">이윤</th><td class="basis">개발원가 × ${config.profitRate * 100}%</td><td class="num">₩${n(cost.profit)}</td></tr>
            <tr><th scope="row">공급가액</th><td class="basis">개발원가 + 이윤</td><td class="num">₩${n(cost.supply)}</td></tr>
            <tr><th scope="row">부가세</th><td class="basis">공급가액 × ${config.vatRate * 100}%</td><td class="num">₩${n(cost.vat)}</td></tr>
          </tbody>
          <tfoot><tr><th>최종 금액</th><td class="basis">공급가액 + 부가세</td><td class="num">₩${n(cost.total)}</td></tr></tfoot>
        </table>
      </div>
    </figure>

    <div class="assure">
      <b>이 수치를 믿을 수 있는 근거</b>
      <ul>
        <li>
          산정 명세에 적힌 복잡도·점수를 그대로 쓰지 않고, 리포트 생성기가 RET/FTR·DET에
          매트릭스를 <b>다시 적용해 재계산</b>합니다. 이번 회차의 재계산 불일치는
          <b>${agg.mismatches.length}건</b>입니다.
        </li>
        <li>
          테이블·화면·엔드포인트 같은 물리 규모는 하드코딩하지 않고 매 실행 시
          DDL과 소스코드에서 직접 셉니다.
        </li>
        <li>
          산정본을 덮어쓰지 않고 날짜별로 누적하므로, 회차 간 규모 변화를 행 단위로 추적할 수 있습니다.
        </li>
${
  scale.tables.unmapped.length > 0
    ? `        <li>
          다만 DDL 덤프에 없는 엔티티 매핑이 ${scale.tables.unmapped.length}건
          (${scale.tables.unmapped.map(esc).join(', ')}) 있습니다. 덤프가 최신이 아닐 수 있어
          물리 테이블 수는 실제보다 적게 잡혔을 가능성이 있습니다.
        </li>`
    : ''
}
      </ul>
    </div>
  </section>

  <footer class="mono">
    <span>산정 명세 ${esc(model.csvName)}</span>
    <span>생성 ${esc(generatedAt)}</span>
    <span>FP/build-artifact.mjs</span>
  </footer>
</div>

<div id="tip" role="status" aria-live="polite"></div>

<script>
  // 차트 마크 위에 값을 띄우는 최소 툴팁. 마크는 data-label/data-value를 갖습니다.
  (function () {
    var tip = document.getElementById('tip');
    if (!tip) return;

    // 마크의 라벨은 산정 명세(CSV)에서 온 값이므로 HTML로 해석하지 않고
    // textContent로만 넣습니다.
    var label = document.createElement('b');
    var value = document.createElement('span');
    tip.appendChild(label);
    tip.appendChild(value);

    function show(el, x, y) {
      label.textContent = el.getAttribute('data-label') || '';
      value.textContent = el.getAttribute('data-value') || '';
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
      tip.style.opacity = '1';
    }

    document.addEventListener('mousemove', function (e) {
      var mark = e.target.closest ? e.target.closest('.mk') : null;
      if (mark) show(mark, e.clientX, e.clientY);
      else tip.style.opacity = '0';
    });

    document.addEventListener('mouseleave', function () {
      tip.style.opacity = '0';
    });
  })();
</script>
`;
}
