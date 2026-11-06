// 출품 자료 만들기 ② — 시연 영상 (자막 포함, 소리 없음)
// 실행: 1) node tools/serve.mjs   2) node tools/exhibition/record-demo.mjs
//       → out/exhibition/video/frames/ 에 화면을 기록한 뒤 encode-video.py로 mp4를 만듦
//       (Python + opencv-python 필요. 없으면 frames만 남고, 선생님이 화면 녹화로 대신해도 됨)
// 내용: 홈 → 활동 1(점 찍기·공선·성공·힌트·AI 비교·제출·보고서) → 활동 2(곱셈 8번·블록 조립·AI 비교) → 교사 일괄 채점 → 오프라인 → 끝
// 학생 정보는 샘플만 사용
import { spawn, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OUT = join(ROOT, 'out', 'exhibition', 'video');
const FRAMES = join(OUT, 'frames');
const W = 1280, H = 720;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await rm(FRAMES, { recursive: true, force: true });
await mkdir(FRAMES, { recursive: true });

const work = await mkdtemp(join(tmpdir(), 'aimath-rec-'));
const dl = join(work, 'dl');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--remote-debugging-port=9341',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) {
  try { const l = await (await fetch('http://127.0.0.1:9341/json')).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { /* 아직 */ }
  await sleep(200);
}
await new Promise((r) => (ws.readyState === 1 ? r() : (ws.onopen = r)));

// 화면 기록: 0.1초마다 직접 화면을 찍어 시각과 함께 저장
// (Chrome screencast는 헤드리스에서 초당 2~3장만 와서 끊겨 보임)
const frames = [];
let writing = Promise.resolve();
let recording = false;
let recorderDone = Promise.resolve();
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
};
function startRecorder() {
  recording = true;
  recorderDone = (async () => {
    while (recording) {
      const t = Date.now();
      try {
        // 응답이 없으면 2초 뒤 건너뜀 (마지막 장면에서 응답 없이 멈춘 적이 있음)
        const r = await Promise.race([send('Page.captureScreenshot', { format: 'jpeg', quality: 80 }), sleep(2000).then(() => { throw new Error('시간 초과'); })]);
        const file = `f${String(frames.length).padStart(6, '0')}.jpg`;
        frames.push({ file, t: t / 1000 });
        writing = writing.then(() => writeFile(join(FRAMES, file), Buffer.from(r.data, 'base64')));
      } catch { /* 페이지 이동 중 */ }
      const wait = 100 - (Date.now() - t);
      if (wait > 0) await sleep(wait);
    }
  })();
}
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };

