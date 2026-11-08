#!/usr/bin/env node
/**
 * Gera dados/mapa-hortolandia.js a partir do que baixar-mapa-osm.js guardou.
 *
 * Mantém: ruas e caminhos (com os cruzamentos, para calcular rotas a pé), rios e
 * córregos, lagos e represas, parques e matas, ferrovia, limite do município e
 * locais úteis numa emergência (saúde, comida, água, abrigo, gás e combustível).
 * Deixa de fora prédios, estacionamentos, calçadas desenhadas ao lado das ruas e
 * locais de órgãos de segurança. Curvas são simplificadas com tolerância de 2 m.
 *
 * Dados © colaboradores do OpenStreetMap, licença ODbL (openstreetmap.org/copyright).
 *
 * Uso: node scripts/gerar-mapa-cidade.js [--cache pasta] [--saida arquivo]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { CLASSES, CATEGORIAS, ORDEM_CATEGORIAS } = require('../js/nucleo/cartografia.js');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const arg = (nome, pad) => (args.indexOf(nome) >= 0 ? path.resolve(args[args.indexOf(nome) + 1]) : pad);
const CACHE = arg('--cache', path.join(RAIZ, '.cache-osm'));
const SAIDA = arg('--saida', path.join(RAIZ, 'dados', 'mapa-hortolandia.js'));
const Q = 1e-5; // ~1,1 m

// ------------------------------------------------------------------ leitura
const nos = new Map();
const vias = new Map();
const relacoes = new Map();
let dataMaisRecente = 0;
for (const arq of fs.readdirSync(CACHE).filter((a) => /^pedaco_.*\.json$/.test(a))) {
  dataMaisRecente = Math.max(dataMaisRecente, fs.statSync(path.join(CACHE, arq)).mtimeMs);
  for (const e of JSON.parse(fs.readFileSync(path.join(CACHE, arq), 'utf8')).elements) {
    if (e.type === 'node') nos.set(e.id, e);
    else if (e.type === 'way') vias.set(e.id, e);
    else relacoes.set(e.id, e);
  }
}
const limiteOSM = JSON.parse(fs.readFileSync(path.join(CACHE, 'limite.json'), 'utf8')).elements;
for (const e of limiteOSM) if (e.type === 'node' && !nos.has(e.id)) nos.set(e.id, e);
const caixa = JSON.parse(fs.readFileSync(path.join(CACHE, 'caixa.json'), 'utf8'));
const r6 = (x) => Math.round(x * 1e6) / 1e6;
const caixaSaida = { sul: r6(caixa.sul), norte: r6(caixa.norte), oeste: r6(caixa.oeste), leste: r6(caixa.leste) };
const ORIGEM = [caixaSaida.sul, caixaSaida.oeste];
const qlat = (lat) => Math.round((lat - ORIGEM[0]) / Q);
const qlon = (lon) => Math.round((lon - ORIGEM[1]) / Q);

// Projeção local para medir em metros.
const LAT0 = (caixa.sul + caixa.norte) / 2;
const KX = (Math.PI / 180) * 6371000 * Math.cos((LAT0 * Math.PI) / 180);
const KY = (Math.PI / 180) * 6371000;
const xy = (n) => [n.lon * KX, n.lat * KY];

/** Douglas–Peucker sobre índices, mantendo os marcados como obrigatórios. */
function simplificar(lista, tolerancia, obrigatorio = () => false) {
  if (lista.length <= 2) return lista;
  const manter = new Uint8Array(lista.length);
  manter[0] = 1;
  manter[lista.length - 1] = 1;
  lista.forEach((n, i) => {
    if (obrigatorio(n)) manter[i] = 1;
  });
  const pilha = [];
  let ini = 0;
  for (let i = 1; i < lista.length; i++) {
    if (manter[i]) {
      pilha.push([ini, i]);
      ini = i;
    }
  }
  while (pilha.length) {
    const [a, b] = pilha.pop();
    if (b - a < 2) continue;
    const [ax, ay] = xy(lista[a]);
    const [bx, by] = xy(lista[b]);
    let maior = -1;
    let qual = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = xy(lista[i]);
      const dx = bx - ax;
      const dy = by - ay;
      const c2 = dx * dx + dy * dy;
      const t = c2 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / c2)) : 0;
      const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      if (d > maior) {
        maior = d;
        qual = i;
      }
    }
    if (maior > tolerancia) {
      manter[qual] = 1;
      pilha.push([a, qual], [qual, b]);
    }
  }
  return lista.filter((_, i) => manter[i]);
}

