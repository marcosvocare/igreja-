/**
 * Aba Rede de apoio e equipes de socorro. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, novoId, linkTel, salvar;

  // -------------------------------------------------------------------- rede

  function montarRede() {
    trocar(
      $('#campos-habilidades'),
      Object.entries(S.rede.HABILIDADES).map(([v, t]) => h('label', { class: 'linha' }, h('input', { type: 'checkbox', name: 'habilidades', value: v }), h('span', null, t))),
    );
    trocar(
      $('#campos-necessidades'),
      Object.entries(S.rede.NECESSIDADES).map(([v, d]) =>
        h('label', { class: 'linha' }, h('input', { type: 'checkbox', name: 'necessidades', value: v }), h('span', null, d.rotulo)),
      ),
    );
    const form = $('#form-rede');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const nome = f.nome.value.trim();
      if (!nome) return;
      const marcados = (nome_) => Array.from(form.querySelectorAll(`input[name="${nome_}"]:checked`)).map((i) => i.value);
      A.estado.rede.push({
        id: novoId(),
        nome: nome.slice(0, 60),
        bairro: f.bairro.value.trim().slice(0, 60),
        telefone: f.telefone.value.trim().slice(0, 20),
        habilidades: marcados('habilidades'),
        necessidades: marcados('necessidades'),
        atualizadoEm: new Date().toISOString(),
      });
      form.reset();
      f.nome.focus();
      salvar();
      renderRede();
    });
    $('#lista-rede').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao="remover"]');
      if (!b) return;
      A.estado.rede = A.estado.rede.filter((m) => m.id !== b.dataset.id);
      salvar();
      renderRede();
    });
  }

  function montarEquipes() {
    trocar(
      $('#campos-equipes'),
      Object.entries(S.situacao.EQUIPES).map(([k, eq]) =>
        h(
          'label',
          { for: `equipe-${k}` },
          h('strong', null, eq.nome),
          h('small', { class: 'ajuda' }, ` — ${eq.faz}`),
          h('input', { id: `equipe-${k}`, dataset: { equipe: k }, maxlength: 80, placeholder: 'Ex.: Irmã Lúcia · rádio LUCI · casa ao lado da igreja', value: A.estado.equipes[k] }),
        ),
      ),
    );
    $('#campos-equipes').addEventListener('input', (e) => {
      const k = e.target.dataset.equipe;
      if (!k) return;
      A.estado.equipes[k] = e.target.value.slice(0, 80);
      salvar();
      A.renderizar('situacao', 'comunicacao');
    });
  }

  function renderRede() {
    const H = S.rede.HABILIDADES;
    const N = S.rede.NECESSIDADES;
    const bairros = [...new Set(A.estado.rede.map((m) => m.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    trocar($('#bairros'), bairros.map((b) => h('option', { value: b })));

    if (!A.estado.rede.length) {
      trocar($('#pareamento'), h('p', { class: 'cartao ajuda' }, 'Cadastre as pessoas da comunidade para ver quem apoia quem.'));
      trocar($('#lacunas'));
      trocar($('#lista-rede'));
      return;
    }

    const { pares, semCobertura } = S.rede.parearApoio(A.estado.rede);
    const telDe = (nome) => (A.estado.rede.find((m) => m.nome === nome) || {}).telefone;
    trocar(
      $('#pareamento'),
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, 'Quem apoia quem'),
        pares.length
          ? h(
              'div',
              { class: 'tabela-rolagem' },
              h(
                'table',
                null,
                h('thead', null, h('tr', null, h('th', null, 'Precisa'), h('th', null, 'Motivo'), h('th', null, 'Apoio'))),
                h(
                  'tbody',
                  null,
                  pares.map((p) =>
                    h(
                      'tr',
                      null,
                      h('td', null, linkTel(p.pessoa, telDe(p.pessoa))),
                      h('td', null, p.rotulo),
                      h('td', null, linkTel(p.ajudante, telDe(p.ajudante)), h('br'), h('small', { class: 'ajuda' }, `${H[p.habilidade]}${p.mesmoBairro ? ' · mesmo bairro' : ''}`)),
                    ),
                  ),
                ),
              ),
            )
          : h('p', { class: 'ajuda' }, 'Nenhum pareamento possível ainda.'),
        semCobertura.length
          ? h('p', { class: 'aviso' }, 'Sem apoio definido: ', semCobertura.map((s) => `${s.pessoa} (${s.rotulo.toLowerCase()})`).join('; '), '.')
          : null,
      ),
    );

    const { porBairro, lacunas } = S.rede.resumoRecursos(A.estado.rede);
    trocar(
      $('#lacunas'),
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, 'Recursos por bairro'),
        h(
          'ul',
          null,
          Object.entries(porBairro).map(([bairro, b]) =>
            h('li', null, h('strong', null, bairro), ` — ${b.membros} pessoa(s)`, Object.keys(b.habilidades).length ? `: ${Object.entries(b.habilidades).map(([k, n]) => `${H[k].split(' (')[0].toLowerCase()} (${n})`).join(', ')}` : ''),
          ),
        ),
        lacunas.length
          ? [
              h('h3', null, 'Lacunas'),
              h(
                'ul',
                null,
                lacunas.map((l) => h('li', null, `${l.bairro}: ${N[l.necessidade].rotulo.toLowerCase()} — ninguém no bairro com: ${l.faltam.map((f) => H[f].split(' (')[0].toLowerCase()).join(' ou ')}.`)),
              ),
            ]
          : null,
      ),
    );

    trocar(
      $('#lista-rede'),
      h(
        'div',
        { class: 'cartao tabela-rolagem' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, 'Pessoa'), h('th', null, 'Bairro'), h('th', null, 'Ajuda / precisa'), h('th', null, ''))),
          h(
            'tbody',
            null,
            A.estado.rede.map((m) =>
              h(
                'tr',
                null,
                h('td', null, linkTel(m.nome, m.telefone)),
                h('td', null, m.bairro || '—'),
                h(
                  'td',
                  null,
                  m.habilidades.map((x) => h('span', { class: 'tag' }, H[x].split(' (')[0])),
                  m.necessidades.map((x) => h('span', { class: 'tag precisa' }, N[x].rotulo)),
                ),
                h('td', null, h('button', { type: 'button', class: 'mini secundario', dataset: { acao: 'remover', id: m.id }, 'aria-label': `Remover ${m.nome}` }, '✕')),
              ),
            ),
          ),
        ),
      ),
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'rede',
    montar(api) {
      A = api;
      ({ h, $, trocar, novoId, linkTel, salvar } = api);
      montarRede();
      montarEquipes();
    },
    render() {
      renderRede();
    },
    recarregar() {
      for (const i of document.querySelectorAll('[data-equipe]')) i.value = A.estado.equipes[i.dataset.equipe];
    },
  });
})();
