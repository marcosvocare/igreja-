/**
 * Mecanismo: Mapa da cidade sem internet (ruas, rios, pontos úteis).
 *
 * Lê o arquivo compacto gerado a partir do OpenStreetMap (dados/mapa-*.js) e
 * oferece: projeção em metros, rua mais próxima de um ponto, busca de ruas e
 * locais sem depender de acento, quadrículas de 1 km para dizer onde se está
 * pelo rádio ("estou na F7") e rota a pé pelas ruas que desvia das zonas de
 * perigo marcadas, com instruções de virada.
 *
 * Formato dos dados (versão 1): coordenadas quantizadas (q graus) a partir de
 * uma origem, em pares [lat, lon] com diferenças acumuladas; ruas como listas de
 * índices de nós (compartilhados nos cruzamentos, o que permite calcular rotas).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cartografia = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RAD = Math.PI / 180;
  const RAIO_TERRA = 6371000;

  /** Classes de via, da maior para a menor. fatorRota encarece a via na rota a pé. */
  const CLASSES = [
    { id: 'rodovia', rotulo: 'Rodovia', fatorRota: 2.5 },
    { id: 'avenida', rotulo: 'Avenida', fatorRota: 1 },
    { id: 'coletora', rotulo: 'Rua principal', fatorRota: 1 },
    { id: 'rua', rotulo: 'Rua', fatorRota: 1 },
    { id: 'servico', rotulo: 'Acesso', fatorRota: 1.2 },
    { id: 'caminho', rotulo: 'Caminho a pé', fatorRota: 1.1 },
  ];

  /** Locais trazidos do mapa. As chaves de tipo coincidem com as do mapa de recursos quando existem. */
  const CATEGORIAS = {
    remedio: { rotulo: 'Saúde e remédios', tipos: { farmacia: 'Farmácia', hospital: 'Hospital', posto: 'Posto de saúde ou clínica' } },
    alimento: { rotulo: 'Alimentos', tipos: { mercado: 'Mercado ou mercearia', feira: 'Feira' } },
    agua: { rotulo: 'Água', tipos: { torneira: 'Bebedouro ou torneira', nascente: 'Nascente ou mina', poco: 'Poço', cisterna: "Caixa d'água ou reservatório" } },
    abrigo: { rotulo: 'Abrigo e apoio', tipos: { igreja: 'Igreja', escola: 'Escola', casa_apoio: 'Centro comunitário' } },
    material: { rotulo: 'Gás, combustível e ferragens', tipos: { gas: 'Revenda de gás', combustivel: 'Posto de combustível', ferragens: 'Ferragens e construção' } },
  };
  const ORDEM_CATEGORIAS = Object.keys(CATEGORIAS);

  const QUADRICULA_M = 1000;
  const VELOCIDADE_A_PE_KMH = 4;
  const FATOR_DENTRO_PERIGO = 10; // atravessar uma zona de perigo
  const FATOR_BLOQUEIO = 100; // rua bloqueada: só se não houver outro jeito
  const FATOR_PERTO_PERIGO = 2; // passar a menos de MARGEM_PERIGO da zona
  const MARGEM_PERIGO = 100;
  const RAIO_PERIGO_PADRAO = 150;

  function semAcento(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase();
  }

  /** Abreviações comuns na busca: "r." → rua, "av" → avenida, "pca" → praça… */
  function normalizarBusca(texto) {
    return semAcento(texto)
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map((t) => ({ r: 'rua', av: 'avenida', avda: 'avenida', pca: 'praca', pc: 'praca', rod: 'rodovia', est: 'estrada', jd: 'jardim', vl: 'vila', pq: 'parque', sta: 'santa', sto: 'santo', dr: 'doutor', prof: 'professor' })[t] || t);
  }

  function letrasColuna(i) {
    let s = '';
    let n = i;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }

  function distanciaPontoSegmento(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const c2 = dx * dx + dy * dy;
    const t = c2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / c2));
    return { d: Math.hypot(px - (ax + t * dx), py - (ay + t * dy)), t };
  }

  /** Rumo (0 = norte, 90 = leste) de um deslocamento em metros com y para baixo (sul). */
  function rumoXY(dx, dy) {
    const g = Math.atan2(dx, -dy) / RAD;
    return g < 0 ? g + 360 : g;
  }

  const NOMES_RUMO = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];
  const nomeRumo = (g) => NOMES_RUMO[Math.round(g / 45) % 8];

  /** Fila de prioridade (heap binário) de índices com custo. */
  function criarHeap() {
    const ids = [];
    const custos = [];
    return {
      get tamanho() {
        return ids.length;
      },
      inserir(id, custo) {
        let i = ids.length;
        ids.push(id);
        custos.push(custo);
        while (i > 0) {
          const p = (i - 1) >> 1;
          if (custos[p] <= custo) break;
          ids[i] = ids[p];
          custos[i] = custos[p];
          i = p;
        }
        ids[i] = id;
        custos[i] = custo;
      },
      retirar() {
        const topo = ids[0];
        const custoTopo = custos[0];
        const ultimoId = ids.pop();
        const ultimoCusto = custos.pop();
        if (ids.length) {
          let i = 0;
          for (;;) {
            const e = 2 * i + 1;
            if (e >= ids.length) break;
            const m = e + 1 < ids.length && custos[e + 1] < custos[e] ? e + 1 : e;
            if (custos[m] >= ultimoCusto) break;
            ids[i] = ids[m];
            custos[i] = custos[m];
            i = m;
          }
          ids[i] = ultimoId;
          custos[i] = ultimoCusto;
        }
        return { id: topo, custo: custoTopo };
      },
    };
  }

  /**
   * Monta a cidade a partir dos dados compactos.
   * @param {object} dados conteúdo de dados/mapa-*.js (versão 1)
   */
  function criarCidade(dados) {
    if (!dados || dados.v !== 1) throw new Error('Dados do mapa em formato desconhecido.');
    const q = dados.q;
    const [latO, lonO] = dados.o;
    const caixa = dados.caixa;
    const lat0 = (caixa.sul + caixa.norte) / 2;
    const lon0 = (caixa.oeste + caixa.leste) / 2;
    const kx = RAD * RAIO_TERRA * Math.cos(lat0 * RAD);
    const ky = RAD * RAIO_TERRA;

    const projetar = (lat, lon) => ({ x: (lon - lon0) * kx, y: (lat0 - lat) * ky });
    const desprojetar = (x, y) => ({ lat: lat0 - y / ky, lon: lon0 + x / kx });
    const qx = (qlon) => (lonO + qlon * q - lon0) * kx;
    const qy = (qlat) => (lat0 - (latO + qlat * q)) * ky;

    // Nós (cruzamentos e curvas das ruas).
    const totalNos = dados.nos.length / 2;
    const nx = new Float64Array(totalNos);
    const ny = new Float64Array(totalNos);
    {
      let a = 0;
      let b = 0;
      for (let i = 0; i < totalNos; i++) {
        a += dados.nos[2 * i];
        b += dados.nos[2 * i + 1];
        ny[i] = qy(a);
        nx[i] = qx(b);
      }
    }

    // Ruas.
    const vias = [];
    {
      const f = dados.vias;
      let i = 0;
      while (i < f.length) {
        const classe = f[i];
        const nome = f[i + 1] ? dados.nomes[f[i + 1] - 1] : '';
        const k = f[i + 2];
        const nos = new Int32Array(k);
        let idx = 0;
        for (let j = 0; j < k; j++) {
          idx += f[i + 3 + j];
          nos[j] = idx;
        }
        i += 3 + k;
        let comprimento = 0;
        let x0 = Infinity;
        let y0 = Infinity;
        let x1 = -Infinity;
        let y1 = -Infinity;
        for (let j = 0; j < k; j++) {
          const n = nos[j];
          if (j) comprimento += Math.hypot(nx[n] - nx[nos[j - 1]], ny[n] - ny[nos[j - 1]]);
          x0 = Math.min(x0, nx[n]);
          y0 = Math.min(y0, ny[n]);
          x1 = Math.max(x1, nx[n]);
          y1 = Math.max(y1, ny[n]);
        }
        vias.push({ classe, nome, nos, comprimento, caixa: [x0, y0, x1, y1] });
      }
    }

    /** Linhas e áreas sem rota: [nome?, k, pares…] ou [k, pares…]. */
    function lerFormas(f, comNome) {
      const formas = [];
      let i = 0;
      while (f && i < f.length) {
        const nome = comNome ? (f[i] ? dados.nomes[f[i] - 1] : '') : '';
        if (comNome) i++;
        const k = f[i++];
        const pts = new Float64Array(2 * k);
        let a = 0;
        let b = 0;
        for (let j = 0; j < k; j++) {
          a += f[i + 2 * j];
          b += f[i + 2 * j + 1];
          pts[2 * j] = qx(b);
          pts[2 * j + 1] = qy(a);
        }
        i += 2 * k;
        formas.push({ nome, pontos: pts });
      }
      return formas;
    }

    const rios = lerFormas(dados.linhas && dados.linhas.agua, true);
    const ferrovias = lerFormas(dados.linhas && dados.linhas.ferrovia, false);
    const lagos = lerFormas(dados.areas && dados.areas.agua, false);
    const verdes = lerFormas(dados.areas && dados.areas.verde, false);
    const limite = lerFormas(dados.limite, false);

    const locais = (dados.locais || []).map(([c, t, nome, qlat, qlon], i) => {
      const categoria = ORDEM_CATEGORIAS[c];
      const tipo = Object.keys(CATEGORIAS[categoria].tipos)[t];
      const lat = latO + qlat * q;
      const lon = lonO + qlon * q;
      const p = projetar(lat, lon);
      return { id: `osm${i}`, categoria, tipo, nome: nome || CATEGORIAS[categoria].tipos[tipo], semNome: !nome, lat, lon, x: p.x, y: p.y };
    });

    const bairros = (dados.bairros || []).map(([nome, qlat, qlon]) => {
      const lat = latO + qlat * q;
      const lon = lonO + qlon * q;
      const p = projetar(lat, lon);
      return { nome, lat, lon, x: p.x, y: p.y };
    });

    /** Bairro marcado mais perto (até 1,5 km). */
    function bairroMaisProximo(lat, lon, raioMax = 1500) {
      const p = projetar(lat, lon);
      let melhor = null;
      for (const b of bairros) {
        const d = Math.hypot(b.x - p.x, b.y - p.y);
        if (d <= raioMax && (!melhor || d < melhor.distancia)) melhor = { nome: b.nome, distancia: d };
      }
      return melhor;
    }

    // ------------------------------------------------------- índice espacial
    const CELULA = 200;
    let grade = null;
    function chave(cx, cy) {
      return `${cx},${cy}`;
    }
    function indice() {
      if (grade) return grade;
      grade = new Map();
      vias.forEach((v, iv) => {
        for (let j = 1; j < v.nos.length; j++) {
          const a = v.nos[j - 1];
          const b = v.nos[j];
          const cx0 = Math.floor(Math.min(nx[a], nx[b]) / CELULA);
          const cx1 = Math.floor(Math.max(nx[a], nx[b]) / CELULA);
          const cy0 = Math.floor(Math.min(ny[a], ny[b]) / CELULA);
          const cy1 = Math.floor(Math.max(ny[a], ny[b]) / CELULA);
          for (let cx = cx0; cx <= cx1; cx++) {
            for (let cy = cy0; cy <= cy1; cy++) {
              const k = chave(cx, cy);
              let l = grade.get(k);
              if (!l) grade.set(k, (l = []));
              l.push(iv, j);
            }
          }
        }
      });
      return grade;
    }

    /** Trecho de rua mais próximo de um ponto em metros. */
    function trechoMaisProximo(x, y, raioMax = 400, filtro = null) {
      const g = indice();
      let melhor = null;
      const anel = Math.ceil(raioMax / CELULA);
      const cx = Math.floor(x / CELULA);
      const cy = Math.floor(y / CELULA);
      for (let r = 0; r <= anel; r++) {
        for (let i = cx - r; i <= cx + r; i++) {
          for (let j = cy - r; j <= cy + r; j++) {
            if (Math.max(Math.abs(i - cx), Math.abs(j - cy)) !== r) continue;
            const l = g.get(chave(i, j));
            if (!l) continue;
            for (let k = 0; k < l.length; k += 2) {
              const v = vias[l[k]];
              if (filtro && !filtro(v)) continue;
              const a = v.nos[l[k + 1] - 1];
              const b = v.nos[l[k + 1]];
              const { d, t } = distanciaPontoSegmento(x, y, nx[a], ny[a], nx[b], ny[b]);
              if (d <= raioMax && (!melhor || d < melhor.distancia)) melhor = { via: l[k], seg: l[k + 1], a, b, t, distancia: d };
            }
          }
        }
        // Achou algo mais perto que o anel seguinte pode trazer: para.
        if (melhor && melhor.distancia <= r * CELULA) break;
      }
      return melhor;
    }

    /** Nome da rua mais próxima de uma coordenada. */
    function ruaMaisProxima(lat, lon, raioMax = 300) {
      const p = projetar(lat, lon);
      const comNome = trechoMaisProximo(p.x, p.y, raioMax, (v) => Boolean(v.nome));
      const qualquer = comNome || trechoMaisProximo(p.x, p.y, raioMax);
      if (!qualquer) return null;
      const v = vias[qualquer.via];
      return { nome: v.nome || 'rua sem nome', classe: CLASSES[v.classe].id, distancia: qualquer.distancia };
    }

    // ------------------------------------------------------- quadrículas
    const origemQ = projetar(caixa.norte, caixa.oeste);
    const fimQ = projetar(caixa.sul, caixa.leste);
    const colunas = Math.ceil((fimQ.x - origemQ.x) / QUADRICULA_M);
    const linhas = Math.ceil((fimQ.y - origemQ.y) / QUADRICULA_M);

    function quadranteXY(x, y) {
      const c = Math.floor((x - origemQ.x) / QUADRICULA_M);
      const l = Math.floor((y - origemQ.y) / QUADRICULA_M);
      if (c < 0 || l < 0 || c >= colunas || l >= linhas) return null;
      return `${letrasColuna(c)}${l + 1}`;
    }

    function quadrante(lat, lon) {
      const p = projetar(lat, lon);
      return quadranteXY(p.x, p.y);
    }

    function centroQuadrante(codigo) {
      const m = /^([A-Z]+)(\d+)$/.exec(String(codigo || '').trim().toUpperCase());
      if (!m) return null;
      let c = 0;
      for (const ch of m[1]) c = c * 26 + (ch.charCodeAt(0) - 64);
      c -= 1;
      const l = Number(m[2]) - 1;
      if (c < 0 || l < 0 || c >= colunas || l >= linhas) return null;
      return desprojetar(origemQ.x + (c + 0.5) * QUADRICULA_M, origemQ.y + (l + 0.5) * QUADRICULA_M);
    }

    function dentroDoMunicipio(lat, lon) {
      const p = projetar(lat, lon);
      let dentro = false;
      for (const anel of limite) {
        const pts = anel.pontos;
        for (let i = 0, j = pts.length / 2 - 1; i < pts.length / 2; j = i++) {
          const xi = pts[2 * i];
          const yi = pts[2 * i + 1];
          const xj = pts[2 * j];
          const yj = pts[2 * j + 1];
          if (yi > p.y !== yj > p.y && p.x < ((xj - xi) * (p.y - yi)) / (yj - yi) + xi) dentro = !dentro;
        }
      }
      return dentro;
    }

    function dentroDaArea(lat, lon) {
      return lat >= caixa.sul && lat <= caixa.norte && lon >= caixa.oeste && lon <= caixa.leste;
    }

    /** Descrição de um ponto: rua e bairro mais próximos, quadrícula e se está no município. */
    function descrever(lat, lon) {
      const b = bairroMaisProximo(lat, lon);
      return { rua: ruaMaisProxima(lat, lon), bairro: b ? b.nome : null, quadrante: quadrante(lat, lon), noMunicipio: dentroDoMunicipio(lat, lon), naArea: dentroDaArea(lat, lon) };
    }

    // ------------------------------------------------------- busca
    let indiceBusca = null;
    function montarBusca() {
      if (indiceBusca) return indiceBusca;
      const porNome = new Map();
      vias.forEach((v) => {
        if (!v.nome) return;
        let r = porNome.get(v.nome);
        if (!r) porNome.set(v.nome, (r = { tipo: 'rua', nome: v.nome, classe: v.classe, comprimento: 0, via: v }));
        r.comprimento += v.comprimento;
        if (v.comprimento > r.via.comprimento) r.via = v;
        if (v.classe < r.classe) r.classe = v.classe;
      });
      const itens = [];
      for (const r of porNome.values()) {
        const n = r.via.nos[Math.floor(r.via.nos.length / 2)];
        const c = desprojetar(nx[n], ny[n]);
        itens.push({ tipo: 'rua', nome: r.nome, rotulo: CLASSES[r.classe].rotulo, lat: c.lat, lon: c.lon, peso: r.comprimento, chave: normalizarBusca(r.nome) });
      }
      for (const l of locais) {
        if (l.semNome) continue;
        itens.push({ tipo: 'local', nome: l.nome, rotulo: CATEGORIAS[l.categoria].tipos[l.tipo], categoria: l.categoria, local: l, lat: l.lat, lon: l.lon, peso: 0, chave: normalizarBusca(l.nome) });
      }
      for (const b of bairros) {
        if (itens.some((i) => i.tipo === 'bairro' && i.nome === b.nome)) continue;
        itens.push({ tipo: 'bairro', nome: b.nome, rotulo: 'Bairro', lat: b.lat, lon: b.lon, peso: 0, chave: normalizarBusca(b.nome) });
      }
      for (const r of rios) {
        if (!r.nome || itens.some((i) => i.tipo === 'agua' && i.nome === r.nome)) continue;
        const k = Math.floor(r.pontos.length / 4) * 2;
        const c = desprojetar(r.pontos[k], r.pontos[k + 1]);
        itens.push({ tipo: 'agua', nome: r.nome, rotulo: 'Rio ou córrego', lat: c.lat, lon: c.lon, peso: 0, chave: normalizarBusca(r.nome) });
      }
      indiceBusca = itens;
      return itens;
    }

    /**
     * Busca ruas, locais e rios pelo nome (sem acento; "av", "r.", "jd"… valem).
     * Cada palavra digitada precisa aparecer no nome (do começo de uma palavra).
     */
    function buscar(texto, limite = 12) {
      const termos = normalizarBusca(texto);
      if (!termos.length) return [];
      const achados = [];
      for (const item of montarBusca()) {
        let pontos = 0;
        let ok = true;
        for (const t of termos) {
          const iPal = item.chave.findIndex((p) => p.startsWith(t));
          if (iPal >= 0) pontos += item.chave[iPal] === t ? 3 : 2;
          else if (t.length >= 3 && item.chave.some((p) => p.includes(t))) pontos += 1;
          else {
            ok = false;
            break;
          }
        }
        if (!ok) continue;
        // Termos que são só o tipo ("rua", "avenida") valem menos que o nome próprio.
        achados.push({ item, pontos: pontos - item.chave.length * 0.1 + (item.tipo === 'rua' ? Math.min(1, item.peso / 3000) : 0.5) });
      }
      achados.sort((a, b) => b.pontos - a.pontos || a.item.nome.localeCompare(b.item.nome));
      return achados.slice(0, limite).map(({ item }) => ({ tipo: item.tipo, nome: item.nome, rotulo: item.rotulo, categoria: item.categoria || null, lat: item.lat, lon: item.lon, local: item.local || null }));
    }

    // ------------------------------------------------------- rota a pé
    let grafo = null;
    function montarGrafo() {
      if (grafo) return grafo;
      const grau = new Int32Array(totalNos + 1);
      for (const v of vias) {
        for (let j = 1; j < v.nos.length; j++) {
          if (v.nos[j] === v.nos[j - 1]) continue;
          grau[v.nos[j - 1]]++;
          grau[v.nos[j]]++;
        }
      }
      const inicio = new Int32Array(totalNos + 1);
      for (let i = 0; i < totalNos; i++) inicio[i + 1] = inicio[i] + grau[i];
      const total = inicio[totalNos];
      const destino = new Int32Array(total);
      const comprimento = new Float32Array(total);
      const viaDe = new Int32Array(total);
      const pos = inicio.slice(0, totalNos);
      vias.forEach((v, iv) => {
        for (let j = 1; j < v.nos.length; j++) {
          const a = v.nos[j - 1];
          const b = v.nos[j];
          if (a === b) continue;
          const d = Math.hypot(nx[a] - nx[b], ny[a] - ny[b]);
          destino[pos[a]] = b;
          comprimento[pos[a]] = d;
          viaDe[pos[a]++] = iv;
          destino[pos[b]] = a;
          comprimento[pos[b]] = d;
          viaDe[pos[b]++] = iv;
        }
      });
      grafo = { inicio, destino, comprimento, viaDe };
      return grafo;
    }

    /** Perigos ativos em metros: [{x, y, raio, bloqueio, nome}] */
    function prepararPerigos(perigos) {
      return (perigos || [])
        .filter((p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && p.status !== 'resolvido')
        .map((p) => {
          const c = projetar(p.lat, p.lon);
          return { x: c.x, y: c.y, raio: Number.isFinite(p.raio) && p.raio > 0 ? p.raio : RAIO_PERIGO_PADRAO, bloqueio: p.tipo === 'bloqueio', nome: p.nome || 'Perigo' };
        });
    }

    function fatorPerigo(zonas, ax, ay, bx, by) {
      let f = 1;
      for (const z of zonas) {
        const { d } = distanciaPontoSegmento(z.x, z.y, ax, ay, bx, by);
        if (d <= z.raio) f = Math.max(f, z.bloqueio ? FATOR_BLOQUEIO : FATOR_DENTRO_PERIGO);
        else if (d <= z.raio + MARGEM_PERIGO) f = Math.max(f, FATOR_PERTO_PERIGO);
      }
      return f;
    }

    /**
     * Rota a pé pelas ruas, desviando das zonas de perigo.
     * @param {{lat:number, lon:number}} origem
     * @param {{lat:number, lon:number}} destino
     * @param {{perigos?:Array}} [opcoes] pontos de perigo do mapa de recursos
     * @returns {null | {distancia:number, minutos:number, pontos:Array<{lat,lon}>, passos:Array<{texto:string, distancia:number}>, perigos:string[], pertoDePerigo:string[], aviso:string|null}}
     */
    function rota(origem, destino, { perigos = [] } = {}) {
      const g = montarGrafo();
      const zonas = prepararPerigos(perigos);
      const po = projetar(origem.lat, origem.lon);
      const pd = projetar(destino.lat, destino.lon);
      const to = trechoMaisProximo(po.x, po.y, 600);
      const td = trechoMaisProximo(pd.x, pd.y, 600);
      if (!to || !td) return null;

      const ponta = (tr, px, py) => {
        const v = vias[tr.via];
        const a = v.nos[tr.seg - 1];
        const b = v.nos[tr.seg];
        const segLen = Math.hypot(nx[b] - nx[a], ny[b] - ny[a]);
        const qxp = nx[a] + tr.t * (nx[b] - nx[a]);
        const qyp = ny[a] + tr.t * (ny[b] - ny[a]);
        const fator = CLASSES[v.classe].fatorRota * fatorPerigo(zonas, nx[a], ny[a], nx[b], ny[b]);
        return { a, b, t: tr.t, segLen, fora: Math.hypot(px - qxp, py - qyp), qx: qxp, qy: qyp, fator, via: tr.via };
      };
      const O = ponta(to, po.x, po.y);
      const D = ponta(td, pd.x, pd.y);

      // A*: custo = comprimento × fator da via × fator de perigo; heurística = linha reta.
      const custo = new Float64Array(totalNos).fill(Infinity);
      const anterior = new Int32Array(totalNos).fill(-1);
      const arestaAnterior = new Int32Array(totalNos).fill(-1);
      const fechado = new Uint8Array(totalNos);
      const heap = criarHeap();
      const h = (n) => Math.hypot(nx[n] - D.qx, ny[n] - D.qy);
      const iniciar = (n, c) => {
        if (c < custo[n]) {
          custo[n] = c;
          heap.inserir(n, c + h(n));
        }
      };
      iniciar(O.a, O.t * O.segLen * O.fator);
      iniciar(O.b, (1 - O.t) * O.segLen * O.fator);
      const extraD = new Map([
        [D.a, D.t * D.segLen * D.fator],
        [D.b, (1 - D.t) * D.segLen * D.fator],
      ]);
      let melhor = Infinity;
      let fim = -1;
      // Mesma rua, mesmo trecho: direto.
      if (O.via === D.via && O.a === D.a && O.b === D.b) {
        melhor = Math.abs(O.t - D.t) * O.segLen * O.fator;
        fim = -2;
      }
      while (heap.tamanho) {
        const { id: u, custo: f } = heap.retirar();
        if (f >= melhor) break;
        if (fechado[u]) continue;
        fechado[u] = 1;
        if (extraD.has(u)) {
          const total = custo[u] + extraD.get(u);
          if (total < melhor) {
            melhor = total;
            fim = u;
          }
        }
        for (let e = g.inicio[u]; e < g.inicio[u + 1]; e++) {
          const w = g.destino[e];
          if (fechado[w]) continue;
          const v = vias[g.viaDe[e]];
          const c = custo[u] + g.comprimento[e] * CLASSES[v.classe].fatorRota * fatorPerigo(zonas, nx[u], ny[u], nx[w], ny[w]);
          if (c < custo[w]) {
            custo[w] = c;
            anterior[w] = u;
            arestaAnterior[w] = e;
            heap.inserir(w, c + h(w));
          }
        }
      }
      if (fim === -1) return null;

      // Caminho em pontos (x, y) com a via de cada trecho.
      const trechos = []; // {x0,y0,x1,y1,via}
      const pts = [];
      if (fim === -2) {
        trechos.push({ x0: O.qx, y0: O.qy, x1: D.qx, y1: D.qy, via: O.via });
      } else {
        const nos = [];
        const arestas = [];
        for (let n = fim; n !== -1; n = anterior[n]) {
          nos.push(n);
          arestas.push(arestaAnterior[n]);
        }
        nos.reverse();
        arestas.reverse();
        const primeiro = nos[0];
        trechos.push({ x0: O.qx, y0: O.qy, x1: nx[primeiro], y1: ny[primeiro], via: O.via });
        for (let i = 1; i < nos.length; i++) trechos.push({ x0: nx[nos[i - 1]], y0: ny[nos[i - 1]], x1: nx[nos[i]], y1: ny[nos[i]], via: g.viaDe[arestas[i]] });
        trechos.push({ x0: nx[fim], y0: ny[fim], x1: D.qx, y1: D.qy, via: D.via });
      }
      const uteis = trechos.filter((t) => Math.hypot(t.x1 - t.x0, t.y1 - t.y0) > 0.5);
      pts.push(desprojetar(po.x, po.y));
      if (uteis.length) pts.push(desprojetar(uteis[0].x0, uteis[0].y0));
      for (const t of uteis) pts.push(desprojetar(t.x1, t.y1));
      pts.push(desprojetar(pd.x, pd.y));

      // Perigos no caminho.
      const atravessa = new Set();
      const perto = new Set();
      for (const t of uteis) {
        for (const z of zonas) {
          const { d } = distanciaPontoSegmento(z.x, z.y, t.x0, t.y0, t.x1, t.y1);
          if (d <= z.raio) atravessa.add(z.nome);
          else if (d <= z.raio + MARGEM_PERIGO) perto.add(z.nome);
        }
      }
      for (const n of atravessa) perto.delete(n);

      // Instruções: agrupa trechos seguidos da mesma rua.
      const grupos = [];
      for (const t of uteis) {
        const v = vias[t.via];
        const nome = v.nome || (CLASSES[v.classe].id === 'caminho' ? 'caminho de pedestres' : 'rua sem nome');
        const d = Math.hypot(t.x1 - t.x0, t.y1 - t.y0);
        const rumo = rumoXY(t.x1 - t.x0, t.y1 - t.y0);
        const ult = grupos[grupos.length - 1];
        if (ult && ult.nome === nome) {
          ult.distancia += d;
          ult.rumoFinal = rumo;
        } else grupos.push({ nome, distancia: d, rumoInicial: rumo, rumoFinal: rumo });
      }
      // Trechos curtos (menos de 25 m, como a ligação entre duas pistas) entram no seguinte;
      // e duas partes seguidas da mesma rua voltam a ser uma só.
      for (let i = grupos.length - 2; i >= 0; i--) {
        if (grupos[i].distancia < 25 && grupos.length > 1) {
          grupos[i + 1].distancia += grupos[i].distancia;
          grupos[i + 1].rumoInicial = grupos[i].rumoInicial;
          grupos.splice(i, 1);
        }
      }
      for (let i = grupos.length - 2; i >= 0; i--) {
        if (grupos[i].nome === grupos[i + 1].nome) {
          grupos[i].distancia += grupos[i + 1].distancia;
          grupos[i].rumoFinal = grupos[i + 1].rumoFinal;
          grupos.splice(i + 1, 1);
        }
      }
      const passos = [];
      const fora = O.fora;
      if (fora > 15) passos.push({ texto: `Vá até a ${grupos.length ? grupos[0].nome : 'rua'} (${Math.round(fora)} m)`, distancia: fora });
      grupos.forEach((gr, i) => {
        const metrosTxt = `${Math.round(gr.distancia)} m`;
        if (i === 0) {
          passos.push({ texto: `Siga pela ${gr.nome} rumo ${nomeRumo(gr.rumoInicial)} por ${metrosTxt}`, distancia: gr.distancia });
          return;
        }
        let giro = gr.rumoInicial - grupos[i - 1].rumoFinal;
        if (giro > 180) giro -= 360;
        if (giro < -180) giro += 360;
        const a = Math.abs(giro);
        const lado = giro > 0 ? 'direita' : 'esquerda';
        const verbo = a < 25 ? 'Continue em frente' : a < 60 ? `Vire levemente à ${lado}` : a < 150 ? `Vire à ${lado}` : 'Volte';
        passos.push({ texto: `${verbo} na ${gr.nome} e siga ${metrosTxt}`, distancia: gr.distancia });
      });
      if (D.fora > 15) passos.push({ texto: `Saia da rua até o destino (${Math.round(D.fora)} m)`, distancia: D.fora });
      passos.push({ texto: 'Chegada', distancia: 0 });

      const distancia = O.fora + D.fora + uteis.reduce((s, t) => s + Math.hypot(t.x1 - t.x0, t.y1 - t.y0), 0);
      return {
        distancia,
        minutos: Math.max(1, Math.round((distancia / 1000 / VELOCIDADE_A_PE_KMH) * 60)),
        pontos: pts,
        passos,
        perigos: [...atravessa],
        pertoDePerigo: [...perto],
        aviso: atravessa.size ? 'Não há caminho pelas ruas sem passar por uma zona de perigo. Vá acompanhado ou espere a situação mudar.' : null,
      };
    }

    /** Escala gráfica: maior número redondo (1, 2, 5 × 10ⁿ m) que cabe em larguraMax pixels. */
    function escala(pixelsPorMetro, larguraMax = 120) {
      const maxM = larguraMax / pixelsPorMetro;
      const p = 10 ** Math.floor(Math.log10(maxM));
      const m = [5, 2, 1].map((f) => f * p).find((v) => v <= maxM) || p;
      return { metros: m, pixels: m * pixelsPorMetro, texto: m >= 1000 ? `${m / 1000} km` : `${m} m` };
    }

    return {
      nome: dados.nome,
      fonte: dados.fonte,
      data: dados.data,
      caixa,
      centro: { lat: lat0, lon: lon0 },
      projetar,
      desprojetar,
      nos: { x: nx, y: ny, total: totalNos },
      vias,
      rios,
      lagos,
      verdes,
      ferrovias,
      limite,
      locais,
      bairros,
      bairroMaisProximo,
      quadricula: { tamanho: QUADRICULA_M, colunas, linhas, origem: origemQ, letra: letrasColuna },
      ruaMaisProxima,
      quadrante,
      quadranteXY,
      centroQuadrante,
      dentroDoMunicipio,
      dentroDaArea,
      descrever,
      buscar,
      rota,
      escala,
    };
  }

  return {
    CLASSES,
    CATEGORIAS,
    ORDEM_CATEGORIAS,
    QUADRICULA_M,
    semAcento,
    normalizarBusca,
    letrasColuna,
    criarCidade,
  };
});
