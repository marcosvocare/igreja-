# Plano de Sobrevivência Urbana

Plano de preparação para famílias e para a comunidade (igreja, vizinhança) enfrentarem
emergências na cidade: enchentes, deslizamentos, apagões, falta d'água, incêndios,
violência urbana, desabastecimento e crises sanitárias.

> **Não existem mais serviços do Estado.** Não há bombeiros, polícia, SAMU nem defesa civil
> para chamar: o socorro vem das **equipes da própria comunidade** (seção 7). Em perigo
> imediato, mande o **código 2** no rádio da família ou dê **3 toques de apito, repetidos**.

Cada pilar deste plano tem um **mecanismo** correspondente — uma ferramenta concreta,
implementada em `js/nucleo/` e disponível no aplicativo offline (`index.html`).

---

## 1. Princípios

1. **Prioridades de sobrevivência (regra dos 3)** — em condições extremas uma pessoa
   resiste cerca de 3 minutos sem ar, 3 horas sem abrigo (frio/calor intenso), 3 dias sem
   água e 3 semanas sem comida. A ordem de ação segue essa lógica: segurança imediata →
   abrigo → água → comida.
2. **Decidir cedo** — sair enquanto a rota ainda é segura vale mais do que sair no pior
   momento. Os níveis de alerta existem para antecipar a decisão.
3. **Redundância** — todo recurso crítico tem plano B: dois pontos de encontro, duas
   formas de purificar água, contatos no papel além do celular.
4. **Autonomia mínima de 72 horas** — é o tempo que o socorro público pode levar para
   chegar em um desastre de grande escala. Meta da casa: **7 a 14 dias**.
5. **Ninguém fica para trás** — idosos, pessoas acamadas, com deficiência, gestantes,
   crianças e animais têm necessidades próprias, previstas antes da crise.
6. **Comunidade é recurso** — vizinhos e a igreja multiplicam habilidades, equipamentos
   e informação. Preparação individual + rede de apoio.

## 2. Fases

| Fase | Quando | Foco |
|---|---|---|
| **Preparação** | Antes | Estoque, kit de 72 h, plano de comunicação, mapeamento da rede, treino |
| **Resposta** | Durante | Avaliar a situação, decidir entre ficar ou sair, executar o protocolo do cenário |
| **Recuperação** | Depois | Segurança do imóvel, saúde (ex.: leptospirose após enchente), reposição do estoque, revisão do plano |

## 3. Níveis de alerta

| Nível | Nome | Exemplos de sinais | Postura |
|---|---|---|---|
| 0 | **Normal** (verde) | Nenhum sinal | Manter a rotina de manutenção |
| 1 | **Atenção** (amarelo) | Alerta da vigilância, chuva forte contínua, queda curta de energia | Monitorar e preparar: carregar celulares, conferir kit, encher reservatórios |
| 2 | **Alerta** (laranja) | Sem energia > 24 h, sem água da rede, desabastecimento | Racionar, ativar a rede de apoio, preparar a saída se a autonomia for baixa |
| 3 | **Emergência** (vermelho) | Água entrando em casa, sinais de deslizamento, fogo, gás, tiroteio, ordem de evacuação | **Evacuar** ou **abrigar no local**, conforme o risco |

**Mecanismo:** *Triagem da situação* (`js/nucleo/situacao.js`) — a partir dos sinais
observados e da autonomia da casa, calcula o nível, a postura recomendada
(normal / monitorar / preparar para sair / abrigar no local / evacuar), os motivos e
quem acionar.

### Ficar ou sair?

- **Evacuar** quando o risco está *dentro* do imóvel ou do terreno: água subindo, sinais
  de deslizamento, fogo, cheiro forte de gás, ordem da coordenação da comunidade.
- **Reunir as famílias** quando há saques ou violência no bairro, sem risco imediato no
  imóvel: famílias vizinhas juntas numa casa mais segura ou no ponto de apoio da igreja.
- **Abrigar no local** quando o risco está *do lado de fora*: tiroteio, nuvem de fumaça ou
  produto químico.
- Se há risco dentro **e** fora, o risco imediato dentro do imóvel prevalece: sair pelo
  caminho mais protegido.
- **Preparar para sair** (antes de virar emergência) quando a crise é prolongada e a casa
  tem menos de 3 dias de autonomia, ou quando alguém depende de energia elétrica
  (oxigênio, aparelhos, insulina refrigerada) e a falta de energia já passa de 24 h.

