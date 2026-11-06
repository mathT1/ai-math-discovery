// 교사 평가 페이지 — 모든 처리는 이 브라우저 안에서만 (서버 전송 없음)
import { el, fetchJSON, downloadBlob, toast, showFatal } from './ui.js';
import { loadCatalog, moduleURL, showDrafts } from './catalog.js';
import { validateResult } from './validate.js';
import { verifyChecksum, decodeSubmissions, canCompress } from './codec.js';
import { gradeRow, toCSV } from './grade.js';

const ROOT = new URL('../', import.meta.url);
const SOURCE_LABEL = { file: '파일', code: '제출 코드', print: '출력물', sample: '샘플' };
const STATUS = {
  ok: { label: '정상', cls: 'ok' },
  modified: { label: '수정 감지', cls: 'warn', tip: '파일이 저장된 뒤 내용이 바뀌었습니다. 채점은 원자료로 다시 계산한 값으로 합니다.' },
  missing: { label: '체크섬 없음', cls: 'warn' },
  unavailable: { label: '확인 불가', cls: 'muted', tip: '이 브라우저 환경(https 아님 등)에서는 체크섬을 확인할 수 없습니다.' },
  manual: { label: '수기 입력', cls: 'muted' },
};

const ctx = { mods: [], meta: null, rubric: null, schema: null, grader: null, data: {}, rows: [], seq: 0 };

// ---------- 모듈 불러오기 ----------

async function selectModule(id) {
  ctx.rows = [];
  const [meta, rubric, schema, grader] = await Promise.all([
    fetchJSON(moduleURL(id, 'module.json')),
    fetchJSON(moduleURL(id, 'rubric.json')),
    fetchJSON(moduleURL(id, 'schema.json')),
    import(moduleURL(id, 'grader.js').href),
  ]);
  const data = {};
  for (const [k, p] of Object.entries(meta.data ?? {})) data[k] = await fetchJSON(moduleURL(id, p));
  Object.assign(ctx, { meta, rubric, schema, grader, data });
  document.getElementById('workspace').hidden = false;
  document.getElementById('rubric-info').replaceChildren(rubricSummary());
  render();
}

function rubricSummary() {
  const r = ctx.rubric;
  const auto = r.items.filter((i) => i.type === 'auto').reduce((s, i) => s + i.max, 0);
  const total = r.items.reduce((s, i) => s + i.max, 0);
  return el('p', { class: 'muted small' },
    `만점 ${total}점 (자동 ${auto} · 교사 ${total - auto}) · 성취수준 ${r.scale.join('~')} `,
    `(기준: ${Object.entries(r.level_cut).map(([k, v]) => `${k} ${v}% 이상`).join(', ')})`);
}

// ---------- 결과물 추가 ----------

async function addResult(result, source) {
  const row = { key: ++ctx.seq, source, result, manual: {}, errors: [], status: 'ok', values: null, evidence: [] };
  if (!result || typeof result !== 'object') {
    row.errors.push('JSON 결과물이 아닙니다.');
  } else {
    row.errors = validateResult(result, ctx.schema);
    if (!row.errors.length && result.meta.module_id !== ctx.meta.id) {
      row.errors = [`다른 모듈의 결과물입니다 (${result.meta.module_id}).`];
    }
  }
  if (!row.errors.length) {
    row.status = await verifyChecksum(result);
    try {
      const m = ctx.grader.metrics(result.payload, ctx.data);
      row.values = m.values;
      row.evidence = m.evidence ?? [];
    } catch (e) {
      row.errors.push('다시 계산 오류: ' + e.message);
    }
  }
  ctx.rows.push(row);
}

