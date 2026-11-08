/**
 * Aba Dados e senha: cópia de segurança, senha do app, pacotes para a
 * comunidade e apagar. Registra-se como extensão de app.js (carregar ANTES de app.js).
 */
(function () {
  'use strict';

  const S = window.Sobrevivencia;
  let A = null;

  function hoje() {
    return new Date().toISOString().slice(0, 10);
  }

  function marcarCopia() {
    A.estado.ultimaCopia = new Date().toISOString();
    A.salvar();
    A.renderizar('dados', 'inicio');
  }

  /** Pede um segundo toque antes de uma ação perigosa (o app publicado não mostra confirm()). */
  function doisToques(botao, rotuloConfirmar, aoConfirmar) {
    const original = botao.textContent;
    let armado = false;
    let relogio = null;
    botao.addEventListener('click', () => {
      if (!armado) {
        armado = true;
        botao.textContent = rotuloConfirmar;
        relogio = setTimeout(() => {
          armado = false;
          botao.textContent = original;
        }, 6000);
        return;
      }
      clearTimeout(relogio);
      armado = false;
      botao.textContent = original;
      aoConfirmar();
    });
  }

  // ------------------------------------------------------- cópia de segurança

  function montarCopia() {
    const msg = A.$('#mensagem-dados');
    const proteger = () => A.senha.ativa() && A.$('#copia-protegida').checked;

    A.$('#exportar').addEventListener('click', async () => {
      try {
        const texto = await A.exportar({ proteger: proteger() });
        const r = await A.baixar(`sobrevivencia-urbana-${hoje()}.json`, texto);
        if (r === 'saved') {
          marcarCopia();
          msg.textContent = proteger() ? 'Cópia baixada, protegida pela senha do app.' : 'Cópia de segurança baixada.';
        }
      } catch (erro) {
        msg.textContent = erro && erro.code === 'declined' ? 'Download cancelado.' : 'Não foi possível baixar. Use “Copiar dados como texto”.';
      }
    });

    A.$('#copiar-dados').addEventListener('click', async () => {
      const texto = await A.exportar({ proteger: proteger() });
      const area = A.$('#texto-backup');
      A.copiarTexto(
        texto,
        null,
        () => {
          marcarCopia();
          msg.textContent = 'Dados copiados. Cole em um e-mail ou bloco de notas e guarde fora deste aparelho.';
        },
        () => {
          area.value = texto;
          A.$('#restaurar-texto').open = true;
          area.focus();
          area.select();
          marcarCopia();
          msg.textContent = 'O texto está selecionado abaixo: copie e guarde fora deste aparelho.';
        },
      );
    });

    const restaurar = async (texto) => {
      try {
        const avisos = await A.restaurar(texto, A.$('#senha-copia').value);
        A.$('#senha-copia').value = '';
        msg.textContent = ['Cópia restaurada.', ...avisos].join(' ');
        return true;
      } catch (erro) {
        msg.textContent = erro.codigo === 'senha_incorreta' ? 'Senha da cópia incorreta.' : erro.message;
        if (erro.codigo === 'precisa_senha') {
          A.$('#restaurar-texto').open = true;
          A.$('#senha-copia').focus();
        }
        return false;
      }
    };
    A.$('#importar').addEventListener('change', async (e) => {
      const arquivo = e.target.files && e.target.files[0];
      if (arquivo) {
        const texto = await arquivo.text();
        if (!(await restaurar(texto))) A.$('#texto-backup').value = texto; // para tentar de novo com a senha
      }
      e.target.value = '';
    });
    A.$('#restaurar-texto-botao').addEventListener('click', async () => {
      if (await restaurar(A.$('#texto-backup').value.trim())) A.$('#texto-backup').value = '';
    });
  }

  // ------------------------------------------------------------ senha do app

  function montarSenha() {
    const msg = A.$('#msg-senha');
    const nova = A.$('#senha-nova');
    const confirma = A.$('#senha-confirma');
    const rotulos = { invalida: 'Mínimo de 4 caracteres.', fraca: 'Senha fraca: use 6 ou mais caracteres.', razoavel: 'Senha razoável.', boa: 'Senha boa.' };
    nova.addEventListener('input', () => {
      A.$('#forca-senha').textContent = nova.value ? rotulos[S.cofre.forcaSenha(nova.value)] : '';
    });
    A.$('#dados-senha').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!S.cofre.senhaValida(nova.value)) {
        msg.textContent = 'A senha precisa ter de 4 a 64 caracteres.';
        return;
      }
      if (nova.value !== confirma.value) {
        msg.textContent = 'As duas senhas não são iguais.';
        return;
      }
      const trocando = A.senha.ativa();
      msg.textContent = 'Protegendo os dados…';
      try {
        await A.senha.definir(nova.value);
        nova.value = '';
        confirma.value = '';
        A.$('#forca-senha').textContent = '';
        msg.textContent = trocando ? 'Senha trocada.' : 'Senha ativada: os dados deste aparelho estão cifrados.';
      } catch (erro) {
        msg.textContent = erro.message;
      }
      A.renderizar('dados', 'inicio');
    });
    A.$('#bloquear-agora').addEventListener('click', () => A.senha.bloquear());
    doisToques(A.$('#remover-senha'), 'Toque de novo para desativar', async () => {
      await A.senha.remover();
      msg.textContent = 'Senha desativada: os dados voltaram a ficar sem proteção.';
      A.renderizar('dados', 'inicio');
    });
  }

  // ----------------------------------------------------------------- pacotes

  function montarPacotes() {
    A.trocar(
      A.$('#partes-pacote'),
      Object.entries(S.sincronizacao.PARTES).map(([k, p]) =>
        A.h('label', { class: 'linha' }, A.h('input', { type: 'checkbox', value: k, checked: ['mapa', 'equipes'].includes(k) }), A.h('span', null, p.rotulo)),
      ),
    );
    const resumo = A.$('#resumo-pacote');

    const gerar = async () => {
      const partes = Array.from(document.querySelectorAll('#partes-pacote input:checked')).map((i) => i.value);
      const pacote = S.sincronizacao.criarPacote(A.estado, partes, { origem: A.estado.nomeSms || '' });
      const texto = JSON.stringify(pacote);
      const senhaPacote = A.$('#senha-pacote').value;
      return senhaPacote ? JSON.stringify(await S.cofre.fechar(texto, senhaPacote)) : texto;
    };

    A.$('#copiar-pacote').addEventListener('click', async () => {
      try {
        const texto = await gerar();
        A.copiarTexto(
          texto,
          null,
          () => A.trocar(resumo, A.h('p', { class: 'ajuda' }, 'Pacote copiado. Cole numa mensagem para quem vai receber.')),
          () => {
            A.$('#texto-pacote').value = texto;
            A.$('#texto-pacote').select();
            A.trocar(resumo, A.h('p', { class: 'ajuda' }, 'O pacote está selecionado no campo “Cole o pacote”: copie e envie.'));
          },
        );
      } catch (erro) {
        A.trocar(resumo, A.h('p', { class: 'aviso' }, erro.message));
      }
    });
    A.$('#baixar-pacote').addEventListener('click', async () => {
      try {
        await A.baixar(`pacote-comunidade-${hoje()}.json`, await gerar());
        A.trocar(resumo, A.h('p', { class: 'ajuda' }, 'Pacote baixado.'));
      } catch (erro) {
        A.trocar(resumo, A.h('p', { class: 'aviso' }, erro.code === 'declined' ? 'Download cancelado.' : erro.message));
      }
    });

    A.$('#arquivo-pacote').addEventListener('change', async (e) => {
      const arquivo = e.target.files && e.target.files[0];
      if (arquivo) A.$('#texto-pacote').value = await arquivo.text();
      e.target.value = '';
    });

    const NOMES = Object.fromEntries(Object.entries(S.sincronizacao.PARTES).map(([k, p]) => [k, p.rotulo.split(':')[0].split(' (')[0]]));
    A.$('#juntar-pacote').addEventListener('click', async () => {
      try {
        let obj = JSON.parse(A.$('#texto-pacote').value.trim());
        if (S.cofre.eCofre(obj)) {
          const senhaPacote = A.$('#senha-receber').value;
          if (!senhaPacote) throw new Error('Este pacote tem senha: digite a senha do pacote.');
          obj = JSON.parse((await S.cofre.abrir(obj, senhaPacote)).texto);
        }
        const r = S.sincronizacao.mesclarPacote(A.estado, obj);
        A.substituirEstado(A.mesclar(r.estado));
        A.$('#texto-pacote').value = '';
        A.$('#senha-receber').value = '';
        A.trocar(
          resumo,
          A.h('p', null, `Pacote${obj.origem ? ` de ${obj.origem}` : ''} juntado aos seus dados:`),
          A.h(
            'ul',
            null,
            Object.entries(r.resumo).map(([parte, x]) =>
              A.h(
                'li',
                null,
                `${NOMES[parte] || parte}: ${x.novos} novo(s), ${x.atualizados} atualizado(s)`,
                x.conflitos && x.conflitos.length ? ` · diferentes, mantidos os daqui: ${x.conflitos.map((k) => (S.situacao.EQUIPES[k] || { nome: k }).nome).join(', ')}` : '',
              ),
            ),
          ),
        );
      } catch (erro) {
        const texto = erro.codigo === 'senha_incorreta' ? 'Senha do pacote incorreta.' : erro instanceof SyntaxError ? 'Não consegui ler o pacote: cole o texto inteiro, sem alterações.' : erro.message;
        A.trocar(resumo, A.h('p', { class: 'aviso' }, texto));
      }
    });
  }

  // ------------------------------------------------------------------ apagar

  function montarApagar() {
    doisToques(A.$('#apagar'), 'Toque de novo para apagar tudo', async () => {
      A.substituirEstado(A.padrao());
      await A.senha.remover();
      await A.aguardarGravacao();
      try {
        localStorage.removeItem(A.CHAVE);
        localStorage.removeItem(`${A.CHAVE}:recuperacao`);
      } catch (erro) {
        /* ignora */
      }
      A.$('#mensagem-apagar').textContent = 'Dados apagados.';
      A.renderizar('dados', 'inicio');
    });
  }

  function render() {
    const ativa = A.senha.ativa();
    A.$('#estado-senha').textContent = ativa ? 'Senha ativa: os dados deste aparelho estão cifrados.' : 'Sem senha: quem pegar o aparelho vê todos os dados.';
    A.$('#definir-senha').textContent = ativa ? 'Trocar senha' : 'Ativar senha';
    A.$('#bloquear-agora').hidden = !ativa;
    A.$('#remover-senha').hidden = !ativa;
    A.$('#rotulo-copia-protegida').hidden = !ativa;
    const dias = S.configuracao.diasDesdeCopia(A.estado);
    A.$('#info-copia').textContent =
      dias === null ? 'Nenhuma cópia feita ainda. Guarde-a fora deste aparelho (e-mail, pen drive, outro celular).' : `Última cópia: ${dias === 0 ? 'hoje' : `há ${dias} dia(s)`}. Faça uma por semana.`;
  }

  (S.extensoes = S.extensoes || []).push({
    nome: 'dados',
    montar(api) {
      A = api;
      montarCopia();
      montarSenha();
      montarPacotes();
      montarApagar();
    },
    render,
  });
})();
