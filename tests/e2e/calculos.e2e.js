'use strict';

/**
 * Testes de navegador dos cálculos melhorados: dietas, ponto por direção,
 * testes de alcance do rádio, doses e onde buscar remédios, partilha de
 * itens e a postura de reunir as famílias.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirApp, fecharNavegador } = require('./ajuda');

test.after(fecharNavegador);

test('suprimentos: dieta tira alimentos e avisa; triagem com saques pede reunir as famílias', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('suprimentos');
  assert.match(await texto('#resultado-suprimentos'), /Leite em pó/);
  await page.check('[data-dieta="semLactose"]');
  assert.doesNotMatch(await texto('#resultado-suprimentos'), /Leite em pó/);
  assert.match(await texto('#resultado-suprimentos'), /Sem lactose:/);
  await ir('situacao');
  await page.check('input[value="saques"]');
  assert.equal(await texto('.painel-nivel .postura'), 'Reunir as famílias');
  assert.deepEqual(erros, []);
  await fechar();
});

test('mapa: ponto marcado por passos e direção, sem coordenadas', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('mapa');
  await page.fill('#base-coord', '-23.55, -46.63');
  await page.selectOption('#ponto-categoria', 'agua');
  await page.fill('#ponto-nome', 'Mina do barranco');
  await page.fill('#ponto-distancia', '400');
  await page.selectOption('#ponto-unidade', 'passos');
  await page.selectOption('#ponto-direcao', 'leste');
  await page.click('#form-ponto button[type="submit"]');
  await page.click('#botoes-busca button[data-busca="agua"]');
  assert.equal(await texto('#resultado-busca .nome-recurso'), 'Mina do barranco');
  assert.match(await texto('#resultado-busca .direcao'), /300 m a leste/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('rádio: teste "não funcionou" isola, "funcionou" liga', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('radio');
  await page.click('#radio-exemplo');
  assert.equal(await texto('#radio-cobertura .postura'), 'Todos alcançam a base');
  const ids = await page.$$eval('#teste-a option', (o) => o.map((x) => [x.value, x.textContent]));
  const id = (nome) => ids.find((x) => x[1] === nome)[0];
  await page.selectOption('#teste-a', id('Caio'));
  await page.selectOption('#teste-b', id('Igreja'));
  await page.click('#form-teste-radio button[data-resultado="falhou"]');
  assert.match(await texto('#radio-cobertura .postura'), /de 4 alcançam a base/);
  assert.match(await texto('#lista-testes'), /Não funcionou Caio ↔ Igreja/);
  await page.click('#lista-testes button[data-remover-teste]');
  assert.equal(await texto('#radio-cobertura .postura'), 'Todos alcançam a base');
  assert.deepEqual(erros, []);
  await fechar();
});

test('remédios: próximas doses e onde buscar no mapa', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('mapa');
  await page.fill('#base-coord', '-23.55, -46.63');
  await page.selectOption('#ponto-categoria', 'remedio');
  await page.fill('#ponto-nome', 'Farmácia Central');
  await page.fill('#ponto-obs', 'tem losartana');
  await page.fill('#ponto-coord', '-23.548, -46.629');
  await page.click('#form-ponto button[type="submit"]');
  await ir('remedios');
  const daqui = new Date(Date.now() + 60 * 60000);
  const hora = `${String(daqui.getHours()).padStart(2, '0')}:${String(daqui.getMinutes()).padStart(2, '0')}`;
  await page.fill('#rem-pessoa', 'Dona Maria');
  await page.fill('#rem-nome', 'Losartana 50 mg');
  await page.fill('#rem-doses', '2');
  await page.fill('#rem-qtd', '20');
  await page.fill('#rem-horarios', hora);
  await page.click('#form-remedio button[type="submit"]');
  assert.match(await texto('#resumo-remedios'), new RegExp(`Próximas doses: ${hora} Dona Maria`));
  assert.match(await texto('#lista-remedios'), /No mapa: Farmácia Central/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('partilha de itens: fraldas só para quem tem bebê', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('partilha');
  await page.fill('#comum-dias', '7');
  for (const [nome, bebes] of [['Família Souza', 1], ['Família Lima', 0]]) {
    await page.fill('#fam-nome', nome);
    await page.fill('#fam-adultos', '2');
    await page.fill('#fam-bebes', String(bebes));
    await page.click('#form-familia button[type="submit"]');
  }
  await page.fill('#item-nome', 'Fraldas');
  await page.fill('#item-total', '50');
  await page.selectOption('#item-criterio', 'bebe');
  await page.fill('#item-pordia', '6');
  await page.click('#form-item-partilha button[type="submit"]');
  const celulas = await page.$$eval('#itens-partilha tbody tr td.num', (t) => t.map((x) => x.textContent));
  assert.match(celulas[0], /^42/); // Souza: 6 × 7
  assert.match(celulas[1], /^0/); // Lima: sem bebê
  assert.match(celulas[2], /^8/); // sobra
  assert.deepEqual(erros, []);
  await fechar();
});
