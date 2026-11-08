#!/usr/bin/env node
/**
 * Gera o pacote para baixar e instalar no computador (dist/sobrevivencia-urbana.zip):
 *
 *   Sobrevivencia-Urbana/
 *     LEIA-ME.txt                  passo a passo, em linguagem simples
 *     INSTALAR-WINDOWS.bat         instala e cria o ícone na área de trabalho e no menu Iniciar
 *     DESINSTALAR-WINDOWS.bat
 *     INSTALAR-MAC.command         instala e cria o app em Aplicativos e na Mesa
 *     INSTALAR-LINUX.sh            instala e cria o atalho no menu e na área de trabalho
 *     ABRIR-O-APP.html             abre sem instalar
 *     INSTALAR-NO-CELULAR.html     QR code do site para instalar no celular
 *     PLANO-DE-SOBREVIVENCIA.html  o plano completo, para ler e imprimir
 *     app/                         o app (funciona sem internet)
 *     instalador/                  scripts usados pelos instaladores do Windows
 *
 * O ícone abre o app numa janela própria do Edge ou do Chrome (modo aplicativo); sem
 * esses navegadores, abre no navegador padrão. Os nomes dos arquivos não têm acento,
 * para o .zip abrir certo em qualquer sistema.
 *
 * Uso: node scripts/gerar-pacote.js [--saida pasta]
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const QRCode = require('qrcode');
const { marked } = require('marked');

const RAIZ = path.join(__dirname, '..');
const args = process.argv.slice(2);
const iSaida = args.indexOf('--saida');
const SAIDA = iSaida >= 0 ? path.resolve(args[iSaida + 1]) : path.join(RAIZ, 'dist');
const NOME = 'Sobrevivencia-Urbana';
const SITE = 'https://marcosvocare.github.io/igreja-/';
const PASTA = path.join(SAIDA, 'pacote', NOME);
const ZIP = path.join(SAIDA, 'sobrevivencia-urbana.zip');

const ARQUIVOS_APP = ['index.html', 'manifest.webmanifest', 'sw.js', 'icone.svg', 'css', 'js', 'icones', 'dados'];

const crlf = (t) => t.replace(/\r?\n/g, '\r\n');
const escrever = (rel, conteudo, modo) => {
  const arq = path.join(PASTA, rel);
  fs.mkdirSync(path.dirname(arq), { recursive: true });
  fs.writeFileSync(arq, conteudo);
  if (modo) fs.chmodSync(arq, modo);
};

/** Ícone do Windows (.ico) com a imagem PNG dentro (aceito desde o Windows Vista). */
function ico(png) {
  const cabecalho = Buffer.alloc(22);
  cabecalho.writeUInt16LE(0, 0);
  cabecalho.writeUInt16LE(1, 2); // tipo: ícone
  cabecalho.writeUInt16LE(1, 4); // uma imagem
  cabecalho.writeUInt8(192, 6); // largura
  cabecalho.writeUInt8(192, 7); // altura
  cabecalho.writeUInt8(0, 8);
  cabecalho.writeUInt8(0, 9);
  cabecalho.writeUInt16LE(1, 10); // planos
  cabecalho.writeUInt16LE(32, 12); // bits por pixel
  cabecalho.writeUInt32LE(png.length, 14);
  cabecalho.writeUInt32LE(22, 18); // onde começa a imagem
  return Buffer.concat([cabecalho, png]);
}

