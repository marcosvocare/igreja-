/**
 * Aba Kit de 72 horas. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, salvar;

  // --------------------------------------------------------------------- kit

  function montarKit() {
    $('#lista-kit').addEventListener('change', (e) => {
      const id = e.target.dataset.item;
      if (!id) return;
      if (e.target.checked) A.estado.kitMarcados[id] = true;
      else delete A.estado.kitMarcados[id];
      e.target.closest('label').classList.toggle('feito', e.target.checked);
      salvar();
      progressoKit();
    });
  }

  let secoesKit = [];

  function renderKit() {
    secoesKit = S.kit.gerarKit(A.estado.casa, { ...A.estado.extras, porteCaes: A.estado.porteCaes });
    trocar(
      $('#lista-kit'),
      secoesKit.map((s) =>
        h(
          'div',
          { class: 'cartao' },
          h('h3', null, s.titulo),
          s.itens.map((i) => {
            const marcado = Boolean(A.estado.kitMarcados[i.id]);
            return h(
              'label',
              { class: marcado ? 'linha feito' : 'linha' },
              h('input', { type: 'checkbox', checked: marcado, dataset: { item: i.id } }),
              h('span', null, i.texto),
            );
          }),
        ),
      ),
    );
    progressoKit();
  }

  function progressoKit() {
    const p = S.kit.progresso(secoesKit, A.estado.kitMarcados);
    $('#barra-kit').setAttribute('aria-valuenow', p.percentual);
    $('#barra-kit span').style.width = `${p.percentual}%`;
    $('#texto-progresso-kit').textContent = `${p.feitos} de ${p.total} itens separados (${p.percentual}%).`;
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'kit',
    montar(api) {
      A = api;
      ({ h, $, trocar, salvar } = api);
      montarKit();
    },
    render() {
      renderKit();
    },
  });
})();
