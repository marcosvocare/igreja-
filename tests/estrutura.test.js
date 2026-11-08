'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(RAIZ, 'sw.js'), 'utf8');

test('estrutura: todo script do app está no cache offline (sw.js) e existe', () => {
  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map((m) => m[1]);
  assert.ok(scripts.length > 20);
  for (const s of scripts) {
    assert.ok(fs.existsSync(path.join(RAIZ, s)), `${s} não existe`);
    assert.ok(sw.includes(`'${s}'`), `${s} fora do sw.js`);
  }
  assert.equal(scripts[scripts.length - 1], 'js/app.js', 'app.js deve ser o último (as abas se registram antes)');
});

test('estrutura: dados do mapa da cidade no cache offline, no caminho que a aba carrega', () => {
  const cidade = fs.readFileSync(path.join(RAIZ, 'js', 'abas', 'cidade.js'), 'utf8');
  const arquivo = /ARQUIVO_DADOS = '([^']+)'/.exec(cidade)[1];
  assert.ok(fs.existsSync(path.join(RAIZ, arquivo)), `${arquivo} não existe`);
  assert.ok(sw.includes(`'${arquivo}'`), `${arquivo} fora do sw.js`);
});

test('estrutura: toda aba do menu tem seção, e toda seção está no menu', () => {
  const secoes = [...html.matchAll(/<section id="([^"]+)" class="secao"/g)].map((m) => m[1]);
  const abas = [...html.matchAll(/<a href="#([^"]+)" data-grupo="[^"]+">/g)].map((m) => m[1]);
  const doMenu = new Set(abas);
  for (const s of secoes) assert.ok(doMenu.has(s), `seção ${s} sem aba no menu`);
  for (const a of doMenu) assert.ok(secoes.includes(a), `aba ${a} sem seção`);
});
