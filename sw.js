/**
 * 설치형 앱(PWA) 바탕.
 *  - 화면·코드(html/js/css/config): 네트워크 먼저, 끊기면 저장본. 새 버전이 바로 보이게.
 *  - 그림·소리(assets/)와 esm.sh 모듈, 글꼴: 저장본 먼저(내용이 안 바뀐다).
 *  - 미리 받을 때는 브라우저 HTTP 캐시를 건너뛴다(cache: 'reload') — 낡은 파일이 저장본에 섞이지 않게.
 *  - 서버(Apps Script) POST는 건드리지 않는다.
 */
const CACHE = 'gomok-0.5.2';
const PRE = ['./', 'index.html', 'styles.css', 'config.js', 'icon.svg', 'manifest.webmanifest',
  'src/main.js', 'src/App.js', 'src/Online.js', 'src/h.js', 'src/hwatu.js', 'src/engine.js', 'src/ai.js', 'src/cards.js', 'src/fx.js', 'src/ledger.js', 'src/net.js',
  'src/avatars.js', 'src/tutorial.js', 'src/audio.js', 'src/juice.js', 'src/learn.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return Promise.all(PRE.map(function (u) { return fetch(new Request(u, { cache: 'reload' })).then(function (r) { if (r.ok) return c.put(u, r); }); }));
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('gomok-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
function networkFirst(r) {
  return fetch(r, { cache: 'no-cache' }).then(function (res) {
    if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); }
    return res;
  }).catch(function () { return caches.match(r).then(function (hit) { return hit || caches.match('./'); }); });
}
function cacheFirst(r) {
  return caches.match(r).then(function (hit) {
    return hit || fetch(r).then(function (res) { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); } return res; });
  });
}
self.addEventListener('fetch', function (e) {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (u.origin === location.origin) {
    if (r.mode === 'navigate' || !/\/assets\//.test(u.pathname)) { e.respondWith(networkFirst(r)); return; }
    e.respondWith(cacheFirst(r)); return;
  }
  if (u.host === 'esm.sh' || u.host === 'cdn.jsdelivr.net') e.respondWith(cacheFirst(r));
});