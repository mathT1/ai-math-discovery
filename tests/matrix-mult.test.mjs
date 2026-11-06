// matrix-mult 수학·채점 테스트 — FACT_SOURCES M1, M2, M12를 계수 전개로 확인 [P2]
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  STRASSEN, ENTRIES, TARGET_TERMS, WARMUP, WARMUP_TARGETS, ANSWER, WARMUP_ANSWER,
  expandBlock, combine, tableFromTerms, sameTable, termsOf, cancelledTerms, blockText, termsText, comboText,
  usedBlocks, countAdds, entryCorrect, matMul, comboValue,
} from '../modules/matrix-mult/algebra.js';
import { metrics } from '../modules/matrix-mult/grader.js';
import { validate } from '../core/validate.js';
import { gradeRow } from '../core/grade.js';

const read = async (p) => JSON.parse(await readFile(new URL(`../modules/matrix-mult/${p}`, import.meta.url), 'utf8'));
const rubric = await read('rubric.json');
const schema = await read('schema.json');
const paper = await read('data/paper.json');

const payload = (coefs, extra = {}) => ({
  A: [[1, 2], [3, 4]], B: [[5, 6], [7, 8]], direct: [19, 22, 43, 50],
  warmup: { ...WARMUP_ANSWER }, mode: 'free', coefs, ...extra,
});
const zero = () => Object.fromEntries(ENTRIES.map((e) => [e, Array(7).fill(0)]));

test('M1: 정의대로는 성분마다 곱 2개 → 곱셈 8번, 덧셈 4번', () => {
  const terms = ENTRIES.flatMap((e) => TARGET_TERMS[e]);
  assert.equal(terms.length, 8);
  assert.equal(new Set(terms.map(String)).size, 8);
  assert.equal(ENTRIES.length * (2 - 1), 4);
});

test('M2: 스트라센 네 성분을 16칸 계수 표로 전개하면 정의와 같음', () => {
  for (const e of ENTRIES) {
    assert.ok(sameTable(combine(STRASSEN, ANSWER[e]), tableFromTerms(TARGET_TERMS[e], 4, 4)), e);
  }
  assert.deepEqual(entryCorrect(ANSWER), { c11: true, c12: true, c21: true, c22: true });
});

test('M2: 블록 글자가 FACT_SOURCES 식과 같음', () => {
  assert.deepEqual(STRASSEN.map((b) => blockText(b)), [
    '(a₁₁ + a₂₂)(b₁₁ + b₂₂)', '(a₂₁ + a₂₂)b₁₁', 'a₁₁(b₁₂ − b₂₂)', 'a₂₂(b₂₁ − b₁₁)',
    '(a₁₁ + a₁₂)b₂₂', '(a₂₁ − a₁₁)(b₁₁ + b₁₂)', '(a₁₂ − a₂₂)(b₂₁ + b₂₂)',
  ]);
  assert.deepEqual(ENTRIES.map((e) => comboText(ANSWER[e], STRASSEN.map((b) => b.id))),
    ['M₁ + M₄ − M₅ + M₇', 'M₃ + M₅', 'M₂ + M₄', 'M₁ − M₂ + M₃ + M₆']);
});

test('M4·M6의 직접 쓴 글자가 계수와 일치 (글자 순서만 바꿈)', () => {
  // 글자에서 항을 읽어 계수와 비교
  const parse = (s, names) => names.map((n) => (s.includes(`− ${n}`) || s.startsWith(`(−${n}`) ? -1 : s.includes(n) ? 1 : 0));
  for (const b of STRASSEN.filter((x) => x.text)) {
    const [l, r] = b.text.split(')(').length === 2 ? b.text.split(')(') : [b.text.slice(0, 3), b.text.slice(3)];
    assert.deepEqual(parse(l, ['a₁₁', 'a₁₂', 'a₂₁', 'a₂₂']), b.alpha, b.id);
    assert.deepEqual(parse(r, ['b₁₁', 'b₁₂', 'b₂₁', 'b₂₂']), b.beta, b.id);
  }
});

test('M12: 덧셈·뺄셈 18번 = 블록 안 10 + 잇기 8, 곱셈 7번', () => {
  assert.deepEqual(countAdds(STRASSEN, ANSWER), { inner: 10, outer: 8, total: 18 });
  assert.equal(usedBlocks(ANSWER).filter(Boolean).length, 7);
});

test('7개 블록은 서로 독립: 각 성분을 만드는 조합은 하나뿐 (−1,0,1 전수 3^7)', () => {
  for (const e of ENTRIES) {
    const target = tableFromTerms(TARGET_TERMS[e], 4, 4);
    let found = 0;
    for (let n = 0; n < 3 ** 7; n++) {
      const cs = []; let m = n;
      for (let k = 0; k < 7; k++) { cs.push((m % 3) - 1); m = Math.floor(m / 3); }
      if (sameTable(combine(STRASSEN, cs), target)) { found++; assert.deepEqual(cs, ANSWER[e]); }
    }
    assert.equal(found, 1, e);
  }
});

test('지워진 항: c₁₁ = M₁ + M₄ − M₅ + M₇', () => {
  const gone = cancelledTerms(STRASSEN, ANSWER.c11).map(([i, j]) => `${i}${j}`);
  // a11b22, a12b22, a22b11, a22b21, a22b22
  assert.deepEqual(gone, ['03', '13', '30', '32', '33']);
  assert.equal(termsText(termsOf(combine(STRASSEN, ANSWER.c11))), 'a₁₁b₁₁ + a₁₂b₂₁');
});

