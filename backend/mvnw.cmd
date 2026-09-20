@REM ----------------------------------------------------------------------------
@REM Maven Wrapper startup script for Windows
@REM ----------------------------------------------------------------------------
@echo off
setlocal

set WRAPPER_DIR=%~dp0
set WRAPPER_PROPERTIES=%WRAPPER_DIR%.mvn\wrapper\maven-wrapper.properties
set MAVEN_USER_HOME=%USERPROFILE%\.m2
set MAVEN_HOME=%MAVEN_USER_HOME%\wrapper\dists\apache-maven-3.9.9

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
    echo Downloading Maven 3.9.9...
    if not exist "%MAVEN_USER_HOME%\wrapper\dists" mkdir "%MAVEN_USER_HOME%\wrapper\dists"
    set MAVEN_ZIP=%MAVEN_USER_HOME%\wrapper\dists\apache-maven-3.9.9.zip
    powershell -Command "[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.9/apache-maven-3.9.9-bin.zip' -OutFile '%MAVEN_ZIP%' -UseBasicParsing"
    if errorlevel 1 (
        echo ERROR: Failed to download Maven. Check your internet connection.
        exit /b 1
    )
    echo Extracting Maven...
    powershell -Command "Expand-Archive -Path '%MAVEN_ZIP%' -DestinationPath '%MAVEN_USER_HOME%\wrapper\dists' -Force"
    del "%MAVEN_ZIP%" 2>nul
)

"%MAVEN_HOME%\bin\mvn.cmd" %*
