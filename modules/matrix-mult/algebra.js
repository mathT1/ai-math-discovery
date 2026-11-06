// matrix-mult 수학 핵심 — DOM 없음 (tests/에서 직접 검사)
//
// "블록" = (왼쪽 행렬 성분의 일차결합) × (오른쪽 행렬 성분의 일차결합)
//   alpha[i] = 왼쪽 변수 i의 계수, beta[j] = 오른쪽 변수 j의 계수
// 블록을 전개하면 항 (왼쪽 i)(오른쪽 j)의 계수가 alpha[i]·beta[j]인 표(가로 i, 세로 j)가 됩니다.
// 블록들을 계수 c_k로 더하고 빼면 표끼리 더하고 빼는 것과 같습니다.
// → 목표 식의 표와 같으면 정답 (기호 계산, 숫자 대입 아님)

export const A_NAMES = ['a₁₁', 'a₁₂', 'a₂₁', 'a₂₂'];
export const B_NAMES = ['b₁₁', 'b₁₂', 'b₂₁', 'b₂₂'];

/** 스트라센(1969)의 7개 블록 — docs/FACT_SOURCES.md M2 */
export const STRASSEN = [
  { id: 'M1', alpha: [1, 0, 0, 1], beta: [1, 0, 0, 1] },   // (a11+a22)(b11+b22)
  { id: 'M2', alpha: [0, 0, 1, 1], beta: [1, 0, 0, 0] },   // (a21+a22)b11
  { id: 'M3', alpha: [1, 0, 0, 0], beta: [0, 1, 0, -1] },  // a11(b12−b22)
  { id: 'M4', alpha: [0, 0, 0, 1], beta: [-1, 0, 1, 0], text: 'a₂₂(b₂₁ − b₁₁)' },  // a22(b21−b11)
  { id: 'M5', alpha: [1, 1, 0, 0], beta: [0, 0, 0, 1] },   // (a11+a12)b22
  { id: 'M6', alpha: [-1, 0, 1, 0], beta: [1, 1, 0, 0], text: '(a₂₁ − a₁₁)(b₁₁ + b₁₂)' },  // (a21−a11)(b11+b12)
  { id: 'M7', alpha: [0, 1, 0, -1], beta: [0, 0, 1, 1] },  // (a12−a22)(b21+b22)
];

/** 행렬 곱의 정의: c_ij = a_i1 b_1j + a_i2 b_2j (변수 번호: 11→0, 12→1, 21→2, 22→3) */
export const ENTRIES = ['c11', 'c12', 'c21', 'c22'];
export const ENTRY_NAMES = { c11: 'c₁₁', c12: 'c₁₂', c21: 'c₂₁', c22: 'c₂₂' };
export const TARGET_TERMS = {
  c11: [[0, 0], [1, 2]], // a11b11 + a12b21
  c12: [[0, 1], [1, 3]], // a11b12 + a12b22
  c21: [[2, 0], [3, 2]], // a21b11 + a22b21
  c22: [[2, 1], [3, 3]], // a21b12 + a22b22
};

/** 워밍업: 곱 3개로 ac − bd 와 ad + bc 를 함께 만들기 (그냥 하면 곱셈 4번) */
export const W_A = ['a', 'b'];
export const W_B = ['c', 'd'];
export const WARMUP = [
  { id: 'P1', alpha: [1, 1], beta: [1, 1] }, // (a+b)(c+d)
  { id: 'P2', alpha: [1, 0], beta: [1, 0] }, // ac
  { id: 'P3', alpha: [0, 1], beta: [0, 1] }, // bd
];
export const WARMUP_TARGETS = {
  w1: { label: 'ac − bd', terms: [[0, 0, 1], [1, 1, -1]] },
  w2: { label: 'ad + bc', terms: [[0, 1, 1], [1, 0, 1]] },
};

// ---------- 표(계수 배열) ----------

export const zeros = (na, nb) => Array.from({ length: na }, () => Array(nb).fill(0));

/** 블록 하나를 전개한 표 */
export function expandBlock(block) {
  return block.alpha.map((x) => block.beta.map((y) => x * y));
}

/** 블록들을 coefs로 더하고 뺀 표 */
export function combine(blocks, coefs) {
  const na = blocks[0].alpha.length, nb = blocks[0].beta.length;
  const t = zeros(na, nb);
  blocks.forEach((bl, k) => {
    const c = coefs[k] ?? 0;
    if (!c) return;
    const e = expandBlock(bl);
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) t[i][j] += c * e[i][j];
  });
  return t;
}

/** 항 목록 [[i, j, 계수]] → 표 */
export function tableFromTerms(terms, na, nb) {
  const t = zeros(na, nb);
  for (const [i, j, c = 1] of terms) t[i][j] += c;
  return t;
}

export const sameTable = (s, t) => s.every((row, i) => row.every((v, j) => v === t[i][j]));

/** 표 → 0이 아닌 항 [[i, j, 계수]] (왼쪽 변수 순서 → 오른쪽 변수 순서) */
export function termsOf(t) {
  const out = [];
  t.forEach((row, i) => row.forEach((v, j) => { if (v) out.push([i, j, v]); }));
  return out;
}

