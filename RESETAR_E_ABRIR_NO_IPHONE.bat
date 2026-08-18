@echo off
setlocal
chcp 65001 >nul
title GUVIO - Reset completo e iPhone
cd /d "%~dp0"

echo.
echo ==============================================
echo   GUVIO - RESET COMPLETO + EXPO GO NO IPHONE
echo ==============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo ERRO: Node.js nao foi encontrado no PATH.
  echo Instale/reabra o terminal depois de instalar Node.js LTS.
  pause
  exit /b 1
)
where npm >nul 2>nul
if errorlevel 1 (
  echo ERRO: npm nao foi encontrado no PATH.
  pause
  exit /b 1
)

echo [1/6] Validando package.json...
node -e "JSON.parse(require('fs').readFileSync('package.json','utf8')); console.log('package.json OK')"
if errorlevel 1 goto erro

echo.
echo [2/6] Removendo instalacao/cache antigos...
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /f /q package-lock.json
if exist .expo rmdir /s /q .expo

echo.
echo [3/6] Instalando dependencias limpas...
call npm install
if errorlevel 1 goto erro

echo.
echo [4/6] Alinhando pacotes ao Expo SDK 54...
call npx expo install --fix
if errorlevel 1 goto erro

echo.
echo [5/6] Verificando o projeto...
call npx expo-doctor
if errorlevel 1 (
  echo.
  echo Aviso: o Expo Doctor encontrou observacoes. Tentando iniciar mesmo assim.
)

echo.
echo [6/6] Iniciando no iPhone via Tunnel...
echo Abra a Camera do iPhone e escaneie o QR Code.
echo Mantenha esta janela aberta enquanto usar o aplicativo.
echo.
call npx expo start --go --tunnel --clear
exit /b %errorlevel%

:erro
echo.
echo ==============================================
echo ERRO DURANTE A PREPARACAO DO GUVIO.
echo Copie a mensagem acima e envie ao ChatGPT.
echo ==============================================
pause
exit /b 1