## 4. Pilares e mecanismos

| Pilar | Mecanismo | Arquivo |
|---|---|---|
| Avaliação da situação | Triagem: nível de alerta + ficar ou sair | `js/nucleo/situacao.js` |
| Protocolos | Antes / durante / depois para 11 cenários urbanos | `js/nucleo/cenarios.js` |
| Água | Dosagem de hipoclorito, tempo de fervura, métodos de purificação | `js/nucleo/agua.js` |
| Suprimentos | Calculadora de água, calorias, lista de alimentos e itens especiais | `js/nucleo/suprimentos.js` |
| Estoque | Controle de validade (o primeiro que vence é o primeiro que sai) e dias de autonomia | `js/nucleo/estoque.js` |
| Kit de 72 h | Mochila de emergência personalizada pela composição da família | `js/nucleo/kit.js` |
| Comunicação | Árvore de chamadas, SMS padronizados, janelas de contato, cargas de power bank | `js/nucleo/comunicacao.js` |
| Comunidade | Mapa de habilidades e necessidades; pareamento de quem precisa com quem pode ajudar | `js/nucleo/rede.js` |
| Rádio da família | Rede Meshtastic (celular + rádio LoRa): alcance, saltos, repetidor, plano de canais e mensagens | `js/nucleo/radio.js` |
| Mapa de recursos | Fontes de água, remédios, alimentos, abrigos e zonas de perigo; melhor opção a partir da base | `js/nucleo/mapa.js` |
| Mapa da cidade | Ruas, bairros e locais úteis de Hortolândia sem internet; quadrículas de 1 km; rota a pé que desvia dos perigos | `js/nucleo/cartografia.js` |
| Bússola | Sensor do celular com correção para o norte verdadeiro, rumo até um ponto, sol e métodos sem bússola | `js/nucleo/bussola.js` |
| Remédios críticos | Dias de cobertura por pessoa, validade e reposição | `js/nucleo/remedios.js` |
| Partilha justa | Divisão do estoque comum pela necessidade de cada família | `js/nucleo/partilha.js` |
| Defesa comunitária | Escala de vigia, senha do dia, avaliação de segurança e código de sinais | `js/nucleo/defesa.js` |
| Primeiros socorros | 12 guias para leigos, com o que não fazer e quando é grave | `js/nucleo/socorros.js` |
| Higiene e saneamento | Banheiro sem água, latrina, mãos, lixo; banheiros e sabão por pessoas | `js/nucleo/saneamento.js` |
| Cozinha | Duração do gás, economia, conservar sem geladeira, horta rápida | `js/nucleo/cozinha.js` |
| Energia | Consumo, painel solar, bateria e power banks | `js/nucleo/energia.js` |
| Abrigo coletivo | Capacidade, chegadas e saídas, escala de tarefas, regras | `js/nucleo/abrigo.js` |
| Pessoas e recados | Quem está onde (desaparecidos primeiro) e quadro de recados | `js/nucleo/pessoas.js` |
| Cuidado | Acolhimento, crianças, luto, quem cuida e sinais de alerta | `js/nucleo/cuidado.js` |
| Proteção dos dados | Senha do app com criptografia | `js/nucleo/cofre.js` |
| Partilha de dados | Pacotes para juntar dados entre aparelhos | `js/nucleo/sincronizacao.js` |
| Primeiro uso | Passos de preparação e lembrete de cópia | `js/nucleo/configuracao.js` |

### 4.1 Água

- **Reserva:** no mínimo 4 L por adulto por dia (beber + higiene mínima), mais a água para
  cozinhar os alimentos secos.
- **Purificação (em ordem de preferência):**
  1. Fervura vigorosa por 1 minuto (3 minutos acima de 2.000 m de altitude).
  2. Cloração com água sanitária **sem perfume** (2,0–2,5 %): 2 gotas por litro, aguardar
     30 minutos. Água turva: filtrar antes e dobrar a dose.
  3. SODIS: garrafa PET transparente de até 2 L, 6 horas de sol forte (2 dias se nublado).
     Só funciona com água limpa (não turva).
- Filtrar com pano ou filtro de barro remove sujeira, **mas não desinfeta**.
- Recipientes sempre tampados (evita contaminação e criadouros do *Aedes aegypti*).

### 4.2 Suprimentos e estoque

