'use strict';

/**
 * Mapa de Hortolândia sem internet e bússola, no navegador.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirApp, fecharNavegador } = require('./ajuda');

test.after(fecharNavegador);

async function abrirCidade(opcoes) {
  const app = await abrirApp(opcoes);
  await app.ir('cidade');
  await app.page.waitForSelector('#carregando-mapa[hidden]', { state: 'attached', timeout: 15000 });
  return app;
}

async function buscarEEscolher(page, texto, contem) {
  await page.fill('#busca-cidade', texto);
  const botao = page.locator('#resultados-cidade button', { hasText: contem }).first();
  await botao.waitFor();
  await botao.click();
}

test('cidade: o mapa carrega do aparelho e desenha ruas', async () => {
  const { page, erros, fechar } = await abrirCidade();
  await page.waitForTimeout(200);
  const desenhado = await page.evaluate(() => {
    const c = document.getElementById('tela-cidade');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let diferentes = 0;
    for (let i = 0; i < d.length; i += 16) if (d[i] !== d[0] || d[i + 1] !== d[1] || d[i + 2] !== d[2]) diferentes++;
    return diferentes / (d.length / 16);
  });
  assert.ok(desenhado > 0.05, `pixels desenhados: ${desenhado}`);
  assert.match(await page.textContent('#fonte-cidade'), /OpenStreetMap/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: busca sem acento acha bairro e rua; o lugar mostra bairro e quadrícula', async () => {
  const { page, erros, texto, fechar } = await abrirCidade();
  await buscarEEscolher(page, 'jd amanda', 'Jardim Amanda');
  const info = await texto('#info-cidade');
  assert.match(info, /Jardim Amanda/);
  assert.match(info, /Quadrícula [A-M]\d+/);
  assert.match(info, /Coordenadas: -22\.\d+, -47\.\d+/);
  await buscarEEscolher(page, 'av olivio', 'Avenida');
  assert.match(await texto('#info-cidade'), /Olívio/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: tocar no mapa escolhe o lugar; quadrícula F6 leva ao centro', async () => {
  const { page, erros, texto, fechar } = await abrirCidade();
  await page.click('summary:has-text("Quadrículas")');
  await page.fill('#quadricula-ir', 'f6');
  await page.click('#form-quadricula button');
  assert.match(await texto('#info-cidade'), /Quadrícula F6/);
  assert.equal(await page.isChecked('[data-camada="quadricula"]'), true);
  await page.fill('#quadricula-ir', 'Z99');
  await page.click('#form-quadricula button');
  assert.match(await texto('#msg-quadricula'), /não existe/);
  // Com os locais ligados, o toque cai num pino; desligados, escolhe o lugar.
  await page.click('summary:has-text("Camadas e legenda")');
  for (const id of ['remedio', 'alimento', 'agua', 'igreja', 'escola', 'material']) await page.uncheck(`[data-camada="${id}"]`);
  await page.evaluate(() => document.getElementById('tela-cidade').scrollIntoView({ block: 'center' }));
  const caixa = await page.locator('#tela-cidade').boundingBox();
  await page.mouse.click(caixa.x + caixa.width / 2 + 30, caixa.y + caixa.height / 2 + 30);
  const info = await texto('#info-cidade');
  assert.match(info, /Lugar escolhido/);
  assert.match(info, /Coordenadas/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: tocar num pino de igreja abre a igreja, com a fonte do dado', async () => {
  const { page, erros, texto, fechar } = await abrirCidade();
  await buscarEEscolher(page, 'assembleia de deus', 'Assembl');
  const nome = (await page.textContent('#info-cidade h3')).trim();
  await page.click('[data-acao-cidade="fechar"]');
  // O lugar buscado fica no centro do mapa; a cabeça do pino fica acima da ponta.
  await page.evaluate(() => document.getElementById('tela-cidade').scrollIntoView({ block: 'center' }));
  const caixa = await page.locator('#tela-cidade').boundingBox();
  await page.mouse.click(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2 - 28);
  const info = await texto('#info-cidade');
  assert.match(info, new RegExp(nome.slice(0, 12)));
  assert.match(info, /Igreja · (Overture Maps|OpenStreetMap)/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: usar como base e traçar rota a pé até um hospital', async () => {
  const { page, erros, texto, ir, fechar } = await abrirCidade();
  await buscarEEscolher(page, 'av olivio', 'Avenida');
  await page.click('[data-acao-cidade="base"]');
  assert.match(await texto('#info-cidade'), /Base \(Casa\) definida/);
  await buscarEEscolher(page, 'hospital', 'Hospital');
  await page.click('[data-acao-cidade="rota"]');
  const rota = await texto('#rota-cidade');
  assert.match(rota, /min a pé/);
  assert.match(rota, /de a base \(Casa\)/);
  assert.ok((await page.$$('#rota-cidade ol li')).length >= 3);
  await page.click('#limpar-rota');
  assert.equal(await texto('#rota-cidade'), '');
  // A base aparece na aba Meus pontos.
  await ir('mapa');
  assert.match(await page.inputValue('#base-coord'), /^-22\.\d+, -47\.\d+$/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: salvar uma farmácia do mapa em Meus pontos e voltar a ela no mapa', async () => {
  const { page, erros, texto, ir, fechar } = await abrirCidade();
  await buscarEEscolher(page, 'farmacia', 'Farmácia');
  const nome = (await page.textContent('#info-cidade h3')).trim();
  await page.click('[data-acao-cidade="salvar"]');
  assert.match(await texto('#info-cidade'), /Salvo em Meus pontos/);
  await ir('mapa');
  assert.match(await texto('#lista-pontos'), new RegExp(nome.slice(0, 10)));
  await page.click('#lista-pontos button[data-acao="cidade"]');
  await page.waitForFunction(() => location.hash === '#cidade');
  await page.waitForFunction((n) => document.querySelector('#info-cidade h3') && document.querySelector('#info-cidade h3').textContent === n, nome);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cidade: "Onde estou" usa o GPS do aparelho e vira a origem da rota', async () => {
  const { page, erros, texto, fechar } = await abrirCidade({
    contexto: { permissions: ['geolocation'], geolocation: { latitude: -22.862, longitude: -47.2164, accuracy: 12 } },
  });
  await page.click('#onde-estou');
  await page.waitForFunction(() => document.getElementById('msg-cidade').textContent.includes('Localização obtida'));
  assert.match(await texto('#info-cidade'), /Você está aqui/);
  await buscarEEscolher(page, 'hospital', 'Hospital');
  await page.click('[data-acao-cidade="rota"]');
  assert.match(await texto('#rota-cidade'), /de sua localização/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('bússola: corrige a declinação, guia até um ponto e marca ponto pelo rumo', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('mapa');
  await page.fill('#base-coord', '-22.8620, -47.2164');
  await ir('bussola');
  await page.click('#ligar-bussola');
  await page.waitForFunction(() => document.getElementById('ligar-bussola').textContent === 'Bússola ligada');
  // Sensor do Android: alpha anti-horário, 90 = topo do celular para o oeste magnético.
  await page.evaluate(() => window.dispatchEvent(new DeviceOrientationEvent('deviceorientationabsolute', { alpha: 90, absolute: true })));
  await page.waitForFunction(() => document.getElementById('rumo-graus').textContent === '248°');
  assert.equal(await texto('#rumo-cardeal'), 'oeste');
  await page.uncheck('#bussola-verdadeiro');
  assert.equal(await texto('#rumo-graus'), '270°');
  await page.check('#bussola-verdadeiro');
  assert.match(await texto('#estado-bussola'), /Bússola ligada/);

  // Marca uma fumaça a 400 m a leste da base.
  await page.selectOption('#bussola-origem', 'base');
  await page.fill('#rumo-graus-ponto', '90');
  await page.fill('#rumo-distancia', '400');
  await page.selectOption('#rumo-categoria', 'perigo');
  await page.fill('#rumo-nome', 'Fumaça');
  await page.click('#form-rumo-ponto button[type="submit"]');
  assert.match(await texto('#msg-rumo-ponto'), /marcado a 400 m no rumo 90°/);

  const valor = await page.$eval('#alvo-bussola', (s) => [...s.options].find((o) => o.textContent.includes('Fumaça')).value);
  await page.selectOption('#alvo-bussola', valor);
  const guia = await texto('#guia-bussola');
  assert.match(guia, /Vire 158° à esquerda/);
  assert.match(guia, /400 m a leste/);
  assert.equal(await page.getAttribute('#seta-alvo', 'display'), null);

  await ir('mapa');
  assert.match(await texto('#lista-pontos'), /Fumaça/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('bússola: sem sensor, mostra o sol de agora e os métodos sem bússola', async () => {
  const { page, erros, texto, ir, fechar } = await abrirApp();
  await ir('bussola');
  assert.ok((await texto('#sol-agora')).length > 20);
  assert.ok((await page.$$('#lista-sem-bussola details')).length >= 5);
  assert.match(await texto('#lista-sem-bussola'), /Cruzeiro do Sul/);
  assert.deepEqual(erros, []);
  await fechar();
});