const nosDe = (via) => via.nodes.map((id) => nos.get(id)).filter(Boolean);
const dentroDaCaixa = (n) => n.lat >= caixa.sul && n.lat <= caixa.norte && n.lon >= caixa.oeste && n.lon <= caixa.leste;

// ------------------------------------------------------------------ ruas
const CLASSE = {
  motorway: 'rodovia', motorway_link: 'rodovia', trunk: 'rodovia', trunk_link: 'rodovia',
  primary: 'avenida', primary_link: 'avenida', secondary: 'avenida', secondary_link: 'avenida',
  tertiary: 'coletora', tertiary_link: 'coletora', unclassified: 'coletora',
  residential: 'rua', living_street: 'rua', road: 'rua',
  service: 'servico',
  footway: 'caminho', path: 'caminho', pedestrian: 'caminho', steps: 'caminho', cycleway: 'caminho', track: 'caminho', bridleway: 'caminho',
};
const indiceClasse = Object.fromEntries(CLASSES.map((c, i) => [c.id, i]));

const ruas = [];
for (const v of vias.values()) {
  const t = v.tags || {};
  const classe = CLASSE[t.highway];
  if (!classe || t.area === 'yes') continue;
  if (t.highway === 'service' && ['parking_aisle', 'driveway', 'drive-through'].includes(t.service)) continue;
  if (t.highway === 'footway' && ['sidewalk', 'crossing'].includes(t.footway)) continue;
  const lista = nosDe(v);
  if (lista.length < 2 || !lista.some(dentroDaCaixa)) continue;
  const nome = t.name || (classe === 'rodovia' && t.ref ? t.ref : '');
  ruas.push({ classe: indiceClasse[classe], nome, lista });
}

// Nós usados por mais de uma rua (ou duas vezes na mesma) são cruzamentos: nunca somem.
const usos = new Map();
for (const r of ruas) for (const n of r.lista) usos.set(n.id, (usos.get(n.id) || 0) + 1);
for (const r of ruas) r.lista = simplificar(r.lista, 2, (n) => usos.get(n.id) > 1);

// Ordem espacial (faixas de ~500 m) para as diferenças entre nós vizinhos ficarem pequenas.
const centro = (lista) => lista.reduce((a, n) => [a[0] + n.lat / lista.length, a[1] + n.lon / lista.length], [0, 0]);
ruas.forEach((r) => (r.centro = centro(r.lista)));
ruas.sort((a, b) => Math.floor(a.centro[0] / 0.005) - Math.floor(b.centro[0] / 0.005) || a.centro[1] - b.centro[1]);

const nomes = [];
const idNome = new Map();
function nomeIdx(nome) {
  if (!nome) return 0;
  if (!idNome.has(nome)) {
    nomes.push(nome);
    idNome.set(nome, nomes.length);
  }
  return idNome.get(nome);
}

const indiceNo = new Map();
const listaNos = [];
const viasSaida = [];
for (const r of ruas) {
  const idx = r.lista.map((n) => {
    if (!indiceNo.has(n.id)) {
      indiceNo.set(n.id, listaNos.length);
      listaNos.push(n);
    }
    return indiceNo.get(n.id);
  });
  viasSaida.push(r.classe, nomeIdx(r.nome), idx.length);
  let ant = 0;
  for (const i of idx) {
    viasSaida.push(i - ant);
    ant = i;
  }
}
const nosSaida = [];
{
  let a = 0;
  let b = 0;
  for (const n of listaNos) {
    const la = qlat(n.lat);
    const lo = qlon(n.lon);
    nosSaida.push(la - a, lo - b);
    a = la;
    b = lo;
  }
}

// ------------------------------------------------------------------ formas
function forma(lista, tolerancia) {
  const s = simplificar(lista, tolerancia);
  const out = [s.length];
  let a = 0;
  let b = 0;
  for (const n of s) {
    const la = qlat(n.lat);
    const lo = qlon(n.lon);
    out.push(la - a, lo - b);
    a = la;
    b = lo;
  }
  return out;
}

