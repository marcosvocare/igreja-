/**
 * Aba Cuidado emocional e espiritual. A conferência de bem-estar não é
 * gravada (fica só na tela). Registra-se como extensão de app.js.
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const C = S.cuidado;
  let A = null;
  const respostas = {};

  function renderConferencia() {
    const r = C.conferir(respostas);
    const cor = { bem: 'verde', atencao: 'amarelo', urgente: 'vermelho' }[r.nivel];
    const titulo = { bem: 'Siga perto', atencao: 'Precisa de acompanhamento', urgente: 'Ajuda agora' }[r.nivel];
    A.trocar(A.$('#resultado-cuidado'), A.h('div', { class: 'painel-nivel', dataset: { cor } }, A.h('div', { class: 'postura' }, titulo), A.h('p', null, r.orientacao)));
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'cuidado',
    montar(api) {
      A = api;
      A.trocar(
        A.$('#guias-cuidado'),
        C.GUIAS.map((g) => A.h('details', { class: 'cenario' }, A.h('summary', null, g.titulo), A.h('div', { class: 'guia-corpo' }, A.h('ul', null, g.passos.map((p) => A.h('li', null, p)))))),
      );
      A.trocar(
        A.$('#perguntas-cuidado'),
        C.PERGUNTAS.map((p) => A.h('label', { class: 'linha' }, A.h('input', { type: 'checkbox', dataset: { pergunta: p.id } }), A.h('span', null, p.texto))),
      );
      A.$('#perguntas-cuidado').addEventListener('change', (e) => {
        const id = e.target.dataset.pergunta;
        if (!id) return;
        respostas[id] = e.target.checked;
        renderConferencia();
      });
      renderConferencia();
    },
    render() {},
  });
})();
