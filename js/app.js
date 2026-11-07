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
    };
    for (const ext of EXTENSOES) Object.assign(base, ext.padrao());
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
    for (const ext of EXTENSOES) ext.mesclar(dados, r, { texto, lista, inteiro, numeroPositivo, novoId });
    return r;
  }

  function carregar() {
    try {
      const bruto = localStorage.getItem(CHAVE);
      return bruto ? mesclar(JSON.parse(bruto)) : padrao();
    } catch (e) {
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
    for (const a of document.querySelectorAll('.abas a')) {
      if (a.getAttribute('href') === `#${atual}`) {
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
            h('input', { type: 'checkbox', name: 'sinal', value: s.id, checked: estado.sinais.includes(s.id) }),
            h('span', null, s.texto),
          ),
        ),
      ),
    );
    trocar($('#lista-sinais'), grupos);

    $('#lista-sinais').addEventListener('change', () => {
      estado.sinais = Array.from(document.querySelectorAll('input[name="sinal"]:checked')).map((i) => i.value);
      salvar();
      renderSituacao();
    });
    $('#ctx-rota').checked = estado.rotaSegura;
    $('#ctx-rota').addEventListener('change', (e) => {
      estado.rotaSegura = e.target.checked;
      salvar();
      renderSituacao();
    });
    $('#ctx-energia').addEventListener('change', (e) => {
      estado.extras.dependenteEnergia = e.target.checked;
      salvar();
      atualizarTudo();
    });
    $('#limpar-sinais').addEventListener('click', () => {
      estado.sinais = [];
      for (const i of document.querySelectorAll('input[name="sinal"]')) i.checked = false;
      salvar();
      renderSituacao();
    });
  }

  function renderSituacao() {
    $('#ctx-energia').checked = estado.extras.dependenteEnergia;
    let diasAutonomia = null;
    const temEstoque = estado.estoque.length > 0;
    const aut = autonomia();
    if (temEstoque && aut.diasAutonomia !== null) {
      diasAutonomia = aut.diasAutonomia;
      $('#ctx-autonomia').textContent = `Autonomia do estoque: ${fmt(diasAutonomia)} dia(s), limitada pela ${aut.gargalo === 'agua' ? 'água' : 'comida'}.`;
    } else {
      $('#ctx-autonomia').textContent = 'Cadastre o estoque para que a autonomia da casa entre na decisão.';
    }

    const r = S.situacao.avaliarSituacao(estado.sinais, {
      diasAutonomia,
      dependenteEnergia: estado.extras.dependenteEnergia,
      rotaSegura: estado.rotaSegura,
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
          ? h('div', { class: 'ligar' }, r.acionar.map((c) => h('a', { class: 'botao', href: `tel:${c.numero}` }, `Ligar ${c.numero} · ${c.nome}`)))
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
                ? [h('h4', null, 'Acionar'), h('p', null, c.acionar.map((a, i) => [i ? ' · ' : '', /^\d+$/.test(a) ? h('a', { href: `tel:${a}` }, a) : a]))]
                : null,
            ),
          ),
        ),
      ),
    );
  }

  // ------------------------------------------------------------- suprimentos

  function montarCasa() {
    const campos = Object.entries({ ...S.suprimentos.PERFIS, ...S.suprimentos.PETS }).map(([chave, def]) =>
      h('label', null, def.rotulo, h('input', { type: 'number', name: chave, min: 0, max: 50, step: 1, value: estado.casa[chave], inputmode: 'numeric' })),
    );
    trocar($('#campos-casa'), campos);

    const form = $('#form-casa');
    for (const k of Object.keys(estado.extras)) form.elements[k].checked = estado.extras[k];
    form.elements.diasMeta.value = String(estado.diasMeta);
    form.elements.climaQuente.checked = estado.climaQuente;

    form.addEventListener('input', (e) => {
      const alvo = e.target;
      if (alvo.name in estado.casa) {
        estado.casa[alvo.name] = inteiro(alvo.value === '' ? 0 : alvo.value, 0, 50, estado.casa[alvo.name]);
      } else if (alvo.name in estado.extras) {
        estado.extras[alvo.name] = alvo.checked;
      } else if (alvo.name === 'diasMeta') {
        estado.diasMeta = inteiro(alvo.value, 1, 30, 7);
      } else if (alvo.name === 'climaQuente') {
        estado.climaQuente = alvo.checked;
      }
      salvar();
      atualizarTudo();
    });
  }

  function renderSuprimentos() {
    const destino = $('#resultado-suprimentos');
    const r = calculoSuprimentos();
    if (r.pessoas === 0) {
      trocar(destino, h('p', { class: 'cartao' }, 'Informe ao menos uma pessoa para calcular os suprimentos.'));
      return;
    }
    const linhaAgua = (rotulo, valor) => h('tr', null, h('td', null, rotulo), h('td', { class: 'num' }, `${fmt(valor)} L`));
    trocar(
      destino,
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, `Para ${r.pessoas} pessoa(s) por ${r.dias} dias`),
        h(
          'div',
          { class: 'metricas' },
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, `${fmt(r.agua.total, 0)} L`), h('small', null, `de água · ≈ ${r.agua.garrafoes20L} garrafões de 20 L`)),
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(r.kcalTotal, 0)), h('small', null, 'kcal no total')),
        ),
        h(
          'table',
          null,
          h('tbody', null, [
            linhaAgua('Beber', r.agua.beber),
            linhaAgua('Higiene mínima', r.agua.higiene),
            linhaAgua('Cozinhar os alimentos da lista', r.agua.preparo),
            r.agua.pets ? linhaAgua('Animais', r.agua.pets) : null,
            h('tr', null, h('th', null, 'Total'), h('th', { class: 'num' }, `${fmt(r.agua.total)} L`)),
          ]),
        ),
      ),
      r.diasComidaPronta < Math.min(3, r.dias)
        ? h('p', { class: 'aviso' }, `A comida que dispensa fogão cobre só ~${fmt(r.diasComidaPronta)} dia(s). Reforce enlatados, biscoitos e castanhas para pelo menos 3 dias sem gás.`)
        : null,
      h(
        'div',
        { class: 'cartao' },
        h('h3', null, 'Lista de alimentos sugerida'),
        h(
          'div',
          { class: 'tabela-rolagem' },
          h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num' }, 'Quantidade'), h('th', null, 'Sem fogão?'))),
            h('tbody', null, r.alimentos.map((a) => h('tr', null, h('td', null, a.item), h('td', { class: 'num' }, `${fmt(a.kg)} kg`), h('td', null, a.pronto ? 'Sim' : '—')))),
          ),
        ),
        r.especiais.length
          ? [h('h3', null, 'Outros itens'), h('ul', null, r.especiais.map((e) => h('li', null, `${e.item}: ${fmt(e.quantidade)} ${e.unidade}`)))]
          : null,
        h('p', { class: 'ajuda' }, 'Estimativa de planejamento. Ajuste ao que a família costuma comer e a restrições de saúde.'),
      ),
    );
  }

  // ----------------------------------------------------------------- estoque

  const PRESETS = [
    { nome: 'Galão de água 20 L', categoria: 'agua', litros: 20 },
    { nome: 'Garrafa de água 5 L', categoria: 'agua', litros: 5 },
    { nome: 'Garrafa de água 1,5 L', categoria: 'agua', litros: 1.5 },
    { nome: 'Arroz 5 kg', categoria: 'alimento', kcal: 18000 },
    { nome: 'Feijão 1 kg', categoria: 'alimento', kcal: 3300 },
    { nome: 'Macarrão 500 g', categoria: 'alimento', kcal: 1850 },
    { nome: 'Sardinha em lata 125 g', categoria: 'alimento', kcal: 250 },
    { nome: 'Atum em lata 170 g', categoria: 'alimento', kcal: 250 },
    { nome: 'Leite em pó 400 g', categoria: 'alimento', kcal: 1980 },
    { nome: 'Aveia 500 g', categoria: 'alimento', kcal: 1950 },
    { nome: 'Óleo de soja 900 ml', categoria: 'alimento', kcal: 7300 },
    { nome: 'Biscoito 400 g', categoria: 'alimento', kcal: 1800 },
    { nome: 'Barra de cereal 25 g', categoria: 'alimento', kcal: 90 },
    { nome: 'Pilhas AA (pacote)', categoria: 'energia' },
    { nome: 'Água sanitária 1 L', categoria: 'higiene' },
    { nome: 'Papel higiênico (pacote)', categoria: 'higiene' },
  ];

  function montarEstoque() {
    const form = $('#form-estoque');
    trocar(
      form.elements.categoria,
      Object.entries(S.estoque.CATEGORIAS).map(([v, t]) => h('option', { value: v, selected: v === 'alimento' }, t)),
    );
    const preset = $('#preset-estoque');
    preset.append(...PRESETS.map((p, i) => h('option', { value: i }, p.nome)));
    preset.addEventListener('change', () => {
      const p = PRESETS[preset.value];
      if (!p) return;
      form.elements.nome.value = p.nome;
      form.elements.categoria.value = p.categoria;
      form.elements.litros.value = p.litros || '';
      form.elements.kcal.value = p.kcal || '';
      form.elements.quantidade.focus();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const f = form.elements;
      const nome = f.nome.value.trim();
      if (!nome) return;
      estado.estoque.push({
        id: novoId(),
        nome: nome.slice(0, 80),
        categoria: f.categoria.value,
        quantidade: inteiro(f.quantidade.value, 1, 100000, 1),
        litros: numeroPositivo(f.litros.value),
        kcal: numeroPositivo(f.kcal.value),
        validade: S.estoque.diaUTC(f.validade.value) !== null ? f.validade.value : '',
      });
      salvar();
      form.reset();
      preset.value = '';
      f.nome.focus();
      atualizarTudo();
    });

    $('#dias-racionar').addEventListener('input', renderEstoque);

    $('#lista-estoque').addEventListener('click', (e) => {
      const botao = e.target.closest('button[data-acao]');
      if (!botao) return;
      const item = estado.estoque.find((i) => i.id === botao.dataset.id);
      if (!item) return;
      if (botao.dataset.acao === 'mais') item.quantidade += 1;
      if (botao.dataset.acao === 'menos') item.quantidade = Math.max(0, item.quantidade - 1);
      if (botao.dataset.acao === 'remover') estado.estoque = estado.estoque.filter((i) => i !== item);
      salvar();
      atualizarTudo();
    });
  }

  function renderEstoque() {
    const nec = necessidade();
    const aut = autonomia();
    const meta = estado.diasMeta;

    if (nec.kcal === 0 && nec.aguaLitros === 0) {
      trocar($('#autonomia'), h('p', { class: 'cartao' }, 'Informe quem mora na casa em “Casa e suprimentos” para calcular a autonomia.'));
    } else {
      const faltaAgua = Math.max(0, nec.aguaLitros * meta - aut.litros);
      const faltaKcal = Math.max(0, nec.kcal * meta - aut.kcal);
      trocar(
        $('#autonomia'),
        h(
          'div',
          { class: 'cartao' },
          h('h3', null, 'Autonomia da casa'),
          h(
            'div',
            { class: 'metricas' },
            h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(aut.diasAutonomia || 0)), h('small', null, 'dias de autonomia')),
            h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(aut.diasAgua || 0)), h('small', null, `dias de água (${fmt(aut.litros)} L)`)),
            h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(aut.diasComida || 0)), h('small', null, `dias de comida (${fmt(aut.kcal, 0)} kcal)`)),
          ),
          faltaAgua || faltaKcal
            ? h(
                'p',
                { class: 'aviso' },
                `Para a meta de ${meta} dias faltam `,
                [faltaAgua ? `${fmt(Math.ceil(faltaAgua), 0)} L de água` : null, faltaKcal ? `${fmt(Math.ceil(faltaKcal), 0)} kcal de comida` : null]
                  .filter(Boolean)
                  .join(' e '),
                '.',
              )
            : h('p', null, `Meta de ${meta} dias atingida.`),
        ),
      );
    }

    // Racionamento
    const dias = Number($('#dias-racionar').value);
    const destinoPlano = $('#plano-racionamento');
    if (!estado.estoque.length || !(nec.kcal > 0)) {
      trocar(destinoPlano, h('p', { class: 'ajuda' }, 'Cadastre o estoque e a composição da casa para ver o plano.'));
    } else if (!(dias > 0)) {
      trocar(destinoPlano, h('p', { class: 'ajuda' }, 'Informe um número de dias maior que zero.'));
    } else {
      const p = S.estoque.planoRacionamento(aut, nec, dias);
      trocar(
        destinoPlano,
        h(
          'ul',
          null,
          h('li', null, `Água: ${fmt(p.aguaLitrosPorDia)} L por dia (${p.percentualAgua}% do ideal)`),
          h('li', null, `Comida: ${fmt(p.kcalPorDia, 0)} kcal por dia (${p.percentualComida}% do ideal)`),
        ),
        p.avisos.map((a) => h('p', { class: 'aviso' }, a)),
      );
    }

    // Lista em ordem "o primeiro que vence é o primeiro que sai"
    const c = S.estoque.classificarValidade(estado.estoque, new Date(), 30);
    const linhas = [
      ...c.vencidos.map((i) => [i, h('span', { class: 'estado vencido' }, `Vencido há ${-i.diasRestantes} d`)]),
      ...c.vencendo.map((i) => [i, h('span', { class: 'estado vencendo' }, i.diasRestantes === 0 ? 'Vence hoje' : `Vence em ${i.diasRestantes} d`)]),
      ...c.ok.map((i) => [i, h('span', { class: 'estado ok' }, dataBR(i.validade))]),
      ...c.semValidade.map((i) => [i, h('span', { class: 'estado sem' }, 'Sem validade')]),
    ];
    if (!linhas.length) {
      trocar($('#lista-estoque'), h('p', { class: 'ajuda' }, 'Nenhum item cadastrado ainda.'));
      return;
    }
    const botao = (acao, id, texto, rotulo) => h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo }, texto);
    trocar(
      $('#lista-estoque'),
      h(
        'div',
        { class: 'cartao tabela-rolagem' },
        h(
          'table',
          null,
          h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', null, 'Validade'), h('th', { class: 'num' }, 'Qtd'), h('th', null, ''))),
          h(
            'tbody',
            null,
            linhas.map(([i, selo]) =>
              h(
                'tr',
                null,
                h('td', null, i.nome, h('br'), h('small', { class: 'ajuda' }, S.estoque.CATEGORIAS[i.categoria] || 'Outro')),
                h('td', null, selo),
                h('td', { class: 'num' }, botao('menos', i.id, '−', `Diminuir ${i.nome}`), ` ${i.quantidade} `, botao('mais', i.id, '+', `Aumentar ${i.nome}`)),
                h('td', null, botao('remover', i.id, '✕', `Remover ${i.nome}`)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------- água

  function montarAgua() {
    const form = $('#form-agua');
    form.addEventListener('input', renderAgua);
    trocar(
      $('#metodos-agua'),
      S.agua.METODOS.map((m) =>
        h('div', { class: 'cartao' }, h('h3', null, m.titulo), h('ol', null, m.passos.map((p) => h('li', null, p))), h('p', { class: 'ajuda' }, m.limites)),
      ),
    );
    trocar($('#fontes-agua'), S.agua.FONTES_EMERGENCIA.map((f) => h('li', null, f)));
  }

  function renderAgua() {
    const f = $('#form-agua').elements;
    try {
      const r = S.agua.dosagemHipoclorito(f.litros.value, f.concentracao.value, { turva: f.turva.checked });
      const medida = [`≈ ${fmt(r.ml)} ml`, r.colheresDeCha ? `≈ ${fmt(r.colheresDeCha)} colher(es) de chá` : null].filter(Boolean).join(' · ');
      trocar(
        $('#resultado-agua'),
        h(
          'div',
          { class: 'metricas' },
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, fmt(r.gotas, 0)), h('small', null, `gotas (${medida})`)),
          h('div', { class: 'metrica' }, h('span', { class: 'grande' }, `${r.minutosEspera} min`), h('small', null, 'de espera antes de beber')),
        ),
        h('ul', { class: 'ajuda' }, r.avisos.map((a) => h('li', null, a))),
      );
    } catch (erro) {
      trocar($('#resultado-agua'), h('p', { class: 'aviso' }, erro.message));
    }
    try {
      const min = S.agua.tempoFervura(f.altitude.value || 0);
      $('#resultado-fervura').textContent = `Ferva por ${min} minuto(s) depois que começar a borbulhar forte.`;
    } catch (erro) {
      $('#resultado-fervura').textContent = erro.message;
    }
  }

  // --------------------------------------------------------------------- kit

  function montarKit() {
    $('#lista-kit').addEventListener('change', (e) => {
      const id = e.target.dataset.item;
      if (!id) return;
      if (e.target.checked) estado.kitMarcados[id] = true;
      else delete estado.kitMarcados[id];
      e.target.closest('label').classList.toggle('feito', e.target.checked);
      salvar();
      progressoKit();
    });
  }

  let secoesKit = [];

  function renderKit() {
    secoesKit = S.kit.gerarKit(estado.casa, estado.extras);
    trocar(
      $('#lista-kit'),
      secoesKit.map((s) =>
        h(
          'div',
          { class: 'cartao' },
          h('h3', null, s.titulo),
          s.itens.map((i) => {
            const marcado = Boolean(estado.kitMarcados[i.id]);
            return h(
              'label',
              { class: marcado ? 'linha feito' : 'linha' },
              h('input', { type: 'checkbox', checked: marcado, dataset: { item: i.id } }),
              h('span', null, i.texto),
            );
          }),
        ),
      ),
    );
    progressoKit();
  }

  function progressoKit() {
    const p = S.kit.progresso(secoesKit, estado.kitMarcados);
    $('#barra-kit').setAttribute('aria-valuenow', p.percentual);
    $('#barra-kit span').style.width = `${p.percentual}%`;
    $('#texto-progresso-kit').textContent = `${p.feitos} de ${p.total} itens separados (${p.percentual}%).`;
  }

  // ------------------------------------------------------------- comunicação

  function montarComunicacao() {
    const pontos = $('#form-pontos');
    for (const k of Object.keys(estado.pontos)) pontos.elements[k].value = estado.pontos[k];
    pontos.addEventListener('input', (e) => {
      if (e.target.name in estado.pontos) {
        estado.pontos[e.target.name] = e.target.value.slice(0, 120);
        salvar();
        renderPreviaCartao();
      }
    });

    const formContato = $('#form-contato');
    formContato.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = formContato.elements.nome.value.trim();
      if (!nome) return;
      estado.contatos.push({ id: novoId(), nome: nome.slice(0, 60), telefone: formContato.elements.telefone.value.trim().slice(0, 20) });
      formContato.elements.nome.value = '';
      formContato.elements.telefone.value = '';
      formContato.elements.nome.focus();
      salvar();
      renderContatos();
    });
    $('#lista-contatos').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const i = estado.contatos.findIndex((c) => c.id === b.dataset.id);
      if (i < 0) return;
      if (b.dataset.acao === 'subir' && i > 0) {
        [estado.contatos[i - 1], estado.contatos[i]] = [estado.contatos[i], estado.contatos[i - 1]];
      } else if (b.dataset.acao === 'remover') {
        estado.contatos.splice(i, 1);
      }
      salvar();
      renderContatos();
    });
    $('#por-pessoa').value = String(estado.porPessoa);
    $('#por-pessoa').addEventListener('change', (e) => {
      estado.porPessoa = inteiro(e.target.value, 2, 5, 3);
      salvar();
      renderContatos();
    });

    const sms = $('#form-sms');
    sms.elements.nome.value = estado.nomeSms;
    sms.addEventListener('input', (e) => {
      if (e.target.name === 'nome') {
        estado.nomeSms = e.target.value.slice(0, 30);
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
    janelas.elements.horarios.value = estado.horarios;
    janelas.addEventListener('input', (e) => {
      if (e.target.name === 'horarios') {
        estado.horarios = e.target.value.slice(0, 200);
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
      estado.contatos.map((c, i) =>
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
    if (estado.contatos.length < 2) {
      trocar(destino, h('p', { class: 'ajuda' }, 'Adicione ao menos 2 contatos para montar a árvore de chamadas.'));
      return;
    }
    const k = estado.porPessoa;
    const { rodadas } = S.comunicacao.gerarArvore(estado.contatos, { porPessoa: k });
    const lista = estado.contatos;
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
    const pessoas = S.suprimentos.totalPessoas(estado.casa);
    const copias = Math.min(Math.max(pessoas, 1), 8);
    trocar($('#cartao-bolso'), Array.from({ length: copias }, unidadeCartao));
  }

  function unidadeCartao() {
    const p = estado.pontos;
    const linha = (rotulo, valor) => h('p', null, h('strong', null, `${rotulo}: `), valor || '________________________');
    return h(
        'div',
        { class: 'unidade' },
        h('h4', null, 'PLANO DE EMERGÊNCIA'),
        linha('1. Encontro perto de casa', p.casa),
        linha('2. Encontro no bairro', p.bairro),
        linha('3. Encontro fora do bairro', p.fora),
        linha('Contato fora da cidade', p.contatoFora),
        estado.contatos.slice(0, 5).map((c) => h('p', null, `${c.nome}: ${c.telefone || '—'}`)),
        linha('Horários de contato', estado.horarios),
        h('p', null, h('strong', null, '190'), ' Polícia · ', h('strong', null, '192'), ' SAMU · ', h('strong', null, '193'), ' Bombeiros · ', h('strong', null, '199'), ' Defesa Civil'),
      );
  }

  function renderPreviaCartao() {
    trocar($('#previa-cartao'), unidadeCartao());
  }

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
      estado.rede.push({
        id: novoId(),
        nome: nome.slice(0, 60),
        bairro: f.bairro.value.trim().slice(0, 60),
        telefone: f.telefone.value.trim().slice(0, 20),
        habilidades: marcados('habilidades'),
        necessidades: marcados('necessidades'),
      });
      form.reset();
      f.nome.focus();
      salvar();
      renderRede();
    });
    $('#lista-rede').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao="remover"]');
      if (!b) return;
      estado.rede = estado.rede.filter((m) => m.id !== b.dataset.id);
      salvar();
      renderRede();
    });
  }

  function renderRede() {
    const H = S.rede.HABILIDADES;
    const N = S.rede.NECESSIDADES;
    const bairros = [...new Set(estado.rede.map((m) => m.bairro).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
    trocar($('#bairros'), bairros.map((b) => h('option', { value: b })));

    if (!estado.rede.length) {
      trocar($('#pareamento'), h('p', { class: 'cartao ajuda' }, 'Cadastre as pessoas da comunidade para ver quem apoia quem.'));
      trocar($('#lacunas'));
      trocar($('#lista-rede'));
      return;
    }

    const { pares, semCobertura } = S.rede.parearApoio(estado.rede);
    const telDe = (nome) => (estado.rede.find((m) => m.nome === nome) || {}).telefone;
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

    const { porBairro, lacunas } = S.rede.resumoRecursos(estado.rede);
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
            estado.rede.map((m) =>
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
    for (const i of document.querySelectorAll('input[name="sinal"]')) i.checked = estado.sinais.includes(i.value);
    $('#ctx-rota').checked = estado.rotaSegura;
    const casa = $('#form-casa');
    for (const k of Object.keys(estado.casa)) casa.elements[k].value = estado.casa[k];
    for (const k of Object.keys(estado.extras)) casa.elements[k].checked = estado.extras[k];
    casa.elements.diasMeta.value = String(estado.diasMeta);
    casa.elements.climaQuente.checked = estado.climaQuente;
    const pontos = $('#form-pontos');
    for (const k of Object.keys(estado.pontos)) pontos.elements[k].value = estado.pontos[k];
    $('#por-pessoa').value = String(estado.porPessoa);
    $('#form-sms').elements.nome.value = estado.nomeSms;
    $('#form-janelas').elements.horarios.value = estado.horarios;
    for (const ext of EXTENSOES) if (ext.recarregar) ext.recarregar();
    atualizarTudo();
  }

  // ------------------------------------------------------------------- geral

  function atualizarTudo() {
    renderSituacao();
    renderSuprimentos();
    renderEstoque();
    renderKit();
    renderContatos();
    renderSms();
    renderJanelas();
    renderRede();
    for (const ext of EXTENSOES) ext.render();
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
    get estado() {
      return estado;
    },
  };

  montarSinais();
  montarCenarios();
  montarCasa();
  montarEstoque();
  montarAgua();
  montarKit();
  montarComunicacao();
  montarRede();
  montarDados();
  for (const ext of EXTENSOES) ext.montar(api);
  renderAgua();
  atualizarTudo();
  mostrarSecao();
  window.addEventListener('hashchange', mostrarSecao);
  // O selo do topo leva ao resultado da triagem, mesmo se o endereço já for esse.
  $('#selo-nivel').addEventListener('click', (e) => {
    if (location.hash === '#situacao-resultado') {
      e.preventDefault();
      mostrarSecao();
    }
  });
  window.addEventListener('beforeprint', renderCartaoBolso);

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
