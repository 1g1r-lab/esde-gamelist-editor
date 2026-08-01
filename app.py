#!/usr/bin/env python3
"""
ES-DE Gamelist Editor — aplicativo de desktop (janela única, sem navegador).

Executa uma janela nativa (pywebview) que carrega a interface local e conversa
com o Python diretamente via ``window.pywebview.api`` — sem servidor HTTP.

Uso (a partir do código-fonte):
    python app.py

Empacotado (PyInstaller): basta executar o binário gerado.
"""
from __future__ import annotations

import os
import sys

import webview  # type: ignore

from api import Api


def resource_dir() -> str:
    """Pasta dos assets do front-end, tanto em dev quanto empacotado."""
    if getattr(sys, "frozen", False):  # PyInstaller
        base = getattr(sys, "_MEIPASS", os.path.dirname(sys.executable))
    else:
        base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, "frontend")


def main() -> None:
    index = os.path.join(resource_dir(), "index.html")
    if not os.path.isfile(index):
        sys.stderr.write(f"index.html não encontrado em {index}\n")
        sys.exit(1)

    api = Api()
    window = webview.create_window(
        title="ES-DE Gamelist Editor v1.3",
        url=index,
        js_api=api,
        width=1320,
        height=860,
        min_size=(980, 640),
        background_color="#11161d",
        text_select=True,
    )
    api.set_window(window)

    debug = "--debug" in sys.argv
    # gui=None deixa o pywebview escolher o backend disponível
    # (EdgeChromium no Windows; GTK/WebKit ou Qt no Linux).
    webview.start(debug=debug)


if __name__ == "__main__":
    main()