- Planejar por **calorias**: ~2.000 kcal/dia por adulto, 1.400 por criança, 1.800 por idoso.
- Pelo menos 3 dias de comida **pronta para consumo** (não depende de gás nem de água).
- Rotação: usar no dia a dia e repor — o item que vence primeiro sai primeiro.
- Remédios de uso contínuo para 7 dias, com cópia das receitas.

### 4.3 Kit de 72 horas (mochila de emergência)

Uma mochila por pessoa (ou por família), pronta perto da porta: documentos, dinheiro em
espécie, água, comida pronta, remédios, lanterna, rádio, power bank, roupas, higiene e
itens específicos para bebês, crianças, idosos, pessoas com mobilidade reduzida e pets.

### 4.4 Comunicação

- **Contato fora da cidade:** uma pessoa de referência fora da área afetada (a rede de longa
  distância costuma funcionar quando a local está congestionada).
- **Árvore de chamadas:** cada pessoa avisa no máximo 3 outras — a mensagem chega a todos
  em poucas rodadas.
- **SMS em vez de ligação:** SMS passa melhor em rede congestionada. Mensagens sem acento
  cabem em 160 caracteres; com acento, o limite cai para 70.
- **Janelas de contato:** em crise longa, ligar o celular só nos horários combinados
  (ex.: 8h, 12h, 18h e 21h) para poupar bateria.
- **Cartão de bolso:** contatos e pontos de encontro **impressos** na carteira de cada um.
- **Rádio quando o celular cai:** cada pessoa leva um rádio LoRa com Meshtastic, ligado ao
  celular por Bluetooth. As mensagens pulam de rádio em rádio, sem operadora, sem internet
  e sem depender de ninguém de fora. Um repetidor no
  ponto mais alto (a torre ou o telhado da igreja, com energia solar) cobre o bairro.
  O canal principal fica no padrão, para que outros rádios da cidade também retransmitam;
  a família usa um canal secundário com chave própria, compartilhada pessoalmente pelo
  QR code. **Mecanismo:** *Rádio da família* (`js/nucleo/radio.js`) estima quem alcança
  quem, em quantos saltos, quem fica isolado e onde pôr o repetidor, e gera o plano de
  canais, os nomes dos aparelhos e mensagens que cabem no limite de uma mensagem LoRa.

### 4.5 Pontos de encontro

1. **Na casa** — local seguro fora do imóvel (ex.: em frente ao portão do vizinho).
2. **No bairro** — ponto conhecido e seguro (ex.: a igreja, uma praça alta, uma escola).
3. **Fora do bairro** — casa de parente ou amigo, para quando o bairro for evacuado.

### 4.6 Comunidade (papel da igreja)

- **Ponto de apoio:** o templo pode servir como ponto de encontro, de distribuição de
  doações, de recarga de celulares (com gerador ou energia solar) e quadro de avisos físico.
- **Mapa de habilidades e necessidades:** quem é da área da saúde, quem tem carro, gerador,
  quem cozinha, quem cuida de crianças — e quem é idoso morando sozinho, acamado, depende
  de energia ou não tem transporte.
- **Pareamento:** cada pessoa vulnerável tem alguém designado, de preferência no mesmo
  bairro, para verificar como ela está e ajudá-la a sair se necessário.
- **Privacidade:** colete o mínimo de dados, com consentimento, e guarde-os com a
  coordenação. O aplicativo armazena tudo apenas no próprio aparelho.

## 5. Colapso e desordem

Sem serviços do Estado e com a desordem espalhada, a comunidade é o socorro. O objetivo continua o mesmo: **manter todos vivos, sem confronto**.

### 5.1 Organização

A rede da igreja se divide em equipes, cada uma com um responsável e um substituto:

| Equipe | Faz |
|---|---|
| Vigilância | Escala de vigia em duplas, código de sinais, senha do dia |
| Saúde | Primeiros socorros, controle de remédios críticos, visita a doentes |
| Água | Mapeia e trata fontes, distribui água clorada |
| Alimentação | Estoque comum, cozinha comunitária, partilha justa |
| Comunicação | Árvore de chamadas, quadro de avisos, atualização do mapa |
| Incêndio | Extintores, baldes de areia e água, combate a focos pequenos |
| Resgate | Enchentes, deslizamentos, retirada de pessoas presas ou isoladas |
| Coordenação | Decide evacuações, organiza abrigo, partilha e mediação entre vizinhos |

### 5.2 Mapeamento de água, remédios e alimentos

**Mecanismo:** *Mapa de recursos* (`js/nucleo/mapa.js`).

