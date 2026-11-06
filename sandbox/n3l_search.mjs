// 실험용 (배포 제외): n×n 격자에서 공선 3점 없이 2n개 점 배치가 있는지 탐색하고 전수 검증한다.
// 실행: node sandbox/n3l_search.mjs [최대 n]
const maxN = Number(process.argv[2] ?? 10);

const collinear = (a, b, c) =>
  (b[0] - a[0]) * (c[1] - a[1]) === (b[1] - a[1]) * (c[0] - a[0]);

function search(n) {
  const pts = [];
  const canAdd = (p) => {
    for (let i = 0; i < pts.length; i++)
      for (let j = i + 1; j < pts.length; j++)
        if (collinear(pts[i], pts[j], p)) return false;
    return true;
  };
  // 행(y)마다 정확히 2개씩 놓는다 (2n개가 되려면 반드시 그래야 함)
  const rec = (y) => {
    if (y === n) return true;
    for (let a = 0; a < n; a++) {
      const A = [a, y];
      if (!canAdd(A)) continue;
      pts.push(A);
      for (let b = a + 1; b < n; b++) {
        const B = [b, y];
        if (!canAdd(B)) continue;
        pts.push(B);
        if (rec(y + 1)) return true;
        pts.pop();
      }
      pts.pop();
    }
    return false;
  };
  return rec(0) ? pts.slice() : null;
}

function countCollinear(pts) {
  let c = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++)
        if (collinear(pts[i], pts[j], pts[k])) c++;
  return c;
}

for (let n = 2; n <= maxN; n++) {
  const t = Date.now();
  const sol = search(n);
  const ms = Date.now() - t;
  if (!sol) { console.log(`n=${n}: 2n개 배치 못 찾음 (${ms}ms)`); continue; }
  console.log(`n=${n}: ${sol.length}개, 공선 3점 ${countCollinear(sol)}개, ${ms}ms, ${JSON.stringify(sol)}`);
}
