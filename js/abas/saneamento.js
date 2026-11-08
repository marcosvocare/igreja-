/**
 * Aba Higiene e saneamento. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;

  function pessoasDaCasa() {
    return Math.max(1, S.suprimentos.totalPessoas(A.estado.casa));
  }

  function render() {
    const cfg = A.estado.saneamento;
    const pessoas = cfg.pessoas || pessoasDaCasa();
    const destino = A.$('#resultado-saneamento');
    try {
      const r = S.saneamento.planoSaneamento(pessoas, { dias: cfg.dias });
      A.trocar(
        destino,
        A.h(
          'div',
          { class: 'metricas' },
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.banheiros)), A.h('small', null, 'banheiros (até 20 pessoas cada)')),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.pontosLavagem)), A.h('small', null, 'pontos de lavar as mãos')),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.barrasSabao)), A.h('small', null, `barras de sabão para ${r.dias} dias`)),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.sacosBalde)), A.h('small', null, 'sacos para banheiro de balde')),
        ),
        A.h('p', { class: 'ajuda' }, `Para ${r.pessoas} pessoa(s). Latrina a pelo menos ${S.saneamento.PADROES.distanciaFonteM} m de poços e nascentes.`),
      );
    } catch (erro) {
      A.trocar(destino, A.h('p', { class: 'aviso' }, erro.message));
    }
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'saneamento',
    padrao: () => ({ saneamento: { pessoas: 0, dias: 30 } }),
    mesclar(dados, r, u) {
      const d = dados.saneamento && typeof dados.saneamento === 'object' ? dados.saneamento : {};
      r.saneamento = { pessoas: u.inteiro(d.pessoas, 0, 100000, 0), dias: u.inteiro(d.dias, 1, 365, 30) };
    },
    montar(api) {
      A = api;
      A.trocar(
        A.$('#guias-saneamento'),
        S.saneamento.GUIAS.map((g) => A.h('details', { class: 'cenario' }, A.h('summary', null, g.titulo), A.h('div', { class: 'guia-corpo' }, A.h('ol', null, g.passos.map((p) => A.h('li', null, p)))))),
      );
      A.$('#form-saneamento').addEventListener('input', (e) => {
        if (e.target.id === 'san-pessoas') A.estado.saneamento.pessoas = A.inteiro(e.target.value || 0, 0, 100000, 0);
        if (e.target.id === 'san-dias') A.estado.saneamento.dias = A.inteiro(e.target.value, 1, 365, 30);
        A.salvar();
        render();
      });
      this.recarregar();
    },
    recarregar() {
      A.$('#san-pessoas').value = A.estado.saneamento.pessoas || '';
      A.$('#san-pessoas').placeholder = `${pessoasDaCasa()} (a casa)`;
      A.$('#san-dias').value = A.estado.saneamento.dias;
    },
    render,
  });
})();
