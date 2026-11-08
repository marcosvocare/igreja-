/**
 * Mecanismo: Kit de emergência de 72 horas (mochila de fuga).
 *
 * Gera a lista personalizada pela composição da casa. Cada item tem um id
 * estável para que o progresso (itens já separados) possa ser salvo.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).kit = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DIAS_KIT = 3;

  function qtd(valor) {
    const n = Number(valor);
    return Number.isInteger(n) && n > 0 ? n : 0;
  }

  /**
   * @param {object} casa {adultos, idosos, gestantes, criancas, bebes, caes, gatos}
   * @param {{remediosContinuos?:boolean, mobilidadeReduzida?:boolean, dependenteEnergia?:boolean}} [extras]
   * @returns {Array<{id:string, titulo:string, itens:Array<{id:string, texto:string}>}>}
   */
  function gerarKit(casa = {}, extras = {}) {
    const adultos = qtd(casa.adultos);
    const idosos = qtd(casa.idosos);
    const gestantes = qtd(casa.gestantes);
    const criancas = qtd(casa.criancas);
    const bebes = qtd(casa.bebes);
    const caes = qtd(casa.caes);
    const gatos = qtd(casa.gatos);
    const pessoas = adultos + idosos + gestantes + criancas + bebes;
    const p = Math.max(pessoas, 1);

    const secoes = [];
    const secao = (id, titulo, itens) => {
      const lista = itens.filter(Boolean).map(([idItem, texto]) => ({ id: `${id}.${idItem}`, texto }));
      if (lista.length) secoes.push({ id, titulo, itens: lista });
    };

    secao('docs', 'Documentos e dinheiro', [
      ['copias', 'Cópias de documentos de identidade e certidões em saco plástico fechado'],
      ['digital', 'Fotos dos documentos salvas no celular e na nuvem'],
      ['dinheiro', 'Dinheiro em espécie em notas pequenas (maquininhas e Pix podem parar)'],
      ['contatos', 'Lista de contatos e pontos de encontro impressa (cartão de bolso)'],
      ['chaves', 'Cópia das chaves de casa e do carro'],
    ]);

    secao('agua', 'Água e comida (3 dias)', [
      ['agua', `Água potável: ${p * 2} L (2 L por pessoa) em garrafas`],
      ['purificar', 'Frasco pequeno de água sanitária sem perfume + conta-gotas, ou pastilhas de cloro'],
      ['comida', `Comida pronta para ${p} pessoa(s) × ${DIAS_KIT} dias: barras, biscoitos, castanhas, enlatados`],
      ['abridor', 'Abridor de latas manual, talheres e copo dobrável'],
    ]);

    secao('saude', 'Saúde', [
      ['primeiros', 'Kit de primeiros socorros: gaze, esparadrapo, curativos, antisséptico, luvas'],
      ['basicos', 'Analgésico/antitérmico e soro de reidratação oral'],
      extras.remediosContinuos && ['continuos', 'Remédios de uso contínuo para 7 dias + cópia das receitas'],
      ['mascaras', 'Máscaras e álcool em gel'],
      ['repelente', 'Repelente e protetor solar'],
    ]);

    secao('luz', 'Luz, energia e comunicação', [
      ['lanterna', 'Lanterna (de preferência de cabeça) + pilhas extras'],
      ['radio', 'Rádio AM/FM a pilha ou a manivela'],
      ['powerbank', 'Power bank carregado + cabos'],
      ['apito', 'Apito (para sinalizar se ficar preso)'],
    ]);

    secao('ferramentas', 'Ferramentas e abrigo', [
      ['canivete', 'Canivete ou ferramenta multiuso'],
      ['fita', 'Fita adesiva resistente (silver tape)'],
      ['fogo', 'Isqueiro e fósforos em saco plástico fechado'],
      ['sacos', 'Sacos de lixo resistentes (servem de capa, forro e vedação)'],
      ['manta', `Manta térmica de emergência: ${p} un`],
      ['capa', 'Capa de chuva'],
    ]);

    secao('roupas', 'Roupas e higiene', [
      ['muda', `Uma muda de roupa e meias por pessoa (${p})`],
      ['calcado', 'Calçado fechado e resistente'],
      ['agasalho', 'Agasalho leve'],
      ['higiene', 'Papel higiênico, sabonete, escova e pasta de dente, absorventes'],
    ]);

    if (bebes) {
      secao('bebes', `Bebês (${bebes})`, [
        ['fraldas', `Fraldas: ${bebes * 6 * DIAS_KIT} un`],
        ['lencos', 'Lenços umedecidos e pomada para assaduras'],
        ['formula', 'Fórmula, mamadeira e água para o preparo (se não for amamentado)'],
        ['roupas', 'Duas mudas de roupa e uma manta por bebê'],
        ['carregador', 'Canguru ou sling (deixa as mãos livres para evacuar)'],
      ]);
    }

    if (criancas) {
      secao('criancas', `Crianças (${criancas})`, [
        ['identificacao', 'Cartão no bolso com nome, contato dos responsáveis e ponto de encontro'],
        ['foto', 'Foto recente de cada criança no celular dos responsáveis'],
        ['distracao', 'Um brinquedo pequeno, livro ou jogo (reduz o estresse)'],
      ]);
    }

    if (idosos || extras.mobilidadeReduzida) {
      secao('cuidados', 'Idosos e pessoas com mobilidade reduzida', [
        ['oculos', 'Óculos reserva e aparelho auditivo com pilhas extras'],
        ['mobilidade', 'Bengala, andador ou cadeira de rodas dobrável à mão'],
        ['ficha', 'Ficha médica: doenças, alergias, remédios e contato do médico'],
        ['fraldas', 'Fraldas geriátricas, se usar'],
      ]);
    }

    if (gestantes) {
      secao('gestantes', `Gestantes (${gestantes})`, [
        ['cartao', 'Caderneta da gestante e exames recentes'],
        ['parto', 'Contato do profissional de saúde da rede que acompanha a gestação'],
      ]);
    }

    if (extras.dependenteEnergia) {
      secao('energia', 'Dependente de energia elétrica', [
        ['plano', 'Plano combinado de para onde ir se faltar energia (hospital, casa com gerador)'],
        ['bateria', 'Baterias extras dos equipamentos (oxigênio, aspirador, cadeira motorizada)'],
        ['termica', 'Bolsa térmica com gelo reutilizável para remédios refrigerados'],
      ]);
    }

    if (caes || gatos) {
      const racao = Math.ceil((caes * 0.3 + gatos * 0.07) * DIAS_KIT * 10) / 10;
      secao('pets', `Animais (${caes + gatos})`, [
        ['racao', `Ração: ${racao} kg e água para 3 dias, com potes`],
        ['guia', 'Coleira com identificação e guia'],
        ['caixa', 'Caixa de transporte (obrigatória em muitos abrigos)'],
        ['vacina', 'Carteira de vacinação e remédios do animal'],
        ['higiene', 'Saquinhos para fezes e areia sanitária'],
      ]);
    }

    return secoes;
  }

  /** Progresso do kit a partir dos ids marcados. */
  function progresso(secoes, marcados = {}) {
    const ids = secoes.flatMap((s) => s.itens.map((i) => i.id));
    const feitos = ids.filter((id) => marcados[id]).length;
    return { feitos, total: ids.length, percentual: ids.length ? Math.round((feitos / ids.length) * 100) : 0 };
  }

  return { gerarKit, progresso };
});
