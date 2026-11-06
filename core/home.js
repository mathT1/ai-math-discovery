// 홈: 단원·주제·난이도로 모듈 찾기 [R1]
import { el, showFatal } from './ui.js';
import { loadCatalog, moduleURL, showDrafts } from './catalog.js';

const stars = (n) => '★'.repeat(n) + '☆'.repeat(Math.max(0, 3 - n));

function card(m) {
  return el('article', { class: 'card module-card' },
    el('p', { class: 'eyebrow' }, `${m.subject} · ${m.unit}`, m.status !== 'published' ? el('span', { class: 'badge warn' }, '만드는 중') : null),
    el('h2', {}, el('a', { href: moduleURL(m.id).href }, m.title)),
    m.subtitle ? el('p', {}, m.subtitle) : null,
    el('p', { class: 'tags' }, m.topics.map((t) => el('span', { class: 'tag' }, t))),
    el('p', { class: 'muted small' },
      `${m.grade.join('·')} · ${m.periods}차시 · 난이도 `, el('span', { 'aria-label': `난이도 ${m.difficulty} / 3` }, stars(m.difficulty))),
    el('div', { class: 'btn-row' },
      el('a', { class: 'btn primary', href: moduleURL(m.id).href }, '활동 시작'),
      el('a', { class: 'btn ghost', href: `guide.html?id=${encodeURIComponent(m.id)}` }, '지도안')));
}

function options(select, values, allLabel) {
  select.replaceChildren(el('option', { value: '' }, allLabel), ...values.map((v) => el('option', { value: v }, v)));
}

async function main() {
  const list = document.getElementById('module-list');
  let mods;
  try {
    mods = await loadCatalog({ drafts: showDrafts() });
  } catch (e) {
    showFatal(list, e);
    return;
  }
  const fSubject = document.getElementById('f-subject');
  const fTopic = document.getElementById('f-topic');
  const fDiff = document.getElementById('f-diff');
  const fText = document.getElementById('f-text');
  const uniq = (arr) => [...new Set(arr)].sort((a, b) => a.localeCompare(b, 'ko'));
  options(fSubject, uniq(mods.map((m) => `${m.subject} · ${m.unit}`)), '모든 과목·단원');
  options(fTopic, uniq(mods.flatMap((m) => m.topics)), '모든 주제');

  const render = () => {
    const su = fSubject.value, tp = fTopic.value, df = fDiff.value, tx = fText.value.trim().toLowerCase();
    const shown = mods.filter((m) =>
      (!su || `${m.subject} · ${m.unit}` === su) &&
      (!tp || m.topics.includes(tp)) &&
      (!df || String(m.difficulty) === df) &&
      (!tx || [m.title, m.subtitle, m.subject, m.unit, ...m.topics].join(' ').toLowerCase().includes(tx)));
    list.replaceChildren(...(shown.length ? shown.map(card) : [el('p', { class: 'muted' }, '조건에 맞는 활동이 없습니다.')]));
    document.getElementById('count').textContent = `${shown.length}개 활동`;
  };
  [fSubject, fTopic, fDiff].forEach((s) => s.addEventListener('change', render));
  fText.addEventListener('input', render);
  render();
}

main();
