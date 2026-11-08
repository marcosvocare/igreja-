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
      versao: S.versoes.VERSAO_ATUAL,
      casaRevisada: false,
      ultimaCopia: null,
      casa: { adultos: 2, idosos: 0, gestantes: 0, criancas: 0, bebes: 0, caes: 0, gatos: 0 },
      extras: { remediosContinuos: false, mobilidadeReduzida: false, dependenteEnergia: false },
      diasMeta: 7,
      climaQuente: false,
      dietas: { semGluten: false, semLactose: false, diabetes: false, semAmendoim: false },
      porteCaes: 'medio',
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

  /** Data ISO válida ou null (usada para saber qual versão de um item é mais nova). */
  function dataValida(v) {
    return typeof v === 'string' && Number.isFinite(new Date(v).getTime()) ? v : null;
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
    if (dados.dietas && typeof dados.dietas === 'object') {
      for (const k of Object.keys(r.dietas)) r.dietas[k] = dados.dietas[k] === true;
    }
    r.porteCaes = S.suprimentos.PORTES_CAES[dados.porteCaes] ? dados.porteCaes : 'medio';
    r.rotaSegura = dados.rotaSegura !== false;
    if (typeof dados.horarios === 'string') r.horarios = dados.horarios.slice(0, 200);
    r.nomeSms = texto(dados.nomeSms, 30);
    r.casaRevisada = dados.casaRevisada === true;
    r.ultimaCopia = typeof dados.ultimaCopia === 'string' && Number.isFinite(new Date(dados.ultimaCopia).getTime()) ? dados.ultimaCopia : null;
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
        atualizadoEm: dataValida(m.atualizadoEm),
      }));
    for (const ext of EXTENSOES) if (ext.mesclar) ext.mesclar(dados, r, { texto, lista, inteiro, numeroPositivo, novoId, dataValida });
    return r;
  }

  const CHAVE_RECUPERACAO = `${CHAVE}:recuperacao`;
  const SINAIS_IDS = S.situacao.SINAIS.map((x) => x.id);
  let problemaAoCarregar = null;
  let avisosMigracao = [];

  // Senha do app: a chave fica só na memória enquanto o app está aberto.
  let chaveCofre = null;
  let salCofre = null;
  let gravacao = Promise.resolve();

  function lerBruto() {
    try {
      return localStorage.getItem(CHAVE);
    } catch (e) {
      return null; // armazenamento indisponível: nada a perder
    }
  }

  function guardarRecuperacao(bruto) {
    try {
      if (bruto && !localStorage.getItem(CHAVE_RECUPERACAO)) localStorage.setItem(CHAVE_RECUPERACAO, bruto);
    } catch (e) {
      /* sem espaço: o aviso ainda orienta */
    }
  }

  /** Interpreta dados (texto JSON), migrando de versões antigas. Lança erro se forem ilegíveis. */
  function interpretar(texto) {
    const m = S.versoes.migrar(JSON.parse(texto), SINAIS_IDS);
    return { estado: mesclar(m.dados), avisos: m.avisos };
  }

  /**
   * Lê os dados salvos (já decifrados, se havia senha). Se não for possível,
   * guarda uma cópia intacta em CHAVE_RECUPERACAO antes de seguir com dados
   * vazios, para que nada se perca ao salvar de novo.
   */
  function carregarTexto(texto, bruto) {
    if (!texto) return padrao();
    try {
      const r = interpretar(texto);
      avisosMigracao = r.avisos;
      return r.estado;
    } catch (e) {
      problemaAoCarregar = e;
      guardarRecuperacao(bruto);
      return padrao();
    }
  }

  let estado = padrao();

  /** Cópia do estado como deve ser gravada (cada aba pode tirar o que não deve ficar salvo). */
  function paraSalvar() {
    const c = JSON.parse(JSON.stringify(estado));
    for (const ext of EXTENSOES) if (ext.limpar) ext.limpar(c);
    c.versao = S.versoes.VERSAO_ATUAL;
    return c;
  }

  function gravarBruto(texto) {
    try {
      localStorage.setItem(CHAVE, texto);
    } catch (e) {
      /* armazenamento indisponível (modo privado): o app segue funcionando nesta sessão */
    }
  }

  /**
   * Grava o estado. Todas as gravações passam por uma fila, na ordem em que as
   * mudanças aconteceram; com senha, cada uma é cifrada antes de ir para o disco.
   */
  function salvar() {
    const texto = JSON.stringify(paraSalvar());
    const chave = chaveCofre;
    const sal = salCofre;
    gravacao = gravacao
      .then(() => (chave ? S.cofre.cifrar(texto, chave, sal).then((pacote) => JSON.stringify(pacote)) : texto))
      .then(gravarBruto)
      .catch(() => {});
    return gravacao;
  }

  /** Troca todo o estado (restauração, pacote, apagar) e redesenha. */
  function substituirEstado(novo) {
    estado = novo;
    salvar();
    recarregarFormularios();
  }

  /** Dados exportados para cópia de segurança (cifrados se pedido e houver senha). */
  async function exportar({ proteger = true } = {}) {
    const texto = JSON.stringify(paraSalvar());
    if (proteger && chaveCofre) return JSON.stringify(await S.cofre.cifrar(texto, chaveCofre, salCofre));
    return texto;
  }

  /** Restaura uma cópia (texto). Se a cópia tiver senha, `senha` é obrigatória. */
  async function restaurar(texto, senha = '') {
    let obj;
    try {
      obj = JSON.parse(texto);
    } catch (e) {
      throw new Error('Não foi possível ler essa cópia. Use um arquivo ou texto gerado por este app, sem alterações.');
    }
    let claro = texto;
    if (S.cofre.eCofre(obj)) {
      if (!senha) {
        const erro = new Error('Esta cópia tem senha: digite a senha da cópia.');
        erro.codigo = 'precisa_senha';
        throw erro;
      }
      claro = (await S.cofre.abrir(obj, senha)).texto;
    } else if (!obj || typeof obj !== 'object' || !('versao' in obj)) {
      throw new Error('Isto não é uma cópia de segurança do app.');
    }
    const r = interpretar(claro);
    substituirEstado(r.estado);
    return r.avisos;
  }

  const senha = {
    ativa: () => Boolean(chaveCofre),
    /** Ativa ou troca a senha (o app já está aberto). */
    async definir(nova) {
      const sal = S.cofre.gerarSal();
      chaveCofre = await S.cofre.derivarChave(nova, sal);
      salCofre = sal;
      salvar();
      await gravacao;
      iniciarBloqueioAutomatico();
    },
    async remover() {
      chaveCofre = null;
      salCofre = null;
      salvar();
      await gravacao;
    },
    bloquear() {
      gravacao.then(() => location.reload());
    },
  };

  /** Espera as gravações pendentes terminarem. */
  function aguardarGravacao() {
    return gravacao;
  }

  // Bloqueio automático depois de 10 minutos sem uso (só com senha ativa).
  let relogioBloqueio = null;
  function iniciarBloqueioAutomatico() {
    if (!chaveCofre) return;
    const reiniciar = () => {
      clearTimeout(relogioBloqueio);
      relogioBloqueio = setTimeout(() => senha.bloquear(), 10 * 60 * 1000);
    };
    for (const ev of ['pointerdown', 'keydown']) document.addEventListener(ev, reiniciar, { passive: true });
    reiniciar();
  }

  /**
   * Oferece um arquivo para baixar. Na página publicada usa o download do
   * claude.ai; no app instalado ou aberto pelo arquivo, um link de download.
   */
  async function baixar(nome, conteudo, tipo = 'application/json') {
    if (window.claude && typeof window.claude.use === 'function') {
      let dl = null;
      try {
        dl = await window.claude.use('downloads');
      } catch (e) {
        dl = null;
      }
      if (dl) {
        const r = await dl.save({ filename: nome, data: conteudo });
        return r.status;
      }
    }
    const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
    const a = h('a', { href: url, download: nome });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return 'saved';
  }

  /** Tela de bloqueio: resolve com o texto decifrado quando a senha certa é digitada. */
  function pedirSenha(pacote, bruto) {
    return new Promise((resolver) => {
      document.body.classList.add('bloqueado');
      const tela = $('#bloqueio');
      tela.hidden = false;
      const campo = $('#senha-bloqueio');
      const msg = $('#msg-bloqueio');
      const botao = $('#form-bloqueio button[type="submit"]');
      let erros = 0;
      campo.focus();
      const liberar = (texto) => {
        tela.hidden = true;
        document.body.classList.remove('bloqueado');
        resolver(texto);
      };
      $('#form-bloqueio').addEventListener('submit', async (e) => {
        e.preventDefault();
        if (botao.disabled) return;
        botao.disabled = true;
        msg.textContent = 'Abrindo…';
        try {
          const { texto, chave } = await S.cofre.abrir(pacote, campo.value);
          chaveCofre = chave;
          salCofre = pacote.sal;
          campo.value = '';
          liberar(texto);
        } catch (erro) {
          erros++;
          campo.value = '';
          if (erros >= 5) {
            let espera = 30;
            msg.textContent = `Senha incorreta. Aguarde ${espera} s para tentar de novo.`;
            const t = setInterval(() => {
              espera--;
              msg.textContent = `Senha incorreta. Aguarde ${espera} s para tentar de novo.`;
              if (espera <= 0) {
                clearInterval(t);
                botao.disabled = false;
                msg.textContent = 'Tente de novo.';
              }
            }, 1000);
            return;
          }
          msg.textContent = 'Senha incorreta.';
        }
        botao.disabled = false;
        campo.focus();
      });
      // Esqueci a senha: guarda os dados cifrados (se um dia lembrar) e começa de novo.
      let confirmar = false;
      $('#apagar-bloqueio').addEventListener('click', (e) => {
        if (!confirmar) {
          confirmar = true;
          e.target.textContent = 'Toque de novo para apagar e começar de novo';
          return;
        }
        guardarRecuperacao(bruto);
        try {
          localStorage.removeItem(CHAVE);
        } catch (erro) {
          /* ignora */
        }
        liberar(null);
      });
    });
  }

  // ------------------------------------------------------ cálculos derivados

  function calculoSuprimentos() {
    return S.suprimentos.calcularSuprimentos(estado.casa, { dias: estado.diasMeta, climaQuente: estado.climaQuente, dietas: estado.dietas, porteCaes: estado.porteCaes });
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
      if (g.dataset.grupo === grupo) {
        g.setAttribute('aria-current', 'true');
        g.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else g.removeAttribute('aria-current');
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
    dataValida,
    baixar,
    exportar,
    restaurar,
    substituirEstado,
    padrao,
    mesclar,
    senha,
    aguardarGravacao,
    CHAVE,
    get estado() {
      return estado;
    },
  };

  function montarApp() {
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
  if (avisosMigracao.length) {
    $('main').prepend(h('div', { class: 'aviso aviso-topo', role: 'status' }, `Seus dados foram atualizados para a versão nova do app. ${avisosMigracao.join(' ')}`));
  }
  atualizarTudo();
  mostrarSecao();
  window.addEventListener('hashchange', mostrarSecao);
  iniciarBloqueioAutomatico();
  }
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
    if (reduzir) document.documentElement.style.setProperty('--zoom-tela', String(window.innerWidth / LARGURA_COMPUTADOR));
    else document.documentElement.style.removeProperty('--zoom-tela');
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

  // Tamanho da letra: normal → grande → maior. Só neste aparelho.
  const CHAVE_LETRA = 'sobrevivencia-urbana:letra';
  const LETRAS = { '': { proximo: 'grande', rotulo: 'A+' }, grande: { proximo: 'maior', rotulo: 'A++' }, maior: { proximo: '', rotulo: 'A' } };
  let letra = '';
  try {
    letra = localStorage.getItem(CHAVE_LETRA) || '';
  } catch (e) {
    /* sem armazenamento: fica no padrão */
  }
  function aplicarLetra() {
    if (!LETRAS[letra]) letra = '';
    document.documentElement.classList.toggle('letra-grande', letra === 'grande');
    document.documentElement.classList.toggle('letra-maior', letra === 'maior');
    const botao = $('#botao-letra');
    botao.textContent = LETRAS[letra].rotulo;
    botao.setAttribute('aria-label', `Tamanho da letra: ${letra || 'normal'}. Tocar para mudar.`);
  }
  aplicarLetra();
  $('#botao-letra').addEventListener('click', () => {
    letra = LETRAS[letra].proximo;
    try {
      localStorage.setItem(CHAVE_LETRA, letra);
    } catch (e) {
      /* sem armazenamento: vale só nesta visita */
    }
    aplicarLetra();
  });

  // Instalar o app (Chrome/Android oferece; no iPhone, pelo menu Compartilhar).
  let pedidoInstalacao = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    pedidoInstalacao = e;
    $('#instalar-app').hidden = false;
  });
  $('#instalar-app').addEventListener('click', async () => {
    if (!pedidoInstalacao) return;
    pedidoInstalacao.prompt();
    const escolha = await pedidoInstalacao.userChoice;
    pedidoInstalacao = null;
    $('#instalar-app').hidden = true;
    if (escolha && escolha.outcome === 'accepted') $('#texto-instalar').textContent = 'App instalado: abra pela tela inicial.';
  });
  window.addEventListener('appinstalled', () => {
    $('#texto-instalar').textContent = 'App instalado: abra pela tela inicial.';
  });

  // O selo do topo leva ao resultado da triagem, mesmo se o endereço já for esse.
  $('#selo-nivel').addEventListener('click', (e) => {
    if (location.hash === '#situacao-resultado') {
      e.preventDefault();
      mostrarSecao();
    }
  });

  // Abre os dados: com senha, mostra a tela de bloqueio antes de montar o app.
  (async () => {
    const bruto = lerBruto();
    let obj = null;
    try {
      obj = bruto ? JSON.parse(bruto) : null;
    } catch (e) {
      obj = null;
    }
    if (obj && S.cofre.eCofre(obj)) {
      const texto = await pedirSenha(obj, bruto);
      estado = carregarTexto(texto, bruto);
    } else {
      estado = carregarTexto(bruto, bruto);
    }
    montarApp();
  })();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
