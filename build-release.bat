@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════════════╗
echo ║         Compilación VOLTES v2.0.0 Release                     ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Verificar si existe el keystore
if not exist "control-voltes.keystore" (
    echo ❌ ERROR: No se encuentra el archivo control-voltes.keystore
    echo.
    echo 📝 Debes generar el keystore primero con este comando:
    echo.
    echo keytool -genkey -v -keystore control-voltes.keystore -alias control-voltes -keyalg RSA -keysize 2048 -validity 10000
    echo.
    pause
    exit /b 1
)

echo 📋 Instrucciones:
echo    1. Asegúrate de haber actualizado la versión en todos los archivos
echo    2. El keystore ya existe (control-voltes.keystore)
echo    3. La contraseña está configurada en el script
echo.
echo Archivos donde actualizar la versión:
echo    - config.xml
echo    - package.json
echo    - www/manifest.json
echo    - www/scripts.js (appVersion)
echo    - www/sw.js (CACHE_NAME)
echo.
set /p CONTINUAR="¿Continuar con la compilación? (S/N): "
if /i not "%CONTINUAR%"=="S" (
    echo Compilación cancelada.
    pause
    exit /b 0
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [1/5] 🧹 Limpiando builds anteriores...
echo ════════════════════════════════════════════════════════════════
call cordova clean android
if errorlevel 1 (
    echo ❌ Error al limpiar
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [2/5] 🔄 Preparando plataforma Android (iconos, recursos, etc.)...
echo ════════════════════════════════════════════════════════════════
call cordova prepare android
if errorlevel 1 (
    echo ❌ Error al preparar la plataforma Android
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [3/5] 🔨 Compilando APK Release (usando Gradle directamente)...
echo ════════════════════════════════════════════════════════════════
echo Nota: Usando gradlew porque cordova build genera AAB en lugar de APK
echo.
cd platforms\android
call .\gradlew assembleRelease
if errorlevel 1 (
    cd ..\..
    echo ❌ Error al compilar
    pause
    exit /b 1
)
cd ..\..

echo.
echo ════════════════════════════════════════════════════════════════
echo [4/5] 🔑 Firmando APK con apksigner (herramienta moderna)...
echo ════════════════════════════════════════════════════════════════
echo.
echo Usando keystore existente con contraseña configurada...
echo Nota: apksigner firma con esquemas v2 y v3 (modernos) y hace zipalign automáticamente
echo.

REM Buscar apksigner en el Android SDK (busca la versión más reciente)
set APKSIGNER_PATH=
for /d %%i in ("%ANDROID_HOME%\build-tools\*") do (
    if exist "%%i\apksigner.bat" (
        set APKSIGNER_PATH=%%i\apksigner.bat
    )
)

if "%APKSIGNER_PATH%"=="" (
    echo ❌ apksigner no encontrado en ANDROID_HOME
    echo    Verifica que Android SDK esté instalado correctamente
    pause
    exit /b 1
)

echo Usando: %APKSIGNER_PATH%
echo.

call "%APKSIGNER_PATH%" sign --ks control-voltes.keystore --ks-key-alias control-voltes --ks-pass pass:SultanSultanSultan --key-pass pass:SultanSultanSultan --out ControlVoltes-v2.0.0.apk platforms\android\app\build\outputs\apk\release\app-release-unsigned.apk
if errorlevel 1 (
    echo ❌ Error al firmar el APK
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [5/5] ✅ Verificando firma del APK...
echo ════════════════════════════════════════════════════════════════
call "%APKSIGNER_PATH%" verify --verbose ControlVoltes-v2.0.0.apk
if errorlevel 1 (
    echo ❌ El APK NO está correctamente firmado
    pause
    exit /b 1
)

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    ✅ COMPILACIÓN EXITOSA                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📦 APK generado: ControlVoltes-v2.0.0.apk
echo 📍 Ubicación: %CD%\ControlVoltes-v2.0.0.apk
echo.
echo 📊 Información del APK:
for %%I in (ControlVoltes-v2.0.0.apk) do echo    Tamaño: %%~zI bytes
echo.
echo 🚀 Próximos pasos:
echo    1. Prueba el APK en un dispositivo: adb install -r ControlVoltes-v2.0.0.apk
echo    2. Verifica que los botones físicos funcionen correctamente
echo    3. Si todo está bien, ¡ya puedes distribuir la app!
echo.
echo 📝 Notas:
echo    - Keystore: control-voltes.keystore
echo    - Contraseña: SultanSultanSultan
echo    - Firmado con apksigner (esquemas v2 y v3 modernos)
echo    - Guarda el keystore para futuras actualizaciones
echo.
pause

