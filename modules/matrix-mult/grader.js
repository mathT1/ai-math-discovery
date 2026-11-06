// 채점 지표 — 학생이 고른 블록 계수로 모두 다시 계산 [D10]
// 정답 판정은 숫자 대입이 아니라 전개한 계수 표 비교 (우연히 숫자가 맞는 경우를 막음)
import {
  STRASSEN, ENTRIES, ENTRY_NAMES, WARMUP, WARMUP_TARGETS,
  entryCorrect, usedBlocks, countAdds, combine, tableFromTerms, sameTable, matMul, comboText,
} from './algebra.js';

const clean = (cs, len) => (Array.isArray(cs) ? cs : []).slice(0, len).concat(Array(len).fill(0)).slice(0, len)
  .map((c) => (c === 1 || c === -1 ? c : 0));

/**
 * values
 *   correctEntries   0~4  전개해서 정의와 같은 성분 수
 *   strassenOK       1: 네 성분 모두 맞음 (이때 쓴 블록은 반드시 7개 — 7개 블록은 서로 독립)
 *   multiplications  쓴 블록 수 (= 곱셈 수)
 *   additions        덧셈·뺄셈 수 (블록 안 + 블록 잇기)
 *   directCorrect    0~4  정의대로 계산한 숫자가 맞은 성분 수
 *   warmupOK         0~2  워밍업 두 식
 */
export function metrics(payload) {
  const coefs = {};
  for (const e of ENTRIES) coefs[e] = clean(payload.coefs?.[e], 7);
  const ok = entryCorrect(coefs);
  const correctEntries = ENTRIES.filter((e) => ok[e]).length;
  const multiplications = usedBlocks(coefs).filter(Boolean).length;
  const adds = countAdds(STRASSEN, coefs);

  const AB = matMul(payload.A, payload.B).flat();
  const directCorrect = (payload.direct ?? []).filter((v, i) => v === AB[i]).length;

  let warmupOK = 0;
  for (const [k, t] of Object.entries(WARMUP_TARGETS)) {
    if (sameTable(combine(WARMUP, clean(payload.warmup?.[k], 3)), tableFromTerms(t.terms, 2, 2))) warmupOK++;
  }

  const ids = STRASSEN.map((b) => b.id);
  const evidence = [
    `스트라센 블록 조합: ${correctEntries}/4 성분 정답 (${ENTRIES.map((e) => `${ENTRY_NAMES[e]}${ok[e] ? '✓' : '✗'}`).join(' ')})`,
    ...ENTRIES.filter((e) => !ok[e] && coefs[e].some(Boolean)).map((e) => `${ENTRY_NAMES[e]} = ${comboText(coefs[e], ids)} (정의와 다름)`),
    `곱셈 ${multiplications}번, 덧셈·뺄셈 ${adds.total}번`,
    `정의대로 계산: ${directCorrect}/4 · 워밍업: ${warmupOK}/2`,
  ];
  if (payload.mode === 'guided') evidence.push('안내 모드(쓸 블록이 미리 열림)로 활동');

  return {
    values: { correctEntries, strassenOK: correctEntries === 4 ? 1 : 0, multiplications, additions: adds.total, directCorrect, warmupOK },
    evidence,
  };
}
