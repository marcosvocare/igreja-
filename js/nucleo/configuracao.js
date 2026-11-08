/**
 * Mecanismo: Roteiro de primeiro uso e lembrete de cópia de segurança.
 *
 * Confere, a partir dos dados, quais passos de preparação já foram feitos,
 * na ordem em que fazem mais diferença, e quando é hora de fazer uma cópia.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).configuracao = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIA_MS = 86400000;
  const DIAS_ENTRE_COPIAS = 7;

  function coordValida(p) {
    return Boolean(p) && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }

  function texto(v) {
    return typeof v === 'string' && v.trim() !== '';
  }

  /**
   * Passos de preparação e se cada um já foi feito.
   * @param {object} e estado do app
   * @param {{progressoKit?:number, temSenha?:boolean, agora?:Date}} [extra]
   *   progressoKit: percentual do kit de 72 h (calculado pela aba Kit)
   */
  function passos(e = {}, { progressoKit = 0, temSenha = false, agora = new Date() } = {}) {
    const lista = [
      {
        id: 'casa',
        titulo: 'Dizer quem mora na casa',
        aba: 'suprimentos',
        feito: e.casaRevisada === true,
        porque: 'Base para água, comida, kit e partilha.',
      },
      {
        id: 'equipes',
        titulo: 'Definir as equipes de socorro da comunidade',
        aba: 'rede-equipes',
        feito: Boolean(e.equipes) && Object.values(e.equipes).some(texto),
        porque: 'Sem serviços de fora, é a quem se pede ajuda.',
      },
      {
        id: 'encontro',
        titulo: 'Combinar os pontos de encontro',
        aba: 'comunicacao',
        feito: Boolean(e.pontos) && texto(e.pontos.casa) && texto(e.pontos.bairro),
        porque: 'A família se reencontra mesmo sem telefone.',
      },
      {
        id: 'contatos',
        titulo: 'Cadastrar pelo menos 2 contatos',
        aba: 'comunicacao',
        feito: Array.isArray(e.contatos) && e.contatos.length >= 2,
        porque: 'Monta a árvore de chamadas e o cartão de bolso.',
      },
      {
        id: 'base',
        titulo: 'Marcar a base no mapa (casa ou igreja)',
        aba: 'mapa',
        feito: Boolean(e.mapa) && coordValida(e.mapa.base),
        porque: 'Distâncias até água, remédios e comida.',
      },
      {
        id: 'radio',
        titulo: 'Planejar o rádio da família (2 rádios ou mais)',
        aba: 'radio',
        feito: Boolean(e.radio) && Array.isArray(e.radio.nos) && e.radio.nos.filter((n) => !n.exemplo && coordValida(n)).length >= 2,
        porque: 'Mensagens sem operadora e sem internet.',
      },
      {
        id: 'remedios',
        titulo: 'Cadastrar os remédios de uso contínuo',
        aba: 'remedios',
        feito: !(e.extras && e.extras.remediosContinuos) || (Array.isArray(e.remedios) && e.remedios.length > 0),
        porque: 'Mostra o que acaba primeiro.',
      },
      {
        id: 'kit',
        titulo: 'Separar pelo menos metade do kit de 72 h',
        aba: 'kit',
        feito: progressoKit >= 50,
        porque: 'Sair de casa em 10 minutos se preciso.',
      },
      {
        id: 'senha',
        titulo: 'Proteger o app com senha',
        aba: 'dados-senha',
        feito: Boolean(temSenha),
        porque: 'Quem pegar o celular não vê estoque, remédios nem endereços.',
      },
      {
        id: 'copia',
        titulo: 'Fazer uma cópia de segurança',
        aba: 'dados',
        feito: !precisaCopia(e, agora),
        porque: 'Celular quebra, molha e é roubado.',
      },
    ];
    const feitos = lista.filter((p) => p.feito).length;
    return { passos: lista, feitos, total: lista.length, proximo: lista.find((p) => !p.feito) || null };
  }

  /** Há dados que valem uma cópia? */
  function temDadosImportantes(e = {}) {
    const n = (v) => (Array.isArray(v) ? v.length : 0);
    return (
      n(e.contatos) + n(e.estoque) + n(e.rede) + n(e.remedios) > 0 ||
      (e.mapa && n(e.mapa.pontos) > 0) ||
      (e.radio && n(e.radio.nos) > 0) ||
      (e.equipes && Object.values(e.equipes).some(texto))
    );
  }

  /** Dias desde a última cópia (null se nunca houve). */
  function diasDesdeCopia(e = {}, agora = new Date()) {
    const t = e.ultimaCopia ? new Date(e.ultimaCopia).getTime() : NaN;
    return Number.isFinite(t) ? Math.floor((agora.getTime() - t) / DIA_MS) : null;
  }

  /** É hora de fazer cópia: há dados e a última foi há mais de 7 dias (ou nunca). */
  function precisaCopia(e = {}, agora = new Date()) {
    if (!temDadosImportantes(e)) return false;
    const d = diasDesdeCopia(e, agora);
    return d === null || d >= DIAS_ENTRE_COPIAS;
  }

  return { DIAS_ENTRE_COPIAS, passos, temDadosImportantes, diasDesdeCopia, precisaCopia };
});
