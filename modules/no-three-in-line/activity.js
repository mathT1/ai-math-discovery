// no-three-in-line 활동
// 격자 칸 = 버튼 (키보드 방향키로 이동, Enter/Space로 점 찍기·지우기)
// 공선은 색만이 아니라 점선 직선·'!' 표시·번호 목록으로 함께 알림 (접근성)
import { cleanPoints, badLines, lineEnds, forbiddenCells, binom, formatBig } from './geometry.js';
import { metrics } from './grader.js';

const SIZES = [3, 4, 5, 6, 7, 8];
const S = { n: 6, boards: {}, hint: false, focus: [0, 0] };
let refs = {};
let notify = () => {};

const NS = 'http://www.w3.org/2000/svg';
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'class') e.className = v;
    else e.setAttribute(k, v === true ? '' : v);
  }
  e.append(...kids.flat().filter((k) => k !== null && k !== undefined && k !== false));
  return e;
}
function svg(tag, attrs = {}, ...kids) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

const points = () => (S.boards[S.n] ??= []);
const indexOf = (x, y) => points().findIndex((p) => p[0] === x && p[1] === y);

// ---------- 표준 함수 ----------

export function init(container, meta, data, ctx) {
  notify = ctx?.onChange ?? (() => {});
  const saved = ctx?.saved;
  if (saved && SIZES.includes(saved.n)) {
    S.n = saved.n;
    S.boards[S.n] = cleanPoints(saved.points, S.n).points;
  }

  refs.size = h('select', { id: 'n3l-size', onchange: (e) => { S.n = Number(e.target.value); S.focus = [0, 0]; update(); } },
    SIZES.map((n) => h('option', { value: n, selected: n === S.n }, `${n} × ${n}`)));
  refs.hintBtn = h('button', { type: 'button', class: 'btn', 'aria-pressed': 'false', onclick: () => { S.hint = !S.hint; update(); } }, '힌트: 놓을 수 없는 곳 보기');
  refs.board = h('div', { class: 'n3l-board', role: 'grid', 'aria-label': '격자', onkeydown: onBoardKey });
  refs.lines = svg('svg', { class: 'n3l-lines', 'aria-hidden': 'true', preserveAspectRatio: 'none' });
  refs.status = h('div', { class: 'n3l-status', 'aria-live': 'polite' });

  container.append(
    h('div', { class: 'card' },
      h('p', {}, '격자의 교차점을 눌러 점을 찍으세요. 다시 누르면 지워집니다. ',
        h('strong', {}, '어느 세 점도 한 직선 위에 있으면 안 됩니다'), ' — 가로·세로·대각선뿐 아니라 기울기가 $\\tfrac{1}{2}$, $2$ 같은 직선도 모두 해당합니다.'),
      h('div', { class: 'n3l-controls' },
        h('div', { class: 'field' }, h('label', { for: 'n3l-size' }, '격자 크기'), refs.size),
        refs.hintBtn,
        h('button', { type: 'button', class: 'btn ghost', onclick: () => { if (confirm('이 격자의 점을 모두 지울까요?')) { S.boards[S.n] = []; update(); } } }, '모두 지우기'))),
    h('div', { class: 'n3l-layout' },
      h('div', { class: 'n3l-board-wrap' },
        h('div', { class: 'n3l-board-box' }, refs.board, refs.lines),
        h('p', { class: 'muted small' }, '왼쪽 아래가 (0, 0)입니다. 키보드: 방향키로 이동, Enter·Space로 찍기·지우기.')),
      h('div', { class: 'card n3l-side' }, refs.status)),
    h('details', { class: 'card' },
      h('summary', {}, '세 점이 한 직선 위에 있는지 어떻게 판정할까?'),
      h('p', {}, '서로 다른 세 점 $A(x_1,y_1)$, $B(x_2,y_2)$, $C(x_3,y_3)$에서 직선 $AB$와 직선 $AC$의 기울기가 같으면 세 점은 한 직선 위에 있습니다.'),
      h('p', {}, '$$\\frac{y_2-y_1}{x_2-x_1}=\\frac{y_3-y_1}{x_3-x_1}$$'),
      h('p', {}, '그런데 $x_2=x_1$이면 분모가 0이 됩니다. 이 프로그램은 양변에 분모를 곱한 다음 식으로 판정합니다. 나눗셈이 없어서 세로선도 판정할 수 있습니다.'),
      h('p', {}, '$$(x_2-x_1)(y_3-y_1)=(y_2-y_1)(x_3-x_1)$$')));
  update(false);
}

/**
 * 제출할 격자: 지금 화면의 격자보다 다른 격자의 성취가 더 높으면 그 격자를 냄 (M2 검토 ③-1)
 * 비교 순서: 규칙 준수 → progress → 점 개수 → 지금 화면의 격자
 */
