# Sobrevivência Urbana

Plano de sobrevivência para famílias e para a comunidade da igreja num cenário **sem
serviços do Estado** (sem bombeiros, polícia, SAMU nem defesa civil para chamar), com
cada parte do plano transformada em uma ferramenta que funciona **sem internet**.

- 📄 **Plano:** [`docs/plano-sobrevivencia-urbana.md`](docs/plano-sobrevivencia-urbana.md)
- 📱 **App:** `index.html` — abre no navegador, instala na tela inicial e funciona offline.
- ⚙️ **Mecanismos:** `js/nucleo/` — a lógica de cada parte, testada.

> Perigo imediato: código **2** no rádio da família, **3 toques de apito** repetidos ou
> folha escrita **AJUDA** na janela. O socorro vem das equipes da comunidade (aba
> Comunidade → Rede de apoio → Equipes de socorro).

## O que o app faz

| Seção | Abas |
|---|---|
| **Agora** | **Situação** (triagem: nível de alerta, ficar, reunir as famílias, abrigar ou evacuar, e qual equipe acionar) · **Protocolos** (13 cenários: colapso, apagão cibernético (internet, celular e bancos fora do ar), enchente, deslizamento, apagão de energia, falta d'água, incêndio, calor, tiroteio, gás, desabastecimento, epidemia, vendaval) · **Primeiros socorros** (12 guias com o que não fazer e quando é grave) |
| **Mapas** | **Cidade** (mapa de Hortolândia sem internet: ruas, bairros, rios, farmácias, hospitais, mercados, caixas d'água, igrejas, escolas, gás e combustível; busca sem acento; quadrículas de 1 km para dizer a posição pelo rádio; rota a pé que desvia dos perigos) · **Meus pontos** (água, remédios, comida, abrigo e perigos marcados pela comunidade; melhor opção a partir da base; pontos por coordenada, GPS ou distância e direção) · **Bússola** (sensor do celular corrigido para o norte verdadeiro, −21,8° em Hortolândia; quanto virar até um ponto; marcar ponto pelo rumo; sol agora; métodos sem bússola) |
| **Recursos** | **Água** (dosagem de cloro, fervura) · **Higiene** (banheiro sem água, latrina, lixo) · **Estoque** (validade e dias de autonomia) · **Casa e suprimentos** (água e comida da casa, dietas, animais) · **Cozinha** (gás, conservar sem geladeira, horta) · **Energia** (painel solar, bateria, power bank) · **Remédios** (dias de cobertura, doses, onde buscar) |
| **Comunidade** | **Rede de apoio** (quem ajuda quem e as equipes de socorro) · **Partilha** (estoque comum dividido com justiça) · **Abrigo** (capacidade da igreja, chegadas, tarefas) · **Pessoas e recados** · **Cuidado** emocional e espiritual · **Defesa** passiva (vigia, senha do dia, segurança da casa, sinais) |
| **Comunicação** | **Contatos e mensagens** (pontos de encontro, árvore de chamadas, SMS, cartão de bolso) · **Rádio** (rede Meshtastic: alcance, repetidor, testes no bairro, canais, códigos) |
| **Preparação** | **Começar** (10 passos conferidos pelo app) · **Kit 72 h** · **Caderno** em papel (imprimir ou baixar) · **Dados e senha** |

### Segurança e dados

- Tudo fica **só no aparelho**. Nada vai para servidor nenhum.
- **Senha do app:** com ela, os dados são cifrados no aparelho (AES-GCM de 256 bits,
  chave derivada da senha por PBKDF2-SHA-256 com 210 mil rodadas). Sem a senha, ninguém
  abre, nem quem fez o app. O app se bloqueia depois de 10 minutos sem uso.
- **Cópia de segurança:** baixar ou copiar como texto, com ou sem a senha. O app lembra
  quando faz mais de 7 dias sem cópia.
- **Compartilhar com a comunidade:** pacotes com as partes escolhidas (mapa, equipes,
  rede, rádios, pessoas, recados…), com senha opcional. Quem recebe junta aos seus dados
  sem perder nada. Estoque, remédios e a frase da senha do dia nunca vão em pacote.

## Instalar e usar sem internet

**Pelo site (recomendado): https://marcosvocare.github.io/igreja-/**

1. Abra o endereço uma vez **com internet**.
2. Instale: no Android (Chrome), botão **Instalar o app** na aba Dados ou menu ⋮ →
   **Instalar app**; no iPhone (Safari), **Compartilhar → Adicionar à Tela de Início**.
3. Teste: desligue o wi-fi e os dados e abra pelo ícone. Se abrir (inclusive o mapa da
   cidade), está pronto para usar sem internet.

O site é publicado pelo GitHub Pages a partir do branch `gh-pages`, que a automação
`.github/workflows/site.yml` copia do `main` a cada atualização. Com internet, o app
instalado pega a versão nova sozinho.

**Sem publicar:** baixe a pasta do projeto no aparelho e abra `index.html` no navegador.

**Versão publicada no claude.ai:** a mesma interface num arquivo único
(`npm run build:unica`). Ela precisa de internet e de login; use a cópia por texto para
levar os dados de uma versão para a outra.

## Desenvolvimento

JavaScript puro, sem dependências em produção. Cada mecanismo em `js/nucleo/` funciona
no navegador (`<script>` comum, compatível com `file://`) e no Node.

```bash
npm test             # testes dos mecanismos (Node 18+)
npm ci && npx playwright install chromium
npm run test:e2e     # testes no navegador, inclusive uso sem internet e a versão de arquivo único
npm run build:unica  # gera dist/sobrevivencia-urbana.html (versão de arquivo único)
```

A checagem automática (`.github/workflows/testes.yml`) roda os três a cada envio.

```
index.html, css/estilo.css     app
js/app.js                      núcleo: estado, senha, gravação, navegação, tema
js/abas/*.js                   uma aba por arquivo (registradas como extensões)
js/nucleo/*.js                 mecanismos (lógica pura e testada)
sw.js, manifest.webmanifest    uso offline e instalação
tests/*.test.js                testes dos mecanismos
tests/e2e/*.e2e.js             testes no navegador
scripts/gerar-pagina-unica.js  versão de arquivo único
scripts/baixar-mapa-osm.js     baixa a área de Hortolândia do OpenStreetMap
scripts/gerar-mapa-cidade.js   gera dados/mapa-hortolandia.js (ruas, bairros, locais)
dados/                         mapa da cidade e a licença dos dados
docs/                          o plano
```

### Mapa da cidade

`dados/mapa-hortolandia.js` (602 KB) junta o **OpenStreetMap** (ruas, bairros, rios e
parte dos locais; © colaboradores do OpenStreetMap, ODbL) e a **Overture Maps** (a maior
parte dos 1.929 estabelecimentos: 572 igrejas, 366 mercados, 118 farmácias…;
© Overture Maps Foundation, CDLA-Permissive-2.0). Veja `dados/LICENCA-MAPA.md`. O app
só o carrega quando a aba Cidade é aberta, e o service worker o guarda para uso sem
internet. Para atualizar ou fazer o de outra cidade:

```bash
NODE_USE_ENV_PROXY=1 node scripts/baixar-mapa-osm.js   # precisa de internet só aqui
pip install pyarrow && python3 scripts/baixar-locais-overture.py
node scripts/gerar-mapa-cidade.js
```

Os valores de água, calorias, cloro, energia e capacidade são estimativas de
planejamento baseadas em referências públicas (OMS, Projeto Esfera). A declinação
magnética vem do modelo WMM2025. Ajuste à realidade da sua família e da sua comunidade.