async function addFiles(files) {
  let n = 0;
  for (const f of files) {
    if (!/\.json$/i.test(f.name)) { toast(`${f.name}: JSON 파일만 올릴 수 있습니다 (PNG는 사람이 보는 보고서).`, 'warn'); continue; }
    try {
      await addResult(JSON.parse(await f.text()), 'file');
    } catch {
      ctx.rows.push({ key: ++ctx.seq, source: 'file', result: null, manual: {}, errors: [`${f.name}: JSON을 읽을 수 없습니다.`], status: 'ok', values: null, evidence: [] });
    }
    n++;
  }
  render();
  if (n) toast(`${n}개 파일을 불러왔습니다.`);
}

async function addCodes(text) {
  if (!canCompress()) { toast('이 브라우저는 제출 코드를 읽을 수 없습니다. 최신 크롬·엣지·사파리를 쓰세요.', 'error'); return; }
  const { results, errors } = await decodeSubmissions(text);
  for (const r of results) await addResult(r, 'code');
  render();
  toast(`제출 코드 ${results.length}개를 읽었습니다.` + (errors.length ? ` 읽지 못한 코드 ${errors.length}개.` : ''), errors.length ? 'warn' : 'info');
  errors.forEach((e) => console.warn(e));
  if (!results.length && !errors.length) toast('제출 코드를 찾지 못했습니다. [모듈:반-번호:코드] 형식인지 확인하세요.', 'warn');
}

function addManual(cls, number, name) {
  ctx.rows.push({
    key: ++ctx.seq, source: 'print', manual: {}, errors: [], status: 'manual', values: null, evidence: [],
    result: { student: { class: cls, number, name }, reflections: {} },
  });
  render();
}

async function loadSamples() {
  try {
    const list = await fetchJSON(new URL(`samples/${ctx.meta.id}.json`, ROOT));
    const had = ctx.rows.some((r) => r.source === 'sample');
    ctx.rows = ctx.rows.filter((r) => r.source !== 'sample'); // 두 번 눌러도 중복되지 않게 교체
    for (const r of list) await addResult(r, 'sample');
    render();
    toast(had ? `샘플 ${list.length}명을 다시 불러왔습니다 (이전 샘플은 교체).` : `샘플 ${list.length}명을 불러왔습니다.`);
  } catch {
    toast('이 모듈에는 샘플 학급 데이터가 아직 없습니다.', 'warn');
  }
}

// ---------- 표 ----------

const studentOf = (row) => row.result?.student ?? { class: '?', number: 0, name: '' };

function sortRows() {
  ctx.rows.sort((a, b) => {
    const sa = studentOf(a), sb = studentOf(b);
    return String(sa.class).localeCompare(String(sb.class), 'ko', { numeric: true }) || sa.number - sb.number || a.key - b.key;
  });
}

function duplicates() {
  const count = new Map();
  for (const r of ctx.rows) {
    if (r.errors.length) continue;
    const s = studentOf(r);
    const k = `${s.class}|${s.number}`;
    count.set(k, (count.get(k) ?? 0) + 1);
  }
  return (row) => { const s = studentOf(row); return (count.get(`${s.class}|${s.number}`) ?? 0) > 1; };
}

function gradeOf(row) {
  return gradeRow({ rubric: ctx.rubric, values: row.values, reflections: row.result?.reflections ?? {}, manual: row.manual });
}

function scoreCell(row, item, g) {
  const gi = g.items.find((x) => x.id === item.id);
  if (gi.type === 'auto') {
    return el('td', { class: 'num', title: gi.note ?? row.evidence.join('\n') }, String(gi.score));
  }
  const onchange = (e) => {
    const v = e.target.value;
    if (v === '') delete row.manual[item.id]; else row.manual[item.id] = Number(v);
    render();
  };
  let input;
  if (item.levels) {
    const opts = Object.entries(item.levels).sort((a, b) => Number(b[0]) - Number(a[0]));
    input = el('select', { 'aria-label': `${studentOf(row).number}번 ${item.label}`, onchange },
      el('option', { value: '' }, '—'),
      opts.map(([score, desc]) => el('option', { value: score, selected: String(row.manual[item.id]) === score }, `${score} ${desc}`)));
  } else {
    input = el('input', { type: 'number', min: 0, max: item.max, value: row.manual[item.id] ?? '', 'aria-label': `${studentOf(row).number}번 ${item.label}`, onchange, class: 'score-input' });
  }
  const mark = gi.answered === false ? el('span', { class: 'badge muted', title: '답을 쓰지 않음' }, '미작성') : null;
  return el('td', {}, input, mark);
}

