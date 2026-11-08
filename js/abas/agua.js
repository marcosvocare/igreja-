/**
 * Aba Água segura. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, fmt;

  // -------------------------------------------------------------------- água

  function montarAgua() {
    const form = $('#form-agua');
    form.addEventListener('input', renderAgua);
    trocar(
      $('#metodos-agua'),
      S.agua.METODOS.map((m) =>
        h('div', { class: 'cartao' }, h('h3', null, m.titulo), h('ol', null, m.passos.map((p) => h('li', null, p))), h('p', { class: 'ajuda' }, m.limites)),
      ),
    );
    trocar($('#fontes-agua'), S.agua.FONTES_EMERGENCIA.map((f) => h('li', null, f)));
  }

  function renderAgua() {
    const f = $('#form-agua').elements;
    try {
      const r = S.agua.dosagemHipoclorito(f.litros.value, f.concentracao.value, { turva: f.turva.checked });
      const medida = [`≈ ${fmt(r.ml)} ml`, r.colheresDeCha ? `≈ ${fmt(r.colheresDeCha)} colher(es) de chá` : null].filter(Boolean).join(' · ');
      trocar(
        $('#resultado-agua'),
        h(
          'div',
          { class: 'metricas' },
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(r.gotas, 0)), h('small', null, `gotas (${medida})`)),
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, `${r.minutosEspera} min`), h('small', null, 'de espera antes de beber')),
        ),
        h('ul', { class: 'ajuda' }, r.avisos.map((a) => h('li', null, a))),
      );
    } catch (erro) {
      trocar($('#resultado-agua'), h('p', { class: 'aviso' }, erro.message));
    }
    try {
      const min = S.agua.tempoFervura(f.altitude.value || 0);
      $('#resultado-fervura').textContent = `Ferva por ${min} minuto(s) depois que começar a borbulhar forte.`;
    } catch (erro) {
      $('#resultado-fervura').textContent = erro.message;
    }
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'agua',
    montar(api) {
      A = api;
      ({ h, $, trocar, fmt } = api);
      montarAgua();
    },
    render() {
      renderAgua();
    },
  });
})();
