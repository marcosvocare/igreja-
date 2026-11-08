/**
 * Mecanismo: Primeiros socorros passo a passo.
 *
 * Guias curtos para leigos, para quando não há socorro de fora. Cada guia diz
 * quando usar, os passos, o que NÃO fazer e quando é grave (chamar a equipe de
 * saúde da comunidade). Não substitui treinamento: pratique com a equipe.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).socorros = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const GUIAS = [
    {
      id: 'avaliar',
      titulo: 'Primeiro: segurança e chamar ajuda',
      quando: 'Qualquer pessoa ferida ou passando mal.',
      passos: [
        'Veja se o local é seguro para você (fogo, fios, desabamento, tiros). Não vire mais uma vítima.',
        'Fale alto com a pessoa e toque nos ombros: ela responde?',
        'Veja se respira normalmente (olhe o peito subir por até 10 segundos).',
        'Chame a equipe de saúde da comunidade: rádio, código 2 com a sua posição; sem rádio, mande alguém correndo.',
        'Use luvas ou um saco plástico nas mãos se houver sangue.',
      ],
      nao: ['Não mova quem caiu de altura ou bateu a cabeça, a menos que haja perigo no local.'],
      grave: 'Não responde, não respira normalmente, sangra muito ou tem dor forte no peito.',
    },
    {
      id: 'rcp',
      titulo: 'Não responde e não respira: reanimação (RCP)',
      quando: 'A pessoa não reage e não respira, ou só dá suspiros.',
      passos: [
        'Deite a pessoa de costas no chão firme e chame ajuda.',
        'Mãos uma sobre a outra no centro do peito; braços esticados.',
        'Empurre forte e rápido: 100 a 120 vezes por minuto, afundando 5 a 6 cm em adultos. Deixe o peito voltar entre uma e outra.',
        'Não pare até a pessoa reagir, alguém treinado assumir ou você não aguentar mais. Revezem a cada 2 minutos.',
        'Quem é treinado pode fazer 30 compressões e 2 ventilações, repetindo.',
        'Criança: uma ou duas mãos, afundando cerca de 5 cm. Bebê: dois dedos no meio do peito, cerca de 4 cm.',
      ],
      nao: ['Não pare para checar o pulso a toda hora.', 'Não tenha medo de machucar: sem RCP a pessoa morre.'],
      grave: 'Sempre grave: chame a equipe de saúde imediatamente.',
    },
    {
      id: 'sangramento',
      titulo: 'Sangramento forte',
      quando: 'Sangue escorrendo ou jorrando de um ferimento.',
      passos: [
        'Aperte firme sobre o ferimento com pano limpo e não solte por 10 minutos.',
        'Se o pano encharcar, ponha outro por cima, sem tirar o primeiro.',
        'Se for em braço ou perna e não parar com a pressão: torniquete 5 a 8 cm acima do ferimento (nunca sobre a articulação), apertado até o sangramento parar. Anote a hora.',
        'Objeto cravado: não tire; prenda com panos em volta para não mexer.',
        'Deite a pessoa e mantenha-a aquecida.',
      ],
      nao: ['Não tire objetos cravados.', 'Não afrouxe o torniquete: só a equipe de saúde.'],
      grave: 'Sangramento que não para, torniquete colocado, sangue no peito ou na barriga.',
    },
    {
      id: 'engasgo',
      titulo: 'Engasgo',
      quando: 'A pessoa leva as mãos ao pescoço, não consegue falar, tossir ou respirar.',
      passos: [
        'Se tosse com força, só incentive a tossir.',
        'Se não consegue tossir nem falar: fique atrás, punho fechado acima do umbigo, a outra mão por cima, e puxe forte para dentro e para cima (manobra de Heimlich), até sair.',
        'Gestantes e pessoas muito grandes: faça as compressões no meio do peito.',
        'Bebê (menos de 1 ano): de bruços sobre o seu antebraço, cabeça mais baixa, 5 tapas entre as escápulas; vire e faça 5 compressões no meio do peito com dois dedos. Repita.',
        'Se desmaiar: comece a RCP.',
      ],
      nao: ['Não faça compressão na barriga de bebês.', 'Não enfie o dedo na garganta às cegas.'],
      grave: 'Depois de qualquer manobra de Heimlich, a equipe de saúde deve examinar.',
    },
    {
      id: 'queimadura',
      titulo: 'Queimadura',
      quando: 'Pele queimada por fogo, água quente, óleo ou produto químico.',
      passos: [
        'Água corrente fria (não gelada) sobre a queimadura por 20 minutos.',
        'Tire anéis, relógio e roupas que não estejam grudadas na pele.',
        'Cubra com plástico filme ou pano limpo, sem apertar.',
        'Produto químico: lave com muita água por 20 minutos, tirando a roupa atingida.',
      ],
      nao: ['Não passe pasta de dente, manteiga, pó de café nem gelo.', 'Não estoure as bolhas.'],
      grave: 'Maior que a palma da mão da pessoa; no rosto, mãos, pés, genitais ou articulações; elétrica ou química; em crianças e idosos.',
    },
    {
      id: 'fratura',
      titulo: 'Fratura, torção e suspeita de coluna',
      quando: 'Dor forte, inchaço, deformidade ou impossibilidade de mexer.',
      passos: [
        'Queda de altura, batida forte na cabeça ou dor no pescoço/costas: não mexa a pessoa; segure a cabeça alinhada.',
        'Imobilize o membro na posição em que está, com tala acolchoada (papelão, revista, tábua) pegando a articulação acima e a abaixo.',
        'Fratura exposta (osso para fora): cubra com pano limpo; não empurre o osso.',
        'Gelo envolto em pano por 20 minutos ajuda no inchaço.',
      ],
      nao: ['Não tente colocar o osso no lugar.'],
      grave: 'Fratura exposta, suspeita de coluna, perna ou braço frio e sem cor abaixo da lesão.',
    },
    {
      id: 'choque',
      titulo: 'Choque (pressão caindo)',
      quando: 'Pele fria, pálida e suada, pulso rápido, confusão, depois de sangramento, queimadura ou diarreia forte.',
      passos: [
        'Deite a pessoa e, se não houver lesão nas pernas ou na coluna, levante as pernas uns 30 cm.',
        'Cubra para manter aquecida.',
        'Trate a causa (sangramento) e fique ao lado.',
      ],
      nao: ['Não dê comida nem bebida.'],
      grave: 'Sempre grave: chame a equipe de saúde.',
    },
    {
      id: 'desidratacao',
      titulo: 'Diarreia e desidratação: soro caseiro',
      quando: 'Diarreia ou vômitos, boca seca, pouca urina.',
      passos: [
        'Soro caseiro (receita da OMS): em 1 litro de água tratada (fervida e fria, ou clorada), 6 colheres de chá rasas de açúcar e meia colher de chá rasa de sal. Mexa bem.',
        'Dê em goles pequenos e frequentes, mesmo se vomitar (espere 10 minutos e recomece devagar).',
        'Continue amamentando e oferecendo comida leve.',
        'Lave as mãos e separe o banheiro do doente, se possível.',
      ],
      nao: ['Não use refrigerante nem bebida esportiva no lugar do soro.', 'Não exagere no sal.'],
      grave: 'Não urina há 8 horas, olhos fundos, muito sonolento, sangue nas fezes, bebê ou idoso.',
    },
    {
      id: 'convulsao',
      titulo: 'Convulsão',
      quando: 'Tremores e rigidez do corpo, perda de consciência.',
      passos: [
        'Afaste objetos e proteja a cabeça com algo macio.',
        'Marque o tempo.',
        'Quando os tremores pararem, deite a pessoa de lado (posição lateral de segurança) e fique junto até acordar bem.',
      ],
      nao: ['Não segure a pessoa.', 'Não coloque nada na boca.'],
      grave: 'Mais de 5 minutos, primeira vez, não acorda, gestante, ou se machucou.',
    },
    {
      id: 'lateral',
      titulo: 'Desacordado que respira: posição lateral',
      quando: 'Não responde, mas respira normalmente.',
      passos: [
        'Deite de lado, com o braço de baixo esticado à frente.',
        'Dobre o joelho de cima para a pessoa não rolar.',
        'Incline a cabeça um pouco para trás, boca virada para o chão, para não engasgar.',
        'Vigie a respiração até a equipe chegar; se parar, comece a RCP.',
      ],
      nao: ['Não dê água a quem está desacordado.'],
      grave: 'Sempre grave: chame a equipe de saúde.',
    },
    {
      id: 'temperatura',
      titulo: 'Insolação e hipotermia',
      quando: 'Calor: pele quente e seca, confusão. Frio: tremores, fala enrolada, sonolência.',
      passos: [
        'Insolação: leve para a sombra, abane, molhe a pele e ponha panos molhados no pescoço, axilas e virilha. Se acordado, goles de água.',
        'Hipotermia: tire a roupa molhada, aqueça primeiro o tronco com cobertores e o calor de outra pessoa. Se acordado, bebidas mornas e doces.',
      ],
      nao: ['Não esfregue braços e pernas de quem está gelado.', 'Não dê álcool.'],
      grave: 'Confusão, desmaio ou convulsão.',
    },
    {
      id: 'ferimentos',
      titulo: 'Cortes, mordidas e infecção',
      quando: 'Ferimentos pequenos que não sangram muito.',
      passos: [
        'Lave bem com água tratada e sabão.',
        'Mordida de animal: lave com água e sabão por 15 minutos e procure a equipe de saúde (risco de raiva).',
        'Cubra com curativo limpo e troque todo dia.',
        'Sinais de infecção: vermelhidão que aumenta, pus, inchaço, febre ou riscos vermelhos subindo.',
      ],
      nao: ['Não feche com fita um corte sujo ou de mordida.'],
      grave: 'Sinais de infecção, ferimento fundo ou sujo, mordida, pessoa sem vacina antitetânica.',
    },
  ];

  const KIT = [
    'Luvas descartáveis',
    'Gaze, ataduras e esparadrapo',
    'Curativos adesivos de vários tamanhos',
    'Soro fisiológico para lavar ferimentos',
    'Antisséptico',
    'Tesoura sem ponta e pinça',
    'Torniquete (ou faixa larga e um bastão)',
    'Manta térmica',
    'Termômetro',
    'Sais de reidratação oral (ou açúcar e sal para o soro caseiro)',
    'Analgésico e antitérmico de uso da família',
    'Remédios de uso contínuo de cada pessoa',
    'Lanterna de cabeça',
    'Cópia deste guia impressa',
  ];

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /** Guias que mencionam o termo (no título, em "quando" ou nos passos). */
  function buscar(termo) {
    const t = normalizar(termo).trim();
    if (!t) return GUIAS.slice();
    return GUIAS.filter((g) => normalizar([g.titulo, g.quando, ...g.passos].join(' ')).includes(t));
  }

  return { GUIAS, KIT, buscar };
});
