'use strict';

/**
 * Pacote para instalar no computador (scripts/gerar-pacote.js): gera o .zip,
 * roda o instalador do Linux numa pasta pessoal de teste e abre o app instalado.
 * Os instaladores do Windows e do Mac não rodam aqui; conferimos o que dá para
 * conferir (codificação, fim de linha, permissão de execução, caminhos).
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const RAIZ = path.join(__dirname, '..', '..');

test('pacote: zip com app, instaladores, QR do celular e plano; instalador do Linux cria o atalho e o app abre', async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pacote-'));
  try {
    execFileSync(process.execPath, [path.join(RAIZ, 'scripts', 'gerar-pacote.js'), '--saida', tmp]);
    const zip = path.join(tmp, 'sobrevivencia-urbana.zip');
    assert.ok(fs.statSync(zip).size > 200000);
    const lista = execFileSync('unzip', ['-Z', zip], { encoding: 'utf8' });
    for (const nome of ['INSTALAR-WINDOWS.bat', 'DESINSTALAR-WINDOWS.bat', 'INSTALAR-MAC.command', 'INSTALAR-LINUX.sh', 'LEIA-ME.txt', 'ABRIR-O-APP.html', 'INSTALAR-NO-CELULAR.html', 'PLANO-DE-SOBREVIVENCIA.html', 'app/index.html', 'app/dados/mapa-hortolandia.js', 'app/icone.ico']) {
      assert.match(lista, new RegExp(`Sobrevivencia-Urbana/${nome.replace('.', '\\.')}`), nome);
    }
    // Mac e Linux: executáveis dentro do zip.
    assert.match(lista, /^-rwx.*INSTALAR-MAC\.command$/m);
    assert.match(lista, /^-rwx.*INSTALAR-LINUX\.sh$/m);

    const pasta = path.join(tmp, 'pacote', 'Sobrevivencia-Urbana');
    const ler = (rel) => fs.readFileSync(path.join(pasta, rel));
    // Windows: .bat só com ASCII e CRLF; .ps1 com BOM (acentos no PowerShell 5) e CRLF.
    const bat = ler('INSTALAR-WINDOWS.bat').toString('latin1');
    assert.ok(/^[\x00-\x7f]*$/.test(bat), '.bat só com ASCII');
    assert.ok(bat.includes('\r\n') && !/[^\r]\n/.test(bat), '.bat com CRLF');
    assert.match(bat, /instalador\\instalar-windows\.ps1/);
    const ps1 = ler('instalador/instalar-windows.ps1');
    assert.deepEqual([...ps1.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    const ps1t = ps1.toString('utf8');
    assert.match(ps1t, /Sobrevivência Urbana\.lnk/);
    assert.match(ps1t, /--app=/);
    assert.match(ps1t, /GetFolderPath\('Desktop'\)/);
    assert.equal(ler('app/icone.ico').readUInt16LE(2), 1, 'ícone .ico válido');
    assert.match(ler('LEIA-ME.txt').toString('utf8'), /INSTALAR-WINDOWS\.bat/);
    // Celular: QR code e endereço do site.
    const celular = ler('INSTALAR-NO-CELULAR.html').toString('utf8');
    assert.match(celular, /<svg class="qr"/);
    assert.match(celular, /marcosvocare\.github\.io\/igreja-/);
    assert.match(ler('PLANO-DE-SOBREVIVENCIA.html').toString('utf8'), /<h1[^>]*>Plano de Sobrevivência Urbana<\/h1>/);

    // Instalador do Linux numa pasta pessoal de teste.
    const casa = path.join(tmp, 'casa');
    fs.mkdirSync(path.join(casa, 'Desktop'), { recursive: true });
    execFileSync('bash', [path.join(pasta, 'INSTALAR-LINUX.sh')], { env: { ...process.env, HOME: casa, PATH: process.env.PATH } });
    const atalho = fs.readFileSync(path.join(casa, 'Desktop', 'sobrevivencia-urbana.desktop'), 'utf8');
    assert.match(atalho, /^Name=Sobrevivência Urbana$/m);
    assert.ok(fs.existsSync(path.join(casa, '.local', 'share', 'applications', 'sobrevivencia-urbana.desktop')));
    const instalado = path.join(casa, '.local', 'share', 'sobrevivencia-urbana', 'index.html');
    assert.ok(fs.existsSync(instalado));

    const navegador = await chromium.launch();
    try {
      const page = await navegador.newPage({ viewport: { width: 1280, height: 900 } });
      const erros = [];
      page.on('pageerror', (e) => erros.push(e.message));
      // App instalado: abre sem internet, com o mapa da cidade.
      await page.goto(`${pathToFileURL(instalado).href}#cidade`);
      await page.waitForSelector('#carregando-mapa[hidden]', { state: 'attached' });
      await page.fill('#busca-cidade', 'jd amanda');
      await page.waitForSelector('#resultados-cidade button');
      // "Abrir sem instalar" leva ao app da pasta.
      await page.goto(pathToFileURL(path.join(pasta, 'ABRIR-O-APP.html')).href);
      await page.waitForURL(/app\/index\.html/);
      await page.waitForSelector('#situacao.ativa');
      assert.deepEqual(erros, []);
    } finally {
      await navegador.close();
    }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
