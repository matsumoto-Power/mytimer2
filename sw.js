/* =========================================================
   MY TIMER — Service Worker
   ---------------------------------------------------------
   ・キャッシュ優先（Cache First）で起動を高速化し、オフラインでも動くようにする
   ・裏側で常に最新版を取りに行き、キャッシュを更新しておく（次回起動時に反映）
   ・新しいバージョンが見つかっても即切り替えず、index.html側の「更新する」ボタンが
     押されるまで待つ（SKIP_WAITINGメッセージを受け取ってから self.skipWaiting()）

   ★ 新しいバージョンをデプロイするたびに、この APP_VERSION の値を変更してください。
     変更しないと、ブラウザが「内容は前と同じ」と判断し、更新通知が出ません。
========================================================= */
const APP_VERSION = 'v22-20260816';
const CACHE_NAME = `my-timer-cache-${APP_VERSION}`;

const PRECACHE_URLS = [
  './',
  './index.html',
  './icons/manifest.json',
  './icons/favicon-32.png',
  './icons/apple-touch-icon-180.png',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[sw] precache失敗（一部ファイルが見つからない可能性）', err))
    // ここでは skipWaiting() を呼ばない。
    // index.html側で「更新する」が押されたときに SKIP_WAITING メッセージを受け取ってから切り替える。
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)) // 古いバージョンのキャッシュを掃除
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // 別オリジン（Googleフォント等）はブラウザの通常キャッシュに任せ、ここでは素通しする
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request)
        .then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached); // オフライン時はキャッシュへフォールバック

      // キャッシュがあれば即返して体感速度を優先しつつ、裏側で最新化しておく
      return cached || networkFetch;
    })
  );
});
