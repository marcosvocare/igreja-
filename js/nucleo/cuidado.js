/**
 * Mecanismo: Cuidado emocional e espiritual.
 *
 * Primeiros cuidados psicológicos (observar, escutar, aproximar), atenção às
 * crianças, luto, cuidar de quem cuida, e uma conferência simples de sinais
 * de alerta. Não é diagnóstico: orienta a não deixar ninguém sozinho e a
 * chamar a equipe de saúde e a liderança da igreja quando preciso.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cuidado = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GUIAS = [
    {
      id: 'acolher',
      titulo: 'Acolher quem passou por algo difícil',
      passos: [
        'Observe: a pessoa está segura, ferida, com fome, com frio? Primeiro o básico.',
        'Aproxime-se com calma, diga seu nome e pergunte se pode ajudar.',
        'Escute sem pressa e sem forçar a pessoa a contar o que aconteceu.',
        'Não prometa o que não pode cumprir; diga o que sabe e o que não sabe.',
        'Ajude a pessoa a se reconectar: família, vizinhos, a igreja, as equipes da comunidade.',
        'Combine quando você volta, e volte.',
      ],
    },
    {
      id: 'criancas',
      titulo: 'Crianças',
      passos: [
        'Mantenha as crianças perto dos seus cuidadores. Separar dói mais que o desconforto.',
        'Rotina ajuda: horário de comer, brincar, rezar e dormir, mesmo no abrigo.',
        'Explique o que está acontecendo com palavras simples e verdadeiras.',
        'Deixe brincar, desenhar e contar do jeito delas; não force a falar.',
        'Proteja de imagens e conversas assustadoras.',
        'Volta a fazer xixi na cama, medo de dormir sozinha, birra: é comum. Paciência e colo.',
      ],
    },
    {
      id: 'luto',
      titulo: 'Luto e perdas',
      passos: [
        'Permita chorar, ficar em silêncio ou rezar. Cada um vive a perda de um jeito.',
        'Faça os rituais possíveis: oração, culto, um memorial com nome e foto.',
        'Ajuda prática conta muito: comida, cuidar das crianças, companhia.',
        'Lembre a pessoa de comer, beber água e descansar.',
      ],
    },
    {
      id: 'quem_cuida',
      titulo: 'Cuidar de quem cuida',
      passos: [
        'Faça rodízio: ninguém aguenta cuidar de todos o tempo todo.',
        'Durma, coma e beba água. Cansaço vira erro e briga.',
        'Converse com alguém de confiança sobre o que viu e sentiu.',
        'Reconheça seus limites e passe adiante o que não dá conta.',
      ],
    },
    {
      id: 'roda',
      titulo: 'Roda de conversa na igreja',
      passos: [
        'Grupo pequeno (até 10), lugar tranquilo, uns 40 minutos.',
        'Comece com uma oração ou um momento de silêncio.',
        'Cada um fala se quiser; ninguém interrompe nem aconselha sem ser pedido.',
        'Termine com algo prático: quem precisa de quê, e quem pode ajudar.',
      ],
    },
  ];

  /** Perguntas de conferência; alerta: true = sinal de perigo imediato. */
  const PERGUNTAS = [
    { id: 'dormir', texto: 'Está há vários dias quase sem dormir?', alerta: false },
    { id: 'comer', texto: 'Está há dias sem conseguir comer?', alerta: false },
    { id: 'isolar', texto: 'Está se isolando de todos?', alerta: false },
    { id: 'panico', texto: 'Tem crises de medo, falta de ar ou tremedeira sem causa física?', alerta: false },
    { id: 'beber', texto: 'Está bebendo ou usando drogas para aguentar?', alerta: false },
    { id: 'morte', texto: 'Fala em morrer, sumir ou se machucar?', alerta: true },
  ];

  /**
   * Conferência de bem-estar a partir das respostas ({id: true}).
   * @returns {{nivel:'bem'|'atencao'|'urgente', orientacao:string}}
   */
  function conferir(respostas = {}) {
    const sim = PERGUNTAS.filter((p) => respostas[p.id] === true);
    if (sim.some((p) => p.alerta)) {
      return {
        nivel: 'urgente',
        orientacao: 'Não deixe a pessoa sozinha. Chame agora a equipe de saúde e a liderança da igreja, tire de perto objetos que possam machucar e fique junto, escutando.',
      };
    }
    if (sim.length >= 2) {
      return {
        nivel: 'atencao',
        orientacao: 'A pessoa precisa de companhia e acompanhamento: combine visitas diárias, garanta comida e descanso e avise a equipe de saúde.',
      };
    }
    return { nivel: 'bem', orientacao: 'Siga perto: uma conversa por dia e atenção a mudanças.' };
  }

  return { GUIAS, PERGUNTAS, conferir };
});