// ---------- 연출 도구 (페이지에 자막·제목 카드·강조 테두리를 덧씌움) ----------
const OVERLAY = `
(() => {
  if (window.__demo) return;
  const css = document.createElement('style');
  css.textContent = \`
    #demo-cap { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%); z-index: 2147483647; max-width: 1400px;
      background: rgba(10,14,22,.86); color: #fff; font: 600 30px/1.45 "Malgun Gothic", sans-serif; padding: 12px 22px; border-radius: 12px;
      text-align: center; box-shadow: 0 6px 24px rgba(0,0,0,.3); transition: opacity .25s; }
    #demo-cap:empty { opacity: 0; }
    #demo-card { position: fixed; inset: 0; z-index: 2147483646; display: grid; place-items: center; background: #0f2a57; color: #fff; text-align: center;
      font-family: "Malgun Gothic", sans-serif; }
    #demo-card h1 { font-size: 64px; margin: 0 0 18px; color: #fff; } #demo-card p { font-size: 32px; margin: 0; opacity: .9; }
    #demo-card img { max-height: 820px; box-shadow: 0 10px 40px rgba(0,0,0,.4); background: #fff; }
    .demo-hl { outline: 4px solid #ffbf47 !important; outline-offset: 3px; border-radius: 6px; }
  \`;
  document.head.append(css);
  const cap = document.createElement('div'); cap.id = 'demo-cap'; document.body.append(cap);
  window.__demo = {
    cap: (t) => { cap.textContent = t; },
    card: (h, p, img) => { let c = document.getElementById('demo-card'); if (!c) { c = document.createElement('div'); c.id = 'demo-card'; document.body.append(c); }
      c.innerHTML = img ? '<div><img src="' + img + '"></div>' : '<div><h1></h1><p></p></div>';
      if (!img) { c.querySelector('h1').textContent = h; c.querySelector('p').textContent = p; } },
    uncard: () => document.getElementById('demo-card')?.remove(),
  };
})();`;
async function go(url, wait = 1800) { await send('Page.navigate', { url }); await sleep(wait); await ev(OVERLAY); }
const cap = (t) => ev(`window.__demo.cap(${JSON.stringify(t)}); true`);
async function card(h, p, ms) { await ev(OVERLAY); await ev(`window.__demo.card(${JSON.stringify(h)}, ${JSON.stringify(p)}); true`); await cap(''); await sleep(ms); await ev('window.__demo.uncard(); true'); }
/** 요소를 강조한 뒤 누름 */
async function hlClick(selExpr, before = 450) {
  await ev(`(()=>{const e=${selExpr}; e.scrollIntoView({block:'nearest'}); e.classList.add('demo-hl'); return true})()`);
  await sleep(before);
  await ev(`(()=>{const e=${selExpr}; e.click(); setTimeout(()=>e.classList.remove('demo-hl'), 300); return true})()`);
}
const btn = (text) => `[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)}))`;
const pt = (x, y) => `document.querySelector('.n3l-pt[data-x="${x}"][data-y="${y}"]')`;
async function scrollSlow(total, ms) {
  const steps = Math.max(1, Math.round(ms / 60));
  for (let i = 0; i < steps; i++) { await ev(`window.scrollBy(0, ${total / steps}); true`); await sleep(60); }
}
async function pick(label, v) {
  const sel = `document.querySelector('select[aria-label="${label}"]')`;
  await ev(`(()=>{const s=${sel}; s.scrollIntoView({block:'nearest'}); s.classList.add('demo-hl'); return true})()`);
  await sleep(420);
  await ev(`(()=>{const s=${sel}; s.value='${v}'; s.dispatchEvent(new Event('change',{bubbles:true})); setTimeout(()=>s.classList.remove('demo-hl'),250); return true})()`);
  await sleep(380);
}
async function typeInto(sel, text, cps = 40) {
  await ev(`document.querySelector('${sel}').scrollIntoView({block:'center'}); document.querySelector('${sel}').focus(); true`);
  for (let i = 1; i <= text.length; i += 3) {
    await ev(`(()=>{const e=document.querySelector('${sel}'); e.value=${JSON.stringify(text)}.slice(0,${i}); e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
    await sleep(1000 / cps * 3);
  }
  await ev(`(()=>{const e=document.querySelector('${sel}'); e.value=${JSON.stringify(text)}; e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
}

try {
  await send('Page.enable');
  // 화면은 1440×810으로 그리고 0.889배로 찍어 1280×720 영상에 더 많이 담음 (6×6 격자가 잘리지 않게)
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 810, deviceScaleFactor: W / 1440, mobile: false });
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.print = () => {};' });
  // 기록 전: 오프라인 저장을 미리 해 둠 (마지막 장면에서 "준비 완료"를 보여 주려고)
  await send('Page.navigate', { url: `${BASE}/?sw=1` }); await sleep(5000);
  await ev('localStorage.clear(); true');
  startRecorder();
  const t0 = Date.now();
  const mark = (name) => console.log(`  ${((Date.now() - t0) / 1000).toFixed(0).padStart(3)}초  ${name}`);

  // 0. 시작
  await go(`${BASE}/`);
  mark('시작 카드');
  await card('AI 수학 발견 수업 플랫폼', 'AI가 수학 난제를 탐구한 실제 연구를, 고등학교 수학 시간에', 5000);

  // 1. 홈
  mark('홈');
  await cap('설치 없이 브라우저에서 바로 씁니다. 과목·단원·주제로 활동을 찾습니다.'); await sleep(4500);
  await cap('학생 정보는 어디에도 전송·저장되지 않습니다. 모든 처리는 학생의 브라우저 안에서.'); await sleep(4500);

  // 2. 활동 1
  await card('활동 1 · 공통수학2 도형의 방정식', '세 점이 한 직선 위에 놓이지 않게', 3200);
  mark('활동 1');
  await go(`${BASE}/modules/no-three-in-line/`);
  await cap('도입: "6×6 격자에 점을 최대 몇 개까지 찍을 수 있을까?"'); await sleep(4500);
  await hlClick(`document.getElementById('tab-activity')`); await sleep(800);
  await ev(`document.querySelector('.n3l-controls').scrollIntoView({block:'start'}); true`); await sleep(500);
  await cap('격자를 눌러 점을 찍습니다. 조건은 하나 — 어느 세 점도 한 직선 위에 있으면 안 됩니다.'); await sleep(2500);
  await hlClick(pt(0, 0)); await sleep(500); await hlClick(pt(2, 1)); await sleep(500);
  await cap('가로·세로·대각선만이 아닙니다. 기울기가 1/2인 직선도…'); await sleep(1200);
  await hlClick(pt(4, 2)); await sleep(800);
  await cap('화면이 바로 알려 줍니다. 색뿐 아니라 네모 모양·느낌표·점선·기울기 목록으로 함께 표시합니다.'); await sleep(5500);
  for (const [x, y] of [[4, 2], [2, 1], [0, 0]]) { await ev(`${pt(x, y)}.click(); true`); await sleep(200); }
  await cap('규칙을 지키며 하나씩… 6×6에 12개(2n개)를 찍으면 성공!');
  const sol = JSON.parse(await readFile(join(ROOT, 'modules', 'no-three-in-line', 'data', 'solutions.json'), 'utf8')).solutions['6'];
  for (const [x, y] of sol) { await hlClick(pt(x, y), 180); await sleep(260); }
  await sleep(2500);
  await hlClick(btn('힌트')); await sleep(600);
  await cap('막히면 힌트: 지금 놓을 수 없는 곳을 ×와 빗금으로 보여 줍니다.'); await sleep(4000);
  await hlClick(btn('힌트')); await sleep(400);

  mark('활동 1 · AI와 비교');
  await hlClick(`document.getElementById('tab-compare')`); await sleep(1200);
  await cap('AI와 비교: 나의 배치와 2n개 배치 예, 그리고 왜 최대 2n개인지.'); await sleep(4500);
  await cap('경우의 수: 6×6에서 점 12개를 고르는 방법만 12억 가지가 넘습니다.'); await scrollSlow(520, 2500); await sleep(3500);
  await cap('연구 결과: 고전 방법은 19×19까지 최적을 증명, AI는 작은 격자에서 경쟁력. 과장 없이 정확하게.'); await scrollSlow(700, 2500); await sleep(4500);

  mark('활동 1 · 정리·제출');
  await ev('window.scrollTo(0,0); true');
  await hlClick(`document.getElementById('tab-reflect')`); await sleep(800);
  await cap('정리 질문에 답합니다.');
  await typeInto('#q-q1', '직선 AB와 AC의 기울기가 같으면 세 점은 한 직선 위에 있다. 세로선은 분모를 곱한 식으로 판정한다.');
  await typeInto('#q-q2', '한 가로줄에 3개면 한 직선이 되므로 줄마다 2개 이하, n줄이므로 2n개 이하이다.');
  await sleep(1200);
  await ev('window.scrollTo(0,0); true');
  await hlClick(`document.getElementById('tab-submit')`); await sleep(1000);
  await cap('제출 방법 4가지 — 구글 클래스룸 · 패들릿 · 메일 · 출력물. 학교 사정에 맞게 고릅니다.'); await sleep(4500);
  for (const [sel, v] of [['#st-class', '1-3'], ['#st-number', '1'], ['#st-name', '샘플 01']]) {
    await ev(`(()=>{const e=document.querySelector('${sel}'); e.value='${v}'; e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`); await sleep(350);
  }
  await hlClick(btn('① 보고서 저장')); await sleep(800);
  await cap('PNG 보고서와 채점용 JSON 파일을 저장해 과제로 냅니다.'); await sleep(2500);
  let png;
  for (let i = 0; i < 40 && !png; i++) { await sleep(200); png = (await readdir(dl).catch(() => [])).find((f) => f.endsWith('.png')); }
  if (png) {
    const data = 'data:image/png;base64,' + (await readFile(join(dl, png))).toString('base64');
    await ev(`window.__demo.card('', '', ${JSON.stringify(data)}); true`);
    await cap('학생 보고서: 활동 결과 · 다시 계산한 값 · 답 · 교사 채점란. 그대로 인쇄도 됩니다.'); await sleep(5500);
    await ev('window.__demo.uncard(); true');
  }

  // 3. 활동 2
  await card('활동 2 · 공통수학1 행렬', '곱셈 한 번을 줄여라 — 스트라센과 AI AlphaTensor', 3200);
  mark('활동 2');
  await go(`${BASE}/modules/matrix-mult/`);
  await hlClick(`document.getElementById('tab-activity')`); await sleep(800);
  await cap('2×2 행렬의 곱을 정의대로 계산하면…');
  for (const [i, v] of [19, 22, 43, 50].entries()) { await typeInto(`#mm-d${i}`, String(v), 20); await sleep(250); }
  await sleep(600);
  await cap('곱셈 8번, 덧셈 4번. 곱셈을 7번으로 줄일 수 있을까요?'); await sleep(3500);
  await ev(`document.querySelector('.mm-mode').scrollIntoView({block:'start'}); true`); await sleep(800);
  await cap('스트라센의 블록 7개를 더하고 빼서 네 성분을 만듭니다. 고를 때마다 전개식과 지워지는 항이 보입니다.');
  const ans = { 'c₁₂': [0, 0, 1, 0, 1, 0, 0], 'c₂₁': [0, 1, 0, 1, 0, 0, 0], 'c₁₁': [1, 0, 0, 1, -1, 0, 1], 'c₂₂': [1, -1, 1, 0, 0, 1, 0] };
  for (const [e, cs] of Object.entries(ans)) {
    for (let k = 0; k < 7; k++) if (cs[k]) await pick(`${e} 만들기: M${k + 1} 앞의 부호`, cs[k]);
    await sleep(700);
    if (e === 'c₁₁') { await cap('목표에 없는 항은 반대 부호의 블록으로 지웁니다 — 전개와 소거.'); await sleep(2500); }
  }
  await ev(`document.querySelector('.mm-count').scrollIntoView({block:'center'}); true`); await sleep(600);
  await cap('곱셈 7번 성공! 대신 덧셈·뺄셈은 18번 — 그런데도 왜 이득일까요?'); await sleep(5000);

  mark('활동 2 · AI와 비교');
  await ev('window.scrollTo(0,0); true');
  await hlClick(`document.getElementById('tab-compare')`); await sleep(1200);
  await cap('2×2 한 번만이면 오히려 손해. 하지만 큰 행렬을 블록으로 나눠 반복하면 곱셈이 크게 줄어듭니다.'); await scrollSlow(420, 2000); await sleep(4500);
  await cap('AlphaTensor는 곱셈 줄이기를 게임으로 바꿔 탐색 — 4×4(mod 2)에서 49번 → 47번.'); await scrollSlow(900, 3000); await sleep(4000);
  await cap('결과에 붙는 조건(mod 2, 2×2는 7번 그대로)까지 정확히 짚어 줍니다.'); await sleep(4500);

  // 4. 교사
  await card('교사 · 한 번에 채점', '결과물을 모아 자동 다시 계산 → 교사 점수 → 성취수준 → CSV', 3500);
  mark('교사');
  await go(`${BASE}/teacher.html?id=matrix-mult`, 2200);
  await cap('파일을 끌어다 놓거나, 패들릿 게시물을 통째로 붙여 넣으면 됩니다. 출력물은 직접 입력.'); await sleep(4500);
  await hlClick(btn('샘플 학급 불러오기')); await sleep(1500);
  await cap('연수·시연용 샘플 학급 30명을 불러왔습니다.'); await sleep(2500);
  await ev(`document.querySelector('.grade-table').scrollIntoView({block:'start'}); window.scrollBy(0,-60); true`); await sleep(800);
  await cap('자동 항목은 학생이 낸 원자료로 다시 계산합니다. 파일을 고치면 "수정 감지"로 표시됩니다.'); await sleep(5000);
  await hlClick(`[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('답 보기'))[0]`); await sleep(800);
  await cap('[답 보기]로 학생의 답을 읽고, 기준 문구를 보며 점수를 고릅니다.'); await sleep(5000);
  await ev(`[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('답 보기'))[0].click(); true`); await sleep(400);
  await ev(`(()=>{const r=[...document.querySelectorAll('.grade-table tbody tr:not(.detail)')][20]; r.scrollIntoView({block:'center'}); return true})()`); await sleep(700);
  await cap('아직 채점하지 않은 학생: 점수를 고르면 총점과 성취수준(A~E)이 바로 계산됩니다.');
  for (const [k, v] of [[0, 1], [1, 1]]) {
    await ev(`(()=>{const r=[...document.querySelectorAll('.grade-table tbody tr:not(.detail)')][20]; const s=r.querySelectorAll('select')[${k}]; s.classList.add('demo-hl'); return true})()`); await sleep(600);
    await ev(`(()=>{const r=[...document.querySelectorAll('.grade-table tbody tr:not(.detail)')][20]; const s=r.querySelectorAll('select')[${k}]; s.value=s.options[${v}].value; s.dispatchEvent(new Event('change')); return true})()`); await sleep(900);
  }
  await sleep(2500);
  await ev('window.scrollTo(0,0); true'); await sleep(300);
  await hlClick(btn('CSV 내려받기')); await sleep(800);
  await cap('CSV로 내려받아 엑셀에서 바로 씁니다.'); await sleep(3500);

  // 5. 오프라인 · 끝
  mark('오프라인 · 끝');
  await go(`${BASE}/`);
  await ev(`window.scrollTo(0, document.body.scrollHeight); document.getElementById('offline-status')?.classList.add('demo-hl'); true`); await sleep(500);
  await cap('한 번 접속해 두면 인터넷이 끊겨도 모든 활동과 채점이 동작합니다.'); await sleep(5000);
  await card('AI 수학 발견 수업 플랫폼', 'matht1.github.io/ai-math-discovery · 코드 MIT · 콘텐츠 CC BY 4.0', 5500);
  mark('끝');

  recording = false;
  await recorderDone;
  await writing;
  await writeFile(join(OUT, 'frames.json'), JSON.stringify(frames));
  console.log(`\n프레임 ${frames.length}개 · 약 ${((Date.now() - t0) / 1000).toFixed(0)}초 → ${FRAMES}`);
} catch (e) {
  console.error('✖ ' + e.message); process.exitCode = 1;
} finally {
  ws?.close(); chrome.kill(); await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
}

if (!process.exitCode) {
  const py = spawnSync('python', ['-I', join(ROOT, 'tools', 'exhibition', 'encode-video.py'), OUT], { stdio: 'inherit' });
  if (py.status !== 0) console.log('mp4 만들기 실패: Python과 opencv-python이 있는지 확인하세요. 프레임은 남아 있습니다.');
}
