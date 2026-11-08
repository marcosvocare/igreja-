/**
 * Aba Pessoas e recados: quem está onde e quadro de recados.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const P = S.pessoas;
  let A = null;

  function agora() {
    return new Date().toISOString();
  }

  function classe(situacao) {
    return { desaparecida: 'vencido', ferida: 'vencido', precisa: 'vencendo', segura: 'ok', fora: 'sem', faleceu: 'sem' }[situacao] || 'sem';
  }

  function renderPessoas() {
    const lista = P.buscar(A.estado.pessoas, A.$('#busca-pessoa').value);
    const r = P.resumo(A.estado.pessoas);
    A.trocar(
      A.$('#resumo-pessoas'),
      A.h(
        'div',
        { class: 'metricas' },
        ['desaparecida', 'ferida', 'precisa', 'segura'].map((k) =>
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.porSituacao[k])), A.h('small', null, P.SITUACOES[k].rotulo)),
        ),
      ),
    );
    A.trocar(
      A.$('#lista-pessoas'),
      lista.length
        ? A.h(
            'div',
            { class: 'tabela-rolagem' },
            A.h(
              'table',
              null,
              A.h('thead', null, A.h('tr', null, A.h('th', null, 'Pessoa'), A.h('th', null, 'Situação'), A.h('th', null, ''))),
              A.h(
                'tbody',
                null,
                lista.map((p) =>
                  A.h(
                    'tr',
                    null,
                    A.h(
                      'td',
                      null,
                      A.h('strong', null, p.nome),
                      p.familia ? ` · ${p.familia}` : '',
                      A.h('br'),
                      A.h('small', { class: 'ajuda' }, [p.onde, p.obs].filter(Boolean).join(' · ') || '—', ` · ${A.haQuanto(p.atualizadoEm)}`),
                    ),
                    A.h(
                      'td',
                      null,
                      A.h('span', { class: `estado ${classe(p.situacao)}` }, P.SITUACOES[p.situacao].rotulo),
                      A.h('br'),
                      A.h(
                        'select',
                        { class: 'select-mini', dataset: { situacao: p.id }, 'aria-label': `Situação de ${p.nome}` },
                        Object.entries(P.SITUACOES).map(([k, s]) => A.h('option', { value: k, selected: k === p.situacao }, s.rotulo)),
                      ),
                    ),
                    A.h('td', null, A.h('button', { type: 'button', class: 'mini secundario', dataset: { removerPessoa: p.id }, 'aria-label': `Remover ${p.nome}` }, '✕')),
                  ),
                ),
              ),
            ),
          )
        : A.h('p', { class: 'ajuda' }, A.$('#busca-pessoa').value ? 'Ninguém encontrado com esse nome.' : 'Ninguém cadastrado ainda.'),
    );
  }

  function renderRecados() {
    const lista = P.recadosPara(A.estado.recados, A.$('#filtro-recado').value);
    A.trocar(
      A.$('#lista-recados'),
      lista.length
        ? A.h(
            'ul',
            { class: 'recados' },
            lista.map((r) =>
              A.h(
                'li',
                null,
                A.h('strong', null, `Para ${r.para}`),
                r.de ? ` (de ${r.de})` : '',
                A.h('small', { class: 'ajuda' }, ` · ${A.haQuanto(r.criadoEm)}`),
                A.h('br'),
                r.texto,
                ' ',
                A.h('button', { type: 'button', class: 'mini secundario', dataset: { removerRecado: r.id }, 'aria-label': `Apagar recado para ${r.para}` }, '✕'),
              ),
            ),
          )
        : A.h('p', { class: 'ajuda' }, 'Nenhum recado.'),
    );
  }

  function render() {
    renderPessoas();
    renderRecados();
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'pessoas',
    padrao: () => ({ pessoas: [], recados: [] }),
    mesclar(dados, r, u) {
      r.pessoas = u
        .lista(dados.pessoas)
        .filter((p) => typeof p.nome === 'string' && p.nome.trim())
        .map((p) => ({
          id: u.texto(p.id, 40) || u.novoId(),
          nome: p.nome.slice(0, 60),
          familia: u.texto(p.familia, 40),
          situacao: P.SITUACOES[p.situacao] ? p.situacao : 'segura',
          onde: u.texto(p.onde, 80),
          obs: u.texto(p.obs, 160),
          atualizadoEm: u.dataValida(p.atualizadoEm),
        }));
      r.recados = u
        .lista(dados.recados)
        .filter((x) => typeof x.texto === 'string' && x.texto.trim())
        .map((x) => ({
          id: u.texto(x.id, 40) || u.novoId(),
          de: u.texto(x.de, 60),
          para: u.texto(x.para, 60) || 'Todos',
          texto: x.texto.slice(0, 300),
          criadoEm: u.dataValida(x.criadoEm),
          atualizadoEm: u.dataValida(x.atualizadoEm),
        }));
    },
    montar(api) {
      A = api;
      A.trocar(A.$('#pessoa-situacao'), Object.entries(P.SITUACOES).map(([k, s]) => A.h('option', { value: k, selected: k === 'segura' }, s.rotulo)));
      A.$('#form-pessoa').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = A.$('#pessoa-nome').value.trim();
        if (!nome) return;
        A.estado.pessoas.push({
          id: A.novoId(),
          nome: nome.slice(0, 60),
          familia: A.$('#pessoa-familia').value.trim().slice(0, 40),
          situacao: A.$('#pessoa-situacao').value,
          onde: A.$('#pessoa-onde').value.trim().slice(0, 80),
          obs: A.$('#pessoa-obs').value.trim().slice(0, 160),
          atualizadoEm: agora(),
        });
        for (const id of ['#pessoa-nome', '#pessoa-onde', '#pessoa-obs']) A.$(id).value = '';
        A.$('#pessoa-nome').focus();
        A.salvar();
        renderPessoas();
      });
      A.$('#busca-pessoa').addEventListener('input', renderPessoas);
      A.$('#lista-pessoas').addEventListener('change', (e) => {
        const sel = e.target.closest('select[data-situacao]');
        if (!sel) return;
        const p = A.estado.pessoas.find((x) => x.id === sel.dataset.situacao);
        if (!p) return;
        p.situacao = sel.value;
        p.atualizadoEm = agora();
        A.salvar();
        renderPessoas();
      });
      A.$('#lista-pessoas').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-remover-pessoa]');
        if (!b) return;
        A.estado.pessoas = A.estado.pessoas.filter((x) => x.id !== b.dataset.removerPessoa);
        A.salvar();
        renderPessoas();
      });
      A.$('#form-recado').addEventListener('submit', (e) => {
        e.preventDefault();
        const texto = A.$('#recado-texto').value.trim();
        if (!texto) return;
        A.estado.recados.push({
          id: A.novoId(),
          de: A.$('#recado-de').value.trim().slice(0, 60),
          para: A.$('#recado-para').value.trim().slice(0, 60) || 'Todos',
          texto: texto.slice(0, 300),
          criadoEm: agora(),
          atualizadoEm: agora(),
        });
        A.$('#recado-texto').value = '';
        A.salvar();
        renderRecados();
      });
      A.$('#filtro-recado').addEventListener('input', renderRecados);
      A.$('#lista-recados').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-remover-recado]');
        if (!b) return;
        A.estado.recados = A.estado.recados.filter((x) => x.id !== b.dataset.removerRecado);
        A.salvar();
        renderRecados();
      });
    },
    render,
  });
})();
