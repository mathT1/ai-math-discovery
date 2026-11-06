// 플랫폼 본체 테스트 — node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalJSON, buildResult, verifyChecksum, encodeSubmission, decodeSubmissions,
  bytesToBase64url, base64urlToBytes, whoTag,
} from '../core/codec.js';
import { validate, validateResult } from '../core/validate.js';
import { scoreAuto, levelFor, gradeRow, toCSV, maxTotal } from '../core/grade.js';
import { readFile } from 'node:fs/promises';

const tplMeta = JSON.parse(await readFile(new URL('../modules/_template/module.json', import.meta.url), 'utf8'));
const tplRubric = JSON.parse(await readFile(new URL('../modules/_template/rubric.json', import.meta.url), 'utf8'));
const tplSchema = JSON.parse(await readFile(new URL('../modules/_template/schema.json', import.meta.url), 'utf8'));
const tplGrader = await import('../modules/_template/grader.js');

const make = (over = {}) => buildResult({
  moduleMeta: tplMeta, platformVersion: '0.1.0',
  student: { class: '1-5', number: 12, name: '홍길동' },
  payload: { n: 10, answer: 55 }, reflections: { q1: '1과 10, 2와 9를 짝지으면 11이 5쌍' },
  createdAt: '2026-11-06T10:00:00+09:00', ...over,
});

test('canonicalJSON: 키 순서와 상관없이 같은 문자열', () => {
  assert.equal(canonicalJSON({ b: 1, a: [1, { d: 2, c: 3 }] }), canonicalJSON({ a: [1, { c: 3, d: 2 }], b: 1 }));
  assert.equal(canonicalJSON({ a: undefined, b: null }), '{"b":null}');
});

test('base64url 왕복', () => {
  const bytes = new Uint8Array([0, 1, 250, 251, 252, 253, 254, 255]);
  assert.deepEqual(base64urlToBytes(bytesToBase64url(bytes)), bytes);
  assert.match(bytesToBase64url(bytes), /^[A-Za-z0-9_-]+$/);
});

test('체크섬: 정상 / 수정 감지 / 없음', async () => {
  const r = await make();
  assert.match(r.checksum, /^sha256:[0-9a-f]{64}$/);
  assert.equal(await verifyChecksum(r), 'ok');
  const tampered = structuredClone(r);
  tampered.payload.answer = 56;
  assert.equal(await verifyChecksum(tampered), 'modified');
  const nameChanged = structuredClone(r);
  nameChanged.student.name = '김철수';
  assert.equal(await verifyChecksum(nameChanged), 'modified');
  assert.equal(await verifyChecksum({ ...r, checksum: null }), 'missing');
});

test('제출 코드: 패들릿 글 속에 섞여 있어도 여러 개를 찾아 복원', async () => {
  const a = await make();
  const b = await make({ student: { class: '1-5', number: 3, name: '' } });
  const codeA = await encodeSubmission(a);
  const codeB = await encodeSubmission(b);
  assert.match(codeA, /^\[_template:1-5-12:[A-Za-z0-9_-]+\]$/);
  const pasted = `홍길동 게시물\n제출합니다!\n${codeA}\n\n  다른 학생 ${codeB} 끝   `;
  const { results, errors } = await decodeSubmissions(pasted);
  assert.equal(errors.length, 0);
  assert.equal(results.length, 2);
  assert.deepEqual(results[0], a);
  assert.equal(await verifyChecksum(results[1]), 'ok');
});

test('제출 코드: 잘린 코드는 오류로 보고', async () => {
  const code = await encodeSubmission(await make());
  const broken = code.slice(0, 30) + code.slice(40);
  const { results, errors } = await decodeSubmissions(broken);
  assert.equal(results.length, 0);
  assert.equal(errors.length, 1);
});

test('whoTag: 반·번호에서 안전한 글자만', () => {
  assert.equal(whoTag({ class: '1학년 5반', number: 7 }), '15-7');
  assert.equal(whoTag({ class: '1-5', number: 12 }), '1-5-12');
});

test('validate: 형식 검사', () => {
  assert.deepEqual(validate(tplSchema, { n: 10, answer: 55 }), []);
  assert.deepEqual(validate(tplSchema, { n: 10, answer: null }), []);
  assert.ok(validate(tplSchema, { n: 0, answer: 1 }).length);       // 범위
  assert.ok(validate(tplSchema, { n: 1.5, answer: 1 }).length);     // 정수 아님
  assert.ok(validate(tplSchema, { n: 1 }).length);                  // 필수 빠짐
  assert.ok(validate(tplSchema, { n: 1, answer: 1, x: 1 }).length); // 모르는 항목
  assert.ok(validate(tplSchema, { n: NaN, answer: 1 }).length);     // NaN 막기 (Antigravity M1)
  assert.ok(validate({ type: 'number' }, Infinity).length);
});

