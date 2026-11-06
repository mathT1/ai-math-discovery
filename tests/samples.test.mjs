// 샘플 학급 데이터 검사 (FINAL_PLAN 9절 "샘플 자동 재검증")
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { validateResult } from '../core/validate.js';
import { verifyChecksum } from '../core/codec.js';
import { gradeRow } from '../core/grade.js';

const root = new URL('../', import.meta.url);
const readJSON = async (p) => JSON.parse(await readFile(new URL(p, root), 'utf8'));
const files = (await readdir(new URL('samples/', root))).filter((f) => f.endsWith('.json'));

test('샘플 파일이 공개 모듈마다 있음', async () => {
  const index = await readJSON('modules/index.json');
  for (const m of index.modules.filter((x) => x.status === 'published')) {
    assert.ok(files.includes(`${m.id}.json`), `samples/${m.id}.json 없음`);
  }
});

for (const f of files) {
  const id = f.replace(/\.json$/, '');
  test(`samples/${f}: 30명, 형식·체크섬·다시 계산·교사 점수 범위`, async () => {
    const list = await readJSON(`samples/${f}`);
    const schema = await readJSON(`modules/${id}/schema.json`);
    const rubric = await readJSON(`modules/${id}/rubric.json`);
    const { metrics } = await import(new URL(`modules/${id}/grader.js`, root));
    assert.equal(list.length, 30);
    const numbers = new Set();
    const levels = new Map();
    let prefilled = 0;
    for (const item of list) {
      const r = item.result ?? item;
      assert.deepEqual(validateResult(r, schema), [], `${r.student?.number}번 형식`);
      assert.equal(r.meta.module_id, id);
      assert.equal(await verifyChecksum(r), 'ok', `${r.student.number}번 체크섬`);
      assert.match(r.student.name, /^샘플 \d{2}$/, '실제 학생 이름처럼 보이지 않게');
      numbers.add(r.student.number);
      const m = metrics(r.payload, {});
      if (item.teacher) {
        prefilled++;
        for (const it of rubric.items.filter((x) => x.type === 'teacher')) {
          const v = item.teacher[it.id];
          assert.ok(Object.keys(it.levels).map(Number).includes(v), `${r.student.number}번 ${it.id}=${v}는 levels에 없는 점수`);
        }
        const g = gradeRow({ rubric, values: m.values, reflections: r.reflections, manual: item.teacher });
        levels.set(g.level, (levels.get(g.level) ?? 0) + 1);
      }
    }
    assert.equal(numbers.size, 30, '번호 중복');
    assert.equal(prefilled, 20, '1~20번만 교사 점수 미리 채움');
    // 시연용으로 성취수준이 고르게 나와야 함 (한 수준에 몰리지 않게)
    assert.ok(levels.size >= 4, `성취수준 종류 ${[...levels.keys()].join(',')}`);
    assert.ok(Math.max(...levels.values()) <= 10, `한 수준에 몰림 ${JSON.stringify([...levels])}`);
  });
}
