// matrix-mult 활동 — 2×2 행렬 곱의 곱셈 8번 → 스트라센 7번
// 성취기준 해설(PDF 16쪽)에 따라 계산 활동은 2×2로 한정. 4×4·5×5는 [AI와 비교]에서 이야기로만.
// 식은 KaTeX 대신 유니코드 첨자(a₁₁)로 써서 바뀔 때마다 바로 다시 그림
import {
  A_NAMES, B_NAMES, STRASSEN, ENTRIES, ENTRY_NAMES, TARGET_TERMS, W_A, W_B, WARMUP, WARMUP_TARGETS, ANSWER,
  expandBlock, combine, tableFromTerms, sameTable, termsOf, cancelledTerms,
  blockText, termsText, comboText, sub, usedBlocks, countAdds, matMul, blockValue, comboValue,
} from './algebra.js';

const IDS = STRASSEN.map((b) => b.id);
const WIDS = WARMUP.map((b) => b.id);
const DEFAULT_A = [[1, 2], [3, 4]];
const DEFAULT_B = [[5, 6], [7, 8]];

const S = {
  A: DEFAULT_A, B: DEFAULT_B, direct: [null, null, null, null],
  warmup: { w1: [0, 0, 0], w2: [0, 0, 0] },
  mode: 'guided',
  coefs: Object.fromEntries(ENTRIES.map((e) => [e, Array(7).fill(0)])),
};
const R = {}; // 화면 요소
let notify = () => {};

function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
  return e;
}

const okInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const okMat = (M) => Array.isArray(M) && M.length === 2 && M.every((r) => Array.isArray(r) && r.length === 2 && r.every((v) => okInt(v, -9, 9)));
const okCoefs = (cs, len) => Array.isArray(cs) && cs.length === len && cs.every((c) => c === -1 || c === 0 || c === 1);
const support = (e) => ANSWER[e].map((c) => c !== 0); // 안내 모드에서 열리는 블록

// ---------- 표준 함수 ----------

export function init(container, meta, data, ctx) {
  notify = ctx?.onChange ?? (() => {});
  restore(ctx?.saved);

  container.append(
    h('div', { class: 'card' },
      h('p', {}, '행렬 $A$와 $B$의 곱 $AB$를 구할 때 ', h('strong', {}, '곱셈을 몇 번'), ' 하는지 세어 봅시다. 덧셈·뺄셈보다 곱셈이 더 오래 걸린다고 생각하고, 곱셈을 줄이는 방법을 찾아봅니다.')),
    cardDirect(),
    cardWarmup(),
    cardStrassen(),
    cardCheck());
  refresh(false);
}

export function getResultData() {
  return {
    A: S.A.map((r) => [...r]), B: S.B.map((r) => [...r]), direct: [...S.direct],
    warmup: { w1: [...S.warmup.w1], w2: [...S.warmup.w2] },
    mode: S.mode,
    coefs: Object.fromEntries(ENTRIES.map((e) => [e, [...S.coefs[e]]])),
  };
}

function restore(saved) {
  if (!saved || typeof saved !== 'object') return;
  if (okMat(saved.A) && okMat(saved.B)) { S.A = saved.A; S.B = saved.B; }
  if (Array.isArray(saved.direct) && saved.direct.length === 4) S.direct = saved.direct.map((v) => (Number.isInteger(v) ? v : null));
  for (const k of ['w1', 'w2']) if (okCoefs(saved.warmup?.[k], 3)) S.warmup[k] = [...saved.warmup[k]];
  if (saved.mode === 'free' || saved.mode === 'guided') S.mode = saved.mode;
  for (const e of ENTRIES) if (okCoefs(saved.coefs?.[e], 7)) S.coefs[e] = [...saved.coefs[e]];
}

// ---------- 1. 정의대로 곱하기 ----------

function matrixBox(M, label) {
  return h('div', { class: 'mm-mat-wrap' },
    label ? h('span', { class: 'mm-mat-label' }, label, ' =') : null,
    h('table', { class: 'mm-mat', 'aria-label': `${label ?? ''} 행렬` },
      h('tbody', {}, M.map((row) => h('tr', {}, row.map((v) => h('td', {}, v)))))));
}

