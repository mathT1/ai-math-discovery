// 브라우저 종단 테스트 (Chrome 필요, Actions에서는 실행하지 않음)
// 실행: 1) node tools/serve.mjs   2) node tests/e2e-browser.mjs [모듈id]
// 학생 활동 → PNG·JSON·제출 코드·인쇄 → 교사 페이지(파일·코드·수기 입력) → CSV 까지 실제로 눌러 봄
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';

const MODULE = process.argv[2] ?? '_template';
const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const CHROME = process.env.CHROME ?? [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].find(Boolean);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const work = await mkdtemp(join(tmpdir(), 'aimath-e2e-'));
const dl = join(work, 'downloads');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9333',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });

let ws; let id = 0; const pending = new Map(); const events = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9333/json')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* 아직 안 뜸 */ }
    await sleep(200);
  }
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); } else events.push(msg);
  };
}
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  pending.set(n, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: n, method, params }));
});
async function evaluate(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error('페이지 오류: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text));
  return r.result.value;
}
async function goto(url) {
  await send('Page.navigate', { url });
  for (let i = 0; i < 50; i++) { await sleep(200); if (await evaluate('document.readyState') === 'complete') break; }
  await sleep(800);
}
const click = (sel) => evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(sel)})); if(!e) throw new Error('버튼 없음: '+${JSON.stringify(sel)}); e.click(); return true})()`);
const setValue = (sel, v) => evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
async function waitFiles(count) {
  for (let i = 0; i < 40; i++) {
    const f = (await readdir(dl).catch(() => [])).filter((x) => !x.endsWith('.crdownload'));
    if (f.length >= count) return f;
    await sleep(250);
  }
  throw new Error(`다운로드 ${count}개를 기다리다 시간 초과`);
}

const ok = (msg) => console.log('  ✔ ' + msg);
try {
  await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  // 인쇄 대화상자 대신 표시만
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.print = () => { window.__printed = true; };' });

  console.log(`[학생] ${MODULE}`);
  await goto(`${BASE}/modules/${MODULE}/`);
  assert.equal(await evaluate('!!document.getElementById("tab-intro")'), true); ok('모듈 화면 표시');
  assert.equal(await evaluate('document.querySelectorAll(".katex").length > 0'), true); ok('수식(KaTeX) 표시');
  if (MODULE === '_template') {
    await click('탐구 활동');
    await setValue('#tpl-n', 10); await setValue('#tpl-answer', 55);
  }
  if (MODULE === 'no-three-in-line') {
    await click('탐구 활동');
    await setValue('#n3l-size', 6);
    const cellClick = (x, y) => evaluate(`document.querySelector('.n3l-pt[data-x="${x}"][data-y="${y}"]').click(); true`);
    // 공선 만들기: (0,0) (2,1) (4,2) — 기울기 1/2
    for (const [x, y] of [[0, 0], [2, 1], [4, 2]]) await cellClick(x, y);
    assert.equal(await evaluate('document.querySelectorAll(".n3l-pt.bad").length'), 3);
    assert.equal(await evaluate('document.querySelectorAll(".n3l-lines line").length'), 1);
    assert.match(await evaluate('document.querySelector(".n3l-status").textContent'), /기울기 1\/2/); ok('공선 표시 (점선·! 표시·기울기 1/2 목록)');
    for (const [x, y] of [[0, 0], [2, 1], [4, 2]]) await cellClick(x, y); // 지우기
    assert.equal(await evaluate('document.querySelectorAll(".n3l-pt.on").length'), 0); ok('다시 눌러 지우기');
    const sol = JSON.parse(await (await fetch(`${BASE}/modules/no-three-in-line/data/solutions.json`)).text()).solutions['6'];
    for (const [x, y] of sol) await cellClick(x, y);
    assert.match(await evaluate('document.querySelector(".n3l-status").textContent'), /성공/); ok('6×6에 12개 → 성공');
    await click('힌트: 놓을 수 없는 곳 보기');
    assert.ok(await evaluate('document.querySelectorAll(".n3l-pt.forbidden").length') > 0); ok('힌트: 금지 칸 표시');
    // 키보드: (0,0)으로 포커스 → 오른쪽·위 화살표 → (1,1)
    await evaluate(`(()=>{const b=document.querySelector('.n3l-pt[data-x="0"][data-y="0"]'); b.focus(); const bd=document.querySelector('.n3l-board');
      bd.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));
      return true})()`);
    const fx = await evaluate('document.activeElement.dataset.x + "," + document.activeElement.dataset.y');
    await evaluate(`(()=>{const bd=document.querySelector('.n3l-board'); for (const k of ['ArrowRight','ArrowUp']) bd.dispatchEvent(new KeyboardEvent('keydown',{key:k,bubbles:true})); return true})()`);
    const [x0, y0] = fx.split(',').map(Number);
    assert.equal(await evaluate('document.activeElement.dataset.x + "," + document.activeElement.dataset.y'), `${Math.min(5, x0 + 1)},${Math.min(5, y0 + 1)}`);
    ok('키보드 방향키 이동');
  }
  await click('AI와 비교');
  assert.equal(await evaluate('document.getElementById("compare-root").children.length > 0'), true); ok('AI 비교 화면');
  await click('정리');
  await evaluate(`document.querySelectorAll('[id^="q-"]').forEach(t=>{t.value='=SUM(A1) 짝지으면 11이 5쌍'; t.dispatchEvent(new Event('input'))}); true`);
  await click('결과물 제출');
  await setValue('#st-class', '1-5'); await setValue('#st-number', 12); await setValue('#st-name', '홍길동');

  await click('① 보고서 저장'); await click('② 제출 파일 저장');
  const files = await waitFiles(2);
  assert.ok(files.some((f) => f.endsWith('.png')) && files.some((f) => f.endsWith('.json'))); ok(`클래스룸: ${files.join(', ')}`);
  const jsonName = files.find((f) => f.endsWith('.json'));
  const result = JSON.parse(await readFile(join(dl, jsonName), 'utf8'));
  assert.equal(result.student.name, '홍길동'); assert.match(result.checksum, /^sha256:/); ok('JSON 내용·체크섬');
  const png = await readFile(join(dl, files.find((f) => f.endsWith('.png'))));
  assert.ok(png.length > 20000); ok(`PNG 보고서 ${Math.round(png.length / 1024)}KB`);

  await evaluate(`document.querySelector('input[value="padlet"]').click(); true`);
  assert.equal(await evaluate('document.getElementById("st-name").disabled'), true); ok('패들릿: 이름 칸 기본 비활성');
  await click('② 제출 코드 복사'); await sleep(800);
  const code = await evaluate('document.getElementById("code-preview").textContent');
  assert.match(code, new RegExp(`^\\[${MODULE}:1-5-12:[A-Za-z0-9_-]+\\]$`)); ok(`패들릿: 제출 코드 ${code.length}자`);

  await evaluate(`document.querySelector('input[value="mail"]').click(); true`);
  await click('③ 메일 제목 복사'); ok('메일: 제목 복사 버튼');
  await evaluate(`document.querySelector('input[value="print"]').click(); true`);
  await click('인쇄하기'); await sleep(1500);
  assert.equal(await evaluate('window.__printed === true && !!document.querySelector("#print-area img")'), true); ok('출력물: 인쇄용 보고서');

  await goto(`${BASE}/modules/${MODULE}/`);
  assert.equal(await evaluate('document.getElementById("tab-submit").getAttribute("aria-selected")'), 'true');
  assert.equal(await evaluate(`document.querySelector('[id^="q-"]').value.length > 0`), true); ok('새로고침해도 오늘 기록 복원');
  assert.equal(await evaluate('localStorage.getItem("aimath:" + ' + JSON.stringify(MODULE) + ').includes("홍길동")'), false); ok('임시 저장에 이름 없음');

  console.log('[교사]');
  await goto(`${BASE}/teacher.html?drafts&id=${MODULE}`);
  const { root } = await send('DOM.getDocument');
  const { nodeId } = await send('DOM.querySelector', { nodeId: root.nodeId, selector: '#file-input' });
  await send('DOM.setFileInputFiles', { nodeId, files: [join(dl, jsonName)] });
  await sleep(800);
  await evaluate(`document.getElementById('code-input').value = '게시물\\n' + ${JSON.stringify(code.replace('1-5-12', '1-5-12'))}; true`);
  await click('코드 읽기'); await sleep(800);
  await setValue('#m-cls', '1-5'); await setValue('#m-num', 3);
  await click('학생 추가'); await sleep(300);
  const rows = await evaluate('document.querySelectorAll(".grade-table tbody tr:not(.detail)").length');
  assert.equal(rows, 3); ok('파일 1 + 코드 1 + 수기 1 = 3줄');
  assert.equal(await evaluate('document.querySelectorAll(".badge").length > 0 && document.body.textContent.includes("중복")'), true); ok('같은 학생 중복 표시');
  // 모든 교사 칸 채우기
  await evaluate(`document.querySelectorAll('.grade-table select').forEach(s=>{s.value=s.options[1].value; s.dispatchEvent(new Event('change'))}); true`);
  await sleep(200);
  await evaluate(`document.querySelectorAll('.grade-table .score-input').forEach(s=>{s.value='10'; s.dispatchEvent(new Event('change'))}); true`);
  await sleep(200);
  await click('CSV 내려받기');
  const all = await waitFiles(files.length + 1);
  const csvName = all.find((f) => f.endsWith('.csv'));
  const csv = await readFile(join(dl, csvName), 'utf8');
  assert.ok(csv.startsWith('\uFEFF')); assert.equal(csv.trim().split('\r\n').length, 4);
  assert.ok(csv.includes("'=SUM")); ok(`CSV ${csvName} (BOM, 헤더+3줄, 수식 막기)`);
  console.log('\n종단 테스트 통과');
} catch (e) {
  console.error('\n✖ 실패: ' + e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill();
  await sleep(500);
  if (process.env.KEEP) console.log('다운로드 파일: ' + dl);
  else await rm(work, { recursive: true, force: true }).catch(() => {});
}
