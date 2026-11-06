// KaTeX 수식 렌더링 (vendor/katex, 외부 CDN 없음) [D3]
// 본문에서 $...$ (줄 안), $$...$$ (가운데 정렬) 를 수식으로 바꿈

const ROOT = new URL('../', import.meta.url);
let loading = null;

function addScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = () => reject(new Error(`${src} 로딩 실패`));
    document.head.append(s);
  });
}

export function loadKatex() {
  if (loading) return loading;
  const css = document.createElement('link');
  css.rel = 'stylesheet';
  css.href = new URL('vendor/katex/katex.min.css', ROOT).href;
  document.head.append(css);
  loading = addScript(new URL('vendor/katex/katex.min.js', ROOT).href)
    .then(() => addScript(new URL('vendor/katex/contrib/auto-render.min.js', ROOT).href))
    .catch((e) => { console.warn(e); });
  return loading;
}

export async function renderMath(element) {
  await loadKatex();
  if (typeof window.renderMathInElement !== 'function') return; // 실패해도 글자는 그대로 보임
  window.renderMathInElement(element, {
    delimiters: [
      { left: '$$', right: '$$', display: true },
      { left: '$', right: '$', display: false },
    ],
    throwOnError: false,
  });
}
