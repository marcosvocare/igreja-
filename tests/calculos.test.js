'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const radio = require('../js/nucleo/radio.js');
const mapa = require('../js/nucleo/mapa.js');
const remedios = require('../js/nucleo/remedios.js');
const partilha = require('../js/nucleo/partilha.js');
const sup = require('../js/nucleo/suprimentos.js');
const situacao = require('../js/nucleo/situacao.js');

const BASE = { lat: -23.55, lon: -46.63 };
const norte = (m) => ({ lat: BASE.lat + m / 111195, lon: BASE.lon });

test('rádio: teste de alcance real vale mais que a estimativa', () => {
  const nos = [
    { id: 'igreja', nome: 'Igreja', instalacao: 'alto', ...BASE },
    { id: 'ana', nome: 'Ana', instalacao: 'portatil', ...norte(2000) },
    { id: 'bia', nome: 'Bia', instalacao: 'portatil', ...norte(4000) },
  ];
  const estimado = radio.analisarMalha(nos);
  assert.deepEqual(estimado.isolados, ['bia']);
  // Testaram: Bia alcança a igreja (morro ajuda); Ana não alcança (prédio no caminho).
  const real = radio.analisarMalha(nos, {
    testes: [
      { a: 'bia', b: 'igreja', resultado: 'ok' },
      { a: 'igreja', b: 'ana', resultado: 'falhou' },
    ],
  });
  assert.equal(real.saltos.bia, 1);
  assert.equal(real.enlaces.find((e) => e.b === 'bia' || e.a === 'bia').testado, true);
  assert.deepEqual(real.isolados, ['ana']);
});

test('mapa: ponto por distância e direção a partir da base, e passos', () => {
  const p = mapa.pontoPorRumo(BASE, 500, 'norte');
  assert.ok(Math.abs(mapa.distanciaMetros(BASE, p) - 500) < 0.5);
  assert.equal(mapa.direcao(mapa.rumoGraus(BASE, p)), 'norte');
  const ne = mapa.pontoPorRumo(BASE, 300, 'nordeste');
  assert.equal(mapa.direcao(mapa.rumoGraus(BASE, ne)), 'nordeste');
  assert.equal(mapa.metrosDePassos(400), 300);
  assert.throws(() => mapa.pontoPorRumo({ lat: null }, 100, 'norte'), RangeError);
  assert.throws(() => mapa.pontoPorRumo(BASE, 100, 'para cima'), RangeError);
});

test('remédios: próximas doses e onde buscar no mapa', () => {
  const agora = new Date(2026, 10, 8, 19, 30);
  const doses = remedios.proximasDoses(
    [
      { pessoa: 'Dona Maria', nome: 'Losartana', horarios: '08:00, 20:00' },
      { pessoa: 'Seu João', nome: 'Insulina', horarios: '7h, 19h' },
    ],
    agora,
  );
  assert.deepEqual(doses.map((d) => [d.nome, d.minutosAte]), [['Losartana', 30], ['Insulina', 690], ['Losartana', 750], ['Insulina', 1410]]);
  assert.deepEqual(remedios.lerHorarios('8h, 20:30, 25:00'), [480, 1230]);
  const pontos = [
    { categoria: 'remedio', nome: 'Farmácia Central', obs: 'tem losartana e dipirona', status: 'escasso' },
    { categoria: 'remedio', nome: 'Posto', obs: 'Losartana', status: 'esgotado' },
    { categoria: 'agua', nome: 'Poço losartana', status: 'disponivel' },
  ];
  assert.deepEqual(remedios.ondeBuscar('Losartana 50 mg', pontos).map((p) => p.nome), ['Farmácia Central']);
});

test('partilha de itens: fraldas por bebê, latas por pessoa, sabonete por família', () => {
  const familias = [
    { nome: 'Souza', casa: { adultos: 2, bebes: 1 } },
    { nome: 'Lima', casa: { adultos: 1, criancas: 2 } },
    { nome: 'Rosa', casa: { idosos: 1 }, vulneravel: true },
  ];
  const fraldas = partilha.distribuirItem({ total: 50, criterio: 'bebe', porDia: 6 }, familias, { dias: 7 });
  assert.deepEqual(fraldas.porFamilia.map((f) => f.alocado), [42, 0, 0]);
  assert.equal(fraldas.resto, 8);
  const latas = partilha.distribuirItem({ total: 10, criterio: 'pessoa', porDia: 1 }, familias, { dias: 2 });
  assert.ok(latas.distribuido <= 10);
  assert.ok(latas.porFamilia[2].percentual >= latas.porFamilia[0].percentual); // idosa vulnerável
  const sabonete = partilha.distribuirItem({ total: 3, criterio: 'familia', porDia: 1 / 7 }, familias, { dias: 7 });
  assert.deepEqual(sabonete.porFamilia.map((f) => f.alocado), [1, 1, 1]);
  assert.throws(() => partilha.distribuirItem({ total: 1, criterio: 'cachorro', porDia: 1 }, familias), RangeError);
});

test('suprimentos: dietas trocam alimentos e porte muda água e ração dos cães', () => {
  const casa = { adultos: 2, caes: 1 };
  const normal = sup.calcularSuprimentos(casa, { dias: 7 });
  const dieta = sup.calcularSuprimentos(casa, { dias: 7, dietas: { semLactose: true, semGluten: true, diabetes: true, semAmendoim: true } });
  const itens = dieta.alimentos.map((a) => a.item);
  for (const fora of ['Leite em pó', 'Macarrão', 'Aveia em flocos', 'Açúcar, rapadura ou mel', 'Frutas secas, doce em lata, pasta de amendoim']) {
    assert.ok(!itens.includes(fora), fora);
  }
  assert.ok(itens.includes('Biscoitos sem glúten e tapioca (sem amendoim nem castanhas)'));
  const soma = sup.alimentosParaDieta({ semLactose: true }).reduce((s, a) => s + a.fatia, 0);
  assert.ok(Math.abs(soma - 1) < 1e-9);
  assert.equal(dieta.avisosDieta.length, 4);
  assert.ok(dieta.especiais.some((e) => e.item.includes('hipoglicemia')));
  // cobre as mesmas calorias
  const kcal = (r) => r.alimentos.reduce((s, a) => s + a.kg * (sup.ALIMENTOS.concat([{ item: a.item, kcalPorKg: 4500 }]).find((x) => x.item === a.item).kcalPorKg), 0);
  assert.ok(kcal(dieta) >= dieta.kcalTotal);
  const grande = sup.calcularSuprimentos(casa, { dias: 7, porteCaes: 'grande' });
  assert.equal(grande.agua.pets, 14);
  assert.equal(normal.agua.pets, 7);
  assert.equal(grande.especiais.find((e) => e.item === 'Ração para cães').quantidade, 3.5);
});

test('triagem: postura de reunir só com saques, e evacuar continua tendo prioridade', () => {
  assert.equal(situacao.avaliarSituacao(['saques', 'fogo']).postura, 'EVACUAR');
  assert.equal(situacao.avaliarSituacao(['sem_agua'], { diasAutonomia: 10 }).postura, 'RACIONAR');
});
