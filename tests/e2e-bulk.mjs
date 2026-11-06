// 일괄 채점 성능·감지 테스트 (FINAL_PLAN 9절 "평가 흐름")
// 실행: 1) node tools/serve.mjs   2) node tests/e2e-bulk.mjs
// 가상 결과물 40개(정상 35, 미작성 3, 내용 수정 2)를 한 번에 올려
// 1초 안팎 처리 · 수정 감지 2 · 미작성 표시 · CSV 41줄(머리글 포함)을 확인
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { buildResult } from '../core/codec.js';

const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const MODULE = 'matrix-mult';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const work = await mkdtemp(join(tmpdir(), 'aimath-bulk-'));
const dl = join(work, 'downloads');
const filesDir = join(work, 'files');
await mkdir(filesDir, { recursive: true });

// ---------- 가상 결과물 40개 ----------
const meta = JSON.parse(await readFile(new URL(`../modules/${MODULE}/module.json`, import.meta.url), 'utf8'));
const samples = JSON.parse(await readFile(new URL(`../samples/${MODULE}.json`, import.meta.url), 'utf8')).map((s) => s.result);
const paths = [];
let blankAnswers = 0; // 미작성 칸 수 (샘플에 원래 빈 답이 있는 경우도 셈)
for (let i = 0; i < 40; i++) {
  const base = samples[i % samples.length];
  const blank = i >= 35 && i < 38;
  const r = await buildResult({
    moduleMeta: meta, platformVersion: base.meta.platform_version,
    student: { class: '2-1', number: i + 1, name: `가상 ${String(i + 1).padStart(2, '0')}` },
    payload: base.payload, reflections: blank ? { q1: '', q2: '' } : base.reflections,
    createdAt: base.meta.created_at,
  });
  blankAnswers += Object.values(r.reflections).filter((v) => !String(v).trim()).length;
  if (i >= 38) r.payload.coefs.c11 = [1, 0, 0, 1, -1, 0, 1]; // 저장 뒤 내용 수정 → 체크섬 불일치
  const p = join(filesDir, `${MODULE}_2-1-${i + 1}.json`);
  await writeFile(p, JSON.stringify(r));
  paths.push(p);
}

// ---------- 브라우저 ----------
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9339',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) {
  try { const l = await (await fetch('http://127.0.0.1:9339/json')).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { /* 아직 */ }
  await sleep(200);
}
// 연결 이벤트를 놓치지 않게, 만든 즉시 기다림
await new Promise((r) => (ws.readyState === 1 ? r() : (ws.onopen = r)));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (d) => (d.error ? rej(new Error(d.error.message)) : res(d.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.text); return r.result.value; };
const ok = (m) => console.log('  ✔ ' + m);

try {
  await send('Page.enable'); await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await send('Page.navigate', { url: `${BASE}/teacher.html?id=${MODULE}` });
  for (let i = 0; i < 50; i++) { await sleep(200); if (await ev('!document.getElementById("workspace").hidden').catch(() => false)) break; }
  console.log(`[일괄 채점] ${MODULE} 40개`);
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file-input' });
  const t0 = Date.now();
  await send('DOM.setFileInputFiles', { nodeId, files: paths });
  for (let i = 0; i < 200; i++) { if (await ev('document.querySelectorAll(".grade-table tbody tr:not(.detail)").length') === 40) break; await sleep(50); }
  const ms = Date.now() - t0;
  assert.equal(await ev('document.querySelectorAll(".grade-table tbody tr:not(.detail)").length'), 40);
  ok(`40개 처리 ${ms}ms`);
  assert.ok(ms < 3000, `처리 시간 ${ms}ms (기준: 1초 안팎, 3초 넘으면 실패)`);
  const text = await ev('document.querySelector(".grade-table").textContent');
  assert.equal((text.match(/수정 감지/g) ?? []).length, 2); ok('수정 감지 2개');
  assert.equal(await ev('document.querySelectorAll(".grade-table .badge.muted").length'), blankAnswers); ok(`미작성 ${blankAnswers}칸 표시 (일부러 비운 3명 × 2칸 포함)`);
  await ev(`[...document.querySelectorAll('button')].find(b=>b.textContent.includes('CSV 내려받기')).click(); true`);
  let csvName;
  for (let i = 0; i < 40 && !csvName; i++) { await sleep(250); csvName = (await readdir(dl).catch(() => [])).find((f) => f.endsWith('.csv')); }
  const csv = await readFile(join(dl, csvName), 'utf8');
  assert.equal(csv.trim().split('\r\n').length, 41); ok('CSV 머리글 + 40줄');
  console.log('\n일괄 채점 테스트 통과');
} catch (e) {
  console.error('\n✖ 실패: ' + e.message); process.exitCode = 1;
} finally {
  ws?.close(); chrome.kill(); await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
}
