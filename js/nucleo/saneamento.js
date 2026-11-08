/**
 * Mecanismo: Higiene e saneamento sem água encanada.
 *
 * Doença mata mais que a falta de comida quando o saneamento falha. Usa os
 * padrões mínimos de ajuda humanitária (Projeto Esfera) como referência:
 * até 20 pessoas por banheiro, latrina a 30 m de poços e nascentes, com o
 * fundo 1,5 m acima da água do subsolo.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).saneamento = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PADROES = {
    pessoasPorBanheiro: 20,
    distanciaFonteM: 30,
    fundoAcimaDaAguaM: 1.5,
    sabaoBanhoGramasMes: 250, // por pessoa
    sabaoRoupaGramasMes: 200, // por pessoa
  };

  /**
   * Quantidades para um grupo de pessoas por um período.
   * @param {number} pessoas
   * @param {{dias?:number, gramasPorBarra?:number}} [opcoes]
   */
  function planoSaneamento(pessoas, { dias = 7, gramasPorBarra = 90 } = {}) {
    const p = Number(pessoas);
    const d = Number(dias);
    if (!Number.isInteger(p) || p < 1 || p > 100000) throw new RangeError('Informe de 1 a 100.000 pessoas.');
    if (!Number.isInteger(d) || d < 1 || d > 365) throw new RangeError('Informe de 1 a 365 dias.');
    const banheiros = Math.ceil(p / PADROES.pessoasPorBanheiro);
    const gramas = (PADROES.sabaoBanhoGramasMes + PADROES.sabaoRoupaGramasMes) * p * (d / 30);
    return {
      pessoas: p,
      dias: d,
      banheiros,
      pontosLavagem: banheiros, // um ao lado de cada banheiro
      barrasSabao: Math.ceil(gramas / gramasPorBarra),
      sacosBalde: Math.ceil((p * d) / 4), // banheiro de balde: um saco a cada ~4 pessoas-dia
    };
  }

  const GUIAS = [
    {
      id: 'balde',
      titulo: 'Banheiro de balde (dentro de casa ou do abrigo)',
      passos: [
        'Balde firme com tampa, forrado com saco de lixo resistente (dois sacos, se puder).',
        'Depois de cada uso, cubra com um punhado de serragem, terra seca, cinza ou cal: corta o cheiro e as moscas.',
        'Se der, use outro recipiente só para urina: o balde enche mais devagar e cheira menos.',
        'Feche o saco quando estiver 2/3 cheio e guarde em lugar isolado, ou enterre numa vala de 50 cm longe de qualquer água.',
        'Lave as mãos com água e sabão logo depois.',
      ],
    },
    {
      id: 'latrina',
      titulo: 'Latrina de vala (no quintal ou terreno)',
      passos: [
        'Pelo menos 30 m de poços, nascentes e cisternas, e morro abaixo delas.',
        'O fundo deve ficar 1,5 m acima da água do subsolo: se a vala minar água, cave em outro lugar.',
        'Vala estreita, com tábuas firmes de apoio. Cubra com terra a cada uso e tampe para não entrar mosca.',
        'Quando faltarem 30 cm para encher, aterre bem e marque o lugar.',
        'Um banheiro para cada 20 pessoas, separado para mulheres, com tranca e luz à noite.',
      ],
    },
    {
      id: 'maos',
      titulo: 'Lavar as mãos sem torneira',
      passos: [
        'Depois do banheiro, antes de cozinhar e de comer, depois de cuidar de doente ou de bebê.',
        'Água e sabão, esfregando 20 segundos entre os dedos e as unhas.',
        'Galão com furo e tampa ou garrafa pendurada fazem uma torneira: a água corre e não contamina.',
        'Sem sabão, esfregue com cinza e enxágue bem.',
      ],
    },
    {
      id: 'lixo',
      titulo: 'Lixo, ratos e mosquitos',
      passos: [
        'Separe o lixo orgânico e enterre longe de água, coberto com terra.',
        'Lixo seco em sacos fechados, longe da casa, protegido de ratos e cachorros.',
        'Nada de água parada: tampe baldes e caixas, vire garrafas e pneus (dengue, zika e chikungunya).',
        'Guarde comida em potes fechados e longe do chão.',
      ],
    },
    {
      id: 'agua_usada',
      titulo: 'Água já usada',
      passos: [
        'Água do banho e da roupa serve para a descarga, a limpeza do chão e a horta (sem sabão forte).',
        'Nunca para beber, cozinhar ou lavar alimentos.',
      ],
    },
    {
      id: 'doente',
      titulo: 'Quando alguém tem diarreia ou vômito',
      passos: [
        'Se possível, um balde ou latrina só para o doente.',
        'Limpe o que sujou com água sanitária diluída (1 parte para 10 de água) e luvas.',
        'Quem cuida lava as mãos sempre, e não prepara comida para os outros.',
        'Soro caseiro e a equipe de saúde: veja Primeiros socorros.',
      ],
    },
  ];

  return { PADROES, planoSaneamento, GUIAS };
});
