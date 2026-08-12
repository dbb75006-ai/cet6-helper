const CACHE_NAME = 'cet6-v4';
const ASSETS = [
  './',
  './index.html',
  './manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // API请求走网络优先
  if (e.request.url.includes('/api/') || e.request.url.includes('rss2json')) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }
  // 静态资源缓存优先
  e.respondWith(
    caches.match(e.request).then(cached =>
      cached || fetch(e.request).then(resp => {
        if (resp.ok) {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return resp;
      })
    )
  );
});

// 后台同步：检查远程更新
self.addEventListener('sync', e => {
  if (e.tag === 'check-updates') {
    e.waitUntil(checkForUpdates());
  }
});

async function checkForUpdates() {
  try {
    const resp = await fetch('/api/content-version.json', { cache: 'no-cache' });
    if (!resp.ok) return;
    const data = await resp.json();
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({ type: 'update-available', version: data.version });
    });
  } catch(e) {}
}

self.addEventListener('message', e => {
  if (e.data?.type === 'skip-waiting') self.skipWaiting();
});
