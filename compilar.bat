@echo off
chcp 65001 >nul

REM ================================================
REM          CONFIGURACIùN DE JAVA (JDK)
REM ================================================
call "%~dp0setup-java.bat"
if errorlevel 1 (
    pause
    exit /b 1
)

call "%~dp0setup-gradle.bat"
if errorlevel 1 (
    pause
    exit /b 1
)

REM ================================================
REM          CONFIGURACIùN DE VERSIùN
REM ================================================
set APP_VERSION=4.0.0
set APP_NAME=ControlVoltes
set APK_NAME=%APP_NAME%-v%APP_VERSION%.apk

REM ================================================
REM          CONFIGURACIùN DEL KEYSTORE
REM ================================================
set KEYSTORE_FILE=control-voltes.keystore
set KEYSTORE_ALIAS=control-voltes

echo +----------------------------------------------------------------+
echo ù         Compilaciùn %APP_NAME% v%APP_VERSION% Release         ù
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
echo    - Versiùn actual: %APP_VERSION%
echo    - APK final: %APK_NAME%
echo    - Asegùrate de haber actualizado la versiùn tambiùn en:
echo       ù config.xml
echo       ù package.json
echo       ù www/manifest.json
echo       ù www/scripts.js
echo       ù www/sw.js
echo.

set /p CONTINUAR="ùContinuar con la compilaciùn Release v%APP_VERSION%? (S/N): "
if /i not "%CONTINUAR%"=="S" (
    echo Compilaciùn cancelada.
    pause
    exit /b 0
)

echo.
echo ?? Introduce la contraseùa del keystore:
set /p KEYSTORE_PASS="   Contraseùa: "
if "%KEYSTORE_PASS%"=="" (
    echo ? La contraseùa no puede estar vacùa.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [1/5] ?? Limpiando builds anteriores...
echo ----------------------------------------------------------------
cd platforms\android
call .\gradlew.bat clean
set CLEAN_ERR=%errorlevel%
cd ..\..
if not "%CLEAN_ERR%"=="0" (
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

REM Buscar apksigner (versiùn mùs reciente)
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
    echo ? El APK NO estù correctamente firmado
    pause
    exit /b 1
)

echo.
echo +----------------------------------------------------------------+
echo ù                    ? COMPILACIùN EXITOSA v%APP_VERSION%       ù
echo +----------------------------------------------------------------+
echo.
echo ?? APK generado: %APK_NAME%
echo ?? Ubicaciùn: %CD%\%APK_NAME%
echo.
echo ?? Informaciùn del APK:
for %%I in (%APK_NAME%) do echo    Tamaùo: %%~zI bytes
echo.
echo ?? Prùximos pasos:
echo    1. Prueba el APK: adb install -r %APK_NAME%
echo    2. Verifica funcionamiento de botones fùsicos
echo    3. ùListo para distribuir!
echo.
pause
