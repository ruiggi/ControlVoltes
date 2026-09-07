@echo off
setlocal EnableDelayedExpansion

set "PROJECT_ROOT=%~dp0"
set "GRADLE_TOOLS=%PROJECT_ROOT%platforms\android\tools"
set "GRADLE_PLATFORM=%PROJECT_ROOT%platforms\android"
set "WRAPPER_JAR=%GRADLE_TOOLS%\gradle\wrapper\gradle-wrapper.jar"
set "GRADLE_VERSION=8.14.2"

if not exist "%GRADLE_PLATFORM%\gradlew.bat" (
    echo.
    echo ? ERROR: No se encuentra la plataforma Android en platforms\android
    echo    Ejecuta primero: cordova platform add android
    echo.
    exit /b 1
)

call :find_gradle
call :ensure_wrapper
call :sync_wrapper
exit /b 0

:find_gradle
where gradle >nul 2>&1
if not errorlevel 1 exit /b 0

REM Gradle descargado previamente por el wrapper (compilaciones anteriores)
for /d %%d in ("%USERPROFILE%\.gradle\wrapper\dists\gradle-*") do (
    for /d %%h in ("%%d\*") do (
        for /d %%g in ("%%h\gradle-*") do (
            if exist "%%g\bin\gradle.bat" (
                set "PATH=%%g\bin;%PATH%"
                exit /b 0
            )
        )
    )
)

REM Gradle portable del proyecto
for /d %%g in ("%PROJECT_ROOT%.tools\gradle\gradle-*") do (
    if exist "%%g\bin\gradle.bat" (
        set "PATH=%%g\bin;%PATH%"
        exit /b 0
    )
)

REM Android Studio
for /d %%g in ("C:\Program Files\Android\Android Studio\gradle\gradle-*") do (
    if exist "%%g\bin\gradle.bat" (
        set "PATH=%%g\bin;%PATH%"
        exit /b 0
    )
)

REM Instalacion global en Program Files
for /d %%g in ("C:\Program Files\Gradle\gradle-*") do (
    if exist "%%g\bin\gradle.bat" (
        set "PATH=%%g\bin;%PATH%"
        exit /b 0
    )
)
exit /b 0

:ensure_wrapper
if exist "%WRAPPER_JAR%" exit /b 0

where gradle >nul 2>&1
if not errorlevel 1 (
    echo Generando Gradle Wrapper v%GRADLE_VERSION%...
    pushd "%GRADLE_TOOLS%"
    call gradle wrapper --gradle-version %GRADLE_VERSION%
    set "GRADLE_ERR=!errorlevel!"
    popd
    if exist "%WRAPPER_JAR%" exit /b 0
    if not "!GRADLE_ERR!"=="0" (
        echo ? No se pudo generar el wrapper con Gradle local.
    )
)

echo Descargando gradle-wrapper.jar...
set "WRAPPER_DIR=%GRADLE_TOOLS%\gradle\wrapper"
if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$url='https://raw.githubusercontent.com/gradle/gradle/v%GRADLE_VERSION%/gradle/wrapper/gradle-wrapper.jar';" ^
    "try { Invoke-WebRequest -Uri $url -OutFile '%WRAPPER_JAR%' -UseBasicParsing; exit 0 } catch { Write-Host $_.Exception.Message; exit 1 }"

if not exist "%WRAPPER_JAR%" (
    echo.
    echo ? ERROR: No se pudo preparar Gradle Wrapper.
    echo.
    echo    Soluciones:
    echo    1. Instala Gradle: winget install Gradle.Gradle
    echo    2. O abre el proyecto en Android Studio y compila una vez
    echo    3. Verifica tu conexion a internet para descargar el wrapper
    echo.
    exit /b 1
)
exit /b 0

:sync_wrapper
xcopy /E /I /Y "%GRADLE_TOOLS%\gradle" "%GRADLE_PLATFORM%\gradle\" >nul 2>&1
copy /Y "%GRADLE_TOOLS%\gradlew.bat" "%GRADLE_PLATFORM%\gradlew.bat" >nul 2>&1
if exist "%GRADLE_TOOLS%\gradlew" copy /Y "%GRADLE_TOOLS%\gradlew" "%GRADLE_PLATFORM%\gradlew" >nul 2>&1
if exist "%GRADLE_TOOLS%\.gradle" xcopy /E /I /Y "%GRADLE_TOOLS%\.gradle" "%GRADLE_PLATFORM%\.gradle\" >nul 2>&1
exit /b 0