function render() {
  if (!ctx.meta) return;
  sortRows();
  const isDup = duplicates();
  const items = ctx.rubric.items;
  const head = el('tr', {},
    ['반', '번호', '이름', '출처', '상태'].map((h) => el('th', { scope: 'col' }, h)),
    items.map((it) => el('th', { scope: 'col', title: it.type === 'auto' ? '자동 채점 (원자료 재계산)' : '교사 채점' },
      it.label, el('br'), el('span', { class: 'muted small' }, `${it.type === 'auto' ? '자동' : '교사'} ${it.max}`))),
    ['총점', '수준', ''].map((h) => el('th', { scope: 'col' }, h)));

  const body = ctx.rows.flatMap((row) => {
    const s = studentOf(row);
    const remove = el('button', { class: 'btn small ghost', type: 'button', 'aria-label': '이 줄 지우기',
      onclick: () => { ctx.rows = ctx.rows.filter((r) => r !== row); render(); } }, '삭제');
    if (row.errors.length) {
      return [el('tr', { class: 'row-error' },
        el('td', { colspan: 5 + items.length + 2 }, el('span', { class: 'badge error' }, '형식 오류'), ' ', row.errors.slice(0, 3).join(' / ')),
        el('td', {}, remove))];
    }
    const g = gradeOf(row);
    const st = STATUS[row.status] ?? STATUS.ok;
    // 펼침 상태를 row에 저장 → 점수를 바꿔 표를 다시 그려도 답안이 닫히지 않음 (Antigravity M1 검토)
    const answersBtn = el('button', { class: 'btn small ghost', type: 'button', 'aria-expanded': String(!!row.expanded), onclick: (e) => {
      row.expanded = !row.expanded;
      e.currentTarget.setAttribute('aria-expanded', String(row.expanded));
      e.currentTarget.closest('tr').nextElementSibling.hidden = !row.expanded;
    } }, '답 보기');
    const main = el('tr', {},
      el('td', {}, s.class), el('td', { class: 'num' }, String(s.number)), el('td', {}, s.name || ''),
      el('td', {}, SOURCE_LABEL[row.source]),
      el('td', {}, el('span', { class: `badge ${st.cls}`, title: st.tip ?? '' }, st.label),
        isDup(row) ? el('span', { class: 'badge warn', title: '같은 반·번호가 여러 개' }, '중복') : null),
      items.map((it) => scoreCell(row, it, g)),
      el('td', { class: 'num' }, `${g.total}/${g.max}`),
      el('td', { class: 'num' }, el('strong', {}, g.level), g.complete ? null : el('span', { class: 'muted small', title: '채점하지 않은 항목이 있음' }, ' (미완)')),
      el('td', {}, row.source === 'print' ? null : answersBtn, remove));
    const qs = ctx.meta.questions ?? [];
    const detail = el('tr', { class: 'detail', hidden: !row.expanded },
      el('td', { colspan: 5 + items.length + 3 },
        row.evidence.length ? el('p', { class: 'small' }, '다시 계산한 결과: ', row.evidence.join(' · ')) : null,
        qs.map((q) => el('div', { class: 'answer' }, el('strong', {}, q.prompt), el('p', {}, row.result.reflections?.[q.id] || '(미작성)')))));
    return [main, detail];
  });

  document.getElementById('table-wrap').replaceChildren(
    ctx.rows.length
      ? el('table', { class: 'grade-table' }, el('thead', {}, head), el('tbody', {}, body))
      : el('p', { class: 'muted' }, '아직 불러온 결과물이 없습니다.'));
  const ok = ctx.rows.filter((r) => !r.errors.length);
  const done = ok.filter((r) => gradeOf(r).complete).length;
  document.getElementById('stats').textContent = `${ctx.rows.length}건 (채점 완료 ${done} / 정상 ${ok.length})`;
}

