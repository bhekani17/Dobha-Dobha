@echo off
REM Build script for Dobha Dobha app with Google Sign-In configuration
REM Usage: build.bat [apk|aab] [release|debug]

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=apk

set BUILD_MODE=%2
if "%BUILD_MODE%"=="" set BUILD_MODE=release

cd /d "%~dp0"

echo Building Flutter app (%BUILD_TYPE%, %BUILD_MODE%) with Google Sign-In config...
flutter build %BUILD_TYPE% --%BUILD_MODE% --dart-define-from-file=config/google.json

echo Build complete!

endlocal
