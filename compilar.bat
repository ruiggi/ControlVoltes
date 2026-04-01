@echo off
chcp 65001 >nul

REM ================================================
REM          CONFIGURACIÓN DE VERSIÓN
REM ================================================
set APP_VERSION=3.0.0
set APP_NAME=ControlVoltes
set APK_NAME=%APP_NAME%-v%APP_VERSION%.apk

REM ================================================
REM          CONFIGURACIÓN DEL KEYSTORE
REM ================================================
set KEYSTORE_FILE=control-voltes.keystore
set KEYSTORE_ALIAS=control-voltes

echo +----------------------------------------------------------------+
echo ¦         Compilación %APP_NAME% v%APP_VERSION% Release         ¦
echo +----------------------------------------------------------------+
echo.

REM Verificar si existe el keystore
if not exist "%KEYSTORE_FILE%" (
    echo ? ERROR: No se encuentra el archivo %KEYSTORE_FILE%
    echo.
    echo ?? Debes generar el keystore primero con este comando:
    echo.
    echo keytool -genkey -v -keystore %KEYSTORE_FILE% -alias %KEYSTORE_ALIAS% -keyalg RSA -keysize 2048 -validity 10000
    echo.
    pause
    exit /b 1
)

echo ?? Instrucciones:
echo    - Versión actual: %APP_VERSION%
echo    - APK final: %APK_NAME%
echo    - Asegúrate de haber actualizado la versión también en:
echo       • config.xml
echo       • package.json
echo       • www/manifest.json
echo       • www/scripts.js
echo       • www/sw.js
echo.

set /p CONTINUAR="¿Continuar con la compilación Release v%APP_VERSION%? (S/N): "
if /i not "%CONTINUAR%"=="S" (
    echo Compilación cancelada.
    pause
    exit /b 0
)

echo.
echo ?? Introduce la contraseña del keystore:
set /p KEYSTORE_PASS="   Contraseña: "
if "%KEYSTORE_PASS%"=="" (
    echo ? La contraseña no puede estar vacía.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [1/5] ?? Limpiando builds anteriores...
echo ----------------------------------------------------------------
call cordova clean android
if errorlevel 1 (
    echo ? Error al limpiar
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [2/5] ?? Preparando plataforma Android...
echo ----------------------------------------------------------------
call cordova prepare android
if errorlevel 1 (
    echo ? Error al preparar la plataforma Android
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [3/5] ?? Compilando APK Release...
echo ----------------------------------------------------------------
cd platforms\android
call .\gradlew assembleRelease
if errorlevel 1 (
    cd ..\..
    echo ? Error al compilar
    pause
    exit /b 1
)
cd ..\..

echo.
echo ----------------------------------------------------------------
echo [4/5] ?? Firmando APK con apksigner...
echo ----------------------------------------------------------------
echo.

REM Buscar apksigner (versión más reciente)
set APKSIGNER_PATH=
for /d %%i in ("%ANDROID_HOME%\build-tools\*") do (
    if exist "%%i\apksigner.bat" (
        set APKSIGNER_PATH=%%i\apksigner.bat
    )
)

if "%APKSIGNER_PATH%"=="" (
    echo ? apksigner no encontrado en ANDROID_HOME
    pause
    exit /b 1
)

echo Firmando como: %APK_NAME%
echo.

call "%APKSIGNER_PATH%" sign ^
    --ks %KEYSTORE_FILE% ^
    --ks-key-alias %KEYSTORE_ALIAS% ^
    --ks-pass pass:%KEYSTORE_PASS% ^
    --key-pass pass:%KEYSTORE_PASS% ^
    --out %APK_NAME% ^
    platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk

if errorlevel 1 (
    echo ? Error al firmar el APK
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [5/5] ? Verificando firma del APK...
echo ----------------------------------------------------------------
call "%APKSIGNER_PATH%" verify --verbose %APK_NAME%
if errorlevel 1 (
    echo ? El APK NO está correctamente firmado
    pause
    exit /b 1
)

echo.
echo +----------------------------------------------------------------+
echo ¦                    ? COMPILACIÓN EXITOSA v%APP_VERSION%       ¦
echo +----------------------------------------------------------------+
echo.
echo ?? APK generado: %APK_NAME%
echo ?? Ubicación: %CD%\%APK_NAME%
echo.
echo ?? Información del APK:
for %%I in (%APK_NAME%) do echo    Tamaño: %%~zI bytes
echo.
echo ?? Próximos pasos:
echo    1. Prueba el APK: adb install -r %APK_NAME%
echo    2. Verifica funcionamiento de botones físicos
echo    3. ¡Listo para distribuir!
echo.
pause
