#!/usr/bin/env bash
# Gera o executável único do ES-DE Gamelist Editor no Linux.
# Resultado: dist/esde-gamelist-editor-v1.3
set -e
cd "$(dirname "$0")"

PYBIN="${PYTHON:-python3}"
VENV=".venv-build"

echo ">> Preparando ambiente de build…"
"$PYBIN" -m venv "$VENV"
"$VENV/bin/pip" install --upgrade pip >/dev/null
"$VENV/bin/pip" install -r requirements.txt
"$VENV/bin/pip" install pyqt6 pyqt6-webengine pyinstaller

echo ">> Empacotando…"
"$VENV/bin/pyinstaller" --noconfirm --clean esde-gamelist-editor.spec

echo ""
echo ">> Pronto: dist/esde-gamelist-editor-v1.3"
echo "   Execute com:  ./dist/esde-gamelist-editor-v1.3"
