'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const suprimentos = require('../js/nucleo/suprimentos.js');
const agua = require('../js/nucleo/agua.js');
const estoque = require('../js/nucleo/estoque.js');
const situacao = require('../js/nucleo/situacao.js');
const comunicacao = require('../js/nucleo/comunicacao.js');
const kit = require('../js/nucleo/kit.js');
const cenarios = require('../js/nucleo/cenarios.js');
const rede = require('../js/nucleo/rede.js');

// ---------------------------------------------------------------- suprimentos

test('suprimentos: família de 2 adultos e 1 criança por 7 dias', () => {
  const r = suprimentos.calcularSuprimentos({ adultos: 2, criancas: 1 }, { dias: 7 });
  assert.equal(r.pessoas, 3);
  assert.equal(r.agua.beber, (3 * 2 + 2) * 7); // 56 L
  assert.equal(r.agua.higiene, (1 * 2 + 1) * 7); // 21 L
  assert.ok(r.agua.preparo > 0, 'arroz, feijão e macarrão precisam de água para cozinhar');
  assert.equal(r.kcalTotal, (2000 * 2 + 1400) * 7);
  assert.equal(r.agua.garrafoes20L, Math.ceil(r.agua.total / 20));
  const kcalLista = r.alimentos.reduce((s, a) => {
    const def = suprimentos.ALIMENTOS.find((x) => x.item === a.item);
    return s + a.kg * def.kcalPorKg;
  }, 0);
  assert.ok(kcalLista >= r.kcalTotal, 'a lista arredondada para cima cobre as calorias');
});

test('suprimentos: clima quente aumenta só a água de beber', () => {
  const normal = suprimentos.calcularSuprimentos({ adultos: 1 }, { dias: 2 });
  const quente = suprimentos.calcularSuprimentos({ adultos: 1 }, { dias: 2, climaQuente: true });
  assert.equal(quente.agua.beber, normal.agua.beber * 1.25);
  assert.equal(quente.agua.higiene, normal.agua.higiene);
});

test('suprimentos: bebês e pets geram itens especiais', () => {
  const r = suprimentos.calcularSuprimentos({ adultos: 1, bebes: 1, caes: 1, gatos: 2 }, { dias: 3 });
  const nomes = r.especiais.map((e) => e.item);
  assert.ok(nomes.includes('Fraldas'));
  assert.equal(r.especiais.find((e) => e.item === 'Fraldas').quantidade, 18);
  assert.ok(nomes.includes('Ração para cães'));
  assert.ok(nomes.includes('Ração para gatos'));
  assert.equal(r.agua.pets, (1 + 2 * 0.25) * 3);
});

test('suprimentos: fatias de alimentos somam 100 % e informa dias de comida pronta', () => {
  const soma = suprimentos.ALIMENTOS.reduce((s, a) => s + a.fatia, 0);
  assert.ok(Math.abs(soma - 1) < 1e-9);
  const r = suprimentos.calcularSuprimentos({ adultos: 1 }, { dias: 10 });
  assert.ok(r.diasComidaPronta > 0 && r.diasComidaPronta < 10);
});

test('suprimentos: valida entradas', () => {
  assert.throws(() => suprimentos.calcularSuprimentos({ adultos: -1 }), RangeError);
  assert.throws(() => suprimentos.calcularSuprimentos({ adultos: 1.5 }), RangeError);
  assert.throws(() => suprimentos.calcularSuprimentos({ adultos: 1 }, { dias: 0 }), RangeError);
  const vazio = suprimentos.calcularSuprimentos({}, { dias: 3 });
  assert.equal(vazio.pessoas, 0);
  assert.equal(vazio.alimentos.length, 0);
});

// ----------------------------------------------------------------------- água

test('água: 2 gotas por litro de água sanitária a 2,5 %', () => {
  const r = agua.dosagemHipoclorito(1);
  assert.equal(r.gotas, 2);
  assert.equal(r.minutosEspera, 30);
  const caixa = agua.dosagemHipoclorito(1000);
  assert.equal(caixa.gotas, 2000);
  assert.equal(caixa.ml, 100);
  assert.equal(caixa.colheresDeCha, 20);
});

test('água: dose ajusta pela concentração e dobra se turva', () => {
  assert.equal(agua.dosagemHipoclorito(10, 5).gotas, 10);
  assert.equal(agua.dosagemHipoclorito(10, 2.5, { turva: true }).gotas, 40);
  assert.ok(agua.dosagemHipoclorito(10, 10).avisos.some((a) => a.includes('concentrado')));
});

