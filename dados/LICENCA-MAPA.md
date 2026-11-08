# Licença dos dados do mapa

O arquivo `mapa-hortolandia.js` foi gerado a partir do **OpenStreetMap**.

**© colaboradores do OpenStreetMap.** Os dados estão disponíveis sob a
[Open Database License (ODbL) 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Mais informações em <https://www.openstreetmap.org/copyright>.

O que isso quer dizer, na prática:

- Pode copiar, distribuir, imprimir e usar o mapa à vontade, desde que cite
  "© colaboradores do OpenStreetMap" (o app mostra isso no próprio mapa).
- Quem distribuir uma versão modificada destes dados precisa oferecê-la sob a
  mesma licença ODbL.
- Os dados podem ter erros ou estar desatualizados. Confira no local antes de
  confiar numa informação importante (por exemplo, se uma farmácia ainda existe).

## Como atualizar

```bash
NODE_USE_ENV_PROXY=1 node scripts/baixar-mapa-osm.js   # baixa a área (só precisa de internet aqui)
node scripts/gerar-mapa-cidade.js                      # gera dados/mapa-hortolandia.js
```

Para outra cidade, troque o número da relação do município em
`scripts/baixar-mapa-osm.js` (veja no openstreetmap.org) e o nome do arquivo de saída.