test('validateResult: 겉포장 + payload', async () => {
  const r = await make();
  assert.deepEqual(validateResult(r, tplSchema), []);
  assert.ok(validateResult({ ...r, format: 'x' }, tplSchema).length);
  assert.ok(validateResult({ ...r, student: { class: '', number: 0 } }, tplSchema).length);
  assert.ok(validateResult({ ...r, payload: { n: 'ten', answer: 1 } }, tplSchema).length);
});

test('scoreAuto: 구간표는 위에서부터 처음 맞는 구간', () => {
  const item = { id: 'c', metric: 'ratio', max: 20, tiers: [{ min: 1, score: 20 }, { min: 0.8, score: 12 }, { min: 0.6, score: 6 }] };
  assert.equal(scoreAuto(item, { ratio: 1 }).score, 20);
  assert.equal(scoreAuto(item, { ratio: 0.85 }).score, 12);
  assert.equal(scoreAuto(item, { ratio: 0.6 }).score, 6);
  assert.equal(scoreAuto(item, { ratio: 0.3 }).score, 0);
  assert.equal(scoreAuto(item, {}).score, 0);
  const z = { id: 'v', metric: 'bad', max: 20, tiers: [{ max: 0, score: 20 }] };
  assert.equal(scoreAuto(z, { bad: 0 }).score, 20);
  assert.equal(scoreAuto(z, { bad: 2 }).score, 0);
});

test('levelFor: 백분율 → A~E', () => {
  const r = { scale: ['A', 'B', 'C', 'D', 'E'], level_cut: { A: 90, B: 80, C: 70, D: 60 } };
  assert.equal(levelFor(100, r), 'A');
  assert.equal(levelFor(90, r), 'A');
  assert.equal(levelFor(89.9, r), 'B');
  assert.equal(levelFor(60, r), 'D');
  assert.equal(levelFor(0, r), 'E');
});

test('gradeRow: 자동 + 교사, 서술형은 자동 점수 없음 [D11]', async () => {
  const r = await make();
  const { values } = tplGrader.metrics(r.payload);
  const before = gradeRow({ rubric: tplRubric, values, reflections: r.reflections });
  assert.equal(before.items[0].score, 40);
  assert.equal(before.items[1].score, null); // 교사가 아직 안 매김 → 자동 점수 없음
  assert.equal(before.items[1].answered, true);
  assert.equal(before.complete, false);
  const after = gradeRow({ rubric: tplRubric, values, reflections: r.reflections, manual: { q1: 60 } });
  assert.equal(after.total, 100);
  assert.equal(after.level, 'A');
  assert.equal(after.complete, true);
});

test('gradeRow: 출력물(원자료 없음)은 자동 항목도 교사가 입력', () => {
  const g = gradeRow({ rubric: tplRubric, values: null, manual: { correct: 40, q1: 20 } });
  assert.equal(g.items[0].type, 'auto-manual');
  assert.equal(g.total, 60);
  assert.equal(g.level, 'D');
  assert.equal(gradeRow({ rubric: tplRubric, values: null, manual: { correct: 999 } }).items[0].score, 40); // 만점 넘지 않음
});

test('채점은 원자료로 다시 계산: 학생이 답을 고치면 결과도 바뀜 [D10]', async () => {
  const wrong = await make({ payload: { n: 10, answer: 50 } });
  const { values } = tplGrader.metrics(wrong.payload);
  assert.equal(gradeRow({ rubric: tplRubric, values }).items[0].score, 0);
});

test('toCSV: BOM, 따옴표, 엑셀 수식 막기', () => {
  const csv = toCSV([['이름', '답'], ['홍길동', '=1+1'], ['김"철수', '줄\n바꿈'], ['박', -3]]);
  assert.ok(csv.startsWith('﻿'));
  assert.ok(csv.includes("'=1+1"));
  assert.ok(csv.includes('"김""철수"'));
  assert.ok(csv.includes('"줄\n바꿈"'));
  assert.ok(csv.includes('박,-3'));
  const ws = toCSV([[' =1+1'], ['\n@SUM(A1)']]); // 공백·줄바꿈 뒤 수식 (Antigravity M1)
  assert.ok(ws.includes("' =1+1"));
  assert.ok(ws.includes(`"'\n@SUM(A1)"`));
});

test('maxTotal', () => assert.equal(maxTotal(tplRubric), 100));
