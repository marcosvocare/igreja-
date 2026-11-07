# Sobrevivência Urbana

Plano de sobrevivência urbana para famílias e para a comunidade (igreja, vizinhança),
com **mecanismos práticos** para executá-lo e um **app que funciona sem internet**.

- 📄 **Plano:** [`docs/plano-sobrevivencia-urbana.md`](docs/plano-sobrevivencia-urbana.md) —
  princípios, fases, níveis de alerta, pontos de encontro, rotina de manutenção e o papel
  da igreja como ponto de apoio.
- ⚙️ **Mecanismos:** `js/nucleo/` — cada pilar do plano virou uma ferramenta testada.
- 📱 **App offline:** `index.html` — abre direto no navegador, sem servidor e sem internet.

> Ferramenta de preparação. Não substitui as orientações da Defesa Civil, do Corpo de
> Bombeiros e das autoridades de saúde. Perigo imediato: **193**, **192**, **190**, **199**.

## Mecanismos

| Mecanismo | O que faz | Arquivo |
|---|---|---|
| **Triagem da situação** | A partir dos sinais observados (chuva, falta de energia, água subindo, tiroteio…) e da autonomia da casa, calcula o nível de alerta (0–3) e decide a postura: rotina, monitorar, racionar, preparar a saída, abrigar no local, evacuar ou pedir socorro. Indica quem acionar e o protocolo relacionado. | `situacao.js` |
| **Protocolos por cenário** | Antes / durante / depois para colapso dos serviços (sem bombeiros, polícia e SAMU), enchente, deslizamento, apagão, falta d'água, incêndio, onda de calor, tiroteio, vazamento de gás, desabastecimento, epidemia e vendaval. | `cenarios.js` |
| **Calculadora de suprimentos** | Água (beber, higiene, preparo dos alimentos, animais), calorias, lista de compras por kg, fraldas, fórmula e ração, conforme a composição da casa e os dias de meta. Avisa quando falta comida que dispensa fogão. | `suprimentos.js` |
| **Estoque e autonomia** | Validades na ordem "o primeiro que vence é o primeiro que sai", dias de autonomia (água × comida, apontando o gargalo), quanto falta para a meta e plano de racionamento. | `estoque.js` |
| **Água segura** | Gotas de água sanitária por volume e concentração (dobra se turva), tempo de fervura por altitude, métodos (fervura, cloração, SODIS, filtragem) e fontes de água escondidas em casa. | `agua.js` |
| **Kit de 72 horas** | Mochila de emergência personalizada para bebês, crianças, idosos, gestantes, mobilidade reduzida, dependentes de energia e pets, com progresso salvo. | `kit.js` |
| **Plano de comunicação** | Árvore de chamadas (cada um avisa até N pessoas), SMS padronizados sem acento (160 caracteres em vez de 70), próxima janela de contato, cargas de power bank e cartão de bolso para imprimir. | `comunicacao.js` |
| **Mapa de recursos** | Fontes de água, remédios, alimentos, abrigos e zonas de perigo, com coordenadas (do Google Maps ou do GPS do aparelho). Indica a melhor opção a partir da base, com distância, direção, tempo a pé, tratamento da água e aviso quando a rota atravessa ou passa perto de um perigo. Desenha o mapa ao redor da base sem internet. | `mapa.js` |
| **Remédios críticos** | Dias que o remédio de cada pessoa dura (considerando a validade), quem está em risco e quanto falta para 30 dias. | `remedios.js` |
| **Partilha justa** | Divide a água e a comida do estoque comum pela necessidade de cada família, com prioridade para bebês, gestantes, idosos e doentes. | `partilha.js` |
| **Defesa comunitária** | Defesa passiva e legal: escala de vigia em duplas com descanso garantido, senha do dia calculada a partir de uma frase combinada, avaliação de segurança da casa com prioridades e código de sinais. | `defesa.js` |
| **Rede de apoio comunitária** | Cadastro de habilidades (saúde, carro, gerador, abrigo…) e necessidades (acamado, idoso sozinho, dependente de energia…); pareia quem precisa com quem pode ajudar, priorizando o mesmo bairro e distribuindo a carga, e aponta lacunas por bairro. | `rede.js` |

## Como usar

**Sem instalar nada:** baixe ou clone o repositório e abra `index.html` no navegador
(computador ou celular). Os dados ficam salvos **apenas no próprio aparelho**; use a aba
**Dados** para baixar e restaurar cópias de segurança.

**Publicado na internet (opcional):** hospede a pasta como site estático (ex.: GitHub
Pages). Ao abrir uma vez com conexão, o service worker (`sw.js`) guarda o app e ele passa
a funcionar offline, podendo ser instalado na tela inicial.

## Desenvolvimento

Os mecanismos são JavaScript puro, sem dependências, e funcionam tanto no navegador
(`<script>` comum, compatível com `file://`) quanto no Node.

```bash
npm test   # Node 18+
```

```
docs/plano-sobrevivencia-urbana.md   plano completo
js/nucleo/*.js                       mecanismos (lógica pura, testada)
js/app.js                            interface
js/app-colapso.js                    abas Mapa, Defesa, Remédios e Partilha
index.html, css/estilo.css           app offline
sw.js, manifest.webmanifest          uso offline quando publicado
tests/*.test.js                      testes dos mecanismos
```

Todos os valores (água por pessoa, calorias, dosagem de cloro etc.) são estimativas de
planejamento baseadas em orientações públicas; ajuste à realidade da sua família e da
sua cidade.
