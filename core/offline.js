// 오프라인(Service Worker) 등록과 상태 표시 [D17]
// - GitHub Pages에서는 자동 등록. 내 컴퓨터(localhost)에서는 개발 중 옛 파일이 보이지 않게 ?sw=1 일 때만 등록
// - ?nosw 를 붙이면 등록하지 않고, 이미 저장된 것도 해제 (문제가 생겼을 때 인터넷에서 새로 받기)
// - 새 버전이 설치되면 화면 아래에 [새로고침] 안내 (수업 중 저절로 바뀌지 않게, 누를 때만 적용)
const SW_URL = new URL('../sw.js', import.meta.url);
const SCOPE = new URL('../', import.meta.url).pathname;

export function setupOffline({ statusEl = null } = {}) {
  if (!('serviceWorker' in navigator)) { show(statusEl, '이 브라우저는 오프라인 저장을 지원하지 않습니다.'); return; }
  const q = new URLSearchParams(location.search);
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (q.has('nosw')) {
    navigator.serviceWorker.getRegistrations().then(async (regs) => {
      for (const r of regs) await r.unregister();
      for (const k of await caches.keys()) if (k.startsWith('aimath-')) await caches.delete(k);
      // 주소창에서 ?nosw를 지워, 그냥 새로고침만 해도 다시 저장되게 함 (M4 검토 ①)
      q.delete('nosw');
      history.replaceState(null, '', location.pathname + (q.toString() ? `?${q}` : '') + location.hash);
      show(statusEl, regs.length ? '오프라인 저장을 해제했습니다. 새로고침하면 인터넷에서 새로 받아 다시 저장합니다.' : '오프라인 저장: 꺼짐 (?nosw)');
    });
    return;
  }
  if (local && !q.has('sw') && !navigator.serviceWorker.controller) { show(statusEl, '오프라인 저장: 내 컴퓨터 미리보기에서는 꺼져 있음 (?sw=1 로 켜기)'); return; }

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) location.reload();
  });
  navigator.serviceWorker.addEventListener('message', (e) => {
    if (e.data?.type !== 'STATUS') return;
    const { cached, total, version } = e.data;
    show(statusEl, cached >= total
      ? `✔ 인터넷 없이 쓸 준비 완료 (파일 ${total}개 저장, 버전 ${version})`
      : `인터넷 없이 쓸 준비 중… (${cached}/${total})`, cached >= total);
    if (cached < total) setTimeout(askStatus, 1500);
  });

  navigator.serviceWorker.register(SW_URL, { scope: SCOPE }).then((reg) => {
    const offer = () => { if (reg.waiting && navigator.serviceWorker.controller) updateBanner(reg, () => { reloading = true; }); };
    offer();
    reg.addEventListener('updatefound', () => {
      reg.installing?.addEventListener('statechange', offer);
    });
    navigator.serviceWorker.ready.then(askStatus);
  }).catch((err) => {
    console.warn('Service Worker 등록 실패', err);
    show(statusEl, '오프라인 저장을 준비하지 못했습니다 (인터넷 연결 시 정상 동작).');
  });
}

function askStatus() {
  navigator.serviceWorker.ready.then((reg) => reg.active?.postMessage({ type: 'STATUS' }));
}

function show(el, text, ready = false) {
  if (!el) return;
  el.textContent = text;
  el.dataset.ready = ready ? '1' : '0';
}

function updateBanner(reg, onReload) {
  if (document.getElementById('sw-update')) return;
  const bar = document.createElement('div');
  bar.id = 'sw-update';
  bar.className = 'sw-update';
  bar.setAttribute('role', 'status');
  const text = document.createElement('span');
  text.textContent = '새 버전이 있습니다. 하던 일을 마친 뒤 새로고침하세요 (교사 채점 중이면 CSV를 먼저 저장).';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn primary small';
  btn.textContent = '새로고침';
  btn.addEventListener('click', () => { onReload(); reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); });
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'btn ghost small';
  later.textContent = '나중에';
  later.addEventListener('click', () => bar.remove());
  bar.append(text, btn, later);
  document.body.append(bar);
}
