/**
 * Mecanismo: Protocolos por cenário (antes / durante / depois).
 *
 * Baseado em orientações gerais da Defesa Civil, Corpo de Bombeiros e
 * Ministério da Saúde. Sempre siga as instruções oficiais locais.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cenarios = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const CENARIOS = [
    {
      id: 'enchente',
      titulo: 'Enchente e alagamento',
      sinais: ['Chuva forte por horas', 'Bueiros transbordando', 'Rio ou córrego subindo rápido', 'Alerta da Defesa Civil'],
      antes: [
        'Saiba se sua rua alaga e qual é o ponto alto mais próximo.',
        'Guarde documentos, remédios e eletrônicos em sacos plásticos, no alto.',
        'Limpe calhas e ralos antes da estação de chuvas.',
        'Deixe o kit de 72 h pronto e o carro fora de áreas que alagam.',
      ],
      durante: [
        'Se a água vai entrar: desligue a energia no quadro geral (com mãos e pés secos) e feche o gás.',
        'Suba para o andar mais alto ou saia para o ponto alto antes que a rua encha.',
        'Não ande nem dirija em água corrente: 15 cm podem derrubar uma pessoa e 30 cm arrastam um carro.',
        'Fique longe de bueiros, valas e fios elétricos.',
      ],
      depois: [
        'Só volte com liberação da Defesa Civil; verifique rachaduras antes de entrar.',
        'Use botas e luvas na limpeza: a água de enchente pode transmitir leptospirose.',
        'Descarte alimentos que tiveram contato com a água (latas intactas podem ser lavadas e desinfetadas).',
        'Lave e desinfete a casa e a caixa d\'água com água sanitária, seguindo o rótulo.',
        'Febre, dor no corpo e na panturrilha até 30 dias depois: procure o posto de saúde e conte que teve contato com enchente.',
      ],
      acionar: ['193', '199'],
    },
    {
      id: 'deslizamento',
      titulo: 'Deslizamento de terra',
      sinais: [
        'Rachaduras novas em paredes, pisos ou no terreno',
        'Portas e janelas emperrando de repente',
        'Árvores, postes ou muros inclinando',
        'Água barrenta ou minando do barranco',
        'Estalos ou barulho de terra se movendo',
      ],
      antes: [
        'Se mora em encosta, peça vistoria à Defesa Civil (199).',
        'Não corte o barranco, não jogue lixo nem água servida na encosta.',
        'Combine com os vizinhos um sinal de alerta (apito, sirene, grupo de mensagens).',
      ],
      durante: [
        'Ao ver sinais de movimento, saia imediatamente e avise os vizinhos.',
        'Afaste-se da encosta pelas laterais, nunca na direção da descida da terra.',
        'Em chuva forte e contínua em área de risco, saia preventivamente para o abrigo combinado.',
      ],
      depois: [
        'Não volte até a Defesa Civil liberar: novos deslizamentos são comuns.',
        'Não tente resgatar soterrados sem equipe — chame 193 e indique o local exato.',
      ],
      acionar: ['199', '193'],
    },
    {
      id: 'apagao',
      titulo: 'Apagão prolongado',
      sinais: ['Falta de energia em todo o bairro', 'Previsão de religamento longa ou inexistente'],
      antes: [
        'Tenha lanternas, pilhas, rádio e power banks carregados.',
        'Saiba abrir manualmente o portão eletrônico e a porta da garagem.',
        'Quem depende de aparelhos elétricos deve ter um plano (bateria extra, lugar com gerador).',
      ],
      durante: [
        'Desligue aparelhos da tomada para evitar queima na volta da energia; deixe uma lâmpada ligada para saber quando voltar.',
        'Mantenha geladeira e freezer fechados: geladeira conserva por cerca de 4 h; freezer cheio, até 48 h.',
        'Prefira lanternas a velas. Se usar vela, nunca a deixe sem vigilância.',
        'Gerador e fogareiro a carvão NUNCA em ambiente fechado (monóxido de carbono mata).',
        'Em prédios, a bomba d\'água para: economize a água da caixa.',
      ],
      depois: [
        'Descarte alimentos perecíveis que ficaram acima de 5 °C por mais de 2 horas.',
        'Verifique remédios refrigerados (insulina e outros) conforme a bula.',
        'Religue os aparelhos aos poucos.',
      ],
      acionar: ['Concessionária de energia'],
    },
    {
      id: 'falta_agua',
      titulo: 'Falta d\'água prolongada',
      sinais: ['Torneiras secas', 'Aviso de rodízio ou manutenção da companhia', 'Seca prolongada'],
      antes: [
        'Mantenha reserva de 4 L por pessoa por dia, por pelo menos 3 dias (meta: 7 a 14).',
        'Troque a água armazenada a cada 6 meses.',
      ],
      durante: [
        'Prioridade: beber > preparar comida > lavar as mãos > banho > limpeza.',
        'Reaproveite: água do banho e da máquina de lavar vai para a descarga e o chão.',
        'Água de caminhão-pipa ou de fonte desconhecida: filtre e desinfete antes de beber.',
        'Mantenha todos os recipientes tampados (dengue, zika e chikungunya).',
      ],
      depois: [
        'Deixe a torneira correr alguns minutos quando a água voltar (pode vir turva).',
        'Reponha a reserva assim que possível.',
      ],
      acionar: ['Companhia de saneamento'],
    },
    {
      id: 'incendio',
      titulo: 'Incêndio em casa ou prédio',
      sinais: ['Cheiro de queimado', 'Fumaça', 'Alarme de incêndio'],
      antes: [
        'Conheça duas rotas de saída e as escadas de emergência do prédio.',
        'Tenha um extintor e saiba usá-lo; não sobrecarregue tomadas.',
        'Defina um ponto de encontro do lado de fora.',
      ],
      durante: [
        'Saia imediatamente e ligue 193 de fora. Não use elevador.',
        'Antes de abrir uma porta, toque nela com as costas da mão: se estiver quente, use outra saída.',
        'Fumaça: ande abaixado, perto do chão, cobrindo nariz e boca com pano.',
        'Feche as portas atrás de você para atrasar o fogo.',
        'Roupa pegando fogo: pare, deite e role.',
        'Se ficar preso: vede as frestas com panos molhados, vá para a janela e sinalize.',
      ],
      depois: [
        'Não volte para buscar nada. Só entre com liberação dos bombeiros.',
        'Quem inalou fumaça deve ser avaliado por um médico, mesmo sem sintomas.',
      ],
      acionar: ['193', '192'],
    },
    {
      id: 'calor',
      titulo: 'Onda de calor',
      sinais: ['Temperaturas muito acima do normal por vários dias', 'Alerta meteorológico'],
      antes: [
        'Identifique lugares frescos próximos (igreja, biblioteca, shopping) para passar as horas mais quentes.',
        'Combine visitas a idosos que moram sozinhos.',
      ],
      durante: [
        'Beba água mesmo sem sede; evite álcool e bebidas muito açucaradas.',
        'Evite o sol e esforço físico entre 10h e 16h.',
        'Use roupas leves e claras; mantenha a casa ventilada e com cortinas fechadas durante o dia.',
        'Nunca deixe crianças, idosos ou animais dentro de carro fechado.',
        'Pele quente e seca, confusão, desmaio: é insolação. Ligue 192, leve para a sombra e resfrie com panos molhados.',
      ],
      depois: ['Verifique como estão os vizinhos idosos e doentes.'],
      acionar: ['192'],
    },
    {
      id: 'tiroteio',
      titulo: 'Tiroteio e violência urbana',
      sinais: ['Disparos próximos', 'Movimentação armada', 'Alerta de grupos comunitários'],
      antes: [
        'Identifique o cômodo mais protegido da casa: interno, com paredes de alvenaria, sem janelas para a rua.',
        'Participe de grupos de alerta do bairro e combine códigos com a família.',
      ],
      durante: [
        'Na rua: deite no chão ou abrigue-se atrás de estruturas de concreto; não corra em campo aberto.',
        'Em casa: vá para o cômodo protegido, deite no chão, longe de portas e janelas.',
        'Silencie o celular; não vá à janela e não filme.',
        'Avise a família por mensagem de texto que está abrigado.',
        'Ligue 190 quando for seguro falar.',
      ],
      depois: [
        'Espere a confirmação de que acabou antes de sair.',
        'Busque apoio emocional — crianças em especial precisam conversar sobre o que viveram.',
      ],
      acionar: ['190', '192'],
    },
    {
      id: 'gas',
      titulo: 'Vazamento de gás',
      sinais: ['Cheiro forte de gás', 'Chiado perto do botijão ou da tubulação'],
      antes: [
        'Verifique a validade da mangueira e do regulador do botijão.',
        'Mantenha o botijão em local ventilado.',
      ],
      durante: [
        'Não acenda luzes, não acione interruptores, não use fósforo nem isqueiro.',
        'Feche o registro do gás e abra portas e janelas.',
        'Saia do local e ligue 193 ou para a companhia de gás de fora do imóvel.',
      ],
      depois: ['Só religue o gás após verificação técnica.'],
      acionar: ['193', 'Companhia de gás'],
    },
    {
      id: 'desabastecimento',
      titulo: 'Desabastecimento (greves, bloqueios, crises)',
      sinais: ['Prateleiras vazias', 'Filas em postos', 'Falta de remédios nas farmácias'],
      antes: [
        'Mantenha o estoque rotativo da casa (7 a 14 dias) e remédios contínuos para 1 mês.',
        'Tenha algum dinheiro em espécie.',
      ],
      durante: [
        'Não compre em pânico: compre o necessário e deixe para os outros.',
        'Use o estoque na ordem de validade e planeje o racionamento pelos dias previstos.',
        'Combine com a rede de apoio da comunidade compras coletivas e partilha.',
        'Economize combustível: só deslocamentos essenciais e caronas.',
      ],
      depois: ['Reponha o estoque aos poucos, sem pressionar o comércio.'],
      acionar: [],
    },
    {
      id: 'epidemia',
      titulo: 'Epidemia e emergência sanitária',
      sinais: ['Aumento de casos no bairro', 'Comunicado das autoridades de saúde'],
      antes: [
        'Mantenha a vacinação em dia.',
        'Tenha termômetro, máscaras, álcool em gel e soro de reidratação oral.',
      ],
      durante: [
        'Lave as mãos com frequência e use máscara quando recomendado.',
        'Isole o doente em um cômodo, com um único cuidador, se possível.',
        'Siga as orientações das autoridades de saúde; desconfie de boatos.',
        'Sinais de alerta (falta de ar, desidratação, confusão): procure atendimento ou ligue 192.',
      ],
      depois: ['Limpe e desinfete superfícies e reponha os itens de saúde.'],
      acionar: ['192', 'Posto de saúde'],
    },
    {
      id: 'vendaval',
      titulo: 'Vendaval e tempestade',
      sinais: ['Ventos fortes', 'Granizo', 'Raios'],
      antes: [
        'Pode árvores com orientação da prefeitura e prenda objetos soltos no quintal e na laje.',
      ],
      durante: [
        'Fique dentro de casa, longe de janelas; desligue aparelhos da tomada.',
        'Na rua: afaste-se de árvores, postes, placas e fios. Não se abrigue sob árvores.',
        'Fio caído: não toque nem chegue perto; avise 193 e a concessionária de energia.',
      ],
      depois: ['Cuidado com fios caídos e estruturas danificadas; registre danos com fotos.'],
      acionar: ['193', '199', 'Concessionária de energia'],
    },
  ];

  function buscarCenario(id) {
    return CENARIOS.find((c) => c.id === id) || null;
  }

  return { CENARIOS, buscarCenario };
});
