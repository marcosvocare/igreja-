'use strict';

/**
 * Testes de navegador do app (Playwright + node:test).
 * Rodar: npm run test:e2e
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirApp, fecharNavegador, rolagemLateral } = require('./ajuda');

const NORTE = (m) => `${(-23.55 + m / 111195).toFixed(5)}, -46.63000`;
const LESTE_300M = 300 / (111195 * Math.cos((23.55 * Math.PI) / 180));

test.after(fecharNavegador);

test('triagem: sinais definem a postura e a equipe da comunidade a acionar', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('situacao');
  await page.check('input[value="chuva_forte"]');
  assert.equal(await texto('.painel-nivel .postura'), 'Monitorar e preparar');
  assert.equal(await texto('#selo-nivel'), 'Atenção');
  await page.check('input[value="agua_subindo"]');
  assert.equal(await texto('.painel-nivel .postura'), 'Evacuar agora');
  const acionar = await texto('.acionar-lista');
  assert.match(acionar, /Equipe de resgate/);
  assert.match(acionar, /Coordenação da comunidade/);
  // Protocolo relacionado abre o cenário certo.
  await page.click('#resultado-situacao a[href="#cenarios-enchente"]');
  await page.waitForFunction(() => document.getElementById('cen-enchente').open);
  assert.deepEqual(erros, []);
  await fechar();
});

test('triagem: contato da equipe aparece no resultado e no cartão de bolso', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('rede-equipes');
  await page.fill('#equipe-incendio', 'Seu Jorge · rádio JORG');
  await ir('situacao');
  await page.check('input[value="fogo"]');
  assert.match(await texto('.acionar-lista'), /Brigada de incêndio: Seu Jorge · rádio JORG/);
  await ir('comunicacao');
  assert.match(await texto('#previa-cartao'), /Brigada de incêndio: Seu Jorge/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('suprimentos e estoque: necessidade, validade e autonomia', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('suprimentos');
  await page.fill('input[name="criancas"]', '1');
  assert.match(await texto('#resultado-suprimentos .metricas'), /kcal no total/);
  await ir('estoque');
  await page.selectOption('#preset-estoque', { label: 'Galão de água 20 L' });
  await page.fill('#form-estoque input[name="quantidade"]', '3');
  await page.fill('#form-estoque input[name="validade"]', '2099-06-01');
  await page.click('#form-estoque button[type="submit"]');
  await page.fill('#form-estoque input[name="nome"]', 'Biscoito vencido');
  await page.fill('#form-estoque input[name="kcal"]', '1800');
  await page.fill('#form-estoque input[name="validade"]', '2020-01-10');
  await page.click('#form-estoque button[type="submit"]');
  const linhas = await page.$$eval('#lista-estoque tbody tr', (t) => t.map((r) => r.textContent));
  assert.match(linhas[0], /Biscoito vencido.*Vencido/); // vencidos primeiro
  assert.match(await texto('#autonomia'), /dias de água \(60 L\)/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('comunicação: árvore de chamadas e SMS sem acento', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('comunicacao');
  for (const n of ['Pastor Paulo', 'Ana', 'Bia', 'Caio', 'Davi']) {
    await page.fill('#form-contato input[name="nome"]', n);
    await page.click('#form-contato button[type="submit"]');
  }
  assert.match(await texto('#arvore'), /2 rodada/);
  await page.fill('#form-sms input[name="nome"]', 'Márcia');
  await page.fill('#form-sms input[name="local"]', 'casa da avó');
  assert.match(await texto('#previa-sms'), /OK Marcia: estou bem em casa da avo/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('mapa: melhor fonte de água, perigo na rota e mudança de situação', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('mapa');
  await page.fill('#base-nome', 'Igreja');
  await page.fill('#base-coord', '-23.55, -46.63');
  const add = async (cat, tipo, nome, coord, status, raio) => {
    await page.selectOption('#ponto-categoria', cat);
    await page.selectOption('#ponto-tipo', tipo);
    await page.fill('#ponto-nome', nome);
    await page.fill('#ponto-coord', coord);
    await page.selectOption('#ponto-status', status);
    if (raio) await page.fill('#ponto-raio', String(raio));
    await page.click('#form-ponto button[type="submit"]');
  };
  await add('agua', 'poco', 'Poço do Seu Zé', NORTE(500), 'disponivel');
  await add('agua', 'torneira', 'Torneira da escola', `-23.55000, ${(-46.63 + LESTE_300M).toFixed(5)}`, 'disponivel');
  await add('perigo', 'conflito', 'Saque na avenida', `-23.55000, ${(-46.63 + LESTE_300M / 2).toFixed(5)}`, 'inseguro', 100);
  await page.click('#botoes-busca button[data-busca="agua"]');
  assert.equal(await texto('#resultado-busca .nome-recurso'), 'Poço do Seu Zé');
  assert.match(await texto('#resultado-busca .direcao'), /500 m ao norte/);
  await page.selectOption('#lista-pontos select[aria-label="Situação de Poço do Seu Zé"]', 'esgotado');
  assert.equal(await texto('#resultado-busca .nome-recurso'), 'Torneira da escola');
  assert.match(await texto('#resultado-busca .aviso'), /atravessa: Saque na avenida/);
  assert.equal(await page.$$eval('#radar .marca', (m) => m.length), 3);
  assert.deepEqual(erros, []);
  await fechar();
});

test('defesa: escala com descanso e senha do dia', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('defesa');
  await page.fill('#voluntarios', 'Ana\nBia\nCaio\nDavi\nEva\nFábio\nGil\nHugo');
  await page.fill('#escala-inicio', '2026-11-07T18:00');
  assert.equal(await page.$$eval('#resultado-escala tbody tr', (t) => t.length), 8);
  assert.match(await texto('#resultado-escala p.ajuda'), /Ana 6 h/);
  await page.fill('#frase-secreta', 'O Senhor é meu pastor');
  assert.match(await texto("#senhas"), /Senha: \w+.*Contrassenha: \w+/);
  await page.check('[data-seguranca="portas"]');
  assert.match(await texto('#resultado-seguranca'), /Segurança/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('remédios e partilha: urgência e divisão justa', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('remedios');
  const rem = async (pessoa, nome, doses, unid, qtd) => {
    await page.fill('#rem-pessoa', pessoa);
    await page.fill('#rem-nome', nome);
    await page.fill('#rem-doses', String(doses));
    await page.fill('#rem-unidades', String(unid));
    await page.fill('#rem-qtd', String(qtd));
    await page.click('#form-remedio button[type="submit"]');
  };
  await rem('Dona Maria', 'Losartana 50 mg', 2, 1, 20);
  await rem('Seu João', 'Insulina NPH', 3, 10, 150);
  const ordem = await page.$$eval('#lista-remedios tbody tr td:first-child strong', (s) => s.map((x) => x.textContent));
  assert.equal(ordem[0], 'Insulina NPH');
  await ir('partilha');
  await page.fill('#comum-agua', '20');
  await page.fill('#comum-dias', '1');
  for (const [nome, idosos] of [['Família Lima', 0], ['Dona Rosa', 1]]) {
    await page.fill('#fam-nome', nome);
    await page.fill('#fam-adultos', idosos ? '0' : '2');
    await page.fill('#fam-idosos', String(idosos));
    await page.click('#form-familia button[type="submit"]');
  }
  assert.match(await texto('#resultado-partilha'), /Prioridade: idoso/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('rádio: exemplo, repetidor sugerido e mensagens', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('radio');
  await page.click('#radio-exemplo');
  assert.equal(await texto('#radio-cobertura .postura'), 'Todos alcançam a base');
  await page.click('#radio-apagar-exemplo');
  const add = async (nome, inst, coord) => {
    await page.fill('#radio-nome', nome);
    await page.selectOption('#radio-instalacao', inst);
    await page.fill('#radio-coord', coord);
    await page.click('#form-radio button[type="submit"]');
  };
  await add('Igreja', 'alto', NORTE(0));
  await add('Ana', 'portatil', NORTE(2000));
  await add('Bia', 'portatil', NORTE(4000));
  assert.equal(await texto('#radio-cobertura .postura'), '1 de 2 alcançam a base');
  await page.click('button[data-repetidor]');
  assert.equal(await texto('#radio-cobertura .postura'), 'Todos alcançam a base');
  await page.click('button[data-codigo="1"]');
  assert.match(await texto('#radio-previa'), /1 Estou bem\..*cabe/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('dados: salvos ao recarregar, cópia por texto e apagar em dois toques', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await ir('comunicacao');
  await page.fill('#form-contato input[name="nome"]', 'Ana');
  await page.click('#form-contato button[type="submit"]');
  await page.waitForFunction(() => document.querySelectorAll('#lista-contatos li').length === 1);
  await page.reload();
  await page.waitForSelector('#comunicacao.ativa');
  assert.equal(await page.$$eval('#lista-contatos li', (l) => l.length), 1);
  const copia = await page.evaluate(() => localStorage.getItem('sobrevivencia-urbana:v1'));
  await ir('dados');
  await page.click('#apagar');
  assert.match(await page.textContent('#apagar'), /Toque de novo/);
  await page.click('#apagar');
  await ir('comunicacao');
  assert.equal(await page.$$eval('#lista-contatos li', (l) => l.length), 0);
  await ir('dados');
  await page.evaluate(() => (document.getElementById('restaurar-texto').open = true));
  await page.fill('#texto-backup', copia);
  await page.click('#restaurar-texto-botao');
  await ir('comunicacao');
  assert.equal(await page.$$eval('#lista-contatos li', (l) => l.length), 1);
  assert.deepEqual(erros, []);
  await fechar();
});

test('tela: tema escuro padrão, modo computador e sem rolagem lateral em nenhuma aba', async () => {
  const { page, erros, fechar } = await abrirApp({ tela: 'computador' });
  assert.equal(await page.getAttribute('html', 'data-theme'), 'dark');
  assert.equal(await page.evaluate(() => document.documentElement.classList.contains('modo-computador')), true);
  const secoes = await page.$$eval('.secao', (s) => s.map((x) => x.id));
  for (const modo of ['computador', 'celular']) {
    if (modo === 'celular') await page.click('#botao-tela');
    for (const id of secoes) {
      await page.evaluate((h) => (location.hash = h), id);
      await page.waitForFunction((h) => document.getElementById(h).classList.contains('ativa'), id);
      assert.equal(await rolagemLateral(page), false, `rolagem lateral em ${id} (${modo})`);
    }
  }
  await page.click('#botao-tema');
  assert.equal(await page.getAttribute('html', 'data-theme'), 'light');
  assert.deepEqual(erros, []);
  await fechar();
});

test('sem Estado: nenhum número ou órgão do governo no texto visível', async () => {
  const { page, erros, fechar } = await abrirApp();
  const secoes = await page.$$eval('.secao', (s) => s.map((x) => x.id));
  const proibido = /\b(190|192|193|199|40199)\b|defesa civil|samu|corpo de bombeiros|pol[ií]cia militar|autoridades/i;
  for (const id of secoes) {
    await page.evaluate((h) => (location.hash = h), id);
    await page.waitForFunction((h) => document.getElementById(h).classList.contains('ativa'), id);
    const t = await page.evaluate(() => document.body.innerText);
    const achado = t.match(proibido);
    assert.equal(achado, null, `${id}: ${achado && achado[0]}`);
  }
  assert.equal(await page.$$eval('a[href^="tel:19"]', (a) => a.length), 0);
  assert.deepEqual(erros, []);
  await fechar();
});
