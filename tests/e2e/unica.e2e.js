'use strict';

/**
 * Versão de arquivo único (a publicada no claude.ai): gera o arquivo, abre no
 * navegador numa tela de celular e confere que não há erro, que o modo
 * computador reduz a página para caber e que a triagem funciona.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', '..');

test('arquivo único: abre sem erros, cabe na tela e a triagem funciona', async () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'sobrevivencia-unica-'));
  const arquivo = path.join(pasta, 'pagina.html');
  execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'gerar-pagina-unica.js'), '--saida', arquivo]);
  const texto = fs.readFileSync(arquivo, 'utf8');
  assert.equal(/<(html|head|body)[\s>]/i.test(texto), false, 'sem esqueleto HTML');
  assert.equal(texto.includes('serviceWorker'), false, 'sem service worker');

  const navegador = await chromium.launch();
  try {
    const page = await navegador.newPage({ viewport: { width: 390, height: 844 } });
    const erros = [];
    page.on('pageerror', (e) => erros.push(e.message));
    await page.goto(`file://${arquivo}`);
    await page.waitForSelector('#situacao.ativa');
    assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
    // Modo computador (padrão) numa tela estreita: montado largo e reduzido para caber.
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('modo-computador')), true);
    const zoom = await page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom));
    assert.ok(zoom > 0.3 && zoom < 0.4, `zoom ${zoom}`);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false);
    // Modo celular: sem redução.
    await page.click('#botao-tela');
    assert.equal(await page.evaluate(() => parseFloat(getComputedStyle(document.body).zoom)), 1);
    await page.check('input[value="agua_subindo"]');
    assert.equal((await page.textContent('.painel-nivel .postura')).trim(), 'Evacuar agora');
    assert.deepEqual(erros, []);
  } finally {
    await navegador.close();
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});