function cardDirect() {
  R.mats = h('div', { class: 'mm-row' });
  R.direct = [0, 1, 2, 3].map((i) => h('input', {
    type: 'number', inputmode: 'numeric', class: 'mm-in', id: `mm-d${i}`, 'aria-label': `AB의 ${ENTRY_NAMES[ENTRIES[i]]} 성분`,
    oninput: (e) => { const v = e.target.value.trim(); S.direct[i] = v === '' || !Number.isFinite(Number(v)) ? null : Math.trunc(Number(v)); refresh(); },
  }));
  R.directMsg = h('div', { 'aria-live': 'polite' });
  return h('div', { class: 'card' },
    h('h2', {}, '1. 정의대로 곱하기'),
    R.mats,
    h('div', { class: 'mm-row' },
      h('span', { class: 'mm-mat-label' }, 'AB ='),
      h('div', { class: 'mm-grid2' }, R.direct)),
    h('div', { class: 'btn-row' },
      h('button', { type: 'button', class: 'btn ghost', onclick: newNumbers }, '다른 숫자로 바꾸기')),
    R.directMsg);
}

function newNumbers() {
  const r = () => Math.floor(Math.random() * 13) - 3; // -3 ~ 9
  S.A = [[r(), r()], [r(), r()]];
  S.B = [[r(), r()], [r(), r()]];
  S.direct = [null, null, null, null];
  R.direct.forEach((inp) => (inp.value = ''));
  refresh();
}

function renderDirect() {
  R.mats.replaceChildren(matrixBox(S.A, 'A'), matrixBox(S.B, 'B'));
  R.direct.forEach((inp, i) => { if (document.activeElement !== inp) inp.value = S.direct[i] ?? ''; });
  const AB = matMul(S.A, S.B).flat();
  const filled = S.direct.filter((v) => v !== null).length;
  const right = S.direct.map((v, i) => v === AB[i]);
  R.direct.forEach((inp, i) => inp.classList.toggle('mm-wrong', S.direct[i] !== null && !right[i]));
  if (filled < 4) { R.directMsg.replaceChildren(h('p', { class: 'muted small' }, `네 칸을 모두 채우면 확인합니다. (${filled}/4)`)); return; }
  if (!right.every(Boolean)) {
    R.directMsg.replaceChildren(h('p', { class: 'error' }, `틀린 칸이 ${right.filter((x) => !x).length}개 있습니다 (빨간 테두리). (1행)×(1열)처럼 행과 열을 짝지어 곱해 더합니다.`));
    return;
  }
  R.directMsg.replaceChildren(
    h('p', { class: 'ok' }, '정답입니다! 이제 곱셈 횟수를 세어 봅시다.'),
    h('ul', { class: 'mm-terms' }, ENTRIES.map((e) => h('li', {}, `${ENTRY_NAMES[e]} = ${termsText(TARGET_TERMS[e])}`))),
    h('p', {}, h('strong', {}, '곱셈 8번, 덧셈 4번'), ' — 성분 하나에 곱셈 2번, 덧셈 1번씩입니다. 곱셈을 7번으로 줄일 수 있을까요?'));
}

// ---------- 2. 워밍업 ----------

function coefSelect(value, label, onchange) {
  const s = h('select', { class: 'mm-coef', 'aria-label': label, onchange: (e) => onchange(Number(e.target.value)) },
    h('option', { value: '0' }, '·'), h('option', { value: '1' }, '+'), h('option', { value: '-1' }, '−'));
  s.value = String(value);
  return s;
}

function cardWarmup() {
  R.wRows = {};
  const blocks = h('ul', { class: 'mm-blocks' }, WARMUP.map((b) => {
    const f = blockText(b, W_A, W_B), x = termsText(termsOf(expandBlock(b)), W_A, W_B);
    return h('li', {}, h('strong', {}, sub(b.id)), f === x ? ` = ${f}` : ` = ${f} = ${x}`);
  }));
  const rows = Object.entries(WARMUP_TARGETS).map(([k, t]) => {
    const sels = WARMUP.map((b, i) => coefSelect(S.warmup[k][i], `${t.label} 만들기: ${b.id} 앞의 부호`, (v) => { S.warmup[k][i] = v; refresh(); }));
    const out = h('div', { class: 'mm-out', 'aria-live': 'polite' });
    R.wRows[k] = { sels, out };
    return h('div', { class: 'mm-entry' },
      h('div', { class: 'mm-entry-head' }, h('strong', {}, t.label), ' 만들기'),
      h('div', { class: 'mm-sels' }, sels.map((s, i) => h('label', { class: 'mm-sel' }, s, h('span', {}, sub(WIDS[i]))))),
      out);
  });
  return h('div', { class: 'card' },
    h('h2', {}, '2. 워밍업: 곱 3개로 두 식 만들기'),
    h('p', {}, h('strong', {}, 'ac − bd'), '와 ', h('strong', {}, 'ad + bc'), '를 그냥 계산하면 곱셈이 4번(ac, bd, ad, bc) 필요합니다. 아래 곱 3개를 더하고 빼서 두 식을 모두 만들어 보세요. 각 곱 앞에 +, −, ·(안 씀)를 고릅니다.'),
    blocks, rows,
    R.wMsg = h('p', { class: 'muted small' }));
}

