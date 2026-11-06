// 출품 자료 만들기 ① — 화면 사진 · 학생 보고서 예시 · 지도안 PDF
// 실행: 1) node tools/serve.mjs   2) node tools/exhibition/capture.mjs
// 결과:
//   docs/exhibition/images/*.png   보고서에 넣을 화면 사진 (저장소에 올림)
//   out/exhibition/print/*.pdf     지도안 인쇄본 (저장소에 올리지 않음, 필요할 때 다시 만듦)
// 학생 정보는 샘플(`샘플 07` 등)만 씀
import { spawn } from 'node:child_process';
import { mkdir, mkdtemp, writeFile, readFile, readdir, rm, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const BASE = process.env.BASE_URL ?? 'http://localhost:8000';
const CHROME = process.env.CHROME ?? 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const IMG = join(ROOT, 'docs', 'exhibition', 'images');
const PRINT = join(ROOT, 'out', 'exhibition', 'print');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(IMG, { recursive: true });
await mkdir(PRINT, { recursive: true });

const work = await mkdtemp(join(tmpdir(), 'aimath-cap-'));
const dl = join(work, 'dl');
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=9340',
  `--user-data-dir=${join(work, 'profile')}`, 'about:blank'], { stdio: 'ignore' });
let ws; let id = 0; const pending = new Map();
for (let i = 0; i < 50 && !ws; i++) {
  try { const l = await (await fetch('http://127.0.0.1:9340/json')).json(); const p = l.find((t) => t.type === 'page'); if (p) { ws = new WebSocket(p.webSocketDebuggerUrl); break; } } catch { /* 아직 */ }
  await sleep(200);
}
await new Promise((r) => (ws.readyState === 1 ? r() : (ws.onopen = r)));
ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } };
const send = (method, params = {}) => new Promise((res, rej) => { const n = ++id; pending.set(n, (d) => (d.error ? rej(new Error(`${method}: ${d.error.message}`)) : res(d.result))); ws.send(JSON.stringify({ id: n, method, params })); });
const ev = async (e) => { const r = await send('Runtime.evaluate', { expression: e, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? r.exceptionDetails.text); return r.result.value; };
async function go(url, wait = 2000) { await send('Page.navigate', { url }); await sleep(wait); }
async function shot(name, { full = false } = {}) {
  const r = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: full });
  await writeFile(join(IMG, name), Buffer.from(r.data, 'base64'));
  console.log('  사진 ' + name);
}
const view = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 600 });
const click = (text) => ev(`(()=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(text)})); e.click(); return true})()`);
const tab = (t) => ev(`document.getElementById('tab-${t}').click(); window.scrollTo(0,0); true`);

/** 샘플 학생의 활동 기록을 그날 임시 저장으로 넣어, 화면이 그 상태로 열리게 함 */
async function preload(moduleId, number, tabName) {
  const list = JSON.parse(await readFile(join(ROOT, 'samples', `${moduleId}.json`), 'utf8'));
  const r = list.find((x) => x.result.student.number === number).result;
  const draft = { date: new Date().toLocaleDateString('sv'), payload: r.payload, reflections: r.reflections, tab: tabName };
  await go(`${BASE}/index.html`, 800);
  await ev(`localStorage.setItem('aimath:${moduleId}', ${JSON.stringify(JSON.stringify(draft))}); true`);
  return r;
}

