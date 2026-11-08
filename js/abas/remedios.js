/**
 * Aba Remédios críticos. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;

  let A = null; // API do app, recebida em montar()

  // ------------------------------------------------------------------ estado

  function padrao() {
    return { remedios: [] };
  }

  function mesclar(dados, r, u) {
    const num = (v, min, max, pad) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : pad;
    };
    const objeto = (v) => (v && typeof v === 'object' ? v : {});
    r.remedios = u
      .lista(dados.remedios)
      .filter((x) => typeof x.nome === 'string' && x.nome.trim())
      .map((x) => ({
        id: u.texto(x.id, 40) || u.novoId(),
        pessoa: u.texto(x.pessoa, 40),
        nome: x.nome.slice(0, 60),
        dosesPorDia: num(x.dosesPorDia, 0, 48, 0),
        unidadesPorDose: num(x.unidadesPorDose, 0, 1000, 1),
        quantidade: num(x.quantidade, 0, 100000, 0),
        validade: typeof x.validade === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.validade) ? x.validade : '',
        refrigerado: x.refrigerado === true,
      }));
  }

  // ================================================================ REMÉDIOS

  function montarRemedios() {
    A.trocar(A.$('#orientacoes-remedios'), S.remedios.ORIENTACOES.map((o) => A.h('li', null, o)));
    const form = A.$('#form-remedio');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#rem-nome').value.trim();
      const pessoa = A.$('#rem-pessoa').value.trim();
      if (!nome || !pessoa) return;
      const num = (id, max) => Math.min(max, A.numeroPositivo(A.$(id).value));
      A.estado.remedios.push({
        id: A.novoId(),
        pessoa: pessoa.slice(0, 40),
        nome: nome.slice(0, 60),
        dosesPorDia: num('#rem-doses', 48),
        unidadesPorDose: num('#rem-unidades', 1000) || 1,
        quantidade: num('#rem-qtd', 100000),
        validade: /^\d{4}-\d{2}-\d{2}$/.test(A.$('#rem-validade').value) ? A.$('#rem-validade').value : '',
        refrigerado: A.$('#rem-geladeira').checked,
      });
      for (const id of ['#rem-nome', '#rem-qtd', '#rem-validade']) A.$(id).value = '';
      A.$('#rem-geladeira').checked = false;
      A.$('#rem-nome').focus();
      A.salvar();
      renderRemedios();
    });
    A.$('#lista-remedios').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const item = A.estado.remedios.find((x) => x.id === b.dataset.id);
      if (!item) return;
      const passo = Math.max(1, item.unidadesPorDose || 1);
      if (b.dataset.acao === 'mais') item.quantidade += passo;
      if (b.dataset.acao === 'menos') item.quantidade = Math.max(0, item.quantidade - passo);
      if (b.dataset.acao === 'remover') A.estado.remedios = A.estado.remedios.filter((x) => x !== item);
      A.salvar();
      renderRemedios();
    });
  }

  function renderRemedios() {
    const itens = A.estado.remedios;
    A.trocar(A.$('#pessoas-remedios'), [...new Set(itens.map((i) => i.pessoa).filter(Boolean))].map((p) => A.h('option', { value: p })));
    if (!itens.length) {
      A.trocar(A.$('#resumo-remedios'), A.h('p', { class: 'cartao ajuda' }, 'Cadastre os remédios de uso contínuo de cada pessoa da casa ou da rede.'));
      A.trocar(A.$('#lista-remedios'));
      return;
    }
    const r = S.remedios.situacaoRemedios(itens, new Date());
    const repor = S.remedios.planoReposicao(itens, 30);
    const rotulos = { critico: ['Crítico', 'vencido'], atencao: ['Atenção', 'vencendo'], ok: ['Em dia', 'ok'], sem_dados: ['Sem dose', 'sem'] };
    A.trocar(
      A.$('#resumo-remedios'),
      A.h(
        'div',
        { class: 'painel-nivel', dataset: { cor: r.criticos ? 'vermelho' : r.atencao ? 'amarelo' : 'verde' } },
        A.h('div', { class: 'rotulo-nivel' }, 'Remédios'),
        A.h('div', { class: 'postura' }, r.criticos ? `${r.criticos} crítico(s)` : r.atencao ? `${r.atencao} em atenção` : 'Tudo em dia'),
        r.pessoasEmRisco.length ? A.h('p', null, `Pessoas em risco: ${r.pessoasEmRisco.join(', ')}.`) : null,
        r.menorCobertura !== null ? A.h('p', null, `O primeiro a acabar dura ${r.menorCobertura} dia(s).`) : null,
        A.h('a', { class: 'botao secundario', href: '#mapa-remedio' }, 'Onde buscar remédios'),
      ),
      repor.length
        ? A.h(
            'div',
            { class: 'cartao' },
            A.h('h3', null, 'Para 30 dias faltam'),
            A.h('ul', null, repor.map((x) => A.h('li', null, `${x.nome} (${x.pessoa}): ${A.fmt(x.faltam, 0)} unidades`))),
          )
        : null,
    );
    const botao = (acao, id, texto, rotulo) => A.h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo }, texto);
    A.trocar(
      A.$('#lista-remedios'),
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Remédio'), A.h('th', null, 'Dura'), A.h('th', { class: 'num' }, 'Estoque'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            r.itens.map((i) =>
              A.h(
                'tr',
                null,
                A.h(
                  'td',
                  null,
                  A.h('strong', null, i.nome),
                  A.h('br'),
                  A.h('small', { class: 'ajuda' }, `${i.pessoa}${i.consumoDiario ? ` · ${A.fmt(i.consumoDiario)} un/dia` : ''}${i.refrigerado ? ' · geladeira' : ''}`),
                  i.avisos.map((a) => [A.h('br'), A.h('small', { class: 'aviso-linha' }, a)]),
                ),
                A.h(
                  'td',
                  null,
                  A.h('span', { class: `estado ${rotulos[i.nivel][1]}` }, i.diasEfetivos === null ? rotulos[i.nivel][0] : `${i.diasEfetivos} dia(s)`),
                  i.acabaEm ? [A.h('br'), A.h('small', { class: 'ajuda' }, `até ${A.dataBR(i.acabaEm)}`)] : null,
                ),
                A.h('td', { class: 'num' }, botao('menos', i.id, '−', `Diminuir ${i.nome}`), ` ${A.fmt(i.quantidade, 1)} `, botao('mais', i.id, '+', `Aumentar ${i.nome}`)),
                A.h('td', null, botao('remover', i.id, '✕', `Remover ${i.nome}`)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'remedios',
    padrao,
    mesclar,
    montar(api) {
      A = api;
      montarRemedios();
    },
    render: renderRemedios,
  });
})();
