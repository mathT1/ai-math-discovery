// 샘플 학급 30명 결과물 만들기 (연수·현장 시연용) [D19]
// 실행: node tools/make-samples.mjs  → samples/<모듈id>.json
// - 같은 씨앗(seed)으로 늘 같은 결과 → 다시 만들어도 내용이 바뀌지 않음
// - 실제 학생이 아님: 이름은 "샘플 01" 형식, 반은 "1-3"
// - 결과물은 학생 화면과 같은 buildResult로 만들어 체크섬이 진짜임
// - 1~20번은 교사 점수를 미리 채우고(성취수준·CSV 시연), 21~30번은 비워 둠(채점 시연)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildResult } from '../core/codec.js';
import { cleanPoints, collinearTriples } from '../modules/no-three-in-line/geometry.js';
import { ANSWER, WARMUP_ANSWER } from '../modules/matrix-mult/algebra.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const readJSON = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const ui = await readFile(join(ROOT, 'core', 'ui.js'), 'utf8');
const PLATFORM_VERSION = ui.match(/PLATFORM_VERSION\s*=\s*'([^']+)'/)[1];
const CLASS = '1-3';
const PREFILLED = 20;

function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32);
}

const two = (n) => String(n).padStart(2, '0');
const createdAt = (i) => `2026-12-15T10:${two(20 + Math.floor(i / 3))}:${two((i * 17) % 60)}+09:00`;

/** 답 수준(30/20/10/0)을 활동 결과와 대체로 맞추되 조금 섞음 */
function levelFor(base, r) {
  const levels = [30, 20, 10, 0];
  let k = levels.indexOf(base);
  const x = r();
  if (x < 0.15) k = Math.max(0, k - 1); else if (x > 0.85) k = Math.min(3, k + 1);
  return levels[k];
}
const pick = (arr, r) => arr[Math.floor(r() * arr.length)];

async function make(meta, items) {
  const out = [];
  for (const [i, it] of items.entries()) {
    const number = i + 1;
    const result = await buildResult({
      moduleMeta: meta, platformVersion: PLATFORM_VERSION,
      student: { class: CLASS, number, name: `샘플 ${two(number)}` },
      payload: it.payload, reflections: it.reflections, createdAt: createdAt(i),
    });
    out.push(number <= PREFILLED ? { result, teacher: it.teacher } : { result });
  }
  await mkdir(join(ROOT, 'samples'), { recursive: true });
  await writeFile(join(ROOT, 'samples', `${meta.id}.json`), JSON.stringify(out, null, 1) + '\n');
  return out.length;
}

// ---------- no-three-in-line ----------

const N3L_Q1 = {
  30: [
    '직선 AB의 기울기 (y₂−y₁)/(x₂−x₁)와 직선 AC의 기울기 (y₃−y₁)/(x₃−x₁)가 같으면 세 점은 한 직선 위에 있다. x₂=x₁이면 분모가 0이 되므로 x₃=x₁인지 확인한다(세로선). 분모를 곱한 (x₂−x₁)(y₃−y₁)=(y₂−y₁)(x₃−x₁)을 쓰면 세로선도 한 번에 판정된다.',
    'AB와 AC의 기울기가 같은지 본다. 기울기가 같고 점 A를 함께 지나므로 같은 직선이다. 단, x좌표가 같아 기울기가 없으면 세 점의 x좌표가 모두 같은지로 판정한다.',
  ],
  20: [
    'AB의 기울기와 AC의 기울기를 구해서 같으면 세 점은 한 직선 위에 있다.',
    '두 점씩 기울기를 계산해서 (y₂−y₁)/(x₂−x₁) = (y₃−y₁)/(x₃−x₁) 이면 한 직선 위에 있다.',
  ],
  10: ['(0,0), (1,1), (2,2)처럼 대각선으로 놓이면 한 직선 위에 있다.', '가로, 세로, 대각선으로 나란히 있으면 한 직선이다.'],
  0: ['', '잘 모르겠다.'],
};
const N3L_Q2 = {
  30: [
    '한 가로줄에 점이 3개 있으면 세 점이 같은 가로선 위에 있어 규칙에 어긋난다. 그래서 가로줄마다 2개 이하이고 가로줄이 n개이므로 최대 2n개이다.',
    '각 행에 3개를 놓으면 그 행 위에서 세 점이 한 직선이 된다. 따라서 행마다 최대 2개, n행이면 2n개를 넘을 수 없다.',
  ],
  20: ['한 줄에는 점을 2개까지만 놓을 수 있기 때문이다.', '같은 줄에 3개가 있으면 안 되니까 줄마다 2개씩이다.'],
  10: ['여러 번 해 봤는데 2n개보다 많이 놓으면 항상 세 점이 한 직선 위에 생겼다.'],
  0: [''],
};

