@echo off
chcp 65001 >nul
title GUVIO - Web
echo.
echo ==============================================
echo             GUVIO - WEB
ECHO ==============================================
echo.
if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install
  if errorlevel 1 goto erro
)
call npx expo start --web --clear
exit /b
:erro
echo.
echo Houve um erro ao instalar as dependencias.
pause
