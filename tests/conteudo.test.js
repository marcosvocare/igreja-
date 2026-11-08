'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const socorros = require('../js/nucleo/socorros.js');
const saneamento = require('../js/nucleo/saneamento.js');
const energia = require('../js/nucleo/energia.js');
const abrigo = require('../js/nucleo/abrigo.js');
const pessoas = require('../js/nucleo/pessoas.js');
const cozinha = require('../js/nucleo/cozinha.js');
const cuidado = require('../js/nucleo/cuidado.js');

test('socorros: guias completos, ids únicos e busca sem acento', () => {
  const ids = socorros.GUIAS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const g of socorros.GUIAS) {
    assert.ok(g.titulo && g.quando && g.grave, g.id);
    assert.ok(g.passos.length >= 2, g.id);
  }
  assert.ok(socorros.buscar('queimadura').some((g) => g.id === 'queimadura'));
  assert.ok(socorros.buscar('ENGASGO').some((g) => g.id === 'engasgo'));
  assert.ok(socorros.buscar('reanimacao').some((g) => g.id === 'rcp'));
  assert.equal(socorros.buscar('').length, socorros.GUIAS.length);
  // valores de referência da RCP e do soro caseiro
  const rcp = socorros.GUIAS.find((g) => g.id === 'rcp').passos.join(' ');
  assert.match(rcp, /100 a 120/);
  const soro = socorros.GUIAS.find((g) => g.id === 'desidratacao').passos.join(' ');
  assert.match(soro, /1 litro.*6 colheres de chá rasas de açúcar.*meia colher de chá rasa de sal/);
});

test('saneamento: banheiros, lavatórios e sabão pelo número de pessoas', () => {
  const r = saneamento.planoSaneamento(45, { dias: 30 });
  assert.equal(r.banheiros, 3);
  assert.equal(r.pontosLavagem, 3);
  assert.equal(r.barrasSabao, Math.ceil((450 * 45) / 90));
  assert.equal(saneamento.PADROES.distanciaFonteM, 30);
  assert.throws(() => saneamento.planoSaneamento(0), RangeError);
});

test('energia: consumo, painel, bateria e power bank', () => {
  const c = energia.consumoDiario([
    { aparelho: 'celular', quantidade: 4 },
    { aparelho: 'radio_lora', quantidade: 4 },
    { aparelho: 'lampada', quantidade: 3 },
    { watts: 10, quantidade: 2 },
  ]);
  assert.equal(c.whDia, 4 * 18 + 4 * 3 + 3 * 9 + 20);
  const p = energia.dimensionarPainel(c.whDia);
  assert.equal(p.watts, Math.ceil(c.whDia / (4.5 * 0.7)));
  assert.equal(p.comercial, 50);
  assert.deepEqual(energia.dimensionarBateria(100, { dias: 2, tipo: 'litio' }), { whNecessario: 250, ah: 21 });
  assert.equal(energia.dimensionarBateria(100, { dias: 2, tipo: 'chumbo' }).ah, 34);
  assert.equal(energia.diasPowerbank(18, { mah: 10000 }), 1.3);
  assert.throws(() => energia.dimensionarBateria(10, { tipo: 'gel' }), RangeError);
});

test('abrigo: capacidade pelo menor limite, ocupação e rodízio de tarefas', () => {
  const r = abrigo.capacidade({ areaM2: 200, banheiros: 2, aguaLitrosDia: 1000 });
  assert.deepEqual(r.limites, { area: 57, banheiros: 40, agua: 66 });
  assert.equal(r.capacidade, 40);
  assert.equal(r.gargalo, 'banheiros');
  assert.equal(abrigo.capacidade({}).capacidade, null);
  const o = abrigo.ocupacao([
    { nome: 'Ana', familia: 'Souza' },
    { nome: 'Bia', familia: 'Souza', necessidades: 'insulina' },
    { nome: 'Caio', familia: 'Lima', saida: '2026-11-08T10:00:00Z' },
  ]);
  assert.deepEqual([o.presentes, o.familias, o.comNecessidades], [2, 1, 1]);
  const e = abrigo.escalaTarefas(['Souza', 'Lima', 'Reis'], ['Cozinha', 'Limpeza'], 3);
  assert.equal(e.length, 3);
  assert.deepEqual(e[0].tarefas.map((x) => x.familia), ['Souza', 'Lima']);
  assert.deepEqual(e[1].tarefas.map((x) => x.familia), ['Reis', 'Souza']);
  assert.deepEqual(abrigo.escalaTarefas([], ['x'], 2), []);
});

test('pessoas: quem precisa primeiro, contagem, busca e recados', () => {
  const lista = [
    { nome: 'Ana', situacao: 'segura', atualizadoEm: '2026-11-08T10:00:00Z' },
    { nome: 'João', situacao: 'desaparecida', onde: 'Vila Nova', atualizadoEm: '2026-11-07T10:00:00Z' },
    { nome: 'Lúcia', situacao: 'ferida', atualizadoEm: '2026-11-08T09:00:00Z' },
  ];
  assert.deepEqual(pessoas.ordenar(lista).map((p) => p.nome), ['João', 'Lúcia', 'Ana']);
  assert.equal(pessoas.resumo(lista).porSituacao.desaparecida, 1);
  assert.deepEqual(pessoas.buscar(lista, 'lucia').map((p) => p.nome), ['Lúcia']);
  assert.deepEqual(pessoas.buscar(lista, 'vila nova').map((p) => p.nome), ['João']);
  const recados = [
    { para: 'Família Souza', texto: 'Estamos na igreja', criadoEm: '2026-11-08T08:00:00Z' },
    { para: 'Todos', texto: 'Água às 14h', criadoEm: '2026-11-08T09:00:00Z' },
    { para: 'João', texto: 'Ligue para a mãe', criadoEm: '2026-11-08T07:00:00Z' },
  ];
  assert.deepEqual(pessoas.recadosPara(recados, 'souza').map((r) => r.texto), ['Água às 14h', 'Estamos na igreja']);
});

test('cozinha: duração do gás e janela de colheita', () => {
  assert.deepEqual(cozinha.duracaoGas(13, { horasPorDia: 1 }), { kgPorDia: 0.2, dias: 65 });
  assert.ok(cozinha.duracaoGas(13, { horasPorDia: 1, panelaPressao: true }).dias > 65);
  assert.throws(() => cozinha.duracaoGas(0), RangeError);
  assert.deepEqual(cozinha.colheita('Rabanete', '2026-11-08'), { de: '2026-12-03', ate: '2026-12-13' });
  assert.throws(() => cozinha.colheita('Trigo', '2026-11-08'), RangeError);
});

test('cuidado: sinais de alerta pedem companhia e ajuda imediata', () => {
  assert.equal(cuidado.conferir({}).nivel, 'bem');
  assert.equal(cuidado.conferir({ dormir: true, comer: true }).nivel, 'atencao');
  const u = cuidado.conferir({ morte: true });
  assert.equal(u.nivel, 'urgente');
  assert.match(u.orientacao, /Não deixe a pessoa sozinha/);
  assert.ok(cuidado.GUIAS.every((g) => g.passos.length >= 3));
});
