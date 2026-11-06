// 화면 공통 도우미

export const PLATFORM_VERSION = '0.1.0';

/** el('div', {class:'x', onclick: fn}, '글자', childEl) */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs ?? {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'class') node.className = v;
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c === undefined || c === null || c === false) continue;
    node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

export async function fetchJSON(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 를 불러오지 못했습니다 (${res.status}).`);
  return res.json();
}

export async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} 를 불러오지 못했습니다 (${res.status}).`);
  return res.text();
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = el('a', { href: url, download: filename });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // 클립보드 권한이 없을 때: 임시 입력칸으로 복사
    const ta = el('textarea', { style: 'position:fixed;left:-9999px' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

let toastTimer;
export function toast(message, kind = 'info') {
  let box = document.getElementById('toast');
  if (!box) {
    box = el('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(box);
  }
  box.textContent = message;
  box.className = `toast show ${kind}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (box.className = 'toast'), 3500);
}

/** 파일 이름에 쓸 수 없는 글자 제거 */
export const safeName = (s) => String(s ?? '').trim().replace(/[\\/:*?"<>|\s]+/g, '_').slice(0, 40);

export function showFatal(container, err) {
  console.error(err);
  container.replaceChildren(el('div', { class: 'card error' },
    el('h2', {}, '불러오기 오류'),
    el('p', {}, String(err?.message ?? err)),
    el('p', { class: 'muted' }, '파일을 직접 더블클릭해 열면 동작하지 않습니다. 웹 주소(https://…) 또는 로컬 서버(node tools/serve.mjs)로 열어 주세요.'),
  ));
}
