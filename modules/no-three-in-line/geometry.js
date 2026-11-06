// no-three-in-line 수학 계산 (DOM 없음 — 활동 화면·채점·테스트가 같이 씀)
// 좌표: (x, y), 왼쪽 아래가 (0, 0), x는 오른쪽, y는 위쪽으로 증가

/**
 * 서로 다른 세 점 A, B, C가 한 직선 위에 있는가 (FACT_SOURCES N1)
 * (x₂−x₁)(y₃−y₁) = (y₂−y₁)(x₃−x₁) — 나눗셈이 없어 세로선도 판정, 정수라 오차 없음
 */
export const collinear = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) === (b[1] - a[1]) * (c[0] - a[0]);

export const gcd = (a, b) => {
  a = Math.abs(a); b = Math.abs(b);
  while (b) [a, b] = [b, a % b];
  return a;
};

/** 학생 점 목록 정리: 격자 밖·정수 아님·같은 점 반복을 걸러 냄 */
export function cleanPoints(points, n) {
  const seen = new Set();
  const out = [];
  let duplicates = 0;
  let invalid = 0;
  for (const p of points ?? []) {
    const ok = Array.isArray(p) && p.length === 2 && p.every((v) => Number.isInteger(v) && v >= 0 && v < n);
    if (!ok) { invalid++; continue; }
    const key = `${p[0]},${p[1]}`;
    if (seen.has(key)) { duplicates++; continue; }
    seen.add(key);
    out.push([p[0], p[1]]);
  }
  return { points: out, duplicates, invalid };
}

/** 한 직선 위에 있는 세 점 조합 [i, j, k] (점 번호) 모두 */
export function collinearTriples(points) {
  const out = [];
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++)
      for (let k = j + 1; k < points.length; k++)
        if (collinear(points[i], points[j], points[k])) out.push([i, j, k]);
  return out;
}

/** 두 점을 지나는 직선의 기울기 글자 (기약분수) */
export function slopeText(a, b) {
  let dx = b[0] - a[0];
  let dy = b[1] - a[1];
  if (dx === 0) return '기울기 없음 (세로선)';
  if (dy === 0) return '0 (가로선)';
  if (dx < 0) { dx = -dx; dy = -dy; }
  const g = gcd(dx, dy);
  dx /= g; dy /= g;
  return dx === 1 ? String(dy) : `${dy}/${dx}`;
}

/** 직선 ax + by = c 를 하나의 이름으로 (같은 직선이면 같은 이름) */
function lineKey(p, q) {
  let a = q[1] - p[1];
  let b = p[0] - q[0];
  const g = gcd(a, b) || 1;
  a /= g; b /= g;
  if (a < 0 || (a === 0 && b < 0)) { a = -a; b = -b; }
  return `${a},${b},${a * p[0] + b * p[1]}`;
}

/**
 * 점이 3개 이상 놓인 직선마다 묶음
 * @returns {{points:number[], slope:string}[]}  points: 점 번호(작은 순)
 */
export function badLines(points) {
  const groups = new Map();
  for (const [i, j, k] of collinearTriples(points)) {
    const key = lineKey(points[i], points[j]);
    if (!groups.has(key)) groups.set(key, new Set());
    const s = groups.get(key);
    s.add(i); s.add(j); s.add(k);
  }
  return [...groups.values()].map((s) => {
    const idx = [...s].sort((x, y) => x - y);
    return { points: idx, slope: slopeText(points[idx[0]], points[idx[1]]) };
  });
}

/** 한 직선 위 점들 중 양 끝 두 점 (x가 작은 순, 같으면 y가 작은 순) — 직선 그리기용 */
export function lineEnds(points, idx) {
  const sorted = idx.map((i) => points[i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  return [sorted[0], sorted[sorted.length - 1]];
}

/** 지금 점들에 하나를 더 놓으면 공선이 생기는 빈 칸 ("x,y" 집합) — 힌트용 */
export function forbiddenCells(points, n) {
  const occupied = new Set(points.map((p) => `${p[0]},${p[1]}`));
  const out = new Set();
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const key = `${x},${y}`;
      if (occupied.has(key)) continue;
      outer: for (let i = 0; i < points.length; i++) {
        for (let j = i + 1; j < points.length; j++) {
          if (collinear(points[i], points[j], [x, y])) { out.add(key); break outer; }
        }
      }
    }
  }
  return out;
}

/** 이항계수 nCk (큰 수라 BigInt) */
export function binom(n, k) {
  if (k < 0 || k > n) return 0n;
  k = Math.min(k, n - k);
  let r = 1n;
  for (let i = 1; i <= k; i++) r = (r * BigInt(n - k + i)) / BigInt(i);
  return r;
}

/** 큰 수를 읽기 쉽게: 12,345,678 또는 약 1.3 × 10^25 */
export function formatBig(v) {
  const s = v.toString();
  if (s.length <= 15) return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `약 ${s[0]}.${s[1]} × 10^${s.length - 1}`;
}
