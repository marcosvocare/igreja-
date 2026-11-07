/**
 * Abas do cenário de colapso: Mapa de recursos, Defesa comunitária,
 * Remédios críticos e Partilha justa. Registra-se como extensão de app.js
 * (este arquivo precisa ser carregado ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const M = S.mapa;
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CATEGORIAS_BUSCA = ['agua', 'remedio', 'alimento', 'abrigo'];
  const PERFIS_FAMILIA = ['adultos', 'idosos', 'gestantes', 'criancas', 'bebes'];
  const KCAL_POR_KG = { arroz: 3600, feijao: 3300, macarrao: 3700, farinha: 3600, outros: 3500 };

  let A = null; // API do app, recebida em montar()

  // ------------------------------------------------------------- utilitários

  function svg(tag, attrs, ...filhos) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) if (v !== null && v !== undefined) el.setAttribute(k, String(v));
    for (const f of filhos.flat(Infinity)) if (f !== null && f !== undefined && f !== false) el.append(f instanceof Node ? f : String(f));
    return el;
  }

  function coordValida(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  function textoCoord(p) {
    return p && coordValida(p.lat, p.lon) ? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` : '';
  }

  function metros(m) {
    return m >= 1000 ? `${A.fmt(m / 1000, 1)} km` : `${Math.round(m / 10) * 10} m`;
  }

  /** "ao norte", "ao sul", "a leste", "a nordeste"… */
  function rumoTexto(direcao) {
    return `${direcao === 'norte' || direcao === 'sul' ? 'ao' : 'a'} ${direcao}`;
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

  function dataHora(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  function horaLocalInput(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
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
    return {
      mapa: { base: { nome: 'Casa', lat: null, lon: null }, pontos: [], busca: 'agua' },
      remedios: [],
      partilha: { agua: 0, kcal: 0, dias: 3, familias: [] },
      defesa: { feitos: {}, frase: '', voluntarios: '', escala: { inicio: '', horas: 24, turno: 3, por: 2, descanso: 6 } },
    };
  }

  function mesclar(dados, r, u) {
    const num = (v, min, max, pad) => {
      const n = Number(v);
      return Number.isFinite(n) && n >= min && n <= max ? n : pad;
    };
    const objeto = (v) => (v && typeof v === 'object' ? v : {});

    // Mapa
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

    // Remédios
    r.remedios = u
      .lista(dados.remedios)
      .filter((x) => typeof x.nome === 'string' && x.nome.trim())
      .map((x) => ({
        id: u.texto(x.id, 40) || u.novoId(),
        pessoa: u.texto(x.pessoa, 40),
        nome: x.nome.slice(0, 60),
        dosesPorDia: num(x.dosesPorDia, 0, 48, 0),
        unidadesPorDose: num(x.unidadesPorDose, 0, 1000, 1),
        quantidade: num(x.quantidade, 0, 100000, 0),
        validade: typeof x.validade === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.validade) ? x.validade : '',
        refrigerado: x.refrigerado === true,
      }));

    // Partilha
    const pt = objeto(dados.partilha);
    r.partilha.agua = num(pt.agua, 0, 10000000, 0);
    r.partilha.kcal = num(pt.kcal, 0, 1000000000, 0);
    r.partilha.dias = u.inteiro(pt.dias, 1, 60, 3);
    r.partilha.familias = u
      .lista(pt.familias)
      .filter((f) => typeof f.nome === 'string' && f.nome.trim())
      .map((f) => {
        const casa = {};
        for (const k of PERFIS_FAMILIA) casa[k] = u.inteiro(objeto(f.casa)[k], 0, 30, 0);
        return { id: u.texto(f.id, 40) || u.novoId(), nome: f.nome.slice(0, 40), casa, vulneravel: f.vulneravel === true };
      });

    // Defesa
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

    const fPonto = A.$('#form-ponto');
    fPonto.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#ponto-nome').value.trim();
      if (!nome) return;
      const textoC = A.$('#ponto-coord').value.trim();
      const c = M.lerCoordenadas(textoC);
      const msg = A.$('#msg-ponto');
      if (textoC && !c) {
        msg.textContent = 'Coordenadas não reconhecidas. Corrija ou deixe em branco (o ponto entra sem distância).';
        return;
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
      for (const id of ['#ponto-nome', '#ponto-coord', '#ponto-ref', '#ponto-obs']) A.$(id).value = '';
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
    // Posiciona cada nome no primeiro lugar livre (direita, esquerda, acima, abaixo).
    const sobrepoe = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
    const pos = pts.map((q) => ({ q, x: c + q.x * esc, y: c - q.y * esc }));
    const caixasMarcas = pos.map((m) => [m.x - 7, m.y - 7, m.x + 7, m.y + 7]);
    // Nome da base: abaixo, acima, à direita ou à esquerda — o primeiro sem marcador por cima.
    const nomeBase = est.base.nome || 'Base';
    const wb = nomeBase.length * 6.4 + 4;
    const opcoesBase = [
      { tx: c, ty: c + 21, ancora: 'middle', caixa: [c - wb / 2, c + 10, c + wb / 2, c + 24] },
      { tx: c, ty: c - 13, ancora: 'middle', caixa: [c - wb / 2, c - 24, c + wb / 2, c - 10] },
      { tx: c + 11, ty: c + 4, ancora: 'start', caixa: [c + 10, c - 7, c + 10 + wb, c + 7] },
      { tx: c - 11, ty: c + 4, ancora: 'end', caixa: [c - 10 - wb, c - 7, c - 10, c + 7] },
    ];
    const rotuloBase = opcoesBase.find((o) => !caixasMarcas.some((b) => sobrepoe(o.caixa, b))) || opcoesBase[0];
    const caixas = [rotuloBase.caixa, [c - 8, c - 8, c + 8, c + 8], ...caixasMarcas];
    const rotulos = new Map();
    for (const m of [...pos].sort((a, b) => Math.hypot(a.q.x, a.q.y) - Math.hypot(b.q.x, b.q.y))) {
      const nome = m.q.p.nome.length > 16 ? `${m.q.p.nome.slice(0, 15)}…` : m.q.p.nome;
      const w = nome.length * 5.8 + 4;
      const { x, y } = m;
      const opcoes = [
        { tx: x + 10, ty: y + 4, ancora: 'start', caixa: [x + 9, y - 6, x + 9 + w, y + 6] },
        { tx: x - 10, ty: y + 4, ancora: 'end', caixa: [x - 9 - w, y - 6, x - 9, y + 6] },
        { tx: x + 7, ty: y - 10, ancora: 'start', caixa: [x + 6, y - 19, x + 6 + w, y - 8] },
        { tx: x + 7, ty: y + 17, ancora: 'start', caixa: [x + 6, y + 8, x + 6 + w, y + 19] },
        { tx: x - 7, ty: y - 10, ancora: 'end', caixa: [x - 6 - w, y - 19, x - 6, y - 8] },
        { tx: x - 7, ty: y + 17, ancora: 'end', caixa: [x - 6 - w, y + 8, x - 6, y + 19] },
        { tx: x, ty: y - 11, ancora: 'middle', caixa: [x - w / 2, y - 21, x + w / 2, y - 9] },
        { tx: x, ty: y + 19, ancora: 'middle', caixa: [x - w / 2, y + 9, x + w / 2, y + 21] },
      ].filter((o) => o.caixa[0] >= 0 && o.caixa[2] <= L && o.caixa[1] >= 16 && o.caixa[3] <= L);
      const propria = [x - 7, y - 7, x + 7, y + 7];
      const conflitos = (o) => caixas.filter((b) => !(b[0] === propria[0] && b[1] === propria[1]) && sobrepoe(o.caixa, b)).length;
      // A primeira posição livre; se nenhuma estiver livre, a que encobre menos coisas.
      let escolhida = null;
      let menor = Infinity;
      for (const o of opcoes) {
        const n = conflitos(o);
        if (n < menor) {
          menor = n;
          escolhida = o;
        }
        if (n === 0) break;
      }
      escolhida = escolhida || { tx: x + 10, ty: y + 4, ancora: 'start', caixa: [x, y, x, y] };
      caixas.push(escolhida.caixa);
      rotulos.set(m, { nome, ...escolhida });
    }
    const marcas = pos.map((m) => {
      const p = m.q.p;
      const inativo = p.status === 'esgotado' || p.status === 'resolvido' || (p.status === 'inseguro' && p.categoria !== 'perigo');
      const r = rotulos.get(m);
      return svg(
        'g',
        { class: `marca cat-${p.categoria}${inativo ? ' inativo' : ''}` },
        svg('title', null, `${p.nome} — ${rotuloStatus(p.status)}`),
        marcador(FORMAS[p.categoria], m.x, m.y, 'forma'),
        svg('text', { x: r.tx, y: r.ty, 'text-anchor': r.ancora, class: 'rotulo-ponto' }, r.nome),
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

  // ================================================================ REMÉDIOS

  function montarRemedios() {
    A.trocar(A.$('#orientacoes-remedios'), S.remedios.ORIENTACOES.map((o) => A.h('li', null, o)));
    const form = A.$('#form-remedio');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#rem-nome').value.trim();
      const pessoa = A.$('#rem-pessoa').value.trim();
      if (!nome || !pessoa) return;
      const num = (id, max) => Math.min(max, A.numeroPositivo(A.$(id).value));
      A.estado.remedios.push({
        id: A.novoId(),
        pessoa: pessoa.slice(0, 40),
        nome: nome.slice(0, 60),
        dosesPorDia: num('#rem-doses', 48),
        unidadesPorDose: num('#rem-unidades', 1000) || 1,
        quantidade: num('#rem-qtd', 100000),
        validade: /^\d{4}-\d{2}-\d{2}$/.test(A.$('#rem-validade').value) ? A.$('#rem-validade').value : '',
        refrigerado: A.$('#rem-geladeira').checked,
      });
      for (const id of ['#rem-nome', '#rem-qtd', '#rem-validade']) A.$(id).value = '';
      A.$('#rem-geladeira').checked = false;
      A.$('#rem-nome').focus();
      A.salvar();
      renderRemedios();
    });
    A.$('#lista-remedios').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-acao]');
      if (!b) return;
      const item = A.estado.remedios.find((x) => x.id === b.dataset.id);
      if (!item) return;
      const passo = Math.max(1, item.unidadesPorDose || 1);
      if (b.dataset.acao === 'mais') item.quantidade += passo;
      if (b.dataset.acao === 'menos') item.quantidade = Math.max(0, item.quantidade - passo);
      if (b.dataset.acao === 'remover') A.estado.remedios = A.estado.remedios.filter((x) => x !== item);
      A.salvar();
      renderRemedios();
    });
  }

  function renderRemedios() {
    const itens = A.estado.remedios;
    A.trocar(A.$('#pessoas-remedios'), [...new Set(itens.map((i) => i.pessoa).filter(Boolean))].map((p) => A.h('option', { value: p })));
    if (!itens.length) {
      A.trocar(A.$('#resumo-remedios'), A.h('p', { class: 'cartao ajuda' }, 'Cadastre os remédios de uso contínuo de cada pessoa da casa ou da rede.'));
      A.trocar(A.$('#lista-remedios'));
      return;
    }
    const r = S.remedios.situacaoRemedios(itens, new Date());
    const repor = S.remedios.planoReposicao(itens, 30);
    const rotulos = { critico: ['Crítico', 'vencido'], atencao: ['Atenção', 'vencendo'], ok: ['Em dia', 'ok'], sem_dados: ['Sem dose', 'sem'] };
    A.trocar(
      A.$('#resumo-remedios'),
      A.h(
        'div',
        { class: 'painel-nivel', dataset: { cor: r.criticos ? 'vermelho' : r.atencao ? 'amarelo' : 'verde' } },
        A.h('div', { class: 'rotulo-nivel' }, 'Remédios'),
        A.h('div', { class: 'postura' }, r.criticos ? `${r.criticos} crítico(s)` : r.atencao ? `${r.atencao} em atenção` : 'Tudo em dia'),
        r.pessoasEmRisco.length ? A.h('p', null, `Pessoas em risco: ${r.pessoasEmRisco.join(', ')}.`) : null,
        r.menorCobertura !== null ? A.h('p', null, `O primeiro a acabar dura ${r.menorCobertura} dia(s).`) : null,
        A.h('a', { class: 'botao secundario', href: '#mapa-remedio' }, 'Onde buscar remédios'),
      ),
      repor.length
        ? A.h(
            'div',
            { class: 'cartao' },
            A.h('h3', null, 'Para 30 dias faltam'),
            A.h('ul', null, repor.map((x) => A.h('li', null, `${x.nome} (${x.pessoa}): ${A.fmt(x.faltam, 0)} unidades`))),
          )
        : null,
    );
    const botao = (acao, id, texto, rotulo) => A.h('button', { type: 'button', class: 'mini secundario', dataset: { acao, id }, 'aria-label': rotulo }, texto);
    A.trocar(
      A.$('#lista-remedios'),
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Remédio'), A.h('th', null, 'Dura'), A.h('th', { class: 'num' }, 'Estoque'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            r.itens.map((i) =>
              A.h(
                'tr',
                null,
                A.h(
                  'td',
                  null,
                  A.h('strong', null, i.nome),
                  A.h('br'),
                  A.h('small', { class: 'ajuda' }, `${i.pessoa}${i.consumoDiario ? ` · ${A.fmt(i.consumoDiario)} un/dia` : ''}${i.refrigerado ? ' · geladeira' : ''}`),
                  i.avisos.map((a) => [A.h('br'), A.h('small', { class: 'aviso-linha' }, a)]),
                ),
                A.h(
                  'td',
                  null,
                  A.h('span', { class: `estado ${rotulos[i.nivel][1]}` }, i.diasEfetivos === null ? rotulos[i.nivel][0] : `${i.diasEfetivos} dia(s)`),
                  i.acabaEm ? [A.h('br'), A.h('small', { class: 'ajuda' }, `até ${A.dataBR(i.acabaEm)}`)] : null,
                ),
                A.h('td', { class: 'num' }, botao('menos', i.id, '−', `Diminuir ${i.nome}`), ` ${A.fmt(i.quantidade, 1)} `, botao('mais', i.id, '+', `Aumentar ${i.nome}`)),
                A.h('td', null, botao('remover', i.id, '✕', `Remover ${i.nome}`)),
              ),
            ),
          ),
        ),
      ),
    );
  }

  // ================================================================ PARTILHA

  function necessidadeFamilia(f) {
    const n = S.suprimentos.necessidadeDiaria(f.casa, { climaQuente: A.estado.climaQuente });
    return { agua: n.aguaBeber + n.aguaHigiene, kcal: n.kcal };
  }

  function prioridade(f) {
    const motivos = [];
    if (f.casa.bebes) motivos.push('bebê');
    if (f.casa.gestantes) motivos.push('gestante');
    if (f.casa.idosos) motivos.push('idoso');
    if (f.vulneravel) motivos.push('doença ou deficiência');
    return motivos;
  }

  function montarPartilha() {
    A.trocar(
      A.$('#campos-familia'),
      PERFIS_FAMILIA.map((k) =>
        A.h('label', null, S.suprimentos.PERFIS[k].rotulo, A.h('input', { type: 'number', id: `fam-${k}`, min: 0, max: 30, step: 1, value: k === 'adultos' ? 2 : 0, inputmode: 'numeric' })),
      ),
    );
    A.$('#form-estoque-comum').addEventListener('input', (e) => {
      const pt = A.estado.partilha;
      if (e.target.id === 'comum-agua') pt.agua = Math.min(10000000, A.numeroPositivo(e.target.value));
      if (e.target.id === 'comum-kcal') pt.kcal = Math.min(1000000000, A.numeroPositivo(e.target.value));
      if (e.target.id === 'comum-dias') pt.dias = A.inteiro(e.target.value, 1, 60, pt.dias);
      A.salvar();
      renderPartilha();
    });
    A.$('#somar-kcal').addEventListener('click', () => {
      const kg = A.numeroPositivo(A.$('#somar-kg').value);
      if (!kg) return;
      const pt = A.estado.partilha;
      pt.kcal = Math.round(pt.kcal + kg * KCAL_POR_KG[A.$('#somar-tipo').value]);
      A.$('#comum-kcal').value = pt.kcal;
      A.$('#somar-kg').value = '';
      A.salvar();
      renderPartilha();
    });
    A.$('#form-familia').addEventListener('submit', (e) => {
      e.preventDefault();
      const nome = A.$('#fam-nome').value.trim();
      if (!nome) return;
      const casa = {};
      for (const k of PERFIS_FAMILIA) casa[k] = A.inteiro(A.$(`#fam-${k}`).value, 0, 30, 0);
      if (!Object.values(casa).some(Boolean)) return;
      A.estado.partilha.familias.push({ id: A.novoId(), nome: nome.slice(0, 40), casa, vulneravel: A.$('#fam-vulneravel').checked });
      A.$('#fam-nome').value = '';
      A.$('#fam-vulneravel').checked = false;
      A.$('#fam-nome').focus();
      A.salvar();
      renderPartilha();
    });
    A.$('#resultado-partilha').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-remover-familia]');
      if (!b) return;
      A.estado.partilha.familias = A.estado.partilha.familias.filter((f) => f.id !== b.dataset.removerFamilia);
      A.salvar();
      renderPartilha();
    });
    recarregarPartilha();
  }

  function recarregarPartilha() {
    const pt = A.estado.partilha;
    A.$('#comum-agua').value = pt.agua || '';
    A.$('#comum-kcal').value = pt.kcal || '';
    A.$('#comum-dias').value = pt.dias;
  }

  function renderPartilha() {
    const pt = A.estado.partilha;
    const destino = A.$('#resultado-partilha');
    if (!pt.familias.length) {
      A.trocar(destino, A.h('p', { class: 'cartao ajuda' }, 'Cadastre as famílias atendidas e o estoque comum para ver a divisão.'));
      return;
    }
    const necessidades = pt.familias.map(necessidadeFamilia);
    const demandas = (campo) => pt.familias.map((f, i) => ({ nome: f.nome, necessidade: necessidades[i][campo], vulneravel: prioridade(f).length > 0 }));
    const agua = S.partilha.distribuir(pt.agua, demandas('agua'), { dias: pt.dias });
    const comida = S.partilha.distribuir(pt.kcal, demandas('kcal'), { dias: pt.dias });
    const totalAguaDia = necessidades.reduce((s, n) => s + n.agua, 0);
    const totalKcalDia = necessidades.reduce((s, n) => s + n.kcal, 0);
    const diasAgua = S.partilha.diasDeEstoque(pt.agua, totalAguaDia);
    const diasKcal = S.partilha.diasDeEstoque(pt.kcal, totalKcalDia);
    const pessoas = (f) => PERFIS_FAMILIA.reduce((s, k) => s + f.casa[k], 0);

    A.trocar(
      destino,
      A.h(
        'div',
        { class: 'cartao' },
        A.h('h3', null, `Divisão para ${pt.dias} dia(s)`),
        A.h(
          'div',
          { class: 'metricas' },
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${agua.cobertura}%`), A.h('small', null, `da água necessária${diasAgua !== null ? ` · dá ${A.fmt(diasAgua)} dia(s) para todos` : ''}`)),
          A.h('div', { class: 'metrica' }, A.h('span', { class: 'grande' }, `${comida.cobertura}%`), A.h('small', null, `da comida necessária${diasKcal !== null ? ` · dá ${A.fmt(diasKcal)} dia(s) para todos` : ''}`)),
        ),
        agua.cobertura < 100 || comida.cobertura < 100
          ? A.h('p', { class: 'aviso' }, 'Não há para todos no período: a divisão abaixo é proporcional à necessidade, com prioridade para bebês, gestantes, idosos e doentes.')
          : null,
        agua.sobra || comida.sobra
          ? A.h('p', { class: 'ajuda' }, `Sobra no estoque comum: ${agua.sobra ? `${A.fmt(agua.sobra)} L de água` : ''}${agua.sobra && comida.sobra ? ' e ' : ''}${comida.sobra ? `${A.fmt(comida.sobra, 0)} kcal de comida` : ''}.`)
          : null,
      ),
      A.h(
        'div',
        { class: 'cartao tabela-rolagem' },
        A.h(
          'table',
          null,
          A.h('thead', null, A.h('tr', null, A.h('th', null, 'Família'), A.h('th', { class: 'num' }, 'Água/dia'), A.h('th', { class: 'num' }, 'Comida/dia'), A.h('th', null, ''))),
          A.h(
            'tbody',
            null,
            pt.familias.map((f, i) => {
              const a = agua.porFamilia[i];
              const c = comida.porFamilia[i];
              const motivos = prioridade(f);
              return A.h(
                'tr',
                null,
                A.h('td', null, A.h('strong', null, f.nome), A.h('br'), A.h('small', { class: 'ajuda' }, `${pessoas(f)} pessoa(s)`), motivos.length ? [A.h('br'), A.h('span', { class: 'tag precisa' }, `Prioridade: ${motivos.join(', ')}`)] : null),
                A.h('td', { class: 'num' }, `${A.fmt(a.porDia)} L`, A.h('br'), A.h('small', { class: 'ajuda' }, `${a.percentual}%`)),
                A.h('td', { class: 'num' }, `${A.fmt(c.porDia, 0)} kcal`, A.h('br'), A.h('small', { class: 'ajuda' }, `≈ ${A.fmt(c.porDia / 3500, 1)} kg · ${c.percentual}%`)),
                A.h('td', null, A.h('button', { type: 'button', class: 'mini secundario', dataset: { removerFamilia: f.id }, 'aria-label': `Remover ${f.nome}` }, '✕')),
              );
            }),
          ),
        ),
        A.h('p', { class: 'ajuda' }, '“≈ kg” é o equivalente em alimentos secos (arroz, feijão, macarrão). Água por dia inclui beber e higiene mínima.'),
      ),
    );
  }

  // ============================================================== registro

  (S.extensoes = S.extensoes || []).push({
    padrao,
    mesclar,
    montar(api) {
      A = api;
      montarMapa();
      montarDefesa();
      montarRemedios();
      montarPartilha();
      recarregarMapa();
    },
    render() {
      renderMapa();
      renderDefesa();
      renderRemedios();
      renderPartilha();
    },
    recarregar() {
      recarregarMapa();
      recarregarDefesa();
      recarregarPartilha();
    },
    navegar(secao, sub) {
      if (secao !== 'mapa' || !CATEGORIAS_BUSCA.includes(sub)) return false;
      A.estado.mapa.busca = sub;
      A.salvar();
      renderBusca();
      A.$('#resultado-busca').scrollIntoView({ block: 'start' });
      return true; // a rolagem já foi feita
    },
  });

  function recarregarMapa() {
    A.$('#base-nome').value = A.estado.mapa.base.nome;
    A.$('#base-coord').value = textoCoord(A.estado.mapa.base);
  }

})();
