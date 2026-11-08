/**
 * Aba Comunicação. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, fmt, novoId, inteiro, linkTel, copiarTexto, salvar;

  // ------------------------------------------------------------- comunicação

  function montarComunicacao() {
    const pontos = $('#form-pontos');
    for (const k of Object.keys(A.estado.pontos)) pontos.elements[k].value = A.estado.pontos[k];
    pontos.addEventListener('input', (e) => {
      if (e.target.name in A.estado.pontos) {
        A.estado.pontos[e.target.name] = e.target.value.slice(0, 120);
        salvar();
        renderPreviaCartao();
      }
    });

    const formContato = $('#form-contato');
    formContato.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = formContato.elements.nome.value.trim();
      if (!nome) return;
      A.estado.contatos.push({ id: novoId(), nome: nome.slice(0, 60), telefone: formContato.elements.telefone.value.trim().slice(0, 20) });
      formContato.elements.nome.value = '';
      formContato.elements.telefone.value = '';
      formContato.elements.nome.focus();
      salvar();
      renderContatos();
    });
    $('#lista-contatos').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const i = A.estado.contatos.findIndex((c) => c.id === b.dataset.id);
      if (i < 0) return;
      if (b.dataset.acao === 'subir' && i > 0) {
        [A.estado.contatos[i - 1], A.estado.contatos[i]] = [A.estado.contatos[i], A.estado.contatos[i - 1]];
      } else if (b.dataset.acao === 'remover') {
        A.estado.contatos.splice(i, 1);
      }
      salvar();
      renderContatos();
    });
    $('#por-pessoa').value = String(A.estado.porPessoa);
    $('#por-pessoa').addEventListener('change', (e) => {
      A.estado.porPessoa = inteiro(e.target.value, 2, 5, 3);
      salvar();
      renderContatos();
    });

    const sms = $('#form-sms');
    sms.elements.nome.value = A.estado.nomeSms;
    sms.addEventListener('input', (e) => {
      if (e.target.name === 'nome') {
        A.estado.nomeSms = e.target.value.slice(0, 30);
        salvar();
      }
      renderSms();
    });

    $('#copiar-sms').addEventListener('click', () => {
      const botao = $('#copiar-sms');
      const aviso = (texto) => {
        botao.textContent = texto;
        setTimeout(() => (botao.textContent = 'Copiar mensagem'), 2500);
      };
      copiarTexto(ultimoSms, $('#previa-sms').firstChild ? $('#previa-sms') : null, () => aviso('Mensagem copiada'), () => aviso('Texto selecionado: copie manualmente'));
    });

    const janelas = $('#form-janelas');
    janelas.elements.horarios.value = A.estado.horarios;
    janelas.addEventListener('input', (e) => {
      if (e.target.name === 'horarios') {
        A.estado.horarios = e.target.value.slice(0, 200);
        salvar();
        renderPreviaCartao();
      }
      renderJanelas();
    });
    trocar($('#dicas-bateria'), S.comunicacao.DICAS_BATERIA.map((d) => h('li', null, d)));

    $('#imprimir-cartao').addEventListener('click', () => {
      renderCartaoBolso();
      window.print();
    });
  }

  function renderContatos() {
    renderPreviaCartao();
    const botao = (acao, id, texto, rotulo) => h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo }, texto);
    trocar(
      $('#lista-contatos'),
      A.estado.contatos.map((c, i) =>
        h(
          'li',
          null,
          linkTel(c.nome, c.telefone),
          c.telefone ? h('small', { class: 'ajuda' }, ` ${c.telefone}`) : null,
          h('span', { class: 'acoes' }, i > 0 ? botao('subir', c.id, '↑', `Subir ${c.nome}`) : null, botao('remover', c.id, '✕', `Remover ${c.nome}`)),
        ),
      ),
    );

    const destino = $('#arvore');
    if (A.estado.contatos.length < 2) {
      trocar(destino, h('p', { class: 'ajuda' }, 'Adicione ao menos 2 contatos para montar a árvore de chamadas.'));
      return;
    }
    const k = A.estado.porPessoa;
    const { rodadas } = S.comunicacao.gerarArvore(A.estado.contatos, { porPessoa: k });
    const lista = A.estado.contatos;
    const no = (i, rodada) => {
      const filhos = [];
      for (let j = k * i + 1; j <= k * i + k && j < lista.length; j++) filhos.push(no(j, rodada + 1));
      return h(
        'li',
        null,
        linkTel(lista[i].nome, lista[i].telefone),
        rodada ? h('span', { class: 'rodada' }, ` (rodada ${rodada})`) : h('span', { class: 'rodada' }, ' (coordena)'),
        filhos.length ? h('ul', null, filhos) : null,
      );
    };
    trocar(
      destino,
      h('div', { class: 'arvore' }, h('ul', null, no(0, 0))),
      h('p', { class: 'ajuda' }, `Todos são avisados em ${rodadas} rodada(s) de ligações ou mensagens.`),
    );
  }

  let ultimoSms = '';

  function renderSms() {
    const f = $('#form-sms').elements;
    const agora = new Date();
    const hora = `${String(agora.getHours()).padStart(2, '0')}h${String(agora.getMinutes()).padStart(2, '0')}`;
    const r = S.comunicacao.montarMensagem(f.tipo.value, {
      nome: f.nome.value,
      local: f.local.value,
      obs: f.obs.value,
      hora,
    });
    const faltando = !f.nome.value.trim() || !f.local.value.trim();
    trocar(
      $('#previa-sms'),
      r.texto,
      h('br'),
      h('small', { class: 'ajuda' }, `${r.caracteres}/160 caracteres · ${r.segmentos} SMS${faltando ? ' · preencha seu nome e o local' : ''}`),
    );
    $('#enviar-sms').setAttribute('href', `sms:?&body=${encodeURIComponent(r.texto)}`);
    ultimoSms = r.texto;
  }

  function renderJanelas() {
    const f = $('#form-janelas').elements;
    try {
      const horarios = f.horarios.value.split(/[,;\s]+/).filter(Boolean);
      const j = S.comunicacao.proximaJanela(horarios, new Date());
      const hh = String(j.proxima.getHours()).padStart(2, '0');
      const mm = String(j.proxima.getMinutes()).padStart(2, '0');
      const espera = j.minutosAte >= 60 ? `${Math.floor(j.minutosAte / 60)} h ${j.minutosAte % 60} min` : `${j.minutosAte} min`;
      $('#proxima-janela').textContent = `${j.emJanela ? 'Agora é janela de contato. ' : ''}Próxima janela: ${hh}:${mm} (em ${espera}).`;
    } catch (erro) {
      $('#proxima-janela').textContent = erro.message;
    }
    try {
      const cargas = S.comunicacao.cargasPowerbank(f.powerbank.value, f.celular.value);
      $('#cargas').textContent = `Esse power bank dá ≈ ${fmt(cargas)} carga(s) completa(s) do celular.`;
    } catch (erro) {
      $('#cargas').textContent = erro.message;
    }
  }

  function renderCartaoBolso() {
    const pessoas = S.suprimentos.totalPessoas(A.estado.casa);
    const copias = Math.min(Math.max(pessoas, 1), 8);
    trocar($('#cartao-bolso'), Array.from({ length: copias }, unidadeCartao));
  }

  function unidadeCartao() {
    const p = A.estado.pontos;
    const linha = (rotulo, valor) => h('p', null, h('strong', null, `${rotulo}: `), valor || '________________________');
    return h(
        'div',
        { class: 'unidade' },
        h('h4', null, 'PLANO DE EMERGÊNCIA'),
        linha('1. Encontro perto de casa', p.casa),
        linha('2. Encontro no bairro', p.bairro),
        linha('3. Encontro fora do bairro', p.fora),
        linha('Contato fora da cidade', p.contatoFora),
        A.estado.contatos.slice(0, 5).map((c) => h('p', null, `${c.nome}: ${c.telefone || '—'}`)),
        linha('Horários de contato', A.estado.horarios),
        Object.entries(S.situacao.EQUIPES)
          .filter(([k]) => A.estado.equipes[k])
          .slice(0, 4)
          .map(([k, eq]) => h('p', null, h('strong', null, `${eq.nome}: `), A.estado.equipes[k])),
        linha('Socorro', `rádio${A.estado.radio ? ` (canal ${A.estado.radio.canalFamilia})` : ''}: código 2 · apito: 3 toques`),
      );
  }

  function renderPreviaCartao() {
    trocar($('#previa-cartao'), unidadeCartao());
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'comunicacao',
    montar(api) {
      A = api;
      ({ h, $, trocar, fmt, novoId, inteiro, linkTel, copiarTexto, salvar } = api);
      montarComunicacao();
      window.addEventListener('beforeprint', renderCartaoBolso);
    },
    render() {
      renderContatos();
      renderSms();
      renderJanelas();
    },
    recarregar() {
      const pontos = $('#form-pontos');
      for (const k of Object.keys(A.estado.pontos)) pontos.elements[k].value = A.estado.pontos[k];
      $('#por-pessoa').value = String(A.estado.porPessoa);
      $('#form-sms').elements.nome.value = A.estado.nomeSms;
      $('#form-janelas').elements.horarios.value = A.estado.horarios;
    },
  });
})();
