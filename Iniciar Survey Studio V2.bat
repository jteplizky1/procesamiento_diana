@echo off
setlocal
cd /d "%~dp0"
title Survey Studio V2
echo.
echo  Survey Studio V2 - sin Streamlit ni PyArrow
echo.
set "APP_PYTHON=%~dp0..\survey_explorer\.venv\Scripts\python.exe"
if not exist "%APP_PYTHON%" set "APP_PYTHON=%USERPROFILE%\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
if not exist "%APP_PYTHON%" (
  echo No se encontro Python. Instala Python 3.11 o superior.
  pause
  exit /b 1
)
"%APP_PYTHON%" -c "import pandas,openpyxl" >nul 2>nul
if errorlevel 1 (
  echo Faltan pandas u openpyxl en el Python disponible.
  echo Ejecuta: "%APP_PYTHON%" -m pip install -r requirements.txt
  pause
  exit /b 1
)
echo Abriendo http://127.0.0.1:8765
echo Para cerrar, presiona Ctrl+C o cierra esta ventana.
"%APP_PYTHON%" server.py
if errorlevel 1 pause
endlocal
