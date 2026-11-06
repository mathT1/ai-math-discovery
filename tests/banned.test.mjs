// 금지 문장 검사 — docs/FACT_SOURCES.md 5절의 6문장이 배포되는 파일 어디에도 없는지 [P1]
// (M4 최종 검토에서 검토자가 다른 문장 목록으로 검사한 일이 있어, 사람 검토에 기대지 않고 자동으로 막음)
// 지도안(guide.md)은 "예상 오개념" 표와 "쓰지 않는 문장" 줄에서 교사에게 알려 주려고 일부러 인용하므로 그 부분만 뺌
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const BANNED = [
  { why: 'n>46이면 2n 불가 (증명 안 됨, N9)', re: /46\s*(보다|이상|을 넘|초과)/ },
  { why: 'AI가 100년 된 문제의 새 해 (방법 비교 논문)', re: /100\s*년/ },
  { why: 'AlphaTensor가 2×2 기록을 깸 (M4·M11)', re: /2\s*[×x]\s*2[^.\n]{0,12}기록[을도]?\s*(깼|깸|깨|경신|갱신)/ },
  // 성취수준 기준 "A 90% 이상"은 해당 없음 → 행렬·연산과 함께 나올 때만
  { why: '연산의 90%는 행렬 곱셈 (출처 없음)', re: /(행렬|연산)[^.\n]{0,20}9\d\s*%|9\d\s*%[^.\n]{0,20}(행렬|연산)/ },
  { why: '스트라센은 2×2 한 번에도 빠름 (M12)', re: /(한 번|1번)[^.\n]{0,10}(에도|도|만으로도)\s*(더\s*)?빠르/ },
  { why: 'AI가 고전 방법보다 큰 격자에서 더 좋은 해 (N6)', re: /AI[^.\n]{0,20}(고전|ILP)[^.\n]{0,20}(더 큰|넘어|앞섰|이겼)/ },
];

async function walk(rel) {
  const out = [];
  for (const e of await readdir(new URL(rel, root), { withFileTypes: true })) {
    const p = `${rel}${e.name}`;
    if (e.isDirectory()) out.push(...await walk(p + '/'));
    else if (/\.(html|js|json|md|css)$/.test(e.name)) out.push(p);
  }
  return out;
}

/** 지도안에서 오개념 표·"쓰지 않는 문장" 줄 빼기 */
function stripQuoted(text) {
  return text
    .replace(/## 3\. 예상 오개념[\s\S]*?(?=\n## )/g, '')
    .split('\n').filter((l) => !l.includes('쓰지 않는')).join('\n');
}

test('금지 문장 6개가 배포 파일 어디에도 없음', async () => {
  const files = ['index.html', 'teacher.html', 'guide.html', 'README.md',
    ...await walk('core/'), ...await walk('modules/'), ...await walk('samples/')];
  const hits = [];
  for (const f of files) {
    let text = await readFile(new URL(f, root), 'utf8');
    if (f.endsWith('guide.md')) text = stripQuoted(text);
    for (const b of BANNED) {
      const m = text.match(b.re);
      if (m) hits.push(`${f}: "${m[0]}" — ${b.why}`);
    }
  }
  assert.deepEqual(hits, []);
});

test('검사식이 실제 금지 문장을 잡아냄 (검사식 자체 확인)', () => {
  const samples = [
    'n이 46보다 크면 2n개 배치가 불가능하다',
    'AI가 100년 된 문제의 새로운 해를 찾았다',
    'AlphaTensor가 2×2 행렬 곱셈 기록을 깼다',
    '스마트폰 그래픽과 AI 연산의 90%는 행렬 곱셈',
    '스트라센 방법은 2×2 행렬 한 번 곱할 때도 더 빠르다',
    'AI가 고전 알고리즘보다 더 큰 격자에서 더 좋은 해를 찾았다',
  ];
  samples.forEach((s, i) => assert.match(s, BANNED[i].re, s));
});
