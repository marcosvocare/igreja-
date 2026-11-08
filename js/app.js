/**
 * Interface do app offline. Toda a lógica de cálculo está em js/nucleo/;
 * aqui ficam apenas o estado (salvo no aparelho) e a renderização.
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const CHAVE = 'sobrevivencia-urbana:v1';
  const DIAS_META = [3, 7, 14, 30];
  // Extensões (ex.: js/app-colapso.js) registradas antes deste arquivo.
  const EXTENSOES = Array.isArray(S.extensoes) ? S.extensoes : [];

  // ------------------------------------------------------------- utilitários

  function h(tag, attrs, ...filhos) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === false || v === null || v === undefined) continue;
      if (k === 'class') el.className = v;
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(el.dataset, v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, String(v));
    }
    for (const f of filhos.flat(Infinity)) {
      if (f === null || f === undefined || f === false) continue;
      el.append(f instanceof Node ? f : String(f));
    }
    return el;
  }

  const $ = (seletor) => document.querySelector(seletor);
  const trocar = (el, ...filhos) => el.replaceChildren(...filhos.flat(Infinity).filter((f) => f !== null && f !== undefined && f !== false));

  function fmt(n, casas = 1) {
    return Number(n).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  }

  function novoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function telHref(telefone) {
    const limpo = String(telefone || '').replace(/[^\d+]/g, '');
    return limpo ? `tel:${limpo}` : null;
  }

  function linkTel(texto, telefone) {
    const href = telHref(telefone);
    return href ? h('a', { href }, texto) : texto;
  }

  /** Âncora de endereço só com letras, números e hífens. */
  function ancora(id) {
    return String(id).replace(/_/g, '-');
  }

  /** Copia texto; se o navegador recusar, seleciona o elemento para cópia manual. */
  function copiarTexto(texto, elementoFallback, aoCopiar, aoFalhar) {
    const falhou = () => {
      if (elementoFallback) {
        if (typeof elementoFallback.select === 'function') {
          elementoFallback.focus();
          elementoFallback.select();
        } else {
          const intervalo = document.createRange();
          intervalo.selectNodeContents(elementoFallback);
          const selecao = window.getSelection();
          selecao.removeAllRanges();
          selecao.addRange(intervalo);
        }
      }
      if (aoFalhar) aoFalhar();
    };
    try {
      navigator.clipboard.writeText(texto).then(aoCopiar, falhou);
    } catch (e) {
      falhou();
    }
  }

  function dataBR(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
  }

  function inteiro(valor, min, max, padrao = 0) {
    const n = Number(valor);
    return Number.isInteger(n) && n >= min && n <= max ? n : padrao;
  }

  function numeroPositivo(valor) {
    const n = Number(valor);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  function svg(tag, attrs, ...filhos) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
    for (const f of filhos.flat(Infinity)) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : String(f));
    return el;
  }

  function coordValida(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  /** "350 m", "1,2 km". */
  function metros(m) {
    return m >= 995 ? `${fmt(m / 1000, 1)} km` : `${Math.round(m / 10) * 10} m`;
  }

  function haQuanto(iso) {
    const t = iso ? new Date(iso).getTime() : NaN;
    if (!Number.isFinite(t)) return 'nunca verificado';
    const min = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (min < 1) return 'agora mesmo';
    if (min < 60) return `há ${min} min`;
    const h = Math.round(min / 60);
    if (h < 48) return `há ${h} h`;
    return `há ${Math.round(h / 24)} dias`;
  }

  // ------------------------------------------------------------------ estado

  function padrao() {
    const base = {
      versao: 1,
      casa: { adultos: 2, idosos: 0, gestantes: 0, criancas: 0, bebes: 0, caes: 0, gatos: 0 },
      extras: { remediosContinuos: false, mobilidadeReduzida: false, dependenteEnergia: false },
      diasMeta: 7,
      climaQuente: false,
      sinais: [],
      rotaSegura: true,
      estoque: [],
      kitMarcados: {},
      contatos: [],
      porPessoa: 3,
      pontos: { casa: '', bairro: '', fora: '', contatoFora: '' },
      horarios: '08:00, 12:00, 18:00, 21:00',
      nomeSms: '',
      rede: [],
      equipes: Object.fromEntries(Object.keys(S.situacao.EQUIPES).map((k) => [k, ''])),
    };
    for (const ext of EXTENSOES) if (ext.padrao) Object.assign(base, ext.padrao());
    return base;
  }

  /** Mescla dados salvos/importados sobre o padrão, descartando o que for inválido. */
  function mesclar(dados) {
    const r = padrao();
    if (!dados || typeof dados !== 'object') return r;
    const texto = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '');
    const lista = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);

    if (dados.casa && typeof dados.casa === 'object') {
      for (const k of Object.keys(r.casa)) r.casa[k] = inteiro(dados.casa[k], 0, 50, r.casa[k]);
    }
    if (dados.extras && typeof dados.extras === 'object') {
      for (const k of Object.keys(r.extras)) r.extras[k] = dados.extras[k] === true;
    }
    if (dados.pontos && typeof dados.pontos === 'object') {
      for (const k of Object.keys(r.pontos)) r.pontos[k] = texto(dados.pontos[k], 120);
    }
    if (DIAS_META.includes(dados.diasMeta)) r.diasMeta = dados.diasMeta;
    r.porPessoa = inteiro(dados.porPessoa, 2, 5, 3);
    r.climaQuente = dados.climaQuente === true;
    r.rotaSegura = dados.rotaSegura !== false;
    if (typeof dados.horarios === 'string') r.horarios = dados.horarios.slice(0, 200);
    r.nomeSms = texto(dados.nomeSms, 30);
    if (dados.equipes && typeof dados.equipes === 'object') {
      for (const k of Object.keys(r.equipes)) r.equipes[k] = texto(dados.equipes[k], 80);
    }

    const idsSinais = new Set(S.situacao.SINAIS.map((s) => s.id));
    r.sinais = Array.isArray(dados.sinais) ? dados.sinais.filter((id) => idsSinais.has(id)) : [];

    if (dados.kitMarcados && typeof dados.kitMarcados === 'object') {
      for (const [k, v] of Object.entries(dados.kitMarcados)) if (v === true) r.kitMarcados[k] = true;
    }

    r.estoque = lista(dados.estoque)
      .filter((i) => typeof i.nome === 'string' && i.nome.trim())
      .map((i) => ({
        id: texto(i.id, 40) || novoId(),
        nome: i.nome.slice(0, 80),
        categoria: S.estoque.CATEGORIAS[i.categoria] ? i.categoria : 'outro',
        quantidade: inteiro(i.quantidade, 0, 100000, 1),
        litros: numeroPositivo(i.litros),
        kcal: numeroPositivo(i.kcal),
        validade: S.estoque.diaUTC(i.validade) !== null ? i.validade : '',
      }));

    r.contatos = lista(dados.contatos)
      .filter((c) => typeof c.nome === 'string' && c.nome.trim())
      .map((c) => ({ id: texto(c.id, 40) || novoId(), nome: c.nome.slice(0, 60), telefone: texto(c.telefone, 20) }));

    const habs = new Set(Object.keys(S.rede.HABILIDADES));
    const necs = new Set(Object.keys(S.rede.NECESSIDADES));
    r.rede = lista(dados.rede)
      .filter((m) => typeof m.nome === 'string' && m.nome.trim())
      .map((m) => ({
        id: texto(m.id, 40) || novoId(),
        nome: m.nome.slice(0, 60),
        bairro: texto(m.bairro, 60),
        telefone: texto(m.telefone, 20),
        habilidades: Array.isArray(m.habilidades) ? m.habilidades.filter((x) => habs.has(x)) : [],
        necessidades: Array.isArray(m.necessidades) ? m.necessidades.filter((x) => necs.has(x)) : [],
      }));
    for (const ext of EXTENSOES) if (ext.mesclar) ext.mesclar(dados, r, { texto, lista, inteiro, numeroPositivo, novoId });
    return r;
  }

  const CHAVE_RECUPERACAO = `${CHAVE}:recuperacao`;
  let problemaAoCarregar = null;

  /**
   * Lê os dados salvos. Se não for possível (arquivo corrompido ou erro do app),
   * guarda uma cópia intacta em CHAVE_RECUPERACAO antes de seguir com dados
   * vazios, para que nada se perca ao salvar de novo.
   */
  function carregar() {
    let bruto = null;
    try {
      bruto = localStorage.getItem(CHAVE);
    } catch (e) {
      return padrao(); // armazenamento indisponível: nada a perder
    }
    if (!bruto) return padrao();
    try {
      return mesclar(JSON.parse(bruto));
    } catch (e) {
      problemaAoCarregar = e;
      try {
        if (!localStorage.getItem(CHAVE_RECUPERACAO)) localStorage.setItem(CHAVE_RECUPERACAO, bruto);
      } catch (e2) {
        /* sem espaço: o aviso abaixo ainda orienta */
      }
      return padrao();
    }
  }

  let estado = carregar();

  function salvar() {
    try {
      localStorage.setItem(CHAVE, JSON.stringify(estado));
    } catch (e) {
      /* armazenamento indisponível (modo privado): o app segue funcionando nesta sessão */
    }
  }

  // ------------------------------------------------------ cálculos derivados

  function calculoSuprimentos() {
    return S.suprimentos.calcularSuprimentos(estado.casa, { dias: estado.diasMeta, climaQuente: estado.climaQuente });
  }

  function necessidade() {
    return calculoSuprimentos().necessidadeDiaria;
  }

  function autonomia() {
    return S.estoque.calcularAutonomia(estado.estoque, necessidade());
  }

  // --------------------------------------------------------------- navegação

  const SECOES = Array.from(document.querySelectorAll('.secao')).map((s) => s.id);

  function mostrarSecao() {
    let hash = '';
    try {
      hash = decodeURIComponent(location.hash.slice(1));
    } catch (e) {
      /* endereço malformado: volta para a triagem */
    }
    const atual = SECOES.find((id) => hash === id || hash.startsWith(`${id}-`)) || 'situacao';
    const sub = hash.startsWith(`${atual}-`) ? hash.slice(atual.length + 1) : '';
    for (const id of SECOES) document.getElementById(id).classList.toggle('ativa', id === atual);
    // Menu em dois níveis: seção (grupo) e abas da seção.
    const linkAtual = document.querySelector(`.abas a[href="#${atual}"]`);
    const grupo = linkAtual ? linkAtual.dataset.grupo : '';
    for (const g of document.querySelectorAll('.grupos a')) {
      if (g.dataset.grupo === grupo) g.setAttribute('aria-current', 'true');
      else g.removeAttribute('aria-current');
    }
    for (const a of document.querySelectorAll('.abas a')) {
      a.hidden = a.dataset.grupo !== grupo;
      if (a === linkAtual) {
        a.setAttribute('aria-current', 'page');
        a.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else a.removeAttribute('aria-current');
    }
    for (const ext of EXTENSOES) {
      if (ext.navegar && ext.navegar(atual, sub)) return;
    }
    if (atual === 'situacao' && sub === 'resultado') {
      $('#resultado-situacao').scrollIntoView({ block: 'start' });
      return;
    }
    if (sub && atual !== 'cenarios') {
      const alvo = document.getElementById(hash);
      if (alvo) {
        alvo.scrollIntoView({ block: 'start' });
        return;
      }
    }
    if (atual === 'cenarios' && sub) {
      const cenario = S.cenarios.CENARIOS.find((c) => ancora(c.id) === sub);
      const alvo = cenario && document.getElementById(`cen-${cenario.id}`);
      if (alvo) {
        alvo.open = true;
        alvo.classList.add('destaque');
        setTimeout(() => alvo.classList.remove('destaque'), 2000);
        alvo.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }

  // ------------------------------------------------------------------- dados

  function montarDados() {
    const msg = $('#mensagem-dados');
    $('#exportar').addEventListener('click', () => {
      const blob = new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = h('a', { href: url, download: `sobrevivencia-urbana-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      msg.textContent = 'Cópia de segurança baixada.';
    });
    const restaurar = (texto) => {
      try {
        const dados = JSON.parse(texto);
        if (!dados || typeof dados !== 'object' || dados.versao !== 1) throw new Error('formato');
        estado = mesclar(dados);
        salvar();
        recarregarFormularios();
        msg.textContent = 'Cópia restaurada.';
        return true;
      } catch (erro) {
        msg.textContent = 'Não foi possível ler essa cópia. Use um arquivo ou texto gerado por este app, sem alterações.';
        return false;
      }
    };
    $('#importar').addEventListener('change', async (e) => {
      const arquivo = e.target.files && e.target.files[0];
      if (arquivo) restaurar(await arquivo.text());
      e.target.value = '';
    });
    $('#copiar-dados').addEventListener('click', () => {
      const texto = JSON.stringify(estado);
      const area = $('#texto-backup');
      copiarTexto(
        texto,
        null,
        () => (msg.textContent = 'Dados copiados. Cole em um e-mail ou bloco de notas e guarde fora deste aparelho.'),
        () => {
          area.value = texto;
          $('#restaurar-texto').open = true;
          area.focus();
          area.select();
          msg.textContent = 'O texto está selecionado abaixo: copie e guarde fora deste aparelho.';
        },
      );
    });
    $('#restaurar-texto-botao').addEventListener('click', () => {
      if (restaurar($('#texto-backup').value.trim())) $('#texto-backup').value = '';
    });

    // Apagar pede um segundo toque (o navegador do app publicado não mostra confirm()).
    let aguardandoConfirmacao = false;
    let relogio = null;
    const botaoApagar = $('#apagar');
    const cancelarApagar = () => {
      aguardandoConfirmacao = false;
      clearTimeout(relogio);
      botaoApagar.textContent = 'Apagar todos os dados';
    };
    botaoApagar.addEventListener('click', () => {
      if (!aguardandoConfirmacao) {
        aguardandoConfirmacao = true;
        botaoApagar.textContent = 'Toque de novo para apagar tudo';
        msg.textContent = 'Isso apaga estoque, contatos, kit e rede deste aparelho. Faça uma cópia antes.';
        relogio = setTimeout(cancelarApagar, 6000);
        return;
      }
      cancelarApagar();
      try {
        localStorage.removeItem(CHAVE);
      } catch (erro) {
        /* ignora */
      }
      estado = padrao();
      recarregarFormularios();
      msg.textContent = 'Dados apagados.';
    });
  }

  /** Reaplica o estado nos formulários (após importar ou apagar). */
  function recarregarFormularios() {
    for (const ext of EXTENSOES) if (ext.recarregar) ext.recarregar();
    atualizarTudo();
  }

  // ------------------------------------------------------------------- geral

  function atualizarTudo() {
    for (const ext of EXTENSOES) ext.render();
  }

  /** Redesenha só as abas indicadas (pelo nome da extensão). */
  function renderizar(...nomes) {
    for (const ext of EXTENSOES) if (nomes.includes(ext.nome)) ext.render();
  }

  /** O que as extensões podem usar do app. */
  const api = {
    S,
    h,
    $,
    trocar,
    fmt,
    novoId,
    inteiro,
    numeroPositivo,
    copiarTexto,
    dataBR,
    linkTel,
    ancora,
    salvar,
    atualizarTudo: () => atualizarTudo(),
    renderizar,
    telHref,
    svg,
    coordValida,
    metros,
    haQuanto,
    calculoSuprimentos,
    necessidade,
    autonomia,
    get estado() {
      return estado;
    },
  };

  montarDados();
  for (const ext of EXTENSOES) ext.montar(api);

  // Dados salvos que não puderam ser lidos: avisa e oferece a cópia guardada.
  if (problemaAoCarregar) {
    $('main').prepend(
      h(
        'div',
        { class: 'aviso aviso-topo', role: 'alert' },
        'Não consegui ler os dados salvos neste aparelho. Uma cópia intacta foi guardada. ',
        h(
          'button',
          {
            type: 'button',
            class: 'mini',
            onclick: () => {
              let guardado = '';
              try {
                guardado = localStorage.getItem(CHAVE_RECUPERACAO) || '';
              } catch (e) {
                /* sem acesso */
              }
              location.hash = 'dados';
              $('#restaurar-texto').open = true;
              $('#texto-backup').value = guardado;
            },
          },
          'Recuperar',
        ),
      ),
    );
  }
  atualizarTudo();
  mostrarSecao();
  window.addEventListener('hashchange', mostrarSecao);
  // Tema: escuro (padrão) → claro → automático (segue o aparelho). Só neste aparelho.
  const CHAVE_TEMA = 'sobrevivencia-urbana:tema';
  const TEMAS = { escuro: { proximo: 'claro', rotulo: 'Escuro' }, claro: { proximo: 'sistema', rotulo: 'Claro' }, sistema: { proximo: 'escuro', rotulo: 'Automático' } };
  function aplicarTema(tema) {
    const t = TEMAS[tema] ? tema : 'escuro';
    if (t === 'escuro') document.documentElement.setAttribute('data-theme', 'dark');
    else if (t === 'claro') document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    const botao = $('#botao-tema');
    botao.textContent = TEMAS[t].rotulo;
    botao.setAttribute('aria-label', `Tema: ${TEMAS[t].rotulo}. Tocar para mudar.`);
    botao.dataset.tema = t;
  }
  let temaSalvo = 'escuro';
  try {
    temaSalvo = localStorage.getItem(CHAVE_TEMA) || 'escuro';
  } catch (e) {
    /* sem armazenamento: fica no padrão */
  }
  aplicarTema(temaSalvo);
  $('#botao-tema').addEventListener('click', () => {
    const proximo = TEMAS[$('#botao-tema').dataset.tema].proximo;
    aplicarTema(proximo);
    try {
      localStorage.setItem(CHAVE_TEMA, proximo);
    } catch (e) {
      /* sem armazenamento: vale só nesta visita */
    }
  });

  // Modo de tela: "computador" monta a página com 1180 px e reduz para caber em telas
  // estreitas; "celular" usa o layout de uma coluna. Só neste aparelho.
  const CHAVE_TELA = 'sobrevivencia-urbana:tela';
  const LARGURA_COMPUTADOR = 1180;
  let modoTela = 'computador';
  try {
    modoTela = localStorage.getItem(CHAVE_TELA) || 'computador';
  } catch (e) {
    /* sem armazenamento: fica no padrão */
  }
  function aplicarTela() {
    const estreita = window.innerWidth < LARGURA_COMPUTADOR;
    const reduzir = modoTela === 'computador' && estreita;
    document.documentElement.classList.toggle('modo-computador', reduzir);
    document.body.style.zoom = reduzir ? String(window.innerWidth / LARGURA_COMPUTADOR) : '';
    const botao = $('#botao-tela');
    botao.hidden = !estreita; // numa tela larga os dois modos são iguais
    botao.textContent = modoTela === 'computador' ? 'Computador' : 'Celular';
    botao.setAttribute('aria-label', `Tela: ${botao.textContent}. Tocar para mudar.`);
  }
  aplicarTela();
  window.addEventListener('resize', aplicarTela);
  $('#botao-tela').addEventListener('click', () => {
    modoTela = modoTela === 'computador' ? 'celular' : 'computador';
    try {
      localStorage.setItem(CHAVE_TELA, modoTela);
    } catch (e) {
      /* sem armazenamento: vale só nesta visita */
    }
    aplicarTela();
  });

  // O selo do topo leva ao resultado da triagem, mesmo se o endereço já for esse.
  $('#selo-nivel').addEventListener('click', (e) => {
    if (location.hash === '#situacao-resultado') {
      e.preventDefault();
      mostrarSecao();
    }
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
