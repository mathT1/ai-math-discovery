// 모듈 표준 검사 도구가 실제로 통과하는지 (모든 모듈)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('tools/build-index.mjs --check 통과', () => {
  const out = execFileSync(process.execPath, [fileURLToPath(new URL('../tools/build-index.mjs', import.meta.url)), '--check'], { encoding: 'utf8' });
  assert.match(out, /검사 통과/);
});
