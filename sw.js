/* Service worker: guarda o app em cache para funcionar sem internet. */
const CACHE = 'sobrevivencia-urbana-v3';
const ARQUIVOS = [
  './',
  'index.html',
  'css/estilo.css',
  'js/app.js',
  'js/nucleo/suprimentos.js',
  'js/nucleo/agua.js',
  'js/nucleo/estoque.js',
  'js/nucleo/situacao.js',
  'js/nucleo/comunicacao.js',
  'js/nucleo/kit.js',
  'js/nucleo/cenarios.js',
  'js/nucleo/rede.js',
  'js/nucleo/mapa.js',
  'js/nucleo/remedios.js',
  'js/nucleo/partilha.js',
  'js/nucleo/defesa.js',
  'js/nucleo/radio.js',
  'js/nucleo/rotulos.js',
  'js/app-colapso.js',
  'js/app-radio.js',
  'icone.svg',
  'manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((chaves) => Promise.all(chaves.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Rede primeiro (recebe atualizações quando há internet); cache quando offline.
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET' || new URL(e.request.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((resposta) => {
        if (resposta.ok) {
          const copia = resposta.clone();
          caches.open(CACHE).then((c) => c.put(e.request, copia));
        }
        return resposta;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then((r) => r || caches.match('index.html'))),
  );
});
