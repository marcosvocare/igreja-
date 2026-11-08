/**
 * Mecanismo: Controle de remédios críticos.
 *
 * Para cada remédio de uso contínuo, calcula quantos dias o estoque dura,
 * quando acaba (considerando a validade) e quanto falta para a meta.
 * Não orienta dose: qualquer mudança deve passar por um profissional de saúde.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).remedios = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIA_MS = 86400000;

  function diaUTC(data) {
    if (data instanceof Date) {
      return Number.isNaN(data.getTime()) ? null : Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / DIA_MS);
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(data || '').trim());
    if (!m) return null;
    const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const d = new Date(ms);
    if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
    return Math.floor(ms / DIA_MS);
  }

  function isoDoDia(dia) {
    return new Date(dia * DIA_MS).toISOString().slice(0, 10);
  }

  function positivo(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /** Consumo diário em unidades (comprimidos, ml, aplicações…). */
  function consumoDiario(item) {
    return positivo(item.dosesPorDia) * (positivo(item.unidadesPorDose) || 1);
  }

  /** Dias que o estoque dura no consumo atual (null se o consumo não foi informado). */
  function diasRestantes(item) {
    const c = consumoDiario(item);
    if (!c) return null;
    return Math.floor((Number(item.quantidade) || 0) / c);
  }

  /**
   * Situação de cada remédio, do mais urgente para o menos urgente.
   * @param {Array<{pessoa, nome, dosesPorDia, unidadesPorDose?, quantidade, validade?, refrigerado?}>} itens
   */
  function situacaoRemedios(itens, hoje = new Date(), { limiteCritico = 7, limiteAtencao = 15 } = {}) {
    const diaHoje = diaUTC(hoje);
    const ordem = { critico: 0, atencao: 1, sem_dados: 2, ok: 3 };
    const lista = (itens || []).map((item) => {
      const dias = diasRestantes(item);
      const diaValidade = diaUTC(item.validade);
      const diasValidade = diaValidade === null ? null : diaValidade - diaHoje;
      const vencido = diasValidade !== null && diasValidade < 0;
      let diasEfetivos = dias;
      let limitadoPelaValidade = false;
      if (dias !== null && diasValidade !== null && diasValidade >= 0 && diasValidade < dias) {
        diasEfetivos = diasValidade;
        limitadoPelaValidade = true;
      }
      if (vencido) diasEfetivos = 0;

      let nivel;
      if (vencido) nivel = 'critico';
      else if (diasEfetivos === null) nivel = 'sem_dados';
      else if (diasEfetivos < limiteCritico) nivel = 'critico';
      else if (diasEfetivos < limiteAtencao) nivel = 'atencao';
      else nivel = 'ok';

      const avisos = [];
      if (vencido) avisos.push('Vencido: não use sem orientação de um profissional de saúde.');
      else if (limitadoPelaValidade) avisos.push('Vence antes de acabar: programe a reposição pela validade.');
      if (item.refrigerado) avisos.push('Precisa de geladeira: sem energia, use bolsa térmica e confira na bula quanto tempo aguenta fora.');

      return {
        ...item,
        consumoDiario: consumoDiario(item),
        dias,
        diasEfetivos,
        nivel,
        acabaEm: diasEfetivos !== null && diaHoje !== null ? isoDoDia(diaHoje + diasEfetivos) : null,
        avisos,
      };
    });
    lista.sort((a, b) => ordem[a.nivel] - ordem[b.nivel] || (a.diasEfetivos ?? Infinity) - (b.diasEfetivos ?? Infinity));

    const criticos = lista.filter((r) => r.nivel === 'critico');
    return {
      itens: lista,
      criticos: criticos.length,
      atencao: lista.filter((r) => r.nivel === 'atencao').length,
      pessoasEmRisco: [...new Set(criticos.map((r) => r.pessoa).filter(Boolean))],
      menorCobertura: lista.reduce((m, r) => (r.diasEfetivos !== null && (m === null || r.diasEfetivos < m) ? r.diasEfetivos : m), null),
    };
  }

  /** Quantas unidades faltam para cada remédio durar `metaDias`. */
  function planoReposicao(itens, metaDias = 30) {
    const meta = Number(metaDias);
    if (!Number.isInteger(meta) || meta < 1 || meta > 365) throw new RangeError('A meta deve ser de 1 a 365 dias.');
    return (itens || [])
      .map((item) => {
        const c = consumoDiario(item);
        const faltam = c ? Math.max(0, Math.ceil(c * meta - (Number(item.quantidade) || 0))) : null;
        return { pessoa: item.pessoa, nome: item.nome, faltam };
      })
      .filter((r) => r.faltam > 0);
  }

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  /** Horários "08:00, 20:00" → minutos do dia. */
  function lerHorarios(texto) {
    return String(texto || '')
      .split(/[,;\s]+/)
      .map((h) => /^(\d{1,2})(?::|h)(\d{2})?$/.exec(h.trim()))
      .filter((m) => m && Number(m[1]) < 24 && Number(m[2] || 0) < 60)
      .map((m) => Number(m[1]) * 60 + Number(m[2] || 0))
      .sort((a, b) => a - b);
  }

  /**
   * Próximas doses nas próximas `horas` horas, da mais próxima para a mais distante.
   * Cada remédio pode ter `horarios` ("08:00, 20:00").
   */
  function proximasDoses(itens, agora = new Date(), horas = 24) {
    const doses = [];
    const inicioDia = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime();
    for (const item of itens || []) {
      for (const min of lerHorarios(item.horarios)) {
        for (const dia of [0, 1]) {
          const quando = new Date(inicioDia + dia * 86400000 + min * 60000);
          const minutosAte = Math.round((quando - agora) / 60000);
          if (minutosAte >= 0 && minutosAte <= horas * 60) doses.push({ pessoa: item.pessoa, nome: item.nome, quando, minutosAte });
        }
      }
    }
    return doses.sort((a, b) => a.minutosAte - b.minutosAte);
  }

  /**
   * Pontos do mapa onde o remédio pode estar: farmácias, postos e estoques cujo
   * nome, observação ou referência citam o remédio (pela primeira palavra do nome).
   */
  function ondeBuscar(nomeRemedio, pontos) {
    const chave = normalizar(String(nomeRemedio || '').trim().split(/\s+/)[0]);
    if (chave.length < 3) return [];
    return (pontos || []).filter(
      (p) => p.categoria === 'remedio' && p.status !== 'esgotado' && p.status !== 'inseguro' && normalizar([p.nome, p.obs, p.referencia].join(' ')).includes(chave),
    );
  }

  const ORIENTACOES = [
    'Nunca interrompa, reduza ou troque um remédio por conta própria. Fale antes com um profissional de saúde da rede.',
    'Guarde a receita (ou foto dela) e a caixa junto com o remédio.',
    'Tenha uma ficha de cada pessoa com doenças, alergias, remédios e doses.',
    'Remédio de outra pessoa só com orientação de um profissional de saúde.',
    'Remédios de geladeira (como a insulina): sem energia, use bolsa térmica e confira na bula quanto tempo aguentam fora.',
    'Guarde em lugar fresco, seco e longe do sol e das crianças.',
  ];

  return { consumoDiario, diasRestantes, situacaoRemedios, planoReposicao, lerHorarios, proximasDoses, ondeBuscar, ORIENTACOES };
});
