// Service Worker — tools/build-index.mjs가 이 틀로 /sw.js를 만듭니다. sw.js는 직접 고치지 마세요.
// 목적: 한 번 접속해 두면 인터넷이 끊겨도 모든 모듈·교사 화면이 동작 (현장 시연, 학교망 불안정) [D17]
// 방식: 버전 이름을 붙인 캐시에 사이트 파일 전체를 미리 저장 → 캐시 우선으로 응답
//       파일이 하나라도 바뀌면 VERSION(내용 해시)이 바뀌어 새 Service Worker가 설치됨
// 학생 정보는 다루지 않음: 캐시에는 사이트 파일만 들어가고, 결과물·이름은 저장하지 않음
const VERSION = '__VERSION__';
const FILES = __FILES__;
const CACHE = `aimath-${VERSION}`;
const BASE = new URL('./', self.location).pathname; // 예: /ai-math-discovery/

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // HTTP 캐시를 거치지 않고 새로 받음 (예전 파일이 섞이지 않게)
    await cache.addAll(FILES.map((f) => new Request(f, { cache: 'reload' })));
    // 처음 설치면 바로 활성화. 업데이트면 페이지가 "새로고침"을 누를 때까지 기다림 (수업 중 갑자기 바뀌지 않게)
    if (!self.registration.active) await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('aimath-') && key !== CACHE) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener('message', async (event) => {
  const msg = event.data ?? {};
  if (msg.type === 'SKIP_WAITING') self.skipWaiting();
  if (msg.type === 'STATUS') {
    const cache = await caches.open(CACHE);
    const keys = await cache.keys();
    const have = new Set(keys.map((r) => new URL(r.url).pathname));
    const cached = FILES.filter((f) => have.has(new URL(f, self.location).pathname)).length;
    event.source?.postMessage({ type: 'STATUS', version: VERSION, cached, total: FILES.length });
  }
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(BASE)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    // ?drafts, ?submit=, ?id= 같은 주소 뒤 조건은 무시하고 같은 파일로 응답
    const hit = await cache.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && res.type === 'basic') cache.put(req, res.clone());
      return res;
    } catch {
      if (req.mode === 'navigate') {
        const home = await cache.match(BASE);
        if (home) return home;
      }
      return new Response('인터넷에 연결되어 있지 않고, 이 파일은 미리 저장되지 않았습니다.', {
        status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
