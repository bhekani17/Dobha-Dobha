@echo off
REM Build script for Dobha Dobha app with Google Sign-In configuration
REM Usage: build.bat [apk|aab] [release|debug]

setlocal enabledelayedexpansion

set BUILD_TYPE=%1
if "%BUILD_TYPE%"=="" set BUILD_TYPE=apk

set BUILD_MODE=%2
if "%BUILD_MODE%"=="" set BUILD_MODE=release

if "%API_BASE_URL%"=="" (
  echo Set API_BASE_URL and DEPLOYMENT_STAGE=dev or prod before building. 1>&2
  exit /b 1
)
if not "%DEPLOYMENT_STAGE%"=="dev" if not "%DEPLOYMENT_STAGE%"=="prod" (
  echo DEPLOYMENT_STAGE must be dev or prod. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if not "%API_BASE_URL:~0,8%"=="https://" (
  echo Production builds require an HTTPS API_BASE_URL. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if "%API_BASE_URL:~-4%"=="/dev" (
  echo Production builds cannot use the dev API stage. 1>&2
  exit /b 1
)
if "%DEPLOYMENT_STAGE%"=="prod" if "%API_BASE_URL:~-5%"=="/dev/" (
  echo Production builds cannot use the dev API stage. 1>&2
  exit /b 1
)

cd /d "%~dp0"

echo Building Flutter app (%BUILD_TYPE%, %BUILD_MODE%) with Google Sign-In config...
flutter build %BUILD_TYPE% --%BUILD_MODE% --dart-define-from-file=config/google.json --dart-define=DEPLOYMENT_STAGE=%DEPLOYMENT_STAGE% --dart-define=API_BASE_URL=%API_BASE_URL%
if errorlevel 1 exit /b 1

echo Build complete!

endlocal
