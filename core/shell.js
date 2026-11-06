// 모듈 공통 화면 [D7·D8]
// modules/<id>/index.html 이 이 파일 하나만 불러오면, 나머지는 module.json과 activity.js로 자동 구성됨
//
// activity.js 표준 함수
//   init(container, meta, data, ctx)          ctx = { saved: 이전 payload|null, onChange: ()=>void }
//   renderAIComparison(container, payload, data)
//   getResultData()                            → payload (원자료)
//   renderSummaryCanvas(canvas, payload)       → PNG 보고서 그림

import { el, fetchJSON, downloadBlob, copyText, toast, safeName, showFatal, PLATFORM_VERSION } from './ui.js';
import { buildResult, encodeSubmission, canCompress } from './codec.js';
import { loadDraft, saveDraft, clearDraft, purgeOldDrafts } from './storage.js';
import { renderMath } from './math.js';
import { drawReport, canvasToBlob } from './report.js';

const ROOT = new URL('../', import.meta.url);
const BASE = new URL('./', location.href);

const TABS = [
  { id: 'intro', label: '도입' },
  { id: 'activity', label: '탐구 활동' },
  { id: 'compare', label: 'AI와 비교' },
  { id: 'reflect', label: '정리' },
  { id: 'submit', label: '결과물 제출' },
];

const METHODS = {
  classroom: { label: '구글 클래스룸', steps: ['① 보고서(PNG)와 ② 제출 파일(JSON)을 저장합니다.', '클래스룸 과제에 두 파일을 모두 첨부하고 [제출]을 누릅니다.'] },
  padlet: { label: '패들릿', steps: ['① 보고서(PNG)를 저장해 패들릿 게시물에 올립니다.', '[제출 코드 복사]를 눌러 같은 게시물 본문에 붙여 넣습니다.', '공개 게시판이므로 이름은 쓰지 않습니다.'] },
  mail: { label: '메일', steps: ['① 보고서(PNG)와 ② 제출 파일(JSON)을 저장합니다.', '[메일 제목 복사]를 눌러 제목에 붙여 넣고, 두 파일을 첨부해 선생님 메일로 보냅니다.'] },
  print: { label: '출력물', steps: ['[인쇄하기]를 눌러 A4 한 장으로 인쇄합니다.', '인쇄물을 선생님께 냅니다.'] },
};

const state = {
  meta: null, activity: null, grader: null, data: {},
  tab: 'intro', reflections: {}, method: 'classroom', saveTimer: null,
};

async function loadModule() {
  const meta = await fetchJSON(new URL('module.json', BASE));
  const [activity, grader] = await Promise.all([
    import(new URL('activity.js', BASE).href),
    import(new URL('grader.js', BASE).href),
  ]);
  const data = {};
  for (const [key, path] of Object.entries(meta.data ?? {})) data[key] = await fetchJSON(new URL(path, BASE));
  if (meta.style) {
    // 모듈 전용 스타일 (module.json "style": "activity.css") — Antigravity M1 검토
    document.head.append(el('link', { rel: 'stylesheet', href: new URL(meta.style, BASE).href }));
  }
  return { meta, activity, grader, data };
}

// ---------- 저장 ----------

function currentPayload() {
  try { return state.activity.getResultData(); } catch (e) { console.warn(e); return null; }
}

function scheduleSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(() => {
    saveDraft(state.meta.id, { payload: currentPayload(), reflections: state.reflections, tab: state.tab });
  }, 600);
}

// ---------- 화면 ----------

function header() {
  const m = state.meta;
  return el('header', { class: 'topbar' },
    el('a', { class: 'home-link', href: new URL('index.html', ROOT).href }, '← 모든 활동'),
    el('div', { class: 'title-block' },
      el('h1', {}, m.title),
      m.subtitle ? el('p', { class: 'subtitle' }, m.subtitle) : null),
    el('div', { class: 'top-actions' },
      el('a', { class: 'btn ghost', href: new URL(`guide.html?id=${encodeURIComponent(m.id)}`, ROOT).href, target: '_blank' }, '교사용 지도안'),
      el('button', { class: 'btn ghost', type: 'button', onclick: resetAll }, '처음부터 (기록 지우기)')),
  );
}

function tabBar() {
  // 좌우 방향키·Home·End로 단계 이동 (WAI-ARIA tablist 관례, Antigravity M1 검토)
  const onkeydown = (e) => {
    const i = TABS.findIndex((t) => t.id === state.tab);
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: TABS.length - 1 }[e.key];
    if (next === undefined || next < 0 || next >= TABS.length) return;
    e.preventDefault();
    showTab(TABS[next].id);
  };
  return el('nav', { class: 'tabs', role: 'tablist', 'aria-label': '수업 단계', onkeydown },
    TABS.map((t, i) => el('button', {
      type: 'button', role: 'tab', id: `tab-${t.id}`, 'aria-controls': `panel-${t.id}`,
      'aria-selected': String(state.tab === t.id), tabindex: state.tab === t.id ? '0' : '-1',
      class: 'tab', onclick: () => showTab(t.id),
    }, el('span', { class: 'step' }, String(i + 1)), t.label)));
}

