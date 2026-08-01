@echo off
REM Gera o executavel unico do ES-DE Gamelist Editor no Windows.
REM Resultado: dist\esde-gamelist-editor-v1.3.exe
cd /d "%~dp0"
set PYBIN=python
set VENV=.venv-build

echo >> Preparando ambiente de build...
%PYBIN% -m venv %VENV%
%VENV%\Scripts\python -m pip install --upgrade pip
%VENV%\Scripts\pip install -r requirements.txt
%VENV%\Scripts\pip install pyinstaller

echo >> Empacotando...
%VENV%\Scripts\pyinstaller --noconfirm --clean esde-gamelist-editor.spec

echo.
echo >> Pronto: dist\esde-gamelist-editor-v1.3.exe
