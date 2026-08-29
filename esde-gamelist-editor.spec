# -*- mode: python ; coding: utf-8 -*-
"""
Spec do PyInstaller para o ES-DE Gamelist Editor.
Gera um executável único (one-file) embutindo a interface (frontend/) e o
backend de janela do pywebview.

Build:
    Linux:    ./build.sh         (usa o backend Qt)
    Windows:  build.bat          (usa o EdgeChromium nativo)
"""
import sys
from PyInstaller.utils.hooks import collect_all

datas = [("frontend", "frontend")]
binaries = []
hiddenimports = []

# Coleta tudo do pywebview (inclui os backends de janela detectados).
for pkg in ("webview",):
    d, b, h = collect_all(pkg)
    datas += d
    binaries += b
    hiddenimports += h

# No Linux, fixamos o backend Qt, que empacota de forma confiável.
if sys.platform.startswith("linux"):
    hiddenimports += ["PyQt6", "PyQt6.QtWebEngineWidgets", "PyQt6.QtWebEngineCore"]

block_cipher = None

a = Analysis(
    ["app.py"],
    pathex=[],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    runtime_hooks=[],
    excludes=["tkinter"],
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    name="esde-gamelist-editor-v1.3.1",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    runtime_tmpdir=None,
    console=False,           # app de janela (sem console)
    disable_windowed_traceback=False,
    argv_emulation=False,
)