function areaM2(lista) {
  let s = 0;
  for (let i = 0, j = lista.length - 1; i < lista.length; j = i++) {
    const [xi, yi] = xy(lista[i]);
    const [xj, yj] = xy(lista[j]);
    s += xj * yi - xi * yj;
  }
  return Math.abs(s / 2);
}

/** Junta as vias de uma relação em anéis fechados. */
function aneis(membros) {
  const pedacos = membros.map((m) => vias.get(m.ref)).filter(Boolean).map((v) => v.nodes.slice());
  const resultado = [];
  while (pedacos.length) {
    let anel = pedacos.shift();
    let mudou = true;
    while (anel[0] !== anel[anel.length - 1] && mudou) {
      mudou = false;
      for (let i = 0; i < pedacos.length; i++) {
        const p = pedacos[i];
        const fim = anel[anel.length - 1];
        if (p[0] === fim) anel = anel.concat(p.slice(1));
        else if (p[p.length - 1] === fim) anel = anel.concat(p.slice().reverse().slice(1));
        else continue;
        pedacos.splice(i, 1);
        mudou = true;
        break;
      }
    }
    const lista = anel.map((id) => nos.get(id)).filter(Boolean);
    if (lista.length >= 4) resultado.push(lista);
  }
  return resultado;
}

