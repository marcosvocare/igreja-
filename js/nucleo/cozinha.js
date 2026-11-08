/**
 * Mecanismo: Cozinha sem geladeira e com pouco gás.
 *
 * Quanto dura o botijão, como economizar gás, como conservar comida sem
 * geladeira e o que plantar para colher rápido.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cozinha = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIA_MS = 86400000;
  const CONSUMO_QUEIMADOR_KG_H = 0.2; // boca de fogão doméstico em uso
  const FATOR_PANELA_PRESSAO = 0.6; // gasta cerca de 40 % menos

  /**
   * Dias que o gás dura.
   * @param {number} kg gás no botijão (P13 cheio = 13 kg)
   * @param {{horasPorDia?:number, panelaPressao?:boolean, caixaTermica?:boolean}} [opcoes]
   */
  function duracaoGas(kg = 13, { horasPorDia = 1.5, panelaPressao = false, caixaTermica = false } = {}) {
    const k = Number(kg);
    const h = Number(horasPorDia);
    if (!(k > 0 && k <= 500)) throw new RangeError('Informe o gás em kg (botijão comum: 13).');
    if (!(h > 0 && h <= 24)) throw new RangeError('Informe as horas de fogo por dia (0,1 a 24).');
    let porDia = h * CONSUMO_QUEIMADOR_KG_H;
    if (panelaPressao) porDia *= FATOR_PANELA_PRESSAO;
    if (caixaTermica) porDia *= 0.7; // ferve rápido e termina o cozimento na caixa
    return { kgPorDia: Math.round(porDia * 100) / 100, dias: Math.floor(k / porDia) };
  }

  const ECONOMIA = [
    'Deixe feijão, grão-de-bico e lentilha de molho de 8 a 12 horas: cozinham bem mais rápido. Troque a água antes de cozinhar.',
    'Use panela de pressão: gasta cerca de 40 % menos gás.',
    'Panela sempre tampada e chama que não passe do fundo da panela.',
    'Cozimento na caixa térmica: ferva 5 a 10 minutos, feche bem a panela e coloque numa caixa de isopor ou enrolada em cobertores por 1 a 3 horas. Serve para arroz, feijão já fervido, legumes e mingau.',
    'Cozinhe de uma vez para mais de uma refeição (e para mais de uma família).',
    'Fogareiro a lenha ou carvão e fogão improvisado: só ao ar livre, longe de casa (monóxido de carbono e incêndio).',
  ];

  const CONSERVAR = [
    'Coma primeiro o que estraga primeiro: carne, peixe, leite, depois frutas e legumes, por último secos e enlatados.',
    'Carne e peixe frescos sem geladeira: cozinhe no mesmo dia. Sobra cozida, só até o dia seguinte, tampada e em lugar fresco. Na dúvida, descarte.',
    'Ovos que não foram lavados duram algumas semanas em lugar fresco. Teste: no copo d\'água, ovo bom afunda; ovo que boia, descarte.',
    'Frutas e legumes em lugar fresco, seco e ventilado, sem se encostarem.',
    'Pote de barro com areia molhada em volta (geladeira de barro) mantém frutas e verduras frescas por mais tempo.',
    'Frutas, mandioca e banana podem ser secas ao sol, cobertas por tela contra insetos.',
    'Lata estufada, amassada na costura ou com cheiro ruim: jogue fora sem provar.',
  ];

  /** Plantas de colheita rápida: dias do plantio até a colheita (mínimo e máximo). */
  const HORTA = [
    { nome: 'Brotos de feijão ou lentilha (em pote)', min: 3, max: 5 },
    { nome: 'Rabanete', min: 25, max: 35 },
    { nome: 'Rúcula', min: 30, max: 40 },
    { nome: 'Alface', min: 40, max: 60 },
    { nome: 'Cebolinha', min: 60, max: 80 },
    { nome: 'Couve (colhe por meses)', min: 60, max: 80 },
    { nome: 'Feijão-de-corda', min: 60, max: 90 },
    { nome: 'Abóbora', min: 90, max: 120 },
    { nome: 'Batata-doce', min: 120, max: 150 },
    { nome: 'Mandioca', min: 240, max: 360 },
  ];

  /** Janela de colheita de uma planta da HORTA plantada em `plantio` (AAAA-MM-DD). */
  function colheita(nome, plantio) {
    const p = HORTA.find((x) => x.nome === nome);
    if (!p) throw new RangeError(`Planta desconhecida: ${nome}`);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(plantio || ''));
    if (!m) throw new RangeError('Data de plantio no formato AAAA-MM-DD.');
    const base = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    const iso = (t) => new Date(t).toISOString().slice(0, 10);
    return { de: iso(base + p.min * DIA_MS), ate: iso(base + p.max * DIA_MS) };
  }

  return { duracaoGas, ECONOMIA, CONSERVAR, HORTA, colheita };
});