function transforms(n) {
  const f = (p) => [n - 1 - p[0], p[1]];
  const t = (p) => [p[1], p[0]];
  const r = (p) => [n - 1 - p[1], p[0]];
  const id = (p) => p;
  const comp = (...fs) => (p) => fs.reduce((q, g) => g(q), p);
  return [id, f, t, r, comp(r, r), comp(r, r, r), comp(f, t), comp(f, r)];
}

async function n3l() {
  const meta = await readJSON('modules/no-three-in-line/module.json');
  const sol = (await readJSON('modules/no-three-in-line/data/solutions.json')).solutions;
  const r = rng(20261215);
  const shuffle = (a) => a.map((v) => [r(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const variant = (n, k) => sol[n].map(transforms(n)[k % 8]);
  const profiles = [];
  for (let k = 0; k < 8; k++) profiles.push({ n: 6, points: variant(6, k), base: 30 });
  profiles.push({ n: 7, points: variant(7, 1), base: 30 }, { n: 7, points: variant(7, 4), base: 20 });
  profiles.push({ n: 8, points: variant(8, 2), base: 30 }, { n: 8, points: variant(8, 5), base: 30 });
  for (let k = 0; k < 6; k++) profiles.push({ n: 6, points: shuffle(variant(6, k + 1)).slice(0, 12 - 1 - (k % 3)), base: 20 });
  // 공선이 한 쌍 생긴 배치: 점 하나를 공선이 되는 빈칸으로 옮김
  for (let k = 0; k < 4; k++) {
    const base = shuffle(variant(6, k + 3));
    const kept = base.slice(0, 11);
    const has = new Set(kept.map(String));
    let moved = null;
    for (let y = 0; y < 6 && !moved; y++) for (let x = 0; x < 6 && !moved; x++) {
      if (has.has(`${x},${y}`)) continue;
      if (collinearTriples([...kept, [x, y]]).length) moved = [x, y];
    }
    profiles.push({ n: 6, points: [...kept, moved], base: 10 });
  }
  profiles.push({ n: 4, points: variant(4, 0), base: 20 }, { n: 5, points: variant(5, 3), base: 20 },
    { n: 4, points: variant(4, 6).slice(0, 6), base: 10 }, { n: 5, points: variant(5, 1), base: 10 });
  profiles.push({ n: 6, points: variant(6, 2).slice(0, 4), base: 0 }, { n: 6, points: variant(6, 7).slice(0, 3), base: 10 });
  profiles.push({ n: 7, points: shuffle(variant(7, 6)).slice(0, 12), base: 20 }, { n: 6, points: variant(6, 5), base: 20 });
  if (profiles.length !== 30) throw new Error(`n3l 샘플 수 ${profiles.length}`);

  const items = shuffle(profiles).map((p) => {
    const l1 = levelFor(p.base, r), l2 = levelFor(p.base, r);
    return {
      payload: { n: p.n, points: cleanPoints(p.points, p.n).points },
      reflections: { q1: pick(N3L_Q1[l1], r), q2: pick(N3L_Q2[l2], r) },
      teacher: { q1: l1, q2: l2 },
    };
  });
  return make(meta, items);
}

// ---------- matrix-mult ----------

const MM_Q1 = {
  30: [
    '2×2 한 번만 보면 곱셈 7 + 덧셈·뺄셈 18 = 25번으로 정의대로(12번)보다 많다. 하지만 큰 행렬을 반씩 나누면 작은 행렬을 성분으로 하는 2×2 행렬이 되고, 작은 행렬 곱을 8번 대신 7번 하면 된다. 이것을 반복하면 곱셈이 계속 7/8씩 줄어 큰 행렬에서는 차이가 매우 커진다.',
    '행렬을 블록으로 나눠 스트라센을 반복해서 쓰면 곱셈 수가 N³ 대신 7^k가 된다. 1024×1024이면 약 26%만 곱셈하면 된다. 덧셈도 늘지만 곱셈을 아끼는 효과가 더 크다.',
  ],
  20: ['행렬이 커질수록 곱셈이 덧셈보다 훨씬 오래 걸리고, 곱셈을 줄이는 효과가 커지기 때문이다.', '큰 행렬에서는 곱셈 한 번 줄인 것이 여러 번 쌓여서 이득이다.'],
  10: ['곱셈이 8번에서 7번으로 줄었기 때문이다.'],
  0: ['', '모르겠다.'],
};
const MM_Q2 = {
  30: [
    'AlphaTensor는 곱셈 방법 찾기를 블록을 하나씩 고르는 게임으로 바꾸고 강화학습으로 블록 수가 적은 방법을 찾았다. 4×4에서 49번을 47번으로 줄였지만 mod 2 계산에서의 결과이고, 2×2는 7번보다 줄이지 못했다.',
    '곱셈 방법을 TensorGame이라는 게임으로 만들고 AlphaZero처럼 스스로 연습했다. 4×4 47번은 0과 1만 쓰는 mod 2 계산에서만 된 것이고, 2×2는 스트라센과 같은 7번이었다.',
  ],
  20: ['곱셈 방법을 게임처럼 만들어 AI가 스스로 연습해서 4×4 행렬을 47번으로 곱하는 방법을 찾았다.'],
  10: ['AI가 사람보다 더 빠른 곱셈 방법을 찾았다.', 'AI가 모든 행렬 곱셈을 더 빠르게 만들었다.'],
  0: [''],
};

async function mm() {
  const meta = await readJSON('modules/matrix-mult/module.json');
  const r = rng(20261216);
  const shuffle = (a) => a.map((v) => [r(), v]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
  const num = () => Math.floor(r() * 13) - 3;
  const zero = () => [0, 0, 0, 0, 0, 0, 0];
  const right = () => Object.fromEntries(Object.entries(ANSWER).map(([k, v]) => [k, [...v]]));
  const wrongs = {
    c11: [[1, 0, 0, 1, -1, 0, 0], [1, 0, 0, 1, 1, 0, 1], [1, 0, 0, 0, -1, 0, 1]],
    c22: [[1, -1, 1, 0, 0, -1, 0], [1, 1, 1, 0, 0, 1, 0], [1, -1, 0, 0, 0, 1, 0]],
    c12: [[0, 0, 1, 0, -1, 0, 0]],
    c21: [[0, 1, 0, -1, 0, 0, 0]],
  };
  const profiles = [];
  for (let k = 0; k < 7; k++) profiles.push({ mode: 'free', coefs: right(), base: 30 });
  for (let k = 0; k < 6; k++) profiles.push({ mode: 'guided', coefs: right(), base: k < 3 ? 30 : 20 });
  for (let k = 0; k < 6; k++) { const c = right(); const e = k % 2 ? 'c22' : 'c11'; c[e] = [...pick(wrongs[e], r)]; profiles.push({ mode: k < 3 ? 'guided' : 'free', coefs: c, base: 20 }); }
  for (let k = 0; k < 5; k++) { const c = right(); c.c11 = k % 2 ? zero() : [...pick(wrongs.c11, r)]; c.c22 = k % 3 ? zero() : [...pick(wrongs.c22, r)]; profiles.push({ mode: 'guided', coefs: c, base: 10 }); }
  for (let k = 0; k < 4; k++) { const c = { c11: zero(), c12: [...ANSWER.c12], c21: [...pick(wrongs.c21, r)], c22: zero() }; profiles.push({ mode: 'guided', coefs: c, base: 10 }); }
  profiles.push({ mode: 'guided', coefs: { c11: zero(), c12: zero(), c21: zero(), c22: zero() }, base: 0 });
  profiles.push({ mode: 'guided', coefs: { c11: [1, 0, 0, 1, 0, 0, 0], c12: [...wrongs.c12[0]], c21: zero(), c22: zero() }, base: 0 });
  if (profiles.length !== 30) throw new Error(`mm 샘플 수 ${profiles.length}`);

  const items = shuffle(profiles).map((p) => {
    const A = [[num(), num()], [num(), num()]], B = [[num(), num()], [num(), num()]];
    const AB = [A[0][0] * B[0][0] + A[0][1] * B[1][0], A[0][0] * B[0][1] + A[0][1] * B[1][1],
      A[1][0] * B[0][0] + A[1][1] * B[1][0], A[1][0] * B[0][1] + A[1][1] * B[1][1]].map((v) => v + 0);
    // 정의대로 계산: 대부분 맞고, 일부는 한 칸 틀리거나 비어 있음
    const x = r();
    const direct = x < 0.75 ? AB : x < 0.9 ? AB.map((v, i) => (i === 3 ? v + 1 : v)) : [AB[0], AB[1], null, null];
    const y = r();
    const warmup = y < 0.75 ? { ...WARMUP_ANSWER } : y < 0.9 ? { w1: [...WARMUP_ANSWER.w1], w2: [1, -1, 0] } : { w1: [0, 0, 0], w2: [0, 0, 0] };
    const l1 = levelFor(p.base, r), l2 = levelFor(p.base, r);
    return {
      payload: { A, B, direct, warmup: { w1: [...warmup.w1], w2: [...warmup.w2] }, mode: p.mode, coefs: p.coefs },
      reflections: { q1: pick(MM_Q1[l1], r), q2: pick(MM_Q2[l2], r) },
      teacher: { q1: l1, q2: l2 },
    };
  });
  return make(meta, items);
}

console.log(`samples/no-three-in-line.json ${await n3l()}명`);
console.log(`samples/matrix-mult.json ${await mm()}명`);