const linhasAgua = [];
const linhasFerro = [];
const areasAgua = [];
const areasVerdes = [];
const viasDeRelacaoAgua = new Set();
for (const r of relacoes.values()) {
  const t = r.tags || {};
  if (t.type === 'multipolygon' && (t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin')) {
    for (const a of aneis(r.members.filter((m) => m.type === 'way' && m.role === 'outer'))) areasAgua.push(...forma(a, 3));
    for (const m of r.members) viasDeRelacaoAgua.add(m.ref);
  }
}
for (const v of vias.values()) {
  const t = v.tags || {};
  const lista = nosDe(v);
  if (lista.length < 2 || !lista.some(dentroDaCaixa)) continue;
  if (['river', 'stream', 'canal', 'drain', 'ditch'].includes(t.waterway)) linhasAgua.push(nomeIdx(t.name || ''), ...forma(lista, 3));
  else if (t.railway === 'rail') linhasFerro.push(...forma(lista, 3));
  else if ((t.natural === 'water' || t.landuse === 'reservoir' || t.landuse === 'basin') && !viasDeRelacaoAgua.has(v.id) && lista.length >= 4) areasAgua.push(...forma(lista, 3));
  else if ((t.leisure === 'park' || t.leisure === 'nature_reserve') && lista.length >= 4) areasVerdes.push(...forma(lista, 4));
  else if ((t.natural === 'wood' || t.landuse === 'forest') && lista.length >= 4 && areaM2(lista) >= 5000) areasVerdes.push(...forma(lista, 6));
}

const limiteRel = limiteOSM.find((e) => e.type === 'relation');
const limiteSaida = [];
{
  const viasLimite = new Map(limiteOSM.filter((e) => e.type === 'way').map((w) => [w.id, w]));
  for (const [id, w] of viasLimite) if (!vias.has(id)) vias.set(id, w);
  for (const a of aneis(limiteRel.members.filter((m) => m.type === 'way' && m.role === 'outer'))) limiteSaida.push(...forma(a, 5));
}

// ------------------------------------------------------------------ locais
function classificar(t) {
  const a = t.amenity;
  const s = t.shop;
  const h = t.healthcare;
  const m = t.man_made;
  if (a === 'pharmacy' || h === 'pharmacy' || s === 'chemist') return ['remedio', 'farmacia'];
  if (a === 'hospital' || h === 'hospital') return ['remedio', 'hospital'];
  if (['clinic', 'doctors', 'dentist'].includes(a) || ['clinic', 'doctor', 'centre', 'dentist'].includes(h)) return ['remedio', 'posto'];
  if (['supermarket', 'convenience', 'greengrocer', 'butcher', 'bakery', 'deli', 'general', 'beverages', 'wholesale', 'frozen_food', 'variety_store'].includes(s)) return ['alimento', 'mercado'];
  if (a === 'marketplace') return ['alimento', 'feira'];
  if (a === 'drinking_water' || a === 'water_point' || m === 'water_tap') return ['agua', 'torneira'];
  if (t.natural === 'spring') return ['agua', 'nascente'];
  if (m === 'water_well') return ['agua', 'poco'];
  if (m === 'water_tower' || m === 'reservoir_covered' || (m === 'storage_tank' && t.content === 'water')) return ['agua', 'cisterna'];
  if (a === 'place_of_worship' || (['church', 'chapel', 'cathedral', 'temple'].includes(t.building) && t.name)) return ['abrigo', 'igreja'];
  if (['school', 'kindergarten', 'college', 'university'].includes(a)) return ['abrigo', 'escola'];
  if (['community_centre', 'social_facility', 'social_centre'].includes(a)) return ['abrigo', 'casa_apoio'];
  if (s === 'gas') return ['material', 'gas'];
  if (a === 'fuel') return ['material', 'combustivel'];
  if (['hardware', 'doityourself', 'trade'].includes(s)) return ['material', 'ferragens'];
  return null;
}

const locais = [];
/** Repartições do governo e de segurança ficam fora: no cenário do app não há Estado para chamar. */
const ORGAOS = /\b(prefeitura|secretaria|pol[ií]cia|guarda (civil )?municipal|conselho tutelar|delegacia|bombeiros?|samu|defesa civil|f[óo]rum|cart[óo]rio|inss|receita federal|cras|creas|poupatempo|tribunal|c[âa]mara municipal|ex[ée]rcito|quartel)\b/i;

function adicionarLocal(t, lat, lon) {
  const c = classificar(t);
  if (!c || !(lat >= caixa.sul && lat <= caixa.norte && lon >= caixa.oeste && lon <= caixa.leste)) return;
  const [categoria, tipo] = c;
  const nome = (t.name || '').trim().slice(0, 80);
  if (ORGAOS.test(nome)) return;
  const dup = locais.find((l) => l.categoria === categoria && l.tipo === tipo && l.nome === nome && Math.hypot((l.lat - lat) * KY, (l.lon - lon) * KX) < 60);
  if (dup) return;
  locais.push({ categoria, tipo, nome, lat, lon });
}
for (const n of nos.values()) if (n.tags) adicionarLocal(n.tags, n.lat, n.lon);
for (const v of vias.values()) {
  if (!v.tags || v.tags.highway) continue;
  const lista = nosDe(v);
  if (!lista.length) continue;
  const [lat, lon] = centro(lista);
  adicionarLocal(v.tags, lat, lon);
}
// ------------------------------------------------------- locais da Overture Maps
// O OpenStreetMap tem poucos estabelecimentos em Hortolândia; a Overture Maps
// (baixada por scripts/baixar-locais-overture.py) completa igrejas, mercados,
// farmácias, saúde, escolas, gás, água e combustível. Só entram registros com
// confiança de pelo menos 0,5, com nome, abertos e que não repetem o OSM.
const CONFIANCA_MINIMA = 0.5;
const arqOverture = path.join(CACHE, 'overture.json');
let versaoOverture = null;
const contagemOverture = { lidos: 0, usados: 0, repetidos: 0 };

const semAcento = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'a', 'o', 'igreja', 'supermercado', 'mercado', 'farmacia', 'drogaria', 'posto', 'escola', 'ltda', 'me', 'eireli']);
const palavras = (s) => new Set(semAcento(s).split(/[^a-z0-9]+/).filter((p) => p.length > 1 && !PALAVRAS_VAZIAS.has(p)));
function nomesParecidos(a, b) {
  const pa = palavras(a);
  const pb = palavras(b);
  if (!pa.size || !pb.size) return semAcento(a) === semAcento(b);
  let comuns = 0;
  for (const p of pa) if (pb.has(p)) comuns++;
  return comuns / Math.min(pa.size, pb.size) >= 0.5;
}

