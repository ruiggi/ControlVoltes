@echo off
REM Configura JAVA_HOME para Cordova/Gradle si el del sistema no es valido.

if defined CORDOVA_JAVA_HOME (
    if exist "%CORDOVA_JAVA_HOME%\bin\javac.exe" (
        set "JAVA_HOME=%CORDOVA_JAVA_HOME%"
        set "PATH=%CORDOVA_JAVA_HOME%\bin;%PATH%"
        exit /b 0
    )
)

if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\javac.exe" (
        set "CORDOVA_JAVA_HOME=%JAVA_HOME%"
        set "PATH=%JAVA_HOME%\bin;%PATH%"
        exit /b 0
    )
)

REM Eclipse Adoptium (JDK usado previamente por Gradle en este proyecto)
for /f "delims=" %%j in ('dir /b /ad /o-n "C:\Program Files\Eclipse Adoptium\jdk-*" 2^>nul') do (
    if exist "C:\Program Files\Eclipse Adoptium\%%j\bin\javac.exe" (
        set "JAVA_HOME=C:\Program Files\Eclipse Adoptium\%%j"
        set "CORDOVA_JAVA_HOME=C:\Program Files\Eclipse Adoptium\%%j"
        set "PATH=C:\Program Files\Eclipse Adoptium\%%j\bin;%PATH%"
        exit /b 0
    )
)

REM Oracle / OpenJDK en Program Files\Java
for /f "delims=" %%j in ('dir /b /ad /o-n "C:\Program Files\Java\jdk-*" 2^>nul') do (
    if exist "C:\Program Files\Java\%%j\bin\javac.exe" (
        set "JAVA_HOME=C:\Program Files\Java\%%j"
        set "CORDOVA_JAVA_HOME=C:\Program Files\Java\%%j"
        set "PATH=C:\Program Files\Java\%%j\bin;%PATH%"
        exit /b 0
    )
)

echo.
echo ? ERROR: No se encuentra un JDK valido (javac.exe).
echo.
echo    Tu JAVA_HOME actual apunta a una ruta invalida:
if defined JAVA_HOME echo       %JAVA_HOME%
echo.
echo    Soluciones:
echo    1. Instala JDK 17 desde https://adoptium.net/
echo    2. Corrige JAVA_HOME en Variables de entorno de Windows
echo       (Panel de control - Sistema - Configuracion avanzada)
echo.
exit /b 1
