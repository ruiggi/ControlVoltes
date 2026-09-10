@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM ================================================
REM          CONFIGURACI?N DE JAVA (JDK)
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
REM          CONFIGURACI?N DE VERSI?N (app-version.json)
REM ================================================
where node >nul 2>&1
if errorlevel 1 (
    echo ? ERROR: Node.js no esta en el PATH. Necesario para leer app-version.json
    pause
    exit /b 1
)
if not exist "app-version.json" (
    echo ? ERROR: No se encuentra app-version.json
    pause
    exit /b 1
)
for /f "delims=" %%a in ('node -e "const d=require('./app-version.json');console.log(d.version)"') do set APP_VERSION=%%a
for /f "delims=" %%a in ('node -e "const d=require('./app-version.json');console.log(d.releaseDate)"') do set APP_RELEASE_DATE=%%a
set APP_NAME=ControlVoltes
set APK_NAME=%APP_NAME%-v%APP_VERSION%.apk

REM ================================================
REM          CONFIGURACI?N DEL KEYSTORE
REM ================================================
set KEYSTORE_FILE=control-voltes.keystore
set KEYSTORE_ALIAS=control-voltes

echo +----------------------------------------------------------------+
echo ?         Compilaci?n %APP_NAME% v%APP_VERSION% Release         ?
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
echo    - Version (app-version.json): %APP_VERSION% (%APP_RELEASE_DATE%)
echo    - APK final: %APK_NAME%
echo    - Para cambiar version: ejecuta sync-version.bat antes de compilar
echo.

set /p CONTINUAR="?Continuar con la compilaci?n Release v%APP_VERSION%? (S/N): "
if /i not "%CONTINUAR%"=="S" (
    echo Compilaci?n cancelada.
    pause
    exit /b 0
)

echo.
echo ?? Introduce la contrase?a del keystore:
set /p KEYSTORE_PASS="   Contrase?a: "
if "%KEYSTORE_PASS%"=="" (
    echo ? La contrase?a no puede estar vac?a.
    pause
    exit /b 1
)

echo.
echo ----------------------------------------------------------------
echo [0/5] ?? Sincronizando versi?n en config.xml, package.json, www...
echo ----------------------------------------------------------------
node "%~dp0scripts\sync-version.js"
if errorlevel 1 (
    echo ? Error al sincronizar la versi?n
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
echo [2/5] ?? Preparando plataforma Android (cordova prepare)...
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

REM Buscar apksigner (versi?n m?s reciente)
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
    echo ? El APK NO est? correctamente firmado
    pause
    exit /b 1
)

echo.
echo +----------------------------------------------------------------+
echo ?                    ? COMPILACI?N EXITOSA v%APP_VERSION%       ?
echo +----------------------------------------------------------------+
echo.
echo ?? APK generado: %APK_NAME%
echo ?? Ubicaci?n: %CD%\%APK_NAME%
echo.
echo ?? Informaci?n del APK:
for %%I in (%APK_NAME%) do echo    Tama?o: %%~zI bytes
echo.
echo ?? Pr?ximos pasos:
echo    1. Prueba el APK: adb install -r %APK_NAME%
echo    2. Verifica funcionamiento de botones f?sicos
echo    3. ?Listo para distribuir!
echo.
pause
