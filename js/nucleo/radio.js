/**
 * Mecanismo: Rede de rádio da família (Meshtastic: celular + rádio LoRa).
 *
 * Cada pessoa leva um rádio LoRa ligado ao celular por Bluetooth; as mensagens
 * pulam de rádio em rádio sem operadora e sem internet. Este módulo:
 * - estima o alcance de cada enlace pelo tipo de instalação e de bairro;
 * - analisa a rede: quem alcança quem, em quantos saltos, quem fica isolado;
 * - sugere onde pôr um repetidor para ligar quem ficou de fora;
 * - monta o plano de canais e os nomes dos aparelhos;
 * - prepara mensagens que cabem no limite de uma mensagem LoRa.
 *
 * Os alcances são estimativas para antenas comuns. O teste de alcance no
 * local é o que vale.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).radio = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const RAIO_TERRA = 6371000;
  const RAD = Math.PI / 180;

  /** Alcance típico entre dois rádios portáteis na altura da mão, em km. */
  const AMBIENTES = {
    denso: { rotulo: 'Centro com prédios altos', alcanceKm: 0.8 },
    urbano: { rotulo: 'Bairro de casas e prédios baixos', alcanceKm: 1.5 },
    suburbano: { rotulo: 'Periferia com espaços abertos', alcanceKm: 3 },
    aberto: { rotulo: 'Campo aberto ou vista livre', alcanceKm: 6 },
  };

  /** fator: multiplica o alcance; papel: configuração recomendada no app Meshtastic. */
  const INSTALACOES = {
    portatil: { rotulo: 'Portátil (com a pessoa)', fator: 1, papel: 'CLIENT' },
    fixo: { rotulo: 'Fixo em casa (janela alta ou laje)', fator: 1.5, papel: 'CLIENT' },
    alto: { rotulo: 'Repetidor no alto (telhado alto, torre, morro)', fator: 3, papel: 'ROUTER' },
  };

  const LIMITE_SALTOS_PADRAO = 3;
  const LIMITE_SALTOS_MAXIMO = 7;
  const LIMITE_BYTES = 200; // margem segura abaixo do máximo de uma mensagem de texto
  const ENLACE_FRACO = 0.8; // acima de 80 % do alcance estimado

  function temCoordenadas(p) {
    return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }

  function distanciaMetros(a, b) {
    const dLat = (b.lat - a.lat) * RAD;
    const dLon = (b.lon - a.lon) * RAD;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
    return 2 * RAIO_TERRA * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function ambienteValido(ambiente) {
    if (!AMBIENTES[ambiente]) throw new RangeError(`Tipo de bairro desconhecido: ${ambiente}`);
    return AMBIENTES[ambiente];
  }

  /** Alcance de um rádio, em metros, conforme a instalação. */
  function alcanceNo(no, ambiente = 'urbano') {
    const inst = INSTALACOES[no && no.instalacao] || INSTALACOES.portatil;
    return ambienteValido(ambiente).alcanceKm * 1000 * inst.fator;
  }

  /** Alcance de um enlace entre dois rádios: média geométrica dos dois alcances. */
  function alcanceEnlace(a, b, ambiente = 'urbano') {
    return Math.sqrt(alcanceNo(a, ambiente) * alcanceNo(b, ambiente));
  }

  /**
   * Analisa a rede de rádios.
   * @param {Array<{id:string, nome:string, lat:number, lon:number, instalacao:string}>} nos
   * @param {{ambiente?:string, limiteSaltos?:number, baseId?:string}} [opcoes]
   */
  function analisarMalha(nos, { ambiente = 'urbano', limiteSaltos = LIMITE_SALTOS_PADRAO, baseId } = {}) {
    ambienteValido(ambiente);
    const limite = Number(limiteSaltos);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_SALTOS_MAXIMO) {
      throw new RangeError(`O limite de saltos deve ser de 1 a ${LIMITE_SALTOS_MAXIMO}.`);
    }
    const todos = (nos || []).filter((n) => n && n.id);
    const validos = todos.filter(temCoordenadas);
    const semLocalizacao = todos.filter((n) => !temCoordenadas(n)).map((n) => n.id);

    // Enlaces possíveis entre cada par de rádios.
    const vizinhos = new Map(validos.map((n) => [n.id, []]));
    const enlaces = [];
    for (let i = 0; i < validos.length; i++) {
      for (let j = i + 1; j < validos.length; j++) {
        const a = validos[i];
        const b = validos[j];
        const distancia = distanciaMetros(a, b);
        const alcance = alcanceEnlace(a, b, ambiente);
        if (distancia <= alcance) {
          enlaces.push({ a: a.id, b: b.id, distancia, alcance, fraco: distancia > alcance * ENLACE_FRACO });
          vizinhos.get(a.id).push(b.id);
          vizinhos.get(b.id).push(a.id);
        }
      }
    }

    // Base: a indicada, senão o primeiro repetidor no alto, senão o primeiro rádio.
    const base =
      validos.find((n) => n.id === baseId) || validos.find((n) => n.instalacao === 'alto') || validos[0] || null;

    // Saltos a partir da base (busca em largura).
    const saltos = {};
    for (const n of validos) saltos[n.id] = null;
    if (base) {
      saltos[base.id] = 0;
      const fila = [base.id];
      while (fila.length) {
        const atual = fila.shift();
        for (const v of vizinhos.get(atual)) {
          if (saltos[v] === null) {
            saltos[v] = saltos[atual] + 1;
            fila.push(v);
          }
        }
      }
    }

    // Grupos de rádios que se alcançam entre si.
    const grupo = {};
    const componentes = [];
    for (const n of validos) {
      if (grupo[n.id] !== undefined) continue;
      const comp = [];
      const pilha = [n.id];
      grupo[n.id] = componentes.length;
      while (pilha.length) {
        const x = pilha.pop();
        comp.push(x);
        for (const v of vizinhos.get(x)) {
          if (grupo[v] === undefined) {
            grupo[v] = componentes.length;
            pilha.push(v);
          }
        }
      }
      componentes.push(comp);
    }

    const conectados = validos.filter((n) => saltos[n.id] !== null && saltos[n.id] <= limite).map((n) => n.id);
    const alemDoLimite = validos.filter((n) => saltos[n.id] !== null && saltos[n.id] > limite).map((n) => n.id);
    const isolados = validos.filter((n) => saltos[n.id] === null).map((n) => n.id);
    const maiorSalto = Math.max(0, ...validos.map((n) => saltos[n.id] || 0));

    // Sugestões: para cada grupo desligado da base, o par mais próximo e um repetidor no meio.
    const sugestoes = [];
    if (base) {
      const daBase = componentes[grupo[base.id]].map((id) => validos.find((n) => n.id === id));
      const alto = { instalacao: 'alto' };
      for (const comp of componentes) {
        if (comp.includes(base.id)) continue;
        let melhor = null;
        for (const id of comp) {
          const x = validos.find((n) => n.id === id);
          for (const y of daBase) {
            const d = distanciaMetros(x, y);
            if (!melhor || d < melhor.distancia) melhor = { x, y, distancia: d };
          }
        }
        const meio = { lat: (melhor.x.lat + melhor.y.lat) / 2, lon: (melhor.x.lon + melhor.y.lon) / 2 };
        const metade = melhor.distancia / 2;
        sugestoes.push({
          grupo: comp,
          de: melhor.x.id,
          ate: melhor.y.id,
          distancia: melhor.distancia,
          meio,
          resolve: metade <= alcanceEnlace(melhor.x, alto, ambiente) && metade <= alcanceEnlace(melhor.y, alto, ambiente),
        });
      }
    }

    return {
      ambiente,
      base: base ? base.id : null,
      enlaces,
      saltos,
      componentes,
      conectados,
      alemDoLimite,
      isolados,
      semLocalizacao,
      sugestoes,
      limiteRecomendado: Math.min(LIMITE_SALTOS_MAXIMO, Math.max(LIMITE_SALTOS_PADRAO, maiorSalto)),
    };
  }

  function semAcentos(texto) {
    return String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '');
  }

  /** Nome curto do aparelho (até 4 letras maiúsculas), sem repetir os já usados. */
  function nomeCurto(nome, usados = new Set()) {
    const letras = semAcentos(nome).toUpperCase().replace(/[^A-Z0-9 ]/g, '').trim();
    const palavras = letras.split(/\s+/).filter(Boolean);
    let base = (palavras[0] || 'RAD').slice(0, 4);
    if (!usados.has(base)) return base;
    // Tenta com a inicial do segundo nome; depois, com números.
    if (palavras[1]) {
      const alt = `${base.slice(0, 3)}${palavras[1][0]}`;
      if (!usados.has(alt)) return alt;
    }
    base = base.slice(0, 3);
    for (let n = 2; n <= 99; n++) {
      const alt = `${base}${n}`.slice(0, 4);
      if (!usados.has(alt)) return alt;
    }
    return base;
  }

  /** Nome de canal aceito pelo app: letras e números sem acento, até 11 caracteres. */
  function nomeCanal(nome, padrao = 'Familia') {
    const limpo = semAcentos(nome).replace(/[^A-Za-z0-9_-]/g, '').slice(0, 11);
    return limpo || padrao;
  }

  /**
   * Plano da rede: nome e papel de cada aparelho, canais e limite de saltos.
   * @param {Array} nos rádios
   * @param {{canalFamilia?:string, canalComunidade?:string|null, analise?:object}} [opcoes]
   */
  function planoRede(nos, { canalFamilia = 'Familia', canalComunidade = 'Igreja', analise = null } = {}) {
    const usados = new Set();
    const aparelhos = (nos || []).map((n) => {
      const curto = nomeCurto(n.nome, usados);
      usados.add(curto);
      const inst = INSTALACOES[n.instalacao] || INSTALACOES.portatil;
      return { id: n.id, nomeLongo: String(n.nome || '').slice(0, 36), nomeCurto: curto, papel: inst.papel, instalacao: inst.rotulo };
    });
    const canais = [
      {
        indice: 0,
        nome: 'LongFast (padrão)',
        uso: 'Canal principal. Não mude: assim os rádios de outras pessoas da cidade também retransmitem as mensagens.',
        chave: 'Padrão do app',
      },
      {
        indice: 1,
        nome: nomeCanal(canalFamilia, 'Familia'),
        uso: 'Conversa da família. Só quem tem a chave lê.',
        chave: 'Gere no app e compartilhe pelo QR code, pessoalmente',
      },
    ];
    if (canalComunidade) {
      canais.push({
        indice: 2,
        nome: nomeCanal(canalComunidade, 'Igreja'),
        uso: 'Conversa da comunidade da igreja.',
        chave: 'Gerada pela coordenação e compartilhada pelo QR code',
      });
    }
    return {
      aparelhos,
      canais,
      limiteSaltos: analise ? analise.limiteRecomendado : LIMITE_SALTOS_PADRAO,
    };
  }

  function bytesUtf8(texto) {
    let n = 0;
    for (const ch of String(texto)) {
      const c = ch.codePointAt(0);
      n += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4;
    }
    return n;
  }

  /** Prepara uma mensagem para o rádio: sem acentos (ocupam 2 bytes) e dentro do limite. */
  function prepararMensagemLora(texto, { removerAcentos = true } = {}) {
    const t = (removerAcentos ? semAcentos(texto) : String(texto)).replace(/\s+/g, ' ').trim();
    const bytes = bytesUtf8(t);
    return { texto: t, bytes, limite: LIMITE_BYTES, cabe: bytes <= LIMITE_BYTES, excesso: Math.max(0, bytes - LIMITE_BYTES) };
  }

  /** Códigos curtos combinados com a família: rápidos de digitar e de ler. */
  const CODIGOS = [
    { codigo: '0', significado: 'Recebido.' },
    { codigo: '1', significado: 'Estou bem.' },
    { codigo: '2', significado: 'Preciso de ajuda aqui (veja minha posição no mapa do app).' },
    { codigo: '3', significado: 'Perigo onde estou: não venha para cá.' },
    { codigo: '4', significado: 'Indo para o ponto de encontro.' },
    { codigo: '5', significado: 'Cheguei ao ponto de encontro.' },
    { codigo: '6', significado: 'Falta água, comida ou remédio: detalho em seguida.' },
    { codigo: '9', significado: 'Bateria acabando: volto no próximo horário combinado.' },
  ];

  const GUIA = [
    'Compre um rádio LoRa compatível com Meshtastic para cada pessoa e um para o repetidor. Escolha modelos com bateria e antena para a faixa de 915 MHz.',
    'Instale o app Meshtastic no celular de cada pessoa (Android ou iPhone) e pareie com o rádio por Bluetooth.',
    'Em Região (LoRa), escolha a do Brasil (faixas de 902 a 907,5 MHz e de 915 a 928 MHz), a mesma para todos os rádios da rede.',
    'Dê a cada rádio o nome longo e o nome curto do plano abaixo e o papel indicado (CLIENT para pessoas, ROUTER só para o repetidor no alto).',
    'Mantenha o canal principal no padrão. Crie o canal da família como secundário, gere a chave no app e compartilhe pelo QR code, pessoalmente.',
    'Ajuste o limite de saltos para o valor do plano.',
    'Instale o repetidor no ponto mais alto possível (torre ou telhado da igreja), em caixa à prova d\'água, com painel solar e bateria.',
    'Faça um teste de alcance andando pelo bairro com dois rádios e corrija o plano com o que funcionou de verdade.',
    'Todo mês: carregue as baterias, mande um "1" no horário combinado e confira quem respondeu.',
  ];

  return {
    AMBIENTES,
    INSTALACOES,
    LIMITE_BYTES,
    LIMITE_SALTOS_MAXIMO,
    alcanceNo,
    alcanceEnlace,
    analisarMalha,
    nomeCurto,
    nomeCanal,
    planoRede,
    bytesUtf8,
    prepararMensagemLora,
    CODIGOS,
    GUIA,
  };
});
