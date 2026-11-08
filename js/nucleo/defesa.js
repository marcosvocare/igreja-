/**
 * Mecanismo: Defesa comunitária passiva.
 *
 * Proteção sem confronto: barreiras, detecção, alerta, discrição e vigilância
 * organizada. Inclui:
 * - escala de vigia em duplas, com descanso mínimo garantido;
 * - senha do dia, calculada por todos a partir de uma frase secreta combinada
 *   (ninguém precisa transmitir a senha);
 * - avaliação de segurança da casa ou da igreja, com prioridades;
 * - código de sinais por apito, lanterna e janela.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).defesa = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HORA_MS = 3600000;

  const PRINCIPIOS = [
    'Nenhum bem vale uma vida: não reaja a assalto ou saque. Entregue, saia e avise a rede.',
    'Vigia observa, avisa e se recolhe. Nunca enfrenta.',
    'Juntos é mais seguro: famílias vizinhas reunidas ou no ponto de apoio da igreja, nunca casas isoladas.',
    'Saídas só em grupo, de dia, por rotas que evitam os perigos do mapa, com hora de volta combinada.',
    'Discrição: não exiba estoque, gerador ou combustível. A partilha é feita pela rede, de forma organizada.',
    'Antes de abrir a porta, confirme quem é com a senha do dia.',
    'Converse e faça acordos com os vizinhos: a igreja pode ser lugar de mediação.',
    'Não use armadilhas: ferem crianças, vizinhos e socorristas, e são crime.',
  ];

  const SINAIS = [
    { sinal: '1 apito curto', significado: 'Atenção: todos alertas, olhos abertos.' },
    { sinal: '2 apitos curtos', significado: 'Tudo bem. Fim do alerta.' },
    { sinal: '3 apitos curtos, repetidos', significado: 'Socorro: preciso de ajuda aqui (sinal internacional).' },
    { sinal: '1 apito longo', significado: 'Perigo: todos para dentro, para o cômodo seguro.' },
    { sinal: 'Apito longo contínuo', significado: 'Evacuar para o ponto de encontro.' },
    { sinal: 'Lanterna: 3 piscadas, repetidas', significado: 'Socorro, à noite.' },
    { sinal: 'Folha escrita OK na janela', significado: 'Casa bem: a equipe de visitas pode seguir.' },
    { sinal: 'Folha escrita AJUDA na janela', significado: 'Casa precisa de apoio: a equipe de visitas para aqui.' },
  ];

  const CHECKLIST = [
    { id: 'portas', grupo: 'Barreiras', peso: 3, texto: 'Portas externas sólidas, com tranca e ferrolho por dentro', dica: 'Reforce com ferrolho de sobrepor ou uma barra transversal por dentro.' },
    { id: 'janelas', grupo: 'Barreiras', peso: 2, texto: 'Janelas do térreo com grade ou fechamento seguro', dica: 'Priorize as janelas que não são vistas da rua nem pelos vizinhos.' },
    { id: 'muro', grupo: 'Barreiras', peso: 2, texto: 'Portão com cadeado e muro sem apoios para escalar', dica: 'Retire latões, escadas e entulho encostados no muro.' },
    { id: 'iluminacao', grupo: 'Detecção', peso: 2, texto: 'Luz externa que funciona sem a rede elétrica (solar ou bateria)', dica: 'Luminárias solares com sensor de presença não dependem da rede.' },
    { id: 'visibilidade', grupo: 'Detecção', peso: 2, texto: 'Dá para ver a rua e as entradas sem se expor', dica: 'Pode arbustos junto às entradas; use olho mágico ou espelho.' },
    { id: 'alarme', grupo: 'Detecção', peso: 1, texto: 'Alarme simples nas entradas (sino, alarme a pilha, cão)', dica: 'Um sino ou alarme de porta a pilha avisa quando alguém entra.' },
    { id: 'vizinhos', grupo: 'Detecção', peso: 3, texto: 'Vizinhos combinados para observar e avisar uns aos outros', dica: 'Combine com 2 ou 3 vizinhos o código de apitos e um grupo de mensagens.' },
    { id: 'comodo', grupo: 'Resposta', peso: 2, texto: 'Cômodo seguro definido, longe da rua, com porta que tranca por dentro', dica: 'Deixe ali água, lanterna, apito e o kit de primeiros socorros.' },
    { id: 'fuga', grupo: 'Resposta', peso: 2, texto: 'Rota de fuga secundária (fundos, passagem combinada com vizinho)', dica: 'Combine com o vizinho de trás uma passagem ou escada de emergência.' },
    { id: 'sinais', grupo: 'Resposta', peso: 2, texto: 'Família e vizinhos conhecem o código de sinais', dica: 'Treine o código de apitos desta seção com todos, inclusive as crianças.' },
    { id: 'escala', grupo: 'Resposta', peso: 2, texto: 'Escala de vigia em duplas nos horários de maior risco', dica: 'Gere a escala nesta seção. Vigia só observa e avisa.' },
    { id: 'extintor', grupo: 'Incêndio', peso: 3, texto: 'Extintor, ou baldes com areia e água sempre à mão', dica: 'Sem bombeiros, um foco pequeno precisa ser apagado nos primeiros minutos.' },
    { id: 'inflamaveis', grupo: 'Incêndio', peso: 2, texto: 'Combustível, gás e inflamáveis longe da casa e do calor', dica: 'Guarde combustível em recipiente próprio, fora de casa, à sombra.' },
    { id: 'discricao', grupo: 'Discrição', peso: 3, texto: 'Estoque fora da vista e não comentado em público ou nas redes', dica: 'Partilhe pela rede da igreja, com organização, e não na porta de casa.' },
    { id: 'lixo', grupo: 'Discrição', peso: 1, texto: 'Embalagens descartadas sem revelar o estoque', dica: 'Amasse e misture as embalagens ao lixo comum; descarte aos poucos.' },
    { id: 'socorros', grupo: 'Saúde', peso: 3, texto: 'Kit de primeiros socorros e alguém da casa que sabe usar', dica: 'Peça a um profissional de saúde da rede um treino básico para a comunidade.' },
  ];

  /** Avalia a segurança a partir dos itens já feitos ({id: true}). */
  function avaliarSeguranca(feitos = {}) {
    const maximo = CHECKLIST.reduce((s, c) => s + c.peso, 0);
    const pontos = CHECKLIST.reduce((s, c) => s + (feitos[c.id] ? c.peso : 0), 0);
    const percentual = Math.round((pontos / maximo) * 100);
    const porGrupo = {};
    for (const c of CHECKLIST) {
      const g = (porGrupo[c.grupo] = porGrupo[c.grupo] || { feitos: 0, total: 0 });
      g.total++;
      if (feitos[c.id]) g.feitos++;
    }
    const prioridades = CHECKLIST.filter((c) => !feitos[c.id]).sort((a, b) => b.peso - a.peso);
    const nivel = percentual < 40 ? 'fragil' : percentual < 70 ? 'regular' : 'boa';
    const rotulos = { fragil: 'Frágil', regular: 'Regular', boa: 'Boa' };
    return { pontos, maximo, percentual, nivel, rotuloNivel: rotulos[nivel], porGrupo, prioridades };
  }

  /** Mínimo de voluntários para cobrir 24 h respeitando o descanso. */
  function minimoVoluntarios(duracaoTurno, porTurno, descansoMinimo) {
    return porTurno * Math.ceil((duracaoTurno + descansoMinimo) / duracaoTurno);
  }

  /**
   * Gera a escala de vigia. Escolhe, para cada turno, quem trabalhou menos
   * horas e está descansado há mais tempo, respeitando o descanso mínimo.
   * @param {Array<string|{nome:string}>} voluntarios
   * @param {{inicio?:Date, horas?:number, duracaoTurno?:number, porTurno?:number, descansoMinimo?:number}} [opcoes]
   */
  function gerarEscala(voluntarios, { inicio = new Date(), horas = 24, duracaoTurno = 3, porTurno = 2, descansoMinimo = 6 } = {}) {
    const total = Number(horas);
    const dur = Number(duracaoTurno);
    const por = Number(porTurno);
    const desc = Number(descansoMinimo);
    if (!(total >= 1 && total <= 168)) throw new RangeError('O período deve ser de 1 a 168 horas.');
    if (!(dur >= 1 && dur <= 12)) throw new RangeError('O turno deve ter de 1 a 12 horas.');
    if (!Number.isInteger(por) || por < 1 || por > 10) throw new RangeError('Informe de 1 a 10 pessoas por turno.');
    if (!(desc >= 0 && desc <= 48)) throw new RangeError('O descanso mínimo deve ser de 0 a 48 horas.');
    const t0 = inicio instanceof Date ? inicio.getTime() : NaN;
    if (!Number.isFinite(t0)) throw new RangeError('Informe a data e a hora de início.');

    const nomes = [...new Set((voluntarios || []).map((v) => String((v && v.nome) || v || '').trim()).filter(Boolean))];
    const pessoas = nomes.map((nome, ordem) => ({ nome, ordem, horas: 0, livreEm: -Infinity, ultimo: -1 }));

    const turnos = [];
    const nTurnos = Math.ceil(total / dur);
    for (let t = 0; t < nTurnos; t++) {
      const ini = t * dur;
      const fim = Math.min(ini + dur, total);
      const escolhidos = pessoas
        .filter((p) => p.livreEm <= ini + 1e-9)
        .sort((a, b) => a.horas - b.horas || a.ultimo - b.ultimo || a.ordem - b.ordem)
        .slice(0, por);
      for (const p of escolhidos) {
        p.horas += fim - ini;
        p.livreEm = fim + desc;
        p.ultimo = t;
      }
      turnos.push({
        inicio: new Date(t0 + ini * HORA_MS),
        fim: new Date(t0 + fim * HORA_MS),
        pessoas: escolhidos.map((p) => p.nome),
        completo: escolhidos.length === por,
      });
    }

    const necessario = minimoVoluntarios(dur, por, desc);
    const avisos = [];
    if (por === 1) avisos.push('Vigia sozinho é arriscado: prefira duplas.');
    if (nomes.length < necessario) {
      avisos.push(`Para turnos de ${dur} h com ${por} pessoa(s) e ${desc} h de descanso são necessários pelo menos ${necessario} voluntários (há ${nomes.length}).`);
    }
    const incompletos = turnos.filter((t) => !t.completo).length;
    if (incompletos) avisos.push(`${incompletos} turno(s) ficaram incompletos. Aumente o número de voluntários ou o turno.`);

    return {
      turnos,
      carga: pessoas.map((p) => ({ nome: p.nome, horas: p.horas })),
      necessario,
      avisos,
    };
  }

  // Palavras simples, fáceis de falar e de ouvir à distância.
  const PALAVRAS = [
    'amora', 'barco', 'cedro', 'dente', 'escada', 'farol', 'gaveta', 'horta',
    'janela', 'lago', 'martelo', 'novelo', 'ovelha', 'pedra', 'quintal', 'rede',
    'sino', 'telha', 'uva', 'vela', 'areia', 'bolo', 'caju', 'dado',
    'enxada', 'figo', 'gato', 'jarra', 'limão', 'milho', 'navio', 'oliva',
    'panela', 'queijo', 'rio', 'sapato', 'tijolo', 'urso', 'vaso', 'banco',
    'cabra', 'dedal', 'estrela', 'feijão', 'girafa', 'ilha', 'jacaré', 'laranja',
    'mapa', 'ninho', 'onda', 'pato', 'remo', 'serra', 'tambor', 'vento',
    'balde', 'canoa', 'dália', 'fogão', 'goiaba', 'lápis', 'mesa', 'pomba',
  ];

  /** Hash não criptográfico (cyrb53): estável e rápido, sem depender de bibliotecas. */
  function hash53(texto, semente = 0) {
    let h1 = 0xdeadbeef ^ semente;
    let h2 = 0x41c6ce57 ^ semente;
    for (let i = 0; i < texto.length; i++) {
      const ch = texto.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
  }

  function normalizarFrase(frase) {
    return String(frase || '')
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function dataLocal(data) {
    const p = (n) => String(n).padStart(2, '0');
    return `${data.getFullYear()}-${p(data.getMonth() + 1)}-${p(data.getDate())}`;
  }

  /**
   * Senha e contrassenha do dia. Quem conhece a frase secreta calcula as mesmas
   * palavras no mesmo dia, sem precisar transmiti-las. Quem chega diz a
   * contrassenha quando ouve a senha.
   * Serve para reconhecer membros; não é proteção contra quem já sabe a frase.
   */
  function senhaDoDia(frase, data = new Date()) {
    const f = normalizarFrase(frase);
    if (f.length < 6) throw new RangeError('A frase secreta precisa de pelo menos 6 letras.');
    if (!(data instanceof Date) || Number.isNaN(data.getTime())) throw new RangeError('Data inválida.');
    const dia = dataLocal(data);
    const i = hash53(`${f}|${dia}|senha`) % PALAVRAS.length;
    let j = hash53(`${f}|${dia}|contrassenha`) % PALAVRAS.length;
    if (j === i) j = (j + 1) % PALAVRAS.length;
    return { data: dia, senha: PALAVRAS[i], contrassenha: PALAVRAS[j] };
  }

  return { PRINCIPIOS, SINAIS, CHECKLIST, avaliarSeguranca, minimoVoluntarios, gerarEscala, PALAVRAS, senhaDoDia };
});
