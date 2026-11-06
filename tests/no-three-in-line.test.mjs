// no-three-in-line 수학·데이터·채점 테스트
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  collinear, collinearTriples, cleanPoints, slopeText, badLines, lineEnds, forbiddenCells, binom, formatBig,
} from '../modules/no-three-in-line/geometry.js';
import { metrics } from '../modules/no-three-in-line/grader.js';
import { validate } from '../core/validate.js';
import { gradeRow } from '../core/grade.js';

const read = async (p) => JSON.parse(await readFile(new URL(`../modules/no-three-in-line/${p}`, import.meta.url), 'utf8'));
const solutions = (await read('data/solutions.json')).solutions;
const rubric = await read('rubric.json');
const schema = await read('schema.json');

/** 비교용 단순 판정: 기울기를 분수로 비교 (세로선 따로) — 판정식과 결과가 같은지 확인용 */
function slowCollinear(a, b, c) {
  const vert1 = b[0] === a[0], vert2 = c[0] === a[0];
  if (vert1 || vert2) return vert1 && vert2;
  return (b[1] - a[1]) / (b[0] - a[0]) === (c[1] - a[1]) / (c[0] - a[0]);
}

test('공선 판정식 = 기울기 비교 (6×6 격자의 모든 서로 다른 세 점)', () => {
  const pts = [];
  for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) pts.push([x, y]);
  let checked = 0;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      for (let k = j + 1; k < pts.length; k++) {
        // 정수 좌표의 작은 기울기는 부동소수 비교도 같은 값을 줌 (분자·분모 ≤ 5)
        assert.equal(collinear(pts[i], pts[j], pts[k]), slowCollinear(pts[i], pts[j], pts[k]));
        checked++;
      }
  assert.equal(checked, Number(binom(36, 3)));
});

test('공선 예: 가로·세로·대각선·기울기 1/2', () => {
  assert.ok(collinear([0, 0], [1, 0], [5, 0]));
  assert.ok(collinear([2, 0], [2, 3], [2, 5]));
  assert.ok(collinear([0, 0], [1, 1], [4, 4]));
  assert.ok(collinear([0, 0], [2, 1], [4, 2]));
  assert.ok(!collinear([0, 0], [1, 2], [2, 3]));
});

test('data/solutions.json: 3×3~8×8 모두 2n개, 격자 안, 중복 없음, 공선 0 [P2]', () => {
  for (let n = 3; n <= 8; n++) {
    const s = solutions[String(n)];
    assert.ok(s, `n=${n} 없음`);
    const { points, duplicates, invalid } = cleanPoints(s, n);
    assert.equal(points.length, 2 * n, `n=${n} 개수`);
    assert.equal(duplicates + invalid, 0, `n=${n} 중복·범위`);
    assert.equal(collinearTriples(points).length, 0, `n=${n} 공선`);
    assert.deepEqual(validate(schema, { n, points: s }), [], `n=${n} 형식`);
  }
});

test('FINAL_PLAN 4-4 예시 6×6 배치도 공선 0', () => {
  const ex = [[0,0],[1,0],[3,1],[5,1],[1,2],[4,2],[0,3],[2,3],[4,4],[5,4],[2,5],[3,5]];
  assert.equal(collinearTriples(ex).length, 0);
});

test('Antigravity 초안의 6×6 예시는 공선 4쌍 (review_by_claude C2 재현)', () => {
  const ag = [[0,1],[0,4],[1,2],[1,5],[2,0],[2,3],[3,2],[3,5],[4,0],[4,3],[5,1],[5,4]];
  assert.equal(collinearTriples(ag).length, 4);
});

test('slopeText: 기약분수, 세로·가로선', () => {
  assert.equal(slopeText([0, 0], [4, 2]), '1/2');
  assert.equal(slopeText([4, 2], [0, 0]), '1/2');
  assert.equal(slopeText([0, 3], [2, 0]), '-3/2');
  assert.equal(slopeText([1, 1], [3, 5]), '2');
  assert.equal(slopeText([2, 0], [2, 5]), '기울기 없음 (세로선)');
  assert.equal(slopeText([0, 4], [3, 4]), '0 (가로선)');
});

