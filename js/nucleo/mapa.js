/**
 * Mecanismo: Mapa de recursos (água, remédios, alimentos, abrigo) e de perigos.
 *
 * Funciona sem internet: guarda coordenadas, calcula distância e direção a partir
 * da base (casa ou igreja), indica o recurso mais conveniente levando em conta a
 * situação informada, quão recente é a informação e se a rota passa perto de uma
 * zona de perigo.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).mapa = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RAIO_TERRA = 6371000; // metros
  const RAD = Math.PI / 180;

  const CATEGORIAS = {
    agua: {
      rotulo: 'Água',
      tipos: {
        poco: 'Poço',
        nascente: 'Nascente ou mina',
        cisterna: 'Cisterna ou caixa comunitária',
        rio: 'Rio ou córrego',
        chuva: 'Captação de chuva',
        distribuicao: 'Distribuição ou caminhão-pipa',
        torneira: 'Torneira da rede ainda funcionando',
      },
    },
    remedio: {
      rotulo: 'Remédios e saúde',
      tipos: {
        farmacia: 'Farmácia',
        posto: 'Posto de saúde ou clínica',
        hospital: 'Hospital',
        profissional: 'Profissional de saúde da rede',
        estoque_membro: 'Estoque de membro da rede',
      },
    },
    alimento: {
      rotulo: 'Alimentos',
      tipos: {
        mercado: 'Mercado ou mercearia',
        horta: 'Horta comunitária',
        cozinha: 'Cozinha comunitária',
        deposito: 'Depósito da igreja ou da rede',
        feira: 'Feira ou produtor',
        frutiferas: 'Árvores frutíferas',
      },
    },
    abrigo: {
      rotulo: 'Abrigo e apoio',
      tipos: {
        igreja: 'Igreja',
        escola: 'Escola',
        casa_apoio: 'Casa de apoio',
        ponto_encontro: 'Ponto de encontro',
      },
    },
    perigo: {
      rotulo: 'Perigo (evitar)',
      tipos: {
        conflito: 'Conflito, saque ou bloqueio armado',
        alagamento: 'Alagamento',
        desabamento: 'Risco de desabamento',
        incendio: 'Incêndio',
        contaminacao: 'Contaminação',
        bloqueio: 'Rua bloqueada',
      },
    },
  };

  /** fator: quanto a situação "encarece" o recurso na escolha (null = não usar). */
  const STATUS = {
    disponivel: { rotulo: 'Disponível', fator: 1 },
    escasso: { rotulo: 'Escasso', fator: 1.5 },
    desconhecido: { rotulo: 'Não verificado', fator: 2 },
    esgotado: { rotulo: 'Esgotado', fator: null },
    inseguro: { rotulo: 'Inseguro', fator: null },
  };

  const TRATAMENTO_AGUA = {
    poco: 'Ferva ou clore sempre antes de beber.',
    nascente: 'Ferva ou clore sempre antes de beber.',
    cisterna: 'Clore ou ferva se não souber a origem da água.',
    rio: 'Deixe decantar, coe em pano e depois ferva ou clore. Nunca beba direto.',
    chuva: 'Descarte a primeira água que lava o telhado; coe e depois ferva ou clore.',
    distribuicao: 'Clore ao armazenar (2 gotas de água sanitária por litro).',
    torneira: 'Ferva ou clore: a rede pode estar contaminada.',
  };

  const PENALIDADE_ATRAVESSA = 3; // a rota cruza a zona de perigo
  const PENALIDADE_PERTO = 1.5; // a rota passa perto da zona
  const RAIO_PERIGO_PADRAO = 150; // metros
  const FATOR_DESVIO_RUA = 1.3; // ruas não são linha reta
  const VELOCIDADE_A_PE_KMH = 4;

  function temCoordenadas(p) {
    return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon);
  }

  function coordenadaValida(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  /**
   * Lê coordenadas digitadas ou copiadas do Google Maps.
   * Aceita "-23.5505, -46.6333", "-23,5505 -46,6333", "-23,5505; -46,6333"
   * e links com "@lat,lon" ou "?q=lat,lon".
   * @returns {{lat:number, lon:number}|null}
   */
  function lerCoordenadas(texto) {
    let t = String(texto || '').trim();
    try {
      t = decodeURIComponent(t);
    } catch (e) {
      /* mantém o texto original */
    }
    const num = '(-?\\d{1,3}(?:\\.\\d+)?)';
    const padroes = [
      new RegExp(`@${num},\\s*${num}`),
      new RegExp(`[?&](?:q|ll|query|destination)=${num},\\s*${num}`),
      new RegExp(`^${num}\\s*[,;\\s]\\s*${num}$`),
    ];
    for (const re of padroes) {
      const m = re.exec(t);
      if (m) {
        const lat = Number(m[1]);
        const lon = Number(m[2]);
        return coordenadaValida(lat, lon) ? { lat, lon } : null;
      }
    }
    // Vírgula decimal: "-23,5505 -46,6333" ou "-23,5505; -46,6333"
    const m = /^(-?\d{1,3},\d+)\s*[;\s]\s*(-?\d{1,3},\d+)$/.exec(t);
    if (m) {
      const lat = Number(m[1].replace(',', '.'));
      const lon = Number(m[2].replace(',', '.'));
      return coordenadaValida(lat, lon) ? { lat, lon } : null;
    }
    return null;
  }

  /** Distância em metros (fórmula de haversine). */
  function distanciaMetros(a, b) {
    const dLat = (b.lat - a.lat) * RAD;
    const dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * RAIO_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  /** Rumo inicial de a para b, em graus (0 = norte, 90 = leste). */
  function rumoGraus(a, b) {
    const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
    const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }

  const DIRECOES = ['norte', 'nordeste', 'leste', 'sudeste', 'sul', 'sudoeste', 'oeste', 'noroeste'];

  function direcao(graus) {
    return DIRECOES[Math.round(graus / 45) % 8];
  }

  const PASSO_M = 0.75; // passo de um adulto andando normal

  /** Metros a partir de passos contados. */
  function metrosDePassos(passos) {
    const p = Number(passos);
    if (!(p > 0)) throw new RangeError('Informe quantos passos.');
    return p * PASSO_M;
  }

  /**
   * Ponto a uma distância e direção da base, sem internet (ex.: "300 m a nordeste da igreja").
   * @param {{lat:number, lon:number}} base
   * @param {number} metros
   * @param {string|number} direcao nome (norte, nordeste…) ou rumo em graus
   */
  function pontoPorRumo(base, metros, direcao) {
    if (!temCoordenadas(base)) throw new RangeError('Defina a base no mapa primeiro.');
    const d = Number(metros);
    if (!(d > 0 && d <= 100000)) throw new RangeError('Distância de 1 m a 100 km.');
    const graus = typeof direcao === 'number' ? direcao : DIRECOES.indexOf(String(direcao).toLowerCase()) * 45;
    if (!Number.isFinite(graus) || graus < 0) throw new RangeError('Direção inválida.');
    const delta = d / RAIO_TERRA;
    const teta = graus * RAD;
    const lat1 = base.lat * RAD;
    const lon1 = base.lon * RAD;
    const lat2 = Math.asin(Math.sin(lat1) * Math.cos(delta) + Math.cos(lat1) * Math.sin(delta) * Math.cos(teta));
    const lon2 = lon1 + Math.atan2(Math.sin(teta) * Math.sin(delta) * Math.cos(lat1), Math.cos(delta) - Math.sin(lat1) * Math.sin(lat2));
    const r6 = (x) => Math.round(x * 1e6) / 1e6;
    return { lat: r6(lat2 / RAD), lon: r6(lon2 / RAD) };
  }

  /** Posição em metros relativa à base (x para leste, y para norte). Boa para distâncias urbanas. */
  function projetar(base, p) {
    return {
      x: (p.lon - base.lon) * RAD * RAIO_TERRA * Math.cos(base.lat * RAD),
      y: (p.lat - base.lat) * RAD * RAIO_TERRA,
    };
  }

  function distanciaPontoSegmento(p, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const comp2 = dx * dx + dy * dy;
    const t = comp2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / comp2));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }

  /**
   * Zonas de perigo próximas da linha reta entre origem e destino.
   * @param {number} [margem=150] folga em metros além do raio de cada perigo
   * @returns {Array<{zona:object, distancia:number, atravessa:boolean}>}
   */
  function perigosNaRota(origem, destino, perigos, margem = 150) {
    const a = { x: 0, y: 0 };
    const b = projetar(origem, destino);
    const achados = [];
    for (const z of perigos || []) {
      if (!temCoordenadas(z) || z.status === 'resolvido') continue;
      const raio = Number.isFinite(z.raio) && z.raio > 0 ? z.raio : RAIO_PERIGO_PADRAO;
      const distancia = distanciaPontoSegmento(projetar(origem, z), a, b);
      if (distancia <= raio + margem) achados.push({ zona: z, distancia, atravessa: distancia <= raio });
    }
    return achados.sort((x, y) => x.distancia - y.distancia);
  }

  /** Quão recente é a informação sobre o ponto. */
  function frescor(verificadoEm, agora = new Date()) {
    const t = verificadoEm ? new Date(verificadoEm).getTime() : NaN;
    if (!Number.isFinite(t)) return { nivel: 'nunca', rotulo: 'Nunca verificado', horas: null, fator: 2 };
    const horas = Math.max(0, (agora.getTime() - t) / 3600000);
    if (horas <= 6) return { nivel: 'recente', rotulo: 'Verificado há pouco', horas, fator: 1 };
    if (horas <= 24) return { nivel: 'hoje', rotulo: 'Verificado nas últimas 24 h', horas, fator: 1.15 };
    if (horas <= 72) return { nivel: 'antiga', rotulo: 'Informação de 1 a 3 dias', horas, fator: 1.5 };
    return { nivel: 'desatualizada', rotulo: 'Informação desatualizada', horas, fator: 2 };
  }

  /** Minutos de caminhada estimados (com desvio de ruas). */
  function minutosAPe(metros) {
    return Math.max(1, Math.round(((metros * FATOR_DESVIO_RUA) / 1000 / VELOCIDADE_A_PE_KMH) * 60));
  }

  /**
   * Onde buscar um recurso a partir da base.
   * Ordena por um custo = distância × fator da situação × fator de frescor
   * × fator de perigo (3 se a rota atravessa uma zona de perigo, 1,5 se passa perto).
   * @param {Array} pontos todos os pontos do mapa (inclusive perigos)
   * @param {{lat:number, lon:number}} base
   * @param {{categoria:string, agora?:Date, margemPerigo?:number}} opcoes
   */
  function buscarRecursos(pontos, base, { categoria, agora = new Date(), margemPerigo = 150 } = {}) {
    if (!CATEGORIAS[categoria] || categoria === 'perigo') throw new Error(`Categoria inválida: ${categoria}`);
    const lista = pontos || [];
    const perigos = lista.filter((p) => p.categoria === 'perigo');
    const opcoes = [];
    const evitar = [];
    const semLocalizacao = [];

    for (const p of lista.filter((x) => x.categoria === categoria)) {
      const st = STATUS[p.status] || STATUS.desconhecido;
      if (st.fator === null) {
        evitar.push({ ponto: p, motivo: st.rotulo });
        continue;
      }
      if (!temCoordenadas(p) || !temCoordenadas(base)) {
        semLocalizacao.push({ ponto: p });
        continue;
      }
      const distancia = distanciaMetros(base, p);
      const rumo = rumoGraus(base, p);
      const fr = frescor(p.verificadoEm, agora);
      const riscos = perigosNaRota(base, p, perigos, margemPerigo);
      const atravessa = riscos.some((r) => r.atravessa);
      const fatorPerigo = atravessa ? PENALIDADE_ATRAVESSA : riscos.length ? PENALIDADE_PERTO : 1;
      const custo = distancia * st.fator * fr.fator * fatorPerigo;
      opcoes.push({
        ponto: p,
        distancia,
        minutosAPe: minutosAPe(distancia),
        rumo,
        direcao: direcao(rumo),
        frescor: fr,
        perigos: riscos.map((r) => r.zona.nome),
        rotaPerigo: atravessa ? 'atravessa' : riscos.length ? 'perto' : null,
        tratamento: categoria === 'agua' ? TRATAMENTO_AGUA[p.tipo] || TRATAMENTO_AGUA.torneira : null,
        custo,
      });
    }
    opcoes.sort((a, b) => a.custo - b.custo);
    return { recomendado: opcoes[0] || null, opcoes, evitar, semLocalizacao };
  }

  /**
   * Cobertura por categoria: quantos pontos utilizáveis e verificados nas últimas 24 h.
   * Aponta lacunas (categorias sem nenhuma opção confiável).
   */
  function resumoCobertura(pontos, agora = new Date()) {
    const resumo = {};
    for (const cat of Object.keys(CATEGORIAS)) {
      if (cat === 'perigo') continue;
      resumo[cat] = { total: 0, utilizaveis: 0, confiaveis: 0 };
    }
    let perigosAtivos = 0;
    for (const p of pontos || []) {
      if (p.categoria === 'perigo') {
        if (p.status !== 'resolvido') perigosAtivos++;
        continue;
      }
      const r = resumo[p.categoria];
      if (!r) continue;
      r.total++;
      const st = STATUS[p.status] || STATUS.desconhecido;
      if (st.fator !== null) {
        r.utilizaveis++;
        const fr = frescor(p.verificadoEm, agora);
        if ((p.status === 'disponivel' || p.status === 'escasso') && (fr.nivel === 'recente' || fr.nivel === 'hoje')) r.confiaveis++;
      }
    }
    const lacunas = Object.entries(resumo)
      .filter(([cat, r]) => cat !== 'abrigo' && r.confiaveis === 0)
      .map(([cat]) => cat);
    return { porCategoria: resumo, perigosAtivos, lacunas };
  }

  return {
    CATEGORIAS,
    STATUS,
    TRATAMENTO_AGUA,
    lerCoordenadas,
    distanciaMetros,
    rumoGraus,
    direcao,
    DIRECOES,
    PASSO_M,
    metrosDePassos,
    pontoPorRumo,
    projetar,
    perigosNaRota,
    frescor,
    minutosAPe,
    buscarRecursos,
    resumoCobertura,
  };
});
