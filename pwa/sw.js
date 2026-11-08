// GUVIO — service worker simples
// - páginas: sempre tenta a rede primeiro (para pegar versão nova); sem internet, usa a última salva
// - arquivos do app (/_expo/, ícones): guarda no cache, porque o nome já muda a cada versão
const CACHE = "guvio-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase, fotos etc. vão direto
  if (url.pathname.endsWith("/version.json")) return;

  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(new URL("./", self.registration.scope).href, copy));
          return res;
        })
        .catch(() => caches.match(new URL("./", self.registration.scope).href))
    );
    return;
  }

  if (url.pathname.includes("/_expo/") || url.pathname.includes("/assets/") || /\.(png|ico|webmanifest|ttf)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then(
        hit =>
          hit ||
          fetch(req).then(res => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then(c => c.put(req, copy));
            }
            return res;
          })
      )
    );
  }
});
