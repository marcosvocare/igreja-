/**
 * Mecanismo: Abrigo coletivo na igreja.
 *
 * Capacidade do espaço (pelos padrões humanitários do Projeto Esfera: 3,5 m²
 * cobertos por pessoa, até 20 pessoas por banheiro, 15 litros de água por
 * pessoa por dia), quem está no abrigo e a escala de tarefas por família.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).abrigo = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const PADROES = { m2PorPessoa: 3.5, pessoasPorBanheiro: 20, litrosPorPessoaDia: 15 };

  function positivo(v) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  /**
   * Quantas pessoas o abrigo recebe com dignidade, e o que limita.
   * @param {{areaM2?:number, banheiros?:number, aguaLitrosDia?:number}} espaco
   */
  function capacidade({ areaM2, banheiros, aguaLitrosDia } = {}) {
    const limites = {};
    if (positivo(areaM2)) limites.area = Math.floor(positivo(areaM2) / PADROES.m2PorPessoa);
    if (positivo(banheiros)) limites.banheiros = Math.floor(positivo(banheiros)) * PADROES.pessoasPorBanheiro;
    if (positivo(aguaLitrosDia)) limites.agua = Math.floor(positivo(aguaLitrosDia) / PADROES.litrosPorPessoaDia);
    const chaves = Object.keys(limites);
    if (!chaves.length) return { capacidade: null, gargalo: null, limites };
    const gargalo = chaves.reduce((a, b) => (limites[b] < limites[a] ? b : a));
    return { capacidade: limites[gargalo], gargalo, limites };
  }

  /** Quem está no abrigo agora (chegou e não saiu), por família. */
  function ocupacao(abrigados) {
    const presentes = (abrigados || []).filter((a) => a && !a.saida);
    const porFamilia = {};
    for (const a of presentes) {
      const f = String(a.familia || '').trim() || 'Sem família informada';
      porFamilia[f] = (porFamilia[f] || 0) + 1;
    }
    return {
      presentes: presentes.length,
      familias: Object.keys(porFamilia).length,
      porFamilia,
      comNecessidades: presentes.filter((a) => String(a.necessidades || '').trim()).length,
    };
  }

  /**
   * Escala de tarefas em rodízio: cada dia, cada tarefa fica com a próxima
   * família da fila, sem repetir a mesma família em duas tarefas no mesmo dia
   * quando houver famílias suficientes.
   * @param {string[]} familias
   * @param {string[]} tarefas
   * @param {number} dias
   */
  function escalaTarefas(familias, tarefas, dias = 7) {
    const f = [...new Set((familias || []).map((x) => String(x).trim()).filter(Boolean))];
    const t = (tarefas || []).map((x) => String(x).trim()).filter(Boolean);
    const d = Number(dias);
    if (!Number.isInteger(d) || d < 1 || d > 60) throw new RangeError('Informe de 1 a 60 dias.');
    if (!f.length || !t.length) return [];
    const escala = [];
    let proxima = 0;
    for (let dia = 0; dia < d; dia++) {
      const doDia = [];
      for (const tarefa of t) {
        doDia.push({ tarefa, familia: f[proxima % f.length] });
        proxima++;
      }
      escala.push({ dia: dia + 1, tarefas: doDia });
    }
    return escala;
  }

  const TAREFAS_PADRAO = ['Cozinha', 'Limpeza dos banheiros', 'Limpeza do salão', 'Água (buscar e tratar)', 'Crianças (atividades)'];

  const REGRAS = [
    'Cada família tem seu canto marcado; respeite o espaço e o silêncio das 22h às 6h.',
    'Comida e água são partilhadas pela coordenação, de forma igual, com prioridade para crianças, gestantes, idosos e doentes.',
    'Nada de armas, álcool ou drogas dentro do abrigo.',
    'Crianças sempre com um adulto responsável.',
    'Banheiros separados para mulheres, com tranca e luz à noite.',
    'Quem chega se registra na entrada; quem sai avisa e diz para onde vai.',
    'Doentes com febre, tosse ou diarreia ficam num espaço separado e usam banheiro próprio.',
    'Conflitos vão para a coordenação: ninguém resolve na força.',
  ];

  return { PADROES, capacidade, ocupacao, escalaTarefas, TAREFAS_PADRAO, REGRAS };
});