test('água: valida entradas e tempo de fervura por altitude', () => {
  assert.throws(() => agua.dosagemHipoclorito(0), RangeError);
  assert.throws(() => agua.dosagemHipoclorito(5, 0.5), RangeError);
  assert.equal(agua.tempoFervura(760), 1);
  assert.equal(agua.tempoFervura(2500), 3);
  assert.equal(agua.METODOS.length, 4);
});

// -------------------------------------------------------------------- estoque

test('estoque: classifica validade em ordem PVPS', () => {
  const itens = [
    { nome: 'Arroz', validade: '2026-12-31' },
    { nome: 'Leite', validade: '2026-11-10' },
    { nome: 'Sardinha', validade: '2026-10-01' },
    { nome: 'Lanterna' },
    { nome: 'Feijão', validade: '2026-11-20' },
  ];
  const r = estoque.classificarValidade(itens, '2026-11-07', 30);
  assert.deepEqual(r.vencidos.map((i) => i.nome), ['Sardinha']);
  assert.deepEqual(r.vencendo.map((i) => i.nome), ['Leite', 'Feijão']);
  assert.deepEqual(r.ok.map((i) => i.nome), ['Arroz']);
  assert.deepEqual(r.semValidade.map((i) => i.nome), ['Lanterna']);
  assert.equal(r.vencendo[0].diasRestantes, 3);
});

test('estoque: datas inválidas são tratadas como sem validade', () => {
  assert.equal(estoque.diaUTC('2026-02-30'), null);
  assert.equal(estoque.diaUTC('ontem'), null);
  assert.equal(estoque.diasAte('2027-01-01', '2026-12-31'), 1);
});

test('estoque: autonomia ignora vencidos e aponta o gargalo', () => {
  const itens = [
    { nome: 'Galão', quantidade: 3, litros: 20, validade: '2027-05-01' },
    { nome: 'Arroz 5 kg', quantidade: 2, kcal: 18000, validade: '2027-03-01' },
    { nome: 'Biscoito vencido', quantidade: 10, kcal: 2000, validade: '2026-01-01' },
  ];
  const r = estoque.calcularAutonomia(itens, { aguaLitros: 12, kcal: 6000 }, '2026-11-07');
  assert.equal(r.litros, 60);
  assert.equal(r.kcal, 36000);
  assert.equal(r.diasAgua, 5);
  assert.equal(r.diasComida, 6);
  assert.equal(r.diasAutonomia, 5);
  assert.equal(r.gargalo, 'agua');
});

test('estoque: racionamento avisa quando a água não dura', () => {
  const aut = { litros: 30, kcal: 20000 };
  const plano = estoque.planoRacionamento(aut, { aguaLitros: 12, kcal: 6000 }, 5);
  assert.equal(plano.aguaLitrosPorDia, 6);
  assert.equal(plano.percentualAgua, 50);
  assert.ok(plano.avisos.some((a) => a.includes('água')));
  assert.throws(() => estoque.planoRacionamento(aut, {}, 0), RangeError);
});

// ------------------------------------------------------------------- situação

test('situação: sem sinais é rotina normal', () => {
  const r = situacao.avaliarSituacao([]);
  assert.equal(r.nivel, 0);
  assert.equal(r.postura, 'NORMAL');
});

test('situação: sinais de atenção levam a monitorar', () => {
  const r = situacao.avaliarSituacao(['chuva_forte', 'alerta_comunidade']);
  assert.equal(r.nivel, 1);
  assert.equal(r.cor, 'amarelo');
  assert.equal(r.postura, 'MONITORAR');
});

test('situação: crise prolongada com estoque ok → racionar; estoque baixo → preparar saída', () => {
  assert.equal(situacao.avaliarSituacao(['sem_agua'], { diasAutonomia: 10 }).postura, 'RACIONAR');
  const r = situacao.avaliarSituacao(['sem_agua'], { diasAutonomia: 2 });
  assert.equal(r.postura, 'PREPARAR_SAIDA');
  assert.ok(r.motivos[0].includes('2 dia'));
});

test('situação: dependente de energia sem luz há mais de 24 h → preparar saída', () => {
  const r = situacao.avaliarSituacao(['energia_longa'], { dependenteEnergia: true, diasAutonomia: 30 });
  assert.equal(r.postura, 'PREPARAR_SAIDA');
});

test('situação: água entrando em casa → evacuar e acionar resgate e coordenação', () => {
  const r = situacao.avaliarSituacao(['agua_subindo']);
  assert.equal(r.nivel, 3);
  assert.equal(r.postura, 'EVACUAR');
  assert.deepEqual(r.acionar.map((c) => c.id), ['resgate', 'coordenacao']);
  assert.equal(r.acionar[0].nome, 'Equipe de resgate');
});

