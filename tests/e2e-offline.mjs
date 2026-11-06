// 오프라인 종단 테스트 (Chrome 필요, Actions에서는 실행하지 않음)
// 실행: node tools/build-index.mjs && node tests/e2e-offline.mjs
// 이 스크립트가 직접 작은 서버를 띄웠다가 **실제로 끕니다** (네트워크 흉내가 아니라 진짜 끊김)
//  1) 첫 접속 → 사이트 파일 전체 저장 ("준비 완료" 표시)
//  2) 서버 끔 → 홈·두 모듈(활동·수식·보고서 저장)·교사(샘플 30명)·지도안이 동작
//  3) 서버 다시 켬 + 새 버전 → [새로고침] 안내 → 누르면 새 버전 적용
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, normalize, extname, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8123;
const BASE = `http://localhost:${PORT}`;
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.woff2': 'font/woff2' };

// ---------- 끄고 켤 수 있는 서버 ----------
let server = null;
let nextVersion = false; // true면 sw.js의 VERSION을 바꿔서 줌 (새 배포 흉내)
let requests = 0;
function startServer() {
  server = createServer(async (req, res) => {
    requests++;
    try {
      let path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      let file = normalize(join(ROOT, path));
      if (!file.startsWith(ROOT + sep) && file !== ROOT) { res.writeHead(403).end(); return; }
      if ((await stat(file)).isDirectory()) {
        if (!path.endsWith('/')) { res.writeHead(301, { Location: path + '/' }).end(); return; }
        file = join(file, 'index.html');
      }
      let body = await readFile(file);
      if (path.endsWith('/sw.js') && nextVersion) body = Buffer.from(body.toString('utf8').replace(/const VERSION = "([^"]+)"/, 'const VERSION = "$1-next"'));
      res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
      res.end(body);
    } catch { res.writeHead(404).end(); }
  });
  return new Promise((r) => server.listen(PORT, '127.0.0.1', r));
}
function stopServer() {
  return new Promise((r) => { server.closeAllConnections?.(); server.close(() => r()); });
}

