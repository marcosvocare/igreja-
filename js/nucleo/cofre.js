/**
 * Mecanismo: Cofre — dados do app protegidos por senha.
 *
 * A senha nunca é guardada. Dela deriva-se uma chave (PBKDF2-SHA-256, 210 mil
 * rodadas, com sal aleatório) que cifra os dados com AES-GCM de 256 bits.
 * Sem a senha, os dados guardados são ilegíveis; senha errada não abre.
 * Usa a Web Crypto do navegador (ou do Node, nos testes).
 */
(function (raiz, fabrica) {
  const modulo = fabrica();
  if (typeof module === 'object' && module.exports) module.exports = modulo;
  else (raiz.Sobrevivencia = raiz.Sobrevivencia || {}).cofre = modulo;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const ITERACOES = 210000;
  const TAMANHO_SAL = 16;
  const TAMANHO_IV = 12;

  function cripto() {
    const c = typeof globalThis !== 'undefined' ? globalThis.crypto : null;
    if (!c || !c.subtle) throw new Error('Este navegador não oferece criptografia. Abra o app em https ou pelo arquivo no aparelho.');
    return c;
  }

  function paraBase64(bytes) {
    let s = '';
    const b = new Uint8Array(bytes);
    for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
    return btoa(s);
  }

  function deBase64(texto) {
    const s = atob(texto);
    const b = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) b[i] = s.charCodeAt(i);
    return b;
  }

  /** Senha aceita: 4 a 64 caracteres (números ou letras). Recomendado: 6 ou mais. */
  function senhaValida(senha) {
    return typeof senha === 'string' && senha.length >= 4 && senha.length <= 64;
  }

  function forcaSenha(senha) {
    if (!senhaValida(senha)) return 'invalida';
    const tipos = [/\d/, /[a-z]/, /[A-Z]/, /[^\da-zA-Z]/].filter((r) => r.test(senha)).length;
    if (senha.length >= 10 || (senha.length >= 8 && tipos >= 2)) return 'boa';
    if (senha.length >= 6) return 'razoavel';
    return 'fraca';
  }

  function gerarSal() {
    return paraBase64(cripto().getRandomValues(new Uint8Array(TAMANHO_SAL)));
  }

  /** Deriva a chave AES-GCM a partir da senha e do sal. */
  async function derivarChave(senha, salBase64, iteracoes = ITERACOES) {
    if (!senhaValida(senha)) throw new RangeError('A senha precisa ter de 4 a 64 caracteres.');
    const c = cripto();
    const material = await c.subtle.importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveKey']);
    return c.subtle.deriveKey(
      { name: 'PBKDF2', salt: deBase64(salBase64), iterations: iteracoes, hash: 'SHA-256' },
      material,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  }

  /** Cifra um texto com uma chave já derivada. */
  async function cifrar(texto, chave, sal, iteracoes = ITERACOES) {
    const c = cripto();
    const iv = c.getRandomValues(new Uint8Array(TAMANHO_IV));
    const dados = await c.subtle.encrypt({ name: 'AES-GCM', iv }, chave, new TextEncoder().encode(texto));
    return { cofre: 1, sal, iteracoes, iv: paraBase64(iv), dados: paraBase64(dados) };
  }

  /** Decifra um pacote do cofre com a chave. Lança erro se a chave estiver errada. */
  async function decifrar(pacote, chave) {
    if (!eCofre(pacote)) throw new TypeError('Isto não é um conteúdo protegido por senha.');
    try {
      const claro = await cripto().subtle.decrypt({ name: 'AES-GCM', iv: deBase64(pacote.iv) }, chave, deBase64(pacote.dados));
      return new TextDecoder().decode(claro);
    } catch (e) {
      const erro = new Error('Senha incorreta.');
      erro.codigo = 'senha_incorreta';
      throw erro;
    }
  }

  /** Cria um cofre novo (sal novo) a partir de uma senha. */
  async function fechar(texto, senha) {
    const sal = gerarSal();
    const chave = await derivarChave(senha, sal);
    return cifrar(texto, chave, sal);
  }

  /** Abre um cofre com a senha. Devolve o texto e a chave (para gravar de novo sem pedir a senha). */
  async function abrir(pacote, senha) {
    if (!eCofre(pacote)) throw new TypeError('Isto não é um conteúdo protegido por senha.');
    const chave = await derivarChave(senha, pacote.sal, pacote.iteracoes || ITERACOES);
    return { texto: await decifrar(pacote, chave), chave };
  }

  function eCofre(obj) {
    return Boolean(obj) && typeof obj === 'object' && obj.cofre === 1 && typeof obj.sal === 'string' && typeof obj.iv === 'string' && typeof obj.dados === 'string';
  }

  return { ITERACOES, senhaValida, forcaSenha, gerarSal, derivarChave, cifrar, decifrar, fechar, abrir, eCofre };
});