function showTab(id) {
  state.tab = id;
  for (const t of TABS) {
    const btn = document.getElementById(`tab-${t.id}`);
    const panel = document.getElementById(`panel-${t.id}`);
    const on = t.id === id;
    btn.setAttribute('aria-selected', String(on));
    btn.tabIndex = on ? 0 : -1;
    panel.hidden = !on;
  }
  if (id === 'compare') renderCompare();
  if (id === 'submit') renderSubmitSummary();
  scheduleSave();
  const tabBtn = document.getElementById(`tab-${id}`);
  tabBtn.focus({ preventScroll: true });
  tabBtn.scrollIntoView({ block: 'nearest', inline: 'center' }); // 휴대폰에서 선택한 탭이 보이게
  window.scrollTo({ top: 0 });
}

function navButtons(id) {
  const i = TABS.findIndex((t) => t.id === id);
  return el('div', { class: 'step-nav' },
    i > 0 ? el('button', { class: 'btn', type: 'button', onclick: () => showTab(TABS[i - 1].id) }, `← ${TABS[i - 1].label}`) : el('span'),
    i < TABS.length - 1 ? el('button', { class: 'btn primary', type: 'button', onclick: () => showTab(TABS[i + 1].id) }, `${TABS[i + 1].label} →`) : el('span'));
}

function panel(id, ...children) {
  return el('section', { id: `panel-${id}`, role: 'tabpanel', 'aria-labelledby': `tab-${id}`, class: 'panel', hidden: state.tab !== id },
    ...children, navButtons(id));
}

function introPanel() {
  const m = state.meta;
  const p = m.paper ?? {};
  return panel('intro',
    el('div', { class: 'card story' },
      m.story?.hook ? el('p', { class: 'hook' }, m.story.hook) : null,
      m.story?.ai_connection ? el('p', {}, m.story.ai_connection) : null),
    el('div', { class: 'card' },
      el('h2', {}, '이 활동의 바탕이 된 연구'),
      el('p', {}, el('strong', {}, p.title ?? ''), p.year ? ` (${p.year})` : ''),
      p.authors ? el('p', { class: 'muted' }, p.authors) : null,
      p.ai_method ? el('p', {}, '방법: ', p.ai_method) : null,
      el('p', { class: 'links' },
        p.url ? el('a', { href: p.url, target: '_blank', rel: 'noopener' }, '논문') : null,
        p.code ? el('a', { href: p.code, target: '_blank', rel: 'noopener' }, '코드') : null)),
    el('details', { class: 'card' },
      el('summary', {}, '교육과정 연계 (성취기준)'),
      el('ul', {}, (m.achievement_standards ?? []).map((a) =>
        el('li', {}, el('code', {}, `[${a.code}]`), ' ', a.description ?? '')))),
  );
}

function activityPanel() {
  const box = el('div', { class: 'activity-root' });
  return { node: panel('activity', box), box };
}

function renderCompare() {
  const box = document.getElementById('compare-root');
  box.replaceChildren();
  try {
    state.activity.renderAIComparison(box, currentPayload(), state.data);
    renderMath(box);
  } catch (e) {
    box.append(el('p', { class: 'error' }, '비교 화면 오류: ' + e.message));
  }
}

function comparePanel() {
  return panel('compare', el('div', { id: 'compare-root', class: 'compare-root' }));
}

function reflectPanel() {
  const qs = state.meta.questions ?? [];
  return panel('reflect',
    el('p', { class: 'muted' }, '아래 질문에 자기 말로 답하세요. 답은 보고서와 제출 파일에 들어갑니다.'),
    qs.map((q, i) => {
      const ta = el('textarea', { id: `q-${q.id}`, rows: 5, maxlength: 2000 });
      ta.value = state.reflections[q.id] ?? '';
      ta.addEventListener('input', () => { state.reflections[q.id] = ta.value; scheduleSave(); });
      return el('div', { class: 'card question' },
        el('label', { for: `q-${q.id}` }, el('span', { class: 'qnum' }, `Q${i + 1}`), ' ', q.prompt),
        ta);
    }));
}

// ---------- 제출 ----------

