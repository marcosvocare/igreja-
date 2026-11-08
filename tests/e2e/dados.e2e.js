'use strict';

/**
 * Testes de navegador dos recursos de dados: senha com criptografia,
 * cópia protegida, pacotes entre aparelhos, caderno, primeiro uso e migração.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const { abrirApp, fecharNavegador, recarregar } = require('./ajuda');

const CHAVE = 'sobrevivencia-urbana:v1';
test.after(fecharNavegador);

async function addContato(page, ir, nome) {
  await ir('comunicacao');
  await page.fill('#form-contato input[name="nome"]', nome);
  await page.click('#form-contato button[type="submit"]');
}

test('senha: dados cifrados no aparelho, tela de bloqueio, senha errada não abre', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await addContato(page, ir, 'Ana Segredo');
  await ir('dados');
  await page.fill('#senha-nova', 'salmo23paz');
  await page.fill('#senha-confirma', 'salmo23paz');
  await page.click('#definir-senha');
  await page.waitForFunction(() => document.getElementById('msg-senha').textContent.includes('ativada'));
  const bruto = await page.evaluate((c) => localStorage.getItem(c), CHAVE);
  assert.ok(!bruto.includes('Ana Segredo'), 'nome aparece sem cifrar');
  assert.equal(JSON.parse(bruto).cofre, 1);

  await recarregar(page);
  await page.waitForSelector('#bloqueio:not([hidden])');
  assert.equal(await page.isVisible('header.topo'), false);
  await page.fill('#senha-bloqueio', 'errada');
  await page.click('#form-bloqueio button[type="submit"]');
  await page.waitForFunction(() => document.getElementById('msg-bloqueio').textContent.includes('incorreta'));
  await page.fill('#senha-bloqueio', 'salmo23paz');
  await page.click('#form-bloqueio button[type="submit"]');
  await page.waitForSelector('#bloqueio', { state: 'hidden' });
  await ir('comunicacao');
  assert.match(await page.textContent('#lista-contatos'), /Ana Segredo/);

  // Desativar volta a gravar sem cifra.
  await ir('dados');
  await page.click('#remover-senha');
  await page.click('#remover-senha');
  await page.waitForFunction(() => document.getElementById('msg-senha').textContent.includes('desativada'));
  await page.waitForFunction((c) => (localStorage.getItem(c) || '').includes('Ana Segredo'), CHAVE);
  assert.deepEqual(erros, []);
  await fechar();
});

test('cópia protegida pela senha só restaura com a senha', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await addContato(page, ir, 'Bia');
  await ir('dados');
  await page.fill('#senha-nova', 'abcd1234');
  await page.fill('#senha-confirma', 'abcd1234');
  await page.click('#definir-senha');
  await page.waitForFunction(() => document.getElementById('msg-senha').textContent.includes('ativada'));
  const baixando = page.waitForEvent('download');
  await page.click('#exportar');
  const arquivo = await baixando;
  const copia = require('node:fs').readFileSync(await arquivo.path(), 'utf8');
  assert.equal(JSON.parse(copia).cofre, 1);
  assert.ok(!copia.includes('Bia'));
  await page.click('#apagar');
  await page.click('#apagar');
  await page.waitForFunction(() => document.getElementById('mensagem-apagar').textContent.includes('apagados'));
  await page.evaluate(() => (document.getElementById('restaurar-texto').open = true));
  await page.fill('#texto-backup', copia);
  await page.click('#restaurar-texto-botao');
  await page.waitForFunction(() => document.getElementById('mensagem-dados').textContent.includes('tem senha'));
  await page.fill('#senha-copia', 'abcd1234');
  await page.click('#restaurar-texto-botao');
  await page.waitForFunction(() => document.getElementById('mensagem-dados').textContent.includes('restaurada'));
  await ir('comunicacao');
  assert.match(await page.textContent('#lista-contatos'), /Bia/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('pacote com senha leva mapa e equipes de um aparelho para outro sem apagar nada', async () => {
  const a = await abrirApp();
  await a.ir('mapa');
  await a.page.fill('#base-coord', '-23.55, -46.63');
  await a.page.selectOption('#ponto-categoria', 'agua');
  await a.page.fill('#ponto-nome', 'Poço do Seu Zé');
  await a.page.fill('#ponto-coord', '-23.5455, -46.63');
  await a.page.click('#form-ponto button[type="submit"]');
  await a.ir('rede-equipes');
  await a.page.fill('#equipe-saude', 'Irmã Lúcia');
  await a.ir('dados');
  await a.page.fill('#senha-pacote', 'igreja');
  const baixando = a.page.waitForEvent('download');
  await a.page.click('#baixar-pacote');
  const pacote = require('node:fs').readFileSync(await (await baixando).path(), 'utf8');
  assert.ok(!pacote.includes('Poço'), 'pacote com senha deveria estar cifrado');

  const b = await abrirApp();
  await b.ir('rede-equipes');
  await b.page.fill('#equipe-incendio', 'Seu Jorge');
  await b.ir('dados');
  await b.page.fill('#texto-pacote', pacote);
  await b.page.fill('#senha-receber', 'igreja');
  await b.page.click('#juntar-pacote');
  await b.page.waitForSelector('#resumo-pacote ul');
  assert.match(await b.texto('#resumo-pacote'), /1 novo/);
  await b.ir('mapa');
  assert.match(await b.page.textContent('#lista-pontos'), /Poço do Seu Zé/);
  await b.ir('rede-equipes');
  assert.equal(await b.page.inputValue('#equipe-saude'), 'Irmã Lúcia');
  assert.equal(await b.page.inputValue('#equipe-incendio'), 'Seu Jorge'); // o que já havia continua
  assert.deepEqual([...a.erros, ...b.erros], []);
  await a.fechar();
  await b.fechar();
});

test('caderno: prévia e arquivo para imprimir com as equipes e o kit', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await ir('rede-equipes');
  await page.fill('#equipe-saude', 'Irmã Lúcia');
  await ir('caderno');
  assert.match(await page.textContent('#caderno-conteudo'), /Irmã Lúcia/);
  assert.match(await page.textContent('#caderno-conteudo'), /Lista do kit de 72 h/);
  await page.uncheck('[data-caderno="protocolos"]');
  assert.doesNotMatch(await page.textContent('#caderno-conteudo'), /Protocolos por cenário/);
  const baixando = page.waitForEvent('download');
  await page.click('#baixar-caderno');
  const html = require('node:fs').readFileSync(await (await baixando).path(), 'utf8');
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /Caderno da família/);
  assert.match(html, /Irmã Lúcia/);
  assert.deepEqual(erros, []);
  await fechar();
});

test('começar: passos feitos e lembrete de cópia somem quando cumpridos', async () => {
  const { page, erros, ir, texto, fechar } = await abrirApp();
  await ir('inicio');
  assert.match(await texto('#passos-inicio'), /2 de 10/);
  await addContato(page, ir, 'Ana');
  await addContato(page, ir, 'Bia');
  await ir('situacao');
  assert.match(await texto('#lembretes'), /ainda não fez cópia/);
  await ir('dados');
  await page.click('#copiar-dados');
  await page.waitForFunction(() => /copiad|selecionado/.test(document.getElementById('mensagem-dados').textContent));
  await ir('situacao');
  assert.doesNotMatch(await texto('#lembretes'), /cópia/);
  await ir('inicio');
  assert.match(await texto('#passos-inicio'), /3 de 10/); // contatos + remédios + cópia
  assert.deepEqual(erros, []);
  await fechar();
});

test('migração: dados da versão 1 com sinal renomeado continuam marcados', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await page.evaluate((c) => localStorage.setItem(c, JSON.stringify({ versao: 1, sinais: ['alerta_defesa_civil'], contatos: [{ id: 'x', nome: 'Ana' }] })), CHAVE);
  await recarregar(page);
  await ir('situacao');
  assert.equal(await page.isChecked('input[value="alerta_comunidade"]'), true);
  assert.equal(await page.$('.aviso-topo'), null);
  assert.deepEqual(erros, []);
  await fechar();
});

test('frase da senha do dia não fica gravada, a menos que se peça', async () => {
  const { page, erros, ir, fechar } = await abrirApp();
  await ir('defesa');
  await page.fill('#frase-secreta', 'O Senhor é meu pastor');
  await recarregar(page);
  await ir('defesa');
  assert.equal(await page.inputValue('#frase-secreta'), '');
  await page.fill('#frase-secreta', 'O Senhor é meu pastor');
  await page.check('#lembrar-frase');
  await recarregar(page);
  await ir('defesa');
  assert.equal(await page.inputValue('#frase-secreta'), 'O Senhor é meu pastor');
  assert.deepEqual(erros, []);
  await fechar();
});
