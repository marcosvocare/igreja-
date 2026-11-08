/* Service worker: guarda o app em cache para funcionar sem internet. */
const CACHE = 'sobrevivencia-urbana-v9';
const ARQUIVOS = [
  './',
  'index.html',
  'css/estilo.css',
  'js/app.js',
  'js/nucleo/socorros.js',
  'js/nucleo/saneamento.js',
  'js/nucleo/energia.js',
  'js/nucleo/abrigo.js',
  'js/nucleo/pessoas.js',
  'js/nucleo/cozinha.js',
  'js/nucleo/cuidado.js',
  'js/abas/socorros.js',
  'js/abas/saneamento.js',
  'js/abas/cozinha.js',
  'js/abas/energia.js',
  'js/abas/abrigo.js',
  'js/abas/pessoas.js',
  'js/abas/cuidado.js',
  'js/nucleo/versoes.js',
  'js/nucleo/configuracao.js',
  'js/nucleo/cofre.js',
  'js/nucleo/sincronizacao.js',
  'js/abas/inicio.js',
  'js/abas/caderno.js',
  'js/abas/dados.js',
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
  'js/abas/situacao.js',
  'js/abas/mapa.js',
  'js/abas/defesa.js',
  'js/abas/remedios.js',
  'js/abas/partilha.js',
  'js/abas/suprimentos.js',
  'js/abas/estoque.js',
  'js/abas/agua.js',
  'js/abas/kit.js',
  'js/abas/comunicacao.js',
  'js/abas/radio.js',
  'js/abas/rede.js',
  'icone.svg',
  'icones/icone-180.png',
  'icones/icone-192.png',
  'icones/icone-512.png',
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