/** "IGREJA BATISTA CENTRAL" → "Igreja Batista Central". */
function arrumarNome(nome) {
  const n = String(nome || '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (n.length < 5 || n !== n.toUpperCase()) return n;
  return n
    .toLowerCase()
    .split(' ')
    .map((p, i) => (i && ['de', 'da', 'do', 'das', 'dos', 'e'].includes(p) ? p : p.charAt(0).toUpperCase() + p.slice(1)))
    .join(' ');
}

function classificarOverture(o) {
  const c = o.categoria || '';
  const nome = o.nome || '';
  const VENDE_GAS = ['chemical_plant', 'manufacturer', 'shopping', 'food_beverage_distributor', 'professional_service', 'home_service', 'propane_supplier', 'supplier_or_distributor', 'bottled_water_company', ''];
  if (/\bg[áa]s\b|ultragaz|liquig[áa]s|supergasbras|consigaz|copagaz/i.test(nome) && VENDE_GAS.includes(c)) return ['material', 'gas'];
  if (c === 'bottled_water_company' || (/disk [áa]gua|[áa]gua mineral|distribuidora de [áa]gua/i.test(nome) && !c.includes('worship') && !c.includes('restaurant'))) return ['agua', 'distribuicao'];
  if (c.endsWith('place_of_worship') || c === 'religious_organization' || c === 'church_cathedral') return ['abrigo', 'igreja'];
  if (['grocery_store', 'supermarket', 'convenience_store', 'bakery', 'butcher_shop', 'produce_store', 'warehouse_club_store', 'wholesale_grocer', 'meat_wholesaler', 'organic_grocery_store', 'specialty_foods_store', 'food_and_beverage_store', 'health_food_store', 'fruits_and_vegetables'].includes(c)) return ['alimento', 'mercado'];
  if (['farmers_market', 'night_market', 'public_market'].includes(c)) return ['alimento', 'feira'];
  if (['pharmacy', 'drugstore', 'medical_supply_store'].includes(c)) return ['remedio', 'farmacia'];
  // UBS e Saúde da Família vêm como "hospital" na Overture: são postos de saúde.
  if (['hospital', 'emergency_department', 'emergency_room'].includes(c)) return /\b(ubs|psf|sa[úu]de da fam[ií]lia|unidade b[áa]sica|centro de sa[úu]de)\b/i.test(nome) ? ['remedio', 'posto'] : ['remedio', 'hospital'];
  if (['health_care', 'doctors_office', 'medical_service_organization', 'urgent_care_clinic', 'pediatric_clinic', 'dental_clinic', 'general_dentistry', 'pediatric_dentistry', 'medical_center', 'community_health_center', 'family_practice'].includes(c)) return ['remedio', 'posto'];
  if (['school', 'elementary_school', 'public_school', 'high_school', 'middle_school', 'private_school', 'preschool', 'day_care_preschool', 'college_university', 'vocational_and_technical_school'].includes(c)) return ['abrigo', 'escola'];
  if (['social_or_community_service', 'community_center'].includes(c)) return ['abrigo', 'casa_apoio'];
  if (c === 'gas_station') return ['material', 'combustivel'];
  if (['hardware_store', 'building_supply_store', 'home_improvement_store', 'hardware_home_and_garden_store'].includes(c)) return ['material', 'ferragens'];
  return null;
}

if (fs.existsSync(arqOverture)) {
  const ov = JSON.parse(fs.readFileSync(arqOverture, 'utf8'));
  versaoOverture = ov.release;
  const doOSM = locais.slice();
  const candidatos = ov.locais
    .filter((o) => (o.confianca || 0) >= CONFIANCA_MINIMA && o.nome && !/closed/.test(o.situacao || '') && !ORGAOS.test(o.nome))
    .sort((a, b) => b.confianca - a.confianca);
  contagemOverture.lidos = ov.locais.length;
  for (const o of candidatos) {
    const c = classificarOverture(o);
    if (!c) continue;
    const [categoria, tipo] = c;
    const nome = arrumarNome(o.nome);
    const dist = (l) => Math.hypot((l.lat - o.lat) * KY, (l.lon - o.lon) * KX);
    const repetido = locais.some((l) => l.tipo === tipo && l.categoria === categoria && (dist(l) < 25 || (dist(l) < 80 && nomesParecidos(l.nome, nome))));
    if (repetido) {
      if (doOSM.some((l) => l.tipo === tipo && dist(l) < 80)) contagemOverture.repetidos++;
      continue;
    }
    locais.push({ categoria, tipo, nome, lat: o.lat, lon: o.lon, overture: true });
    contagemOverture.usados++;
  }
}

locais.sort((a, b) => ORDEM_CATEGORIAS.indexOf(a.categoria) - ORDEM_CATEGORIAS.indexOf(b.categoria) || a.lat - b.lat);
// [categoria, tipo, nome, lat, lon, fonte] — fonte 1 = Overture Maps; sem o 6º item = OpenStreetMap.
const locaisSaida = locais.map((l) => {
  const linha = [ORDEM_CATEGORIAS.indexOf(l.categoria), Object.keys(CATEGORIAS[l.categoria].tipos).indexOf(l.tipo), l.nome, qlat(l.lat), qlon(l.lon)];
  if (l.overture) linha.push(1);
  return linha;
});

// ------------------------------------------------------------------ bairros
const bairros = [];
function adicionarBairro(nome, lat, lon) {
  if (!nome || !(lat >= caixa.sul && lat <= caixa.norte && lon >= caixa.oeste && lon <= caixa.leste)) return;
  if (bairros.some((b) => b.nome === nome && Math.hypot((b.lat - lat) * KY, (b.lon - lon) * KX) < 800)) return;
  bairros.push({ nome: nome.trim().slice(0, 60), lat, lon });
}
const LUGARES = ['suburb', 'quarter', 'neighbourhood', 'village', 'hamlet', 'square'];
for (const n of nos.values()) if (n.tags && LUGARES.includes(n.tags.place)) adicionarBairro(n.tags.name, n.lat, n.lon);
for (const v of vias.values()) {
  if (!v.tags || !LUGARES.includes(v.tags.place)) continue;
  const lista = nosDe(v);
  if (lista.length) adicionarBairro(v.tags.name, ...centro(lista));
}
bairros.sort((a, b) => a.lat - b.lat);
const bairrosSaida = bairros.map((b) => [b.nome, qlat(b.lat), qlon(b.lon)]);

// ------------------------------------------------------------------ saída
const data = new Date(dataMaisRecente || Date.now()).toISOString().slice(0, 10);
const dados = {
  v: 1,
  nome: limiteRel.tags.name,
  uf: 'SP',
  fonte: versaoOverture
    ? 'Ruas e mapa: © colaboradores do OpenStreetMap (licença ODbL). Estabelecimentos: OpenStreetMap e © Overture Maps Foundation (CDLA-Permissive-2.0)'
    : '© colaboradores do OpenStreetMap — dados sob a licença ODbL (openstreetmap.org/copyright)',
  overture: versaoOverture,
  data,
  q: Q,
  o: ORIGEM,
  caixa: caixaSaida,
  nomes,
  nos: nosSaida,
  vias: viasSaida,
  linhas: { agua: linhasAgua, ferrovia: linhasFerro },
  areas: { agua: areasAgua, verde: areasVerdes },
  limite: limiteSaida,
  locais: locaisSaida,
  bairros: bairrosSaida,
};

const texto = `/**
 * Mapa de ${dados.nome} (SP) para uso sem internet: ruas, rios, áreas verdes, limite do
 * município e locais úteis. Gerado por scripts/gerar-mapa-cidade.js em ${data}.
 *
 * Dados ${dados.fonte}. Este arquivo é uma base de dados derivada do OpenStreetMap e
 * está disponível sob a mesma licença ODbL (veja dados/LICENCA-MAPA.md).
 */
(function (raiz, dados) {
  if (typeof module === 'object' && module.exports) module.exports = dados;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).dadosMapaCidade = dados;
})(typeof globalThis !== 'undefined' ? globalThis : this, ${JSON.stringify(dados)});
`;
fs.mkdirSync(path.dirname(SAIDA), { recursive: true });
fs.writeFileSync(SAIDA, texto);

const porCategoria = {};
for (const l of locais) porCategoria[`${l.categoria}/${l.tipo}`] = (porCategoria[`${l.categoria}/${l.tipo}`] || 0) + 1;
console.log(`${path.relative(process.cwd(), SAIDA)}: ${(Buffer.byteLength(texto) / 1024).toFixed(0)} KB`);
console.log(`  ${ruas.length} ruas, ${listaNos.length} nós, ${nomes.length} nomes, ${bairros.length} bairros, ${locais.length} locais`, porCategoria);
if (versaoOverture) console.log(`  Overture ${versaoOverture}: ${contagemOverture.usados} locais novos de ${contagemOverture.lidos} (${contagemOverture.repetidos} já estavam no OpenStreetMap)`);