// ---------- CSV ----------

function exportCSV() {
  const items = ctx.rubric.items;
  const qs = ctx.meta.questions ?? [];
  const header = ['반', '번호', '이름', '제출 방식', '상태', ...items.map((i) => `${i.label}(${i.max})`), '총점', '만점', '백분율', '성취수준', '채점 완료', ...qs.map((q, i) => `정리 Q${i + 1}`)];
  const isDup = duplicates();
  const rows = ctx.rows.filter((r) => !r.errors.length).map((row) => {
    const s = studentOf(row);
    const g = gradeOf(row);
    const status = (STATUS[row.status]?.label ?? '') + (isDup(row) ? ' / 중복' : '');
    return [s.class, s.number, s.name, SOURCE_LABEL[row.source], status,
      ...g.items.map((i) => i.score), g.total, g.max, g.percent, g.level, g.complete ? 'O' : 'X',
      ...qs.map((q) => row.result.reflections?.[q.id] ?? '')];
  });
  const stamp = new Date().toLocaleDateString('sv');
  downloadBlob(new Blob([toCSV([header, ...rows])], { type: 'text/csv;charset=utf-8' }), `${ctx.meta.id}_채점_${stamp}.csv`);
}

// ---------- 시작 ----------

async function main() {
  const sel = document.getElementById('module-select');
  try {
    ctx.mods = await loadCatalog({ drafts: showDrafts() });
  } catch (e) {
    showFatal(document.getElementById('setup'), e);
    return;
  }
  sel.replaceChildren(el('option', { value: '' }, '모듈을 고르세요'),
    ...ctx.mods.map((m) => el('option', { value: m.id }, `${m.title} (${m.subject})`)));
  sel.addEventListener('change', async () => {
    if (ctx.rows.length && !confirm('다른 모듈로 바꾸면 지금 표의 채점 내용이 지워집니다. 계속할까요? (먼저 CSV로 저장하세요)')) {
      sel.value = ctx.meta?.id ?? '';
      return;
    }
    if (!sel.value) return;
    try { await selectModule(sel.value); } catch (e) { toast(e.message, 'error'); }
  });

  const drop = document.getElementById('drop');
  const fileInput = document.getElementById('file-input');
  drop.addEventListener('click', () => fileInput.click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); } });
  fileInput.addEventListener('change', () => { addFiles([...fileInput.files]); fileInput.value = ''; });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.classList.remove('over'); addFiles([...e.dataTransfer.files]); });

  document.getElementById('code-read').addEventListener('click', () => {
    const ta = document.getElementById('code-input');
    addCodes(ta.value).then(() => { ta.value = ''; });
  });
  document.getElementById('manual-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const num = Number(f.elements.number.value);
    if (!f.elements.cls.value.trim() || !Number.isInteger(num) || num < 1) { toast('반과 번호를 입력하세요.', 'warn'); return; }
    addManual(f.elements.cls.value.trim(), num, f.elements.name.value.trim());
    f.elements.number.value = '';
    f.elements.name.value = '';
    f.elements.number.focus();
  });
  document.getElementById('sample-load').addEventListener('click', loadSamples);
  document.getElementById('csv').addEventListener('click', exportCSV);
  document.getElementById('clear').addEventListener('click', () => {
    if (confirm('표를 모두 비울까요?')) { ctx.rows = []; render(); }
  });
  window.addEventListener('beforeunload', (e) => { if (ctx.rows.length) { e.preventDefault(); e.returnValue = ''; } });

  const pre = new URLSearchParams(location.search).get('id');
  if (pre && ctx.mods.some((m) => m.id === pre)) { sel.value = pre; await selectModule(pre); }
}

main();
