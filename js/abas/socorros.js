/**
 * Aba Primeiros socorros. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;

  function guia(g) {
    return A.h(
      'details',
      { class: 'cenario guia-socorro', id: `socorro-${A.ancora(g.id)}` },
      A.h('summary', null, g.titulo),
      A.h(
        'div',
        { class: 'guia-corpo' },
        A.h('p', null, A.h('strong', null, 'Quando: '), g.quando),
        A.h('ol', null, g.passos.map((p) => A.h('li', null, p))),
        g.nao && g.nao.length ? A.h('div', { class: 'nao-faca' }, A.h('strong', null, 'Não faça: '), A.h('ul', null, g.nao.map((n) => A.h('li', null, n)))) : null,
        A.h('p', { class: 'aviso' }, A.h('strong', null, 'É grave (chame a equipe de saúde): '), g.grave),
      ),
    );
  }

  function render() {
    const termo = A.$('#busca-socorro').value;
    const achados = S.socorros.buscar(termo);
    A.trocar(
      A.$('#lista-socorros'),
      achados.length ? achados.map(guia) : A.h('p', { class: 'ajuda' }, 'Nenhum guia com essa palavra. Tente "sangue", "queimadura", "engasgo" ou "febre".'),
    );
    // Abre o guia cujo título corresponde à busca (ou o único encontrado).
    const norm = (t) => String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
    const t = norm(termo);
    if (t) {
      const detalhes = A.$('#lista-socorros').querySelectorAll('details');
      achados.forEach((g, i) => {
        if (achados.length === 1 || norm(g.titulo).includes(t)) detalhes[i].open = true;
      });
    }
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'socorros',
    montar(api) {
      A = api;
      A.$('#busca-socorro').addEventListener('input', render);
      A.trocar(A.$('#kit-socorros'), S.socorros.KIT.map((i) => A.h('li', null, i)));
    },
    render,
  });
})();
