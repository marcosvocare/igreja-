/**
 * Aba Energia: consumo dos aparelhos, painel solar, bateria e power banks.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const E = S.energia;
  let A = null;

  function itens() {
    const c = A.estado.energia;
    const lista = Object.keys(E.APARELHOS).map((k) => ({ aparelho: k, quantidade: c.qtd[k] || 0 }));
    if (c.extraW && c.extraHoras) lista.push({ watts: c.extraW, quantidade: c.extraHoras });
    return lista;
  }

  function render() {
    const c = A.estado.energia;
    const consumo = E.consumoDiario(itens());
    const painel = E.dimensionarPainel(consumo.whDia, { horasSol: c.horasSol });
    const bateria = E.dimensionarBateria(consumo.whDia, { dias: c.dias, tipo: c.tipo });
    const pb = E.diasPowerbank(consumo.whDia, { mah: c.mah, quantidade: c.bancos });
    A.trocar(
      A.$('#resultado-energia'),
      consumo.whDia
        ? [
            A.h(
              'div',
              { class: 'metricas' },
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${A.fmt(consumo.whDia, 0)} Wh`), A.h('small', null, 'consumo por dia')),
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${painel.comercial} W`), A.h('small', null, `painel solar (mínimo ${painel.watts} W)`)),
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${bateria.ah} Ah`), A.h('small', null, `bateria de 12 V (${c.tipo === 'litio' ? 'lítio' : 'chumbo'}) para ${c.dias} dia(s) sem sol`)),
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, pb === null ? '—' : `${A.fmt(pb)} dia(s)`), A.h('small', null, `com ${c.bancos} power bank(s) de ${A.fmt(c.mah, 0)} mAh`)),
            ),
            A.h('p', { class: 'ajuda' }, 'Valores típicos; confira a potência na etiqueta de cada aparelho.'),
          ]
        : A.h('p', { class: 'ajuda' }, 'Informe os aparelhos que precisam de energia.'),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'energia',
    padrao: () => ({
      energia: { qtd: { celular: 4, radio_lora: 4, lanterna: 2, radio_fm: 2 }, extraW: 0, extraHoras: 0, horasSol: 4.5, dias: 2, tipo: 'litio', mah: 10000, bancos: 2 },
    }),
    mesclar(dados, r, u) {
      const d = dados.energia && typeof dados.energia === 'object' ? dados.energia : null;
      if (!d) return;
      const num = (v, min, max, pad) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= min && n <= max ? n : pad;
      };
      const qtd = {};
      for (const k of Object.keys(E.APARELHOS)) qtd[k] = num(d.qtd && d.qtd[k], 0, 1000, 0);
      r.energia = {
        qtd,
        extraW: num(d.extraW, 0, 5000, 0),
        extraHoras: num(d.extraHoras, 0, 24, 0),
        horasSol: num(d.horasSol, 2, 7, 4.5),
        dias: u.inteiro(d.dias, 1, 10, 2),
        tipo: d.tipo === 'chumbo' ? 'chumbo' : 'litio',
        mah: num(d.mah, 1000, 100000, 10000),
        bancos: u.inteiro(d.bancos, 0, 50, 1),
      };
    },
    montar(api) {
      A = api;
      A.trocar(
        A.$('#aparelhos-energia'),
        Object.entries(E.APARELHOS).map(([k, a]) =>
          A.h('label', { for: `en-${k}` }, `${a.rotulo} (${a.unidade})`, A.h('input', { id: `en-${k}`, type: 'number', min: 0, max: 1000, step: 1, dataset: { aparelho: k }, inputmode: 'numeric' })),
        ),
      );
      A.trocar(A.$('#dicas-energia'), E.DICAS.map((d) => A.h('li', null, d)));
      A.$('#form-energia').addEventListener('input', (e) => {
        const c = A.estado.energia;
        const v = e.target.value;
        if (e.target.dataset.aparelho) c.qtd[e.target.dataset.aparelho] = Math.max(0, Number(v) || 0);
        if (e.target.id === 'en-extra-w') c.extraW = Math.max(0, Number(v) || 0);
        if (e.target.id === 'en-extra-h') c.extraHoras = Math.max(0, Number(v) || 0);
        if (e.target.id === 'en-sol') c.horasSol = Number(v) || 4.5;
        if (e.target.id === 'en-dias') c.dias = A.inteiro(v, 1, 10, 2);
        if (e.target.id === 'en-tipo') c.tipo = v === 'chumbo' ? 'chumbo' : 'litio';
        if (e.target.id === 'en-mah') c.mah = Math.max(1000, Number(v) || 10000);
        if (e.target.id === 'en-bancos') c.bancos = A.inteiro(v, 0, 50, 1);
        A.salvar();
        render();
      });
      this.recarregar();
    },
    recarregar() {
      const c = A.estado.energia;
      for (const i of document.querySelectorAll('[data-aparelho]')) i.value = c.qtd[i.dataset.aparelho] || 0;
      A.$('#en-extra-w').value = c.extraW || '';
      A.$('#en-extra-h').value = c.extraHoras || '';
      A.$('#en-sol').value = String(c.horasSol);
      A.$('#en-dias').value = c.dias;
      A.$('#en-tipo').value = c.tipo;
      A.$('#en-mah').value = c.mah;
      A.$('#en-bancos').value = c.bancos;
    },
    render,
  });
})();
