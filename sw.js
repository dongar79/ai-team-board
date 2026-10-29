/* 理쒖냼 �쒕퉬�� �뚯빱: �� �붾㈃ 異붽�(PWA) 議곌굔��. �ㅽ듃�뚰겕 �곗꽑, �ㅽ뙣�섎㈃ 罹먯떆.
 * 10-29 GPT 由щ럭 諛섏쁺: �� �� �묐몢�ъ쓽 �� 罹먯떆留� 吏��곌퀬, �뺤긽 �묐떟(ok)留� 罹먯떆�쒕떎. */
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
