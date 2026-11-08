#!/usr/bin/env node
/**
 * Gera a versão de arquivo único do app (CSS e JS embutidos), usada para
 * publicar como página no claude.ai. Saída: dist/sobrevivencia-urbana.html
 *
 * Diferenças da versão publicada em relação ao index.html:
 * - sem <html>/<head>/<body> (a plataforma acrescenta o esqueleto);
 * - sem service worker, manifesto e ícone (não funcionam lá);
 * - sem os botões de localização do aparelho e de impressão direta
 *   (o viewer não permite; o caderno é baixado como arquivo);
 * - com os dados do mapa da cidade embutidos.
 *
 * Uso: npm run build:unica  [-- --saida caminho/arquivo.html]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const iSaida = args.indexOf('--saida');
const SAIDA = iSaida >= 0 ? path.resolve(args[iSaida + 1]) : path.join(RAIZ, 'dist', 'sobrevivencia-urbana.html');

function ler(rel) {
  return fs.readFileSync(path.join(RAIZ, rel), 'utf8');
}

function trocarUmaVez(texto, antigo, novo) {
  const n = texto.split(antigo).length - 1;
  if (n !== 1) throw new Error(`Esperava 1 ocorrência de: ${antigo.slice(0, 80)} (achei ${n})`);
  return texto.replace(antigo, () => novo);
}

const html = ler('index.html');
const css = ler('css/estilo.css');
const titulo = (/<title>([^<]*)<\/title>/.exec(html) || [])[1] || 'Sobrevivência Urbana';
const descricao = (/<meta name="description" content="([^"]*)"/.exec(html) || [])[1] || '';

const inicio = html.indexOf('<body>');
const fim = html.lastIndexOf('</body>');
if (inicio < 0 || fim < 0) throw new Error('index.html sem <body>');
let corpo = html.slice(inicio + '<body>'.length, fim);

// Scripts embutidos, sem o registro do service worker.
corpo = corpo.replace(/<script src="([^"]+)"><\/script>/g, (_, arquivo) => {
  let codigo = ler(arquivo);
  if (arquivo === 'js/app.js') {
    codigo = codigo.replace(/\n {2}if \('serviceWorker' in navigator[\s\S]*?\n {2}\}\n/, '\n');
    if (codigo.includes('serviceWorker')) throw new Error('não consegui retirar o service worker de app.js');
  }
  if (arquivo === 'js/abas/cidade.js') {
    // Dados do mapa da cidade embutidos (no app instalado, carregados só ao abrir a aba).
    codigo = `${ler('dados/mapa-hortolandia.js')}\n${codigo}`;
  }
  if (/<\/script/i.test(codigo)) throw new Error(`${arquivo} contém </script>`);
  return `<script>\n${codigo}</script>`;
});
if (/<script src=/.test(corpo)) throw new Error('sobrou script externo');

// Texto da seção "Como usar sem internet".
corpo = corpo.replace(
  /<div class="cartao" id="como-usar">[\s\S]*?<\/div>/,
  `<div class="cartao" id="como-usar">
        <h3>Sobre esta versão</h3>
        <ul>
          <li>Esta é a versão publicada do app. Ela precisa de internet e de login no claude.ai, e os dados ficam salvos só neste navegador.</li>
          <li>Para usar sem internet, instale a versão do GitHub Pages ou abra o arquivo <code>index.html</code> do repositório no aparelho.</li>
          <li>Use “Copiar dados como texto” ou “Baixar cópia de segurança” para levar seus dados de uma versão para a outra.</li>
        </ul>
      </div>`,
);

const cssExtra = `
/* Versão publicada: localização do aparelho e impressão direta não estão disponíveis. */
[data-localizar], #imprimir-cartao, .so-local { display: none !important; }
`;

const pagina =
  `<title>${titulo}</title>\n` +
  (descricao ? `<meta name="description" content="${descricao}">\n` : '') +
  `<style>\n${css}${cssExtra}</style>\n` +
  `${corpo.trim()}\n`;

if (/<(html|head|body)[\s>]|<!doctype/i.test(pagina)) throw new Error('sobrou esqueleto HTML');

fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, pagina);
console.log(`${path.relative(process.cwd(), SAIDA)}: ${Buffer.byteLength(pagina)} bytes`);

module.exports = { trocarUmaVez };
