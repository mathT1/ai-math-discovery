// 채점 지표 — 학생이 낸 점 좌표로 모두 다시 계산 [D10]
import { cleanPoints, collinearTriples, badLines } from './geometry.js';

/**
 * values
 *   pointCount       격자 안의 서로 다른 점 개수
 *   collinearTriples 한 직선 위에 있는 세 점 조합 수
 *   ruleOK           1: 점을 n개 이상 찍고 공선 없음 / 0: 아님 (점 0개로 규칙 점수를 받지 않게)
 *   ratio            점 개수 ÷ 2n (공선이 있으면 0)
 *   progress         ratio × min(n, 6)/6 — 6×6 이상에서 2n개를 찍어야 1 (작은 격자만 풀고 만점 받지 않게)
 */
export function metrics(payload) {
  const n = payload.n;
  const { points, duplicates, invalid } = cleanPoints(payload.points, n);
  const triples = collinearTriples(points).length;
  const count = points.length;
  const ruleOK = count >= n && triples === 0 ? 1 : 0;
  const ratio = triples === 0 ? count / (2 * n) : 0;
  const progress = Math.round(ratio * (Math.min(n, 6) / 6) * 1000) / 1000;

  const evidence = [`${n}×${n} 격자, 서로 다른 점 ${count}개 (최대 ${2 * n}개)`];
  if (triples === 0) evidence.push(count >= n ? '한 직선 위의 세 점 없음 — 규칙 지킴' : `한 직선 위의 세 점은 없지만 점이 ${n}개보다 적음`);
  else {
    const lines = badLines(points).slice(0, 3)
      .map((l) => `점 ${l.points.map((i) => i + 1).join('·')} (기울기 ${l.slope})`).join(', ');
    evidence.push(`한 직선 위의 세 점 ${triples}쌍 — ${lines}`);
  }
  if (n < 6 && triples === 0 && count === 2 * n) evidence.push('6×6 이상에서 2n개를 찍으면 개수 점수 만점');
  if (duplicates || invalid) evidence.push(`무시한 점: 중복 ${duplicates}개, 격자 밖·잘못된 값 ${invalid}개`);

  return { values: { pointCount: count, collinearTriples: triples, ruleOK, ratio, progress, n }, evidence };
}
