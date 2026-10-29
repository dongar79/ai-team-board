/* 최소 서비스 워커: 홈 화면 추가(PWA) 조건용. 네트워크 우선, 실패하면 캐시.
 * 10-29 GPT 리뷰 반영: 이 앱 접두사의 옛 캐시만 지우고, 정상 응답(ok)만 캐시한다. */
const PREFIX = "ai-office-";
const CACHE = PREFIX + "v2";
const FILES = ["./", "./index.html", "./style.css", "./app.js", "./office.svg", "./icon.svg", "./config.js"];
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).catch(() => {}));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) =>
    Promise.all(keys.filter((k) => k.startsWith(PREFIX) && k !== CACHE).map((k) => caches.delete(k)))
  ).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || !e.request.url.startsWith(self.location.origin)) return;
  e.respondWith(fetch(e.request).then((r) => {
    if (r && r.ok) {
      const copy = r.clone();
      e.waitUntil(caches.open(CACHE).then((c) => c.put(e.request, copy)).catch(() => {}));
      return r;
    }
    return caches.match(e.request).then((cached) => cached || r);
  }).catch(() => caches.match(e.request)));
});