const ESTILO = `
  :root { color-scheme: light; --texto: #1d2321; --suave: #55605c; --primaria: #1f6f5c; --borda: #d9ddd8; }
  * { box-sizing: border-box; }
  body { margin: 0 auto; max-width: 52rem; padding: 1.5rem 1rem 3rem; font: 17px/1.55 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: var(--texto); background: #fff; }
  h1 { color: var(--primaria); line-height: 1.2; }
  h2 { margin-top: 2rem; border-bottom: 2px solid var(--borda); padding-bottom: .25rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .95em; }
  th, td { border: 1px solid var(--borda); padding: .4rem .5rem; text-align: left; vertical-align: top; }
  code { background: #f1f3f0; padding: .05rem .3rem; border-radius: 4px; }
  pre { background: #f1f3f0; padding: .75rem; overflow-x: auto; border-radius: 8px; }
  a { color: var(--primaria); }
  .passos li { margin: .5rem 0; }
  .qr { display: block; width: min(18rem, 80vw); height: auto; margin: 1rem auto; }
  .site { text-align: center; font-size: 1.2rem; font-weight: 700; word-break: break-all; }
  .nota { color: var(--suave); font-size: .95rem; }
  @media print { body { max-width: none; } a { color: inherit; } }
`;

function pagina(titulo, corpo) {
  return `<!${'doctype'} html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${titulo}</title>
<style>${ESTILO}</style>
</head>
<body>
${corpo}
</body>
</html>
`;
}

