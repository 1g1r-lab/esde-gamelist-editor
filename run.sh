#!/usr/bin/env bash
# Executa o ES-DE Gamelist Editor a partir do código-fonte (modo dev).
# Cria um ambiente virtual na primeira execução e abre a janela do app.
set -e
cd "$(dirname "$0")"

PYBIN="${PYTHON:-python3}"
VENV=".venv"

if [ ! -d "$VENV" ]; then
  echo ">> Criando ambiente virtual…"
  "$PYBIN" -m venv "$VENV"
  "$VENV/bin/pip" install --upgrade pip >/dev/null
  "$VENV/bin/pip" install -r requirements.txt
  # No Linux, garante um backend de janela (Qt) se nenhum estiver disponível.
  if [ "$(uname)" = "Linux" ]; then
    if ! "$VENV/bin/python" -c "import gi" 2>/dev/null; then
      echo ">> Instalando backend Qt (pyqt6)…"
      "$VENV/bin/pip" install pyqt6 pyqt6-webengine
    fi
  fi
fi

exec "$VENV/bin/python" app.py "$@"
