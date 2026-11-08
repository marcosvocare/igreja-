/**
 * Aba Abrigo na igreja: capacidade, quem está no abrigo e escala de tarefas.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const B = S.abrigo;
  let A = null;

  function agora() {
    return new Date().toISOString();
  }

  function renderCapacidade() {
    const e = A.estado.abrigo.espaco;
    const r = B.capacidade(e);
    const nomes = { area: 'espaço coberto', banheiros: 'banheiros', agua: 'água' };
    const ocup = B.ocupacao(A.estado.abrigo.abrigados);
    A.trocar(
      A.$('#resultado-capacidade'),
      r.capacidade === null
        ? A.h('p', { class: 'ajuda' }, 'Informe a área coberta, os banheiros e a água por dia.')
        : [
            A.h(
              'div',
              { class: 'metricas' },
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.capacidade)), A.h('small', null, `pessoas no máximo (limite: ${nomes[r.gargalo]})`)),
              A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(ocup.presentes)), A.h('small', null, `no abrigo agora, ${ocup.familias} família(s)`)),
            ),
            ocup.presentes > r.capacidade ? A.h('p', { class: 'aviso' }, 'O abrigo passou da capacidade: procurem outro espaço (casa de apoio, escola) antes que faltem banheiro e água.') : null,
            A.h('p', { class: 'ajuda' }, `Limites: ${Object.entries(r.limites).map(([k, v]) => `${nomes[k]} ${v}`).join(' · ')}.`),
          ],
    );
  }

  function renderAbrigados() {
    const lista = A.estado.abrigo.abrigados;
    const presentes = lista.filter((a) => !a.saida);
    const botao = (acao, id, texto, rotulo) => A.h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo }, texto);
    A.trocar(
      A.$('#lista-abrigados'),
      presentes.length
        ? A.h(
            'div',
            { class: 'tabela-rolagem' },
            A.h(
              'table',
              null,
              A.h('thead', null, A.h('tr', null, A.h('th', null, 'Pessoa'), A.h('th', null, 'Família'), A.h('th', null, 'Chegou'), A.h('th', null, ''))),
              A.h(
                'tbody',
                null,
                presentes.map((a) =>
                  A.h(
                    'tr',
                    null,
                    A.h('td', null, a.nome, a.necessidades ? [A.h('br'), A.h('small', { class: 'aviso-linha' }, a.necessidades)] : null),
                    A.h('td', null, a.familia || '—'),
                    A.h('td', null, A.haQuanto(a.chegada)),
                    A.h('td', { class: 'acoes-linha' }, botao('saiu', a.id, 'Saiu', `Registrar saída de ${a.nome}`), botao('remover', a.id, '✕', `Remover ${a.nome}`)),
                  ),
                ),
              ),
            ),
          )
        : A.h('p', { class: 'ajuda' }, 'Ninguém registrado no abrigo.'),
      lista.length > presentes.length ? A.h('p', { class: 'ajuda' }, `${lista.length - presentes.length} pessoa(s) já saíram.`) : null,
    );
  }

  function renderEscala() {
    const ab = A.estado.abrigo;
    const familias = [...new Set(ab.abrigados.filter((a) => !a.saida).map((a) => String(a.familia || '').trim()).filter(Boolean))];
    const tarefas = ab.tarefas.split('\n').map((t) => t.trim()).filter(Boolean);
    if (!familias.length || !tarefas.length) {
      A.trocar(A.$('#escala-tarefas'), A.h('p', { class: 'ajuda' }, 'A escala aparece quando houver famílias no abrigo e tarefas na lista.'));
      return;
    }
    const escala = B.escalaTarefas(familias, tarefas, ab.dias);
    A.trocar(
      A.$('#escala-tarefas'),
      A.h(
        'div',
        { class: 'tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Dia'), tarefas.map((t) => A.h('th', null, t)))),
          A.h('tbody', null, escala.map((d) => A.h('tr', null, A.h('td', null, `Dia ${d.dia}`), d.tarefas.map((x) => A.h('td', null, x.familia))))),
        ),
      ),
    );
  }

  function render() {
    renderCapacidade();
    renderAbrigados();
    renderEscala();
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'abrigo',
    padrao: () => ({ abrigo: { espaco: { areaM2: 0, banheiros: 0, aguaLitrosDia: 0 }, abrigados: [], tarefas: B.TAREFAS_PADRAO.join('\n'), dias: 7 } }),
    mesclar(dados, r, u) {
      const d = dados.abrigo && typeof dados.abrigo === 'object' ? dados.abrigo : {};
      const e = d.espaco && typeof d.espaco === 'object' ? d.espaco : {};
      const num = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n >= 0 && n <= 1e7 ? n : 0;
      };
      r.abrigo = {
        espaco: { areaM2: num(e.areaM2), banheiros: num(e.banheiros), aguaLitrosDia: num(e.aguaLitrosDia) },
        abrigados: u
          .lista(d.abrigados)
          .filter((a) => typeof a.nome === 'string' && a.nome.trim())
          .map((a) => ({
            id: u.texto(a.id, 40) || u.novoId(),
            nome: a.nome.slice(0, 60),
            familia: u.texto(a.familia, 40),
            necessidades: u.texto(a.necessidades, 120),
            chegada: u.dataValida(a.chegada),
            saida: u.dataValida(a.saida),
            atualizadoEm: u.dataValida(a.atualizadoEm),
          })),
        tarefas: typeof d.tarefas === 'string' ? d.tarefas.slice(0, 1000) : B.TAREFAS_PADRAO.join('\n'),
        dias: u.inteiro(d.dias, 1, 60, 7),
      };
    },
    montar(api) {
      A = api;
      A.trocar(A.$('#regras-abrigo'), B.REGRAS.map((t) => A.h('li', null, t)));
      A.$('#form-capacidade').addEventListener('input', (e) => {
        const esp = A.estado.abrigo.espaco;
        if (e.target.id === 'ab-area') esp.areaM2 = Number(e.target.value) || 0;
        if (e.target.id === 'ab-banheiros') esp.banheiros = Number(e.target.value) || 0;
        if (e.target.id === 'ab-agua') esp.aguaLitrosDia = Number(e.target.value) || 0;
        A.salvar();
        renderCapacidade();
      });
      A.$('#form-abrigado').addEventListener('submit', (e) => {
        e.preventDefault();
        const nome = A.$('#ab-nome').value.trim();
        if (!nome) return;
        A.estado.abrigo.abrigados.push({
          id: A.novoId(),
          nome: nome.slice(0, 60),
          familia: A.$('#ab-familia').value.trim().slice(0, 40),
          necessidades: A.$('#ab-necessidades').value.trim().slice(0, 120),
          chegada: agora(),
          saida: null,
          atualizadoEm: agora(),
        });
        A.$('#ab-nome').value = '';
        A.$('#ab-necessidades').value = '';
        A.$('#ab-nome').focus();
        A.salvar();
        render();
      });
      A.$('#lista-abrigados').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-acao]');
        if (!b) return;
        const lista = A.estado.abrigo.abrigados;
        const a = lista.find((x) => x.id === b.dataset.id);
        if (!a) return;
        if (b.dataset.acao === 'saiu') {
          a.saida = agora();
          a.atualizadoEm = agora();
        }
        if (b.dataset.acao === 'remover') A.estado.abrigo.abrigados = lista.filter((x) => x !== a);
        A.salvar();
        render();
      });
      A.$('#form-tarefas').addEventListener('input', (e) => {
        if (e.target.id === 'ab-tarefas') A.estado.abrigo.tarefas = e.target.value.slice(0, 1000);
        if (e.target.id === 'ab-dias') A.estado.abrigo.dias = A.inteiro(e.target.value, 1, 60, 7);
        A.salvar();
        renderEscala();
      });
      this.recarregar();
    },
    recarregar() {
      const ab = A.estado.abrigo;
      A.$('#ab-area').value = ab.espaco.areaM2 || '';
      A.$('#ab-banheiros').value = ab.espaco.banheiros || '';
      A.$('#ab-agua').value = ab.espaco.aguaLitrosDia || '';
      A.$('#ab-tarefas').value = ab.tarefas;
      A.$('#ab-dias').value = ab.dias;
    },
    render,
  });
})();