test('situação: tiroteio → abrigar no local', () => {
  const r = situacao.avaliarSituacao(['tiroteio']);
  assert.equal(r.postura, 'ABRIGAR');
  assert.deepEqual(r.acionar.map((c) => c.id), ['vigilancia']);
});

test('situação: risco dentro prevalece sobre risco fora, com aviso', () => {
  const r = situacao.avaliarSituacao(['tiroteio', 'fogo'], { rotaSegura: false });
  assert.equal(r.postura, 'EVACUAR');
  assert.equal(r.avisos.length, 2);
});

test('situação: pessoa ferida sozinha → pedir socorro à equipe de saúde', () => {
  const r = situacao.avaliarSituacao(['ferido_grave']);
  assert.equal(r.postura, 'SOCORRO');
  assert.deepEqual(r.acionar.map((c) => c.id), ['saude']);
  const comFogo = situacao.avaliarSituacao(['ferido_grave', 'fogo']);
  assert.equal(comFogo.postura, 'EVACUAR');
  assert.ok(comFogo.avisos.some((a) => a.includes('equipe de saúde')));
});

test('situação: rejeita sinal desconhecido', () => {
  assert.throws(() => situacao.avaliarSituacao(['zumbis']));
});

// ---------------------------------------------------------------- comunicação

test('comunicação: árvore de chamadas com 3 por pessoa', () => {
  const membros = Array.from({ length: 13 }, (_, i) => ({ nome: `P${i}` }));
  const { ligacoes, rodadas } = comunicacao.gerarArvore(membros);
  assert.deepEqual(ligacoes[0].avisa.map((m) => m.nome), ['P1', 'P2', 'P3']);
  assert.equal(ligacoes[0].rodada, 1);
  assert.deepEqual(ligacoes[1].avisa.map((m) => m.nome), ['P4', 'P5', 'P6']);
  assert.equal(ligacoes[1].rodada, 2);
  assert.equal(rodadas, 2); // 1 + 3 + 9 = 13 pessoas em 2 rodadas
  const avisados = ligacoes.flatMap((l) => l.avisa).length;
  assert.equal(avisados, 12);
});

test('comunicação: árvore com 1 ou 0 pessoas', () => {
  assert.equal(comunicacao.gerarArvore([{ nome: 'Só' }]).rodadas, 0);
  assert.equal(comunicacao.gerarArvore([]).ligacoes.length, 0);
  assert.throws(() => comunicacao.gerarArvore([], { porPessoa: 0 }), RangeError);
});

test('comunicação: SMS sem acento e contagem de segmentos', () => {
  const r = comunicacao.prepararSMS('Atenção: está tudo bem, irmã!');
  assert.equal(r.texto, 'Atencao: esta tudo bem, irma!');
  assert.equal(r.segmentos, 1);
  assert.equal(comunicacao.prepararSMS('a'.repeat(160)).segmentos, 1);
  assert.equal(comunicacao.prepararSMS('a'.repeat(161)).segmentos, 2);
  assert.equal(comunicacao.prepararSMS('[]').caracteres, 4);
});

test('comunicação: mensagem padrão sem campos vazios estranhos', () => {
  const r = comunicacao.montarMensagem('ok', { nome: 'Ana', local: 'casa da Tia Lúcia', hora: '14h' });
  assert.equal(r.texto, 'OK Ana: estou bem em casa da Tia Lucia. 14h.');
  assert.throws(() => comunicacao.montarMensagem('xyz'));
});

test('comunicação: próxima janela de contato', () => {
  const agora = new Date(2026, 10, 7, 12, 5);
  const r = comunicacao.proximaJanela(['08:00', '12:00', '18:00'], agora);
  assert.equal(r.emJanela, true);
  assert.equal(r.proxima.getHours(), 18);
  assert.equal(r.minutosAte, 355);
  const noite = comunicacao.proximaJanela(['08:00', '12:00'], new Date(2026, 10, 7, 22, 0));
  assert.equal(noite.proxima.getDate(), 8);
  assert.equal(noite.minutosAte, 600);
});

test('comunicação: cargas de power bank', () => {
  assert.equal(comunicacao.cargasPowerbank(10000, 4000), 1.6);
  assert.throws(() => comunicacao.cargasPowerbank(0, 4000), RangeError);
});

// ------------------------------------------------------------------------ kit

test('kit: seções básicas sempre presentes', () => {
  const secoes = kit.gerarKit({ adultos: 2 });
  const ids = secoes.map((s) => s.id);
  for (const id of ['docs', 'agua', 'saude', 'luz', 'ferramentas', 'roupas']) assert.ok(ids.includes(id));
  assert.ok(!ids.includes('bebes'));
  assert.ok(secoes.find((s) => s.id === 'agua').itens[0].texto.includes('4 L'));
});

