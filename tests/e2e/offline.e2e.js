'use strict';

/**
 * Uso offline e instalação: serve o app por http (como o GitHub Pages), deixa
 * o service worker guardar os arquivos, corta a internet e confere que o app
 * continua abrindo e funcionando. Também confere o manifesto e a letra maior.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', '..');
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

function servidorEstatico() {
  const servidor = http.createServer((req, res) => {
    const caminho = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    const arquivo = path.normalize(path.join(RAIZ, caminho === '/' ? 'index.html' : caminho));
    if (!arquivo.startsWith(RAIZ) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      res.end('não encontrado');
      return;
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(arquivo)] || 'application/octet-stream' });
    fs.createReadStream(arquivo).pipe(res);
  });
  return new Promise((resolver) => servidor.listen(0, '127.0.0.1', () => resolver(servidor)));
}

let servidor;
let navegador;

test.before(async () => {
  servidor = await servidorEstatico();
  navegador = await chromium.launch();
});

test.after(async () => {
  if (navegador) await navegador.close();
  if (servidor) servidor.close();
});

test('offline: depois da primeira visita, o app abre e funciona sem internet', async () => {
  const url = `http://127.0.0.1:${servidor.address().port}/index.html`;
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(e.message));
  await page.goto(url);
  // Espera o service worker ativar e guardar os arquivos.
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await page.waitForFunction(async () => {
    const nomes = await caches.keys();
    if (!nomes.length) return false;
    const cache = await caches.open(nomes[0]);
    return (await cache.keys()).length > 40;
  });

  await contexto.setOffline(true);
  await page.reload();
  await page.waitForSelector('#situacao.ativa');
  await page.check('input[value="agua_subindo"]');
  assert.equal((await page.textContent('.painel-nivel .postura')).trim(), 'Evacuar agora');
  await page.goto(`${url}#socorros`);
  await page.waitForSelector('#socorros.ativa');
  assert.ok((await page.$$('#lista-socorros details')).length >= 10);
  assert.deepEqual(erros, []);
  await contexto.close();
});

test('instalação: manifesto com ícones PNG e ícone do iPhone', async () => {
  const base = `http://127.0.0.1:${servidor.address().port}/`;
  const contexto = await navegador.newContext();
  const page = await contexto.newPage();
  const manifesto = await (await page.request.get(`${base}manifest.webmanifest`)).json();
  assert.equal(manifesto.display, 'standalone');
  const tamanhos = manifesto.icons.map((i) => i.sizes);
  assert.ok(tamanhos.includes('192x192') && tamanhos.includes('512x512'));
  for (const i of manifesto.icons) assert.equal((await page.request.get(base + i.src)).status(), 200, i.src);
  assert.equal((await page.request.get(`${base}icones/icone-180.png`)).status(), 200);
  await contexto.close();
});

test('acessibilidade: letra maior fica salva e botões têm área de toque', async () => {
  const url = `http://127.0.0.1:${servidor.address().port}/index.html`;
  const contexto = await navegador.newContext({ viewport: { width: 390, height: 844 } });
  const page = await contexto.newPage();
  await page.goto(`${url}#rede`);
  const antes = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  await page.click('#botao-letra');
  const depois = await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize));
  assert.ok(depois > antes, `${depois} > ${antes}`);
  await page.waitForTimeout(500);
  await page.reload();
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('letra-grande')), true);
  // Botões pequenos ("✕", "Saiu") com pelo menos 40 px de altura (sem o zoom do modo computador).
  if ((await page.textContent('#botao-tela')) === 'Computador') await page.click('#botao-tela');
  const alturas = await page.$$eval('button.mini:not([hidden])', (b) => b.filter((x) => x.offsetParent).map((x) => x.getBoundingClientRect().height));
  assert.ok(alturas.length > 0);
  assert.ok(Math.min(...alturas) >= 40, `menor botão: ${Math.min(...alturas)} px`);
  await contexto.close();
});