function readStudent() {
  const cls = document.getElementById('st-class').value.trim();
  const num = Number(document.getElementById('st-number').value);
  const nameOn = state.method !== 'padlet' || document.getElementById('st-name-toggle').checked;
  const name = nameOn ? document.getElementById('st-name').value.trim() : '';
  if (!cls) throw new Error('반을 입력하세요 (예: 1-5).');
  if (!Number.isInteger(num) || num < 1 || num > 99) throw new Error('번호를 1~99 사이 숫자로 입력하세요.');
  return { class: cls, number: num, name };
}

async function makeResult() {
  const student = readStudent();
  const payload = currentPayload();
  if (!payload) throw new Error('활동 기록이 없습니다. 탐구 활동을 먼저 해 주세요.');
  return buildResult({ moduleMeta: state.meta, platformVersion: PLATFORM_VERSION, student, payload, reflections: { ...state.reflections } });
}

function evidenceFor(payload) {
  try { return state.grader.metrics(payload, state.data).evidence ?? []; } catch (e) { return [`(다시 계산 오류: ${e.message})`]; }
}

function baseFileName(result) {
  const s = result.student;
  return `${state.meta.id}_${safeName(s.class)}-${s.number}${s.name ? '_' + safeName(s.name) : ''}`;
}

async function reportCanvas(result) {
  return drawReport({
    meta: state.meta, result, evidence: evidenceFor(result.payload),
    drawSummary: (c, p) => state.activity.renderSummaryCanvas(c, p),
  });
}

const actions = {
  async png() {
    const r = await makeResult();
    downloadBlob(await canvasToBlob(await reportCanvas(r)), baseFileName(r) + '.png');
    toast('보고서(PNG)를 저장했습니다.');
  },
  async json() {
    const r = await makeResult();
    downloadBlob(new Blob([JSON.stringify(r, null, 2)], { type: 'application/json' }), baseFileName(r) + '.json');
    toast('제출 파일(JSON)을 저장했습니다.');
  },
  async code() {
    const r = await makeResult();
    const code = await encodeSubmission(r);
    const ok = await copyText(code);
    document.getElementById('code-preview').textContent = code;
    toast(ok ? `제출 코드를 복사했습니다 (${code.length}자). 패들릿에 붙여 넣으세요.` : '복사에 실패했습니다. 아래 코드를 직접 선택해 복사하세요.', ok ? 'info' : 'warn');
  },
  async subject() {
    const s = readStudent();
    const text = `[${state.meta.title}] ${s.class} ${s.number}번${s.name ? ' ' + s.name : ''}`;
    toast((await copyText(text)) ? `메일 제목을 복사했습니다: ${text}` : text);
  },
  async print() {
    const r = await makeResult();
    const url = (await reportCanvas(r)).toDataURL('image/png');
    const area = document.getElementById('print-area');
    const img = el('img', { src: url, alt: '인쇄용 보고서' });
    area.replaceChildren(img);
    await img.decode().catch(() => {});
    document.body.classList.add('printing-report');
    window.addEventListener('afterprint', () => document.body.classList.remove('printing-report'), { once: true });
    window.print();
  },
};

function actionButton(key, label, primary = false) {
  return el('button', {
    type: 'button', class: `btn ${primary ? 'primary' : ''}`,
    onclick: async (e) => {
      const b = e.currentTarget;
      b.disabled = true;
      try { await actions[key](); } catch (err) { toast(err.message, 'error'); } finally { b.disabled = false; }
    },
  }, label);
}

function methodBox() {
  const m = state.method;
  const btns = {
    classroom: [actionButton('png', '① 보고서 저장 (PNG)', true), actionButton('json', '② 제출 파일 저장 (JSON)', true)],
    padlet: [actionButton('png', '① 보고서 저장 (PNG)', true),
      canCompress() ? actionButton('code', '② 제출 코드 복사', true) : el('p', { class: 'warn' }, '이 브라우저는 제출 코드를 지원하지 않습니다. JSON 파일을 저장해 첨부하세요.'),
      canCompress() ? null : actionButton('json', '제출 파일 저장 (JSON)')],
    mail: [actionButton('png', '① 보고서 저장 (PNG)', true), actionButton('json', '② 제출 파일 저장 (JSON)', true), actionButton('subject', '③ 메일 제목 복사')],
    print: [actionButton('print', '인쇄하기', true)],
  }[m];
  return el('div', { class: 'card method-box' },
    el('h3', {}, `${METHODS[m].label}로 제출하기`),
    el('ol', {}, METHODS[m].steps.map((s) => el('li', {}, s))),
    el('div', { class: 'btn-row' }, btns),
    m === 'padlet' ? el('pre', { id: 'code-preview', class: 'code-preview', 'aria-label': '제출 코드' }) : null);
}