function renderWarmup() {
  let done = 0;
  for (const [k, t] of Object.entries(WARMUP_TARGETS)) {
    const cs = S.warmup[k];
    const ok = sameTable(combine(WARMUP, cs), tableFromTerms(t.terms, 2, 2));
    if (ok) done++;
    R.wRows[k].sels.forEach((s, i) => (s.value = String(cs[i])));
    R.wRows[k].out.replaceChildren(...resultLines(WARMUP, cs, WIDS, W_A, W_B, ok, t.label));
  }
  R.wMsg.textContent = done === 2
    ? '성공! 곱셈 3번으로 두 식을 모두 만들었습니다. 덧셈·뺄셈은 늘었지만 곱셈은 4번 → 3번. 스트라센도 같은 생각입니다.'
    : `두 식 중 ${done}개 완성`;
  R.wMsg.className = done === 2 ? 'ok' : 'muted small';
}

/** 조합 결과 줄: 식, 전개, 지워진 항, 판정 */
function resultLines(blocks, cs, ids, aN, bN, ok, targetText) {
  const t = combine(blocks, cs);
  const gone = cancelledTerms(blocks, cs);
  const lines = [
    h('div', {}, h('span', { class: 'mm-k' }, '조합'), comboText(cs, ids)),
    h('div', {}, h('span', { class: 'mm-k' }, '전개'), termsText(termsOf(t), aN, bN)),
  ];
  if (gone.length) lines.push(h('div', {}, h('span', { class: 'mm-k' }, '지워진 항'),
    ...gone.map(([i, j], n) => [n ? ', ' : '', h('s', {}, aN[i] + bN[j])])));
  if (cs.some(Boolean)) lines.push(ok
    ? h('div', { class: 'ok' }, `${targetText}와 같습니다`)
    : h('div', { class: 'error' }, `✖ 아직 ${targetText}와 다릅니다`));
  return lines;
}

// ---------- 3. 스트라센 블록 ----------

function cardStrassen() {
  R.mode = ['guided', 'free'].map((m) => h('input', {
    type: 'radio', name: 'mm-mode', value: m, id: `mm-mode-${m}`,
    onchange: () => { setMode(m); refresh(); },
  }));
  R.rows = {};
  const blocks = h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
    h('thead', {}, h('tr', {}, h('th', {}, '블록'), h('th', {}, '식'), h('th', {}, '전개하면'))),
    h('tbody', {}, STRASSEN.map((b) => h('tr', {},
      h('th', { scope: 'row' }, sub(b.id)), h('td', {}, blockText(b)), h('td', {}, termsText(termsOf(expandBlock(b)))))))));
  const entries = ENTRIES.map((e) => {
    const sels = STRASSEN.map((b, k) => coefSelect(S.coefs[e][k], `${ENTRY_NAMES[e]} 만들기: ${b.id} 앞의 부호`, (v) => { S.coefs[e][k] = v; refresh(); }));
    const out = h('div', { class: 'mm-out', 'aria-live': 'polite' });
    R.rows[e] = { sels, out };
    return h('div', { class: 'mm-entry', id: `mm-${e}` },
      h('div', { class: 'mm-entry-head' }, h('strong', {}, ENTRY_NAMES[e]), ` = ${termsText(TARGET_TERMS[e])} 만들기`),
      h('div', { class: 'mm-sels' }, sels.map((s, k) => h('label', { class: 'mm-sel' }, s, h('span', {}, sub(IDS[k]))))),
      out);
  });
  return h('div', { class: 'card' },
    h('h2', {}, '3. 스트라센의 블록 7개로 AB 만들기'),
    h('p', {}, '1969년 스트라센은 아래 7개의 곱(블록)을 만들었습니다. 블록마다 곱셈은 한 번뿐입니다. 블록을 더하고 빼서 네 성분 ', h('strong', {}, 'c₁₁, c₁₂, c₂₁, c₂₂'), '를 모두 만들면 곱셈 7번으로 AB를 구한 것입니다.'),
    blocks,
    h('fieldset', { class: 'mm-mode' }, h('legend', {}, '방법'),
      h('label', { for: 'mm-mode-guided' }, R.mode[0], ' 안내: 쓸 블록만 열려 있음 (부호만 정하기)'),
      h('label', { for: 'mm-mode-free' }, R.mode[1], ' 도전: 7개 블록 모두 열림 (직접 고르기)')),
    h('div', { class: 'mm-entries' }, entries),
    R.sMsg = h('div', { 'aria-live': 'polite' }));
}