// ---------- Chrome ----------
const work = await mkdtemp(join(tmpdir(), 'aimath-off-'));
const dl = join(work, 'downloads');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9334',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map(); const failures = [];
async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch('http://127.0.0.1:9334/json')).json();
      const page = list.find((t) => t.type === 'page');
      if (page) { ws = new WebSocket(page.webSocketDebuggerUrl); break; }
    } catch { /* 아직 */ }
    await sleep(200);
  }
  await new Promise((r) => (ws.onopen = r));
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    // 오프라인 중 실패한 파일 기록 (favicon은 사이트에 없으므로 제외)
    if (msg.method === 'Network.responseReceived' && msg.params.response.status >= 400 && !/favicon/.test(msg.params.response.url)) failures.push(`${msg.params.response.status} ${msg.params.response.url}`);
    if (msg.method === 'Network.loadingFailed' && !/favicon/.test(msg.params.errorText) && msg.params.type !== 'Other') failures.push(`실패 ${msg.params.type} ${msg.params.errorText}`);
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
  for (let i = 0; i < 50; i++) { await sleep(200); try { if (await evaluate('document.readyState') === 'complete') break; } catch { /* 이동 중 */ } }
  await sleep(1000);
}
async function waitFor(expr, ms = 15000) {
  for (let t = 0; t < ms; t += 250) { try { if (await evaluate(expr)) return true; } catch { /* 이동 중 */ } await sleep(250); }
  throw new Error('시간 초과: ' + expr);
}
const click = (text) => evaluate(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})); if(!e) throw new Error('버튼 없음: '+${JSON.stringify(text)}); e.click(); return true})()`);
const ok = (msg) => console.log('  ✔ ' + msg);

try {
  await startServer();
  await connect();
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });

  console.log('[1] 첫 접속 — 미리 저장');
  await goto(`${BASE}/?sw=1`);
  await waitFor('document.getElementById("offline-status")?.dataset.ready === "1"', 30000);
  const status = await evaluate('document.getElementById("offline-status").textContent');
  assert.match(status, /준비 완료/); ok(status);

  console.log('[2] 서버 끔 — 진짜 오프라인');
  await stopServer();
  await send('Network.enable');
  failures.length = 0;
  assert.equal(await fetch(`${BASE}/`).then(() => 'up', () => 'down'), 'down'); ok('서버 꺼짐 확인');

  await goto(`${BASE}/`);
  await waitFor('document.querySelectorAll("#module-list a, #module-list .card").length >= 2');
  ok(`홈: 모듈 카드 ${await evaluate('document.querySelectorAll("#module-list .card").length')}개`);

  await goto(`${BASE}/modules/no-three-in-line/`);
  await waitFor('!!document.getElementById("tab-activity")');
  await waitFor('document.querySelectorAll(".katex").length > 0');
  // 글꼴 파일을 직접 요청 → 저장된 파일로 불러와지는지 (숨은 탭의 수식은 글꼴을 아직 요청하지 않으므로)
  const loaded = await evaluate('document.fonts.load("1em KaTeX_Main").then(fs=>fs.filter(f=>f.status==="loaded").length)');
  assert.ok(loaded > 0, 'KaTeX_Main 글꼴을 불러오지 못함'); ok('no-three-in-line: 화면·수식(KaTeX 글꼴 로드됨)');
  await evaluate(`document.getElementById('tab-activity').click(); true`);
  await evaluate(`[[0,0],[2,1],[4,2]].forEach(([x,y])=>document.querySelector('.n3l-pt[data-x="'+x+'"][data-y="'+y+'"]').click()); true`);
  assert.equal(await evaluate('document.querySelectorAll(".n3l-pt.bad").length'), 3); ok('no-three-in-line: 활동(공선 표시)');

  await goto(`${BASE}/modules/matrix-mult/?submit=classroom`);
  await waitFor('!!document.getElementById("tab-activity")');
  await evaluate(`document.getElementById('tab-activity').click(); true`);
  await evaluate(`(()=>{const s=document.querySelector('select[aria-label="c₁₂ 만들기: M3 앞의 부호"]'); s.value='1'; s.dispatchEvent(new Event('change',{bubbles:true})); return true})()`);
  assert.match(await evaluate('document.querySelector("#mm-c12").textContent'), /a₁₁b₁₂/); ok('matrix-mult: 활동(전개식)');
  await evaluate(`document.getElementById('tab-submit').click(); true`);
  await sleep(300);
  for (const [sel, v] of [['#st-class', '1-3'], ['#st-number', '7'], ['#st-name', '오프라인']]) {
    await evaluate(`(()=>{const e=document.querySelector('${sel}'); e.value='${v}'; e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
  }
  await click('① 보고서 저장'); await click('② 제출 파일 저장');
  let files = [];
  for (let i = 0; i < 40 && files.length < 2; i++) { await sleep(250); files = (await readdir(dl).catch(() => [])).filter((f) => !f.endsWith('.crdownload')); }
  assert.equal(files.length, 2); ok(`matrix-mult: 보고서·제출 파일 저장 (${files.join(', ')})`);

  await goto(`${BASE}/teacher.html?id=matrix-mult`);
  await waitFor('!!document.getElementById("sample-load") && !document.getElementById("workspace").hidden');
  await click('샘플 학급 불러오기');
  await waitFor('document.querySelectorAll(".grade-table tbody tr:not(.detail)").length === 30');
  ok('교사: 샘플 30명 불러오기');
  const levels = await evaluate(`[...document.querySelectorAll('.grade-table tbody tr:not(.detail)')].map(r=>r.textContent).join(' ')`);
  assert.match(levels, /A/); ok('교사: 미리 채운 점수로 성취수준 표시');

  await goto(`${BASE}/guide.html?id=no-three-in-line`);
  await waitFor('document.getElementById("guide").textContent.includes("사실–출처 표")');
  ok('지도안 보기');
  assert.deepEqual(failures, [], '오프라인 중 못 불러온 파일'); ok('오프라인 중 못 불러온 파일 0개');
  await send('Network.disable');

  console.log('[3] 서버 켬 + 새 버전 배포');
  nextVersion = true;
  await startServer();
  await goto(`${BASE}/`);
  await evaluate('navigator.serviceWorker.getRegistration().then(r=>r.update()).then(()=>true)');
  await waitFor('!!document.getElementById("sw-update")', 30000);
  ok('[새로고침] 안내 표시');
  await click('새로고침');
  await waitFor('document.getElementById("offline-status")?.textContent.includes("-next")', 30000);
  ok(`새 버전 적용: ${await evaluate('document.getElementById("offline-status").textContent')}`);
  assert.equal(await evaluate('caches.keys().then(k=>k.filter(x=>x.startsWith("aimath-")).length)'), 1); ok('옛 캐시 삭제');

  console.log('[4] ?nosw — 저장 해제');
  await goto(`${BASE}/?nosw`);
  await waitFor('document.getElementById("offline-status")?.textContent.includes("해제")');
  assert.equal(await evaluate('navigator.serviceWorker.getRegistrations().then(r=>r.length)'), 0);
  assert.equal(await evaluate('caches.keys().then(k=>k.filter(x=>x.startsWith("aimath-")).length)'), 0); ok('등록·캐시 모두 해제');

  console.log('\n오프라인 종단 테스트 통과');
} catch (e) {
  console.error('\n✖ 실패: ' + e.message);
  process.exitCode = 1;
} finally {
  ws?.close();
  chrome.kill();
  await stopServer().catch(() => {});
  await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
  process.exit(process.exitCode ?? 0);
}
