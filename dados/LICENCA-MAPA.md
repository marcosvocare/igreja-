# Licença dos dados do mapa

O arquivo `mapa-hortolandia.js` junta duas bases abertas:

- **Ruas, bairros, rios, limite do município e parte dos locais:** OpenStreetMap.
  **© colaboradores do OpenStreetMap**, sob a
  [Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
  Mais informações em <https://www.openstreetmap.org/copyright>.
- **A maior parte dos estabelecimentos** (igrejas, mercados, farmácias, saúde, escolas,
  gás, água e combustível): **© Overture Maps Foundation**, sob a
  [CDLA-Permissive-2.0](https://cdla.dev/permissive-2-0/). Alguns registros vêm de
  fontes da Overture com outras licenças abertas (Foursquare: Apache 2.0;
  AllThePlaces: CC0). Mais informações em <https://docs.overturemaps.org/attribution/>.

Cada local guarda de qual base veio (o app mostra "OpenStreetMap" ou "Overture Maps"
ao tocar nele). Como o arquivo combina dados do OpenStreetMap, o conjunto é oferecido
sob a ODbL.

O que isso quer dizer, na prática:

- Pode copiar, distribuir, imprimir e usar o mapa à vontade, desde que cite
  "© colaboradores do OpenStreetMap" e "Overture Maps Foundation" (o app mostra isso
  na aba do mapa).
- Quem distribuir uma versão modificada destes dados precisa oferecê-la sob a
  mesma licença ODbL.
- Os dados podem ter erros ou estar desatualizados, principalmente os
  estabelecimentos. Confira no local antes de confiar numa informação importante (por
  exemplo, se uma farmácia ainda existe).

## Como atualizar

```bash
NODE_USE_ENV_PROXY=1 node scripts/baixar-mapa-osm.js   # ruas e locais do OpenStreetMap
pip install pyarrow
python3 scripts/baixar-locais-overture.py              # estabelecimentos da Overture Maps
node scripts/gerar-mapa-cidade.js                      # gera dados/mapa-hortolandia.js
```

Os dois primeiros só precisam de internet nesse momento. O da Overture não baixa os
arquivos inteiros (vários GB): lê o índice de cada arquivo e só os trechos da área.

Para outra cidade, troque o número da relação do município em
`scripts/baixar-mapa-osm.js` (veja no openstreetmap.org) e o nome do arquivo de saída.
