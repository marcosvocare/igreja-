#!/usr/bin/env python3
"""
Baixa da Overture Maps (base aberta de estabelecimentos) os locais da área de
Hortolândia: igrejas, mercados, farmácias, saúde, escolas, gás, combustível...
Complementa o OpenStreetMap, que tem poucos estabelecimentos na cidade.

Não baixa os arquivos inteiros (centenas de MB cada): lê o índice de cada
arquivo Parquet e só os trechos que cobrem a área, por pedidos parciais (Range).

Dados: © Overture Maps Foundation, licença CDLA-Permissive-2.0 (alguns
registros com outras licenças abertas, indicadas em "fontes").

Uso:
  pip install pyarrow
  python3 scripts/baixar-locais-overture.py [--cache .cache-osm] [--release 2026-10-21.0]
Depois: node scripts/gerar-mapa-cidade.js
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET

import pyarrow.parquet as pq

BALDE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com'
NS = {'s3': 'http://s3.amazonaws.com/doc/2006-03-01/'}


def pedir(url, inicio=None, fim=None):
    req = urllib.request.Request(url, headers={'User-Agent': 'sobrevivencia-urbana-mapa/1.0'})
    if inicio is not None:
        req.add_header('Range', f'bytes={inicio}-{fim}')
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def listar(prefixo, delimitador=None):
    url = f'{BALDE}/?list-type=2&prefix={urllib.parse.quote(prefixo)}'
    if delimitador:
        url += f'&delimiter={delimitador}'
    raiz = ET.fromstring(pedir(url))
    chaves = [(c.find('s3:Key', NS).text, int(c.find('s3:Size', NS).text)) for c in raiz.findall('s3:Contents', NS)]
    prefixos = [p.find('s3:Prefix', NS).text for p in raiz.findall('s3:CommonPrefixes', NS)]
    return chaves, prefixos


class ArquivoRemoto(io.RawIOBase):
    """Arquivo somente leitura lido por pedidos parciais, com um pequeno cache."""

    def __init__(self, url, tamanho):
        self.url = url
        self.tamanho = tamanho
        self.pos = 0
        self.baixado = 0
        self.cache = {}

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, deslocamento, origem=0):
        if origem == 0:
            self.pos = deslocamento
        elif origem == 1:
            self.pos += deslocamento
        else:
            self.pos = self.tamanho + deslocamento
        return self.pos

    def read(self, n=-1):
        if n is None or n < 0:
            n = self.tamanho - self.pos
        n = min(n, self.tamanho - self.pos)
        if n <= 0:
            return b''
        chave = (self.pos, n)
        if chave not in self.cache:
            self.cache = {chave: pedir(self.url, self.pos, self.pos + n - 1)}
            self.baixado += n
        dados = self.cache[chave]
        self.pos += len(dados)
        return dados

    def readinto(self, b):
        dados = self.read(len(b))
        b[: len(dados)] = dados
        return len(dados)


def estatistica(rg, caminho):
    for i in range(rg.num_columns):
        col = rg.column(i)
        if col.path_in_schema == caminho and col.statistics is not None and col.statistics.has_min_max:
            return col.statistics.min, col.statistics.max
    return None


def principal():
    import urllib.parse  # noqa: F401  (usado em listar)

    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(os.path.dirname(__file__), '..', '.cache-osm'))
    ap.add_argument('--release', default=None)
    args = ap.parse_args()
    caixa = json.load(open(os.path.join(args.cache, 'caixa.json')))

    release = args.release
    if not release:
        _, prefixos = listar('release/', '/')
        release = sorted(p.split('/')[1] for p in prefixos)[-1]
    print('Overture', release, 'área', caixa)
    arquivos, _ = listar(f'release/{release}/theme=places/type=place/')
    print(len(arquivos), 'arquivos')

    locais = []
    total = 0
    for chave, tamanho in arquivos:
        arq = ArquivoRemoto(f'{BALDE}/{chave}', tamanho)
        pf = pq.ParquetFile(arq)
        nomes_colunas = pf.schema_arrow.names
        for i in range(pf.metadata.num_row_groups):
            rg = pf.metadata.row_group(i)
            xs = estatistica(rg, 'bbox.xmin')
            ys = estatistica(rg, 'bbox.ymin')
            xs2 = estatistica(rg, 'bbox.xmax')
            ys2 = estatistica(rg, 'bbox.ymax')
            if not (xs and ys and xs2 and ys2):
                continue
            if xs[0] > caixa['leste'] or xs2[1] < caixa['oeste'] or ys[0] > caixa['norte'] or ys2[1] < caixa['sul']:
                continue
            colunas = [c for c in ['id', 'names', 'categories', 'basic_category', 'taxonomy', 'confidence', 'bbox', 'addresses', 'operating_status', 'sources'] if c in nomes_colunas]
            tabela = pf.read_row_group(i, columns=colunas).to_pylist()
            for r in tabela:
                b = r['bbox']
                lon = (b['xmin'] + b['xmax']) / 2
                lat = (b['ymin'] + b['ymax']) / 2
                if not (caixa['sul'] <= lat <= caixa['norte'] and caixa['oeste'] <= lon <= caixa['leste']):
                    continue
                cats = r.get('categories') or {}
                tax = r.get('taxonomy') or {}
                end = (r.get('addresses') or [{}])[0] or {}
                locais.append({
                    'id': r['id'],
                    'nome': ((r.get('names') or {}).get('primary') or '').strip(),
                    'categoria': cats.get('primary') or tax.get('primary'),
                    'alternativas': (cats.get('alternate') or tax.get('alternates') or [])[:4],
                    'basica': r.get('basic_category'),
                    'hierarquia': tax.get('hierarchy'),
                    'confianca': r.get('confidence'),
                    'situacao': r.get('operating_status'),
                    'lat': round(lat, 6),
                    'lon': round(lon, 6),
                    'endereco': end.get('freeform'),
                    'fontes': sorted({(s or {}).get('dataset') for s in (r.get('sources') or []) if s}),
                })
        total += arq.baixado
        print(f'  {chave.rsplit("/", 1)[-1][:16]}: {len(locais)} locais até agora, {total / 1e6:.0f} MB lidos')

    saida = os.path.join(args.cache, 'overture.json')
    json.dump({'release': release, 'locais': locais}, open(saida, 'w'), ensure_ascii=False)
    print('Pronto:', len(locais), 'locais em', saida)


if __name__ == '__main__':
    sys.exit(principal())
