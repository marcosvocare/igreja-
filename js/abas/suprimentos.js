/**
 * Aba Casa e suprimentos. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, fmt, inteiro, salvar, atualizarTudo, calculoSuprimentos;

  // ------------------------------------------------------------- suprimentos

  function montarCasa() {
    const campos = Object.entries({ ...S.suprimentos.PERFIS, ...S.suprimentos.PETS }).map(([chave, def]) =>
      h('label', null, def.rotulo, h('input', { type: 'number', name: chave, min: 0, max: 50, step: 1, value: A.estado.casa[chave], inputmode: 'numeric' })),
    );
    trocar($('#campos-casa'), campos);
    trocar(
      $('#campos-dietas'),
      Object.entries(S.suprimentos.DIETAS).map(([k, d]) => h('label', { class: 'linha' }, h('input', { type: 'checkbox', dataset: { dieta: k } }), h('span', null, d.rotulo))),
    );
    trocar($('#porte-caes'), Object.entries(S.suprimentos.PORTES_CAES).map(([k, p]) => h('option', { value: k }, p.rotulo)));
    for (const i of document.querySelectorAll('[data-dieta]')) i.checked = A.estado.dietas[i.dataset.dieta];
    $('#porte-caes').value = A.estado.porteCaes;

    const form = $('#form-casa');
    for (const k of Object.keys(A.estado.extras)) form.elements[k].checked = A.estado.extras[k];
    form.elements.diasMeta.value = String(A.estado.diasMeta);
    form.elements.climaQuente.checked = A.estado.climaQuente;

    form.addEventListener('input', (e) => {
      const alvo = e.target;
      A.estado.casaRevisada = true;
      if (alvo.name in A.estado.casa) {
        A.estado.casa[alvo.name] = inteiro(alvo.value === '' ? 0 : alvo.value, 0, 50, A.estado.casa[alvo.name]);
      } else if (alvo.name in A.estado.extras) {
        A.estado.extras[alvo.name] = alvo.checked;
      } else if (alvo.name === 'diasMeta') {
        A.estado.diasMeta = inteiro(alvo.value, 1, 30, 7);
      } else if (alvo.name === 'climaQuente') {
        A.estado.climaQuente = alvo.checked;
      } else if (alvo.dataset.dieta) {
        A.estado.dietas[alvo.dataset.dieta] = alvo.checked;
      } else if (alvo.name === 'porteCaes') {
        A.estado.porteCaes = S.suprimentos.PORTES_CAES[alvo.value] ? alvo.value : 'medio';
      }
      salvar();
      atualizarTudo();
    });
  }

  function renderSuprimentos() {
    const destino = $('#resultado-suprimentos');
    const r = calculoSuprimentos();
    if (r.pessoas === 0) {
      trocar(destino, h('p', { class: 'cartao' }, 'Informe ao menos uma pessoa para calcular os suprimentos.'));
      return;
    }
    const linhaAgua = (rotulo, valor) => h('tr', null, h('td', null, rotulo), h('td', { class: 'num' }, `${fmt(valor)} L`));
    trocar(
      destino,
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, `Para ${r.pessoas} pessoa(s) por ${r.dias} dias`),
        h(
          'div',
          { class: 'metricas' },
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, `${fmt(r.agua.total, 0)} L`), h('small', null, `de água · ≈ ${r.agua.garrafoes20L} garrafões de 20 L`)),
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(r.kcalTotal, 0)), h('small', null, 'kcal no total')),
        ),
        h(
          'table',
          null,
          h('tbody', null, [
            linhaAgua('Beber', r.agua.beber),
            linhaAgua('Higiene mínima', r.agua.higiene),
            linhaAgua('Cozinhar os alimentos da lista', r.agua.preparo),
            r.agua.pets ? linhaAgua('Animais', r.agua.pets) : null,
            h('tr', null, h('th', null, 'Total'), h('th', { class: 'num' }, `${fmt(r.agua.total)} L`)),
          ]),
        ),
      ),
      r.avisosDieta.map((a) => h('p', { class: 'aviso' }, a)),
      r.diasComidaPronta < Math.min(3, r.dias)
        ? h('p', { class: 'aviso' }, `A comida que dispensa fogão cobre só ~${fmt(r.diasComidaPronta)} dia(s). Reforce enlatados, biscoitos e castanhas para pelo menos 3 dias sem gás.`)
        : null,
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, 'Lista de alimentos sugerida'),
        h(
          'div',
          { class: 'tabela-rolagem' },
          h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num' }, 'Quantidade'), h('th', null, 'Sem fogão?'))),
            h('tbody', null, r.alimentos.map((a) => h('tr', null, h('td', null, a.item), h('td', { class: 'num' }, `${fmt(a.kg)} kg`), h('td', null, a.pronto ? 'Sim' : '—')))),
          ),
        ),
        r.especiais.length
          ? [h('h3', null, 'Outros itens'), h('ul', null, r.especiais.map((e) => h('li', null, `${e.item}: ${fmt(e.quantidade)} ${e.unidade}`)))]
          : null,
        h('p', { class: 'ajuda' }, 'Estimativa de planejamento. Ajuste ao que a família costuma comer e a restrições de saúde.'),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'suprimentos',
    montar(api) {
      A = api;
      ({ h, $, trocar, fmt, inteiro, salvar, atualizarTudo, calculoSuprimentos } = api);
      montarCasa();
    },
    render() {
      renderSuprimentos();
    },
    recarregar() {
      const casa = $('#form-casa');
      for (const k of Object.keys(A.estado.casa)) casa.elements[k].value = A.estado.casa[k];
      for (const k of Object.keys(A.estado.extras)) casa.elements[k].checked = A.estado.extras[k];
      casa.elements.diasMeta.value = String(A.estado.diasMeta);
      casa.elements.climaQuente.checked = A.estado.climaQuente;
      for (const i of document.querySelectorAll('[data-dieta]')) i.checked = A.estado.dietas[i.dataset.dieta];
      $('#porte-caes').value = A.estado.porteCaes;
    },
  });
})();
