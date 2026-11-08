/**
 * Posicionamento de rótulos nos desenhos (Mapa e Rádio).
 *
 * Para cada marcador, testa posições ao redor (direita, esquerda, diagonais,
 * acima, abaixo) e escolhe a primeira que não cobre outro marcador ou rótulo.
 * Se nenhuma estiver livre, fica com a que cobre menos coisas.
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).rotulos = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /** Caixas no formato [x1, y1, x2, y2]. */
  function sobrepoe(a, b) {
    return a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
  }

  function candidatos(x, y, w) {
    return [
      { tx: x + 10, ty: y + 4, ancora: 'start', caixa: [x + 9, y - 6, x + 9 + w, y + 6] },
      { tx: x - 10, ty: y + 4, ancora: 'end', caixa: [x - 9 - w, y - 6, x - 9, y + 6] },
      { tx: x + 7, ty: y - 10, ancora: 'start', caixa: [x + 6, y - 19, x + 6 + w, y - 8] },
      { tx: x + 7, ty: y + 17, ancora: 'start', caixa: [x + 6, y + 8, x + 6 + w, y + 19] },
      { tx: x - 7, ty: y - 10, ancora: 'end', caixa: [x - 6 - w, y - 19, x - 6, y - 8] },
      { tx: x - 7, ty: y + 17, ancora: 'end', caixa: [x - 6 - w, y + 8, x - 6, y + 19] },
      { tx: x, ty: y - 11, ancora: 'middle', caixa: [x - w / 2, y - 21, x + w / 2, y - 9] },
      { tx: x, ty: y + 19, ancora: 'middle', caixa: [x - w / 2, y + 9, x + w / 2, y + 21] },
    ];
  }

  /**
   * @param {Array<{x:number, y:number, texto:string}>} marcas
   * @param {{largura:number, altura:number, topo?:number, ocupadas?:number[][], larguraCaractere?:number, ordem?:number[]}} opcoes
   *   ordem: índices das marcas na ordem de prioridade (as primeiras escolhem antes)
   * @returns {Array<{tx:number, ty:number, ancora:string, caixa:number[]}>} na ordem das marcas
   */
  function posicionarRotulos(marcas, { largura, altura, topo = 16, ocupadas = [], larguraCaractere = 5.8, ordem } = {}) {
    const lista = marcas || [];
    const caixasMarcas = lista.map((m) => [m.x - 7, m.y - 7, m.x + 7, m.y + 7]);
    const colocadas = [...ocupadas];
    const resultado = new Array(lista.length);
    const sequencia = ordem || lista.map((_, i) => i);

    for (const i of sequencia) {
      const m = lista[i];
      const w = String(m.texto || '').length * larguraCaractere + 4;
      const opcoes = candidatos(m.x, m.y, w).filter(
        (o) => o.caixa[0] >= 0 && o.caixa[2] <= largura && o.caixa[1] >= topo && o.caixa[3] <= altura,
      );
      const conflitos = (o) =>
        colocadas.filter((b) => sobrepoe(o.caixa, b)).length + caixasMarcas.filter((b, j) => j !== i && sobrepoe(o.caixa, b)).length;
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
      escolhida = escolhida || { tx: m.x + 10, ty: m.y + 4, ancora: 'start', caixa: [m.x, m.y, m.x, m.y] };
      colocadas.push(escolhida.caixa);
      resultado[i] = escolhida;
    }
    return resultado;
  }

  /** O primeiro candidato que não cobre nenhuma das caixas (ou o primeiro, se todos cobrem). */
  function primeiroLivre(opcoes, caixas) {
    return opcoes.find((o) => !caixas.some((b) => sobrepoe(o.caixa, b))) || opcoes[0];
  }

  return { sobrepoe, posicionarRotulos, primeiroLivre };
});