- Cada ponto tem categoria, tipo, coordenadas, situação (disponível, escasso, não
  verificado, esgotado, inseguro) e a hora em que foi confirmado.
- Zonas de perigo (conflito, saque, alagamento, desabamento, contaminação) entram no
  mesmo mapa, com raio.
- A busca indica a melhor opção a partir da base, pesando distância, situação, quão
  recente é a informação e se a rota **atravessa** (×3) ou **passa perto** (×1,5) de uma
  zona de perigo. Informação com mais de 3 dias vale como desatualizada.
- Água de qualquer fonte do mapa traz o tratamento obrigatório (ferver ou clorar).
- Quem volta de uma saída atualiza a situação dos pontos que viu.

**Mapa da cidade:** *Cartografia* (`js/nucleo/cartografia.js`) e o arquivo
`dados/mapa-hortolandia.js`, gerado do OpenStreetMap e guardado no aparelho.

- Ruas, bairros, rios, lagos, ferrovia, limite do município e 324 locais úteis:
  farmácias, hospitais e clínicas, mercados, caixas d'água, igrejas, escolas, revendas
  de gás, postos de combustível e lojas de ferragens. Um local do mapa vira um ponto
  da comunidade com um toque, como "não verificado", até alguém passar lá.
- **Quadrículas de 1 km:** colunas com letras (oeste → leste) e linhas com números
  (norte → sul). Pelo rádio, "equipe de resgate na F6" basta para achar a área, sem
  coordenadas.
- **Rota a pé** pelas ruas, com instruções de virada. Atravessar uma zona de perigo
  custa 10 vezes o trecho, passar a menos de 100 m dela custa 2 vezes e uma rua
  bloqueada custa 100 vezes. Se não houver caminho limpo, a rota avisa.
- O mapa pode estar desatualizado: confira no local e marque o que mudou.

**Orientação:** *Bússola* (`js/nucleo/bussola.js`).

- A bússola do celular aponta o norte **magnético**. Em Hortolândia ele fica cerca de
  **22° a oeste** do norte verdadeiro (−21,8° em 2026, pelo modelo WMM2025). O app
  corrige isso; numa bússola de agulha, some a diferença de cabeça.
- Sem sensor: posição do sol pela hora (de frente para o sol, para que lado fica o
  norte), método da sombra, relógio de ponteiros, Cruzeiro do Sul e agulha imantada.
- **Marcar pelo rumo:** quem vê fumaça ou uma caixa d'água ao longe aponta o celular,
  estima a distância e o ponto entra no mapa.

**Remédios:** *Remédios críticos* (`js/nucleo/remedios.js`) mostra quantos dias o remédio
de cada pessoa dura, considerando a validade, e o que falta para 30 dias. Nunca se
interrompe ou troca remédio sem orientação de um profissional de saúde.

**Alimentos e água em comum:** *Partilha justa* (`js/nucleo/partilha.js`) divide o estoque
comum pela necessidade de cada família. Quando não há para todos, cada família recebe a
mesma porcentagem do que precisa; bebês, gestantes, idosos e doentes recebem um pouco
mais, até 100 %. A sobra de quem já foi atendido volta para os demais.

### 5.3 Defesa comunitária

**Mecanismo:** *Defesa comunitária* (`js/nucleo/defesa.js`). Defesa **passiva e legal**:

- **Princípio:** nenhum bem vale uma vida. Não reagir a saque ou assalto; vigia observa,
  avisa e se recolhe.
- **Juntos é mais seguro:** famílias vizinhas reunidas ou no ponto de apoio da igreja.
- **Barreiras e detecção:** portas e janelas reforçadas, luz que não depende da rede,
  visibilidade das entradas, vizinhos combinados para observar.
- **Escala de vigia:** duplas, turnos curtos e descanso mínimo garantido; o mecanismo
  calcula quantos voluntários são necessários.
- **Senha do dia:** todos que conhecem a frase secreta combinada pessoalmente calculam as
  mesmas palavras no mesmo dia, sem transmiti-las. Serve para reconhecer quem chega.
- **Código de sinais:** apito, lanterna e folha na janela (OK / AJUDA).
- **Discrição:** estoque fora da vista; partilha pela rede, não na porta de casa.
- **Saídas:** só em grupo, de dia, evitando as zonas de perigo do mapa, com hora de volta.
- **Sem armadilhas e sem armas improvisadas:** ferem crianças, vizinhos e socorristas, são
  crime e aumentam a violência contra a comunidade.

