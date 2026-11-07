/**
 * Aba Rádio: planejamento da rede Meshtastic da família (celular + rádio LoRa).
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const R = S.radio;
  const SVG_NS = 'http://www.w3.org/2000/svg';

  let A = null;

  function svg(tag, attrs, ...filhos) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
    for (const f of filhos.flat(Infinity)) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : String(f));
    return el;
  }

  function coordValida(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  function metros(m) {
    return m >= 995 ? `${A.fmt(m / 1000, 1)} km` : `${Math.round(m / 10) * 10} m`;
  }

  function nomeDe(id) {
    const n = A.estado.radio.nos.find((x) => x.id === id);
    return n ? n.nome : id;
  }

  // ------------------------------------------------------------------ estado

  function padrao() {
    return { radio: { nos: [], ambiente: 'urbano', canalFamilia: 'Familia', canalComunidade: 'Igreja', rascunho: '' } };
  }

  function mesclar(dados, r, u) {
    const d = dados.radio && typeof dados.radio === 'object' ? dados.radio : {};
    r.radio.ambiente = R.AMBIENTES[d.ambiente] ? d.ambiente : 'urbano';
    if (typeof d.canalFamilia === 'string') r.radio.canalFamilia = d.canalFamilia.slice(0, 20);
    if (typeof d.canalComunidade === 'string') r.radio.canalComunidade = d.canalComunidade.slice(0, 20);
    r.radio.rascunho = u.texto(d.rascunho, 400);
    r.radio.nos = u
      .lista(d.nos)
      .filter((n) => typeof n.nome === 'string' && n.nome.trim())
      .map((n) => {
        const ok = coordValida(n.lat, n.lon);
        return {
          id: u.texto(n.id, 40) || u.novoId(),
          nome: n.nome.slice(0, 36),
          instalacao: R.INSTALACOES[n.instalacao] ? n.instalacao : 'portatil',
          lat: ok ? n.lat : null,
          lon: ok ? n.lon : null,
        };
      });
  }

  // ------------------------------------------------------------------ montar

  function montar(api) {
    A = api;
    A.trocar(A.$('#radio-instalacao'), Object.entries(R.INSTALACOES).map(([v, i]) => A.h('option', { value: v }, i.rotulo)));
    A.trocar(A.$('#radio-ambiente'), Object.entries(R.AMBIENTES).map(([v, a]) => A.h('option', { value: v }, `${a.rotulo} (~${A.fmt(a.alcanceKm)} km entre portáteis)`)));
    A.trocar(A.$('#radio-guia'), R.GUIA.map((g) => A.h('li', null, g)));
    A.trocar(
      A.$('#radio-codigos'),
      R.CODIGOS.map((c) =>
        A.h('button', { type: 'button', class: 'codigo secundario', dataset: { codigo: c.codigo } }, A.h('strong', null, c.codigo), ` ${c.significado}`),
      ),
    );

    // A lista de pontos do Mapa pode ter mudado: atualiza ao abrir.
    A.$('#radio-copiar').addEventListener('focus', renderOrigens);
    A.$('#radio-copiar').addEventListener('change', (e) => {
      const [lat, lon] = e.target.value.split(',').map(Number);
      if (coordValida(lat, lon)) A.$('#radio-coord').value = `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      const opcao = e.target.selectedOptions[0];
      if (opcao && opcao.dataset.nome && !A.$('#radio-nome').value.trim()) A.$('#radio-nome').value = opcao.dataset.nome;
      e.target.value = '';
    });

    A.$('#form-radio').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#radio-nome').value.trim();
      if (!nome) return;
      const textoC = A.$('#radio-coord').value.trim();
      const c = S.mapa.lerCoordenadas(textoC);
      const msg = A.$('#msg-radio');
      if (textoC && !c) {
        msg.textContent = 'Coordenadas não reconhecidas. Exemplo: -23.5505, -46.6333';
        return;
      }
      A.estado.radio.nos.push({ id: A.novoId(), nome: nome.slice(0, 36), instalacao: A.$('#radio-instalacao').value, lat: c ? c.lat : null, lon: c ? c.lon : null });
      A.$('#radio-nome').value = '';
      A.$('#radio-coord').value = '';
      msg.textContent = c ? `${nome} entrou na rede.` : `${nome} entrou sem localização: informe as coordenadas para calcular o alcance.`;
      A.salvar();
      render();
    });

    A.$('#form-radio-config').addEventListener('input', (e) => {
      const r = A.estado.radio;
      if (e.target.id === 'radio-ambiente') r.ambiente = R.AMBIENTES[e.target.value] ? e.target.value : 'urbano';
      if (e.target.id === 'radio-canal') r.canalFamilia = e.target.value.slice(0, 20);
      if (e.target.id === 'radio-canal-igreja') r.canalComunidade = e.target.value.slice(0, 20);
      A.salvar();
      render();
    });

    // Lista: mudar instalação ou remover
    A.$('#radio-lista').addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-instalacao]');
      if (!sel) return;
      const n = A.estado.radio.nos.find((x) => x.id === sel.dataset.instalacao);
      if (!n) return;
      n.instalacao = sel.value;
      A.salvar();
      render();
    });
    A.$('#radio-lista').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remover-radio]');
      if (!b) return;
      A.estado.radio.nos = A.estado.radio.nos.filter((x) => x.id !== b.dataset.removerRadio);
      A.salvar();
      render();
    });

    // Sugestão de repetidor: adiciona com um toque
    A.$('#radio-cobertura').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-repetidor]');
      if (!b) return;
      const [lat, lon] = b.dataset.repetidor.split(',').map(Number);
      if (!coordValida(lat, lon)) return;
      const total = A.estado.radio.nos.filter((n) => n.nome.startsWith('Repetidor')).length;
      A.estado.radio.nos.push({ id: A.novoId(), nome: `Repetidor ${total + 1}`, instalacao: 'alto', lat, lon });
      A.salvar();
      render();
    });

    // Mensagens
    A.$('#radio-codigos').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-codigo]');
      if (!b) return;
      const c = R.CODIGOS.find((x) => x.codigo === b.dataset.codigo);
      A.$('#radio-msg').value = `${c.codigo} ${c.significado}`;
      A.estado.radio.rascunho = A.$('#radio-msg').value;
      A.salvar();
      renderMensagem();
    });
    A.$('#radio-msg').addEventListener('input', (e) => {
      A.estado.radio.rascunho = e.target.value.slice(0, 400);
      A.salvar();
      renderMensagem();
    });
    A.$('#radio-copiar-msg').addEventListener('click', () => {
      const botao = A.$('#radio-copiar-msg');
      const r = R.prepararMensagemLora(A.$('#radio-msg').value);
      const aviso = (t) => {
        botao.textContent = t;
        setTimeout(() => (botao.textContent = 'Copiar sem acentos'), 2500);
      };
      A.copiarTexto(r.texto, A.$('#radio-previa'), () => aviso('Copiada'), () => aviso('Texto selecionado: copie manualmente'));
    });

    recarregar();
  }

  function recarregar() {
    const r = A.estado.radio;
    A.$('#radio-ambiente').value = r.ambiente;
    A.$('#radio-canal').value = r.canalFamilia;
    A.$('#radio-canal-igreja').value = r.canalComunidade;
    A.$('#radio-msg').value = r.rascunho;
  }

  // ------------------------------------------------------------------ render

  function analise() {
    const r = A.estado.radio;
    return R.analisarMalha(r.nos, { ambiente: r.ambiente, limiteSaltos: 3 });
  }

  function renderOrigens() {
    const m = A.estado.mapa;
    const opcoes = [A.h('option', { value: '' }, '— escolher —')];
    if (m && coordValida(m.base.lat, m.base.lon)) {
      opcoes.push(A.h('option', { value: `${m.base.lat},${m.base.lon}`, dataset: { nome: m.base.nome } }, `Base: ${m.base.nome}`));
    }
    for (const p of (m && m.pontos) || []) {
      if (p.categoria !== 'perigo' && coordValida(p.lat, p.lon)) {
        opcoes.push(A.h('option', { value: `${p.lat},${p.lon}`, dataset: { nome: p.nome } }, p.nome));
      }
    }
    A.trocar(A.$('#radio-copiar'), opcoes);
    A.$('#radio-copiar').disabled = opcoes.length === 1;
  }

  function renderCobertura(an) {
    const destino = A.$('#radio-cobertura');
    const nos = A.estado.radio.nos;
    const comLocal = nos.filter((n) => coordValida(n.lat, n.lon));
    if (comLocal.length < 2) {
      A.trocar(
        destino,
        A.h('div', { class: 'cartao' }, A.h('h3', null, 'Cobertura'), A.h('p', { class: 'ajuda' }, 'Cadastre pelo menos dois rádios com localização. Comece pelo repetidor no ponto mais alto (a igreja, por exemplo) e pelas casas da família.')),
      );
      return;
    }
    // Contagem sem a própria base: quantos rádios alcançam a base.
    const total = comLocal.length - 1;
    const ok = an.conectados.length - 1;
    const cor = an.isolados.length ? 'vermelho' : an.alemDoLimite.length ? 'amarelo' : 'verde';
    const fracos = an.enlaces.filter((e) => e.fraco);

    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'painel-nivel', dataset: { cor } },
        A.h('div', { class: 'rotulo-nivel' }, `Cobertura a partir de ${nomeDe(an.base)}`),
        A.h('div', { class: 'postura' }, ok === total ? 'Todos alcançam a base' : `${ok} de ${total} alcançam a base`),
        A.h('p', null, `Configure o limite de saltos em ${an.limiteRecomendado} nos aparelhos.`),
        an.alemDoLimite.length
          ? A.h('p', null, `Precisam de mais de 3 saltos: ${an.alemDoLimite.map(nomeDe).join(', ')}. Com o limite em ${an.limiteRecomendado} eles são alcançados.`)
          : null,
        fracos.length ? A.h('p', null, `Enlaces no limite do alcance (teste no local): ${fracos.map((e) => `${nomeDe(e.a)}–${nomeDe(e.b)}`).join(', ')}.`) : null,
      ),
      an.sugestoes.map((s) =>
        A.h(
          'div',
          { class: 'cartao sugestao' },
          A.h('h3', null, `${s.grupo.map(nomeDe).join(', ')} fora da rede`),
          s.resolve
            ? [
                A.h('p', null, `Um repetidor no alto entre ${nomeDe(s.de)} e ${nomeDe(s.ate)} (a ~${metros(s.distancia / 2)} de cada) liga ${s.grupo.length > 1 ? 'esse grupo' : nomeDe(s.de)} à rede.`),
                A.h('p', { class: 'ajuda' }, `Ponto sugerido: ${s.meio.lat.toFixed(5)}, ${s.meio.lon.toFixed(5)}. Procure ali o lugar mais alto: telhado, laje alta, torre.`),
                A.h('button', { type: 'button', class: 'secundario', dataset: { repetidor: `${s.meio.lat},${s.meio.lon}` } }, 'Adicionar repetidor sugerido'),
              ]
            : A.h('p', null, `${nomeDe(s.de)} está a ${metros(s.distancia)} de ${nomeDe(s.ate)}: um repetidor no meio não basta. Procure um ponto bem alto (morro, prédio) ou use dois repetidores.`),
        ),
      ),
      an.semLocalizacao.length ? A.h('p', { class: 'ajuda' }, `Sem localização (fora da conta): ${an.semLocalizacao.map(nomeDe).join(', ')}.`) : null,
      A.h('div', { class: 'cartao' }, A.h('h3', null, 'Desenho da rede'), desenho(an), A.h('p', { class: 'ajuda' }, 'Norte para cima. Linha cheia: enlace estimado; tracejada: no limite do alcance.')),
    );
  }

  const ESTADO_NO = (an, id) => (an.isolados.includes(id) ? 'isolado' : an.alemDoLimite.includes(id) ? 'alem' : 'conectado');

  function formaNo(inst, x, y, classe) {
    if (inst === 'alto') return svg('polygon', { points: `${x},${y - 9} ${x + 8},${y + 6} ${x - 8},${y + 6}`, class: classe });
    if (inst === 'fixo') return svg('rect', { x: x - 6, y: y - 6, width: 12, height: 12, class: classe });
    return svg('circle', { cx: x, cy: y, r: 6, class: classe });
  }

  function desenho(an) {
    const nos = A.estado.radio.nos.filter((n) => coordValida(n.lat, n.lon));
    const base = nos.find((n) => n.id === an.base);
    const L = 340;
    const c = L / 2;
    const Rr = c - 28;
    const pos = nos.map((n) => ({ n, ...S.mapa.projetar(base, n) }));
    const sugeridos = an.sugestoes.filter((s) => s.resolve).map((s) => S.mapa.projetar(base, s.meio));
    const maior = Math.max(1, ...pos.map((p) => Math.hypot(p.x, p.y)), ...sugeridos.map((p) => Math.hypot(p.x, p.y)));
    const alcance = [250, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000].find((a) => a >= maior * 1.08) || Math.ceil(maior / 10000) * 10000;
    const esc = Rr / alcance;
    const xy = (p) => ({ x: c + p.x * esc, y: c - p.y * esc });
    const porId = new Map(pos.map((p) => [p.n.id, xy(p)]));

    const marcas = pos.map((p) => ({ ...xy(p), texto: p.n.nome.length > 14 ? `${p.n.nome.slice(0, 13)}…` : p.n.nome }));
    const caixasAneis = [0.5, 1].map((f) => [c + 2, c - Rr * f + 2, c + 6 + metros(alcance * f).length * 5.5, c - Rr * f + 15]);
    const caixasSugeridos = sugeridos.map((s) => {
      const q = xy(s);
      return [q.x - 8, q.y - 8, q.x + 8, q.y + 8];
    });
    const rot = S.rotulos.posicionarRotulos(marcas, { largura: L, altura: L, ocupadas: [...caixasAneis, ...caixasSugeridos] });

    return svg(
      'svg',
      { viewBox: `0 0 ${L} ${L}`, class: 'radar rede-radio', role: 'img', 'aria-label': `Rede com ${nos.length} rádios; ${an.conectados.length} conectados` },
      [0.5, 1].map((f) => [
        svg('circle', { cx: c, cy: c, r: Rr * f, class: 'anel' }),
        svg('text', { x: c + 4, y: c - Rr * f + 12, class: 'rotulo-anel' }, metros(alcance * f)),
      ]),
      svg('text', { x: c, y: 14, 'text-anchor': 'middle', class: 'norte' }, 'N'),
      an.enlaces.map((e) => {
        const a = porId.get(e.a);
        const b = porId.get(e.b);
        return svg('line', { x1: a.x, y1: a.y, x2: b.x, y2: b.y, class: e.fraco ? 'enlace fraco' : 'enlace' });
      }),
      sugeridos.map((s) => {
        const q = xy(s);
        return svg('polygon', { points: `${q.x},${q.y - 8} ${q.x + 8},${q.y} ${q.x},${q.y + 8} ${q.x - 8},${q.y}`, class: 'sugerido' }, svg('title', null, 'Repetidor sugerido'));
      }),
      pos.map((p, i) => {
        const q = xy(p);
        const st = ESTADO_NO(an, p.n.id);
        return svg(
          'g',
          { class: `no-radio ${st}${p.n.id === an.base ? ' base-radio' : ''}` },
          svg('title', null, `${p.n.nome} — ${R.INSTALACOES[p.n.instalacao].rotulo}`),
          formaNo(p.n.instalacao, q.x, q.y, 'forma-no'),
          svg('text', { x: rot[i].tx, y: rot[i].ty, 'text-anchor': rot[i].ancora, class: 'rotulo-ponto' }, marcas[i].texto),
        );
      }),
    );
  }

  function renderLista(an) {
    const nos = A.estado.radio.nos;
    if (!nos.length) {
      A.trocar(A.$('#radio-lista'));
      return;
    }
    const situacao = (n) => {
      if (an.semLocalizacao.includes(n.id)) return A.h('span', { class: 'estado sem' }, 'Sem localização');
      if (n.id === an.base) return A.h('span', { class: 'estado ok' }, 'Base');
      if (an.isolados.includes(n.id)) return A.h('span', { class: 'estado vencido' }, 'Isolado');
      const s = an.saltos[n.id];
      return A.h('span', { class: `estado ${an.alemDoLimite.includes(n.id) ? 'vencendo' : 'ok'}` }, `${s} salto${s > 1 ? 's' : ''}`);
    };
    A.trocar(
      A.$('#radio-lista'),
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Rádio'), A.h('th', null, 'Instalação'), A.h('th', null, 'Até a base'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            nos.map((n) =>
              A.h(
                'tr',
                null,
                A.h('td', null, n.nome),
                A.h(
                  'td',
                  null,
                  A.h(
                    'select',
                    { class: 'select-mini', dataset: { instalacao: n.id }, 'aria-label': `Instalação de ${n.nome}` },
                    Object.entries(R.INSTALACOES).map(([v, i]) => A.h('option', { value: v, selected: v === n.instalacao }, i.rotulo.split(' (')[0])),
                  ),
                ),
                A.h('td', null, situacao(n)),
                A.h('td', null, A.h('button', { type: 'button', class: 'mini secundario', dataset: { removerRadio: n.id }, 'aria-label': `Remover ${n.nome}` }, '✕')),
              ),
            ),
          ),
        ),
      ),
    );
  }

  function renderPlano(an) {
    const r = A.estado.radio;
    const destino = A.$('#radio-plano');
    const plano = R.planoRede(r.nos, { canalFamilia: r.canalFamilia, canalComunidade: r.canalComunidade.trim() || null, analise: an });
    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'cartao' },
        A.h('h3', null, 'Plano dos aparelhos'),
        plano.aparelhos.length
          ? A.h(
              'div',
              { class: 'tabela-rolagem' },
              A.h(
                'table',
                null,
                A.h('thead', null, A.h('tr', null, A.h('th', null, 'Nome longo'), A.h('th', null, 'Nome curto'), A.h('th', null, 'Papel'))),
                A.h('tbody', null, plano.aparelhos.map((x) => A.h('tr', null, A.h('td', null, x.nomeLongo), A.h('td', null, A.h('code', null, x.nomeCurto)), A.h('td', null, A.h('code', null, x.papel))))),
              ),
            )
          : A.h('p', { class: 'ajuda' }, 'Os nomes e papéis aparecem quando houver rádios cadastrados.'),
        A.h('p', null, 'Limite de saltos: ', A.h('strong', null, String(plano.limiteSaltos))),
        A.h('h3', null, 'Canais'),
        A.h(
          'ol',
          { class: 'canais', start: 0 },
          plano.canais.map((c) => A.h('li', null, A.h('strong', null, c.nome), A.h('br'), c.uso, A.h('br'), A.h('small', { class: 'ajuda' }, `Chave: ${c.chave}`))),
        ),
        A.h('p', { class: 'ajuda' }, `Horários de contato (aba Comunicação): ${A.estado.horarios}. Nesses horários, cada um manda o código 1 no canal da família.`),
      ),
    );
  }

  function renderMensagem() {
    const r = R.prepararMensagemLora(A.$('#radio-msg').value);
    A.trocar(
      A.$('#radio-previa'),
      r.texto || '—',
      A.h('br'),
      A.h('small', { class: r.cabe ? 'ajuda' : 'aviso-linha' }, r.cabe ? `${r.bytes}/${r.limite} bytes · cabe em uma mensagem` : `${r.bytes}/${r.limite} bytes · encurte ${r.excesso} bytes`),
    );
  }

  function render() {
    const an = analise();
    renderOrigens();
    renderCobertura(an);
    renderLista(an);
    renderPlano(an);
    renderMensagem();
  }

  function navegar(secao) {
    if (secao === 'radio') render(); // o Mapa e os horários podem ter mudado
    return false;
  }

  (S.extensoes = S.extensoes || []).push({ padrao, mesclar, montar, render, recarregar, navegar });
})();
