/**
 * Mecanismo: Protocolos por cenário (antes / durante / depois).
 *
 * Cenário sem serviços do Estado: quem socorre são as equipes da comunidade.
 * `acionar` traz os ids das equipes (situacao.EQUIPES).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cenarios = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const COLAPSO = {
    id: 'colapso',
    titulo: 'Colapso e desordem',
    sinais: [
      'Saques e violência no bairro',
      'Grupos armados ou bloqueios nas ruas',
      'Falta de água, energia e comida ao mesmo tempo, por dias',
    ],
    antes: [
      'Organize a rede da igreja em equipes: vigilância, saúde, água, alimentação, comunicação e incêndio.',
      'Mapeie fontes de água, remédios, alimentos e os pontos de perigo do bairro (aba Mapa).',
      'Combine com a comunidade a frase da senha do dia e o código de apitos (aba Defesa).',
      'Faça a avaliação de segurança da casa e da igreja e corrija as prioridades.',
      'Junte remédios de uso contínuo para pelo menos 30 dias, com receita.',
    ],
    durante: [
      'Reúna as pessoas: famílias vizinhas juntas ou no ponto de apoio da igreja ficam mais seguras que casas isoladas.',
      'Vigia em duplas, com escala e descanso. Vigia observa e avisa, não enfrenta.',
      'Não reaja a saques nem a assaltos: nenhum bem vale uma vida.',
      'Saia só em grupo, de dia, por rotas que evitam os perigos do mapa, com hora de volta combinada.',
      'Incêndio: só combata foco pequeno (do tamanho de uma lixeira), com a saída às suas costas. Se crescer, saia, feche a porta e afaste os vizinhos.',
      'Ferimentos: pressione sangramentos com pano limpo, imobilize fraturas e leve, em grupo, à equipe de saúde da comunidade.',
      'Água: beba só água fervida ou clorada. Partilhe alimentos pela rede, de forma justa e organizada (aba Partilha).',
      'Atualize o mapa a cada saída: o que está disponível, esgotado ou perigoso.',
    ],
    depois: [
      'Registre quem ajudou, o que faltou e o que funcionou; atualize o mapa e o plano.',
      'Cuide da saúde emocional: rodas de conversa, oração e atenção às crianças.',
      'Mantenha uma lista de pessoas feridas ou desaparecidas e avise as famílias.',
    ],
    acionar: ['coordenacao', 'vigilancia'],
  };

  const CENARIOS = [
    COLAPSO,
    {
      id: 'enchente',
      titulo: 'Enchente e alagamento',
      sinais: ['Chuva forte por horas', 'Bueiros transbordando', 'Rio ou córrego subindo rápido', 'Alerta da vigilância ou dos vizinhos'],
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
        'Só volte quando a água baixar e a equipe de resgate verificar a casa; procure rachaduras antes de entrar.',
        'Use botas e luvas na limpeza: a água de enchente pode transmitir leptospirose.',
        'Descarte alimentos que tiveram contato com a água (latas intactas podem ser lavadas e desinfetadas).',
        'Lave e desinfete a casa e a caixa d\'água com água sanitária, seguindo o rótulo.',
        'Febre, dor no corpo e na panturrilha até 30 dias depois: procure a equipe de saúde e conte que teve contato com enchente.',
      ],
      acionar: ['resgate', 'coordenacao'],
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
        'Se mora em encosta, peça à equipe de resgate (ou a alguém da rede que entenda de construção) para avaliar o terreno.',
        'Não corte o barranco, não jogue lixo nem água servida na encosta.',
        'Combine com os vizinhos um sinal de alerta (apito, sirene, grupo de mensagens).',
      ],
      durante: [
        'Ao ver sinais de movimento, saia imediatamente e avise os vizinhos.',
        'Afaste-se da encosta pelas laterais, nunca na direção da descida da terra.',
        'Em chuva forte e contínua em área de risco, saia preventivamente para o abrigo combinado.',
      ],
      depois: [
        'Não volte até a equipe de resgate avaliar: novos deslizamentos são comuns.',
        'Não tente resgatar soterrados sozinho: chame a equipe de resgate e indique o local exato.',
      ],
      acionar: ['resgate', 'coordenacao'],
    },
    {
      id: 'apagao',
      titulo: 'Apagão prolongado',
      sinais: ['Falta de energia em todo o bairro', 'Sem previsão de volta da energia'],
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
      acionar: ['coordenacao', 'saude'],
    },
    {
      id: 'ciber',
      titulo: 'Apagão cibernético',
      sinais: [
        'Internet e aplicativos fora do ar em toda a região',
        'Pix, cartões, maquininhas e caixas eletrônicos sem funcionar',
        'Celular sem sinal ou sem conseguir ligar',
        'Mercados, farmácias e postos fechando por falta de sistema',
      ],
      antes: [
        'Abra este app uma vez com internet e instale na tela inicial (aba Dados): assim ele abre sem internet. Confira desligando o wi-fi e os dados.',
        'Imprima o caderno (aba Caderno) e guarde junto com os documentos: papel não depende de nada.',
        'Guarde dinheiro em espécie, em notas pequenas, para pelo menos uma semana de compras básicas.',
        'Anote em papel os telefones e endereços importantes: a lista do celular fica na nuvem e a bateria acaba.',
        'Combine hoje com a família o ponto de encontro, o horário fixo para se encontrar e quem busca as crianças (aba Contatos e mensagens).',
        'Tenha água, comida e remédios de uso contínuo para 3 a 7 dias, com as receitas em papel.',
        'Tenha rádio AM/FM a pilha, pilhas extras e power banks carregados; se puder, os rádios da família (aba Rádio).',
        'Mantenha um botijão de gás reserva e o tanque do carro acima da metade: as bombas dos postos dependem de sistema e de energia.',
      ],
      durante: [
        'Confirme pelo rádio AM/FM se a falha é geral antes de sair ou gastar recursos.',
        'Ponha o celular em modo avião quando não estiver usando e abaixe o brilho: sem rede, ele gasta a bateria procurando sinal.',
        'Para falar com alguém, tente SMS curto em vez de ligação; se tiverem, usem os rádios da família.',
        'Se a família estiver separada, siga o combinado: vá ao ponto de encontro no horário marcado.',
        'Encha garrafas e baldes enquanto ainda sai água da torneira.',
        'Coma primeiro o que está na geladeira; depois, o do armário.',
        'Pague com dinheiro em espécie e combine trocas com os vizinhos; não gaste as reservas nos primeiros dias.',
        'O GPS do celular funciona sem internet (só demora mais para achar a posição), assim como o mapa da cidade e a bússola deste app.',
        'Desconfie de boatos: confirme pelo rádio ou com alguém de confiança antes de repassar.',
        'Fique perto dos vizinhos e da igreja; se durar dias, organizem a vigia (aba Defesa).',
      ],
      depois: [
        'Cuidado com golpes: banco nenhum liga ou manda mensagem pedindo senha ou código; não clique em links de "atualize seus dados" ou "seu Pix foi bloqueado".',
        'Desconfie de "técnicos" que aparecem na porta oferecendo conserto.',
        'Confira o extrato do banco e as compras no cartão assim que os sistemas voltarem.',
        'Troque as senhas do e-mail e do banco se alguém as pediu ou viu.',
        'Reponha dinheiro em espécie, água, comida e pilhas, e imprima de novo o caderno se algo mudou.',
      ],
      acionar: ['coordenacao'],
    },
    {
      id: 'falta_agua',
      titulo: 'Falta d\'água prolongada',
      sinais: ['Torneiras secas', 'Caixas d\'água vazias no bairro', 'Seca prolongada'],
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
      acionar: ['agua', 'coordenacao'],
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
        'Saia imediatamente e dê o alarme (apito longo) para a brigada de incêndio e os vizinhos. Não use elevador.',
        'Foco pequeno: extintor, areia ou abafar com pano molhado. Nunca jogue água em óleo quente nem em fiação ligada.',
        'Antes de abrir uma porta, toque nela com as costas da mão: se estiver quente, use outra saída.',
        'Fumaça: ande abaixado, perto do chão, cobrindo nariz e boca com pano.',
        'Feche as portas atrás de você para atrasar o fogo.',
        'Roupa pegando fogo: pare, deite e role.',
        'Se ficar preso: vede as frestas com panos molhados, vá para a janela e sinalize.',
      ],
      depois: [
        'Não volte para buscar nada. Só entre quando a brigada confirmar que o fogo acabou e a estrutura está firme.',
        'Quem inalou fumaça deve ser avaliado pela equipe de saúde, mesmo sem sintomas.',
      ],
      acionar: ['incendio', 'saude'],
    },
    {
      id: 'calor',
      titulo: 'Onda de calor',
      sinais: ['Temperaturas muito acima do normal por vários dias', 'Noites quentes sem alívio'],
      antes: [
        'Identifique lugares frescos próximos (igreja, biblioteca, shopping) para passar as horas mais quentes.',
        'Combine visitas a idosos que moram sozinhos.',
      ],
      durante: [
        'Beba água mesmo sem sede; evite álcool e bebidas muito açucaradas.',
        'Evite o sol e esforço físico entre 10h e 16h.',
        'Use roupas leves e claras; mantenha a casa ventilada e com cortinas fechadas durante o dia.',
        'Nunca deixe crianças, idosos ou animais dentro de carro fechado.',
        'Pele quente e seca, confusão, desmaio: é insolação. Chame a equipe de saúde, leve para a sombra e resfrie com panos molhados.',
      ],
      depois: ['Verifique como estão os vizinhos idosos e doentes.'],
      acionar: ['saude'],
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
        'Quando for seguro, avise a vigilância pelo rádio (código 3) para alertar os outros.',
      ],
      depois: [
        'Espere a confirmação de que acabou antes de sair.',
        'Busque apoio emocional — crianças em especial precisam conversar sobre o que viveram.',
      ],
      acionar: ['vigilancia', 'saude'],
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
        'Saia do local, afaste as pessoas e chame a brigada de incêndio de fora do imóvel.',
      ],
      depois: ['Só religue o gás depois que alguém da rede que entenda de instalação conferir a mangueira e o registro.'],
      acionar: ['incendio'],
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
      acionar: ['coordenacao'],
    },
    {
      id: 'epidemia',
      titulo: 'Epidemia e emergência sanitária',
      sinais: ['Aumento de casos no bairro', 'Vários doentes com os mesmos sintomas'],
      antes: [
        'Mantenha a vacinação em dia enquanto houver vacina.',
        'Tenha termômetro, máscaras, álcool em gel e soro de reidratação oral.',
      ],
      durante: [
        'Lave as mãos com frequência e use máscara quando recomendado.',
        'Isole o doente em um cômodo, com um único cuidador, se possível.',
        'Siga a orientação da equipe de saúde da comunidade; desconfie de boatos.',
        'Sinais de alerta (falta de ar, desidratação, confusão): chame a equipe de saúde.',
      ],
      depois: ['Limpe e desinfete superfícies e reponha os itens de saúde.'],
      acionar: ['saude'],
    },
    {
      id: 'vendaval',
      titulo: 'Vendaval e tempestade',
      sinais: ['Ventos fortes', 'Granizo', 'Raios'],
      antes: [
        'Pode os galhos que ameaçam a casa e prenda objetos soltos no quintal e na laje.',
      ],
      durante: [
        'Fique dentro de casa, longe de janelas; desligue aparelhos da tomada.',
        'Na rua: afaste-se de árvores, postes, placas e fios. Não se abrigue sob árvores.',
        'Fio caído: não toque nem chegue perto; sinalize o local e avise a brigada e os vizinhos.',
      ],
      depois: ['Cuidado com fios caídos e estruturas danificadas; registre danos com fotos.'],
      acionar: ['incendio', 'resgate'],
    },
  ];

  function buscarCenario(id) {
    return CENARIOS.find((c) => c.id === id) || null;
  }

  return { CENARIOS, buscarCenario };
});
