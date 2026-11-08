/**
 * Mecanismo: Triagem da situação (nível de alerta + decisão "ficar ou sair").
 *
 * Recebe os sinais observados e o contexto da casa e devolve:
 * nível (0–3), postura recomendada, motivos, ações imediatas e qual equipe
 * da comunidade acionar (não há serviços do Estado).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).situacao = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const NIVEIS = [
    { nivel: 0, nome: 'Normal', cor: 'verde' },
    { nivel: 1, nome: 'Atenção', cor: 'amarelo' },
    { nivel: 2, nome: 'Alerta', cor: 'laranja' },
    { nivel: 3, nome: 'Emergência', cor: 'vermelho' },
  ];

  /** Equipes de socorro da comunidade. Os contatos de cada uma ficam na aba Rede de apoio. */
  const EQUIPES = {
    coordenacao: { nome: 'Coordenação da comunidade', faz: 'Decide evacuações, organiza abrigo e partilha' },
    saude: { nome: 'Equipe de saúde', faz: 'Primeiros socorros, doentes e remédios' },
    incendio: { nome: 'Brigada de incêndio', faz: 'Focos de fogo, gás e fios caídos' },
    resgate: { nome: 'Equipe de resgate', faz: 'Enchentes, deslizamentos e retirada de pessoas' },
    vigilancia: { nome: 'Vigilância', faz: 'Alertas, escala de vigia e senha do dia' },
    agua: { nome: 'Equipe de água', faz: 'Fontes, tratamento e distribuição de água' },
  };

  /**
   * risco: 'dentro' = ameaça no imóvel/terreno (leva a evacuar);
   *        'fora'   = ameaça do lado de fora (leva a abrigar no local).
   * cenario: id do protocolo relacionado em cenarios.js.
   */
  const SINAIS = [
    { id: 'alerta_comunidade', cenario: 'enchente', texto: 'Alerta da vigilância ou da coordenação da comunidade', nivel: 1, acionar: [] },
    { id: 'chuva_forte', cenario: 'enchente', texto: 'Chuva forte e contínua por várias horas', nivel: 1, acionar: [] },
    { id: 'energia_curta', cenario: 'apagao', texto: 'Sem energia há menos de 24 horas', nivel: 1, acionar: [] },
    { id: 'rede_instavel', texto: 'Celular/internet instáveis na região', nivel: 1, acionar: [] },
    { id: 'calor_extremo', cenario: 'calor', texto: 'Onda de calor extremo', nivel: 1, acionar: [] },
    { id: 'energia_longa', cenario: 'apagao', texto: 'Sem energia há mais de 24 horas', nivel: 2, acionar: [] },
    { id: 'sem_agua', cenario: 'falta_agua', texto: 'Sem água da rede', nivel: 2, acionar: [] },
    { id: 'desabastecimento', cenario: 'desabastecimento', texto: 'Mercados, farmácias ou postos desabastecidos', nivel: 2, acionar: [] },
    { id: 'saques', cenario: 'colapso', texto: 'Saques ou violência no bairro', nivel: 2, acionar: ['vigilancia', 'coordenacao'] },
    { id: 'doenca_casa', cenario: 'epidemia', texto: 'Alguém da casa com febre/doença contagiosa', nivel: 2, acionar: ['saude'] },
    { id: 'agua_subindo', cenario: 'enchente', texto: 'Água subindo na rua ou entrando em casa', nivel: 3, risco: 'dentro', acionar: ['resgate', 'coordenacao'] },
    { id: 'deslizamento', cenario: 'deslizamento', texto: 'Rachaduras novas, portas emperrando, estalos ou muros/postes inclinando', nivel: 3, risco: 'dentro', acionar: ['resgate', 'coordenacao'] },
    { id: 'fogo', cenario: 'incendio', texto: 'Fogo ou fumaça no imóvel ou no prédio', nivel: 3, risco: 'dentro', acionar: ['incendio'] },
    { id: 'gas', cenario: 'gas', texto: 'Cheiro forte de gás', nivel: 3, risco: 'dentro', acionar: ['incendio'] },
    { id: 'ordem_evacuacao', texto: 'Ordem de evacuação da coordenação da comunidade', nivel: 3, risco: 'dentro', acionar: ['coordenacao'] },
    { id: 'tiroteio', cenario: 'tiroteio', texto: 'Tiroteio ou confronto armado próximo', nivel: 3, risco: 'fora', acionar: ['vigilancia'] },
    { id: 'fumaca_quimica', cenario: 'incendio', texto: 'Nuvem de fumaça ou produto químico do lado de fora', nivel: 3, risco: 'fora', acionar: ['incendio', 'coordenacao'] },
    { id: 'ferido_grave', texto: 'Pessoa ferida ou passando muito mal', nivel: 3, acionar: ['saude'] },
  ];

  const POSTURAS = {
    NORMAL: {
      titulo: 'Rotina normal',
      acoes: [
        'Siga a rotina de manutenção: validades, cargas, kit de 72 h.',
        'Mande o código 1 no rádio da família nos horários combinados e confira quem respondeu.',
      ],
    },
    MONITORAR: {
      titulo: 'Monitorar e preparar',
      acoes: [
        'Acompanhe o rádio da família, a vigilância e os avisos da comunidade.',
        'Carregue celulares e power banks; separe lanternas e pilhas.',
        'Encha garrafas e baldes limpos com água e tampe.',
        'Confira o kit de 72 h e deixe-o perto da porta.',
        'Combine com a família o ponto de encontro e o horário de contato.',
      ],
    },
    PREPARAR_SAIDA: {
      titulo: 'Preparar para sair',
      acoes: [
        'Defina o destino (casa de apoio ou ponto de apoio da igreja) e confirme que podem receber vocês.',
        'Deixe o kit de 72 h, documentos e remédios prontos para sair em 10 minutos.',
        'Saia enquanto a rota é segura e de dia, se possível — não espere virar emergência.',
        'Avise o contato fora da cidade e a rede de apoio para onde vão.',
      ],
    },
    RACIONAR: {
      titulo: 'Racionar e ativar a rede',
      acoes: [
        'Calcule a autonomia do estoque e divida o consumo pelos dias necessários.',
        'Prioridade da água: beber > preparar comida > lavar as mãos > banho.',
        'Ative a árvore de chamadas e verifique as pessoas vulneráveis da rede de apoio.',
        'Evite deslocamentos desnecessários; vá em dupla quando precisar sair.',
      ],
    },
    ABRIGAR: {
      titulo: 'Abrigar no local',
      acoes: [
        'Fique dentro de casa, em cômodo interno com paredes de alvenaria, longe de portas e janelas.',
        'Feche portas e janelas; em caso de fumaça/química, vede frestas com panos molhados e desligue ventiladores e ar-condicionado.',
        'Se houver tiros: deite no chão, silencie o celular, não vá até a janela nem filme.',
        'Avise a família por mensagem de texto onde vocês estão.',
        'Só saia quando a vigilância confirmar que o risco acabou.',
      ],
    },
    SOCORRO: {
      titulo: 'Pedir socorro',
      acoes: [
        'Chame a equipe de saúde da comunidade (rádio: código 2 com a sua posição). Se não responder, mande alguém buscá-la.',
        'Garanta que o local é seguro para você antes de ajudar.',
        'Sangramento: pressione firme com pano limpo. Não remova objetos cravados.',
        'Não movimente quem caiu ou sofreu batida forte, a menos que haja perigo no local.',
        'Mantenha a pessoa aquecida e acompanhada até o socorro chegar.',
      ],
    },
    EVACUAR: {
      titulo: 'Evacuar agora',
      acoes: [
        'Saia imediatamente com as pessoas — pegue o kit de 72 h só se estiver ao alcance.',
        'Ajude crianças, idosos, pessoas com mobilidade reduzida e avise os vizinhos.',
        'Não use elevador. Não atravesse água corrente (15 cm podem derrubar um adulto).',
        'Vá para o ponto de encontro definido e avise o contato fora da cidade.',
        'Não volte para buscar objetos. Só retorne quando a coordenação da comunidade disser que é seguro.',
      ],
    },
  };

  const PORID = Object.fromEntries(SINAIS.map((s) => [s.id, s]));

  /**
   * Avalia a situação.
   * @param {string[]} idsSinais sinais observados (ids de SINAIS)
   * @param {object} [contexto]
   * @param {number|null} [contexto.diasAutonomia] dias de autonomia do estoque
   * @param {boolean} [contexto.dependenteEnergia] alguém depende de energia elétrica
   * @param {boolean} [contexto.rotaSegura=true] há rota de saída segura
   */
  function avaliarSituacao(idsSinais = [], contexto = {}) {
    const desconhecidos = idsSinais.filter((id) => !PORID[id]);
    if (desconhecidos.length) throw new Error(`Sinal desconhecido: ${desconhecidos.join(', ')}`);

    const sinais = [...new Set(idsSinais)].map((id) => PORID[id]);
    const { diasAutonomia = null, dependenteEnergia = false, rotaSegura = true } = contexto;

    const nivel = sinais.reduce((m, s) => Math.max(m, s.nivel), 0);
    const dentro = sinais.filter((s) => s.risco === 'dentro');
    const fora = sinais.filter((s) => s.risco === 'fora');
    const motivos = [];
    const avisos = [];
    let postura;

    if (dentro.length) {
      postura = 'EVACUAR';
      motivos.push(...dentro.map((s) => `Risco no imóvel: ${s.texto.toLowerCase()}.`));
      if (fora.length) {
        avisos.push('Há risco também do lado de fora: saia pelo caminho mais protegido, abaixado, e busque o abrigo seguro mais próximo.');
      }
      if (!rotaSegura) {
        avisos.push('Sem rota segura: vá para o ponto mais alto e seguro do imóvel (ou para longe da encosta), sinalize sua posição (apito: 3 toques repetidos) e chame a equipe de resgate pelo rádio.');
      }
    } else if (fora.length) {
      postura = 'ABRIGAR';
      motivos.push(...fora.map((s) => `Risco do lado de fora: ${s.texto.toLowerCase()}.`));
    } else if (nivel === 3) {
      postura = 'SOCORRO';
      motivos.push(...sinais.filter((s) => s.nivel === 3).map((s) => `${s.texto}.`));
    } else if (nivel === 2) {
      const autonomiaBaixa = diasAutonomia !== null && diasAutonomia !== undefined && Number(diasAutonomia) < 3;
      const energiaCritica = dependenteEnergia && sinais.some((s) => s.id === 'energia_longa');
      if (autonomiaBaixa || energiaCritica) {
        postura = 'PREPARAR_SAIDA';
        if (autonomiaBaixa) motivos.push(`Autonomia do estoque de apenas ${diasAutonomia} dia(s) em crise prolongada.`);
        if (energiaCritica) motivos.push('Pessoa dependente de energia elétrica e falta de energia há mais de 24 h.');
      } else {
        postura = 'RACIONAR';
        motivos.push('Crise prolongada com estoque suficiente: ficar, racionar e apoiar a comunidade.');
      }
    } else if (nivel === 1) {
      postura = 'MONITORAR';
      motivos.push('Sinais de atenção: a situação pode piorar.');
    } else {
      postura = 'NORMAL';
    }

    // Contexto também pede preparação em nível 1 quando a autonomia é muito baixa.
    if (postura === 'MONITORAR' && diasAutonomia !== null && diasAutonomia !== undefined && Number(diasAutonomia) < 1) {
      avisos.push('Estoque para menos de 1 dia: reabasteça água e comida pronta enquanto a situação permite.');
    }

    if (postura !== 'SOCORRO' && sinais.some((s) => s.id === 'ferido_grave')) {
      avisos.push('Há uma pessoa ferida ou passando mal: chame a equipe de saúde assim que estiverem em local seguro.');
    }

    const acionarIds = [...new Set(sinais.flatMap((s) => s.acionar))];
    const acionar = acionarIds.map((id) => ({ id, ...EQUIPES[id] }));

    const cenariosRelacionados = [...new Set(sinais.map((s) => s.cenario).filter(Boolean))];

    const n = NIVEIS[nivel];
    return {
      nivel,
      nomeNivel: n.nome,
      cor: n.cor,
      postura,
      tituloPostura: POSTURAS[postura].titulo,
      motivos,
      avisos,
      acoes: POSTURAS[postura].acoes,
      acionar,
      cenarios: cenariosRelacionados,
    };
  }

  return { NIVEIS, SINAIS, POSTURAS, EQUIPES, avaliarSituacao };
});
