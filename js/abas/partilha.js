/**
 * Aba Partilha justa. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const PERFIS_FAMILIA = ['adultos', 'idosos', 'gestantes', 'criancas', 'bebes'];
  const KCAL_POR_KG = { arroz: 3600, feijao: 3300, macarrao: 3700, farinha: 3600, outros: 3500 };

  let A = null; // API do app, recebida em montar()

  // ------------------------------------------------------------------ estado

  function padrao() {
    return { partilha: { agua: 0, kcal: 0, dias: 3, familias: [] } };
  }

  function mesclar(dados, r, u) {
    const num = (v, min, max, pad) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : pad;
    };
    const objeto = (v) => (v && typeof v === 'object' ? v : {});
    const pt = objeto(dados.partilha);
    r.partilha.agua = num(pt.agua, 0, 10000000, 0);
    r.partilha.kcal = num(pt.kcal, 0, 1000000000, 0);
    r.partilha.dias = u.inteiro(pt.dias, 1, 60, 3);
    r.partilha.familias = u
      .lista(pt.familias)
      .filter((f) => typeof f.nome === 'string' && f.nome.trim())
      .map((f) => {
        const casa = {};
        for (const k of PERFIS_FAMILIA) casa[k] = u.inteiro(objeto(f.casa)[k], 0, 30, 0);
        return { id: u.texto(f.id, 40) || u.novoId(), nome: f.nome.slice(0, 40), casa, vulneravel: f.vulneravel === true, atualizadoEm: u.dataValida(f.atualizadoEm) };
      });
  }

  // ================================================================ PARTILHA

  function necessidadeFamilia(f) {
    const n = S.suprimentos.necessidadeDiaria(f.casa, { climaQuente: A.estado.climaQuente });
    return { agua: n.aguaBeber + n.aguaHigiene, kcal: n.kcal };
  }

  function prioridade(f) {
    const motivos = [];
    if (f.casa.bebes) motivos.push('bebê');
    if (f.casa.gestantes) motivos.push('gestante');
    if (f.casa.idosos) motivos.push('idoso');
    if (f.vulneravel) motivos.push('doença ou deficiência');
    return motivos;
  }

  function montarPartilha() {
    A.trocar(
      A.$('#campos-familia'),
      PERFIS_FAMILIA.map((k) =>
        A.h('label', null, S.suprimentos.PERFIS[k].rotulo, A.h('input', { type: 'number', id: `fam-${k}`, min: 0, max: 30, step: 1, value: k === 'adultos' ? 2 : 0, inputmode: 'numeric' })),
      ),
    );
    A.$('#form-estoque-comum').addEventListener('input', (e) => {
      const pt = A.estado.partilha;
      if (e.target.id === 'comum-agua') pt.agua = Math.min(10000000, A.numeroPositivo(e.target.value));
      if (e.target.id === 'comum-kcal') pt.kcal = Math.min(1000000000, A.numeroPositivo(e.target.value));
      if (e.target.id === 'comum-dias') pt.dias = A.inteiro(e.target.value, 1, 60, pt.dias);
      A.salvar();
      renderPartilha();
    });
    A.$('#somar-kcal').addEventListener('click', () => {
      const kg = A.numeroPositivo(A.$('#somar-kg').value);
      if (!kg) return;
      const pt = A.estado.partilha;
      pt.kcal = Math.round(pt.kcal + kg * KCAL_POR_KG[A.$('#somar-tipo').value]);
      A.$('#comum-kcal').value = pt.kcal;
      A.$('#somar-kg').value = '';
      A.salvar();
      renderPartilha();
    });
    A.$('#form-familia').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#fam-nome').value.trim();
      if (!nome) return;
      const casa = {};
      for (const k of PERFIS_FAMILIA) casa[k] = A.inteiro(A.$(`#fam-${k}`).value, 0, 30, 0);
      if (!Object.values(casa).some(Boolean)) return;
      A.estado.partilha.familias.push({ id: A.novoId(), nome: nome.slice(0, 40), casa, vulneravel: A.$('#fam-vulneravel').checked, atualizadoEm: new Date().toISOString() });
      A.$('#fam-nome').value = '';
      A.$('#fam-vulneravel').checked = false;
      A.$('#fam-nome').focus();
      A.salvar();
      renderPartilha();
    });
    A.$('#resultado-partilha').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remover-familia]');
      if (!b) return;
      A.estado.partilha.familias = A.estado.partilha.familias.filter((f) => f.id !== b.dataset.removerFamilia);
      A.salvar();
      renderPartilha();
    });
    recarregarPartilha();
  }

  function recarregarPartilha() {
    const pt = A.estado.partilha;
    A.$('#comum-agua').value = pt.agua || '';
    A.$('#comum-kcal').value = pt.kcal || '';
    A.$('#comum-dias').value = pt.dias;
  }

  function renderPartilha() {
    const pt = A.estado.partilha;
    const destino = A.$('#resultado-partilha');
    if (!pt.familias.length) {
      A.trocar(destino, A.h('p', { class: 'cartao ajuda' }, 'Cadastre as famílias atendidas e o estoque comum para ver a divisão.'));
      return;
    }
    const necessidades = pt.familias.map(necessidadeFamilia);
    const demandas = (campo) => pt.familias.map((f, i) => ({ nome: f.nome, necessidade: necessidades[i][campo], vulneravel: prioridade(f).length > 0 }));
    const agua = S.partilha.distribuir(pt.agua, demandas('agua'), { dias: pt.dias });
    const comida = S.partilha.distribuir(pt.kcal, demandas('kcal'), { dias: pt.dias });
    const totalAguaDia = necessidades.reduce((s, n) => s + n.agua, 0);
    const totalKcalDia = necessidades.reduce((s, n) => s + n.kcal, 0);
    const diasAgua = S.partilha.diasDeEstoque(pt.agua, totalAguaDia);
    const diasKcal = S.partilha.diasDeEstoque(pt.kcal, totalKcalDia);
    const pessoas = (f) => PERFIS_FAMILIA.reduce((s, k) => s + f.casa[k], 0);

    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'cartao' },
        A.h('h3', null, `Divisão para ${pt.dias} dia(s)`),
        A.h(
          'div',
          { class: 'metricas' },
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${agua.cobertura}%`), A.h('small', null, `da água necessária${diasAgua !== null ? ` · dá ${A.fmt(diasAgua)} dia(s) para todos` : ''}`)),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${comida.cobertura}%`), A.h('small', null, `da comida necessária${diasKcal !== null ? ` · dá ${A.fmt(diasKcal)} dia(s) para todos` : ''}`)),
        ),
        agua.cobertura < 100 || comida.cobertura < 100
          ? A.h('p', { class: 'aviso' }, 'Não há para todos no período: a divisão abaixo é proporcional à necessidade, com prioridade para bebês, gestantes, idosos e doentes.')
          : null,
        agua.sobra || comida.sobra
          ? A.h('p', { class: 'ajuda' }, `Sobra no estoque comum: ${agua.sobra ? `${A.fmt(agua.sobra)} L de água` : ''}${agua.sobra && comida.sobra ? ' e ' : ''}${comida.sobra ? `${A.fmt(comida.sobra, 0)} kcal de comida` : ''}.`)
          : null,
      ),
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Família'), A.h('th', { class: 'num' }, 'Água/dia'), A.h('th', { class: 'num' }, 'Comida/dia'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            pt.familias.map((f, i) => {
              const a = agua.porFamilia[i];
              const c = comida.porFamilia[i];
              const motivos = prioridade(f);
              return A.h(
                'tr',
                null,
                A.h('td', null, A.h('strong', null, f.nome), A.h('br'), A.h('small', { class: 'ajuda' }, `${pessoas(f)} pessoa(s)`), motivos.length ? [A.h('br'), A.h('span', { class: 'tag precisa' }, `Prioridade: ${motivos.join(', ')}`)] : null),
                A.h('td', { class: 'num' }, `${A.fmt(a.porDia)} L`, A.h('br'), A.h('small', { class: 'ajuda' }, `${a.percentual}%`)),
                A.h('td', { class: 'num' }, `${A.fmt(c.porDia, 0)} kcal`, A.h('br'), A.h('small', { class: 'ajuda' }, `≈ ${A.fmt(c.porDia / 3500, 1)} kg · ${c.percentual}%`)),
                A.h('td', null, A.h('button', { type: 'button', class: 'mini secundario', dataset: { removerFamilia: f.id }, 'aria-label': `Remover ${f.nome}` }, '✕')),
              );
            }),
          ),
        ),
        A.h('p', { class: 'ajuda' }, '“≈ kg” é o equivalente em alimentos secos (arroz, feijão, macarrão). Água por dia inclui beber e higiene mínima.'),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'partilha',
    padrao,
    mesclar,
    montar(api) {
      A = api;
      montarPartilha();
    },
    render: renderPartilha,
    recarregar: recarregarPartilha,
  });
})();
