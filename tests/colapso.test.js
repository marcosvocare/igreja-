'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const mapa = require('../js/nucleo/mapa.js');
const remedios = require('../js/nucleo/remedios.js');
const partilha = require('../js/nucleo/partilha.js');
const defesa = require('../js/nucleo/defesa.js');
const situacao = require('../js/nucleo/situacao.js');
const cenarios = require('../js/nucleo/cenarios.js');

// ----------------------------------------------------------------------- mapa

test('mapa: lê coordenadas digitadas e links do Google Maps', () => {
  assert.deepEqual(mapa.lerCoordenadas('-23.5505, -46.6333'), { lat: -23.5505, lon: -46.6333 });
  assert.deepEqual(mapa.lerCoordenadas('https://www.google.com/maps/@-23.5505,-46.6333,15z'), { lat: -23.5505, lon: -46.6333 });
  assert.deepEqual(mapa.lerCoordenadas('https://maps.google.com/?q=-22.9068%2C-43.1729'), { lat: -22.9068, lon: -43.1729 });
  assert.deepEqual(mapa.lerCoordenadas('-23,5505 -46,6333'), { lat: -23.5505, lon: -46.6333 });
  assert.deepEqual(mapa.lerCoordenadas('-23,5505; -46,6333'), { lat: -23.5505, lon: -46.6333 });
  assert.equal(mapa.lerCoordenadas('perto da praça'), null);
  assert.equal(mapa.lerCoordenadas('95, 10'), null);
});

