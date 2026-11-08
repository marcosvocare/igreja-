/**
 * Aba Mapa de recursos. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const M = S.mapa;
  const CATEGORIAS_BUSCA = ['agua', 'remedio', 'alimento', 'abrigo'];

  let A = null; // API do app, recebida em montar()
  // Local (não via A): também é usada na validação dos dados, antes de montar().
  function coordValida(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }
  const haQuanto = (...x) => A.haQuanto(...x);
  const metros = (...x) => A.metros(...x);
  const svg = (...x) => A.svg(...x);

  function textoCoord(p) {
    return p && coordValida(p.lat, p.lon) ? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` : '';
  }

  /** "ao norte", "ao sul", "a leste", "a nordeste"… */
  function rumoTexto(direcao) {
    return `${direcao === 'norte' || direcao === 'sul' ? 'ao' : 'a'} ${direcao}`;
  }

  function rotuloStatus(status) {
    if (status === 'resolvido') return 'Resolvido';
    return (M.STATUS[status] || M.STATUS.desconhecido).rotulo;
  }

  function classeStatus(status) {
    return { disponivel: 'ok', escasso: 'vencendo', desconhecido: 'sem', esgotado: 'vencido', inseguro: 'vencido', resolvido: 'sem' }[status] || 'sem';
  }

  /** Preenche um campo com a localização do aparelho, se o navegador permitir. */
  function localizar(campo, mensagem) {
    if (!navigator.geolocation) {
      mensagem.textContent = 'Este navegador não informa a localização. Cole as coordenadas do Google Maps.';
      return;
    }
    mensagem.textContent = 'Buscando a localização…';
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        campo.value = textoCoord({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        campo.dispatchEvent(new Event('input', { bubbles: true }));
        mensagem.textContent = `Localização obtida (precisão de ~${Math.round(pos.coords.accuracy)} m).`;
      },
      () => {
        mensagem.textContent = 'Não foi possível obter a localização. No Google Maps, toque e segure no local e copie as coordenadas.';
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  // ------------------------------------------------------------------ estado

  function padrao() {
    return { mapa: { base: { nome: 'Casa', lat: null, lon: null }, pontos: [], busca: 'agua' } };
  }

  function mesclar(dados, r, u) {
    const num = (v, min, max, pad) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : pad;
    };
    const objeto = (v) => (v && typeof v === 'object' ? v : {});
    const mapa = objeto(dados.mapa);
    const base = objeto(mapa.base);
    r.mapa.base = {
      nome: u.texto(base.nome, 40) || 'Casa',
      lat: coordValida(base.lat, base.lon) ? base.lat : null,
      lon: coordValida(base.lat, base.lon) ? base.lon : null,
    };
    if (CATEGORIAS_BUSCA.includes(mapa.busca)) r.mapa.busca = mapa.busca;
    r.mapa.pontos = u
      .lista(mapa.pontos)
      .filter((p) => typeof p.nome === 'string' && p.nome.trim() && M.CATEGORIAS[p.categoria])
      .map((p) => {
        const tipos = Object.keys(M.CATEGORIAS[p.categoria].tipos);
        const statusValidos = p.categoria === 'perigo' ? ['inseguro', 'resolvido'] : Object.keys(M.STATUS);
        const ok = coordValida(p.lat, p.lon);
        const verificado = typeof p.verificadoEm === 'string' && Number.isFinite(new Date(p.verificadoEm).getTime()) ? p.verificadoEm : null;
        return {
          id: u.texto(p.id, 40) || u.novoId(),
          nome: p.nome.slice(0, 60),
          categoria: p.categoria,
          tipo: tipos.includes(p.tipo) ? p.tipo : tipos[0],
          status: statusValidos.includes(p.status) ? p.status : statusValidos[0],
          lat: ok ? p.lat : null,
          lon: ok ? p.lon : null,
          referencia: u.texto(p.referencia, 100),
          obs: u.texto(p.obs, 120),
          raio: u.inteiro(p.raio, 20, 2000, 150),
          verificadoEm: verificado,
        };
      });
  }

  // ==================================================================== MAPA

  function opcoesStatus(categoria) {
    if (categoria === 'perigo') return [['inseguro', 'Ativo'], ['resolvido', 'Resolvido']];
    return Object.entries(M.STATUS).map(([k, v]) => [k, v.rotulo]);
  }

  function preencherTipos() {
    const cat = A.$('#ponto-categoria').value;
    A.trocar(A.$('#ponto-tipo'), Object.entries(M.CATEGORIAS[cat].tipos).map(([v, t]) => A.h('option', { value: v }, t)));
    A.trocar(A.$('#ponto-status'), opcoesStatus(cat).map(([v, t]) => A.h('option', { value: v, selected: v === 'disponivel' }, t)));
    A.$('#rotulo-raio').hidden = cat !== 'perigo';
  }

  function montarMapa() {
    const est = () => A.estado.mapa;

    // Base
    const fBase = A.$('#form-base');
    fBase.addEventListener('input', (e) => {
      if (e.target.id === 'base-nome') {
        est().base.nome = e.target.value.slice(0, 40) || 'Casa';
      } else if (e.target.id === 'base-coord') {
        const c = M.lerCoordenadas(e.target.value);
        const msg = A.$('#msg-base');
        if (c) {
          est().base.lat = c.lat;
          est().base.lon = c.lon;
          msg.textContent = 'Base definida.';
        } else if (e.target.value.trim()) {
          msg.textContent = 'Coordenadas não reconhecidas. Exemplo: -23.5505, -46.6333';
          return;
        }
      }
      A.salvar();
      renderMapa();
    });

    // Novo ponto
    A.trocar(
      A.$('#ponto-categoria'),
      Object.entries(M.CATEGORIAS).map(([v, c]) => A.h('option', { value: v }, c.rotulo)),
    );
    preencherTipos();
    A.$('#ponto-categoria').addEventListener('change', preencherTipos);
    A.trocar(A.$('#ponto-direcao'), M.DIRECOES.map((d) => A.h('option', { value: d }, d)));

    const fPonto = A.$('#form-ponto');
    fPonto.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#ponto-nome').value.trim();
      if (!nome) return;
      const textoC = A.$('#ponto-coord').value.trim();
      let c = M.lerCoordenadas(textoC);
      const msg = A.$('#msg-ponto');
      if (textoC && !c) {
        msg.textContent = 'Coordenadas não reconhecidas. Corrija ou deixe em branco (o ponto entra sem distância).';
        return;
      }
      // Sem coordenadas: distância (metros ou passos) e direção a partir da base, sem internet.
      const distancia = Number(A.$('#ponto-distancia').value);
      if (!c && distancia > 0) {
        try {
          const m = A.$('#ponto-unidade').value === 'passos' ? M.metrosDePassos(distancia) : distancia;
          c = M.pontoPorRumo(est().base, m, A.$('#ponto-direcao').value);
        } catch (erro) {
          msg.textContent = erro.message;
          return;
        }
      }
      est().pontos.push({
        id: A.novoId(),
        nome: nome.slice(0, 60),
        categoria: A.$('#ponto-categoria').value,
        tipo: A.$('#ponto-tipo').value,
        status: A.$('#ponto-status').value,
        lat: c ? c.lat : null,
        lon: c ? c.lon : null,
        referencia: A.$('#ponto-ref').value.trim().slice(0, 100),
        obs: A.$('#ponto-obs').value.trim().slice(0, 120),
        raio: A.inteiro(A.$('#ponto-raio').value, 20, 2000, 150),
        verificadoEm: new Date().toISOString(),
      });
      for (const id of ['#ponto-nome', '#ponto-coord', '#ponto-ref', '#ponto-obs', '#ponto-distancia']) A.$(id).value = '';
      msg.textContent = c ? `“${nome}” adicionado ao mapa.` : `“${nome}” adicionado sem coordenadas: não aparece no mapa nem nas distâncias.`;
      A.salvar();
      renderMapa();
    });

    for (const b of document.querySelectorAll('[data-localizar]')) {
      b.addEventListener('click', () => {
        const campo = document.getElementById(b.dataset.localizar);
        const msg = b.dataset.localizar === 'base-coord' ? A.$('#msg-base') : A.$('#msg-ponto');
        localizar(campo, msg);
      });
    }

    // Busca por categoria
    A.trocar(
      A.$('#botoes-busca'),
      CATEGORIAS_BUSCA.map((cat) =>
        A.h('button', { type: 'button', class: 'secundario', dataset: { busca: cat }, 'aria-pressed': 'false' }, M.CATEGORIAS[cat].rotulo),
      ),
    );
    A.$('#botoes-busca').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-busca]');
      if (!b) return;
      est().busca = b.dataset.busca;
      A.salvar();
      renderBusca();
    });

    // Lista de pontos: situação, confirmar, remover
    const lista = A.$('#lista-pontos');
    lista.addEventListener('change', (e) => {
      const sel = e.target.closest('select[data-status]');
      if (!sel) return;
      const p = est().pontos.find((x) => x.id === sel.dataset.status);
      if (!p) return;
      p.status = sel.value;
      p.verificadoEm = new Date().toISOString();
      A.salvar();
      renderMapa();
    });
    lista.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const p = est().pontos.find((x) => x.id === b.dataset.id);
      if (!p) return;
      if (b.dataset.acao === 'confirmar') p.verificadoEm = new Date().toISOString();
      if (b.dataset.acao === 'remover') est().pontos = est().pontos.filter((x) => x !== p);
      A.salvar();
      renderMapa();
    });
  }

  function renderBusca() {
    const est = A.estado.mapa;
    for (const b of document.querySelectorAll('#botoes-busca button')) {
      const ativo = b.dataset.busca === est.busca;
      b.setAttribute('aria-pressed', String(ativo));
      b.classList.toggle('secundario', !ativo);
    }
    const destino = A.$('#resultado-busca');
    const base = est.base;
    if (!coordValida(base.lat, base.lon)) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, 'Defina as coordenadas da base para calcular distâncias e rotas.'));
      return;
    }
    const r = M.buscarRecursos(est.pontos, base, { categoria: est.busca });
    const rotulo = M.CATEGORIAS[est.busca].rotulo.toLowerCase();
    if (!r.opcoes.length) {
      A.trocar(
        destino,
        A.h('p', { class: 'aviso' }, `Nenhum ponto de ${rotulo} utilizável com localização no mapa. Cadastre os que a comunidade conhece.`),
        r.evitar.length ? A.h('p', { class: 'ajuda' }, `Evitar: ${r.evitar.map((x) => `${x.ponto.nome} (${x.motivo.toLowerCase()})`).join('; ')}.`) : null,
      );
      return;
    }
    const o = r.recomendado;
    const p = o.ponto;
    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'recomendado' },
        A.h('div', { class: 'rotulo-nivel' }, 'Melhor opção agora'),
        A.h('div', { class: 'nome-recurso' }, p.nome),
        A.h('p', null, `${M.CATEGORIAS[p.categoria].tipos[p.tipo]} · `, A.h('span', { class: `estado ${classeStatus(p.status)}` }, rotuloStatus(p.status))),
        A.h('p', { class: 'direcao' }, `${metros(o.distancia)} ${rumoTexto(o.direcao)} da base · ≈ ${o.minutosAPe} min a pé`),
        A.h(
          'p',
          { class: 'ajuda' },
          p.verificadoEm ? `Confirmado ${haQuanto(p.verificadoEm)}` : 'Nunca confirmado',
          o.frescor.nivel === 'antiga' || o.frescor.nivel === 'desatualizada' ? ' — informação velha, confirme antes de ir' : '',
          p.referencia ? ` · ${p.referencia}` : '',
          p.obs ? ` · ${p.obs}` : '',
        ),
        o.tratamento ? A.h('p', { class: 'tratamento' }, A.h('strong', null, 'Tratamento: '), o.tratamento) : null,
        o.rotaPerigo === 'atravessa'
          ? A.h('p', { class: 'aviso perigo' }, `A linha reta até lá atravessa: ${o.perigos.join(', ')}. Contorne por outra rua ou escolha outra opção.`)
          : o.rotaPerigo === 'perto'
            ? A.h('p', { class: 'aviso' }, `O caminho passa perto de: ${o.perigos.join(', ')}. Vá em grupo e com atenção.`)
            : null,
      ),
      r.opcoes.length > 1
        ? [
            A.h('h4', null, 'Outras opções'),
            A.h(
              'ol',
              { class: 'opcoes' },
              r.opcoes.slice(1, 6).map((x) =>
                A.h(
                  'li',
                  null,
                  A.h('strong', null, x.ponto.nome),
                  ` — ${metros(x.distancia)} ${rumoTexto(x.direcao)}, ${rotuloStatus(x.ponto.status).toLowerCase()}, ${haQuanto(x.ponto.verificadoEm)}`,
                  x.rotaPerigo ? A.h('span', { class: 'estado vencido' }, x.rotaPerigo === 'atravessa' ? ' rota atravessa perigo' : ' perto de perigo') : null,
                ),
              ),
            ),
          ]
        : null,
      r.evitar.length ? A.h('p', { class: 'ajuda' }, `Evitar: ${r.evitar.map((x) => `${x.ponto.nome} (${x.motivo.toLowerCase()})`).join('; ')}.`) : null,
      r.semLocalizacao.length ? A.h('p', { class: 'ajuda' }, `Sem localização (fora da conta): ${r.semLocalizacao.map((x) => x.ponto.nome).join(', ')}.`) : null,
    );
  }

  const FORMAS = { agua: 'circulo', remedio: 'cruz', alimento: 'quadrado', abrigo: 'losango', perigo: 'triangulo' };

  function marcador(forma, x, y, classe) {
    const r = 6;
    if (forma === 'circulo') return svg('circle', { cx: x, cy: y, r, class: classe });
    if (forma === 'quadrado') return svg('rect', { x: x - r, y: y - r, width: 2 * r, height: 2 * r, class: classe });
    if (forma === 'losango') return svg('polygon', { points: `${x},${y - r - 1} ${x + r + 1},${y} ${x},${y + r + 1} ${x - r - 1},${y}`, class: classe });
    if (forma === 'triangulo') return svg('polygon', { points: `${x},${y - r - 1} ${x + r + 1},${y + r} ${x - r - 1},${y + r}`, class: classe });
    const b = 2.5;
    return svg('polygon', {
      points: [
        [x - b, y - r], [x + b, y - r], [x + b, y - b], [x + r, y - b], [x + r, y + b], [x + b, y + b],
        [x + b, y + r], [x - b, y + r], [x - b, y + b], [x - r, y + b], [x - r, y - b], [x - b, y - b],
      ].map((q) => q.join(',')).join(' '),
      class: classe,
    });
  }

  function renderRadar() {
    const est = A.estado.mapa;
    const destino = A.$('#radar');
    const base = est.base;
    if (!coordValida(base.lat, base.lon)) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, 'O mapa aparece quando a base tiver coordenadas.'));
      return;
    }
    const pts = est.pontos.filter((p) => coordValida(p.lat, p.lon)).map((p) => ({ p, ...M.projetar(base, p) }));
    const maior = pts.reduce((m, q) => Math.max(m, Math.hypot(q.x, q.y) + (q.p.categoria === 'perigo' ? q.p.raio : 0)), 0);
    const alcance = [250, 500, 1000, 2000, 3000, 5000, 10000, 20000, 50000].find((a) => a >= maior * 1.08) || Math.ceil(maior / 10000) * 10000;
    const L = 340;
    const c = L / 2;
    const R = c - 28;
    const esc = R / alcance;

    const aneis = [0.25, 0.5, 0.75, 1].map((f) =>
      [
        svg('circle', { cx: c, cy: c, r: R * f, class: 'anel' }),
        f === 0.5 || f === 1 ? svg('text', { x: c + 4, y: c - R * f + 12, class: 'rotulo-anel' }, metros(alcance * f)) : null,
      ],
    );
    const perigos = pts
      .filter((q) => q.p.categoria === 'perigo')
      .map((q) => svg('circle', { cx: c + q.x * esc, cy: c - q.y * esc, r: Math.max(4, q.p.raio * esc), class: q.p.status === 'resolvido' ? 'zona resolvida' : 'zona' }));
    const pos = pts.map((q) => ({
      q,
      x: c + q.x * esc,
      y: c - q.y * esc,
      texto: q.p.nome.length > 16 ? `${q.p.nome.slice(0, 15)}…` : q.p.nome,
    }));
    // Nome da base: abaixo, acima, à direita ou à esquerda — o primeiro sem marcador por cima.
    const nomeBase = est.base.nome || 'Base';
    const wb = nomeBase.length * 6.4 + 4;
    const rotuloBase = S.rotulos.primeiroLivre(
      [
        { tx: c, ty: c + 21, ancora: 'middle', caixa: [c - wb / 2, c + 10, c + wb / 2, c + 24] },
        { tx: c, ty: c - 13, ancora: 'middle', caixa: [c - wb / 2, c - 24, c + wb / 2, c - 10] },
        { tx: c + 11, ty: c + 4, ancora: 'start', caixa: [c + 10, c - 7, c + 10 + wb, c + 7] },
        { tx: c - 11, ty: c + 4, ancora: 'end', caixa: [c - 10 - wb, c - 7, c - 10, c + 7] },
      ],
      pos.map((m) => [m.x - 7, m.y - 7, m.x + 7, m.y + 7]),
    );
    // Nomes dos pontos: os mais perto da base escolhem a posição primeiro.
    const ordem = pos.map((_, i) => i).sort((a, b) => Math.hypot(pos[a].q.x, pos[a].q.y) - Math.hypot(pos[b].q.x, pos[b].q.y));
    const caixasAneis = [0.5, 1].map((f) => [c + 2, c - R * f + 2, c + 6 + metros(alcance * f).length * 5.5, c - R * f + 15]);
    const rotulos = S.rotulos.posicionarRotulos(pos, { largura: L, altura: L, ocupadas: [rotuloBase.caixa, [c - 8, c - 8, c + 8, c + 8], ...caixasAneis], ordem });
    const marcas = pos.map((m, i) => {
      const p = m.q.p;
      const inativo = p.status === 'esgotado' || p.status === 'resolvido' || (p.status === 'inseguro' && p.categoria !== 'perigo');
      const r = rotulos[i];
      return svg(
        'g',
        { class: `marca cat-${p.categoria}${inativo ? ' inativo' : ''}` },
        svg('title', null, `${p.nome} — ${rotuloStatus(p.status)}`),
        marcador(FORMAS[p.categoria], m.x, m.y, 'forma'),
        svg('text', { x: r.tx, y: r.ty, 'text-anchor': r.ancora, class: 'rotulo-ponto' }, m.texto),
      );
    });

    A.trocar(
      destino,
      svg(
        'svg',
        { viewBox: `0 0 ${L} ${L}`, class: 'radar', role: 'img', 'aria-label': `Mapa com ${pts.length} pontos ao redor da base, até ${metros(alcance)}` },
        aneis,
        svg('line', { x1: c, y1: c - R, x2: c, y2: c + R, class: 'eixo' }),
        svg('line', { x1: c - R, y1: c, x2: c + R, y2: c, class: 'eixo' }),
        svg('text', { x: c, y: 14, 'text-anchor': 'middle', class: 'norte' }, 'N'),
        perigos,
        marcas,
        svg('circle', { cx: c, cy: c, r: 7, class: 'base' }),
        svg('text', { x: rotuloBase.tx, y: rotuloBase.ty, 'text-anchor': rotuloBase.ancora, class: 'rotulo-base' }, nomeBase),
      ),
      A.h(
        'ul',
        { class: 'legenda' },
        Object.entries(M.CATEGORIAS).map(([k, cat]) =>
          A.h('li', null, svg('svg', { viewBox: '0 0 16 16', width: 14, height: 14, class: `cat-${k}`, 'aria-hidden': 'true' }, marcador(FORMAS[k], 8, 8, 'forma')), ` ${cat.rotulo}`),
        ),
      ),
    );
  }

  function renderCobertura() {
    const r = M.resumoCobertura(A.estado.mapa.pontos);
    const avisos = r.lacunas.map((cat) => A.h('p', { class: 'aviso' }, `${M.CATEGORIAS[cat].rotulo}: nenhum ponto disponível confirmado nas últimas 24 h.`));
    A.trocar(
      A.$('#cobertura'),
      A.h(
        'div',
        { class: 'cartao' },
        A.h('h3', null, 'Cobertura do mapa'),
        A.h(
          'div',
          { class: 'metricas' },
          CATEGORIAS_BUSCA.map((cat) => {
            const x = r.porCategoria[cat];
            return A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(x.confiaveis)), A.h('small', null, `${M.CATEGORIAS[cat].rotulo}: confirmados em 24 h (de ${x.total})`));
          }),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, String(r.perigosAtivos)), A.h('small', null, 'zonas de perigo ativas')),
        ),
        avisos,
      ),
    );
  }

  function renderListaPontos() {
    const est = A.estado.mapa;
    const destino = A.$('#lista-pontos');
    if (!est.pontos.length) {
      A.trocar(destino, A.h('p', { class: 'ajuda' }, 'Nenhum ponto no mapa ainda. Comece pela igreja, pelas fontes de água e pelas farmácias do bairro.'));
      return;
    }
    const base = est.base;
    const temBase = coordValida(base.lat, base.lon);
    const ordem = Object.keys(M.CATEGORIAS);
    const pontos = [...est.pontos].sort((a, b) => ordem.indexOf(a.categoria) - ordem.indexOf(b.categoria) || a.nome.localeCompare(b.nome, 'pt-BR'));
    const botao = (acao, id, texto, rotulo) => A.h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo, title: rotulo }, texto);
    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Ponto'), A.h('th', null, 'Situação'), A.h('th', { class: 'num' }, 'Distância'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            pontos.map((p) =>
              A.h(
                'tr',
                null,
                A.h(
                  'td',
                  null,
                  A.h('span', { class: `ponto-cat cat-${p.categoria}`, 'aria-hidden': 'true' }),
                  ' ',
                  p.nome,
                  A.h('br'),
                  A.h('small', { class: 'ajuda' }, `${M.CATEGORIAS[p.categoria].tipos[p.tipo]} · ${haQuanto(p.verificadoEm)}`),
                ),
                A.h(
                  'td',
                  null,
                  A.h(
                    'select',
                    { dataset: { status: p.id }, 'aria-label': `Situação de ${p.nome}`, class: 'select-mini' },
                    opcoesStatus(p.categoria).map(([v, t]) => A.h('option', { value: v, selected: v === p.status }, t)),
                  ),
                ),
                A.h('td', { class: 'num' }, temBase && coordValida(p.lat, p.lon) ? metros(M.distanciaMetros(base, p)) : '—'),
                A.h('td', { class: 'acoes-linha' }, botao('confirmar', p.id, '✓', `Confirmei agora: ${p.nome}`), botao('remover', p.id, '✕', `Remover ${p.nome}`)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  function renderMapa() {
    renderBusca();
    renderRadar();
    renderCobertura();
    renderListaPontos();
  }

  function recarregarMapa() {
    A.$('#base-nome').value = A.estado.mapa.base.nome;
    A.$('#base-coord').value = textoCoord(A.estado.mapa.base);
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'mapa',
    padrao,
    mesclar,
    montar(api) {
      A = api;
      montarMapa();
      recarregarMapa();
    },
    render: renderMapa,
    recarregar: recarregarMapa,
    navegar(secao, sub) {
      if (secao !== 'mapa' || !CATEGORIAS_BUSCA.includes(sub)) return false;
      A.estado.mapa.busca = sub;
      A.salvar();
      renderBusca();
      A.$('#resultado-busca').scrollIntoView({ block: 'start' });
      return true; // a rolagem já foi feita
    },
  });
})();
