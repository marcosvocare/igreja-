'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const versoes = require('../js/nucleo/versoes.js');
const configuracao = require('../js/nucleo/configuracao.js');
const cofre = require('../js/nucleo/cofre.js');
const sinc = require('../js/nucleo/sincronizacao.js');
const situacao = require('../js/nucleo/situacao.js');

const SINAIS = situacao.SINAIS.map((s) => s.id);

// ------------------------------------------------------------------ versões

test('versões: sinais renomeados são levados para o nome novo', () => {
  const { dados, avisos, versaoOriginal } = versoes.migrar({ versao: 1, sinais: ['alerta_defesa_civil', 'sem_servicos', 'fogo'] }, SINAIS);
  assert.equal(versaoOriginal, 1);
  assert.equal(dados.versao, versoes.VERSAO_ATUAL);
  assert.deepEqual(dados.sinais, ['alerta_comunidade', 'saques', 'fogo']);
  assert.deepEqual(avisos, []);
});

test('versões: sinal desconhecido é desmarcado com aviso; versão futura é recusada', () => {
  const r = versoes.migrar({ versao: 2, sinais: ['fogo', 'zumbis'] }, SINAIS);
  assert.deepEqual(r.dados.sinais, ['fogo']);
  assert.equal(r.avisos.length, 1);
  assert.throws(() => versoes.migrar({ versao: 99 }), RangeError);
  assert.throws(() => versoes.migrar(null), TypeError);
  // não altera o objeto original
  const original = { versao: 1, sinais: ['sem_servicos'] };
  versoes.migrar(original, SINAIS);
  assert.deepEqual(original.sinais, ['sem_servicos']);
});

// ------------------------------------------------------------ configuração

test('configuração: passos feitos a partir dos dados, na ordem', () => {
  const vazio = configuracao.passos({});
  assert.equal(vazio.feitos, 2); // remédios (ninguém usa) e cópia (sem dados) contam como feitos
  assert.equal(vazio.proximo.id, 'casa');
  const e = {
    casaRevisada: true,
    equipes: { saude: 'Irmã Lúcia' },
    pontos: { casa: 'portão', bairro: 'igreja' },
    contatos: [{ id: 1 }, { id: 2 }],
    mapa: { base: { lat: -23.5, lon: -46.6 }, pontos: [] },
    radio: { nos: [{ lat: -23.5, lon: -46.6 }, { lat: -23.4, lon: -46.6 }] },
    extras: { remediosContinuos: true },
    remedios: [{ nome: 'X' }],
    ultimaCopia: new Date().toISOString(),
  };
  const r = configuracao.passos(e, { progressoKit: 60, temSenha: true });
  assert.equal(r.feitos, r.total);
  assert.equal(r.proximo, null);
  // rádio de exemplo não conta
  const ex = configuracao.passos({ ...e, radio: { nos: e.radio.nos.map((n) => ({ ...n, exemplo: true })) } }, { progressoKit: 60, temSenha: true });
  assert.equal(ex.proximo.id, 'radio');
});

test('configuração: lembrete de cópia depois de 7 dias, só se houver dados', () => {
  const agora = new Date('2026-11-08T12:00:00Z');
  assert.equal(configuracao.precisaCopia({}, agora), false);
  const comDados = { contatos: [{ id: 1 }] };
  assert.equal(configuracao.precisaCopia(comDados, agora), true);
  assert.equal(configuracao.precisaCopia({ ...comDados, ultimaCopia: '2026-11-05T12:00:00Z' }, agora), false);
  assert.equal(configuracao.precisaCopia({ ...comDados, ultimaCopia: '2026-10-30T12:00:00Z' }, agora), true);
  assert.equal(configuracao.diasDesdeCopia({ ultimaCopia: '2026-10-30T12:00:00Z' }, agora), 9);
});

// -------------------------------------------------------------------- cofre

test('cofre: fecha e abre com a senha; senha errada não abre', async () => {
  const pacote = await cofre.fechar('{"contatos":["Ana"]}', 'abc123');
  assert.ok(cofre.eCofre(pacote));
  assert.ok(!pacote.dados.includes('Ana'));
  const { texto, chave } = await cofre.abrir(pacote, 'abc123');
  assert.equal(texto, '{"contatos":["Ana"]}');
  await assert.rejects(() => cofre.abrir(pacote, 'errada1'), (e) => e.codigo === 'senha_incorreta');
  // a mesma chave grava de novo sem pedir a senha (iv novo, mesmo sal)
  const outro = await cofre.cifrar('novo', chave, pacote.sal);
  assert.equal(outro.sal, pacote.sal);
  assert.notEqual(outro.iv, pacote.iv);
  assert.equal(await cofre.decifrar(outro, chave), 'novo');
});

