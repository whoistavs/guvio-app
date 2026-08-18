@echo off
chcp 65001 >nul
title GUVIO - iPhone via LAN
cd /d "%~dp0"
echo.
echo Sincronizando dependencias do Expo SDK 54...
call npm install
if errorlevel 1 goto erro
call npx expo install --fix
if errorlevel 1 goto erro
echo.
echo Iniciando em LAN. PC e iPhone precisam estar na mesma rede Wi-Fi.
call npx expo start --go --lan --clear
goto fim
:erro
echo Houve um erro. Envie uma foto desta janela no ChatGPT.
pause
:fim
