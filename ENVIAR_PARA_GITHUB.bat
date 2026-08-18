@echo off
title Enviar Guvio para GitHub (whoistavs/guvio-app)
color 0A
echo ========================================================
echo       ENVIANDO PROJETO GUVIO PARA O GITHUB
echo       Reposite: https://github.com/whoistavs/guvio-app
echo ========================================================
echo.

set GIT_PATH="%TEMP%\mingit\cmd\git.exe"

if exist %GIT_PATH% (
    %GIT_PATH% remote remove origin >nul 2>&1
    %GIT_PATH% remote add origin https://github.com/whoistavs/guvio-app.git
    %GIT_PATH% branch -M main
    %GIT_PATH% push -u origin main
) else (
    git remote remove origin >nul 2>&1
    git remote add origin https://github.com/whoistavs/guvio-app.git
    git branch -M main
    git push -u origin main
)

echo.
echo ========================================================
echo       CONCLUIDO COM SUCESSO!
echo ========================================================
pause