### 5.4 Incêndio e ferimentos sem socorro

- Fogo: só combater foco pequeno (do tamanho de uma lixeira), com a saída às costas. Se
  crescer, sair, fechar a porta e afastar os vizinhos.
- Ferimentos: pressionar sangramentos, imobilizar fraturas e levar, em grupo, ao
  profissional de saúde da rede ou ao hospital funcionando mais próximo (aba Mapa).

### 5.5 Saúde sem socorro de fora

- **Primeiros socorros:** cada casa com o kit e alguém que pratique os guias (RCP,
  sangramento, engasgo, queimadura, fratura, choque, soro caseiro, convulsão).
- **Saneamento:** sem água encanada, diarreia mata. Banheiro de balde com serragem ou
  cal, latrina a 30 m de poços e nascentes, um banheiro para cada 20 pessoas, mãos
  lavadas sempre, nada de água parada.

### 5.6 Abrigo e pessoas

- O templo recebe com dignidade: 3,5 m² cobertos por pessoa, 20 pessoas por banheiro,
  15 litros de água por pessoa por dia. O menor desses limites é a capacidade.
- Cadastro de quem chega e de quem sai, escala de tarefas por família e regras de
  convivência afixadas na entrada.
- Lista de pessoas da comunidade com a situação de cada uma (desaparecidos e feridos
  primeiro) e um quadro de recados no ponto de encontro.

### 5.7 Energia e cozinha

- Energia vai primeiro para aparelhos de saúde, rádios e celulares. Painel solar com
  controlador de carga; gerador só ao ar livre.
- Gás dura mais com molho, panela de pressão e caixa térmica. Comer primeiro o que
  estraga primeiro; horta de colheita rápida desde o primeiro dia.

### 5.8 Cuidado emocional e espiritual

- Acolher (observar, escutar, aproximar), manter crianças com seus cuidadores e com
  rotina, permitir o luto e cuidar de quem cuida.
- Quem fala em morrer ou se machucar não fica sozinho: equipe de saúde e liderança da
  igreja na hora.

## 6. Rotina de manutenção

| Frequência | Tarefa |
|---|---|
| Mensal | Conferir validades do estoque; carregar power banks; testar lanternas e rádio |
| A cada 6 meses | Trocar a água armazenada; revisar o kit (roupas das crianças, remédios); atualizar contatos |
| Anual | Simulado de evacuação com a família; teste da árvore de chamadas com a comunidade; revisar este plano |
| Início da estação de chuvas | Limpar calhas e ralos; conferir rotas de saída e pontos altos do bairro; treinar com a equipe de resgate os sinais de deslizamento e o código de apitos |

## 7. Socorro da comunidade

Não há números de emergência do governo. Cada equipe tem um responsável e um substituto,
com nome curto do rádio e local onde encontrá-los (aba **Rede de apoio → Equipes de
socorro**). Os contatos aparecem na triagem e no cartão de bolso.

| Equipe | Acionar quando |
|---|---|
| Coordenação da comunidade | Evacuação, abrigo, partilha, saques e desordem |
| Equipe de saúde | Ferimentos, doenças, insolação, remédios |
| Brigada de incêndio | Fogo, fumaça, cheiro de gás, fios caídos |
| Equipe de resgate | Enchente, deslizamento, pessoas presas ou soterradas |
| Vigilância | Tiroteio, movimentação suspeita, alertas |
| Equipe de água | Fontes, tratamento e distribuição de água |

**Como pedir socorro:** código **2** no canal da família do rádio (com a posição ligada);
sem rádio, **3 toques de apito repetidos** ou **3 piscadas de lanterna** à noite; na janela,
folha escrita **AJUDA**.

## 8. Proteção e partilha dos dados

- **Senha do app:** os dados do aparelho ficam cifrados; sem a senha ninguém lê. Em caso
  de saque ou roubo do celular, a lista de quem tem estoque, remédios e endereços fica
  protegida.
- **Cópia de segurança semanal**, guardada fora do aparelho (pen drive, outro celular).
- **Pacotes para a comunidade:** cada um passa à coordenação o que viu (mapa, pessoas,
  recados); a coordenação junta e devolve. Nada se perde ao juntar.
- **Caderno em papel:** imprima equipes, contatos, mapa, remédios, escala e protocolos.
  Quando a bateria acabar, o papel continua.
