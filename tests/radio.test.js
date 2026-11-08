'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const radio = require('../js/nucleo/radio.js');
const rotulos = require('../js/nucleo/rotulos.js');

const BASE = { lat: -23.55, lon: -46.63 };
const M_POR_GRAU = 111195;
const norte = (m) => ({ lat: BASE.lat + m / M_POR_GRAU, lon: BASE.lon });
const sul = (m) => ({ lat: BASE.lat - m / M_POR_GRAU, lon: BASE.lon });

// ---------------------------------------------------------------- alcance

test('rádio: alcance por instalação e bairro', () => {
  assert.equal(radio.alcanceNo({ instalacao: 'portatil' }, 'urbano'), 1500);
  assert.equal(radio.alcanceNo({ instalacao: 'alto' }, 'urbano'), 4500);
  assert.equal(radio.alcanceNo({ instalacao: 'fixo' }, 'aberto'), 9000);
  assert.ok(Math.abs(radio.alcanceEnlace({ instalacao: 'portatil' }, { instalacao: 'alto' }, 'urbano') - 2598.08) < 0.01);
  assert.throws(() => radio.alcanceNo({ instalacao: 'portatil' }, 'lua'), RangeError);
});

// ------------------------------------------------------------- malha

test('rádio: repetidor no alto alcança quem está perto e aponta quem fica isolado', () => {
  const nos = [
    { id: 'igreja', nome: 'Igreja', instalacao: 'alto', ...BASE },
    { id: 'ana', nome: 'Ana', instalacao: 'portatil', ...norte(2000) },
    { id: 'bia', nome: 'Bia', instalacao: 'portatil', ...norte(4000) },
    { id: 'caio', nome: 'Caio', instalacao: 'portatil', ...sul(2200) },
    { id: 'davi', nome: 'Davi', instalacao: 'portatil' },
  ];
  const r = radio.analisarMalha(nos, { ambiente: 'urbano' });
  assert.equal(r.base, 'igreja');
  assert.deepEqual(r.conectados.sort(), ['ana', 'caio', 'igreja']);
  assert.deepEqual(r.isolados, ['bia']);
  assert.deepEqual(r.semLocalizacao, ['davi']);
  assert.equal(r.saltos.ana, 1);
  assert.equal(r.saltos.bia, null);
  const caio = r.enlaces.find((e) => e.b === 'caio');
  assert.equal(caio.fraco, true); // 2,2 km de 2,6 km possíveis
  assert.equal(r.enlaces.find((e) => e.b === 'ana').fraco, false);

  assert.equal(r.sugestoes.length, 1);
  const s = r.sugestoes[0];
  assert.deepEqual([s.de, s.ate], ['bia', 'ana']);
  assert.ok(Math.abs(s.distancia - 2000) < 1);
  assert.equal(s.resolve, true);
  assert.ok(Math.abs(s.meio.lat - norte(3000).lat) < 1e-9);
});

test('rádio: conta saltos e recomenda aumentar o limite quando preciso', () => {
  const nos = [0, 1100, 2200, 3300, 4400].map((m, i) => ({ id: `n${i}`, nome: `N${i}`, instalacao: 'portatil', ...norte(m) }));
  const r = radio.analisarMalha(nos, { ambiente: 'urbano', baseId: 'n0', limiteSaltos: 3 });
  assert.deepEqual([1, 2, 3, 4].map((i) => r.saltos[`n${i}`]), [1, 2, 3, 4]);
  assert.deepEqual(r.alemDoLimite, ['n4']);
  assert.deepEqual(r.conectados, ['n0', 'n1', 'n2', 'n3']);
  assert.equal(r.limiteRecomendado, 4);
  assert.equal(r.componentes.length, 1);
  // Em campo aberto todos se alcançam diretamente.
  const aberto = radio.analisarMalha(nos, { ambiente: 'aberto', baseId: 'n0' });
  assert.equal(aberto.saltos.n4, 1);
  assert.equal(aberto.limiteRecomendado, 3);
  assert.throws(() => radio.analisarMalha(nos, { limiteSaltos: 8 }), RangeError);
});