function renderSubmitSummary() {
  const box = document.getElementById('submit-summary');
  if (!box) return;
  const ev = evidenceFor(currentPayload());
  const qs = state.meta.questions ?? [];
  const unanswered = qs.filter((q) => !String(state.reflections[q.id] ?? '').trim()).length;
  box.replaceChildren(
    el('h3', {}, '내 결과 확인'),
    el('ul', {}, ev.map((t) => el('li', {}, t))),
    unanswered ? el('p', { class: 'warn' }, `정리 질문 ${unanswered}개에 아직 답하지 않았습니다.`) : el('p', { class: 'ok' }, '정리 질문에 모두 답했습니다.'));
}

function submitPanel() {
  const methodRadios = el('fieldset', { class: 'methods' },
    el('legend', {}, '제출 방법'),
    Object.entries(METHODS).map(([key, v]) => el('label', { class: 'radio' },
      el('input', { type: 'radio', name: 'method', value: key, checked: state.method === key,
        onchange: () => { state.method = key; refreshMethod(); } }),
      v.label)));
  const nameRow = el('div', { class: 'field', id: 'name-row' },
    el('label', { for: 'st-name' }, '이름 (선택)'),
    el('input', { id: 'st-name', autocomplete: 'off', maxlength: 30 }),
    el('label', { class: 'check', id: 'name-toggle-row' },
      el('input', { type: 'checkbox', id: 'st-name-toggle', onchange: refreshMethod }), ' 이름도 넣기 (공개 게시판에서는 권장하지 않음)'));
  return panel('submit',
    el('div', { class: 'card', id: 'submit-summary' }),
    el('div', { class: 'card' },
      el('h3', {}, '학생 정보'),
      el('p', { class: 'muted small' }, '이 정보는 내 기기의 결과물 파일 안에만 들어가며, 어디에도 전송·저장되지 않습니다.'),
      el('div', { class: 'field-row' },
        el('div', { class: 'field' }, el('label', { for: 'st-class' }, '반'), el('input', { id: 'st-class', placeholder: '예: 1-5', autocomplete: 'off', maxlength: 20 })),
        el('div', { class: 'field' }, el('label', { for: 'st-number' }, '번호'), el('input', { id: 'st-number', type: 'number', min: 1, max: 99, inputmode: 'numeric', autocomplete: 'off' }))),
      nameRow),
    methodRadios,
    el('div', { id: 'method-box' }),
  );
}

function refreshMethod() {
  const padlet = state.method === 'padlet';
  document.getElementById('name-toggle-row').hidden = !padlet;
  const nameInput = document.getElementById('st-name');
  const nameOn = !padlet || document.getElementById('st-name-toggle').checked;
  nameInput.disabled = !nameOn;
  if (!nameOn) nameInput.value = '';
  document.getElementById('method-box').replaceChildren(methodBox());
}

function resetAll() {
  if (!confirm('지금까지의 활동 기록과 답을 모두 지우고 처음부터 시작할까요?')) return;
  clearTimeout(state.saveTimer);
  clearDraft(state.meta.id);
  location.reload();
}

// ---------- 시작 ----------

async function main() {
  const app = document.getElementById('app') ?? document.body.appendChild(el('main', { id: 'app' }));
  app.replaceChildren(el('p', { class: 'muted' }, '불러오는 중…'));
  try {
    Object.assign(state, await loadModule());
  } catch (e) {
    showFatal(app, e);
    return;
  }
  purgeOldDrafts();
  const draft = loadDraft(state.meta.id);
  state.reflections = draft?.reflections ?? {};
  if (draft?.tab && TABS.some((t) => t.id === draft.tab)) state.tab = draft.tab;
  const q = new URLSearchParams(location.search).get('submit');
  if (q && METHODS[q]) state.method = q;

  document.title = `${state.meta.title} · AI 수학 발견`;
  const act = activityPanel();
  app.replaceChildren(header(), tabBar(), introPanel(), act.node, comparePanel(), reflectPanel(), submitPanel());
  document.body.append(el('div', { id: 'print-area', 'aria-hidden': 'true' }));
  refreshMethod();

  try {
    await state.activity.init(act.box, state.meta, state.data, { saved: draft?.payload ?? null, onChange: scheduleSave });
  } catch (e) {
    act.box.append(el('p', { class: 'error' }, '활동 화면 오류: ' + e.message));
    console.error(e);
  }
  renderMath(app);
  document.getElementById(`tab-${state.tab}`).scrollIntoView({ block: 'nearest', inline: 'center' });
  if (state.tab === 'compare') renderCompare();
  if (state.tab === 'submit') renderSubmitSummary();
  if (draft) toast('오늘 하던 활동을 이어서 불러왔습니다.');
}

main();
