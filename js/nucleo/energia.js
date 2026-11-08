/**
 * Mecanismo: Energia sem a rede elétrica.
 *
 * Soma o consumo diário dos aparelhos essenciais (celulares, rádios,
 * lanternas, aparelhos de saúde) e calcula o painel solar, a bateria e os
 * power banks necessários. Valores de consumo são típicos; confira a etiqueta.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).energia = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Consumo típico: whPorUso = energia de 1 uso (carga, hora ou dia), conforme `unidade`. */
  const APARELHOS = {
    celular: { rotulo: 'Carga completa de celular', whPorUso: 18, unidade: 'cargas por dia' },
    radio_lora: { rotulo: 'Rádio LoRa (Meshtastic) ligado o dia todo', whPorUso: 3, unidade: 'rádios' },
    lanterna: { rotulo: 'Lanterna LED', whPorUso: 1, unidade: 'horas por dia' },
    lampada: { rotulo: 'Lâmpada LED de 9 W', whPorUso: 9, unidade: 'horas por dia' },
    radio_fm: { rotulo: 'Rádio AM/FM', whPorUso: 2, unidade: 'horas por dia' },
    notebook: { rotulo: 'Notebook', whPorUso: 45, unidade: 'horas por dia' },
    ventilador: { rotulo: 'Ventilador pequeno', whPorUso: 30, unidade: 'horas por dia' },
    nebulizador: { rotulo: 'Nebulizador', whPorUso: 80, unidade: 'horas por dia' },
  };

  const PAINEIS_COMERCIAIS = [10, 20, 30, 50, 100, 150, 200, 300, 400, 550];
  const PROFUNDIDADE_DESCARGA = { litio: 0.8, chumbo: 0.5 };

  function positivo(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Consumo diário em Wh.
   * @param {Array<{aparelho?:string, watts?:number, quantidade:number}>} itens
   *   aparelho da lista, ou `watts` (por hora) para um aparelho próprio
   */
  function consumoDiario(itens) {
    let total = 0;
    const detalhe = [];
    for (const i of itens || []) {
      const qtd = positivo(i.quantidade);
      if (!qtd) continue;
      const base = i.aparelho && APARELHOS[i.aparelho] ? APARELHOS[i.aparelho].whPorUso : positivo(i.watts);
      const wh = base * qtd;
      total += wh;
      detalhe.push({ ...i, wh });
    }
    return { whDia: Math.round(total * 10) / 10, detalhe };
  }

  /**
   * Painel solar para repor o consumo diário.
   * @param {number} whDia
   * @param {{horasSol?:number, eficiencia?:number}} [opcoes] horasSol: horas de sol pleno por dia
   *   (no Brasil, de 4 a 6; use 3,5 no inverno do Sul); eficiencia: perdas de cabos, controlador e bateria
   */
  function dimensionarPainel(whDia, { horasSol = 4.5, eficiencia = 0.7 } = {}) {
    const wh = positivo(whDia);
    if (!wh) return { watts: 0, comercial: 0 };
    const watts = Math.ceil(wh / (horasSol * eficiencia));
    return { watts, comercial: PAINEIS_COMERCIAIS.find((p) => p >= watts) || Math.ceil(watts / 100) * 100 };
  }

  /**
   * Bateria para guardar energia para N dias sem sol.
   * @param {{dias?:number, tensao?:number, tipo?:'litio'|'chumbo'}} [opcoes]
   */
  function dimensionarBateria(whDia, { dias = 2, tensao = 12, tipo = 'litio' } = {}) {
    const wh = positivo(whDia);
    const prof = PROFUNDIDADE_DESCARGA[tipo];
    if (!prof) throw new RangeError('Tipo de bateria: litio ou chumbo.');
    const whNecessario = wh * dias / prof;
    return { whNecessario: Math.ceil(whNecessario), ah: Math.ceil(whNecessario / tensao) };
  }

  /** Quantos dias um conjunto de power banks segura o consumo (65 % da capacidade chega ao aparelho). */
  function diasPowerbank(whDia, { mah = 10000, quantidade = 1 } = {}) {
    const wh = positivo(whDia);
    if (!wh) return null;
    const util = (positivo(mah) * 3.7) / 1000 * 0.65 * positivo(quantidade);
    return Math.floor((util / wh) * 10) / 10;
  }

  const DICAS = [
    'Painel virado para o norte, inclinado mais ou menos na latitude da cidade, sem sombra das 9h às 15h.',
    'Use um controlador de carga entre o painel e a bateria; nunca ligue o painel direto na bateria.',
    'Bateria de carro serve, mas dura pouco se for descarregada além da metade.',
    'Gerador a combustível só ao ar livre, longe de portas e janelas: o monóxido de carbono mata sem cheiro.',
    'Carregue tudo de dia, quando há sol; à noite use só o essencial.',
    'Aparelhos de saúde (oxigênio, nebulizador, insulina em geladeira) têm prioridade na energia da comunidade.',
  ];

  return { APARELHOS, PAINEIS_COMERCIAIS, consumoDiario, dimensionarPainel, dimensionarBateria, diasPowerbank, DICAS };
});
