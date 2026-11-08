/**
 * Mecanismo: Partilha justa do estoque comum (igreja, vizinhança).
 *
 * Divide água ou comida entre as famílias pela necessidade de cada uma.
 * Quando não há para todos, cada família recebe a mesma porcentagem da sua
 * necessidade; famílias com pessoas vulneráveis recebem uma porcentagem maior,
 * nunca acima de 100 %. O que sobra de quem já foi atendido é redistribuído.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).partilha = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function naoNegativo(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * @param {number} total quantidade disponível para o período inteiro
   * @param {Array<{nome:string, necessidade:number, vulneravel?:boolean}>} demandas necessidade POR DIA
   * @param {{dias?:number, pesoVulneravel?:number}} [opcoes]
   */
  function distribuir(total, demandas, { dias = 1, pesoVulneravel = 1.25 } = {}) {
    const t = Number(total);
    if (!Number.isFinite(t) || t < 0) throw new RangeError('O estoque total deve ser zero ou mais.');
    const d = Number(dias);
    if (!Number.isInteger(d) || d < 1 || d > 365) throw new RangeError('O período deve ser de 1 a 365 dias.');
    const pv = Number(pesoVulneravel);
    if (!Number.isFinite(pv) || pv < 1 || pv > 3) throw new RangeError('O peso de prioridade deve estar entre 1 e 3.');

    const itens = (demandas || []).map((x) => ({
      nome: String((x && x.nome) || '').trim(),
      vulneravel: Boolean(x && x.vulneravel),
      necessidade: naoNegativo(x && x.necessidade) * d,
      peso: x && x.vulneravel ? pv : 1,
      alocado: 0,
    }));

    let restante = t;
    let ativos = itens.filter((i) => i.necessidade > 0);
    while (ativos.length && restante > 1e-9) {
      const soma = ativos.reduce((s, i) => s + i.peso * i.necessidade, 0);
      const saturados = ativos.filter((i) => (restante * i.peso * i.necessidade) / soma >= i.necessidade - 1e-9);
      if (!saturados.length) {
        for (const i of ativos) i.alocado = (restante * i.peso * i.necessidade) / soma;
        restante = 0;
        break;
      }
      for (const i of saturados) {
        i.alocado = i.necessidade;
        restante -= i.necessidade;
      }
      ativos = ativos.filter((i) => !saturados.includes(i));
    }

    // Arredonda para baixo (1 casa) para nunca distribuir mais do que existe.
    const porFamilia = itens.map((i) => {
      const alocado = Math.floor(i.alocado * 10 + 1e-9) / 10;
      return {
        nome: i.nome,
        vulneravel: i.vulneravel,
        necessidade: i.necessidade,
        alocado,
        porDia: Math.floor((alocado / d) * 10 + 1e-9) / 10,
        percentual: i.necessidade > 0 ? Math.min(100, Math.round((alocado / i.necessidade) * 100)) : 100,
      };
    });
    const totalNecessario = itens.reduce((s, i) => s + i.necessidade, 0);
    const distribuido = porFamilia.reduce((s, f) => s + f.alocado, 0);
    return {
      dias: d,
      porFamilia,
      totalNecessario,
      distribuido: Math.round(distribuido * 10) / 10,
      // Sobra real (excedente depois de atender 100 % de todos); o resto do arredondamento fica no estoque.
      sobra: Math.max(0, Math.round((t - totalNecessario) * 10) / 10),
      cobertura: totalNecessario > 0 ? Math.min(100, Math.round((t / totalNecessario) * 100)) : 100,
    };
  }

  /** Quem conta para cada item: por pessoa, por um grupo da casa ou por família. */
  const CRITERIOS = {
    pessoa: { rotulo: 'por pessoa', contar: (c) => ['adultos', 'idosos', 'gestantes', 'criancas', 'bebes'].reduce((s, k) => s + (Number(c[k]) || 0), 0) },
    adulto: { rotulo: 'por adulto (inclui idosos e gestantes)', contar: (c) => (Number(c.adultos) || 0) + (Number(c.idosos) || 0) + (Number(c.gestantes) || 0) },
    crianca: { rotulo: 'por criança', contar: (c) => Number(c.criancas) || 0 },
    bebe: { rotulo: 'por bebê', contar: (c) => Number(c.bebes) || 0 },
    idoso: { rotulo: 'por idoso', contar: (c) => Number(c.idosos) || 0 },
    gestante: { rotulo: 'por gestante', contar: (c) => Number(c.gestantes) || 0 },
    familia: { rotulo: 'por família', contar: () => 1 },
  };

  /**
   * Divide um item do estoque comum (fraldas, latas, sabonete…) entre as famílias.
   * @param {{total:number, criterio:string, porDia:number}} item porDia: quanto cada um usa por dia
   * @param {Array<{nome:string, casa:object, vulneravel?:boolean}>} familias
   */
  function distribuirItem(item, familias, { dias = 1 } = {}) {
    const crit = CRITERIOS[item && item.criterio];
    if (!crit) throw new RangeError('Critério de partilha inválido.');
    const porDia = naoNegativo(item.porDia);
    const demandas = (familias || []).map((f) => ({ nome: f.nome, vulneravel: f.vulneravel, necessidade: crit.contar(f.casa || {}) * porDia }));
    const r = distribuir(naoNegativo(item.total), demandas, { dias });
    // Itens contados em unidades: arredonda para baixo e devolve o resto para a sobra.
    for (const f of r.porFamilia) f.alocado = Math.floor(f.alocado);
    r.distribuido = r.porFamilia.reduce((s, f) => s + f.alocado, 0);
    r.resto = Math.max(0, naoNegativo(item.total) - r.distribuido);
    return r;
  }

  /** Quantos dias o estoque comum dura atendendo 100 % da necessidade de todos. */
  function diasDeEstoque(total, necessidadeDiariaTotal) {
    const t = naoNegativo(total);
    const n = naoNegativo(necessidadeDiariaTotal);
    return n > 0 ? Math.floor((t / n) * 10) / 10 : null;
  }

  return { distribuir, diasDeEstoque, CRITERIOS, distribuirItem };
});
