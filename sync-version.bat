@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║     Sincronizar versión de Control Voltes                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo ERROR: No se encuentra Node.js en el PATH.
    echo Instálalo desde https://nodejs.org o añade node al PATH.
    echo.
    pause
    exit /b 1
)

if not exist "app-version.json" (
    echo ERROR: No se encuentra app-version.json en %~dp0
    pause
    exit /b 1
)

REM Modo no interactivo: sync-version.bat 4.0.3 2026-09-15
if not "%~1"=="" (
    if "%~2"=="" (
        node "%~dp0scripts\sync-version.js" "%~1"
    ) else (
        node "%~dp0scripts\sync-version.js" "%~1" "%~2"
    )
    goto :after_sync
)

for /f "delims=" %%a in ('node -e "const d=require('./app-version.json');console.log(d.version)"') do set CUR_VER=%%a
for /f "delims=" %%a in ('node -e "const d=require('./app-version.json');console.log(d.releaseDate)"') do set CUR_DATE=%%a

echo  Versión actual : %CUR_VER%
echo  Fecha actual   : %CUR_DATE%
echo.
echo  Deja en blanco y pulsa Enter para mantener el valor actual.
echo.

set /p NEW_VER=Nueva versión [%CUR_VER%]: 
set /p NEW_DATE=Nueva fecha (AAAA-MM-DD) [%CUR_DATE%]: 

if "!NEW_VER!"=="" set NEW_VER=%CUR_VER%
if "!NEW_DATE!"=="" set NEW_DATE=%CUR_DATE%

echo.
echo  Se aplicará: versión !NEW_VER!, fecha !NEW_DATE!
echo.

node "%~dp0scripts\sync-version.js" "!NEW_VER!" "!NEW_DATE!"

:after_sync
if errorlevel 1 (
    echo.
    echo ERROR: La sincronización falló.
    pause
    exit /b 1
)

echo.
echo Listo. Recuerda hacer commit de app-version.json y www\version.js
echo.
pause
endlocal
