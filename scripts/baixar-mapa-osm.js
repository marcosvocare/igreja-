#!/usr/bin/env node
/**
 * Baixa do OpenStreetMap os dados da área de Hortolândia (com margem), em
 * pedaços, pela API oficial (api.openstreetmap.org). Só precisa ser rodado
 * para atualizar o mapa; o app usa o arquivo gerado por gerar-mapa-cidade.js.
 *
 * - Pedaços de 0,03° (~3 km); se a API recusar por excesso de pontos, divide em 4.
 * - Pausa entre pedidos e identificação do programa, como pede a política de uso.
 * - Guarda cada pedaço em .cache-osm/ (fora do git) e não baixa de novo o que já tem.
 *
 * Dados © colaboradores do OpenStreetMap, licença ODbL (openstreetmap.org/copyright).
 *
 * Uso: node scripts/baixar-mapa-osm.js [--cache pasta]
 *      (atrás de um proxy: NODE_USE_ENV_PROXY=1 node scripts/baixar-mapa-osm.js)
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const iCache = args.indexOf('--cache');
const CACHE = iCache >= 0 ? path.resolve(args[iCache + 1]) : path.join(RAIZ, '.cache-osm');

const RELACAO = 298407; // Hortolândia (admin_level 8)
const MARGEM = 0.008; // ~800 m além do limite do município
const PEDACO = 0.03;
const PAUSA_MS = 1500;
const AGENTE = 'sobrevivencia-urbana-mapa/1.0 (+https://github.com/marcosvocare/igreja-)';

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function baixar(url) {
  // fetch do Node: atrás de um proxy, rode com NODE_USE_ENV_PROXY=1 (Node 22.21+).
  const res = await fetch(url, { headers: { 'User-Agent': AGENTE }, signal: AbortSignal.timeout(180000) });
  return { status: res.status, corpo: await res.text() };
}

async function baixarComTentativas(url) {
  for (let tentativa = 1; ; tentativa++) {
    try {
      const r = await baixar(url);
      if (r.status === 509 || r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      return r;
    } catch (e) {
      if (tentativa >= 4) throw e;
      console.warn(`  falhou (${e.message}); nova tentativa em ${tentativa * 10} s`);
      await esperar(tentativa * 10000);
    }
  }
}

async function main() {
  fs.mkdirSync(CACHE, { recursive: true });
  const arqLimite = path.join(CACHE, 'limite.json');
  if (!fs.existsSync(arqLimite)) {
    const r = await baixarComTentativas(`https://api.openstreetmap.org/api/0.6/relation/${RELACAO}/full.json`);
    if (r.status !== 200) throw new Error(`limite: HTTP ${r.status}`);
    fs.writeFileSync(arqLimite, r.corpo);
    await esperar(PAUSA_MS);
  }
  const limite = JSON.parse(fs.readFileSync(arqLimite, 'utf8'));
  const nos = limite.elements.filter((e) => e.type === 'node');
  const caixa = {
    sul: Math.min(...nos.map((n) => n.lat)) - MARGEM,
    norte: Math.max(...nos.map((n) => n.lat)) + MARGEM,
    oeste: Math.min(...nos.map((n) => n.lon)) - MARGEM,
    leste: Math.max(...nos.map((n) => n.lon)) + MARGEM,
  };
  fs.writeFileSync(path.join(CACHE, 'caixa.json'), JSON.stringify(caixa));
  console.log('Área:', caixa);

  const fila = [];
  for (let lat = caixa.sul; lat < caixa.norte; lat += PEDACO) {
    for (let lon = caixa.oeste; lon < caixa.leste; lon += PEDACO) {
      fila.push([lon, lat, Math.min(lon + PEDACO, caixa.leste), Math.min(lat + PEDACO, caixa.norte)]);
    }
  }
  let feitos = 0;
  while (fila.length) {
    const [o, s, l, n] = fila.shift();
    const nome = [o, s, l, n].map((x) => x.toFixed(5)).join('_');
    const arq = path.join(CACHE, `pedaco_${nome}.json`);
    if (fs.existsSync(arq)) continue;
    const r = await baixarComTentativas(`https://api.openstreetmap.org/api/0.6/map.json?bbox=${o.toFixed(5)},${s.toFixed(5)},${l.toFixed(5)},${n.toFixed(5)}`);
    await esperar(PAUSA_MS);
    if (r.status === 400) {
      // Pontos demais: divide em quatro.
      const ml = (o + l) / 2;
      const mn = (s + n) / 2;
      fila.unshift([o, s, ml, mn], [ml, s, l, mn], [o, mn, ml, n], [ml, mn, l, n]);
      console.log(`  pedaço grande demais, dividido: ${nome}`);
      continue;
    }
    if (r.status !== 200) throw new Error(`HTTP ${r.status} em ${nome}: ${r.corpo.slice(0, 200)}`);
    fs.writeFileSync(arq, r.corpo);
    feitos++;
    console.log(`  ${feitos} pedaço(s) baixado(s); faltam ${fila.length}; ${(r.corpo.length / 1e6).toFixed(1)} MB`);
  }
  console.log('Pronto. Agora rode: node scripts/gerar-mapa-cidade.js');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
