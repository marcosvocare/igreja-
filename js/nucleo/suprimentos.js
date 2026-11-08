/**
 * Mecanismo: Calculadora de suprimentos.
 *
 * Estima água, calorias, lista de alimentos e itens especiais para uma casa
 * sobreviver N dias sem abastecimento. Valores são estimativas de planejamento,
 * não prescrição nutricional.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).suprimentos = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Necessidade diária por perfil (litros e kcal). */
  const PERFIS = {
    adultos: { rotulo: 'Adultos', beber: 3, higiene: 1, kcal: 2000 },
    idosos: { rotulo: 'Idosos', beber: 2.5, higiene: 1.5, kcal: 1800 },
    gestantes: { rotulo: 'Gestantes/lactantes', beber: 3.5, higiene: 1, kcal: 2400 },
    criancas: { rotulo: 'Crianças (2 a 12 anos)', beber: 2, higiene: 1, kcal: 1400 },
    // Bebês: água para preparo de fórmula + higiene. A fórmula entra em itens especiais.
    bebes: { rotulo: 'Bebês (até 2 anos)', beber: 1, higiene: 1.5, kcal: 0 },
  };

  /** Animais de estimação (porte médio). */
  const PETS = {
    caes: { rotulo: 'Cães', agua: 1, racaoKg: 0.3 },
    gatos: { rotulo: 'Gatos', agua: 0.25, racaoKg: 0.07 },
  };

  /**
   * Composição sugerida do estoque por fatia das calorias totais.
   * kcalPorKg: valor energético aproximado do alimento cru/seco.
   * aguaPreparoPorKg: litros necessários para cozinhar 1 kg.
   */
  const ALIMENTOS = [
    { item: 'Arroz', fatia: 0.25, kcalPorKg: 3600, aguaPreparoPorKg: 2.5, pronto: false },
    { item: 'Feijão ou lentilha', fatia: 0.13, kcalPorKg: 3300, aguaPreparoPorKg: 4, pronto: false },
    { item: 'Macarrão', fatia: 0.08, kcalPorKg: 3700, aguaPreparoPorKg: 3, pronto: false },
    { item: 'Sardinha/atum em lata', fatia: 0.1, kcalPorKg: 2000, aguaPreparoPorKg: 0, pronto: true },
    { item: 'Leite em pó', fatia: 0.1, kcalPorKg: 4900, aguaPreparoPorKg: 7, pronto: false },
    { item: 'Aveia em flocos', fatia: 0.07, kcalPorKg: 3900, aguaPreparoPorKg: 0, pronto: true },
    { item: 'Óleo de cozinha', fatia: 0.07, kcalPorKg: 8800, aguaPreparoPorKg: 0, pronto: false },
    { item: 'Açúcar, rapadura ou mel', fatia: 0.05, kcalPorKg: 3800, aguaPreparoPorKg: 0, pronto: true },
    { item: 'Biscoitos, barras de cereal, castanhas', fatia: 0.1, kcalPorKg: 4500, aguaPreparoPorKg: 0, pronto: true },
    { item: 'Frutas secas, doce em lata, pasta de amendoim', fatia: 0.05, kcalPorKg: 3500, aguaPreparoPorKg: 0, pronto: true },
  ];

  /** Porte dos cães: água (L) e ração (kg) por dia. */
  const PORTES_CAES = {
    pequeno: { rotulo: 'Pequeno (até 10 kg)', agua: 0.5, racaoKg: 0.15 },
    medio: { rotulo: 'Médio (10 a 25 kg)', agua: 1, racaoKg: 0.3 },
    grande: { rotulo: 'Grande (mais de 25 kg)', agua: 2, racaoKg: 0.5 },
  };

  /** Dietas: alimentos que saem da lista (a parte deles é redistribuída) e aviso. */
  const DIETAS = {
    semGluten: {
      rotulo: 'Sem glúten (doença celíaca)',
      remove: ['Macarrão', 'Aveia em flocos'],
      aviso: 'Sem glúten: arroz, feijão, mandioca, milho e tapioca são seguros; nos industrializados, confira "não contém glúten" no rótulo.',
    },
    semLactose: {
      rotulo: 'Sem lactose',
      remove: ['Leite em pó'],
      aviso: 'Sem lactose: se quiser leite, compre leite em pó sem lactose ou bebida vegetal.',
    },
    diabetes: {
      rotulo: 'Diabetes',
      remove: ['Açúcar, rapadura ou mel'],
      aviso: 'Diabetes: guarde açúcar ou balas só para hipoglicemia (uma porção sempre à mão) e prefira feijão, aveia e castanhas.',
    },
    semAmendoim: {
      rotulo: 'Alergia a amendoim ou castanhas',
      remove: ['Frutas secas, doce em lata, pasta de amendoim'],
      aviso: 'Alergia: leia todos os rótulos, inclusive "pode conter traços".',
    },
  };

  /** Lista de alimentos ajustada às dietas da casa, com as partes somando 100 %. */
  function alimentosParaDieta(dietas = {}) {
    const fora = new Set();
    for (const [k, d] of Object.entries(DIETAS)) if (dietas[k]) d.remove.forEach((x) => fora.add(x));
    const lista = ALIMENTOS.filter((a) => !fora.has(a.item)).map((a) => ({ ...a }));
    const soma = lista.reduce((s, a) => s + a.fatia, 0);
    for (const a of lista) {
      a.fatia /= soma;
      if (a.item === 'Biscoitos, barras de cereal, castanhas') {
        if (dietas.semGluten) a.item = dietas.semAmendoim ? 'Biscoitos sem glúten e tapioca (sem amendoim nem castanhas)' : 'Biscoitos sem glúten, tapioca e castanhas';
        else if (dietas.semAmendoim) a.item = 'Biscoitos e barras de cereal sem amendoim nem castanhas';
      }
    }
    return lista;
  }

  const FATOR_CALOR = 1.25; // água de beber em clima quente
  const FRALDAS_POR_DIA = 6;
  const FORMULA_KG_POR_DIA = 0.15;
  const GARRAFAO_LITROS = 20;

  function inteiroNaoNegativo(valor, nome) {
    const n = valor === undefined || valor === null || valor === '' ? 0 : Number(valor);
    if (!Number.isInteger(n) || n < 0) {
      throw new RangeError(`"${nome}" deve ser um número inteiro maior ou igual a zero.`);
    }
    return n;
  }

  function arred(valor, casas = 1) {
    const f = 10 ** casas;
    return Math.round(valor * f) / f;
  }

  function arredCima(valor, casas = 1) {
    const f = 10 ** casas;
    return Math.ceil(valor * f - 1e-9) / f;
  }

  /**
   * Normaliza o perfil da casa.
   * @param {object} casa {adultos, idosos, gestantes, criancas, bebes, caes, gatos}
   */
  function normalizarCasa(casa = {}) {
    const r = {};
    for (const chave of [...Object.keys(PERFIS), ...Object.keys(PETS)]) {
      r[chave] = inteiroNaoNegativo(casa[chave], chave);
    }
    return r;
  }

  function totalPessoas(casa) {
    const c = normalizarCasa(casa);
    return Object.keys(PERFIS).reduce((s, k) => s + c[k], 0);
  }

  /**
   * Necessidade diária da casa (sem água de preparo dos alimentos).
   * @returns {{aguaBeber:number, aguaHigiene:number, aguaPets:number, kcal:number}}
   */
  function necessidadeDiaria(casa, { climaQuente = false, porteCaes = 'medio' } = {}) {
    const c = normalizarCasa(casa);
    let aguaBeber = 0;
    let aguaHigiene = 0;
    let kcal = 0;
    for (const [chave, p] of Object.entries(PERFIS)) {
      aguaBeber += c[chave] * p.beber * (climaQuente ? FATOR_CALOR : 1);
      aguaHigiene += c[chave] * p.higiene;
      kcal += c[chave] * p.kcal;
    }
    let aguaPets = 0;
    for (const [chave, p] of Object.entries(PETS)) {
      const agua = chave === 'caes' ? (PORTES_CAES[porteCaes] || PORTES_CAES.medio).agua : p.agua;
      aguaPets += c[chave] * agua;
    }
    return { aguaBeber, aguaHigiene, aguaPets, kcal };
  }

  /**
   * Calcula o estoque necessário para `dias` dias.
   * @param {object} casa composição da casa
   * @param {{dias:number, climaQuente?:boolean, dietas?:object, porteCaes?:string}} opcoes
   *   dietas: {semGluten, semLactose, diabetes, semAmendoim}; porteCaes: pequeno, medio ou grande
   */
  function calcularSuprimentos(casa, { dias = 3, climaQuente = false, dietas = {}, porteCaes = 'medio' } = {}) {
    const d = Number(dias);
    if (!Number.isInteger(d) || d < 1 || d > 365) {
      throw new RangeError('"dias" deve ser um inteiro entre 1 e 365.');
    }
    const c = normalizarCasa(casa);
    const pessoas = totalPessoas(c);
    const diaria = necessidadeDiaria(c, { climaQuente, porteCaes });
    const kcalTotal = diaria.kcal * d;
    const lista = alimentosParaDieta(dietas);
    const porte = PORTES_CAES[porteCaes] || PORTES_CAES.medio;

    const alimentos = lista.map((a) => {
      const kg = kcalTotal > 0 ? arredCima((kcalTotal * a.fatia) / a.kcalPorKg, 1) : 0;
      return { item: a.item, kg, pronto: a.pronto, aguaPreparo: kg * a.aguaPreparoPorKg };
    }).filter((a) => a.kg > 0);

    const aguaPreparo = alimentos.reduce((s, a) => s + a.aguaPreparo, 0);
    // Quantos dias a comida que dispensa fogão e água cobre sozinha (ex.: sem gás).
    const fatiaPronta = lista.filter((a) => a.pronto).reduce((s, a) => s + a.fatia, 0);
    const diasComidaPronta = diaria.kcal > 0 ? arred(d * fatiaPronta, 1) : 0;
    const agua = {
      beber: arred(diaria.aguaBeber * d),
      higiene: arred(diaria.aguaHigiene * d),
      preparo: arred(aguaPreparo),
      pets: arred(diaria.aguaPets * d),
    };
    agua.total = arred(agua.beber + agua.higiene + agua.preparo + agua.pets);
    agua.garrafoes20L = Math.ceil(agua.total / GARRAFAO_LITROS);

    const especiais = [];
    if (c.bebes > 0) {
      especiais.push({ item: 'Fraldas', quantidade: c.bebes * FRALDAS_POR_DIA * d, unidade: 'un' });
      especiais.push({
        item: 'Fórmula infantil (se não for amamentado)',
        quantidade: arredCima(c.bebes * FORMULA_KG_POR_DIA * d, 1),
        unidade: 'kg',
      });
    }
    if (c.caes > 0) {
      especiais.push({ item: 'Ração para cães', quantidade: arredCima(c.caes * porte.racaoKg * d, 1), unidade: 'kg' });
    }
    if (c.gatos > 0) {
      especiais.push({ item: 'Ração para gatos', quantidade: arredCima(c.gatos * PETS.gatos.racaoKg * d, 1), unidade: 'kg' });
    }
    if (dietas.diabetes && pessoas > 0) {
      especiais.push({ item: 'Açúcar ou balas para hipoglicemia', quantidade: 0.5, unidade: 'kg' });
    }
    if (pessoas > 0) {
      especiais.push({ item: 'Rolos de papel higiênico', quantidade: Math.ceil((pessoas * d) / 4), unidade: 'un' });
      especiais.push({ item: 'Sacos de lixo resistentes (100 L)', quantidade: Math.ceil(d / 2) + pessoas, unidade: 'un' });
    }

    return {
      dias: d,
      pessoas,
      climaQuente: Boolean(climaQuente),
      necessidadeDiaria: {
        aguaLitros: arred(diaria.aguaBeber + diaria.aguaHigiene + diaria.aguaPets + aguaPreparo / d),
        kcal: diaria.kcal,
      },
      agua,
      kcalTotal,
      diasComidaPronta,
      alimentos: alimentos.map(({ item, kg, pronto }) => ({ item, kg, pronto })),
      especiais,
      avisosDieta: Object.entries(DIETAS).filter(([k]) => dietas[k]).map(([, x]) => x.aviso),
    };
  }

  return { PERFIS, PETS, PORTES_CAES, DIETAS, ALIMENTOS, alimentosParaDieta, normalizarCasa, totalPessoas, necessidadeDiaria, calcularSuprimentos };
});
