/**
 * Aba Caderno: monta um documento para imprimir com o que importa quando a
 * bateria acabar (socorro, encontro, rádio, mapa, remédios, vigia, kit,
 * protocolos, água, primeiros socorros). Imprime ou baixa como arquivo HTML.
 * Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;

  // ----------------------------------------------------------------- partes

  const PARTES = {
    socorro: { rotulo: 'Como pedir socorro e equipes', montar: parteSocorro },
    encontro: { rotulo: 'Pontos de encontro e contatos', montar: parteEncontro },
    radio: { rotulo: 'Rádio da família', montar: parteRadio },
    mapa: { rotulo: 'Mapa: água, remédios, comida, abrigo e perigos', montar: parteMapa },
    remedios: { rotulo: 'Remédios de cada pessoa', montar: parteRemedios },
    vigia: { rotulo: 'Vigia, sinais e princípios de defesa', montar: parteVigia },
    kit: { rotulo: 'Lista do kit de 72 h', montar: parteKit },
    agua: { rotulo: 'Tratamento da água', montar: parteAgua },
    socorros: { rotulo: 'Primeiros socorros', montar: parteSocorros },
    saneamento: { rotulo: 'Higiene e saneamento', montar: parteSaneamento },
    pessoas: { rotulo: 'Pessoas e recados', montar: partePessoas },
    abrigo: { rotulo: 'Abrigo: regras e tarefas', montar: parteAbrigo },
    protocolos: { rotulo: 'Protocolos por cenário', montar: parteProtocolos },
  };
  const PADRAO = Object.keys(PARTES);

  function h(...a) {
    return A.h(...a);
  }

  function lista(itens) {
    return h('ul', null, itens.map((i) => h('li', null, i)));
  }

  function tabela(cabecalho, linhas) {
    return h('table', null, h('thead', null, h('tr', null, cabecalho.map((c) => h('th', null, c)))), h('tbody', null, linhas.map((l) => h('tr', null, l.map((c) => h('td', null, c))))));
  }

  function vazio(texto) {
    return h('p', { class: 'vazio' }, texto);
  }

  function parteSocorro() {
    const e = A.estado;
    return [
      h('p', null, h('strong', null, 'Pedir socorro: '), 'código 2 no canal da família do rádio (com a posição ligada) · 3 toques de apito repetidos · 3 piscadas de lanterna à noite · folha escrita AJUDA na janela.'),
      tabela(
        ['Equipe', 'Acionar quando', 'Contato'],
        Object.entries(S.situacao.EQUIPES).map(([k, eq]) => [eq.nome, eq.faz, e.equipes[k] || '________________________']),
      ),
    ];
  }

  function parteEncontro() {
    const e = A.estado;
    const p = e.pontos;
    const ligacoes = S.comunicacao.gerarArvore(e.contatos, { porPessoa: e.porPessoa }).ligacoes;
    return [
      tabela(
        ['Ponto de encontro', 'Onde'],
        [
          ['1. Perto de casa', p.casa || '__________________'],
          ['2. No bairro', p.bairro || '__________________'],
          ['3. Fora do bairro', p.fora || '__________________'],
          ['Contato fora da cidade', p.contatoFora || '__________________'],
        ],
      ),
      e.contatos.length ? tabela(['Contato', 'Telefone'], e.contatos.map((c) => [c.nome, c.telefone || '—'])) : vazio('Nenhum contato cadastrado.'),
      ligacoes.length ? [h('h4', null, 'Quem avisa quem'), lista(ligacoes.map((l) => `${l.quem.nome} avisa ${l.avisa.map((x) => x.nome).join(', ')}`))] : null,
      h('p', null, h('strong', null, 'Horários de contato: '), e.horarios),
    ];
  }

  function parteRadio() {
    const r = A.estado.radio;
    if (!r || !r.nos.length) return vazio('Nenhum rádio cadastrado.');
    const analise = S.radio.analisarMalha(r.nos, { ambiente: r.ambiente });
    const plano = S.radio.planoRede(r.nos, { canalFamilia: r.canalFamilia, canalComunidade: (r.canalComunidade || '').trim() || null, analise });
    return [
      tabela(['Aparelho', 'Nome curto', 'Papel'], plano.aparelhos.map((x) => [x.nomeLongo, x.nomeCurto, x.papel])),
      h('p', null, h('strong', null, 'Limite de saltos: '), String(plano.limiteSaltos)),
      lista(plano.canais.map((c) => `Canal ${c.indice}: ${c.nome} — ${c.uso}`)),
      h('h4', null, 'Códigos'),
      tabela(['Código', 'Significa'], S.radio.CODIGOS.map((c) => [c.codigo, c.significado])),
    ];
  }

  function parteMapa() {
    const m = A.estado.mapa;
    if (!m || !m.pontos.length) return vazio('Nenhum ponto no mapa.');
    const base = A.coordValida(m.base.lat, m.base.lon) ? m.base : null;
    const linhas = [...m.pontos]
      .sort((a, b) => a.categoria.localeCompare(b.categoria) || a.nome.localeCompare(b.nome, 'pt-BR'))
      .map((p) => {
        const cat = S.mapa.CATEGORIAS[p.categoria];
        let onde = p.referencia || '';
        if (base && A.coordValida(p.lat, p.lon)) {
          const d = S.mapa.distanciaMetros(base, p);
          onde = `${A.metros(d)} a ${S.mapa.direcao(S.mapa.rumoGraus(base, p))}${onde ? ` · ${onde}` : ''}`;
        }
        const situacao = p.categoria === 'perigo' ? (p.status === 'resolvido' ? 'Resolvido' : 'Ativo') : (S.mapa.STATUS[p.status] || S.mapa.STATUS.desconhecido).rotulo;
        return [`${p.nome} (${cat.tipos[p.tipo]})`, cat.rotulo, situacao, onde || '—', A.coordValida(p.lat, p.lon) ? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}` : '—'];
      });
    return [
      base ? h('p', null, `Distâncias e direções a partir de: ${m.base.nome}.`) : null,
      tabela(['Ponto', 'Tipo', 'Situação', 'Onde', 'Coordenadas'], linhas),
      h('p', null, 'Água de qualquer fonte: ferva 1 minuto ou clore (2 gotas de água sanitária por litro, 30 minutos).'),
    ];
  }

  function parteRemedios() {
    const itens = A.estado.remedios || [];
    if (!itens.length) return vazio('Nenhum remédio cadastrado.');
    const r = S.remedios.situacaoRemedios(itens, new Date());
    return [
      tabela(
        ['Pessoa', 'Remédio', 'Por dia', 'Estoque', 'Dura até'],
        r.itens.map((i) => [i.pessoa, `${i.nome}${i.refrigerado ? ' (geladeira)' : ''}`, i.consumoDiario ? `${A.fmt(i.consumoDiario)} un` : '—', `${A.fmt(i.quantidade)} un`, i.acabaEm ? A.dataBR(i.acabaEm) : '—']),
      ),
      lista(S.remedios.ORIENTACOES.slice(0, 3)),
    ];
  }

  function parteVigia() {
    const d = A.estado.defesa;
    const nomes = d.voluntarios.split('\n').map((x) => x.trim()).filter(Boolean);
    let escala = vazio('Sem voluntários na escala.');
    if (nomes.length) {
      try {
        const r = S.defesa.gerarEscala(nomes, { inicio: new Date(d.escala.inicio), horas: d.escala.horas, duracaoTurno: d.escala.turno, porTurno: d.escala.por, descansoMinimo: d.escala.descanso });
        const p2 = (n) => String(n).padStart(2, '0');
        const hora = (x) => `${p2(x.getHours())}:${p2(x.getMinutes())}`;
        const dia = (x) => `${p2(x.getDate())}/${p2(x.getMonth() + 1)}`;
        escala = tabela(['Turno', 'Vigias'], r.turnos.map((t) => [`${dia(t.inicio)} ${hora(t.inicio)}–${hora(t.fim)}`, t.pessoas.join(' e ') || '—']));
      } catch (erro) {
        escala = vazio(erro.message);
      }
    }
    return [escala, h('h4', null, 'Código de sinais'), tabela(['Sinal', 'Significa'], S.defesa.SINAIS.map((x) => [x.sinal, x.significado])), h('h4', null, 'Princípios'), lista(S.defesa.PRINCIPIOS)];
  }

  function parteKit() {
    const e = A.estado;
    return S.kit.gerarKit(e.casa, { ...e.extras, porteCaes: e.porteCaes }).map((s) => [h('h4', null, s.titulo), h('ul', { class: 'checklist' }, s.itens.map((i) => h('li', null, `${e.kitMarcados[i.id] ? '☑' : '☐'} ${i.texto}`)))]);
  }

  function parteAgua() {
    return [
      tabela(
        ['Volume', 'Água sanitária 2,5 %', 'Esperar'],
        [1, 5, 20, 200, 1000].map((l) => {
          const d = S.agua.dosagemHipoclorito(l);
          return [`${A.fmt(l, 0)} L`, d.ml >= 1 ? `${A.fmt(d.ml)} ml (${A.fmt(d.gotas, 0)} gotas)` : `${d.gotas} gotas`, `${d.minutosEspera} min`];
        }),
      ),
      h('p', null, 'Água turva: deixe decantar, coe em pano e use o dobro. Depois de esperar, deve haver leve cheiro de cloro.'),
      S.agua.METODOS.map((m) => [h('h4', null, m.titulo), lista(m.passos)]),
    ];
  }

  function parteSocorros() {
    if (!S.socorros) return vazio('Guia de primeiros socorros indisponível.');
    return S.socorros.GUIAS.map((g) => [h('h4', null, g.titulo), h('ol', null, g.passos.map((p) => h('li', null, p))), g.nao && g.nao.length ? h('p', null, h('strong', null, 'Não faça: '), g.nao.join(' · ')) : null]);
  }

  function parteSaneamento() {
    return S.saneamento.GUIAS.map((g) => [h('h4', null, g.titulo), lista(g.passos)]);
  }

  function partePessoas() {
    const e = A.estado;
    const lista1 = S.pessoas.ordenar(e.pessoas || []);
    return [
      lista1.length
        ? tabela(['Pessoa', 'Situação', 'Onde', 'Observação'], lista1.map((p) => [`${p.nome}${p.familia ? ` (${p.familia})` : ''}`, S.pessoas.SITUACOES[p.situacao].rotulo, p.onde || '—', p.obs || '—']))
        : vazio('Ninguém cadastrado.'),
      (e.recados || []).length ? [h('h4', null, 'Recados'), lista(S.pessoas.recadosPara(e.recados, '').map((r) => `Para ${r.para}${r.de ? ` (de ${r.de})` : ''}: ${r.texto}`))] : null,
    ];
  }

  function parteAbrigo() {
    const ab = A.estado.abrigo;
    const familias = [...new Set(ab.abrigados.filter((a) => !a.saida).map((a) => String(a.familia || '').trim()).filter(Boolean))];
    const tarefas = ab.tarefas.split('\n').map((t) => t.trim()).filter(Boolean);
    const escala = S.abrigo.escalaTarefas(familias, tarefas, ab.dias);
    return [
      h('h4', null, 'Regras de convivência'),
      lista(S.abrigo.REGRAS),
      escala.length ? [h('h4', null, 'Tarefas por família'), tabela(['Dia', ...tarefas], escala.map((d) => [`Dia ${d.dia}`, ...d.tarefas.map((x) => x.familia)]))] : null,
    ];
  }

  function parteProtocolos() {
    return S.cenarios.CENARIOS.map((c) => [h('h4', null, c.titulo), h('p', null, h('strong', null, 'Durante: ')), lista(c.durante), h('p', null, h('strong', null, 'Depois: ')), lista(c.depois)]);
  }

  // --------------------------------------------------------------- montagem

  function partesEscolhidas() {
    const salvas = A.estado.caderno && Array.isArray(A.estado.caderno.partes) ? A.estado.caderno.partes : PADRAO;
    return PADRAO.filter((k) => salvas.includes(k));
  }

  function documento() {
    const e = A.estado;
    return h(
      'div',
      { class: 'caderno-doc' },
      h('h1', null, 'Caderno da família — Sobrevivência Urbana'),
      h('p', null, `Feito em ${A.dataBR(new Date().toISOString().slice(0, 10))}. Casa: ${['adultos', 'idosos', 'gestantes', 'criancas', 'bebes'].map((k) => (e.casa[k] ? `${e.casa[k]} ${S.suprimentos.PERFIS[k].rotulo.toLowerCase()}` : '')).filter(Boolean).join(', ') || '—'}.`),
      partesEscolhidas().map((k) => h('section', { class: 'caderno-parte' }, h('h2', null, PARTES[k].rotulo), PARTES[k].montar())),
    );
  }

  const CSS_ARQUIVO = `
body { font: 11pt/1.4 system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #000; background: #fff; margin: 1.5cm; }
h1 { font-size: 16pt; } h2 { font-size: 13pt; border-bottom: 2px solid #000; padding-bottom: 2pt; margin-top: 18pt; }
h4 { margin: 10pt 0 3pt; } table { border-collapse: collapse; width: 100%; margin: 4pt 0 8pt; }
th, td { border: 1px solid #555; padding: 3pt 5pt; text-align: left; vertical-align: top; font-size: 10pt; }
ul, ol { margin: 3pt 0 6pt; padding-left: 16pt; } .checklist { list-style: none; padding-left: 0; } .vazio { color: #555; font-style: italic; }
section { break-inside: auto; } h2, h4 { break-after: avoid; } tr { break-inside: avoid; }
@media print { body { margin: 0; } }`;

  function arquivoHtml() {
    const titulo = `Caderno da família — ${new Date().toISOString().slice(0, 10)}`;
    return `<!doctype html>\n<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${titulo}</title><style>${CSS_ARQUIVO}</style></head><body>${documento().innerHTML}</body></html>\n`;
  }

  function montar(api) {
    A = api;
    A.trocar(
      A.$('#partes-caderno'),
      Object.entries(PARTES).map(([k, p]) => A.h('label', { class: 'linha' }, A.h('input', { type: 'checkbox', value: k, dataset: { caderno: k } }), A.h('span', null, p.rotulo))),
    );
    A.$('#partes-caderno').addEventListener('change', () => {
      A.estado.caderno = { partes: Array.from(document.querySelectorAll('[data-caderno]:checked')).map((i) => i.value) };
      A.salvar();
      render();
    });
    A.$('#imprimir-caderno').addEventListener('click', () => {
      const alvo = document.getElementById('caderno-impressao');
      A.trocar(alvo, documento());
      document.body.classList.add('imprimindo-caderno');
      window.print();
    });
    window.addEventListener('afterprint', () => document.body.classList.remove('imprimindo-caderno'));
    A.$('#baixar-caderno').addEventListener('click', async () => {
      const msg = A.$('#msg-caderno');
      try {
        await A.baixar(`caderno-familia-${new Date().toISOString().slice(0, 10)}.html`, arquivoHtml(), 'text/html');
        msg.textContent = 'Caderno baixado. Abra o arquivo em qualquer navegador e imprima.';
      } catch (erro) {
        msg.textContent = erro && erro.code === 'declined' ? 'Download cancelado.' : 'Não foi possível baixar o caderno aqui.';
      }
    });
    recarregar();
  }

  function recarregar() {
    const partes = partesEscolhidas();
    for (const i of document.querySelectorAll('[data-caderno]')) i.checked = partes.includes(i.value);
  }

  function render() {
    A.trocar(A.$('#caderno-conteudo'), documento());
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'caderno',
    padrao: () => ({ caderno: { partes: PADRAO.slice() } }),
    mesclar(dados, r) {
      const c = dados.caderno && Array.isArray(dados.caderno.partes) ? dados.caderno.partes : PADRAO;
      r.caderno = { partes: PADRAO.filter((k) => c.includes(k)) };
    },
    montar,
    render,
    recarregar,
    // A prévia junta dados de várias abas: refaz ao abrir.
    navegar(secao) {
      if (secao === 'caderno') render();
      return false;
    },
  });
})();
