/**
 * Aba Situação (triagem) e Protocolos. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, fmt, ancora, salvar, atualizarTudo, autonomia;

  // ---------------------------------------------------------------- situação

  const ROTULOS_GRUPO = { 1: 'Atenção', 2: 'Alerta', 3: 'Emergência' };
  const CORES = { 1: 'amarelo', 2: 'laranja', 3: 'vermelho' };

  function montarSinais() {
    const grupos = [1, 2, 3].map((nivel) =>
      h(
        'fieldset',
        { class: 'grupo-sinais', dataset: { cor: CORES[nivel] } },
        h('legend', null, h('span', { class: 'ponto', 'aria-hidden': 'true' }), ` ${ROTULOS_GRUPO[nivel]}`),
        S.situacao.SINAIS.filter((s) => s.nivel === nivel).map((s) =>
          h(
            'label',
            { class: 'linha' },
            h('input', { type: 'checkbox', name: 'sinal', value: s.id, checked: A.estado.sinais.includes(s.id) }),
            h('span', null, s.texto),
          ),
        ),
      ),
    );
    trocar($('#lista-sinais'), grupos);

    $('#lista-sinais').addEventListener('change', () => {
      A.estado.sinais = Array.from(document.querySelectorAll('input[name="sinal"]:checked')).map((i) => i.value);
      salvar();
      renderSituacao();
    });
    $('#ctx-rota').checked = A.estado.rotaSegura;
    $('#ctx-rota').addEventListener('change', (e) => {
      A.estado.rotaSegura = e.target.checked;
      salvar();
      renderSituacao();
    });
    $('#ctx-energia').addEventListener('change', (e) => {
      A.estado.extras.dependenteEnergia = e.target.checked;
      salvar();
      atualizarTudo();
    });
    $('#limpar-sinais').addEventListener('click', () => {
      A.estado.sinais = [];
      for (const i of document.querySelectorAll('input[name="sinal"]')) i.checked = false;
      salvar();
      renderSituacao();
    });
  }

  function renderSituacao() {
    $('#ctx-energia').checked = A.estado.extras.dependenteEnergia;
    let diasAutonomia = null;
    const temEstoque = A.estado.estoque.length > 0;
    const aut = autonomia();
    if (temEstoque && aut.diasAutonomia !== null) {
      diasAutonomia = aut.diasAutonomia;
      $('#ctx-autonomia').textContent = `Autonomia do estoque: ${fmt(diasAutonomia)} dia(s), limitada pela ${aut.gargalo === 'agua' ? 'água' : 'comida'}.`;
    } else {
      $('#ctx-autonomia').textContent = 'Cadastre o estoque para que a autonomia da casa entre na decisão.';
    }

    const r = S.situacao.avaliarSituacao(A.estado.sinais, {
      diasAutonomia,
      dependenteEnergia: A.estado.extras.dependenteEnergia,
      rotaSegura: A.estado.rotaSegura,
    });

    const selo = $('#selo-nivel');
    selo.textContent = r.nomeNivel;
    selo.dataset.cor = r.cor;

    trocar(
      $('#resultado-situacao'),
      h(
        'div',
        { class: 'painel-nivel', dataset: { cor: r.cor } },
        h('div', { class: 'rotulo-nivel' }, `Nível ${r.nivel} — ${r.nomeNivel}`),
        h('div', { class: 'postura' }, r.tituloPostura),
        r.motivos.length ? h('ul', null, r.motivos.map((m) => h('li', null, m))) : null,
        r.acionar.length
          ? h(
              'div',
              { class: 'acionar-lista' },
              h('div', { class: 'rotulo-nivel' }, 'Acionar'),
              r.acionar.map((c) =>
                h(
                  'p',
                  null,
                  h('strong', null, c.nome),
                  ': ',
                  A.estado.equipes[c.id] ? A.estado.equipes[c.id] : h('a', { href: '#rede-equipes' }, 'defina o contato desta equipe'),
                ),
              ),
              h('p', { class: 'ajuda' }, 'Pelo rádio: código 2 com a sua posição. Sem rádio: apito, 3 toques repetidos.'),
            )
          : null,
      ),
      r.avisos.map((a) => h('p', { class: 'aviso' }, a)),
      h('div', { class: 'cartao' }, h('h3', null, 'O que fazer agora'), h('ol', null, r.acoes.map((a) => h('li', null, a)))),
      r.cenarios.length
        ? h(
            'div',
            { class: 'cartao' },
            h('h3', null, 'Protocolos relacionados'),
            h(
              'div',
              { class: 'botoes' },
              r.cenarios.map((id) => h('a', { class: 'botao secundario', href: `#cenarios-${ancora(id)}` }, S.cenarios.buscarCenario(id).titulo)),
            ),
          )
        : null,
    );
  }

  // ---------------------------------------------------------------- cenários

  function montarCenarios() {
    const lista = (titulo, itens) => [h('h4', null, titulo), h('ul', null, itens.map((i) => h('li', null, i)))];
    trocar(
      $('#lista-cenarios'),
      S.cenarios.CENARIOS.map((c) =>
        h(
          'details',
          { class: 'cenario', id: `cen-${c.id}` },
          h('summary', null, c.titulo),
          h(
            'div',
            { class: 'cenario-corpo' },
            h('div', null, lista('Sinais', c.sinais), lista('Antes', c.antes)),
            h('div', null, lista('Durante', c.durante)),
            h(
              'div',
              null,
              lista('Depois', c.depois),
              c.acionar.length
                ? [
                    h('h4', null, 'Acionar'),
                    h('p', null, c.acionar.map((id, i) => [i ? ' · ' : '', h('a', { href: '#rede-equipes' }, (S.situacao.EQUIPES[id] || { nome: id }).nome)])),
                  ]
                : null,
            ),
          ),
        ),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'situacao',
    montar(api) {
      A = api;
      ({ h, $, trocar, fmt, ancora, salvar, atualizarTudo, autonomia } = api);
      montarSinais();
      montarCenarios();
    },
    render() {
      renderSituacao();
    },
    recarregar() {
      for (const i of document.querySelectorAll('input[name="sinal"]')) i.checked = A.estado.sinais.includes(i.value);
      $('#ctx-rota').checked = A.estado.rotaSegura;
    },
  });
})();
