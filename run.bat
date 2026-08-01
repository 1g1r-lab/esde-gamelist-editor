@echo off
REM Executa o ES-DE Gamelist Editor a partir do codigo-fonte (modo dev) no Windows.
cd /d "%~dp0"
set PYBIN=python
if not exist .venv (
  echo Criando ambiente virtual...
  %PYBIN% -m venv .venv
  .venv\Scripts\python -m pip install --upgrade pip
  .venv\Scripts\pip install -r requirements.txt
)
.venv\Scripts\python app.py %*
