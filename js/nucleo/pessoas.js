/**
 * Mecanismo: Pessoas (quem está onde) e quadro de recados.
 *
 * Lista da comunidade com a situação de cada pessoa, para reencontrar
 * famílias e saber quem procurar; e recados deixados no ponto de encontro.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).pessoas = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** ordem: quem precisa de atenção primeiro. */
  const SITUACOES = {
    desaparecida: { rotulo: 'Desaparecida', ordem: 0 },
    ferida: { rotulo: 'Ferida ou doente', ordem: 1 },
    precisa: { rotulo: 'Precisa de ajuda', ordem: 2 },
    segura: { rotulo: 'Em segurança', ordem: 3 },
    fora: { rotulo: 'Fora da área', ordem: 4 },
    faleceu: { rotulo: 'Faleceu', ordem: 5 },
  };

  function normalizar(texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }

  function tempo(iso) {
    const t = iso ? new Date(iso).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  }

  /** Quem precisa de atenção primeiro; dentro de cada situação, a notícia mais recente primeiro. */
  function ordenar(pessoas) {
    return [...(pessoas || [])].sort(
      (a, b) => (SITUACOES[a.situacao] || SITUACOES.segura).ordem - (SITUACOES[b.situacao] || SITUACOES.segura).ordem || tempo(b.atualizadoEm) - tempo(a.atualizadoEm),
    );
  }

  /** Contagem por situação. */
  function resumo(pessoas) {
    const r = Object.fromEntries(Object.keys(SITUACOES).map((k) => [k, 0]));
    for (const p of pessoas || []) if (r[p.situacao] !== undefined) r[p.situacao]++;
    return { porSituacao: r, total: (pessoas || []).length };
  }

  /** Busca por nome, família, lugar ou observação, sem diferenciar acentos. */
  function buscar(pessoas, termo) {
    const t = normalizar(termo);
    if (!t) return ordenar(pessoas);
    return ordenar((pessoas || []).filter((p) => normalizar([p.nome, p.familia, p.onde, p.obs].join(' ')).includes(t)));
  }

  /** Recados para alguém (pelo nome, sem acentos), do mais novo para o mais antigo. */
  function recadosPara(recados, nome) {
    const n = normalizar(nome);
    return [...(recados || [])]
      .filter((r) => !n || normalizar(r.para).includes(n) || normalizar(r.para) === 'todos')
      .sort((a, b) => tempo(b.atualizadoEm || b.criadoEm) - tempo(a.atualizadoEm || a.criadoEm));
  }

  return { SITUACOES, ordenar, resumo, buscar, recadosPara };
});
