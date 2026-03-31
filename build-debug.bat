@echo off
chcp 65001 >nul
echo ╔════════════════════════════════════════════════════════════════╗
echo ║         Compilación VOLTES en modo DEBUG                      ║
echo ║         (Para depuración con chrome://inspect)                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

echo 📋 Esta compilación genera una APK DEBUG que permite:
echo    - Ver la app en chrome://inspect
echo    - Depurar JavaScript con Chrome DevTools
echo    - Ver logs en tiempo real
echo.
echo ⚠️  NOTA: Esta APK NO está firmada y NO es para distribución.
echo    Usa build-release.bat para generar la versión final.
echo.

set /p CONTINUAR="¿Continuar con la compilación DEBUG? (S/N): "
if /i not "%CONTINUAR%"=="S" (
    echo Compilación cancelada.
    pause
    exit /b 0
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [1/3] 🧹 Limpiando builds anteriores...
echo ════════════════════════════════════════════════════════════════
call cordova clean android
if errorlevel 1 (
    echo ❌ Error al limpiar
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [2/3] 🔄 Preparando plataforma Android...
echo ════════════════════════════════════════════════════════════════
call cordova prepare android
if errorlevel 1 (
    echo ❌ Error al preparar la plataforma Android
    pause
    exit /b 1
)

echo.
echo ════════════════════════════════════════════════════════════════
echo [3/3] 🔨 Compilando APK DEBUG...
echo ════════════════════════════════════════════════════════════════
cd platforms\android
call .\gradlew assembleDebug
if errorlevel 1 (
    cd ..\..
    echo ❌ Error al compilar
    pause
    exit /b 1
)
cd ..\..

echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    ✅ COMPILACIÓN EXITOSA                      ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 📦 APK DEBUG generado: app-debug.apk
echo 📍 Ubicación: %CD%\platforms\android\app\build\outputs\apk\debug\app-debug.apk
echo.

REM Verificar si hay un dispositivo conectado
echo 🔍 Verificando dispositivos conectados...
adb devices | findstr /I "device$" >nul
if errorlevel 1 (
    echo ⚠️  No se detectó ningún dispositivo Android conectado.
    echo    Conecta tu móvil por USB y activa la depuración USB.
) else (
    echo ✅ Dispositivo detectado.
    echo.
    set /p INSTALAR="¿Instalar la APK en el dispositivo conectado? (S/N): "
    if /i "%INSTALAR%"=="S" (
        echo.
        echo 📲 Instalando APK en el dispositivo...
        adb install -r platforms\android\app\build\outputs\apk\debug\app-debug.apk
        if errorlevel 1 (
            echo ❌ Error al instalar. Intenta manualmente:
            echo    adb install -r platforms\android\app\build\outputs\apk\debug\app-debug.apk
        ) else (
            echo ✅ APK instalada correctamente.
        )
    )
)

echo.
echo 🚀 Próximos pasos para depurar:
echo    1. Abre la app VOLTES en tu móvil
echo    2. En Chrome (PC), abre: chrome://inspect
echo    3. Deberías ver tu dispositivo y la app listada
echo    4. Pulsa "inspect" para abrir DevTools
echo    5. Ve a la pestaña Console para ver los logs
echo.
echo 📝 Ver logs nativos de Android:
echo    adb logcat | findstr /I "VolumeButtons MainActivity"
echo.
pause

