/**
 * Mecanismo: Atualização de dados de versões antigas do app.
 *
 * Os dados salvos (e as cópias de segurança) carregam um número de versão.
 * Quando algo muda de nome, a migração leva os dados antigos para o nome novo
 * em vez de descartá-los, e diz o que precisou ser descartado.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).versoes = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const VERSAO_ATUAL = 2;

  /** Sinais da triagem que mudaram de nome (versão 1 → 2). */
  const SINAIS_RENOMEADOS = {
    alerta_defesa_civil: 'alerta_comunidade',
    sem_servicos: 'saques',
  };

  /**
   * Leva os dados para a versão atual.
   * @param {object} dados dados salvos ou de uma cópia de segurança
   * @param {string[]} sinaisConhecidos ids dos sinais que existem hoje
   * @returns {{dados:object, avisos:string[], versaoOriginal:number}}
   */
  function migrar(dados, sinaisConhecidos = []) {
    if (!dados || typeof dados !== 'object') throw new TypeError('Dados inválidos.');
    const versaoOriginal = Number.isInteger(dados.versao) ? dados.versao : 1;
    if (versaoOriginal > VERSAO_ATUAL) {
      throw new RangeError('Estes dados são de uma versão mais nova do app. Atualize o app antes de restaurar.');
    }
    const copia = JSON.parse(JSON.stringify(dados));
    const avisos = [];

    if (versaoOriginal < 2 && Array.isArray(copia.sinais)) {
      copia.sinais = [...new Set(copia.sinais.map((id) => SINAIS_RENOMEADOS[id] || id))];
    }

    if (Array.isArray(copia.sinais) && sinaisConhecidos.length) {
      const conhecidos = new Set(sinaisConhecidos);
      const descartados = copia.sinais.filter((id) => !conhecidos.has(id));
      if (descartados.length) {
        copia.sinais = copia.sinais.filter((id) => conhecidos.has(id));
        avisos.push(`${descartados.length} sinal(is) da triagem não existe(m) mais e foi(ram) desmarcado(s).`);
      }
    }

    copia.versao = VERSAO_ATUAL;
    return { dados: copia, avisos, versaoOriginal };
  }

  return { VERSAO_ATUAL, SINAIS_RENOMEADOS, migrar };
});
