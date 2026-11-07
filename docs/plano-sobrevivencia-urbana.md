# Plano de Sobrevivência Urbana

Plano de preparação para famílias e para a comunidade (igreja, vizinhança) enfrentarem
emergências na cidade: enchentes, deslizamentos, apagões, falta d'água, incêndios,
violência urbana, desabastecimento e crises sanitárias.

> Este plano **não substitui** as orientações da Defesa Civil, do Corpo de Bombeiros e
> das autoridades de saúde. Em caso de perigo imediato, ligue **193** (Bombeiros),
> **192** (SAMU), **190** (Polícia Militar) ou **199** (Defesa Civil).

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
| 1 | **Atenção** (amarelo) | Alerta da Defesa Civil, chuva forte contínua, queda curta de energia | Monitorar e preparar: carregar celulares, conferir kit, encher reservatórios |
| 2 | **Alerta** (laranja) | Sem energia > 24 h, sem água da rede, desabastecimento | Racionar, ativar a rede de apoio, preparar a saída se a autonomia for baixa |
| 3 | **Emergência** (vermelho) | Água entrando em casa, sinais de deslizamento, fogo, gás, tiroteio, ordem de evacuação | **Evacuar** ou **abrigar no local**, conforme o risco |

**Mecanismo:** *Triagem da situação* (`js/nucleo/situacao.js`) — a partir dos sinais
observados e da autonomia da casa, calcula o nível, a postura recomendada
(normal / monitorar / preparar para sair / abrigar no local / evacuar), os motivos e
quem acionar.

### Ficar ou sair?

- **Evacuar** quando o risco está *dentro* do imóvel ou do terreno: água subindo, sinais
  de deslizamento, fogo, cheiro forte de gás, ordem das autoridades.
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
- **Privacidade (LGPD):** colete o mínimo de dados, com consentimento, e guarde-os com a
  coordenação. O aplicativo armazena tudo apenas no próprio aparelho.

## 5. Rotina de manutenção

| Frequência | Tarefa |
|---|---|
| Mensal | Conferir validades do estoque; carregar power banks; testar lanternas e rádio |
| A cada 6 meses | Trocar a água armazenada; revisar o kit (roupas das crianças, remédios); atualizar contatos |
| Anual | Simulado de evacuação com a família; teste da árvore de chamadas com a comunidade; revisar este plano |
| Início da estação de chuvas | Limpar calhas e ralos; conferir rotas de saída e pontos altos do bairro; cadastrar o CEP no alerta da Defesa Civil (SMS **40199**) |

## 6. Contatos de emergência (Brasil)

| Serviço | Número |
|---|---|
| Polícia Militar | 190 |
| SAMU | 192 |
| Corpo de Bombeiros | 193 |
| Defesa Civil | 199 |
| Alertas da Defesa Civil por SMS | envie seu CEP para 40199 |

Acrescente os números locais: concessionárias de energia, água e gás, posto de saúde,
hospital de referência, coordenação da igreja e o contato fora da cidade.
