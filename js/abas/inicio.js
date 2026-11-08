/**
 * Aba Começar (roteiro de primeiro uso) e lembretes no topo da triagem.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;

  function progressoKit() {
    const e = A.estado;
    return S.kit.progresso(S.kit.gerarKit(e.casa, { ...e.extras, porteCaes: e.porteCaes }), e.kitMarcados).percentual;
  }

  function situacao() {
    return S.configuracao.passos(A.estado, { progressoKit: progressoKit(), temSenha: A.senha.ativa() });
  }

  function renderPassos(r) {
    A.trocar(
      A.$('#passos-inicio'),
      A.h(
        'div',
        { class: 'cartao' },
        A.h('div', { class: 'metricas' }, A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${r.feitos} de ${r.total}`), A.h('small', null, 'passos feitos'))),
        A.h('div', { class: 'progresso', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': r.total, 'aria-valuenow': r.feitos }, A.h('span', { style: `width:${Math.round((r.feitos / r.total) * 100)}%` })),
        A.h(
          'ol',
          { class: 'passos' },
          r.passos.map((p) =>
            A.h(
              'li',
              { class: p.feito ? 'feito' : null },
              A.h('span', { class: `estado ${p.feito ? 'ok' : 'sem'}` }, p.feito ? 'Feito' : 'Falta'),
              ' ',
              A.h('a', { href: `#${p.aba}` }, p.titulo),
              A.h('br'),
              A.h('small', { class: 'ajuda' }, p.porque),
            ),
          ),
        ),
      ),
    );
  }

  function renderLembretes(r) {
    const itens = [];
    if (r.proximo) {
      itens.push(
        A.h(
          'p',
          { class: 'lembrete' },
          A.h('strong', null, `Preparação: ${r.feitos} de ${r.total} passos. `),
          'Próximo: ',
          A.h('a', { href: `#${r.proximo.aba}` }, r.proximo.titulo),
          ' · ',
          A.h('a', { href: '#inicio' }, 'ver todos'),
        ),
      );
    }
    if (S.configuracao.precisaCopia(A.estado)) {
      const dias = S.configuracao.diasDesdeCopia(A.estado);
      itens.push(
        A.h(
          'p',
          { class: 'lembrete aviso' },
          dias === null ? 'Você ainda não fez cópia de segurança. ' : `Sua última cópia de segurança foi há ${dias} dias. `,
          A.h('a', { href: '#dados' }, 'Fazer cópia agora'),
        ),
      );
    }
    A.trocar(A.$('#lembretes'), itens);
  }

  function render() {
    const r = situacao();
    renderPassos(r);
    renderLembretes(r);
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'inicio',
    montar(api) {
      A = api;
    },
    render,
    // Os passos dependem de várias abas: confere de novo ao abrir a triagem ou o Começar.
    navegar(secao) {
      if (secao === 'situacao' || secao === 'inicio') render();
      return false;
    },
  });
})();