try {
  await send('Page.enable');
  await send('Browser.setDownloadBehavior', { behavior: 'allow', downloadPath: dl });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: 'window.print = () => {};' });
  console.log('[화면 사진]');
  await view(1280, 800);
  await go(`${BASE}/`); await shot('01_home.png');

  // no-three-in-line: 공선이 생긴 장면 + 성공 장면 + AI 비교
  await go(`${BASE}/modules/no-three-in-line/`); await tab('intro'); await sleep(800); await shot('02_n3l_intro.png');
  await tab('activity');
  await ev(`(()=>{const s=document.getElementById('n3l-size'); s.value='6'; s.dispatchEvent(new Event('change')); return true})()`);
  await ev(`[[0,0],[1,0],[3,1],[5,1],[1,2],[4,2],[2,4]].forEach(([x,y])=>document.querySelector('.n3l-pt[data-x="'+x+'"][data-y="'+y+'"]').click()); true`);
  await ev(`[[4,4]].forEach(([x,y])=>document.querySelector('.n3l-pt[data-x="'+x+'"][data-y="'+y+'"]').click()); true`);
  await sleep(500); await shot('03_n3l_collinear.png');
  await ev(`(()=>{const s=document.getElementById('n3l-size'); s.value='5'; s.dispatchEvent(new Event('change')); return true})()`);
  await click('힌트'); await ev(`[[0,0],[1,1]].forEach(([x,y])=>document.querySelector('.n3l-pt[data-x="'+x+'"][data-y="'+y+'"]').click()); true`);
  await sleep(500); await shot('04_n3l_hint.png');
  await ev(`localStorage.clear(); true`);
  await preload('no-three-in-line', 1, 'compare');
  await go(`${BASE}/modules/no-three-in-line/`, 2500); await tab('compare'); await sleep(1500); await shot('05_n3l_compare.png', { full: true });

  // matrix-mult: 조립 중간(지워진 항 보이게) + AI 비교
  await ev(`localStorage.clear(); true`);
  await go(`${BASE}/modules/matrix-mult/`); await tab('activity');
  await ev(`(()=>{const pick=(l,v)=>{const s=document.querySelector('select[aria-label="'+l+'"]'); s.value=String(v); s.dispatchEvent(new Event('change',{bubbles:true}));};
    [['c₁₂',3,1],['c₁₂',5,1],['c₂₁',2,1],['c₂₁',4,1],['c₁₁',1,1],['c₁₁',4,1],['c₁₁',5,-1]].forEach(([e,k,v])=>pick(e+' 만들기: M'+k+' 앞의 부호',v)); return true})()`);
  await sleep(500);
  await ev(`document.querySelector('.mm-mode').scrollIntoView({block:'start'}); true`); await sleep(400);
  await shot('06_mm_assemble.png');
  await ev(`localStorage.clear(); true`);
  await preload('matrix-mult', 1, 'compare');
  await go(`${BASE}/modules/matrix-mult/`, 2500); await tab('compare'); await sleep(1500); await shot('07_mm_compare.png', { full: true });

  // 교사 페이지: 샘플 30명
  await go(`${BASE}/teacher.html?id=matrix-mult`, 2500);
  await click('샘플 학급 불러오기'); await sleep(4500); // 알림이 사라진 뒤 찍기
  await ev(`document.querySelector('.grade-table').scrollIntoView({block:'start'}); window.scrollBy(0,-90); true`); await sleep(400);
  await shot('08_teacher.png');
  // 답 보기 펼친 장면
  await ev(`[...document.querySelectorAll('button')].filter(b=>b.textContent.includes('답 보기'))[0].click(); true`); await sleep(400);
  await ev(`document.querySelector('.grade-table tbody tr').scrollIntoView({block:'start'}); window.scrollBy(0,-120); true`); await sleep(300);
  await shot('09_teacher_answers.png');

  // 휴대전화 화면
  await view(390, 844);
  await go(`${BASE}/modules/no-three-in-line/`); await ev(`localStorage.clear(); true`); await go(`${BASE}/modules/no-three-in-line/`); await tab('activity');
  await ev(`[[0,0],[2,1],[4,2]].forEach(([x,y])=>document.querySelector('.n3l-pt[data-x="'+x+'"][data-y="'+y+'"]').click()); true`); await sleep(500);
  await shot('10_mobile.png');

  console.log('[학생 보고서 예시 (샘플)]');
  await view(1280, 800);
  for (const [mid, num] of [['no-three-in-line', 7], ['matrix-mult', 7]]) {
    const r = await preload(mid, num, 'submit');
    await go(`${BASE}/modules/${mid}/`, 2500); await tab('submit'); await sleep(500);
    for (const [sel, v] of [['#st-class', r.student.class], ['#st-number', r.student.number], ['#st-name', r.student.name]]) {
      await ev(`(()=>{const e=document.querySelector('${sel}'); e.value=${JSON.stringify(String(v))}; e.dispatchEvent(new Event('input',{bubbles:true})); return true})()`);
    }
    await ev(`document.querySelector('input[value="classroom"]')?.click(); true`);
    await click('① 보고서 저장');
    let f;
    for (let i = 0; i < 40 && !f; i++) { await sleep(250); f = (await readdir(dl).catch(() => [])).find((x) => x.endsWith('.png') && x.startsWith(mid)); }
    await copyFile(join(dl, f), join(IMG, `11_report_${mid}.png`)); // 드라이브가 달라 rename 불가
    console.log(`  사진 11_report_${mid}.png`);
  }

  console.log('[지도안 PDF]');
  for (const mid of ['no-three-in-line', 'matrix-mult']) {
    await go(`${BASE}/guide.html?id=${mid}`, 2500);
    const pdf = await send('Page.printToPDF', { printBackground: true, paperWidth: 8.27, paperHeight: 11.69, marginTop: 0.5, marginBottom: 0.5, marginLeft: 0.5, marginRight: 0.5,
      displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: '<div style="font-size:8px;width:100%;text-align:center"><span class="pageNumber"></span> / <span class="totalPages"></span></div>' });
    await writeFile(join(PRINT, `지도안_${mid}.pdf`), Buffer.from(pdf.data, 'base64'));
    console.log(`  out/exhibition/print/지도안_${mid}.pdf`);
  }
  console.log('\n완료');
} catch (e) {
  console.error('✖ ' + e.message); process.exitCode = 1;
} finally {
  ws?.close(); chrome.kill(); await sleep(500);
  await rm(work, { recursive: true, force: true }).catch(() => {});
}
