'use strict';

/**
 * Testes de navegador das abas de conteúdo: primeiros socorros, higiene,
 * cozinha, energia, abrigo, pessoas e recados, cuidado.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirApp, fecharNavegador } = require('./ajuda');

test.after(fecharNavegador);

test('apagão cibernético: triagem avisa, abre o protocolo e ele vai para o caderno', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await page.check('input[value="sem_sistemas"]');
  const resultado = await texto('#resultado-situacao');
  assert.match(resultado, /modo avião/);
  assert.match(resultado, /Coordenação da comunidade/);
  await page.click('#resultado-situacao a:has-text("Apagão cibernético")');
  await page.waitForFunction(() => document.getElementById('cen-ciber') && document.getElementById('cen-ciber').open);
  const protocolo = await texto('#cen-ciber');
  assert.match(protocolo, /dinheiro em espécie/);
  assert.match(protocolo, /Cuidado com golpes/);
  await ir('caderno');
  const caderno = await texto('#caderno-conteudo');
  assert.match(caderno, /Apagão cibernético/);
  assert.match(caderno, /modo avião/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('primeiros socorros: busca abre o guia certo com o que não fazer', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('socorros');
  assert.ok((await page.$$('#lista-socorros details')).length >= 10);
  await page.fill('#busca-socorro', 'queimadura');
  assert.equal(await page.$eval('#lista-socorros details', (d) => d.open), true);
  assert.match(await texto('#lista-socorros'), /Não faça:.*pasta de dente/);
  assert.match(await texto('#kit-socorros'), /Torniquete/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('higiene, cozinha e energia: cálculos aparecem e reagem', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('saneamento');
  await page.fill('#san-pessoas', '45');
  assert.match(await texto('#resultado-saneamento'), /3\s*banheiros/);
  await ir('cozinha');
  await page.fill('#gas-kg', '13');
  await page.fill('#gas-horas', '1');
  assert.match(await texto('#resultado-gas'), /65\s*dias/);
  await page.check('#gas-pressao');
  assert.doesNotMatch(await texto('#resultado-gas'), /65\s*dias/);
  assert.equal(await page.$$eval('#tabela-horta tbody tr', (t) => t.length), 10);
  await ir('energia');
  assert.match(await texto('#resultado-energia'), /Wh\s*consumo por dia/);
  await page.fill('#en-extra-w', '300');
  await page.fill('#en-extra-h', '8');
  assert.match(await texto('#resultado-energia'), /W\s*painel solar/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('abrigo: capacidade pelo limite, chegadas e escala de tarefas', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('abrigo');
  await page.fill('#ab-area', '200');
  await page.fill('#ab-banheiros', '2');
  await page.fill('#ab-agua', '1000');
  assert.match(await texto('#resultado-capacidade'), /40\s*pessoas no máximo \(limite: banheiros\)/);
  for (const [nome, familia] of [['Ana', 'Souza'], ['Bia', 'Souza'], ['Caio', 'Lima']]) {
    await page.fill('#ab-nome', nome);
    await page.fill('#ab-familia', familia);
    await page.click('#form-abrigado button[type="submit"]');
  }
  assert.match(await texto('#resultado-capacidade'), /3\s*no abrigo agora, 2 família/);
  assert.equal(await page.$$eval('#escala-tarefas tbody tr', (t) => t.length), 7);
  await page.click('#lista-abrigados button[data-acao="saiu"]');
  assert.match(await texto('#resultado-capacidade'), /2\s*no abrigo agora/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('pessoas e recados: desaparecidos primeiro, busca e recados por nome', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('pessoas');
  const add = async (nome, situacao) => {
    await page.fill('#pessoa-nome', nome);
    await page.selectOption('#pessoa-situacao', situacao);
    await page.click('#form-pessoa button[type="submit"]');
  };
  await add('Ana', 'segura');
  await add('João', 'desaparecida');
  const nomes = await page.$$eval('#lista-pessoas tbody tr td:first-child strong', (s) => s.map((x) => x.textContent));
  assert.deepEqual(nomes, ['João', 'Ana']);
  await page.fill('#busca-pessoa', 'joao');
  assert.equal(await page.$$eval('#lista-pessoas tbody tr', (t) => t.length), 1);
  await page.fill('#recado-para', 'João');
  await page.fill('#recado-texto', 'Sua mãe está na igreja');
  await page.click('#form-recado button[type="submit"]');
  await page.fill('#filtro-recado', 'joao');
  assert.match(await texto('#lista-recados'), /Sua mãe está na igreja/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cuidado: sinal de perigo pede ajuda agora e nada fica gravado', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('cuidado');
  assert.match(await texto('#resultado-cuidado'), /Siga perto/);
  await page.check('[data-pergunta="morte"]');
  assert.match(await texto('#resultado-cuidado'), /Não deixe a pessoa sozinha/);
  const bruto = await page.evaluate(() => localStorage.getItem('sobrevivencia-urbana:v1') || '');
  assert.ok(!bruto.includes('morte'));
  assert.deepEqual(erros, []);
  await fechar();
});