/** 쓴 블록의 전개에는 나왔지만 더하고 빼는 과정에서 지워진 항 */
export function cancelledTerms(blocks, coefs) {
  const t = combine(blocks, coefs);
  const seen = new Set();
  const out = [];
  blocks.forEach((bl, k) => {
    if (!coefs[k]) return;
    for (const [i, j] of termsOf(expandBlock(bl))) {
      const key = `${i},${j}`;
      if (t[i][j] === 0 && !seen.has(key)) { seen.add(key); out.push([i, j]); }
    }
  });
  return out.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

// ---------- 글자로 나타내기 ----------

/** 일차결합 글자: [1,0,0,1] → "a₁₁ + a₂₂", 항이 둘 이상이면 괄호 */
export function linearText(coefs, names, paren = true) {
  const parts = [];
  coefs.forEach((c, i) => { if (c) parts.push([c, names[i]]); });
  const s = signedJoin(parts.map(([c, name]) => [c, name]));
  return paren && parts.length > 1 ? `(${s})` : s;
}

/** 블록 글자: "(a₁₁ + a₂₂)(b₁₁ + b₂₂)" */
export function blockText(block, aNames = A_NAMES, bNames = B_NAMES) {
  return block.text ?? linearText(block.alpha, aNames) + linearText(block.beta, bNames);
}

/** 항 목록 글자: [[0,0,1],[1,2,1]] → "a₁₁b₁₁ + a₁₂b₂₁", 비면 "0" */
export function termsText(terms, aNames = A_NAMES, bNames = B_NAMES) {
  if (!terms.length) return '0';
  return signedJoin(terms.map(([i, j, c = 1]) => [c, aNames[i] + bNames[j]]));
}

/** 블록 조합 글자: [1,0,0,1,-1,0,1] → "M₁ + M₄ − M₅ + M₇" */
export function comboText(coefs, ids) {
  const parts = [];
  coefs.forEach((c, k) => { if (c) parts.push([c, sub(ids[k])]); });
  return parts.length ? signedJoin(parts) : '(아직 없음)';
}

/** "M1" → "M₁" */
export function sub(id) {
  return id.replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
}

function signedJoin(parts) {
  return parts.map(([c, name], k) => {
    const abs = Math.abs(c);
    const body = (abs === 1 ? '' : abs) + name;
    if (k === 0) return (c < 0 ? '−' : '') + body;
    return (c < 0 ? ' − ' : ' + ') + body;
  }).join('');
}

// ---------- 셈 ----------

/** 쓴 블록(곱셈) 수 — 네 성분 중 한 곳이라도 쓰면 1번 */
export function usedBlocks(coefsByEntry, count = 7) {
  const used = Array(count).fill(false);
  for (const cs of Object.values(coefsByEntry)) cs.forEach((c, k) => { if (c) used[k] = true; });
  return used;
}

/** 블록 안의 덧셈·뺄셈 수: (a 쪽 항 수 − 1) + (b 쪽 항 수 − 1) */
export function innerAdds(block) {
  const nz = (v) => v.filter(Boolean).length;
  return Math.max(0, nz(block.alpha) - 1) + Math.max(0, nz(block.beta) - 1);
}

/** 전체 덧셈·뺄셈 수 = 쓴 블록 안 + 성분마다 블록을 잇는 수 */
export function countAdds(blocks, coefsByEntry) {
  const used = usedBlocks(coefsByEntry, blocks.length);
  let inner = 0;
  used.forEach((u, k) => { if (u) inner += innerAdds(blocks[k]); });
  let outer = 0;
  for (const cs of Object.values(coefsByEntry)) outer += Math.max(0, cs.filter(Boolean).length - 1);
  return { inner, outer, total: inner + outer };
}

/** 성분마다 정답 여부 */
export function entryCorrect(coefsByEntry) {
  const out = {};
  for (const e of ENTRIES) {
    const cs = coefsByEntry[e];
    out[e] = Array.isArray(cs) && sameTable(combine(STRASSEN, cs), tableFromTerms(TARGET_TERMS[e], 4, 4));
  }
  return out;
}

// ---------- 숫자 계산 (검산) ----------

const flat = (M) => [M[0][0], M[0][1], M[1][0], M[1][1]];

/** 정의대로 곱하기 */
export function matMul(A, B) { return matMulRaw(A, B).map((r) => r.map((v) => v + 0)); } // -0 → 0
function matMulRaw(A, B) {
  return [
    [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1]],
    [A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]],
  ];
}

/** 블록의 값: (Σ alpha·a)(Σ beta·b) */
export function blockValue(block, A, B) {
  const a = flat(A), b = flat(B);
  const l = block.alpha.reduce((s, c, i) => s + c * a[i], 0);
  const r = block.beta.reduce((s, c, j) => s + c * b[j], 0);
  return l * r;
}

/** 블록 조합의 값 */
export function comboValue(coefs, A, B, blocks = STRASSEN) {
  return blocks.reduce((s, bl, k) => s + (coefs[k] ?? 0) * blockValue(bl, A, B), 0) + 0;
}

/** 스트라센 정답 계수 (테스트·교사용 지도안 확인용, 화면에는 정리 전까지 보이지 않음) */
export const ANSWER = {
  c11: [1, 0, 0, 1, -1, 0, 1],
  c12: [0, 0, 1, 0, 1, 0, 0],
  c21: [0, 1, 0, 1, 0, 0, 0],
  c22: [1, -1, 1, 0, 0, 1, 0],
};
export const WARMUP_ANSWER = { w1: [0, 1, -1], w2: [1, -1, -1] };