function setMode(m) {
  S.mode = m;
  if (m === 'guided') for (const e of ENTRIES) S.coefs[e] = S.coefs[e].map((c, k) => (support(e)[k] ? c : 0));
}

function renderStrassen() {
  R.mode.forEach((r) => (r.checked = r.value === S.mode));
  let done = 0;
  for (const e of ENTRIES) {
    const cs = S.coefs[e];
    const ok = sameTable(combine(STRASSEN, cs), tableFromTerms(TARGET_TERMS[e], 4, 4));
    if (ok) done++;
    const sup = support(e);
    R.rows[e].sels.forEach((s, k) => {
      s.value = String(cs[k]);
      const locked = S.mode === 'guided' && !sup[k];
      s.disabled = locked;
      s.parentElement.classList.toggle('mm-locked', locked);
    });
    R.rows[e].out.replaceChildren(...resultLines(STRASSEN, cs, IDS, A_NAMES, B_NAMES, ok, ENTRY_NAMES[e]));
    R.rows[e].out.parentElement.classList.toggle('mm-done', ok);
  }
  const used = usedBlocks(S.coefs).filter(Boolean).length;
  const adds = countAdds(STRASSEN, S.coefs);
  R.sMsg.replaceChildren(
    h('p', { class: 'mm-count' }, h('strong', {}, `${done} / 4`), ' 성분 완성 · ', `곱셈 ${used}번 · 덧셈·뺄셈 ${adds.total}번 (블록 안 ${adds.inner} + 잇기 ${adds.outer})`),
    done === 4
      ? h('p', { class: 'ok' }, '성공! 곱셈 7번으로 AB를 구했습니다. 대신 덧셈·뺄셈은 4번 → 18번으로 늘었습니다. 그래도 이득일까요? (정리 질문 1)',
        S.mode === 'guided' ? ' 이번에는 [도전] 방법으로 블록을 직접 골라 보세요.' : '')
      : h('p', { class: 'muted small' }, '힌트: 목표에 없는 항이 남으면, 그 항을 반대 부호로 가진 블록을 찾아 더하거나 빼 보세요.'));
}

// ---------- 4. 내 숫자로 검산 ----------

function cardCheck() {
  R.check = h('div');
  return h('details', { class: 'card' },
    h('summary', {}, '4. 내 숫자로 검산하기 (1번의 A, B 사용)'),
    R.check);
}

function renderCheck() {
  const AB = matMul(S.A, S.B).flat();
  const vals = STRASSEN.map((b) => blockValue(b, S.A, S.B));
  R.check.replaceChildren(
    h('p', { class: 'muted small' }, '숫자를 넣어 같으면 맞을 가능성이 높지만, 우연히 같을 수도 있습니다. 그래서 채점은 숫자가 아니라 전개식으로 합니다.'),
    h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
      h('thead', {}, h('tr', {}, STRASSEN.map((b) => h('th', {}, sub(b.id))))),
      h('tbody', {}, h('tr', {}, vals.map((v) => h('td', { class: 'num' }, v)))))),
    h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
      h('thead', {}, h('tr', {}, h('th', {}, '성분'), h('th', { class: 'num' }, '내 조합의 값'), h('th', { class: 'num' }, '정의대로 (AB)'), h('th', {}, ''))),
      h('tbody', {}, ENTRIES.map((e, i) => {
        const v = comboValue(S.coefs[e], S.A, S.B);
        return h('tr', {}, h('th', { scope: 'row' }, ENTRY_NAMES[e]), h('td', { class: 'num' }, v), h('td', { class: 'num' }, AB[i]),
          h('td', {}, v === AB[i] ? '같음' : '다름'));
      })))));
}

