/**
 * Aba Defesa comunitária. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;

  let A = null; // API do app, recebida em montar()

  function dataHora(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function horaLocalInput(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ------------------------------------------------------------------ estado

  function padrao() {
    return { defesa: { feitos: {}, frase: '', voluntarios: '', escala: { inicio: '', horas: 24, turno: 3, por: 2, descanso: 6 } } };
  }

  function mesclar(dados, r, u) {
    const num = (v, min, max, pad) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : pad;
    };
    const objeto = (v) => (v && typeof v === 'object' ? v : {});
    const df = objeto(dados.defesa);
    const ids = new Set(S.defesa.CHECKLIST.map((c) => c.id));
    for (const [k, v] of Object.entries(objeto(df.feitos))) if (ids.has(k) && v === true) r.defesa.feitos[k] = true;
    r.defesa.frase = u.texto(df.frase, 80);
    r.defesa.voluntarios = u.texto(df.voluntarios, 2000);
    const es = objeto(df.escala);
    r.defesa.escala = {
      inicio: typeof es.inicio === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(es.inicio) ? es.inicio : '',
      horas: u.inteiro(es.horas, 1, 168, 24),
      turno: u.inteiro(es.turno, 1, 12, 3),
      por: u.inteiro(es.por, 1, 10, 2),
      descanso: u.inteiro(es.descanso, 0, 48, 6),
    };
  }

  // ================================================================== DEFESA

  function montarDefesa() {
    const D = S.defesa;
    A.trocar(A.$('#principios-defesa'), D.PRINCIPIOS.map((p) => A.h('li', null, p)));
    A.trocar(
      A.$('#tabela-sinais'),
      A.h('thead', null, A.h('tr', null, A.h('th', null, 'Sinal'), A.h('th', null, 'Significado'))),
      A.h('tbody', null, D.SINAIS.map((s) => A.h('tr', null, A.h('td', null, A.h('strong', null, s.sinal)), A.h('td', null, s.significado)))),
    );

    const grupos = [...new Set(D.CHECKLIST.map((c) => c.grupo))];
    A.trocar(
      A.$('#checklist-defesa'),
      grupos.map((g) =>
        A.h(
          'fieldset',
          null,
          A.h('legend', null, g),
          D.CHECKLIST.filter((c) => c.grupo === g).map((c) =>
            A.h('label', { class: 'linha' }, A.h('input', { type: 'checkbox', dataset: { seguranca: c.id } }), A.h('span', null, c.texto)),
          ),
        ),
      ),
    );
    A.$('#checklist-defesa').addEventListener('change', (e) => {
      const id = e.target.dataset.seguranca;
      if (!id) return;
      if (e.target.checked) A.estado.defesa.feitos[id] = true;
      else delete A.estado.defesa.feitos[id];
      A.salvar();
      renderSeguranca();
    });

    A.$('#frase-secreta').addEventListener('input', (e) => {
      A.estado.defesa.frase = e.target.value.slice(0, 80);
      A.salvar();
      renderSenhas();
    });
    A.$('#mostrar-frase').addEventListener('change', (e) => {
      A.$('#frase-secreta').type = e.target.checked ? 'text' : 'password';
    });

    A.$('#form-escala').addEventListener('input', (e) => {
      const es = A.estado.defesa.escala;
      const v = e.target.value;
      if (e.target.id === 'voluntarios') A.estado.defesa.voluntarios = v.slice(0, 2000);
      if (e.target.id === 'escala-inicio') es.inicio = v;
      if (e.target.id === 'escala-horas') es.horas = A.inteiro(v, 1, 168, es.horas);
      if (e.target.id === 'escala-turno') es.turno = A.inteiro(v, 1, 12, es.turno);
      if (e.target.id === 'escala-por') es.por = A.inteiro(v, 1, 10, es.por);
      if (e.target.id === 'escala-descanso') es.descanso = A.inteiro(v, 0, 48, es.descanso);
      A.salvar();
      renderEscala();
    });
    recarregarDefesa();
  }

  function recarregarDefesa() {
    const df = A.estado.defesa;
    for (const i of document.querySelectorAll('[data-seguranca]')) i.checked = Boolean(df.feitos[i.dataset.seguranca]);
    A.$('#frase-secreta').value = df.frase;
    A.$('#voluntarios').value = df.voluntarios;
    if (!df.escala.inicio) {
      const d = new Date();
      d.setHours(d.getHours() + 1, 0, 0, 0);
      df.escala.inicio = horaLocalInput(d);
    }
    A.$('#escala-inicio').value = df.escala.inicio;
    A.$('#escala-horas').value = df.escala.horas;
    A.$('#escala-turno').value = df.escala.turno;
    A.$('#escala-por').value = df.escala.por;
    A.$('#escala-descanso').value = df.escala.descanso;
  }

  function renderSeguranca() {
    const r = S.defesa.avaliarSeguranca(A.estado.defesa.feitos);
    const cor = { fragil: 'vermelho', regular: 'amarelo', boa: 'verde' }[r.nivel];
    A.trocar(
      A.$('#resultado-seguranca'),
      A.h(
        'div',
        { class: 'painel-nivel', dataset: { cor } },
        A.h('div', { class: 'rotulo-nivel' }, `Segurança ${r.rotuloNivel.toLowerCase()}`),
        A.h('div', { class: 'postura' }, `${r.percentual}%`),
        A.h('div', { class: 'progresso' }, A.h('span', { style: `width:${r.percentual}%` })),
        r.prioridades.length
          ? [
              A.h('h4', null, 'Próximos passos, por importância'),
              A.h('ol', null, r.prioridades.slice(0, 4).map((c) => A.h('li', null, A.h('strong', null, c.texto), A.h('br'), A.h('span', { class: 'ajuda' }, c.dica)))),
            ]
          : A.h('p', null, 'Todos os itens feitos. Revise a cada mês e treine com a família.'),
      ),
    );
  }

  function renderSenhas() {
    const destino = A.$('#senhas');
    const frase = A.estado.defesa.frase;
    if (!frase.trim()) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, 'Digite a frase combinada para ver a senha de hoje.'));
      return;
    }
    try {
      const hoje = new Date();
      const amanha = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() + 1, 12);
      const bloco = (titulo, s) =>
        A.h(
          'div',
          { class: 'senha-dia' },
          A.h('small', null, `${titulo} (${A.dataBR(s.data)})`),
          A.h('div', null, 'Senha: ', A.h('strong', { class: 'palavra' }, s.senha)),
          A.h('div', null, 'Contrassenha: ', A.h('strong', { class: 'palavra' }, s.contrassenha)),
        );
      A.trocar(destino, A.h('div', { class: 'senhas' }, bloco('Hoje', S.defesa.senhaDoDia(frase, hoje)), bloco('Amanhã', S.defesa.senhaDoDia(frase, amanha))));
    } catch (erro) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, erro.message));
    }
  }

  function renderEscala() {
    const df = A.estado.defesa;
    const destino = A.$('#resultado-escala');
    const nomes = df.voluntarios.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!nomes.length) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, `Escreva os voluntários, um por linha. Para turnos de ${df.escala.turno} h com ${df.escala.por} pessoa(s) e ${df.escala.descanso} h de descanso são necessárias pelo menos ${S.defesa.minimoVoluntarios(df.escala.turno, df.escala.por, df.escala.descanso)} pessoas.`));
      return;
    }
    try {
      const r = S.defesa.gerarEscala(nomes, {
        inicio: new Date(df.escala.inicio),
        horas: df.escala.horas,
        duracaoTurno: df.escala.turno,
        porTurno: df.escala.por,
        descansoMinimo: df.escala.descanso,
      });
      A.trocar(
        destino,
        r.avisos.map((a) => A.h('p', { class: 'aviso' }, a)),
        A.h(
          'div',
          { class: 'tabela-rolagem' },
          A.h(
            'table',
            null,
            A.h('thead', null, A.h('tr', null, A.h('th', null, 'Turno'), A.h('th', null, 'Vigias'))),
            A.h(
              'tbody',
              null,
              r.turnos.map((t) =>
                A.h(
                  'tr',
                  { class: t.completo ? null : 'incompleto' },
                  A.h('td', { class: 'num-esq' }, `${dataHora(t.inicio)} – ${String(t.fim.getHours()).padStart(2, '0')}:${String(t.fim.getMinutes()).padStart(2, '0')}`),
                  A.h('td', null, t.pessoas.length ? t.pessoas.join(' e ') : '— ninguém disponível —'),
                ),
              ),
            ),
          ),
        ),
        A.h('p', { class: 'ajuda' }, 'Horas por pessoa: ', r.carga.map((c) => `${c.nome} ${A.fmt(c.horas)} h`).join(' · '), '.'),
      );
    } catch (erro) {
      A.trocar(destino, A.h('p', { class: 'aviso' }, erro.message));
    }
  }

  function renderDefesa() {
    renderSeguranca();
    renderSenhas();
    renderEscala();
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'defesa',
    padrao,
    mesclar,
    montar(api) {
      A = api;
      montarDefesa();
    },
    render: renderDefesa,
    recarregar: recarregarDefesa,
  });
})();
