/**
 * Aba Cozinha: gás, economia, conservar sem geladeira e horta rápida.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const C = S.cozinha;
  let A = null;

  function hojeLocal() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }

  function render() {
    const g = A.estado.cozinha;
    try {
      const r = C.duracaoGas(g.kg, { horasPorDia: g.horas, panelaPressao: g.pressao, caixaTermica: g.caixa });
      A.trocar(
        A.$('#resultado-gas'),
        A.h(
          'div',
          { class: 'metricas' },
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${r.dias} dias`), A.h('small', null, 'de gás neste ritmo')),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${A.fmt(r.kgPorDia, 2)} kg`), A.h('small', null, 'de gás por dia')),
        ),
      );
    } catch (erro) {
      A.trocar(A.$('#resultado-gas'), A.h('p', { class: 'aviso' }, erro.message));
    }
    const plantio = g.plantio || hojeLocal();
    A.trocar(
      A.$('#tabela-horta'),
      A.h(
        'table',
        null,
        A.h('thead', null, A.h('tr', null, A.h('th', null, 'Planta'), A.h('th', null, 'Dias'), A.h('th', null, 'Colher entre'))),
        A.h(
          'tbody',
          null,
          C.HORTA.map((p) => {
            const c = C.colheita(p.nome, plantio);
            return A.h('tr', null, A.h('td', null, p.nome), A.h('td', { class: 'num' }, `${p.min}–${p.max}`), A.h('td', null, `${A.dataBR(c.de)} e ${A.dataBR(c.ate)}`));
          }),
        ),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'cozinha',
    padrao: () => ({ cozinha: { kg: 13, horas: 1.5, pressao: false, caixa: false, plantio: '' } }),
    mesclar(dados, r) {
      const d = dados.cozinha && typeof dados.cozinha === 'object' ? dados.cozinha : {};
      const num = (v, min, max, pad) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= min && n <= max ? n : pad;
      };
      r.cozinha = {
        kg: num(d.kg, 0.1, 500, 13),
        horas: num(d.horas, 0.1, 24, 1.5),
        pressao: d.pressao === true,
        caixa: d.caixa === true,
        plantio: typeof d.plantio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.plantio) ? d.plantio : '',
      };
    },
    montar(api) {
      A = api;
      A.trocar(A.$('#economia-gas'), C.ECONOMIA.map((t) => A.h('li', null, t)));
      A.trocar(A.$('#conservar-comida'), C.CONSERVAR.map((t) => A.h('li', null, t)));
      A.$('#form-gas').addEventListener('input', (e) => {
        const g = A.estado.cozinha;
        if (e.target.id === 'gas-kg') g.kg = Number(e.target.value) || 0;
        if (e.target.id === 'gas-horas') g.horas = Number(e.target.value) || 0;
        if (e.target.id === 'gas-pressao') g.pressao = e.target.checked;
        if (e.target.id === 'gas-caixa') g.caixa = e.target.checked;
        if (e.target.id === 'horta-plantio') g.plantio = e.target.value;
        A.salvar();
        render();
      });
      this.recarregar();
    },
    recarregar() {
      const g = A.estado.cozinha;
      A.$('#gas-kg').value = g.kg;
      A.$('#gas-horas').value = g.horas;
      A.$('#gas-pressao').checked = g.pressao;
      A.$('#gas-caixa').checked = g.caixa;
      A.$('#horta-plantio').value = g.plantio || hojeLocal();
    },
    render,
  });
})();