function bestBoard() {
  const score = (n) => {
    const v = metrics({ n, points: S.boards[n] ?? [] }).values;
    return [v.ruleOK, v.progress, v.pointCount, n === S.n ? 1 : 0];
  };
  let best = S.n, bestKey = score(S.n);
  for (const k of Object.keys(S.boards).map(Number)) {
    if (!SIZES.includes(k) || k === S.n) continue;
    const key = score(k);
    const i = key.findIndex((v, j) => v !== bestKey[j]);
    if (i >= 0 && key[i] > bestKey[i]) { best = k; bestKey = key; }
  }
  return best;
}

export function getResultData() {
  const n = bestBoard();
  return { n, points: (S.boards[n] ?? []).map((p) => [p[0], p[1]]) };
}

export function renderAIComparison(container, payload, data) {
  const { n } = payload;
  const mine = cleanPoints(payload.points, n).points;
  const bad = badLines(mine);
  const known = data.solutions.solutions[String(n)];
  const paper = data.paper;

  const rows = SIZES.concat([19]).map((k) => h('tr', {},
    h('td', {}, `${k} × ${k}`),
    h('td', { class: 'num' }, String(2 * k)),
    h('td', { class: 'num' }, formatBig(binom(k * k, 2 * k))),
    h('td', { class: 'num' }, formatBig(binom(2 * k, 3)))));

  container.append(
    h('div', { class: 'card' },
      h('h2', {}, '1. 나의 배치와 2n개 배치 비교'),
      h('div', { class: 'n3l-compare' },
        h('figure', {}, staticBoard(n, mine, bad), h('figcaption', {}, `나의 배치: 점 ${mine.length}개 / 최대 ${2 * n}개`, bad.length ? `, 한 직선 위의 세 점 있음` : ', 규칙 지킴')),
        known ? h('figure', {}, staticBoard(n, known, []), h('figcaption', {}, `${n}×${n}에서 2n = ${2 * n}개를 찍은 배치 예`)) : null),
      h('p', { class: 'muted small' }, '오른쪽 배치는 이 프로그램이 직접 탐색해 찾고, 모든 세 점 조합을 검사해 확인한 예입니다. 논문의 AI가 찾은 해는 아닙니다. 2n개 배치는 하나뿐이 아니며, 여러분이 찾은 배치가 다를 수 있습니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '2. 왜 최대 2n개일까?'),
      h('p', {}, '어느 한 가로줄에 점이 3개 있으면 그 세 점은 한 직선 위에 있습니다. 그러니 가로줄마다 점은 2개 이하이고, 가로줄이 n개이므로 점은 최대 2n개입니다.'),
      h('p', {}, '작은 n에서는 실제로 2n개를 찍을 수 있다고 알려져 있습니다(이 프로그램도 3×3부터 8×8까지 직접 찾아 확인했습니다). 하지만 n이 아주 커지면 2n개는 불가능할 것이라는 추측이 있고, 이것은 아직 증명되지 않았습니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '3. 왜 컴퓨터에게도 어려울까? — 경우의 수'),
      h('p', {}, '$n^2$개의 교차점 중 점 $2n$개를 고르는 방법은 ${}_{n^2}\\mathrm{C}_{2n}$가지이고, 고른 $2n$개 점마다 세 점씩 ${}_{2n}\\mathrm{C}_{3}$번 확인해야 합니다.'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'n3l-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '격자'), h('th', {}, '목표 2n'), h('th', {}, '점 2n개를 고르는 방법 수'), h('th', {}, '확인할 세 점 조합 수'))),
        h('tbody', {}, rows))),
      h('p', { class: 'muted small' }, '모든 경우를 하나씩 확인하는 것은 격자가 조금만 커져도 불가능합니다. 그래서 똑똑하게 찾는 방법이 필요합니다.')),
    h('div', { class: 'card' },
      h('h2', {}, '4. 연구 결과: 고전 방법과 AI 방법'),
      h('div', { class: 'table-wrap' }, h('table', { class: 'n3l-table' },
        h('thead', {}, h('tr', {}, h('th', {}, '방법'), h('th', {}, '종류'), h('th', {}, '결과'))),
        h('tbody', {}, paper.methods.map((m) => h('tr', {}, h('td', {}, m.name), h('td', {}, m.kind), h('td', {}, m.result)))))),
      h('p', {}, h('strong', {}, '연구의 결론: '), paper.conclusion),
      h('p', { class: 'muted small' }, `출처: ${paper.source}`)),
  );
}

export function renderSummaryCanvas(canvas, payload) {
  const ctx = canvas.getContext('2d');
  const { n } = payload;
  const pts = cleanPoints(payload.points, n).points;
  const bad = badLines(pts);
  const badSet = new Set(bad.flatMap((l) => l.points));
  const size = canvas.height - 60;
  const cell = size / n;
  const ox = 40, oy = 30;
  const cx = (x) => ox + (x + 0.5) * cell;
  const cy = (y) => oy + (n - 1 - y + 0.5) * cell;

  ctx.strokeStyle = '#c8c8c8';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    ctx.beginPath(); ctx.moveTo(cx(i), cy(0)); ctx.lineTo(cx(i), cy(n - 1)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx(0), cy(i)); ctx.lineTo(cx(n - 1), cy(i)); ctx.stroke();
  }
  ctx.fillStyle = '#555';
  ctx.font = '16px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < n; i++) { ctx.fillText(String(i), cx(i), oy + size + 14); ctx.fillText(String(i), ox - 16, cy(i)); }

  // 공선 직선: 굵은 점선
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 4;
  ctx.setLineDash([12, 8]);
  for (const l of bad) {
    const [a, b] = lineEnds(pts, l.points);
    ctx.beginPath(); ctx.moveTo(cx(a[0]), cy(a[1])); ctx.lineTo(cx(b[0]), cy(b[1])); ctx.stroke();
  }
  ctx.setLineDash([]);
  const r = Math.min(22, cell * 0.32);
  pts.forEach((p, i) => {
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(cx(p[0]), cy(p[1]), r, 0, Math.PI * 2); ctx.fill();
    if (badSet.has(i)) { ctx.lineWidth = 3; ctx.strokeRect(cx(p[0]) - r - 6, cy(p[1]) - r - 6, 2 * r + 12, 2 * r + 12); }
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.round(r)}px sans-serif`;
    ctx.fillText(String(i + 1), cx(p[0]), cy(p[1]) + 1);
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#111';
  const tx = ox + size + 60;
  ctx.font = 'bold 30px sans-serif';
  ctx.fillText(`${n} × ${n} 격자`, tx, 40);
  ctx.font = '26px sans-serif';
  ctx.fillText(`점 ${pts.length}개 / 최대 ${2 * n}개`, tx, 90);
  ctx.fillText(bad.length ? `한 직선 위의 세 점: 있음 (${bad.length}개 직선)` : '한 직선 위의 세 점: 없음', tx, 130);
  ctx.font = '20px sans-serif';
  bad.slice(0, 6).forEach((l, i) => ctx.fillText(`· 점 ${l.points.map((k) => k + 1).join(', ')} — 기울기 ${l.slope}`, tx, 180 + i * 30));
  if (bad.length) ctx.fillText('(네모 표시 점, 점선 직선)', tx, 180 + Math.min(bad.length, 6) * 30 + 10);
}

// ---------- 화면 갱신 ----------

function toggle(x, y) {
  const i = indexOf(x, y);
  if (i >= 0) points().splice(i, 1);
  else points().push([x, y]);
  update();
}

function onBoardKey(e) {
  const n = S.n;
  let [x, y] = S.focus;
  const move = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
  if (move) {
    e.preventDefault();
    x = Math.max(0, Math.min(n - 1, x + move[0]));
    y = Math.max(0, Math.min(n - 1, y + move[1]));
    S.focus = [x, y];
    refs.board.querySelector(`[data-x="${x}"][data-y="${y}"]`)?.focus();
    refs.board.querySelectorAll('button').forEach((b) => (b.tabIndex = (Number(b.dataset.x) === x && Number(b.dataset.y) === y) ? 0 : -1));
  }
}

function update(changed = true) {
  const n = S.n;
  const pts = points();
  const bad = badLines(pts);
  const badSet = new Set(bad.flatMap((l) => l.points));
  const forbidden = S.hint ? forbiddenCells(pts, n) : new Set();
  const hadFocus = refs.board.contains(document.activeElement);

  refs.size.value = String(n);
  refs.hintBtn.setAttribute('aria-pressed', String(S.hint));
  refs.hintBtn.textContent = S.hint ? '힌트 끄기' : '힌트: 놓을 수 없는 곳 보기';
  refs.board.style.setProperty('--n', n);

  const cells = [];
  for (let y = n - 1; y >= 0; y--) {
    const row = h('div', { role: 'row', class: 'n3l-row' });
    for (let x = 0; x < n; x++) {
      const i = indexOf(x, y);
      const isBad = i >= 0 && badSet.has(i);
      const isForbidden = i < 0 && forbidden.has(`${x},${y}`);
      const label = i >= 0
        ? `(${x}, ${y}) ${i + 1}번 점${isBad ? ', 다른 두 점과 한 직선 위' : ''}`
        : `(${x}, ${y}) 빈 곳${isForbidden ? ', 놓으면 세 점이 한 직선 위' : ''}`;
      const focused = S.focus[0] === x && S.focus[1] === y;
      row.append(h('div', { role: 'gridcell', class: 'n3l-cell' },
        h('button', {
          type: 'button', class: `n3l-pt${i >= 0 ? ' on' : ''}${isBad ? ' bad' : ''}${isForbidden ? ' forbidden' : ''}`,
          'data-x': x, 'data-y': y, 'aria-label': label, 'aria-pressed': String(i >= 0), tabindex: focused ? '0' : '-1',
          onclick: () => { S.focus = [x, y]; toggle(x, y); },
        }, i >= 0 ? h('span', { class: 'n3l-num' }, String(i + 1)) : (isForbidden ? h('span', { class: 'n3l-x', 'aria-hidden': 'true' }, '×') : ''))));
    }
    cells.push(row);
  }
  refs.board.replaceChildren(...cells);
  if (hadFocus) refs.board.querySelector(`[data-x="${S.focus[0]}"][data-y="${S.focus[1]}"]`)?.focus();

  // 공선 직선 그리기 (보드 위에 겹친 SVG, 좌표 0~n)
  refs.lines.setAttribute('viewBox', `0 0 ${n} ${n}`);
  refs.lines.replaceChildren(...bad.map((l) => {
    const [a, b] = lineEnds(pts, l.points);
    return svg('line', { x1: a[0] + 0.5, y1: n - 1 - a[1] + 0.5, x2: b[0] + 0.5, y2: n - 1 - b[1] + 0.5, class: 'n3l-badline' });
  }));

  // 상태
  const count = pts.length;
  const goal = 2 * n;
  let msg;
  if (bad.length) msg = h('p', { class: 'error' }, '한 직선 위에 있는 세 점이 있습니다. 점선으로 표시된 직선의 점 하나를 지워 보세요.');
  else if (count === goal) msg = h('p', { class: 'ok' }, `성공! ${n}×${n} 격자에 ${goal}개를 찍었습니다. 더 찍을 수 있을까요? (정리 질문 2)`, n < 8 ? ' 더 큰 격자에도 도전해 보세요.' : '');
  else msg = h('p', {}, `규칙을 지키고 있습니다. 목표까지 ${goal - count}개 남았습니다.`);
  refs.status.replaceChildren(...[
    h('p', { class: 'n3l-count' }, h('strong', {}, `${count}`), ` / ${goal}개`),
    msg,
    bad.length ? h('ul', {}, bad.map((l) => h('li', {}, `점 ${l.points.map((k) => k + 1).join(', ')} — 기울기 ${l.slope}`))) : null,
    S.hint ? h('p', { class: 'muted small' }, `× 표시: 지금 점을 놓으면 세 점이 한 직선 위에 오는 곳 (${forbidden.size}곳)`) : null,
    submitNote(),
  ].filter(Boolean));
  if (changed) notify();
}

/** 다른 격자가 제출될 때 알림 */
function submitNote() {
  const b = bestBoard();
  if (b === S.n) return null;
  return h('p', { class: 'n3l-submit-note' }, h('strong', {}, '제출되는 결과: '),
    `${b}×${b} 격자 (점 ${S.boards[b].length}개). 지금 격자보다 더 잘한 결과를 자동으로 냅니다. `,
    h('button', { type: 'button', class: 'btn ghost small', onclick: () => { S.n = b; S.focus = [0, 0]; update(); } }, `${b}×${b}로 돌아가기`));
}

function staticBoard(n, pts, bad) {
  const badSet = new Set(bad.flatMap((l) => l.points));
  const g = svg('svg', { viewBox: `0 0 ${n} ${n}`, class: 'n3l-static', role: 'img', 'aria-label': `${n}×${n} 격자, 점 ${pts.length}개` });
  for (let i = 0; i < n; i++) {
    g.append(svg('line', { x1: i + 0.5, y1: 0.5, x2: i + 0.5, y2: n - 0.5, class: 'grid' }));
    g.append(svg('line', { x1: 0.5, y1: i + 0.5, x2: n - 0.5, y2: i + 0.5, class: 'grid' }));
  }
  for (const l of bad) {
    const [a, b] = lineEnds(pts, l.points);
    g.append(svg('line', { x1: a[0] + 0.5, y1: n - 1 - a[1] + 0.5, x2: b[0] + 0.5, y2: n - 1 - b[1] + 0.5, class: 'n3l-badline' }));
  }
  pts.forEach((p, i) => {
    const x = p[0] + 0.5, y = n - 1 - p[1] + 0.5;
    // 공선 점: 네모 테두리 (탐구 보드·PNG 보고서와 같은 표시) — M2 검토 ⑤-1
    if (badSet.has(i)) g.append(svg('rect', { x: x - 0.4, y: y - 0.4, width: 0.8, height: 0.8, class: 'dot-box' }));
    g.append(svg('circle', { cx: x, cy: y, r: 0.28, class: badSet.has(i) ? 'dot bad' : 'dot' }));
  });
  return g;
}
