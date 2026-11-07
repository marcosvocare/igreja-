/**
 * Mecanismo: Controle de estoque e autonomia.
 *
 * - Classifica itens por validade (vencidos, vencendo, ok) na ordem
 *   "o primeiro que vence é o primeiro que sai".
 * - Calcula quantos dias a casa se sustenta com o estoque atual.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).estoque = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIA_MS = 24 * 60 * 60 * 1000;

  const CATEGORIAS = {
    agua: 'Água',
    alimento: 'Alimento',
    remedio: 'Remédio',
    higiene: 'Higiene',
    energia: 'Energia/iluminação',
    outro: 'Outro',
  };

  /** Converte 'AAAA-MM-DD' (ou Date) em número de dias desde a época, em UTC. */
  function diaUTC(data) {
    if (data instanceof Date) {
      if (Number.isNaN(data.getTime())) return null;
      return Math.floor(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()) / DIA_MS);
    }
    if (typeof data !== 'string') return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data.trim());
    if (!m) return null;
    const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
    const ms = Date.UTC(ano, mes - 1, dia);
    const d = new Date(ms);
    if (d.getUTCFullYear() !== ano || d.getUTCMonth() !== mes - 1 || d.getUTCDate() !== dia) return null;
    return Math.floor(ms / DIA_MS);
  }

  function diasAte(validade, hoje) {
    const v = diaUTC(validade);
    const h = diaUTC(hoje);
    if (v === null || h === null) return null;
    return v - h;
  }

  /**
   * Classifica os itens pela validade.
   * @param {Array} itens [{nome, validade:'AAAA-MM-DD', ...}]
   * @param {Date|string} hoje
   * @param {number} [diasAviso=30] antecedência do aviso de vencimento
   */
  function classificarValidade(itens, hoje = new Date(), diasAviso = 30) {
    const resultado = { vencidos: [], vencendo: [], ok: [], semValidade: [] };
    for (const item of itens || []) {
      const dias = item && item.validade ? diasAte(item.validade, hoje) : null;
      if (dias === null) {
        resultado.semValidade.push({ ...item, diasRestantes: null });
        continue;
      }
      const registro = { ...item, diasRestantes: dias };
      if (dias < 0) resultado.vencidos.push(registro);
      else if (dias <= diasAviso) resultado.vencendo.push(registro);
      else resultado.ok.push(registro);
    }
    const porData = (a, b) => a.diasRestantes - b.diasRestantes;
    resultado.vencidos.sort(porData);
    resultado.vencendo.sort(porData);
    resultado.ok.sort(porData);
    return resultado;
  }

  function numero(valor) {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Dias de autonomia com o estoque atual (itens vencidos não contam).
   * Cada item pode ter `litros` e/ou `kcal` POR UNIDADE e uma `quantidade`.
   * @param {Array} itens
   * @param {{aguaLitros:number, kcal:number}} necessidadeDiaria
   */
  function calcularAutonomia(itens, necessidadeDiaria, hoje = new Date()) {
    const aguaDia = numero(necessidadeDiaria && necessidadeDiaria.aguaLitros);
    const kcalDia = numero(necessidadeDiaria && necessidadeDiaria.kcal);
    let litros = 0;
    let kcal = 0;
    for (const item of itens || []) {
      if (!item) continue;
      const dias = item.validade ? diasAte(item.validade, hoje) : null;
      if (dias !== null && dias < 0) continue;
      const qtd = numero(item.quantidade);
      litros += qtd * numero(item.litros);
      kcal += qtd * numero(item.kcal);
    }
    const diasAgua = aguaDia > 0 ? Math.floor((litros / aguaDia) * 10) / 10 : null;
    const diasComida = kcalDia > 0 ? Math.floor((kcal / kcalDia) * 10) / 10 : null;

    let diasAutonomia = null;
    let gargalo = null;
    if (diasAgua !== null && diasComida !== null) {
      diasAutonomia = Math.min(diasAgua, diasComida);
      gargalo = diasAgua <= diasComida ? 'agua' : 'comida';
    } else if (diasAgua !== null) {
      diasAutonomia = diasAgua;
      gargalo = 'agua';
    } else if (diasComida !== null) {
      diasAutonomia = diasComida;
      gargalo = 'comida';
    }
    return { litros, kcal, diasAgua, diasComida, diasAutonomia, gargalo };
  }

  /**
   * Plano de racionamento: quanto consumir por dia para o estoque durar `diasAlvo`.
   * Água para beber nunca deve ser racionada abaixo do mínimo — o plano avisa.
   */
  function planoRacionamento(autonomia, necessidadeDiaria, diasAlvo) {
    const alvo = Number(diasAlvo);
    if (!Number.isFinite(alvo) || alvo <= 0) throw new RangeError('Informe os dias que o estoque precisa durar.');
    const aguaPorDia = autonomia.litros / alvo;
    const kcalPorDia = autonomia.kcal / alvo;
    const aguaNec = numero(necessidadeDiaria.aguaLitros);
    const kcalNec = numero(necessidadeDiaria.kcal);
    const avisos = [];
    if (aguaNec > 0 && aguaPorDia < aguaNec) {
      avisos.push('A água não dura o período: corte primeiro banho e limpeza, nunca a água de beber. Busque reabastecimento.');
    }
    if (kcalNec > 0 && kcalPorDia < kcalNec * 0.5) {
      avisos.push('Comida abaixo de 50 % da necessidade: crianças, gestantes e idosos têm prioridade. Acione a rede de apoio.');
    }
    return {
      aguaLitrosPorDia: Math.floor(aguaPorDia * 10) / 10,
      kcalPorDia: Math.floor(kcalPorDia),
      percentualAgua: aguaNec > 0 ? Math.min(100, Math.round((aguaPorDia / aguaNec) * 100)) : null,
      percentualComida: kcalNec > 0 ? Math.min(100, Math.round((kcalPorDia / kcalNec) * 100)) : null,
      avisos,
    };
  }

  return { CATEGORIAS, diaUTC, diasAte, classificarValidade, calcularAutonomia, planoRacionamento };
});
