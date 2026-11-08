/**
 * Mecanismo: Rede de apoio comunitária (igreja e vizinhança).
 *
 * Cruza as necessidades de pessoas vulneráveis com as habilidades e recursos
 * dos membros, priorizando quem está no mesmo bairro e distribuindo a carga.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).rede = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HABILIDADES = {
    saude: 'Saúde (médico, enfermagem, socorrista)',
    transporte: 'Tem carro/transporte',
    gerador: 'Tem gerador ou energia solar',
    abrigo: 'Pode abrigar pessoas',
    cozinha: 'Cozinha para grupos',
    cuidado_criancas: 'Cuida de crianças',
    eletrica: 'Elétrica/hidráulica',
    radio: 'Radioamador/comunicação',
    visita: 'Disponível para visitas e contato',
  };

  /** Necessidade → habilidades que a atendem (em ordem de preferência) e prioridade (1 = maior). */
  const NECESSIDADES = {
    dependente_energia: { rotulo: 'Depende de energia elétrica', atende: ['gerador', 'transporte'], prioridade: 1 },
    acamado: { rotulo: 'Acamado', atende: ['saude', 'transporte'], prioridade: 1 },
    mobilidade_reduzida: { rotulo: 'Mobilidade reduzida', atende: ['transporte'], prioridade: 2 },
    gestante: { rotulo: 'Gestante', atende: ['saude', 'transporte'], prioridade: 2 },
    idoso_sozinho: { rotulo: 'Idoso que mora sozinho', atende: ['visita', 'saude'], prioridade: 2 },
    sem_moradia_segura: { rotulo: 'Mora em área de risco', atende: ['abrigo', 'transporte'], prioridade: 2 },
    criancas_pequenas: { rotulo: 'Crianças pequenas sem apoio', atende: ['cuidado_criancas'], prioridade: 3 },
    sem_transporte: { rotulo: 'Sem transporte', atende: ['transporte'], prioridade: 3 },
  };

  function normalizar(texto) {
    return String(texto || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();
  }

  /**
   * Pareia cada necessidade com um membro que pode ajudar.
   * @param {Array<{nome:string, bairro?:string, habilidades?:string[], necessidades?:string[]}>} membros
   * @param {{maxPorAjudante?: number}} [opcoes] limite de pessoas atendidas por ajudante
   */
  function parearApoio(membros, { maxPorAjudante = 3 } = {}) {
    const lista = (membros || []).filter((m) => m && String(m.nome || '').trim());
    const carga = new Map(lista.map((m) => [m, 0]));

    const pedidos = [];
    for (const pessoa of lista) {
      for (const nec of pessoa.necessidades || []) {
        const def = NECESSIDADES[nec];
        if (def) pedidos.push({ pessoa, necessidade: nec, def });
      }
    }
    pedidos.sort(
      (a, b) => a.def.prioridade - b.def.prioridade || String(a.pessoa.nome).localeCompare(String(b.pessoa.nome), 'pt-BR'),
    );

    const pares = [];
    const semCobertura = [];
    for (const { pessoa, necessidade, def } of pedidos) {
      const bairro = normalizar(pessoa.bairro);
      const candidatos = lista
        .filter((m) => m !== pessoa && carga.get(m) < maxPorAjudante)
        .map((m) => {
          const habs = m.habilidades || [];
          const indice = def.atende.findIndex((h) => habs.includes(h));
          return { m, indice, mesmoBairro: bairro !== '' && normalizar(m.bairro) === bairro };
        })
        .filter((c) => c.indice >= 0)
        .sort(
          (a, b) =>
            Number(b.mesmoBairro) - Number(a.mesmoBairro) ||
            a.indice - b.indice ||
            carga.get(a.m) - carga.get(b.m) ||
            String(a.m.nome).localeCompare(String(b.m.nome), 'pt-BR'),
        );

      const escolhido = candidatos[0];
      if (escolhido) {
        carga.set(escolhido.m, carga.get(escolhido.m) + 1);
        pares.push({
          pessoa: pessoa.nome,
          necessidade,
          rotulo: def.rotulo,
          ajudante: escolhido.m.nome,
          habilidade: def.atende[escolhido.indice],
          mesmoBairro: escolhido.mesmoBairro,
        });
      } else {
        semCobertura.push({ pessoa: pessoa.nome, necessidade, rotulo: def.rotulo, bairro: pessoa.bairro || '' });
      }
    }
    return { pares, semCobertura };
  }

  /**
   * Resumo de recursos por bairro: quantas pessoas têm cada habilidade e
   * quantas necessidades existem. Ajuda a ver lacunas (ex.: nenhum gerador no bairro X).
   */
  function resumoRecursos(membros) {
    const porBairro = {};
    for (const m of membros || []) {
      if (!m || !String(m.nome || '').trim()) continue;
      const nome = String(m.bairro || '').trim() || 'Sem bairro';
      const b = (porBairro[nome] = porBairro[nome] || { membros: 0, habilidades: {}, necessidades: {} });
      b.membros++;
      for (const h of m.habilidades || []) b.habilidades[h] = (b.habilidades[h] || 0) + 1;
      for (const n of m.necessidades || []) b.necessidades[n] = (b.necessidades[n] || 0) + 1;
    }
    const lacunas = [];
    for (const [bairro, b] of Object.entries(porBairro)) {
      for (const nec of Object.keys(b.necessidades)) {
        const def = NECESSIDADES[nec];
        if (def && !def.atende.some((h) => b.habilidades[h])) {
          lacunas.push({ bairro, necessidade: nec, rotulo: def.rotulo, faltam: def.atende });
        }
      }
    }
    return { porBairro, lacunas };
  }

  return { HABILIDADES, NECESSIDADES, parearApoio, resumoRecursos };
});