test('badLines: 한 직선 위 4점은 하나의 직선으로 묶음, 양 끝 찾기', () => {
  const pts = [[3, 3], [0, 0], [5, 5], [1, 1], [0, 4]];
  const lines = badLines(pts);
  assert.equal(lines.length, 1);
  assert.deepEqual(lines[0].points, [0, 1, 2, 3]);
  assert.equal(lines[0].slope, '1');
  assert.deepEqual(lineEnds(pts, lines[0].points), [[0, 0], [5, 5]]);
});

test('forbiddenCells: (0,0),(1,1) 이 있으면 (2,2)는 금지, (2,1)은 가능', () => {
  const f = forbiddenCells([[0, 0], [1, 1]], 4);
  assert.ok(f.has('2,2') && f.has('3,3'));
  assert.ok(!f.has('2,1'));
  assert.ok(!f.has('0,0')); // 이미 놓인 곳은 제외
});

test('binom·formatBig', () => {
  assert.equal(binom(36, 12), 1251677700n);
  assert.equal(binom(12, 3), 220n);
  assert.equal(binom(5, 7), 0n);
  assert.equal(formatBig(1251677700n), '1,251,677,700');
  assert.match(formatBig(binom(361, 38)), /^약 \d\.\d × 10\^\d+$/);
});

test('cleanPoints: 중복·격자 밖·정수 아님 제거', () => {
  const r = cleanPoints([[0, 0], [0, 0], [6, 1], [1.5, 2], [-1, 0], 'x', [2, 2]], 6);
  assert.deepEqual(r.points, [[0, 0], [2, 2]]);
  assert.equal(r.duplicates, 1);
  assert.equal(r.invalid, 4);
});

test('채점: 6×6 2n개 정답 배치 → 자동 40/40', () => {
  const m = metrics({ n: 6, points: solutions['6'] });
  assert.equal(m.values.collinearTriples, 0);
  assert.equal(m.values.progress, 1);
  const g = gradeRow({ rubric, values: m.values });
  assert.equal(g.items.find((i) => i.id === 'valid').score, 20);
  assert.equal(g.items.find((i) => i.id === 'count').score, 20);
});

test('채점: 3×3 6개는 규칙 20 + 개수 4 (작은 격자로 만점 방지)', () => {
  const m = metrics({ n: 3, points: solutions['3'] });
  assert.equal(m.values.progress, 0.5);
  const g = gradeRow({ rubric, values: m.values });
  assert.equal(g.items.find((i) => i.id === 'valid').score, 20);
  assert.equal(g.items.find((i) => i.id === 'count').score, 4);
});

test('채점: 점 0개는 규칙 점수 없음', () => {
  const m = metrics({ n: 6, points: [] });
  assert.equal(m.values.ruleOK, 0);
  assert.equal(gradeRow({ rubric, values: m.values }).total, 0);
});

test('채점: 공선이 있으면 규칙 0, 개수 0, 근거에 기울기', () => {
  const pts = [...solutions['6'].slice(0, 11), [0, 1]]; // 12번째 점을 (0,1)로 바꿔 공선 만들기
  const m = metrics({ n: 6, points: pts });
  assert.ok(m.values.collinearTriples > 0);
  const g = gradeRow({ rubric, values: m.values });
  assert.equal(g.total, 0);
  assert.match(m.evidence.join(' '), /기울기/);
});

test('채점: 학생이 같은 점을 여러 번 넣어 개수를 부풀려도 다시 셈 [D10]', () => {
  const pts = [...solutions['6'].slice(0, 6), ...solutions['6'].slice(0, 6)];
  const m = metrics({ n: 6, points: pts });
  assert.equal(m.values.pointCount, 6);
  assert.match(m.evidence.join(' '), /중복 6개/);
});

test('schema: 범위 밖 값 거부', () => {
  assert.ok(validate(schema, { n: 9, points: [] }).length);
  assert.ok(validate(schema, { n: 6, points: [[8, 0]] }).length);
  assert.ok(validate(schema, { n: 6, points: [[1, 2, 3]] }).length);
});