test('mapa: distância, rumo e direção', () => {
  const d = mapa.distanciaMetros({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
  assert.ok(Math.abs(d - 111195) < 2, `${d}`);
  assert.equal(Math.round(mapa.rumoGraus({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })), 0);
  assert.equal(mapa.direcao(mapa.rumoGraus({ lat: 0, lon: 0 }, { lat: 0, lon: 1 })), 'leste');
  assert.equal(mapa.direcao(225), 'sudoeste');
  assert.equal(mapa.minutosAPe(500), 10);
});

const AGORA = new Date('2026-11-07T12:00:00Z');
const BASE = { lat: -23.55, lon: -46.63 };
const LESTE_300M = 300 / (111195 * Math.cos(23.55 * Math.PI / 180));
const PONTOS = [
  { id: 'A', nome: 'Poço do Seu Zé', categoria: 'agua', tipo: 'poco', status: 'disponivel', lat: -23.55 + 0.0045, lon: -46.63, verificadoEm: '2026-11-07T11:00:00Z' },
  { id: 'B', nome: 'Torneira da escola', categoria: 'agua', tipo: 'torneira', status: 'disponivel', lat: -23.55, lon: -46.63 + LESTE_300M, verificadoEm: '2026-11-07T11:30:00Z' },
  { id: 'C', nome: 'Caixa da praça', categoria: 'agua', tipo: 'cisterna', status: 'esgotado', lat: -23.551, lon: -46.631 },
  { id: 'D', nome: 'Nascente do morro', categoria: 'agua', tipo: 'nascente', status: 'disponivel' },
  { id: 'E', nome: 'Cisterna da igreja', categoria: 'agua', tipo: 'cisterna', status: 'disponivel', lat: -23.55 - 0.0036, lon: -46.63, verificadoEm: '2026-11-02T12:00:00Z' },
  { id: 'P', nome: 'Saque na avenida', categoria: 'perigo', tipo: 'conflito', status: 'inseguro', raio: 100, lat: -23.55, lon: -46.63 + LESTE_300M / 2 },
  { id: 'R', nome: 'Farmácia central', categoria: 'remedio', tipo: 'farmacia', status: 'escasso', lat: -23.548, lon: -46.629, verificadoEm: '2026-11-05T12:00:00Z' },
];

test('mapa: recomenda a fonte mais conveniente e evita rota perigosa', () => {
  const r = mapa.buscarRecursos(PONTOS, BASE, { categoria: 'agua', agora: AGORA });
  assert.equal(r.recomendado.ponto.id, 'A');
  assert.equal(r.recomendado.direcao, 'norte');
  assert.ok(Math.abs(r.recomendado.distancia - 500) < 5);
  assert.ok(r.recomendado.tratamento.includes('Ferva'));
  // A: 500 m × 1,5 (passa perto) = 750 · B: 300 m × 3 (atravessa) = 900 ·
  // E: 400 m × 2 (informação velha) × 1,5 (passa perto) = 1200
  assert.deepEqual(r.opcoes.map((o) => o.ponto.id), ['A', 'B', 'E']);
  const b = r.opcoes.find((o) => o.ponto.id === 'B');
  assert.deepEqual(b.perigos, ['Saque na avenida']);
  assert.equal(b.rotaPerigo, 'atravessa');
  // O perigo fica a 150 m da base: a rota para o norte só passa perto dele.
  assert.equal(r.recomendado.rotaPerigo, 'perto');
  assert.equal(r.opcoes.find((o) => o.ponto.id === 'E').frescor.nivel, 'desatualizada');
  assert.deepEqual(r.evitar.map((e) => e.ponto.id), ['C']);
  assert.deepEqual(r.semLocalizacao.map((e) => e.ponto.id), ['D']);
});

test('mapa: perigo resolvido deixa de pesar na rota', () => {
  const pontos = PONTOS.map((p) => (p.id === 'P' ? { ...p, status: 'resolvido' } : p));
  const b = mapa.buscarRecursos(pontos, BASE, { categoria: 'agua', agora: AGORA }).opcoes.find((o) => o.ponto.id === 'B');
  assert.deepEqual(b.perigos, []);
  assert.equal(b.rotaPerigo, null);
});

test('mapa: cobertura aponta lacunas de informação confiável', () => {
  const r = mapa.resumoCobertura(PONTOS, AGORA);
  assert.equal(r.porCategoria.agua.confiaveis, 2);
  assert.equal(r.porCategoria.remedio.confiaveis, 0);
  assert.deepEqual(r.lacunas, ['remedio', 'alimento']);
  assert.equal(r.perigosAtivos, 1);
  assert.throws(() => mapa.buscarRecursos(PONTOS, BASE, { categoria: 'perigo' }));
  assert.equal(mapa.frescor(null).nivel, 'nunca');
});

// ------------------------------------------------------------------- remédios

const REMEDIOS = [
  { pessoa: 'Dona Maria', nome: 'Losartana 50 mg', dosesPorDia: 2, quantidade: 20 },
  { pessoa: 'Seu João', nome: 'Insulina', dosesPorDia: 3, unidadesPorDose: 10, quantidade: 150, refrigerado: true },
  { pessoa: 'Ana', nome: 'Levotiroxina', dosesPorDia: 1, quantidade: 60, validade: '2026-11-27' },
  { pessoa: 'Pedro', nome: 'Xarope antigo', dosesPorDia: 1, quantidade: 10, validade: '2026-10-01' },
  { pessoa: 'Lia', nome: 'Pomada', quantidade: 1 },
];

test('remédios: dias restantes, nível e ordem de urgência', () => {
  const r = remedios.situacaoRemedios(REMEDIOS, '2026-11-07');
  assert.deepEqual(r.itens.map((i) => i.nome), ['Xarope antigo', 'Insulina', 'Losartana 50 mg', 'Pomada', 'Levotiroxina']);
  const los = r.itens.find((i) => i.nome === 'Losartana 50 mg');
  assert.equal(los.dias, 10);
  assert.equal(los.nivel, 'atencao');
  assert.equal(los.acabaEm, '2026-11-17');
  const ins = r.itens.find((i) => i.nome === 'Insulina');
  assert.equal(ins.dias, 5);
  assert.equal(ins.nivel, 'critico');
  assert.ok(ins.avisos.some((a) => a.includes('geladeira')));
  const levo = r.itens.find((i) => i.nome === 'Levotiroxina');
  assert.equal(levo.diasEfetivos, 20);
  assert.ok(levo.avisos[0].includes('Vence antes'));
  assert.equal(r.itens.find((i) => i.nome === 'Xarope antigo').nivel, 'critico');
  assert.equal(r.itens.find((i) => i.nome === 'Pomada').nivel, 'sem_dados');
  assert.equal(r.criticos, 2);
  assert.deepEqual(r.pessoasEmRisco, ['Pedro', 'Seu João']);
  assert.equal(r.menorCobertura, 0);
});

test('remédios: plano de reposição para a meta', () => {
  const p = remedios.planoReposicao(REMEDIOS, 30);
  assert.deepEqual(p.map((x) => [x.nome, x.faltam]), [['Losartana 50 mg', 40], ['Insulina', 750], ['Xarope antigo', 20]]);
  assert.throws(() => remedios.planoReposicao(REMEDIOS, 0), RangeError);
});

// ------------------------------------------------------------------- partilha

test('partilha: estoque suficiente atende todos e mostra a sobra', () => {
  const r = partilha.distribuir(100, [{ nome: 'A', necessidade: 10 }, { nome: 'B', necessidade: 30 }], { dias: 2 });
  assert.deepEqual(r.porFamilia.map((f) => f.alocado), [20, 60]);
  assert.deepEqual(r.porFamilia.map((f) => f.porDia), [10, 30]);
  assert.equal(r.sobra, 20);
  assert.equal(r.cobertura, 100);
});

test('partilha: falta divide a mesma porcentagem para todos', () => {
  const r = partilha.distribuir(20, [{ nome: 'A', necessidade: 10 }, { nome: 'B', necessidade: 30 }]);
  assert.deepEqual(r.porFamilia.map((f) => f.alocado), [5, 15]);
  assert.deepEqual(r.porFamilia.map((f) => f.percentual), [50, 50]);
  assert.equal(r.sobra, 0);
});

test('partilha: famílias vulneráveis recebem porcentagem maior, até 100 %', () => {
  const r = partilha.distribuir(20, [{ nome: 'A', necessidade: 10, vulneravel: true }, { nome: 'B', necessidade: 30 }]);
  assert.ok(r.porFamilia[0].percentual > r.porFamilia[1].percentual);
  assert.ok(r.distribuido <= 20);
  const cheio = partilha.distribuir(35, [{ nome: 'A', necessidade: 10, vulneravel: true }, { nome: 'B', necessidade: 30 }]);
  assert.equal(cheio.porFamilia[0].alocado, 10);
  assert.equal(cheio.porFamilia[1].alocado, 25);
  assert.equal(partilha.diasDeEstoque(100, 40), 2.5);
  assert.throws(() => partilha.distribuir(-1, []), RangeError);
});

// --------------------------------------------------------------------- defesa

test('defesa: escala de vigia respeita descanso e distribui a carga', () => {
  const nomes = ['Ana', 'Bia', 'Caio', 'Davi', 'Eva', 'Fábio', 'Gil', 'Hugo'];
  const inicio = new Date(2026, 10, 7, 18, 0);
  const r = defesa.gerarEscala(nomes, { inicio, horas: 24, duracaoTurno: 3, porTurno: 2, descansoMinimo: 6 });
  assert.equal(r.turnos.length, 8);
  assert.ok(r.turnos.every((t) => t.completo && t.pessoas.length === 2));
  assert.ok(r.carga.every((c) => c.horas === 6), JSON.stringify(r.carga));
  assert.equal(r.necessario, 6);
  assert.deepEqual(r.avisos, []);
  for (const nome of nomes) {
    const meus = r.turnos.filter((t) => t.pessoas.includes(nome));
    for (let i = 1; i < meus.length; i++) {
      const folga = (meus[i].inicio - meus[i - 1].fim) / 3600000;
      assert.ok(folga >= 6, `${nome} descansou só ${folga} h`);
    }
  }
  assert.equal(r.turnos[0].inicio.getHours(), 18);
});

test('defesa: avisa quando faltam voluntários ou o vigia está sozinho', () => {
  const r = defesa.gerarEscala(['Ana', 'Bia', 'Caio'], { inicio: new Date(2026, 10, 7, 18), horas: 12, duracaoTurno: 3, porTurno: 2, descansoMinimo: 6 });
  assert.ok(r.avisos.some((a) => a.includes('pelo menos 6')));
  assert.ok(r.turnos.some((t) => !t.completo));
  const sozinho = defesa.gerarEscala(['Ana', 'Bia', 'Caio', 'Davi'], { inicio: new Date(), horas: 6, duracaoTurno: 2, porTurno: 1, descansoMinimo: 2 });
  assert.ok(sozinho.avisos.some((a) => a.includes('duplas')));
  assert.throws(() => defesa.gerarEscala([], { inicio: new Date('x') }), RangeError);
});

test('defesa: senha do dia é a mesma para quem tem a frase e muda com o dia', () => {
  const dia = new Date(2026, 10, 7, 9);
  const a = defesa.senhaDoDia('Salmo 23 é minha força', dia);
  const b = defesa.senhaDoDia('  salmo 23 e minha   FORÇA ', new Date(2026, 10, 7, 22));
  assert.deepEqual(a, b);
  assert.notEqual(a.senha, a.contrassenha);
  const semana = Array.from({ length: 7 }, (_, i) => defesa.senhaDoDia('Salmo 23 é minha força', new Date(2026, 10, 7 + i)).senha);
  assert.ok(new Set(semana).size > 1);
  assert.notDeepEqual(defesa.senhaDoDia('outra frase qualquer', dia), a);
  assert.throws(() => defesa.senhaDoDia('curta', dia), RangeError);
  assert.equal(new Set(defesa.PALAVRAS).size, defesa.PALAVRAS.length);
});

test('defesa: avaliação de segurança prioriza os itens de maior peso', () => {
  const vazio = defesa.avaliarSeguranca({});
  assert.equal(vazio.percentual, 0);
  assert.equal(vazio.nivel, 'fragil');
  assert.equal(vazio.prioridades[0].peso, 3);
  const tudo = Object.fromEntries(defesa.CHECKLIST.map((c) => [c.id, true]));
  const cheio = defesa.avaliarSeguranca(tudo);
  assert.equal(cheio.percentual, 100);
  assert.equal(cheio.nivel, 'boa');
  assert.equal(cheio.prioridades.length, 0);
});

// ------------------------------------------------------- triagem e protocolo

test('triagem: saques no bairro acionam vigilância e coordenação e levam ao protocolo de colapso', () => {
  const r = situacao.avaliarSituacao(['saques'], { diasAutonomia: 10 });
  assert.equal(r.nivel, 2);
  assert.equal(r.postura, 'RACIONAR');
  assert.deepEqual(r.acionar.map((e) => e.id), ['vigilancia', 'coordenacao']);
  assert.deepEqual(r.cenarios, ['colapso']);
  assert.equal(cenarios.CENARIOS[0].id, 'colapso');
});

test('sem Estado: toda equipe acionada existe', () => {
  const equipes = Object.keys(situacao.EQUIPES);
  for (const s of situacao.SINAIS) for (const id of s.acionar) assert.ok(equipes.includes(id), `${s.id} → ${id}`);
  for (const c of cenarios.CENARIOS) {
    assert.ok(c.acionar.length > 0, c.id);
    for (const id of c.acionar) assert.ok(equipes.includes(id), `${c.id} → ${id}`);
  }
});

test('sem Estado: nenhum mecanismo manda pedir ajuda a órgãos do governo', () => {
  const modulos = ['situacao', 'cenarios', 'kit', 'agua', 'suprimentos', 'estoque', 'comunicacao', 'rede', 'mapa', 'remedios', 'partilha', 'defesa', 'radio',
    'socorros', 'saneamento', 'energia', 'abrigo', 'pessoas', 'cozinha', 'cuidado', 'configuracao', 'sincronizacao'];
  const proibido = /\b(190|192|193|199|40199)\b|defesa civil|samu|corpo de bombeiros|pol[ií]cia|autoridades?|prefeitura|concession[áa]ria|anatel|\bsus\b|\bubs\b|\bupa\b|governo|oficial/i;
  for (const nome of modulos) {
    const m = require(`../js/nucleo/${nome}.js`);
    const textos = [];
    const coletar = (v) => {
      if (typeof v === 'string') textos.push(v);
      else if (Array.isArray(v)) v.forEach(coletar);
      else if (v && typeof v === 'object') Object.values(v).forEach(coletar);
    };
    coletar(m);
    coletar(nome === 'kit' ? m.gerarKit({ adultos: 1, idosos: 1, gestantes: 1, criancas: 1, bebes: 1, caes: 1 }, { remediosContinuos: true, mobilidadeReduzida: true, dependenteEnergia: true }) : null);
    coletar(nome === 'situacao' ? Object.values(m.POSTURAS) : null);
    for (const t of textos) assert.ok(!proibido.test(t), `${nome}: "${t}"`);
  }
  // Avisos gerados pela triagem também
  const r = situacao.avaliarSituacao(['fogo', 'tiroteio', 'ferido_grave'], { rotaSegura: false });
  for (const a of r.avisos) assert.ok(!proibido.test(a), a);
});