function refresh(changed = true) {
  renderDirect();
  renderWarmup();
  renderStrassen();
  renderCheck();
  if (changed) notify();
}

// ---------- AI와 비교 ----------

export function renderAIComparison(container, payload, data) {
  const paper = data.paper;
  const coefs = payload.coefs;
  const ok = ENTRIES.filter((e) => sameTable(combine(STRASSEN, coefs[e]), tableFromTerms(TARGET_TERMS[e], 4, 4))).length;
  const used = usedBlocks(coefs).filter(Boolean).length;
  const adds = countAdds(STRASSEN, coefs).total;

  const powRows = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => {
    const N = 2 ** k, std = N ** 3, st = 7 ** k;
    return h('tr', {}, h('td', {}, `${N} × ${N}`), h('td', { class: 'num' }, std.toLocaleString('ko-KR')),
      h('td', { class: 'num' }, st.toLocaleString('ko-KR')), h('td', { class: 'num' }, `${Math.round((st / std) * 100)}%`));
  });

  container.append(
    h('div', { class: 'card' },
      h('h2', {}, '1. 세 가지 방법 비교 (2×2)'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '방법'), h('th', { class: 'num' }, '곱셈'), h('th', { class: 'num' }, '덧셈·뺄셈'))),
        h('tbody', {},
          h('tr', {}, h('td', {}, '정의대로'), h('td', { class: 'num' }, '8번'), h('td', { class: 'num' }, '4번')),
          h('tr', {}, h('td', {}, '스트라센 (1969)'), h('td', { class: 'num' }, '7번'), h('td', { class: 'num' }, '18번')),
          h('tr', {}, h('td', {}, `나의 조합 (${ok}/4 성분 완성)`), h('td', { class: 'num' }, `${used}번`), h('td', { class: 'num' }, `${adds}번`))))),
      h('p', {}, '2×2를 한 번만 계산하면 스트라센 방법은 전체 계산(곱셈 7 + 덧셈·뺄셈 18 = 25번)이 정의대로(8 + 4 = 12번)보다 오히려 많습니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '2. 그런데 왜 이득일까? — 큰 행렬을 블록으로'),
      h('p', {}, '큰 행렬은 가로·세로를 반씩 나누면 "성분이 작은 행렬인 2×2 행렬"로 볼 수 있습니다. 스트라센의 식에서는 $a$가 늘 왼쪽, $b$가 늘 오른쪽에 있어서, 성분이 행렬이어도 그대로 쓸 수 있습니다. 나눌 때마다 작은 행렬의 곱이 8번 대신 7번이 되고, 이것을 반복하면 차이가 거듭 커집니다.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '행렬 크기'), h('th', { class: 'num' }, '정의대로 곱셈 수 ($N^3$)'), h('th', { class: 'num' }, '스트라센 반복 곱셈 수 ($7^k$)'), h('th', { class: 'num' }, '비율'))),
        h('tbody', {}, powRows))),
      h('p', { class: 'muted small' }, '덧셈·뺄셈도 늘어나지만, 행렬이 커질수록 곱셈을 아끼는 효과가 더 커집니다. 보충: $N = 2^k$일 때 $7^k = N^{\\log_2 7} \\approx N^{2.807}$입니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '3. 2×2는 7번보다 줄일 수 있을까?'),
      h('p', {}, '2×2 행렬의 곱은 곱셈을 7번보다 줄일 수 없다고 알려져 있습니다 (Winograd, 1971). 아래 AI가 찾은 2×2의 최소 횟수도 7번으로, 스트라센과 같았습니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '4. AI AlphaTensor (2022)'),
      h('ol', {}, paper.method.map((m) => h('li', {}, m))),
      h('p', {}, '여러분이 블록을 골라 더하고 뺀 것과 비슷한 일을, AI는 훨씬 큰 행렬에서 수없이 반복하며 블록 수가 적은 방법을 찾았습니다.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'mm-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '크기'), h('th', {}, '계산 방식'), h('th', {}, '이전 최소'), h('th', {}, 'AlphaTensor'), h('th', {}, ''))),
        h('tbody', {}, paper.records.map((r) => h('tr', {},
          h('td', {}, r.size), h('td', {}, r.calc), h('td', {}, r.before), h('td', {}, r.ai), h('td', {}, r.note)))))),
      h('p', {}, paper.more),
      h('p', { class: 'mm-note' }, h('strong', {}, '주의: '), 'mod 2 계산은 모든 수를 2로 나눈 나머지(0 또는 1)로만 계산하는 방식입니다(예: 1 + 1 = 0). 4×4에서 47번은 이 mod 2 계산에서 얻은 결과이며, 보통의 수(실수) 계산에서도 47번이 된다는 뜻은 아닙니다.'),
      h('p', { class: 'muted small' }, `출처: ${paper.source}`)));
}

