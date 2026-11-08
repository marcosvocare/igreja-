'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../js/nucleo/bussola.js');
const C = require('../js/nucleo/cartografia.js');
const dadosHortolandia = require('../dados/mapa-hortolandia.js');

const perto = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} ≈ ${b} (±${tol})`);

// ===================================================================== bússola

test('bússola: ângulos normalizados e diferença pelo lado mais curto', () => {
  assert.equal(B.normalizar(-10), 350);
  assert.equal(B.normalizar(370), 10);
  assert.equal(B.diferenca(350, 10), 20);
  assert.equal(B.diferenca(10, 350), -20);
  assert.equal(B.diferenca(0, 180), 180);
});

test('bússola: declinação de Hortolândia (WMM2025) e correção para o norte verdadeiro', () => {
  assert.equal(B.declinacaoEm(new Date('2025-01-01T00:00:00Z')), -21.7);
  assert.equal(B.declinacaoEm(new Date('2026-11-08T00:00:00Z')), -21.8);
  assert.equal(B.declinacaoEm(new Date('2029-01-01T00:00:00Z')), -22);
  // Apontando para o norte magnético, o celular aponta para 338° verdadeiros.
  perto(B.paraVerdadeiro(0, -21.8), 338.2, 1e-9);
  perto(B.paraMagnetico(338.2, -21.8), 0, 1e-9);
});

test('bússola: rumo do sensor no iPhone, no Android e com a tela deitada', () => {
  assert.equal(B.rumoDoEvento({ webkitCompassHeading: 45 }), 45);
  assert.equal(B.rumoDoEvento({ alpha: 90, absolute: true }), 270); // alpha anti-horário
  assert.equal(B.rumoDoEvento({ alpha: 0, absolute: true }, 90), 90);
  assert.equal(B.rumoDoEvento({ alpha: 30, absolute: false }), null); // sem referência ao norte
  assert.equal(B.rumoDoEvento(null), null);
});

test('bússola: suaviza passando pelo norte sem dar a volta', () => {
  const s = B.suavizar(350, 10, 0.5);
  perto(s, 0, 1e-9);
  assert.equal(B.suavizar(undefined, 123), 123);
});

test('bússola: pontos cardeais em português (L = leste, O = oeste)', () => {
  assert.deepEqual(B.pontoCardeal(0), { sigla: 'N', nome: 'norte' });
  assert.deepEqual(B.pontoCardeal(91), { sigla: 'L', nome: 'leste' });
  assert.deepEqual(B.pontoCardeal(225), { sigla: 'SO', nome: 'sudoeste' });
  assert.equal(B.pontoCardeal16(292.5), 'ONO');
  assert.deepEqual(B.pontoCardeal(359), B.pontoCardeal(0));
});

test('bússola: guia até um ponto diz para que lado virar', () => {
  const origem = { lat: -22.86, lon: -47.22 };
  const leste = { lat: -22.86, lon: -47.21 };
  const g = B.guiaAte(origem, leste, 0);
  perto(g.rumo, 90, 0.5);
  perto(g.distancia, 1025, 10);
  assert.equal(g.texto, 'Vire 90° à direita');
  assert.equal(B.guiaAte(origem, leste, 90).texto, 'Siga em frente');
  assert.equal(B.guiaAte(origem, leste, 270).texto, 'Vire para trás');
  assert.match(B.guiaAte(origem, leste).texto, /leste/);
  assert.equal(B.guiaAte(origem, { lat: -22.86, lon: -47.21995 }).chegou, true);
});

test('sol: solstícios e equinócio em Hortolândia', () => {
  const junho = B.posicaoSol(new Date('2026-06-21T12:00:00Z'));
  const meioDiaJunho = B.posicaoSol(junho.meioDiaSolar);
  perto(meioDiaJunho.elevacao, 43.7, 0.5, 'altura ao meio-dia de junho');
  assert.ok(meioDiaJunho.azimute < 2 || meioDiaJunho.azimute > 358, 'sol ao norte');
  perto(junho.nascer.getTime(), Date.parse('2026-06-21T09:48:00Z'), 5 * 60000, 'nascer em junho (6h48)');

  const dezembro = B.posicaoSol(new Date('2026-12-21T12:00:00Z'));
  assert.ok(B.posicaoSol(dezembro.meioDiaSolar).elevacao > 88, 'quase a pino em dezembro');

  const marco = B.posicaoSol(new Date('2026-03-20T12:00:00Z'));
  perto(B.posicaoSol(marco.nascer).azimute, 90, 1.5, 'nasce a leste');
  perto(B.posicaoSol(marco.por).azimute, 270, 1.5, 'põe-se a oeste');
});

test('sol: orientar-se pelo sol de dia, e à noite manda usar as estrelas', () => {
  const tarde = B.orientarPeloSol(new Date('2026-06-21T18:00:00Z'));
  assert.equal(tarde.possivel, true);
  assert.match(tarde.texto, /noroeste/);
  assert.match(tarde.texto, /à sua direita/);
  const noite = B.orientarPeloSol(new Date('2026-06-21T03:00:00Z'));
  assert.equal(noite.possivel, false);
  assert.match(noite.texto, /Cruzeiro do Sul/);
  const meioDiaVerao = B.orientarPeloSol(B.posicaoSol(new Date('2026-12-21T12:00:00Z')).meioDiaSolar);
  assert.equal(meioDiaVerao.possivel, false);
});

test('sol: confere a bússola (erro de até 10° aceito)', () => {
  const quando = new Date('2026-06-21T13:00:00Z');
  const az = B.posicaoSol(quando).azimute;
  assert.equal(B.conferirComSol(az + 5, quando).ok, true);
  const ruim = B.conferirComSol(az + 25, quando);
  assert.equal(ruim.ok, false);
  perto(ruim.erro, 25, 1e-6);
});

test('sem bússola: métodos completos e declinação local citada', () => {
  assert.ok(B.SEM_BUSSOLA.length >= 5);
  for (const m of B.SEM_BUSSOLA) assert.ok(m.titulo && m.passos.length >= 2, m.id);
  assert.ok(B.SEM_BUSSOLA.find((m) => m.id === 'agulha').passos.some((p) => p.includes('22°')));
});

// ============================================================= mapa da cidade

/** Cidade de teste: grade 5 × 5 de ruas a cada ~100 m. */
function cidadeTeste({ comLimite = true } = {}) {
  const Q = 1e-5;
  const o = [-22.87, -47.23];
  const dLat = 90; // ~100 m
  const dLon = 98; // ~100 m nesta latitude
  const base = [2000, 1000]; // (q) a partir da origem
  const idx = (l, c) => l * 5 + c;
  const nos = [];
  let a = 0;
  let b = 0;
  for (let l = 0; l < 5; l++) {
    for (let c = 0; c < 5; c++) {
      const la = base[0] - l * dLat; // linha 0 ao norte
      const lo = base[1] + c * dLon;
      nos.push(la - a, lo - b);
      a = la;
      b = lo;
    }
  }
  const nomes = ['Rua Ãngela', 'Rua Bento', 'Rua Cícero', 'Rua Dália', 'Rua Elói', 'Avenida São João', 'Rua Um', 'Rua Dois', 'Rua Três', 'Rua Quatro'];
  const vias = [];
  const via = (classe, nome, lista) => {
    vias.push(classe, nome, lista.length);
    let ant = 0;
    for (const i of lista) {
      vias.push(i - ant);
      ant = i;
    }
  };
  for (let l = 0; l < 5; l++) via(3, l + 1, [0, 1, 2, 3, 4].map((c) => idx(l, c))); // ruas leste–oeste
  for (let c = 0; c < 5; c++) via(c === 0 ? 1 : 3, c + 6, [0, 1, 2, 3, 4].map((l) => idx(l, c))); // norte–sul
  const pares = (pts) => {
    const out = [pts.length];
    let x = 0;
    let y = 0;
    for (const [la, lo] of pts) {
      out.push(la - x, lo - y);
      x = la;
      y = lo;
    }
    return out;
  };
  const caixa = { sul: o[0] + (base[0] - 600) * Q, norte: o[0] + (base[0] + 200) * Q, oeste: o[1] + (base[1] - 200) * Q, leste: o[1] + (base[1] + 600) * Q };
  return C.criarCidade({
    v: 1,
    nome: 'Cidade Teste',
    fonte: 'teste',
    data: '2026-01-01',
    q: Q,
    o,
    caixa,
    nomes,
    nos,
    vias,
    linhas: { agua: [], ferrovia: [] },
    areas: { agua: [], verde: [] },
    limite: comLimite ? pares([[base[0] + 50, base[1] - 50], [base[0] + 50, base[1] + 450], [base[0] - 410, base[1] + 450], [base[0] - 410, base[1] - 50], [base[0] + 50, base[1] - 50]]) : [],
    locais: [[0, 0, 'Farmácia Central', base[0] - 2 * dLat, base[1] + 2 * dLon + 10]],
    bairros: [['Jardim Teste', base[0] - 2 * dLat, base[1] + 2 * dLon]],
  });
}

function no(cid, l, c) {
  const i = l * 5 + c;
  return cid.desprojetar(cid.nos.x[i], cid.nos.y[i]);
}

test('mapa: lê nós e ruas e converte metros ↔ coordenadas', () => {
  const cid = cidadeTeste();
  assert.equal(cid.vias.length, 10);
  assert.equal(cid.nos.total, 25);
  const a = no(cid, 0, 0);
  const b = no(cid, 0, 1);
  perto(Math.hypot(cid.nos.x[1] - cid.nos.x[0], cid.nos.y[1] - cid.nos.y[0]), 100, 2, 'quarteirão');
  const ida = cid.projetar(a.lat, a.lon);
  const volta = cid.desprojetar(ida.x, ida.y);
  perto(volta.lat, a.lat, 1e-9);
  perto(volta.lon, a.lon, 1e-9);
  assert.ok(b.lon > a.lon);
});

test('mapa: rua e bairro mais próximos, quadrícula e limite do município', () => {
  const cid = cidadeTeste();
  const p = no(cid, 2, 2);
  const meio = { lat: p.lat, lon: p.lon + 0.0002 }; // ~20 m a leste do cruzamento, sobre a Rua Cícero
  const d = cid.descrever(meio.lat, meio.lon);
  assert.equal(d.rua.nome, 'Rua Cícero');
  assert.ok(d.rua.distancia < 3);
  assert.equal(d.bairro, 'Jardim Teste');
  assert.equal(d.noMunicipio, true);
  assert.match(d.quadrante, /^[A-Z]+\d+$/);
  const centro = cid.centroQuadrante(d.quadrante);
  assert.equal(cid.quadrante(centro.lat, centro.lon), d.quadrante);
  assert.equal(cid.centroQuadrante('ZZ99'), null);
  const fora = cid.desprojetar(cid.nos.x[4] + 150, cid.nos.y[4]);
  assert.equal(cid.dentroDoMunicipio(fora.lat, fora.lon), false);
  assert.equal(cid.ruaMaisProxima(fora.lat + 0.05, fora.lon), null);
});

test('mapa: busca sem acento e com abreviação', () => {
  const cid = cidadeTeste();
  assert.equal(cid.buscar('av sao joao')[0].nome, 'Avenida São João');
  assert.equal(cid.buscar('angela')[0].nome, 'Rua Ãngela');
  assert.equal(cid.buscar('r. cicero')[0].nome, 'Rua Cícero');
  assert.equal(cid.buscar('farmacia')[0].tipo, 'local');
  assert.equal(cid.buscar('jd teste')[0].tipo, 'bairro');
  assert.deepEqual(cid.buscar('xyz inexistente'), []);
  assert.deepEqual(cid.buscar('   '), []);
});

test('mapa: rota a pé pelas ruas com instruções de virada', () => {
  const cid = cidadeTeste();
  const r = cid.rota(no(cid, 0, 0), no(cid, 4, 4));
  perto(r.distancia, 800, 20, 'anda 4 quarteirões para cada lado');
  assert.equal(r.minutos, 12);
  assert.ok(r.passos.length >= 3);
  assert.match(r.passos[0].texto, /^Siga pela /);
  assert.ok(r.passos.some((p) => /Vire à (direita|esquerda)/.test(p.texto)), r.passos.map((p) => p.texto).join(' / '));
  assert.equal(r.passos[r.passos.length - 1].texto, 'Chegada');
  assert.deepEqual(r.perigos, []);
  // Mesmo trecho de rua.
  const curto = cid.rota(cid.desprojetar(cid.nos.x[0] + 20, cid.nos.y[0]), cid.desprojetar(cid.nos.x[0] + 70, cid.nos.y[0]));
  perto(curto.distancia, 50, 2);
});

test('mapa: rota desvia de zona de perigo e de rua bloqueada', () => {
  const cid = cidadeTeste();
  const origem = no(cid, 0, 0);
  const destino = no(cid, 0, 4);
  const direta = cid.rota(origem, destino);
  perto(direta.distancia, 400, 10);
  // Perigo no meio da rua de cima: a rota desce um quarteirão e volta.
  const meio = no(cid, 0, 2);
  const perigo = { nome: 'Saque', lat: meio.lat, lon: meio.lon, raio: 40, status: 'inseguro', tipo: 'conflito' };
  const desvio = cid.rota(origem, destino, { perigos: [perigo] });
  assert.ok(desvio.distancia > 450, `desviou: ${desvio.distancia}`);
  assert.deepEqual(desvio.perigos, []);
  // Perigo resolvido não conta.
  perto(cid.rota(origem, destino, { perigos: [{ ...perigo, status: 'resolvido' }] }).distancia, 400, 10);
  // Cercado por todos os lados: passa, mas avisa.
  const cercado = cid.rota(origem, destino, { perigos: [{ ...perigo, lat: destino.lat, lon: destino.lon, raio: 60 }] });
  assert.ok(cercado.perigos.includes('Saque'));
  assert.match(cercado.aviso, /zona de perigo/);
});

test('mapa: escala gráfica com números redondos', () => {
  const cid = cidadeTeste();
  assert.deepEqual(cid.escala(1, 120), { metros: 100, pixels: 100, texto: '100 m' });
  assert.equal(cid.escala(0.05, 120).texto, '2 km');
  assert.equal(cid.escala(0.3, 120).texto, '200 m');
});

test('mapa: dados em formato desconhecido são recusados', () => {
  assert.throws(() => C.criarCidade({ v: 99 }), /formato/);
  assert.throws(() => C.criarCidade(null), /formato/);
});

// ====================================================== dados reais de Hortolândia

test('Hortolândia: dados do OpenStreetMap carregam com ruas, bairros e locais', () => {
  const t0 = Date.now();
  const cid = C.criarCidade(dadosHortolandia);
  assert.ok(Date.now() - t0 < 2000, 'carrega rápido');
  assert.equal(cid.nome, 'Hortolândia');
  assert.match(cid.fonte, /OpenStreetMap/);
  assert.match(cid.fonte, /ODbL/);
  assert.ok(cid.vias.length > 5000, `${cid.vias.length} ruas`);
  assert.ok(cid.bairros.length > 50);
  assert.ok(cid.limite.length >= 1);
  const tipos = new Set(cid.locais.map((l) => l.tipo));
  for (const t of ['farmacia', 'hospital', 'mercado', 'igreja', 'escola', 'cisterna', 'combustivel']) assert.ok(tipos.has(t), t);
});

test('Hortolândia: centro na quadrícula F6, dentro do município; Campinas fica fora da área', () => {
  const cid = C.criarCidade(dadosHortolandia);
  const d = cid.descrever(-22.862, -47.2164);
  assert.equal(d.quadrante, 'F6');
  assert.equal(d.noMunicipio, true);
  assert.ok(d.rua && d.rua.nome);
  assert.equal(cid.dentroDaArea(-22.905, -47.061), false);
});

test('Hortolândia: busca e rota a pé do centro até um hospital', () => {
  const cid = C.criarCidade(dadosHortolandia);
  assert.match(cid.buscar('av olivio franceschini')[0].nome, /Olívio Franceschini/);
  assert.match(cid.buscar('jd amanda')[0].nome, /Jardim Amanda/);
  const hospital = cid.locais.find((l) => l.tipo === 'hospital');
  const t0 = Date.now();
  const r = cid.rota({ lat: -22.862, lon: -47.2164 }, hospital);
  assert.ok(Date.now() - t0 < 1500, 'calcula rápido');
  assert.ok(r && r.distancia > 300 && r.distancia < 15000, `${r && r.distancia} m`);
  assert.ok(r.passos.length >= 2);
});
