/**
 * Aba Mapa da cidade (Hortolândia), sem internet: ruas, bairros, rios, locais
 * úteis, os pontos marcados pela comunidade, a base, a posição do aparelho e
 * rotas a pé que desviam dos perigos. Os dados (dados/mapa-hortolandia.js) só
 * são carregados quando a aba é aberta.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const C = S.cartografia;
  const M = S.mapa;
  const ARQUIVO_DADOS = 'dados/mapa-hortolandia.js';
  const PPM_MIN = 0.012;
  const PPM_MAX = 10;
  const BLOCO = 1500; // metros: as ruas são desenhadas por blocos visíveis
  const LETRAS = { farmacia: 'F', hospital: 'H', posto: '+', mercado: 'M', feira: 'M', torneira: 'A', nascente: 'A', poco: 'A', cisterna: 'A', igreja: 'I', escola: 'E', casa_apoio: 'C', gas: 'G', combustivel: 'P', ferragens: 'Fe' };
  const CAMADAS = [
    ['remedio', 'Saúde e remédios'],
    ['alimento', 'Alimentos'],
    ['agua', 'Água'],
    ['abrigo', 'Igrejas e escolas'],
    ['material', 'Gás, combustível e ferragens'],
    ['meus', 'Meus pontos e perigos'],
    ['bairros', 'Nomes dos bairros'],
    ['quadricula', 'Quadrículas de 1 km'],
  ];

  let A = null;
  let cidade = null;
  let carregando = null;
  let caminhos = null;
  let pedido = 0;
  let vistaPronta = false;
  const vista = { cx: 0, cy: 0, ppm: 0.05 };
  let selecionado = null; // {lat, lon, titulo, sub, local?, ponto?}
  let rotaAtual = null;
  let ruaDestacada = null;
  const medidas = new Map();

  // ------------------------------------------------------------ dados
  function carregar() {
    if (cidade) return Promise.resolve(cidade);
    if (carregando) return carregando;
    carregando = new Promise((resolver, rejeitar) => {
      const pronto = () => {
        try {
          cidade = C.criarCidade(S.dadosMapaCidade);
          montarCaminhos();
          resolver(cidade);
        } catch (e) {
          rejeitar(e);
        }
      };
      if (S.dadosMapaCidade) {
        pronto();
        return;
      }
      const s = document.createElement('script');
      s.src = ARQUIVO_DADOS;
      s.onload = pronto;
      s.onerror = () => rejeitar(new Error('Não consegui abrir o arquivo do mapa (dados/mapa-hortolandia.js).'));
      document.body.appendChild(s);
    });
    carregando.catch(() => (carregando = null));
    return carregando;
  }

  function montarCaminhos() {
    const X = cidade.nos.x;
    const Y = cidade.nos.y;
    const porClasse = C.CLASSES.map(() => new Map());
    const comNome = [];
    cidade.vias.forEach((v) => {
      const [x0, y0, x1, y1] = v.caixa;
      const chave = `${Math.floor((x0 + x1) / 2 / BLOCO)},${Math.floor((y0 + y1) / 2 / BLOCO)}`;
      let bloco = porClasse[v.classe].get(chave);
      if (!bloco) porClasse[v.classe].set(chave, (bloco = { caminho: new Path2D(), caixa: [Infinity, Infinity, -Infinity, -Infinity] }));
      bloco.caminho.moveTo(X[v.nos[0]], Y[v.nos[0]]);
      const acum = new Float64Array(v.nos.length);
      for (let j = 1; j < v.nos.length; j++) {
        bloco.caminho.lineTo(X[v.nos[j]], Y[v.nos[j]]);
        acum[j] = acum[j - 1] + Math.hypot(X[v.nos[j]] - X[v.nos[j - 1]], Y[v.nos[j]] - Y[v.nos[j - 1]]);
      }
      v.acum = acum; // distância acumulada, para posicionar o nome da rua
      bloco.caixa = [Math.min(bloco.caixa[0], x0), Math.min(bloco.caixa[1], y0), Math.max(bloco.caixa[2], x1), Math.max(bloco.caixa[3], y1)];
      if (v.nome) comNome.push(v);
    });
    comNome.sort((a, b) => a.classe - b.classe || b.comprimento - a.comprimento);
    const forma = (lista, fechar) => {
      const p = new Path2D();
      for (const f of lista) {
        const pts = f.pontos;
        p.moveTo(pts[0], pts[1]);
        for (let i = 2; i < pts.length; i += 2) p.lineTo(pts[i], pts[i + 1]);
        if (fechar) p.closePath();
      }
      return p;
    };
    const limite = cidade.limite.flatMap((f) => {
      const xs = [];
      const ys = [];
      for (let i = 0; i < f.pontos.length; i += 2) {
        xs.push(f.pontos[i]);
        ys.push(f.pontos[i + 1]);
      }
      return [[Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]];
    });
    caminhos = {
      porClasse: porClasse.map((m) => [...m.values()]),
      comNome,
      rios: forma(cidade.rios, false),
      lagos: forma(cidade.lagos, true),
      verdes: forma(cidade.verdes, true),
      ferrovias: forma(cidade.ferrovias, false),
      limite: forma(cidade.limite, true),
      caixaMunicipio: limite.reduce((a, c) => [Math.min(a[0], c[0]), Math.min(a[1], c[1]), Math.max(a[2], c[2]), Math.max(a[3], c[3])], [Infinity, Infinity, -Infinity, -Infinity]),
    };
  }

  // ------------------------------------------------------------ vista
  const tela = () => A.$('#tela-cidade');

  function tamanho() {
    const c = tela();
    return { W: c.clientWidth, H: c.clientHeight };
  }

  function ajustarParaCaixa([x0, y0, x1, y1], margem = 1.08) {
    const { W, H } = tamanho();
    if (!W || !H) return;
    vista.cx = (x0 + x1) / 2;
    vista.cy = (y0 + y1) / 2;
    vista.ppm = limitar(Math.min(W / ((x1 - x0) * margem || 1), H / ((y1 - y0) * margem || 1)));
  }

  function limitar(ppm) {
    return Math.max(PPM_MIN, Math.min(PPM_MAX, ppm));
  }

  function vistaInicial() {
    const b = A.estado.mapa.base;
    if (A.coordValida(b.lat, b.lon) && cidade.dentroDaArea(b.lat, b.lon)) {
      const p = cidade.projetar(b.lat, b.lon);
      vista.cx = p.x;
      vista.cy = p.y;
      vista.ppm = 0.45;
    } else ajustarParaCaixa(caminhos.caixaMunicipio);
    vistaPronta = true;
  }

  function centrar(lat, lon, ppm) {
    const p = cidade.projetar(lat, lon);
    vista.cx = p.x;
    vista.cy = p.y;
    if (ppm) vista.ppm = limitar(ppm);
    agendar();
  }

  function paraMundo(sx, sy) {
    const { W, H } = tamanho();
    return { x: vista.cx + (sx - W / 2) / vista.ppm, y: vista.cy + (sy - H / 2) / vista.ppm };
  }

  function paraTela(x, y) {
    const { W, H } = tamanho();
    return { x: (x - vista.cx) * vista.ppm + W / 2, y: (y - vista.cy) * vista.ppm + H / 2 };
  }

  function zoomEm(fator, sx, sy) {
    const antes = paraMundo(sx, sy);
    vista.ppm = limitar(vista.ppm * fator);
    const { W, H } = tamanho();
    vista.cx = antes.x - (sx - W / 2) / vista.ppm;
    vista.cy = antes.y - (sy - H / 2) / vista.ppm;
    agendar();
  }

  function agendar() {
    if (!pedido) pedido = requestAnimationFrame(desenhar);
  }

  // ------------------------------------------------------------ cores
  function cores() {
    const css = getComputedStyle(document.documentElement);
    const v = (n) => css.getPropertyValue(n).trim();
    return {
      fundo: v('--mapa-fundo'),
      rua: v('--mapa-rua'),
      bordaRua: v('--mapa-borda-rua'),
      avenida: v('--mapa-avenida'),
      rodovia: v('--mapa-rodovia'),
      caminho: v('--mapa-caminho'),
      agua: v('--mapa-agua'),
      rio: v('--mapa-rio'),
      verde: v('--mapa-verde'),
      ferrovia: v('--mapa-ferrovia'),
      limite: v('--mapa-limite'),
      texto: v('--mapa-texto'),
      textoSuave: v('--texto-suave'),
      halo: v('--mapa-halo'),
      rota: v('--mapa-rota'),
      eu: v('--mapa-eu'),
      grade: v('--mapa-quadricula'),
      perigo: v('--cat-perigo'),
      zona: v('--zona-perigo'),
      cat: { agua: v('--cat-agua'), remedio: v('--cat-remedio'), alimento: v('--cat-alimento'), abrigo: v('--cat-abrigo'), material: v('--cat-material'), perigo: v('--cat-perigo') },
    };
  }

  // ------------------------------------------------------------ desenho
  function desenhar() {
    pedido = 0;
    const canvas = tela();
    if (!cidade || !canvas || !A.$('#cidade').classList.contains('ativa')) return;
    const { W, H } = tamanho();
    if (!W || !H) return;
    if (!vistaPronta) vistaInicial();
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const lw = Math.max(1, Math.round(rect.width * dpr));
    const lh = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width !== lw || canvas.height !== lh) {
      canvas.width = lw;
      canvas.height = lh;
    }
    const k = lw / W;
    const ctx = canvas.getContext('2d');
    const cor = cores();
    const ppm = vista.ppm;
    const camadas = A.estado.cidade.camadas;
    const mundo = () => ctx.setTransform(k * ppm, 0, 0, k * ppm, k * (W / 2 - vista.cx * ppm), k * (H / 2 - vista.cy * ppm));
    const telaT = () => ctx.setTransform(k, 0, 0, k, 0, 0);
    const vis = [vista.cx - W / 2 / ppm, vista.cy - H / 2 / ppm, vista.cx + W / 2 / ppm, vista.cy + H / 2 / ppm];
    const cruza = (c, folga = 0) => c[2] >= vis[0] - folga && c[0] <= vis[2] + folga && c[3] >= vis[1] - folga && c[1] <= vis[3] + folga;
    const px = (n) => n / ppm;

    telaT();
    ctx.fillStyle = cor.fundo;
    ctx.fillRect(0, 0, W, H);
    mundo();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.fillStyle = cor.verde;
    ctx.fill(caminhos.verdes);
    ctx.fillStyle = cor.agua;
    ctx.fill(caminhos.lagos);
    ctx.strokeStyle = cor.rio;
    ctx.lineWidth = px(Math.max(1, Math.min(4, 0.8 + ppm)));
    ctx.stroke(caminhos.rios);

    // Ruas: primeiro as bordas, depois o miolo; as menores embaixo.
    const zoom = Math.max(1, Math.min(7, Math.sqrt(ppm / 0.2)));
    const estilos = [
      { cor: cor.rodovia, w: 2.6 },
      { cor: cor.avenida, w: 2.2 },
      { cor: cor.avenida, w: 1.6 },
      { cor: cor.rua, w: 1.1, min: 0.03 },
      { cor: cor.rua, w: 0.8, min: 0.3 },
      { cor: cor.caminho, w: 0.7, min: 0.5, tracejado: true },
    ];
    const visiveis = estilos.map((e, c) => (ppm >= (e.min || 0) ? caminhos.porClasse[c].filter((b) => cruza(b.caixa, 50)) : []));
    if (ppm >= 0.25) {
      ctx.strokeStyle = cor.bordaRua;
      for (let c = 4; c >= 0; c--) {
        ctx.lineWidth = px(estilos[c].w * zoom + 1.6);
        for (const b of visiveis[c]) ctx.stroke(b.caminho);
      }
    }
    for (let c = 5; c >= 0; c--) {
      const e = estilos[c];
      ctx.strokeStyle = e.cor;
      ctx.lineWidth = px(Math.max(0.6, e.w * zoom));
      ctx.setLineDash(e.tracejado ? [px(3), px(3)] : []);
      for (const b of visiveis[c]) ctx.stroke(b.caminho);
    }
    ctx.setLineDash([px(6), px(4)]);
    ctx.strokeStyle = cor.ferrovia;
    ctx.lineWidth = px(1.5);
    ctx.stroke(caminhos.ferrovias);
    ctx.setLineDash([px(10), px(6)]);
    ctx.strokeStyle = cor.limite;
    ctx.lineWidth = px(2);
    ctx.stroke(caminhos.limite);
    ctx.setLineDash([]);

    // Rua buscada e rota.
    if (ruaDestacada) {
      ctx.strokeStyle = cor.rota;
      ctx.globalAlpha = 0.45;
      ctx.lineWidth = px(9);
      const X = cidade.nos.x;
      const Y = cidade.nos.y;
      ctx.beginPath();
      for (const v of cidade.vias) {
        if (v.nome !== ruaDestacada) continue;
        ctx.moveTo(X[v.nos[0]], Y[v.nos[0]]);
        for (let j = 1; j < v.nos.length; j++) ctx.lineTo(X[v.nos[j]], Y[v.nos[j]]);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (rotaAtual) {
      const p = new Path2D();
      rotaAtual.pontos.forEach((c, i) => {
        const q = cidade.projetar(c.lat, c.lon);
        if (i) p.lineTo(q.x, q.y);
        else p.moveTo(q.x, q.y);
      });
      ctx.strokeStyle = cor.halo;
      ctx.lineWidth = px(8);
      ctx.stroke(p);
      ctx.strokeStyle = cor.rota;
      ctx.lineWidth = px(5);
      ctx.stroke(p);
    }

    // Zonas de perigo (em metros).
    const meus = camadas.meus ? A.estado.mapa.pontos.filter((p) => A.coordValida(p.lat, p.lon)) : [];
    for (const p of meus) {
      if (p.categoria !== 'perigo' || p.status === 'resolvido') continue;
      const q = cidade.projetar(p.lat, p.lon);
      ctx.beginPath();
      ctx.arc(q.x, q.y, p.raio || 150, 0, 2 * Math.PI);
      ctx.fillStyle = cor.zona;
      ctx.fill();
      ctx.setLineDash([px(5), px(4)]);
      ctx.strokeStyle = cor.perigo;
      ctx.lineWidth = px(1.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // ---- daqui em diante, em pixels da tela
    telaT();
    const ocupado = [];
    const livre = (b) => b[0] >= 0 && b[1] >= 0 && b[2] <= W && b[3] <= H && !ocupado.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1]);

    if (camadas.quadricula) desenharQuadricula(ctx, W, H, cor, ocupado);

    // Locais do mapa.
    const locaisVisiveis = cidade.locais.filter((l) => camadas[l.categoria]);
    for (const l of locaisVisiveis) {
      const s = paraTela(l.x, l.y);
      if (s.x < -10 || s.y < -10 || s.x > W + 10 || s.y > H + 10) continue;
      ctx.fillStyle = cor.cat[l.categoria];
      if (ppm < 0.1) {
        ctx.beginPath();
        ctx.arc(s.x, s.y, 2.5, 0, 2 * Math.PI);
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = cor.halo;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = '700 10px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(LETRAS[l.tipo] || '•', s.x, s.y + 0.5);
      ocupado.push([s.x - 9, s.y - 9, s.x + 9, s.y + 9]);
    }

    // Meus pontos (menos as zonas, já desenhadas) e a base.
    for (const p of meus) {
      const q = cidade.projetar(p.lat, p.lon);
      const s = paraTela(q.x, q.y);
      if (s.x < -20 || s.y < -20 || s.x > W + 20 || s.y > H + 20) continue;
      ctx.fillStyle = cor.cat[p.categoria] || cor.texto;
      ctx.strokeStyle = cor.halo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (p.categoria === 'perigo') {
        ctx.moveTo(s.x, s.y - 10);
        ctx.lineTo(s.x + 10, s.y + 8);
        ctx.lineTo(s.x - 10, s.y + 8);
        ctx.closePath();
      } else ctx.rect(s.x - 8, s.y - 8, 16, 16);
      ctx.fill();
      ctx.stroke();
      ocupado.push([s.x - 10, s.y - 10, s.x + 10, s.y + 10]);
      if (ppm >= 0.25) rotular(ctx, p.nome, s.x + 12, s.y, cor, ocupado, livre, 'left', '600 11px system-ui, sans-serif');
    }
    const b = A.estado.mapa.base;
    if (A.coordValida(b.lat, b.lon)) {
      const q = cidade.projetar(b.lat, b.lon);
      const s = paraTela(q.x, q.y);
      ctx.fillStyle = cor.texto;
      ctx.strokeStyle = cor.halo;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y - 13);
      ctx.lineTo(s.x + 10, s.y - 4);
      ctx.lineTo(s.x + 10, s.y + 9);
      ctx.lineTo(s.x - 10, s.y + 9);
      ctx.lineTo(s.x - 10, s.y - 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ocupado.push([s.x - 12, s.y - 14, s.x + 12, s.y + 11]);
      rotular(ctx, `Base: ${b.nome}`, s.x + 14, s.y, cor, ocupado, livre, 'left', '700 12px system-ui, sans-serif');
    }

    // Posição do aparelho e direção da bússola.
    const pos = S.sensores && S.sensores.posicao;
    if (pos) {
      const q = cidade.projetar(pos.lat, pos.lon);
      const s = paraTela(q.x, q.y);
      ctx.fillStyle = cor.eu;
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.arc(s.x, s.y, Math.max(8, (pos.precisao || 20) * ppm), 0, 2 * Math.PI);
      ctx.fill();
      ctx.globalAlpha = 1;
      const rumo = S.sensores.rumo;
      if (Number.isFinite(rumo)) {
        const r = ((rumo - 90) * Math.PI) / 180;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.arc(s.x, s.y, 42, r - 0.35, r + 0.35);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.beginPath();
      ctx.arc(s.x, s.y, 7, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ocupado.push([s.x - 9, s.y - 9, s.x + 9, s.y + 9]);
    }

    // Escolhido.
    if (selecionado) {
      const q = cidade.projetar(selecionado.lat, selecionado.lon);
      const s = paraTela(q.x, q.y);
      ctx.strokeStyle = cor.halo;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 12, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.strokeStyle = cor.rota;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(s.x - 5, s.y);
      ctx.lineTo(s.x + 5, s.y);
      ctx.moveTo(s.x, s.y - 5);
      ctx.lineTo(s.x, s.y + 5);
      ctx.stroke();
    }

    // Nomes: bairros de longe, ruas de perto.
    if (ppm < 0.6) {
      if (camadas.bairros) rotularBairros(ctx, cor, ocupado, livre);
      rotularRuas(ctx, cor, ocupado, livre, cruza);
    } else {
      rotularRuas(ctx, cor, ocupado, livre, cruza);
      if (camadas.bairros) rotularBairros(ctx, cor, ocupado, livre);
    }
    if (ppm >= 1.2) {
      for (const l of locaisVisiveis) {
        if (l.semNome) continue;
        const s = paraTela(l.x, l.y);
        if (s.x < 0 || s.y < 0 || s.x > W || s.y > H) continue;
        rotular(ctx, l.nome, s.x + 11, s.y, cor, ocupado, livre, 'left', '11px system-ui, sans-serif');
      }
    }

    // Norte, escala e fonte dos dados.
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = cor.texto;
    ctx.strokeStyle = cor.halo;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(22, 12);
    ctx.lineTo(29, 30);
    ctx.lineTo(22, 26);
    ctx.lineTo(15, 30);
    ctx.closePath();
    ctx.stroke();
    ctx.fill();
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.strokeText('N', 22, 41);
    ctx.fillText('N', 22, 41);
    const esc = cidade.escala(ppm, 110);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(12, H - 14);
    ctx.lineTo(12 + esc.pixels, H - 14);
    ctx.strokeStyle = cor.halo;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = cor.texto;
    ctx.beginPath();
    ctx.moveTo(12, H - 19);
    ctx.lineTo(12, H - 14);
    ctx.lineTo(12 + esc.pixels, H - 14);
    ctx.lineTo(12 + esc.pixels, H - 19);
    ctx.stroke();
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.lineWidth = 3;
    ctx.strokeStyle = cor.halo;
    ctx.strokeText(esc.texto, 16, H - 26);
    ctx.fillText(esc.texto, 16, H - 26);
    ctx.textAlign = 'right';
    ctx.font = '10px system-ui, sans-serif';
    ctx.strokeText('© OpenStreetMap', W - 6, H - 10);
    ctx.fillStyle = cor.textoSuave;
    ctx.fillText('© OpenStreetMap', W - 6, H - 10);
  }

  function medir(ctx, texto, fonte) {
    const chave = `${fonte}|${texto}`;
    let w = medidas.get(chave);
    if (w === undefined) {
      ctx.font = fonte;
      w = ctx.measureText(texto).width;
      if (medidas.size > 5000) medidas.clear();
      medidas.set(chave, w);
    }
    return w;
  }

  function rotular(ctx, texto, x, y, cor, ocupado, livre, alinhar, fonte) {
    const w = medir(ctx, texto, fonte);
    const x0 = alinhar === 'left' ? x : x - w / 2;
    const caixa = [x0 - 2, y - 8, x0 + w + 2, y + 8];
    if (!livre(caixa)) return false;
    ctx.font = fonte;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = cor.halo;
    ctx.strokeText(texto, x0, y);
    ctx.fillStyle = cor.texto;
    ctx.fillText(texto, x0, y);
    ocupado.push(caixa);
    return true;
  }

  function rotularBairros(ctx, cor, ocupado, livre) {
    const ppm = vista.ppm;
    if (ppm < 0.045 || ppm > 2.5) return;
    const fonte = '700 11px system-ui, sans-serif';
    for (const b of cidade.bairros) {
      const s = paraTela(b.x, b.y);
      const w = medir(ctx, b.nome, fonte);
      const caixa = [s.x - w / 2 - 3, s.y - 8, s.x + w / 2 + 3, s.y + 8];
      if (!livre(caixa)) continue;
      ctx.font = fonte;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = cor.halo;
      ctx.strokeText(b.nome, s.x, s.y);
      ctx.fillStyle = cor.textoSuave;
      ctx.fillText(b.nome, s.x, s.y);
      ocupado.push(caixa);
    }
  }

  /** Ponto a s metros do começo da rua. */
  function pontoNaVia(v, s, X, Y) {
    const acum = v.acum;
    let j = 1;
    while (j < acum.length - 1 && acum[j] < s) j++;
    const a = v.nos[j - 1];
    const b = v.nos[j];
    const seg = acum[j] - acum[j - 1] || 1;
    const t = Math.max(0, Math.min(1, (s - acum[j - 1]) / seg));
    return [X[a] + t * (X[b] - X[a]), Y[a] + t * (Y[b] - Y[a])];
  }

  /**
   * Trecho de comprimento L (metros) quase reto ao longo da rua, para o nome:
   * tenta o meio, depois um quarto e três quartos. Devolve [x0, y0, x1, y1] ou null.
   */
  function trechoParaRotulo(v, L, tolerancia, X, Y) {
    const total = v.comprimento;
    if (total < L) return null;
    for (const f of [0.5, 0.28, 0.72]) {
      const s0 = Math.max(0, Math.min(total - L, total * f - L / 2));
      const s1 = s0 + L;
      const [ax, ay] = pontoNaVia(v, s0, X, Y);
      const [bx, by] = pontoNaVia(v, s1, X, Y);
      const dx = bx - ax;
      const dy = by - ay;
      const comp = Math.hypot(dx, dy) || 1;
      let reto = comp >= L * 0.9;
      for (let j = 1; reto && j < v.nos.length - 1; j++) {
        if (v.acum[j] <= s0 || v.acum[j] >= s1) continue;
        const n = v.nos[j];
        if (Math.abs((X[n] - ax) * dy - (Y[n] - ay) * dx) / comp > tolerancia) reto = false;
      }
      if (reto) return [ax, ay, bx, by];
    }
    return null;
  }

  function rotularRuas(ctx, cor, ocupado, livre, cruza) {
    const ppm = vista.ppm;
    if (ppm < 0.18) return;
    const fonte = ppm >= 1.5 ? '12px system-ui, sans-serif' : '11px system-ui, sans-serif';
    const X = cidade.nos.x;
    const Y = cidade.nos.y;
    const feitos = new Map();
    let n = 0;
    for (const v of caminhos.comNome) {
      if (v.classe >= 3 && ppm < 0.45) continue;
      if (v.classe >= 4 && ppm < 1.2) continue;
      if (!cruza(v.caixa)) continue;
      const w = medir(ctx, v.nome, fonte);
      const trecho = trechoParaRotulo(v, (w + 14) / ppm, 3.5 / ppm, X, Y);
      if (!trecho) continue;
      const a = paraTela(trecho[0], trecho[1]);
      const b = paraTela(trecho[2], trecho[3]);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      let ang = Math.atan2(b.y - a.y, b.x - a.x);
      if (ang > Math.PI / 2) ang -= Math.PI;
      if (ang < -Math.PI / 2) ang += Math.PI;
      const hw = w / 2 + 3;
      const hh = 7;
      const cx = Math.abs(Math.cos(ang));
      const sy = Math.abs(Math.sin(ang));
      const ex = hw * cx + hh * sy;
      const ey = hw * sy + hh * cx;
      const caixa = [mx - ex, my - ey, mx + ex, my + ey];
      if (!livre(caixa)) continue;
      const antes = feitos.get(v.nome);
      if (antes && antes.some(([x, y]) => Math.hypot(x - mx, y - my) < 260)) continue;
      ctx.save();
      ctx.translate(mx, my);
      ctx.rotate(ang);
      ctx.font = fonte;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 3;
      ctx.strokeStyle = cor.halo;
      ctx.strokeText(v.nome, 0, 0);
      ctx.fillStyle = cor.texto;
      ctx.fillText(v.nome, 0, 0);
      ctx.restore();
      ocupado.push(caixa);
      if (antes) antes.push([mx, my]);
      else feitos.set(v.nome, [[mx, my]]);
      if (++n >= 160) break;
    }
  }

  function desenharQuadricula(ctx, W, H, cor, ocupado) {
    const q = cidade.quadricula;
    const t = q.tamanho;
    ctx.strokeStyle = cor.grade;
    ctx.lineWidth = 1;
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let c = 0; c <= q.colunas; c++) {
      const s = paraTela(q.origem.x + c * t, 0);
      if (s.x < -1 || s.x > W + 1) continue;
      ctx.beginPath();
      ctx.moveTo(s.x, 0);
      ctx.lineTo(s.x, H);
      ctx.stroke();
    }
    for (let l = 0; l <= q.linhas; l++) {
      const s = paraTela(0, q.origem.y + l * t);
      if (s.y < -1 || s.y > H + 1) continue;
      ctx.beginPath();
      ctx.moveTo(0, s.y);
      ctx.lineTo(W, s.y);
      ctx.stroke();
    }
    ctx.lineWidth = 3;
    for (let c = 0; c < q.colunas; c++) {
      const s = paraTela(q.origem.x + (c + 0.5) * t, 0);
      if (s.x < 40 || s.x > W - 10) continue;
      ctx.strokeStyle = cor.halo;
      ctx.strokeText(q.letra(c), s.x, 12);
      ctx.fillStyle = cor.texto;
      ctx.fillText(q.letra(c), s.x, 12);
      ocupado.push([s.x - 8, 4, s.x + 8, 20]);
    }
    for (let l = 0; l < q.linhas; l++) {
      const s = paraTela(0, q.origem.y + (l + 0.5) * t);
      if (s.y < 52 || s.y > H - 34) continue;
      ctx.strokeStyle = cor.halo;
      ctx.strokeText(String(l + 1), W - 14, s.y);
      ctx.fillStyle = cor.texto;
      ctx.fillText(String(l + 1), W - 14, s.y);
      ocupado.push([W - 24, s.y - 8, W - 4, s.y + 8]);
    }
  }

  // ------------------------------------------------------------ toque
  function aoTocar(sx, sy) {
    const camadas = A.estado.cidade.camadas;
    const perto = (lat, lon, raio) => {
      const q = cidade.projetar(lat, lon);
      const s = paraTela(q.x, q.y);
      return Math.hypot(s.x - sx, s.y - sy) <= raio;
    };
    let escolha = null;
    if (camadas.meus) {
      const p = A.estado.mapa.pontos.find((x) => A.coordValida(x.lat, x.lon) && perto(x.lat, x.lon, 16));
      if (p) escolha = { lat: p.lat, lon: p.lon, titulo: p.nome, sub: `${M.CATEGORIAS[p.categoria].tipos[p.tipo]} · ${rotuloStatus(p)} · meus pontos`, ponto: p };
    }
    if (!escolha && vista.ppm >= 0.1) {
      const l = cidade.locais.find((x) => camadas[x.categoria] && perto(x.lat, x.lon, 14));
      if (l) escolha = { lat: l.lat, lon: l.lon, titulo: l.nome, sub: `${C.CATEGORIAS[l.categoria].tipos[l.tipo]} · do mapa (OpenStreetMap)`, local: l };
    }
    if (!escolha) {
      const m = paraMundo(sx, sy);
      const c = cidade.desprojetar(m.x, m.y);
      escolha = { lat: c.lat, lon: c.lon, titulo: 'Lugar escolhido', sub: '' };
    }
    selecionar(escolha);
  }

  function rotuloStatus(p) {
    if (p.categoria === 'perigo') return p.status === 'resolvido' ? 'resolvido' : 'ativo';
    return (M.STATUS[p.status] || M.STATUS.desconhecido).rotulo.toLowerCase();
  }

  function selecionar(escolha) {
    selecionado = escolha;
    renderInfo();
    agendar();
  }

  function textoCoord(c) {
    return `${c.lat.toFixed(6)}, ${c.lon.toFixed(6)}`;
  }

  function origemDaRota() {
    const pos = S.sensores && S.sensores.posicaoRecente(300000);
    if (pos) return { lat: pos.lat, lon: pos.lon, rotulo: 'sua localização' };
    const b = A.estado.mapa.base;
    return A.coordValida(b.lat, b.lon) ? { lat: b.lat, lon: b.lon, rotulo: `a base (${b.nome})` } : null;
  }

  function renderInfo(mensagem) {
    const el = A.$('#info-cidade');
    if (!selecionado || !cidade) {
      A.trocar(el);
      return;
    }
    const s = selecionado;
    const d = cidade.descrever(s.lat, s.lon);
    const b = A.estado.mapa.base;
    const linhas = [];
    if (d.rua) linhas.push(A.h('li', null, d.rua.distancia > 25 ? `Perto da ${d.rua.nome} (a ${A.metros(d.rua.distancia)})` : d.rua.nome));
    if (d.bairro) linhas.push(A.h('li', null, `Bairro: ${d.bairro}`));
    if (d.quadrante) linhas.push(A.h('li', null, `Quadrícula ${d.quadrante}`));
    linhas.push(A.h('li', null, `Coordenadas: ${textoCoord(s)}`));
    if (A.coordValida(b.lat, b.lon)) {
      const dist = M.distanciaMetros(b, s);
      if (dist > 15) linhas.push(A.h('li', null, `A ${A.metros(dist)} da base, a ${M.direcao(M.rumoGraus(b, s))} (em linha reta)`));
    }
    if (!d.naArea) linhas.push(A.h('li', null, 'Fora da área do mapa: ruas e rotas não estão disponíveis aqui.'));
    const botao = (acao, texto, extra = {}) => A.h('button', { type: 'button', class: 'secundario', dataset: { acaoCidade: acao }, ...extra }, texto);
    const podeSalvar = s.local && M.CATEGORIAS[s.local.categoria];
    A.trocar(
      el,
      A.h(
        'div',
        { class: 'cartao info-cidade' },
        A.h('div', { class: 'topo-info' }, A.h('h3', null, s.titulo), A.h('button', { type: 'button', class: 'mini secundario', dataset: { acaoCidade: 'fechar' }, 'aria-label': 'Fechar' }, '✕')),
        s.sub ? A.h('p', { class: 'ajuda' }, s.sub) : null,
        A.h('ul', { class: 'lista-info' }, linhas),
        A.h(
          'div',
          { class: 'botoes' },
          d.naArea ? botao('rota', 'Rota a pé até aqui') : null,
          botao('bussola', 'Bússola até aqui'),
          s.ponto ? null : podeSalvar ? botao('salvar', 'Salvar nos meus pontos') : botao('marcar', 'Marcar um ponto aqui'),
          botao('base', 'Usar como base'),
          botao('copiar', 'Copiar coordenadas'),
        ),
        mensagem ? A.h('p', { class: 'ajuda', role: 'status' }, mensagem) : null,
      ),
    );
  }

  function tracarRota() {
    const origem = origemDaRota();
    if (!origem) {
      renderInfo('Para traçar a rota, defina a base ("Usar como base" num lugar do mapa) ou toque em "Onde estou".');
      return;
    }
    const perigos = A.estado.mapa.pontos.filter((p) => p.categoria === 'perigo');
    const r = cidade.rota(origem, selecionado, { perigos });
    if (!r) {
      renderInfo('Não achei ruas a menos de 600 m da origem ou do destino.');
      return;
    }
    rotaAtual = { ...r, origem: origem.rotulo, destino: selecionado.titulo === 'Lugar escolhido' ? 'o lugar escolhido' : selecionado.titulo };
    ruaDestacada = null;
    const xs = r.pontos.map((c) => cidade.projetar(c.lat, c.lon));
    ajustarParaCaixa([Math.min(...xs.map((p) => p.x)), Math.min(...xs.map((p) => p.y)), Math.max(...xs.map((p) => p.x)), Math.max(...xs.map((p) => p.y))], 1.25);
    renderRota();
    agendar();
  }

  function renderRota() {
    const el = A.$('#rota-cidade');
    if (!rotaAtual) {
      A.trocar(el);
      return;
    }
    const r = rotaAtual;
    A.trocar(
      el,
      A.h(
        'div',
        { class: 'cartao rota-cidade' },
        A.h('div', { class: 'topo-info' }, A.h('h3', null, 'Rota a pé'), A.h('button', { type: 'button', class: 'mini secundario', id: 'limpar-rota', 'aria-label': 'Apagar a rota' }, '✕')),
        A.h('p', null, A.h('strong', null, `${A.metros(r.distancia)} · cerca de ${r.minutos} min a pé`), ` — de ${r.origem} até ${r.destino}.`),
        r.aviso ? A.h('p', { class: 'aviso' }, `${r.aviso} Zona: ${r.perigos.join(', ')}.`) : null,
        r.pertoDePerigo.length ? A.h('p', { class: 'aviso aviso-leve' }, `Passa perto de: ${r.pertoDePerigo.join(', ')}. Atenção redobrada nesse trecho.`) : null,
        A.h('ol', { class: 'passos-rota' }, r.passos.map((p) => A.h('li', null, p.texto))),
        A.h('p', { class: 'ajuda' }, 'Calculada pelas ruas do mapa, desviando das zonas de perigo marcadas em Meus pontos. As ruas podem estar desatualizadas ou bloqueadas: marque um perigo novo e a rota passa a desviar dele.'),
      ),
    );
  }

  function aoAcao(acao) {
    const s = selecionado;
    if (!s && acao !== 'fechar') return;
    if (acao === 'fechar') {
      selecionado = null;
      renderInfo();
      agendar();
    } else if (acao === 'rota') tracarRota();
    else if (acao === 'bussola') S.apontarBussola && S.apontarBussola(s.lat, s.lon, s.titulo === 'Lugar escolhido' ? `${cidade.descrever(s.lat, s.lon).quadrante || ''} ${textoCoord(s)}`.trim() : s.titulo);
    else if (acao === 'salvar') {
      const l = s.local;
      const tipos = Object.keys(M.CATEGORIAS[l.categoria].tipos);
      A.estado.mapa.pontos.push({
        id: A.novoId(),
        nome: l.nome.slice(0, 60),
        categoria: l.categoria,
        tipo: tipos.includes(l.tipo) ? l.tipo : tipos[0],
        status: 'desconhecido',
        lat: Math.round(l.lat * 1e6) / 1e6,
        lon: Math.round(l.lon * 1e6) / 1e6,
        referencia: 'Do mapa da cidade (OpenStreetMap)',
        obs: '',
        raio: 150,
        verificadoEm: null,
      });
      A.salvar();
      A.renderizar('mapa', 'bussola');
      selecionado = { ...s, local: null, ponto: A.estado.mapa.pontos[A.estado.mapa.pontos.length - 1], sub: `${s.sub.split(' · ')[0]} · salvo em Meus pontos (não verificado)` };
      renderInfo('Salvo em Meus pontos. Confirme a situação quando alguém passar lá.');
      agendar();
    } else if (acao === 'marcar') {
      A.$('#ponto-coord').value = textoCoord(s);
      location.hash = 'mapa';
      setTimeout(() => {
        const nome = A.$('#ponto-nome');
        nome.scrollIntoView({ block: 'center' });
        nome.focus();
      }, 60);
    } else if (acao === 'base') {
      const b = A.estado.mapa.base;
      b.lat = Math.round(s.lat * 1e6) / 1e6;
      b.lon = Math.round(s.lon * 1e6) / 1e6;
      A.$('#base-coord').value = `${b.lat.toFixed(5)}, ${b.lon.toFixed(5)}`;
      A.salvar();
      A.renderizar('mapa', 'bussola');
      renderInfo(`Base (${b.nome}) definida aqui. As distâncias, a bússola e as rotas passam a partir dela.`);
      agendar();
    } else if (acao === 'copiar') {
      A.copiarTexto(
        textoCoord(s),
        null,
        () => renderInfo('Coordenadas copiadas.'),
        () => renderInfo(`Copie: ${textoCoord(s)}`),
      );
    }
  }

  // ------------------------------------------------------------ busca
  function renderBusca() {
    const lista = A.$('#resultados-cidade');
    const texto = A.$('#busca-cidade').value;
    if (!cidade || texto.trim().length < 2) {
      A.trocar(lista);
      return;
    }
    const achados = cidade.buscar(texto, 8);
    A.trocar(
      lista,
      achados.length
        ? achados.map((r, i) => A.h('li', null, A.h('button', { type: 'button', class: 'resultado', dataset: { resultado: i } }, A.h('strong', null, r.nome), A.h('small', null, ` · ${r.rotulo}`))))
        : A.h('li', { class: 'ajuda' }, 'Nada encontrado. Tente só uma parte do nome.'),
    );
    lista.achados = achados;
  }

  function escolherResultado(r) {
    A.$('#busca-cidade').value = '';
    A.trocar(A.$('#resultados-cidade'));
    ruaDestacada = r.tipo === 'rua' ? r.nome : null;
    const ppm = { rua: 0.9, local: 2, bairro: 0.5, agua: 0.4 }[r.tipo] || 1;
    centrar(r.lat, r.lon, ppm);
    if (r.local) selecionar({ lat: r.lat, lon: r.lon, titulo: r.nome, sub: `${r.rotulo} · do mapa (OpenStreetMap)`, local: r.local });
    else selecionar({ lat: r.lat, lon: r.lon, titulo: r.nome, sub: r.rotulo });
  }

  // ------------------------------------------------------------ montagem
  function montarInteracao() {
    const canvas = tela();
    const ponteiros = new Map();
    let arrasto = null;
    let pinca = null;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      const f = r.width ? canvas.clientWidth / r.width : 1;
      return { x: (e.clientX - r.left) * f, y: (e.clientY - r.top) * f };
    };
    canvas.addEventListener('pointerdown', (e) => {
      if (!cidade) return;
      canvas.setPointerCapture(e.pointerId);
      ponteiros.set(e.pointerId, local(e));
      if (ponteiros.size === 1) arrasto = { inicio: local(e), cx: vista.cx, cy: vista.cy, moveu: false };
      else if (ponteiros.size === 2) {
        const [a, b] = [...ponteiros.values()];
        pinca = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, ppm: vista.ppm, meio: paraMundo((a.x + b.x) / 2, (a.y + b.y) / 2) };
        if (arrasto) arrasto.moveu = true;
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      if (!ponteiros.has(e.pointerId)) return;
      ponteiros.set(e.pointerId, local(e));
      if (ponteiros.size >= 2 && pinca) {
        const [a, b] = [...ponteiros.values()];
        vista.ppm = limitar((pinca.ppm * Math.hypot(a.x - b.x, a.y - b.y)) / pinca.dist);
        const m = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const { W, H } = tamanho();
        vista.cx = pinca.meio.x - (m.x - W / 2) / vista.ppm;
        vista.cy = pinca.meio.y - (m.y - H / 2) / vista.ppm;
        agendar();
      } else if (arrasto) {
        const p = local(e);
        const dx = p.x - arrasto.inicio.x;
        const dy = p.y - arrasto.inicio.y;
        if (Math.hypot(dx, dy) > 6) arrasto.moveu = true;
        if (arrasto.moveu) {
          vista.cx = arrasto.cx - dx / vista.ppm;
          vista.cy = arrasto.cy - dy / vista.ppm;
          agendar();
        }
      }
    });
    const soltar = (e) => {
      if (!ponteiros.has(e.pointerId)) return;
      const p = local(e);
      ponteiros.delete(e.pointerId);
      if (ponteiros.size < 2) pinca = null;
      if (ponteiros.size === 0) {
        if (arrasto && !arrasto.moveu && e.type === 'pointerup') aoTocar(p.x, p.y);
        arrasto = null;
      } else if (ponteiros.size === 1) {
        const [q] = [...ponteiros.values()];
        arrasto = { inicio: q, cx: vista.cx, cy: vista.cy, moveu: true };
      }
    };
    canvas.addEventListener('pointerup', soltar);
    canvas.addEventListener('pointercancel', soltar);
    canvas.addEventListener(
      'wheel',
      (e) => {
        if (!cidade) return;
        e.preventDefault();
        const p = local(e);
        zoomEm(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
      },
      { passive: false },
    );
    canvas.addEventListener('dblclick', (e) => {
      if (!cidade) return;
      const p = local(e);
      zoomEm(2, p.x, p.y);
    });
    canvas.addEventListener('keydown', (e) => {
      if (!cidade) return;
      const passo = 80 / vista.ppm;
      const { W, H } = tamanho();
      const acoes = {
        ArrowLeft: () => (vista.cx -= passo),
        ArrowRight: () => (vista.cx += passo),
        ArrowUp: () => (vista.cy -= passo),
        ArrowDown: () => (vista.cy += passo),
        '+': () => zoomEm(1.5, W / 2, H / 2),
        '=': () => zoomEm(1.5, W / 2, H / 2),
        '-': () => zoomEm(1 / 1.5, W / 2, H / 2),
        Enter: () => aoTocar(W / 2, H / 2),
      };
      if (!acoes[e.key]) return;
      e.preventDefault();
      acoes[e.key]();
      agendar();
    });
    const centroTela = () => {
      const { W, H } = tamanho();
      return [W / 2, H / 2];
    };
    A.$('#zoom-mais').addEventListener('click', () => zoomEm(1.6, ...centroTela()));
    A.$('#zoom-menos').addEventListener('click', () => zoomEm(1 / 1.6, ...centroTela()));
    A.$('#zoom-tudo').addEventListener('click', () => {
      if (!cidade) return;
      ajustarParaCaixa(caminhos.caixaMunicipio);
      agendar();
    });
    if (typeof ResizeObserver === 'function') new ResizeObserver(() => agendar()).observe(canvas);
    window.addEventListener('resize', agendar);
    new MutationObserver(agendar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
  }

  function renderCamadas() {
    const c = A.estado.cidade.camadas;
    A.trocar(
      A.$('#camadas-cidade'),
      CAMADAS.map(([id, rotulo]) =>
        A.h(
          'label',
          { class: 'linha' },
          A.h('input', { type: 'checkbox', dataset: { camada: id }, checked: Boolean(c[id]) }),
          C.CATEGORIAS[id] ? A.h('span', { class: `ponto-cat cat-${id}`, 'aria-hidden': 'true' }) : null,
          ` ${rotulo}`,
        ),
      ),
    );
  }

  function renderLegenda() {
    const item = (classe, texto) => A.h('li', null, A.h('span', { class: `legenda-simbolo ${classe}`, 'aria-hidden': 'true' }), ` ${texto}`);
    const letras = Object.entries(C.CATEGORIAS).flatMap(([cat, c]) =>
      Object.entries(c.tipos).map(([tipo, rotulo]) => A.h('li', null, A.h('span', { class: `legenda-letra cat-${cat}`, 'aria-hidden': 'true' }, LETRAS[tipo]), ` ${rotulo}`)),
    );
    A.trocar(
      A.$('#legenda-cidade'),
      A.h('ul', { class: 'legenda-mapa' }, [
        item('leg-avenida', 'Avenida ou rodovia'),
        item('leg-rua', 'Rua'),
        item('leg-caminho', 'Caminho a pé'),
        item('leg-rio', 'Rio ou córrego'),
        item('leg-ferrovia', 'Ferrovia'),
        item('leg-limite', 'Limite do município'),
        item('leg-rota', 'Rota a pé'),
        item('leg-eu', 'Você (GPS)'),
        item('leg-base', 'Base'),
        item('leg-meu', 'Meu ponto (quadrado) ou perigo (triângulo)'),
        ...letras,
      ]),
    );
  }

  function render() {
    if (!A) return;
    if (selecionado && selecionado.ponto && !A.estado.mapa.pontos.includes(selecionado.ponto)) selecionado = null;
    agendar();
  }

  function abrir() {
    const aviso = A.$('#carregando-mapa');
    aviso.hidden = false;
    aviso.textContent = 'Carregando o mapa…';
    carregar().then(
      () => {
        aviso.hidden = true;
        A.$('#fonte-cidade').textContent = `${cidade.fonte}. Dados de ${A.dataBR(cidade.data)}: ruas, comércios e serviços podem ter mudado.`;
        renderBusca();
        agendar();
      },
      (e) => {
        aviso.textContent = e.message;
      },
    );
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'cidade',
    padrao: () => ({ cidade: { camadas: Object.fromEntries(CAMADAS.map(([id]) => [id, id !== 'quadricula'])) } }),
    mesclar(dados, r) {
      const d = dados.cidade && typeof dados.cidade === 'object' && dados.cidade.camadas && typeof dados.cidade.camadas === 'object' ? dados.cidade.camadas : null;
      if (!d) return;
      for (const [id] of CAMADAS) if (typeof d[id] === 'boolean') r.cidade.camadas[id] = d[id];
    },
    montar(api) {
      A = api;
      montarInteracao();
      renderCamadas();
      renderLegenda();
      A.$('#camadas-cidade').addEventListener('change', (e) => {
        const id = e.target.dataset.camada;
        if (!id) return;
        A.estado.cidade.camadas[id] = e.target.checked;
        A.salvar();
        agendar();
      });
      A.$('#busca-cidade').addEventListener('input', renderBusca);
      A.$('#busca-cidade').addEventListener('keydown', (e) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        const l = A.$('#resultados-cidade').achados;
        if (l && l.length) escolherResultado(l[0]);
      });
      A.$('#resultados-cidade').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-resultado]');
        if (b) escolherResultado(A.$('#resultados-cidade').achados[Number(b.dataset.resultado)]);
      });
      A.$('#info-cidade').addEventListener('click', (e) => {
        const b = e.target.closest('button[data-acao-cidade]');
        if (b) aoAcao(b.dataset.acaoCidade);
      });
      A.$('#rota-cidade').addEventListener('click', (e) => {
        if (!e.target.closest('#limpar-rota')) return;
        rotaAtual = null;
        renderRota();
        agendar();
      });
      A.$('#onde-estou').addEventListener('click', () => {
        const msg = A.$('#msg-cidade');
        msg.textContent = 'Buscando a localização…';
        S.sensores.localizar().then(
          (p) => {
            msg.textContent = `Localização obtida (precisão de ~${Math.round(p.precisao)} m).`;
            if (!cidade) return;
            if (!cidade.dentroDaArea(p.lat, p.lon)) msg.textContent += ' Você está fora da área do mapa.';
            else centrar(p.lat, p.lon, Math.max(vista.ppm, 0.8));
            selecionar({ lat: p.lat, lon: p.lon, titulo: 'Você está aqui', sub: `Precisão de ~${Math.round(p.precisao)} m` });
          },
          (e) => (msg.textContent = e.message),
        );
      });
      A.$('#ir-base').addEventListener('click', () => {
        const b = A.estado.mapa.base;
        const msg = A.$('#msg-cidade');
        if (!A.coordValida(b.lat, b.lon)) {
          msg.textContent = 'A base ainda não foi definida. Toque num lugar do mapa e escolha "Usar como base".';
          return;
        }
        msg.textContent = '';
        if (cidade) centrar(b.lat, b.lon, Math.max(vista.ppm, 0.6));
      });
      A.$('#form-quadricula').addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = A.$('#msg-quadricula');
        if (!cidade) return;
        const codigo = A.$('#quadricula-ir').value.trim().toUpperCase();
        const c = cidade.centroQuadrante(codigo);
        if (!c) {
          msg.textContent = `Quadrícula não existe. Vai de A1 a ${cidade.quadricula.letra(cidade.quadricula.colunas - 1)}${cidade.quadricula.linhas}.`;
          return;
        }
        msg.textContent = '';
        A.estado.cidade.camadas.quadricula = true;
        renderCamadas();
        A.salvar();
        centrar(c.lat, c.lon, 0.35);
        selecionar({ lat: c.lat, lon: c.lon, titulo: `Quadrícula ${codigo}`, sub: 'Centro do quadrado de 1 km' });
        tela().scrollIntoView({ block: 'center' });
      });
      if (S.sensores) S.sensores.ouvir(() => agendar());
    },
    render,
    recarregar() {
      renderCamadas();
    },
    navegar(secao) {
      if (secao === 'cidade') abrir();
      return false;
    },
  });

  /** Usado por outras abas: mostra um lugar no mapa da cidade. */
  S.mostrarNaCidade = (lat, lon, titulo, sub = '') => {
    location.hash = 'cidade';
    carregar().then(() => {
      centrar(lat, lon, Math.max(vista.ppm, 1));
      vistaPronta = true;
      selecionar({ lat, lon, titulo, sub });
    });
  };
})();