test('kit: personaliza para bebês, idosos, pets e dependentes de energia', () => {
  const secoes = kit.gerarKit({ adultos: 1, bebes: 1, idosos: 1, caes: 1 }, { remediosContinuos: true, dependenteEnergia: true });
  const ids = secoes.map((s) => s.id);
  for (const id of ['bebes', 'cuidados', 'pets', 'energia']) assert.ok(ids.includes(id), id);
  assert.ok(secoes.find((s) => s.id === 'bebes').itens[0].texto.includes('18'));
  assert.ok(secoes.find((s) => s.id === 'saude').itens.some((i) => i.id === 'saude.continuos'));
});

test('kit: ids únicos e progresso', () => {
  const secoes = kit.gerarKit({ adultos: 1, criancas: 1, gestantes: 1, gatos: 1 }, { mobilidadeReduzida: true });
  const ids = secoes.flatMap((s) => s.itens.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
  const p = kit.progresso(secoes, { [ids[0]]: true, [ids[1]]: true, inexistente: true });
  assert.equal(p.feitos, 2);
  assert.equal(p.total, ids.length);
});

// ------------------------------------------------------------------- cenários

test('cenários: todos completos e com ids únicos', () => {
  const ids = cenarios.CENARIOS.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 10);
  for (const c of cenarios.CENARIOS) {
    for (const campo of ['sinais', 'antes', 'durante', 'depois']) {
      assert.ok(Array.isArray(c[campo]) && c[campo].length > 0, `${c.id}.${campo}`);
    }
  }
  assert.equal(cenarios.buscarCenario('enchente').titulo, 'Enchente e alagamento');
  assert.equal(cenarios.buscarCenario('nada'), null);
});

// ----------------------------------------------------------------------- rede

const MEMBROS = [
  { nome: 'Dona Maria', bairro: 'Centro', necessidades: ['idoso_sozinho', 'dependente_energia'] },
  { nome: 'João', bairro: 'Centro', habilidades: ['transporte', 'visita'] },
  { nome: 'Ana', bairro: 'Vila Nova', habilidades: ['gerador', 'saude'] },
  { nome: 'Pedro', bairro: 'Vila Nova', necessidades: ['acamado'] },
  { nome: 'Lia', bairro: 'Morro Azul', necessidades: ['criancas_pequenas'] },
];

test('rede: pareia priorizando necessidade crítica e mesmo bairro', () => {
  const { pares, semCobertura } = rede.parearApoio(MEMBROS);
  // Prioridade 1 primeiro (acamado e dependente de energia), em ordem alfabética.
  assert.equal(pares[0].pessoa, 'Dona Maria');
  assert.equal(pares[0].necessidade, 'dependente_energia');
  assert.equal(pares[0].ajudante, 'João'); // mesmo bairro vale mais que a habilidade preferida
  assert.equal(pares[0].mesmoBairro, true);
  const pedro = pares.find((p) => p.pessoa === 'Pedro');
  assert.equal(pedro.ajudante, 'Ana');
  assert.equal(pedro.habilidade, 'saude');
  assert.deepEqual(semCobertura.map((s) => s.pessoa), ['Lia']);
});

test('rede: respeita o limite de pessoas por ajudante', () => {
  const membros = [
    { nome: 'Ajudante', habilidades: ['transporte'] },
    { nome: 'A', necessidades: ['sem_transporte'] },
    { nome: 'B', necessidades: ['sem_transporte'] },
  ];
  const r = rede.parearApoio(membros, { maxPorAjudante: 1 });
  assert.equal(r.pares.length, 1);
  assert.equal(r.semCobertura.length, 1);
});

test('rede: resumo por bairro aponta lacunas', () => {
  const { porBairro, lacunas } = rede.resumoRecursos(MEMBROS);
  assert.equal(porBairro.Centro.membros, 2);
  assert.equal(porBairro['Vila Nova'].habilidades.gerador, 1);
  assert.deepEqual(lacunas.map((l) => `${l.bairro}:${l.necessidade}`), ['Morro Azul:criancas_pequenas']);
});

test('situação: todo sinal aponta para um protocolo existente (quando tem)', () => {
  for (const s of situacao.SINAIS) {
    if (s.cenario) assert.ok(cenarios.buscarCenario(s.cenario), `${s.id} → ${s.cenario}`);
  }
  assert.deepEqual(situacao.avaliarSituacao(['chuva_forte', 'agua_subindo', 'gas']).cenarios, ['enchente', 'gas']);
});
