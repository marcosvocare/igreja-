/**
 * Mecanismo: Purificação de água.
 *
 * Dosagem de hipoclorito de sódio (água sanitária) por volume, tempo de fervura
 * por altitude e guia de métodos. Referência: 2 gotas de solução a 2,5 % por litro,
 * 30 minutos de contato (orientação do Ministério da Saúde para consumo humano).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).agua = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ML_POR_GOTA = 0.05;
  const ML_POR_COLHER_CHA = 5;
  const CONCENTRACAO_REFERENCIA = 2.5; // %
  const GOTAS_POR_LITRO_REFERENCIA = 2;
  const MINUTOS_CONTATO = 30;

  /**
   * Quantidade de água sanitária para desinfetar um volume de água.
   * @param {number} litros volume de água
   * @param {number} [concentracao=2.5] teor de cloro ativo do produto, em %
   * @param {{turva?: boolean}} [opcoes] água turva: filtrar antes e dobrar a dose
   */
  function dosagemHipoclorito(litros, concentracao = CONCENTRACAO_REFERENCIA, { turva = false } = {}) {
    const v = Number(litros);
    const c = Number(concentracao);
    if (!Number.isFinite(v) || v <= 0) throw new RangeError('Informe um volume de água maior que zero.');
    if (v > 100000) throw new RangeError('Volume acima de 100.000 L: procure orientação técnica.');
    if (!Number.isFinite(c) || c < 1 || c > 15) {
      throw new RangeError('A concentração deve estar entre 1 % e 15 % de cloro ativo.');
    }

    const fator = turva ? 2 : 1;
    const gotasExatas = v * GOTAS_POR_LITRO_REFERENCIA * (CONCENTRACAO_REFERENCIA / c) * fator;
    const gotas = Math.max(1, Math.round(gotasExatas));
    const ml = Math.round(gotasExatas * ML_POR_GOTA * 10) / 10;

    const avisos = ['Use água sanitária SEM perfume, sem alvejante colorido e sem aditivos.'];
    if (turva) avisos.push('Água turva: deixe decantar e filtre em pano limpo antes de clorar.');
    if (c > 5) avisos.push('Produto concentrado: meça com conta-gotas ou seringa, nunca "a olho".');
    avisos.push('Depois do tempo de espera a água deve ter um leve cheiro de cloro. Sem cheiro: repita a dose e espere mais 15 minutos.');

    return {
      litros: v,
      concentracao: c,
      turva: Boolean(turva),
      gotas,
      ml,
      colheresDeCha: ml >= ML_POR_COLHER_CHA ? Math.round((ml / ML_POR_COLHER_CHA) * 10) / 10 : null,
      minutosEspera: MINUTOS_CONTATO,
      avisos,
    };
  }

  /** Tempo de fervura vigorosa em minutos (3 min acima de 2.000 m de altitude). */
  function tempoFervura(altitudeMetros = 0) {
    const a = Number(altitudeMetros);
    if (!Number.isFinite(a) || a < -500 || a > 9000) throw new RangeError('Altitude inválida.');
    return a > 2000 ? 3 : 1;
  }

  /** Métodos de purificação em ordem de preferência. */
  const METODOS = [
    {
      id: 'fervura',
      titulo: 'Fervura',
      passos: [
        'Se a água estiver turva, deixe decantar e coe em pano limpo.',
        'Ferva em fervura vigorosa (bolhas grandes) por 1 minuto — 3 minutos acima de 2.000 m.',
        'Deixe esfriar tampada. Para melhorar o gosto, passe de um recipiente limpo para outro algumas vezes.',
      ],
      limites: 'Gasta gás/combustível. Não remove produtos químicos.',
    },
    {
      id: 'cloracao',
      titulo: 'Cloração (água sanitária)',
      passos: [
        'Use água sanitária comum (2,0 % a 2,5 %) sem perfume.',
        'Pingue 2 gotas por litro (água turva: filtre e use 4 gotas).',
        'Misture, tampe e aguarde 30 minutos antes de beber.',
      ],
      limites: 'Não remove produtos químicos nem metais. Menos eficaz em água muito turva.',
    },
    {
      id: 'sodis',
      titulo: 'Desinfecção solar (SODIS)',
      passos: [
        'Use garrafas PET transparentes, sem rótulo, de até 2 litros.',
        'Encha com água limpa (não turva) e deite as garrafas sobre telha ou superfície metálica ao sol.',
        'Deixe 6 horas de sol forte — ou 2 dias seguidos se o céu estiver nublado.',
      ],
      limites: 'Não funciona com água turva nem em dias de chuva contínua.',
    },
    {
      id: 'filtragem',
      titulo: 'Filtragem',
      passos: [
        'Filtro de barro com vela, filtro de pano ou camadas de areia e carvão retiram sujeira.',
        'Depois de filtrar, SEMPRE ferva ou clore a água.',
      ],
      limites: 'Filtragem sozinha não elimina vírus e bactérias.',
    },
  ];

  /** Fontes de água de emergência que muitas casas já têm. */
  const FONTES_EMERGENCIA = [
    'Caixa d\'água: feche o registro de entrada se houver aviso de contaminação da rede.',
    'Tubulação da casa: abra a torneira mais baixa para aproveitar a água parada nos canos.',
    'Aquecedor de passagem/boiler: pode conter dezenas de litros (desligue o aquecimento antes).',
    'Gelo do freezer e líquidos de frutas e legumes em conserva.',
    'Água da chuva: só para limpeza e descarga, ou para beber depois de filtrar E desinfetar.',
    'Nunca use água de enchente, de radiador, de piscina com produtos químicos ou de descarga com aditivos.',
  ];

  return { dosagemHipoclorito, tempoFervura, METODOS, FONTES_EMERGENCIA };
});
