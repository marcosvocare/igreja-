/**
 * Aba Estoque e autonomia. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;
  // Utilitários do app, recebidos em montar().
  let h, $, trocar, fmt, novoId, inteiro, numeroPositivo, dataBR, salvar, atualizarTudo, necessidade, autonomia;

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
      A.estado.estoque.push({
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
      const item = A.estado.estoque.find((i) => i.id === botao.dataset.id);
      if (!item) return;
      if (botao.dataset.acao === 'mais') item.quantidade += 1;
      if (botao.dataset.acao === 'menos') item.quantidade = Math.max(0, item.quantidade - 1);
      if (botao.dataset.acao === 'remover') A.estado.estoque = A.estado.estoque.filter((i) => i !== item);
      salvar();
      atualizarTudo();
    });
  }

  function renderEstoque() {
    const nec = necessidade();
    const aut = autonomia();
    const meta = A.estado.diasMeta;

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
    if (!A.estado.estoque.length || !(nec.kcal > 0)) {
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
    const c = S.estoque.classificarValidade(A.estado.estoque, new Date(), 30);
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

  (S.extensoes = S.extensoes || []).push({
    nome: 'estoque',
    montar(api) {
      A = api;
      ({ h, $, trocar, fmt, novoId, inteiro, numeroPositivo, dataBR, salvar, atualizarTudo, necessidade, autonomia } = api);
      montarEstoque();
    },
    render() {
      renderEstoque();
    },
  });
})();