test('rádio: sem rádios a análise vem vazia', () => {
  const r = radio.analisarMalha([]);
  assert.equal(r.base, null);
  assert.deepEqual(r.sugestoes, []);
  assert.equal(r.limiteRecomendado, 3);
});

// ------------------------------------------------------------- plano

test('rádio: nomes curtos únicos de até 4 letras', () => {
  const usados = new Set();
  const nomes = ['Marcos', 'Maria', 'Marcos Filho', 'Ana', 'José', 'Marcos'].map((n) => {
    const c = radio.nomeCurto(n, usados);
    usados.add(c);
    return c;
  });
  assert.deepEqual(nomes, ['MARC', 'MARI', 'MARF', 'ANA', 'JOSE', 'MAR2']);
  assert.equal(radio.nomeCanal('Família Souza'), 'FamiliaSouz');
  assert.equal(radio.nomeCanal('***'), 'Familia');
});

test('rádio: plano com papéis, canais e limite de saltos', () => {
  const nos = [
    { id: 'i', nome: 'Igreja', instalacao: 'alto', ...BASE },
    { id: 'a', nome: 'Ana', instalacao: 'portatil', ...norte(1000) },
  ];
  const analise = radio.analisarMalha(nos);
  const p = radio.planoRede(nos, { canalFamilia: 'Família', analise });
  assert.deepEqual(p.aparelhos.map((x) => [x.nomeCurto, x.papel]), [['IGRE', 'ROUTER'], ['ANA', 'CLIENT']]);
  assert.deepEqual(p.canais.map((c) => c.indice), [0, 1, 2]);
  assert.equal(p.canais[1].nome, 'Familia');
  assert.equal(p.limiteSaltos, 3);
  assert.equal(radio.planoRede(nos, { canalComunidade: null }).canais.length, 2);
});

// ---------------------------------------------------------- mensagens

test('rádio: mensagens sem acento e dentro do limite de bytes', () => {
  const r = radio.prepararMensagemLora('Estou bem,   irmã');
  assert.equal(r.texto, 'Estou bem, irma');
  assert.equal(r.bytes, 15);
  assert.equal(r.cabe, true);
  assert.equal(radio.prepararMensagemLora('irmã', { removerAcentos: false }).bytes, 5);
  const longa = radio.prepararMensagemLora('a'.repeat(201));
  assert.equal(longa.cabe, false);
  assert.equal(longa.excesso, 1);
  assert.equal(radio.bytesUtf8('👍'), 4);
  assert.equal(new Set(radio.CODIGOS.map((c) => c.codigo)).size, radio.CODIGOS.length);
});

// ------------------------------------------------------------- rótulos

test('rótulos: nomes de pontos próximos não se cobrem', () => {
  const marcas = [
    { x: 100, y: 100, texto: 'Torneira da escola' },
    { x: 125, y: 100, texto: 'Saque na avenida' },
    { x: 112, y: 120, texto: 'Horta' },
  ];
  const r = rotulos.posicionarRotulos(marcas, { largura: 340, altura: 340 });
  for (let i = 0; i < r.length; i++) {
    for (let j = i + 1; j < r.length; j++) assert.ok(!rotulos.sobrepoe(r[i].caixa, r[j].caixa), `rótulos ${i} e ${j}`);
    marcas.forEach((m, j) => {
      if (j !== i) assert.ok(!rotulos.sobrepoe(r[i].caixa, [m.x - 7, m.y - 7, m.x + 7, m.y + 7]), `rótulo ${i} cobre marcador ${j}`);
    });
  }
});

test('rótulos: perto da borda direita o nome vai para a esquerda', () => {
  const [r] = rotulos.posicionarRotulos([{ x: 330, y: 100, texto: 'Escola Estadual' }], { largura: 340, altura: 340 });
  assert.equal(r.ancora, 'end');
  assert.ok(r.caixa[0] >= 0 && r.caixa[2] <= 340);
  const livre = rotulos.primeiroLivre([{ caixa: [0, 0, 10, 10] }, { caixa: [20, 20, 30, 30] }], [[5, 5, 8, 8]]);
  assert.deepEqual(livre.caixa, [20, 20, 30, 30]);
});
