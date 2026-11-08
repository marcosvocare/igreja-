/**
 * Aba Bússola: sensor de direção do celular com correção para o norte verdadeiro,
 * guia até um ponto, marcar ponto pelo rumo, sol agora e métodos sem bússola.
 * Também cria S.sensores (posição e direção), usado pelo mapa da cidade.
 * Registra-se como extensão de app.js (carregar ANTES de app.js e de cidade.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  const B = S.bussola;
  const M = S.mapa;
  let A = null;

  // ------------------------------------------------------------ sensores
  const ouvintes = new Set();
  const avisar = (tipo) => ouvintes.forEach((f) => f(tipo));

  const sensores = {
    posicao: null, // {lat, lon, precisao, em}
    rumo: null, // para onde o topo do celular aponta (verdadeiro, se a correção estiver ligada)
    rumoMagnetico: null,
    precisaoRumo: null,
    bussolaLigada: false,
    ouvir(f) {
      ouvintes.add(f);
      return () => ouvintes.delete(f);
    },
    /** Posição atual (recente: até 2 min) ou null. */
    posicaoRecente(maxMs = 120000) {
      return this.posicao && Date.now() - this.posicao.em <= maxMs ? this.posicao : null;
    },
    localizar() {
      return new Promise((resolver, rejeitar) => {
        if (!navigator.geolocation) {
          rejeitar(new Error('Este navegador não informa a localização.'));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (p) => {
            sensores.posicao = { lat: p.coords.latitude, lon: p.coords.longitude, precisao: p.coords.accuracy, em: Date.now() };
            avisar('posicao');
            resolver(sensores.posicao);
          },
          (e) =>
            rejeitar(
              new Error(
                e && e.code === 1
                  ? 'O navegador não deu permissão para usar a localização.'
                  : 'Não consegui a localização. Sem internet, o GPS pode levar alguns minutos para achar os satélites: vá para um lugar aberto e tente de novo.',
              ),
            ),
          { enableHighAccuracy: true, timeout: 60000, maximumAge: 30000 },
        );
      });
    },
  };
  S.sensores = sensores;

  let magSuave = null;
  let leituras = 0;
  let quadro = 0;

  function aoGirar(e) {
    const angulo = (screen.orientation && screen.orientation.angle) || window.orientation || 0;
    const mag = B.rumoDoEvento(e, angulo);
    if (mag === null) return;
    if (++leituras === 1 && A) A.$('#estado-bussola').textContent = 'Bússola ligada. Segure o celular deitado, com a tela para cima, longe de metais e ímãs.';
    magSuave = B.suavizar(magSuave, mag, 0.3);
    sensores.rumoMagnetico = magSuave;
    sensores.precisaoRumo = Number.isFinite(e.webkitCompassAccuracy) && e.webkitCompassAccuracy >= 0 ? e.webkitCompassAccuracy : null;
    sensores.rumo = A && A.estado.bussola.verdadeiro ? B.paraVerdadeiro(magSuave, B.declinacaoEm()) : magSuave;
    if (!quadro) {
      quadro = requestAnimationFrame(() => {
        quadro = 0;
        avisar('rumo');
      });
    }
  }

  async function ligarBussola() {
    const msg = A.$('#estado-bussola');
    if (!('ondeviceorientationabsolute' in window) && !('ondeviceorientation' in window)) {
      msg.textContent = 'Este aparelho ou navegador não tem bússola. Use o sol ou os métodos abaixo.';
      return;
    }
    let negado = false;
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        negado = (await DeviceOrientationEvent.requestPermission()) !== 'granted';
      } catch (e) {
        negado = true;
      }
    }
    if (!sensores.bussolaLigada) {
      window.addEventListener('deviceorientationabsolute', aoGirar, true);
      window.addEventListener('deviceorientation', aoGirar, true);
      sensores.bussolaLigada = true;
    }
    A.$('#ligar-bussola').textContent = 'Bússola ligada';
    const antes = leituras;
    msg.textContent = negado
      ? 'O navegador não liberou o sensor de direção. Nas permissões do site, libere "Sensores de movimento" (Android) ou "Movimento e orientação" (iPhone) e toque de novo.'
      : 'Bússola ligada. Segure o celular deitado, com a tela para cima, longe de metais e ímãs.';
    setTimeout(() => {
      if (leituras === antes) msg.textContent = 'O aparelho não mandou a direção. Ele pode não ter bússola, ou o navegador não a libera aqui. Use o sol ou os métodos abaixo.';
    }, 3000);
  }

  // ------------------------------------------------------------ desenho
  function montarRosa() {
    const s = A.svg;
    const marcas = [];
    for (let g = 0; g < 360; g += 10) {
      const longa = g % 30 === 0;
      marcas.push(s('line', { x1: 0, y1: -100, x2: 0, y2: longa ? -88 : -94, class: longa ? 'marca longa' : 'marca', transform: `rotate(${g})` }));
      if (longa && g % 90 !== 0) marcas.push(s('text', { x: 0, y: -74, class: 'grau', transform: `rotate(${g})` }, String(g)));
    }
    const letras = [['N', 0], ['L', 90], ['S', 180], ['O', 270]].map(([l, g]) => s('text', { x: 0, y: -68, class: l === 'N' ? 'letra norte' : 'letra', transform: `rotate(${g})` }, l));
    A.trocar(
      A.$('#rosa-bussola'),
      [
        s('circle', { r: 108, class: 'aro' }),
        s('g', { id: 'rosa-gira' }, marcas, letras),
        s('g', { id: 'seta-alvo', class: 'seta-alvo', display: 'none' }, s('path', { d: 'M0,-60 L12,-30 L4,-30 L4,30 L-4,30 L-4,-30 L-12,-30 Z' })),
        s('path', { d: 'M0,-118 L-8,-102 L8,-102 Z', class: 'indice' }),
        s('circle', { r: 4, class: 'centro' }),
      ],
    );
  }

  function origemAtual() {
    const b = A.estado.mapa.base;
    if (A.estado.bussola.origem === 'gps') {
      const p = sensores.posicao;
      return p ? { lat: p.lat, lon: p.lon, rotulo: 'sua localização' } : null;
    }
    return A.coordValida(b.lat, b.lon) ? { lat: b.lat, lon: b.lon, rotulo: b.nome } : null;
  }

  function alvos() {
    const lista = [];
    const b = A.estado.mapa.base;
    if (A.coordValida(b.lat, b.lon)) lista.push({ valor: 'base', nome: `Base: ${b.nome}`, lat: b.lat, lon: b.lon });
    for (const p of A.estado.mapa.pontos) {
      if (A.coordValida(p.lat, p.lon)) lista.push({ valor: `ponto:${p.id}`, nome: `${p.nome}${p.categoria === 'perigo' ? ' (perigo)' : ''}`, lat: p.lat, lon: p.lon });
    }
    const livre = A.estado.bussola.livre;
    if (livre) lista.push({ valor: 'livre', nome: `Do mapa: ${livre.nome}`, lat: livre.lat, lon: livre.lon });
    return lista;
  }

  function alvoAtual() {
    return alvos().find((a) => a.valor === A.estado.bussola.alvo) || null;
  }

  function desenharRumo() {
    const rumo = sensores.rumo;
    const gira = A.$('#rosa-gira');
    if (!gira) return;
    if (Number.isFinite(rumo)) {
      gira.setAttribute('transform', `rotate(${-rumo})`);
      const c = B.pontoCardeal(rumo);
      A.$('#rumo-graus').textContent = `${Math.round(rumo) % 360}°`;
      A.$('#rumo-cardeal').textContent = c.nome;
      const p = sensores.precisaoRumo;
      A.$('#precisao-bussola').textContent = p === null ? '' : p > 20 ? `Precisão ruim (±${Math.round(p)}°): gire o celular desenhando um 8 no ar.` : `Precisão ±${Math.round(p)}°`;
    }
    desenharGuia();
  }

  function desenharGuia() {
    const destino = A.$('#guia-bussola');
    const seta = A.$('#seta-alvo');
    const alvo = alvoAtual();
    const origem = origemAtual();
    if (!alvo) {
      seta.setAttribute('display', 'none');
      A.trocar(destino, A.h('p', { class: 'ajuda' }, 'Escolha um destino. Pontos com coordenadas aparecem aqui (base, meus pontos ou um lugar tocado no mapa da cidade).'));
      return;
    }
    if (!origem) {
      seta.setAttribute('display', 'none');
      A.trocar(
        destino,
        A.h('p', { class: 'ajuda' }, A.estado.bussola.origem === 'gps' ? 'Toque em "Atualizar minha localização" para saber a distância e o rumo.' : 'Defina a base no mapa (aba Meus pontos ou tocando no mapa da cidade).'),
      );
      return;
    }
    const g = B.guiaAte(origem, alvo, Number.isFinite(sensores.rumo) ? sensores.rumo : null);
    if (g.virar !== null && !g.chegou) {
      seta.removeAttribute('display');
      seta.setAttribute('transform', `rotate(${g.virar})`);
    } else seta.setAttribute('display', 'none');
    A.trocar(destino, [
      A.h('p', { class: 'guia-texto' }, g.chegou ? 'Você chegou (menos de 15 m).' : g.texto),
      A.h(
        'p',
        null,
        `${alvo.nome}: ${A.metros(g.distancia)} a ${g.cardeal.nome} (rumo ${Math.round(g.rumo) % 360}° verdadeiro`,
        A.estado.bussola.verdadeiro ? '' : `, ${Math.round(B.paraMagnetico(g.rumo, B.declinacaoEm()))}° na bússola de agulha`,
        `), a partir de ${origem.rotulo}. Em linha reta: pelas ruas é mais longe.`,
      ),
    ]);
  }

  function desenharSol() {
    const lugar = sensores.posicao || (A.coordValida(A.estado.mapa.base.lat, A.estado.mapa.base.lon) ? A.estado.mapa.base : B.CENTRO);
    const agora = new Date();
    const o = B.orientarPeloSol(agora, lugar.lat, lugar.lon);
    const hora = (d) => (d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
    const s = o.sol;
    A.trocar(A.$('#sol-agora'), [
      A.h('p', { class: 'guia-texto' }, o.texto),
      A.h(
        'p',
        { class: 'ajuda' },
        s.elevacao > 0 ? `Sol a ${Math.round(s.azimute) % 360}° (${B.pontoCardeal16(s.azimute)}), ${Math.round(s.elevacao)}° acima do horizonte. ` : '',
        `Hoje: nasce ${hora(s.nascer)} (a ${B.pontoCardeal16(B.posicaoSol(s.nascer || agora, lugar.lat, lugar.lon).azimute)}), meio-dia solar ${hora(s.meioDiaSolar)}, põe-se ${hora(s.por)}.`,
      ),
    ]);
  }

  function preencherAlvos() {
    const sel = A.$('#alvo-bussola');
    const lista = alvos();
    if (A.estado.bussola.alvo && !lista.some((a) => a.valor === A.estado.bussola.alvo)) A.estado.bussola.alvo = '';
    A.trocar(sel, [
      A.h('option', { value: '' }, lista.length ? 'Escolha…' : 'Nenhum ponto com coordenadas'),
      lista.map((a) => A.h('option', { value: a.valor, selected: a.valor === A.estado.bussola.alvo }, a.nome)),
    ]);
  }

  function preencherTiposRumo() {
    const cat = A.$('#rumo-categoria').value;
    A.trocar(A.$('#rumo-tipo'), Object.entries(M.CATEGORIAS[cat].tipos).map(([v, t]) => A.h('option', { value: v }, t)));
  }

  function render() {
    if (!A) return;
    A.$('#bussola-verdadeiro').checked = A.estado.bussola.verdadeiro;
    A.$('#texto-declinacao').textContent = `${String(B.declinacaoEm()).replace('.', ',')}°`;
    A.$('#bussola-origem').value = A.estado.bussola.origem;
    preencherAlvos();
    desenharRumo();
    desenharSol();
  }

  let relogioSol = 0;

  (S.extensoes = S.extensoes || []).push({
    nome: 'bussola',
    padrao: () => ({ bussola: { verdadeiro: true, origem: 'gps', alvo: '', livre: null } }),
    mesclar(dados, r, u) {
      const d = dados.bussola && typeof dados.bussola === 'object' ? dados.bussola : null;
      if (!d) return;
      const livre = d.livre && typeof d.livre === 'object' && A_coord(d.livre.lat, d.livre.lon) ? { nome: u.texto(d.livre.nome, 60) || 'Ponto', lat: d.livre.lat, lon: d.livre.lon } : null;
      r.bussola = {
        verdadeiro: d.verdadeiro !== false,
        origem: d.origem === 'base' ? 'base' : 'gps',
        alvo: u.texto(d.alvo, 60),
        livre,
      };
    },
    montar(api) {
      A = api;
      montarRosa();
      sensores.ouvir((tipo) => {
        if (tipo === 'rumo') desenharRumo();
        if (tipo === 'posicao') {
          desenharGuia();
          A.$('#msg-gps-bussola').textContent = `Localização obtida (precisão de ~${Math.round(sensores.posicao.precisao)} m).`;
        }
      });
      A.$('#ligar-bussola').addEventListener('click', ligarBussola);
      A.$('#bussola-verdadeiro').addEventListener('change', (e) => {
        A.estado.bussola.verdadeiro = e.target.checked;
        if (Number.isFinite(magSuave)) sensores.rumo = e.target.checked ? B.paraVerdadeiro(magSuave, B.declinacaoEm()) : magSuave;
        A.salvar();
        desenharRumo();
      });
      A.$('#alvo-bussola').addEventListener('change', (e) => {
        A.estado.bussola.alvo = e.target.value;
        A.salvar();
        desenharGuia();
      });
      A.$('#bussola-origem').addEventListener('change', (e) => {
        A.estado.bussola.origem = e.target.value === 'base' ? 'base' : 'gps';
        A.salvar();
        desenharGuia();
      });
      A.$('#gps-bussola').addEventListener('click', () => {
        const msg = A.$('#msg-gps-bussola');
        msg.textContent = 'Buscando a localização…';
        sensores.localizar().catch((e) => (msg.textContent = e.message));
      });
      A.$('#conferir-sol').addEventListener('click', () => {
        const msg = A.$('#msg-conferir-sol');
        if (!Number.isFinite(sensores.rumo)) {
          msg.textContent = 'Ligue a bússola primeiro.';
          return;
        }
        const lugar = sensores.posicao || B.CENTRO;
        const c = B.conferirComSol(A.estado.bussola.verdadeiro ? sensores.rumo : B.paraVerdadeiro(sensores.rumo, B.declinacaoEm()), new Date(), lugar.lat, lugar.lon);
        if (c.sol.elevacao <= 0) msg.textContent = 'O sol está abaixo do horizonte agora.';
        else if (c.sol.elevacao > 70) msg.textContent = 'O sol está alto demais para conferir. Tente de manhã ou no fim da tarde.';
        else msg.textContent = c.ok ? `A bússola está certa (diferença de ${Math.round(Math.abs(c.erro))}°).` : `A bússola está ${Math.round(Math.abs(c.erro))}° fora. Afaste de metais e gire o celular desenhando um 8 no ar.`;
      });

      // Marcar ponto pelo rumo.
      A.trocar(A.$('#rumo-categoria'), Object.entries(M.CATEGORIAS).map(([v, c]) => A.h('option', { value: v }, c.rotulo)));
      preencherTiposRumo();
      A.$('#rumo-categoria').addEventListener('change', preencherTiposRumo);
      A.$('#usar-rumo-atual').addEventListener('click', () => {
        if (Number.isFinite(sensores.rumo)) A.$('#rumo-graus-ponto').value = Math.round(sensores.rumo) % 360;
        else A.$('#msg-rumo-ponto').textContent = 'Ligue a bússola primeiro, ou digite o rumo.';
      });
      A.$('#form-rumo-ponto').addEventListener('submit', (e) => {
        e.preventDefault();
        const msg = A.$('#msg-rumo-ponto');
        const origem = origemAtual();
        if (!origem) {
          msg.textContent = A.estado.bussola.origem === 'gps' ? 'Atualize sua localização primeiro (ou escolha partir da base).' : 'Defina a base primeiro.';
          return;
        }
        const graus = Number(A.$('#rumo-graus-ponto').value);
        const dist = Number(A.$('#rumo-distancia').value);
        const nome = A.$('#rumo-nome').value.trim();
        if (!nome) return;
        try {
          const metrosPonto = A.$('#rumo-unidade').value === 'passos' ? M.metrosDePassos(dist) : dist;
          const verdadeiro = A.estado.bussola.verdadeiro ? graus : B.paraVerdadeiro(graus, B.declinacaoEm());
          const c = M.pontoPorRumo(origem, metrosPonto, B.normalizar(verdadeiro));
          const categoria = A.$('#rumo-categoria').value;
          A.estado.mapa.pontos.push({
            id: A.novoId(),
            nome: nome.slice(0, 60),
            categoria,
            tipo: A.$('#rumo-tipo').value,
            status: categoria === 'perigo' ? 'inseguro' : 'desconhecido',
            lat: c.lat,
            lon: c.lon,
            referencia: `Rumo ${Math.round(graus)}°, ${A.metros(metrosPonto)} de ${origem.rotulo}`.slice(0, 100),
            obs: '',
            raio: 150,
            verificadoEm: new Date().toISOString(),
          });
          A.salvar();
          A.renderizar('mapa', 'cidade', 'bussola');
          A.$('#rumo-nome').value = '';
          msg.textContent = `“${nome}” marcado a ${A.metros(metrosPonto)} no rumo ${Math.round(graus)}°.`;
        } catch (erro) {
          msg.textContent = erro.message;
        }
      });

      A.trocar(
        A.$('#lista-sem-bussola'),
        B.SEM_BUSSOLA.map((m) => A.h('details', { class: 'cartao' }, A.h('summary', null, m.titulo), A.h('ol', null, m.passos.map((p) => A.h('li', null, p))))),
      );
    },
    render,
    navegar(secao) {
      clearInterval(relogioSol);
      if (secao === 'bussola') {
        desenharSol();
        relogioSol = setInterval(desenharSol, 30000);
      }
      return false;
    },
  });

  function A_coord(lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
  }

  /** Usado pelo mapa da cidade: "Bússola até aqui". */
  S.apontarBussola = (lat, lon, nome) => {
    if (!A || !A_coord(lat, lon)) return;
    A.estado.bussola.livre = { nome: String(nome || 'Ponto').slice(0, 60), lat, lon };
    A.estado.bussola.alvo = 'livre';
    A.salvar();
    render();
    location.hash = 'bussola';
  };
})();
