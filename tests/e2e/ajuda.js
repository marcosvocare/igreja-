'use strict';

/**
 * Utilidades dos testes de navegador (Playwright).
 * O app é aberto direto do disco (file://), como no uso offline.
 * Para testar outro endereço: APP_URL=https://... npm run test:e2e
 */
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const URL_APP = process.env.APP_URL || pathToFileURL(path.join(__dirname, '..', '..', 'index.html')).href;

let navegador = null;

async function iniciarNavegador() {
  if (!navegador) navegador = await chromium.launch();
  return navegador;
}

async function fecharNavegador() {
  if (navegador) await navegador.close();
  navegador = null;
}

/**
 * Abre o app numa página nova, com armazenamento limpo.
 * @param {{largura?:number, altura?:number, esquema?:'light'|'dark', tela?:'computador'|'celular', hash?:string}} [opcoes]
 * @returns {Promise<{page, erros:string[], ir:(hash:string)=>Promise<void>, texto:(sel:string)=>Promise<string>, fechar:()=>Promise<void>}>}
 */
async function abrirApp({ largura = 390, altura = 844, esquema = 'light', tela = 'celular', hash = '' } = {}) {
  const b = await iniciarNavegador();
  const contexto = await b.newContext({ viewport: { width: largura, height: altura }, colorScheme: esquema });
  const page = await contexto.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push(`erro de página: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error' && !/manifest|service ?worker/i.test(m.text())) erros.push(`console: ${m.text()}`);
  });
  await page.goto(URL_APP + (hash ? `#${hash}` : ''));
  // O padrão do app é o modo computador; troca pelo botão, como uma pessoa faria.
  // (Gravar no armazenamento antes de a página carregar faz o Chromium perder dados.)
  const botaoTela = page.locator('#botao-tela');
  if (tela === 'celular' && (await botaoTela.isVisible()) && (await botaoTela.textContent()) === 'Computador') {
    await botaoTela.click();
  }
  const ir = async (h) => {
    await page.goto(URL_APP + `#${h}`);
    await page.waitForFunction((id) => {
      const s = document.getElementById(id.split('-')[0]);
      return !s || s.classList.contains('ativa');
    }, h);
  };
  const texto = async (sel) => String(await page.textContent(sel)).replace(/\s+/g, ' ').trim();
  const fechar = () => contexto.close();
  return { page, erros, ir, texto, fechar };
}

/** Recarrega a página, dando antes um tempo para o navegador gravar o armazenamento. */
async function recarregar(page) {
  await page.waitForTimeout(1200);
  await page.reload();
}

/** Largura do documento maior que a janela = rolagem lateral (proibida). */
async function rolagemLateral(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
}

module.exports = { URL_APP, abrirApp, fecharNavegador, rolagemLateral, recarregar };
