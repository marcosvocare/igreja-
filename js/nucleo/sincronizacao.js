/**
 * Mecanismo: Pacotes para compartilhar dados entre aparelhos.
 *
 * Cada aparelho guarda seus próprios dados. Para a coordenação ver o que os
 * outros cadastraram, cada um gera um pacote com as partes escolhidas (mapa,
 * rede, equipes…) e quem recebe junta o pacote aos seus dados, sem apagar nada:
 * itens novos entram, itens repetidos ficam com a versão mais recente.
 * Dados pessoais da casa (estoque, remédios, frase da senha do dia) nunca vão
 * em pacote.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).sincronizacao = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const TIPO = 'sobrevivencia-pacote';
  const VERSAO = 1;

  /** Partes que podem ir num pacote: rótulo e como ler/gravar no estado. */
  const PARTES = {
    mapa: { rotulo: 'Mapa: pontos de água, remédios, comida, abrigo e perigo', ler: (e) => (e.mapa && e.mapa.pontos) || [] },
    equipes: { rotulo: 'Equipes de socorro e seus contatos', ler: (e) => e.equipes || {} },
    rede: { rotulo: 'Rede de apoio (quem ajuda e quem precisa)', ler: (e) => e.rede || [] },
    radio: { rotulo: 'Rádios da rede', ler: (e) => ((e.radio && e.radio.nos) || []).filter((n) => !n.exemplo) },
    voluntarios: { rotulo: 'Voluntários da vigia', ler: (e) => (e.defesa && e.defesa.voluntarios) || '' },
    familias: { rotulo: 'Famílias da partilha', ler: (e) => (e.partilha && e.partilha.familias) || [] },
    pessoas: { rotulo: 'Pessoas (quem está onde)', ler: (e) => e.pessoas || [] },
    recados: { rotulo: 'Quadro de recados', ler: (e) => e.recados || [] },
    abrigados: { rotulo: 'Pessoas no abrigo da igreja', ler: (e) => (e.abrigo && e.abrigo.abrigados) || [] },
  };

  /**
   * Monta um pacote com as partes escolhidas.
   * @param {object} estado
   * @param {string[]} partes
   * @param {{origem?:string, agora?:Date}} [opcoes]
   */
  function criarPacote(estado, partes, { origem = '', agora = new Date() } = {}) {
    const escolhidas = (partes || []).filter((p) => PARTES[p]);
    if (!escolhidas.length) throw new RangeError('Escolha ao menos uma parte para compartilhar.');
    const conteudo = {};
    for (const p of escolhidas) conteudo[p] = JSON.parse(JSON.stringify(PARTES[p].ler(estado || {})));
    return { tipo: TIPO, versao: VERSAO, criadoEm: agora.toISOString(), origem: String(origem).slice(0, 60), partes: conteudo };
  }

  function ePacote(obj) {
    return Boolean(obj) && obj.tipo === TIPO && obj.partes && typeof obj.partes === 'object';
  }

  function tempo(item, campos) {
    for (const c of campos) {
      const t = item && item[c] ? new Date(item[c]).getTime() : NaN;
      if (Number.isFinite(t)) return t;
    }
    return 0;
  }

  /** Junta duas listas por id; o item com data mais recente vence. */
  function juntarLista(local, recebida, campos = ['atualizadoEm']) {
    const resultado = (local || []).map((x) => ({ ...x }));
    const porId = new Map(resultado.map((x, i) => [x.id, i]));
    const r = { novos: 0, atualizados: 0, iguais: 0 };
    for (const item of recebida || []) {
      if (!item || typeof item !== 'object' || !item.id) continue;
      if (!porId.has(item.id)) {
        porId.set(item.id, resultado.length);
        resultado.push({ ...item });
        r.novos++;
        continue;
      }
      const i = porId.get(item.id);
      if (tempo(item, campos) > tempo(resultado[i], campos)) {
        resultado[i] = { ...item };
        r.atualizados++;
      } else r.iguais++;
    }
    return { lista: resultado, resumo: r };
  }

  /**
   * Junta um pacote aos dados, sem apagar nada.
   * @returns {{estado:object, resumo:Object<string,{novos:number, atualizados:number, iguais:number, conflitos?:string[]}>}}
   */
  function mesclarPacote(estado, pacote) {
    if (!ePacote(pacote)) throw new TypeError('Isto não é um pacote do app.');
    if (pacote.versao > VERSAO) throw new RangeError('Pacote de uma versão mais nova do app: atualize o app.');
    const e = JSON.parse(JSON.stringify(estado || {}));
    const resumo = {};
    const p = pacote.partes;

    if (Array.isArray(p.mapa)) {
      e.mapa = e.mapa || { base: { nome: 'Casa', lat: null, lon: null }, pontos: [], busca: 'agua' };
      const j = juntarLista(e.mapa.pontos, p.mapa, ['verificadoEm', 'atualizadoEm']);
      e.mapa.pontos = j.lista;
      resumo.mapa = j.resumo;
    }
    if (p.equipes && typeof p.equipes === 'object') {
      e.equipes = e.equipes || {};
      const r = { novos: 0, atualizados: 0, iguais: 0, conflitos: [] };
      for (const [k, v] of Object.entries(p.equipes)) {
        if (typeof v !== 'string' || !v.trim()) continue;
        const atual = typeof e.equipes[k] === 'string' ? e.equipes[k].trim() : '';
        if (!atual) {
          e.equipes[k] = v;
          r.novos++;
        } else if (atual === v.trim()) r.iguais++;
        else r.conflitos.push(k); // fica o daqui; quem recebe decide
      }
      resumo.equipes = r;
    }
    for (const [parte, caminho] of [
      ['rede', ['rede']],
      ['radio', ['radio', 'nos']],
      ['familias', ['partilha', 'familias']],
      ['pessoas', ['pessoas']],
      ['recados', ['recados']],
      ['abrigados', ['abrigo', 'abrigados']],
    ]) {
      if (!Array.isArray(p[parte])) continue;
      let alvo = e;
      for (let i = 0; i < caminho.length - 1; i++) alvo = alvo[caminho[i]] = alvo[caminho[i]] || {};
      const chave = caminho[caminho.length - 1];
      const j = juntarLista(alvo[chave], p[parte]);
      alvo[chave] = j.lista;
      resumo[parte] = j.resumo;
    }
    if (typeof p.voluntarios === 'string') {
      e.defesa = e.defesa || {};
      const atuais = String(e.defesa.voluntarios || '').split('\n').map((x) => x.trim()).filter(Boolean);
      const vistos = new Set(atuais.map((x) => x.toLowerCase()));
      let novos = 0;
      for (const nome of p.voluntarios.split('\n').map((x) => x.trim()).filter(Boolean)) {
        if (!vistos.has(nome.toLowerCase())) {
          atuais.push(nome);
          vistos.add(nome.toLowerCase());
          novos++;
        }
      }
      e.defesa.voluntarios = atuais.join('\n');
      resumo.voluntarios = { novos, atualizados: 0, iguais: 0 };
    }
    return { estado: e, resumo };
  }

  return { TIPO, PARTES, criarPacote, ePacote, juntarLista, mesclarPacote };
});