// ---------- PNG 보고서 그림 ----------

export function renderSummaryCanvas(canvas, payload) {
  const ctx = canvas.getContext('2d');
  const coefs = payload.coefs;
  const font = (px, bold) => `${bold ? 'bold ' : ''}${px}px sans-serif`;
  ctx.fillStyle = '#111';
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // 왼쪽: A, B, AB
  const AB = matMul(payload.A, payload.B);
  const drawMat = (M, x, y, label) => {
    ctx.font = font(26, true);
    ctx.fillText(`${label} =`, x, y + 30);
    const lx = x + 70, w = 120, hh = 90;
    ctx.lineWidth = 3; ctx.strokeStyle = '#111';
    ctx.beginPath(); ctx.moveTo(lx + 10, y); ctx.lineTo(lx, y); ctx.lineTo(lx, y + hh); ctx.lineTo(lx + 10, y + hh); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(lx + w - 10, y); ctx.lineTo(lx + w, y); ctx.lineTo(lx + w, y + hh); ctx.lineTo(lx + w - 10, y + hh); ctx.stroke();
    ctx.font = font(24); ctx.textAlign = 'center';
    M.forEach((row, i) => row.forEach((v, j) => ctx.fillText(String(v), lx + 32 + j * 56, y + 12 + i * 40)));
    ctx.textAlign = 'left';
  };
  drawMat(payload.A, 30, 30, 'A');
  drawMat(payload.B, 30, 150, 'B');
  drawMat(AB, 30, 270, 'AB');
  const direct = payload.direct ?? [];
  const dOK = direct.filter((v, i) => v === AB.flat()[i]).length;
  ctx.font = font(20);
  ctx.fillText(`정의대로 계산: ${dOK}/4 정답`, 30, 390);
  ctx.fillText('(곱셈 8번, 덧셈 4번)', 30, 420);

  // 오른쪽: 블록 조합
  const tx = 300;
  ctx.font = font(28, true);
  ctx.fillText('스트라센 블록으로 만든 성분', tx, 30);
  let ok = 0;
  ENTRIES.forEach((e, i) => {
    const good = sameTable(combine(STRASSEN, coefs[e]), tableFromTerms(TARGET_TERMS[e], 4, 4));
    if (good) ok++;
    const y = 85 + i * 62;
    ctx.font = font(24, true);
    ctx.fillText(`${good ? '✓' : '✗'} ${ENTRY_NAMES[e]} = ${comboText(coefs[e], IDS)}`, tx, y);
    ctx.font = font(18);
    ctx.fillStyle = '#444';
    ctx.fillText(good ? `정의와 같음: ${termsText(TARGET_TERMS[e])}` : `전개: ${termsText(termsOf(combine(STRASSEN, coefs[e])))}`.slice(0, 80), tx + 34, y + 30);
    ctx.fillStyle = '#111';
  });
  const used = usedBlocks(coefs).filter(Boolean).length;
  const adds = countAdds(STRASSEN, coefs).total;
  ctx.font = font(26, true);
  ctx.fillText(`${ok}/4 성분 완성 · 곱셈 ${used}번 · 덧셈·뺄셈 ${adds}번`, tx, 345);
  ctx.font = font(20);
  const wOK = Object.entries(WARMUP_TARGETS)
    .filter(([k, t]) => sameTable(combine(WARMUP, payload.warmup?.[k] ?? [0, 0, 0]), tableFromTerms(t.terms, 2, 2))).length;
  ctx.fillText(`워밍업 (곱 3개로 ac − bd, ad + bc): ${wOK}/2`, tx, 395);
  ctx.fillText(`방법: ${payload.mode === 'free' ? '도전 (블록 직접 고르기)' : '안내 (쓸 블록이 열려 있음)'}`, tx, 425);
  ctx.fillStyle = '#444';
  ctx.font = font(18);
  ctx.fillText('✓/✗는 숫자 대입이 아니라 전개식 비교로 판정했습니다.', tx, 470);
}