test('cofre: valida senha e mede a força', async () => {
  assert.equal(cofre.senhaValida('123'), false);
  assert.equal(cofre.senhaValida('1234'), true);
  assert.equal(cofre.forcaSenha('1234'), 'fraca');
  assert.equal(cofre.forcaSenha('123456'), 'razoavel');
  assert.equal(cofre.forcaSenha('salmo23paz'), 'boa');
  await assert.rejects(() => cofre.fechar('x', '12'), RangeError);
  assert.equal(cofre.eCofre({ versao: 2 }), false);
});

// -------------------------------------------------------------- sincronização

const LOCAL = {
  mapa: { base: { nome: 'Casa', lat: 1, lon: 1 }, pontos: [{ id: 'p1', nome: 'Poço', status: 'disponivel', verificadoEm: '2026-11-07T10:00:00Z' }] },
  equipes: { saude: 'Irmã Lúcia', incendio: '' },
  rede: [{ id: 'r1', nome: 'Ana' }],
  defesa: { voluntarios: 'Ana\nBia', frase: 'segredo' },
  estoque: [{ id: 'e1', nome: 'Arroz' }],
  remedios: [{ id: 'm1', nome: 'Insulina' }],
};

test('sincronização: pacote leva só as partes escolhidas e nunca dados pessoais', () => {
  const p = sinc.criarPacote(LOCAL, ['mapa', 'equipes', 'voluntarios'], { origem: 'Marcos' });
  assert.ok(sinc.ePacote(p));
  assert.deepEqual(Object.keys(p.partes), ['mapa', 'equipes', 'voluntarios']);
  const texto = JSON.stringify(p);
  for (const proibido of ['segredo', 'Arroz', 'Insulina']) assert.ok(!texto.includes(proibido), proibido);
  assert.throws(() => sinc.criarPacote(LOCAL, []), RangeError);
});

test('sincronização: junta sem apagar; o mais recente vence; conflitos de equipe ficam com o local', () => {
  const recebido = {
    tipo: sinc.TIPO,
    versao: 1,
    partes: {
      mapa: [
        { id: 'p1', nome: 'Poço', status: 'esgotado', verificadoEm: '2026-11-08T09:00:00Z' },
        { id: 'p2', nome: 'Farmácia', status: 'escasso', verificadoEm: '2026-11-08T09:00:00Z' },
      ],
      equipes: { saude: 'Dr. Paulo', incendio: 'Seu Jorge' },
      rede: [{ id: 'r2', nome: 'Caio' }],
      voluntarios: 'bia\nCaio',
    },
  };
  const { estado, resumo } = sinc.mesclarPacote(LOCAL, recebido);
  assert.equal(estado.mapa.pontos.length, 2);
  assert.equal(estado.mapa.pontos.find((x) => x.id === 'p1').status, 'esgotado'); // mais recente
  assert.deepEqual(resumo.mapa, { novos: 1, atualizados: 1, iguais: 0 });
  assert.equal(estado.equipes.saude, 'Irmã Lúcia');
  assert.equal(estado.equipes.incendio, 'Seu Jorge');
  assert.deepEqual(resumo.equipes.conflitos, ['saude']);
  assert.deepEqual(estado.rede.map((x) => x.nome), ['Ana', 'Caio']);
  assert.equal(estado.defesa.voluntarios, 'Ana\nBia\nCaio');
  assert.equal(estado.defesa.frase, 'segredo'); // intocado
  assert.equal(LOCAL.mapa.pontos[0].status, 'disponivel'); // original não muda
  // ponto mais antigo recebido não substitui o local
  const velho = { tipo: sinc.TIPO, versao: 1, partes: { mapa: [{ id: 'p1', status: 'inseguro', verificadoEm: '2026-01-01T00:00:00Z' }] } };
  assert.equal(sinc.mesclarPacote(LOCAL, velho).estado.mapa.pontos[0].status, 'disponivel');
  assert.throws(() => sinc.mesclarPacote(LOCAL, { tipo: 'outro' }), TypeError);
});
