// [견본] 활동 — 표준 함수 4개를 export 합니다 (core/shell.js가 부름)
//   init(container, meta, data, ctx)        ctx.saved: 오늘 하던 payload(없으면 null), ctx.onChange(): 바뀔 때마다 호출
//   renderAIComparison(container, payload, data)
//   getResultData()                          → payload: 원자료만 (점수·정답 여부 같은 요약값은 넣지 않음)
//   renderSummaryCanvas(canvas, payload)     → 보고서 그림

let state = { n: 10, answer: null };

const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => (k.startsWith('on') ? e.addEventListener(k.slice(2), v) : e.setAttribute(k, v)));
  e.append(...kids);
  return e;
};

export function init(container, meta, data, ctx) {
  if (ctx?.saved) state = { ...state, ...ctx.saved };
  const nInput = el('input', { id: 'tpl-n', type: 'number', min: '1', max: '100', value: String(state.n) });
  const aInput = el('input', { id: 'tpl-answer', type: 'number', value: state.answer ?? '' });
  const feedback = el('p', { 'aria-live': 'polite' });
  const update = () => {
    state.n = Math.max(1, Math.min(100, Number(nInput.value) || 1));
    state.answer = aInput.value === '' ? null : Number(aInput.value);
    feedback.textContent = state.answer === null ? '' : `n = ${state.n} 일 때 내 답: ${state.answer}`;
    ctx?.onChange?.();
  };
  nInput.addEventListener('input', update);
  aInput.addEventListener('input', update);
  container.append(
    el('div', { class: 'card' },
      el('p', {}, '1부터 n까지의 합을 구해 보세요. 계산기를 쓰지 말고 방법을 찾아보세요.'),
      el('div', { class: 'field-row' },
        el('div', { class: 'field' }, el('label', { for: 'tpl-n' }, 'n'), nInput),
        el('div', { class: 'field' }, el('label', { for: 'tpl-answer' }, '합'), aInput)),
      feedback));
  update();
}

export function getResultData() {
  return { n: state.n, answer: state.answer };
}

export function renderAIComparison(container, payload, data) {
  const ex = data.example;
  container.append(el('div', { class: 'card' },
    el('h2', {}, '다른 방법과 비교'),
    el('p', {}, ex.method),
    el('p', {}, `공식: $${ex.formula}$`),
    el('p', {}, `n = ${payload.n} 이면 ${payload.n * (payload.n + 1) / 2} 입니다. 내 답: ${payload.answer ?? '(없음)'}`)));
}

export function renderSummaryCanvas(canvas, payload) {
  // 점 삼각형: 1행에 1개, 2행에 2개 … (최대 20행까지 그림)
  const ctx = canvas.getContext('2d');
  const rows = Math.min(payload.n, 20);
  const r = Math.min(12, (canvas.height - 40) / rows / 2.4);
  ctx.fillStyle = '#111';
  for (let i = 1; i <= rows; i++) {
    for (let j = 0; j < i; j++) {
      ctx.beginPath();
      ctx.arc(40 + j * r * 2.4, 20 + (i - 0.5) * r * 2.4, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.font = '28px sans-serif';
  ctx.fillText(`n = ${payload.n}, 내 답 = ${payload.answer ?? '없음'}`, canvas.width / 2, 60);
}
