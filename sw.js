/**
 * 설치형 앱(PWA) 바탕.
 *  - 첫 화면(navigate)은 네트워크 먼저, 끊기면 저장본.
 *  - 같은 출처 정적 파일과 esm.sh 모듈은 저장본 먼저(버전이 주소에 박혀 있어 내용이 안 바뀐다).
 *  - 서버(Apps Script) POST는 건드리지 않는다.
 */
const CACHE = 'gomok-0.3.0';
const PRE = ['./', 'index.html', 'styles.css', 'config.js', 'icon.svg', 'manifest.webmanifest',
  'src/main.js', 'src/App.js', 'src/Online.js', 'src/h.js', 'src/hwatu.js', 'src/engine.js', 'src/ai.js', 'src/cards.js', 'src/fx.js', 'src/ledger.js', 'src/net.js', 'src/avatars.js', 'src/tutorial.js', 'src/audio.js', 'src/juice.js'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(PRE); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k.indexOf('gomok-') === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); })); })
    .then(function () { return self.clients.claim(); }));
});
self.addEventListener('fetch', function (e) {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  if (r.mode === 'navigate') {
    e.respondWith(fetch(r).then(function (res) { const cp = res.clone(); caches.open(CACHE).then(function (c) { c.put('./', cp); }); return res; })
      .catch(function () { return caches.match('./'); }));
    return;
  }
  if (u.origin === location.origin || u.host === 'esm.sh' || u.host === 'cdn.jsdelivr.net') {
    e.respondWith(caches.match(r).then(function (hit) {
      return hit || fetch(r).then(function (res) { if (res.ok) { const cp = res.clone(); caches.open(CACHE).then(function (c) { c.put(r, cp); }); } return res; });
    }));
  }
});
