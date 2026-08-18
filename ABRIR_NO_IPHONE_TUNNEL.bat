@echo off
chcp 65001 >nul
title GUVIO - iPhone via Expo Go
cd /d "%~dp0"
if not exist node_modules (
  echo Dependencias ainda nao instaladas.
  echo Executando preparacao completa primeiro...
  call RESETAR_E_ABRIR_NO_IPHONE.bat
  exit /b %errorlevel%
)
call npx expo start --go --tunnel --clear