test('워밍업: P2 − P3 = ac − bd, P1 − P2 − P3 = ad + bc', () => {
  for (const [k, t] of Object.entries(WARMUP_TARGETS)) {
    assert.ok(sameTable(combine(WARMUP, WARMUP_ANSWER[k]), tableFromTerms(t.terms, 2, 2)), k);
  }
  assert.equal(termsText(termsOf(expandBlock(WARMUP[0])), ['a', 'b'], ['c', 'd']), 'ac + ad + bc + bd');
});

test('숫자 검산: 무작위 정수 200쌍에서 스트라센 = 정의', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) % 19) - 9;
  for (let t = 0; t < 200; t++) {
    const A = [[rnd(), rnd()], [rnd(), rnd()]], B = [[rnd(), rnd()], [rnd(), rnd()]];
    const AB = matMul(A, B).flat();
    ENTRIES.forEach((e, i) => assert.equal(comboValue(ANSWER[e], A, B), AB[i]));
  }
});

test('채점: 정답 → 자동 40/40, 근거에 18번', () => {
  const m = metrics(payload(ANSWER));
  assert.equal(m.values.correctEntries, 4);
  assert.equal(m.values.strassenOK, 1);
  assert.equal(m.values.multiplications, 7);
  assert.equal(m.values.additions, 18);
  assert.equal(m.values.directCorrect, 4);
  assert.equal(m.values.warmupOK, 2);
  const g = gradeRow({ rubric, values: m.values });
  assert.equal(g.items.find((i) => i.id === 'entries').score, 30);
  assert.equal(g.items.find((i) => i.id === 'seven').score, 10);
  assert.match(m.evidence.join(' '), /덧셈·뺄셈 18번/);
});

test('채점: 두 성분만 맞으면 15 + 0, 틀린 식은 근거에 표시', () => {
  const cs = zero(); cs.c12 = [...ANSWER.c12]; cs.c21 = [...ANSWER.c21]; cs.c11 = [1, 0, 0, 1, 0, 0, 0];
  const m = metrics(payload(cs));
  assert.equal(m.values.correctEntries, 2);
  const g = gradeRow({ rubric, values: m.values });
  assert.equal(g.items.find((i) => i.id === 'entries').score, 15);
  assert.equal(g.items.find((i) => i.id === 'seven').score, 0);
  assert.match(m.evidence.join(' '), /c₁₁ = M₁ \+ M₄ \(정의와 다름\)/);
});

test('채점: 숫자만 우연히 맞는 조합은 정답 아님 (전개로 판정)', () => {
  // A=B=0이면 어떤 조합도 숫자는 0으로 같음 → 그래도 계수 표가 다르면 오답
  const cs = zero(); cs.c11 = [1, 0, 0, 0, 0, 0, 0];
  const m = metrics(payload(cs, { A: [[0, 0], [0, 0]], B: [[0, 0], [0, 0]], direct: [0, 0, 0, 0] }));
  assert.equal(m.values.correctEntries, 0);
  assert.equal(comboValue(cs.c11, [[0, 0], [0, 0]], [[0, 0], [0, 0]]), 0);
});

test('채점: 범위 밖 계수(2, 0.5 등)는 0으로 보고 다시 셈', () => {
  const cs = { c11: [2, 0, 0, 2, -2, 0, 2], c12: [0.5, 0, 1, 0, 1, 0, 0], c21: 'x', c22: [1, -1, 1, 0, 0, 1, 0, 1] };
  const m = metrics(payload(cs));
  assert.equal(m.values.correctEntries, 2); // c12(0.5→0)와 c22(8번째 무시)만 정답
});

test('채점: 안내 모드는 근거에 표시', () => {
  assert.match(metrics(payload(ANSWER, { mode: 'guided' })).evidence.join(' '), /안내 모드/);
});

test('schema: 정답 payload 통과, 범위 밖 거부', () => {
  assert.deepEqual(validate(schema, payload(ANSWER)), []);
  assert.deepEqual(validate(schema, payload(zero(), { direct: [null, null, null, null] })), []);
  assert.ok(validate(schema, payload(ANSWER, { A: [[10, 0], [0, 0]] })).length);
  assert.ok(validate(schema, payload({ ...ANSWER, c11: [2, 0, 0, 0, 0, 0, 0] })).length);
  assert.ok(validate(schema, payload(ANSWER, { mode: 'x' })).length);
  assert.ok(validate(schema, { ...payload(ANSWER), extra: 1 }).length);
});

test('data/paper.json: FACT_SOURCES M6·M7·M11 수치', () => {
  const r = Object.fromEntries(paper.records.map((x) => [`${x.size} ${x.calc}`, x]));
  assert.match(r['2×2 일반 계산'].ai, /^7번/);
  assert.match(r['4×4 mod 2 계산'].before, /^49번/);
  assert.match(r['4×4 mod 2 계산'].ai, /^47번/);
  assert.match(r['5×5 mod 2 계산'].ai, /^96번/);
  assert.match(r['5×5 일반 계산'].ai, /^98번/);
  assert.match(paper.more, /70개가 넘는/);
});

test('금지 문장 없음 — 학생 화면 파일 (FACT_SOURCES 5절, 지도안은 오개념 예로 인용하므로 제외)', async () => {
  const files = ['activity.js', 'module.json', 'data/paper.json'];
  const text = (await Promise.all(files.map((f) => readFile(new URL(`../modules/matrix-mult/${f}`, import.meta.url), 'utf8')))).join('\n');
  assert.doesNotMatch(text, /2×2의? 기록[을도]? ?(깼|깸|깨)/);
  assert.doesNotMatch(text, /90 ?%/);
  assert.doesNotMatch(text, /한 번(만|에)?(으로)?도 (더 )?빠르/);
  assert.doesNotMatch(text, /최소임이 증명/); // M4는 ⚠️ — "알려져 있다"로만
});
