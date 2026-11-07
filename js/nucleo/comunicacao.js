/**
 * Mecanismo: Plano de comunicação.
 *
 * - Árvore de chamadas (cada pessoa avisa no máximo N outras).
 * - Mensagens SMS padronizadas, sem acentos para caber em 160 caracteres.
 * - Próxima janela de contato (celular ligado só em horários combinados).
 * - Cargas de power bank.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).comunicacao = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /**
   * Monta a árvore de chamadas. O primeiro membro é o coordenador.
   * Usa layout de árvore N-ária: o membro i avisa os membros N*i+1 … N*i+N.
   * @param {Array<{nome:string, telefone?:string}>} membros
   * @param {{porPessoa?: number}} [opcoes]
   * @returns {{ligacoes: Array<{quem:object, avisa:object[], rodada:number}>, rodadas:number}}
   */
  function gerarArvore(membros, { porPessoa = 3 } = {}) {
    const k = Number(porPessoa);
    if (!Number.isInteger(k) || k < 1 || k > 10) throw new RangeError('"porPessoa" deve ser um inteiro de 1 a 10.');
    const lista = (membros || []).filter((m) => m && String(m.nome || '').trim());
    const rodadaDe = [0];
    const ligacoes = [];
    for (let i = 0; i < lista.length; i++) {
      const avisa = [];
      for (let j = k * i + 1; j <= k * i + k && j < lista.length; j++) {
        avisa.push(lista[j]);
        rodadaDe[j] = rodadaDe[i] + 1;
      }
      if (avisa.length) ligacoes.push({ quem: lista[i], avisa, rodada: rodadaDe[i] + 1 });
    }
    const rodadas = lista.length > 1 ? Math.max(...rodadaDe.slice(0, lista.length)) : 0;
    return { ligacoes, rodadas };
  }

  /** Caracteres do GSM-7 que ocupam 2 posições (tabela de extensão). */
  const EXTENSAO_GSM = new Set(['^', '{', '}', '\\', '[', ']', '~', '|', '€']);

  /** Remove acentos e troca caracteres fora do ASCII imprimível por '?'. */
  function semAcentos(texto) {
    return String(texto)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/[^\x20-\x7E\n]/g, '?');
  }

  /**
   * Prepara um texto para SMS: remove acentos (para usar a codificação GSM-7,
   * com 160 caracteres por mensagem em vez de 70) e conta os segmentos.
   */
  function prepararSMS(texto) {
    const limpo = semAcentos(texto).replace(/\s+/g, ' ').trim();
    let septetos = 0;
    for (const ch of limpo) septetos += EXTENSAO_GSM.has(ch) ? 2 : 1;
    const segmentos = septetos === 0 ? 0 : septetos <= 160 ? 1 : Math.ceil(septetos / 153);
    return { texto: limpo, caracteres: septetos, segmentos };
  }

  const MODELOS = {
    ok: 'OK {nome}: estou bem em {local}. {hora}. {obs}',
    ajuda: 'AJUDA {nome}: preciso de ajuda em {local}. Motivo: {obs}. {hora}',
    indo: 'INDO {nome}: saindo para {local}. {obs} {hora}',
    cheguei: 'CHEGUEI {nome}: estou em {local}, seguro. {hora}. {obs}',
  };

  /**
   * Monta uma mensagem padronizada.
   * @param {'ok'|'ajuda'|'indo'|'cheguei'} tipo
   * @param {{nome?:string, local?:string, hora?:string, obs?:string}} dados
   */
  function montarMensagem(tipo, dados = {}) {
    const modelo = MODELOS[tipo];
    if (!modelo) throw new Error(`Tipo de mensagem desconhecido: ${tipo}`);
    const texto = modelo
      .replace(/\{(\w+)\}/g, (_, chave) => String(dados[chave] || '').trim())
      .replace(/\s+([.:])/g, '$1')
      .replace(/\.{2,}/g, '.')
      .replace(/:\s*\./g, ':');
    return prepararSMS(texto);
  }

  /**
   * Próxima janela de contato a partir de `agora`.
   * @param {string[]} horarios ['08:00', '12:00', ...]
   * @param {Date} agora
   * @param {number} [duracaoMin=15] duração de cada janela
   * @returns {{emJanela:boolean, proxima:Date, minutosAte:number}}
   */
  function proximaJanela(horarios, agora = new Date(), duracaoMin = 15) {
    const minutos = (horarios || [])
      .map((h) => /^(\d{1,2}):(\d{2})$/.exec(String(h).trim()))
      .filter((m) => m && Number(m[1]) < 24 && Number(m[2]) < 60)
      .map((m) => Number(m[1]) * 60 + Number(m[2]))
      .sort((a, b) => a - b);
    if (!minutos.length) throw new RangeError('Informe ao menos um horário no formato HH:MM.');

    const agoraMin = agora.getHours() * 60 + agora.getMinutes();
    const emJanela = minutos.some((m) => agoraMin >= m && agoraMin < m + duracaoMin);
    let alvo = minutos.find((m) => m > agoraMin);
    let diaExtra = 0;
    if (alvo === undefined) {
      alvo = minutos[0];
      diaExtra = 1;
    }
    const proxima = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() + diaExtra, Math.floor(alvo / 60), alvo % 60);
    return { emJanela, proxima, minutosAte: alvo + diaExtra * 1440 - agoraMin };
  }

  /**
   * Quantas cargas completas de celular um power bank fornece.
   * A capacidade nominal (mAh a 3,7 V) perde ~35 % na conversão.
   */
  function cargasPowerbank(capacidadeMah, bateriaCelularMah, eficiencia = 0.65) {
    const cap = Number(capacidadeMah);
    const cel = Number(bateriaCelularMah);
    const ef = Number(eficiencia);
    if (!(cap > 0) || !(cel > 0)) throw new RangeError('Informe capacidades maiores que zero.');
    if (!(ef > 0 && ef <= 1)) throw new RangeError('A eficiência deve estar entre 0 e 1.');
    return Math.floor(((cap * ef) / cel) * 10) / 10;
  }

  const DICAS_BATERIA = [
    'Ative o modo de economia de energia e reduza o brilho da tela.',
    'Desligue Wi-Fi, Bluetooth e localização quando não estiver usando.',
    'Prefira SMS a ligações e áudios: gastam menos bateria e passam em rede congestionada.',
    'Fora das janelas de contato, deixe o celular em modo avião ou desligado.',
    'Carregue tudo pelo carro (com o motor ligado e em local aberto) ou por carregador solar.',
  ];

  return { gerarArvore, semAcentos, prepararSMS, MODELOS, montarMensagem, proximaJanela, cargasPowerbank, DICAS_BATERIA };
});