async function main() {
  fs.rmSync(path.join(SAIDA, 'pacote'), { recursive: true, force: true });
  fs.rmSync(ZIP, { force: true });

  // ---------------------------------------------------------------- app
  for (const item of ARQUIVOS_APP) fs.cpSync(path.join(RAIZ, item), path.join(PASTA, 'app', item), { recursive: true });
  escrever('app/icone.ico', ico(fs.readFileSync(path.join(RAIZ, 'icones', 'icone-192.png'))));

  // ---------------------------------------------------------------- Windows
  escrever(
    'INSTALAR-WINDOWS.bat',
    crlf(`@echo off
rem Instala o Sobrevivencia Urbana neste computador e cria o icone na area de trabalho.
title Instalar Sobrevivencia Urbana
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\\instalar-windows.ps1"
echo.
pause
`),
  );
  escrever(
    'DESINSTALAR-WINDOWS.bat',
    crlf(`@echo off
rem Remove o Sobrevivencia Urbana deste computador.
title Desinstalar Sobrevivencia Urbana
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0instalador\\desinstalar-windows.ps1"
echo.
pause
`),
  );
  // PowerShell 5 lê UTF-8 com BOM corretamente (acentos dos nomes dos atalhos).
  const BOM = '\ufeff';
  escrever(
    'instalador/instalar-windows.ps1',
    BOM +
      crlf(`# Instala o Sobrevivência Urbana neste computador (Windows 10 e 11).
$ErrorActionPreference = 'Stop'
$origem = Join-Path $PSScriptRoot '..\\app'
$destino = Join-Path $env:LOCALAPPDATA 'SobrevivenciaUrbana'
Write-Host ''
Write-Host 'Instalando o Sobrevivência Urbana...' -ForegroundColor Green

if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
New-Item -ItemType Directory -Path $destino -Force | Out-Null
Copy-Item -Path (Join-Path $origem '*') -Destination $destino -Recurse -Force

$pagina = Join-Path $destino 'index.html'
$endereco = ([System.Uri]$pagina).AbsoluteUri

# Abre numa janela própria (modo aplicativo) do Edge ou do Chrome; senão, no navegador padrão.
$navegadores = @(
  (Join-Path \${env:ProgramFiles(x86)} 'Microsoft\\Edge\\Application\\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe'),
  (Join-Path \${env:ProgramFiles(x86)} 'Google\\Chrome\\Application\\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe')
)
$navegador = $navegadores | Where-Object { Test-Path $_ } | Select-Object -First 1

$shell = New-Object -ComObject WScript.Shell
function Criar-Atalho([string]$caminho) {
  $atalho = $shell.CreateShortcut($caminho)
  if ($navegador) {
    $atalho.TargetPath = $navegador
    $atalho.Arguments = '--app="' + $endereco + '"'
  } else {
    $atalho.TargetPath = $pagina
  }
  $atalho.WorkingDirectory = $destino
  $atalho.IconLocation = (Join-Path $destino 'icone.ico')
  $atalho.Description = 'Plano de sobrevivência urbana - funciona sem internet'
  $atalho.Save()
}

$naAreaDeTrabalho = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Sobrevivência Urbana.lnk'
$noMenuIniciar = Join-Path ([Environment]::GetFolderPath('Programs')) 'Sobrevivência Urbana.lnk'
Criar-Atalho $naAreaDeTrabalho
Criar-Atalho $noMenuIniciar

Write-Host ''
Write-Host 'Pronto! O ícone "Sobrevivência Urbana" está na área de trabalho e no menu Iniciar.' -ForegroundColor Green
Write-Host 'O app funciona sem internet. Os dados ficam só neste computador.'
Start-Process $naAreaDeTrabalho
`),
  );
  escrever(
    'instalador/desinstalar-windows.ps1',
    BOM +
      crlf(`# Remove o Sobrevivência Urbana deste computador (os atalhos e a cópia do app).
$destino = Join-Path $env:LOCALAPPDATA 'SobrevivenciaUrbana'
$atalhos = @(
  (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Sobrevivência Urbana.lnk'),
  (Join-Path ([Environment]::GetFolderPath('Programs')) 'Sobrevivência Urbana.lnk')
)
foreach ($a in $atalhos) { if (Test-Path $a) { Remove-Item $a -Force } }
if (Test-Path $destino) { Remove-Item $destino -Recurse -Force }
Write-Host ''
Write-Host 'O Sobrevivência Urbana foi removido.' -ForegroundColor Green
Write-Host 'Os dados que você digitou continuam guardados no navegador. Para apagá-los,'
Write-Host 'antes de desinstalar use a aba Dados > Apagar tudo, dentro do app.'
`),
  );

  // ---------------------------------------------------------------- Mac
  escrever(
    'INSTALAR-MAC.command',
    `#!/bin/bash
# Instala o Sobrevivência Urbana neste Mac: copia o app e cria o ícone em Aplicativos e na Mesa.
set -e
cd "$(dirname "$0")"
DESTINO="$HOME/Library/Application Support/SobrevivenciaUrbana"
APP="$HOME/Applications/Sobrevivência Urbana.app"
echo "Instalando o Sobrevivência Urbana..."
rm -rf "$DESTINO" "$APP"
mkdir -p "$DESTINO" "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp -R app/. "$DESTINO/"

cat > "$APP/Contents/Info.plist" <<'PLIST'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>Sobrevivência Urbana</string>
  <key>CFBundleDisplayName</key><string>Sobrevivência Urbana</string>
  <key>CFBundleIdentifier</key><string>io.github.marcosvocare.sobrevivencia-urbana</string>
  <key>CFBundleExecutable</key><string>abrir</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleIconFile</key><string>icone</string>
</dict>
</plist>
PLIST

cat > "$APP/Contents/MacOS/abrir" <<'ABRIR'
#!/bin/bash
# Abre numa janela própria (Chrome, Edge ou Brave); senão, no Safari ou navegador padrão.
PAGINA="$HOME/Library/Application Support/SobrevivenciaUrbana/index.html"
ENDERECO="file://\${PAGINA// /%20}"
for NAV in "Google Chrome" "Microsoft Edge" "Brave Browser" "Chromium"; do
  if [ -d "/Applications/$NAV.app" ] || [ -d "$HOME/Applications/$NAV.app" ]; then
    open -na "$NAV" --args --app="$ENDERECO"
    exit 0
  fi
done
open "$PAGINA"
ABRIR
chmod +x "$APP/Contents/MacOS/abrir"

# Ícone do app (se as ferramentas do Mac estiverem disponíveis).
if command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  TEMP="$(mktemp -d)/icone.iconset"
  mkdir -p "$TEMP"
  for T in 16 32 128 256; do
    sips -z $T $T app/icones/icone-512.png --out "$TEMP/icon_\${T}x\${T}.png" >/dev/null 2>&1 || true
    sips -z $((T * 2)) $((T * 2)) app/icones/icone-512.png --out "$TEMP/icon_\${T}x\${T}@2x.png" >/dev/null 2>&1 || true
  done
  cp app/icones/icone-512.png "$TEMP/icon_512x512.png"
  iconutil -c icns "$TEMP" -o "$APP/Contents/Resources/icone.icns" >/dev/null 2>&1 || true
fi

ln -sfn "$APP" "$HOME/Desktop/Sobrevivência Urbana"
echo ""
echo "Pronto! O ícone \\"Sobrevivência Urbana\\" está em Aplicativos e na Mesa."
echo "O app funciona sem internet. Os dados ficam só neste Mac."
open "$APP"
`,
    0o755,
  );

  // ---------------------------------------------------------------- Linux
  escrever(
    'INSTALAR-LINUX.sh',
    `#!/bin/bash
# Instala o Sobrevivência Urbana: copia o app e cria o atalho no menu e na área de trabalho.
set -e
cd "$(dirname "$0")"
DESTINO="$HOME/.local/share/sobrevivencia-urbana"
echo "Instalando o Sobrevivência Urbana..."
rm -rf "$DESTINO"
mkdir -p "$DESTINO"
cp -R app/. "$DESTINO/"

ENDERECO="file://\${DESTINO// /%20}/index.html"
NAV=""
for N in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
  if command -v "$N" >/dev/null 2>&1; then NAV="$N"; break; fi
done
if [ -n "$NAV" ]; then EXEC="$NAV \\"--app=$ENDERECO\\""; else EXEC="xdg-open \\"$DESTINO/index.html\\""; fi

ATALHO="[Desktop Entry]
Type=Application
Name=Sobrevivência Urbana
Comment=Plano de sobrevivência urbana - funciona sem internet
Exec=$EXEC
Icon=$DESTINO/icones/icone-192.png
Terminal=false
Categories=Utility;"

mkdir -p "$HOME/.local/share/applications"
printf '%s\\n' "$ATALHO" > "$HOME/.local/share/applications/sobrevivencia-urbana.desktop"
AREA="$(xdg-user-dir DESKTOP 2>/dev/null || echo "$HOME/Desktop")"
if [ -d "$AREA" ]; then
  printf '%s\\n' "$ATALHO" > "$AREA/sobrevivencia-urbana.desktop"
  chmod +x "$AREA/sobrevivencia-urbana.desktop"
  gio set "$AREA/sobrevivencia-urbana.desktop" metadata::trusted true >/dev/null 2>&1 || true
fi
echo ""
echo "Pronto! O atalho \\"Sobrevivência Urbana\\" está no menu de aplicativos e na área de trabalho."
echo "O app funciona sem internet. Os dados ficam só neste computador."
`,
    0o755,
  );

  // ---------------------------------------------------------------- páginas
  escrever(
    'ABRIR-O-APP.html',
    pagina(
      'Abrir o Sobrevivência Urbana',
      `<meta http-equiv="refresh" content="0; url=app/index.html">
<h1>Sobrevivência Urbana</h1>
<p><a href="app/index.html">Toque aqui se o app não abrir sozinho.</a></p>`,
    ),
  );

  const qr = await QRCode.toString(SITE, { type: 'svg', errorCorrectionLevel: 'M', margin: 2, color: { dark: '#000000', light: '#ffffff' } });
  escrever(
    'INSTALAR-NO-CELULAR.html',
    pagina(
      'Instalar no celular',
      `<h1>Instalar o Sobrevivência Urbana no celular</h1>
<p>Aponte a câmera do celular para o código abaixo (com internet) e toque no endereço que aparecer.</p>
${qr.replace('<svg ', '<svg class="qr" role="img" aria-label="QR code do endereço do app" ')}
<p class="site"><a href="${SITE}">${SITE.replace('https://', '')}</a></p>
<h2>Depois de abrir o endereço</h2>
<ol class="passos">
  <li><strong>Android (Chrome):</strong> toque em <em>Instalar o app</em> (aba Dados) ou no menu ⋮ → <em>Instalar app</em>.</li>
  <li><strong>iPhone (Safari):</strong> toque em <em>Compartilhar</em> (quadrado com seta) → <em>Adicionar à Tela de Início</em>.</li>
  <li><strong>Teste:</strong> desligue o wi-fi e os dados e abra o app pelo ícone. Se abrir, inclusive o mapa da cidade, está pronto para usar sem internet.</li>
</ol>
<p class="nota">Os dados de cada celular ficam só nele. Para passar dados entre aparelhos, use a aba Dados (cópia de segurança ou pacote para a comunidade).</p>`,
    ),
  );

  const plano = fs.readFileSync(path.join(RAIZ, 'docs', 'plano-sobrevivencia-urbana.md'), 'utf8');
  escrever('PLANO-DE-SOBREVIVENCIA.html', pagina('Plano de Sobrevivência Urbana', marked.parse(plano)));

  escrever(
    'LEIA-ME.txt',
    BOM +
    crlf(`SOBREVIVÊNCIA URBANA - COMO INSTALAR
====================================

Esta pasta tem o app completo. Ele funciona SEM INTERNET.

1) Extraia a pasta para a Área de Trabalho
   No Windows: botão direito no arquivo .zip > "Extrair tudo..." > escolha a
   Área de Trabalho. No Mac: dois cliques no .zip e arraste a pasta para a Mesa.

2) Instale no computador (cria o ícone "Sobrevivência Urbana" na área de trabalho)

   WINDOWS: dois cliques em INSTALAR-WINDOWS.bat
     Se aparecer "O Windows protegeu o computador", clique em "Mais informações"
     e depois em "Executar assim mesmo". O instalador não precisa de internet
     nem de senha de administrador.

   MAC: botão direito em INSTALAR-MAC.command > Abrir > Abrir.
     (Na primeira vez o Mac avisa que o arquivo é de um desenvolvedor não
     identificado; o botão direito > Abrir libera.)

   LINUX: botão direito em INSTALAR-LINUX.sh > Executar como programa
     (ou no terminal: bash INSTALAR-LINUX.sh).

3) No celular: abra o arquivo INSTALAR-NO-CELULAR.html e aponte a câmera do
   celular para o QR code. O celular precisa de internet só nessa primeira vez.

Para abrir sem instalar: dois cliques em ABRIR-O-APP.html.
O plano completo, para ler ou imprimir: PLANO-DE-SOBREVIVENCIA.html.

COMO FUNCIONA
- O ícone abre o app numa janela própria do Edge ou do Chrome (sem barra de
  endereço). Sem esses navegadores, abre no navegador padrão.
- Os dados que você digita ficam só neste computador, dentro do navegador.
- Para levar os dados para outro aparelho: aba Dados > cópia de segurança.
- Imprima o caderno (aba Caderno): papel funciona até sem bateria.
- Versão sempre atualizada (com internet): ${SITE}

DESINSTALAR
- Windows: dois cliques em DESINSTALAR-WINDOWS.bat.
- Mac: apague "Sobrevivência Urbana" de Aplicativos e da Mesa.
- Linux: apague ~/.local/share/sobrevivencia-urbana e os atalhos.
- Antes, se quiser apagar seus dados: aba Dados > Apagar tudo.

LICENÇAS
- App: código aberto, em https://github.com/marcosvocare/igreja-
- Mapa: © colaboradores do OpenStreetMap (ODbL) e © Overture Maps Foundation
  (CDLA-Permissive-2.0). Detalhes em app/dados/LICENCA-MAPA.md.
`),
  );

  // ---------------------------------------------------------------- zip
  fs.mkdirSync(SAIDA, { recursive: true });
  execFileSync('zip', ['-q', '-r', '-X', ZIP, NOME], { cwd: path.join(SAIDA, 'pacote') });
  console.log(`${path.relative(process.cwd(), ZIP)}: ${(fs.statSync(ZIP).size / 1024).toFixed(0)} KB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
