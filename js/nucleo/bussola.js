/**
 * Mecanismo: Bússola e orientação sem bússola.
 *
 * - Lê o sensor de orientação do celular (Android e iPhone) e corrige o norte
 *   magnético para o norte verdadeiro com a declinação de Hortolândia.
 * - Diz para onde virar para chegar a um ponto (rumo e distância).
 * - Calcula a posição do sol pela data e hora, o que permite achar o norte
 *   sem sensor nenhum (e confere a bússola).
 * - Guarda os métodos clássicos para se orientar sem bússola.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).bussola = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RAD = Math.PI / 180;
  const RAIO_TERRA = 6371000;

  /**
   * Declinação magnética no centro de Hortolândia (-22,858; -47,220), pelo
   * Modelo Magnético Mundial WMM2025: -21,70° em 2025,0, variando -0,063° por ano.
   * Negativa = o norte magnético fica a oeste do norte verdadeiro. Em todo o
   * município a diferença é menor que 0,1°.
   */
  const DECLINACAO = { graus: -21.7, epoca: 2025.0, variacaoAnual: -0.063, local: 'Hortolândia (SP)', modelo: 'WMM2025' };

  /** Centro de Hortolândia, usado quando não há posição do aparelho. */
  const CENTRO = { lat: -22.858, lon: -47.22 };

  const PONTOS_8 = [
    ['N', 'norte'], ['NE', 'nordeste'], ['L', 'leste'], ['SE', 'sudeste'],
    ['S', 'sul'], ['SO', 'sudoeste'], ['O', 'oeste'], ['NO', 'noroeste'],
  ];
  const PONTOS_16 = ['N', 'NNE', 'NE', 'ENE', 'L', 'ESE', 'SE', 'SSE', 'S', 'SSO', 'SO', 'OSO', 'O', 'ONO', 'NO', 'NNO'];

  function normalizar(graus) {
    const g = Number(graus) % 360;
    return g < 0 ? g + 360 : g;
  }

  /** Diferença assinada de a para b, em (-180, 180]: positiva = b está à direita de a. */
  function diferenca(a, b) {
    let d = normalizar(b) - normalizar(a);
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    return d;
  }

  /** Declinação para uma data (ano decimal a partir da data). */
  function declinacaoEm(data = new Date()) {
    const d = data instanceof Date ? data : new Date(data);
    const inicio = Date.UTC(d.getUTCFullYear(), 0, 1);
    const fim = Date.UTC(d.getUTCFullYear() + 1, 0, 1);
    const ano = d.getUTCFullYear() + (d.getTime() - inicio) / (fim - inicio);
    return Math.round((DECLINACAO.graus + (ano - DECLINACAO.epoca) * DECLINACAO.variacaoAnual) * 10) / 10;
  }

  /** Rumo verdadeiro a partir do magnético: verdadeiro = magnético + declinação. */
  function paraVerdadeiro(magnetico, declinacao = DECLINACAO.graus) {
    return normalizar(magnetico + declinacao);
  }

  /** Rumo magnético a partir do verdadeiro (para conferir com uma bússola de agulha). */
  function paraMagnetico(verdadeiro, declinacao = DECLINACAO.graus) {
    return normalizar(verdadeiro - declinacao);
  }

  /**
   * Rumo magnético do topo da tela a partir de um evento de orientação.
   * - iPhone (Safari): webkitCompassHeading já vem em graus a partir do norte magnético.
   * - Android (Chrome): evento "deviceorientationabsolute", alpha anti-horário.
   * Compensa a tela deitada (paisagem). Devolve null se o evento não tiver rumo absoluto.
   * @param {{webkitCompassHeading?:number, alpha?:number|null, absolute?:boolean}} evento
   * @param {number} [anguloTela=0] screen.orientation.angle
   */
  function rumoDoEvento(evento, anguloTela = 0) {
    if (!evento) return null;
    const tela = Number(anguloTela) || 0;
    if (Number.isFinite(evento.webkitCompassHeading)) return normalizar(evento.webkitCompassHeading + tela);
    if (evento.absolute === true && Number.isFinite(evento.alpha)) return normalizar(360 - evento.alpha + tela);
    return null;
  }

  /** Suaviza leituras do sensor pelo caminho mais curto (359° → 1° não dá a volta). */
  function suavizar(anterior, novo, fator = 0.25) {
    if (!Number.isFinite(anterior)) return normalizar(novo);
    return normalizar(anterior + diferenca(anterior, novo) * fator);
  }

  /** "N", "NE"… e o nome por extenso. */
  function pontoCardeal(graus) {
    const [sigla, nome] = PONTOS_8[Math.round(normalizar(graus) / 45) % 8];
    return { sigla, nome };
  }

  function pontoCardeal16(graus) {
    return PONTOS_16[Math.round(normalizar(graus) / 22.5) % 16];
  }

  function distanciaMetros(a, b) {
    const dLat = (b.lat - a.lat) * RAD;
    const dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * RAIO_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function rumoEntre(a, b) {
    const y = Math.sin((b.lon - a.lon) * RAD) * Math.cos(b.lat * RAD);
    const x = Math.cos(a.lat * RAD) * Math.sin(b.lat * RAD) - Math.sin(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lon - a.lon) * RAD);
    return normalizar(Math.atan2(y, x) / RAD);
  }

  /** Texto de quanto virar, a partir da diferença entre para onde se olha e o alvo. */
  function textoVirar(graus) {
    const g = Math.round(Math.abs(graus));
    if (g <= 10) return 'Siga em frente';
    if (g >= 170) return 'Vire para trás';
    return `Vire ${g}° à ${graus > 0 ? 'direita' : 'esquerda'}`;
  }

  /**
   * Como chegar a um destino a partir de onde se está.
   * @param {{lat:number, lon:number}} origem
   * @param {{lat:number, lon:number}} destino
   * @param {number|null} [rumoAtual] para onde o topo do celular aponta (verdadeiro)
   */
  function guiaAte(origem, destino, rumoAtual = null) {
    const distancia = distanciaMetros(origem, destino);
    const rumo = rumoEntre(origem, destino);
    const cardeal = pontoCardeal(rumo);
    const virar = Number.isFinite(rumoAtual) ? diferenca(rumoAtual, rumo) : null;
    return {
      distancia,
      rumo,
      cardeal,
      virar,
      texto: virar === null ? `Siga para ${cardeal.nome} (${Math.round(rumo)}°)` : textoVirar(virar),
      chegou: distancia < 15,
    };
  }

  // ------------------------------------------------------------------ sol

  /**
   * Posição do sol (algoritmo da NOAA, precisão de ~0,5° — suficiente para se orientar).
   * @returns {{azimute:number, elevacao:number, meioDiaSolar:Date, nascer:Date|null, por:Date|null}}
   *   azimute em graus a partir do norte verdadeiro, no sentido horário.
   */
  function posicaoSol(data = new Date(), lat = CENTRO.lat, lon = CENTRO.lon) {
    const t = data instanceof Date ? data : new Date(data);
    const jd = t.getTime() / 86400000 + 2440587.5;
    const sec = (jd - 2451545) / 36525; // séculos julianos desde J2000
    const l0 = normalizar(280.46646 + sec * (36000.76983 + sec * 0.0003032));
    const m = 357.52911 + sec * (35999.05029 - 0.0001537 * sec);
    const e = 0.016708634 - sec * (0.000042037 + 0.0000001267 * sec);
    const c = Math.sin(m * RAD) * (1.914602 - sec * (0.004817 + 0.000014 * sec)) + Math.sin(2 * m * RAD) * (0.019993 - 0.000101 * sec) + Math.sin(3 * m * RAD) * 0.000289;
    const omega = 125.04 - 1934.136 * sec;
    const lambda = l0 + c - 0.00569 - 0.00478 * Math.sin(omega * RAD);
    const eps0 = 23 + (26 + (21.448 - sec * (46.815 + sec * (0.00059 - sec * 0.001813))) / 60) / 60;
    const eps = eps0 + 0.00256 * Math.cos(omega * RAD);
    const decl = Math.asin(Math.sin(eps * RAD) * Math.sin(lambda * RAD)) / RAD;
    const y = Math.tan((eps / 2) * RAD) ** 2;
    const eqTempo =
      (4 / RAD) *
      (y * Math.sin(2 * l0 * RAD) - 2 * e * Math.sin(m * RAD) + 4 * e * y * Math.sin(m * RAD) * Math.cos(2 * l0 * RAD) - 0.5 * y * y * Math.sin(4 * l0 * RAD) - 1.25 * e * e * Math.sin(2 * m * RAD)); // minutos

    const minutosUTC = t.getUTCHours() * 60 + t.getUTCMinutes() + t.getUTCSeconds() / 60;
    const tempoSolar = (((minutosUTC + eqTempo + 4 * lon) % 1440) + 1440) % 1440;
    const anguloHorario = tempoSolar / 4 - 180;
    const cosZen = Math.sin(lat * RAD) * Math.sin(decl * RAD) + Math.cos(lat * RAD) * Math.cos(decl * RAD) * Math.cos(anguloHorario * RAD);
    const zenite = Math.acos(Math.max(-1, Math.min(1, cosZen))) / RAD;
    const elevacao = 90 - zenite;
    const azimute = normalizar(
      Math.atan2(Math.sin(anguloHorario * RAD), Math.cos(anguloHorario * RAD) * Math.sin(lat * RAD) - Math.tan(decl * RAD) * Math.cos(lat * RAD)) / RAD + 180,
    );

    const meiaNoiteUTC = Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
    const meioDiaMin = 720 - 4 * lon - eqTempo; // minutos UTC
    const meioDiaSolar = new Date(meiaNoiteUTC + meioDiaMin * 60000);
    const cosH = Math.cos(90.833 * RAD) / (Math.cos(lat * RAD) * Math.cos(decl * RAD)) - Math.tan(lat * RAD) * Math.tan(decl * RAD);
    let nascer = null;
    let por = null;
    if (Math.abs(cosH) <= 1) {
      const h = Math.acos(cosH) / RAD;
      nascer = new Date(meiaNoiteUTC + (meioDiaMin - 4 * h) * 60000);
      por = new Date(meiaNoiteUTC + (meioDiaMin + 4 * h) * 60000);
    }
    return { azimute, elevacao, declinacaoSolar: decl, meioDiaSolar, nascer, por };
  }

  /**
   * Orientar-se pelo sol, sem sensor: de frente para o sol, para que lado fica o norte.
   * Com o sol muito alto (perto do meio-dia no verão) a direção fica imprecisa.
   */
  function orientarPeloSol(data = new Date(), lat = CENTRO.lat, lon = CENTRO.lon) {
    const sol = posicaoSol(data, lat, lon);
    if (sol.elevacao <= 0) return { sol, possivel: false, texto: 'O sol está abaixo do horizonte. À noite, use o Cruzeiro do Sul.' };
    const norte = diferenca(sol.azimute, 0); // do sol para o norte
    const cardeal = pontoCardeal(sol.azimute);
    const alto = sol.elevacao > 75;
    const lado = Math.abs(norte) <= 10 ? 'à sua frente' : Math.abs(norte) >= 170 ? 'às suas costas' : `${Math.round(Math.abs(norte))}° à sua ${norte > 0 ? 'direita' : 'esquerda'}`;
    return {
      sol,
      possivel: !alto,
      norteRelativo: norte,
      texto: alto
        ? 'O sol está quase a pino: espere até ele baixar ou use o método da sombra.'
        : `De frente para o sol, você olha para ${cardeal.nome} (${Math.round(sol.azimute)}°). O norte fica ${lado}.`,
    };
  }

  /** Confere a bússola com o sol: diferença entre o rumo lido apontando para o sol e o azimute calculado. */
  function conferirComSol(rumoLidoParaOSol, data = new Date(), lat = CENTRO.lat, lon = CENTRO.lon) {
    const sol = posicaoSol(data, lat, lon);
    const erro = diferenca(sol.azimute, rumoLidoParaOSol);
    return { sol, erro, ok: Math.abs(erro) <= 10 };
  }

  const SEM_BUSSOLA = [
    {
      id: 'sombra',
      titulo: 'Método da sombra (funciona sempre que houver sol)',
      passos: [
        'Finque uma vareta reta no chão plano, de 1 m mais ou menos.',
        'Marque com uma pedra a ponta da sombra.',
        'Espere 15 a 20 minutos e marque a nova ponta da sombra.',
        'A linha da primeira pedra para a segunda vai de oeste para leste.',
        'Fique com a primeira pedra à esquerda e a segunda à direita: você está de frente para o norte.',
      ],
    },
    {
      id: 'sol',
      titulo: 'Pelo sol',
      passos: [
        'O sol nasce do lado leste e se põe do lado oeste (no verão, mais para o sul; no inverno, mais para o norte).',
        'Em Hortolândia, ao meio-dia o sol fica do lado norte quase o ano todo.',
        'De fim de novembro a meados de janeiro o sol do meio-dia fica quase a pino: use o método da sombra.',
        'A aba Bússola mostra onde o sol está agora, calculado pela hora do aparelho.',
      ],
    },
    {
      id: 'relogio',
      titulo: 'Relógio de ponteiros (hemisfério sul)',
      passos: [
        'Segure o relógio na horizontal e aponte o número 12 para o sol.',
        'A linha que divide ao meio o ângulo entre o 12 e o ponteiro das horas aponta para o norte.',
        'É uma estimativa: erra mais perto do meio-dia e no verão.',
      ],
    },
    {
      id: 'cruzeiro',
      titulo: 'À noite: Cruzeiro do Sul',
      passos: [
        'Ache o Cruzeiro do Sul: quatro estrelas em cruz, com duas estrelas brilhantes ao lado (as Guardiãs).',
        'Prolongue o braço maior da cruz, a partir do pé, 4 vezes e meia o tamanho dele.',
        'Desse ponto no céu, desça uma linha reta até o horizonte: ali é o sul.',
        'De costas para o sul, você está de frente para o norte.',
      ],
    },
    {
      id: 'agulha',
      titulo: 'Bússola de agulha improvisada',
      passos: [
        'Esfregue uma agulha de costura num ímã ou numa peça de seda, sempre no mesmo sentido, umas 50 vezes.',
        'Coloque a agulha sobre uma folha ou rolha boiando numa tigela com água, longe de metais.',
        'A agulha gira e aponta para o norte–sul magnético.',
        `Em Hortolândia o norte magnético fica cerca de ${Math.abs(Math.round(DECLINACAO.graus))}° a oeste do norte verdadeiro.`,
      ],
    },
    {
      id: 'calibrar',
      titulo: 'Quando a bússola do celular erra',
      passos: [
        'Afaste o celular de ímãs, capinhas com ímã, carros, grades e fios elétricos.',
        'Calibre: gire o celular desenhando um 8 no ar algumas vezes.',
        'Confira com o sol (botão "Conferir com o sol" na aba Bússola).',
      ],
    },
  ];

  return {
    DECLINACAO,
    CENTRO,
    PONTOS_16,
    SEM_BUSSOLA,
    normalizar,
    diferenca,
    declinacaoEm,
    paraVerdadeiro,
    paraMagnetico,
    rumoDoEvento,
    suavizar,
    pontoCardeal,
    pontoCardeal16,
    distanciaMetros,
    rumoEntre,
    textoVirar,
    guiaAte,
    posicaoSol,
    orientarPeloSol,
    conferirComSol,
  };
});
