@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ======================================
echo        GUVIO - PREPARAR E TESTAR
echo ======================================
where node >nul 2>nul || (echo Node.js nao encontrado.& pause & exit /b 1)
if exist node_modules rmdir /s /q node_modules
if exist package-lock.json del /q package-lock.json
if exist .expo rmdir /s /q .expo
echo Instalando dependencias...
call npm install
if errorlevel 1 goto erro
echo Alinhando dependencias com Expo SDK...
call npx expo install --fix
if errorlevel 1 goto erro
echo Verificando TypeScript...
call npx tsc --noEmit
if errorlevel 1 goto erro
echo Verificando Expo...
call npx expo-doctor
if errorlevel 1 echo Aviso: expo-doctor encontrou observacoes; o app ainda pode rodar.
echo Iniciando Expo Go...
call npx expo start --go --clear
exit /b 0
:erro
echo.
echo Ocorreu um erro. Tire uma foto desta janela.
pause
